const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMechanismEvidence, selectUntagged } = require("../server/klaviyo/subject-line-mechanisms");
const { buildGeneratorOutcomes } = require("../server/klaviyo/subject-line-outcomes");

// The record of each mechanism in Westpack's own A/B tests, and the generator's own record.

function abTest({ campaignId, familyKey, country = "DK", verdict = "uafgjort", differs = "subject", arms }) {
  const ranked = [...arms].sort((left, right) => right.openRate - left.openRate);
  return {
    campaignId,
    familyKey,
    country,
    verdict,
    differs,
    winnerId: ranked[0].id,
    openLiftPoints: Number(((ranked[0].openRate - ranked[1].openRate) * 100).toFixed(1)),
    arms: arms.map((arm, index) => ({ letter: String.fromCharCode(65 + index), received: 300, clickRate: 0.01, ...arm }))
  };
}

test("untagged lines are picked A/B arms first, then DK sends, and never twice", () => {
  const rows = selectUntagged({
    abTests: [
      abTest({ campaignId: "C1", familyKey: "w1", arms: [{ id: "A1", subject: "Rabat", openRate: 0.5 }, { id: "B1", subject: "Nyhed", openRate: 0.6 }] }),
      abTest({ campaignId: "C2", familyKey: "w2", differs: "content", arms: [{ id: "A2", subject: "Samme", openRate: 0.5 }, { id: "B2", subject: "Samme", openRate: 0.6 }] })
    ],
    dkEntries: [{ id: "B1", subject: "Nyhed" }, { id: "S1", subject: "Fem nye æsker" }, { id: "S2", subject: "Allerede mærket" }],
    tags: { S2: { m: ["nyhed"] } }
  });
  assert.deepEqual(rows.map((row) => row.id), ["A1", "B1", "S1"], "content-only tests and tagged lines are skipped");
});

test("a mechanism's verdict counts a translated test once, and reports clicks beside opens", () => {
  const tags = {};
  const tests = [];
  // One test run in five markets: the offer line loses on opens everywhere but wins on clicks.
  ["DK", "UK", "DE", "NL", "EU"].forEach((country, index) => {
    tags[`o${index}`] = { m: ["tilbud"] };
    tags[`v${index}`] = { m: ["konkret_vaerdi"] };
    tests.push(abTest({
      campaignId: `F1-${country}`,
      familyKey: "w47 black week",
      country,
      arms: [{ id: `o${index}`, subject: "-20%", openRate: 0.5, clickRate: 0.03 }, { id: `v${index}`, subject: "Æsker", openRate: 0.6, clickRate: 0.01 }]
    }));
  });
  // A wording test with the same mechanism on both arms says nothing about mechanisms.
  tags.w1 = { m: ["tilbud"] };
  tags.w2 = { m: ["tilbud"] };
  tests.push(abTest({ campaignId: "C9", familyKey: "w9", arms: [{ id: "w1", subject: "-10%", openRate: 0.5 }, { id: "w2", subject: "Spar 10%", openRate: 0.7 }] }));

  const evidence = buildMechanismEvidence({ abTests: tests, tags });
  assert.equal(evidence.headToHeads, 5);
  const offer = evidence.byMechanism.find((item) => item.mechanism === "tilbud");
  assert.deepEqual([offer.wins, offer.headToHeads, offer.clickWins], [0, 5, 5]);
  assert.deepEqual([offer.familyWins, offer.familyTests], [0, 1], "five markets, one experiment");
  assert.equal(offer.signal, "unclear", "one distinct test is never a verdict");
});

test("a consistent record across distinct tests is called, and a coin flip is not", () => {
  const tags = {};
  const tests = [];
  for (let index = 0; index < 12; index += 1) {
    tags[`o${index}`] = { m: ["tilbud"] };
    tags[`v${index}`] = { m: ["konkret_vaerdi"] };
    const offerWins = index === 0;
    tests.push(abTest({
      campaignId: `C${index}`,
      familyKey: `family ${index}`,
      verdict: index < 3 ? "klar" : "uafgjort",
      arms: [{ id: `o${index}`, subject: "Rabat", openRate: offerWins ? 0.6 : 0.5 }, { id: `v${index}`, subject: "Værdi", openRate: offerWins ? 0.5 : 0.6 }]
    }));
  }
  const evidence = buildMechanismEvidence({ abTests: tests, tags });
  const offer = evidence.byMechanism.find((item) => item.mechanism === "tilbud");
  const value = evidence.byMechanism.find((item) => item.mechanism === "konkret_vaerdi");
  assert.equal(offer.signal, "loses");
  assert.equal(value.signal, "wins");
  assert.deepEqual(evidence.pairs[0], { a: "konkret_vaerdi", b: "tilbud", aWins: 11, bWins: 1 });
});

test("DK sends by mechanism need ten indexed sends before a median is shown", () => {
  const tags = {};
  const dkEntries = Array.from({ length: 12 }, (_, index) => {
    tags[`s${index}`] = { m: [index < 10 ? "nyhed" : "humor"] };
    return { id: `s${index}`, received: 800, openIndex: 1 + index / 100, clickIndex: 1 };
  });
  const evidence = buildMechanismEvidence({ abTests: [], dkEntries, tags });
  assert.deepEqual(evidence.dkIndex.map((item) => item.mechanism), ["nyhed"]);
  assert.equal(evidence.coverage.taggedDk, 12);
});

test("a recorded line is paired with its send, exactly or as edited, inside the window", () => {
  const used = [
    { subject: "Fire æsker. Én titel.", mechanism: "kontrast", templateId: "T1", kind: "copy", at: "2026-10-27T10:00:00Z" },
    { subject: "Fire æsker. Én titel.", mechanism: "kontrast", templateId: "T1", kind: "use", at: "2026-10-27T11:00:00Z" },
    { subject: "Nu går juletravlheden gennem lageret", mechanism: "oejeblik", templateId: "T2", kind: "save", at: "2026-10-27T10:00:00Z" },
    { subject: "Sendt for længe siden", mechanism: "nyhed", templateId: "T3", kind: "copy", at: "2026-06-01T10:00:00Z" }
  ];
  const dkEntries = [
    { subject: "Fire æsker. Én titel.", sentAt: "2026-11-02T10:00:00Z", openIndex: 1.1, clickIndex: 0.9, received: 800 },
    { subject: "Nu går juletravlheden gennem hele lageret 🎄", sentAt: "2026-10-30T10:00:00Z", openIndex: 0.95, clickIndex: 1.2, received: 800 },
    { subject: "Sendt for længe siden", sentAt: "2026-10-01T10:00:00Z", openIndex: 1, clickIndex: 1, received: 800 }
  ];
  const outcomes = buildGeneratorOutcomes({ used, dkEntries });
  assert.equal(outcomes.recorded, 3, "copying and then using the same line is one decision");
  assert.equal(outcomes.sent, 2);
  const byTemplate = Object.fromEntries(outcomes.rows.map((row) => [row.subject, row.sent]));
  assert.equal(byTemplate["Fire æsker. Én titel."].match, "exact");
  assert.equal(byTemplate["Nu går juletravlheden gennem lageret"].match, "near", "a word added before sending");
  // An emoji alone does not change the words, so it is still the line as written.
  assert.equal(buildGeneratorOutcomes({ used: [used[0]], dkEntries: [{ ...dkEntries[0], subject: "Fire æsker. Én titel. 🏆" }] }).rows[0].sent.match, "exact");
  assert.equal(byTemplate["Sendt for længe siden"], null, "sent four months later is not the same decision");
  assert.equal(outcomes.medianOpenIndex, 1.025);
});
