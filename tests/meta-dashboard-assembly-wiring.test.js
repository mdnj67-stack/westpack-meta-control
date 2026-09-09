const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");

// The unit tests for the corrected figures call the builders directly, which proves the
// maths but not the plumbing. Meta's deduplicated reach travels from a fetcher, through
// the handler, into the dashboard assembly, and out to three different panels; a fix that
// is right in buildLensStats and never reaches it is still a wrong number on screen.
//
// So this drives buildSnapshotDashboardAssembly end to end with a shape modelled on the
// real Westpack account: three awareness campaigns whose reach sums far above the
// account's deduplicated figure, three conversion campaigns tagged Inkrementel whose
// incrementality metrics equal their standard ones, and one lead campaign.

const root = join(__dirname, "..");
const { buildSnapshotDashboardAssembly } = require(join(root, "api", "meta", "account-snapshot.js")).__internals;

const DATE_SCOPE = {
  since: "2026-08-11",
  until: "2026-09-09",
  label: "Last 30 days",
  shortLabel: "Last 30 days",
  days: 30
};

function series(spend, reach) {
  return [
    { date: "2026-09-01", spend, impressions: spend * 40, reach, clicks: 10, add_to_cart: 0, purchases: 1, revenue: spend * 2, leads: 0 },
    { date: "2026-09-02", spend, impressions: spend * 40, reach, clicks: 10, add_to_cart: 0, purchases: 1, revenue: spend * 2, leads: 0 }
  ];
}

function campaign(overrides) {
  const points = series(overrides.spend_value || 100, overrides.reach_value || 1000);
  return {
    market: "",
    currency: "DKK",
    status: "Active",
    effective_status: "ACTIVE",
    impressions_value: 0,
    reach_value: 0,
    frequency_value: 0,
    cpm_value: 0,
    clicks_value: 0,
    ctr_value: 0,
    add_to_cart_value: 0,
    purchases_value: 0,
    revenue_value: 0,
    roas_value: 0,
    cpa_value: 0,
    leads_value: 0,
    cpl_value: 0,
    series: points,
    comparison_window: { previous: series(90, 900), current: points },
    incremental_metrics_available: true,
    incremental_matches_standard: false,
    adset_names: [],
    adset_attribution_specs: [],
    ...overrides
  };
}

// Reach values taken from the live account, where three awareness campaigns reported
// 4.53M, 4.19M and 3.51M and their sum was 12.24M.
const AWARENESS_REACH = [4530909, 4194571, 3509727];
const SUMMED_AWARENESS_REACH = AWARENESS_REACH.reduce((sum, value) => sum + value, 0);
const DEDUPLICATED_AWARENESS_REACH = 6100000;

function buildCampaigns() {
  const awareness = AWARENESS_REACH.map((reach, index) => campaign({
    id: `aw${index}`,
    name: `BA-0${index + 1} - Awareness`,
    objective: "OUTCOME_AWARENESS",
    category: "awareness",
    spend_value: 33000,
    reach_value: reach,
    impressions_value: reach * 2.2,
    attribution_mode: "standard",
    attribution_explicit: false
  }));

  const incremental = [1, 2, 3].map((n) => campaign({
    id: `inc${n}`,
    name: `Conv - 0${n} - Product - Inkrementel`,
    objective: "OUTCOME_SALES",
    category: "conversion",
    spend_value: 33000,
    reach_value: 240000,
    impressions_value: 1000000,
    purchases_value: 70,
    revenue_value: 190000,
    roas_value: 5.7,
    // Meta hands back the standard figures for the incrementality window on this account.
    incremental_purchases_value: 70,
    incremental_revenue_value: 190000,
    incremental_matches_standard: true,
    attribution_mode: "incremental",
    attribution_explicit: true
  }));

  const leads = [campaign({
    id: "lead1",
    name: "AW26 - Kick-off - Lead",
    objective: "OUTCOME_LEADS",
    category: "leads",
    spend_value: 2400,
    reach_value: 17762,
    impressions_value: 27400,
    leads_value: 21,
    attribution_mode: "standard",
    attribution_explicit: false
  })];

  return [...awareness, ...incremental, ...leads];
}

function assemble(deduplicatedReach) {
  const campaigns = buildCampaigns();
  const totalSpend = campaigns.reduce((sum, item) => sum + item.spend_value, 0);

  return buildSnapshotDashboardAssembly({
    enrichedCampaigns: campaigns,
    includedCampaigns: campaigns,
    adSets: [],
    activeAds: [],
    budgetCampaignsRaw: campaigns.map((item) => ({ ...item, daily_budget: 100000 })),
    budgetAdSets: [],
    adSetsByCampaignId: new Map(),
    budgetNormalization: { divisor: 100, currency: "DKK", confidence: "exact", reason: "exact" },
    customerConversionActionTypes: { newCustomerActionTypes: [], existingCustomerActionTypes: [], resolved: { new: [], existing: [] }, available: false },
    acquisitionTrendRows: [],
    accountTimezone: "America/Los_Angeles",
    deduplicatedReach,
    awarenessUsingAdSetInsights: 0,
    totalSpend,
    dateScope: DATE_SCOPE,
    accountCurrency: "DKK",
    activeCampaigns: campaigns,
    campaignResponse: { data: campaigns, pageCount: 1 },
    aggregatedInsightsResponse: { pageCount: 1 },
    dailyInsightsResponse: { pageCount: 1 },
    adSetsResponse: { pageCount: 1 },
    aggregatedAdSetInsightsResponse: { pageCount: 0 },
    dailyAdSetInsightsResponse: { pageCount: 0 },
    adsResponse: { pageCount: 1 },
    incrementalInsightsAvailable: true,
    timings: {},
    buildScheduleDiagnostics: () => ({})
  });
}

test("the deduplicated reach reaches the awareness stat row, not just the fetcher", () => {
  const { dashboard } = assemble({
    account: { reach: 9000000, impressions: 30000000, frequency: 3.3 },
    awareness: { reach: DEDUPLICATED_AWARENESS_REACH, impressions: SUMMED_AWARENESS_REACH * 2.2 }
  });

  const reachStat = dashboard.statsByLens.awareness.find((stat) => stat.label === "Reach");
  assert.ok(reachStat, "the awareness lens has no reach stat");
  assert.equal(Number(reachStat.value), DEDUPLICATED_AWARENESS_REACH);
  assert.notEqual(Number(reachStat.value), SUMMED_AWARENESS_REACH, "the summed figure is back");
  assert.match(reachStat.meta, /deduplicated/);

  // And it must be reported in the payload so the data quality panel can show its source.
  assert.equal(dashboard.quality.deduplicatedReach.awareness.reach, DEDUPLICATED_AWARENESS_REACH);
});

test("without a deduplicated figure the summed one is shown and labelled as a sum", () => {
  const { dashboard } = assemble({ account: null, awareness: null });

  const reachStat = dashboard.statsByLens.awareness.find((stat) => stat.label === "Reach");
  assert.equal(Number(reachStat.value), SUMMED_AWARENESS_REACH);
  assert.match(reachStat.meta, /counted twice/, "a sum has to say it is a sum");
});

test("General ships no stat row and still passes its own validation", () => {
  const { dashboard } = assemble({ account: null, awareness: null });

  assert.deepEqual(dashboard.statsByLens.general, [], "General's figures belong to the budget panel");

  const lensCoverage = dashboard.quality.validation.checks.find((check) => check.id === "lens-coverage");
  assert.ok(lensCoverage, "the lens coverage check is gone");
  assert.equal(lensCoverage.status, "pass", `a correct dashboard reported itself invalid: ${lensCoverage.detail}`);
  assert.equal(dashboard.quality.validation.failCount, 0, JSON.stringify(dashboard.quality.validation.checks.filter((c) => c.status !== "pass")));
});

test("an incremental lens Meta does not measure separately is disclosed in the warnings", () => {
  const { dashboard } = assemble({ account: null, awareness: null });

  assert.equal(dashboard.quality.attributionValidation.incrementalCount, 3);
  assert.equal(dashboard.quality.attributionValidation.incrementalMatchingStandardCount, 3);
  assert.ok(
    dashboard.quality.warnings.some((warning) => /same purchases and revenue/.test(warning)),
    `no disclosure among: ${JSON.stringify(dashboard.quality.warnings)}`
  );
});

test("the payload no longer carries the lens summaries nothing read", () => {
  const { dashboard } = assemble({ account: null, awareness: null });
  assert.equal(dashboard.summaryByLens, undefined);
});
