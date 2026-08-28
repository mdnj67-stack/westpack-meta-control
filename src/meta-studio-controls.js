export function getModeIdsAction(mode = "duplicate") {
  if (mode === "create") {
    return {
      targetCampaign: "create-target-campaign",
      targetAdSet: "create-target-adset",
      targetLanguage: "create-target-language",
      adFormat: "create-ad-format",
      destinationUrl: "create-destination-url",
      brief: "create-brief",
      generateButton: "generate-create-button",
      pushButton: "push-create-button"
    };
  }

  return {
    sourceCampaign: "dup-source-campaign",
    sourceAdSet: "dup-source-adset",
    sourceAd: "dup-source-ad",
    targetCampaign: "dup-target-campaign",
    targetAdSet: "dup-target-adset",
    targetLanguage: "dup-bulk-target-language",
    adaptationGoal: "dup-adaptation-goal",
    adFormat: "dup-ad-format",
    destinationUrl: "dup-destination-url",
    brief: "dup-brief",
    generateButton: "generate-duplicate-button",
    pushButton: "push-duplicate-button"
  };
}

export function getInputValueAction(id) {
  return document.getElementById(id)?.value || "";
}

export function getSelectedLabelAction(id) {
  return document.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim() || "";
}

export function setButtonBusyAction(id, isBusy, idleLabel, busyLabel) {
  const button = document.getElementById(id);
  if (!button) {
    return;
  }

  button.disabled = isBusy;
  button.classList.toggle("is-loading", isBusy);
  button.textContent = isBusy ? busyLabel : idleLabel;
}

export function clearValidationAction() {
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
  });
}

export function markInvalidAction(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("is-invalid");
  el.setAttribute("aria-invalid", "true");
}

export function isModePreviewReadyAction({
  appState,
  canAdvanceCreateStep,
  canAdvanceDuplicateStep,
  getCurrentFormSignature,
  getDuplicateCreativeOverride,
  getDuplicateGeneratedPreviewCount,
  getDuplicatePublishTargets,
  getDuplicateTargetKey,
  getInputValue,
  getOrderedDuplicateCarouselFiles,
  isValidHttpUrl,
  mode
}) {
  if (!appState.currentPreview) return false;

  const isCreatePreview = !appState.currentPreview.sourceId;
  if (mode === "create" && !isCreatePreview) return false;
  if (mode === "duplicate" && isCreatePreview) return false;

  if (!appState.lastGeneratedSignature) return false;
  if (getCurrentFormSignature() !== appState.lastGeneratedSignature) return false;

  if (mode === "create" && !canAdvanceCreateStep(3)) return false;
  if (mode === "duplicate" && !canAdvanceDuplicateStep(3)) return false;
  if (mode === "duplicate") {
    const targets = getDuplicatePublishTargets();
    if (!targets.length) return false;
    if (getDuplicateGeneratedPreviewCount() < targets.length) return false;
    if (getInputValue("dup-ad-format") === "Video") {
      const hasBrokenOverride = targets.some((target) => {
        const override = getDuplicateCreativeOverride(getDuplicateTargetKey(target));
        return override.mode === "video" && (!override.videoFiles.square || !override.videoFiles.vertical);
      });
      if (hasBrokenOverride) return false;
    }
    if (getInputValue("dup-ad-format") === "Carousel") {
      const hasBrokenOverride = targets.some((target) => {
        const override = getDuplicateCreativeOverride(getDuplicateTargetKey(target));
        return override.mode === "carousel" && getOrderedDuplicateCarouselFiles(override.carouselFiles || []).length < 2;
      });
      if (hasBrokenOverride) return false;
      const translatedCards = Array.isArray(appState.currentPreview?.translatedAttachments)
        ? appState.currentPreview.translatedAttachments
        : [];
      const hasMismatchedOverride = translatedCards.length >= 2 && targets.some((target) => {
        const override = getDuplicateCreativeOverride(getDuplicateTargetKey(target));
        const localizedCount = getOrderedDuplicateCarouselFiles(override.carouselFiles || []).length;
        return override.mode === "carousel" && localizedCount >= 2 && localizedCount !== translatedCards.length;
      });
      if (hasMismatchedOverride) return false;
    }
  }

  if (!appState.currentPreview.targetCampaignId) return false;
  if (!appState.currentPreview.targetAdSetId) return false;
  if (!isValidHttpUrl(appState.currentPreview.destinationUrl || "")) return false;

  return true;
}

export function syncActionAvailabilityAction({
  appState,
  getDuplicateBatchEntry,
  getDuplicateGeneratedPreviewCount,
  getDuplicatePublishTargets,
  isModePreviewReady,
  syncDuplicateCreativeEditorKey,
  syncDuplicateTargetBuilderState
}) {
  const dupPush = document.getElementById("push-duplicate-button");
  const dupGenerateMissing = document.getElementById("duplicate-generate-missing-button");
  const dupOpenActive = document.getElementById("duplicate-open-active-button");
  const duplicateTargets = getDuplicatePublishTargets();
  const duplicatePreviewReadyCount = getDuplicateGeneratedPreviewCount();
  if (dupPush) {
    const ready = isModePreviewReady("duplicate");
    dupPush.disabled = false;
    dupPush.dataset.locked = ready ? "false" : "true";
    dupPush.title = ready ? "" : "Generate preview and complete the required fields before pushing.";
  }
  if (dupGenerateMissing) {
    const hasMissingPreviews = duplicateTargets.length > 0 && duplicatePreviewReadyCount < duplicateTargets.length;
    dupGenerateMissing.disabled = !hasMissingPreviews;
    dupGenerateMissing.title = hasMissingPreviews ? "" : "All batch targets already have previews.";
  }
  if (dupOpenActive) {
    const activeKey = appState.duplicateActivePreviewKey || syncDuplicateCreativeEditorKey();
    const hasActivePreview = Boolean(activeKey && getDuplicateBatchEntry(activeKey)?.preview);
    dupOpenActive.disabled = !hasActivePreview;
    dupOpenActive.title = hasActivePreview ? "" : "Generate a preview for the active target first.";
  }
  syncDuplicateTargetBuilderState();
  const createPush = document.getElementById("push-create-button");
  if (createPush) {
    const ready = isModePreviewReady("create");
    createPush.disabled = false;
    createPush.dataset.locked = ready ? "false" : "true";
    createPush.title = ready ? "" : "Generate preview and complete the required fields before pushing.";
  }
}

export function validateBeforePushAction({
  appState,
  collectCreateImageUploadSizeIssues,
  getCurrentFormSignature,
  getDuplicateCreativeOverride,
  getDuplicateGeneratedPreviewCount,
  getDuplicatePublishTargets,
  getDuplicateTargetKey,
  getInputValue,
  getModeIds,
  getOrderedDuplicateCarouselFiles,
  isValidHttpUrl,
  markInvalid,
  mode
}) {
  const ids = getModeIds(mode);
  const issues = [];

  if (!appState.currentPreview) {
    issues.push({ message: "Generate a preview first." });
    return { ok: false, issues };
  }

  if (getCurrentFormSignature() !== appState.lastGeneratedSignature) {
    issues.push({ message: "Source or destination changed. Generate AI preview again before pushing." });
    if (mode === "duplicate") {
      markInvalid(ids.sourceAd);
    }
    markInvalid(ids.targetCampaign);
    markInvalid(ids.targetAdSet);
    return { ok: false, issues };
  }

  if (!appState.currentPreview.targetCampaignId) {
    issues.push({ message: "Select a target campaign." });
    markInvalid(ids.targetCampaign);
  }

  if (!appState.currentPreview.targetAdSetId || appState.currentPreview.targetAdSet === "No ad set found") {
    issues.push({ message: "Select a valid target ad set." });
    markInvalid(ids.targetAdSet);
  }

  if (!isValidHttpUrl(appState.currentPreview.destinationUrl || "")) {
    issues.push({ message: "Destination URL must start with https:// (or http://)." });
    markInvalid(ids.destinationUrl);
  }

  if (!String(appState.currentPreview.primaryText || "").trim()) {
    issues.push({ message: "Primary text is empty. Edit it in Preview or regenerate." });
  }

  if (!String(appState.currentPreview.headline || "").trim()) {
    issues.push({ message: "Headline is empty. Edit it in Preview or regenerate." });
  }

  if (mode === "create") {
    const format = getInputValue(ids.adFormat);
    if (format === "Video") {
      const squareVideoFile = document.getElementById("create-video-square-upload")?.files?.[0];
      const verticalVideoFile = document.getElementById("create-video-vertical-upload")?.files?.[0];
      if (!squareVideoFile) {
        issues.push({ message: "Feed video (1:1) is required." });
        markInvalid("create-video-square-upload");
      }
      if (!verticalVideoFile) {
        issues.push({ message: "Stories / Reels video (9:16) is required." });
        markInvalid("create-video-vertical-upload");
      }
    } else if (format === "Single image") {
      const squareImageFile = document.getElementById("create-image-square-upload")?.files?.[0];
      const portraitImageFile = document.getElementById("create-image-portrait-upload")?.files?.[0];
      const verticalImageFile = document.getElementById("create-image-vertical-upload")?.files?.[0];
      if (!squareImageFile) {
        issues.push({ message: "Feed image (1:1) is required." });
        markInvalid("create-image-square-upload");
      }
      if (!portraitImageFile) {
        issues.push({ message: "Instagram feed image (4:5) is required." });
        markInvalid("create-image-portrait-upload");
      }
      if (!verticalImageFile) {
        issues.push({ message: "Stories / Reels image (9:16) is required." });
        markInvalid("create-image-vertical-upload");
      }
    } else if (format === "Carousel") {
      const squareCarouselCount = document.getElementById("create-carousel-square-upload")?.files?.length || 0;
      if (squareCarouselCount < 2) {
        issues.push({ message: "Carousel requires at least 2 square cards (1:1)." });
        markInvalid("create-carousel-square-upload");
      }
    } else {
      const fileCount = document.getElementById("creative-upload")?.files?.length || 0;
      if (format === "Carousel" && fileCount < 2) {
        issues.push({ message: "Carousel requires at least 2 images uploaded." });
        markInvalid("creative-upload");
      }
      if (format === "Single image" && fileCount < 1) {
        issues.push({ message: "Upload at least 1 image for Single image ads." });
        markInvalid("creative-upload");
      }
    }

    if (!String(getInputValue("new-ad-name") || "").trim()) {
      issues.push({ message: "Ad name is required." });
      markInvalid("new-ad-name");
    }

    collectCreateImageUploadSizeIssues().forEach((issue) => {
      issues.push({ message: issue.message });
      markInvalid(issue.inputId);
    });
  }

  if (mode === "duplicate") {
    if (!getInputValue(ids.sourceAd)) {
      issues.push({ message: "Select a source ad." });
      markInvalid(ids.sourceAd);
    }

    const targets = getDuplicatePublishTargets();
    if (!targets.length) {
      issues.push({ message: "Add at least one valid duplicate target with a language." });
    } else if (getDuplicateGeneratedPreviewCount() < targets.length) {
      issues.push({ message: "Generate previews for all batch targets before pushing." });
    }

    if (getInputValue(ids.adFormat) === "Video") {
      const brokenOverrideTarget = targets.find((target) => {
        const key = getDuplicateTargetKey(target);
        const override = getDuplicateCreativeOverride(key);
        return override.mode === "video" && (!override.videoFiles.square || !override.videoFiles.vertical);
      });
      if (brokenOverrideTarget) {
        issues.push({ message: `Upload both localized video files for ${brokenOverrideTarget.campaignName} / ${brokenOverrideTarget.adSetName} / ${brokenOverrideTarget.languageLabel}, or switch that target back to source creative.` });
      }
    }

    if (getInputValue(ids.adFormat) === "Carousel") {
      const cards = Array.isArray(appState.currentPreview.translatedAttachments)
        ? appState.currentPreview.translatedAttachments
        : [];
      if (cards.length > 0 && cards.length < 2) {
        issues.push({ message: "Carousel duplicate needs at least 2 cards. Regenerate preview or switch format." });
      }
      const brokenCarouselOverrideTarget = targets.find((target) => {
        const key = getDuplicateTargetKey(target);
        const override = getDuplicateCreativeOverride(key);
        return override.mode === "carousel" && getOrderedDuplicateCarouselFiles(override.carouselFiles || []).length < 2;
      });
      if (brokenCarouselOverrideTarget) {
        issues.push({ message: `Upload at least 2 localized carousel images for ${brokenCarouselOverrideTarget.campaignName} / ${brokenCarouselOverrideTarget.adSetName} / ${brokenCarouselOverrideTarget.languageLabel}, or switch that target back to source creative.` });
      }
      const mismatchedCarouselOverrideTarget = targets.find((target) => {
        const key = getDuplicateTargetKey(target);
        const override = getDuplicateCreativeOverride(key);
        const localizedCount = getOrderedDuplicateCarouselFiles(override.carouselFiles || []).length;
        return override.mode === "carousel" && cards.length >= 2 && localizedCount >= 2 && localizedCount !== cards.length;
      });
      if (mismatchedCarouselOverrideTarget) {
        issues.push({ message: `Localized carousel images must match the preview card count for ${mismatchedCarouselOverrideTarget.campaignName} / ${mismatchedCarouselOverrideTarget.adSetName} / ${mismatchedCarouselOverrideTarget.languageLabel}.` });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
