// Canva Localizer - the operator's screen.
//
// One page, four blocks, no wizard. The brief was explicit: eighteen languages generated
// correctly in thirty seconds beats a beautiful flow with ten screens, so every step is visible
// at once and the primary actions sit in one column on the right. Nothing here confirms twice.
//
// The screen is honest about the two places Canva does not cooperate:
//
// - A design with no tagged data fields says so and links to Canva, instead of showing an empty
//   table that looks like a bug.
// - Source text is typed or read by OCR from a rendered export, and the OCR route is labelled as
//   OCR wherever it appears, because Canva's API cannot read the text inside a design.

// A batch action returns after a soft deadline with whatever is left, so the client simply calls
// it again. The cap stops a genuinely stuck job from looping forever against the API.
const MAX_BATCH_CONTINUATIONS = 8;

const state = {
  loaded: false,
  status: null,
  designQuery: "",
  designs: [],
  continuation: "",
  design: null,
  pages: [],
  fields: [],
  tagged: true,
  selectedMarkets: new Set(),
  job: null,
  summary: null,
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

async function callLocalizer(action, { method = "GET", body = null, query = {} } = {}) {
  const url = new URL("/api/canva/localizer", window.location.origin);
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
  if (!response.ok) throw new Error(payload?.error || `Canva Localizer request failed (${response.status}).`);
  return payload;
}

function setFeedback(message, tone = "") {
  state.feedback = message;
  state.feedbackTone = tone;
  const node = byId("canva-localizer-feedback");
  if (!node) return;
  node.textContent = message;
  node.className = `inline-feedback${tone ? ` ${tone}` : ""}`;
}

function setBusy(label) {
  state.busy = label;
  const node = byId("canva-localizer-busy");
  if (node) {
    node.textContent = label || "";
    node.hidden = !label;
  }
  document.querySelectorAll("[data-canva-action]").forEach((button) => {
    button.disabled = Boolean(label);
  });
}

async function runAction(label, fn) {
  if (state.busy) return;
  setBusy(label);
  try {
    await fn();
  } catch (error) {
    setFeedback(error?.message || "Something went wrong.", "is-danger");
  } finally {
    setBusy("");
  }
}

/* --------------------------------------------------------------------- connection */

function renderConnection() {
  const pill = byId("canva-connection-pill");
  const actions = byId("canva-connection-actions");
  const notice = byId("canva-capability-notice");
  const connection = state.status?.connection;
  if (!pill || !actions) return;

  if (!connection?.configured) {
    pill.className = "status-pill warning";
    pill.textContent = "Canva not configured";
    actions.innerHTML = "";
    if (notice) {
      notice.hidden = false;
      notice.className = "wp-alert is-warning";
      notice.innerHTML = "<strong>Canva is not configured.</strong> Add <code>CANVA_CLIENT_ID</code> and "
        + "<code>CANVA_CLIENT_SECRET</code> from a Canva developer app, with "
        + "<code>/api/canva/oauth</code> registered as its redirect URL.";
    }
    return;
  }

  if (!connection.connected) {
    pill.className = "status-pill warning";
    pill.textContent = "Canva not connected";
    actions.innerHTML = '<button class="primary-button" data-canva-action="connect" type="button">Connect Canva</button>';
    if (notice) notice.hidden = true;
    return;
  }

  pill.className = connection.canAutofill ? "status-pill" : "status-pill warning";
  pill.textContent = connection.canAutofill
    ? `Canva connected${connection.displayName ? ` · ${connection.displayName}` : ""}`
    : "Canva connected · autofill unavailable";
  actions.innerHTML = [
    '<button class="ghost-button" data-canva-action="refresh-capabilities" type="button">Re-check plan</button>',
    '<button class="ghost-button" data-canva-action="disconnect" type="button">Disconnect</button>'
  ].join("");

  if (!notice) return;
  if (connection.canAutofill) {
    notice.hidden = true;
    return;
  }
  // The single capability the whole feature turns on. Stated once, at the top, with what to do
  // about it - rather than letting the operator discover it as eighteen identical failures.
  notice.hidden = false;
  notice.className = "wp-alert is-danger";
  notice.innerHTML = "<strong>This Canva account cannot generate language versions.</strong> Canva restricts the "
    + "Autofill API - the only way to write text into a design over the API - to members of a "
    + "Canva Enterprise organisation. Everything else on this page works: you can browse designs, "
    + "read their data fields, translate the copy and export existing designs. "
    + `Capabilities Canva reports for this account: ${escapeHtml((connection.capabilities || []).join(", ") || "none")}.`;
}

/* ------------------------------------------------------------------------- design */

function renderDesignResults() {
  const node = byId("canva-design-results");
  if (!node) return;
  if (!state.designs.length) {
    node.innerHTML = '<p class="wp-help">Search your Canva projects, or paste a design link above.</p>';
    return;
  }

  node.innerHTML = state.designs.map((design) => `
    <button class="canva-design-card${state.design?.id === design.id ? " is-selected" : ""}"
            data-canva-action="select-design" data-design-id="${escapeHtml(design.id)}" type="button">
      ${design.thumbnailUrl
        ? `<img src="${escapeHtml(design.thumbnailUrl)}" alt="" loading="lazy">`
        : '<span class="canva-design-card-blank" aria-hidden="true"></span>'}
      <span class="canva-design-card-title">${escapeHtml(design.title)}</span>
      <span class="canva-design-card-meta">${design.width || "?"}×${design.height || "?"} · ${design.pageCount || 1} page(s)</span>
    </button>
  `).join("");
}

function renderSelectedDesign() {
  const node = byId("canva-selected-design");
  if (!node) return;
  if (!state.design) {
    node.innerHTML = '<p class="wp-help">No design selected yet.</p>';
    return;
  }

  const design = state.design;
  node.innerHTML = `
    <div class="canva-selected-design">
      ${design.thumbnailUrl ? `<img src="${escapeHtml(design.thumbnailUrl)}" alt="">` : ""}
      <div class="canva-selected-design-body">
        <h4>${escapeHtml(design.title)}</h4>
        <p class="wp-help">${design.width || "?"}×${design.height || "?"} px · ${design.pageCount || 1} page(s)
          · ${escapeHtml((design.designTypes || []).join(", ") || "design")}</p>
        <p class="wp-help">${state.fields.length} data field(s) tagged in Canva.</p>
        ${design.editUrl ? `<a class="ghost-button" href="${escapeHtml(design.editUrl)}" target="_blank" rel="noreferrer">Open in Canva</a>` : ""}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------------- fields */

function renderFields() {
  const node = byId("canva-field-table");
  if (!node) return;

  if (!state.design) {
    node.innerHTML = '<p class="wp-help">Choose a design to see the text it exposes.</p>';
    return;
  }

  if (!state.tagged) {
    // Not an error state. The design is fine; it has not been prepared, and this says exactly
    // what to do about it, because nothing else on the page can work until it is.
    node.innerHTML = `
      <div class="wp-state">
        <p class="wp-state-title">This design has no data fields yet</p>
        <p class="wp-state-body">Canva's API can only read and write text that has been tagged as a data field.
          Open the design in Canva, run the <strong>Data autofill</strong> app, select each text element that should be
          translated and add it as a field. Leave brand names, logos and URLs untagged - untagged text can never be
          overwritten. You only do this once per master design.</p>
        <div class="wp-state-actions">
          ${state.design.editUrl ? `<a class="primary-button" href="${escapeHtml(state.design.editUrl)}" target="_blank" rel="noreferrer">Open in Canva</a>` : ""}
          <button class="ghost-button" data-canva-action="reload-design" type="button">Check again</button>
        </div>
      </div>`;
    return;
  }

  const rows = state.fields.map((field) => {
    const isText = field.type === "text";
    const budget = field.budget || 0;
    return `
      <tr data-field-key="${escapeHtml(field.key)}">
        <td><code>${escapeHtml(field.key)}</code></td>
        <td>${escapeHtml(field.type)}</td>
        <td>
          ${isText
            ? `<input class="wp-input canva-field-source" type="text" value="${escapeHtml(field.sourceText)}"
                      data-field-key="${escapeHtml(field.key)}" placeholder="Text as it reads in the design">`
            : '<span class="wp-help">Not text - left untouched</span>'}
        </td>
        <td class="canva-field-budget">${isText && budget ? `${budget}` : "–"}</td>
        <td>
          ${isText
            ? `<label class="wp-check"><input type="checkbox" class="canva-field-translate"
                      data-field-key="${escapeHtml(field.key)}" ${field.translate ? "checked" : ""}><span></span></label>`
            : ""}
        </td>
      </tr>`;
  }).join("");

  node.innerHTML = `
    <div class="wp-table-wrap">
      <table class="wp-table canva-field-table">
        <thead>
          <tr>
            <th>Field</th><th>Type</th><th>Source text</th><th>Max chars</th><th>Translate</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="wp-help">Max chars is the length budget handed to the translator, taken from the source text plus a
      small allowance. Canva exposes no font size or box size, so this is how the artwork is protected.</p>`;
}

/* ------------------------------------------------------------------------ markets */

function renderMarkets() {
  const node = byId("canva-market-grid");
  if (!node) return;
  const markets = state.status?.markets || [];
  if (!markets.length) {
    node.innerHTML = '<p class="wp-help">No markets are configured.</p>';
    return;
  }

  node.innerHTML = markets.map((market) => `
    <label class="canva-market-chip${state.selectedMarkets.has(market.marketCode) ? " is-selected" : ""}">
      <input type="checkbox" class="canva-market-toggle" data-market="${escapeHtml(market.marketCode)}"
             ${state.selectedMarkets.has(market.marketCode) ? "checked" : ""}>
      <span class="canva-market-code">${escapeHtml(market.marketCode)}</span>
      <span class="canva-market-language">${escapeHtml(market.language)}</span>
    </label>`).join("");
}

/* ------------------------------------------------------------------------ versions */

function fitBadge(target) {
  if (target.state === "failed") return '<span class="wp-badge is-danger">Failed</span>';
  if (target.state === "pending") return '<span class="wp-badge">Not translated</span>';

  const visual = target.visualCheck;
  if (visual?.verdict === "broken") return '<span class="wp-badge is-danger">Rendered: text broken</span>';
  if (visual?.verdict === "tight") return '<span class="wp-badge is-warning">Rendered: check it</span>';
  if (visual?.verdict === "clean") return '<span class="wp-badge is-success">Rendered: clean</span>';

  const fit = target.fit || {};
  if (fit.status === "over") return `<span class="wp-badge is-danger">Too long on ${escapeHtml(fit.worstField || "a field")}</span>`;
  if (fit.status === "tight") return `<span class="wp-badge is-warning">Tight on ${escapeHtml(fit.worstField || "a field")}</span>`;
  if (fit.status === "empty") return '<span class="wp-badge is-danger">A field came back empty</span>';
  return '<span class="wp-badge is-success">All text fits</span>';
}

function renderVersions() {
  const node = byId("canva-version-grid");
  if (!node) return;
  const targets = state.job?.targets || [];
  if (!targets.length) {
    node.innerHTML = '<p class="wp-help">Pick markets and translate to see the versions here.</p>';
    return;
  }

  node.innerHTML = targets.map((target) => {
    const translated = Object.entries(target.translatedFields || {});
    const exportLinks = (target.exportUrls || []).map((url, index) => `
      <a class="ghost-button is-sm" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" download>
        Download${(target.exportUrls || []).length > 1 ? ` p${index + 1}` : ""}</a>`).join("");

    return `
      <article class="canva-version-card is-${escapeHtml(target.state)}">
        <header class="canva-version-head">
          <div>
            <h4>${escapeHtml(target.marketCode)} · ${escapeHtml(target.language)}</h4>
            <p class="wp-help">${escapeHtml(target.title || "–")}</p>
          </div>
          ${fitBadge(target)}
        </header>

        ${target.thumbnailUrl ? `<img class="canva-version-thumb" src="${escapeHtml(target.thumbnailUrl)}" alt="" loading="lazy">` : ""}

        ${translated.length ? `<dl class="canva-version-copy">${translated.map(([key, text]) => `
          <dt>${escapeHtml(key)}</dt><dd>${escapeHtml(text)}</dd>`).join("")}</dl>` : ""}

        ${target.error ? `<p class="inline-feedback is-danger">${escapeHtml(target.error)}</p>` : ""}
        ${target.visualCheck?.summary ? `<p class="wp-help">${escapeHtml(target.visualCheck.summary)}</p>` : ""}
        ${(target.visualCheck?.problems || []).length ? `<ul class="canva-version-problems">${
          target.visualCheck.problems.map((problem) => `<li><strong>${escapeHtml(problem.issue)}</strong>: ${escapeHtml(problem.detail)}</li>`).join("")
        }</ul>` : ""}

        <footer class="canva-version-actions">
          ${target.editUrl ? `<a class="ghost-button is-sm" href="${escapeHtml(target.editUrl)}" target="_blank" rel="noreferrer">Open</a>` : ""}
          ${exportLinks}
          ${target.state === "translated" || target.state === "failed"
            ? `<button class="ghost-button is-sm" data-canva-action="generate-one" data-market="${escapeHtml(target.marketCode)}" type="button">Generate</button>`
            : ""}
          ${target.state === "generated"
            ? `<button class="ghost-button is-sm" data-canva-action="inspect-one" data-market="${escapeHtml(target.marketCode)}" type="button">Check fit</button>`
            : ""}
          <button class="ghost-button is-sm" data-canva-action="retranslate-one" data-market="${escapeHtml(target.marketCode)}" type="button">Retranslate</button>
        </footer>
      </article>`;
  }).join("");
}

function renderSummary() {
  const node = byId("canva-localizer-summary");
  if (!node) return;
  const summary = state.summary;
  if (!summary) {
    node.innerHTML = '<p class="wp-help">Nothing generated yet.</p>';
    return;
  }
  node.innerHTML = `
    <ul class="canva-summary-list">
      <li><span>Markets</span><strong>${summary.total}</strong></li>
      <li><span>Translated</span><strong>${summary.translated}</strong></li>
      <li><span>Generated in Canva</span><strong>${summary.generated}</strong></li>
      <li><span>Needs review</span><strong>${summary.needsReview}</strong></li>
      <li><span>Failed</span><strong>${summary.failed}</strong></li>
      <li><span>Exported</span><strong>${summary.exported}</strong></li>
    </ul>
    <p class="wp-help">Export links come from Canva and stop working 24 hours after they are made.</p>`;
}

function renderAll() {
  renderConnection();
  renderDesignResults();
  renderSelectedDesign();
  renderFields();
  renderMarkets();
  renderVersions();
  renderSummary();
}

/* ------------------------------------------------------------------------ actions */

function readFieldsFromDom() {
  const fields = state.fields.map((field) => ({ ...field }));
  document.querySelectorAll(".canva-field-source").forEach((input) => {
    const field = fields.find((entry) => entry.key === input.dataset.fieldKey);
    if (field) field.sourceText = input.value;
  });
  document.querySelectorAll(".canva-field-translate").forEach((input) => {
    const field = fields.find((entry) => entry.key === input.dataset.fieldKey);
    if (field) field.translate = input.checked;
  });
  return fields;
}

async function loadStatus() {
  state.status = await callLocalizer("status");
  if (!state.selectedMarkets.size) {
    // Every configured market is selected by default. The operator's normal case is all of them,
    // and unticking two is less work than ticking sixteen.
    for (const market of state.status.markets || []) state.selectedMarkets.add(market.marketCode);
  }
  renderAll();
}

async function selectDesign(designId) {
  const payload = await callLocalizer("design", { query: { designId } });
  state.design = payload.design;
  state.pages = payload.pages || [];
  state.fields = payload.fields || [];
  state.tagged = payload.tagged;
  state.job = null;
  state.summary = null;
  const titleInput = byId("canva-base-title");
  if (titleInput) titleInput.value = payload.design.title || "";
  renderAll();
  setFeedback(payload.tagged
    ? `${state.fields.length} data field(s) found in "${payload.design.title}".`
    : "This design has no tagged data fields yet.", payload.tagged ? "" : "is-warning");
}

async function saveJob() {
  const fields = readFieldsFromDom();
  state.fields = fields;
  const payload = await callLocalizer("save_job", {
    method: "POST",
    body: {
      jobId: state.job?.id || "",
      designId: state.design.id,
      designTitle: state.design.title,
      baseTitle: byId("canva-base-title")?.value || state.design.title,
      sourceLanguage: byId("canva-source-language")?.value || "Danish",
      fields,
      marketCodes: [...state.selectedMarkets]
    }
  });
  state.job = payload.job;
  state.summary = payload.summary;
  state.fields = payload.job.fields;
  renderAll();
  return payload.job;
}

// Batch actions call the same endpoint until it reports nothing left. The server stops at its
// own soft deadline and says how many targets it did not reach, so "continue" and "start" are
// the same request and a killed invocation costs one extra round trip, not a lost batch.
async function runBatch(action, body, label) {
  let continuations = 0;
  for (;;) {
    const payload = await callLocalizer(action, { method: "POST", body });
    state.job = payload.job;
    state.summary = payload.summary;
    renderAll();
    setFeedback(`${label}: ${payload.processed || 0} done, ${payload.remaining || 0} left.`);
    if (!payload.remaining || continuations >= MAX_BATCH_CONTINUATIONS) break;
    continuations += 1;
  }
  return state.job;
}

async function translateAll({ marketCodes = [], retranslate = false } = {}) {
  const job = state.job?.id ? state.job : await saveJob();
  await runBatch("translate", {
    jobId: job.id,
    marketCodes,
    retranslate,
    operatorNote: byId("canva-operator-note")?.value || ""
  }, "Translated");
}

async function generateAll({ marketCodes = [], regenerate = false } = {}) {
  if (!state.job?.id) await saveJob();
  await runBatch("generate", { jobId: state.job.id, marketCodes, regenerate }, "Generated");
}

async function exportAll() {
  if (!state.job?.id) return;
  const format = byId("canva-export-format")?.value || "png";
  const width = Number(byId("canva-export-width")?.value) || 0;
  await runBatch("export", { jobId: state.job.id, format, width }, "Exported");
}

async function inspectFit(marketCodes = []) {
  if (!state.job?.id) return;
  await runBatch("inspect_fit", { jobId: state.job.id, marketCodes }, "Inspected");
}

async function readSourceText() {
  const textKeys = state.fields.filter((field) => field.type === "text").map((field) => field.key);
  const payload = await callLocalizer("read_source_text", {
    method: "POST",
    body: { designId: state.design.id, fieldKeys: textKeys }
  });

  state.fields = readFieldsFromDom().map((field) => {
    const proposed = payload.sourceTexts?.[field.key];
    // Only empty fields are filled. Overwriting text the operator typed with an OCR guess would
    // be the wrong way round - the human is the authority here, the model is the shortcut.
    return proposed && !field.sourceText ? { ...field, sourceText: proposed } : field;
  });
  renderFields();
  setFeedback(`${Object.keys(payload.sourceTexts || {}).length} field(s) filled in from a rendered export. ${payload.disclaimer}`,
    "is-warning");
}

/* ------------------------------------------------------------------------- wiring */

function handleClick(event) {
  const trigger = event.target.closest("[data-canva-action]");
  if (!trigger) return;
  const action = trigger.dataset.canvaAction;
  const market = trigger.dataset.market || "";

  if (action === "connect") {
    window.location.href = "/api/canva/oauth";
    return;
  }
  if (action === "select-design") {
    runAction("Loading design", () => selectDesign(trigger.dataset.designId));
    return;
  }

  const handlers = {
    disconnect: () => runAction("Disconnecting", async () => {
      await callLocalizer("disconnect", { method: "POST", body: {} });
      await loadStatus();
      setFeedback("Canva disconnected.");
    }),
    "refresh-capabilities": () => runAction("Checking plan", async () => {
      await callLocalizer("refresh_capabilities", { method: "POST", body: {} });
      await loadStatus();
      setFeedback("Plan capabilities re-read from Canva.");
    }),
    search: () => runAction("Searching Canva", async () => {
      state.designQuery = byId("canva-design-search")?.value || "";
      const payload = await callLocalizer("designs", { query: { query: state.designQuery } });
      state.designs = payload.designs;
      state.continuation = payload.continuation;
      renderDesignResults();
      setFeedback(`${payload.designs.length} design(s) found.`);
    }),
    "open-id": () => runAction("Loading design", () => {
      const raw = byId("canva-design-id")?.value || "";
      // A pasted Canva link is the fastest way in, and its id is the last /DA… segment.
      const match = raw.match(/([A-Za-z0-9_-]{8,})\/?$/) || raw.match(/design\/([A-Za-z0-9_-]+)/);
      return selectDesign(match ? match[1] : raw.trim());
    }),
    "reload-design": () => runAction("Reloading design", () => selectDesign(state.design.id)),
    "read-text": () => runAction("Reading the design", readSourceText),
    "save-plan": () => runAction("Saving", async () => {
      await saveJob();
      setFeedback("Field plan saved. Exclusions remembered for next time.");
    }),
    "select-all-markets": () => {
      for (const entry of state.status?.markets || []) state.selectedMarkets.add(entry.marketCode);
      renderMarkets();
    },
    "clear-markets": () => {
      state.selectedMarkets.clear();
      renderMarkets();
    },
    translate: () => runAction("Translating", () => translateAll()),
    generate: () => runAction("Generating in Canva", () => generateAll()),
    "generate-one": () => runAction(`Generating ${market}`, () => generateAll({ marketCodes: [market] })),
    "retranslate-one": () => runAction(`Retranslating ${market}`, () => translateAll({ marketCodes: [market], retranslate: true })),
    "run-all": () => runAction("Localising", async () => {
      await saveJob();
      await translateAll();
      if (state.status?.connection?.canAutofill) await generateAll();
    }),
    export: () => runAction("Exporting", exportAll),
    inspect: () => runAction("Inspecting rendered designs", () => inspectFit()),
    "inspect-one": () => runAction(`Inspecting ${market}`, () => inspectFit([market]))
  };

  handlers[action]?.();
}

function handleChange(event) {
  const toggle = event.target.closest(".canva-market-toggle");
  if (!toggle) return;
  const code = toggle.dataset.market;
  if (toggle.checked) state.selectedMarkets.add(code);
  else state.selectedMarkets.delete(code);
  toggle.closest(".canva-market-chip")?.classList.toggle("is-selected", toggle.checked);
}

export function initCanvaLocalizer() {
  const panel = byId("klaviyo-canva-localizer-panel");
  if (!panel || panel.dataset.canvaWired === "true") return;
  panel.dataset.canvaWired = "true";
  panel.addEventListener("click", handleClick);
  panel.addEventListener("change", handleChange);
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.target.id === "canva-design-search") {
      event.preventDefault();
      panel.querySelector('[data-canva-action="search"]')?.click();
    }
    if (event.target.id === "canva-design-id") {
      event.preventDefault();
      panel.querySelector('[data-canva-action="open-id"]')?.click();
    }
  });

  // The OAuth callback bounces back to "/?canva=connected". Reading it here means the operator
  // lands on a page that already says what happened instead of an unexplained reload.
  const params = new URLSearchParams(window.location.search);
  if (params.get("canva")) {
    const outcome = params.get("canva");
    setFeedback(outcome === "connected"
      ? "Canva connected."
      : `Canva could not be connected: ${params.get("reason") || "unknown reason"}.`,
    outcome === "connected" ? "" : "is-danger");
    params.delete("canva");
    params.delete("reason");
    const search = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }
}

export function loadCanvaLocalizer({ force = false } = {}) {
  initCanvaLocalizer();
  if (state.loaded && !force) {
    renderAll();
    return Promise.resolve();
  }
  state.loaded = true;
  return runAction("Loading", async () => {
    await loadStatus();
    if (state.status?.connection?.connected && !state.designs.length) {
      const payload = await callLocalizer("designs", {});
      state.designs = payload.designs;
      state.continuation = payload.continuation;
      renderDesignResults();
    }
  });
}

export const __canvaLocalizerInternals = { state, fitBadge, readFieldsFromDom };
