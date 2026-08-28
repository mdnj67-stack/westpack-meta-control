const fs = require("fs");
const path = require("path");
const { createInitialAgentState, normalizeAgentState } = require("./content-agent");

const STORE_KEY = "westpack:content-agent:state:v1";
const CONTROL_KEY = `${STORE_KEY}:operator-controls`;
const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "content-agent-state.json");
let volatileState = createInitialAgentState();
let volatileControls = [];

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

async function redisCommand(command = []) {
  const redis = getRedisConfig();
  if (!redis.url || !redis.token) throw new Error("Redis persistence is not configured.");
  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `Redis request failed (${response.status}).`);
  return payload?.result;
}

function canUseLocalFile() {
  return !process.env.VERCEL;
}

function readLocalState() {
  try {
    return normalizeAgentState(JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, "utf8")));
  } catch (error) {
    return createInitialAgentState();
  }
}

function writeLocalState(state) {
  fs.mkdirSync(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  const tempPath = `${LOCAL_STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tempPath, LOCAL_STORE_PATH);
}

function getAgentStoreProfile() {
  const redis = getRedisConfig();
  if (redis.url && redis.token) return { mode: "redis", persistent: true };
  if (canUseLocalFile()) return { mode: "local_file", persistent: true };
  return { mode: "volatile", persistent: false };
}

async function readAgentState() {
  const profile = getAgentStoreProfile();
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", STORE_KEY]);
    return normalizeAgentState(raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null);
  }
  if (profile.mode === "local_file") return readLocalState();
  return normalizeAgentState(volatileState);
}

async function writeAgentState(stateValue) {
  const state = normalizeAgentState(stateValue);
  const profile = getAgentStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", STORE_KEY, JSON.stringify(state)]);
  } else if (profile.mode === "local_file") {
    writeLocalState(state);
  } else {
    volatileState = state;
  }
  return state;
}

async function acquireAgentLock(lockId, ttlSeconds = 290) {
  const profile = getAgentStoreProfile();
  if (profile.mode !== "redis") return true;
  const result = await redisCommand(["SET", `${STORE_KEY}:lock`, String(lockId), "NX", "EX", String(ttlSeconds)]);
  return result === "OK";
}

async function releaseAgentLock(lockId) {
  const profile = getAgentStoreProfile();
  if (profile.mode !== "redis") return;
  const current = await redisCommand(["GET", `${STORE_KEY}:lock`]);
  if (String(current || "") === String(lockId || "")) await redisCommand(["DEL", `${STORE_KEY}:lock`]);
}

async function queueAgentControlCommand(command = {}) {
  const entry = {
    ...command,
    id: String(command.id || `control_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    requestedAt: String(command.requestedAt || new Date().toISOString())
  };
  const profile = getAgentStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["RPUSH", CONTROL_KEY, JSON.stringify(entry)]);
    await redisCommand(["EXPIRE", CONTROL_KEY, "86400"]);
  } else {
    volatileControls.push(entry);
    volatileControls = volatileControls.slice(-50);
  }
  return entry;
}

async function drainAgentControlCommands(limit = 20) {
  const profile = getAgentStoreProfile();
  if (profile.mode !== "redis") {
    const entries = volatileControls.splice(0, Math.max(1, Number(limit || 20)));
    return entries;
  }
  const entries = [];
  for (let index = 0; index < Math.max(1, Number(limit || 20)); index += 1) {
    const raw = await redisCommand(["LPOP", CONTROL_KEY]);
    if (!raw) break;
    try {
      entries.push(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (error) {
      // Invalid operator commands are discarded instead of blocking production.
    }
  }
  return entries;
}

module.exports = {
  acquireAgentLock,
  drainAgentControlCommands,
  getAgentStoreProfile,
  readAgentState,
  releaseAgentLock,
  queueAgentControlCommand,
  writeAgentState
};
