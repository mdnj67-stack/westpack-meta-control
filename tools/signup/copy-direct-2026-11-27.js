/**
 * One-off copy change, 2026-11-27: the new experience Direct gets its block in every transcreated language.
 *
 * Only the "direct" block is written. tools/signup/transcreate.js regenerates whole files and would undo the
 * proofread fixes and the hand-written Logo studio strings, so this asks the model for the one block, with both
 * masters, the language's own shell (so "newsletter" and the form of address match the button beside it) and the
 * standing copy rules, checks keys, placeholders and the claims, and writes it into the file. Each file's meta says
 * so (directUpdate); none of it has had a native read.
 *
 * Usage: node tools/signup/copy-direct-2026-11-27.js [lang,lang,...] [--part=seasons.sale]
 *   (rewrites signup/core/copy/<lang>.js; --part transcreates one part of the block and leaves the rest as it is - used
 *   on 2026-11-27 when the New Year sale got its own version: headline, inbox mail and the line after the signup)
 */
const fs = require("fs");
const path = require("path");
const { TARGETS, RULES, loadLang, readEnv, shapeOf, placeholders } = require("./transcreate");
const COPY = path.join(__dirname, "..", "..", "signup", "core", "copy");

const BRIEF = `This block is "Direct", a newsletter signup popup whose first frame is the reason, the email field and the signup
button - nothing before the email. What each key is:
- seasons.default.title: the headline most of the year. Three concrete things the newsletter brings (new boxes,
  deadlines, the New Year sale) and a human promise that we tell them in good time. seasons.default.dock: a short line
  (under ~32 characters) on a small pill that stays at the foot of the page after the popup is closed.
- seasons.sale: the New Year sale's own version, shown from 10 December to 3 January. title: "Get told when the New
  Year sale starts - straight to your inbox" (the user's own words in Danish). dock: the pill's line in that period.
  done: the line after the signup. mailFrom, mailSubject, mailPreview, mailTime: a mock inbox row showing the mail they
  will get - sender (keep "Westpack"), subject "The New Year sale has started", the preview (discontinued products are
  reduced, while stocks last - say exactly that, no more) and the month it arrives (just the month name, no day).
- proof: a true count. Over 20,000 people in Europe and the US already get the newsletter. Keep "over 20,000" exactly
  (written with the language's thousands separator), and Europe and the US. Do not turn people into "companies" or
  "brands".
- successTitle: after the signup went through. askTitle and askLede: one optional question about what they sell, so we
  send what fits. types: the answers, short (one to four words) - jewellery, watches, fashion and accessories, beauty and
  cosmetics, gifts and interiors, something else. skip: skip the question. thanks: after an answer.
- dockOpen: the pill's accessible label, saying it opens the newsletter signup. dockHide: the label of the pill's cross.
The New Year sale is a real yearly sale at Westpack; call it what a shop in this language would call a sale held at the
turn of the year ("Neujahrs-Sale", "soldes du Nouvel An" and the like). Never promise a discount, a percentage or a date. NEVER say or imply that the sale or the news is exclusive, early,
first, ahead of others or only for subscribers (no "exclusive", "first", "before anyone", "early access", "VIP",
"advance notice"): the sale is on the store for everyone, the email only tells them when it starts.
Use the same word for newsletter as the language's own shell below, and the same form of address.`;

function directOf(lang) { return loadLang(lang).direct; }
const PART = (process.argv.find((a) => a.startsWith("--part=")) || "").slice(7);
const getPart = (o, p) => (p ? p.split(".").reduce((x, k) => (x == null ? x : x[k]), o) : o);
function withPart(block, p, value) {
  if (!p) return value;
  const out = JSON.parse(JSON.stringify(block)); const ks = p.split("."); const last = ks.pop();
  ks.reduce((x, k) => x[k], out)[last] = value; return out;
}
// what may never be said: the sale is public, the email only tells them when (the user, 2026-11-27), in every language
const EXCLUSIVE = /e(x|ks|s)[ck]lu[sz][iíy]|\bvip\b|early access|before anyone|\bfirst\b|først|först|vorab|avant-premi|en premier|in anteprima|per primi|in anticipo|antes que nadie|als eerste|jako pierwsi|elsőként|ensimmäis|primeir|primii|prv[ií]|ennakk|z wyprzedzeniem/i;

async function transcreateBlock(lang, target, env) {
  const model = env.CONTENT_AGENT_MODEL || "";
  // the other blocks were transcreated on the strong model; a quiet fall back to the default one is refused
  if (!/^(gpt-5|o\d)/.test(model)) throw new Error(`set CONTENT_AGENT_MODEL to the strong model (gpt-5.6); got "${model}"`);
  const da = directOf("da"), en = directOf("en");
  const own = loadLang(lang);
  const enPart = getPart(en, PART);
  const prompt = `${RULES}

${BRIEF}

Target: ${target.name}. Form of address: ${target.address}.
${target.notes ? `Also: ${target.notes}` : ""}

The language's own shell, already on the store (for the newsletter word, the button and the form of address):
${JSON.stringify(own.shell)}

The Danish master (for tone):
${JSON.stringify(da)}

${PART ? `The language's current block, for the words it already uses:
${JSON.stringify(own.direct || {})}

Transcreate only the part "${PART}". ` : ""}The English master (structure to return, every key filled in ${target.name}):
${JSON.stringify(enPart)}

Return only the JSON object for ${PART ? `the part "${PART}"` : "this one block"}, with the same keys as the English master.`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, ...(/^gpt-5|^o\d/.test(model) ? { reasoning_effort: "medium" } : { temperature: 0.4 }) }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`${lang}: ${r.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
    let out;
    try { out = JSON.parse(j.choices[0].message.content); } catch (e) { console.log(`${lang}: attempt ${attempt} returned no JSON`); continue; }
    if (out && out.direct && !out.seasons) out = out.direct;
    if (PART && out && shapeOf(out) !== shapeOf(enPart)) { const inner = getPart(out, PART) || getPart(out, PART.split(".").pop()); if (inner) out = inner; }
    const problems = [];
    if (shapeOf(out) !== shapeOf(enPart)) { problems.push("keys differ"); console.log(`${lang}: attempt ${attempt} rejected (keys differ)`); continue; }
    const part = out;
    out = withPart(own.direct || en, PART, part);
    if (placeholders(out) !== placeholders(en)) problems.push("placeholders differ");
    const text = JSON.stringify(out);
    if (EXCLUSIVE.test(JSON.stringify(part))) problems.push("exclusive / first / early wording");
    if (/\b(eco|sustainab|recycl|fsc)\b/i.test(text)) problems.push("environmental wording");
    if (!/20[ .,  ']?000/.test(out.proof || "")) problems.push("the count is not 20,000");
    if (/%|\d+\s*(januar|january|janvier|gennaio|enero|januari|janeiro|tammikuu|stycz|ianuarie|ledna|janu)/i.test(text)) problems.push("a discount or a date");
    if ((out.seasons?.default?.dock || "").length > 40 || (out.seasons?.sale?.dock || "").length > 44) problems.push("dock line too long");
    if (!problems.length) return { block: out, model: j.model || model };
    console.log(`${lang}: attempt ${attempt} rejected (${problems.join(", ")})`);
  }
  throw new Error(`${lang}: no valid block after 3 attempts`);
}

(async () => {
  const env = readEnv();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const want = (process.argv.slice(2).find((a) => !a.startsWith("--")) || Object.keys(TARGETS).join(",")).split(",");
  await Promise.all(want.map(async (lang) => {
    const { block, model } = await transcreateBlock(lang, TARGETS[lang], env);
    const file = path.join(COPY, `${lang}.js`);
    const src = fs.readFileSync(file, "utf8");
    const crlf = src.includes("\r\n");
    const s = src.replace(/\r\n/g, "\n");
    const obj = loadLang(lang);
    if (obj.meta.status === "master") throw new Error(`${lang} is a master; write its block by hand`);
    obj.direct = block;
    if (PART) obj.meta.directSaleUpdate = `2026-11-27: direct.${PART} transcreated alone by tools/signup/copy-direct-2026-11-27.js (${model}); no native read`;
    else obj.meta.directUpdate = `2026-11-27: the Direct block was transcreated alone by tools/signup/copy-direct-2026-11-27.js (${model}); no native read`;
    const out = s.slice(0, s.indexOf("= {") + 2) + JSON.stringify(obj, null, 2) + ";\n";
    fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out);
    console.log(`${lang}: written (${model})`);
  }));
})().catch((e) => { console.error(e.message); process.exit(1); });
