/**
 * Runs the Signup Lab on the real stores, the way the Tag Manager tag will: opens a westpack.com storefront, answers
 * the cookie banner, adds the one script line, and checks what a visitor gets. Nothing is submitted, signups could
 * only ever reach the test list (data-test="1"), and tracking is off.
 *
 * Scenarios, per store:
 *   tag      - the switch as it is: with LIVE = false the tag must do nothing at all; with LIVE = true (after launch)
 *              the experience must come by itself - so the same command checks the stores before and after launch
 *   preview  - ?wps=logo-studio: the experience opens at once, in the store's language, with its consent sentence
 *   live     - (--simulate-live) LIVE forced on for this browser only: the dialog must come by itself on the home
 *              page (desktop, about 11 s after the banner) and never on the cart
 * Each run also notes whether Klaviyo's own popup showed, since that is what has to be unpublished at launch.
 *
 * Usage: node tools/signup/store-check.js <outDir> [--local] [--simulate-live] [--mobile] [--stores=DK,DE]
 *   --local  serves signup/ from this checkout instead of production, to check work before it is deployed
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { chromium, devices } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));
const { MARKETS } = require(path.join(ROOT, "signup", "core", "markets.js"));

const PROD = "https://project-4fcxa.vercel.app";
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };
const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--")) || path.join(ROOT, "tmp", "signup-store-check");
const local = args.includes("--local"), simulateLive = args.includes("--simulate-live"), mobile = args.includes("--mobile");
const only = ((args.find((a) => a.startsWith("--stores=")) || "").slice(9) || "").split(",").filter(Boolean);
const stores = Object.entries(MARKETS).filter(([, m]) => !only.length || only.includes(m.market));

function loadCopy(lang) {
  const sandbox = {}; sandbox.globalThis = sandbox;
  require("vm").runInNewContext(fs.readFileSync(path.join(ROOT, "signup", "core", "copy", `${lang}.js`), "utf8"), sandbox);
  return sandbox.WestpackSignupCopy[lang];
}

async function route(page, forceLive) {
  await page.route(`${PROD}/signup/**`, async (r) => {
    const rel = new URL(r.request().url()).pathname.replace(/^\//, "");
    if (!local && !(forceLive && rel === "signup/core/markets.js")) return r.continue();
    let body;
    if (local) {
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) return r.fulfill({ status: 404, body: "" });
      body = fs.readFileSync(file);
    } else {
      body = Buffer.from(await (await fetch(r.request().url())).arrayBuffer());
    }
    if (forceLive && rel === "signup/core/markets.js") body = Buffer.from(body.toString("utf8").replace("const LIVE = false;", "const LIVE = true;"));
    return r.fulfill({ status: 200, body, headers: { "content-type": TYPES[path.extname(rel)] || "application/octet-stream", "access-control-allow-origin": "*" } });
  });
}
// the tag exactly as Tag Manager will add it, plus data-test so nothing can reach a real list, and tracking off
const addTag = (page) => page.evaluate((src) => { const s = document.createElement("script"); s.src = src; s.async = true; s.dataset.test = "1"; s.dataset.track = ""; document.head.appendChild(s); }, `${PROD}/signup/westpack-signup.js`);
async function acceptCookies(page) {
  const b = page.locator("#coiOverlay .coi-banner__accept").first();
  try { await b.waitFor({ state: "visible", timeout: 8000 }); await b.click(); } catch (e) { /* no banner, or already answered */ }
}
const state = (page) => page.evaluate(() => {
  const host = document.getElementById("westpack-signup");
  const sr = host && host.shadowRoot;
  const wrap = sr && sr.querySelector(".wps");
  const title = sr && sr.querySelector(".wps-title");
  const consent = sr && sr.querySelector(".wps-consent");
  // Klaviyo's popups are dialogs with its reset class; its embedded forms carry the class but are not dialogs
  const kl = [...document.querySelectorAll('[role="dialog"][class*="kl-private"]')].some((n) => n.getBoundingClientRect().width > 40);
  return {
    loaded: Boolean(window.WestpackSignup), open: Boolean(wrap && wrap.classList.contains("is-open")), peek: Boolean(sr && sr.querySelector(".wps-peek.is-in")),
    market: window.WestpackSignup && window.WestpackSignup.market ? window.WestpackSignup.market.market : null,
    title: title ? title.textContent.trim() : "", consent: consent ? consent.textContent.trim().slice(0, 60) : "", klaviyoPopup: kl,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
});

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  // the switch the stores will actually see: this checkout's with --local, production's otherwise
  const marketsJs = local ? fs.readFileSync(path.join(ROOT, "signup", "core", "markets.js"), "utf8") : await (await fetch(`${PROD}/signup/core/markets.js?nocache=${Date.now()}`)).text();
  const switchOn = /const LIVE = true;/.test(marketsJs);
  console.log(`switch: LIVE = ${switchOn} (${local ? "this checkout" : "production"})`);
  const browser = await chromium.launch();
  const rows = [];
  for (const [code, m] of stores) {
    const copy = loadCopy(m.lang)["logo-studio"];
    const ctxOpts = mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 900 } };
    const run = async (scenario, url, forceLive, waitMs) => {
      const ctx = await browser.newContext(ctxOpts);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => { if (/westpack-signup|WestpackSignup|signup\//.test(e.stack || e.message)) errors.push(e.message); });
      await route(page, forceLive);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await acceptCookies(page);
      await addTag(page);
      await page.waitForTimeout(waitMs);
      const s = await state(page);
      await page.screenshot({ path: path.join(outDir, `${m.market}-${scenario}${mobile ? "-mobile" : ""}.jpg`), type: "jpeg", quality: 70 });
      await ctx.close();
      return { ...s, errors };
    };
    const base = `https://www.westpack.com/${code}/`;
    const off = await run("tag", base, false, switchOn ? (mobile ? 12000 : 17000) : 14000);
    const pv = await run("preview", `${base}?wps=logo-studio`, false, 6000);
    const r = { market: m.market,
      tag: switchOn ? (off.open || off.peek ? "shows" : "NOTHING") : !off.open && !off.peek ? "silent" : "SHOWED",
      preview: pv.open ? (pv.market === m.market ? "opens" : `WRONG MARKET ${pv.market}`) : "DID NOT OPEN",
      language: pv.title && pv.title === copy.title ? "ok" : `title "${pv.title.slice(0, 30)}"`,
      consent: pv.consent && m.consent.startsWith(pv.consent.slice(0, 40)) ? "ok" : `"${pv.consent.slice(0, 30)}"`,
      klaviyoPopup: off.klaviyoPopup ? "yes" : "no",
      errors: [...off.errors, ...pv.errors].length };
    if (simulateLive) {
      const live = await run("live", base, true, mobile ? 12000 : 17000);
      const cart = await run("cart", `${base}checkout/cart/`, true, 15000);
      r.live = mobile ? (live.peek || live.open ? "peek" : "NOTHING") : live.open ? "opens" : "NOTHING";
      r.cart = cart.open || cart.peek ? "SHOWED" : "silent";
      r.klaviyoTooWhenLive = live.klaviyoPopup ? "yes" : "no";
      r.errors += live.errors.length + cart.errors.length;
    }
    rows.push(r);
    console.log(JSON.stringify(r));
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "store-check.json"), JSON.stringify(rows, null, 2));
  const bad = rows.filter((r) => r.tag !== (switchOn ? "shows" : "silent") || r.preview !== "opens" || r.language !== "ok" || r.consent !== "ok" || r.errors || (simulateLive && (r.live === "NOTHING" || r.cart !== "silent")));
  console.log(`${rows.length} stores, ${bad.length} with a problem${bad.length ? ": " + bad.map((r) => r.market).join(", ") : ""}`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
