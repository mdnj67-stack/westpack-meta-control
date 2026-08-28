function renderSimpleSelectOptions(targetId, items = [], selectedValue = "") {
  const target = document.getElementById(targetId);
  if (!target) return;

  const options = Array.isArray(items) && items.length
    ? items
    : [{ id: "", name: "No options available" }];
  target.innerHTML = options.map((item) => `
    <option value="${item.id || ""}">${item.name || item.id || ""}</option>
  `).join("");

  const safeValue = options.some((item) => String(item.id || "") === String(selectedValue || ""))
    ? String(selectedValue || "")
    : String(options[0]?.id || "");
  target.value = safeValue;
}

function getSourceCampaignOptions(appState) {
  const campaignMap = new Map();
  (appState.campaigns || []).forEach((campaign) => {
    const id = String(campaign?.id || campaign?.name || "").trim();
    const name = String(campaign?.name || "").trim();
    if (!name) return;
    campaignMap.set(name, { id, name });
  });

  (appState.ads || []).forEach((ad) => {
    const name = String(ad?.campaign || "").trim();
    if (!name || campaignMap.has(name)) return;
    campaignMap.set(name, { id: name, name });
  });

  return [...campaignMap.values()];
}

function getSourceAdSetOptions(appState, campaignId = "", campaignName = "") {
  const adSetMap = new Map();

  (appState.adSets || []).forEach((adSet) => {
    const matchesCampaign = campaignId
      ? String(adSet?.campaignId || "") === String(campaignId || "")
      : String(adSet?.campaignName || "") === String(campaignName || "");
    if (!matchesCampaign) return;
    const name = String(adSet?.name || "").trim();
    if (!name) return;
    adSetMap.set(name, { id: name, name });
  });

  (appState.ads || []).forEach((ad) => {
    const matchesCampaign = String(ad?.campaign || "") === String(campaignName || "");
    if (!matchesCampaign) return;
    const name = String(ad?.adset || "").trim();
    if (!name || adSetMap.has(name)) return;
    adSetMap.set(name, { id: name, name });
  });

  return [...adSetMap.values()];
}

function getSourceAdOptions(appState, campaignName = "", adSetName = "") {
  return (appState.ads || [])
    .filter((ad) => {
      if (campaignName && String(ad?.campaign || "") !== String(campaignName || "")) return false;
      if (adSetName && String(ad?.adset || "") !== String(adSetName || "")) return false;
      return true;
    })
    .map((ad) => ({
      id: ad.id,
      name: `${ad.name} - ${ad.adset || ad.campaign || "Unknown ad set"}`
    }));
}

export function syncDuplicateTargetLanguageFieldsAction(nextValue = "", sourceId = "") {
  const normalizedValue = String(nextValue || "").trim();
  if (!normalizedValue) return;
  ["dup-bulk-target-language"].forEach((id) => {
    if (sourceId && id === sourceId) return;
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) return;
    if (!Array.from(select.options).some((option) => option.value === normalizedValue)) return;
    if (select.value !== normalizedValue) {
      select.value = normalizedValue;
    }
  });
}

export function syncDuplicateTargetBuilderStateAction({
  appState,
  getDuplicatePrimaryTarget,
  getDuplicatePublishTargets,
  getDuplicateTargetKey,
  hasPersistedDuplicateTarget
}) {
  const button = document.getElementById("dup-add-target-button");
  const meta = document.getElementById("dup-bulk-target-meta");
  const currentTarget = getDuplicatePrimaryTarget();
  const currentKey = currentTarget ? getDuplicateTargetKey(currentTarget) : "";
  const inBatch = Boolean(currentKey && hasPersistedDuplicateTarget(currentKey));

  if (button) {
    button.textContent = inBatch ? "In batch" : "Add target";
    button.disabled = !currentTarget || inBatch;
    button.title = !currentTarget
      ? "Pick campaign, ad set and language first."
      : inBatch
        ? "This target is already in the batch."
        : "";
  }

  if (meta && !getDuplicatePublishTargets().length) {
    meta.textContent = currentTarget
      ? (inBatch ? "Target already in batch" : "Ready to add")
      : "No targets";
  }
}

export function getDuplicatePrimaryTargetAction({
  getInputValue,
  getModeIds,
  getSelectedLabel
}) {
  const ids = getModeIds("duplicate");
  const targetCampaignId = getInputValue(ids.targetCampaign);
  const targetAdSetId = getInputValue(ids.targetAdSet);
  const targetCampaignName = getSelectedLabel(ids.targetCampaign);
  const targetAdSetName = getSelectedLabel(ids.targetAdSet);
  const targetLanguage = getInputValue(ids.targetLanguage);
  const targetLanguageLabel = getSelectedLabel(ids.targetLanguage);

  if (!targetCampaignId || !targetAdSetId || targetAdSetName === "No ad set found" || !targetLanguage) {
    return null;
  }

  return {
    campaignId: targetCampaignId,
    campaignName: targetCampaignName,
    adSetId: targetAdSetId,
    adSetName: targetAdSetName,
    language: targetLanguage,
    languageLabel: targetLanguageLabel
  };
}

export function syncDuplicateSourceSelectorsAction({
  appState,
  getInputValue,
  getModeIds,
  getSelectedLabel,
  preferred = {}
}) {
  const ids = getModeIds("duplicate");
  const currentCampaignId = preferred.campaignId ?? getInputValue(ids.sourceCampaign);
  const currentAdSetName = preferred.adSetName ?? getInputValue(ids.sourceAdSet);
  const currentAdId = preferred.adId ?? getInputValue(ids.sourceAd);

  const campaignOptions = getSourceCampaignOptions(appState);
  renderSimpleSelectOptions(ids.sourceCampaign, campaignOptions, currentCampaignId);

  const selectedCampaignName = getSelectedLabel(ids.sourceCampaign);
  const selectedCampaignId = getInputValue(ids.sourceCampaign);
  const adSetOptions = getSourceAdSetOptions(appState, selectedCampaignId, selectedCampaignName);
  renderSimpleSelectOptions(ids.sourceAdSet, adSetOptions, currentAdSetName);

  const selectedAdSetName = getInputValue(ids.sourceAdSet);
  const adOptions = getSourceAdOptions(appState, selectedCampaignName, selectedAdSetName);
  renderSimpleSelectOptions(ids.sourceAd, adOptions, currentAdId);
}

export function sanitizeDuplicateBulkTargetsAction({
  appState,
  getDuplicatePrimaryTarget,
  getDuplicateTargetKey,
  syncDuplicateCreativeEditorKey
}) {
  const validCampaignIds = new Set((appState.campaigns || []).map((campaign) => String(campaign?.id || campaign?.name || "")));
  const validAdSetIds = new Set((appState.adSets || []).map((adSet) => String(adSet?.id || "")));
  appState.duplicateBulkTargets = (appState.duplicateBulkTargets || []).filter((target) => (
    validCampaignIds.has(String(target?.campaignId || ""))
    && validAdSetIds.has(String(target?.adSetId || ""))
    && String(target?.language || "").trim()
  ));
  const validKeys = new Set((appState.duplicateBulkTargets || []).map((target) => getDuplicateTargetKey(target)));
  const primary = getDuplicatePrimaryTarget();
  if (primary) {
    validKeys.add(getDuplicateTargetKey(primary));
  }
  appState.duplicateBatchPreviews = (appState.duplicateBatchPreviews || []).filter((entry) => validKeys.has(entry.key));
  const overrides = appState.duplicateCreativeOverrides || {};
  appState.duplicateCreativeOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([key]) => validKeys.has(key))
  );
  syncDuplicateCreativeEditorKey();
}

export function setDuplicateActivePreviewAction({
  appState,
  buildVariantSet,
  getDuplicateBatchEntry,
  key = "",
  options = {},
  renderDuplicateBulkTargets,
  renderDuplicateCreativeOverridePanel,
  setCurrentOutput
}) {
  const entry = getDuplicateBatchEntry(key);
  if (!entry?.preview) return false;
  appState.duplicateActivePreviewKey = key;
  appState.duplicateCreativeEditorKey = key;
  setCurrentOutput(entry.preview, entry.variants || buildVariantSet(entry.preview), {
    syncFields: options.syncFields === true,
    signature: false
  });
  renderDuplicateBulkTargets();
  renderDuplicateCreativeOverridePanel();
  return true;
}

export function addCurrentDuplicateTargetAction({
  appState,
  cloneDuplicateTarget,
  focusDuplicateTargetEditor,
  getDuplicatePrimaryTarget,
  getDuplicateTargetKey,
  markPreviewDirty,
  setDuplicateReviewOpen,
  setStudioStatus,
  syncDuplicateTargetBuilderState,
  syncDuplicateTargetLanguageFields
}) {
  const target = getDuplicatePrimaryTarget();
  if (!target) {
    setStudioStatus("Select a valid target campaign, ad set and language first.", "warning");
    return;
  }

  const key = getDuplicateTargetKey(target);
  const exists = (appState.duplicateBulkTargets || []).some((item) => getDuplicateTargetKey(item) === key);
  if (exists) {
    focusDuplicateTargetEditor(target);
    setStudioStatus("Target already in batch.", "success");
    syncDuplicateTargetBuilderState();
    return;
  }

  appState.duplicateBulkTargets = [...(appState.duplicateBulkTargets || []), cloneDuplicateTarget(target)];
  setDuplicateReviewOpen(false);
  focusDuplicateTargetEditor(target);

  let nextLanguage = "";
  if (target?.campaignId && target?.adSetId) {
    const select = document.getElementById("dup-bulk-target-language");
    if (select instanceof HTMLSelectElement) {
      const usedLanguages = new Set(
        (appState.duplicateBulkTargets || [])
          .filter((item) => String(item?.campaignId || "") === String(target.campaignId) && String(item?.adSetId || "") === String(target.adSetId))
          .map((item) => String(item?.language || "").trim())
          .filter(Boolean)
      );
      const options = Array.from(select.options)
        .map((option) => String(option.value || "").trim())
        .filter(Boolean);
      nextLanguage = options.find((value) => !usedLanguages.has(value)) || "";
    }
  }
  if (nextLanguage) {
    syncDuplicateTargetLanguageFields(nextLanguage, "");
  }
  const panel = document.getElementById("dup-creative-override-panel");
  if (panel instanceof HTMLElement) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  markPreviewDirty("Bulk targets changed. Generate preview again.");
  setStudioStatus(
    nextLanguage
      ? `Added ${target.languageLabel}. Next language ready.`
      : `Added ${target.languageLabel}.`,
    "success"
  );
  syncDuplicateTargetBuilderState();
}

export function removeDuplicateBulkTargetAction({
  appState,
  buildVariantSet,
  getDuplicateTargetKey,
  key = "",
  markPreviewDirty,
  renderDuplicateBulkTargets,
  renderDuplicateCreativeOverridePanel,
  setCurrentOutput
}) {
  appState.duplicateBulkTargets = (appState.duplicateBulkTargets || []).filter((item) => getDuplicateTargetKey(item) !== key);
  appState.duplicateBatchPreviews = (appState.duplicateBatchPreviews || []).filter((entry) => entry.key !== key);
  if (appState.duplicateActivePreviewKey === key) {
    appState.duplicateActivePreviewKey = "";
    const nextEntry = appState.duplicateBatchPreviews[0];
    if (nextEntry?.preview) {
      setCurrentOutput(nextEntry.preview, nextEntry.variants || buildVariantSet(nextEntry.preview), {
        syncFields: false,
        signature: false
      });
      appState.duplicateActivePreviewKey = nextEntry.key;
    }
  }
  renderDuplicateBulkTargets();
  renderDuplicateCreativeOverridePanel();
  markPreviewDirty("Bulk targets changed. Generate preview again.");
}
