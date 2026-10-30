// Signup: the newsletter signup on the webshops, run from here rather than from code.
//
// The Signup Lab is our own signup experience, loaded on the stores by one script tag. This page decides what that
// script runs - on or off for the live stores and for staging, which of the three experiences, which markets - and
// shows whether the stores carry the tag, how the experience is doing, and every signup form in the 18 Klaviyo
// accounts. The only writes outside this app are The Insert popups, which come down where the Signup Lab goes live
// and go back up where it stops (api/signup/control.js).

const state = {
  view: "control",
  status: null,
  error: "",
  busy: "",
  pending: null,
  notice: null,
  previewConcept: "",
  results: { env: "live", days: 14, data: null, error: "", loading: false, confirmed: null, confirmedError: "", confirmedLoading: false },
  forms: { data: null, error: "", loading: false, showDrafts: false, filter: "" }
};

const VIEWS = ["control", "results", "forms", "preview"];
const STAGING_STORE = "https://westpack-staging.wexohosting.com/dkk_dk_den/";
const NUMBER = new Intl.NumberFormat("en-GB");
const TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

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

function percent(value, digits = 2) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "–";
}

function count(value) {
  return Number.isFinite(value) ? NUMBER.format(value) : "–";
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function call(path, { method = "GET", body = null, query = {} } = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
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
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

const control = (action, options = {}) => call("/api/signup/control", { ...options, query: { action, ...(options.query || {}) } });

function conceptName(id) {
  return state.status?.concepts?.find((c) => c.id === id)?.name || id;
}

function marketEntries() {
  return state.status?.markets || [];
}

function accountName(companyId) {
  const hit = marketEntries().find((m) => m.companyId === companyId);
  return hit ? `${hit.market} account` : `account ${companyId}`;
}

// Markets whose live store carries the tag and that are switched on: where live actually runs when it is on.
function reachMarkets(c) {
  const live = c.storeCheck?.live || {};
  return marketEntries().map((m) => m.market).filter((m) => live[m]?.tag === "yes" && c.live.markets[m]);
}

// ---------------------------------------------------------------------------------------------
// Signup Lab (the control)

function tagCell(page, { notChecked = "Not checked" } = {}) {
  if (!page) return `<span class="wp-status">${escapeHtml(notChecked)}</span>`;
  if (page.error) return `<span class="wp-status is-warning" title="${escapeHtml(page.error)}">Could not read</span>`;
  if (page.tag === "yes") return '<span class="wp-status is-success">Installed</span>';
  if (page.tag === "test-only") return '<span class="wp-status is-warning">Test tag only</span>';
  return '<span class="wp-status">Not installed</span>';
}

// Klaviyo's script on the store decides whether that account's own popups can show there at all.
function klaviyoCell(market, check) {
  const page = check?.live?.[market.market];
  if (!page) return '<span class="wp-status">Not checked</span>';
  if (page.error) return '<span class="wp-status is-warning">Could not read</span>';
  const inline = page.klaviyo || [];
  const viaTagManager = check.gtm?.klaviyo || [];
  if (inline.includes(market.companyId)) return '<span class="wp-status is-success">Own account</span>';
  if (viaTagManager.includes(market.companyId)) return '<span class="wp-status is-success">Own account, via Tag Manager</span>';
  const others = [...new Set([...inline, ...viaTagManager])];
  if (others.length) return `<span class="wp-status is-danger">${escapeHtml(others.map(accountName).join(", "))} only</span>`;
  return '<span class="wp-status is-warning">None</span>';
}

function renderNotice() {
  if (state.pending) {
    const { text, plan } = state.pending;
    const lines = [
      ...plan.unpublish.map((f) => `Unpublishes The Insert popup in ${f.market} (${f.name || f.id}), so nobody there gets two popups.`),
      ...plan.republish.map((f) => `Publishes The Insert popup in ${f.market} (${f.name || f.id}) again.`)
    ];
    return `<div class="wp-alert is-warning signup-confirm" role="alertdialog" aria-label="Confirm the change"><div>
      <strong>${escapeHtml(text)}</strong>
      ${lines.length ? `<ul class="signup-plan">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : "<p>Nothing changes in Klaviyo.</p>"}
      <p>The stores pick the change up within a minute.</p>
      <div class="wp-button-group">
        <button class="wp-button is-primary" type="button" data-signup-confirm ${state.busy ? "disabled" : ""}>Confirm</button>
        <button class="wp-button is-ghost" type="button" data-signup-cancel ${state.busy ? "disabled" : ""}>Cancel</button>
      </div>
    </div></div>`;
  }
  if (state.notice) return `<div class="wp-alert ${state.notice.tone}"><div><strong>${escapeHtml(state.notice.title)}</strong>${escapeHtml(state.notice.body || "")}</div></div>`;
  return "";
}

function renderConcept(concept, c) {
  const onLive = c.live.current === concept.id;
  const onStaging = c.staging.current === concept.id;
  const tags = [
    onLive ? `<span class="wp-badge ${c.live.on ? "is-success" : ""}">${c.live.on ? "Running on live" : "Live (switched off)"}</span>` : "",
    onStaging ? `<span class="wp-badge ${c.staging.on ? "is-info" : ""}">${c.staging.on ? "Running on staging" : "Staging (switched off)"}</span>` : ""
  ].join("");
  return `<article class="signup-concept${onLive || onStaging ? " is-current" : ""}">
    <img class="signup-concept-image" src="${escapeHtml(concept.image)}" alt="" loading="lazy">
    <div class="signup-concept-body">
      <h4 class="signup-concept-name">${escapeHtml(concept.name)}</h4>
      <p class="signup-concept-line">${escapeHtml(concept.line)}</p>
      <div class="signup-concept-tags">${tags || '<span class="wp-badge">Waiting its turn</span>'}</div>
      <div class="wp-button-group">
        <button class="wp-button is-sm" type="button" data-signup-run="staging" data-concept="${concept.id}" ${onStaging || state.busy ? "disabled" : ""}>Run on staging</button>
        <button class="wp-button is-sm" type="button" data-signup-run="live" data-concept="${concept.id}" ${onLive || state.busy ? "disabled" : ""}>Run on live</button>
        <button class="wp-button is-ghost is-sm" type="button" data-signup-preview="${concept.id}">Preview</button>
      </div>
    </div>
  </article>`;
}

function renderControl() {
  const node = byId("signup-control");
  if (!node) return;
  if (state.error && !state.status) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The Signup page could not be loaded</p><p class="wp-state-body">${escapeHtml(state.error)}</p></div>`;
    return;
  }
  if (!state.status) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Loading</div>';
    return;
  }
  const c = state.status.control;
  const check = c.storeCheck;
  const reach = reachMarkets(c);
  const installedLive = marketEntries().filter((m) => check?.live?.[m.market]?.tag === "yes").length;
  const busy = Boolean(state.busy);

  node.innerHTML = `
    ${renderNotice()}
    <div class="wp-metrics signup-metrics">
      <div class="wp-metric"><span class="wp-metric-label">Live stores</span><span class="wp-metric-value">${c.live.on ? "On" : "Off"}</span>
        <span class="wp-metric-foot">${c.live.on ? `Runs on ${reach.length} of 18 stores` : "The stores' tag does nothing"}</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Live runs</span><span class="wp-metric-value is-text">${escapeHtml(conceptName(c.live.current))}</span>
        <span class="wp-metric-foot">One experience at a time</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Staging</span><span class="wp-metric-value">${c.staging.on ? "On" : "Off"}</span>
        <span class="wp-metric-foot">Test list only</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Staging runs</span><span class="wp-metric-value is-text">${escapeHtml(conceptName(c.staging.current))}</span>
        <span class="wp-metric-foot"><a href="${STAGING_STORE}?wps=reset" target="_blank" rel="noopener">Open staging as a new visitor</a></span></div>
    </div>

    <section class="wp-section">
      <div class="wp-section-header"><div>
        <h3 class="wp-section-title">Experiences</h3>
        <p class="wp-section-description">One runs at a time until it is worn out, then the next. Staging can run a different one from live, so the next experience can be tested while the current one runs.</p>
      </div></div>
      <div class="signup-concepts">${state.status.concepts.map((concept) => renderConcept(concept, c)).join("")}</div>
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div>
        <h3 class="wp-section-title">Where it runs</h3>
        <p class="wp-section-description">Switching live on takes down The Insert popup in each market where the Signup Lab then runs, so nobody gets two popups; switching off puts back exactly the popups this page took down. Live only reaches a store whose page carries the tag.</p>
      </div></div>
      <div class="signup-switches">
        <div class="signup-switch">
          <div><strong>Live stores</strong><p>www.westpack.com · ${installedLive} of 18 stores carry the tag${check ? "" : " (not checked yet)"}</p></div>
          <span class="wp-status ${c.live.on ? "is-success" : ""}">${c.live.on ? "On" : "Off"}</span>
          <button class="wp-button ${c.live.on ? "" : "is-primary"}" type="button" data-signup-live="${c.live.on ? "off" : "on"}" ${busy ? "disabled" : ""}>${c.live.on ? "Switch live off" : "Switch live on"}</button>
        </div>
        <div class="signup-switch">
          <div><strong>Staging</strong><p>${escapeHtml((state.status.stagingHosts || []).join(", "))} · every signup goes to the test list</p></div>
          <span class="wp-status ${c.staging.on ? "is-success" : ""}">${c.staging.on ? "On" : "Off"}</span>
          <button class="wp-button" type="button" data-signup-staging="${c.staging.on ? "off" : "on"}" ${busy ? "disabled" : ""}>${c.staging.on ? "Switch staging off" : "Switch staging on"}</button>
        </div>
      </div>

      <div class="signup-table-head">
        <p>${check ? `Stores checked ${escapeHtml(formatTime(check.at))}.` : "The stores have not been checked yet."} ${check?.stagingNote ? escapeHtml(check.stagingNote) : ""}</p>
        <button class="wp-button is-sm" type="button" data-signup-check ${busy ? "disabled" : ""}>${state.busy === "check" ? "Checking the stores…" : "Check the stores now"}</button>
      </div>
      <div class="wp-table-wrap"><table class="wp-table signup-markets">
        <thead><tr><th>Market</th><th>Tag on the live store</th><th>Tag on staging</th><th>Klaviyo's script on the store</th><th>Signup Lab on live</th></tr></thead>
        <tbody>${marketEntries().map((m) => `<tr>
          <td><strong>${escapeHtml(m.market)}</strong> <span class="signup-code">${escapeHtml(m.code)}</span></td>
          <td>${tagCell(check?.live?.[m.market])}</td>
          <td>${tagCell(check?.staging?.[m.market], { notChecked: check?.staging === null && check ? "Not checked (login)" : "Not checked" })}</td>
          <td>${klaviyoCell(m, check)}</td>
          <td><label class="wp-check"><input type="checkbox" data-signup-market="${m.market}" ${c.live.markets[m.market] ? "checked" : ""} ${busy ? "disabled" : ""}> ${c.live.markets[m.market] ? "On" : "Off"}</label></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Changes</h3></div></div>
      ${c.history.length ? `<ul class="signup-history">${c.history.slice(0, 25).map((h) => `<li><time>${escapeHtml(formatTime(h.at))}</time><span>${escapeHtml(h.text)}</span></li>`).join("")}</ul>` : '<p class="signup-empty">Nothing has been changed from this page yet. Until it is, the stores run the defaults set in the code: live off, staging on, Logo studio.</p>'}
    </section>`;
}

async function loadStatus() {
  try {
    state.status = await control("status");
    state.error = "";
  } catch (error) {
    state.error = error.message;
  }
  if (state.view === "control") renderControl();
}

// Changes that reach live visitors or Klaviyo are shown first and confirmed; staging changes go straight through.
function needsConfirmation(change) {
  if (["live", "market"].includes(change.type)) return true;
  return change.type === "current" && change.env === "live" && state.status?.control?.live?.on;
}

async function requestChange(change) {
  state.notice = null;
  state.busy = "change";
  renderControl();
  try {
    if (needsConfirmation(change)) {
      const preview = await control("change", { method: "POST", body: { change, dryRun: true } });
      state.pending = { change, text: preview.text, plan: preview.plan };
    } else {
      await applyChange(change);
    }
  } catch (error) {
    state.notice = { tone: "is-danger", title: "Not changed. ", body: error.message };
  }
  state.busy = "";
  renderControl();
}

async function applyChange(change) {
  const result = await control("change", { method: "POST", body: { change } });
  state.status = result;
  const failed = (result.done || []).filter((d) => !d.ok);
  state.notice = failed.length
    ? { tone: "is-danger", title: `${result.text} `, body: `But ${failed.length} Insert popup change(s) failed: ${failed.map((d) => `${d.market} ${d.id}`).join(", ")}. Check them in Klaviyo.` }
    : { tone: "is-success", title: `${result.text} `, body: "The stores pick it up within a minute." };
}

async function confirmPending() {
  if (!state.pending) return;
  const { change } = state.pending;
  state.busy = "change";
  renderControl();
  try {
    await applyChange(change);
  } catch (error) {
    state.notice = { tone: "is-danger", title: "Not changed. ", body: error.message };
  }
  state.pending = null;
  state.busy = "";
  renderControl();
}

async function checkStoresNow() {
  state.busy = "check";
  state.notice = null;
  renderControl();
  try {
    state.status = await control("store_check", { method: "POST" });
  } catch (error) {
    state.notice = { tone: "is-danger", title: "The stores could not be checked. ", body: error.message };
  }
  state.busy = "";
  renderControl();
}

// ---------------------------------------------------------------------------------------------
// Results

function funnelRow(name, b) {
  return `<tr>
    <td><strong>${escapeHtml(name)}</strong></td>
    <td class="is-numeric">${count(b.exposures)}</td>
    <td class="is-numeric">${count(b.peekShown)}</td>
    <td class="is-numeric">${count(b.opened)}</td>
    <td class="is-numeric">${count(b.interacted)}</td>
    <td class="is-numeric">${count(b.emailFocus)}</td>
    <td class="is-numeric">${count(b.subscribed)}</td>
    <td class="is-numeric">${percent(b.subscribedPerExposure)}</td>
    <td class="is-numeric">${percent(b.subscribedPerOpen, 1)}</td>
    <td class="is-numeric">${b.medianSecondsToSubscribe == null ? "–" : `${b.medianSecondsToSubscribe} s`}</td>
  </tr>`;
}

function splitList(map = {}) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([k, v]) => `<span class="signup-split"><strong>${escapeHtml(k)}</strong> ${count(v)}</span>`).join("") : '<span class="signup-empty">None</span>';
}

function renderResults() {
  const node = byId("signup-results");
  if (!node) return;
  const r = state.results;
  const controls = `<div class="signup-toolbar">
    <div class="wp-segment" role="tablist">
      <button class="wp-segment-item ${r.env === "live" ? "active" : ""}" type="button" data-signup-env="live">Live stores</button>
      <button class="wp-segment-item ${r.env === "test" ? "active" : ""}" type="button" data-signup-env="test">Staging and tests</button>
    </div>
    <div class="wp-segment" role="tablist">
      ${[7, 14, 30].map((d) => `<button class="wp-segment-item ${r.days === d ? "active" : ""}" type="button" data-signup-days="${d}">${d} days</button>`).join("")}
    </div>
  </div>`;
  if (r.error) {
    node.innerHTML = `${controls}<div class="wp-state is-error"><p class="wp-state-title">The figures could not be loaded</p><p class="wp-state-body">${escapeHtml(r.error)}</p></div>`;
    return;
  }
  if (r.loading || !r.data) {
    node.innerHTML = `${controls}<div class="wp-loading"><span class="wp-spinner"></span> Loading</div>`;
    return;
  }
  const d = r.data;
  const t = d.total;
  const concepts = Object.entries(d.concepts || {});
  const confirmed = r.confirmed;
  node.innerHTML = `${controls}
    <p class="signup-window">${escapeHtml(d.from)} to ${escapeHtml(d.to)} · ${r.env === "live" ? "visitors on the live stores" : "staging, previews on the stores and test runs; never a real list"}</p>
    <div class="wp-metrics signup-metrics">
      <div class="wp-metric"><span class="wp-metric-label">Shown</span><span class="wp-metric-value">${count(t.exposures)}</span><span class="wp-metric-foot">Visitors who got the experience</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Opened</span><span class="wp-metric-value">${count(t.opened)}</span><span class="wp-metric-foot">The dialog, or the phone card tapped</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Signed up</span><span class="wp-metric-value">${count(t.subscribed)}</span><span class="wp-metric-foot">Accepted by Klaviyo</span></div>
      <div class="wp-metric is-lead"><span class="wp-metric-label">Signed up per shown</span><span class="wp-metric-value">${percent(t.subscribedPerExposure)}</span><span class="wp-metric-foot">The figure that decides when an experience is worn out</span></div>
    </div>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">By experience</h3>
        <p class="wp-section-description">"Shown" is the dialog on a computer or the card on a phone. A signup is counted when Klaviyo accepts it; whether it stuck is under Klaviyo below.</p></div></div>
      ${concepts.length ? `<div class="wp-table-wrap"><table class="wp-table">
        <thead><tr><th>Experience</th><th class="is-numeric">Shown</th><th class="is-numeric">Phone card</th><th class="is-numeric">Opened</th><th class="is-numeric">Interacted</th><th class="is-numeric">Typed email</th><th class="is-numeric">Signed up</th><th class="is-numeric">Per shown</th><th class="is-numeric">Per opened</th><th class="is-numeric">Median time</th></tr></thead>
        <tbody>${concepts.map(([id, b]) => funnelRow(conceptName(id), b)).join("")}</tbody>
      </table></div>` : '<p class="signup-empty">Nobody has been shown the experience in this window.</p>'}
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Who saw it</h3></div></div>
      <div class="signup-splits"><div><span class="signup-split-label">Devices</span>${splitList(t.devices)}</div><div><span class="signup-split-label">Markets</span>${splitList(t.markets)}</div></div>
    </section>

    ${r.env === "live" ? `<section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">In Klaviyo</h3>
        <p class="wp-section-description">What actually landed on each market's list, and what Klaviyo's bot protection took. Reads every account, so it is fetched when you ask.</p></div>
        <button class="wp-button is-sm" type="button" data-signup-confirmed ${r.confirmedLoading ? "disabled" : ""}>${r.confirmedLoading ? "Reading Klaviyo…" : "Check Klaviyo"}</button></div>
      ${r.confirmedError ? `<div class="wp-alert is-danger"><div><strong>Klaviyo could not be read. </strong>${escapeHtml(r.confirmedError)}</div></div>` : ""}
      ${confirmed ? `<div class="wp-table-wrap"><table class="wp-table">
        <thead><tr><th>Market</th><th class="is-numeric">Submitted</th><th class="is-numeric">On the list</th><th class="is-numeric">Taken by bot protection</th></tr></thead>
        <tbody>${confirmed.markets.filter((m) => m.error || m.submitted || m.confirmed).map((m) => `<tr><td><strong>${escapeHtml(m.market)}</strong></td>${m.error ? `<td colspan="3">${escapeHtml(m.error)}</td>` : `<td class="is-numeric">${count(m.submitted)}</td><td class="is-numeric">${count(m.confirmed)}</td><td class="is-numeric">${count(m.botBlocked)}</td>`}</tr>`).join("") || '<tr><td colspan="4">No signups from the Signup Lab in this window.</td></tr>'}
        <tr class="signup-total"><td>All markets</td><td class="is-numeric">${count(confirmed.total.submitted)}</td><td class="is-numeric">${count(confirmed.total.confirmed)}</td><td class="is-numeric">${count(confirmed.total.botBlocked)}</td></tr></tbody>
      </table></div>` : ""}
    </section>` : ""}`;
}

async function loadResults() {
  const r = state.results;
  r.loading = true;
  r.error = "";
  renderResults();
  try {
    r.data = await call("/api/signup/track", { query: { action: "report", env: r.env, from: isoDay(Date.now() - (r.days - 1) * 86400000) } });
  } catch (error) {
    r.error = error.message;
  }
  r.loading = false;
  if (state.view === "results") renderResults();
}

async function loadConfirmed() {
  const r = state.results;
  r.confirmedLoading = true;
  r.confirmedError = "";
  renderResults();
  try {
    r.confirmed = await call("/api/signup/track", { query: { action: "confirmed", from: isoDay(Date.now() - (r.days - 1) * 86400000) } });
  } catch (error) {
    r.confirmedError = error.message;
  }
  r.confirmedLoading = false;
  if (state.view === "results") renderResults();
}

// ---------------------------------------------------------------------------------------------
// Klaviyo forms

function renderForms() {
  const node = byId("signup-forms");
  if (!node) return;
  const f = state.forms;
  if (f.error) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The forms could not be loaded</p><p class="wp-state-body">${escapeHtml(f.error)}</p></div>`;
    return;
  }
  if (f.loading || !f.data) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Reading the forms in 18 Klaviyo accounts</div>';
    return;
  }
  const check = f.data.storeCheck;
  const markets = marketEntries();
  const filter = f.filter.trim().toLowerCase();
  const rows = [];
  for (const m of f.data.markets) {
    const entry = markets.find((x) => x.market === m.market) || { market: m.market };
    if (m.error) { rows.push(`<tr><td><strong>${escapeHtml(m.market)}</strong></td><td colspan="4">${escapeHtml(m.error)}</td></tr>`); continue; }
    const forms = m.forms.filter((form) => (f.showDrafts || form.status === "live") && (!filter || `${m.market} ${form.name}`.toLowerCase().includes(filter)));
    forms.forEach((form, i) => rows.push(`<tr>
      <td>${i === 0 ? `<strong>${escapeHtml(m.market)}</strong>` : ""}</td>
      <td>${escapeHtml(form.name)}${form.insert ? ' <span class="wp-badge is-info" title="Taken down where the Signup Lab goes live, and put back where it stops">The Insert</span>' : ""}</td>
      <td><span class="wp-status ${form.status === "live" ? "is-success" : ""}">${form.status === "live" ? "Live" : "Draft"}</span></td>
      <td>${escapeHtml(formatTime(form.updatedAt))}</td>
      <td>${i === 0 ? klaviyoCell(entry, check) : ""}</td>
    </tr>`));
  }
  const liveCount = f.data.markets.reduce((n, m) => n + m.forms.filter((x) => x.status === "live").length, 0);
  node.innerHTML = `
    <div class="wp-alert is-info"><div><strong>A live form is not necessarily a form anyone sees. </strong>Klaviyo only shows an account's popups on a store that loads that account's script. The last column says what each store loads${check ? `, as of ${escapeHtml(formatTime(check.at))}` : " once the stores have been checked on the Signup Lab page"}.</div></div>
    <div class="signup-toolbar">
      <input class="wp-input signup-filter" type="search" placeholder="Filter by market or name" value="${escapeHtml(f.filter)}" data-signup-filter>
      <label class="wp-check"><input type="checkbox" data-signup-drafts ${f.showDrafts ? "checked" : ""}> Show drafts</label>
      <span class="signup-window">${liveCount} live forms · read ${escapeHtml(formatTime(f.data.at))}</span>
      <button class="wp-button is-sm" type="button" data-signup-forms-reload>Read again</button>
    </div>
    <div class="wp-table-wrap"><table class="wp-table signup-forms">
      <thead><tr><th>Market</th><th>Form</th><th>Status</th><th>Updated</th><th>Klaviyo's script on the store</th></tr></thead>
      <tbody>${rows.join("") || '<tr><td colspan="5">No forms match.</td></tr>'}</tbody>
    </table></div>`;
}

async function loadForms() {
  const f = state.forms;
  f.loading = true;
  f.error = "";
  renderForms();
  try {
    if (!state.status) await loadStatus();
    f.data = await control("forms");
  } catch (error) {
    f.error = error.message;
  }
  f.loading = false;
  if (state.view === "forms") renderForms();
}

// ---------------------------------------------------------------------------------------------
// Preview

function renderPreview() {
  const node = byId("signup-preview");
  if (!node) return;
  const concept = state.previewConcept || state.status?.control?.live?.current || "logo-studio";
  const src = `/signup/preview?concept=${encodeURIComponent(concept)}`;
  const frame = node.querySelector("iframe");
  // the frame keeps its own state (market, device, steps); it is only reloaded for another experience
  if (frame && frame.dataset.concept === concept) return;
  node.innerHTML = `<p class="signup-window">The same page the experience is designed on: pick a market, a device and a step on its left. Nothing is sent to Klaviyo. To see it on the real store, <a href="${STAGING_STORE}?wps=${encodeURIComponent(concept)}" target="_blank" rel="noopener">open it on staging</a>.</p>
    <iframe class="signup-preview-frame" title="Signup Lab preview" src="${src}" data-concept="${escapeHtml(concept)}"></iframe>`;
}

// ---------------------------------------------------------------------------------------------
// Wiring

function setActiveNav() {
  document.querySelectorAll("[data-signup-view]").forEach((button) => {
    button.classList.toggle("active", document.body.dataset.workspace === "signup" && button.dataset.signupView === state.view);
  });
}

function showPanels() {
  document.querySelectorAll("[data-signup-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.signupPanel !== state.view;
  });
  setActiveNav();
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const run = target.closest("[data-signup-run]");
  if (run) return requestChange({ type: "current", env: run.dataset.signupRun, concept: run.dataset.concept });
  const live = target.closest("[data-signup-live]");
  if (live) return requestChange({ type: "live", on: live.dataset.signupLive === "on" });
  const staging = target.closest("[data-signup-staging]");
  if (staging) return requestChange({ type: "staging", on: staging.dataset.signupStaging === "on" });
  if (target.closest("[data-signup-confirm]")) return confirmPending();
  if (target.closest("[data-signup-cancel]")) {
    state.pending = null;
    renderControl();
    return;
  }
  if (target.closest("[data-signup-check]")) return checkStoresNow();
  const preview = target.closest("[data-signup-preview]");
  if (preview) {
    state.previewConcept = preview.dataset.signupPreview;
    showSignupView("preview");
    return;
  }
  const env = target.closest("[data-signup-env]");
  if (env) {
    state.results.env = env.dataset.signupEnv;
    state.results.confirmed = null;
    loadResults();
    return;
  }
  const days = target.closest("[data-signup-days]");
  if (days) {
    state.results.days = Number(days.dataset.signupDays);
    state.results.confirmed = null;
    loadResults();
    return;
  }
  if (target.closest("[data-signup-confirmed]")) return loadConfirmed();
  if (target.closest("[data-signup-forms-reload]")) return loadForms();
}

function handleChange(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const market = target.closest("[data-signup-market]");
  if (market) {
    requestChange({ type: "market", market: market.dataset.signupMarket, on: market.checked });
    return;
  }
  if (target.closest("[data-signup-drafts]")) {
    state.forms.showDrafts = target.checked;
    renderForms();
  }
}

function handleInput(event) {
  const field = event.target instanceof Element ? event.target.closest("[data-signup-filter]") : null;
  if (!field) return;
  state.forms.filter = field.value;
  renderForms();
  const again = document.querySelector("[data-signup-filter]");
  if (again) {
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  }
}

export function initSignupControl() {
  const panel = byId("signup-product-panel");
  if (!panel || panel.dataset.signupWired === "true") return;
  panel.dataset.signupWired = "true";
  panel.addEventListener("click", handleClick);
  panel.addEventListener("change", handleChange);
  panel.addEventListener("input", handleInput);
}

export function showSignupView(view = "control") {
  initSignupControl();
  state.view = VIEWS.includes(view) ? view : "control";
  showPanels();
  if (state.view === "control") {
    renderControl();
    loadStatus();
  } else if (state.view === "results") {
    renderResults();
    if (!state.status) loadStatus();
    loadResults();
  } else if (state.view === "forms") {
    renderForms();
    if (!state.forms.data) loadForms();
  } else {
    if (!state.status) loadStatus().then(renderPreview);
    renderPreview();
  }
}

export const __signupInternals = { state, renderControl, renderResults, renderForms, reachMarkets, needsConfirmation };
