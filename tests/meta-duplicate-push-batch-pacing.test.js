const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function loadPreviewPublishModule() {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "meta-preview-publish.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function makeTarget(index) {
  return {
    campaignId: `campaign-${index}`,
    campaignName: `Campaign ${index}`,
    adSetId: `adset-${index}`,
    adSetName: `Ad set ${index}`,
    language: `lang-${index}`,
    languageLabel: `Language ${index}`
  };
}

test("pushing a duplicate batch does not wait after the final target", async () => {
  const { pushToMetaAction } = await loadPreviewPublishModule();

  const targets = [0, 1, 2].map(makeTarget);
  const waitCalls = [];
  const appState = { mode: "duplicate", metaConnection: null };

  await pushToMetaAction({
    appState,
    buildMetaPublishPayload: (preview) => ({ ...preview }),
    clearValidation: () => {},
    formatMetaConnectionMessage: (message) => message,
    getCreateUploadedFilesPayload: async () => [],
    getDuplicateBatchEntry: (key) => ({ preview: { key } }),
    getDuplicateCreativeOverride: () => ({ mode: "source" }),
    getDuplicatePublishTargets: () => targets,
    getDuplicateTargetKey: (target) => `${target.campaignId}::${target.adSetId}::${target.language}`,
    getInputValue: () => "",
    getModeIds: () => ({ pushButton: "push-btn" }),
    isMetaRateLimitMessage: () => false,
    mode: "duplicate",
    refreshMetaConnectionStatus: async () => true,
    requestMetaPublish: async () => ({ adId: "ad-1", status: "PAUSED" }),
    setButtonBusy: () => {},
    setDuplicateSummaryButtonsBusy: () => {},
    setStudioMode: () => {},
    setStudioStatus: () => {},
    setSyncStatus: () => {},
    syncActionAvailability: () => {},
    updateMetaStatusPill: () => {},
    uploadCreateCarouselVariantsToMeta: async () => [],
    uploadCreateImageVariantsToMeta: async () => [],
    uploadCreateVideoVariantsToMeta: async () => [],
    uploadDuplicateCarouselVariantsToMeta: async () => [],
    uploadDuplicateVideoVariantsToMeta: async () => [],
    validateBeforePush: () => ({ ok: true, issues: [] }),
    wait: async (ms) => {
      waitCalls.push(ms);
    }
  });

  assert.equal(waitCalls.length, targets.length - 1, "should pace between pushes but never wait after the last one");
});
