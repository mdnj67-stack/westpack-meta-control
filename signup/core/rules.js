/**
 * Westpack Signup Lab - the rules, with no DOM and no network, so they can be tested in Node and run unchanged
 * in the browser (module.exports there, globalThis.WestpackSignupRules here).
 *
 * Who sees an experience, when, which one, what is sent to Klaviyo and what is sent to analytics are all
 * decided here. The runtime only carries the decisions out.
 */
(function (root) {
  const VERSION = "1.0.0";
  const SOURCE = "Westpack Signup Lab";
  const CONCEPT_IDS = ["logo-studio", "swipe-match", "pack-and-ship"];
  const STATE_KEY = "wps:v1";
  const SESSION_KEY = "wps:session:v1";
  const KLAVIYO_REVISION = "2026-10-15";
  const DAY = 86400000;

  // Never on the way to paying, in the account, on the newsletter page itself, or on outlet and sale pages
  // (those belong to the "Always on sale" flyout). Outlet pages are named outlet-*.html in every store, and every
  // sale page sits under sale/ or is sale.html, whatever language the rest of the path is in.
  const EXCLUDED_PATHS = [/\/checkout/i, /\/onestepcheckout/i, /\/cart(\/|\.html|$)/i, /\/customer\/account/i,
    /\/wishlist/i, /\/newsletter-signup/i, /\/sale\.html/i, /\/sale\//i, /\/outlet-/i, /\/search/i];

  // One close means not now; a second means not this month; a third means leave them alone.
  const SUPPRESSION = { closedDays: [14, 45, 120], peekDismissedDays: 7, emailVisitorDays: 180 };

  function resolveMarket(pathname, markets) {
    const code = String(pathname || "").split("/").filter(Boolean)[0] || "";
    return Object.prototype.hasOwnProperty.call(markets, code) ? markets[code] : null;
  }

  function isExcludedPath(pathname) {
    const p = String(pathname || "");
    return EXCLUDED_PATHS.some((re) => re.test(p));
  }

  function pageType(pathname) {
    const p = String(pathname || "").replace(/\/+$/, "");
    if (isExcludedPath(p)) return "excluded";
    const parts = p.split("/").filter(Boolean);
    if (parts.length <= 1) return "home";
    if (/\.html$/i.test(p) && parts.length >= 3) return "product_or_category";
    return "content";
  }

  // Someone who arrived from one of our emails is on the list already; Klaviyo marks those links with _kx, and
  // our UTM convention marks them with utm_medium=email.
  function isEmailVisit(search) {
    const q = new URLSearchParams(String(search || ""));
    return q.has("_kx") || /^email$/i.test(q.get("utm_medium") || "") || /klaviyo/i.test(q.get("utm_source") || "");
  }

  function deviceClass(width, coarsePointer) {
    if (width < 640) return "mobile";
    if (width < 1024 && coarsePointer) return "tablet";
    return "desktop";
  }

  function freshState() { return { v: 1, closes: 0 }; }

  function parseState(raw) {
    try {
      const s = JSON.parse(raw || "null");
      if (!s || s.v !== 1 || typeof s !== "object") return freshState();
      s.closes = Number.isFinite(s.closes) ? s.closes : 0;
      return s;
    } catch (e) { return freshState(); }
  }

  function cooldownDays(closes) {
    if (!closes || closes < 1) return 0;
    return SUPPRESSION.closedDays[Math.min(closes, SUPPRESSION.closedDays.length) - 1];
  }

  /**
   * May an experience open for this visitor now? Returns { ok, reason }.
   * ctx: { now, excludedPath, emailVisit, identified, shownThisSession, consentBannerOpen }
   */
  function eligibility(state, ctx) {
    const now = ctx.now;
    if (state.subscribedAt) return { ok: false, reason: "subscribed" };
    if (ctx.emailVisit) return { ok: false, reason: "email_visitor" };
    if (state.emailVisitAt && now - state.emailVisitAt < SUPPRESSION.emailVisitorDays * DAY) return { ok: false, reason: "email_visitor" };
    if (ctx.identified) return { ok: false, reason: "identified" };
    if (ctx.excludedPath) return { ok: false, reason: "excluded_page" };
    if (ctx.shownThisSession) return { ok: false, reason: "shown_this_session" };
    const cd = cooldownDays(state.closes);
    if (cd && state.lastCloseAt && now - state.lastCloseAt < cd * DAY) return { ok: false, reason: "cooling_down" };
    if (ctx.consentBannerOpen) return { ok: false, reason: "consent_banner_open", retry: true };
    return { ok: true, reason: "eligible" };
  }

  function peekAllowed(state, now) {
    return !(state.peekDismissedAt && now - state.peekDismissedAt < SUPPRESSION.peekDismissedDays * DAY);
  }

  /**
   * How the experience is offered. Desktop gets the dialog after a pause or on exit intent. Phones and tablets
   * never get a full-screen interruption on their own: a small card slides in, and the experience opens only
   * when it is tapped.
   */
  function triggerPlan(device, pageviews) {
    if (device === "desktop") return { mode: "dialog", delayMs: pageviews > 1 ? 6000 : 11000, exitIntent: true };
    return { mode: "peek", delayMs: pageviews > 1 ? 4000 : 7000, scrollRatio: 0.3 };
  }

  function enabledConcepts(weights) {
    return Object.entries(weights || {}).filter(([id, w]) => CONCEPT_IDS.includes(id) && w > 0);
  }

  function pickConcept(weights, rnd) {
    const list = enabledConcepts(weights);
    if (!list.length) return null;
    const total = list.reduce((s, [, w]) => s + w, 0);
    let x = rnd * total;
    for (const [id, w] of list) { if ((x -= w) < 0) return id; }
    return list[list.length - 1][0];
  }

  // A visitor keeps the experience they were first assigned, so the test compares people, not page views.
  function assignConcept(state, weights, rnd, forced) {
    if (forced && CONCEPT_IDS.includes(forced)) return { concept: forced, assigned: false };
    const enabled = enabledConcepts(weights).map(([id]) => id);
    if (state.concept && enabled.includes(state.concept)) return { concept: state.concept, assigned: false };
    return { concept: pickConcept(weights, rnd), assigned: true };
  }

  function normaliseEmail(email) { return String(email || "").trim(); }

  function isValidEmail(email) {
    const e = normaliseEmail(email);
    if (e.length < 6 || e.length > 254) return false;
    if (!/^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[A-Za-z]{2,}$/.test(e)) return false;
    const [local, domain] = e.split("@");
    return local.length <= 64 && !/\.\./.test(e) && !domain.startsWith(".") && !domain.startsWith("-");
  }

  // What may ride along to Klaviyo with a signup. Anything else a concept tries to send is dropped.
  const PROPERTY_WHITELIST = ["wp_signup_concept", "wp_signup_variant", "wp_signup_market", "wp_signup_lang",
    "wp_signup_version", "wp_signup_page_type", "wp_consent_text", "wp_consent_page", "wp_brand_name",
    "wp_logo_finish", "wp_logo_lid", "wp_logo_type", "wp_logo_uploaded", "wp_style_profile", "wp_style_scores", "wp_liked_boxes",
    "wp_signup_list"];

  function cleanProperties(props) {
    const out = {};
    for (const key of PROPERTY_WHITELIST) {
      if (!(key in (props || {}))) continue;
      const v = props[key];
      if (typeof v === "string") out[key] = v.slice(0, 500);
      else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
      else if (Array.isArray(v)) out[key] = v.filter((x) => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 80));
      else if (v && typeof v === "object") out[key] = JSON.parse(JSON.stringify(v));
    }
    return out;
  }

  function stripUrl(href) {
    try { const u = new URL(href); return `${u.origin}${u.pathname}`; } catch (e) { return ""; }
  }

  /**
   * The signup itself: Klaviyo's client subscription endpoint, with the market's public key and list, the
   * consent recorded as SUBSCRIBED with a custom source naming the experience, and the consent sentence the
   * visitor saw stored on the profile so the consent can be documented later.
   */
  function buildSubscription(o) {
    const target = o.target || o.market;
    const email = normaliseEmail(o.email);
    const source = `${SOURCE} · ${o.concept}${o.variant && o.variant !== o.concept ? ` · ${o.variant}` : ""}`;
    const properties = cleanProperties(Object.assign({
      wp_signup_concept: o.concept,
      wp_signup_variant: o.variant || o.concept,
      wp_signup_market: o.market.market,
      wp_signup_lang: o.market.lang,
      wp_signup_version: VERSION,
      wp_signup_page_type: o.pageType || "",
      wp_consent_text: o.market.consent,
      wp_consent_page: stripUrl(o.pageUrl || ""),
    }, o.properties || {}));
    const attributes = { email, locale: o.market.locale, properties, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } };
    const org = String(o.organization || "").trim();
    if (org) attributes.organization = org.slice(0, 80);
    return {
      url: `https://a.klaviyo.com/client/subscriptions?company_id=${encodeURIComponent(target.companyId)}`,
      headers: { "content-type": "application/vnd.api+json", accept: "application/vnd.api+json", revision: KLAVIYO_REVISION },
      body: {
        data: {
          type: "subscription",
          attributes: { custom_source: source, profile: { data: { type: "profile", attributes } } },
          relationships: { list: { data: { type: "list", id: target.listId } } },
        },
      },
    };
  }

  // A timeline event on the profile, so flows and reports can tell which experience brought someone in. It names the
  // list the signup went to, because test signups land in the DK account too: the app's Signups page tells a live
  // signup from a test one by it (server/signup/klaviyo-reconcile.js).
  function buildCompletionEvent(o) {
    const target = o.target || o.market;
    return {
      url: `https://a.klaviyo.com/client/events?company_id=${encodeURIComponent(target.companyId)}`,
      headers: { "content-type": "application/vnd.api+json", accept: "application/vnd.api+json", revision: KLAVIYO_REVISION },
      body: {
        data: {
          type: "event",
          attributes: {
            properties: cleanProperties(Object.assign({}, o.properties || {}, { wp_signup_concept: o.concept, wp_signup_variant: o.variant || o.concept, wp_signup_market: o.market.market, wp_signup_list: target.listId })),
            metric: { data: { type: "metric", attributes: { name: "Signup Lab Subscribed" } } },
            profile: { data: { type: "profile", attributes: { email: normaliseEmail(o.email) } } },
          },
        },
      },
    };
  }

  // ---- tracking: counts only, never a person ----
  const ENUMS = {
    env: ["live", "preview", "test"],
    device: ["mobile", "tablet", "desktop"],
    trigger: ["delay", "exit", "peek", "manual", "preview"],
    outcome: ["subscribed", "closed", "abandoned", "error", "link", "peek_dismissed", "not_opened"],
  };
  const TOKEN = /^[a-z0-9][a-z0-9_.-]{0,47}$/i;

  /**
   * Shapes one exposure for the funnel endpoint. Anything not on this list is dropped, and any string that
   * contains "@" is dropped too: an email address must never reach the analytics store, whichever field it
   * was typed into.
   */
  function sanitizeTracking(p) {
    const s = (v) => (typeof v === "string" && !v.includes("@") ? v : "");
    const t = (v) => (TOKEN.test(s(v)) ? s(v) : "");
    const e = (k, v) => (ENUMS[k].includes(v) ? v : "");
    const out = {
      v: 1,
      env: e("env", p.env) || "live",
      market: /^[A-Z]{2}$/.test(s(p.market)) ? p.market : "",
      lang: /^[a-z]{2}(-[A-Z]{2})?$/.test(s(p.lang)) ? p.lang : "",
      concept: CONCEPT_IDS.includes(p.concept) ? p.concept : "",
      variant: t(p.variant),
      device: e("device", p.device),
      trigger: e("trigger", p.trigger),
      outcome: e("outcome", p.outcome),
      closeStep: t(p.closeStep),
      page: t(p.page),
      reduced: p.reduced === true,
      ms: Number.isFinite(p.ms) ? Math.max(0, Math.min(3600000, Math.round(p.ms))) : 0,
      steps: Array.isArray(p.steps) ? p.steps.slice(0, 40).map((x) => ({ n: t(x && x.n), t: Number.isFinite(x && x.t) ? Math.max(0, Math.round(x.t)) : 0 })).filter((x) => x.n) : [],
      errors: Array.isArray(p.errors) ? p.errors.slice(0, 10).map(t).filter(Boolean) : [],
    };
    if (!out.market || !out.concept) return null;
    return out;
  }

  // The consent sentence split around the words that link to the privacy page.
  function consentParts(market) {
    const text = market.consent || "", link = market.privacyLink || "";
    const i = link ? text.lastIndexOf(link) : -1;
    if (i < 0) return { before: text, link: "", after: "" };
    return { before: text.slice(0, i), link, after: text.slice(i + link.length) };
  }

  const api = {
    VERSION, SOURCE, CONCEPT_IDS, STATE_KEY, SESSION_KEY, KLAVIYO_REVISION, SUPPRESSION, PROPERTY_WHITELIST,
    resolveMarket, isExcludedPath, pageType, isEmailVisit, deviceClass, freshState, parseState, cooldownDays,
    eligibility, peekAllowed, triggerPlan, pickConcept, assignConcept, isValidEmail, normaliseEmail,
    cleanProperties, buildSubscription, buildCompletionEvent, sanitizeTracking, consentParts, stripUrl,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WestpackSignupRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
