const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MECHANISM_KEYS, CAMPAIGN_TYPE_KEYS } = require("../server/klaviyo/subject-line-taxonomy");
const { allocateSlots, isValidEntry, loadPatternBank, parseImportedLines, selectBankExamples } = require("../server/klaviyo/subject-line-bank");
const { checkSubjectLine } = require("../server/klaviyo/subject-line-rules");

// Layer 2: the pattern bank. It is what the generator imitates, so it is held to the generator's
// own rules - a line that would be refused as output must not be shown to it as an example.

const bank = loadPatternBank();

test("the built bank is current with its sources", () => {
  const sourceDir = path.join(__dirname, "..", "knowledge", "subject-lines", "source");
  const sourceSubjects = new Set(fs.readdirSync(sourceDir).filter((name) => name.endsWith(".json"))
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(sourceDir, name), "utf8")).map((entry) => entry.subject.trim())));
  for (const entry of bank) assert.ok(sourceSubjects.has(entry.subject), `"${entry.subject}" is in pattern-bank.json but in no source file - rebuild the bank`);
});

test("the bank is large and covers every mechanism and campaign type", () => {
  assert.ok(bank.length >= 1800, `only ${bank.length} entries`);
  const byMechanism = {};
  const byType = {};
  for (const entry of bank) {
    byMechanism[entry.mechanisms[0]] = (byMechanism[entry.mechanisms[0]] || 0) + 1;
    byType[entry.campaignType] = (byType[entry.campaignType] || 0) + 1;
  }
  for (const key of MECHANISM_KEYS) assert.ok(byMechanism[key] >= 100, `${key}: ${byMechanism[key] || 0}`);
  for (const key of CAMPAIGN_TYPE_KEYS) assert.ok(byType[key] >= 20, `${key}: ${byType[key] || 0}`);
});

test("every entry is valid, authored, Danish or English, unique, and breaks no blocking rule", () => {
  const ids = new Set();
  const subjects = new Set();
  for (const entry of bank) {
    assert.ok(isValidEntry(entry), entry.subject);
    assert.ok(["da", "en"].includes(entry.language), entry.subject);
    assert.equal(entry.source, "authored");
    assert.match(entry.id, /^pb-[0-9a-f]{10}$/);
    assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
    ids.add(entry.id);
    const key = entry.subject.toLowerCase().replace(/[^\p{L}\d]+/gu, " ").trim();
    assert.ok(!subjects.has(key), `duplicate subject ${entry.subject}`);
    subjects.add(key);
    assert.notEqual(checkSubjectLine({ subject: entry.subject, preview: entry.preview }).status, "block", entry.subject);
  }
});

test("retrieval gives the recommended mechanisms most slots and keeps range across the rest", () => {
  const analysis = {
    campaignType: "konkurrence",
    recommendedMechanisms: [{ mechanism: "kontrast" }, { mechanism: "nysgerrighed" }, { mechanism: "tal" }],
    avoidMechanisms: [{ mechanism: "tilbud" }]
  };
  const picked = selectBankExamples({ analysis, limit: 30, seed: "YjmdfN:0" });
  assert.ok(picked.length <= 30 && picked.length >= 25);
  const count = (key) => picked.filter((entry) => entry.mechanisms[0] === key).length;
  assert.ok(count("kontrast") >= 4);
  assert.equal(count("tilbud"), 0, "an avoided mechanism is never shown");
  assert.ok(new Set(picked.map((entry) => entry.mechanisms[0])).size >= 10, "range beyond the recommendations");
  assert.deepEqual(selectBankExamples({ analysis, limit: 30, seed: "YjmdfN:0" }).map((entry) => entry.id), picked.map((entry) => entry.id), "same seed, same examples");
  assert.notDeepEqual(selectBankExamples({ analysis, limit: 30, seed: "YjmdfN:1" }).map((entry) => entry.id), picked.map((entry) => entry.id), "'write new ones' shows other examples");
});

test("banned patterns are never shown, and imported lines from real senders rank first", () => {
  const analysis = { campaignType: "produktnyhed", recommendedMechanisms: [{ mechanism: "nyhed" }] };
  const firstPick = selectBankExamples({ analysis, limit: 30, seed: "x" });
  const banned = firstPick.slice(0, 3).map((entry) => ({ id: entry.id }));
  const imported = [{ id: "im-1", subject: "Den nye kollektion er landet", preview: "Se den før alle andre", language: "da", mechanisms: ["nyhed"], campaignType: "produktnyhed", tone: "direkte", context: "generisk", translationRisk: "lav", source: "imported", sender: "En butik" }];
  const picked = selectBankExamples({ analysis, imported, banned, limit: 30, seed: "x" });
  const ids = new Set(picked.map((entry) => entry.id));
  for (const { id } of banned) assert.ok(!ids.has(id), `banned ${id} was shown`);
  assert.ok(ids.has("im-1"));
});

test("slots never exceed the limit", () => {
  for (const limit of [16, 20, 30, 40]) {
    const slots = allocateSlots(["nyhed", "tal", "guide", "kontrast", "humor", "deadline"], limit);
    assert.ok([...slots.values()].reduce((sum, value) => sum + value, 0) <= Math.max(limit, MECHANISM_KEYS.length));
  }
});

test("pasted inbox lines split into subject and preheader, once each", () => {
  const rows = parseImportedLines([
    "Nyt i butikken — tre ting vi er vilde med",
    "Sidste weekend med udsalg\tSlutter søndag",
    "Kan du lide kaffe? | Så læs videre",
    "",
    "nyt i butikken — duplicate"
  ].join("\n"));
  assert.deepEqual(rows, [
    { subject: "Nyt i butikken", preview: "tre ting vi er vilde med" },
    { subject: "Sidste weekend med udsalg", preview: "Slutter søndag" },
    { subject: "Kan du lide kaffe?", preview: "Så læs videre" }
  ]);
});
