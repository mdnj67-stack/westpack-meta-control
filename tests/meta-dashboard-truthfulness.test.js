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
  // Only the server builds series now. The browser copies were deleted, which is a
  // stronger guarantee than getting them right - a copy can only ever agree with the
  // server by coincidence, and this same defect had to be fixed in both of them.
  const files = [join("api", "meta", "account-snapshot.js")];

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

  // The browser must not start computing series again. Every figure on the dashboard is
  // computed once, on the server, and rendered here or reported as not synced.
  const app = readFileSync(join(root, "app.js"), "utf8");
  for (const builder of [
    "function buildSeriesTotals",
    "function buildDerivedSeriesTotals",
    "function buildAggregateSeries",
    "function buildTrendCards",
    "function buildOverviewCards",
    "function buildGeneralSpendDistribution",
    "function buildDashboardStatsV2"
  ]) {
    assert.ok(!app.includes(builder), `app.js has grown a second copy of ${builder.replace("function ", "")}`);
  }
});

test("a change inside the neutral band prints as flat, not as a rounded minus", () => {
  // Cost per new customer moved by -0.0036% on the live account. That rounded to "-0.0%",
  // which reads as a fall while the badge beside it was coloured neutral and labelled
  // flat: three signals disagreeing about one number.
  const window = {
    previous: [{ date: "2026-08-01", spend: 1000, revenue: 2000, impressions: 10000, clicks: 100, purchases: 10, leads: 0, reach: 0, add_to_cart: 0 }],
    current: [{ date: "2026-09-01", spend: 1000, revenue: 2000.01, impressions: 10000, clicks: 100, purchases: 10, leads: 0, reach: 0, add_to_cart: 0 }]
  };

  const change = buildWindowChange(window, "roas", { positiveDirection: "up" });
  assert.equal(change.direction, "flat");
  assert.equal(change.tone, "neutral");
  assert.equal(change.value, "0.0%", "a flat badge must not carry a sign");

  // A real move still keeps its sign in both directions.
  const realWindow = {
    previous: [{ date: "2026-08-01", spend: 1000, revenue: 1000, impressions: 0, clicks: 0, purchases: 0, leads: 0, reach: 0, add_to_cart: 0 }],
    current: [{ date: "2026-09-01", spend: 1000, revenue: 1500, impressions: 0, clicks: 0, purchases: 0, leads: 0, reach: 0, add_to_cart: 0 }]
  };
  assert.equal(buildWindowChange(realWindow, "roas", { positiveDirection: "up" }).value, "+50.0%");
});

test("the awareness series carries reach through its ad-set rebuild", () => {
  // Awareness campaigns have their daily series rebuilt from their ad sets, and that
  // rebuild dropped reach. So the one lens where reach is the headline was the one lens
  // whose reach change badge could never read anything but "0.0% flat" - verified against
  // the live account after the campaign-level query had already been fixed.
  const fetchers = readFileSync(join(root, "server", "meta", "_snapshot-fetchers.js"), "utf8");
  const adsetDaily = fetchers.slice(fetchers.indexOf("insights_adset_daily_cmp"));
  assert.match(adsetDaily.slice(0, 900), /"reach"/, "the ad-set daily query must ask for reach");

  const transformers = readFileSync(join(root, "server", "meta", "_snapshot-transformers.js"), "utf8");
  const rebuild = transformers.slice(
    transformers.indexOf("const seriesTotals"),
    transformers.indexOf("series = sortSeries(Array.from(seriesTotals")
  );
  assert.ok(rebuild.length > 0, "the ad-set series rebuild is gone");
  assert.match(rebuild, /reach: current\.reach \+ readNumber\(point\.reach, 0\)/, "the rebuild drops reach again");
  assert.match(rebuild, /reach: 0,/, "the accumulator has no reach slot");
});

test("a degraded ad-set daily query does not wipe the awareness trend", () => {
  // The ad-set daily query is optional and returns an empty list when the account is
  // throttled. Its aggregated sibling can still succeed, and when it did, the awareness
  // override replaced each campaign's daily series with a rebuild of nothing - so the
  // awareness lens lost its trend entirely even though the campaign-level daily series
  // had come back fine. Seen on the live account: eight of eleven campaigns had a series
  // and the three missing ones were exactly the awareness set.
  const transformers = readFileSync(join(root, "server", "meta", "_snapshot-transformers.js"), "utf8");
  const override = transformers.slice(
    transformers.indexOf("const seriesTotals"),
    transformers.indexOf("const roas = spend > 0")
  );
  assert.ok(override.length > 0, "the awareness override is gone");

  assert.match(override, /const rebuiltSeries = sortSeries/, "the rebuild is being assigned unconditionally again");
  assert.match(override, /if \(rebuiltSeries\.length\) \{\s*series = rebuiltSeries;/);
  assert.ok(
    !/^\s+series = sortSeries\(Array\.from\(seriesTotals/m.test(override),
    "an empty rebuild can still overwrite the campaign series"
  );
});

test("the dashboard is never seeded with invented campaigns", () => {
  // The bundled demo set - five campaigns that have never existed on this
  // account, priced in euros, each carrying the hard-coded "Healthy" status
  // corrected everywhere else - was the initial value of appState and the
  // fallback on the boot render. It painted the dashboard and the Studio's
  // publish targets on every page load until the live read landed, which on
  // this account takes about 55 seconds.
  const app = readFileSync(join(root, "app.js"), "utf8");

  assert.match(app, /const appState = \{\s*\n\s*ads: \[\],\s*\n\s*adSets: \[\],\s*\n\s*campaigns: \[\],/);

  // And the demo constants are no longer pulled in at all, so they cannot come
  // back as a fallback somewhere else.
  const dataImport = app.slice(0, app.indexOf('} from "./src/data.js'));
  for (const name of ["\n  ads,", "\n  adSets,", "\n  campaigns,", "\n  stats"]) {
    assert.ok(!dataImport.includes(name), `app.js still imports the demo ${name.trim()} from src/data.js`);
  }
});

test("a read still in flight is not reported as a read that failed", () => {
  // "The campaign list loaded but the computed figures did not" was shown for
  // the whole of every page load, because the snapshot takes about a minute and
  // nothing distinguished waiting from failing.
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(app, /metaSnapshotLoading: false,/);
  assert.match(app, /appState\.metaSnapshotLoading = true;/);
  assert.match(app, /appState\.metaSnapshotLoading = false;/);
  assert.match(app, /!dashboardFiguresSynced && appState\.metaSnapshotLoading/);
  assert.match(app, /headline: "Reading the figures from Meta"/);
});

test("an empty series draws no path at all, rather than an invalid one", () => {
  // buildLinePath returns an empty string when there are no points, and the
  // Klaviyo trend dropped it straight into d="", producing d=" L 696 164 L 24
  // 164 Z" - rejected by the browser, three console errors on every page load.
  const app = readFileSync(join(root, "app.js"), "utf8");
  const chart = readFileSync(join(root, "src", "chart.js"), "utf8");

  // The concatenation is gone rather than guarded: this chart is drawn by the shared
  // system now, which decides for itself whether there is anything to draw. Nothing may
  // build a d attribute by pasting a path that can be empty into a string again.
  const concatenations = app.split("\n").filter((line) => /d="\$\{[a-zA-Z]*[Pp]ath\} /.test(line));
  assert.deepEqual(concatenations, [], "a raw path concatenation is back in app.js");

  // The system returns an empty state instead of an svg when there is no geometry, so
  // the invalid-path case cannot be reached at all.
  assert.match(
    chart,
    /if \(!geometry \|\| !geometry\.current\.length\) \{\s*\n\s*return `<div class="wp-chart-empty"/,
    "timeSeriesChart no longer bails out before drawing an empty series"
  );

  // And there is still something on screen when there is nothing to draw.
  assert.match(app, /No readings in this range|No points in this range/);
});
