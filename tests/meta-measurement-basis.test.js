const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Every result on the dashboard is measured on Meta's incremental attribution, for every
// campaign and every period.
//
// Until 2026-10-01 the dashboard summed each ad set's own attribution setting. On this
// account that added incremental attribution, 7-day click + 1-day view and 7-day click +
// 1-day view + 1-day engaged view together, and the mix changed on 2026-09-09 and again on
// 2026-09-29 - so "new customers +37% August to September" was mostly the change of
// method. The same method in both months reads +9%.
//
// It also printed a warning that Meta "returns the same figures for the incrementality
// window as for standard". It was reading `value` from both queries. The entry below is
// what Meta actually returned for Conv - 04 - EU - Standard in September.

const root = join(__dirname, "..");
const {
  INCREMENTAL_ATTRIBUTION_WINDOWS,
  applyMeasurementBasis,
  applyMeasurementBasisToCollection,
  reportedEntries
} = require(join(root, "server", "meta", "measurement-basis.js"));
const { createMetaSnapshotFetchers } = require(join(root, "server", "meta", "_snapshot-fetchers.js"));

const LIVE_ROW = {
  campaign_id: "1",
  spend: "37475",
  actions: [
    { action_type: "omni_purchase", value: "471", "1d_view": "401", "7d_click": "70", incrementality: "136" },
    { action_type: "offsite_conversion.custom.775766277988531", value: "124", incrementality: "41" },
    // On-platform: no incrementality key, because nothing is attributed.
    { action_type: "lead", value: "12" }
  ],
  action_values: [
    { action_type: "omni_purchase", value: "1400167.29", incrementality: "331837.84" }
  ]
};

test("results read Meta's incremental figure, not the ad set's own setting", () => {
  const row = applyMeasurementBasis(LIVE_ROW);
  const purchase = row.actions.find((entry) => entry.action_type === "omni_purchase");
  assert.equal(purchase.value, "136");
  assert.equal(purchase.reported_value, "471");
  assert.equal(purchase.basis, "incrementality");
  assert.equal(row.action_values[0].value, "331837.84");
});

test("an incremental zero is a zero, not a reason to fall back", () => {
  const row = applyMeasurementBasis({ actions: [{ action_type: "omni_purchase", value: "4", incrementality: "0" }] });
  assert.equal(row.actions[0].value, "0");
});

test("on-platform actions keep Meta's figure and say so", () => {
  const lead = applyMeasurementBasis(LIVE_ROW).actions.find((entry) => entry.action_type === "lead");
  assert.equal(lead.value, "12");
  assert.equal(lead.basis, "reported");
});

test("normalising twice changes nothing, so a cached row is safe", () => {
  const once = applyMeasurementBasis(LIVE_ROW);
  assert.deepEqual(applyMeasurementBasis(once), once);
  const collection = applyMeasurementBasisToCollection({ data: [LIVE_ROW], pageCount: 1 });
  assert.equal(collection.pageCount, 1);
  assert.equal(collection.data[0].actions[0].value, "136");
});

test("the reported figure can still be read back for the column that shows it", () => {
  const reported = reportedEntries(applyMeasurementBasis(LIVE_ROW).actions);
  assert.equal(reported.find((entry) => entry.action_type === "omni_purchase").value, "471");
});

test("every query that reads results asks for the incremental window, and is normalised", async () => {
  const calls = [];
  const fetchers = createMetaSnapshotFetchers({
    buildMetaResourceCacheKey: (name, parts) => `${name}:${parts.join(":")}`,
    getCachedMetaCollection: async ({ cacheKey, fetcher }) => fetcher().then((result) => ({ ...result, cacheKey })),
    metaGetAll: async (path, token, params) => {
      calls.push(params);
      return { data: [LIVE_ROW], pageCount: 1 };
    }
  });
  const dateScope = { since: "2026-09-02", until: "2026-10-01" };
  const campaign = await fetchers.fetchCampaignInsightsCollections({ accountId: "act_1", accessToken: "t", dateScope, comparisonDateScope: dateScope });
  const adSets = await fetchers.fetchAwarenessAdSetInsightsCollections({ accountId: "act_1", accessToken: "t", dateScope, comparisonDateScope: dateScope });
  const acquisition = await fetchers.fetchCustomerAcquisitionTrend({ accountId: "act_1", accessToken: "t", trendWindow: { since: "2026-07-01", until: "2026-10-01" }, today: "2026-10-01" });

  // Two campaign queries, two ad-set queries, two acquisition queries. The two separate
  // incrementality queries that used to run beside the campaign ones are gone.
  assert.equal(calls.length, 6);
  for (const params of calls) {
    assert.equal(params.action_attribution_windows, INCREMENTAL_ATTRIBUTION_WINDOWS);
  }
  for (const collection of [campaign.aggregatedInsightsResponse, campaign.dailyInsightsResponse, adSets.aggregatedAdSetInsightsResponse, adSets.dailyAdSetInsightsResponse, acquisition]) {
    assert.equal(collection.data[0].actions[0].value, "136");
  }
  assert.equal(Object.keys(campaign).length, 2);
});

test("asking for the setting must not drag in every campaign that ever existed", () => {
  // `attribution_setting` is configuration, so Meta returns a row for every campaign on
  // the account whether or not it delivered: 358 rows, of which 343 were empty.
  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  const filter = handler.slice(
    handler.indexOf("const aggregatedInsightsResponse = {"),
    handler.indexOf("New customers is the KPI the marketing team is measured on")
  );
  assert.ok(filter.length > 0, "the empty-row filter is gone");
  for (const signal of ["spend", "impressions", "inline_link_clicks", "actions"]) {
    assert.ok(filter.includes(signal), `the filter does not consider ${signal}`);
  }
});

test("nothing classifies campaigns as incremental or standard any more", () => {
  const sources = [
    ["api", "meta", "account-snapshot.js"],
    ["server", "meta", "_snapshot-dashboard.js"],
    ["server", "meta", "_snapshot-transformers.js"],
    ["server", "meta", "budget-allocation.js"],
    ["app.js"],
    ["src", "ui.js"],
    ["index.html"]
  ];
  for (const parts of sources) {
    const source = readFileSync(join(root, ...parts), "utf8");
    for (const legacy of ["conversion_incremental", "conversion_standard", "hasIncrementalNameTag", "incremental_matches_standard", "buildIncrementalLensCampaigns", "same purchases and revenue"]) {
      assert.ok(!source.includes(legacy), `${parts.join("/")} still carries ${legacy}`);
    }
  }
});
