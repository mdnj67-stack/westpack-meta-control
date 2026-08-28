const fs = require("node:fs/promises");
const path = require("node:path");

const BASE_URL = "https://project-4fcxa.vercel.app";
const ENV_FILE = path.resolve(process.cwd(), ".env.agent-prod.tmp");

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
  const environment = parseEnv(await fs.readFile(ENV_FILE, "utf8"));
  if (!environment.AUTH_PASSWORD || !environment.CRON_SECRET) {
    throw new Error("Production verification credentials are unavailable.");
  }

  let cookie = "";
  const request = async (pathname, options = {}) => {
    const response = await fetch(`${BASE_URL}${pathname}`, {
      ...options,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) }
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const unauthorized = await fetch(`${BASE_URL}/api/campaign/brain`, {
    headers: { "X-Content-Agent-Action": "agent_scan" }
  });
  if (unauthorized.status !== 401) throw new Error(`Unauthorised scan returned ${unauthorized.status}.`);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: environment.AUTH_PASSWORD })
  });
  if (!login.response.ok || !login.payload.authenticated) throw new Error("Production login failed.");

  const initialStatus = await request("/api/campaign/brain?action=agent_status");
  if (!initialStatus.response.ok) throw new Error("Could not read initial agent status.");
  if (!initialStatus.payload.store?.persistent || initialStatus.payload.store?.mode !== "redis") {
    throw new Error("Content Agent is not using persistent Redis storage.");
  }
  if (initialStatus.payload.policy?.publishCapability !== false) {
    throw new Error("Content Agent publish capability is not hard-disabled.");
  }

  const scan = await request("/api/campaign/brain", {
    headers: {
      Authorization: `Bearer ${environment.CRON_SECRET}`,
      "X-Content-Agent-Action": "agent_scan"
    }
  });
  if (!scan.response.ok) throw new Error(`Authorised scan failed: ${scan.payload.error || scan.response.status}`);

  const [campaigns, content] = await Promise.all([
    request("/api/campaign/brain?action=asana_tasks&kind=campaign"),
    request("/api/campaign/brain?action=asana_tasks&kind=content")
  ]);
  const campaignTask = campaigns.payload.tasks?.find((task) => /wtp.*forhandler|forhandler.*wtp/i.test(task.name));
  const contentTask = content.payload.tasks?.find((task) => /wtp.*forhandler|forhandler.*wtp/i.test(task.name));
  if (!campaignTask || !contentTask) throw new Error("Could not find the live WTP campaign/content pair in Asana.");

  const startedAt = Date.now();
  const run = await request("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "agent_start",
      campaignTaskGid: campaignTask.gid,
      contentTaskGid: contentTask.gid,
      direction: "Carousel first. Produce premium Scandinavian draft concepts for human review only.",
      processNow: false
    })
  });
  if (!run.response.ok) throw new Error(`Manual agent run failed: ${run.payload.error || run.response.status}`);
  const queueResponseSeconds = (Date.now() - startedAt) / 1000;
  if (queueResponseSeconds > 30) throw new Error(`Manual agent queue response took ${queueResponseSeconds.toFixed(1)}s.`);
  let job = run.payload.job;
  const terminalStates = new Set(["ready_for_review", "quality_blocked", "failed"]);
  const continuationDeadline = Date.now() + 30 * 60 * 1000;
  while (job?.id && !terminalStates.has(job.state) && Date.now() < continuationDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const status = await request("/api/campaign/brain?action=agent_status");
    job = status.payload.state?.jobs?.find((entry) => entry.id === job.id) || job;
  }
  if (!["ready_for_review", "quality_blocked"].includes(job?.state)) throw new Error(`Agent ended in ${job?.state || "unknown"}.`);
  if (job?.publishCapability !== false || run.payload.publishCapability !== false) {
    throw new Error("Generated agent job does not enforce draft-only policy.");
  }
  if (!job?.output?.artifactPack?.artifacts?.email?.bodyHtml || !job?.output?.artifactPack?.artifacts?.meta?.headline) {
    throw new Error("Agent output is missing required email or Meta artifacts.");
  }
  const qualityGatePassed = Boolean(job.output?.qualityAudit?.gate?.passed);
  const reviewableAdmission = job.output?.qualityAudit?.admissionTier === "reviewable"
    && job.output?.qualityAudit?.verdict === "ready_with_notes";
  if ((job.state === "ready_for_review") !== (qualityGatePassed || reviewableAdmission)) {
    throw new Error("Review admission does not match the independent quality gate decision.");
  }

  const persisted = await request("/api/campaign/brain?action=agent_status");
  const persistedJob = persisted.payload.state?.jobs?.find((entry) => entry.id === job.id);
  if (!persistedJob || persistedJob.state !== job.state) {
    throw new Error("The completed job was not persisted across requests.");
  }

  console.log(JSON.stringify({
    ok: true,
    unauthorisedScanStatus: unauthorized.status,
    store: initialStatus.payload.store.mode,
    persistent: initialStatus.payload.store.persistent,
    scanDiscovered: scan.payload.discoveredCount,
    campaignTask: campaignTask.name,
    contentTask: contentTask.name,
    jobState: job.state,
    qualityScore: job.output?.qualityAudit?.score,
    qualityVerdict: job.output?.qualityAudit?.verdict,
    qualityIterations: (job.qualityIterations || []).map((entry) => ({
      iteration: entry.iteration,
      verdict: entry.review?.verdict,
      score: entry.review?.overallScore,
      dimensionFloor: entry.gate?.dimensionFloor,
      passed: entry.gate?.passed
    })),
    emailReady: Boolean(job.output?.artifactPack?.artifacts?.email?.bodyHtml),
    metaReady: Boolean(job.output?.artifactPack?.artifacts?.meta?.headline),
    blogReady: Boolean(job.output?.artifactPack?.artifacts?.blog?.bodyHtml),
    publishCapability: job.publishCapability,
    queueResponseSeconds: Number(queueResponseSeconds.toFixed(1)),
    persisted: true,
    durationSeconds: Math.round((Date.now() - startedAt) / 1000)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await fs.unlink(ENV_FILE).catch(() => {});
  });
