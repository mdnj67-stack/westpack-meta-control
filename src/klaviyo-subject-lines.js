// Subject lines - the operator's screen.
//
// One flow in three steps. Choose a Danish template from the DK account; read the brief the
// analysis makes of it and decide which mechanisms should carry the set; compare the suggestions
// as an inbox, one row each, because comparing lines is the job and an inbox is how recipients
// meet them. Detail - the reasoning, the evidence, the rule notes, the actions - opens on a row
// rather than sitting on every one. A shortlist beside the flow holds what the team saved.
//
// Two honesty requirements that are easy to lose in a redesign:
// - Open rates are inflated by Apple Mail Privacy Protection. The screen shows an open *index*
//   against the market's own level, never a bare open rate as a verdict, and says why.
// - The pattern bank is not measured: real lines from other brands have unknown results, and the
//   authored ones were never sent. Each line says which it is wherever it appears.

import { NUMBER_LOCALE } from "./format.js?v=20260921-format1";

const SOURCE_ACCOUNT = "DK";
const MOBILE_VISIBLE = 41;
// Duplicate & translate pushes translated copies back as templates named
// "W44: Adventskalender | Dansk (DK) | DK | Draft | 2026-10-21 06:53". They are not campaigns.
const ROLLOUT_DRAFT = /\|\s*[A-Z]{2}\s*\|\s*Draft\s*\|/;

const state = {
  loaded: false,
  status: null,
  templates: [],
  templateQuery: "",
  picking: true,
  selectedTemplateId: "",
  template: null,
  analysis: null,
  insights: null,
  mechanisms: [],
  count: 18,
  note: "",
  candidates: [],
  strategyNote: "",
  examples: [],
  senderLabel: "Westpack",
  attempt: 0,
  shown: [],
  open: "",
  editing: "",
  mechanismFilter: "",
  team: { favourites: [], banned: [] },
  view: "generator",
  bankTab: "sends",
  bank: { country: SOURCE_ACCOUNT, sort: "recent", query: "", verdict: "", abCountry: "", mechanism: "", campaignType: "", language: "", source: "" },
  history: null,
  patterns: null,
  busy: "",
  feedback: "",
  feedbackTone: ""
};

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPercent(value, digits = 1) {
  return Number.isFinite(value) ? `${(value * 100).toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })} %` : "–";
}

function formatIndex(value) {
  return Number.isFinite(value) ? value.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–";
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "–";
  return new Intl.DateTimeFormat(NUMBER_LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(new Date(time));
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(NUMBER_LOCALE) : "–";
}

function mechanismLabel(key) {
  return state.status?.taxonomy?.mechanisms?.find((item) => item.key === key)?.label || key || "";
}

function campaignTypeLabel(key) {
  return state.status?.taxonomy?.campaignTypes?.find((item) => item.key === key)?.label || key || "";
}

function plural(count, one, many) {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

// An index says "above or below this market's usual level", with the number. Shape and words
// carry the meaning, not colour alone.
function indexBadge(value, kind = "Open") {
  if (!Number.isFinite(value)) return `<span class="subject-index" title="${kind} index unavailable: too few recipients or too few sends around it">–</span>`;
  const direction = value >= 1.05 ? "is-up" : value <= 0.95 ? "is-down" : "";
  const arrow = value >= 1.05 ? "▲" : value <= 0.95 ? "▼" : "";
  return `<span class="subject-index ${direction}" title="${kind} index: ${formatIndex(value)} × the market's typical ${kind.toLowerCase()} rate in the weeks around this send">${arrow}${formatIndex(value)}</span>`;
}

async function callSubjectLines(action, { method = "GET", body = null, query = {} } = {}) {
  const url = new URL("/api/klaviyo/subject-lines", window.location.origin);
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url.toString(), {
    method,
    credentials: "same-origin",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("westpack-auth-required"));
    throw new Error("Session expired. Log in again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Subject line request failed (${response.status}).`);
  return payload;
}

// The status line takes no room unless it has something to say.
function syncStatusLine() {
  const line = byId("subject-lines-status");
  if (line) line.hidden = !state.busy && !state.feedback;
}

function setFeedback(message, tone = "") {
  state.feedback = message;
  state.feedbackTone = tone;
  const node = byId("subject-lines-feedback");
  if (node) {
    node.textContent = message;
    node.className = `inline-feedback${tone ? ` ${tone}` : ""}`;
  }
  syncStatusLine();
}

function setBusy(label) {
  state.busy = label;
  const busy = byId("subject-lines-busy");
  const spinner = byId("subject-lines-spinner");
  if (busy) {
    busy.textContent = label || "";
    busy.hidden = !label;
  }
  if (spinner) spinner.hidden = !label;
  syncStatusLine();
  byId("klaviyo-subject-lines-panel")?.classList.toggle("is-busy", Boolean(label));
  document.querySelectorAll("[data-subject-action]").forEach((button) => {
    if (button.dataset.subjectAlways === "true") return;
    button.disabled = Boolean(label);
  });
  // Re-enabling everything would also enable buttons kept disabled on purpose ("Saved", "Use" on a
  // line that breaks a rule), so the flow is redrawn from state instead.
  if (!label && !state.editing) renderFlow();
}

async function runAction(label, fn) {
  if (state.busy) return;
  setFeedback("");
  setBusy(label);
  try {
    await fn();
  } catch (error) {
    setFeedback(error?.message || "Something went wrong.", "is-danger");
  } finally {
    setBusy("");
  }
}

/* ------------------------------------------------------------------ step 1: campaign */

function visibleTemplates() {
  return state.templates.filter((template) => !ROLLOUT_DRAFT.test(String(template.name || "")));
}

function renderTemplateList() {
  const node = byId("subject-lines-template-list");
  if (!node) return;
  const needle = state.templateQuery.trim().toLowerCase();
  const list = visibleTemplates().filter((template) => !needle || String(template.name || "").toLowerCase().includes(needle));
  node.innerHTML = list.length ? list.map((template) => `
    <button class="subject-template-row${template.id === state.selectedTemplateId ? " is-selected" : ""}" data-subject-action="select-template" data-subject-always="true" data-id="${escapeHtml(template.id)}" type="button">
      <span class="subject-template-name">${escapeHtml(template.name || "Untitled template")}</span>
      <span class="subject-template-meta">${escapeHtml(formatDate(template.updated || template.created))}</span>
    </button>`).join("") : `<p class="subject-empty">${state.templates.length ? "No template matches the search." : "Loading the DK templates…"}</p>`;
}

function renderCampaignStep() {
  const node = byId("subject-lines-campaign");
  if (!node) return;
  const template = state.templates.find((item) => item.id === state.selectedTemplateId) || state.template;
  if (!state.picking && template) {
    node.innerHTML = `
      <div class="subject-selected">
        <div class="subject-selected-text">
          <strong>${escapeHtml(template.name)}</strong>
          <span>Edited ${escapeHtml(formatDate(template.updated || template.created))}${state.template?.textLength ? ` · ${formatCount(state.template.textLength)} characters of text` : ""}</span>
        </div>
        <button class="ghost-button is-sm" data-subject-action="change-template" data-subject-always="true" type="button">Change</button>
        <button class="${state.analysis ? "ghost-button" : "primary-button"} is-sm" data-subject-action="analyse" type="button">${state.analysis ? "Analyse again" : "Analyse"}</button>
      </div>`;
    return;
  }
  const hidden = state.templates.length - visibleTemplates().length;
  node.innerHTML = `
    <div class="subject-picker">
      <input class="wp-input subject-picker-search" id="subject-lines-template-search" type="search" placeholder="Search the 20 most recently edited templates" value="${escapeHtml(state.templateQuery)}" aria-label="Search templates">
      <div class="subject-template-list" id="subject-lines-template-list"></div>
      ${hidden ? `<p class="subject-hint">${plural(hidden, "translated draft", "translated drafts")} from Duplicate &amp; translate hidden.</p>` : ""}
    </div>`;
  renderTemplateList();
}

/* ------------------------------------------------------------------ step 2: brief */

function verdictBadge(verdict) {
  const map = { klar: ["is-success", "Clear winner"], tendens: ["is-info", "Leaning"], uafgjort: ["", "Inconclusive"] };
  const [tone, label] = map[verdict] || ["", verdict];
  return `<span class="wp-badge ${tone}">${escapeHtml(label)}</span>`;
}

// Said once above a list of tests, not in every card.
const REMAINDER_NOTE = "+ rest of list: the larger arm was Klaviyo's pick and was also sent to the rest of the list afterwards, so its figures include a later send.";

function renderAbTest(test) {
  // Only a clear result is a win; otherwise the arm is merely ahead, and saying "won" over a
  // 0.3-point gap would teach the operator a lesson the test never taught.
  const winnerLabel = test.verdict === "klar" ? "Won on opens" : "Ahead on opens";
  const tested = test.differs === "both" ? "subject and preheader" : test.differs === "preview" ? "preheader" : "subject";
  const largest = Math.max(...test.arms.map((arm) => arm.received));
  return `
    <article class="subject-ab">
      <header>
        <strong>${escapeHtml(test.campaignName)}</strong>
        <span>${escapeHtml(test.country)} · ${escapeHtml(formatDate(test.sentAt))} · tested the ${escapeHtml(tested)}</span>
        ${verdictBadge(test.verdict)}
      </header>
      ${test.arms.map((arm) => {
        const winner = arm.id === test.winnerId;
        return `
        <div class="subject-ab-arm${winner ? " is-winner" : ""}">
          <span class="subject-ab-letter" aria-label="${winner ? winnerLabel : "Variant"}">${winner ? "✓" : ""} ${escapeHtml(arm.letter)}</span>
          <span class="subject-ab-copy"><strong>${escapeHtml(arm.subject)}</strong>${arm.previewText && test.differs !== "subject" ? `<span>${escapeHtml(arm.previewText)}</span>` : ""}</span>
          <span class="subject-ab-figure" title="${winner ? winnerLabel : ""}">${formatPercent(arm.openRate)}</span>
          <span class="subject-ab-figure is-muted">${formatPercent(arm.clickRate, 2)} clicked</span>
          <span class="subject-ab-figure is-muted">${formatCount(arm.received)}${test.includesRemainder && arm.received === largest ? ' <span class="subject-ab-rest" title="Klaviyo\'s pick, also sent to the rest of the list afterwards">+ rest of list</span>' : ""}</span>
        </div>`;
      }).join("")}
    </article>`;
}

function renderSendRows(entries = []) {
  return `<ul class="subject-sends">${entries.map((entry) => `
    <li>
      <span class="subject-sends-text"><strong>${escapeHtml(entry.subject)}</strong>${entry.previewText ? ` <span>${escapeHtml(entry.previewText)}</span>` : ""}</span>
      <span class="subject-sends-date">${escapeHtml(formatDate(entry.sentAt))}</span>
      ${indexBadge(entry.openIndex, "Open")}
      ${indexBadge(entry.clickIndex, "Click")}
    </li>`).join("")}</ul>`;
}

function renderFeatureStats(stats = []) {
  if (!stats.length) return '<p class="subject-hint">Not enough indexed sends to compare features.</p>';
  return `
    <div class="wp-table-wrap">
      <table class="wp-table subject-feature-table">
        <thead><tr><th scope="col">In the subject</th><th scope="col">Open index with</th><th scope="col">without</th><th scope="col">Click index with</th><th scope="col">without</th><th scope="col">Sends</th></tr></thead>
        <tbody>${stats.map((stat) => `
          <tr>
            <th scope="row">${escapeHtml(stat.label)}</th>
            <td>${formatIndex(stat.openIndexWith)}</td>
            <td>${formatIndex(stat.openIndexWithout)}</td>
            <td>${formatIndex(stat.clickIndexWith)}</td>
            <td>${formatIndex(stat.clickIndexWithout)}</td>
            <td>${formatCount(stat.withCount)} / ${formatCount(stat.withoutCount)}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
    <p class="subject-hint">Medians across different emails, seasons and list sizes: a pattern in the house's own sends, not an effect. A/B tests are the stronger evidence.</p>`;
}

function renderMechanismChips() {
  const all = state.status?.taxonomy?.mechanisms || [];
  const reasons = new Map((state.analysis?.recommendedMechanisms || []).map((item) => [item.mechanism, item.reason]));
  const avoided = new Map((state.analysis?.avoidMechanisms || []).map((item) => [item.mechanism, item.reason]));
  return `<div class="subject-chips" role="group" aria-label="Mechanisms that carry the set">${all.map((mechanism) => {
    const selected = state.mechanisms.includes(mechanism.key);
    const title = reasons.get(mechanism.key) || (avoided.has(mechanism.key) ? `Avoid: ${avoided.get(mechanism.key)}` : mechanism.description);
    return `<button class="subject-chip${selected ? " is-selected" : ""}${avoided.has(mechanism.key) ? " is-avoided" : ""}" data-subject-action="toggle-mechanism" data-subject-always="true" data-key="${escapeHtml(mechanism.key)}" type="button" aria-pressed="${selected}" title="${escapeHtml(title)}">${selected ? '<span aria-hidden="true">✓ </span>' : ""}${escapeHtml(mechanism.label)}</button>`;
  }).join("")}</div>`;
}

function renderBriefStep() {
  const section = byId("subject-step-brief");
  const node = byId("subject-lines-brief");
  const typeNode = byId("subject-lines-brief-type");
  if (!section || !node) return;
  const analysis = state.analysis;
  section.hidden = !analysis;
  if (!analysis) return;
  if (typeNode) typeNode.textContent = [campaignTypeLabel(analysis.campaignType), analysis.secondaryType ? campaignTypeLabel(analysis.secondaryType) : ""].filter(Boolean).join(" · ");
  const insights = state.insights || {};
  const facts = [
    ["Offer", analysis.offer],
    ["Deadline", analysis.deadline],
    ["Products", (analysis.products || []).join(", ")],
    ["The reader right now", analysis.readerMoment]
  ];
  const reasons = analysis.recommendedMechanisms || [];
  node.innerHTML = `
    <p class="subject-lead">${escapeHtml(analysis.coreMessage)}</p>
    <dl class="subject-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd${value ? ` title="${escapeHtml(value)}"` : ' class="is-empty"'}>${escapeHtml(value || "None in the email")}</dd></div>`).join("")}</dl>

    <div class="subject-columns">
      <section>
        <h4>The email says</h4>
        ${(analysis.facts || []).length ? `<ul class="subject-list">${analysis.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>` : '<p class="subject-hint">No specific claims.</p>'}
      </section>
      <section>
        <h4>Must not promise</h4>
        ${(analysis.mustNotPromise || []).length ? `<ul class="subject-list is-negative">${analysis.mustNotPromise.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="subject-hint">Nothing flagged.</p>'}
      </section>
    </div>

    <section class="subject-block">
      <h4>Hooks in the email</h4>
      <ul class="subject-hooks">${(analysis.hooks || []).map((hook) => `<li><strong>${escapeHtml(hook.hook)}</strong><q>${escapeHtml(hook.evidence)}</q></li>`).join("")}</ul>
    </section>

    <section class="subject-block">
      <h4>What Westpack's own sends say</h4>
      ${insights.sendCount ? "" : '<div class="wp-alert is-warning">The send history is not synced, so there is no house evidence yet. Sync it under The bank.</div>'}
      ${analysis.houseEvidence ? `<p class="subject-prose">${escapeHtml(analysis.houseEvidence)}</p>` : ""}
      ${(insights.abLessons || []).length ? `<div class="subject-ab-list">${insights.abLessons.slice(0, 2).map(renderAbTest).join("")}</div>${insights.abLessons.some((test) => test.includesRemainder) ? `<p class="subject-hint subject-ab-note">${REMAINDER_NOTE}</p>` : ""}` : ""}
      ${(insights.abLessons || []).length > 2 ? `<details class="subject-more"><summary>${plural(insights.abLessons.length - 2, "more A/B test", "more A/B tests")} that bear on this email</summary><div class="subject-ab-list">${insights.abLessons.slice(2).map(renderAbTest).join("")}</div></details>` : ""}
      ${(insights.relevant || []).length ? `<details class="subject-more"><summary>${plural(insights.relevant.length, "past send", "past sends")} about something similar</summary>${renderSendRows(insights.relevant)}<p class="subject-hint">Index: the send against its market's typical rate in the weeks around it, 1,00 = typical. Not a raw open rate, because Apple Mail opens mail nobody read.</p></details>` : ""}
      ${(insights.featureStats || []).length ? `<details class="subject-more"><summary>Features in DK subject lines, last three years</summary>${renderFeatureStats(insights.featureStats)}</details>` : ""}
    </section>

    <footer class="subject-compose">
      <div class="subject-compose-row">
        <h4>Carry the set with</h4>
        <span class="subject-hint">Recommended ones are selected. They get about two thirds of the lines; the rest are there for range.</span>
      </div>
      ${renderMechanismChips()}
      ${reasons.length ? `<details class="subject-more"><summary>Why these</summary><ul class="subject-list">${reasons.map((item) => `<li><strong>${escapeHtml(mechanismLabel(item.mechanism))}:</strong> ${escapeHtml(item.reason)}</li>`).join("")}${(analysis.avoidMechanisms || []).map((item) => `<li><strong>Avoid ${escapeHtml(mechanismLabel(item.mechanism))}:</strong> ${escapeHtml(item.reason)}</li>`).join("")}</ul></details>` : ""}
      ${analysis.translationNotes ? `<p class="subject-hint"><strong>Translation:</strong> ${escapeHtml(analysis.translationNotes)}</p>` : ""}
      <div class="subject-compose-controls">
        <div class="wp-segment" role="group" aria-label="How many">
          ${[12, 18, 24].map((count) => `<button class="wp-segment-item${state.count === count ? " active" : ""}" data-subject-action="set-count" data-subject-always="true" data-count="${count}" type="button" aria-pressed="${state.count === count}">${count}</button>`).join("")}
        </div>
        <input class="wp-input subject-note" id="subject-lines-note" type="text" value="${escapeHtml(state.note)}" placeholder="Note for the writer, e.g. more edge, no emoji" aria-label="Note for the writer">
        <button class="primary-button" data-subject-action="generate" type="button">Write subject lines</button>
      </div>
    </footer>`;
}

/* ------------------------------------------------------------------ step 3: suggestions */

function statusMark(candidate) {
  if (candidate.status === "block") return '<span class="subject-mark is-block" title="Breaks a rule" aria-label="Breaks a rule">■</span>';
  if (candidate.status === "warn") return '<span class="subject-mark is-warn" title="Check" aria-label="Check">▲</span>';
  return '<span class="subject-mark is-ok" title="Passes the rules" aria-label="Passes the rules">●</span>';
}

function riskLabel(risk) {
  return { lav: "Translates easily", middel: "Translation: some risk", hoej: "Translation: high risk" }[risk] || "";
}

// The subject as iPhone Mail shows it: whatever runs past about 41 characters is drawn faded after
// the cut rather than hidden, so the operator sees what a phone loses.
function renderSubjectText(subject) {
  const characters = [...subject];
  const visible = characters.slice(0, MOBILE_VISIBLE).join("");
  const hidden = characters.slice(MOBILE_VISIBLE).join("");
  return `${escapeHtml(visible)}${hidden ? `<span class="subject-cut" title="Cut on iPhone Mail">${escapeHtml(hidden)}</span>` : ""}`;
}

function renderCandidate(candidate) {
  const open = state.open === candidate.id;
  const editing = state.editing === candidate.id;
  const saved = (state.team.favourites || []).some((item) => item.subject === candidate.subject && item.preview === candidate.preview);
  const length = candidate.metrics?.subjectLength ?? [...candidate.subject].length;
  return `
    <article class="subject-row is-${escapeHtml(candidate.status)}${open ? " is-open" : ""}" data-candidate="${escapeHtml(candidate.id)}">
      <div class="subject-row-line">
        <button class="subject-row-main" data-subject-action="toggle" data-subject-always="true" data-id="${escapeHtml(candidate.id)}" type="button" aria-expanded="${open}">
          ${statusMark(candidate)}
          <span class="subject-row-text">
            <span class="subject-row-subject">${renderSubjectText(candidate.subject)}</span>
            <span class="subject-row-preview">${escapeHtml(candidate.preview || "(no preheader)")}</span>
          </span>
          <span class="subject-row-tag">${escapeHtml(mechanismLabel(candidate.mechanism))}</span>
          <span class="subject-row-count${length > MOBILE_VISIBLE ? " is-long" : ""}" title="Characters in the subject; about ${MOBILE_VISIBLE} show on an iPhone">${length}</span>
        </button>
        <div class="subject-row-actions">
          <button class="ghost-button is-sm" data-subject-action="copy" data-subject-always="true" data-id="${escapeHtml(candidate.id)}" type="button">Copy</button>
          <button class="ghost-button is-sm" data-subject-action="favourite" data-id="${escapeHtml(candidate.id)}" type="button"${saved ? " disabled" : ""}>${saved ? "Saved" : "Save"}</button>
        </div>
      </div>
      ${open ? `
      <div class="subject-row-detail">
        ${editing ? `
          <div class="subject-edit">
            <label class="field"><span>Subject</span><input class="wp-input" data-edit="subject" type="text" value="${escapeHtml(candidate.subject)}"></label>
            <label class="field"><span>Preheader</span><input class="wp-input" data-edit="preview" type="text" value="${escapeHtml(candidate.preview)}"></label>
          </div>` : ""}
        ${candidate.rationale ? `<p class="subject-prose">${escapeHtml(candidate.rationale)}</p>` : ""}
        ${candidate.evidence?.length ? `<p class="subject-hint">Leans on: ${candidate.evidence.map((item) => escapeHtml(item.label || item)).join(" · ")}</p>` : ""}
        ${candidate.issues?.length ? `<ul class="subject-issues">${candidate.issues.map((issue) => `<li class="is-${escapeHtml(issue.severity)}"><strong>${escapeHtml(issue.label)}:</strong> ${escapeHtml(issue.message)}</li>`).join("")}</ul>` : ""}
        <p class="subject-hint">${escapeHtml([mechanismLabel(candidate.mechanism), candidate.secondaryMechanism ? mechanismLabel(candidate.secondaryMechanism) : "", riskLabel(candidate.translationRisk), `preheader ${candidate.metrics?.previewLength ?? [...candidate.preview].length} characters`].filter(Boolean).join(" · "))}${candidate.translationNote ? `. ${escapeHtml(candidate.translationNote)}` : ""}</p>
        <div class="subject-row-buttons">
          ${editing
            ? `<button class="primary-button is-sm" data-subject-action="check-edit" data-id="${escapeHtml(candidate.id)}" type="button">Check</button>
               <button class="ghost-button is-sm" data-subject-action="cancel-edit" data-subject-always="true" type="button">Cancel</button>`
            : `<button class="primary-button is-sm" data-subject-action="use" data-id="${escapeHtml(candidate.id)}" type="button"${candidate.status === "block" ? " disabled" : ""}>Use in Duplicate &amp; translate</button>
               <button class="ghost-button is-sm" data-subject-action="edit" data-subject-always="true" data-id="${escapeHtml(candidate.id)}" type="button">Edit</button>
               <button class="ghost-button is-sm" data-subject-action="ban" data-id="${escapeHtml(candidate.id)}" type="button" title="The generator will steer away from lines like this">Not like this</button>`}
        </div>
      </div>` : ""}
    </article>`;
}

function renderResultsStep() {
  const section = byId("subject-step-results");
  const node = byId("subject-lines-candidates");
  const summary = byId("subject-lines-results-summary");
  if (!section || !node) return;
  section.hidden = !state.candidates.length;
  if (!state.candidates.length) return;
  const counts = state.candidates.reduce((acc, candidate) => ({ ...acc, [candidate.status]: (acc[candidate.status] || 0) + 1 }), {});
  if (summary) {
    summary.textContent = [
      plural(state.candidates.length, "pair", "pairs"),
      counts.ok ? `${formatCount(counts.ok)} pass` : "",
      counts.warn ? `${formatCount(counts.warn)} to check` : "",
      counts.block ? `${formatCount(counts.block)} ${counts.block === 1 ? "breaks" : "break"} a rule` : ""
    ].filter(Boolean).join(" · ");
  }
  const byMechanism = state.candidates.reduce((acc, candidate) => ({ ...acc, [candidate.mechanism]: (acc[candidate.mechanism] || 0) + 1 }), {});
  const shown = state.candidates.filter((candidate) => !state.mechanismFilter || candidate.mechanism === state.mechanismFilter);
  node.innerHTML = `
    ${state.strategyNote ? `<p class="subject-strategy">${escapeHtml(state.strategyNote)}</p>` : ""}
    <div class="subject-results-bar">
      <div class="subject-chips" role="group" aria-label="Filter by mechanism">
        <button class="subject-chip${state.mechanismFilter ? "" : " is-selected"}" data-subject-action="filter-mechanism" data-subject-always="true" data-key="" type="button">All ${formatCount(state.candidates.length)}</button>
        ${Object.entries(byMechanism).map(([key, count]) => `<button class="subject-chip${state.mechanismFilter === key ? " is-selected" : ""}" data-subject-action="filter-mechanism" data-subject-always="true" data-key="${escapeHtml(key)}" type="button">${escapeHtml(mechanismLabel(key))} ${formatCount(count)}</button>`).join("")}
      </div>
      <span class="subject-hint">From ${escapeHtml(state.senderLabel || "Westpack")}, as iPhone Mail shows it. Faded text is cut on a phone.</span>
    </div>
    <div class="subject-inbox" role="list">${shown.map(renderCandidate).join("")}</div>
    ${state.examples.length ? `<details class="subject-more"><summary>The ${formatCount(state.examples.length)} bank lines the writer was shown</summary><ul class="subject-list">${state.examples.map((entry) => `<li>${escapeHtml(entry.subject)}${entry.preview ? ` <span class="subject-muted">${escapeHtml(entry.preview)}</span>` : ""} <span class="subject-muted">· ${escapeHtml(mechanismLabel(entry.mechanisms?.[0]))} · ${entry.source !== "authored" ? `sent by ${escapeHtml(entry.sender || "another brand")}` : "written for the bank"}</span></li>`).join("")}</ul></details>` : ""}`;
}

function renderShortlist() {
  const node = byId("subject-lines-favourites");
  if (!node) return;
  const favourites = state.team.favourites || [];
  if (!favourites.length) {
    node.innerHTML = '<p class="subject-hint">Save a suggestion to keep it here. The team sees the same list, and the writer reads it as taste.</p>';
    return;
  }
  node.innerHTML = `<ul class="subject-shortlist">${favourites.slice(0, 30).map((item) => `
    <li>
      <div class="subject-shortlist-text">
        <strong>${escapeHtml(item.subject)}</strong>
        ${item.preview ? `<span>${escapeHtml(item.preview)}</span>` : ""}
        <small>${escapeHtml(item.campaignName || "")}</small>
      </div>
      <div class="subject-shortlist-actions">
        <button class="ghost-button is-sm" data-subject-action="copy-favourite" data-subject-always="true" data-id="${escapeHtml(item.id)}" type="button">Copy</button>
        <button class="wp-icon-button" data-subject-action="unfavourite" data-id="${escapeHtml(item.id)}" type="button" aria-label="Remove from the shortlist" title="Remove">×</button>
      </div>
    </li>`).join("")}</ul>`;
}

function renderFlow() {
  renderCampaignStep();
  renderBriefStep();
  renderResultsStep();
  renderShortlist();
  const again = document.querySelector('[data-subject-action="generate-again"]');
  if (again) again.disabled = Boolean(state.busy) || !state.analysis;
}

/* ------------------------------------------------------------------ the bank view */

function renderLayers() {
  const node = byId("subject-lines-layers");
  const status = state.status;
  if (!node || !status) return;
  const history = status.history || {};
  const bank = status.bank || {};
  const rules = status.rules || [];
  const blocking = rules.filter((rule) => rule.severity === "block").length;
  node.innerHTML = `
    <div class="wp-metrics subject-layers">
      <div class="wp-metric">
        <span class="wp-metric-label">Westpack's sends</span>
        <span class="wp-metric-value">${formatCount(history.sends || 0)}</span>
        <span class="wp-metric-caption">${history.sends ? `${formatCount((history.markets || []).length)} Klaviyo accounts since 2021. Measured, as an index against each market's own level.` : "Not synced yet."}</span>
      </div>
      <div class="wp-metric">
        <span class="wp-metric-label">A/B tests</span>
        <span class="wp-metric-value">${formatCount(history.abTests || 0)}</span>
        <span class="wp-metric-caption">Of a subject or preheader. The strongest evidence: Apple Mail's automatic opens hit both arms alike.</span>
      </div>
      <div class="wp-metric">
        <span class="wp-metric-label">Pattern bank</span>
        <span class="wp-metric-value">${formatCount((bank.authored || 0) + (bank.collected || 0) + (bank.imported || 0))}</span>
        <span class="wp-metric-caption">${bank.collected ? `${formatCount(bank.collected)} real lines from ${formatCount(bank.collectedSenders)} brands, ` : ""}${formatCount(bank.authored || 0)} written for the bank${bank.imported ? `, ${formatCount(bank.imported)} imported` : ""}. Patterns, not proof.</span>
      </div>
      <div class="wp-metric">
        <span class="wp-metric-label">Rules</span>
        <span class="wp-metric-value">${formatCount(rules.length)}</span>
        <span class="wp-metric-caption">${formatCount(blocking)} block, ${formatCount(rules.length - blocking)} warn. Run on every suggestion against the email's own text.</span>
      </div>
    </div>
    <div class="subject-sync">
      <span class="subject-hint">${history.syncedAt ? `History synced ${escapeHtml(formatDate(history.syncedAt))}, and every night.` : "History not synced."}</span>
      <button class="ghost-button is-sm" data-subject-action="sync" type="button">Sync from Klaviyo now</button>
    </div>`;
}

function renderBank() {
  const node = byId("subject-lines-bank-content");
  if (!node) return;
  document.querySelectorAll("[data-subject-bank-tab]").forEach((tab) => {
    const active = tab.dataset.subjectBankTab === state.bankTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const markets = (state.status?.history?.markets || []).map((market) => market.country);
  const select = (id, value, options) => `<select class="wp-select" id="${id}">${options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}"${optionValue === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
  const marketOptions = (includeAll) => [...(includeAll ? [["", "All markets"]] : []), ...markets.map((code) => [code, code])];

  if (state.bankTab === "sends") {
    const history = state.history;
    node.innerHTML = `
      <div class="subject-toolbar">
        <label class="field"><span>Account</span>${select("subject-bank-country", state.bank.country, marketOptions(false))}</label>
        <label class="field subject-toolbar-grow"><span>Search</span><input class="wp-input" id="subject-bank-query" type="search" value="${escapeHtml(state.bank.query)}" placeholder="Word in subject or campaign, then Enter"></label>
        <label class="field"><span>Sort</span>${select("subject-bank-sort", state.bank.sort, [["recent", "Newest first"], ["open_index", "Highest open index"], ["click_index", "Highest click index"]])}</label>
      </div>
      <p class="subject-hint">Index: the send against its own market's typical rate in the weeks around it, 1,00 = typical. Bot clicks are left out. A raw open rate is never the verdict, because Apple Mail opens mail nobody read.</p>
      ${history ? `
        <div class="wp-table-wrap">
          <table class="wp-table subject-history-table">
            <thead><tr><th scope="col">Sent</th><th scope="col">Subject and preheader</th><th scope="col" class="is-num">Recipients</th><th scope="col" class="is-num">Opened</th><th scope="col" class="is-num">Open index</th><th scope="col" class="is-num">Clicked</th><th scope="col" class="is-num">Click index</th></tr></thead>
            <tbody>${history.entries.map((entry) => `
              <tr>
                <td class="subject-history-when"><span class="subject-nowrap">${escapeHtml(formatDate(entry.sentAt))}</span><span class="subject-cell-sub" title="${escapeHtml(entry.campaignName)}">${escapeHtml(entry.campaignName)}${entry.abTest ? " · A/B arm" : ""}</span></td>
                <td class="subject-history-line"><strong>${escapeHtml(entry.subject)}</strong>${entry.previewText ? `<span class="subject-cell-sub is-clipped" title="${escapeHtml(entry.previewText)}">${escapeHtml(entry.previewText)}</span>` : ""}</td>
                <td class="is-num">${formatCount(entry.received)}</td>
                <td class="is-num">${formatPercent(entry.openRate)}</td>
                <td class="is-num">${indexBadge(entry.openIndex, "Open")}</td>
                <td class="is-num">${formatPercent(entry.clickRate, 2)}</td>
                <td class="is-num">${indexBadge(entry.clickIndex, "Click")}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
        <div class="subject-table-foot">
          <span class="subject-hint">${formatCount(history.entries.length)} of ${formatCount(history.total)} sends${history.syncedAt ? ` · synced ${escapeHtml(formatDate(history.syncedAt))}` : ""}</span>
          ${history.entries.length < history.total ? '<button class="ghost-button is-sm" data-subject-action="history-more" data-subject-always="true" type="button">Show more</button>' : ""}
        </div>
        <details class="subject-more"><summary>Features in this account's subject lines, last three years</summary>${renderFeatureStats(history.featureStats)}</details>
      ` : '<p class="subject-empty">Loading…</p>'}`;
    return;
  }

  if (state.bankTab === "ab") {
    const history = state.history;
    const tests = history?.abTests || [];
    node.innerHTML = `
      <div class="subject-toolbar">
        <label class="field"><span>Market</span>${select("subject-ab-country", state.bank.abCountry, marketOptions(true))}</label>
        <label class="field"><span>Result</span>${select("subject-ab-verdict", state.bank.verdict, [["", "All"], ["klar", "Clear winner"], ["tendens", "Leaning"], ["uafgjort", "Inconclusive"]])}</label>
      </div>
      <p class="subject-hint">Each test split one list at random, so Apple Mail's automatic opens land on both arms alike and the difference between them is real. With a few hundred recipients per arm most tests cannot tell two good lines apart; "clear" means a two-sided test at 95 %. ${REMAINDER_NOTE}</p>
      ${(history?.abFamilies || []).length ? `<details class="subject-more"><summary>The same test in several markets (${formatCount(history.abFamilies.length)})</summary><ul class="subject-list">${history.abFamilies.slice(0, 60).map((family) => `<li><strong>${escapeHtml(family.campaignName)}</strong>: variant ${escapeHtml(family.leader)} ahead on opens in ${formatCount(family.leaderWins)} of ${formatCount(family.tests)} markets (${escapeHtml(family.markets.join(", "))}), ${formatCount(family.decisive)} clearly.</li>`).join("")}</ul></details>` : ""}
      ${history ? `<p class="subject-hint">${formatCount(history.abTestTotal)} tests${history.abTestTotal > tests.length ? `, newest ${formatCount(tests.length)} shown` : ""}.</p><div class="subject-ab-grid">${tests.map(renderAbTest).join("")}</div>` : '<p class="subject-empty">Loading…</p>'}`;
    return;
  }

  if (state.bankTab === "patterns") {
    const patterns = state.patterns;
    const banned = new Set((state.team.banned || []).map((item) => item.id));
    node.innerHTML = `
      <div class="subject-toolbar">
        <label class="field"><span>Mechanism</span>${select("subject-pattern-mechanism", state.bank.mechanism, [["", "All"], ...(state.status?.taxonomy?.mechanisms || []).map((item) => [item.key, item.label])])}</label>
        <label class="field"><span>Campaign type</span>${select("subject-pattern-type", state.bank.campaignType, [["", "All"], ...(state.status?.taxonomy?.campaignTypes || []).map((item) => [item.key, item.label])])}</label>
        <label class="field"><span>Language</span>${select("subject-pattern-language", state.bank.language, [["", "All"], ["da", "Danish"], ["en", "English"]])}</label>
        <label class="field"><span>Source</span>${select("subject-pattern-source", state.bank.source, [["", "All"], ["collected", "Real lines, Really Good Emails"], ["imported", "Real lines, imported by the team"], ["authored", "Written for the bank"]])}</label>
        <label class="field subject-toolbar-grow"><span>Search</span><input class="wp-input" id="subject-pattern-query" type="search" value="${escapeHtml(state.bank.query)}" placeholder="Then Enter"></label>
      </div>
      <p class="subject-hint">Real lines carry the sender's name: other brands' sends collected from Really Good Emails, and lines the team imported. Their results are unknown. The rest were written for the bank and never sent. None of it is measured; it is there for range.</p>
      ${patterns ? `
        <ul class="subject-patterns">${patterns.entries.map((entry) => `
          <li class="${banned.has(entry.id) ? "is-banned" : ""}">
            <div class="subject-patterns-text">
              <strong>${escapeHtml(entry.subject)}</strong>${entry.preview ? ` <span>${escapeHtml(entry.preview)}</span>` : ""}
              <small>${(entry.mechanisms || []).map((key) => escapeHtml(mechanismLabel(key))).join(" + ")} · ${escapeHtml(campaignTypeLabel(entry.campaignType))} · ${escapeHtml(entry.language)}${entry.source === "authored" ? " · written for the bank" : ` · sent by ${escapeHtml(entry.sender || "another brand")}${entry.source === "collected" ? " (Really Good Emails)" : " (imported)"}`}</small>
            </div>
            ${banned.has(entry.id)
              ? `<button class="ghost-button is-sm" data-subject-action="unban" data-id="${escapeHtml(entry.id)}" type="button">Allow again</button>`
              : `<button class="ghost-button is-sm" data-subject-action="ban-pattern" data-id="${escapeHtml(entry.id)}" type="button">Never use</button>`}
          </li>`).join("")}</ul>
        <div class="subject-table-foot">
          <span class="subject-hint">${formatCount(patterns.entries.length)} of ${formatCount(patterns.total)}</span>
          ${patterns.entries.length < patterns.total ? '<button class="ghost-button is-sm" data-subject-action="patterns-more" data-subject-always="true" type="button">Show more</button>' : ""}
        </div>
      ` : '<p class="subject-empty">Loading…</p>'}`;
    return;
  }

  if (state.bankTab === "rules") {
    node.innerHTML = `
      <p class="subject-hint">Run on every suggestion after it is written, against the email's own text. A blocking rule keeps the line on screen, last, with the reason; a warning asks a person to look.</p>
      <ul class="subject-rules">${(state.status?.rules || []).map((rule) => `
        <li>
          <span class="subject-mark ${rule.severity === "block" ? "is-block" : "is-warn"}" aria-hidden="true">${rule.severity === "block" ? "■" : "▲"}</span>
          <div><strong>${escapeHtml(rule.label)}</strong> <span class="subject-muted">${rule.severity === "block" ? "Blocks" : "Warns"}</span><p>${escapeHtml(rule.description)}</p></div>
        </li>`).join("")}</ul>`;
    return;
  }

  if (state.bankTab === "import") {
    const banned = state.team.banned || [];
    node.innerHTML = `
      <div class="subject-import">
        <p class="subject-prose">Paste subject lines from newsletters you rate, one per line; "Subject — preheader" or a tab between them keeps both. They are tagged and join the pattern bank for the whole team, marked with the sender.</p>
        <label class="field"><span>Sender</span><input class="wp-input" id="subject-import-sender" type="text" placeholder="The brand or shop"></label>
        <label class="field"><span>Subject lines</span><textarea class="wp-textarea" id="subject-import-lines" rows="7" placeholder="Subject line — preheader"></textarea></label>
        <div><button class="primary-button" data-subject-action="import" type="button">Add to the bank</button></div>
      </div>
      <h4 class="subject-subhead">Never like this</h4>
      ${banned.length ? `<ul class="subject-patterns">${banned.map((item) => `<li><div class="subject-patterns-text"><strong>${escapeHtml(item.subject || item.id)}</strong>${item.reason ? `<small>${escapeHtml(item.reason)}</small>` : ""}</div><button class="ghost-button is-sm" data-subject-action="unban" data-id="${escapeHtml(item.id)}" type="button">Allow again</button></li>`).join("")}</ul>` : '<p class="subject-hint">Nothing banned. "Not like this" on a suggestion, or "Never use" on a pattern, puts it here.</p>'}`;
  }
}

function renderView() {
  byId("subject-lines-generator")?.toggleAttribute("hidden", state.view !== "generator");
  byId("subject-lines-bank")?.toggleAttribute("hidden", state.view !== "bank");
  document.querySelectorAll("[data-subject-view]").forEach((button) => {
    const active = button.dataset.subjectView === state.view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderAll() {
  renderView();
  renderFlow();
  renderLayers();
  if (state.view === "bank") renderBank();
  setFeedback(state.feedback, state.feedbackTone);
}

/* ------------------------------------------------------------------ loading */

async function loadStatus() {
  state.status = await callSubjectLines("status");
  renderLayers();
}

async function loadTeam() {
  const team = await callSubjectLines("team");
  state.team = { favourites: team.favourites || [], banned: team.banned || [] };
  renderShortlist();
}

async function loadTemplates() {
  const response = await fetch(`/api/klaviyo/templates?country=${SOURCE_ACCOUNT}`, { credentials: "same-origin" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "The DK templates could not be loaded.");
  state.templates = Array.isArray(payload.templates) ? payload.templates : [];
  renderCampaignStep();
}

async function loadHistory({ append = false } = {}) {
  const offset = append ? (state.history?.entries?.length || 0) : 0;
  const payload = await callSubjectLines("history", {
    query: { country: state.bank.country, q: state.bank.query, sort: state.bank.sort, offset, limit: 150, verdict: state.bank.verdict, abCountry: state.bank.abCountry }
  });
  state.history = append && state.history ? { ...payload, entries: [...state.history.entries, ...payload.entries] } : payload;
  renderBank();
}

async function loadPatterns({ append = false } = {}) {
  const offset = append ? (state.patterns?.entries?.length || 0) : 0;
  const payload = await callSubjectLines("bank", {
    query: { mechanism: state.bank.mechanism, campaignType: state.bank.campaignType, language: state.bank.language, source: state.bank.source, q: state.bank.query, offset, limit: 120 }
  });
  state.patterns = append && state.patterns ? { ...payload, entries: [...state.patterns.entries, ...payload.entries] } : payload;
  renderBank();
}

function loadBankTab() {
  if (state.bankTab === "sends" || state.bankTab === "ab") return loadHistory();
  if (state.bankTab === "patterns") return loadPatterns();
  if (state.bankTab === "import") return loadTeam().then(renderBank);
  renderBank();
  return Promise.resolve();
}

/* ------------------------------------------------------------------ actions */

function selectedAnalysis() {
  if (!state.analysis) return null;
  const reasons = new Map((state.analysis.recommendedMechanisms || []).map((item) => [item.mechanism, item.reason]));
  return {
    ...state.analysis,
    recommendedMechanisms: state.mechanisms.map((key) => ({ mechanism: key, reason: reasons.get(key) || "Valgt af operatøren." })),
    avoidMechanisms: (state.analysis.avoidMechanisms || []).filter((item) => !state.mechanisms.includes(item.mechanism))
  };
}

async function analyse() {
  const payload = await callSubjectLines("analyse", { method: "POST", body: { country: SOURCE_ACCOUNT, templateId: state.selectedTemplateId } });
  state.template = payload.template;
  state.analysis = payload.analysis;
  state.insights = payload.insights;
  state.senderLabel = payload.insights?.senderLabel || state.senderLabel;
  state.mechanisms = (payload.analysis?.recommendedMechanisms || []).map((item) => item.mechanism);
  state.candidates = [];
  state.strategyNote = "";
  state.examples = [];
  state.shown = [];
  state.attempt = 0;
  state.open = "";
  state.mechanismFilter = "";
  renderFlow();
  byId("subject-step-brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function generate({ again = false } = {}) {
  if (again) state.attempt += 1;
  state.note = String(byId("subject-lines-note")?.value ?? state.note).trim();
  const payload = await callSubjectLines("generate", {
    method: "POST",
    body: {
      country: SOURCE_ACCOUNT,
      templateId: state.selectedTemplateId,
      analysis: selectedAnalysis(),
      note: state.note,
      count: state.count,
      attempt: state.attempt,
      avoid: again ? state.shown : []
    }
  });
  state.candidates = payload.candidates || [];
  state.strategyNote = payload.strategyNote || "";
  state.examples = payload.examples || [];
  state.senderLabel = payload.senderLabel || state.senderLabel;
  state.shown = [...new Set([...state.shown, ...state.candidates.map((candidate) => candidate.subject)])];
  state.editing = "";
  state.open = "";
  state.mechanismFilter = "";
  renderFlow();
  byId("subject-step-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function findCandidate(id) {
  return state.candidates.find((candidate) => candidate.id === id) || null;
}

async function copyText(subject, preview) {
  try {
    await navigator.clipboard.writeText(preview ? `${subject}\n${preview}` : subject);
    setFeedback("Copied: the subject on the first line, the preheader on the second.");
  } catch (error) {
    setFeedback("The browser refused the clipboard. Select the text instead.", "is-warning");
  }
}

async function checkEdit(candidate) {
  const row = document.querySelector(`[data-candidate="${CSS.escape(candidate.id)}"]`);
  const subject = row?.querySelector('[data-edit="subject"]')?.value || "";
  const preview = row?.querySelector('[data-edit="preview"]')?.value || "";
  const payload = await callSubjectLines("check", { method: "POST", body: { country: SOURCE_ACCOUNT, templateId: state.selectedTemplateId, subject, preview, mechanism: candidate.mechanism } });
  Object.assign(candidate, {
    subject: payload.candidate.subject,
    preview: payload.candidate.preview,
    status: payload.candidate.status,
    issues: payload.candidate.issues,
    metrics: payload.candidate.metrics,
    rationale: candidate.rationale ? `${candidate.rationale} (Redigeret.)` : ""
  });
  state.editing = "";
  setFeedback(payload.candidate.status === "ok" ? "Your edit passes the rules." : "Your edit was checked: see the notes on the line.", payload.candidate.status === "block" ? "is-danger" : "");
}

async function teamOp(body, message) {
  const payload = await callSubjectLines("team", { method: "POST", body });
  if (payload.team) state.team = { favourites: payload.team.favourites || [], banned: payload.team.banned || [] };
  renderShortlist();
  renderResultsStep();
  if (state.view === "bank") renderBank();
  if (message) setFeedback(message);
  return payload;
}

// Hands the chosen pair to Duplicate & translate, which then translates it into every market's
// language with the template - instead of translating the template's name as the subject.
function useInDuplicator(templateId, templateName, subject, preview) {
  window.dispatchEvent(new CustomEvent("westpack-subject-line-use", {
    detail: { account: SOURCE_ACCOUNT, templateId, templateName, subject, preview }
  }));
}

function handleClick(event) {
  const viewButton = event.target.closest("[data-subject-view]");
  if (viewButton) {
    state.view = viewButton.dataset.subjectView;
    renderView();
    if (state.view === "bank") runAction("Loading the bank", loadBankTab);
    return;
  }
  const bankTab = event.target.closest("[data-subject-bank-tab]");
  if (bankTab) {
    state.bankTab = bankTab.dataset.subjectBankTab;
    state.bank.query = "";
    runAction("Loading", loadBankTab);
    return;
  }

  const button = event.target.closest("[data-subject-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.subjectAction;
  const id = button.dataset.id || "";
  const candidate = id ? findCandidate(id) : null;

  const handlers = {
    "select-template": () => {
      if (state.selectedTemplateId !== id) {
        state.selectedTemplateId = id;
        state.template = state.templates.find((template) => template.id === id) || null;
        state.analysis = null;
        state.insights = null;
        state.candidates = [];
        state.strategyNote = "";
      }
      state.picking = false;
      renderFlow();
    },
    "change-template": () => {
      state.picking = true;
      renderCampaignStep();
      byId("subject-lines-template-search")?.focus();
    },
    analyse: () => runAction("Reading the email and the house evidence", analyse),
    generate: () => runAction(`Writing ${state.count} pairs - about a minute`, () => generate()),
    "generate-again": () => runAction(`Writing ${state.count} new pairs - about a minute`, () => generate({ again: true })),
    "set-count": () => {
      state.count = Number(button.dataset.count) || 18;
      state.note = String(byId("subject-lines-note")?.value ?? state.note);
      renderBriefStep();
    },
    "toggle-mechanism": () => {
      const key = button.dataset.key;
      state.note = String(byId("subject-lines-note")?.value ?? state.note);
      state.mechanisms = state.mechanisms.includes(key) ? state.mechanisms.filter((item) => item !== key) : [...state.mechanisms, key];
      renderBriefStep();
    },
    "filter-mechanism": () => {
      state.mechanismFilter = button.dataset.key || "";
      renderResultsStep();
    },
    toggle: () => {
      if (state.editing && state.editing !== id) state.editing = "";
      state.open = state.open === id ? "" : id;
      renderResultsStep();
    },
    copy: () => candidate && copyText(candidate.subject, candidate.preview),
    "copy-favourite": () => {
      const item = (state.team.favourites || []).find((favourite) => favourite.id === id);
      if (item) copyText(item.subject, item.preview);
    },
    edit: () => {
      state.editing = id;
      state.open = id;
      renderResultsStep();
    },
    "cancel-edit": () => {
      state.editing = "";
      renderResultsStep();
    },
    "check-edit": () => candidate && runAction("Checking your edit", () => checkEdit(candidate)),
    favourite: () => candidate && runAction("Saving", () => teamOp({ op: "favourite", subject: candidate.subject, preview: candidate.preview, mechanism: candidate.mechanism, campaignName: state.template?.name || "", templateId: state.selectedTemplateId }, "Saved to the shortlist.")),
    unfavourite: () => runAction("Removing", () => teamOp({ op: "unfavourite", id }, "Removed from the shortlist.")),
    ban: () => candidate && runAction("Saving", () => teamOp({ op: "ban", subject: candidate.subject, reason: `Afvist til ${state.template?.name || "en kampagne"}` }, "Noted. The writer will steer away from lines like this.")),
    "ban-pattern": () => {
      const entry = state.patterns?.entries?.find((item) => item.id === id);
      return runAction("Saving", () => teamOp({ op: "ban", id, subject: entry?.subject || id, reason: "Mønster fravalgt i banken" }, "The writer will not be shown this line again."));
    },
    unban: () => runAction("Saving", () => teamOp({ op: "unban", id }, "Allowed again.")),
    use: () => candidate && useInDuplicator(state.selectedTemplateId, state.template?.name || "", candidate.subject, candidate.preview),
    sync: () => runAction("Syncing from Klaviyo", async () => {
      let payload = await callSubjectLines("sync_history", { method: "POST", body: {} });
      for (let round = 0; payload.remaining?.length && round < 4; round += 1) {
        setBusy(`Syncing - ${payload.remaining.length} accounts left`);
        payload = await callSubjectLines("sync_history", { method: "POST", body: {} });
      }
      await loadStatus();
      setFeedback(`Synced ${formatCount(payload.history?.sends || 0)} sends${payload.failed?.length ? `. Failed: ${payload.failed.map((item) => item.country).join(", ")}` : ""}.`, payload.failed?.length ? "is-warning" : "");
    }),
    "history-more": () => runAction("Loading", () => loadHistory({ append: true })),
    "patterns-more": () => runAction("Loading", () => loadPatterns({ append: true })),
    import: () => runAction("Tagging the lines", async () => {
      const payload = await teamOp({ op: "import", lines: byId("subject-import-lines")?.value || "", sender: byId("subject-import-sender")?.value || "" });
      await loadStatus();
      renderBank();
      setFeedback(`${formatCount(payload.added)} lines added${payload.skipped ? `, ${formatCount(payload.skipped)} already in the bank` : ""}.`);
    })
  };
  handlers[action]?.();
}

function handleChange(event) {
  const target = event.target;
  const reload = (fn) => runAction("Loading", fn);
  if (target.id === "subject-bank-country") { state.bank.country = target.value; return reload(loadHistory); }
  if (target.id === "subject-bank-sort") { state.bank.sort = target.value; return reload(loadHistory); }
  if (target.id === "subject-ab-country") { state.bank.abCountry = target.value; return reload(loadHistory); }
  if (target.id === "subject-ab-verdict") { state.bank.verdict = target.value; return reload(loadHistory); }
  if (target.id === "subject-pattern-mechanism") { state.bank.mechanism = target.value; return reload(loadPatterns); }
  if (target.id === "subject-pattern-type") { state.bank.campaignType = target.value; return reload(loadPatterns); }
  if (target.id === "subject-pattern-language") { state.bank.language = target.value; return reload(loadPatterns); }
  if (target.id === "subject-pattern-source") { state.bank.source = target.value; return reload(loadPatterns); }
  return undefined;
}

function handleKeyup(event) {
  const target = event.target;
  if (target.id === "subject-lines-template-search") {
    state.templateQuery = target.value;
    renderTemplateList();
    return;
  }
  if (target.id === "subject-lines-note") {
    state.note = target.value;
    return;
  }
  if (event.key !== "Enter") return;
  if (target.id === "subject-bank-query") {
    state.bank.query = target.value;
    runAction("Searching", loadHistory);
  }
  if (target.id === "subject-pattern-query") {
    state.bank.query = target.value;
    runAction("Searching", loadPatterns);
  }
}

export function initSubjectLines() {
  const panel = byId("klaviyo-subject-lines-panel");
  if (!panel || panel.dataset.subjectWired === "true") return;
  panel.dataset.subjectWired = "true";
  panel.addEventListener("click", handleClick);
  panel.addEventListener("change", handleChange);
  panel.addEventListener("keyup", handleKeyup);
}

export function loadSubjectLines({ force = false } = {}) {
  initSubjectLines();
  if (state.loaded && !force) {
    renderAll();
    return Promise.resolve();
  }
  state.loaded = true;
  renderAll();
  return runAction("Loading", async () => {
    await Promise.all([loadStatus(), loadTeam(), loadTemplates()]);
    renderAll();
  });
}

export const __subjectLinesInternals = { state, renderAll, selectedAnalysis };
