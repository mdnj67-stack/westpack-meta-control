// Turn an unpacked xlsx directory into one JSON file per sheet: an array of rows,
// each row an array of cell values (shared strings resolved, numbers as numbers).
// Usage: node xlsx-dump.js <unpacked-dir> <out-dir>
const fs = require("fs");
const path = require("path");

const [dir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

const ssXml = fs.readFileSync(path.join(dir, "xl", "sharedStrings.xml"), "utf8");
const shared = [];
for (const si of ssXml.match(/<si>[\s\S]*?<\/si>/g) || []) {
  const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
  shared.push(decode(parts.join("")));
}

const wb = fs.readFileSync(path.join(dir, "xl", "workbook.xml"), "utf8");
const rels = fs.readFileSync(path.join(dir, "xl", "_rels", "workbook.xml.rels"), "utf8");
const relTarget = {};
for (const m of rels.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relTarget[m[1]] = m[2];
for (const m of rels.matchAll(/<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)) relTarget[m[2]] = m[1];

const colIndex = (ref) => {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

for (const m of wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
  const [, name, rid] = m;
  const file = path.join(dir, "xl", relTarget[rid].replace(/^\/?xl\//, ""));
  const xml = fs.readFileSync(file, "utf8");
  const rows = [];
  for (const rm of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = Number(rm[1]) - 1;
    const row = [];
    for (const cm of rm[2].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] || "";
      const ref = attrs.match(/r="([A-Z]+\d+)"/)[1];
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val = null;
      if (t === "s") val = shared[Number(v)];
      else if (t === "inlineStr") val = decode([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
      else if (t === "str" || t === "e") val = v === undefined ? null : decode(v);
      else if (t === "b") val = v === "1";
      else if (v !== undefined) val = Number(v);
      row[colIndex(ref)] = val;
    }
    rows[r] = row;
  }
  const out = path.join(outDir, `${name}.json`);
  fs.writeFileSync(out, JSON.stringify(rows));
  console.log(`${name}: ${rows.length} rows -> ${out}`);
}
