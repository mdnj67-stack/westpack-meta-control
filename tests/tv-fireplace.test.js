const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, copyFileSync, rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

// The office TV (tv/): a WebGL wood stove that shows the KPIs from /api/tv. Most of what can go
// wrong there only shows in a browser, so these pin the failure modes that have happened or
// would be invisible until the TV had been running for hours.

const root = join(__dirname, "..");
const engine = readFileSync(join(root, "tv", "fire-engine.js"), "utf8");
const app = readFileSync(join(root, "tv", "tv.js"), "utf8");
const page = readFileSync(join(root, "tv", "index.html"), "utf8");

function shaderSources(source) {
  return [...source.matchAll(/`(#version 300 es[\s\S]*?)`;/g)].map((m) => m[1]);
}

test("the TV's scripts parse", () => {
  const dir = mkdtempSync(join(tmpdir(), "wp-tv-parse-"));
  try {
    for (const file of ["fire-engine.js", "tv.js"]) {
      const target = join(dir, file);
      copyFileSync(join(root, "tv", file), target);
      const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no shader declares a name GLSL ES 3.00 reserves", () => {
  // "patch" and "cast" each failed the whole stove once - the page then falls back to plain
  // text, so nothing looks broken in a quick glance at the code.
  const reserved = new Set([
    "attribute", "varying", "coherent", "volatile", "restrict", "readonly", "writeonly", "resource",
    "atomic_uint", "noperspective", "patch", "sample", "subroutine", "common", "partition", "active",
    "asm", "class", "union", "enum", "typedef", "template", "this", "goto", "inline", "noinline",
    "public", "static", "extern", "external", "interface", "long", "short", "double", "half", "fixed",
    "unsigned", "superp", "input", "output", "hvec2", "hvec3", "hvec4", "dvec2", "dvec3", "dvec4",
    "fvec2", "fvec3", "fvec4", "sampler3DRect", "filter", "image1D", "image2D", "image3D", "sizeof",
    "cast", "namespace", "using", "round", "mix", "step", "clamp", "length", "distance", "smoothstep",
    "texture", "sign", "floor", "fract", "mod", "min", "max", "abs", "pow", "exp", "sqrt", "dot"
  ]);
  const shaders = shaderSources(engine);
  assert.ok(shaders.length >= 6, "expected the scene, spark, bloom and composite shaders");
  const offenders = [];
  for (const src of shaders) {
    for (const m of src.matchAll(/\b(?:float|int|bool|vec[234]|mat[234])\s+([A-Za-z_]\w*)\s*(?:[=;,)]|\[)/g)) {
      if (reserved.has(m[1])) offenders.push(m[1]);
    }
  }
  assert.deepEqual(offenders, []);
});

test("scrolling noise stays exact after hours: phases wrap where the noise repeats", () => {
  // Time never reaches the shaders as a growing float. Each layer's phase is computed in double
  // precision and wrapped at the lattice period, and the noise hashes its lattice mod 256, so
  // the wrap is invisible. A phase multiplied by a non-integer would jump at the wrap.
  assert.match(engine, /const PERIOD = 256;/);
  assert.match(engine, /PHASE_RATES\.map\(\(rate\) => \(t \* rate\) % PERIOD\)/);
  assert.match(engine, /p = mod\(p, 256\.0\);/);
  const rates = engine.match(/const PHASE_RATES = \[([\s\S]*?)\];/)[1].match(/\d+(?:\.\d+)?(?=\s*,|\s*\/\/|\s*$)/gm);
  const declared = Number(engine.match(/uniform float uPh\[(\d+)\];/)[1]);
  assert.equal(rates.length, declared, "one rate per phase uniform");
  for (const src of shaderSources(engine)) {
    for (const m of src.matchAll(/uPh\[(\d+)\]/g)) {
      assert.ok(Number(m[1]) < declared, `uPh[${m[1]}] is out of range`);
    }
    for (const m of src.matchAll(/uPh\[\d+\]\s*\*\s*(\d+(?:\.\d+)?)/g)) {
      assert.ok(Number.isInteger(Number(m[1])), `a phase is scaled by ${m[1]}, which jumps at the wrap`);
    }
  }
});

test("texture reads inside a branch never rely on implicit derivatives", () => {
  // A plain texture() inside the text branch drew a bright line across the whole screen where
  // the branch began: derivatives are undefined in non-uniform control flow.
  for (const src of shaderSources(engine)) {
    assert.doesNotMatch(src, /\btexture\(uText,/);
    assert.doesNotMatch(src, /\btexture\(uPlate,/);
  }
});

test("demo figures are never shown without saying so", () => {
  assert.match(app, /if \(DEMO\) left = "DEMO · IKKE RIGTIGE TAL";/);
  assert.match(app, /const DEMO = params\.has\("demo"\);/);
  // the real programme only ever renders scenes the server built
  assert.match(app, /state\.scenes = await fetchScenes\(\);/);
});

test("a failed refresh keeps the last figures and says so on the stove", () => {
  assert.match(app, /if \(!state\.failingSince\) state\.failingSince = Date\.now\(\);/);
  assert.match(app, /ingen forbindelse, tal fra/);
});

test("the page loads only its own scripts and the brand font", () => {
  const scripts = [...page.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ["/tv/fire-engine.js", "/tv/tv.js"]);
  assert.match(page, /family=IBM\+Plex\+Sans/);
  assert.match(page, /<meta name="robots" content="noindex">/);
});
