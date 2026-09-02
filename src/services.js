import {
  buildCreativePayloadContext
} from "./meta-creative-payload.js";
import {
  getAdSetOptions
} from "./meta-target-options.js?v=20260723-duplicate-target-hotfix1";

export { getAdSetOptions };

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function clampText(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength + 1);
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf(", "),
    clipped.lastIndexOf(" ")
  );
  const safeCut = boundary >= Math.floor(maxLength * 0.6) ? boundary : maxLength;
  return clipped.slice(0, safeCut).trim().replace(/[,.!?;:]+$/g, "");
}

async function authenticatedFetch(input, init = {}) {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("westpack-auth-required"));
  }

  return response;
}

function stripHtmlTags(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readApiPayload(response) {
  const rawText = await response.text().catch(() => "");
  if (!rawText) {
    return { payload: {}, rawText: "" };
  }

  try {
    return {
      payload: JSON.parse(rawText),
      rawText
    };
  } catch (error) {
    return {
      payload: {},
      rawText
    };
  }
}

function buildApiError(response, payload, fallbackMessage, rawText = "") {
  if (response.status === 401) {
    return new Error("Your login session expired. Log in again and retry the Klaviyo push.");
  }

  const directMessage = String(
    payload?.error ||
    payload?.message ||
    payload?.details ||
    ""
  ).trim();

  if (directMessage) {
    return new Error(directMessage);
  }

  const textMessage = stripHtmlTags(rawText);
  if (textMessage) {
    const clipped = textMessage.length > 240 ? `${textMessage.slice(0, 240).trim()}...` : textMessage;
    return new Error(`${fallbackMessage} (${response.status}). ${clipped}`);
  }

  return new Error(`${fallbackMessage} (${response.status}).`);
}

function getSelectLabel(id) {
  const element = document.getElementById(id);
  return element?.selectedOptions?.[0]?.textContent?.trim() || element?.value || "";
}

export function buildPreviewPayload({ ads, integrationConfig, mode }) {
  const payloadContext = buildCreativePayloadContext({
    ads,
    getSelectLabel,
    getValue,
    mode
  });
  const {
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
    creativeAssets
  } = payloadContext;

  if (mode === "create") {
    return {
      source: newAdName || "New ad concept",
      sourceId: "",
      targetCampaign,
      targetCampaignId,
      targetAdSet,
      targetAdSetId,
      targetLanguage,
      adFormat,
      campaignIntent,
      destinationUrl,
      creativeAssets,
      imageVariants,
      carouselVariants,
      videoVariants,
      videoAnalysis,
      primaryText: `New Westpack ${adFormat.toLowerCase()} ad draft for ${targetLanguage}. Intent: ${campaignIntent || "Promote one product family clearly"}. Angle: ${newAdAngle || "Premium B2B packaging"}. ${note || "Fresh concept pending operator direction."}`,
      headline: `${newAdName || "New Westpack Ad"} (${targetLanguage})`,
      description: `Built as a fresh ${adFormat.toLowerCase()} ad concept for ${targetCampaign} / ${targetAdSet}.${campaignIntent ? ` Intent: ${campaignIntent}.` : ""}${note ? ` Operator note: ${note}` : ""}`,
      rationale: `This preview simulates creating a brand-new ad from scratch. In the live app, ${integrationConfig.openAi.model} will generate original Westpack copy based on your selected intent, chosen angle, format, and notes, while uploaded creative files are used exactly as provided without visual editing.`
    };
  }

  return {
    source: sourceAd.name,
    sourceId: sourceAd.id,
    targetCampaign,
    targetCampaignId,
    targetAdSet,
    targetAdSetId,
    targetLanguage,
    adFormat,
    destinationUrl,
    creativeAssets,
    primaryText: `${sourceAd.primary} (${targetLanguage} ${adFormat.toLowerCase()} preview)`,
    headline: `${sourceAd.headline} (${targetLanguage})`,
    description: `${sourceAd.description}${note ? ` Operator note: ${note}` : ""} Placement: ${targetCampaign} / ${targetAdSet}.`,
    rationale: `This preview simulates ${adaptationGoal.toLowerCase()} while preserving Westpack's premium B2B framing. Format selected: ${adFormat}. In the live app, ${integrationConfig.openAi.model} will replace this placeholder with localized copy before the Meta publish step, but uploaded creative files stay untouched.`
  };
}

export function buildGenerationRequest({ ads, mode, overrides = {} }) {
  const payloadContext = buildCreativePayloadContext({
    ads,
    getSelectLabel,
    getValue,
    mode
  });
  const {
    ids,
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
  } = payloadContext;

  return {
    mode,
    sourceAd: mode === "duplicate" ? sourceAd : null,
    targetCampaign: overrides.targetCampaign ?? targetCampaign,
    targetCampaignId: overrides.targetCampaignId ?? targetCampaignId,
    targetAdSet: overrides.targetAdSet ?? targetAdSet,
    targetAdSetId: overrides.targetAdSetId ?? targetAdSetId,
    targetLanguage: overrides.targetLanguage ?? targetLanguage,
    adaptationGoal,
    adFormat,
    campaignIntent,
    destinationUrl: overrides.destinationUrl ?? destinationUrl,
    imageVariants,
    carouselVariants,
    videoVariants,
    videoAnalysis,
    operatorNote: note,
    newAdName,
    newAdAngle,
    creativeAssets,
    cardImagePreviews,
    ...(overrides.precomputedStrategy ? { precomputedStrategy: overrides.precomputedStrategy } : {}),
    ...(overrides.precomputedSourceCreativeSummary ? { precomputedSourceCreativeSummary: overrides.precomputedSourceCreativeSummary } : {})
  };
}

export function buildVariantSet(preview) {
  const compactBody = clampText(preview.primaryText, 125) || "Premium packaging that helps your brand stand out.";
  const compactHeadline = clampText(preview.headline, 32) || "Premium packaging";

  return [
    {
      title: "Variant 1 - Direct localization",
      body: compactBody,
      headline: compactHeadline,
      angle: `Keeps the original structure and simply localizes the value proposition for a ${preview.adFormat.toLowerCase()} ad.`
    },
    {
      title: "Variant 2 - Shorter and sharper",
      body: clampText(`${compactBody} Built for fast mobile scanning.`, 125) || compactBody,
      headline: clampText(`${compactHeadline} Short`, 32) || compactHeadline,
      angle: `Cuts extra words and leans into a tighter retail-performance style for ${preview.targetAdSet}.`
    },
    {
      title: "Variant 3 - Premium B2B angle",
      body: clampText(`${compactBody} Lead with premium presentation and perceived value.`, 125) || compactBody,
      headline: clampText(`Premium ${compactHeadline}`, 32) || compactHeadline,
      angle: "Pushes the B2B premium positioning harder for specialist buyers."
    },
    {
      title: "Variant 4 - Clearer CTA",
      body: clampText(`${compactBody} Make the next step obvious and easy to act on.`, 125) || compactBody,
      headline: clampText(`${compactHeadline} Act now`, 32) || compactHeadline,
      angle: "Tests a more direct CTA-led framing for faster scan-and-click behavior."
    },
    {
      title: "Variant 5 - Benefit first",
      body: clampText(`${compactBody} Lead with the clearest commercial benefit first.`, 125) || compactBody,
      headline: clampText(`${compactHeadline} Benefit`, 32) || compactHeadline,
      angle: "Tests a more benefit-first hook before product detail."
    }
  ];
}

export function buildMetaPublishPayload(preview) {
  return {
    action: preview.sourceId ? "create_cloned_ad" : "create_new_ad",
    source_ad_name: preview.source,
    source_ad_id: preview.sourceId || "",
    target_campaign_name: preview.targetCampaign,
    target_campaign_id: preview.targetCampaignId || "",
    target_adset_name: preview.targetAdSet,
    target_adset_id: preview.targetAdSetId || "",
    target_language: preview.targetLanguage,
    destination_url: preview.destinationUrl || "",
    ad_format: preview.adFormat,
    creative_handling: "use_uploaded_files_as_is",
    creative_assets: preview.creativeAssets || [],
    image_variants: preview.imageVariants || [],
    carousel_variants: preview.carouselVariants || [],
    video_variants: preview.videoVariants || [],
    creative_strategy: {
      primary_text: preview.primaryText,
      headline: preview.headline,
      description: preview.description
    },
    translated_attachments: preview.translatedAttachments || [],
    approval_required: true,
    publish_status: "draft"
  };
}

export function createDraftEntry(preview) {
  return {
    ...preview,
    rationale: `${preview.rationale} Draft mode saved in the UI concept; database persistence comes in the next build.`
  };
}

export async function requestAiPreview(requestBody) {
  const response = await authenticatedFetch("/api/openai/generate-ad-copy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "AI preview request failed.");
  }

  return payload;
}

export async function requestMetaPublish(requestBody) {
  const isMetaRateLimitMessage = (message = "") => {
    const text = String(message || "").toLowerCase();
    return text.includes("request limit reached")
      || text.includes("too many calls")
      || text.includes("rate limit")
      || text.includes("application request limit reached")
      || text.includes("user request limit reached")
      || /\bcode (4|17|32|613)\b/.test(text);
  };
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await authenticatedFetch("/api/meta/publish-ad", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const rawText = await response.text().catch(() => "");
    let payload = {};
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {};
    }

    if (response.ok) {
      return payload;
    }

    const fallbackText = rawText
      ? rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)
      : "";
    const statusLabel = response.status ? `Meta publish failed (${response.status})` : "Meta publish failed";
    const message = payload?.error || fallbackText || statusLabel;

    if (attempt < maxAttempts - 1 && isMetaRateLimitMessage(message)) {
      const jitterMs = Math.round(Math.random() * 2000);
      await wait((10000 * (2 ** attempt)) + jitterMs);
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Meta publish failed.");
}

export async function requestVideoAnalysis(requestBody) {
  const response = await authenticatedFetch("/api/openai/generate-ad-copy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "analyze_video",
      ...requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Video analysis failed.");
  }

  return payload;
}

export async function requestMetaSnapshot(options = {}) {
  const params = new URLSearchParams();
  if (options.preset) params.set("preset", options.preset);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.force) params.set("force", "1");
  const query = params.toString();
  const response = await authenticatedFetch(`/api/meta/account-snapshot${query ? `?${query}` : ""}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Meta refresh failed.");
  }

  return payload;
}

export async function requestMetaStudioCatalog(options = {}) {
  const params = new URLSearchParams();
  params.set("catalog", "1");
  if (options.force) {
    params.set("force", "1");
  }
  const response = await authenticatedFetch(`/api/meta/account-snapshot?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Meta studio catalog refresh failed.");
  }

  return payload;
}

export async function requestMetaConnectionStatus() {
  const response = await authenticatedFetch("/api/meta/account-snapshot?health=1");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Meta connection check failed.");
  }

  return payload;
}

export async function requestDashboardAgent(requestBody) {
  const response = await authenticatedFetch("/api/openai/dashboard-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Dashboard agent request failed.");
  }

  return payload;
}

export async function requestKlaviyoCampaignOverview(options = {}) {
  const params = new URLSearchParams();
  if (options.days) params.set("days", String(options.days));
  if (options.forceLive) params.set("forceLive", "1");

  const response = await authenticatedFetch(`/api/klaviyo/campaign-overview${params.toString() ? `?${params.toString()}` : ""}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Klaviyo overview request failed.");
  }

  return payload;
}

export async function requestKlaviyoTemplates(options = {}) {
  const params = new URLSearchParams();
  if (options.country) params.set("country", String(options.country));
  if (options.templateId) params.set("templateId", String(options.templateId));

  const response = await authenticatedFetch(`/api/klaviyo/templates${params.toString() ? `?${params.toString()}` : ""}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Klaviyo templates request failed.");
  }

  return payload;
}

export async function requestKlaviyoAgent(requestBody) {
  const response = await authenticatedFetch("/api/openai/klaviyo-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Klaviyo agent request failed.");
  }

  return payload;
}

export async function requestCampaignBrain(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Campaign brain request failed.");
  }

  return payload;
}

export async function requestCampaignAsanaTasks(kind = "campaign") {
  const params = new URLSearchParams({
    action: "asana_tasks",
    kind: kind === "content" ? "content" : "campaign"
  });
  const response = await authenticatedFetch(`/api/campaign/brain?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Could not load Asana tasks.");
  }
  return payload;
}

export async function requestCampaignAsanaTask(taskGid) {
  const params = new URLSearchParams({
    action: "asana_task",
    taskGid: String(taskGid || "")
  });
  const response = await authenticatedFetch(`/api/campaign/brain?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Could not load the Asana task.");
  }
  return payload;
}

export async function requestContentAgentStatus() {
  const response = await authenticatedFetch("/api/campaign/brain?action=agent_status");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Could not load Content Agent status.");
  return payload;
}

export async function requestContentAgentStart({ campaignTaskGid, contentTaskGid = "", direction = "", startMode = "queue" } = {}) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "agent_start",
      campaignTaskGid,
      contentTaskGid,
      direction,
      startMode,
      processNow: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Content Agent could not start the task.");
  return payload;
}

export async function requestContentAgentControl(jobId, command) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "agent_control", jobId: String(jobId || ""), command: String(command || "") })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Content Agent control could not be applied.");
  return payload;
}

export async function requestContentAgentRetry(jobId) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "agent_retry", jobId: String(jobId || "") })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Content Agent recovery could not start.");
  return payload;
}

export async function requestContentAgentRejectRestart(jobId, reason = "") {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "agent_reject_restart", jobId: String(jobId || ""), reason: String(reason || "") })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "The campaign could not be rejected and restarted.");
  return payload;
}

export async function requestCampaignLearningFeedback(payload = {}) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "campaign_learning_feedback", ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "Campaign learning feedback could not be recorded.");
  return result;
}

export async function requestCampaignLearningModeration(eventId, operation, operatorNote = "") {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "campaign_learning_moderate", eventId, operation, operatorNote })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "Campaign learning could not be updated.");
  return result;
}

export async function requestCampaignArtifacts(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "generate_artifacts",
      ...requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Campaign artifact generation failed.");
  }

  return payload;
}

export async function requestCampaignEmailCompile({ input, email, resolvedEmailImageUrls = [] }) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "compile_email", input, email, resolvedEmailImageUrls })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Could not compile the campaign email.");
  return payload;
}

export async function requestCampaignEmailModuleRevision(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "revise_email_module", ...requestBody })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Could not revise the selected email module.");
  return payload;
}

export async function requestCampaignCarouselSuggestions(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "suggest_carousel_cards",
      ...requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Campaign carousel suggestions failed.");
  }

  return payload;
}

export async function requestMetaHistoricalIntelligence({ sync = false, days = 365 } = {}) {
  const query = new URLSearchParams({ historical: sync ? "sync" : "status" });
  if (sync) query.set("days", String(days));
  const response = await authenticatedFetch(`/api/meta/account-snapshot?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Meta Historical Intelligence failed.");
  return payload;
}

export async function requestMetaFromMaster(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "generate_meta_from_master",
      ...requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Meta from Master generation failed.");
  }

  return payload;
}

export async function requestMetaCreativeReview(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "review_meta_carousel", ...requestBody })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Meta Creative Director review failed.");
  return payload;
}

export async function requestCampaignEnvironmentSeries(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "generate_environment_series",
      ...requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Campaign environment generation failed.");
  }

  return payload;
}

export async function requestCampaignEmailVisuals(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate_email_visuals", ...requestBody })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Email visual generation failed.");
  return payload;
}

export async function requestCampaignEmailAssetHosting(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "host_email_asset", ...requestBody })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Campaign image could not be hosted in Klaviyo.");
  return payload;
}

export async function requestCampaignAssembly(requestBody) {
  const response = await authenticatedFetch("/api/campaign/brain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "assemble_campaign",
      ...requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Campaign assembly failed.");
  }

  return payload;
}

export async function requestKlaviyoTemplateTranslation(requestBody) {
  const response = await authenticatedFetch("/api/openai/klaviyo-translate-template", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Klaviyo template translation failed.");
  }

  return payload;
}

export async function requestKlaviyoCampaignVariant(requestBody) {
  const response = await authenticatedFetch("/api/openai/klaviyo-campaign-variant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Klaviyo campaign variant generation failed.");
  }

  return payload;
}

export async function requestKlaviyoTemplateVariant(requestBody) {
  const response = await authenticatedFetch("/api/openai/klaviyo-translate-template", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...requestBody,
      mode: "variant"
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Klaviyo template variant generation failed.");
  }

  return payload;
}

export async function requestKlaviyoPushTemplateRollout(requestBody) {
  const response = await authenticatedFetch("/api/klaviyo/push-template-rollout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const { payload, rawText } = await readApiPayload(response);
  if (!response.ok) {
    throw buildApiError(response, payload, "Klaviyo template rollout push failed", rawText);
  }

  return payload;
}

export async function requestKlaviyoCreateTemplateVariant(requestBody) {
  const response = await authenticatedFetch("/api/klaviyo/push-template-rollout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...requestBody,
      mode: "single_template_variant"
    })
  });

  const { payload, rawText } = await readApiPayload(response);
  if (!response.ok) {
    throw buildApiError(response, payload, "Klaviyo template creation failed", rawText);
  }

  return payload;
}

export async function requestAuthSession() {
  const response = await authenticatedFetch("/api/auth/session");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Auth session check failed.");
  }

  return payload;
}

export async function requestAuthLogin(password) {
  const response = await authenticatedFetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Login failed.");
  }

  return payload;
}

export async function requestAuthLogout() {
  const response = await authenticatedFetch("/api/auth/logout", {
    method: "POST"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Logout failed.");
  }

  return payload;
}

export function getIntegrationCards(config) {
  return [
    {
      title: "OpenAI",
      body: `${config.openAi.status}. Model: ${config.openAi.model}.`
    },
    {
      title: "Meta",
      body: `${config.metaApi.status}. Scope: ${config.metaApi.mode}.`
    },
    {
      title: "Safeguard",
      body: `${config.safeguard.status}. ${config.safeguard.purpose}.`
    }
  ];
}

export function getMetaSettingsSummary(config) {
  return {
    status: `Status: ${config.metaApi.status}. Scope: ${config.metaApi.mode}.`,
    writeActions: config.metaApi.writeActions
  };
}

export function getPromptCards(promptRecipe) {
  return promptRecipe.map((item) => ({
    title: item.title,
    body: item.body
  }));
}
