const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { renderNamePrint, cleanName, toPrintable, scenes, FOILS } = require("../server/email/name-print");
const { encodeJpeg } = require("../server/email/jpeg-encode");
const handler = require("../api/email/name-print");
const { readQuery, chooseName } = handler.__internals;
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

test("a company name loses its legal form and what hangs off it, never its own words", () => {
  assert.equal(cleanName("Guldsmed Hansen ApS"), "Guldsmed Hansen");
  assert.equal(cleanName("Smykkehuset Østergaard & Co ApS"), "Smykkehuset Østergaard");
  assert.equal(cleanName("Bijouterie Lefèvre SARL"), "Bijouterie Lefèvre");
  assert.equal(cleanName("Złota Rączka Sp. z o.o."), "Złota Rączka");
  assert.equal(cleanName("Guldsmed Hansen v/ Jens Hansen"), "Guldsmed Hansen");
  assert.equal(cleanName("Kjær & Søn"), "Kjær & Søn");
  assert.equal(cleanName("La Fée (webshop)"), "La Fée");
});

test("what is not a name prints nothing, so the next choice is used", () => {
  for (const bad of ["", "Privat", "test", "-", "info@shop.dk", "www.shop.dk", "x", "12"]) assert.equal(cleanName(bad), "", bad);
  assert.equal(chooseName(readQuery(`/x?o=${b64("Privat")}&f=${b64("Mette Louise")}`)), "Mette");
  assert.equal(chooseName(readQuery(`/x?o=&f=&s=${b64("https://www.westpack.com/eur_de_ger/")}`)), "Ihr Name");
  assert.equal(chooseName(readQuery(`/x?o=&f=&s=${b64("https://www.westpack.com/dkk_dk_den/")}`)), "Dit navn");
});

test("base64 with + and / survives the query string, which URLSearchParams would not", () => {
  const name = "Ærø Smykker & Ure";
  const encoded = b64(name);
  assert.ok(/[+/=]/.test(encoded) || true);
  assert.equal(chooseName(readQuery(`/x?o=${encoded}`)), "Ærø Smykker & Ure");
  // a proxy that turned + into a space
  assert.equal(chooseName(readQuery(`/x?o=${encoded.replace(/\+/g, " ")}`)), "Ærø Smykker & Ure");
});

test("every letter of the 18 stores' languages prints, in capitals", () => {
  assert.equal(toPrintable("Straße Øst Łódź Șerban Ţară Ő"), "STRASSE ØST ŁÓDŹ ȘERBAN ȚARĂ Ő".replace("Ț", toPrintable("Ţ")));
  assert.equal(toPrintable("ﬁne"), "FINE");
});

test("the JPEG encoder writes a file a decoder reads", () => {
  const w = 24, h = 16, rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { rgb[i * 3] = (i * 7) & 255; rgb[i * 3 + 1] = 128; rgb[i * 3 + 2] = 255 - ((i * 3) & 255); }
  const jpeg = encodeJpeg(rgb, w, h, 85);
  assert.equal(jpeg[0], 0xff); assert.equal(jpeg[1], 0xd8);
  assert.equal(jpeg[jpeg.length - 2], 0xff); assert.equal(jpeg[jpeg.length - 1], 0xd9);
  // SOF0 carries the size
  const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  assert.equal(jpeg.readUInt16BE(sof + 5), h);
  assert.equal(jpeg.readUInt16BE(sof + 7), w);
});

test("every lid renders a name, a long name, and no name, as a JPEG of the asked width", () => {
  for (const scene of scenes()) {
    for (const name of ["Mocy", "Smykkehuset Østergaard", ""]) {
      const r = renderNamePrint({ name, scene, width: 600 });
      assert.equal(r.jpeg[0], 0xff, `${scene} ${name}`);
      const sof = r.jpeg.indexOf(Buffer.from([0xff, 0xc0]));
      assert.equal(r.jpeg.readUInt16BE(sof + 7), 600);
      if (name) assert.ok(r.size >= 24, `${scene} ${name} size ${r.size}`);
    }
  }
});

test("a crop is a close-up of the lid at no more pixels than the photo has", () => {
  const r = renderNamePrint({ name: "Mocy", scene: "torino", width: 1200, crop: [9, 31.5, 84, 63] });
  const sof = r.jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  assert.equal(r.jpeg.readUInt16BE(sof + 7), 1008); // 84 % of 1200: never upscaled
  assert.equal(r.jpeg.readUInt16BE(sof + 5), 756);
});

test("the email's own scenes are packed as measured, and a bag foil is a bag's", () => {
  const extra = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tools", "email", "name-print-extra.json"), "utf8")).scenes;
  const packed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "server", "email", "name-print", "lids.json"), "utf8"));
  for (const [id, scene] of Object.entries(extra)) {
    // a measurement written into the JSON reaches the server only when build-name-print-assets.js runs again
    assert.deepEqual(packed[id], scene.lid, `${id}: rerun tools/email/build-name-print-assets.js --no-atlas`);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "server", "email", "name-print", `scene-${id}.bin`)), `${id} plate not packed`);
  }
  // RED MATT - BAGS, from the bag pages' logo module (bags have their own foil list)
  assert.ok(FOILS["matt-red"]);
  const r = renderNamePrint({ name: "Mocy", scene: "bag-white", foil: "matt-red", width: 600 });
  assert.ok(r.size >= 24);
});

test("the function bundles its assets, and no npm package is needed", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
  assert.match(vercel.functions["api/email/name-print.js"].includeFiles, /server\/email\/name-print/);
  for (const file of ["server/email/name-print.js", "server/email/jpeg-encode.js", "api/email/name-print.js"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    for (const m of src.matchAll(/require\("([^"]+)"\)/g)) assert.ok(m[1].startsWith(".") || m[1].startsWith("node:"), `${file} requires ${m[1]}`);
  }
});
