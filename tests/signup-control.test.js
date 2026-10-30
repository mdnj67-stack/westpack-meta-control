// The Signup Lab in the app: what the script on the stores runs is set here, the stores only ever see on/off, the
// experience and the markets where live has been brought in, and live can only reach a store that carries the tag -
// where its Insert popup comes down, and comes back up when live stops. The Signups view counts what the funnel and
// Klaviyo report, with live and test never mixed. Klaviyo's own forms live under Klaviyo email.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const control = require("../server/signup/control");
const rules = require("../signup/core/rules");
const { readTag, readKlaviyoIds, checkStores } = require("../server/signup/store-check");
const { LIVE, CURRENT, MARKETS, TEST_TARGET } = require("../signup/core/markets");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const installed = (c, markets) => ({ ...c, storeCheck: { at: new Date().toISOString(), live: Object.fromEntries(markets.map((m) => [m, { tag: "yes", klaviyo: [] }])) } });

test("with nothing saved, the control is what signup/core/markets.js says, so the stores behave as before", () => {
  const c = control.normalizeControl(null);
  assert.equal(c.live.on, LIVE);
  assert.equal(c.live.current, CURRENT);
  assert.equal(c.staging.current, CURRENT);
  assert.equal(c.staging.on, true);
  assert.equal(Object.keys(c.live.markets).length, 18);
  assert.ok(Object.values(c.live.markets).every(Boolean));
  assert.deepEqual(c.live.reach, []);
});

test("a stored document with nonsense in it is read as the defaults, field by field", () => {
  const c = control.normalizeControl({ v: 1, live: { on: "yes", current: "spin-to-win", markets: { DK: false, XX: false }, reach: ["DK", "XX"] }, staging: { current: "pack-and-ship" }, insert: { unpublished: [{ market: "DK", id: "SPPrjA" }, { market: "ZZ", id: "nope" }] } });
  assert.equal(c.live.on, LIVE);
  assert.equal(c.live.current, CURRENT);
  assert.equal(c.live.markets.DK, false);
  assert.equal(c.live.markets.XX, undefined);
  assert.deepEqual(c.live.reach, [], "off reaches nobody");
  assert.equal(c.staging.current, "pack-and-ship");
  assert.deepEqual(c.insert.unpublished.map((f) => f.id), ["SPPrjA"]);
});

test("the stores see on/off, the experience and the markets - never the history, the form ids or the store check", () => {
  let c = installed(control.normalizeControl(null), ["DK"]);
  c = control.applyChange(c, { type: "live", on: true }).control;
  c = control.recordInsertResults(c, [{ action: "unpublish", market: "DK", id: "SPPrjA", name: "DK - Popup - The Insert", ok: true }]);
  const pub = control.publicConfig(c);
  assert.deepEqual(Object.keys(pub).sort(), ["at", "live", "staging", "v"]);
  assert.deepEqual(Object.keys(pub.live).sort(), ["current", "markets", "on"]);
  const text = JSON.stringify(pub);
  for (const secret of ["SPPrjA", "history", "storeCheck", "insert", "Popup", "reach"]) assert.ok(!text.includes(secret), secret);
  // a market is on for the stores only where live has been brought in
  assert.equal(pub.live.markets.DK, true);
  assert.equal(pub.live.markets.DE, false);
});

test("live cannot be switched on before a live store carries the tag", () => {
  const c = control.normalizeControl(null);
  assert.throws(() => control.applyChange(c, { type: "live", on: true }), /No live store carries the tag/);
  // a store with only the test tag does not count
  const testOnly = { ...c, storeCheck: { live: { DK: { tag: "test-only" } } } };
  assert.throws(() => control.applyChange(testOnly, { type: "live", on: true }), /No live store carries the tag/);
  // nor does a store that carries it but is switched off
  const off = control.applyChange(installed(c, ["DK"]), { type: "market", market: "DK", on: false }).control;
  assert.throws(() => control.applyChange(off, { type: "live", on: true }), /Every store that carries the tag is switched off/);
  const on = control.applyChange(installed(c, ["DK"]), { type: "live", on: true });
  assert.equal(on.control.live.on, true);
  assert.deepEqual(on.control.live.reach, ["DK"]);
  assert.match(on.text, /Live switched on\. It runs on DK\./);
});

test("every change is checked, says what it did, and is kept in a bounded history", () => {
  let c = control.normalizeControl(null);
  assert.throws(() => control.applyChange(c, { type: "current", env: "live", concept: "spin-to-win" }), /Unknown experience/);
  assert.throws(() => control.applyChange(c, { type: "current", env: "live", concept: CURRENT }), /already runs/);
  assert.throws(() => control.applyChange(c, { type: "market", market: "XX", on: false }), /Unknown market/);
  assert.throws(() => control.applyChange(c, { type: "reach" }), /Live is off/);
  assert.throws(() => control.applyChange(c, { type: "drop_tables" }), /Unknown change/);
  const r = control.applyChange(c, { type: "current", env: "staging", concept: "swipe-match" });
  assert.equal(r.control.staging.current, "swipe-match");
  assert.equal(r.control.live.current, CURRENT, "staging can run another experience than live");
  assert.match(r.text, /Staging now runs Swipe match \(was Logo studio\)/);
  assert.equal(r.control.history[0].text, r.text);
  assert.ok(r.control.updatedAt);
  for (let i = 0; i < control.HISTORY_KEPT + 20; i++) c = control.applyChange(c, { type: "staging", on: i % 2 === 1 }).control;
  assert.equal(c.history.length, control.HISTORY_KEPT);
});

test("live takes The Insert down only where the Signup Lab then runs, and puts back only what it took down", () => {
  let c = installed(control.normalizeControl(null), ["DK", "DE"]);
  const forms = { DK: [{ id: "SPPrjA", name: "DK - Popup - The Insert", status: "live" }], DE: [{ id: "Uf83fC", name: "DE - Popup - The Insert", status: "live" }, { id: "Draft1", name: "DE - Popup - The Insert v2", status: "draft" }], FR: [{ id: "YmiXMm", name: "FR - Popup - The Insert", status: "live" }] };
  c = control.applyChange(c, { type: "live", on: true }).control;
  let plan = control.insertPlan(c, forms);
  assert.deepEqual(plan.reach.sort(), ["DE", "DK"]);
  assert.deepEqual(plan.unpublish.map((f) => f.id).sort(), ["SPPrjA", "Uf83fC"], "FR has no tag, so its popup stays; drafts are left alone");
  assert.deepEqual(plan.republish, []);
  c = control.recordInsertResults(c, plan.unpublish.map((f) => ({ action: "unpublish", ...f, ok: true })));
  // DE switched off: its popup goes back up, DK's stays down
  const offDe = control.applyChange(c, { type: "market", market: "DE", on: false });
  c = offDe.control;
  assert.match(offDe.text, /Live now runs on DK \(was DK, DE\)\./);
  plan = control.insertPlan(c, { DK: [{ id: "SPPrjA", name: "x", status: "draft" }] });
  assert.deepEqual(plan.republish.map((f) => f.id), ["Uf83fC"]);
  assert.deepEqual(plan.unpublish, []);
  c = control.recordInsertResults(c, [{ action: "republish", market: "DE", id: "Uf83fC", ok: true }]);
  assert.deepEqual(c.insert.unpublished.map((f) => f.id), ["SPPrjA"]);
  // live off: everything this page took down goes back, and nothing else
  c = control.applyChange(c, { type: "live", on: false }).control;
  assert.deepEqual(c.live.reach, []);
  plan = control.insertPlan(c, {});
  assert.deepEqual(plan.republish.map((f) => f.id), ["SPPrjA"]);
  // a failed publish stays recorded, so the next change tries again
  c = control.recordInsertResults(c, [{ action: "republish", market: "DK", id: "SPPrjA", ok: false }]);
  assert.deepEqual(c.insert.unpublished.map((f) => f.id), ["SPPrjA"]);
  assert.match(c.history[0].text, /FAILED: published again The Insert in DK/);
});

test("a store that gains the tag while live is on stays silent until it is brought in, so it never runs beside its Insert popup", () => {
  let c = installed(control.normalizeControl(null), ["DK"]);
  c = control.applyChange(c, { type: "live", on: true }).control;
  assert.equal(control.pendingReach(c), null);
  // Wexo puts the tag on DE and FR, and takes it off DK; the store check sees it
  c = { ...c, storeCheck: { at: new Date().toISOString(), live: { DE: { tag: "yes" }, FR: { tag: "yes" } } } };
  assert.deepEqual(control.publicConfig(c).live.markets.DE, false, "DE is not told to run yet");
  assert.deepEqual(control.pendingReach(c), { add: ["DE", "FR"], remove: ["DK"] });
  // a staging change does not move live, nor its popups
  const staging = control.applyChange(c, { type: "staging", on: false }).control;
  assert.deepEqual(staging.live.reach, ["DK"]);
  assert.equal(control.touchesLive({ type: "staging", on: false }), false);
  assert.equal(control.touchesLive({ type: "current", env: "staging", concept: "swipe-match" }), false);
  assert.equal(control.touchesLive({ type: "current", env: "live", concept: "swipe-match" }), true);
  // bringing live in line moves reach, and with it which popups come down and go back up
  const r = control.applyChange(c, { type: "reach" });
  assert.deepEqual(r.control.live.reach, ["DE", "FR"]);
  assert.match(r.text, /Live now runs on DE, FR \(was DK\)/);
  const plan = control.insertPlan({ ...r.control, insert: { unpublished: [{ market: "DK", id: "SPPrjA", name: "DK" }] } }, { DE: [{ id: "Uf83fC", name: "DE", status: "live" }], FR: [{ id: "YmiXMm", name: "FR", status: "live" }] });
  assert.deepEqual(plan.unpublish.map((f) => f.market), ["DE", "FR"]);
  assert.deepEqual(plan.republish.map((f) => f.market), ["DK"]);
  assert.throws(() => control.applyChange(r.control, { type: "reach" }), /already runs on every store/);
});

test("a document written before reach existed reads as what that version ran", () => {
  const old = { v: 1, live: { on: true, current: CURRENT, markets: { DE: false } }, storeCheck: { live: { DK: { tag: "yes" }, DE: { tag: "yes" } } } };
  assert.deepEqual(control.normalizeControl(old).live.reach, ["DK"]);
});

test("a change to live looks at the stores again when the last look is more than ten minutes old", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  assert.equal(control.storeCheckIsFresh({ storeCheck: { at: "2026-10-30T11:55:00Z" } }, now), true);
  assert.equal(control.storeCheckIsFresh({ storeCheck: { at: "2026-10-30T11:45:00Z" } }, now), false);
  assert.equal(control.storeCheckIsFresh({ storeCheck: null }, now), false);
});

test("the page says how the script behaves from the script's own rules", () => {
  const text = control.behaviour().map((b) => `${b.label}: ${b.text}`).join("\n");
  const desktop = rules.triggerPlan("desktop", 1);
  assert.ok(text.includes(`Opens after ${desktop.delayMs / 1000} s`), text);
  assert.ok(text.includes(`${rules.SUPPRESSION.closedDays[0]} days`));
  assert.ok(text.includes(`${rules.SUPPRESSION.emailVisitorDays} days`));
  assert.match(control.SNIPPET, /^<script src="https:\/\/project-4fcxa\.vercel\.app\/signup\/westpack-signup\.js" async><\/script>$/);
  assert.match(control.SNIPPET_PLACE, /Magento/);
});

test("the store check reads the real tag, not a test tag, and every Klaviyo account the page or Tag Manager loads", async () => {
  assert.equal(readTag('<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>'), "yes");
  assert.equal(readTag('<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" data-test="1"></script>'), "test-only");
  assert.equal(readTag("<html></html>"), "no");
  assert.deepEqual(readKlaviyoIds('src="//static.klaviyo.com/onsite/js/klaviyo.js?company_id=VRPp5S"'), ["VRPp5S"]);
  // Tag Manager writes the tag's HTML into a JavaScript string
  assert.deepEqual(readKlaviyoIds("klaviyo.js?company_id\\x3dWkyaSU\\x22"), ["WkyaSU"]);

  const pages = {
    "https://www.westpack.com/dkk_dk_den/": { status: 200, text: '<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script><script src="//static.klaviyo.com/onsite/js/klaviyo.js?company_id=VRPp5S"></script>' },
    "https://www.westpack.com/eur_eu_ger/": { status: 200, text: "<html></html>" },
    "https://westpack-staging.wexohosting.com/dkk_dk_den/": { status: 200, text: '<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>' },
    "https://westpack-staging.wexohosting.com/eur_eu_ger/": { status: 302, location: "/_auth/login?next=%2F" },
    "https://www.googletagmanager.com/gtm.js?id=GTM-5QRXWTJ": { status: 200, text: "klaviyo.js?company_id\\x3dWkyaSU" }
  };
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push({ url, opts });
    const p = pages[url] || { status: 404, text: "" };
    return { status: p.status, headers: { get: (h) => (h === "location" ? p.location || "" : "") }, text: async () => p.text };
  };
  const r = await checkStores({ markets: { DK: "dkk_dk_den", DE: "eur_eu_ger" }, stagingAuth: "dev:secret", fetchImpl, now: "t" });
  assert.equal(r.live.DK.tag, "yes");
  assert.deepEqual(r.live.DK.klaviyo, ["VRPp5S"]);
  assert.equal(r.live.DE.tag, "no");
  assert.equal(r.staging.DK.tag, "yes");
  assert.match(r.staging.DE.error, /login was refused/);
  assert.deepEqual(r.gtm.klaviyo, ["WkyaSU"]);
  // the store is asked the way a browser asks, and the staging login goes to staging only
  const live = seen.find((s) => s.url.startsWith("https://www.westpack.com/"));
  assert.match(live.opts.headers.Accept, /text\/html,application\/xhtml\+xml/);
  assert.ok(!live.opts.headers.Authorization);
  assert.equal(seen.find((s) => s.url.startsWith("https://westpack-staging")).opts.headers.Authorization, `Basic ${Buffer.from("dev:secret").toString("base64")}`);
  // without the login, staging is skipped and says why
  const noAuth = await checkStores({ markets: { DK: "dkk_dk_den" }, fetchImpl, now: "t" });
  assert.equal(noAuth.staging, null);
  assert.match(noAuth.stagingNote, /SIGNUP_STAGING_AUTH/);
});

test("the API: config is public and cached at the edge; a change on top of someone else's is refused; popups that come back go up before the switch", () => {
  const api = read("api/signup/control.js");
  assert.match(api, /if \(action === "config"\) \{\s*res\.setHeader\("Access-Control-Allow-Origin", "\*"\);/);
  assert.match(api, /"public, max-age=30, s-maxage=30, stale-while-revalidate=300"/);
  assert.match(api, /const out = control\.publicConfig\(await readSignupControl\(\)\);/);
  // a failed read is not an answer: the script then falls back to the file, which keeps live off
  assert.match(api, /return sendJson\(res, 503, \{ error: "Control could not be read\." \}\);/);
  const afterConfig = api.slice(api.indexOf("if (!requireAuth(req, res, config)) return;"));
  for (const action of ['"status"', '"change"', '"store_check"', '"forms"']) assert.ok(afterConfig.includes(`action === ${action}`), action);
  assert.match(api, /body\.expect !== undefined && \(body\.expect \|\| null\) !== \(before\.updatedAt \|\| null\)/);
  assert.match(api, /return sendJson\(res, 409,/);
  // a market whose popups cannot be read does not go live
  assert.match(api, /Could not read The Insert popups in .* - nothing was changed\./);
  // republish, then the switch, then unpublish
  const republish = api.indexOf("setPublished(keys[f.market], f.id, true)");
  const write = api.indexOf("await writeSignupControl(next);", republish);
  const unpublish = api.indexOf("setPublished(keys[f.market], f.id, false)");
  assert.ok(republish > 0 && republish < write && write < unpublish);
  // a live change sees today's tags
  assert.match(api, /before = await withFreshLiveCheck\(before\);/);
  // the stores' copy is read from Blob alone, never through the full Redis
  assert.match(read("server/meta/historical-store.js"), /const readSignupControl = async \(\) => \(getHistoricalStoreProfile\(\)\.mode === "blob" \? blobRead\(SIGNUP_CONTROL_STORE_KEY\)/);
});

// ---- the funnel ----

const funnel = require("../server/signup/funnel-store");
const rec = (concept, steps, extra = {}) => ({ concept, outcome: steps.includes("subscribed") ? "subscribed" : "closed", device: "mobile", market: "DK", steps: steps.map((n, i) => ({ n, t: i * 1000 })), errors: [], ...extra });

test("the funnel counts per experience, per market and per Danish day, and lists the latest signups", () => {
  const at = (iso) => Date.parse(iso);
  const out = funnel.aggregate([
    rec("logo-studio", ["peek_shown", "open", "name_typed", "email_focus", "submit", "subscribed"], { at: at("2026-10-29T22:30:00Z"), page: "home" }),
    rec("logo-studio", ["peek_shown", "open", "close_button"], { at: at("2026-10-29T10:00:00Z") }),
    rec("swipe-match", ["peek_shown", "peek_dismissed"], { at: at("2026-10-30T09:00:00Z"), market: "DE" }),
  ], { days: ["2026-10-29", "2026-10-30"] });
  assert.equal(out.total.exposures, 3);
  assert.equal(out.concepts["logo-studio"].opened, 2);
  assert.equal(out.concepts["logo-studio"].interacted, 1);
  assert.equal(out.concepts["logo-studio"].subscribedPerExposure, 0.5);
  assert.deepEqual(out.byMarket.DK, { exposures: 2, opened: 2, subscribed: 1, subscribedPerExposure: 0.5 });
  assert.equal(out.byMarket.DE.subscribed, 0);
  // 22:30 UTC on the 29th is 23:30 in Copenhagen: still the 29th; the signup lands there
  assert.deepEqual(out.days.map((d) => [d.date, d.exposures, d.subscribed]), [["2026-10-29", 2, 1], ["2026-10-30", 1, 0]]);
  assert.equal(out.latest.length, 1);
  assert.deepEqual(out.latest[0], { at: "2026-10-29T22:30:00.000Z", market: "DK", concept: "logo-studio", device: "mobile", page: "home", seconds: 5 });
  // what a day is, in Copenhagen
  assert.equal(funnel.localDay(at("2026-10-29T23:30:00Z")), "2026-10-30");
  assert.deepEqual(funnel.localDays(at("2026-10-24T22:00:00Z"), at("2026-10-26T12:00:00Z")), ["2026-10-25", "2026-10-26"], "the summer-time change is one day");
});

test("the funnel folds files as it reads, and never counts a record twice", async () => {
  // an in-memory Vercel Blob: put, get, list and delete as funnel-store.js calls them
  const store = new Map();
  const host = "https://teststore.private.blob.vercel-storage.com";
  const realFetch = global.fetch;
  const realToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_secret";
  global.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (u.origin === host) { const v = store.get(decodeURIComponent(u.pathname.slice(1))); return v ? json(JSON.parse(v)) : json({}, 404); }
    if (opts.method === "PUT") { const p = u.searchParams.get("pathname"); store.set(p, opts.body); return json({ pathname: p }); }
    if (u.pathname.endsWith("/delete")) { for (const x of JSON.parse(opts.body).urls) store.delete(x.replace(`${host}/`, "")); return json({}); }
    const prefix = u.searchParams.get("prefix");
    return json({ blobs: [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: `${host}/${k}` })), hasMore: false });
  };
  try {
    const now = Date.parse("2026-10-30T12:00:00Z");
    const yesterday = Date.parse("2026-10-29T12:00:00Z");
    for (let i = 0; i < 3; i++) await funnel.writeExposure({ env: "live", ...rec("logo-studio", ["open", "subscribed"]) }, yesterday + i);
    // 45 settled shards today and 2 fresh ones
    for (let i = 0; i < 45; i++) await funnel.writeExposure({ env: "live", ...rec("logo-studio", ["open"]) }, now - 10 * 60000 + i);
    for (let i = 0; i < 2; i++) await funnel.writeExposure({ env: "live", ...rec("logo-studio", ["open", "subscribed"]) }, now - 1000 + i);
    const first = await funnel.report({ env: "live", since: "2026-10-29T00:00:00Z", now });
    assert.equal(first.records, 50);
    assert.equal(first.total.subscribed, 5);
    const keys = [...store.keys()];
    assert.ok(keys.includes("signup-funnel/live/daily/2026-10-29.json"), "yesterday is one file");
    assert.equal(keys.filter((k) => k.startsWith("signup-funnel/live/2026-10-29/")).length, 0, "and its shards are gone");
    assert.equal(keys.filter((k) => k.startsWith("signup-funnel/live/parts/2026-10-30/")).length, 1, "today's settled shards are one part");
    assert.equal(keys.filter((k) => k.startsWith("signup-funnel/live/2026-10-30/")).length, 2, "the fresh ones wait");
    // a second read sees the same records from the folded files
    const second = await funnel.report({ env: "live", since: "2026-10-29T00:00:00Z", now: now + 1000 });
    assert.equal(second.records, 50);
    // two reports that folded the same shards at once leave a duplicate part; the ids keep it from counting twice
    const part = keys.find((k) => k.startsWith("signup-funnel/live/parts/"));
    store.set(part.replace(/\.json$/, "-copy.json"), store.get(part));
    const third = await funnel.report({ env: "live", since: "2026-10-29T00:00:00Z", now: now + 2000 });
    assert.equal(third.records, 50);
    // a window is cut at its instant, not at the UTC day: "today" in Copenhagen starts 23:00 UTC the day before
    const today = await funnel.report({ env: "live", since: "2026-10-30T11:55:00Z", now: now + 3000 });
    assert.equal(today.records, 2);
  } finally {
    global.fetch = realFetch;
    if (realToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = realToken;
  }
});

// ---- Klaviyo ----

const { reconcile } = require("../server/signup/klaviyo-reconcile");

function fakeKlaviyo(accounts) {
  // accounts: { <key>: { events: { <metric>: [...] }, lists: { <listId>: [profiles] } } }
  return async (url, opts) => {
    const key = opts.headers.Authorization.replace("Klaviyo-API-Key ", "");
    const a = accounts[key];
    const u = new URL(url);
    const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data, links: {} }) });
    if (u.pathname === "/api/metrics") return ok(Object.keys(a.events).map((name) => ({ id: `m-${name}`, attributes: { name } })));
    if (u.pathname === "/api/events") {
      const metric = /metric_id,"m-([^"]+)"/.exec(u.searchParams.get("filter"))[1];
      return ok(a.events[metric] || []);
    }
    const list = /^\/api\/lists\/([^/]+)\/profiles$/.exec(u.pathname);
    if (list) return ok(a.lists[list[1]] || []);
    return { ok: false, status: 404, json: async () => ({}) };
  };
}
const event = (pid, props) => ({ attributes: { event_properties: props, datetime: "2026-10-30T10:00:00Z" }, relationships: { profile: { data: { id: pid } } } });
const member = (concept, market, at, consent = "SUBSCRIBED") => ({ attributes: { joined_group_at: at, properties: { wp_signup_concept: concept, wp_signup_market: market }, subscriptions: { email: { marketing: { consent, custom_method_detail: `Westpack Signup Lab · ${concept}` } } } } });

test("Klaviyo: live counts each market's own list, test counts the TEST list, a person counts once, and the two never mix", async () => {
  const dk = MARKETS.dkk_dk_den;
  const de = MARKETS.eur_eu_ger;
  const accounts = {
    dkKey: {
      events: {
        "Signup Lab Subscribed": [
          event("p1", { wp_signup_concept: "logo-studio", wp_signup_market: "DK" }), // before the list was named: a test
          event("p1", { wp_signup_concept: "logo-studio", wp_signup_market: "DK" }), // the same person twice
          event("p2", { wp_signup_concept: "logo-studio", wp_signup_market: "FR", wp_signup_list: TEST_TARGET.listId }),
          event("p3", { wp_signup_concept: "logo-studio", wp_signup_market: "DK", wp_signup_list: dk.listId }),
        ],
        "Manually Suppressed from Email Marketing": [event("p2", { method: "BOT_PROTECTION" }), event("p3", { method: "MANUAL" })],
      },
      lists: {
        [TEST_TARGET.listId]: [member("logo-studio", "DK", "2026-10-30T10:00:00+00:00")],
        [dk.listId]: [member("logo-studio", "DK", "2026-10-29T23:30:00+00:00"), member("swipe-match", "DK", "2026-10-30T09:00:00+00:00", "UNSUBSCRIBED"), { attributes: { joined_group_at: "2026-10-30T09:00:00+00:00", properties: {}, subscriptions: { email: { marketing: { consent: "SUBSCRIBED", custom_method_detail: "The Insert" } } } } }],
      },
    },
    deKey: { events: {}, lists: { [de.listId]: [] } },
  };
  const fetchImpl = fakeKlaviyo(accounts);
  const keys = { DK: "dkKey", DE: "deKey" };
  const markets = [dk, de];
  const test = await reconcile({ env: "test", markets, keys, testTarget: TEST_TARGET, since: "2026-10-17T00:00:00Z", fetchImpl });
  assert.deepEqual(test.total, { submitted: 2, confirmed: 1, botBlocked: 1 });
  assert.deepEqual(test.markets.FR, { submitted: 1, confirmed: 0, botBlocked: 1 }, "a test made on the FR store counts under FR");
  const live = await reconcile({ env: "live", markets, keys, testTarget: TEST_TARGET, since: "2026-10-17T00:00:00Z", fetchImpl });
  assert.deepEqual(live.total, { submitted: 1, confirmed: 1, botBlocked: 0 }, "only the live signup; the unsubscribed one and The Insert's are not the lab's");
  assert.deepEqual(live.days, { "2026-10-30": 1 }, "23:30 UTC on the 29th is the 30th in Copenhagen");
  assert.deepEqual(live.markets.DE, undefined);
  assert.deepEqual(live.errors, {});
  const missingKey = await reconcile({ env: "live", markets, keys: { DK: "dkKey" }, testTarget: TEST_TARGET, since: "2026-10-17T00:00:00Z", fetchImpl });
  assert.match(missingKey.errors.DE, /no Klaviyo key/);
});

test("the signup event names the list it went to, and a concept cannot rename it", () => {
  const market = MARKETS.dkk_dk_den;
  const live = rules.buildCompletionEvent({ market, concept: "logo-studio", email: "a@b.dk", properties: { wp_signup_list: "XXXXXX", wp_brand_name: "Atelier" } });
  assert.equal(live.body.data.attributes.properties.wp_signup_list, market.listId);
  assert.equal(live.body.data.attributes.properties.wp_brand_name, "Atelier");
  const test = rules.buildCompletionEvent({ market, target: TEST_TARGET, concept: "logo-studio", email: "a@b.dk" });
  assert.equal(test.body.data.attributes.properties.wp_signup_list, TEST_TARGET.listId);
  assert.ok(test.url.includes(TEST_TARGET.companyId));
});

// ---- the page ----

test("the Signup Lab is a group of its own - Control, Signups, Preview - and Klaviyo's forms are under Klaviyo email", () => {
  const html = read("index.html");
  assert.match(html, /id="wp-nav-label-signup">Signup Lab</);
  for (const view of ["control", "signups", "preview"]) {
    assert.match(html, new RegExp(`data-signup-view="${view}" data-nav-workspace="signup"`));
    assert.match(html, new RegExp(`data-signup-panel="${view}"`));
  }
  assert.doesNotMatch(html, /data-signup-view="forms"/);
  assert.match(html, /data-klaviyo-view="signup_forms" data-nav-workspace="klaviyo"/);
  assert.match(html, /id="klaviyo-signup-forms-panel"/);
  assert.match(html, /id="signup-product-panel"/);
  const app = read("app.js");
  assert.match(app, /import \{ initSignupLab, showSignupLabView, signupLabViewFromHash, leaveSignupLab \} from "\.\/src\/signup-lab\.js\?v=/);
  assert.match(app, /appState\.workspace = \["klaviyo", "agents", "signup"\]\.includes\(nextWorkspace\) \? nextWorkspace : "meta";/);
  assert.match(app, /getElementById\("signup-product-panel"\)\?\.classList\.toggle\("active", appState\.workspace === "signup"\)/);
  assert.match(app, /if \(appState\.workspace === "signup"\) \{\r?\n\s+showSignupLabView\(appState\.signupView\);\r?\n\s+\} else \{\r?\n\s+leaveSignupLab\(\);/);
  // the Klaviyo view is known to both lists that decide which Klaviyo views exist, or the rail and the page disagree
  assert.match(app, /"subject_lines", "signup_forms"\]\.includes\(nextView\)/);
  assert.match(app, /getElementById\("klaviyo-signup-forms-panel"\)\?\.classList\.toggle\("active", appState\.klaviyoView === "signup_forms"\)/);
  assert.match(read("src/klaviyo-dashboard-domain.js"), /"subject_lines", "signup_forms"\]\.includes\(appState\.klaviyoView\)/);
  // the address opens it: set before initializeApp opens the workspace
  assert.match(app, /const signupLabView = signupLabViewFromHash\(window\.location\.hash\);\r?\n\s+if \(signupLabView\) \{\r?\n\s+appState\.workspace = "signup";/);
  // the rail may show one current item: the Signup Lab clears the platform groups' highlight like Agents does
  const css = read("design-system.css");
  assert.match(css, /body\[data-workspace="signup"\] \.tab-button\.active,\r?\nbody\[data-workspace="signup"\] \.subnav-button\.active \{/);
  assert.ok(!fs.existsSync(path.join(ROOT, "src", "signup-control.js")), "the old module is gone");
});

test("the page confirms anything that reaches live visitors or Klaviyo, proves what the stores are served, and its preview is never counted", () => {
  const ui = read("src/signup-lab.js");
  assert.match(ui, /if \(\["live", "market", "reach"\]\.includes\(change\.type\)\) return true;/);
  assert.match(ui, /return change\.type === "current" && change\.env === "live" && state\.status\?\.control\?\.live\?\.on;/);
  assert.match(ui, /Unpublishes The Insert popup in \$\{f\.market\}/);
  // every change carries what the page saw, so it cannot silently undo someone else's
  assert.match(ui, /body: \{ change, expect \}/);
  // what the stores are served is read the way a store reads it
  assert.match(ui, /call\("\/api\/signup\/control", \{ query: \{ action: "config" \}, cache: "no-store" \}\)/);
  // the preview frame is told not to track: a preview is not a visitor
  assert.match(ui, /const q = new URLSearchParams\(\{ market: p\.market, concept: previewConcept\(\), open: p\.open, reset: "1", track: "" \}\);/);
  assert.match(read("signup/preview/frame.html"), /if \(q\.has\("track"\)\) s\.dataset\.track = q\.get\("track"\);/);
  // the signups view opens on live only when live is on
  assert.match(ui, /return state\.status\?\.control\?\.live\?\.on \? "live" : "test";/);
  // the forms page never writes to Klaviyo
  const forms = read("src/klaviyo-signup-forms.js");
  assert.doesNotMatch(forms, /action: "change"|setPublished|publish-job/);
});

// The browser module is ESM with browser imports, so its pure helpers are lifted out and run here.
function lift(src, name) {
  const start = src.indexOf(`function ${name}(`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1).replace(/^export /, "");
}

test("the Signup Lab's address and its windows: #signup-lab opens a view, and today starts at midnight in Copenhagen", () => {
  const ui = read("src/signup-lab.js");
  const VIEWS = ["control", "signups", "preview"];
  const fromHash = Function("VIEWS", `${lift(ui, "signupLabViewFromHash")}; return signupLabViewFromHash;`)(VIEWS);
  assert.equal(fromHash("#signup-lab"), "control");
  assert.equal(fromHash("#signup-lab/signups"), "signups");
  assert.equal(fromHash("#signup-lab/preview"), "preview");
  assert.equal(fromHash("#signup-lab/forms"), null);
  assert.equal(fromHash("#canva-localizer"), null);
  const LOCAL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" });
  const rangeSince = Function("LOCAL_DAY", `${lift(ui, "rangeSince")}; return rangeSince;`)(LOCAL_DAY);
  assert.equal(rangeSince("today", Date.parse("2026-10-30T12:00:00Z")), "2026-10-29T23:00:00.000Z", "winter time: UTC+1");
  assert.equal(rangeSince("today", Date.parse("2026-07-01T12:00:00Z")), "2026-06-30T22:00:00.000Z", "summer time: UTC+2");
  assert.equal(rangeSince("7d", Date.parse("2026-10-30T12:00:00Z")), "2026-10-23T22:00:00.000Z", "seven Danish days, the first of them still in summer time");
  assert.equal(rangeSince("today", Date.parse("2026-10-29T23:30:00Z")), "2026-10-29T23:00:00.000Z", "half past midnight in Copenhagen is already the 30th");
});
