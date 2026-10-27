// Layer 1 of the subject line generator: every subject line and preheader Westpack has sent, with
// what happened to it.
//
// Klaviyo holds all of it - about 6,900 sent campaigns across the 18 accounts since September 2021,
// ~515 of them A/B tests - but nothing in this app had ever read a subject line back. Verified
// against the live accounts on 2026-10-27, and the shape of the data decides the design:
//
// - Subject, preheader and sender label live on the campaign *message*, and come back in one call
//   with `include=campaign-messages` (100 campaigns a page).
// - The reporting API (`campaign-values-reports`) returns one row per campaign even for an A/B test,
//   allows at most one year per request and two requests a minute. It cannot tell variants apart.
// - Event aggregates can. Grouped by `$message` and `$variation`, Received/Opened/Clicked Email give
//   one figure per A/B arm (`$variation` is the arm's message id; `$message` is the campaign id).
//   A third dimension, `Bot Click`, takes the link scanners out of clicks - 26% of all clicks on
//   this list in 2026. Three calls a year per account, on a limit of sixty a minute.
//
// What the figures can and cannot say:
//
// - Open rates here are inflated by Apple Mail Privacy Protection and Gmail's image proxy, which
//   "open" mail nobody read. Klaviyo exposes no machine-open flag to filter on. Inside an A/B test
//   that inflation lands on both arms alike, so the *difference* is real; across campaigns it is
//   noise that varies with list composition. Each send is therefore scored against its own
//   market's typical open rate in the weeks around it (`openIndex`, 1.00 = typical), never as a
//   raw percentage.
// - `unique` is counted per calendar month, so a send whose opens straddle a month end counts a
//   few people twice. It moves a rate by a fraction of a point and is accepted.
// - In Klaviyo's A/B tests the winning arm is also sent to the rest of the list afterwards, so its
//   figures include a later send. The comparison is close to fair, not exact, and the screen says so.

const { fetchWithTimeout } = require("../lib/http");
const { countEmoji } = require("./subject-line-rules");

const HISTORY_VERSION = 1;
const KLAVIYO_TIMEOUT_MS = 20000;
const ENGAGEMENT_METRICS = ["Received Email", "Opened Email", "Clicked Email"];
// Below this many recipients a rate swings too much to rank a subject line by it.
const MIN_RECIPIENTS_FOR_INDEX = 100;
const BASELINE_WINDOW_DAYS = 45;
const BASELINE_WIDE_WINDOW_DAYS = 120;
const BASELINE_MIN_POINTS = 4;

// ISO language per Klaviyo account, for labelling. EU, UK and US all send English.
const LANGUAGE_BY_MARKET = {
  CZ: "cs", DE: "de", DK: "da", ES: "es", EU: "en", FI: "fi", FR: "fr", HU: "hu", IT: "it",
  NL: "nl", NO: "nb", PL: "pl", PT: "pt", RO: "ro", SE: "sv", SK: "sk", UK: "en", US: "en"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(privateKey, revision, json = false) {
  return {
    Authorization: `Klaviyo-API-Key ${privateKey}`,
    Accept: "application/json",
    revision,
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

// Klaviyo answers a throttled request with "Expected available in N seconds". Waiting that long
// (capped) and trying again is cheaper than failing a whole market's sync over one busy second.
async function klaviyoFetch(url, { headers, method = "GET", body } = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchWithTimeout(url, { method, headers, body: body ? JSON.stringify(body) : undefined }, KLAVIYO_TIMEOUT_MS);
    const payload = await response.json().catch(() => ({}));
    if (response.ok && !payload?.errors?.length) return payload;
    const detail = String(payload?.errors?.[0]?.detail || `Klaviyo request failed (${response.status}).`);
    if (response.status === 429 && attempt < 3) {
      const seconds = Number((detail.match(/(\d+)\s*second/) || [])[1] || 2);
      await sleep(Math.min(20, Math.max(1, seconds)) * 1000 + 250);
      continue;
    }
    throw new Error(detail);
  }
  throw new Error("Klaviyo request failed after retries.");
}

// Listing every sent campaign is what a sync spends its time on: ~7,000 campaigns a page of 100 at a
// time, with their messages. On 2026-10-27 a sync that only needed the current year's figures still
// took 181 seconds in production for that reason. So a nightly sync lists only what changed since
// the last one (a campaign is updated when it is sent), and the whole list is re-read once a week.
async function fetchSentCampaigns(headers, { updatedSince = "" } = {}) {
  const since = updatedSince ? `,greater-than(updated_at,${encodeURIComponent(updatedSince.slice(0, 19))})` : "";
  let next = `https://a.klaviyo.com/api/campaigns/?filter=and(equals(messages.channel,'email'),equals(status,'Sent')${since})`
    + "&sort=-created_at&include=campaign-messages"
    + "&fields[campaign]=name,send_time,send_strategy"
    + "&fields[campaign-message]=label,content,send_times";
  const campaigns = [];
  const messages = [];
  while (next) {
    const payload = await klaviyoFetch(next, { headers });
    campaigns.push(...(Array.isArray(payload?.data) ? payload.data : []));
    messages.push(...(Array.isArray(payload?.included) ? payload.included : []));
    next = payload?.links?.next || "";
  }
  return { campaigns, messages };
}

async function findEngagementMetricIds(headers) {
  const payload = await klaviyoFetch("https://a.klaviyo.com/api/metrics/", { headers });
  const ids = {};
  for (const metric of Array.isArray(payload?.data) ? payload.data : []) {
    const name = metric?.attributes?.name;
    const integration = String(metric?.attributes?.integration?.key || "").toLowerCase();
    if (ENGAGEMENT_METRICS.includes(name) && integration === "klaviyo") ids[name] = metric.id;
  }
  const missing = ENGAGEMENT_METRICS.filter((name) => !ids[name]);
  if (missing.length) throw new Error(`Klaviyo metric not found: ${missing.join(", ")}.`);
  return ids;
}

function sumSeries(series) {
  return (Array.isArray(series) ? series : []).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function engagementKey(campaignId, variation) {
  return `${campaignId}|${variation || ""}`;
}

// One year of Received/Opened/Clicked per campaign and A/B arm, as
// { "<campaignId>|<variation>": [received, opened, clicked] }. Clicks flagged as bots are left out.
async function fetchYearEngagement(headers, metricIds, year, now = new Date()) {
  const start = `${year}-01-01T00:00:00`;
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const end = (yearEnd < now ? yearEnd : now).toISOString().slice(0, 19);
  const table = {};
  const columns = { "Received Email": 0, "Opened Email": 1, "Clicked Email": 2 };

  for (const metric of ENGAGEMENT_METRICS) {
    const by = metric === "Clicked Email" ? ["$message", "$variation", "Bot Click"] : ["$message", "$variation"];
    const attributes = {
      metric_id: metricIds[metric],
      measurements: ["unique"],
      interval: "month",
      by,
      page_size: 500,
      filter: [`greater-or-equal(datetime,${start})`, `less-than(datetime,${end})`],
      timezone: "Europe/Copenhagen"
    };
    let cursor = "";
    for (let page = 0; page < 20; page += 1) {
      const payload = await klaviyoFetch("https://a.klaviyo.com/api/metric-aggregates/", {
        headers,
        method: "POST",
        body: { data: { type: "metric-aggregate", attributes: cursor ? { ...attributes, page_cursor: cursor } : attributes } }
      });
      for (const group of payload?.data?.attributes?.data || []) {
        const [campaignId, variation, bot] = Array.isArray(group?.dimensions) ? group.dimensions : [];
        if (!campaignId) continue;
        if (metric === "Clicked Email" && String(bot) === "1.0") continue;
        const key = engagementKey(campaignId, variation);
        const row = table[key] || (table[key] = [0, 0, 0]);
        row[columns[metric]] += sumSeries(group?.measurements?.unique);
      }
      const next = String(payload?.links?.next || "");
      cursor = next ? (new URL(next).searchParams.get("page[cursor]") || new URL(next).searchParams.get("page_cursor") || "") : "";
      if (!cursor) break;
    }
  }
  return table;
}

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildMessageRows(campaigns = [], messages = []) {
  const messageById = new Map(messages.map((message) => [String(message.id), message]));
  const rows = [];
  for (const campaign of campaigns) {
    const attributes = campaign?.attributes || {};
    const messageRefs = campaign?.relationships?.["campaign-messages"]?.data || [];
    const abTest = attributes.send_strategy?.method === "ab_test_campaign" || messageRefs.length > 1;
    for (const ref of messageRefs) {
      const message = messageById.get(String(ref.id));
      const content = message?.attributes?.content || {};
      const subject = normalizeWhitespace(content.subject);
      if (!subject) continue;
      rows.push({
        id: String(ref.id),
        campaignId: String(campaign.id),
        campaignName: normalizeWhitespace(attributes.name),
        label: normalizeWhitespace(message?.attributes?.label),
        subject,
        previewText: normalizeWhitespace(content.preview_text),
        fromLabel: normalizeWhitespace(content.from_label),
        sentAt: String(message?.attributes?.send_times?.[0]?.datetime || attributes.send_time || ""),
        abTest
      });
    }
  }
  return rows.filter((row) => row.sentAt);
}

function yearsBetween(firstIso, now) {
  const first = new Date(firstIso).getUTCFullYear();
  const last = now.getUTCFullYear();
  const years = [];
  for (let year = Number.isFinite(first) ? first : last; year <= last; year += 1) years.push(year);
  return years;
}

// A market is synced in full the first time and whenever the stored shape is older than this
// module. After that only the current year is re-read (and last year during January, while late
// opens on December sends are still arriving): a finished year's figures do not move.
function resolveYearsToFetch(rows, existingMarket, now) {
  const firstSend = rows.reduce((min, row) => (row.sentAt < min ? row.sentAt : min), rows[0]?.sentAt || now.toISOString());
  const all = yearsBetween(firstSend, now);
  const stored = existingMarket?.version === HISTORY_VERSION ? existingMarket.engagementByYear || {} : null;
  if (!stored) return all;
  const current = now.getUTCFullYear();
  return all.filter((year) => !stored[year] || year === current || (year === current - 1 && now.getUTCMonth() === 0));
}

const FULL_LIST_EVERY_MS = 7 * 86_400_000;
const INCREMENTAL_OVERLAP_MS = 3 * 86_400_000;

// A fresh list replaces the stored one; an incremental list is merged over it by message id.
function mergeMessageRows(stored = [], fresh = []) {
  const byId = new Map(stored.map((row) => [row.id, row]));
  for (const row of fresh) byId.set(row.id, row);
  return [...byId.values()].sort((left, right) => right.sentAt.localeCompare(left.sentAt));
}

async function syncMarketHistory({ market, existingMarket = null, revision, now = new Date() }) {
  const country = String(market.country || "").trim().toUpperCase();
  const headers = buildHeaders(String(market.privateKey || "").trim(), revision);
  const jsonHeaders = buildHeaders(String(market.privateKey || "").trim(), revision, true);
  const current = existingMarket?.version === HISTORY_VERSION ? existingMarket : null;
  const fullListDue = !current?.fullListAt || now.getTime() - Date.parse(current.fullListAt) >= FULL_LIST_EVERY_MS;
  const updatedSince = fullListDue || !current?.syncedAt
    ? ""
    : new Date(Date.parse(current.syncedAt) - INCREMENTAL_OVERLAP_MS).toISOString();
  const { campaigns, messages } = await fetchSentCampaigns(headers, { updatedSince });
  const fresh = buildMessageRows(campaigns, messages);
  const rows = updatedSince ? mergeMessageRows(current.messages || [], fresh) : fresh;
  const engagementByYear = current ? { ...(current.engagementByYear || {}) } : {};

  if (rows.length) {
    const metricIds = await findEngagementMetricIds(headers);
    for (const year of resolveYearsToFetch(rows, existingMarket, now)) {
      engagementByYear[year] = await fetchYearEngagement(jsonHeaders, metricIds, year, now);
    }
  }

  return {
    version: HISTORY_VERSION,
    country,
    language: LANGUAGE_BY_MARKET[country] || "",
    syncedAt: now.toISOString(),
    fullListAt: updatedSince ? current.fullListAt : now.toISOString(),
    messages: rows,
    engagementByYear
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
  return results;
}

// Syncs as many markets as fit before the deadline, oldest first, and reports what is left. The
// caller writes the snapshot and simply calls again, so continuing and starting are one request.
async function syncSubjectLineHistory({ markets = [], existing = null, revision, now = new Date(), deadlineAt = Infinity, concurrency = 5, countries = [] }) {
  const snapshot = {
    version: HISTORY_VERSION,
    syncedAt: existing?.syncedAt || "",
    markets: { ...(existing?.markets || {}) }
  };
  const wanted = new Set(countries.map((code) => String(code).toUpperCase()));
  const queue = markets
    .filter((market) => String(market?.country || "").trim() && String(market?.privateKey || "").trim())
    .filter((market) => !wanted.size || wanted.has(String(market.country).toUpperCase()))
    .sort((left, right) => {
      const leftAt = snapshot.markets[String(left.country).toUpperCase()]?.syncedAt || "";
      const rightAt = snapshot.markets[String(right.country).toUpperCase()]?.syncedAt || "";
      return leftAt.localeCompare(rightAt);
    });

  const synced = [];
  const failed = [];
  const skipped = [];
  await mapWithConcurrency(queue, concurrency, async (market) => {
    const country = String(market.country).toUpperCase();
    if (Date.now() >= deadlineAt) {
      skipped.push(country);
      return;
    }
    try {
      snapshot.markets[country] = await syncMarketHistory({ market, existingMarket: snapshot.markets[country], revision, now });
      synced.push(country);
    } catch (error) {
      failed.push({ country, error: error.message || String(error) });
      if (snapshot.markets[country]) snapshot.markets[country] = { ...snapshot.markets[country], lastError: error.message || String(error) };
    }
  });

  if (synced.length) snapshot.syncedAt = now.toISOString();
  return { snapshot, synced, failed, remaining: skipped };
}

// ---- Reading the history --------------------------------------------------------------------

function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rate(numerator, denominator) {
  if (!(denominator > 0)) return null;
  return Math.min(1, numerator / denominator);
}

function engagementFor(row, engagementByYear) {
  let received = 0;
  let opened = 0;
  let clicked = 0;
  for (const table of Object.values(engagementByYear || {})) {
    if (row.abTest) {
      const value = table[engagementKey(row.campaignId, row.id)];
      if (value) {
        received += value[0];
        opened += value[1];
        clicked += value[2];
      }
      continue;
    }
    // A single-message campaign is recorded with an empty variation, and occasionally under its own
    // message id; both are the same send.
    for (const key of [engagementKey(row.campaignId, ""), engagementKey(row.campaignId, row.id)]) {
      const value = table[key];
      if (!value) continue;
      received += value[0];
      opened += value[1];
      clicked += value[2];
    }
  }
  return { received, opened, clicked };
}

// Each send's open rate against its own market's typical open rate around the same time. Points
// are campaigns, not A/B arms, so a test does not count twice in its own baseline.
function applyBaselines(entries = []) {
  const campaignPoints = new Map();
  for (const entry of entries) {
    if (!(entry.received > 0)) continue;
    const point = campaignPoints.get(entry.campaignId) || { campaignId: entry.campaignId, time: Date.parse(entry.sentAt), received: 0, opened: 0, clicked: 0 };
    point.received += entry.received;
    point.opened += entry.opened;
    point.clicked += entry.clicked;
    campaignPoints.set(entry.campaignId, point);
  }
  const points = [...campaignPoints.values()]
    .filter((point) => point.received >= MIN_RECIPIENTS_FOR_INDEX && Number.isFinite(point.time))
    .map((point) => ({ ...point, openRate: point.opened / point.received, clickRate: point.clicked / point.received }));

  const dayMs = 86_400_000;
  const baselineFor = (entry) => {
    const time = Date.parse(entry.sentAt);
    for (const windowDays of [BASELINE_WINDOW_DAYS, BASELINE_WIDE_WINDOW_DAYS]) {
      const near = points.filter((point) => point.campaignId !== entry.campaignId && Math.abs(point.time - time) <= windowDays * dayMs);
      if (near.length >= BASELINE_MIN_POINTS) {
        return { open: median(near.map((point) => point.openRate)), click: median(near.map((point) => point.clickRate)), points: near.length };
      }
    }
    return null;
  };

  return entries.map((entry) => {
    if (!(entry.received >= MIN_RECIPIENTS_FOR_INDEX)) return { ...entry, openIndex: null, clickIndex: null, baselineOpenRate: null };
    const baseline = baselineFor(entry);
    return {
      ...entry,
      baselineOpenRate: baseline?.open ?? null,
      openIndex: baseline?.open ? Number((entry.openRate / baseline.open).toFixed(3)) : null,
      clickIndex: baseline?.click ? Number((entry.clickRate / baseline.click).toFixed(3)) : null
    };
  });
}

function buildMarketEntries(market) {
  if (!market?.messages?.length) return [];
  const entries = market.messages.map((row) => {
    const { received, opened, clicked } = engagementFor(row, market.engagementByYear);
    return {
      ...row,
      country: market.country,
      language: market.language || LANGUAGE_BY_MARKET[market.country] || "",
      received,
      opened,
      clicked,
      openRate: rate(opened, received),
      clickRate: rate(clicked, received)
    };
  });
  return applyBaselines(entries).sort((left, right) => right.sentAt.localeCompare(left.sentAt));
}

// "W50 - Julestads - DK" and "W50 - Julestads - UK" are the same test run in two markets.
function familyKeyForCampaign(name = "", marketCodes = Object.keys(LANGUAGE_BY_MARKET)) {
  const codes = new RegExp(`(?<![\\p{L}\\d])(?:${marketCodes.join("|")})(?![\\p{L}\\d])`, "giu");
  return String(name || "")
    .replace(codes, " ")
    .toLowerCase()
    .replace(/[^\p{L}\d]+/gu, " ")
    .trim();
}

function variantLetter(label = "", index = 0) {
  const match = String(label || "").match(/variation\s+([A-Z])\b/i);
  return match ? match[1].toUpperCase() : String.fromCharCode(65 + index);
}

// Two-proportion z-test. With the ~150-500 recipients per arm these tests had, a gap has to be
// several points wide before it is distinguishable from chance, and most tests will be "uafgjort".
function twoProportionZ(successA, totalA, successB, totalB) {
  if (!(totalA > 0) || !(totalB > 0)) return 0;
  const pooled = (successA + successB) / (totalA + totalB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
  if (!(se > 0)) return 0;
  return (successA / totalA - successB / totalB) / se;
}

function verdictForZ(z) {
  const size = Math.abs(z);
  if (size >= 1.96) return "klar";
  if (size >= 1.28) return "tendens";
  return "uafgjort";
}

function comparableText(value = "") {
  return String(value || "").toLowerCase().replace(/[^\p{L}\d%]+/gu, " ").trim();
}

function buildAbTests(entries = []) {
  const byCampaign = new Map();
  for (const entry of entries) {
    if (!entry.abTest) continue;
    const list = byCampaign.get(entry.campaignId) || [];
    list.push(entry);
    byCampaign.set(entry.campaignId, list);
  }

  const tests = [];
  for (const arms of byCampaign.values()) {
    const live = arms.filter((arm) => arm.received > 0).sort((left, right) => left.id.localeCompare(right.id));
    if (live.length < 2) continue;
    const subjects = new Set(live.map((arm) => comparableText(arm.subject)));
    const previews = new Set(live.map((arm) => comparableText(arm.previewText)));
    const differs = subjects.size > 1 && previews.size > 1 ? "both" : subjects.size > 1 ? "subject" : previews.size > 1 ? "preview" : "content";
    const ranked = [...live].sort((left, right) => (right.openRate || 0) - (left.openRate || 0));
    const [best, second] = ranked;
    const z = twoProportionZ(best.opened, best.received, second.opened, second.received);
    const clickRanked = [...live].sort((left, right) => (right.clickRate || 0) - (left.clickRate || 0));
    const clickZ = twoProportionZ(clickRanked[0].clicked, clickRanked[0].received, clickRanked[1].clicked, clickRanked[1].received);
    const sizes = live.map((arm) => arm.received);
    tests.push({
      campaignId: best.campaignId,
      country: best.country,
      language: best.language,
      campaignName: best.campaignName,
      familyKey: familyKeyForCampaign(best.campaignName),
      sentAt: live.map((arm) => arm.sentAt).sort()[0],
      differs,
      arms: live.map((arm, index) => ({
        id: arm.id,
        letter: variantLetter(arm.label, index),
        subject: arm.subject,
        previewText: arm.previewText,
        received: arm.received,
        opened: arm.opened,
        clicked: arm.clicked,
        openRate: arm.openRate,
        clickRate: arm.clickRate
      })),
      winnerId: best.id,
      openLiftPoints: Number((((best.openRate || 0) - (second.openRate || 0)) * 100).toFixed(1)),
      z: Number(z.toFixed(2)),
      verdict: verdictForZ(z),
      clickWinnerId: clickRanked[0].id,
      clickVerdict: verdictForZ(clickZ),
      // An arm far larger than the others was Klaviyo's pick, sent on to the rest of the list
      // hours later; its figures mix the test with that later send.
      includesRemainder: Math.max(...sizes) > 1.5 * Math.min(...sizes)
    });
  }
  return tests.sort((left, right) => right.sentAt.localeCompare(left.sentAt));
}

// The same A/B test translated and run in several markets is a replication. Grouped by family and
// variant letter, it reads "B won in 4 of 5 markets" - stronger than any single test.
function summarizeAbFamilies(tests = []) {
  const families = new Map();
  for (const test of tests) {
    if (test.differs === "content" || !test.familyKey) continue;
    const family = families.get(test.familyKey) || { familyKey: test.familyKey, campaignName: test.campaignName, tests: [] };
    family.tests.push(test);
    families.set(test.familyKey, family);
  }
  return [...families.values()].map((family) => {
    const wins = {};
    let decisive = 0;
    for (const test of family.tests) {
      const letter = test.arms.find((arm) => arm.id === test.winnerId)?.letter || "?";
      wins[letter] = (wins[letter] || 0) + 1;
      if (test.verdict === "klar") decisive += 1;
    }
    const [leader, leaderWins] = Object.entries(wins).sort((left, right) => right[1] - left[1])[0] || ["", 0];
    return {
      familyKey: family.familyKey,
      campaignName: family.campaignName,
      markets: family.tests.map((test) => test.country),
      leader,
      leaderWins,
      decisive,
      tests: family.tests.length
    };
  }).filter((family) => family.tests > 1);
}

// ---- What Westpack's own sends say ------------------------------------------------------------

const featureTerm = (source) => new RegExp(`(?<![\\p{L}\\d])(?:${source})(?![\\p{L}\\d])`, "iu");

const SUBJECT_FEATURES = [
  { key: "question", label: "Spørgsmål", test: ({ subject }) => subject.includes("?") },
  { key: "number", label: "Tal", test: ({ subject }) => /\d/.test(subject) },
  { key: "emoji", label: "Emoji", test: ({ subject }) => countEmoji(subject) > 0 },
  { key: "offer", label: "Rabat eller tilbud", test: ({ subject }) => /%/.test(subject) || featureTerm("rabat|spar|tilbud\\p{L}*|udsalg\\p{L}*|sale").test(subject) },
  { key: "urgency", label: "Frist eller hast", test: ({ subject }) => featureTerm("sidste\\p{L}*|i dag|snart|frist\\p{L}*|deadline|skynd\\p{L}*|slutter|nu").test(subject) },
  { key: "news", label: "Nyhed", test: ({ subject }) => featureTerm("nyhed\\p{L}*|ny|nye|nyt|lancer\\p{L}*").test(subject) },
  { key: "howto", label: "Guide eller tips", test: ({ subject }) => featureTerm("sådan|guide\\p{L}*|tips|lær\\p{L}*|trin").test(subject) },
  { key: "we", label: "Vi/jeg-stemme", test: ({ subject }) => featureTerm("vi|jeg|vores").test(subject) },
  { key: "you", label: "Du-form", test: ({ subject }) => featureTerm("du|dig|din|dine").test(subject) },
  { key: "short", label: "Kort (højst 30 tegn)", test: ({ subject }) => [...subject].length <= 30 },
  { key: "long", label: "Lang (over 45 tegn)", test: ({ subject }) => [...subject].length > 45 },
  { key: "caps", label: "Ord i versaler", test: ({ subject }) => /(?<![\p{L}\d])\p{Lu}{4,}(?![\p{L}\d])/u.test(subject) },
  { key: "no_preview", label: "Uden preheader", test: ({ previewText }) => !String(previewText || "").trim() }
];

// Median open index with and without each feature. This is correlation across different emails,
// seasons and lists - a hint about the house's own pattern, not an effect - and it is labelled so
// wherever it is shown. Only features with enough sends on both sides are reported.
function buildFeatureStats(entries = [], { minEach = 15 } = {}) {
  const scored = entries.filter((entry) => Number.isFinite(entry.openIndex));
  return SUBJECT_FEATURES.map((feature) => {
    const withIt = scored.filter((entry) => feature.test(entry));
    const without = scored.filter((entry) => !feature.test(entry));
    if (withIt.length < minEach || without.length < minEach) return null;
    const withMedian = median(withIt.map((entry) => entry.openIndex));
    const withoutMedian = median(without.map((entry) => entry.openIndex));
    const withClick = median(withIt.map((entry) => entry.clickIndex).filter(Number.isFinite));
    const withoutClick = median(without.map((entry) => entry.clickIndex).filter(Number.isFinite));
    return {
      key: feature.key,
      label: feature.label,
      withCount: withIt.length,
      withoutCount: without.length,
      openIndexWith: Number(withMedian.toFixed(3)),
      openIndexWithout: Number(withoutMedian.toFixed(3)),
      openDifference: Number((withMedian - withoutMedian).toFixed(3)),
      clickIndexWith: Number.isFinite(withClick) ? Number(withClick.toFixed(3)) : null,
      clickIndexWithout: Number.isFinite(withoutClick) ? Number(withoutClick.toFixed(3)) : null
    };
  }).filter(Boolean).sort((left, right) => Math.abs(right.openDifference) - Math.abs(left.openDifference));
}

const STOPWORDS = new Set(["med", "til", "for", "der", "det", "den", "som", "har", "kan", "din", "dine", "dit", "vores", "eller", "ikke", "efter", "over", "under", "fra", "alle", "hele", "også", "the", "and", "your", "with", "from", "this", "that", "westpack", "variation", "kick"]);

function keywords(text = "") {
  return new Set((String(text || "").toLowerCase().match(/[\p{L}]{4,}/gu) || []).filter((word) => !STOPWORDS.has(word)));
}

function relevanceScore(words, entryText) {
  if (!words.size) return 0;
  let score = 0;
  for (const word of keywords(entryText)) {
    if (words.has(word)) score += 1;
    else if (word.length >= 6 && [...words].some((other) => other.length >= 6 && (other.startsWith(word.slice(0, 6)) || word.startsWith(other.slice(0, 6))))) score += 0.5;
  }
  return score;
}

function compactEntry(entry) {
  return {
    id: entry.id,
    country: entry.country,
    campaignName: entry.campaignName,
    subject: entry.subject,
    previewText: entry.previewText,
    sentAt: entry.sentAt,
    received: entry.received,
    openRate: entry.openRate,
    clickRate: entry.clickRate,
    openIndex: entry.openIndex,
    clickIndex: entry.clickIndex
  };
}

// Every analyse, generate, check and history request reads the same snapshot, and building the
// view indexes every send in eighteen accounts. A snapshot is replaced, never mutated, when it is
// synced, so the view is kept per snapshot object and drops out with it.
const viewCache = new WeakMap();

function buildHistoryView(snapshot, { country = "DK" } = {}) {
  const code = String(country || "DK").toUpperCase();
  if (!snapshot || typeof snapshot !== "object") return computeHistoryView(snapshot, code);
  const perSnapshot = viewCache.get(snapshot) || new Map();
  viewCache.set(snapshot, perSnapshot);
  if (!perSnapshot.has(code)) perSnapshot.set(code, computeHistoryView(snapshot, code));
  return perSnapshot.get(code);
}

function computeHistoryView(snapshot, code) {
  const entries = buildMarketEntries(snapshot?.markets?.[code]);
  const allTests = Object.values(snapshot?.markets || {}).flatMap((market) => buildAbTests(buildMarketEntries(market)));
  return {
    country: code,
    syncedAt: snapshot?.markets?.[code]?.syncedAt || "",
    entries,
    abTests: allTests,
    abFamilies: summarizeAbFamilies(allTests),
    featureStats: buildFeatureStats(entries.filter((entry) => Date.parse(entry.sentAt) >= Date.now() - 3 * 365 * 86_400_000))
  };
}

// What the generator and the analysis screen get from the history for one campaign: the house
// voice, what performed and what did not, the sends that resemble this one, and the A/B tests that
// say something about the choices it faces.
function buildHistoryInsights(snapshot, { country = "DK", focusText = "", now = new Date() } = {}) {
  const view = buildHistoryView(snapshot, { country });
  const words = keywords(focusText);
  const recentCutoff = now.getTime() - 3 * 365 * 86_400_000;
  const indexed = view.entries.filter((entry) => Number.isFinite(entry.openIndex) && Date.parse(entry.sentAt) >= recentCutoff && entry.received >= 300);
  const byIndex = [...indexed].sort((left, right) => right.openIndex - left.openIndex);

  const relevant = view.entries
    .filter((entry) => Number.isFinite(entry.openIndex))
    .map((entry) => ({ entry, score: relevanceScore(words, `${entry.campaignName} ${entry.subject} ${entry.previewText}`) }))
    .filter((item) => item.score >= 1)
    .sort((left, right) => right.score - left.score || right.entry.sentAt.localeCompare(left.entry.sentAt))
    .slice(0, 12)
    .map((item) => compactEntry(item.entry));

  const subjectTests = view.abTests.filter((test) => test.differs !== "content");
  const scoredTests = subjectTests
    .map((test) => ({
      test,
      score: relevanceScore(words, `${test.campaignName} ${test.arms.map((arm) => `${arm.subject} ${arm.previewText}`).join(" ")}`)
        + (test.country === view.country ? 1 : 0)
        + (test.verdict === "klar" ? 1.5 : test.verdict === "tendens" ? 0.5 : 0)
    }))
    .sort((left, right) => right.score - left.score || right.test.sentAt.localeCompare(left.test.sentAt));
  const abLessons = scoredTests
    .filter((item) => item.test.verdict !== "uafgjort" && item.test.language === (view.entries[0]?.language || "da"))
    .slice(0, 12)
    .map((item) => item.test);

  const fromLabels = {};
  for (const entry of view.entries.slice(0, 40)) if (entry.fromLabel) fromLabels[entry.fromLabel] = (fromLabels[entry.fromLabel] || 0) + 1;
  const senderLabel = Object.entries(fromLabels).sort((left, right) => right[1] - left[1])[0]?.[0] || "Westpack";

  return {
    country: view.country,
    syncedAt: view.syncedAt,
    sendCount: view.entries.length,
    abTestCount: subjectTests.length,
    senderLabel,
    voiceSamples: view.entries.slice(0, 25).map(compactEntry),
    topPerformers: byIndex.slice(0, 15).map(compactEntry),
    weakest: byIndex.slice(-8).reverse().map(compactEntry),
    relevant,
    abLessons,
    abFamilies: view.abFamilies.filter((family) => abLessons.some((test) => test.familyKey === family.familyKey)),
    featureStats: view.featureStats,
    pastSubjects: view.entries.map((entry) => ({ subject: entry.subject, sentAt: entry.sentAt }))
  };
}

function summarizeHistorySnapshot(snapshot) {
  const markets = Object.values(snapshot?.markets || {}).map((market) => {
    const entries = buildMarketEntries(market);
    const tests = buildAbTests(entries);
    return {
      country: market.country,
      language: market.language,
      syncedAt: market.syncedAt,
      sends: entries.length,
      abTests: tests.filter((test) => test.differs !== "content").length,
      firstSend: entries.length ? entries[entries.length - 1].sentAt : "",
      lastSend: entries[0]?.sentAt || "",
      lastError: market.lastError || ""
    };
  }).sort((left, right) => right.sends - left.sends);
  return {
    syncedAt: snapshot?.syncedAt || "",
    markets,
    sends: markets.reduce((sum, market) => sum + market.sends, 0),
    abTests: markets.reduce((sum, market) => sum + market.abTests, 0)
  };
}

module.exports = {
  HISTORY_VERSION,
  LANGUAGE_BY_MARKET,
  MIN_RECIPIENTS_FOR_INDEX,
  applyBaselines,
  buildAbTests,
  buildFeatureStats,
  buildHistoryInsights,
  buildHistoryView,
  buildMarketEntries,
  buildMessageRows,
  familyKeyForCampaign,
  mergeMessageRows,
  resolveYearsToFetch,
  summarizeAbFamilies,
  summarizeHistorySnapshot,
  syncMarketHistory,
  syncSubjectLineHistory,
  twoProportionZ,
  verdictForZ
};
