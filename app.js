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
  buildPreviewPayload,
  buildMetaPublishPayload,
  buildVariantSet,
  createDraftEntry,
  getIntegrationCards,
  getMetaSettingsSummary,
  getPromptCards
} from "./src/services.js";
import {
  renderAuditLog,
  renderCampaignMatches,
  renderCampaignTable,
  renderCardList,
  renderIntegrations,
  renderPayload,
  renderPreview,
  renderSelectors,
  renderSettings,
  renderStats,
  renderVariants,
  switchTab,
  toggleSettings
} from "./src/ui.js";

const appState = {
  ads,
  campaigns,
  stats
};

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
  const initialPreview = aiSnapshot ? {
    source: aiSnapshot.source,
    targetCampaign: aiSnapshot.targetCampaign,
    targetLanguage: aiSnapshot.targetLanguage,
    primaryText: aiSnapshot.primaryText,
    headline: aiSnapshot.headline,
    description: aiSnapshot.description,
    rationale: `${aiSnapshot.rationale} AI preview generated: ${aiSnapshot.generatedAt}.`
  } : liveSnapshot ? {
    ...previewTemplate,
    source: adData[0]?.name || previewTemplate.source,
    targetCampaign: campaignData[0]?.name || previewTemplate.targetCampaign,
    rationale: `${previewTemplate.rationale} Live Meta snapshot loaded: ${liveSnapshot.generatedAt}.`
  } : previewTemplate;
  renderPreview(initialPreview);
  renderVariants(aiSnapshot?.variants?.length ? aiSnapshot.variants : buildVariantSet(initialPreview));
  renderPayload(buildMetaPublishPayload(initialPreview));
  renderIntegrations(getIntegrationCards(integrationConfig));
  renderSettings({
    meta: getMetaSettingsSummary(integrationConfig),
    openAi: integrationConfig.openAi,
    promptCards: getPromptCards(promptRecipe)
  });
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

  document.getElementById("generate-button").addEventListener("click", () => {
    const preview = buildPreviewPayload({
      ads: appState.ads,
      integrationConfig
    });
    renderPreview(preview);
    renderVariants(buildVariantSet(preview));
    renderPayload(buildMetaPublishPayload(preview));
  });

  document.getElementById("draft-button").addEventListener("click", () => {
    const preview = createDraftEntry(buildPreviewPayload({
      ads: appState.ads,
      integrationConfig
    }));
    renderPreview(preview);
    renderVariants(buildVariantSet(preview));
    renderPayload(buildMetaPublishPayload(preview));
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
