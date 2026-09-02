const GRAPH_BASE = "https://graph.facebook.com/v25.0";
const META_LOOKUP_CACHE = new Map();
const META_LOOKUP_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitMessage(message = "") {
  const text = String(message || "").toLowerCase();
  // graphRequest below always folds Meta's numeric error code into the message as "code N",
  // so matching the known throttling codes (4 = app limit, 17 = user limit, 32 = page limit,
  // 613 = custom rate limit) catches every throttling response regardless of the exact wording
  // Meta happens to use for it - notably including the lower-ceiling errors an app running on
  // Development Access (rather than Standard/Advanced) hits well before real usage limits.
  return text.includes("request limit reached")
    || text.includes("too many calls")
    || text.includes("rate limit")
    || text.includes("application request limit reached")
    || text.includes("user request limit reached")
    || /\bcode (4|17|32|613)\b/.test(text);
}

function readCacheEntry(key = "", maxAgeMs = META_LOOKUP_CACHE_MAX_AGE_MS) {
  if (!key || !META_LOOKUP_CACHE.has(key)) {
    return null;
  }
  const entry = META_LOOKUP_CACHE.get(key);
  const ageMs = Date.now() - new Date(entry.cachedAt || 0).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
    META_LOOKUP_CACHE.delete(key);
    return null;
  }
  return entry.value ?? null;
}

function writeCacheEntry(key = "", value) {
  if (!key || value == null) {
    return;
  }
  META_LOOKUP_CACHE.set(key, {
    value,
    cachedAt: new Date().toISOString()
  });
}

function ensureAccountId(accountId) {
  if (!accountId) {
    throw new Error("Missing Meta ad account ID.");
  }

  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

async function graphRequest(path, accessToken, options = {}) {
  const normalizedAccessToken = String(accessToken || "").trim();
  if (!normalizedAccessToken) {
    throw new Error("Missing Meta access token.");
  }

  const method = options.method || "GET";
  const attempt = Number(options.attempt || 0);
  const maxRetries = Number(options.maxRetries || 5);
  const url = new URL(`${GRAPH_BASE}${path}`);

  if (method === "GET") {
    const params = options.params || {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    url.searchParams.set("access_token", normalizedAccessToken);
  }

  const fetchOptions = { method, headers: {} };

  if (method !== "GET") {
    const body = new URLSearchParams();
    const params = options.params || {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        body.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
    });
    body.set("access_token", normalizedAccessToken);
    fetchOptions.body = body;
  }

  const response = await fetch(url.toString(), fetchOptions);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const errorPayload = payload?.error || {};
    const messageParts = [
      errorPayload.message || `Meta request failed for ${path}.`,
      errorPayload.code ? `code ${errorPayload.code}` : "",
      errorPayload.error_subcode ? `subcode ${errorPayload.error_subcode}` : "",
      errorPayload.error_user_title || "",
      errorPayload.error_user_msg || ""
    ].filter(Boolean);
    const message = messageParts.join(" | ");
    const shouldRetry = (response.status === 429 || isRateLimitMessage(message)) && attempt < maxRetries;
    if (shouldRetry) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const jitterMs = Math.round(Math.random() * 1500);
      const retryDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : (2000 * (2 ** attempt)) + jitterMs;
      await sleep(retryDelay);
      return graphRequest(path, accessToken, {
        ...options,
        attempt: attempt + 1,
        maxRetries
      });
    }
    throw new Error(message);
  }

  return payload;
}

async function getAdSets(accountId, accessToken) {
  const normalizedId = ensureAccountId(accountId);
  const cacheKey = `adsets:${normalizedId}`;
  const cached = readCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }
  const payload = await graphRequest(`/${normalizedId}/adsets`, accessToken, {
    params: {
      fields: "id,name,campaign{id,name}",
      limit: "500"
    }
  });

  const data = Array.isArray(payload.data) ? payload.data : [];
  writeCacheEntry(cacheKey, data);
  return data;
}

function findTargetAdSet(adSets, targetCampaignName, targetAdSetName, targetAdSetId) {
  if (targetAdSetId) {
    return adSets.find((adSet) => adSet.id === targetAdSetId) || null;
  }

  return adSets.find((adSet) => {
    const adSetMatches = adSet.name === targetAdSetName;
    const campaignMatches = !targetCampaignName || adSet?.campaign?.name === targetCampaignName;
    return adSetMatches && campaignMatches;
  });
}

async function getAdDetails(adId, accessToken) {
  const cacheKey = `ad:${adId}`;
  const cached = readCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }
  const payload = await graphRequest(`/${adId}`, accessToken, {
    params: {
      fields: "id,name,adset{id,name},campaign{id,name},creative{id},tracking_specs"
    }
  });
  writeCacheEntry(cacheKey, payload);
  return payload;
}

async function getCreativeDetails(creativeId, accessToken) {
  const cacheKey = `creative:${creativeId}`;
  const cached = readCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }
  const payload = await graphRequest(`/${creativeId}`, accessToken, {
    params: {
      fields: "id,name,object_story_spec,asset_feed_spec,degrees_of_freedom_spec,url_tags"
    }
  });
  writeCacheEntry(cacheKey, payload);
  return payload;
}

function sanitizeStoryIdentitySpec(storySpec = {}) {
  const sanitized = {};
  const pageId = String(storySpec?.page_id || "").trim();
  const instagramActorId = String(storySpec?.instagram_actor_id || "").trim();

  if (pageId) {
    sanitized.page_id = pageId;
  }
  if (instagramActorId) {
    sanitized.instagram_actor_id = instagramActorId;
  }

  return sanitized;
}

// Meta includes a derived `picture` URL alongside `image_hash` when reading a creative back,
// but rejects (OAuth code 100 / subcode 1443051, "ObjectStorySpecRedundant") a create request
// that resubmits both on the same link_data or child_attachment. image_hash is the more precise
// reference, so it wins whenever both are present after a straight read-back clone.
function dropRedundantPictureField(spec) {
  if (spec && typeof spec === "object" && spec.picture && spec.image_hash) {
    delete spec.picture;
  }
  return spec;
}

function sanitizeLinkData(linkData) {
  const cloned = { ...linkData };
  delete cloned.page_welcome_message;
  delete cloned.retailer_item_ids;
  delete cloned.product_data;
  delete cloned.template_data;
  return dropRedundantPictureField(cloned);
}

function cloneAssetFeedSpec(creative, preview) {
  const assetFeedSpec = creative?.asset_feed_spec;
  if (!assetFeedSpec || typeof assetFeedSpec !== "object") {
    return null;
  }

  const cloned = JSON.parse(JSON.stringify(assetFeedSpec));
  const destinationUrl = String(preview?.destinationUrl || "").trim();

  if (String(preview?.primaryText || "").trim()) {
    cloned.bodies = [{ text: preview.primaryText }];
  }

  if (String(preview?.headline || "").trim()) {
    cloned.titles = [{ text: preview.headline }];
  }

  if (String(preview?.description || "").trim()) {
    cloned.descriptions = [{ text: preview.description }];
  }

  if (destinationUrl) {
    cloned.link_urls = [{ website_url: destinationUrl }];
    if (Array.isArray(cloned.call_to_actions)) {
      cloned.call_to_actions = cloned.call_to_actions.map((item) => ({
        ...item,
        value: {
          ...(item?.value || {}),
          link: destinationUrl
        }
      }));
    }
  }

  return cloned;
}

function hasReusableStoryPayload(storySpec = {}) {
  return ["link_data", "video_data", "photo_data", "template_data"].some((key) => {
    const value = storySpec?.[key];
    return Boolean(value && typeof value === "object" && Object.keys(value).length);
  });
}

function firstTextValue(items = [], fallback = "") {
  const match = Array.isArray(items) ? items.find((item) => String(item?.text || "").trim()) : null;
  return match?.text || fallback;
}

function firstWebsiteUrl(items = [], fallback = "") {
  const match = Array.isArray(items) ? items.find((item) => String(item?.website_url || "").trim()) : null;
  return match?.website_url || fallback;
}

function firstImageHash(items = [], fallback = "") {
  const match = Array.isArray(items) ? items.find((item) => String(item?.hash || "").trim()) : null;
  return match?.hash || fallback;
}

function buildStorySpecFromAssetFeed(creative, preview, options = {}) {
  const storyIdentity = sanitizeStoryIdentitySpec(creative?.object_story_spec || {});
  const originalStorySpec = creative?.object_story_spec || {};
  const originalVideoData = originalStorySpec?.video_data || {};
  const assetFeedSpec = creative?.asset_feed_spec;
  if (!assetFeedSpec || typeof assetFeedSpec !== "object" || !storyIdentity.page_id) {
    return null;
  }

  const destinationUrl = String(preview?.destinationUrl || firstWebsiteUrl(assetFeedSpec.link_urls, "")).trim();
  const message = String(preview?.primaryText || firstTextValue(assetFeedSpec.bodies, "")).trim();
  const headline = String(preview?.headline || firstTextValue(assetFeedSpec.titles, "")).trim();
  const description = String(preview?.description || firstTextValue(assetFeedSpec.descriptions, "")).trim();
  const translatedAttachments = Array.isArray(options.translatedAttachments) ? options.translatedAttachments : [];

  const firstImage = Array.isArray(assetFeedSpec.images) ? assetFeedSpec.images.find((item) => String(item?.hash || "").trim()) : null;
  const firstVideo = Array.isArray(assetFeedSpec.videos) ? assetFeedSpec.videos.find((item) => String(item?.video_id || "").trim()) : null;
  const resolvedVideoThumbnailHash = String(
    originalVideoData.image_hash
    || firstImageHash(assetFeedSpec.images, "")
    || ""
  ).trim();
  const resolvedVideoThumbnailUrl = String(
    originalVideoData.image_url
    || firstVideo?.thumbnail_url
    || firstVideo?.image_url
    || ""
  ).trim();
  const adFormat = String(preview?.adFormat || "").trim().toLowerCase();

  if (firstImage && adFormat !== "carousel") {
    return {
      ...storyIdentity,
      link_data: {
        link: destinationUrl,
        message,
        name: headline,
        description,
        image_hash: firstImage.hash,
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: destinationUrl }
        }
      }
    };
  }

  if (firstVideo && adFormat === "video") {
    return {
      ...storyIdentity,
      video_data: {
        video_id: firstVideo.video_id,
        message,
        title: headline,
        link_description: description,
        ...(resolvedVideoThumbnailHash ? { image_hash: resolvedVideoThumbnailHash } : {}),
        ...(resolvedVideoThumbnailUrl ? { image_url: resolvedVideoThumbnailUrl } : {}),
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: destinationUrl }
        }
      }
    };
  }

  const carouselCards = Array.isArray(assetFeedSpec.images)
    ? assetFeedSpec.images
        .filter((item) => String(item?.hash || "").trim())
        .slice(0, 10)
        .map((item, index) => {
          const translated = translatedAttachments[index] || {};
          return {
            link: destinationUrl,
            image_hash: item.hash,
            name: translated.name || headline,
            description: translated.description || description
          };
        })
    : [];

  if (carouselCards.length >= 2 && adFormat === "carousel") {
    return {
      ...storyIdentity,
      link_data: {
        link: destinationUrl,
        message,
        name: headline,
        description,
        child_attachments: carouselCards,
        multi_share_optimized: false,
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: destinationUrl }
        }
      }
    };
  }

  if (firstImage) {
    return {
      ...storyIdentity,
      link_data: {
        link: destinationUrl,
        message,
        name: headline,
        description,
        image_hash: firstImage.hash,
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: destinationUrl }
        }
      }
    };
  }

  if (firstVideo) {
    return {
      ...storyIdentity,
      video_data: {
        video_id: firstVideo.video_id,
        message,
        title: headline,
        link_description: description,
        ...(resolvedVideoThumbnailHash ? { image_hash: resolvedVideoThumbnailHash } : {}),
        ...(resolvedVideoThumbnailUrl ? { image_url: resolvedVideoThumbnailUrl } : {}),
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: destinationUrl }
        }
      }
    };
  }

  return null;
}

const STORY_LIKE_PLACEMENT_TOKENS = new Set(["story", "stories", "reels", "facebook_reels"]);

function isStoryLikeCustomizationSpec(customizationSpec = {}) {
  const facebookPositions = Array.isArray(customizationSpec.facebook_positions) ? customizationSpec.facebook_positions : [];
  const instagramPositions = Array.isArray(customizationSpec.instagram_positions) ? customizationSpec.instagram_positions : [];
  return [...facebookPositions, ...instagramPositions].some((position) => STORY_LIKE_PLACEMENT_TOKENS.has(String(position || "").toLowerCase()));
}

function mergePlacementList(existing, incoming) {
  if (!Array.isArray(incoming) || !incoming.length) {
    return existing;
  }
  return [...new Set([...(existing || []), ...incoming])];
}

// A duplicated video ad should keep exactly the placements the source ad actually ran on
// (e.g. Facebook Search results, Instagram Explore) instead of a generic hardcoded set. The
// source's own asset_customization_rules already describe that, split across (usually two)
// rules that each point at one of its videos; the only thing that changes here is which video
// each rule's label points to, so rules are re-grouped onto exactly two labels - one for the
// square/feed video, one for the vertical/story video - by whether their placement list looks
// story-like, merging placement lists together if the source had more than one rule per side.
function buildVideoAssetCustomizationRules(sourceAssetFeedSpec, squareLabelName, verticalLabelName) {
  const sourceRules = Array.isArray(sourceAssetFeedSpec?.asset_customization_rules)
    ? sourceAssetFeedSpec.asset_customization_rules
    : [];
  if (!sourceRules.length) {
    return null;
  }

  const grouped = { square: null, vertical: null };
  for (const rule of sourceRules) {
    const spec = rule?.customization_spec || {};
    const side = isStoryLikeCustomizationSpec(spec) ? "vertical" : "square";
    const current = grouped[side] || {};
    grouped[side] = {
      publisher_platforms: mergePlacementList(current.publisher_platforms, spec.publisher_platforms),
      facebook_positions: mergePlacementList(current.facebook_positions, spec.facebook_positions),
      instagram_positions: mergePlacementList(current.instagram_positions, spec.instagram_positions),
      audience_network_positions: mergePlacementList(current.audience_network_positions, spec.audience_network_positions),
      messenger_positions: mergePlacementList(current.messenger_positions, spec.messenger_positions)
    };
  }

  const rules = [];
  if (grouped.square) {
    rules.push({ customization_spec: grouped.square, video_label: { name: squareLabelName } });
  }
  if (grouped.vertical) {
    rules.push({ customization_spec: grouped.vertical, video_label: { name: verticalLabelName } });
  }
  return rules.length ? rules : null;
}

async function ensureStorySpecVideoThumbnail(storySpec, accessToken) {
  const videoData = storySpec?.video_data;
  if (!videoData || typeof videoData !== "object") {
    return storySpec;
  }

  const imageHash = String(videoData.image_hash || "").trim();
  const imageUrl = String(videoData.image_url || "").trim();
  if (imageHash || imageUrl) {
    return storySpec;
  }

  const videoId = String(videoData.video_id || "").trim();
  if (!videoId) {
    return storySpec;
  }

  const thumbnailUrl = await getAdVideoThumbnailUrl(videoId, accessToken);
  if (!thumbnailUrl) {
    return storySpec;
  }

  return {
    ...storySpec,
    video_data: {
      ...videoData,
      image_url: thumbnailUrl
    }
  };
}

function cloneStorySpec(creative, preview, options = {}) {
  const storySpec = creative.object_story_spec || {};
  const cloned = JSON.parse(JSON.stringify(storySpec));
  const translatedAttachments = options.translatedAttachments || [];

  if (cloned.link_data) {
    cloned.link_data = sanitizeLinkData(cloned.link_data);
    cloned.link_data.message = preview.primaryText;
    cloned.link_data.name = preview.headline;
    cloned.link_data.description = preview.description;
    if (preview.destinationUrl) {
      cloned.link_data.link = preview.destinationUrl;
      if (Array.isArray(cloned.link_data.child_attachments)) {
        cloned.link_data.child_attachments = cloned.link_data.child_attachments.map((attachment, index) => {
          const translated = translatedAttachments[index] || {};
          const nextAttachment = {
            ...attachment,
            link: preview.destinationUrl
          };

          delete nextAttachment.page_welcome_message;
          delete nextAttachment.product_data;
          delete nextAttachment.retailer_item_ids;
          dropRedundantPictureField(nextAttachment);

          if (translated.name) {
            nextAttachment.name = translated.name;
          }

          if (translated.description) {
            nextAttachment.description = translated.description;
          }

          return nextAttachment;
        });
      }
    }
  }

  if (cloned.video_data) {
    cloned.video_data.message = preview.primaryText;
    cloned.video_data.title = preview.headline;
    cloned.video_data.link_description = preview.description;
    if (preview.destinationUrl) {
      cloned.video_data.call_to_action = cloned.video_data.call_to_action || { type: "LEARN_MORE", value: {} };
      cloned.video_data.call_to_action.value = {
        ...(cloned.video_data.call_to_action.value || {}),
        link: preview.destinationUrl
      };
    }
  }

  if (cloned.photo_data) {
    cloned.photo_data.caption = preview.headline;
    if (preview.destinationUrl) {
      cloned.photo_data.url = preview.destinationUrl;
    }
  }

  return cloned;
}

function summarizeCreativeForAi(creative) {
  const storySpec = creative?.object_story_spec || {};
  const linkData = storySpec.link_data || {};
  const videoData = storySpec.video_data || {};
  const photoData = storySpec.photo_data || {};
  const attachments = Array.isArray(linkData.child_attachments)
    ? linkData.child_attachments.map((attachment, index) => ({
        index,
        name: attachment.name || "",
        description: attachment.description || "",
        link: attachment.link || linkData.link || ""
      }))
    : [];

  // A creative built through Meta's asset-feed / dynamic-creative tooling carries its media
  // in asset_feed_spec.images/videos instead of object_story_spec, which the checks above
  // never look at. Missing this made every such ad register as "Single image" no matter its
  // real format, which then routed a duplicate through the plain clone-creative path instead
  // of the video/carousel override path - the source's original video always went out
  // untouched because the app never realized there was a video to override in the first place.
  const assetFeedSpec = creative?.asset_feed_spec || {};
  const assetFeedImageCount = Array.isArray(assetFeedSpec.images)
    ? assetFeedSpec.images.filter((item) => String(item?.hash || "").trim()).length
    : 0;
  const hasAssetFeedVideo = Array.isArray(assetFeedSpec.videos)
    ? assetFeedSpec.videos.some((item) => String(item?.video_id || "").trim())
    : false;

  return {
    format: attachments.length || assetFeedImageCount >= 2
      ? "Carousel"
      : videoData.video_id || hasAssetFeedVideo
        ? "Video"
        : "Single image",
    primaryText: linkData.message || videoData.message || photoData.caption || "",
    headline: linkData.name || videoData.title || "",
    description: linkData.description || videoData.link_description || "",
    destinationUrl:
      linkData.link ||
      videoData?.call_to_action?.value?.link ||
      photoData.url ||
      "",
    attachments
  };
}

async function createAdCreative(accountId, accessToken, sourceCreative, preview, options = {}) {
  const normalizedId = ensureAccountId(accountId);
  const creativeName = `${preview.source} -> ${preview.targetLanguage} -> ${preview.targetAdSet}`;
  const assetFeedSpec = cloneAssetFeedSpec(sourceCreative, preview);
  const sourceStorySpec = sourceCreative?.object_story_spec || {};
  const simplifiedStorySpec = await ensureStorySpecVideoThumbnail(
    buildStorySpecFromAssetFeed(sourceCreative, preview, options),
    accessToken
  );

  if (simplifiedStorySpec) {
    const payload = await graphRequest(`/${normalizedId}/adcreatives`, accessToken, {
      method: "POST",
      params: {
        name: creativeName,
        object_story_spec: simplifiedStorySpec,
        url_tags: sourceCreative.url_tags || ""
      }
    });

    return payload.id;
  }

  // Meta sometimes adds metadata-only asset feeds (for example message_extensions)
  // to otherwise complete carousel creatives. Reposting that partial asset feed
  // drops the real story payload and Meta rejects the creative with OAuth code 3.
  if (hasReusableStoryPayload(sourceStorySpec)) {
    const objectStorySpec = await ensureStorySpecVideoThumbnail(
      cloneStorySpec(sourceCreative, preview, options),
      accessToken
    );
    const payload = await graphRequest(`/${normalizedId}/adcreatives`, accessToken, {
      method: "POST",
      params: {
        name: creativeName,
        object_story_spec: objectStorySpec,
        url_tags: sourceCreative.url_tags || ""
      }
    });

    return payload.id;
  }

  if (assetFeedSpec) {
    const payload = await graphRequest(`/${normalizedId}/adcreatives`, accessToken, {
      method: "POST",
      params: {
        name: creativeName,
        object_story_spec: sanitizeStoryIdentitySpec(sourceCreative?.object_story_spec || {}),
        asset_feed_spec: assetFeedSpec,
        degrees_of_freedom_spec: sourceCreative?.degrees_of_freedom_spec || "",
        url_tags: sourceCreative.url_tags || ""
      }
    });

    return payload.id;
  }

  const objectStorySpec = await ensureStorySpecVideoThumbnail(
    cloneStorySpec(sourceCreative, preview, options),
    accessToken
  );
  const payload = await graphRequest(`/${normalizedId}/adcreatives`, accessToken, {
    method: "POST",
    params: {
      name: creativeName,
      object_story_spec: objectStorySpec,
      url_tags: sourceCreative.url_tags || ""
    }
  });

  return payload.id;
}

async function createAd(accountId, accessToken, name, adSetId, creativeId) {
  const normalizedId = ensureAccountId(accountId);
  const payload = await graphRequest(`/${normalizedId}/ads`, accessToken, {
    method: "POST",
    params: {
      name,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED"
    }
  });

  return payload.id;
}

async function uploadAdImage(accountId, accessToken, name, bytesBase64) {
  const normalizedId = ensureAccountId(accountId);
  const payload = await graphRequest(`/${normalizedId}/adimages`, accessToken, {
    method: "POST",
    params: {
      name,
      bytes: bytesBase64
    }
  });

  const images = payload.images || {};
  const first = Object.values(images)[0];
  const hash = first?.hash || payload.hash || null;
  if (!hash) {
    throw new Error("Meta image upload did not return an image hash.");
  }
  return hash;
}

async function uploadAdVideoFromUrl(accountId, accessToken, name, fileUrl) {
  const normalizedId = ensureAccountId(accountId);
  const payload = await graphRequest(`/${normalizedId}/advideos`, accessToken, {
    method: "POST",
    params: {
      name,
      file_url: fileUrl
    }
  });

  const id = payload.id || payload.video_id || null;
  if (!id) {
    throw new Error("Meta video upload did not return a video id.");
  }
  return id;
}

async function uploadAdVideoFromFile(accountId, accessToken, name, bytesBase64, mimeType = "video/mp4") {
  const normalizedId = ensureAccountId(accountId);
  if (!bytesBase64) {
    throw new Error("Missing video bytes for Meta upload.");
  }

  const url = `${GRAPH_BASE}/${normalizedId}/advideos`;
  const buffer = Buffer.from(bytesBase64, "base64");
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "video/mp4" });

  form.append("access_token", accessToken);
  form.append("name", name || "westpack-video");
  form.append("source", blob, name || "westpack-video.mp4");

  const response = await fetch(url, {
    method: "POST",
    body: form
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload?.error?.message || "Meta video file upload failed.";
    throw new Error(message);
  }

  const id = payload.id || payload.video_id || null;
  if (!id) {
    throw new Error("Meta video upload did not return a video id.");
  }
  return id;
}

async function startAdVideoUploadSession(accountId, accessToken, fileSize) {
  const normalizedId = ensureAccountId(accountId);
  const payload = await graphRequest(`/${normalizedId}/advideos`, accessToken, {
    method: "POST",
    params: {
      upload_phase: "start",
      file_size: String(fileSize || 0)
    }
  });

  return {
    uploadSessionId: payload.upload_session_id || "",
    videoId: payload.video_id || payload.id || "",
    startOffset: payload.start_offset || "0",
    endOffset: payload.end_offset || "0"
  };
}

async function transferAdVideoUploadChunk(accountId, accessToken, uploadSessionId, startOffset, chunkBase64, mimeType = "video/mp4") {
  const normalizedId = ensureAccountId(accountId);
  if (!chunkBase64) {
    throw new Error("Missing video chunk for Meta upload.");
  }
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const url = `${GRAPH_BASE}/${normalizedId}/advideos`;
    const buffer = Buffer.from(chunkBase64, "base64");
    const form = new FormData();
    const blob = new Blob([buffer], { type: mimeType || "video/mp4" });

    form.append("access_token", accessToken);
    form.append("upload_phase", "transfer");
    form.append("upload_session_id", String(uploadSessionId || ""));
    form.append("start_offset", String(startOffset || "0"));
    form.append("video_file_chunk", blob, "chunk.bin");

    const response = await fetch(url, {
      method: "POST",
      body: form
    });
    const payload = await response.json();

    if (response.ok && !payload.error) {
      return {
        startOffset: payload.start_offset || "0",
        endOffset: payload.end_offset || "0"
      };
    }

    const message = payload?.error?.message || "Meta video chunk upload failed.";
    if (attempt < maxRetries && isRateLimitMessage(message)) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : 2000 * (attempt + 1);
      await sleep(retryDelay);
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Meta video chunk upload failed.");
}

async function finishAdVideoUploadSession(accountId, accessToken, uploadSessionId, name) {
  const normalizedId = ensureAccountId(accountId);
  const payload = await graphRequest(`/${normalizedId}/advideos`, accessToken, {
    method: "POST",
    params: {
      upload_phase: "finish",
      upload_session_id: String(uploadSessionId || ""),
      title: name || "westpack-video"
    }
  });

  return {
    success: payload.success !== false,
    videoId: payload.video_id || payload.id || ""
  };
}

async function getAdVideoStatus(videoId, accessToken) {
  if (!videoId) {
    throw new Error("Missing Meta video id.");
  }

  return graphRequest(`/${videoId}`, accessToken, {
    params: {
      fields: "id,status"
    }
  });
}

async function getAdVideoThumbnailUrl(videoId, accessToken) {
  if (!videoId) {
    throw new Error("Missing Meta video id.");
  }

  const payload = await graphRequest(`/${videoId}`, accessToken, {
    params: {
      fields: "thumbnails{uri,is_preferred,height,width}"
    }
  });

  const candidates = Array.isArray(payload?.thumbnails?.data)
    ? payload.thumbnails.data
    : Array.isArray(payload?.thumbnails)
      ? payload.thumbnails
      : [];

  const preferred = candidates.find((item) => item?.is_preferred && item?.uri) || null;
  const largest = candidates
    .filter((item) => item?.uri)
    .sort((left, right) => Number(right?.width || 0) - Number(left?.width || 0))[0] || null;

  return String(preferred?.uri || largest?.uri || "").trim();
}

async function waitForAdVideoReady(videoId, accessToken, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 120000);
  const intervalMs = Number(options.intervalMs || 6000);
  const startedAt = Date.now();
  let lastStatus = null;

  while ((Date.now() - startedAt) < timeoutMs) {
    const payload = await getAdVideoStatus(videoId, accessToken);
    const status = payload?.status || {};
    const videoStatus = String(status.video_status || "").toLowerCase();
    const processingStatus = String(status?.processing_phase?.status || "").toLowerCase();
    const publishingStatus = String(status?.publishing_phase?.status || "").toLowerCase();

    lastStatus = {
      videoStatus,
      processingStatus,
      publishingStatus
    };

    if (videoStatus === "ready" && processingStatus === "complete") {
      return payload;
    }

    if (videoStatus === "error" || processingStatus === "error") {
      throw new Error(`Meta video processing failed for ${videoId}.`);
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `Meta video ${videoId} is still processing after ${Math.round(timeoutMs / 1000)}s` +
    (lastStatus ? ` (${lastStatus.videoStatus || "unknown"} / ${lastStatus.processingStatus || "unknown"})` : ".")
  );
}

async function getIdentityFromAnyAd(accountId, accessToken) {
  const normalizedId = ensureAccountId(accountId);
  const cacheKey = `identity:${normalizedId}`;
  const cached = readCacheEntry(cacheKey, 30 * 60 * 1000);
  if (cached?.pageId) {
    return cached;
  }
  const payload = await graphRequest(`/${normalizedId}/ads`, accessToken, {
    params: {
      fields: "id,creative{object_story_spec}",
      limit: "50"
    }
  });

  const ads = Array.isArray(payload.data) ? payload.data : [];
  for (const ad of ads) {
    const spec = ad?.creative?.object_story_spec;
    const pageId = spec?.page_id;
    const igActorId = spec?.instagram_actor_id;
    if (pageId) {
      const resolvedIdentity = { pageId, instagramActorId: igActorId || "" };
      writeCacheEntry(cacheKey, resolvedIdentity);
      return resolvedIdentity;
    }
  }

  throw new Error("Could not infer page identity from existing ads. Add a source ad or set identity in Meta.");
}

async function createAdCreativeFromSpec(accountId, accessToken, name, objectStorySpec, urlTags = "") {
  const normalizedId = ensureAccountId(accountId);
  const resolvedStorySpec = await ensureStorySpecVideoThumbnail(objectStorySpec, accessToken);
  const payload = await graphRequest(`/${normalizedId}/adcreatives`, accessToken, {
    method: "POST",
    params: {
      name,
      object_story_spec: resolvedStorySpec,
      url_tags: urlTags
    }
  });

  return payload.id;
}

async function createAdCreativeWithAssetFeed(accountId, accessToken, options = {}) {
  const normalizedId = ensureAccountId(accountId);
  const payload = await graphRequest(`/${normalizedId}/adcreatives`, accessToken, {
    method: "POST",
    params: {
      name: options.name,
      object_story_spec: options.objectStorySpec,
      asset_feed_spec: options.assetFeedSpec,
      degrees_of_freedom_spec: options.degreesOfFreedomSpec || "",
      url_tags: options.urlTags || ""
    }
  });

  return payload.id;
}

module.exports = {
  ensureAccountId,
  graphRequest,
  buildVideoAssetCustomizationRules,
  isRateLimitMessage,
  createAd,
  createAdCreative,
  createAdCreativeFromSpec,
  finishAdVideoUploadSession,
  findTargetAdSet,
  getAdDetails,
  getAdSets,
  getCreativeDetails,
  getIdentityFromAnyAd,
  getAdVideoThumbnailUrl,
  getAdVideoStatus,
  hasReusableStoryPayload,
  startAdVideoUploadSession,
  summarizeCreativeForAi,
  transferAdVideoUploadChunk,
  uploadAdImage,
  uploadAdVideoFromFile,
  uploadAdVideoFromUrl,
  waitForAdVideoReady,
  createAdCreativeWithAssetFeed
};
