const META_UK_LANGUAGE = "en_GB";
const META_CAROUSEL_MIN_CARDS = 3;
const META_CAROUSEL_MAX_CARDS = 6;

const DANISH_MARKERS = [
  /[\u00e6\u00f8\u00e5]/i,
  /\b(?:forhandler|butik|kunder|smykker|emballage|udvalg|bliv|vores|jeres|ikke|ogs\u00e5|p\u00e5)\b/i
];

const US_SPELLINGS = [
  ["color", "colour"],
  ["colors", "colours"],
  ["customize", "customise"],
  ["customized", "customised"],
  ["center", "centre"],
  ["centered", "centred"],
  ["jewelry", "jewellery"],
  ["favorite", "favourite"],
  ["organize", "organise"],
  ["personalized", "personalised"]
];

function normalizeCopy(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function collectMetaCarouselCopy(body = {}) {
  const strategy = body.creative_strategy || {};
  const attachments = Array.isArray(body.translated_attachments) ? body.translated_attachments : [];
  return [
    ["primary text", strategy.primary_text],
    ["headline", strategy.headline],
    ["description", strategy.description],
    ...attachments.flatMap((card, index) => [
      [`card ${index + 1} title`, card?.name],
      [`card ${index + 1} description`, card?.description]
    ])
  ].map(([label, value]) => [label, normalizeCopy(value)]);
}

function findUkEnglishCopyIssues(body = {}) {
  const issues = [];
  for (const [label, value] of collectMetaCarouselCopy(body)) {
    if (!value) {
      issues.push(`${label} is empty`);
      continue;
    }
    if (DANISH_MARKERS.some((pattern) => pattern.test(value))) {
      issues.push(`${label} appears to contain Danish copy`);
    }
    for (const [american, british] of US_SPELLINGS) {
      if (new RegExp(`\\b${american}\\b`, "i").test(value)) {
        issues.push(`${label} uses US spelling '${american}'; use '${british}'`);
      }
    }
  }
  return [...new Set(issues)];
}

function getSquareCarouselItems(body = {}) {
  const variants = Array.isArray(body.uploaded_carousel_variants) ? body.uploaded_carousel_variants : [];
  const square = variants.find((variant) => String(variant?.key || "").toLowerCase() === "square") || variants[0] || null;
  return Array.isArray(square?.items) ? square.items : [];
}

function assertCampaignStudioCarouselContract(body = {}) {
  if (body.campaign_studio_carousel !== true) return;
  if (String(body.target_language || "") !== META_UK_LANGUAGE) {
    throw new Error(`Campaign Studio Meta carousels must use ${META_UK_LANGUAGE} (UK English).`);
  }
  if (String(body.ad_format || "") !== "Carousel") {
    throw new Error("Campaign Studio Meta delivery only accepts carousel ads.");
  }
  if (body.approval_required !== true || body.publish_status !== "draft" || body.draft_only !== true) {
    throw new Error("Campaign Studio Meta delivery is draft-only and requires approval.");
  }
  const items = getSquareCarouselItems(body);
  const attachments = Array.isArray(body.translated_attachments) ? body.translated_attachments : [];
  const cardCountValid = items.length >= META_CAROUSEL_MIN_CARDS && items.length <= META_CAROUSEL_MAX_CARDS;
  if (!cardCountValid || attachments.length !== items.length) {
    throw new Error(`Campaign Studio Meta carousels require ${META_CAROUSEL_MIN_CARDS}-${META_CAROUSEL_MAX_CARDS} designed cards with matching copy.`);
  }
  const copyIssues = findUkEnglishCopyIssues(body);
  if (copyIssues.length) {
    throw new Error(`UK English copy check failed: ${copyIssues.join("; ")}.`);
  }
}

module.exports = {
  META_CAROUSEL_MAX_CARDS,
  META_CAROUSEL_MIN_CARDS,
  META_UK_LANGUAGE,
  assertCampaignStudioCarouselContract,
  collectMetaCarouselCopy,
  findUkEnglishCopyIssues,
  getSquareCarouselItems
};
