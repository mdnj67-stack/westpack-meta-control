const test = require("node:test");
const assert = require("node:assert/strict");
const {
  META_CAROUSEL_MAX_CARDS,
  META_CAROUSEL_MIN_CARDS,
  META_UK_LANGUAGE,
  assertCampaignStudioCarouselContract,
  findUkEnglishCopyIssues
} = require("../server/campaign/meta-carousel-contract");

function buildPayload(overrides = {}, cardCount = META_CAROUSEL_MIN_CARDS) {
  return {
    campaign_studio_carousel: true,
    draft_only: true,
    approval_required: true,
    publish_status: "draft",
    target_language: META_UK_LANGUAGE,
    ad_format: "Carousel",
    creative_strategy: {
      primary_text: "Give every detail a presentation worthy of it.",
      headline: "Packaging with presence",
      description: "Explore premium packaging for modern retailers."
    },
    translated_attachments: Array.from({ length: cardCount }, (_, index) => ({
      name: `A stronger presentation ${index + 1}`,
      description: "Designed for a polished retail experience."
    })),
    uploaded_carousel_variants: [{
      key: "square",
      items: Array.from({ length: cardCount }, (_, index) => ({ name: `card-${index + 1}.jpg` }))
    }],
    ...overrides
  };
}

test("Campaign Studio carousel contract accepts three through six UK English cards", () => {
  for (let count = META_CAROUSEL_MIN_CARDS; count <= META_CAROUSEL_MAX_CARDS; count += 1) {
    assert.doesNotThrow(() => assertCampaignStudioCarouselContract(buildPayload({}, count)));
  }
});

test("Campaign Studio carousel contract rejects non-UK language and incomplete carousels", () => {
  assert.throws(() => assertCampaignStudioCarouselContract(buildPayload({ target_language: "da" })), /en_GB/);
  assert.throws(() => assertCampaignStudioCarouselContract(buildPayload({
    uploaded_carousel_variants: [{ key: "square", items: [{ name: "one.jpg" }] }]
  })), /3-6/);
  assert.throws(() => assertCampaignStudioCarouselContract(buildPayload({}, META_CAROUSEL_MAX_CARDS + 1)), /3-6/);
});

test("UK English copy check catches Danish and common US spellings", () => {
  const payload = buildPayload();
  payload.creative_strategy.primary_text = "Bliv forhandler og se vores jewelry colors.";
  const issues = findUkEnglishCopyIssues(payload);
  assert.ok(issues.some((issue) => issue.includes("Danish")));
  assert.ok(issues.some((issue) => issue.includes("jewelry")));
  assert.ok(issues.some((issue) => issue.includes("colors")));
});
