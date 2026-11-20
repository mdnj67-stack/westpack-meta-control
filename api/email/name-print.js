/**
 * GET /api/email/name-print?o=<base64>&f=<base64>&s=<base64>&box=<lid>&foil=<foil>&w=600
 *
 * The reader's own name, foil-printed on a real Westpack lid, for a campaign email to show at open
 * (server/email/name-print.js). Klaviyo fills the query when it sends: o = {{ person.organization|base64_encode }},
 * f = {{ person.first_name|base64_encode }}, s = {{ organization.url|base64_encode }} (the store, which says the
 * language of the fallback). base64 because it is the encoding filter Klaviyo documents, and it survives an
 * ampersand or a space in a company name, which a raw value in an image URL would not.
 *
 * Public on purpose - an email's image cannot carry a session - and cached for a year at the edge, so one name on one
 * lid is drawn once. It never fails as a broken image: anything that goes wrong answers the lid without a name.
 *
 * GET ?action=coverage&country=DK (logged in) - how many of a market's newsletter profiles have a company name and a
 * first name to print, counted and never listed. Read-only.
 */
const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { sendJson } = require("../../server/lib/http");
const { renderNamePrint, cleanName, FOILS, scenes } = require("../../server/email/name-print");

const YOUR_NAME = [
  [/(^|[._/])dk([._/]|$)|dkk_|\.dk\b/i, "Dit navn"],
  [/_se_|sek_|\.se\b/i, "Ditt namn"],
  [/_no_|nok_|\.no\b/i, "Ditt navn"],
  [/_fi_|\.fi\b/i, "Nimesi"],
  [/_de_|_at_|_ch_|\.de\b|\.at\b/i, "Ihr Name"],
  [/_nl_|_be_|\.nl\b|\.be\b/i, "Uw naam"],
  [/_fr_|\.fr\b/i, "Votre nom"],
  [/_it_|\.it\b/i, "Il tuo nome"],
  [/_es_|\.es\b/i, "Tu nombre"],
  [/_pt_|\.pt\b/i, "O seu nome"],
  [/_pl_|pln_|\.pl\b/i, "Twoja nazwa"],
  [/_cz_|czk_|\.cz\b/i, "Vaše jméno"],
  [/_sk_|\.sk\b/i, "Vaše meno"],
  [/_hu_|huf_|\.hu\b/i, "Az Ön neve"],
  [/_ro_|ron_|\.ro\b/i, "Numele tău"]
];

// the raw query, read by hand: base64 carries "+", which URLSearchParams would turn into a space
function readQuery(url) {
  const out = {};
  const q = String(url || "").split("?")[1] || "";
  for (const part of q.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq < 0 ? part : part.slice(0, eq);
    let value = eq < 0 ? "" : part.slice(eq + 1);
    try { value = decodeURIComponent(value.replace(/ /g, "+")); } catch (error) { /* keep it as sent */ }
    out[key] = value;
  }
  return out;
}

function fromBase64(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(v)) return v;
  const buf = Buffer.from(v.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const utf8 = buf.toString("utf8");
  const text = utf8.includes("�") ? buf.toString("latin1") : utf8;
  return text.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, "\"");
}

function chooseName(q) {
  const plain = cleanName(q.n);
  if (plain) return plain;
  const org = cleanName(fromBase64(q.o));
  if (org) return org;
  // a first name only, never a whole personal name: the box carries what a shop would
  const first = cleanName(fromBase64(q.f).split(/\s+/)[0]);
  if (first) return first;
  const store = fromBase64(q.s) || "";
  const hit = YOUR_NAME.find(([pattern]) => pattern.test(store));
  return hit ? hit[1] : "Your name";
}

async function coverage(req, res) {
  const parseMarkets = (raw) => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v : []; } catch (error) { return []; } };
  const { buildHeaders, klaviyoRequest, resolveNewsletterList } = require("../../server/klaviyo/newsletter-lists");
  const config = getConfig();
  const country = String(readQuery(req.url).country || "DK").toUpperCase();
  const market = parseMarkets(config.klaviyoMarketsJson).find((m) => String(m?.country || "").toUpperCase() === country);
  if (!market?.privateKey) return sendJson(res, 404, { error: `No Klaviyo key for ${country}.` });
  const headers = buildHeaders(String(market.privateKey).trim(), "2024-10-15");
  const list = await resolveNewsletterList(headers, { listId: market.listId, listName: market.listName });
  if (!list?.id) return sendJson(res, 404, { error: `No newsletter list in ${country}.` });
  const tally = { profiles: 0, organization: 0, organizationPrintable: 0, firstName: 0, firstNamePrintable: 0, neither: 0, lengths: {} };
  let next = `https://a.klaviyo.com/api/lists/${list.id}/profiles/?page%5Bsize%5D=100&fields%5Bprofile%5D=organization,first_name`;
  const started = Date.now();
  while (next && Date.now() - started < 240000) {
    const payload = await klaviyoRequest(next, headers);
    for (const p of payload.data || []) {
      tally.profiles += 1;
      const org = String(p?.attributes?.organization || "").trim(), first = String(p?.attributes?.first_name || "").trim();
      if (org) tally.organization += 1;
      const clean = cleanName(org);
      if (clean) {
        tally.organizationPrintable += 1;
        const bucket = clean.length <= 8 ? "1-8" : clean.length <= 14 ? "9-14" : clean.length <= 20 ? "15-20" : "21-30";
        tally.lengths[bucket] = (tally.lengths[bucket] || 0) + 1;
      }
      if (first) tally.firstName += 1;
      if (cleanName(first.split(/\s+/)[0])) tally.firstNamePrintable += 1;
      if (!clean && !cleanName(first.split(/\s+/)[0])) tally.neither += 1;
    }
    next = payload?.links?.next || "";
  }
  return sendJson(res, 200, { country, list: list.name, complete: !next, ...tally });
}

module.exports = async function handler(req, res) {
  const q = readQuery(req.url);
  if (q.action === "coverage") {
    const config = getConfig();
    if (!requireAuth(req, res, config)) return;
    res.setHeader("Cache-Control", "no-store");
    try { return await coverage(req, res); } catch (error) { return sendJson(res, 500, { error: error.message }); }
  }
  const box = scenes().includes(q.box) ? q.box : "torino";
  const foil = FOILS[q.foil] ? q.foil : undefined;
  const width = Math.max(200, Math.min(1200, Math.round(Number(q.w) || 600)));
  // crop=x,y,w,h in % of the photo (a close-up of the lid); light=x,y,z where the light stands, in print units
  const nums = (v, n) => { const a = String(v || "").split(",").map(Number); return a.length === n && a.every(Number.isFinite) ? a : null; };
  const c = nums(q.crop, 4);
  const crop = c && c[2] >= 10 && c[3] >= 10 ? [Math.max(0, c[0]), Math.max(0, c[1]), Math.min(100, c[2]), Math.min(100, c[3])] : null;
  const l = nums(q.light, 3);
  const light = l ? { x: Math.max(-2000, Math.min(3000, l[0])), y: Math.max(-2000, Math.min(3000, l[1])), z: Math.max(50, Math.min(3000, l[2])) } : null;
  let result;
  try {
    result = renderNamePrint({ name: chooseName(q), scene: box, foil, width, crop, light });
  } catch (error) {
    console.error("name-print", error);
    result = renderNamePrint({ name: "", scene: box, width, crop });
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", result.jpeg.length);
  res.setHeader("Cache-Control", "public, max-age=2592000, s-maxage=31536000, immutable");
  res.setHeader("X-Render-Ms", String(result.ms));
  res.end(result.jpeg);
};

module.exports.__internals = { readQuery, fromBase64, chooseName };
