#!/usr/bin/env node
/**
 * The email name print's own scenes, beyond the Logo studio's lids (tools/email/name-print-extra.json): each photo's
 * demo print removed and its front measured exactly as the Logo studio does it - the same harmonic fill
 * (tools/signup/clean-plate.html) and the same edge fit, perspective check and light reading (the page code of
 * tools/signup/lid-geometry.js, used as it stands, never copied).
 *
 *   node tools/email/build-extra-plates.js [clean|measure|all] [scene]
 *
 * clean   downloads the original from its Asana task (through production, logged in as smoke-local.js is) and writes
 *         tools/email/name-print-plates/<scene>-1200.webp
 * measure fits the four edges on that plate, writes the quad and the light grid into the JSON, and draws
 *         tmp/name-print-extra-<scene>.jpg for a human to judge
 * Then run tools/email/build-name-print-assets.js to pack the plate for the server.
 */
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const ROOT = path.resolve(__dirname, "..", "..");
const SPEC_FILE = path.join(__dirname, "name-print-extra.json");
const PLATES = path.join(__dirname, "name-print-plates");
const CACHE = path.join(ROOT, "tmp", "signup-asset-cache");
const BASE = "https://project-4fcxa.vercel.app";
const PLAYWRIGHT = process.env.PLAYWRIGHT || path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright");
const geo = require(path.join(ROOT, "tools", "signup", "lid-geometry.js"));

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

async function original(source) {
  const cached = path.join(CACHE, `task-${source.asanaTask}`, source.file);
  if (fs.existsSync(cached)) return cached;
  const env = readEnv();
  const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.AUTH_PASSWORD || env.AUTH_PASSWORD }) });
  if (!login.ok) throw new Error(`production login failed (${login.status})`);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] || "";
  // Asana's signed attachment URLs die within the hour, so the task is read right before the download
  const task = await (await fetch(`${BASE}/api/campaign/brain?action=asana_task&taskGid=${source.asanaTask}`, { headers: { cookie } })).json();
  const a = (task.attachments || task.task?.attachments || []).find((x) => x.name === source.file);
  if (!a) throw new Error(`${source.file} is not attached to Asana task ${source.asanaTask}`);
  const r = await fetch(a.downloadUrl);
  if (!r.ok) throw new Error(`${source.file}: download ${r.status}`);
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
  return cached;
}

function lidGeometryPageJs() {
  const js = fs.readFileSync(path.join(ROOT, "tools", "signup", "lid-geometry.js"), "utf8");
  const open = "const PAGE_JS = `";
  const start = js.indexOf(open) + open.length;
  const end = js.indexOf("`;", start);
  if (start < open.length || end < 0) throw new Error("PAGE_JS not found in tools/signup/lid-geometry.js");
  return js.slice(start, end);
}

async function main() {
  const mode = process.argv[2] || "all";
  const only = process.argv[3];
  const spec = JSON.parse(fs.readFileSync(SPEC_FILE, "utf8"));
  const { chromium } = require(PLAYWRIGHT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [id, scene] of Object.entries(spec.scenes)) {
    if (only && id !== only) continue;
    const S = scene.source;
    const plate = path.join(PLATES, `${id}-1200.webp`);
    if (mode === "clean" || mode === "all") {
      const file = await original(S);
      await page.goto(url.pathToFileURL(path.join(ROOT, "tools", "signup", "clean-plate.html")).href);
      const src = "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");
      const r = await page.evaluate((o) => window.harmonicPlate(o), { src, size: 1600, crop: S.cropPx, polygonsPct: S.polygons, texturePct: S.texture, detailRadius: 1, feather: 12, outputs: [{ width: 1200, quality: 0.92 }] });
      fs.mkdirSync(PLATES, { recursive: true });
      fs.writeFileSync(plate, Buffer.from(r.outputs[0].webp.split(",")[1], "base64"));
      console.log(`${id}: plate ${r.outputs[0].width}x${r.outputs[0].height}`);
    }
    if (mode === "measure" || mode === "all") {
      await page.setContent(`<script>${lidGeometryPageJs()}</script>`);
      const src = "data:image/webp;base64," + fs.readFileSync(plate).toString("base64");
      const m = await page.evaluate(async ({ src, S }) => {
        const all = await window.measure(src, S);
        // an edge with its own search width is measured again with it
        for (const [edge, search] of Object.entries(S.searchByEdge || {})) all.edges[edge] = (await window.measure(src, Object.assign({}, S, { search }))).edges[edge];
        return all;
      }, { src, S });
      const E = m.edges;
      const quad = [geo.intersect(E.top.line, E.left.line), geo.intersect(E.top.line, E.right.line), geo.intersect(E.bottom.line, E.right.line), geo.intersect(E.bottom.line, E.left.line)].map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
      const persp = geo.aspectFromPerspective(quad, S.principal);
      for (const [k, v] of Object.entries(E)) console.log(`${id}: ${k.padEnd(6)} ${v.used}/${v.sampled} points, rms ${v.rms.toFixed(2)} px`);
      console.log(`${id}: quad ${JSON.stringify(quad)}, perspective aspect ${persp ? persp.aspect.toFixed(3) : "too weak"} (set ${scene.lid.aspect})`);
      const qpx = quad.map(([x, y]) => [(x / 100) * m.size, (y / 100) * m.size]);
      const surf = await page.evaluate((o) => window.surface(o.src, o.qpx, o.box, 0.1), { src, qpx, box: scene.lid.print });
      scene.lid.quad = quad;
      scene.lid.light = surf.grid;
      // a review drawing: the fitted edges, the projected grid and the print area
      const html = `<!doctype html><body style="margin:0;background:#000"><div style="position:relative;width:1000px;height:1000px">
<img src="${src}" style="width:1000px;height:1000px;display:block"><canvas id="c" width="1000" height="1000" style="position:absolute;left:0;top:0"></canvas></div>
<script>
const Q=${JSON.stringify(quad)}.map(([x,y])=>[x*10,y*10]),P=${JSON.stringify(scene.lid.print)},E=${JSON.stringify(E)};
${geo.homography.toString()}
const m=homography(Q);const map=(u,v)=>{const w=m.g*u+m.h*v+1;return[(m.a*u+m.b*v+m.c)/w,(m.d*u+m.e*v+m.f)/w]};
const g=document.getElementById('c').getContext('2d');
g.strokeStyle='#00c85a';g.lineWidth=2;g.beginPath();Q.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.stroke();
g.strokeStyle='rgba(0,150,255,.5)';g.lineWidth=1;for(let i=1;i<10;i++){for(const [a,b] of [[map(i/10,0),map(i/10,1)],[map(0,i/10),map(1,i/10)]]){g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();}}
g.strokeStyle='#ff00b4';g.lineWidth=2;g.beginPath();[[P.cx-P.w/2,P.cy-P.h/2],[P.cx+P.w/2,P.cy-P.h/2],[P.cx+P.w/2,P.cy+P.h/2],[P.cx-P.w/2,P.cy+P.h/2]].forEach(([u,v],i)=>{const[x,y]=map(u,v);i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.stroke();
for(const e of Object.values(E)){g.fillStyle='#f00';for(const [x,y] of e.pts){g.fillRect(x*10-2,y*10-2,4,4)}}
</script></body>`;
      const review = path.join(ROOT, "tmp", `name-print-extra-${id}.html`);
      fs.mkdirSync(path.dirname(review), { recursive: true });
      fs.writeFileSync(review, html);
      const p2 = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
      await p2.goto(url.pathToFileURL(review).href);
      await p2.waitForTimeout(300);
      await p2.screenshot({ path: review.replace(/\.html$/, ".jpg"), type: "jpeg", quality: 85 });
      await p2.close();
      console.log(`${id}: review ${path.relative(ROOT, review.replace(/\.html$/, ".jpg"))}`);
    }
  }
  await browser.close();
  if (mode === "measure" || mode === "all") {
    // the light grid on one line per row, as the file was written by hand
    const text = JSON.stringify(spec, null, 2).replace(/\[\s+([-\d.]+(?:,\s+[-\d.]+)+)\s+\]/g, (_, nums) => `[${nums.replace(/\s+/g, "")}]`);
    fs.writeFileSync(SPEC_FILE, text + "\n");
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
