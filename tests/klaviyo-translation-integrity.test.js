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

test("text inside translate=\"no\" reaches every market exactly as written", () => {
  const source = [
    "<p>Det siger kunderne:</p>",
    "<td translate=\"no\" lang=\"de\"><p>Hervorragende Ausführung, <strong>gute Druckqualität</strong>.</p>",
    "<table><tr><td>Steinbichler</td></tr></table></td>",
    "<p>Læs flere anmeldelser</p>"
  ].join("");
  const { tokens, segments } = extractHtmlSegments(source);
  // A nested <td> closing must not end the protection early, and text after the element is copy again.
  assert.deepEqual(segments, ["Det siger kunderne:", "Læs flere anmeldelser"]);
  assert.equal(
    rebuildHtml(tokens, segments.map((segment) => segment.toUpperCase())),
    source.replace("Det siger kunderne:", "DET SIGER KUNDERNE:").replace("Læs flere anmeldelser", "LÆS FLERE ANMELDELSER")
  );
});

test("class=\"notranslate\" protects text too, and a void tag inside does not unbalance it", () => {
  const source = "<span class=\"brand notranslate\">Fellsocke<br>by Westpack</span><span>æske</span>";
  const { segments } = extractHtmlSegments(source);
  assert.deepEqual(segments, ["æske"]);
});

test("alt text, aria-label and title are translated, escaped for their quotes, and protected like text", () => {
  const source = [
    "<a href=\"{{ organization.url }}oslo.html\" aria-label=\"Se pris på Oslo til ring\" title='Åbn siden'>Se pris</a>",
    "<img src=\"https://cdn.example/a.jpg\" alt=\"Åben æske med guldring\" width=\"238\">",
    "<img src=\"https://cdn.example/b.jpg\" alt=\"\">",
    "<img src=\"https://cdn.example/c.jpg\" alt=\"{{ person.first_name }}\">",
    "<img translate=\"no\" src=\"https://cdn.example/d.jpg\" alt=\"Logo\">",
    "<td translate=\"no\"><img src=\"https://cdn.example/e.jpg\" alt=\"Anmeldelse\"></td>"
  ].join("");
  const { tokens, segments } = extractHtmlSegments(source);
  // Empty values, Klaviyo tags and anything under translate="no" stay where they are.
  assert.deepEqual(segments, ["Se pris på Oslo til ring", "Åbn siden", "Se pris", "Åben æske med guldring"]);
  const translated = ["Preis für \"Oslo\" ansehen", "Seite <öffnen>", "Preis ansehen", "Offene Box mit Goldring"];
  assert.equal(
    rebuildHtml(tokens, translated),
    source
      .replace("Se pris på Oslo til ring", "Preis für &quot;Oslo&quot; ansehen")
      .replace("Åbn siden", "Seite &lt;öffnen&gt;")
      .replace(">Se pris<", ">Preis ansehen<")
      .replace("Åben æske med guldring", "Offene Box mit Goldring")
  );
});

test("the translate prompt keeps city-named series names as written", () => {
  const route = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "api", "openai", "klaviyo-translate-template.js"), "utf8");
  assert.match(route, /Vienna is never Wien/);
  assert.match(route, /image alt text and accessible labels/);
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
    /1 of 3 HTML text fragments came back missing.*#2, left out: "b"/
  );
  assert.equal(calls.length, 3);
});

test("the translate route uses the shared segmenter and forbids currency conversion", () => {
  const route = require("node:fs").readFileSync(require.resolve("../api/openai/klaviyo-translate-template.js"), "utf8");
  assert.doesNotMatch(route, /function rebuildHtml/);
  assert.match(route, /Never convert currency/);
});

const { buildWestpackKnowledgePromptBlock } = require("../server/lib/westpack-knowledge");

test("translation keeps the source's own FSC lines instead of being told never to use FSC", () => {
  // A W43 translation failed with exactly the footer's four FSC licence fragments missing, under
  // a prompt that both said "translate faithfully" and "do not use FSC".
  const translating = buildWestpackKnowledgePromptBlock({ channel: "klaviyo", keepSourceClaims: true });
  assert.doesNotMatch(translating, /Do not use FSC/);
  assert.match(translating, /carry it over faithfully, never drop or blank it/);
  assert.match(buildWestpackKnowledgePromptBlock({ channel: "meta" }), /Do not use FSC/);

  const fs = require("node:fs");
  for (const file of ["../api/openai/klaviyo-translate-template.js", "../server/lib/klaviyo-template-variant.js", "../server/canva/translate-fields.js"]) {
    assert.match(fs.readFileSync(require.resolve(file), "utf8"), /keepSourceClaims: true/, file);
  }
});

test("the error says whether a missing fragment was left out or returned blank", async () => {
  const requestBatch = async ({ ids }) => ({ parsed: { fragments: ids.map((index) => ({ id: index + 1, text: index === 0 ? " " : "T" })) }, model: "m" });
  await assert.rejects(requestFragmentsById({ segments: ["FSC® licence", "b"], requestBatch }), /#1, returned blank: "FSC® licence"/);
});

test("only the last attempt is flagged, and the translate route drops the claim guardrails there", async () => {
  const seen = [];
  const requestBatch = async ({ ids, attempt, lastAttempt }) => {
    seen.push({ attempt, lastAttempt });
    return { parsed: { fragments: lastAttempt ? ids.map((index) => ({ id: index + 1, text: "T" })) : [] }, model: "m" };
  };
  const result = await requestFragmentsById({ segments: ["a"], requestBatch, maxAttempts: 3 });
  assert.deepEqual(result.fragments, ["T"]);
  assert.deepEqual(seen, [{ attempt: 0, lastAttempt: false }, { attempt: 1, lastAttempt: false }, { attempt: 2, lastAttempt: true }]);

  const route = require("node:fs").readFileSync(require.resolve("../api/openai/klaviyo-translate-template.js"), "utf8");
  assert.match(route, /lastAttempt \? "" : westpackKnowledgeBlock/);
});

test("one language failing no longer throws away the languages already translated", () => {
  const rollout = require("node:fs").readFileSync(require.resolve("../src/klaviyo-template-rollout.js"), "utf8");
  assert.match(rollout, /failedLanguages\.push\(/);
  assert.match(rollout, /retry only/);
  assert.doesNotMatch(rollout, /throw new Error\(`Generated \$\{brokenVariant\.label\}/);
});

test("layout entities are not sent for translation, but copy that starts with one is", () => {
  // A W46 email had 44 of its 176 fragments as bare &nbsp; spacers and &rarr; arrows. The letters in an
  // entity's name passed the "has letters" check, the model sometimes answered them blank, and Polish failed.
  const source = '<td>&nbsp;</td><a>&rarr;</a><p>&#9679;&nbsp;</p><p>&nbsp;Se pris&nbsp;&rarr;</p><p>Écrin</p>';
  const { tokens, segments } = extractHtmlSegments(source);
  assert.deepEqual(segments, ["&nbsp;Se pris&nbsp;&rarr;", "Écrin"]);
  assert.equal(rebuildHtml(tokens, ["&nbsp;Zobacz cenę&nbsp;&rarr;", "Etui"]), '<td>&nbsp;</td><a>&rarr;</a><p>&#9679;&nbsp;</p><p>&nbsp;Zobacz cenę&nbsp;&rarr;</p><p>Etui</p>');
});

test("the missing-fragment error quotes the fragment as written", async () => {
  const requestBatch = async ({ ids }) => ({ parsed: { fragments: ids.map((index) => ({ id: index + 1, text: index === 0 ? "" : "T" })) }, model: "m" });
  await assert.rejects(requestFragmentsById({ segments: ["Spørgsmål  om  æsker", "b"], requestBatch }), /returned blank: "Spørgsmål om æsker"/);
});
