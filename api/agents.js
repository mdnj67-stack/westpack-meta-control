// Agents. `?action=` dispatch:
//
//   GET  overview          - what needs a person now: the watchdog's open items, recent email checks
//   GET  watchdog          - the last watchdog run in full
//   GET  watchdog_run      - the hourly cron (CRON_SECRET only)
//   POST watchdog_run      - run every check now, from the page
//   POST watchdog_mute     - { checkId, itemKey, note } quiet one item until its state changes
//   POST watchdog_unmute   - { checkId, itemKey }
//   GET  email_checks      - recent email checks
//   GET  email_check       - { id } one check in full
//   POST email_check       - { country, templateId } or { country, html, name } -> instant checks, review started
//   POST email_check_poll  - { id } -> the review, once the model has finished
//
// Read-only towards Meta, Klaviyo and the stores. Nothing here pauses, edits, creates or sends.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getConfig } = require("../server/lib/config");
const { requireAuth } = require("../server/lib/auth");
const { fetchWithTimeout, readJsonBody, sendJson } = require("../server/lib/http");
const { ensureAccountId, graphRequest } = require("../server/lib/meta");
const { redisCommand } = require("../server/campaign/agent-store");
const {
  getHistoricalStoreProfile,
  readAgentEmailChecks,
  readAgentWatchdog,
  readNightlySnapshotTimes,
  writeAgentEmailChecks,
  writeAgentWatchdog
} = require("../server/meta/historical-store");
const { CHECKS, CHECK_DESCRIPTIONS, runWatchdog, withMute, withoutMute } = require("../server/agents/watchdog");
const { MARKET_LANGUAGE, REVIEW_SCHEMA, analyseEmailHtml, buildReviewInput, finalizeReview } = require("../server/agents/email-check");
const { readStructured, startStructured } = require("../server/klaviyo/subject-line-generator");
const { MARKETS: STORES } = require("../signup/core/markets");

const TEMPLATE_API_REVISION = "2026-04-15";
const EMAIL_CHECKS_KEPT = 30;
const MAX_PASTED_HTML_BYTES = 600 * 1024;
const SITE_FACTS_PATH = path.join(__dirname, "..", "knowledge", "westpack-site", "README.md");

function isAuthorizedCronRequest(req, config) {
  if (!config.cronSecret) return false;
  return String(req?.headers?.authorization || "").trim() === `Bearer ${config.cronSecret}`;
}

function parseMarkets(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function klaviyoCountries(config) {
  return parseMarkets(config.klaviyoMarketsJson)
    .filter((market) => market?.privateKey)
    .map((market) => String(market.country || "").trim().toUpperCase())
    .filter(Boolean);
}

function siteFacts() {
  try {
    return fs.readFileSync(SITE_FACTS_PATH, "utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------------------------
// Watchdog

function watchdogDeps(config) {
  const metaReady = Boolean(config.metaAccessToken && config.metaAdAccountId);
  return {
    // Rate limits are never retried against this account: the dashboard's own quota is shared.
    graph: metaReady ? (graphPath, params) => graphRequest(graphPath, config.metaAccessToken, { params, maxRetries: 0 }) : null,
    accountId: metaReady ? ensureAccountId(config.metaAdAccountId) : "",
    fetchImpl: (url, options) => fetch(url, options),
    stores: Object.values(STORES || {})
      .filter((store) => store?.storeUrl && store.enabled !== false)
      .map((store) => ({ code: store.market, url: store.storeUrl })),
    redisPing: () => redisCommand(["PING"]),
    readSnapshotTimes: readNightlySnapshotTimes
  };
}

function describeWatchdog(snapshot) {
  if (!snapshot) {
    return {
      empty: true,
      checks: CHECKS.map((check) => ({ id: check.id, title: check.title, cadence: check.cadence, description: CHECK_DESCRIPTIONS[check.id], status: "pending", summary: "Not run yet.", items: [] }))
    };
  }
  return {
    ...snapshot,
    checks: CHECKS.map((check) => snapshot.checks?.[check.id] || { id: check.id, title: check.title, cadence: check.cadence, description: CHECK_DESCRIPTIONS[check.id], status: "pending", summary: "Not run yet.", items: [] })
  };
}

const OPEN_STATUSES = new Set(["alert", "warn", "error"]);

function openItems(snapshot) {
  const open = [];
  for (const check of Object.values(snapshot?.checks || {})) {
    if (!check.items?.length) {
      if (OPEN_STATUSES.has(check.status)) open.push({ checkId: check.id, check: check.title, status: check.status, title: check.summary, detail: check.detail || "", checkedAt: check.checkedAt });
      continue;
    }
    for (const item of check.items) {
      if (!item.muted && OPEN_STATUSES.has(item.status)) open.push({ checkId: check.id, check: check.title, itemKey: item.key, status: item.status, title: item.title, detail: item.detail, checkedAt: check.checkedAt });
    }
  }
  const rank = { alert: 0, warn: 1, error: 2 };
  return open.sort((left, right) => rank[left.status] - rank[right.status]);
}

async function handleWatchdogRun(res, config, scope) {
  const previous = await readAgentWatchdog().catch(() => null);
  const snapshot = await runWatchdog({ deps: watchdogDeps(config), previous, scope, now: new Date() });
  await writeAgentWatchdog(snapshot);
  sendJson(res, 200, { ok: true, watchdog: describeWatchdog(snapshot) });
}

// ---------------------------------------------------------------------------------------------
// Email check

async function fetchTemplateHtml(config, country, templateId) {
  const market = parseMarkets(config.klaviyoMarketsJson).find((item) => String(item?.country || "").trim().toUpperCase() === country);
  if (!market?.privateKey) throw Object.assign(new Error(`No Klaviyo account is configured for ${country}.`), { statusCode: 400 });
  const response = await fetchWithTimeout(
    `https://a.klaviyo.com/api/templates/${encodeURIComponent(templateId)}`,
    { headers: { Authorization: `Klaviyo-API-Key ${String(market.privateKey).trim()}`, Accept: "application/vnd.api+json", revision: TEMPLATE_API_REVISION } },
    20000
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload?.errors?.[0]?.detail || `Klaviyo template request failed (${response.status}).`), { statusCode: response.status === 404 ? 404 : 502 });
  const attributes = payload?.data?.attributes || {};
  if (!attributes.html) throw Object.assign(new Error("Klaviyo returned this template without HTML."), { statusCode: 422 });
  return { html: String(attributes.html), name: String(attributes.name || ""), updated: String(attributes.updated || "") };
}

function countSeverities(findings = []) {
  return findings.reduce((counts, item) => ({ ...counts, [item.severity]: (counts[item.severity] || 0) + 1 }), { must_fix: 0, should_fix: 0, consider: 0 });
}

function publicRecord(record) {
  if (!record) return null;
  const { text, ...rest } = record;
  const all = [...(record.findings || []), ...(record.review?.findings || [])];
  return { ...rest, counts: countSeverities(all) };
}

function summaryRecord(record) {
  const full = publicRecord(record);
  return {
    id: full.id,
    createdAt: full.createdAt,
    source: full.source,
    counts: full.counts,
    review: { status: full.review?.status, verdict: full.review?.verdict || "" }
  };
}

async function readChecks() {
  const doc = await readAgentEmailChecks().catch(() => null);
  return Array.isArray(doc?.checks) ? doc.checks : [];
}

// Read-modify-write on the newest copy, so a poll that lands while a colleague starts another
// check keeps both.
async function saveCheck(record) {
  const checks = (await readChecks()).filter((item) => item.id !== record.id);
  await writeAgentEmailChecks({ version: 1, checks: [record, ...checks].slice(0, EMAIL_CHECKS_KEPT) });
}

async function handleEmailCheck(res, config, body) {
  const country = String(body.country || "DK").trim().toUpperCase();
  if (!MARKET_LANGUAGE[country]) return sendJson(res, 400, { error: `Unknown market ${country}.` });

  let source;
  let html;
  if (body.templateId) {
    const templateId = String(body.templateId).trim();
    const template = await fetchTemplateHtml(config, country, templateId);
    html = template.html;
    source = { kind: "klaviyo", country, templateId, name: template.name, updated: template.updated };
  } else {
    html = String(body.html || "");
    if (!html.trim()) return sendJson(res, 400, { error: "Choose a Klaviyo template or paste the email's HTML." });
    if (Buffer.byteLength(html, "utf8") > MAX_PASTED_HTML_BYTES) return sendJson(res, 413, { error: "That HTML is larger than 600 KB. No email that size survives Gmail; check the paste." });
    source = { kind: "pasted", country, name: String(body.name || "Pasted email").slice(0, 160) };
  }

  const analysis = analyseEmailHtml({ html, country });
  const record = {
    id: `ec_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`,
    createdAt: new Date().toISOString(),
    operator: String(body.operator || "").slice(0, 80),
    source,
    stats: analysis.stats,
    findings: analysis.findings,
    text: analysis.text,
    review: { status: "unavailable", error: "OPENAI_API_KEY is not configured, so only the instant checks ran." }
  };

  if (config.openAiApiKey) {
    try {
      const job = await startStructured(config, {
        input: buildReviewInput({ text: analysis.text, html, country, name: source.name, siteFacts: siteFacts() }),
        schemaName: "email_review",
        schema: REVIEW_SCHEMA,
        reasoningEffort: "high",
        writing: true
      });
      record.review = { status: "running", jobId: job.id, model: job.model, startedAt: new Date().toISOString() };
    } catch (error) {
      record.review = { status: "failed", error: `The review could not start: ${error.message}` };
    }
  }
  if (record.review.status !== "running") delete record.text;
  await saveCheck(record);
  sendJson(res, 200, { ok: true, check: publicRecord(record) });
}

async function handleEmailCheckPoll(res, config, body) {
  const id = String(body.id || "");
  const record = (await readChecks()).find((item) => item.id === id);
  if (!record) return sendJson(res, 404, { error: "That email check is no longer kept." });
  if (record.review?.status !== "running") return sendJson(res, 200, { ok: true, check: publicRecord(record) });

  const result = await readStructured(config, record.review.jobId);
  if (result.pending) return sendJson(res, 200, { ok: true, check: publicRecord(record) });
  if (result.failed) {
    record.review = { ...record.review, status: "failed", error: result.error, finishedAt: new Date().toISOString() };
  } else {
    record.review = { ...record.review, ...finalizeReview(result.parsed, record.text || ""), status: "done", model: result.model || record.review.model, finishedAt: new Date().toISOString() };
  }
  delete record.text;
  await saveCheck(record);
  sendJson(res, 200, { ok: true, check: publicRecord(record) });
}

// ---------------------------------------------------------------------------------------------

module.exports = async (req, res) => {
  const config = getConfig();
  const action = String(req.query?.action || "").trim().toLowerCase();

  try {
    if (action === "watchdog_run" && req.method === "GET") {
      if (!isAuthorizedCronRequest(req, config)) return sendJson(res, 401, { error: "The scheduled run needs the cron secret." });
      return await handleWatchdogRun(res, config, "auto");
    }
    if (!requireAuth(req, res, config)) return;

    if (req.method === "GET") {
      if (action === "overview") {
        const [watchdog, checks] = await Promise.all([readAgentWatchdog().catch(() => null), readChecks()]);
        return sendJson(res, 200, {
          ok: true,
          watchdog: watchdog ? { ranAt: watchdog.ranAt, lastDailyAt: watchdog.lastDailyAt, counts: watchdog.counts, checks: describeWatchdog(watchdog).checks.map(({ items, ...check }) => check), open: openItems(watchdog) } : null,
          emailChecks: checks.slice(0, 6).map(summaryRecord),
          markets: klaviyoCountries(config),
          languages: MARKET_LANGUAGE,
          store: getHistoricalStoreProfile()
        });
      }
      if (action === "watchdog") return sendJson(res, 200, { ok: true, watchdog: describeWatchdog(await readAgentWatchdog().catch(() => null)) });
      if (action === "email_checks") return sendJson(res, 200, { ok: true, checks: (await readChecks()).map(summaryRecord) });
      if (action === "email_check") {
        const record = (await readChecks()).find((item) => item.id === String(req.query?.id || ""));
        return record ? sendJson(res, 200, { ok: true, check: publicRecord(record) }) : sendJson(res, 404, { error: "That email check is no longer kept." });
      }
      return sendJson(res, 400, { error: "Unsupported Agents GET action." });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    const body = (await readJsonBody(req)) || {};
    if (action === "watchdog_run") return await handleWatchdogRun(res, config, "all");
    if (action === "watchdog_mute" || action === "watchdog_unmute") {
      const snapshot = await readAgentWatchdog();
      if (!snapshot) return sendJson(res, 404, { error: "The watchdog has not run yet." });
      const target = { checkId: String(body.checkId || ""), itemKey: String(body.itemKey || ""), note: body.note };
      const next = action === "watchdog_mute" ? withMute(snapshot, target) : withoutMute(snapshot, target);
      await writeAgentWatchdog(next);
      return sendJson(res, 200, { ok: true, watchdog: describeWatchdog(next) });
    }
    if (action === "email_check") return await handleEmailCheck(res, config, body);
    if (action === "email_check_poll") return await handleEmailCheckPoll(res, config, body);
    return sendJson(res, 400, { error: "Unsupported Agents POST action." });
  } catch (error) {
    return sendJson(res, Number(error?.statusCode) || 500, { error: error?.message || "The agent request failed." });
  }
};
