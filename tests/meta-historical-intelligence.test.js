const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCreativeDna,
  buildPerformanceExemplars,
  buildMetaIntelligencePromptBlock,
  dateRange,
  extractCreative,
  inferFeatures,
  metricRow
} = require("../server/meta/historical-intelligence");

test("historical creative extraction preserves carousel copy and stable image hashes", () => {
  const creative = extractCreative({
    id: "creative-1",
    object_story_spec: {
      link_data: {
        message: "Explore premium jewellery packaging.",
        name: "Packaging with presence",
        child_attachments: Array.from({ length: 5 }, (_, index) => ({
          name: `Card ${index + 1}`,
          image_hash: `hash-${index + 1}`
        }))
      }
    }
  });
  assert.equal(creative.format, "carousel");
  assert.equal(creative.primaryText, "Explore premium jewellery packaging.");
  assert.equal(creative.cards.length, 5);
  assert.equal(creative.cards[0].imageHash, "hash-1");
});

test("metrics derive comparable rates from raw totals", () => {
  const metrics = metricRow({
    spend: "100",
    impressions: "10000",
    inline_link_clicks: "200",
    actions: [{ action_type: "purchase", value: "10" }],
    action_values: [{ action_type: "purchase", value: "400" }]
  });
  assert.equal(metrics.ctr, 2);
  assert.equal(metrics.cpc, 0.5);
  assert.equal(metrics.cpm, 10);
  assert.equal(metrics.roas, 4);
});

test("Creative DNA compares only eligible ads inside objective and format cohorts", () => {
  const ads = Array.from({ length: 8 }, (_, index) => {
    const ad = {
      objective: "OUTCOME_SALES",
      creative: { format: "carousel", primaryText: "Premium retail presentation", headline: "Packaging with presence" },
      metrics: { impressions: 5000, spend: 100, roas: index + 1, ctr: 1 + index / 10, cpc: 1, cpm: 20 }
    };
    ad.features = inferFeatures(ad);
    return ad;
  });
  const dna = buildCreativeDna(ads);
  assert.equal(dna.eligibleAds, 8);
  assert.equal(dna.cohorts, 1);
  assert.ok(dna.topPatterns.some((pattern) => pattern.feature === "format_carousel"));
  assert.match(dna.methodology, /never treated as causal/i);
  assert.match(buildMetaIntelligencePromptBlock({ range: dateRange(365), coverage: {}, dna }), /performance associations/i);
  const exemplars = buildPerformanceExemplars(ads);
  assert.ok(exemplars.length > 0);
  assert.equal(exemplars[0].format, "carousel");
});

test("historical range is bounded to protect Meta and serverless execution", () => {
  assert.equal(dateRange(1).days, 30);
  assert.equal(dateRange(5000).days, 730);
});
