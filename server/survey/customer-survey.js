/**
 * Customer feedback survey ("why have we not seen you for a year") - the pure domain, no I/O.
 *
 * The survey is a blog post on the stores (templates/customer-feedback-survey/), reached through a personal link
 * `…/blog/customer-feedback-2026#k=<token>`. The token sits after "#" because the store's blog redirects every URL
 * with a query string to itself without it. A token says which customer answered; it carries nothing else, and the
 * recipient list that resolves it lives only in this app's own store.
 *
 * Every value a client sends goes through sanitizeSubmission: reasons are a closed list, texts are trimmed and
 * capped, and an e-mail address is kept only when the answer has no token (someone who found the post by
 * themselves and asked to be contacted). A personal link already says who the customer is.
 */

const SURVEY_ID = "customer-feedback-2026";

// The order is the order on the page. Labels here are for the app; the post carries its own wording per language.
const REASONS = [
  { id: "stock", label: "Still have packaging in stock" },
  { id: "other_channel", label: "Still order from Westpack, another way" },
  { id: "competitor", label: "Moved to another supplier" },
  { id: "price", label: "Price" },
  { id: "delivery", label: "Delivery or delivery time" },
  { id: "quality", label: "Quality or logo print" },
  { id: "business_changed", label: "Our business has changed" },
  { id: "other", label: "Other" },
];
const REASON_IDS = new Set(REASONS.map((r) => r.id));

const TOKEN = /^[a-z0-9]{6,16}$/;
const STORE = /^[a-z]{3}_[a-z]{2}_[a-z]{3}$/;
const LANG = /^[a-z]{2}(-[A-Za-z]{2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// A person needs a few seconds to read three questions; a form filled faster than this was filled by a script.
const MIN_FILL_MS = 2500;

function text(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, max);
}

/**
 * Returns { record } for an answer worth storing, { drop: reason } for one to swallow silently (a bot: the
 * client still gets a success, so it learns nothing), or { error } for a malformed request.
 */
function sanitizeSubmission(input = {}, { now = Date.now() } = {}) {
  if (!input || typeof input !== "object") return { error: "Expected an object." };
  if (String(input.hp || "").trim()) return { drop: "honeypot" };
  const fillMs = Number(input.ms);
  if (Number.isFinite(fillMs) && fillMs >= 0 && fillMs < MIN_FILL_MS) return { drop: "too_fast" };
  const reason = String(input.reason || "");
  if (!REASON_IDS.has(reason)) return { error: "Unknown reason." };
  const rawToken = String(input.k || "").toLowerCase().trim();
  const test = rawToken === "test";
  const token = test ? null : TOKEN.test(rawToken) ? rawToken : null;
  const contact = input.contact === "yes" ? "yes" : input.contact === "no" ? "no" : "";
  const email = text(input.email, 200);
  const record = {
    survey: SURVEY_ID,
    at: new Date(now).toISOString(),
    token,
    test,
    store: STORE.test(String(input.store || "")) ? String(input.store) : "",
    lang: LANG.test(String(input.lang || "")) ? String(input.lang) : "",
    reason,
    other: reason === "other" ? text(input.other, 200) : "",
    followup: text(input.followup, 1500),
    contact,
  };
  if (!token && contact === "yes" && EMAIL.test(email)) record.email = email;
  return { record };
}

function sanitizeRecipient(r = {}) {
  const token = String(r.token || "").toLowerCase();
  if (!TOKEN.test(token)) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    token,
    rank: num(r.rank),
    firma: text(r.firma, 160),
    kontakt: text(r.kontakt, 160),
    land: text(r.land, 80),
    marked: text(r.marked, 4),
    store: STORE.test(String(r.store || "")) ? String(r.store) : "",
    lang: LANG.test(String(r.lang || "")) ? String(r.lang) : "",
    livstid: num(r.livstid),
    ordrer: num(r.ordrer),
    sidsteOrdre: /^\d{4}-\d{2}-\d{2}$/.test(String(r.sidsteOrdre || "")) ? String(r.sidsteOrdre) : "",
    link: /^https:\/\/www\.westpack\.com\/[a-z_]+\/blog\/[a-z0-9-]+#k=[a-z0-9]+$/.test(String(r.link || "")) ? String(r.link) : "",
  };
}

function sanitizeRecipients(list) {
  if (!Array.isArray(list)) return { error: "Expected a list of recipients." };
  if (list.length > 5000) return { error: "At most 5,000 recipients." };
  const seen = new Set();
  const recipients = [];
  for (const raw of list) {
    const r = sanitizeRecipient(raw);
    if (!r || seen.has(r.token)) continue;
    seen.add(r.token);
    recipients.push(r);
  }
  return { recipients };
}

/**
 * One row per answer: a customer who answers twice is counted once, on their latest answer. Test answers are left
 * out unless asked for. Answers without a token (the post found by itself) all count.
 */
function summarize({ responses = [], recipients = [], includeTest = false } = {}) {
  const byToken = new Map(recipients.map((r) => [r.token, r]));
  const sorted = responses.filter((r) => r && (includeTest || !r.test)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const latest = [];
  const seen = new Set();
  for (const r of sorted) {
    if (r.token) {
      if (seen.has(r.token)) continue;
      seen.add(r.token);
    }
    latest.push(Object.assign({}, r, { recipient: r.token ? byToken.get(r.token) || null : null }));
  }
  const counts = Object.fromEntries(REASONS.map((r) => [r.id, 0]));
  for (const r of latest) counts[r.reason] = (counts[r.reason] || 0) + 1;
  const answeredTokens = new Set(latest.filter((r) => r.recipient).map((r) => r.token));
  return {
    survey: SURVEY_ID,
    reasons: REASONS.map((r) => ({ id: r.id, label: r.label, count: counts[r.id] || 0 })),
    answers: latest,
    totals: {
      recipients: recipients.length,
      answers: latest.length,
      fromRecipients: answeredTokens.size,
      anonymous: latest.filter((r) => !r.token).length,
      unknownToken: latest.filter((r) => r.token && !r.recipient).length,
      wantsContact: latest.filter((r) => r.contact === "yes").length,
    },
    answered: [...answeredTokens],
  };
}

module.exports = { SURVEY_ID, REASONS, MIN_FILL_MS, sanitizeSubmission, sanitizeRecipients, summarize };
