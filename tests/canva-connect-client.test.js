const test = require("node:test");
const assert = require("node:assert/strict");

// Volatile persistence, so the token store never touches data/canva-tokens.json or a real Redis.
const originalEnv = {
  VERCEL: process.env.VERCEL,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
};
process.env.VERCEL = "1";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  CanvaApiError,
  buildAuthorizeUrl,
  canvaRequest,
  createDesignFromDesign,
  exportDesign
} = require("../server/canva/connect-client");
const {
  clearCanvaTokens,
  getAccessToken,
  readCanvaTokens,
  writeCanvaTokens
} = require("../server/canva/token-store");

const originalFetch = global.fetch;

function jsonResponse(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key) => headers[String(key).toLowerCase()] || null },
    text: async () => JSON.stringify(payload)
  };
}

function stubFetch(handler) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(String(url), options, calls.length);
  };
  return calls;
}

test.afterEach(() => {
  global.fetch = originalFetch;
});

test.after(async () => {
  global.fetch = originalFetch;
  await clearCanvaTokens();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("the authorize URL is PKCE with SHA-256, which Canva requires", () => {
  const url = new URL(buildAuthorizeUrl({
    clientId: "OC-123",
    redirectUri: "https://example.test/api/canva/oauth",
    codeChallenge: "challenge-value",
    state: "state-value"
  }));

  assert.equal(url.origin + url.pathname, "https://www.canva.com/api/oauth/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), "challenge-value");
  assert.equal(url.searchParams.get("state"), "state-value");
  // Canva grants no implied scopes, so each one has to be asked for by name.
  const scopes = (url.searchParams.get("scope") || "").split(" ");
  assert.ok(scopes.includes("design:content:read"));
  assert.ok(scopes.includes("design:content:write"));
  assert.ok(scopes.includes("design:meta:read"));
  assert.ok(scopes.includes("profile:read"));
});

test("a rate limit is never retried, because retrying spends the next minute's allowance too", async () => {
  const calls = stubFetch(() => jsonResponse(429, { code: "too_many_requests", message: "Slow down." }, { "retry-after": "42" }));

  await assert.rejects(
    () => canvaRequest("/v1/designs", { accessToken: "token" }),
    (error) => {
      assert.ok(error instanceof CanvaApiError);
      assert.equal(error.isRateLimit, true);
      assert.equal(error.retryAfterSeconds, 42);
      return true;
    }
  );
  assert.equal(calls.length, 1, "one call, one failure - no retry storm against a shared account");
});

test("a gateway error is retried, and the retry's result is returned", async () => {
  const calls = stubFetch((url, options, callNumber) => (callNumber === 1
    ? jsonResponse(503, { message: "upstream" })
    : jsonResponse(200, { design: { id: "DA1" } })));

  const payload = await canvaRequest("/v1/designs/DA1", { accessToken: "token" });
  assert.equal(payload.design.id, "DA1");
  assert.equal(calls.length, 2);
});

test("a 403 on autofill is reported as the plan restriction it is, not as a generic failure", async () => {
  stubFetch(() => jsonResponse(403, { code: "autofill_feature_forbidden", message: "Feature not available." }));

  await assert.rejects(
    () => createDesignFromDesign("token", { designId: "DA1", title: "x_DE", data: {} }),
    (error) => {
      assert.equal(error.isPlanRestriction, true);
      return true;
    }
  );
});

test("create_from_design is used, so the source design is never the thing being written to", async () => {
  const calls = stubFetch(() => jsonResponse(200, { job: { id: "job1", status: "in_progress" } }));

  await createDesignFromDesign("token", {
    designId: "DA-source",
    title: "Autumn launch_DE",
    data: { headline: { type: "text", text: "Neue Schmuckboxen" } }
  });

  const body = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, "https://api.canva.com/rest/v1/autofills");
  assert.equal(body.type, "create_from_design");
  assert.equal(body.design_id, "DA-source");
  assert.equal(body.title, "Autumn launch_DE");
  // update_design would edit the original in place, which this feature must never do.
  assert.notEqual(body.type, "update_design");
});

test("an export job that is already finished is not polled", async () => {
  const calls = stubFetch(() => jsonResponse(200, {
    job: { id: "exp1", status: "success", urls: ["https://export-download.canva.com/a.png"] }
  }));

  const urls = await exportDesign("token", { designId: "DA1", format: "png", width: 1200 });
  assert.deepEqual(urls, ["https://export-download.canva.com/a.png"]);
  assert.equal(calls.length, 1);

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.format.type, "png");
  assert.equal(body.format.width, 1200);
});

test("a job that reports failed surfaces the failure instead of polling until the timeout", async () => {
  stubFetch((url, options, callNumber) => (callNumber === 1
    ? jsonResponse(200, { job: { id: "exp1", status: "in_progress" } })
    : jsonResponse(200, { job: { id: "exp1", status: "failed", error: { code: "export_failed", message: "Nope." } } })));

  await assert.rejects(
    () => exportDesign("token", { designId: "DA1", format: "jpg" }),
    /Nope\./
  );
});

test("a stored token that is still valid is used without a refresh round trip", async () => {
  await writeCanvaTokens({
    accessToken: "live-token",
    refreshToken: "refresh-1",
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  });
  const calls = stubFetch(() => jsonResponse(200, {}));

  const token = await getAccessToken({ clientId: "id", clientSecret: "secret" });
  assert.equal(token, "live-token");
  assert.equal(calls.length, 0);
});

test("an expiring token is refreshed and the rotated refresh token is persisted before use", async () => {
  await writeCanvaTokens({
    accessToken: "stale-token",
    refreshToken: "refresh-1",
    expiresAt: new Date(Date.now() + 5000).toISOString(),
    connectedAt: "2026-09-01T00:00:00.000Z"
  });
  stubFetch(() => jsonResponse(200, {
    access_token: "fresh-token",
    refresh_token: "refresh-2",
    expires_in: 14400,
    scope: "design:meta:read"
  }));

  const token = await getAccessToken({ clientId: "id", clientSecret: "secret" });
  assert.equal(token, "fresh-token");

  const stored = await readCanvaTokens();
  // Canva invalidates a refresh token the moment it is exchanged, so failing to persist the new
  // one disconnects the account permanently.
  assert.equal(stored.refreshToken, "refresh-2");
  assert.equal(stored.accessToken, "fresh-token");
  assert.equal(stored.connectedAt, "2026-09-01T00:00:00.000Z", "the original connection time survives a refresh");
});

test("a rejected refresh clears the dead connection instead of failing the same way forever", async () => {
  await writeCanvaTokens({
    accessToken: "stale-token",
    refreshToken: "revoked",
    expiresAt: new Date(Date.now() - 1000).toISOString()
  });
  stubFetch(() => jsonResponse(400, { error: "invalid_grant", error_description: "Refresh token is invalid." }));

  await assert.rejects(
    () => getAccessToken({ clientId: "id", clientSecret: "secret" }),
    /Reconnect the Canva account/
  );
  assert.equal(await readCanvaTokens(), null);
});

test("an unconnected store asks for a connection rather than throwing an internal error", async () => {
  await clearCanvaTokens();
  await assert.rejects(
    () => getAccessToken({ clientId: "id", clientSecret: "secret" }),
    /Canva is not connected/
  );
});
