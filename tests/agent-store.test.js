const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const AGENT_STORE_PATH = require.resolve("../server/campaign/agent-store");
const { createInitialAgentState, normalizeAgentState } = require("../server/campaign/content-agent");
const LOCAL_LOCK_PATH = path.join(process.cwd(), "data", "content-agent-state.lock.json");
const LOCAL_CONTROLS_PATH = path.join(process.cwd(), "data", "content-agent-controls.json");
const LOCAL_CONTROLS_LOCK_PATH = path.join(process.cwd(), "data", "content-agent-controls.lock.json");

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
  for (const filePath of [LOCAL_LOCK_PATH, LOCAL_CONTROLS_PATH, LOCAL_CONTROLS_LOCK_PATH]) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // Not present — nothing to clean up.
    }
  }
}

function freshAgentStore() {
  delete require.cache[AGENT_STORE_PATH];
  return require(AGENT_STORE_PATH);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("local_file mode: acquireAgentLock provides real mutual exclusion", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "local_file");

    const firstAcquired = await agentStore.acquireAgentLock("lock-holder-a", 5);
    assert.equal(firstAcquired, true);

    const secondAcquired = await agentStore.acquireAgentLock("lock-holder-b", 5);
    assert.equal(secondAcquired, false, "a second lockId must not acquire an unexpired lock held by another lockId");

    await agentStore.releaseAgentLock("lock-holder-a");

    const afterRelease = await agentStore.acquireAgentLock("lock-holder-b", 5);
    assert.equal(afterRelease, true, "acquireAgentLock must succeed once the holder releases the lock");

    await agentStore.releaseAgentLock("lock-holder-b");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: acquireAgentLock succeeds again once ttlSeconds elapses", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();

    const acquired = await agentStore.acquireAgentLock("short-lived-holder", 1);
    assert.equal(acquired, true);

    const contendedWhileHeld = await agentStore.acquireAgentLock("other-holder", 5);
    assert.equal(contendedWhileHeld, false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const afterExpiry = await agentStore.acquireAgentLock("other-holder", 5);
    assert.equal(afterExpiry, true, "acquireAgentLock must succeed once ttlSeconds has elapsed without a release");

    await agentStore.releaseAgentLock("other-holder");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("volatile mode: acquireAgentLock is unchanged and always grants the lock", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    process.env.VERCEL = "1"; // no local file, no Redis creds -> volatile profile
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "volatile");

    const first = await agentStore.acquireAgentLock("holder-a", 5);
    const second = await agentStore.acquireAgentLock("holder-b", 5);
    assert.equal(first, true);
    assert.equal(second, true, "volatile mode intentionally keeps granting every lock request");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: queued control commands survive a simulated process restart", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "local_file");

    const queued = await agentStore.queueAgentControlCommand({ type: "pause", jobId: "job-123" });
    assert.ok(queued.id);

    const onDisk = JSON.parse(fs.readFileSync(LOCAL_CONTROLS_PATH, "utf8"));
    assert.equal(Array.isArray(onDisk), true);
    assert.equal(onDisk.some((entry) => entry.id === queued.id), true, "queued command must be persisted to disk, not just kept in memory");

    // Simulate a process restart: drop the in-memory module (and its volatileControls array)
    // and require it fresh, the way a new process would start with an empty in-memory state.
    const restartedAgentStore = freshAgentStore();
    const drained = await restartedAgentStore.drainAgentControlCommands(20);
    assert.equal(drained.some((entry) => entry.id === queued.id), true, "drainAgentControlCommands after a restart must still see the command persisted before the restart");

    const remainingOnDisk = JSON.parse(fs.readFileSync(LOCAL_CONTROLS_PATH, "utf8"));
    assert.equal(remainingOnDisk.some((entry) => entry.id === queued.id), false, "a drained command must be removed from the on-disk queue");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: two callers racing to steal the same expired lock — exactly one wins", async () => {
  const restoreEnv = forceLocalFileMode();
  const originalRenameSync = fs.renameSync;
  try {
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "local_file");

    // Seed an already-expired lock directly, as if its holder crashed without releasing it.
    fs.mkdirSync(path.dirname(LOCAL_LOCK_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_LOCK_PATH, JSON.stringify({ lockId: "crashed-holder", expiresAt: Date.now() - 1000 }), "utf8");

    // Simulate two callers (e.g. two separate worker processes) both reading the same expired
    // lock and then racing to steal it: intercept the first fs.renameSync call made by caller A's
    // steal attempt and, before it actually runs, run caller B's entire acquireLocalLock call to
    // completion. This reproduces the real race window (both callers already decided the lock is
    // stale before either has taken atomic possession of it) deterministically and synchronously.
    let nested = false;
    let secondAcquired;
    fs.renameSync = (src, dest) => {
      if (!nested && src === LOCAL_LOCK_PATH) {
        nested = true;
        secondAcquired = agentStore.acquireLocalLock("stealer-b", 5);
      }
      return originalRenameSync(src, dest);
    };

    const firstAcquired = agentStore.acquireLocalLock("stealer-a", 5);

    assert.equal(typeof secondAcquired, "boolean", "the nested racing call must have run");
    assert.notEqual(firstAcquired, secondAcquired, "exactly one of the two racing stealers must win the lock");
    assert.equal([firstAcquired, secondAcquired].filter(Boolean).length, 1, "at most one caller may believe it holds the lock");

    const winnerLockId = firstAcquired ? "stealer-a" : "stealer-b";
    const onDisk = JSON.parse(fs.readFileSync(LOCAL_LOCK_PATH, "utf8"));
    assert.equal(onDisk.lockId, winnerLockId, "the lock file on disk must reflect the actual winner, not be left inconsistent");
  } finally {
    fs.renameSync = originalRenameSync;
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("volatile mode: control commands stay in-memory only and are not written to disk", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    process.env.VERCEL = "1";
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "volatile");

    await agentStore.queueAgentControlCommand({ type: "resume", jobId: "job-456" });
    assert.equal(fs.existsSync(LOCAL_CONTROLS_PATH), false, "volatile mode must not persist control commands to disk");

    const drained = await agentStore.drainAgentControlCommands(20);
    assert.equal(drained.some((entry) => entry.jobId === "job-456"), true);
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: queueAgentControlCommand waits out a lock held by another writer instead of writing over it", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "local_file");

    // Simulate another process (e.g. a second browser tab's pause/resume/takeover click) already
    // mid-write: it holds the controls queue's own lock file directly.
    const otherWriterLockId = "other-writer-controls-a";
    assert.equal(agentStore.acquireLocalLock(otherWriterLockId, 5, LOCAL_CONTROLS_LOCK_PATH), true);

    const queuePromise = agentStore.queueAgentControlCommand({ type: "pause", jobId: "job-wait" });

    // While the other writer still holds the lock, this call must be retrying, not writing.
    await sleep(60);
    const midway = fs.existsSync(LOCAL_CONTROLS_PATH) ? JSON.parse(fs.readFileSync(LOCAL_CONTROLS_PATH, "utf8")) : [];
    assert.equal(
      midway.some((entry) => entry.jobId === "job-wait"),
      false,
      "queueAgentControlCommand must not write while another holder still has the lock"
    );

    agentStore.releaseLocalLock(otherWriterLockId, LOCAL_CONTROLS_LOCK_PATH);

    const queued = await queuePromise;
    assert.ok(queued.id);

    const after = JSON.parse(fs.readFileSync(LOCAL_CONTROLS_PATH, "utf8"));
    assert.equal(after.some((entry) => entry.jobId === "job-wait"), true, "the write must land once the lock frees up");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: two overlapping queueAgentControlCommand calls both survive — neither operator command is lost", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();

    // Hold the lock out from under the module to force both calls to genuinely contend and
    // retry, the same way two overlapping operator actions (e.g. two browser tabs) would.
    const otherWriterLockId = "other-writer-controls-b";
    assert.equal(agentStore.acquireLocalLock(otherWriterLockId, 5, LOCAL_CONTROLS_LOCK_PATH), true);

    const queuePause = agentStore.queueAgentControlCommand({ type: "pause", jobId: "job-a" });
    const queueResume = agentStore.queueAgentControlCommand({ type: "resume", jobId: "job-b" });

    await sleep(60);
    agentStore.releaseLocalLock(otherWriterLockId, LOCAL_CONTROLS_LOCK_PATH);

    const [pauseEntry, resumeEntry] = await Promise.all([queuePause, queueResume]);
    assert.ok(pauseEntry.id);
    assert.ok(resumeEntry.id);

    const drained = await agentStore.drainAgentControlCommands(20);
    assert.equal(drained.some((entry) => entry.jobId === "job-a"), true, "the first overlapping command must not be dropped");
    assert.equal(drained.some((entry) => entry.jobId === "job-b"), true, "the second overlapping command must not be dropped");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: drainAgentControlCommands does not clobber a command queued while it is contending for the lock", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();
    await agentStore.queueAgentControlCommand({ type: "pause", jobId: "job-pre-existing" });

    const otherWriterLockId = "other-writer-controls-c";
    assert.equal(agentStore.acquireLocalLock(otherWriterLockId, 5, LOCAL_CONTROLS_LOCK_PATH), true);

    const drainPromise = agentStore.drainAgentControlCommands(20);
    const queuePromise = agentStore.queueAgentControlCommand({ type: "takeover", jobId: "job-concurrent" });

    await sleep(60);
    agentStore.releaseLocalLock(otherWriterLockId, LOCAL_CONTROLS_LOCK_PATH);

    const [drained] = await Promise.all([drainPromise, queuePromise]);
    assert.equal(drained.some((entry) => entry.jobId === "job-pre-existing"), true, "the pre-existing command must be drained");

    // Whether queueAgentControlCommand's write lands before or after drainAgentControlCommands'
    // read+splice+write is a genuine race (both are simply retrying for the same lock), so
    // job-concurrent may surface in this first drain result or in a later one — either is a
    // correct outcome under the lock. What must never happen is it appearing in neither (lost)
    // or in both (duplicated).
    const remaining = await agentStore.drainAgentControlCommands(20);
    const concurrentSightings = [drained, remaining].filter((batch) => batch.some((entry) => entry.jobId === "job-concurrent")).length;
    assert.equal(concurrentSightings, 1, "the command queued during the drain must land exactly once, not be lost or duplicated");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("redis mode: readAgentState falls back to a safe initial state instead of throwing on a corrupted blob", async () => {
  const restoreEnv = forceLocalFileMode();
  const originalFetch = global.fetch;
  try {
    process.env.KV_REST_API_URL = "https://example-redis.test";
    process.env.KV_REST_API_TOKEN = "test-token";
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "redis");

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: "{not valid json" })
    });

    const state = await agentStore.readAgentState();
    assert.deepEqual(state, normalizeAgentState(createInitialAgentState()));
  } finally {
    global.fetch = originalFetch;
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("redis mode: readAgentState still parses and returns a well-formed blob unchanged", async () => {
  const restoreEnv = forceLocalFileMode();
  const originalFetch = global.fetch;
  try {
    process.env.KV_REST_API_URL = "https://example-redis.test";
    process.env.KV_REST_API_TOKEN = "test-token";
    const agentStore = freshAgentStore();
    assert.equal(agentStore.getAgentStoreProfile().mode, "redis");

    const wellFormed = normalizeAgentState(createInitialAgentState());
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: JSON.stringify(wellFormed) })
    });

    const state = await agentStore.readAgentState();
    assert.deepEqual(state, wellFormed, "a well-formed blob must still round-trip unchanged");
  } finally {
    global.fetch = originalFetch;
    cleanupLocalFiles();
    restoreEnv();
  }
});

test("local_file mode: the control-command lock is a dedicated file that does not contend with the main agent-state lock", async () => {
  const restoreEnv = forceLocalFileMode();
  try {
    const agentStore = freshAgentStore();

    // Hold the main content-agent-state lock ...
    assert.equal(await agentStore.acquireAgentLock("agent-holder-controls-isolation", 5), true);

    // ... queueAgentControlCommand must still be able to write immediately: it is not contending
    // on the same lock file.
    const queued = await agentStore.queueAgentControlCommand({ type: "pause", jobId: "job-isolated" });
    assert.ok(queued.id);

    assert.equal(fs.existsSync(LOCAL_LOCK_PATH), true, "the main agent-state lock file must still exist — the write above must not have released it");
    assert.equal(fs.existsSync(LOCAL_CONTROLS_LOCK_PATH), false, "queueAgentControlCommand must release its own lock file after writing");

    await agentStore.releaseAgentLock("agent-holder-controls-isolation");
  } finally {
    cleanupLocalFiles();
    restoreEnv();
  }
});
