/**
 * One-off copy change, 2026-11-27: the new experience Direct gets its block in every transcreated language.
 *
 * Only the "direct" block is written. tools/signup/transcreate.js regenerates whole files and would undo the
 * proofread fixes and the hand-written Logo studio strings, so this asks the model for the one block, with both
 * masters, the language's own shell (so "newsletter" and the form of address match the button beside it) and the
 * standing copy rules, checks keys, placeholders and the claims, and writes it into the file. Each file's meta says
 * so (directUpdate); none of it has had a native read.
 *
 * Usage: node tools/signup/copy-direct-2026-11-27.js [lang,lang,...]   (rewrites signup/core/copy/<lang>.js)
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
- seasons.sale.title: the headline from 15 December to 3 January, when the New Year sale is days away; it starts in
  January and we tell them when. seasons.sale.dock: the pill's line in that period.
- proof: a true count. Over 20,000 people in Europe and the US already get the newsletter. Keep "over 20,000" exactly
  (written with the language's thousands separator), and Europe and the US. Do not turn people into "companies" or
  "brands".
- successTitle: after the signup went through. askTitle and askLede: one optional question about what they sell, so we
  send what fits. types: the answers, short (one to four words) - jewellery, watches, fashion and accessories, beauty and
  cosmetics, gifts and interiors, something else. skip: skip the question. thanks: after an answer.
- dockOpen: the pill's accessible label, saying it opens the newsletter signup. dockHide: the label of the pill's cross.
The New Year sale is a real yearly sale at Westpack; call it what a shop in this language would call a sale held at the
turn of the year ("Neujahrs-Sale", "soldes du Nouvel An" and the like). Never promise a discount, a percentage or a date.
Use the same word for newsletter as the language's own shell below, and the same form of address.`;

function directOf(lang) { return loadLang(lang).direct; }

async function transcreateBlock(lang, target, env) {
  const model = env.CONTENT_AGENT_MODEL || "";
  // the other blocks were transcreated on the strong model; a quiet fall back to the default one is refused
  if (!/^(gpt-5|o\d)/.test(model)) throw new Error(`set CONTENT_AGENT_MODEL to the strong model (gpt-5.6); got "${model}"`);
  const da = directOf("da"), en = directOf("en");
  const own = loadLang(lang);
  const prompt = `${RULES}

${BRIEF}

Target: ${target.name}. Form of address: ${target.address}.
${target.notes ? `Also: ${target.notes}` : ""}

The language's own shell, already on the store (for the newsletter word, the button and the form of address):
${JSON.stringify(own.shell)}

The Danish master (for tone):
${JSON.stringify(da)}

The English master (structure to return, every key filled in ${target.name}):
${JSON.stringify(en)}

Return only the JSON object for this one block, with the same keys as the English master.`;
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
    const problems = [];
    if (shapeOf(out) !== shapeOf(en)) problems.push("keys differ");
    if (placeholders(out) !== placeholders(en)) problems.push("placeholders differ");
    const text = JSON.stringify(out);
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
  const want = (process.argv[2] || Object.keys(TARGETS).join(",")).split(",");
  await Promise.all(want.map(async (lang) => {
    const { block, model } = await transcreateBlock(lang, TARGETS[lang], env);
    const file = path.join(COPY, `${lang}.js`);
    const src = fs.readFileSync(file, "utf8");
    const crlf = src.includes("\r\n");
    const s = src.replace(/\r\n/g, "\n");
    const obj = loadLang(lang);
    if (obj.meta.status === "master") throw new Error(`${lang} is a master; write its block by hand`);
    obj.direct = block;
    obj.meta.directUpdate = `2026-11-27: the Direct block was transcreated alone by tools/signup/copy-direct-2026-11-27.js (${model}); no native read`;
    const out = s.slice(0, s.indexOf("= {") + 2) + JSON.stringify(obj, null, 2) + ";\n";
    fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out);
    console.log(`${lang}: written (${model})`);
  }));
})().catch((e) => { console.error(e.message); process.exit(1); });
