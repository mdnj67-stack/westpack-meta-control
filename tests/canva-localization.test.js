const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyExclusionMemory,
  assessFieldFit,
  assessTargetFit,
  buildFieldPlan,
  buildLocalizedTitle,
  createLocalizationJob,
  groupMarketsByLanguage,
  isFieldPlanReady,
  listSupportedMarkets,
  normalizeLocalizationJob,
  rememberExclusions,
  resolveCharacterBudget,
  resolveJobState,
  selectTargetsForGeneration,
  selectTargetsForTranslation,
  summariseFieldPlan,
  summariseLocalizationJob
} = require("../server/canva/localization");

const { chooseVariant } = require("../server/canva/translate-fields");

test("markets that share a language are translated once, not once per market", () => {
  const groups = groupMarketsByLanguage(["UK", "US", "EU", "DE", "FR"]);
  const english = groups.find((group) => group.languageGroup === "en");

  assert.ok(english, "UK, US and EU should collapse into one English group");
  assert.deepEqual(english.markets.sort(), ["EU", "UK", "US"]);
  assert.equal(groups.length, 3, "English, German and French - three translations for five markets");
});

test("unknown and duplicate market codes never produce a target", () => {
  const markets = listSupportedMarkets(["DE", "de", "  fr ", "ZZ", ""]);
  assert.deepEqual(markets.map((market) => market.marketCode), ["DE", "FR", "ZZ"]);
  // An unknown code still resolves to something usable rather than throwing, but it is flagged.
  assert.equal(markets.find((market) => market.marketCode === "ZZ").known, false);
  assert.equal(markets.find((market) => market.marketCode === "DE").known, true);
});

test("short strings get absolute headroom, long strings get proportional headroom", () => {
  // "Shop now" to "Jetzt kaufen" is +50% and completely fine in a button. A percentage-only
  // budget would flag it, and then every real overflow would be lost in the noise.
  assert.equal(resolveCharacterBudget("Shop now"), 12);
  assert.equal(resolveCharacterBudget("New jewellery boxes for the autumn range"), 44);
  assert.equal(resolveCharacterBudget(""), 0);
});

test("fit is graded, not binary, so a survivable overshoot is not reported as a failure", () => {
  const source = "New jewellery boxes";
  const budget = resolveCharacterBudget(source);

  assert.equal(assessFieldFit({ sourceText: source, translatedText: "Neue Schmuckboxen", budget }).status, "fits");
  assert.equal(assessFieldFit({ sourceText: source, translatedText: "Neue Schmuckverpackungen", budget }).status, "tight");
  assert.equal(
    assessFieldFit({ sourceText: source, translatedText: "Neue Schmuckverpackungen fuer den Herbst", budget }).status,
    "over"
  );
  assert.equal(assessFieldFit({ sourceText: source, translatedText: "", budget }).status, "empty");
});

test("a target reports its worst field, so one broken headline is not hidden by four clean lines", () => {
  const fit = assessTargetFit([
    { key: "sub", status: "fits" },
    { key: "cta", status: "tight" },
    { key: "headline", status: "over" },
    { key: "kicker", status: "fits" }
  ]);

  assert.equal(fit.status, "over");
  assert.equal(fit.worstField, "headline");
  assert.equal(fit.tight, 1);
  assert.equal(fit.over, 1);
});

test("generated designs are named per market and a market suffix is never doubled", () => {
  assert.equal(buildLocalizedTitle("Autumn launch", "DE"), "Autumn launch_DE");
  // Re-running a job against an already generated design must not produce campaign_DE_FR.
  assert.equal(buildLocalizedTitle("Autumn launch_DE", "FR"), "Autumn launch_FR");
  assert.equal(buildLocalizedTitle("", "DK"), "Untitled design_DK");
  assert.ok(buildLocalizedTitle("x".repeat(400), "PL").length <= 255);
});

test("only text fields are translatable and non-text fields are marked, not silently dropped", () => {
  const fields = buildFieldPlan({
    dataset: { headline: { type: "text" }, hero: { type: "image" }, cta: { type: "text" } },
    sourceTexts: { headline: "New jewellery boxes", cta: "Shop now" }
  });

  assert.equal(fields.length, 3);
  assert.equal(fields.find((field) => field.key === "hero").translate, false);
  assert.equal(fields.find((field) => field.key === "hero").excludedBy, "not_text");
  assert.equal(fields.find((field) => field.key === "headline").budget, resolveCharacterBudget("New jewellery boxes"));

  const summary = summariseFieldPlan(fields);
  assert.equal(summary.translatable, 2);
  assert.equal(summary.nonText, 1);
  assert.equal(summary.missingSourceText, 0);
  assert.equal(isFieldPlanReady(fields), true);
});

test("a plan with a translatable field but no source text is not ready", () => {
  const fields = buildFieldPlan({
    dataset: { headline: { type: "text" } },
    sourceTexts: {}
  });
  assert.equal(summariseFieldPlan(fields).missingSourceText, 1);
  assert.equal(isFieldPlanReady(fields), false);
});

test("exclusions are remembered by field name and by short phrase, and applied next time", () => {
  const fields = [
    { key: "brand", type: "text", sourceText: "Westpack", translate: false },
    { key: "headline", type: "text", sourceText: "New jewellery boxes", translate: true },
    { key: "legal", type: "text", sourceText: "x".repeat(60), translate: false }
  ];

  const memory = rememberExclusions({}, fields);
  assert.ok(memory.fieldKeys.includes("brand"));
  assert.ok(memory.phrases.includes("westpack"));
  // A 60-character paragraph would never match again; remembering it is noise.
  assert.equal(memory.phrases.some((phrase) => phrase.length > 40), false);

  const nextPlan = applyExclusionMemory([
    { key: "brand", type: "text", sourceText: "Something else", translate: true },
    { key: "tagline", type: "text", sourceText: "WESTPACK", translate: true },
    { key: "headline", type: "text", sourceText: "New carrier bags", translate: true }
  ], memory);

  assert.equal(nextPlan.find((field) => field.key === "brand").translate, false);
  assert.equal(nextPlan.find((field) => field.key === "brand").excludedBy, "field_name");
  assert.equal(nextPlan.find((field) => field.key === "tagline").translate, false);
  assert.equal(nextPlan.find((field) => field.key === "tagline").excludedBy, "phrase");
  assert.equal(nextPlan.find((field) => field.key === "headline").translate, true);
});

test("a batch of eighteen is never reported as a single pass or fail", () => {
  const job = createLocalizationJob({ id: "job1", sourceDesignId: "DA1", marketCodes: ["DE", "FR", "IT"] });
  assert.equal(job.state, "draft");

  const partly = normalizeLocalizationJob({
    ...job,
    targets: [
      { ...job.targets[0], state: "generated" },
      { ...job.targets[1], state: "generated" },
      { ...job.targets[2], state: "failed" }
    ]
  });
  assert.equal(partly.state, "partial", "two live in Canva and one failed is partial, not failed");

  const all = normalizeLocalizationJob({
    ...job,
    targets: job.targets.map((target) => ({ ...target, state: "generated" }))
  });
  assert.equal(all.state, "complete");

  const none = normalizeLocalizationJob({
    ...job,
    targets: job.targets.map((target) => ({ ...target, state: "failed" }))
  });
  assert.equal(none.state, "failed");
});

test("skipped markets do not count towards the job's state or its totals", () => {
  const job = normalizeLocalizationJob({
    id: "job2",
    sourceDesignId: "DA1",
    targets: [
      { marketCode: "DE", state: "generated" },
      { marketCode: "FR", state: "generated" },
      { marketCode: "IT", state: "skipped" }
    ]
  });

  assert.equal(resolveJobState(job), "complete");
  const summary = summariseLocalizationJob(job);
  assert.equal(summary.total, 2);
  assert.equal(summary.skipped, 1);
});

test("a retry never regenerates a design that already exists in Canva", () => {
  const job = normalizeLocalizationJob({
    id: "job3",
    sourceDesignId: "DA1",
    targets: [
      { marketCode: "DE", state: "generated", translatedFields: { headline: "Neu" } },
      { marketCode: "FR", state: "translated", translatedFields: { headline: "Nouveau" } },
      { marketCode: "IT", state: "failed", translatedFields: { headline: "Nuovo" } },
      { marketCode: "PL", state: "pending" }
    ]
  });

  const toGenerate = selectTargetsForGeneration(job).map((target) => target.marketCode);
  assert.deepEqual(toGenerate.sort(), ["FR", "IT"], "the generated one is left alone; the untranslated one has nothing to send");

  const regenerated = selectTargetsForGeneration(job, { regenerate: true }).map((target) => target.marketCode);
  assert.ok(regenerated.includes("DE"), "an explicit regenerate may touch it");

  const toTranslate = selectTargetsForTranslation(job).map((target) => target.marketCode);
  assert.deepEqual(toTranslate.sort(), ["IT", "PL"], "translated targets are left alone unless asked for again");

  const retranslate = selectTargetsForTranslation(job, { includeTranslated: true }).map((target) => target.marketCode);
  assert.ok(retranslate.includes("FR"));
  assert.equal(retranslate.includes("DE"), false, "a generated target is never silently retranslated");
});

test("a job carries its needs-review count, because a generated batch is not automatically a good one", () => {
  const job = normalizeLocalizationJob({
    id: "job4",
    sourceDesignId: "DA1",
    targets: [
      { marketCode: "DE", state: "generated", fit: { status: "fits" } },
      { marketCode: "PL", state: "generated", fit: { status: "over", worstField: "headline" } },
      { marketCode: "FR", state: "generated", fit: { status: "tight", worstField: "cta" } }
    ]
  });

  assert.equal(summariseLocalizationJob(job).needsReview, 2);
});

test("the compact alternative is used only when it is genuinely shorter and not empty", () => {
  const field = { key: "headline", sourceText: "New jewellery boxes", budget: resolveCharacterBudget("New jewellery boxes") };

  const fitsAlready = chooseVariant({ field, candidate: { text: "Neue Schmuckboxen", compact: "Boxen" } });
  assert.equal(fitsAlready.text, "Neue Schmuckboxen", "a translation that fits is never swapped for a terser one");
  assert.equal(fitsAlready.usedCompact, false);

  const tooLong = chooseVariant({
    field,
    candidate: { text: "Neue Schmuckverpackungen fuer den Herbst", compact: "Neue Schmuckboxen" }
  });
  assert.equal(tooLong.text, "Neue Schmuckboxen");
  assert.equal(tooLong.usedCompact, true);

  // An empty `compact` must never be allowed to blank a headline.
  const emptyCompact = chooseVariant({
    field,
    candidate: { text: "Neue Schmuckverpackungen fuer den Herbst", compact: "" }
  });
  assert.equal(emptyCompact.text, "Neue Schmuckverpackungen fuer den Herbst");
  assert.equal(emptyCompact.usedCompact, false);
});
