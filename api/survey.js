/**
 * Customer feedback survey (server/survey/customer-survey.js).
 *
 * Public, called from the blog post on the stores:
 *   POST ?action=submit            one answer (text/plain JSON, so the browser sends no preflight)
 *   GET  ?action=who&k=<token>     the company a personal link belongs to, so the post can greet it by name
 *
 * Logged in (the app):
 *   GET  ?action=results[&test=1]  recipients, answers (latest per customer) and the count per reason
 *   POST ?action=recipients        replaces the recipient list: { recipients: [...] }
 *
 * Nothing here writes to Klaviyo, Magento or Navision. An answer is stored in this app's own Blob store only.
 */
const { getConfig } = require("../server/lib/config");
const { requireAuth } = require("../server/lib/auth");
const { sendJson } = require("../server/lib/http");
const survey = require("../server/survey/customer-survey");
const store = require("../server/survey/survey-store");

const STORE_ORIGIN = /^https:\/\/www\.westpack\.com$|^https:\/\/westpack-staging\.wexohosting\.com$/;
const APP_ORIGIN = /^https:\/\/project-4fcxa\.vercel\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_BYTES = 8192;
const MAX_RECIPIENT_BYTES = 2 * 1024 * 1024;

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (STORE_ORIGIN.test(origin) || APP_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
}

function readText(req, limit) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
  if (req.body && typeof req.body === "object") return Promise.resolve(JSON.stringify(req.body));
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > limit) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJson(req, limit) {
  const text = await readText(req, limit);
  if (text.length > limit) throw new Error("too large");
  return JSON.parse(text || "{}");
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const q = new URL(req.url, "http://x").searchParams;
  const action = q.get("action") || "";
  res.setHeader("Cache-Control", "no-store");

  if (action === "submit") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "POST only." });
    let input;
    try { input = await readJson(req, MAX_BYTES); } catch { return sendJson(res, 400, { error: "Expected a small JSON body." }); }
    const out = survey.sanitizeSubmission(input);
    if (out.error) return sendJson(res, 400, { error: out.error });
    if (out.drop) return sendJson(res, 200, { ok: true });
    out.record.origin = STORE_ORIGIN.test(req.headers.origin || "") ? "store" : APP_ORIGIN.test(req.headers.origin || "") ? "app" : "other";
    try { await store.writeResponse(survey.SURVEY_ID, out.record); } catch { return sendJson(res, 503, { error: "The answer could not be saved. Try again in a moment." }); }
    return sendJson(res, 200, { ok: true });
  }

  if (action === "who") {
    if (req.method !== "GET") return sendJson(res, 405, { error: "GET only." });
    const k = String(q.get("k") || "").toLowerCase();
    if (!/^[a-z0-9]{6,16}$/.test(k)) return sendJson(res, 200, { known: false });
    try {
      const doc = await store.readRecipients(survey.SURVEY_ID);
      const hit = doc.recipients.find((r) => r.token === k);
      return sendJson(res, 200, hit ? { known: true, firma: hit.firma } : { known: false });
    } catch { return sendJson(res, 200, { known: false }); }
  }

  const config = getConfig();
  if (!requireAuth(req, res, config)) return;

  if (action === "results") {
    if (req.method !== "GET") return sendJson(res, 405, { error: "GET only." });
    try {
      const [doc, responses] = await Promise.all([store.readRecipients(survey.SURVEY_ID), store.readResponses(survey.SURVEY_ID)]);
      const summary = survey.summarize({ responses, recipients: doc.recipients, includeTest: q.get("test") === "1" });
      return sendJson(res, 200, Object.assign(summary, { recipients: doc.recipients, recipientsUpdatedAt: doc.updatedAt, store: { mode: store.storeMode() } }));
    } catch (e) { return sendJson(res, 502, { error: e.message }); }
  }

  if (action === "recipients") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "POST only." });
    let input;
    try { input = await readJson(req, MAX_RECIPIENT_BYTES); } catch { return sendJson(res, 400, { error: "Expected JSON under 2 MB." }); }
    const out = survey.sanitizeRecipients(input.recipients);
    if (out.error) return sendJson(res, 400, { error: out.error });
    try {
      const doc = await store.writeRecipients(survey.SURVEY_ID, out.recipients);
      return sendJson(res, 200, { ok: true, count: doc.recipients.length, updatedAt: doc.updatedAt, store: { mode: store.storeMode() } });
    } catch (e) { return sendJson(res, 502, { error: e.message }); }
  }

  return sendJson(res, 400, { error: "Unknown action." });
};
