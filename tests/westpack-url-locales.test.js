const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectWestpackSnippetUrlMismatches,
  rewriteWestpackSnippetUrls
} = require("../server/lib/westpack-url-locales");

test("a link to the target market's own store is not a mismatch", () => {
  const html = '<a href="https://www.westpack.com/dkk_dk_den/jewellery-boxes/bas.html?utm_content=x">Se</a>';
  assert.deepEqual(collectWestpackSnippetUrlMismatches(html, "DK"), []);
});

test("a link to another market's store is reported", () => {
  const html = '<a href="https://www.westpack.com/eur_eu_ger/jewellery-boxes/bas.html">Se</a>';
  const mismatches = collectWestpackSnippetUrlMismatches(html, "DK");
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].foundSnippet, "eur_eu_ger");
  assert.equal(mismatches[0].expectedSnippet, "dkk_dk_den");
});

test("rewritten content passes its own validation", () => {
  const html = '<a href="https://www.westpack.com/gbp_uk_eng/jewellery-boxes.html">Se</a>';
  const rewritten = rewriteWestpackSnippetUrls(html, "DK");
  assert.match(rewritten, /dkk_dk_den\/jewellery-boxes\.html/);
  assert.deepEqual(collectWestpackSnippetUrlMismatches(rewritten, "DK"), []);
});
