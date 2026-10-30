const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// agent-store.js is the shared persistence plumbing for the Studio drafts, asset library, audit
// log, campaign learning, Canva and Klaviyo stores. The Content Agent it was named after is gone;
// these pin the parts the other stores still depend on.

const AGENT_STORE_PATH = require.resolve("../server/campaign/agent-store");
const LOCK_PATH = path.join(os.tmpdir(), `westpack-agent-store-test-${process.pid}.lock.json`);

const REDIS_ENV_KEYS = [
  "VERCEL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN"
];

function withEnv(values, fn) {
  const originalValues = {};
  for (const key of REDIS_ENV_KEYS) {
    originalValues[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, values);
  const restore = () => {
    for (const key of REDIS_ENV_KEYS) {
      if (originalValues[key] === undefined) delete process.env[key];
      else process.env[key] = originalValues[key];
    }
  };
  return Promise.resolve().then(fn).finally(restore);
}

function cleanupLock() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch (error) {
    // Not present - nothing to clean up.
  }
}

function freshAgentStore() {
  delete require.cache[AGENT_STORE_PATH];
  return require(AGENT_STORE_PATH);
}

test("the store exports only the shared plumbing, and nothing that persists the retired agent", () => {
  const store = freshAgentStore();
  assert.deepEqual(Object.keys(store).sort(), [
    "acquireLocalLock",
    "canUseLocalFile",
    "getAgentStoreProfile",
    "redisCommand",
    "releaseLocalLock"
  ]);
  const source = fs.readFileSync(AGENT_STORE_PATH, "utf8");
  assert.doesNotMatch(source, /content-agent/);
});

test("the profile resolves Redis first, then a local file, then volatile memory", async () => {
  await withEnv({ KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "token" }, () => {
    assert.deepEqual(freshAgentStore().getAgentStoreProfile(), { mode: "redis", persistent: true });
  });
  await withEnv({}, () => {
    assert.deepEqual(freshAgentStore().getAgentStoreProfile(), { mode: "local_file", persistent: true });
  });
  await withEnv({ VERCEL: "1" }, () => {
    assert.deepEqual(freshAgentStore().getAgentStoreProfile(), { mode: "volatile", persistent: false });
  });
});

test("the local lock gives real mutual exclusion on the caller's own lock file", () => {
  const store = freshAgentStore();
  try {
    assert.equal(store.acquireLocalLock("lock-holder-a", 5, LOCK_PATH), true);
    assert.equal(store.acquireLocalLock("lock-holder-b", 5, LOCK_PATH), false, "a second lockId must not acquire an unexpired lock held by another lockId");

    store.releaseLocalLock("lock-holder-b", LOCK_PATH);
    assert.equal(store.acquireLocalLock("lock-holder-b", 5, LOCK_PATH), false, "only the holder may release its lock");

    store.releaseLocalLock("lock-holder-a", LOCK_PATH);
    assert.equal(store.acquireLocalLock("lock-holder-b", 5, LOCK_PATH), true, "the lock must be free once its holder releases it");
  } finally {
    cleanupLock();
  }
});

test("the local lock can be taken again once its ttl has elapsed without a release", async () => {
  const store = freshAgentStore();
  try {
    assert.equal(store.acquireLocalLock("short-lived-holder", 1, LOCK_PATH), true);
    assert.equal(store.acquireLocalLock("other-holder", 5, LOCK_PATH), false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(store.acquireLocalLock("other-holder", 5, LOCK_PATH), true, "an expired lock must be stealable");
  } finally {
    cleanupLock();
  }
});

test("two callers racing to steal the same expired lock - exactly one wins", () => {
  const store = freshAgentStore();
  const originalRenameSync = fs.renameSync;
  try {
    // Seed an already-expired lock directly, as if its holder crashed without releasing it.
    fs.writeFileSync(LOCK_PATH, JSON.stringify({ lockId: "crashed-holder", expiresAt: Date.now() - 1000 }), "utf8");

    // Intercept caller A's first rename and, before it runs, run caller B's whole acquire. This
    // reproduces the real race window - both callers already decided the lock is stale before
    // either has taken atomic possession of it - deterministically.
    let nested = false;
    let secondAcquired;
    fs.renameSync = (src, dest) => {
      if (!nested && src === LOCK_PATH) {
        nested = true;
        secondAcquired = store.acquireLocalLock("stealer-b", 5, LOCK_PATH);
      }
      return originalRenameSync(src, dest);
    };

    const firstAcquired = store.acquireLocalLock("stealer-a", 5, LOCK_PATH);

    assert.equal(typeof secondAcquired, "boolean", "the nested racing call must have run");
    assert.equal([firstAcquired, secondAcquired].filter(Boolean).length, 1, "exactly one caller may believe it holds the lock");
    const onDisk = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    assert.equal(onDisk.lockId, firstAcquired ? "stealer-a" : "stealer-b", "the lock file must reflect the actual winner");
  } finally {
    fs.renameSync = originalRenameSync;
    cleanupLock();
  }
});
