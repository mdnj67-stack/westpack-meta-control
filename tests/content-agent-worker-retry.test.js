const test = require("node:test");
const assert = require("node:assert/strict");
const { requestStructuredOutput } = require("../server/campaign/content-agent-worker");

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
