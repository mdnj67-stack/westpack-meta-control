import {
  adaptationGoals,
  ads,
  auditLog,
  campaignMatches,
  campaigns,
  integrationConfig,
  loadAiPreviewSnapshot,
  loadLiveMetaSnapshot,
  patterns,
  previewTemplate,
  promptRecipe,
  queue,
  quickActions,
  recommendations,
  stats
} from "./src/data.js";
import {
  buildGenerationRequest,
  buildMetaPublishPayload,
  buildPreviewPayload,
  buildVariantSet,
  createDraftEntry,
  getAdSetOptions,
  getIntegrationCards,
  getMetaSettingsSummary,
  getPromptCards,
  requestAiPreview
} from "./src/services.js";
import {
  renderAdSetSelector,
  renderAuditLog,
  renderCampaignMatches,
  renderCampaignTable,
  renderCardList,
  renderIntegrations,
  renderPayload,
  renderPlacementSummary,
  renderPreview,
  renderSelectors,
  renderSettings,
  renderStats,
  renderVariants,
  setStudioMode,
  setStudioStatus,
  switchTab,
  toggleSettings
} from "./src/ui.js";

const appState = {
  ads,
  campaigns,
  stats,
  mode: "duplicate",
  currentPreview: null,
  currentVariants: [],
  currentVariantIndex: 0
};

function setCurrentOutput(preview, variants) {
  appState.currentPreview = preview;
  appState.currentVariants = variants;
  appState.currentVariantIndex = 0;

  renderPreview(preview);
  renderVariants(variants);
  renderPayload(buildMetaPublishPayload(preview));
}

function getInitialPreview(campaignData, adData, liveSnapshot, aiSnapshot) {
  if (aiSnapshot) {
    return {
      source: aiSnapshot.source,
      sourceId: adData[0]?.id || "",
      targetCampaign: aiSnapshot.targetCampaign,
      targetAdSet: getAdSetOptions(aiSnapshot.targetCampaign, campaignData, adData)[0],
      targetLanguage: aiSnapshot.targetLanguage,
      adFormat: document.getElementById("ad-format")?.value || "Single image",
      destinationUrl: document.getElementById("destination-url")?.value || "https://www.westpack.com/",
      creativeAssets: [],
      primaryText: aiSnapshot.primaryText,
      headline: aiSnapshot.headline,
      description: aiSnapshot.description,
      rationale: `${aiSnapshot.rationale} AI preview generated: ${aiSnapshot.generatedAt}.`
    };
  }

  if (liveSnapshot) {
    return {
      ...previewTemplate,
      source: adData[0]?.name || previewTemplate.source,
      sourceId: adData[0]?.id || "",
      targetCampaign: campaignData[0]?.name || previewTemplate.targetCampaign,
      targetAdSet: getAdSetOptions(campaignData[0]?.name, campaignData, adData)[0],
      adFormat: document.getElementById("ad-format")?.value || "Single image",
      destinationUrl: document.getElementById("destination-url")?.value || "https://www.westpack.com/",
      creativeAssets: [],
      rationale: `${previewTemplate.rationale} Live Meta snapshot loaded: ${liveSnapshot.generatedAt}.`
    };
  }

  return {
    ...previewTemplate,
    sourceId: adData[0]?.id || "",
    targetAdSet: getAdSetOptions(campaignData[0]?.name, campaignData, adData)[0],
    adFormat: document.getElementById("ad-format")?.value || "Single image",
    destinationUrl: document.getElementById("destination-url")?.value || "https://www.westpack.com/",
    creativeAssets: []
  };
}

function initializeApp() {
  const liveSnapshot = loadLiveMetaSnapshot();
  const aiSnapshot = loadAiPreviewSnapshot();
  const campaignData = liveSnapshot?.campaigns?.length ? liveSnapshot.campaigns : campaigns;
  const adData = liveSnapshot?.ads?.length ? liveSnapshot.ads : ads;
  const statData = liveSnapshot?.stats?.length ? liveSnapshot.stats : stats;

  appState.campaigns = campaignData;
  appState.ads = adData;
  appState.stats = statData;

  renderStats(statData);
  renderCampaignTable(campaignData);
  renderCardList("recommendations", recommendations, "recommendation");
  renderCardList("pattern-list", patterns, "pattern-item");
  renderCardList("queue-list", queue, "queue-item");
  renderCardList("action-list", quickActions, "action-item");
  renderAuditLog(auditLog);
  renderCampaignMatches(campaignMatches);
  renderSelectors({
    ads: adData,
    campaigns: campaignData,
    adaptationGoals
  });

  const initialAdSets = getAdSetOptions(campaignData[0]?.name, campaignData, adData);
  renderAdSetSelector(initialAdSets);
  renderPlacementSummary({
    campaign: campaignData[0]?.name,
    adSet: initialAdSets[0],
    format: document.getElementById("ad-format")?.value || "Single image"
  });

  const initialPreview = getInitialPreview(campaignData, adData, liveSnapshot, aiSnapshot);
  const initialVariants = aiSnapshot?.variants?.length ? aiSnapshot.variants : buildVariantSet(initialPreview);
  setCurrentOutput(initialPreview, initialVariants);

  renderIntegrations(getIntegrationCards(integrationConfig));
  renderSettings({
    meta: getMetaSettingsSummary(integrationConfig),
    openAi: integrationConfig.openAi,
    promptCards: getPromptCards(promptRecipe)
  });
  setStudioMode(appState.mode);
  setStudioStatus("Ready.");
}

function updatePlacementSummary() {
  renderPlacementSummary({
    campaign: document.getElementById("target-campaign").value,
    adSet: document.getElementById("target-adset").value,
    format: document.getElementById("ad-format").value
  });
}

async function generateAiPreview() {
  setStudioStatus("Generating AI preview...", "loading");

  try {
    const requestBody = buildGenerationRequest({
      ads: appState.ads,
      mode: appState.mode
    });

    const result = await requestAiPreview(requestBody);
    const preview = result.preview;
    const variants = result.variants?.length ? result.variants : buildVariantSet(preview);
    setCurrentOutput(preview, variants);
    setStudioStatus(`AI preview ready. ${result.model || "OpenAI"} responded.`, "success");
  } catch (error) {
    const fallbackPreview = buildPreviewPayload({
      ads: appState.ads,
      integrationConfig,
      mode: appState.mode
    });
    const fallbackVariants = buildVariantSet(fallbackPreview);
    setCurrentOutput(fallbackPreview, fallbackVariants);
    setStudioStatus(`AI fallback preview loaded. ${error.message}`, "warning");
  }
}

function saveDraftPreview() {
  const preview = createDraftEntry(buildPreviewPayload({
    ads: appState.ads,
    integrationConfig,
    mode: appState.mode
  }));
  const variants = buildVariantSet(preview);
  setCurrentOutput(preview, variants);
  setStudioStatus("Draft saved locally.", "success");
}

function useNextVariant() {
  if (!appState.currentPreview || !appState.currentVariants.length) {
    setStudioStatus("Generate a preview first.", "warning");
    return;
  }

  appState.currentVariantIndex = (appState.currentVariantIndex + 1) % appState.currentVariants.length;
  const nextVariant = appState.currentVariants[appState.currentVariantIndex];
  const nextPreview = {
    ...appState.currentPreview,
    primaryText: nextVariant.body,
    headline: nextVariant.headline,
    rationale: nextVariant.angle
  };

  appState.currentPreview = nextPreview;
  renderPreview(nextPreview);
  renderPayload(buildMetaPublishPayload(nextPreview));
  setStudioStatus(`Using ${nextVariant.title.toLowerCase()}.`, "success");
}

function attachEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-jump='studio']").forEach((button) => {
    button.addEventListener("click", () => switchTab("studio"));
  });

  document.querySelectorAll("[data-jump='settings']").forEach((button) => {
    button.addEventListener("click", () => toggleSettings(true));
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.mode = button.dataset.mode;
      setStudioMode(appState.mode);
      setStudioStatus("Ready.");
    });
  });

  document.getElementById("target-campaign").addEventListener("change", (event) => {
    const adSets = getAdSetOptions(event.target.value, appState.campaigns, appState.ads);
    renderAdSetSelector(adSets);
    renderPlacementSummary({
      campaign: event.target.value,
      adSet: adSets[0],
      format: document.getElementById("ad-format").value
    });
  });

  document.getElementById("target-adset").addEventListener("change", () => {
    updatePlacementSummary();
  });

  document.getElementById("ad-format").addEventListener("change", () => {
    updatePlacementSummary();
  });

  document.getElementById("generate-button").addEventListener("click", async () => {
    await generateAiPreview();
  });

  document.getElementById("draft-button").addEventListener("click", () => {
    saveDraftPreview();
  });

  document.getElementById("duplicate-variant-button").addEventListener("click", () => {
    useNextVariant();
  });

  document.getElementById("push-meta-button").addEventListener("click", () => {
    setStudioStatus("Meta push comes next. AI preview is ready.", "warning");
  });

  document.getElementById("close-settings").addEventListener("click", () => {
    toggleSettings(false);
  });

  document.getElementById("settings-drawer").addEventListener("click", (event) => {
    if (event.target.id === "settings-drawer") {
      toggleSettings(false);
    }
  });
}

initializeApp();
attachEvents();
