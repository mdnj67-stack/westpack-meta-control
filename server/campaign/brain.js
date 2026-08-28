const { buildGlossaryPromptBlock } = require("../lib/glossary");
const { buildWestpackKnowledgeContext } = require("../lib/westpack-knowledge");
const {
  buildCampaignMemoryPromptBlock,
  selectCampaignMemoryReferences
} = require("./memory");
const {
  renderPremiumCampaignEmail,
  selectReachableCampaignEmailImages
} = require("./email-design");
const { WESTPACK_UNIVERSAL_CONTENT } = require("./email-universal-content");
const {
  EMAIL_MODULES,
  EMAIL_MODULE_SYSTEM_VERSION,
  WESTPACK_EMAIL_MASTER,
  buildEmailModulePromptBlock,
  normalizeEmailSections
} = require("./email-module-library");

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueList(values = [], limit = 12) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function normalizeAssets(assets = []) {
  return uniqueList(
    (Array.isArray(assets) ? assets : []).map((asset) => {
      if (typeof asset === "string") {
        return asset;
      }

      return [
        asset?.type,
        asset?.name,
        asset?.url,
        asset?.description
      ].filter(Boolean).join(" | ");
    }),
    24
  );
}

function normalizeSourcePayload(source = {}) {
  if (typeof source === "string") {
    return {
      type: "brief",
      title: "",
      subject: "",
      previewText: "",
      body: normalizeWhitespace(source),
      html: "",
      notes: ""
    };
  }

  return {
    type: normalizeWhitespace(source?.type || "brief").toLowerCase() || "brief",
    title: normalizeWhitespace(source?.title),
    subject: normalizeWhitespace(source?.subject),
    previewText: normalizeWhitespace(source?.previewText),
    body: normalizeWhitespace(source?.body),
    html: String(source?.html || "").trim(),
    notes: normalizeWhitespace(source?.notes)
  };
}

function inferChannels(input) {
  const requested = uniqueList(input?.channels || input?.desiredOutputs || [], 6)
    .map((item) => item.toLowerCase());

  if (requested.length) {
    return requested;
  }

  const sourceType = normalizeWhitespace(input?.source?.type || input?.sourceType).toLowerCase();
  if (sourceType === "blog") {
    return ["blog", "klaviyo", "meta"];
  }

  return ["klaviyo", "meta", "blog"];
}

function normalizeCampaignBrainInput(input = {}) {
  const source = normalizeSourcePayload(input.source || {
    type: input.sourceType,
    title: input.sourceTitle,
    subject: input.sourceSubject,
    previewText: input.sourcePreviewText,
    body: input.sourceBody || input.brief,
    html: input.sourceHtml,
    notes: input.operatorNote
  });

  const normalized = {
    title: normalizeWhitespace(input.title || input.campaignTitle || source.title || "Untitled campaign"),
    objective: normalizeWhitespace(input.objective || input.goal || ""),
    audience: normalizeWhitespace(input.audience || input.targetAudience || ""),
    offer: normalizeWhitespace(input.offer || ""),
    tone: normalizeWhitespace(input.tone || "Commercial, direct and premium"),
    markets: uniqueList(input.markets || input.countries || [], 12),
    channels: inferChannels({
      channels: input.channels,
      desiredOutputs: input.desiredOutputs,
      source,
      sourceType: source.type
    }),
    source,
    assets: normalizeAssets(input.assets || input.creativeAssets || input.images || input.videos || []),
    constraints: uniqueList(input.constraints || [], 12),
    operatorNote: normalizeWhitespace(input.operatorNote || source.notes),
    campaignType: normalizeWhitespace(input.campaignType || "campaign"),
    desiredOutcome: normalizeWhitespace(input.desiredOutcome || "")
  };

  return normalized;
}

function buildSourceTexts(input) {
  return [
    input.title,
    input.objective,
    input.audience,
    input.offer,
    input.operatorNote,
    input.source.title,
    input.source.subject,
    input.source.previewText,
    input.source.body,
    stripHtml(input.source.html),
    ...input.assets,
    ...input.constraints
  ];
}

function buildCampaignBrainSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      campaign: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          coreAngle: { type: "string" },
          corePromise: { type: "string" },
          primaryCta: { type: "string" },
          tone: { type: "string" },
          successSignal: { type: "string" }
        },
        required: ["summary", "coreAngle", "corePromise", "primaryCta", "tone", "successSignal"]
      },
      sourceAudit: {
        type: "object",
        additionalProperties: false,
        properties: {
          verdict: { type: "string" },
          summary: { type: "string" },
          strengths: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string" }
          },
          gaps: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string" }
          },
          risks: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" }
          }
        },
        required: ["verdict", "summary", "strengths", "gaps", "risks"]
      },
      channelPlans: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            channel: { type: "string" },
            goal: { type: "string" },
            angle: { type: "string" },
            audience: { type: "string" },
            format: { type: "string" },
            deliverables: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  objective: { type: "string" },
                  status: { type: "string", enum: ["ready", "needs_input", "blocked"] }
                },
                required: ["type", "title", "objective", "status"]
              }
            },
            dependencies: {
              type: "array",
              maxItems: 5,
              items: { type: "string" }
            },
            notes: {
              type: "array",
              maxItems: 4,
              items: { type: "string" }
            }
          },
          required: ["channel", "goal", "angle", "audience", "format", "deliverables", "dependencies", "notes"]
        }
      },
      assetPlan: {
        type: "object",
        additionalProperties: false,
        properties: {
          readyAssets: {
            type: "array",
            maxItems: 10,
            items: { type: "string" }
          },
          missingAssets: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { type: "string" }
          },
          recommendations: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: { type: "string" }
          }
        },
        required: ["readyAssets", "missingAssets", "recommendations"]
      },
      workflow: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            step: { type: "string" },
            objective: { type: "string" },
            output: { type: "string" },
            owner: { type: "string" },
            status: { type: "string", enum: ["ready", "needs_input", "blocked"] }
          },
          required: ["step", "objective", "output", "owner", "status"]
        }
      },
      orchestration: {
        type: "object",
        additionalProperties: false,
        properties: {
          nextBestAction: { type: "string" },
          systemRole: { type: "string" },
          handoffNotes: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string" }
          }
        },
        required: ["nextBestAction", "systemRole", "handoffNotes"]
      }
    },
    required: ["campaign", "sourceAudit", "channelPlans", "assetPlan", "workflow", "orchestration"]
  };
}

function buildCampaignArtifactSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      email: {
        type: "object",
        additionalProperties: false,
        properties: {
          templateName: { type: "string" },
          subject: { type: "string" },
          previewText: { type: "string" },
          bodyHtml: { type: "string" },
          primaryCta: { type: "string" },
          primaryCtaUrl: { type: "string" },
          visualDirection: { type: "string", enum: ["soft_luxury", "warm_editorial", "product_modular", "bold_commercial"] },
          heroLayout: { type: "string", enum: ["copy_first", "image_first", "typographic"] },
          eyebrow: { type: "string" },
          heroHeadline: { type: "string" },
          intro: { type: "string" },
          heroImageUrl: { type: "string" },
          heroImageAlt: { type: "string" },
          sections: {
            type: "array",
            minItems: 3,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                headline: { type: "string" },
                body: { type: "string" },
                bullets: { type: "array", maxItems: 5, items: { type: "string" } },
                moduleId: { type: "string", enum: EMAIL_MODULES.map((module) => module.id) },
                layout: { type: "string", enum: EMAIL_MODULES.map((module) => module.id) },
                imageUrl: { type: "string" },
                imageAlt: { type: "string" }
              },
              required: ["label", "headline", "body", "bullets", "moduleId", "layout", "imageUrl", "imageAlt"]
            }
          },
          closingHeadline: { type: "string" },
          closingBody: { type: "string" },
          rationale: { type: "string" }
        },
        required: ["templateName", "subject", "previewText", "bodyHtml", "primaryCta", "primaryCtaUrl", "visualDirection", "heroLayout", "eyebrow", "heroHeadline", "intro", "heroImageUrl", "heroImageAlt", "sections", "closingHeadline", "closingBody", "rationale"]
      },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          campaignAngle: { type: "string" },
          primaryText: { type: "string" },
          headline: { type: "string" },
          description: { type: "string" },
          rationale: { type: "string" },
          variants: {
            type: "array",
            minItems: 2,
            maxItems: 2,
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
          },
          carouselConcepts: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                angle: { type: "string" },
                rationale: { type: "string" },
                cards: {
                  type: "array",
                  minItems: 3,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      position: { type: "integer", minimum: 1, maximum: 7 },
                      role: { type: "string", enum: ["hook", "story", "proof", "detail", "close"] },
                      assetUrl: { type: "string" },
                      headline: { type: "string" },
                      body: { type: "string" },
                      cropIntent: { type: "string" },
                      overlayGuidance: { type: "string" }
                    },
                    required: ["position", "role", "assetUrl", "headline", "body", "cropIntent", "overlayGuidance"]
                  }
                }
              },
              required: ["name", "angle", "rationale", "cards"]
            }
          }
        },
        required: ["campaignAngle", "primaryText", "headline", "description", "rationale", "variants", "carouselConcepts"]
      },
      blog: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          excerpt: { type: "string" },
          bodyHtml: { type: "string" },
          rationale: { type: "string" }
        },
        required: ["title", "slug", "excerpt", "bodyHtml", "rationale"]
      },
      productionNotes: {
        type: "array",
        maxItems: 8,
        items: { type: "string" }
      }
    },
    required: ["email", "meta", "blog", "productionNotes"]
  };
}

function buildCampaignCarouselSuggestionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      primaryText: { type: "string" },
      headline: { type: "string" },
      description: { type: "string" },
      cta: { type: "string", enum: ["LEARN_MORE"] },
      cards: {
        type: "array",
        minItems: 2,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer" },
            title: { type: "string" },
            description: { type: "string" },
            rationale: { type: "string" }
          },
          required: ["index", "title", "description", "rationale"]
        }
      },
      guidance: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: { type: "string" }
      }
    },
    required: ["primaryText", "headline", "description", "cta", "cards", "guidance"]
  };
}

function buildCampaignBrainPrompt(input, providedReferences = null) {
  const sourceTexts = buildSourceTexts(input);
  const memoryReferences = providedReferences || selectCampaignMemoryReferences(input);
  const memoryBlock = buildCampaignMemoryPromptBlock(memoryReferences);
  const knowledgeContext = buildWestpackKnowledgeContext({
    sourceTexts,
    channel: "general",
    mode: "create"
  });
  const glossaryBlock = buildGlossaryPromptBlock({
    targetLanguage: input.markets.join(", "),
    sourceTexts
  });

  return {
    prompt: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are Westpack's campaign brain.",
              "Your task is to turn one campaign brief into a cross-channel execution system.",
              "Think like a commercial content strategist, lifecycle marketer, paid social strategist and production lead at the same time.",
              "You are not writing the final content assets yet. You are planning the highest-value content machine around the brief.",
              "Be critical. Identify what is strong, what is missing, what will bottleneck production, and what should happen first.",
              "Outputs must be concrete, execution-ready and channel-aware.",
              "Prioritize channels the operator requested, but still call out missing opportunities when obvious.",
              "Favor reusable content pillars that can feed Klaviyo, Meta and blog/html production without duplicated work.",
              "Do not invent product claims, pricing, lead times, certifications, environmental claims or guarantees.",
              `Structured Westpack context: ${JSON.stringify(knowledgeContext)}`,
              memoryBlock,
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
              "Campaign input:",
              JSON.stringify(input, null, 2),
              "",
              "Build one campaign plan that explains:",
              "1. What the campaign is really about.",
              "2. Whether the source material is strong enough.",
              "3. Which channel deliverables should be produced first.",
              "4. Which assets are ready versus missing.",
              "5. The execution workflow for an autonomous campaign machine.",
              "",
              "Channel guidance:",
              "- Klaviyo: think campaign email, subject line angle, segmentation logic and supporting lifecycle variants.",
              "- Meta: think ad angle, creative dependency, variant logic and commercial hook.",
              "- Blog: think HTML-first content, SEO/supporting authority angle and how it feeds the other channels.",
              "",
              "If the brief is weak, say so clearly and downgrade channel outputs that should wait for more input."
            ].join("\n")
          }
        ]
      }
    ],
    knowledgeContext,
    memoryReferences
  };
}

function buildCampaignArtifactsPrompt(input, plan = null, providedReferences = null, metaIntelligenceBlock = "") {
  const sourceTexts = buildSourceTexts(input);
  const memoryReferences = providedReferences || selectCampaignMemoryReferences(input);
  const memoryBlock = buildCampaignMemoryPromptBlock(memoryReferences);
  const knowledgeContext = buildWestpackKnowledgeContext({
    sourceTexts,
    channel: "general",
    mode: "create"
  });
  const glossaryBlock = buildGlossaryPromptBlock({
    targetLanguage: input.markets.join(", "),
    sourceTexts
  });

  return {
    prompt: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are Westpack's autonomous campaign production brain.",
              "Turn one campaign brief into a first production-ready artifact pack across Klaviyo email, Meta ads and blog/html.",
              "Stay commercially sharp, direct and concrete.",
              "Email is produced through a dedicated design compiler. Supply a complete art direction and structured editorial modules, not a generic text block.",
              "The compiler always injects Westpack's locked Klaviyo universal content: Header - 2023 and Footer - 2023. Never recreate, rewrite or duplicate navigation, logo, contact details, social links, legal text, web-view or unsubscribe content inside campaign modules.",
              "Choose visualDirection from the selected Campaign Memory patterns and campaign objective: soft_luxury, warm_editorial, product_modular or bold_commercial.",
              "The email needs a deliberate visual rhythm: sharp eyebrow, campaign-specific hero, concise intro, 3-4 distinct sections, and a decisive closing panel.",
              buildEmailModulePromptBlock(),
              "Choose heroLayout intentionally. Use typographic only when the supplied imagery is weak; otherwise choose whether image or copy creates the strongest opening.",
              `Compose sections only from these approved email-safe modules: ${EMAIL_MODULES.map((module) => module.id).join(", ")}. Do not repeat one module for every section.`,
              "Assign section imageUrl only from exact supplied static image URLs. Videos are source material, never valid <img> values.",
              "Every section needs a real job in the persuasion sequence. Avoid repetitive headings, filler copy and generic feature dumps.",
              "Section labels must be short, natural editorial labels in the campaign language. Never output internal tokens, underscores, field names or labels like FORMAT_INTRO.",
              "Use heroImageUrl only when it is an exact URL supplied in Campaign input assets. Never fabricate an image URL.",
              "bodyHtml is a semantic fallback containing the same copy; the server compiles the final responsive table-based email document.",
              "Quality is more important than output volume. Commit to one dominant creative route and make every requested deliverable earn its place; never add filler to satisfy quantity.",
              "Meta is carousel-first: create exactly 2 materially different but fully resolved carousel concepts with 3-6 cards, a real narrative progression, exact supplied asset URLs, crop intent and overlay guidance. Choose the shortest card count that tells the idea completely; never pad a three-card idea to satisfy a format quota.",
              "Every customer-facing Meta field must be natural UK English even when the email, source material or market is Danish. Use British spelling and never leave Danish copy in the Meta artifact.",
              metaIntelligenceBlock || "Meta Historical Intelligence: no performance learning snapshot is available yet.",
              "Use historical Meta patterns as directional evidence only. Never copy an old ad verbatim, confuse correlation with causation, or override the current brief and supplied product truth.",
              "Blog output must be HTML-first, scannable, and useful as the source asset that can feed email and ads.",
              "Reuse one dominant angle across all channels, but adapt format and cadence per channel.",
              "Do not invent unsupported numbers, guarantees, environmental claims, delivery promises or legal claims.",
              "Never place placeholders, validation requests, editorial instructions or internal review language in customer-facing email, Meta or blog fields. If a fact is missing, omit or reframe the claim safely and record the gap only in productionNotes.",
              "Customer-facing copy must be complete as written. Never output bracketed INSERT/INDSÆT tokens, TODOs, approval reminders, 'before publishing' notes or statements that something must be validated.",
              `Structured Westpack context: ${JSON.stringify(knowledgeContext)}`,
              memoryBlock,
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
              "Campaign input:",
              JSON.stringify(input, null, 2),
              "",
              "Approved campaign plan:",
              JSON.stringify(plan || null, null, 2),
              "",
              "Output rules:",
              "- Email must feel art-directed and reference-aware, with enough visual and editorial contrast to match a premium designed campaign.",
              "- Select one supplied asset URL for heroImageUrl. If no valid asset URL exists, return an empty string.",
              "- Use sections to create a narrative sequence rather than one long sales letter. Keep bullets selective and use the steps module only for genuine progression.",
              "- Use at least three materially different section layouts when four or more sections are present. Every selected image must have a purposeful crop role and meaningful alt text.",
              "- Set primaryCtaUrl only to an exact supplied campaign/product URL. Otherwise return an empty string so the draft compiler renders a non-clickable review CTA.",
              "- Meta must include one core ad, exactly 2 genuinely testable copy variants and exactly 2 complete carouselConcepts. Each carousel needs 3-6 ordered cards, with the count chosen from the narrative rather than a fixed template, and must use only exact supplied asset URLs; use an empty assetUrl if no appropriate source exists.",
              "- Write all Meta primary text, headlines, descriptions, variants and carousel cards in UK English with British spelling.",
              "- Blog should be a short HTML article that can act as the source narrative for the other channels.",
              "- Prefer fewer, sharper claims and modules. Remove any section, variant or sentence that merely repeats another without adding persuasion, proof or useful context.",
              "- Preserve a premium B2B Westpack tone.",
              "- If the brief is business-case driven, make the commercial logic obvious early.",
              "- Keep every unresolved fact, missing URL, asset request and operational caveat exclusively in productionNotes; customer-facing artifacts must never expose them."
            ].join("\n")
          }
        ]
      }
    ],
    memoryReferences
  };
}

function buildCampaignCarouselSuggestionsPrompt(input, plan = null, metaArtifact = null, cardCount = 0, cardPlan = [], carouselImages = [], metaIntelligenceBlock = "") {
  const sourceTexts = buildSourceTexts(input);
  const memoryReferences = selectCampaignMemoryReferences(input);
  const memoryBlock = buildCampaignMemoryPromptBlock(memoryReferences);
  const knowledgeContext = buildWestpackKnowledgeContext({
    sourceTexts,
    channel: "meta",
    mode: "create"
  });
  const glossaryBlock = buildGlossaryPromptBlock({
    targetLanguage: input.markets.join(", "),
    sourceTexts
  });

  return {
    prompt: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are Westpack's Meta carousel card strategist.",
              "Write the complete copy system for a premium B2B Meta carousel.",
              "All customer-facing ad copy must be natural UK English, regardless of the source campaign language or market. Use British spelling such as jewellery, colour, personalised and centre.",
              "Return complementary primary text, headline and description plus card-level copy. Use LEARN_MORE as the CTA.",
              "Each card needs a short title and a short supporting description.",
              "Titles must be commercially sharp and scannable.",
              "Descriptions must stay compact, useful and realistic.",
              "Do not invent unsupported numbers, guarantees, delivery claims, legal claims or sustainability claims.",
              "Make each card feel distinct, but keep one coherent campaign angle.",
              metaIntelligenceBlock || "Meta Historical Intelligence: no performance learning snapshot is available yet.",
              "Treat historical patterns as directional associations, not causal facts. Adapt useful principles instead of copying old copy.",
              `Structured Westpack context: ${JSON.stringify(knowledgeContext)}`,
              memoryBlock,
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
              "Campaign input:",
              JSON.stringify(input, null, 2),
              "",
              "Campaign plan:",
              JSON.stringify(plan || null, null, 2),
              "",
              "Current Meta artifact:",
              JSON.stringify(metaArtifact || null, null, 2),
              "",
              `Create copy suggestions for exactly ${Math.max(2, Number(cardCount) || 2)} carousel cards.`,
              "Keep the sequence logical from hook to proof to CTA.",
              "Use the strongest commercial angle first.",
              "Write every customer-facing field in UK English. Translate the source meaning faithfully; never leave Danish words in the ad.",
              `Card sequence plan: ${JSON.stringify(Array.isArray(cardPlan) ? cardPlan : [], null, 2)}`,
              "If images are attached, look at them and let the card copy reflect what each card visually emphasizes without inventing unsupported claims.",
              `Attached image references: ${JSON.stringify((Array.isArray(carouselImages) ? carouselImages : []).map((image) => ({
                index: image?.index,
                name: image?.name
              })), null, 2)}`
            ].join("\n")
          },
          ...(Array.isArray(carouselImages) ? carouselImages : [])
            .filter((image) => typeof image?.image_url === "string" && image.image_url.trim())
            .slice(0, 8)
            .map((image) => ({
              type: "input_image",
              image_url: image.image_url
            }))
        ]
      }
    ],
    memoryReferences
  };
}

function normalizeEnvironmentPreset(value = "") {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (["scandi_luxe", "editorial_minimal", "warm_holiday", "soft_residential"].includes(normalized)) {
    return normalized;
  }
  return "scandi_luxe";
}

function getEnvironmentPresetProfile(preset = "scandi_luxe") {
  switch (normalizeEnvironmentPreset(preset)) {
    case "editorial_minimal":
      return {
        label: "Editorial minimal",
        scene: "minimal editorial interior with controlled negative space",
        palette: "chalk white, warm stone, muted greige, brushed oak",
        materials: "limewashed walls, travertine, matte oak, woven textile",
        lighting: "clean directional daylight with soft shadow falloff",
        props: "very restrained premium home props only when they support scale and use",
        avoid: "busy styling, bright saturated colors, clutter, cheap props, glossy plastic surfaces"
      };
    case "warm_holiday":
      return {
        label: "Warm holiday luxe",
        scene: "premium Nordic holiday interior with subtle seasonal warmth",
        palette: "oat, walnut, brass, pine, warm ivory, muted burgundy accents",
        materials: "matte wood, brushed brass, stoneware, soft linen, wool texture",
        lighting: "soft golden daylight or early evening glow without looking orange",
        props: "carefully curated premium seasonal styling kept secondary to the product",
        avoid: "kitsch holiday decor, heavy red-green contrast, glitter, overcrowded scenes"
      };
    case "soft_residential":
      return {
        label: "Soft residential",
        scene: "refined Scandinavian home setting with lived-in calm",
        palette: "sage, oat, sand, walnut, cloud grey",
        materials: "linen, oak, wool, brushed metal, honed stone",
        lighting: "soft diffused daylight with calm atmosphere",
        props: "residential decor that reinforces aspiration without stealing attention",
        avoid: "messy rooms, overly staged lifestyle clichés, strong color pops"
      };
    case "scandi_luxe":
    default:
      return {
        label: "Scandi luxe",
        scene: "high-end Scandinavian luxury interior with quiet premium styling",
        palette: "warm ivory, soft taupe, pale stone, muted walnut, brushed brass",
        materials: "travertine, oak, linen, suede, matte ceramics, brushed metal",
        lighting: "soft Nordic daylight with elegant contrast and gentle shadows",
        props: "minimal luxury props that support a premium jewellery or gifting context",
        avoid: "visual noise, low-end decor, harsh flash, oversaturated tones, messy composition"
      };
  }
}

function getEnvironmentShotRole(index = 0) {
  const roles = [
    "hero product scene",
    "detail-driven product close-up",
    "contextual premium use-case",
    "range or assortment support shot",
    "closing conversion-oriented shot"
  ];
  return roles[index] || "supporting premium product scene";
}

function getEnvironmentOutputSize(aspectRatio = "") {
  switch (normalizeWhitespace(aspectRatio).toLowerCase()) {
    case "square":
      return "1024x1024";
    case "landscape":
      return "1536x1024";
    case "portrait":
    default:
      return "1024x1536";
  }
}

function normalizeEnvironmentFormats(values = []) {
  const allowed = new Set(["square", "portrait", "landscape"]);
  const normalized = uniqueList(Array.isArray(values) ? values : [values], 3)
    .map((item) => normalizeWhitespace(item).toLowerCase())
    .filter((item) => allowed.has(item));
  return normalized.length ? normalized : ["portrait"];
}

function buildCampaignEnvironmentSeries(input, environmentConfig = {}, plan = null, metaArtifact = null, imageCount = 0, environmentImages = []) {
  const preset = getEnvironmentPresetProfile(environmentConfig?.preset || "scandi_luxe");
  const selectedFormats = normalizeEnvironmentFormats(environmentConfig?.selectedFormats || environmentConfig?.aspectRatio || "portrait");
  const quality = normalizeWhitespace(environmentConfig?.quality || "medium").toLowerCase() || "medium";
  const customDirection = normalizeWhitespace(environmentConfig?.customDirection || "");
  const backgroundMode = normalizeWhitespace(environmentConfig?.backgroundMode || "opaque").toLowerCase() || "opaque";
  const sharedAngle = normalizeWhitespace(
    metaArtifact?.campaignAngle
    || plan?.campaign?.coreAngle
    || input.offer
    || input.objective
    || input.title
  );
  const sharedCta = normalizeWhitespace(
    plan?.campaign?.primaryCta
    || metaArtifact?.headline
    || input.source?.subject
    || input.title
  );
  const campaignSummary = normalizeWhitespace(
    plan?.campaign?.summary
    || input.source?.body
    || input.objective
  );
  const referenceNames = uniqueList(
    (Array.isArray(environmentImages) ? environmentImages : []).map((image) => image?.name || ""),
    8
  );
  const totalImages = Math.max(1, Math.min(6, Number(imageCount) || referenceNames.length || 1));

  const consistencyRules = [
    `Keep every output in the same ${preset.label.toLowerCase()} world with one coherent interior language.`,
    "Preserve the real product silhouette, proportions, branding marks, closures, seams and key material characteristics from the source image.",
    "Do not redesign the product, invent product features, recolor the hero product aggressively or change camera logic between images.",
    "Keep background styling secondary to the product so the campaign still reads as commerce-ready, not just mood imagery.",
    "Maintain one consistent lighting direction, color temperature and styling vocabulary across the full series."
  ];

  if (customDirection) {
    consistencyRules.push(`Extra operator direction: ${customDirection}`);
  }

  const prompts = Array.from({ length: totalImages }, (_, index) => {
    const shotRole = getEnvironmentShotRole(index);
    const referenceName = referenceNames[index] || `Reference image ${index + 1}`;
    const framingHint = selectedFormats.length > 1
      ? `${selectedFormats.join(", ")} output pack`
      : `${selectedFormats[0] || "portrait"} aspect ratio`;

    return {
      index: index + 1,
      name: referenceName,
      role: shotRole,
      prompt: [
        "Use case: product-mockup",
        `Asset type: campaign environment image for ${input.channels?.includes("meta") ? "Meta and lifecycle marketing" : "campaign marketing"}`,
        `Primary request: transform the source product packshot into a premium lifestyle-ready environment image while preserving the exact product identity and keeping it commercially usable.`,
        `Input images: Image ${index + 1}: edit target product photo to preserve.`,
        `Scene/backdrop: ${preset.scene}.`,
        `Subject: the exact Westpack product from the source image, preserved faithfully, positioned in a ${shotRole}.`,
        "Style/medium: photorealistic-natural luxury product photography.",
        `Composition/framing: ${framingHint}, premium editorial composition, clean focal hierarchy, no clutter, with the product clearly readable.`,
        `Lighting/mood: ${preset.lighting}.`,
        `Color palette: ${preset.palette}.`,
        `Materials/textures: ${preset.materials}.`,
        `Constraints: preserve the product shape, logo embossing, closure details, material feel and real-world finish from the source image; keep one consistent Scandinavian luxury campaign world across the whole series; campaign angle is ${sharedAngle || "premium packaging value"}.`,
        `Avoid: ${preset.avoid}; no text; no watermark; no extra hero product substitutions; no surreal styling; no visual drift between images.`,
        customDirection ? `Additional direction: ${customDirection}.` : "",
        sharedCta ? `Commercial intent: the full image set must support the message "${sharedCta}".` : "",
        campaignSummary ? `Campaign context: ${campaignSummary}.` : ""
      ].filter(Boolean).join("\n")
    };
  });

  return {
    preset: normalizeEnvironmentPreset(environmentConfig?.preset || "scandi_luxe"),
    presetLabel: preset.label,
    selectedFormats,
    quality,
    backgroundMode,
    summary: `Create one consistent ${preset.label.toLowerCase()} campaign world from raw product shots without losing product truth.`,
    sharedAngle,
    consistencyRules,
    prompts
  };
}

function extractJsonText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const textParts = [];
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  for (const output of outputs) {
    const content = Array.isArray(output?.content) ? output.content : [];
    for (const item of content) {
      if (item.type === "output_text" && item.text) {
        textParts.push(item.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function normalizeCampaignBrainResult(input, parsed, model, memoryReferences = []) {
  return {
    input,
    campaign: parsed?.campaign || null,
    sourceAudit: parsed?.sourceAudit || null,
    channelPlans: Array.isArray(parsed?.channelPlans) ? parsed.channelPlans : [],
    assetPlan: parsed?.assetPlan || {
      readyAssets: [],
      missingAssets: [],
      recommendations: []
    },
    workflow: Array.isArray(parsed?.workflow) ? parsed.workflow : [],
    orchestration: parsed?.orchestration || null,
    memoryReferences,
    model,
    generatedAt: new Date().toISOString()
  };
}

function normalizeCampaignArtifactResult(input, plan, parsed, model, memoryReferences = [], resolvedEmailImageUrls = []) {
  const email = parsed?.email || null;
  const compiledEmail = email ? compileCampaignEmailDraft(input, email, resolvedEmailImageUrls) : null;
  return {
    input,
    plan,
    artifacts: {
      email: compiledEmail,
      meta: parsed?.meta || null,
      blog: parsed?.blog || null
    },
    productionNotes: Array.isArray(parsed?.productionNotes) ? parsed.productionNotes : [],
    memoryReferences,
    model,
    generatedAt: new Date().toISOString()
  };
}

function compileCampaignEmailDraft(input = {}, email = {}, resolvedEmailImageUrls = []) {
  const sections = normalizeEmailSections(email.sections);
  const normalizedEmail = { ...email, sections };
  return {
    ...normalizedEmail,
    sourceBodyHtml: email.sourceBodyHtml || email.bodyHtml || "",
    bodyHtml: renderPremiumCampaignEmail(normalizedEmail, { ...input, resolvedEmailImageUrls }),
    moduleSystem: {
      version: EMAIL_MODULE_SYSTEM_VERSION,
      master: WESTPACK_EMAIL_MASTER,
      locked: true,
      modules: sections.map(({ moduleId, position }) => ({ moduleId, position }))
    },
    universalContent: {
      locked: true,
      header: WESTPACK_UNIVERSAL_CONTENT.header,
      footer: WESTPACK_UNIVERSAL_CONTENT.footer
    }
  };
}

module.exports = {
  buildCampaignEnvironmentSeries,
  buildCampaignCarouselSuggestionSchema,
  buildCampaignCarouselSuggestionsPrompt,
  buildCampaignArtifactsPrompt,
  buildCampaignArtifactSchema,
  buildCampaignBrainPrompt,
  buildCampaignBrainSchema,
  compileCampaignEmailDraft,
  extractJsonText,
  normalizeCampaignArtifactResult,
  normalizeCampaignBrainInput,
  normalizeCampaignBrainResult,
  selectReachableCampaignEmailImages
};
