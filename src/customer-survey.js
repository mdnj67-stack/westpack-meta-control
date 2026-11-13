// Klaviyo email → Customer survey: the answers to "why have we not seen you for a year", from the blog post
// templates/customer-feedback-survey/survey.html, and the personal link each lapsed customer is sent.
//
// Read-only apart from copying links: the recipient list is uploaded by the script that builds it, and answers
// arrive from the store (api/survey.js). Nothing here writes to Klaviyo, Magento or Navision.

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });
const KR = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

const state = { data: null, error: "", loading: false, showTest: false, filter: "", tab: "answers", copied: "" };

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function when(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? DATE.format(parsed) : "";
}

async function request(action, params = "") {
  const response = await fetch(`/api/survey?action=${encodeURIComponent(action)}${params}`, { credentials: "same-origin" });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("westpack-auth-required"));
    throw new Error("Session expired. Log in again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

// "eur_eu_ger" -> "EU store (ger)"; an answer without a personal link only knows which store it came from.
function storeLabel(store = "") {
  const [, region, lang] = String(store).split("_");
  return region ? `${region.toUpperCase()} store${region === "eu" ? ` (${lang})` : ""}` : "";
}

// Under each reason, how often each one-tap follow-up was picked (only those picked at least once).
function detailLine(r) {
  const picked = (r.details || []).filter((d) => d.count > 0).sort((x, y) => y.count - x.count);
  return picked.length ? `<br><span class="survey-muted">${picked.map((d) => `${escapeHtml(d.label)} ${d.count}`).join(" · ")}</span>` : "";
}

function reasonLabel(id) {
  if (!id) return "Written answer";
  return state.data?.reasons?.find((r) => r.id === id)?.label || id;
}

function matches(text) {
  const f = state.filter.trim().toLowerCase();
  return !f || String(text).toLowerCase().includes(f);
}

function csv(rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿sep=;\r\n" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function answerRows() {
  return (state.data?.answers || []).map((a) => ({
    a,
    who: a.recipient
      ? `${a.recipient.firma}${a.recipient.kontakt && a.recipient.kontakt.toLowerCase() !== String(a.recipient.firma).toLowerCase() ? ` (${a.recipient.kontakt})` : ""}`
      : a.token ? "Unknown link" : "Without a personal link",
    picked: (a.detailLabels || []).join(", "),
    words: [a.other, a.followup].filter(Boolean).join(" – "),
  }));
}

// The post saves after every question, so an answer can stop after the reason (1) or the follow-up (2).
function stepNote(a) {
  const step = a.step || 3;
  return step >= 3 ? "" : `<br><span class="survey-muted">${a.reason ? `Stopped after question ${step}` : "Did not answer the contact question"}</span>`;
}

function renderAnswers() {
  const rows = answerRows().filter((r) => matches(`${r.who} ${r.picked} ${r.words} ${reasonLabel(r.a.reason)} ${r.a.recipient?.land || ""}`));
  return `<div class="wp-table-wrap"><table class="wp-table survey-table">
    <thead><tr><th>Answered</th><th>Customer</th><th>Country</th><th class="is-numeric">Lifetime, DKK</th><th>Main reason</th><th>Picked</th><th>In their words</th><th>Contact</th></tr></thead>
    <tbody>${rows.map(({ a, who, picked, words }) => `<tr>
      <td>${escapeHtml(when(a.at))}${a.test ? ' <span class="wp-badge">Test</span>' : ""}</td>
      <td>${escapeHtml(who)}${a.email ? `<br><span class="survey-muted">${escapeHtml(a.email)}</span>` : ""}</td>
      <td>${escapeHtml(a.recipient?.land || storeLabel(a.store))}</td>
      <td class="is-numeric">${a.recipient?.livstid != null ? KR.format(a.recipient.livstid) : ""}</td>
      <td>${escapeHtml(reasonLabel(a.reason))}${stepNote(a)}</td>
      <td>${escapeHtml(picked)}</td>
      <td class="survey-words">${escapeHtml(words)}</td>
      <td>${a.contact === "yes" ? '<span class="wp-status is-success">Yes</span>' : a.contact === "no" ? '<span class="wp-status">No</span>' : ""}</td>
    </tr>`).join("") || '<tr><td colspan="8">No answers yet.</td></tr>'}</tbody>
  </table></div>`;
}

function renderRecipients() {
  const answered = new Set(state.data?.answered || []);
  const rows = (state.data?.recipients || []).filter((r) => matches(`${r.firma} ${r.kontakt} ${r.land} ${r.marked}`));
  return `<div class="wp-table-wrap"><table class="wp-table survey-table">
    <thead><tr><th class="is-numeric">#</th><th>Company</th><th>Contact</th><th>Country</th><th class="is-numeric">Lifetime, DKK</th><th>Last order</th><th>Answered</th><th>Personal link</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="is-numeric">${escapeHtml(r.rank ?? "")}</td>
      <td>${escapeHtml(r.firma)}</td>
      <td>${escapeHtml(r.kontakt)}</td>
      <td>${escapeHtml(r.land)}</td>
      <td class="is-numeric">${r.livstid != null ? KR.format(r.livstid) : ""}</td>
      <td>${escapeHtml(r.sidsteOrdre)}</td>
      <td>${answered.has(r.token) ? '<span class="wp-status is-success">Answered</span>' : '<span class="wp-status">Not yet</span>'}</td>
      <td><button class="wp-button is-sm" type="button" data-survey-copy="${escapeHtml(r.link)}">${state.copied === r.link ? "Copied" : "Copy link"}</button></td>
    </tr>`).join("") || '<tr><td colspan="8">No recipients match.</td></tr>'}</tbody>
  </table></div>`;
}

function render() {
  const node = byId("klaviyo-customer-survey");
  if (!node) return;
  if (state.error) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The survey could not be loaded</p><p class="wp-state-body">${escapeHtml(state.error)}</p><button class="wp-button is-sm" type="button" data-survey-reload>Try again</button></div>`;
    return;
  }
  if (state.loading || !state.data) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Reading the answers</div>';
    return;
  }
  const t = state.data.totals;
  const rate = t.recipients ? Math.round((t.fromRecipients / t.recipients) * 1000) / 10 : 0;
  const max = Math.max(1, ...state.data.reasons.map((r) => r.count));
  node.innerHTML = `
    ${t.recipients ? "" : '<div class="wp-alert is-warning"><div><strong>No recipient list yet.</strong> Answers are still saved, but no personal links have been made.</div></div>'}
    <p class="survey-summary"><strong>${t.answers}</strong> ${t.answers === 1 ? "answer" : "answers"} · <strong>${t.fromRecipients}</strong> of ${t.recipients} customers with a personal link (${rate}%) · ${t.anonymous} without a link · <strong>${t.wantsContact}</strong> want to be contacted · ${t.finished} finished</p>
    ${state.data.reasons.some((r) => r.count) ? `<div class="wp-table-wrap"><table class="wp-table survey-table survey-reasons">
      <thead><tr><th>Main reason</th><th class="is-numeric">Answers</th><th class="is-numeric">Share</th><th aria-hidden="true"></th></tr></thead>
      <tbody>${state.data.reasons.map((r) => `<tr><td>${escapeHtml(r.label)}${detailLine(r)}</td><td class="is-numeric">${r.count}</td><td class="is-numeric">${t.answers - (t.written || 0) ? Math.round((r.count / (t.answers - (t.written || 0))) * 100) : 0}%</td><td class="survey-bar-cell"><span class="survey-bar" style="width:${Math.round((r.count / max) * 100)}%"></span></td></tr>`).join("")}</tbody>
    </table></div>` : ""}
    <div class="signup-toolbar survey-toolbar">
      <div class="wp-tabs" role="tablist">
        <button type="button" role="tab" class="wp-tab" aria-selected="${state.tab === "answers"}" data-survey-tab="answers">Answers</button>
        <button type="button" role="tab" class="wp-tab" aria-selected="${state.tab === "recipients"}" data-survey-tab="recipients">Customers and links</button>
      </div>
      <input class="wp-input signup-filter" type="search" placeholder="Filter by company, country or words" aria-label="Filter" value="${escapeHtml(state.filter)}" data-survey-filter>
      <label class="wp-check"><input type="checkbox" data-survey-test ${state.showTest ? "checked" : ""}> Show test answers</label>
      <button class="wp-button is-sm" type="button" data-survey-export="${state.tab}">Download ${state.tab === "answers" ? "answers" : "links"} (CSV)</button>
      <button class="wp-button is-sm" type="button" data-survey-reload>Read again</button>
    </div>
    ${state.tab === "answers" ? renderAnswers() : renderRecipients()}
    <p class="survey-muted">The post: <code>…/blog/customer-feedback-2026</code>. A personal link adds <code>#k=</code> and a code after the address; the store's blog drops anything after "?", so the code sits after "#". Each customer counts once, on their latest answer.</p>`;
}

function exportCsv(kind) {
  if (!state.data) return;
  if (kind === "answers") {
    const rows = answerRows().map(({ a, who, picked }) => [when(a.at), who, a.recipient?.land || "", a.recipient?.marked || "", a.recipient?.livstid ?? "", reasonLabel(a.reason), picked, a.other, a.followup, a.contact, a.email || "", a.step || 3, a.store, a.lang]);
    download("customer-survey-answers.csv", csv([["Answered", "Customer", "Country", "Market", "Lifetime DKK", "Main reason", "Picked", "Other reason", "In their words", "Contact", "Email (no link)", "Questions answered", "Store", "Language"], ...rows]));
    return;
  }
  const answered = new Set(state.data.answered || []);
  const rows = state.data.recipients.map((r) => [r.rank, r.firma, r.kontakt, r.land, r.marked, r.livstid, r.sidsteOrdre, answered.has(r.token) ? "Yes" : "No", r.link]);
  download("customer-survey-links.csv", csv([["#", "Company", "Contact", "Country", "Market", "Lifetime DKK", "Last order", "Answered", "Personal link"], ...rows]));
}

async function copy(link) {
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const field = document.createElement("textarea");
    field.value = link;
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  state.copied = link;
  render();
}

async function load() {
  state.loading = true;
  state.error = "";
  render();
  try {
    state.data = await request("results", state.showTest ? "&test=1" : "");
  } catch (error) {
    state.error = error.message;
  }
  state.loading = false;
  render();
}

export function initCustomerSurvey() {
  const node = byId("klaviyo-customer-survey");
  if (!node || node.dataset.wired === "true") return;
  node.dataset.wired = "true";
  node.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-survey-reload]")) load();
    const tab = target.closest("[data-survey-tab]");
    if (tab) { state.tab = tab.dataset.surveyTab; render(); }
    const exp = target.closest("[data-survey-export]");
    if (exp) exportCsv(exp.dataset.surveyExport);
    const link = target.closest("[data-survey-copy]");
    if (link) copy(link.dataset.surveyCopy);
  });
  node.addEventListener("change", (event) => {
    const box = event.target instanceof Element ? event.target.closest("[data-survey-test]") : null;
    if (!box) return;
    state.showTest = box.checked;
    load();
  });
  node.addEventListener("input", (event) => {
    const field = event.target instanceof Element ? event.target.closest("[data-survey-filter]") : null;
    if (!field) return;
    state.filter = field.value;
    render();
    const again = node.querySelector("[data-survey-filter]");
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  });
}

export function loadCustomerSurvey() {
  initCustomerSurvey();
  if (state.data || state.loading) { render(); return; }
  load();
}
