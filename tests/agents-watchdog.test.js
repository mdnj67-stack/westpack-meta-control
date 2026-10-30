const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildClickUrl,
  checkLandingPages,
  checkMetaAccount,
  checkMetaAds,
  checkNightlySyncs,
  checkStorage,
  checkStores,
  isSwitchedOnAndLive,
  judgeLanding,
  runWatchdog,
  shouldRunDaily,
  withMute,
  withoutMute
} = require("../server/agents/watchdog");

const NOW = new Date("2026-10-30T09:00:00Z");

function response(status, { location = "", body = "", headers = {} } = {}) {
  const all = { ...(location ? { location } : {}), ...headers };
  return {
    status,
    headers: { get: (name) => all[name.toLowerCase()] ?? null },
    text: async () => body,
    body: { cancel: async () => {} }
  };
}

// A fake store: a map from URL (without query) to a function of the requested URL.
function fakeStore(routes, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url);
    const route = routes[`${parsed.origin}${parsed.pathname}`];
    if (!route) return response(404);
    return route(parsed);
  };
}

// The shapes below are from the live account on 2026-10-30.
const PAUSED_TEST_AD = {
  id: "6944707849648",
  name: "CODEX VIDEO CREATE FINAL CHECK",
  effective_status: "WITH_ISSUES",
  configured_status: "PAUSED",
  issues_info: [{ error_summary: "Error resizing the thumbnail image" }],
  adset: { name: "TEST ADSET MDJ", effective_status: "CAMPAIGN_PAUSED" },
  campaign: { name: "TEST KAMPAGNE MDJ", effective_status: "PAUSED" }
};

test("paused test ads with issues are not reported - only ads someone switched on in a delivering set", () => {
  assert.equal(isSwitchedOnAndLive(PAUSED_TEST_AD), false);
  assert.equal(isSwitchedOnAndLive({ configured_status: "ACTIVE", adset: { effective_status: "ACTIVE" }, campaign: { effective_status: "ACTIVE" } }), true);
});

test("the ad account: active is quiet, a payment problem alerts, a dead token alerts, a rate limit is 'could not check'", async () => {
  const ok = await checkMetaAccount({ accountId: "act_1", graph: async () => ({ name: "Westpack", account_status: 1, disable_reason: 0, spend_cap: "0", amount_spent: "515176021" }) });
  assert.equal(ok.status, "ok");

  const unpaid = await checkMetaAccount({ accountId: "act_1", graph: async () => ({ account_status: 3, disable_reason: 0, spend_cap: "0" }) });
  assert.equal(unpaid.status, "alert");
  assert.match(unpaid.items[0].title, /payment is due/);

  const token = await checkMetaAccount({ accountId: "act_1", graph: async () => { throw new Error("Error validating access token | code 190"); } });
  assert.equal(token.status, "alert");
  assert.match(token.summary, /access token/);

  const throttled = await checkMetaAccount({ accountId: "act_1", graph: async () => { throw new Error("There have been too many calls to this ad-account | code 80004"); } });
  assert.equal(throttled.status, "error");
});

test("rejected ads: a switched-on rejected ad alerts with Meta's reason; review under a day is normal", async () => {
  const live = { configured_status: "ACTIVE", adset: { name: "LAL - DE", effective_status: "ACTIVE" }, campaign: { name: "BA - Reach", effective_status: "ACTIVE" } };
  const graph = async () => ({
    data: [
      PAUSED_TEST_AD,
      { ...live, id: "a1", name: "AD20 - DE", effective_status: "DISAPPROVED", ad_review_feedback: { global: { "Unacceptable business practices": "Your ad does not comply." } } },
      { ...live, id: "a2", name: "AD21 - DE", effective_status: "PENDING_REVIEW", updated_time: "2026-10-30T02:00:00+0000" },
      { ...live, id: "a3", name: "AD22 - DE", effective_status: "PENDING_REVIEW", updated_time: "2026-10-28T02:00:00+0000" }
    ]
  });
  const result = await checkMetaAds({ graph, accountId: "act_1", now: NOW });
  assert.deepEqual(result.items.map((item) => [item.key, item.status]), [["a1", "alert"], ["a3", "warn"]]);
  assert.match(result.items[0].detail, /BA - Reach > LAL - DE - rejected: Your ad does not comply/);
});

test("a click is built the way Meta builds it: the ad's URL parameters with dynamic values filled, plus fbclid", () => {
  const url = new URL(buildClickUrl("https://www.westpack.com/eur_eu_ita/jewellery-boxes.html", "utm_source=facebook&utm_medium=paidsocial&utm_campaign={{campaign.name}}"));
  assert.equal(url.searchParams.get("utm_campaign"), "watchdog");
  assert.equal(url.searchParams.get("fbclid"), "wpwatchdog");
});

test("the Italian 301 that drops fbclid is an alert that names the page to link instead", () => {
  const clickUrl = buildClickUrl("https://www.westpack.com/eur_eu_ita/jewellery-boxes.html", "utm_source=facebook");
  const item = judgeLanding({
    clickUrl,
    ads: ["AD14 - Smykkeæsker - it_IT"],
    result: { response: response(200), finalUrl: "https://www.westpack.com/eur_eu_ita/astucci-per-gioielli.html?utm_source=facebook", hops: [{ status: 301 }] }
  });
  assert.equal(item.status, "alert");
  assert.match(item.detail, /drops fbclid/);
  assert.match(item.detail, /Point the ads at www\.westpack\.com\/eur_eu_ita\/astucci-per-gioielli\.html/);
});

test("a link with a double slash is called a typo in the ad, not a reason to re-point it", () => {
  const clickUrl = buildClickUrl("https://www.westpack.com/eur_eu_eng//blog/adventcalendar-2026", "utm_source=facebook");
  const item = judgeLanding({ clickUrl, ads: ["AD30"], result: { response: response(200), finalUrl: "https://www.westpack.com/eur_eu_eng/blog/adventcalendar-2026", hops: [{ status: 301 }] } });
  assert.match(item.detail, /double slash/);
  assert.match(item.detail, /Correct the link in the ad/);
});

test("a page that loads directly is quiet; a redirect that keeps everything is only a note", () => {
  const clickUrl = buildClickUrl("https://www.westpack.com/gbp_uk_eng/jewellery-boxes.html", "utm_source=facebook");
  assert.equal(judgeLanding({ clickUrl, ads: ["AD1"], result: { response: response(200), finalUrl: clickUrl, hops: [] } }), null);
  const moved = clickUrl.replace("jewellery-boxes", "jewelry-boxes");
  assert.equal(judgeLanding({ clickUrl, ads: ["AD1"], result: { response: response(200), finalUrl: moved, hops: [{ status: 301 }] } }).status, "note");
  assert.equal(judgeLanding({ clickUrl, ads: ["AD1"], result: { response: response(403, { headers: { "cf-mitigated": "challenge" } }), finalUrl: clickUrl, hops: [] } }).status, "error");
});

test("landing pages: every blog page that strips its query string is one finding with a list, not one alarm each", async () => {
  const graph = async () => ({
    data: [
      { name: "AD15 - Glittery bow - en_GB", creative: { url_tags: "utm_source=facebook&utm_medium=paidsocial", object_story_spec: { link_data: { link: "https://www.westpack.com/gbp_uk_eng/blog/4-ways-to-wrap-christmas-gifts" } } } },
      { name: "AD10 - Top 5 - de_DE", creative: { url_tags: "utm_source=facebook&utm_medium=social", object_story_spec: { video_data: { call_to_action: { value: { link: "https://www.westpack.com/eur_eu_ger/blog/top-5-most-popular-jewellery-boxes" } } } } } },
      { name: "AD04 - Smykkeæsker - en_US", creative: { url_tags: "utm_source=facebook&utm_medium=paidsocial", asset_feed_spec: { link_urls: [{ website_url: "https://www.westpack.com/usd_us_eng/jewelry-boxes.html" }] } } }
    ]
  });
  const blog = (url) => (url.search ? response(301, { location: `${url.origin}${url.pathname}` }) : response(200));
  const calls = [];
  const fetchImpl = fakeStore({
    "https://www.westpack.com/gbp_uk_eng/blog/4-ways-to-wrap-christmas-gifts": blog,
    "https://www.westpack.com/eur_eu_ger/blog/top-5-most-popular-jewellery-boxes": blog,
    "https://www.westpack.com/usd_us_eng/jewelry-boxes.html": () => response(200)
  }, calls);
  const result = await checkLandingPages({ graph, accountId: "act_1", fetchImpl, paceMs: 0, retryDelayMs: 0 });

  const grouped = result.items.find((item) => item.key === "query_stripped");
  assert.ok(grouped, "the blog pages are grouped");
  assert.equal(grouped.status, "alert");
  assert.equal(grouped.list.length, 2);
  assert.match(grouped.title, /2 pages drop fbclid and UTM on every click \(2 ads\)/);
  assert.equal(result.items.find((item) => item.key === "utm_medium_social").status, "note");
  assert.match(result.summary, /2 of 3 landing pages/);
  // Asked the way a phone asks: with a bare "Accept: text/html" and UTM parameters the store's
  // Magento throws a 500 that no real visitor ever sees.
  assert.ok(calls.every((call) => call.options.headers.Accept.includes("*/*")));
  assert.ok(calls.every((call) => call.options.redirect === "manual"));
});

test("a page that fails once and loads on the second look is a note, not an alert", async () => {
  let attempts = 0;
  const graph = async () => ({ data: [{ name: "AD02", creative: { object_story_spec: { link_data: { link: "https://www.westpack.com/usd_us_eng/shipping-supplies/mailer-boxes.html" } } } }] });
  const fetchImpl = fakeStore({ "https://www.westpack.com/usd_us_eng/shipping-supplies/mailer-boxes.html": () => (++attempts === 1 ? response(500) : response(200)) });
  const result = await checkLandingPages({ graph, accountId: "act_1", fetchImpl, paceMs: 0, retryDelayMs: 0 });
  assert.equal(attempts, 2);
  assert.equal(result.items[0].status, "note");
  assert.match(result.items[0].detail, /fine on a second try/);
  assert.equal(result.status, "note");
});

test("stores: a store without the GTM container alerts; one that recovers on the second look does not", async () => {
  const page = "<html><script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-5QRXWTJ');</script></html>";
  let frTries = 0;
  const fetchImpl = fakeStore({
    "https://www.westpack.com/dkk_dk_den/": () => response(200, { body: page }),
    "https://www.westpack.com/eur_eu_fra/": () => (++frTries === 1 ? response(502) : response(200, { body: page })),
    "https://www.westpack.com/nok_no_nor/": () => response(200, { body: "<html>no tag</html>" })
  });
  const stores = [
    { code: "DK", url: "https://www.westpack.com/dkk_dk_den/" },
    { code: "FR", url: "https://www.westpack.com/eur_eu_fra/" },
    { code: "NO", url: "https://www.westpack.com/nok_no_nor/" }
  ];
  const result = await checkStores({ fetchImpl, stores, paceMs: 0, retryDelayMs: 0 });
  assert.deepEqual(result.items.map((item) => [item.key, item.status]), [["FR", "note"], ["NO", "alert"]]);
  assert.match(result.items[1].detail, /GTM-5QRXWTJ is missing/);
});

test("nightly jobs: a day and a bit is a warning, two days an alert, no Blob is 'not applicable'", async () => {
  const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 3600000).toISOString();
  const result = await checkNightlySyncs({
    now: NOW,
    readSnapshotTimes: async () => ({
      historical_intelligence: { exists: true, lastModified: hoursAgo(5) },
      expansion_reach: { exists: true, lastModified: hoursAgo(30) },
      audience_saturation: { exists: true, lastModified: hoursAgo(60) },
      subject_line_history: { exists: false, lastModified: null }
    })
  });
  assert.deepEqual(result.items.map((item) => [item.key, item.status]), [["expansion_reach", "warn"], ["audience_saturation", "alert"], ["subject_line_history", "warn"]]);
  assert.equal((await checkNightlySyncs({ now: NOW, readSnapshotTimes: async () => null })).status, "skipped");
});

test("Redis: missing is not applicable; a plan limit says what stops being saved", async () => {
  assert.equal((await checkStorage({ redisPing: async () => { throw new Error("Redis persistence is not configured."); } })).status, "skipped");
  const full = await checkStorage({ redisPing: async () => { throw new Error("ERR max requests limit exceeded. Limit: 500000"); } });
  assert.equal(full.status, "alert");
  assert.match(full.summary, /Studio drafts, the asset library, the audit log/);
  assert.equal((await checkStorage({ redisPing: async () => "PONG" })).status, "ok");
});

test("the daily checks run once a morning, on the first run after 05:00 UTC", () => {
  const at = (iso) => new Date(iso);
  assert.equal(shouldRunDaily({ previous: null, now: at("2026-10-30T03:07:00Z"), scope: "auto" }), true);
  assert.equal(shouldRunDaily({ previous: { lastDailyAt: "2026-10-29T05:07:00Z" }, now: at("2026-10-30T04:07:00Z"), scope: "auto" }), false);
  assert.equal(shouldRunDaily({ previous: { lastDailyAt: "2026-10-29T05:07:00Z" }, now: at("2026-10-30T05:07:00Z"), scope: "auto" }), true);
  assert.equal(shouldRunDaily({ previous: { lastDailyAt: "2026-10-30T05:07:00Z" }, now: at("2026-10-30T06:07:00Z"), scope: "auto" }), false);
  assert.equal(shouldRunDaily({ previous: { lastDailyAt: "2026-10-30T05:07:00Z" }, now: at("2026-10-30T06:07:00Z"), scope: "all" }), true);
});

test("a muted item stays quiet until its state changes, and the counts leave it out", async () => {
  const live = { configured_status: "ACTIVE", adset: { name: "S", effective_status: "ACTIVE" }, campaign: { name: "C", effective_status: "ACTIVE" } };
  let reason = "Your ad does not comply.";
  const deps = {
    graph: async (graphPath) => (graphPath.endsWith("/ads")
      ? { data: [{ ...live, id: "a1", name: "AD20", effective_status: "DISAPPROVED", ad_review_feedback: { global: { policy: reason } } }] }
      : { account_status: 1, spend_cap: "0" }),
    accountId: "act_1",
    redisPing: async () => "PONG",
    readSnapshotTimes: async () => null,
    fetchImpl: fakeStore({}),
    stores: []
  };
  const first = await runWatchdog({ deps, previous: { lastDailyAt: NOW.toISOString() }, scope: "auto", now: NOW });
  assert.equal(first.counts.alert, 1);

  const muted = withMute(first, { checkId: "meta_ads", itemKey: "a1", note: "Appealed", now: NOW });
  assert.equal(muted.counts.alert, 0);
  assert.equal(muted.counts.muted, 1);

  const again = await runWatchdog({ deps, previous: muted, scope: "auto", now: new Date(NOW.getTime() + 3600000) });
  assert.equal(again.counts.alert, 0, "same reason: still muted");

  reason = "A new policy problem.";
  const changed = await runWatchdog({ deps, previous: again, scope: "auto", now: new Date(NOW.getTime() + 7200000) });
  assert.equal(changed.counts.alert, 1, "a new reason breaks the mute");

  assert.equal(withoutMute(muted, { checkId: "meta_ads", itemKey: "a1" }).counts.alert, 1);
  assert.equal(changed.history.length, 3);
});

test("the watchdog only reads: no write to Meta, Klaviyo or the stores anywhere in it", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server", "agents", "watchdog.js"), "utf8");
  assert.doesNotMatch(source, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
  const route = fs.readFileSync(path.join(__dirname, "..", "api", "agents.js"), "utf8");
  assert.match(route, /graphRequest\(graphPath, config\.metaAccessToken, \{ params, maxRetries: 0 \}\)/, "rate limits are never retried against the account");
  assert.doesNotMatch(route, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
});
