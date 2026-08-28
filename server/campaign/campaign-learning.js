const crypto = require("crypto");

const LEARNING_VERSION = "westpack-human-learning-v1";

function plainText(value = "") {
  return String(value || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeValue(value) {
  if (Array.isArray(value)) return value.map((item) => plainText(item)).filter(Boolean).join(" | ").slice(0, 360);
  if (["string", "number", "boolean"].includes(typeof value)) return plainText(value).slice(0, 360);
  return "";
}

function collectArtifactSignals(pack = {}) {
  const artifacts = pack?.artifacts || pack || {};
  const email = artifacts.email || {};
  const meta = artifacts.meta || {};
  const blog = artifacts.blog || {};
  const signals = {};
  const set = (path, value) => {
    const safe = safeValue(value);
    if (safe || value === false || value === 0) signals[path] = safe;
  };
  ["subject", "previewText", "visualDirection", "heroLayout", "eyebrow", "heroHeadline", "intro", "primaryCta", "primaryCtaUrl", "closingHeadline", "closingBody"].forEach((key) => set(`email.${key}`, email[key]));
  (email.sections || []).slice(0, 6).forEach((section, index) => {
    ["moduleId", "layout", "label", "headline", "body", "bullets", "imageAlt", "imageAspect", "imageFocalPoint", "spacing", "textAlign", "contentWidth", "surfaceStyle"].forEach((key) => set(`email.sections.${index}.${key}`, section?.[key]));
    set(`email.sections.${index}.hasImage`, Boolean(section?.imageUrl && section?.imageMode !== "none"));
  });
  ["campaignAngle", "primaryText", "headline", "description"].forEach((key) => set(`meta.${key}`, meta[key]));
  (meta.variants || []).slice(0, 4).forEach((variant, index) => ["title", "body", "headline", "angle"].forEach((key) => set(`meta.variants.${index}.${key}`, variant?.[key])));
  (meta.carouselConcepts || []).slice(0, 3).forEach((concept, conceptIndex) => {
    ["name", "angle"].forEach((key) => set(`meta.concepts.${conceptIndex}.${key}`, concept?.[key]));
    (concept?.cards || []).slice(0, 8).forEach((card, cardIndex) => ["role", "headline", "body", "cropIntent", "overlayGuidance"].forEach((key) => set(`meta.concepts.${conceptIndex}.cards.${cardIndex}.${key}`, card?.[key])));
  });
  ["title", "slug", "excerpt"].forEach((key) => set(`blog.${key}`, blog[key]));
  set("blog.bodyText", plainText(blog.bodyHtml).slice(0, 600));
  return signals;
}

function channelForPath(path = "") {
  return String(path).split(".")[0] || "cross_channel";
}

function compareCampaignArtifacts(originalPack = {}, editedPack = {}) {
  const original = collectArtifactSignals(originalPack);
  const edited = collectArtifactSignals(editedPack);
  const paths = [...new Set([...Object.keys(original), ...Object.keys(edited)])].sort();
  const result = {
    version: LEARNING_VERSION,
    totals: { retained: 0, changed: 0, removed: 0, added: 0 },
    channels: {},
    retainedPaths: [],
    changedPaths: [],
    removedPaths: [],
    addedPaths: [],
    changedExamples: []
  };
  const bump = (channel, key) => {
    result.channels[channel] ||= { retained: 0, changed: 0, removed: 0, added: 0 };
    result.channels[channel][key] += 1;
    result.totals[key] += 1;
  };
  for (const path of paths) {
    const before = original[path];
    const after = edited[path];
    const channel = channelForPath(path);
    if (before === after) {
      bump(channel, "retained");
      if (result.retainedPaths.length < 60) result.retainedPaths.push(path);
    } else if (before === undefined) {
      bump(channel, "added");
      if (result.addedPaths.length < 40) result.addedPaths.push(path);
    } else if (after === undefined) {
      bump(channel, "removed");
      if (result.removedPaths.length < 40) result.removedPaths.push(path);
    } else {
      bump(channel, "changed");
      if (result.changedPaths.length < 60) result.changedPaths.push(path);
      if (result.changedExamples.length < 16 && /(?:headline|subject|previewText|intro|body|angle|primaryText|description|moduleId|layout|visualDirection)/i.test(path)) {
        result.changedExamples.push({ path, before: String(before).slice(0, 220), after: String(after).slice(0, 220) });
      }
    }
  }
  result.finalSelections = {
    emailVisualDirection: edited["email.visualDirection"] || "",
    emailHeroLayout: edited["email.heroLayout"] || "",
    emailModuleSequence: Object.keys(edited).filter((path) => /email\.sections\.\d+\.moduleId/.test(path)).map((path) => edited[path]),
    emailImageCount: Object.entries(edited).filter(([path, value]) => /email\.sections\.\d+\.hasImage/.test(path) && value === "true").length
  };
  return result;
}

function learningFingerprint(parts = []) {
  return crypto.createHash("sha1").update(parts.map((part) => String(part || "")).join("|")).digest("hex").slice(0, 24);
}

function normalizeText(value = "") {
  return plainText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function relevanceScore(event, input = {}, channel = "general") {
  const query = normalizeText([input?.title, input?.objective, input?.audience, input?.offer, input?.campaignType].join(" "));
  const eventText = normalizeText([event.campaignName, event.reason, event.metadata?.campaignType].join(" "));
  let score = event.channel === channel || event.channel === "cross_channel" || channel === "general" ? 4 : 0;
  for (const token of new Set(query.split(/\s+/).filter((item) => item.length >= 5))) if (eventText.includes(token)) score += 2;
  if (["klaviyo_draft_created", "meta_draft_created"].includes(event.type)) score += 3;
  if (event.type === "rejected") score += 2;
  return score;
}

function isActiveLearningEvent(event = {}) {
  return !["disabled", "deleted"].includes(String(event.moderationStatus || "active"));
}

function deriveCampaignLearningPatterns(events = []) {
  const patterns = new Map();
  const add = (event, path, value, kind = "preference") => {
    const safe = safeValue(value);
    if (!path || !safe || !isActiveLearningEvent(event)) return;
    const normalized = normalizeText(safe).slice(0, 180);
    const key = `${event.channel || channelForPath(path)}|${path}|${normalized}`;
    const current = patterns.get(key) || {
      id: `pattern_${learningFingerprint([key])}`,
      channel: event.channel || channelForPath(path),
      path,
      value: safe,
      kind,
      eventIds: new Set(),
      campaignNames: new Set(),
      handoffCount: 0,
      approvedCount: 0,
      latestAt: ""
    };
    current.eventIds.add(event.id);
    if (event.campaignName) current.campaignNames.add(event.campaignName);
    if (["klaviyo_draft_created", "meta_draft_created"].includes(event.type)) current.handoffCount += 1;
    if (event.moderationStatus === "approved") current.approvedCount += 1;
    if (!current.latestAt || Date.parse(event.createdAt || 0) > Date.parse(current.latestAt || 0)) current.latestAt = event.createdAt || "";
    patterns.set(key, current);
  };
  for (const event of Array.isArray(events) ? events : []) {
    if (!["editor_saved", "klaviyo_draft_created", "meta_draft_created"].includes(event.type)) continue;
    for (const example of event.diff?.changedExamples || []) add(event, example.path, example.after, "edited_choice");
    for (const path of event.diff?.removedPaths || []) add(event, path, "removed", "removal");
    for (const [key, value] of Object.entries(event.diff?.finalSelections || {})) {
      if (Array.isArray(value)) value.forEach((item, index) => add(event, `finalSelections.${key}.${index}`, item, "final_selection"));
      else if (value !== "" && value !== null && value !== undefined) add(event, `finalSelections.${key}`, value, "final_selection");
    }
  }
  return [...patterns.values()].map((pattern) => {
    const campaignCount = pattern.campaignNames.size;
    const signalCount = pattern.eventIds.size;
    const established = campaignCount >= 3 && signalCount >= 3;
    const confidence = Math.min(0.98, 0.22 + (campaignCount * 0.16) + (Math.min(4, pattern.handoffCount) * 0.08) + (Math.min(3, pattern.approvedCount) * 0.08));
    return {
      ...pattern,
      eventIds: [...pattern.eventIds],
      campaignNames: [...pattern.campaignNames],
      campaignCount,
      signalCount,
      confidence: Number(confidence.toFixed(2)),
      maturity: established ? "established" : campaignCount >= 2 ? "developing" : "observed",
      mayActAsRule: established
    };
  }).sort((left, right) => Number(right.mayActAsRule) - Number(left.mayActAsRule) || right.confidence - left.confidence || Date.parse(right.latestAt || 0) - Date.parse(left.latestAt || 0));
}

function buildCampaignLearningEffectiveness(events = []) {
  const active = (Array.isArray(events) ? events : []).filter(isActiveLearningEvent);
  const decisions = active
    .filter((event) => event.diff?.totals && ["editor_saved", "klaviyo_draft_created", "meta_draft_created"].includes(event.type))
    .map((event) => ({
      createdAt: event.createdAt,
      campaignName: event.campaignName,
      changes: Number(event.diff.totals.changed || 0) + Number(event.diff.totals.added || 0) + Number(event.diff.totals.removed || 0),
      retained: Number(event.diff.totals.retained || 0),
      qualityReviews: Number(event.outcome?.qualityReviews || 0),
      productionRevisions: Number(event.outcome?.productionRevisions || 0)
    }))
    .sort((left, right) => Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0));
  const average = (rows, key) => rows.length ? Number((rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length).toFixed(1)) : null;
  const first = decisions.slice(0, 5);
  const latest = decisions.slice(-5);
  const baselineChanges = average(first, "changes");
  const currentChanges = average(latest, "changes");
  return {
    measuredCampaignDecisions: decisions.length,
    minimumForTrend: 6,
    trendReady: decisions.length >= 6,
    baselineManualChanges: baselineChanges,
    currentManualChanges: currentChanges,
    manualChangeDeltaPercent: decisions.length >= 6 && baselineChanges > 0
      ? Number((((currentChanges - baselineChanges) / baselineChanges) * 100).toFixed(1))
      : null,
    averageQualityReviews: average(decisions.filter((row) => row.qualityReviews), "qualityReviews"),
    averageProductionRevisions: average(decisions.filter((row) => row.productionRevisions), "productionRevisions"),
    draftHandoffs: active.filter((event) => ["klaviyo_draft_created", "meta_draft_created"].includes(event.type)).length,
    rejections: active.filter((event) => event.type === "rejected").length
  };
}

function campaignIdentity(value = "") {
  const normalized = normalizeText(value);
  const week = normalized.match(/\bw\s?(\d{1,2})\b/);
  if (week) return `week:${week[1]}`;
  return normalized.split(/\s+/).filter((token) => token.length >= 5 && !new Set(["campaign", "klaviyo", "email", "current", "comparable", "cohort"]).has(token)).slice(0, 4).join("|");
}

function buildCampaignPerformanceAttribution(events = []) {
  const active = (Array.isArray(events) ? events : []).filter(isActiveLearningEvent);
  const decisions = active.filter((event) => event.diff && ["editor_saved", "klaviyo_draft_created", "meta_draft_created"].includes(event.type));
  const rows = [];
  for (const snapshot of active.filter((event) => event.type === "performance_snapshot")) {
    for (const performance of snapshot.performance?.campaigns || []) {
      const identity = campaignIdentity(performance.campaignName);
      if (!identity) continue;
      const matches = decisions.filter((event) => campaignIdentity(event.campaignName) === identity);
      if (!matches.length) continue;
      rows.push({
        channel: snapshot.channel,
        campaignName: performance.campaignName,
        identity,
        cohortPosition: performance.cohortPosition,
        metrics: {
          sent: performance.sent,
          openRate: performance.openRate,
          clickRate: performance.clickRate,
          unsubscribeRate: performance.unsubscribeRate,
          revenuePerRecipient: performance.revenuePerRecipient
        },
        linkedDecisions: matches.slice(0, 4).map((event) => ({
          type: event.type,
          campaignName: event.campaignName,
          changedExamples: event.diff?.changedExamples?.slice(0, 4),
          finalSelections: event.diff?.finalSelections
        })),
        attributionConfidence: identity.startsWith("week:") ? "strong_name_match" : "directional_name_match",
        caveat: "Association only; audience, offer and send timing may also explain performance."
      });
    }
  }
  return rows.slice(0, 20);
}

function buildCampaignLearningPromptBlock(events = [], input = {}, channel = "general") {
  const activeEvents = (Array.isArray(events) ? events : []).filter(isActiveLearningEvent);
  const establishedPatterns = deriveCampaignLearningPatterns(activeEvents)
    .filter((pattern) => pattern.mayActAsRule && (pattern.channel === channel || pattern.channel === "cross_channel" || channel === "general"))
    .slice(0, 8);
  const attributedPerformance = buildCampaignPerformanceAttribution(activeEvents)
    .filter((row) => row.channel === channel || channel === "general")
    .slice(0, 6);
  const ranked = activeEvents
    .map((event) => ({ event, score: relevanceScore(event, input, channel) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || Date.parse(right.event.createdAt) - Date.parse(left.event.createdAt))
    .slice(0, 12)
    .map(({ event }) => ({
      type: event.type,
      channel: event.channel,
      campaignName: event.campaignName,
      reason: event.reason,
      evidenceLevel: event.evidenceLevel,
      totals: event.diff?.totals,
      finalSelections: event.diff?.finalSelections,
      changedExamples: event.diff?.changedExamples?.slice(0, 5),
      removedPaths: event.diff?.removedPaths?.slice(0, 12),
      performance: event.performance
    }));
  if (!ranked.length) return "Human Campaign Learning: no relevant operator feedback has been recorded yet.";
  return [
    `Human Campaign Learning (${LEARNING_VERSION}; evidence, not unconditional rules):`,
    `Established repeated patterns (minimum three campaigns; these may guide decisions): ${JSON.stringify(establishedPatterns)}`,
    `Attributed channel outcomes (association, never proof of causation): ${JSON.stringify(attributedPerformance)}`,
    JSON.stringify(ranked),
    "Draft creation is stronger approval evidence than a local save. Rejections are negative evidence. Performance is associative and must only be compared within a compatible channel/objective.",
    "Apply repeated, relevant preferences while preserving the current locked brief and product truth. Never copy old campaign wording blindly or infer a universal rule from one edit."
  ].join(" ");
}

module.exports = {
  LEARNING_VERSION,
  buildCampaignLearningPromptBlock,
  buildCampaignLearningEffectiveness,
  buildCampaignPerformanceAttribution,
  collectArtifactSignals,
  compareCampaignArtifacts,
  deriveCampaignLearningPatterns,
  isActiveLearningEvent,
  learningFingerprint,
  relevanceScore
};
