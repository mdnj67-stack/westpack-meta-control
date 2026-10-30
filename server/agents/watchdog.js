// The watchdog: read-only checks that catch, within the hour, the kind of thing that was found days
// late in October 2026 - the ad account stopped for a missing payment overnight, a 301 on the
// Italian store dropping fbclid, a full Redis silently emptying the audit log.
//
// It reads and reports. It never pauses, edits or creates anything in Meta, Klaviyo or the stores.
//
// Each check returns { status, summary, items }. Status is one of:
//   ok       - looked, nothing wrong
//   note     - worth knowing, not worth interrupting anyone for (never counted in the badge)
//   warn     - should be looked at today
//   alert    - something is broken or costing money now
//   skipped  - not applicable here (e.g. no Redis configured)
//   error    - could not check; says why, and is kept apart from "found a problem"
//
// Items carry a stable `key` and a `fingerprint` of their state. A person can mute an item; the
// mute holds only while the fingerprint is unchanged, so a muted ad that is rejected for a new
// reason alerts again.

const STATUS_RANK = { ok: 0, skipped: 0, note: 1, error: 2, warn: 3, alert: 4 };
const HISTORY_LIMIT = 168;
const DAILY_HOUR_UTC = 5;
const GTM_CONTAINER = "GTM-5QRXWTJ";
const CHECK_USER_AGENT = "Mozilla/5.0 (compatible; WestpackWatchdog/1.0; +https://project-4fcxa.vercel.app)";
const BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const FETCH_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 6;

// Meta's account_status codes, in words a colleague can act on.
const ACCOUNT_STATUS = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled - a payment is due",
  7: "Pending risk review",
  8: "Pending settlement",
  9: "In grace period - a payment is due",
  100: "Pending closure",
  101: "Closed"
};
const DISABLE_REASON = {
  1: "ad integrity policy",
  2: "intellectual property review",
  3: "payment risk",
  4: "account shut down",
  5: "ads review",
  6: "business integrity",
  7: "permanently closed",
  8: "unused reseller account",
  9: "unused account"
};

function worst(statuses = []) {
  return statuses.reduce((current, next) => (STATUS_RANK[next] > STATUS_RANK[current] ? next : current), "ok");
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function isTokenError(message = "") {
  return /code 190\b|access token|session has expired|OAuthException/i.test(message);
}

function isRateLimit(message = "") {
  return /too many calls|rate limit|code (4|17|32|613|80004)\b|User request limit/i.test(message);
}

// What a failed Meta call means for the person reading the page.
function metaFailure(error) {
  const message = String(error?.message || error || "");
  if (isTokenError(message)) {
    return { status: "alert", summary: "The Meta access token no longer works. The dashboard, ad creation and these checks are all blind until it is renewed.", detail: message };
  }
  if (isRateLimit(message)) {
    return { status: "error", summary: "Meta asked for fewer calls. Nothing is retried here; the next hourly run checks again.", detail: message };
  }
  return { status: "error", summary: "Meta did not answer.", detail: message };
}

// ---------------------------------------------------------------------------------------------
// Meta

async function checkMetaAccount({ graph, accountId }) {
  let account;
  try {
    account = await graph(`/${accountId}`, { fields: "name,account_status,disable_reason,amount_spent,spend_cap,currency" });
  } catch (error) {
    return metaFailure(error);
  }
  const code = Number(account.account_status);
  const items = [];
  if (code !== 1) {
    const reason = Number(account.disable_reason) ? ` (${DISABLE_REASON[Number(account.disable_reason)] || `reason ${account.disable_reason}`})` : "";
    items.push({
      key: "account_status",
      fingerprint: `${code}:${account.disable_reason || 0}`,
      status: "alert",
      title: `Ad account: ${ACCOUNT_STATUS[code] || `status ${code}`}${reason}`,
      detail: "Nothing delivers until this is resolved in Meta Business Settings -> Billing."
    });
  }
  const cap = Number(account.spend_cap) || 0;
  if (cap > 0) {
    const share = Number(account.amount_spent || 0) / cap;
    if (share >= 0.85) {
      items.push({
        key: "spend_cap",
        fingerprint: share >= 0.95 ? "cap95" : "cap85",
        status: share >= 0.95 ? "alert" : "warn",
        title: `The account has used ${Math.round(share * 100)}% of its spending limit`,
        detail: "When the limit is reached every campaign stops. Raise or remove it in Billing."
      });
    }
  }
  return {
    status: worst(items.map((item) => item.status)),
    summary: items.length ? items[0].title : `${account.name || "The ad account"} is active and can deliver.`,
    items
  };
}

function reviewReason(ad) {
  const feedback = ad.ad_review_feedback?.global || ad.ad_review_feedback || {};
  const texts = typeof feedback === "object" ? Object.values(feedback).filter((value) => typeof value === "string") : [];
  const issues = (ad.issues_info || []).map((issue) => issue.error_summary || issue.error_message).filter(Boolean);
  return [...texts, ...issues][0] || "";
}

async function readAllPages(graph, path, params, maxPages = 5) {
  const rows = [];
  let after = "";
  for (let page = 0; page < maxPages; page += 1) {
    const payload = await graph(path, { ...params, ...(after ? { after } : {}) });
    rows.push(...(payload.data || []));
    after = payload.paging?.next ? payload.paging?.cursors?.after || "" : "";
    if (!after) break;
  }
  return rows;
}

const DELIVERING = new Set(["ACTIVE", "WITH_ISSUES"]);

// An ad only matters here if someone switched it on and it sits in an ad set and campaign that
// deliver: the account holds dozens of paused test ads with issues that cost nothing.
function isSwitchedOnAndLive(ad) {
  return ad.configured_status === "ACTIVE"
    && DELIVERING.has(ad.adset?.effective_status)
    && DELIVERING.has(ad.campaign?.effective_status);
}

async function checkMetaAds({ graph, accountId, now }) {
  let ads;
  try {
    ads = await readAllPages(graph, `/${accountId}/ads`, {
      fields: "name,effective_status,configured_status,updated_time,issues_info,ad_review_feedback,adset{name,effective_status},campaign{name,effective_status}",
      filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["DISAPPROVED", "WITH_ISSUES", "PENDING_REVIEW"] }]),
      limit: 200
    });
  } catch (error) {
    return metaFailure(error);
  }
  const items = [];
  for (const ad of ads.filter(isSwitchedOnAndLive)) {
    const where = [ad.campaign?.name, ad.adset?.name].filter(Boolean).join(" > ");
    const reason = reviewReason(ad);
    if (ad.effective_status === "PENDING_REVIEW") {
      const waitingHours = (now.getTime() - Date.parse(ad.updated_time || now.toISOString())) / 3600000;
      if (waitingHours < 24) continue;
      items.push({
        key: ad.id,
        fingerprint: "PENDING_REVIEW",
        status: "warn",
        title: ad.name,
        detail: `${where} - in review for ${Math.floor(waitingHours)} hours. Meta usually decides within a day.`
      });
      continue;
    }
    items.push({
      key: ad.id,
      fingerprint: `${ad.effective_status}:${reason}`,
      status: "alert",
      title: ad.name,
      detail: `${where} - ${ad.effective_status === "DISAPPROVED" ? "rejected" : "has issues"}${reason ? `: ${reason}` : ""}`
    });
  }
  const alerts = items.filter((item) => item.status === "alert").length;
  return {
    status: worst(items.map((item) => item.status)),
    summary: items.length
      ? `${plural(alerts, "switched-on ad is", "switched-on ads are")} rejected or has issues${items.length > alerts ? `, ${items.length - alerts} stuck in review` : ""}.`
      : "Every switched-on ad is approved.",
    items
  };
}

// ---------------------------------------------------------------------------------------------
// Landing pages

function creativeLinks(creative = {}) {
  const spec = creative.object_story_spec || {};
  return [
    spec.link_data?.link,
    ...(spec.link_data?.child_attachments || []).map((card) => card.link),
    spec.video_data?.call_to_action?.value?.link,
    ...(creative.asset_feed_spec?.link_urls || []).map((entry) => entry.website_url)
  ].filter((link) => /^https?:\/\//i.test(String(link || "")));
}

// The URL a click actually produces: the ad's link, its URL parameters with Meta's dynamic
// values filled in, and an fbclid as Meta appends one.
function buildClickUrl(link, urlTags = "") {
  const url = new URL(link);
  const tags = new URLSearchParams(String(urlTags || "").replace(/\{\{[^}]*\}\}/g, "watchdog"));
  for (const [key, value] of tags) url.searchParams.set(key, value);
  url.searchParams.set("fbclid", "wpwatchdog");
  return url.toString();
}

async function fetchFollowing(fetchImpl, startUrl, { method = "GET", maxRedirects = MAX_REDIRECTS } = {}) {
  const hops = [];
  let current = startUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await fetchImpl(current, {
      method,
      redirect: "manual",
      // A browser's Accept header, not a bare "text/html": with UTM parameters the store's
      // Magento throws an exception (500) on exactly "Accept: text/html", which no real browser
      // sends (2026-10-30). The check has to ask the way a phone does, or it reports its own error.
      headers: { "User-Agent": CHECK_USER_AGENT, Accept: BROWSER_ACCEPT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => {});
      hops.push({ status: response.status, from: current });
      current = new URL(location, current).toString();
      continue;
    }
    return { response, finalUrl: current, hops };
  }
  return { response: null, finalUrl: current, hops, tooManyRedirects: true };
}

function isChallenge(response) {
  if (!response) return false;
  return Boolean(response.headers.get("cf-mitigated")) || ([403, 503].includes(response.status) && /cloudflare/i.test(response.headers.get("server") || ""));
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return String(value);
  }
}

// One clicked link, judged the way the click would go.
function judgeLanding({ clickUrl, result, ads }) {
  const label = shortUrl(clickUrl);
  const used = `Used by ${plural(ads.length, "ad", "ads")}: ${ads.slice(0, 4).join(", ")}${ads.length > 4 ? ", ..." : ""}.`;
  if (result.error) {
    return { key: label, fingerprint: "unreachable", status: "error", title: label, detail: `Could not be fetched (${result.error}). ${used}` };
  }
  if (result.tooManyRedirects) {
    return { key: label, fingerprint: "loop", status: "alert", title: label, detail: `More than ${MAX_REDIRECTS} redirects - probably a loop. ${used}` };
  }
  if (isChallenge(result.response)) {
    return { key: label, fingerprint: "challenge", status: "error", title: label, detail: `The store's firewall answered the check with a challenge, so the page could not be judged. ${used}` };
  }
  const status = result.response.status;
  if (status < 200 || status >= 300) {
    return { key: label, fingerprint: `http${status}`, status: "alert", title: label, detail: `Returns ${status}${result.hops.length ? ` after redirecting to ${shortUrl(result.finalUrl)}` : ""}. ${used}` };
  }
  const asked = new URL(clickUrl).searchParams;
  const landed = new URL(result.finalUrl).searchParams;
  const lost = [...asked.keys()].filter((key) => !landed.has(key));
  // The store's blog answers any URL with a query string by redirecting to itself without it
  // (seen 2026-10-30; the trailing-slash variant does the same), so there is no better URL to give.
  const sameAddress = shortUrl(clickUrl) === shortUrl(result.finalUrl);
  if (lost.length && sameAddress) {
    return {
      key: label,
      fingerprint: `stripped:${lost.sort().join(",")}`,
      status: "alert",
      title: label,
      detail: `Redirects to itself without its query string, so every click arrives without fbclid and the UTM parameters. ${used}`,
      ads
    };
  }
  if (lost.length) {
    const lostFbclid = lost.includes("fbclid");
    const doubleSlash = new URL(clickUrl).pathname.includes("//");
    return {
      key: label,
      fingerprint: `lost:${lost.sort().join(",")}`,
      status: "alert",
      title: label,
      detail: `${doubleSlash ? "The ad's link has a double slash in its path. " : ""}${result.hops.map((hop) => hop.status).join(" -> ")} to ${shortUrl(result.finalUrl)} drops ${lost.length > 4 ? `${lost.length} parameters${lostFbclid ? ", fbclid among them" : ""}` : lost.join(", ")}.${lostFbclid ? " Without fbclid Meta cannot match the visit to the click." : " The visit is reported without its campaign."} ${doubleSlash ? "Correct the link in the ad" : `Point the ads at ${shortUrl(result.finalUrl)}`}. ${used}`
    };
  }
  if (result.hops.length) {
    return { key: label, fingerprint: `redirect:${shortUrl(result.finalUrl)}`, status: "note", title: label, detail: `Redirects to ${shortUrl(result.finalUrl)} and keeps its parameters. Pointing the ads straight at it saves a hop. ${used}` };
  }
  return null;
}

// One request at a time, with a pause between them: the stores are a production webshop, and
// the check should look like one visitor clicking through, not a crawler.
const DEFAULT_PACE_MS = 700;

async function forEachPaced(items, paceMs, fn) {
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    if (index && paceMs) await new Promise((resolve) => setTimeout(resolve, paceMs));
    results.push(await fn(items[index], index));
  }
  return results;
}

// A timeout or a 5xx can be a blip that is gone before anyone could act. A failure gets one more
// look after a pause before it alerts; one that recovers is reported as a note, so a pattern of
// blips is still visible.
const DEFAULT_RETRY_DELAY_MS = 20000;

async function secondLook(entries, first, judge, delayMs = DEFAULT_RETRY_DELAY_MS, paceMs = DEFAULT_PACE_MS) {
  const failing = first.map((item, index) => (item && ["alert", "error"].includes(item.status) ? index : -1)).filter((index) => index >= 0);
  if (!failing.length) return first;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const results = [...first];
  for (const [position, index] of failing.entries()) {
    if (position && paceMs) await new Promise((resolve) => setTimeout(resolve, paceMs));
    const again = await judge(entries[index], index);
    if (again && ["alert", "error"].includes(again.status)) {
      results[index] = again;
    } else {
      const before = first[index];
      results[index] = {
        key: before.key,
        fingerprint: `blip:${before.fingerprint}`,
        status: "note",
        title: before.title,
        detail: `Failed once (${before.detail.split(".")[0].toLowerCase()}) and was fine on a second try ${Math.round(delayMs / 1000)} seconds later.`
      };
    }
  }
  return results;
}

async function checkLandingPages({ graph, accountId, fetchImpl, retryDelayMs, paceMs = DEFAULT_PACE_MS }) {
  let ads;
  try {
    ads = await readAllPages(graph, `/${accountId}/ads`, {
      fields: "name,url_tags,creative{url_tags,object_story_spec{link_data{link,child_attachments{link}},video_data{call_to_action{value{link}}}},asset_feed_spec{link_urls{website_url}}}",
      filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
      limit: 200
    });
  } catch (error) {
    return metaFailure(error);
  }

  const clicks = new Map();
  let socialMedium = 0;
  for (const ad of ads) {
    const tags = ad.creative?.url_tags || ad.url_tags || "";
    if (/(^|&)utm_medium=social(&|$)/.test(tags)) socialMedium += 1;
    for (const link of new Set(creativeLinks(ad.creative))) {
      let clickUrl;
      try {
        clickUrl = buildClickUrl(link, tags);
      } catch {
        continue;
      }
      if (!clicks.has(clickUrl)) clicks.set(clickUrl, []);
      clicks.get(clickUrl).push(ad.name);
    }
  }

  const entries = [...clicks.entries()];
  const judge = async ([clickUrl, adNames]) => {
    let result;
    try {
      result = await fetchFollowing(fetchImpl, clickUrl);
      await result.response?.body?.cancel().catch(() => {});
    } catch (error) {
      result = { error: error?.name === "TimeoutError" ? "timed out" : String(error?.message || error) };
    }
    return judgeLanding({ clickUrl, result, ads: adNames });
  };
  const first = await forEachPaced(entries, paceMs, judge);
  const judged = await secondLook(entries, first, judge, retryDelayMs, paceMs);

  // Several clicks can land on the same page with different parameters; one item per page.
  const byKey = new Map();
  for (const item of judged.filter(Boolean)) {
    const existing = byKey.get(item.key);
    if (!existing || STATUS_RANK[item.status] > STATUS_RANK[existing.status]) byKey.set(item.key, item);
  }
  const stripped = [...byKey.values()].filter((item) => item.fingerprint.startsWith("stripped:"));
  const items = [...byKey.values()].filter((item) => !item.fingerprint.startsWith("stripped:"));
  if (stripped.length) {
    const adCount = new Set(stripped.flatMap((item) => item.ads || [])).size;
    items.unshift({
      key: "query_stripped",
      fingerprint: `stripped:${stripped.map((item) => item.key).sort().join("|")}`,
      status: "alert",
      title: `${plural(stripped.length, "page drops", "pages drop")} fbclid and UTM on every click (${plural(adCount, "ad", "ads")})`,
      detail: "The store redirects these pages - the blog, every time - to themselves without the query string. Clicks still arrive, but Meta cannot match the visit to the click and GA4 records it without its campaign. No variant of the address keeps the parameters: accept it for these ads, or link a category or product page instead.",
      list: stripped.map((item) => `${item.key} - ${plural((item.ads || []).length, "ad", "ads")}: ${(item.ads || []).slice(0, 4).join(", ")}${(item.ads || []).length > 4 ? ", ..." : ""}`)
    });
  }
  if (socialMedium) {
    items.push({
      key: "utm_medium_social",
      fingerprint: `social:${socialMedium}`,
      status: "note",
      title: `${plural(socialMedium, "switched-on ad tags", "switched-on ads tag")} utm_medium=social`,
      detail: "GA4 files those visits as Organic Social rather than paid. The rest use paidsocial."
    });
  }
  const pages = new Set(entries.map(([clickUrl]) => shortUrl(clickUrl))).size;
  const broken = stripped.length + items.filter((item) => item.status === "alert" && item.key !== "query_stripped").length;
  const unchecked = items.filter((item) => item.status === "error").length;
  return {
    status: worst(items.map((item) => item.status)),
    summary: broken
      ? `${broken} of ${pages} landing pages lose fbclid and UTM or do not load.`
      : `All ${pages} landing pages load and keep fbclid and UTM parameters${unchecked ? `; ${unchecked} could not be checked` : ""}.`,
    items
  };
}

// ---------------------------------------------------------------------------------------------
// Stores

async function checkStores({ fetchImpl, stores, retryDelayMs, paceMs = DEFAULT_PACE_MS }) {
  const judge = async (store) => {
    let outcome;
    try {
      const { response, finalUrl } = await fetchFollowing(fetchImpl, store.url);
      if (!response) outcome = { status: "alert", detail: "Redirects in a loop." };
      else if (isChallenge(response)) outcome = { status: "error", detail: "The firewall answered with a challenge, so the page could not be read." };
      else if (response.status !== 200) outcome = { status: "alert", detail: `Returns ${response.status}${finalUrl !== store.url ? ` at ${shortUrl(finalUrl)}` : ""}.` };
      else if (!(await response.text()).includes(GTM_CONTAINER)) outcome = { status: "alert", detail: `Loads, but ${GTM_CONTAINER} is missing: no consent banner, no tracking, no Klaviyo popups.` };
    } catch (error) {
      outcome = { status: "error", detail: error?.name === "TimeoutError" ? "Timed out." : String(error?.message || error) };
    }
    return outcome ? { key: store.code, fingerprint: `${outcome.status}:${outcome.detail}`, status: outcome.status, title: `${store.code} store`, detail: outcome.detail } : null;
  };
  const first = await forEachPaced(stores, paceMs, judge);
  const items = (await secondLook(stores, first, judge, retryDelayMs, paceMs)).filter(Boolean);
  const count = (status) => items.filter((item) => item.status === status).length;
  const down = count("alert");
  return {
    status: worst(items.map((item) => item.status)),
    summary: down
      ? `${plural(down, "store has", "stores have")} a problem, of ${stores.length}.`
      : `All ${stores.length} stores load with the ${GTM_CONTAINER} tag${count("error") ? `; ${count("error")} could not be read` : ""}${count("note") ? `; ${plural(count("note"), "failed once and recovered", "failed once and recovered")}` : ""}.`,
    items
  };
}

// ---------------------------------------------------------------------------------------------
// Nightly jobs and storage

const NIGHTLY_SNAPSHOTS = {
  historical_intelligence: "Meta creative history (nightly 03:20 UTC)",
  expansion_reach: "Expansion tab: first-time reach (nightly 03:10 UTC)",
  audience_saturation: "Expansion tab: audience saturation (nightly 03:10 UTC)",
  subject_line_history: "Subject lines: Klaviyo send history (nightly 04:50 UTC)"
};

async function checkNightlySyncs({ readSnapshotTimes, now }) {
  let times;
  try {
    times = await readSnapshotTimes();
  } catch (error) {
    return { status: "error", summary: "The snapshot store did not answer.", detail: String(error?.message || error) };
  }
  if (!times) return { status: "skipped", summary: "Snapshots are not kept in Blob here, so their age cannot be read.", items: [] };
  const items = [];
  for (const [name, label] of Object.entries(NIGHTLY_SNAPSHOTS)) {
    const entry = times[name] || {};
    if (entry.error) {
      items.push({ key: name, fingerprint: "error", status: "error", title: label, detail: `Could not be read: ${entry.error}` });
      continue;
    }
    if (entry.exists === false) {
      items.push({ key: name, fingerprint: "missing", status: "warn", title: label, detail: "Has never been written." });
      continue;
    }
    if (!entry.lastModified) continue;
    const ageHours = (now.getTime() - Date.parse(entry.lastModified)) / 3600000;
    if (ageHours > 26) {
      items.push({
        key: name,
        fingerprint: ageHours > 50 ? "stale2" : "stale1",
        status: ageHours > 50 ? "alert" : "warn",
        title: label,
        detail: `Last written ${Math.floor(ageHours)} hours ago, so last night's run did not land. The screen shows older figures.`
      });
    }
  }
  return {
    status: worst(items.map((item) => item.status)),
    summary: items.length ? `${plural(items.length, "nightly job is", "nightly jobs are")} behind.` : "Every nightly snapshot was written in the last day.",
    items
  };
}

async function checkStorage({ redisPing }) {
  let reply;
  try {
    reply = await redisPing();
  } catch (error) {
    const message = String(error?.message || error);
    if (/not configured/i.test(message)) return { status: "skipped", summary: "No Redis is configured here.", items: [] };
    const full = /limit|exceeded|max requests|upgrade/i.test(message);
    return {
      status: "alert",
      summary: full
        ? "Redis is refusing commands (plan limit). Studio drafts, the asset library, the audit log, campaign learning and Canva sign-ins are not being saved."
        : "Redis did not answer. Studio drafts, the asset library, the audit log and Canva sign-ins depend on it.",
      items: [{ key: "redis", fingerprint: full ? "full" : "down", status: "alert", title: "Redis", detail: message }]
    };
  }
  return { status: "ok", summary: `Redis answers (${reply}).`, items: [] };
}

// ---------------------------------------------------------------------------------------------
// The run

const CHECKS = [
  { id: "meta_account", title: "Meta ad account", cadence: "hourly", run: checkMetaAccount, needs: "meta" },
  { id: "meta_ads", title: "Rejected ads", cadence: "hourly", run: checkMetaAds, needs: "meta" },
  { id: "storage", title: "Redis", cadence: "hourly", run: checkStorage },
  { id: "nightly_syncs", title: "Nightly jobs", cadence: "hourly", run: checkNightlySyncs },
  { id: "landing_pages", title: "Landing pages", cadence: "daily", run: checkLandingPages, needs: "meta" },
  { id: "stores", title: "Webshops", cadence: "daily", run: checkStores }
];

const CHECK_DESCRIPTIONS = {
  meta_account: "Whether the ad account can deliver: payment status, spending limit, a working access token.",
  meta_ads: "Ads someone switched on that Meta rejected, flagged with issues, or has kept in review for more than a day.",
  storage: "Whether Redis answers. Studio drafts, the asset library, the audit log and Canva sign-ins are stored there.",
  nightly_syncs: "Whether last night's snapshots behind the Expansion tab and the subject line generator were written.",
  landing_pages: "Every link in a switched-on ad, clicked the way Meta clicks it: does it load, and do fbclid and the UTM parameters survive the redirects.",
  stores: "Each of the 18 webshops loads and carries the GTM container that runs consent, tracking and popups."
};

// Daily checks run on the first run after 05:00 UTC (06:00 or 07:00 in Denmark), so the morning
// shows a fresh pass, and on a manual "run everything".
function shouldRunDaily({ previous, now, scope }) {
  if (scope === "all") return true;
  const lastDaily = Date.parse(previous?.lastDailyAt || "") || 0;
  const todaysSlot = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_HOUR_UTC);
  const slot = now.getTime() >= todaysSlot ? todaysSlot : todaysSlot - 86400000;
  return lastDaily < slot;
}

function applyMutes(check, mutes = {}) {
  const items = (check.items || []).map((item) => {
    const mute = mutes[`${check.id}:${item.key}`];
    return mute && mute.fingerprint === item.fingerprint ? { ...item, muted: { at: mute.at, note: mute.note || "" } } : { ...item, muted: null };
  });
  const live = items.filter((item) => !item.muted);
  // A check with items takes its status from the items nobody has muted; a check that failed as a
  // whole (no items, status error/alert) keeps its own.
  const status = items.length ? worst(live.map((item) => item.status)) : check.status;
  return { ...check, items, status };
}

function summarize(checks) {
  const counts = { alert: 0, warn: 0, error: 0, muted: 0 };
  for (const check of Object.values(checks)) {
    if (!check.items?.length) {
      if (counts[check.status] !== undefined) counts[check.status] += 1;
      continue;
    }
    for (const item of check.items) {
      if (item.muted) counts.muted += 1;
      else if (counts[item.status] !== undefined) counts[item.status] += 1;
    }
  }
  return counts;
}

async function runWatchdog({ deps, previous = null, scope = "auto", now = new Date() }) {
  const runDaily = shouldRunDaily({ previous, now, scope });
  const due = CHECKS.filter((check) => check.cadence === "hourly" || runDaily);
  const ran = {};
  for (const check of due) {
    const started = Date.now();
    let result;
    if (check.needs === "meta" && !deps.graph) {
      result = { status: "skipped", summary: "Meta is not configured here.", items: [] };
    } else {
      try {
        result = await check.run({ ...deps, now });
      } catch (error) {
        result = { status: "error", summary: "The check itself failed.", detail: String(error?.message || error), items: [] };
      }
    }
    ran[check.id] = {
      id: check.id,
      title: check.title,
      cadence: check.cadence,
      description: CHECK_DESCRIPTIONS[check.id],
      status: result.status,
      summary: result.summary,
      detail: result.detail || "",
      items: result.items || [],
      checkedAt: now.toISOString(),
      durationMs: Date.now() - started
    };
  }

  const mutes = previous?.mutes || {};
  const checks = {};
  for (const check of CHECKS) {
    const current = ran[check.id] || previous?.checks?.[check.id];
    if (current) checks[check.id] = applyMutes(current, mutes);
  }
  const counts = summarize(checks);
  return {
    version: 1,
    ranAt: now.toISOString(),
    scope,
    lastDailyAt: runDaily ? now.toISOString() : previous?.lastDailyAt || null,
    checks,
    counts,
    mutes,
    history: [...(previous?.history || []), { at: now.toISOString(), ...counts, ran: Object.keys(ran) }].slice(-HISTORY_LIMIT)
  };
}

// Mutes are applied on the next read as well as the next run, so a click takes effect at once.
function withMute(snapshot, { checkId, itemKey, note = "", now = new Date() }) {
  const check = snapshot?.checks?.[checkId];
  const item = check?.items?.find((entry) => entry.key === itemKey);
  if (!item) throw Object.assign(new Error("That item is no longer reported."), { statusCode: 404 });
  const mutes = { ...(snapshot.mutes || {}), [`${checkId}:${itemKey}`]: { fingerprint: item.fingerprint, at: now.toISOString(), note: String(note || "").slice(0, 300) } };
  return refreshMutes({ ...snapshot, mutes });
}

function withoutMute(snapshot, { checkId, itemKey }) {
  const mutes = { ...(snapshot?.mutes || {}) };
  delete mutes[`${checkId}:${itemKey}`];
  return refreshMutes({ ...snapshot, mutes });
}

function refreshMutes(snapshot) {
  const checks = {};
  for (const [id, check] of Object.entries(snapshot.checks || {})) checks[id] = applyMutes(check, snapshot.mutes);
  return { ...snapshot, checks, counts: summarize(checks) };
}

module.exports = {
  CHECKS,
  CHECK_DESCRIPTIONS,
  GTM_CONTAINER,
  buildClickUrl,
  checkLandingPages,
  checkMetaAccount,
  checkMetaAds,
  checkNightlySyncs,
  checkStorage,
  checkStores,
  isSwitchedOnAndLive,
  judgeLanding,
  runWatchdog,
  shouldRunDaily,
  withMute,
  withoutMute
};
