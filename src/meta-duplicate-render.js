function readDuplicateCarouselSortNumber(name = "") {
  const match = String(name || "").trim().match(/^(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function getOrderedDuplicateCarouselFilesAction(files = []) {
  return [...(Array.isArray(files) ? files : [])].sort((left, right) => {
    const leftRank = readDuplicateCarouselSortNumber(left?.name || "");
    const rightRank = readDuplicateCarouselSortNumber(right?.name || "");
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return String(left?.name || "").localeCompare(String(right?.name || ""), undefined, { numeric: true, sensitivity: "base" });
  });
}

export function renderDuplicateBulkTargetsAction({
  appState,
  escapeHtml,
  getDuplicateBatchEntry,
  getDuplicateGeneratedPreviewCount,
  getDuplicateOverrideStatus,
  getDuplicatePrimaryTarget,
  getDuplicatePublishTargets,
  getDuplicateTargetKey,
  renderDuplicateWorkflowSummary,
  sanitizeDuplicateBulkTargets,
  syncDuplicateCreativeEditorKey,
  syncDuplicateTargetBuilderState
}) {
  const list = document.getElementById("dup-bulk-target-list");
  const meta = document.getElementById("dup-bulk-target-meta");
  if (!list || !meta) return;

  sanitizeDuplicateBulkTargets();
  const primary = getDuplicatePrimaryTarget();
  const targets = getDuplicatePublishTargets();
  const generatedCount = getDuplicateGeneratedPreviewCount();

  meta.textContent = targets.length
    ? `${targets.length} in batch · ${generatedCount}/${targets.length} ready`
    : "No targets";

  if (!targets.length) {
    list.innerHTML = `
      <div class="empty-state duplicate-bulk-empty">
        Add the first target.
      </div>
    `;
    renderDuplicateWorkflowSummary();
    syncDuplicateTargetBuilderState();
    return;
  }

  const rows = targets.map((target) => {
    const key = getDuplicateTargetKey(target);
    const isPrimary = primary ? key === getDuplicateTargetKey(primary) : false;
    const isActive = key === appState.duplicateActivePreviewKey;
    const isEditingCreative = key === syncDuplicateCreativeEditorKey();
    const batchEntry = getDuplicateBatchEntry(key);
    const previewReady = Boolean(batchEntry?.preview);
    const pushedAdId = batchEntry?.pushedAdId || "";
    const creativeOverride = getDuplicateOverrideStatus(target);
    return `
      <article class="duplicate-bulk-item${isActive ? " is-active" : ""}${isEditingCreative ? " is-editing-creative" : ""}" data-duplicate-target-key="${key}">
        <div class="duplicate-bulk-item-copy">
          <strong class="duplicate-bulk-language">${target.languageLabel}</strong>
          <span class="duplicate-bulk-campaign" title="${escapeHtml(target.campaignName)}">${target.campaignName}</span>
          <span class="duplicate-bulk-adset">${target.adSetName}</span>
          <div class="duplicate-bulk-badges">
            ${pushedAdId
              ? `<span class="duplicate-bulk-badge is-success" title="Ad ID ${escapeHtml(pushedAdId)}">Pushed to Meta</span>`
              : `<span class="duplicate-bulk-badge ${previewReady ? "is-success" : "is-warning"}">${previewReady ? "Preview ready" : "Preview pending"}</span>`}
            <span class="duplicate-bulk-badge ${creativeOverride.tone === "danger" ? "is-danger" : creativeOverride.tone === "success" ? "is-success" : ""}">${creativeOverride.label}</span>
          </div>
        </div>
        <div class="button-row">
          <button type="button" class="ghost-button small" data-open-bulk-target="${key}">Review</button>
          ${isPrimary ? "" : `<button type="button" class="ghost-button small" data-remove-bulk-target="${key}">Remove</button>`}
        </div>
        <div class="duplicate-bulk-mode-row" role="group" aria-label="Creative for ${escapeHtml(target.languageLabel)}">
          <button type="button" class="ghost-button small${creativeOverride.mode === "source" ? " is-selected" : ""}" data-row-creative-mode="source">Source</button>
          <button type="button" class="ghost-button small${creativeOverride.mode === "video" ? " is-selected" : ""}" data-row-creative-mode="video">Video</button>
          <button type="button" class="ghost-button small${creativeOverride.mode === "carousel" ? " is-selected" : ""}" data-row-creative-mode="carousel">Carousel</button>
        </div>
        ${isEditingCreative ? `<div class="duplicate-bulk-item-media" id="dup-creative-override-panel"></div>` : ""}
      </article>
    `;
  }).join("");
  list.innerHTML = `
    <div class="duplicate-bulk-table-head" aria-hidden="true">
      <span>Language</span>
      <span>Campaign</span>
      <span>Ad set</span>
      <span>Status</span>
      <span>Action</span>
    </div>
    ${rows}
  `;
  renderDuplicateWorkflowSummary();
  syncDuplicateTargetBuilderState();
}

export function renderDuplicateCreativeOverridePanelAction({
  getActiveDuplicateCreativeEditorTarget,
  getCachedCreateUploadPreviewUrl,
  getDuplicateCreativeOverride,
  getDuplicateTargetKey,
  getOrderedDuplicateCarouselFiles,
  renderDuplicateWorkflowSummary,
  sanitizeDuplicateBulkTargets
}) {
  const panel = document.getElementById("dup-creative-override-panel");
  if (!panel) return;

  sanitizeDuplicateBulkTargets();
  const target = getActiveDuplicateCreativeEditorTarget();

  if (!target) {
    panel.innerHTML = `
      <div class="empty-state duplicate-bulk-empty">
        Pick a target first.
      </div>
    `;
    renderDuplicateWorkflowSummary();
    return;
  }

  const key = getDuplicateTargetKey(target);
  const override = getDuplicateCreativeOverride(key);
  const squareFile = override.videoFiles.square;
  const verticalFile = override.videoFiles.vertical;
  // Gated on the override the operator actually picked for this row, not the shared
  // "Ad format" selector from step 1 - that selector defaults to "Single image" and has
  // no way to know a given source ad is really a video/carousel ad, so gating on it here
  // hid the upload fields behind a value the operator had no reason to also go change.
  const canUseVideoOverride = override.mode === "video";
  const canUseCarouselOverride = override.mode === "carousel";
  const orderedCarouselFiles = getOrderedDuplicateCarouselFiles(override.carouselFiles || []);
  const previewTiles = [
    squareFile ? `
      <div class="upload-tile">
        <video src="${getCachedCreateUploadPreviewUrl(squareFile)}" muted playsinline></video>
        <span title="${squareFile.name}">Feed video (1:1)</span>
      </div>
    ` : "",
    verticalFile ? `
      <div class="upload-tile">
        <video src="${getCachedCreateUploadPreviewUrl(verticalFile)}" muted playsinline></video>
        <span title="${verticalFile.name}">Stories / Reels video (9:16)</span>
      </div>
    ` : ""
  ].filter(Boolean).join("");
  const carouselPreviewTiles = orderedCarouselFiles.map((file, index) => `
    <div class="upload-tile">
      <img src="${getCachedCreateUploadPreviewUrl(file)}" alt="">
      <span title="${file.name}">Card ${index + 1}: ${file.name}</span>
    </div>
  `).join("");

  panel.innerHTML = `
    ${canUseVideoOverride ? `
      <div class="video-variant-grid duplicate-creative-grid${override.mode === "video" ? "" : " is-disabled"}">
        <label class="field video-upload-field" for="dup-video-square-upload">
          <span>Feed video (1:1)</span>
          <input id="dup-video-square-upload" type="file" accept="video/*" hidden>
          <span class="video-upload-button">Upload 1:1 video</span>
          <span class="video-upload-filename" id="dup-video-square-filename">${squareFile ? squareFile.name : "No file selected"}</span>
        </label>
        <label class="field video-upload-field" for="dup-video-vertical-upload">
          <span>Stories / Reels video (9:16)</span>
          <input id="dup-video-vertical-upload" type="file" accept="video/*" hidden>
          <span class="video-upload-button">Upload 9:16 video</span>
          <span class="video-upload-filename" id="dup-video-vertical-filename">${verticalFile ? verticalFile.name : "No file selected"}</span>
        </label>
      </div>
      <div class="duplicate-creative-actions${override.mode === "video" ? "" : " is-disabled"}">
        <button type="button" class="ghost-button small" data-clear-duplicate-video="square" ${squareFile ? "" : "disabled"}>Clear 1:1 video</button>
        <button type="button" class="ghost-button small" data-clear-duplicate-video="vertical" ${verticalFile ? "" : "disabled"}>Clear 9:16 video</button>
      </div>
      ${previewTiles ? `<div class="duplicate-creative-preview-grid">${previewTiles}</div>` : ""}
      <p class="field-hint duplicate-creative-footnote">${override.mode === "video"
        ? (squareFile && verticalFile ? "Ready." : "Upload both videos.")
        : "Using source."}</p>
    ` : `
      <div class="duplicate-creative-empty">
        Video override is only available for video ads.
      </div>
    `}
    ${canUseCarouselOverride ? `
      <div class="video-variant-grid duplicate-creative-grid${override.mode === "carousel" ? "" : " is-disabled"}">
        <label class="field video-upload-field" for="dup-carousel-square-upload">
          <span>Localized carousel cards (1:1)</span>
          <input id="dup-carousel-square-upload" type="file" accept="image/*" multiple hidden>
          <span class="video-upload-button">Upload translated card set</span>
          <span class="video-upload-filename" id="dup-carousel-square-filename">${orderedCarouselFiles.length ? `${orderedCarouselFiles.length} file${orderedCarouselFiles.length === 1 ? "" : "s"} selected` : "No files selected"}</span>
          <p class="field-hint">Drop in the translated 1:1 card set. We sort by filename, so 1-, 2-, 3- just works.</p>
        </label>
      </div>
      <div class="duplicate-creative-actions${override.mode === "carousel" ? "" : " is-disabled"}">
        <button type="button" class="ghost-button small" data-clear-duplicate-carousel ${orderedCarouselFiles.length ? "" : "disabled"}>Clear carousel images</button>
      </div>
      ${carouselPreviewTiles ? `<div class="duplicate-creative-preview-grid">${carouselPreviewTiles}</div>` : ""}
      <p class="field-hint duplicate-creative-footnote">${override.mode === "carousel"
        ? (orderedCarouselFiles.length >= 2 ? `Ready. ${orderedCarouselFiles.length} cards will publish in filename order.` : "Upload at least 2 carousel cards.")
        : "Using source."}</p>
    ` : `
      <div class="duplicate-creative-empty">
        Carousel override is only available for carousel ads.
      </div>
    `}
  `;
  renderDuplicateWorkflowSummary();
}
