const memoryIndex = require("./memory.generated.json");

const STOP_WORDS = new Set([
  "and", "are", "for", "fra", "har", "med", "men", "skal", "som", "the", "this", "til", "that",
  "der", "det", "den", "din", "dit", "eller", "kan", "one", "our", "out", "with", "your", "campaign",
  "kampagne", "email", "meta", "blog", "html", "westpack"
]);

const CONCEPTS = {
  dealer: ["dealer", "forhandler", "reseller", "retailer", "distributor"],
  sale: ["sale", "discount", "offer", "rabat", "tilbud", "spar", "conversion"],
  education: ["education", "educational", "guide", "how", "saadan", "hvordan", "informativ"],
  seasonal: ["season", "seasonal", "saeson", "jul", "christmas", "autumn", "efteraar", "summer", "sommer"],
  product: ["product", "produkt", "packaging", "emballage", "smykke", "jewelry"],
  premium: ["premium", "luxury", "luksus", "brand", "branding"],
  business: ["business", "commercial", "margin", "revenue", "profit", "retail", "omsatning", "indtjening"]
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}

function referenceText(reference) {
  return [
    reference.title,
    reference.family,
    reference.campaignType,
    reference.funnelStage,
    reference.primaryGoal,
    reference.audience,
    reference.offer,
    ...(reference.themes || []),
    ...(reference.products || []),
    ...(reference.visualPatterns || []),
    ...(reference.copyPatterns || []),
    ...(reference.reusablePatterns || [])
  ].join(" ");
}

function inputText(input) {
  return [
    input?.title,
    input?.objective,
    input?.audience,
    input?.offer,
    input?.tone,
    input?.campaignType,
    input?.operatorNote,
    input?.source?.title,
    input?.source?.subject,
    input?.source?.body,
    ...(input?.assets || []),
    ...(input?.constraints || [])
  ].join(" ");
}

function scoreReference(reference, queryText, queryTokens) {
  const candidateText = normalizeText(referenceText(reference));
  const candidateTokens = tokenize(candidateText);
  let score = reference.owned ? 1.5 : 0.35;

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) score += token.length >= 7 ? 2.2 : 1.2;
  }

  for (const terms of Object.values(CONCEPTS)) {
    const queryMatches = terms.some((term) => queryText.includes(term));
    const referenceMatches = terms.some((term) => candidateText.includes(term));
    if (queryMatches && referenceMatches) score += 3;
  }

  if (reference.campaignType && queryText.includes(normalizeText(reference.campaignType))) score += 4;
  if (normalizeText(reference.title) && queryText.includes(normalizeText(reference.title))) score += 12;
  return score * (0.7 + Math.min(1, Number(reference.confidence || 0)) * 0.3);
}

function toPublicReference(reference, score) {
  return {
    id: reference.id,
    source: reference.sourceName,
    sourceType: reference.libraryType,
    imagePath: reference.imagePath,
    title: reference.title,
    family: reference.family,
    campaignType: reference.campaignType,
    relevance: Number(score.toFixed(2)),
    use: reference.owned ? "Brand and campaign pattern" : "Abstract design inspiration",
    primaryGoal: reference.primaryGoal,
    themes: (reference.themes || []).slice(0, 4),
    visualPatterns: (reference.visualPatterns || []).slice(0, 4),
    copyPatterns: (reference.copyPatterns || []).slice(0, 4),
    reusablePatterns: (reference.reusablePatterns || []).slice(0, 5)
  };
}

function selectCampaignMemoryReferences(input, options = {}) {
  const queryText = normalizeText(inputText(input));
  const queryTokens = tokenize(queryText);
  const scored = (memoryIndex.references || []).map((reference) => ({
    reference,
    score: scoreReference(reference, queryText, queryTokens)
  }));

  const pick = (owned, limit) => {
    const ranked = scored
      .filter((item) => Boolean(item.reference.owned) === owned)
      .sort((left, right) => right.score - left.score);
    const selected = [];
    const familyCounts = new Map();
    for (const item of ranked) {
      const familyKey = normalizeText(item.reference.family || item.reference.title || item.reference.id);
      const familyCount = familyCounts.get(familyKey) || 0;
      if (familyCount >= (owned ? 2 : 1)) continue;
      selected.push(item);
      familyCounts.set(familyKey, familyCount + 1);
      if (selected.length >= limit) break;
    }
    return selected.map((item) => toPublicReference(item.reference, item.score));
  };

  const ownedRoles = [
    "Closest campaign analogue",
    "Structure and pacing reference",
    "Image choreography reference",
    "CTA and conversion rhythm reference",
    "Brand voice reference"
  ];
  const owned = pick(true, Number(options.ownedLimit ?? 5)).map((reference, index) => ({
    ...reference,
    designRole: ownedRoles[index] || "Supporting owned pattern"
  }));
  const external = pick(false, Number(options.externalLimit ?? 1)).map((reference) => ({
    ...reference,
    designRole: "Secondary abstract layout inspiration"
  }));

  return [...owned, ...external];
}

function buildCampaignMemoryPromptBlock(references) {
  if (!Array.isArray(references) || !references.length) return "No campaign memory references are available.";
  return [
    "Curated Campaign Memory design brief for this campaign:",
    JSON.stringify(references),
    "Treat the owned Westpack references as primary evidence of the house style. Use each reference for its assigned designRole: extract hierarchy, module rhythm, image choreography, CTA cadence and tone, then adapt those principles to the locked brief.",
    "The highest-ranked owned reference is the campaign analogue, not a suggestion. The finished email must contain visible, campaign-appropriate evidence of the selected owned patterns and must not collapse into a generic template.",
    "Use external references only as secondary abstract layout and information-design inspiration when they improve the Westpack pattern; they must never overrule owned references.",
    "Never copy distinctive external wording, branded artwork, exact composition or unsupported performance claims.",
    "Synthesize the references into one decisive creative direction. Do not imitate a single email literally and do not produce a collage of unrelated patterns."
  ].join(" ");
}

module.exports = {
  buildCampaignMemoryPromptBlock,
  selectCampaignMemoryReferences
};
