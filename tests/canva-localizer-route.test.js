const test = require("node:test");
const assert = require("node:assert/strict");

// Volatile persistence and fake credentials, so this drives the real route end to end without
// touching Canva, OpenAI, Redis or the local data directory.
// Everything this test depends on comes from the environment it sets here. The developer
// machine has .env.local, .vercel.live.env and klaviyo-config.json, and a fresh clone has none
// of them - a test that read those would pass here and fail for the next person.
const originalEnv = {
  VERCEL: process.env.VERCEL,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CANVA_CLIENT_ID: process.env.CANVA_CLIENT_ID,
  CANVA_CLIENT_SECRET: process.env.CANVA_CLIENT_SECRET,
  KLAVIYO_MARKETS_JSON: process.env.KLAVIYO_MARKETS_JSON,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
};
process.env.VERCEL = "1";
process.env.AUTH_PASSWORD = "canva-localizer-test-password";
process.env.AUTH_SESSION_SECRET = "canva-localizer-test-secret";
process.env.OPENAI_API_KEY = "sk-test";
process.env.CANVA_CLIENT_ID = "OC-test";
process.env.CANVA_CLIENT_SECRET = "secret-test";
process.env.KLAVIYO_MARKETS_JSON = JSON.stringify(
  ["CZ", "DE", "DK", "ES", "EU", "FI", "FR", "HU", "IT", "NL", "NO", "PL", "PT", "RO", "SE", "SK", "UK", "US"]
    .map((country) => ({ country }))
);
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { getConfig } = require("../server/lib/config");
const { createSessionToken, isAuthEnabled } = require("../server/lib/auth");
const { writeCanvaTokens, clearCanvaTokens } = require("../server/canva/token-store");
const handler = require("../api/canva/localizer");

const config = getConfig();
const sessionCookie = isAuthEnabled(config) ? `westpack_session=${encodeURIComponent(createSessionToken(config))}` : "";
const originalFetch = global.fetch;

function callRoute(url, { method = "GET", body = null } = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { host: "localhost", ...(sessionCookie ? { cookie: sessionCookie } : {}) },
      on(event, listener) {
        if (event === "data" && body) listener(Buffer.from(JSON.stringify(body)));
        if (event === "end") listener();
        return req;
      }
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(payload) {
        resolve({ status: this.statusCode, payload: payload ? JSON.parse(payload) : {} });
      }
    };
    handler(req, res);
  });
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
    json: async () => payload
  };
}

// One fake world: OpenAI answers a structured translation, Canva answers autofill and export.
// `failMarkets` decides which language Canva refuses, so partial failure can be exercised.
function stubWorld({ failTitles = [] } = {}) {
  const calls = { translations: [], autofills: [], exports: [] };
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    const body = options.body ? JSON.parse(options.body) : {};

    if (href.includes("api.openai.com")) {
      calls.translations.push(body);
      const askedFor = JSON.stringify(body.input).match(/field \\"([a-z_]+)\\"/g) || [];
      const fields = [...new Set(askedFor.map((entry) => entry.match(/\\"([a-z_]+)\\"/)[1]))]
        .map((key) => ({ key, text: `${key}-translated`, compact: `${key}-short`, note: "" }));
      return jsonResponse(200, {
        model: "test-model",
        output: [{ content: [{ text: JSON.stringify({ fields }) }] }]
      });
    }

    if (href.endsWith("/v1/autofills")) {
      calls.autofills.push(body);
      if (failTitles.includes(body.title)) {
        return jsonResponse(403, { code: "autofill_feature_forbidden", message: "Not allowed." });
      }
      return jsonResponse(200, {
        job: {
          id: `job-${calls.autofills.length}`,
          status: "success",
          result: {
            type: "create_design",
            design: {
              id: `DA-${body.title}`,
              title: body.title,
              thumbnail: { url: `https://thumb.test/${body.title}.png` },
              urls: { view_url: `https://canva.test/${body.title}`, edit_url: `https://canva.test/${body.title}/edit` }
            }
          }
        }
      });
    }

    if (href.endsWith("/v1/exports")) {
      calls.exports.push(body);
      return jsonResponse(200, {
        job: { id: "exp", status: "success", urls: [`https://export.test/${body.design_id}.png`] }
      });
    }

    throw new Error(`Unexpected fetch in test: ${href}`);
  };
  return calls;
}

test.after(async () => {
  global.fetch = originalFetch;
  await clearCanvaTokens();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("status reports the configured markets and the plan capability without any Canva call", async () => {
  await clearCanvaTokens();
  global.fetch = async () => { throw new Error("status must not call Canva"); };

  const { status, payload } = await callRoute("/api/canva/localizer?action=status");
  assert.equal(status, 200);
  assert.equal(payload.connection.configured, true);
  assert.equal(payload.connection.connected, false);
  assert.equal(payload.connection.canAutofill, false);
  assert.ok(payload.markets.length >= 18, "the 18 Klaviyo markets drive the language list");
  assert.ok(payload.markets.some((market) => market.marketCode === "DE" && market.language === "German"));
});

test("generation is refused up front when the account has no autofill capability", async () => {
  await writeCanvaTokens({
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    capabilities: ["brand_template"]
  });
  global.fetch = async () => { throw new Error("must not reach Canva"); };

  const { status, payload } = await callRoute("/api/canva/localizer?action=generate", {
    method: "POST",
    body: { jobId: "anything" }
  });
  assert.equal(status, 400);
  assert.match(payload.error, /Canva Enterprise organisation/);
  assert.equal(payload.capability, "autofill");
});

test("a full run translates once per language, generates one design per market, and never writes to the source", async () => {
  await writeCanvaTokens({
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    capabilities: ["autofill", "brand_template"]
  });
  const calls = stubWorld();

  const saved = await callRoute("/api/canva/localizer?action=save_job", {
    method: "POST",
    body: {
      designId: "DA-source",
      designTitle: "Autumn launch",
      baseTitle: "autumn-launch",
      sourceLanguage: "Danish",
      fields: [
        { key: "headline", type: "text", sourceText: "Nye smykkeaesker", translate: true, budget: 20 },
        { key: "cta", type: "text", sourceText: "Shop nu", translate: true, budget: 12 },
        { key: "brand", type: "text", sourceText: "Westpack", translate: false, budget: 0 },
        { key: "hero", type: "image", sourceText: "", translate: false, budget: 0 }
      ],
      marketCodes: ["DE", "UK", "US"]
    }
  });
  assert.equal(saved.status, 200);
  const jobId = saved.payload.job.id;
  assert.equal(saved.payload.job.targets.length, 3);

  const translated = await callRoute("/api/canva/localizer?action=translate", {
    method: "POST",
    body: { jobId }
  });
  assert.equal(translated.status, 200);
  // UK and US are both English, so one translation covers both. Three markets, two calls.
  assert.equal(calls.translations.length, 2, "one translation per language, not per market");
  for (const target of translated.payload.job.targets) {
    assert.equal(target.state, "translated");
    assert.equal(target.translatedFields.headline, "headline-translated");
    assert.equal(target.translatedFields.brand, undefined, "an excluded field is never translated");
    assert.equal(target.translatedFields.hero, undefined, "an image field is never handed a string");
  }

  const generated = await callRoute("/api/canva/localizer?action=generate", {
    method: "POST",
    body: { jobId }
  });
  assert.equal(generated.status, 200);
  assert.equal(calls.autofills.length, 3, "one design per market, even where the language is shared");
  for (const call of calls.autofills) {
    assert.equal(call.type, "create_from_design");
    assert.equal(call.design_id, "DA-source", "the source design is only ever read from");
  }
  assert.deepEqual(
    calls.autofills.map((call) => call.title).sort(),
    ["autumn-launch_DE", "autumn-launch_UK", "autumn-launch_US"]
  );
  assert.equal(generated.payload.summary.generated, 3);
  assert.equal(generated.payload.summary.state, "complete");

  const exported = await callRoute("/api/canva/localizer?action=export", {
    method: "POST",
    body: { jobId, format: "png", width: 1200 }
  });
  assert.equal(exported.status, 200);
  assert.equal(calls.exports.length, 3);
  assert.equal(exported.payload.summary.exported, 3);
  assert.match(exported.payload.job.targets[0].exportUrls[0], /^https:\/\/export\.test\//);
});

test("one language failing leaves the rest of the batch alone and is retryable on its own", async () => {
  await writeCanvaTokens({
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    capabilities: ["autofill"]
  });
  let calls = stubWorld({ failTitles: ["winter_PL"] });

  const saved = await callRoute("/api/canva/localizer?action=save_job", {
    method: "POST",
    body: {
      designId: "DA-source-2",
      designTitle: "Winter",
      baseTitle: "winter",
      fields: [{ key: "headline", type: "text", sourceText: "Nye kasser", translate: true, budget: 14 }],
      marketCodes: ["DE", "PL"]
    }
  });
  const jobId = saved.payload.job.id;

  await callRoute("/api/canva/localizer?action=translate", { method: "POST", body: { jobId } });
  const generated = await callRoute("/api/canva/localizer?action=generate", { method: "POST", body: { jobId } });

  const byMarket = Object.fromEntries(generated.payload.job.targets.map((target) => [target.marketCode, target]));
  assert.equal(byMarket.DE.state, "generated", "a working language is unaffected by a failing one");
  assert.equal(byMarket.PL.state, "failed");
  assert.match(byMarket.PL.error, /Canva Enterprise organisation/);
  assert.equal(generated.payload.summary.state, "partial", "a batch of many is never a single pass or fail");

  // The retry regenerates only the failure. Fifteen orphaned duplicates in Canva would be the
  // cost of getting this wrong.
  calls = stubWorld();
  const retried = await callRoute("/api/canva/localizer?action=generate", {
    method: "POST",
    body: { jobId, marketCodes: ["PL"] }
  });
  assert.equal(calls.autofills.length, 1);
  assert.equal(calls.autofills[0].title, "winter_PL");
  assert.equal(retried.payload.summary.generated, 2);
  assert.equal(retried.payload.summary.state, "complete");
});

test("an empty translation is a failure, not a target quietly marked done", async () => {
  await writeCanvaTokens({
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    capabilities: ["autofill"]
  });
  // The model answers with no fields at all. Recording that as "translated" would send the
  // source language into Canva under a German name and look like a success.
  global.fetch = async (url) => (String(url).includes("api.openai.com")
    ? jsonResponse(200, { model: "test", output: [{ content: [{ text: JSON.stringify({ fields: [] }) }] }] })
    : (() => { throw new Error("must not reach Canva"); })());

  const saved = await callRoute("/api/canva/localizer?action=save_job", {
    method: "POST",
    body: {
      designId: "DA-source-4",
      baseTitle: "empty",
      fields: [{ key: "headline", type: "text", sourceText: "Hej", translate: true, budget: 8 }],
      marketCodes: ["DE"]
    }
  });
  const translated = await callRoute("/api/canva/localizer?action=translate", {
    method: "POST",
    body: { jobId: saved.payload.job.id }
  });

  const target = translated.payload.job.targets[0];
  assert.equal(target.state, "pending", "nothing usable came back, so nothing is claimed");
  assert.ok(target.error, "and the reason is recorded against the language");
  assert.equal(translated.payload.summary.translated, 0);
});

test("a second generate call does nothing, so a double click cannot duplicate eighteen designs", async () => {
  await writeCanvaTokens({
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    capabilities: ["autofill"]
  });
  stubWorld();

  const saved = await callRoute("/api/canva/localizer?action=save_job", {
    method: "POST",
    body: {
      designId: "DA-source-3",
      baseTitle: "spring",
      fields: [{ key: "headline", type: "text", sourceText: "Hej", translate: true, budget: 8 }],
      marketCodes: ["DE"]
    }
  });
  const jobId = saved.payload.job.id;
  await callRoute("/api/canva/localizer?action=translate", { method: "POST", body: { jobId } });
  await callRoute("/api/canva/localizer?action=generate", { method: "POST", body: { jobId } });

  const calls = stubWorld();
  const again = await callRoute("/api/canva/localizer?action=generate", { method: "POST", body: { jobId } });
  assert.equal(calls.autofills.length, 0);
  assert.equal(again.payload.processed, 0);
  assert.match(again.payload.note, /Nothing is waiting/);
});
