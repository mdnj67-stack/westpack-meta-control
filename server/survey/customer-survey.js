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
// `details` are the one-tap answers to question 2 for that reason; `single` means only one of them can be picked.
const REASONS = [
  { id: "stock", label: "Still have packaging in stock", single: true, details: [
    { id: "within_3m", label: "Need more within 3 months" }, { id: "3_6m", label: "In 3-6 months" },
    { id: "later", label: "Later than that" }, { id: "unknown", label: "Don't know yet" }] },
  { id: "other_channel", label: "Still order from Westpack, another way", details: [
    { id: "phone", label: "By phone" }, { id: "email", label: "By email" },
    { id: "colleague", label: "On a colleague's account" }, { id: "dealer", label: "Through a reseller" }] },
  { id: "competitor", label: "Moved to another supplier", details: [
    { id: "price", label: "Lower price" }, { id: "speed", label: "Faster delivery" }, { id: "moq", label: "Lower minimum order" },
    { id: "quality", label: "Better quality" }, { id: "range", label: "A range we needed" }, { id: "local", label: "A local supplier" }] },
  { id: "price", label: "Price", details: [
    { id: "products", label: "The products" }, { id: "logo", label: "The logo print" },
    { id: "freight", label: "The freight" }, { id: "moq", label: "The minimum order" }] },
  { id: "delivery", label: "Delivery or delivery time", details: [
    { id: "slow", label: "Delivery time too long" }, { id: "late", label: "Arrived too late" },
    { id: "wrong", label: "Something wrong in the order" }, { id: "freight", label: "Expensive freight" }] },
  { id: "quality", label: "Quality or logo print", details: [
    { id: "product", label: "The product" }, { id: "print", label: "The logo print" },
    { id: "damaged", label: "Damaged on arrival" }, { id: "photo", label: "Looked different from the photo" }] },
  { id: "business_changed", label: "Our business has changed", details: [
    { id: "closed", label: "Closed" }, { id: "sold", label: "Sold" },
    { id: "concept", label: "New concept or range" }, { id: "smaller", label: "Smaller business" }] },
  { id: "other", label: "Other", details: [] },
];
const REASON_IDS = new Set(REASONS.map((r) => r.id));
const REASON_BY_ID = new Map(REASONS.map((r) => [r.id, r]));

const TOKEN = /^[a-z0-9]{6,16}$/;
const SID = /^[a-z0-9]{8,24}$/;
const STORE = /^[a-z]{3}_[a-z]{2}_[a-z]{3}$/;
const LANG = /^[a-z]{2}(-[A-Za-z]{2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// The first answer is saved on the first tap, so this only has to catch a script, not a fast reader.
const MIN_FILL_MS = 1200;

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
  // the one-tap answers to question 2: only the ones that exist for this reason, each once
  const def = REASON_BY_ID.get(reason);
  const allowed = new Set(def.details.map((d) => d.id));
  let details = [...new Set((Array.isArray(input.details) ? input.details : []).map(String).filter((d) => allowed.has(d)))];
  if (def.single) details = details.slice(0, 1);
  const sid = String(input.sid || "").toLowerCase();
  const step = Number(input.step);
  const record = {
    survey: SURVEY_ID,
    at: new Date(now).toISOString(),
    token,
    // one page visit; an answer saved after each question is the same answer, so it counts once
    sid: SID.test(sid) ? sid : null,
    test,
    store: STORE.test(String(input.store || "")) ? String(input.store) : "",
    lang: LANG.test(String(input.lang || "")) ? String(input.lang) : "",
    reason,
    details,
    other: reason === "other" ? text(input.other, 200) : "",
    followup: text(input.followup, 1500),
    contact,
    // how far the person got: 1 = only the reason, 2 = past the follow-up, 3 = finished
    step: [1, 2, 3].includes(step) ? step : 3,
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

function detailLabel(reason, id) {
  return REASON_BY_ID.get(reason)?.details.find((d) => d.id === id)?.label || id;
}

/**
 * One row per answer. The post saves after every question, so a visit is one answer however many saves it made
 * (keyed on the visit), and a customer with a personal link counts once across visits and devices (keyed on the
 * token) - always on the latest save. Test answers are left out unless asked for.
 */
function summarize({ responses = [], recipients = [], includeTest = false } = {}) {
  const byToken = new Map(recipients.map((r) => [r.token, r]));
  const sorted = responses.filter((r) => r && (includeTest || !r.test)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const latest = [];
  const seen = new Set();
  for (const r of sorted) {
    const key = r.token ? `t:${r.token}` : r.sid ? `s:${r.sid}` : "";
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const details = Array.isArray(r.details) ? r.details : [];
    latest.push(Object.assign({}, r, {
      details,
      detailLabels: details.map((d) => detailLabel(r.reason, d)),
      recipient: r.token ? byToken.get(r.token) || null : null,
    }));
  }
  const counts = Object.fromEntries(REASONS.map((r) => [r.id, 0]));
  const detailCounts = {};
  for (const r of latest) {
    counts[r.reason] = (counts[r.reason] || 0) + 1;
    for (const d of r.details) detailCounts[`${r.reason}:${d}`] = (detailCounts[`${r.reason}:${d}`] || 0) + 1;
  }
  const answeredTokens = new Set(latest.filter((r) => r.recipient).map((r) => r.token));
  return {
    survey: SURVEY_ID,
    reasons: REASONS.map((r) => ({
      id: r.id,
      label: r.label,
      count: counts[r.id] || 0,
      details: r.details.map((d) => ({ id: d.id, label: d.label, count: detailCounts[`${r.id}:${d.id}`] || 0 })),
    })),
    answers: latest,
    totals: {
      recipients: recipients.length,
      answers: latest.length,
      fromRecipients: answeredTokens.size,
      anonymous: latest.filter((r) => !r.token).length,
      unknownToken: latest.filter((r) => r.token && !r.recipient).length,
      wantsContact: latest.filter((r) => r.contact === "yes").length,
      finished: latest.filter((r) => (r.step || 3) >= 3).length,
    },
    answered: [...answeredTokens],
  };
}

module.exports = { SURVEY_ID, REASONS, MIN_FILL_MS, sanitizeSubmission, sanitizeRecipients, summarize };
