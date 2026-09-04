const { buildGlossaryPromptBlock } = require("../lib/glossary");
const { buildWestpackKnowledgeContext } = require("../lib/westpack-knowledge");
const {
  buildCampaignMemoryPromptBlock,
  selectCampaignMemoryReferences
} = require("./memory");
const { extractMasterDesignDna, normalizeDesignTranslation } = require("./master-design-dna");

function extractMasterVisualUrls(html = "") {
  return [...String(html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["'](https:\/\/[^"']+)["']/gi)]
    .map((match) => match[1].replace(/&amp;/gi, "&"))
    .filter((url) => !/(?:logo|icon|social|facebook|instagram|linkedin|pinterest|youtube|tracking|pixel)/i.test(url))
    .filter((url, index, values) => values.indexOf(url) === index)
    .slice(0, 8);
}

function buildMetaFromMasterSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      masterAudit: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceType: { type: "string" },
          coreMessage: { type: "string" },
          offer: { type: "string" },
          audience: { type: "string" },
          primaryCta: { type: "string" },
          reusableProofPoints: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
          unsupportedClaims: { type: "array", maxItems: 6, items: { type: "string" } }
        },
        required: ["sourceType", "coreMessage", "offer", "audience", "primaryCta", "reusableProofPoints", "unsupportedClaims"]
      },
      designTranslation: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceDesignSummary: { type: "string" },
          palette: {
            type: "object",
            additionalProperties: false,
            properties: {
              background: { type: "string" },
              panel: { type: "string" },
              foreground: { type: "string" },
              accent: { type: "string" },
              muted: { type: "string" }
            },
            required: ["background", "panel", "foreground", "accent", "muted"]
          },
          typography: {
            type: "object",
            additionalProperties: false,
            properties: {
              headlineStyle: { type: "string", enum: ["serif", "sans"] },
              headlineWeight: { type: "string", enum: ["regular", "medium", "bold"] },
              labelCase: { type: "string", enum: ["uppercase", "title"] },
              alignment: { type: "string", enum: ["left", "center"] }
            },
            required: ["headlineStyle", "headlineWeight", "labelCase", "alignment"]
          },
          composition: {
            type: "object",
            additionalProperties: false,
            properties: {
              heroStrategy: { type: "string", enum: ["image_first", "copy_first", "typographic"] },
              density: { type: "string", enum: ["minimal", "editorial", "commercial"] },
              frameStyle: { type: "string", enum: ["none", "hairline", "rounded"] },
              imageTreatment: { type: "string", enum: ["full_bleed", "framed", "split"] }
            },
            required: ["heroStrategy", "density", "frameStyle", "imageTreatment"]
          },
          preserve: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
          adapt: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
          brandTreatment: { type: "string", enum: ["wordmark", "signature_line"] }
        },
        required: ["sourceDesignSummary", "palette", "typography", "composition", "preserve", "adapt", "brandTreatment"]
      },
      creativeRoutes: {
        type: "object",
        additionalProperties: false,
        properties: {
          recommendedRouteId: { type: "string", enum: ["faithful", "editorial", "performance"] },
          routes: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", enum: ["faithful", "editorial", "performance"] },
                title: { type: "string" },
                idea: { type: "string" },
                hook: { type: "string" },
                designShifts: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
                strategicStrength: { type: "string" },
                risk: { type: "string" }
              },
              required: ["id", "title", "idea", "hook", "designShifts", "strategicStrength", "risk"]
            }
          }
        },
        required: ["recommendedRouteId", "routes"]
      },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          campaignAngle: { type: "string" },
          primaryText: { type: "string" },
          headline: { type: "string" },
          description: { type: "string" },
          cta: { type: "string" },
          destinationUrl: { type: "string" },
          rationale: { type: "string" },
          variants: {
            type: "array",
            minItems: 3,
            maxItems: 4,
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
        required: ["campaignAngle", "primaryText", "headline", "description", "cta", "destinationUrl", "rationale", "variants"]
      },
      carousel: {
        type: "object",
        additionalProperties: false,
        properties: {
          concept: { type: "string" },
          visualSystem: { type: "string" },
          consistencyRules: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } },
          cards: {
            type: "array",
            minItems: 3,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                index: { type: "integer" },
                role: { type: "string", enum: ["hook", "problem", "proof", "benefit", "cta"] },
                title: { type: "string" },
                description: { type: "string" },
                imageIndex: { type: "integer" },
                layout: { type: "string", enum: ["image_led", "editorial_split", "detail_frame", "quiet_statement", "cta_panel"] },
                focalPoint: { type: "string", enum: ["center", "left", "right", "top", "bottom"] },
                tone: { type: "string", enum: ["ivory", "sand", "rose", "charcoal", "sage"] },
                cropDirective: { type: "string" },
                visualTreatment: { type: "string" },
                rationale: { type: "string" }
              },
              required: ["index", "role", "title", "description", "imageIndex", "layout", "focalPoint", "tone", "cropDirective", "visualTreatment", "rationale"]
            }
          }
        },
        required: ["concept", "visualSystem", "consistencyRules", "cards"]
      },
      productionNotes: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
    },
    required: ["masterAudit", "designTranslation", "creativeRoutes", "meta", "carousel", "productionNotes"]
  };
}

function buildMetaFromMasterPrompt(input, imageUrls = [], metaIntelligenceBlock = "", options = {}) {
  const sourceTexts = [
    input.title,
    input.objective,
    input.audience,
    input.offer,
    input.operatorNote,
    input.source?.title,
    input.source?.subject,
    input.source?.previewText,
    input.source?.body,
    input.source?.html,
    ...(input.constraints || [])
  ].filter(Boolean);
  const memoryReferences = selectCampaignMemoryReferences(input);
  const memoryBlock = buildCampaignMemoryPromptBlock(memoryReferences);
  const knowledgeContext = buildWestpackKnowledgeContext({ sourceTexts, channel: "meta", mode: "create" });
  const glossaryBlock = buildGlossaryPromptBlock({
    targetLanguage: "en_GB",
    sourceTexts
  });
  const imageManifest = imageUrls.map((url, index) => ({ index: index + 1, url }));
  const sourceDesignAudit = extractMasterDesignDna(input.source);
  const masterVisualImages = Array.isArray(options.masterVisualImages) ? options.masterVisualImages.slice(0, 4) : [];

  return {
    prompt: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: [
            "You are Westpack's senior paid-social creative director.",
            "Transform one approved email or HTML article into a production-ready Meta carousel, using only the supplied source content and product images.",
            "The master source is the factual and strategic authority. Never invent prices, percentages, guarantees, sustainability claims, delivery promises or product properties.",
            "Build the shortest complete mobile-first narrative using 3-6 cards. Three cards can be hook, proof and CTA; add problem, benefit or detail cards only when the source gives them a distinct job.",
            "Write every customer-facing field in natural UK English, regardless of the source language or requested market. Use British spelling such as jewellery, colour, personalised and centre. Never leave Danish copy in the ad.",
            "Choose an image for every card by imageIndex. Every imageIndex must refer to the supplied image manifest.",
            "Choose layout, focalPoint and tone for a deterministic 1080x1080 renderer. Use image_led for the hook, editorial_split or detail_frame for explanation/proof, quiet_statement for a benefit, and cta_panel for the final CTA.",
            "Treat cropDirective and visualTreatment as concise art-direction notes. Do not ask image generation to render text or logos.",
            "Keep products, colors, materials, logos and proportions faithful to the supplied photography.",
            "Translate the master campaign's visual DNA into a native Meta design system. Preserve its palette hierarchy, typographic character, spacing rhythm, image dominance and editorial/commercial tone without recreating an email screenshot.",
            "Never carry over the universal email header, navigation, footer, legal copy or unsubscribe content. Those are channel chrome, not campaign identity.",
            "The supplied source design audit is deterministic evidence. Stay close to its colours and structural findings; only adjust a colour when needed for legibility and explicitly describe the adaptation.",
            "Visually inspect the supplied master campaign images as evidence of its crop language, product scale, lighting, negative space and image rhythm. Do not treat universal logos or channel chrome as campaign art direction.",
            "All cards must feel like one authored campaign family, while their compositions should progress with the narrative instead of repeating one template. Never pad the carousel to reach a preferred count.",
            "Develop exactly three materially distinct creative routes: faithful, editorial and performance. Faithful stays closest to the approved master; editorial increases premium restraint and magazine-like pacing; performance sharpens the hook and selling hierarchy without becoming loud or generic.",
            "Choose one recommended route and execute that route in designTranslation, meta and carousel. The other two routes are strategic alternatives, not filler variants.",
            metaIntelligenceBlock || "Meta Historical Intelligence: no performance learning snapshot is available yet.",
            "Use historical patterns as directional associations only; never copy an old ad or treat correlation as proof.",
            `Structured Westpack context: ${JSON.stringify(knowledgeContext)}`,
            memoryBlock,
            glossaryBlock,
            "Return strict JSON only."
          ].join(" ")
        }]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Normalized master campaign:",
              JSON.stringify(input, null, 2),
              "",
              "Available Asana images:",
              JSON.stringify(imageManifest, null, 2),
              "",
              "Deterministic design audit of the approved master:",
              JSON.stringify(sourceDesignAudit, null, 2),
              "",
              `Visually inspect ${masterVisualImages.length} reachable image${masterVisualImages.length === 1 ? "" : "s"} extracted from the approved master before choosing a route.`,
              "",
              "Create one coherent Meta campaign. The first card must stop the scroll, the middle cards must each add new persuasive information, and the final card must close with one clear CTA.",
              "Primary text must complement the carousel instead of repeating every card.",
              "Set destinationUrl to an exact supplied URL when one exists; otherwise use https://www.westpack.com/.",
              "Unsupported or incomplete claims must be called out instead of being guessed.",
              options.selectedRouteId ? `The operator selected route '${options.selectedRouteId}'. Execute that route even when another route would normally be recommended.` : "Select the strongest route for this exact source and audience.",
              options.qualityReview ? `Independent Creative Director feedback from the previous rendered version:\n${JSON.stringify(options.qualityReview)}\nResolve every must-fix item, preserve the named strengths and return a complete replacement campaign.` : ""
            ].join("\n")
          },
          ...masterVisualImages.map((url) => ({ type: "input_image", image_url: url, detail: "high" })),
          ...imageUrls.slice(0, 8).map((url) => ({ type: "input_image", image_url: url, detail: "high" }))
        ]
      }
    ],
    memoryReferences,
    sourceDesignAudit,
    masterVisualImages
  };
}

function normalizeCreativeRoutes(value = {}) {
  const defaults = {
    faithful: { id: "faithful", title: "Master continuity", idea: "Translate the approved master closely.", hook: "Recognisable campaign authority", designShifts: ["Preserve palette", "Preserve hierarchy", "Adapt the rhythm"], strategicStrength: "Maximum source continuity", risk: "May be less disruptive in-feed" },
    editorial: { id: "editorial", title: "Editorial distinction", idea: "Increase premium restraint and pacing.", hook: "A composed product moment", designShifts: ["Increase whitespace", "Strengthen crops", "Tighten copy"], strategicStrength: "Premium brand distinction", risk: "Requires disciplined restraint" },
    performance: { id: "performance", title: "Commercial clarity", idea: "Sharpen the hook and selling hierarchy.", hook: "Immediate customer value", designShifts: ["Front-load value", "Accelerate proof", "Clarify CTA"], strategicStrength: "Fast mobile comprehension", risk: "Can become too loud" }
  };
  const supplied = new Map((Array.isArray(value.routes) ? value.routes : []).map((route) => [route?.id, route]));
  const routes = ["faithful", "editorial", "performance"].map((id) => ({ ...defaults[id], ...(supplied.get(id) || {}), id }));
  return {
    recommendedRouteId: ["faithful", "editorial", "performance"].includes(value.recommendedRouteId) ? value.recommendedRouteId : "faithful",
    routes
  };
}

function normalizeMetaFromMasterResult(input, parsed, model, memoryReferences = [], imageUrls = [], sourceDesignAudit = extractMasterDesignDna(input?.source), masterVisualImages = []) {
  const rawCards = Array.isArray(parsed?.carousel?.cards) ? parsed.carousel.cards : [];
  const fallbackUrl = imageUrls[0] || "";
  const cards = rawCards.slice(0, 6).map((card, index) => {
    const requestedIndex = Math.max(1, Math.min(imageUrls.length || 1, Number(card?.imageIndex) || index + 1));
    return {
      ...card,
      index: index + 1,
      imageIndex: requestedIndex,
      imageUrl: imageUrls[requestedIndex - 1] || fallbackUrl
    };
  });

  return {
    input,
    masterAudit: parsed?.masterAudit || null,
    sourceDesignAudit,
    designTranslation: normalizeDesignTranslation(parsed?.designTranslation || {}, sourceDesignAudit),
    creativeRoutes: normalizeCreativeRoutes(parsed?.creativeRoutes || {}),
    artifacts: { meta: parsed?.meta || null },
    carousel: {
      concept: parsed?.carousel?.concept || "",
      visualSystem: parsed?.carousel?.visualSystem || "",
      consistencyRules: Array.isArray(parsed?.carousel?.consistencyRules) ? parsed.carousel.consistencyRules : [],
      cards
    },
    productionNotes: Array.isArray(parsed?.productionNotes) ? parsed.productionNotes : [],
    memoryReferences,
    sourceImages: imageUrls,
    masterVisualImages: Array.isArray(masterVisualImages) ? masterVisualImages : [],
    model,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildMetaFromMasterPrompt,
  buildMetaFromMasterSchema,
  normalizeMetaFromMasterResult,
  extractMasterVisualUrls
};
