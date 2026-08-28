const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildChannelArtifactSchema,
  buildChannelRevisionPrompt,
  buildConceptSelectionSchema,
  buildCreativeDirectionSchema,
  evaluateConceptSelectionQuality,
  evaluateCreativeDirectionDiversity,
  normalizeConceptSelection,
  selectRevisionChannel
} = require("../server/campaign/creative-production");

test("creative production requires three real routes and one locked contract", () => {
  const routes = buildCreativeDirectionSchema();
  const selection = buildConceptSelectionSchema();
  assert.equal(routes.properties.directions.minItems, 3);
  assert.equal(routes.properties.directions.maxItems, 3);
  assert.deepEqual(routes.properties.directions.items.properties.id.enum, ["route_a", "route_b", "route_c"]);
  assert.ok(selection.properties.creativeContract.required.includes("channelRoles"));
  assert.ok(selection.properties.creativeContract.required.includes("nonNegotiables"));
  assert.ok(selection.properties.creativeContract.required.includes("singleMindedProposition"));
  assert.ok(selection.properties.creativeContract.required.includes("strategicEnemy"));
  assert.ok(selection.properties.creativeContract.required.includes("memorabilityDevice"));
  assert.ok(selection.properties.creativeContract.required.includes("referenceTranslation"));
  assert.ok(selection.properties.creativeContract.required.includes("antiGenericRules"));
  assert.ok(selection.properties.creativeContract.required.includes("messageSystem"));
  assert.equal(selection.properties.creativeContract.properties.messageSystem.properties.proofAnchors.minItems, 2);
  const normalized = normalizeConceptSelection({ selectedId: "route_b", creativeContract: {} }, {
    directions: [{ id: "route_a" }, { id: "route_b", name: "Winner" }, { id: "route_c" }]
  });
  assert.equal(normalized.selectedDirection.name, "Winner");
});

test("route diversity gate rejects three cosmetic versions of one idea", () => {
  const route = (id, suffix = "") => ({
    id,
    bigIdea: `Elevate your premium presentation ${suffix}`,
    audienceTension: `Retailers want premium presentation ${suffix}`,
    commercialPromise: "Premium presentation creates a stronger impression",
    visualSystem: "Premium product imagery with clean typography",
    ownableDevice: `Elevate the experience ${suffix}`
  });
  const weak = evaluateCreativeDirectionDiversity({ directions: [route("route_a", "today"), route("route_b", "now"), route("route_c", "together")] });
  assert.equal(weak.passed, false);
  assert.ok(weak.failures.some((failure) => /similar|generic/.test(failure)));

  const strong = evaluateCreativeDirectionDiversity({ directions: [
    { id: "route_a", bigIdea: "The silent salesperson", audienceTension: "Value is judged before staff can explain it", commercialPromise: "Let presentation begin the sales conversation", visualSystem: "Sequential retail display close-ups", ownableDevice: "Speechless product cards" },
    { id: "route_b", bigIdea: "A place worth crossing the street for", audienceTension: "Independent shops compete for physical attention", commercialPromise: "Turn the window into a reason to enter", visualSystem: "Exterior-to-detail cinematic crops", ownableDevice: "The threshold sequence" },
    { id: "route_c", bigIdea: "Curiosity has a choreography", audienceTension: "Dense assortments make exploration harder", commercialPromise: "Guide attention without reducing choice", visualSystem: "Ordered modular compositions and negative space", ownableDevice: "The eye-path line" }
  ] });
  assert.equal(strong.passed, true);
  assert.ok(strong.maximumSimilarity < .58);
});

test("pre-production concept gate rejects polished but generic routes", () => {
  const weak = evaluateConceptSelectionQuality({
    selectedId: "route_a",
    candidateScores: [{ id: "route_a", briefFit: 90, distinctiveness: 70, evidenceStrength: 82, visualPotential: 88, channelPotential: 90, risk: 20 }],
    creativeContract: {
      bigIdea: "Premium solutions for every business",
      singleMindedProposition: "Stand out with quality",
      audienceTension: "Customers want quality",
      strategicEnemy: "Ordinary solutions",
      promise: "Elevate your business",
      memorabilityDevice: "Premium quality",
      reasonToBelieve: ["Quality", "Service"],
      referenceTranslation: ["Use editorial pacing", "Use image rhythm"],
      antiGenericRules: ["Avoid vague value", "No adjective-led headlines", "Every module needs proof"],
      proofSequence: ["Quality", "Service"]
    }
  });
  assert.equal(weak.passed, false);
  assert.ok(weak.failures.some((failure) => failure.includes("distinctiveness")));

  const strong = evaluateConceptSelectionQuality({
    selectedId: "route_b",
    candidateScores: [{ id: "route_b", briefFit: 91, distinctiveness: 88, evidenceStrength: 85, visualPotential: 90, channelPotential: 87, risk: 28 }],
    creativeContract: {
      bigIdea: "The display becomes the silent salesperson",
      singleMindedProposition: "Make presentation carry the first sales conversation",
      audienceTension: "Independent retailers need to signal value before staff can explain it",
      strategicEnemy: "A product display that leaves perceived value unexplained",
      promise: "Turn presentation into a visible reason to enter and explore",
      memorabilityDevice: "The silent salesperson visual motif",
      reasonToBelieve: ["Visible modular display system", "Supplied retailer assortment imagery"],
      referenceTranslation: ["Adapt the reference email's copy-image alternation into a quieter retail sequence", "Use its single dominant CTA rhythm after the proof modules"],
      antiGenericRules: ["Every headline must describe a visible retail consequence", "No unsupported premium adjectives", "Each channel must perform a different persuasion job"],
      proofSequence: ["Unnoticed display", "Designed presentation", "Retail interaction"],
      messageSystem: {
        signatureThought: "Presentation starts the sales conversation before staff do",
        openingTension: "Customers judge value before anyone has explained the assortment",
        proofAnchors: ["The supplied imagery shows a modular display system", "The assortment can be organised through visible hierarchy"],
        languageToOwn: ["first conversation", "visible value", "guided attention"],
        languageToAvoid: ["premium solution", "stand out", "elevate your business"]
      }
    }
  });
  assert.equal(strong.passed, true);
});

test("channel specialists receive only their own strict artifact schema", () => {
  const email = buildChannelArtifactSchema("email");
  const meta = buildChannelArtifactSchema("meta");
  assert.deepEqual(email.required, ["email", "productionNotes"]);
  assert.equal(email.properties.meta, undefined);
  assert.equal(meta.properties.email, undefined);
  assert.equal(meta.properties.meta.properties.carouselConcepts.minItems, 2);
});

test("revision routing targets the weakest channel and explicitly locks the others", () => {
  const review = {
    strengths: ["Strong email hierarchy"],
    dimensions: [
      { key: "email_quality", score: 88 },
      { key: "meta_quality", score: 61 },
      { key: "cross_channel_coherence", score: 79 }
    ],
    revisionBrief: { mustFix: ["Repair the carousel"], preserve: ["Email"], email: [], meta: ["Sharpen the hook"], blog: [] }
  };
  assert.equal(selectRevisionChannel(review), "meta");
  const prompt = buildChannelRevisionPrompt({
    channel: "meta",
    input: {},
    plan: {},
    conceptSelection: { creativeContract: { bigIdea: "One idea" } },
    currentArtifact: {},
    qualityReview: review,
    revisionNumber: 1
  });
  const text = prompt.flatMap((message) => message.content).map((item) => item.text).join(" ");
  assert.match(text, /other channels are locked/i);
  assert.match(text, /surgical repair/i);
});

test("revision routing prioritises an untouched channel with a critical failure", () => {
  const review = {
    criticalFailures: ["The blog is text-only and the landing experience omits the mandatory photographic sequence."],
    dimensions: [
      { key: "email_quality", score: 78 },
      { key: "meta_quality", score: 86 },
      { key: "blog_quality", score: 82 }
    ],
    revisionBrief: {
      email: ["Tighten the close."],
      meta: [],
      blog: ["Embed the approved detail-to-format-to-family image progression."]
    }
  };
  assert.equal(selectRevisionChannel(review, ["email"]), "blog");
});

test("revision routing does not spend every repair on one repeatedly failing channel", () => {
  const review = {
    criticalFailures: ["The compiled email misses its contour and the blog contains internal QA language."],
    dimensions: [
      { key: "email_quality", score: 70 },
      { key: "meta_quality", score: 86 },
      { key: "blog_quality", score: 77 }
    ],
    revisionBrief: { email: ["Fix contour."], meta: [], blog: ["Remove QA language."] }
  };
  assert.equal(selectRevisionChannel(review, ["email", "email", "email"]), "blog");
});

test("concept and quality contracts cannot contradict executable channel formats", () => {
  const { buildConceptSelectionPrompt } = require("../server/campaign/creative-production");
  const { buildQualityReviewPrompt } = require("../server/campaign/quality-agent");
  const selectionText = buildConceptSelectionPrompt({ input: {}, plan: {}, directions: {} })
    .flatMap((message) => message.content).map((item) => item.text).join(" ");
  const qualityText = buildQualityReviewPrompt({ input: {}, plan: {}, artifactPack: {}, deterministicAudit: {} })
    .flatMap((message) => message.content).map((item) => item.text).join(" ");
  for (const text of [selectionText, qualityText]) {
    assert.match(text, /exactly two distinct carousels/i);
    assert.match(text, /3-6 cards|between 3 and 6 cards/i);
    assert.match(text, /one primary closing CTA/i);
    assert.match(text, /UK English/i);
  }
});
