// The Signup page: what the script on the stores runs is set in the app, the stores only ever see on/off, the
// experience and the markets, and live can only reach a store that carries the tag - where its Insert popup comes
// down, and comes back up when live stops.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const control = require("../server/signup/control");
const { readTag, readKlaviyoIds, checkStores } = require("../server/signup/store-check");
const { LIVE, CURRENT } = require("../signup/core/markets");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const installed = (c, markets) => ({ ...c, storeCheck: { at: "x", live: Object.fromEntries(markets.map((m) => [m, { tag: "yes", klaviyo: [] }])) } });

test("with nothing saved, the control is what signup/core/markets.js says, so the stores behave as before", () => {
  const c = control.normalizeControl(null);
  assert.equal(c.live.on, LIVE);
  assert.equal(c.live.current, CURRENT);
  assert.equal(c.staging.current, CURRENT);
  assert.equal(c.staging.on, true);
  assert.equal(Object.keys(c.live.markets).length, 18);
  assert.ok(Object.values(c.live.markets).every(Boolean));
});

test("a stored document with nonsense in it is read as the defaults, field by field", () => {
  const c = control.normalizeControl({ v: 1, live: { on: "yes", current: "spin-to-win", markets: { DK: false, XX: false } }, staging: { current: "pack-and-ship" }, insert: { unpublished: [{ market: "DK", id: "SPPrjA" }, { market: "ZZ", id: "nope" }] } });
  assert.equal(c.live.on, LIVE);
  assert.equal(c.live.current, CURRENT);
  assert.equal(c.live.markets.DK, false);
  assert.equal(c.live.markets.XX, undefined);
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
  for (const secret of ["SPPrjA", "history", "storeCheck", "insert", "Popup"]) assert.ok(!text.includes(secret), secret);
});

test("live cannot be switched on before a live store carries the tag", () => {
  const c = control.normalizeControl(null);
  assert.throws(() => control.applyChange(c, { type: "live", on: true }), /No live store carries the tag/);
  // a store with only the test tag does not count
  const testOnly = { ...c, storeCheck: { live: { DK: { tag: "test-only" } } } };
  assert.throws(() => control.applyChange(testOnly, { type: "live", on: true }), /No live store carries the tag/);
  // nor does a store that carries it but is switched off
  const off = control.applyChange(installed(c, ["DK"]), { type: "market", market: "DK", on: false }).control;
  assert.throws(() => control.applyChange(off, { type: "live", on: true }), /No live store carries the tag/);
  assert.equal(control.applyChange(installed(c, ["DK"]), { type: "live", on: true }).control.live.on, true);
});

test("every change is checked, says what it did, and is kept in a bounded history", () => {
  let c = control.normalizeControl(null);
  assert.throws(() => control.applyChange(c, { type: "current", env: "live", concept: "spin-to-win" }), /Unknown experience/);
  assert.throws(() => control.applyChange(c, { type: "current", env: "live", concept: CURRENT }), /already runs/);
  assert.throws(() => control.applyChange(c, { type: "market", market: "XX", on: false }), /Unknown market/);
  assert.throws(() => control.applyChange(c, { type: "drop_tables" }), /Unknown change/);
  const r = control.applyChange(c, { type: "current", env: "staging", concept: "swipe-match" });
  assert.equal(r.control.staging.current, "swipe-match");
  assert.equal(r.control.live.current, CURRENT, "staging can run another experience than live");
  assert.match(r.text, /Staging now runs Swipe match \(was Logo studio\)/);
  assert.equal(r.control.history[0].text, r.text);
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
  c = control.applyChange(c, { type: "market", market: "DE", on: false }).control;
  plan = control.insertPlan(c, { DK: [{ id: "SPPrjA", name: "x", status: "draft" }] });
  assert.deepEqual(plan.republish.map((f) => f.id), ["Uf83fC"]);
  assert.deepEqual(plan.unpublish, []);
  c = control.recordInsertResults(c, [{ action: "republish", market: "DE", id: "Uf83fC", ok: true }]);
  assert.deepEqual(c.insert.unpublished.map((f) => f.id), ["SPPrjA"]);
  // live off: everything this page took down goes back, and nothing else
  c = control.applyChange(c, { type: "live", on: false }).control;
  plan = control.insertPlan(c, {});
  assert.deepEqual(plan.republish.map((f) => f.id), ["SPPrjA"]);
  // a failed publish stays recorded, so the next change tries again
  c = control.recordInsertResults(c, [{ action: "republish", market: "DK", id: "SPPrjA", ok: false }]);
  assert.deepEqual(c.insert.unpublished.map((f) => f.id), ["SPPrjA"]);
  assert.match(c.history[0].text, /FAILED: published again The Insert in DK/);
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

test("the API: config is public, cached at the edge and readable from any store; everything else needs a login", () => {
  const api = read("api/signup/control.js");
  assert.match(api, /if \(action === "config"\) \{\s*res\.setHeader\("Access-Control-Allow-Origin", "\*"\);/);
  assert.match(api, /"public, max-age=30, s-maxage=30, stale-while-revalidate=300"/);
  assert.match(api, /const out = control\.publicConfig\(await readSignupControl\(\)\);/);
  // a failed read is not an answer: the script then falls back to the file, which keeps live off
  assert.match(api, /return sendJson\(res, 503, \{ error: "Control could not be read\." \}\);/);
  const afterConfig = api.slice(api.indexOf('if (!requireAuth(req, res, config)) return;'));
  for (const action of ['"status"', '"change"', '"store_check"', '"forms"']) assert.ok(afterConfig.includes(`action === ${action}`), action);
  // a market whose popups cannot be read does not go live; the switch is written before the popups change
  assert.match(api, /Could not read The Insert popups in .* - nothing was changed\./);
  assert.ok(api.indexOf("await writeSignupControl(next);") < api.indexOf("setPublished(keys[f.market], f.id, false)"));
  // the stores' copy is read from Blob alone, never through the full Redis
  assert.match(read("server/meta/historical-store.js"), /const readSignupControl = async \(\) => \(getHistoricalStoreProfile\(\)\.mode === "blob" \? blobRead\(SIGNUP_CONTROL_STORE_KEY\)/);
});

test("the Signup group sits in the rail with its own page, and the workspace switch knows it", () => {
  const html = read("index.html");
  assert.match(html, /id="wp-nav-label-signup">Signup</);
  for (const view of ["control", "results", "forms", "preview"]) {
    assert.match(html, new RegExp(`data-signup-view="${view}" data-nav-workspace="signup"`));
    assert.match(html, new RegExp(`data-signup-panel="${view}"`));
  }
  assert.match(html, /id="signup-product-panel"/);
  const app = read("app.js");
  assert.match(app, /import \{ initSignupControl, showSignupView \} from "\.\/src\/signup-control\.js\?v=/);
  assert.match(app, /appState\.workspace = \["klaviyo", "agents", "signup"\]\.includes\(nextWorkspace\) \? nextWorkspace : "meta";/);
  assert.match(app, /getElementById\("signup-product-panel"\)\?\.classList\.toggle\("active", appState\.workspace === "signup"\)/);
  assert.match(app, /if \(appState\.workspace === "signup"\) \{\r?\n\s+showSignupView\(appState\.signupView\);/);
  // the rail may show one current item: Signup clears the platform groups' highlight like Agents does
  const css = read("design-system.css");
  assert.match(css, /body\[data-workspace="signup"\] \.tab-button\.active,\r?\nbody\[data-workspace="signup"\] \.subnav-button\.active \{/);
  // anything that reaches live visitors or Klaviyo is confirmed first; the copy says what changes
  const ui = read("src/signup-control.js");
  assert.match(ui, /if \(\["live", "market"\]\.includes\(change\.type\)\) return true;/);
  assert.match(ui, /Unpublishes The Insert popup in \$\{f\.market\}/);
});
