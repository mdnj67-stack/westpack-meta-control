/**
 * A look at the stores' own pages from the server: does each store carry the Signup Lab tag, on live and on staging,
 * and which Klaviyo accounts does it load. Read-only; one page per store, a few at a time.
 *
 * Klaviyo's script reaches a store two ways: inline in the page (the Magento extension, per store) or through
 * Tag Manager (GTM-5QRXWTJ, the same on every store). Both are reported, because since 26 Oct 2026 the inline one is
 * gone everywhere but DK and the Tag Manager one loads the EU account on every store - which is why most accounts'
 * own popups show nowhere.
 */
const STAGING_ORIGIN = "https://westpack-staging.wexohosting.com";
const LIVE_ORIGIN = "https://www.westpack.com";
const GTM_ID = "GTM-5QRXWTJ";
// The store's Magento answers 500 to a bare "Accept: text/html"; a browser's headers get the page (see the watchdog).
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9"
};

// The tag as the store carries it. data-test sends every signup to the test list, so it does not count as installed.
function readTag(html) {
  const tags = String(html || "").match(/<script\b[^>]*\/signup\/westpack-signup\.js[^>]*>/gi) || [];
  if (!tags.length) return "no";
  return tags.some((t) => !/\bdata-test\b/i.test(t)) ? "yes" : "test-only";
}

function readKlaviyoIds(text) {
  const ids = new Set();
  for (const m of String(text || "").matchAll(/company_id(?:=|\\x3d|\\u003d|%3D)([A-Za-z0-9]{6})\b/gi)) ids.add(m[1]);
  return [...ids];
}

async function fetchText(fetchImpl, url, headers, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers, redirect: "manual", signal: ctl.signal });
    const text = res.status === 200 ? await res.text() : "";
    return { status: res.status, location: res.headers?.get ? res.headers.get("location") || "" : "", text };
  } finally {
    clearTimeout(timer);
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function checkPage(fetchImpl, url, headers, timeoutMs) {
  try {
    const r = await fetchText(fetchImpl, url, headers, timeoutMs);
    if (r.status >= 300 && r.status < 400 && /\/_auth\//.test(r.location)) return { status: r.status, tag: "unknown", klaviyo: [], error: "the staging login was refused" };
    if (r.status !== 200) return { status: r.status, tag: "unknown", klaviyo: [], error: `the page answered ${r.status}` };
    return { status: 200, tag: readTag(r.text), klaviyo: readKlaviyoIds(r.text) };
  } catch (e) {
    return { status: 0, tag: "unknown", klaviyo: [], error: e.name === "AbortError" ? "the page took too long" : e.message };
  }
}

/**
 * markets: { DK: "dkk_dk_den", ... }. stagingAuth: "user:password" for staging's basic auth, or "" to skip staging.
 */
async function checkStores({ markets, stagingAuth = "", fetchImpl = fetch, timeoutMs = 25000, now = new Date().toISOString() }) {
  const entries = Object.entries(markets);
  const live = await pool(entries, 4, ([, code]) => checkPage(fetchImpl, `${LIVE_ORIGIN}/${code}/`, HEADERS, timeoutMs));
  let staging = null;
  if (stagingAuth) {
    const auth = { ...HEADERS, Authorization: `Basic ${Buffer.from(stagingAuth).toString("base64")}` };
    staging = await pool(entries, 4, ([, code]) => checkPage(fetchImpl, `${STAGING_ORIGIN}/${code}/`, auth, timeoutMs));
  }
  let gtm = { id: GTM_ID, klaviyo: [], error: "" };
  try {
    const r = await fetchText(fetchImpl, `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, HEADERS, timeoutMs);
    gtm = r.status === 200 ? { id: GTM_ID, klaviyo: readKlaviyoIds(r.text), error: "" } : { id: GTM_ID, klaviyo: [], error: `answered ${r.status}` };
  } catch (e) { gtm.error = e.message; }
  return {
    at: now,
    live: Object.fromEntries(entries.map(([m], i) => [m, live[i]])),
    staging: staging ? Object.fromEntries(entries.map(([m], i) => [m, staging[i]])) : null,
    stagingNote: stagingAuth ? "" : "Staging is behind a login and SIGNUP_STAGING_AUTH is not set, so it was not checked.",
    gtm
  };
}

module.exports = { checkStores, readTag, readKlaviyoIds, STAGING_ORIGIN, LIVE_ORIGIN, GTM_ID };
