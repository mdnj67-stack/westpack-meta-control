// The Campaign Studio asset library lived entirely in the operator's browser, in IndexedDB, with
// the image bytes inlined as data URIs. That made every cropped variant, generated environment
// shot and approved source photograph private to one machine: a colleague opening the same
// campaign saw an empty library, and clearing site data destroyed the work.
//
// This store holds the library's *metadata* only. Image bytes belong in Klaviyo's permanent image
// library, which the client uploads to before saving a record, so what is stored here is a CDN URL
// rather than a base64 payload. Keeping binaries out is what lets the whole library move in a
// single round trip, the same way the agent state and the studio draft do.

const fs = require("fs");
const path = require("path");
const { canUseLocalFile, getAgentStoreProfile, redisCommand } = require("./agent-store");
const { normalizeCampaignKey } = require("./studio-draft-store");

const STORE_PREFIX = "westpack:campaign-studio:assets:v1";
const LOCAL_STORE_DIR = path.join(process.cwd(), "data", "campaign-asset-library");
const RECORD_TTL_SECONDS = 180 * 24 * 60 * 60;
const MAX_RECORDS_PER_CAMPAIGN = 400;
// A record that still carries an inlined image has not been hosted, and storing it would put the
// binary back where it came from. The client is expected to host first; this is the backstop.
const MAX_RECORD_BYTES = 20_000;

const volatileLibraries = new Map();

function redisKey(campaignKey) {
  return `${STORE_PREFIX}:${normalizeCampaignKey(campaignKey)}`;
}

function localPath(campaignKey) {
  return path.join(LOCAL_STORE_DIR, `${normalizeCampaignKey(campaignKey)}.json`);
}

function resolveMode() {
  if (getAgentStoreProfile().mode === "redis") return "redis";
  return canUseLocalFile() ? "local_file" : "volatile";
}

function getAssetLibraryStoreProfile() {
  const mode = resolveMode();
  return { mode, persistent: mode !== "volatile" };
}

function normalizeRecord(input = {}) {
  const imageUrl = String(input.imageUrl || "");
  if (imageUrl.startsWith("data:")) {
    throw new Error("Campaign asset must be hosted before it is saved to the shared library.");
  }
  const record = {
    id: String(input.id || "").slice(0, 80),
    campaignKey: normalizeCampaignKey(input.campaignKey || ""),
    assetType: String(input.assetType || "asset").slice(0, 60),
    logicalName: String(input.logicalName || input.name || "asset").slice(0, 200),
    name: String(input.name || "asset").slice(0, 200),
    familyKey: String(input.familyKey || "").slice(0, 200),
    version: Number(input.version) || 1,
    format: String(input.format || "").slice(0, 60),
    preset: String(input.preset || "").slice(0, 60),
    role: String(input.role || "").slice(0, 60),
    // Deliberately truncated: a generation prompt can be long, and the library is a catalogue
    // rather than the place that reproduces an image.
    prompt: String(input.prompt || "").slice(0, 600),
    channelTags: (Array.isArray(input.channelTags) ? input.channelTags : []).map((tag) => String(tag).slice(0, 40)).slice(0, 8),
    approved: input.approved !== false,
    imageUrl,
    sourceAssetId: String(input.sourceAssetId || "").slice(0, 80),
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };
  if (!record.id) throw new Error("Campaign asset record needs an id.");
  if (JSON.stringify(record).length > MAX_RECORD_BYTES) {
    throw new Error("Campaign asset record is too large for the shared library.");
  }
  return record;
}

function readLocalLibrary(campaignKey) {
  try {
    const parsed = JSON.parse(fs.readFileSync(localPath(campaignKey), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLocalLibrary(campaignKey, records) {
  fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
  const target = localPath(campaignKey);
  const tempPath = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf8");
  fs.renameSync(tempPath, target);
}

async function readAssetLibrary(campaignKey) {
  const mode = resolveMode();
  if (mode === "redis") {
    try {
      const raw = await redisCommand(["GET", redisKey(campaignKey)]);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  if (mode === "local_file") return readLocalLibrary(campaignKey);
  return volatileLibraries.get(normalizeCampaignKey(campaignKey)) || [];
}

async function persistLibrary(campaignKey, records) {
  const mode = resolveMode();
  if (mode === "redis") {
    await redisCommand(["SET", redisKey(campaignKey), JSON.stringify(records), "EX", String(RECORD_TTL_SECONDS)]);
  } else if (mode === "local_file") {
    writeLocalLibrary(campaignKey, records);
  } else {
    volatileLibraries.set(normalizeCampaignKey(campaignKey), records);
  }
}

/**
 * Upserts one record by id. Two operators working on the same campaign each add their own assets,
 * so a save merges into whatever is already there rather than replacing the library wholesale -
 * a last-writer-wins replacement would silently delete a colleague's uploads.
 */
async function saveAssetRecord(input = {}) {
  const record = normalizeRecord(input);
  const existing = await readAssetLibrary(record.campaignKey);
  const merged = [...existing.filter((item) => item?.id !== record.id), record]
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    .slice(-MAX_RECORDS_PER_CAMPAIGN);
  await persistLibrary(record.campaignKey, merged);
  return { record, count: merged.length };
}

async function deleteAssetRecord(campaignKey, id) {
  const existing = await readAssetLibrary(campaignKey);
  const remaining = existing.filter((item) => item?.id !== String(id || ""));
  await persistLibrary(campaignKey, remaining);
  return { count: remaining.length };
}

module.exports = {
  MAX_RECORDS_PER_CAMPAIGN,
  MAX_RECORD_BYTES,
  deleteAssetRecord,
  getAssetLibraryStoreProfile,
  normalizeRecord,
  readAssetLibrary,
  saveAssetRecord
};
