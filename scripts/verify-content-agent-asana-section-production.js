const fs = require("node:fs/promises");
const path = require("node:path");
const { request } = require("../tmp/playwright-runner/node_modules/playwright");

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
  const environment = {};
  for (const filename of [".env.local", ".env.production", ".vercel.live.env"]) {
    const source = await fs.readFile(path.resolve(process.cwd(), filename), "utf8").catch(() => "");
    Object.assign(environment, parseEnv(source));
  }
  if (!environment.AUTH_PASSWORD) throw new Error("Production auth credential is unavailable.");
  const context = await request.newContext({ baseURL: "https://project-4fcxa.vercel.app" });
  try {
    const login = await context.post("/api/auth/login", { data: { password: environment.AUTH_PASSWORD } });
    if (!login.ok()) throw new Error(`Production login returned ${login.status()}.`);
    const response = await context.get("/api/campaign/brain?action=asana_tasks&kind=campaign");
    if (!response.ok()) throw new Error(`Asana campaign task read returned ${response.status()}.`);
    const payload = await response.json();
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const eligible = tasks.filter((task) => (task.sections || []).some((section) => String(section).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "kampagner"));
    if (!eligible.length) throw new Error("No open tasks were found in the exact Kampagner section.");
    const result = {
      ok: true,
      projectConfigured: Boolean(payload.projectGid),
      openProjectTasks: tasks.length,
      exactSection: "Kampagner",
      eligibleCount: eligible.length,
      eligibleTasks: eligible.map((task) => task.name)
    };
    if (process.argv.includes("--discover")) {
      const discoveryResponse = await context.get("/api/campaign/brain?action=agent_discover", { timeout: 30_000 });
      if (!discoveryResponse.ok()) throw new Error(`Content Agent discovery returned ${discoveryResponse.status()}.`);
      const discovery = await discoveryResponse.json();
      result.discovery = {
        busy: Boolean(discovery.busy),
        discoveredCount: Number(discovery.discoveredCount || 0),
        queueDepth: Number(discovery.queueDepth || 0),
        sourceProject: discovery.summary?.sourceProject || "",
        sourceSection: discovery.summary?.sourceSection || "",
        eligibleCount: Number(discovery.summary?.eligibleCount || 0),
        unmatchedCount: Number(discovery.summary?.unmatchedCount || 0),
        campaignTaskFallbackCount: Number(discovery.summary?.campaignTaskFallbackCount || 0),
        workflowFilterVersion: Number(discovery.summary?.workflowFilterVersion || 0),
        continuationQueued: Boolean(discovery.continuation?.queued)
      };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.dispose();
  }
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
