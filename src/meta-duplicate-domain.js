export function getDuplicateTargetKeyAction(target = {}) {
  return [
    String(target?.campaignId || "").trim(),
    String(target?.adSetId || "").trim(),
    String(target?.language || "").trim()
  ].join("::");
}

export function cloneDuplicateTargetAction(target = {}) {
  return {
    campaignId: String(target?.campaignId || "").trim(),
    campaignName: String(target?.campaignName || "").trim(),
    adSetId: String(target?.adSetId || "").trim(),
    adSetName: String(target?.adSetName || "").trim(),
    language: String(target?.language || "").trim(),
    languageLabel: String(target?.languageLabel || target?.language || "").trim()
  };
}

export function normalizeDuplicateCreativeOverrideAction(override = {}) {
  const videoFiles = override?.videoFiles && typeof override.videoFiles === "object"
    ? override.videoFiles
    : {};
  const carouselFiles = Array.isArray(override?.carouselFiles)
    ? override.carouselFiles.filter(Boolean)
    : [];
  return {
    mode: override?.mode === "video" || override?.mode === "carousel" ? override.mode : "source",
    uploadedVideoVariants: Array.isArray(override?.uploadedVideoVariants)
      ? override.uploadedVideoVariants
        .map((variant) => (variant && typeof variant === "object" ? { ...variant } : null))
        .filter(Boolean)
      : [],
    uploadedCarouselVariants: Array.isArray(override?.uploadedCarouselVariants)
      ? override.uploadedCarouselVariants
        .map((variant) => (variant && typeof variant === "object" ? { ...variant } : null))
        .filter(Boolean)
      : [],
    videoFiles: {
      square: videoFiles.square || null,
      vertical: videoFiles.vertical || null
    },
    carouselFiles
  };
}

export function getDuplicateCreativeOverrideAction({ appState, key = "" }) {
  return normalizeDuplicateCreativeOverrideAction(appState.duplicateCreativeOverrides?.[key]);
}

export function upsertDuplicateCreativeOverrideAction({
  appState,
  getDuplicateCreativeOverride,
  key = "",
  nextOverride = {}
}) {
  if (!key) return;
  const current = getDuplicateCreativeOverride(key);
  appState.duplicateCreativeOverrides = {
    ...(appState.duplicateCreativeOverrides || {}),
    [key]: normalizeDuplicateCreativeOverrideAction({
      ...current,
      ...nextOverride,
      videoFiles: {
        ...(current.videoFiles || {}),
        ...(nextOverride.videoFiles || {})
      },
      carouselFiles: Array.isArray(nextOverride.carouselFiles)
        ? nextOverride.carouselFiles.filter(Boolean)
        : current.carouselFiles
    })
  };
}

export function removeDuplicateCreativeOverrideFileAction({
  getDuplicateCreativeOverride,
  key = "",
  upsertDuplicateCreativeOverride,
  variantKey = ""
}) {
  if (!key || !variantKey) return;
  const current = getDuplicateCreativeOverride(key);
  upsertDuplicateCreativeOverride(key, {
    uploadedVideoVariants: [],
    videoFiles: {
      ...current.videoFiles,
      [variantKey]: null
    }
  });
}

export function clearDuplicateCreativeOverrideCarouselFilesAction({
  key = "",
  upsertDuplicateCreativeOverride
}) {
  if (!key) return;
  upsertDuplicateCreativeOverride(key, {
    uploadedCarouselVariants: [],
    carouselFiles: []
  });
}

export function getDuplicateBatchEntryAction({ appState, key = "" }) {
  return (appState.duplicateBatchPreviews || []).find((entry) => entry.key === key) || null;
}

export function upsertDuplicateBatchEntryAction({ appState, nextEntry }) {
  if (!nextEntry?.key) return;
  const entries = Array.isArray(appState.duplicateBatchPreviews) ? [...appState.duplicateBatchPreviews] : [];
  const index = entries.findIndex((entry) => entry.key === nextEntry.key);
  if (index >= 0) {
    entries[index] = { ...entries[index], ...nextEntry };
  } else {
    entries.push(nextEntry);
  }
  appState.duplicateBatchPreviews = entries;
}

export function clearDuplicateBatchPreviewsAction({ appState }) {
  appState.duplicateBatchPreviews = [];
  appState.duplicateActivePreviewKey = "";
}

export function getDuplicateGeneratedPreviewCountAction({ appState }) {
  return (appState.duplicateBatchPreviews || []).filter((entry) => entry?.preview).length;
}

export function hasPersistedDuplicateTargetAction({ appState, getDuplicateTargetKey, key = "" }) {
  return (appState.duplicateBulkTargets || []).some((item) => getDuplicateTargetKey(item) === key);
}

export function getDuplicatePublishTargetsAction({
  appState,
  cloneDuplicateTarget,
  getDuplicatePrimaryTarget,
  getDuplicateTargetKey
}) {
  const targets = [];
  const seen = new Set();
  const primary = getDuplicatePrimaryTarget();

  const appendTarget = (target) => {
    if (!target?.campaignId || !target?.adSetId || !target?.language) return;
    const key = getDuplicateTargetKey(target);
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(cloneDuplicateTarget(target));
  };

  appendTarget(primary);
  (appState.duplicateBulkTargets || []).forEach(appendTarget);
  return targets;
}

export function getDuplicateTargetByKeyAction({ getDuplicatePublishTargets, getDuplicateTargetKey, key = "" }) {
  return getDuplicatePublishTargets().find((target) => getDuplicateTargetKey(target) === key) || null;
}

export function syncDuplicateCreativeEditorKeyAction({
  appState,
  getDuplicatePrimaryTarget,
  getDuplicatePublishTargets,
  getDuplicateTargetKey
}) {
  const targets = getDuplicatePublishTargets();
  const validKeys = new Set(targets.map((target) => getDuplicateTargetKey(target)));
  if (appState.duplicateCreativeEditorKey && validKeys.has(appState.duplicateCreativeEditorKey)) {
    return appState.duplicateCreativeEditorKey;
  }
  const primary = getDuplicatePrimaryTarget();
  const fallbackKey = primary ? getDuplicateTargetKey(primary) : (targets[0] ? getDuplicateTargetKey(targets[0]) : "");
  appState.duplicateCreativeEditorKey = fallbackKey;
  return fallbackKey;
}

export function getActiveDuplicateCreativeEditorTargetAction({
  getDuplicateTargetByKey,
  syncDuplicateCreativeEditorKey
}) {
  const key = syncDuplicateCreativeEditorKey();
  if (!key) return null;
  return getDuplicateTargetByKey(key);
}

export function focusDuplicateTargetEditorAction({
  appState,
  cloneDuplicateTarget,
  getDuplicatePrimaryTarget,
  getDuplicateTargetKey,
  renderCurrentPreviewPayload,
  renderDuplicateBulkTargets,
  renderDuplicateCreativeOverridePanel,
  setDuplicateActivePreview,
  syncActionAvailability,
  syncDuplicateTargetBuilderState,
  syncDuplicateTargetLanguageFields,
  target = null
}) {
  const nextTarget = target && target.campaignId && target.adSetId && target.language
    ? cloneDuplicateTarget(target)
    : getDuplicatePrimaryTarget();
  if (!nextTarget) return false;
  const key = getDuplicateTargetKey(nextTarget);
  appState.duplicateCreativeEditorKey = key;
  syncDuplicateTargetLanguageFields(nextTarget.language);
  const didOpenPreview = setDuplicateActivePreview(key, { syncFields: false });
  if (!didOpenPreview) {
    appState.duplicateActivePreviewKey = "";
    renderDuplicateBulkTargets();
    renderDuplicateCreativeOverridePanel();
    renderCurrentPreviewPayload();
    syncActionAvailability();
  }
  syncDuplicateTargetBuilderState();
  return true;
}

export function setDuplicateReviewOpenAction({ appState, isOpen, syncStudioChrome }) {
  appState.duplicateReviewOpen = Boolean(isOpen);
  syncStudioChrome();
}

export function ensureDuplicateTargetPersistedAction({
  appState,
  cloneDuplicateTarget,
  getDuplicatePrimaryTarget,
  getDuplicateTargetKey,
  hasPersistedDuplicateTarget,
  target = null
}) {
  const nextTarget = target && target.campaignId && target.adSetId && target.language
    ? cloneDuplicateTarget(target)
    : getDuplicatePrimaryTarget();
  if (!nextTarget) return false;
  const key = getDuplicateTargetKey(nextTarget);
  if (hasPersistedDuplicateTarget(key)) {
    return false;
  }
  appState.duplicateBulkTargets = [...(appState.duplicateBulkTargets || []), nextTarget];
  return true;
}

export function getDuplicateOverrideStatusAction({ getDuplicateCreativeOverride, getDuplicateTargetKey, target }) {
  const override = getDuplicateCreativeOverride(getDuplicateTargetKey(target));
  if (override.mode === "carousel") {
    const fileCount = Array.isArray(override.carouselFiles) ? override.carouselFiles.length : 0;
    return {
      mode: "carousel",
      label: fileCount >= 2 ? `Carousel override ready (${fileCount})` : "Carousel override incomplete",
      tone: fileCount >= 2 ? "success" : "danger"
    };
  }
  if (override.mode === "video") {
    const complete = Boolean(override.videoFiles.square && override.videoFiles.vertical);
    return {
      mode: "video",
      label: complete ? "Video override ready" : "Video override incomplete",
      tone: complete ? "success" : "danger"
    };
  }
  return {
    mode: "source",
    label: "Using source creative",
    tone: "neutral"
  };
}

export function buildDuplicateWorkflowSummaryModelAction({
  appState,
  getActiveDuplicateCreativeEditorTarget,
  getDuplicateBatchEntry,
  getDuplicateGeneratedPreviewCount,
  getDuplicateOverrideStatus,
  getDuplicatePublishTargets,
  getDuplicateTargetByKey,
  getDuplicateTargetKey,
  getInputValue,
  isModePreviewReady
}) {
  const sourceSelected = Boolean(getInputValue("dup-source-ad"));
  const targets = getDuplicatePublishTargets();
  const previewReadyCount = getDuplicateGeneratedPreviewCount();
  const activeTarget = getDuplicateTargetByKey(appState.duplicateActivePreviewKey)
    || getActiveDuplicateCreativeEditorTarget()
    || targets[0]
    || null;
  const activeOverride = activeTarget ? getDuplicateOverrideStatus(activeTarget) : null;
  const activeTargetHasPreview = activeTarget ? Boolean(getDuplicateBatchEntry(getDuplicateTargetKey(activeTarget))?.preview) : false;
  const hasIncompleteVideoOverride = getInputValue("dup-ad-format") === "Video"
    ? targets.some((target) => getDuplicateOverrideStatus(target).tone === "danger")
    : false;
  const hasIncompleteCarouselOverride = getInputValue("dup-ad-format") === "Carousel"
    ? targets.some((target) => getDuplicateOverrideStatus(target).tone === "danger")
    : false;
  const canPush = isModePreviewReady("duplicate");
  const publishPlan = targets.map((target) => {
    const key = getDuplicateTargetKey(target);
    const hasPreview = Boolean(getDuplicateBatchEntry(key)?.preview);
    const override = getDuplicateOverrideStatus(target);
    return {
      key,
      label: `${target.languageLabel} · ${target.campaignName} / ${target.adSetName}`,
      previewTone: hasPreview ? "success" : "warning",
      previewLabel: hasPreview ? "Preview ready" : "Preview pending",
      creativeTone: override.tone,
      creativeLabel: override.label
    };
  });

  return {
    sourceSelected,
    targets,
    previewReadyCount,
    activeTarget,
    activeOverride,
    activeTargetHasPreview,
    hasIncompleteVideoOverride,
    hasIncompleteCarouselOverride,
    canPush,
    publishPlan
  };
}

export function renderDuplicateWorkflowSummaryAction({
  buildDuplicateWorkflowSummaryModel,
  escapeHtml
}) {
  const host = document.getElementById("duplicate-flow-summary");
  if (!host) return;

  const model = buildDuplicateWorkflowSummaryModel();
  const activeTargetLabel = model.activeTarget
    ? `${model.activeTarget.campaignName} · ${model.activeTarget.adSetName} · ${model.activeTarget.languageLabel}`
    : "No target";
  const targetsLabel = model.targets.length
    ? `${model.targets.length} target${model.targets.length === 1 ? "" : "s"}`
    : "No targets";
  const previewLabel = model.targets.length
    ? `${model.previewReadyCount}/${model.targets.length} ready`
    : "No preview";
  const publishStatus = !model.sourceSelected
    ? { label: "Pick a source ad first", tone: "warning" }
    : !model.targets.length
      ? { label: "Add at least one valid target", tone: "warning" }
      : model.hasIncompleteVideoOverride
        ? { label: "Finish localized video uploads", tone: "danger" }
        : model.hasIncompleteCarouselOverride
          ? { label: "Finish localized carousel uploads", tone: "danger" }
          : model.canPush
            ? { label: "Ready to push batch", tone: "success" }
            : { label: "Generate previews before push", tone: "warning" };

  host.innerHTML = `
    <div class="duplicate-flow-summary-head">
      <span class="duplicate-flow-status is-${publishStatus.tone}">${publishStatus.label}</span>
    </div>
    <div class="duplicate-flow-summary-strip">
      <span class="duplicate-bulk-badge ${model.sourceSelected ? "is-success" : "is-warning"}">${model.sourceSelected ? "Source ready" : "Pick source"}</span>
      <span class="duplicate-bulk-badge ${model.targets.length ? "is-success" : "is-warning"}">${targetsLabel}</span>
      <span class="duplicate-bulk-badge ${model.previewReadyCount === model.targets.length && model.targets.length ? "is-success" : "is-warning"}">${previewLabel}</span>
      <span class="duplicate-bulk-badge ${model.activeOverride?.tone === "danger" ? "is-danger" : model.activeOverride?.tone === "success" ? "is-success" : ""}">${model.activeOverride?.label || "No active target"}</span>
      <span class="duplicate-flow-active-label">${escapeHtml(activeTargetLabel)}</span>
    </div>
  `;
}
