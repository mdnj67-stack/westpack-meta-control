/**
 * Self-hosts Instrument Serif (SIL Open Font License) for the W47 blog post's headings, next to the Signup Lab's
 * typefaces in signup/assets/fonts/, which vercel.json already serves with CORS and a year's cache. The post imports
 * instrument-serif.css from there instead of from Google's servers: loading Google Fonts at runtime hands every
 * visitor's IP address to Google, which a German court found unlawful without consent (LG München I, 3 O 17493/20,
 * 2022), and the store's own theme self-hosts its Inter for the same reason.
 *
 * Kirsten's second read (2026-11-20) asked for the H2s to stand out with "den flotte skrifttype" - the email's
 * Instrument Serif. Only the latin and latin-ext subsets are kept, which cover every store language.
 *
 * Usage: node templates/w47-forsendelse-blog/fetch-font.js
 * The CSS is cached for a year as immutable: change a file's name, never its content.
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "..", "signup", "assets", "fonts");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

(async () => {
  const css = await (await fetch("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap", { headers: { "user-agent": UA } })).text();
  const blocks = css.split("/*").slice(1).map((b) => ({ subset: b.slice(0, b.indexOf("*/")).trim(), body: b.slice(b.indexOf("*/") + 2) }));
  const keep = blocks.filter((b) => b.subset === "latin" || b.subset === "latin-ext");
  if (keep.length !== 4) throw new Error(`expected 4 faces (2 styles x 2 subsets), got ${keep.length}`);
  let out = "/* Instrument Serif, self-hosted (SIL Open Font License) for the W47 blog post. Built by templates/w47-forsendelse-blog/fetch-font.js. */\n";
  for (const b of keep) {
    const style = b.body.match(/font-style: (\w+)/)[1];
    const src = b.body.match(/url\((https:[^)]+)\)/)[1];
    const range = b.body.match(/unicode-range: ([^;]+);/)[1];
    const name = `instrument-serif-${style}-400-${b.subset}.woff2`;
    const dest = path.join(OUT, name);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, Buffer.from(await (await fetch(src)).arrayBuffer()));
    out += `@font-face{font-family:"WP Instrument Serif";font-style:${style};font-weight:400;font-display:swap;src:url("${name}") format("woff2");unicode-range:${range};}\n`;
    console.log(`${name} ${Math.round(fs.statSync(dest).size / 1024)}KB`);
  }
  fs.writeFileSync(path.join(OUT, "instrument-serif.css"), out);
})().catch((e) => { console.error(e.message); process.exit(1); });
