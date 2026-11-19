/**
 * Logo studio on a desktop must not change when the phone layout does. This records the desktop at 1440x900 and
 * 1280x720 with reduced motion (fixed light, no camera push), open and on the result, and compares a later run with
 * that record: the rects of the main blocks to the pixel, and the screenshots pixel by pixel.
 *
 *   node tools/signup/desktop-diff.js baseline [dir]   records into dir (default tmp/mobile-redesign/baseline-desktop)
 *   node tools/signup/desktop-diff.js compare [dir]    compares this checkout with the record; exits 1 on a difference
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const ROOT = path.resolve(__dirname, "..", "..");
const RUNNER = process.env.PLAYWRIGHT_RUNNER || path.join(ROOT, "tmp", "playwright-runner");
const { chromium } = require(path.join(RUNNER, "node_modules", "playwright"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2" };
const mode = process.argv[2] === "compare" ? "compare" : "baseline";
const dir = path.resolve(process.argv[3] || path.join(ROOT, "tmp", "mobile-redesign", "baseline-desktop"));
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }];
const SELECTORS = [".ls-frame", ".ls-side", ".ls-next", ".ls-edit .wps-title", ".ls-collection", ".ls-result .wps-input"];
// a pixel counts as different when a channel moves by more than this (anti-aliasing noise stays under it)
const CHANNEL = 8;
const MAX_SHARE = 0.005;

const serve = () => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0, () => resolve(s));
});

(async () => {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/signup/preview/frame.html?reset=1&dry=1&track=&concept=logo-studio&market=dkk_dk_den`;
  const browser = await chromium.launch();
  const outDir = mode === "baseline" ? dir : path.join(dir, "..", `${path.basename(dir)}-compare`);
  fs.mkdirSync(outDir, { recursive: true });
  const record = {};
  const errors = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    const host = p.locator("#westpack-signup");
    await host.locator(".ls-name-input").waitFor({ state: "visible", timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(1500);
    const rects = () => p.evaluate((sels) => {
      const r = document.querySelector("#westpack-signup").shadowRoot, o = {};
      for (const s of sels) { const n = r.querySelector(s); const b = n && n.getClientRects().length ? n.getBoundingClientRect() : null; o[s] = b ? [b.x, b.y, b.width, b.height].map((v) => Math.round(v)) : null; }
      return o;
    }, SELECTORS);
    const key = `${vp.width}x${vp.height}`;
    record[`${key}-open`] = await rects();
    await p.screenshot({ path: path.join(outDir, `${key}-open.png`) });
    await host.locator(".ls-name-input").fill("Atelier Nord");
    await host.locator(".ls-next").click();
    await p.waitForTimeout(1500);
    record[`${key}-result`] = await rects();
    await p.screenshot({ path: path.join(outDir, `${key}-result.png`) });
    await ctx.close();
  }
  fs.writeFileSync(path.join(outDir, "rects.json"), JSON.stringify(record, null, 1));
  let failed = errors.length > 0;
  if (errors.length) console.log(`FAIL  JavaScript errors: ${errors.slice(0, 3).join(" | ")}`);
  if (mode === "compare") {
    const base = JSON.parse(fs.readFileSync(path.join(dir, "rects.json"), "utf8"));
    for (const [state, rs] of Object.entries(base)) {
      for (const [sel, r] of Object.entries(rs)) {
        const now = record[state] && record[state][sel];
        const same = JSON.stringify(now) === JSON.stringify(r);
        if (!same) failed = true;
        console.log(`${same ? "PASS" : "FAIL"}  ${state} ${sel}  ${JSON.stringify(r)}${same ? "" : ` -> ${JSON.stringify(now)}`}`);
      }
    }
    // the screenshots are compared in the browser, which already decodes PNG
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png"))) {
      const a = fs.readFileSync(path.join(dir, f)).toString("base64"), b = fs.readFileSync(path.join(outDir, f)).toString("base64");
      const d = await p.evaluate(async ({ a, b, ch }) => {
        const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${s}`; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { size: true, share: 1 };
        const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
        const da = px(ia), db = px(ib);
        let n = 0;
        for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > ch || Math.abs(da[i + 1] - db[i + 1]) > ch || Math.abs(da[i + 2] - db[i + 2]) > ch) n++;
        return { share: n / (da.length / 4), n };
      }, { a, b, ch: CHANNEL });
      const ok = d.share <= MAX_SHARE;
      if (!ok) failed = true;
      console.log(`${ok ? "PASS" : "FAIL"}  ${f}: ${(d.share * 100).toFixed(3)}% of pixels differ${d.size ? " (size differs)" : ""}`);
    }
    await ctx.close();
  } else {
    console.log(`baseline written to ${outDir}`);
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
