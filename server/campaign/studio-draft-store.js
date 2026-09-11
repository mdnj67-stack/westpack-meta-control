// Campaign Studio's AI output is stored server-side by the Content Agent, but everything a human
// then did to it - module edits, carousel card drafts, the chosen creative route, Meta targeting -
// lived only in that operator's `localStorage`. Two people could not work on the same campaign, an
// edit did not survive a change of machine, and a cleared cache lost the work outright. This store
// keeps the operator's draft beside the agent's own state, on the same three backends.

const fs = require("fs");
const path = require("path");
const { canUseLocalFile, getAgentStoreProfile, redisCommand } = require("./agent-store");

const STORE_PREFIX = "westpack:campaign-studio:draft:v1";
const LOCAL_STORE_DIR = path.join(process.cwd(), "data", "campaign-studio-drafts");
// Redis entries expire so abandoned drafts do not accumulate forever. Ninety days is well beyond
// any real campaign cycle, so an operator never loses live work to it.
const DRAFT_TTL_SECONDS = 90 * 24 * 60 * 60;
// Drafts can carry rendered carousel cards as data URIs. Refusing an oversized one with a clear
// message is better than a Redis write that fails halfway through a save the operator trusted.
const MAX_DRAFT_BYTES = 4_000_000;

const volatileDrafts = new Map();

function normalizeCampaignKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled-campaign";
}

function redisKey(campaignKey) {
  return `${STORE_PREFIX}:${normalizeCampaignKey(campaignKey)}`;
}

function localPath(campaignKey) {
  return path.join(LOCAL_STORE_DIR, `${normalizeCampaignKey(campaignKey)}.json`);
}

function readLocalDraft(campaignKey) {
  try {
    return JSON.parse(fs.readFileSync(localPath(campaignKey), "utf8"));
  } catch (error) {
    return null;
  }
}

function writeLocalDraft(campaignKey, record) {
  fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
  const target = localPath(campaignKey);
  const tempPath = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(record, null, 2), "utf8");
  fs.renameSync(tempPath, target);
}

function deleteLocalDraft(campaignKey) {
  try {
    fs.unlinkSync(localPath(campaignKey));
  } catch (error) {
    // Already gone is the outcome the caller wanted.
  }
}

function resolveMode() {
  const profile = getAgentStoreProfile();
  if (profile.mode === "redis") return "redis";
  return canUseLocalFile() ? "local_file" : "volatile";
}

function getStudioDraftStoreProfile() {
  const mode = resolveMode();
  return { mode, persistent: mode !== "volatile" };
}

async function readStudioDraft(campaignKey) {
  const mode = resolveMode();
  if (mode === "redis") {
    try {
      const raw = await redisCommand(["GET", redisKey(campaignKey)]);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      // A draft that cannot be read must not take the whole Studio down; the operator still has
      // their own browser copy, and the caller reports the degraded state.
      return null;
    }
  }
  if (mode === "local_file") return readLocalDraft(campaignKey);
  return volatileDrafts.get(normalizeCampaignKey(campaignKey)) || null;
}

async function writeStudioDraft(campaignKey, payload = {}, options = {}) {
  const record = {
    campaignKey: normalizeCampaignKey(campaignKey),
    savedAt: new Date().toISOString(),
    savedBy: String(options.savedBy || "").slice(0, 120),
    ...payload
  };
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_DRAFT_BYTES) {
    throw new Error(`Campaign Studio draft is ${Math.round(serialized.length / 1000)}kB, above the ${Math.round(MAX_DRAFT_BYTES / 1000)}kB limit.`);
  }

  const mode = resolveMode();
  if (mode === "redis") {
    await redisCommand(["SET", redisKey(campaignKey), serialized, "EX", String(DRAFT_TTL_SECONDS)]);
  } else if (mode === "local_file") {
    writeLocalDraft(campaignKey, record);
  } else {
    volatileDrafts.set(record.campaignKey, record);
  }
  return record;
}

async function deleteStudioDraft(campaignKey) {
  const mode = resolveMode();
  if (mode === "redis") {
    await redisCommand(["DEL", redisKey(campaignKey)]);
  } else if (mode === "local_file") {
    deleteLocalDraft(campaignKey);
  } else {
    volatileDrafts.delete(normalizeCampaignKey(campaignKey));
  }
  return true;
}

module.exports = {
  DRAFT_TTL_SECONDS,
  MAX_DRAFT_BYTES,
  deleteStudioDraft,
  getStudioDraftStoreProfile,
  normalizeCampaignKey,
  readStudioDraft,
  writeStudioDraft
};
