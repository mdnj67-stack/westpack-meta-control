const test = require("node:test");
const assert = require("node:assert/strict");

// ?breakdown=1 on the campaign overview route: one market's opens or clicks grouped by a Klaviyo
// dimension (device type, client, URL), read against a fake Klaviyo.
const originalEnv = {
  VERCEL: process.env.VERCEL,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  KLAVIYO_MARKETS_JSON: process.env.KLAVIYO_MARKETS_JSON
};
process.env.VERCEL = "1";
process.env.AUTH_PASSWORD = "klaviyo-breakdown-test-password";
process.env.AUTH_SESSION_SECRET = "klaviyo-breakdown-test-secret";
process.env.KLAVIYO_MARKETS_JSON = JSON.stringify([{ country: "DK", privateKey: "pk_test_dk" }]);

const { getConfig } = require("../server/lib/config");
const { createSessionToken, isAuthEnabled } = require("../server/lib/auth");
const { buildBreakdownRequestBody, resolveBreakdownQuery, summarizeBreakdown } = require("../server/klaviyo/engagement-breakdown");
const handler = require("../api/klaviyo/campaign-overview");

const config = getConfig();
const sessionCookie = isAuthEnabled(config) ? `westpack_session=${encodeURIComponent(createSessionToken(config))}` : "";
const originalFetch = global.fetch;

function callRoute(query) {
  return new Promise((resolve) => {
    const req = { method: "GET", url: "/api/klaviyo/campaign-overview", query, headers: { host: "localhost", ...(sessionCookie ? { cookie: sessionCookie } : {}) } };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(payload) { resolve({ status: this.statusCode, payload: payload ? JSON.parse(payload) : {} }); }
    };
    handler(req, res);
  });
}

function reply(payload, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => payload, text: async () => JSON.stringify(payload) };
}

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("only the two email metrics and the known dimensions are accepted", () => {
  assert.deepEqual(resolveBreakdownQuery({}), { metric: "Clicked Email", by: ["Client Type"], days: 90 });
  assert.deepEqual(resolveBreakdownQuery({ by: "Client Type, Bot Click" }).by, ["Client Type", "Bot Click"]);
  assert.match(resolveBreakdownQuery({ by: "Client Type,Bot Click,URL" }).error, /one or two/);
  assert.equal(resolveBreakdownQuery({ days: "9999" }).days, 365);
  assert.match(resolveBreakdownQuery({ metric: "Placed Order" }).error, /metric must be one of/);
  assert.match(resolveBreakdownQuery({ by: "Email" }).error, /by must be one or two of/);
});

test("the request asks for one dimension over the window ending now", () => {
  const body = buildBreakdownRequestBody({ metricId: "M1", by: ["Client Type"], days: 30, now: new Date("2026-10-26T12:00:00Z") });
  assert.equal(body.data.type, "metric-aggregate");
  assert.deepEqual(body.data.attributes.by, ["Client Type"]);
  assert.deepEqual(body.data.attributes.filter, ["greater-or-equal(datetime,2026-09-26T12:00:00)", "less-than(datetime,2026-10-26T12:00:00)"]);
});

test("monthly counts are summed per value, sorted, and shares add to one", () => {
  const summary = summarizeBreakdown({ data: { attributes: { data: [
    { dimensions: ["desktop"], measurements: { count: [10, 20] } },
    { dimensions: ["mobile"], measurements: { count: [40, 25] } },
    { dimensions: [""], measurements: { count: [5, 0] } },
    { dimensions: ["tablet"], measurements: { count: [0, 0] } }
  ] } } });
  const paired = summarizeBreakdown({ data: { attributes: { data: [{ dimensions: ["Browser", "1.0"], measurements: { count: [2] } }] } } });
  const people = summarizeBreakdown({ data: { attributes: { data: [{ dimensions: ["https://x/?utm_content=gp_board_monaco", "0.0"], measurements: { count: [5], unique: [3] } }] } } });
  assert.equal(people.rows[0].unique, 3, "unique people ride along with the event count");
  assert.equal(paired.rows[0].value, "Browser | 1.0", "two dimensions are reported together");
  assert.equal(summary.total, 100);
  assert.deepEqual(summary.rows.map((row) => [row.value, row.count]), [["mobile", 65], ["desktop", 30], ["(not recorded)", 5]]);
  assert.equal(summary.rows.reduce((sum, row) => sum + row.share, 0), 1);
});

test("breakdown=1 reads the market's own Clicked Email metric and returns the grouped counts", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", auth: options.headers?.Authorization, body: options.body ? JSON.parse(options.body) : null });
    if (String(url).startsWith("https://a.klaviyo.com/api/metrics/")) {
      return reply({ data: [
        { id: "SHOPIFY", attributes: { name: "Clicked Email", integration: { key: "shopify" } } },
        { id: "CLICK", attributes: { name: "Clicked Email", integration: { key: "klaviyo" } } }
      ], links: {} });
    }
    return reply({ data: { attributes: { dates: [], data: [{ dimensions: ["mobile"], measurements: { count: [3] } }, { dimensions: ["desktop"], measurements: { count: [1] } }] } } });
  };
  const result = await callRoute({ breakdown: "1", country: "dk", by: "Client Type", days: "90" });
  assert.equal(result.status, 200);
  assert.equal(result.payload.country, "DK");
  assert.equal(result.payload.total, 4);
  assert.deepEqual(result.payload.rows.map((row) => row.value), ["mobile", "desktop"]);
  const aggregate = calls.find((call) => call.url === "https://a.klaviyo.com/api/metric-aggregates/");
  assert.equal(aggregate.method, "POST");
  assert.equal(aggregate.body.data.attributes.metric_id, "CLICK", "Klaviyo's own metric, not an integration's");
  assert.ok(calls.every((call) => call.auth === "Klaviyo-API-Key pk_test_dk"));
});

test("an unknown market or dimension is refused before Klaviyo is called", async () => {
  let called = false;
  global.fetch = async () => { called = true; return reply({}); };
  assert.equal((await callRoute({ breakdown: "1", country: "XX" })).status, 404);
  assert.equal((await callRoute({ breakdown: "1", country: "DK", by: "Email" })).status, 400);
  assert.equal(called, false);
});
