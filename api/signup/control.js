// Signup Lab control. `?action=` dispatch:
//
//   GET  config       - public: what the script on the stores runs (on/off, experience, markets). Cached at the
//                       edge for 30 s, so a change reaches the stores within a minute. No history, no form ids.
//   GET  status       - the control document, the experiences and the markets (logged in)
//   POST change       - { change, dryRun } one change from the page; dryRun says what it would do to The Insert
//                       popups without doing it (logged in)
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

async function handleChange(req, res, config) {
  const body = await readJsonBody(req).catch(() => ({}));
  const before = await load();
  let next, text;
  try { ({ control: next, text } = control.applyChange(before, body.change)); } catch (e) { return sendJson(res, 400, { error: e.message }); }

  const touchesLive = ["live", "market"].includes(body.change?.type);
  let plan = { reach: [], unpublish: [], republish: [] }, readErrors = {};
  if (touchesLive) {
    const keys = accountKeys(config);
    const reachAfter = control.insertPlan(next, {}).reach;
    const { forms, errors } = await insertFormsFor(reachAfter, keys);
    readErrors = errors;
    // a market whose popups could not be read must not go live: it would show two popups with nobody knowing
    if (Object.keys(errors).length && reachAfter.some((m) => errors[m])) {
      return sendJson(res, 502, { error: `Could not read The Insert popups in ${Object.keys(errors).join(", ")} - nothing was changed.`, readErrors });
    }
    plan = control.insertPlan(next, forms);
  }
  if (body.dryRun) return sendJson(res, 200, { dryRun: true, text, plan });

  // The switch first, then the popups: a minute with two popups loses nobody's signup; a minute with none would.
  await writeSignupControl(next);
  const done = [];
  if (plan.unpublish.length || plan.republish.length) {
    const keys = accountKeys(config);
    for (const f of plan.republish) done.push({ action: "republish", ...f, ...(await setPublished(keys[f.market], f.id, true).catch((e) => ({ ok: false, detail: e.message }))) });
    for (const f of plan.unpublish) done.push({ action: "unpublish", ...f, ...(await setPublished(keys[f.market], f.id, false).catch((e) => ({ ok: false, detail: e.message }))) });
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
      const codes = Object.fromEntries(Object.entries(MARKETS).map(([code, m]) => [m.market, code]));
      const check = await checkStores({ markets: codes, stagingAuth: process.env.SIGNUP_STAGING_AUTH || "" });
      const next = { ...(await load()), storeCheck: check };
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
