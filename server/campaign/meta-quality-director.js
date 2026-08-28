const META_CREATIVE_RUBRIC_VERSION = "westpack-meta-creative-director-v1";
const META_CREATIVE_PASS_SCORE = 90;
const META_CREATIVE_DIMENSION_FLOOR = 80;
const META_CREATIVE_DIMENSIONS = Object.freeze([
  "scroll_stop",
  "visual_hierarchy",
  "mobile_legibility",
  "premium_brand_quality",
  "narrative_progression",
  "source_design_continuity"
]);

function buildMetaCreativeReviewSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["PASS", "REVISE", "BLOCKED"] },
      overallScore: { type: "integer", minimum: 0, maximum: 100 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      summary: { type: "string" },
      strengths: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
      criticalFailures: { type: "array", maxItems: 6, items: { type: "string" } },
      dimensions: {
        type: "array",
        minItems: META_CREATIVE_DIMENSIONS.length,
        maxItems: META_CREATIVE_DIMENSIONS.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string", enum: META_CREATIVE_DIMENSIONS },
            score: { type: "integer", minimum: 0, maximum: 100 },
            assessment: { type: "string" },
            evidence: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
            improvement: { type: "string" }
          },
          required: ["key", "score", "assessment", "evidence", "improvement"]
        }
      },
      cardReviews: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            verdict: { type: "string", enum: ["KEEP", "REFINE", "REBUILD"] },
            strongestElement: { type: "string" },
            mustFix: { type: "array", maxItems: 4, items: { type: "string" } }
          },
          required: ["index", "score", "verdict", "strongestElement", "mustFix"]
        }
      },
      revisionBrief: {
        type: "object",
        additionalProperties: false,
        properties: {
          objective: { type: "string" },
          mustFix: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
          preserve: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
          expectedImprovement: { type: "string" }
        },
        required: ["objective", "mustFix", "preserve", "expectedImprovement"]
      }
    },
    required: ["verdict", "overallScore", "confidence", "summary", "strengths", "criticalFailures", "dimensions", "cardReviews", "revisionBrief"]
  };
}

function buildMetaCreativeReviewPrompt({ campaign, renderedImages = [], iteration = 1 }) {
  return [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          `You are Westpack's independent paid-social Creative Director (${META_CREATIVE_RUBRIC_VERSION}).`,
          "You did not create this carousel. Judge the 3-6 supplied finished 1080x1080 cards as actual mobile Meta advertising, not as a written plan.",
          "Quality, premium design and specificity matter more than speed or output volume. A PASS requires 90 overall, every dimension at least 80 and no critical failure.",
          "Inspect real hierarchy, whitespace, crop quality, product fidelity, typography, contrast, pacing, repetition and whether card one stops the scroll at mobile size.",
          "The cards must form the shortest complete progression for the idea. Three strong cards may be enough; penalise padding, repeated templates, missing narrative steps, tiny text, generic copy and weak image-message relationships.",
          "Judge source continuity from the supplied Design DNA, but never demand the universal email header, navigation, footer or legal content.",
          "All customer-facing copy must be natural UK English. Invented claims, wrong products, illegibility or a visually generic campaign are critical failures.",
          "Return evidence tied to visible cards. Do not rewrite the campaign; return a precise revision brief. Strict JSON only."
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            `REVIEW ITERATION: ${iteration}`,
            `CAMPAIGN AND SOURCE CONTRACT:\n${JSON.stringify(campaign)}`,
            `The next ${Math.max(3, Math.min(6, renderedImages.length))} images are the finished cards in publication order. Assess what is actually visible and whether the chosen count is justified.`
          ].join("\n\n")
        },
        ...renderedImages.slice(0, 6).map((imageUrl) => ({ type: "input_image", image_url: imageUrl, detail: "high" }))
      ]
    }
  ];
}

function normalizeMetaCreativeReview(value = {}, model = "") {
  const byKey = new Map((Array.isArray(value.dimensions) ? value.dimensions : []).map((item) => [item.key, item]));
  const dimensions = META_CREATIVE_DIMENSIONS.map((key) => ({
    key,
    score: Math.max(0, Math.min(100, Number(byKey.get(key)?.score || 0))),
    assessment: String(byKey.get(key)?.assessment || "Not assessed."),
    evidence: Array.isArray(byKey.get(key)?.evidence) ? byKey.get(key).evidence : [],
    improvement: String(byKey.get(key)?.improvement || "")
  }));
  const dimensionFloor = Math.min(...dimensions.map((item) => item.score));
  const overallScore = Math.max(0, Math.min(100, Number(value.overallScore || 0)));
  const criticalFailures = Array.isArray(value.criticalFailures) ? value.criticalFailures : [];
  const passed = value.verdict === "PASS" && overallScore >= META_CREATIVE_PASS_SCORE && dimensionFloor >= META_CREATIVE_DIMENSION_FLOOR && !criticalFailures.length;
  return {
    rubricVersion: META_CREATIVE_RUBRIC_VERSION,
    verdict: passed ? "PASS" : value.verdict === "BLOCKED" ? "BLOCKED" : "REVISE",
    passed,
    overallScore,
    dimensionFloor,
    requiredScore: META_CREATIVE_PASS_SCORE,
    requiredDimensionFloor: META_CREATIVE_DIMENSION_FLOOR,
    confidence: String(value.confidence || "low"),
    summary: String(value.summary || ""),
    strengths: Array.isArray(value.strengths) ? value.strengths : [],
    criticalFailures,
    dimensions,
    cardReviews: Array.isArray(value.cardReviews) ? value.cardReviews.slice(0, 6) : [],
    revisionBrief: value.revisionBrief || { objective: "Strengthen the carousel.", mustFix: [], preserve: [], expectedImprovement: "" },
    model,
    reviewedAt: new Date().toISOString()
  };
}

module.exports = {
  META_CREATIVE_DIMENSIONS,
  META_CREATIVE_DIMENSION_FLOOR,
  META_CREATIVE_PASS_SCORE,
  buildMetaCreativeReviewPrompt,
  buildMetaCreativeReviewSchema,
  normalizeMetaCreativeReview
};
