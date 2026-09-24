/**
 * Market-level NEW CUSTOMER lift, measured without Meta attribution.
 *
 * Why this exists
 * ---------------
 * New customers acquired is the figure the marketing department is measured on for Meta, and
 * existing-customer purchases are explicitly a bonus rather than the goal. But every new-customer
 * number the Meta API reports is attributed - it depends on which conversions Meta claims credit
 * for, which is exactly the thing that cannot be trusted when campaigns run different attribution
 * settings. On this ad account the Graph API additionally ignores `action_attribution_windows`
 * (1-day click and 28-day click return byte-identical counts), so it is not even possible to tell
 * from the API whether an incremental campaign's figures are incrementality-adjusted or plain
 * standard ones.
 *
 * So this script never asks Meta anything. It reconstructs first-time buyers from the order
 * history in Klaviyo - a buyer counts as new when no earlier order exists for that profile inside
 * the lookback - and runs the same difference-in-differences as
 * `scripts/incremental-market-lift.js`: did the markets that got the extra money acquire more
 * first-time buyers than the markets that did not?
 *
 * Definition, and its one real weakness
 * -------------------------------------
 * "New" means no prior order within `--lookback-months` (default 18). A buyer whose previous
 * order predates that window is counted as new and should not be. Widening the lookback makes the
 * count more correct and the run slower; the script prints how many of the classified-new buyers
 * fall in the first month of the lookback, which is the sensitivity you would expect to be small
 * if the window is long enough. This definition is the script's own and will not agree exactly
 * with Meta's `New_customer` pixel event, which is fine - they are measuring different things and
 * only this one is free of attribution.
 *
 * Runtime
 * -------
 * Roughly 25-50 minutes on a cold cache, dominated by paging Klaviyo. Raw pulls are cached under
 * tmp/ (gitignored), so a second run over the same window is fast. Run it in the background.
 *
 * Usage
 * -----
 *   node scripts/market-new-customer-lift.js
 *   node scripts/market-new-customer-lift.js --post-until=2026-10-01 --lookback-months=24
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));

const KLAVIYO_REVISION = "2024-10-15";
const CACHE_DIR = path.join(ROOT, "tmp", "market-new-customers");

const TREATMENT = ["DE", "FR", "IT"];
const CONTROL = ["NL", "DK", "SE", "PL", "ES", "FI", "EU"];

const DEFAULTS = {
  preSince: "2026-07-14",
  preUntil: "2026-09-08",
  postSince: "2026-09-09",
  lookbackMonths: 18
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

function shiftMonths(iso, months) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pages every Placed Order event for one market, keeping only the profile id and the timestamp.
 * Nothing else is read, so no order contents or customer details leave Klaviyo.
 */
async function fetchOrderHistory(market, privateKey, since, until, log) {
  const headers = {
    Authorization: `Klaviyo-API-Key ${privateKey}`,
    accept: "application/vnd.api+json",
    revision: KLAVIYO_REVISION
  };

  const metricsResponse = await fetch("https://a.klaviyo.com/api/metrics/", { headers });
  const metrics = await metricsResponse.json();
  if (!metricsResponse.ok) throw new Error(`metrics ${metricsResponse.status}`);
  const placedOrder = (metrics.data || []).find((m) => m.attributes.name === "Placed Order");
  if (!placedOrder) return null;

  const filter =
    `and(equals(metric_id,"${placedOrder.id}"),` +
    `greater-or-equal(datetime,${since}T00:00:00Z),` +
    `less-than(datetime,${until}T00:00:00Z))`;

  let url =
    "https://a.klaviyo.com/api/events/?" +
    `filter=${encodeURIComponent(filter)}` +
    "&page%5Bsize%5D=200&fields%5Bevent%5D=datetime&sort=-datetime";

  const orders = [];
  let pages = 0;
  while (url) {
    const response = await fetch(url, { headers });
    if (response.status === 429) {
      // Klaviyo throttles by burst; back off rather than hammering.
      await sleep(5000);
      continue;
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(`events ${response.status}`);

    for (const event of payload.data || []) {
      const profile =
        event.relationships && event.relationships.profile && event.relationships.profile.data;
      if (!profile) continue;
      orders.push({ p: profile.id, d: event.attributes.datetime.slice(0, 10) });
    }

    pages += 1;
    if (pages % 20 === 0) log(`    ${market}: ${pages} sider, ${orders.length} ordrer`);
    url = payload.links && payload.links.next ? payload.links.next : null;
  }
  return orders;
}

async function loadOrders(market, privateKey, since, until, log) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${market}_${since}_${until}.json`);
  if (fs.existsSync(cachePath)) {
    log(`  ${market}: læser fra cache`);
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  log(`  ${market}: henter ordrehistorik ${since} .. ${until}`);
  const orders = await fetchOrderHistory(market, privateKey, since, until, log);
  if (orders) fs.writeFileSync(cachePath, JSON.stringify(orders));
  return orders;
}

/**
 * A profile's first order inside the pulled history. Orders before that date are unknown to us,
 * which is what `lookback` is there to make unlikely.
 */
function firstOrderByProfile(orders) {
  const first = new Map();
  for (const order of orders) {
    const known = first.get(order.p);
    if (!known || order.d < known) first.set(order.p, order.d);
  }
  return first;
}

function countNewBuyers(orders, since, until) {
  const first = firstOrderByProfile(orders);
  let count = 0;
  for (const [, date] of first) {
    if (date >= since && date <= until) count += 1;
  }
  return count;
}

function ratioChangeStandardError(preT, preC, postT, postC) {
  const safe = (n) => (n > 0 ? 1 / n : 0);
  return Math.sqrt(safe(preT) + safe(preC) + safe(postT) + safe(postC));
}

async function main() {
  const args = parseArgs(process.argv);
  const config = getConfig();
  const markets = JSON.parse(config.klaviyoMarketsJson || "[]");
  const keyFor = (country) => {
    const entry = markets.find((m) => m.country === country);
    return entry ? entry.privateKey : null;
  };

  const preSince = args["pre-since"] || DEFAULTS.preSince;
  const preUntil = args["pre-until"] || DEFAULTS.preUntil;
  const postSince = args["post-since"] || DEFAULTS.postSince;
  const postUntil = args["post-until"] || todayIso();
  const lookbackMonths = Number(args["lookback-months"] || DEFAULTS.lookbackMonths);
  const historySince = shiftMonths(preSince, -lookbackMonths);

  const log = (line) => console.log(line);

  log("Nye kunder pr. marked - målt uden Meta-attribution");
  log(`  historik : ${historySince} .. ${postUntil} (${lookbackMonths} mdr. tilbageblik)`);
  log(`  baseline : ${preSince} .. ${preUntil}`);
  log(`  måling   : ${postSince} .. ${postUntil}`);
  log("");

  const history = {};
  for (const market of [...TREATMENT, ...CONTROL]) {
    const key = keyFor(market);
    if (!key) {
      log(`  (ingen nøgle for ${market} - udeladt)`);
      continue;
    }
    try {
      const orders = await loadOrders(market, key, historySince, postUntil, log);
      if (orders && orders.length) history[market] = orders;
      else log(`  (${market}: ingen ordrer - udeladt)`);
    } catch (error) {
      log(`  (${market}: ${error.message} - udeladt)`);
    }
  }
  log("");

  const present = (group) => group.filter((m) => history[m]);
  const treatment = present(TREATMENT);
  const control = present(CONTROL);

  const newIn = (group, since, until) =>
    group.reduce((sum, market) => sum + countNewBuyers(history[market], since, until), 0);

  log("Førstegangskøbere pr. marked");
  log("  marked   baseline   måling   baseline/dag   måling/dag");
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
  for (const market of [...treatment, ...control]) {
    const a = countNewBuyers(history[market], preSince, preUntil);
    const b = countNewBuyers(history[market], postSince, postUntil);
    log(
      `  ${market.padEnd(8)} ${String(a).padStart(8)} ${String(b).padStart(8)}` +
        `${(a / days(preSince, preUntil)).toFixed(1).padStart(15)}` +
        `${(b / days(postSince, postUntil)).toFixed(1).padStart(13)}` +
        (TREATMENT.includes(market) ? "   <- fik pengene" : "")
    );
  }
  log("");

  const preT = newIn(treatment, preSince, preUntil);
  const preC = newIn(control, preSince, preUntil);
  const postT = newIn(treatment, postSince, postUntil);
  const postC = newIn(control, postSince, postUntil);

  const baseline = preC ? preT / preC : 0;
  const measured = postC ? postT / postC : 0;
  const change = baseline ? measured / baseline - 1 : 0;
  const se = ratioChangeStandardError(preT, preC, postT, postC);

  // Per market as well as pooled. The three markets carry very different volumes - IT is about a
  // fifth of DE - so a pooled figure hides which market is actually moving, and each market is
  // scaled separately anyway. The intervals are correspondingly wide and are printed rather than
  // left to be inferred.
  log("Pr. marked, mod den fælles kontrolgruppe");
  log("  marked   baseline   målt   ændring   95 %-interval");
  for (const market of treatment) {
    const mPre = countNewBuyers(history[market], preSince, preUntil);
    const mPost = countNewBuyers(history[market], postSince, postUntil);
    if (!mPre || !preC || !postC) continue;
    const mBase = mPre / preC;
    const mNow = mPost / postC;
    const mChange = mNow / mBase - 1;
    const mSe = ratioChangeStandardError(mPre, preC, mPost, postC);
    log(
      `  ${market.padEnd(8)} ${mBase.toFixed(3).padStart(8)} ${mNow.toFixed(3).padStart(6)} ` +
        `${(mChange * 100).toFixed(1).padStart(8)} %   ` +
        `${((mChange - 1.96 * mSe) * 100).toFixed(1)} % .. ${((mChange + 1.96 * mSe) * 100).toFixed(1)} %`
    );
  }
  log("");
  log("Bemærk at tre markeder testes på én gang. Med tre uafhængige test er der cirka 14 %");
  log("chance for at mindst ét ser signifikant ud ved ren tilfældighed, så et enkelt marked");
  log("der lige klarer tærsklen er et spor, ikke et bevis.");
  log("");

  log("Difference-in-differences på nye kunder");
  log(`  baseline forhold T/K : ${baseline.toFixed(3)}  (${preT} / ${preC})`);
  log(`  målt forhold T/K     : ${measured.toFixed(3)}  (${postT} / ${postC})`);
  log(
    `  relativ ændring      : ${(change * 100).toFixed(1)} %  ` +
      `(95 %: ${((change - 1.96 * se) * 100).toFixed(1)} % .. ${((change + 1.96 * se) * 100).toFixed(1)} %)`
  );
  log("");

  // Sensitivity: how many of the buyers we called new had their first order right at the edge of
  // the lookback? If that share is large, the lookback is too short and "new" is overcounted.
  const edgeUntil = shiftMonths(historySince, 1);
  let edge = 0;
  let totalFirst = 0;
  for (const market of [...treatment, ...control]) {
    for (const [, date] of firstOrderByProfile(history[market])) {
      totalFirst += 1;
      if (date < edgeUntil) edge += 1;
    }
  }
  log(
    `Følsomhed: ${((edge / totalFirst) * 100).toFixed(1)} % af alle "første" ordrer ligger i ` +
      `tilbageblikkets første måned.`
  );
  log("Er den andel stor, er tilbageblikket for kort og nye kunder overtælles - kør igen");
  log("med et større --lookback-months.");
  log("");
  log("Forbehold: kontrolgruppen fik selv skåret budget, så den er ikke uberørt.");
  log("Andre kanaler - e-mail, Google, organisk - er ikke kontrolleret for.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
