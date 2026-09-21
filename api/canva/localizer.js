// Canva Localizer - the HTTP surface.
//
// One route, dispatched on `?action=`, the same shape as `api/campaign/brain.js`. The heavy
// lifting lives in `server/canva/*`; this file is transport, auth, input validation and the
// batch loop.
//
// The batch loop is the part worth understanding. Eighteen languages means eighteen OpenAI calls
// and eighteen Canva autofill jobs, each of which can take a few seconds, and a serverless
// function has a hard ceiling. So every batch action:
//
// - works through its targets one at a time and persists after each one, so a killed invocation
//   loses at most the target in flight;
// - catches per target, so one language failing leaves the other seventeen alone - a batch is
//   never all-or-nothing;
// - stops at a soft deadline well inside the platform limit and reports what is left, so the
//   client can simply call again. That is what makes the job resumable: there is no separate
//   resume path to get wrong, continuing is the same call.

const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const { recordAuditEvent } = require("../../server/campaign/audit-log");
const {
  CANVA_SCOPES,
  CanvaApiError,
  createDesignFromDesign,
  exportDesign,
  getDesign,
  getDesignDataset,
  getDesignPages,
  getUserCapabilities,
  listDesigns,
  waitForAutofillJob
} = require("../../server/canva/connect-client");
const {
  clearCanvaTokens,
  getAccessToken,
  getTokenStoreProfile,
  readCanvaTokens,
  writeCanvaTokens
} = require("../../server/canva/token-store");
const {
  buildFieldPlan,
  buildLocalizedTitle,
  createLocalizationJob,
  describeFit,
  groupMarketsByLanguage,
  listSupportedMarkets,
  normalizeLocalizationJob,
  normalizeMarketCode,
  assessTargetFit,
  selectTargetsForGeneration,
  selectTargetsForTranslation,
  summariseFieldPlan,
  summariseLocalizationJob
} = require("../../server/canva/localization");
const {
  createJobId,
  deleteLocalizationJob,
  getStoreProfile,
  listLocalizationJobs,
  readExclusionMemory,
  readLocalizationJob,
  recordExclusions,
  writeExclusionMemory,
  writeLocalizationJob
} = require("../../server/canva/localization-store");
const { translateFieldsForMarket } = require("../../server/canva/translate-fields");
const { inspectRenderedFit, proposeSourceTexts } = require("../../server/canva/design-vision");

// The function is configured for 300s in vercel.json. Stopping at 210s leaves room for the
// in-flight Canva job to finish and for the response to be written, and keeps a long batch from
// being cut off mid-write.
const SOFT_DEADLINE_MS = 210000;

// The token store is generic OAuth plumbing and knows nothing about this app's config shape, so
// the mapping from `canvaClientId` lives here rather than leaking into it.
function accessTokenFor(config) {
  return getAccessToken({ clientId: config.canvaClientId, clientSecret: config.canvaClientSecret });
}

function readMarketCodesFromConfig(config) {
  try {
    const parsed = JSON.parse(config.klaviyoMarketsJson || "[]");
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeMarketCode(entry?.country || entry)) : [];
  } catch (error) {
    return [];
  }
}

function describeCanvaError(error) {
  if (error instanceof CanvaApiError && error.isPlanRestriction) {
    return "Canva refused this call for the connected account. The Autofill API requires the user to be in a Canva Enterprise organisation.";
  }
  if (error instanceof CanvaApiError && error.isRateLimit) {
    return "Canva rate-limited this request. Wait a minute before continuing the batch.";
  }
  return String(error?.message || "Canva request failed.");
}

async function resolveConnection(config) {
  const tokens = await readCanvaTokens();
  const storeProfile = getTokenStoreProfile();
  const configured = Boolean(config.canvaClientId && config.canvaClientSecret);

  if (!tokens?.accessToken && !tokens?.refreshToken) {
    return {
      configured,
      connected: false,
      storeMode: storeProfile.mode,
      persistent: storeProfile.persistent,
      scopes: CANVA_SCOPES,
      capabilities: [],
      canAutofill: false,
      displayName: "",
      connectedAt: ""
    };
  }

  return {
    configured,
    connected: true,
    storeMode: storeProfile.mode,
    persistent: storeProfile.persistent,
    scopes: (tokens.scope || CANVA_SCOPES.join(" ")).split(/\s+/).filter(Boolean),
    capabilities: tokens.capabilities || [],
    // The single fact that decides whether this feature can do its job at all. Autofill - the
    // only way to write text into a design over REST - is gated on Canva Enterprise, so it is
    // reported from the account's own capability list rather than assumed.
    canAutofill: (tokens.capabilities || []).includes("autofill"),
    displayName: tokens.displayName || "",
    connectedAt: tokens.connectedAt || ""
  };
}

function requireConnected(connection, res) {
  if (!connection.configured) {
    sendJson(res, 400, { error: "Canva is not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET, then reload." });
    return false;
  }
  if (!connection.connected) {
    sendJson(res, 400, { error: "Canva is not connected. Use Connect Canva first." });
    return false;
  }
  return true;
}

function jobResponse(job, extra = {}) {
  return { job, summary: summariseLocalizationJob(job), ...extra };
}

async function handleStatus(req, res, config) {
  const connection = await resolveConnection(config);
  const [jobs, exclusions] = await Promise.all([listLocalizationJobs(12), readExclusionMemory()]);
  sendJson(res, 200, {
    connection,
    jobStore: getStoreProfile(),
    markets: listSupportedMarkets(readMarketCodesFromConfig(config)),
    exclusions,
    jobs,
    translationConfigured: Boolean(config.openAiApiKey),
    generatedAt: new Date().toISOString()
  });
}

async function handleListDesigns(req, res, config, url) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;

  const accessToken = await accessTokenFor(config);
  const result = await listDesignsSafely(accessToken, {
    query: url.searchParams.get("query") || "",
    continuation: url.searchParams.get("continuation") || ""
  });
  sendJson(res, 200, result);
}

async function listDesignsSafely(accessToken, options) {
  const { designs, continuation } = await listDesigns(accessToken, options);
  return {
    designs: designs.map((design) => ({
      id: design.id,
      title: design.title || "Untitled design",
      thumbnailUrl: design.thumbnail?.url || "",
      width: design.thumbnail?.width || 0,
      height: design.thumbnail?.height || 0,
      pageCount: design.page_count || 0,
      designTypes: design.design_types || [],
      editUrl: design.urls?.edit_url || "",
      viewUrl: design.urls?.view_url || "",
      updatedAt: design.updated_at ? new Date(design.updated_at * 1000).toISOString() : ""
    })),
    continuation
  };
}

// Everything the "choose a design" step needs in one round trip: the design's metadata, its page
// thumbnails, and the data fields Canva will let us write. The plan comes back with the
// recurring exclusions already applied, so a brand line the operator unticked last month arrives
// unticked.
async function handleInspectDesign(req, res, config, url) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;

  const designId = String(url.searchParams.get("designId") || "").trim();
  if (!designId) {
    sendJson(res, 400, { error: "A Canva design id is required." });
    return;
  }

  const accessToken = await accessTokenFor(config);
  const design = await getDesign(accessToken, designId);
  if (!design) {
    sendJson(res, 404, { error: "That Canva design could not be read." });
    return;
  }

  const [dataset, pages, exclusions] = await Promise.all([
    getDesignDataset(accessToken, designId).catch(() => ({})),
    getDesignPages(accessToken, designId, { limit: 12 }).catch(() => []),
    readExclusionMemory()
  ]);

  const fields = buildFieldPlan({ dataset, exclusions });
  sendJson(res, 200, {
    design: {
      id: design.id,
      title: design.title || "Untitled design",
      thumbnailUrl: design.thumbnail?.url || "",
      width: design.thumbnail?.width || 0,
      height: design.thumbnail?.height || 0,
      pageCount: design.page_count || 0,
      designTypes: design.design_types || [],
      editUrl: design.urls?.edit_url || "",
      viewUrl: design.urls?.view_url || ""
    },
    pages: pages.map((page, index) => ({
      index: page.index ?? index + 1,
      thumbnailUrl: page.thumbnail?.url || ""
    })),
    dataset,
    fields,
    fieldSummary: summariseFieldPlan(fields),
    // Said plainly rather than left for the operator to infer from an empty table: a design with
    // no tagged fields is not broken, it just has not been prepared in Canva yet.
    tagged: Object.keys(dataset).length > 0
  });
}

async function handleReadSourceText(req, res, config, body) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;
  if (!config.openAiApiKey) {
    sendJson(res, 400, { error: "OpenAI is not configured, so text cannot be read from the design." });
    return;
  }

  const designId = String(body?.designId || "").trim();
  const fieldKeys = Array.isArray(body?.fieldKeys) ? body.fieldKeys.map((key) => String(key)) : [];
  if (!designId || !fieldKeys.length) {
    sendJson(res, 400, { error: "A design id and at least one field are required." });
    return;
  }

  const accessToken = await accessTokenFor(config);
  const proposal = await proposeSourceTexts({ config, accessToken, designId, fieldKeys });
  sendJson(res, 200, {
    ...proposal,
    // Labelled at the boundary so the UI cannot present it as an API read. Canva does not expose
    // the text in a design; this was read off a rendered picture of it.
    source: "ocr",
    disclaimer: "Read from a rendered export of the design, not from Canva's API. Check it before generating."
  });
}

async function handleSaveJob(req, res, config, body) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;

  const designId = String(body?.designId || "").trim();
  if (!designId) {
    sendJson(res, 400, { error: "A Canva design id is required." });
    return;
  }

  const existing = body?.jobId ? await readLocalizationJob(body.jobId) : null;
  const fields = (Array.isArray(body?.fields) ? body.fields : []).map((field) => ({
    key: String(field?.key || ""),
    type: String(field?.type || "text"),
    sourceText: String(field?.sourceText || ""),
    translate: field?.translate !== false,
    budget: Number(field?.budget) || 0,
    excludedBy: String(field?.excludedBy || "")
  })).filter((field) => field.key);

  const marketCodes = Array.isArray(body?.marketCodes) ? body.marketCodes : [];
  const base = existing || createLocalizationJob({
    id: createJobId(designId),
    sourceDesignId: designId,
    sourceDesignTitle: String(body?.designTitle || ""),
    baseTitle: String(body?.baseTitle || body?.designTitle || ""),
    sourceLanguage: String(body?.sourceLanguage || "Danish"),
    marketCodes,
    operator: String(body?.operator || "")
  });

  // Editing an existing job keeps every target that is still wanted, with its translation and
  // its generated design intact. Rebuilding the target list wholesale would throw away designs
  // that already exist in Canva and leave them orphaned there.
  const wanted = listSupportedMarkets(marketCodes).map((market) => market.marketCode);
  const keptTargets = base.targets.filter((target) => wanted.includes(target.marketCode));
  const addedTargets = wanted
    .filter((code) => !keptTargets.some((target) => target.marketCode === code))
    .map((code) => ({ marketCode: code }));

  const job = await writeLocalizationJob({
    ...base,
    sourceDesignId: designId,
    sourceDesignTitle: String(body?.designTitle || base.sourceDesignTitle),
    baseTitle: String(body?.baseTitle || base.baseTitle || body?.designTitle || ""),
    sourceLanguage: String(body?.sourceLanguage || base.sourceLanguage),
    operator: String(body?.operator || base.operator),
    fields: fields.length ? fields : base.fields,
    targets: [...keptTargets, ...addedTargets]
  });

  const exclusions = await recordExclusions(job.fields);
  sendJson(res, 200, jobResponse(job, { exclusions, fieldSummary: summariseFieldPlan(job.fields) }));
}

async function handleTranslate(req, res, config, body) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;
  if (!config.openAiApiKey) {
    sendJson(res, 400, { error: "OpenAI is not configured, so nothing can be translated." });
    return;
  }

  let job = await readLocalizationJob(body?.jobId);
  if (!job) {
    sendJson(res, 404, { error: "That localization job no longer exists." });
    return;
  }

  const targets = selectTargetsForTranslation(job, {
    marketCodes: body?.marketCodes || [],
    includeTranslated: body?.retranslate === true
  });
  if (!targets.length) {
    sendJson(res, 200, jobResponse(job, { processed: 0, remaining: 0, note: "Every selected market is already translated." }));
    return;
  }

  // One translation per language, reused by every market that speaks it. UK, US and EU share
  // English; translating it three times would cost three times as much and produce three
  // slightly different headlines.
  const groups = groupMarketsByLanguage(targets.map((target) => target.marketCode));
  const startedAt = Date.now();
  let processed = 0;
  let remaining = 0;

  for (const group of groups) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      remaining += group.markets.length;
      continue;
    }

    try {
      const result = await translateFieldsForMarket({
        config,
        fields: job.fields,
        sourceLanguage: job.sourceLanguage,
        targetLanguage: group.language,
        marketCode: group.markets[0],
        designTitle: job.sourceDesignTitle,
        operatorNote: String(body?.operatorNote || "")
      });

      // A translation that comes back with nothing in it must not be recorded as done. It would
      // pass silently into generation, produce no autofill data, and Canva would happily create
      // eighteen copies of the Danish original under German names.
      if (!Object.keys(result.fields).length) {
        throw new Error(result.notes[0] || "The translation returned no fields.");
      }

      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((target) => {
          if (!group.markets.includes(target.marketCode)) return target;
          return {
            ...target,
            state: "translated",
            translatedFields: result.fields,
            fieldFits: result.fieldFits,
            fit: assessTargetFit(result.fieldFits),
            title: buildLocalizedTitle(job.baseTitle, target.marketCode),
            error: "",
            updatedAt: new Date().toISOString()
          };
        }),
        notes: [...job.notes, ...result.notes.map((note) => `${group.language}: ${note}`)]
      });
      processed += group.markets.length;
    } catch (error) {
      // One language failing is one language failing. The rest of the batch continues, and the
      // failure is recorded on the target so the review screen can offer a retry for exactly
      // that language.
      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((target) => (group.markets.includes(target.marketCode)
          ? { ...target, error: String(error?.message || "Translation failed."), updatedAt: new Date().toISOString() }
          : target))
      });
    }

    job = await writeLocalizationJob(job);
  }

  sendJson(res, 200, jobResponse(job, { processed, remaining }));
}

async function handleGenerate(req, res, config, body) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;
  if (!connection.canAutofill) {
    // Refused up front rather than after eighteen failures. This is the one capability the whole
    // feature depends on and the account either has it or does not.
    sendJson(res, 400, {
      error: "The connected Canva account cannot use the Autofill API. Canva restricts it to members of a Canva Enterprise organisation.",
      capability: "autofill",
      capabilities: connection.capabilities
    });
    return;
  }

  let job = await readLocalizationJob(body?.jobId);
  if (!job) {
    sendJson(res, 404, { error: "That localization job no longer exists." });
    return;
  }

  const targets = selectTargetsForGeneration(job, {
    marketCodes: body?.marketCodes || [],
    regenerate: body?.regenerate === true
  });
  if (!targets.length) {
    sendJson(res, 200, jobResponse(job, { processed: 0, remaining: 0, note: "Nothing is waiting to be generated." }));
    return;
  }

  const accessToken = await accessTokenFor(config);
  const startedAt = Date.now();
  let processed = 0;
  let remaining = 0;
  let generatedThisRun = 0;

  for (const target of targets) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      remaining += 1;
      continue;
    }

    const title = target.title || buildLocalizedTitle(job.baseTitle, target.marketCode);
    try {
      const data = Object.fromEntries(
        Object.entries(target.translatedFields || {}).map(([key, text]) => [key, { type: "text", text }])
      );
      const autofillJob = await createDesignFromDesign(accessToken, {
        designId: job.sourceDesignId,
        title,
        data
      });
      const design = autofillJob.status === "success" && autofillJob.result?.design
        ? autofillJob.result.design
        : await waitForAutofillJob(accessToken, autofillJob.id);

      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((entry) => (entry.marketCode === target.marketCode
          ? {
            ...entry,
            state: "generated",
            title,
            designId: design?.id || "",
            designUrl: design?.urls?.view_url || "",
            editUrl: design?.urls?.edit_url || "",
            thumbnailUrl: design?.thumbnail?.url || "",
            attempts: entry.attempts + 1,
            error: "",
            updatedAt: new Date().toISOString()
          }
          : entry))
      });
      processed += 1;
      generatedThisRun += 1;
    } catch (error) {
      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((entry) => (entry.marketCode === target.marketCode
          ? {
            ...entry,
            state: "failed",
            attempts: entry.attempts + 1,
            error: describeCanvaError(error),
            updatedAt: new Date().toISOString()
          }
          : entry))
      });
    }

    job = await writeLocalizationJob(job);
  }

  if (generatedThisRun > 0) {
    // Recorded after the fact and never allowed to fail the action: by the time this runs the
    // designs exist in Canva, so throwing here would tell the operator their batch failed when
    // it did not.
    await recordAuditEvent("canva_versions_generated", {
      campaignKey: job.sourceDesignId,
      campaignTitle: job.baseTitle,
      operator: job.operator,
      jobId: job.id,
      reference: job.sourceDesignId,
      target: "canva",
      note: `${generatedThisRun} language version(s) created from the source design.`
    });
  }

  sendJson(res, 200, jobResponse(job, { processed, remaining }));
}

async function handleExport(req, res, config, body) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;

  let job = await readLocalizationJob(body?.jobId);
  if (!job) {
    sendJson(res, 404, { error: "That localization job no longer exists." });
    return;
  }

  const requested = new Set((body?.marketCodes || []).map((code) => normalizeMarketCode(code)));
  const format = body?.format === "jpg" ? "jpg" : "png";
  const width = Number(body?.width) || 0;
  const targets = job.targets.filter((target) => target.state === "generated"
    && target.designId
    && (!requested.size || requested.has(target.marketCode)));

  if (!targets.length) {
    sendJson(res, 400, { error: "There are no generated designs to export yet." });
    return;
  }

  const accessToken = await accessTokenFor(config);
  const startedAt = Date.now();
  let processed = 0;
  let remaining = 0;

  for (const target of targets) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      remaining += 1;
      continue;
    }
    try {
      const urls = await exportDesign(accessToken, { designId: target.designId, format, width });
      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((entry) => (entry.marketCode === target.marketCode
          ? {
            ...entry,
            exportUrls: urls,
            exportFormat: format,
            // Canva's download links die after 24 hours. Storing when they were made is the
            // only way the UI can tell an operator that yesterday's links are gone rather than
            // handing them a dead link.
            exportedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          : entry))
      });
      processed += 1;
    } catch (error) {
      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((entry) => (entry.marketCode === target.marketCode
          ? { ...entry, error: describeCanvaError(error), updatedAt: new Date().toISOString() }
          : entry))
      });
    }
    job = await writeLocalizationJob(job);
  }

  sendJson(res, 200, jobResponse(job, { processed, remaining, format }));
}

async function handleInspectFit(req, res, config, body) {
  const connection = await resolveConnection(config);
  if (!requireConnected(connection, res)) return;
  if (!config.openAiApiKey) {
    sendJson(res, 400, { error: "OpenAI is not configured, so the rendered design cannot be inspected." });
    return;
  }

  let job = await readLocalizationJob(body?.jobId);
  if (!job) {
    sendJson(res, 404, { error: "That localization job no longer exists." });
    return;
  }

  const requested = new Set((body?.marketCodes || []).map((code) => normalizeMarketCode(code)));
  const targets = job.targets.filter((target) => target.state === "generated"
    && target.designId
    && (!requested.size || requested.has(target.marketCode)));
  if (!targets.length) {
    sendJson(res, 400, { error: "There are no generated designs to inspect yet." });
    return;
  }

  const accessToken = await accessTokenFor(config);
  const startedAt = Date.now();
  let processed = 0;
  let remaining = 0;

  for (const target of targets) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      remaining += 1;
      continue;
    }
    try {
      const visualCheck = await inspectRenderedFit({
        config,
        accessToken,
        designId: target.designId,
        expectedTexts: target.translatedFields
      });
      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((entry) => (entry.marketCode === target.marketCode
          ? { ...entry, visualCheck, updatedAt: new Date().toISOString() }
          : entry))
      });
      processed += 1;
    } catch (error) {
      job = normalizeLocalizationJob({
        ...job,
        targets: job.targets.map((entry) => (entry.marketCode === target.marketCode
          ? { ...entry, visualCheck: { verdict: "unknown", summary: describeCanvaError(error), problems: [] } }
          : entry))
      });
    }
    job = await writeLocalizationJob(job);
  }

  sendJson(res, 200, jobResponse(job, { processed, remaining }));
}

async function handleJob(req, res, url) {
  const job = await readLocalizationJob(url.searchParams.get("jobId") || "");
  if (!job) {
    sendJson(res, 404, { error: "That localization job no longer exists." });
    return;
  }
  sendJson(res, 200, jobResponse(job, { fitSummary: job.targets.map((target) => describeFit(target.fit)) }));
}

module.exports = async (req, res) => {
  const config = getConfig();
  if (!requireAuth(req, res, config)) return;

  const url = new URL(req.url, "http://localhost");
  const action = String(url.searchParams.get("action") || "status");
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      if (action === "status") return await handleStatus(req, res, config);
      if (action === "designs") return await handleListDesigns(req, res, config, url);
      if (action === "design") return await handleInspectDesign(req, res, config, url);
      if (action === "job") return await handleJob(req, res, url);
      sendJson(res, 400, { error: `Unknown Canva Localizer action: ${action}` });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readJsonBody(req);
    if (action === "read_source_text") return await handleReadSourceText(req, res, config, body);
    if (action === "save_job") return await handleSaveJob(req, res, config, body);
    if (action === "translate") return await handleTranslate(req, res, config, body);
    if (action === "generate") return await handleGenerate(req, res, config, body);
    if (action === "export") return await handleExport(req, res, config, body);
    if (action === "inspect_fit") return await handleInspectFit(req, res, config, body);
    if (action === "exclusions") {
      const exclusions = await writeExclusionMemory(body?.exclusions || {});
      sendJson(res, 200, { exclusions });
      return;
    }
    if (action === "delete_job") {
      await deleteLocalizationJob(body?.jobId);
      sendJson(res, 200, { deleted: true, jobs: await listLocalizationJobs(12) });
      return;
    }
    if (action === "disconnect") {
      await clearCanvaTokens();
      sendJson(res, 200, { connection: await resolveConnection(config) });
      return;
    }
    if (action === "refresh_capabilities") {
      const accessToken = await accessTokenFor(config);
      const capabilities = await getUserCapabilities(accessToken);
      const tokens = await readCanvaTokens();
      await writeCanvaTokens({ ...tokens, capabilities });
      sendJson(res, 200, { connection: await resolveConnection(config) });
      return;
    }

    sendJson(res, 400, { error: `Unknown Canva Localizer action: ${action}` });
  } catch (error) {
    sendJson(res, 500, { error: describeCanvaError(error) });
  }
};
