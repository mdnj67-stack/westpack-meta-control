// The office TV's feed: its scenes, who may read it, its caches and the dashboard hook that feeds it.
// The TV itself is its own project (westpack-tv).
// Fixtures only - nothing here reaches Meta, Klaviyo or Blob.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildTvScenes, aggregateEmailMonth, formatDayRange, DEFAULT_SCENE_IDS } = require("../server/tv/kpi-scenes");
const { resolveFeedAccess, MIN_FEED_TOKEN_LENGTH } = require("../server/tv/feed-auth");
const { createSessionToken, isAuthenticated } = require("../server/lib/auth");
const { buildTvMetaAcquisitionDoc, recordTvMetaAcquisition } = require("../server/tv/meta-acquisition");
const { getTvKpis, __resetMemory } = require("../server/tv/kpi-sources");

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);
const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

// 10 November 2026, 10:00 in Copenhagen. Meta's day (Los Angeles) is the 10th too, so the month to
// date covers 1-9 November.
const NOW = new Date("2026-11-10T09:00:00Z");

function metaTrend(overrides = {}) {
  return {
    available: true,
    timeZone: "America/Los_Angeles",
    comparable: true,
    clamped: false,
    current: { since: "2026-11-01", until: "2026-11-09", days: 9, newCustomers: 112, spend: 90944 },
    previous: { since: "2026-10-01", until: "2026-10-09", days: 9, newCustomers: 100, spend: 90500 },
    percentChange: 12,
    direction: "up",
    ...overrides
  };
}

function metaInput(trendOverrides = {}, docOverrides = {}) {
  return { doc: { writtenAt: "2026-11-10T08:16:00Z", currency: "DKK", trend: metaTrend(trendOverrides), ...docOverrides } };
}

function emailAggregate(overrides = {}, monthKey = "2026-11") {
  const markets = {};
  for (const code of ["DK", "DE", "UK"]) {
    markets[code] = { syncedAt: "2026-11-10T04:52:00Z", lastError: "", campaigns: 3, messages: 3, received: 41200, clicked: 412 };
  }
  return { monthKey, historySyncedAt: "2026-11-10T04:52:00Z", markets: { ...markets, ...overrides } };
}

function fullInputs(overrides = {}) {
  return {
    meta: metaInput(),
    subscribers: { complete: true, total: 25808, marketCount: 18, fetchedAt: "2026-11-10T07:30:00Z" },
    subscriberDaily: { days: {} },
    email: { aggregate: emailAggregate() },
    ...overrides
  };
}

const sceneById = (result, id) => result.scenes.find((scene) => scene.id === id);
const skippedIds = (result) => result.skipped.map((item) => item.id);

// ---- Scenes ------------------------------------------------------------------------------------

test("every scene renders with Danish formatting, in order, new customers first", () => {
  const result = buildTvScenes(fullInputs({
    email: { aggregate: emailAggregate({ DK: { syncedAt: "2026-11-10T04:52:00Z", lastError: "", campaigns: 4, messages: 5, received: 1234567, clicked: 2345 } }) }
  }), NOW);
  assert.deepEqual(result.scenes.map((scene) => scene.id), [
    "meta_new_customers_mtd",
    "meta_cost_per_new_customer",
    "newsletter_subscribers",
    "newsletter_delivered_mtd",
    "newsletter_clicks_mtd"
  ]);
  for (const scene of result.scenes) {
    for (const key of ["id", "eyebrow", "valueText", "suffix", "line", "source", "asOf"]) assert.ok(key in scene, `${scene.id} has ${key}`);
    assert.ok(scene.eyebrow.split(/\s+/).length <= 4, `${scene.id}: eyebrow is at most four words`);
    assert.ok(scene.line.length <= 60, `${scene.id}: line "${scene.line}" is ${scene.line.length} characters`);
  }

  const customers = sceneById(result, "meta_new_customers_mtd");
  assert.equal(customers.eyebrow, "Nye kunder fra Meta");
  assert.equal(customers.valueText, "112");
  assert.equal(customers.line, `1.–9. november · 12${NBSP}% flere end samme dage i oktober`);

  const cost = sceneById(result, "meta_cost_per_new_customer");
  assert.equal(cost.valueText, "812");
  assert.equal(cost.suffix, "kr.");
  assert.equal(cost.line, `1.–9. november · samme dage i oktober: 905${NBSP}kr.`);

  const subscribers = sceneById(result, "newsletter_subscribers");
  assert.equal(subscribers.valueText, "25.808");
  assert.equal(subscribers.line, "på tværs af 18 markeder");

  const delivered = sceneById(result, "newsletter_delivered_mtd");
  assert.equal(delivered.valueText, "1.316.967", "thousands are separated by full stops");
  assert.equal(delivered.value, 1316967);
  assert.equal(delivered.line, "kampagnemails sendt i november · opgjort i dag");
  assert.equal(delivered.asOf, "2026-11-10T04:52:00Z");

  const clicks = sceneById(result, "newsletter_clicks_mtd");
  assert.equal(clicks.valueText, "3.169");
  assert.match(clicks.line, /pr\. mail/);
  assert.doesNotMatch(`${clicks.eyebrow} ${clicks.line}`, /personer|mennesker|modtagere/i, "clicks are never called people");
  assert.equal(result.sources.meta.status, "ok");
  assert.equal(result.sources.expansion.status, "off");
});

test("the comparison says more, fewer or level - and nothing without an honest baseline", () => {
  const fewer = buildTvScenes(fullInputs({ meta: metaInput({ current: { ...metaTrend().current, newCustomers: 88 }, percentChange: -12 }) }), NOW);
  assert.equal(sceneById(fewer, "meta_new_customers_mtd").line, `1.–9. november · 12${NBSP}% færre end samme dage i oktober`);

  const level = buildTvScenes(fullInputs({ meta: metaInput({ current: { ...metaTrend().current, newCustomers: 100.3 }, percentChange: 0.3 }) }), NOW);
  assert.equal(sceneById(level, "meta_new_customers_mtd").line, "1.–9. november · på niveau med samme dage i oktober");
  assert.equal(sceneById(level, "meta_new_customers_mtd").valueText, "100");

  const same = buildTvScenes(fullInputs({ meta: metaInput({ current: { ...metaTrend().current, newCustomers: 100 }, percentChange: 0 }) }), NOW);
  assert.equal(sceneById(same, "meta_new_customers_mtd").line, "1.–9. november · lige så mange som samme dage i oktober");

  const noBaseline = buildTvScenes(fullInputs({ meta: metaInput({ previous: { ...metaTrend().previous, newCustomers: 0, spend: 0 }, percentChange: null, direction: "new" }) }), NOW);
  assert.equal(sceneById(noBaseline, "meta_new_customers_mtd").line, "1.–9. november");
  assert.equal(sceneById(noBaseline, "meta_cost_per_new_customer").line, "1.–9. november", "no previous cost from zero customers");

  const notComparable = buildTvScenes(fullInputs({ meta: metaInput({ comparable: false }) }), NOW);
  assert.equal(sceneById(notComparable, "meta_new_customers_mtd").line, "1.–9. november");

  // 31 March has no 31 February: the previous window is named by its own dates, not "samme dage".
  const clamped = buildTvScenes(fullInputs({
    meta: metaInput({
      clamped: true,
      current: { since: "2027-03-01", until: "2027-03-30", days: 30, newCustomers: 330, spend: 264000 },
      previous: { since: "2027-02-01", until: "2027-02-28", days: 28, newCustomers: 300, spend: 255000 },
      percentChange: 10
    }, { writtenAt: "2027-03-31T08:16:00Z" }),
    subscribers: null,
    email: { error: "not under test" }
  }), new Date("2027-03-31T09:00:00Z"));
  assert.equal(sceneById(clamped, "meta_new_customers_mtd").line, `1.–30. marts · 10${NBSP}% flere end 1.–28. februar`);
  assert.equal(sceneById(clamped, "meta_cost_per_new_customer").line, `1.–30. marts · 1.–28. februar: 850${NBSP}kr.`);
  assert.equal(sceneById(clamped, "meta_cost_per_new_customer").valueText, "800");
});

test("Meta scenes are left out when the figure is unavailable, stale, from last month or has no finished day", () => {
  const cases = [
    ["unavailable", metaInput({ available: false })],
    ["first of the month", metaInput({ comparable: false, current: { since: "2026-11-01", until: "2026-11-01", days: 0, newCustomers: 3, spend: 4000 } })],
    ["stale", metaInput({}, { writtenAt: "2026-11-08T08:00:00Z" })],
    ["last month", metaInput({ current: { since: "2026-10-01", until: "2026-10-30", days: 30, newCustomers: 300, spend: 250000 } })],
    ["never written", { doc: null }],
    ["read failed", { error: "Blob read failed (503)." }],
    ["no count", metaInput({ current: { since: "2026-11-01", until: "2026-11-09", days: 9, newCustomers: null, spend: 9000 } })],
    // Nine days of nothing at all on an account that spends every day reads as a window that was
    // never read, not as a month with no customers.
    ["no spend and no customers", metaInput({ current: { since: "2026-11-01", until: "2026-11-09", days: 9, newCustomers: 0, spend: 0 } })]
  ];
  for (const [label, meta] of cases) {
    const result = buildTvScenes(fullInputs({ meta }), NOW);
    assert.equal(sceneById(result, "meta_new_customers_mtd"), undefined, label);
    assert.equal(sceneById(result, "meta_cost_per_new_customer"), undefined, label);
    assert.ok(skippedIds(result).includes("meta_new_customers_mtd"), `${label}: reported as skipped`);
    assert.notEqual(result.sources.meta.status, "ok", label);
    assert.ok(sceneById(result, "newsletter_subscribers"), `${label}: other sources still render`);
  }
  const stale = buildTvScenes(fullInputs({ meta: metaInput({}, { writtenAt: "2026-11-08T08:00:00Z" }) }), NOW);
  assert.equal(stale.sources.meta.status, "stale");
});

test("cost per new customer is left out when there are no new customers to divide by", () => {
  const result = buildTvScenes(fullInputs({ meta: metaInput({ current: { ...metaTrend().current, newCustomers: 0 } }) }), NOW);
  assert.equal(sceneById(result, "meta_cost_per_new_customer"), undefined);
  assert.ok(skippedIds(result).includes("meta_cost_per_new_customer"));
  assert.equal(sceneById(result, "meta_new_customers_mtd").valueText, "0", "a measured zero over spend is still a figure");
});

test("a currency other than DKK is named rather than printed as kroner", () => {
  const result = buildTvScenes(fullInputs({ meta: metaInput({}, { currency: "EUR" }) }), NOW);
  assert.equal(sceneById(result, "meta_cost_per_new_customer").suffix, "EUR");
});

test("the subscriber level shows only a complete, recent count, with the change since earlier this month", () => {
  const withBaseline = buildTvScenes(fullInputs({
    subscriberDaily: { days: { "2026-11-01": { total: 25600, marketCount: 18 }, "2026-11-02": { total: 25650, marketCount: 18 }, "2026-11-10": { total: 25808, marketCount: 18 } } }
  }), NOW);
  assert.equal(sceneById(withBaseline, "newsletter_subscribers").line, "18 markeder · +208 siden 1. november");

  const fell = buildTvScenes(fullInputs({ subscriberDaily: { days: { "2026-11-03": { total: 25820, marketCount: 18 } } } }), NOW);
  assert.equal(sceneById(fell, "newsletter_subscribers").line, `18 markeder · ${MINUS}12 siden 3. november`);

  const unchanged = buildTvScenes(fullInputs({ subscriberDaily: { days: { "2026-11-01": { total: 25808, marketCount: 18 } } } }), NOW);
  assert.equal(sceneById(unchanged, "newsletter_subscribers").line, "18 markeder · uændret siden 1. november");

  const onlyToday = buildTvScenes(fullInputs({ subscriberDaily: { days: { "2026-11-10": { total: 25700, marketCount: 18 } } } }), NOW);
  assert.equal(sceneById(onlyToday, "newsletter_subscribers").line, "på tværs af 18 markeder");

  const lastMonthOnly = buildTvScenes(fullInputs({ subscriberDaily: { days: { "2026-10-01": { total: 25000, marketCount: 18 } } } }), NOW);
  assert.equal(sceneById(lastMonthOnly, "newsletter_subscribers").line, "på tværs af 18 markeder");

  const otherMarketSet = buildTvScenes(fullInputs({ subscriberDaily: { days: { "2026-11-01": { total: 24000, marketCount: 17 } } } }), NOW);
  assert.equal(sceneById(otherMarketSet, "newsletter_subscribers").line, "på tværs af 18 markeder", "a baseline over other markets is no baseline");

  for (const [label, subscribers] of [
    ["incomplete", { complete: false, total: 24000, marketCount: 18, fetchedAt: "2026-11-10T07:30:00Z" }],
    ["stale", { complete: true, total: 25808, marketCount: 18, fetchedAt: "2026-11-09T06:00:00Z" }],
    ["missing", null]
  ]) {
    const result = buildTvScenes(fullInputs({ subscribers }), NOW);
    assert.equal(sceneById(result, "newsletter_subscribers"), undefined, label);
  }
});

test("email scenes need every market synced, without errors, in the last 36 hours", () => {
  const cases = [
    ["a market failed", emailAggregate({ UK: { syncedAt: "2026-11-10T04:52:00Z", lastError: "Klaviyo request failed (429).", campaigns: 1, messages: 1, received: 10, clicked: 1 } })],
    ["a market is stale", emailAggregate({ UK: { syncedAt: "2026-11-08T04:50:00Z", lastError: "", campaigns: 1, messages: 1, received: 10, clicked: 1 } })],
    ["a market is missing", emailAggregate({ UK: { missing: true } })],
    ["last month's aggregate", emailAggregate({}, "2026-10")]
  ];
  for (const [label, aggregate] of cases) {
    const result = buildTvScenes(fullInputs({ email: { aggregate } }), NOW);
    assert.equal(sceneById(result, "newsletter_delivered_mtd"), undefined, label);
    assert.equal(sceneById(result, "newsletter_clicks_mtd"), undefined, label);
    assert.notEqual(result.sources.email.status, "ok", label);
  }

  const empty = { syncedAt: "2026-11-10T04:52:00Z", lastError: "", campaigns: 0, messages: 0, received: 0, clicked: 0 };
  const nothingSent = buildTvScenes(fullInputs({ email: { aggregate: emailAggregate({ DK: empty, DE: empty, UK: empty }) } }), NOW);
  assert.equal(sceneById(nothingSent, "newsletter_delivered_mtd"), undefined, "no sends this month is left out, not shown as 0");

  const noClicks = { ...empty, campaigns: 1, messages: 1, received: 500 };
  const unclicked = buildTvScenes(fullInputs({ email: { aggregate: emailAggregate({ DK: noClicks, DE: noClicks, UK: noClicks }) } }), NOW);
  assert.equal(sceneById(unclicked, "newsletter_delivered_mtd").valueText, "1.500");
  assert.equal(sceneById(unclicked, "newsletter_clicks_mtd"), undefined);

  const single = buildTvScenes(fullInputs({ email: { aggregate: { monthKey: "2026-11", markets: { DK: emailAggregate().markets.DK } } } }), NOW);
  assert.equal(sceneById(single, "newsletter_delivered_mtd").source, "Klaviyo · 1 marked");
  assert.equal(sceneById(buildTvScenes(fullInputs(), NOW), "newsletter_delivered_mtd").source, "Klaviyo · 3 markeder");

  const yesterday = buildTvScenes(fullInputs({ email: { aggregate: emailAggregate({ DK: { ...emailAggregate().markets.DK, syncedAt: "2026-11-09T04:52:00Z" } }) } }), NOW);
  assert.equal(sceneById(yesterday, "newsletter_delivered_mtd").line, "kampagnemails sendt i november · opgjort i går", "named by the oldest market's sync");
});

test("the email aggregate counts this Copenhagen month's sends, every A/B arm once", () => {
  const history = {
    syncedAt: "2026-11-10T04:52:00Z",
    markets: {
      DK: {
        version: 1,
        country: "DK",
        syncedAt: "2026-11-10T04:52:00Z",
        messages: [
          // 31 October 23:30 UTC is 1 November 00:30 in Copenhagen.
          { id: "m1", campaignId: "c1", subject: "A", sentAt: "2026-10-31T23:30:00+00:00", abTest: false },
          // An A/B test: two arms, each its own recipients.
          { id: "m2a", campaignId: "c2", subject: "B1", sentAt: "2026-11-05T09:00:00+00:00", abTest: true },
          { id: "m2b", campaignId: "c2", subject: "B2", sentAt: "2026-11-05T09:00:00+00:00", abTest: true },
          // 31 October 22:30 UTC is still 31 October in Copenhagen (CET, +1).
          { id: "m0", campaignId: "c0", subject: "Z", sentAt: "2026-10-31T22:30:00+00:00", abTest: false }
        ],
        engagementByYear: {
          2026: {
            "c1|": [800, 400, 9],
            "c2|m2a": [300, 150, 4],
            "c2|m2b": [310, 160, 6],
            "c0|": [5000, 2500, 50]
          }
        }
      },
      UK: { version: 1, country: "UK", syncedAt: "2026-11-10T04:53:00Z", lastError: "", messages: [], engagementByYear: {} },
      SE: { version: 1, country: "SE", syncedAt: "2026-10-01T04:53:00Z", messages: [], engagementByYear: {} }
    }
  };
  const aggregate = aggregateEmailMonth(history, { now: NOW, expectedMarkets: ["DK", "UK", "NL"] });
  assert.equal(aggregate.monthKey, "2026-11");
  assert.deepEqual(aggregate.markets.DK, { syncedAt: "2026-11-10T04:52:00Z", lastError: "", campaigns: 2, messages: 3, received: 1410, clicked: 19 });
  assert.equal(aggregate.markets.UK.messages, 0);
  assert.deepEqual(aggregate.markets.NL, { missing: true }, "a configured market absent from the history is named");
  assert.equal(aggregate.markets.SE, undefined, "a market that is no longer configured cannot hold the scene back");
});

test("first-time reach is built from the Expansion tab's fields, and left off the TV by default", () => {
  assert.ok(!DEFAULT_SCENE_IDS.includes("expansion_first_time_reach"));
  const snapshot = {
    available: true,
    generatedAt: "2026-11-10T03:12:00Z",
    timezone: "America/Los_Angeles",
    months: [
      { month: "2026-10", since: "2026-10-01", until: "2026-10-31", partial: false, monthlyReach: 900000, netNewReach: 300000 },
      { month: "2026-11", since: "2026-11-01", until: "2026-11-09", partial: true, monthlyReach: 600000, netNewReach: 212345 }
    ],
    likeForLike: { month: "2026-10", since: "2026-10-01", until: "2026-10-09", clamped: false, netNewReach: 171729, comparison: { month: "2026-11", comparable: true } }
  };
  const off = buildTvScenes(fullInputs({ expansion: { snapshot } }), NOW);
  assert.equal(sceneById(off, "expansion_first_time_reach"), undefined);

  const on = buildTvScenes(fullInputs({ expansion: { snapshot }, sceneIds: [...DEFAULT_SCENE_IDS, "expansion_first_time_reach"] }), NOW);
  const reach = sceneById(on, "expansion_first_time_reach");
  assert.equal(reach.valueText, "212.345");
  assert.equal(reach.line, "1.–9. november · samme dage i oktober: 171.729");
  assert.match(reach.source, /konverteringskampagner/);
  assert.deepEqual(on.scenes.map((scene) => scene.id).slice(0, 3), ["meta_new_customers_mtd", "meta_cost_per_new_customer", "expansion_first_time_reach"]);

  const stale = buildTvScenes(fullInputs({ expansion: { snapshot: { ...snapshot, generatedAt: "2026-11-08T03:12:00Z" } }, sceneIds: ["expansion_first_time_reach"] }), NOW);
  assert.equal(stale.scenes.length, 0);
});

test("window labels use Danish month names", () => {
  const names = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
  names.forEach((name, index) => {
    const month = String(index + 1).padStart(2, "0");
    assert.equal(formatDayRange(`2026-${month}-01`, `2026-${month}-09`), `1.–9. ${name}`);
  });
  assert.equal(formatDayRange("2026-11-01", "2026-11-01"), "1. november");
  assert.equal(formatDayRange("2026-10-28", "2026-11-03"), "28. oktober – 3. november");
});

// ---- The TV's sign-in --------------------------------------------------------------------------

const AUTH = { authPassword: "hemmeligt", authSessionSecret: "session-secret" };
const FEED_TOKEN = "f".repeat(48);
const reqWith = (cookies = {}, headers = {}) => ({
  headers: {
    host: "project-4fcxa.vercel.app",
    "x-forwarded-proto": "https",
    cookie: Object.entries(cookies).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("; "),
    ...headers
  }
});

test("the feed opens to the TV project's token or a session, and to nothing else", () => {
  const env = { TV_FEED_TOKEN: FEED_TOKEN };
  assert.equal(resolveFeedAccess(reqWith({}, { authorization: `Bearer ${FEED_TOKEN}` }), AUTH, env), "feed");
  assert.equal(resolveFeedAccess(reqWith({}, { authorization: `bearer ${FEED_TOKEN}` }), AUTH, env), "feed");
  assert.equal(resolveFeedAccess(reqWith({}, { authorization: `Bearer ${FEED_TOKEN}x` }), AUTH, env), null, "wrong token");
  assert.equal(resolveFeedAccess(reqWith(), AUTH, env), null, "no token, no session");
  assert.equal(resolveFeedAccess(reqWith({ westpack_session: createSessionToken(AUTH) }), AUTH, env), "session");
  assert.equal(resolveFeedAccess(reqWith({ westpack_session: "forged.token" }), AUTH, env), null);
  assert.equal(resolveFeedAccess({ headers: { cookie: "westpack_session=%" } }, AUTH, env), null, "a malformed cookie is no session");
});

test("a missing or short TV_FEED_TOKEN accepts no token at all", () => {
  assert.equal(resolveFeedAccess(reqWith({}, { authorization: "Bearer " }), AUTH, {}), null);
  assert.equal(resolveFeedAccess(reqWith({}, { authorization: "Bearer kort" }), AUTH, { TV_FEED_TOKEN: "kort" }), null);
  assert.ok(MIN_FEED_TOKEN_LENGTH >= 32);
});

test("the feed token is never a session for the rest of the app", () => {
  assert.equal(isAuthenticated(reqWith({ westpack_session: FEED_TOKEN }), AUTH), false);
});

test("the route serves kpis only, behind the feed check", async () => {
  const saved = { AUTH_PASSWORD: process.env.AUTH_PASSWORD, AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET, TV_FEED_TOKEN: process.env.TV_FEED_TOKEN };
  process.env.AUTH_PASSWORD = "tv-test-password";
  process.env.AUTH_SESSION_SECRET = "tv-test-secret";
  process.env.TV_FEED_TOKEN = FEED_TOKEN;
  const route = require("../api/tv");
  const call = async ({ method = "GET", action, authorization = "" }) => {
    const req = { method, query: { action }, headers: { host: "project-4fcxa.vercel.app", "x-forwarded-proto": "https", authorization } };
    const res = {
      statusCode: 200,
      headers: {},
      body: "",
      setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
      end(text) { this.body = text; }
    };
    await route(req, res);
    return { status: res.statusCode, headers: res.headers, json: JSON.parse(res.body || "{}") };
  };
  try {
    const locked = await call({ action: "kpis" });
    assert.equal(locked.status, 401);
    assert.equal(locked.headers["cache-control"], "no-store");
    assert.equal((await call({ action: "kpis", authorization: "Bearer nej" })).status, 401);
    assert.equal((await call({ method: "POST", action: "kpis", authorization: `Bearer ${FEED_TOKEN}` })).status, 405);
    // the sign-in moved to the TV project; this app no longer answers it
    assert.equal((await call({ method: "POST", action: "login" })).status, 400);
    assert.equal((await call({ action: "session" })).status, 400);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

// ---- Caching and sources -----------------------------------------------------------------------

function fakeDeps(overrides = {}) {
  const calls = { fetchSubscribers: 0, readHistory: 0, writeKpis: 0, writeSubscriberDaily: 0 };
  const state = { kpis: null, daily: null, ...overrides.state };
  const deps = {
    calls,
    state,
    readKpis: async () => state.kpis,
    writeKpis: async (doc) => { calls.writeKpis += 1; state.kpis = doc; },
    readMetaAcquisition: async () => metaInput().doc,
    readExpansion: async () => null,
    readSubscriberDaily: async () => state.daily,
    writeSubscriberDaily: async (doc) => { calls.writeSubscriberDaily += 1; state.daily = doc; },
    readHistoryModifiedAt: async () => "2026-11-10T04:52:30.000Z",
    readHistory: async () => {
      calls.readHistory += 1;
      return { syncedAt: "2026-11-10T04:52:00Z", markets: { DK: { version: 1, country: "DK", syncedAt: "2026-11-10T04:52:00Z", messages: [{ id: "m1", campaignId: "c1", subject: "A", sentAt: "2026-11-03T09:00:00+00:00", abTest: false }], engagementByYear: { 2026: { "c1|": [800, 400, 9] } } } } };
    },
    fetchSubscribers: async () => {
      calls.fetchSubscribers += 1;
      return { complete: true, total: 25808, marketCount: 18, markets: [], failed: [], fetchedAt: "2026-11-10T08:00:00.000Z" };
    },
    expectedEmailMarkets: ["DK"],
    ...overrides
  };
  return deps;
}

test("kpis are served from the ten-minute cache, then rebuilt without refetching what has not changed", async () => {
  __resetMemory();
  const deps = fakeDeps();
  const first = await getTvKpis({ deps, now: NOW });
  assert.equal(first.fromCache, false);
  assert.deepEqual(first.payload.scenes.map((scene) => scene.id), DEFAULT_SCENE_IDS);
  assert.equal(deps.calls.fetchSubscribers, 1);
  assert.equal(deps.calls.readHistory, 1);
  assert.equal(deps.calls.writeSubscriberDaily, 1);
  assert.equal(deps.state.daily.days["2026-11-10"].total, 25808);

  const cached = await getTvKpis({ deps, now: new Date(NOW.getTime() + 9 * 60000) });
  assert.equal(cached.fromCache, true);
  assert.equal(deps.calls.writeKpis, 1);

  const rebuilt = await getTvKpis({ deps, now: new Date(NOW.getTime() + 11 * 60000) });
  assert.equal(rebuilt.fromCache, false);
  assert.equal(deps.calls.fetchSubscribers, 1, "subscribers are counted at most every three hours");
  assert.equal(deps.calls.readHistory, 1, "the history is not re-read while its last-modified is unchanged");

  deps.readHistoryModifiedAt = async () => "2026-11-11T04:52:30.000Z";
  await getTvKpis({ deps, now: new Date(NOW.getTime() + 3 * 3600000 + 60000) });
  assert.equal(deps.calls.fetchSubscribers, 2, "refetched after three hours");
  assert.equal(deps.calls.readHistory, 2, "re-read once the history changed");
  assert.equal(deps.state.daily.days["2026-11-10"].total, 25808, "the day's first count stays its baseline");
});

test("a failed subscriber count keeps the last complete one, and is retried after half an hour, not every poll", async () => {
  __resetMemory();
  const deps = fakeDeps();
  await getTvKpis({ deps, now: NOW });
  deps.fetchSubscribers = async () => { deps.calls.fetchSubscribers += 1; return { complete: false, total: null, marketCount: 18, error: "Not counted: UK (throttled)." }; };

  const later = new Date(NOW.getTime() + 3 * 3600000 + 60000);
  const failed = await getTvKpis({ deps, now: later });
  assert.equal(deps.calls.fetchSubscribers, 2);
  assert.equal(sceneById(failed.payload, "newsletter_subscribers").valueText, "25.808", "the last complete count, under a day old");
  assert.equal(failed.payload.sources.subscribers.lastAttemptError, "Not counted: UK (throttled).");

  await getTvKpis({ deps, now: new Date(later.getTime() + 11 * 60000) });
  assert.equal(deps.calls.fetchSubscribers, 2, "no retry within half an hour of a failure");
  await getTvKpis({ deps, now: new Date(later.getTime() + 31 * 60000) });
  assert.equal(deps.calls.fetchSubscribers, 3);
});

test("one source failing drops its scenes and nothing else", async () => {
  __resetMemory();
  const deps = fakeDeps({
    readMetaAcquisition: async () => { throw new Error("Blob read failed (503)."); },
    readHistory: async () => { throw new Error("Blob read failed (503)."); },
    fetchSubscribers: async () => { throw new Error("socket hang up"); }
  });
  const { payload } = await getTvKpis({ deps, now: NOW });
  assert.equal(payload.scenes.length, 0);
  assert.equal(payload.sources.meta.status, "unavailable");
  assert.equal(payload.sources.email.status, "unavailable");
  assert.equal(payload.sources.subscribers.status, "unavailable");

  __resetMemory();
  const partial = fakeDeps({ readMetaAcquisition: async () => { throw new Error("Blob read failed (503)."); } });
  const result = await getTvKpis({ deps: partial, now: NOW });
  assert.deepEqual(result.payload.scenes.map((scene) => scene.id), ["newsletter_subscribers", "newsletter_delivered_mtd", "newsletter_clicks_mtd"]);
});

test("the daily subscriber record is never rewritten after a failed read", async () => {
  __resetMemory();
  const deps = fakeDeps({ readSubscriberDaily: async () => { throw new Error("Blob read failed (500)."); } });
  const { payload } = await getTvKpis({ deps, now: NOW });
  assert.equal(deps.calls.writeSubscriberDaily, 0);
  assert.equal(sceneById(payload, "newsletter_subscribers").valueText, "25.808");
});

// ---- The dashboard hook ------------------------------------------------------------------------

function snapshotPayload(trend) {
  return { generatedAt: "2026-11-10T08:15:30Z", account: { currency: "DKK" }, dashboard: { quality: { customerAcquisition: { trend } } } };
}

test("the stored Meta document is the month-to-date trend, without the panel's presets", () => {
  const trend = { ...metaTrend(), windows: { presets: [1, 2, 3] }, dailySeries: [{ date: "2026-11-01" }] };
  const doc = buildTvMetaAcquisitionDoc(snapshotPayload(trend), NOW);
  assert.equal(doc.writtenAt, NOW.toISOString());
  assert.equal(doc.currency, "DKK");
  assert.equal(doc.trend.current.newCustomers, 112);
  assert.equal(doc.trend.windows, undefined);
  assert.equal(doc.trend.dailySeries, undefined);
  assert.equal(buildTvMetaAcquisitionDoc(snapshotPayload({ available: false }), NOW), null, "an unavailable trend is never stored");
});

test("the dashboard hook never throws, whatever the write does", async () => {
  const payload = snapshotPayload(metaTrend());
  assert.deepEqual(await recordTvMetaAcquisition(payload, { write: async () => {} }), { written: true });
  const thrown = await recordTvMetaAcquisition(payload, { write: () => { throw new Error("sync boom"); } });
  assert.equal(thrown.written, false);
  const rejected = await recordTvMetaAcquisition(payload, { write: async () => { throw new Error("Blob write failed (503)."); } });
  assert.equal(rejected.written, false);
  const hung = await recordTvMetaAcquisition(payload, { write: () => new Promise(() => {}), timeoutMs: 20 });
  assert.equal(hung.written, false);
  assert.match(hung.reason, /did not finish/);
  const lateFailure = await recordTvMetaAcquisition(payload, { write: () => new Promise((_, reject) => setTimeout(() => reject(new Error("late")), 40)), timeoutMs: 10 });
  assert.equal(lateFailure.written, false);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal((await recordTvMetaAcquisition(null)).written, false);
  assert.equal((await recordTvMetaAcquisition(snapshotPayload({ available: false }), { write: () => { throw new Error("never called"); } })).written, false);
});

test("account-snapshot stores the trend only after a fresh build, guarded, before it responds", () => {
  const source = read("api", "meta", "account-snapshot.js");
  const cacheAt = source.indexOf("setCachedSnapshot(snapshotCacheKey, responsePayload);");
  const hookAt = source.indexOf("await recordTvMetaAcquisition(responsePayload).catch(() => null);");
  const respondAt = source.indexOf("sendJson(res, 200, responsePayload);", cacheAt);
  assert.ok(cacheAt > 0 && hookAt > cacheAt && respondAt > hookAt, "the hook sits between caching the build and sending it");
  // Not on the catalog path, nor on a cache hit or a fallback: only a fresh build is stored.
  assert.ok(source.indexOf("setCachedSnapshot(catalogCacheKey, responsePayload);") < cacheAt);
  assert.equal(source.split("recordTvMetaAcquisition(").length - 1, 1, "called from one place only");
  assert.match(source, /require\("\.\.\/\.\.\/server\/tv\/meta-acquisition"\)/);
});

test("vercel.json rebuilds the snapshot after Meta's day rolls over, and gives the TV route room for Klaviyo", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/meta/account-snapshot?preset=last_7d" && cron.schedule === "15 8 * * *"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/meta/account-snapshot" && cron.schedule === "45 5 * * *"), "the existing cron is untouched");
  assert.equal(vercel.functions["api/tv.js"].maxDuration, 60);
});

test("the TV's documents never touch Redis", async () => {
  const MODULE = "../server/meta/historical-store";
  const saved = {};
  for (const key of ["BLOB_READ_WRITE_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "VERCEL"]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.KV_REST_API_URL = "https://redis.example";
  process.env.KV_REST_API_TOKEN = "t";
  process.env.VERCEL = "1";
  delete require.cache[require.resolve(MODULE)];
  const original = global.fetch;
  const fetched = [];
  global.fetch = async (url) => { fetched.push(String(url)); throw new Error("no network in tests"); };
  try {
    const store = require(MODULE);
    assert.equal(store.getTvStoreMode(), "volatile", "Redis configured, no Blob: memory, not Redis");
    await store.writeTvKpis({ a: 1 });
    assert.deepEqual(await store.readTvKpis(), { a: 1 });
    assert.equal(await store.readTvMetaAcquisition(), null);
    assert.deepEqual(fetched, []);
  } finally {
    global.fetch = original;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve(MODULE)];
  }
});
