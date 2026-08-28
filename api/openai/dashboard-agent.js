const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");

function buildPrompt(input) {
  const lens = input.lens || "awareness";

  const brandContext = [
    "Brand context (Westpack A/S):",
    "Danish company in Holstebro; leading EU supplier of packaging + displays for jewelry, watches, eyewear.",
    "Core products: jewelry boxes, pouches, display trays/stands, jewelry cleaning accessories.",
    "Core USP: logo printing on jewelry boxes even at low MOQ (as low as 48).",
    "Free logo printing applies to jewelry boxes only.",
    "Target customers: jewelry retailers, watch/eyewear shops, independent jewelers and chains (B2B, professional buyers).",
    "Key levers: speed of delivery, low MOQ, brandable packaging, consistent quality, samples.",
    "Sustainability: ECO line, FSC-certified paper, recycled materials; EU manufacturing and QA.",
    "Scale: global shipping, 18,000+ customers, ~200,000 boxes/bags handled daily.",
    "High social proof: 2,000+ five-star reviews."
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a senior Meta Ads performance analyst for Westpack.",
            "Your job: create decisive, action-ready recommendations based on the provided metrics.",
            "Be strict: no fluff, no generic advice, no 'it depends'.",
            "Focus on what a senior specialist can change inside Meta today: budgets, creative rotation, audience structure, campaign objective, and hygiene actions.",
            "Use the executive brief, decision board and pressure groups as the operating context.",
            "Write like an operator, not like an analyst.",
            "Every recommendation should sound like a move: scale, hold, fix, stop, refresh, or test.",
            "Only mention incrementality when the dashboard lens is conversion_incremental.",
            "If you recommend action, make it concrete and directional.",
            "Return strict JSON only."
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
            `Dashboard lens: ${lens}`,
            "",
            brandContext,
            "",
            "Lens guardrails:",
            "Awareness lens: only talk about reach, frequency, CPM, impressions, creative fatigue, and brand-safe scaling.",
            "Leads lens: only talk about leads volume, CPL, form completion, and lead quality signals.",
            "Conversion standard: only talk about ROAS, CPA, purchases, revenue, and efficiency.",
            "Conversion incremental: only talk about incremental set performance, separated from standard campaigns.",
            "",
            "KPI guidelines (generated from current data):",
            JSON.stringify(input.kpiGuidelines || {}, null, 2),
            "",
            "Executive brief:",
            JSON.stringify(input.executiveBrief || {}, null, 2),
            "",
            "Decision board:",
            JSON.stringify(input.decisionBoard || [], null, 2),
            "",
            "Pressure groups:",
            JSON.stringify(input.pressureGroups || [], null, 2),
            "",
            "Signals:",
            JSON.stringify(input.signals || [], null, 2),
            "",
            "Campaign rows (last 7d):",
            JSON.stringify(input.campaigns || [], null, 2),
            "",
            "Account stats:",
            JSON.stringify(input.stats || {}, null, 2)
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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify({
        model: config.openAiModel,
        input: buildPrompt(input),
        text: {
          format: {
            type: "json_schema",
            name: "westpack_dashboard_agent",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                insights: {
                  type: "array",
                  minItems: 3,
                  maxItems: 7,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["title", "body", "priority"]
                  }
                }
              },
              required: ["insights"]
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

    sendJson(res, 200, {
      lens: input.lens || "awareness",
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      model: payload.model || config.openAiModel,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Dashboard agent failed." });
  }
};
