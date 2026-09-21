const test = require("node:test");
const assert = require("node:assert/strict");

// Volatile persistence, so this never writes data/canva-localization/* or touches a real Redis.
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
  createJobId,
  deleteLocalizationJob,
  getStoreProfile,
  listLocalizationJobs,
  readExclusionMemory,
  readLocalizationJob,
  recordExclusions,
  writeLocalizationJob
} = require("../server/canva/localization-store");

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("the store reports volatile mode honestly rather than claiming persistence it does not have", () => {
  const profile = getStoreProfile();
  assert.equal(profile.mode, "volatile");
  assert.equal(profile.persistent, false);
});

test("a job survives a write and read, with its per-target progress intact", async () => {
  const id = createJobId("DA-source");
  await writeLocalizationJob({
    id,
    sourceDesignId: "DA-source",
    sourceDesignTitle: "Autumn launch",
    baseTitle: "autumn-launch",
    fields: [{ key: "headline", type: "text", sourceText: "New jewellery boxes", translate: true, budget: 23 }],
    targets: [
      { marketCode: "DE", state: "generated", designId: "DA-de", translatedFields: { headline: "Neue Schmuckboxen" } },
      { marketCode: "FR", state: "failed", error: "Canva rate-limited this request." }
    ]
  });

  const stored = await readLocalizationJob(id);
  assert.equal(stored.sourceDesignId, "DA-source");
  assert.equal(stored.fields[0].budget, 23);
  // The half-finished state is the whole point of persisting: a retry has to know which
  // language already exists in Canva and which one only failed.
  assert.equal(stored.targets.find((target) => target.marketCode === "DE").designId, "DA-de");
  assert.equal(stored.targets.find((target) => target.marketCode === "FR").state, "failed");
  assert.equal(stored.state, "partial");
});

test("the index lists jobs newest first and a deleted job leaves it", async () => {
  const first = await writeLocalizationJob({ id: createJobId("DA-a"), sourceDesignId: "DA-a", targets: [{ marketCode: "DE" }] });
  const second = await writeLocalizationJob({ id: createJobId("DA-b"), sourceDesignId: "DA-b", targets: [{ marketCode: "FR" }] });

  const jobs = await listLocalizationJobs(10);
  assert.equal(jobs[0].id, second.id);
  assert.ok(jobs.some((entry) => entry.id === first.id));

  await deleteLocalizationJob(second.id);
  const afterDelete = await listLocalizationJobs(10);
  assert.equal(afterDelete.some((entry) => entry.id === second.id), false);
  assert.equal(await readLocalizationJob(second.id), null);
});

test("exclusions accumulate across jobs instead of being replaced by the latest one", async () => {
  await recordExclusions([{ key: "brand", type: "text", sourceText: "Westpack", translate: false }]);
  await recordExclusions([{ key: "site_url", type: "text", sourceText: "westpack.com", translate: false }]);

  const memory = await readExclusionMemory();
  assert.ok(memory.fieldKeys.includes("brand"));
  assert.ok(memory.fieldKeys.includes("site_url"));
  assert.ok(memory.phrases.includes("westpack"));
});

test("reading a job that never existed returns null rather than an empty shell that looks real", async () => {
  assert.equal(await readLocalizationJob("does-not-exist"), null);
  assert.equal(await readLocalizationJob(""), null);
});
