// The whole Logo studio flow on a phone, on the real store, as a visitor gets it: peek card, open, each of the four
// tools, typing with the keyboard up, zoom, result, an email error with the keyboard up, thank-you. One frame per state.
//   node tools/signup/mobile-walk.js <outDir> [--local] [--store=eur_eu_cze] [--device="iPhone 13"] [--name=Atelier Sever]
//                                    [--engine=chromium|webkit] [--keyboard=390x330] [--viewport=412x915]
// --local serves signup/ from this checkout instead of production. Tracking is blocked and Klaviyo's client
// endpoints are answered with 202 here: nothing leaves the browser. Run it from the checkout's root.
// --keyboard is the view a phone keeps above its keyboard (default per device), simulated by shrinking the viewport
// once a field has focus; Playwright has no on-screen keyboard.
// --viewport gives the device another view, for the tall Androids Playwright has no descriptor for (a Pixel 7 at
// 412x915 or 360x800): there the edit sheet is shorter than the view, so the sheet's own height is in play.
// It also prints what sits on the open sheet's corners (the store's cookie button must not), and on CZ, where the peek
// card comes by itself, whether the peek clears that cookie button.
const fs = require("fs");
const path = require("path");
// signup/ is served from the checkout this runs in (a worktree works); Playwright comes from the main checkout,
// because tmp/ is gitignored and a worktree has none
const REPO = path.resolve(__dirname, "..", "..");
const RUNNER = process.env.PLAYWRIGHT_RUNNER || "C:/Projects/westpack-meta-control/tmp/playwright-runner";
const pw = require(`${RUNNER}/node_modules/playwright`);
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3).replace(/^"|"$/g, "") : d; };
const local = args.includes("--local");
const store = opt("store", "eur_eu_cze"), deviceName = opt("device", "iPhone 13"), name = opt("name", "Atelier Sever"), engine = opt("engine", "chromium");
const KB = { "iPhone SE": "320x250", "Galaxy S8": "360x440", "iPhone 13": "390x330", "iPhone 14 Pro Max": "430x390" };
const viewportOpt = opt("viewport", "");
const device = viewportOpt
  ? { ...pw.devices[deviceName], viewport: (([width, height]) => ({ width, height }))(viewportOpt.split("x").map(Number)) }
  : pw.devices[deviceName];
const [kbW, kbH] = opt("keyboard", KB[deviceName] || `${device.viewport.width}x${Math.round(device.viewport.height / 2)}`).split("x").map(Number);
const PROD = "https://project-4fcxa.vercel.app";
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await pw[engine].launch();
  const { defaultBrowserType, ...dev } = device;
  // Firefox has no isMobile; the other two engines take the descriptor whole
  const ctx = await browser.newContext(engine === "firefox" ? { viewport: dev.viewport, deviceScaleFactor: dev.deviceScaleFactor, hasTouch: dev.hasTouch, userAgent: dev.userAgent } : dev);
  await ctx.route(/project-4fcxa\.vercel\.app\/api\/signup\/track/, (r) => r.abort());
  await ctx.route(/a\.klaviyo\.com\/client\//, (r) => r.fulfill({ status: 202, body: "" }));
  if (local) {
    await ctx.route(`${PROD}/signup/**`, (r) => {
      const u = new URL(r.request().url());
      const file = path.join(REPO, decodeURIComponent(u.pathname));
      if (!fs.existsSync(file)) return r.fulfill({ status: 404, body: "" });
      r.fulfill({ status: 200, body: fs.readFileSync(file), headers: { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "access-control-allow-origin": "*" } });
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  // the store's own scripts throw too (in WebKit, Cookie Information and Dixa reach into cross-origin frames): those are
  // counted apart, and only errors from the Signup Lab's files count as ours
  const storeErrors = [];
  page.on("pageerror", (e) => { const s = String(e.stack || ""); (/\/signup\//.test(s) || (!s && !/Blocked a frame/.test(e.message)) ? errors : storeErrors).push(e.message); });
  let n = 0;
  const shot = async (label) => { n += 1; await page.screenshot({ path: path.join(out, `${String(n).padStart(2, "0")}-${label}.png`) }); };
  const host = page.locator("#westpack-signup");
  const vp = device.viewport;
  const report = {};

  // a fresh visitor on the live store: the peek card comes by itself
  await page.goto(`https://www.westpack.com/${store}/?wps=reset`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const b = page.locator("#coiOverlay .coi-banner__accept").first();
  try { await b.waitFor({ state: "visible", timeout: 10000 }); await b.click(); } catch (e) { /* none */ }
  await page.waitForTimeout(1500);
  // a scroll down the page, as a visitor reads it (mobile WebKit takes no mouse wheel)
  await page.evaluate(() => window.scrollBy(0, 900));
  // since 2026-11-23 a phone gets the popup by itself after a pause; a card that waits for a tap is the older way
  let peeked = false, autoOpened = false;
  try {
    await host.locator(".wps-peek.is-in, .wps.is-open").first().waitFor({ timeout: 15000 });
    autoOpened = await host.locator(".wps.is-open").count() > 0; peeked = !autoOpened;
  } catch (e) { /* live off here */ }
  report.autoOpened = autoOpened;
  if (autoOpened) {
    await page.waitForTimeout(250); await shot("auto-open");
    await page.waitForTimeout(1200);
  } else if (peeked) {
    await page.waitForTimeout(1200);
    await shot("peek");
    // the peek must clear the store's cookie button, and that button must still answer a tap
    report.peek = await page.evaluate(() => {
      const coi = document.getElementById("Coi-Renew"), peek = document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps-peek");
      if (!coi || !peek) return { coi: Boolean(coi), peek: Boolean(peek) };
      const a = coi.getBoundingClientRect(), p = peek.getBoundingClientRect();
      const overlap = Math.min(a.right, p.right) - Math.max(a.left, p.left) > 0 && Math.min(a.bottom, p.bottom) - Math.max(a.top, p.top) > 0;
      const at = document.elementFromPoint((a.left + a.right) / 2, (a.top + a.bottom) / 2);
      return { coi: [a.left, a.top, a.width, a.height].map(Math.round), peek: [p.left, p.top, p.width, p.height].map(Math.round), overlap, cookieClickable: Boolean(at && coi.contains(at)) };
    });
    await host.locator(".wps-peek-cta").click();
  } else {
    await page.goto(`https://www.westpack.com/${store}/?wps=logo-studio`, { waitUntil: "domcontentloaded" });
    // only some stores carry the tag in Magento yet; on the others it is added here, as the tag itself would load it
    await page.waitForTimeout(3000);
    if (!(await page.evaluate(() => Boolean(window.WestpackSignup)))) {
      report.tagInjected = true;
      await page.evaluate((src) => { const s = document.createElement("script"); s.src = src; document.head.appendChild(s); }, `${PROD}/signup/westpack-signup.js`);
    }
  }
  await host.locator(".ls-name-input").waitFor({ state: "attached", timeout: 30000 });
  // the camera's push-in takes 1.8s on an ease-out that has done most of its travel by 0.6s: the intro frame is shot
  // while the sheet is still rising and the camera still pushing, or it is the same picture as "open"
  await page.waitForTimeout(250); await shot("open-intro");
  await page.waitForTimeout(2950); await shot("open");
  // nothing of the store's sits on the open sheet: the four corners, 20px in, answer with our host
  report.corners = await page.evaluate(() => {
    const d = document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps-dialog").getBoundingClientRect();
    return [[d.left + 20, d.top + 20], [d.right - 20, d.top + 20], [d.left + 20, d.bottom - 20], [d.right - 20, d.bottom - 20]].map(([x, y]) => {
      const e = document.elementFromPoint(x, y);
      return `${Math.round(x)},${Math.round(y)}: ${e ? (e.id ? `#${e.id}` : e.tagName.toLowerCase()) : "none"}`;
    });
  });
  report.engineAtRest = await page.evaluate(() => document.querySelector("#westpack-signup").shadowRoot.querySelector(".ls").dataset.engine);
  // the phone's studio has no tabs since 2026-11-20 (name and pieces in one view); a checkout from before still has
  const hasTabs = (await host.locator(".ls-tab").count()) > 0;
  const tab = async (k) => { await host.locator(`.ls-tab[data-tool="${k}"]`).click(); await page.waitForTimeout(500); };

  await shot("edit-brand");
  // typing: the field takes focus and the keyboard comes up
  await host.locator(".ls-name-input").focus();
  await page.setViewportSize({ width: kbW, height: kbH });
  await page.waitForTimeout(500);
  await host.locator(".ls-name-input").pressSequentially(name, { delay: 60 });
  await page.waitForTimeout(1000); await shot("name-typed");
  await host.locator(".ls-name-input").blur();
  await page.setViewportSize(vp);
  await page.waitForTimeout(900); await shot("typed");
  if (hasTabs) { for (const k of ["box", "foil", "type"]) { await tab(k); await shot(`edit-${k}`); } await tab("foil"); }
  else { await host.locator('.ls-thumb[data-box="london"]').click(); await page.waitForTimeout(1400); await shot("edit-piece"); }
  await host.locator(".ls-zoom").click(); await page.waitForTimeout(1200); await shot("zoom");
  await host.locator(".ls-zoom").click(); await page.waitForTimeout(900);

  await host.locator(".ls-next").click();
  await page.waitForTimeout(2200); await shot("result");
  const email = host.locator(".ls-result .wps-input");
  await email.focus();
  await page.setViewportSize({ width: kbW, height: kbH });
  await page.waitForTimeout(500);
  await email.fill("navn@firma");
  await host.locator(".ls-result .wps-form .wps-btn-primary").click();
  await page.waitForTimeout(800); await shot("email-error");
  await email.fill("navn@firma.cz");
  await host.locator(".ls-result .wps-form .wps-btn-primary").click();
  await page.setViewportSize(vp);
  await page.waitForTimeout(2500);
  await shot("success");
  report.engineAtEnd = await page.evaluate(() => document.querySelector("#westpack-signup").shadowRoot.querySelector(".ls").dataset.engine);
  const summary = { store, device: deviceName, engine, local, peeked, keyboard: `${kbW}x${kbH}`, ...report, errors, storeErrors: storeErrors.length };
  console.log(JSON.stringify(summary));
  fs.writeFileSync(path.join(out, "walk.json"), JSON.stringify(summary, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
