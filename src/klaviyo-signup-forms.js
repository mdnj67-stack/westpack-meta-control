// Klaviyo email → Signup forms: every signup form in the 18 Klaviyo accounts, live or draft, and whether each store
// loads that account's script, so the form can show there at all.
//
// It sits under Klaviyo email rather than beside the Signup Lab because these are Klaviyo's forms: the Signup Lab is
// our own script (src/signup-lab.js), and only touches Klaviyo's forms where it has to - The Insert popups, which it
// takes down where it runs. Read-only: nothing here publishes or unpublishes a form.

const TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

const state = { data: null, error: "", loading: false, checking: false, checkError: "", showDrafts: false, filter: "", markets: [] };

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

function formatTime(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? TIME.format(parsed) : "";
}

async function control(action, { method = "GET" } = {}) {
  const response = await fetch(`/api/signup/control?action=${encodeURIComponent(action)}`, { method, credentials: "same-origin" });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("westpack-auth-required"));
    throw new Error("Session expired. Log in again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function accountName(companyId) {
  const hit = state.markets.find((m) => m.companyId === companyId);
  return hit ? `${hit.market} account` : `account ${companyId}`;
}

// Klaviyo's script on the store decides whether that account's own popups can show there at all.
function klaviyoCell(market, check) {
  const page = check?.live?.[market.market];
  if (!page) return '<span class="wp-status">Not checked</span>';
  if (page.error) return `<span class="wp-status is-warning" title="${escapeHtml(page.error)}">Could not read</span>`;
  const inline = page.klaviyo || [];
  const viaTagManager = check.gtm?.klaviyo || [];
  if (inline.includes(market.companyId)) return '<span class="wp-status is-success">Own account</span>';
  if (viaTagManager.includes(market.companyId)) return '<span class="wp-status is-success">Own account, via Tag Manager</span>';
  const others = [...new Set([...inline, ...viaTagManager])];
  if (others.length) return `<span class="wp-status is-danger">${escapeHtml(others.map(accountName).join(", "))} only</span>`;
  return '<span class="wp-status is-warning">None</span>';
}

function render() {
  const node = byId("klaviyo-signup-forms");
  if (!node) return;
  if (state.error) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The forms could not be loaded</p><p class="wp-state-body">${escapeHtml(state.error)}</p><button class="wp-button is-sm" type="button" data-forms-reload>Try again</button></div>`;
    return;
  }
  if (state.loading || !state.data) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Reading the forms in 18 Klaviyo accounts</div>';
    return;
  }
  const check = state.data.storeCheck;
  const filter = state.filter.trim().toLowerCase();
  const rows = [];
  for (const m of state.data.markets) {
    const entry = state.markets.find((x) => x.market === m.market) || { market: m.market };
    if (m.error) { rows.push(`<tr><td><strong>${escapeHtml(m.market)}</strong></td><td colspan="4">${escapeHtml(m.error)}</td></tr>`); continue; }
    const forms = m.forms.filter((form) => (state.showDrafts || form.status === "live") && (!filter || `${m.market} ${form.name}`.toLowerCase().includes(filter)));
    forms.forEach((form, i) => rows.push(`<tr>
      <td>${i === 0 ? `<strong>${escapeHtml(m.market)}</strong>` : ""}</td>
      <td>${escapeHtml(form.name)}${form.insert ? ' <span class="wp-badge is-info" title="Taken down by the Signup Lab where it runs live, and put back where it stops">The Insert</span>' : ""}</td>
      <td><span class="wp-status ${form.status === "live" ? "is-success" : ""}">${form.status === "live" ? "Live" : "Draft"}</span></td>
      <td>${escapeHtml(formatTime(form.updatedAt))}</td>
      <td>${i === 0 ? klaviyoCell(entry, check) : ""}</td>
    </tr>`));
  }
  const liveCount = state.data.markets.reduce((n, m) => n + m.forms.filter((x) => x.status === "live").length, 0);
  node.innerHTML = `
    <div class="wp-alert is-info"><div><strong>A live form is not necessarily a form anyone sees.</strong> Klaviyo only shows an account's popups on a store that loads that account's script. The last column says what each store loads${check ? `, as of ${escapeHtml(formatTime(check.at))}` : ""}.</div></div>
    ${state.checkError ? `<div class="wp-alert is-danger"><div><strong>The stores could not be checked.</strong> ${escapeHtml(state.checkError)}</div></div>` : ""}
    <div class="signup-toolbar">
      <input class="wp-input signup-filter" type="search" placeholder="Filter by market or name" aria-label="Filter the forms" value="${escapeHtml(state.filter)}" data-forms-filter>
      <label class="wp-check"><input type="checkbox" data-forms-drafts ${state.showDrafts ? "checked" : ""}> Show drafts</label>
      <span class="signup-window">${liveCount} live forms · read ${escapeHtml(formatTime(state.data.at))}</span>
      <button class="wp-button is-sm" type="button" data-forms-check ${state.checking ? "disabled" : ""}>${state.checking ? "Checking the stores…" : "Check the stores"}</button>
      <button class="wp-button is-sm" type="button" data-forms-reload>Read again</button>
    </div>
    <div class="wp-table-wrap"><table class="wp-table signup-forms">
      <thead><tr><th>Market</th><th>Form</th><th>Status</th><th>Updated</th><th>Klaviyo's script on the store</th></tr></thead>
      <tbody>${rows.join("") || '<tr><td colspan="5">No forms match.</td></tr>'}</tbody>
    </table></div>`;
}

async function load() {
  state.loading = true;
  state.error = "";
  render();
  try {
    const [forms, status] = await Promise.all([control("forms"), state.markets.length ? null : control("status")]);
    if (status) state.markets = status.markets || [];
    state.data = forms;
  } catch (error) {
    state.error = error.message;
  }
  state.loading = false;
  render();
}

async function checkStores() {
  state.checking = true;
  state.checkError = "";
  render();
  try {
    const status = await control("store_check", { method: "POST" });
    state.markets = status.markets || state.markets;
    if (state.data) state.data.storeCheck = status.control?.storeCheck || state.data.storeCheck;
  } catch (error) {
    state.checkError = error.message;
  }
  state.checking = false;
  render();
}

export function initKlaviyoSignupForms() {
  const node = byId("klaviyo-signup-forms");
  if (!node || node.dataset.wired === "true") return;
  node.dataset.wired = "true";
  node.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-forms-reload]")) load();
    if (target?.closest("[data-forms-check]")) checkStores();
  });
  node.addEventListener("change", (event) => {
    const box = event.target instanceof Element ? event.target.closest("[data-forms-drafts]") : null;
    if (!box) return;
    state.showDrafts = box.checked;
    render();
  });
  node.addEventListener("input", (event) => {
    const field = event.target instanceof Element ? event.target.closest("[data-forms-filter]") : null;
    if (!field) return;
    state.filter = field.value;
    render();
    const again = node.querySelector("[data-forms-filter]");
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  });
}

export function loadKlaviyoSignupForms() {
  initKlaviyoSignupForms();
  if (state.data || state.loading) { render(); return; }
  load();
}
