/**
 * A second, independent read of the transcreated Signup Lab copy: the strong model reads each language as a native
 * copy editor would and reports what a native reader would trip over - grammar, spelling, a wrong or unidiomatic
 * word, a joke that does not land, the wrong form of address, a product or foil term that is not the store's own -
 * each with the smallest fix. It reports; it does not decide. With --apply it writes the fixes marked "error" whose
 * text still matches, and records the read in the file's meta.
 *
 * This is not a native review. It catches what a careful model catches; the files stay needsNativeReview.
 *
 * Usage: node tools/signup/proofread.js [lang,lang,...] [--apply]
 *   findings: tmp/signup-proofread/<lang>.json
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "..");
const COPY = path.join(ROOT, "signup", "core", "copy");
const OUT = path.join(ROOT, "tmp", "signup-proofread");

const LANGS = { "en-US": "American English (you)", de: "German (Sie)", fr: "French (vous)", it: "Italian (tu)", es: "Spanish, Spain (tú)", nl: "Dutch (je)", pt: "European Portuguese (formal third person: o seu, pode)", sv: "Swedish (du)", nb: "Norwegian Bokmål (du)", fi: "Finnish (sinä)", pl: "Polish (Ty, informal)", ro: "Romanian (tu)", cs: "Czech (vy, formal)", sk: "Slovak (vy, formal)", hu: "Hungarian (te, informal)" };

const BRIEF = `You are a native-speaker copy editor for Westpack, a Danish B2B supplier of packaging for jewellery businesses
(jewellery boxes, gift boxes, pouches, bags, displays, logo printing with hot foil). The text below is a newsletter
signup experience on Westpack's web store in your language, transcreated from a Danish and an English master. The
readers are jewellery brands, designers, goldsmiths and shop owners.

Report only what a native reader would trip over:
- grammar, spelling, agreement, punctuation that is wrong in this language
- a word that is wrong, unidiomatic or sounds machine-translated
- a joke or line that does not make sense or does not land in this language
- the wrong form of address (the store uses the one given below), or a mix of forms
- a foil or product term that is not what a packaging printer in this country would say
- anything that breaks the rules: no environmental claims; no promised or implied delivery time; never talk down to
  the reader; product facts exactly as in the master; product names (Torino, Seoul, Madrid, Oslo, Tokyo, Monaco,
  Seville, London, Frankfurt) stay as they are; every {placeholder} stays exactly as written
Do not rewrite for taste, do not shorten or lengthen what is fine, do not change the tone. Buttons must stay under
about 28 characters. Fewer findings is better than noise: if a string is fine, leave it out.

Return JSON: {"issues":[{"path":"logo-studio.title","current":"...","suggested":"...","severity":"error"|"improve","reason":"one short sentence in English"}]}
"path" is the dot path to the string (array items by index, e.g. shell.promise.1). "current" is the full current string,
"suggested" the full corrected string. severity "error" is something a native reader would see as a mistake;
"improve" is clearly better wording but not wrong.`;

function loadLang(lang) {
  const sandbox = {}; sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(COPY, `${lang}.js`), "utf8"), sandbox);
  return sandbox.WestpackSignupCopy[lang];
}
function readEnv() {
  const env = {};
  for (const f of [".env.local", ".env.production", ".vercel.live.env"]) {
    try { for (const l of fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2"); } } catch (e) { /* missing */ }
  }
  return Object.assign(env, process.env);
}
const getAt = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[/^\d+$/.test(k) ? Number(k) : k]), o);
function setAt(o, p, v) { const ks = p.split("."); const last = ks.pop(); const parent = getAt(o, ks.join(".")); if (parent && typeof parent[/^\d+$/.test(last) ? Number(last) : last] === "string") { parent[/^\d+$/.test(last) ? Number(last) : last] = v; return true; } return false; }

async function read(lang, env, en, da) {
  const model = env.CONTENT_AGENT_MODEL || "gpt-5.6";
  const copy = loadLang(lang);
  const body = { shell: copy.shell, "logo-studio": copy["logo-studio"], "swipe-match": copy["swipe-match"], "pack-and-ship": copy["pack-and-ship"] };
  const prompt = `${BRIEF}

Language: ${LANGS[lang]}.

English master, for meaning:
${JSON.stringify({ shell: en.shell, "logo-studio": en["logo-studio"], "swipe-match": en["swipe-match"], "pack-and-ship": en["pack-and-ship"] })}

Danish master, for tone:
${JSON.stringify({ shell: da.shell, "logo-studio": da["logo-studio"], "swipe-match": da["swipe-match"], "pack-and-ship": da["pack-and-ship"] })}

The ${LANGS[lang]} text to check:
${JSON.stringify(body)}`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, reasoning_effort: "high" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${lang}: ${r.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  if (!/^gpt-5/.test(j.model || "")) throw new Error(`${lang}: answered by ${j.model}, not the strong model`);
  const issues = (JSON.parse(j.choices[0].message.content).issues || []).filter((i) => i && i.path && typeof i.suggested === "string");
  return { model: j.model, issues };
}

(async () => {
  const env = readEnv();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const apply = process.argv.includes("--apply");
  const want = (process.argv.slice(2).find((a) => !a.startsWith("--")) || Object.keys(LANGS).join(",")).split(",");
  fs.mkdirSync(OUT, { recursive: true });
  const da = loadLang("da"), en = loadLang("en");
  await Promise.all(want.map(async (lang) => {
    const file = path.join(OUT, `${lang}.json`);
    let result;
    if (apply && fs.existsSync(file)) result = JSON.parse(fs.readFileSync(file, "utf8"));
    else { result = await read(lang, env, en, da); fs.writeFileSync(file, JSON.stringify(result, null, 2)); }
    const errors = result.issues.filter((i) => i.severity === "error");
    console.log(`${lang}: ${errors.length} error(s), ${result.issues.length - errors.length} improvement(s)`);
    if (!apply) return;
    const src = path.join(COPY, `${lang}.js`), text = fs.readFileSync(src, "utf8");
    const head = text.slice(0, text.indexOf("(globalThis.WestpackSignupCopy"));
    const copy = loadLang(lang);
    let n = 0;
    for (const i of errors) {
      if (getAt(copy, i.path) !== i.current) { console.log(`  skipped ${i.path}: the text has changed since the read`); continue; }
      const before = (i.current.match(/\{[a-z]+\}/g) || []).sort().join(""), after = (i.suggested.match(/\{[a-z]+\}/g) || []).sort().join("");
      if (before !== after) { console.log(`  skipped ${i.path}: the fix changes a placeholder`); continue; }
      if (setAt(copy, i.path, i.suggested)) n++;
    }
    copy.meta = Object.assign({}, copy.meta, { proofread: `${new Date().toISOString().slice(0, 10)} ${result.model}, ${n} fix(es)` });
    fs.writeFileSync(src, `${head}(globalThis.WestpackSignupCopy = globalThis.WestpackSignupCopy || {})[${JSON.stringify(lang)}] = ${JSON.stringify(copy, null, 2)};\n`);
    console.log(`  ${lang}: ${n} fix(es) written`);
  }));
})().catch((e) => { console.error(e.message); process.exit(1); });
