const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  MAX_DRAFT_BYTES,
  deleteStudioDraft,
  getStudioDraftStoreProfile,
  normalizeCampaignKey,
  readStudioDraft,
  writeStudioDraft
} = require("../server/campaign/studio-draft-store");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const servicesSource = fs.readFileSync(path.join(__dirname, "..", "src", "services.js"), "utf8");
const apiSource = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

const KEY = "test campaign — studio draft store";

test.after(async () => {
  await deleteStudioDraft(KEY);
  await deleteStudioDraft("oversized draft test");
});

test("a draft written by one operator can be read back by another", async () => {
  // The whole point: the agent's output was already server-side, but the human's edits were not,
  // so a campaign belonged to whichever browser profile happened to open it.
  await writeStudioDraft(KEY, { draft: { artifacts: { email: { subject: "Nye produkter" } } } });
  const record = await readStudioDraft(KEY);

  assert.equal(record.draft.artifacts.email.subject, "Nye produkter");
  assert.ok(record.savedAt, "a stored draft always records when it was saved");
  assert.equal(record.campaignKey, normalizeCampaignKey(KEY));
});

test("the campaign key is normalized the same way on both sides", () => {
  assert.equal(normalizeCampaignKey("W39: Kick-Off 8 — Nye produkter!"), "w39-kick-off-8-nye-produkter");
  assert.equal(normalizeCampaignKey(""), "untitled-campaign");
  assert.equal(normalizeCampaignKey("!!!"), "untitled-campaign");
});

test("clearing removes the shared copy, so a discarded draft cannot come back", async () => {
  await writeStudioDraft(KEY, { draft: { artifacts: { email: { subject: "Gone" } } } });
  await deleteStudioDraft(KEY);

  assert.equal(await readStudioDraft(KEY), null);
});

test("an oversized draft is refused with a clear message rather than half-written", async () => {
  const huge = { draft: { artifacts: { email: { bodyHtml: "x".repeat(MAX_DRAFT_BYTES + 1000) } } } };

  await assert.rejects(
    () => writeStudioDraft("oversized draft test", huge),
    /above the .*kB limit/
  );
});

test("the store reports whether it actually persists anything", () => {
  const profile = getStudioDraftStoreProfile();

  assert.ok(["redis", "local_file", "volatile"].includes(profile.mode));
  assert.equal(profile.persistent, profile.mode !== "volatile");
});

test("the three backends are shared with the agent store rather than reimplemented", () => {
  const storeSource = fs.readFileSync(path.join(__dirname, "..", "server", "campaign", "studio-draft-store.js"), "utf8");

  assert.match(storeSource, /require\("\.\/agent-store"\)/);
  assert.match(storeSource, /canUseLocalFile/);
  assert.match(storeSource, /redisCommand/);
  assert.doesNotMatch(storeSource, /UPSTASH_REDIS_REST_URL/, "Redis plumbing must not be duplicated here");
});

test("the API exposes load, save and clear", () => {
  assert.match(apiSource, /if \(action === "studio_draft_load"\)/);
  assert.match(apiSource, /if \(action === "studio_draft_save"\)/);
  assert.match(apiSource, /if \(action === "studio_draft_clear"\)/);
  assert.match(apiSource, /sendJson\(res, 413/, "a refused save must say so instead of failing quietly");
});

test("the browser copy stays, and the server copy follows on a debounce", () => {
  // localStorage is written synchronously so an edit survives a reload immediately; the shared
  // copy is what survives a different machine or a cleared cache.
  assert.match(appSource, /function scheduleCampaignStudioDraftSync\(\)/);
  assert.match(appSource, /campaignStudioDraftSyncTimer = window\.setTimeout\(syncCampaignStudioDraftToServer, 2500\)/);
  assert.match(appSource, /window\.localStorage\.setItem\(getCampaignStudioDraftStorageKey\(\)/);
});

test("the newer of the two copies wins when a campaign is opened", () => {
  const start = appSource.indexOf("async function reconcileCampaignStudioDraftWithServer(");
  const end = appSource.indexOf("function renderCampaignStudioDraftSyncState(", start);
  const reconcile = appSource.slice(start, end);

  assert.ok(start > 0, "there must be a reconciliation step");
  assert.match(reconcile, /const localSavedAt = Date\.parse\(localRecord\?\.savedAt \|\| ""\) \|\| 0/);
  assert.match(reconcile, /if \(remoteSavedAt <= localSavedAt\)/);
  assert.match(reconcile, /quarantineCampaignArtifactAsanaImages/, "an adopted draft gets the same image quarantine as a local one");
});

test("clearing the draft clears both copies", () => {
  const start = appSource.indexOf("function clearCampaignStudioDraftFromStorage()");
  const end = appSource.indexOf("const CAMPAIGN_ASSET_LIBRARY_DB_NAME", start);
  const clear = appSource.slice(start, end);

  assert.match(clear, /requestStudioDraftClear\(campaignKey\)/);
  assert.match(clear, /window\.localStorage\.removeItem/);
  assert.match(clear, /window\.clearTimeout\(campaignStudioDraftSyncTimer\)/, "a pending sync must not resurrect the draft");
});

test("a browser-only draft is shown as a warning, not a neutral state", () => {
  assert.match(appSource, /function renderCampaignStudioDraftSyncState\(\)/);
  assert.match(appSource, /Browser only/);
  assert.match(servicesSource, /export async function requestStudioDraftSave/);

  const stylesSource = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.match(stylesSource, /\.campaign-studio-draft-sync\[data-state="error"\]/);
  assert.match(stylesSource, /\.campaign-studio-draft-sync\[data-state="local"\]/);
});
