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
const { chromium, webkit, devices } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));
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
  const concepts = ["logo-studio", "pack-and-ship", "new-year-sale"];
  const { MARKETS } = require(path.join(ROOT, "signup", "core", "markets.js"));
  const byLang = {};
  for (const [code, m] of Object.entries(MARKETS)) if (!byLang[m.lang] && m.lang !== "da") byLang[m.lang] = code;
  // QA_ONLY=studio runs only the phone studio's checks (section 9), for iterating on that layout
  if (process.env.QA_ONLY === "studio") {
    await phoneStudio({ browser, url, check, errors, outDir, devices, byLang, webkit });
    await browser.close(); server.close();
    check("no JavaScript errors in any run", errors.length === 0, errors.slice(0, 3).join(" | "));
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }

  // 1. small phones: nothing may overflow sideways; the main control must be reachable
  for (const c of concepts) {
    const { ctx, p } = await page({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, `concept=${c}&market=eur_eu_ger`);
    const o = await overflow(p);
    check(`360×640 ${c}: no sideways overflow`, o.sw <= o.cw + 1, `${o.sw}/${o.cw}px`);
    await p.screenshot({ path: path.join(outDir, `small-${c}.jpg`), type: "jpeg", quality: 75 });
    await ctx.close();
  }

  // 2. every store language on a phone (one store per language)
  for (const [lang, market] of Object.entries(byLang)) for (const c of concepts) {
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

  // 4. reduced motion: the wrapper says so, and a signup still reaches its thank-you (Pack & ship ships at once)
  {
    const { ctx, p, host } = await page({ ...devices["iPhone 13"], reducedMotion: "reduce" }, "concept=pack-and-ship&market=dkk_dk_den");
    const flag = await p.evaluate(() => document.querySelector("#westpack-signup").shadowRoot.querySelector(".wps").dataset.reduced);
    check("reduced motion is detected", flag === "true", flag);
    await host.locator(".wps-input").fill("name@company.com");
    await host.locator(".wps-btn-primary").click();
    await p.waitForTimeout(1200);
    check("reduced motion: a signup reaches the thank-you", await host.locator(".ps-success:not([hidden])").count() === 1);
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

  // 6b. a long name fits every lid it is shown on - also the ones that were hidden while it was typed: a phone's
  // pieces during typing, the phone's hero and strip on the result, and the desktop's collection until the result
  for (const [label, opts] of [["phone", { ...devices["iPhone 13"] }], ["desktop", { viewport: { width: 1440, height: 900 } }]]) {
    const { ctx, p, host } = await page(opts, "concept=logo-studio&market=dkk_dk_den");
    await p.waitForTimeout(1500);
    await host.locator(".ls-name-input").fill("Smykkehuset Lund Copenhagen");
    await host.locator(".ls-name-input").blur();
    await p.waitForTimeout(400);
    const overflowing = (sel) => p.evaluate((sel) => [...document.querySelector("#westpack-signup").shadowRoot.querySelectorAll(sel)].map((svg) => {
      const b = svg.querySelector("text").getBBox(), w = svg.viewBox.baseVal.width;
      return !b.width || b.x < -1 || b.x + b.width > w + 1 ? `${Math.round(b.x)}..${Math.round(b.x + b.width)} of ${w}` : "";
    }).filter(Boolean), sel);
    if (label === "phone") {
      const thumbsOver = await overflowing(".ls-thumb .ls-print");
      check("a long name fits every thumbnail after typing on a phone", thumbsOver.length === 0, thumbsOver.join(", "));
    }
    await host.locator(".ls-next").click();
    await p.waitForTimeout(800);
    if (label === "phone") {
      // the phone's result has no strip of pieces since 2026-11-20; its pieces stay in the hidden strip, unmeasured
      const over = await overflowing(".ls-frame .ls-print");
      check("phone: a long name fits the hero on the result", over.length === 0, over.join(", "));
    } else {
      const tilesOver = await overflowing(".ls-tile .ls-print");
      check("desktop: a long name fits every lid in the collection", tilesOver.length === 0, tilesOver.join(", "));
    }
    await ctx.close();
  }

  // 6c. the carrier bag and the 25 foils: the bag is one of the pieces and takes the print; the picker shows one
  // finish at a time, keeps the colour across finishes where it can, and names the foil in words; the chosen piece
  // leads the collection, largest, and every print there sits inside its frame
  for (const opts of [{ viewport: { width: 1440, height: 900 } }, { ...devices["iPhone 13"] }]) {
    const label = opts.viewport && opts.viewport.width === 1440 ? "desktop" : "phone";
    const { ctx, p, host } = await page(opts, "concept=logo-studio&market=dkk_dk_den");
    await p.waitForTimeout(1200);
    await host.locator(".ls-name-input").fill("Atelier Nord");
    await host.locator(".ls-name-input").blur();
    const pieces = await host.locator(".ls-thumb").count();
    check(`${label}: seven pieces, the carrier bag among them`, pieces === 7 && (await host.locator('.ls-thumb[data-box="bag"]').count()) === 1, `${pieces} thumbnails`);
    await host.locator('.ls-thumb[data-box="bag"]').click();
    await p.waitForTimeout(1400);
    const onBag = await p.evaluate(() => { const r = document.querySelector("#westpack-signup").shadowRoot; const f = r.querySelector(".ls-frame").getBoundingClientRect(), t = r.querySelector(".ls-frame .ls-print text").getBoundingClientRect(); return { inside: t.width > 20 && t.left > f.left && t.right < f.right && t.top > f.top && t.bottom < f.bottom, box: r.querySelector(".ls").dataset.box }; });
    check(`${label}: the name is printed on the bag`, onBag.inside && onBag.box === "bag", JSON.stringify(onBag));
    if (label === "phone") {
      // a phone is the essentials since 2026-11-20: the name and the seven pieces in one view, no tabs, no foil or
      // lettering to choose; each piece shows its own natural foil (the bag's is metallic gold)
      const ess = await p.evaluate(() => { const r = document.querySelector("#westpack-signup").shadowRoot; return { tabs: r.querySelectorAll(".ls-tab").length, choices: r.querySelectorAll(".ls-chip-foil, .ls-chip-type, .ls-finish").length, foil: r.querySelector(".ls").dataset.foil }; });
      check("phone: no tabs and no foil or lettering to choose; the bag shows its own foil", ess.tabs === 0 && ess.choices === 0 && ess.foil === "metallic-gold", JSON.stringify(ess));
    } else {
    const picker = () => p.evaluate(() => { const r = document.querySelector("#westpack-signup").shadowRoot; return { finish: [...r.querySelectorAll(".ls-finish")].find((b) => b.getAttribute("aria-pressed") === "true").dataset.finish, shown: [...r.querySelectorAll(".ls-chip-foil")].filter((b) => !b.hidden).length, foil: r.querySelector(".ls").dataset.foil, name: r.querySelector(".ls-foil-now").textContent }; });
    let s = await picker();
    check(`${label}: the picker opens on the piece's own finish and shows only its colours`, s.finish === "metallic" && s.shown === 9 && s.foil === "metallic-gold" && s.name === "Metallisk guld", JSON.stringify(s));
    await host.locator('.ls-finish[data-finish="matt"]').click(); await p.waitForTimeout(300);
    s = await picker();
    check(`${label}: matt has twelve colours (the module's wine red among them) and gold falls back to its first`, s.shown === 12 && s.foil === "matt-black" && s.name === "Mat sort", JSON.stringify(s));
    await host.locator('.ls-finish[data-finish="gloss"]').click(); await p.waitForTimeout(300);
    s = await picker();
    check(`${label}: black stays black from matt to gloss`, s.shown === 5 && s.foil === "gloss-black" && s.name === "Blank sort", JSON.stringify(s));
    await host.locator('.ls-finish[data-finish="matt"]').click(); await p.waitForTimeout(200);
    await host.locator('.ls-chip-foil[data-value="matt-clear"]').click(); await p.waitForTimeout(400);
    s = await picker();
    check(`${label}: the transparent foil is named alone`, s.name === "Gennemsigtig", JSON.stringify(s));
    }
    await host.locator(".ls-next").click();
    await p.waitForTimeout(1400);
    if (label === "phone") {
      // the phone's reward is the chosen piece, the print whole in its window, and the card; no strip of pieces there
      const res = await p.evaluate(() => {
        const r = document.querySelector("#westpack-signup").shadowRoot, ls = r.querySelector(".ls"), strip = r.querySelector(".ls-strip");
        const f = r.querySelector(".ls-frame").getBoundingClientRect(), t = r.querySelector(".ls-frame .ls-print text").getBoundingClientRect();
        return { box: ls.dataset.box, strip: Boolean(strip && strip.getClientRects().length), heroInside: t.width > 20 && t.left >= f.left && t.right <= f.right && t.top >= f.top && t.bottom <= f.bottom };
      });
      check("phone: the hero shows the chosen piece (bag), its print inside the window, and no strip of pieces", res.box === "bag" && !res.strip && res.heroInside, JSON.stringify(res));
      await p.screenshot({ path: path.join(outDir, `bag-result-${label}.jpg`), type: "jpeg", quality: 75 });
    } else {
      const col = await p.evaluate(() => { const r = document.querySelector("#westpack-signup").shadowRoot; const tiles = [...r.querySelectorAll(".ls-tile")]; const area = (t) => { const b = t.querySelector(".ls-tile-frame").getBoundingClientRect(); return b.width * b.height; }; const chosen = r.querySelector(".ls-tile.is-chosen"); return { chosen: chosen && chosen.dataset.box, largest: chosen && tiles.every((t) => t === chosen || area(t) < area(chosen)), inside: tiles.every((t) => { const f = t.querySelector(".ls-tile-frame").getBoundingClientRect(), b = t.querySelector(".ls-print text").getBoundingClientRect(); return b.width > 2 && b.left >= f.left - 1 && b.right <= f.right + 1 && b.top >= f.top - 1 && b.bottom <= f.bottom + 1; }) }; });
      check(`${label}: the chosen piece leads the collection, largest, and every print sits in its frame`, col.chosen === "bag" && col.largest && col.inside, JSON.stringify(col));
      await p.screenshot({ path: path.join(outDir, `bag-collection-${label}.jpg`), type: "jpeg", quality: 75 });
    }
    // after the signup the thank-you stands alone: the form, the promise list and the consent go (they once stayed,
    // because their own display beat the hidden attribute) and the thank-you is in view
    await host.locator(".ls-result .wps-input").fill("navn@firma.dk");
    await host.locator(".ls-result .wps-form .wps-btn-primary").click();
    await host.locator(".ls-success:not([hidden])").waitFor({ timeout: 8000 });
    await p.waitForTimeout(700);
    const after = await p.evaluate(() => {
      const r = document.querySelector("#westpack-signup").shadowRoot;
      const shown = (n) => getComputedStyle(n).display !== "none" && n.getClientRects().length > 0;
      const t = r.querySelector(".ls-success-title").getBoundingClientRect();
      return { leftovers: [...r.querySelectorAll(".ls-result > *")].filter((n) => !n.classList.contains("ls-success") && shown(n)).map((n) => n.className || n.tagName), titleInView: t.height > 0 && t.top >= 0 && t.bottom <= innerHeight };
    });
    check(`${label}: after the signup only the thank-you shows, and it is in view`, after.leftovers.length === 0 && after.titleInView, JSON.stringify(after));
    await p.screenshot({ path: path.join(outDir, `logo-success-${label}.jpg`), type: "jpeg", quality: 75 });
    await ctx.close();
  }

  // 7. the logo studio's foil: light follows the mouse, the loupe opens, an uploaded logo becomes a foil mask
  {
    const { ctx, p, host } = await page({ viewport: { width: 1440, height: 900 } }, "concept=logo-studio&market=gbp_uk_eng");
    // after the opening: the camera push, the first press and its light sweep
    await p.waitForTimeout(2600);
    const lightX = () => p.evaluate(() => { const l = document.querySelector("#westpack-signup").shadowRoot.querySelector("fePointLight"); return l ? Number(l.getAttribute("x")) : NaN; });
    const box = await host.locator(".ls-frame").boundingBox();
    await p.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5); await p.waitForTimeout(150);
    const a = await lightX();
    await p.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5); await p.waitForTimeout(150);
    const b = await lightX();
    check("foil light follows the mouse", b - a > 600, `light x ${a} -> ${b}`);
    check("loupe opens over the box on a desktop", await host.locator(".ls-loupe.is-on").count() === 1);
    // a dark logo on a white background, made in the page so the test needs no fixture file
    const png = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 160; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 160); g.fillStyle = "#111"; g.font = "bold 90px Georgia"; g.fillText("Nord", 70, 115); return c.toDataURL("image/png").split(",")[1]; });
    await host.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    await p.waitForTimeout(800);
    const mode = await p.evaluate(() => { const r = document.querySelector("#westpack-signup").shadowRoot; const t = r.querySelector(".ls-frame text"), m = r.querySelector(".ls-frame mask image"); return { textHidden: t.getAttribute("display") === "none", maskSet: Boolean(m && (m.getAttribute("href") || "").startsWith("data:image/png")) }; });
    check("an uploaded logo becomes a one-colour foil mask", mode.textHidden && mode.maskSet, JSON.stringify(mode));
    await p.screenshot({ path: path.join(outDir, "logo-upload.jpg"), type: "jpeg", quality: 75 });
    await host.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
    await p.waitForTimeout(400);
    const hintText = await host.locator(".ls-hint").innerText();
    check("a file that is not an image gets a plain message", /couldn|PNG/i.test(hintText), hintText);
    await ctx.close();
  }

  // 8. double opt-in markets get the confirm-your-email message
  {
    const { ctx, p, host } = await page({ ...devices["iPhone 13"] }, "concept=pack-and-ship&market=eur_eu_ger&doi=1");
    await host.locator(".wps-input").fill("name@firma.de");
    await host.locator(".wps-btn-primary").click();
    await p.waitForTimeout(2600);
    const txt = await host.locator(".ps-success").innerText().catch(() => "");
    check("double opt-in: success tells them to confirm", /bestätig|E-Mail|Postfach/i.test(txt), txt.replace(/\s+/g, " ").slice(0, 90));
    await ctx.close();
  }

  // 9. Logo studio on phones and tablets: the studio (tmp/mobile-redesign/SPEC.md, section 10)
  await phoneStudio({ browser, url, check, errors, outDir, devices, byLang, webkit });

  await browser.close();
  server.close();
  check("no JavaScript errors in any run", errors.length === 0, errors.slice(0, 3).join(" | "));
  fs.writeFileSync(path.join(outDir, "qa-results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// ---- 9. Logo studio on phones and tablets ----
// The acceptance criteria of tmp/mobile-redesign/SPEC.md section 10 that run locally; the numbers in the check names
// are the criteria's. Read in the page: rects as { l, t, r, b, w, h }, everything from the shadow root.
function LS_HELPERS() {
  const root = () => document.querySelector("#westpack-signup").shadowRoot;
  const q = (s) => root().querySelector(s);
  const qa = (s) => [...root().querySelectorAll(s)];
  const rect = (n) => { if (typeof n === "string") n = q(n); if (!n || !n.getClientRects().length) return null; const b = n.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const shown = (n) => n.getClientRects().length > 0 && (n.checkVisibility ? n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true }) : getComputedStyle(n).visibility !== "hidden");
  const hit = (a, b) => Boolean(a && b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5);
  const inside = (a, b, tol = 0.5) => Boolean(a && b && a.l >= b.l - tol && a.r <= b.r + tol && a.t >= b.t - tol && a.b <= b.b + tol);
  const inView = (a) => Boolean(a && a.t >= -0.5 && a.l >= -0.5 && a.b <= innerHeight + 0.5 && a.r <= innerWidth + 0.5);
  const name = (n) => `${(n.className && n.className.baseVal === undefined ? n.className : n.tagName).toString().split(" ")[0] || n.tagName}${n.dataset && (n.dataset.tool || n.dataset.box || n.dataset.value) ? `[${n.dataset.tool || n.dataset.box || n.dataset.value}]` : ""}`;
  // every visible control in the open sheet is a 44 x 44 target (the consent's inline link and the file input excepted)
  function smallTargets() {
    return qa(".wps-dialog button, .wps-dialog input, .wps-dialog [role=tab], .wps-dialog a").filter(shown)
      .filter((n) => !(n.tagName === "A" && n.closest(".wps-consent")) && n.type !== "file")
      .map((n) => { const b = n.getBoundingClientRect(); return b.width < 43.5 || b.height < 43.5 ? `${name(n)} ${Math.round(b.width)}x${Math.round(b.height)}` : ""; }).filter(Boolean);
  }
  // nothing visible sits on the close button, nor on the back button on the result (the photo and the print excepted)
  function overClose() {
    const c = rect(".wps-close"), back = q(".ls-back"), br = back && shown(back) ? rect(back) : null, out = [];
    for (const n of qa(".wps-dialog button, .wps-dialog input, .wps-dialog a, .wps-dialog [role=tab], .wps-dialog p, .wps-dialog h2, .wps-dialog li, .wps-dialog label, .wps-dialog figcaption, .wps-dialog .ls-foil-now, .wps-dialog .ls-upload-hint")) {
      if (n.closest(".wps-close") || !shown(n)) continue;
      const r = rect(n);
      if (!r || r.w * r.h < 4) continue;
      if (hit(r, c)) out.push(`${name(n)} on close`);
      if (br && !n.closest(".ls-back") && hit(r, br)) out.push(`${name(n)} on back`);
    }
    return out;
  }
  const overflowX = () => { const d = q(".wps-dialog"); return d.scrollWidth > d.clientWidth + 1 ? [`${d.scrollWidth}/${d.clientWidth}`] : []; };
  // where the print's far corner really lands, against where the measured quad puts it, as a share of the scene
  function far() {
    const wrap = q(".ls-frame .ls-print-wrap"), sc = q(".ls-frame > .ls-scene");
    const [x, y] = wrap.dataset.far.split(",").map(Number), w = parseFloat(wrap.style.width), h = parseFloat(wrap.style.height);
    const probe = document.createElement("i");
    probe.style.cssText = `position:absolute;left:${w - 1}px;top:${h - 1}px;width:2px;height:2px`;
    wrap.appendChild(probe);
    const r = probe.getBoundingClientRect(), f = sc.getBoundingClientRect();
    probe.remove();
    const k = f.width / 1000;
    return Math.hypot((r.left + r.right) / 2 - f.left - x * k, (r.top + r.bottom) / 2 - f.top - y * k) / f.width;
  }
  function state() {
    const sc = q(".ls-frame > .ls-scene");
    return { k: sc.style.getPropertyValue("--k"), sceneW: sc.getBoundingClientRect().width, dialogW: q(".wps-dialog").getBoundingClientRect().width, frame: rect(".ls-frame"), print: rect(".ls-frame .ls-print text"), engine: q(".ls").dataset.engine, tool: q(".ls").dataset.tool, far: far(), kb: q(".wps").classList.contains("is-kb") };
  }
  window.__ls = { root, q, qa, rect, shown, hit, inside, inView, smallTargets, overClose, overflowX, far, state };
}

// one look at a store in a language at rest, on each of the four tools (criteria 1, 2, 3, 4, 7, 9, 10, 11, 12, 19)
async function SWEEP() {
  const L = window.__ls, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const o = { c1: [], c2: [], c3: [], c4: [], c7: [], c9: [], c10: [], c11: [], c12: [], c19: [] };
  const W = innerWidth, d = L.q(".wps-dialog");
  if (L.q(".ls").dataset.engine !== "projective") o.c19.push(`engine ${L.q(".ls").dataset.engine}`);
  // the phone's studio since 2026-11-20: stage, question, field, the seven pieces, button - all in view, no tabs
  const fr = L.rect(".ls-frame"), ti = L.rect(".ls-edit .wps-title"), inp = L.rect(".ls-name-input"), row = L.rect(".ls-tool .ls-thumbs"), cta = L.rect(".ls-next");
  if (!(fr && ti && inp && row && cta && fr.t < ti.t && ti.t < inp.t && inp.t < row.t && row.t < cta.t)) o.c1.push("order");
  for (const [k, r] of [["question", ti], ["field", inp], ["pieces", row], ["button", cta]]) if (!L.inView(r)) o.c1.push(`${k} not in view`);
  if (L.qa(".ls-tab").length) o.c1.push("a tab bar");
  // the stage never goes below the window that holds the print on every piece (qa F checks the print in it)
  const dr = L.rect(d);
  if (!fr || fr.h < 0.56 * dr.w - 0.5) o.c4.push(`stage ${fr && fr.h.toFixed(0)} of ${Math.round(dr.w)}`);
  // a normal popup since 2026-11-23: a card in the middle of the view, clear of every edge, with the store in sight
  // around it (the user: the sheet filled an iPhone's screen); a view under 600px (the first iPhone SE) gives it
  // nearly the whole height, because the print's window and the panel come first
  if (dr.l < 8 || innerWidth - dr.r < 8 || dr.t < 8 || innerHeight - dr.b < 8) o.c3.push(`card at ${Math.round(dr.l)},${Math.round(dr.t)} ${Math.round(dr.w)}x${Math.round(dr.h)}: not clear of the edges`);
  if (Math.abs(dr.t - (innerHeight - dr.b)) > 2) o.c3.push(`card not centred: ${Math.round(dr.t)} above, ${Math.round(innerHeight - dr.b)} below`);
  if (innerHeight >= 600 && dr.h > 0.8 * innerHeight + 0.5) o.c3.push(`card ${Math.round(dr.h)} of ${innerHeight}`);
  // the question is never cut to an ellipsis, in any language
  const qn = L.q(".ls-edit .wps-title");
  if (qn.scrollHeight > qn.clientHeight + 1) o.c9.push(`the question is cut: "${qn.textContent.slice(0, 40)}"`);
  // the seven pieces in one row, scrolling at most a few pixels
  const pieces = L.qa(".ls-tool .ls-thumb").map((b) => L.rect(b));
  // (the chosen piece stands 2px proud of the row; under 360px seven 44px buttons cannot fit, and the row scrolls)
  const mid = pieces.map((r) => r.t + r.h / 2).sort((x, y) => x - y)[3];
  if (pieces.length !== 7 || pieces.some((r) => Math.abs(r.t + r.h / 2 - mid) > 3)) o.c7.push(`pieces ${pieces.length}, not one row`);
  const thumbs = L.q(".ls-tool .ls-thumbs");
  if (W >= 360 && thumbs.scrollWidth > thumbs.clientWidth + 8) o.c7.push(`row ${thumbs.scrollWidth}/${thumbs.clientWidth}`);
  // the photo carries no small print on a phone (2026-11-23: the visualisation line sat over it, beside the close
  // button, as the first thing seen); the upload button says "Logo" under its icon, inside its square
  if (L.q(".ls-frame .ls-illustration")) o.c9.push("the visualisation line is on the photo");
  const up = L.rect(".ls-upload"), short = L.rect(".ls-upload-short");
  if (!short || short.w < 8 || !L.inside(short, up, 0.5)) o.c9.push("the upload button's word is missing or spills out");
  await wait(50);
  const tl = L.q(".ls-tools");
  if (d.scrollHeight > d.clientHeight + 1) o.c2.push(`dialog ${d.scrollHeight}/${d.clientHeight}`);
  if (tl.scrollHeight > tl.clientHeight + 1) o.c2.push(`tools ${tl.scrollHeight}/${tl.clientHeight}`);
  o.c10.push(...L.overClose());
  o.c11.push(...L.smallTargets());
  o.c12.push(...L.overflowX());
  return o;
}

const PHONES = ["iPhone SE", "Galaxy S8", "iPhone 13", "iPhone 14 Pro Max"];
// the tall Androids most Czech visitors hold (round 2's review): there the edit sheet is shorter than the view, so the
// sheet's own height can change between states. The flow and the motion check run on them too
const TALL = ["Pixel 7 360x800", "Pixel 7 412x915"];
const phoneOpts = (devices, name) => {
  const m = /^(.+) (\d+)x(\d+)$/.exec(name);
  return m && devices[m[1]] ? { ...devices[m[1]], viewport: { width: Number(m[2]), height: Number(m[3]) } } : { ...devices[name] };
};
// the view a phone keeps above its keyboard, simulated by shrinking the viewport once the field has focus
const KB = {
  "iPhone SE": { width: 320, height: 250 }, "Galaxy S8": { width: 360, height: 440 }, "iPhone 13": { width: 390, height: 330 }, "iPhone 14 Pro Max": { width: 430, height: 390 },
  "Pixel 7 360x800": { width: 360, height: 440 }, "Pixel 7 412x915": { width: 412, height: 500 },
};
const PIECES = ["seville", "london", "bag", "torino", "seoul", "madrid", "frankfurt"];

async function phoneStudio({ browser, url, check, errors, outDir, devices, byLang, webkit }) {
  const markets = [...Object.values(byLang), "dkk_dk_den"];
  // QA_SKIP=sweep,flow,perf,tablet,motion,cover,webkit leaves parts out while iterating; a full run runs them all
  const skip = new Set((process.env.QA_SKIP || "").split(","));
  const open = async (ctx, q, label) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
    await p.addInitScript(LS_HELPERS);
    await p.goto(url(q));
    await p.locator("#westpack-signup .ls-name-input").waitFor({ state: "attached", timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    return p;
  };
  const report = (label, list) => check(label, list.length === 0, list.slice(0, 4).join("; ") + (list.length > 4 ? ` (+${list.length - 4})` : ""));
  // compares two PNG screenshots in the browser: the share of pixels that differ
  const pixelShare = (p, a, b) => p.evaluate(async ({ a, b }) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${s}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const da = px(ia), db = px(ib);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) n++;
    return n / (da.length / 4);
  }, { a: a.toString("base64"), b: b.toString("base64") });
  // What on the stage covers the print. The print's own pixels are the frame shot with the print against the same
  // shot without it (every overlay hidden in both); then each overlay that was visible - anything in the frame but the
  // scene, and the close button - counts how many of them lie under it. share 0 means it sits on none of the print.
  const coverage = async (p) => {
    const info = await p.evaluate(() => {
      const L = window.__ls, fr = L.q(".ls-frame"), f = L.rect(fr);
      const els = [...fr.children].filter((n) => !n.classList.contains("ls-scene")).flatMap((n) => (n.classList.contains("ls-under") ? [...n.children] : [n]));
      els.push(L.q(".wps-close"));
      const ov = els.filter((n) => L.shown(n) && (n.tagName === "BUTTON" || n.textContent.trim())).map((n) => {
        const cs = getComputedStyle(n), r = L.rect(n);
        return { name: n.className.split(" ")[0], ...r, lines: Math.round((r.h - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / (parseFloat(cs.lineHeight) || r.h)) };
      });
      return { f, ov, vw: innerWidth, vh: innerHeight };
    });
    const x = Math.max(0, info.f.l), y = Math.max(0, info.f.t);
    const clip = { x, y, width: Math.min(info.f.r, info.vw) - x, height: Math.min(info.f.b, info.vh) - y };
    const hideOverlays = (v) => p.evaluate((v) => { const L = window.__ls; [...L.q(".ls-frame").children].filter((n) => !n.classList.contains("ls-scene")).forEach((n) => { n.style.visibility = v; }); L.q(".wps-close").style.visibility = v; }, v);
    const hidePrint = (v) => p.evaluate((v) => { window.__ls.q(".ls-frame .ls-print-wrap").style.visibility = v; }, v);
    await hideOverlays("hidden"); await p.waitForTimeout(80);
    const a = await p.screenshot({ clip });
    await hidePrint("hidden"); await p.waitForTimeout(80);
    const b = await p.screenshot({ clip });
    await hidePrint(""); await hideOverlays("");
    const res = await p.evaluate(async ({ a, b, clip, ov }) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = `data:image/png;base64,${s}`; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const da = px(ia), db = px(ib), W = ia.width, sc = ia.width / clip.width;
      let all = 0; const under = ov.map(() => 0);
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) <= 40) continue;
        all++;
        const j = i / 4, X = clip.x + (j % W) / sc, Y = clip.y + Math.floor(j / W) / sc;
        ov.forEach((o, k) => { if (X >= o.l && X <= o.r && Y >= o.t && Y <= o.b) under[k]++; });
      }
      return { all, under };
    }, { a: a.toString("base64"), b: b.toString("base64"), clip, ov: info.ov });
    return { printPx: res.all, hits: info.ov.map((o, k) => ({ name: o.name, lines: o.lines, share: res.all ? res.under[k] / res.all : 0 })) };
  };
  const covering = (c) => c.hits.filter((h) => h.share > 0).map((h) => `${h.name} on ${(h.share * 100).toFixed(1)}%`);

  // ---- A. every language on every phone, at rest and on each tool ----
  for (const phone of skip.has("sweep") ? [] : PHONES) {
    const ctx = await browser.newContext({ ...devices[phone], reducedMotion: "reduce" });
    const agg = { c1: [], c2: [], c3: [], c4: [], c7: [], c9: [], c10: [], c11: [], c12: [], c19: [] };
    for (const m of markets) {
      const p = await open(ctx, `concept=logo-studio&market=${m}`, `${phone} ${m}`);
      await p.waitForTimeout(500);
      const r = await p.evaluate(SWEEP);
      for (const k of Object.keys(agg)) for (const msg of r[k]) agg[k].push(`${m}: ${msg}`);
      await p.close();
    }
    report(`${phone}, 18 stores: (1) stage < question < field < pieces < button, all in the first screen, no tabs`, agg.c1);
    report(`${phone}, 18 stores: (2) nothing scrolls: the sheet and the panel fit`, agg.c2);
    report(`${phone}, 18 stores: (3) a popup card, centred and clear of every edge, at most 80% of the view (views from 600px)`, agg.c3);
    report(`${phone}, 18 stores: (4) the stage at rest is at least 0.56 x the width, the window that holds the print`, agg.c4);
    report(`${phone}, 18 stores: (7) the seven pieces in one row`, agg.c7);
    report(`${phone}, 18 stores: (9) no small print over the photo, "Logo" within the upload button, the question never cut`, agg.c9);
    report(`${phone}, 18 stores: (10) nothing sits on the close button`, agg.c10);
    report(`${phone}, 18 stores: (11) every control is a 44 x 44 target`, agg.c11);
    report(`${phone}, 18 stores: (12) no sideways overflow on any tool`, agg.c12);
    report(`${phone}, 18 stores: (19) the engine probe stays projective at rest`, agg.c19);
    await ctx.close();
  }

  // ---- B. the whole flow on each phone, with the keyboard simulated ----
  for (const phone of skip.has("flow") ? [] : [...PHONES, ...TALL].filter((x) => !process.env.QA_PHONES || process.env.QA_PHONES.split(",").includes(x))) {
    const opts = phoneOpts(devices, phone);
    const ctx = await browser.newContext(opts);
    const p = await open(ctx, "concept=logo-studio&market=eur_eu_cze", phone);
    const host = p.locator("#westpack-signup");
    const vp = opts.viewport, kb = KB[phone];
    const L = (fn, arg) => p.evaluate(fn, arg);
    const st = () => L(() => window.__ls.state());
    const shot = (s) => p.screenshot({ path: path.join(outDir, `studio-${phone.replace(/\s+/g, "-").toLowerCase()}-${s}.jpg`), type: "jpeg", quality: 72 });
    // the phone has no tabs since 2026-11-20 (the name and the pieces share one view): a tab tap is a no-op there
    const tab = async (k) => { const t = host.locator(`.ls-tab[data-tool="${k}"]`); if (await t.count()) { await t.click(); await p.waitForTimeout(300); } };
    const fails = { c3: [], c5: [], c6: [], c8: [], c10: [], c11: [], c12: [], c19: [] };
    const states = () => L(() => ({ over: window.__ls.overClose(), small: window.__ls.smallTargets(), x: window.__ls.overflowX() }));
    const sweepState = async (label) => { const s = await states(); fails.c10.push(...s.over.map((x) => `${label}: ${x}`)); fails.c11.push(...s.small.map((x) => `${label}: ${x}`)); fails.c12.push(...s.x.map((x) => `${label}: ${x}`)); };
    await p.waitForTimeout(2800);
    const rest = await st();
    await shot("open");
    if (rest.engine !== "projective") fails.c19.push(`rest: engine ${rest.engine}`);
    if (rest.far > 0.015) fails.c19.push(`rest: far corner off by ${(rest.far * 100).toFixed(2)}%`);
    if (Math.abs(rest.sceneW - rest.dialogW) > 0.5) fails.c5.push(`rest: scene ${rest.sceneW} vs sheet ${rest.dialogW}`);
    const snap = () => L(() => { const l = window.__ls; return { frame: l.rect(".ls-frame"), cta: l.rect(".ls-next"), dh: l.rect(".wps-dialog").h }; });
    const same = (a, b) => ["l", "t", "w", "h"].every((k) => Math.abs(a.frame[k] - b.frame[k]) <= 0.5 && Math.abs(a.cta[k] - b.cta[k]) <= 0.5) && Math.abs(a.dh - b.dh) <= 0.5;
    const base = await snap();

    // (8) typing a name and leaving the field moves nothing: the pieces were in view all along
    const input = host.locator(".ls-name-input");
    await input.focus(); await input.pressSequentially("Atelier Sever", { delay: 20 }); await input.blur(); await p.waitForTimeout(300);
    const named = await snap();
    const piecesInView = await L(() => window.__ls.inView(window.__ls.rect(".ls-tool .ls-thumbs")));
    if (!same(named, base) || !piecesInView) fails.c8.push(`after a name: ${same(named, base) ? "" : "moved, "}pieces ${piecesInView ? "in view" : "out of view"}`);

    // (6) the print is whole in the window on every piece, with the default name and a long one, at rest; and (on the
    // two phones the criterion names) while typing, with the field above the keyboard
    const typingSizes = phone === "iPhone 13" || phone === "iPhone SE" ? [kb] : [];
    for (const nm of ["", "Smykkehuset Lund Copenhagen"]) {
      await tab("brand"); await input.fill(nm); await input.blur(); await p.waitForTimeout(200);
      for (const id of PIECES) {
        await tab("box");
        await host.locator(`.ls-tool .ls-thumb[data-box="${id}"]`).click();
        await p.waitForTimeout(900);
        const s = await st();
        if (!(s.print && s.print.w > 10 && await L((a) => window.__ls.inside(a.p, a.f), { p: s.print, f: s.frame }))) fails.c6.push(`${nm || "default"} ${id} at rest`);
        for (const size of typingSizes) {
          await tab("brand");
          await input.focus();
          await p.setViewportSize(size); await p.waitForTimeout(500);
          const ty = await st();
          const field = await L(() => window.__ls.rect(".ls-name-input"));
          if (!ty.kb) fails.c6.push(`${id}: no typing layout at ${size.width}x${size.height}`);
          if (!(ty.print && await L((a) => window.__ls.inside(a.p, a.f), { p: ty.print, f: ty.frame }))) fails.c6.push(`${nm || "default"} ${id} typing ${size.width}x${size.height}`);
          if (!field || field.b > size.height + 0.5) fails.c6.push(`${id}: field under the keyboard`);
          if (ty.k !== rest.k) fails.c5.push(`typing ${id}: --k ${ty.k} vs ${rest.k}`);
          if (ty.far > 0.015) fails.c19.push(`typing ${id}: far corner ${(ty.far * 100).toFixed(2)}%`);
          if (id === "seville" && nm) { await shot("typing"); await sweepState("typing"); }
          await input.blur();
          await p.setViewportSize(vp); await p.waitForTimeout(450);
        }
      }
    }
    if (!typingSizes.length) {
      // one typing state on the other phones, for the scale and the engine
      await tab("brand"); await input.focus(); await p.setViewportSize(kb); await p.waitForTimeout(500);
      const ty = await st();
      if (ty.k !== rest.k) fails.c5.push(`typing: --k ${ty.k} vs ${rest.k}`);
      if (ty.far > 0.015) fails.c19.push(`typing: far corner ${(ty.far * 100).toFixed(2)}%`);
      await shot("typing"); await sweepState("typing");
      await input.blur(); await p.setViewportSize(vp); await p.waitForTimeout(450);
    }
    const back = await st();
    if (back.far > 0.015) fails.c19.push(`rest again: far corner ${(back.far * 100).toFixed(2)}%`);
    if (back.k !== rest.k) fails.c5.push(`rest again: --k ${back.k} vs ${rest.k}`);

    // (3) a hint showing and an uploaded logo move nothing
    // the long name's hint shows while the name is typed; with no keyboard up (a hardware one) that is at rest, on the
    // photo's foot. It clears once the field is left
    await tab("brand");
    await input.focus(); await input.fill(""); await input.pressSequentially("Smykkehuset Lund Copenhagen", { delay: 5 }); await p.waitForTimeout(300);
    const hinted = await snap();
    const hintOn = await L(() => window.__ls.q(".ls-hint").textContent.length > 0);
    if (!hintOn || !same(hinted, base)) fails.c3.push(`with a hint (${hintOn ? "shown" : "none"}): moved`);
    await input.blur(); await p.waitForTimeout(300);
    const png = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 160; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 160); g.fillStyle = "#111"; g.font = "bold 90px Georgia"; g.fillText("Nord", 70, 115); return c.toDataURL("image/png").split(",")[1]; });
    await host.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    await p.waitForTimeout(900);
    const logoed = await snap();
    if (!same(logoed, base)) fails.c3.push("after a logo upload: moved");
    // with a logo in, "use the name" takes the field's place beside the gold upload button
    const useName = await L(() => { const l = window.__ls, u = l.rect(".ls-use-name"), up = l.rect(".ls-upload"); return Boolean(u && up && l.shown(l.q(".ls-use-name")) && u.r <= up.l + 0.5 && Math.abs(u.t - up.t) <= 1); });
    if (!useName) fails.c3.push("with a logo, 'use the name' is not beside the upload button");
    await shot("logo"); await sweepState("logo");
    await host.locator(".ls-use-name").click(); await p.waitForTimeout(300);
    await input.blur(); await p.waitForTimeout(200);
    await shot("tools"); await sweepState("tools");

    // (20) on the iPhone 13: after many changes the print is still drawn
    // the print's own pixels on Seville, fresh, before the many changes below (20)
    await tab("box"); await host.locator('.ls-tool .ls-thumb[data-box="seville"]').click(); await p.waitForTimeout(1100);
    const fresh = phone === "iPhone 13" ? (await coverage(p)).printPx : 0;
    if (phone === "iPhone 13") {
      for (let i = 0; i < 10; i++) { await tab("brand"); await input.focus(); await p.setViewportSize(kb); await p.waitForTimeout(250); await input.blur(); await p.setViewportSize(vp); await p.waitForTimeout(250); }
      for (const k of ["box", "foil", "type", "brand", "foil", "box", "type", "brand"]) await tab(k);
      await tab("box");
      for (const id of ["london", "torino", "bag", "seville"]) { await host.locator(`.ls-tool .ls-thumb[data-box="${id}"]`).click(); await p.waitForTimeout(900); }
      await host.locator(".ls-zoom").click(); await p.waitForTimeout(1000); await host.locator(".ls-zoom").click(); await p.waitForTimeout(1200);
      const box = await L(() => window.__ls.rect(".ls-frame .ls-print text"));
      const clip = { x: box.l, y: box.t, width: box.w, height: box.h };
      const withPrint = await p.screenshot({ clip });
      await L(() => { window.__ls.q(".ls-frame .ls-print-wrap").style.visibility = "hidden"; });
      const without = await p.screenshot({ clip });
      await L(() => { window.__ls.q(".ls-frame .ls-print-wrap").style.visibility = ""; });
      const share = await pixelShare(p, withPrint, without);
      // and against the print itself: the same piece and name still draws at least half the pixels it drew fresh (the
      // light moves, so not all of them; an undrawn perspective layer draws none)
      const after = (await coverage(p)).printPx;
      check("iPhone 13: (20) after 10 keyboard cycles, 8 tabs, 4 pieces and a zoom the print is still drawn", share >= 0.02 && after >= 0.5 * fresh, `${(share * 100).toFixed(1)}% of the print's box; ${after} of ${fresh} print pixels drawn fresh`);
    }

    // the zoom brings the print to the window's middle and scales it to fill it (at least 1.5x, at most 2.35x): whole
    // in the window wherever it fits at more than 1.5x; zoomed out, the scene is back to no transform
    {
      await host.locator(".ls-zoom").click(); await p.waitForTimeout(1000);
      const z = await L(() => {
        const l = window.__ls, f = l.rect(".ls-frame"), t = l.rect(".ls-frame .ls-print text"), m = /scale\(([\d.]+)\)/.exec(l.q(".ls-frame > .ls-scene").style.getPropertyValue("--ls-zt"));
        const s = m ? Number(m[1]) : 0, cx = (t.l + t.r) / 2, cy = (t.t + t.b) / 2;
        return { s, dx: cx - (f.l + f.w / 2), dy: cy - (f.t + 12 + (f.h - 68) / 2), inside: l.inside(t, f, 1) };
      });
      await shot("zoom");
      await host.locator(".ls-zoom").click(); await p.waitForTimeout(1000);
      const out = await L(() => getComputedStyle(window.__ls.q(".ls-frame > .ls-scene")).transform);
      const ok = z.s >= 1.5 && z.s <= 2.35 && Math.abs(z.dx) <= 3 && Math.abs(z.dy) <= 3 && (z.inside || z.s <= 1.501) && out === "none";
      check(`${phone}: the zoom centres the print in the window and fills it, and zooms back out`, ok, `scale ${z.s}, off centre ${z.dx.toFixed(1)}/${z.dy.toFixed(1)}px, ${z.inside ? "whole" : "spills"}, after ${out}`);
    }

    // the result: the bag chosen, the button pressed
    await tab("box");
    await host.locator('.ls-tool .ls-thumb[data-box="bag"]').click(); await p.waitForTimeout(900);
    await host.locator(".ls-next").click(); await p.waitForTimeout(1600);
    await shot("result"); await sweepState("result");
    const res = await L(() => {
      const l = window.__ls, f = l.rect(".ls-frame"), card = l.rect(".ls-result"), cr = l.rect(".ls-result .wps-consent"), strip = l.q(".ls-strip");
      return {
        box: l.q(".ls").dataset.box, strip: Boolean(strip && strip.getClientRects().length),
        email: l.inView(l.rect(".ls-result .wps-input")), submit: l.inView(l.rect(".ls-result .wps-form .wps-btn-primary")),
        consent: Boolean(cr && cr.b <= Math.min(innerHeight, card.b) + 0.5), cardScroll: l.q(".ls-result").scrollHeight - l.q(".ls-result").clientHeight,
        hero: f.h, print: l.inside(l.rect(".ls-frame .ls-print text"), f), top: l.rect(".wps-dialog").t, dw: l.rect(".wps-dialog").w, state: l.state(),
      };
    });
    const c13 = [];
    if (!res.email || !res.submit) c13.push(`email ${res.email}, button ${res.submit}`);
    if (!res.consent) c13.push("the consent runs under the fold");
    // the print's window is 0.56 of the card's width (a popup card since 2026-11-23, no longer the view's)
    if (res.hero < 0.56 * res.dw - 0.5) c13.push(`hero ${res.hero} of a ${Math.round(res.dw)}px card`);
    report(`${phone}: (13) on the result the email field, the button and the whole consent are in view, the hero the print's window`, c13);
    check(`${phone}: (14) the bag is the hero, its print whole in the window, no strip of pieces`, res.box === "bag" && !res.strip && res.print, JSON.stringify({ box: res.box, strip: res.strip, print: res.print }));
    if (res.state.k !== rest.k || Math.abs(res.state.sceneW - res.state.dialogW) > 0.5) fails.c5.push(`result: --k ${res.state.k}, scene ${res.state.sceneW}/${res.state.dialogW}`);
    if (res.state.far > 0.015) fails.c19.push(`result: far corner ${(res.state.far * 100).toFixed(2)}%`);

    // (15) the address typed with the keyboard up, and an error: field, error, button all in view, error between
    const email = host.locator(".ls-result .wps-input");
    await email.focus();
    await p.setViewportSize(kb); await p.waitForTimeout(400);
    await email.fill("navn@firma");
    await host.locator(".ls-result .wps-form .wps-btn-primary").click();
    await p.waitForTimeout(600);
    await shot("email-error"); await sweepState("email error");
    const err = await L(() => { const l = window.__ls, i = l.rect(".ls-result .wps-input"), e = l.rect(".ls-result .wps-error"), b = l.rect(".ls-result .wps-form .wps-btn-primary"); return { i: l.inView(i), e: l.inView(e), b: l.inView(b), between: Boolean(i && e && b && e.t >= i.b - 0.5 && e.b <= b.t + 0.5) }; });
    check(`${phone}: (15) with the keyboard up (${kb.width}x${kb.height}) the field, its error and the button are in view, the error between them`, err.i && err.e && err.b && err.between, JSON.stringify(err));
    // there the close button stands on the paper card, so it is drawn as ink on paper, not as the stage's dark glass
    const closeLook = await L(() => { const c = getComputedStyle(window.__ls.q(".wps-close")); return { bg: c.backgroundColor, fg: c.color }; });
    check(`${phone}: typing the address, the close button is ink on the paper card`, !/rgba\(12, 16, 15/.test(closeLook.bg) && closeLook.fg !== "rgb(245, 241, 234)", JSON.stringify(closeLook));
    // (16) one tap on the button with a good address signs up (dry run)
    await email.fill("navn@firma.cz");
    await host.locator(".ls-result .wps-form .wps-btn-primary").click();
    let done = true;
    try { await host.locator(".ls-success:not([hidden])").waitFor({ timeout: 8000 }); } catch (e) { done = false; }
    check(`${phone}: (16) with the keyboard up the first tap on the button signs up`, done);
    // (17) the thank-you alone, its title in view
    await p.setViewportSize(vp); await p.waitForTimeout(1300);
    await shot("success"); await sweepState("thank-you");
    const ty = await L(() => {
      const l = window.__ls, shownN = (n) => getComputedStyle(n).display !== "none" && n.getClientRects().length > 0;
      return { leftovers: l.qa(".ls-result > *").filter((n) => !n.classList.contains("ls-success") && shownN(n)).map((n) => n.className || n.tagName), title: l.inView(l.rect(".ls-success-title")), state: l.state() };
    });
    check(`${phone}: (17) after the signup only the thank-you shows, its title in view`, ty.leftovers.length === 0 && ty.title, JSON.stringify({ leftovers: ty.leftovers, title: ty.title }));
    if (ty.state.k !== rest.k || Math.abs(ty.state.sceneW - ty.state.dialogW) > 0.5) fails.c5.push(`thank-you: --k ${ty.state.k}, scene ${ty.state.sceneW}/${ty.state.dialogW}`);
    if (ty.state.far > 0.015) fails.c19.push(`thank-you: far corner ${(ty.state.far * 100).toFixed(2)}%`);

    report(`${phone}: (3) a hint and an uploaded logo move nothing, and with a logo "use the name" stands beside the upload button`, fails.c3);
    report(`${phone}: (5) --k is the same at rest, typing, on the result and the thank-you, the scene as wide as the sheet`, fails.c5);
    report(`${phone}: (6) the print is whole in the window on all seven pieces, default and long name${typingSizes.length ? ", at rest and typing" : ""}`, fails.c6);
    report(`${phone}: (8) a typed name moves nothing, and the pieces stay in view`, fails.c8);
    report(`${phone}: (10) nothing sits on the close or back button while typing, with a logo, on the result, the error and the thank-you`, fails.c10);
    report(`${phone}: (11) every control is a 44 x 44 target in those states`, fails.c11);
    report(`${phone}: (12) no sideways overflow in those states`, fails.c12);
    report(`${phone}: (19) the far print corner stays within 1.5% through rest, typing, rest, result and thank-you`, fails.c19);
    await ctx.close();
  }

  // ---- C. fast enough on a slow phone (21): a Galaxy S8 at a quarter of the CPU ----
  if (!skip.has("perf")) {
    const ctx = await browser.newContext({ ...devices["Galaxy S8"] });
    const p = await open(ctx, "concept=logo-studio&market=eur_eu_cze", "S8 throttled");
    await p.waitForTimeout(2800);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    // the phone has no tabs or coins since 2026-11-20: a tap on a piece is what a visitor does there
    const tapMs = await p.evaluate(async () => {
      const out = [];
      for (const k of ["london", "bag", "torino", "seville"]) {
        const t0 = performance.now();
        window.__ls.q(`.ls-tool .ls-thumb[data-box="${k}"]`).click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        out.push(performance.now() - t0);
        await new Promise((r) => setTimeout(r, 900));
      }
      return out;
    });
    check("Galaxy S8, 4x slower CPU: (21) a tap on a piece paints within 100ms", Math.max(...tapMs) <= 100, tapMs.map((x) => `${Math.round(x)}ms`).join(", "));
    const longest = await p.evaluate(async () => {
      const tasks = [];
      const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) tasks.push(e.duration); });
      po.observe({ type: "longtask" });
      window.__ls.q('.ls-tool .ls-thumb[data-box="frankfurt"]').click();
      await new Promise((r) => setTimeout(r, 1500));
      window.__ls.q('.ls-tool .ls-thumb[data-box="madrid"]').click();
      await new Promise((r) => setTimeout(r, 1500));
      po.disconnect();
      return tasks.length ? Math.max(...tasks) : 0;
    });
    check("Galaxy S8, 4x slower CPU: (21) a piece tap causes no long task over 200ms", longest <= 200, `longest task ${Math.round(longest)}ms`);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await ctx.close();
  }

  // ---- D. tablets and short landscape (18) ----
  for (const [label, opts] of skip.has("tablet") ? [] : [
    ["iPad Mini 768x1024", { viewport: { width: 768, height: 1024 }, hasTouch: true, deviceScaleFactor: 2 }],
    ["tablet 712x1138", { viewport: { width: 712, height: 1138 }, hasTouch: true, deviceScaleFactor: 2 }],
    ["landscape 844x390", { viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 3 }],
    ["landscape 568x320", { viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
  ]) {
    const ctx = await browser.newContext(opts);
    const p = await open(ctx, "concept=logo-studio&market=eur_eu_cze", label);
    const host = p.locator("#westpack-signup");
    await p.waitForTimeout(2600);
    const out = [];
    const fitsView = () => p.evaluate(() => { const l = window.__ls, d = l.rect(".wps-dialog"); return { inView: l.inView(d), x: l.overflowX() }; });
    let v = await fitsView();
    if (!v.inView) out.push("dialog outside the view");
    if (v.x.length) out.push(`overflow ${v.x}`);
    // a card narrower than the view floats: air under it and round bottom corners. Standing on the view's foot it read
    // as a sheet cut off by the browser's toolbar, as if there were more to scroll to (the user's phone, 2026-11-20,
    // which reports a tablet's width)
    const card = await p.evaluate(() => { const d = window.__ls.q(".wps-dialog"), r = d.getBoundingClientRect(); return { narrower: r.width < innerWidth - 1, gap: Math.round(innerHeight - r.bottom), radius: parseFloat(getComputedStyle(d).borderBottomLeftRadius) }; });
    if (card.narrower && !(card.gap >= 4 && card.radius >= 8)) out.push(`a card narrower than the view stands on its foot: ${JSON.stringify(card)}`);
    // nothing sits on the close button here either (a narrow landscape panel once slid its last tab under it)
    const over = await p.evaluate(() => window.__ls.overClose());
    if (over.length) out.push(`on the close button: ${over.join(", ")}`);
    const input = host.locator(".ls-name-input");
    try { await input.click({ timeout: 4000 }); await input.pressSequentially("Atelier", { delay: 20 }); } catch (e) { out.push("name field not reachable"); }
    if ((await input.inputValue()) !== "Atelier") out.push("name field took no typing");
    await input.blur();
    // the name and the pieces share one view (no tabs since 2026-11-20): both shown, a piece takes a tap
    const both = await p.evaluate(() => { const l = window.__ls; return ["brand", "box"].every((k) => l.shown(l.q(`.ls-tool[data-tool="${k}"]`))) && !l.qa(".ls-tab").length; });
    if (!both) out.push("the name and the pieces are not both in view, or a tab bar is there");
    try { await host.locator('.ls-tool .ls-thumb[data-box="london"]').click({ timeout: 4000 }); await p.waitForTimeout(900); } catch (e) { out.push("a piece not reachable"); }
    if ((await p.evaluate(() => window.__ls.q(".ls").dataset.box)) !== "london") out.push("a piece tap did not take");
    await p.screenshot({ path: path.join(outDir, `studio-${label.split(" ")[0].toLowerCase()}-${opts.viewport.width}-open.jpg`), type: "jpeg", quality: 72 });
    try { await host.locator(".ls-next").click({ timeout: 4000 }); } catch (e) { out.push("button not reachable"); }
    await p.waitForTimeout(1500);
    const email = host.locator(".ls-result .wps-input");
    try { await email.scrollIntoViewIfNeeded({ timeout: 4000 }); await email.click({ timeout: 4000 }); } catch (e) { out.push("email field not reachable"); }
    v = await fitsView();
    if (!v.inView) out.push("result outside the view");
    if (v.x.length) out.push(`result overflow ${v.x}`);
    await p.screenshot({ path: path.join(outDir, `studio-${label.split(" ")[0].toLowerCase()}-${opts.viewport.width}-result.jpg`), type: "jpeg", quality: 72 });
    report(`${label}: (18) the sheet fits, the name takes typing, the name and the pieces share the view, the result is reachable, no overflow`, out);
    await ctx.close();
  }

  // ---- G. the sheet never jumps (round 2's review): motion on, the sheet's top sampled every frame through the button
  // to the result, back, to the result again and the signup to the thank-you. A height change is animated, never cut:
  // no two frames more than 24px apart (a frame that came late is judged per 16.7ms, so a dropped frame in a smooth
  // glide is not a jump but a cut still is). From the edit sheet to the result and back the top does not move at all,
  // and the thank-you's card reaches the sheet's foot all the way down, so no studio shows under it ----
  if (!skip.has("motion")) {
    for (const phone of [...PHONES, ...TALL].filter((x) => !process.env.QA_PHONES || process.env.QA_PHONES.split(",").includes(x))) {
      const ctx = await browser.newContext(phoneOpts(devices, phone));
      const p = await open(ctx, "concept=logo-studio&market=eur_eu_cze", `${phone} motion`);
      const host = p.locator("#westpack-signup");
      await p.waitForTimeout(2600);
      await host.locator(".ls-name-input").fill("Atelier Sever"); await host.locator(".ls-name-input").blur(); await p.waitForTimeout(400);
      const run = (sel) => p.evaluate(async (sel) => {
        const l = window.__ls, rows = [], t0 = performance.now();
        // on the thank-you: studio showing between the photo and the card, or under the card
        const sample = () => {
          const d = l.q(".wps-dialog").getBoundingClientRect(), card = l.q(".ls-result:not([hidden])"), f = l.q(".ls-frame").getBoundingClientRect();
          const c = card && l.q(".ls").classList.contains("is-success") ? card.getBoundingClientRect() : null;
          rows.push({ t: performance.now() - t0, top: d.top, gap: c ? Math.max(c.top - f.bottom, d.bottom - c.bottom) : 0 });
        };
        await new Promise((res) => { const loop = () => { sample(); if (performance.now() - t0 < 1600) requestAnimationFrame(loop); else res(); }; sample(); requestAnimationFrame(loop); l.q(sel).click(); });
        let worst = 0, gap = 0;
        for (let i = 1; i < rows.length; i++) {
          const step = Math.abs(rows[i].top - rows[i - 1].top), dt = rows[i].t - rows[i - 1].t;
          worst = Math.max(worst, dt > 34 ? step * (16.7 / dt) : step);
          gap = Math.max(gap, rows[i].gap);
        }
        return { from: rows[0].top, to: rows[rows.length - 1].top, worst, gap };
      }, sel);
      const out = [], fixed = [], gaps = [];
      const toResult = await run(".ls-next"); await p.waitForTimeout(400);
      const back = await run(".ls-back"); await host.locator(".ls-name-input").blur(); await p.waitForTimeout(400);
      const again = await run(".ls-next"); await p.waitForTimeout(400);
      await host.locator(".ls-result .wps-input").fill("navn@firma.cz");
      const thanks = await run(".ls-result .wps-form .wps-btn-primary");
      for (const [label, r] of [["to the result", toResult], ["back", back], ["to the result again", again], ["to the thank-you", thanks]]) {
        if (r.worst > 24) out.push(`${label}: ${r.worst.toFixed(1)}px in one frame (${Math.round(r.from)} -> ${Math.round(r.to)})`);
      }
      // the result is the edit sheet or taller (the card ends at the whole consent), so the top only ever rises to it;
      // back in the edit sheet it is exactly where it was, and the result is the same height every time
      if (toResult.to > toResult.from + 0.5) fixed.push(`to the result: sank ${Math.round(toResult.from)} -> ${Math.round(toResult.to)}`);
      if (Math.abs(back.to - toResult.from) > 0.5) fixed.push(`back: ${Math.round(back.to)}, the edit sheet was at ${Math.round(toResult.from)}`);
      if (Math.abs(again.to - toResult.to) > 0.5) fixed.push(`to the result again: ${Math.round(again.to)} vs ${Math.round(toResult.to)}`);
      if (thanks.gap > 1) gaps.push(`${thanks.gap.toFixed(1)}px of studio round the card`);
      report(`${phone}, motion on: (sheet) its top glides, never more than 24px a frame, to the result, back and to the thank-you (${Math.round(toResult.from)} -> ${Math.round(toResult.to)} at the result, ${Math.round(thanks.to)} at the thank-you)`, out);
      report(`${phone}, motion on: (sheet) its top only rises to the result, comes back to the edit sheet's, and the result is the same height each time`, fixed);
      report(`${phone}, motion on: (sheet) on the way to the thank-you the card meets the photo and the sheet's foot in every frame`, gaps);
      await ctx.close();
    }
  }

  // ---- F. nothing on the print, with motion on as a visitor gets it (round 2's review): the coach mark about three
  // seconds after opening, the live hint while a long name is typed with the keyboard up, and the stage back at rest.
  // Measured on the print's own pixels, every store, every phone ----
  if (!skip.has("cover")) {
    const LONG = "Smykkehuset Lund Copenhagen";
    for (const phone of PHONES.filter((x) => !process.env.QA_PHONES || process.env.QA_PHONES.split(",").includes(x))) {
      const ctx = await browser.newContext({ ...devices[phone] });
      const vp = devices[phone].viewport;
      const sizes = phone === "iPhone 13" ? [KB[phone], { width: 390, height: 290 }] : [KB[phone]];
      const bad = { coach: [], typing: [], rest: [] };
      let coached = 0;
      for (const m of markets) {
        const p = await open(ctx, `concept=logo-studio&market=${m}`, `${phone} ${m} cover`);
        await p.waitForTimeout(3300);
        const at = await coverage(p);
        const coach = at.hits.find((h) => h.name === "ls-coach");
        if (coach) {
          coached++;
          if (vp.height < 620) bad.coach.push(`${m}: shown on a short screen`);
          if (coach.share > 0 || coach.lines > 3) bad.coach.push(`${m}: ${coach.lines} lines, on ${(coach.share * 100).toFixed(1)}% of the print`);
        }
        const input = p.locator("#westpack-signup .ls-name-input");
        for (const size of sizes) {
          if (await p.locator('#westpack-signup .ls-tab').count()) { await p.locator('#westpack-signup .ls-tab[data-tool="brand"]').click(); await p.waitForTimeout(250); }
          await input.focus(); await input.fill(""); await input.pressSequentially(LONG, { delay: 4 });
          await p.setViewportSize(size); await p.waitForTimeout(900);
          const ty = await coverage(p);
          const hintAt = await p.evaluate(() => { const l = window.__ls, h = l.q(".ls-hint"); const hr = l.rect(h); return { kb: l.q(".wps").classList.contains("is-kb"), text: h.textContent, overField: Boolean(hr && h.closest(".ls-name") && hr.b <= l.rect(".ls-name-input").t + 0.5), field: l.rect(".ls-name-input").b }; });
          const on = covering(ty);
          if (on.length) bad.typing.push(`${m} ${size.width}x${size.height}: ${on.join(", ")}`);
          if (!hintAt.kb || !hintAt.text || !hintAt.overField) bad.typing.push(`${m} ${size.width}x${size.height}: hint ${JSON.stringify(hintAt)}`);
          if (hintAt.field > size.height + 0.5) bad.typing.push(`${m} ${size.width}x${size.height}: field under the keyboard`);
          if (m === "eur_eu_ger") await p.screenshot({ path: path.join(outDir, `cover-${phone.replace(/\s+/g, "-").toLowerCase()}-typing-${size.width}x${size.height}.jpg`), type: "jpeg", quality: 72 });
          await input.blur(); await p.setViewportSize(vp); await p.waitForTimeout(650);
        }
        const rest = await coverage(p);
        const left = await p.evaluate(() => window.__ls.q(".ls-hint").textContent);
        if (covering(rest).length) bad.rest.push(`${m}: ${covering(rest).join(", ")}`);
        if (left) bad.rest.push(`${m}: the typing hint stayed at rest`);
        await p.close();
      }
      report(`${phone}, 18 stores, motion on: the coach mark shows only clear of the print, in at most 3 lines${vp.height < 620 ? ", and never on this short screen" : ` (shown in ${coached})`}`, bad.coach);
      report(`${phone}, 18 stores: typing a long name (${sizes.map((s) => `${s.width}x${s.height}`).join(", ")}) nothing on the stage covers the print, and the hint stands over the field`, bad.typing);
      report(`${phone}, 18 stores: back at rest the typing hint is gone and nothing on the stage covers the print`, bad.rest);
      await ctx.close();
    }
  }

  // ---- E. WebKit (19): Playwright's WebKit for Windows draws matrix3d flat, so the probe falls back, without errors ----
  if (webkit && !skip.has("webkit")) {
    const wb = await webkit.launch();
    const ctx = await wb.newContext({ ...devices["iPhone 13"] });
    const p = await open(ctx, "concept=logo-studio&market=eur_eu_cze", "webkit");
    await p.waitForTimeout(3200);
    const engine = await p.evaluate(() => window.__ls.q(".ls").dataset.engine);
    await p.locator("#westpack-signup .ls-name-input").fill("Atelier Sever");
    await p.locator("#westpack-signup .ls-next").click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(outDir, "studio-webkit-result.jpg"), type: "jpeg", quality: 72 });
    check("WebKit, iPhone 13: (19) the probe falls back to the flat print", engine === "flat", `engine ${engine}`);
    await wb.close();
  }
}
