// The whole Logo studio flow on a phone, on the real store, as a visitor gets it: peek card, open, type, scroll,
// result, thank-you. Every frame of the scrolling sheet is shot, not just the first screen.
//   node tools/signup/mobile-walk.js <outDir> [--local] [--store=eur_eu_cze] [--device=iPhone 13] [--name=Atelier Sever]
// --local serves signup/ from this checkout instead of production. Tracking is blocked and Klaviyo's client
// endpoints are answered with 202 here: nothing leaves the browser. Run it from the checkout's root.
const fs = require("fs");
const path = require("path");
// signup/ is served from the checkout this runs in (a worktree works); Playwright comes from the main checkout,
// because tmp/ is gitignored and a worktree has none
const REPO = path.resolve(__dirname, "..", "..");
const RUNNER = process.env.PLAYWRIGHT_RUNNER || "C:/Projects/westpack-meta-control/tmp/playwright-runner";
const { chromium, devices } = require(`${RUNNER}/node_modules/playwright`);
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const local = args.includes("--local");
const store = opt("store", "eur_eu_cze"), deviceName = opt("device", "iPhone 13"), name = opt("name", "Atelier Sever");
const PROD = "https://project-4fcxa.vercel.app";
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[deviceName] });
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
  page.on("pageerror", (e) => errors.push(e.message));
  let n = 0;
  const shot = async (label) => { n += 1; await page.screenshot({ path: path.join(out, `${String(n).padStart(2, "0")}-${label}.png`) }); };
  const host = page.locator("#westpack-signup");

  // a fresh visitor on the live store: the peek card comes by itself
  await page.goto(`https://www.westpack.com/${store}/?wps=reset`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const b = page.locator("#coiOverlay .coi-banner__accept").first();
  try { await b.waitFor({ state: "visible", timeout: 10000 }); await b.click(); } catch (e) { /* none */ }
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 900);
  let peeked = false;
  try { await host.locator(".wps-peek.is-in").waitFor({ timeout: 15000 }); peeked = true; } catch (e) { /* live off here */ }
  if (peeked) {
    await page.waitForTimeout(900);
    await shot("peek");
    await host.locator(".wps-peek-cta").click();
  } else {
    await page.goto(`https://www.westpack.com/${store}/?wps=logo-studio`, { waitUntil: "domcontentloaded" });
  }
  await host.locator(".ls-name-input").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(600); await shot("open-intro");
  await page.waitForTimeout(2600); await shot("open");

  // the whole sheet, frame by frame
  const scrollShots = async (label) => {
    const h = await page.evaluate(() => { const d = document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps-dialog"); d.scrollTop = 0; return { total: d.scrollHeight, view: d.clientHeight }; });
    let y = 0, i = 0;
    while (true) {
      await page.evaluate((y) => { document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps-dialog").scrollTop = y; }, y);
      await page.waitForTimeout(700);
      await shot(`${label}-scroll${i}`);
      if (y + h.view >= h.total - 2 || i > 6) break;
      y += Math.round(h.view * 0.8); i += 1;
    }
    await page.evaluate(() => { document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps-dialog").scrollTop = 0; });
    return h;
  };
  const h1 = await scrollShots("edit");

  await host.locator(".ls-name-input").click();
  await page.waitForTimeout(500); await shot("name-focused");
  await host.locator(".ls-name-input").pressSequentially(name, { delay: 60 });
  await page.waitForTimeout(900); await shot("name-typed");
  await host.locator(".ls-name-input").blur();
  await page.waitForTimeout(600);
  await scrollShots("typed");

  await host.locator(".ls-next").click();
  await page.waitForTimeout(2200);
  const h2 = await scrollShots("result");

  await host.locator(".ls-result .wps-input").fill("navn@firma.cz");
  await host.locator(".ls-result .wps-form .wps-btn-primary").click();
  await page.waitForTimeout(2500);
  await shot("success");
  console.log(JSON.stringify({ peeked, editSheet: h1, resultSheet: h2, errors }, null, 0));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
