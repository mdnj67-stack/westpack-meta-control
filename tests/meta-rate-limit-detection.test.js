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
  const retryDecisions = runtime.match(/const shouldRetry = isRetryableMetaError\(message\) && attempt < retryBudgetFor\(message, maxRetries\);/g) || [];
  assert.equal(retryDecisions.length, 2, "both the response path and the throw path must use the retryable check");

  // Timeouts get fewer attempts than errors that came back immediately, because a timeout
  // has already spent the full request budget before it fails.
  assert.match(runtime, /const META_TIMEOUT_MAX_RETRIES = 2;/);
  assert.match(runtime, /function retryBudgetFor\(message, maxRetries\)/);
  // But a rate limit still gets none at all, whatever the budget says.
  assert.match(runtime, /return isTransientMetaError\(message\) && !isRateLimitError\(message\);/);

  // The rate-limit check itself has to stay, because the stale-cache fallback keys off it.
  assert.match(runtime, /function isRateLimitError/);
  assert.match(runtime, /isRetryableMetaError,/, "the helper must be exported for tests and callers");
});

test("the timeout this code raises itself is recognised as transient", () => {
  // fetchWithTimeout throws "Request timed out after 30000ms." - "timed out", with a
  // space. The transient list tested for "timeout" and so never matched the one error
  // this code produces on its own, which meant a single slow Meta call failed the entire
  // snapshot with no retry. The dashboard showed it as "Request timed out after 15000ms"
  // with every panel empty.
  const runtime = readFileSync(join(__dirname, "..", "server", "meta", "_snapshot-runtime.js"), "utf8");
  const start = runtime.indexOf("function isMetaTimeoutError");
  assert.notEqual(start, -1, "the timeout matcher is gone");
  const fn = runtime.slice(start, runtime.indexOf("function isTransientMetaError"));

  assert.match(fn, /timed out/, "the matcher must accept the wording fetchWithTimeout actually throws");
  assert.match(fn, /timeout/, "and the one-word spelling Meta itself sometimes returns");

  // Reproduce it rather than trusting that it reads correctly.
  const matches = (message) => {
    const text = String(message || "").toLowerCase();
    return text.includes("timed out") || text.includes("timeout") || text.includes("aborted");
  };
  assert.equal(matches("Request timed out after 30000ms."), true);
  assert.equal(matches("Meta request timeout"), true);
  assert.equal(matches("The operation was aborted"), true);
  assert.equal(matches("There have been too many calls to this ad-account"), false);

  // And the transient list has to route through it, not carry its own copy.
  const transient = runtime.slice(
    runtime.indexOf("function isTransientMetaError"),
    runtime.indexOf("const META_TIMEOUT_MAX_RETRIES")
  );
  assert.match(transient, /isMetaTimeoutError\(text\)/);
});

test("the per-request timeout leaves room for this account's heaviest query", () => {
  // The ad-set daily insights call was measured at 15,009ms on the live account, so a
  // 15,000ms limit failed it by nine milliseconds and took the whole snapshot down. The
  // function itself has a 300s budget, so the per-request limit was the binding
  // constraint rather than the platform.
  const handler = readFileSync(join(__dirname, "..", "api", "meta", "account-snapshot.js"), "utf8");
  const match = handler.match(/const META_REQUEST_TIMEOUT_MS = (\d+);/);
  assert.ok(match, "the request timeout constant is gone");
  assert.ok(
    Number(match[1]) >= 30000,
    `the per-request timeout is back down to ${match[1]}ms, below the heaviest measured query`
  );

  const vercel = JSON.parse(readFileSync(join(__dirname, "..", "vercel.json"), "utf8"));
  const budget = vercel.functions?.["api/meta/account-snapshot.js"]?.maxDuration || 0;
  assert.ok(
    budget >= Number(match[1]) / 1000 * 3,
    "the function budget no longer leaves room for a timeout plus its retries"
  );
});
