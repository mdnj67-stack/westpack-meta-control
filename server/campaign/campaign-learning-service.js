const { readAgentState } = require("./agent-store");
const { buildCampaignLearningEffectiveness, buildCampaignPerformanceAttribution, compareCampaignArtifacts, deriveCampaignLearningPatterns, learningFingerprint } = require("./campaign-learning");
const { getCampaignLearningStoreProfile, moderateCampaignLearningEvent, readCampaignLearningEvents, recordCampaignLearningEvent } = require("./campaign-learning-store");

const ALLOWED_EVENT_TYPES = new Set(["editor_saved", "klaviyo_draft_created", "meta_draft_created", "rejected", "performance_snapshot"]);

function learningChannel(type, requested = "") {
  if (requested) return String(requested);
  if (type === "klaviyo_draft_created") return "email";
  if (type === "meta_draft_created") return "meta";
  return "cross_channel";
}

async function recordArtifactLearning({ type = "editor_saved", jobId = "", editedArtifact = null, originalArtifact = null, reason = "", channel = "", metadata = {} } = {}) {
  const safeType = ALLOWED_EVENT_TYPES.has(type) ? type : "editor_saved";
  const state = await readAgentState();
  const job = state.jobs.find((candidate) => candidate.id === String(jobId || "")) || null;
  const original = job?.output?.artifactPack || originalArtifact;
  if (safeType !== "rejected" && safeType !== "performance_snapshot" && (!original?.artifacts || !editedArtifact?.artifacts)) {
    throw new Error("Campaign learning requires both the original AI artifact and the edited studio artifact.");
  }
  const diff = original?.artifacts && editedArtifact?.artifacts ? compareCampaignArtifacts(original, editedArtifact) : null;
  const campaignName = String(job?.campaignTaskName || metadata?.campaignName || original?.input?.title || editedArtifact?.input?.title || "Untitled campaign");
  const evidenceLevel = safeType === "editor_saved"
    ? "editing_signal"
    : safeType === "rejected"
      ? "negative_human_decision"
      : safeType === "performance_snapshot"
        ? "observed_channel_performance"
        : "human_approved_draft_handoff";
  const fingerprint = learningFingerprint([
    safeType,
    jobId || campaignName,
    diff ? JSON.stringify({ totals: diff.totals, changedExamples: diff.changedExamples, finalSelections: diff.finalSelections }) : reason,
    metadata?.externalDraftId || metadata?.performanceFingerprint || metadata?.generatedAt || ""
  ]);
  return recordCampaignLearningEvent({
    type: safeType,
    channel: learningChannel(safeType, channel),
    jobId,
    campaignTaskGid: job?.campaignTaskGid || metadata?.campaignTaskGid || "",
    campaignName,
    reason,
    evidenceLevel,
    fingerprint,
    diff,
    performance: metadata?.performance || null,
    outcome: {
      qualityReviews: Array.isArray(job?.qualityIterations) ? job.qualityIterations.length : Number(metadata?.qualityReviews || 0),
      productionRevisions: Number(job?.revisionCount || job?.checkpoint?.revisionCount || metadata?.productionRevisions || 0),
      qualityScore: Number(job?.output?.qualityAudit?.score || metadata?.qualityScore || 0)
    },
    metadata: {
      campaignType: original?.input?.campaignType || metadata?.campaignType || "",
      externalDraftId: String(metadata?.externalDraftId || "").slice(0, 180),
      destination: String(metadata?.destination || "").slice(0, 120)
    }
  });
}

async function getCampaignLearningStatus() {
  const events = await readCampaignLearningEvents(200);
  const patterns = deriveCampaignLearningPatterns(events);
  return {
    store: getCampaignLearningStoreProfile(),
    eventCount: events.length,
    byType: events.reduce((acc, event) => ({ ...acc, [event.type]: Number(acc[event.type] || 0) + 1 }), {}),
    latestAt: events[0]?.createdAt || "",
    patterns: patterns.slice(0, 40),
    patternSummary: {
      total: patterns.length,
      established: patterns.filter((pattern) => pattern.mayActAsRule).length,
      developing: patterns.filter((pattern) => pattern.maturity === "developing").length
    },
    effectiveness: buildCampaignLearningEffectiveness(events),
    attributedPerformance: buildCampaignPerformanceAttribution(events),
    events: events.slice(0, 20).map((event) => ({
      id: event.id,
      type: event.type,
      channel: event.channel,
      campaignName: event.campaignName,
      evidenceLevel: event.evidenceLevel,
      reason: event.reason,
      moderationStatus: event.moderationStatus,
      operatorNote: event.operatorNote,
      outcome: event.outcome,
      createdAt: event.createdAt,
      totals: event.diff?.totals || null,
      changedExamples: event.diff?.changedExamples?.slice(0, 4) || [],
      finalSelections: event.diff?.finalSelections || null,
      performance: event.performance || null
    }))
  };
}

async function moderateArtifactLearning({ eventId = "", operation = "", operatorNote = "" } = {}) {
  return moderateCampaignLearningEvent(eventId, operation, operatorNote);
}

module.exports = { getCampaignLearningStatus, moderateArtifactLearning, recordArtifactLearning };
