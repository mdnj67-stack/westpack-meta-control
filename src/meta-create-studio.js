const createUploadPreviewUrlCache = new Map();

function getFileObjectUrlKey(file) {
  return file
    ? [file.name, file.size, file.lastModified, file.type].join(":")
    : "";
}

function getCachedCreateUploadPreviewUrl(file) {
  const key = getFileObjectUrlKey(file);
  if (!key) return "";
  if (!createUploadPreviewUrlCache.has(key)) {
    createUploadPreviewUrlCache.set(key, URL.createObjectURL(file));
  }
  return createUploadPreviewUrlCache.get(key) || "";
}

function syncCreateUploadPreviewUrls(files = []) {
  const activeKeys = new Set(files.map((file) => getFileObjectUrlKey(file)).filter(Boolean));
  createUploadPreviewUrlCache.forEach((url, key) => {
    if (activeKeys.has(key)) return;
    URL.revokeObjectURL(url);
    createUploadPreviewUrlCache.delete(key);
  });
}

function getCarouselOrderState() {
  if (typeof window === "undefined") {
    return { square: [] };
  }
  if (!window.__westpackCarouselOrders || typeof window.__westpackCarouselOrders !== "object") {
    window.__westpackCarouselOrders = { square: [] };
  }
  return window.__westpackCarouselOrders;
}

function getCarouselOrderSignature(groups = []) {
  return groups
    .map((group) => {
      const files = Array.isArray(group.files) ? group.files : [];
      return `${group.key}:${files.map((file) => `${file.name}:${file.size}`).join("|")}`;
    })
    .join("||");
}

function syncCarouselOrderState(groups = []) {
  const state = getCarouselOrderState();
  const signature = getCarouselOrderSignature(groups);
  if (typeof window !== "undefined" && window.__westpackCarouselOrderSignature !== signature) {
    state.square = [];
    window.__westpackCarouselOrderSignature = signature;
  }
  groups.forEach((group) => {
    const count = Array.isArray(group.files) ? group.files.length : 0;
    const current = Array.isArray(state[group.key]) ? state[group.key].slice() : [];
    const valid = current.filter((index) => Number.isInteger(index) && index >= 0 && index < count);
    const missing = Array.from({ length: count }, (_, index) => index).filter((index) => !valid.includes(index));
    state[group.key] = valid.concat(missing);
  });
}

function getOrderedCarouselFiles(files = [], groupKey = "") {
  const order = getCarouselOrderState();
  const sequence = groupKey && Array.isArray(order[groupKey]) ? order[groupKey] : [];
  if (!sequence.length || !files.length) {
    return files.slice();
  }
  return sequence
    .map((index) => files[index] || null)
    .filter(Boolean);
}

function moveCarouselCard(groupKey, displayIndex, direction) {
  const state = getCarouselOrderState();
  const order = Array.isArray(state[groupKey]) ? state[groupKey].slice() : [];
  const nextIndex = displayIndex + direction;
  if (displayIndex < 0 || nextIndex < 0 || displayIndex >= order.length || nextIndex >= order.length) {
    return;
  }
  const swap = order[displayIndex];
  order[displayIndex] = order[nextIndex];
  order[nextIndex] = swap;
  state[groupKey] = order;
}

function renderCarouselFormatEditor(group) {
  const orderedFiles = getOrderedCarouselFiles(group.files, group.key);
  return `
    <section class="carousel-format-editor">
      <div class="carousel-format-editor-head">
        <strong>${group.label} format</strong>
        <span>${orderedFiles.length} card${orderedFiles.length === 1 ? "" : "s"}</span>
      </div>
      <p class="carousel-format-editor-note">Arrange this format so the right image sits on Card 1, Card 2, Card 3 and so on.</p>
      <div class="carousel-format-editor-list">
        ${orderedFiles.map((file, index) => `
          <article class="carousel-format-card">
            <img class="carousel-format-card-thumb" src="${getCachedCreateUploadPreviewUrl(file)}" alt="">
            <div class="carousel-format-card-copy">
              <strong>${group.label} - Card ${index + 1}</strong>
              <span title="${file.name}">${file.name}</span>
            </div>
            <div class="carousel-order-actions">
              <button type="button" class="carousel-order-button" data-carousel-order-group="${group.key}" data-carousel-order-index="${index}" data-carousel-order-move="-1" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="carousel-order-button" data-carousel-order-group="${group.key}" data-carousel-order-index="${index}" data-carousel-order-move="1" ${index === orderedFiles.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCarouselSlotManager(groups = []) {
  const orderedGroups = groups
    .map((group) => ({
      ...group,
      orderedFiles: getOrderedCarouselFiles(group.files, group.key)
    }))
    .filter((group) => group.orderedFiles.length);
  const slotCount = orderedGroups.length ? Math.max(...orderedGroups.map((group) => group.orderedFiles.length)) : 0;
  if (!slotCount) {
    return "";
  }
  return `
    <section class="carousel-order-group">
      <div class="carousel-order-head">
        <strong>Shared card slots</strong>
        <span>${slotCount} card${slotCount === 1 ? "" : "s"}</span>
      </div>
      <p class="carousel-order-note">Check each slot here before moving on. Card 1, Card 2, Card 3 and so on will share the same copy and URL across all placements.</p>
      <div class="carousel-order-list">
        ${Array.from({ length: slotCount }, (_, index) => `
          <article class="carousel-order-item">
            <div class="carousel-order-copy">
              <strong>Card ${index + 1}</strong>
              <span>Shared copy + shared URL</span>
            </div>
            <div class="carousel-slot-assets">
              ${orderedGroups.map((group) => {
                const file = group.orderedFiles[index] || null;
                if (!file) {
                  return `
                    <div class="carousel-slot-asset is-empty">
                      <span>${group.label}</span>
                    </div>
                  `;
                }
                return `
                  <div class="carousel-slot-asset">
                    <img src="${getCachedCreateUploadPreviewUrl(file)}" alt="">
                    <span>${group.label}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

export function getCreateUploadPreviewUrlAction(file) {
  return getCachedCreateUploadPreviewUrl(file);
}

export function getCreateCarouselOrderStateAction() {
  return getCarouselOrderState();
}

export function setCreateStepAction({ appState, step }) {
  const next = Math.max(1, Math.min(3, Number(step) || 1));
  appState.createStep = next;

  document.querySelectorAll(".create-step").forEach((el) => {
    el.classList.toggle("active", el.dataset.createStep === String(next));
  });
  document.querySelectorAll(".create-step-button").forEach((el) => {
    const isActive = el.dataset.createStep === String(next);
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

export function syncCreateFormatClassesAction({ getInputValue }) {
  const format = getInputValue("create-ad-format");
  document.body.classList.toggle("is-video-create", format === "Video");
  document.body.classList.toggle("is-single-image-create", format === "Single image");
  document.body.classList.toggle("is-carousel-create", format === "Carousel");
}

function syncCreateImageUploadLabels() {
  const variants = [
    { inputId: "create-image-square-upload", labelId: "create-image-square-filename" },
    { inputId: "create-image-portrait-upload", labelId: "create-image-portrait-filename" },
    { inputId: "create-image-vertical-upload", labelId: "create-image-vertical-filename" }
  ];

  variants.forEach(({ inputId, labelId }) => {
    const file = document.getElementById(inputId)?.files?.[0] || null;
    const label = document.getElementById(labelId);
    if (!label) return;
    label.textContent = file ? file.name : "No file selected";
    label.title = file ? file.name : "";
  });
}

function syncCreateCarouselUploadLabels() {
  const variants = [
    { inputId: "create-carousel-square-upload", labelId: "create-carousel-square-filename", fallback: "No files selected" }
  ];

  variants.forEach(({ inputId, labelId, fallback }) => {
    const files = Array.from(document.getElementById(inputId)?.files || []);
    const label = document.getElementById(labelId);
    if (!label) return;
    label.textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : fallback;
    label.title = files.map((file) => file.name).join(", ");
  });
}

function syncCreateVideoUploadLabels() {
  const squareFile = document.getElementById("create-video-square-upload")?.files?.[0] || null;
  const verticalFile = document.getElementById("create-video-vertical-upload")?.files?.[0] || null;
  const squareLabel = document.getElementById("create-video-square-filename");
  const verticalLabel = document.getElementById("create-video-vertical-filename");

  if (squareLabel) {
    squareLabel.textContent = squareFile ? squareFile.name : "No file selected";
    squareLabel.title = squareFile ? squareFile.name : "";
  }

  if (verticalLabel) {
    verticalLabel.textContent = verticalFile ? verticalFile.name : "No file selected";
    verticalLabel.title = verticalFile ? verticalFile.name : "";
  }
}

const MAX_CREATE_IMAGE_UPLOAD_BYTES = 3_000_000;

export function getCreateImageUploadSizeMessageAction(fileName, label = "Image") {
  return `${label} '${fileName}' is too large. Use a smaller image (max ~3MB).`;
}

export function collectCreateImageUploadSizeIssuesAction({ getInputValue }) {
  const format = getInputValue("create-ad-format");
  const issues = [];

  if (format === "Single image") {
    [
      { inputId: "create-image-square-upload", label: "Feed image (1:1)" },
      { inputId: "create-image-portrait-upload", label: "Instagram feed image (4:5)" },
      { inputId: "create-image-vertical-upload", label: "Stories / Reels image (9:16)" }
    ].forEach(({ inputId, label }) => {
      const file = document.getElementById(inputId)?.files?.[0] || null;
      if (file && file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
        issues.push({
          inputId,
          message: getCreateImageUploadSizeMessageAction(file.name, label)
        });
      }
    });
    return issues;
  }

  if (format === "Carousel") {
    const files = Array.from(document.getElementById("create-carousel-square-upload")?.files || []);
    files.forEach((file, index) => {
      if (file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
        issues.push({
          inputId: "create-carousel-square-upload",
          message: getCreateImageUploadSizeMessageAction(file.name, `Carousel card ${index + 1}`)
        });
      }
    });
  }

  return issues;
}

export function syncCreateImageUploadValidationAction({
  getInputValue,
  markInvalid,
  setStudioStatus,
  options = {}
}) {
  const { announce = false } = options;
  [
    "create-image-square-upload",
    "create-image-portrait-upload",
    "create-image-vertical-upload",
    "create-carousel-square-upload"
  ].forEach((id) => {
    document.getElementById(id)?.classList.remove("is-invalid");
  });

  const issues = collectCreateImageUploadSizeIssuesAction({ getInputValue });
  issues.forEach((issue) => markInvalid(issue.inputId));

  if (announce && issues.length) {
    setStudioStatus(issues[0].message, "warning");
  }

  return issues;
}

export function canAdvanceCreateStepAction({ getInputValue, step }) {
  const campaignId = getInputValue("create-target-campaign");
  const adSetId = getInputValue("create-target-adset");
  const format = getInputValue("create-ad-format");
  const hasFiles = (document.getElementById("creative-upload")?.files?.length || 0) > 0;
  const hasSquareImage = !!document.getElementById("create-image-square-upload")?.files?.[0];
  const hasPortraitImage = !!document.getElementById("create-image-portrait-upload")?.files?.[0];
  const hasVerticalImage = !!document.getElementById("create-image-vertical-upload")?.files?.[0];
  const squareCarouselCount = document.getElementById("create-carousel-square-upload")?.files?.length || 0;
  const hasSquareVideoUrl = !!document.getElementById("create-video-square-upload")?.files?.[0];
  const hasVerticalVideoUrl = !!document.getElementById("create-video-vertical-upload")?.files?.[0];
  const hasName = !!getInputValue("new-ad-name").trim();
  const hasRequiredImageVariants = hasSquareImage && hasPortraitImage && hasVerticalImage;
  const hasRequiredCarouselVariants = squareCarouselCount >= 2;
  const hasRequiredVideoVariants = hasSquareVideoUrl && hasVerticalVideoUrl;
  const hasValidCreateImageSizes = !collectCreateImageUploadSizeIssuesAction({ getInputValue }).length;
  const hasRequiredCreative = format === "Video"
    ? hasRequiredVideoVariants
    : format === "Single image"
      ? hasRequiredImageVariants
      : format === "Carousel"
        ? hasRequiredCarouselVariants
        : hasFiles;

  if (step === 1) return hasRequiredCreative && hasValidCreateImageSizes;
  if (step === 2) return !!campaignId && !!adSetId;
  if (step === 3) return hasRequiredCreative && hasValidCreateImageSizes && !!campaignId && !!adSetId && hasName;
  return true;
}

export function readFileAsBase64Action(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function readBlobAsBase64Action(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Chunk read failed."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function extractBase64Payload(dataUrl = "") {
  const value = String(dataUrl || "");
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

export function captureVideoThumbnailAction({
  cacheVideoThumbnail,
  file,
  getCachedVideoThumbnail,
  variant,
  ratio = 0.15
}) {
  const cached = getCachedVideoThumbnail(file);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error(`Could not capture thumbnail for ${variant.label}.`));
    }, { once: true });

    video.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3;
      const captureTime = Math.max(0.05, Math.min(duration * ratio, Math.max(duration - 0.1, 0.05)));
      const canvas = document.createElement("canvas");
      const width = video.videoWidth || (variant.key === "vertical" ? 720 : 1080);
      const height = video.videoHeight || (variant.key === "vertical" ? 1280 : 1080);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      const handleSeeked = () => {
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const thumbnail = {
            mime: "image/jpeg",
            data_base64: extractBase64Payload(dataUrl)
          };
          cacheVideoThumbnail(file, thumbnail);
          cleanup();
          resolve(thumbnail);
        } catch {
          cleanup();
          reject(new Error(`Thumbnail capture failed for ${variant.label}.`));
        }
      };

      video.addEventListener("seeked", handleSeeked, { once: true });
      try {
        video.currentTime = captureTime;
      } catch (error) {
        cleanup();
        reject(error);
      }
    }, { once: true });

    video.src = objectUrl;
  });
}

function setVideoAnalysisStatus(message) {
  const node = document.getElementById("create-video-analysis-status");
  if (node) {
    node.textContent = message || "";
  }
}

function renderVideoAnalysisPanel({ analysis, appState, escapeHtml }) {
  const list = document.getElementById("create-video-analysis-list");
  if (!list) return;

  const nextAnalysis = analysis ?? appState.currentVideoAnalysis;
  if (!nextAnalysis?.insights?.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = nextAnalysis.insights.map((item) => `
    <article class="video-analysis-item">
      <strong>${escapeHtml(item.title || "")}</strong>
      <p>${escapeHtml(item.body || "")}</p>
    </article>
  `).join("");
}

export function resetVideoAnalysisStateAction({
  appState,
  escapeHtml,
  message = "Analyze both videos to give AI better hook, pacing and product-context input."
}) {
  appState.currentVideoAnalysis = null;
  window.__westpackVideoAnalysis = null;
  renderVideoAnalysisPanel({ analysis: null, appState, escapeHtml });
  setVideoAnalysisStatus(message);
}

function loadVideoFramesFromFile(file, variant) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error(`Could not load video frames for ${variant.label}.`));
    }, { once: true });

    video.addEventListener("loadedmetadata", async () => {
      try {
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3;
        const timestamps = [0.15, 0.45, 0.75].map((ratio) => Math.max(0.05, Math.min(duration * ratio, Math.max(duration - 0.1, 0.05))));
        const canvas = document.createElement("canvas");
        const width = video.videoWidth || (variant.key === "vertical" ? 720 : 1080);
        const height = video.videoHeight || (variant.key === "vertical" ? 1280 : 1080);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        const frames = [];

        const captureAt = (time) => new Promise((captureResolve, captureReject) => {
          const handleSeeked = () => {
            try {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              frames.push({
                variantKey: variant.key,
                variantLabel: variant.label,
                aspectRatio: variant.aspectRatio,
                timestamp: time,
                imageUrl: canvas.toDataURL("image/jpeg", 0.82)
              });
              captureResolve();
            } catch {
              captureReject(new Error(`Frame extraction failed for ${variant.label}.`));
            }
          };

          video.addEventListener("seeked", handleSeeked, { once: true });
          try {
            video.currentTime = time;
          } catch (error) {
            captureReject(error);
          }
        });

        for (const time of timestamps) {
          await captureAt(time);
        }

        cleanup();
        resolve(frames);
      } catch (error) {
        cleanup();
        reject(error);
      }
    }, { once: true });

    video.src = objectUrl;
  });
}

export function renderCreateUploadPreviewAction({ getInputValue }) {
  const host = document.getElementById("create-upload-preview");
  const carouselManager = document.getElementById("create-carousel-order-manager");
  const input = document.getElementById("creative-upload");
  if (!host || !input) return;
  syncCreateFormatClassesAction({ getInputValue });
  syncCreateImageUploadLabels();
  syncCreateCarouselUploadLabels();
  syncCreateVideoUploadLabels();
  if (carouselManager) {
    carouselManager.innerHTML = "";
  }

  if (getInputValue("create-ad-format") === "Video") {
    const squareFile = document.getElementById("create-video-square-upload")?.files?.[0] || null;
    const verticalFile = document.getElementById("create-video-vertical-upload")?.files?.[0] || null;
    const activeFiles = [squareFile, verticalFile].filter(Boolean);
    syncCreateUploadPreviewUrls(activeFiles);
    const variants = [
      squareFile ? { label: "Feed video", ratio: "1:1", url: getCachedCreateUploadPreviewUrl(squareFile) } : null,
      verticalFile ? { label: "Stories / Reels video", ratio: "9:16", url: getCachedCreateUploadPreviewUrl(verticalFile) } : null
    ].filter(Boolean);

    host.innerHTML = variants.map((variant) => `
      <div class="upload-tile">
        <video src="${variant.url}" muted playsinline></video>
        <span title="${variant.label}">${variant.label} (${variant.ratio})</span>
      </div>
    `).join("");
    return;
  }

  if (getInputValue("create-ad-format") === "Single image") {
    const variants = [
      {
        file: document.getElementById("create-image-square-upload")?.files?.[0] || null,
        label: "Feed image",
        ratio: "1:1"
      },
      {
        file: document.getElementById("create-image-portrait-upload")?.files?.[0] || null,
        label: "Instagram feed image",
        ratio: "4:5"
      },
      {
        file: document.getElementById("create-image-vertical-upload")?.files?.[0] || null,
        label: "Stories / Reels image",
        ratio: "9:16"
      }
    ].filter((variant) => variant.file);

    syncCreateUploadPreviewUrls(variants.map((variant) => variant.file).filter(Boolean));
    host.innerHTML = variants.map((variant) => `
      <div class="upload-tile">
        <img src="${getCachedCreateUploadPreviewUrl(variant.file)}" alt="">
        <span title="${variant.label}">${variant.label} (${variant.ratio})</span>
      </div>
    `).join("");
    return;
  }

  if (getInputValue("create-ad-format") === "Carousel") {
    const groups = [
      {
        key: "square",
        label: "1:1",
        files: Array.from(document.getElementById("create-carousel-square-upload")?.files || [])
      }
    ];

    syncCarouselOrderState(groups);
    syncCreateUploadPreviewUrls(groups.flatMap((group) => getOrderedCarouselFiles(group.files, group.key)));
    host.innerHTML = `
      <div class="carousel-format-editor-grid">
        ${groups.map((group) => renderCarouselFormatEditor(group)).join("")}
      </div>
    `;

    if (carouselManager) {
      carouselManager.innerHTML = renderCarouselSlotManager(groups);
    }
    return;
  }

  const files = Array.from(input.files || []);
  syncCreateUploadPreviewUrls(files);
  host.innerHTML = files.slice(0, 6).map((file) => {
    const url = getCachedCreateUploadPreviewUrl(file);
    const media = file.type.startsWith("video/")
      ? `<video src="${url}" muted playsinline></video>`
      : `<img src="${url}" alt="">`;
    return `
      <div class="upload-tile">
        ${media}
        <span title="${file.name}">${file.name}</span>
      </div>
    `;
  }).join("");
}

export async function analyzeCreateVideoAction({
  appState,
  escapeHtml,
  getInputValue,
  markPreviewDirty,
  requestVideoAnalysis,
  setButtonBusy,
  setStudioStatus
}) {
  if (getInputValue("create-ad-format") !== "Video") {
    setStudioStatus("Switch format to Video before analyzing.", "warning");
    return;
  }

  const variants = [
    {
      key: "square",
      label: "Feed video",
      aspectRatio: "1:1",
      file: document.getElementById("create-video-square-upload")?.files?.[0] || null
    },
    {
      key: "vertical",
      label: "Stories / Reels video",
      aspectRatio: "9:16",
      file: document.getElementById("create-video-vertical-upload")?.files?.[0] || null
    }
  ];

  if (!variants.every((variant) => variant.file)) {
    setStudioStatus("Both video files must be uploaded before analysis.", "warning");
    setVideoAnalysisStatus("Add both local video files before analysis.");
    return;
  }

  setButtonBusy("analyze-create-video-button", true, "Analyze video", "Analyzing...");
  setVideoAnalysisStatus("Extracting keyframes from both videos...");

  try {
    const frameGroups = await Promise.all(variants.map((variant) => loadVideoFramesFromFile(variant.file, variant)));
    const frames = frameGroups.flat();
    setVideoAnalysisStatus("Sending keyframes to AI for analysis...");

    const result = await requestVideoAnalysis({
      newAdName: getInputValue("new-ad-name").trim(),
      newAdAngle: getInputValue("new-ad-angle"),
      operatorNote: getInputValue("create-brief").trim(),
      creativeAssets: [],
      videoVariants: variants.map((variant) => ({
        key: variant.key,
        label: variant.label,
        aspectRatio: variant.aspectRatio,
        fileName: variant.file?.name || ""
      })),
      frames
    });

    appState.currentVideoAnalysis = result;
    window.__westpackVideoAnalysis = result;
    renderVideoAnalysisPanel({ analysis: result, appState, escapeHtml });
    setVideoAnalysisStatus(`Video analysis ready. ${result.model || "OpenAI"} responded.`);
    setStudioStatus("Video analysis added to the create flow.", "success");
    markPreviewDirty("Video analysis updated. Generate preview again.");
  } catch (error) {
    appState.currentVideoAnalysis = null;
    window.__westpackVideoAnalysis = null;
    renderVideoAnalysisPanel({ analysis: null, appState, escapeHtml });
    setVideoAnalysisStatus(error.message || "Video analysis failed.");
    setStudioStatus(error.message || "Video analysis failed.", "warning");
  } finally {
    setButtonBusy("analyze-create-video-button", false, "Analyze video", "Analyzing...");
  }
}

export function attachCreateStudioEventsModule({
  appState,
  analyzeCreateVideo,
  canAdvanceCreateStep,
  getInputValue,
  markPreviewDirty,
  renderCreateUploadPreview,
  resetVideoAnalysisState,
  setCreateStep,
  setStudioStatus,
  syncActionAvailability,
  syncCreateImageUploadValidation
}) {
  document.querySelectorAll(".create-step-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (appState.mode !== "create") return;
      const next = Number(button.dataset.createStep);
      if (next > appState.createStep && !canAdvanceCreateStep(appState.createStep)) {
        setStudioStatus("Complete this step before continuing.", "warning");
        return;
      }
      setCreateStep(next);
    });
  });

  document.getElementById("creative-upload")?.addEventListener("change", () => {
    renderCreateUploadPreview();
    markPreviewDirty("Creative files changed. Generate preview again.");
    syncActionAvailability();
  });

  const handleCarouselOrderClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("[data-carousel-order-group]");
    if (!(button instanceof HTMLButtonElement)) return;
    const groupKey = button.getAttribute("data-carousel-order-group") || "";
    const displayIndex = Number(button.getAttribute("data-carousel-order-index"));
    const move = Number(button.getAttribute("data-carousel-order-move"));
    if (!groupKey || !Number.isFinite(displayIndex) || !Number.isFinite(move)) return;
    moveCarouselCard(groupKey, displayIndex, move);
    renderCreateUploadPreview();
    markPreviewDirty("Carousel card order changed. Generate preview again.");
    syncActionAvailability();
  };

  document.getElementById("create-upload-preview")?.addEventListener("click", handleCarouselOrderClick);
  document.getElementById("create-carousel-order-manager")?.addEventListener("click", handleCarouselOrderClick);

  document.getElementById("create-ad-format")?.addEventListener("change", () => {
    renderCreateUploadPreview();
    syncCreateImageUploadValidation();
    resetVideoAnalysisState();
    markPreviewDirty("Ad format changed. Generate preview again.");
    syncActionAvailability();
  });

  ["create-image-square-upload", "create-image-portrait-upload", "create-image-vertical-upload"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderCreateUploadPreview();
      syncCreateImageUploadValidation({ announce: true });
      markPreviewDirty("Image variants changed. Generate preview again.");
      syncActionAvailability();
    });
  });

  ["create-carousel-square-upload"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderCreateUploadPreview();
      syncCreateImageUploadValidation({ announce: true });
      markPreviewDirty("Carousel variants changed. Generate preview again.");
      syncActionAvailability();
    });
  });

  ["create-video-square-upload", "create-video-vertical-upload"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderCreateUploadPreview();
      resetVideoAnalysisState("Video changed. Analyze again to refresh AI context.");
      markPreviewDirty("Video variants changed. Generate preview again.");
      syncActionAvailability();
    });
  });

  document.getElementById("analyze-create-video-button")?.addEventListener("click", async () => {
    await analyzeCreateVideo();
  });

  document.getElementById("create-next-1")?.addEventListener("click", () => {
    if (!canAdvanceCreateStep(1)) {
      setStudioStatus(
        getInputValue("create-ad-format") === "Video"
          ? "Upload both video files (1:1 and 9:16) before continuing."
          : getInputValue("create-ad-format") === "Single image"
            ? "Upload all three image formats (1:1, 4:5 and 9:16) before continuing."
            : getInputValue("create-ad-format") === "Carousel"
              ? "Upload the carousel card set in 1:1 before continuing."
              : "Upload at least one file before continuing.",
        "warning"
      );
      return;
    }
    setCreateStep(2);
  });

  document.getElementById("create-back-2")?.addEventListener("click", () => setCreateStep(1));
  document.getElementById("create-next-2")?.addEventListener("click", () => {
    if (!canAdvanceCreateStep(2)) {
      setStudioStatus("Pick a target campaign and ad set before continuing.", "warning");
      return;
    }
    setCreateStep(3);
  });
  document.getElementById("create-back-3")?.addEventListener("click", () => setCreateStep(2));
}
