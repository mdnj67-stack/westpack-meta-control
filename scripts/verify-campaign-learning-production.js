const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = "https://project-4fcxa.vercel.app";

function loadEnvironment() {
  const values = {};
  for (const filename of [".env.local", ".env.production", ".vercel.live.env"]) {
    try {
      for (const line of fs.readFileSync(path.resolve(process.cwd(), filename), "utf8").split(/\r?\n/)) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (!match) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        values[match[1].trim()] = value;
      }
    } catch {}
  }
  return values;
}

async function main() {
  const environment = loadEnvironment();
  const home = await fetch(`${BASE_URL}/?learningQa=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
  const html = await home.text();
  if (!home.ok || !html.includes("20260722-learningstudio1")) throw new Error("Production app shell is stale.");

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: environment.AUTH_PASSWORD })
  });
  if (!login.ok) throw new Error(`Production login returned ${login.status}.`);
  const cookie = (login.headers.get("set-cookie") || "").split(";", 1)[0];
  const get = async (pathname) => {
    const response = await fetch(`${BASE_URL}${pathname}`, { headers: { Cookie: cookie, "Cache-Control": "no-cache" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${payload.error || "unknown error"}`);
    return payload;
  };
  const [session, systemHealth, status, learning] = await Promise.all([
    get("/api/auth/session"),
    get("/api/system/health"),
    get("/api/campaign/brain?action=agent_status"),
    get("/api/campaign/brain?action=campaign_learning_status")
  ]);
  if (status.health?.pipelineVersion !== 14) throw new Error(`Expected pipeline 14, received ${status.health?.pipelineVersion || "unknown"}.`);
  if (!status.store?.persistent || status.store?.mode !== "redis") throw new Error("Content Agent is not using Redis.");
  if (!learning.store?.persistent || learning.store?.mode !== "redis") throw new Error("Campaign learning is not using Redis.");
  if (status.policy?.publishCapability !== false) throw new Error("Draft-only production policy is missing.");
  console.log(JSON.stringify({
    ok: true,
    shellStatus: home.status,
    authenticated: session.authenticated,
    integrations: Object.fromEntries(Object.entries(systemHealth.integrations || {}).map(([key, value]) => [key, Boolean(value.configured)])),
    pipeline: status.health.pipelineVersion,
    agentHealth: status.health.status,
    agentAlerts: status.health.alerts || [],
    agentStore: status.store.mode,
    learningStore: learning.store.mode,
    learningSignals: learning.eventCount,
    establishedPatterns: learning.patternSummary?.established || 0,
    publishCapability: status.policy.publishCapability
  }, null, 2));
}

main().catch((error) => {
  console.error(`PRODUCTION QA FAIL ${error.message}`);
  process.exitCode = 1;
});
