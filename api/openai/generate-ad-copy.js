const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const { buildGlossaryPromptBlock } = require("../../server/lib/glossary");
const { buildWestpackKnowledgeContext, buildWestpackKnowledgePromptBlock } = require("../../server/lib/westpack-knowledge");
const { getAdDetails, getCreativeDetails, summarizeCreativeForAi } = require("../../server/lib/meta");

function buildSourceTexts(input, sourceCreativeSummary) {
  return [
    input?.sourceAd?.name,
    input?.sourceAd?.primary,
    input?.sourceAd?.headline,
    input?.sourceAd?.description,
    sourceCreativeSummary?.primaryText,
    sourceCreativeSummary?.headline,
    sourceCreativeSummary?.description,
    ...(sourceCreativeSummary?.attachments || []).flatMap((item) => [item?.name, item?.description]),
    input.newAdName,
    input.newAdAngle,
    input.campaignIntent,
    input.videoAnalysis?.summary,
    ...(input.videoAnalysis?.insights || []).map((item) => item?.body),
    input.operatorNote,
    ...(input.creativeAssets || [])
  ];
}

function buildStrategySummary(strategy = null) {
  if (!strategy || typeof strategy !== "object") {
    return "No explicit strategy plan supplied.";
  }

  return [
    `Product category: ${strategy.productCategory || "Unknown"}`,
    `Buyer type: ${strategy.buyerType || "Unknown"}`,
    `Job to be done: ${strategy.jobToBeDone || "Unknown"}`,
    `Dominant angle: ${strategy.dominantAngle || "Unknown"}`,
    `Support points: ${(strategy.supportPoints || []).join(", ") || "None"}`,
    `Allowed USPs: ${(strategy.allowedUsps || []).join(", ") || "None"}`,
    `Blocked claims: ${(strategy.blockedClaims || []).join(", ") || "None"}`,
    `CTA direction: ${strategy.ctaDirection || "Unknown"}`,
    `Variant hypotheses: ${(strategy.variantHypotheses || []).join(" | ") || "None"}`
  ].join("\n");
}

async function requestJsonResponse(config, body, fallbackMessage) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || fallbackMessage);
  }

  return {
    payload,
    parsed: JSON.parse(extractJsonText(payload))
  };
}

async function buildCreativeStrategy(config, input, sourceCreativeSummary) {
  const sourceTexts = buildSourceTexts(input, sourceCreativeSummary);
  const knowledgeContext = buildWestpackKnowledgeContext({
    sourceTexts,
    channel: "meta",
    mode: input.mode,
    adFormat: input.adFormat
  });

  const strategyInputSummary = input.mode === "duplicate" && input.sourceAd
    ? `Source ad: ${input.sourceAd.name}
Source primary text: ${sourceCreativeSummary?.primaryText || input.sourceAd.primary}
Source headline: ${sourceCreativeSummary?.headline || input.sourceAd.headline}
Source description: ${sourceCreativeSummary?.description || input.sourceAd.description}
Target language: ${input.targetLanguage}
Target campaign: ${input.targetCampaign}
Target ad set: ${input.targetAdSet}
Ad format: ${sourceCreativeSummary?.format || input.adFormat}
Destination URL: ${input.destinationUrl}
Adaptation goal: ${input.adaptationGoal || "Translate and keep structure"}`
    : `New ad name: ${input.newAdName || "New ad concept"}
Ad intent: ${input.campaignIntent || "Promote one product family clearly"}
Creative angle: ${input.newAdAngle || "Premium B2B packaging"}
Target language: ${input.targetLanguage}
Target campaign: ${input.targetCampaign}
Target ad set: ${input.targetAdSet}
Ad format: ${input.adFormat}
Destination URL: ${input.destinationUrl}
Operator note: ${input.operatorNote || "None"}
Creative files: ${(input.creativeAssets || []).join(", ") || "None uploaded"}
Video analysis: ${JSON.stringify(input.videoAnalysis || null)}`;

  const { parsed, payload } = await requestJsonResponse(config, {
    model: config.openAiModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are the Westpack Meta ad strategist.",
              "Your job is to decide what this ad is actually trying to do before any copy is written.",
              "Pick one dominant commercial angle that best fits the product, the ad intent, and the Westpack sales reality.",
              "Do not write the final ad copy yet.",
              "Think like a senior B2B Meta strategist for packaging, retail presentation, branding, gifting, ecommerce and display.",
              "Keep strategy practical and specific, not generic branding language.",
              "Use the supplied structured Westpack context and stay inside it.",
              `Structured Westpack context: ${JSON.stringify(knowledgeContext)}`,
              input.mode === "duplicate"
                ? "Duplicate mode: preserve the source ad's business intent. Do not invent a new strategy; simply identify the existing one clearly."
                : "Create mode: choose the single best Westpack angle for this ad and define what the variants should each test.",
              "Return strict JSON."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: strategyInputSummary
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "westpack_ad_strategy",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            productCategory: { type: "string" },
            buyerType: { type: "string" },
            jobToBeDone: { type: "string" },
            dominantAngle: { type: "string" },
            supportPoints: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" }
            },
            allowedUsps: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: { type: "string" }
            },
            blockedClaims: {
              type: "array",
              minItems: 2,
              maxItems: 6,
              items: { type: "string" }
            },
            ctaDirection: { type: "string" },
            variantHypotheses: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" }
            }
          },
          required: [
            "productCategory",
            "buyerType",
            "jobToBeDone",
            "dominantAngle",
            "supportPoints",
            "allowedUsps",
            "blockedClaims",
            "ctaDirection",
            "variantHypotheses"
          ]
        }
      }
    }
  }, "OpenAI strategy request failed.");

  return {
    strategy: parsed,
    model: payload.model || config.openAiModel,
    knowledgeContext
  };
}

function buildMessages(input, sourceCreativeSummary, strategyBundle = null) {
  const sourceSummary = input.mode === "duplicate" && input.sourceAd
    ? `Source ad name: ${input.sourceAd.name}
Source primary text: ${sourceCreativeSummary?.primaryText || input.sourceAd.primary}
Source headline: ${sourceCreativeSummary?.headline || input.sourceAd.headline}
Source description: ${sourceCreativeSummary?.description || input.sourceAd.description}
Source format: ${sourceCreativeSummary?.format || input.adFormat}
Source destination URL: ${sourceCreativeSummary?.destinationUrl || input.destinationUrl}
Source carousel cards: ${JSON.stringify(sourceCreativeSummary?.attachments || [])}`
    : `New ad name: ${input.newAdName || "New ad concept"}
Ad intent: ${input.campaignIntent || "Promote one product family clearly"}
Creative angle: ${input.newAdAngle || "Premium B2B packaging"}
Ad format: ${input.adFormat}
Video variants (if any): ${JSON.stringify(input.videoVariants || [])}
Video analysis (if any): ${JSON.stringify(input.videoAnalysis || null)}
Creative files: ${(input.creativeAssets || []).join(", ") || "None uploaded"}`;

  const sourceTexts = buildSourceTexts(input, sourceCreativeSummary);
  const strategy = strategyBundle?.strategy || null;
  const knowledgeContext = strategyBundle?.knowledgeContext || buildWestpackKnowledgeContext({
    sourceTexts,
    channel: "meta",
    mode: input.mode,
    adFormat: input.adFormat
  });

  const createCarouselHint =
    input.mode === "create" && input.adFormat === "Carousel"
      ? `Create mode carousel: You must return translatedAttachments with the same length as the number of creative files (or at least 3 items if files are unknown). Use short, punchy card names and descriptions.`
      : "";

  const glossaryBlock = buildGlossaryPromptBlock({
    targetLanguage: input.targetLanguage,
    sourceTexts
  });
  const westpackKnowledgeBlock = buildWestpackKnowledgePromptBlock({
    channel: "meta",
    mode: input.mode,
    adFormat: input.adFormat,
    sourceTexts
  });
  const strategySummary = buildStrategySummary(strategy);

  const duplicateTranslationRules = input.mode === "duplicate"
    ? [
      "Duplicate mode is strict translation mode.",
      "Translate faithfully from the source ad into the target language.",
      "Do not change the strategy, offer, CTA intent, structure or message hierarchy.",
      "Do not introduce new angles, claims or variations by market.",
      "If a glossary term matches, you must use the glossary translation.",
      "Variants must stay very close to the same message and only differ by minor phrasing, not by strategy."
    ].join(" ")
    : "Create mode may write original copy, but it must still respect glossary terms whenever they match.";

  const createModeRules = input.mode === "create"
    ? [
      "Create mode is performance-first creation mode.",
      "Act like a senior Meta ads specialist building a new ad from scratch for Westpack.",
      `The operator-selected ad intent is: ${input.campaignIntent || "Promote one product family clearly"}.`,
      "Choose one dominant product angle and make it immediately obvious in the opening line.",
      "Do not write vague generic brand copy. Make the value concrete and product-relevant.",
      "Primary text must be brief enough to avoid early truncation on mobile and should usually stay within 1-3 short lines.",
      "Primary text must fit within 125 characters whenever reasonably possible.",
      "Front-load the core value proposition, offer, or strongest USP within the first 125 characters whenever possible.",
      "Use short, punchy, mobile-first wording. Prefer short sentences and benefit-led phrasing over long explanations.",
      "Headline must be short, specific, single-minded, and commercially useful.",
      "Headline should usually fit within roughly 32 characters.",
      "Description should support the offer quietly and stay compact.",
      "If the product context suggests jewellery boxes, gift bags, displays, ribbon, wrapping, or ecommerce packaging, lean into the strongest matching Westpack USP.",
      "Do not use environmental language unless the operator explicitly asked for it.",
      "If the product is not jewellery-box context, do not claim free logo print.",
      "Use emojis only when they genuinely improve scannability and fit Westpack's premium commercial tone. Do not overdo them."
    ].join(" ")
    : "";

  const outputCraftRules = [
    "Primary text should usually open with a hook, then a proof/value layer, then a clean commercial landing.",
    "Focus on benefits over features unless a feature is the real buying trigger.",
    "Headlines should avoid fluff and usually stay within a compact Meta-friendly length.",
    "Descriptions should not carry the main selling message if the primary text and headline already do that job.",
    "Use one clear CTA direction and avoid splitting attention across multiple next steps.",
    "Rationale must explain which Westpack USP and Meta best-practice choices were used."
  ].join(" ");

  const westpackBusinessContext = [
    "Westpack is a premium B2B packaging supplier for jewellery, gift and retail presentation.",
    "Core strengths you may use when they genuinely fit the ad: premium presentation, custom logo branding, low MOQ branding on relevant products, reliable stock depth, fast delivery, broad packaging range, retail-ready seasonal concepts, and helping stores lift perceived value.",
    "Do not force every USP into every ad. Pick only the few that match the product, format, and operator note.",
    "Never invent operational claims, lead times, MOQ numbers, certifications, guarantees, or environmental claims unless they are already present in the source input or operator note."
  ].join(" ");

  const metaBestPracticeRules = [
    "You are not a generic copywriter. You are a senior Meta ads specialist.",
    "Always apply Meta best practice: strong first line, one clear commercial angle, low-friction wording, concrete buyer value, and a clean CTA direction.",
    "For primary text, front-load the hook and keep sentence rhythm easy to scan on mobile.",
    "For headlines, keep them compact, specific, and outcome-led.",
    "Description should support the ad quietly, not repeat the headline word-for-word.",
    "Avoid vague hype, filler, and long abstract branding lines.",
    "Write for B2B retail buyers, store owners, and packaging decision-makers rather than consumers.",
    "When relevant, highlight how better packaging helps perceived value, gifting, display quality, repeat purchases, or smoother seasonal selling.",
    "If the format is Carousel, make each card feel like a focused selling step instead of repeating the same line."
  ].join(" ");

  const strategyExecutionRules = [
    "You must execute the supplied ad strategy rather than improvising a new one.",
    `Structured Westpack context: ${JSON.stringify(knowledgeContext)}`,
    `Approved strategy plan:\n${strategySummary}`,
    "Use the dominant angle as the controlling idea for the ad.",
    "Use only the allowed USPs unless the source ad in duplicate mode already includes something stronger and still truthful.",
    "Respect the blocked-claims list even if the creative angle sounds tempting.",
    "Each variant must map to one of the variant hypotheses and should test a meaningful change in hook or emphasis."
  ].join(" ");

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [
            "You are a Westpack-specific Meta ad copy engine.",
            "Write in clean B2B language for premium packaging buyers.",
            "Do not mention image editing or visual changes.",
            "Uploaded creative files are used as-is.",
            westpackBusinessContext,
            metaBestPracticeRules,
            westpackKnowledgeBlock,
            strategyExecutionRules,
            "Set adFormat to the actual source creative type when duplicating, for example Carousel, Video, or Single image.",
            "When the source creative is a carousel, translate every carousel card name and description into the target language.",
            "When creating a new carousel ad, generate carousel card copy too (translatedAttachments).",
            createCarouselHint,
            input.videoAnalysis
              ? `Video analysis is available. Use it as a factual guide for hook timing, product focus, pacing, branding visibility, CTA moment, and what is visually emphasized on screen. Summary: ${JSON.stringify(input.videoAnalysis)}`
              : "",
            duplicateTranslationRules,
            createModeRules,
            glossaryBlock,
            "If the source copy is weak, you may tighten phrasing, but stay faithful to the same offer and business intent.",
            "Use Westpack-relevant USP language naturally wherever it strengthens performance and remains truthful.",
            "For carousel cards, keep card headlines short enough to scan quickly in-feed.",
            outputCraftRules,
            "Return strict JSON with keys: primaryText, headline, description, rationale, translatedAttachments, variants.",
            "translatedAttachments must preserve card order and contain one item per source carousel card.",
            "variants must be an array of 3 to 5 objects with keys: title, body, headline, angle.",
            "Keep every variant body compact and mobile-first. Do not return long-form paragraphs.",
            "In create mode, variants should explore small performance-minded shifts in hook, wording, or emphasis, not completely different product stories.",
            "Use the variants for real testing hypotheses such as sharper hook, lower-friction CTA, stronger branding angle, or clearer value framing."
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
            `Mode: ${input.mode}`,
            sourceSummary,
            `Target campaign: ${input.targetCampaign}`,
            `Target ad set: ${input.targetAdSet}`,
            `Target language: ${input.targetLanguage}`,
            `Ad format: ${input.adFormat}`,
            `Destination URL: ${input.destinationUrl}`,
            `Video variants: ${JSON.stringify(input.videoVariants || [])}`,
            `Video analysis: ${JSON.stringify(input.videoAnalysis || null)}`,
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

async function analyzeVideoFrames(config, input) {
  const frames = Array.isArray(input.frames) ? input.frames.filter((frame) => frame?.imageUrl) : [];
  if (!frames.length) {
    throw new Error("No video frames provided for analysis.");
  }

  const westpackKnowledgeBlock = buildWestpackKnowledgePromptBlock({
    channel: "meta",
    sourceTexts: [
      input?.newAdName,
      input?.newAdAngle,
      input?.operatorNote,
      ...(input?.creativeAssets || [])
    ]
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are a Westpack-specific Meta video creative analyst.",
                "Analyze the supplied video frames carefully and describe only what is visually supported.",
                "Focus on hook strength, visible product focus, branding visibility, pacing cues, scene variety, on-screen text, CTA moment, and the most commercially useful ad angle.",
                "Do not invent scenes or claims not supported by the frames.",
                "Make the output directly useful for ad copy generation.",
                westpackKnowledgeBlock,
                "Return strict JSON with keys summary and insights. Insights must be an array of 4 to 6 objects with keys title and body."
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
                `Ad name: ${input?.newAdName || "New ad concept"}`,
                `Creative angle: ${input?.newAdAngle || "Premium B2B packaging"}`,
                `Operator note: ${input?.operatorNote || "None"}`,
                `Video variants: ${JSON.stringify(input?.videoVariants || [])}`
              ].join("\n")
            },
            ...frames.map((frame) => ({
              type: "input_image",
              image_url: frame.imageUrl,
              detail: "high"
            }))
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "westpack_video_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              insights: {
                type: "array",
                minItems: 4,
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" }
                  },
                  required: ["title", "body"]
                }
              }
            },
            required: ["summary", "insights"]
          }
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Video analysis request failed.");
  }

  const parsed = JSON.parse(extractJsonText(payload));
  return {
    summary: parsed.summary || "",
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    model: payload.model || config.openAiModel
  };
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function clampText(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength + 1);
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf(", "),
    clipped.lastIndexOf(" ")
  );
  const safeCut = boundary >= Math.floor(maxLength * 0.6) ? boundary : maxLength;
  return clipped.slice(0, safeCut).trim().replace(/[,.!?;:]+$/g, "");
}

function trimDanglingEnding(value) {
  let resolved = normalizeWhitespace(value);
  if (!resolved) {
    return "";
  }

  const trailingStopwords = [
    "and",
    "or",
    "with",
    "for",
    "to",
    "of",
    "in",
    "on",
    "at",
    "fra",
    "for at",
    "med",
    "til",
    "på",
    "och",
    "med",
    "för"
  ];

  let updated = true;
  while (updated && resolved) {
    updated = false;
    for (const suffix of trailingStopwords) {
      const pattern = new RegExp(`(?:\\s|^)${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      if (pattern.test(resolved)) {
        resolved = resolved.replace(pattern, "").trim();
        updated = true;
      }
    }
  }

  return resolved.replace(/[,:;!?-]+$/g, "").trim();
}

function sanitizeCompactCopy(value, { maxLength, fallback = "" }) {
  const normalized = trimDanglingEnding(clampText(value, maxLength));
  return normalized || fallback;
}

function sanitizeAttachment(attachment, index) {
  return {
    name: sanitizeCompactCopy(attachment?.name, {
      maxLength: 32,
      fallback: `Card ${index + 1}`
    }),
    description: sanitizeCompactCopy(attachment?.description, {
      maxLength: 80,
      fallback: "Premium packaging, made easy."
    })
  };
}

function buildFallbackVariants(preview) {
  const baseHeadline = sanitizeCompactCopy(preview.headline, {
    maxLength: 32,
    fallback: "Premium packaging"
  });
  const baseBody = sanitizeCompactCopy(preview.primaryText, {
    maxLength: 125,
    fallback: "Premium packaging that lifts perceived value."
  });

  return [
    {
      title: "Variant 1 - Direct",
      body: baseBody,
      headline: baseHeadline,
      angle: "Direct, benefit-led version with a clear first-line value proposition."
    },
    {
      title: "Variant 2 - Sharper hook",
      body: sanitizeCompactCopy(`${baseBody} Built for fast mobile scanning.`, {
        maxLength: 125,
        fallback: baseBody
      }),
      headline: sanitizeCompactCopy(`${baseHeadline} Fast`, {
        maxLength: 32,
        fallback: baseHeadline
      }),
      angle: "Tests a tighter opening hook and faster scan rhythm."
    },
    {
      title: "Variant 3 - Commercial value",
      body: sanitizeCompactCopy(`${baseBody} Make perceived value clearer from the first line.`, {
        maxLength: 125,
        fallback: baseBody
      }),
      headline: sanitizeCompactCopy(`${baseHeadline} Value`, {
        maxLength: 32,
        fallback: baseHeadline
      }),
      angle: "Leans harder into commercial value and premium presentation."
    }
  ];
}

function buildAdPreviewSchema(input) {
  const isCreateMode = input?.mode === "create";
  const bodyMax = isCreateMode ? 125 : 170;
  const headlineMax = isCreateMode ? 32 : 48;
  const descriptionMax = isCreateMode ? 72 : 110;
  const attachmentNameMax = isCreateMode ? 32 : 40;
  const attachmentDescriptionMax = isCreateMode ? 80 : 100;

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      primaryText: { type: "string", maxLength: bodyMax },
      headline: { type: "string", maxLength: headlineMax },
      description: { type: "string", maxLength: descriptionMax },
      rationale: { type: "string" },
      adFormat: { type: "string" },
      translatedAttachments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", maxLength: attachmentNameMax },
            description: { type: "string", maxLength: attachmentDescriptionMax }
          },
          required: ["name", "description"]
        }
      },
      variants: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 48 },
            body: { type: "string", maxLength: bodyMax },
            headline: { type: "string", maxLength: headlineMax },
            angle: { type: "string" }
          },
          required: ["title", "body", "headline", "angle"]
        }
      }
    },
    required: ["primaryText", "headline", "description", "rationale", "adFormat", "translatedAttachments", "variants"]
  };
}

function normalizeResult(input, parsed, model, sourceCreativeSummary, strategyBundle = null) {
  const resolvedFormat =
    input.mode === "duplicate"
      ? sourceCreativeSummary?.format || parsed.adFormat || input.adFormat
      : parsed.adFormat || input.adFormat;

  const isCreateMode = input.mode === "create";
  const primaryText = sanitizeCompactCopy(parsed.primaryText, {
    maxLength: isCreateMode ? 125 : 150,
    fallback: "Premium packaging that helps your brand stand out."
  });
  const headline = sanitizeCompactCopy(parsed.headline, {
    maxLength: isCreateMode ? 32 : 40,
    fallback: "Premium packaging"
  });
  const description = sanitizeCompactCopy(parsed.description, {
    maxLength: isCreateMode ? 72 : 90,
    fallback: "Built for premium retail presentation."
  });
  const rationale = normalizeWhitespace(parsed.rationale);
  const translatedAttachments = Array.isArray(parsed.translatedAttachments)
    ? parsed.translatedAttachments.slice(0, 6).map(sanitizeAttachment)
    : [];
  const strategy = strategyBundle?.strategy || null;
  const variants = Array.isArray(parsed.variants)
    ? parsed.variants
        .map((variant, index) => ({
          title: sanitizeCompactCopy(variant?.title, {
            maxLength: 36,
            fallback: `Variant ${index + 1}`
          }),
          body: sanitizeCompactCopy(variant?.body, {
            maxLength: isCreateMode ? 125 : 150,
            fallback: primaryText
          }),
          headline: sanitizeCompactCopy(variant?.headline, {
            maxLength: isCreateMode ? 32 : 40,
            fallback: headline
          }),
          angle: normalizeWhitespace(variant?.angle || "")
        }))
        .filter((variant, index, array) => {
          const duplicate = array.findIndex((candidate) =>
            candidate.body === variant.body && candidate.headline === variant.headline
          );
          return duplicate === index;
        })
        .slice(0, 5)
    : [];

  const resolvedPreview = {
    source: input.mode === "duplicate" && input.sourceAd ? input.sourceAd.name : (input.newAdName || "New ad concept"),
    sourceId: input.mode === "duplicate" && input.sourceAd ? input.sourceAd.id : "",
    targetCampaign: input.targetCampaign,
    targetCampaignId: input.targetCampaignId || "",
    targetAdSet: input.targetAdSet,
    targetAdSetId: input.targetAdSetId || "",
    targetLanguage: input.targetLanguage,
    adFormat: resolvedFormat,
    campaignIntent: input.campaignIntent || "",
    destinationUrl: input.destinationUrl,
    creativeAssets: input.creativeAssets || [],
    videoVariants: Array.isArray(input.videoVariants) ? input.videoVariants : [],
    primaryText,
    headline,
    description,
    rationale: strategy?.dominantAngle
      ? `${rationale} Strategy: ${strategy.dominantAngle}.`
      : rationale,
    strategy,
    translatedAttachments
  };

  return {
    preview: resolvedPreview,
    variants: variants.length >= 3 ? variants : buildFallbackVariants(resolvedPreview),
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
  if (!requireAuth(req, res, config)) {
    return;
  }
  if (!config.openAiApiKey) {
    sendJson(res, 500, { error: "Missing OpenAI API key." });
    return;
  }

  try {
    const input = await readJsonBody(req);
    if (input.action === "analyze_video") {
      const analysis = await analyzeVideoFrames(config, input);
      sendJson(res, 200, analysis);
      return;
    }
    let sourceCreativeSummary = null;

    if (input.mode === "duplicate" && input?.sourceAd?.id && config.metaAccessToken) {
      const sourceAd = await getAdDetails(input.sourceAd.id, config.metaAccessToken);
      const sourceCreativeId = sourceAd?.creative?.id;

      if (sourceCreativeId) {
        const sourceCreative = await getCreativeDetails(sourceCreativeId, config.metaAccessToken);
        sourceCreativeSummary = summarizeCreativeForAi(sourceCreative);
      }
    }
    const strategyBundle = await buildCreativeStrategy(config, input, sourceCreativeSummary);
    const { parsed, payload } = await requestJsonResponse(config, {
      model: config.openAiModel,
      input: buildMessages(input, sourceCreativeSummary, strategyBundle),
      text: {
        format: {
          type: "json_schema",
          name: "westpack_ad_preview",
          schema: buildAdPreviewSchema(input)
        }
      }
    }, "OpenAI request failed.");

    sendJson(res, 200, normalizeResult(input, parsed, payload.model || config.openAiModel, sourceCreativeSummary, strategyBundle));
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Unknown OpenAI route failure."
    });
  }
};
