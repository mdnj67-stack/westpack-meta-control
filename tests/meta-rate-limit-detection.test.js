const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { isRateLimitMessage } = require("../server/lib/meta");

test("recognizes Meta's standard throttling error codes even without matching English wording", () => {
  // These are the shapes graphRequest actually builds ("<message> | code <n> | ..."), for the
  // codes Meta uses for throttling: 4 = application limit, 17 = user limit, 32 = page limit,
  // 613 = a custom/business rate limit. This matters most on Development Access, whose lower
  // ceiling can trip with wording that doesn't literally say "rate limit".
  assert.equal(isRateLimitMessage("An unexpected error has occurred. | code 4"), true);
  assert.equal(isRateLimitMessage("(#17) User request limit reached | code 17"), true);
  assert.equal(isRateLimitMessage("Page request limit reached | code 32"), true);
  assert.equal(isRateLimitMessage("Calls to this api have exceeded the rate limit. | code 613"), true);
});

test("does not false-positive on unrelated error codes that merely contain the same digits", () => {
  assert.equal(isRateLimitMessage("Invalid parameter | code 100"), false);
  assert.equal(isRateLimitMessage("Unsupported request | code 400"), false);
  assert.equal(isRateLimitMessage("Some other failure | code 17000"), false);
});

test("still recognizes the plain-English throttling phrases", () => {
  assert.equal(isRateLimitMessage("Application request limit reached"), true);
  assert.equal(isRateLimitMessage("Too many calls to this API"), true);
  assert.equal(isRateLimitMessage("You have hit the rate limit"), true);
});

test("does not flag a normal, unrelated error", () => {
  assert.equal(isRateLimitMessage("Invalid OAuth access token."), false);
  assert.equal(isRateLimitMessage(""), false);
});

test("a rate limit is not retried inside the same request", () => {
  // It used to count as a transient error, so a throttled call was retried four more
  // times with a one-to-five second backoff. Meta measures its account, app and user
  // limits over minutes to an hour, so none of those retries could succeed: they spent
  // five calls' worth of quota where one had already failed, deepened the throttle, and
  // delayed the honest answer by about twelve seconds. On the Westpack account that was
  // the difference between a refresh completing and a refresh that could not complete.
  const runtime = readFileSync(join(__dirname, "..", "server", "meta", "_snapshot-runtime.js"), "utf8");

  assert.match(runtime, /function isRetryableMetaError/);
  assert.ok(
    !/const shouldRetry = isTransientMetaError\(message\)/.test(runtime),
    "the retry decision is reading the transient check again, which includes rate limits"
  );
  const retryDecisions = runtime.match(/const shouldRetry = isRetryableMetaError\(message\) && attempt < maxRetries;/g) || [];
  assert.equal(retryDecisions.length, 2, "both the response path and the throw path must use the retryable check");

  // The rate-limit check itself has to stay, because the stale-cache fallback keys off it.
  assert.match(runtime, /function isRateLimitError/);
  assert.match(runtime, /isRetryableMetaError,/, "the helper must be exported for tests and callers");
});
