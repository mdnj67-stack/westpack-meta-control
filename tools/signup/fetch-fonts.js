/**
 * Downloads the Signup Lab typefaces once and self-hosts them in signup/assets/fonts/, with a fonts.css of
 * @font-face rules. Loading them from Google's servers at runtime would hand every visitor's IP address to
 * Google, which a German court found unlawful without consent (LG München I, 3 O 17493/20, 2022).
 *
 * Fraunces (display), Jost (the clean lettering in the logo studio) and Pinyon Script (its script lettering) are
 * all under the SIL Open Font License. Only the latin and latin-ext subsets are kept: every store language,
 * Polish, Czech, Slovak, Hungarian and Romanian included, is covered by them.
 *
 * Usage: node tools/signup/fetch-fonts.js
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "..", "signup", "assets", "fonts");
const FAMILIES = [
  "Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400",
  "Jost:wght@400..600",
  "Pinyon+Script",
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f}`).join("&")}&display=swap`, { headers: { "user-agent": UA } })).text();
  const blocks = css.split("/*").slice(1).map((b) => ({ subset: b.slice(0, b.indexOf("*/")).trim(), body: b.slice(b.indexOf("*/") + 2) }));
  const keep = blocks.filter((b) => b.subset === "latin" || b.subset === "latin-ext");
  let out = "/* Self-hosted, SIL Open Font License. Built by tools/signup/fetch-fonts.js. */\n";
  for (const b of keep) {
    const family = b.body.match(/font-family: '([^']+)'/)[1];
    const style = b.body.match(/font-style: (\w+)/)[1];
    const weight = b.body.match(/font-weight: ([\d ]+)/)[1].trim();
    const src = b.body.match(/url\((https:[^)]+)\)/)[1];
    const range = b.body.match(/unicode-range: ([^;]+);/)[1];
    const name = `${family.toLowerCase().replace(/\s+/g, "-")}-${style}-${weight.replace(/\s+/g, "_")}-${b.subset}.woff2`;
    const dest = path.join(OUT, name);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, Buffer.from(await (await fetch(src)).arrayBuffer()));
    out += `@font-face{font-family:"WPS ${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url("${name}") format("woff2");unicode-range:${range};}\n`;
    console.log(`${name} ${Math.round(fs.statSync(dest).size / 1024)}KB`);
  }
  fs.writeFileSync(path.join(OUT, "fonts.css"), out);
})().catch((e) => { console.error(e.message); process.exit(1); });
