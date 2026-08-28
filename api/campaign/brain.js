const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const {
  getAsanaConnectionProfile,
  getAsanaProjectTasks,
  getAsanaTaskBundle,
  getAsanaWorkspaceProjects
} = require("../../server/lib/asana");
const { assembleCampaignObject } = require("../../server/campaign/object");
const {
  buildCampaignEnvironmentSeries,
  buildCampaignCarouselSuggestionSchema,
  buildCampaignCarouselSuggestionsPrompt,
  buildCampaignArtifactsPrompt,
  buildCampaignArtifactSchema,
  buildCampaignBrainPrompt,
  buildCampaignBrainSchema,
  compileCampaignEmailDraft,
  extractJsonText,
  normalizeCampaignArtifactResult,
  normalizeCampaignBrainInput,
  normalizeCampaignBrainResult,
  selectReachableCampaignEmailImages
} = require("../../server/campaign/brain");
const {
  buildMetaFromMasterPrompt,
  buildMetaFromMasterSchema,
  normalizeMetaFromMasterResult,
  extractMasterVisualUrls
} = require("../../server/campaign/meta-from-master");
const {
  getContentAgentStatus,
  controlContentAgentJob,
  queueAgentContinuation,
  rejectAndRestartContentAgentJob,
  retryContentAgentJob,
  runContentAgentCycle,
  startManualAgentJob
} = require("../../server/campaign/content-agent-worker");
const { readHistoricalIntelligence } = require("../../server/meta/historical-store");
const { buildMetaIntelligencePromptBlock } = require("../../server/meta/historical-intelligence");
const {
  buildMetaCreativeReviewPrompt,
  buildMetaCreativeReviewSchema,
  normalizeMetaCreativeReview
} = require("../../server/campaign/meta-quality-director");
const { getCampaignLearningStatus, moderateArtifactLearning, recordArtifactLearning } = require("../../server/campaign/campaign-learning-service");

const EMAIL_VISUAL_REVISION = "2026-04-15";

function assertSafeCampaignAssetUrl(value = "") {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") throw new Error("Campaign assets must use HTTPS.");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Campaign asset host is not allowed.");
  }
  return url.toString();
}

async function proxyCampaignAsset(req, res) {
  const sourceUrl = assertSafeCampaignAssetUrl(req.query?.url || "");
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) throw new Error(`Campaign asset download failed (${response.status}).`);
  assertSafeCampaignAssetUrl(response.url || sourceUrl);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("Campaign asset did not return an image.");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  const maxStreamBytes = 20_000_000;
  if (declaredSize > maxStreamBytes) throw new Error("Campaign asset is too large to render.");
  if (!response.body) throw new Error("Campaign asset returned no image body.");
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  let streamedBytes = 0;
  for await (const chunk of response.body) {
    streamedBytes += chunk.byteLength;
    if (streamedBytes > maxStreamBytes) {
      res.destroy(new Error("Campaign asset is too large to render."));
      return;
    }
    res.write(Buffer.from(chunk));
  }
  if (!streamedBytes) throw new Error("Campaign asset is empty.");
  res.end();
}

async function downloadCampaignAssetFile(sourceUrl) {
  const safeSourceUrl = assertSafeCampaignAssetUrl(sourceUrl);
  const response = await fetch(safeSourceUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Campaign asset download failed (${response.status}).`);
  assertSafeCampaignAssetUrl(response.url || safeSourceUrl);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("Campaign asset did not return an image.");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 5_000_000) throw new Error("Campaign asset is too large to add to Klaviyo.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 5_000_000) throw new Error("Campaign asset is empty or too large to add to Klaviyo.");
  return { bytes, contentType };
}

function decodeCampaignImageDataUri(dataUri = "") {
  const match = String(dataUri || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("Cropped campaign image is not a supported image payload.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 5_000_000) throw new Error("Cropped campaign image is empty or too large.");
  return { bytes, contentType: match[1].toLowerCase() };
}

function parseKlaviyoMarkets(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function uploadEmailVisualToKlaviyo(config, account, dataUri, name) {
  const market = parseKlaviyoMarkets(config.klaviyoMarketsJson)
    .find((item) => String(item?.country || "").trim().toUpperCase() === String(account || "DK").trim().toUpperCase());
  if (!market?.privateKey) throw new Error(`No Klaviyo image library is configured for ${account || "DK"}.`);
  const response = await fetch("https://a.klaviyo.com/api/images", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${String(market.privateKey).trim()}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: EMAIL_VISUAL_REVISION
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      data: {
        type: "image",
        attributes: {
          import_from_url: dataUri,
          name,
          hidden: false
        }
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.errors?.[0]?.detail || `Klaviyo image upload failed (${response.status}).`);
  const imageUrl = String(payload?.data?.attributes?.image_url || "");
  if (!imageUrl) throw new Error("Klaviyo image upload returned no hosted URL.");
  return {
    id: String(payload?.data?.id || ""),
    imageUrl
  };
}

async function uploadEmailVisualFileToKlaviyo(config, account, file, name) {
  const market = parseKlaviyoMarkets(config.klaviyoMarketsJson)
    .find((item) => String(item?.country || "").trim().toUpperCase() === String(account || "DK").trim().toUpperCase());
  if (!market?.privateKey) throw new Error(`No Klaviyo image library is configured for ${account || "DK"}.`);
  const extension = file.contentType === "image/png" ? ".png" : file.contentType === "image/gif" ? ".gif" : ".jpg";
  const filename = /\.(?:jpe?g|png|gif)$/i.test(name) ? name : `${name}${extension}`;
  const form = new FormData();
  form.append("file", new Blob([file.bytes], { type: file.contentType }), filename);
  form.append("name", filename);
  form.append("hidden", "false");
  const response = await fetch("https://a.klaviyo.com/api/image-upload", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${String(market.privateKey).trim()}`,
      Accept: "application/vnd.api+json",
      revision: "2026-07-15"
    },
    signal: AbortSignal.timeout(25_000),
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.errors?.[0]?.detail || `Klaviyo image upload failed (${response.status}).`);
  const imageUrl = String(payload?.data?.attributes?.image_url || "");
  if (!imageUrl) throw new Error("Klaviyo image upload returned no hosted URL.");
  return {
    id: String(payload?.data?.id || ""),
    imageUrl
  };
}

function buildEmailVisualPrompts(input, plan, emailArtifact) {
  const campaignAngle = String(plan?.campaign?.coreAngle || input.objective || input.title || "premium Westpack campaign");
  const shared = [
    `Campaign: ${campaignAngle}.`,
    "Create a premium Scandinavian editorial email visual using only the supplied Westpack product photography as product truth.",
    "Preserve exact product identity, silhouette, proportions, logo embossing, seams, closures, colours, materials and jewellery placement.",
    "You may crop, reframe, extend backgrounds, balance lighting, remove dead space and combine supplied photographs into one coherent composition.",
    "Do not invent products, alter logos, add text, add watermarks, distort jewellery, or make the result look synthetic.",
    `Art direction: ${emailArtifact?.visualDirection || "soft luxury"}; warm Nordic restraint, tactile materials, quiet confidence, commercial clarity.`
  ].join(" ");
  return [
    {
      role: "hero",
      name: "email-hero-editorial.jpg",
      prompt: `${shared} Produce a wide campaign hero with one decisive focal product arrangement, elegant negative space and a refined editorial crop. It must feel like the opening spread of a luxury commerce email, not a raw square packshot.`
    },
    {
      role: "diptych",
      name: "email-diptych-story.jpg",
      prompt: `${shared} Produce one wide image designed as a sophisticated two-panel diptych. Combine two complementary supplied product views with consistent scale, colour treatment and a clean central gutter. Use contrasting wide and detail perspectives.`
    },
    {
      role: "detail",
      name: "email-detail-banner.jpg",
      prompt: `${shared} Produce a wide detail-led story banner. Use a close crop and a supporting product view to emphasize tactile finish, presentation quality and retail desirability while keeping the composition calm and premium.`
    }
  ];
}

module.exports = async (req, res) => {
  const config = getConfig();
  const requestedAction = String(
    req.query?.action || req.headers?.["x-content-agent-action"] || ""
  ).trim().toLowerCase();
  const cronAuthorized = ["agent_scan", "agent_work", "agent_discover"].includes(requestedAction)
    && Boolean(config.cronSecret)
    && String(req.headers?.authorization || "") === `Bearer ${config.cronSecret}`;
  if (!cronAuthorized && !requireAuth(req, res, config)) {
    return;
  }

  if (req.method === "GET") {
    const action = requestedAction;
    if (!new Set(["asana_status", "asana_projects", "asana_tasks", "asana_task", "asset_proxy", "agent_status", "agent_scan", "agent_work", "agent_discover", "campaign_learning_status"]).has(action)) {
      sendJson(res, 400, { error: "Unsupported Campaign Brain GET action." });
      return;
    }
    if (action === "agent_status") {
      try {
        const status = await getContentAgentStatus();
        sendJson(res, 200, { ok: true, ...status });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message || "Could not load Content Agent status." });
      }
      return;
    }
    if (action === "campaign_learning_status") {
      sendJson(res, 200, { ok: true, ...(await getCampaignLearningStatus()) });
      return;
    }
    if (["agent_scan", "agent_work"].includes(action)) {
      if (!config.asanaAccessToken || !config.asanaCampaignProjectGid || !config.asanaContentProjectGid) {
        sendJson(res, 503, { ok: false, error: "Content Agent Asana projects are not configured." });
        return;
      }
      try {
        const cycle = await runContentAgentCycle(config, { processOne: true, discover: action === "agent_scan" });
        const busyContinuation = cycle.busy
          ? await queueAgentContinuation(config, { delaySeconds: 60, action })
          : null;
        sendJson(res, 200, {
          ok: true,
          busy: cycle.busy,
          skipped: Boolean(cycle.skipped),
          reason: cycle.reason || "",
          job: cycle.job,
          discoveredCount: cycle.discovered?.length || 0,
          backlogContinuation: cycle.backlogContinuation || busyContinuation,
          state: cycle.state,
          store: (await getContentAgentStatus()).store
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode) || 500, { ok: false, error: error.message || "Content Agent cycle failed." });
      }
      return;
    }
    if (action === "agent_discover") {
      if (!config.asanaAccessToken || !config.asanaCampaignProjectGid || !config.asanaContentProjectGid) {
        sendJson(res, 503, { ok: false, error: "Content Agent Asana projects are not configured." });
        return;
      }
      try {
        const cycle = await runContentAgentCycle(config, { processOne: false });
        const continuation = await queueAgentContinuation(config, {
          delaySeconds: cycle.busy ? 60 : 10,
          action: cycle.busy ? "agent_discover" : "agent_work"
        });
        sendJson(res, 200, {
          ok: true,
          busy: cycle.busy,
          discoveredCount: cycle.discovered?.length || 0,
          continuation,
          summary: cycle.state?.lastScanSummary || null,
          queueDepth: (cycle.state?.jobs || []).filter((job) => job.state === "queued").length,
          publishCapability: false
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode) || 500, { ok: false, error: error.message || "Content Agent discovery failed." });
      }
      return;
    }
    if (action === "asset_proxy") {
      try {
        await proxyCampaignAsset(req, res);
      } catch (error) {
        sendJson(res, 502, { error: error.message || "Could not proxy campaign asset." });
      }
      return;
    }
    if (!config.asanaAccessToken) {
      sendJson(res, 503, {
        ok: false,
        configured: false,
        error: "ASANA_ACCESS_TOKEN is not configured."
      });
      return;
    }
    try {
      if (action === "asana_tasks") {
        const projectKind = String(req.query?.kind || "campaign").trim().toLowerCase();
        const projectGid = projectKind === "content"
          ? config.asanaContentProjectGid
          : config.asanaCampaignProjectGid;
        if (!projectGid) {
          sendJson(res, 503, { error: `Asana ${projectKind} project is not configured.` });
          return;
        }
        const tasks = await getAsanaProjectTasks(config, projectGid, {
          includeCompleted: String(req.query?.includeCompleted || "") === "true"
        });
        sendJson(res, 200, {
          ok: true,
          readOnly: true,
          kind: projectKind,
          projectGid: String(projectGid).trim(),
          tasks
        });
        return;
      }
      if (action === "asana_task") {
        const bundle = await getAsanaTaskBundle(config, req.query?.taskGid);
        sendJson(res, 200, {
          ok: true,
          readOnly: true,
          ...bundle
        });
        return;
      }
      const profile = await getAsanaConnectionProfile(config);
      if (action === "asana_projects") {
        const workspaceGid = String(req.query?.workspaceGid || profile.workspaces?.[0]?.gid || "");
        const projects = await getAsanaWorkspaceProjects(config, workspaceGid);
        sendJson(res, 200, {
          ok: true,
          readOnly: true,
          workspaceGid,
          projects
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        configured: true,
        readOnly: true,
        profile,
        projects: {
          campaignConfigured: Boolean(config.asanaCampaignProjectGid),
          contentConfigured: Boolean(config.asanaContentProjectGid)
        }
      });
    } catch (error) {
      sendJson(res, Number(error?.statusCode) || 502, {
        ok: false,
        configured: true,
        error: error?.message || "Could not connect to Asana."
      });
    }
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (!config.openAiApiKey) {
    sendJson(res, 500, { error: "Missing OpenAI API key." });
    return;
  }

  try {
    const rawInput = await readJsonBody(req);
    const action = String(rawInput?.action || "plan").trim().toLowerCase();

    if (action === "review_meta_carousel") {
      const renderedImages = (Array.isArray(rawInput?.renderedImages) ? rawInput.renderedImages : [])
        .filter((value) => /^data:image\/(?:jpeg|png|webp);base64,/i.test(String(value || "")))
        .slice(0, 6);
      if (renderedImages.length < 3 || renderedImages.length > 6) {
        sendJson(res, 400, { error: "Creative Director requires between 3 and 6 rendered carousel cards." });
        return;
      }
      const reviewRequest = buildMetaCreativeReviewPrompt({
        campaign: rawInput?.campaign || {},
        renderedImages,
        iteration: Math.max(1, Math.min(3, Number(rawInput?.iteration || 1)))
      });
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
        body: JSON.stringify({
          model: config.openAiModel,
          input: reviewRequest,
          text: { format: { type: "json_schema", name: "westpack_meta_creative_review", schema: buildMetaCreativeReviewSchema() } }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        sendJson(res, response.status, { error: payload?.error?.message || "Meta Creative Director review failed." });
        return;
      }
      sendJson(res, 200, normalizeMetaCreativeReview(
        JSON.parse(extractJsonText(payload)),
        payload.model || config.openAiModel
      ));
      return;
    }

    if (action === "host_email_asset") {
      const account = String(rawInput?.klaviyoAccount || "DK").trim().toUpperCase() || "DK";
      const safeName = String(rawInput?.name || "campaign-email-image.jpg")
        .replace(/[^a-z0-9._-]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100) || "campaign-email-image.jpg";
      const hosted = rawInput?.imageDataUri
        ? await uploadEmailVisualFileToKlaviyo(
            config,
            account,
            decodeCampaignImageDataUri(rawInput.imageDataUri),
            safeName
          )
        : await uploadEmailVisualToKlaviyo(
            config,
            account,
            assertSafeCampaignAssetUrl(rawInput?.sourceUrl || ""),
            safeName
          );
      sendJson(res, 200, {
        ok: true,
        account,
        imageId: hosted.id,
        imageUrl: hosted.imageUrl,
        name: safeName,
        hosted: true
      });
      return;
    }

    if (action === "agent_start") {
      if (!config.asanaAccessToken || !config.asanaCampaignProjectGid || !config.asanaContentProjectGid) {
        sendJson(res, 503, { error: "Content Agent Asana projects are not configured." });
        return;
      }
      const result = await startManualAgentJob(config, {
        campaignTaskGid: rawInput?.campaignTaskGid,
        contentTaskGid: rawInput?.contentTaskGid,
        direction: rawInput?.direction,
        processNow: rawInput?.processNow === true,
        startMode: rawInput?.startMode
      });
      sendJson(res, 200, {
        ok: true,
        job: result.job,
        state: result.state,
        pendingControl: Boolean(result.pendingControl),
        statusMessage: result.statusMessage || result.job?.statusMessage || "",
        continuation: result.continuation,
        store: (await getContentAgentStatus()).store,
        publishCapability: false
      });
      return;
    }

    if (action === "agent_control") {
      const result = await controlContentAgentJob(config, {
        jobId: rawInput?.jobId,
        command: rawInput?.command
      });
      sendJson(res, 200, {
        ok: true,
        job: result.job,
        state: result.state,
        pendingControl: Boolean(result.pendingControl),
        continuation: result.continuation,
        health: (await getContentAgentStatus()).health,
        publishCapability: false
      });
      return;
    }

    if (action === "agent_retry") {
      const result = await retryContentAgentJob(config, rawInput?.jobId);
      sendJson(res, 200, {
        ok: true,
        job: result.job,
        state: result.state,
        continuation: result.continuation,
        health: (await getContentAgentStatus()).health,
        publishCapability: false
      });
      return;
    }

    if (action === "agent_reject_restart") {
      const result = await rejectAndRestartContentAgentJob(config, rawInput?.jobId, rawInput?.reason);
      sendJson(res, 200, {
        ok: true,
        rejectedJob: result.rejectedJob,
        job: result.job,
        state: result.state,
        continuation: result.continuation,
        health: (await getContentAgentStatus()).health,
        publishCapability: false
      });
      return;
    }

    if (action === "campaign_learning_feedback") {
      const result = await recordArtifactLearning({
        type: rawInput?.eventType,
        jobId: rawInput?.jobId,
        editedArtifact: rawInput?.editedArtifact,
        originalArtifact: rawInput?.originalArtifact,
        reason: rawInput?.reason,
        channel: rawInput?.channel,
        metadata: rawInput?.metadata
      });
      sendJson(res, 200, { ok: true, recorded: result.recorded, duplicate: result.duplicate, event: result.event });
      return;
    }

    if (action === "campaign_learning_moderate") {
      const result = await moderateArtifactLearning({
        eventId: rawInput?.eventId,
        operation: rawInput?.operation,
        operatorNote: rawInput?.operatorNote
      });
      sendJson(res, 200, { ok: true, ...result, learning: await getCampaignLearningStatus() });
      return;
    }

    if (action === "assemble_campaign") {
      const assembled = assembleCampaignObject(rawInput);
      sendJson(res, 200, assembled);
      return;
    }

    if (action === "compile_email") {
      const input = normalizeCampaignBrainInput(rawInput?.input || {});
      const email = compileCampaignEmailDraft(input, rawInput?.email || {}, rawInput?.resolvedEmailImageUrls || []);
      sendJson(res, 200, { ok: true, email });
      return;
    }

    if (action === "revise_email_module") {
      const input = normalizeCampaignBrainInput(rawInput?.input || {});
      const module = rawInput?.module && typeof rawInput.module === "object" ? rawInput.module : {};
      const emailContext = rawInput?.emailContext && typeof rawInput.emailContext === "object" ? rawInput.emailContext : {};
      const instruction = String(rawInput?.instruction || "Strengthen this module").trim().slice(0, 500);
      if (!String(module?.headline || module?.body || "").trim()) {
        sendJson(res, 400, { error: "Select a populated email module before using the AI copilot." });
        return;
      }
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
          bullets: { type: "array", maxItems: 5, items: { type: "string" } },
          rationale: { type: "string" }
        },
        required: ["label", "headline", "body", "bullets", "rationale"]
      };
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
              content: [{
                type: "input_text",
                text: [
                  "You are Westpack's senior email editor working inside a locked campaign module.",
                  "Revise only the supplied customer-facing module. Preserve factual meaning, language, approved claims and the module's persuasion job.",
                  "Write premium, specific B2B copy. Remove generic filler and repetition. Never invent prices, numbers, guarantees, links, products or environmental claims.",
                  "Do not include notes, placeholders or approval language in label, headline, body or bullets. Keep the label short and editorial.",
                  "Return a complete replacement module and a concise internal rationale. Return strict JSON only."
                ].join(" ")
              }]
            },
            {
              role: "user",
              content: [{
                type: "input_text",
                text: [
                  `Instruction: ${instruction}`,
                  `Campaign: ${JSON.stringify(input)}`,
                  `Email context: ${JSON.stringify(emailContext)}`,
                  `Current module: ${JSON.stringify(module)}`
                ].join("\n\n")
              }]
            }
          ],
          text: { format: { type: "json_schema", name: "westpack_email_module_revision", schema } }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        sendJson(res, response.status, { error: payload?.error?.message || "Email module revision failed." });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        suggestion: JSON.parse(extractJsonText(payload)),
        instruction,
        model: payload.model || config.openAiModel,
        generatedAt: new Date().toISOString()
      });
      return;
    }

    const input = normalizeCampaignBrainInput(rawInput);

    if (action === "generate_email_visuals") {
      const sourceUrls = await selectReachableCampaignEmailImages(input.assets, 6);
      if (sourceUrls.length < 2) {
        sendJson(res, 400, { error: "Email Visual Composer needs at least two reachable campaign images." });
        return;
      }
      const visualModel = String(rawInput?.visualConfig?.model || "gpt-image-1.5").trim() || "gpt-image-1.5";
      const prompts = buildEmailVisualPrompts(input, rawInput?.plan || null, rawInput?.emailArtifact || null);
      const generationResults = await Promise.all(prompts.map(async (entry) => {
        try {
          const response = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.openAiApiKey}`
            },
            body: JSON.stringify({
              model: visualModel,
              images: sourceUrls.slice(0, 6).map((imageUrl) => ({ image_url: imageUrl })),
              prompt: entry.prompt,
              background: "opaque",
              input_fidelity: "high",
              moderation: "auto",
              output_format: "jpeg",
              output_compression: 88,
              quality: "high",
              size: "1536x1024"
            })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.error?.message || `${entry.role} generation failed.`);
          const b64 = String(payload?.data?.[0]?.b64_json || "");
          if (!b64) throw new Error(`${entry.role} generation returned no image.`);
          const dataUri = `data:image/jpeg;base64,${b64}`;
          let hosted = null;
          let uploadError = "";
          try {
            hosted = await uploadEmailVisualToKlaviyo(
              config,
              rawInput?.klaviyoAccount || "DK",
              dataUri,
              `${String(input.title || "campaign").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60)}-${entry.name}`
            );
          } catch (error) {
            uploadError = error.message || "Klaviyo image upload failed.";
          }
          return {
            image: {
              role: entry.role,
              name: entry.name,
              prompt: entry.prompt,
              imageId: hosted?.id || "",
              imageUrl: hosted?.imageUrl || dataUri,
              hosted: Boolean(hosted?.imageUrl),
              uploadError
            },
            error: null
          };
        } catch (error) {
          return {
            image: null,
            error: { role: entry.role, error: error.message || "Email visual generation failed." }
          };
        }
      }));
      const generated = generationResults.map((result) => result.image).filter(Boolean);
      const errors = generationResults.map((result) => result.error).filter(Boolean);

      sendJson(res, 200, {
        input,
        images: generated,
        errors,
        sourceImageCount: sourceUrls.length,
        model: visualModel,
        generatedAt: new Date().toISOString()
      });
      return;
    }

    if (action === "generate_environment_series") {
      const environmentImages = Array.isArray(rawInput?.environmentImages)
        ? rawInput.environmentImages
            .filter((image) => typeof image?.image_url === "string" && image.image_url.trim())
            .slice(0, 6)
        : [];
      const styleReferenceImage = rawInput?.styleReferenceImage && typeof rawInput.styleReferenceImage?.image_url === "string" && rawInput.styleReferenceImage.image_url.trim()
        ? rawInput.styleReferenceImage
        : null;

      if (!environmentImages.length) {
        sendJson(res, 400, { error: "Environment generation needs at least one source image." });
        return;
      }

      const environmentPlan = buildCampaignEnvironmentSeries(
        input,
        rawInput?.environmentConfig || {},
        rawInput?.plan || null,
        rawInput?.metaArtifact || null,
        environmentImages.length,
        environmentImages
      );
      const environmentModel = String(rawInput?.environmentConfig?.model || "gpt-image-1.5").trim() || "gpt-image-1.5";
      const generatedImages = [];
      const generationErrors = [];

      for (let index = 0; index < environmentImages.length; index += 1) {
        const image = environmentImages[index];
        const promptEntry = environmentPlan.prompts[index] || environmentPlan.prompts[0];

        for (const format of environmentPlan.selectedFormats || ["portrait"]) {
          try {
            const response = await fetch("https://api.openai.com/v1/images/edits", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.openAiApiKey}`
              },
              body: JSON.stringify({
                model: environmentModel,
                images: [
                  {
                    image_url: image.image_url
                  },
                  ...(styleReferenceImage
                    ? [{
                        image_url: styleReferenceImage.image_url
                      }]
                    : [])
                ],
                prompt: [
                  promptEntry?.prompt || environmentPlan.summary,
                  `Output format target: ${format}.`,
                  styleReferenceImage
                    ? "A second approved environment reference image is attached. Match its world-building, lighting language, styling restraint and overall campaign cohesion while still preserving the product from the primary source image."
                    : "",
                  format === "square"
                    ? "Compose for a 1:1 campaign crop with strong centered readability."
                    : format === "landscape"
                      ? "Compose for a calm horizontal editorial crop with protected edge space."
                      : "Compose for a vertical social crop with safe top and bottom breathing room."
                ].join("\n"),
                background: environmentPlan.backgroundMode === "transparent" ? "transparent" : "opaque",
                input_fidelity: "high",
                moderation: "auto",
                output_format: "png",
                quality: environmentPlan.quality,
                size: format === "square" ? "1024x1024" : format === "landscape" ? "1536x1024" : "1024x1536"
              })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload?.error?.message || `Environment image generation failed for image ${index + 1} (${format}).`);
            }

            const generated = Array.isArray(payload?.data) ? payload.data[0] : null;
            const b64 = generated?.b64_json || "";
            if (!b64) {
              throw new Error(`Environment image response was empty for image ${index + 1} (${format}).`);
            }

            generatedImages.push({
              index: index + 1,
              format,
              name: image?.name || `environment-${index + 1}.png`,
              prompt: promptEntry?.prompt || "",
              role: promptEntry?.role || "",
              imageUrl: `data:image/png;base64,${b64}`
            });
          } catch (error) {
            generationErrors.push({
              index: index + 1,
              format,
              name: image?.name || `environment-${index + 1}.png`,
              error: error.message || "Environment generation failed."
            });
          }
        }
      }

      sendJson(res, 200, {
        input,
        environmentPlan,
        images: generatedImages,
        errors: generationErrors,
        model: environmentModel,
        generatedAt: new Date().toISOString()
      });
      return;
    }

    if (!input.objective && !input.source.body && !input.source.html) {
      sendJson(res, 400, {
        error: "Campaign brain needs at least an objective or some source content."
      });
      return;
    }

    const metaMasterImageUrls = action === "generate_meta_from_master"
      ? await selectReachableCampaignEmailImages(input.assets, 8)
      : [];
    const masterVisualImages = action === "generate_meta_from_master"
      ? await selectReachableCampaignEmailImages(extractMasterVisualUrls(input.source?.html), 4)
      : [];
    if (action === "generate_meta_from_master" && metaMasterImageUrls.length < 2) {
      sendJson(res, 400, { error: "Meta from Master needs at least two reachable Asana images." });
      return;
    }

    const metaIntelligenceBlock = buildMetaIntelligencePromptBlock(await readHistoricalIntelligence());
    const requestPayload = (() => {
      if (action === "generate_meta_from_master") {
        const { prompt, memoryReferences, sourceDesignAudit } = buildMetaFromMasterPrompt(input, metaMasterImageUrls, metaIntelligenceBlock, {
          selectedRouteId: rawInput?.selectedRouteId,
          qualityReview: rawInput?.qualityReview,
          masterVisualImages
        });
        return {
          prompt,
          memoryReferences,
          sourceDesignAudit,
          schemaName: "westpack_meta_from_master",
          schema: buildMetaFromMasterSchema()
        };
      }

      if (action === "suggest_carousel_cards") {
        const { prompt, memoryReferences } = buildCampaignCarouselSuggestionsPrompt(
          input,
          rawInput?.plan || null,
          rawInput?.metaArtifact || null,
          rawInput?.cardCount || 0,
          Array.isArray(rawInput?.cardPlan) ? rawInput.cardPlan : [],
          Array.isArray(rawInput?.carouselImages) ? rawInput.carouselImages : [],
          metaIntelligenceBlock
        );
        return {
          prompt,
          memoryReferences,
          schemaName: "westpack_campaign_carousel_cards",
          schema: buildCampaignCarouselSuggestionSchema()
        };
      }

      if (action === "generate_artifacts") {
        const { prompt, memoryReferences } = buildCampaignArtifactsPrompt(input, rawInput?.plan || null, null, metaIntelligenceBlock);
        return {
          prompt,
          memoryReferences,
          schemaName: "westpack_campaign_artifacts",
          schema: buildCampaignArtifactSchema()
        };
      }

      const { prompt, memoryReferences } = buildCampaignBrainPrompt(input);
      return {
        prompt,
        memoryReferences,
        schemaName: "westpack_campaign_brain",
        schema: buildCampaignBrainSchema()
      };
    })();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify({
        model: config.openAiModel,
        input: requestPayload.prompt,
        text: {
          format: {
            type: "json_schema",
            name: requestPayload.schemaName,
            schema: requestPayload.schema
          }
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: payload?.error?.message || "Campaign brain request failed."
      });
      return;
    }

    const parsed = JSON.parse(extractJsonText(payload));
    if (action === "generate_meta_from_master") {
      sendJson(res, 200, normalizeMetaFromMasterResult(
        input,
        parsed,
        payload.model || config.openAiModel,
        requestPayload.memoryReferences || [],
        metaMasterImageUrls,
        requestPayload.sourceDesignAudit,
        masterVisualImages
      ));
      return;
    }

    if (action === "suggest_carousel_cards") {
      sendJson(res, 200, {
        input,
        plan: rawInput?.plan || null,
        metaArtifact: rawInput?.metaArtifact || null,
        cards: Array.isArray(parsed?.cards) ? parsed.cards : [],
        primaryText: String(parsed?.primaryText || ""),
        headline: String(parsed?.headline || ""),
        description: String(parsed?.description || ""),
        cta: String(parsed?.cta || "LEARN_MORE"),
        guidance: Array.isArray(parsed?.guidance) ? parsed.guidance : [],
        memoryReferences: requestPayload.memoryReferences || [],
        model: payload.model || config.openAiModel,
        generatedAt: new Date().toISOString()
      });
      return;
    }

    if (action === "generate_artifacts") {
      const resolvedEmailImageUrls = await selectReachableCampaignEmailImages(input.assets, 4);
      sendJson(res, 200, normalizeCampaignArtifactResult(input, rawInput?.plan || null, parsed, payload.model || config.openAiModel, requestPayload.memoryReferences, resolvedEmailImageUrls));
      return;
    }

    sendJson(res, 200, normalizeCampaignBrainResult(input, parsed, payload.model || config.openAiModel, requestPayload.memoryReferences));
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Campaign brain failed."
    });
  }
};

module.exports.decodeCampaignImageDataUri = decodeCampaignImageDataUri;
