/**
 * Transcreates the Signup Lab copy from the two master languages (da, en) into every other store language.
 *
 * Transcreation, not translation: the humour has to land in the language, so the model gets both masters, each
 * store's own word for a jewellery box (read off the store menus 2026-10-28), the store's own newsletter promises
 * (its /newsletter-signup page), the form of address the store uses, and the standing copy rules. The output must
 * keep every key and every {placeholder}; anything else is rejected and retried.
 *
 * The result is marked needsNativeReview: a native speaker should read each file before that market goes live.
 *
 * Usage: node tools/signup/transcreate.js [lang,lang,...]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "..");
const COPY = path.join(ROOT, "signup", "core", "copy");

const TARGETS = {
  "en-US": { name: "American English", address: "you", box: "jewelry box", promises: "Direct updates on product launches and must-haves · Exclusive access to practical tips and guides · A heads-up when one of our rare sales goes live", notes: "US spelling (jewelry, color, store). Keep it the same voice as the British master." },
  de: { name: "German", address: "Sie (formal) - the German store addresses customers as Sie", box: "Schmuckschachtel (menu: Schmuckschachteln), ring box: Ringbox", promises: "Direkte Updates zu Produktneuheiten und Must-haves · Exklusiver Zugang zu nützlichen Tipps und Anleitungen · Eine Vorab-Benachrichtigung bei unseren seltenen Angebotsaktionen" },
  fr: { name: "French", address: "vous", box: "boîte à bijoux / écrin", promises: "Des mises à jour directes sur les nouveautés produits et les indispensables · Un accès privilégié à des astuces et guides utiles · Une alerte en avant-première lors de nos rares promotions", notes: "French puts a space before ; : ! ? - avoid those marks where possible rather than rely on non-breaking spaces." },
  it: { name: "Italian", address: "tu", box: "astuccio per gioielli / scatola per gioielli", promises: "Aggiornamenti diretti su lancio di prodotti e imperdibili · Accesso esclusivo a consigli utili e guide pratiche · Una segnalazione in anticipo quando partono le nostre rare promozioni" },
  es: { name: "Spanish (Spain)", address: "tú", box: "caja para joyas", promises: "Actualizaciones directas sobre lanzamientos y productos imprescindibles · Acceso exclusivo a consejos útiles y guías prácticas · Un aviso previo cuando lanzamos una de nuestras raras promociones" },
  nl: { name: "Dutch", address: "je", box: "sieradendoosje", promises: "Directe updates over productlanceringen en must-haves · Exclusieve toegang tot handige tips en gidsen · Een seintje wanneer we een van onze zeldzame aanbiedingen starten" },
  pt: { name: "European Portuguese", address: "third person formal (o seu, pode), as the Portuguese store does", box: "caixa de joias", promises: "Atualizações diretas sobre lançamentos de produtos e essenciais · Acesso exclusivo a dicas úteis e guias práticos · Um aviso antecipado quando fazemos uma das nossas raras promoções", notes: "European Portuguese, not Brazilian (subscrição, a nossa, e-mail)." },
  sv: { name: "Swedish", address: "du", box: "smyckesask", promises: "Direkta uppdateringar om produktnyheter och måste-ha-produkter · Exklusiv tillgång till användbara tips och guider · En förhandsvarning när vi har en av våra sällsynta reor" },
  nb: { name: "Norwegian Bokmål", address: "du", box: "smykkeeske", promises: "Direkte oppdateringer om produktlanseringer og must-haves · Eksklusiv tilgang til praktiske tips og guider · Beskjed når et av våre sjeldne salg er i gang" },
  fi: { name: "Finnish", address: "sinä", box: "korurasia (menu: Korukotelot)", promises: "Suoria päivityksiä tuotelanseerauksista ja välttämättömyyksistä · Sisäpiirin vinkkejä ja oppaita · Ennakkotietoa harvinaisista alennuksistamme" },
  pl: { name: "Polish", address: "Ty (informal, as the Polish store does)", box: "pudełko na biżuterię", promises: "Bezpośrednie informacje o premierach produktów i niezbędnikach · Dostęp do praktycznych porad i przewodników · Wcześniejsze powiadomienia o naszych rzadkich wyprzedażach" },
  ro: { name: "Romanian", address: "tu", box: "cutie de bijuterii", promises: "Actualizări directe despre lansări de produse și articole esențiale · Acces exclusiv la sfaturi utile și ghiduri practice · O avertizare în avans când avem una dintre rarele noastre promoții", notes: "Use ș and ț with comma below." },
  cs: { name: "Czech", address: "vy (formal)", box: "krabička na šperky", promises: "Přímé informace o uvedení nových produktů a nezbytnostech · Exkluzivní přístup k užitečným tipům a návodům · Upozornění předem, když spouštíme jednu z našich vzácných akcí" },
  sk: { name: "Slovak", address: "vy (formal)", box: "krabička na šperky", promises: "Priame informácie o novinkách a najdôležitejších produktoch · Exkluzívny prístup k užitočným tipom a návodom · Upozornenie vopred, keď spúšťame niektorú z našich zriedkavých akcií" },
  hu: { name: "Hungarian", address: "te (informal, as the Hungarian store does)", box: "ékszerdoboz", promises: "Közvetlen értesítések termékújdonságokról és kedvencekről · Exkluzív hozzáférés hasznos tippekhez és útmutatókhoz · Előrejelzés, amikor ritka akcióinkat elindítjuk" },
};

const RULES = `Westpack is a Danish B2B supplier of packaging for jewellery businesses (jewellery boxes, pouches, gift boxes,
bags, displays, shipping boxes, logo printing). The readers are jewellery brands, designers, goldsmiths and shops.
Rules that are not negotiable:
- Short, human, informal where the address form allows, with a little edge and humour. No marketing-robot phrases
  ("unlock", "exclusive benefits", "join our community", "stay up to date"), no corporate buzzwords.
- Never talk down to the reader or their current packaging.
- No environmental claims of any kind (no eco, green, sustainable, FSC, recyclable), even though some product
  names contain "ECO".
- Never promise or imply a delivery time.
- Product facts must stay exactly as in the master: do not add materials, sizes or features.
- Box names (Torino, Seoul, Madrid, Oslo, Tokyo, Monaco) are product names and stay as they are; only translate
  the words around them ("gift box").
- Keep every {placeholder} exactly as written, and keep the same JSON keys and structure.
- Buttons stay short (under about 28 characters). Headlines stay close to the master's length.
- The humour must work in the target language; rewrite a joke rather than translate it word for word.`;

function loadLang(lang) {
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(COPY, `${lang}.js`), "utf8"), sandbox);
  return sandbox.WestpackSignupCopy[lang];
}

function shapeOf(o) {
  if (Array.isArray(o)) return `[${o.length}]`;
  if (o && typeof o === "object") return `{${Object.keys(o).sort().map((k) => `${k}:${shapeOf(o[k])}`).join(",")}}`;
  return "s";
}
function placeholders(o, acc = []) {
  if (typeof o === "string") (o.match(/\{[a-z]+\}/g) || []).forEach((p) => acc.push(p));
  else if (o && typeof o === "object") Object.values(o).forEach((v) => placeholders(v, acc));
  return acc.sort().join("");
}

function readEnv() {
  const env = {};
  for (const f of [".env.local", ".env.production", ".vercel.live.env"]) {
    try { for (const l of fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2"); } } catch (e) { /* missing */ }
  }
  return Object.assign(env, process.env);
}

async function transcreate(lang, target, da, en, env) {
  const model = env.CONTENT_AGENT_MODEL || env.OPENAI_MODEL || "gpt-4.1";
  const master = { shell: en.shell, "logo-studio": en["logo-studio"], "swipe-match": en["swipe-match"], "pack-and-ship": en["pack-and-ship"] };
  const prompt = `${RULES}

Target: ${target.name}. Form of address: ${target.address}. The store's own word for a jewellery box: ${target.box}.
The store's own newsletter promises, to base shell.promise on (three short lines, not a copy of the store's capitals):
${target.promises}
${target.notes ? `Also: ${target.notes}` : ""}

The Danish master (for tone):
${JSON.stringify({ shell: da.shell, "logo-studio": da["logo-studio"], "swipe-match": da["swipe-match"], "pack-and-ship": da["pack-and-ship"] })}

The English master (structure to return, every key filled in ${target.name}):
${JSON.stringify(master)}

Return only the JSON object with the same four top-level keys.`;
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
    const problems = [];
    if (shapeOf(out) !== shapeOf(master)) problems.push("keys differ");
    if (placeholders(out) !== placeholders(master)) problems.push("placeholders differ");
    if (/\b(eco|sustainab|recycl|fsc)\b/i.test(JSON.stringify(out).replace(/WPS|Westpack/g, ""))) problems.push("environmental wording");
    if (!problems.length) return { copy: out, model: j.model || model };
    console.log(`${lang}: attempt ${attempt} rejected (${problems.join(", ")})`);
  }
  throw new Error(`${lang}: no valid transcreation after 3 attempts`);
}

(async () => {
  const env = readEnv();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const want = (process.argv[2] || Object.keys(TARGETS).join(",")).split(",");
  const da = loadLang("da"), en = loadLang("en");
  await Promise.all(want.map(async (lang) => {
    const { copy, model } = await transcreate(lang, TARGETS[lang], da, en, env);
    const meta = { status: "transcreated", model, date: new Date().toISOString().slice(0, 10), needsNativeReview: true };
    const file = `/* Westpack Signup Lab - ${TARGETS[lang].name}. Transcreated from da/en by tools/signup/transcreate.js; needs a native read before going live. */\n(globalThis.WestpackSignupCopy = globalThis.WestpackSignupCopy || {})[${JSON.stringify(lang)}] = ${JSON.stringify(Object.assign({ meta }, copy), null, 2)};\n`;
    fs.writeFileSync(path.join(COPY, `${lang}.js`), file);
    console.log(`${lang}: written (${model})`);
  }));
})().catch((e) => { console.error(e.message); process.exit(1); });
