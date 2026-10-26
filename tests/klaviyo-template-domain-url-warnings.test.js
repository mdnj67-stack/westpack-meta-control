const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { collectWestpackSnippetUrlMismatches } = require("../server/lib/westpack-url-locales");

// The rollout preview checks store links in the browser before anything can be pushed, with its own
// copy of the rule the server applies. The two drifted once: the server stopped flagging a market's
// own store, the browser did not, and every translated template with a store link was blocked.
async function loadDomain() {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "klaviyo-template-domain.js"), "utf8");
  const { createKlaviyoTemplateDomain } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const snippets = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "westpack-url-snippets.json"), "utf8"));
  return createKlaviyoTemplateDomain({ appState: {}, klaviyoUrlSnippetCatalog: snippets });
}

const DK_SOURCE = [
  '<a href="https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas.html?utm_content=x">Se</a>',
  '<a href="https://www.westpack.com/dkk_dk_den/christmas.html">Jul</a>',
].join("");

test("a localised template's links to the target market's own store raise no warning", async () => {
  const domain = await loadDomain();
  const localized = domain.localizeKlaviyoWestpackUrls(DK_SOURCE, "DE");
  assert.match(localized, /eur_eu_ger\/jewellery-boxes\/bas\.html/);
  assert.deepEqual(domain.collectKlaviyoSnippetUrlWarnings(localized, "DE"), []);
});

test("a link left pointing at another market's store is still a warning", async () => {
  const domain = await loadDomain();
  const warnings = domain.collectKlaviyoSnippetUrlWarnings(DK_SOURCE, "DE");
  assert.equal(warnings.length, 2);
  assert.deepEqual([warnings[0].foundSnippet, warnings[0].expectedSnippet], ["dkk_dk_den", "eur_eu_ger"]);
});

test("the browser preview and the server push judge store links the same way", async () => {
  const domain = await loadDomain();
  for (const target of ["DE", "UK", "NO", "US"]) {
    for (const html of [DK_SOURCE, domain.localizeKlaviyoWestpackUrls(DK_SOURCE, target)]) {
      assert.equal(
        domain.collectKlaviyoSnippetUrlWarnings(html, target).length,
        collectWestpackSnippetUrlMismatches(html, target).length,
        `${target}: browser and server disagree`
      );
    }
  }
});
