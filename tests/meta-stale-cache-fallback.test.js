const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Monday morning, Meta throttled, dashboard blank. The cache key is preset|from|to and
// `to` is today, so it changes daily: Friday's snapshot was still in the browser but
// stored under a key nothing would look for again. The rate-limit fallback only checked
// today's key, found nothing, and showed a bare error instead of the data it was holding.

const root = join(__dirname, "..");
const app = readFileSync(join(root, "app.js"), "utf8");
const cacheModule = readFileSync(join(root, "src", "meta-snapshot-cache.js"), "utf8");

test("the cache key really does change every day", () => {
  // If this ever stops being true the fallback below is unnecessary - but so long as the
  // key carries a date, a fresh day starts with nothing.
  const builder = cacheModule.match(/export function buildMetaSnapshotCacheKey[\s\S]*?\n\}/);
  assert.ok(builder, "buildMetaSnapshotCacheKey is gone");
  assert.match(builder[0], /options\?\.to/, "the key no longer includes the end date");
});

test("a most-recent-any-key reader exists and is sorted newest first", () => {
  assert.match(cacheModule, /export function readMostRecentMetaSnapshotCache/);
  const fn = cacheModule.match(/export function readMostRecentMetaSnapshotCache[\s\S]*?\n\}/)[0];
  // Newest first, by cachedAt.
  assert.match(fn, /rightAt - leftAt/);
  // Only usable snapshots, so a half-written entry cannot be shown.
  assert.match(fn, /isUsableMetaDashboardSnapshot/);
  // Never throws: a corrupt localStorage must not take the dashboard with it.
  assert.match(fn, /catch \{[\s\S]*?return null;/);
});

test("the stale fallback is used only when throttled and only when today's key misses", () => {
  const start = app.indexOf("const rateLimited = isMetaRateLimitMessage(error.message);");
  assert.notEqual(start, -1, "the rate-limit fallback has changed shape");
  const block = app.slice(start, start + 1200);

  // Today's key still wins when it has data.
  assert.match(block, /const fallbackEntry = cachedEntry\?\.snapshot \? cachedEntry : staleEntry;/);
  // The any-key reader is consulted only on a rate limit, and only as a second choice.
  assert.match(block, /!cachedEntry\?\.snapshot && rateLimited\s*\?\s*readMostRecentMetaSnapshotCache\(\)/);
  // And nothing is shown for a non-rate-limit failure, which stays a plain error.
  assert.match(block, /if \(fallbackEntry\?\.snapshot && rateLimited\)/);
});

test("stale data always names the range it actually covers", () => {
  // This is the safeguard. Real figures from the wrong window are only safe if the window
  // is stated; otherwise they read as current.
  const start = app.indexOf("const staleRangeLabel");
  assert.notEqual(start, -1, "the stale range is no longer labelled");
  const block = app.slice(start, start + 1000);

  assert.match(block, /snapshot\.scope\?\.label/);
  assert.match(block, /not the selected range/);
  assert.match(block, /Meta rate limited/);
  // The age is surfaced too, so "cached 3 days ago" is visible rather than implied.
  assert.match(block, /formatRelativeAgeFromNow\(fallbackEntry\.cachedAt\)/);
  // The source label distinguishes it from a same-range fallback.
  assert.match(app.slice(start - 900, start), /isStaleRange \? "Older cached range" : "Fallback cache"/);
});

test("the reader is imported, so the fallback cannot throw a ReferenceError", () => {
  // Twice in the last week a helper was called without being imported, and neither
  // `node --check` nor the unit tests caught it because the call sites only run on
  // request. This is the cheap guard against a third.
  const block = app.match(/import \{([^}]*)\} from "\.\/src\/meta-snapshot-cache\.js[^"]*";/);
  assert.ok(block, "app.js no longer imports the snapshot cache module");
  const imported = block[1].split(",").map((name) => name.trim()).filter(Boolean);
  assert.ok(
    imported.includes("readMostRecentMetaSnapshotCache"),
    "the fallback calls readMostRecentMetaSnapshotCache without importing it"
  );

  const exported = new Set([...cacheModule.matchAll(/export function (\w+)/g)].map((m) => m[1]));
  const missing = imported.filter((name) => !exported.has(name));
  assert.deepEqual(missing, [], `imported but not exported: ${missing.join(", ")}`);
});
