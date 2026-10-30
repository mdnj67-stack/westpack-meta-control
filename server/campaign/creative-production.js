const { buildCampaignArtifactSchema } = require("./brain");
const { buildCampaignMemoryPromptBlock } = require("./memory");

const CREATIVE_PRODUCTION_VERSION = "westpack-creative-production-v1";
const CHANNELS = Object.freeze(["email", "meta", "blog"]);

function buildCreativeDirectionSchema() {
  const direction = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", enum: ["route_a", "route_b", "route_c"] },
      name: { type: "string" },
      bigIdea: { type: "string" },
      audienceTension: { type: "string" },
      commercialPromise: { type: "string" },
      visualSystem: { type: "string" },
      emailArchitecture: { type: "string" },
      metaNarrative: { type: "string" },
      blogRole: { type: "string" },
      evidencePlan: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
      ownableDevice: { type: "string" },
      reasonToBelieve: { type: "string" },
      risk: { type: "string" }
    },
    required: ["id", "name", "bigIdea", "audienceTension", "commercialPromise", "visualSystem", "emailArchitecture", "metaNarrative", "blogRole", "evidencePlan", "ownableDevice", "reasonToBelieve", "risk"]
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      directions: { type: "array", minItems: 3, maxItems: 3, items: direction }
    },
    required: ["directions"]
  };
}

function buildConceptSelectionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      selectedId: { type: "string", enum: ["route_a", "route_b", "route_c"] },
      verdict: { type: "string" },
      candidateScores: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", enum: ["route_a", "route_b", "route_c"] },
            briefFit: { type: "integer", minimum: 0, maximum: 100 },
            distinctiveness: { type: "integer", minimum: 0, maximum: 100 },
            evidenceStrength: { type: "integer", minimum: 0, maximum: 100 },
            visualPotential: { type: "integer", minimum: 0, maximum: 100 },
            channelPotential: { type: "integer", minimum: 0, maximum: 100 },
            risk: { type: "integer", minimum: 0, maximum: 100 },
            rationale: { type: "string" }
          },
          required: ["id", "briefFit", "distinctiveness", "evidenceStrength", "visualPotential", "channelPotential", "risk", "rationale"]
        }
      },
      creativeContract: {
        type: "object",
        additionalProperties: false,
        properties: {
          bigIdea: { type: "string" },
          singleMindedProposition: { type: "string" },
          audienceTension: { type: "string" },
          strategicEnemy: { type: "string" },
          promise: { type: "string" },
          reasonToBelieve: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
          memorabilityDevice: { type: "string" },
          referenceTranslation: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
          antiGenericRules: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
          proofSequence: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
          visualRules: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } },
          voiceRules: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
          messageSystem: {
            type: "object",
            additionalProperties: false,
            properties: {
              signatureThought: { type: "string" },
              openingTension: { type: "string" },
              proofAnchors: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
              languageToOwn: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } },
              languageToAvoid: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } }
            },
            required: ["signatureThought", "openingTension", "proofAnchors", "languageToOwn", "languageToAvoid"]
          },
          channelRoles: {
            type: "object",
            additionalProperties: false,
            properties: { email: { type: "string" }, meta: { type: "string" }, blog: { type: "string" } },
            required: ["email", "meta", "blog"]
          },
          nonNegotiables: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
        },
        required: ["bigIdea", "singleMindedProposition", "audienceTension", "strategicEnemy", "promise", "reasonToBelieve", "memorabilityDevice", "referenceTranslation", "antiGenericRules", "proofSequence", "visualRules", "voiceRules", "messageSystem", "channelRoles", "nonNegotiables"]
      }
    },
    required: ["selectedId", "verdict", "candidateScores", "creativeContract"]
  };
}

function buildCreativeDirectionsPrompt({ input, plan, memoryReferences = [], learningBlock = "", priorDirections = null, qualityGate = null }) {
  return [{
    role: "system",
    content: [{ type: "input_text", text: [
      `You are Westpack's Creative Director (${CREATIVE_PRODUCTION_VERSION}).`,
      "Develop exactly three materially different campaign routes before any channel copy is written.",
      "A route is a strategic and visual organising idea, not a headline variation. Each must use a different audience tension, proof order, image choreography and persuasion mechanism.",
      "Every route needs one ownable memory device and a reason-to-believe grounded in supplied evidence. If the route could fit any premium packaging company after replacing the logo, it fails.",
      "Give every route creative voltage: a sharp point of view, a recognisable customer tension and one surprising but defensible verbal or visual move. Boldness must come from insight, contrast and specificity—not hype.",
      "Write the route's big idea as a thought a customer could remember and repeat. Strategy labels, adjective stacks and polished category promises are not big ideas.",
      "Do not use vague strategy language such as elevate, unlock, stand out, premium solution or transform unless the brief supplies a concrete and non-generic meaning.",
      "Ground every route in the locked brief and supplied evidence. Never invent facts, prices, performance, guarantees or sustainability claims.",
      "Use the owned historical Westpack emails as observable design evidence. Translate their hierarchy, pacing, module rhythm and CTA cadence; do not copy wording or force an irrelevant layout.",
      buildCampaignMemoryPromptBlock(memoryReferences),
      learningBlock || "Human Campaign Learning: no relevant operator feedback has been recorded yet.",
      "Return strict JSON only."
    ].join("\n") }]
  }, {
    role: "user",
    content: [{ type: "input_text", text: [
      `LOCKED INPUT:\n${JSON.stringify(input)}`,
      `LOCKED PLAN:\n${JSON.stringify(plan)}`,
      priorDirections ? `REJECTED ROUTE SET:\n${JSON.stringify(priorDirections)}` : "",
      qualityGate ? `DIVERSITY GATE FAILURES:\n${JSON.stringify(qualityGate.failures || [])}` : "",
      "Create route_a, route_b and route_c. Make their trade-offs explicit and make each strong enough to win rather than including a token weak option."
    ].filter(Boolean).join("\n\n") }]
  }];
}

function directionTokens(direction = {}) {
  return new Set([direction.bigIdea, direction.audienceTension, direction.commercialPromise, direction.visualSystem, direction.ownableDevice].join(" ").toLowerCase().match(/[a-zà-ž0-9]+/gi)?.filter((token) => token.length > 4) || []);
}

function directionSimilarity(left = {}, right = {}) {
  const a = directionTokens(left);
  const b = directionTokens(right);
  if (!a.size || !b.size) return 1;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / new Set([...a, ...b]).size;
}

function evaluateCreativeDirectionDiversity(value = {}) {
  const directions = Array.isArray(value.directions) ? value.directions : [];
  const failures = [];
  if (directions.length !== 3) failures.push("exactly three routes are required");
  const bigIdeas = new Set(directions.map((direction) => String(direction.bigIdea || "").toLowerCase().trim()).filter(Boolean));
  const tensions = new Set(directions.map((direction) => String(direction.audienceTension || "").toLowerCase().trim()).filter(Boolean));
  const devices = new Set(directions.map((direction) => String(direction.ownableDevice || "").toLowerCase().trim()).filter(Boolean));
  if (bigIdeas.size !== directions.length) failures.push("routes repeat the same big idea");
  if (tensions.size !== directions.length) failures.push("routes repeat the same audience tension");
  if (devices.size !== directions.length) failures.push("routes repeat the same memory device");
  let maximumSimilarity = 0;
  for (let left = 0; left < directions.length; left += 1) for (let right = left + 1; right < directions.length; right += 1) maximumSimilarity = Math.max(maximumSimilarity, directionSimilarity(directions[left], directions[right]));
  if (maximumSimilarity > .58) failures.push("route language and mechanisms are too similar");
  const generic = directions.filter((direction) => /\b(?:unlock|elevate|discover|transform|stand out|premium solutions?)\b/i.test([direction.bigIdea, direction.ownableDevice].join(" ")));
  if (generic.length) failures.push("one or more routes depend on generic marketing language");
  return { passed: failures.length === 0, failures, maximumSimilarity: Number(maximumSimilarity.toFixed(2)) };
}

function buildConceptSelectionPrompt({ input, plan, directions, memoryReferences = [], learningBlock = "", priorSelection = null, qualityGate = null }) {
  return [{
    role: "system",
    content: [{ type: "input_text", text: [
      "You are Westpack's independent Executive Creative Director.",
      "Select one route before production. Score each route against brief fit, distinctiveness, evidence, visual potential and native channel potential; risk is scored high when the route depends on missing facts or assets.",
      "Do not average your way to a generic hybrid. Select a winner, then lock a precise creative contract which every channel specialist must obey.",
      "A selectable winner needs briefFit >=85, distinctiveness >=82, evidenceStrength >=78, visualPotential >=82, channelPotential >=82 and risk <=45. Do not award aspirational scores unsupported by the route text.",
      "The contract must preserve a single big idea while assigning a distinct job to email, Meta and blog.",
      "The creative contract may not override the production contract: email uses 3-4 compiled modules and one primary closing CTA; Meta is always natural UK English and contains exactly two distinct carousels, each using the shortest complete narrative between 3 and 6 cards. Never require a fixed card count, a Danish Meta master, a single-image replacement, multiple compiled CTAs or an unimplemented contact sheet.",
      "Lock a single-minded proposition, the audience's strategic enemy, concrete reasons to believe and one memorable verbal or visual device. These must be specific enough to reject generic channel output later.",
      "Translate at least two concrete patterns from the supplied owned Westpack email references into this campaign—such as hierarchy, pacing, image choreography or CTA rhythm—and state how each is adapted rather than copied.",
      "Write at least three campaign-specific anti-generic rules that downstream specialists can objectively obey.",
      "Reject safe-but-polished work. The winner must contain a quotable thought, a clear tension and a signature device that can survive intact across all three channels without making their copy identical.",
      "Lock a messageSystem before production: one signature thought, one opening tension, 2-5 evidence-backed proof anchors, a small vocabulary to own and the exact category language to avoid. The signature thought is an organising sentence, not a slogan that must be repeated verbatim.",
      buildCampaignMemoryPromptBlock(memoryReferences),
      learningBlock || "Human Campaign Learning: no relevant operator feedback has been recorded yet.",
      "Return strict JSON only."
    ].join("\n") }]
  }, {
    role: "user",
    content: [{ type: "input_text", text: [
      `LOCKED INPUT:\n${JSON.stringify(input)}`,
      `LOCKED PLAN:\n${JSON.stringify(plan)}`,
      `CANDIDATE ROUTES:\n${JSON.stringify(directions)}`,
      priorSelection ? `REJECTED PRIOR SELECTION:\n${JSON.stringify(priorSelection)}` : "",
      qualityGate ? `PRE-PRODUCTION GATE FAILURES:\n${JSON.stringify(qualityGate.failures || [])}` : "",
      "Choose the route most likely to produce a premium, specific, commercially useful campaign from the evidence actually available."
    ].filter(Boolean).join("\n\n") }]
  }];
}

function evaluateConceptSelectionQuality(selection = {}) {
  const selected = (selection.candidateScores || []).find((candidate) => candidate.id === selection.selectedId) || {};
  const contract = selection.creativeContract || {};
  const failures = [];
  const thresholds = { briefFit: 85, distinctiveness: 82, evidenceStrength: 78, visualPotential: 82, channelPotential: 82 };
  for (const [key, minimum] of Object.entries(thresholds)) if (Number(selected[key] || 0) < minimum) failures.push(`${key} must be at least ${minimum}`);
  if (Number(selected.risk ?? 100) > 45) failures.push("risk must be 45 or lower");
  for (const key of ["bigIdea", "singleMindedProposition", "audienceTension", "strategicEnemy", "promise", "memorabilityDevice"]) {
    if (String(contract[key] || "").trim().length < 12) failures.push(`${key} is not specific enough`);
  }
  const contractText = [contract.bigIdea, contract.singleMindedProposition, contract.audienceTension, contract.strategicEnemy, contract.promise, contract.memorabilityDevice].join(" ");
  const genericMatches = contractText.match(/\b(?:unlock|elevate|discover|transform|stand out|premium solutions?|exceptional quality|tailored solutions?|perfect solution|take (?:it|your|the) to the next level)\b/gi) || [];
  if (genericMatches.length >= 2) failures.push("the creative contract relies on generic marketing language rather than an ownable idea");
  if (!Array.isArray(contract.reasonToBelieve) || contract.reasonToBelieve.length < 2) failures.push("at least two reasons to believe are required");
  if (!Array.isArray(contract.referenceTranslation) || contract.referenceTranslation.length < 2) failures.push("at least two owned-reference design translations are required");
  if (!Array.isArray(contract.antiGenericRules) || contract.antiGenericRules.length < 3) failures.push("at least three anti-generic production rules are required");
  if (!Array.isArray(contract.proofSequence) || contract.proofSequence.length < 2) failures.push("a concrete proof sequence is required");
  const messageSystem = contract.messageSystem || {};
  if (String(messageSystem.signatureThought || "").trim().length < 18) failures.push("the message system needs a specific signature thought");
  if (String(messageSystem.openingTension || "").trim().length < 18) failures.push("the message system needs a recognisable opening tension");
  if (!Array.isArray(messageSystem.proofAnchors) || messageSystem.proofAnchors.length < 2) failures.push("the message system needs at least two evidence-backed proof anchors");
  if (!Array.isArray(messageSystem.languageToOwn) || messageSystem.languageToOwn.length < 3) failures.push("the message system needs a distinctive vocabulary to own");
  if (!Array.isArray(messageSystem.languageToAvoid) || messageSystem.languageToAvoid.length < 3) failures.push("the message system needs explicit category language to avoid");
  return { passed: failures.length === 0, failures, selectedScore: selected };
}

function buildChannelArtifactSchema(channel) {
  if (!CHANNELS.includes(channel)) throw new Error(`Unsupported production channel: ${channel}`);
  const channelSchema = buildCampaignArtifactSchema().properties[channel];
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      [channel]: channelSchema,
      productionNotes: { type: "array", maxItems: 4, items: { type: "string" } }
    },
    required: [channel, "productionNotes"]
  };
}

function channelRules(channel, metaIntelligenceBlock = "") {
  if (channel === "email") return [
    "You are a senior Klaviyo email creative director and conversion copywriter. Produce only the email artifact.",
    "The curated owned email references are your primary house-style evidence. Make their assigned roles visible in hierarchy, pacing, image choreography, editorial restraint and CTA rhythm.",
    "Use 3-4 purposeful, visually varied modules and exact supplied static image URLs only. The locked compiler adds Header - 2023 and Footer - 2023; never recreate universal content.",
    "Write a semantic bodyHtml fallback matching the structured copy. The server compiles the final responsive email.",
    "Give every module one distinct persuasion job. Subject, hero and section headlines must not restate one another; they should create forward motion.",
    "Subject lines need a concrete curiosity or value mechanism, not generic urgency. Keep hero and module headlines disciplined enough to scan on mobile.",
    "Create one sharp, quotable campaign line and build a deliberate reveal around it. Prefer concrete nouns, active verbs and contrast; remove adjective stacks and throat-clearing introductions.",
    "The opening must create an information gap or a useful tension within the first screen. Do not begin with a company introduction or a broad category claim.",
    "Do not solve weak evidence with more copy. Use specificity, sequencing and whitespace. A lightly edited template or adjective-led premium language is a failed result."
  ];
  if (channel === "meta") return [
    "You are a senior UK paid-social creative strategist. Produce only the Meta artifact.",
    "Every customer-facing word must be natural UK English with British spelling.",
    "Build exactly two genuinely different carousel executions of the locked idea, each with 3-6 cards. Choose the count independently for each concept from its narrative needs: three is enough for hook-proof-action; add story or detail cards only when they add persuasion.",
    "Use exact supplied asset URLs only. Headlines must survive mobile scanning and each card must advance the story.",
    "Keep card headlines at 10 words or fewer and card bodies at 28 words or fewer. Do not repeat the hook on later cards or use generic lines such as stand out, elevate, unlock or discover.",
    "The two executions must test different persuasion mechanisms while preserving the same creative contract; cosmetic headline variants do not count.",
    "Make the first card earn the swipe with a brief-specific question, contrast or incomplete thought. At least one line should feel unmistakably authored, while remaining credible and commercially clear.",
    metaIntelligenceBlock || "No historical Meta performance snapshot is available; do not invent one."
  ];
  return [
    "You are a senior B2B editorial strategist. Produce only the blog artifact.",
    "The article must add evidence, explanation and useful authority that email and Meta cannot carry; do not expand the email into filler.",
    "When the locked creative contract requires a visual progression, embed the exact supplied image URLs in bodyHtml with meaningful alt text and concise captions. Do not leave a mandatory photographic sequence as production guidance.",
    "Build at least 350 words of useful editorial depth when the supplied evidence supports it. Use a clear thesis, developed reasoning, scannable subheads and a practical conclusion.",
    "Open with a non-obvious, defensible thesis. Each section must add a new implication, example or decision rule; summary prose and generic inspiration do not count as depth.",
    "Do not repeat the email's module order or Meta's hook language. Stay faithful to the locked campaign language and approved facts. If evidence is limited, deepen explanation rather than inventing breadth."
  ];
}

function buildChannelProductionPrompt({ channel, input, plan, conceptSelection, memoryReferences = [], metaIntelligenceBlock = "", learningBlock = "" }) {
  return [{
    role: "system",
    content: [{ type: "input_text", text: [
      ...channelRules(channel, metaIntelligenceBlock),
      "Obey the locked creative contract. Do not dilute it with a second route.",
      "Use the locked messageSystem as an editorial source of truth: build from its tension, proof anchors and owned vocabulary. Do not mechanically repeat the signature thought in every field.",
      "Every central customer promise must be traceable to a supplied fact or a locked proof anchor. When evidence is limited, write a precise observation or implication instead of a broad claim.",
      "Build headline progression: hook, reframe, proof and action must each add meaning. No two headlines may perform the same rhetorical job.",
      "Never invent claims, prices, links, product details, guarantees or operational facts. Keep unresolved gaps only in productionNotes.",
      "Customer-facing fields must not contain TODOs, placeholders, approval notes or production instructions.",
      "Before returning JSON, silently challenge the draft: remove generic category language, duplicated headlines, unsupported superlatives, filler and channel copy that could belong to any competitor.",
      "Then perform a creative-voltage pass: identify the safest line and replace it with a more precise, more memorable expression of the same supported truth. Do not add hype or unsupported claims.",
      channel === "email" ? buildCampaignMemoryPromptBlock(memoryReferences) : "Use the selected contract as the channel source of truth.",
      learningBlock || "Human Campaign Learning: no relevant operator feedback has been recorded yet.",
      "Return strict JSON only."
    ].join("\n") }]
  }, {
    role: "user",
    content: [{ type: "input_text", text: [
      `CHANNEL: ${channel}`,
      `LOCKED INPUT:\n${JSON.stringify(input)}`,
      `LOCKED PLAN:\n${JSON.stringify(plan)}`,
      `LOCKED CONCEPT SELECTION:\n${JSON.stringify(conceptSelection)}`,
      `Produce the finished ${channel} artifact. Quality and coherence matter more than volume.`
    ].join("\n\n") }]
  }];
}

function selectRevisionChannel(qualityReview = {}, priorRevisionScopes = []) {
  const dimensions = new Map((qualityReview.dimensions || []).map((item) => [item.key, Number(item.score || 0)]));
  const brief = qualityReview.revisionBrief || {};
  const criticalText = (qualityReview.criticalFailures || []).join(" ").toLowerCase();
  const priorScopeCounts = (Array.isArray(priorRevisionScopes) ? priorRevisionScopes : []).reduce((counts, channel) => {
    counts[channel] = Number(counts[channel] || 0) + 1;
    return counts;
  }, {});
  const candidates = [
    { channel: "email", score: dimensions.get("email_quality") ?? 100, feedback: (brief.email || []).length, critical: /\bemail\b|\bklaviyo\b/.test(criticalText) },
    { channel: "meta", score: dimensions.get("meta_quality") ?? 100, feedback: (brief.meta || []).length, critical: /\bmeta\b|\bcarousel\b|\bpaid social\b/.test(criticalText) },
    { channel: "blog", score: dimensions.get("blog_quality") ?? dimensions.get("cross_channel_coherence") ?? 100, feedback: (brief.blog || []).length, critical: /\bblog\b|\barticle\b|\blanding\b/.test(criticalText) }
  ];
  const untouchedCritical = candidates.filter((candidate) => candidate.critical && !priorScopeCounts[candidate.channel]);
  if (untouchedCritical.length) {
    untouchedCritical.sort((left, right) => (left.score - left.feedback * 3) - (right.score - right.feedback * 3));
    return untouchedCritical[0].channel;
  }
  candidates.sort((left, right) => {
    const rank = (candidate) => (
      candidate.score
      - candidate.feedback * 3
      - (candidate.critical ? 30 : 0)
      + Number(priorScopeCounts[candidate.channel] || 0) * 25
    );
    return rank(left) - rank(right);
  });
  return candidates[0].channel;
}

function buildChannelRevisionPrompt({ channel, input, plan, conceptSelection, currentArtifact, qualityReview, revisionNumber, memoryReferences = [], metaIntelligenceBlock = "", learningBlock = "" }) {
  const channelFeedback = qualityReview?.revisionBrief?.[channel] || [];
  return [{
    role: "system",
    content: [{ type: "input_text", text: [
      ...channelRules(channel, metaIntelligenceBlock),
      "You are performing a surgical repair of one channel. The other channels are locked and will not be regenerated.",
      "Preserve every named strength and every strong element not implicated by the feedback. Change only what is necessary to resolve the cited failures.",
      "Repair the stated root cause, not merely its surface wording. If the cause is a generic idea, weak proof order or undifferentiated channel role, rebuild that channel's organising logic before polishing sentences.",
      "Treat every acceptance criterion as a test the replacement must visibly pass.",
      "The creative contract remains locked. Do not switch route, expand scope or invent evidence.",
      channel === "email" ? buildCampaignMemoryPromptBlock(memoryReferences) : "Preserve the locked channel role and campaign idea.",
      learningBlock || "Human Campaign Learning: no relevant operator feedback has been recorded yet.",
      "Return strict JSON only."
    ].join("\n") }]
  }, {
    role: "user",
    content: [{ type: "input_text", text: [
      `REVISION: ${revisionNumber}`,
      `CHANNEL: ${channel}`,
      `LOCKED INPUT:\n${JSON.stringify(input)}`,
      `LOCKED PLAN:\n${JSON.stringify(plan)}`,
      `LOCKED CREATIVE CONTRACT:\n${JSON.stringify(conceptSelection?.creativeContract || conceptSelection)}`,
      `CURRENT CHANNEL ARTIFACT:\n${JSON.stringify(currentArtifact)}`,
      `CHANNEL FEEDBACK:\n${JSON.stringify(channelFeedback)}`,
      `GLOBAL MUST-FIX:\n${JSON.stringify(qualityReview?.revisionBrief?.mustFix || [])}`,
      `ROOT CAUSES:\n${JSON.stringify(qualityReview?.revisionBrief?.rootCauses || [])}`,
      `ACCEPTANCE CRITERIA:\n${JSON.stringify(qualityReview?.revisionBrief?.acceptanceCriteria || [])}`,
      `PRESERVE VERBATIM IN INTENT:\n${JSON.stringify([...(qualityReview?.strengths || []), ...(qualityReview?.revisionBrief?.preserve || [])])}`,
      "Return the corrected channel plus concise productionNotes."
    ].join("\n\n") }]
  }];
}

function normalizeCreativeDirections(value = {}) {
  return { version: CREATIVE_PRODUCTION_VERSION, directions: Array.isArray(value.directions) ? value.directions : [] };
}

function normalizeConceptSelection(value = {}, directions = null) {
  return { version: CREATIVE_PRODUCTION_VERSION, ...value, selectedDirection: directions?.directions?.find((item) => item.id === value.selectedId) || null };
}

module.exports = {
  CHANNELS,
  CREATIVE_PRODUCTION_VERSION,
  buildChannelArtifactSchema,
  buildChannelProductionPrompt,
  buildChannelRevisionPrompt,
  buildConceptSelectionPrompt,
  buildConceptSelectionSchema,
  buildCreativeDirectionSchema,
  buildCreativeDirectionsPrompt,
  evaluateCreativeDirectionDiversity,
  evaluateConceptSelectionQuality,
  normalizeConceptSelection,
  normalizeCreativeDirections,
  selectRevisionChannel
};
