const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Drives the real rollout route against a fake Klaviyo. A campaign draft copies audiences, sender, smart sending and
// tracking from a campaign the team already set up, takes the subject given and gets the template assigned - and is
// never sent or scheduled (the user, 2026-11-17: "hverken med send eller scheduling, det gør jeg selv").
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
process.env.AUTH_PASSWORD = "klaviyo-campaign-draft-test-password";
process.env.AUTH_SESSION_SECRET = "klaviyo-campaign-draft-test-secret";
process.env.KLAVIYO_MARKETS_JSON = JSON.stringify([{ country: "DE", privateKey: "pk_test_de" }]);
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { getConfig } = require("../server/lib/config");
const { createSessionToken, isAuthEnabled } = require("../server/lib/auth");
const handler = require("../api/klaviyo/push-template-rollout");

const config = getConfig();
const sessionCookie = isAuthEnabled(config) ? `westpack_session=${encodeURIComponent(createSessionToken(config))}` : "";
const originalFetch = global.fetch;

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

const SOURCE = {
  data: {
    type: "campaign",
    id: "SRC1",
    attributes: {
      name: "W47: Keramik og lys",
      status: "Sent",
      audiences: { included: ["SEG120"], excluded: [] },
      send_options: { use_smart_sending: true, ignore_unsubscribes: false },
      tracking_options: { add_tracking_params: true, custom_tracking_params: [{ type: "static", value: "klaviyo", name: "utm_source" }], is_tracking_clicks: true, is_tracking_opens: true, extra: null }
    },
    relationships: { "campaign-messages": { data: [{ type: "campaign-message", id: "SRCMSG" }] } }
  },
  included: [{ type: "campaign-message", id: "SRCMSG", attributes: { label: "W47", content: { subject: "Neu: Geschenkboxen", preview_text: "", from_email: "info@westpack.de", from_label: "Hanne von Westpack", reply_to_email: "", cc_email: null, bcc_email: null } } }]
};

function fakeKlaviyo({ existingDraft = false } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: href, method, body, revision: options.headers?.revision });
    let payload = {};
    if (method === "GET" && href.includes("/campaigns/SRC1/")) payload = SOURCE;
    else if (method === "GET" && href.includes("/campaigns/?filter=")) {
      payload = { data: existingDraft ? [{ type: "campaign", id: "OLD1", attributes: { name: "W46: Kevins æske lommeregner", status: "Draft" }, relationships: { "campaign-messages": { data: [{ id: "OLDMSG" }] } } }] : [], links: { next: null } };
    } else if (method === "POST" && href.endsWith("/campaigns/")) {
      payload = { data: { type: "campaign", id: "NEW1", attributes: { status: "Draft" }, relationships: { "campaign-messages": { data: [{ type: "campaign-message", id: "NEWMSG" }] } } } };
    } else if (method === "POST" && href.endsWith("/campaign-message-assign-template/")) {
      payload = { data: { type: "campaign-message", id: body.data.id, relationships: { template: { data: { type: "template", id: "COPY1" } } } } };
    } else if (method === "GET" && href.includes("/campaign-messages/NEWMSG/template/")) {
      payload = { data: { type: "template", id: "COPY1" } };
    } else if (method === "POST" && href.endsWith("/template-render/")) {
      payload = { data: { type: "template", attributes: { html: "<a href=\"https://www.westpack.com/eur_eu_ger/blog\">Blog</a>", text: "Blog" } } };
    }
    return { ok: true, status: method === "POST" ? 201 : 200, headers: { get: () => null }, json: async () => payload, text: async () => JSON.stringify(payload) };
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

const DRAFT = { mode: "campaign_draft", country: "DE", name: "W46: Kevins æske lommeregner", subject: "Kevin hat Ihr Weihnachten ausgerechnet 🧮", templateId: "Rkyn8k", sourceCampaignId: "SRC1" };

test("a campaign draft copies audiences, sender, smart sending and tracking, and assigns the template", async () => {
  const calls = fakeKlaviyo();
  const result = await callRoute(DRAFT);
  assert.equal(result.status, 200);
  const create = calls.find((call) => call.method === "POST" && call.url.endsWith("/campaigns/"));
  const attributes = create.body.data.attributes;
  assert.equal(attributes.name, "W46: Kevins æske lommeregner");
  assert.deepEqual(attributes.audiences, { included: ["SEG120"], excluded: [] });
  assert.deepEqual(attributes.send_options, { use_smart_sending: true }, "ignore_unsubscribes is never inherited");
  assert.equal(attributes.tracking_options.custom_tracking_params[0].name, "utm_source");
  assert.ok(!("extra" in attributes.tracking_options), "nulls are not sent back");
  assert.ok(!("send_strategy" in attributes), "no send time is set");
  const content = attributes["campaign-messages"].data[0].attributes.content;
  assert.equal(content.subject, "Kevin hat Ihr Weihnachten ausgerechnet 🧮");
  assert.equal(content.from_label, "Hanne von Westpack");
  assert.equal(content.from_email, "info@westpack.de");
  assert.equal(content.reply_to_email, "info@westpack.de", "an empty reply-to means the sender, and the API requires one");
  assert.ok(!("cc_email" in content));
  const assign = calls.find((call) => call.url.endsWith("/campaign-message-assign-template/"));
  assert.deepEqual(assign.body.data, { type: "campaign-message", id: "NEWMSG", relationships: { template: { data: { type: "template", id: "Rkyn8k" } } } });
  assert.equal(result.payload.campaignId, "NEW1");
  assert.equal(result.payload.messageId, "NEWMSG");
  assert.ok(calls.every((call) => call.revision === "2024-10-15"));
});

test("it never sends or schedules", async () => {
  const calls = fakeKlaviyo();
  await callRoute(DRAFT);
  assert.ok(calls.every((call) => !/campaign-send-jobs|send-job|schedule/i.test(call.url)));
  const source = fs.readFileSync(path.join(__dirname, "..", "server", "klaviyo", "campaign-draft.js"), "utf8");
  assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm, ""), /campaign-send-jobs|send_strategy/, "the module has no way to send or schedule");
});

test("a retry reuses the draft of the same name instead of making a second one", async () => {
  const calls = fakeKlaviyo({ existingDraft: true });
  const result = await callRoute(DRAFT);
  assert.equal(result.status, 200);
  assert.ok(!calls.some((call) => call.method === "POST" && call.url.endsWith("/campaigns/")));
  const patch = calls.find((call) => call.method === "PATCH");
  assert.match(patch.url, /\/campaign-messages\/OLDMSG\/$/);
  assert.equal(patch.body.data.attributes.content.subject, DRAFT.subject);
  assert.equal(result.payload.reused, true);
  assert.equal(result.payload.campaignId, "OLD1");
});

test("a dry run reads the source and creates nothing", async () => {
  const calls = fakeKlaviyo();
  const result = await callRoute({ ...DRAFT, dryRun: true });
  assert.equal(result.status, 200);
  assert.equal(result.payload.dryRun, true);
  assert.ok(calls.every((call) => call.method === "GET"));
});

test("render_template renders a campaign message's own template, read-only towards the campaign", async () => {
  const calls = fakeKlaviyo();
  const result = await callRoute({ mode: "render_template", country: "DE", messageId: "NEWMSG" });
  assert.equal(result.status, 200);
  assert.equal(result.payload.templateId, "COPY1");
  assert.match(result.payload.html, /eur_eu_ger/);
  const render = calls.find((call) => call.url.endsWith("/template-render/"));
  assert.deepEqual(render.body, { data: { type: "template", attributes: { id: "COPY1", context: {} } } });
});
