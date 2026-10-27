// Collects real subject lines (and, where the email has one, the preheader) from Really Good Emails.
//
//   node knowledge/subject-lines/tools/collect-rge.js [emailPages]
//
// What is allowed, checked 2026-10-27: reallygoodemails.com/robots.txt is "Allow: /" except /api/,
// /admin, /library, /upload, /app/* and /companies/. The collector reads only allowed paths,
// identifies itself honestly, makes one request at a time with a pause between them, and caches
// everything under tmp/rge-crawl/ (gitignored), so an interrupted run resumes without refetching.
//
// Two sources, both server-rendered:
// 1. Category listings (/categories/<slug>). Fifty cards each - subject, sender, categories, date.
//    `?page=N` is ignored by the server (further pages load through /api/, which robots.txt
//    disallows), so each category yields its newest fifty.
// 2. Email pages (/emails/<slug>, listed in the public sitemaps, ~21,000). One email each, 48 KB
//    compressed: subject in the page metadata, sender, categories, date, and the email's HTML, from
//    which the hidden preheader is read. Newest first, skipping slugs that are plainly system mail.
//
// Milled is deliberately not collected: its robots.txt disallows ClaudeBot and other AI agents
// outright ("Milled's archive is not licensed for model training") and it answers bots with 403.
//
// Output: tmp/rge-crawl/cards.json. tools/tag-collected.js tags it into collected/really-good-emails.json.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");
const CACHE = path.join(ROOT, "tmp", "rge-crawl");
const EMAIL_CACHE = path.join(CACHE, "emails");
const BASE = "https://reallygoodemails.com";
const USER_AGENT = "WestpackMarketingOS/1.0 (internal subject line research)";
const DELAY_MS = 800;
const EMAIL_PAGES = Math.max(0, Number(process.argv[2]) || 3500);

// The categories whose emails resemble what Westpack sends: retail and e-commerce, launches and
// sales, the seasons, newsletters and inspiration, events, B2B.
const CATEGORIES = [
  "retail", "ecommerce", "b2b", "fashion", "featured-product", "product-launch", "product-sale",
  "promotion", "promotional", "offer", "discount", "last-chance", "countdown-timer", "newsletter",
  "educational-content", "curated", "recommendations", "upselling", "black-friday", "cyber-monday",
  "christmas", "holiday", "gift-guide", "gift-card", "valentine-s-day", "mother-s-day",
  "father-s-day", "halloween", "seasonal", "fall-autumn", "winter", "spring", "summer", "new-year",
  "home-decor-and-furniture", "beauty-and-personal-care", "arts-and-crafts", "hobbies", "wedding",
  "anniversary", "event-conference-trade-show", "invite-invitation", "review-testimonial",
  "customer-appreciation", "announcement", "giveaway", "contest", "back-in-stock", "restock",
  "marketplace", "loyalty-rewards", "thank-you", "weird", "tutorial-or-demo", "survey-feedback"
];

// An email filed under any of these is a system message, not a campaign.
const TRANSACTIONAL = new Set([
  "password-reset", "verification", "authentication", "authorization", "receipt-payment",
  "security-phishing", "gdpr", "terms-of-service", "unsubscribe", "account", "error",
  "deactivation-renewal", "confirmation", "order", "shipping", "transactional"
]);
const RETAIL = new Set(["retail", "ecommerce", "fashion", "b2b", "beauty-and-personal-care", "home-decor-and-furniture", "arts-and-crafts", "marketplace"]);
const SYSTEM_SLUG = /(password|verify|verification|receipt|invoice|log-?in|sign-?in|reset|security|confirm|shipped|tracking|refund|billing|payment|two-factor|2fa|otp|magic-link)/;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" } });
  if (response.status === 429) throw new Error("Rate limited by Really Good Emails - stopping.");
  return response;
}

async function readRobots() {
  const text = await (await get(`${BASE}/robots.txt`)).text();
  const disallowed = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const [key, ...rest] = raw.trim().split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*" || /westpack/i.test(value);
    else if (applies && /^disallow$/i.test(key) && value) disallowed.push(value);
  }
  return disallowed;
}

function allowedPath(pathname, disallowed) {
  return !disallowed.some((prefix) => pathname.startsWith(prefix.replace(/\*.*$/, "")));
}

function decodeFlight(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let flight = "";
  for (const match of html.matchAll(re)) {
    try { flight += JSON.parse(`"${match[1]}"`); } catch (error) { /* a chunk that is not a plain string */ }
  }
  return flight;
}

function unescapeJson(value = "") {
  try { return JSON.parse(`"${value}"`); } catch (error) { return value; }
}

function readCards(flight) {
  const cards = [];
  const seen = new Set();
  const re = /\{"slug":"([a-z0-9-]+)","title":"((?:[^"\\]|\\.)*)"/g;
  for (const match of flight.matchAll(re)) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    const window = flight.slice(match.index, match.index + 6000);
    const company = (window.match(/"company":\{"slug":"[^"]*","name":"((?:[^"\\]|\\.)*)"/) || [])[1] || "";
    const block = (window.match(/"categories":\[((?:\{"name":"(?:[^"\\]|\\.)*","slug":"[^"]*"\},?)*)\]/) || [])[1] || "";
    cards.push({
      slug: match[1],
      subject: unescapeJson(match[2]).replace(/\s+/g, " ").trim(),
      preview: "",
      company: unescapeJson(company),
      categories: [...block.matchAll(/"slug":"([^"]*)"/g)].map((item) => item[1]),
      publishedAt: (window.match(/"publishedAt":"([^"]*)"/) || [])[1] || ""
    });
  }
  return cards;
}

const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", zwnj: "", shy: "" };
// Senders pad the preheader with invisible characters (soft hyphen, combining grapheme joiner,
// zero-width spaces and joiners, line/paragraph separators, BOM, no-break space) so the body does
// not leak into the inbox. Built from code points so no invisible character sits in the source.
const INVISIBLE = new RegExp(`[${[0xad, 0x34f, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x2060, 0xfeff, 0xa0].map((code) => String.fromCharCode(code)).join("")}]`, "g");

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => (name in ENTITIES ? ENTITIES[name] : " "))
    .replace(INVISIBLE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The preheader is the hidden text at the top of the body. Senders mark it in many ways; the
// first hidden element that holds real words is it.
function readPreheader(html = "") {
  const body = html.slice(Math.max(0, html.search(/<body/i)));
  const re = /<(div|span|p|td)\b[^>]*(?:class="[^"]*pre(?:header|view)[^"]*"|style="[^"]*display:\s*none[^"]*")[^>]*>([\s\S]{0,1500}?)<\/\1>/gi;
  for (const match of body.matchAll(re)) {
    const text = cleanText(match[2]);
    if ((text.match(/\p{L}/gu) || []).length >= 8 && text.length <= 220) return text;
  }
  return "";
}

function readEmailPage(slug, html) {
  const subject = cleanText((html.match(/with the subject line: ([^"]*)"/) || [])[1] || "");
  const flight = decodeFlight(html);
  const at = flight.indexOf(`{"email":{"slug":"${slug}"`);
  const record = at >= 0 ? flight.slice(at, at + 20000) : "";
  const company = unescapeJson((record.match(/"company":\{"slug":"[^"]*","name":"((?:[^"\\]|\\.)*)"/) || [])[1] || "");
  const block = (record.match(/"categories":\[((?:\{"name":"(?:[^"\\]|\\.)*","slug":"[^"]*"\},?)*)\]/) || [])[1] || "";
  return {
    slug,
    subject,
    preview: readPreheader(flight),
    company,
    categories: [...block.matchAll(/"slug":"([^"]*)"/g)].map((item) => item[1]),
    publishedAt: (record.match(/"publishedAt":"([^"]*)"/) || [])[1] || ""
  };
}

function isCampaign(card) {
  if (!card.subject || card.categories.some((slug) => TRANSACTIONAL.has(slug))) return false;
  // Software product mail is the bulk of the archive; keep it only where it is also retail.
  if (card.categories.includes("saas") && !card.categories.some((slug) => RETAIL.has(slug))) return false;
  return true;
}

async function collect() {
  fs.mkdirSync(EMAIL_CACHE, { recursive: true });
  const disallowed = await readRobots();
  const all = new Map();
  let requests = 0;

  for (const category of CATEGORIES) {
    if (!allowedPath(`/categories/${category}`, disallowed)) continue;
    const cacheFile = path.join(CACHE, `${category}-1.json`);
    let cards;
    if (fs.existsSync(cacheFile)) cards = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    else {
      const response = await get(`${BASE}/categories/${category}`);
      cards = response.ok ? readCards(decodeFlight(await response.text())) : [];
      fs.writeFileSync(cacheFile, JSON.stringify(cards));
      requests += 1;
      await sleep(DELAY_MS);
    }
    for (const card of cards) if (isCampaign(card)) all.set(card.slug, { ...card, preview: card.preview || "" });
  }
  console.log(`category listings: ${all.size} campaign lines`);

  const slugs = [];
  for (let index = 1; index <= 9; index += 1) {
    const response = await get(`${BASE}/sitemap-emails-${index}.xml`);
    if (!response.ok) break;
    const xml = await response.text();
    requests += 1;
    for (const match of xml.matchAll(/<loc>https:\/\/reallygoodemails\.com\/emails\/([a-z0-9-]+)<\/loc>/g)) slugs.push(match[1]);
    await sleep(DELAY_MS);
  }

  let fetched = 0;
  for (const slug of slugs) {
    if (fetched >= EMAIL_PAGES) break;
    if (SYSTEM_SLUG.test(slug) || !allowedPath(`/emails/${slug}`, disallowed)) continue;
    const cacheFile = path.join(EMAIL_CACHE, `${slug}.json`);
    let card;
    if (fs.existsSync(cacheFile)) card = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    else {
      const response = await get(`${BASE}/emails/${slug}`);
      requests += 1;
      card = response.ok ? readEmailPage(slug, await response.text()) : { slug, subject: "", categories: [] };
      fs.writeFileSync(cacheFile, JSON.stringify(card));
      await sleep(DELAY_MS);
    }
    fetched += 1;
    if (isCampaign(card)) {
      const existing = all.get(slug);
      all.set(slug, { ...existing, ...card, preview: card.preview || existing?.preview || "" });
    }
    if (fetched % 100 === 0) console.log(`email pages: ${fetched}/${EMAIL_PAGES}, ${all.size} campaign lines, ${requests} requests`);
  }

  const cards = [...all.values()].sort((left, right) => String(right.publishedAt).localeCompare(String(left.publishedAt)));
  fs.writeFileSync(path.join(CACHE, "cards.json"), JSON.stringify(cards, null, 1));
  console.log(`done: ${cards.length} campaign subject lines (${cards.filter((card) => card.preview).length} with a preheader) from ${requests} requests`);
}

if (require.main === module) {
  collect().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { CATEGORIES, TRANSACTIONAL, allowedPath, decodeFlight, isCampaign, readCards, readEmailPage, readPreheader };
