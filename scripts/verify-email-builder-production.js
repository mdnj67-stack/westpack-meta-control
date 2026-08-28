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
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
    const login = await context.request.post("https://project-4fcxa.vercel.app/api/auth/login", {
      data: { password: environment.AUTH_PASSWORD }
    });
    if (!login.ok()) throw new Error(`Production login returned ${login.status()}.`);

    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.goto("https://project-4fcxa.vercel.app/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.body.dataset.workspace), null, { timeout: 30000 });
    await page.locator('[data-workspace="klaviyo"]:visible').first().click();
    await page.locator('[data-klaviyo-view="campaign_brain"]:visible').first().click();
    const reviewButton = page.locator("[data-content-agent-open]").first();
    await reviewButton.waitFor({ state: "visible", timeout: 30000 });
    await reviewButton.click();
    await page.locator('[data-campaign-studio-view="email"]').click();
    await page.locator(".campaign-email-builder").waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(2500);

    const outlineCards = () => page.locator(".campaign-email-builder-outline article[data-email-builder-drag-index]");
    const outlineHeadlines = () => outlineCards().locator("small").allTextContents();
    const initialHeadlines = await outlineHeadlines();
    if (![3, 4].includes(initialHeadlines.length)) {
      throw new Error(`Expected the supported three-to-four module structure, found ${initialHeadlines.length}.`);
    }

    await outlineCards().nth(0).dragTo(outlineCards().nth(2));
    await page.waitForFunction(({ expected, count }) => {
      const headlines = [...document.querySelectorAll(".campaign-email-builder-outline article small")].map((node) => node.textContent.trim());
      return headlines.length === count && headlines[0] === expected;
    }, { expected: initialHeadlines[1], count: initialHeadlines.length }, { timeout: 30000 });
    const reorderedHeadlines = await outlineHeadlines();
    if (reorderedHeadlines[2] !== initialHeadlines[0]) throw new Error("Mouse drag did not place module 1 in position 3.");

    await page.locator("[data-email-builder-undo]").click();
    await page.waitForFunction((expected) => document.querySelector(".campaign-email-builder-outline article small")?.textContent.trim() === expected, initialHeadlines[0], { timeout: 30000 });

    await outlineCards().nth(0).locator("button").click();
    const originalLayout = (await outlineCards().nth(0).locator("strong").textContent()).trim();
    const libraryChoices = page.locator("[data-email-builder-library-module]");
    if (!(await libraryChoices.first().isVisible())) {
      await page.locator("[data-email-builder-library-toggle]").click();
      await libraryChoices.first().waitFor({ state: "visible", timeout: 30000 });
    }
    let replacementIndex = 0;
    for (let index = 0; index < await libraryChoices.count(); index += 1) {
      if ((await libraryChoices.nth(index).locator("strong").textContent()).trim() !== originalLayout) {
        replacementIndex = index;
        break;
      }
    }
    const replacementLabel = (await libraryChoices.nth(replacementIndex).locator("strong").textContent()).trim();
    const moduleCountBeforeLibraryAction = await outlineCards().count();
    await libraryChoices.nth(replacementIndex).locator("button").click();
    await page.waitForFunction(({ expected, previousCount }) => {
      const cards = [...document.querySelectorAll(".campaign-email-builder-outline article[data-email-builder-drag-index]")];
      if (previousCount < 4) {
        return cards.length === previousCount + 1 && cards.at(-1)?.querySelector("strong")?.textContent.trim() === expected;
      }
      return cards.length === previousCount && cards[0]?.querySelector("strong")?.textContent.trim() === expected;
    }, { expected: replacementLabel, previousCount: moduleCountBeforeLibraryAction }, { timeout: 30000 });

    await page.locator("[data-email-builder-undo]").click();
    await page.waitForFunction(({ expected, count }) => {
      const cards = [...document.querySelectorAll(".campaign-email-builder-outline article[data-email-builder-drag-index]")];
      return cards.length === count && cards[0]?.querySelector("strong")?.textContent.trim() === expected;
    }, { expected: originalLayout, count: moduleCountBeforeLibraryAction }, { timeout: 30000 });

    if (await outlineCards().count() === 3) {
      await outlineCards().nth(0).locator("button").click();
      await page.locator(".campaign-email-builder-inspector [data-email-builder-duplicate]").click();
      await page.waitForFunction(() => document.querySelectorAll(".campaign-email-builder-outline article[data-email-builder-drag-index]").length === 4, null, { timeout: 30000 });
    }

    await outlineCards().nth(0).locator("button").click();
    await page.locator(".campaign-email-builder-inspector [data-email-module-remove]").click();
    await page.waitForFunction(() => document.querySelectorAll(".campaign-email-builder-outline article[data-email-builder-drag-index]").length === 3, null, { timeout: 30000 });
    await page.locator(".campaign-email-builder").evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY));
    await page.waitForTimeout(300);
    const libraryDragSource = page.locator("[data-email-builder-library-module]").nth(replacementIndex);
    const endDropTarget = page.locator(".campaign-email-builder-canvas-drop [data-email-builder-drop-index]").last();
    await page.evaluate(() => {
      window.__builderDragEvents = [];
      ["pointerdown", "dragstart", "dragenter", "dragover", "drop", "dragend", "pointerup"].forEach((type) => {
        document.addEventListener(type, (event) => window.__builderDragEvents.push({
          type,
          target: event.target?.getAttribute?.("data-email-builder-drop-index")
            || event.target?.closest?.("[data-email-builder-library-module]")?.getAttribute?.("data-email-builder-library-module")
            || event.target?.tagName
            || ""
        }), true);
      });
    });
    await libraryDragSource.dragTo(endDropTarget);
    await page.waitForFunction(() => document.querySelectorAll(".campaign-email-builder-outline article[data-email-builder-drag-index]").length === 4, null, { timeout: 30000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => ({
        events: window.__builderDragEvents || [],
        moduleCount: document.querySelectorAll(".campaign-email-builder-outline article[data-email-builder-drag-index]").length,
        builderClass: document.querySelector(".campaign-email-builder")?.className || "",
        draggingModuleId: window.appState?.campaignEmailBuilder?.draggingModuleId || ""
      }));
      throw new Error(`${error.message}; drag=${JSON.stringify(diagnostic)}`);
    });

    await page.locator('[data-email-builder-preview="mobile"]').click();
    if (await page.locator(".campaign-email-builder").getAttribute("data-preview-mode") !== "mobile") throw new Error("Mobile preview did not activate.");
    await page.locator('[data-email-builder-preview="desktop"]').click();
    const zoomBefore = (await page.locator(".campaign-email-builder-zoom span").textContent()).trim();
    await page.locator('[data-email-builder-zoom="in"]').click();
    const zoomAfter = (await page.locator(".campaign-email-builder-zoom span").textContent()).trim();
    if (zoomBefore === zoomAfter) throw new Error("Canvas zoom did not change.");

    const markerCount = await page.locator(".campaign-email-builder-device iframe").evaluate((frame) =>
      [...(frame.contentDocument?.querySelectorAll("[data-email-module]") || [])]
        .filter((node) => !node.querySelector("[data-email-module]"))
        .filter((node) => node.getAttribute("data-email-region") !== "hero")
        .length
    );
    if (markerCount < 2) throw new Error(`Expected at least two selectable canvas modules, found ${markerCount}.`);

    await page.locator(".campaign-email-builder-device iframe").evaluate((frame) => {
      const modules = [...(frame.contentDocument?.querySelectorAll("[data-email-module]") || [])]
        .filter((node) => !node.querySelector("[data-email-module]"))
        .filter((node) => node.getAttribute("data-email-region") !== "hero");
      const module = modules[1];
      module?.dispatchEvent(new frame.contentWindow.MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(700);

    const selectedIndex = await page.locator(".campaign-email-builder-outline article.is-active [data-email-builder-select]").getAttribute("data-email-builder-select");
    const headlineField = page.locator('.campaign-email-builder-inspector [data-email-module-field="headline"]');
    const originalHeadline = await headlineField.inputValue();
    const editedHeadline = "Builder interaction verified";
    await headlineField.fill(editedHeadline);
    await page.waitForFunction((expected) => {
      const frame = document.querySelector(".campaign-email-builder-device iframe");
      return frame?.contentDocument?.body?.textContent?.includes(expected);
    }, editedHeadline, { timeout: 30000 });
    const selectedAfterEdit = await page.locator(".campaign-email-builder-outline article.is-active [data-email-builder-select]").getAttribute("data-email-builder-select");
    if (selectedAfterEdit !== "1") throw new Error(`Editing module 2 moved selection to module ${Number(selectedAfterEdit || 0) + 1}.`);
    await page.locator("[data-email-builder-undo]").click();
    await page.waitForTimeout(3500);
    const headlineAfterUndo = await page.locator('.campaign-email-builder-inspector [data-email-module-field="headline"]').inputValue();
    if (headlineAfterUndo !== originalHeadline) {
      const undoDebug = {
        selected: await page.locator(".campaign-email-builder-outline article.is-active [data-email-builder-select]").getAttribute("data-email-builder-select"),
        headlines: await outlineHeadlines(),
        headlineAfterUndo,
        originalHeadline
      };
      throw new Error(`Undo mismatch: ${JSON.stringify(undoDebug)}`);
    }
    await page.locator("[data-email-builder-redo]").click();
    await page.waitForTimeout(3500);
    const headlineAfterRedo = await page.locator('.campaign-email-builder-inspector [data-email-module-field="headline"]').inputValue();
    if (headlineAfterRedo !== editedHeadline) {
      const redoDebug = {
        selected: await page.locator(".campaign-email-builder-outline article.is-active [data-email-builder-select]").getAttribute("data-email-builder-select"),
        headlines: await outlineHeadlines(),
        headlineAfterRedo,
        editedHeadline
      };
      throw new Error(`Redo mismatch: ${JSON.stringify(redoDebug)}`);
    }
    const savedLocally = await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("westpack.campaignStudioDraft.")));
    const result = {
      ok: selectedIndex === "1" && savedLocally && browserErrors.length === 0,
      markerCount,
      selectedIndex,
      mouseReorder: reorderedHeadlines,
      libraryDropRestoredFourModules: await outlineCards().count() === 4,
      mobilePreview: true,
      zoom: `${zoomBefore} → ${zoomAfter}`,
      contentEditing: true,
      undoRedo: true,
      savedLocally,
      browserErrors
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) throw new Error("Direct canvas selection did not select module 2 cleanly.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`FAIL ${error.stack || error.message}`);
  process.exitCode = 1;
});
