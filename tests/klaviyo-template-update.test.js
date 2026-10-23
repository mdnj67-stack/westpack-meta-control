const test = require("node:test");
const assert = require("node:assert/strict");

// Drives the real rollout route against a fake Klaviyo, so it proves which request is sent rather
// than that a pattern appears in the source. Everything comes from the environment set here, so a
// fresh clone without local secrets behaves the same as a developer machine.
const originalEnv = {
  VERCEL: process.env.VERCEL,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  KLAVIYO_MARKETS_JSON: process.env.KLAVIYO_MARKETS_JSON,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
};
process.env.VERCEL = "1";
process.env.AUTH_PASSWORD = "klaviyo-update-test-password";
process.env.AUTH_SESSION_SECRET = "klaviyo-update-test-secret";
process.env.KLAVIYO_MARKETS_JSON = JSON.stringify([{ country: "DK", privateKey: "pk_test_dk" }]);
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { getConfig } = require("../server/lib/config");
const { createSessionToken, isAuthEnabled } = require("../server/lib/auth");
const { listAuditEvents } = require("../server/campaign/audit-log");
const handler = require("../api/klaviyo/push-template-rollout");

const config = getConfig();
const sessionCookie = isAuthEnabled(config) ? `westpack_session=${encodeURIComponent(createSessionToken(config))}` : "";
const originalFetch = global.fetch;
const BODY = "<!doctype html><html><body><p>Det Store Gaveæske Grand Prix</p></body></html>";

function callRoute(body) {
  return new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/api/klaviyo/push-template-rollout",
      headers: { host: "localhost", ...(sessionCookie ? { cookie: sessionCookie } : {}) },
      on(event, listener) {
        if (event === "data") listener(Buffer.from(JSON.stringify(body)));
        if (event === "end") listener();
        return req;
      },
      removeListener() { return req; }
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(payload) { resolve({ status: this.statusCode, payload: payload ? JSON.parse(payload) : {} }); }
    };
    handler(req, res);
  });
}

// Records every Klaviyo call and answers the way Klaviyo does for create and update.
function fakeKlaviyo() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: String(url), method: options.method || "GET", body });
    const id = options.method === "PATCH" ? String(url).split("/").pop() : "NEWID1";
    const payload = { data: { type: "template", id, attributes: { name: "W45 Grand Prix | DK | Draft" } } };
    return { ok: true, status: options.method === "POST" ? 201 : 200, headers: { get: () => null }, json: async () => payload, text: async () => JSON.stringify(payload) };
  };
  return calls;
}

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("a templateId rewrites that template in place instead of creating a new one", async () => {
  const calls = fakeKlaviyo();
  const result = await callRoute({
    sourceTemplateName: "W45 Gaveæske feature",
    campaignKey: "1217852050501336",
    assignments: [{ country: "DK", code: "DA", label: "Dansk", templateId: "RPwN5Z", subject: "Fire gaveæsker", previewText: "Stem", body: BODY }]
  });

  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, "https://a.klaviyo.com/api/templates/RPwN5Z");
  assert.equal(calls[0].body.data.id, "RPwN5Z");
  assert.equal(calls[0].body.data.attributes.html, BODY, "a full HTML document is written as it was sent");
  assert.equal("name" in calls[0].body.data.attributes, false, "an update never renames the draft");
  assert.deepEqual(
    { ok: result.payload.results[0].ok, updated: result.payload.results[0].updated, templateId: result.payload.results[0].templateId },
    { ok: true, updated: true, templateId: "RPwN5Z" }
  );
});

test("without a templateId the route still creates a new draft", async () => {
  const calls = fakeKlaviyo();
  const result = await callRoute({
    sourceTemplateName: "W45 Gaveæske feature",
    assignments: [{ country: "DK", code: "DA", label: "Dansk", subject: "Fire gaveæsker", body: BODY }]
  });

  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://a.klaviyo.com/api/templates");
  assert.equal(result.payload.results[0].templateId, "NEWID1");
  assert.equal(result.payload.results[0].updated, undefined);
});

test("an update is recorded in the audit trail as an update, not as a new draft", async () => {
  fakeKlaviyo();
  await callRoute({
    sourceTemplateName: "W45 Gaveæske feature",
    campaignKey: "audit-update-check",
    assignments: [{ country: "DK", code: "DA", templateId: "RPwN5Z", subject: "Fire gaveæsker", body: BODY }]
  });

  const events = await listAuditEvents({ campaignKey: "audit-update-check" });
  assert.deepEqual(events.map((entry) => entry.event), ["klaviyo_draft_updated"]);
  assert.equal(events[0].reference, "RPwN5Z");
});
