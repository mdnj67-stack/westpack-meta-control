// Westpack Signup Lab: the rules that decide who sees what, what reaches Klaviyo, and what reaches analytics.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const R = require("../signup/core/rules");
const { MARKETS, TEST_TARGET } = require("../signup/core/markets");
const COPY_DIR = path.join(ROOT, "signup", "core", "copy");
const DAY = 86400000;

function loadCopy(lang) {
  const sandbox = {}; sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(COPY_DIR, `${lang}.js`), "utf8"), sandbox);
  return sandbox.WestpackSignupCopy[lang];
}
function shape(o) {
  if (Array.isArray(o)) return `[${o.length}]`;
  if (o && typeof o === "object") return `{${Object.keys(o).filter((k) => k !== "meta").sort().map((k) => `${k}:${shape(o[k])}`).join(",")}}`;
  return "s";
}
const placeholders = (o) => JSON.stringify(o).match(/\{[a-z]+\}/g)?.sort().join("") || "";

test("every store resolves to its market from the first path segment", () => {
  assert.equal(R.resolveMarket("/dkk_dk_den/jewellery-boxes.html", MARKETS).market, "DK");
  assert.equal(R.resolveMarket("/eur_eu_ger/schmuckschachteln.html", MARKETS).market, "DE");
  assert.equal(R.resolveMarket("/usd_us_eng/", MARKETS).market, "US");
  assert.equal(R.resolveMarket("/not_a_store/", MARKETS), null);
  assert.equal(R.resolveMarket("/", MARKETS), null);
});

test("every market carries what a lawful signup needs", () => {
  assert.equal(Object.keys(MARKETS).length, 18);
  for (const [code, m] of Object.entries(MARKETS)) {
    assert.match(m.companyId, /^[A-Za-z0-9]{6}$/, `${code} public key`);
    assert.match(m.listId, /^[A-Za-z0-9]{6}$/, `${code} list`);
    assert.ok(m.consent.length > 80, `${code} consent text`);
    assert.ok(m.consent.includes(m.privacyLink), `${code} consent links its privacy words`);
    assert.match(m.privacyUrl, new RegExp(`^https://www\\.westpack\\.com/${code}/westpack-gdpr$`));
    assert.ok(["single", "double"].includes(m.optIn), `${code} opt-in`);
    assert.ok(fs.existsSync(path.join(COPY_DIR, `${m.lang}.js`)), `${code} has copy for ${m.lang}`);
  }
  assert.equal(TEST_TARGET.listId, "WUDjfX");
});

test("no private key, and no newsletter list as the test target", () => {
  const files = ["signup/westpack-signup.js", "signup/core/markets.js", "signup/core/rules.js", ...fs.readdirSync(path.join(ROOT, "signup", "concepts")).map((f) => `signup/concepts/${f}`)];
  for (const f of files) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), "utf8"), /pk_[a-z0-9]{20,}/i, `${f} contains a private key`);
  assert.ok(!Object.values(MARKETS).some((m) => m.listId === TEST_TARGET.listId));
});

test("every language has every key and placeholder of the masters", () => {
  const master = loadCopy("en");
  const langs = fs.readdirSync(COPY_DIR).map((f) => f.replace(/\.js$/, ""));
  assert.ok(langs.length >= 17);
  for (const lang of langs) {
    const c = loadCopy(lang);
    assert.equal(shape(c), shape(master), `${lang} keys`);
    assert.equal(placeholders(c), placeholders(master), `${lang} placeholders`);
    assert.ok(c.meta && c.meta.status, `${lang} says whether it is master or transcreated`);
  }
});

test("no copy makes an environmental claim or a delivery promise", () => {
  for (const f of fs.readdirSync(COPY_DIR)) {
    const c = loadCopy(f.replace(/\.js$/, ""));
    const text = JSON.stringify({ ...c, meta: undefined });
    assert.doesNotMatch(text, /\b(eco|öko|sustainab|bæredygtig|nachhaltig|durable|sostenib|recycl|genbrug|fsc)\b/i, `${f}: environmental wording`);
    assert.doesNotMatch(text, /\b(delivered in|leveret på|levering inden|delivery in)\b/i, `${f}: delivery promise`);
  }
});

test("experience code carries no shop copy of its own", () => {
  // every visible word comes from core/copy, so a market is never translated by editing a popup
  for (const f of fs.readdirSync(path.join(ROOT, "signup", "concepts")).filter((x) => x.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(ROOT, "signup", "concepts", f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(src, /[æøåÆØÅ]/, `${f} has Danish text in code`);
    assert.doesNotMatch(src, /text: "[A-Z][a-z]+ [a-z]+/, `${f} has a hard-coded sentence`);
  }
});

test("eligibility: subscribers, email visitors, identified visitors and excluded pages never see it", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  const base = { now, excludedPath: false, emailVisit: false, identified: false, shownThisSession: false, consentBannerOpen: false };
  assert.equal(R.eligibility(R.freshState(), base).ok, true);
  assert.equal(R.eligibility({ ...R.freshState(), subscribedAt: now - DAY }, base).reason, "subscribed");
  assert.equal(R.eligibility(R.freshState(), { ...base, emailVisit: true }).reason, "email_visitor");
  assert.equal(R.eligibility({ ...R.freshState(), emailVisitAt: now - 10 * DAY }, base).reason, "email_visitor");
  assert.equal(R.eligibility(R.freshState(), { ...base, identified: true }).reason, "identified");
  assert.equal(R.eligibility(R.freshState(), { ...base, excludedPath: true }).reason, "excluded_page");
  assert.equal(R.eligibility(R.freshState(), { ...base, shownThisSession: true }).reason, "shown_this_session");
  const banner = R.eligibility(R.freshState(), { ...base, consentBannerOpen: true });
  assert.equal(banner.reason, "consent_banner_open"); assert.equal(banner.retry, true);
});

test("closing backs off: 14 days, then 45, then 120", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  const base = { now, excludedPath: false, emailVisit: false, identified: false, shownThisSession: false, consentBannerOpen: false };
  const after = (closes, days) => R.eligibility({ v: 1, closes, lastCloseAt: now - days * DAY }, base).ok;
  assert.equal(after(1, 13), false); assert.equal(after(1, 15), true);
  assert.equal(after(2, 44), false); assert.equal(after(2, 46), true);
  assert.equal(after(3, 119), false); assert.equal(after(5, 121), true);
});

test("checkout, cart, account, newsletter page, sale and outlet pages are excluded in every store's language", () => {
  for (const p of ["/eur_eu_ger/checkout/", "/dkk_dk_den/checkout/cart/", "/gbp_uk_eng/customer/account/login/", "/eur_eu_fra/newsletter-signup",
    "/dkk_dk_den/sale.html", "/eur_eu_ger/sale/jewellery-boxes.html", "/nok_no_nor/smykkeesker/outlet-jewellery-boxes.html", "/pln_pl_pol/pudelka-na-bizuterie/outlet-jewellery-boxes.html"]) {
    assert.equal(R.isExcludedPath(p), true, p);
  }
  for (const p of ["/dkk_dk_den/", "/eur_eu_ger/schmuckschachteln.html", "/gbp_uk_eng/jewellery-boxes/cardboard-jewellery-boxes/boston.html"]) assert.equal(R.isExcludedPath(p), false, p);
});

test("phones get a card they choose to open; desktops get the dialog", () => {
  assert.equal(R.triggerPlan("mobile", 1).mode, "peek");
  assert.equal(R.triggerPlan("tablet", 1).mode, "peek");
  const d = R.triggerPlan("desktop", 1);
  assert.equal(d.mode, "dialog"); assert.equal(d.exitIntent, true); assert.ok(d.delayMs >= 6000);
});

test("one experience runs at a time: CURRENT alone in every market, and a visitor on another one moves to it", () => {
  const { CURRENT, MARKETS } = require("../signup/core/markets");
  assert.ok(R.CONCEPT_IDS.includes(CURRENT));
  for (const m of Object.values(MARKETS)) assert.deepEqual(Object.entries(m.concepts).filter(([, w]) => w > 0).map(([id]) => id), [CURRENT], m.market);
  const moved = R.assignConcept({ concept: "pack-and-ship" }, MARKETS.dkk_dk_den.concepts, 0.9);
  assert.equal(moved.concept, CURRENT);
  assert.equal(moved.assigned, true);
  // a preview still opens any of the three
  assert.equal(R.assignConcept({}, MARKETS.dkk_dk_den.concepts, 0.1, "swipe-match").concept, "swipe-match");
});

test("A/B: a visitor keeps their experience, and the split follows the weights", () => {
  const w = { "logo-studio": 1, "swipe-match": 1, "pack-and-ship": 1 };
  assert.deepEqual(R.assignConcept({ concept: "swipe-match" }, w, 0.01), { concept: "swipe-match", assigned: false });
  assert.equal(R.assignConcept({ concept: "swipe-match" }, { "logo-studio": 1 }, 0.5).concept, "logo-studio");
  const counts = {}; for (let i = 0; i < 3000; i++) { const c = R.pickConcept(w, i / 3000); counts[c] = (counts[c] || 0) + 1; }
  for (const c of Object.keys(w)) assert.ok(Math.abs(counts[c] - 1000) <= 2, `${c} ${counts[c]}`);
  assert.equal(R.pickConcept({ "logo-studio": 0 }, 0.5), null);
});

test("email validation turns away what Klaviyo would reject", () => {
  for (const ok of ["name@company.com", "a.b+c@westpack.dk", "ida@firma.co.uk"]) assert.equal(R.isValidEmail(ok), true, ok);
  for (const bad of ["", "name", "name@", "@company.com", "name@company", "name@@company.com", "na me@company.com", "name@company..com", "name@.company.com"]) assert.equal(R.isValidEmail(bad), false, bad);
});

test("a signup goes to the market's list with consent, the store's consent sentence and only whitelisted properties", () => {
  const m = MARKETS.eur_eu_ger;
  const req = R.buildSubscription({ market: m, email: "  name@company.com ", concept: "logo-studio", properties: { wp_brand_name: "Atelier", secret: "x", wp_logo_finish: "gold" }, organization: "Atelier", pageUrl: "https://www.westpack.com/eur_eu_ger/x.html?utm_source=a&email=b#c" });
  assert.equal(req.url, "https://a.klaviyo.com/client/subscriptions?company_id=T2raST");
  const a = req.body.data.attributes;
  assert.equal(req.body.data.relationships.list.data.id, "WaGU4J");
  assert.equal(a.custom_source, "Westpack Signup Lab · logo-studio");
  const p = a.profile.data.attributes;
  assert.equal(p.email, "name@company.com");
  assert.equal(p.locale, "de-DE");
  assert.equal(p.organization, "Atelier");
  assert.deepEqual(p.subscriptions, { email: { marketing: { consent: "SUBSCRIBED" } } });
  assert.equal(p.properties.wp_consent_text, m.consent);
  assert.equal(p.properties.wp_consent_page, "https://www.westpack.com/eur_eu_ger/x.html", "query and hash never leave the page");
  assert.equal(p.properties.secret, undefined);
  assert.equal(p.properties.wp_brand_name, "Atelier");
  const t = R.buildSubscription({ market: m, target: TEST_TARGET, email: "a@b.co", concept: "pack-and-ship" });
  assert.equal(t.body.data.relationships.list.data.id, "WUDjfX");
  assert.match(t.url, /company_id=VRPp5S$/);
});

test("tracking never carries an email address or anything off the list", () => {
  const out = R.sanitizeTracking({ env: "live", market: "DK", lang: "da", concept: "swipe-match", variant: "swipe-match", device: "mobile", trigger: "peek", outcome: "subscribed",
    closeStep: "me@x.com", page: "home", steps: [{ n: "open", t: 10 }, { n: "a@b.dk", t: 20 }, { n: "subscribed", t: 9000 }], errors: ["network", "x@y.z"], email: "a@b.dk", ms: 9100, extra: { a: 1 } });
  assert.deepEqual(Object.keys(out).sort(), ["closeStep", "concept", "device", "env", "errors", "lang", "market", "ms", "outcome", "page", "reduced", "steps", "trigger", "v", "variant"]);
  assert.ok(!JSON.stringify(out).includes("@"));
  assert.equal(out.closeStep, "");
  assert.deepEqual(out.steps.map((s) => s.n), ["open", "subscribed"]);
  assert.equal(R.sanitizeTracking({ market: "DK", concept: "not-a-concept" }), null);
});

test("the consent sentence splits around its privacy link", () => {
  const p = R.consentParts(MARKETS.dkk_dk_den);
  assert.equal(p.link, "persondatapolitik");
  assert.equal(p.before + p.link + p.after, MARKETS.dkk_dk_den.consent);
});

test("the funnel aggregates exposures into rates per experience", () => {
  const { aggregate } = require("../server/signup/funnel-store");
  const rec = (concept, steps, outcome) => ({ concept, outcome, device: "mobile", market: "DK", steps: steps.map((n, i) => ({ n, t: i * 1000 })), errors: [] });
  const out = aggregate([
    rec("logo-studio", ["peek_shown", "open", "name_typed", "email_focus", "submit", "subscribed"], "subscribed"),
    rec("logo-studio", ["peek_shown", "open", "close_button"], "closed"),
    rec("swipe-match", ["peek_shown", "peek_dismissed"], "peek_dismissed"),
  ]);
  assert.equal(out.total.exposures, 3);
  assert.equal(out.concepts["logo-studio"].opened, 2);
  assert.equal(out.concepts["logo-studio"].interacted, 1);
  assert.equal(out.concepts["logo-studio"].subscribed, 1);
  assert.equal(out.concepts["logo-studio"].subscribedPerExposure, 0.5);
  assert.equal(out.concepts["swipe-match"].subscribed, 0);
});

test("the track endpoint never stores a live record from outside the store", async () => {
  const src = fs.readFileSync(path.join(ROOT, "api", "signup", "track.js"), "utf8");
  assert.match(src, /sanitizeTracking/);
  assert.match(src, /record\.env === "live" && !STORE_ORIGIN\.test\(origin\)/);
  assert.match(src, /requireAuth/);
});

test("every Signup Lab browser file parses", () => {
  const { execFileSync } = require("child_process");
  const files = ["signup/westpack-signup.js", "signup/core/rules.js", "signup/core/markets.js", ...fs.readdirSync(path.join(ROOT, "signup", "concepts")).filter((f) => f.endsWith(".js")).map((f) => `signup/concepts/${f}`), ...fs.readdirSync(COPY_DIR).map((f) => `signup/core/copy/${f}`)];
  for (const f of files) execFileSync(process.execPath, ["--check", path.join(ROOT, f)]);
});

// ---- logo studio: the measured lids ----
const LS_SRC = fs.readFileSync(path.join(ROOT, "signup", "concepts", "logo-studio.js"), "utf8");
const LIDS = Function(`return (${LS_SRC.slice(LS_SRC.indexOf("// lids:begin"), LS_SRC.indexOf("// lids:end")).replace(/^[^{]*/, "").trim().replace(/;$/, "")});`)();
// the same homography logo-studio.js and tools/signup/lid-geometry.js use, lifted from the shipped file
const homography = Function(`${LS_SRC.slice(LS_SRC.indexOf("  function homography(q)"), LS_SRC.indexOf("  function project("))}; return homography;`)();
const project = (m, u, v) => { const w = m.g * u + m.h * v + 1; return [(m.a * u + m.b * v + m.c) / w, (m.d * u + m.e * v + m.f) / w]; };
// the foils, lifted from the shipped file with the helpers that build them
const FOIL_TABLE = Function(`${LS_SRC.slice(LS_SRC.indexOf("  const hex = "), LS_SRC.indexOf("  const FOILS = {};"))}; return FOIL_TABLE;`)();

test("logo studio: every lid is measured, lit and named in every language", () => {
  const order = JSON.parse(LS_SRC.match(/const BOX_ORDER = (\[[^\]]*\])/)[1]);
  assert.deepEqual(order.slice().sort(), Object.keys(LIDS).sort());
  // the phone's own order (it opens on Torino) holds the same pieces, each once
  const phoneOrder = JSON.parse(LS_SRC.match(/const PHONE_ORDER = (\[[^\]]*\])/)[1]);
  assert.deepEqual(phoneOrder.slice().sort(), order.slice().sort());
  assert.equal(phoneOrder[0], "torino");
  for (const lang of fs.readdirSync(COPY_DIR).map((f) => f.replace(/\.js$/, ""))) {
    assert.deepEqual(Object.keys(loadCopy(lang)["logo-studio"].boxes).sort(), order.slice().sort(), `${lang} names every lid`);
  }
  for (const [id, l] of Object.entries(LIDS)) {
    assert.equal(l.quad.length, 4, `${id} quad`);
    assert.ok(l.aspect > 0.7 && l.aspect < 1.4, `${id} aspect ${l.aspect}`);
    assert.equal(l.light.length, 12, `${id} light rows`); assert.ok(l.light.every((r) => r.length === 12), `${id} light columns`);
    assert.ok(l.light.flat().every((f) => f > 0.6 && f < 1.5), `${id} light stays a gentle shading`);
    assert.ok(l.exposure.metal > 0.3 && l.exposure.metal <= 1.5 && l.exposure.pigment > 0.3 && l.exposure.pigment <= 1.5, `${id} exposure`);
    const [finish, colour] = l.foil.split("-");
    assert.ok(FOIL_TABLE[finish] && FOIL_TABLE[finish][colour], `${id} opens in a foil that exists (${l.foil})`);
    assert.ok(l.grain === null || /^(structured|linen|velour)$/.test(l.grain), `${id} grain`);
  }
});

test("logo studio: the homography lays the unit square exactly on each lid, and the print area inside the photo", () => {
  for (const [id, l] of Object.entries(LIDS)) {
    const m = homography(l.quad);
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
      const [x, y] = project(m, u, v);
      assert.ok(Math.abs(x - l.quad[i][0]) < 1e-6 && Math.abs(y - l.quad[i][1]) < 1e-6, `${id} corner ${i}`);
    });
    const p = l.print;
    assert.ok(p.cx - p.w / 2 >= 0 && p.cx + p.w / 2 <= 1 && p.cy - p.h / 2 >= 0 && p.cy + p.h / 2 <= 1, `${id} print area on the lid`);
    // the whole print area is in the photo and above the caption, so a square logo at full size is never cut off
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [x, y] = project(m, p.cx + (a * p.w) / 2, p.cy + (b * p.h) / 2);
      assert.ok(x > 1 && x < 99 && y > 1 && y < 91, `${id} print corner at ${x.toFixed(1)}, ${y.toFixed(1)} is in the photo, above the caption`);
    }
    // the lid surface is convex and the projection never folds over (w stays positive on the lid)
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]) assert.ok(m.g * u + m.h * v + 1 > 0, `${id} w at ${u},${v}`);
  }
});

test("a staging store runs the Signup Lab whatever the switch says, and can only reach the test list", () => {
  const { STAGING_HOSTS } = require("../signup/core/markets");
  assert.ok(STAGING_HOSTS.includes("westpack-staging.wexohosting.com"));
  // a live store on the staging list would run before launch, against real visitors, on the test list
  assert.ok(!STAGING_HOSTS.some((h) => /(^|\.)westpack\.[a-z.]+$/.test(h)), "no live store host on the staging list");
  const runtime = fs.readFileSync(path.join(ROOT, "signup", "westpack-signup.js"), "utf8");
  assert.match(runtime, /const staging = \(M\.STAGING_HOSTS \|\| \[\]\)\.includes\(location\.hostname\);\r?\n    if \(staging && market\) \{\r?\n      OPTS\.test = true;/);
  // ?wps=reset forgets this browser's answers and is never read as an experience to preview
  assert.match(runtime, /const storePreview = resetAsked \? "" : wps;/);
});

test("the app's Signup page decides whether the stores run the Signup Lab, the file is the fallback, and ?wps= previews it", () => {
  const { LIVE } = require("../signup/core/markets");
  assert.equal(typeof LIVE, "boolean");
  const runtime = fs.readFileSync(path.join(ROOT, "signup", "westpack-signup.js"), "utf8");
  // the control is read from the app; unreadable, the file decides (LIVE), and a preview needs neither
  assert.match(runtime, /controlUrl: data\.control !== undefined \? data\.control : new URL\("\.\.\/api\/signup\/control\?action=config", BASE\)\.href/);
  assert.match(runtime, /const ctl = market && OPTS\.mode !== "preview" && !OPTS\.storePreview \? await readControl\(\) : null;/);
  assert.match(runtime, /const on = side \? Boolean\(side\.on && \(staging \|\| !side\.markets \|\| side\.markets\[market\.market\] !== false\)\) : M\.LIVE \|\| staging;/);
  // a read that hangs is given up on, and anything but a v1 answer counts as no answer
  assert.match(runtime, /setTimeout\(\(\) => abort\.abort\(\), 2500\)/);
  assert.match(runtime, /return json && json\.v === 1 \? json : null;/);
  // off: the tag does nothing, except a store preview; a preview is always test mode, so it can only reach the test list
  assert.match(runtime, /if \(!market \|\| \(!\(on && market\.enabled\) && OPTS\.mode !== "preview" && !OPTS\.storePreview\)\) return;/);
  assert.match(runtime, /const pick = R\.assignConcept\(state, weights, Math\.random\(\), OPTS\.concept\);/);
  assert.match(runtime, /test: data\.test === "1" \|\| data\.mode === "preview" \|\| Boolean\(storePreview\)/);
  assert.match(runtime, /get\("wps"\)/);
  // go-live touches only The Insert popups and needs --apply to touch anything
  const goLive = fs.readFileSync(path.join(ROOT, "tools", "signup", "go-live.js"), "utf8");
  assert.ok(goLive.includes("const INSERT = / - Popup - The Insert\\b/;"));
  assert.match(goLive, /const apply = process\.argv\.includes\("--apply"\);/);
});

test("logo studio offers the 26 foils of Westpack's logo module in the module's own colours, named in every language, and no deboss", () => {
  // the logo module on the product pages (colorOptionsData, the same in all 18 stores, read 2026-11-20): its three
  // finishes in its order; matt and gloss in each foil's hex_color, a metal in the middle tone of its swatch photo
  // (the module's picker shows the photo, and a metal's hex is far off it). "Debossing without foil" is the one left
  // out (deboss removed 2026-10-29); "Debossing with foil" is the transparent foil.
  const want = {
    metallic: { gold: "#c29d2a", silver: "#c0c0c0", copper: "#b3744b", red: "#ac0101", orange: "#c17403", pink: "#bf39b1", purple: "#9e01ac", blue: "#016fc1", mint: "#03aa8d" },
    gloss: { black: "#161616", grey: "#969595", brown: "#765341", pink: "#D88CBA", mint: "#33D3B9" },
    matt: { black: "#141414", white: "#FDFDFD", darkblue: "#284467", blue: "#3C90C3", green: "#3D8F3B", oldrose: "#C09B8C", orange: "#F09031", red: "#F52516", winered: "#8C3039", purple: "#8C1CC6", yellow: "#F5E316", clear: null },
  };
  assert.deepEqual(Object.keys(FOIL_TABLE), Object.keys(want));
  for (const [finish, colours] of Object.entries(want)) {
    assert.deepEqual(Object.keys(FOIL_TABLE[finish]).sort(), Object.keys(colours).sort(), finish);
    for (const [colour, hexColor] of Object.entries(colours)) {
      const f = FOIL_TABLE[finish][colour];
      if (hexColor === null) { assert.equal(f.clear, true, `${finish}-${colour} is the clear glaze`); continue; }
      assert.equal(f.base, hexColor, `${finish}-${colour} is the module's colour`);
      // a matt foil is the module's colour flat; a metal or gloss foil runs its light levels through that colour
      if (finish === "matt") assert.equal(f.color, hexColor);
      else assert.ok(f.stops.length === 8 && (finish !== "gloss" || f.stops[1].toLowerCase() === hexColor.toLowerCase()), `${finish}-${colour} stops`);
    }
  }
  // the module's gold renders as bright as the gold measured on Westpack's demo prints, which the lid exposures are
  // calibrated against: its shadow, body and highlight
  const lum = (c) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  ["#4a3214", "#9a7238", "#e6c27a"].forEach((m, i) => assert.ok(Math.abs(lum(FOIL_TABLE.metallic.gold.stops[i]) - lum(m)) < 3, `gold stop ${i}: ${FOIL_TABLE.metallic.gold.stops[i]} against ${m}`));
  const colourKeys = [...new Set(Object.values(want).flatMap((c) => Object.keys(c)))].sort();
  for (const lang of fs.readdirSync(COPY_DIR).map((f) => f.replace(/\.js$/, ""))) {
    const c = loadCopy(lang)["logo-studio"];
    assert.deepEqual(Object.keys(c.finish).sort(), Object.keys(want).sort(), `${lang} names every finish`);
    assert.deepEqual(Object.keys(c.colour).sort(), colourKeys, `${lang} names every colour`);
    assert.match(c.foilName, /\{finish\}/); assert.match(c.foilName, /\{colour\}/);
    // with 25 colours on offer, neither the headline nor the teaser promises gold
    const gold = c.colour.gold.toLocaleLowerCase();
    for (const k of ["title", "peek"]) assert.ok(!c[k].toLocaleLowerCase().includes(gold.slice(0, 4)), `${lang} ${k} names gold: "${c[k]}"`);
  }
  assert.doesNotMatch(LS_SRC, /deboss/);
  // a browser's forced dark mode must not recolour the foil or the buttons (Samsung Internet did, on the user's phone)
  const shellCss = fs.readFileSync(path.join(ROOT, "signup", "westpack-signup.css"), "utf8");
  assert.match(shellCss.slice(shellCss.indexOf(".wps {"), shellCss.indexOf("}", shellCss.indexOf(".wps {"))), /color-scheme: only light;/);
});

// the phone's stage is a window onto the full-width square scene, placed so the print sits in its middle where the
// photo allows; lifted from the shipped file like the homography
const windowTop = Function(`${LS_SRC.slice(LS_SRC.indexOf("  function windowTop("), LS_SRC.indexOf("  // the measured light across the print area"))}; return windowTop;`)();

test("logo studio on a phone: the stage window never runs past the photo, and centres the print where it can", () => {
  for (const [id, l] of Object.entries(LIDS)) {
    const cy = project(homography(l.quad), l.print.cx, l.print.cy)[1] / 100;
    assert.ok(cy > 0.3 && cy < 0.7, `${id} print centre ${cy}`);
    for (const S of [320, 360, 390, 430]) {
      for (let H = 0.4 * S; H <= S + 1e-9; H += 0.05 * S) {
        const top = windowTop(S, H, cy);
        assert.ok(top >= H - S - 1e-9 && top <= 1e-9, `${id} at ${S}x${H.toFixed(0)}: top ${top}`);
        const free = H / 2 - cy * S;
        if (free <= 0 && free >= H - S) assert.ok(Math.abs(top + cy * S - H / 2) < 1e-6, `${id} at ${S}x${H.toFixed(0)}: the print centre sits at the window's middle`);
        // with the disclaimer over the top (two or three lines) and the zoom's band at the foot, the print is centred
        // in what they leave clear, still never past the photo
        for (const [a, b] of [[48, 48], [63, 48], [48, 63]]) {
          const t2 = windowTop(S, H, cy, a, b), mid = (a + H - b) / 2;
          assert.ok(t2 >= H - S - 1e-9 && t2 <= 1e-9, `${id} at ${S}x${H.toFixed(0)} with bands ${a}/${b}: top ${t2}`);
          if (mid - cy * S <= 0 && mid - cy * S >= H - S) assert.ok(Math.abs(t2 + cy * S - mid) < 1e-6, `${id} at ${S}x${H.toFixed(0)}: the print centre sits between the bands`);
        }
      }
      assert.equal(windowTop(S, S, cy), 0, `${id}: a square window shows the whole photo`);
      assert.ok(Math.abs(windowTop(S, 0.7 * S, cy, 48, 48) - windowTop(S, 0.7 * S, cy)) < 1e-9, `${id}: equal bands centre the print where no bands would`);
    }
  }
});
