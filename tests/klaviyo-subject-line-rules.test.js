const test = require("node:test");
const assert = require("node:assert/strict");
const { checkSubjectLine, numbersMissingFromEmail, describeRules, buildRulesPromptBlock } = require("../server/klaviyo/subject-line-rules");

// Layer 3 of the subject line generator. The model is told these rules and still breaks them now
// and then; this check is what makes "never" true, so each standing correction gets a case.

function ruleIds(result) {
  return result.issues.map((issue) => `${issue.ruleId}:${issue.severity}`);
}

test("Danish words are matched whole, including the ones that start or end in æ, ø or å", () => {
  // JavaScript's \b treats æ/ø/å as non-letters; /\bmiljø\b/ would never match "miljø".
  for (const subject of ["Miljø i fokus", "Økologisk emballage", "Bæredygtige æsker til jul", "Lavet af genbrugsplast", "FSC-certificeret karton"]) {
    assert.equal(checkSubjectLine({ subject, preview: "Se dem her i dag" }).status, "block", subject);
  }
  // A word that merely contains the letters is not a claim.
  assert.equal(checkSubjectLine({ subject: "Mørkegrønne gaveæsker til jul", preview: "Ny farve på hylden" }).issues.some((issue) => issue.ruleId === "eco_claim"), false);
});

test("an ECO series name warns rather than blocks: it is a product name, but reads as a claim", () => {
  const result = checkSubjectLine({ subject: "Komplet ECO oplevelse", preview: "Se hele serien her" });
  assert.deepEqual(ruleIds(result).filter((id) => id.startsWith("eco_claim")), ["eco_claim:warn"]);
});

test("delivery is never promised, but production time may be named as production time", () => {
  for (const subject of ["Levering på 3 dage", "Klar hos dig før jul", "Så når de frem inden jul", "Få æskerne inden weekenden", "Delivered within a week"]) {
    assert.equal(checkSubjectLine({ subject, preview: "Bestil i dag" }).issues.some((issue) => issue.ruleId === "delivery_promise"), true, subject);
  }
  const production = checkSubjectLine({ subject: "Produceret på 7-8 arbejdsdage", preview: "Med dit logo i folietryk" });
  assert.equal(production.issues.some((issue) => issue.ruleId === "delivery_promise"), false);
});

test("a dated order deadline blocks, because one Danish master goes to about fifteen markets", () => {
  assert.equal(checkSubjectLine({ subject: "Bestil før 10. december", preview: "Fristerne nærmer sig" }).status, "block");
  const dateOnly = checkSubjectLine({ subject: "Vinderen kåres 9. november", preview: "Følg med på Instagram" });
  assert.deepEqual(ruleIds(dateOnly).filter((id) => id.startsWith("single_date")), ["single_date:warn"]);
  // A vote closes on the same day in every market; only ordering deadlines differ.
  const voteClosing = checkSubjectLine({ subject: "Stem senest 9. november", preview: "Vinderen afsløres samme dag på Instagram" });
  assert.deepEqual(ruleIds(voteClosing).filter((id) => id.startsWith("single_date")), ["single_date:warn"]);
  assert.equal(checkSubjectLine({ subject: "Sidste frist 16. december", preview: "Bestil i god tid" }).status, "block");
});

test("samples are not free, a 4.6 TrustScore is not five stars, and there are no watch boxes", () => {
  assert.equal(checkSubjectLine({ subject: "Gratis prøver til din butik", preview: "Bestil i dag" }).status, "block");
  assert.equal(checkSubjectLine({ subject: "5 stjerner fra kunderne", preview: "Se hvorfor" }).status, "block");
  assert.equal(checkSubjectLine({ subject: "Nye uræsker på lager", preview: "Se dem her" }).status, "block");
  assert.equal(checkSubjectLine({ subject: "Re: din ordre", preview: "Hej igen" }).status, "block");
});

test("a number in the line must be a whole number in the email, not a digit inside another", () => {
  const email = "W45 Gaveæske Grand Prix. Fire finalister. Få 20% rabat på udvalgte smykkeæsker i 2025-kollektionen.";
  assert.deepEqual(numbersMissingFromEmail("Din stemme tager 5 sekunder", email), ["5"]);
  assert.deepEqual(numbersMissingFromEmail("-30% på smykkeæsker", email), ["-30%"]);
  assert.deepEqual(numbersMissingFromEmail("20% på udvalgte æsker", email), []);
  const result = checkSubjectLine({ subject: "-30% på alle smykkeæsker", preview: "Kun denne uge", emailText: email });
  assert.ok(result.issues.some((issue) => issue.ruleId === "claim_not_in_email"));
});

test("Westpack's own recent subject lines pass without a blocking rule", () => {
  const sent = [
    ["Kan smykkeæsker have personlighed? Døm selv 👀", "Vi har givet fire smykkeæsker en personlighedstest."],
    ["Det dyreste i december? TID. ⏰", "Anna har tape i håret. Det hedder Bob nu."],
    ["Ordrehistorikken lyver ikke 👀", "Der er en grund til, at kunderne bestiller dem igen og igen."],
    ["En ko. En bille. En and med hat. 🦆", "Tre dyr. Én hat. Hvad mon de har til fælles?"],
    ["Sælg 4 smykker – i én æske! 🎄", "Adventskalenderen, der sælger sig selv."]
  ];
  for (const [subject, preview] of sent) {
    assert.notEqual(checkSubjectLine({ subject, preview }).status, "block", subject);
  }
});

test("shouting, a repeated preheader and a missing preheader are warnings", () => {
  assert.ok(ruleIds(checkSubjectLine({ subject: "🎄Juletilbud 🎄 Op til 50% rabat 🎄", preview: "Se tilbuddene" })).includes("shouting:warn"));
  assert.ok(ruleIds(checkSubjectLine({ subject: "NYHEDER til din butik", preview: "Se dem" })).includes("shouting:warn"));
  assert.ok(ruleIds(checkSubjectLine({ subject: "Nye smykkeæsker", preview: "Nye smykkeæsker" })).includes("preview_adds:warn"));
  assert.ok(ruleIds(checkSubjectLine({ subject: "Nye smykkeæsker", preview: "" })).includes("preview_adds:warn"));
  // A known acronym is not shouting.
  assert.equal(ruleIds(checkSubjectLine({ subject: "Bliv WTP-forhandler", preview: "Sådan kommer du i gang" })).includes("shouting:warn"), false);
});

test("the rules are described once and written into the prompt from the same list", () => {
  const rules = describeRules();
  assert.ok(rules.length >= 12);
  const prompt = buildRulesPromptBlock();
  for (const rule of rules) assert.ok(prompt.includes(rule.description), rule.id);
  assert.ok(rules.some((rule) => rule.severity === "block") && rules.some((rule) => rule.severity === "warn"));
});
