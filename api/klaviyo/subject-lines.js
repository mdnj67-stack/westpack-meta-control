// Subject line generator. `?action=` dispatch:
//
//   GET  status        - what each of the three layers holds, the taxonomy and the rules
//   POST analyse       - { templateId } -> the brief for one Danish template, plus house evidence
//   POST generate      - { templateId, analysis, note, count, attempt, avoid } -> checked candidates
//   POST check         - { subject, preview, templateId } -> the rules run over an operator's edit
//   GET  history       - layer 1 for one account: sends, A/B tests, feature stats
//   GET  bank          - layer 2, filtered
//   GET  team          - the team's favourites, bans and imported lines
//   POST team          - { op: favourite | unfavourite | ban | unban | import | remove_import, ... }
//   GET/POST sync_history - re-read Klaviyo into layer 1 (also the nightly cron)
//
// Read-only towards Klaviyo: nothing here writes a template, a campaign or a subject line back.
// The operator copies the line they choose into Klaviyo or into Duplicate & translate.

const crypto = require("crypto");
const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { fetchWithTimeout, readJsonBody, sendJson } = require("../../server/lib/http");
const { MECHANISMS, CAMPAIGN_TYPES, TONES } = require("../../server/klaviyo/subject-line-taxonomy");
const { checkSubjectLine, describeRules } = require("../../server/klaviyo/subject-line-rules");
const {
  buildHistoryInsights,
  buildHistoryView,
  summarizeHistorySnapshot,
  syncSubjectLineHistory
} = require("../../server/klaviyo/subject-line-history");
const { filterBank, loadPatternBank, parseImportedLines, selectBankExamples, summarizeBank } = require("../../server/klaviyo/subject-line-bank");
const {
  DEFAULT_CANDIDATE_COUNT,
  analyseCampaign,
  extractEmailText,
  finalizeCandidates,
  generateSubjectLines,
  tagImportedLines
} = require("../../server/klaviyo/subject-line-generator");
const {
  getHistoricalStoreProfile,
  readSubjectLineHistory,
  readSubjectLineTeam,
  writeSubjectLineHistory,
  writeSubjectLineTeam
} = require("../../server/meta/historical-store");

const TEMPLATE_API_REVISION = "2026-04-15";
const TEMPLATE_CACHE_TTL_MS = 10 * 60 * 1000;
const HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;
// The sync starts no new market after this. A market already running finishes (the largest took
// 80 seconds in full on 2026-10-27), so the snapshot is still written well inside the function's
// 300 seconds. A first full sync of all eighteen accounts takes two calls; a nightly one, one.
const SYNC_SOFT_DEADLINE_MS = 120_000;
const MAX_FAVOURITES = 500;
const MAX_IMPORTED = 3000;

const templateCache = new Map();
let historyCache = { at: 0, snapshot: null };

function parseMarkets(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error("Invalid KLAVIYO_MARKETS_JSON.");
  }
}

function isVercelCronRequest(req) {
  const cronHeader = String(req?.headers?.["x-vercel-cron"] || "").trim();
  const userAgent = String(req?.headers?.["user-agent"] || "").toLowerCase();
  return Boolean(cronHeader) || userAgent.includes("vercel-cron");
}

function isAuthorizedCronRequest(req, config = {}) {
  if (!config.cronSecret) return false;
  return String(req?.headers?.authorization || "").trim() === `Bearer ${config.cronSecret}`;
}

function hashId(prefix, ...parts) {
  return `${prefix}-${crypto.createHash("sha1").update(parts.join("\n")).digest("hex").slice(0, 10)}`;
}

async function readHistory({ fresh = false } = {}) {
  if (!fresh && historyCache.snapshot && Date.now() - historyCache.at < HISTORY_CACHE_TTL_MS) return historyCache.snapshot;
  const snapshot = await readSubjectLineHistory();
  historyCache = { at: Date.now(), snapshot };
  return snapshot;
}

async function readTeam() {
  const stored = await readSubjectLineTeam().catch(() => null);
  return {
    favourites: Array.isArray(stored?.favourites) ? stored.favourites : [],
    banned: Array.isArray(stored?.banned) ? stored.banned : [],
    imported: Array.isArray(stored?.imported) ? stored.imported : [],
    updatedAt: stored?.updatedAt || ""
  };
}

async function fetchTemplate(config, country, templateId) {
  const cacheKey = `${country}:${templateId}`;
  const cached = templateCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TEMPLATE_CACHE_TTL_MS) return cached.value;

  const market = parseMarkets(config.klaviyoMarketsJson).find((item) => String(item?.country || "").trim().toUpperCase() === country);
  if (!market?.privateKey) throw Object.assign(new Error(`No Klaviyo market configuration found for ${country}.`), { statusCode: 404 });
  const response = await fetchWithTimeout(
    `https://a.klaviyo.com/api/templates/${encodeURIComponent(templateId)}`,
    { headers: { Authorization: `Klaviyo-API-Key ${String(market.privateKey).trim()}`, Accept: "application/vnd.api+json", revision: TEMPLATE_API_REVISION } },
    15000
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload?.errors?.[0]?.detail || `Klaviyo template request failed (${response.status}).`), { statusCode: response.status });
  const attributes = payload?.data?.attributes || {};
  const value = {
    id: String(payload?.data?.id || templateId),
    country,
    name: String(attributes.name || ""),
    editorType: String(attributes.editor_type || ""),
    updated: String(attributes.updated || ""),
    emailText: extractEmailText({ html: attributes.html, text: attributes.text })
  };
  templateCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

function focusTextFor(template, analysis = {}) {
  return [
    template?.name,
    analysis.coreMessage,
    ...(analysis.products || []),
    ...(analysis.hooks || []).map((hook) => hook.hook),
    analysis.offer
  ].filter(Boolean).join(" ") || `${template?.name || ""} ${template?.emailText || ""}`;
}

function publicInsights(insights) {
  const { pastSubjects, ...rest } = insights || {};
  return rest;
}

async function handleStatus(res) {
  const [snapshot, team] = await Promise.all([readHistory(), readTeam()]);
  sendJson(res, 200, {
    store: getHistoricalStoreProfile(),
    history: summarizeHistorySnapshot(snapshot),
    bank: summarizeBank(loadPatternBank(), team.imported),
    team: { favourites: team.favourites.length, banned: team.banned.length, imported: team.imported.length, updatedAt: team.updatedAt },
    rules: describeRules(),
    taxonomy: { mechanisms: MECHANISMS, campaignTypes: CAMPAIGN_TYPES, tones: TONES }
  });
}

async function handleAnalyse(req, res, config, body) {
  const country = String(body.country || "DK").toUpperCase();
  const templateId = String(body.templateId || "").trim();
  if (!templateId) return sendJson(res, 400, { error: "Choose a template first." });
  const template = await fetchTemplate(config, country, templateId);
  if (template.emailText.length < 40) return sendJson(res, 422, { error: "The template has almost no text to analyse. Is it the right template?" });
  const snapshot = await readHistory();
  const preliminary = buildHistoryInsights(snapshot, { country, focusText: `${template.name} ${template.emailText}` });
  const { analysis, model } = await analyseCampaign({ config, templateName: template.name, emailText: template.emailText, insights: preliminary });
  const insights = buildHistoryInsights(snapshot, { country, focusText: focusTextFor(template, analysis) });
  sendJson(res, 200, {
    template: { id: template.id, country, name: template.name, editorType: template.editorType, updated: template.updated, textLength: template.emailText.length, excerpt: template.emailText.slice(0, 1200) },
    analysis,
    insights: publicInsights(insights),
    model
  });
}

async function handleGenerate(req, res, config, body) {
  const country = String(body.country || "DK").toUpperCase();
  const templateId = String(body.templateId || "").trim();
  const analysis = body.analysis && typeof body.analysis === "object" ? body.analysis : null;
  if (!templateId || !analysis) return sendJson(res, 400, { error: "Analyse the campaign before generating." });
  const [template, snapshot, team] = await Promise.all([fetchTemplate(config, country, templateId), readHistory(), readTeam()]);
  const insights = buildHistoryInsights(snapshot, { country, focusText: focusTextFor(template, analysis) });
  const attempt = Math.max(0, Number(body.attempt) || 0);
  const examples = selectBankExamples({
    imported: team.imported,
    banned: team.banned,
    analysis,
    limit: 30,
    seed: `${templateId}:${attempt}`
  });
  const { strategyNote, candidates, model } = await generateSubjectLines({
    config,
    templateName: template.name,
    emailText: template.emailText,
    analysis,
    insights,
    examples,
    favourites: team.favourites,
    banned: team.banned,
    avoid: Array.isArray(body.avoid) ? body.avoid.map(String) : [],
    note: String(body.note || "").slice(0, 600),
    count: Number(body.count) || DEFAULT_CANDIDATE_COUNT
  });
  sendJson(res, 200, {
    strategyNote,
    candidates: finalizeCandidates(candidates, { emailText: template.emailText, pastSubjects: insights.pastSubjects, examples, abTests: insights.abLessons }),
    examples: examples.map(({ id, subject, preview, mechanisms, campaignType, language, source, sender, why }) => ({ id, subject, preview, mechanisms, campaignType, language, source, sender, why })),
    senderLabel: insights.senderLabel,
    model
  });
}

async function handleCheck(req, res, config, body) {
  const country = String(body.country || "DK").toUpperCase();
  const templateId = String(body.templateId || "").trim();
  const template = templateId ? await fetchTemplate(config, country, templateId).catch(() => null) : null;
  const snapshot = await readHistory();
  const insights = buildHistoryInsights(snapshot, { country });
  const [candidate] = finalizeCandidates([{ subject: body.subject, preview: body.preview, mechanism: body.mechanism || "" }], {
    emailText: template?.emailText || "",
    pastSubjects: insights.pastSubjects
  });
  sendJson(res, 200, { candidate });
}

function handleHistory(req, res, snapshot) {
  const country = String(req.query?.country || "DK").toUpperCase();
  const view = buildHistoryView(snapshot, { country });
  const needle = String(req.query?.q || "").trim().toLowerCase();
  const sort = String(req.query?.sort || "recent");
  let entries = view.entries;
  if (needle) entries = entries.filter((entry) => `${entry.subject} ${entry.previewText} ${entry.campaignName}`.toLowerCase().includes(needle));
  if (sort === "open_index") entries = [...entries].filter((entry) => Number.isFinite(entry.openIndex)).sort((left, right) => right.openIndex - left.openIndex);
  if (sort === "click_index") entries = [...entries].filter((entry) => Number.isFinite(entry.clickIndex)).sort((left, right) => right.clickIndex - left.clickIndex);
  const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 150));
  const offset = Math.max(0, Number(req.query?.offset) || 0);
  const verdict = String(req.query?.verdict || "");
  const tests = view.abTests
    .filter((test) => test.differs !== "content")
    .filter((test) => !verdict || test.verdict === verdict)
    .filter((test) => String(req.query?.abCountry || "") ? test.country === String(req.query.abCountry).toUpperCase() : true);
  sendJson(res, 200, {
    country,
    syncedAt: view.syncedAt,
    total: entries.length,
    entries: entries.slice(offset, offset + limit),
    featureStats: view.featureStats,
    abTests: tests.slice(0, 300),
    abTestTotal: tests.length,
    abFamilies: view.abFamilies
  });
}

async function handleTeam(req, res, config, body) {
  const team = await readTeam();
  const op = String(body.op || "");
  const now = new Date().toISOString();

  if (op === "favourite") {
    const subject = String(body.subject || "").trim();
    if (!subject) return sendJson(res, 400, { error: "Nothing to save." });
    const preview = String(body.preview || "").trim();
    const id = hashId("fav", subject, preview);
    if (!team.favourites.some((item) => item.id === id)) {
      team.favourites.unshift({ id, subject, preview, mechanism: String(body.mechanism || ""), campaignName: String(body.campaignName || ""), templateId: String(body.templateId || ""), savedAt: now });
      team.favourites = team.favourites.slice(0, MAX_FAVOURITES);
    }
  } else if (op === "unfavourite") {
    team.favourites = team.favourites.filter((item) => item.id !== String(body.id || ""));
  } else if (op === "ban") {
    const id = String(body.id || "") || hashId("ban", String(body.subject || body.phrase || ""));
    if (!team.banned.some((item) => item.id === id)) {
      team.banned.unshift({ id, subject: String(body.subject || body.phrase || "").trim(), reason: String(body.reason || "").slice(0, 200), at: now });
    }
  } else if (op === "unban") {
    team.banned = team.banned.filter((item) => item.id !== String(body.id || ""));
  } else if (op === "import") {
    const rows = parseImportedLines(String(body.lines || ""));
    if (!rows.length) return sendJson(res, 400, { error: "Paste one subject line per line." });
    const sender = String(body.sender || "").trim().slice(0, 80);
    const known = new Set([...loadPatternBank(), ...team.imported].map((entry) => entry.subject.toLowerCase()));
    const fresh = rows.filter((row) => !known.has(row.subject.toLowerCase()));
    const tagged = fresh.length ? await tagImportedLines({ config, rows: fresh }) : [];
    const entries = tagged.map((row) => ({
      id: hashId("im", row.subject, row.preview),
      subject: row.subject,
      preview: row.preview,
      language: row.language,
      mechanisms: row.mechanisms,
      campaignType: row.campaignType,
      tone: row.tone,
      context: "generisk",
      translationRisk: row.translationRisk,
      why: row.why,
      source: "imported",
      sender,
      importedAt: now
    }));
    team.imported = [...entries, ...team.imported].slice(0, MAX_IMPORTED);
    await writeSubjectLineTeam({ ...team, updatedAt: now });
    return sendJson(res, 200, { added: entries.length, skipped: rows.length - entries.length, team: summarizeTeam(team) });
  } else if (op === "remove_import") {
    team.imported = team.imported.filter((item) => item.id !== String(body.id || ""));
  } else {
    return sendJson(res, 400, { error: "Unknown team operation." });
  }

  await writeSubjectLineTeam({ ...team, updatedAt: now });
  sendJson(res, 200, { team: summarizeTeam(team) });
}

function summarizeTeam(team) {
  return { favourites: team.favourites, banned: team.banned, importedCount: team.imported.length, updatedAt: team.updatedAt };
}

async function handleSync(req, res, config) {
  const markets = parseMarkets(config.klaviyoMarketsJson);
  if (!markets.length) return sendJson(res, 500, { error: "Missing Klaviyo market configuration." });
  const countries = String(req.query?.countries || "").split(",").map((value) => value.trim()).filter(Boolean);
  const existing = await readHistory({ fresh: true });
  const result = await syncSubjectLineHistory({
    markets,
    existing,
    revision: config.klaviyoRevision,
    countries,
    deadlineAt: Date.now() + SYNC_SOFT_DEADLINE_MS
  });
  if (result.synced.length || result.failed.length) {
    await writeSubjectLineHistory(result.snapshot);
    historyCache = { at: Date.now(), snapshot: result.snapshot };
  }
  sendJson(res, 200, {
    synced: result.synced,
    failed: result.failed,
    remaining: result.remaining,
    history: summarizeHistorySnapshot(result.snapshot)
  });
}

module.exports = async function handler(req, res) {
  const config = getConfig();
  const action = String(req.query?.action || "status").trim();

  try {
    if (action === "sync_history" && (isVercelCronRequest(req) || isAuthorizedCronRequest(req, config))) {
      return await handleSync(req, res, config);
    }
    if (!requireAuth(req, res, config)) return;

    if (req.method === "GET") {
      if (action === "status") return await handleStatus(res);
      if (action === "history") return handleHistory(req, res, await readHistory());
      if (action === "bank") {
        const team = await readTeam();
        return sendJson(res, 200, filterBank({
          imported: team.imported,
          mechanism: String(req.query?.mechanism || ""),
          campaignType: String(req.query?.campaignType || ""),
          language: String(req.query?.language || ""),
          source: String(req.query?.source || ""),
          query: String(req.query?.q || ""),
          limit: Math.max(1, Math.min(500, Number(req.query?.limit) || 120)),
          offset: Math.max(0, Number(req.query?.offset) || 0)
        }));
      }
      if (action === "team") return sendJson(res, 200, summarizeTeam(await readTeam()));
      if (action === "sync_history") return await handleSync(req, res, config);
      return sendJson(res, 400, { error: `Unknown action: ${action}` });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const body = await readJsonBody(req);
    if (action === "analyse") return await handleAnalyse(req, res, config, body);
    if (action === "generate") return await handleGenerate(req, res, config, body);
    if (action === "check") return await handleCheck(req, res, config, body);
    if (action === "team") return await handleTeam(req, res, config, body);
    if (action === "sync_history") return await handleSync(req, res, config);
    return sendJson(res, 400, { error: `Unknown action: ${action}` });
  } catch (error) {
    sendJson(res, Number(error?.statusCode) || 500, { error: error?.message || "Subject line request failed." });
  }
};
