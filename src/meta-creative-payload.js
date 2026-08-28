function getUploadedCreativeNames() {
  const input = document.getElementById("creative-upload");
  const files = Array.from(input?.files || []);
  return files.map((file) => file.name);
}

function getLocalImageFile(id) {
  return document.getElementById(id)?.files?.[0] || null;
}

function getLocalImageFiles(id) {
  return Array.from(document.getElementById(id)?.files || []);
}

const createVariantObjectUrlCache = new Map();

function getFileObjectUrlKey(file) {
  return file
    ? [file.name, file.size, file.lastModified, file.type].join(":")
    : "";
}

function getCachedCreateVariantUrl(file) {
  const key = getFileObjectUrlKey(file);
  if (!key) return "";
  if (!createVariantObjectUrlCache.has(key)) {
    createVariantObjectUrlCache.set(key, URL.createObjectURL(file));
  }
  return createVariantObjectUrlCache.get(key) || "";
}

function getLocalVideoFile(id) {
  return document.getElementById(id)?.files?.[0] || null;
}

function syncCreateVariantObjectUrls() {
  const activeFiles = [
    getLocalImageFile("create-image-square-upload"),
    getLocalImageFile("create-image-portrait-upload"),
    getLocalImageFile("create-image-vertical-upload"),
    ...getLocalImageFiles("create-carousel-square-upload"),
    getLocalVideoFile("create-video-square-upload"),
    getLocalVideoFile("create-video-vertical-upload")
  ].filter(Boolean);
  const activeKeys = new Set(activeFiles.map((file) => getFileObjectUrlKey(file)).filter(Boolean));
  createVariantObjectUrlCache.forEach((url, key) => {
    if (activeKeys.has(key)) return;
    URL.revokeObjectURL(url);
    createVariantObjectUrlCache.delete(key);
  });
}

function getCarouselOrderState() {
  if (typeof window === "undefined") {
    return { square: [] };
  }
  return window.__westpackCarouselOrders && typeof window.__westpackCarouselOrders === "object"
    ? window.__westpackCarouselOrders
    : { square: [] };
}

function getOrderedFilesForVariant(groupKey, files = []) {
  const orderState = getCarouselOrderState();
  const order = Array.isArray(orderState[groupKey]) ? orderState[groupKey] : [];
  if (!order.length) {
    return files.slice();
  }
  return order
    .map((index) => files[index] || null)
    .filter(Boolean);
}

function getCreateImageVariants() {
  syncCreateVariantObjectUrls();
  const squareFile = getLocalImageFile("create-image-square-upload");
  const portraitFile = getLocalImageFile("create-image-portrait-upload");
  const verticalFile = getLocalImageFile("create-image-vertical-upload");
  const variants = [];

  if (squareFile) {
    variants.push({
      key: "square",
      label: "1:1 Feed image",
      placement: "Facebook feed and square placements",
      aspectRatio: "1:1",
      fileName: squareFile.name,
      mime: squareFile.type,
      localObjectUrl: getCachedCreateVariantUrl(squareFile)
    });
  }

  if (portraitFile) {
    variants.push({
      key: "portrait",
      label: "4:5 Instagram feed image",
      placement: "Instagram feed",
      aspectRatio: "4:5",
      fileName: portraitFile.name,
      mime: portraitFile.type,
      localObjectUrl: getCachedCreateVariantUrl(portraitFile)
    });
  }

  if (verticalFile) {
    variants.push({
      key: "vertical",
      label: "9:16 Stories/Reels image",
      placement: "Stories / Reels",
      aspectRatio: "9:16",
      fileName: verticalFile.name,
      mime: verticalFile.type,
      localObjectUrl: getCachedCreateVariantUrl(verticalFile)
    });
  }

  return variants;
}

function getCreateCarouselVariants() {
  syncCreateVariantObjectUrls();
  const groups = [
    {
      key: "square",
      label: "1:1 Carousel cards",
      placement: "Facebook feed and square placements",
      aspectRatio: "1:1",
      files: getLocalImageFiles("create-carousel-square-upload")
    }
  ];

  return groups
    .filter((group) => group.files.length)
    .map((group) => ({
      key: group.key,
      label: group.label,
      placement: group.placement,
      aspectRatio: group.aspectRatio,
      items: getOrderedFilesForVariant(group.key, group.files).map((file) => ({
        fileName: file.name,
        mime: file.type,
        localObjectUrl: getCachedCreateVariantUrl(file)
      }))
    }));
}

function getCreateVideoVariants() {
  syncCreateVariantObjectUrls();
  const squareFile = getLocalVideoFile("create-video-square-upload");
  const verticalFile = getLocalVideoFile("create-video-vertical-upload");
  const variants = [];

  if (squareFile) {
    variants.push({
      key: "square",
      label: "1:1 Feed video",
      placement: "Feed",
      aspectRatio: "1:1",
      fileName: squareFile.name,
      mime: squareFile.type,
      localObjectUrl: getCachedCreateVariantUrl(squareFile)
    });
  }

  if (verticalFile) {
    variants.push({
      key: "vertical",
      label: "9:16 Stories/Reels video",
      placement: "Stories / Reels",
      aspectRatio: "9:16",
      fileName: verticalFile.name,
      mime: verticalFile.type,
      localObjectUrl: getCachedCreateVariantUrl(verticalFile)
    });
  }

  return variants;
}

function getCreateVideoAnalysis() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__westpackVideoAnalysis || null;
}

function getFieldIds(mode) {
  if (mode === "create") {
    return {
      targetCampaign: "create-target-campaign",
      targetAdSet: "create-target-adset",
      targetLanguage: "create-target-language",
      adFormat: "create-ad-format",
      destinationUrl: "create-destination-url",
      brief: "create-brief",
      videoUrlSquare: "create-video-square-upload",
      videoUrlVertical: "create-video-vertical-upload"
    };
  }

  return {
    sourceAd: "dup-source-ad",
    targetCampaign: "dup-target-campaign",
    targetAdSet: "dup-target-adset",
    targetLanguage: "dup-bulk-target-language",
    adaptationGoal: "dup-adaptation-goal",
    adFormat: "dup-ad-format",
    destinationUrl: "dup-destination-url",
    brief: "dup-brief"
  };
}

function getSourceAd(ads, sourceId) {
  const resolvedAds = ads && ads.length ? ads : [];
  return resolvedAds.find((ad) => ad.id === sourceId) || {
    id: sourceId || "",
    name: "Selected ad",
    primary: "Live ad copy will be loaded in the next integration step.",
    headline: "Localized headline preview",
    description: "Localized description preview",
    adset: ""
  };
}

export function buildCreativePayloadContext({ ads, getSelectLabel, getValue, mode }) {
  const ids = getFieldIds(mode);
  const sourceId = getValue(ids.sourceAd);
  const targetCampaign = getSelectLabel(ids.targetCampaign);
  const targetCampaignId = getValue(ids.targetCampaign);
  const targetAdSet = getSelectLabel(ids.targetAdSet);
  const targetAdSetId = getValue(ids.targetAdSet);
  const targetLanguage = getValue(ids.targetLanguage);
  const adaptationGoal = getValue(ids.adaptationGoal);
  const adFormat = getValue(ids.adFormat);
  const destinationUrl = getValue(ids.destinationUrl);
  const note = document.getElementById(ids.brief)?.value.trim() || "";
  const campaignIntent = document.getElementById("create-ad-intent")?.value || "";
  const newAdName = document.getElementById("new-ad-name")?.value.trim();
  const newAdAngle = document.getElementById("new-ad-angle")?.value;
  const imageVariants = mode === "create" ? getCreateImageVariants() : [];
  const carouselVariants = mode === "create" ? getCreateCarouselVariants() : [];
  const videoVariants = mode === "create" ? getCreateVideoVariants() : [];
  const videoAnalysis = mode === "create" ? getCreateVideoAnalysis() : null;
  const creativeAssets = mode === "create"
    ? adFormat === "Video"
      ? videoVariants.map((variant) => `${variant.label} (${variant.aspectRatio})`)
      : adFormat === "Single image"
        ? imageVariants.map((variant) => `${variant.label} (${variant.aspectRatio})`)
        : adFormat === "Carousel"
          ? (carouselVariants.find((variant) => variant.key === "square")?.items || []).map((item) => item.fileName)
          : getUploadedCreativeNames()
    : getUploadedCreativeNames();
  const sourceAd = getSourceAd(ads, sourceId);
  const cardImagePreviews = mode === "create"
    ? (window.__westpackCardImagePreviews || [])
    : [];

  return {
    ids,
    sourceId,
    sourceAd,
    targetCampaign,
    targetCampaignId,
    targetAdSet,
    targetAdSetId,
    targetLanguage,
    adaptationGoal,
    adFormat,
    destinationUrl,
    note,
    campaignIntent,
    newAdName,
    newAdAngle,
    imageVariants,
    carouselVariants,
    videoVariants,
    videoAnalysis,
    creativeAssets,
    cardImagePreviews
  };
}
