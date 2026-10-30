/**
 * Screenshots the Signup Lab preview frame in a real browser, served from the repo over HTTP so it behaves as it
 * will on Vercel. Used for design review and QA.
 *
 * Usage: node tools/signup/screens.js <outDir> [concept] [market] [--steps]
 *   --steps also walks the experience (types, swipes, opens the signup step) and shoots each state.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const ROOT = path.resolve(__dirname, "..", "..");
const { chromium, devices } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    }).listen(0, () => resolve(server));
  });
}

(async () => {
  const [outDir, conceptArg, marketArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const steps = process.argv.includes("--steps");
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/signup/preview/frame.html`;
  const browser = await chromium.launch();
  const concepts = conceptArg ? [conceptArg] : ["logo-studio", "swipe-match", "pack-and-ship"];
  const viewports = [
    { name: "mobile", ...devices["iPhone 13"] },
    { name: "desktop", viewport: { width: 1440, height: 900 } },
  ];
  const consoleErrors = [];
  for (const c of concepts) for (const v of viewports) {
    const ctx = await browser.newContext({ ...v, name: undefined });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${c}/${v.name}: ${m.text()}`); });
    page.on("pageerror", (e) => consoleErrors.push(`${c}/${v.name}: ${e.message}`));
    await page.goto(`${base}?market=${marketArg || "dkk_dk_den"}&concept=${c}&open=1&reset=1&track=&dry=1`);
    await page.waitForTimeout(1600);
    const shot = (label) => page.screenshot({ path: path.join(outDir, `${c}-${v.name}-${label}.jpg`), type: "jpeg", quality: 80 });
    await shot("1-open");
    if (steps) {
      const host = page.locator("#westpack-signup");
      if (c === "logo-studio") {
        await host.locator(".ls-name-input").fill("Atelier Nord");
        await page.waitForTimeout(1200); await shot("2-typed");
        // as a visitor would tap "done": on a phone the boxes come back once the keyboard closes
        await host.locator(".ls-name-input").evaluate((n) => n.blur());
        await page.waitForTimeout(400);
        await host.locator('.ls-thumb[data-box="london"]').click();
        await host.locator('.ls-chip-type[data-value="script"]').click();
        await page.waitForTimeout(1400); await shot("3-cream-silver-script");
        for (const box of ["bag", "torino", "seoul", "madrid", "frankfurt"]) {
          await host.locator(`.ls-thumb[data-box="${box}"]`).click();
          await host.locator('.ls-chip-type[data-value="classic"]').click();
          await page.waitForTimeout(1300); await shot(`3-box-${box}`);
        }
        await host.locator('.ls-thumb[data-box="seville"]').click();
        await host.locator('.ls-finish[data-finish="matt"]').click();
        await host.locator('.ls-chip-foil[data-value="matt-white"]').click();
        await page.waitForTimeout(1300); await shot("3-box-seville-white");
        await host.locator(".ls-zoom").click();
        await page.waitForTimeout(1300); await shot("3-zoom");
        await host.locator(".ls-zoom").click();
        await host.locator(".ls-next").click();
        await page.waitForTimeout(1200); await shot("4-result");
      }
      if (c === "swipe-match") {
        for (let i = 0; i < 6; i++) { await host.locator(i % 3 === 0 ? ".sm-nope" : ".sm-like").click(); await page.waitForTimeout(650); if (i === 1) await shot("2-swiping"); }
        await page.waitForTimeout(1200); await shot("3-result");
      }
      if (c === "pack-and-ship") {
        await host.locator(".wps-input").fill("not-an-email");
        await host.locator(".wps-btn-primary").click();
        await page.waitForTimeout(700); await shot("2-invalid");
        await host.locator(".wps-input").fill("name@company.com");
        await page.waitForTimeout(500); await shot("3-filled");
        await host.locator(".wps-btn-primary").click();
        await page.waitForTimeout(1400); await shot("4-shipping");
        await page.waitForTimeout(1800); await shot("5-success");
      }
      if (c === "swipe-match") {
        await host.locator(".wps-input").fill("name@company.com");
        await host.locator(".wps-btn-primary").click();
        await page.waitForTimeout(1500); await shot("4-success");
      }
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(consoleErrors.length ? `console errors:\n${consoleErrors.join("\n")}` : "no console errors");
})().catch((e) => { console.error(e); process.exit(1); });
