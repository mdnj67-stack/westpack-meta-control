// Signup Lab control. `?action=` dispatch:
//
//   GET  config       - public: what the script on the stores runs (on/off, experience, markets). Cached at the
//                       edge for 30 s, so a change reaches the stores within a minute. No history, no form ids.
//   GET  status       - the control document, the experiences, the markets and how the script behaves (logged in)
//   POST change       - { change, dryRun, expect } one change from the page; dryRun says what it would do to The
//                       Insert popups without doing it; expect is the updatedAt the page saw, and a change made on
//                       top of someone else's newer one is refused (409) rather than silently undoing it (logged in)
//   POST store_check  - read every store's own page, live and staging, for the tag and Klaviyo's script (logged in)
//   GET  forms        - every signup form in the 18 Klaviyo accounts (logged in)
//
// The only writes outside this app are The Insert popups, published or unpublished as live is switched for a
// market (server/signup/control.js insertPlan), and only for markets whose live store carries the tag.

const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const { readSignupControl, writeSignupControl } = require("../../server/meta/historical-store");
const control = require("../../server/signup/control");
const { checkStores } = require("../../server/signup/store-check");
const { accountKeys, listForms, setPublished } = require("../../server/signup/klaviyo-forms");
const { MARKETS, STAGING_HOSTS } = require("../../signup/core/markets");

const STORE_CODES = Object.fromEntries(Object.entries(MARKETS).map(([code, m]) => [m.market, code]));

async function load() {
  return control.normalizeControl(await readSignupControl());
}

function statusPayload(c, extra = {}) {
  return {
    control: c,
    concepts: control.CONCEPTS,
    markets: Object.entries(MARKETS).map(([code, m]) => ({ market: m.market, code, lang: m.lang, companyId: m.companyId })),
    stagingHosts: STAGING_HOSTS,
    stagingAuthConfigured: Boolean(process.env.SIGNUP_STAGING_AUTH),
    pendingReach: control.pendingReach(c),
    behaviour: control.behaviour(),
    snippet: control.SNIPPET,
    snippetPlace: control.SNIPPET_PLACE,
    ...extra
  };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// The Insert popups in the markets the change could take down; reading the others is not needed to put them back.
async function insertFormsFor(markets, keys) {
  const rows = await pool(markets, 4, async (m) => {
    if (!keys[m]) return [m, { error: "no Klaviyo key configured" }];
    try { return [m, (await listForms(keys[m])).filter((f) => f.insert)]; } catch (e) { return [m, { error: e.message }]; }
  });
  const forms = {}, errors = {};
  for (const [m, v] of rows) { if (Array.isArray(v)) forms[m] = v; else errors[m] = v.error; }
  return { forms, errors };
}

// The live stores' tags decide where live runs, so a live change looks at them again when the last look is stale.
// Staging is left as it was last read: it does not decide anything here.
async function withFreshLiveCheck(c) {
  if (control.storeCheckIsFresh(c)) return c;
  const check = await checkStores({ markets: STORE_CODES });
  const previous = c.storeCheck || {};
  const storeCheck = { ...check, staging: previous.staging ?? null, stagingAt: previous.stagingAt || previous.at || null, stagingNote: previous.stagingNote || "" };
  // re-read before writing: a slow check must not write an older document back over a change made meanwhile
  const latest = await load();
  const next = control.normalizeControl({ ...latest, storeCheck });
  await writeSignupControl(next);
  return next;
}

async function handleChange(req, res, config) {
  const body = await readJsonBody(req).catch(() => ({}));
  let before = await load();
  if (!body.dryRun && body.expect !== undefined && (body.expect || null) !== (before.updatedAt || null)) {
    return sendJson(res, 409, { error: "Someone else changed the Signup Lab after this page loaded. The page now shows the current state; make the change again if it still applies.", ...statusPayload(before) });
  }

  const touchesLive = control.touchesLive(body.change);
  // where live runs is worked out only while it is on, or as it is switched on
  if (touchesLive && (before.live.on || (body.change?.type === "live" && body.change.on === true))) {
    try { before = await withFreshLiveCheck(before); } catch (e) { return sendJson(res, 502, { error: `The live stores could not be checked, so nothing was changed: ${e.message}` }); }
  }

  let next, text;
  try { ({ control: next, text } = control.applyChange(before, body.change)); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  let plan = { reach: next.live.reach, unpublish: [], republish: [] };
  const keys = accountKeys(config);
  if (touchesLive) {
    const { forms, errors } = await insertFormsFor(next.live.reach, keys);
    // a market whose popups could not be read must not go live: it would show two popups with nobody knowing
    const unread = next.live.reach.filter((m) => errors[m]);
    if (unread.length) {
      return sendJson(res, 502, { error: `Could not read The Insert popups in ${unread.join(", ")} - nothing was changed.`, readErrors: errors });
    }
    plan = control.insertPlan(next, forms);
  }
  if (body.dryRun) return sendJson(res, 200, { dryRun: true, text, plan, storeCheckAt: next.storeCheck?.at || null });

  // Popups that come back go up before the switch, popups that come down go down after it: a minute with two popups
  // loses nobody's signup; a minute with none would.
  const done = [];
  for (const f of plan.republish) done.push({ action: "republish", ...f, ...(await setPublished(keys[f.market], f.id, true).catch((e) => ({ ok: false, detail: e.message }))) });
  await writeSignupControl(next);
  for (const f of plan.unpublish) done.push({ action: "unpublish", ...f, ...(await setPublished(keys[f.market], f.id, false).catch((e) => ({ ok: false, detail: e.message }))) });
  if (done.length) {
    next = control.recordInsertResults(next, done);
    await writeSignupControl(next);
  }
  return sendJson(res, 200, statusPayload(next, { text, done }));
}

module.exports = async function handler(req, res) {
  const config = getConfig();
  const action = new URL(req.url, "http://x").searchParams.get("action") || "";

  if (action === "config") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    try {
      const out = control.publicConfig(await readSignupControl());
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=300");
      return sendJson(res, 200, out);
    } catch (e) {
      // the script falls back to signup/core/markets.js, which keeps the live stores off
      res.setHeader("Cache-Control", "no-store");
      return sendJson(res, 503, { error: "Control could not be read." });
    }
  }

  if (!requireAuth(req, res, config)) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    if (action === "status" && req.method === "GET") return sendJson(res, 200, statusPayload(await load()));
    if (action === "change" && req.method === "POST") return await handleChange(req, res, config);
    if (action === "store_check" && req.method === "POST") {
      const check = await checkStores({ markets: STORE_CODES, stagingAuth: process.env.SIGNUP_STAGING_AUTH || "" });
      const next = { ...(await load()), storeCheck: { ...check, stagingAt: check.staging ? check.at : null } };
      await writeSignupControl(next);
      return sendJson(res, 200, statusPayload(control.normalizeControl(next)));
    }
    if (action === "forms" && req.method === "GET") {
      const keys = accountKeys(config);
      const markets = Object.values(MARKETS).map((m) => m.market);
      const rows = await pool(markets, 4, async (m) => {
        if (!keys[m]) return { market: m, forms: [], error: "no Klaviyo key configured" };
        try { return { market: m, forms: await listForms(keys[m]) }; } catch (e) { return { market: m, forms: [], error: e.message }; }
      });
      return sendJson(res, 200, { at: new Date().toISOString(), markets: rows, storeCheck: (await load()).storeCheck });
    }
    return sendJson(res, 400, { error: "Unknown action." });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
};
