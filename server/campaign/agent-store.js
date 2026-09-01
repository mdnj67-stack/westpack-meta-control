const fs = require("fs");
const path = require("path");
const { createInitialAgentState, normalizeAgentState } = require("./content-agent");

const STORE_KEY = "westpack:content-agent:state:v1";
const CONTROL_KEY = `${STORE_KEY}:operator-controls`;
const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "content-agent-state.json");
const LOCAL_LOCK_PATH = path.join(process.cwd(), "data", "content-agent-state.lock.json");
const LOCAL_CONTROLS_PATH = path.join(process.cwd(), "data", "content-agent-controls.json");
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

function readLocalLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_LOCK_PATH, "utf8"));
  } catch (error) {
    return null;
  }
}

function acquireLocalLock(lockId, ttlSeconds) {
  const now = Date.now();
  const expiresAt = now + Math.max(1, Number(ttlSeconds) || 0) * 1000;
  const payload = JSON.stringify({ lockId: String(lockId), expiresAt });
  fs.mkdirSync(path.dirname(LOCAL_LOCK_PATH), { recursive: true });
  try {
    // Exclusive create is atomic at the OS level, so a fresh lock can't race another acquirer.
    fs.writeFileSync(LOCAL_LOCK_PATH, payload, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const current = readLocalLock();
  if (current && String(current.lockId) !== String(lockId) && Number(current.expiresAt) > now) {
    return false;
  }
  // The held lock looks stale (or unreadable): steal it. A plain overwrite here would let two
  // callers racing the same expiry both believe they won, so possession is taken atomically
  // first (fs.renameSync on the existing lock path — if two callers race this, only one rename
  // of LOCAL_LOCK_PATH can succeed; the loser's rename source is already gone and throws ENOENT),
  // and only *after* holding it exclusively do we decide whether the steal was actually valid.
  // That second check matters because the file we renamed away might not be the stale lock we
  // just read: another caller could have raced in and written a fresh, non-expired lock into the
  // gap between our read above and our rename below. If so, we put back exactly what we took and
  // report failure, instead of destroying someone else's valid lock.
  const stolenPath = `${LOCAL_LOCK_PATH}.${process.pid}.${now}.stolen`;
  try {
    fs.renameSync(LOCAL_LOCK_PATH, stolenPath);
  } catch (error) {
    if (error.code === "ENOENT") return false; // another caller already took it
    throw error;
  }
  let heldLock = null;
  try {
    heldLock = JSON.parse(fs.readFileSync(stolenPath, "utf8"));
  } catch (error) {
    heldLock = null; // unreadable/corrupt — treat the same as "no valid lock", safe to steal
  }
  const stillStale = !heldLock || String(heldLock.lockId) === String(lockId) || Number(heldLock.expiresAt) <= now;
  if (!stillStale) {
    try {
      fs.renameSync(stolenPath, LOCAL_LOCK_PATH);
    } catch (error) {
      // Could not restore it (e.g. its owner already renewed/released independently) — either
      // way we did not win the steal.
    }
    return false;
  }
  try {
    // Exclusive create: guards against a fresh (non-expired) lock being written by a different
    // caller in the brief window between validating heldLock above and this write.
    fs.writeFileSync(LOCAL_LOCK_PATH, payload, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return false;
  }
  try {
    fs.unlinkSync(stolenPath);
  } catch (error) {
    // Best-effort cleanup of the stolen-lock marker; leaving it behind is harmless.
  }
  return true;
}

function releaseLocalLock(lockId) {
  const current = readLocalLock();
  if (!current || String(current.lockId) !== String(lockId)) return;
  try {
    fs.unlinkSync(LOCAL_LOCK_PATH);
  } catch (error) {
    // Already released.
  }
}

function readLocalControls() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_CONTROLS_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLocalControls(entries) {
  fs.mkdirSync(path.dirname(LOCAL_CONTROLS_PATH), { recursive: true });
  const tempPath = `${LOCAL_CONTROLS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(entries, null, 2), "utf8");
  fs.renameSync(tempPath, LOCAL_CONTROLS_PATH);
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
  if (profile.mode === "redis") {
    const result = await redisCommand(["SET", `${STORE_KEY}:lock`, String(lockId), "NX", "EX", String(ttlSeconds)]);
    return result === "OK";
  }
  if (profile.mode === "local_file") return acquireLocalLock(lockId, ttlSeconds);
  // Volatile mode has no cross-invocation persistence at all, so a lock can't mean anything
  // here — deliberately left always-granting rather than faked.
  return true;
}

async function releaseAgentLock(lockId) {
  const profile = getAgentStoreProfile();
  if (profile.mode === "redis") {
    const current = await redisCommand(["GET", `${STORE_KEY}:lock`]);
    if (String(current || "") === String(lockId || "")) await redisCommand(["DEL", `${STORE_KEY}:lock`]);
    return;
  }
  if (profile.mode === "local_file") releaseLocalLock(lockId);
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
  } else if (profile.mode === "local_file") {
    const entries = readLocalControls();
    entries.push(entry);
    writeLocalControls(entries.slice(-50));
  } else {
    volatileControls.push(entry);
    volatileControls = volatileControls.slice(-50);
  }
  return entry;
}

async function drainAgentControlCommands(limit = 20) {
  const profile = getAgentStoreProfile();
  if (profile.mode === "local_file") {
    const count = Math.max(1, Number(limit || 20));
    const entries = readLocalControls();
    const drained = entries.slice(0, count);
    writeLocalControls(entries.slice(count));
    return drained;
  }
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
  acquireLocalLock,
  drainAgentControlCommands,
  getAgentStoreProfile,
  readAgentState,
  releaseAgentLock,
  queueAgentControlCommand,
  writeAgentState
};
