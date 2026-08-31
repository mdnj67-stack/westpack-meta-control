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

test("re-pushing a batch does not recreate ads that already succeeded", async () => {
  const { pushToMetaAction } = await loadPreviewPublishModule();

  const targets = [0, 1].map(makeTarget);
  const getKey = (target) => `${target.campaignId}::${target.adSetId}::${target.language}`;
  const batchEntries = new Map(targets.map((t) => [getKey(t), { preview: { key: getKey(t) } }]));
  const publishCalls = [];
  const statusMessages = [];
  const appState = { mode: "duplicate", metaConnection: null };

  const deps = {
    appState,
    buildMetaPublishPayload: (preview) => ({ ...preview }),
    clearValidation: () => {},
    formatMetaConnectionMessage: (message) => message,
    getCreateUploadedFilesPayload: async () => [],
    getDuplicateBatchEntry: (key) => batchEntries.get(key) || null,
    getDuplicateCreativeOverride: () => ({ mode: "source" }),
    getDuplicatePublishTargets: () => targets,
    getDuplicateTargetKey: getKey,
    getInputValue: () => "",
    getModeIds: () => ({ pushButton: "push-btn" }),
    isMetaRateLimitMessage: () => false,
    mode: "duplicate",
    refreshMetaConnectionStatus: async () => true,
    requestMetaPublish: async (payload) => {
      publishCalls.push(payload.key);
      return { adId: `ad-${publishCalls.length}`, status: "PAUSED" };
    },
    setButtonBusy: () => {},
    setDuplicateSummaryButtonsBusy: () => {},
    setStudioMode: () => {},
    setStudioStatus: (message, tone) => statusMessages.push({ message, tone }),
    setSyncStatus: () => {},
    syncActionAvailability: () => {},
    updateMetaStatusPill: () => {},
    upsertDuplicateBatchEntry: ({ key, ...rest }) => {
      batchEntries.set(key, { ...batchEntries.get(key), ...rest });
    },
    uploadCreateCarouselVariantsToMeta: async () => [],
    uploadCreateImageVariantsToMeta: async () => [],
    uploadCreateVideoVariantsToMeta: async () => [],
    uploadDuplicateCarouselVariantsToMeta: async () => [],
    uploadDuplicateVideoVariantsToMeta: async () => [],
    validateBeforePush: () => ({ ok: true, issues: [] }),
    wait: async () => {}
  };

  await pushToMetaAction(deps);

  assert.equal(publishCalls.length, 2, "both targets should be pushed the first time");
  assert.ok(batchEntries.get(getKey(targets[0])).pushedAdId, "first target should be marked pushed");
  assert.ok(batchEntries.get(getKey(targets[1])).pushedAdId, "second target should be marked pushed");

  await pushToMetaAction(deps);

  assert.equal(publishCalls.length, 2, "clicking push again must not recreate already-pushed ads");
  assert.match(statusMessages.at(-1).message, /already/i);
});

test("a partial failure only leaves the failed target pending for the next push", async () => {
  const { pushToMetaAction } = await loadPreviewPublishModule();

  const targets = [0, 1].map(makeTarget);
  const getKey = (target) => `${target.campaignId}::${target.adSetId}::${target.language}`;
  const batchEntries = new Map(targets.map((t) => [getKey(t), { preview: { key: getKey(t) } }]));
  const publishCalls = [];
  const appState = { mode: "duplicate", metaConnection: null };
  let shouldFailSecond = true;

  const deps = {
    appState,
    buildMetaPublishPayload: (preview) => ({ ...preview }),
    clearValidation: () => {},
    formatMetaConnectionMessage: (message) => message,
    getCreateUploadedFilesPayload: async () => [],
    getDuplicateBatchEntry: (key) => batchEntries.get(key) || null,
    getDuplicateCreativeOverride: () => ({ mode: "source" }),
    getDuplicatePublishTargets: () => targets,
    getDuplicateTargetKey: getKey,
    getInputValue: () => "",
    getModeIds: () => ({ pushButton: "push-btn" }),
    isMetaRateLimitMessage: () => false,
    mode: "duplicate",
    refreshMetaConnectionStatus: async () => true,
    requestMetaPublish: async (payload) => {
      publishCalls.push(payload.key);
      if (payload.key === getKey(targets[1]) && shouldFailSecond) {
        throw new Error("Simulated transient failure.");
      }
      return { adId: `ad-${publishCalls.length}`, status: "PAUSED" };
    },
    setButtonBusy: () => {},
    setDuplicateSummaryButtonsBusy: () => {},
    setStudioMode: () => {},
    setStudioStatus: () => {},
    setSyncStatus: () => {},
    syncActionAvailability: () => {},
    updateMetaStatusPill: () => {},
    upsertDuplicateBatchEntry: ({ key, ...rest }) => {
      batchEntries.set(key, { ...batchEntries.get(key), ...rest });
    },
    uploadCreateCarouselVariantsToMeta: async () => [],
    uploadCreateImageVariantsToMeta: async () => [],
    uploadCreateVideoVariantsToMeta: async () => [],
    uploadDuplicateCarouselVariantsToMeta: async () => [],
    uploadDuplicateVideoVariantsToMeta: async () => [],
    validateBeforePush: () => ({ ok: true, issues: [] }),
    wait: async () => {}
  };

  await pushToMetaAction(deps);
  assert.equal(publishCalls.length, 2);
  assert.ok(batchEntries.get(getKey(targets[0])).pushedAdId);
  assert.ok(!batchEntries.get(getKey(targets[1])).pushedAdId);

  shouldFailSecond = false;
  await pushToMetaAction(deps);

  assert.equal(publishCalls.length, 3, "retry should only resubmit the target that previously failed");
  assert.equal(publishCalls[2], getKey(targets[1]));
  assert.ok(batchEntries.get(getKey(targets[1])).pushedAdId);
});
