// Klaviyo email → Customer survey: the answers to "why have we not seen you for a year", from the survey page on the
// stores (templates/customer-feedback-survey/survey.html), and the personal link each lapsed customer is sent.
//
// Read-only apart from copying links and "Mark as test": the recipient list is uploaded by the script that builds it,
// and answers arrive from the store (api/survey.js). A test typed on the live post without #k=test is stored as a real
// answer; "Mark as test" moves it under "Show test answers" (in place, nothing deleted). Nothing here writes to
// Klaviyo, Magento or Navision.

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

async function markTest(sid, at) {
  if (!window.confirm("Mark this answer as a test? It stops counting and moves under \"Show test answers\". Nothing is deleted.")) return;
  try {
    const response = await fetch("/api/survey?action=mark_test", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [sid ? { sid } : { at }] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  } catch (error) {
    window.alert(`The answer could not be marked: ${error.message}`);
  }
  load();
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

// The customer's last webshop order (from the recipient list: date and number of orders), and how long ago it was -
// the user, 25/11: "fedt hvis man lige havde overblik over sidste ordre" next to what they wrote.
const ORDER_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
function monthsSince(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / (30.44 * 86400000))) : null;
}
function lastOrder(r) {
  const t = Date.parse(r?.sidsteOrdre || "");
  if (!Number.isFinite(t)) return "";
  const m = monthsSince(r.sidsteOrdre);
  const ago = m >= 24 ? `${Math.floor(m / 12)} yr${m % 12 ? ` ${m % 12} mo` : ""} ago` : `${m} mo ago`;
  return `${escapeHtml(ORDER_DATE.format(t))}<br><span class="survey-muted">${ago}${r.ordrer ? ` · ${r.ordrer} order${r.ordrer === 1 ? "" : "s"}` : ""}</span>`;
}

function renderAnswers() {
  const rows = answerRows().filter((r) => matches(`${r.who} ${r.picked} ${r.words} ${reasonLabel(r.a.reason)} ${r.a.recipient?.land || ""}`));
  // The first versions of the survey had reasons to pick, one-tap follow-ups and a contact question; their columns show
  // only while an answer from those versions is in the list.
  const legacy = rows.some(({ a }) => a.reason || (a.detailLabels || []).length || a.contact);
  const cols = legacy ? 9 : 6;
  return `<div class="wp-table-wrap"><table class="wp-table survey-table">
    <thead><tr><th>Answered</th><th>Customer</th><th>Country</th><th class="is-numeric">Lifetime, DKK</th><th>Last order</th>${legacy ? "<th>Main reason</th><th>Picked</th>" : ""}<th>In their words</th>${legacy ? "<th>Contact</th>" : ""}</tr></thead>
    <tbody>${rows.map(({ a, who, picked, words }) => `<tr>
      <td>${escapeHtml(when(a.at))}${a.source === "mail" ? ' <span class="wp-badge" title="A reply to the survey mail, read from the Westpack inbox">Mail</span>' : ""}${a.test ? ' <span class="wp-badge">Test</span>' : `<br><button class="wp-button is-sm" type="button" data-survey-mark-test data-sid="${escapeHtml(a.sid || "")}" data-at="${escapeHtml(a.at || "")}">Mark as test</button>`}</td>
      <td>${escapeHtml(who)}${a.email ? `<br><span class="survey-muted">${escapeHtml(a.email)}</span>` : ""}</td>
      <td>${escapeHtml(a.recipient?.land || storeLabel(a.store))}</td>
      <td class="is-numeric">${a.recipient?.livstid != null ? KR.format(a.recipient.livstid) : ""}</td>
      <td class="survey-last-order">${lastOrder(a.recipient)}</td>
      ${legacy ? `<td>${escapeHtml(reasonLabel(a.reason))}${stepNote(a)}</td><td>${escapeHtml(picked)}</td>` : ""}
      <td class="survey-words">${escapeHtml(words)}</td>
      ${legacy ? `<td>${a.contact === "yes" ? '<span class="wp-status is-success">Yes</span>' : a.contact === "no" ? '<span class="wp-status">No</span>' : ""}</td>` : ""}
    </tr>`).join("") || `<tr><td colspan="${cols}">No answers yet.</td></tr>`}</tbody>
  </table></div>`;
}

// What came back from the survey mail (27/11, the user: "tælle hvor mange gange vi bliver afvist i indbakken ... om de
// er lukket eller der er skiftet rundt i ansvar"): bounces and automatic replies, one row per customer, sorted by the
// script that reads the Westpack inbox (mail-afvisninger.js). The groups answer that question; "Arrived" is not a
// rejection and is shown so the count is complete.
const pct = (n, d) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "");

function renderDelivery() {
  const d = state.data?.delivery;
  if (!d) return state.data?.deliveryUnreadable ? '<p class="survey-muted">What came back from the mail could not be read just now. Press Read again.</p>' : "";
  const max = Math.max(1, ...d.groups.map((g) => g.count));
  const kindLine = (g) => {
    const used = g.kinds.filter((k) => k.count);
    return used.length ? `<br><span class="survey-muted">${used.map((k) => `${escapeHtml(k.label)} ${k.count}`).join(" · ")}</span>` : "";
  };
  return `<h3 class="survey-subhead">What came back from the mail</h3>
    <p class="survey-summary"><strong>${KR.format(d.mailed)}</strong> customers mailed · <strong>${d.notReached}</strong> reached no one (${pct(d.notReached, d.mailed)}) · ${d.items.length - d.notReached} arrived with an automatic reply${d.updatedAt ? ` <span class="survey-muted">· read from the Westpack inbox ${escapeHtml(when(d.updatedAt))}</span>` : ""}</p>
    <div class="survey-delivery">
      <div class="wp-table-wrap"><table class="wp-table survey-table survey-reasons">
        <thead><tr><th>What came back</th><th class="is-numeric">Customers</th><th class="is-numeric">Of mailed</th><th aria-hidden="true"></th></tr></thead>
        <tbody>${d.groups.map((g) => `<tr><td>${escapeHtml(g.label)}${kindLine(g)}</td><td class="is-numeric">${g.count}</td><td class="is-numeric">${pct(g.count, d.mailed)}</td><td class="survey-bar-cell"><span class="survey-bar${g.id === "arrived" ? " is-muted" : ""}" style="width:${Math.round((g.count / max) * 100)}%"></span></td></tr>`).join("")}</tbody>
      </table></div>
      ${d.bands.length ? `<div class="wp-table-wrap"><table class="wp-table survey-table">
        <thead><tr><th>Silent for, at the mail</th><th class="is-numeric">Mailed</th><th class="is-numeric">Reached no one</th><th class="is-numeric">Closed, or probably</th></tr></thead>
        <tbody>${d.bands.map((b) => `<tr><td>${escapeHtml(b.label)}</td><td class="is-numeric">${b.mailed}</td><td class="is-numeric">${b.notReached} <span class="survey-muted">${pct(b.notReached, b.mailed)}</span></td><td class="is-numeric">${b.closed} <span class="survey-muted">${pct(b.closed, b.mailed)}</span></td></tr>`).join("")}</tbody>
      </table></div>` : ""}
    </div>`;
}

function returnedRows() {
  return (state.data?.delivery?.items || []).filter((i) => matches(`${i.recipient?.firma || ""} ${i.recipient?.land || ""} ${i.label}`));
}

function renderReturned() {
  const groupLabel = new Map((state.data?.delivery?.groups || []).map((g) => [g.id, g.label]));
  const tone = { closed: "is-danger", moved: "is-warning", abandoned: "is-warning", data: "is-info", arrived: "is-success" };
  const rows = returnedRows();
  return `<div class="wp-table-wrap"><table class="wp-table survey-table">
    <thead><tr><th>Came back</th><th>Customer</th><th>Country</th><th class="is-numeric">Lifetime, DKK</th><th>Last order</th><th>What came back</th></tr></thead>
    <tbody>${rows.map((i) => `<tr>
      <td>${escapeHtml(when(i.at))}<br><span class="survey-muted">${i.source === "bounce" ? "Bounce" : "Automatic reply"}</span></td>
      <td>${escapeHtml(i.recipient?.firma || "")}</td>
      <td>${escapeHtml(i.recipient?.land || "")}</td>
      <td class="is-numeric">${i.recipient?.livstid != null ? KR.format(i.recipient.livstid) : ""}</td>
      <td class="survey-last-order">${lastOrder(i.recipient)}</td>
      <td><span class="wp-status ${tone[i.group] || ""}">${escapeHtml(groupLabel.get(i.group) || "")}</span><br><span class="survey-muted">${escapeHtml(i.label)}</span></td>
    </tr>`).join("") || '<tr><td colspan="6">Nothing has come back.</td></tr>'}</tbody>
  </table></div>`;
}

function renderRecipients() {
  const answered = new Set(state.data?.answered || []);
  const mailed = state.data?.delivery ? new Set(state.data.delivery.mailedTokens || []) : null;
  const returned = new Map((state.data?.delivery?.items || []).filter((i) => i.group !== "arrived").map((i) => [i.token, i]));
  const status = (r) => {
    if (answered.has(r.token)) return '<span class="wp-status is-success">Answered</span>';
    if (returned.has(r.token)) return `<span class="wp-status is-warning" title="${escapeHtml(returned.get(r.token).label)}">Not reached</span>`;
    if (mailed && !mailed.has(r.token)) return '<span class="wp-status">Not mailed yet</span>';
    return '<span class="wp-status">Not yet</span>';
  };
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
      <td>${status(r)}</td>
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
  const returnedCount = state.data.delivery?.items?.length || 0;
  const tabs = [["answers", "Answers"], ["returned", `Mail that came back${returnedCount ? ` (${returnedCount})` : ""}`], ["recipients", "Customers and links"]];
  const exportLabel = { answers: "answers", returned: "what came back", recipients: "links" };
  const max = Math.max(1, ...state.data.reasons.map((r) => r.count));
  node.innerHTML = `
    ${t.recipients ? "" : '<div class="wp-alert is-warning"><div><strong>No recipient list yet.</strong> Answers are still saved, but no personal links have been made.</div></div>'}
    ${state.data.unreadable ? `<div class="wp-alert is-warning"><div><strong>${state.data.unreadable} saved ${state.data.unreadable === 1 ? "answer" : "answers"} could not be read just now</strong> and ${state.data.unreadable === 1 ? "is" : "are"} not in the figures below. Nothing is lost - press Read again.</div></div>` : ""}
    <p class="survey-summary"><strong>${t.answers}</strong> ${t.answers === 1 ? "answer" : "answers"}${t.fromMail ? ` (${t.fromMail} by reply to the mail)` : ""} · ${state.data.delivery
      ? `<strong>${state.data.delivery.answered}</strong> of the ${KR.format(state.data.delivery.mailed)} customers mailed so far (${pct(state.data.delivery.answered, state.data.delivery.mailed)}) · ${KR.format(t.recipients)} on the list`
      : `<strong>${t.fromRecipients}</strong> of ${t.recipients} customers with a personal link (${rate}%)`} · ${t.anonymous} without a link${t.wantsContact ? ` · <strong>${t.wantsContact}</strong> want to be contacted` : ""}</p>
    ${renderDelivery()}
    ${state.data.reasons.some((r) => r.count) ? `<div class="wp-table-wrap"><table class="wp-table survey-table survey-reasons">
      <thead><tr><th>Main reason</th><th class="is-numeric">Answers</th><th class="is-numeric">Share</th><th aria-hidden="true"></th></tr></thead>
      <tbody>${state.data.reasons.map((r) => `<tr><td>${escapeHtml(r.label)}${detailLine(r)}</td><td class="is-numeric">${r.count}</td><td class="is-numeric">${t.answers - (t.written || 0) ? Math.round((r.count / (t.answers - (t.written || 0))) * 100) : 0}%</td><td class="survey-bar-cell"><span class="survey-bar" style="width:${Math.round((r.count / max) * 100)}%"></span></td></tr>`).join("")}</tbody>
    </table></div>` : ""}
    <div class="signup-toolbar survey-toolbar">
      <div class="wp-tabs" role="tablist">
        ${tabs.map(([id, label]) => `<button type="button" role="tab" class="wp-tab" aria-selected="${state.tab === id}" data-survey-tab="${id}">${escapeHtml(label)}</button>`).join("")}
      </div>
      <input class="wp-input signup-filter" type="search" placeholder="Filter by company, country or words" aria-label="Filter" value="${escapeHtml(state.filter)}" data-survey-filter>
      <label class="wp-check"><input type="checkbox" data-survey-test ${state.showTest ? "checked" : ""}> Show test answers</label>
      <button class="wp-button is-sm" type="button" data-survey-export="${state.tab}">Download ${exportLabel[state.tab] || "answers"} (CSV)</button>
      <button class="wp-button is-sm" type="button" data-survey-reload>Read again</button>
    </div>
    ${state.tab === "answers" ? renderAnswers() : state.tab === "returned" ? renderReturned() : renderRecipients()}
    <p class="survey-muted">The page: <code>…/customer-survey-2026</code> in every store. A personal link adds <code>#k=</code> and a code after the address. Each customer counts once, on their latest answer.</p>`;
}

function exportCsv(kind) {
  if (!state.data) return;
  if (kind === "answers") {
    const rows = answerRows().map(({ a, who, picked }) => [when(a.at), a.source === "mail" ? "Mail reply" : "Survey page", who, a.recipient?.land || "", a.recipient?.marked || "", a.recipient?.livstid ?? "", a.recipient?.sidsteOrdre || "", monthsSince(a.recipient?.sidsteOrdre) ?? "", a.recipient?.ordrer ?? "", reasonLabel(a.reason), picked, a.other, a.followup, a.contact, a.email || "", a.step || 3, a.store, a.lang]);
    download("customer-survey-answers.csv", csv([["Answered", "Via", "Customer", "Country", "Market", "Lifetime DKK", "Last order", "Months since", "Orders", "Main reason", "Picked", "Other reason", "In their words", "Contact", "Email given", "Questions answered", "Store", "Language"], ...rows]));
    return;
  }
  if (kind === "returned") {
    const groupLabel = new Map((state.data.delivery?.groups || []).map((g) => [g.id, g.label]));
    const rows = returnedRows().map((i) => [when(i.at), i.source === "bounce" ? "Bounce" : "Automatic reply", i.recipient?.firma || "", i.recipient?.land || "", i.recipient?.marked || "", i.recipient?.livstid ?? "", i.recipient?.sidsteOrdre || "", monthsSince(i.recipient?.sidsteOrdre) ?? "", groupLabel.get(i.group) || "", i.label]);
    download("customer-survey-mail-came-back.csv", csv([["Came back", "As", "Customer", "Country", "Market", "Lifetime DKK", "Last order", "Months since", "Group", "What came back"], ...rows]));
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
    const mark = target.closest("[data-survey-mark-test]");
    if (mark) markTest(mark.dataset.sid, mark.dataset.at);
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
