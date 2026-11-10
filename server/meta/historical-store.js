const fs = require("fs");
const path = require("path");

// Nine documents share this module's storage plumbing: the historical creative
// intelligence Campaign Brain reads, the expansion reach series and the
// audience saturation table the Meta dashboard renders, the subject line
// generator's Klaviyo send history, its mechanism tags and team data, and the
// Agents page's watchdog results and email checks, and the Signup page's control of the Signup Lab. They are kept under separate keys rather than in one blob,
// because each is written by its own job and a shared value would make
// one job's write clobber the other's.
// The office TV's three documents (tv/*) are Blob or local file only - never Redis, see readTvDocument.
const HISTORICAL_STORE_KEY = "westpack:meta-historical-intelligence:v1";
const EXPANSION_STORE_KEY = "westpack:meta-expansion-reach:v1";
const SATURATION_STORE_KEY = "westpack:meta-audience-saturation:v1";
const SUBJECT_HISTORY_STORE_KEY = "westpack:klaviyo-subject-line-history:v1";
const SUBJECT_TEAM_STORE_KEY = "westpack:klaviyo-subject-line-team:v1";
const SUBJECT_TAGS_STORE_KEY = "westpack:klaviyo-subject-line-tags:v1";
const AGENT_WATCHDOG_STORE_KEY = "westpack:agents-watchdog:v1";
const AGENT_EMAIL_CHECKS_STORE_KEY = "westpack:agents-email-checks:v1";
const SIGNUP_CONTROL_STORE_KEY = "westpack:signup-control:v1";
const TV_META_ACQUISITION_STORE_KEY = "westpack:tv-meta-acquisition:v1";
const TV_KPIS_STORE_KEY = "westpack:tv-kpis:v1";
const TV_SUBSCRIBER_DAILY_STORE_KEY = "westpack:tv-subscriber-daily:v1";

const LOCAL_PATHS = {
  [HISTORICAL_STORE_KEY]: path.join(process.cwd(), "data", "meta-historical-intelligence.json"),
  [EXPANSION_STORE_KEY]: path.join(process.cwd(), "data", "meta-expansion-reach.json"),
  [SATURATION_STORE_KEY]: path.join(process.cwd(), "data", "meta-audience-saturation.json"),
  [SUBJECT_HISTORY_STORE_KEY]: path.join(process.cwd(), "data", "klaviyo-subject-line-history.json"),
  [SUBJECT_TEAM_STORE_KEY]: path.join(process.cwd(), "data", "klaviyo-subject-line-team.json"),
  [SUBJECT_TAGS_STORE_KEY]: path.join(process.cwd(), "data", "klaviyo-subject-line-tags.json"),
  [AGENT_WATCHDOG_STORE_KEY]: path.join(process.cwd(), "data", "agents-watchdog.json"),
  [AGENT_EMAIL_CHECKS_STORE_KEY]: path.join(process.cwd(), "data", "agents-email-checks.json"),
  [SIGNUP_CONTROL_STORE_KEY]: path.join(process.cwd(), "data", "signup-control.json"),
  [TV_META_ACQUISITION_STORE_KEY]: path.join(process.cwd(), "data", "tv-meta-acquisition.json"),
  [TV_KPIS_STORE_KEY]: path.join(process.cwd(), "data", "tv-kpis.json"),
  [TV_SUBSCRIBER_DAILY_STORE_KEY]: path.join(process.cwd(), "data", "tv-subscriber-daily.json")
};

const volatileSnapshots = new Map();

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

// Vercel Blob takes precedence over Redis for these snapshots. On 2026-10-21 the
// Upstash database hit its fixed plan limit and refused every command, reads
// included, so the Expansion tab went blank for days while Meta had the figures
// all along. These are three small JSON documents written once a night; they do
// not need a database, and putting them on a separate service means a full
// Redis can no longer take the dashboard down with the Content Agent.
// The store is private: the snapshots are account figures, and a public Blob
// URL is readable by anyone who has it.
const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const BLOB_PATHS = {
  [HISTORICAL_STORE_KEY]: "meta-snapshots/historical-intelligence.json",
  [EXPANSION_STORE_KEY]: "meta-snapshots/expansion-reach.json",
  [SATURATION_STORE_KEY]: "meta-snapshots/audience-saturation.json",
  [SUBJECT_HISTORY_STORE_KEY]: "klaviyo-snapshots/subject-line-history.json",
  [SUBJECT_TEAM_STORE_KEY]: "klaviyo-snapshots/subject-line-team.json",
  [SUBJECT_TAGS_STORE_KEY]: "klaviyo-snapshots/subject-line-tags.json",
  [AGENT_WATCHDOG_STORE_KEY]: "agents/watchdog.json",
  [AGENT_EMAIL_CHECKS_STORE_KEY]: "agents/email-checks.json",
  [SIGNUP_CONTROL_STORE_KEY]: "signup/control.json",
  [TV_META_ACQUISITION_STORE_KEY]: "tv/meta-acquisition.json",
  [TV_KPIS_STORE_KEY]: "tv/kpis.json",
  [TV_SUBSCRIBER_DAILY_STORE_KEY]: "tv/subscriber-daily.json"
};

function getBlobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "");
}

// The token is vercel_blob_rw_<storeId>_<secret>; the store id names the host.
function blobUrl(storeKey) {
  const storeId = getBlobToken().split("_")[3] || "";
  if (!storeId) throw new Error("BLOB_READ_WRITE_TOKEN does not name a Blob store.");
  return `https://${storeId}.private.blob.vercel-storage.com/${BLOB_PATHS[storeKey]}`;
}

async function blobRead(storeKey) {
  // cache=0: the snapshot is overwritten in place every night, and a cached
  // copy would serve yesterday's figures under today's date.
  const response = await fetch(`${blobUrl(storeKey)}?cache=0`, {
    headers: { Authorization: `Bearer ${getBlobToken()}` }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Blob read failed (${response.status}).`);
  return JSON.parse(await response.text());
}

async function blobWrite(storeKey, snapshot) {
  const params = new URLSearchParams({ pathname: BLOB_PATHS[storeKey] });
  const response = await fetch(`${BLOB_API_URL}/?${params.toString()}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getBlobToken()}`,
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-content-type": "application/json",
      "x-cache-control-max-age": "60"
    },
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || `Blob write failed (${response.status}).`);
  }
}

async function blobLastModified(storeKey) {
  const response = await fetch(`${blobUrl(storeKey)}?cache=0`, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${getBlobToken()}` }
  });
  if (response.status === 404) return { exists: false, lastModified: null };
  if (!response.ok) throw new Error(`Blob read failed (${response.status}).`);
  const header = response.headers.get("last-modified");
  const parsed = header ? Date.parse(header) : NaN;
  return { exists: true, lastModified: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null };
}

// The nightly jobs whose output the dashboard and the subject line generator read. Each entry
// says when it was last written, so the watchdog can tell a stale tab from a quiet night.
async function readNightlySnapshotTimes() {
  if (getHistoricalStoreProfile().mode !== "blob") return null;
  const entries = [
    ["historical_intelligence", HISTORICAL_STORE_KEY],
    ["expansion_reach", EXPANSION_STORE_KEY],
    ["audience_saturation", SATURATION_STORE_KEY],
    ["subject_line_history", SUBJECT_HISTORY_STORE_KEY]
  ];
  const results = {};
  await Promise.all(entries.map(async ([name, storeKey]) => {
    try {
      results[name] = await blobLastModified(storeKey);
    } catch (error) {
      results[name] = { exists: null, lastModified: null, error: error.message };
    }
  }));
  return results;
}

function getHistoricalStoreProfile() {
  if (getBlobToken()) return { mode: "blob", persistent: true };
  const redis = getRedisConfig();
  if (redis.url && redis.token) return { mode: "redis", persistent: true };
  if (!process.env.VERCEL) return { mode: "local_file", persistent: true };
  return { mode: "volatile", persistent: false };
}

async function redisCommand(command) {
  const redis = getRedisConfig();
  const response = await fetch(redis.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `Redis request failed (${response.status}).`);
  return payload.result;
}

async function readSnapshot(storeKey) {
  const profile = getHistoricalStoreProfile();
  if (profile.mode === "blob") {
    const stored = await blobRead(storeKey);
    if (stored) return stored;
    // Nothing in Blob yet: the first read after the switch can still find the
    // last snapshot Redis holds. Only an answer counts; a full or missing Redis
    // must not fail a read Blob has simply not been asked to serve yet.
    const redis = getRedisConfig();
    if (!redis.url || !redis.token) return null;
    try {
      const raw = await redisCommand(["GET", storeKey]);
      return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
    } catch {
      return null;
    }
  }
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", storeKey]);
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  }
  if (profile.mode === "local_file") {
    try { return JSON.parse(fs.readFileSync(LOCAL_PATHS[storeKey], "utf8")); } catch { return null; }
  }
  return volatileSnapshots.get(storeKey) || null;
}

async function writeSnapshot(storeKey, snapshot) {
  const profile = getHistoricalStoreProfile();
  if (profile.mode === "blob") {
    await blobWrite(storeKey, snapshot);
  } else if (profile.mode === "redis") {
    await redisCommand(["SET", storeKey, JSON.stringify(snapshot)]);
  } else if (profile.mode === "local_file") {
    const localPath = LOCAL_PATHS[storeKey];
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    // Written to a temp file and renamed, so a reader never sees a half-written
    // snapshot: the nightly job and a dashboard request can overlap.
    const tempPath = `${localPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
    fs.renameSync(tempPath, localPath);
  } else {
    volatileSnapshots.set(storeKey, snapshot);
  }
  return snapshot;
}

const readHistoricalIntelligence = () => readSnapshot(HISTORICAL_STORE_KEY);
const writeHistoricalIntelligence = (snapshot) => writeSnapshot(HISTORICAL_STORE_KEY, snapshot);
const readExpansionReach = () => readSnapshot(EXPANSION_STORE_KEY);
const writeExpansionReach = (snapshot) => writeSnapshot(EXPANSION_STORE_KEY, snapshot);
const readAudienceSaturation = () => readSnapshot(SATURATION_STORE_KEY);
const writeAudienceSaturation = (snapshot) => writeSnapshot(SATURATION_STORE_KEY, snapshot);
const readSubjectLineHistory = () => readSnapshot(SUBJECT_HISTORY_STORE_KEY);
const writeSubjectLineHistory = (snapshot) => writeSnapshot(SUBJECT_HISTORY_STORE_KEY, snapshot);
const readSubjectLineTeam = () => readSnapshot(SUBJECT_TEAM_STORE_KEY);
const writeSubjectLineTeam = (snapshot) => writeSnapshot(SUBJECT_TEAM_STORE_KEY, snapshot);
const readSubjectLineTags = () => readSnapshot(SUBJECT_TAGS_STORE_KEY);
const writeSubjectLineTags = (snapshot) => writeSnapshot(SUBJECT_TAGS_STORE_KEY, snapshot);
const readAgentWatchdog = () => readSnapshot(AGENT_WATCHDOG_STORE_KEY);
const writeAgentWatchdog = (snapshot) => writeSnapshot(AGENT_WATCHDOG_STORE_KEY, snapshot);
const readAgentEmailChecks = () => readSnapshot(AGENT_EMAIL_CHECKS_STORE_KEY);
const writeAgentEmailChecks = (snapshot) => writeSnapshot(AGENT_EMAIL_CHECKS_STORE_KEY, snapshot);
// Blob only, never the Redis fallback: the stores read this on every page view (through the CDN), and a full Redis
// must not slow that down. Absent means "use signup/core/markets.js".
const readSignupControl = async () => (getHistoricalStoreProfile().mode === "blob" ? blobRead(SIGNUP_CONTROL_STORE_KEY) : readSnapshot(SIGNUP_CONTROL_STORE_KEY));
const writeSignupControl = (snapshot) => writeSnapshot(SIGNUP_CONTROL_STORE_KEY, snapshot);

// The office TV's documents. Blob when it is configured, the local file in development, memory
// otherwise - and never Redis in any mode, not even as a fallback: Redis has been full since
// 2026-10-21, and a TV that polls all day must not add to what is waiting on it.
function getTvStoreMode() {
  if (getBlobToken()) return "blob";
  if (!process.env.VERCEL) return "local_file";
  return "volatile";
}

async function readTvDocument(storeKey) {
  const mode = getTvStoreMode();
  if (mode === "blob") return blobRead(storeKey);
  if (mode === "local_file") {
    try { return JSON.parse(fs.readFileSync(LOCAL_PATHS[storeKey], "utf8")); } catch { return null; }
  }
  return volatileSnapshots.get(storeKey) || null;
}

async function writeTvDocument(storeKey, doc) {
  const mode = getTvStoreMode();
  if (mode === "blob") {
    await blobWrite(storeKey, doc);
  } else if (mode === "local_file") {
    const localPath = LOCAL_PATHS[storeKey];
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const tempPath = `${localPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(doc, null, 2), "utf8");
    fs.renameSync(tempPath, localPath);
  } else {
    volatileSnapshots.set(storeKey, doc);
  }
  return doc;
}

const readTvMetaAcquisition = () => readTvDocument(TV_META_ACQUISITION_STORE_KEY);
const writeTvMetaAcquisition = (doc) => writeTvDocument(TV_META_ACQUISITION_STORE_KEY, doc);
const readTvKpis = () => readTvDocument(TV_KPIS_STORE_KEY);
const writeTvKpis = (doc) => writeTvDocument(TV_KPIS_STORE_KEY, doc);
const readTvSubscriberDaily = () => readTvDocument(TV_SUBSCRIBER_DAILY_STORE_KEY);
const writeTvSubscriberDaily = (doc) => writeTvDocument(TV_SUBSCRIBER_DAILY_STORE_KEY, doc);

// When the subject line history was last written, without reading its ~5.7 MB: a Blob HEAD, or the
// local file's mtime. Null when the store cannot say (Redis or memory), which callers read as
// "re-read it".
async function readSubjectLineHistoryModifiedAt() {
  const mode = getHistoricalStoreProfile().mode;
  if (mode === "blob") {
    const head = await blobLastModified(SUBJECT_HISTORY_STORE_KEY);
    return head.exists ? head.lastModified : "";
  }
  if (mode === "local_file") {
    try { return fs.statSync(LOCAL_PATHS[SUBJECT_HISTORY_STORE_KEY]).mtime.toISOString(); } catch { return ""; }
  }
  return null;
}

module.exports = {
  getHistoricalStoreProfile,
  readHistoricalIntelligence,
  writeHistoricalIntelligence,
  readExpansionReach,
  writeExpansionReach,
  readAudienceSaturation,
  writeAudienceSaturation,
  readSubjectLineHistory,
  writeSubjectLineHistory,
  readSubjectLineTeam,
  writeSubjectLineTeam,
  readSubjectLineTags,
  writeSubjectLineTags,
  readAgentWatchdog,
  writeAgentWatchdog,
  readAgentEmailChecks,
  writeAgentEmailChecks,
  readSignupControl,
  writeSignupControl,
  readNightlySnapshotTimes,
  getTvStoreMode,
  readTvMetaAcquisition,
  writeTvMetaAcquisition,
  readTvKpis,
  writeTvKpis,
  readTvSubscriberDaily,
  writeTvSubscriberDaily,
  readSubjectLineHistoryModifiedAt
};
