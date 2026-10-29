/**
 * Signup Lab quality checks in a real browser. Each check prints PASS or FAIL with what it measured, and the
 * screenshots go to <outDir> for a human look. Uses dry-run signups only.
 *
 * Usage: node tools/signup/qa.js <outDir>
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const ROOT = path.resolve(__dirname, "..", "..");
const { chromium, devices } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2" };
const serve = () => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0, () => resolve(s));
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };

(async () => {
  const outDir = process.argv[2] || path.join(ROOT, "tmp", "signup-qa");
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve();
  const url = (q) => `http://127.0.0.1:${server.address().port}/signup/preview/frame.html?reset=1&dry=1&track=&${q}`;
  const browser = await chromium.launch();
  const errors = [];
  async function page(opts, q) {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${q}: ${e.message}`));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`${q}: ${m.text()}`); });
    const flushes = [];
    await p.exposeFunction("__flush", (x) => flushes.push(x));
    await p.addInitScript(() => addEventListener("message", (e) => { if (e.data && e.data.wps === "flush") window.__flush(e.data.payload); }));
    await p.goto(url(q));
    await p.waitForTimeout(1500);
    return { ctx, p, host: p.locator("#westpack-signup"), flushes };
  }
  const overflow = (p) => p.evaluate(() => { const d = document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps-dialog"); return { sw: d.scrollWidth, cw: d.clientWidth }; });
  const concepts = ["logo-studio", "swipe-match", "pack-and-ship"];

  // 1. small phones: nothing may overflow sideways; the main control must be reachable
  for (const c of concepts) {
    const { ctx, p } = await page({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, `concept=${c}&market=eur_eu_ger`);
    const o = await overflow(p);
    check(`360×640 ${c}: no sideways overflow`, o.sw <= o.cw + 1, `${o.sw}/${o.cw}px`);
    await p.screenshot({ path: path.join(outDir, `small-${c}.jpg`), type: "jpeg", quality: 75 });
    if (c === "swipe-match") {
      const box = await p.locator("#westpack-signup .sm-like").boundingBox();
      check("360×640 swipe-match: like button above the fold", box && box.y + box.height <= 640, box ? `bottom ${Math.round(box.y + box.height)}px` : "missing");
    }
    await ctx.close();
  }

  // 2. long languages on a phone
  for (const [market, lang] of [["eur_eu_fin", "fi"], ["eur_eu_hun", "hu"], ["pln_pl_pol", "pl"], ["eur_eu_por", "pt"]]) for (const c of concepts) {
    const { ctx, p } = await page({ ...devices["iPhone 13"] }, `concept=${c}&market=${market}`);
    const o = await overflow(p);
    check(`${lang} ${c}: no sideways overflow`, o.sw <= o.cw + 1, `${o.sw}/${o.cw}px`);
    if (c === "logo-studio") await p.screenshot({ path: path.join(outDir, `lang-${lang}-${c}.jpg`), type: "jpeg", quality: 70 });
    await ctx.close();
  }

  // 3. keyboard: focus starts inside, Tab stays inside, Escape closes and hands focus back
  {
    const { ctx, p, flushes } = await page({ viewport: { width: 1440, height: 900 } }, "concept=logo-studio&market=gbp_uk_eng");
    await p.waitForTimeout(500);
    const inside = () => p.evaluate(() => { const r = document.querySelector("#westpack-signup").shadowRoot; return Boolean(r.activeElement && r.querySelector(".wps-dialog").contains(r.activeElement)); });
    check("keyboard: focus starts in the dialog", await inside());
    for (let i = 0; i < 25; i++) await p.keyboard.press("Tab");
    check("keyboard: 25 × Tab stays in the dialog", await inside());
    // type into the name field (a space typed on a focused button would press it), then leave with Escape
    await p.locator("#westpack-signup .ls-name-input").focus();
    await p.keyboard.type("Nord Atelier");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    const open = await p.evaluate(() => document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps").classList.contains("is-open"));
    check("keyboard: Escape closes", !open);
    const f = flushes[flushes.length - 1];
    check("tracking: closing records the step it happened on", f && f.outcome === "closed" && f.closeStep === "close_escape" && f.steps.some((s) => s.n === "open"), f ? `${f.outcome}, steps ${f.steps.map((s) => s.n).join(">")}` : "no record");
    check("tracking: the record holds no email or name", f && !JSON.stringify(f).includes("@") && !JSON.stringify(f).includes("Nord"));
    await ctx.close();
  }

  // 4. reduced motion: the wrapper says so, and swiping still works with buttons
  {
    const { ctx, p, host } = await page({ ...devices["iPhone 13"], reducedMotion: "reduce" }, "concept=swipe-match&market=dkk_dk_den");
    const flag = await p.evaluate(() => document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps").dataset.reduced);
    check("reduced motion is detected", flag === "true", flag);
    for (let i = 0; i < 6; i++) { await host.locator(".sm-like").click(); await p.waitForTimeout(250); }
    check("reduced motion: swipe reaches the result", await host.locator(".sm-result:not([hidden])").count() === 1);
    await ctx.close();
  }

  // 5. slow network: nothing shows before its own CSS has arrived (no unstyled flash)
  {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
    const t0 = Date.now();
    await p.goto(url("concept=pack-and-ship&market=dkk_dk_den"));
    let unstyled = false, openedAt = 0;
    for (let i = 0; i < 80 && !openedAt; i++) {
      const s = await p.evaluate(() => { const h = document.querySelector("#westpack-signup"); if (!h) return null; const r = h.shadowRoot; const w = r.querySelector(".wps"); return { open: w && w.classList.contains("is-open"), styled: r.querySelectorAll("link[rel=stylesheet]").length >= 2 && getComputedStyle(r.querySelector(".wps-dialog")).position === "fixed" }; }).catch(() => null);
      if (s && s.open) { openedAt = Date.now() - t0; unstyled = !s.styled; }
      await p.waitForTimeout(250);
    }
    check("slow 3G: opens styled, never as raw HTML", openedAt > 0 && !unstyled, openedAt ? `opened after ${(openedAt / 1000).toFixed(1)} s` : "did not open in 20 s");
    await p.screenshot({ path: path.join(outDir, "slow-3g-pack.jpg"), type: "jpeg", quality: 70 });
    await ctx.close();
  }

  // 6. missing images: the experience still works and still asks for nothing broken
  {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    await ctx.route("**/*.webp", (r) => r.abort());
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`noimg: ${e.message}`));
    await p.goto(url("concept=logo-studio&market=dkk_dk_den"));
    await p.waitForTimeout(1500);
    const host = p.locator("#westpack-signup");
    await host.locator(".ls-name-input").fill("Atelier Nord");
    await host.locator(".ls-next").click();
    await p.waitForTimeout(500);
    check("missing images: the signup step is still reachable", await host.locator(".wps-form .wps-input").count() === 1);
    await p.screenshot({ path: path.join(outDir, "no-images-logo.jpg"), type: "jpeg", quality: 70 });
    await ctx.close();
  }

  // 7. double opt-in markets get the confirm-your-email message
  {
    const { ctx, p, host } = await page({ ...devices["iPhone 13"] }, "concept=pack-and-ship&market=eur_eu_ger&doi=1");
    await host.locator(".wps-input").fill("name@firma.de");
    await host.locator(".wps-btn-primary").click();
    await p.waitForTimeout(2600);
    const txt = await host.locator(".ps-success").innerText().catch(() => "");
    check("double opt-in: success tells them to confirm", /bestätig|E-Mail|Postfach/i.test(txt), txt.replace(/\s+/g, " ").slice(0, 90));
    await ctx.close();
  }

  await browser.close();
  server.close();
  check("no JavaScript errors in any run", errors.length === 0, errors.slice(0, 3).join(" | "));
  fs.writeFileSync(path.join(outDir, "qa-results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
