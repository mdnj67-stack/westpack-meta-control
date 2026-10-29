/**
 * Lid geometry for the logo studio: where each lid's surface lies in its photo, measured rather than guessed.
 *
 * A lid is a plane, so a homography from the unit square to its four corners puts the print exactly on it -
 * parallel to its edges and foreshortened as the camera saw it. The corners come from measured edges:
 *
 * 1. Each edge is given roughly (two points on its straight part, % of the plate) in lid-geometry.json.
 * 2. `refine` finds the edge precisely: at 48 points along it, it searches across the line for the strongest
 *    brightness step (Sobel on the blurred plate), fits a line through those points, drops the ones more than
 *    1.5 px off, and fits again. Corners are where refined edges meet - a corner itself is often rounded, blurred
 *    or outside the frame, but two straight edges always meet somewhere.
 * 3. The lid's true proportions follow from the perspective: with the principal point at the centre of the
 *    original photo and square pixels, orthogonality of the lid's edges gives the focal length, and with it the
 *    ratio of the lid's sides. A square lid that comes out near 1.0 is the check that the measurement is sound.
 * 4. The surface under the print area is read through the same homography: how the light falls across it, the
 *    photo's white and the lid's colour, so the print can be lit like the lid it sits on.
 * 5. `review` draws the refined edges, the projected grid and a sample word on every plate, for a human to judge.
 *
 * Order of edges: top (the side the letters' tops face), right, bottom, left - so text runs from left to right.
 *
 * Usage:
 *   node tools/signup/lid-geometry.js refine            measure every lid, write the LIDS block in logo-studio.js
 *   node tools/signup/lid-geometry.js review <outDir>   draw what was measured
 */
const fs = require("fs");
const path = require("path");
const url = require("url");
const ROOT = path.resolve(__dirname, "..", "..");
const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, "lid-geometry.json"), "utf8"));
const OUT_JS = path.join(ROOT, "signup", "concepts", "logo-studio.js");
const BEGIN = "// lids:begin - measured by tools/signup/lid-geometry.js refine; do not edit by hand", END = "// lids:end";
const DEBUG = path.join(ROOT, "tmp", "signup-lid-debug.json");
const { chromium } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));

const PAGE_JS = `
window.measure = async function (src, spec) {
  const img = new Image(); img.src = src; await img.decode();
  const S = img.naturalWidth, c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.filter = "blur(" + (spec.blur || 1.6) + "px)"; g.drawImage(img, 0, 0); g.filter = "none";
  const px = g.getImageData(0, 0, S, S).data, L = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) L[i] = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
  const at = (x, y) => { x = Math.max(1, Math.min(S - 2, x)); y = Math.max(1, Math.min(S - 2, y)); const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const v = (a, b) => L[b * S + a]; return v(xi, yi) * (1 - fx) * (1 - fy) + v(xi + 1, yi) * fx * (1 - fy) + v(xi, yi + 1) * (1 - fx) * fy + v(xi + 1, yi + 1) * fx * fy; };
  const fit = (pts) => {
    const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); return { mx, my, dx: Math.cos(th), dy: Math.sin(th) };
  };
  const dist = (l, [x, y]) => Math.abs((x - l.mx) * l.dy - (y - l.my) * l.dx);
  const edges = {};
  // the lid's middle, to tell the inside of each edge from the outside
  const all = Object.values(spec.edges).flat(), cx = (all.reduce((s, p) => s + p[0], 0) / all.length / 100) * S, cy = (all.reduce((s, p) => s + p[1], 0) / all.length / 100) * S;
  for (const name of ["top", "right", "bottom", "left"]) {
    const [[x1, y1], [x2, y2]] = spec.edges[name].map(([x, y]) => [(x / 100) * S, (y / 100) * S]);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    let nx = -uy, ny = ux;
    if ((cx - (x1 + x2) / 2) * nx + (cy - (y1 + y2) / 2) * ny < 0) { nx = -nx; ny = -ny; }
    const pol = (spec.polarity || {})[name];
    const R = (spec.search || 2.2) / 100 * S;
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const t = 0.06 + (0.88 * k) / 47, bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t;
      if (bx < 2 || by < 2 || bx > S - 3 || by > S - 3) continue;
      let best = -1, bestS = 0;
      for (let s = -R; s <= R; s += 0.5) {
        const x = bx + nx * s, y = by + ny * s;
        // inside minus outside: negative where the lid side is the darker one
        const k = spec.stepPx || 1.5, d = at(x + nx * k, y + ny * k) - at(x - nx * k, y - ny * k);
        const score = pol === "dark-in" ? -d : pol === "light-in" ? d : Math.abs(d);
        if (score > best) { best = score; bestS = s; }
      }
      if (best > (spec.minStep || 3)) pts.push([bx + nx * bestS, by + ny * bestS]);
    }
    let l = fit(pts), kept = pts;
    for (let round = 0; round < 3; round++) { kept = kept.filter((p) => dist(l, p) < 1.5 + 2 / (round + 1)); if (kept.length >= 6) l = fit(kept); }
    edges[name] = { line: [[(l.mx - l.dx * 200) / S * 100, (l.my - l.dy * 200) / S * 100], [(l.mx + l.dx * 200) / S * 100, (l.my + l.dy * 200) / S * 100]], used: kept.length, sampled: pts.length, pts: kept.map(([x, y]) => [x / S * 100, y / S * 100]),
      rms: Math.sqrt(kept.reduce((s, p) => s + dist(l, p) ** 2, 0) / Math.max(1, kept.length)) };
  }
  return { size: S, edges };
};
/*
 * What the lid's surface does under the print area, read through the homography so it lines up with the print:
 * how the light falls across it (a coarse grid of brightness relative to the area's mean), the photo's white (the
 * mean colour of its brightest 2 %) and the lid's own colour. The material's fine grain is not read from the plate:
 * at this scale the plates carry WebP blocks and sensor noise rather than the board's texture, so the grain is drawn
 * (see GRAINS in logo-studio.js) and named per lid in lid-geometry.json. q: the quad in plate pixels; A: the lid's aspect; box: the print area in lid units.
 */
window.surface = async function (src, q, box, margin) {
  const img = new Image(); img.src = src; await img.decode();
  const S = img.naturalWidth;
  const read = (blur) => { const c = document.createElement("canvas"); c.width = S; c.height = S; const g = c.getContext("2d", { willReadFrequently: true }); if (blur) g.filter = "blur(" + blur + "px)"; g.drawImage(img, 0, 0); return g.getImageData(0, 0, S, S).data; };
  const wide = read(Math.round(S * 0.03));
  // brightness is compared with a floor added, so a near-black lid does not turn its faint sheen into 2x swings
  const FLOOR = 30;
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let gg = 0, hh = 0; if (dx3 || dy3) { const den = dx1 * dy2 - dx2 * dy1; gg = (dx3 * dy2 - dx2 * dy3) / den; hh = (dx1 * dy3 - dx3 * dy1) / den; }
  const H = [x1 - x0 + gg * x1, x3 - x0 + hh * x3, x0, y1 - y0 + gg * y1, y3 - y0 + hh * y3, y0, gg, hh];
  const map = (u, v) => { const w = H[6] * u + H[7] * v + 1; return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w]; };
  const sample = (D, x, y, ch) => { x = Math.max(0, Math.min(S - 1.001, x)); y = Math.max(0, Math.min(S - 1.001, y)); const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = (yi * S + xi) * 4 + ch; return D[i] * (1 - fx) * (1 - fy) + D[i + 4] * fx * (1 - fy) + D[i + S * 4] * (1 - fx) * fy + D[i + S * 4 + 4] * fx * fy; };
  const lum = (D, x, y) => 0.3 * sample(D, x, y, 0) + 0.59 * sample(D, x, y, 1) + 0.11 * sample(D, x, y, 2);
  // the area read: the print area grown by margin on every side, in lid units
  const u0 = box.cx - (box.w / 2) * (1 + 2 * margin), uw = box.w * (1 + 2 * margin), v0 = box.cy - (box.h / 2) * (1 + 2 * margin), vh = box.h * (1 + 2 * margin);
  // light: a coarse grid, relative to the print area's mean
  const GW = 12, GH = 12, grid = [];
  let mean = 0, n = 0, col = [0, 0, 0];
  for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) {
    const u = box.cx - box.w / 2 + (box.w * (i + 0.5)) / 40, v = box.cy - box.h / 2 + (box.h * (j + 0.5)) / 40, [x, y] = map(u, v);
    mean += lum(wide, x, y); for (let c = 0; c < 3; c++) col[c] += sample(wide, x, y, c); n++;
  }
  mean /= n; col = col.map((c) => c / n / 255);
  for (let j = 0; j < GH; j++) { const row = []; for (let i = 0; i < GW; i++) { const [x, y] = map(u0 + (uw * i) / (GW - 1), v0 + (vh * j) / (GH - 1)); row.push(Math.round(((lum(wide, x, y) + FLOOR) / (mean + FLOOR)) * 1000) / 1000); } grid.push(row); }
  // the outer ring lies in the margin, where a trim line or a wall can sit (Torino's gold frame, Madrid's inner
  // wall); where it jumps away from the cell inside it, it takes that cell's value, so it cannot light a name's ends
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    if (i > 0 && j > 0 && i < GW - 1 && j < GH - 1) continue;
    const inner = grid[Math.min(GH - 2, Math.max(1, j))][Math.min(GW - 2, Math.max(1, i))];
    if (Math.abs(grid[j][i] - inner) > 0.06) grid[j][i] = inner;
  }
  // the photo's white: the mean colour of its brightest 2 %
  const L = []; for (let i = 0; i < S * S; i += 7) L.push(0.3 * wide[i * 4] + 0.59 * wide[i * 4 + 1] + 0.11 * wide[i * 4 + 2]);
  const cut = L.slice().sort((a, b) => a - b)[Math.floor(L.length * 0.98)];
  let wp = [0, 0, 0], wn = 0; for (let i = 0, k = 0; i < S * S; i += 7, k++) if (L[k] >= cut) { for (let ch = 0; ch < 3; ch++) wp[ch] += wide[i * 4 + ch]; wn++; }
  wp = wp.map((v) => Math.round((v / wn / 255) * 1000) / 1000);
  return { grid, white: wp, color: col.map((v) => Math.round(v * 1000) / 1000), mean: Math.round(mean) };
};`;

function intersect([[x1, y1], [x2, y2]], [[x3, y3], [x4, y4]]) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  return [((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / d, ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / d];
}
// homography from the unit square to quad q (corners in any units); x' = (a u + b v + c) / (g u + h v + 1)
function homography(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) { const den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; }
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}
/**
 * The lid's width/height from its image, given the principal point (centre of the original photo, in the same
 * units as the quad). Returns null when the perspective is too weak to say (near-parallel edges).
 */
function aspectFromPerspective(q, principal) {
  const qq = q.map(([x, y]) => [x - principal[0], y - principal[1]]);
  const H = homography(qq);
  const h1 = [H.a, H.d, H.g], h2 = [H.b, H.e, H.h];
  const f2 = -(h1[0] * h2[0] + h1[1] * h2[1]) / (h1[2] * h2[2]);
  if (!(f2 > 0) || !Number.isFinite(f2)) return null;
  const f = Math.sqrt(f2);
  const n1 = Math.hypot(h1[0] / f, h1[1] / f, h1[2]), n2 = Math.hypot(h2[0] / f, h2[1] / f, h2[2]);
  return { aspect: n1 / n2, focal: f };
}

async function refine() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<script>${PAGE_JS}</script>`);
  const lids = {}, debug = {};
  for (const [id, spec] of Object.entries(SPEC.lids)) {
    const file = path.join(ROOT, "signup", "assets", "logo", `box-${id}-1200.webp`);
    const src = "data:image/webp;base64," + fs.readFileSync(file).toString("base64");
    const m = await page.evaluate(({ src, spec }) => window.measure(src, spec), { src, spec });
    const E = m.edges;
    const quad = [intersect(E.top.line, E.left.line), intersect(E.top.line, E.right.line), intersect(E.bottom.line, E.right.line), intersect(E.bottom.line, E.left.line)].map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    // the original photo's centre, in % of this plate (a crop [x, y, side] of a square original)
    const crop = spec.crop || [0, 0, 100];
    const principal = [((50 - crop[0]) / crop[2]) * 100, ((50 - crop[1]) / crop[2]) * 100];
    const persp = aspectFromPerspective(quad, principal);
    const aspect = spec.aspect || (persp ? Math.round(persp.aspect * 1000) / 1000 : 1);
    debug[id] = { edges: E, rough: spec.edges };
    // the surface under the print area: light, white point, colour
    const qpx = quad.map(([x, y]) => [(x / 100) * m.size, (y / 100) * m.size]);
    const surf = await page.evaluate((o) => window.surface(o.src, o.qpx, o.box, 0.1), { src, qpx, box: spec.print });
    lids[id] = { quad, aspect, print: spec.print, tone: spec.tone, foil: spec.foil, grain: spec.grain || null, exposure: spec.exposure, light: surf.grid };
    const fit = Object.fromEntries(Object.entries(E).map(([k, v]) => [k, `${v.used}/${v.sampled} pts, rms ${v.rms.toFixed(2)} px`]));
    console.log(`${id}: quad ${JSON.stringify(quad)} aspect ${aspect}${persp ? ` (perspective ${persp.aspect.toFixed(3)}, f ${Math.round(persp.focal)}%)` : " (perspective too weak)"}`);
    for (const [k, v] of Object.entries(fit)) console.log(`   ${k.padEnd(6)} ${v}`);
    const flat = surf.grid.flat();
    console.log(`   light ${Math.min(...flat).toFixed(2)}-${Math.max(...flat).toFixed(2)}, white ${surf.white}, colour ${surf.color}`);
  }
  await browser.close();
  fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
  fs.writeFileSync(DEBUG, JSON.stringify(debug));
  // the measurements go into the concept's own file, between markers, so the page loads one script
  const rows = Object.entries(lids).map(([id, l]) => `    ${id}: ${JSON.stringify(l)},`).join("\n");
  const block = `${BEGIN}\n  const LIDS = {\n${rows}\n  };\n  ${END}`;
  const js = fs.readFileSync(OUT_JS, "utf8");
  const i = js.indexOf(BEGIN), j = js.indexOf(END);
  if (i < 0 || j < 0) throw new Error(`markers missing in ${OUT_JS}`);
  fs.writeFileSync(OUT_JS, js.slice(0, i) + block + js.slice(j + END.length));
  console.log(`wrote ${path.relative(ROOT, OUT_JS)}`);
}
function readLids() {
  const js = fs.readFileSync(OUT_JS, "utf8");
  const body = js.slice(js.indexOf(BEGIN), js.indexOf(END)).replace(/^[^{]*/, "").trim().replace(/;$/, "");
  return Function(`return (${body});`)();
}

async function review(outDir) {
  const LIDS = readLids();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  for (const [id, l] of Object.entries(LIDS)) {
    const src = url.pathToFileURL(path.join(ROOT, "signup", "assets", "logo", `box-${id}-1200.webp`)).href;
    const html = `<!doctype html><body style="margin:0;background:#000"><div style="position:relative;width:1000px;height:1000px;overflow:hidden">
<img src="${src}" style="width:1000px;height:1000px;display:block"><canvas id="c" width="1000" height="1000" style="position:absolute;left:0;top:0"></canvas>
<div id="t" style="position:absolute;left:0;top:0;transform-origin:0 0;display:flex;align-items:center;justify-content:center;font:600 130px Georgia;letter-spacing:10px;color:rgba(255,215,110,.9)">ATELIER</div></div>
<script>
const Q=${JSON.stringify(l.quad)}.map(([x,y])=>[x*10,y*10]),A=${l.aspect},P=${JSON.stringify(l.print)};
${homography.toString()}
const m=homography(Q);const map=(u,v)=>{const w=m.g*u+m.h*v+1;return[(m.a*u+m.b*v+m.c)/w,(m.d*u+m.e*v+m.f)/w]};
const g=document.getElementById('c').getContext('2d');
g.strokeStyle='rgba(0,255,120,1)';g.lineWidth=2;g.beginPath();Q.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.stroke();
g.strokeStyle='rgba(0,230,255,.5)';g.lineWidth=1;for(let i=1;i<10;i++){for(const [a,b] of [[map(i/10,0),map(i/10,1)],[map(0,i/10),map(1,i/10)]]){g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();}}
g.strokeStyle='rgba(255,60,200,.95)';g.lineWidth=2;g.beginPath();[[P.cx-P.w/2,P.cy-P.h/2],[P.cx+P.w/2,P.cy-P.h/2],[P.cx+P.w/2,P.cy+P.h/2],[P.cx-P.w/2,P.cy+P.h/2]].forEach(([u,v],i)=>{const[x,y]=map(u,v);i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.stroke();
// an element W x W/A, its centre at the print centre, mapped through the homography: text as it would print
const W=1000,Hh=Math.round(1000/A),t=document.getElementById('t');t.style.width=W+'px';t.style.height=Hh+'px';
t.style.transform='matrix3d('+[m.a/W,m.d/W,0,m.g/W,m.b/Hh,m.e/Hh,0,m.h/Hh,0,0,1,0,m.c,m.f,0,1].join(',')+')';
const D=${JSON.stringify((fs.existsSync(DEBUG) ? JSON.parse(fs.readFileSync(DEBUG, 'utf8'))[id] : null) || null)};
if(D){for(const [k,e] of Object.entries(D.edges)){const [[a,b],[c,d]]=e.line.map(([x,y])=>[x*10,y*10]);const dx=c-a,dy=d-b;g.strokeStyle='rgba(255,40,40,.9)';g.lineWidth=1;g.beginPath();g.moveTo(a-dx*3,b-dy*3);g.lineTo(c+dx*3,d+dy*3);g.stroke();g.fillStyle='#ff0';for(const [x,y] of e.pts){g.fillRect(x*10-1.5,y*10-1.5,3,3)}const r=D.rough[k];g.setLineDash([6,5]);g.strokeStyle='rgba(255,255,0,.7)';g.beginPath();g.moveTo(r[0][0]*10,r[0][1]*10);g.lineTo(r[1][0]*10,r[1][1]*10);g.stroke();g.setLineDash([]);g.fillStyle='#fff';g.font='bold 15px Arial';g.fillText(k,(r[0][0]+r[1][0])*5,(r[0][1]+r[1][1])*5)}}
g.fillStyle='#0f0';g.font='bold 18px Arial';g.fillText('${id}  aspect '+A,14,990);
</script></body>`;
    fs.writeFileSync(path.join(outDir, `_${id}.html`), html);
    await page.goto(url.pathToFileURL(path.join(outDir, `_${id}.html`)).href);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, `lid-${id}.jpg`), type: "jpeg", quality: 82 });
  }
  await browser.close();
  console.log(`review renders in ${outDir}`);
}

module.exports = { homography, aspectFromPerspective, intersect };
if (require.main === module) {
  (process.argv[2] === "review" ? review(process.argv[3]) : refine()).catch((e) => { console.error(e); process.exit(1); });
}
