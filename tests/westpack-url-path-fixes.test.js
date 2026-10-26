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

// The links the W44 email actually carries, Danish store.
const SOURCE = [
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas.html?utm_content=boxtype_hero",
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas/amsterdam-eco-jewellery-box.html?utm_content=boxtype_d_cta",
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas/rome-eco-jewellery-box.html?utm_content=boxtype_i_cta",
  "https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas/lux-loe.html",
].map((url) => `<a href="${url}">x</a>`).join("");

test("a UK link to Amsterdam gets the UK store's own path, with its utm tag kept", () => {
  const html = serverLocalize(SOURCE, "UK");
  assert.match(html, /gbp_uk_eng\/jewellery-boxes\/cardboard-jewellery-boxes\/amsterdam-eco-jewellery-box\.html\?utm_content=boxtype_d_cta/);
  assert.match(html, /gbp_uk_eng\/jewellery-boxes\/bas\/rome-eco-jewellery-box\.html/, "pages whose Danish path redirects in the UK are left alone");
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

test("the rollout preview localises links exactly as the push does, in every market", async () => {
  const domain = await loadBrowserDomain();
  for (const country of Object.keys(SNIPPETS)) {
    assert.equal(domain.localizeKlaviyoWestpackUrls(SOURCE, country), serverLocalize(SOURCE, country), country);
  }
});

test("the browser's copies of the link tables match the server's", () => {
  assert.deepEqual(appTable("klaviyoUrlPathFixes"), SERVER_PATH_FIXES);
  assert.deepEqual(appTable("klaviyoUrlSnippetCatalog"), SNIPPETS);
});
