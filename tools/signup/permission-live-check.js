/**
 * Permission check against the live systems, read-only (2026-11-27, the user: "Vi skal virkeligt være grundigt, det
 * omhander jo permissions"). The browser half is tools/signup/consent-check.js; this is the half that only the real
 * stores and Klaviyo can answer. For each of the 18 markets in core/markets.js:
 * 1. the privacy page the consent sentence links to answers 200;
 * 2. the consent sentence the Signup Lab shows is still, word for word, on the store's own /newsletter-signup page
 *    (named entities such as &aelig; and &scaron; are decoded first - the DK page writes "læs" as l&aelig;s);
 * 3. the Klaviyo list a signup goes to exists in that market's account and is single opt-in (the user's decision
 *    2026-11-09), with its member count - the total is what a claim like "over 20,000 already get the newsletter" rests on.
 * Nothing is written anywhere. Needs the Klaviyo private keys in the app's config (as tools/signup/klaviyo-e2e.js does).
 *
 * Usage: node tools/signup/permission-live-check.js
 */
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
process.chdir(ROOT);
const { MARKETS } = require(path.join(ROOT, "signup", "core", "markets.js"));
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
let cfg = getConfig().klaviyoMarketsJson; if (typeof cfg === "string") cfg = JSON.parse(cfg);
const keyFor = (market) => ((cfg || []).find((m) => m.country === market) || {}).privateKey;
// the store's Magento throws on a bare Accept header (see CLAUDE.md, the watchdog's lesson): ask the way a phone does
const BROWSER = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "en" };
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", aelig: "æ", AElig: "Æ", szlig: "ß", oelig: "œ", OElig: "Œ" };
const MARKS = { acute: "́", grave: "̀", circ: "̂", uml: "̈", tilde: "̃", ring: "̊", cedil: "̧", caron: "̌", dblac: "̋", ogon: "̨" };
function decode(s) {
  return s.replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => {
      if (NAMED[n] !== undefined) return NAMED[n];
      const t = n.match(/^([a-z])(acute|grave|circ|uml|tilde|ring|cedil|caron|slash|dblac|ogon)$/i);
      if (!t) return m;
      if (t[2].toLowerCase() === "slash") return t[1] === "o" ? "ø" : t[1] === "O" ? "Ø" : m;
      return (t[1] + MARKS[t[2].toLowerCase()]).normalize("NFC");
    });
}
const flat = (s) => decode(s).replace(/<[^>]+>/g, " ").replace(/[\s ]+/g, " ").replace(/[’‘]/g, "'").trim();

(async () => {
  let total = 0;
  const rows = [], problems = [];
  for (const [code, m] of Object.entries(MARKETS)) {
    const row = { market: m.market };
    try {
      const r = await fetch(`${m.privacyUrl}?cb=${Date.now()}`, { headers: BROWSER, redirect: "follow" });
      row.privacy = r.status;
      if (r.status !== 200) problems.push(`${m.market}: privacy page ${m.privacyUrl} answered ${r.status}`);
    } catch (e) { row.privacy = "error"; problems.push(`${m.market}: privacy page ${e.message}`); }
    try {
      const r = await fetch(`https://www.westpack.com/${code}/newsletter-signup?cb=${Date.now()}`, { headers: BROWSER, redirect: "follow" });
      row.signupPage = r.status;
      row.verbatim = flat(await r.text()).includes(flat(m.consent));
      if (!row.verbatim) problems.push(`${m.market}: the consent sentence is not word for word on the store's /newsletter-signup page`);
    } catch (e) { row.signupPage = "error"; problems.push(`${m.market}: signup page ${e.message}`); }
    const key = keyFor(m.market);
    if (!key) { problems.push(`${m.market}: no Klaviyo private key in the config to read the list`); rows.push(row); continue; }
    const r = await fetch(`https://a.klaviyo.com/api/lists/${m.listId}?additional-fields[list]=profile_count`, { headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: "2026-10-15", accept: "application/vnd.api+json" } });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 200) { problems.push(`${m.market}: list ${m.listId} answered ${r.status}`); rows.push(row); continue; }
    const a = j.data.attributes;
    Object.assign(row, { list: a.name, optIn: a.opt_in_process, members: a.profile_count });
    total += a.profile_count || 0;
    if (a.opt_in_process !== "single_opt_in") problems.push(`${m.market}: the list is ${a.opt_in_process}`);
    rows.push(row);
    await new Promise((res) => setTimeout(res, 350));
  }
  for (const r of rows) console.log(`${r.market.padEnd(3)} privacy ${r.privacy} | signup page ${r.signupPage}, consent ${r.verbatim ? "word for word" : "NOT FOUND"} | ${r.optIn || "?"} | ${String(r.members ?? "?").padStart(6)} members | ${r.list || ""}`);
  console.log(`members on the 18 newsletter lists: ${total}`);
  console.log(`${problems.length} problem(s)`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
