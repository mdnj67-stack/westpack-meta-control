/**
 * Westpack Signup Lab - runtime.
 *
 * One script tag on the store loads this file. It works out the market from the store path, decides whether and
 * when this visitor may see an experience (core/rules.js), assigns one of the three experiences for the A/B test,
 * lazy-loads it, and hosts it in a shadow root so the store's CSS cannot reach in and ours cannot leak out.
 * Signups go straight to Klaviyo's client subscription API with the market's public key; tracking goes to the
 * app's funnel endpoint as counts, never as a person.
 *
 *   <script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>
 *
 * Optional data attributes (the preview uses them): data-mode="preview", data-market="<store code>",
 * data-concept="<concept id>", data-test="1" (subscribe to the TEST list), data-track="<url>",
 * data-autostart="0" (only open through WestpackSignup.open()).
 */
(function () {
  "use strict";
  if (window.WestpackSignup && window.WestpackSignup.version) return;

  const script = document.currentScript || document.querySelector('script[src*="westpack-signup.js"]');
  const BASE = new URL(".", (script && script.src) || location.href).href;
  const data = (script && script.dataset) || {};
  // ?wps=preview on any store page (or ?wps=logo-studio, swipe-match, pack-and-ship) opens the experience at once in
  // test mode: signups go to the test list, tracking is marked test, and it works whether or not the experience is
  // live. It is how the store's tag is checked on the real store before launch.
  const storePreview = (() => { try { return new URLSearchParams(location.search).get("wps") || ""; } catch (e) { return ""; } })();
  const OPTS = {
    mode: data.mode === "preview" ? "preview" : "live",
    market: data.market || "",
    concept: data.concept || (storePreview !== "preview" ? storePreview : ""),
    storePreview: Boolean(storePreview),
    test: data.test === "1" || data.mode === "preview" || Boolean(storePreview),
    // data-track="" switches tracking off (local tests); no attribute means the app's endpoint
    trackUrl: data.track !== undefined ? data.track : "https://project-4fcxa.vercel.app/api/signup/track",
    autostart: data.autostart !== "0",
    // preview only: answer a signup as Klaviyo would without sending it, for screenshots and design review
    dryRun: data.mode === "preview" && data.dry === "1",
  };

  // ---------- small utilities ----------
  const now = () => Date.now();
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error(`load ${src}`));
      document.head.appendChild(s);
    }));
  }
  function loadCssInto(root, href) {
    return new Promise((resolve) => {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = href; l.onload = resolve; l.onerror = resolve;
      root.appendChild(l);
    });
  }
  const storage = (kind) => ({
    get(key) { try { return window[kind].getItem(key); } catch (e) { return null; } },
    set(key, v) { try { window[kind].setItem(key, v); } catch (e) { /* private mode or blocked: run without memory */ } },
    remove(key) { try { window[kind].removeItem(key); } catch (e) { /* ignore */ } },
  });
  const local = storage("localStorage"), sess = storage("sessionStorage");
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of [].concat(children || [])) if (c != null) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return node;
  }
  const fmt = (s, vars) => String(s || "").replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
  const svg = (markup) => { const t = document.createElement("template"); t.innerHTML = markup.trim(); return t.content.firstChild; };
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  // ---------- state ----------
  let R, M, market, COPY, concept, device, plan, reducedMotion;
  let state, root, shadow, ui = {}, mounted = null, isOpen = false, peekShown = false, exposure = null, lastFocus = null;
  const concepts = {};
  const listeners = {};
  const emit = (name, detail) => { (listeners[name] || []).forEach((fn) => { try { fn(detail); } catch (e) { /* listener error */ } }); };

  function saveState() { local.set(R.STATE_KEY, JSON.stringify(state)); }
  function session() { try { return JSON.parse(sess.get(R.SESSION_KEY) || "{}"); } catch (e) { return {}; } }
  function saveSession(s) { sess.set(R.SESSION_KEY, JSON.stringify(s)); }

  // ---------- tracking: one record per exposure, counts only ----------
  function startExposure(trigger) {
    exposure = { t0: performance.now(), trigger, steps: [], errors: [], outcome: "", closeStep: "", flushed: false };
  }
  function track(step) {
    if (!exposure) return;
    exposure.steps.push({ n: step, t: Math.round(performance.now() - exposure.t0) });
    exposure.closeStep = step;
    try { (window.dataLayer = window.dataLayer || []).push({ event: "wp_signup", wp_signup_action: step, wp_signup_concept: concept, wp_signup_market: market.market }); } catch (e) { /* no dataLayer */ }
    emit("step", { step, concept });
  }
  function flush(outcome) {
    if (!exposure || exposure.flushed) return;
    exposure.flushed = true; exposure.outcome = outcome;
    const payload = R.sanitizeTracking({
      env: OPTS.mode === "preview" ? "preview" : OPTS.test ? "test" : "live",
      market: market.market, lang: market.lang, concept, variant: concept, device, trigger: exposure.trigger,
      outcome, closeStep: exposure.closeStep, page: R.pageType(location.pathname), reduced: reducedMotion,
      ms: performance.now() - exposure.t0, steps: exposure.steps, errors: exposure.errors,
    });
    emit("flush", payload);
    if (!payload || !OPTS.trackUrl) return;
    const body = JSON.stringify(payload);
    // text/plain keeps it a simple request, so no CORS preflight and it survives the page unloading
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon(OPTS.trackUrl, new Blob([body], { type: "text/plain" })))) {
        fetch(OPTS.trackUrl, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" }, mode: "cors" }).catch(() => {});
      }
    } catch (e) { /* tracking never breaks the experience */ }
  }

  // ---------- Klaviyo ----------
  async function post(req, timeoutMs) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: ctrl && ctrl.signal, mode: "cors" });
    } finally { if (timer) clearTimeout(timer); }
  }

  /**
   * The only place a signup happens. The visitor typed an address and pressed the signup button next to the
   * consent sentence: nothing else in any experience calls this.
   */
  async function subscribe({ email, properties, organization }) {
    const target = OPTS.test ? Object.assign({ optIn: "single" }, M.TEST_TARGET) : market;
    const opts = { market, target, email, concept, variant: concept, properties, organization, pageUrl: location.href, pageType: R.pageType(location.pathname) };
    const req = R.buildSubscription(opts);
    track("submit");
    if (OPTS.dryRun) {
      await new Promise((r) => setTimeout(r, 700));
      track("subscribed");
      emit("subscribed", { concept, market: market.market, test: true, dryRun: true, request: req });
      return { ok: true, doubleOptIn: OPTS.dryRun && data.doi === "1" };
    }
    let res = null, code = "";
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      try {
        res = await post(req, 10000);
        if (res.status >= 500) { code = `server_${res.status}`; res = null; }
      } catch (e) { code = e && e.name === "AbortError" ? "timeout" : "network"; }
      if (!res && attempt === 0) await new Promise((r) => setTimeout(r, 900));
    }
    if (res && (res.status === 202 || res.ok)) {
      state.subscribedAt = now(); saveState();
      track("subscribed");
      // a timeline event for flows and reports; a failure here does not undo the signup
      post(R.buildCompletionEvent(opts), 8000).catch(() => {});
      try { (window.dataLayer = window.dataLayer || []).push({ event: "wp_signup_subscribed", wp_signup_concept: concept, wp_signup_market: market.market }); } catch (e) { /* ignore */ }
      emit("subscribed", { concept, market: market.market, test: OPTS.test });
      return { ok: true, doubleOptIn: target.optIn === "double" };
    }
    if (res && res.status === 400) code = "rejected";
    else if (res && res.status === 429) code = "rate_limited";
    else if (res) code = code || `http_${res.status}`;
    exposure && exposure.errors.push(code || "unknown");
    track("submit_error");
    return { ok: false, code: code || "unknown" };
  }

  // ---------- the shared signup form ----------
  /**
   * Every experience gets the same form, so consent, privacy link, validation, errors and double-submit handling
   * are identical everywhere. The experience decides where it sits and what the button says.
   * o: { buttonText, invalidText, placeholder, properties(), organization(), onSuccess(result), compact }
   */
  function signupForm(o) {
    const shell = COPY.shell;
    const uid = `wps-email-${Math.random().toString(36).slice(2, 8)}`;
    const input = el("input", { id: uid, class: "wps-input", type: "email", name: "email", inputmode: "email", autocomplete: "email", autocapitalize: "off", spellcheck: "false", required: true, placeholder: o.placeholder || shell.emailPlaceholder, "aria-describedby": `${uid}-err ${uid}-consent` });
    const error = el("p", { id: `${uid}-err`, class: "wps-error", role: "alert", "aria-live": "assertive" });
    const button = el("button", { class: "wps-btn wps-btn-primary", type: "submit" }, [el("span", { class: "wps-btn-label", text: o.buttonText || shell.signup })]);
    const parts = R.consentParts(market);
    const consent = el("p", { id: `${uid}-consent`, class: "wps-consent" }, [parts.before, parts.link ? el("a", { href: market.privacyUrl, target: "_blank", rel: "noopener noreferrer", text: parts.link }) : null, parts.after]);
    const form = el("form", { class: `wps-form${o.compact ? " is-compact" : ""}`, novalidate: true }, [
      el("label", { class: "wps-label", for: uid, text: shell.emailLabel }),
      el("div", { class: "wps-field" }, [input, button]),
      error,
      consent,
    ]);
    let busy = false, touched = false;
    input.addEventListener("focus", () => { if (!touched) { touched = true; track("email_focus"); } }, { once: false });
    input.addEventListener("input", () => { if (error.textContent) { error.textContent = ""; form.classList.remove("has-error"); } });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return; // double submit
      const email = R.normaliseEmail(input.value);
      if (!R.isValidEmail(email)) {
        error.textContent = o.invalidText || shell.invalidEmail; form.classList.add("has-error");
        input.setAttribute("aria-invalid", "true"); input.focus();
        track("email_invalid");
        return;
      }
      input.removeAttribute("aria-invalid");
      busy = true; form.classList.add("is-busy"); button.disabled = true; input.readOnly = true;
      button.querySelector(".wps-btn-label").textContent = shell.sending;
      const result = await subscribe({ email, properties: o.properties ? o.properties() : {}, organization: o.organization ? o.organization() : "" });
      busy = false; form.classList.remove("is-busy"); button.disabled = false; input.readOnly = false;
      button.querySelector(".wps-btn-label").textContent = o.buttonText || shell.signup;
      if (result.ok) { form.classList.add("is-done"); o.onSuccess && o.onSuccess(result); }
      else { error.textContent = shell.networkError; form.classList.add("has-error"); }
    });
    return { form, input, button, focus: () => input.focus({ preventScroll: true }) };
  }

  // ---------- shell ----------
  function buildShell() {
    root = document.createElement("div");
    root.id = "westpack-signup";
    root.setAttribute("data-wps", "");
    // the host never takes space or clicks on the store page
    root.style.cssText = "position:fixed;inset:auto;width:0;height:0;z-index:2147483000;";
    shadow = root.attachShadow({ mode: "open" });
    document.body.appendChild(root);
    ui.wrap = el("div", { class: "wps", "data-device": device, "data-reduced": reducedMotion ? "true" : "false", "data-concept": concept, lang: market.lang });
    ui.overlay = el("div", { class: "wps-overlay", onclick: () => device === "desktop" && close("overlay") });
    ui.title = el("span", { class: "wps-visually-hidden", id: "wps-dialog-title", text: COPY.shell.dialogLabel });
    ui.close = el("button", { class: "wps-close", type: "button", "aria-label": COPY.shell.close, onclick: () => close("button") }, [svg(ICON_CLOSE)]);
    ui.grab = el("div", { class: "wps-grab", "aria-hidden": "true" });
    ui.stage = el("div", { class: "wps-stage" });
    ui.dialog = el("div", { class: "wps-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "wps-dialog-title", tabindex: "-1" }, [ui.title, ui.grab, ui.close, ui.stage]);
    ui.wrap.append(ui.overlay, ui.dialog);
    shadow.appendChild(ui.wrap);
    ui.dialog.addEventListener("keydown", onDialogKey);
    enableSheetDrag();
  }

  function focusables() {
    return [...ui.dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null || n === document.activeElement);
  }
  function onDialogKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close("escape"); return; }
    if (e.key !== "Tab") return;
    const f = focusables(); if (!f.length) return;
    const active = shadow.activeElement;
    if (e.shiftKey && (active === f[0] || !active)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && active === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }

  // swipe the sheet down to close it on a phone, from the grab bar or the top edge
  function enableSheetDrag() {
    let y0 = null, dy = 0;
    const start = (e) => { if (device === "desktop") return; const t = e.touches ? e.touches[0] : e; const r = ui.dialog.getBoundingClientRect(); if (t.clientY - r.top > 44) return; y0 = t.clientY; dy = 0; ui.dialog.classList.add("is-dragging"); };
    const move = (e) => { if (y0 == null) return; const t = e.touches ? e.touches[0] : e; dy = Math.max(0, t.clientY - y0); ui.dialog.style.transform = `translateY(${dy}px)`; };
    const end = () => { if (y0 == null) return; ui.dialog.classList.remove("is-dragging"); ui.dialog.style.transform = ""; if (dy > 90) close("swipe"); y0 = null; };
    ui.dialog.addEventListener("touchstart", start, { passive: true });
    ui.dialog.addEventListener("touchmove", move, { passive: true });
    ui.dialog.addEventListener("touchend", end);
  }

  let scrollLock = null;
  function lockScroll() {
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    scrollLock = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    html.style.overflow = "hidden";
    if (gap > 0) html.style.paddingRight = `${gap}px`;
  }
  function unlockScroll() {
    if (!scrollLock) return;
    const html = document.documentElement;
    html.style.overflow = scrollLock.overflow; html.style.paddingRight = scrollLock.paddingRight; scrollLock = null;
  }

  async function ensureAssets() {
    const head = document.head;
    if (!document.querySelector('link[data-wps-fonts]')) head.appendChild(el("link", { rel: "stylesheet", href: `${BASE}assets/fonts/fonts.css`, "data-wps-fonts": true }));
    await Promise.all([
      loadScript(`${BASE}concepts/${concept}.js`),
      loadCssInto(shadow, `${BASE}westpack-signup.css`),
      loadCssInto(shadow, `${BASE}concepts/${concept}.css`),
    ]);
  }

  function context() {
    return {
      concept, market, lang: market.lang, device, reducedMotion, isTest: OPTS.test, isPreview: OPTS.mode === "preview",
      copy: COPY[concept], shell: COPY.shell, t: fmt, el, svg,
      asset: (p) => `${BASE}assets/${p}`,
      track, signupForm, close, root: shadow, stage: ui.stage, dialog: ui.dialog,
      storeUrl: market.storeUrl,
    };
  }

  // ---------- peek: the small card phones and tablets get instead of an interruption ----------
  async function showPeek() {
    if (peekShown || isOpen) return;
    if (!R.peekAllowed(state, now())) return;
    peekShown = true;
    if (!shadow) buildShell();
    await ensureAssets();
    const c = COPY[concept];
    const visual = concepts[concept] && concepts[concept].peekVisual ? concepts[concept].peekVisual(context()) : null;
    ui.peek = el("div", { class: "wps-peek", role: "region", "aria-label": COPY.shell.dialogLabel }, [
      el("button", { class: "wps-peek-main", type: "button", onclick: () => { hidePeek(); open("peek"); } }, [
        visual ? el("span", { class: "wps-peek-visual", "aria-hidden": "true" }, [visual]) : null,
        el("span", { class: "wps-peek-text" }, [el("span", { class: "wps-peek-line", text: c.peek }), el("span", { class: "wps-peek-cta", text: `${c.peekCta} →` })]),
      ]),
      el("button", { class: "wps-peek-x", type: "button", "aria-label": COPY.shell.peekDismiss, onclick: () => { state.peekDismissedAt = now(); saveState(); hidePeek(); track("peek_dismissed"); flush("peek_dismissed"); } }, [svg(ICON_CLOSE)]),
    ]);
    ui.wrap.appendChild(ui.peek);
    startExposure("peek");
    track("peek_shown");
    requestAnimationFrame(() => requestAnimationFrame(() => ui.peek && ui.peek.classList.add("is-in")));
  }
  function hidePeek() {
    if (!ui.peek) return;
    const p = ui.peek; ui.peek = null; p.classList.remove("is-in");
    setTimeout(() => p.remove(), reducedMotion ? 0 : 320);
  }

  // ---------- open / close ----------
  async function open(trigger) {
    if (isOpen) return;
    isOpen = true;
    if (!shadow) buildShell();
    if (!exposure || exposure.flushed) startExposure(trigger || "manual");
    const s = session(); s.shown = true; saveSession(s);
    state.views = (state.views || 0) + 1; state.lastViewAt = now(); saveState();
    await ensureAssets();
    lastFocus = document.activeElement;
    ui.stage.textContent = "";
    ui.wrap.setAttribute("data-concept", concept);
    mounted = concepts[concept].mount(ui.stage, context()) || {};
    lockScroll();
    ui.wrap.classList.add("is-open");
    track("open");
    emit("open", { concept });
    // focus the dialog itself, not the first field: a keyboard on a phone popping up uninvited is the opposite of
    // a gentle entrance. The experience may move focus once its own entrance is done.
    setTimeout(() => { try { (mounted.initialFocus || ui.dialog).focus({ preventScroll: true }); } catch (e) { ui.dialog.focus(); } }, reducedMotion ? 0 : 380);
  }

  function close(reason) {
    if (!isOpen) return;
    isOpen = false;
    const subscribed = Boolean(state.subscribedAt);
    if (!subscribed && reason !== "link") { state.closes = (state.closes || 0) + 1; state.lastCloseAt = now(); saveState(); }
    track(`close_${reason || "button"}`);
    flush(subscribed ? "subscribed" : reason === "link" ? "link" : "closed");
    ui.wrap.classList.remove("is-open");
    unlockScroll();
    setTimeout(() => { if (mounted && mounted.destroy) mounted.destroy(); mounted = null; ui.stage.textContent = ""; }, reducedMotion ? 0 : 420);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) { /* element gone */ }
    emit("close", { reason, subscribed });
  }

  // ---------- consent banner and Klaviyo identification ----------
  function consentBannerOpen() {
    const b = document.getElementById("coiOverlay");
    if (!b) return false;
    const cs = getComputedStyle(b);
    return cs.display !== "none" && cs.visibility !== "hidden" && b.getAttribute("aria-hidden") !== "true";
  }
  function klaviyoIdentified() {
    return new Promise((resolve) => {
      const k = window.klaviyo;
      if (!k || typeof k.isIdentified !== "function") return resolve(false);
      const t = setTimeout(() => resolve(false), 1500);
      try { Promise.resolve(k.isIdentified()).then((v) => { clearTimeout(t); resolve(Boolean(v)); }, () => { clearTimeout(t); resolve(false); }); }
      catch (e) { clearTimeout(t); resolve(false); }
    });
  }

  // ---------- triggers ----------
  function arm() {
    const s = session();
    s.pv = (s.pv || 0) + 1; saveSession(s);
    plan = R.triggerPlan(device, s.pv);
    if (plan.mode === "dialog") {
      const t0 = now();
      const timer = setTimeout(() => go("delay"), plan.delayMs);
      const onLeave = (e) => { if (e.clientY <= 0 && !e.relatedTarget && now() - t0 > 4000) go("exit"); };
      function go(trigger) { clearTimeout(timer); document.removeEventListener("mouseout", onLeave); if (!isOpen && !session().shown) open(trigger); }
      if (plan.exitIntent) document.addEventListener("mouseout", onLeave);
    } else {
      let fired = false;
      const fire = () => { if (fired) return; fired = true; window.removeEventListener("scroll", onScroll); clearTimeout(timer); showPeek(); };
      const onScroll = () => { const h = document.documentElement; if ((h.scrollTop + innerHeight) / Math.max(1, h.scrollHeight) > plan.scrollRatio + 0.4 || h.scrollTop / Math.max(1, h.scrollHeight - innerHeight) > plan.scrollRatio) fire(); };
      const timer = setTimeout(fire, plan.delayMs);
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  // ---------- boot ----------
  async function boot() {
    await Promise.all([loadScript(`${BASE}core/rules.js`), loadScript(`${BASE}core/markets.js`)]);
    R = window.WestpackSignupRules; M = window.WestpackSignupMarkets;
    market = OPTS.market ? M.MARKETS[OPTS.market] : R.resolveMarket(location.pathname, M.MARKETS);
    // M.LIVE is the master switch (core/markets.js): off, the store's tag does nothing but answer ?wps=preview
    if (!market || (!(M.LIVE && market.enabled) && OPTS.mode !== "preview" && !OPTS.storePreview)) return;
    state = R.parseState(local.get(R.STATE_KEY));
    reducedMotion = Boolean(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    device = R.deviceClass(innerWidth, Boolean(window.matchMedia && matchMedia("(pointer: coarse)").matches));
    if (R.isEmailVisit(location.search)) { state.emailVisitAt = now(); saveState(); }
    const pick = R.assignConcept(state, market.concepts, Math.random(), OPTS.concept);
    concept = pick.concept;
    if (!concept) return;
    if (pick.assigned) { state.concept = concept; state.assignedAt = now(); saveState(); }
    await loadScript(`${BASE}core/copy/${market.lang}.js`);
    COPY = window.WestpackSignupCopy[market.lang];
    emit("ready", { market: market.market, concept });
    if (OPTS.mode === "preview") return;
    if (OPTS.storePreview) {
      // straight to the experience, once the cookie banner has been answered
      while (consentBannerOpen()) await new Promise((r) => setTimeout(r, 500));
      open("preview");
      return;
    }
    if (!OPTS.autostart) return;

    const identified = await klaviyoIdentified();
    const check = () => R.eligibility(state, {
      now: now(), excludedPath: R.isExcludedPath(location.pathname), emailVisit: R.isEmailVisit(location.search),
      identified, shownThisSession: Boolean(session().shown), consentBannerOpen: consentBannerOpen(),
    });
    let verdict = check();
    // the cookie banner sits at the top of the page's stack; wait for the visitor's choice, then start counting
    while (!verdict.ok && verdict.retry) { await new Promise((r) => setTimeout(r, 1000)); verdict = check(); }
    emit("eligibility", verdict);
    if (verdict.ok) arm();
  }

  window.addEventListener("pagehide", () => { if (exposure && !exposure.flushed) flush(isOpen ? "abandoned" : peekShown ? "abandoned" : "not_opened"); });

  window.WestpackSignup = {
    version: "1.0.0",
    registerConcept(id, def) { concepts[id] = def; },
    open(id, trigger) { if (id && R.CONCEPT_IDS.includes(id)) concept = id; return open(trigger || "manual"); },
    peek(id) { if (id && R.CONCEPT_IDS.includes(id)) concept = id; return showPeek(); },
    close, on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    reset() { local.remove("wps:v1"); sess.remove("wps:session:v1"); },
    get state() { return state; }, get market() { return market; }, get concept() { return concept; },
    ready: null,
  };
  window.WestpackSignup.ready = (document.body ? Promise.resolve() : new Promise((r) => addEventListener("DOMContentLoaded", r))).then(boot).catch((e) => { if (OPTS.mode === "preview") console.error("WestpackSignup", e); });
})();
