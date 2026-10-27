const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ANALYSIS_SCHEMA,
  IMPORT_SCHEMA_ITEM,
  buildCandidateSchema,
  buildHouseEvidenceBlock,
  cleanRationale,
  extractEmailText,
  finalizeCandidates
} = require("../server/klaviyo/subject-line-generator");
const { MECHANISM_KEYS, CAMPAIGN_TYPE_KEYS } = require("../server/klaviyo/subject-line-taxonomy");

// Structured output in strict mode refuses a schema where any object property is optional or extra
// properties are allowed, and a refused schema fails every request rather than one answer.
function assertStrict(schema, path = "schema") {
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, `${path} allows extra properties`);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${path} has optional properties`);
    for (const [key, value] of Object.entries(schema.properties)) assertStrict(value, `${path}.${key}`);
  }
  if (schema.type === "array") assertStrict(schema.items, `${path}[]`);
}

test("every schema the generator sends is valid in strict structured-output mode", () => {
  assertStrict(ANALYSIS_SCHEMA, "analysis");
  assertStrict(buildCandidateSchema(18), "candidates");
  assertStrict(IMPORT_SCHEMA_ITEM, "import");
  assert.deepEqual(ANALYSIS_SCHEMA.properties.campaignType.enum, CAMPAIGN_TYPE_KEYS);
  assert.deepEqual(buildCandidateSchema(18).properties.candidates.items.properties.mechanism.enum, MECHANISM_KEYS);
  assert.equal(buildCandidateSchema(12).properties.candidates.minItems, 12);
});

test("the email is read as text a person sees: no styles, no Klaviyo tags, Danish letters decoded", () => {
  const html = [
    "<html><head><title>x</title><style>.a{color:red}</style></head><body>",
    "<h1>Gave&aelig;sker med dit logo</h1><p>F&aring; 20% p&aring; udvalgte &aelig;sker&nbsp;i dag.</p>",
    "<img src=\"x.png\" alt=\"Monaco gave&aelig;ske\">",
    "<a href=\"{{ organization.url }}gift-wrapping\">Se dem</a>{% unsubscribe %}",
    "</body></html>"
  ].join("");
  const text = extractEmailText({ html });
  assert.match(text, /Gaveæsker med dit logo/);
  assert.match(text, /Få 20% på udvalgte æsker i dag\./);
  assert.match(text, /Monaco gaveæske/);
  assert.doesNotMatch(text, /color:red|organization\.url|unsubscribe|<|title/);
});

test("candidates are checked against the email, and a reused or copied line is flagged", () => {
  const emailText = "Få 20% rabat på udvalgte smykkeæsker. Fire finalister i Grand Prix.";
  const finalized = finalizeCandidates([
    { subject: "Levering inden jul", preview: "Bestil nu", mechanism: "deadline" },
    { subject: "Ordrehistorikken lyver ikke 👀", preview: "Der er en grund til det", mechanism: "social_proof" },
    { subject: "Fire finalister, én titel", preview: "Stem på din favorit med ét klik", mechanism: "kontrast" },
    { subject: "-30% på smykkeæsker", preview: "Kun i denne uge", mechanism: "tilbud" },
    { subject: "Æsker der sælger for dig", preview: "Fire serier, hvor præsentationen arbejder", mechanism: "konkret_vaerdi" }
  ], {
    emailText,
    pastSubjects: [{ subject: "Ordrehistorikken lyver ikke 👀", sentAt: "2026-10-12T08:00:00Z" }],
    examples: [{ id: "pb-abc", subject: "Æsker der sælger for dig" }]
  });
  const bySubject = Object.fromEntries(finalized.map((candidate) => [candidate.subject, candidate]));
  assert.equal(bySubject["Levering inden jul"].status, "block");
  assert.ok(bySubject["Ordrehistorikken lyver ikke 👀"].issues.some((issue) => issue.ruleId === "reused"));
  assert.ok(bySubject["-30% på smykkeæsker"].issues.some((issue) => issue.ruleId === "claim_not_in_email"));
  assert.ok(bySubject["Æsker der sælger for dig"].issues.some((issue) => issue.ruleId === "copied"));
  assert.equal(bySubject["Fire finalister, én titel"].status, "ok");
  // Blocked lines stay on screen with their reason, at the bottom.
  assert.equal(finalized[finalized.length - 1].status, "block");
  assert.equal(finalized.length, 5);
});

test("ids never reach the operator: rationales are cleaned and evidence becomes readable", () => {
  assert.equal(
    cleanRationale("Kombinationen følger konkurrencestrukturen i [pb-6eb0b96eab] og [ab:01GVCWSQHENRP2ZE21QV9EER8Y]."),
    "Kombinationen følger konkurrencestrukturen."
  );
  assert.equal(cleanRationale("Spørgsmålet virker, som i A/B-testen W17 Urskrin."), "Spørgsmålet virker, som i A/B-testen W17 Urskrin.");
  const [candidate] = finalizeCandidates([{
    subject: "Fire æsker. Kun én titel.",
    preview: "Sløjfe, magnetlukning eller løftelåg - hvad vælger du?",
    mechanism: "kontrast",
    rationale: "Kontrasten bygger på [pb-03534e3420] og [ab:C9].",
    evidence: ["pb-03534e3420"]
  }], {
    examples: [{ id: "pb-03534e3420", subject: "Fire ruller. Én vinder.", source: "authored" }],
    abTests: [{ campaignId: "C9", campaignName: "W17 - Urskrin - DK" }]
  });
  assert.equal(candidate.rationale, "Kontrasten bygger på mønsteret »Fire ruller. Én vinder.« og A/B-testen W17 - Urskrin - DK.");
  assert.deepEqual(candidate.evidence.map((item) => item.label), ['Pattern: "Fire ruller. Én vinder."', "A/B: W17 - Urskrin - DK"]);
});

test("without a synced history the prompt says there is no house evidence instead of inventing some", () => {
  assert.match(buildHouseEvidenceBlock({}), /not synced/);
  const block = buildHouseEvidenceBlock({
    country: "DK",
    sendCount: 775,
    abTestCount: 98,
    abLessons: [{
      campaignId: "C1",
      country: "DK",
      sentAt: "2022-09-14T08:00:00Z",
      campaignName: "W37 - Messe Mail 7 - DK",
      differs: "subject",
      winnerId: "B",
      verdict: "klar",
      z: 2.71,
      includesRemainder: true,
      arms: [
        { id: "A", letter: "A", subject: "Spar tid & penge", previewText: "", openRate: 0.615, clickRate: 0.01, received: 483 },
        { id: "B", letter: "B", subject: "Køb stort ind | Spar 10%", previewText: "", openRate: 0.733, clickRate: 0.02, received: 161 }
      ]
    }],
    featureStats: []
  });
  assert.match(block, /Apple Mail Privacy Protection/);
  assert.match(block, /\[ab:C1\]/);
  assert.match(block, /Vinder på åbning: B \(klar/);
  assert.match(block, /resten af listen/);
});
