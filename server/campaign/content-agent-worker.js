const fs = require("node:fs/promises");
const path = require("node:path");
const { getAsanaProjectTasks, getAsanaTaskBundle } = require("../lib/asana");
const { assembleCampaignObject } = require("./object");
const {
  buildCampaignArtifactsPrompt,
  buildCampaignArtifactSchema,
  buildCampaignBrainPrompt,
  buildCampaignBrainSchema,
  extractJsonText,
  normalizeCampaignArtifactResult,
  normalizeCampaignBrainInput,
  normalizeCampaignBrainResult,
  selectReachableCampaignEmailImages
} = require("./brain");
const {
  CONTENT_AGENT_PIPELINE_VERSION,
  CONTENT_AGENT_SOURCE_SECTION,
  CONTENT_AGENT_WORKFLOW_FILTER_VERSION,
  CONTENT_AGENT_POLICY,
  MINIMUM_CONTENT_MATCH_SCORE,
  applyAgentControlCommands,
  applyHourlyScan,
  buildContentAgentHealth,
  enqueueManualJob,
  findBestContentMatch,
  isCampaignSectionTask,
  getNextQueuedJob,
  recoverInterruptedJobs,
  rejectAndRestartAgentJob,
  restartQualityExhaustedAgentJob,
  requeueFailedAgentJob,
  transitionAgentJob
} = require("./content-agent");
const {
  acquireAgentLock,
  drainAgentControlCommands,
  getAgentStoreProfile,
  readAgentState,
  releaseAgentLock,
  queueAgentControlCommand,
  writeAgentState
} = require("./agent-store");
const { readHistoricalIntelligence } = require("../meta/historical-store");
const { buildMetaIntelligencePromptBlock } = require("../meta/historical-intelligence");
const {
  QUALITY_MAX_REVISIONS,
  buildContentCraftEvidence,
  buildRenderedArtifactEvidence,
  buildQualityReviewPrompt,
  buildQualityReviewSchema,
  decideQualityNextStep,
  evaluateQualityGate,
  normalizeQualityReview
} = require("./quality-agent");
const {
  buildChannelArtifactSchema,
  buildChannelProductionPrompt,
  buildChannelRevisionPrompt,
  buildConceptSelectionPrompt,
  buildConceptSelectionSchema,
  buildCreativeDirectionSchema,
  buildCreativeDirectionsPrompt,
  evaluateCreativeDirectionDiversity,
  evaluateConceptSelectionQuality,
  normalizeConceptSelection,
  normalizeCreativeDirections,
  selectRevisionChannel
} = require("./creative-production");
const { isStaticImageUrl } = require("./email-design");
const { WESTPACK_UNIVERSAL_CONTENT, getUniversalContentStatus } = require("./email-universal-content");
const { EMAIL_MODULES, EMAIL_MODULE_SYSTEM_VERSION, WESTPACK_EMAIL_MASTER } = require("./email-module-library");
const { getCampaignLearningStatus, recordArtifactLearning } = require("./campaign-learning-service");
const { readCampaignLearningEvents } = require("./campaign-learning-store");
const { buildCampaignLearningPromptBlock } = require("./campaign-learning");

function serializeAsanaBundle(bundle = {}) {
  const task = bundle?.task || {};
  return {
    gid: task.gid || "",
    name: task.name || "",
    notes: task.notes || "",
    html_notes: task.htmlNotes || "",
    due_on: task.dueOn || "",
    permalink_url: task.permalinkUrl || "",
    customFields: Array.isArray(task.customFields) ? task.customFields : [],
    subtasks: Array.isArray(bundle?.subtasks) ? bundle.subtasks.map((subtask) => ({
      gid: subtask.gid || "",
      name: subtask.name || "",
      notes: subtask.notes || "",
      completed: Boolean(subtask.completed)
    })) : [],
    attachments: Array.isArray(bundle?.attachments) ? bundle.attachments.map((attachment) => ({
      gid: attachment.gid || "",
      name: [attachment.parentTaskName, attachment.name].filter(Boolean).join(" / "),
      type: attachment.resourceSubtype || "asset",
      url: attachment.downloadUrl || attachment.permanentUrl || attachment.viewUrl || "",
      parentTaskGid: attachment.parentTaskGid || "",
      parentTaskName: attachment.parentTaskName || ""
    })) : []
  };
}

async function readAgentJobSource(config, job) {
  const campaignBundle = await getAsanaTaskBundle(config, job.campaignTaskGid);
  const contentBundle = String(job.contentTaskGid || "") === String(job.campaignTaskGid || "")
    ? campaignBundle
    : await getAsanaTaskBundle(config, job.contentTaskGid);
  const assembled = assembleCampaignObject({
    inputMode: "content_agent",
    title: campaignBundle?.task?.name || job.campaignTaskName,
    campaignTask: serializeAsanaBundle(campaignBundle),
    contentTask: serializeAsanaBundle(contentBundle),
    extraPrompt: job.direction || "",
    channels: ["klaviyo", "meta", "blog"]
  });
  return { assembled, input: normalizeCampaignBrainInput(assembled.brainInput) };
}

function assetIdentity(value = "") {
  return String(value || "")
    .replace(/https?:\/\/[^\s|]+/gi, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function firstAssetUrl(value = "") {
  return String(value || "").match(/https?:\/\/[^\s|]+/i)?.[0]?.replace(/[),.;]+$/g, "") || "";
}

function buildRefreshedAssetUrlMap(previousAssets = [], refreshedAssets = []) {
  const refreshedByIdentity = new Map();
  for (const asset of Array.isArray(refreshedAssets) ? refreshedAssets : []) {
    const identity = assetIdentity(asset);
    const url = firstAssetUrl(asset);
    if (!identity || !url) continue;
    const urls = refreshedByIdentity.get(identity) || [];
    urls.push(url);
    refreshedByIdentity.set(identity, urls);
  }
  const replacements = new Map();
  for (const asset of Array.isArray(previousAssets) ? previousAssets : []) {
    const identity = assetIdentity(asset);
    const previousUrl = firstAssetUrl(asset);
    const refreshedUrl = refreshedByIdentity.get(identity)?.shift() || "";
    if (previousUrl && refreshedUrl && previousUrl !== refreshedUrl) replacements.set(previousUrl, refreshedUrl);
  }
  return replacements;
}

function remapAssetUrls(value, replacements) {
  if (!(replacements instanceof Map) || !replacements.size) return value;
  if (typeof value === "string") {
    let result = value;
    for (const [previousUrl, refreshedUrl] of replacements) {
      result = result.split(previousUrl).join(refreshedUrl);
      result = result
        .split(previousUrl.replace(/&/g, "&amp;"))
        .join(refreshedUrl.replace(/&/g, "&amp;"));
    }
    return result;
  }
  if (Array.isArray(value)) return value.map((item) => remapAssetUrls(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapAssetUrls(item, replacements)]));
  }
  return value;
}

function collectAssignedArtifactUrls(...values) {
  const urls = [];
  for (const value of values) {
    const email = value?.artifacts?.email || value?.email || {};
    const meta = value?.artifacts?.meta || value?.meta || {};
    urls.push(email.heroImageUrl);
    urls.push(...(email.sections || []).map((section) => section?.imageUrl));
    urls.push(...(meta.carouselConcepts || []).flatMap((concept) => (concept.cards || []).map((card) => card?.assetUrl)));
  }
  return [...new Set(urls.filter((url) => /^https?:\/\//i.test(String(url || ""))))];
}

function appendVisualInputs(prompt = [], imageUrls = [], label = "Approved campaign imagery", detail = "high") {
  const seen = new Set();
  const entries = (Array.isArray(imageUrls) ? imageUrls : []).map((entry) => (
    typeof entry === "string"
      ? { imageUrl: entry, referenceLabel: "" }
      : { imageUrl: entry?.imageUrl || "", referenceLabel: String(entry?.referenceLabel || "") }
  )).filter((entry) => {
    if (!/^(?:https?:\/\/|data:image\/)/i.test(entry.imageUrl) || seen.has(entry.imageUrl)) return false;
    seen.add(entry.imageUrl);
    return true;
  }).slice(0, 8);
  if (!entries.length) return prompt;
  const messages = prompt.map((message) => ({
    ...message,
    content: Array.isArray(message.content) ? [...message.content] : message.content
  }));
  const userIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (userIndex < 0 || !Array.isArray(messages[userIndex].content)) return messages;
  messages[userIndex].content.push({
    type: "input_text",
    text: `${label}. Inspect these images directly. Use only visible evidence, preserve product identity, and never treat a video URL as an email image.`
  });
  for (const entry of entries) {
    if (entry.referenceLabel) {
      messages[userIndex].content.push({
        type: "input_text",
        text: `Visual reference: ${entry.referenceLabel}`
      });
    }
    messages[userIndex].content.push({
      type: "input_image",
      image_url: entry.imageUrl,
      detail
    });
  }
  return messages;
}

async function loadReferenceImageInputs(references = []) {
  const owned = references.filter((reference) => reference?.sourceType === "owned_campaign" && reference?.imagePath).slice(0, 4);
  const external = references.filter((reference) => reference?.sourceType === "external_inspiration" && reference?.imagePath).slice(0, 1);
  const root = path.resolve(process.cwd(), "campaign-import");
  const inputs = [];
  for (const reference of [...owned, ...external]) {
    const absolutePath = path.resolve(process.cwd(), String(reference.imagePath || ""));
    if (!absolutePath.startsWith(`${root}${path.sep}`)) continue;
    try {
      const extension = path.extname(absolutePath).toLowerCase();
      const mediaType = extension === ".png" ? "image/png" : [".jpg", ".jpeg"].includes(extension) ? "image/jpeg" : extension === ".webp" ? "image/webp" : "";
      if (!mediaType) continue;
      const stats = await fs.stat(absolutePath);
      if (stats.size > 4_000_000) continue;
      const buffer = await fs.readFile(absolutePath);
      inputs.push({
        imageUrl: `data:${mediaType};base64,${buffer.toString("base64")}`,
        referenceLabel: [reference.title, reference.designRole].filter(Boolean).join(" — ")
      });
    } catch (error) {
      // A missing reference image removes only that visual example, never the production job.
    }
  }
  return inputs;
}

async function requestStructuredOutput(config, { prompt, schemaName, schema, model = config.openAiModel, reasoningEffort = "", requestTimeoutMs = 210_000, retryOnTimeout = true, retryOnModelAvailability = true }) {
  const controller = new AbortController();
  let timer;
  let response;
  let payload;
  try {
    const result = await Promise.race([
      (async () => {
        const requestResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.openAiApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            input: prompt,
            text: { format: { type: "json_schema", name: schemaName, schema } },
            ...(reasoningEffort && /^gpt-5/i.test(model) ? { reasoning: { effort: reasoningEffort } } : {})
          }),
          signal: controller.signal
        });
        const responseText = await requestResponse.text();
        let requestPayload = {};
        try {
          requestPayload = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
          requestPayload = {};
        }
        return { response: requestResponse, payload: requestPayload };
      })(),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const timeoutError = new Error(`Content Agent AI request exceeded ${Math.round(requestTimeoutMs / 1000)} seconds.`);
          timeoutError.name = "AbortError";
          reject(timeoutError);
        }, requestTimeoutMs);
      })
    ]);
    response = result.response;
    payload = result.payload;
  } catch (error) {
    if (error?.name === "AbortError" && retryOnTimeout) {
      return requestStructuredOutput(config, {
        prompt,
        schemaName,
        schema,
        model,
        reasoningEffort,
        requestTimeoutMs,
        retryOnTimeout: false,
        retryOnModelAvailability
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const modelUnavailable = [400, 403, 404].includes(response.status)
    && /^gpt-5\.6(?:-|$)/i.test(model)
    && /model|access|available|permission|exist/i.test(String(payload?.error?.message || ""));
  if (!response.ok && retryOnModelAvailability && modelUnavailable) {
    return requestStructuredOutput(config, {
      prompt,
      schemaName,
      schema,
      model: "gpt-5.4",
      reasoningEffort,
      requestTimeoutMs,
      retryOnTimeout,
      retryOnModelAvailability: false
    });
  }
  if (!response.ok) throw new Error(payload?.error?.message || "Content Agent AI request failed.");
  return {
    parsed: JSON.parse(extractJsonText(payload)),
    model: payload.model || config.openAiModel
  };
}

async function generateArtifactPack(config, { input, plan, prompt, schemaName, memoryReferences, resolvedEmailImageUrls, referenceImageInputs = [] }) {
  const response = await requestStructuredOutput(config, {
    prompt: appendVisualInputs(
      appendVisualInputs(prompt, resolvedEmailImageUrls, "Approved source images available for art direction"),
      referenceImageInputs,
      "Curated visual campaign references; synthesize their design principles without copying",
      "low"
    ),
    schemaName,
    schema: buildCampaignArtifactSchema(),
    model: config.contentAgentModel || config.openAiModel,
    reasoningEffort: "medium",
    retryOnTimeout: false
  });
  return normalizeCampaignArtifactResult(
    input,
    plan,
    response.parsed,
    response.model,
    memoryReferences,
    resolvedEmailImageUrls
  );
}

async function generateChannelDraft(config, { channel, prompt, schemaName, resolvedEmailImageUrls, referenceImageInputs = [], reasoningEffort = "high" }) {
  const response = await requestStructuredOutput(config, {
    prompt: appendVisualInputs(
      appendVisualInputs(prompt, resolvedEmailImageUrls, "Approved source images available to the channel specialist"),
      referenceImageInputs,
      "Curated owned campaign references",
      "low"
    ),
    schemaName,
    schema: buildChannelArtifactSchema(channel),
    model: config.contentAgentModel || config.openAiModel,
    reasoningEffort,
    retryOnTimeout: false
  });
  return { channel: response.parsed?.[channel] || null, productionNotes: response.parsed?.productionNotes || [], model: response.model };
}

function assembleSpecialistArtifactPack({ input, plan, channelDrafts, productionNotes, memoryReferences, resolvedEmailImageUrls, model }) {
  return normalizeCampaignArtifactResult(input, plan, {
    email: channelDrafts?.email || null,
    meta: channelDrafts?.meta || null,
    blog: channelDrafts?.blog || null,
    productionNotes: [...new Set(productionNotes || [])]
  }, model, memoryReferences, resolvedEmailImageUrls);
}

function evaluateSourceReadiness(input = {}, resolvedImageUrls = []) {
  const source = input?.source || {};
  const narrative = [
    input.objective,
    input.audience,
    input.offer,
    source.body,
    source.notes
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const titleAndNarrative = [input.title, source.title, narrative].filter(Boolean).join(" ");
  const approvedImages = [...new Set((Array.isArray(resolvedImageUrls) ? resolvedImageUrls : []).filter(Boolean))];
  const missing = [];

  if (narrative.length < 80 && approvedImages.length < 3) {
    missing.push("campaign_facts");
  }
  if (approvedImages.length === 0) {
    missing.push("approved_static_images");
  }

  const deadlineCampaign = /\b(?:deadline|cut[ -]?off|frist|sidste chance|last order date)\b/i.test(titleAndNarrative);
  const explicitDate = /\b(?:\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{1,2}\s+(?:jan(?:uary|uar)?|feb(?:ruary|ruar)?|mar(?:ch|ts)?|apr(?:il)?|may|maj|jun(?:e|i)?|jul(?:y|i)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?|januar|februar|marts|april|juni|juli|august|september|november|december))\b/i.test(narrative);
  if (deadlineCampaign && !explicitDate) {
    missing.push("verified_deadline");
  }

  return {
    passed: missing.length === 0,
    missing,
    narrativeLength: narrative.length,
    approvedStaticImageCount: approvedImages.length,
    deadlineCampaign,
    summary: missing.length
      ? `Source is not production-ready: ${missing.join(", ")}.`
      : "Source has enough factual and static visual material to enter production."
  };
}

function buildQualityAudit(assembled, plan, artifactPack, validatedImageUrls = [], conceptQualityGate = null) {
  const artifacts = artifactPack?.artifacts || {};
  const compiledEmailHtml = String(artifacts?.email?.bodyHtml || "");
  const requestedCtaUrl = String(artifacts?.email?.primaryCtaUrl || "").trim();
  const primaryCtaTag = compiledEmailHtml.match(/<(?:a|span)\b[^>]*data-primary-cta=["']true["'][^>]*>/i)?.[0] || "";
  const compiledPrimaryCtaHref = primaryCtaTag.match(/href=["']([^"']+)["']/i)?.[1] || "";
  const compiledImages = [...compiledEmailHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map((match) => match[1].replace(/&amp;/gi, "&"));
  const validatedImages = new Set(Array.isArray(validatedImageUrls) ? validatedImageUrls : []);
  const compiledCampaignImages = compiledImages.filter((url) => (
    url !== WESTPACK_UNIVERSAL_CONTENT.logoUrl
    && !/cloudfront\.net\/assets\/email/i.test(url)
  ));
  const emailMediaIntegrityPassed = compiledCampaignImages.every((url) => validatedImages.has(url) || isStaticImageUrl(url));
  const customerFacingText = [
    compiledEmailHtml,
    artifacts?.meta?.campaignAngle,
    artifacts?.meta?.primaryText,
    artifacts?.meta?.headline,
    ...(artifacts?.meta?.variants || []).flatMap((variant) => [variant?.title, variant?.body, variant?.headline]),
    artifacts?.blog?.title,
    artifacts?.blog?.excerpt,
    artifacts?.blog?.bodyHtml
  ].filter(Boolean).join(" ");
  const internalCopyPattern = /\[(?:insert|inds[æa]t|todo|tbd)[^\]]*\]|\b(?:todo|tbd)\b|(?:skal|must|needs? to be)\s+(?:valideres|validated|godkendes|approved)\s+(?:før|before)\s+(?:publicering|publishing)|(?:internal|editorial|production)\s+(?:note|instruction)/i;
  const customerCopyClean = !internalCopyPattern.test(customerFacingText);
  const sourceHasVideo = (artifactPack?.input?.assets || []).some((asset) => /\.(?:mp4|mov|m4v|webm)(?:\?|\s|$)|\bvideo\b/i.test(String(asset || "")));
  const staticVisualReady = validatedImages.size > 0 || !sourceHasVideo;
  const sourceSubstance = [artifactPack?.input?.objective, artifactPack?.input?.audience, artifactPack?.input?.offer, artifactPack?.input?.source?.title, artifactPack?.input?.source?.body, artifactPack?.input?.source?.notes].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const briefSubstancePassed = sourceSubstance.length >= 120;
  const ctaIntegrityPassed = requestedCtaUrl
    ? compiledPrimaryCtaHref === requestedCtaUrl
    : Boolean(primaryCtaTag) && !compiledPrimaryCtaHref;
  const universalContent = getUniversalContentStatus(compiledEmailHtml);
  const compiledModuleIds = [...compiledEmailHtml.matchAll(/data-email-module=["']([^"']+)["']/gi)].map((match) => match[1]);
  const approvedModuleIds = new Set(EMAIL_MODULES.map((module) => module.id));
  const moduleSystem = artifacts?.email?.moduleSystem || {};
  const emailModuleContractPassed = compiledModuleIds.length >= 3
    && compiledModuleIds.length <= 4
    && compiledModuleIds.every((moduleId) => approvedModuleIds.has(moduleId))
    && moduleSystem.locked === true
    && moduleSystem.version === EMAIL_MODULE_SYSTEM_VERSION
    && moduleSystem.master?.id === WESTPACK_EMAIL_MASTER.id;
  const carouselConcepts = Array.isArray(artifacts?.meta?.carouselConcepts) ? artifacts.meta.carouselConcepts : [];
  const carouselIntegrityPassed = carouselConcepts.length >= 2
    && carouselConcepts.every((concept) => Array.isArray(concept.cards) && concept.cards.length >= 3 && concept.cards.length <= 6);
  const usedValidatedEmailImages = new Set(compiledCampaignImages.filter((url) => validatedImages.has(url)));
  const requiredEmailImages = Math.min(2, validatedImages.size);
  const emailImageChoreographyPassed = requiredEmailImages === 0 || usedValidatedEmailImages.size >= requiredEmailImages;
  const metaAssetCoveragePassed = carouselConcepts.length >= 2 && carouselConcepts.every((concept) => (concept.cards || []).every((card) => (
    validatedImages.has(card.assetUrl) || isStaticImageUrl(card.assetUrl)
  )));
  const contentCraft = buildContentCraftEvidence(artifactPack);
  const checks = [
    { key: "linked_campaign", passed: Boolean(assembled?.campaignObject?.linkedTasks?.campaignTask?.id) },
    { key: "linked_content", passed: Boolean(assembled?.campaignObject?.linkedTasks?.contentTask?.id) },
    { key: "campaign_plan", passed: Boolean(plan?.campaign && plan?.sourceAudit) },
    { key: "brief_substance", passed: briefSubstancePassed },
    { key: "preproduction_concept_quality", passed: conceptQualityGate?.passed !== false },
    { key: "email", passed: Boolean(artifacts?.email?.bodyHtml) },
    { key: "universal_header_2023", passed: universalContent.header && universalContent.webView },
    { key: "universal_footer_2023", passed: universalContent.footer && universalContent.unsubscribe },
    { key: "email_module_contract", passed: emailModuleContractPassed },
    { key: "email_media_integrity", passed: emailMediaIntegrityPassed },
    { key: "email_image_choreography", passed: emailImageChoreographyPassed },
    { key: "customer_copy_clean", passed: customerCopyClean },
    { key: "static_visual_ready", passed: staticVisualReady },
    { key: "meta", passed: Boolean(artifacts?.meta?.headline && artifacts?.meta?.primaryText) },
    { key: "meta_carousel", passed: carouselIntegrityPassed },
    { key: "meta_asset_coverage", passed: metaAssetCoveragePassed },
    { key: "blog", passed: Boolean(artifacts?.blog?.bodyHtml) },
    { key: "generic_language_control", passed: contentCraft.checks.genericLanguageControlled },
    { key: "headline_distinctiveness", passed: contentCraft.checks.headlineSystemDistinct },
    { key: "cross_channel_differentiation", passed: contentCraft.checks.channelsDifferentiated },
    { key: "email_copy_discipline", passed: contentCraft.checks.emailCopyDisciplined },
    { key: "meta_copy_discipline", passed: contentCraft.checks.metaCopyDisciplined },
    { key: "blog_editorial_depth", passed: contentCraft.checks.blogHasEditorialDepth },
    { key: "email_cta_integrity", passed: ctaIntegrityPassed },
    { key: "draft_only", passed: CONTENT_AGENT_POLICY.publishCapability === false }
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    score: Math.round((passedCount / checks.length) * 100),
    verdict: passedCount === checks.length ? "ready" : passedCount >= 5 ? "ready_with_notes" : "needs_review",
    checks,
    missing: checks.filter((check) => !check.passed).map((check) => check.key),
    contentCraft,
    policy: CONTENT_AGENT_POLICY
  };
}

async function persistTransition(state, jobId, nextState, patch) {
  const transitioned = transitionAgentJob(state, jobId, nextState, patch);
  await writeAgentState(transitioned.state);
  return transitioned;
}

function compactQualityIterations(iterations = []) {
  return (Array.isArray(iterations) ? iterations : []).map((entry) => ({
    iteration: entry.iteration,
    candidateVersion: entry.candidateVersion,
    review: {
      model: entry.review?.model || "",
      verdict: entry.review?.verdict || "REVISE",
      overallScore: Number(entry.review?.overallScore || 0),
      summary: String(entry.review?.summary || "").slice(0, 600),
      criticalFailures: (entry.review?.criticalFailures || []).slice(0, 3),
      dimensions: (entry.review?.dimensions || []).map((dimension) => ({
        key: dimension.key,
        score: Number(dimension.score || 0)
      }))
    },
    gate: entry.gate
  }));
}

async function queueAgentContinuation(config, { delaySeconds = 10, action = "agent_work" } = {}) {
  const qstashToken = String(process.env.QSTASH_TOKEN || "").trim();
  const cronSecret = String(config.cronSecret || "").trim();
  if (!qstashToken || !cronSecret) return { queued: false, reason: "scheduler_not_configured" };
  const origin = String(process.env.CONTENT_AGENT_ENDPOINT_ORIGIN || "https://project-4fcxa.vercel.app").replace(/\/+$/, "");
  const destination = `${origin}/api/campaign/brain`;
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${destination}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${qstashToken}`,
      "Content-Type": "text/plain",
      "Upstash-Method": "GET",
      "Upstash-Delay": `${Math.max(1, Number(delaySeconds || 10))}s`,
      "Upstash-Retries": "2",
      "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
      "Upstash-Forward-X-Content-Agent-Action": String(action || "agent_work"),
      "Upstash-Redact-Fields": "header[Authorization]"
    },
    body: ""
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { queued: false, reason: payload?.error || `qstash_${response.status}` };
  return { queued: true, messageId: payload.messageId || "" };
}

async function processAgentJob(config, stateValue, job) {
  let state = stateValue;
  const processingStartedAt = Date.now();
  try {
    const checkpoint = job.checkpoint && typeof job.checkpoint === "object" ? job.checkpoint : null;
    ({ state } = await persistTransition(state, job.id, "analysing", {
      attempts: Number(job.attempts || 0) + 1,
      progress: checkpoint ? Math.max(70, Number(job.progress || 0)) : 15,
      statusMessage: checkpoint ? "Resuming the durable quality loop from its Redis checkpoint." : "Reading the linked Asana brief and content package.",
      error: ""
    }));

    let assembled;
    let input;
    let plan;
    let artifactPack;
    let deterministicAudit;
    let resolvedEmailImageUrls;
    let artifactMemoryReferences;
    let referenceImageInputs;
    let qualityIterations;
    let revisionCount;
    let bestArtifactPack;
    let bestQualityReview;
    let bestScore;
    let creativeDirections;
    let conceptSelection;
    let channelDrafts;
    let productionNotes;
    let revisionScopes;
    let recoveryCheckpoint = checkpoint;
    const [historicalIntelligence, learningEvents] = await Promise.all([
      readHistoricalIntelligence(),
      readCampaignLearningEvents(160)
    ]);
    const metaIntelligenceBlock = buildMetaIntelligencePromptBlock(historicalIntelligence);
    const learningBlock = (channel = "general") => buildCampaignLearningPromptBlock(learningEvents, input || {}, channel);

    const createCheckpoint = () => ({
      assembled,
      input,
      plan,
      artifactPack,
      deterministicAudit,
      resolvedEmailImageUrls,
      artifactMemoryReferences,
      qualityIterations,
      revisionCount,
      bestArtifactPack,
      bestQualityReview,
      bestScore,
      creativeDirections,
      conceptSelection,
      channelDrafts,
      productionNotes,
      revisionScopes
    });

    const checkpointAndContinue = async (resumeStage, statusMessage, progress) => {
      recoveryCheckpoint = createCheckpoint();
      let checkpointResult = await persistTransition(state, job.id, "queued", {
        progress,
        statusMessage,
        qualityIterations,
        checkpoint: recoveryCheckpoint,
        resumeStage,
        publishCapability: false
      });
      const pendingControls = await drainAgentControlCommands();
      if (pendingControls.length) {
        const controlled = applyAgentControlCommands(checkpointResult.state, pendingControls);
        await writeAgentState(controlled.state);
        checkpointResult = {
          state: controlled.state,
          job: controlled.state.jobs.find((candidate) => candidate.id === job.id) || checkpointResult.job,
          controls: controlled.applied
        };
      }
      const continuation = await queueAgentContinuation(config);
      const updatedAt = new Date().toISOString();
      const continuationState = {
        ...checkpointResult.state,
        jobs: checkpointResult.state.jobs.map((candidate) => candidate.id === job.id ? {
          ...candidate,
          continuationMessageId: continuation.messageId || "",
          continuationError: continuation.queued ? "" : continuation.reason,
          ...(!continuation.queued && candidate.state !== "paused" ? {
            statusMessage: `${statusMessage} The hourly worker will resume it because an immediate continuation is unavailable.`
          } : {}),
          updatedAt
        } : candidate),
        updatedAt
      };
      await writeAgentState(continuationState);
      return {
        state: continuationState,
        job: continuationState.jobs.find((candidate) => candidate.id === job.id) || checkpointResult.job,
        controls: checkpointResult.controls || []
      };
    };

    if (checkpoint) {
      ({ assembled, input, plan, artifactPack, deterministicAudit } = checkpoint);
      artifactMemoryReferences = checkpoint.artifactMemoryReferences || artifactPack?.memoryReferences || [];
      qualityIterations = Array.isArray(checkpoint.qualityIterations) ? checkpoint.qualityIterations : [];
      revisionCount = Number(checkpoint.revisionCount || 0);
      bestArtifactPack = checkpoint.bestArtifactPack || artifactPack;
      bestQualityReview = checkpoint.bestQualityReview || qualityIterations.slice().sort((left, right) => Number(right.review?.overallScore || 0) - Number(left.review?.overallScore || 0))[0]?.review || null;
      bestScore = Number(checkpoint.bestScore ?? bestQualityReview?.overallScore ?? -1);
      creativeDirections = checkpoint.creativeDirections || null;
      conceptSelection = checkpoint.conceptSelection || null;
      channelDrafts = checkpoint.channelDrafts || {};
      productionNotes = Array.isArray(checkpoint.productionNotes) ? checkpoint.productionNotes : [];
      revisionScopes = Array.isArray(checkpoint.revisionScopes) ? checkpoint.revisionScopes : [];
      const refreshedSource = await readAgentJobSource(config, job);
      const assetUrlReplacements = buildRefreshedAssetUrlMap(input.assets, refreshedSource.input.assets);
      input = { ...input, assets: refreshedSource.input.assets };
      artifactPack = remapAssetUrls(artifactPack, assetUrlReplacements);
      bestArtifactPack = remapAssetUrls(bestArtifactPack, assetUrlReplacements);
      channelDrafts = remapAssetUrls(channelDrafts, assetUrlReplacements);
      resolvedEmailImageUrls = await selectReachableCampaignEmailImages(input.assets, 6);
      const assignedArtifactUrls = collectAssignedArtifactUrls(artifactPack, bestArtifactPack, channelDrafts);
      if (assignedArtifactUrls.length) {
        const reachableAssignedUrls = await selectReachableCampaignEmailImages(assignedArtifactUrls, 16);
        resolvedEmailImageUrls = [...new Set([...resolvedEmailImageUrls, ...reachableAssignedUrls])];
      }
      referenceImageInputs = await loadReferenceImageInputs(artifactMemoryReferences);
      const previousReview = qualityIterations.at(-1)?.review;
      if (job.resumeStage === "plan_generation") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 32,
          statusMessage: "Building and locking the cross-channel campaign strategy."
        }));
        const planRequest = buildCampaignBrainPrompt(input);
        artifactMemoryReferences = planRequest.memoryReferences;
        const planResponse = await requestStructuredOutput(config, {
          prompt: planRequest.prompt,
          schemaName: "westpack_content_agent_plan",
          schema: buildCampaignBrainSchema(),
          model: config.contentAgentModel || config.openAiModel,
          reasoningEffort: "low",
          requestTimeoutMs: 150_000,
          retryOnTimeout: false
        });
        plan = normalizeCampaignBrainResult(input, planResponse.parsed, planResponse.model, planRequest.memoryReferences);
        return checkpointAndContinue(
          "creative_directions",
          "Campaign plan is locked. Three competing creative routes will now be developed before production.",
          45
        );
      }
      if (job.resumeStage === "creative_directions") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 50,
          statusMessage: "Developing three distinct creative routes from the locked brief and owned campaign memory."
        }));
        const response = await requestStructuredOutput(config, {
          prompt: appendVisualInputs(
            appendVisualInputs(buildCreativeDirectionsPrompt({ input, plan, memoryReferences: artifactMemoryReferences, learningBlock: learningBlock("general") }), resolvedEmailImageUrls.slice(0, 4), "Approved campaign source images"),
            referenceImageInputs.slice(0, 3),
            "Owned historical Westpack emails used as design evidence",
            "low"
          ),
          schemaName: "westpack_creative_directions_v1",
          schema: buildCreativeDirectionSchema(),
          model: config.contentAgentModel || config.openAiModel,
          reasoningEffort: "high",
          retryOnTimeout: false
        });
        creativeDirections = normalizeCreativeDirections(response.parsed);
        let directionQualityGate = evaluateCreativeDirectionDiversity(creativeDirections);
        if (!directionQualityGate.passed) {
          creativeDirections.preproductionGate = directionQualityGate;
          return checkpointAndContinue(
            "creative_directions_challenge",
            "The first routes were too similar. Their evidence is checkpointed before one independent diversity challenge.",
            53
          );
        }
        creativeDirections.preproductionGate = directionQualityGate;
        return checkpointAndContinue(
          "concept_selection",
          "Three creative routes are checkpointed. An independent concept judge will select and lock the strongest route.",
          56
        );
      }
      if (job.resumeStage === "creative_directions_challenge") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 54,
          statusMessage: "Challenging route sameness in a dedicated execution window."
        }));
        const challenged = await requestStructuredOutput(config, {
          prompt: appendVisualInputs(
            appendVisualInputs(buildCreativeDirectionsPrompt({
              input,
              plan,
              memoryReferences: artifactMemoryReferences,
              learningBlock: learningBlock("general"),
              priorDirections: creativeDirections,
              qualityGate: creativeDirections?.preproductionGate || null
              }), resolvedEmailImageUrls.slice(0, 4), "Approved campaign source images"),
            referenceImageInputs.slice(0, 3),
            "Owned historical Westpack emails used to challenge route sameness",
            "low"
          ),
          schemaName: "westpack_creative_directions_challenge_v1",
          schema: buildCreativeDirectionSchema(),
          model: config.contentQualityModel || config.openAiModel,
          reasoningEffort: "high"
        });
        creativeDirections = normalizeCreativeDirections(challenged.parsed);
        creativeDirections.preproductionGate = evaluateCreativeDirectionDiversity(creativeDirections);
        return checkpointAndContinue(
          "concept_selection",
          "Three challenged creative routes are checkpointed. An independent concept judge will lock the strongest route.",
          56
        );
      }
      if (job.resumeStage === "concept_selection") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 58,
          statusMessage: "Scoring the competing routes and locking one creative contract."
        }));
        const response = await requestStructuredOutput(config, {
          prompt: appendVisualInputs(
            appendVisualInputs(buildConceptSelectionPrompt({ input, plan, directions: creativeDirections, memoryReferences: artifactMemoryReferences, learningBlock: learningBlock("general") }), resolvedEmailImageUrls.slice(0, 4), "Approved campaign source images"),
            referenceImageInputs.slice(0, 2),
            "Owned historical Westpack emails used to judge visual potential",
            "low"
          ),
          schemaName: "westpack_concept_selection_v1",
          schema: buildConceptSelectionSchema(),
          model: config.contentQualityModel || config.openAiModel,
          reasoningEffort: "medium"
        });
        conceptSelection = normalizeConceptSelection(response.parsed, creativeDirections);
        let conceptQualityGate = evaluateConceptSelectionQuality(conceptSelection);
        if (!conceptQualityGate.passed) {
          conceptSelection.challengeGate = conceptQualityGate;
          return checkpointAndContinue(
            "concept_selection_challenge",
            "The first selection was below the concept floor. It is checkpointed before one independent concept challenge.",
            60
          );
        }
        conceptSelection.preproductionGate = {
          passed: Boolean(conceptQualityGate.passed && creativeDirections?.preproductionGate?.passed !== false),
          failures: [...(creativeDirections?.preproductionGate?.failures || []), ...(conceptQualityGate.failures || [])],
          directionQuality: creativeDirections?.preproductionGate || null,
          conceptQuality: conceptQualityGate
        };
        return checkpointAndContinue(
          "email_production",
          "The winning route and creative contract are locked. The Klaviyo specialist will build the email from owned campaign memory.",
          62
        );
      }
      if (job.resumeStage === "concept_selection_challenge") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 60,
          statusMessage: "Challenging the weak concept selection in a dedicated execution window."
        }));
        const challenged = await requestStructuredOutput(config, {
          prompt: appendVisualInputs(
            appendVisualInputs(buildConceptSelectionPrompt({
              input,
              plan,
              directions: creativeDirections,
              memoryReferences: artifactMemoryReferences,
              learningBlock: learningBlock("general"),
              priorSelection: conceptSelection,
              qualityGate: conceptSelection?.challengeGate || null
              }), resolvedEmailImageUrls.slice(0, 4), "Approved campaign source images"),
            referenceImageInputs.slice(0, 2),
            "Owned historical Westpack emails used to challenge the weak concept",
            "low"
          ),
          schemaName: "westpack_concept_selection_challenge_v1",
          schema: buildConceptSelectionSchema(),
          model: config.contentQualityModel || config.openAiModel,
          reasoningEffort: "medium"
        });
        conceptSelection = normalizeConceptSelection(challenged.parsed, creativeDirections);
        const conceptQualityGate = evaluateConceptSelectionQuality(conceptSelection);
        conceptSelection.preproductionGate = {
          passed: Boolean(conceptQualityGate.passed && creativeDirections?.preproductionGate?.passed !== false),
          failures: [...(creativeDirections?.preproductionGate?.failures || []), ...(conceptQualityGate.failures || [])],
          directionQuality: creativeDirections?.preproductionGate || null,
          conceptQuality: conceptQualityGate
        };
        return checkpointAndContinue(
          "email_production",
          "The challenged winning route and creative contract are locked. The Klaviyo specialist is next.",
          62
        );
      }
      if (job.resumeStage === "email_production") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 64,
          statusMessage: "The Klaviyo specialist is producing the email against the locked concept and historical email patterns."
        }));
        const draft = await generateChannelDraft(config, {
          channel: "email",
          prompt: buildChannelProductionPrompt({ channel: "email", input, plan, conceptSelection, memoryReferences: artifactMemoryReferences, metaIntelligenceBlock, learningBlock: learningBlock("email") }),
          schemaName: "westpack_email_specialist_v1",
          resolvedEmailImageUrls,
          referenceImageInputs
        });
        channelDrafts.email = draft.channel;
        productionNotes.push(...draft.productionNotes);
        return checkpointAndContinue("meta_production", "Email is checkpointed without touching the other channels. The UK Meta specialist is next.", 68);
      }
      if (job.resumeStage === "meta_production") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 70,
          statusMessage: "The UK paid-social specialist is building two complete carousel executions of the locked idea."
        }));
        const draft = await generateChannelDraft(config, {
          channel: "meta",
          prompt: buildChannelProductionPrompt({ channel: "meta", input, plan, conceptSelection, memoryReferences: artifactMemoryReferences, metaIntelligenceBlock, learningBlock: learningBlock("meta") }),
          schemaName: "westpack_meta_specialist_v1",
          resolvedEmailImageUrls,
          referenceImageInputs: [],
          reasoningEffort: "medium"
        });
        channelDrafts.meta = draft.channel;
        productionNotes.push(...draft.productionNotes);
        return checkpointAndContinue("blog_production", "Meta carousel work is checkpointed. The editorial specialist will add the source-depth article.", 73);
      }
      if (job.resumeStage === "blog_production") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 75,
          statusMessage: "The editorial specialist is producing useful depth without repeating the email."
        }));
        const draft = await generateChannelDraft(config, {
          channel: "blog",
          prompt: buildChannelProductionPrompt({ channel: "blog", input, plan, conceptSelection, memoryReferences: artifactMemoryReferences, metaIntelligenceBlock, learningBlock: learningBlock("blog") }),
          schemaName: "westpack_blog_specialist_v1",
          resolvedEmailImageUrls,
          referenceImageInputs: [],
          reasoningEffort: "medium"
        });
        channelDrafts.blog = draft.channel;
        productionNotes.push(...draft.productionNotes);
        artifactPack = assembleSpecialistArtifactPack({
          input,
          plan,
          channelDrafts,
          productionNotes,
          memoryReferences: artifactMemoryReferences,
          resolvedEmailImageUrls,
          model: draft.model
        });
        deterministicAudit = buildQualityAudit(assembled, plan, artifactPack, resolvedEmailImageUrls, conceptSelection?.preproductionGate);
        bestArtifactPack = artifactPack;
        return checkpointAndContinue(
          "quality_review",
          "All specialist outputs are assembled and checkpointed. Independent quality review will inspect the compiled result.",
          78
        );
      }
      if (job.resumeStage === "artifact_generation") {
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: 52,
          statusMessage: "Turning the locked campaign plan into the art-directed production pack."
        }));
        const artifactRequest = buildCampaignArtifactsPrompt(input, plan, null, metaIntelligenceBlock);
        artifactMemoryReferences = artifactRequest.memoryReferences;
        referenceImageInputs = await loadReferenceImageInputs(artifactMemoryReferences);
        artifactPack = await generateArtifactPack(config, {
          input,
          plan,
          prompt: artifactRequest.prompt,
          schemaName: "westpack_content_agent_artifacts_v1",
          memoryReferences: artifactMemoryReferences,
          resolvedEmailImageUrls,
          referenceImageInputs
        });
        deterministicAudit = buildQualityAudit(assembled, plan, artifactPack, resolvedEmailImageUrls, conceptSelection?.preproductionGate);
        bestArtifactPack = artifactPack;
        return checkpointAndContinue(
          "quality_review",
          "Production pack is safely checkpointed. Independent quality review will run in a fresh execution window.",
          70
        );
      }
      if (job.resumeStage === "revision" && previousReview) {
        revisionCount += 1;
        const revisionChannel = selectRevisionChannel(previousReview, revisionScopes);
        revisionScopes.push(revisionChannel);
        ({ state } = await persistTransition(state, job.id, "producing", {
          progress: Math.min(92, 72 + revisionCount * 7),
          statusMessage: `Revision ${revisionCount}/${QUALITY_MAX_REVISIONS}: repairing only the ${revisionChannel} channel while approved work stays locked.`
        }));
        const draft = await generateChannelDraft(config, {
          channel: revisionChannel,
          prompt: buildChannelRevisionPrompt({
            channel: revisionChannel,
            input,
            plan,
            conceptSelection,
            currentArtifact: artifactPack?.artifacts?.[revisionChannel],
            qualityReview: previousReview,
            revisionNumber: revisionCount,
            memoryReferences: artifactMemoryReferences,
            metaIntelligenceBlock,
            learningBlock: learningBlock(revisionChannel)
          }),
          schemaName: `westpack_${revisionChannel}_surgical_revision_${revisionCount}`,
          resolvedEmailImageUrls,
          referenceImageInputs
        });
        channelDrafts = { ...(artifactPack?.artifacts || {}), ...(channelDrafts || {}), [revisionChannel]: draft.channel };
        productionNotes = [...new Set([...(artifactPack?.productionNotes || []), ...(productionNotes || []), ...draft.productionNotes])];
        artifactPack = assembleSpecialistArtifactPack({
          input,
          plan,
          channelDrafts,
          productionNotes,
          memoryReferences: artifactMemoryReferences,
          resolvedEmailImageUrls,
          model: draft.model
        });
        deterministicAudit = buildQualityAudit(assembled, plan, artifactPack, resolvedEmailImageUrls, conceptSelection?.preproductionGate);
        return checkpointAndContinue(
          "quality_review",
          `Revision ${revisionCount} is safely checkpointed. Independent quality review will run in a fresh execution window.`,
          Math.min(92, 76 + revisionCount * 7)
        );
      }
    } else {
      ({ assembled, input } = await readAgentJobSource(config, job));
      ({ state } = await persistTransition(state, job.id, "producing", {
        progress: 38,
        statusMessage: "Building the cross-channel campaign plan and production pack."
      }));
      resolvedEmailImageUrls = await selectReachableCampaignEmailImages(input.assets, 6);
      const sourceReadiness = evaluateSourceReadiness(input, resolvedEmailImageUrls);
      if (!sourceReadiness.passed) {
        return persistTransition(state, job.id, "quality_blocked", {
          progress: 100,
          statusMessage: "Source preflight stopped production before any AI generation.",
          error: sourceReadiness.summary,
          sourceReadiness,
          resumeStage: "",
          publishCapability: false
        });
      }
      artifactMemoryReferences = buildCampaignBrainPrompt(input).memoryReferences;
      referenceImageInputs = [];
      plan = null;
      artifactPack = null;
      deterministicAudit = null;
      qualityIterations = [];
      revisionCount = 0;
      bestArtifactPack = null;
      bestQualityReview = null;
      bestScore = -1;
      creativeDirections = null;
      conceptSelection = null;
      channelDrafts = {};
      productionNotes = [];
      revisionScopes = [];
      return checkpointAndContinue(
        "plan_generation",
        "Campaign source is assembled and checkpointed. Strategy generation will run in a fresh execution window.",
        24
      );
    }

    while (true) {
      deterministicAudit = buildQualityAudit(assembled, plan, artifactPack, resolvedEmailImageUrls, conceptSelection?.preproductionGate);
      ({ state } = await persistTransition(state, job.id, "quality_review", {
        progress: Math.min(94, 70 + revisionCount * 7),
        statusMessage: `Independent quality review ${revisionCount + 1} is evaluating depth, design and channel craft.`,
        qualityIterations,
        checkpoint: createCheckpoint(),
        resumeStage: "quality_review"
      }));
      recoveryCheckpoint = createCheckpoint();
      const reviewPrompt = buildQualityReviewPrompt({
        input,
        plan,
        artifactPack,
        deterministicAudit,
        creativeContract: conceptSelection?.creativeContract || null,
        renderedEvidence: buildRenderedArtifactEvidence(artifactPack),
        iteration: revisionCount + 1
      });
      const reviewResponse = await requestStructuredOutput(config, {
        prompt: appendVisualInputs(
          appendVisualInputs(reviewPrompt, resolvedEmailImageUrls.slice(0, 4), "Approved source images used by the candidate"),
          referenceImageInputs.slice(0, 2),
          "Curated references used to judge design ambition and hierarchy",
          "low"
        ),
        schemaName: "westpack_quality_director_review_v1",
        schema: buildQualityReviewSchema(),
        model: config.contentQualityModel || config.openAiModel,
        reasoningEffort: "medium"
      });
      const qualityReview = normalizeQualityReview(reviewResponse.parsed, reviewResponse.model);
      const processingDeadlineReached = Date.now() - processingStartedAt > 235_000;
      const previewGate = evaluateQualityGate(qualityReview, deterministicAudit);
      const qualityDecision = decideQualityNextStep({
        review: qualityReview,
        deterministicAudit,
        revisionCount,
        scoreHistory: [...qualityIterations.map((entry) => Number(entry.gate?.score ?? entry.review?.overallScore ?? 0)), previewGate.score],
        // Every rejected candidate is checkpointed before another expensive model call.
        // This keeps each serverless invocation bounded and makes the loop resumable.
        deadlineReached: processingDeadlineReached || qualityReview.verdict === "REVISE"
      });
      const gate = qualityDecision.gate;
      if (gate.score > bestScore) {
        bestScore = gate.score;
        bestArtifactPack = artifactPack;
        bestQualityReview = qualityReview;
      }
      qualityIterations.push({
        iteration: revisionCount + 1,
        candidateVersion: revisionCount + 1,
        review: qualityReview,
        gate
      });

      const qualityAudit = {
        score: gate.score,
        verdict: qualityDecision.action === "admit_to_review"
          ? (qualityDecision.admissionTier === "excellent" ? "ready" : "ready_with_notes")
          : qualityReview.verdict === "BLOCKED" ? "blocked" : "revision_required",
        admissionTier: qualityDecision.admissionTier || "",
        deterministic: deterministicAudit,
        director: qualityReview,
        gate,
        revisionCount,
        iterations: qualityIterations,
        policy: CONTENT_AGENT_POLICY
      };

      if (qualityDecision.action === "admit_to_review") {
        const compactIterations = compactQualityIterations(qualityIterations);
        return persistTransition(state, job.id, "ready_for_review", {
          progress: 100,
          statusMessage: qualityDecision.admissionTier === "excellent"
            ? `Passed calibrated independent quality review at ${gate.score}/100 after ${revisionCount} revision${revisionCount === 1 ? "" : "s"}.`
            : `Safe, reviewable draft admitted at ${gate.score}/100 after ${revisionCount} targeted revisions. Quality Director notes remain visible for human review.`,
          output: { assembled, plan, creativeDirections, conceptSelection, artifactPack, qualityAudit: { ...qualityAudit, iterations: compactIterations, revisionScopes } },
          qualityIterations: compactIterations,
          checkpoint: null,
          resumeStage: "",
          publishCapability: false
        });
      }

      if (qualityDecision.action === "continue_later") {
        const checkpointResult = await persistTransition(state, job.id, "queued", {
          progress: Math.min(94, 76 + revisionCount * 7),
          statusMessage: "Quality pass checkpointed in Redis. The next revision will continue automatically.",
          output: { assembled, plan, creativeDirections, conceptSelection, artifactPack, qualityAudit: { ...qualityAudit, revisionScopes } },
          qualityIterations,
          checkpoint: createCheckpoint(),
          resumeStage: "revision",
          publishCapability: false
        });
        const continuation = await queueAgentContinuation(config);
        if (!continuation.queued) {
          return persistTransition(checkpointResult.state, job.id, "queued", {
            statusMessage: "Quality pass checkpointed. Automatic continuation is unavailable, so the hourly worker will resume it.",
            continuationError: continuation.reason
          });
        }
        return persistTransition(checkpointResult.state, job.id, "queued", {
          continuationMessageId: continuation.messageId,
          continuationError: ""
        });
      }

      if (qualityDecision.action === "quality_blocked") {
        const reason = qualityDecision.reason === "quality_director_blocked"
            ? "The Quality Director found a source-level blocker."
            : qualityDecision.reason === "quality_stagnated"
              ? "The current creative route stopped improving and was retired early."
              : `The campaign did not pass after ${QUALITY_MAX_REVISIONS} revisions.`;
        const compactIterations = compactQualityIterations(qualityIterations);
        const blockedResult = await persistTransition(state, job.id, "quality_blocked", {
          progress: 100,
          statusMessage: `${reason} It has not been admitted to human review.`,
          output: { assembled, plan, creativeDirections, conceptSelection, artifactPack, qualityAudit: { ...qualityAudit, iterations: compactIterations, revisionScopes } },
          qualityIterations: compactIterations,
          checkpoint: null,
          resumeStage: "",
          error: qualityReview.summary || reason,
          publishCapability: false
        });
        if (!["maximum_revisions_exhausted", "quality_stagnated"].includes(qualityDecision.reason)) return blockedResult;
        const reset = restartQualityExhaustedAgentJob(blockedResult.state, job.id, {
          qualitySummary: qualityReview.summary,
          maxRestarts: 0
        });
        if (!reset.restarted) return blockedResult;
        await writeAgentState(reset.state);
        const continuation = await queueAgentContinuation(config, { delaySeconds: 5, action: "agent_work" });
        const persistedState = normalizeRestartContinuation(reset.state, reset.job.id, continuation);
        await writeAgentState(persistedState);
        return { state: persistedState, job: persistedState.jobs.find((candidate) => candidate.id === reset.job.id) || reset.job };
      }

      revisionCount += 1;
      if (gate.score + 3 < bestScore) {
        artifactPack = bestArtifactPack;
        channelDrafts = { ...(bestArtifactPack?.artifacts || {}) };
        productionNotes = [...(bestArtifactPack?.productionNotes || [])];
      }
        const revisionChannel = selectRevisionChannel(qualityReview, revisionScopes);
      revisionScopes.push(revisionChannel);
      ({ state } = await persistTransition(state, job.id, "producing", {
        progress: Math.min(92, 72 + revisionCount * 7),
        statusMessage: `Revision ${revisionCount}/${QUALITY_MAX_REVISIONS}: repairing only ${revisionChannel}; approved channels remain locked.`,
        qualityIterations
      }));
      const draft = await generateChannelDraft(config, {
        channel: revisionChannel,
        prompt: buildChannelRevisionPrompt({
          channel: revisionChannel,
          input,
          plan,
          conceptSelection,
          currentArtifact: artifactPack?.artifacts?.[revisionChannel],
          qualityReview,
          revisionNumber: revisionCount,
          memoryReferences: artifactMemoryReferences,
          metaIntelligenceBlock,
          learningBlock: learningBlock(revisionChannel)
        }),
        schemaName: `westpack_${revisionChannel}_surgical_revision_${revisionCount}`,
        resolvedEmailImageUrls,
        referenceImageInputs
      });
      channelDrafts = { ...(artifactPack?.artifacts || {}), ...(channelDrafts || {}), [revisionChannel]: draft.channel };
      productionNotes = [...new Set([...(artifactPack?.productionNotes || []), ...(productionNotes || []), ...draft.productionNotes])];
      artifactPack = assembleSpecialistArtifactPack({
        input,
        plan,
        channelDrafts,
        productionNotes,
        memoryReferences: artifactMemoryReferences,
        resolvedEmailImageUrls,
        model: draft.model
      });
    }
  } catch (error) {
    const timeoutRetryCount = Number(job.timeoutRetryCount || 0);
    if (error?.name === "AbortError" && recoveryCheckpoint && timeoutRetryCount < 2) {
      await queueAgentContinuation(config, { delaySeconds: 45, action: "agent_work" }).catch(() => null);
      return persistTransition(state, job.id, "queued", {
        progress: Math.max(70, Number(job.progress || 0)),
        statusMessage: "The high-quality model pass exceeded its execution window. Work is checkpointed and will resume automatically.",
        checkpoint: recoveryCheckpoint,
        resumeStage: job.resumeStage || "revision",
        timeoutRetryCount: timeoutRetryCount + 1,
        error: "",
        publishCapability: false
      });
    }
    const recoveryAttempts = Number(job.recoveryAttempts || 0);
    return persistTransition(state, job.id, recoveryAttempts >= 2 ? "dead_letter" : "failed", {
      progress: 100,
      statusMessage: recoveryAttempts >= 2
        ? "Agent run failed after two controlled recoveries and moved to dead letter."
        : "Agent run failed and is available for controlled recovery.",
      error: error.message || "Content Agent job failed.",
      ...(recoveryAttempts >= 2 ? { deadLetteredAt: new Date().toISOString() } : {}),
      publishCapability: false
    });
  }
}

async function scanAsanaForAgentJobs(config) {
  const [campaignTasks, contentTasks, currentState] = await Promise.all([
    getAsanaProjectTasks(config, config.asanaCampaignProjectGid, { includeCompleted: false }),
    getAsanaProjectTasks(config, config.asanaContentProjectGid, { includeCompleted: false }),
    readAgentState()
  ]);
  const scan = applyHourlyScan(currentState, campaignTasks, contentTasks);
  await writeAgentState(scan.state);
  return { ...scan, campaignTasks, contentTasks };
}

async function resolveManualAgentSelection(config, { campaignTaskGid, contentTaskGid = "" } = {}) {
  const [campaignTasks, contentTasks] = await Promise.all([
    getAsanaProjectTasks(config, config.asanaCampaignProjectGid, { includeCompleted: false }),
    getAsanaProjectTasks(config, config.asanaContentProjectGid, { includeCompleted: false })
  ]);
  const campaignTask = campaignTasks.find((task) => task.gid === String(campaignTaskGid || ""));
  if (!campaignTask) throw new Error("The selected Asana campaign task was not found.");
  if (!isCampaignSectionTask(campaignTask)) {
    throw new Error(`The campaign must be in the '${CONTENT_AGENT_SOURCE_SECTION}' section of the E-mail Kampagner project.`);
  }
  const requestedContent = contentTasks.find((task) => task.gid === String(contentTaskGid || ""));
  const bestContentMatch = findBestContentMatch(campaignTask, contentTasks);
  const contentTask = requestedContent
    || (Number(bestContentMatch?.score || 0) >= MINIMUM_CONTENT_MATCH_SCORE ? bestContentMatch?.task : null)
    || campaignTask;
  return {
    campaignTask: { ...campaignTask, asanaVersion: `${campaignTask.modifiedAt || "unversioned"}|section:kampagner|pipeline:${CONTENT_AGENT_PIPELINE_VERSION}` },
    contentTask
  };
}

async function startManualAgentJob(config, { campaignTaskGid, contentTaskGid = "", direction = "", processNow = false, startMode = "queue" } = {}) {
  const lockId = `manual_${Date.now()}`;
  const locked = await acquireAgentLock(lockId);
  const mode = startMode === "takeover" ? "takeover" : "enqueue";
  if (!locked) {
    const [{ campaignTask, contentTask }, state] = await Promise.all([
      resolveManualAgentSelection(config, { campaignTaskGid, contentTaskGid }),
      readAgentState()
    ]);
    const activeJob = state.jobs.find((job) => ["analysing", "producing", "quality_review"].includes(job.state)) || null;
    const command = await queueAgentControlCommand({
      type: mode,
      pauseJobId: mode === "takeover" ? activeJob?.id || "" : "",
      campaignTask,
      contentTask,
      direction
    });
    const continuation = await queueAgentContinuation(config, { delaySeconds: 3, action: "agent_work" });
    return {
      state,
      job: null,
      pendingControl: true,
      control: command,
      continuation,
      statusMessage: mode === "takeover"
        ? "Takeover accepted. The active campaign will pause at its next safe checkpoint and this campaign will start first."
        : "Campaign accepted and placed next in the priority queue."
    };
  }
  try {
    const [{ campaignTask, contentTask }, state] = await Promise.all([
      resolveManualAgentSelection(config, { campaignTaskGid, contentTaskGid }),
      readAgentState()
    ]);
    const activeJob = state.jobs.find((job) => ["analysing", "producing", "quality_review"].includes(job.state)) || null;
    const queued = mode === "takeover"
      ? applyAgentControlCommands(state, [{ type: "takeover", pauseJobId: activeJob?.id || "", campaignTask, contentTask, direction }])
      : enqueueManualJob(state, { campaignTask, contentTask, direction });
    const queuedJob = queued.job || queued.createdJob;
    await writeAgentState(queued.state);
    if (!processNow) {
      const continuation = await queueAgentContinuation(config);
      const statusMessage = continuation.queued
        ? "Queued for the Content Agent. Production starts automatically."
        : "Queued for the Content Agent. The hourly worker will pick it up.";
      const queuedResult = await persistTransition(queued.state, queuedJob.id, "queued", {
        statusMessage,
        continuationMessageId: continuation.messageId || "",
        continuationError: continuation.queued ? "" : continuation.reason
      });
      return { ...queuedResult, continuation };
    }
    return processAgentJob(config, queued.state, queuedJob);
  } finally {
    await releaseAgentLock(lockId);
  }
}

async function runContentAgentCycle(config, { processOne = true, discover = true } = {}) {
  const store = getAgentStoreProfile();
  if (!store.persistent) {
    return {
      busy: false,
      skipped: true,
      reason: "persistent_store_required",
      state: await readAgentState(),
      job: null,
      discovered: []
    };
  }
  const lockId = `cycle_${Date.now()}`;
  const locked = await acquireAgentLock(lockId);
  if (!locked) return { busy: true, state: await readAgentState(), job: null };
  try {
    let currentState = await readAgentState();
    const pendingControls = await drainAgentControlCommands();
    if (pendingControls.length) {
      const controlled = applyAgentControlCommands(currentState, pendingControls);
      currentState = controlled.state;
      await writeAgentState(currentState);
    }
    const requiresWorkflowMigration = Number(currentState.lastScanSummary?.workflowFilterVersion || 0) < CONTENT_AGENT_WORKFLOW_FILTER_VERSION;
    const scan = discover || requiresWorkflowMigration
      ? await scanAsanaForAgentJobs(config)
      : { state: currentState, discovered: [] };
    const recovery = recoverInterruptedJobs(scan.state);
    if (recovery.recoveredCount) await writeAgentState(recovery.state);
    const nextJob = getNextQueuedJob(recovery.state);
    if (!processOne || !nextJob) return { busy: false, state: recovery.state, job: null, discovered: scan.discovered };
    const queuedPipelineVersion = Number(String(nextJob.asanaVersion || "").match(/\|pipeline:(\d+)$/)?.[1] || 0);
    if (queuedPipelineVersion && queuedPipelineVersion < CONTENT_AGENT_PIPELINE_VERSION) {
      const superseded = await persistTransition(recovery.state, nextJob.id, "superseded", {
        progress: 100,
        statusMessage: `Superseded before execution by Content Agent pipeline ${CONTENT_AGENT_PIPELINE_VERSION}.`,
        checkpoint: null,
        resumeStage: "",
        completedAt: new Date().toISOString(),
        publishCapability: false
      });
      const migrationContinuation = await queueAgentContinuation(config, { delaySeconds: 5, action: "agent_discover" });
      return {
        busy: false,
        state: superseded.state,
        job: superseded.job,
        discovered: scan.discovered,
        backlogContinuation: migrationContinuation
      };
    }
    const result = await processAgentJob(config, recovery.state, nextJob);
    const nextBacklogJob = getNextQueuedJob(result.state);
    let backlogContinuation = null;
    if (["ready_for_review", "quality_blocked", "failed"].includes(result.job?.state) && nextBacklogJob) {
      backlogContinuation = await queueAgentContinuation(config);
    }
    return {
      busy: false,
      state: result.state,
      job: result.job,
      discovered: scan.discovered,
      backlogContinuation
    };
  } finally {
    await releaseAgentLock(lockId);
  }
}

async function getContentAgentStatus() {
  const [state, learning] = await Promise.all([readAgentState(), getCampaignLearningStatus()]);
  const store = getAgentStoreProfile();
  return {
    state,
    store,
    learning,
    health: buildContentAgentHealth(state, store),
    policy: CONTENT_AGENT_POLICY
  };
}

async function retryContentAgentJob(config, jobId) {
  const lockId = `recovery_${Date.now()}`;
  const locked = await acquireAgentLock(lockId);
  if (!locked) throw new Error("Content Agent is busy. Retry recovery when the active job has checkpointed.");
  try {
    const recovery = requeueFailedAgentJob(await readAgentState(), String(jobId || ""));
    await writeAgentState(recovery.state);
    const continuation = recovery.requeued
      ? await queueAgentContinuation(config, { delaySeconds: 5, action: "agent_work" })
      : { queued: false, reason: "recovery_budget_exhausted" };
    return { ...recovery, continuation };
  } finally {
    await releaseAgentLock(lockId);
  }
}

async function controlContentAgentJob(config, { jobId = "", command = "" } = {}) {
  const type = String(command || "").toLowerCase();
  if (!new Set(["pause", "resume"]).has(type)) throw new Error("Unsupported Content Agent control command.");
  if (!jobId) throw new Error("Content Agent job id is required.");
  const lockId = `operator_${type}_${Date.now()}`;
  const locked = await acquireAgentLock(lockId);
  if (!locked) {
    const [entry, state] = await Promise.all([
      queueAgentControlCommand({ type, jobId: String(jobId) }),
      readAgentState()
    ]);
    const continuation = await queueAgentContinuation(config, { delaySeconds: 3, action: "agent_work" });
    return { state, job: state.jobs.find((job) => job.id === String(jobId)) || null, pendingControl: true, control: entry, continuation };
  }
  try {
    const controlled = applyAgentControlCommands(await readAgentState(), [{ type, jobId: String(jobId) }]);
    if (!controlled.applied.length) throw new Error(type === "pause" ? "This job cannot be paused in its current state." : "Only paused jobs can be resumed.");
    await writeAgentState(controlled.state);
    const continuation = type === "resume"
      ? await queueAgentContinuation(config, { delaySeconds: 3, action: "agent_work" })
      : { queued: false, reason: "paused" };
    return {
      state: controlled.state,
      job: controlled.state.jobs.find((job) => job.id === String(jobId)) || null,
      pendingControl: false,
      continuation
    };
  } finally {
    await releaseAgentLock(lockId);
  }
}

async function rejectAndRestartContentAgentJob(config, jobId, reason = "") {
  const lockId = `manual_reject_${Date.now()}`;
  const locked = await acquireAgentLock(lockId);
  if (!locked) throw new Error("Content Agent is busy. Reject and restart when the active job has checkpointed.");
  try {
    const restarted = rejectAndRestartAgentJob(await readAgentState(), String(jobId || ""));
    await recordArtifactLearning({
      type: "rejected",
      jobId: String(jobId || ""),
      reason: String(reason || "No rejection reason supplied.").trim(),
      channel: "cross_channel"
    }).catch(() => null);
    await writeAgentState(restarted.state);
    const continuation = await queueAgentContinuation(config, { delaySeconds: 5, action: "agent_work" });
    const persistedState = normalizeRestartContinuation(restarted.state, restarted.job.id, continuation);
    await writeAgentState(persistedState);
    return {
      ...restarted,
      state: persistedState,
      job: persistedState.jobs.find((job) => job.id === restarted.job.id) || restarted.job,
      continuation
    };
  } finally {
    await releaseAgentLock(lockId);
  }
}

function normalizeRestartContinuation(state, jobId, continuation = {}) {
  const updatedAt = new Date().toISOString();
  return {
    ...state,
    jobs: (state.jobs || []).map((job) => job.id === jobId ? {
      ...job,
      statusMessage: continuation.queued
        ? `${job.statusMessage} Production starts automatically.`
        : `${job.statusMessage} The hourly worker will pick it up.`,
      continuationMessageId: continuation.messageId || "",
      continuationError: continuation.queued ? "" : continuation.reason || "Continuation could not be queued.",
      updatedAt
    } : job),
    updatedAt
  };
}

module.exports = {
  buildRefreshedAssetUrlMap,
  buildQualityAudit,
  collectAssignedArtifactUrls,
  controlContentAgentJob,
  evaluateSourceReadiness,
  getContentAgentStatus,
  processAgentJob,
  queueAgentContinuation,
  remapAssetUrls,
  rejectAndRestartContentAgentJob,
  requestStructuredOutput,
  retryContentAgentJob,
  runContentAgentCycle,
  scanAsanaForAgentJobs,
  serializeAsanaBundle,
  startManualAgentJob
};
