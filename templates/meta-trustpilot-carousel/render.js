/**
 * Renders a Trustpilot carousel spec to 1080x1080 PNGs, a contact sheet and meta.json (the ad text that goes
 * with them), ready for publish.js.
 *
 *   node templates/meta-trustpilot-carousel/render.js templates/meta-trustpilot-carousel/specs/<file>.json
 *        [--reviews=<Trustpilot Business export>] [--out=<dir>]
 *
 * --reviews checks every quote word for word against the export (Trustpilot Business > reviews > export,
 * UTF-16 tab-separated). The export holds reviewers' e-mail addresses: keep it out of the repo.
 *
 * Refuses to write anything when the spec is invalid, a photo is missing, a text does not fit, or a quote
 * fails the check. Needs Playwright (tmp/playwright-runner) and Microsoft Edge.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { verifyQuotes } = require("./carousel-spec.js");

const DIR = __dirname;
const ROOT = path.resolve(DIR, "..", "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
}

function loadPlaywright() {
  for (const from of [DIR, path.join(ROOT, "tmp", "playwright-runner")]) {
    try {
      return require(require.resolve("playwright", { paths: [from] }));
    } catch (_) { /* try the next place */ }
  }
  throw new Error("Playwright not found. It lives in tmp/playwright-runner (gitignored): cd tmp/playwright-runner && npm install playwright");
}

// The Trustpilot Business export: UTF-16 LE, tab separated, quoted fields may hold line breaks.
function parseReviewExport(file) {
  const raw = fs.readFileSync(file);
  if (/\.json$/i.test(file)) return normalizeReviews(JSON.parse(raw.toString("utf8")));
  const text = (raw[0] === 0xff && raw[1] === 0xfe ? raw.toString("utf16le") : raw.toString("utf8")).replace(/^﻿/, "");
  const sep = text.split("\n")[0].includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
      continue;
    }
    if (c === '"' && field === "") { quoted = true; continue; }
    if (c === sep) { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return normalizeReviews(rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()]))));
}

// Only the fields the check needs - the export's e-mail column never leaves this function.
function normalizeReviews(rows) {
  return rows.map((r) => ({
    author: r["Review Username"] || r.author || "",
    title: r["Review Title"] || r.title || "",
    content: r["Review Content"] || r.content || "",
    stars: r["Review Stars"] || r.stars || "",
    date: r["Review Created (UTC)"] || r.date || ""
  }));
}

function serve(specText) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/__spec.json") {
        res.writeHead(200, { "Content-Type": TYPES[".json"] });
        return res.end(specText);
      }
      const file = path.join(DIR, url);
      if (!file.startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

(async () => {
  const specFile = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!specFile) throw new Error("Usage: node render.js <spec.json> [--reviews=<export>] [--out=<dir>]");
  const specText = fs.readFileSync(specFile, "utf8");
  const spec = JSON.parse(specText);
  const id = spec.id || path.basename(specFile, ".json");
  const outDir = path.resolve(arg("out") || path.join(DIR, "out", id));

  const reviewsFile = arg("reviews");
  if (reviewsFile) {
    const results = verifyQuotes(spec, parseReviewExport(reviewsFile));
    let failed = false;
    results.forEach((r) => {
      r.errors.forEach((e) => { failed = true; console.error(`  quote ${r.index + 1} (${r.author}): ${e}`); });
      r.warnings.forEach((w) => console.warn(`  quote ${r.index + 1} (${r.author}): ${w}`));
      if (!r.errors.length) console.log(`  quote ${r.index + 1} (${r.author}): found word for word`);
    });
    if (failed) throw new Error("A quote does not match the Trustpilot export - nothing rendered.");
  } else {
    console.warn("  no --reviews export given: quotes NOT checked against Trustpilot");
  }

  const { chromium } = loadPlaywright();
  const { server, base } = await serve(specText);
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/carousel.html?spec=/__spec.json`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.ready);
    const { problems, resolved } = await page.evaluate(() => ({ problems: window.problems, resolved: window.resolved }));
    (resolved.warnings || []).forEach((w) => console.warn(`  note: ${w}`));
    if (problems.length) throw new Error(`The cards cannot be rendered as specified:\n  - ${problems.join("\n  - ")}`);

    fs.mkdirSync(outDir, { recursive: true });
    const ids = await page.$$eval("section.card", (els) => els.map((e) => e.id));
    const files = [];
    for (const [i, cardId] of ids.entries()) {
      const file = `card-${String(i + 1).padStart(2, "0")}.png`;
      await page.locator(`#${cardId}`).screenshot({ path: path.join(outDir, file) });
      files.push(file);
    }

    await page.setViewportSize({ width: 1800, height: 400 });
    await page.setContent(`<html><body style="margin:0;background:#1d1d1d;display:flex;gap:8px;padding:8px">${files.map((f) => `<img src="data:image/png;base64,${fs.readFileSync(path.join(outDir, f)).toString("base64")}" style="width:${Math.floor((1784 - 8 * (files.length - 1)) / files.length)}px">`).join("")}</body></html>`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, "sheet.png"), fullPage: true });

    const meta = {
      spec: path.relative(ROOT, path.resolve(specFile)).replace(/\\/g, "/"),
      specSha256: crypto.createHash("sha256").update(specText).digest("hex"),
      renderedAt: new Date().toISOString(),
      locale: resolved.locale,
      quotesVerified: Boolean(reviewsFile),
      warnings: resolved.warnings,
      link: resolved.meta.link,
      cta: resolved.meta.cta,
      primaryText: resolved.meta.primaryText,
      urlTags: resolved.meta.urlTags,
      cards: files.map((file, i) => Object.assign({ file }, resolved.meta.cards[i]))
    };
    fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 1));
    console.log(`Rendered ${files.length} cards to ${outDir} (sheet.png shows them side by side)`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
