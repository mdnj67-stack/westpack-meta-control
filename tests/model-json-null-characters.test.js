const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  parseModelJson,
  repairModelJsonText,
  stripNullCharacters,
  stripNullCharactersDeep
} = require("../server/lib/model-json");

const NUL = "\u0000";

test("a corrupted unicode escape is repaired into the character the model meant", () => {
  const raw = '{"fragments":["\\u0000dcberraschung f\\u0000fcr dich"]}';
  const parsed = parseModelJson(raw);
  assert.equal(parsed.fragments[0], "Überraschung für dich");
});

test("repair covers every accented character the European languages need", () => {
  const raw = '{"text":"\\u0000e6 \\u0000f8 \\u0000e5 \\u0000e9 \\u0000e8 \\u0000e7 \\u0000f1 \\u0000df"}';
  assert.equal(parseModelJson(raw).text, "æ ø å é è ç ñ ß");
});

test("stripping instead of repairing would ship the hex digits as copy", () => {
  // This is why the repair runs on the raw JSON text rather than on the parsed value: the naive
  // fix turns "Überraschung" into "dcberraschung" and no error is ever raised.
  const damaged = JSON.parse('{"text":"\\u0000dcberraschung"}').text;
  assert.equal(stripNullCharacters(damaged), "dcberraschung");
  assert.equal(parseModelJson('{"text":"\\u0000dcberraschung"}').text, "Überraschung");
});

test("a genuine null escape with nothing usable after it is dropped, not left to fail the push", () => {
  assert.equal(parseModelJson('{"text":"a\\u0000 b"}').text, "a b");
});

test("an escaped backslash followed by literal u0000 text is left alone", () => {
  // "\\u0000" in the JSON text is a backslash character followed by the literal characters u0000,
  // not a unicode escape, so rewriting it would corrupt the string.
  assert.equal(parseModelJson('{"text":"path\\\\u0000dc"}').text, "path\\u0000dc");
});

test("a raw null byte in the stream is repaired rather than failing the parse", () => {
  const raw = `{"text":"${NUL}dcberraschung"}`;
  assert.throws(() => JSON.parse(raw));
  assert.equal(parseModelJson(raw).text, "Überraschung");
});

test("repair is idempotent and leaves clean output untouched", () => {
  const clean = '{"text":"Überraschung für dich"}';
  assert.equal(repairModelJsonText(clean), clean);
  assert.equal(repairModelJsonText(repairModelJsonText(clean)), clean);
});

test("the outbound guard strips nulls from every string in a Klaviyo payload", () => {
  const payload = {
    data: {
      type: "template",
      attributes: {
        name: `Kampagne${NUL} | DE`,
        html: `<p>Hej${NUL}</p>`,
        nested: [{ text: `a${NUL}b` }]
      }
    }
  };

  const cleaned = stripNullCharactersDeep(payload);
  assert.equal(cleaned.data.attributes.name, "Kampagne | DE");
  assert.equal(cleaned.data.attributes.html, "<p>Hej</p>");
  assert.equal(cleaned.data.attributes.nested[0].text, "ab");
  assert.ok(!JSON.stringify(cleaned).includes(NUL));
  // The source object is not mutated, so the caller keeps whatever it held.
  assert.ok(payload.data.attributes.html.includes(NUL));
});

test("every model JSON parse path runs the repair before parsing", () => {
  const files = [
    "api/openai/klaviyo-translate-template.js",
    "api/openai/klaviyo-agent.js",
    "api/openai/generate-ad-copy.js",
    "server/campaign/brain.js",
    "server/canva/design-vision.js",
    "server/canva/translate-fields.js"
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.match(source, /require\((?:"|')[^"']*model-json(?:"|')\)/, `${file} must use the model JSON repair`);
  }
});

test("the Klaviyo write path cannot send a payload it has not stripped", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api/klaviyo/push-template-rollout.js"), "utf8");
  assert.match(source, /JSON\.stringify\(stripNullCharactersDeep\(body\)\)/);
});
