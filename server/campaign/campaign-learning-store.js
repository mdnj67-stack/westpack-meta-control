const fs = require("fs");
const path = require("path");

const STORE_KEY = "westpack:campaign-learning:events:v1";
const LOCAL_PATH = path.join(process.cwd(), "data", "campaign-learning-events.json");
const MAX_EVENTS = 500;
let volatileEvents = [];

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

function readLocalEvents() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed.map(normalizeEvent).slice(0, MAX_EVENTS) : [];
  } catch (error) {
    return [];
  }
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
  const events = profile.mode === "local_file" ? readLocalEvents() : volatileEvents;
  if (event.fingerprint && events.some((item) => item.fingerprint === event.fingerprint)) return { event, recorded: false, duplicate: true };
  const next = [event, ...events].slice(0, MAX_EVENTS);
  if (profile.mode === "local_file") {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    const tempPath = `${LOCAL_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(tempPath, LOCAL_PATH);
  } else {
    volatileEvents = next;
  }
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
  return (profile.mode === "local_file" ? readLocalEvents() : volatileEvents).slice(0, safeLimit);
}

async function replaceCampaignLearningEvents(events = []) {
  const rows = (Array.isArray(events) ? events : []).map(normalizeEvent).slice(0, MAX_EVENTS);
  const profile = getCampaignLearningStoreProfile();
  if (profile.mode === "redis") {
    const encodedRows = rows.map((event) => JSON.stringify(event));
    const script = "local rows=cjson.decode(ARGV[1]); redis.call('DEL',KEYS[1]); for i=1,#rows do redis.call('RPUSH',KEYS[1],rows[i]); end; return #rows";
    await redisCommand(["EVAL", script, "1", STORE_KEY, JSON.stringify(encodedRows)]);
  } else if (profile.mode === "local_file") {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    const tempPath = `${LOCAL_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(rows, null, 2), "utf8");
    fs.renameSync(tempPath, LOCAL_PATH);
  } else {
    volatileEvents = rows;
  }
  return rows;
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
  const events = await readCampaignLearningEvents(MAX_EVENTS);
  const index = events.findIndex((event) => event.id === id);
  if (index < 0) throw new Error("Learning event was not found.");
  const previous = events[index];
  if (action === "delete") {
    events.splice(index, 1);
    await replaceCampaignLearningEvents(events);
    return { operation: action, deleted: true, event: previous };
  }
  const status = action === "approve" ? "approved" : action === "disable" ? "disabled" : "active";
  events[index] = normalizeEvent({ ...previous, moderationStatus: status, operatorNote, moderatedAt: new Date().toISOString() });
  await replaceCampaignLearningEvents(events);
  return { operation: action, deleted: false, event: events[index] };
}

module.exports = {
  getCampaignLearningStoreProfile,
  moderateCampaignLearningEvent,
  readCampaignLearningEvents,
  recordCampaignLearningEvent,
  replaceCampaignLearningEvents
};
