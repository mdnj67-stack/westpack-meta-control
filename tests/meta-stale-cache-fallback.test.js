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

test("the fallback covers any failure to reach Meta, and today's key still wins", () => {
  // It used to be restricted to rate limits. A timeout then fell through to the failure
  // state, which writes its message without clearing the panels, so "Meta data could not
  // be loaded" appeared above a full set of figures with nothing saying how old they
  // were. From the reader's side a timeout and a throttle are the same event: Meta could
  // not be reached, and what is on screen is older than it looks.
  const start = app.indexOf("const rateLimited = isMetaRateLimitMessage(error.message);");
  assert.notEqual(start, -1, "the fallback has changed shape");
  const block = app.slice(start, start + 1600);

  // Today's key still wins when it has data; the any-key reader is the second choice.
  assert.match(block, /const fallbackEntry = cachedEntry\?\.snapshot \? cachedEntry : staleEntry;/);
  assert.match(block, /!cachedEntry\?\.snapshot\s*\?\s*readMostRecentMetaSnapshotCache\(\)/);
  // And it is no longer gated on the failure being a rate limit.
  assert.match(block, /if \(fallbackEntry\?\.snapshot\) \{/);
  assert.ok(
    !/if \(fallbackEntry\?\.snapshot && rateLimited\)/.test(block),
    "the fallback is gated on rate limits again, so a timeout will show undated figures"
  );

  // The cause still has to reach the reader, in its own words.
  assert.match(block, /const failureReason = rateLimited/);
  assert.match(block, /Meta did not respond in time/);
});

test("a failure with nothing cached clears the panels before explaining itself", () => {
  // Otherwise the explanation lands on top of figures from an earlier render, which reads
  // as "these numbers are current and also could not be loaded".
  const start = app.indexOf('renderPanelSafely("Load Failure Clear"');
  assert.notEqual(start, -1, "the failure path no longer clears the panels");
  assert.match(app.slice(start, start + 400), /renderCoreData\(\[\], \[\], \[\], \[\], null, null\)/);

  // And the clear has to come before the message, or the message is what gets wiped.
  const messageAt = app.indexOf('renderPanelSafely("Load Failure State"');
  assert.notEqual(messageAt, -1, "the failure message is gone");
  assert.ok(start < messageAt, "the panels are cleared after the message is written");
});

test("stale data always names the range it actually covers", () => {
  // This is the safeguard. Real figures from the wrong window are only safe if the window
  // is stated; otherwise they read as current.
  const start = app.indexOf("const staleRangeLabel");
  assert.notEqual(start, -1, "the stale range is no longer labelled");
  const block = app.slice(start, start + 1000);

  assert.match(block, /snapshot\.scope\?\.label/);
  assert.match(block, /not the selected range/);
  // The cause is named through failureReason now, so the line reads "Meta did not respond
  // in time. Showing …" as readily as it reads "Meta is rate limited. Showing …".
  assert.match(block, /\$\{failureReason\}/, "the stale line must say why the fresh read failed");
  // A same-range cached snapshot is still not a fresh read, and has to say so.
  assert.match(block, /not a fresh read|showing a snapshot/);
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
