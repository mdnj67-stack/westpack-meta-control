// Turns uk-pages.jsonl into the committed knowledge base under knowledge/westpack-site/.
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..");
const CRAWL = path.join(__dirname, "..", "..", "..", "tmp", "westpack-site-crawl", "uk-pages.jsonl");
const pages = fs.readFileSync(CRAWL, "utf8").trim().split("\n").map(JSON.parse).filter((p) => p.type);

fs.rmSync(path.join(OUT, "pages"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });

const slug = (url) => url.replace("https://www.westpack.com/gbp_uk_eng/", "").replace(/\.html$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home";

// Lines repeated on most pages are site chrome, not content.
const freq = new Map();
for (const p of pages) for (const l of new Set(p.text.split("\n"))) freq.set(l, (freq.get(l) || 0) + 1);
const chrome = new Set([...freq].filter(([, n]) => n > pages.length * 0.3).map(([l]) => l));
const clean = (t) => t.split("\n").filter((l) => !chrome.has(l)).join("\n");

function parseSpecs(block) {
  const cells = block.split("\n").map((l) => l.replace(/\|\s*$/, "").trim()).filter(Boolean);
  const specs = {};
  let key = null;
  for (const c of cells) {
    if (c.endsWith(":")) { key = c.slice(0, -1); specs[key] = ""; }
    else if (key) { specs[key] = specs[key] ? `${specs[key]}; ${c}` : c; }
  }
  for (const k of Object.keys(specs)) if (!specs[k]) delete specs[k];
  return specs;
}

const products = [];
const index = [];
for (const p of pages) {
  if (p.type === "product") {
    const t = p.text;
    const d = t.indexOf("\nDescription\n");
    const m = t.indexOf("\nMore Information\n");
    const end = t.indexOf("\nAdditional info:", m);
    const sku = (t.match(/SKU: (\S+)/) || [])[1] || "";
    const lines = t.split("\n");
    const skuLine = lines.findIndex((l) => l.startsWith("SKU:"));
    products.push({
      name: p.breadcrumbs[p.breadcrumbs.length - 1] || p.title,
      heading: skuLine > 1 ? lines[skuLine - 2] : "",
      variant: skuLine > 0 ? lines[skuLine - 1] : "",
      sku,
      url: p.url,
      category: p.breadcrumbs.slice(1, -1),
      eco_badge: /\nECO\n/.test(t),
      description: d >= 0 ? t.slice(d + 13, m > d ? m : d + 4000).trim() : "",
      specs: m >= 0 ? parseSpecs(t.slice(m + 18, end > m ? end : m + 3000)) : {}
    });
  } else {
    const file = `pages/${p.type}-${slug(p.url)}.md`;
    const body = clean(p.text);
    fs.writeFileSync(path.join(OUT, file), `# ${p.title}\n\nSource: ${p.url}\nType: ${p.type}${p.breadcrumbs.length ? `\nBreadcrumbs: ${p.breadcrumbs.join(" > ")}` : ""}${p.description ? `\nMeta description: ${p.description}` : ""}\n\n---\n\n${body}\n`);
    index.push({ type: p.type, title: p.title, url: p.url, file, chars: body.length });
  }
}

fs.writeFileSync(path.join(OUT, "products.jsonl"), products.map((x) => JSON.stringify(x)).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "pages-index.json"), JSON.stringify(index.sort((a, b) => a.file.localeCompare(b.file)), null, 1));
console.log({ products: products.length, pages: index.length, withDescription: products.filter((x) => x.description).length, withSpecs: products.filter((x) => Object.keys(x.specs).length).length, chromeLines: chrome.size });
