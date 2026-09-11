const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  MAX_RECORDS_PER_CAMPAIGN,
  deleteAssetRecord,
  getAssetLibraryStoreProfile,
  normalizeRecord,
  readAssetLibrary,
  saveAssetRecord
} = require("../server/campaign/asset-library-store");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const apiSource = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
const storeSource = fs.readFileSync(path.join(__dirname, "..", "server", "campaign", "asset-library-store.js"), "utf8");

const CAMPAIGN = "asset library test campaign";
const HOSTED = "https://d3k81ch9hvuctc.cloudfront.net/company/VRPp5S/images/abc.png";

function record(overrides = {}) {
  return { id: "asset_1", campaignKey: CAMPAIGN, name: "hero.jpg", imageUrl: HOSTED, ...overrides };
}

test.after(async () => {
  const existing = await readAssetLibrary(CAMPAIGN);
  for (const item of existing) await deleteAssetRecord(CAMPAIGN, item.id);
});

test("an asset saved by one operator is visible to the next", async () => {
  await saveAssetRecord(record({ id: "asset_a", name: "detail.jpg" }));
  const library = await readAssetLibrary(CAMPAIGN);

  assert.equal(library.length, 1);
  assert.equal(library[0].name, "detail.jpg");
  assert.equal(library[0].imageUrl, HOSTED);
});

test("a save merges rather than replacing, so a colleague's assets are not deleted", async () => {
  await saveAssetRecord(record({ id: "asset_a", name: "mine.jpg" }));
  await saveAssetRecord(record({ id: "asset_b", name: "theirs.jpg" }));

  const library = await readAssetLibrary(CAMPAIGN);
  const ids = library.map((item) => item.id).sort();

  assert.deepEqual(ids, ["asset_a", "asset_b"]);
});

test("saving the same id again updates it in place instead of duplicating", async () => {
  await saveAssetRecord(record({ id: "asset_a", name: "first.jpg" }));
  await saveAssetRecord(record({ id: "asset_a", name: "second.jpg" }));

  const library = await readAssetLibrary(CAMPAIGN);
  const matching = library.filter((item) => item.id === "asset_a");

  assert.equal(matching.length, 1);
  assert.equal(matching[0].name, "second.jpg");
});

test("an inlined image is refused, because that is what kept the library in one browser", () => {
  assert.throws(
    () => normalizeRecord(record({ imageUrl: "data:image/jpeg;base64,AAAA" })),
    /must be hosted before it is saved/
  );
});

test("a record without an id is refused rather than stored unaddressable", () => {
  assert.throws(() => normalizeRecord(record({ id: "" })), /needs an id/);
});

test("the library is bounded per campaign, because it moves in one round trip", () => {
  assert.match(storeSource, /slice\(-MAX_RECORDS_PER_CAMPAIGN\)/);
  assert.equal(MAX_RECORDS_PER_CAMPAIGN, 400);
});

test("the store reports whether it actually persists anything", () => {
  const profile = getAssetLibraryStoreProfile();
  assert.ok(["redis", "local_file", "volatile"].includes(profile.mode));
  assert.equal(profile.persistent, profile.mode !== "volatile");
});

test("the client hosts the image before it saves the record", () => {
  const start = appSource.indexOf("async function hostCampaignAssetImageUrl(");
  const end = appSource.indexOf("async function syncCampaignAssetRecordToServer(", start);
  const hosting = appSource.slice(start, end);

  assert.ok(start > 0, "there must be a hosting step");
  assert.match(hosting, /requestCampaignEmailAssetHosting/);
  assert.match(hosting, /if \(!value\.startsWith\("data:"\)\) return/, "an already-hosted URL is not re-uploaded");
  assert.match(hosting, /return \{ imageUrl: value, hosted: false/, "a failed host keeps the asset rather than losing it");
});

test("an unhosted asset is never pushed to the shared library", () => {
  const start = appSource.indexOf("async function syncCampaignAssetRecordToServer(");
  const end = appSource.indexOf("async function saveCampaignAssetLibraryRecord(", start);
  assert.match(appSource.slice(start, end), /if \(String\(record\?\.imageUrl \|\| ""\)\.startsWith\("data:"\)\) return false/);
});

test("the shared library is merged in, and the local copy wins on id", () => {
  const start = appSource.indexOf("async function hydrateCampaignAssetLibrary(");
  const end = appSource.indexOf("function sortCampaignAssetLibraryItems", start) > start
    ? appSource.indexOf("function sortCampaignAssetLibraryItems", start)
    : start + 2000;
  const hydrate = appSource.slice(start, end);

  assert.match(hydrate, /listSharedCampaignAssetRecords/);
  assert.match(hydrate, /for \(const item of localRecords\) byId\.set/, "local records are applied last, so they win");
});

test("a failed shared read still renders the operator's own library", () => {
  const start = appSource.indexOf("async function listSharedCampaignAssetRecords(");
  const end = appSource.indexOf("async function hydrateCampaignAssetLibrary(", start);
  const reader = appSource.slice(start, end);

  assert.match(reader, /catch \(error\) \{/);
  assert.match(reader, /return \[\];/);
});

test("tag and approval changes reach the shared copy too", () => {
  const start = appSource.indexOf("async function updateCampaignAssetLibraryRecord(");
  const end = appSource.indexOf("async function saveCampaignBrainEnvironmentSourceToLibrary(", start);
  assert.match(appSource.slice(start, end), /syncCampaignAssetRecordToServer\(next\)/);
});

test("the API exposes the library, with load as the GET the client sends", () => {
  assert.match(apiSource, /if \(action === "asset_library_save"\)/);
  assert.match(apiSource, /if \(action === "asset_library_delete"\)/);

  const allowlistStart = apiSource.indexOf('if (!new Set(["asana_status"');
  const allowlistEnd = apiSource.indexOf("}", allowlistStart);
  assert.match(apiSource.slice(allowlistStart, allowlistEnd), /"asset_library_load"/);

  const getSectionStart = apiSource.indexOf('if (req.method === "GET")');
  const postSectionStart = apiSource.indexOf('if (req.method !== "POST")');
  const handler = apiSource.indexOf('if (action === "asset_library_load")');
  assert.ok(handler > getSectionStart && handler < postSectionStart);
});
