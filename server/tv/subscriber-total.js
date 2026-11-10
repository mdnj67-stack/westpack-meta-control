// The newsletter subscriber total for the office TV: membership of the one branded newsletter list in
// each country's Klaviyo account, summed - the user's definition, and the same two requests per market
// as `refreshSubscriberLevels` in api/klaviyo/campaign-overview.js (resolve the list, ask Klaviyo for
// its profile count). Read-only: nothing here writes to Klaviyo or to any store.
//
// The difference from the overview is what happens when a market fails. The overview fills it in with
// the last recorded figure and labels the total "mixed"; the TV has no room for a label, so a total
// with any market missing is reported as incomplete and the caller does not show it.

const {
  buildHeaders,
  fetchListProfileCount,
  resolveNewsletterList
} = require("../klaviyo/newsletter-lists");

const SUBSCRIBER_FETCH_DEADLINE_MS = 30000;

function parseMarkets(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function configuredKlaviyoMarkets(config = {}) {
  return parseMarkets(config.klaviyoMarketsJson)
    .filter((market) => String(market?.country || "").trim() && String(market?.privateKey || "").trim());
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

async function countMarkets(markets, { revision, deps }) {
  const results = await mapSettled(markets, 4, async (market) => {
    const country = String(market.country).trim().toUpperCase();
    const headers = deps.buildHeaders(String(market.privateKey).trim(), revision);
    const list = await deps.resolveNewsletterList(headers, { listId: market.listId, listName: market.listName });
    if (!list?.id) throw new Error("no newsletter list could be identified");
    const count = await deps.fetchListProfileCount(headers, list.id);
    if (!Number.isFinite(Number(count))) throw new Error("Klaviyo did not report a profile count");
    return { country, count: Number(count), listId: list.id, listName: list.name || "", resolvedBy: list.resolvedBy || "" };
  });
  const counted = [];
  const failed = [];
  results.forEach((result, index) => {
    const country = String(markets[index].country).trim().toUpperCase();
    if (result.ok) counted.push(result.value);
    else failed.push({ country, error: result.error?.message || String(result.error) });
  });
  return { counted, failed };
}

async function fetchSubscriberTotal(config = {}, {
  now = () => new Date(),
  deadlineMs = SUBSCRIBER_FETCH_DEADLINE_MS,
  deps = { buildHeaders, fetchListProfileCount, resolveNewsletterList }
} = {}) {
  const markets = configuredKlaviyoMarkets(config);
  if (!markets.length) {
    return { complete: false, total: null, marketCount: 0, markets: [], failed: [], fetchedAt: now().toISOString(), error: "No Klaviyo markets are configured." };
  }
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), deadlineMs);
  });
  const outcome = await Promise.race([countMarkets(markets, { revision: config.klaviyoRevision, deps }), deadline])
    .finally(() => clearTimeout(timer));
  const fetchedAt = now().toISOString();
  if (!outcome) {
    return { complete: false, total: null, marketCount: markets.length, markets: [], failed: [], fetchedAt, error: `Klaviyo did not answer for every market within ${Math.round(deadlineMs / 1000)} s.` };
  }
  const { counted, failed } = outcome;
  const complete = failed.length === 0 && counted.length === markets.length;
  return {
    complete,
    total: complete ? counted.reduce((sum, row) => sum + row.count, 0) : null,
    marketCount: markets.length,
    markets: counted.sort((left, right) => left.country.localeCompare(right.country)),
    failed,
    fetchedAt,
    error: complete ? "" : `Not counted: ${failed.map((row) => `${row.country} (${row.error})`).join(", ")}.`
  };
}

module.exports = {
  SUBSCRIBER_FETCH_DEADLINE_MS,
  configuredKlaviyoMarkets,
  fetchSubscriberTotal
};
