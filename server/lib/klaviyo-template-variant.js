"use strict";

const { buildGlossaryPromptBlock } = require("./glossary");
const { buildWestpackKnowledgePromptBlock } = require("./westpack-knowledge");
const { removeStandalonePriceBlocks } = require("./klaviyo-product-feed");
const { rewriteWestpackProductFeedUrls, rewriteWestpackSnippetUrls } = require("./westpack-url-locales");

function containsHtml(value = "") {
  return /<[^>]+>/.test(String(value || ""));
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

function rebuildHtml(tokens, rewrittenSegments) {
  return tokens.map((token) => {
    if (token.type !== "text" || !token.translatable) return token.value;
    return rewrittenSegments[token.index] ?? token.value;
  }).join("");
}

function createGlossaryBlock(input) {
  return buildGlossaryPromptBlock({
    targetLanguage: input?.sourceLanguage || "Source language",
    sourceTexts: [
      input?.sourceTemplateName,
      input?.sourceSubject,
      input?.sourcePreviewText,
      input?.sourceBody,
      input?.operatorBrief
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
      input?.operatorBrief
    ]
  });
}

function buildVariantPlainPrompt(input, glossaryBlock, knowledgeBlock) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a senior Westpack Klaviyo email operator and copywriter.",
            "Rewrite the full source email into one alternative version based on the operator brief.",
            "This is a full-email variant task, not a small subject-line tweak.",
            "You should adapt the whole email where relevant: hero framing, copy blocks, CTA wording, pacing, urgency level, sequencing, and emphasis.",
            "Keep the same overall structure, technical setup, Westpack facts, product focus, links, placeholders, merge tags, and unsubscribe syntax unless the operator brief explicitly requires structural change.",
            "Do not invent discounts, deadlines, gifts, stock levels, or legal claims unless they are already present in the source or explicitly requested.",
            "The output should feel like a real alternative mail in the same campaign family, suitable for follow-up, more urgency, a different persuasion angle, or another operator-requested twist.",
            "Return strict JSON with keys: templateName, subject, previewText, body, rationale, sendStrategyNote.",
            glossaryBlock,
            knowledgeBlock
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
            `Source subject: ${input?.sourceSubject || ""}`,
            `Source preview text: ${input?.sourcePreviewText || ""}`,
            `Operator brief: ${input?.operatorBrief || "Create a clear alternative version of the full email."}`,
            "",
            "Source body:",
            input?.sourceBody || ""
          ].join("\n")
        }
      ]
    }
  ];
}

function buildVariantHtmlPrompt(input, fragments, glossaryBlock, knowledgeBlock) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a senior Westpack Klaviyo email operator and copywriter.",
            "You will receive visible HTML text fragments extracted from a source email template.",
            "Rewrite the full email into one alternative version based on the operator brief.",
            "Adapt the whole mail where useful: hero framing, copy blocks, CTA wording, pacing, urgency level, sequencing, and emphasis.",
            "Keep the same number of fragments and same order so the HTML structure remains intact.",
            "Do not merge fragments. Do not split fragments. Do not remove template sections.",
            "Preserve URLs, placeholders, merge tags, unsubscribe tags, product references, and technical syntax exactly where they appear.",
            "Do not invent discounts, deadlines, gifts, stock levels, or claims unless they are already present in the source or explicitly requested.",
            "Return strict JSON with keys: templateName, subject, previewText, fragments, rationale, sendStrategyNote.",
            "The fragments array must have exactly the same number of items and the same order as the source fragments.",
            glossaryBlock,
            knowledgeBlock
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
            `Source subject: ${input?.sourceSubject || ""}`,
            `Source preview text: ${input?.sourcePreviewText || ""}`,
            `Operator brief: ${input?.operatorBrief || "Create a clear alternative version of the full email."}`,
            "",
            "Source HTML text fragments in order:",
            ...fragments.map((segment, index) => `[${index + 1}] ${segment}`)
          ].join("\n")
        }
      ]
    }
  ];
}

function localizeWestpackUrls(content = "", targetCountry = "") {
  return rewriteWestpackSnippetUrls(
    rewriteWestpackProductFeedUrls(content, targetCountry),
    targetCountry
  );
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isLikelyEditableString(value = "", parentKey = "") {
  const text = String(value || "");
  const key = String(parentKey || "").toLowerCase();
  if (!text.trim()) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(text)) return false;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(text.trim())) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text.trim())) return false;
  if (/^[_a-z0-9-]+$/i.test(text.trim()) && text.trim().length < 24 && !/\s/.test(text.trim()) && !/<[^>]+>/.test(text)) return false;
  if (/(^|_)(id|href|src|url|image|icon|color|background|font|padding|margin|radius|width|height|align|layout|class|classname|style|asset|block|section|column|row|mobile|desktop|border|weight|size|family)($|_)/i.test(key)) return false;
  return true;
}

function collectDefinitionTextNodes(value, path = [], parentKey = "", nodes = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectDefinitionTextNodes(item, path.concat(index), parentKey, nodes));
    return nodes;
  }

  if (!value || typeof value !== "object") {
    return nodes;
  }

  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === "string") {
      if (isLikelyEditableString(entry, key)) {
        nodes.push({
          path: path.concat(key),
          key,
          value: entry
        });
      }
      return;
    }

    if (entry && typeof entry === "object") {
      collectDefinitionTextNodes(entry, path.concat(key), key, nodes);
    }
  });

  return nodes;
}

function setValueAtPath(target, path, nextValue) {
  if (!target || !Array.isArray(path) || !path.length) return;
  let cursor = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor?.[path[index]];
    if (cursor == null) return;
  }
  cursor[path[path.length - 1]] = nextValue;
}

function replaceFirstExact(haystack = "", needle = "", replacement = "") {
  const source = String(haystack || "");
  const find = String(needle || "");
  if (!find) return source;
  const matchIndex = source.indexOf(find);
  if (matchIndex < 0) return source;
  return source.slice(0, matchIndex) + replacement + source.slice(matchIndex + find.length);
}

function buildChangeSummary(entries = []) {
  const changedEntries = entries.filter((entry) => String(entry?.before || "") !== String(entry?.after || ""));
  return {
    changedCount: changedEntries.length,
    totalCount: entries.length,
    samples: changedEntries.slice(0, 8).map((entry) => ({
      path: Array.isArray(entry.path) ? entry.path.join(".") : "",
      before: String(entry.before || ""),
      after: String(entry.after || "")
    }))
  };
}

function buildDefinitionVariantPrompt(input, nodes, glossaryBlock, knowledgeBlock) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a senior Westpack Klaviyo email operator and copywriter.",
            "You will receive editable text nodes extracted from an existing Klaviyo drag-and-drop template definition.",
            "Rewrite the content into one alternative full-email version based on the operator brief.",
            "Keep the same node count, same order, same paths, same underlying template structure, and same technical setup.",
            "You may rewrite the persuasion layer substantially: hook, urgency, headings, CTA wording, pacing, product framing, and argument order within each text area.",
            "Do not invent discounts, deadlines, gifts, stock levels, or legal claims unless they are already present in the source or explicitly requested.",
            "If a node contains HTML tags, preserve the HTML tags and attributes exactly and only rewrite the human-visible text inside them.",
            "Return strict JSON with keys: templateName, subject, previewText, nodes, rationale, sendStrategyNote.",
            "The nodes array must contain exactly the same number of items in exactly the same order as the source nodes array.",
            glossaryBlock,
            knowledgeBlock
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
            `Source subject: ${input?.sourceSubject || ""}`,
            `Source preview text: ${input?.sourcePreviewText || ""}`,
            `Operator brief: ${input?.operatorBrief || "Create a clear alternative version of the full email."}`,
            "",
            "Editable nodes in order:",
            ...nodes.map((node, index) => `[${index + 1}] ${node.path.join(".")} :: ${node.value}`)
          ].join("\n")
        }
      ]
    }
  ];
}

async function generateTemplateVariant({ config, input, requestStructuredResponse }) {
  const sourceBody = String(input?.sourceBody || "");
  const targetCountry = String(input?.country || input?.targetCountry || "").trim().toUpperCase();
  const glossaryBlock = createGlossaryBlock(input);
  const knowledgeBlock = createWestpackKnowledgeBlock(input);
  const sourceEditorType = String(input?.sourceEditorType || "").trim().toUpperCase();
  const sourceDefinition = input?.sourceDefinition && typeof input.sourceDefinition === "object"
    ? input.sourceDefinition
    : null;

  if (sourceEditorType === "SYSTEM_DRAGGABLE" && sourceDefinition) {
    const editableNodes = collectDefinitionTextNodes(sourceDefinition);
    if (!editableNodes.length) {
      throw new Error("No editable text nodes were found in the source drag-and-drop template.");
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        templateName: { type: "string" },
        subject: { type: "string" },
        previewText: { type: "string" },
        nodes: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
        sendStrategyNote: { type: "string" }
      },
      required: ["templateName", "subject", "previewText", "nodes", "rationale", "sendStrategyNote"]
    };

    const { parsed, model } = await requestStructuredResponse(
      config,
      buildDefinitionVariantPrompt(input, editableNodes, glossaryBlock, knowledgeBlock),
      "westpack_klaviyo_template_variant_definition",
      schema
    );

    const rewrittenNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    if (rewrittenNodes.length !== editableNodes.length) {
      throw new Error("AI node count did not match the source drag-and-drop template.");
    }

    const rewrittenDefinition = cloneJson(sourceDefinition);
    let previewBody = String(sourceBody || "");
    const nodeChanges = [];
    editableNodes.forEach((node, index) => {
      const nextValue = String(rewrittenNodes[index] || "");
      setValueAtPath(rewrittenDefinition, node.path, nextValue);
      previewBody = replaceFirstExact(previewBody, node.value, nextValue);
      nodeChanges.push({
        path: node.path,
        before: node.value,
        after: nextValue
      });
    });

    return {
      templateName: parsed.templateName || "",
      subject: parsed.subject || "",
      previewText: parsed.previewText || "",
      body: removeStandalonePriceBlocks(
        localizeWestpackUrls(previewBody, targetCountry)
      ),
      rationale: parsed.rationale || "",
      sendStrategyNote: parsed.sendStrategyNote || "",
      changeSummary: buildChangeSummary(nodeChanges),
      structuredDefinition: rewrittenDefinition,
      model,
      generatedAt: new Date().toISOString()
    };
  }

  if (containsHtml(sourceBody)) {
    const { tokens, segments } = extractHtmlSegments(sourceBody);
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        templateName: { type: "string" },
        subject: { type: "string" },
        previewText: { type: "string" },
        fragments: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
        sendStrategyNote: { type: "string" }
      },
      required: ["templateName", "subject", "previewText", "fragments", "rationale", "sendStrategyNote"]
    };

    const { parsed, model } = await requestStructuredResponse(
      config,
      buildVariantHtmlPrompt(input, segments, glossaryBlock, knowledgeBlock),
      "westpack_klaviyo_template_variant_html",
      schema
    );

    const rewrittenSegments = Array.isArray(parsed.fragments) ? parsed.fragments : [];
    if (rewrittenSegments.length !== segments.length) {
      throw new Error("AI fragment count did not match the source template.");
    }
    const fragmentChanges = segments.map((segment, index) => ({
      path: [index + 1],
      before: segment,
      after: rewrittenSegments[index] ?? segment
    }));

    return {
      templateName: parsed.templateName || "",
      subject: parsed.subject || "",
      previewText: parsed.previewText || "",
      body: removeStandalonePriceBlocks(
        localizeWestpackUrls(rebuildHtml(tokens, rewrittenSegments), targetCountry)
      ),
      rationale: parsed.rationale || "",
      sendStrategyNote: parsed.sendStrategyNote || "",
      changeSummary: buildChangeSummary(fragmentChanges),
      model,
      generatedAt: new Date().toISOString()
    };
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      templateName: { type: "string" },
      subject: { type: "string" },
      previewText: { type: "string" },
      body: { type: "string" },
      rationale: { type: "string" },
      sendStrategyNote: { type: "string" }
    },
    required: ["templateName", "subject", "previewText", "body", "rationale", "sendStrategyNote"]
  };

  const { parsed, model } = await requestStructuredResponse(
    config,
    buildVariantPlainPrompt(input, glossaryBlock, knowledgeBlock),
    "westpack_klaviyo_template_variant_plain",
    schema
  );

  return {
    templateName: parsed.templateName || "",
    subject: parsed.subject || "",
    previewText: parsed.previewText || "",
    body: removeStandalonePriceBlocks(
      localizeWestpackUrls(parsed.body || "", targetCountry)
    ),
    rationale: parsed.rationale || "",
    sendStrategyNote: parsed.sendStrategyNote || "",
    model,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  generateTemplateVariant
};
