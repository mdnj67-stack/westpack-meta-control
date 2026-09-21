// An append-only record of the decisions a human made: which campaign was pushed to Klaviyo, which
// ad was created in Meta, which run was rejected and restarted. The Content Agent already logs its
// own reasoning in full, but nothing recorded what a person then did with it, so "who sent this
// email, and when" had no answer.
//
// A caveat worth stating plainly rather than hiding: this app is behind a single shared password,
// so there is no per-person identity to record. These entries say what happened and when, and
// carry a self-declared operator label when the client supplies one. They are an activity trail,
// not an authenticated one, and should not be relied on to attribute an action to an individual.

const fs = require("fs");
const path = require("path");
const { canUseLocalFile, getAgentStoreProfile, redisCommand } = require("./agent-store");

const STORE_KEY = "westpack:campaign-studio:audit:v1";
const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "campaign-audit-log.json");
// A ring buffer rather than unbounded growth: the whole log is read and written as one value, so
// it has to stay small enough to move in a single round trip.
const MAX_ENTRIES = 500;

let volatileEntries = [];

const AUDIT_EVENTS = Object.freeze([
  "klaviyo_draft_created",
  "meta_draft_created",
  "studio_draft_saved",
  "job_rejected_restarted",
  "blog_exported",
  // Canva Localizer creates real, permanent designs in the shared Canva account. Eighteen of
  // them at a time, named after a campaign, is exactly the kind of thing someone later needs to
  // trace back to a person and a moment.
  "canva_versions_generated"
]);

function resolveMode() {
  if (getAgentStoreProfile().mode === "redis") return "redis";
  return canUseLocalFile() ? "local_file" : "volatile";
}

function getAuditLogProfile() {
  const mode = resolveMode();
  return { mode, persistent: mode !== "volatile" };
}

function readLocalEntries() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLocalEntries(entries) {
  fs.mkdirSync(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  const tempPath = `${LOCAL_STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(entries, null, 2), "utf8");
  fs.renameSync(tempPath, LOCAL_STORE_PATH);
}

async function readAuditEntries() {
  const mode = resolveMode();
  if (mode === "redis") {
    try {
      const raw = await redisCommand(["GET", STORE_KEY]);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  if (mode === "local_file") return readLocalEntries();
  return volatileEntries;
}

function normalizeEntry(event, detail = {}) {
  return {
    event: AUDIT_EVENTS.includes(event) ? event : "unknown",
    at: new Date().toISOString(),
    campaignKey: String(detail.campaignKey || "").slice(0, 120),
    campaignTitle: String(detail.campaignTitle || "").slice(0, 200),
    operator: String(detail.operator || "").slice(0, 120),
    jobId: String(detail.jobId || "").slice(0, 80),
    // Whatever identifies the thing that was created on the far side, so an entry can be traced
    // back to a real Klaviyo template or Meta ad rather than only asserting that it happened.
    reference: String(detail.reference || "").slice(0, 200),
    target: String(detail.target || "").slice(0, 120),
    note: String(detail.note || "").slice(0, 400),
    dryRun: detail.dryRun === true
  };
}

/**
 * Appends one entry. Never throws: an audit write that fails must not undo or block the action it
 * is describing, since the action has already happened by the time this is called. A failure is
 * reported in the return value for the caller to surface if it wants to.
 */
async function recordAuditEvent(event, detail = {}) {
  const entry = normalizeEntry(event, detail);
  try {
    const entries = [...(await readAuditEntries()), entry].slice(-MAX_ENTRIES);
    const mode = resolveMode();
    if (mode === "redis") {
      await redisCommand(["SET", STORE_KEY, JSON.stringify(entries)]);
    } else if (mode === "local_file") {
      writeLocalEntries(entries);
    } else {
      volatileEntries = entries;
    }
    return { ok: true, entry };
  } catch (error) {
    return { ok: false, entry, error: error.message || "Audit entry could not be stored." };
  }
}

async function listAuditEvents({ limit = 100, campaignKey = "" } = {}) {
  const entries = await readAuditEntries();
  const filtered = campaignKey
    ? entries.filter((entry) => entry.campaignKey === String(campaignKey))
    : entries;
  return filtered.slice(-Math.max(1, Math.min(MAX_ENTRIES, Number(limit) || 100))).reverse();
}

module.exports = {
  AUDIT_EVENTS,
  MAX_ENTRIES,
  getAuditLogProfile,
  listAuditEvents,
  recordAuditEvent
};
