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

test("duplicate batch preview generation shares one strategy and runs remaining targets concurrently", async () => {
  const { generateAiPreviewAction } = await loadPreviewPublishModule();

  const targets = [0, 1, 2, 3, 4].map(makeTarget);
  const batchEntries = new Map();
  const receivedRequests = [];
  const statusMessages = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const SHARED_STRATEGY = { dominantAngle: "Premium presentation" };
  const SHARED_SUMMARY = { format: "Single image" };

  const appState = { mode: "duplicate", ads: [], duplicateActivePreviewKey: "", lastGeneratedSignature: "" };

  const result = await generateAiPreviewAction({
    appState,
    buildGenerationRequest: ({ overrides }) => ({ ...overrides }),
    buildPreviewPayload: () => ({}),
    buildVariantSet: () => [],
    clearDuplicateBatchPreviews: () => batchEntries.clear(),
    cloneDuplicateTarget: (target) => ({ ...target }),
    ensureDuplicateTargetPersisted: () => {},
    getCurrentFormSignature: () => "signature-1",
    getDuplicateBatchEntry: (key) => batchEntries.get(key) || null,
    getDuplicateGeneratedPreviewCount: () => [...batchEntries.values()].filter((entry) => entry.preview).length,
    getDuplicatePublishTargets: () => targets,
    getDuplicateTargetKey: (target) => `${target.campaignId}::${target.adSetId}::${target.language}`,
    getModeIds: () => ({ generateButton: "generate-btn" }),
    integrationConfig: {},
    mode: "duplicate",
    options: {},
    requestAiPreview: async (requestBody) => {
      receivedRequests.push(requestBody);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 15));
      inFlight -= 1;

      const isFirstCall = receivedRequests.length === 1;
      return {
        model: "test-model",
        preview: {
          targetCampaignId: requestBody.targetCampaignId,
          targetAdSetId: requestBody.targetAdSetId,
          targetLanguage: requestBody.targetLanguage,
          primaryText: `Body for ${requestBody.targetLanguage}`,
          headline: `Headline for ${requestBody.targetLanguage}`,
          strategy: isFirstCall ? SHARED_STRATEGY : null
        },
        sourceCreativeSummary: isFirstCall ? SHARED_SUMMARY : null,
        variants: []
      };
    },
    setButtonBusy: () => {},
    setCurrentOutput: () => {},
    setDuplicateActivePreview: (key) => {
      appState.duplicateActivePreviewKey = key;
    },
    setDuplicateStep: () => {},
    setDuplicateSummaryButtonsBusy: () => {},
    setPreviewLoading: () => {},
    setStudioMode: () => {},
    setStudioStatus: (message, tone) => statusMessages.push({ message, tone }),
    setCreateStep: () => {},
    upsertDuplicateBatchEntry: ({ key, ...entry }) => batchEntries.set(key, entry)
  });

  assert.equal(result, undefined);
  assert.equal(receivedRequests.length, 5, "every target must get exactly one generation request");
  assert.equal(batchEntries.size, 5, "every target must end up with a stored preview");

  assert.equal(receivedRequests[0].precomputedStrategy, undefined, "the seed target must not send a precomputed strategy");
  assert.equal(receivedRequests[0].precomputedSourceCreativeSummary, undefined);

  for (const request of receivedRequests.slice(1)) {
    assert.deepEqual(request.precomputedStrategy, SHARED_STRATEGY, "later targets must reuse the strategy detected from the seed call");
    assert.deepEqual(request.precomputedSourceCreativeSummary, SHARED_SUMMARY);
  }

  assert.ok(maxInFlight >= 2, `remaining targets must run concurrently, saw max concurrency of ${maxInFlight}`);
  assert.ok(maxInFlight <= 4, `batch concurrency must stay bounded, saw max concurrency of ${maxInFlight}`);

  assert.equal(appState.duplicateActivePreviewKey, "campaign-0::adset-0::lang-0", "the first target in original order becomes the active preview");
  assert.equal(statusMessages.at(-1).tone, "success");
});

test("a failing target does not block the rest of the batch and is reported without throwing", async () => {
  const { generateAiPreviewAction } = await loadPreviewPublishModule();

  const targets = [0, 1, 2].map(makeTarget);
  const batchEntries = new Map();
  const statusMessages = [];
  const appState = { mode: "duplicate", ads: [], duplicateActivePreviewKey: "", lastGeneratedSignature: "" };

  await generateAiPreviewAction({
    appState,
    buildGenerationRequest: ({ overrides }) => ({ ...overrides }),
    buildPreviewPayload: () => ({}),
    buildVariantSet: () => [],
    clearDuplicateBatchPreviews: () => batchEntries.clear(),
    cloneDuplicateTarget: (target) => ({ ...target }),
    ensureDuplicateTargetPersisted: () => {},
    getCurrentFormSignature: () => "signature-1",
    getDuplicateBatchEntry: (key) => batchEntries.get(key) || null,
    getDuplicateGeneratedPreviewCount: () => [...batchEntries.values()].filter((entry) => entry.preview).length,
    getDuplicatePublishTargets: () => targets,
    getDuplicateTargetKey: (target) => `${target.campaignId}::${target.adSetId}::${target.language}`,
    getModeIds: () => ({ generateButton: "generate-btn" }),
    integrationConfig: {},
    mode: "duplicate",
    options: {},
    requestAiPreview: async (requestBody) => {
      if (requestBody.targetLanguage === "lang-1") {
        throw new Error("Simulated OpenAI failure.");
      }
      return {
        model: "test-model",
        preview: {
          targetCampaignId: requestBody.targetCampaignId,
          targetAdSetId: requestBody.targetAdSetId,
          targetLanguage: requestBody.targetLanguage,
          primaryText: "Body",
          headline: "Headline",
          strategy: { dominantAngle: "Premium presentation" }
        },
        sourceCreativeSummary: { format: "Single image" },
        variants: []
      };
    },
    setButtonBusy: () => {},
    setCurrentOutput: () => {},
    setDuplicateActivePreview: (key) => {
      appState.duplicateActivePreviewKey = key;
    },
    setDuplicateStep: () => {},
    setDuplicateSummaryButtonsBusy: () => {},
    setPreviewLoading: () => {},
    setStudioMode: () => {},
    setStudioStatus: (message, tone) => statusMessages.push({ message, tone }),
    setCreateStep: () => {},
    upsertDuplicateBatchEntry: ({ key, ...entry }) => batchEntries.set(key, entry)
  });

  assert.equal(batchEntries.size, 2, "the two successful targets must still be stored");
  assert.equal(appState.duplicateActivePreviewKey, "campaign-0::adset-0::lang-0");
  const finalStatus = statusMessages.at(-1);
  assert.equal(finalStatus.tone, "warning");
  assert.match(finalStatus.message, /Simulated OpenAI failure/);
});
