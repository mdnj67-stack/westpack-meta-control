const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// One number per period for new customers, everywhere on the dashboard.
//
// Meta's incremental figure is a model evaluated per query, not a counter, so it does not
// add up across days. Measured on the live account for 1-6 October 2026, all on the same
// incremental basis:
//
//   six daily account figures, summed      37   (what the panel used to print)
//   the account, asked for the six days    39
//   the campaigns, asked for the six days  40   (what every campaign table prints)
//
// The panel and the strip printed the daily sum while the tables beneath them printed the
// campaigns' period figures, so the tables never added up to the headline. The rule now:
// a period's figure is the campaigns' own Meta figures for that period, summed - the same
// rows as the tables. The daily series only draws the chart.

const root = join(__dirname, "..");
const {
  buildCustomerAcquisitionWindows,
  indexWindowTotals,
  listAcquisitionWindows,
  resolveAcquisitionWindowPresets,
  resolveCustomerConversionActionTypes
} = require(join(root, "server", "meta", "customer-acquisition.js"));
const { applyMeasurementBasis } = require(join(root, "server", "meta", "measurement-basis.js"));
const { createMetaSnapshotFetchers } = require(join(root, "server", "meta", "_snapshot-fetchers.js"));

const NEW_TYPE = "offsite_conversion.custom.775766277988531";
const EXISTING_TYPE = "offsite_conversion.custom.573537871687880";
const actionTypes = resolveCustomerConversionActionTypes([
  { id: "775766277988531", name: "New_customer" },
  { id: "573537871687880", name: "Existing_customer" }
]);
const TZ = "America/Los_Angeles";
// 7 October in the account timezone, the day the figures above were read.
const NOW = new Date("2026-10-07T20:00:00Z");

// Rows as Meta returns them, before normalisation: `value` is each ad set's own setting,
// `incrementality` is the figure the dashboard reads.
function liveRow({ campaign = "", since, until = since, newValue, newIncremental, spend = "0" }) {
  return applyMeasurementBasis({
    campaign_id: campaign,
    date_start: since,
    date_stop: until,
    spend,
    actions: [{ action_type: NEW_TYPE, value: String(newValue), incrementality: String(newIncremental) }],
    action_values: []
  });
}

// The account's daily rows for 1-6 October, exactly as read on 2026-10-07.
const DAILY = [
  ["2026-10-01", 20, 6], ["2026-10-02", 11, 6], ["2026-10-03", 9, 6],
  ["2026-10-04", 12, 6], ["2026-10-05", 17, 4], ["2026-10-06", 22, 9]
].map(([since, newValue, newIncremental]) => liveRow({ since, newValue, newIncremental }));

// The campaigns' own figures for 1-6 October as one period, as read the same day.
const OCTOBER_WINDOW = [
  ["Conv - 01 - DE", 5], ["Conv - 02 - FR", 5], ["Conv - 03 - IT", 7],
  ["Conv - 04 - EU - Standard", 22], ["BA - Reach", 1]
].map(([campaign, newIncremental]) => liveRow({
  campaign, since: "2026-10-01", until: "2026-10-06", newValue: newIncremental * 2, newIncremental, spend: "17146.93"
}));

test("a period's figure is the campaigns' figure for that period, not the sum of its days", () => {
  const daySum = DAILY.reduce((sum, row) => sum + Number(row.actions[0].value), 0);
  assert.equal(daySum, 37, "the fixture reproduces the daily sum the panel used to print");

  const windows = buildCustomerAcquisitionWindows({
    dailyRows: DAILY,
    windowRows: OCTOBER_WINDOW,
    actionTypes,
    now: NOW,
    timeZone: TZ
  });
  const monthToDate = windows.presets.find((preset) => preset.key === "month_to_date");
  assert.equal(monthToDate.current.since, "2026-10-01");
  assert.equal(monthToDate.current.until, "2026-10-06");
  assert.equal(monthToDate.current.newCustomers, 40);
  // The chart still draws the days as Meta reported them.
  assert.equal(monthToDate.current.dailyNewCustomers.length, 6);
  assert.equal(monthToDate.current.dailyNewCustomers[5].value, 9);
});

test("window rows are summed per campaign, on the incremental figure", () => {
  const index = indexWindowTotals(OCTOBER_WINDOW, actionTypes);
  const totals = index.get("2026-10-01..2026-10-06");
  assert.equal(totals.newCustomers, 40, "incrementality, not the ad sets' own 80");
  assert.equal(Math.round(totals.spend), Math.round(17146.93 * 5));
  assert.equal(index.size, 1);
});

test("a window Meta returned no rows for is a real zero, because the call succeeded", () => {
  const windows = buildCustomerAcquisitionWindows({
    dailyRows: [], windowRows: [], actionTypes, now: NOW, timeZone: TZ
  });
  assert.equal(windows.available, true);
  assert.equal(windows.presets[0].current.newCustomers, 0);
});

test("without window rows there is no figure, never a fallback to summing days", () => {
  const windows = buildCustomerAcquisitionWindows({
    dailyRows: DAILY, actionTypes, now: NOW, timeZone: TZ
  });
  assert.equal(windows.available, false);
  for (const preset of windows.presets) {
    assert.equal(preset.direction, "unknown");
    assert.equal(preset.current.newCustomers, 0, "no day sum leaks in as a figure");
  }
});

test("the fetch asks for every window the panel, today and the strip's badges read", () => {
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  const extra = [{ since: "2026-09-30", until: "2026-10-06" }, { since: "2026-09-23", until: "2026-09-29" }];
  const windows = listAcquisitionWindows(resolved, extra);
  const keys = new Set(windows.map((window) => `${window.since}..${window.until}`));

  for (const preset of resolved.presets) {
    assert.ok(keys.has(`${preset.current.since}..${preset.current.until}`), `${preset.key} current`);
    assert.ok(keys.has(`${preset.previous.since}..${preset.previous.until}`), `${preset.key} previous`);
  }
  assert.ok(keys.has("2026-10-07..2026-10-07"), "today, reported on its own");
  for (const window of extra) assert.ok(keys.has(`${window.since}..${window.until}`));
  assert.equal(keys.size, windows.length, "no window is asked for twice");
});

test("the window fetch is one time_ranges call per cache class, on the incremental basis", async () => {
  const calls = [];
  const caches = [];
  const fetchers = createMetaSnapshotFetchers({
    buildMetaResourceCacheKey: (name, parts) => `${name}:${parts.join(":")}`,
    // Both calls run in parallel, so the cache settings are recorded before the fetch
    // starts; `fetcher()` then pushes its params synchronously at the same index.
    getCachedMetaCollection: ({ cacheKey, maxAgeMs, fetcher }) => {
      caches.push({ cacheKey, maxAgeMs });
      return fetcher();
    },
    metaGetAll: async (path, token, params) => {
      calls.push({ params });
      const ranges = JSON.parse(params.time_ranges);
      return {
        data: ranges.map(({ since, until }) => ({
          campaign_id: "c1", date_start: since, date_stop: until, spend: "10",
          actions: [{ action_type: NEW_TYPE, value: "9", incrementality: "4" }]
        })),
        pageCount: 1
      };
    }
  });

  const result = await fetchers.fetchCustomerAcquisitionWindowTotals({
    accountId: "act_1",
    accessToken: "t",
    windows: [
      { since: "2026-10-01", until: "2026-10-06" },
      { since: "2026-09-01", until: "2026-09-06" },
      { since: "2026-10-01", until: "2026-10-07" },
      { since: "2026-10-07", until: "2026-10-07" }
    ],
    today: "2026-10-07",
    insightsCacheMaxAgeMs: 3 * 60 * 60 * 1000,
    todayCacheMaxAgeMs: 15 * 60 * 1000
  });

  assert.equal(calls.length, 2, "finished windows and live windows, one call each");
  for (const { params } of calls) {
    assert.equal(params.level, "campaign");
    assert.equal(params.action_attribution_windows, JSON.stringify(["incrementality"]));
    assert.ok(!("time_increment" in params), "periods, never days");
  }
  const [completed, live] = calls;
  assert.equal(JSON.parse(completed.params.time_ranges).length, 2);
  assert.equal(caches[0].maxAgeMs, 3 * 60 * 60 * 1000);
  assert.equal(JSON.parse(live.params.time_ranges).length, 2, "every window that includes today");
  assert.equal(caches[1].maxAgeMs, 15 * 60 * 1000);
  assert.notEqual(caches[0].cacheKey.split(":")[0], caches[1].cacheKey.split(":")[0], "separate cache entries");
  assert.equal(result.data.length, 4);
  assert.equal(result.data[0].actions[0].value, "4", "rows are normalised to the incremental figure");
});

test("the strip and the badges no longer read a sum of daily rows", () => {
  const dashboard = readFileSync(join(root, "server", "meta", "_snapshot-dashboard.js"), "utf8");
  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  assert.doesNotMatch(dashboard, /rangeTotals/);
  assert.doesNotMatch(handler, /rangeTotals/);
  assert.match(dashboard, /windowRows: acquisitionWindowRows/);
  assert.match(dashboard, /windowTotals: indexWindowTotals\(acquisitionWindowRows/);
});
