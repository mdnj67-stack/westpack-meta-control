const { getConfig } = require("../_lib/config");
const { readJsonBody, sendJson } = require("../_lib/http");

function buildMessages(input) {
  const sourceSummary = input.mode === "duplicate" && input.sourceAd
    ? `Source ad name: ${input.sourceAd.name}\nSource primary text: ${input.sourceAd.primary}\nSource headline: ${input.sourceAd.headline}\nSource description: ${input.sourceAd.description}`
    : `New ad name: ${input.newAdName || "New ad concept"}\nCreative angle: ${input.newAdAngle || "Premium B2B packaging"}`;

  return [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: [
            "You are a Westpack-specific Meta ad copy engine.",
            "Write in clean B2B language for premium packaging buyers.",
            "Do not mention image editing or visual changes.",
            "Uploaded creative files are used as-is.",
            "Return strict JSON with keys: primaryText, headline, description, rationale, variants.",
            "variants must be an array of exactly 3 objects with keys: title, body, headline, angle."
          ].join(" ")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `Mode: ${input.mode}`,
            sourceSummary,
            `Target campaign: ${input.targetCampaign}`,
            `Target ad set: ${input.targetAdSet}`,
            `Target language: ${input.targetLanguage}`,
            `Ad format: ${input.adFormat}`,
            `Destination URL: ${input.destinationUrl}`,
            `Adaptation goal: ${input.adaptationGoal || "Create original ad copy"}`,
            `Operator note: ${input.operatorNote || "None"}`,
            `Creative files: ${(input.creativeAssets || []).join(", ") || "None uploaded"}`
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

function normalizeResult(input, parsed, model) {
  return {
    preview: {
      source: input.mode === "duplicate" && input.sourceAd ? input.sourceAd.name : (input.newAdName || "New ad concept"),
      sourceId: input.mode === "duplicate" && input.sourceAd ? input.sourceAd.id : "",
      targetCampaign: input.targetCampaign,
      targetAdSet: input.targetAdSet,
      targetLanguage: input.targetLanguage,
      adFormat: input.adFormat,
      destinationUrl: input.destinationUrl,
      creativeAssets: input.creativeAssets || [],
      primaryText: parsed.primaryText,
      headline: parsed.headline,
      description: parsed.description,
      rationale: parsed.rationale
    },
    variants: Array.isArray(parsed.variants) ? parsed.variants.slice(0, 3) : [],
    model,
    generatedAt: new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  if (!config.openAiApiKey) {
    sendJson(res, 500, { error: "Missing OpenAI API key." });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify({
        model: config.openAiModel,
        input: buildMessages(input),
        text: {
          format: {
            type: "json_schema",
            name: "westpack_ad_preview",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                primaryText: { type: "string" },
                headline: { type: "string" },
                description: { type: "string" },
                rationale: { type: "string" },
                variants: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                      headline: { type: "string" },
                      angle: { type: "string" }
                    },
                    required: ["title", "body", "headline", "angle"]
                  }
                }
              },
              required: ["primaryText", "headline", "description", "rationale", "variants"]
            }
          }
        }
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      sendJson(res, response.status, {
        error: payload?.error?.message || "OpenAI request failed."
      });
      return;
    }

    const jsonText = extractJsonText(payload);
    const parsed = JSON.parse(jsonText);
    sendJson(res, 200, normalizeResult(input, parsed, payload.model || config.openAiModel));
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Unknown OpenAI route failure."
    });
  }
};
