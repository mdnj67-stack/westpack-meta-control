const test = require("node:test");
const assert = require("node:assert/strict");

const { formOfAddressRule, marketForLanguage } = require("../server/lib/form-of-address");
const translate = require("../api/openai/klaviyo-translate-template");

const promptText = (messages) => messages.map((m) => m.content.map((c) => c.text).join(" ")).join(" ");

test("the rollout's language labels and plain language names both resolve to a market", () => {
  assert.equal(marketForLanguage("Tysk (DE)"), "DE");
  assert.equal(marketForLanguage("Fransk (FR)"), "FR");
  assert.equal(marketForLanguage("German"), "DE");
  assert.equal(marketForLanguage("Italian"), "IT");
  assert.equal(marketForLanguage("English (UK)"), "UK");
});

test("each market gets its own measured form of address", () => {
  assert.match(formOfAddressRule("Tysk (DE)"), /formal: Sie/);
  assert.match(formOfAddressRule("Fransk (FR)"), /formal: vous/);
  assert.match(formOfAddressRule("Hollandsk (NL)"), /informal: je/);
  assert.match(formOfAddressRule("Italiensk (IT)"), /informal: tu/);
  assert.match(formOfAddressRule("Polsk (PL)"), /informal/);
});

test("a language without a measured convention is still told never to mix", () => {
  const rule = formOfAddressRule("Tjekkisk (CZ)");
  assert.match(rule, /never mix formal and informal/);
  assert.doesNotMatch(rule, /In this language/);
});

test("both translation prompts carry the rule for the target language", () => {
  const { buildHtmlPrompt, buildPlainPrompt } = translate.__internals;
  const input = { targetLanguage: "Tysk (DE)" };
  // Every batch of fragments gets the same instruction, so the batches cannot choose differently.
  assert.match(promptText(buildHtmlPrompt(input, ["[1] Hej"], "", "")), /formal: Sie/);
  assert.match(promptText(buildPlainPrompt(input, "", "")), /formal: Sie/);
});
