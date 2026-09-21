const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// The KPI strip and the stat cards directly beneath it described the same metrics for the
// same period, and they disagreed. On the incremental lens the strip read 74 purchases
// and the card underneath read 78, on the same screen, at the same time.
//
// The cause was two implementations of one number: the strip summed the daily series
// while the cards summed the campaign totals, and the series only carries days Meta
// returned a row for. Fixing the arithmetic would have made them agree today and left
// them free to drift again tomorrow.
//
// So the duplication went instead. On every lens that has a stat row the strip was a
// strict subset of it - Spend, Purchases and ROAS on the conversion lenses, Spend, Reach
// and CPM on awareness, Spend, Leads and CPL on leads. General keeps its strip because
// General has no stat row, and because new customers belong at the top of the page.

const root = join(__dirname, "..");
const { buildHeroPanelItems, buildLensStats } = require(join(root, "api", "meta", "account-snapshot.js")).__internals;

const scope = { since: "2026-09-01", until: "2026-09-11", label: "This month", shortLabel: "This month", days: 11 };

function campaign(overrides = {}) {
  return {
    id: "1",
    name: "Campaign",
    objective: "OUTCOME_SALES",
    spend_value: 56428.94,
    impressions_value: 700000,
    reach_value: 250000,
    clicks_value: 4000,
    purchases_value: 78,
    revenue_value: 232000,
    leads_value: 12,
    frequency_value: 2.8,
    // Deliberately short of the campaign totals: one day of the range never came back
    // from Meta. This is the ordinary case, and it is what made the two panels disagree.
    series: [{ date: "2026-09-01", spend: 9000, impressions: 120000, reach: 40000, clicks: 700, add_to_cart: 0, purchases: 12, revenue: 48000, leads: 2 }],
    comparison_window: { previous: [], current: [] },
    ...overrides
  };
}

const LENSES_WITH_A_STAT_ROW = ["conversion_incremental", "conversion_standard", "leads", "awareness"];

function labelsOf(items) {
  return items.map((item) => String(item.label || "").replace(/ \(.*/, ""));
}

test("no metric is printed twice on one lens", () => {
  // This is the guarantee that replaces "the two panels must agree". Two panels that
  // never show the same figure cannot contradict each other.
  for (const lens of [...LENSES_WITH_A_STAT_ROW, "general"]) {
    const hero = labelsOf(buildHeroPanelItems([campaign()], lens, "DKK", scope, {}));
    const stats = labelsOf(buildLensStats([campaign()], lens, scope, { currency: "DKK" }));
    const both = hero.filter((label) => stats.includes(label));

    assert.deepEqual(both, [], `${lens} shows ${both.join(", ")} in both the KPI strip and the stat row`);
  }
});

test("the lenses with a stat row have no KPI strip at all", () => {
  for (const lens of LENSES_WITH_A_STAT_ROW) {
    assert.deepEqual(
      buildHeroPanelItems([campaign()], lens, "DKK", scope, {}),
      [],
      `${lens} has grown a KPI strip again, which is where the 74-versus-78 contradiction came from`
    );
    assert.ok(
      buildLensStats([campaign()], lens, scope, { currency: "DKK" }).length > 0,
      `${lens} has neither a strip nor a stat row, so it now shows no figures`
    );
  }
});

test("General keeps its strip, because General has no stat row", () => {
  const hero = labelsOf(buildHeroPanelItems([campaign()], "general", "DKK", scope, {}));
  assert.deepEqual(buildLensStats([campaign()], "general", scope, { currency: "DKK" }), []);

  // New customers first: it is the figure the department is measured on.
  assert.equal(hero[0], "New customers");
  assert.ok(hero.includes("Cost per new customer"));
});

test("the strip reads campaign totals, never the daily series", () => {
  // General's Spend sits on the same page as the budget panel's actual spend, so it has
  // to come from the same basis. A partial daily series would quietly under-report it.
  const hero = buildHeroPanelItems([campaign()], "general", "DKK", scope, {});
  const spend = hero.find((item) => item.label === "Spend");
  assert.ok(spend, "the strip has no Spend tile");
  // The formatted string is only the probe here; what is being tested is that Spend comes
  // from the campaign totals (56,428.94) and not from the shorter daily series. Money is
  // rendered in whole units in the reader's format, so the assertion reads the digits
  // rather than pinning one locale's punctuation.
  assert.equal(
    spend.value.replace(/[^0-9]/g, ""),
    "56429",
    "Spend is being summed from the partial series again"
  );

  const roas = hero.find((item) => item.label === "ROAS");
  assert.equal(roas.value, (232000 / 56428.94).toFixed(2), "ROAS must be summed revenue over summed spend");

  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  const start = handler.indexOf("function buildHeroPanelItems");
  const source = handler.slice(start, handler.indexOf("function buildValidationCheck", start));
  assert.ok(
    !/computeAggregateMetric\(series,/.test(source),
    "the strip is summing the daily series again, which the stat cards do not do"
  );
  for (const field of ["spend_value", "purchases_value", "revenue_value"]) {
    assert.ok(source.includes(`sumMetric(campaigns, "${field}")`), `the strip no longer reads ${field}`);
  }
});

test("an empty lens still produces no invented figures", () => {
  for (const lens of LENSES_WITH_A_STAT_ROW) {
    const stats = buildLensStats([], lens, scope, { currency: "DKK" });
    const cpa = stats.find((stat) => stat.label === "CPA");
    if (cpa) {
      assert.equal(cpa.value, "--", "spend over no purchases is not a cost per purchase");
    }
  }
});
