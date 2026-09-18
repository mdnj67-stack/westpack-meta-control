// Reads the subscriber joined/removed series, and - on a scheduled call - records the daily snapshot
// the series is derived from.
//
// Recording is the expensive half: learning when the current members joined means walking every
// profile in every list, which is 268 requests and about 167 seconds across the eighteen accounts.
// That cost is exactly why the live dashboard route must not do it. It belongs on a cron, once a
// day, while the dashboard itself reads the cheap `profile_count` for the levels and this archive
// for the flows.

const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { sendJson } = require("../../server/lib/http");
const {
  buildHeaders,
  collectListJoinTallies,
  recentJoinHistogram,
  resolveNewsletterList
} = require("../../server/klaviyo/newsletter-lists");
const {
  buildConsentBreakdown,
  buildDailyJoinSeries,
  buildRecordedTotalsSeries,
  buildSubscriberFlowSeries,
  getSubscriberHistoryStoreProfile,
  readSubscriberHistory,
  recordSubscriberSnapshot
} = require("../../server/klaviyo/subscriber-history");

const RECORD_CONCURRENCY = 3;
// Six weeks of join history is carried on every snapshot, complete rather than sliced to the
// interval, so a day recorded while it was still running is corrected by the next night's reading.
const JOIN_HISTOGRAM_DAYS = 45;

function parseMarkets(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error("Invalid KLAVIYO_MARKETS_JSON.");
  }
}

function isVercelCronRequest(req) {
  const cronHeader = String(req?.headers?.["x-vercel-cron"] || "").trim();
  const userAgent = String(req?.headers?.["user-agent"] || "").toLowerCase();
  return Boolean(cronHeader) || userAgent.includes("vercel-cron");
}

function isAuthorizedCronRequest(req, config = {}) {
  const authHeader = String(req?.headers?.authorization || "").trim();
  if (!config.cronSecret) return false;
  return authHeader === `Bearer ${config.cronSecret}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function mapWithConcurrencySettled(items, limit, worker) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, () => runWorker()));
  return results;
}

async function measureMarket(market, { config, since }) {
  const country = String(market.country || "").trim().toUpperCase();
  const privateKey = String(market.privateKey || "").trim();
  if (!country || !privateKey) return null;

  const headers = buildHeaders(privateKey, config.klaviyoRevision);
  const list = await resolveNewsletterList(headers, { listId: market.listId, listName: market.listName });
  if (!list?.id) throw new Error(`${country}: no newsletter list could be identified.`);

  const { total, joinedByDate, consent, joinedSince } = await collectListJoinTallies(headers, list.id, { since });
  return {
    country,
    total,
    joined: joinedSince,
    joinedDaily: recentJoinHistogram(joinedByDate, { days: JOIN_HISTOGRAM_DAYS, endDate: todayKey() }),
    consent,
    listId: list.id,
    listName: list.name,
    resolvedBy: list.resolvedBy
  };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  const cronRequest = isVercelCronRequest(req);
  const authorizedCron = isAuthorizedCronRequest(req, config);
  if (!cronRequest && !authorizedCron && !requireAuth(req, res, config)) {
    return;
  }

  const shouldRecord = cronRequest || authorizedCron || String(req.query?.record || "").trim() === "1";
  const store = getSubscriberHistoryStoreProfile();

  let markets = [];
  try {
    markets = parseMarkets(config.klaviyoMarketsJson);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
    return;
  }
  const marketCodes = markets.map((market) => String(market.country || "").trim().toUpperCase()).filter(Boolean);

  if (!shouldRecord) {
    const history = await readSubscriberHistory();
    sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      store,
      snapshotCount: history.entries.length,
      lastRecordedAt: history.entries[history.entries.length - 1]?.date || "",
      flow: buildSubscriberFlowSeries(history, { markets: marketCodes }),
      dailyJoins: buildDailyJoinSeries(history, { markets: marketCodes }),
      totalsSeries: buildRecordedTotalsSeries(history, { markets: marketCodes }),
      consent: buildConsentBreakdown(history, { markets: marketCodes })
    });
    return;
  }

  if (!markets.length) {
    sendJson(res, 500, { error: "Missing Klaviyo market configuration." });
    return;
  }

  const existing = await readSubscriberHistory();
  // Joins are counted since the previous snapshot, so the interval the series draws is exactly the
  // interval the joins were measured over. Today's own entry is excluded deliberately: recording
  // twice in one day would otherwise measure joins "since today", write ~0, and overwrite the real
  // interval it had already captured. Re-running has to be safe, because a cron that retries will.
  const priorEntries = existing.entries.filter((entry) => entry.date < todayKey());
  const previous = priorEntries[priorEntries.length - 1] || null;
  // The exact recording time, not the date. See collectListJoinTallies for what the date cutoff cost.
  const since = previous?.recordedAt || (previous?.date ? `${previous.date}T00:00:00.000Z` : "");

  const results = await mapWithConcurrencySettled(
    markets.filter((market) => String(market.country || "").trim() && String(market.privateKey || "").trim()),
    RECORD_CONCURRENCY,
    (market) => measureMarket(market, { config, since })
  );

  const measured = {};
  const failures = [];
  const keywordGuesses = [];
  for (const result of results) {
    if (result?.status !== "fulfilled" || !result.value) {
      const message = String(result?.reason?.message || "Unknown market failure.").trim();
      failures.push(message);
      continue;
    }
    const row = result.value;
    measured[row.country] = {
      total: row.total,
      joined: row.joined,
      joinedDaily: row.joinedDaily,
      consent: row.consent,
      listId: row.listId,
      listName: row.listName
    };
    if (row.resolvedBy === "keyword_guess" || row.resolvedBy === "branded_name_ambiguous") {
      keywordGuesses.push(`${row.country} → ${row.listName} (${row.resolvedBy})`);
    }
  }

  if (!Object.keys(measured).length) {
    sendJson(res, 502, { error: "No market could be measured.", failures });
    return;
  }

  // A snapshot missing markets would make the next interval's removals wrong for those markets, so
  // the gaps are reported rather than quietly folded into the total.
  const history = await recordSubscriberSnapshot({ date: todayKey(), markets: measured });

  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    recorded: { date: todayKey(), markets: Object.keys(measured).length, since },
    store,
    snapshotCount: history.entries.length,
    warnings: [
      failures.length ? `${failures.length} market(s) could not be measured: ${failures.slice(0, 3).join(" | ")}` : "",
      keywordGuesses.length ? `List identified by name guess in: ${keywordGuesses.join(", ")}` : ""
    ].filter(Boolean),
    flow: buildSubscriberFlowSeries(history, { markets: marketCodes }),
    dailyJoins: buildDailyJoinSeries(history, { markets: marketCodes }),
    totalsSeries: buildRecordedTotalsSeries(history, { markets: marketCodes }),
    consent: buildConsentBreakdown(history, { markets: marketCodes })
  });
};
