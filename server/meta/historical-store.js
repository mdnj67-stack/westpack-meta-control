const fs = require("fs");
const path = require("path");

const STORE_KEY = "westpack:meta-historical-intelligence:v1";
const LOCAL_PATH = path.join(process.cwd(), "data", "meta-historical-intelligence.json");
let volatileSnapshot = null;

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

async function readHistoricalIntelligence() {
  const profile = getHistoricalStoreProfile();
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", STORE_KEY]);
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  }
  if (profile.mode === "local_file") {
    try { return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8")); } catch { return null; }
  }
  return volatileSnapshot;
}

async function writeHistoricalIntelligence(snapshot) {
  const profile = getHistoricalStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", STORE_KEY, JSON.stringify(snapshot)]);
  } else if (profile.mode === "local_file") {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    const tempPath = `${LOCAL_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
    fs.renameSync(tempPath, LOCAL_PATH);
  } else {
    volatileSnapshot = snapshot;
  }
  return snapshot;
}

module.exports = { getHistoricalStoreProfile, readHistoricalIntelligence, writeHistoricalIntelligence };
