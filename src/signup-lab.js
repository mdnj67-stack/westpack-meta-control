// Signup Lab: our own newsletter signup on the webshops, run from here rather than from code.
//
// One script tag on the stores loads the Signup Lab; this page is where it is run. Three views, one for each thing
// the person running it needs (the user, 2026-10-30: "at jeg kan styre scriptet. At jeg kan se hvor mange subs der
// kommer ind. At jeg kan preview sign ups"):
//   control - what the script on the stores runs: on or off for the live stores and for staging, which experience,
//             which markets - and proof that the stores are being served exactly that.
//   signups - how many sign up: the funnel the script reports, and what Klaviyo actually holds, live and test apart.
//   preview - every experience in every market on every device, run here as it runs on a store.
// Klaviyo's own signup forms are a Klaviyo matter and live under Klaviyo email (src/klaviyo-signup-forms.js). The only
// writes outside this app are The Insert popups, which come down where the Signup Lab goes live and go back up where
// it stops (api/signup/control.js).

import { niceScale, formatChartDate } from "./chart.js?v=20260921-chart1";
import { formatCount } from "./format.js?v=20260921-format1";

const VIEWS = ["control", "signups", "preview"];
const STAGING_ORIGIN = "https://westpack-staging.wexohosting.com";
const TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });
const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Copenhagen" });
const LOCAL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" });
const DEVICES = { phone: { label: "Phone", size: [390, 844] }, small: { label: "Small phone", size: [360, 640] }, tablet: { label: "Tablet", size: [820, 1180] }, computer: { label: "Computer", size: [1440, 900] } };
const LANGUAGES = { da: "Danish", en: "English", "en-US": "English (US)", de: "German", fr: "French", it: "Italian", es: "Spanish", nl: "Dutch", pt: "Portuguese", sv: "Swedish", nb: "Norwegian", fi: "Finnish", pl: "Polish", ro: "Romanian", cs: "Czech", sk: "Slovak", hu: "Hungarian" };
const RANGES = [{ id: "today", label: "Today" }, { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }];
const PAGE_TYPES = { home: "Front page", product_or_category: "Product or category", content: "Content page" };
const DEVICE_WORDS = { mobile: "Phone", tablet: "Tablet", desktop: "Computer" };
// After a change the page watches what the stores are served until it matches, for at most this long.
const SERVED_WATCH_MS = 3 * 60 * 1000;

const state = {
  view: "control",
  status: null,
  error: "",
  busy: "",
  pending: null,
  notice: null,
  served: { config: null, at: 0, error: "", watchUntil: 0, timer: null },
  signups: { env: "", range: "7d", data: null, klaviyo: null, key: "", loading: false, error: "", klaviyoLoading: false, klaviyoError: "", readAt: 0 },
  preview: { concept: "", market: "dkk_dk_den", device: "computer", open: "1", submit: "dry", log: [] }
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

function formatTime(value) {
  const parsed = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(parsed) ? TIME.format(parsed) : "";
}

function percent(value, digits = 2) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "–";
}

function count(value) {
  return Number.isFinite(value) ? formatCount(value) : "–";
}

async function call(path, { method = "GET", body = null, query = {}, cache = "default" } = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url.toString(), {
    method,
    cache,
    credentials: "same-origin",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("westpack-auth-required"));
    throw new Error("Session expired. Log in again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const control = (action, options = {}) => call("/api/signup/control", { ...options, query: { action, ...(options.query || {}) } });

function conceptName(id) {
  return state.status?.concepts?.find((c) => c.id === id)?.name || id;
}

function marketEntries() {
  return state.status?.markets || [];
}

function languageOf(lang) {
  return LANGUAGES[lang] || lang;
}

// ---------------------------------------------------------------------------------------------
// Control

function tagState(page) {
  if (!page) return { tone: "", text: "Not checked" };
  if (page.error) return { tone: "is-warning", text: "Could not read", title: page.error };
  if (page.tag === "yes") return { tone: "is-success", text: "Tag installed" };
  if (page.tag === "test-only") return { tone: "is-warning", text: "Test tag only" };
  return { tone: "", text: "No tag" };
}

function renderNotice() {
  if (state.pending) {
    const { text, plan } = state.pending;
    const lines = [
      ...plan.republish.map((f) => `Publishes The Insert popup in ${f.market} (${f.name || f.id}) again, before the Signup Lab stops there.`),
      ...plan.unpublish.map((f) => `Unpublishes The Insert popup in ${f.market} (${f.name || f.id}) once the Signup Lab runs there, so nobody gets two popups.`)
    ];
    return `<div class="wp-alert is-warning signup-confirm" role="alertdialog" aria-label="Confirm the change"><div>
      <strong>${escapeHtml(text)}</strong>
      ${lines.length ? `<ul class="signup-plan">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : "<p>Nothing changes in Klaviyo.</p>"}
      <p>This reaches visitors on the live stores within a minute.</p>
      <div class="wp-button-group">
        <button class="wp-button is-primary" type="button" data-signup-confirm ${state.busy ? "disabled" : ""}>${state.busy === "confirm" ? "Changing…" : "Confirm"}</button>
        <button class="wp-button is-ghost" type="button" data-signup-cancel ${state.busy ? "disabled" : ""}>Cancel</button>
      </div>
    </div></div>`;
  }
  if (state.notice) return `<div class="wp-alert ${state.notice.tone}" role="status"><div><strong>${escapeHtml(state.notice.title)}</strong> ${escapeHtml(state.notice.body || "")}</div></div>`;
  return "";
}

// What the stores are being served right now, read the way a store reads it (edge-cached for 30 s).
function servedLine(env, c) {
  const s = state.served;
  if (s.error && !s.config) return `<p class="signup-served is-warning">What the stores are served could not be read: ${escapeHtml(s.error)}</p>`;
  if (!s.config) return '<p class="signup-served">Reading what the stores are served…</p>';
  const side = s.config[env] || {};
  const inStep = (s.config.at || null) === (c.updatedAt || null);
  const summary = side.on
    ? `On · ${conceptName(side.current)}${env === "live" ? ` · ${Object.values(side.markets || {}).filter(Boolean).length} markets` : ""}`
    : "Off";
  if (inStep) return `<p class="signup-served is-ok"><span aria-hidden="true">✓</span> The stores are served <strong>${escapeHtml(summary)}</strong> · checked ${escapeHtml(CLOCK.format(s.at))}</p>`;
  const waiting = Date.now() < s.watchUntil;
  return `<p class="signup-served is-waiting"><span class="wp-spinner" aria-hidden="true"></span> ${waiting ? "Waiting for the change to reach the stores" : "The stores are still served the previous setting"} - they read <strong>${escapeHtml(summary)}</strong> · checked ${escapeHtml(CLOCK.format(s.at))}</p>`;
}

function conceptPicker(env, current, busy) {
  return `<div class="wp-segment signup-concept-picker" role="radiogroup" aria-label="Experience on ${env === "live" ? "the live stores" : "staging"}">
    ${(state.status?.concepts || []).map((concept) => `<button class="wp-segment-item ${concept.id === current ? "active" : ""}" type="button" role="radio" aria-checked="${concept.id === current}" data-signup-run="${env}" data-concept="${concept.id}" ${busy || concept.id === current ? "disabled" : ""}>${escapeHtml(concept.name)}</button>`).join("")}
  </div>`;
}

function liveCard(c, busy) {
  const check = c.storeCheck;
  const installed = marketEntries().filter((m) => check?.live?.[m.market]?.tag === "yes").map((m) => m.market);
  const reach = c.live.reach || [];
  const says = c.live.on
    ? `Runs ${conceptName(c.live.current)} on ${reach.length} of 18 stores${reach.length ? `: ${reach.join(", ")}` : ""}. The Insert popup is down where it runs.`
    : "Off. The tag on the stores does nothing, and The Insert popups run as before.";
  const steps = c.live.on ? "" : `<ol class="signup-steps">
    <li class="${installed.length ? "is-done" : ""}"><strong>Put the tag on the stores.</strong> ${installed.length ? `${installed.length} of 18 carry it.` : check ? "None of the 18 carries it yet." : "The stores have not been checked."} See Install below.</li>
    <li><strong>Test it on staging</strong> - it runs there by itself, on the TEST list.</li>
    <li><strong>Switch live on.</strong> The Insert popup comes down in every market where the Signup Lab then runs.</li>
  </ol>`;
  return `<article class="signup-env ${c.live.on ? "is-on" : "is-off"}" aria-labelledby="signup-env-live">
    <header class="signup-env-head">
      <div><h3 class="signup-env-name" id="signup-env-live">Live stores</h3><p class="signup-env-host">www.westpack.com · 18 stores · real visitors, real newsletter lists</p></div>
      <span class="signup-env-state ${c.live.on ? "is-on" : ""}">${c.live.on ? "On" : "Off"}</span>
    </header>
    <p class="signup-env-says">${escapeHtml(says)}</p>
    <div class="signup-env-field"><span class="signup-env-label">Experience</span>${conceptPicker("live", c.live.current, busy)}</div>
    ${servedLine("live", c)}
    ${steps}
    <div class="signup-env-actions">
      <button class="wp-button ${c.live.on ? "" : "is-primary"}" type="button" data-signup-live="${c.live.on ? "off" : "on"}" ${busy ? "disabled" : ""}>${c.live.on ? "Switch live off" : "Switch live on"}</button>
    </div>
  </article>`;
}

function stagingCard(c, busy) {
  const hosts = (state.status?.stagingHosts || []).join(", ");
  const check = c.storeCheck;
  const tagged = check?.staging ? marketEntries().filter((m) => check.staging[m.market]?.tag === "yes").map((m) => m.market) : null;
  const says = c.staging.on
    ? `Runs ${conceptName(c.staging.current)} by itself, as it will on the live stores. Every signup goes to the TEST list in Klaviyo.`
    : "Off. The staging store shows nothing, except a page opened with ?wps=preview.";
  const reach = tagged === null ? (state.status?.stagingAuthConfigured ? "Not checked yet." : "Not checked: the staging login is not set.") : tagged.length ? `The tag is on ${tagged.join(", ")}.` : "No staging store carries the tag.";
  const first = tagged?.[0] ? marketEntries().find((m) => m.market === tagged[0]) : marketEntries()[0];
  return `<article class="signup-env ${c.staging.on ? "is-on" : "is-off"}" aria-labelledby="signup-env-staging">
    <header class="signup-env-head">
      <div><h3 class="signup-env-name" id="signup-env-staging">Staging</h3><p class="signup-env-host">${escapeHtml(hosts)} · ${escapeHtml(reach)}</p></div>
      <span class="signup-env-state ${c.staging.on ? "is-on" : ""}">${c.staging.on ? "On" : "Off"}</span>
    </header>
    <p class="signup-env-says">${escapeHtml(says)}</p>
    <div class="signup-env-field"><span class="signup-env-label">Experience</span>${conceptPicker("staging", c.staging.current, busy)}</div>
    ${servedLine("staging", c)}
    <div class="signup-env-actions">
      <button class="wp-button" type="button" data-signup-staging="${c.staging.on ? "off" : "on"}" ${busy ? "disabled" : ""}>${c.staging.on ? "Switch staging off" : "Switch staging on"}</button>
      ${first ? `<a class="wp-button is-ghost" href="${STAGING_ORIGIN}/${escapeHtml(first.code)}/?wps=reset" target="_blank" rel="noopener">Open staging as a new visitor ↗</a>` : ""}
    </div>
  </article>`;
}

// What one market does on the live stores, in a word: it runs, it is ready, it needs the tag, or it is switched off.
function marketState(m, c) {
  const on = c.live.markets[m.market];
  const tagged = c.storeCheck?.live?.[m.market]?.tag === "yes";
  if (!on) return "Switched off";
  if (c.live.on && (c.live.reach || []).includes(m.market)) return "Runs live";
  if (c.live.on && tagged) return "Waits to be brought in";
  if (!tagged) return "Needs the tag";
  return "Ready for live";
}

function marketTile(m, c, busy) {
  const live = tagState(c.storeCheck?.live?.[m.market]);
  const on = c.live.markets[m.market];
  const runs = c.live.on && (c.live.reach || []).includes(m.market);
  return `<label class="signup-market ${on ? "is-on" : "is-off"} ${runs ? "is-running" : ""}">
    <span class="signup-market-top">
      <span class="signup-market-code">${escapeHtml(m.market)}</span>
      <span class="wp-check"><input type="checkbox" data-signup-market="${m.market}" ${on ? "checked" : ""} ${busy ? "disabled" : ""} aria-label="${escapeHtml(m.market)} on the live stores"></span>
    </span>
    <span class="signup-market-line"><span class="wp-status ${live.tone}" ${live.title ? `title="${escapeHtml(live.title)}"` : ""}>${escapeHtml(live.text)}</span></span>
    <span class="signup-market-line ${runs ? "" : "is-muted"}">${escapeHtml(marketState(m, c))}</span>
  </label>`;
}

function renderControl() {
  const node = byId("signup-lab-control");
  if (!node) return;
  if (state.error && !state.status) {
    node.innerHTML = `<div class="wp-state is-error"><p class="wp-state-title">The Signup Lab could not be loaded</p><p class="wp-state-body">${escapeHtml(state.error)}</p></div>`;
    return;
  }
  if (!state.status) {
    node.innerHTML = '<div class="wp-loading"><span class="wp-spinner"></span> Loading</div>';
    return;
  }
  const c = state.status.control;
  const check = c.storeCheck;
  const busy = Boolean(state.busy);
  const pending = state.status.pendingReach;

  node.innerHTML = `
    ${renderNotice()}
    ${pending ? `<div class="wp-alert is-warning" role="status"><div>
      <strong>The tags on the stores have moved since live was last set.</strong>
      ${pending.add.length ? `${escapeHtml(pending.add.join(", "))} now carr${pending.add.length === 1 ? "ies" : "y"} the tag but ${pending.add.length === 1 ? "is" : "are"} not live yet (The Insert popup still runs there). ` : ""}
      ${pending.remove.length ? `${escapeHtml(pending.remove.join(", "))} no longer carr${pending.remove.length === 1 ? "ies" : "y"} the tag, so nothing runs there and The Insert popup should come back. ` : ""}
      <div class="wp-button-group"><button class="wp-button is-primary is-sm" type="button" data-signup-reach ${busy ? "disabled" : ""}>Bring live in line</button></div>
    </div></div>` : ""}

    <div class="signup-envs">${liveCard(c, busy)}${stagingCard(c, busy)}</div>

    <section class="wp-section">
      <div class="wp-section-header"><div>
        <h3 class="wp-section-title">Markets on the live stores</h3>
        <p class="wp-section-description">A market runs live when live is on, the market is ticked, and its store carries the tag. Where it runs, The Insert popup comes down; untick a market and its popup comes back.</p>
      </div>
      <div class="signup-check-head">
        <span class="signup-window">${check ? `Stores checked ${escapeHtml(formatTime(check.at))}` : "The stores have not been checked yet"}</span>
        <button class="wp-button is-sm" type="button" data-signup-check ${busy ? "disabled" : ""}>${state.busy === "check" ? "Checking the stores…" : "Check the stores now"}</button>
      </div></div>
      <div class="signup-markets">${marketEntries().map((m) => marketTile(m, c, busy)).join("")}</div>
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div>
        <h3 class="wp-section-title">How the script behaves</h3>
        <p class="wp-section-description">The same in every market and for every experience. Read from the script's own rules, so this is what it does.</p>
      </div></div>
      <dl class="signup-rules">${(state.status.behaviour || []).map((b) => `<div><dt>${escapeHtml(b.label)}</dt><dd>${escapeHtml(b.text)}</dd></div>`).join("")}</dl>
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div>
        <h3 class="wp-section-title">Install</h3>
        <p class="wp-section-description">One line on every store. ${escapeHtml(state.status.snippetPlace || "")} It can go in before launch: until live is switched on here, it does nothing.</p>
      </div></div>
      <div class="signup-snippet"><code>${escapeHtml(state.status.snippet || "")}</code><button class="wp-button is-sm" type="button" data-signup-copy>Copy</button></div>
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

async function readServed() {
  const s = state.served;
  try {
    // no-store skips this browser's cache; the edge still answers as it answers the stores
    s.config = await call("/api/signup/control", { query: { action: "config" }, cache: "no-store" });
    s.error = "";
  } catch (error) {
    s.error = error.message;
  }
  s.at = Date.now();
  if (state.view === "control" && !state.pending) renderControl();
  const c = state.status?.control;
  const inStep = c && s.config && (s.config.at || null) === (c.updatedAt || null);
  clearTimeout(s.timer);
  if (!inStep && Date.now() < s.watchUntil && state.view === "control") s.timer = setTimeout(readServed, 5000);
}

function watchServed() {
  state.served.watchUntil = Date.now() + SERVED_WATCH_MS;
  readServed();
}

// Changes that reach live visitors or Klaviyo are shown first and confirmed; staging changes go straight through.
function needsConfirmation(change) {
  if (["live", "market", "reach"].includes(change.type)) return true;
  return change.type === "current" && change.env === "live" && state.status?.control?.live?.on;
}

function changeFailed(error) {
  if (error.status === 409 && error.payload?.control) {
    state.status = error.payload;
    state.notice = { tone: "is-warning", title: "Not changed.", body: error.message };
    return;
  }
  state.notice = { tone: "is-danger", title: "Not changed.", body: error.message };
}

async function requestChange(change) {
  state.notice = null;
  state.pending = null;
  state.busy = "change";
  renderControl();
  try {
    if (needsConfirmation(change)) {
      const preview = await control("change", { method: "POST", body: { change, dryRun: true } });
      state.pending = { change, text: preview.text, plan: preview.plan, expect: state.status?.control?.updatedAt ?? null };
    } else {
      await applyChange(change, state.status?.control?.updatedAt ?? null);
    }
  } catch (error) {
    changeFailed(error);
  }
  state.busy = "";
  renderControl();
  // the confirmation, or the reason a change was refused, sits at the top of the page: take the person there
  const node = byId("signup-lab-control");
  const confirm = node?.querySelector("[data-signup-confirm]");
  const target = confirm || node?.querySelector(".wp-alert");
  if (target) {
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    if (confirm) confirm.focus({ preventScroll: true });
  }
}

async function applyChange(change, expect) {
  const result = await control("change", { method: "POST", body: { change, expect } });
  state.status = result;
  const failed = (result.done || []).filter((d) => !d.ok);
  state.notice = failed.length
    ? { tone: "is-danger", title: result.text, body: `But ${failed.length} Insert popup change${failed.length === 1 ? "" : "s"} failed: ${failed.map((d) => `${d.market} ${d.id}`).join(", ")}. Check ${failed.length === 1 ? "it" : "them"} in Klaviyo; the next change tries again.` }
    : { tone: "is-success", title: result.text, body: "The stores pick it up within a minute - the line under each switch shows when they have." };
  watchServed();
}

async function confirmPending() {
  if (!state.pending) return;
  const { change, expect } = state.pending;
  state.busy = "confirm";
  renderControl();
  try {
    await applyChange(change, expect);
  } catch (error) {
    changeFailed(error);
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
    state.notice = { tone: "is-danger", title: "The stores could not be checked.", body: error.message };
  }
  state.busy = "";
  renderControl();
}

async function copySnippet(button) {
  const text = state.status?.snippet || "";
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch (error) {
    button.textContent = "Select and copy";
  }
  setTimeout(() => { if (button.isConnected) button.textContent = "Copy"; }, 2000);
}

// ---------------------------------------------------------------------------------------------
// Signups

// Live when live is on; otherwise staging and tests, which is where signups come from before launch.
function signupsEnv() {
  if (state.signups.env) return state.signups.env;
  return state.status?.control?.live?.on ? "live" : "test";
}

function rangeSince(range, now = Date.now()) {
  const today = LOCAL_DAY.format(new Date(now));
  // midnight in Copenhagen: the offset is read off the formatter for that day, so summer time takes care of itself
  const midnight = (day) => {
    const guess = Date.parse(`${day}T00:00:00Z`);
    const local = new Date(guess).toLocaleString("en-US", { timeZone: "Europe/Copenhagen", hour12: false, hour: "2-digit" });
    return guess - (Number(local) % 24) * 3600000;
  };
  const back = { today: 0, "7d": 6, "30d": 29 }[range] ?? 6;
  const start = LOCAL_DAY.format(new Date(Date.parse(`${today}T12:00:00Z`) - back * 86400000));
  return new Date(midnight(start)).toISOString();
}

// Signups per day as columns, one per Danish day. A count per day is a magnitude per category, so columns, not a line.
// Each column is its own hover and focus target (showBarTip); the app's line-chart hover is not used, because it
// reads its position across the whole plot including the axis gutter, which puts its cursor beside a column.
function barChart(days, label) {
  if (!days.length) return "";
  const max = Math.max(...days.map((d) => d.subscribed), 0);
  const scale = niceScale(0, Math.max(max, 1), 3);
  const top = scale.max || 1;
  const ticks = scale.ticks.filter((t) => t >= 0 && t <= top);
  const n = days.length;
  const y = (v) => (100 - (v / top) * 100).toFixed(2);
  const labelEvery = Math.ceil(n / 6);
  const showLabel = (i) => i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery);
  return `<figure class="signup-bars">
    <div class="wp-chart-plot signup-bars-plot" style="height:160px">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        ${ticks.map((t) => `<line class="wp-chart-grid" x1="0" x2="100" y1="${y(t)}" y2="${y(t)}" vector-effect="non-scaling-stroke"></line>`).join("")}
      </svg>
      <div class="signup-bars-cols" style="--n:${n}">
        ${days.map((d) => `<span class="signup-bar-slot" tabindex="0" data-day="${escapeHtml(d.date)}" data-subscribed="${d.subscribed}" data-shown="${d.exposures}" aria-label="${escapeHtml(formatChartDate(d.date, { long: true }))}: ${d.subscribed} signed up of ${d.exposures} shown"><span class="signup-bar" style="height:${((d.subscribed / top) * 100).toFixed(2)}%"></span></span>`).join("")}
      </div>
      <div class="wp-chart-axis-y">${ticks.slice().reverse().map((t) => `<span style="top:${y(t)}%">${escapeHtml(formatCount(t))}</span>`).join("")}</div>
    </div>
    <figcaption class="wp-chart-axis-x">${days.map((d, i) => (showLabel(i) ? `<span style="left:${(((i + 0.5) / n) * 100).toFixed(2)}%">${escapeHtml(formatChartDate(d.date))}</span>` : "")).join("")}</figcaption>
  </figure>
  <table class="wp-sr-only"><caption>${escapeHtml(label)} per day</caption><thead><tr><th>Day</th><th>Signed up</th><th>Shown</th></tr></thead><tbody>${days.map((d) => `<tr><th scope="row">${escapeHtml(d.date)}</th><td>${d.subscribed}</td><td>${d.exposures}</td></tr>`).join("")}</tbody></table>`;
}

let barTip = null;
function showBarTip(slot) {
  if (!barTip) {
    barTip = document.createElement("div");
    barTip.className = "wp-chart-tooltip";
    barTip.hidden = true;
    document.body.appendChild(barTip);
  }
  const shown = Number(slot.dataset.shown) || 0;
  const subscribed = Number(slot.dataset.subscribed) || 0;
  barTip.innerHTML = `<p class="wp-chart-tooltip-date">${escapeHtml(formatChartDate(slot.dataset.day, { long: true }))}</p>
    <div class="wp-chart-tooltip-row"><span>Signed up</span><strong>${escapeHtml(formatCount(subscribed))}</strong></div>
    <div class="wp-chart-tooltip-row is-previous"><span>Shown</span><strong>${escapeHtml(formatCount(shown))}</strong></div>
    ${shown ? `<div class="wp-chart-tooltip-row is-previous"><span>Per shown</span><strong>${escapeHtml(percent(subscribed / shown))}</strong></div>` : ""}`;
  barTip.hidden = false;
  const box = slot.getBoundingClientRect();
  const bar = slot.querySelector(".signup-bar")?.getBoundingClientRect() || box;
  const size = barTip.getBoundingClientRect();
  const left = Math.min(Math.max(8, box.left + box.width / 2 - size.width / 2), window.innerWidth - size.width - 8);
  const above = Math.min(bar.top, box.bottom) - size.height - 10;
  barTip.style.left = `${Math.round(left)}px`;
  barTip.style.top = `${Math.round(above > 8 ? above : box.bottom + 10)}px`;
}
function hideBarTip() {
  if (barTip) barTip.hidden = true;
}

function marketRows(funnel, klaviyo) {
  const markets = marketEntries().map((m) => m.market);
  const rows = [];
  for (const m of markets) {
    const f = funnel?.byMarket?.[m] || { exposures: 0, opened: 0, subscribed: 0 };
    const k = klaviyo?.markets?.[m];
    if (!f.exposures && !f.subscribed && !(k && (k.submitted || k.confirmed || k.botBlocked)) && !klaviyo?.errors?.[m]) continue;
    rows.push(`<tr>
      <td><strong>${escapeHtml(m)}</strong></td>
      <td class="is-numeric">${count(f.exposures)}</td>
      <td class="is-numeric">${count(f.opened)}</td>
      <td class="is-numeric">${count(f.subscribed)}</td>
      <td class="is-numeric">${f.exposures ? percent(f.subscribed / f.exposures) : "–"}</td>
      ${klaviyo?.errors?.[m] ? `<td colspan="2" class="signup-error-cell">${escapeHtml(klaviyo.errors[m])}</td>` : `<td class="is-numeric">${klaviyo ? count(k?.confirmed || 0) : "…"}</td><td class="is-numeric">${klaviyo ? count(k?.botBlocked || 0) : "…"}</td>`}
    </tr>`);
  }
  return rows;
}

function funnelRow(name, b) {
  return `<tr>
    <td><strong>${escapeHtml(name)}</strong></td>
    <td class="is-numeric">${count(b.exposures)}</td>
    <td class="is-numeric">${count(b.opened)}</td>
    <td class="is-numeric">${count(b.interacted)}</td>
    <td class="is-numeric">${count(b.emailFocus)}</td>
    <td class="is-numeric">${count(b.subscribed)}</td>
    <td class="is-numeric">${percent(b.subscribedPerExposure)}</td>
    <td class="is-numeric">${percent(b.subscribedPerOpen, 1)}</td>
    <td class="is-numeric">${b.medianSecondsToSubscribe == null ? "–" : `${b.medianSecondsToSubscribe} s`}</td>
  </tr>`;
}

function renderSignups() {
  const node = byId("signup-lab-signups");
  if (!node) return;
  const s = state.signups;
  const env = signupsEnv();
  const toolbar = `<div class="signup-toolbar">
    <div class="wp-segment" role="tablist" aria-label="Where the signups come from">
      <button class="wp-segment-item ${env === "live" ? "active" : ""}" type="button" role="tab" aria-selected="${env === "live"}" data-signup-env="live">Live stores</button>
      <button class="wp-segment-item ${env === "test" ? "active" : ""}" type="button" role="tab" aria-selected="${env === "test"}" data-signup-env="test">Staging &amp; tests</button>
    </div>
    <div class="wp-segment" role="tablist" aria-label="Window">
      ${RANGES.map((r) => `<button class="wp-segment-item ${s.range === r.id ? "active" : ""}" type="button" role="tab" aria-selected="${s.range === r.id}" data-signup-range="${r.id}">${r.label}</button>`).join("")}
    </div>
    <span class="signup-window">${s.readAt ? `Read ${escapeHtml(CLOCK.format(s.readAt))}` : ""}</span>
    <button class="wp-button is-sm" type="button" data-signup-reload ${s.loading ? "disabled" : ""}>Read again</button>
  </div>`;
  const scope = env === "live"
    ? "Visitors on the live stores. Signups go to each market's own newsletter list."
    : "Staging, previews opened on a store with ?wps=, and tests. Every signup here went to the TEST list in Klaviyo, never a newsletter.";
  if (s.error) {
    node.innerHTML = `${toolbar}<div class="wp-state is-error"><p class="wp-state-title">The figures could not be loaded</p><p class="wp-state-body">${escapeHtml(s.error)}</p></div>`;
    return;
  }
  if (s.loading && !s.data) {
    node.innerHTML = `${toolbar}<div class="wp-loading"><span class="wp-spinner"></span> Loading</div>`;
    return;
  }
  if (!s.data) { node.innerHTML = toolbar; return; }
  const d = s.data;
  const t = d.total;
  const k = s.klaviyo;
  const today = d.days?.[d.days.length - 1];
  const concepts = Object.entries(d.concepts || {});
  const rows = marketRows(d, k);
  const liveOff = env === "live" && !state.status?.control?.live?.on;
  const kFoot = s.klaviyoError ? "Klaviyo could not be read" : !k ? "Reading Klaviyo…" : `Of ${count(k.total.submitted)} who signed up · ${count(k.total.botBlocked)} taken by bot protection`;

  node.innerHTML = `${toolbar}
    <p class="signup-window">${escapeHtml(scope)} ${escapeHtml(d.from === d.to ? d.from : `${d.from} to ${d.to}`)}, Danish time.</p>
    ${liveOff ? '<div class="wp-alert is-info"><div><strong>Live is off.</strong> Nothing runs on the live stores yet, so there is nothing to count here. Staging &amp; tests shows what has been tried.</div></div>' : ""}
    ${s.klaviyoError ? `<div class="wp-alert is-danger"><div><strong>Klaviyo could not be read.</strong> ${escapeHtml(s.klaviyoError)}</div></div>` : ""}
    <div class="wp-metrics signup-metrics">
      <div class="wp-metric is-lead"><span class="wp-metric-label">Signed up</span><span class="wp-metric-value">${count(t.subscribed)}</span>
        <span class="wp-metric-foot">${s.range === "today" ? "Accepted by Klaviyo today" : `Today ${count(today?.subscribed ?? 0)} · accepted by Klaviyo`}</span></div>
      <div class="wp-metric"><span class="wp-metric-label">On the list</span><span class="wp-metric-value">${k ? count(k.total.confirmed) : "…"}</span>
        <span class="wp-metric-foot">${escapeHtml(kFoot)}</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Signed up per shown</span><span class="wp-metric-value">${percent(t.subscribedPerExposure)}</span>
        <span class="wp-metric-foot">The figure that says when an experience is worn out</span></div>
      <div class="wp-metric"><span class="wp-metric-label">Shown</span><span class="wp-metric-value">${count(t.exposures)}</span>
        <span class="wp-metric-foot">Opened ${count(t.opened)}${t.exposures ? ` (${percent(t.opened / t.exposures, 0)})` : ""}</span></div>
    </div>

    ${s.range !== "today" ? `<section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Signed up per day</h3>
        <p class="wp-section-description">Accepted by Klaviyo when the visitor pressed the button. "On the list" above is what is still in Klaviyo now.</p></div></div>
      ${t.subscribed ? barChart(d.days || [], "Signed up") : '<p class="signup-empty">Nobody signed up in this window.</p>'}
    </section>` : ""}

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">Latest signups</h3>
        <p class="wp-section-description">Who signed up is in Klaviyo; this page counts, it never holds an email address.</p></div></div>
      ${d.latest?.length ? `<div class="wp-table-wrap"><table class="wp-table">
        <thead><tr><th>When</th><th>Market</th><th>Experience</th><th>Device</th><th>Page</th><th class="is-numeric">Time to sign up</th></tr></thead>
        <tbody>${d.latest.map((x) => `<tr><td>${escapeHtml(formatTime(x.at))}</td><td><strong>${escapeHtml(x.market)}</strong></td><td>${escapeHtml(conceptName(x.concept))}</td><td>${escapeHtml(DEVICE_WORDS[x.device] || x.device || "–")}</td><td>${escapeHtml(PAGE_TYPES[x.page] || x.page || "–")}</td><td class="is-numeric">${x.seconds == null ? "–" : `${x.seconds} s`}</td></tr>`).join("")}</tbody>
      </table></div>` : '<p class="signup-empty">No signups in this window.</p>'}
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">By market</h3>
        <p class="wp-section-description">${env === "live" ? "On the list: in that market's newsletter list now, with the Signup Lab as its source." : "On the list: on the TEST list now. The market is the store the test was made on."} Bot protection: accepted, then suppressed by Klaviyo as automated.</p></div></div>
      ${rows.length ? `<div class="wp-table-wrap"><table class="wp-table">
        <thead><tr><th>Market</th><th class="is-numeric">Shown</th><th class="is-numeric">Opened</th><th class="is-numeric">Signed up</th><th class="is-numeric">Per shown</th><th class="is-numeric">On the list</th><th class="is-numeric">Bot protection</th></tr></thead>
        <tbody>${rows.join("")}
          <tr class="signup-total"><td>All markets</td><td class="is-numeric">${count(t.exposures)}</td><td class="is-numeric">${count(t.opened)}</td><td class="is-numeric">${count(t.subscribed)}</td><td class="is-numeric">${percent(t.subscribedPerExposure)}</td><td class="is-numeric">${k ? count(k.total.confirmed) : "…"}</td><td class="is-numeric">${k ? count(k.total.botBlocked) : "…"}</td></tr></tbody>
      </table></div>` : '<p class="signup-empty">Nobody was shown the experience in this window.</p>'}
    </section>

    <section class="wp-section">
      <div class="wp-section-header"><div><h3 class="wp-section-title">By experience</h3>
        <p class="wp-section-description">"Shown" is the dialog on a computer or the card on a phone. Interacted: did anything in it. Typed email: put the cursor in the email field.</p></div></div>
      ${concepts.length ? `<div class="wp-table-wrap"><table class="wp-table">
        <thead><tr><th>Experience</th><th class="is-numeric">Shown</th><th class="is-numeric">Opened</th><th class="is-numeric">Interacted</th><th class="is-numeric">Typed email</th><th class="is-numeric">Signed up</th><th class="is-numeric">Per shown</th><th class="is-numeric">Per opened</th><th class="is-numeric">Median time</th></tr></thead>
        <tbody>${concepts.map(([id, b]) => funnelRow(conceptName(id), b)).join("")}</tbody>
      </table></div>` : '<p class="signup-empty">Nobody was shown an experience in this window.</p>'}
    </section>`;
}

async function loadSignups({ force = false } = {}) {
  const s = state.signups;
  const env = signupsEnv();
  const since = rangeSince(s.range);
  const key = `${env}|${s.range}`;
  if (!force && s.key === key && s.data && Date.now() - s.readAt < 60000) { renderSignups(); return; }
  // another window or environment never shows the previous one's figures while it loads; "Read again" keeps them
  if (s.key !== key) s.data = null;
  s.key = key;
  s.loading = true;
  s.error = "";
  s.klaviyoError = "";
  s.klaviyo = null;
  hideBarTip();
  renderSignups();
  const funnel = call("/api/signup/track", { query: { action: "report", env, since } });
  const klaviyo = call("/api/signup/track", { query: { action: "confirmed", env, since } });
  try {
    const data = await funnel;
    if (s.key !== key) return;
    s.data = data;
  } catch (error) {
    if (s.key === key) s.error = error.message;
  }
  s.loading = false;
  s.readAt = Date.now();
  if (state.view === "signups") renderSignups();
  try {
    const data = await klaviyo;
    if (s.key !== key) return;
    s.klaviyo = data;
    const failed = Object.entries(data.errors || {});
    if (failed.length) s.klaviyoError = `${failed.map(([m, e]) => `${m}: ${e}`).join("; ")}.`;
  } catch (error) {
    if (s.key === key) s.klaviyoError = error.message;
  }
  if (state.view === "signups") renderSignups();
}

// ---------------------------------------------------------------------------------------------
// Preview

function previewConcept() {
  return state.preview.concept || state.status?.control?.live?.current || "logo-studio";
}

function previewMarket() {
  return marketEntries().find((m) => m.code === state.preview.market) || { code: state.preview.market, market: "DK" };
}

// The page a store visitor gets, with the experience opened at once. Never tracked: a preview is not a visitor.
function previewSrc() {
  const p = state.preview;
  const q = new URLSearchParams({ market: p.market, concept: previewConcept(), open: p.open, reset: "1", track: "" });
  if (p.submit !== "test") q.set("dry", "1");
  return `/signup/preview/frame.html?${q}`;
}

function renderPreviewControls() {
  const node = byId("signup-lab-preview-controls");
  if (!node) return;
  const p = state.preview;
  const concept = previewConcept();
  const market = previewMarket();
  const stagingTagged = state.status?.control?.storeCheck?.staging?.[market.market]?.tag === "yes";
  node.innerHTML = `
    <div class="signup-preview-row">
      <span class="signup-env-label">Experience</span>
      <div class="wp-segment" role="radiogroup" aria-label="Experience">${(state.status?.concepts || []).map((c) => `<button class="wp-segment-item ${c.id === concept ? "active" : ""}" type="button" role="radio" aria-checked="${c.id === concept}" data-preview-concept="${c.id}">${escapeHtml(c.name)}</button>`).join("")}</div>
    </div>
    <div class="signup-preview-row">
      <label class="signup-env-label" for="signup-preview-market">Market</label>
      <select class="wp-select signup-preview-market" id="signup-preview-market" data-preview-market>
        ${marketEntries().map((m) => `<option value="${escapeHtml(m.code)}" ${m.code === p.market ? "selected" : ""}>${escapeHtml(m.market)} · ${escapeHtml(languageOf(m.lang))}</option>`).join("")}
      </select>
    </div>
    <div class="signup-preview-row">
      <span class="signup-env-label">Device</span>
      <div class="wp-segment" role="radiogroup" aria-label="Device">${Object.entries(DEVICES).map(([id, dev]) => `<button class="wp-segment-item ${id === p.device ? "active" : ""}" type="button" role="radio" aria-checked="${id === p.device}" data-preview-device="${id}">${dev.label}</button>`).join("")}</div>
    </div>
    <div class="signup-preview-row">
      <span class="signup-env-label">Opens as</span>
      <div class="wp-segment" role="radiogroup" aria-label="Opens as">
        <button class="wp-segment-item ${p.open === "1" ? "active" : ""}" type="button" role="radio" aria-checked="${p.open === "1"}" data-preview-open="1">The experience</button>
        <button class="wp-segment-item ${p.open === "peek" ? "active" : ""}" type="button" role="radio" aria-checked="${p.open === "peek"}" data-preview-open="peek">Phone card first</button>
      </div>
    </div>
    <div class="signup-preview-row">
      <span class="signup-env-label">Signup</span>
      <div class="wp-segment" role="radiogroup" aria-label="What a signup does">
        <button class="wp-segment-item ${p.submit === "dry" ? "active" : ""}" type="button" role="radio" aria-checked="${p.submit === "dry"}" data-preview-submit="dry">Dry run</button>
        <button class="wp-segment-item ${p.submit === "test" ? "active" : ""}" type="button" role="radio" aria-checked="${p.submit === "test"}" data-preview-submit="test">Real, to the TEST list</button>
      </div>
    </div>
    <p class="signup-preview-note">${p.submit === "test"
      ? "A signup here really reaches Klaviyo: the TEST list in the DK account, never a newsletter. It shows up under Signups → Staging &amp; tests. Klaviyo's bot protection may suppress repeated test signups from one machine."
      : "Dry run: the signup is answered as Klaviyo would answer it, and nothing is sent."} ${p.open === "peek" ? "On a phone the experience never opens by itself: the card slides in and the experience opens when it is tapped." : ""}</p>
    <div class="wp-button-group">
      <button class="wp-button is-primary is-sm" type="button" data-preview-again>Show again</button>
      <a class="wp-button is-sm" href="${STAGING_ORIGIN}/${escapeHtml(market.code)}/?wps=${escapeHtml(concept)}" target="_blank" rel="noopener" title="${stagingTagged ? "Opens the experience on the real staging store, on the TEST list" : "The staging store for this market does not carry the tag (by the last store check)"}">On the staging store ↗</a>
      <a class="wp-button is-ghost is-sm" href="/signup/preview/?${new URLSearchParams({ concept, market: market.code })}" target="_blank" rel="noopener">Full-screen preview ↗</a>
    </div>`;
}

function fitPreview() {
  const stage = byId("signup-lab-preview-stage");
  const device = stage?.querySelector(".signup-device");
  const frame = device?.querySelector("iframe");
  if (!stage || !device || !frame) return;
  const [w, h] = DEVICES[state.preview.device].size;
  const room = stage.clientWidth - 32;
  if (room <= 0) return; // hidden: measured again when shown
  const tall = Math.max(520, window.innerHeight - 200);
  const scale = Math.min(1, room / w, tall / h);
  device.style.width = `${Math.round(w * scale)}px`;
  device.style.height = `${Math.round(h * scale)}px`;
  frame.style.width = `${w}px`;
  frame.style.height = `${h}px`;
  frame.style.transform = `scale(${scale})`;
  device.dataset.kind = state.preview.device === "computer" ? "computer" : "phone";
  const badge = stage.querySelector(".signup-device-size");
  if (badge) badge.textContent = `${w} × ${h}${scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}`;
}

function renderPreviewLog() {
  const node = byId("signup-lab-preview-log");
  if (!node) return;
  const log = state.preview.log;
  node.innerHTML = log.length
    ? log.map((l) => `<li class="${l.tone ? `is-${l.tone}` : ""}"><time>${escapeHtml(l.time)}</time><span>${escapeHtml(l.text)}</span></li>`).join("")
    : '<li class="is-muted"><span>What the visitor does shows here, step by step.</span></li>';
}

function renderPreview({ reload = false } = {}) {
  renderPreviewControls();
  const stage = byId("signup-lab-preview-stage");
  if (!stage) return;
  const src = previewSrc();
  let frame = stage.querySelector("iframe");
  if (!frame) {
    stage.innerHTML = `<div class="signup-device"><iframe title="A Westpack store page with the Signup Lab" loading="eager"></iframe></div><span class="signup-device-size"></span>`;
    frame = stage.querySelector("iframe");
  }
  if (reload || frame.dataset.src !== src) {
    frame.dataset.src = src;
    frame.src = src;
    const market = previewMarket();
    state.preview.log = [{ time: CLOCK.format(Date.now()), text: `${conceptName(previewConcept())} · ${market.market} · ${DEVICES[state.preview.device].label}${state.preview.submit === "test" ? " · real signups to the TEST list" : " · dry run"}` }];
    renderPreviewLog();
  }
  fitPreview();
}

const STEP_WORDS = { open: "Opened", peek_shown: "Phone card shown", peek_dismissed: "Card dismissed", email_focus: "Clicked into the email field", email_invalid: "Typed an address that is not valid", submit: "Pressed sign up", subscribed: "Signed up", submit_error: "Signup failed", name_typed: "Typed a brand name", result: "Reached the result" };

function onPreviewMessage(event) {
  const frame = byId("signup-lab-preview-stage")?.querySelector("iframe");
  if (!frame || event.source !== frame.contentWindow) return;
  const data = event.data || {};
  const time = CLOCK.format(Date.now());
  if (data.wps === "step") {
    const step = String(data.detail?.step || "");
    state.preview.log.push({ time, text: STEP_WORDS[step] || step.replace(/_/g, " "), tone: step === "subscribed" ? "success" : step === "submit_error" ? "danger" : "" });
  } else if (data.wps === "subscribed") {
    state.preview.log.push({ time, text: data.detail?.dryRun ? "Dry run: nothing was sent to Klaviyo." : "Sent to the TEST list in Klaviyo.", tone: "success" });
  } else {
    return;
  }
  state.preview.log = state.preview.log.slice(-60);
  renderPreviewLog();
  const list = byId("signup-lab-preview-log");
  if (list) list.scrollTop = list.scrollHeight;
}

// ---------------------------------------------------------------------------------------------
// Wiring

function setActiveNav() {
  document.querySelectorAll("[data-signup-view]").forEach((button) => {
    const current = document.body.dataset.workspace === "signup" && button.dataset.signupView === state.view;
    button.classList.toggle("active", current);
    if (current) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function showPanels() {
  document.querySelectorAll("[data-signup-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.signupPanel !== state.view;
  });
  setActiveNav();
}

// The Signup Lab has an address of its own: #signup-lab, #signup-lab/signups, #signup-lab/preview.
export function signupLabViewFromHash(hash = "") {
  const match = /^#signup-lab(?:\/([a-z]+))?$/.exec(String(hash || ""));
  if (!match) return null;
  return VIEWS.includes(match[1] || "control") ? match[1] || "control" : null;
}

function writeHash() {
  const hash = state.view === "control" ? "#signup-lab" : `#signup-lab/${state.view}`;
  if (window.location.hash !== hash) history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
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
  if (target.closest("[data-signup-reach]")) return requestChange({ type: "reach" });
  if (target.closest("[data-signup-confirm]")) return confirmPending();
  if (target.closest("[data-signup-cancel]")) {
    state.pending = null;
    renderControl();
    return;
  }
  if (target.closest("[data-signup-check]")) return checkStoresNow();
  const copy = target.closest("[data-signup-copy]");
  if (copy) return copySnippet(copy);

  const env = target.closest("[data-signup-env]");
  if (env) {
    state.signups.env = env.dataset.signupEnv;
    return loadSignups();
  }
  const range = target.closest("[data-signup-range]");
  if (range) {
    state.signups.range = range.dataset.signupRange;
    return loadSignups();
  }
  if (target.closest("[data-signup-reload]")) return loadSignups({ force: true });

  const concept = target.closest("[data-preview-concept]");
  if (concept) { state.preview.concept = concept.dataset.previewConcept; return renderPreview(); }
  const device = target.closest("[data-preview-device]");
  if (device) { state.preview.device = device.dataset.previewDevice; return renderPreview({ reload: true }); }
  const open = target.closest("[data-preview-open]");
  if (open) { state.preview.open = open.dataset.previewOpen; return renderPreview(); }
  const submit = target.closest("[data-preview-submit]");
  if (submit) { state.preview.submit = submit.dataset.previewSubmit; return renderPreview(); }
  if (target.closest("[data-preview-again]")) return renderPreview({ reload: true });
}

function handleChange(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const market = target.closest("[data-signup-market]");
  if (market) {
    // the box shows the stored state until the change is made; a refused change must not leave it ticked
    const on = market.checked;
    market.checked = !on;
    requestChange({ type: "market", market: market.dataset.signupMarket, on });
    return;
  }
  const previewMarketSelect = target.closest("[data-preview-market]");
  if (previewMarketSelect) {
    state.preview.market = previewMarketSelect.value;
    renderPreview();
  }
}

export function initSignupLab() {
  const panel = byId("signup-product-panel");
  if (!panel || panel.dataset.signupWired === "true") return;
  panel.dataset.signupWired = "true";
  panel.addEventListener("click", handleClick);
  panel.addEventListener("change", handleChange);
  // the per-day columns: each is its own hover and keyboard target
  const overBar = (event) => {
    const slot = event.target instanceof Element ? event.target.closest(".signup-bar-slot") : null;
    if (slot) showBarTip(slot);
  };
  const leaveBar = (event) => {
    const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest(".signup-bar-slot") : null;
    if (!next) hideBarTip();
  };
  panel.addEventListener("pointerover", overBar);
  panel.addEventListener("focusin", overBar);
  panel.addEventListener("pointerout", leaveBar);
  panel.addEventListener("focusout", leaveBar);
  window.addEventListener("scroll", hideBarTip, { passive: true, capture: true });
  window.addEventListener("message", onPreviewMessage);
  window.addEventListener("resize", () => { if (state.view === "preview") fitPreview(); }, { passive: true });
}

export function showSignupLabView(view = "control") {
  initSignupLab();
  state.view = VIEWS.includes(view) ? view : "control";
  showPanels();
  writeHash();
  if (state.view === "control") {
    renderControl();
    loadStatus().then(watchServed);
  } else if (state.view === "signups") {
    renderSignups();
    // the status says whether live is on, which decides what the page opens on
    (state.status ? Promise.resolve() : loadStatus()).then(() => loadSignups());
  } else if (state.status) {
    renderPreview();
  } else {
    loadStatus().then(() => { if (state.view === "preview") renderPreview(); });
  }
}

// Leaving the Signup Lab takes its address off the URL, so a reload opens where the person now is.
export function leaveSignupLab() {
  clearTimeout(state.served.timer);
  if (signupLabViewFromHash(window.location.hash)) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

export const __signupLabInternals = { state, renderControl, renderSignups, renderPreview, needsConfirmation, rangeSince, signupLabViewFromHash, barChart };
