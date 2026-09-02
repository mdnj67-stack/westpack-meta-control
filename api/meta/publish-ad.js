const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const { assertCampaignStudioCarouselContract } = require("../../server/campaign/meta-carousel-contract");
const {
  buildVideoAssetCustomizationRules,
  createAd,
  createAdCreative,
  createAdCreativeFromSpec,
  createAdCreativeWithAssetFeed,
  finishAdVideoUploadSession,
  findTargetAdSet,
  getAdDetails,
  getAdSets,
  getCreativeDetails,
  getIdentityFromAnyAd,
  getAdVideoThumbnailUrl,
  waitForAdVideoReady,
  startAdVideoUploadSession,
  transferAdVideoUploadChunk,
  uploadAdImage,
  uploadAdVideoFromFile,
  uploadAdVideoFromUrl
} = require("../../server/lib/meta");

function buildMetaEntityName(...parts) {
  return parts
    .flatMap((part) => String(part || "").split("|"))
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" - ")
    .replace(/[|]/g, "")
    .slice(0, 200);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePublishText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function assertSafeRemoteImageUrl(value = "") {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") {
    throw new Error("Remote carousel images must use HTTPS.");
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Remote carousel image host is not allowed.");
  }
  return url.toString();
}

async function readRemoteImageBase64(sourceUrl = "", label = "carousel image") {
  const safeUrl = assertSafeRemoteImageUrl(sourceUrl);
  const response = await fetch(safeUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Could not download ${label} (${response.status}).`);
  }
  assertSafeRemoteImageUrl(response.url || safeUrl);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error(`${label} did not return an image.`);
  }
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 3_000_000) {
    throw new Error(`${label} is too large for serverless upload.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 3_000_000) {
    throw new Error(`${label} is empty or too large for serverless upload.`);
  }
  return bytes.toString("base64");
}

function buildValidationSummary({ action = "", adFormat = "", targetAdSet = null, warnings = [] } = {}) {
  return {
    action,
    adFormat,
    targetAdSet: targetAdSet
      ? {
          id: String(targetAdSet.id || ""),
          name: String(targetAdSet.name || ""),
          campaignId: String(targetAdSet?.campaign?.id || ""),
          campaignName: String(targetAdSet?.campaign?.name || "")
        }
      : null,
    warnings
  };
}

async function validatePublishDraft({ body, config, targetAdSet }) {
  const action = String(body.action || "").trim();
  const adFormat = String(body.ad_format || "Single image").trim();
  const warnings = [];
  const creativeStrategy = body.creative_strategy || {};
  const destinationUrl = normalizePublishText(body.destination_url || "https://www.westpack.com/");

  if (!/^https?:\/\//i.test(destinationUrl)) {
    throw new Error("Destination URL must start with http:// or https://.");
  }

  if (!normalizePublishText(creativeStrategy.primary_text)) {
    warnings.push("Primary text is empty.");
  }

  if (!normalizePublishText(creativeStrategy.headline)) {
    warnings.push("Headline is empty.");
  }

  if (action === "create_new_ad") {
    const uploadedImageVariants = Array.isArray(body.uploaded_image_variants) ? body.uploaded_image_variants : [];
    const uploadedCarouselVariants = Array.isArray(body.uploaded_carousel_variants) ? body.uploaded_carousel_variants : [];
    const uploadedVideoVariants = Array.isArray(body.uploaded_video_variants) ? body.uploaded_video_variants : [];
    const videoVariants = Array.isArray(body.video_variants) ? body.video_variants : [];

    const identity = await getIdentityFromAnyAd(config.metaAdAccountId, config.metaAccessToken);

    if (adFormat === "Single image") {
      const requiredKeys = ["square", "portrait", "vertical"];
      const providedKeys = new Set(uploadedImageVariants.map((variant) => String(variant?.key || "").trim().toLowerCase()));
      const missingKeys = requiredKeys.filter((key) => !providedKeys.has(key));
      if (missingKeys.length) {
        throw new Error(`Single image dry-run is missing required image variants: ${missingKeys.join(", ")}.`);
      }
    }

    if (adFormat === "Carousel") {
      const squareVariant = uploadedCarouselVariants.find((variant) => String(variant?.key || "").trim().toLowerCase() === "square")
        || uploadedCarouselVariants[0]
        || null;
      const squareItems = Array.isArray(squareVariant?.items) ? squareVariant.items : [];
      if (squareItems.length < 2) {
        throw new Error("Carousel dry-run requires at least 2 uploaded square cards.");
      }
    }

    if (adFormat === "Video") {
      const uploadedKeys = new Set(uploadedVideoVariants.map((variant) => String(variant?.key || "").trim().toLowerCase()));
      const urlKeys = new Set(videoVariants.map((variant) => String(variant?.key || "").trim().toLowerCase()));
      const hasSquare = uploadedKeys.has("square") || urlKeys.has("square");
      const hasVertical = uploadedKeys.has("vertical") || urlKeys.has("vertical");
      if (!hasSquare || !hasVertical) {
        throw new Error("Video dry-run requires both square and vertical video variants.");
      }
    }

    return {
      ok: true,
      dryRun: true,
      validation: buildValidationSummary({
        action,
        adFormat,
        targetAdSet,
        warnings
      }),
      identity: {
        pageId: String(identity?.pageId || ""),
        instagramActorId: String(identity?.instagramActorId || "")
      }
    };
  }

  if (!body.source_ad_id) {
    throw new Error("Missing source ad id for duplicate dry-run.");
  }

  const sourceAd = await getAdDetails(body.source_ad_id, config.metaAccessToken);
  const sourceCreativeId = String(sourceAd?.creative?.id || "").trim();
  if (!sourceCreativeId) {
    throw new Error("Source ad has no creative id.");
  }

  const creativeOverrideMode = String(body.creative_override_mode || "").trim().toLowerCase();
  if (adFormat === "Carousel" && creativeOverrideMode === "carousel") {
    const uploadedCarouselVariants = Array.isArray(body.uploaded_carousel_variants) ? body.uploaded_carousel_variants : [];
    const squareVariant = uploadedCarouselVariants.find((variant) => String(variant?.key || "").trim().toLowerCase() === "square")
      || uploadedCarouselVariants[0]
      || null;
    const squareItems = Array.isArray(squareVariant?.items) ? squareVariant.items : [];
    if (squareItems.length < 2) {
      throw new Error("Localized carousel override dry-run requires at least 2 uploaded square cards.");
    }
  }

  if (adFormat === "Video" && creativeOverrideMode === "video") {
    const uploadedVideoVariants = Array.isArray(body.uploaded_video_variants) ? body.uploaded_video_variants : [];
    const videoVariants = Array.isArray(body.video_variants) ? body.video_variants : [];
    const uploadedKeys = new Set(uploadedVideoVariants.map((variant) => String(variant?.key || "").trim().toLowerCase()));
    const urlKeys = new Set(videoVariants.map((variant) => String(variant?.key || "").trim().toLowerCase()));
    const hasSquare = uploadedKeys.has("square") || urlKeys.has("square");
    const hasVertical = uploadedKeys.has("vertical") || urlKeys.has("vertical");
    if (!hasSquare || !hasVertical) {
      throw new Error("Duplicate video override dry-run requires both square and vertical video variants.");
    }
  }

  return {
    ok: true,
    dryRun: true,
    validation: buildValidationSummary({
      action,
      adFormat,
      targetAdSet,
      warnings
    }),
    sourceAd: {
      id: String(sourceAd?.id || ""),
      name: String(sourceAd?.name || ""),
      creativeId: sourceCreativeId
    }
  };
}

async function createAdWithRetry(accountId, accessToken, name, adSetId, creativeId, options = {}) {
  const attempts = Number(options.attempts || 4);
  const delayMs = Number(options.delayMs || 5000);
  let lastError = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await createAd(accountId, accessToken, name, adSetId, creativeId);
    } catch (error) {
      lastError = error;
      if (index === attempts - 1) {
        break;
      }
      await sleep((delayMs * (2 ** index)) + Math.round(Math.random() * 1000));
    }
  }

  throw lastError || new Error("Meta ad creation failed.");
}

async function publishVideoAdFromVariants({
  config,
  targetAdSet,
  body,
  creativeName,
  destinationUrl,
  message,
  headline,
  description,
  uploadedVideoVariants = [],
  videoVariants = [],
  sourceAssetFeedSpec = null
}) {
  const squareUploadedVideo = uploadedVideoVariants.find((variant) => variant?.key === "square") || null;
  const verticalUploadedVideo = uploadedVideoVariants.find((variant) => variant?.key === "vertical") || null;
  const squarePreuploadedVideoId = String(squareUploadedVideo?.meta_video_id || "").trim();
  const verticalPreuploadedVideoId = String(verticalUploadedVideo?.meta_video_id || "").trim();
  const squareVideoUrl = String(
    videoVariants.find((variant) => variant?.key === "square")?.url ||
    body.video_url ||
    ""
  ).trim();
  const verticalVideoUrl = String(
    videoVariants.find((variant) => variant?.key === "vertical")?.url ||
    ""
  ).trim();
  const hasPreuploadedVariants = Boolean(squarePreuploadedVideoId && verticalPreuploadedVideoId);
  const hasUploadedVariants = Boolean(squareUploadedVideo && verticalUploadedVideo);
  const hasUrlVariants = Boolean(squareVideoUrl && verticalVideoUrl);

  if (!hasPreuploadedVariants && !hasUploadedVariants && !hasUrlVariants) {
    throw new Error("Video ads require both 1:1 feed video and 9:16 stories/reels video.");
  }

  const identity = await getIdentityFromAnyAd(config.metaAdAccountId, config.metaAccessToken);
  let videoStage = "prepare";

  try {
    const squareVideoId = hasPreuploadedVariants
      ? squarePreuploadedVideoId
      : hasUploadedVariants
      ? await uploadAdVideoFromFile(
          config.metaAdAccountId,
          config.metaAccessToken,
          `${body.source_ad_name || "westpack-video"}-feed.mp4`,
          squareUploadedVideo.data_base64,
          squareUploadedVideo.mime
        )
      : await uploadAdVideoFromUrl(
          config.metaAdAccountId,
          config.metaAccessToken,
          `${body.source_ad_name || "westpack-video"}-feed`,
          squareVideoUrl
        );
    const verticalVideoId = hasPreuploadedVariants
      ? verticalPreuploadedVideoId
      : hasUploadedVariants
      ? await uploadAdVideoFromFile(
          config.metaAdAccountId,
          config.metaAccessToken,
          `${body.source_ad_name || "westpack-video"}-vertical.mp4`,
          verticalUploadedVideo.data_base64,
          verticalUploadedVideo.mime
        )
      : await uploadAdVideoFromUrl(
          config.metaAdAccountId,
          config.metaAccessToken,
          `${body.source_ad_name || "westpack-video"}-vertical`,
          verticalVideoUrl
        );

    videoStage = "wait_for_processing";
    await waitForAdVideoReady(squareVideoId, config.metaAccessToken);
    await waitForAdVideoReady(verticalVideoId, config.metaAccessToken);

    videoStage = "fetch_thumbnails";
    const squareThumbnailUrl = await getAdVideoThumbnailUrl(squareVideoId, config.metaAccessToken);
    const verticalThumbnailUrl = await getAdVideoThumbnailUrl(verticalVideoId, config.metaAccessToken);

    if (!squareThumbnailUrl || !verticalThumbnailUrl) {
      throw new Error("Meta did not return video thumbnails for both placements.");
    }

    const objectStorySpec = {
      page_id: identity.pageId
    };
    if (identity.instagramActorId) {
      objectStorySpec.instagram_user_id = identity.instagramActorId;
    }

    videoStage = "create_creative";
    // Prefer the source ad's own placement rules (Facebook Search results, Instagram
    // Explore, etc. only show up here when the source actually used them) over the generic
    // hardcoded pair - duplicating an ad should keep its real placement footprint, not reset
    // it to a fixed default every time.
    const assetCustomizationRules = buildVideoAssetCustomizationRules(sourceAssetFeedSpec, "video_square", "video_vertical")
      || [
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["feed", "marketplace", "video_feeds"],
            instagram_positions: ["stream", "explore", "profile_feed"]
          },
          video_label: { name: "video_square" }
        },
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["story", "facebook_reels"],
            instagram_positions: ["story", "reels"]
          },
          video_label: { name: "video_vertical" }
        }
      ];

    const creativeId = await createAdCreativeWithAssetFeed(
      config.metaAdAccountId,
      config.metaAccessToken,
      {
        name: creativeName,
        objectStorySpec,
        degreesOfFreedomSpec: sourceAssetFeedSpec?.degrees_of_freedom_spec || "",
        assetFeedSpec: {
          ad_formats: Array.isArray(sourceAssetFeedSpec?.ad_formats) && sourceAssetFeedSpec.ad_formats.length
            ? sourceAssetFeedSpec.ad_formats
            : ["AUTOMATIC_FORMAT"],
          optimization_type: sourceAssetFeedSpec?.optimization_type || "PLACEMENT",
          videos: [
            {
              video_id: squareVideoId,
              thumbnail_url: squareThumbnailUrl,
              adlabels: [{ name: "video_square" }]
            },
            {
              video_id: verticalVideoId,
              thumbnail_url: verticalThumbnailUrl,
              adlabels: [{ name: "video_vertical" }]
            }
          ],
          bodies: [{ text: message }],
          titles: [{ text: headline }],
          descriptions: [{ text: description }],
          link_urls: [{ website_url: destinationUrl }],
          call_to_action_types: ["LEARN_MORE"],
          asset_customization_rules: assetCustomizationRules
        }
      }
    );

    videoStage = "create_ad";
    const adId = await createAdWithRetry(
      config.metaAdAccountId,
      config.metaAccessToken,
      creativeName,
      targetAdSet.id,
      creativeId,
      { attempts: 4, delayMs: 5000 }
    );

    return {
      ok: true,
      adId,
      creativeId,
      adSetId: targetAdSet.id,
      status: "PAUSED"
    };
  } catch (error) {
    throw new Error(`Meta video publish failed during ${videoStage}: ${error.message || "Unknown video error."}`);
  }
}

async function translateCarouselAttachments(config, body, sourceCreative) {
  const attachments = sourceCreative?.object_story_spec?.link_data?.child_attachments;

  if (!Array.isArray(attachments) || !attachments.length) {
    return [];
  }

  if (!config.openAiApiKey) {
    return [];
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You translate Meta carousel card copy for Westpack ads.",
                "Return strict JSON only.",
                "Preserve commercial intent, make phrasing natural in the target language, and keep copy concise.",
                "Return an object with key attachments, which is an array of objects with keys name and description."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                targetLanguage: body.target_language,
                destinationUrl: body.destination_url,
                sourceAdName: body.source_ad_name,
                topLevelCopy: body.creative_strategy,
                attachments: attachments.map((attachment) => ({
                  name: attachment.name || "",
                  description: attachment.description || ""
                }))
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "translated_carousel_cards",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              attachments: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" }
                  },
                  required: ["name", "description"]
                }
              }
            },
            required: ["attachments"]
          }
        }
      }
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Carousel translation failed.");
  }

  const jsonText =
    payload.output_text ||
    (Array.isArray(payload.output)
      ? payload.output
          .flatMap((output) => output.content || [])
          .filter((item) => item.type === "output_text" && item.text)
          .map((item) => item.text)
          .join("\n")
      : "");

  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed.attachments) ? parsed.attachments : [];
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  if (!requireAuth(req, res, config)) {
    return;
  }
  if (!config.metaAccessToken || !config.metaAdAccountId) {
    sendJson(res, 500, { error: "Missing Meta credentials." });
    return;
  }

  try {
    const body = await readJsonBody(req);

    if (body.action === "start_video_upload_session") {
      const session = await startAdVideoUploadSession(
        config.metaAdAccountId,
        config.metaAccessToken,
        Number(body.file_size || 0)
      );
      sendJson(res, 200, { ok: true, ...session });
      return;
    }

    if (body.action === "transfer_video_upload_chunk") {
      const result = await transferAdVideoUploadChunk(
        config.metaAdAccountId,
        config.metaAccessToken,
        body.upload_session_id,
        body.start_offset,
        body.chunk_base64,
        body.mime
      );
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (body.action === "finish_video_upload_session") {
      const result = await finishAdVideoUploadSession(
        config.metaAdAccountId,
        config.metaAccessToken,
        body.upload_session_id,
        body.file_name
      );
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (body.action === "upload_image_asset") {
      const bytes = String(body.data_base64 || "").trim();
      if (!bytes) {
        sendJson(res, 400, { error: "Missing image bytes for upload_image_asset." });
        return;
      }
      const imageHash = await uploadAdImage(
        config.metaAdAccountId,
        config.metaAccessToken,
        body.file_name || "westpack-image",
        bytes
      );
      sendJson(res, 200, { ok: true, imageHash });
      return;
    }

    if (body.action !== "create_cloned_ad" && body.action !== "create_new_ad" && body.action !== "validate_publish_draft") {
      sendJson(res, 400, { error: "Unsupported publish action." });
      return;
    }

    const validationAction = body.action === "validate_publish_draft";
    const resolvedAction = validationAction
      ? (String(body.publish_action || "").trim() || (body.source_ad_id ? "create_cloned_ad" : "create_new_ad"))
      : body.action;
    assertCampaignStudioCarouselContract(body);
    const targetAdSet = body.target_adset_id
      ? {
          id: String(body.target_adset_id || "").trim(),
          name: String(body.target_adset_name || "").trim(),
          campaign: {
            id: String(body.target_campaign_id || "").trim(),
            name: String(body.target_campaign_name || "").trim()
          }
        }
      : findTargetAdSet(
          await getAdSets(config.metaAdAccountId, config.metaAccessToken),
          body.target_campaign_name,
          body.target_adset_name,
          body.target_adset_id
        );

    if (!targetAdSet) {
      sendJson(res, 404, {
        error: `Target ad set '${body.target_adset_name}' was not found in campaign '${body.target_campaign_name}'.`
      });
      return;
    }

    if (validationAction) {
      const result = await validatePublishDraft({
        body: {
          ...body,
          action: resolvedAction
        },
        config,
        targetAdSet
      });
      sendJson(res, 200, result);
      return;
    }

    if (resolvedAction === "create_new_ad") {
      const strategy = body.creative_strategy || {};
      const uploadedFiles = Array.isArray(body.uploaded_files) ? body.uploaded_files : [];
      const translatedAttachments =
        Array.isArray(body.translated_attachments) && body.translated_attachments.length
          ? body.translated_attachments
          : [];

      const imageFiles = uploadedFiles.filter((file) => String(file.mime || "").startsWith("image/"));

      const identity = await getIdentityFromAnyAd(config.metaAdAccountId, config.metaAccessToken);
      const destinationUrl = body.destination_url || "https://www.westpack.com/";
      const adFormat = body.ad_format || "Single image";
      const uploadedImageVariants = Array.isArray(body.uploaded_image_variants) ? body.uploaded_image_variants : [];
      const uploadedCarouselVariants = Array.isArray(body.uploaded_carousel_variants) ? body.uploaded_carousel_variants : [];
      const videoVariants = Array.isArray(body.video_variants) ? body.video_variants : [];
      const uploadedVideoVariants = Array.isArray(body.uploaded_video_variants) ? body.uploaded_video_variants : [];

      const message = strategy.primary_text || "";
      const headline = strategy.headline || body.source_ad_name || "Westpack";
      const description = strategy.description || "";

      if (adFormat === "Video") {
        try {
          const creativeName = buildMetaEntityName(
            body.source_ad_name || "New video",
            body.target_language || "EN",
            body.target_adset_name || targetAdSet.name
          );
          const result = await publishVideoAdFromVariants({
            config,
            targetAdSet,
            body,
            creativeName,
            destinationUrl,
            message,
            headline,
            description,
            uploadedVideoVariants,
            videoVariants
          });

          sendJson(res, 200, result);
          return;
        } catch (videoError) {
          sendJson(res, 500, { error: videoError.message || "Meta video publish failed." });
          return;
        }
      }

      if (adFormat === "Single image" && uploadedImageVariants.length) {
        const squareImage = uploadedImageVariants.find((variant) => variant?.key === "square") || null;
        const portraitImage = uploadedImageVariants.find((variant) => variant?.key === "portrait") || null;
        const verticalImage = uploadedImageVariants.find((variant) => variant?.key === "vertical") || null;

        if (!squareImage || !portraitImage || !verticalImage) {
          sendJson(res, 400, { error: "Single image ads now require all three image variants: 1:1, 4:5 and 9:16." });
          return;
        }

        const imageVariants = [squareImage, portraitImage, verticalImage];
        const imageHashesByKey = {};

        for (const variant of imageVariants) {
          const preuploadedHash = String(variant.meta_image_hash || "").trim();
          if (preuploadedHash) {
            imageHashesByKey[variant.key] = preuploadedHash;
            continue;
          }
          const bytes = String(variant.data_base64 || "").trim();
          if (!bytes) {
            sendJson(res, 400, { error: `Missing image bytes for ${variant.name || variant.label || variant.key || "image variant"}.` });
            return;
          }
          if (bytes.length > 4_000_000) {
            sendJson(res, 400, { error: `File '${variant.name || variant.label || "image"}' is too large for serverless upload. Try a smaller image.` });
            return;
          }
          imageHashesByKey[variant.key] = await uploadAdImage(
            config.metaAdAccountId,
            config.metaAccessToken,
            variant.name || `${body.source_ad_name || "westpack-image"}-${variant.key}`,
            bytes
          );
        }

        const objectStorySpec = {
          page_id: identity.pageId
        };
        if (identity.instagramActorId) {
          objectStorySpec.instagram_actor_id = identity.instagramActorId;
        }

        const creativeName = buildMetaEntityName(
          body.source_ad_name || "New image ad",
          body.target_language || "EN",
          body.target_adset_name || targetAdSet.name
        );

        const creativeId = await createAdCreativeWithAssetFeed(
          config.metaAdAccountId,
          config.metaAccessToken,
          {
            name: creativeName,
            objectStorySpec,
            assetFeedSpec: {
              ad_formats: ["SINGLE_IMAGE"],
              images: [
                {
                  hash: imageHashesByKey.square,
                  adlabels: [{ name: "image_square" }]
                },
                {
                  hash: imageHashesByKey.portrait,
                  adlabels: [{ name: "image_portrait" }]
                },
                {
                  hash: imageHashesByKey.vertical,
                  adlabels: [{ name: "image_vertical" }]
                }
              ],
              bodies: [{ text: message }],
              titles: [{ text: headline }],
              descriptions: [{ text: description }],
              link_urls: [{ website_url: destinationUrl }],
              call_to_action_types: ["LEARN_MORE"],
              asset_customization_rules: [
                {
                  customization_spec: {
                    publisher_platforms: ["facebook", "instagram"],
                    facebook_positions: ["feed", "marketplace", "video_feeds"],
                    instagram_positions: ["explore", "profile_feed"]
                  },
                  image_label: { name: "image_square" }
                },
                {
                  customization_spec: {
                    publisher_platforms: ["instagram"],
                    instagram_positions: ["stream"]
                  },
                  image_label: { name: "image_portrait" }
                },
                {
                  customization_spec: {
                    publisher_platforms: ["facebook", "instagram"],
                    facebook_positions: ["story", "facebook_reels"],
                    instagram_positions: ["story", "reels"]
                  },
                  image_label: { name: "image_vertical" }
                }
              ]
            }
          }
        );

        const adId = await createAdWithRetry(
          config.metaAdAccountId,
          config.metaAccessToken,
          creativeName,
          targetAdSet.id,
          creativeId,
          { attempts: 4, delayMs: 5000 }
        );

        sendJson(res, 200, { ok: true, adId, creativeId, adSetId: targetAdSet.id, status: "PAUSED", draftOnly: true, language: body.target_language || "" });
        return;
      }

      if (adFormat === "Carousel" && uploadedCarouselVariants.length) {
        const squareVariant = uploadedCarouselVariants.find((variant) => variant?.key === "square") || uploadedCarouselVariants[0] || null;

        if (!squareVariant) {
          sendJson(res, 400, { error: "Carousel ads now require a 1:1 card set." });
          return;
        }

        const squareItems = Array.isArray(squareVariant.items) ? squareVariant.items : [];
        const cardCount = squareItems.length;

        if (cardCount < 2) {
          sendJson(res, 400, { error: "Carousel ads require at least 2 square cards (1:1)." });
          return;
        }

        const hashes = [];
        for (let index = 0; index < squareItems.length; index += 1) {
          const item = squareItems[index] || {};
          const preuploadedHash = String(item.meta_image_hash || "").trim();
          if (preuploadedHash) {
            hashes.push(preuploadedHash);
            continue;
          }
          const sourceUrl = String(item.source_url || "").trim();
          const bytes = String(item.data_base64 || "").trim()
            || (sourceUrl ? await readRemoteImageBase64(sourceUrl, item.name || `carousel card ${index + 1}`) : "");
          if (!bytes) {
            sendJson(res, 400, { error: `Missing image bytes for carousel card ${index + 1}.` });
            return;
          }
          if (bytes.length > 4_000_000) {
            sendJson(res, 400, { error: `Carousel file '${item.name || `card-${index + 1}`}' is too large for serverless upload. Try a smaller image.` });
            return;
          }
          hashes.push(await uploadAdImage(
            config.metaAdAccountId,
            config.metaAccessToken,
            item.name || `${body.source_ad_name || "westpack-carousel"}-square-${index + 1}`,
            bytes
          ));
        }

        const objectStorySpec = {
          page_id: identity.pageId
        };
        if (identity.instagramActorId) {
          objectStorySpec.instagram_actor_id = identity.instagramActorId;
        }

        const translatedCards = Array.from({ length: cardCount }, (_, index) => translatedAttachments[index] || {});

        const creativeName = buildMetaEntityName(
          body.source_ad_name || "New carousel ad",
          body.target_language || "EN",
          body.target_adset_name || targetAdSet.name
        );

        const linkData = {
          link: destinationUrl,
          message,
          name: headline,
          description,
          child_attachments: hashes.slice(0, 10).map((hash, index) => {
            const card = translatedCards[index] || {};
            return {
              link: destinationUrl,
              image_hash: hash,
              name: card.name || headline,
              description: card.description || description
            };
          }),
          call_to_action: {
            type: "LEARN_MORE",
            value: { link: destinationUrl }
          }
        };

        objectStorySpec.link_data = linkData;

        const creativeId = await createAdCreativeFromSpec(
          config.metaAdAccountId,
          config.metaAccessToken,
          creativeName,
          objectStorySpec
        );

        const adId = await createAdWithRetry(
          config.metaAdAccountId,
          config.metaAccessToken,
          creativeName,
          targetAdSet.id,
          creativeId,
          { attempts: 4, delayMs: 5000 }
        );

        sendJson(res, 200, {
          ok: true,
          adId,
          creativeId,
          adSetId: targetAdSet.id,
          status: "PAUSED",
          draftOnly: true,
          language: body.target_language || "",
          cardCount
        });
        return;
      }

      if (!imageFiles.length) {
        sendJson(res, 400, { error: "Create Ad needs at least one image upload, or switch to Video and upload both video formats." });
        return;
      }

      // Upload images and get hashes
      const hashes = [];
      for (const file of imageFiles.slice(0, 10)) {
        const bytes = String(file.data_base64 || "");
        if (!bytes) {
          sendJson(res, 400, { error: `Missing image bytes for ${file.name || "uploaded file"}.` });
          return;
        }
        // Safety: avoid huge payloads in serverless.
        if (bytes.length > 4_000_000) {
          sendJson(res, 400, { error: `File '${file.name || "image"}' is too large for serverless upload. Try a smaller image.` });
          return;
        }

        const hash = await uploadAdImage(config.metaAdAccountId, config.metaAccessToken, file.name || "westpack-upload", bytes);
        hashes.push(hash);
      }

      const linkData = {
        link: destinationUrl,
        message,
        name: headline,
        description,
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: destinationUrl }
        }
      };

      if (adFormat === "Carousel" || hashes.length > 1) {
        linkData.child_attachments = hashes.slice(0, 10).map((hash, index) => {
          const card = translatedAttachments[index] || {};
          return {
            link: destinationUrl,
            image_hash: hash,
            name: card.name || headline,
            description: card.description || description
          };
        });
      } else {
        linkData.image_hash = hashes[0];
      }

      const objectStorySpec = {
        page_id: identity.pageId,
        link_data: linkData
      };
      if (identity.instagramActorId) {
        objectStorySpec.instagram_actor_id = identity.instagramActorId;
      }

        const creativeName = buildMetaEntityName(
          body.source_ad_name || "New ad",
          body.target_language || "EN",
          body.target_adset_name || targetAdSet.name
        );
      const creativeId = await createAdCreativeFromSpec(
        config.metaAdAccountId,
        config.metaAccessToken,
        creativeName,
        objectStorySpec
      );

      const adId = await createAd(
        config.metaAdAccountId,
        config.metaAccessToken,
        creativeName,
        targetAdSet.id,
        creativeId
      );

      sendJson(res, 200, {
        ok: true,
        adId,
        creativeId,
        adSetId: targetAdSet.id,
        status: "PAUSED"
      });
      return;
    }

    if (!body.source_ad_id) {
      sendJson(res, 400, { error: "Missing source ad id for duplicate publish." });
      return;
    }

    const duplicateUploadedVideoVariants = Array.isArray(body.uploaded_video_variants) ? body.uploaded_video_variants : [];
    const duplicateVideoVariants = Array.isArray(body.video_variants) ? body.video_variants : [];
    const duplicateUploadedCarouselVariants = Array.isArray(body.uploaded_carousel_variants) ? body.uploaded_carousel_variants : [];
    const creativeOverrideMode = String(body.creative_override_mode || "").trim().toLowerCase();

    if (body.ad_format === "Video" && creativeOverrideMode === "video") {
      try {
        const creativeName = buildMetaEntityName(body.source_ad_name, body.target_language, body.target_adset_name);
        // Carry over the source ad's own placement footprint and creative settings (which
        // placements it actually ran on, whether Advantage+ "flexible media" was on) instead
        // of always publishing the same generic hardcoded default for every video override.
        const sourceAdForVideoOverride = await getAdDetails(body.source_ad_id, config.metaAccessToken);
        const sourceCreativeIdForVideoOverride = String(sourceAdForVideoOverride?.creative?.id || "").trim();
        const sourceCreativeForVideoOverride = sourceCreativeIdForVideoOverride
          ? await getCreativeDetails(sourceCreativeIdForVideoOverride, config.metaAccessToken)
          : null;
        const result = await publishVideoAdFromVariants({
          config,
          targetAdSet,
          body,
          creativeName,
          destinationUrl: body.destination_url || "https://www.westpack.com/",
          message: body.creative_strategy?.primary_text || "",
          headline: body.creative_strategy?.headline || body.source_ad_name || "Westpack",
          description: body.creative_strategy?.description || "",
          uploadedVideoVariants: duplicateUploadedVideoVariants,
          videoVariants: duplicateVideoVariants,
          sourceAssetFeedSpec: sourceCreativeForVideoOverride?.asset_feed_spec || null
        });
        sendJson(res, 200, result);
        return;
      } catch (error) {
        sendJson(res, 500, {
          error: `Meta duplicate video override failed for '${body.target_campaign_name}' / '${body.target_adset_name}': ${error.message || "Unknown video error."}`
        });
        return;
      }
    }

    if (body.ad_format === "Carousel" && creativeOverrideMode === "carousel") {
      const squareVariant = duplicateUploadedCarouselVariants.find((variant) => variant?.key === "square") || duplicateUploadedCarouselVariants[0] || null;
      const squareItems = Array.isArray(squareVariant?.items) ? squareVariant.items : [];

      if (squareItems.length < 2) {
        sendJson(res, 400, { error: "Localized carousel override requires at least 2 uploaded square cards." });
        return;
      }

      const identity = await getIdentityFromAnyAd(config.metaAdAccountId, config.metaAccessToken);
      const hashes = [];
      for (let index = 0; index < squareItems.length; index += 1) {
        const item = squareItems[index] || {};
        const preuploadedHash = String(item.meta_image_hash || "").trim();
        if (preuploadedHash) {
          hashes.push(preuploadedHash);
          continue;
        }
        sendJson(res, 400, { error: `Missing uploaded carousel hash for card ${index + 1}.` });
        return;
      }

      const translatedAttachments =
        Array.isArray(body.translated_attachments) && body.translated_attachments.length
          ? body.translated_attachments
          : [];
      const destinationUrl = body.destination_url || "https://www.westpack.com/";
      const message = body.creative_strategy?.primary_text || "";
      const headline = body.creative_strategy?.headline || body.source_ad_name || "Westpack";
      const description = body.creative_strategy?.description || "";
      const creativeName = buildMetaEntityName(body.source_ad_name, body.target_language, body.target_adset_name || targetAdSet.name);
      const objectStorySpec = {
        page_id: identity.pageId,
        link_data: {
          link: destinationUrl,
          message,
          name: headline,
          description,
          child_attachments: hashes.slice(0, 10).map((hash, index) => {
            const card = translatedAttachments[index] || {};
            return {
              link: destinationUrl,
              image_hash: hash,
              name: card.name || headline,
              description: card.description || description
            };
          }),
          multi_share_optimized: false,
          call_to_action: {
            type: "LEARN_MORE",
            value: { link: destinationUrl }
          }
        }
      };

      if (identity.instagramActorId) {
        objectStorySpec.instagram_actor_id = identity.instagramActorId;
      }

      try {
        const creativeId = await createAdCreativeFromSpec(
          config.metaAdAccountId,
          config.metaAccessToken,
          creativeName,
          objectStorySpec
        );
        const adId = await createAdWithRetry(
          config.metaAdAccountId,
          config.metaAccessToken,
          creativeName,
          targetAdSet.id,
          creativeId,
          { attempts: 4, delayMs: 5000 }
        );
        sendJson(res, 200, { ok: true, adId, creativeId, adSetId: targetAdSet.id, status: "PAUSED" });
        return;
      } catch (error) {
        sendJson(res, 500, {
          error: `Meta duplicate carousel override failed for '${body.target_campaign_name}' / '${body.target_adset_name}': ${error.message || "Unknown carousel error."}`
        });
        return;
      }
    }

    const sourceAd = await getAdDetails(body.source_ad_id, config.metaAccessToken);
    const sourceCreativeId = sourceAd?.creative?.id;

    if (!sourceCreativeId) {
      sendJson(res, 400, { error: "Source ad has no creative id." });
      return;
    }

    const sourceCreative = await getCreativeDetails(sourceCreativeId, config.metaAccessToken);
    const translatedAttachments =
      Array.isArray(body.translated_attachments) && body.translated_attachments.length
        ? body.translated_attachments
        : await translateCarouselAttachments(config, body, sourceCreative);

    const preview = {
      source: body.source_ad_name,
      targetCampaign: body.target_campaign_name,
      targetAdSet: body.target_adset_name,
      targetLanguage: body.target_language,
      destinationUrl: body.destination_url,
      adFormat: body.ad_format,
      primaryText: body.creative_strategy?.primary_text || "",
      headline: body.creative_strategy?.headline || "",
      description: body.creative_strategy?.description || ""
    };

    let newCreativeId = "";
    try {
      newCreativeId = await createAdCreative(
        config.metaAdAccountId,
        config.metaAccessToken,
        sourceCreative,
        preview,
        { translatedAttachments }
      );
    } catch (error) {
      sendJson(res, 500, {
        error: `Meta creative creation failed for '${body.target_campaign_name}' / '${body.target_adset_name}': ${error.message || "Unknown creative error."}`
      });
      return;
    }

    let newAdId = "";
    try {
      newAdId = await createAdWithRetry(
        config.metaAdAccountId,
        config.metaAccessToken,
        buildMetaEntityName(body.source_ad_name, body.target_language, body.target_adset_name),
        targetAdSet.id,
        newCreativeId,
        { attempts: 4, delayMs: 5000 }
      );
    } catch (error) {
      sendJson(res, 500, {
        error: `Meta ad creation failed for '${body.target_campaign_name}' / '${body.target_adset_name}': ${error.message || "Unknown ad error."}`
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      adId: newAdId,
      creativeId: newCreativeId,
      adSetId: targetAdSet.id,
      status: "PAUSED"
    });
  } catch (error) {
    sendJson(res, Number(error?.statusCode) || 500, {
      error: error.message || "Meta publish failed."
    });
  }
};
