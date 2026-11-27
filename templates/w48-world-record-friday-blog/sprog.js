/**
 * The W48 World Record Friday results post in the language of every store view the Friday mail goes to: one paste file
 * per Magento store view (sprog/<store>.html) plus the All Store Views default (sprog/alle-store-views.html).
 *
 * The Danish master is world-record-friday-da.html (the live DK block, Kirsten's text). Unlike W47 the design and the
 * script stay inside each file: the block is 45 KB, so every language fits in the HTML Code element's 64 KB and the
 * post needs nothing from our server.
 *
 * Translation is the app's own Duplicate & translate engine (POST /api/openai/klaviyo-translate-template on production:
 * glossary, form of address per market, the claim rules), straight from Danish into each market as the W48 Pre Black
 * Friday mail was, with each store's own words for the WTP cases. Then an independent read on the strong model
 * (CONTENT_AGENT_MODEL, high) per language, whose fixes change text only.
 *
 *   node templates/w48-world-record-friday-blog/sprog.js prep              the Danish carrier (sprog/tr/da.json)
 *   node templates/w48-world-record-friday-blog/sprog.js translate all | UK DE ...
 *   node templates/w48-world-record-friday-blog/sprog.js proofread all | UK DE ...
 *   node templates/w48-world-record-friday-blog/sprog.js apply all | UK DE ...   proofread fixes -> tr/<C>.json
 *   node templates/w48-world-record-friday-blog/sprog.js links             every store link on every store
 *   node templates/w48-world-record-friday-blog/sprog.js assemble          sprog/<store>.html + sprog/felter.md, with checks
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const { extractHtmlSegments, rebuildHtml } = require(path.join(ROOT, "server", "lib", "klaviyo-template-variant"));
const SRC = path.join(__dirname, "world-record-friday-da.html");
const OUT = path.join(__dirname, "sprog");
const TR = path.join(OUT, "tr");
const BASE = "https://project-4fcxa.vercel.app";

// Market -> store view, the page's lang, the engine's language label, the proofreader's language, a Danish name.
const MARKETS = {
  DK: ["dkk_dk_den", "da", "Dansk (DK)", "Danish", "Danmark"],
  UK: ["gbp_uk_eng", "en-GB", "English (UK)", "British English", "UK"],
  EU: ["eur_eu_eng", "en", "English (EU)", "British English (for EU readers)", "EU (engelsk)"],
  US: ["usd_us_eng", "en-US", "English (US)", "American English", "USA"],
  DE: ["eur_eu_ger", "de", "Tysk (DE)", "German (Sie)", "Tyskland"],
  FR: ["eur_eu_fra", "fr", "Fransk (FR)", "French (vous)", "Frankrig"],
  IT: ["eur_eu_ita", "it", "Italiensk (IT)", "Italian (tu)", "Italien"],
  ES: ["eur_eu_spa", "es", "Spansk (ES)", "Spanish, Spain (tú)", "Spanien"],
  NL: ["eur_eu_ned", "nl", "Hollandsk (NL)", "Dutch (je)", "Holland"],
  PT: ["eur_eu_por", "pt", "Portugisisk (PT)", "European Portuguese (formal: o seu / você)", "Portugal"],
  SE: ["sek_se_swe", "sv", "Svensk (SE)", "Swedish (du)", "Sverige"],
  NO: ["nok_no_nor", "nb", "Norsk (NO)", "Norwegian Bokmål (du)", "Norge"],
  FI: ["eur_eu_fin", "fi", "Finsk (FI)", "Finnish (sinä)", "Finland"],
  PL: ["pln_pl_pol", "pl", "Polsk (PL)", "Polish (informal ty)", "Polen"],
  RO: ["eur_eu_rou", "ro", "Rumænsk (RO)", "Romanian (tu)", "Rumænien"],
};
const FOREIGN = Object.keys(MARKETS).filter((c) => c !== "DK");
const DOT_DECIMAL = new Set(["UK", "EU", "US"]);

// The store's own words for the WTP cases, read off each store for the Pre Black Friday rollout (23/11).
const TERMS = {
  UK: "\"jewellery cases\" and \"jewellery travel cases\" (product names \"WTP Hawaii Jewellery Travel Case\", \"WTP Tahiti Jewellery Case\"); British spelling",
  EU: "\"jewellery cases\" and \"jewellery travel cases\" (product names \"WTP Hawaii Jewellery Travel Case\", \"WTP Tahiti Jewellery Case\"); British spelling",
  US: "\"jewelry cases\" and \"jewelry travel cases\" (product names \"WTP Hawaii Jewelry Travel Case\", \"WTP Tahiti Jewelry Case\"); American spelling",
  FR: "\"écrins à bijoux\" and \"écrins de voyage pour bijoux\" (product names \"WTP Hawaii écrin de voyage pour bijoux\", \"WTP Tahiti écrin à bijoux\")",
  DE: "\"Schmucketuis\" and \"Schmuckreiseetuis\" (product names \"WTP Hawaii Schmuckreiseetui\", \"WTP Tahiti Schmucketui\")",
  PL: "\"etui na biżuterię\" and \"etui podróżne na biżuterię\" (product names \"WTP Hawaii etui podróżne na biżuterię\", \"WTP Tahiti etui na biżuterię\")",
  SE: "\"smyckeskrin\" and \"reseetuier för smycken\" (product names \"WTP Hawaii reseetui för smycken\", \"WTP Tahiti smyckeskrin\")",
  NO: "\"smykkeskrin\" and \"smykkeskrin til reise\" (product names \"WTP Hawaii smykkeskrin til reise\", \"WTP Tahiti smykkeskrin\")",
  NL: "\"sieradencases\" and \"sieraden reisetuis\" (product names \"WTP Hawaii sieraden reisetui\", \"WTP Tahiti sieradencase\")",
  IT: "\"portagioie\" and \"portagioie da viaggio\" (product names \"WTP Hawaii portagioie da viaggio\", \"WTP Tahiti portagioie\")",
  ES: "\"estuches para joyería\" and \"estuches de viaje para joyería\" (product names \"WTP Hawaii estuche de viaje para joyería\", \"WTP Tahiti estuche para joyería\")",
  FI: "\"korukotelot\" and \"matkakotelot koruille\" (product names \"WTP Hawaii matkakotelo koruille\", \"WTP Tahiti korukotelo\")",
  PT: "\"estojos para joias\" and \"estojos de viagem para joias\" (product names \"WTP Hawaii estojo de viagem para joias\", \"WTP Tahiti estojo para joias\")",
  RO: "\"etuiuri pentru bijuterii\" and \"etuiuri de călătorie pentru bijuterii\" (product names \"WTP Hawaii etui de călătorie pentru bijuterii\", \"WTP Tahiti etui pentru bijuterii\")",
};

// The post's own Magento fields, translated with it (they travel as hidden carrier paragraphs).
const FIELDS = {
  title: "World Record Friday 2026",
  short: "Traditionen tro holder vi ikke Black Friday. Fire kolleger gik efter hver sin rekord i stedet – her er alle fem videoer.",
  metaTitle: "World Record Friday 2026: Sådan gik det | Westpack",
  metaDesc: "Vi holder ikke Black Friday. I stedet gik fire kolleger efter verdensrekorder med smykkeæsker, M&M’s, elastik og tøjklemmer. Se alle fem videoer her.",
};

const STORY = [
  "This is a blog post on Westpack's web shop (one HTML block), not an email. Westpack is a Danish B2B supplier of packaging (jewellery boxes, jewellery cases, gift bags, postal boxes, logo print); the readers are jewellery brands, goldsmiths and shop owners, mostly existing customers.",
  "The post reveals the results of World Record Friday: Westpack does not do Black Friday, so four colleagues attempted silly world records instead, filmed in a meeting room, the canteen and the warehouse. Five videos (an intro and four attempts) with English subtitles. No official world record was broken.",
  "The attempts: Martin stacked jewellery BOXES (smykkeæsker) into one tower wearing disposable gloves - no official record exists, he made 12; Mia ate M&M's with chopsticks in one minute - 18, the world record is 65 (2011); Cecilia shot a rubber band down the warehouse aisle - 6.5 m, the longest of three shots, the record is 30.16 m (1999); Niklas put clothes pegs on his face - 52, the record is 161 (2013).",
  "The presenter (studieværten) is a woman: she/her.",
  "The offer: 20 % off the whole WTP series (World of Treasured Pieces) - jewellery cases, travel cases and stackable cases - Monday 23 to Sunday 29 November. No code; customers log in to see their prices.",
].join(" ");

const NOTE = (c) => [
  STORY,
  "- Keep in English exactly: the headline 'World Record' + 'Black' + 'Friday' (Black is struck through on purpose), 'World Record Friday', 'Black Friday', 'World of Treasured Pieces', 'WTP', 'WTP Stackables', Hawaii, Capri, Bali, Tahiti, M&M's, and every English quote from the videos in “…” (“There were questionable techniques, definitely.”, “None!”, “Pretty close”, “Sadly just a tiny bit off”, “Impressive … but not quite there.”, “We might need another Friday.”). The colleagues keep their names: Martin, Mia, Cecilia, Niklas.",
  "- Translate 'Westpack præsenterer' (Westpack presents). The nicknames are epithets - translate them idiomatically and short, no gendered titles beyond the person's own: 'Tårnherren' (master of the tower), 'Spisepindseksperten' (the chopstick expert), 'Den Lange Arm' (the long arm, as in 'the long arm of the law'), 'Klemmekongen' (the clothes-peg king).",
  "- Labels: 'Deltager 01' = Contestant 01; 'Resultat' = Result; 'Rekorden' = The record; 'Rekord: ingen' = Record: none; 'Fra optagelserne' = From the footage; 'Vores vurdering' = Our verdict; 'Se introen' = Watch the intro; 'Se Martins tårn' = Watch Martin's tower (each 'Se ...' is a button that plays a video; times like 0:46 stay).",
  "- Keep every number exactly and use this language's decimal separator (6,5 / 30,16 / 23,66 in Danish). 'ud af' = out of.",
  "- 'en disciplin, der ikke fandtes før i mandags' = a discipline that did not exist until last Monday. 'Tættest på en rigtig rekord og længst fra en behagelig fredag' = closest to a real record and furthest from a pleasant Friday. 'Black Friday var stadig ikke inviteret' = Black Friday still wasn't invited.",
  `- The offer: 'skrin' means jewellery CASES, never boxes. Use the store's own words for this market (they are on the pages the links open): ${TERMS[c]}. On the offer's flip clock 'Til' + 'søndag' = 'Until' + 'Sunday' (two short words). Weight classes are boxing terms: Fluevægt = flyweight, Letvægt = lightweight, Mellemvægt = middleweight, Sværvægt = heavyweight; weights and sizes stay as written. 'Log ind for at se dine priser med rabatten' = log in to see your prices with the discount. 'Tilbuddet på WTP-skrinene sluttede søndag 29. november, men du kan stadig se hele serien' is shown once the offer has ended.`,
  "- Keep every joke, deadpan and spoken. Headings, buttons and labels stay short. Never talk down to the reader. Use “…” for quotes, never «…».",
  "- The hidden fragments at the very end are the video titles read out by screen readers and the post's own Magento fields: title, short description, meta title (keep it ending '| Westpack'; the title 'World Record Friday 2026' stays in English) and meta description (about 150 characters). Translate them too.",
].join("\n");

const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const tr = (c) => readJson(path.join(TR, c + ".json"), null);
const segs = (html) => extractHtmlSegments(html).segments;

// ---- the Danish master, without its style and script ----------------------------------------------------------------
function splitSource() {
  const src = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const style = src.match(/<style>[\s\S]*?<\/style>/), script = src.match(/<script>[\s\S]*?<\/script>/);
  if (!style || !script || src.split("<style>").length !== 2 || src.split("<script>").length !== 2) throw new Error("expected one <style> and one <script>");
  const markup = src.replace(style[0], '<link rel="stylesheet" href="wrf26.css">').replace(script[0], '<script src="wrf26.js"></script>');
  return { src, style: style[0], script: script[0], markup };
}
// The video titles (data-title) and the Magento fields travel as hidden carrier paragraphs at the end, because the
// engine translates text and alt/title/aria-label but not data-* attributes.
function toCarrier(html) {
  const vals = [];
  const body = html.replace(/\sdata-title="([^"]*)"/g, (x, v) => { vals.push(v); return ` data-title="@@C${vals.length - 1}@@"`; });
  const carrier = `<div hidden data-carrier>${vals.map((v, i) => `<p data-c="${i}">${v}</p>`).join("")}${Object.entries(FIELDS).map(([k, v]) => `<p data-f="${k}">${v.replace(/&/g, "&amp;")}</p>`).join("")}</div>`;
  const at = body.lastIndexOf("</div>");
  return body.slice(0, at) + carrier + "\n" + body.slice(at);
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
const skeleton = (h) => (h.match(/<[^>]+>/g) || []).map((t) => t.replace(/\s(alt|aria-label|title)="[^"]*"/g, ""));

function prep() {
  const { markup } = splitSource();
  const da = toCarrier(markup);
  const round = fromCarrier(da);
  if (round.body !== markup) throw new Error("carrier does not round-trip");
  fs.mkdirSync(TR, { recursive: true });
  const old = tr("DK");
  if (old && old.body !== da) console.log("The Danish changed: translate again.");
  fs.writeFileSync(path.join(TR, "DK.json"), JSON.stringify({ code: "DK", body: da }, null, 1));
  console.log(`Danish markup ${Buffer.byteLength(markup)} bytes, ${segs(da).length} fragments`);
}

// ---- production ------------------------------------------------------------------------------------------------------
let cookie = "";
function env() {
  const e = {};
  for (const f of [".env.local", ".env.production", ".vercel.live.env"]) {
    try { for (const l of fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) e[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2"); } } catch {}
  }
  return Object.assign(e, process.env);
}
async function login() {
  const pw = env().AUTH_PASSWORD || require(path.join(ROOT, "server", "lib", "config")).getConfig().authPassword;
  const r = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
  if (!r.ok) throw new Error("login " + r.status);
  cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}
const pick = (args) => (args[0] === "all" || !args.length ? FOREIGN : args.map((a) => a.toUpperCase()));
async function pool(list, n, fn) {
  const q = [...list];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const c = q.shift(); await fn(c).catch((e) => console.log("FAIL", c, String(e.message).slice(0, 300))); } }));
}
async function translate(args) {
  await login();
  const da = tr("DK");
  if (!da) throw new Error("run prep first");
  await pool(pick(args), 5, async (c) => {
    const t0 = Date.now();
    const label = MARKETS[c][2];
    const r = await fetch(BASE + "/api/openai/klaviyo-translate-template", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({
      sourceTemplateName: "W48 blog post: World Record Friday - the results", sourceSubject: "", sourcePreviewText: "",
      sourceBody: da.body, sourceLanguage: "Dansk (DK)", sourceCountry: "DK", country: c, targetCountry: c,
      targetLanguage: label, translationPath: `Dansk (DK) -> ${label}`, operatorNote: NOTE(c),
    }) });
    const j = await r.json().catch(() => ({}));
    if (!j.body) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    const a = skeleton(da.body), b = skeleton(j.body), at = a.findIndex((t, i) => t !== b[i]);
    if (a.length !== b.length || at > -1) throw new Error(`markup changed at tag ${at}: ${a[at]} -> ${b[at]}`);
    fs.writeFileSync(path.join(TR, c + ".json"), JSON.stringify({ code: c, model: j.model, at: new Date().toISOString(), danish: da.body.length, body: j.body }, null, 1));
    fs.writeFileSync(path.join(TR, c + ".orig.json"), JSON.stringify({ code: c, model: j.model, body: j.body }, null, 1));
    console.log("ok", c, j.model, Math.round((Date.now() - t0) / 1000) + "s");
  });
}

// ---- an independent read per language --------------------------------------------------------------------------------
const BRIEF = (c) => `You are a native-speaker copy editor for ${MARKETS[c][3]}. ${STORY}

The post was translated from Danish; each fragment is shown with its Danish source. Report only what a native reader would trip over:
- grammar, spelling, agreement, word order, tense, punctuation that is wrong in this language
- a word or phrase that is wrong, unidiomatic or reads as machine-translated (including packaging terms a jewellery shop would not use: "skrin" means jewellery CASES, never boxes; Martin's "smykkeæsker" are jewellery BOXES)
- a joke that does not land or no longer makes sense in this language (keep the joke; fix the wording)
- a mix of forms of address, or a form other than the one given
- meaning that differs from the Danish source: above all the offer (20 %, the whole WTP series, until Sunday 29 November), the dates, the results, the record numbers and years, and the presenter being a woman
Keep exactly as written: World Record, Black, Friday, World Record Friday, Black Friday, World of Treasured Pieces, WTP, WTP Stackables, Hawaii, Capri, Bali, Tahiti, M&M's, the names, every number (with this language's decimal separator), times like 0:49, and the English video quotes in “…”. Quotation marks are “…”, never «…». Headings, buttons and labels should stay short. The last fragments are the video titles for screen readers and the post's title, short description, meta title (ends "| Westpack") and meta description (about 150 characters). Do not rewrite for taste, do not shorten or lengthen what is fine. Fewer findings is better than noise.

Store terms for this market: ${TERMS[c]}

Return JSON: {"issues":[{"id":"t12","current":"<the full current fragment, exactly>","suggested":"<the full corrected fragment>","severity":"error"|"improve","reason":"one short sentence in English"}]}
severity "error" = a native reader would see it as a mistake or it breaks a rule; "improve" = clearly better but not wrong.`;
// Text is paired with its Danish source through the markup, which a translation must leave as it was: the text between
// two tags, and the alt / aria-label / title of a tag. (The engine's own fragment list cannot be used for this: Finnish
// turns "18 ud af 65" into "18 / 65", which is no longer a fragment, and every later number shifts.)
const ATTRS = ["alt", "aria-label", "title"];
function units(html) {
  const parts = html.split(/(<[^>]+>)/), out = [];
  parts.forEach((p, i) => {
    if (i % 2 === 0) { if (/\p{L}/u.test(p)) out.push({ id: "t" + i, text: p.trim() }); return; }
    for (const k of ATTRS) { const m = p.match(new RegExp(`\\s${k}="([^"]*)"`)); if (m && /\p{L}/u.test(m[1])) out.push({ id: `a${i}.${k}`, text: m[1] }); }
  });
  return out;
}
// The proofreader reads the HTML text and answers in plain text: a bare & becomes &amp; again, M&M's keeps the page's
// curly apostrophe, and a number keeps its non-breaking space before %, m, g and mm.
function tidy(text) {
  return text.replace(/&(?!(amp|nbsp|quot|lt|gt|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/M&amp;M'/g, "M&amp;M’")
    .replace(/(\d)[  ](%|m|g|mm)(?=[\s.,;:!?)]|$)/g, "$1&nbsp;$2").replace(/ /g, "&nbsp;");
}
function setUnit(html, id, current, next) {
  next = tidy(next);
  const parts = html.split(/(<[^>]+>)/);
  const m = id.match(/^([ta])(\d+)(?:\.([\w-]+))?$/);
  if (!m) return null;
  const i = Number(m[2]);
  // The proofreader may echo the text with &amp; / &nbsp; decoded.
  const same = (a, b) => { const n = (s) => String(s).replace(/&amp;/g, "&").replace(/&nbsp;| /g, " ").replace(/&quot;/g, '"').trim(); return n(a) === n(b); };
  if (m[1] === "t") {
    if (parts[i] === undefined || !same(parts[i], current)) return null;
    parts[i] = parts[i].replace(parts[i].trim(), () => next.trim());
  } else {
    const re = new RegExp(`(\\s${m[3]}=")([^"]*)(")`);
    const v = (parts[i] || "").match(re);
    if (!v || !same(v[2], current)) return null;
    parts[i] = parts[i].replace(re, (x, p1, p2, p3) => p1 + next.replace(/"/g, "&quot;") + p3);
  }
  return parts.join("");
}
async function proofread(args) {
  const e = env();
  const src = new Map(units(tr("DK").body).map((u) => [u.id, u.text]));
  await pool(pick(args), 7, async (c) => {
    const t0 = Date.now();
    const pairs = units(readJson(path.join(TR, c + ".orig.json")).body).map((u) => ({ id: u.id, da: src.get(u.id) || "", text: u.text }));
    const model = e.CONTENT_AGENT_MODEL || "gpt-5.6";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${e.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: `${BRIEF(c)}\n\nFragments:\n${JSON.stringify(pairs)}` }], response_format: { type: "json_object" }, reasoning_effort: "high" }),
    });
    const out = await r.json();
    if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(out.error || out).slice(0, 300)}`);
    if (!/^gpt-5/.test(out.model || "")) throw new Error(`answered by ${out.model}`);
    const issues = (JSON.parse(out.choices[0].message.content).issues || []).filter((i) => typeof i.id === "string" && typeof i.suggested === "string");
    fs.writeFileSync(path.join(TR, c + ".proof.json"), JSON.stringify({ model: out.model, issues }, null, 1));
    const errors = issues.filter((i) => i.severity === "error").length;
    console.log(`${c} ${Math.round((Date.now() - t0) / 1000)}s ${out.model}: ${errors} error(s), ${issues.length - errors} improve`);
  });
}
// Fixes change text only (checked against the markup skeleton). tr/rejected.json lists "<C>:<id>" fixes not taken;
// tr/fixes.json holds hand corrections applied after the proofread: { "<C>": [[pattern, replacement, why]] }.
function apply(args) {
  const rejected = new Set(readJson(path.join(TR, "rejected.json"), []));
  const hand = readJson(path.join(TR, "fixes.json"), {});
  for (const c of pick(args)) {
    const orig = readJson(path.join(TR, c + ".orig.json"), null), proof = readJson(path.join(TR, c + ".proof.json"), { issues: [] });
    if (!orig) { console.log(c, "no translation"); continue; }
    let body = orig.body, n = 0;
    const skipped = [];
    for (const i of proof.issues) {
      if (rejected.has(`${c}:${i.id}`)) continue;
      const next = setUnit(body, i.id, String(i.current), String(i.suggested));
      if (next === null) { skipped.push(i.id); continue; }
      body = next; n++;
    }
    for (const [re, to] of hand[c] || []) body = body.replace(new RegExp(re, "g"), to);
    if (skeleton(orig.body).join("\n") !== skeleton(body).join("\n")) throw new Error(c + ": a fix changed the markup");
    const t = tr(c);
    fs.writeFileSync(path.join(TR, c + ".json"), JSON.stringify({ ...t, body, proofread: { model: proof.model, applied: n, skipped } }, null, 1));
    console.log(c, `${n} fixes applied`, skipped.length ? `(skipped, text did not match: ${skipped.join(",")})` : "");
  }
}

// ---- links, on every store -------------------------------------------------------------------------------------------
async function links() {
  const H = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
  const paths = [...new Set([...splitSource().markup.matchAll(/href="\/dkk_dk_den\/([^"#]+)"/g)].map((m) => m[1]))];
  const out = {};
  for (const [store] of Object.values(MARKETS)) {
    const res = { redirects: {}, broken: [] };
    for (const p of paths) {
      if (/^customer\/account\/login\/$/.test(p)) continue;
      let r;
      try { r = await fetch(`https://www.westpack.com/${store}/${p}`, { headers: H }); await r.text(); } catch (e) { r = { status: 0, url: "" }; }
      const final = r.url ? new URL(r.url).pathname : "";
      if (r.status !== 200) res.broken.push(`${r.status} ${p}`);
      else if (final !== `/${store}/${p}`) res.redirects[p] = final.replace(`/${store}/`, "");
      await new Promise((ok) => setTimeout(ok, 250));
    }
    out[store] = res;
    console.log(store, "broken:", res.broken.join(", ") || "none", "| redirects:", JSON.stringify(res.redirects));
  }
  fs.writeFileSync(path.join(TR, "links.json"), JSON.stringify(out, null, 1));
}

// ---- the paste files -------------------------------------------------------------------------------------------------
function finish(c, markup) {
  const { style, script } = splitSource();
  const [store, lang] = MARKETS[c];
  // A bare & (the translator writes M&M) becomes &amp;, and M&M's keeps the page's curly apostrophe.
  markup = markup.replace(/&(?!(amp|nbsp|quot|lt|gt|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/M&amp;M'/g, "M&amp;M’");
  let html = markup.replace('<div id="wrf26" class="wrf26" lang="da"', `<div id="wrf26" class="wrf26" lang="${lang}"`)
    .replace('<link rel="stylesheet" href="wrf26.css">', () => style);
  let js = script;
  if (DOT_DECIMAL.has(c)) {
    // The count-up writes a decimal comma; English reads 6.5. The static figures outside the text fragments too.
    if (!js.includes('v.toFixed(1).replace(".",",")')) throw new Error("count-up decimal code moved");
    js = js.replace('v.toFixed(1).replace(".",",")', "v.toFixed(1)");
    html = html.replace(/>(\d+),(\d+)</g, ">$1.$2<");
  }
  html = html.replace('<script src="wrf26.js"></script>', () => js);
  return html;
}
function assemble() {
  const da = tr("DK");
  if (!da || da.body !== toCarrier(splitSource().markup)) throw new Error("the Danish changed since the translations were made: run prep and translate first");
  const linkMap = readJson(path.join(TR, "links.json"), {});
  const visible = (h) => segs(h.replace(/<span translate="no" class="notranslate">[^<]*<\/span>/g, "")).map((s) => String(s).replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const daSegs = visible(fromCarrier(da.body).body);
  const KEEP = /^(Martin|Mia|Cecilia|Niklas|World Record|Black|Friday|m|WTP.*|“.*”|Westpack)$/;
  const rows = [], problems = [];
  for (const c of Object.keys(MARKETS)) {
    const [store, , , , name] = MARKETS[c];
    const t = tr(c);
    if (!t) { problems.push(`${store}: no ${c} translation`); continue; }
    if (c !== "DK" && t.danish !== da.body.length) problems.push(`${store}: ${c} was translated from older Danish`);
    const { body, fields } = fromCarrier(t.body);
    let html = finish(c, body);
    for (const [from, to] of Object.entries((linkMap[store] || {}).redirects || {})) html = html.split(`"/dkk_dk_den/${from}"`).join(`"/dkk_dk_den/${to}"`);
    html = html.replace(/"\/dkk_dk_den\//g, `"/${store}/`);
    const v = visible(body), issues = [];
    if (/[\u{10000}-\u{10FFFF}]/u.test(html)) issues.push("4-byte character (Magento refuses it)");
    if (/@@C\d+@@|data-carrier/.test(html)) issues.push("carrier left");
    if (!/^(DK|NO|SE)$/.test(c)) { const dk = v.filter((s) => /[æøå]/i.test(s)); if (dk.length) issues.push("Danish left: " + dk.slice(0, 3).join(" | ")); }
    if (c !== "DK") {
      // tr/same-ok.json: fragments read and found right in that language although they read as the Danish
      // (Norwegian "Se introen", German "Rekord: 65").
      const ok = new Set(readJson(path.join(TR, "same-ok.json"), {})[c] || []);
      const same = v.filter((s, i) => s === daSegs[i] && /\p{L}{4,}/u.test(s) && !KEEP.test(s) && !ok.has(s));
      if (same.length) issues.push(`${same.length} fragment(s) still Danish: ` + same.slice(0, 4).join(" | "));
      if (/,\d/.test(html.match(/>\d+[.,]\d+</g)?.join("") || "") && DOT_DECIMAL.has(c)) issues.push("decimal comma in English");
    }
    // Every number of the Danish text must be in the translation, as many times (decimal separator aside).
    const all = (h) => h.split(/(<[^>]+>)/).map((p, i) => (i % 2 === 0 ? p : ATTRS.map((k) => (p.match(new RegExp(`\\s${k}="([^"]*)"`)) || [])[1] || "").join(" ")));
    const nums = (h) => (all(h).join(" ").replace(/(\d)[.,](\d)/g, "$1.$2").match(/\d+(\.\d+)?/g) || []).sort().join(" ");
    if (c !== "DK" && nums(t.body) !== nums(da.body)) {
      const a = nums(da.body).split(" "), b = nums(t.body).split(" ");
      const miss = a.filter((x) => { const k = b.indexOf(x); if (k < 0) return true; b.splice(k, 1); return false; });
      issues.push(`numbers differ: missing [${miss.join(" ")}] extra [${b.join(" ")}]`);
    }
    const broken = (linkMap[store] || {}).broken || [];
    if (c !== "DK" && !linkMap[store]) issues.push("links not checked");
    if (broken.length) issues.push("broken links: " + broken.join(", "));
    const kb = Buffer.byteLength(html);
    if (kb > 62000) issues.push("over 62 KB");
    fs.writeFileSync(path.join(OUT, `${store}.html`), html);
    rows.push({ store, name, fields });
    console.log(`${store.padEnd(11)} ${c} ${(kb / 1000).toFixed(1)} KB  ${issues.join("; ") || "ok"}`);
    if (issues.length) problems.push(`${store}: ${issues.join("; ")}`);
  }
  // All Store Views: the UK text with Magento's {{store}} before every store link, so a store view without its own
  // file (CZ, SK, HU, GR, BG, EE, HR, LV, LT) sends its readers into its own shop. Same as W47.
  const uk = tr("UK");
  if (uk) {
    const { body, fields } = fromCarrier(uk.body);
    // Only the markup: the script's own "/dkk_dk_den/" (the link re-pointing) must stay as it is.
    const full = finish("UK", body).replace('lang="en-GB"', 'lang="en"');
    const at = full.indexOf("<script>");
    const markup = full.slice(0, at).replace(/"\/dkk_dk_den\//g, '"{{store}}'), script = full.slice(at);
    if (/dkk_dk_den/.test(markup)) throw new Error("standard: a store link still names dkk_dk_den");
    if (/\{\{store\}\}/.test(script) || !script.includes('.replace("/dkk_dk_den/","/"+st+"/")')) throw new Error("standard: the script's link re-pointing changed");
    const html = markup + script;
    fs.writeFileSync(path.join(OUT, "alle-store-views.html"), html);
    rows.unshift({ store: "alle-store-views", name: "Alle store views (standard)", fields });
    console.log(`alle-store-views UK ${(Buffer.byteLength(html) / 1000).toFixed(1)} KB  ${(html.match(/"\{\{store\}\}/g) || []).length} store links as {{store}}`);
  }
  const md = ["# Felter pr. store view - W48 World Record Friday", "",
    "Sæt indholdet af hver fil ind i indlæggets HTML Code-element i det store view, og udfyld felterne herunder.",
    "URL-nøglen er den samme overalt: `world-record-friday-2026` (lad \"Use Default Value\" stå på den).", ""];
  for (const r of rows) md.push(`## ${r.name} - \`${r.store}\``, "", `Indhold: [${r.store}.html](${r.store}.html)`, "",
    `- **Titel:** ${r.fields.title}`, `- **Kort beskrivelse:** ${r.fields.short}`, `- **Meta title:** ${r.fields.metaTitle}`, `- **Meta description:** ${r.fields.metaDesc}`, "");
  fs.writeFileSync(path.join(OUT, "felter.md"), md.join("\n"));
  if (problems.length) { console.log("\nPROBLEMS:\n" + problems.join("\n")); process.exitCode = 1; }
}

module.exports = { splitSource, toCarrier, fromCarrier, skeleton, MARKETS };
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const run = { prep, translate: () => translate(args), proofread: () => proofread(args), apply: () => apply(args), links, assemble }[cmd];
  if (!run) { console.log("usage: node sprog.js prep | translate all|<C..> | proofread all|<C..> | apply all|<C..> | links | assemble"); process.exit(1); }
  Promise.resolve(run()).catch((e) => { console.error(e.message); process.exit(1); });
}
