const test = require("node:test");
const assert = require("node:assert/strict");

// Force in-memory (volatile) campaign-learning-store persistence so this test never touches
// data/campaign-learning-events.json or a real Redis instance. Same pattern used in
// tests/content-agent-worker-revision-resume.test.js.
const originalEnv = {
  VERCEL: process.env.VERCEL,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
};
process.env.VERCEL = "1";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  getCampaignLearningStoreProfile,
  moderateCampaignLearningEvent,
  readCampaignLearningEvents,
  recordCampaignLearningEvent,
  replaceCampaignLearningEvents
} = require("../server/campaign/campaign-learning-store");

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("store profile resolves to volatile in-memory mode under the forced test env", () => {
  const profile = getCampaignLearningStoreProfile();
  assert.equal(profile.mode, "volatile");
  assert.equal(profile.persistent, false);
});

test("recordCampaignLearningEvent clamps/defaults fields per normalizeEvent's documented rules", async () => {
  await replaceCampaignLearningEvents([]);

  const oversizedReason = "r".repeat(2000);
  const oversizedNote = "n".repeat(2000);
  const { event, recorded, duplicate } = await recordCampaignLearningEvent({
    reason: oversizedReason,
    operatorNote: oversizedNote,
    moderationStatus: "not_a_real_status"
    // type, channel, jobId, evidenceLevel, etc. all omitted to check defaults.
  });

  assert.equal(recorded, true);
  assert.equal(duplicate, false);

  // Clamping to documented slice lengths.
  assert.equal(event.reason.length, 1200);
  assert.equal(event.reason, oversizedReason.slice(0, 1200));
  assert.equal(event.operatorNote.length, 800);
  assert.equal(event.operatorNote, oversizedNote.slice(0, 800));

  // Invalid moderationStatus falls back to "active".
  assert.equal(event.moderationStatus, "active");

  // Documented defaults for omitted fields.
  assert.equal(event.type, "editor_saved");
  assert.equal(event.channel, "cross_channel");
  assert.equal(event.jobId, "");
  assert.equal(event.campaignTaskGid, "");
  assert.equal(event.campaignName, "");
  assert.equal(event.evidenceLevel, "editing_signal");
  assert.equal(event.fingerprint, "");
  assert.equal(event.diff, null);
  assert.equal(event.performance, null);
  assert.deepEqual(event.metadata, {});
  assert.deepEqual(event.outcome, {});
  assert.equal(event.moderatedAt, "");
  assert.equal(typeof event.id, "string");
  assert.ok(event.id.length > 0);
  assert.equal(typeof event.createdAt, "string");
  assert.ok(!Number.isNaN(Date.parse(event.createdAt)));
});

test("fingerprint-based deduplication rejects a second event with the same fingerprint", async () => {
  await replaceCampaignLearningEvents([]);

  const first = await recordCampaignLearningEvent({ type: "editor_saved", fingerprint: "dup-fp-1", reason: "first" });
  assert.equal(first.recorded, true);
  assert.equal(first.duplicate, false);

  const second = await recordCampaignLearningEvent({ type: "editor_saved", fingerprint: "dup-fp-1", reason: "second" });
  assert.equal(second.recorded, false);
  assert.equal(second.duplicate, true);

  const events = await readCampaignLearningEvents(120);
  const matching = events.filter((item) => item.fingerprint === "dup-fp-1");
  assert.equal(matching.length, 1);
  assert.equal(matching[0].reason, "first");
});

test("events with an empty fingerprint are never treated as duplicates of each other", async () => {
  await replaceCampaignLearningEvents([]);

  const first = await recordCampaignLearningEvent({ reason: "no fingerprint one" });
  const second = await recordCampaignLearningEvent({ reason: "no fingerprint two" });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, false);

  const events = await readCampaignLearningEvents(120);
  assert.equal(events.length, 2);
});

test("readCampaignLearningEvents honors and clamps the limit argument", async () => {
  await replaceCampaignLearningEvents([]);
  for (let i = 0; i < 5; i += 1) {
    await recordCampaignLearningEvent({ reason: `event-${i}`, fingerprint: `fp-${i}` });
  }

  const limited = await readCampaignLearningEvents(2);
  assert.equal(limited.length, 2);

  const all = await readCampaignLearningEvents(120);
  assert.equal(all.length, 5);
});

test("moderateCampaignLearningEvent approve/disable/enable set moderationStatus and moderatedAt", async () => {
  await replaceCampaignLearningEvents([]);
  const { event } = await recordCampaignLearningEvent({ reason: "moderation target" });
  assert.equal(event.moderationStatus, "active");
  assert.equal(event.moderatedAt, "");

  const approved = await moderateCampaignLearningEvent(event.id, "approve", "looks good");
  assert.equal(approved.operation, "approve");
  assert.equal(approved.deleted, false);
  assert.equal(approved.event.moderationStatus, "approved");
  assert.equal(approved.event.operatorNote, "looks good");
  assert.ok(approved.event.moderatedAt.length > 0);
  assert.ok(!Number.isNaN(Date.parse(approved.event.moderatedAt)));

  const disabled = await moderateCampaignLearningEvent(event.id, "disable", "actually no");
  assert.equal(disabled.event.moderationStatus, "disabled");
  assert.equal(disabled.event.operatorNote, "actually no");

  const enabled = await moderateCampaignLearningEvent(event.id, "enable", "");
  assert.equal(enabled.event.moderationStatus, "active");

  const persisted = await readCampaignLearningEvents(120);
  const stored = persisted.find((item) => item.id === event.id);
  assert.equal(stored.moderationStatus, "active");
});

test("moderateCampaignLearningEvent delete removes the event from subsequent reads", async () => {
  await replaceCampaignLearningEvents([]);
  const { event } = await recordCampaignLearningEvent({ reason: "to be deleted" });

  const before = await readCampaignLearningEvents(120);
  assert.equal(before.some((item) => item.id === event.id), true);

  const result = await moderateCampaignLearningEvent(event.id, "delete");
  assert.equal(result.operation, "delete");
  assert.equal(result.deleted, true);
  assert.equal(result.event.id, event.id);

  const after = await readCampaignLearningEvents(120);
  assert.equal(after.some((item) => item.id === event.id), false);
});

test("moderateCampaignLearningEvent throws for a nonexistent id and for an unsupported operation", async () => {
  await replaceCampaignLearningEvents([]);
  await recordCampaignLearningEvent({ reason: "some event" });

  await assert.rejects(
    () => moderateCampaignLearningEvent("does-not-exist", "approve"),
    /not found/i
  );

  await assert.rejects(
    () => moderateCampaignLearningEvent("does-not-exist", "not_a_real_op"),
    /unsupported/i
  );

  await assert.rejects(
    () => moderateCampaignLearningEvent("", "approve"),
    /required/i
  );
});
