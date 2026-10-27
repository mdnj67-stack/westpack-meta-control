const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MECHANISM_KEYS } = require("../server/klaviyo/subject-line-taxonomy");
const { loadPatternBank, selectBankExamples } = require("../server/klaviyo/subject-line-bank");
const { EMBEDDING_DIMENSIONS, briefText, buildRelevance, loadVectors, makeVectors, quantize } = require("../server/klaviyo/subject-line-semantic");
const { buildPlaybookPromptBlock, focusMechanisms, loadPlaybook } = require("../server/klaviyo/subject-line-playbook");

// How the writer gets the whole bank and not just the two dozen lines it is shown: a playbook
// distilled from every line goes into every prompt, and the lines it is shown are the ones closest
// in meaning to the brief.

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const bank = loadPatternBank();
const playbook = loadPlaybook();

test("the semantic index is built for the bank as it stands", () => {
  const vectors = loadVectors(bank);
  assert.ok(vectors, "pattern-bank.vectors.* is missing or was built for another bank - run tools/build-embeddings.js");
  assert.equal(vectors.ids.length, bank.length);
  assert.equal(vectors.data.length, bank.length * EMBEDDING_DIMENSIONS);
});

test("quantising a vector keeps its direction", () => {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => Math.sin(index * 1.7) * (index % 5 ? 1 : 3));
  const bytes = quantize(vector);
  const vectors = makeVectors(["a"], bytes);
  const relevance = buildRelevance(vectors, vector);
  assert.ok(relevance.similarity.get("a") > 0.999, `cosine after quantising was ${relevance.similarity.get("a")}`);
});

// Four lines in two dimensions padded with zeros: a, a-twin and b point roughly at the query, c away from it.
function toyRelevance(query, lines, extra = new Map()) {
  const pad = (values) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => values[index] || 0);
  const ids = Object.keys(lines);
  const data = new Int8Array(ids.length * EMBEDDING_DIMENSIONS);
  ids.forEach((id, row) => data.set(quantize(pad(lines[id])), row * EMBEDDING_DIMENSIONS));
  return buildRelevance(makeVectors(ids, data), pad(query), new Map([...extra].map(([id, values]) => [id, pad(values)])));
}

test("relevance measures lines against the brief and against each other, including lines embedded on the spot", () => {
  const relevance = toyRelevance([1, 0], { a: [1, 0.1], b: [0.8, 0.6], c: [-1, 0] }, new Map([["im-1", [0, 1]]]));
  assert.ok(relevance.similarity.get("a") > relevance.similarity.get("b"));
  assert.ok(relevance.similarity.get("c") < 0);
  assert.ok(Math.abs(relevance.similarity.get("im-1")) < 1e-6);
  assert.ok(relevance.between("a", "b") > 0.5);
  assert.equal(relevance.between("a", "unknown"), 0);
});

test("series names stay out of the query, categories stay in", () => {
  const text = briefText({ coreMessage: "Stem på din favorit", products: ["gaveæsker", "Monaco", "Plano", "smykkeposer"], hooks: [{ hook: "Hvem vinder?" }] });
  assert.match(text, /gaveæsker, smykkeposer/);
  assert.doesNotMatch(text, /Monaco|Plano/);
  assert.match(text, /Hvem vinder\?/);
});

function entry(id, mechanism, source, campaignType = "produktfokus") {
  return { id, subject: `Linje ${id}`, preview: "", mechanisms: [mechanism], campaignType, tone: "varm", translationRisk: "lav", language: source === "authored" ? "da" : "en", source };
}

test("with the index, a mechanism's slots go to the lines closest to the brief, not to near-copies of each other", () => {
  const lines = [
    entry("a1", "tal", "authored"), entry("a2", "tal", "authored"), entry("a3", "tal", "authored"),
    entry("r1", "tal", "collected"), entry("r2", "tal", "collected")
  ];
  const relevance = toyRelevance([1, 0, 0], {
    a1: [0.9, 0.44, 0],
    a2: [0.89, 0.45, 0.02], // a near-copy of a1
    a3: [0.85, -0.3, 0.43],
    r1: [0.6, 0.8, 0],
    r2: [0, 1, 0]
  });
  const chosen = selectBankExamples({ bank: lines, analysis: { recommendedMechanisms: [{ mechanism: "tal" }] }, limit: 2, relevance })
    .filter((item) => item.mechanisms[0] === "tal");
  assert.deepEqual(chosen.map((item) => item.id).sort(), ["a1", "r1"]);
  const three = selectBankExamples({ bank: lines.filter((item) => item.source === "authored"), analysis: { recommendedMechanisms: [{ mechanism: "tal" }] }, limit: 2, relevance })
    .map((item) => item.id);
  assert.deepEqual(three, ["a1", "a3"], "the near-copy should give way to a different line");
});

test("the campaign type still counts beside meaning, and asking again moves on to the next lines", () => {
  const lines = [entry("x", "tal", "authored", "konkurrence"), entry("y", "tal", "authored"), entry("z", "tal", "authored")];
  const relevance = toyRelevance([1, 0, 0], { x: [0.6, 0.8, 0], y: [0.62, 0, 0.78], z: [-0.5, 0.5, 0.7] });
  const analysis = { campaignType: "konkurrence", recommendedMechanisms: [{ mechanism: "tal" }] };
  const first = selectBankExamples({ bank: lines, analysis, limit: 1, relevance }).map((item) => item.id);
  assert.deepEqual(first, ["x"]);
  const again = selectBankExamples({ bank: lines, analysis, limit: 1, relevance, attempt: 1 }).map((item) => item.id);
  assert.notDeepEqual(again, first);
});

test("without the index, retrieval falls back to tags and still honours bans", () => {
  const banned = [{ id: bank[0].id }];
  const recommendedMechanisms = [bank[0].mechanisms[0], ...MECHANISM_KEYS.filter((key) => key !== bank[0].mechanisms[0]).slice(0, 2)].map((mechanism) => ({ mechanism }));
  const examples = selectBankExamples({ analysis: { recommendedMechanisms }, banned, limit: 24, seed: "t" });
  assert.equal(examples.length, 24);
  assert.ok(!examples.some((item) => item.id === bank[0].id));
});

test("the playbook covers every mechanism, cites only lines that are in the bank, and holds no run-on text", () => {
  assert.ok(playbook, "knowledge/subject-lines/playbook.json is missing - run tools/build-playbook.js");
  assert.deepEqual(Object.keys(playbook.mechanisms).sort(), [...MECHANISM_KEYS].sort());
  const subjects = new Set(bank.map((item) => item.subject));
  for (const [key, mechanism] of Object.entries(playbook.mechanisms)) {
    assert.ok(mechanism.patterns.length >= 5, `${key} has ${mechanism.patterns.length} patterns`);
    for (const pattern of mechanism.patterns) {
      assert.ok(pattern.seenIn.length >= 1, `${key}/${pattern.name} cites no line`);
      for (const line of pattern.seenIn) assert.ok(subjects.has(line.subject), `${key}/${pattern.name} cites "${line.subject}", which is not in the bank`);
      assert.match(pattern.formula, /\[[^\]]+\]/, `${key}/${pattern.name} has no placeholder`);
    }
    for (const item of [...mechanism.preheaderMoves, ...mechanism.avoid]) assert.ok(item.length <= 200, `${key}: ${item.slice(0, 60)}... runs on`);
  }
});

test("the brief's mechanisms go into the prompt in full, the rest as formulas, avoided ones never in focus", () => {
  const analysis = { recommendedMechanisms: [{ mechanism: "spoergsmaal" }, { mechanism: "humor" }, { mechanism: "tal" }, { mechanism: "nyhed" }], avoidMechanisms: [{ mechanism: "humor" }] };
  assert.deepEqual(focusMechanisms(analysis), ["spoergsmaal", "tal", "nyhed"]);
  const block = buildPlaybookPromptBlock(analysis);
  assert.match(block, /^## Spørgsmål \(spoergsmaal\)/m);
  assert.match(block, /^## Tal og lister \(tal\)/m);
  assert.doesNotMatch(block, /^## Humor/m);
  assert.match(block, /^- Humor og ordspil \(humor\): \[/m);
  assert.match(block, /never copy a line's words/);
  assert.equal(buildPlaybookPromptBlock(analysis, null), "");
});

test("the writer reads the playbook and is shown the lines the index chose", () => {
  const generator = read("server/klaviyo/subject-line-generator.js");
  assert.match(generator, /buildPlaybookPromptBlock\(analysis\)/);
  const api = read("api/klaviyo/subject-lines.js");
  assert.match(api, /relevanceToBrief\(config, \{ bank: loadPatternBank\(\), analysis, extra: team\.imported \}\)/);
  assert.match(api, /retrieval: relevance \? "semantic" : "tags"/);
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(vercel.functions["api/klaviyo/subject-lines.js"].includeFiles, /pattern-bank\.vectors/);
});
