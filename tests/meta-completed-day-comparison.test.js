const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");

// On 1 October the General view read "Spend 2.013 kr. -84.4% vs previous day" and "ROAS
// -49.4% vs previous day". "This month" on the first is one day, today, which was a few
// hours old in the ad account's timezone; the previous window was all of 30 September.
// The badge measured the clock, not the account.
//
// Directly beneath, the new-customer panel read 0 for "this month so far" while the
// strip above it read 4. Both count 1 October, but the panel's daily series sat behind a
// three-hour cache on the assumption that its days were finished - and today is not.

const root = join(__dirname, "..");
const { buildHeroPanelItems, buildTrendCards, buildLensStats } = require(join(root, "api", "meta", "account-snapshot.js")).__internals;
const { createMetaSnapshotFetchers } = require(join(root, "server", "meta", "_snapshot-fetchers.js"));

function point(date, spend, revenue) {
  return { date, spend, impressions: spend * 100, reach: spend * 50, clicks: 10, add_to_cart: 0, purchases: 1, revenue, leads: 0 };
}

function campaign(current, previous) {
  const sum = (key) => current.reduce((total, item) => total + item[key], 0);
  return {
    id: "1",
    name: "Conv - 04 - EU - Standard",
    objective: "OUTCOME_SALES",
    category: "conversion",
    spend_value: sum("spend"),
    revenue_value: sum("revenue"),
    impressions_value: sum("impressions"),
    reach_value: sum("reach"),
    clicks_value: sum("clicks"),
    purchases_value: sum("purchases"),
    leads_value: 0,
    series: current,
    comparison_window: { previous, current }
  };
}

const firstOfMonth = { since: "2026-10-01", until: "2026-10-01", today: "2026-10-01", label: "This month", shortLabel: "This month", days: 1 };

test("a range that is only today carries no change badge", () => {
  const campaigns = [campaign([point("2026-10-01", 2013, 10434)], [point("2026-09-30", 12900, 132000)])];

  const hero = buildHeroPanelItems(campaigns, "general", "DKK", firstOfMonth, {});
  for (const label of ["Spend", "ROAS"]) {
    assert.equal(hero.find((item) => item.label === label).change, null, `${label} compared an unfinished day`);
  }

  const cards = buildTrendCards(campaigns, "general", firstOfMonth, "DKK");
  for (const card of cards.filter((item) => item.kind !== "objective-bars")) {
    assert.equal(card.change, null, `${card.title} compared an unfinished day`);
    // The drawn series still shows today.
    assert.equal(card.series.length, 1);
  }

  const stats = buildLensStats(campaigns, "conversion_standard", firstOfMonth, { currency: "DKK" });
  assert.ok(stats.every((item) => !item.change), "a stat card compared an unfinished day");
});

test("later in the month, only completed days are compared, over equal windows", () => {
  const scope = { since: "2026-10-01", until: "2026-10-03", today: "2026-10-03", label: "This month", shortLabel: "This month", days: 3 };
  // Two complete days at 1,000 a day, then a partial today. The two days before the month
  // also ran at 1,000. A whole-range comparison would read this as growth or decline
  // depending on the hour; completed days alone are flat.
  const current = [point("2026-10-01", 1000, 5000), point("2026-10-02", 1000, 5000), point("2026-10-03", 150, 600)];
  const previous = [point("2026-09-28", 1000, 5000), point("2026-09-29", 1000, 5000), point("2026-09-30", 1000, 5000)];
  const campaigns = [campaign(current, previous)];

  const spend = buildHeroPanelItems(campaigns, "general", "DKK", scope, {}).find((item) => item.label === "Spend");
  assert.equal(spend.change.value, "0.0%");
  assert.match(spend.change.label, /2 days, today excluded/);
  // The headline is still the whole range, today included.
  assert.equal(spend.value.replace(/\D/g, ""), "2150");

  const card = buildTrendCards(campaigns, "general", scope, "DKK").find((item) => item.title === "Spend over time");
  assert.equal(card.change.direction, "flat");
  assert.equal(card.series.length, 3);
});

test("a range that ended before today is compared whole", () => {
  const scope = { since: "2026-09-30", until: "2026-09-30", today: "2026-10-01", label: "Yesterday", shortLabel: "Yesterday", days: 1 };
  const campaigns = [campaign([point("2026-09-30", 1200, 6000)], [point("2026-09-29", 1000, 5000)])];

  const spend = buildHeroPanelItems(campaigns, "general", "DKK", scope, {}).find((item) => item.label === "Spend");
  assert.equal(spend.change.value, "+20.0%");
  assert.doesNotMatch(spend.change.label, /today excluded/);
});

test("the new-customer series fetches today on the strip's cache, not the finished days' cache", async () => {
  const requests = [];
  const fetchers = createMetaSnapshotFetchers({
    buildMetaResourceCacheKey: (name, parts) => `${name}:${parts.join(":")}`,
    getCachedMetaCollection: async ({ cacheKey, maxAgeMs, fetcher }) => {
      requests.push({ cacheKey, maxAgeMs });
      return fetcher();
    },
    metaGetAll: async (path, token, params) => {
      const { since } = JSON.parse(params.time_range);
      return { data: [{ date_start: since }], pageCount: 1 };
    }
  });

  const result = await fetchers.fetchCustomerAcquisitionTrend({
    accountId: "act_1",
    accessToken: "token",
    trendWindow: { since: "2026-07-01", until: "2026-10-01" },
    today: "2026-10-01",
    insightsCacheMaxAgeMs: 3 * 60 * 60 * 1000,
    todayCacheMaxAgeMs: 15 * 60 * 1000
  });

  const completed = requests.find((request) => request.cacheKey.includes("completed"));
  const today = requests.find((request) => request.cacheKey.includes("today"));
  assert.equal(completed.maxAgeMs, 3 * 60 * 60 * 1000);
  assert.match(completed.cacheKey, /2026-09-30$/, "the long-cached query must stop at yesterday");
  assert.equal(today.maxAgeMs, 15 * 60 * 1000);
  assert.deepEqual(result.data.map((row) => row.date_start), ["2026-07-01", "2026-10-01"]);
});
