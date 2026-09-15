// Subscribers were reported as one number per market and nothing else, so a list could lose a tenth
// of itself in five months and the screen would show a flat line. Between 16 April and 15 September
// 2026 the eighteen lists took in 3,414 new members and lost 3,661, netting to -248 - and the -248
// was the only figure anybody could see. This store keeps the two flows apart.
//
// Neither flow can be read straight out of Klaviyo. Joins are recoverable from each current member's
// `joined_group_at`, but removals leave nothing behind at all: a deleted profile takes its events
// with it. So removals are derived by differencing snapshots -
//
//     removed = previous total + joins in the interval - current total
//
// which is exact for the net and understates both sides by the same amount. Someone who joined and
// was deleted inside one interval appears in neither, because by snapshot time there is no record
// that they were ever there. That is stated in `basis` rather than papered over.
//
// The archive lives on the same three backends as the Content Agent's own state, and deliberately
// not inside it: that blob is read and written whole on every operation, so a daily append here
// would contend with the worker for no reason.

const fs = require("fs");
const path = require("path");
const { canUseLocalFile, getAgentStoreProfile, redisCommand } = require("../campaign/agent-store");

const STORE_KEY = "westpack:klaviyo:subscriber-history:v1";
const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "klaviyo-subscriber-history.json");
// A committed baseline so the first recorded snapshot already has something to be compared against.
// Without it the panel would have nothing to show until two cron runs had been through, and the one
// interval everybody wants to see first - what happened since April - would be lost for good.
const SEED_PATH = path.join(process.cwd(), "data", "klaviyo-subscriber-history.seed.json");
// A little over a year of daily entries. The whole archive is read and written as one value, so it
// has to stay inside a single round trip.
const MAX_ENTRIES = 400;

let volatileHistory = null;

function createEmptyHistory() {
  return { version: 1, updatedAt: "", entries: [] };
}

function loadSeedHistory() {
  try {
    const seeded = normalizeHistory(JSON.parse(fs.readFileSync(SEED_PATH, "utf8")));
    return seeded.entries.length ? seeded : createEmptyHistory();
  } catch (error) {
    return createEmptyHistory();
  }
}

// An archive with nothing in it yet starts from the committed baseline rather than from zero.
function withSeed(history) {
  const normalized = normalizeHistory(history);
  if (normalized.entries.length) return normalized;
  return loadSeedHistory();
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeHistory(raw) {
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const seen = new Map();

  for (const entry of entries) {
    if (!isDateKey(entry?.date)) continue;
    const markets = {};
    for (const [country, value] of Object.entries(entry.markets || {})) {
      const code = String(country || "").trim().toUpperCase();
      if (!code) continue;
      const total = Number(value?.total);
      if (!Number.isFinite(total)) continue;
      markets[code] = {
        total,
        joined: Number.isFinite(Number(value?.joined)) ? Number(value.joined) : 0,
        listId: String(value?.listId || ""),
        listName: String(value?.listName || "")
      };
    }
    if (!Object.keys(markets).length) continue;
    // A later write for the same day replaces the earlier one; a day is the finest grain here.
    seen.set(entry.date, { date: entry.date, recordedAt: String(entry.recordedAt || ""), markets });
  }

  const sorted = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_ENTRIES);
  return { version: 1, updatedAt: String(raw?.updatedAt || ""), entries: sorted };
}

function appendSubscriberSnapshot(history, snapshot = {}) {
  const normalized = normalizeHistory(history);
  if (!isDateKey(snapshot?.date)) throw new Error("A subscriber snapshot needs a YYYY-MM-DD date.");
  const next = normalizeHistory({
    ...normalized,
    entries: [...normalized.entries, { ...snapshot, recordedAt: snapshot.recordedAt || new Date().toISOString() }]
  });
  next.updatedAt = new Date().toISOString();
  return next;
}

// Pure: turn the archive into the two series the dashboard draws. One point per interval between
// consecutive snapshots, never per calendar day, because that is the grain the data actually has.
function buildSubscriberFlowSeries(history, { markets = [], limit = 60 } = {}) {
  const normalized = normalizeHistory(history);
  const entries = normalized.entries;
  const wanted = (Array.isArray(markets) && markets.length
    ? markets
    : [...new Set(entries.flatMap((entry) => Object.keys(entry.markets)))])
    .map((code) => String(code || "").trim().toUpperCase())
    .filter(Boolean);

  if (entries.length < 2) {
    return {
      available: false,
      reason: entries.length
        ? "Only one subscriber snapshot has been recorded, so there is no interval to compare yet."
        : "No subscriber snapshots have been recorded yet.",
      periods: [],
      markets: [],
      totals: { joined: [], removed: [], net: [] },
      basis: describeBasis()
    };
  }

  const intervals = [];
  for (let index = 1; index < entries.length; index += 1) {
    intervals.push({ previous: entries[index - 1], current: entries[index] });
  }
  const used = intervals.slice(-Math.max(1, limit));

  const periods = used.map(({ previous, current }) => ({
    from: previous.date,
    to: current.date,
    days: Math.max(1, Math.round((Date.parse(current.date) - Date.parse(previous.date)) / 86_400_000))
  }));

  const perMarket = wanted.map((country) => {
    const joined = [];
    const removed = [];
    const net = [];
    for (const { previous, current } of used) {
      const before = previous.markets[country];
      const after = current.markets[country];
      if (!before || !after) {
        joined.push(null);
        removed.push(null);
        net.push(null);
        continue;
      }
      const joinedCount = Number(after.joined || 0);
      joined.push(joinedCount);
      removed.push(before.total + joinedCount - after.total);
      net.push(after.total - before.total);
    }
    const lastTotal = used.length ? used[used.length - 1].current.markets[country]?.total ?? null : null;
    return { country, joined, removed, net, total: lastTotal };
  });

  const sumAt = (key, index) => perMarket.reduce((sum, row) => sum + (Number(row[key][index]) || 0), 0);
  const totals = {
    joined: used.map((_, index) => sumAt("joined", index)),
    removed: used.map((_, index) => sumAt("removed", index)),
    net: used.map((_, index) => sumAt("net", index))
  };

  return {
    available: true,
    reason: "",
    periods,
    markets: perMarket.filter((row) => row.joined.some((value) => value != null)),
    totals,
    basis: describeBasis()
  };
}

function describeBasis() {
  return {
    joined: "Counted from each current member's joined_group_at, so a member who joined and was removed inside the same interval is not counted.",
    removed: "Derived as previous total plus joins minus current total. Klaviyo keeps no record of a removed profile, so it cannot be measured directly.",
    net: "Exact: the difference between two recorded totals."
  };
}

function resolveMode() {
  const profile = getAgentStoreProfile();
  if (profile.mode === "redis") return "redis";
  return canUseLocalFile() ? "local_file" : "volatile";
}

function getSubscriberHistoryStoreProfile() {
  const mode = resolveMode();
  return { mode, persistent: mode !== "volatile" };
}

function readLocalHistory() {
  try {
    return normalizeHistory(JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, "utf8")));
  } catch (error) {
    return createEmptyHistory();
  }
}

function writeLocalHistory(history) {
  fs.mkdirSync(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  const tempPath = `${LOCAL_STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(history, null, 2), "utf8");
  fs.renameSync(tempPath, LOCAL_STORE_PATH);
}

async function readSubscriberHistory() {
  const mode = resolveMode();
  if (mode === "redis") {
    try {
      const raw = await redisCommand(["GET", STORE_KEY]);
      return raw ? withSeed(JSON.parse(raw)) : loadSeedHistory();
    } catch (error) {
      // History is a nice-to-have beside the live counts; losing it must not fail the dashboard.
      return loadSeedHistory();
    }
  }
  if (mode === "local_file") return withSeed(readLocalHistory());
  return withSeed(volatileHistory);
}

async function writeSubscriberHistory(history) {
  const normalized = normalizeHistory(history);
  normalized.updatedAt = new Date().toISOString();
  const mode = resolveMode();
  if (mode === "redis") {
    await redisCommand(["SET", STORE_KEY, JSON.stringify(normalized)]);
  } else if (mode === "local_file") {
    writeLocalHistory(normalized);
  } else {
    volatileHistory = normalized;
  }
  return normalized;
}

async function recordSubscriberSnapshot(snapshot) {
  const history = await readSubscriberHistory();
  return writeSubscriberHistory(appendSubscriberSnapshot(history, snapshot));
}

module.exports = {
  LOCAL_STORE_PATH,
  MAX_ENTRIES,
  SEED_PATH,
  STORE_KEY,
  loadSeedHistory,
  appendSubscriberSnapshot,
  buildSubscriberFlowSeries,
  createEmptyHistory,
  getSubscriberHistoryStoreProfile,
  normalizeHistory,
  readSubscriberHistory,
  recordSubscriberSnapshot,
  writeSubscriberHistory
};
