const test = require("node:test");
const assert = require("node:assert/strict");
const { processAgentJob } = require("../server/campaign/content-agent-worker");
const { createInitialAgentState } = require("../server/campaign/content-agent");

const baseConfig = {
  openAiApiKey: "test-key",
  openAiModel: "gpt-5.4",
  contentAgentModel: "gpt-5.4",
  contentQualityModel: "gpt-5.4",
  asanaAccessToken: "test-asana-token"
};

function jsonResponse(bodyObj, status = 200) {
  const text = JSON.stringify(bodyObj);
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return text; },
    async json() { return bodyObj; },
    headers: { get: () => null },
    body: null
  };
}

// Same critical-failure / prior-revision scenario as
// "revision routing does not spend every repair on one repeatedly failing channel"
// in tests/creative-production.test.js: without priorRevisionScopes, the worse-scoring
// critical channel ("email") would be picked again even though it has already absorbed
// two revisions, while "blog" (also critical, untouched) is starved.
const previousReview = {
  verdict: "REVISE",
  overallScore: 70,
  criticalFailures: ["The compiled email misses its contour and the blog contains internal QA language."],
  dimensions: [
    { key: "email_quality", score: 70 },
    { key: "meta_quality", score: 86 },
    { key: "blog_quality", score: 77 }
  ],
  revisionBrief: { email: ["Fix contour."], meta: [], blog: ["Remove QA language."] }
};

function buildJob(checkpointOverrides = {}) {
  return {
    id: "job-revision-resume-1",
    state: "queued",
    priority: 10,
    source: "manual",
    campaignTaskGid: "1111111111",
    campaignTaskName: "Test campaign",
    contentTaskGid: "1111111111",
    contentTaskName: "Test campaign",
    direction: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: "",
    attempts: 1,
    progress: 80,
    statusMessage: "Resuming.",
    error: "",
    output: null,
    resumeStage: "revision",
    checkpoint: {
      assembled: { campaignObject: { linkedTasks: {} } },
      input: { assets: [], objective: "Sell the autumn range.", audience: "Retail buyers.", offer: "10% off." },
      plan: { campaign: { idea: "Autumn range" }, sourceAudit: {} },
      artifactPack: {
        input: { assets: [] },
        plan: { campaign: { idea: "Autumn range" } },
        artifacts: {
          email: null,
          meta: { headline: "Autumn is here", primaryText: "Shop now." },
          blog: { title: "Old blog", excerpt: "Old.", bodyHtml: "<p>Old copy with internal QA language.</p>" }
        },
        productionNotes: [],
        memoryReferences: [],
        model: "seed"
      },
      deterministicAudit: null,
      resolvedEmailImageUrls: [],
      artifactMemoryReferences: [],
      qualityIterations: [
        { iteration: 1, candidateVersion: 1, review: previousReview, gate: { score: 70, passed: false } }
      ],
      revisionCount: 2,
      bestArtifactPack: null,
      bestQualityReview: null,
      bestScore: 70,
      creativeDirections: null,
      conceptSelection: null,
      channelDrafts: {},
      productionNotes: [],
      // The channel already hammered twice by prior revisions.
      revisionScopes: ["email", "email"],
      ...checkpointOverrides
    }
  };
}

function buildFetchMock(openAiCalls) {
  return async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://app.asana.com/")) {
      if (/\/tasks\/\d+\/(subtasks|attachments)(?:\?|$)/.test(urlStr)) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: { gid: "1111111111", name: "Test campaign", notes: "", custom_fields: [] } });
    }
    if (urlStr.startsWith("https://api.openai.com/")) {
      const body = JSON.parse(options.body);
      openAiCalls.push(body);
      return jsonResponse({
        output_text: JSON.stringify({
          blog: { title: "Repaired blog", excerpt: "Fixed.", bodyHtml: "<p>Repaired copy.</p>" },
          productionNotes: ["Removed internal QA language."]
        }),
        model: "gpt-5.4"
      });
    }
    throw new Error(`Unexpected fetch call in test: ${urlStr}`);
  };
}

test("resuming a checkpointed revision still routes around an already-hammered channel", async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    VERCEL: process.env.VERCEL,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN
  };
  // Force in-memory (volatile) agent-store persistence so this test never touches
  // data/content-agent-state.json or a real Redis instance.
  process.env.VERCEL = "1";
  delete process.env.KV_REST_API_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.QSTASH_TOKEN;

  const openAiCalls = [];
  global.fetch = buildFetchMock(openAiCalls);

  try {
    const job = buildJob();
    const state = { ...createInitialAgentState(), jobs: [job] };

    const result = await processAgentJob(baseConfig, state, job);
    const resultJob = result.state.jobs.find((candidate) => candidate.id === job.id);

    assert.equal(openAiCalls.length, 1, "expected exactly one channel-revision call to the model");
    assert.equal(openAiCalls[0].text.format.name, "westpack_blog_surgical_revision_3");

    // The already-hammered "email" channel must not be the one revised again.
    assert.doesNotMatch(openAiCalls[0].text.format.name, /^westpack_email_surgical_revision_/);

    assert.notEqual(resultJob.state, "failed", `job unexpectedly failed: ${resultJob.error}`);
    assert.deepEqual(resultJob.checkpoint.revisionScopes, ["email", "email", "blog"]);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("regression guard: without the fix, the same scenario would re-pick the hammered channel", () => {
  // This does not exercise the worker; it documents, alongside the worker-level test above,
  // that the bug this suite guards against is real: calling selectRevisionChannel with no
  // history (the pre-fix call site) re-selects "email" even though it was already revised
  // twice, instead of routing to the untouched critical "blog" channel.
  const { selectRevisionChannel } = require("../server/campaign/creative-production");
  assert.equal(selectRevisionChannel(previousReview), "email");
  assert.equal(selectRevisionChannel(previousReview, ["email", "email"]), "blog");
});
