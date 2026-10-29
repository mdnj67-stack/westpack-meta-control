/**
 * Logo studio - "Type your brand name. We'll put it in gold."
 *
 * The visitor's brand name, or their own logo, foil-printed live on six real Westpack lids: close-ups from the
 * Content Library with Westpack's demo print removed (tools/signup/clean-plate.html). Each lid was measured on its
 * photo (tools/signup/lid-geometry.js): its four edges found to the pixel, so one homography lays the print flat on
 * the lid's surface - straight along its edges and foreshortened exactly as the camera saw it - at the site's
 * maximum logo size, as Westpack's own demo prints are. Each foil is as bright as Westpack's real foil measured in
 * the same photo. The print is SVG with real lighting: a specular highlight from a light that follows
 * the pointer or finger across the lid, the light and shade the lid itself has in the photo, the board's texture
 * where the material has one, fine foil grain, and the print pressed into the surface (a shadow on one inner wall,
 * light on the other). The foils are the ones the logo-printing page lists. Nothing is asked before the result is
 * shown in full.
 */
(function () {
  // Each lid as measured on its photo (tools/signup/lid-geometry.js): quad - the lid surface's corners in % of the
  // photo, in reading order (top-left, top-right, bottom-right, bottom-left); aspect - its width/height; print - the
  // print area in lid units; grain - the board's texture, if it has one; exposure - how bright real foil comes out on
  // it in this photo; light - a 12 x 12 grid of how bright the surface is over the print area and a margin round it,
  // relative to the print area's mean.
  // lids:begin - measured by tools/signup/lid-geometry.js refine; do not edit by hand
  const LIDS = {
    seville: {"quad":[[52.3,-0.19],[117.34,49.9],[38.79,106.44],[-29.94,42.83]],"aspect":1,"print":{"cx":0.55,"cy":0.51,"w":0.6,"h":0.6},"tone":"dark","foil":"gold","grain":null,"exposure":{"metal":0.62,"pigment":0.81},"light":[[1.116,1.145,1.116,1.09,1.098,1.09,1.09,1.116,1.09,1.168,1.194,1.194],[1.168,1.116,1.09,1.09,1.09,1.087,1.087,1.064,1.09,1.142,1.168,1.142],[1.116,1.113,1.113,1.09,1.09,1.064,1.061,1.061,1.038,1.038,1.116,1.142],[1.116,1.113,1.09,1.087,1.064,1.064,1.038,1.058,1.032,0.983,0.986,0.986],[1.09,1.09,1.069,1.061,1.038,1.035,1.027,1.025,1,0.957,0.934,0.986],[1.061,1.061,1.061,1.058,1.032,1.032,1.022,0.98,0.954,0.957,0.958,0.986],[1.038,1.038,1.035,1.024,0.986,0.986,0.96,0.947,0.931,0.957,0.978,1.013],[1.038,1.035,1.012,0.986,0.96,0.934,0.908,0.908,0.934,0.958,0.986,0.986],[1.012,0.986,0.986,0.96,0.934,0.882,0.882,0.908,0.934,0.96,1.012,1.038],[1.038,0.986,0.973,0.947,0.905,0.879,0.879,0.908,0.934,0.986,1.038,1.038],[1.02,1.038,0.96,0.908,0.879,0.879,0.905,0.931,0.96,0.986,1.012,1.012],[1.038,1.038,0.986,0.934,0.856,0.856,0.908,0.934,0.986,0.986,0.986,0.986]]},
    london: {"quad":[[53,-6.64],[113.56,43.04],[41.89,106.19],[-19.64,34.88]],"aspect":1,"print":{"cx":0.51,"cy":0.49,"w":0.66,"h":0.66},"tone":"light","foil":"silver","grain":null,"exposure":{"metal":0.7,"pigment":0.81},"light":[[0.997,1.005,1.006,1.011,1.018,1.017,1.011,1.01,1.009,1.01,1.01,1.011],[0.995,0.999,1.006,1.013,1.017,1.017,1.018,1.012,1.007,1.007,1.01,1.011],[0.995,1,1.008,1.014,1.014,1.019,1.019,1.019,1.009,1.004,1.004,1.009],[0.992,1.001,1.004,1.008,1.014,1.019,1.016,1.015,1.015,1.008,1.004,1.004],[0.992,0.998,1.002,1.005,1.011,1.011,1.008,1.009,1.01,1.012,1.007,1.002],[0.99,0.997,1.003,1.004,1.007,1.007,1.003,1.003,1.006,1.005,1.009,1.002],[0.989,0.995,0.999,0.999,1.002,0.999,0.999,1,1.006,1.006,1.003,0.995],[0.975,0.99,0.995,0.994,0.994,0.995,0.996,0.998,1.002,1.002,0.998,0.991],[0.965,0.976,0.99,0.987,0.986,0.991,0.991,0.995,0.998,0.995,0.986,0.986],[0.956,0.963,0.976,0.982,0.985,0.988,0.99,0.991,0.991,0.986,0.982,0.982],[0.953,0.955,0.958,0.967,0.976,0.976,0.982,0.982,0.98,0.975,0.971,0.972],[0.953,0.952,0.952,0.954,0.958,0.967,0.976,0.973,0.967,0.967,0.971,0.971]]},
    torino: {"quad":[[6.92,62.03],[60.28,33],[99.25,66.26],[42.58,100.87]],"aspect":1,"print":{"cx":0.5,"cy":0.47,"w":0.78,"h":0.7},"tone":"dark","foil":"gold","grain":null,"exposure":{"metal":0.89,"pigment":0.85},"light":[[1.024,1.024,1.013,1.013,1.024,1.045,1.047,1.038,1.018,1.008,0.995,0.995],[1.024,1.024,1.013,1.013,1.024,1.045,1.047,1.038,1.018,1.008,0.995,0.995],[1.005,1.005,1.005,1.002,1.011,1.018,1.013,0.999,0.967,0.953,0.938,0.992],[1.028,1.028,1.034,1.025,1.018,1.019,1.013,0.999,0.967,0.944,0.924,0.968],[1.042,1.042,1.061,1.038,1.034,1.034,1.028,1.005,0.98,0.953,0.924,0.951],[1.032,1.032,1.055,1.047,1.048,1.047,1.032,1.018,1.003,0.974,0.924,0.949],[1.018,1.018,1.032,1.047,1.047,1.038,1.032,1.018,1.003,0.974,0.924,0.924],[1.009,1.009,1.011,1.024,1.015,1.015,1.001,1.001,0.993,0.96,0.928,0.928],[0.996,0.996,1.001,1.001,1.002,0.992,0.992,0.988,0.972,0.945,0.932,0.932],[0.986,0.986,0.977,0.988,0.988,0.992,0.988,0.977,0.959,0.944,0.944,0.944],[0.988,0.988,0.986,0.996,1.011,1.015,1.009,1.001,0.986,0.959,0.959,0.959],[0.988,1.044,1.044,0.996,1.011,1.073,1.009,1.001,0.986,0.959,0.959,0.959]]},
    seoul: {"quad":[[7.07,25.85],[62.33,3.98],[105.19,42.52],[44.25,66.14]],"aspect":1,"print":{"cx":0.5,"cy":0.5,"w":0.72,"h":0.72},"tone":"mid","foil":"white","grain":"structured","exposure":{"metal":0.85,"pigment":0.87},"light":[[1.001,1.037,1.041,1.044,1.048,1.05,1.052,1.054,1.053,1.043,1.025,0.976],[0.936,0.982,0.988,0.993,0.993,0.993,0.999,0.999,1.004,1.004,1.004,0.972],[0.932,0.982,0.988,0.993,0.993,0.998,0.998,0.998,1.004,1.004,1.004,0.971],[0.932,0.988,0.993,0.993,0.998,0.998,0.998,1.004,1.004,1.004,1.01,0.986],[0.933,0.988,0.993,0.993,0.998,0.998,0.998,1.004,1.004,1.004,1.01,1.009],[0.941,0.993,0.993,0.998,0.998,0.998,0.998,1.004,1.004,1.01,1.01,0.998],[0.952,0.993,0.993,0.998,0.998,0.998,1.004,1.004,1.004,1.01,1.01,0.983],[0.96,0.993,0.998,0.998,0.998,0.998,1.004,1.004,1.004,1.01,1.01,0.98],[0.962,0.993,0.998,0.998,0.998,0.998,1.004,1.004,1.004,1.01,1.01,0.977],[0.965,0.993,0.995,0.998,0.998,0.998,1.004,1.004,1.004,1.01,1.01,0.977],[0.965,0.988,0.993,0.994,0.998,0.998,1.004,1.004,1.005,1.01,1.01,0.982],[0.962,0.988,0.988,0.988,0.987,0.982,0.979,0.976,0.981,0.982,0.991,0.988]]},
    madrid: {"quad":[[16.07,2.78],[79.11,7.94],[78.21,74.25],[25.3,65]],"aspect":0.963,"print":{"cx":0.5,"cy":0.47,"w":0.72,"h":0.62},"tone":"mid","foil":"oldrose","grain":"velour","exposure":{"metal":0.9,"pigment":1.1},"light":[[0.983,0.983,1.014,1.015,1.007,1.001,0.993,0.99,0.985,0.984,0.991,0.991],[0.983,0.983,1.014,1.015,1.007,1.001,0.993,0.99,0.985,0.984,0.991,0.999],[1.005,1.005,1.042,1.038,1.026,1.009,1.006,1.001,1.001,1.001,1.014,1.022],[1.007,1.007,1.047,1.042,1.026,1.014,1.009,1.001,1.001,1.009,1.018,1.022],[1,1,1.039,1.034,1.022,1.009,1.007,1.001,1.001,1.001,1.009,1.015],[0.992,0.992,1.03,1.026,1.018,1.009,1.001,1.001,1.001,1.001,1.001,1.001],[0.983,0.983,1.018,1.018,1.009,1.001,0.999,0.994,0.993,0.993,0.993,0.993],[0.974,0.974,1.009,1.009,1.002,0.999,0.992,0.987,0.983,0.983,0.981,0.974],[0.967,0.967,1.002,1.002,0.995,0.992,0.984,0.981,0.976,0.973,0.967,0.966],[0.959,0.959,0.994,0.992,0.987,0.983,0.976,0.973,0.966,0.965,0.957,0.956],[0.951,0.951,0.983,0.983,0.976,0.973,0.966,0.965,0.957,0.953,0.946,0.94],[0.951,0.943,0.975,0.975,0.972,0.965,0.957,0.953,0.949,0.945,0.94,0.932]]},
    frankfurt: {"quad":[[15.66,49.64],[59.93,18.34],[96.12,58.69],[50.84,92.64]],"aspect":1,"print":{"cx":0.5,"cy":0.5,"w":0.72,"h":0.72},"tone":"light","foil":"gold","grain":"linen","exposure":{"metal":0.5,"pigment":0.9},"light":[[0.976,0.989,0.985,0.981,0.978,0.976,0.973,0.972,0.971,0.97,0.971,0.959],[0.995,1.009,1.006,1.003,0.999,0.998,0.994,0.99,0.99,0.99,0.988,0.97],[0.995,1.009,1.007,1.003,1.001,0.999,0.997,0.994,0.993,0.992,0.991,0.97],[0.993,1.009,1.007,1.005,1.001,1,0.998,0.994,0.994,0.992,0.992,0.97],[0.992,1.009,1.007,1.005,1.004,1,1,0.996,0.996,0.996,0.992,0.97],[0.989,1.007,1.007,1.005,1.004,1,1,1,0.996,0.996,0.992,0.972],[0.989,1.008,1.007,1.005,1.004,1,1,0.999,0.996,0.996,0.996,0.974],[0.989,1.008,1.004,1.003,1.004,1,1,0.999,0.996,0.996,0.996,0.974],[0.99,1.008,1.004,1.003,1.003,1.001,0.999,0.996,0.996,0.996,0.996,0.974],[0.99,1.008,1.006,1.004,1.002,1.001,1,0.999,0.999,0.996,0.996,0.974],[0.993,1.008,1.006,1.005,1.002,1.002,1.001,0.999,0.999,0.999,0.996,0.977],[0.983,0.994,0.991,0.991,0.991,0.989,0.989,0.989,0.989,0.986,0.985,0.963]]},
  };
  // lids:end
  const BOX_ORDER = ["seville", "london", "torino", "seoul", "madrid", "frankfurt"];
  // the colours the logo-printing page lists, drawn as metal (a gradient that catches light) or as pigment
  const FOILS = {
    // gold as saturated as real gold foil photographs: measured on Westpack's demo prints at a median of (131,103,69)
    gold: { kind: "metal", light: "#ffe2a8", stops: ["#4a3214", "#9a7238", "#e6c27a", "#b58a4a", "#6e4f22", "#d9b46c", "#8f6a33", "#e9c983"] },
    silver: { kind: "metal", light: "#ffffff", stops: ["#5a5e63", "#adb2b8", "#f8f9fa", "#989da3", "#6d7176", "#e5e8eb", "#888d93", "#f4f5f7"] },
    rose: { kind: "metal", light: "#fff0e6", stops: ["#683626", "#b8745f", "#f7cfb9", "#a96a53", "#7a4231", "#eab69c", "#91533d", "#f3c8af"] },
    oldrose: { kind: "pigment", color: "#c4908a", spec: 0.35 },
    white: { kind: "pigment", color: "#f3f4f4", spec: 0.3 },
    black: { kind: "pigment", color: "#141414", spec: 1.05 },
    deboss: { kind: "deboss" },
  };
  // the board's own texture, which hot foil follows where it is pressed in: noise at the scale of the material
  // (print units: the print area is 1000 wide, about 38 mm), and how much of it shows in metal and in pigment
  const GRAINS = {
    structured: { layers: ["0.14 0.12"], octaves: 2, metal: 0.05, pigment: 0.09 },
    linen: { layers: ["0.2 0.02", "0.02 0.2"], octaves: 2, metal: 0.05, pigment: 0.08 },
    velour: { layers: ["0.3 0.28"], octaves: 2, metal: 0.04, pigment: 0.07 },
  };
  const TYPES = { classic: { size: 150, family: "WPS Fraunces, Georgia, serif", weight: 600, upper: true, spacing: 16 }, script: { size: 230, family: "WPS Pinyon Script, cursive", weight: 400, upper: false, spacing: 0 }, clean: { size: 118, family: "WPS Jost, Futura, sans-serif", weight: 560, upper: true, spacing: 30 } };
  const MAX_NAME = 28;
  // the print's own units: 1000 across the print area, and as tall as the lid's real proportions make it
  const VBW = 1000;
  const vbHeight = (lid) => Math.round((VBW * lid.print.h) / (lid.print.w * lid.aspect));
  // the light grid covers the print area grown by this share on every side (tools/signup/lid-geometry.js)
  const LIGHT_MARGIN = 0.1;
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs, children) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, String(v));
    for (const c of [].concat(children || [])) if (c) n.appendChild(c);
    return n;
  }

  // ---- geometry: a lid is a plane, so one homography puts the print exactly on it ----
  // from the unit square onto quad q (corners in reading order): x = (a u + b v + c) / (g u + h v + 1), y likewise
  function homography(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let g = 0, h = 0;
    if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) { const den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; }
    return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
  }
  function project(m, u, v) { const w = m.g * u + m.h * v + 1; return [(m.a * u + m.b * v + m.c) / w, (m.d * u + m.e * v + m.f) / w]; }
  // a point on the photo back to (u, v) on the plane
  function unproject(m, x, y) {
    const A = m.a - m.g * x, B = m.b - m.h * x, C = x - m.c, D = m.d - m.g * y, E = m.e - m.h * y, F = y - m.f, det = A * E - B * D;
    return [(C * E - B * F) / det, (A * F - C * D) / det];
  }
  // the print area's corners on the plate, a 1000 x 1000 stand-in for the photo
  function printQuad(lid) {
    const m = homography(lid.quad.map(([x, y]) => [x * 10, y * 10])), p = lid.print;
    const u0 = p.cx - p.w / 2, u1 = p.cx + p.w / 2, v0 = p.cy - p.h / 2, v1 = p.cy + p.h / 2;
    return [project(m, u0, v0), project(m, u1, v0), project(m, u1, v1), project(m, u0, v1)];
  }
  // the CSS transform that lays an element of w x h px, origin top-left, onto quad q
  function matrix3d(q, w, h) {
    const m = homography(q);
    return `matrix3d(${[m.a / w, m.d / w, 0, m.g / w, m.b / h, m.e / h, 0, m.h / h, 0, 0, 1, 0, m.c, m.f, 0, 1].map((n) => +n.toPrecision(10)).join(",")})`;
  }
  // the closest flat (affine) stand-in for homography m: exact at the print's centre and in its slope there, so
  // what a flat transform cannot follow is spread round the edges instead of piled into one corner
  function affineMatrix(m, w, h) {
    const W = m.g * 0.5 + m.h * 0.5 + 1, x = (m.a * 0.5 + m.b * 0.5 + m.c) / W, y = (m.d * 0.5 + m.e * 0.5 + m.f) / W;
    const xu = (m.a - m.g * x) / W, xv = (m.b - m.h * x) / W, yu = (m.d - m.g * y) / W, yv = (m.e - m.h * y) / W;
    return `matrix(${[xu / w, yu / w, xv / h, yv / h, x - 0.5 * xu - 0.5 * xv, y - 0.5 * yu - 0.5 * yv].map((n) => +n.toPrecision(10)).join(",")})`;
  }
  // where the print sits for a lid: the element's size on the plate and its transform (and the flat stand-in for
  // an engine that draws matrix3d without its perspective)
  function placement(lid) {
    const q = printQuad(lid);
    const w = Math.max(120, Math.round(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1])));
    const h = Math.round((w * vbHeight(lid)) / VBW);
    return { q, w, h, transform: matrix3d(q, w, h), affine: affineMatrix(homography(q), w, h), centre: project(homography(lid.quad), lid.print.cx, lid.print.cy) };
  }

  // the measured light across the print area as an image the filter can multiply by: grey 0.5 is the area's mean.
  // Drawn as SVG rather than canvas, so a browser that blocks canvas reads cannot turn it into noise.
  const shadeCache = {};
  function shadeUrl(id) {
    if (shadeCache[id]) return shadeCache[id];
    const g = LIDS[id].light, rows = g.length, cols = g[0].length, at = (i, j) => g[Math.max(0, Math.min(rows - 1, j))][Math.max(0, Math.min(cols - 1, i))];
    let cells = "";
    // one cell of padding all round, so the blur has the edge values to draw on rather than transparency
    for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) { const v = Math.max(0, Math.min(255, Math.round(127.5 * at(i, j)))); cells += `<rect x="${i}" y="${j}" width="1.02" height="1.02" fill="rgb(${v},${v},${v})"/>`; }
    const svg = `<svg xmlns="${NS}" viewBox="0 0 ${cols} ${rows}" width="${cols * 8}" height="${rows * 8}" preserveAspectRatio="none"><filter id="b" filterUnits="userSpaceOnUse" x="-1" y="-1" width="${cols + 2}" height="${rows + 2}"><feGaussianBlur stdDeviation="0.6"/></filter><g filter="url(#b)">${cells}</g></svg>`;
    return (shadeCache[id] = `data:image/svg+xml,${encodeURIComponent(svg)}`);
  }

  /**
   * The print: one SVG in the print area's own units, laid onto the lid by placement(). The filter is rebuilt when
   * the lid or the foil changes. lite (the thumbnails) draws the foil's colour only, without light or relief.
   */
  function makePrint(uid, lite) {
    // the metal runs across the print itself: set in print units from its measured box (sweep()), because WebKit
    // does not spread an objectBoundingBox gradient across text and painted every letter in the first, darkest stop
    const grad = svgEl("linearGradient", { id: `${uid}-g`, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: VBW, y2: 0 });
    const sweep = (x, y, w, h) => { grad.setAttribute("x1", x); grad.setAttribute("y1", y); grad.setAttribute("x2", x + w); grad.setAttribute("y2", y + 0.35 * h); };
    const filter = svgEl("filter", { id: `${uid}-f`, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
    const maskImg = svgEl("image", { preserveAspectRatio: "xMidYMid meet" });
    const mask = svgEl("mask", { id: `${uid}-m`, maskUnits: "userSpaceOnUse", x: 0, y: 0 }, [maskImg]);
    const text = svgEl("text", { x: VBW / 2, "text-anchor": "middle", "dominant-baseline": "central" });
    const logo = svgEl("rect", { x: 0, y: 0, width: VBW, mask: `url(#${uid}-m)` });
    const group = svgEl("g", lite ? {} : { filter: `url(#${uid}-f)` }, [text, logo]);
    const svg = svgEl("svg", { class: "ls-print", "aria-hidden": "true", focusable: "false", preserveAspectRatio: "none" }, [svgEl("defs", {}, [grad, filter, mask]), group]);
    let light = null, lidId = null, foilName = null, vbH = 300;

    function build() {
      const f = FOILS[foilName], lid = LIDS[lidId];
      grad.textContent = "";
      if (f.kind === "metal") f.stops.forEach((c, i) => grad.appendChild(svgEl("stop", { offset: `${(i / (f.stops.length - 1)) * 100}%`, "stop-color": c })));
      const fill = f.kind === "metal" ? `url(#${uid}-g)` : f.kind === "deboss" ? "#000" : f.color;
      text.setAttribute("fill", fill); logo.setAttribute("fill", fill);
      group.setAttribute("opacity", lite && f.kind === "deboss" ? "0.22" : "1");
      filter.textContent = "";
      light = null;
      if (lite) return;
      // the filter works on the print area plus the margin the light was measured over
      const mx = VBW * LIGHT_MARGIN, my = vbH * LIGHT_MARGIN;
      Object.entries({ x: -mx, y: -my, width: VBW + 2 * mx, height: vbH + 2 * my }).forEach(([k, v]) => filter.setAttribute(k, v));
      // every step works in sRGB, set on each one: WebKit does not pass it down from the filter, and in linear light
      // the neutral grey 0.5 the multiplies rest on becomes 0.21, which darkened its foil by almost half
      const add = (tag, attrs, kids) => { const n = svgEl(tag, Object.assign({ "color-interpolation-filters": "sRGB" }, attrs), kids); filter.appendChild(n); return n; };
      // the pressed edges, shared by every finish: shadow on the inner upper-left wall, light on the lower-right
      const edges = (dark, lite2) => {
        add("feOffset", { in: "SourceAlpha", dx: 2.6, dy: 3.2, result: "o1" });
        add("feComposite", { in: "SourceAlpha", in2: "o1", operator: "out", result: "rimA" });
        add("feGaussianBlur", { in: "rimA", stdDeviation: 1.5, result: "rimAb" });
        add("feFlood", { "flood-color": "#000", "flood-opacity": dark, result: "dk" });
        add("feComposite", { in: "dk", in2: "rimAb", operator: "in", result: "sh" });
        add("feComposite", { in: "sh", in2: "SourceAlpha", operator: "in", result: "shadow" });
        add("feOffset", { in: "SourceAlpha", dx: -2, dy: -2.4, result: "o2" });
        add("feComposite", { in: "SourceAlpha", in2: "o2", operator: "out", result: "rimB" });
        add("feGaussianBlur", { in: "rimB", stdDeviation: 1.3, result: "rimBb" });
        add("feFlood", { "flood-color": "#fff", "flood-opacity": lite2, result: "lt" });
        add("feComposite", { in: "lt", in2: "rimBb", operator: "in", result: "gl" });
        add("feComposite", { in: "gl", in2: "SourceAlpha", operator: "in", result: "glow" });
      };
      if (f.kind === "deboss") {
        // no foil at all: only the relief the cliché leaves in the surface
        edges(0.62, 0.42);
        add("feFlood", { "flood-color": "#000", "flood-opacity": 0.07, result: "tint" });
        add("feComposite", { in: "tint", in2: "SourceAlpha", operator: "in", result: "floor" });
        add("feMerge", {}, [svgEl("feMergeNode", { in: "floor" }), svgEl("feMergeNode", { in: "shadow" }), svgEl("feMergeNode", { in: "glow" })]);
        return;
      }
      const metal = f.kind === "metal";
      // Every step below works on opaque images and the print's shape is cut out once, at the end. An arithmetic
      // sum adds alpha as well as colour, and engines disagree on a highlight's alpha (Chrome gives it its brightest
      // channel, WebKit 1), so adding the highlight to the clipped foil thickened and greyed every letter in WebKit.
            // how much of the moving highlight is added: the measured real foil allows a glint, not a glare
      const SPEC_METAL = 0.45, SPEC_PIGMENT = 0.4;
      const OPAQUE = "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1";
      add("feColorMatrix", { in: "SourceGraphic", type: "matrix", values: OPAQUE, result: "foil" });
      add("feGaussianBlur", { in: "SourceAlpha", stdDeviation: 2.6, result: "h" });
      light = svgEl("fePointLight", { x: 300, y: -120, z: 300 });
      add("feSpecularLighting", { in: "h", surfaceScale: 4, specularConstant: metal ? 1.35 : f.spec, specularExponent: metal ? 24 : 34, "lighting-color": f.light || "#ffffff", result: "sp" }, [light]);
      add("feColorMatrix", { in: "sp", type: "matrix", values: OPAQUE, result: "spOpaque" });
      // squared, the opaque highlight is what Chrome added before (colour times its brightest channel), which is
      // what the foils were calibrated against
      add("feComponentTransfer", { in: "spOpaque", result: "spec" }, ["R", "G", "B"].map((c) => svgEl(`feFunc${c}`, { type: "gamma", amplitude: 1, exponent: 2, offset: 0 })));
      add("feComposite", { in: "foil", in2: "spec", operator: "arithmetic", k1: 0, k2: 1, k3: metal ? SPEC_METAL : SPEC_PIGMENT, k4: 0, result: "lit" });
      // the lid's own light: the print is as bright or as shaded as the surface under it. Grey 0.5 is neutral; metal
      // follows it less than pigment, because what a metal shows is mostly the light it reflects
      const follow = metal ? 0.6 : 1;
      add("feImage", { href: shadeUrl(lidId), x: -mx, y: -my, width: VBW + 2 * mx, height: vbH + 2 * my, preserveAspectRatio: "none", result: "shadeRaw" });
      add("feComponentTransfer", { in: "shadeRaw", result: "shade" }, ["R", "G", "B"].map((c) => svgEl(`feFunc${c}`, { type: "linear", slope: follow, intercept: 0.5 * (1 - follow) })));
      // every grain below is a grey image centred on 0.5 and multiplied in, so it shades the foil without washing out
      // its colour (a soft-light blend with noise did, and turned white foil grey)
      const gray = (from, to, s) => {
        add("feColorMatrix", { in: from, type: "matrix", values: "1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1", result: `${to}Raw` });
        add("feComponentTransfer", { in: `${to}Raw`, result: to }, ["R", "G", "B"].map((c) => svgEl(`feFunc${c}`, { type: "linear", slope: s, intercept: 0.5 * (1 - s) })));
      };
      // hot foil has a fine grain along the direction it was pulled
      add("feTurbulence", { type: "fractalNoise", baseFrequency: metal ? "0.6 0.06" : "0.7 0.7", numOctaves: 2, seed: 4, result: "n" });
      gray("n", "pull", metal ? 0.28 : 0.16);
      add("feComposite", { in: "shade", in2: "pull", operator: "arithmetic", k1: 2, k2: 0, k3: 0, k4: 0, result: "shadePulled" });
      let multiplier = "shadePulled";
      const grain = lid.grain && GRAINS[lid.grain];
      if (grain) {
        // the board's texture: foil pressed into structured or linen-look board shows it, darker in the valleys
        grain.layers.forEach((freq, i) => add("feTurbulence", { type: "fractalNoise", baseFrequency: freq, numOctaves: grain.octaves, seed: 11 + i, result: `b${i}` }));
        if (grain.layers.length > 1) add("feComposite", { in: "b0", in2: "b1", operator: "arithmetic", k2: 0.5, k3: 0.5, result: "b0" });
        gray("b0", "board", 2 * (metal ? grain.metal : grain.pigment));
        add("feComposite", { in: "shadePulled", in2: "board", operator: "arithmetic", k1: 2, k2: 0, k3: 0, k4: 0, result: "surface" });
        multiplier = "surface";
      }
      // lit x multiplier, then doubled so that grey 0.5 is neutral. The exposure is how bright Westpack's real foil
      // came out on this lid in this photo, so the print is as bright as a real one would be beside it. Only then is
      // the print's shape cut out, which keeps its edges exactly as the type draws them
      const exposure = lid.exposure[metal ? "metal" : "pigment"];
      add("feComposite", { in: "lit", in2: multiplier, operator: "arithmetic", k1: 1, k2: 0, k3: 0, k4: 0, result: "litLid" });
      add("feComponentTransfer", { in: "litLid", result: "lifted" }, ["R", "G", "B"].map((c) => svgEl(`feFunc${c}`, { type: "linear", slope: 2 * exposure, intercept: 0 })));
      add("feComposite", { in: "lifted", in2: "SourceAlpha", operator: "in", result: "onLid" });
      edges(metal ? 0.36 : 0.22, metal ? 0.3 : 0.18);
      add("feMerge", {}, [svgEl("feMergeNode", { in: "onLid" }), svgEl("feMergeNode", { in: "shadow" }), svgEl("feMergeNode", { in: "glow" })]);
    }
    function set(id, foil) {
      if (id === lidId && foil === foilName) return;
      if (id !== lidId) {
        lidId = id; vbH = vbHeight(LIDS[id]);
        svg.setAttribute("viewBox", `0 0 ${VBW} ${vbH}`);
        text.setAttribute("y", vbH / 2);
        logo.setAttribute("height", vbH); mask.setAttribute("width", VBW); mask.setAttribute("height", vbH);
      }
      foilName = foil;
      build();
    }
    // a name is set at a size that reads as a logo: a short one grows a little, a long one shrinks to the area,
    // and none runs taller than about a third of it
    function setName(name, type) {
      const t = TYPES[type];
      logo.setAttribute("display", "none"); text.removeAttribute("display");
      text.textContent = t.upper ? name.toLocaleUpperCase() : name;
      text.setAttribute("font-family", t.family); text.setAttribute("font-weight", t.weight); text.setAttribute("letter-spacing", t.spacing);
      text.setAttribute("font-size", t.size);
      try {
        const b = text.getBBox();
        if (b.width && b.height) text.setAttribute("font-size", Math.max(24, t.size * Math.min(1.3, (VBW * 0.94) / b.width, (vbH * 0.3) / b.height)).toFixed(1));
        const fitted = text.getBBox();
        sweep(fitted.x, fitted.y, fitted.width, fitted.height);
      } catch (e) { sweep(VBW * 0.1, vbH * 0.4, VBW * 0.8, vbH * 0.2); /* not laid out yet: the default size stands */ }
    }
    function setLogo(url, aspect) {
      text.setAttribute("display", "none"); logo.removeAttribute("display");
      const fitW = VBW * 0.9, fitH = vbH * 0.78;
      let w = fitW, h = fitW / aspect;
      if (h > fitH) { h = fitH; w = h * aspect; }
      maskImg.setAttribute("href", url);
      maskImg.setAttribute("x", (VBW - w) / 2); maskImg.setAttribute("y", (vbH - h) / 2);
      maskImg.setAttribute("width", w); maskImg.setAttribute("height", h);
      sweep((VBW - w) / 2, (vbH - h) / 2, w, h);
    }
    // the light, as a point over the print area: u, v in its own units (0-1 across, 0-1 down), z its height
    function setLight(u, v, z) { if (light) { light.setAttribute("x", (u * VBW).toFixed(0)); light.setAttribute("y", (v * vbH).toFixed(0)); light.setAttribute("z", ((z || 0.3) * VBW).toFixed(0)); } }
    return { svg, set, setName, setLogo, setLight };
  }

  /**
   * The visitor's own logo, made into a one-colour foil mask in the browser. Hot foil prints one colour, so every
   * part of the logo that differs from its background becomes foil. The file never leaves the browser.
   */
  async function logoMask(file) {
    if (!file || !/^image\//.test(file.type) || file.size > 12e6) throw new Error("type");
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      let w = img.naturalWidth || 600, h = img.naturalHeight || 300;
      const k = Math.min(1, 900 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
      const p = g.getImageData(0, 0, w, h).data;
      let clear = 0, n = 0, sr = 0, sg = 0, sb = 0, sn = 0;
      const border = (x, y) => { const i = (y * w + x) * 4; n++; if (p[i + 3] < 24) clear++; else { sr += p[i]; sg += p[i + 1]; sb += p[i + 2]; sn++; } };
      for (let x = 0; x < w; x++) { border(x, 0); border(x, h - 1); }
      for (let y = 0; y < h; y++) { border(0, y); border(w - 1, y); }
      const transparent = clear / n > 0.5, bg = [sr / Math.max(1, sn), sg / Math.max(1, sn), sb / Math.max(1, sn)];
      const ink = new Float32Array(w * h);
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, a = p[i * 4 + 3] / 255;
        let v = a;
        if (!transparent) { const d = Math.hypot(p[i * 4] - bg[0], p[i * 4 + 1] - bg[1], p[i * 4 + 2] - bg[2]) / 441; v = Math.max(0, Math.min(1, (d - 0.1) / 0.22)) * a; }
        ink[i] = v;
        if (v > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < x0) throw new Error("empty");
      const pad = Math.round(0.02 * Math.max(w, h));
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const o = document.createElement("canvas"); o.width = bw; o.height = bh;
      const og = o.getContext("2d"), od = og.createImageData(bw, bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const j = (y * bw + x) * 4; od.data[j] = od.data[j + 1] = od.data[j + 2] = 255; od.data[j + 3] = Math.round(ink[(y + y0) * w + (x + x0)] * 255); }
      og.putImageData(od, 0, 0);
      return { url: o.toDataURL("image/png"), aspect: bw / bh };
    } finally { URL.revokeObjectURL(src); }
  }

  function mount(stage, ctx) {
    const { el, copy, t } = ctx;
    const uid = `ls${Math.random().toString(36).slice(2, 7)}`;
    const choice = { box: "seville", foil: "gold", type: "classic", name: "", logo: null };
    let foilTouched = false;
    const firstChange = {};
    const once = (key) => { if (!firstChange[key]) { firstChange[key] = true; ctx.track(key); } };
    const displayName = () => (choice.name.trim() || copy.defaultName);
    const img = (id, w) => ctx.asset(`logo/box-${id}-${w}.webp`);
    const hide = (e) => { e.target.style.visibility = "hidden"; };
    const fine = Boolean(window.matchMedia && matchMedia("(pointer: fine)").matches);

    // ---- the scene: the photo, the print, a light hint ----
    const photo = el("img", { class: "ls-photo", alt: "", src: img("seville", 720), srcset: `${img("seville", 720)} 720w, ${img("seville", 1200)} 1200w`, sizes: "(min-width: 760px) 520px, 100vw", decoding: "async", draggable: "false", onerror: hide });
    const print = makePrint(uid);
    const printWrap = el("div", { class: "ls-print-wrap" }, [print.svg]);
    // the plate: the photo's 1000 x 1000 stand-in, scaled to the frame, so each lid's transform is a constant
    const plate = el("div", { class: "ls-plate" }, [printWrap]);
    const loupe = el("div", { class: "ls-loupe", "aria-hidden": "true" });
    const scene = el("div", { class: "ls-scene" }, [photo, plate]);
    const frame = el("figure", { class: "ls-frame", role: "img" }, [scene, loupe, el("figcaption", { class: "ls-illustration", text: copy.disclaimer })]);
    const hintEl = el("p", { class: "ls-light-hint", "aria-hidden": "true", text: fine ? copy.lightHintMouse : copy.lightHintTouch });
    const zoomBtn = el("button", { type: "button", class: "ls-zoom", "aria-pressed": "false", onclick: () => toggleZoom() }, [el("span", { text: copy.zoomIn })]);
    // every thumbnail carries the visitor's name too, so the six read as their own collection
    const thumbPrints = {};
    // projective: whether this engine draws matrix3d with its perspective; checked once the stage is laid out
    let projective = true;
    const lay = (wrap, lid) => { const p = placement(lid); wrap.style.width = `${p.w}px`; wrap.style.height = `${p.h}px`; wrap.style.transform = projective ? p.transform : p.affine; return p; };
    const thumbs = BOX_ORDER.map((id) => {
      const p = (thumbPrints[id] = makePrint(`${uid}-${id}`, true)), wrap = el("div", { class: "ls-print-wrap" }, [p.svg]);
      lay(wrap, LIDS[id]);
      return el("button", { type: "button", class: "ls-thumb", "data-box": id, "aria-pressed": "false", "aria-label": copy.boxes[id], title: copy.boxes[id], onclick: () => setBox(id, "thumb") }, [el("img", { src: img(id, 160), alt: "", loading: "lazy", decoding: "async", onerror: hide }), el("div", { class: "ls-plate" }, [wrap])]);
    });
    const boxName = el("p", { class: "ls-box-name", "aria-live": "polite" });
    const stageInner = el("div", { class: "ls-stage-inner" }, [frame, el("div", { class: "ls-under" }, [boxName, zoomBtn]), el("div", { class: "ls-thumbs", role: "group", "aria-label": copy.boxLabel }, thumbs), hintEl]);

    // ---- the controls ----
    const nameId = `${uid}-name`;
    const nameInput = el("input", { id: nameId, class: "ls-name-input", type: "text", maxlength: String(MAX_NAME), autocomplete: "organization", autocapitalize: "words", spellcheck: "false", placeholder: copy.namePlaceholder, enterkeyhint: "done" });
    const fileInput = el("input", { type: "file", class: "wps-visually-hidden", accept: "image/png,image/jpeg,image/webp,image/svg+xml", tabindex: "-1", "aria-hidden": "true" });
    const uploadBtn = el("button", { type: "button", class: "ls-upload", onclick: () => fileInput.click() }, [el("span", { class: "ls-upload-icon", "aria-hidden": "true", text: "↑" }), el("span", { text: copy.uploadCta })]);
    const useNameBtn = el("button", { type: "button", class: "wps-link ls-use-name", hidden: true, onclick: () => clearLogo(), text: copy.useName });
    const hint = el("p", { class: "ls-hint", "aria-live": "polite" });
    const group = (labelText, key, values, labels) => {
      const gid = `${uid}-${key}`;
      const buttons = values.map((v) => el("button", { type: "button", class: `ls-chip ls-chip-${key}`, "data-value": v, "aria-pressed": "false", onclick: () => setFoilOrType(key, v) }, [
        key === "foil" ? el("span", { class: `ls-swatch ls-swatch-${v}`, "aria-hidden": "true" }) : null,
        el("span", { class: key === "type" ? `ls-type-sample ls-type-${v}` : "", text: labels[v] }),
      ]));
      return { node: el("div", { class: "ls-group", role: "group", "aria-labelledby": gid }, [el("span", { id: gid, class: "ls-group-label", text: labelText }), el("div", { class: "ls-chips" }, buttons)]), buttons };
    };
    const foilGroup = group(copy.foilLabel, "foil", Object.keys(FOILS), copy.foil);
    const typeGroup = group(copy.typeLabel, "type", Object.keys(TYPES), copy.type);
    const nextBtn = el("button", { type: "button", class: "wps-btn wps-btn-primary ls-next", onclick: () => toResult() }, [el("span", { class: "wps-btn-label", text: `${copy.next} →` })]);

    const nameBlock = el("div", { class: "ls-name-block" }, [
      el("div", { class: "ls-name" }, [el("label", { class: "ls-name-label", for: nameId, text: copy.nameLabel }), nameInput]),
      el("div", { class: "ls-upload-row" }, [uploadBtn, useNameBtn, el("span", { class: "ls-upload-hint", text: copy.uploadHint })]),
      fileInput,
      hint,
    ]);
    // on a phone the field sits right under the box, so the first screen is the box and the field, and the box
    // stays in view above the keyboard while the name is typed (see is-typing in the CSS)
    const onPhone = ctx.device !== "desktop";
    if (onPhone) stageInner.insertBefore(nameBlock, stageInner.querySelector(".ls-thumbs"));
    // on a phone a small live copy of the box floats in the corner once the big one has scrolled away, so the
    // foil is never chosen blind
    const pip = onPhone ? el("div", { class: "ls-pip", "aria-hidden": "true" }) : null;
    const editPanel = el("div", { class: "ls-panel ls-edit" }, [
      el("p", { class: "wps-kicker wps-rise", text: copy.kicker }),
      el("h2", { class: "wps-title wps-rise wps-rise-2", text: copy.title }),
      el("p", { class: "wps-lede wps-rise wps-rise-3", text: copy.lede }),
      // anchored beside the foil options, where the column keeps room for it
      pip ? el("div", { class: "ls-pip-anchor" }, [pip]) : null,
      onPhone ? null : nameBlock,
      el("div", { class: "ls-options wps-rise wps-rise-4" }, [foilGroup.node, typeGroup.node]),
      nextBtn,
    ]);

    const resultTitle = el("h2", { class: "wps-title" });
    const proof = el("div", { class: "ls-proof", "aria-hidden": "true" }, [el("div", { class: "ls-proof-track" },
      ["02", "04", "05", "14", "20", "03", "02", "04", "05", "14", "20", "03"].map((n) => el("img", { src: ctx.asset(`logo/proof-${n}-360.webp`), alt: "", loading: "lazy", decoding: "async", onerror: (e) => { e.target.hidden = true; } })))]);
    const success = el("div", { class: "ls-success", hidden: true, tabindex: "-1" });
    const form = ctx.signupForm({
      buttonText: ctx.shell.signup,
      properties: () => ({ wp_brand_name: choice.name.trim(), wp_logo_finish: choice.foil, wp_logo_lid: choice.box, wp_logo_type: choice.type, wp_logo_uploaded: choice.logo ? "yes" : "no" }),
      organization: () => choice.name.trim(),
      onSuccess: (r) => showSuccess(r),
    });
    const resultPanel = el("div", { class: "ls-panel ls-result", hidden: true }, [
      el("p", { class: "wps-kicker", text: copy.kicker }),
      resultTitle,
      el("p", { class: "wps-lede", text: copy.resultLede }),
      el("p", { class: "ls-proof-title", text: copy.proofTitle }),
      proof,
      el("ul", { class: "wps-promise" }, ctx.shell.promise.map((p) => el("li", { text: p }))),
      form.form,
      el("button", { type: "button", class: "wps-link ls-back", onclick: () => toEdit(), text: `← ${copy.back}` }),
      success,
    ]);

    const layout = el("div", { class: "ls" }, [el("div", { class: "ls-stage" }, [stageInner]), el("div", { class: "ls-side" }, [editPanel, resultPanel])]);
    stage.appendChild(layout);

    // ---- rendering ----
    let placed = null;
    function place() {
      const lid = LIDS[choice.box];
      placed = lay(printWrap, lid);
      layout.dataset.tone = lid.tone;
      scene.style.setProperty("--zx", `${placed.centre[0]}%`); scene.style.setProperty("--zy", `${placed.centre[1]}%`);
    }
    // the plate follows the frame's size; the loupe's copy shares it, the floating copy sets its own. Once a resize
    // has settled, the print layer is nudged one pixel for a frame: Chrome can otherwise leave a perspective layer
    // undrawn after its parent's scale has changed (seen when the frame shrinks for the keyboard)
    let settle = 0;
    function fit() {
      const w = frame.clientWidth;
      if (!w) return;
      scene.style.setProperty("--k", (w / 1000).toFixed(5));
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (!placed) return;
        printWrap.style.width = `${placed.w + 1}px`;
        requestAnimationFrame(() => { printWrap.style.width = `${placed.w}px`; });
      }, 140);
    }
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(frame); else window.addEventListener("resize", fit);
    function render() {
      layout.dataset.foil = choice.foil; layout.dataset.box = choice.box;
      print.set(choice.box, choice.foil);
      if (choice.logo) print.setLogo(choice.logo.url, choice.logo.aspect);
      else print.setName(displayName(), choice.type);
      for (const id of BOX_ORDER) {
        const p = thumbPrints[id];
        p.set(id, foilTouched ? choice.foil : LIDS[id].foil);
        if (choice.logo) p.setLogo(choice.logo.url, choice.logo.aspect); else p.setName(displayName(), choice.type);
      }
      layout.classList.toggle("is-placeholder", !choice.name.trim() && !choice.logo);
      boxName.textContent = copy.boxes[choice.box];
      frame.setAttribute("aria-label", `${choice.logo ? copy.uploadCta : displayName()} – ${copy.foil[choice.foil]}, ${copy.boxes[choice.box]}`);
      thumbs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.box === choice.box)));
      if (pip) { pip.textContent = ""; const c = scene.cloneNode(true); c.style.setProperty("--tilt", "none"); c.style.setProperty("--k", ((pip.clientWidth || 108) / 1000).toFixed(5)); pip.appendChild(c); }
      foilGroup.buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === choice.foil)));
      typeGroup.buttons.forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.value === choice.type)); b.disabled = Boolean(choice.logo); });
      refreshLoupe();
    }
    function setBox(id, how) {
      if (id === choice.box) return;
      choice.box = id; once("option_box");
      // a box shows its own natural finish until the visitor has picked one
      if (!foilTouched) choice.foil = LIDS[id].foil;
      scene.classList.add("is-swapping");
      const next = new Image();
      next.onload = next.onerror = () => {
        photo.src = img(id, 720); photo.srcset = `${img(id, 720)} 720w, ${img(id, 1200)} 1200w`;
        place(); render(); scene.classList.remove("is-swapping"); sweep();
      };
      next.src = img(id, ctx.device === "desktop" ? 1200 : 720);
      if (how === "swipe") thumbs.find((b) => b.dataset.box === id).scrollIntoView({ inline: "nearest", block: "nearest" });
    }
    function setFoilOrType(key, value) {
      if (choice[key] === value) return;
      choice[key] = value; if (key === "foil") foilTouched = true;
      once(`option_${key}`); render(); sweep();
    }

    // ---- light: follows the pointer or finger, drifts on its own, and sweeps across on every change ----
    let raf = 0, idleT = 0, interacting = false, sweepUntil = 0, sweepFrom = 0;
    function frameLight(now) {
      raf = 0;
      if (!stage.isConnected) return;
      if (now < sweepUntil) {
        const k = 1 - (sweepUntil - now) / 950;
        print.setLight(-0.35 + k * 1.7, -0.55 + Math.sin(k * Math.PI) * 0.47); schedule(); return;
      }
      if (!interacting && !ctx.reducedMotion) {
        idleT = now / 1000;
        print.setLight(0.5 + 0.62 * Math.sin(idleT * 0.42), -0.15 + 0.6 * Math.cos(idleT * 0.31)); schedule();
      }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(frameLight); }
    function sweep() { if (ctx.reducedMotion) { print.setLight(0.52, -0.45); return; } sweepFrom = performance.now(); sweepUntil = sweepFrom + 950; schedule(); }
    function lightFromPointer(e) {
      const r = frame.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      // the light hangs over the point on the lid under the pointer, so the foil lights up where it is touched
      if (placed) { const [pu, pv] = unproject(homography(placed.q), u * 1000, v * 1000); if (Number.isFinite(pu) && Number.isFinite(pv)) print.setLight(Math.max(-0.6, Math.min(1.6, pu)), Math.max(-0.8, Math.min(1.8, pv)) - 0.1, 0.24); }
      // a small tilt of the whole scene, as a box tilts in the hand. Only while a mouse is over it: at rest the scene
      // stays flat, because Chrome stops drawing the lid's perspective layer after a resize inside a 3D context
      if (!ctx.reducedMotion && fine) scene.style.setProperty("--tilt", `perspective(900px) rotateX(${((0.5 - v) * 5).toFixed(2)}deg) rotateY(${((u - 0.5) * 6).toFixed(2)}deg)`);
      moveLoupe(e, u, v);
    }
    frame.addEventListener("pointermove", (e) => { interacting = true; once("light_moved"); lightFromPointer(e); });
    frame.addEventListener("pointerleave", () => { interacting = false; scene.style.setProperty("--tilt", "none"); loupe.classList.remove("is-on"); schedule(); });

    // ---- loupe (mouse) and zoom (touch): the foil up close ----
    let clone = null;
    function refreshLoupe() {
      if (!fine) return;
      loupe.textContent = "";
      clone = scene.cloneNode(true);
      clone.classList.add("ls-loupe-scene");
      clone.style.setProperty("--tilt", "none");
      loupe.appendChild(clone);
    }
    function moveLoupe(e, u, v) {
      if (!fine || !clone || layout.classList.contains("is-zoomed")) return;
      const r = frame.getBoundingClientRect(), z = 2.6, R = loupe.offsetWidth / 2 || 85;
      loupe.classList.add("is-on");
      loupe.style.transform = `translate(${u * r.width - R}px, ${v * r.height - R}px)`;
      clone.style.width = `${r.width}px`; clone.style.height = `${r.height}px`;
      clone.style.transform = `translate(${R - u * r.width * z}px, ${R - v * r.height * z}px) scale(${z})`;
    }
    function toggleZoom() {
      const on = !layout.classList.contains("is-zoomed");
      layout.classList.toggle("is-zoomed", on);
      zoomBtn.setAttribute("aria-pressed", String(on));
      zoomBtn.firstChild.textContent = on ? copy.zoomOut : copy.zoomIn;
      if (on) { ctx.track("zoom"); sweep(); }
    }

    // ---- swipe between boxes on the photo (touch) ----
    let sx = null;
    frame.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { sx = e.clientX; interacting = true; lightFromPointer(e); } });
    frame.addEventListener("pointerup", (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null; interacting = false; schedule();
      if (Math.abs(dx) > 60 && !layout.classList.contains("is-zoomed")) {
        const i = BOX_ORDER.indexOf(choice.box);
        setBox(BOX_ORDER[(i + (dx < 0 ? 1 : BOX_ORDER.length - 1)) % BOX_ORDER.length], "swipe");
      }
    });

    // ---- name and logo ----
    let typingTimer = null;
    nameInput.addEventListener("input", () => {
      choice.name = nameInput.value.slice(0, MAX_NAME);
      once("name_typed");
      if (!choice.logo) render();
      const n = choice.name.trim();
      hint.textContent = /^westpack$/i.test(n) ? copy.hintWestpack : n.length > 16 ? copy.hintLong : "";
      clearTimeout(typingTimer);
      typingTimer = setTimeout(sweep, 380);
    });
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nameInput.blur(); if (!onPhone) toResult(); } });
    if (onPhone) {
      nameInput.addEventListener("focus", () => { layout.classList.add("is-typing"); ctx.dialog.scrollTo({ top: 0 }); });
      nameInput.addEventListener("blur", () => { layout.classList.remove("is-typing"); });
    }
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        choice.logo = await logoMask(file);
        ctx.track("logo_uploaded");
        uploadBtn.classList.add("is-active"); useNameBtn.hidden = false;
        hint.textContent = copy.uploadOneColour;
        render(); sweep();
      } catch (e) {
        ctx.track("logo_failed");
        hint.textContent = copy.uploadError;
      }
    });
    function clearLogo() {
      choice.logo = null; uploadBtn.classList.remove("is-active"); useNameBtn.hidden = true; hint.textContent = "";
      render(); sweep(); nameInput.focus();
    }

    // ---- result and success ----
    function toResult() {
      ctx.track("result");
      resultTitle.textContent = t(copy.resultTitle, { name: choice.logo && !choice.name.trim() ? copy.defaultName : displayName() });
      layout.classList.add("is-result");
      if (layout.classList.contains("is-zoomed")) toggleZoom();
      editPanel.hidden = true; resultPanel.hidden = false;
      resultPanel.classList.remove("wps-rise"); void resultPanel.offsetWidth; resultPanel.classList.add("wps-rise");
      sweep();
      if (ctx.device === "desktop") form.focus(); else ctx.dialog.scrollTo({ top: 0, behavior: ctx.reducedMotion ? "auto" : "smooth" });
    }
    function toEdit() {
      ctx.track("back");
      layout.classList.remove("is-result");
      resultPanel.hidden = true; editPanel.hidden = false;
      nameInput.focus();
    }
    function showSuccess(result) {
      layout.classList.add("is-success");
      [...resultPanel.children].forEach((c) => { if (c !== success) c.hidden = true; });
      success.hidden = false;
      success.append(
        el("p", { class: "wps-kicker", text: copy.kicker }),
        el("h2", { class: "wps-title ls-success-title", text: result.doubleOptIn ? ctx.shell.doiTitle : t(copy.successTitle, { name: choice.name.trim() || copy.defaultName }) }),
        el("p", { class: "wps-lede", text: result.doubleOptIn ? ctx.shell.doiBody : copy.successBody }),
        el("button", { type: "button", class: "wps-btn wps-btn-ghost", onclick: () => ctx.close("done"), text: ctx.shell.close }),
      );
      success.focus();
      sweep();
    }

    let io = null;
    if (pip && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => { for (const e of entries) layout.classList.toggle("is-pip", !e.isIntersecting && !layout.classList.contains("is-result")); }, { root: ctx.dialog, threshold: 0.3 });
      io.observe(frame);
    }
    place(); fit(); render();
    // Some engines paint a matrix3d without its perspective when the layer is not composited (WebKit's software
    // path does): the print then lands as a skewed parallelogram. Measure where the far corner of the print really
    // is; if it is off, every lid uses the closest flat transform instead, which is right at the centre.
    requestAnimationFrame(() => {
      if (!placed || !frame.clientWidth) return;
      const probe = document.createElement("i");
      probe.style.cssText = `position:absolute;left:${placed.w - 1}px;top:${placed.h - 1}px;width:2px;height:2px`;
      printWrap.appendChild(probe);
      const r = probe.getBoundingClientRect(), f = frame.getBoundingClientRect();
      probe.remove();
      const k = f.width / 1000, dx = (r.left + r.right) / 2 - f.left - placed.q[2][0] * k, dy = (r.top + r.bottom) / 2 - f.top - placed.q[2][1] * k;
      if (Math.hypot(dx, dy) > f.width * 0.015) {
        projective = false;
        place();
        for (const b of thumbs) lay(b.querySelector(".ls-print-wrap"), LIDS[b.dataset.box]);
        render();
      }
    });
    // the fonts arrive after the first paint; measure the name again once they have
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
    setTimeout(sweep, 650);
    schedule();
    return { initialFocus: ctx.device === "desktop" ? nameInput : null, destroy() { cancelAnimationFrame(raf); raf = 0; clearTimeout(typingTimer); if (io) io.disconnect(); clearTimeout(settle); if (ro) ro.disconnect(); else window.removeEventListener("resize", fit); } };
  }

  function peekVisual(ctx) {
    return ctx.el("img", { src: ctx.asset("logo/proof-04-360.webp"), alt: "" });
  }

  window.WestpackSignup.registerConcept("logo-studio", { mount, peekVisual });
})();
