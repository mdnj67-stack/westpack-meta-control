// Webshop orders for the office TV: Klaviyo's "Placed Order" events from Magento, in all 18 stores,
// counted per hour in Copenhagen time.
//
// **Only the Magento 2 metric (integration key `magento_two`).** Since 19-27 October 2026 every
// account also has a "Placed Order" from Klaviyo's own GTM integration (key `api`) that repeats about
// three in four orders with ids in another format, and NO/PL/UK carry an old, empty "Magento" one.
// Anything that picks the metric by name double counts. A market without a `magento_two` Placed Order
// fails rather than falling back, and one failed market means no total: a quietly smaller number
// still looks like a real one.
//
// Cost: one metric-aggregates request per market per refresh (hourly counts for the last nine days),
// plus the metric list once a day per market. Read-only towards Klaviyo.

const { buildHeaders, getAllPages, klaviyoRequest } = require("../klaviyo/newsletter-lists");
const { configuredKlaviyoMarkets } = require("./subscriber-total");

const COPENHAGEN = "Europe/Copenhagen";
const METRIC_ID_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ORDERS_FETCH_DEADLINE_MS = 30000;
const DAYS_BACK = 9;

const hourFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: COPENHAGEN, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
});

// "YYYY-MM-DD HH" in Copenhagen.
function copenhagenHourKey(date) {
  const parts = Object.fromEntries(hourFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}`;
}

function pickMagentoPlacedOrder(metrics = []) {
  const magento = metrics
    .filter((metric) => metric?.attributes?.name === "Placed Order")
    .filter((metric) => String(metric?.attributes?.integration?.key || "").toLowerCase() === "magento_two")
    .sort((a, b) => Date.parse(b?.attributes?.updated || b?.attributes?.created || 0) - Date.parse(a?.attributes?.updated || a?.attributes?.created || 0));
  return magento[0]?.id || "";
}

// Klaviyo's answer as { "YYYY-MM-DD HH": count } in Copenhagen time.
function readHourlyCounts(payload) {
  const attributes = payload?.data?.attributes || {};
  const dates = Array.isArray(attributes.dates) ? attributes.dates : [];
  const counts = attributes.data?.[0]?.measurements?.count || [];
  const hours = {};
  dates.forEach((iso, index) => {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return;
    const key = copenhagenHourKey(at);
    hours[key] = (hours[key] || 0) + (Number(counts[index]) || 0);
  });
  return hours;
}

async function mapSettled(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { ok: true, value: await worker(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
  return results;
}

// -> { complete, marketCount, markets: [{ country, hours }], failed, metricIds, fetchedAt, error }
async function fetchWebshopOrders(config = {}, {
  now = new Date(),
  cachedMetricIds = {},
  deadlineMs = ORDERS_FETCH_DEADLINE_MS,
  deps = { buildHeaders, getAllPages, klaviyoRequest }
} = {}) {
  const markets = configuredKlaviyoMarkets(config);
  const fetchedAt = now.toISOString();
  if (!markets.length) return { complete: false, marketCount: 0, markets: [], failed: [], metricIds: {}, fetchedAt, error: "No Klaviyo markets are configured." };

  const metricIds = {};
  const since = new Date(now.getTime() - DAYS_BACK * 86400000).toISOString().slice(0, 19);
  const until = now.toISOString().slice(0, 19);

  const work = mapSettled(markets, 6, async (market) => {
    const country = String(market.country).trim().toUpperCase();
    const headers = deps.buildHeaders(String(market.privateKey).trim(), config.klaviyoRevision);
    const cached = cachedMetricIds?.[country];
    let metricId = cached?.id && now.getTime() - Date.parse(cached.at || 0) < METRIC_ID_MAX_AGE_MS ? cached.id : "";
    if (!metricId) {
      metricId = pickMagentoPlacedOrder(await deps.getAllPages("https://a.klaviyo.com/api/metrics/", headers));
      if (!metricId) throw new Error("no Magento 2 \"Placed Order\" metric");
      metricIds[country] = { id: metricId, at: fetchedAt };
    } else {
      metricIds[country] = cached;
    }
    const payload = await deps.klaviyoRequest("https://a.klaviyo.com/api/metric-aggregates/", headers, "POST", {
      data: {
        type: "metric-aggregate",
        attributes: {
          metric_id: metricId,
          measurements: ["count"],
          interval: "hour",
          page_size: 500,
          filter: [`greater-or-equal(datetime,${since})`, `less-than(datetime,${until})`],
          timezone: COPENHAGEN
        }
      }
    });
    return { country, hours: readHourlyCounts(payload) };
  });

  let timer;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(null), deadlineMs); });
  const results = await Promise.race([work, deadline]).finally(() => clearTimeout(timer));
  if (!results) {
    return { complete: false, marketCount: markets.length, markets: [], failed: [], metricIds, fetchedAt, error: `Klaviyo did not answer for every store within ${Math.round(deadlineMs / 1000)} s.` };
  }
  const counted = [];
  const failed = [];
  results.forEach((result, index) => {
    const country = String(markets[index].country).trim().toUpperCase();
    if (result.ok) counted.push(result.value);
    else failed.push({ country, error: result.error?.message || String(result.error) });
  });
  const complete = failed.length === 0;
  return {
    complete,
    marketCount: markets.length,
    markets: counted.sort((a, b) => a.country.localeCompare(b.country)),
    failed,
    metricIds,
    fetchedAt,
    error: complete ? "" : `Not counted: ${failed.map((row) => `${row.country} (${row.error})`).join(", ")}.`
  };
}

module.exports = {
  ORDERS_FETCH_DEADLINE_MS,
  copenhagenHourKey,
  fetchWebshopOrders,
  pickMagentoPlacedOrder,
  readHourlyCounts
};
