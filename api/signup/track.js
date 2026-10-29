/**
 * Signup Lab funnel endpoint.
 *
 * POST (public, called by navigator.sendBeacon from the store): one exposure record, sanitised by the same rules
 * the browser uses (signup/core/rules.js), so an email address can never be stored here whatever a client sends.
 * Records only count as "live" when they come from a Westpack store; the app's own preview stores "preview".
 *
 * GET ?action=report[&env=live|preview|test][&from=YYYY-MM-DD][&to=YYYY-MM-DD] (logged in): the funnel per
 * experience - exposures, opens, interactions, email focus, submits, signups, closes, steps, devices, markets.
 */
const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { sendJson } = require("../../server/lib/http");
const rules = require("../../signup/core/rules");
const { writeExposure, report } = require("../../server/signup/funnel-store");

const STORE_ORIGIN = /^https:\/\/www\.westpack\.com$/;
const APP_ORIGIN = /^https:\/\/project-4fcxa\.vercel\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_BYTES = 8192;

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (STORE_ORIGIN.test(origin) || APP_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
}

function readText(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
  if (req.body && typeof req.body === "object") return Promise.resolve(JSON.stringify(req.body));
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > MAX_BYTES) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  if (req.method === "POST") {
    let parsed;
    try {
      const text = await readText(req);
      if (text.length > MAX_BYTES) throw new Error("too large");
      parsed = JSON.parse(text);
    } catch (e) { res.statusCode = 400; return res.end(); }
    const record = rules.sanitizeTracking(parsed || {});
    if (!record) { res.statusCode = 204; return res.end(); }
    const origin = req.headers.origin || "";
    // a record claims "live" only from the store itself; anything else is preview or test traffic
    if (record.env === "live" && !STORE_ORIGIN.test(origin)) record.env = APP_ORIGIN.test(origin) ? "preview" : "test";
    try { await writeExposure(record); } catch (e) { res.statusCode = 503; return res.end(); }
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    const config = getConfig();
    if (!requireAuth(req, res, config)) return;
    const q = new URL(req.url, "http://x").searchParams;
    // what actually stuck in Klaviyo: submitted, confirmed on the list, and taken by Klaviyo's bot protection
    if (q.get("action") === "confirmed") {
      const { MARKETS } = require("../../signup/core/markets");
      const { reconcile } = require("../../server/signup/klaviyo-reconcile");
      let accounts = config.klaviyoMarketsJson; if (typeof accounts === "string") accounts = JSON.parse(accounts);
      const keys = Object.fromEntries((accounts || []).filter((a) => a && a.privateKey).map((a) => [a.country, a.privateKey]));
      const since = /^\d{4}-\d{2}-\d{2}$/.test(q.get("from") || "") ? `${q.get("from")}T00:00:00Z` : new Date(Date.now() - 14 * 86400000).toISOString().replace(/\.\d+Z$/, "Z");
      const only = (q.get("markets") || "").split(",").filter(Boolean);
      const markets = Object.values(MARKETS).filter((m) => !only.length || only.includes(m.market));
      try { return sendJson(res, 200, await reconcile(markets, keys, since)); } catch (e) { return sendJson(res, 502, { error: e.message }); }
    }
    if (q.get("action") !== "report") return sendJson(res, 400, { error: "Unknown action." });
    const env = ["live", "preview", "test"].includes(q.get("env")) ? q.get("env") : "live";
    const date = /^\d{4}-\d{2}-\d{2}$/;
    try {
      const out = await report({ env, from: date.test(q.get("from") || "") ? q.get("from") : undefined, to: date.test(q.get("to") || "") ? q.get("to") : undefined });
      res.setHeader("Cache-Control", "no-store");
      return sendJson(res, 200, out);
    } catch (e) { return sendJson(res, 502, { error: e.message }); }
  }

  res.statusCode = 405;
  return res.end();
};
