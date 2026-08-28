const QUALITY_RUBRIC_VERSION = "westpack-quality-director-v5";
const QUALITY_PASS_SCORE = 87;
const QUALITY_DIMENSION_FLOOR = 78;
const QUALITY_REVIEW_SCORE = 82;
const QUALITY_REVIEW_DIMENSION_FLOOR = 75;
const QUALITY_MAX_REVISIONS = 5;

const QUALITY_DIMENSIONS = Object.freeze([
  "brief_fidelity",
  "factual_integrity",
  "audience_relevance",
  "strategic_depth",
  "creative_distinctiveness",
  "commercial_clarity",
  "copy_craft",
  "brand_quality",
  "campaign_memory_fidelity",
  "visual_design",
  "email_quality",
  "meta_quality",
  "blog_quality",
  "cross_channel_coherence"
]);

const QUALITY_DIMENSION_WEIGHTS = Object.freeze({
  brief_fidelity: 1.15,
  factual_integrity: 1.2,
  audience_relevance: 1.05,
  strategic_depth: 1.1,
  creative_distinctiveness: 1.15,
  commercial_clarity: 1.05,
  copy_craft: 1.15,
  brand_quality: 1,
  campaign_memory_fidelity: .75,
  visual_design: 1.15,
  email_quality: 1,
  meta_quality: 1,
  blog_quality: .8,
  cross_channel_coherence: 1
});

const QUALITY_VETO_FLOORS = Object.freeze({
  brief_fidelity: 85,
  factual_integrity: 90,
  creative_distinctiveness: 84,
  copy_craft: 84,
  visual_design: 80,
  email_quality: 82,
  meta_quality: 82
});

const QUALITY_REVIEW_VETO_FLOORS = Object.freeze({
  brief_fidelity: 82,
  factual_integrity: 88,
  creative_distinctiveness: 80,
  copy_craft: 80,
  email_quality: 78,
  meta_quality: 78
});

function buildQualityReviewSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["PASS", "REVISE", "BLOCKED"] },
      overallScore: { type: "integer", minimum: 0, maximum: 100 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      summary: { type: "string" },
      criticalFailures: { type: "array", maxItems: 8, items: { type: "string" } },
      strengths: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
      excellenceEvidence: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
      dimensions: {
        type: "array",
        minItems: QUALITY_DIMENSIONS.length,
        maxItems: QUALITY_DIMENSIONS.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string", enum: QUALITY_DIMENSIONS },
            score: { type: "integer", minimum: 0, maximum: 100 },
            assessment: { type: "string" },
            evidence: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
            improvements: { type: "array", maxItems: 4, items: { type: "string" } }
          },
          required: ["key", "score", "assessment", "evidence", "improvements"]
        }
      },
      revisionBrief: {
        type: "object",
        additionalProperties: false,
        properties: {
          objective: { type: "string" },
          rootCauses: { type: "array", maxItems: 6, items: { type: "string" } },
          mustFix: { type: "array", maxItems: 10, items: { type: "string" } },
          acceptanceCriteria: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
          preserve: { type: "array", maxItems: 6, items: { type: "string" } },
          email: { type: "array", maxItems: 6, items: { type: "string" } },
          meta: { type: "array", maxItems: 6, items: { type: "string" } },
          blog: { type: "array", maxItems: 6, items: { type: "string" } },
          expectedImprovement: { type: "string" }
        },
        required: ["objective", "rootCauses", "mustFix", "acceptanceCriteria", "preserve", "email", "meta", "blog", "expectedImprovement"]
      }
    },
    required: ["verdict", "overallScore", "confidence", "summary", "criticalFailures", "strengths", "excellenceEvidence", "dimensions", "revisionBrief"]
  };
}

function stripMarkup(value = "") {
  return String(value || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function words(value = "") {
  return stripMarkup(value).toLowerCase().match(/[a-zà-ž0-9]+/gi) || [];
}

function wordCount(value = "") {
  return words(value).length;
}

function jaccard(left = "", right = "") {
  const stop = new Set(["the", "and", "for", "with", "your", "you", "our", "that", "this", "from", "are", "but", "into", "som", "med", "til", "for", "der", "den", "det"]);
  const a = new Set(words(left).filter((token) => token.length > 3 && !stop.has(token)));
  const b = new Set(words(right).filter((token) => token.length > 3 && !stop.has(token)));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function buildContentCraftEvidence(artifactPack = {}) {
  const artifacts = artifactPack?.artifacts || {};
  const email = artifacts.email || {};
  const meta = artifacts.meta || {};
  const blog = artifacts.blog || {};
  const genericPattern = /\b(?:unlock|elevate|discover|transform|take (?:it|your|the) to the next level|stand out|premium solutions?|exceptional quality|high quality|tailored solutions?|perfect (?:solution|for)|game[ -]?changer|in today'?s|look no further|something for everyone|make a difference|designed to impress|lasting impression|style and functionality|meet your needs|wide range|l(?:ø|Ã¸)ft|opdag|skab blikfang|g(?:ø|Ã¸)r en forskel|n(?:æ|Ã¦)ste niveau|perfekte? l(?:ø|Ã¸)sning|h(?:ø|Ã¸)j kvalitet|noget for enhver)\b/gi;
  const allCustomerCopy = [email.subject, email.previewText, email.heroHeadline, email.intro, ...(email.sections || []).flatMap((section) => [section.headline, section.body]), meta.primaryText, meta.headline, ...(meta.carouselConcepts || []).flatMap((concept) => (concept.cards || []).flatMap((card) => [card.headline, card.body])), blog.title, blog.excerpt, blog.bodyHtml].filter(Boolean).join(" ");
  const genericMatches = [...allCustomerCopy.matchAll(genericPattern)].map((match) => match[0].toLowerCase());
  const emailHeadlines = [email.heroHeadline, ...(email.sections || []).map((section) => section.headline)].filter(Boolean);
  const metaHeadlines = (meta.carouselConcepts || []).flatMap((concept) => (concept.cards || []).map((card) => card.headline)).filter(Boolean);
  const normalizedDuplicates = (items) => {
    const counts = items.reduce((map, item) => {
      const key = stripMarkup(item).toLowerCase().replace(/[^a-zà-ž0-9]+/gi, " ").trim();
      if (key) map.set(key, Number(map.get(key) || 0) + 1);
      return map;
    }, new Map());
    return [...counts.entries()].filter(([, count]) => count > 1).map(([text, count]) => ({ text, count }));
  };
  const emailText = [email.subject, email.previewText, email.heroHeadline, email.intro, ...(email.sections || []).flatMap((section) => [section.headline, section.body])].join(" ");
  const metaText = [meta.primaryText, meta.headline, ...(meta.carouselConcepts || []).flatMap((concept) => (concept.cards || []).flatMap((card) => [card.headline, card.body]))].join(" ");
  const blogText = [blog.title, blog.excerpt, blog.bodyHtml].join(" ");
  const maxChannelOverlap = Math.max(jaccard(emailText, metaText), jaccard(emailText, blogText), jaccard(metaText, blogText));
  const metaOverlongHeadlines = metaHeadlines.filter((headline) => wordCount(headline) > 10).length;
  const metaOverlongBodies = (meta.carouselConcepts || []).flatMap((concept) => concept.cards || []).filter((card) => wordCount(card.body) > 28).length;
  const emailOverlongHeadlines = emailHeadlines.filter((headline) => wordCount(headline) > 13).length;
  const subjectWords = wordCount(email.subject);
  const blogWords = wordCount(blog.bodyHtml);
  const duplicateEmailHeadlines = normalizedDuplicates(emailHeadlines);
  const duplicateMetaHeadlines = (meta.carouselConcepts || []).flatMap((concept, conceptIndex) => normalizedDuplicates((concept.cards || []).map((card) => card.headline).filter(Boolean)).map((duplicate) => ({ ...duplicate, conceptIndex })));
  return {
    genericMatches,
    genericPhraseCount: genericMatches.length,
    duplicateEmailHeadlines,
    duplicateMetaHeadlines,
    maxChannelOverlap: Number(maxChannelOverlap.toFixed(2)),
    subjectWords,
    blogWords,
    metaOverlongHeadlines,
    metaOverlongBodies,
    emailOverlongHeadlines,
    checks: {
      genericLanguageControlled: genericMatches.length <= 1,
      headlineSystemDistinct: !duplicateEmailHeadlines.length && !duplicateMetaHeadlines.length,
      channelsDifferentiated: maxChannelOverlap <= .58,
      emailCopyDisciplined: subjectWords >= 3 && subjectWords <= 14 && emailOverlongHeadlines === 0,
      metaCopyDisciplined: metaOverlongHeadlines === 0 && metaOverlongBodies === 0,
      blogHasEditorialDepth: blogWords >= 350
    }
  };
}

function buildRenderedArtifactEvidence(artifactPack = {}) {
  const artifacts = artifactPack?.artifacts || {};
  const email = artifacts.email || {};
  const html = String(email.bodyHtml || "");
  const moduleSequence = [...html.matchAll(/data-email-module=["']([^"']+)["']/gi)].map((match) => match[1]);
  const imageUrls = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  const headings = [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140)
  }));
  const carouselConcepts = (artifacts.meta?.carouselConcepts || []).map((concept) => ({
    name: concept.name,
    cardCount: Array.isArray(concept.cards) ? concept.cards.length : 0,
    roles: (concept.cards || []).map((card) => card.role),
    headlines: (concept.cards || []).map((card) => card.headline),
    assetCount: (concept.cards || []).filter((card) => card.assetUrl).length
  }));
  return {
    evidenceType: "compiled-output-structure",
    limitation: "Structural evidence from the finished compiled HTML and carousel specification; not a pixel screenshot.",
    email: {
      compiledHtmlLength: html.length,
      moduleSequence,
      uniqueModuleCount: new Set(moduleSequence).size,
      imageCount: imageUrls.length,
      uniqueCampaignImageCount: new Set(imageUrls.filter((url) => !/klaviyo|cloudfront\.net\/assets\/email/i.test(url))).size,
      headings,
      primaryCtaCount: (html.match(/data-primary-cta=["']true["']/gi) || []).length
    },
    meta: { carouselConcepts }
  };
}

function buildQualityReviewPrompt({ input, plan, artifactPack, deterministicAudit, creativeContract = null, renderedEvidence = null, iteration = 1 }) {
  return [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          `You are Westpack's independent Quality Director (${QUALITY_RUBRIC_VERSION}).`,
          "You did not create this campaign and must not rewrite it. Judge only the submitted work against the locked source brief, facts, assets and plan.",
          "Quality, visual design and content depth matter more than speed or efficiency. Be demanding and evidence-based; never reward mere completeness.",
          `A PASS requires an overall score of at least ${QUALITY_PASS_SCORE}, every dimension at least ${QUALITY_DIMENSION_FLOOR}, no critical failure, and a coherent premium campaign across email, Meta and blog. The general dimension floor prevents a collapsed channel; it is not an excellence target for every minor dimension.`,
          `The server may expose a factually safe draft for human review after two targeted revisions when it scores at least ${QUALITY_REVIEW_SCORE}, every dimension is at least ${QUALITY_REVIEW_DIMENSION_FLOOR}, and the stricter review veto floors are met. This is labelled reviewable with notes, never PASS, and can never publish automatically.`,
          `Hard veto floors also apply: ${JSON.stringify(QUALITY_VETO_FLOORS)}. Scores are server-calibrated from the weighted dimensions, so an inflated overall score cannot rescue weak craft. PASS also requires high review confidence and at least three concrete pieces of excellence evidence.`,
          "Critical failures include invented facts, prices or claims; wrong products; contradiction of the brief; weak or generic design; broken email structure; missing carousel thinking; or any publish/send/schedule capability.",
          "Creative distinctiveness asks whether this campaign has an ownable organising idea, memorable device and brief-specific tension—not whether it is merely polished. Generic category copy cannot score above 79 in creative_distinctiveness or copy_craft.",
          "Copy craft evaluates precision, rhythm, hierarchy, restraint, headline quality and whether every sentence earns its place. Replacing one vague adjective with another is not revision progress.",
          "Commercial clarity evaluates the next customer decision, the value exchange and proof sequence without inventing urgency or claims. Audience relevance requires recognisable customer stakes rather than demographic labels.",
          "Blog quality is independent: it must add useful authority and a developed argument. A lightly expanded email is not a quality blog.",
          "Visual design must assess hierarchy, pacing, image choreography, crop intent, whitespace, typography direction, modular variation and whether the email feels designed rather than templated.",
          "Judge the candidate against the locked creative contract. Penalise route drift, mixed concepts and channels that repeat each other instead of performing their assigned roles.",
          "The executable production contract outranks any contradictory wording accidentally present in the creative contract: email uses 3-4 compiled modules and one primary closing CTA; Meta must be natural UK English and contain exactly two distinct carousels of 3-6 cards. Judge whether the chosen count is the shortest complete story; never penalise a strong three-card execution or reward padding. Never demand a fixed card count, Danish Meta master, single-image replacement, multiple compiled CTAs or an undelivered contact sheet.",
          "Use the compiled-output evidence to inspect the delivered module sequence, image usage, heading hierarchy, CTA count and carousel progression. Do not confuse a valid schema with a designed result.",
          "Campaign Memory fidelity has its own scored dimension and also informs brand_quality, visual_design and email_quality. Inspect the candidate's owned Westpack memoryReferences and require visible, brief-appropriate adoption of their assigned design roles. Naming references without applying their patterns is not evidence.",
          "Reward editorial restraint: one dominant creative route, selective claims and purposeful modules. Penalize redundant variants, repeated sections, filler copy and breadth that weakens execution depth.",
          "CTA integrity rule: when the locked input contains no exact approved destination, primaryCtaUrl must be empty and the compiled CTA must be visibly designed but non-clickable. Never demand or reward a placeholder, homepage or invented URL. A non-clickable CTA is not broken in that situation.",
          "The compiled email bodyHtml is the only delivered email artifact. sourceBodyHtml is provenance for the compiler, not a competing final version; never penalize their structural differences.",
          "The compiled email must contain the locked Header - 2023 and Footer - 2023 universal-content markers, including web-view and unsubscribe tags. Judge the creative campaign body between them; never request alternative logo, navigation, contact, social or legal modules.",
          "Internal review language is acceptable in rationale and productionNotes, but not in customer-facing email, Meta or blog copy.",
          "If the work can be improved, return REVISE with a precise revision brief. Return BLOCKED only when the source material cannot support a safe correction.",
          "Every revision brief must identify root causes and measurable acceptance criteria. Diagnose the broken idea, proof order, hierarchy or channel role before suggesting line edits.",
          "Do not modify this rubric based on the producer output or prior feedback. Return only the required JSON."
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: [
          `ITERATION: ${iteration}`,
          `LOCKED CAMPAIGN INPUT:\n${JSON.stringify(input)}`,
          `LOCKED CAMPAIGN PLAN:\n${JSON.stringify(plan)}`,
          `LOCKED CREATIVE CONTRACT:\n${JSON.stringify(creativeContract)}`,
          `DETERMINISTIC SAFETY AUDIT:\n${JSON.stringify(deterministicAudit)}`,
          `COMPILED OUTPUT EVIDENCE:\n${JSON.stringify(renderedEvidence || buildRenderedArtifactEvidence(artifactPack))}`,
          `CANDIDATE PRODUCTION PACK:\n${JSON.stringify(artifactPack)}`,
          "Evaluate the actual specificity, depth and designed quality of the candidate. Generic marketing language or structurally repetitive modules must materially reduce the score."
        ].join("\n\n")
      }]
    }
  ];
}

function buildArtifactRevisionPrompt({ input, plan, artifactPack, qualityReview, revisionNumber }) {
  return [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          "You are Westpack's senior Campaign Content Director. Revise the production pack, but do not alter the locked brief, facts, campaign plan or approved asset URLs.",
          "Apply every must-fix item from the independent Quality Director. Preserve explicitly approved strengths. Improve design depth, image choreography, channel craft and specificity rather than merely changing words.",
          "Begin with the stated root causes and acceptance criteria. Do not perform synonym swaps when the underlying idea, proof sequence, module role or audience tension is weak.",
          "The current pack contains curated memoryReferences. Use the owned Westpack references as the primary design system: strengthen the assigned hierarchy, pacing, image choreography, CTA rhythm and brand voice wherever the review found weak or generic execution.",
          "Keep one dominant creative route. Prefer removing repetition over adding more copy, sections or alternatives.",
          "A revision is only successful when the new output visibly meets every acceptance criterion and improves the weakest scored dimension without lowering factual integrity or a preserved strength.",
          "Customer-facing email, Meta and blog fields must never contain placeholders, TODOs, validation requests, approval notes, editorial instructions or internal production language. Put unresolved gaps only in productionNotes.",
          "The email must feel intentionally art-directed and modular, with varied section rhythm and purposeful use of multiple supplied images. Meta must prioritize a coherent carousel story. Blog content must add useful depth rather than repeat the email.",
          "All customer-facing Meta copy must be natural UK English with British spelling, regardless of the language used by the source email or campaign brief. Danish or US-English Meta copy is a critical failure.",
          "Never invent claims, prices, links or product details. Never add publishing, sending, scheduling or activation instructions. Return only the complete revised production pack JSON."
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: [
          `REVISION NUMBER: ${revisionNumber}`,
          `LOCKED INPUT:\n${JSON.stringify(input)}`,
          `LOCKED PLAN:\n${JSON.stringify(plan)}`,
          `CURRENT PRODUCTION PACK:\n${JSON.stringify(artifactPack)}`,
          `QUALITY DIRECTOR FEEDBACK:\n${JSON.stringify(qualityReview.revisionBrief)}`,
          `CRITICAL FAILURES:\n${JSON.stringify(qualityReview.criticalFailures || [])}`,
          "Produce a complete replacement pack that resolves the feedback without losing approved strengths."
        ].join("\n\n")
      }]
    }
  ];
}

function normalizeQualityReview(value = {}, model = "") {
  const dimensionsByKey = new Map((Array.isArray(value.dimensions) ? value.dimensions : []).map((item) => [item.key, item]));
  const dimensions = QUALITY_DIMENSIONS.map((key) => ({
    key,
    score: Math.max(0, Math.min(100, Number(dimensionsByKey.get(key)?.score || 0))),
    assessment: String(dimensionsByKey.get(key)?.assessment || "Not assessed."),
    evidence: Array.isArray(dimensionsByKey.get(key)?.evidence) ? dimensionsByKey.get(key).evidence : [],
    improvements: Array.isArray(dimensionsByKey.get(key)?.improvements) ? dimensionsByKey.get(key).improvements : []
  }));
  return {
    rubricVersion: QUALITY_RUBRIC_VERSION,
    verdict: ["PASS", "REVISE", "BLOCKED"].includes(value.verdict) ? value.verdict : "REVISE",
    overallScore: Math.max(0, Math.min(100, Number(value.overallScore || 0))),
    confidence: String(value.confidence || "low"),
    summary: String(value.summary || ""),
    criticalFailures: Array.isArray(value.criticalFailures) ? value.criticalFailures : [],
    strengths: Array.isArray(value.strengths) ? value.strengths : [],
    excellenceEvidence: Array.isArray(value.excellenceEvidence) ? value.excellenceEvidence : [],
    dimensions,
    revisionBrief: value.revisionBrief || { objective: "Improve the campaign.", rootCauses: ["The quality shortfall has not been diagnosed."], mustFix: [], acceptanceCriteria: ["Resolve the cited quality shortfall."], preserve: [], email: [], meta: [], blog: [], expectedImprovement: "" },
    model,
    reviewedAt: new Date().toISOString()
  };
}

function evaluateQualityGate(review, deterministicAudit) {
  const dimensionScores = (review?.dimensions || []).map((item) => Number(item.score || 0));
  const dimensionFloor = dimensionScores.length ? Math.min(...dimensionScores) : 0;
  const weighted = (review?.dimensions || []).reduce((acc, item) => {
    const weight = Number(QUALITY_DIMENSION_WEIGHTS[item.key] || 1);
    return { total: acc.total + Number(item.score || 0) * weight, weight: acc.weight + weight };
  }, { total: 0, weight: 0 });
  const weightedDimensionScore = weighted.weight ? Math.round(weighted.total / weighted.weight) : 0;
  const calibratedScore = Math.min(Number(review?.overallScore || 0), weightedDimensionScore);
  const deterministicPassed = deterministicAudit?.verdict === "ready";
  const vetoFailures = Object.entries(QUALITY_VETO_FLOORS).filter(([key, floor]) => Number(review?.dimensions?.find((item) => item.key === key)?.score || 0) < floor).map(([key]) => key);
  const reviewVetoFailures = Object.entries(QUALITY_REVIEW_VETO_FLOORS).filter(([key, floor]) => Number(review?.dimensions?.find((item) => item.key === key)?.score || 0) < floor).map(([key]) => key);
  const excellencePassed = (review?.excellenceEvidence || []).length >= 3;
  const confidencePassed = review?.confidence === "high" || (review?.confidence === "medium" && calibratedScore >= QUALITY_PASS_SCORE + 2);
  const reviewConfidencePassed = ["medium", "high"].includes(review?.confidence);
  const reviewable = deterministicPassed
    && calibratedScore >= QUALITY_REVIEW_SCORE
    && dimensionFloor >= QUALITY_REVIEW_DIMENSION_FLOOR
    && !reviewVetoFailures.length
    && reviewConfidencePassed
    && !(review?.criticalFailures || []).length
    && review?.verdict !== "BLOCKED";
  const passed = deterministicPassed
    && review?.verdict === "PASS"
    && calibratedScore >= QUALITY_PASS_SCORE
    && dimensionFloor >= QUALITY_DIMENSION_FLOOR
    && !vetoFailures.length
    && excellencePassed
    && confidencePassed
    && !(review?.criticalFailures || []).length;
  return {
    passed,
    deterministicPassed,
    score: calibratedScore,
    reportedScore: Number(review?.overallScore || 0),
    weightedDimensionScore,
    dimensionFloor,
    vetoFailures,
    reviewable,
    reviewVetoFailures,
    reviewConfidencePassed,
    excellencePassed,
    confidencePassed,
    requiredScore: QUALITY_PASS_SCORE,
    requiredDimensionFloor: QUALITY_DIMENSION_FLOOR,
    requiredReviewScore: QUALITY_REVIEW_SCORE,
    requiredReviewDimensionFloor: QUALITY_REVIEW_DIMENSION_FLOOR,
    reason: passed ? "quality_gate_passed" : review?.verdict === "BLOCKED" ? "quality_director_blocked" : "revision_required"
  };
}

function hasQualityStagnated(scoreHistory = [], options = {}) {
  const windowSize = Number(options.windowSize || 3);
  const minimumGain = Number(options.minimumGain || 2);
  const scores = (Array.isArray(scoreHistory) ? scoreHistory : []).map(Number).filter(Number.isFinite);
  if (scores.length < windowSize) return false;
  const window = scores.slice(-windowSize);
  return Math.max(...window) - window[0] < minimumGain;
}

function decideQualityNextStep({ review, deterministicAudit, revisionCount = 0, deadlineReached = false, scoreHistory = [] }) {
  const gate = evaluateQualityGate(review, deterministicAudit);
  if (gate.passed) return { action: "admit_to_review", gate, reason: gate.reason, admissionTier: "excellent" };
  if (review?.verdict === "BLOCKED") return { action: "quality_blocked", gate, reason: "quality_director_blocked" };
  if (revisionCount >= QUALITY_MAX_REVISIONS) {
    if (gate.reviewable) return { action: "admit_to_review", gate, reason: "reviewable_draft_ready", admissionTier: "reviewable" };
    return { action: "quality_blocked", gate, reason: "maximum_revisions_exhausted" };
  }
  if (deadlineReached) return { action: "continue_later", gate, reason: "quality_window_checkpoint" };
  return { action: "revise", gate, reason: "revision_required" };
}

module.exports = {
  QUALITY_DIMENSIONS,
  QUALITY_DIMENSION_WEIGHTS,
  QUALITY_DIMENSION_FLOOR,
  QUALITY_MAX_REVISIONS,
  QUALITY_PASS_SCORE,
  QUALITY_REVIEW_DIMENSION_FLOOR,
  QUALITY_REVIEW_SCORE,
  QUALITY_REVIEW_VETO_FLOORS,
  QUALITY_RUBRIC_VERSION,
  QUALITY_VETO_FLOORS,
  buildArtifactRevisionPrompt,
  buildContentCraftEvidence,
  buildRenderedArtifactEvidence,
  buildQualityReviewPrompt,
  buildQualityReviewSchema,
  decideQualityNextStep,
  evaluateQualityGate,
  hasQualityStagnated,
  normalizeQualityReview
};
