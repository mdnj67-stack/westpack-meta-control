const crypto = require("crypto");
const {
  QUALITY_DIMENSION_FLOOR,
  QUALITY_PASS_SCORE,
  QUALITY_REVIEW_DIMENSION_FLOOR,
  QUALITY_REVIEW_SCORE
} = require("./quality-agent");

const AGENT_SCHEMA_VERSION = 5;
const AGENT_SCHEDULE = "0 * * * *";
const MINIMUM_CONTENT_MATCH_SCORE = 0.5;
const CONTENT_AGENT_PIPELINE_VERSION = 23;
const CONTENT_AGENT_WORKFLOW_FILTER_VERSION = 2;
const CONTENT_AGENT_SOURCE_SECTION = "Kampagner";
const TERMINAL_STATES = new Set(["ready_for_review", "quality_blocked", "failed", "dead_letter", "superseded", "rejected"]);
const ACTIVE_STATES = new Set(["queued", "analysing", "producing", "quality_review"]);
const PAUSABLE_STATES = new Set([...ACTIVE_STATES, "paused"]);
const INTERRUPTED_JOB_THRESHOLD_MS = 4 * 60 * 1000;

const CONTENT_AGENT_POLICY = Object.freeze({
  publishCapability: false,
  finalState: "ready_for_review",
  allowedOutputs: ["campaign_object", "campaign_plan", "artifact_pack", "paused_meta_draft", "klaviyo_draft"],
  forbiddenActions: ["publish", "send", "schedule", "activate", "change_budget"],
  qualityGateRequired: true,
  qualityPassScore: QUALITY_PASS_SCORE,
  qualityDimensionFloor: QUALITY_DIMENSION_FLOOR,
  qualityReviewScore: QUALITY_REVIEW_SCORE,
  qualityReviewDimensionFloor: QUALITY_REVIEW_DIMENSION_FLOOR,
  automaticCreativeResets: 0,
  maximumQualityRevisions: 2,
  productionArchitecture: "three_routes_then_channel_specialists",
  surgicalRevisions: true,
  statement: "The Content Agent can prepare and draft, but can never publish, send, schedule or activate content."
});

function nowIso() {
  return new Date().toISOString();
}

function currentPipelineVersion(asanaVersion = "", modifiedAt = "") {
  const base = String(asanaVersion || modifiedAt || "unversioned")
    .replace(/\|pipeline:\d+$/i, "")
    .replace(/\|section:[^|]+$/i, "");
  return `${base}|section:kampagner|pipeline:${CONTENT_AGENT_PIPELINE_VERSION}`;
}

function createInitialAgentState() {
  return {
    schemaVersion: AGENT_SCHEMA_VERSION,
    schedule: AGENT_SCHEDULE,
    policy: CONTENT_AGENT_POLICY,
    lastScanAt: "",
    lastScanSummary: null,
    seenTasks: {},
    processedTasks: {},
    jobs: [],
    operations: {
      lastHeartbeatAt: "",
      lastCycleOutcome: "never_run",
      consecutiveCycleFailures: 0
    },
    updatedAt: nowIso()
  };
}

function normalizeAgentState(value = null) {
  const base = createInitialAgentState();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    schemaVersion: AGENT_SCHEMA_VERSION,
    schedule: AGENT_SCHEDULE,
    policy: CONTENT_AGENT_POLICY,
    seenTasks: value.seenTasks && typeof value.seenTasks === "object" ? value.seenTasks : {},
    processedTasks: value.processedTasks && typeof value.processedTasks === "object" ? value.processedTasks : {},
    operations: value.operations && typeof value.operations === "object" ? { ...base.operations, ...value.operations } : base.operations,
    jobs: Array.isArray(value.jobs) ? value.jobs.slice(0, 60) : []
  };
}

function normalizeMatchValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bw\d{1,2}\b/g, " ")
    .replace(/\b(?:billeder|images?|content|kampagne|campaign)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreContentMatch(campaignTask = {}, contentTask = {}) {
  const campaignName = normalizeMatchValue(campaignTask.name);
  const contentName = normalizeMatchValue(contentTask.name);
  if (!campaignName || !contentName) return 0;
  if (campaignName === contentName) return 1;
  if (campaignName.includes(contentName) || contentName.includes(campaignName)) return 0.88;
  const campaignTokens = new Set(campaignName.split(" ").filter((token) => token.length > 1));
  const contentTokens = new Set(contentName.split(" ").filter((token) => token.length > 1));
  const overlap = [...campaignTokens].filter((token) => contentTokens.has(token)).length;
  const tokenScore = overlap / Math.max(campaignTokens.size, contentTokens.size, 1);
  const campaignWeek = String(campaignTask.name || "").match(/\bW(\d{1,2})\b/i)?.[1] || "";
  const contentWeek = String(contentTask.name || "").match(/\bW(\d{1,2})\b/i)?.[1] || "";
  return Math.min(1, tokenScore + (campaignWeek && campaignWeek === contentWeek ? 0.16 : 0));
}

function findBestContentMatch(campaignTask = {}, contentTasks = []) {
  return contentTasks
    .map((task) => ({ task, score: scoreContentMatch(campaignTask, task) }))
    .sort((left, right) => right.score - left.score)[0] || null;
}

function normalizeAsanaSectionName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isCampaignSectionTask(campaignTask = {}) {
  const expected = normalizeAsanaSectionName(CONTENT_AGENT_SOURCE_SECTION);
  return (Array.isArray(campaignTask.sections) ? campaignTask.sections : [])
    .some((section) => normalizeAsanaSectionName(section) === expected);
}

function buildJobId(campaignTaskGid = "") {
  return `agent_${Date.now()}_${crypto.createHash("sha1").update(String(campaignTaskGid)).digest("hex").slice(0, 8)}_${crypto.randomBytes(3).toString("hex")}`;
}

function createAgentJob({ campaignTask, contentTask = null, source = "hourly_scan", direction = "" } = {}) {
  const createdAt = nowIso();
  return {
    id: buildJobId(campaignTask?.gid),
    state: "queued",
    priority: source === "manual" ? 100 : 10,
    source,
    campaignTaskGid: String(campaignTask?.gid || ""),
    campaignTaskName: String(campaignTask?.name || "Untitled Asana campaign"),
    contentTaskGid: String(contentTask?.gid || ""),
    contentTaskName: String(contentTask?.name || ""),
    asanaModifiedAt: String(campaignTask?.modifiedAt || ""),
    asanaVersion: String(campaignTask?.asanaVersion || campaignTask?.modifiedAt || ""),
    direction: String(direction || "").trim(),
    createdAt,
    updatedAt: createdAt,
    startedAt: "",
    completedAt: "",
    attempts: 0,
    progress: 0,
    statusMessage: source === "manual" ? "Queued by operator." : "Discovered during hourly Asana scan.",
    error: "",
    output: null,
    policy: CONTENT_AGENT_POLICY
  };
}

function enqueueManualJob(stateValue, { campaignTask, contentTask = null, direction = "" } = {}) {
  const state = normalizeAgentState(stateValue);
  const job = createAgentJob({ campaignTask, contentTask, source: "manual", direction });
  state.processedTasks[job.campaignTaskGid] = job.asanaVersion || job.asanaModifiedAt || job.createdAt;
  state.jobs = [job, ...state.jobs].slice(0, 60);
  state.updatedAt = nowIso();
  return { state, job };
}

function applyAgentControlCommands(stateValue, commands = []) {
  let state = normalizeAgentState(stateValue);
  const applied = [];
  let createdJob = null;
  for (const command of Array.isArray(commands) ? commands : []) {
    const type = String(command?.type || "").toLowerCase();
    if (type === "pause") {
      const index = state.jobs.findIndex((job) => job.id === String(command.jobId || ""));
      if (index < 0 || !ACTIVE_STATES.has(state.jobs[index].state)) continue;
      const updatedAt = nowIso();
      state.jobs[index] = {
        ...state.jobs[index],
        state: "paused",
        pausedAt: updatedAt,
        pausedFromState: state.jobs[index].state,
        statusMessage: "Paused by operator. Resume whenever you want to continue from the latest safe checkpoint.",
        updatedAt
      };
      state.updatedAt = updatedAt;
      applied.push({ commandId: command.id || "", type, jobId: state.jobs[index].id });
      continue;
    }
    if (type === "resume") {
      const index = state.jobs.findIndex((job) => job.id === String(command.jobId || ""));
      if (index < 0 || state.jobs[index].state !== "paused") continue;
      const updatedAt = nowIso();
      state.jobs[index] = {
        ...state.jobs[index],
        state: "queued",
        priority: Math.max(100, Number(state.jobs[index].priority || 0)),
        statusMessage: "Resumed by operator and moved to the front of the queue.",
        pausedAt: "",
        completedAt: "",
        updatedAt
      };
      state.updatedAt = updatedAt;
      applied.push({ commandId: command.id || "", type, jobId: state.jobs[index].id });
      continue;
    }
    if (!["enqueue", "takeover"].includes(type) || !command.campaignTask?.gid) continue;
    if (type === "takeover") {
      const targetIds = new Set([
        String(command.pauseJobId || ""),
        ...state.jobs.filter((job) => ["analysing", "producing", "quality_review"].includes(job.state)).map((job) => job.id)
      ].filter(Boolean));
      const pausedAt = nowIso();
      state.jobs = state.jobs.map((job) => targetIds.has(job.id) && ACTIVE_STATES.has(job.state) ? {
        ...job,
        state: "paused",
        pausedAt,
        pausedFromState: job.state,
        statusMessage: "Paused by operator because another campaign took over the studio.",
        updatedAt: pausedAt
      } : job);
    }
    const queued = enqueueManualJob(state, {
      campaignTask: command.campaignTask,
      contentTask: command.contentTask || null,
      direction: command.direction || ""
    });
    state = queued.state;
    createdJob = {
      ...queued.job,
      priority: type === "takeover" ? 120 : 100,
      statusMessage: type === "takeover"
        ? "Operator takeover: moved ahead of all other work."
        : "Queued by operator behind the current production step."
    };
    state.jobs = state.jobs.map((job) => job.id === createdJob.id ? createdJob : job);
    state.updatedAt = nowIso();
    applied.push({ commandId: command.id || "", type, jobId: createdJob.id });
  }
  return { state, applied, createdJob };
}

function applyHourlyScan(stateValue, campaignTasks = [], contentTasks = []) {
  const state = normalizeAgentState(stateValue);
  const discovered = [];
  const skipped = [];
  const unmatched = [];
  const campaignTaskFallbacks = [];
  const outsideSourceSection = [];
  const eligibility = new Map();

  for (const campaignTask of campaignTasks) {
    const status = campaignTask.completed ? "completed" : isCampaignSectionTask(campaignTask) ? "eligible" : "outside_section";
    eligibility.set(String(campaignTask.gid || ""), { status });
    if (status === "outside_section") outsideSourceSection.push(String(campaignTask.name || "Untitled Asana campaign"));
    if (status !== "eligible") delete state.processedTasks[String(campaignTask.gid || "")];
  }

  const beforePrune = state.jobs.length;
  state.jobs = state.jobs.filter((job) => (
    job.state !== "queued" || eligibility.get(String(job.campaignTaskGid || ""))?.status === "eligible"
  ));
  const prunedCount = beforePrune - state.jobs.length;

  for (const campaignTask of campaignTasks) {
    const taskGid = String(campaignTask?.gid || "");
    if (!taskGid || campaignTask.completed) continue;
    if (eligibility.get(taskGid)?.status !== "eligible") continue;
    const modifiedAt = String(campaignTask.modifiedAt || "");
    const version = `${modifiedAt || "unversioned"}|section:${normalizeAsanaSectionName(CONTENT_AGENT_SOURCE_SECTION)}|pipeline:${CONTENT_AGENT_PIPELINE_VERSION}`;
    const processedVersion = String(state.processedTasks[taskGid] || "");
    state.jobs = state.jobs.map((job) => {
      const outdatedActiveJob = String(job.campaignTaskGid || "") === taskGid
        && PAUSABLE_STATES.has(job.state)
        && /\|pipeline:\d+$/.test(String(job.asanaVersion || ""))
        && String(job.asanaVersion || "") !== version;
      return outdatedActiveJob ? {
        ...job,
        state: "superseded",
        progress: 100,
        statusMessage: `Superseded by Content Agent pipeline ${CONTENT_AGENT_PIPELINE_VERSION}.`,
        checkpoint: null,
        resumeStage: "",
        completedAt: nowIso(),
        updatedAt: nowIso()
      } : job;
    });
    const hasCurrentJob = state.jobs.some((job) => (
      String(job.campaignTaskGid) === taskGid
      && (PAUSABLE_STATES.has(job.state) || String(job.asanaVersion || "") === version || (!processedVersion && !job.asanaVersion))
    ));
    state.seenTasks[taskGid] = modifiedAt || nowIso();
    if (processedVersion === version || hasCurrentJob) {
      if (hasCurrentJob && !processedVersion) state.processedTasks[taskGid] = version;
      skipped.push(taskGid);
      continue;
    }
    const match = findBestContentMatch(campaignTask, contentTasks);
    const hasStrongContentMatch = Boolean(match?.task) && Number(match.score || 0) >= MINIMUM_CONTENT_MATCH_SCORE;
    const contentTask = hasStrongContentMatch ? match.task : campaignTask;
    if (!hasStrongContentMatch) {
      const fallback = {
        campaignTaskGid: taskGid,
        campaignTaskName: String(campaignTask.name || "Untitled Asana campaign"),
        bestMatchScore: Number(match?.score || 0)
      };
      unmatched.push(fallback);
      campaignTaskFallbacks.push(fallback);
    }
    const job = createAgentJob({ campaignTask: { ...campaignTask, asanaVersion: version }, contentTask, source: "hourly_scan" });
    job.matchConfidence = Number(match?.score || 0);
    job.contentSource = hasStrongContentMatch ? "content_project_match" : "campaign_task_fallback";
    state.jobs.push(job);
    state.processedTasks[taskGid] = version;
    discovered.push(job);
  }

  state.jobs = state.jobs
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0) || Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 60);
  state.lastScanAt = nowIso();
  state.lastScanSummary = {
    workflowFilterVersion: CONTENT_AGENT_WORKFLOW_FILTER_VERSION,
    sourceProject: "E-mail Kampagner",
    sourceSection: CONTENT_AGENT_SOURCE_SECTION,
    baseline: false,
    campaignCount: campaignTasks.length,
    eligibleCount: [...eligibility.values()].filter((item) => item.status === "eligible").length,
    contentCount: contentTasks.length,
    discoveredCount: discovered.length,
    skippedCount: skipped.length,
    unmatchedCount: unmatched.length,
    unmatched: unmatched.slice(0, 20),
    campaignTaskFallbackCount: campaignTaskFallbacks.length,
    campaignTaskFallbacks: campaignTaskFallbacks.slice(0, 20),
    outsideSourceSectionCount: outsideSourceSection.length,
    outsideSourceSection: outsideSourceSection.slice(0, 20),
    prunedCount,
    queueDepth: state.jobs.filter((job) => job.state === "queued").length
  };
  state.operations = {
    ...state.operations,
    lastHeartbeatAt: state.lastScanAt,
    lastCycleOutcome: "scan_completed",
    consecutiveCycleFailures: 0
  };
  state.updatedAt = nowIso();
  return { state, discovered };
}

function transitionAgentJob(stateValue, jobId, nextState, patch = {}) {
  const state = normalizeAgentState(stateValue);
  const index = state.jobs.findIndex((job) => job.id === jobId);
  if (index < 0) throw new Error("Content Agent job was not found.");
  if (TERMINAL_STATES.has(state.jobs[index].state) && state.jobs[index].state !== "failed") {
    throw new Error("Completed Content Agent jobs cannot be mutated.");
  }
  if (["published", "sent", "scheduled", "active"].includes(String(nextState).toLowerCase())) {
    throw new Error("Content Agent safety policy forbids publish states.");
  }
  const updatedAt = nowIso();
  state.jobs[index] = {
    ...state.jobs[index],
    ...patch,
    state: nextState,
    updatedAt,
    policy: CONTENT_AGENT_POLICY,
    ...(nextState === "analysing" && !state.jobs[index].startedAt ? { startedAt: updatedAt } : {}),
    ...(["ready_for_review", "quality_blocked", "failed", "dead_letter"].includes(nextState) ? { completedAt: updatedAt } : {})
  };
  state.updatedAt = updatedAt;
  return { state, job: state.jobs[index] };
}

function getNextQueuedJob(stateValue) {
  const state = normalizeAgentState(stateValue);
  return state.jobs
    .filter((job) => job.state === "queued")
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0) || Date.parse(left.createdAt) - Date.parse(right.createdAt))[0] || null;
}

function recoverInterruptedJobs(stateValue, now = Date.now()) {
  const state = normalizeAgentState(stateValue);
  let recoveredCount = 0;
  state.jobs = state.jobs.map((job) => {
    if (!ACTIVE_STATES.has(job.state) || job.state === "queued") return job;
    const updatedAt = Date.parse(job.updatedAt || job.startedAt || job.createdAt || "");
    if (!Number.isFinite(updatedAt) || now - updatedAt < INTERRUPTED_JOB_THRESHOLD_MS) return job;
    recoveredCount += 1;
    const canResume = Boolean(job.checkpoint);
    return {
      ...job,
      state: canResume ? "queued" : "failed",
      progress: canResume ? Math.max(70, Number(job.progress || 0)) : 100,
      statusMessage: canResume
        ? "Recovered an interrupted quality pass. The worker will continue from its checkpoint."
        : "The worker was interrupted before a safe checkpoint. Start a new run to try again.",
      error: canResume ? "" : "Worker interrupted before durable checkpoint.",
      completedAt: canResume ? "" : nowIso(),
      updatedAt: nowIso()
    };
  });
  if (recoveredCount) state.updatedAt = nowIso();
  return { state, recoveredCount };
}

function requeueFailedAgentJob(stateValue, jobId) {
  const state = normalizeAgentState(stateValue);
  const index = state.jobs.findIndex((job) => job.id === jobId);
  if (index < 0) throw new Error("Content Agent job was not found.");
  const job = state.jobs[index];
  if (job.state !== "failed") throw new Error("Only failed Content Agent jobs can be recovered.");
  const jobPipelineVersion = Number(String(job.asanaVersion || "").match(/\|pipeline:(\d+)$/)?.[1] || 0);
  if (jobPipelineVersion !== CONTENT_AGENT_PIPELINE_VERSION) {
    throw new Error("This failed run belongs to a retired pipeline. Start a new campaign run instead.");
  }
  const recoveryAttempts = Number(job.recoveryAttempts || 0);
  if (recoveryAttempts >= 2) {
    state.jobs[index] = {
      ...job,
      state: "dead_letter",
      statusMessage: "Recovery budget exhausted. Manual source correction is required before a new run.",
      deadLetteredAt: nowIso(),
      updatedAt: nowIso()
    };
    state.updatedAt = nowIso();
    return { state, job: state.jobs[index], requeued: false };
  }
  const updatedAt = nowIso();
  state.jobs[index] = {
    ...job,
    state: "queued",
    priority: Math.max(90, Number(job.priority || 0)),
    progress: 0,
    statusMessage: `Recovery ${recoveryAttempts + 1}/2 queued by operator.`,
    error: "",
    checkpoint: null,
    resumeStage: "",
    completedAt: "",
    recoveryAttempts: recoveryAttempts + 1,
    updatedAt
  };
  state.updatedAt = updatedAt;
  return { state, job: state.jobs[index], requeued: true };
}

function rejectAndRestartAgentJob(stateValue, jobId) {
  const state = normalizeAgentState(stateValue);
  const index = state.jobs.findIndex((job) => job.id === String(jobId || ""));
  if (index < 0) throw new Error("Content Agent job was not found.");
  const rejectedJob = state.jobs[index];
  if (rejectedJob.state !== "ready_for_review") {
    throw new Error("Only a campaign that is ready for review can be manually rejected and restarted.");
  }
  const rootJobId = String(rejectedJob.restartRootJobId || rejectedJob.id);
  const restartNumber = state.jobs.filter((job) => String(job.restartRootJobId || "") === rootJobId).length + 1;
  const restartedJob = createAgentJob({
    campaignTask: {
      gid: rejectedJob.campaignTaskGid,
      name: rejectedJob.campaignTaskName,
      modifiedAt: rejectedJob.asanaModifiedAt,
      asanaVersion: currentPipelineVersion(rejectedJob.asanaVersion, rejectedJob.asanaModifiedAt)
    },
    contentTask: {
      gid: rejectedJob.contentTaskGid,
      name: rejectedJob.contentTaskName
    },
    source: "manual",
    direction: rejectedJob.direction
  });
  restartedJob.restartOfJobId = rejectedJob.id;
  restartedJob.restartRootJobId = rootJobId;
  restartedJob.restartNumber = restartNumber;
  restartedJob.statusMessage = `Restart ${restartNumber} queued from the original brief after manual rejection.`;
  restartedJob.priority = 100;

  const rejectedAt = nowIso();
  const archivedJob = {
    ...rejectedJob,
    state: "rejected",
    progress: 100,
    statusMessage: `Manually rejected. A clean restart was created as ${restartedJob.id}.`,
    manuallyRejectedAt: rejectedAt,
    supersededByJobId: restartedJob.id,
    completedAt: rejectedAt,
    updatedAt: rejectedAt,
    policy: CONTENT_AGENT_POLICY
  };
  state.jobs = [restartedJob, ...state.jobs.map((job, jobIndex) => jobIndex === index ? archivedJob : job)].slice(0, 60);
  state.processedTasks[restartedJob.campaignTaskGid] = restartedJob.asanaVersion || restartedJob.createdAt;
  state.updatedAt = rejectedAt;
  return { state, rejectedJob: archivedJob, job: restartedJob };
}

function restartQualityExhaustedAgentJob(stateValue, jobId, { qualitySummary = "", maxRestarts = 2 } = {}) {
  const state = normalizeAgentState(stateValue);
  const index = state.jobs.findIndex((job) => job.id === String(jobId || ""));
  if (index < 0) throw new Error("Content Agent job was not found.");
  const exhaustedJob = state.jobs[index];
  if (exhaustedJob.state !== "quality_blocked") throw new Error("Only a quality-blocked campaign can receive an automatic creative reset.");
  const qualityRestartNumber = Number(exhaustedJob.qualityRestartNumber || 0) + 1;
  if (qualityRestartNumber > maxRestarts) return { state, job: null, exhaustedJob, restarted: false };
  const rootJobId = String(exhaustedJob.restartRootJobId || exhaustedJob.id);
  const direction = [
    exhaustedJob.direction,
    `AUTOMATIC CREATIVE RESET ${qualityRestartNumber}/${maxRestarts}: Abandon the exhausted execution route and create a materially different campaign system from the original locked brief.`,
    qualitySummary ? `Previous Quality Director diagnosis: ${qualitySummary}` : "Use a new hierarchy, image choreography and persuasion structure; do not cosmetically revise the previous route."
  ].filter(Boolean).join("\n\n");
  const restartedJob = createAgentJob({
    campaignTask: { gid: exhaustedJob.campaignTaskGid, name: exhaustedJob.campaignTaskName, modifiedAt: exhaustedJob.asanaModifiedAt, asanaVersion: currentPipelineVersion(exhaustedJob.asanaVersion, exhaustedJob.asanaModifiedAt) },
    contentTask: { gid: exhaustedJob.contentTaskGid, name: exhaustedJob.contentTaskName },
    source: "manual",
    direction
  });
  restartedJob.priority = 95;
  restartedJob.restartOfJobId = exhaustedJob.id;
  restartedJob.restartRootJobId = rootJobId;
  restartedJob.qualityRestartNumber = qualityRestartNumber;
  restartedJob.statusMessage = `Creative reset ${qualityRestartNumber}/${maxRestarts} queued automatically after the previous route exhausted its quality revisions.`;
  const restartedAt = nowIso();
  const archivedJob = { ...exhaustedJob, state: "superseded", qualityOutcome: "exhausted_route", statusMessage: `Quality route exhausted and automatically replaced by creative reset ${qualityRestartNumber}/${maxRestarts}.`, supersededByJobId: restartedJob.id, autoRestartedAt: restartedAt, updatedAt: restartedAt };
  state.jobs = [restartedJob, ...state.jobs.map((job, jobIndex) => jobIndex === index ? archivedJob : job)].slice(0, 60);
  state.processedTasks[restartedJob.campaignTaskGid] = restartedJob.asanaVersion || restartedJob.createdAt;
  state.updatedAt = restartedAt;
  return { state, job: restartedJob, exhaustedJob: archivedJob, restarted: true };
}

function buildContentAgentHealth(stateValue, store = {}, now = Date.now()) {
  const state = normalizeAgentState(stateValue);
  const jobs = state.jobs || [];
  const scanAt = Date.parse(state.lastScanAt || "");
  const scanAgeMinutes = Number.isFinite(scanAt) ? Math.max(0, Math.round((now - scanAt) / 60000)) : null;
  const activeJobs = jobs.filter((job) => ACTIVE_STATES.has(job.state) && job.state !== "queued");
  const staleJobs = activeJobs.filter((job) => {
    const updatedAt = Date.parse(job.updatedAt || job.startedAt || job.createdAt || "");
    return Number.isFinite(updatedAt) && now - updatedAt >= INTERRUPTED_JOB_THRESHOLD_MS;
  });
  const isCurrentPipeline = (job) => Number(String(job.asanaVersion || "").match(/\|pipeline:(\d+)$/)?.[1] || 0) === CONTENT_AGENT_PIPELINE_VERSION;
  const deadLetters = jobs.filter((job) => job.state === "dead_letter" && isCurrentPipeline(job));
  const failedJobs = jobs.filter((job) => job.state === "failed" && isCurrentPipeline(job));
  const historicalFailureCount = jobs.filter((job) => ["failed", "dead_letter"].includes(job.state) && !isCurrentPipeline(job)).length;
  const alerts = [];
  if (!store?.persistent) alerts.push({ key: "store", severity: "critical", message: "Persistent Redis storage is unavailable." });
  if (scanAgeMinutes === null) alerts.push({ key: "heartbeat", severity: "critical", message: "No successful Asana heartbeat has been recorded." });
  else if (scanAgeMinutes > 130) alerts.push({ key: "heartbeat", severity: "critical", message: `Hourly heartbeat is ${scanAgeMinutes} minutes old.` });
  else if (scanAgeMinutes > 75) alerts.push({ key: "heartbeat", severity: "warning", message: `Hourly heartbeat is delayed by ${scanAgeMinutes - 60} minutes.` });
  if (staleJobs.length) alerts.push({ key: "stale_jobs", severity: "critical", message: `${staleJobs.length} active job${staleJobs.length === 1 ? " is" : "s are"} past the recovery threshold.` });
  if (deadLetters.length) alerts.push({ key: "dead_letters", severity: "critical", message: `${deadLetters.length} job${deadLetters.length === 1 ? " has" : "s have"} exhausted recovery.` });
  if (failedJobs.length) alerts.push({ key: "failed_jobs", severity: "warning", message: `${failedJobs.length} failed job${failedJobs.length === 1 ? " is" : "s are"} ready for controlled recovery.` });
  const critical = alerts.some((alert) => alert.severity === "critical");
  const warning = alerts.some((alert) => alert.severity === "warning");
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return {
    status: critical ? "critical" : warning ? "degraded" : "healthy",
    checkedAt: new Date(now).toISOString(),
    lastHeartbeatAt: state.lastScanAt || "",
    nextExpectedHeartbeatAt: nextHour.toISOString(),
    scanAgeMinutes,
    persistentStore: Boolean(store?.persistent),
    storeMode: String(store?.mode || "unknown"),
    queueDepth: jobs.filter((job) => job.state === "queued").length,
    activeCount: activeJobs.length,
    staleCount: staleJobs.length,
    failedCount: failedJobs.length,
    deadLetterCount: deadLetters.length,
    historicalFailureCount,
    pipelineVersion: CONTENT_AGENT_PIPELINE_VERSION,
    alerts
  };
}

module.exports = {
  CONTENT_AGENT_PIPELINE_VERSION,
  CONTENT_AGENT_SOURCE_SECTION,
  CONTENT_AGENT_WORKFLOW_FILTER_VERSION,
  AGENT_SCHEDULE,
  CONTENT_AGENT_POLICY,
  MINIMUM_CONTENT_MATCH_SCORE,
  applyHourlyScan,
  applyAgentControlCommands,
  buildContentAgentHealth,
  createInitialAgentState,
  enqueueManualJob,
  findBestContentMatch,
  isCampaignSectionTask,
  getNextQueuedJob,
  normalizeAgentState,
  rejectAndRestartAgentJob,
  restartQualityExhaustedAgentJob,
  requeueFailedAgentJob,
  recoverInterruptedJobs,
  scoreContentMatch,
  transitionAgentJob
};
