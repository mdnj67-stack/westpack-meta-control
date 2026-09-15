// Resolving "the newsletter list" in each Klaviyo account, and counting it.
//
// Every market is its own Klaviyo account, and each one holds exactly one campaign newsletter list.
// Someone translated the title of each into the local language, so there is no single pattern to
// match on: "Westpack News (US)", "News from Westpack (EU)", "Nouveauté de Westpack (FR)",
// "Westpack Nyhedsbrev (DK)", "Neuheiten von Westpack (DE)", "Notizie da Westpack (IT)". The older
// approach scored list names on the words "nyhedsbrev", "newsletter" and "westpack", which most of
// the real lists do not contain - they won only because nothing else in the account scored at all.
// That is luck, not a rule, and it has a live trap: the EU account also holds a list called
// "Westpack KAS Newsletter", which outscores the real "News from Westpack (EU)" and holds nobody.
//
// The order here is therefore: an explicitly configured list id, then an explicitly configured list
// name, then the shape every real list actually shares - the Westpack name plus a bracketed market
// suffix - and only then the legacy keyword score. A market that lands on the keyword score is
// reported as such so the caller can say so out loud rather than trusting it silently.

const { fetchWithTimeout } = require("../lib/http");

const KLAVIYO_REQUEST_TIMEOUT_MS = 15000;
const BRANDED_LIST_PATTERN = /westpack/i;
const MARKET_SUFFIX_PATTERN = /\(\s*[A-Za-z]{2}\s*\)\s*$/;

function buildHeaders(privateKey, revision) {
  return {
    Authorization: `Klaviyo-API-Key ${privateKey}`,
    accept: "application/json",
    revision: revision || "2024-10-15"
  };
}

async function klaviyoRequest(url, headers, method = "GET", body = null) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        headers: body ? { ...headers, "content-type": "application/json" } : headers,
        body: body ? JSON.stringify(body) : undefined
      },
      KLAVIYO_REQUEST_TIMEOUT_MS
    );
    const payload = await response.json().catch(() => ({}));

    if (response.ok && !payload?.errors?.length) {
      return payload;
    }

    const message = payload?.errors?.[0]?.detail || payload?.message || `Klaviyo request failed (${response.status}).`;
    if (message.toLowerCase().includes("throttled") && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Klaviyo request failed.");
}

async function getAllPages(url, headers) {
  const items = [];
  let next = url;
  while (next) {
    const payload = await klaviyoRequest(next, headers);
    if (Array.isArray(payload.data)) items.push(...payload.data);
    next = payload?.links?.next || "";
  }
  return items;
}

// Pure so the resolution order can be tested without touching Klaviyo.
function chooseNewsletterList(lists = [], { listId = "", listName = "" } = {}) {
  const candidates = (Array.isArray(lists) ? lists : [])
    .map((list) => ({ id: list?.id || "", name: String(list?.attributes?.name || list?.name || "") }))
    .filter((item) => item.id);

  if (listId) {
    const exact = candidates.find((item) => item.id === listId);
    if (exact) return { ...exact, resolvedBy: "configured_id" };
  }

  if (listName) {
    const wanted = listName.trim().toLowerCase();
    const named = candidates.find((item) => item.name.trim().toLowerCase() === wanted);
    if (named) return { ...named, resolvedBy: "configured_name" };
  }

  // The shape every real newsletter list shares, in every language: the brand plus "(XX)".
  const branded = candidates
    .filter((item) => BRANDED_LIST_PATTERN.test(item.name) && MARKET_SUFFIX_PATTERN.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (branded.length === 1) return { ...branded[0], resolvedBy: "branded_name" };
  if (branded.length > 1) {
    return { ...branded[0], resolvedBy: "branded_name_ambiguous", ambiguousWith: branded.slice(1).map((item) => item.name) };
  }

  const scored = candidates
    .map((item) => {
      const lower = item.name.toLowerCase();
      let score = 0;
      if (lower.includes("nyhedsbrev")) score += 5;
      if (lower.includes("newsletter")) score += 4;
      if (lower.includes("westpack")) score += 2;
      if (lower.includes("test")) score -= 4;
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (scored[0]) {
    return { id: scored[0].id, name: scored[0].name, resolvedBy: "keyword_guess" };
  }
  return null;
}

async function resolveNewsletterList(headers, { listId = "", listName = "" } = {}) {
  const lists = await getAllPages("https://a.klaviyo.com/api/lists/", headers);
  return chooseNewsletterList(lists, { listId, listName });
}

// Klaviyo will report the member count itself, in one request. Walking every profile to add up the
// page lengths returns the same number - verified market by market - but costs 268 requests and
// about 167 seconds across the eighteen accounts, which is why nobody could afford to ask for a
// fresh count on a page load.
async function fetchListProfileCount(headers, listId) {
  if (!listId) return 0;
  const payload = await klaviyoRequest(
    `https://a.klaviyo.com/api/lists/${listId}/?additional-fields%5Blist%5D=profile_count`,
    headers
  );
  const count = Number(payload?.data?.attributes?.profile_count);
  if (!Number.isFinite(count)) throw new Error("Klaviyo did not report a profile count for this list.");
  return count;
}

// The slow walk, kept for the history job and as a fallback. It is the only way to learn *when*
// each current member joined, which is what turns a level into a flow.
async function collectListJoinTallies(headers, listId, { pageSize = 100 } = {}) {
  const joinedByDate = new Map();
  let total = 0;
  let next = `https://a.klaviyo.com/api/lists/${listId}/profiles/?page%5Bsize%5D=${pageSize}`;

  while (next) {
    const payload = await klaviyoRequest(next, headers);
    const profiles = Array.isArray(payload.data) ? payload.data : [];
    total += profiles.length;
    for (const profile of profiles) {
      const joinedAt = profile?.attributes?.joined_group_at || profile?.attributes?.created;
      const key = String(joinedAt || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      joinedByDate.set(key, (joinedByDate.get(key) || 0) + 1);
    }
    next = payload?.links?.next || "";
  }

  return { total, joinedByDate };
}

function countJoinsSince(joinedByDate, sinceDate) {
  if (!sinceDate) return 0;
  let joined = 0;
  for (const [date, value] of joinedByDate.entries()) {
    if (date > sinceDate) joined += value;
  }
  return joined;
}

module.exports = {
  BRANDED_LIST_PATTERN,
  KLAVIYO_REQUEST_TIMEOUT_MS,
  MARKET_SUFFIX_PATTERN,
  buildHeaders,
  chooseNewsletterList,
  collectListJoinTallies,
  countJoinsSince,
  fetchListProfileCount,
  getAllPages,
  klaviyoRequest,
  resolveNewsletterList
};
