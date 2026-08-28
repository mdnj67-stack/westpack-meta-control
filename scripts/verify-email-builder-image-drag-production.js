const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("../tmp/playwright-runner/node_modules/playwright");

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

  const browser = await chromium.launch({ headless: true });
  console.log("STAGE browser launched");
  try {
    const context = await browser.newContext({ viewport: { width: 1550, height: 1100 } });
    const login = await context.request.post("https://project-4fcxa.vercel.app/api/auth/login", {
      data: { password: environment.AUTH_PASSWORD }
    });
    if (!login.ok()) throw new Error(`Production login returned ${login.status()}.`);
    console.log("STAGE authenticated");

    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const browserErrors = [];
    const hostingResponses = [];
    const proxyResponses = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("response", async (response) => {
      if (!response.url().includes("/api/campaign/brain")) return;
      if (response.request().method() === "GET" && response.url().includes("action=asset_proxy")) {
        proxyResponses.push({
          status: response.status(),
          contentType: response.headers()["content-type"] || "",
          body: response.status() >= 400 ? (await response.text().catch(() => "")).slice(0, 500) : ""
        });
        return;
      }
      if (response.request().method() !== "POST") return;
      const requestBody = response.request().postData() || "";
      if (!requestBody.includes("host_email_asset")) return;
      hostingResponses.push({ status: response.status(), body: (await response.text().catch(() => "")).slice(0, 500) });
    });
    await page.goto("https://project-4fcxa.vercel.app/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.body.dataset.workspace), null, { timeout: 30_000 });
    console.log("STAGE workspace loaded");
    await page.locator('[data-workspace="klaviyo"]:visible').first().click();
    await page.locator('[data-klaviyo-view="campaign_brain"]:visible').first().click();
    await page.locator("[data-content-agent-open]").first().click();
    await page.locator('[data-campaign-studio-view="email"]').click();
    const builder = page.locator(".campaign-email-builder");
    await builder.waitFor({ state: "visible", timeout: 30_000 });
    console.log("STAGE email builder opened");
    await page.waitForTimeout(2_000);
    await page.locator('[data-email-builder-inspector-tab="image"]').click();
    await page.locator('[data-email-builder-image-target="module"]').click();
    const convertToImage = page.locator('[data-email-builder-convert-image="image_full"]');
    if (await convertToImage.isVisible()) {
      await convertToImage.click();
      await page.waitForTimeout(700);
    }

    const layout = await page.evaluate(() => {
      const box = document.querySelector(".campaign-email-builder")?.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      const frame = document.querySelector(".campaign-email-builder-device iframe")?.getBoundingClientRect();
      return {
        viewport,
        builderWidth: Math.round(box?.width || 0),
        viewportShare: Math.round(((box?.width || 0) / viewport) * 100),
        canvasWidth: Math.round(frame?.width || 0),
        canvasHeight: Math.round(frame?.height || 0)
      };
    });
    if (layout.viewportShare < 90) throw new Error(`Builder only uses ${layout.viewportShare}% of the viewport.`);

    const asset = page.locator('[data-email-builder-image-url][data-email-builder-image-hosted="false"]').first();
    await asset.waitFor({ state: "visible", timeout: 30_000 });
    console.log("STAGE source asset ready");
    await page.evaluate(() => {
      document.querySelector('[data-email-builder-image-url][data-email-builder-image-hosted="false"]')
        ?.scrollIntoView({ block: "center", inline: "nearest" });
    });
    console.log("STAGE source asset scrolled into view");
    await page.waitForTimeout(300);
    const assetBox = await asset.boundingBox();
    console.log(`STAGE source asset measured ${JSON.stringify(assetBox)}`);
    if (!assetBox) throw new Error("Image drag source has no layout box.");

    await page.mouse.move(assetBox.x + assetBox.width / 2, assetBox.y + assetBox.height / 2);
    console.log("STAGE pointer moved to source");
    await page.mouse.down();
    console.log("STAGE pointer pressed");
    const dragStart = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      const builderClass = document.querySelector(".campaign-email-builder")?.className || "";
      return {
        active: builderClass.includes("is-builder-image-dragging"),
        hit: hit?.outerHTML?.slice(0, 400) || "",
        builderClass
      };
    }, { x: assetBox.x + assetBox.width / 2, y: assetBox.y + assetBox.height / 2 });
    if (!dragStart.active) throw new Error(`Image drag did not start; dragStart=${JSON.stringify({ ...dragStart, assetBox })}`);
    console.log("STAGE image drag surface active");
    const targetBox = await page.evaluate(() => {
      const node = document.querySelector('.campaign-email-builder-canvas-drop [data-email-builder-accepts-image="true"]');
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    console.log(`STAGE image target measured ${JSON.stringify(targetBox)}`);
    if (!targetBox) throw new Error("Compatible image module has no layout box.");
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 4 });
    console.log("STAGE pointer moved to image target");
    await page.mouse.up();
    console.log("STAGE image dropped");

    await page.waitForFunction(() => {
      const field = document.querySelector('.campaign-email-builder-inspector [data-email-module-field="imageUrl"]');
      const value = String(field?.value || "");
      return /^https:\/\//.test(value) && !value.includes("app.asana.com") && !value.includes("asanausercontent.com");
    }, null, { timeout: 50_000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => ({
        status: document.querySelector("[data-email-builder-save-state]")?.textContent?.trim() || "",
        imageUrl: document.querySelector('.campaign-email-builder-inspector [data-email-module-field="imageUrl"]')?.value || "",
        selected: document.querySelector(".campaign-email-builder-outline article.is-active [data-email-builder-select]")?.getAttribute("data-email-builder-select") || "",
        builderClass: document.querySelector(".campaign-email-builder")?.className || ""
      }));
      throw new Error(`${error.message}; diagnostic=${JSON.stringify({ ...diagnostic, hostingResponses, assetBox, targetBox })}`);
    });

    const selectedIndex = await page.locator(".campaign-email-builder-outline article.is-active [data-email-builder-select]").getAttribute("data-email-builder-select");
    const hostedImageUrl = await page.locator('.campaign-email-builder-inspector [data-email-module-field="imageUrl"]').inputValue();
    await page.waitForFunction((expected) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return [...(frame?.contentDocument?.images || [])].some((image) => image.src === expected);
    }, hostedImageUrl, { timeout: 30_000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => {
        const frame = document.querySelector(".campaign-email-builder-device iframe");
        return {
          layout: document.querySelector(".campaign-email-builder-outline article.is-active strong")?.textContent?.trim() || "",
          images: [...(frame?.contentDocument?.images || [])].map((image) => image.src).slice(0, 12),
          bodyHasImage: Boolean(frame?.contentDocument?.querySelector("[data-email-module] img"))
        };
      });
      throw new Error(`${error.message}; canvas=${JSON.stringify(diagnostic)}`);
    });
    console.log("STAGE initial image hosted and rendered");
    const selectedLayout = (await page.locator(".campaign-email-builder-outline article.is-active strong").textContent() || "").trim();

    await page.locator('[data-email-builder-crop-open="0"]:visible').first().click();
    const cropStudio = page.locator(".campaign-email-crop-studio");
    await cropStudio.waitFor({ state: "visible", timeout: 30_000 });
    await cropStudio.locator('[data-email-module-field="imageAspect"]').selectOption("square");
    await cropStudio.locator('[data-email-module-field="imageZoom"]').fill("125");
    await cropStudio.locator('[data-email-builder-focal-point="bottom_right"]').click();
    await cropStudio.locator("[data-email-builder-crop-apply]").click();
    console.log("STAGE crop submitted");
    await cropStudio.waitFor({ state: "hidden", timeout: 50_000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => ({
        cropError: document.querySelector(".campaign-email-crop-error")?.textContent?.trim() || "",
        saveState: document.querySelector("[data-email-builder-save-state]")?.textContent?.trim() || "",
        applyLabel: document.querySelector("[data-email-builder-crop-apply]")?.textContent?.trim() || ""
      }));
      throw new Error(`${error.message}; crop=${JSON.stringify({ ...diagnostic, hostingResponses, proxyResponses })}`);
    });
    console.log("STAGE crop dialog closed");
    await page.waitForFunction((previousUrl) => {
      const field = document.querySelector('.campaign-email-builder-inspector [data-email-module-field="imageUrl"]');
      return /^https:\/\//.test(String(field?.value || "")) && field.value !== previousUrl;
    }, hostedImageUrl, { timeout: 50_000 });
    const croppedImageUrl = await page.locator('.campaign-email-builder-inspector [data-email-module-field="imageUrl"]').inputValue();
    await page.waitForFunction((expected) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return [...(frame?.contentDocument?.images || [])].some((image) => image.src === expected);
    }, croppedImageUrl, { timeout: 30_000 });
    console.log("STAGE cropped image rendered");

    await page.locator('[data-email-builder-image-target="hero"]').click();
    const hostedHeroAsset = page.locator('[data-email-builder-hero-asset-url][data-email-builder-image-hosted="true"]').last();
    await hostedHeroAsset.waitFor({ state: "visible", timeout: 30_000 });
    const selectedHeroUrl = await hostedHeroAsset.getAttribute("data-email-builder-hero-asset-url");
    await hostedHeroAsset.click();
    console.log(`STAGE hero asset clicked ${selectedHeroUrl}`);
    await page.waitForFunction((expectedUrl) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return [...(frame?.contentDocument?.images || [])].some((image) => image.src === expectedUrl);
    }, selectedHeroUrl, { timeout: 30_000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => {
        const frame = document.querySelector(".campaign-email-builder-device iframe");
        return {
          heroUrl: document.querySelector('[data-campaign-artifact-field="email.heroImageUrl"]')?.value || "",
          heroLayout: document.querySelector('[data-campaign-artifact-field="email.heroLayout"]')?.value || "",
          heroModeVisible: Boolean(document.querySelector("[data-email-builder-hero-image-remove]")),
          heroRegion: frame?.contentDocument?.querySelector('[data-email-region="hero"]')?.outerHTML?.slice(0, 500) || "",
          frameImages: [...(frame?.contentDocument?.images || [])].map((image) => image.src).slice(0, 12),
          saveState: document.querySelector("[data-email-builder-save-state]")?.textContent?.trim() || ""
        };
      });
      throw new Error(`${error.message}; hero=${JSON.stringify({ ...diagnostic, selectedHeroUrl })}`);
    });
    console.log("STAGE hero assigned");
    await page.locator("[data-email-builder-hero-image-remove]").click();
    await page.waitForFunction((removedUrl) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return ![...(frame?.contentDocument?.images || [])].some((image) => image.src === removedUrl);
    }, selectedHeroUrl, { timeout: 30_000 });
    console.log("STAGE hero removed");

    await page.locator('[data-email-builder-image-target="module"]').click();
    await page.locator('[data-email-builder-image-remove="0"]').click();
    await page.waitForFunction((removedUrl) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return ![...(frame?.contentDocument?.images || [])].some((image) => image.src === removedUrl);
    }, croppedImageUrl, { timeout: 30_000 });
    console.log("STAGE module image removed");
    const restoreAsset = page.locator(`[data-email-builder-image-url="${croppedImageUrl}"]`).first();
    await restoreAsset.waitFor({ state: "visible", timeout: 30_000 });
    await restoreAsset.click();
    await page.waitForFunction((expected) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return [...(frame?.contentDocument?.images || [])].some((image) => image.src === expected);
    }, croppedImageUrl, { timeout: 30_000 });
    console.log("STAGE module image restored");

    await page.screenshot({ path: "test-results/email-workspace-production.png", fullPage: true });

    const result = {
      ok: selectedIndex === "0" && selectedLayout === "Full-width image" && browserErrors.length === 0,
      layout,
      imageMouseDrop: true,
      selectedModuleTarget: Number(selectedIndex) + 1,
      visibleModuleLayout: selectedLayout,
      imageRenderedInCanvas: true,
      permanentKlaviyoUrl: /^https:\/\//.test(hostedImageUrl) && !hostedImageUrl.includes("asana"),
      cropZoomAndFocus: croppedImageUrl !== hostedImageUrl,
      heroAssignAndRemove: true,
      moduleRemoveAndRestore: true,
      browserErrors
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok || !result.permanentKlaviyoUrl) throw new Error("Production image drag verification failed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
