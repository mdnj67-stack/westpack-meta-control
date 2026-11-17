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

test("messageId returns the template a sent campaign message used, which the template list never shows", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), auth: options.headers?.Authorization });
    const payload = { data: { type: "template", id: "TmPl01", attributes: { name: "W41 Adventskalender", editor_type: "SYSTEM_DRAGGABLE", html: "<p>Kevin</p>", text: "Kevin", created: "2025-10-08T09:00:00+00:00", updated: "2025-10-09T07:00:00+00:00" } } };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload, text: async () => JSON.stringify(payload) };
  };
  const result = await callRoute({ country: "UK", messageId: "01K6ABC" });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://a.klaviyo.com/api/campaign-messages/01K6ABC/template/");
  assert.equal(result.payload.template.id, "TmPl01");
  assert.equal(result.payload.template.html, "<p>Kevin</p>");
  assert.equal(result.payload.template.name, "W41 Adventskalender");
});

test("campaigns=1 lists drafts and scheduled campaigns with subject, preheader, sender and audiences by name", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ url: href, revision: options.headers?.revision });
    let payload;
    let status = 200;
    if (href.startsWith("https://a.klaviyo.com/api/campaigns/")) {
      payload = {
        data: [{
          type: "campaign", id: "C1",
          attributes: { name: "W46 Boxulator", status: "Scheduled", scheduled_at: "2026-11-18T07:00:00+00:00", audiences: { included: ["L1"], excluded: ["S1"] } },
          relationships: { "campaign-messages": { data: [{ type: "campaign-message", id: "M1" }] } }
        }],
        included: [{ type: "campaign-message", id: "M1", attributes: { label: "W46", content: { subject: "Kevin regner", preview_text: "Af smykkeæsker", from_label: "Jette fra Westpack", from_email: "info@westpack.dk" } } }],
        links: { next: null }
      };
    } else if (href.startsWith("https://a.klaviyo.com/api/lists/L1/")) {
      payload = { data: { type: "list", id: "L1", attributes: { name: "Newsletter" } } };
    } else if (href.startsWith("https://a.klaviyo.com/api/lists/S1/")) {
      status = 404;
      payload = { errors: [{ detail: "Not found" }] };
    } else if (href.startsWith("https://a.klaviyo.com/api/segments/S1/")) {
      payload = { data: { type: "segment", id: "S1", attributes: { name: "Unengaged 180" } } };
    }
    return { ok: status < 400, status, headers: { get: () => null }, json: async () => payload, text: async () => JSON.stringify(payload) };
  };
  const result = await callRoute({ country: "UK", campaigns: "1" });
  assert.equal(result.status, 200);
  assert.match(calls[0].url, /equals\(messages\.channel,'email'\),greater-than\(updated_at,/);
  assert.doesNotMatch(calls[0].url, /equals\(status,'Sent'\)/, "drafts and scheduled campaigns are included");
  assert.equal(calls[0].revision, "2024-10-15");
  assert.ok(calls.every((call) => !/method/i.test(call.url)));
  const [campaign] = result.payload.campaigns;
  assert.equal(campaign.status, "Scheduled");
  assert.equal(campaign.scheduledAt, "2026-11-18T07:00:00+00:00");
  assert.deepEqual(campaign.audiences.included, [{ id: "L1", name: "List: Newsletter" }]);
  assert.deepEqual(campaign.audiences.excluded, [{ id: "S1", name: "Segment: Unengaged 180" }]);
  assert.deepEqual(campaign.messages[0], {
    id: "M1", label: "W46", subject: "Kevin regner", previewText: "Af smykkeæsker",
    fromEmail: "info@westpack.dk", fromLabel: "Jette fra Westpack", replyToEmail: "", sendTimes: []
  });
});
