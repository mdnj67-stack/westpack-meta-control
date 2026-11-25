/**
 * The survey block in one file per Magento store view (sprog/<store>.html), the way the blog posts are versioned: the
 * user makes the survey one page per store, all with URL key customer-survey-2026 (25/11: "give mig kode på hvert sprog
 * som link heri, ligesom når vi versionere blogpost").
 *
 * survey.html stays the master: every language in STR, the language picked from the store in the address, so it works
 * pasted anywhere. Each file here is that block cut down to its own store's language - STR holds that one language, the
 * language is fixed rather than read from the address, and the text in the markup (what shows before the script runs)
 * is already in that language, with the store's own webshop link. Nothing else differs, so a fix is made in survey.html
 * and this is run again; a test fails if a file is not what this makes from the current survey.html.
 *
 *   node templates/customer-feedback-survey/sprog.js      writes sprog/<store>.html for the 18 stores + sprog/felter.md
 */
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "survey.html");
const OUT = path.join(__dirname, "sprog");

// Store view -> a Danish name for felter.md, in the order the team works through them (the 18 stores the links use).
const NAMES = {
  dkk_dk_den: "Danmark", gbp_uk_eng: "UK", eur_eu_eng: "EU (engelsk)", usd_us_eng: "USA", eur_eu_ger: "Tyskland",
  eur_eu_fra: "Frankrig", eur_eu_ita: "Italien", eur_eu_spa: "Spanien", eur_eu_ned: "Holland", eur_eu_por: "Portugal",
  sek_se_swe: "Sverige", nok_no_nor: "Norge", eur_eu_fin: "Finland", pln_pl_pol: "Polen", eur_eu_rou: "Rumænien",
  eur_eu_cze: "Tjekkiet", eur_eu_svk: "Slovakiet", eur_eu_hun: "Ungarn",
};
const LANG_NAME = { da: "dansk", en: "engelsk", de: "tysk", fr: "fransk", it: "italiensk", es: "spansk", nl: "hollandsk",
  pt: "portugisisk", sv: "svensk", nb: "norsk", fi: "finsk", pl: "polsk", ro: "rumænsk", cs: "tjekkisk", sk: "slovakisk",
  hu: "ungarsk" };

const STR_RE = /  var STR = \{[\s\S]*?\n  \};/;
const PICK = 'var L = STR[want] ? want : "en";';
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, "&nbsp;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const jsString = (s) => JSON.stringify(s).replace(/\u00a0/g, "\\u00a0").replace(/<\//g, "<\\/");

function readMaster(html = fs.readFileSync(SRC, "utf8")) {
  const STR = Function(`return ${html.match(/var STR = (\{[\s\S]*?\n  \});/)[1]}`)();
  const STORE_LANG = Function(`return ${html.match(/var STORE_LANG = (\{[^}]*\});/)[1]}`)();
  return { html, STR, STORE_LANG };
}

// One store's paste file from the master's text. Throws if the master no longer has a place this expects, so a change
// to survey.html can never produce a file that silently keeps the old Danish or reads the language from the address.
function buildForStore(html, store) {
  const { STR, STORE_LANG } = readMaster(html);
  const lang = STORE_LANG[store];
  if (!lang || !STR[lang]) throw new Error(`no language for ${store}`);
  const T = STR[lang];
  let out = html;
  const swap = (re, to, what) => {
    let n = 0;
    out = out.replace(re, (...m) => { n++; return typeof to === "function" ? to(...m) : to; });
    if (!n) throw new Error(`${store}: ${what} not found in survey.html`);
  };
  // the script: this language only, and fixed
  const lines = Object.keys(T).map((k) => `      ${k}: ${jsString(T[k])}`).join(",\n");
  swap(STR_RE, `  // ${NAMES[store] || store} (${store}): the ${lang} version of survey.html, made by sprog.js. Edit survey.html, not this.\n  var STR = {\n    ${lang}: {\n${lines}\n    }\n  };`, "STR");
  swap(PICK, `var L = "${lang}";`, "the language pick");
  // the markup: the same words before the script runs
  swap(/(data-t="(\w+)"[^>]*>)([^<]*)(<)/g, (m, open, key, text, close) => {
    if (!(key in T)) throw new Error(`${store}: no ${key} in ${lang}`);
    return open + esc(T[key]) + close;
  }, "data-t texts");
  swap(/(<h2 class="wpfb-h"[^>]*>)([^<]*)(<\/h2>)/, (m, a, t, b) => a + esc(T.h1) + b, "the question");
  swap(/(<p class="wpfb-sub" data-sub>)([^<]*)(<\/p>)/, (m, a, t, b) => a + esc(T.sub1) + b, "the line under the question");
  swap(/(<textarea [^>]*placeholder=")([^"]*)(")/, (m, a, t, b) => a + attr(T.placeholder) + b, "the placeholder");
  swap(/(<p data-help>)[\s\S]*?(<\/p>)/, (m, a, b) => {
    const [before, after] = T.help.split("{mail}");
    return a + esc(before) + '<a class="wpfb-mail" href="mailto:sales@westpack.com">sales@westpack.com</a>' + esc(after) + b;
  }, "the help line");
  swap(/(data-shop href=")\/[a-z_]+\/(")/, (m, a, b) => `${a}/${store}/${b}`, "the webshop link");
  return out;
}

function felter(STR, STORE_LANG) {
  const rows = Object.keys(NAMES).map((store) => {
    const lang = STORE_LANG[store];
    return `| ${NAMES[store]} | \`${store}\` | [${store}.html](${store}.html) | ${LANG_NAME[lang] || lang} | ${STR[lang].title} |`;
  });
  return [
    "# Kundeundersøgelsen – én side pr. butik",
    "",
    "Lavet af `../sprog.js` ud fra `../survey.html`. Ret i `survey.html` og kør `node templates/customer-feedback-survey/sprog.js`,",
    "ikke i filerne her.",
    "",
    "Hver butik har sin egen side i Magento (Content → Pages). Alle sider får de samme felter, undtagen butikken og koden:",
    "",
    "- **URL Key:** `customer-survey-2026` (præcis sådan – alle links i mailene går dertil)",
    "- **Page in Websites:** kun butikkens eget store view",
    "- **Content Heading:** tom",
    "- **Design → Layout:** 1 column",
    "- **Indhold:** ét **HTML Code**-element i Page Builder. Tøm feltet, og sæt **hele** butikkens fil ind.",
    "- **Page Title** ses kun i browserfanen; forslaget står i tabellen.",
    "",
    "Test bagefter med `#k=test` efter adressen, fx `https://www.westpack.com/eur_eu_ger/customer-survey-2026#k=test`,",
    "eller alle 18 på én gang: `node tmp/playwright-runner/survey-languages-check.js`.",
    "",
    "| Butik | Store view | Fil | Sprog | Page Title (fanen) |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "UK, EU og USA har samme engelske tekst; filerne er ens bortset fra linket til webshoppen. Butikker uden for de 18",
    "(fx Grækenland, Kroatien) får ingen mails med link, så de behøver ingen side.",
    "",
  ].join("\n");
}

if (require.main === module) {
  const { html, STR, STORE_LANG } = readMaster();
  fs.mkdirSync(OUT, { recursive: true });
  for (const store of Object.keys(NAMES)) {
    const file = buildForStore(html, store);
    new Function(file.match(/<script>([\s\S]*?)<\/script>/)[1]); // parses, or this throws
    fs.writeFileSync(path.join(OUT, `${store}.html`), file);
    console.log(`${store}.html  ${STORE_LANG[store]}  ${Buffer.byteLength(file)} bytes`);
  }
  fs.writeFileSync(path.join(OUT, "felter.md"), felter(STR, STORE_LANG));
  console.log("felter.md");
}

module.exports = { buildForStore, readMaster, NAMES };
