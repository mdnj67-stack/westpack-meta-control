const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const { buildGlossaryPromptBlock } = require("../../server/lib/glossary");

const KLAVIYO_SMALL_LIST_EXEMPT_MARKETS = ["CZ", "SK", "HU"];

function buildPrompt(input) {
  const glossaryBlock = buildGlossaryPromptBlock({
    targetLanguage: input?.targetLanguage || input?.language || "",
    sourceTexts: [
      input?.sourceTemplateName,
      input?.sourceSubject,
      input?.sourcePreviewText,
      input?.sourceBody,
      input?.operatorNote
    ]
  });

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a senior Klaviyo performance operator for Westpack.",
            "Your job is to turn campaign, automation and subscriber data into an executive briefing plus clear next actions.",
            "Be practical and direct. No fluff. No generic marketing filler.",
            "Focus on what an email operator should do next: subject line tests, segmentation checks, send timing, list hygiene, replication of winning patterns, missing-market follow-up, flow health checks, and subscriber concentration risks.",
            "Write like a professional email performance lead, not a generic AI assistant.",
            "The summary should explain what matters now, why, and what to do next.",
            "Also return local diagnoses for campaign families, flows and markets when possible.",
            "Behave like a data analyst, not a copywriter. Every insight should be evidence-led, comparative and decision-useful.",
            "Use the benchmark fields, deltas, list sizes and coverage rules actively. Call out what is unusual versus average, not just what is low or high in isolation.",
            "Prefer concrete numeric evidence in plain language, and make the action recommendation specific.",
            "Also return a compact decision board with four sharp calls: Biggest win, Biggest leak, Replicate next, Protect now.",
            `Coverage rule: ${KLAVIYO_SMALL_LIST_EXEMPT_MARKETS.join(", ")} do not normally receive campaigns because their lists are intentionally too small. Never treat those markets as missing campaign coverage or rollout problems unless the input explicitly says otherwise.`,
            glossaryBlock,
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
            "Klaviyo overview data:",
            JSON.stringify(input || {}, null, 2),
            "",
            "Return one executive brief, 4-6 insights, a 4-item decision board, and local diagnoses for campaigns, flows and markets.",
            "Prioritize large subscriber markets, missing coverage, weak open rates on big lists, unsubscribe pressure, flow health issues, and what should be replicated from winning markets.",
            "Each insight must explain why it matters, show evidence, and recommend a concrete next move.",
            "Each diagnosis should use benchmark comparison where possible.",
            `Treat ${KLAVIYO_SMALL_LIST_EXEMPT_MARKETS.join(", ")} as expected coverage exclusions caused by intentionally small lists.`,
            "Do not repeat the same point twice."
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
            name: "westpack_klaviyo_agent",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                brief: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    headline: { type: "string" },
                    summary: { type: "string" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    bullets: {
                      type: "array",
                      minItems: 2,
                      maxItems: 4,
                      items: { type: "string" }
                    }
                  },
                  required: ["headline", "summary", "confidence", "bullets"]
                },
                insights: {
                  type: "array",
                  minItems: 4,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                      whyItMatters: { type: "string" },
                      evidence: { type: "string" },
                      recommendedAction: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["title", "body", "whyItMatters", "evidence", "recommendedAction", "confidence", "priority"]
                  }
                },
                decisionBoard: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string", enum: ["Biggest win", "Biggest leak", "Replicate next", "Protect now"] },
                      headline: { type: "string" },
                      evidence: { type: "string" },
                      action: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      tone: { type: "string", enum: ["success", "warning", "danger", "neutral"] }
                    },
                    required: ["label", "headline", "evidence", "action", "confidence", "tone"]
                  }
                },
                campaignDiagnoses: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      campaignName: { type: "string" },
                      likelyCause: { type: "string" },
                      recommendedAction: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      evidence: { type: "string" },
                      explanation: { type: "string" }
                    },
                    required: ["campaignName", "likelyCause", "recommendedAction", "confidence", "evidence", "explanation"]
                  }
                },
                flowDiagnoses: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      flowName: { type: "string" },
                      likelyCause: { type: "string" },
                      recommendedAction: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      evidence: { type: "string" },
                      explanation: { type: "string" }
                    },
                    required: ["flowName", "likelyCause", "recommendedAction", "confidence", "evidence", "explanation"]
                  }
                },
                marketDiagnoses: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      country: { type: "string" },
                      likelyCause: { type: "string" },
                      recommendedAction: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      evidence: { type: "string" },
                      explanation: { type: "string" }
                    },
                    required: ["country", "likelyCause", "recommendedAction", "confidence", "evidence", "explanation"]
                  }
                }
              },
              required: ["brief", "insights", "decisionBoard", "campaignDiagnoses", "flowDiagnoses", "marketDiagnoses"]
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

    const parsed = JSON.parse(extractJsonText(payload));
    sendJson(res, 200, {
      brief: parsed?.brief || null,
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      decisionBoard: Array.isArray(parsed.decisionBoard) ? parsed.decisionBoard : [],
      campaignDiagnoses: Array.isArray(parsed.campaignDiagnoses) ? parsed.campaignDiagnoses : [],
      flowDiagnoses: Array.isArray(parsed.flowDiagnoses) ? parsed.flowDiagnoses : [],
      marketDiagnoses: Array.isArray(parsed.marketDiagnoses) ? parsed.marketDiagnoses : [],
      model: payload.model || config.openAiModel,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Klaviyo agent failed." });
  }
};
