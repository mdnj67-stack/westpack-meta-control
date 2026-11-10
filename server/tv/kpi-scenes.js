// The office TV's scenes: a few headline figures, each ready to render, in Danish.
//
// Pure: everything it needs comes in through `inputs` and `now`, so every rule below can be tested
// without Blob, Meta or Klaviyo. The rules are the dashboard's own, because a TV in the office that
// disagrees with the app is worse than no TV:
//
// - A figure that cannot be read is left out, never shown as 0. Each scene names its window and its
//   source, and a source that is stale, partial or failing drops its scenes and says why in
//   `sources` / `skipped`.
// - New customers comes first: it is the figure the marketing department is measured on.
// - A comparison is made only where the app makes it (same elapsed days, a non-zero baseline).
//
// `buildTvScenes(inputs, now)` -> { generatedAt, scenes, skipped, sources }.

const { buildMarketEntries } = require("../klaviyo/subject-line-history");

const COPENHAGEN = "Europe/Copenhagen";
const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);
const MONTHS_DA = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"
];

const HOUR_MS = 3600 * 1000;
// The same 36 hours the Expansion tab uses before it calls a nightly snapshot stale. The dashboard
// snapshot is rebuilt by a daily cron, so a document older than this has missed a day.
const META_MAX_AGE_MS = 36 * HOUR_MS;
const EXPANSION_MAX_AGE_MS = 36 * HOUR_MS;
const EMAIL_MAX_AGE_MS = 36 * HOUR_MS;
// The subscriber level is fetched live every three hours; a complete total stays usable for a day if
// a later fetch fails, labelled with when it was measured.
const SUBSCRIBER_MAX_AGE_MS = 24 * HOUR_MS;

// First-time reach is built but not shown. The Expansion tab itself calls it "a diagnostic, not a
// goal: the targeting is broad, so almost none of these people were ever possible customers", and the
// standing rule is that the reach figure is never reported on its own as a win - which is exactly what
// a figure rising out of the TV's smoke would do. Add the id here to show it.
const DEFAULT_SCENE_IDS = [
  "meta_new_customers_mtd",
  "meta_cost_per_new_customer",
  "newsletter_subscribers",
  "newsletter_delivered_mtd",
  "newsletter_clicks_mtd"
];
const SCENE_ORDER = [
  "meta_new_customers_mtd",
  "meta_cost_per_new_customer",
  "expansion_first_time_reach",
  "newsletter_subscribers",
  "newsletter_delivered_mtd",
  "newsletter_clicks_mtd"
];

// ---- Formatting ------------------------------------------------------------------------------

const countFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function isNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

// A count of things, da-DK: 1.234. The dashboard's formatCount and formatMoney use the same locale
// and no decimals, so a TV figure reads exactly as the app prints it.
function formatCount(value) {
  return countFormat.format(Number(value));
}

function formatMoney(value, currency = "DKK") {
  const code = String(currency || "DKK").toUpperCase();
  return `${formatCount(value)}${NBSP}${code === "DKK" ? "kr." : code}`;
}

function moneySuffix(currency = "DKK") {
  const code = String(currency || "DKK").toUpperCase();
  return code === "DKK" ? "kr." : code;
}

function formatPercent(value) {
  return `${formatCount(value)}${NBSP}%`;
}

function formatSigned(value) {
  const number = Math.round(Number(value));
  if (number > 0) return `+${formatCount(number)}`;
  if (number < 0) return `${MINUS}${formatCount(Math.abs(number))}`;
  return "0";
}

function formatMarkets(count) {
  return `${formatCount(count)} ${Number(count) === 1 ? "marked" : "markeder"}`;
}

function isoParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

// "1.–9. november", "9. november", or "28. oktober – 3. november" across a month end.
function formatDayRange(since, until) {
  const from = isoParts(since);
  const to = isoParts(until);
  if (!from || !to) return "";
  const toMonth = MONTHS_DA[to.month - 1];
  if (from.year === to.year && from.month === to.month) {
    return from.day === to.day ? `${to.day}. ${toMonth}` : `${from.day}.–${to.day}. ${toMonth}`;
  }
  return `${from.day}. ${MONTHS_DA[from.month - 1]} – ${to.day}. ${toMonth}`;
}

const dateFormats = new Map();

function zonedParts(date, timeZone) {
  const zone = timeZone || "UTC";
  if (!dateFormats.has(zone)) {
    // en-CA formats as YYYY-MM-DD.
    dateFormats.set(zone, new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }));
  }
  const [year, month, day] = dateFormats.get(zone).format(date).split("-").map(Number);
  return { year, month, day };
}

function zonedDateKey(date, timeZone) {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function zonedMonthKey(date, timeZone) {
  return zonedDateKey(date, timeZone).slice(0, 7);
}

function monthName(monthKey) {
  const month = Number(String(monthKey || "").slice(5, 7));
  return MONTHS_DA[month - 1] || "";
}

function ageMs(iso, now) {
  const at = Date.parse(iso || "");
  return Number.isFinite(at) ? now.getTime() - at : Infinity;
}

// "i dag", "i går" or "8. november", in Copenhagen.
function describeDay(iso, now) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const day = zonedDateKey(at, COPENHAGEN);
  if (day === zonedDateKey(now, COPENHAGEN)) return "i dag";
  if (day === zonedDateKey(new Date(now.getTime() - 24 * HOUR_MS), COPENHAGEN)) return "i går";
  const parts = isoParts(day);
  return `${parts.day}. ${MONTHS_DA[parts.month - 1]}`;
}

// ---- Meta: this month's new customers, from the dashboard's own trend -------------------------

// The trend is the dashboard's month-to-date comparison (server/meta/customer-acquisition.js), stored
// by the snapshot route each time it builds one. Its windows are in the ad account's timezone.
function readMetaTrend(doc, now) {
  if (!doc || !doc.trend) return { error: "No new-customer figure has been stored yet. It is written each time the Meta dashboard builds a snapshot." };
  const trend = doc.trend;
  if (trend.available !== true) return { error: "The stored new-customer figure was not available from Meta." };
  if (ageMs(doc.writtenAt, now) > META_MAX_AGE_MS) return { error: `The stored new-customer figure is from ${doc.writtenAt || "an unknown time"}, older than 36 hours.`, stale: true };
  const current = trend.current || {};
  const previous = trend.previous || {};
  if (!(Number(current.days) > 0)) return { error: "No finished day in this month yet (Meta's day runs on Los Angeles time)." };
  if (!isNumber(current.newCustomers) || !isNumber(current.spend) || !current.since || !current.until) {
    return { error: "The stored trend has no new-customer count for this month." };
  }
  // A window Meta was never asked about reads as zero in the dashboard's window index. Finished days
  // with neither spend nor a customer on an account that spends every day is that, not a result.
  if (Number(current.spend) === 0 && Number(current.newCustomers) === 0) {
    return { error: "Meta reported no spend and no new customers for this month's finished days; left out rather than shown as 0." };
  }
  if (String(current.since).slice(0, 7) !== zonedMonthKey(now, trend.timeZone || "UTC")) {
    return { error: `The stored figure covers ${formatDayRange(current.since, current.until)}, not this month.`, stale: true };
  }
  return { trend, current, previous, currency: doc.currency || "DKK", asOf: doc.writtenAt };
}

// The previous window is "the same days" only when it is as long as the current one. When it was
// clamped (31 March against a 28-day February) it is named by its own dates instead.
function previousWindowPhrase(current, previous) {
  if (Number(previous.days) === Number(current.days)) return `samme dage i ${MONTHS_DA[(isoParts(previous.since)?.month || 1) - 1]}`;
  return formatDayRange(previous.since, previous.until);
}

function isMetaComparable(meta) {
  return meta.trend.comparable === true
    && Number(meta.previous.days) > 0
    && isNumber(meta.previous.newCustomers)
    && Number(meta.previous.newCustomers) > 0;
}

function buildMetaNewCustomersScene(meta) {
  const { current, previous } = meta;
  const window = formatDayRange(current.since, current.until);
  const value = Number(current.newCustomers);
  let line = window;
  if (isMetaComparable(meta)) {
    const before = Number(previous.newCustomers);
    const percent = isNumber(meta.trend.percentChange)
      ? Number(meta.trend.percentChange)
      : ((value - before) / before) * 100;
    const rounded = Math.round(Math.abs(percent));
    const against = previousWindowPhrase(current, previous);
    if (rounded === 0) {
      line = `${window} · ${value === before ? "lige så mange som" : "på niveau med"} ${against}`;
    } else {
      line = `${window} · ${formatPercent(rounded)} ${percent > 0 ? "flere" : "færre"} end ${against}`;
    }
  }
  return {
    id: "meta_new_customers_mtd",
    eyebrow: "Nye kunder fra Meta",
    value: Math.round(value),
    valueText: formatCount(value),
    suffix: "",
    line,
    source: "Meta · inkrementel attribution",
    asOf: meta.asOf
  };
}

function buildMetaCostScene(meta) {
  const { current, previous, currency } = meta;
  const customers = Number(current.newCustomers);
  if (!(customers > 0)) return { skip: "No new customers in this month's finished days, so there is no cost per new customer." };
  const value = Number(current.spend) / customers;
  const window = formatDayRange(current.since, current.until);
  const previousCost = isMetaComparable(meta) && isNumber(previous.spend)
    ? Number(previous.spend) / Number(previous.newCustomers)
    : null;
  return {
    id: "meta_cost_per_new_customer",
    eyebrow: "Pris pr. ny kunde",
    value: Math.round(value),
    valueText: formatCount(value),
    suffix: moneySuffix(currency),
    line: previousCost === null
      ? window
      : `${window} · ${previousWindowPhrase(current, previous)}: ${formatMoney(previousCost, currency)}`,
    source: "Meta · forbrug delt med nye kunder",
    asOf: meta.asOf
  };
}

// ---- Meta: first-time reach, exactly as the Expansion tab reads it -----------------------------

function buildExpansionScene(snapshot, now) {
  if (!snapshot) return { skip: "The Expansion snapshot could not be read." };
  if (!snapshot.available) return { skip: snapshot.unavailableReason || "The Expansion snapshot has no conversion campaigns." };
  if (ageMs(snapshot.generatedAt, now) > EXPANSION_MAX_AGE_MS) return { skip: "The Expansion snapshot is older than 36 hours.", stale: true };
  const months = (Array.isArray(snapshot.months) ? snapshot.months : []).filter((month) => Number(month?.monthlyReach) > 0);
  const latest = months[months.length - 1];
  if (!latest || !latest.partial) return { skip: "The Expansion snapshot has no month in progress." };
  if (latest.month !== zonedMonthKey(now, snapshot.timezone || "America/Los_Angeles")) return { skip: "The Expansion snapshot's month in progress is not this month.", stale: true };
  if (!isNumber(latest.netNewReach)) return { skip: "First-time reach was not measured this month." };
  const likeForLike = snapshot.likeForLike && snapshot.likeForLike.comparison?.month === latest.month ? snapshot.likeForLike : null;
  const window = formatDayRange(latest.since, latest.until);
  const comparable = likeForLike && likeForLike.comparison?.comparable && isNumber(likeForLike.netNewReach);
  const against = comparable
    ? (likeForLike.clamped ? formatDayRange(likeForLike.since, likeForLike.until) : `samme dage i ${monthName(likeForLike.month)}`)
    : "";
  return {
    id: "expansion_first_time_reach",
    eyebrow: "Nået for første gang",
    value: Number(latest.netNewReach),
    valueText: formatCount(latest.netNewReach),
    suffix: "",
    line: comparable ? `${window} · ${against}: ${formatCount(likeForLike.netNewReach)}` : window,
    source: "Meta · konverteringskampagnerne",
    asOf: snapshot.generatedAt
  };
}

// ---- Klaviyo: the newsletter list --------------------------------------------------------------

// A total is only shown when every market's list was counted in the same fetch: the user's rule is
// that a market that fails must not quietly drop out of the sum.
function buildSubscriberScene(subscribers, daily, now) {
  if (!subscribers) return { skip: "No complete subscriber count has been fetched." };
  if (!subscribers.complete) return { skip: "Not every market's list could be counted." };
  if (!(Number(subscribers.marketCount) > 0) || !isNumber(subscribers.total)) return { skip: "The subscriber count is empty." };
  if (ageMs(subscribers.fetchedAt, now) > SUBSCRIBER_MAX_AGE_MS) return { skip: "The last complete subscriber count is older than 24 hours.", stale: true };

  const total = Number(subscribers.total);
  const markets = formatMarkets(subscribers.marketCount);
  let line = `på tværs af ${markets}`;
  // The change since the start of the month, from the first complete count recorded this month on an
  // earlier day than today, named by its own date.
  const today = zonedDateKey(now, COPENHAGEN);
  const monthKey = today.slice(0, 7);
  const baselineDay = Object.keys(daily?.days || {})
    .filter((day) => day.startsWith(monthKey) && day < today)
    .sort()[0];
  const baseline = baselineDay ? daily.days[baselineDay] : null;
  if (baseline && isNumber(baseline.total) && Number(baseline.marketCount) === Number(subscribers.marketCount)) {
    const delta = total - Number(baseline.total);
    const parts = isoParts(baselineDay);
    const since = `siden ${parts.day}. ${MONTHS_DA[parts.month - 1]}`;
    line = `${markets} · ${delta === 0 ? `uændret ${since}` : `${formatSigned(delta)} ${since}`}`;
  }
  return {
    id: "newsletter_subscribers",
    eyebrow: "Med på nyhedsbrevet",
    value: total,
    valueText: formatCount(total),
    suffix: "",
    line,
    source: "Klaviyo · én nyhedsbrevsliste pr. land",
    asOf: subscribers.fetchedAt
  };
}

// ---- Klaviyo: this month's campaign emails, from the subject line history ----------------------

// Per market, this Copenhagen month's sends with Received / Clicked Email as the subject line screen
// reads them (unique per message, bot clicks removed). Only this month's messages go through
// buildMarketEntries, which is where the figures are computed; the baselines it also computes are
// not used here.
function aggregateEmailMonth(history, { now = new Date(), expectedMarkets = [] } = {}) {
  const monthKey = zonedMonthKey(now, COPENHAGEN);
  const wanted = expectedMarkets.length
    ? expectedMarkets.map((code) => String(code).toUpperCase())
    : Object.keys(history?.markets || {});
  const markets = {};
  for (const code of wanted) {
    const market = history?.markets?.[code];
    if (!market) {
      markets[code] = { missing: true };
      continue;
    }
    const messages = (market.messages || []).filter((row) => {
      const at = new Date(row?.sentAt || "");
      return !Number.isNaN(at.getTime()) && zonedMonthKey(at, COPENHAGEN) === monthKey;
    });
    const entries = buildMarketEntries({ ...market, messages });
    markets[code] = {
      syncedAt: market.syncedAt || "",
      lastError: market.lastError || "",
      campaigns: new Set(entries.map((entry) => entry.campaignId)).size,
      messages: entries.length,
      received: entries.reduce((sum, entry) => sum + (Number(entry.received) || 0), 0),
      clicked: entries.reduce((sum, entry) => sum + (Number(entry.clicked) || 0), 0)
    };
  }
  return { monthKey, historySyncedAt: history?.syncedAt || "", markets };
}

function readEmailAggregate(aggregate, now) {
  if (!aggregate) return { error: "The subject line history could not be read." };
  if (aggregate.monthKey !== zonedMonthKey(now, COPENHAGEN)) return { error: "The email figures are for another month.", stale: true };
  const entries = Object.entries(aggregate.markets || {});
  if (!entries.length) return { error: "The subject line history holds no markets." };
  const missing = entries.filter(([, market]) => market.missing).map(([code]) => code);
  if (missing.length) return { error: `Not in the subject line history: ${missing.join(", ")}.` };
  const failing = entries.filter(([, market]) => market.lastError).map(([code]) => code);
  if (failing.length) return { error: `The last sync failed for ${failing.join(", ")}.` };
  const stale = entries.filter(([, market]) => ageMs(market.syncedAt, now) > EMAIL_MAX_AGE_MS).map(([code]) => code);
  if (stale.length) return { error: `Not synced in the last 36 hours: ${stale.join(", ")}.`, stale: true };
  const oldestSync = entries.map(([, market]) => market.syncedAt).sort()[0];
  const sum = (key) => entries.reduce((total, [, market]) => total + (Number(market[key]) || 0), 0);
  return {
    monthKey: aggregate.monthKey,
    marketCount: entries.length,
    campaigns: sum("campaigns"),
    messages: sum("messages"),
    received: sum("received"),
    clicked: sum("clicked"),
    asOf: oldestSync
  };
}

function buildDeliveredScene(email, now) {
  if (!(email.messages > 0) || !(email.received > 0)) return { skip: "No campaign email has been sent this month yet." };
  return {
    id: "newsletter_delivered_mtd",
    eyebrow: "Nyhedsmails leveret",
    value: email.received,
    valueText: formatCount(email.received),
    suffix: "",
    line: `kampagnemails sendt i ${monthName(email.monthKey)} · opgjort ${describeDay(email.asOf, now)}`,
    source: `Klaviyo · ${formatMarkets(email.marketCount)}`,
    asOf: email.asOf
  };
}

// Unique clickers per email, summed: a person who clicks in two emails counts twice, so the copy
// says clicks, never people.
function buildClicksScene(email) {
  if (!(email.messages > 0)) return { skip: "No campaign email has been sent this month yet." };
  if (!(email.clicked > 0)) return { skip: "No clicks recorded on this month's emails yet." };
  return {
    id: "newsletter_clicks_mtd",
    eyebrow: "Klik fra nyhedsmails",
    value: email.clicked,
    valueText: formatCount(email.clicked),
    suffix: "",
    line: `unikke klik pr. mail i ${monthName(email.monthKey)}, uden bot-klik`,
    source: `Klaviyo · ${formatMarkets(email.marketCount)}`,
    asOf: email.asOf
  };
}

// ---- Assembly ----------------------------------------------------------------------------------

function sourceStatus(error, stale, asOf, extra = {}) {
  if (error) return { status: stale ? "stale" : "unavailable", detail: error, asOf: asOf || null, ...extra };
  return { status: "ok", detail: "", asOf: asOf || null, ...extra };
}

// inputs: {
//   meta:            { doc } | { error }      - tv/meta-acquisition.json
//   expansion:       { snapshot } | { error } - the Expansion tab's snapshot (read only when shown)
//   subscribers:     { total, marketCount, complete, fetchedAt, ... } | null, plus subscribersError
//   subscriberDaily: { days: { "YYYY-MM-DD": { total, marketCount, at } } }
//   email:           { aggregate } | { error } - aggregateEmailMonth's output
//   sceneIds:        which scenes to show (default DEFAULT_SCENE_IDS)
// }
function buildTvScenes(inputs = {}, now = new Date()) {
  const shown = new Set(inputs.sceneIds || DEFAULT_SCENE_IDS);
  const built = new Map();
  const skipped = [];
  const sources = {};
  const offer = (id, result) => {
    if (!shown.has(id)) return;
    if (!result || result.skip) skipped.push({ id, reason: result?.skip || "Not available." });
    else built.set(id, result);
  };

  // Meta
  const meta = inputs.meta?.error ? { error: inputs.meta.error } : readMetaTrend(inputs.meta?.doc, now);
  sources.meta = sourceStatus(meta.error, meta.stale, meta.asOf || inputs.meta?.doc?.writtenAt);
  if (meta.error) {
    offer("meta_new_customers_mtd", { skip: meta.error });
    offer("meta_cost_per_new_customer", { skip: meta.error });
  } else {
    offer("meta_new_customers_mtd", buildMetaNewCustomersScene(meta));
    offer("meta_cost_per_new_customer", buildMetaCostScene(meta));
  }

  // Expansion
  if (shown.has("expansion_first_time_reach")) {
    const expansion = inputs.expansion?.error
      ? { skip: inputs.expansion.error }
      : buildExpansionScene(inputs.expansion?.snapshot, now);
    sources.expansion = sourceStatus(expansion.skip, expansion.stale, inputs.expansion?.snapshot?.generatedAt);
    offer("expansion_first_time_reach", expansion);
  } else {
    sources.expansion = { status: "off", detail: "First-time reach is not shown on the TV (see DEFAULT_SCENE_IDS).", asOf: null };
  }

  // Subscribers
  const subscriberScene = inputs.subscribersError && !inputs.subscribers
    ? { skip: inputs.subscribersError }
    : buildSubscriberScene(inputs.subscribers, inputs.subscriberDaily, now);
  sources.subscribers = sourceStatus(subscriberScene.skip, subscriberScene.stale, inputs.subscribers?.fetchedAt, {
    marketCount: inputs.subscribers?.marketCount ?? null,
    ...(inputs.subscribersError ? { lastAttemptError: inputs.subscribersError } : {})
  });
  offer("newsletter_subscribers", subscriberScene);

  // Email
  const email = inputs.email?.error ? { error: inputs.email.error } : readEmailAggregate(inputs.email?.aggregate, now);
  sources.email = sourceStatus(email.error, email.stale, email.asOf);
  if (email.error) {
    offer("newsletter_delivered_mtd", { skip: email.error });
    offer("newsletter_clicks_mtd", { skip: email.error });
  } else {
    offer("newsletter_delivered_mtd", buildDeliveredScene(email, now));
    offer("newsletter_clicks_mtd", buildClicksScene(email));
  }

  return {
    generatedAt: now.toISOString(),
    scenes: SCENE_ORDER.filter((id) => built.has(id)).map((id) => built.get(id)),
    skipped,
    sources
  };
}

module.exports = {
  DEFAULT_SCENE_IDS,
  SCENE_ORDER,
  aggregateEmailMonth,
  buildTvScenes,
  formatCount,
  formatDayRange,
  zonedDateKey,
  zonedMonthKey
};
