const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { AUDIT_EVENTS, MAX_ENTRIES, getAuditLogProfile, listAuditEvents, recordAuditEvent } = require("../server/campaign/audit-log");

const auditSource = fs.readFileSync(path.join(__dirname, "..", "server", "campaign", "audit-log.js"), "utf8");
const brainSource = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
const klaviyoSource = fs.readFileSync(path.join(__dirname, "..", "api", "klaviyo", "push-template-rollout.js"), "utf8");
const metaSource = fs.readFileSync(path.join(__dirname, "..", "api", "meta", "publish-ad.js"), "utf8");

const LOCAL_LOG = path.join(process.cwd(), "data", "campaign-audit-log.json");

test.after(() => {
  try {
    fs.unlinkSync(LOCAL_LOG);
  } catch (error) {
    // Nothing to clean up.
  }
});

test("a handoff is recorded with what it created, not just that it happened", async () => {
  await recordAuditEvent("klaviyo_draft_created", {
    campaignKey: "audit-test",
    campaignTitle: "W39 Nye produkter",
    reference: "tpl_123",
    target: "DK"
  });

  const [entry] = await listAuditEvents({ campaignKey: "audit-test" });

  assert.equal(entry.event, "klaviyo_draft_created");
  assert.equal(entry.reference, "tpl_123", "the entry must point at the real Klaviyo template");
  assert.equal(entry.target, "DK");
  assert.ok(Date.parse(entry.at), "every entry is timestamped");
});

test("the newest entry comes first, and a campaign filter narrows to that campaign", async () => {
  await recordAuditEvent("studio_draft_saved", { campaignKey: "audit-test-a" });
  await recordAuditEvent("meta_draft_created", { campaignKey: "audit-test-b", reference: "ad_1" });

  const all = await listAuditEvents({ limit: 10 });
  assert.equal(all[0].campaignKey, "audit-test-b", "newest first");

  const scoped = await listAuditEvents({ campaignKey: "audit-test-a" });
  assert.ok(scoped.every((entry) => entry.campaignKey === "audit-test-a"));
});

test("an unknown event name is stored as unknown rather than trusted", async () => {
  await recordAuditEvent("something_invented", { campaignKey: "audit-test-c" });
  const [entry] = await listAuditEvents({ campaignKey: "audit-test-c" });

  assert.equal(entry.event, "unknown");
  assert.ok(AUDIT_EVENTS.length >= 5);
});

test("a failed audit write never undoes the action it describes", () => {
  // By the time this runs the template exists in Klaviyo or the ad exists in Meta. Throwing here
  // would tell the operator their handoff failed when it did not.
  assert.match(auditSource, /return \{ ok: false, entry, error:/);
  assert.match(auditSource, /catch \(error\) \{/);
  assert.doesNotMatch(auditSource, /throw new Error\("Audit/);
});

test("the log is bounded, because it is read and written as one value", () => {
  assert.match(auditSource, /slice\(-MAX_ENTRIES\)/);
  assert.equal(MAX_ENTRIES, 500);
});

test("the log is honest that a shared password cannot attribute an action to a person", () => {
  assert.match(auditSource, /single shared password/);
  assert.match(auditSource, /activity trail,\s*\r?\n\/\/ not an authenticated one/);
});

test("every point where a human commits something is recorded", () => {
  assert.match(klaviyoSource, /recordAuditEvent\("klaviyo_draft_created"/);
  assert.match(brainSource, /recordAuditEvent\("studio_draft_saved"/);
  assert.match(brainSource, /recordAuditEvent\("job_rejected_restarted"/);

  const metaCalls = metaSource.match(/recordAuditEvent\("meta_draft_created"/g) || [];
  assert.equal(metaCalls.length, 3, "single image, carousel and video each create a paused ad");
});

test("the Klaviyo entry records whether it was a dry run", () => {
  const start = klaviyoSource.indexOf('recordAuditEvent("klaviyo_draft_created"');
  const end = klaviyoSource.indexOf("});", start);
  assert.match(klaviyoSource.slice(start, end), /dryRun/);
});

test("the trail is readable, and as a GET the client can actually call", () => {
  const allowlistStart = brainSource.indexOf('if (!new Set(["asana_status"');
  const allowlistEnd = brainSource.indexOf("}", allowlistStart);
  assert.match(brainSource.slice(allowlistStart, allowlistEnd), /"audit_log"/);

  const getSectionStart = brainSource.indexOf('if (req.method === "GET")');
  const postSectionStart = brainSource.indexOf('if (req.method !== "POST")');
  const handler = brainSource.indexOf('if (action === "audit_log")');
  assert.ok(handler > getSectionStart && handler < postSectionStart);
});

test("the store reports whether it actually persists anything", () => {
  const profile = getAuditLogProfile();
  assert.ok(["redis", "local_file", "volatile"].includes(profile.mode));
  assert.equal(profile.persistent, profile.mode !== "volatile");
});

test("the client names the campaign, so an entry is more than a bare template or ad id", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  const klaviyoStart = appSource.indexOf("const payload = await requestKlaviyoPushTemplateRollout({");
  const klaviyoEnd = appSource.indexOf("assignments: [", klaviyoStart);
  assert.match(appSource.slice(klaviyoStart, klaviyoEnd), /campaignKey: getCampaignStudioDraftCampaignKey\(\)/);

  const metaStart = appSource.indexOf("function buildCampaignBrainMetaPayload(");
  const metaEnd = appSource.indexOf("translated_attachments:", metaStart);
  assert.match(appSource.slice(metaStart, metaEnd), /campaignKey: getCampaignStudioDraftCampaignKey\(\)/);
});
