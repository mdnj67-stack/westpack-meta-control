// A thin, honest client for the Canva Connect REST API (https://api.canva.com/rest).
//
// Written against Canva's published OpenAPI spec (api version 2024-06-18). Every call in here
// corresponds to a documented endpoint; nothing scrapes, simulates a browser, or reaches into the
// Canva editor. Where Canva does not expose something - reading the text inside a design, font
// sizes, text box geometry - there is no function for it here, on purpose.
//
// Three behaviours are deliberate and worth reading before changing anything:
//
// - **Rate limits are not retried.** Canva measures them per user per minute. Retrying inside the
//   request just spends the next minute's allowance too, and this dashboard shares one Canva
//   account with the marketing team. Same rule the Meta snapshot path already follows.
// - **Async jobs are polled with exponential backoff.** Autofill and export are both job APIs.
//   Canva explicitly asks for backoff rather than a tight loop.
// - **Access tokens last four hours and refresh tokens are single use.** Every successful refresh
//   invalidates the token that bought it, so the caller must persist the new pair before using it.
//   `refreshAccessToken` returns the new pair and never writes; `token-store.js` owns persistence
//   and the lock that stops two invocations burning the same refresh token.

const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_API_BASE = "https://api.canva.com/rest";

// The smallest set that covers the whole Localizer workflow. Canva does not grant implied scopes,
// so each one has to be listed: meta:read lists and reads designs, content:read reads the dataset
// and drives exports, content:write creates the autofilled copies, profile:read reports which
// plan capabilities (notably `autofill`) the connected account actually has.
const CANVA_SCOPES = [
  "design:meta:read",
  "design:content:read",
  "design:content:write",
  "profile:read"
];

const REQUEST_TIMEOUT_MS = 30000;
const MAX_TRANSIENT_RETRIES = 2;
const JOB_POLL_INITIAL_MS = 700;
const JOB_POLL_MAX_MS = 5000;
const JOB_POLL_TIMEOUT_MS = 120000;

class CanvaApiError extends Error {
  constructor(message, { status = 0, code = "", retryAfterSeconds = 0 } = {}) {
    super(message);
    this.name = "CanvaApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get isRateLimit() {
    return this.status === 429;
  }

  // The autofill endpoints answer 403 to a user outside a Canva Enterprise organisation. That is
  // a plan fact, not a bug, and the UI has to say so rather than showing a generic failure.
  get isPlanRestriction() {
    return this.status === 403 && /forbidden|feature|enterprise|permission/i.test(`${this.code} ${this.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new CanvaApiError(`Canva request timed out after ${timeoutMs}ms`, { status: 0, code: "timeout" });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isTransientStatus(status) {
  // 429 is absent on purpose - see the header comment.
  return status === 502 || status === 503 || status === 504;
}

async function readPayload(response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 500) };
  }
}

function toApiError(response, payload) {
  const code = String(payload?.code || payload?.error || "");
  const message = String(payload?.message || payload?.error_description || "")
    || `Canva request failed (${response.status}).`;
  const retryAfterSeconds = Number(response.headers?.get?.("retry-after")) || 0;
  return new CanvaApiError(message, { status: response.status, code, retryAfterSeconds });
}

function buildAuthorizationHeader(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function buildAuthorizeUrl({ clientId = "", redirectUri = "", codeChallenge = "", state = "", scopes = CANVA_SCOPES } = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state
  });
  return `${CANVA_AUTHORIZE_URL}?${params.toString()}`;
}

async function requestTokens({ clientId, clientSecret, body }) {
  const response = await fetchWithTimeout(`${CANVA_API_BASE}/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: buildAuthorizationHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const payload = await readPayload(response);
  if (!response.ok) throw toApiError(response, payload);

  const expiresIn = Number(payload?.expires_in) || 0;
  return {
    accessToken: String(payload?.access_token || ""),
    refreshToken: String(payload?.refresh_token || ""),
    scope: String(payload?.scope || ""),
    // Stored as an absolute instant. An "expires_in" persisted as-is is meaningless the moment
    // the process that fetched it goes away, which on Vercel is immediately.
    expiresAt: new Date(Date.now() + Math.max(0, expiresIn - 1) * 1000).toISOString()
  };
}

async function exchangeAuthorizationCode({ clientId, clientSecret, code, codeVerifier, redirectUri }) {
  return requestTokens({
    clientId,
    clientSecret,
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    })
  });
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  return requestTokens({
    clientId,
    clientSecret,
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
  });
}

async function canvaRequest(path, { accessToken = "", method = "GET", body = null, query = null } = {}) {
  const url = new URL(`${CANVA_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  let attempt = 0;
  for (;;) {
    const response = await fetchWithTimeout(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (response.ok) return readPayload(response);

    const payload = await readPayload(response);
    const error = toApiError(response, payload);
    if (!isTransientStatus(response.status) || attempt >= MAX_TRANSIENT_RETRIES) throw error;

    attempt += 1;
    await sleep(400 * attempt);
  }
}

// Canva's job endpoints all answer { job: { id, status, result, error } }. Polling is shared so
// autofill and export behave identically, including the timeout - an autofill that never settles
// must surface as one failed language, not as a hung request holding the whole batch open.
async function pollJob({ accessToken, path, timeoutMs = JOB_POLL_TIMEOUT_MS }) {
  const deadline = Date.now() + timeoutMs;
  let interval = JOB_POLL_INITIAL_MS;

  for (;;) {
    const payload = await canvaRequest(path, { accessToken });
    const job = payload?.job || {};
    if (job.status === "success") return job;
    if (job.status === "failed") {
      throw new CanvaApiError(
        String(job?.error?.message || "Canva job failed."),
        { status: 0, code: String(job?.error?.code || "job_failed") }
      );
    }
    if (Date.now() > deadline) {
      throw new CanvaApiError("Canva job did not finish in time.", { status: 0, code: "job_timeout" });
    }

    await sleep(interval);
    interval = Math.min(JOB_POLL_MAX_MS, Math.round(interval * 1.6));
  }
}

async function getUserCapabilities(accessToken) {
  const payload = await canvaRequest("/v1/users/me/capabilities", { accessToken });
  return Array.isArray(payload?.capabilities) ? payload.capabilities : [];
}

async function getUserProfile(accessToken) {
  const payload = await canvaRequest("/v1/users/me/profile", { accessToken });
  return { displayName: String(payload?.display_name || "") };
}

async function listDesigns(accessToken, { query = "", continuation = "", limit = 24, ownership = "any", sortBy = "modified_descending" } = {}) {
  const payload = await canvaRequest("/v1/designs", {
    accessToken,
    query: { query, continuation, limit, ownership, sort_by: sortBy }
  });
  return {
    designs: Array.isArray(payload?.items) ? payload.items : [],
    continuation: String(payload?.continuation || "")
  };
}

async function getDesign(accessToken, designId) {
  const payload = await canvaRequest(`/v1/designs/${encodeURIComponent(designId)}`, { accessToken });
  return payload?.design || null;
}

async function getDesignPages(accessToken, designId, { offset = 1, limit = 20 } = {}) {
  const payload = await canvaRequest(`/v1/designs/${encodeURIComponent(designId)}/pages`, {
    accessToken,
    query: { offset, limit }
  });
  return Array.isArray(payload?.items) ? payload.items : [];
}

// The only window the REST API gives onto a design's text. It returns field names and types -
// { headline: { type: "text" } } - and never the text currently in them.
async function getDesignDataset(accessToken, designId) {
  const payload = await canvaRequest(`/v1/designs/${encodeURIComponent(designId)}/dataset`, { accessToken });
  return payload?.dataset && typeof payload.dataset === "object" ? payload.dataset : {};
}

// create_from_design always produces a NEW design. The source is never opened, never locked and
// never written to, which is how "never modify the original" is guaranteed structurally rather
// than by remembering not to.
async function createDesignFromDesign(accessToken, { designId, title, data }) {
  const payload = await canvaRequest("/v1/autofills", {
    accessToken,
    method: "POST",
    body: { type: "create_from_design", design_id: designId, title, data }
  });
  return payload?.job || {};
}

async function waitForAutofillJob(accessToken, jobId) {
  const job = await pollJob({ accessToken, path: `/v1/autofills/${encodeURIComponent(jobId)}` });
  return job?.result?.design || null;
}

async function createExportJob(accessToken, { designId, format = "png", width = 0, height = 0, pages = null, quality = "" }) {
  const exportFormat = { type: format === "jpg" ? "jpg" : "png" };
  if (Number(width) > 0) exportFormat.width = Math.round(Number(width));
  if (Number(height) > 0) exportFormat.height = Math.round(Number(height));
  if (exportFormat.type === "jpg") exportFormat.quality = Math.min(100, Math.max(1, Number(quality) || 90));
  if (Array.isArray(pages) && pages.length) exportFormat.pages = pages;

  const payload = await canvaRequest("/v1/exports", {
    accessToken,
    method: "POST",
    body: { design_id: designId, format: exportFormat }
  });
  return payload?.job || {};
}

async function waitForExportJob(accessToken, jobId) {
  const job = await pollJob({ accessToken, path: `/v1/exports/${encodeURIComponent(jobId)}` });
  return Array.isArray(job?.urls) ? job.urls : [];
}

async function exportDesign(accessToken, options = {}) {
  const job = await createExportJob(accessToken, options);
  if (job.status === "success" && Array.isArray(job.urls)) return job.urls;
  return waitForExportJob(accessToken, job.id);
}

module.exports = {
  CANVA_API_BASE,
  CANVA_AUTHORIZE_URL,
  CANVA_SCOPES,
  CanvaApiError,
  buildAuthorizeUrl,
  canvaRequest,
  createDesignFromDesign,
  createExportJob,
  exchangeAuthorizationCode,
  exportDesign,
  getDesign,
  getDesignDataset,
  getDesignPages,
  getUserCapabilities,
  getUserProfile,
  listDesigns,
  pollJob,
  refreshAccessToken,
  waitForAutofillJob,
  waitForExportJob
};
