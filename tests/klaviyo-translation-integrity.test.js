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

const { requestFragmentsById } = require("../server/lib/klaviyo-template-variant");

function fakeTranslator(misbehave) {
  const calls = [];
  const requestBatch = async ({ ids, lines, first }) => {
    calls.push({ ids: [...ids], first });
    const fragments = misbehave(ids, calls.length).map((index) => ({ id: index + 1, text: `T${index + 1}` }));
    return { parsed: { subject: `S${calls.length}`, fragments }, model: "m" };
  };
  return { calls, requestBatch };
}

test("fragments are placed by id, so a reordered answer still lands in the right slot", async () => {
  const segments = ["a", "b", "c"];
  const { requestBatch } = fakeTranslator((ids) => [...ids].reverse());
  const result = await requestFragmentsById({ segments, requestBatch });
  assert.deepEqual(result.fragments, ["T1", "T2", "T3"]);
  assert.equal(result.header.subject, "S1");
});

test("a dropped fragment is asked for again on its own instead of failing the language", async () => {
  const segments = ["a", "b", "c", "d"];
  const { calls, requestBatch } = fakeTranslator((ids, call) => (call === 1 ? ids.filter((i) => i !== 2) : ids));
  const result = await requestFragmentsById({ segments, requestBatch });
  assert.deepEqual(result.fragments, ["T1", "T2", "T3", "T4"]);
  assert.deepEqual(calls[1].ids, [2]);
  assert.equal(result.header.subject, "S1", "the header comes from the first full pass");
});

test("ids outside the batch and duplicate ids are ignored", async () => {
  const segments = ["a", "b"];
  const { requestBatch } = fakeTranslator((ids) => [...ids, ...ids, 7]);
  const result = await requestFragmentsById({ segments, requestBatch });
  assert.deepEqual(result.fragments, ["T1", "T2"]);
});

test("long emails go out in batches", async () => {
  const segments = Array.from({ length: 95 }, (_, i) => `s${i}`);
  const { calls, requestBatch } = fakeTranslator((ids) => ids);
  const result = await requestFragmentsById({ segments, requestBatch, batchSize: 40 });
  assert.deepEqual(calls.map((call) => call.ids.length), [40, 40, 15]);
  assert.equal(result.fragments.length, 95);
  assert.ok(result.fragments.every((text) => typeof text === "string"));
});

test("a fragment still missing after every attempt fails with a count, never silently in Danish", async () => {
  const segments = ["a", "b", "c"];
  const { calls, requestBatch } = fakeTranslator((ids) => ids.filter((i) => i !== 1));
  await assert.rejects(
    requestFragmentsById({ segments, requestBatch, maxAttempts: 3 }),
    /1 of 3 HTML text fragments came back missing.*#2/
  );
  assert.equal(calls.length, 3);
});

test("the translate route uses the shared segmenter and forbids currency conversion", () => {
  const route = require("node:fs").readFileSync(require.resolve("../api/openai/klaviyo-translate-template.js"), "utf8");
  assert.doesNotMatch(route, /function rebuildHtml/);
  assert.match(route, /Never convert currency/);
});
