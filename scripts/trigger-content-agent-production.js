const fs = require("node:fs/promises");
const path = require("node:path");

const environmentPath = path.resolve(process.cwd(), ".env.agent-prod.tmp");

function parseEnv(source) {
  return String(source || "").split(/\r?\n/).reduce((values, line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) return values;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[match[1]] = value;
    return values;
  }, {});
}

async function main() {
  const environment = parseEnv(await fs.readFile(environmentPath, "utf8"));
  const action = process.argv[2] === "agent_work" ? "agent_work" : "agent_discover";
  let authorizationHeaders = {};
  if (environment.CRON_SECRET) {
    authorizationHeaders = { Authorization: `Bearer ${environment.CRON_SECRET}` };
  } else if (environment.AUTH_PASSWORD) {
    const login = await fetch("https://project-4fcxa.vercel.app/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: environment.AUTH_PASSWORD })
    });
    if (!login.ok) throw new Error("Production login failed.");
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] || "";
    if (!cookie) throw new Error("Production login did not return a session.");
    authorizationHeaders = { Cookie: cookie };
  } else {
    throw new Error("Production trigger credentials are unavailable.");
  }
  const response = await fetch("https://project-4fcxa.vercel.app/api/campaign/brain", {
    headers: {
      ...authorizationHeaders,
      "X-Content-Agent-Action": action
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${action} returned ${response.status}.`);
  console.log(JSON.stringify({
    ok: true,
    action,
    busy: Boolean(payload.busy),
    discoveredCount: payload.discoveredCount,
    queueDepth: payload.queueDepth,
    unmatchedCount: payload.summary?.unmatchedCount || 0,
    openCampaigns: payload.summary?.campaignCount || 0,
    eligibleKlaviyoPending: payload.summary?.eligibleCount || 0,
    klaviyoAlreadyCompleted: payload.summary?.klaviyoCompletedCount || 0,
    missingSetupSubtask: payload.summary?.missingSetupCount || 0,
    prunedFromQueue: payload.summary?.prunedCount || 0,
    continuousWorkerQueued: Boolean(payload.continuation?.queued),
    publishCapability: payload.publishCapability
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => fs.unlink(environmentPath).catch(() => {}));
