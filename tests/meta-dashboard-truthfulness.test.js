const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Nine figures on the Meta dashboard were wrong or invented. Each fix is pinned here,
// because every one of them was the kind of defect that reads as plausible: a status that
// always says the same thing, a change badge that always says nothing changed, a chart
// that disagrees with the number printed above it. None of them announce themselves.

const root = join(__dirname, "..");
const {
  buildLensStats,
  buildPresetRange,
  buildTrendCards,
  buildWindowChange,
  resolveTodayInTimeZone,
  buildQualityWarnings
} = require(join(root, "api", "meta", "account-snapshot.js")).__internals;

function campaign(overrides = {}) {
  const series = overrides.series || [];
  return {
    id: overrides.id || "1",
    name: overrides.name || "Campaign",
    objective: overrides.objective || "OUTCOME_AWARENESS",
    spend_value: 0,
    impressions_value: 0,
    reach_value: 0,
    clicks_value: 0,
    purchases_value: 0,
    revenue_value: 0,
    leads_value: 0,
    frequency_value: 0,
    series,
    comparison_window: overrides.comparison_window || { previous: [], current: series },
    ...overrides
  };
}

const scope = { since: "2026-08-11", until: "2026-09-09", label: "Last 30 days", shortLabel: "Last 30 days", days: 30 };

test("reach comes from Meta's deduplicated figure, not from adding campaigns together", () => {
  // Three awareness campaigns to overlapping audiences reported 4.5M, 4.2M and 3.5M
  // reach. Adding those counted everyone who saw two of them twice.
  const campaigns = [
    campaign({ id: "a", spend_value: 100, reach_value: 4530909, impressions_value: 10873637 }),
    campaign({ id: "b", spend_value: 100, reach_value: 4194571, impressions_value: 9210685 }),
    campaign({ id: "c", spend_value: 100, reach_value: 3509727, impressions_value: 7929399 })
  ];

  const summed = buildLensStats(campaigns, "awareness", scope, { currency: "DKK" });
  const summedReach = summed.find((stat) => stat.label === "Reach");
  assert.equal(summedReach.value, "12235207", "with no deduplicated figure the sum is all there is");
  assert.match(summedReach.meta, /counted twice/, "and it must say so rather than passing as a real count");

  const deduplicated = buildLensStats(campaigns, "awareness", scope, {
    currency: "DKK",
    deduplicatedReach: { reach: 6100000, impressions: 28013721 }
  });
  const realReach = deduplicated.find((stat) => stat.label === "Reach");
  assert.equal(realReach.value, "6100000");
  assert.match(realReach.meta, /deduplicated/);

  // Frequency has to use the same denominator, or it contradicts the reach beside it.
  const frequency = deduplicated.find((stat) => stat.label === "Frequency");
  assert.equal(frequency.value, (28013721 / 6100000).toFixed(2));
  assert.match(frequency.meta, /deduplicated/);
});

test("a rate sparkline divides summed totals instead of adding up per-campaign rates", () => {
  // Five campaigns at ROAS 2.0 on the same day used to plot a point at 10.0 while the
  // card's own headline read 2.0.
  const day = (date, spend, revenue) => ({ date, spend, revenue, impressions: 0, clicks: 0, purchases: 0, leads: 0, reach: 0, add_to_cart: 0 });
  const campaigns = Array.from({ length: 5 }, (unused, index) => campaign({
    id: `c${index}`,
    objective: "OUTCOME_SALES",
    spend_value: 100,
    revenue_value: 200,
    series: [day("2026-09-01", 100, 200)]
  }));

  const cards = buildTrendCards(campaigns, "general", scope, "DKK");
  const roasCard = cards.find((card) => card.title === "ROAS over time");
  assert.ok(roasCard, "the ROAS card is gone");

  const point = roasCard.series.find((entry) => entry.date === "2026-09-01");
  assert.equal(point.value, 2, "the chart must agree with the ratio, not multiply it by the campaign count");
  assert.equal(roasCard.value, "2.00", "and the headline must agree with the chart");
});

test("a change badge divides by the real baseline, however small it is", () => {
  // ROAS doubling from 0.50 to 1.00 rendered as +50% because the divisor was floored at
  // 1. CTR moving 0.80% to 1.20% rendered as +0.4% and was then called flat.
  const window = {
    previous: [{ date: "2026-08-01", spend: 200, revenue: 100, impressions: 10000, clicks: 80, purchases: 0, leads: 0, reach: 0, add_to_cart: 0 }],
    current: [{ date: "2026-09-01", spend: 200, revenue: 200, impressions: 10000, clicks: 120, purchases: 0, leads: 0, reach: 0, add_to_cart: 0 }]
  };

  const roas = buildWindowChange(window, "roas", { positiveDirection: "up" });
  assert.equal(roas.value, "+100.0%", "0.50 to 1.00 is a doubling");

  const ctr = buildWindowChange(window, "ctr", { positiveDirection: "up" });
  assert.equal(ctr.value, "+50.0%", "0.80% to 1.20% is a half again");
  assert.notEqual(ctr.direction, "flat", "and it is certainly not flat");
});

test("a preset range means today in the ad account timezone, not on the server", () => {
  // The account runs on America/Los_Angeles. At 06:00 UTC it is still the previous day
  // there, so a UTC-anchored range asked Meta for a day that had not started.
  const earlyMorningUtc = new Date("2026-09-09T06:00:00.000Z");
  const inLosAngeles = resolveTodayInTimeZone("America/Los_Angeles", earlyMorningUtc);
  const inUtc = resolveTodayInTimeZone("", earlyMorningUtc);

  assert.equal(inLosAngeles.toISOString().slice(0, 10), "2026-09-08");
  assert.equal(inUtc.toISOString().slice(0, 10), "2026-09-09");

  // And the preset builder has to actually use it.
  const today = buildPresetRange("today", "America/Los_Angeles");
  const utcToday = buildPresetRange("today", "");
  assert.equal(today.since, today.until, "a single day range");
  assert.ok(today.since <= utcToday.since, "the account's today can never be ahead of UTC's here");

  // An unknown timezone must fall back rather than throw.
  assert.doesNotThrow(() => buildPresetRange("today", "Not/AZone"));
});

test("an incremental lens that Meta does not measure separately says so", () => {
  // The three campaigns tagged Inkrementel are a deliberate grouping the marketing team
  // maintains, and it stays. What must not stand is presenting them as a measured uplift
  // when Meta returns the standard figures for the incrementality attribution window.
  const identical = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 11,
    campaignsWithPeriodDataCount: 11,
    incrementalLensCampaignCount: 3,
    incrementalMatchingStandardCount: 3,
    campaignSpendTotal: 249862,
    budgetAllocation: null
  });
  assert.ok(
    identical.some((warning) => /same purchases and revenue/.test(warning)),
    "the dashboard must disclose that the incremental lens is not a separate measurement"
  );

  const measured = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 11,
    campaignsWithPeriodDataCount: 11,
    incrementalLensCampaignCount: 3,
    incrementalMatchingStandardCount: 1,
    campaignSpendTotal: 249862,
    budgetAllocation: null
  });
  assert.ok(
    !measured.some((warning) => /same purchases and revenue/.test(warning)),
    "and it must stay quiet once Meta really does return different figures"
  );
});

test("campaign status is Meta's delivery state, never a fixed label", () => {
  const transformers = readFileSync(join(root, "server", "meta", "_snapshot-transformers.js"), "utf8");
  assert.ok(!/status: "Healthy"/.test(transformers), "the hard-coded status is back");
  assert.match(transformers, /status: describeDeliveryStatus\(campaign\)/);
  assert.match(transformers, /effective_status: campaign\.effective_status/);

  // The renderer must colour on Meta's raw state, not on a value the server never sends.
  const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
  assert.ok(!/status === 'Watch'/.test(ui), "the unreachable 'Watch' branch is back");
  assert.match(ui, /campaign\.effective_status/);
});

test("the daily series carries reach, so its change badge can be real", () => {
  // Without reach in the daily rows both windows summed to zero and every render
  // asserted "0.0% flat" for reach and frequency, which is a claim, not a gap.
  const fetchers = readFileSync(join(root, "server", "meta", "_snapshot-fetchers.js"), "utf8");
  const dailyBlock = fetchers.slice(fetchers.indexOf("insights_campaign_daily_cmp"));
  assert.match(dailyBlock.slice(0, 900), /"reach"/, "the daily campaign query must ask for reach");

  const transformers = readFileSync(join(root, "server", "meta", "_snapshot-transformers.js"), "utf8");
  const point = transformers.slice(transformers.indexOf("function buildMetricSeriesPoint"), transformers.indexOf("function buildInsightMap"));
  assert.match(point, /const reach = readNumber\(row\.reach/);
  assert.match(point, /^\s+reach,$/m, "and the series point must carry it");
});

test("the browser never falls back to a currency the account does not use", () => {
  // Budget normalisation fell back to DKK while the display path fell back to EUR, so a
  // failed lookup divided by 100 as kroner and printed the result with a euro sign.
  for (const file of ["app.js", "src/ui.js", join("api", "meta", "account-snapshot.js")]) {
    const source = readFileSync(join(root, file), "utf8");
    const dashboardEurFallbacks = source.match(/\|\| "EUR"|= "EUR"/g) || [];
    assert.deepEqual(dashboardEurFallbacks, [], `${file} still falls back to EUR`);
  }
});

test("no summing helper is handed an accessor that divides", () => {
  // buildSeriesTotals and buildComparisonSeriesTotals add their accessor's output across
  // campaigns, so an accessor that divides plots the sum of the ratios. Five campaigns at
  // ROAS 2.0 drew a point at 10.0 under a headline reading 2.0. The defect existed in the
  // server builders and again in their client copies, which is why a source guard earns
  // its place here: the two were written at different times and fixed at different times.
  //
  // A multi-statement accessor is the tell. The correct calls all pass a one-expression
  // accessor that just reads a field, and a rate goes through buildDerivedSeriesTotals,
  // which sums numerator and denominator separately.
  const files = ["app.js", join("api", "meta", "account-snapshot.js")];

  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    const offenders = [];
    const marker = /build(?:Comparison)?SeriesTotals\(/g;
    let match = marker.exec(source);

    while (match) {
      // The accessor begins immediately after the call, so only the parameter list and
      // arrow are allowed before its body. Scanning further ahead would pick up the next
      // card's headline expression, which divides quite legitimately.
      const head = source.slice(match.index + match[0].length, match.index + match[0].length + 70);
      const arrowBlock = head.match(/^\s*campaigns\s*,\s*\([^)]*\)\s*=>\s*\{/);

      if (arrowBlock) {
        const bodyStart = match.index + match[0].length + arrowBlock[0].length;
        let depth = 1;
        let cursor = bodyStart;
        while (cursor < source.length && depth > 0) {
          if (source[cursor] === "{") depth += 1;
          else if (source[cursor] === "}") depth -= 1;
          cursor += 1;
        }
        const body = source.slice(bodyStart, cursor - 1);
        if (body.includes("/") && !body.trimStart().startsWith("//")) {
          offenders.push(body.replace(/\s+/g, " ").trim().slice(0, 120));
        }
      }

      match = marker.exec(source);
    }

    assert.deepEqual(
      offenders,
      [],
      `${file} adds up a ratio across campaigns; pass numerator and denominator to buildDerivedSeriesTotals instead`
    );

    // And the helper that does it correctly has to still be in use here.
    assert.ok(
      source.includes("buildDerivedSeriesTotals("),
      `${file} no longer uses the derived-totals helper at all`
    );
  }
});
