// Gathering the office TV's figures, and caching them so a TV polling every ten minutes all day costs
// close to nothing:
//
// - Meta: tv/meta-acquisition.json, written by the dashboard snapshot route whenever it builds a
//   snapshot (and so once a day by its 08:15 UTC cron). The TV never calls the Graph API.
// - Subscribers: Klaviyo, live, at most once every three hours (two requests per market).
// - Email: the subject line history in Blob (~5.7 MB), re-read only when its last-modified changes,
//   which is once a night; the month's aggregate is kept in tv/kpis.json between reads.
// - The assembled payload is kept in tv/kpis.json and served as is for ten minutes.
//
// One source failing never fails the response: its scenes are left out and `sources` says why.
// Nothing here writes anywhere but the TV's own three documents.

const store = require("../meta/historical-store");
const { aggregateEmailMonth, buildTvScenes, zonedDateKey, zonedMonthKey } = require("./kpi-scenes");
const { configuredKlaviyoMarkets, fetchSubscriberTotal } = require("./subscriber-total");

const KPIS_DOC_VERSION = 1;
const KPIS_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const SUBSCRIBER_REFRESH_MS = 3 * 60 * 60 * 1000;
const SUBSCRIBER_RETRY_AFTER_FAILURE_MS = 30 * 60 * 1000;
const SUBSCRIBER_DAILY_DAYS_KEPT = 400;
const COPENHAGEN = "Europe/Copenhagen";

// The last document this instance read or wrote, for when Blob cannot be read: without it every
// poll during a Blob outage would recount every Klaviyo list.
let memoryDoc = null;

function ageMs(iso, now) {
  const at = Date.parse(iso || "");
  return Number.isFinite(at) ? now.getTime() - at : Infinity;
}

function defaultDeps(config) {
  return {
    readKpis: store.readTvKpis,
    writeKpis: store.writeTvKpis,
    readMetaAcquisition: store.readTvMetaAcquisition,
    readExpansion: store.readExpansionReach,
    readSubscriberDaily: store.readTvSubscriberDaily,
    writeSubscriberDaily: store.writeTvSubscriberDaily,
    readHistoryModifiedAt: store.readSubjectLineHistoryModifiedAt,
    readHistory: store.readSubjectLineHistory,
    fetchSubscribers: () => fetchSubscriberTotal(config),
    expectedEmailMarkets: configuredKlaviyoMarkets(config).map((market) => String(market.country).trim().toUpperCase())
  };
}

async function gatherMeta(deps) {
  try {
    return { doc: await deps.readMetaAcquisition() };
  } catch (error) {
    return { error: `The stored new-customer figure could not be read: ${error.message}` };
  }
}

async function gatherExpansion(deps) {
  try {
    return { snapshot: await deps.readExpansion() };
  } catch (error) {
    return { error: `The Expansion snapshot could not be read: ${error.message}` };
  }
}

// One entry per Copenhagen date: the first complete total of the day (the month's baseline) and the
// latest. Read-modify-write, and never written after a failed read - that would replace the whole
// history with today.
async function recordSubscriberDaily(deps, result, now) {
  let existing;
  try {
    existing = await deps.readSubscriberDaily();
  } catch {
    return null;
  }
  const days = { ...(existing?.days || {}) };
  const day = zonedDateKey(now, COPENHAGEN);
  const entry = days[day];
  days[day] = entry
    ? { ...entry, lastTotal: result.total, lastAt: result.fetchedAt }
    : { total: result.total, marketCount: result.marketCount, at: result.fetchedAt, lastTotal: result.total, lastAt: result.fetchedAt };
  const keys = Object.keys(days).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - SUBSCRIBER_DAILY_DAYS_KEPT))) delete days[key];
  const doc = { version: 1, timeZone: COPENHAGEN, updatedAt: now.toISOString(), days };
  try {
    await deps.writeSubscriberDaily(doc);
  } catch {
    // The level is still shown; only the month-to-date baseline waits for the next count.
  }
  return doc;
}

function compactSubscribers(result) {
  return {
    complete: true,
    total: result.total,
    marketCount: result.marketCount,
    markets: (result.markets || []).map(({ country, count, resolvedBy }) => ({ country, count, resolvedBy })),
    fetchedAt: result.fetchedAt
  };
}

async function gatherSubscribers(deps, cached, now) {
  const last = cached?.subscribers?.complete ? cached.subscribers : null;
  const attempt = cached?.subscriberAttempt || null;
  const recentFailure = attempt && !attempt.ok && ageMs(attempt.at, now) < SUBSCRIBER_RETRY_AFTER_FAILURE_MS;
  const due = (!last || ageMs(last.fetchedAt, now) >= SUBSCRIBER_REFRESH_MS) && !recentFailure;
  if (!due) {
    const daily = await deps.readSubscriberDaily().catch(() => null);
    return { subscribers: last, attempt, error: recentFailure ? attempt.error : "", daily };
  }

  let result;
  try {
    result = await deps.fetchSubscribers();
  } catch (error) {
    result = { complete: false, error: error.message || String(error) };
  }
  if (result?.complete && Number.isFinite(Number(result.total))) {
    const subscribers = compactSubscribers(result);
    const daily = await recordSubscriberDaily(deps, subscribers, now);
    return { subscribers, attempt: { at: now.toISOString(), ok: true }, error: "", daily };
  }
  const error = result?.error || "The subscriber count was incomplete.";
  const daily = await deps.readSubscriberDaily().catch(() => null);
  return { subscribers: last, attempt: { at: now.toISOString(), ok: false, error }, error, daily };
}

function sameMarkets(left = [], right = []) {
  return [...left].sort().join(",") === [...right].sort().join(",");
}

async function gatherEmail(deps, cached, now) {
  const monthKey = zonedMonthKey(now, COPENHAGEN);
  const expectedMarkets = deps.expectedEmailMarkets || [];
  const prior = cached?.email?.aggregate?.monthKey === monthKey && sameMarkets(cached.email.expectedMarkets, expectedMarkets)
    ? cached.email
    : null;

  let modifiedAt = null;
  let headError = "";
  try {
    modifiedAt = await deps.readHistoryModifiedAt();
  } catch (error) {
    headError = error.message || String(error);
  }
  // Unchanged since the last read - or Blob cannot say right now, in which case the aggregate from the
  // last read stands. Its markets still carry their own sync times, so it goes stale on schedule.
  if (prior && ((modifiedAt && prior.sourceModifiedAt === modifiedAt) || headError)) {
    return { aggregate: prior.aggregate, cache: prior };
  }
  if (modifiedAt === "") return { error: "The subject line history has not been synced yet.", cache: null };

  let history;
  try {
    history = await deps.readHistory();
  } catch (error) {
    return { error: `The subject line history could not be read: ${error.message}`, cache: cached?.email || null };
  }
  if (!history?.markets) return { error: "The subject line history is empty.", cache: null };
  const aggregate = aggregateEmailMonth(history, { now, expectedMarkets });
  return { aggregate, cache: { sourceModifiedAt: modifiedAt || "", expectedMarkets, aggregate } };
}

async function readCachedDoc(deps) {
  try {
    const doc = await deps.readKpis();
    if (doc?.version === KPIS_DOC_VERSION) return doc;
    return doc ? null : (memoryDoc?.version === KPIS_DOC_VERSION ? memoryDoc : null);
  } catch {
    return memoryDoc?.version === KPIS_DOC_VERSION ? memoryDoc : null;
  }
}

async function getTvKpis({ config = {}, now = new Date(), fresh = false, deps = null, sceneIds = undefined } = {}) {
  const sources = deps || defaultDeps(config);
  const cached = await readCachedDoc(sources);
  const cachedAge = ageMs(cached?.payload?.generatedAt, now);
  if (!fresh && cached?.payload && cachedAge >= -60000 && cachedAge < KPIS_CACHE_MAX_AGE_MS) {
    return { payload: cached.payload, fromCache: true };
  }

  const showExpansion = (sceneIds || []).includes("expansion_first_time_reach");
  const [meta, expansion, subscribers, email] = await Promise.all([
    gatherMeta(sources),
    showExpansion ? gatherExpansion(sources) : Promise.resolve(null),
    gatherSubscribers(sources, cached, now),
    gatherEmail(sources, cached, now)
  ]);

  const payload = buildTvScenes({
    meta,
    expansion,
    subscribers: subscribers.subscribers,
    subscribersError: subscribers.error,
    subscriberDaily: subscribers.daily,
    email: email.error ? { error: email.error } : { aggregate: email.aggregate },
    sceneIds
  }, now);

  const doc = {
    version: KPIS_DOC_VERSION,
    payload,
    subscribers: subscribers.subscribers,
    subscriberAttempt: subscribers.attempt,
    email: email.cache
  };
  memoryDoc = doc;
  try {
    await sources.writeKpis(doc);
  } catch (error) {
    console.warn("[tv] tv/kpis.json could not be written:", error.message);
  }
  return { payload, fromCache: false };
}

module.exports = {
  KPIS_CACHE_MAX_AGE_MS,
  SUBSCRIBER_REFRESH_MS,
  getTvKpis,
  recordSubscriberDaily,
  __resetMemory: () => { memoryDoc = null; }
};
