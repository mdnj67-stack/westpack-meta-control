const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { rewriteWestpackProductFeedUrls, rewriteWestpackSnippetUrls } = require("../server/lib/westpack-url-locales");
const SERVER_PATH_FIXES = require("../server/lib/westpack-url-path-fixes");

const ROOT = path.join(__dirname, "..");
const SNIPPETS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "westpack-url-snippets.json"), "utf8"));
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

// app.js keeps browser copies of the server's link tables; lift an object literal out of it.
function appTable(name) {
  const start = APP_SOURCE.indexOf(`const ${name} = {`);
  assert.ok(start >= 0, `${name} not found in app.js`);
  const end = APP_SOURCE.indexOf("\n};", start);
  return Function(`return ${APP_SOURCE.slice(start + `const ${name} = `.length, end + 2)}`)();
}

async function loadBrowserDomain() {
  const source = fs.readFileSync(path.join(ROOT, "src", "klaviyo-template-domain.js"), "utf8");
  const { createKlaviyoTemplateDomain } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  return createKlaviyoTemplateDomain({ appState: {}, klaviyoUrlSnippetCatalog: appTable("klaviyoUrlSnippetCatalog"), klaviyoUrlPathFixes: appTable("klaviyoUrlPathFixes") });
}

const serverLocalize = (html, country) => rewriteWestpackSnippetUrls(rewriteWestpackProductFeedUrls(html, country), country);

// The links the W44 email actually carries: Danish store links and the locked header's links.
const SOURCE = [
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas.html?utm_content=boxtype_hero",
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas/amsterdam-eco-jewellery-box.html?utm_content=boxtype_d_cta",
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas/rome-eco-jewellery-box.html?utm_content=boxtype_i_cta",
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas/lux-loe.html",
  "{{ organization.url }}",
  "{{ organization.url }}buy-the-whole-look.html",
  "{{ organization.url }}blog",
].map((url) => `<a href="${url}">x</a>`).join("");

test("a UK link to Amsterdam gets the UK store's own path, with its utm tag kept", () => {
  const html = serverLocalize(SOURCE, "UK");
  assert.match(html, /gbp_uk_eng\/jewellery-boxes\/cardboard-jewellery-boxes\/amsterdam-eco-jewellery-box\.html\?utm_content=boxtype_d_cta/);
  assert.match(html, /gbp_uk_eng\/jewellery-boxes\/bas\/rome-eco-jewellery-box\.html/, "pages whose Danish path redirects in the UK are left alone");
});

test("the header's Inspiration link points at the page the Norwegian store has", () => {
  const html = serverLocalize(SOURCE, "NO");
  assert.match(html, /href="\{\{ organization\.url \}\}inspiration"/);
  assert.doesNotMatch(html, /buy-the-whole-look/);
  assert.match(html, /href="\{\{ organization\.url \}\}"/, "the bare store root is untouched");
  assert.match(serverLocalize(SOURCE, "DE"), /\{\{ organization\.url \}\}buy-the-whole-look\.html/, "other markets keep it");
});

test("every other market keeps the Danish path, which its store redirects", () => {
  for (const country of ["DE", "EU", "FR", "NO", "US"]) {
    assert.match(serverLocalize(SOURCE, country), /\/jewellery-boxes\/bas\/amsterdam-eco-jewellery-box\.html/, country);
  }
});

test("the fix is applied once, so localising a localised body changes nothing", () => {
  const once = serverLocalize(SOURCE, "UK");
  assert.equal(serverLocalize(once, "UK"), once);
});

// Most DK campaigns write "{{ organization.url }}/path"; the account URL already ends in a slash, so
// these render as ".../dkk_dk_den//path". 59% of DK's email clicks over 90 days went to such links.
const SLASHED = [
  "{{ organization.url }}/buy-the-whole-look.html",
  "{{ organization.url }}/jewellery-boxes/bas/amsterdam-eco-jewellery-box.html?utm_content=x",
  "https://www.westpack.com/dkk_dk_den//jewellery-boxes/bas/amsterdam-eco-jewellery-box.html",
  "{{ organization.url }}/blog/top-5-bags",
].map((url) => `<a href="${url}">x</a>`).join("");

test("a link written with a slash after the store root still gets its market's store fix", () => {
  const no = serverLocalize(SLASHED, "NO");
  assert.match(no, /href="\{\{ organization\.url \}\}inspiration"/, "NO has no buy-the-whole-look page (404 as //)");
  const uk = serverLocalize(SLASHED, "UK");
  assert.match(uk, /href="\{\{ organization\.url \}\}jewellery-boxes\/cardboard-jewellery-boxes\/amsterdam-eco-jewellery-box\.html\?utm_content=x"/);
  assert.match(uk, /gbp_uk_eng\/jewellery-boxes\/cardboard-jewellery-boxes\/amsterdam-eco-jewellery-box\.html"/);
  assert.match(serverLocalize(SLASHED, "DE"), /href="\{\{ organization\.url \}\}blog\/top-5-bags"/, "and the double slash is gone everywhere");
  assert.doesNotMatch(uk + no, /\}\}\/|[a-z]\/\//);
});

test("the rollout preview localises links exactly as the push does, in every market", async () => {
  const domain = await loadBrowserDomain();
  for (const country of Object.keys(SNIPPETS)) {
    assert.equal(domain.localizeKlaviyoWestpackUrls(SOURCE, country), serverLocalize(SOURCE, country), country);
    assert.equal(domain.localizeKlaviyoWestpackUrls(SLASHED, country), serverLocalize(SLASHED, country), `${country} (slashed)`);
  }
});

test("the browser's copies of the link tables match the server's", () => {
  assert.deepEqual(appTable("klaviyoUrlPathFixes"), SERVER_PATH_FIXES);
  assert.deepEqual(appTable("klaviyoUrlSnippetCatalog"), SNIPPETS);
});
