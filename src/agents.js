// Agents: the watchdog and the email check, plus an overview of what needs a person now.
//
// Everything on these screens reads. The watchdog's only write is a mute, and that lives in this
// app's own store; nothing here changes Meta, Klaviyo or the stores.

const POLL_MS = 4000;

const state = {
  view: "overview",
  overview: null,
  overviewError: "",
  watchdog: null,
  watchdogError: "",
  running: false,
  muting: "",
  muteDraft: "",
  email: {
    mode: "klaviyo",
    country: "DK",
    templates: {},
    templatesError: "",
    templatesLoading: false,
    filter: "",
    templateId: "",
    pastedName: "",
    pastedHtml: "",
    busy: false,
    error: "",
    current: null,
    recent: [],
    pollTimer: null,
    clockTimer: null
  },
  markets: ["DK"],
  languages: {}
};

const STATUS = {
  alert: { label: "Alert", tone: "is-danger" },
  warn: { label: "Warning", tone: "is-warning" },
  error: { label: "Couldn't check", tone: "" },
  note: { label: "Note", tone: "is-info" },
  ok: { label: "OK", tone: "is-success" },
  skipped: { label: "Not applicable", tone: "" },
  pending: { label: "Not run yet", tone: "" }
};

const SEVERITY = {
  must_fix: { label: "Must fix", tone: "is-danger" },
  should_fix: { label: "Should fix", tone: "is-warning" },
  consider: { label: "Consider", tone: "is-info" }
};

const CLAIM = {
  supported: { label: "On the site", tone: "is-success" },
  not_found: { label: "Not on the site", tone: "is-warning" },
  contradicted: { label: "Contradicts the site", tone: "is-danger" }
};

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

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

const TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

function formatTime(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? TIME.format(new Date(parsed)) : "";
}

function formatAgo(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return "";
  const minutes = Math.round((Date.now() - parsed) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return formatTime(value);
}

function formatClock(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function badge(map, key) {
  const entry = map[key] || { label: key, tone: "" };
  return `<span class="wp-badge ${entry.tone}">${escapeHtml(entry.label)}</span>`;
}

async function callAgents(action, { method = "GET", body = null, query = {} } = {}) {
  const url = new URL("/api/agents", window.location.origin);
  url.searchParams.set("action", action);
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
  if (!response.ok) throw new Error(payload?.error || `Agents request failed (${response.status}).`);
  return payload;
}

// ---------------------------------------------------------------------------------------------
// The rail

function updateBadge() {
  const node = byId("agents-watchdog-count");
  if (!node) return;
  const counts = state.watchdog?.counts || state.overview?.watchdog?.counts || null;
  const open = counts ? Number(counts.alert || 0) + Number(counts.warn || 0) : 0;
  node.hidden = !open;
  node.textContent = open ? String(open) : "";
  node.classList.toggle("is-danger", Number(counts?.alert || 0) > 0);
  node.title = open ? `${plural(open, "open finding", "open findings")} from the watchdog` : "";
}

function setActiveNav() {
  document.querySelectorAll("[data-agents-view]").forEach((button) => {
    button.classList.toggle("active", document.body.dataset.workspace === "agents" && button.dataset.agentsView === state.view);
  });
}

// ---------------------------------------------------------------------------------------------
// Overview

function renderOpenItems(open = []) {
  if (!open.length) {
    const ranAt = state.overview?.watchdog?.ranAt;
    return `<div class="wp-state"><p class="wp-state-title">Nothing needs you right now</p><p class="wp-state-body">${ranAt ? `The watchdog last looked ${escapeHtml(formatAgo(ranAt))} and found nothing open.` : "The watchdog has not run yet. It runs every hour; you can also run it now."}</p></div>`;
  }
  return `<ul class="agents-items">${open.map((item) => `
    <li class="agents-item">
      <div class="agents-item-head">${badge(STATUS, item.status)}<strong>${escapeHtml(item.title)}</strong></div>
      ${item.detail ? `<p class="agents-item-detail">${escapeHtml(item.detail)}</p>` : ""}
      <p class="agents-item-meta">${escapeHtml(item.check)} · ${escapeHtml(formatAgo(item.checkedAt))} <button class="wp-button is-ghost is-sm" type="button" data-agents-go="watchdog">Open in Watchdog</button></p>
    </li>`).join("")}</ul>`;
}

function renderRecentChecks(checks = [], { compact = false } = {}) {
  if (!checks.length) {
    return `<div class="wp-state"><p class="wp-state-title">No emails checked yet</p><p class="wp-state-body">Checks are kept for everyone on the team, so a colleague's check of the same email shows up here.</p></div>`;
  }
  return `<div class="wp-table-wrap"><table class="wp-table agents-table">
    <thead><tr><th>Email</th><th>Market</th><th>Checked</th><th class="is-numeric">Must fix</th><th class="is-numeric">Should fix</th>${compact ? "" : '<th class="is-numeric">Consider</th>'}<th>Review</th></tr></thead>
    <tbody>${checks.map((check) => `
      <tr class="agents-row" data-agents-open-check="${escapeHtml(check.id)}" tabindex="0">
        <td>${escapeHtml(check.source?.name || "Untitled")}</td>
        <td>${escapeHtml(check.source?.country || "")}</td>
        <td>${escapeHtml(formatTime(check.createdAt))}</td>
        <td class="is-numeric">${check.counts?.must_fix || 0}</td>
        <td class="is-numeric">${check.counts?.should_fix || 0}</td>
        ${compact ? "" : `<td class="is-numeric">${check.counts?.consider || 0}</td>`}
        <td>${reviewStatusLabel(check.review)}</td>
      </tr>`).join("")}</tbody>
  </table></div>`;
}

function reviewStatusLabel(review = {}) {
  if (review.status === "running") return '<span class="wp-status is-info">Reading</span>';
  if (review.status === "done") return review.verdict === "ready" ? '<span class="wp-status is-success">Ready to send</span>' : '<span class="wp-status is-warning">Fix first</span>';
  if (review.status === "failed") return '<span class="wp-status is-danger">Review failed</span>';
  return '<span class="wp-status">Instant checks only</span>';
}

function renderOverview() {
  const node = byId("agents-overview");
  if (!node) return;
  if (state.overviewError) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The agents could not be loaded</p><p class="wp-state-body">${escapeHtml(state.overviewError)}</p></div>`;
    return;
  }
  if (!state.overview) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Loading</div>';
    return;
  }
  const watchdog = state.overview.watchdog;
  const counts = watchdog?.counts || {};
  const latestCheck = state.overview.emailChecks?.[0];
  node.innerHTML = `
    <section class="wp-section">
      <div class="wp-section-header"><div>
        <h3 class="wp-section-title">Needs attention</h3>
        <p class="wp-section-description">Open findings from the watchdog, most serious first. Anything muted stays out until its state changes.</p>
      </div></div>
      ${renderOpenItems(watchdog?.open || [])}
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Agents</h3></div></div>
      <div class="wp-table-wrap"><table class="wp-table agents-table">
        <thead><tr><th>Agent</th><th>What it does</th><th>Runs</th><th>Last run</th><th>Status</th></tr></thead>
        <tbody>
          <tr class="agents-row" data-agents-go="watchdog" tabindex="0">
            <td><strong>Watchdog</strong></td>
            <td>Ad account, rejected ads, landing pages, webshops, nightly jobs, Redis</td>
            <td>Every hour; pages and shops each morning</td>
            <td>${escapeHtml(watchdog?.ranAt ? formatAgo(watchdog.ranAt) : "Not yet")}</td>
            <td>${watchdog ? (counts.alert ? `<span class="wp-status is-danger">${plural(counts.alert, "alert", "alerts")}</span>` : counts.warn ? `<span class="wp-status is-warning">${plural(counts.warn, "warning", "warnings")}</span>` : '<span class="wp-status is-success">All clear</span>') : '<span class="wp-status">Not run yet</span>'}</td>
          </tr>
          <tr class="agents-row" data-agents-go="email_check" tabindex="0">
            <td><strong>Email check</strong></td>
            <td>Links, images, translation traps, house rules, and every claim against the site</td>
            <td>When you ask</td>
            <td>${escapeHtml(latestCheck ? formatAgo(latestCheck.createdAt) : "Not yet")}</td>
            <td>${latestCheck ? reviewStatusLabel(latestCheck.review) : '<span class="wp-status">Ready</span>'}</td>
          </tr>
        </tbody>
      </table></div>
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Recent email checks</h3></div></div>
      ${renderRecentChecks(state.overview.emailChecks || [], { compact: true })}
    </section>`;
}

async function loadOverview() {
  try {
    const payload = await callAgents("overview");
    state.overview = payload;
    state.overviewError = "";
    state.markets = payload.markets?.length ? payload.markets : ["DK"];
    state.languages = payload.languages || {};
    state.email.recent = payload.emailChecks || [];
  } catch (error) {
    state.overviewError = error.message;
  }
  updateBadge();
  if (state.view === "overview") renderOverview();
}

// ---------------------------------------------------------------------------------------------
// Watchdog

function renderItem(check, item) {
  const muteKey = `${check.id}:${item.key}`;
  return `
    <li class="agents-item${item.muted ? " is-muted" : ""}">
      <div class="agents-item-head">${badge(STATUS, item.status)}<strong>${escapeHtml(item.title)}</strong></div>
      ${item.detail ? `<p class="agents-item-detail">${escapeHtml(item.detail)}</p>` : ""}
      ${item.list?.length ? `<ul class="agents-item-list">${item.list.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>` : ""}
      ${["alert", "warn", "error"].includes(item.status) || item.muted ? `<p class="agents-item-meta">${item.muted
        ? `Muted ${escapeHtml(formatTime(item.muted.at))}${item.muted.note ? ` - ${escapeHtml(item.muted.note)}` : ""}. It alerts again if its state changes. <button class="wp-button is-ghost is-sm" type="button" data-agents-unmute="${escapeHtml(muteKey)}"${state.muting === muteKey ? " disabled" : ""}>Unmute</button>`
        : state.muteDraft === muteKey
          ? `<span class="agents-mute-form"><input class="wp-input" type="text" maxlength="300" data-agents-mute-note placeholder="Why it is fine for now (optional, shown to colleagues)"><button class="wp-button is-sm" type="button" data-agents-mute="${escapeHtml(muteKey)}"${state.muting === muteKey ? " disabled" : ""}>Mute</button><button class="wp-button is-ghost is-sm" type="button" data-agents-mute-cancel>Cancel</button></span>`
          : `<button class="wp-button is-ghost is-sm" type="button" data-agents-mute-draft="${escapeHtml(muteKey)}">Mute until it changes</button>`}</p>` : ""}
    </li>`;
}

function renderCheck(check) {
  const items = check.items || [];
  const open = ["alert", "warn", "error"].includes(check.status) || items.some((item) => ["alert", "warn"].includes(item.status));
  return `
    <details class="agents-check"${open ? " open" : ""}>
      <summary>
        <span class="agents-check-status">${badge(STATUS, check.status)}</span>
        <span class="agents-check-title"><strong>${escapeHtml(check.title)}</strong><span>${escapeHtml(check.summary || "")}</span></span>
        <span class="agents-check-meta">${escapeHtml(check.cadence === "daily" ? "Each morning" : "Hourly")}${check.checkedAt ? ` · ${escapeHtml(formatAgo(check.checkedAt))}` : ""}</span>
      </summary>
      <div class="agents-check-body">
        <p class="agents-check-description">${escapeHtml(check.description || "")}</p>
        ${check.detail ? `<p class="agents-item-detail">${escapeHtml(check.detail)}</p>` : ""}
        ${items.length ? `<ul class="agents-items">${items.map((item) => renderItem(check, item)).join("")}</ul>` : ""}
      </div>
    </details>`;
}

function renderWatchdog() {
  const node = byId("agents-watchdog");
  const note = byId("agents-watchdog-run-note");
  const button = byId("agents-watchdog-run");
  if (button) {
    button.disabled = state.running;
    button.classList.toggle("is-loading", state.running);
    button.textContent = state.running ? "Checking - about two minutes" : "Run every check now";
  }
  if (note) note.textContent = state.watchdog?.ranAt ? `Last run ${formatAgo(state.watchdog.ranAt)}` : "";
  if (!node) return;
  if (state.watchdogError && !state.watchdog) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The watchdog could not be loaded</p><p class="wp-state-body">${escapeHtml(state.watchdogError)}</p></div>`;
    return;
  }
  if (!state.watchdog) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Loading</div>';
    return;
  }
  const counts = state.watchdog.counts || {};
  node.innerHTML = `
    ${state.watchdogError ? `<div class="wp-alert is-danger"><div><strong>The run did not finish</strong>${escapeHtml(state.watchdogError)}</div></div>` : ""}
    ${state.watchdog.empty ? '<div class="wp-alert is-info"><div><strong>Not run yet</strong>The first scheduled run happens at seven minutes past the hour. Run it now to see the checks straight away.</div></div>' : `
    <div class="wp-metrics agents-metrics">
      <div class="wp-metric"><span class="wp-metric-label">Alerts</span><span class="wp-metric-value">${counts.alert || 0}</span><span class="wp-metric-caption">broken or costing money now</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Warnings</span><span class="wp-metric-value">${counts.warn || 0}</span><span class="wp-metric-caption">look at it today</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Couldn't check</span><span class="wp-metric-value">${counts.error || 0}</span><span class="wp-metric-caption">no verdict either way</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Muted</span><span class="wp-metric-value">${counts.muted || 0}</span><span class="wp-metric-caption">until their state changes</span></div>
    </div>`}
    <div class="agents-checks">${(state.watchdog.checks || []).map(renderCheck).join("")}</div>
    <p class="agents-footnote">Read-only. Meta is asked a handful of times an hour and a rate limit is never retried, so the dashboard's quota is untouched. Pages and shops are visited one at a time, the way a person clicks through.</p>`;
}

async function loadWatchdog() {
  try {
    const payload = await callAgents("watchdog");
    state.watchdog = payload.watchdog;
    state.watchdogError = "";
  } catch (error) {
    state.watchdogError = error.message;
  }
  updateBadge();
  if (state.view === "watchdog") renderWatchdog();
}

async function runWatchdogNow() {
  if (state.running) return;
  state.running = true;
  state.watchdogError = "";
  renderWatchdog();
  try {
    const payload = await callAgents("watchdog_run", { method: "POST", body: {} });
    state.watchdog = payload.watchdog;
  } catch (error) {
    state.watchdogError = error.message;
  } finally {
    state.running = false;
    updateBadge();
    renderWatchdog();
    loadOverview();
  }
}

async function setMute(key, mute, note = "") {
  const [checkId, ...rest] = key.split(":");
  const itemKey = rest.join(":");
  state.muting = key;
  renderWatchdog();
  try {
    const payload = await callAgents(mute ? "watchdog_mute" : "watchdog_unmute", { method: "POST", body: { checkId, itemKey, note } });
    state.watchdog = payload.watchdog;
  } catch (error) {
    state.watchdogError = error.message;
  } finally {
    state.muting = "";
    state.muteDraft = "";
    updateBadge();
    renderWatchdog();
    loadOverview();
  }
}

// ---------------------------------------------------------------------------------------------
// Email check

function templatesFor(country) {
  return state.email.templates[country] || null;
}

async function loadTemplates(country) {
  if (templatesFor(country) || state.email.templatesLoading) return;
  state.email.templatesLoading = true;
  state.email.templatesError = "";
  renderEmailCheck();
  try {
    const response = await fetch(`/api/klaviyo/templates?country=${encodeURIComponent(country)}`, { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Klaviyo templates could not be loaded (${response.status}).`);
    state.email.templates[country] = (payload.templates || [])
      .filter((template) => template.id)
      .sort((left, right) => Date.parse(right.updated || 0) - Date.parse(left.updated || 0));
  } catch (error) {
    state.email.templatesError = error.message;
  } finally {
    state.email.templatesLoading = false;
    renderEmailCheck();
  }
}

function renderSourceForm() {
  const email = state.email;
  const templates = templatesFor(email.country) || [];
  const filter = email.filter.trim().toLowerCase();
  const shown = (filter ? templates.filter((template) => template.name.toLowerCase().includes(filter)) : templates).slice(0, 200);
  const languages = state.languages || {};
  const countries = email.mode === "klaviyo" ? state.markets : Object.keys(languages).length ? Object.keys(languages) : state.markets;
  const canRun = !email.busy && (email.mode === "klaviyo" ? Boolean(email.templateId) : Boolean(email.pastedHtml.trim()));
  return `
    <section class="wp-section agents-form">
      <div class="wp-segment" role="group" aria-label="Source">
        <button class="wp-segment-item${email.mode === "klaviyo" ? " active" : ""}" type="button" data-agents-mode="klaviyo" aria-pressed="${email.mode === "klaviyo"}">Klaviyo template</button>
        <button class="wp-segment-item${email.mode === "pasted" ? " active" : ""}" type="button" data-agents-mode="pasted" aria-pressed="${email.mode === "pasted"}">Paste HTML</button>
      </div>
      <div class="wp-form-grid agents-form-grid">
        <label class="wp-field">
          <span class="wp-label">Market</span>
          <select class="wp-select" data-agents-field="country">
            ${countries.map((country) => `<option value="${escapeHtml(country)}"${country === email.country ? " selected" : ""}>${escapeHtml(country)}${languages[country] ? ` - ${escapeHtml(languages[country])}` : ""}</option>`).join("")}
          </select>
          <span class="wp-help">${email.country === "DK" ? "The Danish master also gets the checks for what Duplicate & translate cannot reach." : "A translated version is also checked for Danish left behind and its form of address."}</span>
        </label>
        ${email.mode === "klaviyo" ? `
          <label class="wp-field">
            <span class="wp-label">Find a template</span>
            <input class="wp-input" type="search" data-agents-field="filter" value="${escapeHtml(email.filter)}" placeholder="Name, e.g. W46">
          </label>
          <label class="wp-field agents-span-2">
            <span class="wp-label">Template</span>
            <select class="wp-select" data-agents-field="templateId"${email.templatesLoading ? " disabled" : ""}>
              <option value="">${email.templatesLoading ? "Reading Klaviyo..." : email.templatesError ? "Templates could not be loaded" : shown.length ? "Choose a template" : "No template matches"}</option>
              ${shown.map((template) => `<option value="${escapeHtml(template.id)}"${template.id === email.templateId ? " selected" : ""}>${escapeHtml(template.name)}${template.updated ? ` - ${escapeHtml(formatTime(template.updated))}` : ""}</option>`).join("")}
            </select>
            ${email.templatesError ? `<span class="wp-error">${escapeHtml(email.templatesError)}</span>` : `<span class="wp-help">Newest first. ${templates.length ? plural(templates.length, "template", "templates") : ""} in ${escapeHtml(email.country)}.</span>`}
          </label>` : `
          <label class="wp-field">
            <span class="wp-label">Name</span>
            <input class="wp-input" type="text" data-agents-field="pastedName" value="${escapeHtml(email.pastedName)}" placeholder="W47 Kevin">
          </label>
          <label class="wp-field agents-span-2">
            <span class="wp-label">HTML</span>
            <textarea class="wp-textarea agents-html" data-agents-field="pastedHtml" rows="8" spellcheck="false" placeholder="Paste the whole email, from &lt;!DOCTYPE html&gt; to &lt;/html&gt;">${escapeHtml(email.pastedHtml)}</textarea>
          </label>`}
      </div>
      <div class="wp-form-actions">
        <button class="wp-button is-primary${email.busy ? " is-loading" : ""}" type="button" data-agents-action="check-email"${canRun ? "" : " disabled"}>${email.busy ? "Checking" : "Check email"}</button>
        ${email.error ? `<span class="wp-error">${escapeHtml(email.error)}</span>` : '<span class="wp-help">The instant checks answer at once. The careful read takes two to four minutes; you can leave the page and come back.</span>'}
      </div>
    </section>`;
}

// The careful read gives a problem in a sentence or two, not a title; its area names the row,
// so the sentence is not printed twice.
const REVIEW_AREA = {
  claims: "Claim",
  rules: "House rule",
  tone: "Tone",
  clarity: "Clarity",
  cta: "Call to action",
  language: "Language",
  consistency: "Consistency"
};

function renderFinding(finding) {
  const fromReview = finding.source === "review";
  const title = fromReview ? REVIEW_AREA[finding.area] || "Careful read" : finding.title;
  return `
    <li class="agents-item">
      <div class="agents-item-head">${badge(SEVERITY, finding.severity)}<strong>${escapeHtml(title)}</strong><span class="agents-item-source">${fromReview ? "Careful read" : "Instant check"}</span></div>
      ${finding.excerpt ? `<blockquote class="agents-excerpt">${escapeHtml(finding.excerpt)}</blockquote>` : ""}
      ${finding.detail && (fromReview || finding.detail !== finding.title) ? `<p class="agents-item-detail">${escapeHtml(finding.detail)}</p>` : ""}
      ${finding.fix ? `<p class="agents-item-fix"><span>Fix</span>${escapeHtml(finding.fix)}</p>` : ""}
    </li>`;
}

function renderReviewStatus(check) {
  const review = check.review || {};
  if (review.status === "running") {
    const elapsed = Date.now() - (Date.parse(review.startedAt || check.createdAt) || Date.now());
    return `<div class="wp-alert is-info agents-review-running"><div><strong><span class="wp-spinner"></span> Reading the email against Westpack's site and the house rules</strong><span id="agents-review-clock">${formatClock(elapsed)}</span> - usually two to four minutes. The instant checks are below already.</div></div>`;
  }
  if (review.status === "failed") return `<div class="wp-alert is-danger"><div><strong>The careful read did not finish</strong>${escapeHtml(review.error || "")} The instant checks below still stand.</div></div>`;
  if (review.status === "unavailable") return `<div class="wp-alert is-warning"><div><strong>Instant checks only</strong>${escapeHtml(review.error || "")}</div></div>`;
  if (review.status === "done") {
    return `<div class="wp-alert ${review.verdict === "ready" ? "is-success" : "is-warning"}"><div><strong>${review.verdict === "ready" ? "Ready to send" : "Fix first"}</strong>${escapeHtml(review.summary || "")}${review.droppedUnverified ? ` ${plural(review.droppedUnverified, "finding was", "findings were")} left out because the quoted words are not in the email.` : ""}</div></div>`;
  }
  return "";
}

function renderResult() {
  const check = state.email.current;
  if (!check) return "";
  const all = [...(check.findings || []), ...(check.review?.findings || [])];
  const order = ["must_fix", "should_fix", "consider"];
  const groups = order.map((severity) => ({ severity, items: all.filter((item) => item.severity === severity) })).filter((group) => group.items.length);
  const claims = check.review?.claims || [];
  const counts = check.counts || {};
  return `
    <section class="wp-section agents-result" id="agents-email-result">
      <div class="wp-section-header">
        <div>
          <p class="wp-eyebrow">${escapeHtml(check.source?.country || "")} · ${check.source?.kind === "klaviyo" ? "Klaviyo template" : "Pasted HTML"} · ${escapeHtml(formatTime(check.createdAt))}</p>
          <h3 class="wp-section-title">${escapeHtml(check.source?.name || "Untitled email")}</h3>
        </div>
      </div>
      <div class="wp-metrics agents-metrics">
        <div class="wp-metric"><span class="wp-metric-label">Must fix</span><span class="wp-metric-value">${counts.must_fix || 0}</span></div>
        <div class="wp-metric"><span class="wp-metric-label">Should fix</span><span class="wp-metric-value">${counts.should_fix || 0}</span></div>
        <div class="wp-metric"><span class="wp-metric-label">Consider</span><span class="wp-metric-value">${counts.consider || 0}</span></div>
        <div class="wp-metric"><span class="wp-metric-label">Size</span><span class="wp-metric-value">${Math.round((check.stats?.bytes || 0) / 1024)} KB</span><span class="wp-metric-caption">${plural(check.stats?.links || 0, "link", "links")} · ${plural(check.stats?.images || 0, "image", "images")}</span></div>
      </div>
      ${renderReviewStatus(check)}
      ${groups.length ? groups.map((group) => `
        <h4 class="agents-group-title">${escapeHtml(SEVERITY[group.severity].label)} <span>${group.items.length}</span></h4>
        <ul class="agents-items">${group.items.map(renderFinding).join("")}</ul>`).join("") : check.review?.status === "running" ? "" : '<div class="wp-state"><p class="wp-state-title">Nothing to fix</p><p class="wp-state-body">No check and no part of the careful read found a problem.</p></div>'}
      ${claims.length ? `
        <h4 class="agents-group-title">Claims checked against the site <span>${claims.length}</span></h4>
        <div class="wp-table-wrap"><table class="wp-table agents-table">
          <thead><tr><th>Claim</th><th>Verdict</th><th>Where the site says so</th></tr></thead>
          <tbody>${claims.map((claim) => `<tr><td>${escapeHtml(claim.claim)}</td><td>${badge(CLAIM, claim.verdict)}</td><td>${escapeHtml(claim.evidence)}</td></tr>`).join("")}</tbody>
        </table></div>` : ""}
    </section>`;
}

function renderEmailCheck() {
  const node = byId("agents-email-check");
  if (!node) return;
  const focused = document.activeElement?.dataset?.agentsField || "";
  const caret = focused && "selectionStart" in document.activeElement ? document.activeElement.selectionStart : null;
  node.innerHTML = `
    ${renderSourceForm()}
    ${renderResult()}
    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Recent checks</h3><p class="wp-section-description">The last thirty, for the whole team. Open one to see it in full.</p></div></div>
      ${renderRecentChecks(state.email.recent)}
    </section>`;
  // Re-rendering on every keystroke must not take the cursor away from the field being typed in.
  if (focused) {
    const field = node.querySelector(`[data-agents-field="${focused}"]`);
    if (field) {
      field.focus();
      if (caret !== null && "setSelectionRange" in field) field.setSelectionRange(caret, caret);
    }
  }
}

function stopPolling() {
  clearTimeout(state.email.pollTimer);
  clearInterval(state.email.clockTimer);
  state.email.pollTimer = null;
  state.email.clockTimer = null;
}

function followReview() {
  stopPolling();
  const check = state.email.current;
  if (check?.review?.status !== "running") return;
  state.email.clockTimer = setInterval(() => {
    const clock = byId("agents-review-clock");
    const current = state.email.current;
    if (!clock || current?.review?.status !== "running") return;
    clock.textContent = formatClock(Date.now() - (Date.parse(current.review.startedAt || current.createdAt) || Date.now()));
  }, 1000);
  const poll = async () => {
    try {
      const payload = await callAgents("email_check_poll", { method: "POST", body: { id: check.id } });
      if (state.email.current?.id !== check.id) return;
      state.email.current = payload.check;
      if (payload.check.review?.status !== "running") {
        stopPolling();
        refreshRecent();
        if (state.view === "email_check") renderEmailCheck();
        return;
      }
    } catch (error) {
      state.email.error = error.message;
    }
    state.email.pollTimer = setTimeout(poll, POLL_MS);
  };
  state.email.pollTimer = setTimeout(poll, POLL_MS);
}

async function refreshRecent() {
  try {
    const payload = await callAgents("email_checks");
    state.email.recent = payload.checks || [];
  } catch {
    // The list is a convenience; the check itself is already on screen.
  }
  if (state.view === "email_check") renderEmailCheck();
  loadOverview();
}

async function runEmailCheck() {
  const email = state.email;
  if (email.busy) return;
  email.busy = true;
  email.error = "";
  renderEmailCheck();
  try {
    const body = email.mode === "klaviyo"
      ? { country: email.country, templateId: email.templateId }
      : { country: email.country, html: email.pastedHtml, name: email.pastedName || "Pasted email" };
    const payload = await callAgents("email_check", { method: "POST", body });
    email.current = payload.check;
    followReview();
    refreshRecent();
  } catch (error) {
    email.error = error.message;
  } finally {
    email.busy = false;
    renderEmailCheck();
    byId("agents-email-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function openCheck(id) {
  try {
    const payload = await callAgents("email_check", { query: { id } });
    state.email.current = payload.check;
    state.view = "email_check";
    showPanels();
    renderEmailCheck();
    followReview();
    byId("agents-email-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    state.email.error = error.message;
    renderEmailCheck();
  }
}

// ---------------------------------------------------------------------------------------------
// Wiring

function showPanels() {
  document.querySelectorAll("[data-agents-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.agentsPanel !== state.view;
  });
  setActiveNav();
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const go = target.closest("[data-agents-go]");
  if (go) {
    showAgentsView(go.dataset.agentsGo);
    return;
  }
  const openRow = target.closest("[data-agents-open-check]");
  if (openRow) {
    openCheck(openRow.dataset.agentsOpenCheck);
    return;
  }
  if (target.closest("#agents-watchdog-run")) {
    runWatchdogNow();
    return;
  }
  const draft = target.closest("[data-agents-mute-draft]");
  if (draft) {
    state.muteDraft = draft.dataset.agentsMuteDraft;
    renderWatchdog();
    byId("agents-watchdog")?.querySelector("[data-agents-mute-note]")?.focus();
    return;
  }
  if (target.closest("[data-agents-mute-cancel]")) {
    state.muteDraft = "";
    renderWatchdog();
    return;
  }
  const mute = target.closest("[data-agents-mute]");
  if (mute) {
    const note = mute.parentElement?.querySelector("[data-agents-mute-note]")?.value || "";
    setMute(mute.dataset.agentsMute, true, note);
    return;
  }
  const unmute = target.closest("[data-agents-unmute]");
  if (unmute) {
    setMute(unmute.dataset.agentsUnmute, false);
    return;
  }
  const mode = target.closest("[data-agents-mode]");
  if (mode) {
    state.email.mode = mode.dataset.agentsMode;
    state.email.error = "";
    renderEmailCheck();
    if (state.email.mode === "klaviyo") loadTemplates(state.email.country);
    return;
  }
  if (target.closest('[data-agents-action="check-email"]')) runEmailCheck();
}

function handleKeydown(event) {
  if (event.key !== "Enter") return;
  const row = event.target instanceof Element ? event.target.closest("[data-agents-open-check], tr[data-agents-go]") : null;
  if (!row) return;
  event.preventDefault();
  if (row.dataset.agentsOpenCheck) openCheck(row.dataset.agentsOpenCheck);
  else showAgentsView(row.dataset.agentsGo);
}

function handleInput(event) {
  const field = event.target instanceof Element ? event.target.closest("[data-agents-field]") : null;
  if (!field) return;
  const name = field.dataset.agentsField;
  const value = "value" in field ? field.value : "";
  if (name === "country") {
    state.email.country = value;
    state.email.templateId = "";
    renderEmailCheck();
    if (state.email.mode === "klaviyo") loadTemplates(value);
    return;
  }
  if (name === "templateId") {
    state.email.templateId = value;
    renderEmailCheck();
    return;
  }
  state.email[name] = value;
  // Typing only changes whether the button can be pressed; the form is re-drawn for the filter,
  // which changes the list underneath it.
  if (name === "filter") renderEmailCheck();
  else {
    const button = document.querySelector('[data-agents-action="check-email"]');
    if (button) button.disabled = state.email.busy || !(state.email.mode === "klaviyo" ? state.email.templateId : state.email.pastedHtml.trim());
  }
}

export function initAgents() {
  const panel = byId("agents-product-panel");
  if (!panel || panel.dataset.agentsWired === "true") return;
  panel.dataset.agentsWired = "true";
  panel.addEventListener("click", handleClick);
  panel.addEventListener("keydown", handleKeydown);
  panel.addEventListener("input", handleInput);
  panel.addEventListener("change", handleInput);
}

export function showAgentsView(view = "overview") {
  initAgents();
  state.view = ["overview", "watchdog", "email_check"].includes(view) ? view : "overview";
  showPanels();
  if (state.view === "overview") {
    renderOverview();
    loadOverview();
  } else if (state.view === "watchdog") {
    renderWatchdog();
    loadWatchdog();
  } else {
    renderEmailCheck();
    if (state.email.mode === "klaviyo") loadTemplates(state.email.country);
    if (!state.overview) loadOverview().then(() => renderEmailCheck());
    followReview();
  }
}

// Called once after login, so the rail shows open findings before anyone opens the page.
export function refreshAgentsBadge() {
  return loadOverview();
}

export const __agentsInternals = { state, renderOverview, renderWatchdog, renderEmailCheck };
