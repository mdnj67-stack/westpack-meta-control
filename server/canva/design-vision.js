// The two things we can only learn by looking at the rendered design.
//
// Canva's REST API tells us which data fields a design has, but not what they currently say, and
// nothing at all about whether text fits its box. Both of those are visible in a PNG export, so
// both are answered by rendering the design and reading the picture. That is an honest
// measurement of the real artwork, not a guess about it - but it is OCR and a vision model, so
// every result is labelled as proposed rather than authoritative, and a human confirms it.
//
// Neither function is on the critical path. Source text can always be typed by hand, and a fit
// check can always be done by opening the design. They exist to remove typing and to make a
// problem obvious before eighteen files go into a campaign.

const { exportDesign } = require("./connect-client");
const { normalizeText } = require("./localization");

// Small enough to be cheap and fast, large enough for a vision model to read a headline. Canva
// rejects exports under 40px on a side, and these are throwaway renders, not deliverables.
const INSPECTION_WIDTH = 1024;

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

async function requestVision({ config, prompt, schemaName, schema }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: prompt,
      text: { format: { type: "json_schema", name: schemaName, schema } }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI vision request failed.");
  return JSON.parse(extractJsonText(payload));
}

async function renderDesign({ accessToken, designId, pages = null }) {
  const urls = await exportDesign(accessToken, {
    designId,
    format: "png",
    width: INSPECTION_WIDTH,
    pages
  });
  return urls;
}

// Proposes what each tagged data field currently says, by reading the rendered design. The field
// names are given to the model because they are the only anchor that exists - a field called
// `headline` and a field called `cta` are distinguishable by role, and the model is asked to
// match on role and prominence rather than to guess.
async function proposeSourceTexts({ config, accessToken, designId, fieldKeys = [], requestFn = requestVision }) {
  const textKeys = fieldKeys.filter(Boolean);
  if (!textKeys.length) return { sourceTexts: {}, imageUrls: [], unmatched: [] };

  const imageUrls = await renderDesign({ accessToken, designId });
  if (!imageUrls.length) throw new Error("Canva returned no rendered page for this design.");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            text: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] }
          },
          required: ["key", "text", "confidence"]
        }
      },
      unmatchedText: { type: "array", items: { type: "string" } }
    },
    required: ["fields", "unmatchedText"]
  };

  const prompt = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You read text out of a rendered marketing graphic and match it to named text slots.",
            "You are transcribing, not translating and not improving: reproduce the wording, spelling and capitalisation exactly as shown, including all-caps.",
            "Each named slot corresponds to one text element in the design. Match by role and visual prominence: a slot called headline is the largest line, a slot called cta is the button or link text.",
            "If you cannot confidently match a slot, return it with an empty string rather than guessing.",
            "Put any text you can read but could not assign to a slot in unmatchedText - it is probably text the designer chose not to tag, such as a brand name or a URL."
          ].join(" ")
        }
      ]
    },
    {
      role: "user",
      content: [
        { type: "input_text", text: `Text slots to fill: ${textKeys.join(", ")}` },
        ...imageUrls.slice(0, 4).map((url) => ({ type: "input_image", image_url: url }))
      ]
    }
  ];

  const parsed = await requestFn({ config, prompt, schemaName: "westpack_canva_source_text", schema });
  const allowed = new Set(textKeys);
  const sourceTexts = {};
  const confidence = {};

  for (const entry of parsed?.fields || []) {
    const key = String(entry?.key || "");
    if (!allowed.has(key)) continue;
    const text = normalizeText(entry?.text);
    if (!text) continue;
    sourceTexts[key] = text;
    confidence[key] = String(entry?.confidence || "low");
  }

  return {
    sourceTexts,
    confidence,
    imageUrls,
    unmatched: (parsed?.unmatchedText || []).map((item) => normalizeText(item)).filter(Boolean)
  };
}

// Looks at a generated design and reports whether the translated text actually fits. This is the
// only overflow signal that exists anywhere in this feature - the character budget is a
// prediction, this is the observation.
async function inspectRenderedFit({ config, accessToken, designId, expectedTexts = {}, requestFn = requestVision }) {
  const imageUrls = await renderDesign({ accessToken, designId });
  if (!imageUrls.length) throw new Error("Canva returned no rendered page for this design.");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["clean", "tight", "broken"] },
      problems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            issue: { type: "string", enum: ["clipped", "overlapping", "outside_box", "wrapped_badly", "illegible"] },
            detail: { type: "string" }
          },
          required: ["text", "issue", "detail"]
        }
      },
      summary: { type: "string" }
    },
    required: ["verdict", "problems", "summary"]
  };

  const expected = Object.values(expectedTexts || {}).filter(Boolean);
  const prompt = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You inspect a rendered marketing graphic for text layout defects after an automated translation was inserted.",
            "Report only what is visible: text cut off at an edge or by a shape, text overlapping other text or a logo, text spilling outside its evident box or coloured panel, a line wrapping in a way that breaks the layout, or text too small to read.",
            "Do not comment on wording, grammar, translation quality, taste or composition. Those are not your job and the design was approved before translation.",
            "verdict `clean` means nothing would stop this being sent. `tight` means it is usable but a human should glance at it. `broken` means it should not be sent as is."
          ].join(" ")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: expected.length
            ? `The following text was inserted and should all be fully visible:\n- ${expected.join("\n- ")}`
            : "Check all visible text."
        },
        ...imageUrls.slice(0, 4).map((url) => ({ type: "input_image", image_url: url }))
      ]
    }
  ];

  const parsed = await requestFn({ config, prompt, schemaName: "westpack_canva_fit_inspection", schema });
  return {
    verdict: ["clean", "tight", "broken"].includes(parsed?.verdict) ? parsed.verdict : "tight",
    problems: Array.isArray(parsed?.problems) ? parsed.problems.slice(0, 12) : [],
    summary: normalizeText(parsed?.summary),
    imageUrls,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  INSPECTION_WIDTH,
  inspectRenderedFit,
  proposeSourceTexts,
  renderDesign,
  requestVision
};
