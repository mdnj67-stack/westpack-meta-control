// Subject line generator. `?action=` dispatch:
//
//   GET  status        - what each of the three layers holds, the taxonomy and the rules
//   POST analyse       - { templateId } -> the brief for one Danish template, plus house evidence
//   POST generate      - { templateId, analysis, note, count, attempt, avoid } -> checked candidates
//   POST check         - { subject, preview, templateId } -> the rules run over an operator's edit
//   GET  history       - layer 1 for one account: sends, A/B tests, feature stats
//   GET  bank          - layer 2, filtered
//   GET  team          - the team's favourites, bans and imported lines
//   POST team          - { op: favourite | unfavourite | ban | unban | import | remove_import | record_use, ... }
//   POST preview_markets - { subject, preview } -> the pair as it would read in the other markets
//   GET/POST sync_history - re-read Klaviyo into layer 1 (also the nightly cron), then tag new lines
//   GET/POST tag_history  - tag Westpack's own lines with mechanisms, for the A/B record per mechanism
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
const { relevanceToBrief } = require("../../server/klaviyo/subject-line-semantic");
const { buildMechanismEvidence, selectUntagged, tagHistoryRows } = require("../../server/klaviyo/subject-line-mechanisms");
const { buildGeneratorOutcomes } = require("../../server/klaviyo/subject-line-outcomes");
const {
  DEFAULT_CANDIDATE_COUNT,
  analyseCampaign,
  extractEmailText,
  buildEditingRequest,
  buildWritingRequest,
  finalizeCandidates,
  readEditing,
  readStructured,
  readWriting,
  startStructured,
  previewInMarkets,
  resolvePicks,
  tagImportedLines
} = require("../../server/klaviyo/subject-line-generator");
const {
  getHistoricalStoreProfile,
  readSubjectLineHistory,
  readSubjectLineTags,
  readSubjectLineTeam,
  writeSubjectLineHistory,
  writeSubjectLineTags,
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
const MAX_USED = 2000;
// Tagging calls the model; a nightly sync tags what is new, a manual run catches up in chunks.
const TAG_LIMIT_NIGHTLY = 200;
const TAG_LIMIT_MANUAL = 600;
const TAG_TIME_BUDGET_MS = 150_000;

const templateCache = new Map();
// Writing is two writers on medium reasoning and then an editor on high: in a blind comparison on
// three live campaigns (2026-10-28) it ranked first overall, ahead of one writer on high and well
// ahead of one on low. Both run as OpenAI background jobs the screen polls, because the editor
// sometimes needs longer than a function's 300 seconds - and the user would rather wait than get
// weaker lines (see startStructured).
const WRITERS = 2;
const WRITER_EFFORT = "medium";
const EDITOR_EFFORT = "high";
const MAX_DRAFTS = 60;
const JOB_ID = /^resp_[A-Za-z0-9_-]{8,}$/;
let historyCache = { at: 0, snapshot: null };
let tagsCache = { at: 0, tags: null };

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

async function readTags({ fresh = false } = {}) {
  if (!fresh && tagsCache.tags && Date.now() - tagsCache.at < HISTORY_CACHE_TTL_MS) return tagsCache.tags;
  const stored = await readSubjectLineTags().catch(() => null);
  const tags = stored?.tags && typeof stored.tags === "object" ? stored.tags : {};
  tagsCache = { at: Date.now(), tags };
  return tags;
}

async function readTeam() {
  const stored = await readSubjectLineTeam().catch(() => null);
  return {
    favourites: Array.isArray(stored?.favourites) ? stored.favourites : [],
    banned: Array.isArray(stored?.banned) ? stored.banned : [],
    imported: Array.isArray(stored?.imported) ? stored.imported : [],
    used: Array.isArray(stored?.used) ? stored.used : [],
    updatedAt: stored?.updatedAt || ""
  };
}

// The A/B record per mechanism and the generator's own record, both read off the same history.
function evidenceFor(snapshot, tags, team, country = "DK") {
  const view = buildHistoryView(snapshot, { country });
  return {
    mechanismEvidence: buildMechanismEvidence({ abTests: view.abTests, dkEntries: view.entries, tags }),
    generatorOutcomes: buildGeneratorOutcomes({ used: team.used, dkEntries: view.entries })
  };
}

async function tagNewLines(config, snapshot, { limit, deadlineAt = Date.now() + TAG_TIME_BUDGET_MS } = {}) {
  const view = buildHistoryView(snapshot, { country: "DK" });
  const tags = { ...(await readTags({ fresh: true })) };
  const rows = selectUntagged({ abTests: view.abTests, dkEntries: view.entries, tags, limit });
  let tagged = 0;
  for (let start = 0; start < rows.length && Date.now() < deadlineAt; start += 200) {
    const fresh = await tagHistoryRows({ config, rows: rows.slice(start, start + 200) });
    Object.assign(tags, fresh);
    tagged += Object.keys(fresh).length;
  }
  if (tagged) {
    await writeSubjectLineTags({ updatedAt: new Date().toISOString(), tags });
    tagsCache = { at: Date.now(), tags };
  }
  const remaining = selectUntagged({ abTests: view.abTests, dkEntries: view.entries, tags, limit: 100000 }).length;
  return { tagged, remaining, total: Object.keys(tags).length };
}

// "Analyse" always reads the template fresh: an operator who just fixed a line in Klaviyo and
// analyses again must not get the version from ten minutes ago. Generate and check reuse it.
async function fetchTemplate(config, country, templateId, { fresh = false } = {}) {
  const cacheKey = `${country}:${templateId}`;
  const cached = templateCache.get(cacheKey);
  if (!fresh && cached && Date.now() - cached.at < TEMPLATE_CACHE_TTL_MS) return cached.value;

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
  const [snapshot, team, tags] = await Promise.all([readHistory(), readTeam(), readTags()]);
  const { mechanismEvidence, generatorOutcomes } = evidenceFor(snapshot, tags, team);
  sendJson(res, 200, {
    store: getHistoricalStoreProfile(),
    history: summarizeHistorySnapshot(snapshot),
    mechanisms: { headToHeads: mechanismEvidence.headToHeads, coverage: mechanismEvidence.coverage },
    generator: { recorded: generatorOutcomes.recorded, sent: generatorOutcomes.sent, medianOpenIndex: generatorOutcomes.medianOpenIndex },
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
  const template = await fetchTemplate(config, country, templateId, { fresh: true });
  if (template.emailText.length < 40) return sendJson(res, 422, { error: "The template has almost no text to analyse. Is it the right template?" });
  const [snapshot, tags, team] = await Promise.all([readHistory(), readTags(), readTeam()]);
  const evidence = evidenceFor(snapshot, tags, team, country);
  const preliminary = { ...buildHistoryInsights(snapshot, { country, focusText: `${template.name} ${template.emailText}` }), ...evidence };
  const { analysis, model } = await analyseCampaign({ config, templateName: template.name, emailText: template.emailText, insights: preliminary });
  const insights = {
    ...buildHistoryInsights(snapshot, { country, focusText: focusTextFor(template, analysis) }),
    mechanismEvidence: evidence.mechanismEvidence,
    generatorOutcomes: { ...evidence.generatorOutcomes, rows: evidence.generatorOutcomes.rows.filter((row) => row.sent).slice(0, 20) }
  };
  sendJson(res, 200, {
    template: { id: template.id, country, name: template.name, editorType: template.editorType, updated: template.updated, textLength: template.emailText.length, excerpt: template.emailText.slice(0, 1200) },
    analysis,
    insights: publicInsights(insights),
    model
  });
}

// What every step of a writing run needs to know about it. The browser sends it with each request,
// so no step depends on another having run on the same server.
function readBrief(body = {}) {
  return {
    country: String(body.country || "DK").toUpperCase(),
    templateId: String(body.templateId || "").trim(),
    analysis: body.analysis && typeof body.analysis === "object" ? body.analysis : null,
    count: Number(body.count) || DEFAULT_CANDIDATE_COUNT,
    note: String(body.note || "").slice(0, 600),
    avoid: Array.isArray(body.avoid) ? body.avoid.map(String).slice(0, 200) : []
  };
}

function readDrafts(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_DRAFTS)
    .map((draft) => ({
      subject: String(draft?.subject || "").slice(0, 200),
      preview: String(draft?.preview || "").slice(0, 300),
      mechanism: String(draft?.mechanism || ""),
      secondaryMechanism: String(draft?.secondaryMechanism || ""),
      translationRisk: String(draft?.translationRisk || ""),
      translationNote: String(draft?.translationNote || "").slice(0, 300),
      rationale: String(draft?.rationale || "").slice(0, 400),
      evidence: (Array.isArray(draft?.evidence) ? draft.evidence : []).filter((item) => item?.id).map(({ id, kind, label }) => ({ id: String(id), kind: String(kind || ""), label: String(label || "") }))
    }))
    .filter((draft) => draft.subject);
}

// Only what describing a cited bank line needs.
function readExamples(list) {
  return (Array.isArray(list) ? list : []).slice(0, 100)
    .filter((entry) => entry?.id)
    .map((entry) => ({ id: String(entry.id), subject: String(entry.subject || ""), source: String(entry.source || ""), sender: String(entry.sender || "") }));
}

async function readContext(config, brief) {
  const [template, snapshot] = await Promise.all([fetchTemplate(config, brief.country, brief.templateId), readHistory()]);
  return { template, insights: buildHistoryInsights(snapshot, { country: brief.country, focusText: focusTextFor(template, brief.analysis) }) };
}

// Starts the two writers and answers at once; the screen polls for them.
async function handleGenerate(req, res, config, body) {
  const brief = readBrief(body);
  if (!brief.templateId || !brief.analysis) return sendJson(res, 400, { error: "Analyse the campaign before generating." });
  const { templateId, analysis } = brief;
  const [template, snapshot, team, tags] = await Promise.all([fetchTemplate(config, brief.country, templateId), readHistory(), readTeam(), readTags()]);
  const insights = { ...buildHistoryInsights(snapshot, { country: brief.country, focusText: focusTextFor(template, analysis) }), ...evidenceFor(snapshot, tags, team, brief.country) };
  const attempt = Math.max(0, Number(body.attempt) || 0);
  const relevance = await relevanceToBrief(config, { bank: loadPatternBank(), analysis, extra: team.imported });
  // Two writers, each shown different lines from the bank, so the editor has two takes to choose
  // from rather than one take twice. "Write new ones" moves both on to lines not shown before.
  const exampleSets = Array.from({ length: WRITERS }, (_, writer) => selectBankExamples({
    imported: team.imported,
    banned: team.banned,
    analysis,
    limit: 24,
    seed: `${templateId}:${attempt}:${writer}`,
    relevance,
    attempt: attempt * WRITERS + writer
  }));
  const started = await Promise.allSettled(exampleSets.map((examples) => startStructured(config, buildWritingRequest({
    templateName: template.name,
    emailText: template.emailText,
    analysis,
    insights,
    examples,
    favourites: team.favourites,
    banned: team.banned,
    avoid: brief.avoid,
    note: brief.note,
    count: brief.count,
    reasoningEffort: WRITER_EFFORT
  }))));
  const jobs = started.filter((item) => item.status === "fulfilled").map((item) => item.value.id);
  if (!jobs.length) throw started[0].reason;
  const examples = [...new Map(exampleSets.flat().map((entry) => [entry.id, entry])).values()];
  sendJson(res, 200, {
    stage: "writing",
    jobs,
    examples: examples.map(({ id, subject, preview, mechanisms, campaignType, language, source, sender, why }) => ({ id, subject, preview, mechanisms, campaignType, language, source, sender, why })),
    senderLabel: insights.senderLabel,
    retrieval: relevance ? "semantic" : "tags"
  });
}

// Starts the editor over the writers' drafts.
async function handleEdit(req, res, config, body) {
  const brief = readBrief(body);
  const drafts = readDrafts(body.drafts);
  if (!brief.templateId || !brief.analysis || !drafts.length) return sendJson(res, 400, { error: "Nothing to edit: write the drafts first." });
  const [{ template, insights }, team] = await Promise.all([readContext(config, brief), readTeam()]);
  // The rules' verdict on each draft is worked out here again, not taken from the browser.
  const checked = finalizeCandidates(drafts, { emailText: template.emailText, pastSubjects: insights.pastSubjects, abTests: insights.abLessons })
    .map((candidate) => ({ ...candidate, evidence: drafts[Number(candidate.id.slice(1)) - 1].evidence }));
  const job = await startStructured(config, buildEditingRequest({
    templateName: template.name,
    emailText: template.emailText,
    analysis: brief.analysis,
    insights,
    drafts: checked,
    banned: team.banned,
    avoid: brief.avoid,
    note: brief.note,
    count: brief.count,
    reasoningEffort: EDITOR_EFFORT
  }));
  sendJson(res, 200, { stage: "editing", jobs: [job.id] });
}

// The screen asks every few seconds. While a job runs this is two quick reads from OpenAI; only a
// finished job reads the template and the history to check its lines against the rules.
async function handlePoll(req, res, config, body) {
  const kind = body.kind === "edit" ? "edit" : "write";
  const jobs = (Array.isArray(body.jobs) ? body.jobs : []).map(String).filter((id) => JOB_ID.test(id)).slice(0, WRITERS);
  const brief = readBrief(body);
  if (!jobs.length || !brief.templateId || !brief.analysis) return sendJson(res, 400, { error: "Nothing to wait for." });
  const states = await Promise.all(jobs.map((id) => readStructured(config, id)));
  if (states.some((state) => state.pending)) return sendJson(res, 200, { done: false, statuses: states.map((state) => state.status) });
  const { template, insights } = await readContext(config, brief);

  if (kind === "write") {
    // One writer failing still leaves the editor a full set of drafts to work from.
    const written = states.filter((state) => state.status === "completed").map((state) => ({ ...readWriting(state.parsed), model: state.model }));
    if (!written.length) throw new Error(states[0].error || "The writers did not finish.");
    const drafts = finalizeCandidates(written.flatMap((item) => item.candidates), { emailText: template.emailText, pastSubjects: insights.pastSubjects, examples: readExamples(body.examples), abTests: insights.abLessons });
    // The first writer's numbering is the first stretch of the combined list, so its picks still
    // point at its own lines. They are what the screen shows if the editor does not finish.
    return sendJson(res, 200, {
      done: true,
      ...resolvePicks({ picks: written[0].picks, abTest: written[0].abTest, candidates: drafts }),
      candidates: drafts,
      writers: written.length,
      senderLabel: insights.senderLabel,
      model: written[0].model
    });
  }

  const [state] = states;
  if (state.failed) throw new Error(state.error);
  const drafts = readDrafts(body.drafts);
  const edited = readEditing(state.parsed, drafts);
  const finalized = finalizeCandidates(edited.candidates, { emailText: template.emailText, pastSubjects: insights.pastSubjects, abTests: insights.abLessons });
  // A cited bank line keeps the label its draft already carried.
  const draftEvidence = new Map(drafts.flatMap((draft) => draft.evidence).map((item) => [item.id, item]));
  for (const candidate of finalized) {
    const raw = edited.candidates[Number(candidate.id.slice(1)) - 1];
    const carried = (raw?.evidence || []).map((id) => draftEvidence.get(id)).filter(Boolean);
    candidate.evidence = [...new Map([...candidate.evidence, ...carried].map((item) => [item.id, item])).values()];
  }
  sendJson(res, 200, {
    done: true,
    ...resolvePicks({ picks: edited.picks, abTest: edited.abTest, candidates: finalized }),
    candidates: finalized,
    draftCount: drafts.length,
    senderLabel: insights.senderLabel,
    model: state.model
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

function handleHistory(req, res, snapshot, extras = {}) {
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
    abFamilies: view.abFamilies,
    ...extras
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
  } else if (op === "record_use") {
    // What an operator did with a generated line: copied it, saved it or handed it on. The nightly
    // sync later pairs it with the send, which is how the generator's own record is built.
    const subject = String(body.subject || "").trim();
    if (!subject) return sendJson(res, 400, { error: "Nothing to record." });
    team.used.unshift({
      subject,
      preview: String(body.preview || "").trim(),
      mechanism: String(body.mechanism || ""),
      templateId: String(body.templateId || ""),
      templateName: String(body.templateName || ""),
      kind: ["copy", "use", "save"].includes(body.kind) ? body.kind : "copy",
      at: now
    });
    team.used = team.used.slice(0, MAX_USED);
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

async function handleTagHistory(req, res, config) {
  const snapshot = await readHistory({ fresh: true });
  if (!snapshot?.markets) return sendJson(res, 409, { error: "Sync the history before tagging it." });
  const limit = Math.max(1, Math.min(1000, Number(req.query?.limit) || TAG_LIMIT_MANUAL));
  sendJson(res, 200, await tagNewLines(config, snapshot, { limit }));
}

async function handlePreviewMarkets(req, res, config, body) {
  const subject = String(body.subject || "").trim();
  if (!subject) return sendJson(res, 400, { error: "Nothing to preview." });
  sendJson(res, 200, await previewInMarkets({ config, subject, preview: String(body.preview || "").trim() }));
}

async function handleSync(req, res, config) {
  const startedAt = Date.now();
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
  // New sends and new A/B arms get their mechanism tags in the same run, inside what is left of
  // the function's time. A failure here never fails the sync that already succeeded.
  let tagging = null;
  if (!result.remaining.length && config.openAiApiKey) {
    tagging = await tagNewLines(config, result.snapshot, { limit: TAG_LIMIT_NIGHTLY, deadlineAt: startedAt + 240_000 }).catch((error) => ({ error: error.message }));
  }
  sendJson(res, 200, {
    synced: result.synced,
    failed: result.failed,
    remaining: result.remaining,
    tagging,
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
    if (action === "tag_history" && (isVercelCronRequest(req) || isAuthorizedCronRequest(req, config))) {
      return await handleTagHistory(req, res, config);
    }
    if (!requireAuth(req, res, config)) return;

    if (req.method === "GET") {
      if (action === "status") return await handleStatus(res);
      if (action === "history") {
        const [snapshot, tags, team] = await Promise.all([readHistory(), readTags(), readTeam()]);
        return handleHistory(req, res, snapshot, evidenceFor(snapshot, tags, team, String(req.query?.country || "DK").toUpperCase()));
      }
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
      if (action === "tag_history") return await handleTagHistory(req, res, config);
      return sendJson(res, 400, { error: `Unknown action: ${action}` });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const body = await readJsonBody(req);
    if (action === "analyse") return await handleAnalyse(req, res, config, body);
    if (action === "generate") return await handleGenerate(req, res, config, body);
    if (action === "edit") return await handleEdit(req, res, config, body);
    if (action === "poll") return await handlePoll(req, res, config, body);
    if (action === "check") return await handleCheck(req, res, config, body);
    if (action === "team") return await handleTeam(req, res, config, body);
    if (action === "sync_history") return await handleSync(req, res, config);
    if (action === "tag_history") return await handleTagHistory(req, res, config);
    if (action === "preview_markets") return await handlePreviewMarkets(req, res, config, body);
    return sendJson(res, 400, { error: `Unknown action: ${action}` });
  } catch (error) {
    sendJson(res, Number(error?.statusCode) || 500, { error: error?.message || "Subject line request failed." });
  }
};

// For offline comparisons of the writing pipeline; not an API.
module.exports.__internals = { evidenceFor, fetchTemplate, focusTextFor, readHistory, readTags, readTeam };
