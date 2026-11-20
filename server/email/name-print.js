/**
 * A name, foil-printed on a real Westpack lid, as a JPEG - for an email that shows each reader their own name in
 * foil. It is the Signup Lab's Logo studio done on the server in plain Node: the same clean plates, the same measured
 * lids (one homography lays the print on the lid as the camera saw it), the same foils at the same calibrated
 * brightness, the same light model (a blurred print as a height field under a point light, the pressed edges, the
 * foil's pulled grain, the lid's own measured light). What it cannot share with the browser is the SVG filter
 * engine, so each step of signup/concepts/logo-studio.js's filter is written out here.
 *
 * Assets (server/email/name-print/) are built by tools/email/build-name-print-assets.js.
 *
 *   renderNamePrint({ name, scene, foil, width }) -> { jpeg, name, size, ms }
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { encodeJpeg } = require("./jpeg-encode");

const DIR = path.join(__dirname, "name-print");
const VBW = 1000;
const LIGHT_MARGIN = 0.1;
// Fraunces 600 in spaced capitals: Logo studio's "classic" type
const TYPE = { size: 150, spacing: 16, lineBox: 1.23 };
const MAX_CHARS = 30;

// ---- foils: Logo studio's FOIL_TABLE for the ones an email uses ----
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, k) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * k));
const scale = (c, k) => {
  const v = hex(c).map((x) => x * k), over = Math.min(1, Math.max(0, Math.max(...v) - 255) / 255);
  return toHex(v.map((x) => Math.min(255, x) + (255 - Math.min(255, x)) * over));
};
const metalStops = (dark, body, light) => [dark, body, light, mix(body, light, 0.42), mix(dark, body, 0.45), mix(body, light, 0.72), mix(dark, body, 0.78), mix(body, light, 0.86)];
const METAL_LIGHT = [0.471, 0.756, 0.949];
const metal = (p10, p50, p90) => {
  const [d, b, l] = [p10, p50, p90].map((c, i) => scale(c, METAL_LIGHT[i]));
  return { kind: "metal", light: mix(l, "#ffffff", 0.5), stops: metalStops(d, b, l) };
};
const glossStops = (deep, body, streak) => [deep, body, streak, mix(deep, body, 0.3), deep, mix(body, streak, 0.6), mix(deep, body, 0.5), streak];
const gloss = (c) => ({ kind: "gloss", light: mix(c, "#ffffff", 0.85), stops: glossStops(scale(c, 0.45), c, mix(c, "#ffffff", 0.8)) });
const matt = (c, spec) => ({ kind: "pigment", color: c, spec: spec || 0.16 });
const FOILS = {
  "metallic-gold": metal("#936f18", "#c29d2a", "#e9d170"),
  "metallic-silver": metal("#8d8d8d", "#c0c0c0", "#eeeeee"),
  "metallic-copper": metal("#835536", "#b3744b", "#dd8f5c"),
  "metallic-pink": metal("#8d2a83", "#bf39b1", "#ec48dc"),
  "metallic-blue": metal("#01518d", "#016fc1", "#0288ed"),
  "gloss-black": gloss("#161616"),
  "gloss-grey": gloss("#969595"),
  "gloss-brown": gloss("#765341"),
  "matt-black": matt("#141414", 0.3),
  "matt-white": matt("#FDFDFD", 0.22),
  "matt-oldrose": matt("#C09B8C", 0.2),
  "matt-darkblue": matt("#284467"),
  "matt-winered": matt("#8C3039")
};
const GRAINS = {
  structured: { layers: [[0.14, 0.12]], metal: 0.05, pigment: 0.09 },
  linen: { layers: [[0.2, 0.02], [0.02, 0.2]], metal: 0.05, pigment: 0.08 },
  velour: { layers: [[0.3, 0.28]], metal: 0.04, pigment: 0.07 }
};

// ---- assets, read once per instance ----
let LIDS = null, ATLAS = null;
const SCENES = {};
function lids() {
  if (!LIDS) LIDS = JSON.parse(fs.readFileSync(path.join(DIR, "lids.json"), "utf8"));
  return LIDS;
}
function scene(id) {
  if (SCENES[id]) return SCENES[id];
  const b = fs.readFileSync(path.join(DIR, `scene-${id}.bin`));
  if (b.toString("ascii", 0, 4) !== "WPSC") throw new Error(`Bad scene ${id}`);
  const w = b.readUInt16LE(4), h = b.readUInt16LE(6), row = w * 3;
  const f = zlib.inflateSync(b.subarray(8)), rgb = Buffer.alloc(f.length);
  for (let i = 0; i < f.length; i++) rgb[i] = (f[i] + (i >= row ? rgb[i - row] : 0)) & 255;
  return (SCENES[id] = { w, h, rgb });
}
function atlas() {
  if (ATLAS) return ATLAS;
  const b = fs.readFileSync(path.join(DIR, "glyphs.bin"));
  if (b.toString("ascii", 0, 4) !== "WPGA") throw new Error("Bad glyph atlas");
  const len = b.readUInt32LE(4);
  const index = JSON.parse(b.toString("utf8", 8, 8 + len));
  index.alpha = zlib.inflateSync(b.subarray(8 + len));
  return (ATLAS = index);
}

// ---- the name ----
// Legal forms said after a company's name in the 18 markets; taken off the end, one at a time
const LEGAL = ["aps", "a/s", "i/s", "ivs", "k/s", "p/s", "smba", "amba", "fmba", "ab", "hb", "kb", "as", "asa", "ans", "da", "enk", "oy", "oyj", "ky", "tmi", "gmbh", "gmbh & co. kg", "ug", "kg", "ohg", "gbr", "e.k.", "ek", "ag", "mbh", "ltd", "limited", "llc", "llp", "inc", "plc", "corp", "co", "company", "bv", "b.v.", "bvba", "nv", "n.v.", "vof", "sarl", "s.a.r.l.", "sas", "sasu", "sa", "s.a.", "eurl", "ei", "sl", "s.l.", "slu", "srl", "s.r.l.", "srls", "spa", "s.p.a.", "snc", "sas", "sp. z o.o.", "sp.z o.o.", "sp z o o", "spółka z o.o.", "s.r.o.", "sro", "a.s.", "kft", "kft.", "zrt", "zrt.", "bt", "bt.", "lda", "lda.", "unipessoal", "ehf", "ehf.", "oü", "uab", "sia", "d.o.o.", "s.c.", "pfa", "ii"];
const NOT_A_NAME = /^(privat|private|privé|privee|privato|test|testing|n\/?a|none|ingen|keine|kein|firma|company|-+|\.+|x+|\?+|na|null|undefined|tbd)$/i;
const BLOCK = /(fuck|shit|cunt|nigg|fanculo|scheisse|scheiße|kurwa|pussy|dick|cock|porn|nazi|hitler|fisse|pik\b|lort\b|kneppe|hore\b|puta|merde|salope|connard)/i;

function cleanName(raw) {
  let s = String(raw || "").normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s || /@|https?:|www\.|\.(com|dk|de|se|no|nl|eu)\b/i.test(s)) return "";
  s = s.replace(/\([^)]*\)/g, " ").replace(/\s+(v\/|c\/o|att\.?|attn\.?)\s.*$/i, "").replace(/\s+/g, " ").trim();
  for (let guard = 0; guard < 3; guard++) {
    const low = s.toLowerCase();
    const hit = LEGAL.find((form) => low.endsWith(` ${form}`) || low.endsWith(`,${form}`) || low.endsWith(`, ${form}`));
    if (!hit) break;
    s = s.slice(0, s.length - hit.length).replace(/[\s,]+$/, "").trim();
  }
  // "Østergaard & Co" lost its "Co" above; the "&" (or "og", "and", "und") it leaves behind goes too
  for (let guard = 0; guard < 2; guard++) s = s.replace(/[\s,]+(&|\+|og|and|und|et|e|y|i)$/i, "").trim();
  s = s.replace(/^[\s.,;:\-–|/&+]+|[\s.,;:\-–|/&+]+$/g, "");
  if (NOT_A_NAME.test(s) || BLOCK.test(s)) return "";
  if ((s.match(/\p{L}/gu) || []).length < 2) return "";
  if (s.length > MAX_CHARS) {
    // a long registered name: keep the words that fit
    const words = s.split(" ");
    let kept = "";
    for (const w of words) { if ((kept ? kept.length + 1 : 0) + w.length > MAX_CHARS) break; kept = kept ? `${kept} ${w}` : w; }
    s = kept || s.slice(0, MAX_CHARS);
  }
  return s;
}

// upper case, and every letter the atlas lacks taken back to its base letter, or dropped
function toPrintable(name) {
  const a = atlas();
  let out = "";
  for (const ch of name.toUpperCase()) {
    if (ch === " ") { out += " "; continue; }
    if (a.glyphs[ch]) { out += ch; continue; }
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
    for (const b of base) if (a.glyphs[b]) out += b;
  }
  return out.replace(/\s+/g, " ").trim();
}

// ---- layout: lines of glyphs in print units ----
function measureLine(text, size) {
  const a = atlas(), k = size / a.em, spacing = (TYPE.spacing * size) / TYPE.size;
  const chars = [...text];
  let x = 0, inkL = Infinity, inkR = -Infinity;
  const placed = [];
  chars.forEach((ch, i) => {
    if (ch === " ") { x += a.space * k + spacing; return; }
    const g = a.glyphs[ch];
    if (!g) return;
    placed.push({ ch, x });
    inkL = Math.min(inkL, x + g.x * k);
    inkR = Math.max(inkR, x + (g.x + g.w) * k);
    const next = chars[i + 1];
    x += g.advance * k + spacing + (next && a.kern[ch + next] ? a.kern[ch + next] * k : 0);
  });
  // the box Logo studio fits: every advance with its letter spacing, as SVG's getBBox reads it
  return { placed, width: x, inkL, inkR };
}

function layout(text, vbH) {
  const fit = (lines) => {
    const m = lines.map((l) => measureLine(l, TYPE.size));
    const w = Math.max(...m.map((x) => x.width)), h = TYPE.size * TYPE.lineBox * (lines.length === 1 ? 1 : 1.75);
    let size = Math.max(24, TYPE.size * Math.min(1.3, (VBW * 0.94) / w, (vbH * (lines.length === 1 ? 0.3 : 0.48)) / h));
    const check = Math.max(...lines.map((l) => measureLine(l, size).width));
    if (check > VBW * 0.97) size = Math.max(24, (size * VBW * 0.94) / check);
    return { lines, size };
  };
  let best = fit([text]);
  const words = text.split(" ");
  if (best.size < 92 && words.length > 1) {
    // two lines, broken where the halves come closest in width
    let split = null;
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(" "), l2 = words.slice(i).join(" ");
      const d = Math.abs(measureLine(l1, 100).width - measureLine(l2, 100).width);
      if (!split || d < split.d) split = { d, lines: [l1, l2] };
    }
    const two = fit(split.lines);
    if (two.size > best.size * 1.15) best = two;
  }
  return best;
}

// ---- small image tools ----
function gaussian(src, w, h, sigma) {
  if (sigma < 0.3) return Float32Array.from(src);
  const r = Math.ceil(sigma * 3), kernel = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += (kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)));
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) { const xx = x + i; if (xx >= 0 && xx < w) s += src[row + xx] * kernel[i + r]; }
      tmp[row + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) { const yy = y + i; if (yy >= 0 && yy < h) s += tmp[yy * w + x] * kernel[i + r]; }
      out[y * w + x] = s;
    }
  }
  return out;
}
// value noise with a smooth step, two octaves, in [0, 1]
function makeNoise(seed) {
  const hash = (x, y) => {
    let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const one = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => (one(x, y) * 0.667 + one(x * 2 + 17.3, y * 2 + 9.1) * 0.333);
}

// the homography taking the unit square (lid units) to the lid's quad in pixels
function homography(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const apply = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };

// ---- the render ----
function renderNamePrint({ name, scene: sceneId = "seville", foil: foilId, width = 1200, quality = 86, light = null } = {}) {
  const started = Date.now();
  const L = lids()[sceneId];
  if (!L) throw new Error(`Unknown scene ${sceneId}`);
  const F = FOILS[foilId || L.foil] || FOILS["metallic-gold"];
  const S = scene(sceneId);
  const a = atlas();
  const text = toPrintable(name);
  const vbH = Math.round((VBW * L.print.h) / (L.print.w * L.aspect));
  const out = Buffer.from(S.rgb);

  // where the print lands in the photo: print units -> lid units -> pixels
  const H = homography(L.quad.map(([px, py]) => [(px / 100) * S.w, (py / 100) * S.h]));
  const u0 = L.print.cx - L.print.w / 2, v0 = L.print.cy - L.print.h / 2;
  const toPx = (X, Y) => apply(H, u0 + (X / VBW) * L.print.w, v0 + (Y / vbH) * L.print.h);
  const pxPerUnit = Math.hypot(...[0, 1].map((k) => toPx(VBW, vbH / 2)[k] - toPx(0, vbH / 2)[k])) / VBW;

  let fitted = null;
  if (text) {
    const lay = layout(text, vbH);
    fitted = lay;
    const s = Math.min(2.2, Math.max(0.8, pxPerUnit * 2)); // raster pixels per print unit: about twice the photo's
    const k = (lay.size / a.em) * s; // atlas pixels -> raster pixels
    const lineH = lay.size * TYPE.lineBox * 0.875;
    const lines = lay.lines.map((l) => measureLine(l, lay.size));
    // centre the capitals' block on the print area
    const cap = a.capHeight * (lay.size / a.em);
    const blockH = cap + (lines.length - 1) * lineH;
    const top = vbH / 2 - blockH / 2;
    const margin = 40; // print units round the ink for the blur and the edges
    let inkL = Infinity, inkR = -Infinity;
    lines.forEach((m) => { const off = (VBW - (m.inkR - m.inkL)) / 2 - m.inkL; inkL = Math.min(inkL, m.inkL + off); inkR = Math.max(inkR, m.inkR + off); });
    const bx = Math.max(-VBW * LIGHT_MARGIN, inkL - margin), by = Math.max(-vbH * LIGHT_MARGIN, top - cap * 0.45 - margin);
    const ex = Math.min(VBW * (1 + LIGHT_MARGIN), inkR + margin), ey = Math.min(vbH * (1 + LIGHT_MARGIN), top + blockH + cap * 0.3 + margin);
    const RW = Math.ceil((ex - bx) * s), RH = Math.ceil((ey - by) * s);
    const A = new Float32Array(RW * RH);

    // glyphs into the alpha raster, area-sampled
    const sub = k < 1 ? 3 : 2;
    lines.forEach((m, li) => {
      const off = (VBW - (m.inkR - m.inkL)) / 2 - m.inkL;
      const baseline = top + cap + li * lineH;
      for (const p of m.placed) {
        const g = a.glyphs[p.ch];
        const gx = (p.x + off - bx) * s + g.x * k, gy = (baseline - by) * s + g.y * k;
        const x0 = Math.max(0, Math.floor(gx)), y0 = Math.max(0, Math.floor(gy));
        const x1 = Math.min(RW, Math.ceil(gx + g.w * k)), y1 = Math.min(RH, Math.ceil(gy + g.h * k));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          let acc = 0;
          for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
            const ax = (x + (sx + 0.5) / sub - gx) / k - 0.5, ay = (y + (sy + 0.5) / sub - gy) / k - 0.5;
            const ix = Math.floor(ax), iy = Math.floor(ay), fx = ax - ix, fy = ay - iy;
            const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h ? 0 : a.alpha[g.offset + yy * g.w + xx]);
            acc += (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
          }
          const v = acc / (sub * sub * 255), i = y * RW + x;
          A[i] = 1 - (1 - A[i]) * (1 - v);
        }
      }
    });

    // the foil, step by step as Logo studio's filter does it
    const metalLike = F.kind === "metal" || F.kind === "gloss", isGloss = F.kind === "gloss";
    const hField = gaussian(A, RW, RH, 2.6 * s);
    // a lit point over the print, as fePointLight x 300, y -120, z 300 in print units, unless a sweep moves it
    const LP = light || { x: 300, y: -120, z: 300 };
    const ks = isGloss ? 2 : metalLike ? 1.35 : F.spec, ex2 = isGloss ? 70 : metalLike ? 24 : 10;
    const kAdd = isGloss ? 0.7 : metalLike ? 0.45 : 0.4;
    const lightRgb = hex(F.light || "#ffffff").map((v) => v / 255);
    const stops = F.stops ? F.stops.map(hex) : null, flat = F.color ? hex(F.color) : null;
    // the gradient runs from the text box's corner across it and a little down, as sweep() sets it
    const tbx = inkL, tby = top - cap * 0.1, tbw = inkR - inkL, tbh = blockH + cap * 0.2;
    const gdx = tbw, gdy = 0.35 * tbh, gl2 = gdx * gdx + gdy * gdy;
    const follow = metalLike ? 0.6 : 1;
    const exposure = L.exposure[metalLike ? "metal" : "pigment"];
    const grain = L.grain && GRAINS[L.grain];
    const pull = makeNoise(4), boards = grain ? grain.layers.map((_, i) => makeNoise(11 + i)) : [];
    const grid = L.light, gr = grid.length, gc = grid[0].length;
    const lightAt = (X, Y) => {
      const gx = ((X + VBW * LIGHT_MARGIN) / (VBW * (1 + 2 * LIGHT_MARGIN))) * gc - 0.5;
      const gy = ((Y + vbH * LIGHT_MARGIN) / (vbH * (1 + 2 * LIGHT_MARGIN))) * gr - 0.5;
      const cx = Math.max(0, Math.min(gc - 1.001, gx)), cy = Math.max(0, Math.min(gr - 1.001, gy));
      const ix = Math.floor(cx), iy = Math.floor(cy), fx = cx - ix, fy = cy - iy;
      return (grid[iy][ix] * (1 - fx) + grid[iy][ix + 1] * fx) * (1 - fy) + (grid[iy + 1][ix] * (1 - fx) + grid[iy + 1][ix + 1] * fx) * fy;
    };
    // the pressed edges: shadow on the inner upper-left wall, light on the lower-right
    const shifted = (dx, dy) => {
      const o = new Float32Array(RW * RH), ox = Math.round(dx * s), oy = Math.round(dy * s);
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const sx = x - ox, sy = y - oy;
        o[y * RW + x] = sx < 0 || sy < 0 || sx >= RW || sy >= RH ? 0 : A[sy * RW + sx];
      }
      return o;
    };
    const s1 = shifted(2.6, 3.2), s2 = shifted(-2, -2.4);
    const rimA = new Float32Array(RW * RH), rimB = new Float32Array(RW * RH);
    for (let i = 0; i < A.length; i++) { rimA[i] = A[i] * (1 - s1[i]); rimB[i] = A[i] * (1 - s2[i]); }
    const shadow = gaussian(rimA, RW, RH, 1.5 * s), glow = gaussian(rimB, RW, RH, 1.3 * s);
    const dark = metalLike ? 0.36 : 0.22, lite = metalLike ? 0.3 : 0.18;
    // a browser draws the print at roughly 0.6 pixels a unit, and its lighting filter takes slopes per pixel
    const slope = 4 / 0.6 / s;

    const col = new Float32Array(RW * RH * 3);
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        const i = y * RW + x;
        if (A[i] < 0.002) continue;
        const X = bx + (x + 0.5) / s, Y = by + (y + 0.5) / s;
        // surface normal from the blurred print
        const hx = (hField[y * RW + Math.min(RW - 1, x + 1)] - hField[y * RW + Math.max(0, x - 1)]) * 0.5;
        const hy = (hField[Math.min(RH - 1, y + 1) * RW + x] - hField[Math.max(0, y - 1) * RW + x]) * 0.5;
        let nx = -slope * hx * s, ny = -slope * hy * s, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        let lx = LP.x - X, ly = LP.y - Y, lz = LP.z - 4 * hField[i];
        const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
        let hx2 = lx, hy2 = ly, hz2 = lz + 1;
        const hl = Math.hypot(hx2, hy2, hz2); hx2 /= hl; hy2 /= hl; hz2 /= hl;
        const spec = Math.min(1, ks * Math.pow(Math.max(0, nx * hx2 + ny * hy2 + nz * hz2), ex2));
        // the fill: the metal's bands, or the pigment
        let base;
        if (stops) {
          const t = Math.max(0, Math.min(1, ((X - tbx) * gdx + (Y - tby) * gdy) / gl2)) * (stops.length - 1);
          const j = Math.min(stops.length - 2, Math.floor(t)), f = t - j;
          base = [0, 1, 2].map((c) => (stops[j][c] + (stops[j + 1][c] - stops[j][c]) * f) / 255);
        } else base = flat.map((v) => v / 255);
        // the lid's own light, the foil's pulled grain, the board under it
        const shade = follow * (0.5 * lightAt(X, Y)) + 0.5 * (1 - follow);
        const nRaw = metalLike ? pull(X * 0.6, Y * 0.06) : pull(X * 0.7, Y * 0.7);
        const pv = (metalLike ? 0.28 : 0.16) * (0.5 + (nRaw - 0.5) * 0.55 - 0.5) + 0.5;
        let mult = 2 * shade * pv;
        if (grain) {
          let b = 0;
          grain.layers.forEach(([fx, fy], gi) => { b += boards[gi](X * fx, Y * fy) / grain.layers.length; });
          const amt = 2 * (metalLike ? grain.metal : grain.pigment);
          mult = 2 * mult * (amt * (0.5 + (b - 0.5) * 0.55 - 0.5) + 0.5);
        }
        const k2 = 2 * exposure * mult;
        let r = (base[0] + kAdd * Math.pow(spec * lightRgb[0], 2)) * k2;
        let g = (base[1] + kAdd * Math.pow(spec * lightRgb[1], 2)) * k2;
        let b = (base[2] + kAdd * Math.pow(spec * lightRgb[2], 2)) * k2;
        // shadow over it, then the light edge
        const sa = Math.min(1, dark * shadow[i]) * A[i], ga = Math.min(1, lite * glow[i]) * A[i];
        r = r * (1 - sa); g = g * (1 - sa); b = b * (1 - sa);
        r = r * (1 - ga) + ga; g = g * (1 - ga) + ga; b = b * (1 - ga) + ga;
        col[i * 3] = Math.min(1, r); col[i * 3 + 1] = Math.min(1, g); col[i * 3 + 2] = Math.min(1, b);
      }
    }

    // onto the photo: every pixel the print can touch, sampled back through the inverse homography, 3x3 per pixel
    const Hi = invert3(H);
    const corners = [[bx, by], [ex, by], [ex, ey], [bx, ey]].map(([X, Y]) => toPx(X, Y));
    const px0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])))), px1 = Math.min(S.w, Math.ceil(Math.max(...corners.map((c) => c[0]))));
    const py0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), py1 = Math.min(S.h, Math.ceil(Math.max(...corners.map((c) => c[1]))));
    const n = 3;
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        let ar = 0, ag = 0, ab = 0, aa = 0;
        for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
          const [u, v] = apply(Hi, x + (sx + 0.5) / n, y + (sy + 0.5) / n);
          const X = ((u - u0) / L.print.w) * VBW, Y = ((v - v0) / L.print.h) * vbH;
          const rx = (X - bx) * s - 0.5, ry = (Y - by) * s - 0.5;
          const ix = Math.floor(rx), iy = Math.floor(ry);
          if (ix < 0 || iy < 0 || ix + 1 >= RW || iy + 1 >= RH) continue;
          const fx = rx - ix, fy = ry - iy;
          const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
          const i00 = iy * RW + ix, i10 = i00 + 1, i01 = i00 + RW, i11 = i01 + 1;
          const a00 = A[i00] * w00, a10 = A[i10] * w10, a01 = A[i01] * w01, a11 = A[i11] * w11;
          aa += a00 + a10 + a01 + a11;
          ar += col[i00 * 3] * a00 + col[i10 * 3] * a10 + col[i01 * 3] * a01 + col[i11 * 3] * a11;
          ag += col[i00 * 3 + 1] * a00 + col[i10 * 3 + 1] * a10 + col[i01 * 3 + 1] * a01 + col[i11 * 3 + 1] * a11;
          ab += col[i00 * 3 + 2] * a00 + col[i10 * 3 + 2] * a10 + col[i01 * 3 + 2] * a01 + col[i11 * 3 + 2] * a11;
        }
        if (aa < 1e-4) continue;
        const alpha = aa / (n * n);
        const o = (y * S.w + x) * 3;
        out[o] = Math.round(out[o] * (1 - alpha) + (ar / aa) * 255 * alpha);
        out[o + 1] = Math.round(out[o + 1] * (1 - alpha) + (ag / aa) * 255 * alpha);
        out[o + 2] = Math.round(out[o + 2] * (1 - alpha) + (ab / aa) * 255 * alpha);
      }
    }
  }

  // the size asked for: the plate is 1200 square; smaller is a box filter down from it
  let rgb = out, W = S.w, Hh = S.h;
  const target = Math.max(200, Math.min(S.w, Math.round(width)));
  if (target < S.w) {
    const f = S.w / target, tw = target, th = Math.round(S.h / f);
    const small = Buffer.alloc(tw * th * 3);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const sx0 = Math.floor(x * f), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * f));
      const sy0 = Math.floor(y * f), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * f));
      let r = 0, g = 0, b = 0, c = 0;
      for (let yy = sy0; yy < sy1; yy++) for (let xx = sx0; xx < sx1; xx++) { const o = (yy * S.w + xx) * 3; r += out[o]; g += out[o + 1]; b += out[o + 2]; c++; }
      const o = (y * tw + x) * 3; small[o] = r / c; small[o + 1] = g / c; small[o + 2] = b / c;
    }
    rgb = small; W = tw; Hh = th;
  }
  const jpeg = encodeJpeg(rgb, W, Hh, quality);
  return { jpeg, name: text, size: fitted ? Math.round(fitted.size) : 0, lines: fitted ? fitted.lines.length : 0, ms: Date.now() - started };
}

module.exports = { renderNamePrint, cleanName, toPrintable, FOILS, scenes: () => Object.keys(lids()) };
