export async function generateAiPreviewAction({
  appState,
  buildGenerationRequest,
  buildPreviewPayload,
  buildVariantSet,
  clearDuplicateBatchPreviews,
  cloneDuplicateTarget,
  ensureDuplicateTargetPersisted,
  getCurrentFormSignature,
  getDuplicateBatchEntry,
  getDuplicateGeneratedPreviewCount,
  getDuplicatePublishTargets,
  getDuplicateTargetKey,
  getModeIds,
  integrationConfig,
  mode = appState.mode,
  options = {},
  requestAiPreview,
  setButtonBusy,
  setCurrentOutput,
  setDuplicateActivePreview,
  setDuplicateStep,
  setDuplicateSummaryButtonsBusy,
  setPreviewLoading,
  setStudioMode,
  setStudioStatus,
  setCreateStep,
  upsertDuplicateBatchEntry
}) {
  const ids = getModeIds(mode);
  appState.mode = mode;
  setStudioMode(mode);
  if (mode === "create") {
    setCreateStep(3);
  }
  if (mode === "duplicate") {
    setDuplicateStep(3);
  }
  setButtonBusy(ids.generateButton, true, "Generate AI preview", "Generating...");
  if (mode === "duplicate") {
    setDuplicateSummaryButtonsBusy("generate", true);
  }
  setStudioStatus("Generating AI preview...", "loading");
  setPreviewLoading(true, mode === "duplicate" ? "Building translated duplicate preview..." : "Building new ad preview...");

  try {
    if (mode === "duplicate") {
      const allTargets = getDuplicatePublishTargets();
      const targets = options.onlyMissing
        ? allTargets.filter((target) => !getDuplicateBatchEntry(getDuplicateTargetKey(target))?.preview)
        : options.activeOnly && appState.duplicateActivePreviewKey
          ? allTargets.filter((target) => getDuplicateTargetKey(target) === appState.duplicateActivePreviewKey)
          : allTargets;
      if (!targets.length) {
        if (options.onlyMissing) {
          setStudioStatus("All batch targets already have previews.", "success");
          return;
        }
        throw new Error("Select at least one valid target with a language first.");
      }

      if (!options.onlyMissing && !options.activeOnly) {
        clearDuplicateBatchPreviews();
      }
      const failures = [];
      let firstKey = "";

      for (const target of targets) {
        try {
          ensureDuplicateTargetPersisted(target);
          const requestBody = buildGenerationRequest({
            ads: appState.ads,
            mode,
            overrides: {
              targetCampaign: target.campaignName,
              targetCampaignId: target.campaignId,
              targetAdSet: target.adSetName,
              targetAdSetId: target.adSetId,
              targetLanguage: target.language
            }
          });
          const result = await requestAiPreview(requestBody);
          const preview = result.preview;
          const variants = result.variants?.length ? result.variants : buildVariantSet(preview);
          const key = getDuplicateTargetKey(target);
          upsertDuplicateBatchEntry({
            key,
            target: cloneDuplicateTarget(target),
            preview,
            variants,
            model: result.model || "OpenAI"
          });
          if (!firstKey) {
            firstKey = key;
          }
        } catch (error) {
          failures.push(`${target.campaignName} / ${target.adSetName} / ${target.languageLabel}: ${error.message || "Preview failed."}`);
        }
      }

      appState.lastGeneratedSignature = getCurrentFormSignature();
      if (!firstKey) {
        throw new Error(failures[0] || "No previews could be generated.");
      }
      setDuplicateActivePreview(firstKey, { syncFields: false });
      if (failures.length) {
        setStudioStatus(`Generated ${getDuplicateGeneratedPreviewCount()} preview(s). First error: ${failures[0]}`, "warning");
      } else {
        setStudioStatus(
          options.onlyMissing
            ? `Generated the missing duplicate previews. ${getDuplicateGeneratedPreviewCount()} target${getDuplicateGeneratedPreviewCount() === 1 ? "" : "s"} now ready.`
            : options.activeOnly
              ? "Active target preview regenerated."
              : `AI batch preview ready for ${targets.length} target${targets.length === 1 ? "" : "s"}.`,
          "success"
        );
      }
      return;
    }

    const requestBody = buildGenerationRequest({ ads: appState.ads, mode });
    const result = await requestAiPreview(requestBody);
    const preview = result.preview;
    const variants = result.variants?.length ? result.variants : buildVariantSet(preview);
    setCurrentOutput(preview, variants);
    setStudioStatus(`AI preview ready. ${result.model || "OpenAI"} responded.`, "success");
  } catch (error) {
    const fallbackPreview = buildPreviewPayload({ ads: appState.ads, integrationConfig, mode });
    const fallbackVariants = buildVariantSet(fallbackPreview);
    if (mode === "duplicate") {
      clearDuplicateBatchPreviews();
    }
    setCurrentOutput(fallbackPreview, fallbackVariants);
    setStudioStatus(`AI fallback preview loaded. ${error.message}`, "warning");
  } finally {
    setPreviewLoading(false);
    setButtonBusy(ids.generateButton, false, "Generate AI preview", "Generating...");
    if (mode === "duplicate") {
      setDuplicateSummaryButtonsBusy("generate", false);
    }
  }
}

export async function pushToMetaAction({
  appState,
  buildMetaPublishPayload,
  clearValidation,
  formatMetaConnectionMessage,
  getCreateUploadedFilesPayload,
  getDuplicateBatchEntry,
  getDuplicatePublishTargets,
  getDuplicateTargetKey,
  getDuplicateCreativeOverride,
  getInputValue,
  getModeIds,
  isMetaRateLimitMessage,
  mode = appState.mode,
  refreshMetaConnectionStatus,
  requestMetaPublish,
  setButtonBusy,
  setDuplicateSummaryButtonsBusy,
  setStudioMode,
  setStudioStatus,
  setSyncStatus,
  syncActionAvailability,
  updateMetaStatusPill,
  uploadCreateCarouselVariantsToMeta,
  uploadCreateImageVariantsToMeta,
  uploadCreateVideoVariantsToMeta,
  uploadDuplicateCarouselVariantsToMeta,
  uploadDuplicateVideoVariantsToMeta,
  validateBeforePush,
  wait
}) {
  appState.mode = mode;
  setStudioMode(mode);
  const ids = getModeIds(mode);

  clearValidation();
  const validation = validateBeforePush(mode);
  if (!validation.ok) {
    setStudioStatus(validation.issues[0]?.message || "Fix validation issues before pushing.", "warning");
    const firstInvalid = document.querySelector(".is-invalid");
    if (firstInvalid && typeof firstInvalid.focus === "function") {
      firstInvalid.focus();
    }
    syncActionAvailability();
    return;
  }

  const metaReady = await refreshMetaConnectionStatus({ silent: true });
  if (!metaReady) {
    const message = appState.metaConnection?.detail || "Meta connection failed.";
    setStudioStatus(message, "warning");
    setSyncStatus(message, "warning");
    syncActionAvailability();
    return;
  }

  setButtonBusy(ids.pushButton, true, "Push to Meta", "Pushing...");
  if (mode === "duplicate") {
    setDuplicateSummaryButtonsBusy("push", true);
  }
  setStudioStatus("Pushing to Meta...", "loading");

  try {
    if (mode === "duplicate") {
      const targets = getDuplicatePublishTargets();
      const successes = [];
      const failures = [];
      let stoppedForRateLimit = false;

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        try {
          setStudioStatus(`Pushing target ${index + 1} of ${targets.length} to Meta...`, "loading");
          const key = getDuplicateTargetKey(target);
          const entry = getDuplicateBatchEntry(key);
          if (!entry?.preview) {
            throw new Error(`Missing preview for ${target.campaignName} / ${target.adSetName} / ${target.languageLabel}.`);
          }
          const payload = buildMetaPublishPayload(entry.preview);
          const creativeOverride = getDuplicateCreativeOverride(key);
          payload.creative_override_mode = creativeOverride.mode;
          payload.uploaded_carousel_variants = creativeOverride.mode === "carousel"
            ? await uploadDuplicateCarouselVariantsToMeta(key, target)
            : [];
          payload.uploaded_video_variants = creativeOverride.mode === "video"
            ? await uploadDuplicateVideoVariantsToMeta(key, target)
            : [];
          const result = await requestMetaPublish(payload);
          successes.push({
            ...target,
            adId: result.adId,
            status: result.status
          });
          if (targets.length > 1) {
            await wait(creativeOverride.mode === "video" ? 10000 : 1200);
          }
        } catch (error) {
          const message = error.message || "Meta publish failed.";
          failures.push({
            ...target,
            message
          });
          if (isMetaRateLimitMessage(message)) {
            stoppedForRateLimit = true;
            break;
          }
        }
      }

      if (successes.length && !failures.length) {
        setStudioStatus(
          successes.length === 1
            ? `Meta ad created. Ad ID: ${successes[0].adId}. Status: ${successes[0].status}.`
            : `Meta pushed ${successes.length} ads successfully across the selected targets.`,
          "success"
        );
        return;
      }

      if (successes.length && failures.length) {
        setStudioStatus(
          stoppedForRateLimit
            ? `Meta pushed ${successes.length} ads before rate limiting paused the batch. First error: ${failures[0].message}`
            : `Meta pushed ${successes.length} ads, but ${failures.length} target${failures.length === 1 ? "" : "s"} failed. First error: ${failures[0].message}`,
          "warning"
        );
        return;
      }

      throw new Error(failures[0]?.message || "Meta publish failed.");
    }

    const payload = buildMetaPublishPayload(appState.currentPreview);
    const createFormat = getInputValue("create-ad-format");
    payload.uploaded_files = createFormat === "Single image" || createFormat === "Carousel"
      ? []
      : await getCreateUploadedFilesPayload();
    payload.uploaded_image_variants = createFormat === "Single image"
      ? await uploadCreateImageVariantsToMeta()
      : [];
    payload.uploaded_carousel_variants = createFormat === "Carousel"
      ? await uploadCreateCarouselVariantsToMeta()
      : [];
    payload.uploaded_video_variants = createFormat === "Video"
      ? await uploadCreateVideoVariantsToMeta()
      : [];
    const result = await requestMetaPublish(payload);
    setStudioStatus(`Meta ad created. Ad ID: ${result.adId}. Status: ${result.status}.`, "success");
  } catch (error) {
    const message = formatMetaConnectionMessage(error.message);
    setStudioStatus(message, "warning");
    setSyncStatus(message, "warning");
    if (/Meta token expired|Session has expired/i.test(message)) {
      appState.metaConnection = { status: "offline", detail: message };
      updateMetaStatusPill("offline", "Meta offline");
    }
  } finally {
    setButtonBusy(ids.pushButton, false, "Push to Meta", "Pushing...");
    if (mode === "duplicate") {
      setDuplicateSummaryButtonsBusy("push", false);
    }
    syncActionAvailability();
  }
}
