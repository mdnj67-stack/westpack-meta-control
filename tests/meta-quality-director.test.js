const test = require("node:test");
const assert = require("node:assert/strict");
const {
  META_CREATIVE_DIMENSIONS,
  META_CREATIVE_PASS_SCORE,
  buildMetaCreativeReviewPrompt,
  buildMetaCreativeReviewSchema,
  normalizeMetaCreativeReview
} = require("../server/campaign/meta-quality-director");

test("Meta Creative Director reviews six visual dimensions and three to six finished cards", () => {
  const schema = buildMetaCreativeReviewSchema();
  assert.equal(schema.properties.dimensions.minItems, 6);
  assert.equal(schema.properties.cardReviews.minItems, 3);
  assert.equal(schema.properties.cardReviews.maxItems, 6);
  assert.deepEqual(schema.properties.dimensions.items.properties.key.enum, META_CREATIVE_DIMENSIONS);
  const prompt = buildMetaCreativeReviewPrompt({
    campaign: { selectedRouteId: "editorial" },
    renderedImages: Array.from({ length: 3 }, (_, index) => `data:image/jpeg;base64,card${index}`)
  });
  assert.equal(prompt[1].content.filter((item) => item.type === "input_image").length, 3);
  assert.match(prompt[0].content[0].text, /actual mobile Meta advertising/i);
});

test("Meta quality gate requires 90 overall and every dimension at least 80", () => {
  const buildReview = (floor) => ({
    verdict: "PASS",
    overallScore: 94,
    criticalFailures: [],
    dimensions: META_CREATIVE_DIMENSIONS.map((key, index) => ({ key, score: index ? 92 : floor, assessment: "Evidence", evidence: ["Card"], improvement: "" }))
  });
  assert.equal(normalizeMetaCreativeReview(buildReview(80)).passed, true);
  const failed = normalizeMetaCreativeReview(buildReview(79));
  assert.equal(failed.passed, false);
  assert.equal(failed.verdict, "REVISE");
  assert.equal(failed.dimensionFloor, 79);
});

test("reported Meta creative scores are calibrated against the dimension average", () => {
  const inflated = {
    verdict: "PASS",
    overallScore: 95,
    criticalFailures: [],
    dimensions: META_CREATIVE_DIMENSIONS.map((key, index) => ({ key, score: index % 2 ? 80 : 81, assessment: "Evidence", evidence: ["Card"], improvement: "" }))
  };
  const result = normalizeMetaCreativeReview(inflated);
  assert.equal(result.passed, false);
  assert.ok(result.overallScore < META_CREATIVE_PASS_SCORE);
  assert.equal(result.overallScore, 81);
  assert.equal(result.reportedScore, 95);
});
