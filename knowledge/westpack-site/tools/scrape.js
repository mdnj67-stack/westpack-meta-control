// Polite crawler for westpack.com/gbp_uk_eng. Writes one JSON line per page to tmp/westpack-site-crawl/.
// Usage (from repo root): node knowledge/westpack-site/tools/scrape.js   then   node knowledge/westpack-site/tools/build-kb.js
// It resumes where it stopped: pages already in uk-pages.jsonl are skipped. Delete that file for a fresh crawl.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "..", "tmp", "westpack-site-crawl");
fs.mkdirSync(DIR, { recursive: true });
const SITEMAP = "https://www.westpack.com/pub/media/google_sitemap_42.xml"; // the gbp_uk_eng store's sitemap
const OUT = path.join(DIR, "uk-pages.jsonl");
const BASE = "https://www.westpack.com/gbp_uk_eng/";
const CONCURRENCY = 4;

let urls = [];
const loadUrls = async () => (await (await fetch(SITEMAP)).text()).match(/<loc>[^<]*<\/loc>/g).map((l) => l.replace(/<\/?loc>/g, ""));

const done = new Set();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    try { done.add(JSON.parse(line).url); } catch {}
  }
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", times: "×", deg: "°", reg: "®", copy: "©", trade: "™", euro: "€", pound: "£" };
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}

function htmlToText(html) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|svg|noscript|template|iframe|form|button|select)\b[\s\S]*?<\/\1>/gi, " ");
  h = h
    .replace(/<h([1-6])(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (m, n) => "\n\n" + "#".repeat(Number(n)) + " ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/ul|\/ol|\/section|\/article|p|div|tr)\b[^>]*>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(new RegExp("<[a-zA-Z/!](?:\"[^\"]*\"|'[^']*'|[^'\">])*>", "g"), " ");
  return decode(h)
    .split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean)
    .filter((l) => !/(=>|\$event|\$refs|\$nextTick|\bx-(init|cloak|show|data)\b|@[\w-]+[.=]|\bget \w+\(\)|\bclass="|:class=|\(\) *\{|this\.\w+|&&|\|\||^[\d"\s>|)(:.;]*$)/.test(l))
    .filter((l, i, a) => l !== a[i - 1])
    .join("\n");
}

function extract(url, html) {
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  const description = decode((html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "").trim();
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
  const crumbs = (ld.find((x) => x["@type"] === "BreadcrumbList")?.itemListElement || []).map((i) => i.item?.name).filter(Boolean);
  const product = ld.find((x) => x["@type"] === "Product") || null;
  const bodyClass = (html.match(/<body[^>]*class="([^"]*)"/i) || [])[1] || "";
  const type = /catalog-product-view/.test(bodyClass) ? "product" : /catalog-category-view/.test(bodyClass) ? "category" : "cms";
  const main = (html.match(/<main\b[\s\S]*?<\/main>/i) || [html])[0];
  return { url, type, title, description, breadcrumbs: crumbs, product, text: htmlToText(main) };
}

async function fetchPage(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Westpack internal knowledge crawl)" }, redirect: "follow", signal: AbortSignal.timeout(45000) });
      if (res.status === 404) return { status: 404 };
      if (!res.ok) throw new Error("HTTP " + res.status);
      return { status: res.status, finalUrl: res.url, html: await res.text() };
    } catch (e) {
      if (attempt === 2) return { status: 0, error: e.message };
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
}

(async () => {
  urls = (await loadUrls())
    .filter((u) => !/\/(test|teste|test-martin\d*|test4|box-test\.html|eco-test|no-route|thank-you|payment-(accepted|cancelled)|enable-cookies|newsletter-pause-confirmation)$/.test(u));
  const queue = urls.filter((u) => !done.has(u));
  console.log(`total ${urls.length}, remaining ${queue.length}`);
  let n = 0;
  const out = fs.createWriteStream(OUT, { flags: "a" });
  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      const r = await fetchPage(url);
      const rec = r.html ? { ...extract(r.finalUrl || url, r.html), url, status: r.status } : { url, status: r.status, error: r.error || "" };
      out.write(JSON.stringify(rec) + "\n");
      if (++n % 100 === 0) console.log(`${n} done`);
      await new Promise((res) => setTimeout(res, 250));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  out.end();
  console.log("finished", n);
})();
