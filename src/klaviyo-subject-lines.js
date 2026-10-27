// Subject lines - the operator's screen.
//
// Choose a Danish template from the DK account (the same list Duplicate & translate offers), read
// the brief the analysis makes of it, then write subject line + preheader pairs from three layers:
// Westpack's own sends, the pattern bank and the rules. The brief is shown before anything is
// written so a wrong reading of the email is caught there, and the operator can steer which
// mechanisms carry the set.
//
// Two honesty requirements that are easy to lose in a redesign:
// - Open rates are inflated by Apple Mail Privacy Protection. The screen shows an open *index*
//   against the market's own level, never a bare open rate as a verdict, and says why.
// - The pattern bank is authored, not measured. It is labelled as such wherever it appears.

import { NUMBER_LOCALE } from "./format.js?v=20260921-format1";

const SOURCE_ACCOUNT = "DK";
const MOBILE_VISIBLE = 41;

const state = {
  loaded: false,
  status: null,
  templates: [],
  templateQuery: "",
  selectedTemplateId: "",
  template: null,
  analysis: null,
  insights: null,
  mechanisms: [],
  candidates: [],
  strategyNote: "",
  examples: [],
  senderLabel: "Westpack",
  attempt: 0,
  shown: [],
  editing: "",
  team: { favourites: [], banned: [] },
  view: "generator",
  bankTab: "sends",
  bank: { country: SOURCE_ACCOUNT, sort: "recent", query: "", verdict: "", mechanism: "", campaignType: "", language: "", source: "", offset: 0 },
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

// An index badge says "above or below this market's usual level", with the number. Shape and words
// carry the meaning, not colour alone.
function indexBadge(value, kind = "Open") {
  if (!Number.isFinite(value)) return `<span class="wp-badge" title="${kind} index unavailable: too few recipients or too few sends around it">${kind} –</span>`;
  const tone = value >= 1.05 ? "is-success" : value <= 0.95 ? "is-warning" : "";
  const arrow = value >= 1.05 ? "▲" : value <= 0.95 ? "▼" : "•";
  return `<span class="wp-badge ${tone}" title="${kind} index: ${formatIndex(value)} × the market's typical ${kind.toLowerCase()} rate in the weeks around this send">${arrow} ${kind} ${formatIndex(value)}</span>`;
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

function setFeedback(message, tone = "") {
  state.feedback = message;
  state.feedbackTone = tone;
  const node = byId("subject-lines-feedback");
  if (!node) return;
  node.textContent = message;
  node.className = `inline-feedback${tone ? ` ${tone}` : ""}`;
}

function setBusy(label) {
  state.busy = label;
  const node = byId("subject-lines-busy");
  if (node) {
    node.textContent = label || "";
    node.hidden = !label;
  }
  document.querySelectorAll("[data-subject-action]").forEach((button) => {
    if (button.dataset.subjectAlways === "true") return;
    button.disabled = Boolean(label);
  });
  // Re-enabling everything would also enable buttons a card keeps disabled on purpose ("Saved",
  // "Use" on a line that breaks a rule), so the cards are redrawn from state instead.
  if (!label && state.editing === "") renderCandidates();
  renderActions();
}

async function runAction(label, fn) {
  if (state.busy) return;
  setBusy(label);
  setFeedback("");
  try {
    await fn();
  } catch (error) {
    setFeedback(error?.message || "Something went wrong.", "is-danger");
  } finally {
    setBusy("");
  }
}

/* ------------------------------------------------------------------ status and layers */

function renderLayers() {
  const node = byId("subject-lines-layers");
  const pill = byId("subject-lines-status-pill");
  const status = state.status;
  if (!node || !status) return;
  const history = status.history || {};
  const dk = (history.markets || []).find((market) => market.country === SOURCE_ACCOUNT);
  if (pill) {
    pill.className = history.sends ? "status-pill" : "status-pill warning";
    pill.textContent = history.sends ? `History synced ${formatDate(history.syncedAt)}` : "History not synced";
  }
  node.innerHTML = `
    <ol class="subject-layer-list">
      <li>
        <span class="subject-layer-step">1</span>
        <div>
          <strong>Westpack's own sends</strong>
          <p>${history.sends ? `${formatCount(history.sends)} subject lines in ${formatCount((history.markets || []).length)} accounts, ${formatCount(history.abTests)} A/B tests. DK: ${formatCount(dk?.sends)} sends, ${formatCount(dk?.abTests)} A/B tests.` : "Not synced yet. Sync reads every sent campaign from Klaviyo."}</p>
          <p class="wp-help">Measured. Open rates are scored against each market's own level, because Apple Mail opens mail nobody read.</p>
        </div>
      </li>
      <li>
        <span class="subject-layer-step">2</span>
        <div>
          <strong>Pattern bank</strong>
          <p>${formatCount(status.bank?.authored)} pairs written for the bank${status.bank?.imported ? `, ${formatCount(status.bank.imported)} imported from real senders` : ""}, across ${formatCount(Object.keys(status.bank?.byMechanism || {}).length)} mechanisms.</p>
          <p class="wp-help">Patterns, not proof: the authored pairs have no measured results.</p>
        </div>
      </li>
      <li>
        <span class="subject-layer-step">3</span>
        <div>
          <strong>Rules</strong>
          <p>${formatCount((status.rules || []).length)} rules, ${formatCount((status.rules || []).filter((rule) => rule.severity === "block").length)} of them blocking. Every suggestion is checked against the email's own text.</p>
        </div>
      </li>
    </ol>
    <button class="ghost-button is-sm" data-subject-action="sync" type="button">Sync history from Klaviyo</button>
  `;
}

function renderFavourites() {
  const node = byId("subject-lines-favourites");
  if (!node) return;
  const favourites = state.team.favourites || [];
  if (!favourites.length) {
    node.innerHTML = '<p class="wp-help">Saved lines show here for the whole team, and the generator reads them as taste.</p>';
    return;
  }
  node.innerHTML = `<ul class="subject-favourite-list">${favourites.slice(0, 12).map((item) => `
    <li>
      <div>
        <strong>${escapeHtml(item.subject)}</strong>
        ${item.preview ? `<span>${escapeHtml(item.preview)}</span>` : ""}
        <small>${escapeHtml(item.campaignName || "")}${item.savedAt ? ` · ${formatDate(item.savedAt)}` : ""}</small>
      </div>
      <button class="wp-icon-button" data-subject-action="unfavourite" data-id="${escapeHtml(item.id)}" data-subject-always="true" type="button" aria-label="Remove from favourites" title="Remove">×</button>
    </li>`).join("")}</ul>`;
}

/* ------------------------------------------------------------------ step 1: templates */

function renderTemplates() {
  const node = byId("subject-lines-templates");
  if (!node) return;
  const needle = state.templateQuery.trim().toLowerCase();
  const list = state.templates.filter((template) => !needle || String(template.name || "").toLowerCase().includes(needle));
  if (!state.templates.length) {
    node.innerHTML = '<p class="wp-help">No templates loaded from the DK account yet.</p>';
    return;
  }
  node.innerHTML = list.length ? list.map((template) => `
    <button class="subject-template-card${template.id === state.selectedTemplateId ? " is-selected" : ""}" data-subject-action="select-template" data-id="${escapeHtml(template.id)}" type="button" aria-pressed="${template.id === state.selectedTemplateId}">
      <span class="subject-template-name">${escapeHtml(template.name || "Untitled template")}</span>
      <span class="subject-template-meta">${escapeHtml(formatDate(template.updated || template.created))} · ${escapeHtml(String(template.editorType || "").replace("SYSTEM_DRAGGABLE", "Drag & drop").replace("CODE", "Code"))}</span>
    </button>`).join("") : '<p class="wp-help">No template matches the search.</p>';
}

/* ------------------------------------------------------------------ step 2: the brief */

function renderList(items = [], empty = "None") {
  return items.length ? `<ul class="subject-brief-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="wp-help">${escapeHtml(empty)}</p>`;
}

function renderAbArmLine(test, arm) {
  const winner = arm.id === test.winnerId;
  // Only a clear result is a win; otherwise the arm is merely ahead, and saying "won" over a
  // 0.3-point gap would teach the operator a lesson the test never taught.
  const winnerLabel = test.verdict === "klar" ? "Won on opens" : "Ahead on opens";
  return `
    <div class="subject-ab-arm${winner ? " is-winner" : ""}">
      <span class="subject-ab-letter">${escapeHtml(arm.letter)}</span>
      <div class="subject-ab-copy">
        <strong>${escapeHtml(arm.subject)}</strong>
        ${arm.previewText ? `<span>${escapeHtml(arm.previewText)}</span>` : ""}
      </div>
      <div class="subject-ab-figures">
        <span>${formatPercent(arm.openRate)} opened</span>
        <span>${formatPercent(arm.clickRate, 2)} clicked</span>
        <span>${formatCount(arm.received)} recipients</span>
      </div>
      ${winner ? `<span class="wp-badge${test.verdict === "klar" ? " is-success" : ""}">${winnerLabel}</span>` : ""}
    </div>`;
}

function verdictBadge(verdict) {
  const map = { klar: ["is-success", "Clear winner"], tendens: ["is-info", "Leaning"], uafgjort: ["", "Inconclusive"] };
  const [tone, label] = map[verdict] || ["", verdict];
  return `<span class="wp-badge ${tone}">${escapeHtml(label)}</span>`;
}

function renderAbTest(test) {
  return `
    <article class="subject-ab-test">
      <header>
        <div>
          <strong>${escapeHtml(test.campaignName)}</strong>
          <span>${escapeHtml(test.country)} · ${escapeHtml(formatDate(test.sentAt))} · tested ${escapeHtml(test.differs === "both" ? "subject and preheader" : test.differs === "preview" ? "preheader" : "subject")}</span>
        </div>
        ${verdictBadge(test.verdict)}
      </header>
      ${test.arms.map((arm) => renderAbArmLine(test, arm)).join("")}
      ${test.includesRemainder ? '<p class="wp-help">The larger arm was Klaviyo\'s pick and was also sent to the rest of the list afterwards, so its figures include a later send.</p>' : ""}
    </article>`;
}

function renderSendRow(entry) {
  return `
    <li class="subject-send">
      <div>
        <strong>${escapeHtml(entry.subject)}</strong>
        ${entry.previewText ? `<span>${escapeHtml(entry.previewText)}</span>` : ""}
        <small>${escapeHtml(entry.campaignName)} · ${escapeHtml(formatDate(entry.sentAt))}</small>
      </div>
      <div class="subject-send-badges">${indexBadge(entry.openIndex, "Open")}${indexBadge(entry.clickIndex, "Click")}</div>
    </li>`;
}

function renderFeatureStats(stats = []) {
  if (!stats.length) return '<p class="wp-help">Not enough indexed sends to compare features.</p>';
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
    <p class="wp-help">Medians across different emails, seasons and list sizes: a pattern in the house's own sends, not an effect. A/B tests are the stronger evidence.</p>`;
}

function renderMechanismPicker() {
  const all = state.status?.taxonomy?.mechanisms || [];
  const reasons = new Map((state.analysis?.recommendedMechanisms || []).map((item) => [item.mechanism, item.reason]));
  const avoided = new Map((state.analysis?.avoidMechanisms || []).map((item) => [item.mechanism, item.reason]));
  return `
    <div class="subject-mechanism-grid" role="group" aria-label="Mechanisms that should carry the set">
      ${all.map((mechanism) => {
        const selected = state.mechanisms.includes(mechanism.key);
        const title = reasons.get(mechanism.key) || avoided.get(mechanism.key) || mechanism.description;
        return `<button class="subject-mechanism-chip${selected ? " is-selected" : ""}${avoided.has(mechanism.key) ? " is-avoided" : ""}" data-subject-action="toggle-mechanism" data-key="${escapeHtml(mechanism.key)}" data-subject-always="true" type="button" aria-pressed="${selected}" title="${escapeHtml(title)}">${selected ? "✓ " : ""}${escapeHtml(mechanism.label)}</button>`;
      }).join("")}
    </div>`;
}

function renderBrief() {
  const node = byId("subject-lines-brief");
  if (!node) return;
  const analysis = state.analysis;
  if (!analysis) {
    node.innerHTML = `<p class="wp-help">${state.selectedTemplateId ? "Analyse the campaign to see the brief." : "Choose a template first."}</p>`;
    return;
  }
  const insights = state.insights || {};
  const reasons = analysis.recommendedMechanisms || [];
  node.innerHTML = `
    <div class="subject-brief">
      <div class="subject-brief-core">
        <p class="section-label">Core message</p>
        <h4>${escapeHtml(analysis.coreMessage)}</h4>
        <div class="subject-chip-row">
          <span class="wp-badge is-brand">${escapeHtml(campaignTypeLabel(analysis.campaignType))}</span>
          ${analysis.secondaryType ? `<span class="wp-badge">${escapeHtml(campaignTypeLabel(analysis.secondaryType))}</span>` : ""}
        </div>
        ${analysis.readerMoment ? `<p><strong>The reader right now:</strong> ${escapeHtml(analysis.readerMoment)}</p>` : ""}
        ${analysis.emotionalAngle ? `<p><strong>Angle:</strong> ${escapeHtml(analysis.emotionalAngle)}</p>` : ""}
      </div>

      <dl class="subject-brief-facts">
        <div><dt>Offer</dt><dd>${escapeHtml(analysis.offer || "None in the email")}</dd></div>
        <div><dt>Deadline</dt><dd>${escapeHtml(analysis.deadline || "None in the email")}</dd></div>
        <div><dt>Products</dt><dd>${escapeHtml((analysis.products || []).join(", ") || "–")}</dd></div>
      </dl>

      <div class="subject-brief-columns">
        <section>
          <h5>Hooks in the email</h5>
          <ul class="subject-hook-list">${(analysis.hooks || []).map((hook) => `<li><strong>${escapeHtml(hook.hook)}</strong><q>${escapeHtml(hook.evidence)}</q></li>`).join("")}</ul>
        </section>
        <section>
          <h5>What the email states</h5>
          ${renderList(analysis.facts, "No specific claims.")}
          <h5>Must not promise</h5>
          <div class="subject-must-not">${renderList(analysis.mustNotPromise, "Nothing flagged.")}</div>
        </section>
      </div>

      <section>
        <h5>Mechanisms to carry the set</h5>
        <p class="wp-help">Recommended ones are selected. Click to add or remove; the generator gives about two thirds of the lines to the selected ones and keeps the rest for range.</p>
        ${renderMechanismPicker()}
        <ul class="subject-reason-list">${reasons.map((item) => `<li><strong>${escapeHtml(mechanismLabel(item.mechanism))}:</strong> ${escapeHtml(item.reason)}</li>`).join("")}
        ${(analysis.avoidMechanisms || []).map((item) => `<li class="is-avoid"><strong>Avoid ${escapeHtml(mechanismLabel(item.mechanism))}:</strong> ${escapeHtml(item.reason)}</li>`).join("")}</ul>
      </section>

      <section class="subject-evidence">
        <h5>What Westpack's own sends say</h5>
        ${analysis.houseEvidence ? `<p>${escapeHtml(analysis.houseEvidence)}</p>` : ""}
        ${insights.sendCount ? "" : '<div class="wp-alert is-warning">The send history is not synced, so there is no house evidence yet. Use "Sync history from Klaviyo".</div>'}
        ${(insights.abLessons || []).length ? `<h6>A/B tests that bear on this email</h6>${insights.abLessons.slice(0, 4).map(renderAbTest).join("")}` : ""}
        ${(insights.relevant || []).length ? `<h6>Past sends about something similar</h6><ul class="subject-send-list">${insights.relevant.slice(0, 6).map(renderSendRow).join("")}</ul>` : ""}
        ${(insights.featureStats || []).length ? `<details><summary>Features in DK subject lines, last three years</summary>${renderFeatureStats(insights.featureStats)}</details>` : ""}
      </section>

      ${analysis.translationNotes ? `<p class="wp-help"><strong>Translation:</strong> ${escapeHtml(analysis.translationNotes)}</p>` : ""}
    </div>`;
}

/* ------------------------------------------------------------------ step 3: candidates */

// The inbox line as iPhone Mail shows it: the subject is cut at about 41 characters, so whatever
// runs past that is drawn faded after the cut rather than hidden - the operator sees what is lost.
function renderInbox(candidate) {
  const characters = [...candidate.subject];
  const visible = characters.slice(0, MOBILE_VISIBLE).join("");
  const hidden = characters.slice(MOBILE_VISIBLE).join("");
  return `
    <div class="subject-inbox" aria-label="Inbox preview">
      <div class="subject-inbox-sender">${escapeHtml(state.senderLabel || "Westpack")}</div>
      <div class="subject-inbox-subject">${escapeHtml(visible)}${hidden ? `<span class="subject-inbox-cut" title="Cut on iPhone Mail">${escapeHtml(hidden)}</span>` : ""}</div>
      <div class="subject-inbox-preview">${escapeHtml(candidate.preview || "(no preheader)")}</div>
    </div>`;
}

function statusBadge(candidate) {
  if (candidate.status === "block") return '<span class="wp-badge is-danger">■ Breaks a rule</span>';
  if (candidate.status === "warn") return '<span class="wp-badge is-warning">▲ Check</span>';
  return '<span class="wp-badge is-success">● Passes the rules</span>';
}

function riskBadge(risk) {
  const map = { lav: ["", "Translates easily"], middel: ["is-info", "Translation: some risk"], hoej: ["is-warning", "Translation: high risk"] };
  const [tone, label] = map[risk] || ["", risk || ""];
  return label ? `<span class="wp-badge ${tone}">${escapeHtml(label)}</span>` : "";
}

function renderCandidate(candidate) {
  const editing = state.editing === candidate.id;
  const favourite = (state.team.favourites || []).some((item) => item.subject === candidate.subject && item.preview === candidate.preview);
  return `
    <article class="subject-candidate is-${escapeHtml(candidate.status)}" data-candidate="${escapeHtml(candidate.id)}">
      <header class="subject-candidate-head">
        <span class="wp-badge is-brand">${escapeHtml(mechanismLabel(candidate.mechanism))}</span>
        ${candidate.secondaryMechanism ? `<span class="wp-badge">${escapeHtml(mechanismLabel(candidate.secondaryMechanism))}</span>` : ""}
        ${statusBadge(candidate)}
      </header>
      ${editing ? `
        <label class="field"><span>Subject</span><input class="wp-input" data-edit="subject" type="text" value="${escapeHtml(candidate.subject)}"></label>
        <label class="field"><span>Preheader</span><input class="wp-input" data-edit="preview" type="text" value="${escapeHtml(candidate.preview)}"></label>
      ` : renderInbox(candidate)}
      <p class="subject-candidate-metrics">${candidate.metrics?.subjectLength ?? [...candidate.subject].length} / ${MOBILE_VISIBLE} characters · preheader ${candidate.metrics?.previewLength ?? [...candidate.preview].length}</p>
      ${candidate.rationale ? `<p class="subject-candidate-why">${escapeHtml(candidate.rationale)}</p>` : ""}
      ${candidate.evidence?.length ? `<p class="subject-candidate-evidence">Leans on: ${candidate.evidence.map((item) => escapeHtml(item.label || item)).join(" · ")}</p>` : ""}
      <div class="subject-chip-row">${riskBadge(candidate.translationRisk)}</div>
      ${candidate.translationNote ? `<p class="wp-help">${escapeHtml(candidate.translationNote)}</p>` : ""}
      ${candidate.issues?.length ? `<ul class="subject-issue-list">${candidate.issues.map((issue) => `<li class="is-${escapeHtml(issue.severity)}"><strong>${escapeHtml(issue.label)}:</strong> ${escapeHtml(issue.message)}</li>`).join("")}</ul>` : ""}
      <div class="subject-candidate-actions">
        ${editing
          ? `<button class="primary-button is-sm" data-subject-action="check-edit" data-id="${escapeHtml(candidate.id)}" type="button">Check</button>
             <button class="ghost-button is-sm" data-subject-action="cancel-edit" data-subject-always="true" type="button">Cancel</button>`
          : `<button class="ghost-button is-sm" data-subject-action="copy" data-id="${escapeHtml(candidate.id)}" data-subject-always="true" type="button">Copy</button>
             <button class="ghost-button is-sm" data-subject-action="edit" data-id="${escapeHtml(candidate.id)}" data-subject-always="true" type="button">Edit</button>
             <button class="ghost-button is-sm" data-subject-action="favourite" data-id="${escapeHtml(candidate.id)}" type="button"${favourite ? " disabled" : ""}>${favourite ? "Saved" : "Save"}</button>
             <button class="ghost-button is-sm" data-subject-action="use" data-id="${escapeHtml(candidate.id)}" type="button"${candidate.status === "block" ? " disabled" : ""}>Use in Duplicate &amp; translate</button>
             <button class="ghost-button is-sm" data-subject-action="ban" data-id="${escapeHtml(candidate.id)}" type="button" title="The generator will not write lines like this again">Not like this</button>`}
      </div>
    </article>`;
}

function renderCandidates() {
  const node = byId("subject-lines-candidates");
  if (!node) return;
  if (!state.candidates.length) {
    node.innerHTML = `<p class="wp-help">${state.analysis ? "Write subject lines when the brief looks right." : "The suggestions appear here after the analysis."}</p>`;
    return;
  }
  const counts = state.candidates.reduce((acc, candidate) => ({ ...acc, [candidate.status]: (acc[candidate.status] || 0) + 1 }), {});
  node.innerHTML = `
    ${state.strategyNote ? `<div class="wp-alert is-info subject-strategy">${escapeHtml(state.strategyNote)}</div>` : ""}
    <p class="wp-help">${formatCount(state.candidates.length)} pairs · ${formatCount(counts.ok || 0)} pass the rules, ${formatCount(counts.warn || 0)} to check, ${formatCount(counts.block || 0)} break a rule and stay last. Inbox preview as iPhone Mail shows it; faded text is cut on a phone.</p>
    <div class="subject-candidate-grid">${state.candidates.map(renderCandidate).join("")}</div>
    ${state.examples.length ? `<details class="subject-examples"><summary>The ${formatCount(state.examples.length)} bank patterns the generator was shown</summary><ul>${state.examples.map((entry) => `<li><span class="wp-badge">${escapeHtml(mechanismLabel(entry.mechanisms?.[0]))}</span> ${escapeHtml(entry.subject)}${entry.preview ? ` <span class="subject-muted">— ${escapeHtml(entry.preview)}</span>` : ""}${entry.source === "imported" ? ` <span class="wp-badge is-info">From ${escapeHtml(entry.sender || "a real sender")}</span>` : ""}</li>`).join("")}</ul></details>` : ""}`;
}

function renderActions() {
  const analyse = document.querySelector('[data-subject-action="analyse"]');
  const generate = document.querySelector('[data-subject-action="generate"]');
  const again = document.querySelector('[data-subject-action="generate-again"]');
  if (analyse) analyse.disabled = Boolean(state.busy) || !state.selectedTemplateId;
  if (generate) generate.disabled = Boolean(state.busy) || !state.analysis;
  if (again) again.disabled = Boolean(state.busy) || !state.candidates.length;
}

/* ------------------------------------------------------------------ the bank view */

function renderBank() {
  const node = byId("subject-lines-bank-content");
  if (!node) return;
  document.querySelectorAll("[data-subject-bank-tab]").forEach((tab) => {
    const active = tab.dataset.subjectBankTab === state.bankTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const markets = (state.status?.history?.markets || []).map((market) => market.country);
  const marketSelect = (id, value, includeAll = false) => `
    <select class="wp-select" id="${id}">
      ${includeAll ? '<option value="">All markets</option>' : ""}
      ${markets.map((code) => `<option value="${escapeHtml(code)}"${code === value ? " selected" : ""}>${escapeHtml(code)}</option>`).join("")}
    </select>`;

  if (state.bankTab === "sends") {
    const history = state.history;
    node.innerHTML = `
      <div class="wp-toolbar subject-bank-toolbar">
        <label class="field"><span>Account</span>${marketSelect("subject-bank-country", state.bank.country)}</label>
        <label class="field"><span>Search</span><input class="wp-input" id="subject-bank-query" type="search" value="${escapeHtml(state.bank.query)}" placeholder="Word in subject or campaign"></label>
        <label class="field"><span>Sort</span><select class="wp-select" id="subject-bank-sort">
          ${[["recent", "Newest first"], ["open_index", "Highest open index"], ["click_index", "Highest click index"]].map(([value, label]) => `<option value="${value}"${state.bank.sort === value ? " selected" : ""}>${label}</option>`).join("")}
        </select></label>
      </div>
      <p class="wp-help">Open and click index: the send against its own market's typical rate in the weeks around it (1,00 = typical). Bot clicks are left out. A raw open rate is shown nowhere as a verdict, because Apple Mail opens mail nobody read.</p>
      ${history ? `
        <p class="wp-help">${formatCount(history.total)} sends${history.syncedAt ? ` · synced ${escapeHtml(formatDate(history.syncedAt))}` : ""}</p>
        <div class="wp-table-wrap">
          <table class="wp-table subject-history-table">
            <thead><tr><th scope="col">Sent</th><th scope="col">Subject and preheader</th><th scope="col">Recipients</th><th scope="col">Opened</th><th scope="col">Open index</th><th scope="col">Clicked</th><th scope="col">Click index</th></tr></thead>
            <tbody>${history.entries.map((entry) => `
              <tr>
                <td>${escapeHtml(formatDate(entry.sentAt))}</td>
                <td><strong>${escapeHtml(entry.subject)}</strong>${entry.previewText ? `<br><span class="subject-muted">${escapeHtml(entry.previewText)}</span>` : ""}<br><small class="subject-muted">${escapeHtml(entry.campaignName)}${entry.abTest ? " · A/B arm" : ""}</small></td>
                <td>${formatCount(entry.received)}</td>
                <td>${formatPercent(entry.openRate)}</td>
                <td>${indexBadge(entry.openIndex, "Open")}</td>
                <td>${formatPercent(entry.clickRate, 2)}</td>
                <td>${indexBadge(entry.clickIndex, "Click")}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
        ${history.entries.length < history.total ? '<button class="ghost-button is-sm" data-subject-action="history-more" data-subject-always="true" type="button">Show more</button>' : ""}
        <details><summary>Features in this account's subject lines, last three years</summary>${renderFeatureStats(history.featureStats)}</details>
      ` : '<p class="wp-help">Loading…</p>'}`;
    return;
  }

  if (state.bankTab === "ab") {
    const history = state.history;
    const tests = history?.abTests || [];
    node.innerHTML = `
      <div class="wp-toolbar subject-bank-toolbar">
        <label class="field"><span>Market</span>${marketSelect("subject-ab-country", state.bank.abCountry || "", true)}</label>
        <label class="field"><span>Result</span><select class="wp-select" id="subject-ab-verdict">
          ${[["", "All"], ["klar", "Clear winner"], ["tendens", "Leaning"], ["uafgjort", "Inconclusive"]].map(([value, label]) => `<option value="${value}"${state.bank.verdict === value ? " selected" : ""}>${label}</option>`).join("")}
        </select></label>
      </div>
      <p class="wp-help">Each test is a randomised split of one list, so Apple Mail's automatic opens land on both arms alike and the difference between them is real. With a few hundred recipients per arm, most tests cannot tell two good lines apart; "clear" means a two-sided test at 95 %.</p>
      ${(history?.abFamilies || []).length ? `<details><summary>The same test in several markets (${formatCount(history.abFamilies.length)})</summary><ul class="subject-family-list">${history.abFamilies.slice(0, 60).map((family) => `<li><strong>${escapeHtml(family.campaignName)}</strong>: variant ${escapeHtml(family.leader)} won on opens in ${formatCount(family.leaderWins)} of ${formatCount(family.tests)} markets (${escapeHtml(family.markets.join(", "))}), ${formatCount(family.decisive)} clearly.</li>`).join("")}</ul></details>` : ""}
      ${history ? `<p class="wp-help">${formatCount(history.abTestTotal)} tests of a subject or preheader${history.abTestTotal > tests.length ? `, newest ${formatCount(tests.length)} shown` : ""}.</p><div class="subject-ab-grid">${tests.map(renderAbTest).join("")}</div>` : '<p class="wp-help">Loading…</p>'}`;
    return;
  }

  if (state.bankTab === "patterns") {
    const patterns = state.patterns;
    const mechanisms = state.status?.taxonomy?.mechanisms || [];
    const types = state.status?.taxonomy?.campaignTypes || [];
    const banned = new Set((state.team.banned || []).map((item) => item.id));
    node.innerHTML = `
      <div class="wp-toolbar subject-bank-toolbar">
        <label class="field"><span>Mechanism</span><select class="wp-select" id="subject-pattern-mechanism"><option value="">All</option>${mechanisms.map((item) => `<option value="${escapeHtml(item.key)}"${state.bank.mechanism === item.key ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
        <label class="field"><span>Campaign type</span><select class="wp-select" id="subject-pattern-type"><option value="">All</option>${types.map((item) => `<option value="${escapeHtml(item.key)}"${state.bank.campaignType === item.key ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
        <label class="field"><span>Language</span><select class="wp-select" id="subject-pattern-language">${[["", "All"], ["da", "Danish"], ["en", "English"]].map(([value, label]) => `<option value="${value}"${state.bank.language === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="field"><span>Source</span><select class="wp-select" id="subject-pattern-source">${[["", "All"], ["authored", "Written for the bank"], ["imported", "Imported from real senders"]].map(([value, label]) => `<option value="${value}"${state.bank.source === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="field"><span>Search</span><input class="wp-input" id="subject-pattern-query" type="search" value="${escapeHtml(state.bank.query)}"></label>
      </div>
      <p class="wp-help">Written for the bank, not collected from real senders, and none of it measured: these are patterns for range. Lines imported from real senders are marked with the sender.</p>
      ${patterns ? `
        <p class="wp-help">${formatCount(patterns.total)} pairs match.</p>
        <ul class="subject-pattern-list">${patterns.entries.map((entry) => `
          <li class="${banned.has(entry.id) ? "is-banned" : ""}">
            <div>
              <strong>${escapeHtml(entry.subject)}</strong>
              ${entry.preview ? `<span>${escapeHtml(entry.preview)}</span>` : ""}
              <small>${(entry.mechanisms || []).map((key) => escapeHtml(mechanismLabel(key))).join(" + ")} · ${escapeHtml(campaignTypeLabel(entry.campaignType))} · ${escapeHtml(entry.language)}${entry.source === "imported" ? ` · from ${escapeHtml(entry.sender || "a real sender")}` : ""}${entry.why ? ` · ${escapeHtml(entry.why)}` : ""}</small>
            </div>
            ${banned.has(entry.id)
              ? `<button class="ghost-button is-sm" data-subject-action="unban" data-id="${escapeHtml(entry.id)}" type="button">Allow again</button>`
              : `<button class="ghost-button is-sm" data-subject-action="ban-pattern" data-id="${escapeHtml(entry.id)}" type="button">Never use</button>`}
          </li>`).join("")}</ul>
        ${patterns.entries.length < patterns.total ? '<button class="ghost-button is-sm" data-subject-action="patterns-more" data-subject-always="true" type="button">Show more</button>' : ""}
      ` : '<p class="wp-help">Loading…</p>'}`;
    return;
  }

  if (state.bankTab === "rules") {
    node.innerHTML = `
      <p class="wp-help">Every suggestion is checked against these after it is written, using the email's own text. A blocking rule keeps the line on screen with the reason, at the bottom; a warning asks a person to look.</p>
      <ul class="subject-rule-list">${(state.status?.rules || []).map((rule) => `
        <li>
          ${rule.severity === "block" ? '<span class="wp-badge is-danger">■ Blocks</span>' : '<span class="wp-badge is-warning">▲ Warns</span>'}
          <div><strong>${escapeHtml(rule.label)}</strong><p>${escapeHtml(rule.description)}</p></div>
        </li>`).join("")}</ul>`;
    return;
  }

  if (state.bankTab === "import") {
    const banned = state.team.banned || [];
    node.innerHTML = `
      <div class="subject-import">
        <p>Paste subject lines from newsletters you rate, one per line. "Subject — preheader" or a tab between them keeps both. They are tagged by mechanism and campaign type and join the pattern bank for the whole team, marked with the sender.</p>
        <label class="field"><span>Sender</span><input class="wp-input" id="subject-import-sender" type="text" placeholder="e.g. the brand or shop"></label>
        <label class="field"><span>Subject lines</span><textarea class="wp-textarea" id="subject-import-lines" rows="8" placeholder="Subject line — preheader"></textarea></label>
        <button class="primary-button" data-subject-action="import" type="button">Add to the bank</button>
        <p class="wp-help">${formatCount(state.status?.bank?.imported || 0)} imported lines in the bank.</p>
      </div>
      <h5>Never like this</h5>
      ${banned.length ? `<ul class="subject-pattern-list">${banned.map((item) => `<li><div><strong>${escapeHtml(item.subject || item.id)}</strong>${item.reason ? `<small>${escapeHtml(item.reason)}</small>` : ""}</div><button class="ghost-button is-sm" data-subject-action="unban" data-id="${escapeHtml(item.id)}" type="button">Allow again</button></li>`).join("")}</ul>` : '<p class="wp-help">Nothing banned. "Not like this" on a suggestion, or "Never use" on a pattern, puts it here.</p>'}`;
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
  renderLayers();
  renderFavourites();
  renderTemplates();
  renderBrief();
  renderCandidates();
  renderActions();
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
  renderFavourites();
}

async function loadTemplates() {
  const response = await fetch(`/api/klaviyo/templates?country=${SOURCE_ACCOUNT}`, { credentials: "same-origin" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "The DK templates could not be loaded.");
  state.templates = Array.isArray(payload.templates) ? payload.templates : [];
  renderTemplates();
}

async function loadHistory({ append = false } = {}) {
  const offset = append ? (state.history?.entries?.length || 0) : 0;
  const payload = await callSubjectLines("history", {
    query: { country: state.bank.country, q: state.bank.query, sort: state.bank.sort, offset, limit: 150, verdict: state.bank.verdict, abCountry: state.bank.abCountry || "" }
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
  renderBrief();
  renderCandidates();
  setFeedback(`Brief ready for "${payload.template?.name}". Adjust the mechanisms if needed, then write subject lines.`);
}

async function generate({ again = false } = {}) {
  if (again) state.attempt += 1;
  const count = Number(byId("subject-lines-count")?.value) || 18;
  const note = String(byId("subject-lines-note")?.value || "").trim();
  const payload = await callSubjectLines("generate", {
    method: "POST",
    body: {
      country: SOURCE_ACCOUNT,
      templateId: state.selectedTemplateId,
      analysis: selectedAnalysis(),
      note,
      count,
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
  renderCandidates();
  setFeedback(`${state.candidates.length} pairs written${payload.model ? ` with ${payload.model}` : ""}.`);
}

function findCandidate(id) {
  return state.candidates.find((candidate) => candidate.id === id) || null;
}

async function copyCandidate(candidate) {
  const text = candidate.preview ? `${candidate.subject}\n${candidate.preview}` : candidate.subject;
  try {
    await navigator.clipboard.writeText(text);
    setFeedback("Copied: subject on the first line, preheader on the second.");
  } catch (error) {
    setFeedback("The browser refused the clipboard. Select the text in the card instead.", "is-warning");
  }
}

async function checkEdit(candidate) {
  const card = document.querySelector(`[data-candidate="${CSS.escape(candidate.id)}"]`);
  const subject = card?.querySelector('[data-edit="subject"]')?.value || "";
  const preview = card?.querySelector('[data-edit="preview"]')?.value || "";
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
  renderCandidates();
  setFeedback(payload.candidate.status === "ok" ? "Your edit passes the rules." : "Your edit was checked - see the notes on the card.", payload.candidate.status === "block" ? "is-danger" : "");
}

async function teamOp(body, message) {
  const payload = await callSubjectLines("team", { method: "POST", body });
  if (payload.team) state.team = { favourites: payload.team.favourites || [], banned: payload.team.banned || [] };
  renderFavourites();
  renderCandidates();
  if (state.view === "bank") renderBank();
  if (message) setFeedback(message);
  return payload;
}

// Hands the chosen pair to Duplicate & translate, which then translates it into every market's
// language with the template - instead of translating the template's name as the subject.
function useInDuplicator(candidate) {
  window.dispatchEvent(new CustomEvent("westpack-subject-line-use", {
    detail: {
      account: SOURCE_ACCOUNT,
      templateId: state.selectedTemplateId,
      templateName: state.template?.name || "",
      subject: candidate.subject,
      preview: candidate.preview
    }
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
      if (state.selectedTemplateId === id) return;
      state.selectedTemplateId = id;
      state.analysis = null;
      state.insights = null;
      state.candidates = [];
      state.strategyNote = "";
      state.template = state.templates.find((template) => template.id === id) || null;
      renderTemplates();
      renderBrief();
      renderCandidates();
      renderActions();
    },
    analyse: () => runAction("Reading the email and the house evidence", analyse),
    generate: () => runAction("Writing subject lines", () => generate()),
    "generate-again": () => runAction("Writing new ones", () => generate({ again: true })),
    "toggle-mechanism": () => {
      const key = button.dataset.key;
      state.mechanisms = state.mechanisms.includes(key) ? state.mechanisms.filter((item) => item !== key) : [...state.mechanisms, key];
      renderBrief();
    },
    copy: () => candidate && copyCandidate(candidate),
    edit: () => {
      state.editing = id;
      renderCandidates();
    },
    "cancel-edit": () => {
      state.editing = "";
      renderCandidates();
    },
    "check-edit": () => candidate && runAction("Checking", () => checkEdit(candidate)),
    favourite: () => candidate && runAction("Saving", () => teamOp({ op: "favourite", subject: candidate.subject, preview: candidate.preview, mechanism: candidate.mechanism, campaignName: state.template?.name || "", templateId: state.selectedTemplateId }, "Saved for the team.")),
    unfavourite: () => runAction("Removing", () => teamOp({ op: "unfavourite", id }, "Removed.")),
    ban: () => candidate && runAction("Saving", () => teamOp({ op: "ban", subject: candidate.subject, reason: `Afvist til ${state.template?.name || "en kampagne"}` }, "Noted. The generator will steer away from lines like this.")),
    "ban-pattern": () => {
      const entry = state.patterns?.entries?.find((item) => item.id === id);
      return runAction("Saving", () => teamOp({ op: "ban", id, subject: entry?.subject || id, reason: "Mønster fravalgt i banken" }, "The generator will not be shown this pattern again."));
    },
    unban: () => runAction("Saving", () => teamOp({ op: "unban", id }, "Allowed again.")),
    use: () => candidate && useInDuplicator(candidate),
    sync: () => runAction("Syncing from Klaviyo - a first full sync takes a few minutes", async () => {
      let payload = await callSubjectLines("sync_history", { method: "POST", body: {} });
      for (let round = 0; payload.remaining?.length && round < 4; round += 1) {
        setBusy(`Syncing - ${payload.remaining.length} accounts left`);
        payload = await callSubjectLines("sync_history", { method: "POST", body: {} });
      }
      await loadStatus();
      setFeedback(`Synced ${payload.history?.sends ? `${formatCount(payload.history.sends)} sends` : ""}${payload.failed?.length ? `. Failed: ${payload.failed.map((item) => item.country).join(", ")}` : ""}.`, payload.failed?.length ? "is-warning" : "");
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

function handleKeydown(event) {
  const target = event.target;
  if (target.id === "subject-lines-template-search") {
    state.templateQuery = target.value;
    renderTemplates();
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
  panel.addEventListener("keyup", handleKeydown);
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

export const __subjectLinesInternals = { state, renderInbox, selectedAnalysis };
