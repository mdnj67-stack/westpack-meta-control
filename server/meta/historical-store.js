const fs = require("fs");
const path = require("path");

// Two snapshots share this module's storage plumbing: the historical creative
// intelligence the Content Agent reads, and the expansion reach series the Meta
// dashboard renders. They are kept under separate keys rather than in one blob,
// because each is written by its own nightly job and a shared value would make
// one job's write clobber the other's.
const HISTORICAL_STORE_KEY = "westpack:meta-historical-intelligence:v1";
const EXPANSION_STORE_KEY = "westpack:meta-expansion-reach:v1";

const LOCAL_PATHS = {
  [HISTORICAL_STORE_KEY]: path.join(process.cwd(), "data", "meta-historical-intelligence.json"),
  [EXPANSION_STORE_KEY]: path.join(process.cwd(), "data", "meta-expansion-reach.json")
};

const volatileSnapshots = new Map();

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

function getHistoricalStoreProfile() {
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
  if (profile.mode === "redis") {
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

module.exports = {
  getHistoricalStoreProfile,
  readHistoricalIntelligence,
  writeHistoricalIntelligence,
  readExpansionReach,
  writeExpansionReach
};
