const test = require("node:test");
const assert = require("node:assert/strict");
const { getConfig, normalizeExternalCredential } = require("../server/lib/config");

test("Meta credentials are trimmed before Graph API requests", () => {
  assert.equal(normalizeExternalCredential("  token-value\r\n"), "token-value");
  assert.equal(normalizeExternalCredential(null), "");
});

test("getConfig removes hidden line endings from production Meta environment values", () => {
  const previousToken = process.env.META_ACCESS_TOKEN;
  const previousAccountId = process.env.META_AD_ACCOUNT_ID;
  const previousAppId = process.env.META_APP_ID;

  process.env.META_ACCESS_TOKEN = "production-token\r\n";
  process.env.META_AD_ACCOUNT_ID = "  act_123456  ";
  process.env.META_APP_ID = "  987654\r\n";

  try {
    const config = getConfig();
    assert.equal(config.metaAccessToken, "production-token");
    assert.equal(config.metaAdAccountId, "act_123456");
    assert.equal(config.metaAppId, "987654");
  } finally {
    if (previousToken === undefined) delete process.env.META_ACCESS_TOKEN;
    else process.env.META_ACCESS_TOKEN = previousToken;
    if (previousAccountId === undefined) delete process.env.META_AD_ACCOUNT_ID;
    else process.env.META_AD_ACCOUNT_ID = previousAccountId;
    if (previousAppId === undefined) delete process.env.META_APP_ID;
    else process.env.META_APP_ID = previousAppId;
  }
});
