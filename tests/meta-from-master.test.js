const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMetaFromMasterPrompt } = require("../server/campaign/meta-from-master");

const MASTER_HTML = `
  <style>
    body { background-color:#f5f5f3; color:#201916; font-family:Arial, sans-serif; }
    h1 { color:#201916; font-family:Georgia, serif; font-size:48px; font-weight:700; }
  </style>
  <table width="760"><tr><td><img src="hero.jpg"><h1>Premium presentation</h1><p>Commercial story</p></td></tr></table>
`;

function promptText(request) {
  return request.prompt.flatMap((message) => message.content).map((part) => part.text || "").join(" ");
}

test("Meta from Master prompt does not hardcode a fixed 5-card structure", () => {
  const request = buildMetaFromMasterPrompt({
    title: "Retail campaign",
    source: { html: MASTER_HTML },
    constraints: []
  }, ["https://assets.test/one.jpg", "https://assets.test/two.jpg"]);
  const text = promptText(request);

  assert.doesNotMatch(text, /card 5/i);
  assert.doesNotMatch(text, /cards 2-4/i);
  assert.doesNotMatch(text, /fifth card/i);

  assert.match(text, /first card must stop the scroll/i);
  assert.match(text, /middle cards must each add new persuasive information/i);
  assert.match(text, /final card must close with one clear CTA/i);
  assert.match(text, /3-6 cards/i);
});
