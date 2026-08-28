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

function extractUrls(value = "") {
  return String(value || "").match(/https?:\/\/[^\s|"'<>]+/gi) || [];
}

function describeUrl(value = "") {
  try {
    const url = new URL(value);
    return { host: url.hostname, extension: path.extname(url.pathname).toLowerCase() || "none" };
  } catch {
    return { host: "invalid", extension: "none" };
  }
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
  const jobs = (payload.state?.jobs || []).filter((job) => job.output?.artifactPack?.artifacts);
  let freshProxyProbe = null;
  const sampleJob = jobs.find((job) => job.contentTaskGid);
  if (sampleJob) {
    const taskResponse = await fetch(`https://project-4fcxa.vercel.app/api/campaign/brain?action=asana_task&taskGid=${encodeURIComponent(sampleJob.contentTaskGid)}`, {
      headers: { Cookie: cookie }
    });
    const taskPayload = await taskResponse.json().catch(() => ({}));
    const attachment = (taskPayload.attachments || []).find((item) => /\.(?:jpe?g|png|webp|gif)(?:$|\?)/i.test(String(item?.name || "")) && item?.downloadUrl);
    if (attachment) {
      const proxyResponse = await fetch(`https://project-4fcxa.vercel.app/api/campaign/brain?action=asset_proxy&url=${encodeURIComponent(attachment.downloadUrl)}`, {
        headers: { Cookie: cookie }
      });
      freshProxyProbe = {
        status: proxyResponse.status,
        contentType: proxyResponse.headers.get("content-type") || "",
        contentLength: Number(proxyResponse.headers.get("content-length") || 0)
      };
      if (proxyResponse.body) await proxyResponse.body.cancel().catch(() => {});
    }
  }
  const summaries = await Promise.all(jobs.map(async (job) => {
    const pack = job.output.artifactPack;
    const inputAssets = Array.isArray(pack.input?.assets) ? pack.input.assets : [];
    const assetUrls = [...new Set(inputAssets.flatMap(extractUrls))];
    const html = String(pack.artifacts?.email?.bodyHtml || "");
    const emailUrls = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
    const probes = await Promise.all([...new Set([...assetUrls, ...emailUrls])].slice(0, 8).map(async (url) => {
      const descriptor = describeUrl(url);
      try {
        const probe = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
        return { ...descriptor, status: probe.status, contentType: probe.headers.get("content-type") || "" };
      } catch (error) {
        return { ...descriptor, status: 0, error: error.name || "fetch_failed" };
      }
    }));
    return {
      campaign: job.campaignTaskName,
      state: job.state,
      inputAssets: inputAssets.length,
      assetUrls: assetUrls.length,
      emailImages: emailUrls.length,
      visualAssets: Array.isArray(pack.artifacts?.email?.visualAssets) ? pack.artifacts.email.visualAssets.length : 0,
      carouselConcepts: Array.isArray(pack.artifacts?.meta?.carouselConcepts) ? pack.artifacts.meta.carouselConcepts.length : 0,
      carouselCards: (pack.artifacts?.meta?.carouselConcepts || []).reduce((count, concept) => count + (concept.cards || []).length, 0),
      probes
    };
  }));
  console.log(JSON.stringify(process.argv.includes("--proxy-only") ? { freshProxyProbe } : { freshProxyProbe, jobs: summaries }, null, 2));
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => fs.unlink(environmentPath).catch(() => {}));
