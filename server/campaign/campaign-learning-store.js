const fs = require("fs");
const path = require("path");
const { acquireLocalLock, releaseLocalLock } = require("./agent-store");

const STORE_KEY = "westpack:campaign-learning:events:v1";
const LOCAL_PATH = path.join(process.cwd(), "data", "campaign-learning-events.json");
// Dedicated lock file, distinct from agent-store's content-agent-state.lock.json, so the two
// subsystems never contend on the same lock for unrelated work.
const LOCAL_LOCK_PATH = path.join(process.cwd(), "data", "campaign-learning-events.lock.json");
const LOCAL_LOCK_TTL_SECONDS = 30;
const MAX_EVENTS = 500;
let volatileEvents = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// local_file mode has no cross-invocation mutual exclusion otherwise (same gap agent-store.js
// fixed for content-agent-state.json): two overlapping writers can each read the same base
// array, mutate their own copy, and have the second write silently clobber the first. This holds
// a real file lock across the whole read -> mutate -> write cycle, retrying (rather than failing
// fast) so a contended writer waits its turn instead of dropping its event.
async function withLocalLearningLock(fn) {
  const lockId = `learning_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const deadline = Date.now() + 10000;
  while (!acquireLocalLock(lockId, LOCAL_LOCK_TTL_SECONDS, LOCAL_LOCK_PATH)) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the campaign learning store lock.");
    await sleep(10 + Math.floor(Math.random() * 15));
  }
  try {
    return await fn();
  } finally {
    releaseLocalLock(lockId, LOCAL_LOCK_PATH);
  }
}

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

async function redisCommand(command) {
  const redis = getRedisConfig();
  if (!redis.url || !redis.token) throw new Error("Campaign learning persistence is not configured.");
  const response = await fetch(redis.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `Campaign learning store failed (${response.status}).`);
  return payload.result;
}

function getCampaignLearningStoreProfile() {
  const redis = getRedisConfig();
  if (redis.url && redis.token) return { mode: "redis", persistent: true };
  if (!process.env.VERCEL) return { mode: "local_file", persistent: true };
  return { mode: "volatile", persistent: false };
}

function normalizeEvent(value = {}) {
  return {
    id: String(value.id || `learn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    type: String(value.type || "editor_saved").slice(0, 60),
    channel: String(value.channel || "cross_channel").slice(0, 40),
    jobId: String(value.jobId || "").slice(0, 160),
    campaignTaskGid: String(value.campaignTaskGid || "").slice(0, 160),
    campaignName: String(value.campaignName || "").slice(0, 240),
    reason: String(value.reason || "").trim().slice(0, 1200),
    evidenceLevel: String(value.evidenceLevel || "editing_signal").slice(0, 60),
    fingerprint: String(value.fingerprint || "").slice(0, 180),
    diff: value.diff && typeof value.diff === "object" ? value.diff : null,
    performance: value.performance && typeof value.performance === "object" ? value.performance : null,
    metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {},
    outcome: value.outcome && typeof value.outcome === "object" ? value.outcome : {},
    moderationStatus: new Set(["active", "approved", "disabled"]).has(String(value.moderationStatus || "")) ? String(value.moderationStatus) : "active",
    operatorNote: String(value.operatorNote || "").trim().slice(0, 800),
    moderatedAt: String(value.moderatedAt || ""),
    createdAt: String(value.createdAt || new Date().toISOString())
  };
}

function readLocalEventsRaw() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed.map(normalizeEvent).slice(0, MAX_EVENTS) : [];
  } catch (error) {
    return [];
  }
}

function writeLocalEventsRaw(rows) {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  const tempPath = `${LOCAL_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(rows, null, 2), "utf8");
  fs.renameSync(tempPath, LOCAL_PATH);
}

async function recordCampaignLearningEvent(value = {}) {
  const event = normalizeEvent(value);
  const profile = getCampaignLearningStoreProfile();
  if (profile.mode === "redis") {
    if (event.fingerprint) {
      const accepted = await redisCommand(["SET", `${STORE_KEY}:fingerprint:${event.fingerprint}`, "1", "NX", "EX", "604800"]);
      if (accepted !== "OK") return { event, recorded: false, duplicate: true };
    }
    await redisCommand(["LPUSH", STORE_KEY, JSON.stringify(event)]);
    await redisCommand(["LTRIM", STORE_KEY, "0", String(MAX_EVENTS - 1)]);
    return { event, recorded: true, duplicate: false };
  }
  if (profile.mode === "local_file") {
    // Read, dedupe-check and write all happen inside one lock hold so a second overlapping
    // writer can't read the same base array and silently clobber this write.
    return withLocalLearningLock(async () => {
      const events = readLocalEventsRaw();
      if (event.fingerprint && events.some((item) => item.fingerprint === event.fingerprint)) return { event, recorded: false, duplicate: true };
      const next = [event, ...events].slice(0, MAX_EVENTS);
      writeLocalEventsRaw(next);
      return { event, recorded: true, duplicate: false };
    });
  }
  const events = volatileEvents;
  if (event.fingerprint && events.some((item) => item.fingerprint === event.fingerprint)) return { event, recorded: false, duplicate: true };
  volatileEvents = [event, ...events].slice(0, MAX_EVENTS);
  return { event, recorded: true, duplicate: false };
}

async function readCampaignLearningEvents(limit = 120) {
  const safeLimit = Math.max(1, Math.min(MAX_EVENTS, Number(limit || 120)));
  const profile = getCampaignLearningStoreProfile();
  if (profile.mode === "redis") {
    const rows = await redisCommand(["LRANGE", STORE_KEY, "0", String(safeLimit - 1)]);
    return (Array.isArray(rows) ? rows : []).map((row) => {
      try { return normalizeEvent(typeof row === "string" ? JSON.parse(row) : row); } catch { return null; }
    }).filter(Boolean);
  }
  // A plain read never needs the lock: writers always replace the file atomically via
  // rename, so a concurrent reader either sees the pre- or post-write state, never a partial one.
  return (profile.mode === "local_file" ? readLocalEventsRaw() : volatileEvents).slice(0, safeLimit);
}

async function replaceCampaignLearningEvents(events = []) {
  const rows = (Array.isArray(events) ? events : []).map(normalizeEvent).slice(0, MAX_EVENTS);
  const profile = getCampaignLearningStoreProfile();
  if (profile.mode === "redis") {
    const encodedRows = rows.map((event) => JSON.stringify(event));
    const script = "local rows=cjson.decode(ARGV[1]); redis.call('DEL',KEYS[1]); for i=1,#rows do redis.call('RPUSH',KEYS[1],rows[i]); end; return #rows";
    await redisCommand(["EVAL", script, "1", STORE_KEY, JSON.stringify(encodedRows)]);
  } else if (profile.mode === "local_file") {
    await withLocalLearningLock(async () => {
      writeLocalEventsRaw(rows);
    });
  } else {
    volatileEvents = rows;
  }
  return rows;
}

function applyLearningModeration(events, id, action, operatorNote) {
  const index = events.findIndex((event) => event.id === id);
  if (index < 0) throw new Error("Learning event was not found.");
  const previous = events[index];
  if (action === "delete") {
    events.splice(index, 1);
    return { rows: events, result: { operation: action, deleted: true, event: previous } };
  }
  const status = action === "approve" ? "approved" : action === "disable" ? "disabled" : "active";
  events[index] = normalizeEvent({ ...previous, moderationStatus: status, operatorNote, moderatedAt: new Date().toISOString() });
  return { rows: events, result: { operation: action, deleted: false, event: events[index] } };
}

async function moderateCampaignLearningEvent(eventId = "", operation = "", operatorNote = "") {
  const id = String(eventId || "").trim();
  const action = String(operation || "").toLowerCase();
  if (!id) throw new Error("Learning event id is required.");
  if (!new Set(["approve", "disable", "enable", "delete"]).has(action)) throw new Error("Unsupported learning moderation operation.");
  const profile = getCampaignLearningStoreProfile();
  if (profile.mode === "redis") {
    const status = action === "approve" ? "approved" : action === "disable" ? "disabled" : "active";
    const script = "local rows=redis.call('LRANGE',KEYS[1],0,-1); local next={}; local found=nil; for i=1,#rows do local event=cjson.decode(rows[i]); if event.id==ARGV[1] then found=event; if ARGV[2]~='delete' then event.moderationStatus=ARGV[3]; event.operatorNote=ARGV[4]; event.moderatedAt=ARGV[5]; table.insert(next,cjson.encode(event)); found=event; end else table.insert(next,rows[i]); end; end; if not found then return cjson.encode({error='not_found'}); end; redis.call('DEL',KEYS[1]); if #next>0 then redis.call('RPUSH',KEYS[1],unpack(next)); end; return cjson.encode({deleted=ARGV[2]=='delete',event=found});";
    const raw = await redisCommand(["EVAL", script, "1", STORE_KEY, id, action, status, String(operatorNote || "").trim().slice(0, 800), new Date().toISOString()]);
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (result?.error === "not_found") throw new Error("Learning event was not found.");
    return { operation: action, deleted: Boolean(result?.deleted), event: normalizeEvent(result?.event || {}) };
  }
  if (profile.mode === "local_file") {
    // Read + modify + write inside a single lock hold, mirroring the redis path's atomic Lua
    // script: an overlapping recordCampaignLearningEvent/replaceCampaignLearningEvents call
    // cannot land its write in the gap between this reading the file and writing it back.
    return withLocalLearningLock(async () => {
      const events = readLocalEventsRaw();
      const { rows, result } = applyLearningModeration(events, id, action, operatorNote);
      writeLocalEventsRaw(rows);
      return result;
    });
  }
  const events = await readCampaignLearningEvents(MAX_EVENTS);
  const { rows, result } = applyLearningModeration(events, id, action, operatorNote);
  await replaceCampaignLearningEvents(rows);
  return result;
}

module.exports = {
  getCampaignLearningStoreProfile,
  moderateCampaignLearningEvent,
  readCampaignLearningEvents,
  recordCampaignLearningEvent,
  replaceCampaignLearningEvents
};
