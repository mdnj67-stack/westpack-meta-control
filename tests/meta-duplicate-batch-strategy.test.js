const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function makeReq(bodyObj) {
  const req = new EventEmitter();
  req.method = "POST";
  req.headers = {};
  process.nextTick(() => {
    req.emit("data", JSON.stringify(bodyObj));
    req.emit("end");
  });
  return req;
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(payload) {
      this.body = payload;
    }
  };
}

const STRATEGY_FIXTURE = {
  productCategory: "Jewellery boxes",
  buyerType: "Independent retailer",
  jobToBeDone: "Lift perceived value at checkout",
  dominantAngle: "Premium presentation",
  supportPoints: ["Low MOQ branding", "Fast delivery"],
  allowedUsps: ["Premium presentation"],
  blockedClaims: ["Guaranteed sales lift", "Certified sustainable"],
  ctaDirection: "Learn more",
  variantHypotheses: ["Sharper hook", "Value-led framing", "CTA-led framing"]
};

function buildPreviewFixture(language) {
  return {
    primaryText: `Preview text for ${language}`,
    headline: `Headline ${language}`,
    description: `Description ${language}`,
    rationale: "Because it works.",
    adFormat: "Single image",
    translatedAttachments: [],
    variants: [
      { title: "Variant 1", body: "Body 1", headline: "Head 1", angle: "Angle 1" },
      { title: "Variant 2", body: "Body 2", headline: "Head 2", angle: "Angle 2" },
      { title: "Variant 3", body: "Body 3", headline: "Head 3", angle: "Angle 3" }
    ]
  };
}

test("duplicate batch reuses a precomputed strategy instead of recalling OpenAI strategy or Meta per target", async () => {
  const previousCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "westpack-config-test-"));
  const previousEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    AUTH_PASSWORD: process.env.AUTH_PASSWORD
  };
  const originalFetch = global.fetch;
  const handlerPath = require.resolve("../api/openai/generate-ad-copy");

  process.chdir(tempDir);
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.AUTH_PASSWORD;

  const calls = { openAiStrategy: 0, openAiPreview: 0, meta: 0 };

  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith("https://graph.facebook.com")) {
      calls.meta += 1;
      throw new Error(`Unexpected Meta Graph API call to ${target}`);
    }
    if (target.startsWith("https://api.openai.com/v1/responses")) {
      const requestBody = JSON.parse(String(options.body || "{}"));
      const schemaName = requestBody?.text?.format?.name;
      if (schemaName === "westpack_ad_strategy") {
        calls.openAiStrategy += 1;
        return {
          ok: true,
          async json() {
            return { model: "gpt-4.1-test", output_text: JSON.stringify(STRATEGY_FIXTURE) };
          }
        };
      }
      if (schemaName === "westpack_ad_preview") {
        calls.openAiPreview += 1;
        const userText = requestBody?.input?.[1]?.content?.[0]?.text || "";
        const requestedLanguage = userText.match(/Target language: (\w+)/)?.[1] || "unknown";
        return {
          ok: true,
          async json() {
            return { model: "gpt-4.1-test", output_text: JSON.stringify(buildPreviewFixture(requestedLanguage)) };
          }
        };
      }
      throw new Error(`Unexpected OpenAI schema requested: ${schemaName}`);
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    delete require.cache[handlerPath];
    const handler = require(handlerPath);

    const baseInput = {
      mode: "duplicate",
      sourceAd: { id: "", name: "Source ad", primary: "p", headline: "h", description: "d" },
      targetCampaign: "Campaign",
      targetCampaignId: "1",
      targetAdSet: "Ad set",
      targetAdSetId: "2",
      adFormat: "Single image",
      destinationUrl: "https://www.westpack.com/",
      adaptationGoal: "Translate"
    };

    const firstRes = makeRes();
    await handler(makeReq({ ...baseInput, targetLanguage: "Danish" }), firstRes);
    const firstPayload = JSON.parse(firstRes.body);

    assert.equal(calls.openAiStrategy, 1, "first target in a batch must compute the strategy once");
    assert.equal(calls.openAiPreview, 1);
    assert.ok(firstPayload.preview.strategy, "the response must expose the detected strategy so the client can reuse it");
    assert.equal(firstPayload.preview.strategy.dominantAngle, STRATEGY_FIXTURE.dominantAngle);

    const secondRes = makeRes();
    await handler(makeReq({
      ...baseInput,
      targetLanguage: "German",
      precomputedStrategy: firstPayload.preview.strategy,
      precomputedSourceCreativeSummary: firstPayload.sourceCreativeSummary || null
    }), secondRes);
    const secondPayload = JSON.parse(secondRes.body);

    assert.equal(calls.openAiStrategy, 1, "a later batch target with a precomputed strategy must not trigger a second strategy call");
    assert.equal(calls.openAiPreview, 2);
    assert.equal(calls.meta, 0, "duplicate batch generation must never call the Meta Graph API directly");
    assert.equal(secondPayload.preview.headline, "Headline German");
  } finally {
    global.fetch = originalFetch;
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[handlerPath];
  }
});
