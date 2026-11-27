/**
 * Consent check: every experience, in every market, on a phone and a computer, in the real runtime - the part a signup
 * rests on. Written 2026-11-27 for the New Year sale (the user: "Vi skal virkeligt være grundigt, det omhander jo
 * permissions"). Run it before an experience goes live and after any change to an experience, the shell or the copy.
 *
 * For each market it checks that
 * - the consent sentence shown is the store's own (core/markets.js) word for word, inside the form, in view without
 *   scrolling, at most 40px from the button, at least 11px and at least 4.5:1 contrast on its background;
 * - the privacy link is the market's, with its own words, opening in a new tab;
 * - the button carries the shell's newsletter wording; the field is an empty, required email field; there is no checkbox;
 * - nothing reaches Klaviyo before the button is pressed, and an invalid address never does;
 * - a valid address, double-clicked, sends exactly one subscription: to the TEST list in preview, SUBSCRIBED, email only,
 *   the consent text shown stored on the profile, the source naming the experience, the market and locale right;
 * - the experience's thank-you shows only after that;
 * and, in Node, that a live signup goes to the market's own account and list, with the consent page stripped of its
 * query string. Klaviyo is intercepted throughout: nothing leaves the machine.
 *
 * Usage: node tools/signup/consent-check.js [concept,concept,...]   (default: every experience)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "..");
const { chromium, devices } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));
const R = require(path.join(ROOT, "signup", "core", "rules.js"));
const { MARKETS, TEST_TARGET } = require(path.join(ROOT, "signup", "core", "markets.js"));

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const copyOf = (lang) => { const sb = {}; sb.globalThis = sb; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "signup", "core", "copy", `${lang}.js`), "utf8"), sb); return sb.WestpackSignupCopy[lang]; };
const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const rgb = (s) => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
// each experience's steps before its email field (Logo studio shows the field once a name has given a result)
const BEFORE_EMAIL = {
  "logo-studio": async (p) => { await p.locator("#westpack-signup .ls-name-input").fill("Atelier Test"); await p.locator("#westpack-signup .ls-next").click(); await p.waitForTimeout(1500); },
};
// how each experience says the signup went through
const THANKS = { "logo-studio": ".ls-success", "pack-and-ship": ".ps-success", "new-year-sale": ".ny-done" };

(async () => {
  const want = (process.argv[2] || R.CONCEPT_IDS.join(",")).split(",").filter((c) => R.CONCEPT_IDS.includes(c));
  const browser = await chromium.launch();
  const problems = [];
  let runs = 0;
  for (const concept of want) {
    for (const [device, opts] of [["phone", { ...devices["iPhone 13"] }], ["computer", { viewport: { width: 1440, height: 900 } }]]) {
      const ctx = await browser.newContext(opts);
      const posts = [];
      await ctx.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (u.hostname === "a.klaviyo.com") { posts.push({ url: u.pathname + u.search, body: route.request().postData() }); return route.fulfill({ status: 202, body: "" }); }
        if (u.hostname !== "wps.test") return route.abort();
        if (u.pathname.startsWith("/api/")) return route.fulfill({ status: 204, body: "" });
        const f = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
        route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
      });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e)));
      for (const [code, m] of Object.entries(MARKETS)) {
        const fail = (what) => problems.push(`${concept} · ${device} · ${m.market}: ${what}`);
        posts.length = 0;
        runs++;
        // a real submit (not the preview's dry run), so the request that would reach Klaviyo is what is checked
        await p.goto(`http://wps.test/signup/preview/frame.html?market=${code}&concept=${concept}&open=1&reset=1&track=&delay=0`);
        await p.waitForTimeout(1600);
        if (BEFORE_EMAIL[concept]) await BEFORE_EMAIL[concept](p);
        const r = await p.evaluate(() => {
          const s = document.querySelector("#westpack-signup").shadowRoot;
          const consent = [...s.querySelectorAll(".wps-consent")].find((n) => n.offsetParent !== null) || s.querySelector(".wps-consent");
          const form = consent && consent.closest(".wps-form");
          const link = consent && consent.querySelector("a"), btn = form && form.querySelector(".wps-btn-primary"), input = form && form.querySelector(".wps-input");
          if (!consent || !btn || !input) return { missing: true };
          const cs = getComputedStyle(consent);
          let n = consent, bg = "";
          while (n && n.nodeType === 1) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(.*,\s*0\)$/.test(c) && c !== "transparent") { bg = c; break; } n = n.parentElement; }
          const br = btn.getBoundingClientRect(), cr = consent.getBoundingClientRect();
          return {
            text: consent.textContent, href: link ? link.getAttribute("href") : "", linkText: link ? link.textContent : "", target: link ? link.getAttribute("target") : "",
            button: btn.textContent.trim(), type: input.type, value: input.value, required: input.required, autocomplete: input.getAttribute("autocomplete"),
            checkboxes: s.querySelectorAll('input[type="checkbox"]').length, visible: cr.height > 10 && cr.width > 100 && cs.visibility !== "hidden",
            gap: Math.round(cr.top - br.bottom), color: cs.color, size: parseFloat(cs.fontSize), bg, inView: cr.bottom <= innerHeight + 0.5 && cr.top >= -0.5,
          };
        });
        if (r.missing) { fail("no form with a consent sentence and a button"); continue; }
        const shell = copyOf(m.lang).shell;
        if (r.text !== m.consent) fail(`consent sentence differs\n     shown: ${r.text}\n     store: ${m.consent}`);
        if (r.href !== m.privacyUrl) fail(`privacy link ${r.href} (expected ${m.privacyUrl})`);
        if (r.linkText !== m.privacyLink) fail(`privacy link words "${r.linkText}"`);
        if (r.target !== "_blank") fail("privacy link does not open in a new tab");
        if (r.button !== shell.signup && !/newsletter|nyhedsbrev|nieuwsbrief|nyhetsbrev|uutiskirje|hírlevél|hírlevel/i.test(r.button)) fail(`button says "${r.button}"`);
        if (r.type !== "email" || r.value !== "" || !r.required || r.autocomplete !== "email") fail(`field ${JSON.stringify({ type: r.type, value: r.value, required: r.required, autocomplete: r.autocomplete })}`);
        if (r.checkboxes) fail(`${r.checkboxes} checkbox(es) in the experience`);
        if (!r.visible) fail("consent sentence not visible");
        if (!r.inView) fail("consent sentence not in view without scrolling");
        if (r.gap < 0 || r.gap > 40) fail(`consent sentence ${r.gap}px from the button`);
        const ratio = r.bg ? (Math.max(lum(rgb(r.bg)), lum(rgb(r.color))) + 0.05) / (Math.min(lum(rgb(r.bg)), lum(rgb(r.color))) + 0.05) : 0;
        if (ratio < 4.5) fail(`consent contrast ${ratio.toFixed(2)}:1 (${r.color} on ${r.bg || "?"})`);
        if (r.size < 11) fail(`consent text ${r.size}px`);
        if (posts.length) fail(`${posts.length} request(s) to Klaviyo before the button was pressed`);
        const form = p.locator("#westpack-signup .wps-form:visible").first();
        await form.locator(".wps-input").fill("not an email");
        await form.locator(".wps-btn-primary").click();
        await p.waitForTimeout(300);
        if (posts.length) fail("an invalid address reached Klaviyo");
        await form.locator(".wps-input").fill(`consent-check+${m.market.toLowerCase()}@example.com`);
        await form.locator(".wps-btn-primary").dblclick();
        await p.waitForTimeout(2200);
        const subs = posts.filter((x) => x.url.startsWith("/client/subscriptions"));
        if (subs.length !== 1) fail(`${subs.length} subscription requests on a double click`);
        if (subs[0]) {
          const body = JSON.parse(subs[0].body).data, a = body.attributes, prof = a.profile.data.attributes;
          if (!subs[0].url.includes(`company_id=${TEST_TARGET.companyId}`) || body.relationships.list.data.id !== TEST_TARGET.listId) fail("a preview signup did not go to the TEST list");
          if (prof.subscriptions.email.marketing.consent !== "SUBSCRIBED") fail("consent is not SUBSCRIBED");
          if (Object.keys(prof.subscriptions).join() !== "email") fail("subscribes to more than email");
          if (prof.properties.wp_consent_text !== m.consent) fail("the consent text stored on the profile is not the one shown");
          if (a.custom_source !== `${R.SOURCE} · ${concept}`) fail(`source "${a.custom_source}"`);
          if (prof.locale !== m.locale || prof.properties.wp_signup_market !== m.market) fail(`locale/market ${prof.locale}/${prof.properties.wp_signup_market}`);
        }
        const thanks = await p.evaluate((sel) => { const n = document.querySelector("#westpack-signup").shadowRoot.querySelector(sel); return Boolean(n && !n.hidden); }, THANKS[concept] || "[data-none]");
        if (THANKS[concept] && !thanks) fail("no thank-you after a successful signup");
      }
      if (errors.length) problems.push(`${concept} · ${device}: script errors ${errors.slice(0, 3).join(" | ")}`);
      await ctx.close();
    }
  }
  await browser.close();
  // live: the market's own account and list, and the consent page without its query string
  for (const m of Object.values(MARKETS)) {
    runs++;
    const req = R.buildSubscription({ market: m, email: "x@example.com", concept: want[0], pageUrl: "https://www.westpack.com/x.html?email=a%40b.c#k" });
    if (!req.url.endsWith(`company_id=${m.companyId}`) || req.body.data.relationships.list.data.id !== m.listId) problems.push(`live ${m.market}: not the market's own account and list`);
    if (req.body.data.attributes.profile.data.attributes.properties.wp_consent_page !== "https://www.westpack.com/x.html") problems.push(`live ${m.market}: the consent page keeps its query string`);
  }
  console.log(`${want.join(", ")}: ${runs} runs, ${problems.length} problem(s)`);
  for (const x of problems) console.log(" - " + x);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
