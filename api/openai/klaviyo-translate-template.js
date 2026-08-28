const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const { buildGlossaryPromptBlock } = require("../../server/lib/glossary");
const { buildWestpackKnowledgePromptBlock } = require("../../server/lib/westpack-knowledge");
const { removeStandalonePriceBlocks } = require("../../server/lib/klaviyo-product-feed");
const { rewriteWestpackProductFeedUrls, rewriteWestpackSnippetUrls } = require("../../server/lib/westpack-url-locales");
const { generateTemplateVariant } = require("../../server/lib/klaviyo-template-variant");

function containsHtml(value = "") {
  return /<[^>]+>/.test(String(value || ""));
}

function createGlossaryBlock(input) {
  return buildGlossaryPromptBlock({
    targetLanguage: input?.targetLanguage || "",
    sourceTexts: [
      input?.sourceTemplateName,
      input?.sourceSubject,
      input?.sourcePreviewText,
      input?.sourceBody,
      input?.operatorNote
    ]
  });
}

function createWestpackKnowledgeBlock(input) {
  return buildWestpackKnowledgePromptBlock({
    channel: "klaviyo",
    sourceTexts: [
      input?.sourceTemplateName,
      input?.sourceSubject,
      input?.sourcePreviewText,
      input?.sourceBody,
      input?.operatorNote
    ]
  });
}

function buildPlainPrompt(input, glossaryBlock, westpackKnowledgeBlock) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a Westpack-specific Klaviyo translation engine.",
            "Your role is translator, not copywriter.",
            "Translate the campaign faithfully into the target language without changing structure, hierarchy, message order, CTA logic or commercial intent.",
            "Do not add, remove or invent content. Do not improve, shorten or rewrite strategically.",
            "Only make the wording natural and correct for the target language and country.",
            "Preserve merge tags, unsubscribe tags, tracked URLs, dynamic placeholders and any technical Klaviyo syntax exactly as written.",
            "If a glossary term matches, you must use the glossary translation.",
            glossaryBlock,
            westpackKnowledgeBlock,
            "Return strict JSON with keys: subject, previewText, body, rationale."
          ].join(" ")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            `Source template: ${input?.sourceTemplateName || "Unknown template"}`,
            `Translation path: ${input?.translationPath || "DA -> UK or UK -> target"}`,
            `Target language: ${input?.targetLanguage || "Unknown"}`,
            `Operator note: ${input?.operatorNote || "None"}`,
            "",
            "Source subject:",
            input?.sourceSubject || "",
            "",
            "Source preview text:",
            input?.sourcePreviewText || "",
            "",
            "Source body:",
            input?.sourceBody || ""
          ].join("\n")
        }
      ]
    }
  ];
}

function isProtectedTextSegment(value = "") {
  const text = String(value || "");
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (!/[A-Za-zÀ-ÿ]/.test(trimmed)) return true;
  if (/({{|}}|{%-?|-%}|{%|%})/.test(trimmed)) return true;
  if (/(https?:\/\/|mailto:|tel:|%20)/i.test(trimmed)) return true;
  return false;
}

function extractHtmlSegments(html = "") {
  const source = String(html || "");
  const parts = source.split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->|<[^>]+>)/gi);
  const tokens = [];
  const segments = [];

  for (const part of parts) {
    if (!part) continue;
    if (/^(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->|<[^>]+>)$/i.test(part)) {
      tokens.push({ type: "markup", value: part });
      continue;
    }

    if (isProtectedTextSegment(part)) {
      tokens.push({ type: "text", value: part, translatable: false });
      continue;
    }

    const index = segments.length;
    segments.push(part);
    tokens.push({ type: "text", value: part, translatable: true, index });
  }

  return { tokens, segments };
}

function rebuildHtml(tokens, translatedSegments) {
  return tokens.map((token) => {
    if (token.type !== "text" || !token.translatable) {
      return token.value;
    }
    return translatedSegments[token.index] ?? token.value;
  }).join("");
}

function buildHtmlPrompt(input, segments, glossaryBlock, westpackKnowledgeBlock) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a Westpack-specific Klaviyo translation engine.",
            "Your role is translator, not copywriter.",
            "You will receive visible HTML text fragments already extracted from a source email template.",
            "Translate each fragment faithfully into the target language.",
            "Do not change order. Do not merge fragments. Do not split fragments. Do not invent content.",
            "Keep the commercial meaning identical. Only translate wording.",
            "Translate human-readable header and footer copy too, including browser-view links, navigation labels, slogans, disclaimers and unsubscribe text.",
            "Do not leave layout copy in the source language unless it is a company name, physical address, phone number, email address, legal identifier or raw URL.",
            "Preserve placeholders, merge tags, unsubscribe tags, tracked URLs and technical syntax exactly if any appear inside a fragment.",
            "If a glossary term matches, you must use the glossary translation.",
            glossaryBlock,
            westpackKnowledgeBlock,
            "Return strict JSON with keys: subject, previewText, fragments, rationale.",
            "The fragments array must have exactly the same number of items and the same order as the source fragments."
          ].join(" ")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            `Source template: ${input?.sourceTemplateName || "Unknown template"}`,
            `Translation path: ${input?.translationPath || "DA -> UK or UK -> target"}`,
            `Target language: ${input?.targetLanguage || "Unknown"}`,
            `Operator note: ${input?.operatorNote || "None"}`,
            "",
            "Source subject:",
            input?.sourceSubject || "",
            "",
            "Source preview text:",
            input?.sourcePreviewText || "",
            "",
            "Source HTML text fragments in order:",
            ...segments.map((segment, index) => `[${index + 1}] ${segment}`)
          ].join("\n")
        }
      ]
    }
  ];
}

function extractJsonText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const textParts = [];
  const outputs = Array.isArray(payload.output) ? payload.output : [];
  for (const output of outputs) {
    const content = Array.isArray(output.content) ? output.content : [];
    for (const item of content) {
      if (item.type === "output_text" && item.text) {
        textParts.push(item.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

async function requestStructuredResponse(config, prompt, schemaName, schema) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI request failed.");
  }

  return {
    parsed: JSON.parse(extractJsonText(payload)),
    model: payload.model || config.openAiModel
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  if (!requireAuth(req, res, config)) {
    return;
  }
  if (!config.openAiApiKey) {
    sendJson(res, 500, { error: "Missing OpenAI API key." });
    return;
  }

  try {
    const input = await readJsonBody(req);
    if (String(input?.mode || "").trim() === "variant") {
      const payload = await generateTemplateVariant({ config, input, requestStructuredResponse });
      sendJson(res, 200, payload);
      return;
    }
    const sourceBody = String(input?.sourceBody || "");
    const targetCountry = String(input?.country || input?.targetCountry || "").trim().toUpperCase();
    const glossaryBlock = createGlossaryBlock(input);
    const westpackKnowledgeBlock = createWestpackKnowledgeBlock(input);

    if (containsHtml(sourceBody)) {
      const { tokens, segments } = extractHtmlSegments(sourceBody);
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          subject: { type: "string" },
          previewText: { type: "string" },
          fragments: {
            type: "array",
            items: { type: "string" }
          },
          rationale: { type: "string" }
        },
        required: ["subject", "previewText", "fragments", "rationale"]
      };

      const { parsed, model } = await requestStructuredResponse(
        config,
        buildHtmlPrompt(input, segments, glossaryBlock, westpackKnowledgeBlock),
        "westpack_klaviyo_html_translation",
        schema
      );

      const translatedSegments = Array.isArray(parsed.fragments) ? parsed.fragments : [];
      if (translatedSegments.length !== segments.length) {
        throw new Error("Translated HTML fragment count did not match the source template.");
      }

      sendJson(res, 200, {
        subject: parsed.subject || "",
        previewText: parsed.previewText || "",
        body: removeStandalonePriceBlocks(
          localizeWestpackUrls(rebuildHtml(tokens, translatedSegments), targetCountry)
        ),
        rationale: parsed.rationale || "",
        model,
        generatedAt: new Date().toISOString()
      });
      return;
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: { type: "string" },
        previewText: { type: "string" },
        body: { type: "string" },
        rationale: { type: "string" }
      },
      required: ["subject", "previewText", "body", "rationale"]
    };

    const { parsed, model } = await requestStructuredResponse(
      config,
      buildPlainPrompt(input, glossaryBlock, westpackKnowledgeBlock),
      "westpack_klaviyo_template_translation",
      schema
    );

    sendJson(res, 200, {
      ...parsed,
      body: removeStandalonePriceBlocks(
        localizeWestpackUrls(parsed.body || "", targetCountry)
      ),
      model,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Klaviyo template translation failed." });
  }
};
function localizeWestpackUrls(content = "", targetCountry = "") {
  return rewriteWestpackSnippetUrls(
    rewriteWestpackProductFeedUrls(content, targetCountry),
    targetCountry
  );
}
