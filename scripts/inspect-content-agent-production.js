const fs = require("node:fs/promises");
const path = require("node:path");

const environmentPath = path.resolve(process.cwd(), ".env.agent-prod.tmp");

function parseEnv(source) {
  return String(source || "").split(/\r?\n/).reduce((result, line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) return result;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    result[match[1]] = value;
    return result;
  }, {});
}

async function main() {
  const environment = parseEnv(await fs.readFile(environmentPath, "utf8"));
  const login = await fetch("https://project-4fcxa.vercel.app/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: environment.AUTH_PASSWORD })
  });
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] || "";
  const response = await fetch("https://project-4fcxa.vercel.app/api/campaign/brain?action=agent_status", {
    headers: { Cookie: cookie }
  });
  const payload = await response.json();
  const jobs = payload.state?.jobs || [];
  const job = [...jobs].sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))[0] || {};
  const stateCounts = jobs.reduce((counts, entry) => {
    counts[entry.state] = Number(counts[entry.state] || 0) + 1;
    return counts;
  }, {});
  const reviewedIterations = jobs.flatMap((entry) => (entry.qualityIterations || []).map((iteration) => ({
    job: entry.campaignTaskName || entry.title || entry.id,
    state: entry.state,
    iteration: iteration.iteration,
    overallScore: Number(iteration.review?.overallScore || 0),
    dimensions: Object.fromEntries((iteration.review?.dimensions || []).map((dimension) => [
      dimension.key,
      Number(dimension.score || 0)
    ]))
  })));
  const dimensionTotals = reviewedIterations.reduce((totals, iteration) => {
    Object.entries(iteration.dimensions).forEach(([key, score]) => {
      totals[key] = totals[key] || { total: 0, count: 0, minimum: 100, maximum: 0 };
      totals[key].total += score;
      totals[key].count += 1;
      totals[key].minimum = Math.min(totals[key].minimum, score);
      totals[key].maximum = Math.max(totals[key].maximum, score);
    });
    return totals;
  }, {});
  const qualityDimensionSummary = Object.fromEntries(Object.entries(dimensionTotals).map(([key, value]) => [key, {
    average: Number((value.total / value.count).toFixed(1)),
    minimum: value.minimum,
    maximum: value.maximum,
    samples: value.count
  }]));
  const recentCutoff = Date.now() - (48 * 60 * 60 * 1000);
  const recentJobs = jobs
    .filter((entry) => Date.parse(entry.createdAt || entry.updatedAt || 0) >= recentCutoff)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
    .map((entry) => {
      const latestIteration = (entry.qualityIterations || []).at(-1) || {};
      return {
        campaign: entry.campaignTaskName || entry.title || entry.id,
        state: entry.state,
        pipelineVersion: Number(String(entry.asanaVersion || "").match(/\|pipeline:(\d+)$/)?.[1] || 0),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        resumeStage: entry.resumeStage || "",
        attempts: Number(entry.attempts || 0),
        score: Number(entry.output?.qualityAudit?.score ?? latestIteration.gate?.score ?? latestIteration.review?.overallScore ?? 0),
        dimensionFloor: Number(latestIteration.gate?.dimensionFloor || 0),
        vetoFailures: latestIteration.gate?.vetoFailures || [],
        deterministicMissing: entry.output?.qualityAudit?.deterministic?.missing || [],
        reviewVerdict: latestIteration.review?.verdict || "",
        reviewSummary: latestIteration.review?.summary || "",
        criticalFailures: latestIteration.review?.criticalFailures || [],
        revisionBrief: latestIteration.review?.revisionBrief || null,
        statusMessage: entry.statusMessage || "",
        error: entry.error || ""
      };
    });
  console.log(JSON.stringify({
    totalJobs: jobs.length,
    stateCounts,
    recentJobs,
    reviewedIterations: reviewedIterations.length,
    qualityDimensionSummary,
    processedTaskVersions: Object.keys(payload.state?.processedTasks || {}).length,
    lastScanSummary: payload.state?.lastScanSummary || null,
    state: job.state,
    jobId: job.id,
    campaignTaskName: job.campaignTaskName,
    asanaVersion: job.asanaVersion,
    updatedAt: job.updatedAt,
    resumeStage: job.resumeStage,
    hasCheckpoint: Boolean(job.checkpoint),
    timeoutRetryCount: Number(job.timeoutRetryCount || 0),
    attempts: job.attempts,
    qualityScore: job.output?.qualityAudit?.score,
    qualityVerdict: job.output?.qualityAudit?.verdict,
    qualityScores: (job.qualityIterations || []).map((entry) => Number(entry.review?.overallScore || 0)),
    statusMessage: job.statusMessage,
    error: job.error,
    qualityIterations: (job.qualityIterations || []).map((entry) => ({
      iteration: entry.iteration,
      model: entry.review?.model,
      verdict: entry.review?.verdict,
      score: entry.review?.overallScore,
      summary: entry.review?.summary,
      criticalFailures: entry.review?.criticalFailures,
      dimensions: (entry.review?.dimensions || []).map((dimension) => ({
        key: dimension.key,
        score: dimension.score,
        improvements: dimension.improvements
      })),
      revisionBrief: entry.review?.revisionBrief
    })),
    producerModel: job.output?.artifactPack?.model || "",
    persistent: payload.store?.persistent,
    publishCapability: payload.policy?.publishCapability
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => fs.unlink(environmentPath).catch(() => {}));
