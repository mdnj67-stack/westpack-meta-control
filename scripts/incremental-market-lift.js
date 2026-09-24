/**
 * Market-level lift check for the incremental conversion campaigns.
 *
 * Why this exists
 * ---------------
 * `Conv - 01 - DE`, `Conv - 02 - FR` and `Conv - 03 - IT` run with
 * `is_incremental_attribution_enabled: true`. Such a campaign deliberately avoids the
 * conversions that would have happened anyway - which is exactly what standard attribution
 * counts. So its attributed ROAS is biased downwards by construction, and comparing it with a
 * standard-attribution campaign (or with its own pre-switch history, which was standard) measures
 * the measurement method rather than the campaign. See the memory
 * `never-compare-across-attribution-settings`.
 *
 * The only honest read available without a Meta Conversion Lift study is a market-level
 * difference-in-differences on real Magento orders, read from Klaviyo: did the markets that got
 * the extra money grow relative to the markets that did not? No Meta attribution is involved at
 * any point.
 *
 * A difference-in-differences is only valid if the two groups tracked each other before the
 * change, so the script prints the weekly pre-trend and refuses to give a verdict if the ratio
 * was unstable.
 *
 * Usage
 * -----
 *   node scripts/incremental-market-lift.js
 *   node scripts/incremental-market-lift.js --post-until=2026-10-01
 *
 * The post window should end at least 7 days before today, because the campaigns attribute on a
 * 7-day click window and the most recent days are always under-reported. The script warns when
 * the window is too fresh.
 */

const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));

const GRAPH_BASE = "https://graph.facebook.com/v25.0";
const KLAVIYO_REVISION = "2024-10-15";

// The three markets that were switched to incremental attribution and had their budgets raised
// on 2026-09-09.
const TREATMENT = ["DE", "FR", "IT"];
// Markets covered by `Conv - 04 - EU - Standard`, which was left on standard attribution. They
// are the control group. `Conv - 04` explicitly excludes DE/FR/IT, so the groups do not overlap.
const CONTROL = ["NL", "DK", "SE", "PL", "ES", "FI", "EU"];

// The switch happened on 2026-09-09. The pre window is deliberately long: the confidence interval
// on the ratio is driven by the smaller of the two windows, so a short baseline wastes power.
const DEFAULTS = {
  preSince: "2026-07-14",
  preUntil: "2026-09-08",
  postSince: "2026-09-09"
};

// Pre-committed decision thresholds, set before the data was in so the verdict cannot be
// rationalised afterwards. `baselineRatio` is recomputed from the actual pre window; these are
// the relative moves against it.
const THRESHOLDS = {
  // Roughly break-even for the extra spend at ~40% contribution margin. Confirm the margin before
  // trusting this number - at 25% it rises to about +15%, at 55% it falls to about +6%.
  payingForItself: 0.096,
  // Anything below this is inside the noise band of a window this size.
  noDetectableEffect: 0.03
};

function parseArgs(argv) {
  return argv.slice(2).reduce((acc, arg) => {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) acc[match[1]] = match[2];
    return acc;
  }, {});
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

async function graphGet(pathname, params, token) {
  const url = new URL(`${GRAPH_BASE}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  url.searchParams.set("access_token", token);

  const rows = [];
  let next = url.toString();
  let pages = 0;
  while (next && pages < 10) {
    const response = await fetch(next);
    const payload = await response.json();
    if (payload.error) {
      // Rate limits are never retried here, same rule as the snapshot path.
      throw new Error(`Meta ${payload.error.code}: ${payload.error.message}`);
    }
    rows.push(...(payload.data || []));
    pages += 1;
    next = payload.paging && payload.paging.next ? payload.paging.next : null;
  }
  return rows;
}

async function klaviyoOrderCounts(market, privateKey, since, until, interval = "day") {
  const headers = {
    Authorization: `Klaviyo-API-Key ${privateKey}`,
    accept: "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
    revision: KLAVIYO_REVISION
  };

  const metricsResponse = await fetch("https://a.klaviyo.com/api/metrics/", { headers });
  const metrics = await metricsResponse.json();
  if (!metricsResponse.ok) {
    throw new Error(`Klaviyo ${market} metrics ${metricsResponse.status}`);
  }
  const placedOrder = (metrics.data || []).find((m) => m.attributes.name === "Placed Order");
  if (!placedOrder) return null;

  const body = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: placedOrder.id,
        measurements: ["count", "sum_value"],
        interval,
        page_size: 500,
        timezone: "Europe/Copenhagen",
        filter: [
          `greater-or-equal(datetime,${since}T00:00:00Z)`,
          `less-than(datetime,${until}T00:00:00Z)`
        ]
      }
    }
  };

  const response = await fetch("https://a.klaviyo.com/api/metric-aggregates/", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Klaviyo ${market} aggregate ${response.status}`);
  }

  const attributes = payload.data.attributes;
  const counts = attributes.data[0].measurements.count || [];
  return attributes.dates.reduce((acc, date, index) => {
    acc[date.slice(0, 10)] = counts[index] || 0;
    return acc;
  }, {});
}

function sumWindow(series, since, until) {
  return Object.entries(series || {})
    .filter(([date]) => date >= since && date <= until)
    .reduce((total, [, value]) => total + value, 0);
}

/**
 * Relative standard error of a ratio of two Poisson counts, propagated across the two windows.
 * This is what decides whether a move is a finding or noise.
 */
function ratioChangeStandardError(preT, preC, postT, postC) {
  const safe = (n) => (n > 0 ? 1 / n : 0);
  return Math.sqrt(safe(preT) + safe(preC) + safe(postT) + safe(postC));
}

async function main() {
  const args = parseArgs(process.argv);
  const config = getConfig();
  const token = config.metaAccessToken;
  const accountId = config.metaAdAccountId.startsWith("act_")
    ? config.metaAdAccountId
    : `act_${config.metaAdAccountId}`;

  const klaviyoMarkets = JSON.parse(config.klaviyoMarketsJson || "[]");
  const keyFor = (country) => {
    const entry = klaviyoMarkets.find((m) => m.country === country);
    return entry ? entry.privateKey : null;
  };

  const preSince = args["pre-since"] || DEFAULTS.preSince;
  const preUntil = args["pre-until"] || DEFAULTS.preUntil;
  const postSince = args["post-since"] || DEFAULTS.postSince;
  const postUntil = args["post-until"] || todayIso();

  const freshness = daysBetween(postUntil, todayIso());
  console.log("Incremental market lift check");
  console.log(`  baseline : ${preSince} .. ${preUntil} (${daysBetween(preSince, preUntil) + 1} dage)`);
  console.log(`  måling   : ${postSince} .. ${postUntil} (${daysBetween(postSince, postUntil) + 1} dage)`);
  if (freshness < 7) {
    console.log(
      `  ADVARSEL : måleperioden slutter ${freshness} dage før i dag. Attributionsvinduet er 7 dages`
    );
    console.log("             klik, så de seneste dage er underrapporterede. Brug --post-until.");
  }
  console.log("");

  // --- Meta spend, purely to state what the extra investment was. Nothing is attributed. ---
  const spendRows = await graphGet(
    `/${accountId}/insights`,
    {
      level: "account",
      breakdowns: "country",
      time_range: JSON.stringify({ since: preSince, until: preUntil }),
      fields: "spend",
      limit: 200
    },
    token
  );
  const postSpendRows = await graphGet(
    `/${accountId}/insights`,
    {
      level: "account",
      breakdowns: "country",
      time_range: JSON.stringify({ since: postSince, until: postUntil }),
      fields: "spend",
      limit: 200
    },
    token
  );
  const spendBy = (rows) =>
    rows.reduce((acc, row) => {
      acc[row.country] = (acc[row.country] || 0) + Number(row.spend || 0);
      return acc;
    }, {});
  const preSpend = spendBy(spendRows);
  const postSpend = spendBy(postSpendRows);

  const preDays = daysBetween(preSince, preUntil) + 1;
  const postDays = daysBetween(postSince, postUntil) + 1;
  const treatmentPreDaily = TREATMENT.reduce((t, c) => t + (preSpend[c] || 0), 0) / preDays;
  const treatmentPostDaily = TREATMENT.reduce((t, c) => t + (postSpend[c] || 0), 0) / postDays;

  console.log("Meta-forbrug i behandlingsmarkederne (DE+FR+IT)");
  console.log(`  før  : ${Math.round(treatmentPreDaily).toLocaleString("da-DK")} kr/dag`);
  console.log(`  efter: ${Math.round(treatmentPostDaily).toLocaleString("da-DK")} kr/dag`);
  console.log(
    `  merforbrug i måleperioden: ${Math.round(
      (treatmentPostDaily - treatmentPreDaily) * postDays
    ).toLocaleString("da-DK")} kr`
  );
  console.log("");

  // --- Real orders from Magento via Klaviyo. This is the measurement. ---
  const daily = {};
  const weekly = {};
  for (const market of [...TREATMENT, ...CONTROL]) {
    const key = keyFor(market);
    if (!key) {
      console.log(`  (ingen Klaviyo-nøgle for ${market} - udeladt)`);
      continue;
    }
    try {
      daily[market] = await klaviyoOrderCounts(market, key, preSince, postUntil, "day");
      weekly[market] = await klaviyoOrderCounts(market, key, preSince, postUntil, "week");
    } catch (error) {
      console.log(`  (${market}: ${error.message} - udeladt)`);
    }
  }

  const available = (group) => group.filter((m) => daily[m]);
  const treatment = available(TREATMENT);
  const control = available(CONTROL);
  const total = (group, since, until) =>
    group.reduce((sum, market) => sum + sumWindow(daily[market], since, until), 0);

  const preT = total(treatment, preSince, preUntil);
  const preC = total(control, preSince, preUntil);
  const postT = total(treatment, postSince, postUntil);
  const postC = total(control, postSince, postUntil);

  // --- Pre-trend. A difference-in-differences is only worth reading if this is stable. ---
  const weeks = Object.keys(weekly[treatment[0]] || {}).sort();
  const preWeekRatios = [];
  console.log("Pre-trend, ordrer pr. uge");
  console.log("  uge        behandling  kontrol  forhold");
  for (const week of weeks) {
    const t = treatment.reduce((s, m) => s + ((weekly[m] || {})[week] || 0), 0);
    const c = control.reduce((s, m) => s + ((weekly[m] || {})[week] || 0), 0);
    if (!c) continue;
    const ratio = t / c;
    const isPost = week >= postSince;
    if (!isPost) preWeekRatios.push(ratio);
    console.log(
      `  ${week}  ${String(t).padStart(10)}  ${String(c).padStart(7)}  ${ratio.toFixed(3)}${
        isPost ? "   <- efter omlægning" : ""
      }`
    );
  }

  const spread =
    preWeekRatios.length > 1
      ? Math.max(...preWeekRatios) - Math.min(...preWeekRatios)
      : Number.POSITIVE_INFINITY;
  console.log("");

  const baselineRatio = preC ? preT / preC : 0;
  const measuredRatio = postC ? postT / postC : 0;
  const relativeChange = baselineRatio ? measuredRatio / baselineRatio - 1 : 0;
  const standardError = ratioChangeStandardError(preT, preC, postT, postC);
  const ciLow = relativeChange - 1.96 * standardError;
  const ciHigh = relativeChange + 1.96 * standardError;

  console.log("Difference-in-differences på faktiske ordrer");
  console.log(`  baseline forhold T/K : ${baselineRatio.toFixed(3)}  (${preT} / ${preC})`);
  console.log(`  målt forhold T/K     : ${measuredRatio.toFixed(3)}  (${postT} / ${postC})`);
  console.log(
    `  relativ ændring      : ${(relativeChange * 100).toFixed(1)} %  ` +
      `(95 %: ${(ciLow * 100).toFixed(1)} % .. ${(ciHigh * 100).toFixed(1)} %)`
  );
  console.log("");

  if (spread > 0.25) {
    console.log("INGEN DOM: pre-trenden er ustabil (forholdet svinger mere end 0,25 mellem uger).");
    console.log("Grupperne fulgtes ikke ad før omlægningen, så en difference-in-differences");
    console.log("måler noget andet end kampagnerne. Brug en Conversion Lift-test i stedet.");
    return;
  }

  console.log("DOM mod de forhåndsbesluttede tærskler");
  if (ciLow > THRESHOLDS.payingForItself) {
    console.log("  BETALER SIG. Løftet er større end break-even, også i intervallets underkant.");
    console.log("  Handling: skalér.");
  } else if (relativeChange > THRESHOLDS.payingForItself) {
    console.log("  MULIGVIS POSITIVT. Punktestimatet er over break-even, men intervallet rummer nul.");
    console.log("  Handling: sæt en Conversion Lift-test op før der lægges flere penge i.");
  } else if (Math.abs(relativeChange) <= THRESHOLDS.noDetectableEffect) {
    console.log("  INGEN MÅLBAR EFFEKT. Merforbruget kan ikke ses i markedernes faktiske ordrer.");
    console.log("  Handling: skru budgettet ned mod historisk niveau, eller mål med en lift-test.");
  } else if (relativeChange < 0) {
    console.log("  NEGATIVT PUNKTESTIMAT. Markederne er gået tilbage relativt til kontrolgruppen.");
    console.log("  Handling: skru ned. Læs intervallet - er det bredt, er det stadig ikke bevist.");
  } else {
    console.log("  UAFKLARET. Effekten er positiv men under break-even.");
    console.log("  Handling: hold budgettet, men forvent ikke at det tjener sig hjem.");
  }

  console.log("");
  console.log("Forbehold: kontrolgruppen fik selv skåret budget, så den er ikke uberørt.");
  console.log("Sæson, e-mailkalender og andre kanaler er ikke kontrolleret for.");
  console.log("Tærsklen for break-even antager ~40 % dækningsgrad - bekræft den.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
