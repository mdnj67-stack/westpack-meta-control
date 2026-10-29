/**
 * Builds every image the Signup Lab experiences use, from the originals in the Asana Content Library.
 *
 * Asana serves attachments from signed links that expire within hours, so nothing in production may point at
 * Asana. This script reads each original through production (this machine has no Asana token: log in the way
 * smoke-local.js does), crops and compresses it to WebP in signup/assets/, and for the logo studio removes
 * Westpack's demo print from two lid close-ups (tools/signup/clean-plate.html). The assets are then served from
 * the app's own origin with the code that uses them, versioned together.
 *
 * Every photo is Westpack's own product photography. The customer-logo photos come from "Kundebilleder Uge 40",
 * which the Content Library owner cleared for free use on 2026-10-07; the one showing large corporate brands
 * (Kundelogo-06) is left out on purpose.
 *
 * Usage: node tools/signup/build-assets.js [--only=<asset id prefix>]
 */
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "signup", "assets");
const CACHE = path.join(ROOT, "tmp", "signup-asset-cache");
const BASE = "https://project-4fcxa.vercel.app";
const { chromium } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));

const TASKS = {
  logoTryk: "1213025393589646",
  kategori: "1215353150870805",
  monaco: "1212902028979353",
  tokyo: "1212391491407872",
  shipping: "1215480009202407",
  kundelogo40: "1219060017061930",
};

// Logo studio boxes: Westpack's demo print removed so the visitor's name can sit in its place. crop is
// [left %, top %, side %] of the original (square), polygons are in % of the crop, measured on a grid overlay.
// print: "light" when the print is lighter than the lid (an opening removes it: gold or white on black, white on
// green), "both" for metallic print that reads both lighter and darker than the lid (silver on cream, rose on
// brown). Gold on black must stay "light": closing first swells thick strokes into blocks the opening cannot take.
// Two photos carry a "MADE FROM RECYCLED PLASTIC" insert card (Kategori_Reshoot-36 and -46); their crops leave it
// out, because no Westpack creative may show an environmental claim.
const LOGO_BOXES = [
  { id: "seville", task: "logoTryk", file: "Logo_Tryk_1x1-4.jpg", print: "light", polygons: [[[7, 18.5], [83.75, 15.5], [83.75, 71.25], [37.5, 77], [7, 77]]] },
  { id: "london", task: "logoTryk", file: "Logo_Tryk_1x1-2.jpg", print: "both", polygons: [[[23.75, 10], [76.25, 11.25], [78, 61.25], [42.5, 71.25], [15.5, 68.75], [15, 37.5]]] },
  { id: "frankfurt", task: "logoTryk", file: "Logo_Tryk_1x1-5.jpg", method: "harmonic", texture: [80, 80, 16, 16], polygons: [[[10, 15], [82, 18], [84, 64], [60, 70], [45, 78], [12, 60]]] },
  { id: "torino", task: "kategori", file: "Kategori_Reshoot-8.jpg", crop: [2, 42, 58], print: "light", polygons: [[[10, 61], [61, 35], [94, 62.5], [40.5, 94.5]]] },
  { id: "seoul", task: "kategori", file: "Kategori_Reshoot-36.jpg", crop: [12, 33, 64], method: "harmonic", texture: [16, 36, 9, 9], detailRadius: 1, polygons: [[[31, 19.5], [52, 13.5], [76, 21], [83, 40], [78, 51], [56, 55], [29, 47]], [[88, 60], [100, 60], [100, 92], [89, 92]]] },
  { id: "madrid", task: "kategori", file: "Kategori_Reshoot-46.jpg", crop: [8, 0, 55], method: "harmonic", texture: [18, 20, 12, 22], polygons: [[[34, 17], [70, 17], [70, 55], [34, 55]]] },
];
const ASSETS = [
  ...LOGO_BOXES.map((b) => ({ id: `logo/box-${b.id}`, task: b.task, file: b.file, op: b.method === "harmonic" ? "harmonic" : "clean", print: b.print, texture: b.texture, detailRadius: b.detailRadius, radius: 22, size: 1600, cropPct: b.crop, polygonsPct: b.polygons, widths: [1200, 720, 160] })),
  // logo studio: real customers' logos, square
  ...["02", "04", "05", "14", "20", "03"].map((n) => ({ id: `logo/proof-${n}`, task: "kundelogo40", file: `Kundelogo-${n}.jpg`, op: "resize", aspect: 1, widths: [360] })),
  // swipe match: one card per box, 4:5
  { id: "swipe/torino", task: "kategori", file: "Kategori_Reshoot-9.jpg", op: "resize", aspect: 0.8, widths: [900, 600] },
  { id: "swipe/seoul", task: "kategori", file: "Kategori_Reshoot-32.jpg", op: "resize", aspect: 0.8, widths: [900, 600] },
  { id: "swipe/madrid", task: "kategori", file: "Kategori_Reshoot-23.jpg", op: "resize", aspect: 0.8, widths: [900, 600] },
  { id: "swipe/oslo", task: "kategori", file: "Kategori_Reshoot-27.jpg", op: "resize", aspect: 0.8, widths: [900, 600] },
  { id: "swipe/monaco", task: "monaco", file: "Monaco_eco_1x1-05.jpg", op: "resize", aspect: 0.8, widths: [900, 600] },
  { id: "swipe/tokyo", task: "tokyo", file: "Tokyo_Ny_Farve_1x1-13.jpg", op: "resize", aspect: 0.8, widths: [900, 600] },
  // pack & ship: the open mailer with jewellery boxes
  { id: "ship/mailer", task: "shipping", file: "Shipping_Smykkeæsker_Reshoot-13.jpg", op: "resize", aspect: 1, widths: [1200, 720] },
];

function readEnv() {
  const env = {};
  for (const f of [".env.local", ".env.production", ".vercel.live.env"]) {
    try {
      for (const line of fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
      }
    } catch (e) { /* missing env file */ }
  }
  return env;
}

async function login() {
  const env = readEnv();
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.AUTH_PASSWORD || env.AUTH_PASSWORD }) });
  if (!r.ok) throw new Error(`production login failed (${r.status})`);
  return r.headers.get("set-cookie")?.split(";", 1)[0] || "";
}

async function original(cookie, taskKey, file, attachmentsByTask) {
  const cached = path.join(CACHE, taskKey, file);
  if (fs.existsSync(cached)) return cached;
  if (!attachmentsByTask[taskKey]) {
    const r = await fetch(`${BASE}/api/campaign/brain?action=asana_task&taskGid=${TASKS[taskKey]}`, { headers: { cookie } });
    const j = await r.json();
    attachmentsByTask[taskKey] = j.attachments || j.task?.attachments || [];
  }
  const a = attachmentsByTask[taskKey].find((x) => x.name === file);
  if (!a) throw new Error(`${file} is not attached to Asana task ${TASKS[taskKey]}`);
  const r = await fetch(a.downloadUrl);
  if (!r.ok) throw new Error(`${file}: download ${r.status}`);
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
  return cached;
}

(async () => {
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
  const cookie = await login();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url.pathToFileURL(path.join(__dirname, "clean-plate.html")).href);
  const attachments = {};
  const manifest = {};
  for (const a of ASSETS.filter((x) => !only || x.id.startsWith(only))) {
    const file = await original(cookie, a.task, a.file, attachments);
    // a data URL keeps the canvas untainted; a file:// image would make getImageData refuse
    const src = "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");
    const dims = await page.evaluate((s) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = s; }), src);
    let crop = [0, 0, dims[0], dims[1]];
    if (a.cropPct) {
      const [px, py, ps] = a.cropPct; const side = Math.min(dims[0], dims[1]);
      crop = [Math.round((px / 100) * dims[0]), Math.round((py / 100) * dims[1]), Math.round((ps / 100) * side), Math.round((ps / 100) * side)];
    } else if (a.aspect) {
      const [w, h] = dims; const want = a.aspect;
      if (w / h > want) { const cw = Math.round(h * want); crop = [Math.round((w - cw) / 2 + (a.shiftX || 0) * w), 0, cw, h]; }
      else { const ch = Math.round(w / want); crop = [0, Math.round((h - ch) / 2), w, ch]; }
    }
    const outputs = a.widths.map((width) => ({ width, quality: a.op === "resize" ? 0.8 : 0.86 }));
    const result = a.op === "harmonic"
      ? await page.evaluate((o) => window.harmonicPlate(o), { src, size: a.size, crop, polygonsPct: a.polygonsPct, texturePct: a.texture, detailRadius: a.detailRadius, feather: 12, outputs })
      : a.op === "clean"
      ? await page.evaluate((o) => window.cleanPlate(o), { src, size: a.size, crop, print: a.print, radius: a.radius, threshold: 8, fill: true, feather: 18, polygonsPct: a.polygonsPct, outputs })
      : await page.evaluate((o) => window.resizePhoto(o), { src, crop, outputs });
    manifest[a.id] = { source: `${a.file} (Asana task ${TASKS[a.task]})`, files: [] };
    for (const o of result.outputs) {
      const rel = `${a.id}-${o.width}.webp`;
      const dest = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(o.webp.split(",")[1], "base64"));
      manifest[a.id].files.push({ file: rel, width: o.width, height: o.height, bytes: fs.statSync(dest).size });
    }
    console.log(`${a.id}: ${manifest[a.id].files.map((f) => `${f.width}px ${Math.round(f.bytes / 1024)}KB`).join(", ")}`);
  }
  await browser.close();
  const mfPath = path.join(OUT, "manifest.json");
  const previous = fs.existsSync(mfPath) ? JSON.parse(fs.readFileSync(mfPath, "utf8")) : {};
  fs.writeFileSync(mfPath, JSON.stringify(Object.assign(previous, manifest), null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
