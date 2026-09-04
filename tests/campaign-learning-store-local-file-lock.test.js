const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// campaign-learning-store.js's local_file mode previously had zero cross-invocation mutual
// exclusion for data/campaign-learning-events.json — the exact class of bug already fixed once
// in server/campaign/agent-store.js for data/content-agent-state.json. These tests force
// local_file mode (no Redis env vars, no VERCEL) and exercise real fs calls against a fresh
// module instance, mirroring the concurrency assertions in tests/agent-store.test.js.

const LEARNING_STORE_PATH = require.resolve("../server/campaign/campaign-learning-store");
const AGENT_STORE_PATH = require.resolve("../server/campaign/agent-store");
const LOCAL_EVENTS_PATH = path.join(process.cwd(), "data", "campaign-learning-events.json");
const LEARNING_LOCK_PATH = path.join(process.cwd(), "data", "campaign-learning-events.lock.json");
const AGENT_LOCK_PATH = path.join(process.cwd(), "data", "content-agent-state.lock.json");

const REDIS_ENV_KEYS = [
  "VERCEL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN"
];

function forceLocalFileMode() {
  const originalValues = {};
  for (const key of REDIS_ENV_KEYS) {
    originalValues[key] = process.env[key];
    delete process.env[key];
  }
  return () => {
    for (const key of REDIS_ENV_KEYS) {
      if (originalValues[key] === undefined) delete process.env[key];
      else process.env[key] = originalValues[key];
    }
  };
}

function cleanupLocalFiles() {
  for (const filePath of [LOCAL_EVENTS_PATH, LEARNING_LOCK_PATH, AGENT_LOCK_PATH]) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // Not present — nothing to clean up.
    }
  }
}

function freshLearningStore() {
  delete require.cache[LEARNING_STORE_PATH];
  delete require.cache[AGENT_STORE_PATH];
  return require(LEARNING_STORE_PATH);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("local_file mode: campaign-learning-store resolves to local_file persistence", () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const store = freshLearningStore();
    assert.equal(store.getCampaignLearningStoreProfile().mode, "local_file");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: recordCampaignLearningEvent waits out a lock held by another writer instead of writing over it", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const store = freshLearningStore();
    const agentStore = require(AGENT_STORE_PATH);
    await store.replaceCampaignLearningEvents([]);

    // Simulate another process (e.g. a background content-agent job's recordArtifactLearning
    // call) already mid-write: it holds campaign-learning-store's own lock file directly.
    const otherWriterLockId = "other-writer-a";
    assert.equal(agentStore.acquireLocalLock(otherWriterLockId, 5, LEARNING_LOCK_PATH), true);

    const recordPromise = store.recordCampaignLearningEvent({ reason: "editor autosave", fingerprint: "fp-waits" });

    // While the other writer still holds the lock, this call must be retrying, not writing.
    await sleep(60);
    const midway = fs.existsSync(LOCAL_EVENTS_PATH) ? JSON.parse(fs.readFileSync(LOCAL_EVENTS_PATH, "utf8")) : [];
    assert.equal(
      midway.some((item) => item.fingerprint === "fp-waits"),
      false,
      "recordCampaignLearningEvent must not write while another holder still has the lock"
    );

    agentStore.releaseLocalLock(otherWriterLockId, LEARNING_LOCK_PATH);

    const result = await recordPromise;
    assert.equal(result.recorded, true);

    const after = await store.readCampaignLearningEvents(120);
    assert.equal(after.some((item) => item.fingerprint === "fp-waits"), true, "the write must land once the lock frees up");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: two overlapping recordCampaignLearningEvent calls both survive — neither write is lost", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const store = freshLearningStore();
    const agentStore = require(AGENT_STORE_PATH);
    await store.replaceCampaignLearningEvents([]);
    const seeded = await store.recordCampaignLearningEvent({ reason: "already on disk", fingerprint: "fp-seed" });
    assert.equal(seeded.recorded, true);

    // Hold the lock out from under the module to force the next call to genuinely contend and
    // retry, the same way a second concurrent invocation would.
    const otherWriterLockId = "other-writer-b";
    assert.equal(agentStore.acquireLocalLock(otherWriterLockId, 5, LEARNING_LOCK_PATH), true);

    const recordA = store.recordCampaignLearningEvent({ reason: "content-agent job", fingerprint: "fp-a" });
    const recordB = store.recordCampaignLearningEvent({ reason: "editor autosave", fingerprint: "fp-b" });

    await sleep(60);
    agentStore.releaseLocalLock(otherWriterLockId, LEARNING_LOCK_PATH);

    const [resultA, resultB] = await Promise.all([recordA, recordB]);
    assert.equal(resultA.recorded, true);
    assert.equal(resultB.recorded, true);

    const events = await store.readCampaignLearningEvents(120);
    assert.equal(events.some((item) => item.fingerprint === "fp-seed"), true, "the pre-existing event must survive both overlapping writes");
    assert.equal(events.some((item) => item.fingerprint === "fp-a"), true, "the first overlapping write must be present");
    assert.equal(events.some((item) => item.fingerprint === "fp-b"), true, "the second overlapping write must be present");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: moderateCampaignLearningEvent does not clobber a write that lands while it is contending for the lock", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const store = freshLearningStore();
    const agentStore = require(AGENT_STORE_PATH);
    await store.replaceCampaignLearningEvents([]);
    const { event } = await store.recordCampaignLearningEvent({ reason: "moderation target" });

    const otherWriterLockId = "other-writer-c";
    assert.equal(agentStore.acquireLocalLock(otherWriterLockId, 5, LEARNING_LOCK_PATH), true);

    const moderatePromise = store.moderateCampaignLearningEvent(event.id, "approve", "looks fine");
    const recordPromise = store.recordCampaignLearningEvent({ reason: "background job fires during moderation", fingerprint: "fp-concurrent" });

    await sleep(60);
    agentStore.releaseLocalLock(otherWriterLockId, LEARNING_LOCK_PATH);

    const [moderated] = await Promise.all([moderatePromise, recordPromise]);
    assert.equal(moderated.event.moderationStatus, "approved");

    const events = await store.readCampaignLearningEvents(120);
    const stillModerated = events.find((item) => item.id === event.id);
    assert.equal(stillModerated.moderationStatus, "approved", "the moderation write must not be lost");
    assert.equal(events.some((item) => item.fingerprint === "fp-concurrent"), true, "the concurrent record write must not be lost either");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: campaign-learning-store's lock is a dedicated file that does not contend with agent-store's own lock", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const store = freshLearningStore();
    const agentStore = require(AGENT_STORE_PATH);

    // Hold agent-store's content-agent-state lock ...
    assert.equal(await agentStore.acquireAgentLock("agent-holder", 5), true);

    // ... campaign-learning-store must still be able to write immediately: it is not contending
    // on the same lock file.
    const result = await store.recordCampaignLearningEvent({ reason: "unrelated subsystem", fingerprint: "fp-isolated" });
    assert.equal(result.recorded, true);

    assert.equal(fs.existsSync(AGENT_LOCK_PATH), true, "agent-store's lock file must still exist — the write above must not have released it");
    assert.equal(fs.existsSync(LEARNING_LOCK_PATH), false, "campaign-learning-store must release its own lock file after writing");

    await agentStore.releaseAgentLock("agent-holder");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});
