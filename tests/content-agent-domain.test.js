const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AGENT_SCHEDULE,
  CONTENT_AGENT_PIPELINE_VERSION,
  CONTENT_AGENT_POLICY,
  applyAgentControlCommands,
  applyHourlyScan,
  buildContentAgentHealth,
  createInitialAgentState,
  enqueueManualJob,
  rejectAndRestartAgentJob,
  restartQualityExhaustedAgentJob,
  recoverInterruptedJobs,
  requeueFailedAgentJob,
  transitionAgentJob
} = require("../server/campaign/content-agent");

const campaign = { gid: "campaign-1", name: "W34: Bliv WTP forhandler", modifiedAt: "2026-07-20T10:00:00Z", sections: ["Kampagner"], subtasks: [] };
const content = { gid: "content-1", name: "Bliv WTP Forhandler", modifiedAt: "2026-07-20T09:00:00Z" };

test("hourly scan backfills open tasks and only queues each Asana version once", () => {
  const baseline = applyHourlyScan(createInitialAgentState(), [campaign], [content]);
  assert.equal(AGENT_SCHEDULE, "0 * * * *");
  assert.equal(baseline.discovered.length, 1);
  assert.equal(baseline.discovered[0].contentTaskGid, content.gid);
  assert.equal(baseline.state.lastScanSummary.queueDepth, 1);

  const unchanged = applyHourlyScan(baseline.state, [campaign], [content]);
  assert.equal(unchanged.discovered.length, 0);

  const changedCampaign = { ...campaign, modifiedAt: "2026-07-20T11:00:00Z" };
  const completed = transitionAgentJob(unchanged.state, baseline.discovered[0].id, "ready_for_review", { progress: 100 });
  const first = applyHourlyScan(completed.state, [changedCampaign], [content]);
  assert.equal(first.discovered.length, 1);
  assert.equal(first.discovered[0].contentTaskGid, content.gid);
  assert.equal(first.discovered[0].source, "hourly_scan");

  const second = applyHourlyScan(first.state, [changedCampaign], [content]);
  assert.equal(second.discovered.length, 0);
});

test("hourly scan uses the campaign task itself when no strong content match exists", () => {
  const unrelatedContent = { gid: "content-x", name: "Christmas ribbon video", modifiedAt: content.modifiedAt };
  const scan = applyHourlyScan(createInitialAgentState(), [campaign], [unrelatedContent]);
  assert.equal(scan.discovered.length, 1);
  assert.equal(scan.discovered[0].contentTaskGid, campaign.gid);
  assert.equal(scan.discovered[0].contentSource, "campaign_task_fallback");
  assert.equal(scan.state.lastScanSummary.unmatchedCount, 1);
  assert.equal(scan.state.lastScanSummary.campaignTaskFallbackCount, 1);
  assert.equal(scan.state.lastScanSummary.queueDepth, 1);
});

test("hourly discovery supersedes an active job from an older production pipeline", () => {
  const initial = applyHourlyScan(createInitialAgentState(), [campaign], [content]);
  const oldVersion = initial.discovered[0].asanaVersion.replace(/pipeline:\d+$/, `pipeline:${CONTENT_AGENT_PIPELINE_VERSION - 1}`);
  initial.state.jobs[0].asanaVersion = oldVersion;
  initial.state.processedTasks[campaign.gid] = oldVersion;
  initial.state.jobs[0].state = "quality_review";
  const migrated = applyHourlyScan(initial.state, [campaign], [content]);
  assert.equal(migrated.discovered.length, 1);
  assert.match(migrated.discovered[0].asanaVersion, new RegExp(`pipeline:${CONTENT_AGENT_PIPELINE_VERSION}$`));
  assert.equal(migrated.state.jobs.find((job) => job.id === initial.discovered[0].id).state, "superseded");
});

test("hourly scan prunes queued work when a task leaves the Kampagner section", () => {
  const queued = applyHourlyScan(createInitialAgentState(), [campaign], [content]);
  assert.equal(queued.state.lastScanSummary.queueDepth, 1);
  const movedCampaign = {
    ...campaign,
    modifiedAt: "2026-07-20T11:00:00Z",
    sections: ["Igangværende"]
  };
  const filtered = applyHourlyScan(queued.state, [movedCampaign], [content]);
  assert.equal(filtered.discovered.length, 0);
  assert.equal(filtered.state.lastScanSummary.outsideSourceSectionCount, 1);
  assert.equal(filtered.state.lastScanSummary.prunedCount, 1);
  assert.equal(filtered.state.lastScanSummary.queueDepth, 0);
});

test("hourly scan includes Kampagner tasks without a Klaviyo setup subtask", () => {
  const scan = applyHourlyScan(createInitialAgentState(), [{ ...campaign, subtasks: [] }], [content]);
  assert.equal(scan.discovered.length, 1);
  assert.equal(scan.state.lastScanSummary.sourceProject, "E-mail Kampagner");
  assert.equal(scan.state.lastScanSummary.sourceSection, "Kampagner");
});

test("hourly scan requires the exact Kampagner section", () => {
  const scan = applyHourlyScan(createInitialAgentState(), [{ ...campaign, sections: ["Kampagner 2025 (Årshjul)"] }], [content]);
  assert.equal(scan.discovered.length, 0);
  assert.equal(scan.state.lastScanSummary.outsideSourceSectionCount, 1);
});

test("manual jobs have priority and may only end in review states", () => {
  const queued = enqueueManualJob(createInitialAgentState(), { campaignTask: campaign, contentTask: content });
  assert.equal(queued.job.priority, 100);
  assert.equal(queued.job.state, "queued");
  assert.equal(CONTENT_AGENT_POLICY.publishCapability, false);

  assert.throws(
    () => transitionAgentJob(queued.state, queued.job.id, "published"),
    /forbids publish states/
  );

  const complete = transitionAgentJob(queued.state, queued.job.id, "ready_for_review", { progress: 100 });
  assert.equal(complete.job.state, "ready_for_review");
  assert.equal(complete.job.progress, 100);
  assert.equal(complete.job.policy.publishCapability, false);
  assert.equal(complete.job.policy.qualityGateRequired, true);
});

test("operator can pause, resume and safely replace the active campaign", () => {
  const first = enqueueManualJob(createInitialAgentState(), { campaignTask: campaign, contentTask: content });
  const active = transitionAgentJob(first.state, first.job.id, "producing", {
    checkpoint: { plan: { locked: true } },
    resumeStage: "email_production",
    progress: 64
  });
  const paused = applyAgentControlCommands(active.state, [{ id: "pause-1", type: "pause", jobId: first.job.id }]);
  assert.equal(paused.state.jobs.find((job) => job.id === first.job.id).state, "paused");
  assert.deepEqual(paused.state.jobs.find((job) => job.id === first.job.id).checkpoint, { plan: { locked: true } });

  const resumed = applyAgentControlCommands(paused.state, [{ id: "resume-1", type: "resume", jobId: first.job.id }]);
  assert.equal(resumed.state.jobs.find((job) => job.id === first.job.id).state, "queued");
  assert.equal(resumed.state.jobs.find((job) => job.id === first.job.id).priority, 100);

  const activeAgain = transitionAgentJob(resumed.state, first.job.id, "quality_review", { progress: 80 });
  const takeoverCampaign = { ...campaign, gid: "campaign-2", name: "W35: New priority campaign" };
  const takeover = applyAgentControlCommands(activeAgain.state, [{
    id: "takeover-1",
    type: "takeover",
    pauseJobId: first.job.id,
    campaignTask: takeoverCampaign,
    contentTask: { ...content, gid: "content-2" },
    direction: "Lead with the strongest visual proof."
  }]);
  assert.equal(takeover.state.jobs.find((job) => job.id === first.job.id).state, "paused");
  assert.equal(takeover.createdJob.state, "queued");
  assert.equal(takeover.createdJob.priority, 120);
  assert.equal(takeover.state.jobs[0].id, takeover.createdJob.id);
  assert.match(takeover.createdJob.statusMessage, /takeover/i);
});

test("manual rejection archives the reviewed output and creates a clean priority restart", () => {
  const queued = enqueueManualJob(createInitialAgentState(), { campaignTask: campaign, contentTask: content, direction: "Carousel first" });
  const ready = transitionAgentJob(queued.state, queued.job.id, "ready_for_review", {
    progress: 100,
    output: { artifactPack: { version: 1 } },
    checkpoint: { revisionCount: 2 },
    qualityIterations: [{ iteration: 1 }]
  });
  ready.state.jobs.find((job) => job.id === ready.job.id).asanaVersion = "source|section:kampagner|pipeline:11";
  const restarted = rejectAndRestartAgentJob(ready.state, ready.job.id);
  assert.equal(restarted.rejectedJob.state, "rejected");
  assert.deepEqual(restarted.rejectedJob.output, { artifactPack: { version: 1 } });
  assert.equal(restarted.job.state, "queued");
  assert.equal(restarted.job.priority, 100);
  assert.equal(restarted.job.restartOfJobId, ready.job.id);
  assert.equal(restarted.job.restartNumber, 1);
  assert.equal(restarted.job.output, null);
  assert.equal(restarted.job.checkpoint, undefined);
  assert.equal(restarted.job.qualityIterations, undefined);
  assert.equal(restarted.job.direction, "Carousel first");
  assert.match(restarted.job.asanaVersion, new RegExp(`pipeline:${CONTENT_AGENT_PIPELINE_VERSION}$`));
  assert.doesNotMatch(restarted.job.asanaVersion, /pipeline:11$/);
  assert.equal(restarted.state.jobs[0].id, restarted.job.id);
  assert.throws(() => rejectAndRestartAgentJob(restarted.state, ready.job.id), /ready for review/);
});

test("quality-blocked jobs cannot enter review or publish states", () => {
  const queued = enqueueManualJob(createInitialAgentState(), { campaignTask: campaign, contentTask: content });
  const blocked = transitionAgentJob(queued.state, queued.job.id, "quality_blocked", { progress: 100 });
  assert.ok(blocked.job.completedAt);
  assert.throws(() => transitionAgentJob(blocked.state, blocked.job.id, "ready_for_review"), /cannot be mutated/);
  assert.throws(() => transitionAgentJob(blocked.state, blocked.job.id, "published"), /cannot be mutated|forbids publish states/);
});

test("exhausted quality routes create a bounded clean creative reset", () => {
  const queued = enqueueManualJob(createInitialAgentState(), { campaignTask: campaign, contentTask: content, direction: "Original route" });
  const blocked = transitionAgentJob(queued.state, queued.job.id, "quality_blocked", { progress: 100, output: { qualityAudit: { score: 68 } } });
  blocked.state.jobs.find((job) => job.id === blocked.job.id).asanaVersion = "source|section:kampagner|pipeline:11";
  const reset = restartQualityExhaustedAgentJob(blocked.state, blocked.job.id, { qualitySummary: "The route remained generic." });
  assert.equal(reset.restarted, true);
  assert.equal(reset.job.state, "queued");
  assert.equal(reset.job.priority, 95);
  assert.equal(reset.job.qualityRestartNumber, 1);
  assert.match(reset.job.asanaVersion, new RegExp(`pipeline:${CONTENT_AGENT_PIPELINE_VERSION}$`));
  assert.match(reset.job.direction, /materially different campaign system/i);
  assert.match(reset.job.direction, /remained generic/i);
  assert.equal(reset.exhaustedJob.supersededByJobId, reset.job.id);

  reset.job.state = "quality_blocked";
  const second = restartQualityExhaustedAgentJob(reset.state, reset.job.id, { qualitySummary: "Second route failed." });
  assert.equal(second.job.qualityRestartNumber, 2);
  second.job.state = "quality_blocked";
  const stopped = restartQualityExhaustedAgentJob(second.state, second.job.id, { maxRestarts: 2 });
  assert.equal(stopped.restarted, false);
  assert.equal(stopped.job, null);
});

test("interrupted workers resume from checkpoints and fail safely without one", () => {
  const first = enqueueManualJob(createInitialAgentState(), { campaignTask: campaign, contentTask: content });
  const active = transitionAgentJob(first.state, first.job.id, "quality_review", {
    checkpoint: { revisionCount: 1 }
  });
  const second = enqueueManualJob(active.state, {
    campaignTask: { ...campaign, gid: "campaign-2" },
    contentTask: content
  });
  const interrupted = transitionAgentJob(second.state, second.job.id, "producing");
  const latestUpdate = Math.max(...interrupted.state.jobs.map((job) => Date.parse(job.updatedAt)));
  assert.equal(recoverInterruptedJobs(interrupted.state, latestUpdate + 3 * 60 * 1000).recoveredCount, 0);
  assert.equal(recoverInterruptedJobs(interrupted.state, latestUpdate + 5 * 60 * 1000).recoveredCount, 2);
  const recovered = recoverInterruptedJobs(interrupted.state, latestUpdate + 7 * 60 * 1000);
  assert.equal(recovered.recoveredCount, 2);
  assert.equal(recovered.state.jobs.find((job) => job.id === first.job.id).state, "queued");
  assert.equal(recovered.state.jobs.find((job) => job.id === second.job.id).state, "failed");
});

test("health contract detects healthy heartbeats, overdue scans and persistent-store failure", () => {
  const scanned = applyHourlyScan(createInitialAgentState(), [campaign], [content]);
  const healthy = buildContentAgentHealth(scanned.state, { mode: "redis", persistent: true }, Date.parse(scanned.state.lastScanAt) + 30 * 60 * 1000);
  assert.equal(healthy.status, "healthy");
  assert.equal(healthy.pipelineVersion, CONTENT_AGENT_PIPELINE_VERSION);
  assert.equal(healthy.queueDepth, 1);

  const overdue = buildContentAgentHealth(scanned.state, { mode: "redis", persistent: true }, Date.parse(scanned.state.lastScanAt) + 131 * 60 * 1000);
  assert.equal(overdue.status, "critical");
  assert.ok(overdue.alerts.some((alert) => alert.key === "heartbeat"));

  const volatile = buildContentAgentHealth(scanned.state, { mode: "volatile", persistent: false }, Date.parse(scanned.state.lastScanAt) + 10 * 60 * 1000);
  assert.equal(volatile.status, "critical");
  assert.ok(volatile.alerts.some((alert) => alert.key === "store"));
});

test("failed runs have two controlled recoveries before dead letter", () => {
  const queued = enqueueManualJob(createInitialAgentState(), { campaignTask: { ...campaign, asanaVersion: `source|pipeline:${CONTENT_AGENT_PIPELINE_VERSION}` }, contentTask: content });
  const failedOnce = transitionAgentJob(queued.state, queued.job.id, "failed", { error: "First failure" });
  const recoveryOne = requeueFailedAgentJob(failedOnce.state, queued.job.id);
  assert.equal(recoveryOne.requeued, true);
  assert.equal(recoveryOne.job.recoveryAttempts, 1);
  const failedTwice = transitionAgentJob(recoveryOne.state, queued.job.id, "failed", { error: "Second failure" });
  const recoveryTwo = requeueFailedAgentJob(failedTwice.state, queued.job.id);
  assert.equal(recoveryTwo.requeued, true);
  assert.equal(recoveryTwo.job.recoveryAttempts, 2);
  const failedThird = transitionAgentJob(recoveryTwo.state, queued.job.id, "failed", { error: "Third failure" });
  const exhausted = requeueFailedAgentJob(failedThird.state, queued.job.id);
  assert.equal(exhausted.requeued, false);
  assert.equal(exhausted.job.state, "dead_letter");
  assert.ok(exhausted.job.deadLetteredAt);
});

test("controlled canary completes the full draft-only state contract", () => {
  const discovered = applyHourlyScan(createInitialAgentState(), [campaign], [content]);
  const jobId = discovered.discovered[0].id;
  const analysed = transitionAgentJob(discovered.state, jobId, "analysing", { progress: 15 });
  const produced = transitionAgentJob(analysed.state, jobId, "producing", { progress: 55, checkpoint: { plan: { locked: true } } });
  const reviewed = transitionAgentJob(produced.state, jobId, "quality_review", { progress: 85 });
  const ready = transitionAgentJob(reviewed.state, jobId, "ready_for_review", {
    progress: 100,
    output: { artifactPack: { email: true, meta: true, blog: true }, publishCapability: false }
  });
  assert.equal(ready.job.state, "ready_for_review");
  assert.equal(ready.job.output.publishCapability, false);
  assert.equal(ready.job.policy.publishCapability, false);
});
