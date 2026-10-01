const test = require("node:test");
const assert = require("node:assert/strict");

const { removeStandalonePriceBlocks } = require("../server/lib/klaviyo-product-feed");

test("a price emphasised inside a sentence survives", () => {
  const html = "<p>Så er du med i lodtrækningen om et gavekort på <strong>250€</strong>.</p>";
  assert.equal(removeStandalonePriceBlocks(html), html);
});

test("em and span around an in-sentence price survive", () => {
  const html = "<p>Win a <em>250 EUR</em> voucher or <span>1.500 kr</span> in credit.</p>";
  assert.equal(removeStandalonePriceBlocks(html), html);
});

test("a block that is only a price is still removed", () => {
  assert.equal(removeStandalonePriceBlocks("<div>Box</div><p>199 kr</p>"), "<div>Box</div>");
  assert.equal(removeStandalonePriceBlocks("<table><tr><td><strong>49,95 €</strong></td></tr></table>"), "<table><tr></tr></table>");
  assert.equal(removeStandalonePriceBlocks("<ul><li><span>12 £</span></li></ul>"), "<ul></ul>");
});

const { extractHtmlSegments, rebuildHtml } = require("../server/lib/klaviyo-template-variant");

test("translated fragments keep the spaces that separate them from inline tags", () => {
  const source = "<p><strong>Fine print:</strong> Drawn on <strong>7 October 2026</strong> and contacted.</p>";
  const { tokens, segments } = extractHtmlSegments(source);
  // Models return fragments trimmed; the rebuild must not glue words onto the bold text.
  const translated = segments.map((segment) => segment.trim().toUpperCase());
  assert.equal(
    rebuildHtml(tokens, translated),
    "<p><strong>FINE PRINT:</strong> DRAWN ON <strong>7 OCTOBER 2026</strong> AND CONTACTED.</p>"
  );
});

test("the translate route uses the shared segmenter and forbids currency conversion", () => {
  const route = require("node:fs").readFileSync(require.resolve("../api/openai/klaviyo-translate-template.js"), "utf8");
  assert.doesNotMatch(route, /function rebuildHtml/);
  assert.match(route, /Never convert currency/);
});
