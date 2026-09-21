// Persistence for Canva localization jobs and the recurring-exclusion memory.
//
// A job is the record of one source design turned into up to eighteen language versions. It has
// to survive the request that created it for three reasons: a batch of 18 spans several
// invocations on Vercel, a failed language must be retryable without redoing the other
// seventeen, and the operator needs to come back tomorrow and still find the generated designs.
//
// Same three backends as everything else (Redis / atomic local file / volatile), reusing
// `agent-store.js`'s plumbing. Jobs are stored one key each - writing the whole history on every
// target update would make an 18-language batch rewrite the same blob 18 times, and two
// languages finishing at once would lose one of them. The index is a separate, small list.

const fs = require("fs");
const path = require("path");
const { canUseLocalFile, redisCommand } = require("../campaign/agent-store");
const { normalizeLocalizationJob, rememberExclusions } = require("./localization");

const JOB_PREFIX = "westpack:canva:localization:job:v1";
const INDEX_KEY = "westpack:canva:localization:index:v1";
const EXCLUSIONS_KEY = "westpack:canva:localization:exclusions:v1";
const LOCAL_DIR = path.join(process.cwd(), "data", "canva-localization");
const LOCAL_INDEX_PATH = path.join(LOCAL_DIR, "_index.json");
const LOCAL_EXCLUSIONS_PATH = path.join(LOCAL_DIR, "_exclusions.json");
// Jobs expire in Redis so abandoned drafts do not accumulate. Ninety days is far beyond any
// campaign cycle, and the generated designs themselves live in Canva regardless.
const JOB_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_INDEXED_JOBS = 60;

const volatileJobs = new Map();
let volatileIndex = [];
let volatileExclusions = { fieldKeys: [], phrases: [] };

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

function getStoreProfile() {
  const redis = getRedisConfig();
  if (redis.url && redis.token) return { mode: "redis", persistent: true };
  if (canUseLocalFile()) return { mode: "local_file", persistent: true };
  return { mode: "volatile", persistent: false };
}

function normalizeJobId(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createJobId(sourceDesignId = "") {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6);
  return normalizeJobId(`loc-${sourceDesignId || "design"}-${stamp}-${suffix}`);
}

function jobKey(jobId) {
  return `${JOB_PREFIX}:${normalizeJobId(jobId)}`;
}

function localJobPath(jobId) {
  return path.join(LOCAL_DIR, `${normalizeJobId(jobId)}.json`);
}

function readLocalJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeLocalJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
}

function summariseForIndex(job) {
  return {
    id: job.id,
    sourceDesignId: job.sourceDesignId,
    sourceDesignTitle: job.sourceDesignTitle,
    baseTitle: job.baseTitle,
    state: job.state,
    targetCount: (job.targets || []).length,
    generatedCount: (job.targets || []).filter((target) => target.state === "generated").length,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

async function readJobIndex() {
  const profile = getStoreProfile();
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", INDEX_KEY]);
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  if (profile.mode === "local_file") {
    const parsed = readLocalJson(LOCAL_INDEX_PATH, []);
    return Array.isArray(parsed) ? parsed : [];
  }
  return volatileIndex;
}

async function writeJobIndex(entries) {
  const bounded = entries.slice(0, MAX_INDEXED_JOBS);
  const profile = getStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", INDEX_KEY, JSON.stringify(bounded)]);
  } else if (profile.mode === "local_file") {
    writeLocalJson(LOCAL_INDEX_PATH, bounded);
  } else {
    volatileIndex = bounded;
  }
  return bounded;
}

async function readLocalizationJob(jobId) {
  const id = normalizeJobId(jobId);
  if (!id) return null;
  const profile = getStoreProfile();

  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", jobKey(id)]);
    if (!raw) return null;
    try {
      return normalizeLocalizationJob(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (error) {
      return null;
    }
  }
  if (profile.mode === "local_file") {
    const parsed = readLocalJson(localJobPath(id), null);
    return parsed ? normalizeLocalizationJob(parsed) : null;
  }
  const stored = volatileJobs.get(id);
  return stored ? normalizeLocalizationJob(stored) : null;
}

async function writeLocalizationJob(jobValue) {
  const job = normalizeLocalizationJob({
    ...jobValue,
    id: normalizeJobId(jobValue?.id) || createJobId(jobValue?.sourceDesignId),
    updatedAt: new Date().toISOString()
  });

  const profile = getStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", jobKey(job.id), JSON.stringify(job), "EX", String(JOB_TTL_SECONDS)]);
  } else if (profile.mode === "local_file") {
    writeLocalJson(localJobPath(job.id), job);
  } else {
    volatileJobs.set(job.id, job);
  }

  const index = await readJobIndex();
  const next = [summariseForIndex(job), ...index.filter((entry) => entry.id !== job.id)];
  await writeJobIndex(next);

  return job;
}

async function deleteLocalizationJob(jobId) {
  const id = normalizeJobId(jobId);
  if (!id) return;
  const profile = getStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["DEL", jobKey(id)]);
  } else if (profile.mode === "local_file") {
    try {
      fs.unlinkSync(localJobPath(id));
    } catch (error) {
      // Already gone.
    }
  } else {
    volatileJobs.delete(id);
  }
  const index = await readJobIndex();
  await writeJobIndex(index.filter((entry) => entry.id !== id));
}

async function listLocalizationJobs(limit = 20) {
  const index = await readJobIndex();
  return index.slice(0, Math.max(1, Number(limit) || 20));
}

function normalizeExclusions(value) {
  return {
    fieldKeys: Array.isArray(value?.fieldKeys) ? value.fieldKeys.map((item) => String(item)) : [],
    phrases: Array.isArray(value?.phrases) ? value.phrases.map((item) => String(item)) : []
  };
}

async function readExclusionMemory() {
  const profile = getStoreProfile();
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", EXCLUSIONS_KEY]);
    if (!raw) return { fieldKeys: [], phrases: [] };
    try {
      return normalizeExclusions(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (error) {
      return { fieldKeys: [], phrases: [] };
    }
  }
  if (profile.mode === "local_file") {
    return normalizeExclusions(readLocalJson(LOCAL_EXCLUSIONS_PATH, null));
  }
  return normalizeExclusions(volatileExclusions);
}

async function writeExclusionMemory(value) {
  const memory = normalizeExclusions(value);
  const profile = getStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", EXCLUSIONS_KEY, JSON.stringify(memory)]);
  } else if (profile.mode === "local_file") {
    writeLocalJson(LOCAL_EXCLUSIONS_PATH, memory);
  } else {
    volatileExclusions = memory;
  }
  return memory;
}

// Called whenever an operator saves a field plan. Exclusions accumulate: the designer names the
// brand line the same thing in every master, so the second campaign should arrive with it already
// unticked.
async function recordExclusions(fields = []) {
  const current = await readExclusionMemory();
  return writeExclusionMemory(rememberExclusions(current, fields));
}

module.exports = {
  createJobId,
  deleteLocalizationJob,
  getStoreProfile,
  listLocalizationJobs,
  normalizeJobId,
  readExclusionMemory,
  readLocalizationJob,
  recordExclusions,
  writeExclusionMemory,
  writeLocalizationJob
};
