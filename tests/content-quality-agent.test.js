const test = require("node:test");
const assert = require("node:assert/strict");
const {
  QUALITY_DIMENSIONS,
  QUALITY_DIMENSION_FLOOR,
  QUALITY_MAX_REVISIONS,
  QUALITY_PASS_SCORE,
  QUALITY_REVIEW_DIMENSION_FLOOR,
  QUALITY_REVIEW_SCORE,
  QUALITY_VETO_FLOORS,
  buildContentCraftEvidence,
  buildQualityReviewSchema,
  buildRenderedArtifactEvidence,
  decideQualityNextStep,
  evaluateQualityGate,
  hasQualityStagnated,
  normalizeQualityReview
} = require("../server/campaign/quality-agent");
const { buildCampaignArtifactSchema } = require("../server/campaign/brain");
const {
  buildQualityAudit,
  buildRefreshedAssetUrlMap,
  collectAssignedArtifactUrls,
  evaluateSourceReadiness,
  remapAssetUrls
} = require("../server/campaign/content-agent-worker");
const { renderPremiumCampaignEmail } = require("../server/campaign/email-design");
const { EMAIL_MODULE_SYSTEM_VERSION, WESTPACK_EMAIL_MASTER } = require("../server/campaign/email-module-library");

function buildReview(overrides = {}) {
  return normalizeQualityReview({
    verdict: "PASS",
    overallScore: 94,
    confidence: "high",
    summary: "Strong campaign.",
    criticalFailures: [],
    strengths: ["Specific", "Designed"],
    excellenceEvidence: ["Ownable campaign idea", "Purposeful image choreography", "Channel-specific execution"],
    dimensions: QUALITY_DIMENSIONS.map((key) => ({
      key,
      score: 92,
      assessment: "Strong.",
      evidence: ["Concrete evidence"],
      improvements: []
    })),
    revisionBrief: {
      objective: "Preserve quality.",
      rootCauses: ["No unresolved root cause."],
      mustFix: [],
      acceptanceCriteria: ["Maintain the calibrated quality bar."],
      preserve: ["Hierarchy"],
      email: [],
      meta: [],
      blog: [],
      expectedImprovement: "None required."
    },
    ...overrides
  }, "quality-model");
}

test("source preflight blocks empty and video-only campaign inputs before generation", () => {
  const deadline = evaluateSourceReadiness({
    title: "W37 Logotryk-deadline",
    objective: "Logotryk deadline",
    source: { body: "", notes: "" }
  }, []);
  assert.equal(deadline.passed, false);
  assert.deepEqual(deadline.missing, ["campaign_facts", "approved_static_images", "verified_deadline"]);

  const videoOnly = evaluateSourceReadiness({
    title: "Start til slut guide",
    objective: "Explain the complete logo print process for Christmas packaging.",
    source: { body: "A detailed editorial brief with enough process information to support a useful campaign without inventing operational claims or customer promises.", notes: "" }
  }, []);
  assert.equal(videoOnly.passed, false);
  assert.deepEqual(videoOnly.missing, ["approved_static_images"]);
});

test("source preflight admits an image-led campaign even when structured Asana fields are sparse", () => {
  const readiness = evaluateSourceReadiness({
    title: "W34 Bliv WTP forhandler",
    objective: "W34 Bliv WTP forhandler",
    source: { body: "Short visual brief.", notes: "" }
  }, [
    "https://cdn.example.com/one.jpg",
    "https://cdn.example.com/two.jpg",
    "https://cdn.example.com/three.jpg"
  ]);
  assert.equal(readiness.passed, true);
  assert.deepEqual(readiness.missing, []);
});

test("quality gate passes only a high-scoring complete independent review", () => {
  const review = buildReview();
  const gate = evaluateQualityGate(review, { verdict: "ready" });
  assert.equal(QUALITY_PASS_SCORE, 87);
  assert.equal(QUALITY_DIMENSION_FLOOR, 78);
  assert.equal(QUALITY_MAX_REVISIONS, 5);
  assert.equal(QUALITY_REVIEW_SCORE, 82);
  assert.equal(QUALITY_REVIEW_DIMENSION_FLOOR, 75);
  assert.equal(gate.passed, true);
  assert.equal(gate.dimensionFloor, 92);
  assert.equal(gate.score, 92);
  assert.equal(gate.confidencePassed, true);
  assert.deepEqual(gate.vetoFailures, []);
  assert.equal(review.model, "quality-model");
  assert.equal(buildQualityReviewSchema().properties.dimensions.minItems, QUALITY_DIMENSIONS.length);
  assert.equal(buildQualityReviewSchema().properties.dimensions.items.properties.evidence.minItems, 2);
  assert.equal(buildCampaignArtifactSchema().properties.meta.properties.carouselConcepts.minItems, 2);
  assert.equal(buildCampaignArtifactSchema().properties.meta.properties.carouselConcepts.maxItems, 2);
  assert.equal(buildCampaignArtifactSchema().properties.meta.properties.variants.minItems, 2);
  assert.equal(buildCampaignArtifactSchema().properties.meta.properties.variants.maxItems, 2);
  assert.equal(buildCampaignArtifactSchema().properties.meta.properties.carouselConcepts.items.properties.cards.minItems, 3);
  assert.equal(buildCampaignArtifactSchema().properties.meta.properties.carouselConcepts.items.properties.cards.maxItems, 6);
  assert.equal(buildCampaignArtifactSchema().properties.email.properties.sections.maxItems, 4);
  assert.deepEqual(buildCampaignArtifactSchema().properties.email.properties.heroLayout.enum, ["copy_first", "image_first", "typographic"]);
  assert.ok(buildCampaignArtifactSchema().properties.email.properties.sections.items.required.includes("layout"));
  assert.ok(buildCampaignArtifactSchema().properties.email.properties.sections.items.required.includes("moduleId"));
  assert.equal(buildCampaignArtifactSchema().properties.email.properties.sections.items.properties.moduleId.enum.length, 10);
  assert.ok(buildCampaignArtifactSchema().properties.email.properties.sections.items.required.includes("imageUrl"));
});

test("quality gate rejects low dimensions, critical failures and deterministic failures", () => {
  const weakDimensions = QUALITY_DIMENSIONS.map((key, index) => ({
    key,
    score: index === 0 ? 74 : 96,
    assessment: "Assessment.",
    evidence: ["Evidence"],
    improvements: []
  }));
  assert.equal(evaluateQualityGate(buildReview({ dimensions: weakDimensions }), { verdict: "ready" }).passed, false);
  assert.equal(evaluateQualityGate(buildReview({ criticalFailures: ["Invented claim"] }), { verdict: "ready" }).passed, false);
  assert.equal(evaluateQualityGate(buildReview(), { verdict: "needs_review" }).passed, false);
  assert.equal(evaluateQualityGate(buildReview({ confidence: "medium", overallScore: QUALITY_PASS_SCORE }), { verdict: "ready" }).passed, false);
  assert.equal(evaluateQualityGate(buildReview({ confidence: "medium" }), { verdict: "ready" }).passed, true);
  assert.equal(evaluateQualityGate(buildReview({ excellenceEvidence: ["Only one"] }), { verdict: "ready" }).passed, false);
});

test("reported scores are calibrated and hard craft vetoes cannot be averaged away", () => {
  const inflated = buildReview({
    overallScore: 99,
    dimensions: QUALITY_DIMENSIONS.map((key) => ({ key, score: 89, assessment: "Good, not exceptional.", evidence: ["Evidence"], improvements: [] }))
  });
  const inflatedGate = evaluateQualityGate(inflated, { verdict: "ready" });
  assert.equal(inflatedGate.score, 89);
  assert.equal(inflatedGate.passed, false);

  const vetoed = buildReview({
    dimensions: QUALITY_DIMENSIONS.map((key) => ({ key, score: key === "factual_integrity" ? QUALITY_VETO_FLOORS.factual_integrity - 1 : 94, assessment: "Assessment", evidence: ["Evidence"], improvements: [] }))
  });
  const vetoGate = evaluateQualityGate(vetoed, { verdict: "ready" });
  assert.ok(vetoGate.vetoFailures.includes("factual_integrity"));
  assert.equal(vetoGate.passed, false);
});

test("content craft evidence catches generic, duplicated and thin channel output", () => {
  const evidence = buildContentCraftEvidence({ artifacts: {
    email: { subject: "Elevate your business today", heroHeadline: "Unlock premium solutions", sections: [{ headline: "Unlock premium solutions", body: "Transform your business." }] },
    meta: { primaryText: "Unlock premium solutions and transform your business.", carouselConcepts: [{ cards: [{ headline: "Stand out", body: "Take it to the next level with our premium solutions." }, { headline: "Stand out", body: "Discover exceptional quality." }] }] },
    blog: { title: "Premium solutions", excerpt: "Discover more", bodyHtml: "<p>Short generic article.</p>" }
  } });
  assert.equal(evidence.checks.genericLanguageControlled, false);
  assert.equal(evidence.checks.headlineSystemDistinct, false);
  assert.equal(evidence.checks.blogHasEditorialDepth, false);
  assert.ok(evidence.genericPhraseCount >= 3);
});

test("content craft evidence admits disciplined and channel-specific work", () => {
  const article = Array.from({ length: 36 }, (_, index) => `<p>Retail presentation principle ${index + 1} connects product framing, customer attention and a practical in-store decision through concrete explanation and considered examples.</p>`).join("");
  const evidence = buildContentCraftEvidence({ artifacts: {
    email: {
      subject: "When presentation starts the sales conversation",
      previewText: "A considered display system for independent retailers.",
      heroHeadline: "Let the display speak first",
      intro: "Customers read presentation before they ask a question.",
      sections: [
        { headline: "Frame the first impression", body: "Use a clear visual hierarchy around the pieces customers notice first." },
        { headline: "Give value a visible structure", body: "Move from product detail to the wider assortment without visual noise." },
        { headline: "Make exploration feel natural", body: "Create an ordered path that supports a useful retail conversation." }
      ]
    },
    meta: { primaryText: "What does a customer understand before they speak to you?", headline: "The silent salesperson", carouselConcepts: [{ cards: [
      { headline: "Before the first question", body: "Presentation has already set an expectation." },
      { headline: "Attention needs an order", body: "Lead the eye from detail to assortment." },
      { headline: "Value should feel visible", body: "Framing changes how a product is approached." },
      { headline: "Build a calmer display", body: "Give every product a deliberate role." },
      { headline: "Start the conversation", body: "See the retailer presentation system." }
    ] }] },
    blog: { title: "How retail presentation shapes the first customer conversation", excerpt: "A practical look at hierarchy and perceived value.", bodyHtml: article }
  } });
  assert.equal(evidence.checks.genericLanguageControlled, true);
  assert.equal(evidence.checks.headlineSystemDistinct, true);
  assert.equal(evidence.checks.channelsDifferentiated, true);
  assert.equal(evidence.checks.emailCopyDisciplined, true);
  assert.equal(evidence.checks.metaCopyDisciplined, true);
  assert.equal(evidence.checks.blogHasEditorialDepth, true);
});

test("quality orchestration revises, admits or blocks without an infinite loop", () => {
  const deterministicAudit = { verdict: "ready" };
  assert.equal(decideQualityNextStep({ review: buildReview(), deterministicAudit }).action, "admit_to_review");
  assert.equal(decideQualityNextStep({ review: buildReview({ verdict: "REVISE", overallScore: 84 }), deterministicAudit, revisionCount: 1 }).action, "revise");
  const reviewable = buildReview({
    verdict: "REVISE",
    overallScore: 84,
    dimensions: QUALITY_DIMENSIONS.map((key) => ({
      key,
      score: key === "factual_integrity" ? 90 : ["brief_fidelity", "creative_distinctiveness", "copy_craft", "email_quality", "meta_quality"].includes(key) ? 82 : 84,
      assessment: "Safe and useful, with polish remaining.",
      evidence: ["Concrete evidence"],
      improvements: ["Polish in human review."]
    }))
  });
  const reviewableDecision = decideQualityNextStep({ review: reviewable, deterministicAudit, revisionCount: QUALITY_MAX_REVISIONS });
  assert.equal(reviewableDecision.action, "admit_to_review");
  assert.equal(reviewableDecision.admissionTier, "reviewable");
  assert.equal(reviewableDecision.reason, "reviewable_draft_ready");
  assert.equal(decideQualityNextStep({ review: buildReview({ verdict: "REVISE", overallScore: 69 }), deterministicAudit, revisionCount: QUALITY_MAX_REVISIONS }).reason, "maximum_revisions_exhausted");
  assert.equal(decideQualityNextStep({ review: buildReview({ verdict: "BLOCKED" }), deterministicAudit }).reason, "quality_director_blocked");
  assert.equal(decideQualityNextStep({ review: buildReview({ verdict: "REVISE" }), deterministicAudit, deadlineReached: true }).action, "continue_later");
  assert.equal(hasQualityStagnated([68, 69, 70]), false);
  assert.equal(hasQualityStagnated([68, 68, 69]), true);
  assert.equal(decideQualityNextStep({ review: buildReview({ verdict: "REVISE", overallScore: 69 }), deterministicAudit, revisionCount: 1, scoreHistory: [68, 68, 69] }).action, "revise");
});

test("quality review receives structural evidence from the compiled deliverables", () => {
  const evidence = buildRenderedArtifactEvidence({
    artifacts: {
      email: { bodyHtml: '<h1>Hero</h1><tr data-email-module="image_left"><img src="https://cdn.example.com/a.jpg"><span data-primary-cta="true">Go</span></tr>' },
      meta: { carouselConcepts: [{ name: "A", cards: [{ role: "hook", headline: "Hook", assetUrl: "image" }] }] }
    }
  });
  assert.deepEqual(evidence.email.moduleSequence, ["image_left"]);
  assert.equal(evidence.email.uniqueCampaignImageCount, 1);
  assert.equal(evidence.meta.carouselConcepts[0].roles[0], "hook");
});

test("checkpoint assets refresh expiring Asana URLs without losing image assignments", () => {
  const previousUrl = "https://asanausercontent.com/old-signed-image";
  const refreshedUrl = "https://asanausercontent.com/new-signed-image";
  const replacements = buildRefreshedAssetUrlMap(
    [`image | Hero photo.jpg | ${previousUrl}`],
    [`image | Hero photo.jpg | ${refreshedUrl}`]
  );
  const refreshed = remapAssetUrls({
    input: { assets: [`image | Hero photo.jpg | ${previousUrl}`] },
    artifacts: {
      email: {
        heroImageUrl: previousUrl,
        bodyHtml: `<img src="${previousUrl}">`,
        sections: [{ imageUrl: previousUrl }]
      }
    }
  }, replacements);
  assert.equal(replacements.get(previousUrl), refreshedUrl);
  assert.equal(refreshed.artifacts.email.heroImageUrl, refreshedUrl);
  assert.match(refreshed.artifacts.email.bodyHtml, /new-signed-image/);
  assert.equal(refreshed.artifacts.email.sections[0].imageUrl, refreshedUrl);
});

test("checkpoint refresh remaps HTML-escaped signed URLs and collects every assigned asset", () => {
  const previousUrl = "https://asanausercontent.com/image?token=old&signature=one";
  const refreshedUrl = "https://asanausercontent.com/image?token=new&signature=two";
  const refreshed = remapAssetUrls({
    artifacts: {
      email: {
        heroImageUrl: previousUrl,
        bodyHtml: `<img src="${previousUrl.replace(/&/g, "&amp;")}">`,
        sections: [{ imageUrl: previousUrl }]
      },
      meta: { carouselConcepts: [{ cards: [{ assetUrl: previousUrl }] }] }
    }
  }, new Map([[previousUrl, refreshedUrl]]));
  assert.match(refreshed.artifacts.email.bodyHtml, /token=new&amp;signature=two/);
  assert.deepEqual(collectAssignedArtifactUrls(refreshed), [refreshedUrl]);
});

test("deterministic QA blocks video-only email production and internal customer placeholders", () => {
  const compiledEmail = renderPremiumCampaignEmail({
    subject: "Campaign",
    primaryCta: "Read more",
    primaryCtaUrl: "",
    sections: [],
    closingHeadline: "Next step",
    closingBody: "[INDSÆT GODKENDT PROCES]"
  }, { title: "Campaign", markets: ["DK"] });
  const audit = buildQualityAudit(
    { campaignObject: { linkedTasks: { campaignTask: { id: "campaign" }, contentTask: { id: "content" } } } },
    { campaign: {}, sourceAudit: {} },
    {
      input: { assets: ["video | source.mp4 | https://cdn.example.com/source.mp4"] },
      artifacts: {
        email: { bodyHtml: compiledEmail, primaryCtaUrl: "" },
        meta: { headline: "Campaign", primaryText: "Safe copy", carouselConcepts: [{ cards: [{}, {}, {}, {}, {}] }, { cards: [{}, {}, {}, {}, {}] }] },
        blog: { bodyHtml: "<p>Complete article.</p>" }
      }
    },
    []
  );
  assert.equal(audit.checks.find((check) => check.key === "customer_copy_clean").passed, false);
  assert.equal(audit.checks.find((check) => check.key === "static_visual_ready").passed, false);
  assert.notEqual(audit.verdict, "ready");
});

test("deterministic QA accepts validated signed Asana images without file extensions", () => {
  const signedImages = Array.from({ length: 3 }, (_, index) => `https://app.asana.com/app/asana/-/get_asset?asset_id=${index + 1}&signature=test`);
  const emailDraft = {
    subject: "A specific campaign",
    previewText: "A useful preview",
    heroHeadline: "The silent salesperson",
    intro: "Presentation shapes the customer conversation before the first question.",
    primaryCta: "Read the guide",
    primaryCtaUrl: "",
    heroImageUrl: signedImages[0],
    heroImageMode: "assigned",
    sections: [
      { label: "Detail", headline: "Begin with the detail", body: "A precise product detail earns attention.", bullets: [], moduleId: "image_left", layout: "image_left", imageUrl: signedImages[1], imageMode: "assigned", imageAlt: "Product detail" },
      { label: "Format", headline: "Build the right format", body: "The format gives the range a clear role.", bullets: [], moduleId: "image_right", layout: "image_right", imageUrl: signedImages[2], imageMode: "assigned", imageAlt: "Product format" },
      { label: "Proof", headline: "Let the system explain itself", body: "A final statement connects presentation with conversation.", bullets: [], moduleId: "statement", layout: "statement", imageUrl: "", imageMode: "none", imageAlt: "" }
    ],
    closingHeadline: "Make presentation part of the sales conversation",
    closingBody: "Use the guide to prepare the next retailer discussion."
  };
  const compiledEmail = renderPremiumCampaignEmail(emailDraft, { title: "WTP retailer", markets: ["UK"], resolvedEmailImageUrls: signedImages });
  const cards = signedImages.map((assetUrl, index) => ({ role: index === 0 ? "hook" : index === 2 ? "close" : "proof", headline: `Card ${index + 1}`, body: "Specific supported copy.", assetUrl }));
  const audit = buildQualityAudit(
    { campaignObject: { linkedTasks: { campaignTask: { id: "campaign" }, contentTask: { id: "content" } } } },
    { campaign: {}, sourceAudit: {} },
    {
      input: { objective: "Recruit retailers with a visual presentation story.", audience: "Independent jewellery retailers.", offer: "A modular display partnership.", source: { body: "The supplied campaign source explains the retailer programme, its presentation logic and the intended customer conversation in enough factual detail." }, assets: signedImages },
      artifacts: {
        email: { ...emailDraft, bodyHtml: compiledEmail, moduleSystem: { locked: true, version: EMAIL_MODULE_SYSTEM_VERSION, master: { id: WESTPACK_EMAIL_MASTER.id } } },
        meta: { headline: "The silent salesperson", primaryText: "Presentation speaks first.", carouselConcepts: [{ cards }, { cards }] },
        blog: { title: "Presentation before conversation", excerpt: "A practical guide.", bodyHtml: `<p>${"Useful editorial evidence ".repeat(180)}</p>` }
      }
    },
    signedImages,
    { passed: true }
  );
  assert.equal(audit.checks.find((check) => check.key === "email_media_integrity").passed, true);
  assert.equal(audit.checks.find((check) => check.key === "email_image_choreography").passed, true);
  assert.equal(audit.checks.find((check) => check.key === "meta_asset_coverage").passed, true);
});

test("deterministic QA rejects campaign email HTML without locked universal content", () => {
  const audit = buildQualityAudit(
    { campaignObject: { linkedTasks: { campaignTask: { id: "campaign" }, contentTask: { id: "content" } } } },
    { campaign: {}, sourceAudit: {} },
    {
      input: { assets: [] },
      artifacts: {
        email: { bodyHtml: '<h1>Campaign</h1><span data-primary-cta="true">Read more</span>', primaryCtaUrl: "" },
        meta: { headline: "Campaign", primaryText: "Safe copy", carouselConcepts: [{ cards: [{}, {}, {}, {}, {}] }, { cards: [{}, {}, {}, {}, {}] }] },
        blog: { bodyHtml: "<p>Complete article.</p>" }
      }
    },
    []
  );
  assert.equal(audit.checks.find((check) => check.key === "universal_header_2023").passed, false);
  assert.equal(audit.checks.find((check) => check.key === "universal_footer_2023").passed, false);
  assert.notEqual(audit.verdict, "ready");
});

test("deterministic craft gate remains achievable for a substantive designed campaign", () => {
  const images = ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg", "https://cdn.example.com/c.jpg"];
  const emailDraft = {
    subject: "When presentation starts the sales conversation",
    previewText: "A considered display system for independent retailers.",
    primaryCta: "Explore the retailer system",
    primaryCtaUrl: "",
    heroHeadline: "Let the display speak first",
    intro: "Customers read presentation before they ask a question.",
    heroImageUrl: images[0],
    heroImageAlt: "Considered jewellery display",
    sections: [
      { moduleId: "image_left", layout: "image_left", label: "First impression", headline: "Frame the first impression", body: "Use a clear visual hierarchy around the pieces customers notice first.", bullets: [], imageUrl: images[0], imageAlt: "Retail display detail" },
      { moduleId: "image_right", layout: "image_right", label: "Visible value", headline: "Give value a visible structure", body: "Move from product detail to the wider assortment without visual noise.", bullets: [], imageUrl: images[1], imageAlt: "Structured assortment" },
      { moduleId: "editorial_text", layout: "editorial_text", label: "Customer path", headline: "Make exploration feel natural", body: "Create an ordered path that supports a useful retail conversation.", bullets: [], imageUrl: images[2], imageAlt: "Retail interaction" }
    ],
    closingHeadline: "Start with what customers see",
    closingBody: "Build the first conversation into the presentation itself."
  };
  const article = Array.from({ length: 36 }, (_, index) => `<p>Retail principle ${index + 1} connects product framing, customer attention and practical in-store decisions through concrete explanation and considered examples.</p>`).join("");
  const makeCards = (prefix) => [
    ["hook", `${prefix} before the first question`], ["story", `${prefix} attention needs an order`], ["proof", `${prefix} value becomes visible`], ["detail", `${prefix} build a calmer display`], ["close", `${prefix} start the conversation`]
  ].map(([role, headline], index) => ({ position: index + 1, role, assetUrl: images[index % images.length], headline, body: `Card ${index + 1} advances one specific part of the retail presentation argument.` }));
  const compiledEmail = renderPremiumCampaignEmail(emailDraft, { title: "W34 retailer presentation", markets: ["UK"] });
  const audit = buildQualityAudit(
    { campaignObject: { linkedTasks: { campaignTask: { id: "campaign" }, contentTask: { id: "content" } } } },
    { campaign: { coreAngle: "The display becomes the silent salesperson" }, sourceAudit: { verdict: "ready" } },
    {
      input: { objective: "Recruit independent jewellery retailers through a presentation-led partnership story.", audience: "Independent jewellery retailers seeking a clearer way to communicate value in store.", offer: "Access to a considered modular jewellery presentation system.", source: { body: "The supplied brief explains the retailer programme, product presentation system and intended commercial conversation in practical detail." }, assets: images },
      artifacts: {
        email: { ...emailDraft, bodyHtml: compiledEmail, moduleSystem: { locked: true, version: EMAIL_MODULE_SYSTEM_VERSION, master: { id: WESTPACK_EMAIL_MASTER.id } } },
        meta: { headline: "The silent salesperson", primaryText: "What does a customer understand before they speak to you?", carouselConcepts: [{ name: "Conversation", cards: makeCards("Conversation") }, { name: "Display", cards: makeCards("Display") }] },
        blog: { title: "How presentation shapes the first retail conversation", excerpt: "A practical look at hierarchy and perceived value.", bodyHtml: article }
      }
    },
    images,
    { passed: true }
  );
  assert.equal(audit.verdict, "ready", JSON.stringify(audit.missing));
  assert.deepEqual(audit.missing, []);
});
