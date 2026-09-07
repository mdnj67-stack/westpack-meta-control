const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const { createMetaSnapshotRuntime } = require("../server/meta/_snapshot-runtime");

// A full dashboard snapshot costs roughly 15 percentage points of Meta's hourly CPU-time
// budget on this ad account, so the per-resource TTLs were raised from 2 to 15 minutes.
// That is only safe because an explicit refresh can still reach Meta: force=1 previously
// skipped just the whole-response cache, so raising these TTLs on its own would have left
// the user pressing refresh and being handed the same figures with no way through.

const root = join(__dirname, "..");
const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
const fetchers = readFileSync(join(root, "server", "meta", "_snapshot-fetchers.js"), "utf8");

function makeRuntime() {
  // The runtime factory needs whatever its own dependencies are; build it with the same
  // shape the handler uses, minus anything these tests do not exercise.
  return createMetaSnapshotRuntime({
    fetchWithTimeout: async () => ({ ok: true, json: async () => ({}) }),
    graphBase: "https://graph.facebook.com/v25.0",
    nowMs: () => Date.now()
  });
}

test("the runtime exposes a cache bypass at all", () => {
  const runtime = makeRuntime();
  assert.equal(typeof runtime.getCachedMetaCollection, "function");
  const source = readFileSync(join(root, "server", "meta", "_snapshot-runtime.js"), "utf8");
  assert.match(source, /bypassCache = false/, "getCachedMetaCollection has no bypass parameter");
  assert.match(source, /const cached = bypassCache \? null : getCachedMapEntry/);
});

test("a cached resource is served without refetching, and a bypass refetches it", async () => {
  const runtime = makeRuntime();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { data: [{ call: calls }] };
  };

  const key = "test-resource";
  const first = await runtime.getCachedMetaCollection({ cacheKey: key, maxAgeMs: 60000, fetcher });
  assert.equal(calls, 1);
  assert.deepEqual(first.data, [{ call: 1 }]);

  // Inside the TTL: served from cache, Meta untouched. This is the CPU saving.
  const second = await runtime.getCachedMetaCollection({ cacheKey: key, maxAgeMs: 60000, fetcher });
  assert.equal(calls, 1, "a cached resource must not hit Meta again");
  assert.deepEqual(second.data, [{ call: 1 }]);

  // With the bypass: refetched even though the entry is still fresh. This is what keeps
  // "Update snapshot" meaningful after the TTL was raised.
  const forced = await runtime.getCachedMetaCollection({ cacheKey: key, maxAgeMs: 60000, fetcher, bypassCache: true });
  assert.equal(calls, 2, "bypassCache must reach Meta");
  assert.deepEqual(forced.data, [{ call: 2 }]);

  // And the fresh result replaces the cache, so the next routine view is cheap again.
  const afterForce = await runtime.getCachedMetaCollection({ cacheKey: key, maxAgeMs: 60000, fetcher });
  assert.equal(calls, 2, "the forced result should have been cached");
  assert.deepEqual(afterForce.data, [{ call: 2 }]);
});

test("the raised TTLs are what shipped", () => {
  // Pinned because the whole point is that they are no longer 2 minutes. A revert to 2
  // would silently restore the every-click-costs-a-snapshot behaviour.
  assert.match(handler, /const META_SNAPSHOT_CACHE_MAX_AGE_MS = 15 \* 60 \* 1000;/);
  assert.match(handler, /const META_INSIGHTS_CACHE_MAX_AGE_MS = 15 \* 60 \* 1000;/);
  // The acquisition trend series is finished days, so it keeps its much longer TTL.
  assert.match(handler, /const META_ACQUISITION_TREND_CACHE_MAX_AGE_MS = 3 \* 60 \* 60 \* 1000;/);
});

test("an explicit force reaches every cached layer, not just the response cache", () => {
  // force=1 already skipped the whole-response cache. Without also passing it down, the
  // per-resource caches would answer from up to 15 minutes ago.
  assert.match(handler, /if \(!forceRefresh && isCacheFresh\(cachedSnapshot, META_SNAPSHOT_CACHE_MAX_AGE_MS\)\)/);

  const passes = handler.match(/bypassCache: forceRefresh/g) || [];
  assert.equal(passes.length, 4, `expected the flag on all four dashboard fetchers, found ${passes.length}`);

  // Each dashboard fetcher must accept it. The awareness ad-set fetcher was missed on the
  // first pass and shipped a ReferenceError, so it is named explicitly here.
  for (const signature of ["fetchDashboardMetadataCollections", "fetchCampaignInsightsCollections", "fetchAwarenessAdSetInsightsCollections", "fetchCustomerAcquisitionTrend"]) {
    const start = fetchers.indexOf(`async function ${signature}(`);
    assert.notEqual(start, -1, `${signature} is gone`);
    const params = fetchers.slice(start, fetchers.indexOf(") {", start));
    assert.match(params, /bypassCache = false/, `${signature} does not accept bypassCache`);
  }
});

test("every cached collection call forwards the bypass", () => {
  // One call that ignores it would keep serving stale data through a forced refresh.
  const lines = fetchers.split(/\r?\n/);
  const callLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes("getCachedMetaCollection({"));

  assert.ok(callLines.length >= 10, `expected the cached calls, found ${callLines.length}`);

  let forwarded = 0;
  let withoutTiming = 0;
  for (const { index } of callLines) {
    // Scan the call's own object literal.
    const block = lines.slice(index, index + 12).join("\n");
    const body = block.slice(0, block.indexOf("fetcher:"));
    if (body.includes("bypassCache")) forwarded += 1;
    else if (!body.includes("timingStore")) withoutTiming += 1;
  }

  // The catalog fetcher's calls have no timing store and are not part of the dashboard
  // refresh path, so they are the only ones allowed to omit it.
  assert.equal(
    forwarded + withoutTiming,
    callLines.length,
    `${callLines.length - forwarded - withoutTiming} dashboard call(s) do not forward bypassCache`
  );
  assert.ok(forwarded >= 10, `only ${forwarded} calls forward the bypass`);
});

test("no duplicated bypassCache keys were left behind", () => {
  // The flag was threaded with a text replacement that first matched twice per call.
  // Duplicate object keys are legal JavaScript, so nothing would have failed loudly.
  const lines = fetchers.split(/\r?\n/);
  const duplicates = lines.filter((line, index) =>
    line.trim() === "bypassCache," && lines[index - 1]?.trim() === "bypassCache,");
  assert.deepEqual(duplicates, []);
});

test("every bypassCache usage sits inside a function that declares it", () => {
  // This is the check that was missing, and its absence put a ReferenceError in
  // production. The previous test confirmed each cached call forwards the flag, but not
  // that the enclosing fetcher actually has it in scope. Threading it with a text
  // replacement added it to fetchAwarenessAdSetInsightsCollections' calls without adding
  // it to that function's parameters, so the shorthand `bypassCache,` referenced a
  // variable that did not exist - and that fetcher runs on every snapshot with awareness
  // campaigns. `node --check` cannot see it; nothing fails until the request runs.
  const lines = fetchers.split(/\r?\n/);

  const functions = [];
  lines.forEach((line, index) => {
    const match = line.match(/^ {2}(?:async )?function (\w+)\(/);
    if (match) functions.push({ name: match[1], line: index });
  });
  assert.ok(functions.length >= 4, `expected the fetcher functions, found ${functions.length}`);

  const declares = new Set(
    functions
      .filter(({ line }) => lines.slice(line, line + 16).join("\n").includes("bypassCache = false"))
      .map(({ name }) => name)
  );

  const orphans = [];
  lines.forEach((line, index) => {
    if (line.trim() !== "bypassCache," && !/bypassCache:/.test(line)) return;
    if (/bypassCache = false/.test(line)) return;
    const owner = [...functions].reverse().find((entry) => entry.line < index);
    if (owner && !declares.has(owner.name)) {
      orphans.push(`${owner.name} (line ${index + 1})`);
    }
  });

  assert.deepEqual(
    orphans,
    [],
    `these functions use bypassCache without declaring it, which throws at request time: ${orphans.join(", ")}`
  );
});

test("every fetcher the handler forces is one that accepts the flag", () => {
  // The other direction: passing bypassCache to a fetcher that ignores it would silently
  // keep serving cached data through a forced refresh.
  const forced = [...handler.matchAll(/(fetch\w+)\(\{[\s\S]{0,600}?bypassCache: forceRefresh/g)]
    .map((match) => match[1]);
  assert.ok(forced.length >= 4, `expected several forced fetchers, found ${forced.length}`);

  for (const name of new Set(forced)) {
    const start = fetchers.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} is not defined in the fetchers`);
    const params = fetchers.slice(start, fetchers.indexOf(") {", start));
    assert.match(params, /bypassCache = false/, `the handler forces ${name}, which does not accept bypassCache`);
  }
});
