const fs = require("fs");
const path = require("path");

// Six snapshots share this module's storage plumbing: the historical creative
// intelligence the Content Agent reads, the expansion reach series and the
// audience saturation table the Meta dashboard renders, and the subject line
// generator's Klaviyo send history, its mechanism tags and team data. They are kept under separate keys rather than in one blob,
// because each is written by its own job and a shared value would make
// one job's write clobber the other's.
const HISTORICAL_STORE_KEY = "westpack:meta-historical-intelligence:v1";
const EXPANSION_STORE_KEY = "westpack:meta-expansion-reach:v1";
const SATURATION_STORE_KEY = "westpack:meta-audience-saturation:v1";
const SUBJECT_HISTORY_STORE_KEY = "westpack:klaviyo-subject-line-history:v1";
const SUBJECT_TEAM_STORE_KEY = "westpack:klaviyo-subject-line-team:v1";
const SUBJECT_TAGS_STORE_KEY = "westpack:klaviyo-subject-line-tags:v1";

const LOCAL_PATHS = {
  [HISTORICAL_STORE_KEY]: path.join(process.cwd(), "data", "meta-historical-intelligence.json"),
  [EXPANSION_STORE_KEY]: path.join(process.cwd(), "data", "meta-expansion-reach.json"),
  [SATURATION_STORE_KEY]: path.join(process.cwd(), "data", "meta-audience-saturation.json"),
  [SUBJECT_HISTORY_STORE_KEY]: path.join(process.cwd(), "data", "klaviyo-subject-line-history.json"),
  [SUBJECT_TEAM_STORE_KEY]: path.join(process.cwd(), "data", "klaviyo-subject-line-team.json"),
  [SUBJECT_TAGS_STORE_KEY]: path.join(process.cwd(), "data", "klaviyo-subject-line-tags.json")
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
  [SUBJECT_TAGS_STORE_KEY]: "klaviyo-snapshots/subject-line-tags.json"
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
  writeSubjectLineTags
};
