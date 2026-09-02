const test = require("node:test");
const assert = require("node:assert/strict");
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
