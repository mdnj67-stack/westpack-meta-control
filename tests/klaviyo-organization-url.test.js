const test = require("node:test");
const assert = require("node:assert/strict");

// Drives the real templates route against a fake Klaviyo: ?organization=1 must read the account's
// website URL, which is what {{ organization.url }} resolves to in that market's emails.
const originalEnv = {
  VERCEL: process.env.VERCEL,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  KLAVIYO_MARKETS_JSON: process.env.KLAVIYO_MARKETS_JSON
};
process.env.VERCEL = "1";
process.env.AUTH_PASSWORD = "klaviyo-organization-test-password";
process.env.AUTH_SESSION_SECRET = "klaviyo-organization-test-secret";
process.env.KLAVIYO_MARKETS_JSON = JSON.stringify([{ country: "UK", privateKey: "pk_test_uk" }]);

const { getConfig } = require("../server/lib/config");
const { createSessionToken, isAuthEnabled } = require("../server/lib/auth");
const handler = require("../api/klaviyo/templates");

const config = getConfig();
const sessionCookie = isAuthEnabled(config) ? `westpack_session=${encodeURIComponent(createSessionToken(config))}` : "";
const originalFetch = global.fetch;

function callRoute(query) {
  return new Promise((resolve) => {
    const req = { method: "GET", url: "/api/klaviyo/templates", query, headers: { host: "localhost", ...(sessionCookie ? { cookie: sessionCookie } : {}) } };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(payload) { resolve({ status: this.statusCode, payload: payload ? JSON.parse(payload) : {} }); }
    };
    handler(req, res);
  });
}

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("organization=1 returns the account's website URL, which {{ organization.url }} resolves to", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), auth: options.headers?.Authorization });
    const payload = { data: [{ type: "account", id: "AbC123", attributes: { contact_information: { organization_name: "Westpack UK", website_url: "https://www.westpack.com/gbp_uk_eng/" } } }] };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload, text: async () => JSON.stringify(payload) };
  };
  const result = await callRoute({ country: "UK", organization: "1" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { country: "UK", organizationName: "Westpack UK", organizationUrl: "https://www.westpack.com/gbp_uk_eng/" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://a.klaviyo.com/api/accounts/");
  assert.equal(calls[0].auth, "Klaviyo-API-Key pk_test_uk", "it reads the market's own account");
});
