const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("../tmp/playwright-runner/node_modules/playwright");

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
  if (!environment.AUTH_PASSWORD) throw new Error("Production auth credential is unavailable.");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const login = await context.request.post("https://project-4fcxa.vercel.app/api/auth/login", {
      data: { password: environment.AUTH_PASSWORD }
    });
    if (!login.ok()) throw new Error(`Production login returned ${login.status()}.`);
    const page = await context.newPage();
    await page.goto("https://project-4fcxa.vercel.app/", { waitUntil: "domcontentloaded" });
    await page.locator('[data-workspace="klaviyo"]:visible').first().click();
    await page.locator('[data-klaviyo-view="campaign_brain"]:visible').first().click();
    const reviewButton = page.locator("[data-content-agent-open]").first();
    await reviewButton.waitFor({ state: "visible", timeout: 30000 });
    await reviewButton.click();
    await page.locator(".campaign-studio-source-film img").first().waitFor({ state: "visible", timeout: 30000 });
    await page.locator('[data-campaign-studio-view="email"]').click();
    const frameImages = page.frameLocator(".campaign-studio-email-artboard iframe").locator("img");
    await frameImages.first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForFunction(() => {
      const frame = document.querySelector(".campaign-studio-email-artboard iframe");
      const images = frame?.contentDocument?.querySelectorAll("img") || [];
      return images.length > 0 && [...images].every((image) => image.complete && image.naturalWidth > 0);
    }, null, { timeout: 30000 });
    const result = await frameImages.evaluateAll((images) => ({
      imageCount: images.length,
      loadedCount: images.filter((image) => image.complete && image.naturalWidth > 0).length,
      dimensions: images.map((image) => ({ width: image.naturalWidth, height: image.naturalHeight })),
      proxiedCount: images.filter((image) => image.src.includes("action=asset_proxy")).length
    }));
    console.log(JSON.stringify({ ok: result.imageCount > 0 && result.loadedCount === result.imageCount, ...result }, null, 2));
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => fs.unlink(environmentPath).catch(() => {}));
