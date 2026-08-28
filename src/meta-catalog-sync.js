function syncStudioSelectors({
  adSetData,
  appState,
  getAdSetOptions,
  getInputValue,
  getSelectedLabel,
  previousCreateAdSetId,
  previousCreateCampaignId,
  previousDuplicateAdSetId,
  previousDuplicateCampaignId,
  refreshModeAdSets,
  renderAdSetSelector
}) {
  const firstCampaignName = appState.campaigns[0]?.name || "";
  const firstCampaignId = appState.campaigns[0]?.id || "";
  const firstAdSets = getAdSetOptions(firstCampaignName, firstCampaignId, adSetData);
  renderAdSetSelector(firstAdSets, "duplicate");
  renderAdSetSelector(firstAdSets, "create");

  if (firstCampaignId) {
    const duplicateTarget = document.getElementById("dup-target-campaign");
    const createTarget = document.getElementById("create-target-campaign");
    if (duplicateTarget) {
      duplicateTarget.value = appState.campaigns.some((campaign) => String(campaign?.id || "") === String(previousDuplicateCampaignId || ""))
        ? previousDuplicateCampaignId
        : firstCampaignId;
    }
    if (createTarget) {
      createTarget.value = appState.campaigns.some((campaign) => String(campaign?.id || "") === String(previousCreateCampaignId || ""))
        ? previousCreateCampaignId
        : firstCampaignId;
    }
  }

  refreshModeAdSets("duplicate");
  refreshModeAdSets("create");

  const duplicateAdSetOptions = getAdSetOptions(getSelectedLabel("dup-target-campaign"), getInputValue("dup-target-campaign"), adSetData);
  const createAdSetOptions = getAdSetOptions(getSelectedLabel("create-target-campaign"), getInputValue("create-target-campaign"), adSetData);
  const duplicateAdSet = document.getElementById("dup-target-adset");
  const createAdSet = document.getElementById("create-target-adset");
  if (duplicateAdSet) {
    duplicateAdSet.value = duplicateAdSetOptions.some((item) => String(item?.id || "") === String(previousDuplicateAdSetId || ""))
      ? previousDuplicateAdSetId
      : String(duplicateAdSetOptions[0]?.id || "");
  }
  if (createAdSet) {
    createAdSet.value = createAdSetOptions.some((item) => String(item?.id || "") === String(previousCreateAdSetId || ""))
      ? previousCreateAdSetId
      : String(createAdSetOptions[0]?.id || "");
  }
}

export function renderCoreDataAction({
  accountData = null,
  adaptationGoals,
  adData,
  adSetData,
  appState,
  applyCampaignAttribution,
  auditLog,
  campaignData,
  campaignMatches,
  createQuickActions,
  dashboardData = null,
  duplicateQuickActions,
  getAdSetOptions,
  getInputValue,
  getSelectedLabel,
  renderAdSetSelector,
  renderAuditLog,
  renderCampaignMatches,
  renderCardList,
  renderDashboard,
  renderDuplicateBulkTargets,
  renderDuplicateCreativeOverridePanel,
  renderSelectors,
  resolveMetaCurrency,
  refreshModeAdSets,
  statData,
  syncDashboardSubtabs,
  syncDuplicateSourceSelectors,
  syncDuplicateTargetLanguageFields
}) {
  const previousSourceCampaignId = getInputValue("dup-source-campaign");
  const previousSourceAdSet = getInputValue("dup-source-adset");
  const previousSourceAdId = getInputValue("dup-source-ad");
  const previousDuplicateCampaignId = getInputValue("dup-target-campaign");
  const previousDuplicateAdSetId = getInputValue("dup-target-adset");
  const previousCreateCampaignId = getInputValue("create-target-campaign");
  const previousCreateAdSetId = getInputValue("create-target-adset");

  appState.campaigns = applyCampaignAttribution(campaignData, adSetData);
  appState.ads = adData;
  appState.stats = statData;
  appState.adSets = adSetData;
  appState.metaDashboard = dashboardData;
  appState.metaCurrency = resolveMetaCurrency({ accountData, dashboardData, campaigns: campaignData });
  appState.metaQuality = dashboardData?.quality || null;

  renderCardList("action-list", duplicateQuickActions, "action-item");
  renderCardList("create-checklist", createQuickActions, "action-item");
  renderAuditLog(auditLog);
  renderCampaignMatches(campaignMatches);
  renderSelectors({
    ads: adData,
    campaigns: appState.campaigns,
    adaptationGoals
  });

  syncDuplicateSourceSelectors({
    campaignId: previousSourceCampaignId,
    adSetName: previousSourceAdSet,
    adId: previousSourceAdId
  });

  syncStudioSelectors({
    adSetData,
    appState,
    getAdSetOptions,
    getInputValue,
    getSelectedLabel,
    previousCreateAdSetId,
    previousCreateCampaignId,
    previousDuplicateAdSetId,
    previousDuplicateCampaignId,
    refreshModeAdSets,
    renderAdSetSelector
  });

  syncDuplicateTargetLanguageFields(getInputValue("dup-bulk-target-language"));
  renderDuplicateBulkTargets();
  renderDuplicateCreativeOverridePanel();
  syncDashboardSubtabs();
  renderDashboard();
}

export function applyMetaStudioCatalogAction({
  adaptationGoals,
  appState,
  applyCampaignAttribution,
  catalog = {},
  getAdSetOptions,
  getInputValue,
  getSelectedLabel,
  refreshModeAdSets,
  renderAdSetSelector,
  renderDuplicateBulkTargets,
  renderDuplicateCreativeOverridePanel,
  renderSelectors,
  syncActionAvailability,
  syncDuplicateSourceSelectors,
  syncDuplicateTargetLanguageFields
}) {
  const campaignData = Array.isArray(catalog?.campaigns) ? catalog.campaigns : [];
  const adSetData = Array.isArray(catalog?.adSets) ? catalog.adSets : [];
  const adData = Array.isArray(catalog?.ads) ? catalog.ads : [];

  if (!campaignData.length && !adSetData.length && !adData.length) {
    return false;
  }

  const previousSourceCampaignId = getInputValue("dup-source-campaign");
  const previousSourceAdSet = getInputValue("dup-source-adset");
  const previousSourceAdId = getInputValue("dup-source-ad");
  const previousDuplicateCampaignId = getInputValue("dup-target-campaign");
  const previousDuplicateAdSetId = getInputValue("dup-target-adset");
  const previousCreateCampaignId = getInputValue("create-target-campaign");
  const previousCreateAdSetId = getInputValue("create-target-adset");

  appState.campaigns = applyCampaignAttribution(campaignData, adSetData);
  appState.ads = adData;
  appState.adSets = adSetData;
  appState.metaStudioCatalogGeneratedAt = String(catalog?.generatedAt || new Date().toISOString());

  renderSelectors({
    ads: adData,
    campaigns: appState.campaigns,
    adaptationGoals
  });

  syncDuplicateSourceSelectors({
    campaignId: previousSourceCampaignId,
    adSetName: previousSourceAdSet,
    adId: previousSourceAdId
  });

  syncStudioSelectors({
    adSetData,
    appState,
    getAdSetOptions,
    getInputValue,
    getSelectedLabel,
    previousCreateAdSetId,
    previousCreateCampaignId,
    previousDuplicateAdSetId,
    previousDuplicateCampaignId,
    refreshModeAdSets,
    renderAdSetSelector
  });

  syncDuplicateTargetLanguageFields(getInputValue("dup-bulk-target-language"));
  renderDuplicateBulkTargets();
  renderDuplicateCreativeOverridePanel();
  syncActionAvailability();
  return true;
}
