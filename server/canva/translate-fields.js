// Translating a Canva design's data fields into one target language.
//
// This does not invent a second translation engine. It reuses the glossary and the Westpack
// knowledge block that the Klaviyo template translator already uses, so a jewellery box is called
// the same thing in a Canva headline as in the email it sits inside, and it calls the same
// OpenAI Responses endpoint in the same structured-output style.
//
// What is different here, and it is the whole point: **a character budget per field**. Canva's
// REST API exposes no font size, no text box geometry and no overflow signal, so a translation
// that runs 40% long cannot be fixed afterwards by shrinking type - it just breaks the artwork.
// Length has to be controlled at the moment the words are chosen. The model is given each
// field's budget, asked to stay inside it, and asked for a genuinely shorter alternative where
// the natural translation cannot. `compact` is then used automatically when the primary is over
// budget, which is why the review screen usually shows "all text fits" rather than a wall of
// warnings.
//
// One call per language, not one per field: fields in a design are a single piece of copy split
// across boxes, and translating "Shop now" without knowing it sits under "New jewellery boxes"
// produces worse results than translating them together.

const { buildGlossaryPromptBlock } = require("../lib/glossary");
const { buildWestpackKnowledgePromptBlock } = require("../lib/westpack-knowledge");
const { assessFieldFit, normalizeText } = require("./localization");

function buildFieldBrief(fields = []) {
  return fields.map((field, index) => [
    `${index + 1}. field "${field.key}"`,
    `   source: ${field.sourceText}`,
    `   source length: ${field.sourceText.length} characters`,
    `   maximum length: ${field.budget} characters`
  ].join("\n")).join("\n");
}

function buildPrompt({ fields, sourceLanguage, targetLanguage, marketCode, designTitle, glossaryBlock, knowledgeBlock, operatorNote }) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are Westpack's Canva artwork localisation engine.",
            "You translate short marketing copy that sits inside a fixed graphic design.",
            "Your role is translator, not copywriter: keep the message, the hierarchy, the order and the commercial intent.",
            "Westpack sells retail packaging to businesses, with jewellery businesses as the core audience, so the register is business-to-business and concrete.",
            "",
            "Length is a hard design constraint, not a preference.",
            "Each field has a maximum character count taken from the space the original text occupies.",
            "The design cannot be re-typeset, so text that runs past its box is a defect.",
            "For every field return:",
            "- `text`: the best faithful translation that fits within the maximum length.",
            "- `compact`: a genuinely shorter alternative that still says the same thing, used when `text` does not fit. Never pad it; if `text` is already short, `compact` may repeat it.",
            "- `note`: empty, unless you had to compromise, in which case say what in one short clause.",
            "Never translate a field by dropping part of its meaning to hit the count. If the meaning cannot survive the limit, return the shortest faithful wording and say so in `note`.",
            "Preserve numbers, measurements, SKU codes, URLs and trademarks exactly.",
            "Match the source capitalisation style: an all-caps headline stays all-caps in the target language.",
            "Do not add punctuation the source does not have.",
            glossaryBlock,
            knowledgeBlock
          ].filter(Boolean).join("\n")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            `Design: ${designTitle || "Untitled Canva design"}`,
            `Source language: ${sourceLanguage}`,
            `Target language: ${targetLanguage} (market ${marketCode})`,
            operatorNote ? `Operator note: ${operatorNote}` : "",
            "",
            "These fields belong to one piece of artwork. Translate them together so they read as one message.",
            "",
            buildFieldBrief(fields)
          ].filter(Boolean).join("\n")
        }
      ]
    }
  ];
}

function buildSchema(fields = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      fields: {
        type: "array",
        minItems: fields.length,
        maxItems: fields.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            text: { type: "string" },
            compact: { type: "string" },
            note: { type: "string" }
          },
          required: ["key", "text", "compact", "note"]
        }
      }
    },
    required: ["fields"]
  };
}

function extractJsonText(payload) {
  const parts = [];
  for (const item of payload?.output || []) {
    for (const chunk of item?.content || []) {
      if (typeof chunk?.text === "string") parts.push(chunk.text);
    }
  }
  if (!parts.length && typeof payload?.output_text === "string") parts.push(payload.output_text);
  return parts.join("\n").trim();
}

async function requestTranslation({ config, prompt, schema }) {
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
          name: "westpack_canva_field_translation",
          schema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI translation request failed.");
  return { parsed: JSON.parse(extractJsonText(payload)), model: payload.model || config.openAiModel };
}

// Picks the wording that actually fits. The primary translation wins whenever it is inside
// budget; the compact alternative is only used when it is both shorter and non-empty, because a
// model that returns an empty `compact` must not be allowed to blank a headline.
function chooseVariant({ field, candidate }) {
  const primary = normalizeText(candidate?.text);
  const compact = normalizeText(candidate?.compact);
  const primaryFit = assessFieldFit({ sourceText: field.sourceText, translatedText: primary, budget: field.budget });
  if (primaryFit.status === "fits" || !compact || compact.length >= primary.length) {
    return { text: primary, usedCompact: false, fit: { ...primaryFit, key: field.key } };
  }

  const compactFit = assessFieldFit({ sourceText: field.sourceText, translatedText: compact, budget: field.budget });
  if (compactFit.status === "fits" || compact.length < primary.length) {
    return { text: compact, usedCompact: true, fit: { ...compactFit, key: field.key } };
  }
  return { text: primary, usedCompact: false, fit: { ...primaryFit, key: field.key } };
}

async function translateFieldsForMarket({
  config,
  fields = [],
  sourceLanguage = "Danish",
  targetLanguage = "",
  marketCode = "",
  designTitle = "",
  operatorNote = "",
  requestFn = requestTranslation
} = {}) {
  const translatable = fields.filter((field) => field.translate !== false && field.type === "text" && field.sourceText);
  if (!translatable.length) {
    return { fields: {}, fieldFits: [], notes: ["No translatable fields were selected."], model: "" };
  }

  const sourceTexts = translatable.map((field) => field.sourceText);
  const glossaryBlock = buildGlossaryPromptBlock({ targetLanguage, sourceTexts });
  const knowledgeBlock = buildWestpackKnowledgePromptBlock({ channel: "klaviyo", sourceTexts });

  const { parsed, model } = await requestFn({
    config,
    prompt: buildPrompt({
      fields: translatable,
      sourceLanguage,
      targetLanguage,
      marketCode,
      designTitle,
      glossaryBlock,
      knowledgeBlock,
      operatorNote
    }),
    schema: buildSchema(translatable)
  });

  const byKey = new Map((parsed?.fields || []).map((entry) => [String(entry?.key || ""), entry]));
  const translated = {};
  const fieldFits = [];
  const notes = [];

  for (const field of translatable) {
    const candidate = byKey.get(field.key);
    if (!candidate) {
      // A missing field is reported rather than silently filled with the source text: autofilling
      // Danish into the German design would look like a success and ship wrong artwork.
      notes.push(`${field.key}: the model returned no translation.`);
      fieldFits.push({ key: field.key, status: "empty", length: 0, budget: field.budget, overflow: 0, ratio: 0 });
      continue;
    }

    const chosen = chooseVariant({ field, candidate });
    if (!chosen.text) {
      notes.push(`${field.key}: the translation came back empty.`);
      fieldFits.push({ key: field.key, status: "empty", length: 0, budget: field.budget, overflow: 0, ratio: 0 });
      continue;
    }

    translated[field.key] = chosen.text;
    fieldFits.push(chosen.fit);
    if (chosen.usedCompact) notes.push(`${field.key}: used the shorter alternative to stay inside the artwork.`);
    if (candidate.note) notes.push(`${field.key}: ${normalizeText(candidate.note)}`);
    if (chosen.fit.status === "over") {
      notes.push(`${field.key}: ${chosen.fit.length} characters against a ${chosen.fit.budget} limit - overflow likely.`);
    }
  }

  return { fields: translated, fieldFits, notes, model };
}

module.exports = {
  buildPrompt,
  buildSchema,
  chooseVariant,
  translateFieldsForMarket
};
