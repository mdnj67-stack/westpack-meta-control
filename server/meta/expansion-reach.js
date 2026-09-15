const { ensureAccountId, graphRequest, isRateLimitMessage } = require("../lib/meta");

// The expansion reach series: how many people the incremental campaigns reached
// for the FIRST time each month, which is the number an expansion strategy is
// actually buying and the one Meta has no field for.
//
// Reach is a count of distinct people, so it cannot be summed. Monthly reach
// cannot answer the question either - someone reached in June and again in July
// counts in both months. The only route is the cumulative curve: unique reach
// from a fixed anchor to each month end, differenced. Each point on that curve
// costs its own Graph call, which is why this runs as a nightly job against a
// stored snapshot rather than on a dashboard request.
//
// The anchor is deliberately NOT the rolling window start. Anchoring to the
// first month the incremental set delivered keeps every completed month's
// cumulative figure fixed, so a nightly run only has to refresh the month in
// progress: about four calls instead of seventeen. A rolling anchor would move
// every month and force a full recompute each time.

const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 24;
const ACCOUNT_TIME_ZONE = "America/Los_Angeles";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayInAccountTimeZone(timeZone = ACCOUNT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// Month boundaries are resolved in the ad account's own timezone. Meta draws
// this account's days about nine hours behind Copenhagen, so a window built from
// the local clock is off by a day at both edges.
function buildMonths(today, monthCount) {
  const [year, month] = today.split("-").map(Number);
  const months = [];
  for (let offset = monthCount; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = `${key}-${String(lastDay).padStart(2, "0")}`;
    months.push({
      key,
      since: `${key}-01`,
      until: last > today ? today : last,
      partial: last > today
    });
  }
  return months;
}

function createGraphReader(accountId, accessToken) {
  const state = { calls: 0 };

  // Rate limits are never retried. graphRequest defaults to five retries, which
  // would spend five calls' worth of quota per failure against a limit Meta
  // measures in minutes to an hour - and this job runs unattended overnight.
  async function get(pathname, params, label) {
    state.calls += 1;
    try {
      return await graphRequest(pathname, accessToken, { params, maxRetries: 0 });
    } catch (error) {
      if (isRateLimitMessage(error.message)) {
        throw new Error(`Meta rate limit reached after ${state.calls} calls (${label}).`);
      }
      throw error;
    }
  }

  async function getAll(pathname, params, label, maxPages = 6) {
    const rows = [];
    let payload = await get(pathname, params, label);
    rows.push(...(payload.data || []));
    let page = 1;
    while (payload?.paging?.next && page < maxPages) {
      page += 1;
      state.calls += 1;
      const response = await fetch(payload.paging.next);
      const body = await response.json();
      if (body?.error) {
        const message = body.error.message || "";
        throw new Error(isRateLimitMessage(message)
          ? `Meta rate limit reached while paging ${label}.`
          : `${label}: ${message}`);
      }
      rows.push(...(body.data || []));
      payload = body;
    }
    return rows;
  }

  return { get, getAll, state, accountId };
}

// Which campaigns are on incrementality attribution comes from Meta's own
// attribution_setting, never from the campaign name. Asking for the field
// returns a row for every campaign that ever existed, because it is
// configuration rather than a result, so rows with no delivery are dropped.
async function readIncrementalCampaigns(reader, window) {
  const rows = await reader.getAll(`/${reader.accountId}/insights`, {
    level: "campaign",
    time_range: JSON.stringify(window),
    limit: "500",
    fields: "campaign_id,campaign_name,attribution_setting,spend,impressions,reach"
  }, "campaign attribution", 4);

  return rows
    .filter((row) => row.attribution_setting === "incrementality")
    .filter((row) => number(row.spend) > 0 || number(row.impressions) > 0)
    .map((row) => ({
      id: String(row.campaign_id),
      name: String(row.campaign_name || ""),
      spend: number(row.spend),
      // Named "delivered" as a warning: this is one campaign's own deduplicated
      // reach and must never be added to its siblings'.
      deliveredReach: number(row.reach)
    }))
    .sort((a, b) => b.spend - a.spend);
}

function campaignFilter(campaignIds) {
  return JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]);
}

async function readMonthlyReach(reader, window, campaignIds) {
  const rows = await reader.getAll(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify(window),
    time_increment: "monthly",
    filtering: campaignFilter(campaignIds),
    limit: "50",
    fields: "date_start,date_stop,reach,impressions,frequency,spend"
  }, "monthly reach", 2);

  return Object.fromEntries(rows.map((row) => [String(row.date_start).slice(0, 7), row]));
}

async function readCumulativeReach(reader, anchor, until, campaignIds) {
  const payload = await reader.get(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify({ since: anchor, until }),
    filtering: campaignFilter(campaignIds),
    limit: "1",
    fields: "reach,impressions,spend"
  }, `cumulative to ${until}`);
  const row = (payload.data || [])[0] || {};
  return number(row.reach);
}

// A stored month can be reused only when it was measured from the same anchor
// and over the same campaign set. Adding a campaign changes every cumulative
// figure on the curve, so the whole series has to be re-measured.
function reusableCumulative(previous, anchor, campaignKey) {
  if (!previous || previous.anchor !== anchor || previous.campaignKey !== campaignKey) {
    return new Map();
  }
  const entries = (previous.months || [])
    .filter((month) => !month.partial && number(month.cumulativeReach) > 0)
    .map((month) => [month.month, number(month.cumulativeReach)]);
  return new Map(entries);
}

async function syncExpansionReach({
  accountId,
  accessToken,
  previous = null,
  months = DEFAULT_MONTHS,
  force = false
} = {}) {
  const normalizedAccountId = ensureAccountId(accountId);
  const monthCount = Math.max(1, Math.min(MAX_MONTHS, Number(months) || DEFAULT_MONTHS));
  const reader = createGraphReader(normalizedAccountId, accessToken);

  const today = todayInAccountTimeZone();
  const monthList = buildMonths(today, monthCount);
  const window = { since: monthList[0].since, until: monthList[monthList.length - 1].until };

  const campaigns = await readIncrementalCampaigns(reader, window);
  if (!campaigns.length) {
    return {
      generatedAt: new Date().toISOString(),
      accountId: normalizedAccountId,
      timezone: ACCOUNT_TIME_ZONE,
      window,
      anchor: null,
      available: false,
      unavailableReason: "No campaign on this account reported incrementality attribution in the window.",
      months: [],
      campaigns: [],
      graphCalls: reader.state.calls
    };
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const campaignKey = campaignIds.slice().sort().join(",");
  const monthlyByKey = await readMonthlyReach(reader, window, campaignIds);

  // The anchor is the first month in the window that actually delivered. It
  // stays put as long as the programme's first month remains inside the window,
  // which is what makes the nightly refresh cheap.
  const firstDelivering = monthList.find((month) => number(monthlyByKey[month.key]?.reach) > 0);
  const anchor = firstDelivering ? firstDelivering.since : window.since;
  const activeMonths = monthList.filter((month) => month.since >= anchor);

  const cached = force ? new Map() : reusableCumulative(previous, anchor, campaignKey);

  const rows = [];
  let previousCumulative = 0;
  for (const month of activeMonths) {
    const cachedCumulative = cached.get(month.key);
    const cumulativeReach = cachedCumulative !== undefined
      ? cachedCumulative
      : await readCumulativeReach(reader, anchor, month.until, campaignIds);

    const monthRow = monthlyByKey[month.key] || null;
    const monthlyReach = number(monthRow?.reach);
    const netNewReach = cumulativeReach > 0 ? cumulativeReach - previousCumulative : 0;
    if (cumulativeReach > 0) previousCumulative = cumulativeReach;
    const spend = number(monthRow?.spend);

    rows.push({
      month: month.key,
      since: month.since,
      until: month.until,
      partial: month.partial,
      fromCache: cachedCumulative !== undefined,
      monthlyReach,
      cumulativeReach,
      netNewReach,
      // Never below zero: Meta can restate a cumulative window by a fraction,
      // and a negative "repeat" would be an artefact rather than a fact.
      repeatReach: Math.max(0, monthlyReach - netNewReach),
      repeatShare: monthlyReach > 0 ? Math.max(0, monthlyReach - netNewReach) / monthlyReach : null,
      spend,
      frequency: number(monthRow?.frequency),
      costPerThousandNewlyReached: netNewReach > 0 ? (spend / netNewReach) * 1000 : null
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    accountId: normalizedAccountId,
    timezone: ACCOUNT_TIME_ZONE,
    window,
    anchor,
    campaignKey,
    available: rows.some((row) => row.monthlyReach > 0),
    months: rows,
    campaigns,
    campaignCount: campaigns.length,
    graphCalls: reader.state.calls,
    notes: [
      "Reach is read at account level, filtered to the incremental campaigns. It is never summed across campaigns.",
      "Net-new reach is the rise in cumulative unique reach since the anchor month, so it counts people reached for the first time since the programme began.",
      "The incrementality set is a segment of the account, not a measured uplift."
    ]
  };
}

module.exports = {
  syncExpansionReach,
  buildMonths,
  todayInAccountTimeZone,
  reusableCumulative,
  DEFAULT_MONTHS,
  MAX_MONTHS
};
