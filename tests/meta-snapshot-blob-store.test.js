const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE = "../server/meta/historical-store";
const TOKEN = "vercel_blob_rw_StoreAbc123_secretpart";

function load(env) {
  const saved = {};
  for (const key of ["BLOB_READ_WRITE_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VERCEL"]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve(MODULE)];
  const store = require(MODULE);
  return {
    store,
    restore() {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
}

function withFetch(handler, fn) {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return fn(calls).finally(() => { global.fetch = original; });
}

const json = (status, body) => new Response(JSON.stringify(body), { status });

test("blob takes precedence over redis when a blob token is configured", () => {
  const { store, restore } = load({ BLOB_READ_WRITE_TOKEN: TOKEN, KV_REST_API_URL: "https://redis.example", KV_REST_API_TOKEN: "t" });
  try {
    assert.equal(store.getHistoricalStoreProfile().mode, "blob");
  } finally { restore(); }
});

test("an expansion snapshot is written privately, in place, and read back uncached", async () => {
  const { store, restore } = load({ BLOB_READ_WRITE_TOKEN: TOKEN });
  try {
    let saved = null;
    await withFetch((url, init) => {
      if (init.method === "PUT") { saved = init.body; return json(200, { pathname: "x" }); }
      return new Response(saved, { status: 200 });
    }, async (calls) => {
      await store.writeExpansionReach({ months: [1, 2] });
      const read = await store.readExpansionReach();
      assert.deepEqual(read, { months: [1, 2] });

      const put = calls[0];
      assert.equal(put.url, "https://vercel.com/api/blob/?pathname=meta-snapshots%2Fexpansion-reach.json");
      assert.equal(put.init.headers.Authorization, `Bearer ${TOKEN}`);
      assert.equal(put.init.headers["x-vercel-blob-access"], "private");
      assert.equal(put.init.headers["x-allow-overwrite"], "1");
      assert.equal(put.init.headers["x-add-random-suffix"], "0");

      assert.equal(calls[1].url, "https://StoreAbc123.private.blob.vercel-storage.com/meta-snapshots/expansion-reach.json?cache=0");
    });
  } finally { restore(); }
});

test("an empty blob falls back to the last redis snapshot", async () => {
  const { store, restore } = load({ BLOB_READ_WRITE_TOKEN: TOKEN, KV_REST_API_URL: "https://redis.example", KV_REST_API_TOKEN: "t" });
  try {
    await withFetch((url) => {
      if (url.includes("blob.vercel-storage.com")) return new Response("", { status: 404 });
      return json(200, { result: JSON.stringify({ from: "redis" }) });
    }, async () => {
      assert.deepEqual(await store.readAudienceSaturation(), { from: "redis" });
    });
  } finally { restore(); }
});

test("an empty blob with a full redis reads as no snapshot, not as an error", async () => {
  const { store, restore } = load({ BLOB_READ_WRITE_TOKEN: TOKEN, KV_REST_API_URL: "https://redis.example", KV_REST_API_TOKEN: "t" });
  try {
    await withFetch((url) => {
      if (url.includes("blob.vercel-storage.com")) return new Response("", { status: 404 });
      return json(200, { error: "ERR This database has reached current Fixed plan limits." });
    }, async () => {
      assert.equal(await store.readExpansionReach(), null);
    });
  } finally { restore(); }
});

test("a failed blob write surfaces Vercel's message", async () => {
  const { store, restore } = load({ BLOB_READ_WRITE_TOKEN: TOKEN });
  try {
    await withFetch(() => json(403, { error: { code: "forbidden", message: "Access denied" } }), async () => {
      await assert.rejects(store.writeExpansionReach({}), /Access denied/);
    });
  } finally { restore(); }
});
