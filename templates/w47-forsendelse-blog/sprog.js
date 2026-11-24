/**
 * The W47 blog post in every store view's language: one paste file per Magento store view (sprog/<store>.html).
 *
 * The Danish master is src/forsendelse-da.html (readable, with its <style> and <script>). This splits it in two:
 * the design and the behaviour become one shared stylesheet and script on our Vercel (store-blog/w47-forsendelse/),
 * and each store view's paste file holds only its own words plus a <link> and a <script src> to them. Inline, German,
 * Finnish or Polish lands on the HTML Code element's 64 KB and Greek or Bulgarian (two bytes a letter) passes it; shared,
 * a design fix reaches all 24 store views without anyone pasting again.
 *
 * Translation is the app's own Duplicate & translate engine (POST /api/openai/klaviyo-translate-template on production:
 * glossary, form of address per market, protected series names, the claim rules), on the rollout's path: Danish ->
 * English (UK), then English -> every other language, because the glossary's source language is English.
 *
 *   node templates/w47-forsendelse-blog/sprog.js build        shared CSS/JS + the Danish carrier; says which Danish
 *                                                             fragments changed since the translations were made
 *   node templates/w47-forsendelse-blog/sprog.js names        the six look names per language, one small call each
 *   node templates/w47-forsendelse-blog/sprog.js translate en | all | de fr ...
 *   node templates/w47-forsendelse-blog/sprog.js links        every link on every store + the jewellery boxes' print fee
 *   node templates/w47-forsendelse-blog/sprog.js assemble     sprog/<store>.html + sprog/felter.md, with checks
 *
 * After any change to the Danish: build, translate en, read the English, translate all, links, assemble - then commit
 * store-blog/ (goes live on deploy) and sprog/ (to paste). assemble refuses translations made from older Danish.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const { extractHtmlSegments } = require(path.join(ROOT, "server", "lib", "klaviyo-template-variant"));
const SRC = path.join(__dirname, "src", "forsendelse-da.html");
const OUT = path.join(__dirname, "sprog");
const TR = path.join(OUT, "tr");
const ASSET_DIR = path.join(ROOT, "store-blog", "w47-forsendelse");
const ASSETS = "https://project-4fcxa.vercel.app/store-blog/w47-forsendelse/";
const BASE = "https://project-4fcxa.vercel.app";

// Store view -> translation, the page's lang, and a Danish name for felter.md.
const STORES = [
  ["dkk_dk_den", "da", "da", "Danmark"], ["gbp_uk_eng", "en", "en-GB", "UK"], ["eur_eu_eng", "en", "en", "EU (engelsk)"],
  ["usd_us_eng", "en-US", "en-US", "USA"], ["eur_eu_ger", "de", "de", "Tyskland"], ["eur_eu_fra", "fr", "fr", "Frankrig"],
  ["eur_eu_ita", "it", "it", "Italien"], ["eur_eu_spa", "es", "es", "Spanien"], ["eur_eu_ned", "nl", "nl", "Holland"],
  ["eur_eu_por", "pt", "pt", "Portugal"], ["sek_se_swe", "sv", "sv", "Sverige"], ["nok_no_nor", "nb", "nb", "Norge"],
  ["eur_eu_fin", "fi", "fi", "Finland"], ["pln_pl_pol", "pl", "pl", "Polen"], ["eur_eu_rou", "ro", "ro", "Rumænien"],
  ["eur_eu_cze", "cs", "cs", "Tjekkiet"], ["eur_eu_svk", "sk", "sk", "Slovakiet"], ["eur_eu_hun", "hu", "hu", "Ungarn"],
  ["eur_eu_ell", "el", "el", "Grækenland"], ["eur_eu_bgn", "bg", "bg", "Bulgarien"], ["eur_eu_est", "et", "et", "Estland"],
  ["eur_eu_hrv", "hr", "hr", "Kroatien"], ["eur_eu_lav", "lv", "lv", "Letland"], ["eur_eu_lit", "lt", "lt", "Litauen"],
];
// The labels the rollout passes. The glossary only resolves some forms: "Tysk (DE)" works, "German (DE)" and the
// catalogue's "Tjekkisk (CZ)" / "Ungarsk (HU)" / "Slovakisk (SK)" do not, so those three go as English names.
const LANGS = {
  en: "English (UK)", "en-US": "English (US)", de: "Tysk (DE)", fr: "Fransk (FR)", it: "Italiensk (IT)", es: "Spansk (ES)",
  nl: "Hollandsk (NL)", pt: "Portugisisk (PT)", sv: "Svensk (SE)", nb: "Norsk (NO)", fi: "Finsk (FI)", pl: "Polsk (PL)",
  ro: "Rumænsk (RO)", cs: "Czech", sk: "Slovak", hu: "Hungarian", el: "Greek (GR)", bg: "Bulgarian (BG)",
  et: "Estonian (EE)", hr: "Croatian (HR)", lv: "Latvian (LV)", lt: "Lithuanian (LT)",
};
// The post's own Magento fields, translated with it (they travel as carrier paragraphs).
const FIELDS = {
  title: "Den store forsendelsesguide: 5 julelooks til postæsken",
  short: "Fem julelooks til postæsken, fem trin til at pakke dem – og alt det praktiske om logotryk, prøver og frister.",
  metaTitle: "Den store forsendelsesguide: 5 julelooks til postæsken | Westpack",
  metaDesc: "Fem julelooks til postæsken med trin for trin, indkøbslister og alt det praktiske om logotryk, prøver og frister til jul.",
};
const NOTE = [
  "This is a blog post on Westpack's web shop (one HTML block), not an email. The readers are business owners who sell and ship products to their own customers; Westpack sells them the packaging.",
  "Translate every fragment: headings, body text, list items, product names in the shopping lists, button labels, figure captions, image alt texts, and the hidden fragments at the very end (texts the page swaps in, and the post's title, summary and SEO fields).",
  "Use this market's own Westpack names for products and categories where the glossary has them (postal box, tissue paper, gift wrapping paper, satin ribbon, jewellery box, logo print).",
  "'Look 01' to 'Look 06' are the names of five gift-wrapping styles and one do-it-yourself mix: keep the word Look and the numbers.",
  "'digitaltryk' / 'digital print' is a printing technique beside foil: always name it as digital print, never just 'print'.",
  "Working days for logo orders are production time, never delivery time. Samples are not free.",
  "Keep this sentence's meaning exactly: 'The first recommended deadlines for orders with print fall as early as 10 December - and they differ from country to country.'",
  "Use the target language's own quotation marks and decimal separator. Keep it as short and punchy as the source; headings and buttons must stay short.",
].join(" ");
const EN_NAMES = ["Pink & gold", "Red Christmas", "Gold stars", "Green branches", "Black & silver", "Mix your own"];

const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const tr = (code) => readJson(path.join(TR, code + ".json"), null);
const segs = (html) => extractHtmlSegments(html).segments;

// ---- the Danish master, split -------------------------------------------------------------------------------------
function splitSource() {
  const src = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const m = src.match(/^<div id="w47fs" class="w47fs" lang="da">\n<style>([\s\S]*?)<\/style>\n([\s\S]*?)\n<script>([\s\S]*?)<\/script>\n<\/div>\s*$/);
  if (!m) throw new Error("src/forsendelse-da.html is not <div id=w47fs><style>…</style> markup <script>…</script></div>");
  const markup = m[2].split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  const shared = `<div id="w47fs" class="w47fs" lang="da">\n<link rel="stylesheet" href="${ASSETS}w47fs.css">\n${markup}\n<script src="${ASSETS}w47fs.js"></script>\n</div>\n`;
  return { css: m[1].trim(), js: m[3].trim(), shared };
}

// The texts the page swaps in (data-r-t / data-w-t) and the Magento fields travel as hidden carrier paragraphs at the
// end, because the engine translates text and alt/title/aria-label but not data-* attributes.
function toCarrier(html) {
  const vals = [];
  const body = html.replace(/\s(data-[rw]-t)="([^"]*)"/g, (x, k, v) => { vals.push(v.replace(/&quot;/g, '"')); return ` ${k}="@@C${vals.length - 1}@@"`; });
  const carrier = `<div hidden data-carrier>${vals.map((v, i) => `<p data-c="${i}">${v}</p>`).join("")}${Object.entries(FIELDS).map(([k, v]) => `<p data-f="${k}">${v}</p>`).join("")}</div>`;
  return body.replace(/<\/div>\s*$/, `${carrier}\n</div>\n`);
}
function fromCarrier(html) {
  const m = html.match(/<div hidden data-carrier>([\s\S]*?)<\/div>\n<\/div>\s*$/);
  if (!m) throw new Error("carrier missing");
  const vals = {}, fields = {};
  for (const [, i, v] of m[1].matchAll(/<p data-c="(\d+)">([\s\S]*?)<\/p>/g)) vals[i] = v;
  for (const [, k, v] of m[1].matchAll(/<p data-f="(\w+)">([\s\S]*?)<\/p>/g)) fields[k] = v.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const body = (html.slice(0, m.index) + "</div>\n").replace(/@@C(\d+)@@/g, (x, i) => {
    if (vals[i] === undefined) throw new Error("carrier value " + i + " missing");
    return vals[i].replace(/"/g, "&quot;");
  });
  return { body, fields };
}
// The markup a translation must leave untouched: every tag, without the attributes that are copy.
const skeleton = (h) => (h.match(/<[^>]+>/g) || []).map((t) => t.replace(/\s(alt|aria-label|title)="[^"]*"/g, "").replace(/\sdata-[rw]-t="[^"]*"/g, ""));

function build() {
  const { css, js, shared } = splitSource();
  const head = "/* W47 blog post 'Den store forsendelsesguide', shared by every store view. Built from templates/w47-forsendelse-blog/src/forsendelse-da.html by sprog.js - edit there, not here. */\n";
  if (/fonts\.googleapis|fonts\.gstatic/.test(css)) throw new Error("Google Fonts hands visitors' IPs to Google; use the self-hosted copy");
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  fs.writeFileSync(path.join(ASSET_DIR, "w47fs.css"), head + css + "\n");
  fs.writeFileSync(path.join(ASSET_DIR, "w47fs.js"), head + js + "\n");
  const da = toCarrier(shared), old = tr("da");
  fs.mkdirSync(TR, { recursive: true });
  if (old && old.body !== da) {
    const a = segs(old.body), b = segs(da);
    const changed = b.map((s, i) => (s !== a[i] ? i : -1)).filter((i) => i > -1);
    console.log(skeleton(old.body).join() !== skeleton(da).join()
      ? "The Danish markup changed: translate en and all again."
      : `${changed.length} Danish fragment(s) changed - translate again or patch them:\n` + changed.map((i) => `  ${i}: ${b[i].slice(0, 100)}`).join("\n"));
  }
  fs.writeFileSync(path.join(TR, "da.json"), JSON.stringify({ code: "da", body: da }, null, 1));
  console.log(`assets ${Buffer.byteLength(css)} + ${Buffer.byteLength(js)} bytes; Danish paste ${Buffer.byteLength(shared)} bytes`);
}

// ---- production ------------------------------------------------------------------------------------------------------
let cookie = "";
async function login() {
  let pw = process.env.AUTH_PASSWORD;
  for (const f of [".vercel.live.env", ".env.local"]) {
    if (pw) break;
    try { const m = fs.readFileSync(path.join(ROOT, f), "utf8").match(/^AUTH_PASSWORD=(.*)$/m); if (m) pw = m[1].replace(/^"|"$/g, "").trim(); } catch {}
  }
  if (!pw) throw new Error("AUTH_PASSWORD not set");
  const r = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
  if (!r.ok) throw new Error("login " + r.status);
  cookie = (r.headers.get("set-cookie") || "").split(";", 1)[0];
}
async function translateOne(code, source, sourceLabel, note) {
  const label = LANGS[code];
  const r = await fetch(BASE + "/api/openai/klaviyo-translate-template", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({
    sourceTemplateName: "W47 blog post: Den store forsendelsesguide (postal box Christmas looks)", sourceSubject: "", sourcePreviewText: "",
    sourceBody: source, sourceLanguage: sourceLabel, targetLanguage: label, translationPath: `${sourceLabel} -> ${label}`, operatorNote: note,
  }) });
  const j = await r.json().catch(() => ({}));
  if (!j.body) throw new Error(`${code}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
function namesNote(code) {
  const n = readJson(path.join(TR, "names.json"), {})[code];
  if (!n) return "";
  return " The six looks have fixed names in this language - use exactly these, in every fragment where a look is named (style buttons, headings, sentences, shopping-list links), never another wording: " +
    EN_NAMES.map((e, i) => `'${e}' = '${n[i].replace(/&amp;/g, "&")}'`).join("; ") + `. In headings keep the English word Look and the number before the name: 'Look 01: ${n[0].replace(/&amp;/g, "&")}'.`;
}
// Hand corrections after a translation, re-applied every time it is made: { lang: [[pattern, replacement, why]] }.
function applyFixes(code, body) {
  for (const [re, to] of readJson(path.join(TR, "fixes.json"), {})[code] || []) body = body.replace(new RegExp(re, "g"), to);
  return body;
}
async function translate(args) {
  await login();
  const da = tr("da");
  if (!da) throw new Error("run build first");
  const one = async (code, source, from) => {
    const t0 = Date.now();
    const j = await translateOne(code, source, from, NOTE + namesNote(code));
    const body = applyFixes(code, j.body);
    const a = skeleton(source), b = skeleton(body), at = a.findIndex((t, i) => t !== b[i]);
    if (a.length !== b.length || at > -1) throw new Error(`${code}: markup changed at tag ${at}: ${a[at]} -> ${b[at]}`);
    fs.writeFileSync(path.join(TR, code + ".json"), JSON.stringify({ code, from, model: j.model, at: new Date().toISOString(), danish: da.body.length, body }, null, 1));
    console.log("ok", code, j.model, Math.round((Date.now() - t0) / 1000) + "s");
  };
  if (args[0] === "en") return one("en", da.body, "Dansk (DK)");
  const en = tr("en");
  if (!en) throw new Error("translate en first");
  const todo = args[0] === "all" ? Object.keys(LANGS).filter((c) => c !== "en") : args;
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map((c) => one(c, en.body, LANGS.en).catch((e) => console.log("FAIL", c, e.message))));
  }
}
async function names() {
  await login();
  const note = "Six names of gift-wrapping styles ('looks') in a blog post about Christmas packaging: the colours or motif of each style, and the last one is the do-it-yourself style where the reader mixes parts from the others. Translate each as a short, natural style name in the target language (sentence case, at most three words; keep '&' where the language reads it naturally, otherwise use the word for 'and'). Do not leave any in English.";
  const out = readJson(path.join(TR, "names.json"), {});
  await Promise.all(Object.keys(LANGS).filter((c) => !/^en/.test(c)).map(async (code) => {
    const j = await translateOne(code, `<ol>${EN_NAMES.map((n) => `<li>${n.replace(/&/g, "&amp;")}</li>`).join("")}</ol>`, LANGS.en, note);
    const n = [...j.body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
    if (n.length !== 6) throw new Error(code + ": " + j.body);
    out[code] = n;
    console.log(code.padEnd(6), n.join(" / "));
  }));
  fs.writeFileSync(path.join(TR, "names.json"), JSON.stringify(out, null, 1));
  console.log("Read them, correct any slip by hand in sprog/tr/names.json, then translate all.");
}

// ---- links, on every store -------------------------------------------------------------------------------------------
async function links() {
  const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const H = { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }; // a bare Accept gets a 500 from the store
  const BOXES = { "Boston ECO": "30280040022", "Melbourne ECO": "30360060682", "Santorini ECO": "30290060352", "Seoul ECO": "30230061602", Vienna: "00320000102" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const paths = [...new Set([...splitSource().shared.matchAll(/(?:href|data-[rw]-h)="\/dkk_dk_den\/([^"#]+)"/g)].map((m) => m[1]))];
  const out = {};
  for (const [store] of STORES) {
    const res = { redirects: {}, broken: [], fees: {} };
    for (const p of paths) {
      if (/^sales\/order\/history\/$/.test(p)) continue; // needs a login; it answers with the login page, as it should
      let r;
      try { r = await fetch(`https://www.westpack.com/${store}/${p}`, { headers: H }); await r.text(); } catch (e) { r = { status: 0, url: "" }; }
      const final = r.url ? new URL(r.url).pathname : "";
      if (r.status !== 200) res.broken.push(`${r.status} ${p}`);
      else if (final !== `/${store}/${p}`) res.redirects[p] = final.replace(`/${store}/`, "");
      await sleep(250);
    }
    for (const [name, sku] of Object.entries(BOXES)) {
      try {
        const r = await fetch(`https://www.westpack.com/${store}/meilisearch/search/proxy/`, { method: "POST", headers: { ...H, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ q: sku, limit: 10 }) });
        const j = await r.json(); const hit = (j.hits || []).find((h) => String(h.sku) === sku);
        res.fees[name] = hit ? hit.print_fee : "not found";
      } catch (e) { res.fees[name] = "error"; }
      await sleep(250);
    }
    out[store] = res;
    console.log(store, "broken:", res.broken.join(", ") || "none", "| redirects:", Object.keys(res.redirects).length, "| print fees:", Object.values(res.fees).join(","));
  }
  fs.writeFileSync(path.join(TR, "links.json"), JSON.stringify(out, null, 1));
}

// ---- the paste files -------------------------------------------------------------------------------------------------
function assemble() {
  const da = tr("da");
  if (!da || da.body !== toCarrier(splitSource().shared)) throw new Error("the Danish changed since the translations were made: run build and translate first");
  const linkMap = readJson(path.join(TR, "links.json"), {});
  const visible = (h) => segs(h.replace(/<span translate="no" class="notranslate">[^<]*<\/span>/g, "")).map((s) => String(s).replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const enSegs = visible(fromCarrier(tr("en").body).body);
  const rows = [], problems = [];
  fs.mkdirSync(OUT, { recursive: true });
  for (const [store, code, lang, name] of STORES) {
    const t = tr(code);
    if (!t) { problems.push(`${store}: no ${code} translation`); continue; }
    if (code !== "da" && t.danish && t.danish !== da.body.length) problems.push(`${store}: ${code} was translated from older Danish`);
    const { body, fields } = fromCarrier(t.body);
    let html = body.replace('<div id="w47fs" class="w47fs" lang="da">', `<div id="w47fs" class="w47fs" lang="${lang}">`);
    // Store links point at this store, and at the store's own address where its category URL differs (it redirects).
    for (const [from, to] of Object.entries((linkMap[store] || {}).redirects || {})) html = html.split(`"/dkk_dk_den/${from}"`).join(`"/dkk_dk_den/${to}"`);
    html = html.replace(/\/dkk_dk_den\//g, `/${store}/`);
    const v = visible(html), issues = [];
    if (/[\u{10000}-\u{10FFFF}]/u.test(html)) issues.push("4-byte character (Magento refuses it)");
    if (/@@C\d+@@/.test(html)) issues.push("carrier token left");
    if (!/^(da|nb|sv)$/.test(code)) { const dk = v.filter((s) => /[æøå]/i.test(s)); if (dk.length) issues.push("Danish left: " + dk.slice(0, 3).join(" | ")); }
    if (!/^(da|en|en-US)$/.test(code)) {
      const same = v.filter((s, i) => s === enSegs[i] && /[a-z]{4,}/i.test(s) && !/^(Look 0\d.*|.*ECO.*|Vienna)$/.test(s));
      if (same.length > 2) issues.push(`${same.length} fragments still English: ` + same.slice(0, 4).join(" | "));
    }
    const broken = (linkMap[store] || {}).broken || [];
    if (broken.length) issues.push("broken links: " + broken.join(", "));
    const kb = Buffer.byteLength(html);
    if (kb > 62000) issues.push("over 62 KB");
    fs.writeFileSync(path.join(OUT, `${store}.html`), html);
    rows.push({ store, name, fields });
    console.log(`${store.padEnd(11)} ${code.padEnd(6)} ${(kb / 1000).toFixed(1)} KB  ${issues.join("; ") || "ok"}`);
    if (issues.length) problems.push(`${store}: ${issues.join("; ")}`);
  }
  const md = ["# Felter pr. store view - W47 Den store forsendelsesguide", "",
    "Sæt indholdet af hver fil ind i indlæggets HTML Code-element i det store view, og udfyld felterne herunder.",
    "URL-nøglen er den samme overalt: `the-complete-christmas-shipping-guide-2026` (lad \"Use Default Value\" stå på den).", ""];
  for (const r of rows) md.push(`## ${r.name} - \`${r.store}\``, "", `Indhold: [${r.store}.html](${r.store}.html)`, "",
    `- **Titel:** ${r.fields.title}`, `- **Kort beskrivelse:** ${r.fields.short}`, `- **Meta title:** ${r.fields.metaTitle}`, `- **Meta description:** ${r.fields.metaDesc}`, "");
  fs.writeFileSync(path.join(OUT, "felter.md"), md.join("\n"));
  if (problems.length) { console.log("\nPROBLEMS:\n" + problems.join("\n")); process.exitCode = 1; }
}

module.exports = { splitSource, toCarrier, fromCarrier, skeleton, STORES, LANGS };
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const run = { build, names, translate: () => translate(args), links, assemble }[cmd];
  if (!run) { console.log("usage: node sprog.js build | names | translate en|all|<codes> | links | assemble"); process.exit(1); }
  Promise.resolve(run()).catch((e) => { console.error(e.message); process.exit(1); });
}
