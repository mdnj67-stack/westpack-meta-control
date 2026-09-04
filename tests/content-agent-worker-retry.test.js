const test = require("node:test");
const assert = require("node:assert/strict");
const { requestStructuredOutput, processAgentJob } = require("../server/campaign/content-agent-worker");
const { createInitialAgentState } = require("../server/campaign/content-agent");

const baseConfig = { openAiApiKey: "test-key", openAiModel: "gpt-5.4" };

function timeoutFetch(signal) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      reject(error);
    });
  });
}

function successResponse(model) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ output_text: JSON.stringify({ hello: "world" }), model });
    }
  };
}

test("retries once after a timeout and succeeds on the second attempt", async () => {
  const originalFetch = global.fetch;
  let callCount = 0;
  global.fetch = async (_url, options = {}) => {
    callCount += 1;
    if (callCount === 1) return timeoutFetch(options.signal);
    return successResponse("gpt-5.4");
  };

  try {
    const result = await requestStructuredOutput(baseConfig, {
      prompt: "do the thing",
      schemaName: "TestSchema",
      schema: { type: "object" },
      requestTimeoutMs: 30
    });
    assert.equal(callCount, 2);
    assert.deepEqual(result.parsed, { hello: "world" });
  } finally {
    global.fetch = originalFetch;
  }
});

test("gives up after one retry when both attempts time out", async () => {
  const originalFetch = global.fetch;
  let callCount = 0;
  global.fetch = async (_url, options = {}) => {
    callCount += 1;
    return timeoutFetch(options.signal);
  };

  try {
    await assert.rejects(
      requestStructuredOutput(baseConfig, {
        prompt: "do the thing",
        schemaName: "TestSchema",
        schema: { type: "object" },
        requestTimeoutMs: 30
      }),
      (error) => error.name === "AbortError"
    );
    assert.equal(callCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("does not retry a timeout when retryOnTimeout is false", async () => {
  const originalFetch = global.fetch;
  let callCount = 0;
  global.fetch = async (_url, options = {}) => {
    callCount += 1;
    return timeoutFetch(options.signal);
  };

  try {
    await assert.rejects(
      requestStructuredOutput(baseConfig, {
        prompt: "do the thing",
        schemaName: "TestSchema",
        schema: { type: "object" },
        requestTimeoutMs: 30,
        retryOnTimeout: false
      }),
      (error) => error.name === "AbortError"
    );
    assert.equal(callCount, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

// Guards the checkpoint/resume production loop in content-agent-worker.js: every
// requestStructuredOutput call between a checkpoint and the next one must fail fast
// (retryOnTimeout: false) so a timeout resolves within the platform's function-duration
// budget instead of doubling its own worst-case latency before checkpoint/resume can run.
// See CLAUDE.md's content-agent-worker.js notes and the task that added this test.

const productionConfig = {
  openAiApiKey: "test-key",
  openAiModel: "gpt-5.4",
  contentAgentModel: "gpt-5.4",
  contentQualityModel: "gpt-5.4",
  asanaAccessToken: "test-asana-token"
};

const baseCheckpoint = {
  assembled: { campaignObject: { linkedTasks: {} } },
  input: { assets: [], objective: "Sell the autumn range.", audience: "Retail buyers.", offer: "10% off." },
  plan: { campaign: { idea: "Autumn range" }, sourceAudit: {} },
  artifactPack: {
    input: { assets: [] },
    plan: { campaign: { idea: "Autumn range" } },
    artifacts: {
      email: { bodyHtml: "<html></html>" },
      meta: { headline: "Autumn is here", primaryText: "Shop now.", carouselConcepts: [] },
      blog: { title: "Blog", excerpt: "Blog.", bodyHtml: "<p>Blog copy.</p>" }
    },
    productionNotes: [],
    memoryReferences: [],
    model: "seed"
  },
  deterministicAudit: null,
  resolvedEmailImageUrls: [],
  artifactMemoryReferences: [],
  qualityIterations: [],
  revisionCount: 0,
  bestArtifactPack: null,
  bestQualityReview: null,
  bestScore: -1,
  creativeDirections: null,
  conceptSelection: null,
  channelDrafts: {},
  productionNotes: [],
  revisionScopes: []
};

function buildProductionJob(resumeStage, checkpointOverrides = {}) {
  return {
    id: `job-${resumeStage}`,
    state: "queued",
    priority: 10,
    source: "manual",
    campaignTaskGid: "2222222222",
    campaignTaskName: "Test campaign",
    contentTaskGid: "2222222222",
    contentTaskName: "Test campaign",
    direction: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: "",
    attempts: 1,
    progress: 50,
    statusMessage: "Resuming.",
    error: "",
    output: null,
    resumeStage,
    checkpoint: { ...baseCheckpoint, ...checkpointOverrides }
  };
}

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

function buildTimeoutFetchMock(openAiCallCount) {
  return async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://app.asana.com/")) {
      if (/\/tasks\/\d+\/(subtasks|attachments)(?:\?|$)/.test(urlStr)) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: { gid: "2222222222", name: "Test campaign", notes: "", custom_fields: [] } });
    }
    if (urlStr.startsWith("https://api.openai.com/")) {
      openAiCallCount.count += 1;
      // Simulate the abort a real request timeout would raise, without waiting out a real timer.
      const abortError = new Error("The operation was aborted.");
      abortError.name = "AbortError";
      throw abortError;
    }
    throw new Error(`Unexpected fetch call in test: ${urlStr}`);
  };
}

async function withVolatileAgentStore(callback) {
  const originalEnv = {
    VERCEL: process.env.VERCEL,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN
  };
  process.env.VERCEL = "1";
  delete process.env.KV_REST_API_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.QSTASH_TOKEN;
  try {
    await callback();
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const resumableTimeoutStages = [
  "creative_directions_challenge",
  "concept_selection",
  "concept_selection_challenge",
  "quality_review"
];

for (const resumeStage of resumableTimeoutStages) {
  test(`${resumeStage} makes only one OpenAI attempt on timeout (no internal retry)`, async () => {
    const originalFetch = global.fetch;
    const openAiCallCount = { count: 0 };
    global.fetch = buildTimeoutFetchMock(openAiCallCount);

    await withVolatileAgentStore(async () => {
      try {
        const job = buildProductionJob(resumeStage);
        const state = { ...createInitialAgentState(), jobs: [job] };

        const result = await processAgentJob(productionConfig, state, job);
        const resultJob = result.state.jobs.find((candidate) => candidate.id === job.id);

        assert.equal(openAiCallCount.count, 1, `expected exactly one OpenAI attempt for resumeStage "${resumeStage}"`);
        // The worker's outer AbortError handler should checkpoint-resume, not hard-fail or hang.
        assert.equal(resultJob.state, "queued", `expected the job to be re-queued for checkpoint resume, got "${resultJob.state}"`);
        assert.equal(resultJob.publishCapability, false);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
}

// Regression guard: timeoutRetryCount is a lifetime AbortError budget (capped at 2 in the
// catch block above) but was never reset on a successful stage checkpoint, turning it into a
// whole-job-lifetime budget instead of one that forgives a job that is still making real,
// verified progress. checkpointAndContinue's persistTransition patch now includes
// `timeoutRetryCount: 0` specifically to fix this.
const revisionPreviousReview = {
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

function buildRevisionJobWithTimeoutRetryCount(timeoutRetryCount) {
  return {
    id: "job-timeout-reset-1",
    state: "queued",
    priority: 10,
    source: "manual",
    campaignTaskGid: "2222222222",
    campaignTaskName: "Test campaign",
    contentTaskGid: "2222222222",
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
    timeoutRetryCount,
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
        { iteration: 1, candidateVersion: 1, review: revisionPreviousReview, gate: { score: 70, passed: false } }
      ],
      revisionCount: 2,
      bestArtifactPack: null,
      bestQualityReview: null,
      bestScore: 70,
      creativeDirections: null,
      conceptSelection: null,
      channelDrafts: {},
      productionNotes: [],
      revisionScopes: ["email", "email"]
    }
  };
}

function buildRevisionSuccessFetchMock() {
  return async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://app.asana.com/")) {
      if (/\/tasks\/\d+\/(subtasks|attachments)(?:\?|$)/.test(urlStr)) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: { gid: "2222222222", name: "Test campaign", notes: "", custom_fields: [] } });
    }
    if (urlStr.startsWith("https://api.openai.com/")) {
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

test("timeoutRetryCount resets on a successful stage checkpoint instead of capping the job's lifetime", async () => {
  const originalFetch = global.fetch;
  try {
    await withVolatileAgentStore(async () => {
      // Step 1: the job already carries two prior (now-resolved) AbortErrors from earlier in
      // the run -- i.e. it is already sitting at the 2-strike cap in the catch block above.
      const revisionJob = buildRevisionJobWithTimeoutRetryCount(2);
      const revisionState = { ...createInitialAgentState(), jobs: [revisionJob] };
      global.fetch = buildRevisionSuccessFetchMock();

      const afterRevision = await processAgentJob(productionConfig, revisionState, revisionJob);
      const jobAfterRevision = afterRevision.state.jobs.find((candidate) => candidate.id === revisionJob.id);

      assert.equal(jobAfterRevision.state, "queued", `expected the successful revision to checkpoint and continue, got "${jobAfterRevision.state}" (error: ${jobAfterRevision.error})`);
      assert.equal(
        jobAfterRevision.timeoutRetryCount,
        0,
        "a genuinely successful stage checkpoint must reset the lifetime AbortError counter"
      );

      // Step 2: the very next stage (quality_review) now times out. Without the reset in
      // step 1, timeoutRetryCount would still be 2 here, and `timeoutRetryCount < 2` would be
      // false -- force-failing (or dead-lettering) a job that just made real, verified
      // progress, instead of treating this as a fresh, first-time timeout.
      const openAiCallCount = { count: 0 };
      global.fetch = buildTimeoutFetchMock(openAiCallCount);

      const afterTimeout = await processAgentJob(productionConfig, afterRevision.state, jobAfterRevision);
      const jobAfterTimeout = afterTimeout.state.jobs.find((candidate) => candidate.id === revisionJob.id);

      assert.equal(
        jobAfterTimeout.state,
        "queued",
        `expected the post-progress timeout to be checkpoint-resumed, got "${jobAfterTimeout.state}" (error: ${jobAfterTimeout.error})`
      );
      assert.ok(jobAfterTimeout.checkpoint, "expected a fresh checkpoint for resumption");
      assert.equal(jobAfterTimeout.timeoutRetryCount, 1);
    });
  } finally {
    global.fetch = originalFetch;
  }
});
