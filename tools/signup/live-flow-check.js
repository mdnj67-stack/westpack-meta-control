/**
 * The whole live signup on the real stores, as a visitor meets it - with nothing reaching Klaviyo or the funnel.
 *
 * Runs the production runtime exactly as the stores load it (their own tag, Control's real switch, no forcing), and
 * drives Logo studio to the end in every market and engine. Klaviyo's client endpoints are answered in the browser
 * (202), so every request the runtime would send is captured and checked field by field against the market:
 * account (public key), newsletter list, custom source, consent, the consent sentence on screen and on the profile,
 * locale, the brand name, the timeline event and the list it names. Tracking is captured from the runtime's own
 * "flush" and never sent, so a check is never counted as a live exposure.
 *
 * Scenarios, per market:
 *   signup    desktop (Chromium), iPhone (WebKit), Android (Chromium): opens by itself, the visible consent sentence is
 *             the market's verbatim, invalid address sends nothing, a double click sends one subscription and one
 *             event, success shows the name, dataLayer gets the event, tracking says live/subscribed with no address,
 *             and a reload does not open it again.
 *   closed    desktop: closing is remembered - the next page does not open it.
 *   excluded  desktop: cart, newsletter page, customer survey, a visit from an email (utm_medium=email, then the next
 *             page too) - none opens it.
 *   failure   a few markets: Klaviyo answering 500 twice gives the error in the market's language and no success;
 *             the visitor's second try goes through.
 *   firefox   a few markets: the signup scenario in Firefox. tablet: a few markets on a Galaxy Tab.
 *   closedStores  GR and LT (closed in the runtime): nothing appears.
 *
 * Usage: node tools/signup/live-flow-check.js <outDir> [--stores=DK,DE] [--only=signup,closed,...] [--workers=4]
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const PW = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));
const { MARKETS } = require(path.join(ROOT, "signup", "core", "markets.js"));

const PROD = "https://project-4fcxa.vercel.app";
const SOURCE = "Westpack Signup Lab · logo-studio";
const NAME = "Nordlys Test ApS";
const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--")) || path.join(ROOT, "tmp", "signup-live-flow");
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3);
const onlyStores = opt("stores").split(",").filter(Boolean);
const onlyScen = opt("only").split(",").filter(Boolean);
const WORKERS = Number(opt("workers")) || 4;
const stamp = Date.now();

function loadCopy(lang) {
  const sandbox = {}; sandbox.globalThis = sandbox;
  require("vm").runInNewContext(fs.readFileSync(path.join(ROOT, "signup", "core", "copy", `${lang}.js`), "utf8"), sandbox);
  return sandbox.WestpackSignupCopy[lang];
}
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

const MODES = {
  desktop: { engine: "chromium", ctx: { viewport: { width: 1440, height: 900 }, locale: "en-GB" } },
  iphone: { engine: "webkit", ctx: { ...PW.devices["iPhone 13"] } },
  android: { engine: "chromium", ctx: { ...PW.devices["Pixel 7"] } },
  firefox: { engine: "firefox", ctx: { viewport: { width: 1366, height: 768 } } },
  tablet: { engine: "chromium", ctx: { ...PW.devices["Galaxy Tab S4"] } },
};

const browsers = {};
async function browser(engine) { return browsers[engine] || (browsers[engine] = await PW[engine].launch()); }

/** A context with Klaviyo answered in the browser and tracking captured, never sent. */
async function open(mode, kl = {}) {
  const b = await browser(MODES[mode].engine);
  const ctx = await b.newContext(MODES[mode].ctx);
  const cap = { subs: [], events: [], track: [], errors: [], otherKlaviyo: 0 };
  await ctx.addInitScript(() => {
    window.__wps = { events: [], hooked: false };
    const beacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    if (beacon) navigator.sendBeacon = (url, data) => (String(url).includes("/api/signup/track") ? true : beacon(url, data));
    const t = setInterval(() => {
      const W = window.WestpackSignup;
      if (W && W.on && !window.__wps.hooked) {
        window.__wps.hooked = true;
        ["open", "close", "subscribed", "flush"].forEach((n) => W.on(n, (d) => { try { window.__wps.events.push({ n, d: JSON.parse(JSON.stringify(d || null)) }); } catch (e) { window.__wps.events.push({ n }); } }));
        clearInterval(t);
      }
    }, 25);
    setTimeout(() => clearInterval(t), 60000);
  });
  await ctx.route(`${PROD}/api/signup/track*`, (r) => { cap.track.push(r.request().postData()); return r.fulfill({ status: 204, body: "", headers: { "access-control-allow-origin": "*" } }); });
  let failLeft = kl.failFirst || 0;
  await ctx.route(/https:\/\/a\.klaviyo\.com\/client\/(subscriptions|events)/, async (r) => {
    const req = r.request();
    const cors = { "access-control-allow-origin": req.headers().origin || "*", "access-control-allow-headers": "content-type, accept, revision", "access-control-allow-methods": "POST, OPTIONS" };
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, body: "", headers: cors });
    let body = null; try { body = JSON.parse(req.postData() || "null"); } catch (e) { /* not ours */ }
    const url = req.url();
    const entry = { url, companyId: new URL(url).searchParams.get("company_id"), revision: req.headers().revision, body, at: Date.now() };
    if (url.includes("/client/subscriptions")) {
      if (String(body?.data?.attributes?.custom_source || "").startsWith("Westpack Signup Lab")) {
        cap.subs.push(entry);
        if (failLeft > 0) { failLeft--; return r.fulfill({ status: 500, body: "{}", headers: cors }); }
      } else cap.otherKlaviyo++;
    } else if (body?.data?.attributes?.metric?.data?.attributes?.name === "Signup Lab Subscribed") cap.events.push(entry);
    else cap.otherKlaviyo++;
    return r.fulfill({ status: 202, body: "", headers: cors });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { if (/westpack-signup|WestpackSignup|signup\//.test(`${e.stack || ""} ${e.message}`)) cap.errors.push(e.message); });
  return { ctx, page, cap };
}

async function acceptCookies(page) {
  const b = page.locator("#coiOverlay .coi-banner__accept").first();
  try { await b.waitFor({ state: "visible", timeout: 8000 }); await b.click(); } catch (e) { /* none */ }
}
const isOpen = (page) => page.evaluate(() => { const sr = document.getElementById("westpack-signup")?.shadowRoot; return Boolean(sr && sr.querySelector(".wps.is-open")); }).catch(() => false);
async function waitOpen(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await isOpen(page)) return true; await page.waitForTimeout(400); }
  return false;
}
const wpsEvents = (page) => page.evaluate(() => (window.__wps ? window.__wps.events : [])).catch(() => []);
async function goto(page, url) { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); }

async function signup(code, m, mode, opts = {}) {
  const copy = loadCopy(m.lang), ls = copy["logo-studio"], shell = copy.shell;
  const base = `https://www.westpack.com/${code}/`;
  const { ctx, page, cap } = await open(mode, { failFirst: opts.failFirst || 0 });
  const r = { market: m.market, scenario: opts.failFirst ? "failure" : "signup", mode, problems: [] };
  const bad = (msg) => r.problems.push(msg);
  try {
    await goto(page, base);
    await acceptCookies(page);
    const installed = await page.evaluate(() => [...document.querySelectorAll("script[src]")].some((x) => x.src.includes("/signup/westpack-signup.js")));
    if (!installed) bad("store page lacks the tag");
    if (!(await waitOpen(page, 30000))) { bad("did not open by itself within 30 s"); return r; }
    const host = page.locator("#westpack-signup");
    const shown = await page.evaluate(() => {
      const sr = document.getElementById("westpack-signup").shadowRoot;
      const c = sr.querySelector(".wps-consent"), a = c && c.querySelector("a");
      return { title: sr.querySelector(".wps-title")?.textContent || "", consent: c ? c.textContent : "", href: a ? a.getAttribute("href") : "", market: window.WestpackSignup.market?.market, concept: window.WestpackSignup.concept,
        klaviyoPopup: [...document.querySelectorAll('[role="dialog"][class*="kl-private"]')].some((n) => n.getBoundingClientRect().width > 40) };
    });
    r.concept = shown.concept;
    if (shown.market !== m.market) bad(`runtime market ${shown.market}`);
    if (shown.concept !== "logo-studio") bad(`concept ${shown.concept}`);
    if (norm(shown.title) !== norm(ls.title)) bad(`title "${norm(shown.title).slice(0, 40)}"`);
    if (shown.klaviyoPopup) bad("a Klaviyo popup shows beside the Lab");
    // the consent sentence is in the DOM before the result on some layouts; check it where the email field is
    await host.locator(".ls-name-input").first().click();
    await host.locator(".ls-name-input").first().fill(NAME);
    const thumbs = host.locator(".ls-thumb");
    let lid = null;
    for (let i = 0, n = await thumbs.count(); i < n; i++) {
      const t = thumbs.nth(i);
      if ((await t.isVisible()) && (await t.getAttribute("aria-pressed")) !== "true") { lid = await t.getAttribute("data-box"); await t.click(); break; }
    }
    if (!lid) bad("no other piece could be chosen");
    await page.waitForTimeout(500);
    await host.locator(".ls-next").first().click();
    const input = host.locator(".wps-input").first();
    await input.waitFor({ state: "visible", timeout: 8000 });
    const result = await page.evaluate(() => {
      const sr = document.getElementById("westpack-signup").shadowRoot;
      const c = [...sr.querySelectorAll(".wps-consent")].find((x) => x.offsetParent !== null) || sr.querySelector(".wps-consent");
      const a = c && c.querySelector("a");
      return { consent: c ? c.textContent : "", href: a ? a.getAttribute("href") : "", text: sr.querySelector(".ls-result")?.textContent || "" };
    });
    if (norm(result.consent) !== norm(m.consent)) bad(`consent on screen differs: "${norm(result.consent).slice(0, 60)}"`);
    if (result.href !== m.privacyUrl) bad(`privacy link ${result.href}`);
    if (!result.text.includes(NAME)) bad("result does not show the name");
    // an invalid address sends nothing
    await input.fill("ikke-en-mail");
    await host.locator(".wps-form .wps-btn-primary").first().click();
    await page.waitForTimeout(600);
    const err = norm(await host.locator(".wps-error").first().textContent());
    if (err !== norm(shell.invalidEmail)) bad(`invalid-address message "${err}"`);
    if (cap.subs.length) bad("an invalid address reached Klaviyo");
    const email = `signup-lab+live-${m.market.toLowerCase()}-${mode}-${stamp}@example.com`;
    await input.fill(email);
    if (opts.failFirst) {
      await host.locator(".wps-form .wps-btn-primary").first().click();
      await page.waitForTimeout(4500);
      const e2 = norm(await host.locator(".wps-error").first().textContent());
      if (e2 !== norm(shell.networkError)) bad(`failure message "${e2}"`);
      if (cap.subs.length !== 2) bad(`${cap.subs.length} attempts on a failing Klaviyo (want 2: one retry)`);
      if (await host.locator(".ls-success").first().isVisible().catch(() => false)) bad("success shown although Klaviyo failed");
      if (cap.events.length) bad("timeline event sent although the signup failed");
      await host.locator(".wps-form .wps-btn-primary").first().click();
      await page.waitForTimeout(3500);
      if (cap.subs.length !== 3) bad(`${cap.subs.length} attempts after the visitor's second try (want 3)`);
    } else {
      await host.locator(".wps-form .wps-btn-primary").first().dblclick();
      await page.waitForTimeout(3500);
      if (cap.subs.length !== 1) bad(`${cap.subs.length} subscription requests for a double click (want 1)`);
    }
    if (cap.events.length !== 1) bad(`${cap.events.length} timeline events (want 1)`);
    const s = cap.subs[cap.subs.length - 1];
    if (s) {
      const a = s.body.data.attributes, p = a.profile.data.attributes, props = p.properties || {};
      const want = {
        company_id: [s.companyId, m.companyId], list: [s.body.data.relationships?.list?.data?.id, m.listId], custom_source: [a.custom_source, SOURCE],
        consent: [p.subscriptions?.email?.marketing?.consent, "SUBSCRIBED"], email: [p.email, email], locale: [p.locale, m.locale], organization: [p.organization, NAME],
        wp_consent_text: [props.wp_consent_text, m.consent], wp_signup_market: [props.wp_signup_market, m.market], wp_signup_lang: [props.wp_signup_lang, m.lang],
        wp_signup_concept: [props.wp_signup_concept, "logo-studio"], wp_brand_name: [props.wp_brand_name, NAME], wp_logo_lid: [props.wp_logo_lid, lid],
        wp_consent_page: [props.wp_consent_page, base], wp_signup_page_type: [props.wp_signup_page_type, "home"], revision: [s.revision, "2026-10-15"],
      };
      for (const [k, [got, exp]] of Object.entries(want)) if (got !== exp) bad(`subscription ${k}: ${JSON.stringify(got)} (want ${JSON.stringify(exp)})`);
      const extra = Object.keys(props).filter((k) => !k.startsWith("wp_"));
      if (extra.length) bad(`unexpected profile properties ${extra.join(",")}`);
      r.payload = { company_id: s.companyId, list: want.list[0], source: a.custom_source, locale: p.locale, props: Object.keys(props).sort().join(",") };
    } else if (!r.problems.length) bad("no subscription captured");
    const ev = cap.events[0];
    if (ev) {
      const a = ev.body.data.attributes, props = a.properties || {};
      if (ev.companyId !== m.companyId) bad(`event company_id ${ev.companyId}`);
      if (props.wp_signup_list !== m.listId) bad(`event wp_signup_list ${props.wp_signup_list}`);
      if (props.wp_signup_market !== m.market) bad(`event wp_signup_market ${props.wp_signup_market}`);
      if (a.profile?.data?.attributes?.email !== email) bad("event profile email differs");
      if (s && ev.at < s.at) bad("event sent before the subscription");
    }
    const success = host.locator(".ls-success").first();
    if (!(await success.isVisible().catch(() => false))) bad("success not shown");
    else {
      const t = norm(await host.locator(".ls-success-title").first().textContent());
      if (t !== norm(ls.successTitle.replace("{name}", NAME))) bad(`success title "${t}"`);
    }
    await page.screenshot({ path: path.join(outDir, `${m.market}-${r.scenario}-${mode}-success.jpg`), type: "jpeg", quality: 60 }).catch(() => {});
    const dl = await page.evaluate(() => (window.dataLayer || []).some((x) => x && x.event === "wp_signup_subscribed"));
    if (!dl) bad("dataLayer lacks wp_signup_subscribed");
    // close the thank-you: the exposure's tracking record goes out (captured here, never sent)
    const closeBtn = host.locator(".wps-close").first();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click(); else await page.evaluate(() => window.WestpackSignup.close("button"));
    await page.waitForTimeout(800);
    const flush = (await wpsEvents(page)).filter((e) => e.n === "flush").map((e) => e.d);
    const f = flush[flush.length - 1];
    if (!f) bad("no tracking record");
    else {
      r.tracking = { env: f.env, outcome: f.outcome, trigger: f.trigger, device: f.device, steps: (f.steps || []).length };
      if (f.env !== "live") bad(`tracking env ${f.env}`);
      if (f.market !== m.market || f.concept !== "logo-studio") bad(`tracking market/concept ${f.market}/${f.concept}`);
      if (f.outcome !== "subscribed") bad(`tracking outcome ${f.outcome}`);
      if (JSON.stringify(f).includes("@")) bad("tracking record carries an @");
      const want = mode === "desktop" || mode === "firefox" ? "desktop" : mode === "tablet" ? "tablet" : "mobile";
      if (f.device !== want) bad(`tracking device ${f.device} (want ${want})`);
    }
    if (cap.track.length) bad(`${cap.track.length} tracking posts went past sendBeacon (captured, not sent)`);
    // a subscribed visitor is not asked again
    await page.reload({ waitUntil: "domcontentloaded" });
    if (await waitOpen(page, 16000)) bad("opened again after the visitor subscribed");
    r.errors = cap.errors.length;
    if (cap.errors.length) bad(`script errors: ${cap.errors.slice(0, 2).join(" | ")}`);
    await page.screenshot({ path: path.join(outDir, `${m.market}-${r.scenario}-${mode}.jpg`), type: "jpeg", quality: 60 }).catch(() => {});
  } catch (e) {
    bad(`crashed: ${String(e.message).split("\n")[0]}`);
    await page.screenshot({ path: path.join(outDir, `${m.market}-${r.scenario}-${mode}-crash.jpg`), type: "jpeg", quality: 60 }).catch(() => {});
  } finally { await ctx.close(); }
  return r;
}

async function closed(code, m) {
  const base = `https://www.westpack.com/${code}/`;
  const { ctx, page, cap } = await open("desktop");
  const r = { market: m.market, scenario: "closed", mode: "desktop", problems: [] };
  try {
    await goto(page, base); await acceptCookies(page);
    if (!(await waitOpen(page, 30000))) { r.problems.push("did not open"); return r; }
    await page.locator("#westpack-signup .wps-close").first().click();
    await page.waitForTimeout(800);
    const f = (await wpsEvents(page)).filter((e) => e.n === "flush").map((e) => e.d).pop();
    if (!f || f.outcome !== "closed" || f.env !== "live") r.problems.push(`tracking after close: ${JSON.stringify(f && { env: f.env, outcome: f.outcome })}`);
    const next = await page.evaluate((b) => [...document.querySelectorAll(`a[href^="${b}"]`)].map((a) => a.href.split("#")[0]).find((h) => /\.html$/.test(h) && !/sale|outlet|checkout|cart|customer|wishlist|newsletter|search/i.test(h)), base);
    await goto(page, next || base);
    r.next = next ? new URL(next).pathname : "(home again)";
    if (await waitOpen(page, 16000)) r.problems.push(`opened again on the next page after a close (${r.next})`);
    if (cap.subs.length) r.problems.push("a subscription was sent");
    if (cap.errors.length) r.problems.push(`script errors: ${cap.errors[0]}`);
  } catch (e) { r.problems.push(`crashed: ${String(e.message).split("\n")[0]}`); } finally { await ctx.close(); }
  return r;
}

async function excluded(code, m) {
  const base = `https://www.westpack.com/${code}/`;
  const r = { market: m.market, scenario: "excluded", mode: "desktop", problems: [] };
  const pages = [["cart", `${base}checkout/cart/`], ["newsletter page", `${base}newsletter-signup`], ["survey", `${base}customer-survey`]];
  for (const [label, url] of pages) {
    const { ctx, page } = await open("desktop");
    try { await goto(page, url); await acceptCookies(page); if (await waitOpen(page, 15000)) r.problems.push(`opened on the ${label}`); }
    catch (e) { r.problems.push(`${label} crashed: ${String(e.message).split("\n")[0]}`); } finally { await ctx.close(); }
  }
  // a visitor from one of our emails is on the list already: not on that page, nor on the next
  const { ctx, page } = await open("desktop");
  try {
    await goto(page, `${base}?utm_source=klaviyo&utm_medium=email&utm_campaign=test`); await acceptCookies(page);
    if (await waitOpen(page, 15000)) r.problems.push("opened for a visitor from an email");
    await goto(page, base);
    if (await waitOpen(page, 15000)) r.problems.push("opened on the page after an email visit");
  } catch (e) { r.problems.push(`email visit crashed: ${String(e.message).split("\n")[0]}`); } finally { await ctx.close(); }
  return r;
}

async function closedStore(code) {
  const { ctx, page } = await open("desktop");
  const r = { market: code, scenario: "closedStore", mode: "desktop", problems: [] };
  try {
    await goto(page, `https://www.westpack.com/${code}/`); await acceptCookies(page);
    await page.waitForTimeout(16000);
    const s = await page.evaluate(() => ({ host: Boolean(document.getElementById("westpack-signup")), tag: [...document.querySelectorAll("script[src]")].some((x) => x.src.includes("/signup/westpack-signup.js")) }));
    r.tag = s.tag;
    if (s.host) r.problems.push("the Lab appeared on a closed store");
  } catch (e) { r.problems.push(`crashed: ${String(e.message).split("\n")[0]}`); } finally { await ctx.close(); }
  return r;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const served = await (await fetch(`${PROD}/api/signup/control?action=config&nocache=${Date.now()}`)).json();
  const stores = Object.entries(MARKETS).filter(([, m]) => !onlyStores.length || onlyStores.includes(m.market));
  for (const [, m] of stores) if (!(served.live.on && served.live.markets[m.market])) console.log(`NOTE ${m.market} is not switched on for live in Control`);
  const want = (s) => !onlyScen.length || onlyScen.includes(s);
  const jobs = [];
  for (const [code, m] of stores) {
    if (want("signup")) for (const mode of ["desktop", "iphone", "android"]) jobs.push(() => signup(code, m, mode));
    if (want("closed")) jobs.push(() => closed(code, m));
    if (want("excluded")) jobs.push(() => excluded(code, m));
    if (want("failure") && ["DK", "DE", "FR", "PL"].includes(m.market)) jobs.push(() => signup(code, m, m.market === "DE" ? "iphone" : m.market === "FR" ? "android" : "desktop", { failFirst: 2 }));
    if (want("firefox") && ["DK", "UK", "DE", "NL"].includes(m.market)) jobs.push(() => signup(code, m, "firefox"));
    if (want("tablet") && ["DK", "DE", "SE"].includes(m.market)) jobs.push(() => signup(code, m, "tablet"));
  }
  if (want("closedStores") && !onlyStores.length) for (const c of ["eur_eu_ell", "eur_eu_lit"]) jobs.push(() => closedStore(c));
  console.log(`${jobs.length} runs, ${WORKERS} at a time`);
  const rows = [];
  let next = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const row = await job();
      rows.push(row);
      console.log(`${row.problems.length ? "FAIL" : "ok  "} ${row.market} ${row.scenario} ${row.mode}${row.problems.length ? " - " + row.problems.join("; ") : ""}`);
    }
  }));
  for (const b of Object.values(browsers)) await b.close();
  fs.writeFileSync(path.join(outDir, "live-flow-check.json"), JSON.stringify(rows, null, 2));
  const failed = rows.filter((r) => r.problems.length);
  console.log(`${rows.length} runs, ${failed.length} with a problem`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
