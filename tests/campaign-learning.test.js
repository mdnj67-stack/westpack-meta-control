const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCampaignLearningPromptBlock,
  buildCampaignLearningEffectiveness,
  buildCampaignPerformanceAttribution,
  collectArtifactSignals,
  compareCampaignArtifacts,
  deriveCampaignLearningPatterns,
  relevanceScore
} = require("../server/campaign/campaign-learning");

function artifact(overrides = {}) {
  return {
    input: { title: "W34: Bliv WTP forhandler", campaignType: "partner recruitment" },
    artifacts: {
      email: {
        subject: "Become a WTP retailer",
        previewText: "A premium partnership",
        visualDirection: "Scandinavian editorial",
        heroLayout: "split",
        sections: [
          { moduleId: "editorial_text", headline: "A better presentation", body: "Build perceived value.", imageUrl: "" },
          { moduleId: "image_left", headline: "Made for retail", body: "Create a stronger store.", imageUrl: "https://example.test/image.jpg" }
        ]
      },
      meta: { campaignAngle: "Premium retail", primaryText: "Build a better experience.", headline: "Become a retailer" },
      blog: { title: "Retail presentation", excerpt: "A practical guide", bodyHtml: "<p>Useful guidance.</p>" },
      ...overrides
    }
  };
}

test("collectArtifactSignals keeps structured choices and excludes full HTML payloads", () => {
  const signals = collectArtifactSignals(artifact());
  assert.equal(signals["email.subject"], "Become a WTP retailer");
  assert.equal(signals["email.sections.1.hasImage"], "true");
  assert.equal(signals["blog.bodyText"], "Useful guidance.");
  assert.equal(Object.keys(signals).some((path) => path.includes("bodyHtml")), false);
});

test("compareCampaignArtifacts distinguishes retained, changed, removed and added decisions", () => {
  const original = artifact();
  const edited = artifact();
  edited.artifacts.email.subject = "Make every customer experience count";
  edited.artifacts.email.sections[1].imageUrl = "";
  edited.artifacts.meta.description = "A considered retail partnership.";
  delete edited.artifacts.blog.excerpt;

  const diff = compareCampaignArtifacts(original, edited);
  assert.ok(diff.totals.retained > 0);
  assert.ok(diff.changedPaths.includes("email.subject"));
  assert.ok(diff.changedPaths.includes("email.sections.1.hasImage"));
  assert.ok(diff.addedPaths.includes("meta.description"));
  assert.ok(diff.removedPaths.includes("blog.excerpt"));
  assert.equal(diff.finalSelections.emailImageCount, 0);
});

test("learning prompt separates approval, rejection and performance evidence", () => {
  const events = [
    {
      type: "klaviyo_draft_created",
      channel: "email",
      campaignName: "W34 retailer",
      evidenceLevel: "human_approved_draft_handoff",
      createdAt: "2026-07-22T10:00:00.000Z",
      diff: { totals: { changed: 2 }, changedExamples: [{ path: "email.subject", before: "A", after: "B" }] }
    },
    {
      type: "rejected",
      channel: "cross_channel",
      campaignName: "W34 retailer",
      reason: "The visual hierarchy is too generic.",
      evidenceLevel: "negative_human_decision",
      createdAt: "2026-07-22T11:00:00.000Z"
    },
    {
      type: "performance_snapshot",
      channel: "email",
      campaignName: "Klaviyo cohort",
      performance: { campaigns: [{ campaignName: "W33", cohortPosition: "strong" }] },
      evidenceLevel: "observed_channel_performance",
      createdAt: "2026-07-22T12:00:00.000Z"
    }
  ];
  const block = buildCampaignLearningPromptBlock(events, { title: "W34 retailer" }, "email");
  assert.match(block, /human_approved_draft_handoff/);
  assert.match(block, /visual hierarchy is too generic/);
  assert.match(block, /cohortPosition/);
  assert.match(block, /evidence, not unconditional rules/);
});

test("relevance favours same-channel and campaign-specific learning", () => {
  const matching = relevanceScore({ channel: "email", campaignName: "W34 retailer" }, { title: "W34 retailer" }, "email");
  const unrelated = relevanceScore({ channel: "meta", campaignName: "Summer sale" }, { title: "W34 retailer" }, "email");
  assert.ok(matching > unrelated);
});

test("a preference only becomes an established rule across three campaigns", () => {
  const buildEvent = (index, moderationStatus = "active") => ({
    id: `event-${index}`,
    type: "klaviyo_draft_created",
    channel: "email",
    campaignName: `Campaign ${index}`,
    moderationStatus,
    createdAt: `2026-07-${String(10 + index).padStart(2, "0")}T10:00:00.000Z`,
    diff: {
      changedExamples: [{ path: "email.heroLayout", before: "stacked", after: "split" }],
      removedPaths: [],
      finalSelections: { emailHeroLayout: "split" }
    }
  });
  const developing = deriveCampaignLearningPatterns([buildEvent(1), buildEvent(2)]);
  assert.equal(developing.some((pattern) => pattern.mayActAsRule), false);
  const established = deriveCampaignLearningPatterns([buildEvent(1), buildEvent(2), buildEvent(3), buildEvent(4, "disabled")]);
  const layout = established.find((pattern) => pattern.path === "email.heroLayout");
  assert.equal(layout.mayActAsRule, true);
  assert.equal(layout.campaignCount, 3);
  assert.equal(layout.maturity, "established");
});

test("effectiveness reports a trend only after enough measured decisions", () => {
  const events = Array.from({ length: 7 }, (_, index) => ({
    id: `decision-${index}`,
    type: index === 6 ? "klaviyo_draft_created" : "editor_saved",
    channel: "email",
    campaignName: `Campaign ${index}`,
    moderationStatus: "active",
    createdAt: `2026-07-${String(10 + index).padStart(2, "0")}T10:00:00.000Z`,
    diff: { totals: { changed: Math.max(1, 8 - index), added: 0, removed: 0, retained: 20 } },
    outcome: { qualityReviews: 2, productionRevisions: 1 }
  }));
  const result = buildCampaignLearningEffectiveness(events);
  assert.equal(result.trendReady, true);
  assert.ok(result.manualChangeDeltaPercent < 0);
  assert.equal(result.draftHandoffs, 1);
  assert.equal(result.averageQualityReviews, 2);
});

test("performance is linked to reviewed creative decisions without claiming causation", () => {
  const events = [
    {
      id: "draft-w34",
      type: "klaviyo_draft_created",
      channel: "email",
      campaignName: "W34: Bliv WTP forhandler",
      moderationStatus: "approved",
      diff: { changedExamples: [{ path: "email.subject", before: "Old", after: "New" }], finalSelections: { emailHeroLayout: "split" } }
    },
    {
      id: "performance",
      type: "performance_snapshot",
      channel: "email",
      campaignName: "Klaviyo cohort",
      moderationStatus: "active",
      performance: { campaigns: [{ campaignName: "W34 retailer", cohortPosition: "strong", sent: 2000, clickRate: 2.8, revenuePerRecipient: 4.2 }] }
    }
  ];
  const attribution = buildCampaignPerformanceAttribution(events);
  assert.equal(attribution.length, 1);
  assert.equal(attribution[0].attributionConfidence, "strong_name_match");
  assert.equal(attribution[0].linkedDecisions[0].finalSelections.emailHeroLayout, "split");
  assert.match(attribution[0].caveat, /Association only/);
});
