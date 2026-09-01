export function attachDuplicateStudioEventsModule({
  addCurrentDuplicateTarget,
  appState,
  canAdvanceDuplicateStep,
  ensureDuplicateTargetPersisted,
  focusDuplicateTargetEditor,
  generateAiPreview,
  getActiveDuplicateCreativeEditorTarget,
  getDuplicateTargetByKey,
  getDuplicateTargetKey,
  getInputValue,
  markPreviewDirty,
  removeDuplicateBulkTarget,
  removeDuplicateCreativeOverrideFile,
  renderCurrentPreviewPayload,
  renderDuplicateBulkTargets,
  renderDuplicateCreativeOverridePanel,
  setDuplicateActivePreview,
  setDuplicateReviewOpen,
  setDuplicateStep,
  setStudioStatus,
  syncActionAvailability,
  syncDuplicateCreativeEditorKey,
  syncDuplicateSourceSelectors,
  upsertDuplicateCreativeOverride,
  clearDuplicateCreativeOverrideCarouselFiles
}) {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const openTargetButton = target.closest("[data-open-bulk-target]");
    if (openTargetButton instanceof HTMLButtonElement && !openTargetButton.closest("#dup-bulk-target-list")) {
      const duplicateTarget = getDuplicateTargetByKey(openTargetButton.dataset.openBulkTarget || "");
      if (duplicateTarget) {
        focusDuplicateTargetEditor(duplicateTarget);
      }
      const previewCard = document.getElementById("preview-card");
      if (previewCard instanceof HTMLElement) {
        previewCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });

  document.getElementById("dup-source-campaign")?.addEventListener("change", () => {
    syncDuplicateSourceSelectors({
      campaignId: getInputValue("dup-source-campaign")
    });
    markPreviewDirty("Source campaign changed. Generate preview again.");
  });

  document.getElementById("dup-source-adset")?.addEventListener("change", () => {
    syncDuplicateSourceSelectors({
      campaignId: getInputValue("dup-source-campaign"),
      adSetName: getInputValue("dup-source-adset")
    });
    markPreviewDirty("Source ad set changed. Generate preview again.");
  });

  document.getElementById("dup-source-ad")?.addEventListener("change", () => {
    markPreviewDirty("Source ad changed. Generate preview again.");
  });

  document.getElementById("dup-adaptation-goal")?.addEventListener("change", () => {
    markPreviewDirty("Adaptation goal changed. Generate preview again.");
  });

  document.getElementById("dup-add-target-button")?.addEventListener("click", () => {
    addCurrentDuplicateTarget();
  });

  document.getElementById("dup-bulk-target-list")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest(".duplicate-bulk-item");
    // The inline media panel (video/carousel upload labels, clear buttons) lives inside this
    // same row now, so a click there also matches ".duplicate-bulk-item" - without this
    // exclusion, clicking a file-upload label re-renders the row (via focusDuplicateTargetEditor)
    // in the middle of the browser's native label-click-opens-file-picker action, which silently
    // kills the file dialog before it ever opens.
    if (row instanceof HTMLElement && !target.closest("button") && !target.closest(".duplicate-bulk-item-media")) {
      const rowKey = row.getAttribute("data-duplicate-target-key") || "";
      const duplicateTarget = getDuplicateTargetByKey(rowKey);
      if (duplicateTarget) {
        focusDuplicateTargetEditor(duplicateTarget);
      }
      return;
    }

    const button = target.closest("[data-remove-bulk-target]");
    if (button instanceof HTMLButtonElement) {
      removeDuplicateBulkTarget(button.dataset.removeBulkTarget || "");
      return;
    }

    const openButton = target.closest("[data-open-bulk-target]");
    if (openButton instanceof HTMLButtonElement) {
      const duplicateTarget = getDuplicateTargetByKey(openButton.dataset.openBulkTarget || "");
      if (duplicateTarget) {
        focusDuplicateTargetEditor(duplicateTarget);
        setDuplicateReviewOpen(true);
      }
      return;
    }

    const modeButton = target.closest("[data-row-creative-mode]");
    if (modeButton instanceof HTMLButtonElement) {
      const key = row instanceof HTMLElement ? row.getAttribute("data-duplicate-target-key") || "" : "";
      const mode = modeButton.dataset.rowCreativeMode || "source";
      if (!key) return;
      const duplicateTarget = getDuplicateTargetByKey(key);
      if (duplicateTarget && (mode === "video" || mode === "carousel")) {
        ensureDuplicateTargetPersisted(duplicateTarget);
      }
      upsertDuplicateCreativeOverride(key, { mode });
      // Keep the shared "Ad format" selector (step 1) in step with whatever override the
      // operator just picked for this row - it drives both the video/carousel upload UI
      // and what ad_format gets published, so letting it silently disagree with a chip the
      // operator explicitly clicked is what breaks the video/carousel override end to end.
      if (mode === "video" || mode === "carousel") {
        const adFormatSelect = document.getElementById("dup-ad-format");
        if (adFormatSelect instanceof HTMLSelectElement) {
          adFormatSelect.value = mode === "video" ? "Video" : "Carousel";
        }
      }
      setDuplicateReviewOpen(false);
      appState.duplicateCreativeEditorKey = key;
      if (!setDuplicateActivePreview(key, { syncFields: false })) {
        renderDuplicateBulkTargets();
        renderDuplicateCreativeOverridePanel();
        renderCurrentPreviewPayload();
        syncActionAvailability();
      }
      return;
    }

    // The override panel now renders inline inside the currently-edited row (see
    // renderDuplicateBulkTargetsAction), so its DOM node is recreated on every list
    // re-render. Listening here on the static #dup-bulk-target-list container instead of
    // on #dup-creative-override-panel itself keeps these handlers working across re-renders.
    const clearVariantKey = target.closest("[data-clear-duplicate-video]")?.getAttribute("data-clear-duplicate-video");
    if (clearVariantKey) {
      const editorTarget = getActiveDuplicateCreativeEditorTarget();
      if (!editorTarget) return;
      removeDuplicateCreativeOverrideFile(getDuplicateTargetKey(editorTarget), clearVariantKey);
      renderDuplicateBulkTargets();
      renderDuplicateCreativeOverridePanel();
      renderCurrentPreviewPayload();
      syncActionAvailability();
      return;
    }

    const clearCarousel = target.closest("[data-clear-duplicate-carousel]");
    if (clearCarousel) {
      const editorTarget = getActiveDuplicateCreativeEditorTarget();
      if (!editorTarget) return;
      clearDuplicateCreativeOverrideCarouselFiles(getDuplicateTargetKey(editorTarget));
      renderDuplicateBulkTargets();
      renderDuplicateCreativeOverridePanel();
      renderCurrentPreviewPayload();
      syncActionAvailability();
    }
  });

  ["dup-video-square-upload", "dup-video-vertical-upload"].forEach((id) => {
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== id) return;
      const editorTarget = getActiveDuplicateCreativeEditorTarget();
      if (!editorTarget) return;
      const file = target.files?.[0] || null;
      const variantKey = id.includes("square") ? "square" : "vertical";
      const key = getDuplicateTargetKey(editorTarget);
      if (file) {
        ensureDuplicateTargetPersisted(editorTarget);
      }
      upsertDuplicateCreativeOverride(key, {
        mode: "video",
        uploadedVideoVariants: [],
        videoFiles: {
          [variantKey]: file
        }
      });
      target.value = "";
      renderDuplicateBulkTargets();
      renderDuplicateCreativeOverridePanel();
      renderCurrentPreviewPayload();
      syncActionAvailability();
    });
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "dup-carousel-square-upload") return;
    const editorTarget = getActiveDuplicateCreativeEditorTarget();
    if (!editorTarget) return;
    const files = Array.from(target.files || []);
    const key = getDuplicateTargetKey(editorTarget);
    if (files.length) {
      ensureDuplicateTargetPersisted(editorTarget);
    }
    upsertDuplicateCreativeOverride(key, {
      mode: "carousel",
      uploadedCarouselVariants: [],
      carouselFiles: files
    });
    target.value = "";
    renderDuplicateBulkTargets();
    renderDuplicateCreativeOverridePanel();
    renderCurrentPreviewPayload();
    syncActionAvailability();
  });

  document.getElementById("generate-duplicate-button")?.addEventListener("click", async () => {
    await generateAiPreview("duplicate");
  });

  document.getElementById("duplicate-generate-missing-button")?.addEventListener("click", async () => {
    await generateAiPreview("duplicate", { onlyMissing: true });
  });

  document.getElementById("duplicate-open-active-button")?.addEventListener("click", () => {
    const activeKey = appState.duplicateActivePreviewKey || syncDuplicateCreativeEditorKey();
    if (!activeKey) return;
    setDuplicateActivePreview(activeKey, { syncFields: false });
    setDuplicateReviewOpen(true);
    const previewCard = document.getElementById("preview-card");
    if (previewCard instanceof HTMLElement) {
      previewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.getElementById("duplicate-close-review-button")?.addEventListener("click", () => {
    setDuplicateReviewOpen(false);
  });

  document.querySelectorAll("[data-duplicate-step-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      if (appState.mode !== "duplicate") return;
      const next = Number(button.dataset.duplicateStepNav);
      if (next > appState.duplicateStep && !canAdvanceDuplicateStep(appState.duplicateStep)) {
        setStudioStatus("Complete this step before continuing.", "warning");
        return;
      }
      setDuplicateStep(next);
    });
  });

  document.getElementById("duplicate-next-1")?.addEventListener("click", () => {
    if (!canAdvanceDuplicateStep(1)) {
      setStudioStatus("Select a source ad before continuing.", "warning");
      return;
    }
    setDuplicateStep(2);
  });

  document.getElementById("duplicate-back-2")?.addEventListener("click", () => setDuplicateStep(1));
  document.getElementById("duplicate-next-2")?.addEventListener("click", () => {
    if (!canAdvanceDuplicateStep(2)) {
      setStudioStatus("Pick a target campaign and ad set before continuing.", "warning");
      return;
    }
    setDuplicateStep(3);
  });
  document.getElementById("duplicate-back-3")?.addEventListener("click", () => setDuplicateStep(2));
}
