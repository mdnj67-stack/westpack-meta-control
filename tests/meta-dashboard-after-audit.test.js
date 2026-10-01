const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");

// Behaviour fixed after the 2026-10-01 audit of the Meta dashboard. Each test names the
// defect it stops from coming back.

const root = join(__dirname, "..");
const {
  buildPresetRange,
  buildLensStats,
  buildGeneralSpendDistribution,
  buildTrendCards,
  buildSnapshotDashboardAssembly
} = require(join(root, "api", "meta", "account-snapshot.js")).__internals;
const { calculateBudgetAllocation } = require(join(root, "server", "meta", "budget-allocation.js"));

function point(date, spend, extra = {}) {
  return { date, spend, impressions: spend * 100, reach: spend * 40, clicks: 10, add_to_cart: 0, purchases: 1, revenue: spend * 3, leads: 0, ...extra };
}

test("the rolling presets end yesterday, as Ads Manager's do", () => {
  // They ended today, so a few hours of the current day counted as a day, and "Last 30
  // days" here was a different window from "Last 30 days" in the new-customer panel.
  for (const [preset, days] of [["last_7d", 7], ["last_14d", 14], ["last_30d", 30]]) {
    const today = buildPresetRange("today", "America/Los_Angeles").since;
    const range = buildPresetRange(preset, "America/Los_Angeles");
    assert.ok(range.until < today, `${preset} still includes today`);
    const span = Math.round((Date.parse(range.until) - Date.parse(range.since)) / 86400000) + 1;
    assert.equal(span, days);
  }
});

test("campaigns paused before the range still count in the previous period", () => {
  // The comparison used to cover only campaigns that exist now, so moving money from an
  // old campaign to a new one read as growth.
  const scope = { since: "2026-09-08", until: "2026-09-14", days: 7, label: "Last 7 days", shortLabel: "Last 7 days", today: "2026-09-15" };
  const current = [point("2026-09-08", 1000)];
  const live = { id: "new", objective: "OUTCOME_SALES", category: "conversion", spend_value: 1000, purchases_value: 1, revenue_value: 3000, series: current, comparison_window: { current, previous: [] } };
  const retired = { id: "old", objective: "OUTCOME_SALES", category: "conversion", spend_value: 0, series: [], previous_only: true, comparison_window: { current: [], previous: [point("2026-09-01", 1000)] } };

  const without = buildLensStats([live], "conversion", scope, { currency: "DKK" });
  const withRetired = buildLensStats([live], "conversion", scope, { currency: "DKK", previousOnlyCampaigns: [retired] });
  assert.equal(without[0].change.value, "New", "on its own the new campaign looks like growth from nothing");
  assert.equal(withRetired[0].change.value, "0,0%", "with the campaign it replaced, spend is flat");
  // And the retired campaign never reaches a current figure.
  assert.equal(withRetired[0].value.replace(/\D/g, ""), "1000");
});

test("there is no pace before the first finished day", () => {
  // On the first of the month a few hours of spend times 30 read as far under budget.
  const scope = { since: "2026-10-01", until: "2026-10-01", days: 1, label: "This month", shortLabel: "This month", today: "2026-10-01" };
  const campaign = { id: "c1", objective: "OUTCOME_SALES", spend_value: 2000, series: [point("2026-10-01", 2000)] };
  const split = buildGeneralSpendDistribution([campaign], scope, "DKK", calculateBudgetAllocation([{ id: "c1", objective: "OUTCOME_SALES", daily_budget: 10000 }], [], 1));
  assert.equal(split.totalPacePercentage, null);
  assert.equal(split.items[0].pacePercentage, null);
});

test("pace on a range that includes today uses the finished days only", () => {
  const scope = { since: "2026-10-01", until: "2026-10-03", days: 3, label: "This month", shortLabel: "This month", today: "2026-10-03" };
  const campaign = {
    id: "c1", objective: "OUTCOME_SALES", spend_value: 2150,
    series: [point("2026-10-01", 1000), point("2026-10-02", 1000), point("2026-10-03", 150)]
  };
  const split = buildGeneralSpendDistribution([campaign], scope, "DKK", calculateBudgetAllocation([{ id: "c1", objective: "OUTCOME_SALES", daily_budget: 1000 }], [], 3));
  // Two finished days at 1,000 against a 1,000/day budget is exactly on pace.
  assert.equal(split.paceDays, 2);
  assert.equal(split.totalPacePercentage, 100);
});

test("objective shares are of the whole account and drawn to scale", () => {
  const scope = { since: "2026-09-24", until: "2026-09-30", days: 7, label: "Last 7 days", shortLabel: "Last 7 days", today: "2026-10-01" };
  const campaigns = [
    { id: "a", objective: "OUTCOME_SALES", spend_value: 9800, revenue_value: 30000, series: [] },
    { id: "b", objective: "OUTCOME_AWARENESS", spend_value: 100, impressions_value: 10000, series: [] },
    { id: "c", objective: "OUTCOME_TRAFFIC", spend_value: 100, series: [] }
  ];
  const card = buildTrendCards(campaigns, "general", scope, "DKK").find((item) => item.kind === "objective-bars");
  const awareness = card.rows.find((row) => row.key === "awareness");
  assert.equal(awareness.share, "1,0%", "a share of all spend, traffic included");
  assert.equal(awareness.width, 1, "a 1% objective is drawn 1% wide, not 12%");
  assert.ok(card.rows.some((row) => row.key === "traffic"), "objectives beyond the three lenses are not dropped");
  // Efficiency from campaign totals, not the daily series (which is empty here).
  assert.equal(card.rows.find((row) => row.key === "conversion").metricValue, "3,06");
});

// Dates relative to today, because the new-customer rows are only read inside the window
// the handler fetches, which is measured back from the real date.
function shiftIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function assemble(overrides = {}) {
  const range = buildPresetRange("last_7d", "America/Los_Angeles");
  const today = shiftIso(range.until, 1);
  const scope = { since: range.since, until: range.until, days: 7, label: "Last 7 days", shortLabel: "Last 7 days", today };
  const campaign = {
    id: "c1", name: "Conv - 01 - DE", objective: "OUTCOME_SALES", category: "conversion",
    spend_value: 7000, purchases_value: 7, revenue_value: 21000, new_customers_value: 16,
    series: [point(range.since, 1000)], comparison_window: { current: [point(range.since, 1000)], previous: [point(shiftIso(range.since, -7), 1000)] }
  };
  const newCustomerType = "offsite_conversion.custom.775766277988531";
  const rows = [];
  for (let offset = -7; offset < 7; offset += 1) {
    rows.push({ date_start: shiftIso(range.since, offset), spend: "1000", actions: [{ action_type: newCustomerType, value: offset >= 0 ? "2" : "3" }], action_values: [] });
  }
  return buildSnapshotDashboardAssembly({
    enrichedCampaigns: [campaign],
    includedCampaigns: [campaign],
    budgetNormalization: { divisor: 100, currency: "DKK", confidence: "exact" },
    customerConversionActionTypes: { newCustomerActionTypes: [newCustomerType], existingCustomerActionTypes: [], available: true, resolved: { new: [], existing: [] } },
    acquisitionTrendRows: rows,
    accountTimezone: "America/Los_Angeles",
    deduplicatedReach: { account: { spend: 7000 } },
    totalSpend: 7000,
    dateScope: scope,
    accountCurrency: "DKK",
    campaignResponse: { pageCount: 1 },
    aggregatedInsightsResponse: { pageCount: 1 },
    dailyInsightsResponse: { pageCount: 1 },
    adSetsResponse: { pageCount: 1 },
    aggregatedAdSetInsightsResponse: { pageCount: 1 },
    dailyAdSetInsightsResponse: { pageCount: 1 },
    adsResponse: { pageCount: 1 },
    timings: {},
    buildScheduleDiagnostics: () => ({}),
    ...overrides
  });
}

test("the strip's new-customer count is the panel's number for the same days", () => {
  // The strip summed campaign rows (16), the panel summed account rows (14 here); once
  // both read "Last 7 days" they had to agree.
  const { dashboard } = assemble();
  const tile = dashboard.visuals.heroPanelByLens.general.find((item) => item.label === "New customers");
  assert.equal(tile.value, "14");
  assert.equal(tile.change.label, "vs previous 7 days");
  assert.equal(tile.change.value, "-33,3%", "14 against 21 over the seven days before");
});

test("a failed new-customer read is reported, not shown as zeros", () => {
  const { dashboard } = assemble({ acquisitionTrendRows: [], acquisitionTrendUnavailable: true });
  assert.equal(dashboard.quality.customerAcquisition.trend.available, false);
  assert.ok(dashboard.quality.warnings.some((warning) => /could not be read from Meta/.test(warning)));
  const tile = dashboard.visuals.heroPanelByLens.general.find((item) => item.label === "New customers");
  assert.equal(tile.change, null, "no badge computed from rows that never arrived");
});

test("spend is checked against the account, and a gap fails the check", () => {
  const ok = assemble();
  assert.equal(ok.dashboard.quality.validation.checks.find((check) => check.id === "account-spend").status, "pass");
  const gap = assemble({ deduplicatedReach: { account: { spend: 9000 } } });
  assert.equal(gap.dashboard.quality.validation.checks.find((check) => check.id === "account-spend").status, "fail");
  assert.ok(gap.dashboard.quality.warnings.some((warning) => /account reports/.test(warning)));
});
