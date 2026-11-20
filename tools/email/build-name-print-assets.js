#!/usr/bin/env node
/**
 * Builds what server/email/name-print.js needs to foil-print a name on a real Westpack lid without a browser or an
 * npm package: each Logo studio plate as raw pixels, the lids' measured geometry, and Fraunces 600 as a glyph atlas.
 *
 *   node tools/email/build-name-print-assets.js
 *
 * Needs sharp and Playwright, which this repo does not install: SHARP=<path to sharp> and PLAYWRIGHT=<path to
 * playwright> (defaults are the local ones this was first built with). Writes server/email/name-print/:
 *   scene-<lid>.bin  - "WPSC", width, height (u16 LE), then the RGB rows deflated after an "up" filter
 *   glyphs.bin       - "WPGA", index length (u32 LE), index JSON, then every glyph's alpha deflated as one block
 *   lids.json        - LIDS as measured in signup/concepts/logo-studio.js (between lids:begin and lids:end)
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "server", "email", "name-print");
const SHARP = process.env.SHARP || "C:/Users/mdj.WEP/AppData/Local/Temp/claude/c--Projects-westpack-meta-control/2b1dab85-1dac-42c2-bdb8-2716c5ab7ae7/scratchpad/bgkit/node_modules/sharp";
const PLAYWRIGHT = process.env.PLAYWRIGHT || path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright");

const SCENES = ["seville", "london", "bag", "torino", "seoul", "madrid", "frankfurt"];
const EM = 240; // the atlas's font size in pixels
// Upper case only: every name is set in spaced capitals, as a jewellery house sets its own. Latin and Latin
// Extended-A cover the 18 stores' languages; Romanian's comma-below letters and the capital sharp s are added.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ"
  + "ĀĂĄĆĈĊČĎĐĒĔĖĘĚĜĞĠĢĤĦĨĪĬĮİĴĶĹĻĽĿŁŃŅŇŊŌŎŐŒŔŖŘŚŜŞŠŢŤŦŨŪŬŮŰŲŴŶŹŻŽȘȚẞ";
const MARKS = "&.,-'’+/!?():#“”\"–·*@";
const CHARS = [...new Set([...LETTERS, ...MARKS])];

function lidsFromLogoStudio() {
  const src = fs.readFileSync(path.join(ROOT, "signup", "concepts", "logo-studio.js"), "utf8");
  const block = src.split("// lids:begin")[1].split("// lids:end")[0];
  const body = block.slice(block.indexOf("{"), block.lastIndexOf("}") + 1);
  return Function(`"use strict"; return (${body});`)();
}

function packScene(raw, width, height) {
  const row = width * 3;
  const filtered = Buffer.alloc(raw.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < row; x++) {
      const i = y * row + x;
      filtered[i] = (raw[i] - (y ? raw[i - row] : 0)) & 255;
    }
  }
  const head = Buffer.alloc(8);
  head.write("WPSC", 0, "ascii");
  head.writeUInt16LE(width, 4);
  head.writeUInt16LE(height, 6);
  return Buffer.concat([head, zlib.deflateSync(filtered, { level: 9 })]);
}

async function buildAtlas() {
  const { chromium } = require(PLAYWRIGHT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fontUrl = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(ROOT, "signup", "assets", "fonts", f)).toString("base64");
  await page.setContent("<!doctype html><canvas></canvas>");
  const result = await page.evaluate(async ({ chars, em, latin, ext }) => {
    for (const url of [latin, ext]) {
      const face = new FontFace("NP Fraunces", `url(${url})`, { weight: "400 700" });
      await face.load();
      document.fonts.add(face);
    }
    await document.fonts.ready;
    const font = `600 ${em}px "NP Fraunces"`;
    const c = document.createElement("canvas");
    const g = c.getContext("2d", { willReadFrequently: true });
    g.font = font;
    const capM = g.measureText("H");
    const glyphs = {};
    for (const ch of chars) {
      g.font = font;
      const m = g.measureText(ch);
      const left = Math.ceil(m.actualBoundingBoxLeft) + 2, right = Math.ceil(m.actualBoundingBoxRight) + 2;
      const up = Math.ceil(m.actualBoundingBoxAscent) + 2, down = Math.ceil(m.actualBoundingBoxDescent) + 2;
      const w = Math.max(1, left + right), h = Math.max(1, up + down);
      c.width = w; c.height = h;
      g.font = font; g.textBaseline = "alphabetic"; g.fillStyle = "#000";
      g.clearRect(0, 0, w, h);
      g.fillText(ch, left, up);
      const data = g.getImageData(0, 0, w, h).data;
      const alpha = new Array(w * h);
      for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
      glyphs[ch] = { advance: m.width, x: -left, y: -up, w, h, alpha };
    }
    // kerning: what a pair measures beyond its two letters' own advances
    g.font = font;
    const kern = {};
    const width = {};
    for (const a of chars) width[a] = g.measureText(a).width;
    for (const a of chars) for (const b of chars) {
      const k = g.measureText(a + b).width - width[a] - width[b];
      if (Math.abs(k) >= 0.5) kern[a + b] = Math.round(k * 10) / 10;
    }
    return { em, capHeight: capM.actualBoundingBoxAscent, space: g.measureText(" ").width, glyphs, kern };
  }, { chars: CHARS, em: EM, latin: fontUrl("fraunces-normal-400_700-latin.woff2"), ext: fontUrl("fraunces-normal-400_700-latin-ext.woff2") });
  await browser.close();
  const index = { em: result.em, capHeight: result.capHeight, space: result.space, kern: result.kern, glyphs: {} };
  const blobs = [];
  let offset = 0;
  for (const [ch, gl] of Object.entries(result.glyphs)) {
    index.glyphs[ch] = { advance: Math.round(gl.advance * 100) / 100, x: gl.x, y: gl.y, w: gl.w, h: gl.h, offset };
    blobs.push(Buffer.from(gl.alpha));
    offset += gl.w * gl.h;
  }
  const json = Buffer.from(JSON.stringify(index));
  const head = Buffer.alloc(8);
  head.write("WPGA", 0, "ascii");
  head.writeUInt32LE(json.length, 4);
  return Buffer.concat([head, json, zlib.deflateSync(Buffer.concat(blobs), { level: 9 })]);
}

async function main() {
  const sharp = require(SHARP);
  fs.mkdirSync(OUT, { recursive: true });
  const lids = lidsFromLogoStudio();
  const keep = {};
  for (const id of SCENES) keep[id] = lids[id];
  fs.writeFileSync(path.join(OUT, "lids.json"), JSON.stringify(keep));
  for (const id of SCENES) {
    const { data, info } = await sharp(path.join(ROOT, "signup", "assets", "logo", `box-${id}-1200.webp`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const packed = packScene(data, info.width, info.height);
    fs.writeFileSync(path.join(OUT, `scene-${id}.bin`), packed);
    console.log(`scene-${id}.bin ${info.width}x${info.height} ${(packed.length / 1024).toFixed(0)} KB`);
  }
  const atlas = await buildAtlas();
  fs.writeFileSync(path.join(OUT, "glyphs.bin"), atlas);
  console.log(`glyphs.bin ${CHARS.length} glyphs ${(atlas.length / 1024).toFixed(0)} KB`);
}

main().catch((error) => { console.error(error); process.exit(1); });
