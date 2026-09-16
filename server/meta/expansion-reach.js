const { ensureAccountId, graphRequest, isRateLimitMessage } = require("../lib/meta");
const {
  PURCHASE_ACTION_TYPES,
  firstActionValue,
  resolveCustomerConversionActionTypes,
  sumActionTypes
} = require("./customer-acquisition");

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
// progress: a handful of calls instead of the whole curve. A rolling anchor
// would move every month and force a full recompute each time.
//
// Four things this module reports that the bare curve does not:
//
//  - A market split, from Meta's own country breakdown. Country reach is
//    deduplicated inside each country, so it answers "how many distinct people
//    in Italy", but countries must never be added up: a person reached in two
//    of them appears in both. The account-level figure stays authoritative and
//    the gap between it and the country sum is reported as overlap.
//  - A like-for-like comparison. The month in progress is a part month, and
//    setting it against a complete previous month is the trap this dashboard
//    already avoids for new customers. The previous month is therefore measured
//    again over the same elapsed days.
//  - New customers beside the newly reached, because that is what the
//    department is measured on. It is a ratio of two monthly figures, not a
//    cohort: the customers counted in a month are not necessarily the people
//    first reached in it.
//  - A restatement log. The campaign set comes from Meta's current
//    attribution_setting over a rolling window, so the set can change under the
//    series and rewrite every completed month. A silently rewritten past is
//    worse than a rewritten one that says so.

const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 24;
const ACCOUNT_TIME_ZONE = "America/Los_Angeles";
const RESTATEMENT_LOG_LIMIT = 60;

// The country sum runs a few percent above the deduplicated account figure
// because some people are reached in more than one country. Past this the gap
// is large enough to name on screen rather than treat as noise.
const MARKET_OVERLAP_NOTICE_SHARE = 0.05;

// A return on spend needs spend to divide by. Meta placed 0,33 kr. of delivery
// in no country at all and attributed 7.482 kr. of revenue to it, which is a
// ROAS of 22.670 and, sorted by return, the best market on the account. One
// unit of the account currency is the smallest denominator that means anything;
// below it the ratio is reported as unmeasurable rather than as a triumph.
const MINIMUM_ROAS_SPEND = 1;

// A breakdown may never quietly stand in for the total it breaks down. The
// ad-level read is reconciled against the market figure it claims to explain,
// and anything further apart than this is named on screen with the amount it
// cannot account for. Same tolerance the ad-set reconciliation uses.
const AD_RECONCILIATION_TOLERANCE = 0.01;

function roasFrom(revenue, spend) {
  return number(spend) >= MINIMUM_ROAS_SPEND ? round(number(revenue) / number(spend), 3) : null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function todayInAccountTimeZone(timeZone = ACCOUNT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// Meta reports delivery it could not place under the country code UNKNOWN. It
// is not a market and must never read as one, but it is not dropped either: it
// is real spend, and unplaced spend has to stay visible the same way unmapped
// objective spend does.
const UNATTRIBUTED_COUNTRY_CODES = new Set(["UNKNOWN", "XX", ""]);

function countryLabel(code) {
  if (UNATTRIBUTED_COUNTRY_CODES.has(String(code).toUpperCase())) {
    return "Unattributed delivery";
  }
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch (error) {
    return code;
  }
}

function daysBetween(since, until) {
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
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

// The same elapsed stretch of the previous month. February cannot answer for a
// 31st, so the date is clamped to that month's last day and the clamp is
// reported rather than hidden: a 28-day window against a 31-day one is a
// different comparison and the caption has to say so.
function previousMonthElapsedWindow(month) {
  const [year, index] = String(month.key).split("-").map(Number);
  const elapsedDays = Number(String(month.until).slice(8, 10));
  const previousYear = index === 1 ? year - 1 : year;
  const previousIndex = index === 1 ? 12 : index - 1;
  const previousKey = `${previousYear}-${String(previousIndex).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(previousYear, previousIndex, 0)).getUTCDate();
  const day = Math.min(elapsedDays, lastDay);
  return {
    month: previousKey,
    since: `${previousKey}-01`,
    until: `${previousKey}-${String(day).padStart(2, "0")}`,
    elapsedDays: day,
    requestedDays: elapsedDays,
    clamped: day !== elapsedDays
  };
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

// New customers are resolved by the custom conversion's NAME, through the same
// module the rest of the dashboard uses, never by a hardcoded id. An account
// without the conversion reports that it cannot count new customers, rather
// than reporting zero of them.
async function readCustomerConversionTypes(reader) {
  try {
    const rows = await reader.getAll(`/${reader.accountId}/customconversions`, {
      fields: "id,name,custom_event_type,is_archived",
      limit: "100"
    }, "custom conversions", 2);
    return resolveCustomerConversionActionTypes(rows);
  } catch (error) {
    // This series is about reach. Losing the customer column is worth reporting,
    // but it must not cost the whole snapshot.
    return {
      newCustomerActionTypes: [],
      existingCustomerActionTypes: [],
      resolved: { new: [], existing: [] },
      available: false,
      error: error.message
    };
  }
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

function newCustomersFrom(row, actionTypes) {
  const types = actionTypes?.newCustomerActionTypes || [];
  if (!types.length) return null;
  return sumActionTypes(row?.actions || [], types);
}

// Meta reports the same purchase money under several action types at once - on
// every country row measured here, purchase, fb_pixel_purchase and
// omni_purchase all carried the identical value. The first match is the money;
// the sum would be three times it.
function revenueFrom(row) {
  return firstActionValue(row?.action_values || [], PURCHASE_ACTION_TYPES);
}

function newCustomerRevenueFrom(row, actionTypes) {
  const types = actionTypes?.newCustomerActionTypes || [];
  if (!types.length) return null;
  return sumActionTypes(row?.action_values || [], types);
}

async function readMonthlyRows(reader, window, campaignIds, actionTypes) {
  const rows = await reader.getAll(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify(window),
    time_increment: "monthly",
    filtering: campaignFilter(campaignIds),
    limit: "50",
    fields: "date_start,date_stop,reach,impressions,frequency,spend,actions,action_values"
  }, "monthly reach", 2);

  return Object.fromEntries(rows.map((row) => [String(row.date_start).slice(0, 7), {
    reach: number(row.reach),
    impressions: number(row.impressions),
    frequency: number(row.frequency),
    spend: number(row.spend),
    newCustomers: newCustomersFrom(row, actionTypes),
    revenue: revenueFrom(row),
    newCustomerRevenue: newCustomerRevenueFrom(row, actionTypes)
  }]));
}

// The market split. One call returns every country for every month, so the
// breakdown costs the same as the unbroken series rather than one call per
// market. Countries are reported, never summed: the account-level row is the
// only figure that speaks for the whole set.
async function readMonthlyCountryRows(reader, window, campaignIds, actionTypes) {
  const rows = await reader.getAll(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify(window),
    time_increment: "monthly",
    breakdowns: "country",
    filtering: campaignFilter(campaignIds),
    limit: "500",
    // The breakdown key comes back on its own. Asking for `country` in fields
    // is rejected outright by Graph v25 - the field list describes metrics, and
    // the breakdown describes how they are cut.
    fields: "date_start,date_stop,reach,impressions,frequency,spend,actions,action_values"
  }, "monthly reach by country", 4);

  const byMonth = {};
  for (const row of rows) {
    const month = String(row.date_start).slice(0, 7);
    const code = String(row.country || "").trim().toUpperCase();
    if (!code) continue;
    if (!byMonth[month]) byMonth[month] = {};
    byMonth[month][code] = {
      reach: number(row.reach),
      impressions: number(row.impressions),
      frequency: number(row.frequency),
      spend: number(row.spend),
      newCustomers: newCustomersFrom(row, actionTypes),
      revenue: revenueFrom(row),
      newCustomerRevenue: newCustomerRevenueFrom(row, actionTypes)
    };
  }
  return byMonth;
}

async function readCumulativePoint(reader, anchor, until, campaignIds, label) {
  const payload = await reader.get(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify({ since: anchor, until }),
    filtering: campaignFilter(campaignIds),
    limit: "1",
    fields: "reach,impressions,spend"
  }, label || `cumulative to ${until}`);
  const row = (payload.data || [])[0] || {};
  return { reach: number(row.reach), spend: number(row.spend) };
}

// One plain window, read directly rather than differenced. Spend and new
// customers over an arbitrary stretch of days are just that stretch's figures,
// so there is no reason to derive them from two cumulative reads - and deriving
// new customers that way would have meant carrying actions on every cached
// cumulative point, which would have re-measured the whole curve to add them.
// Reach is the exception and is not taken from here: the month's own reach is
// not the same thing as the people it reached for the first time.
async function readWindowTotals(reader, since, until, campaignIds, actionTypes, label) {
  const payload = await reader.get(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify({ since, until }),
    filtering: campaignFilter(campaignIds),
    limit: "1",
    fields: "spend,impressions,actions"
  }, label || `window ${since} to ${until}`);
  const row = (payload.data || [])[0] || {};
  return {
    since,
    until,
    spend: number(row.spend),
    newCustomers: newCustomersFrom(row, actionTypes)
  };
}

// What actually created the value in a country, which a market total cannot
// answer: the ads themselves, read one country at a time. Rows are ad x country
// over a single window - 1.293 of them across 50 ads and 44 countries on this
// account, three pages - so the whole drill-down costs a handful of calls once
// a night rather than one per market.
//
// Reach here is each ad's own deduplicated figure inside that country and is
// named deliveredReach as a warning: adding it across ads counts the same
// person once per ad they saw. Purchases and revenue are events and do add up.
async function readAdBreakdown(reader, since, until, campaignIds, actionTypes) {
  const rows = await reader.getAll(`/${reader.accountId}/insights`, {
    level: "ad",
    time_range: JSON.stringify({ since, until }),
    breakdowns: "country",
    filtering: campaignFilter(campaignIds),
    limit: "500",
    fields: "ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,frequency,actions,action_values"
  }, "ads by country", 8);

  return rows
    .map((row) => {
      const spend = number(row.spend);
      const impressions = number(row.impressions);
      const revenue = revenueFrom(row);
      const purchases = firstActionValue(row.actions || [], PURCHASE_ACTION_TYPES);
      const newCustomers = newCustomersFrom(row, actionTypes);
      return {
        adId: String(row.ad_id || ""),
        adName: String(row.ad_name || ""),
        adSetName: String(row.adset_name || ""),
        campaignName: String(row.campaign_name || ""),
        country: String(row.country || "").trim().toUpperCase(),
        spend,
        impressions,
        // Never "reach": this is one ad's own deduplicated count inside one
        // country and must not be added to its siblings'.
        deliveredReach: number(row.reach),
        frequency: number(row.frequency),
        purchases,
        revenue,
        newCustomers,
        newCustomerRevenue: newCustomerRevenueFrom(row, actionTypes),
        roas: roasFrom(revenue, spend),
        costPerPurchase: purchases > 0 ? round(spend / purchases, 2) : null,
        cpm: impressions > 0 ? round((spend / impressions) * 1000, 2) : null
      };
    })
    .filter((row) => row.country && (row.impressions > 0 || row.spend > 0));
}

// Thumbnails are requested by id for the ads that actually delivered, rather
// than by listing the account: asking for every ad it has ever had is refused
// outright for being too much data. A failure here costs the pictures and
// nothing else, so it never fails the snapshot.
async function readAdThumbnails(reader, adIds) {
  const unique = [...new Set(adIds)].filter(Boolean);
  const thumbnails = {};
  for (let index = 0; index < unique.length; index += 50) {
    const chunk = unique.slice(index, index + 50);
    try {
      const payload = await reader.get("", {
        ids: chunk.join(","),
        fields: "name,effective_status,creative{thumbnail_url}"
      }, "ad thumbnails");
      for (const [id, ad] of Object.entries(payload || {})) {
        if (!ad || typeof ad !== "object") continue;
        thumbnails[id] = {
          thumbnailUrl: ad.creative?.thumbnail_url || "",
          status: String(ad.effective_status || "")
        };
      }
    } catch (error) {
      return thumbnails;
    }
  }
  return thumbnails;
}


async function readCumulativeCountries(reader, anchor, until, campaignIds, label) {
  const rows = await reader.getAll(`/${reader.accountId}/insights`, {
    level: "account",
    time_range: JSON.stringify({ since: anchor, until }),
    breakdowns: "country",
    filtering: campaignFilter(campaignIds),
    limit: "500",
    fields: "reach,impressions,spend"
  }, label || `cumulative by country to ${until}`, 3);

  const byCountry = {};
  for (const row of rows) {
    const code = String(row.country || "").trim().toUpperCase();
    if (!code) continue;
    byCountry[code] = { reach: number(row.reach), spend: number(row.spend) };
  }
  return byCountry;
}

// A stored month can be reused only when it was measured from the same anchor
// and over the same campaign set. Adding a campaign changes every cumulative
// figure on the curve, so the whole series has to be re-measured. A month
// missing its country map is not reusable either: a half-cached month would
// draw its total from one measurement and its markets from another.
function reusableCumulative(previous, anchor, campaignKey) {
  if (!previous || previous.anchor !== anchor || previous.campaignKey !== campaignKey) {
    return new Map();
  }
  const entries = (previous.months || [])
    .filter((month) => !month.partial && number(month.cumulativeReach) > 0)
    .filter((month) => month.cumulativeByCountry && typeof month.cumulativeByCountry === "object")
    .map((month) => [month.month, {
      reach: number(month.cumulativeReach),
      spend: number(month.cumulativeSpend),
      byCountry: month.cumulativeByCountry
    }]);
  return new Map(entries);
}

// The like-for-like point is a completed stretch of a closed month, so once
// measured it never moves. It is cached against the same anchor and campaign
// set as the curve itself.
function reusableLikeForLike(previous, anchor, campaignKey, until) {
  if (!previous || previous.anchor !== anchor || previous.campaignKey !== campaignKey) return null;
  const stored = previous.likeForLike;
  if (!stored || stored.until !== until) return null;
  if (!(number(stored.cumulativeReach) > 0) || !stored.cumulativeByCountry) return null;
  // The window totals arrived after the cumulative point did. A stored window
  // without them is measured again rather than reported as a window with no
  // customers in it.
  if (!stored.windowTotals) return null;
  return {
    reach: number(stored.cumulativeReach),
    spend: number(stored.cumulativeSpend),
    byCountry: stored.cumulativeByCountry,
    windowTotals: stored.windowTotals
  };
}

function describeSetChange(previous, anchor, campaignKey, campaigns) {
  if (!previous) return "";
  if (previous.anchor !== anchor) {
    const before = String(previous.anchor || "none").slice(0, 7);
    return `The anchor month moved from ${before} to ${String(anchor).slice(0, 7)}, so first-time reach is now counted from a different starting point.`;
  }
  if (previous.campaignKey !== campaignKey) {
    const before = new Set(String(previous.campaignKey || "").split(",").filter(Boolean));
    const after = new Set(campaignKey.split(",").filter(Boolean));
    const nameById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
    const added = [...after].filter((id) => !before.has(id)).map((id) => nameById.get(id) || id);
    const removed = [...before].filter((id) => !after.has(id));
    const parts = [];
    if (added.length) {
      const names = added.slice(0, 3).join(", ");
      parts.push(`${added.length} campaign${added.length === 1 ? "" : "s"} joined the incremental set (${names}${added.length > 3 ? ", ..." : ""})`);
    }
    if (removed.length) parts.push(`${removed.length} left it`);
    return parts.length
      ? `${parts.join(" and ")}, so the whole curve was measured again.`
      : "The incremental campaign set changed, so the whole curve was measured again.";
  }
  return "";
}

// Every completed month whose figure moved between two runs is recorded with
// both values. The set behind this series comes from Meta's current
// attribution_setting, so it can change under the history without anyone asking
// for it.
function collectRestatements(previous, rows, reason) {
  const carried = Array.isArray(previous?.restatements) ? previous.restatements : [];
  if (!previous || !Array.isArray(previous.months) || !previous.months.length) return carried;

  const observedAt = new Date().toISOString();
  const before = new Map(previous.months.map((month) => [month.month, month]));
  const added = [];

  for (const row of rows) {
    if (row.partial) continue;
    const old = before.get(row.month);
    if (!old || old.partial) continue;
    const from = number(old.netNewReach);
    const to = number(row.netNewReach);
    if (from === to) continue;
    added.push({
      month: row.month,
      metric: "netNewReach",
      from,
      to,
      delta: to - from,
      deltaShare: from > 0 ? round((to - from) / from, 4) : null,
      observedAt,
      reason: reason || "The measurement behind this month changed."
    });
  }

  return [...added, ...carried].slice(0, RESTATEMENT_LOG_LIMIT);
}

function buildMarketRow({ code, monthly, cumulative, previousCumulative }) {
  const monthlyReach = number(monthly?.reach);
  const rawNetNew = number(cumulative) - number(previousCumulative);
  const netNewReach = Math.max(0, rawNetNew);
  const spend = number(monthly?.spend);
  const newCustomers = monthly?.newCustomers == null ? null : number(monthly.newCustomers);
  const repeatReach = Math.max(0, monthlyReach - netNewReach);
  const impressions = number(monthly?.impressions);
  const revenue = number(monthly?.revenue);
  const newCustomerRevenue = monthly?.newCustomerRevenue == null ? null : number(monthly.newCustomerRevenue);
  return {
    code,
    label: countryLabel(code),
    monthlyReach,
    cumulativeReach: number(cumulative),
    netNewReach,
    restated: rawNetNew < 0,
    repeatReach,
    repeatShare: monthlyReach > 0 ? round(repeatReach / monthlyReach, 4) : null,
    spend,
    impressions,
    frequency: number(monthly?.frequency),
    newCustomers,
    // Revenue is Meta's reported purchase value on standard attribution. It is
    // what this market returned, not what it returned because of this campaign
    // set - the set is a grouping, not a measured uplift.
    revenue,
    newCustomerRevenue,
    roas: roasFrom(revenue, spend),
    cpm: impressions > 0 ? round((spend / impressions) * 1000, 2) : null,
    costPerThousandNewlyReached: netNewReach > 0 ? round((spend / netNewReach) * 1000, 2) : null,
    costPerNewCustomer: newCustomers > 0 ? round(spend / newCustomers, 2) : null,
    newCustomersPerThousandNewlyReached: newCustomers != null && netNewReach > 0
      ? round((newCustomers / netNewReach) * 1000, 3)
      : null
  };
}

// The windows the table can be read over. A single part month is a thin basis
// for moving budget - Denmark had five customers in it - so the same market is
// also aggregated over the last three months and over everything since the
// anchor. Spend, customers and revenue add up across months; reach does not,
// so net-new over a window is the rise in that market's cumulative curve across
// it, which is the only figure here that cannot be summed.
function buildMarketWindow({ code, months, from, to }) {
  const slice = months.slice(from, to + 1);
  if (!slice.length) return null;

  const spend = slice.reduce((total, month) => total + number(month.spend), 0);
  const revenue = slice.reduce((total, month) => total + number(month.revenue), 0);
  const impressions = slice.reduce((total, month) => total + number(month.impressions), 0);
  const anyCustomers = slice.some((month) => month.newCustomers != null);
  const newCustomers = anyCustomers
    ? slice.reduce((total, month) => total + (month.newCustomers == null ? 0 : number(month.newCustomers)), 0)
    : null;

  const before = from > 0 ? number(months[from - 1]?.cumulativeReach) : 0;
  const last = slice[slice.length - 1];
  const netNewReach = Math.max(0, number(last?.cumulativeReach) - before);
  const days = slice.reduce((total, month) => total + number(month.days), 0);

  return {
    code,
    from: slice[0].month,
    to: last.month,
    // Named for what it is, and never "months": a window is spread over a
    // market that has its own months series, and a count under the same name
    // silently replaced the series when the two were merged.
    monthCount: slice.length,
    days,
    partial: slice.some((month) => month.partial),
    netNewReach,
    cumulativeReach: number(last?.cumulativeReach),
    spend: round(spend, 2),
    revenue: round(revenue, 2),
    impressions,
    newCustomers,
    roas: roasFrom(revenue, spend),
    cpm: impressions > 0 ? round((spend / impressions) * 1000, 2) : null,
    costPerThousandNewlyReached: netNewReach > 0 ? round((spend / netNewReach) * 1000, 2) : null,
    costPerNewCustomer: newCustomers > 0 ? round(spend / newCustomers, 2) : null,
    // Frequency and repeat share cannot be added across months either - both are
    // ratios over a reach figure that deduplicates inside its own window - so
    // over a multi-month window they are reported from its last month and named
    // that way rather than averaged into something Meta never measured.
    latestFrequency: number(last?.frequency),
    latestRepeatShare: last?.repeatShare == null ? null : number(last.repeatShare)
  };
}

// The market series is pivoted here rather than in the browser, so the page only
// ever renders figures the server computed once.
function buildMarketSeries(rows) {
  const codes = new Set();
  for (const row of rows) {
    for (const code of Object.keys(row.marketsByCode || {})) codes.add(code);
  }

  const lastIndex = rows.length - 1;
  const threeFrom = Math.max(0, rows.length - 3);

  return [...codes]
    .map((code) => {
      const months = rows.map((row) => {
        const market = (row.marketsByCode || {})[code] || null;
        return {
          month: row.month,
          partial: row.partial,
          days: row.days,
          monthlyReach: market ? market.monthlyReach : 0,
          netNewReach: market ? market.netNewReach : 0,
          repeatReach: market ? market.repeatReach : 0,
          repeatShare: market ? market.repeatShare : null,
          cumulativeReach: market ? market.cumulativeReach : 0,
          spend: market ? market.spend : 0,
          impressions: market ? market.impressions : 0,
          frequency: market ? market.frequency : 0,
          newCustomers: market ? market.newCustomers : null,
          revenue: market ? market.revenue : 0,
          newCustomerRevenue: market ? market.newCustomerRevenue : null,
          roas: market ? market.roas : null,
          cpm: market ? market.cpm : null,
          costPerThousandNewlyReached: market ? market.costPerThousandNewlyReached : null,
          costPerNewCustomer: market ? market.costPerNewCustomer : null,
          newCustomersPerThousandNewlyReached: market ? market.newCustomersPerThousandNewlyReached : null
        };
      });

      const delivering = months.filter((month) => month.monthlyReach > 0);
      const latest = delivering[delivering.length - 1] || null;

      // Three windows over the same market, so a budget decision is not forced
      // to rest on whatever fraction of a month has elapsed today.
      const windows = {
        current: buildMarketWindow({ code, months, from: lastIndex, to: lastIndex }),
        quarter: buildMarketWindow({ code, months, from: threeFrom, to: lastIndex }),
        all: buildMarketWindow({ code, months, from: 0, to: lastIndex })
      };

      return {
        code,
        label: countryLabel(code),
        months,
        windows,
        firstMonth: delivering[0]?.month || null,
        deliveringMonths: delivering.length,
        // Measured, not accumulated from the monthly rows, so this is the
        // country's own deduplicated total since the anchor.
        cumulativeReach: latest ? latest.cumulativeReach : 0,
        latestMonth: latest?.month || null,
        latestNetNewReach: latest ? latest.netNewReach : 0,
        latestRepeatShare: latest ? latest.repeatShare : null,
        latestFrequency: latest ? latest.frequency : 0,
        latestSpend: latest ? latest.spend : 0,
        latestNewCustomers: latest ? latest.newCustomers : null,
        latestCostPerThousandNewlyReached: latest ? latest.costPerThousandNewlyReached : null,
        latestNewCustomersPerThousandNewlyReached: latest ? latest.newCustomersPerThousandNewlyReached : null,
        spend: round(windows.all?.spend, 2),
        revenue: round(windows.all?.revenue, 2),
        newCustomers: windows.all ? windows.all.newCustomers : null
      };
    })
    .filter((market) => market.cumulativeReach > 0 || market.spend > 0)
    .sort((left, right) => right.cumulativeReach - left.cumulativeReach);
}

// The month in progress is a part month. Comparing it against a complete
// previous month is the trap this dashboard already avoids for new customers,
// so the previous month is measured again over the same elapsed days.
// Cumulative spend comes back on the same call, which makes the cost per
// thousand comparable too: both sides then cover the same number of days.
async function buildLikeForLike({ reader, rows, anchor, campaignIds, campaignKey, actionTypes, previous, force }) {
  const latest = rows[rows.length - 1];
  if (!latest || !latest.partial) return null;

  const priorIndex = rows.length - 2;
  const prior = priorIndex >= 0 ? rows[priorIndex] : null;
  const baseline = priorIndex - 1 >= 0 ? rows[priorIndex - 1] : null;
  if (!prior) return null;

  const window = previousMonthElapsedWindow({ key: latest.month, until: latest.until });
  if (window.month !== prior.month) return null;

  const cachedPoint = force ? null : reusableLikeForLike(previous, anchor, campaignKey, window.until);
  const point = cachedPoint || {
    ...(await readCumulativePoint(reader, anchor, window.until, campaignIds, `like-for-like to ${window.until}`)),
    byCountry: await readCumulativeCountries(reader, anchor, window.until, campaignIds, `like-for-like by country to ${window.until}`),
    windowTotals: await readWindowTotals(
      reader,
      window.since,
      window.until,
      campaignIds,
      actionTypes,
      `like-for-like window ${window.since} to ${window.until}`
    )
  };

  const baseCumulative = baseline ? number(baseline.cumulativeReach) : 0;
  const baseByCountry = baseline ? (baseline.cumulativeByCountry || {}) : {};

  const netNewReach = Math.max(0, number(point.reach) - baseCumulative);
  // Spend and customers come from the window itself rather than from the
  // difference of two cumulative reads, which is both simpler and one fewer
  // place for a restatement to leak in.
  const spend = number(point.windowTotals?.spend);
  const windowNewCustomers = point.windowTotals?.newCustomers;
  const newCustomers = windowNewCustomers == null ? null : number(windowNewCustomers);

  const markets = {};
  for (const code of Object.keys(point.byCountry || {})) {
    const value = Math.max(0, number(point.byCountry[code]?.reach) - number(baseByCountry[code]?.reach));
    markets[code] = { netNewReach: value };
  }

  const change = netNewReach > 0 ? round((latest.netNewReach - netNewReach) / netNewReach, 4) : null;
  const latestNewCustomers = latest.newCustomers == null ? null : number(latest.newCustomers);
  // A baseline of zero customers has no rate of change, and neither has a month
  // where customers could not be counted at all. Both report no comparison
  // rather than an infinity or a flat nothing.
  const customersComparable = newCustomers != null && latestNewCustomers != null && newCustomers > 0;

  return {
    month: window.month,
    since: window.since,
    until: window.until,
    elapsedDays: window.elapsedDays,
    clamped: window.clamped,
    requestedDays: window.requestedDays,
    fromCache: Boolean(cachedPoint),
    cumulativeReach: number(point.reach),
    cumulativeSpend: round(point.spend, 2),
    cumulativeByCountry: point.byCountry || {},
    windowTotals: point.windowTotals || null,
    netNewReach,
    spend: round(spend, 2),
    newCustomers,
    costPerThousandNewlyReached: netNewReach > 0 ? round((spend / netNewReach) * 1000, 2) : null,
    costPerNewCustomer: newCustomers > 0 ? round(spend / newCustomers, 2) : null,
    markets,
    comparison: {
      month: latest.month,
      elapsedDays: latest.days,
      netNewReach: latest.netNewReach,
      spend: latest.spend,
      costPerThousandNewlyReached: latest.costPerThousandNewlyReached,
      newCustomers: latestNewCustomers,
      costPerNewCustomer: latest.costPerNewCustomer,
      change,
      newCustomersChange: customersComparable
        ? round((latestNewCustomers - newCustomers) / newCustomers, 4)
        : null,
      customersComparable,
      // A market with no delivery at all in the baseline window has no honest
      // percentage: "up from nothing" is not a rate of change. The UI names it
      // as a new market instead of printing an infinity.
      comparable: netNewReach > 0
    }
  };
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
      today,
      window,
      anchor: null,
      available: false,
      unavailableReason: "No campaign on this account reported incrementality attribution in the window.",
      months: [],
      marketSeries: [],
      marketCount: 0,
      likeForLike: null,
      restatements: Array.isArray(previous?.restatements) ? previous.restatements : [],
      campaigns: [],
      campaignCount: 0,
      graphCalls: reader.state.calls
    };
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const campaignKey = campaignIds.slice().sort().join(",");
  const actionTypes = await readCustomerConversionTypes(reader);
  const monthlyByKey = await readMonthlyRows(reader, window, campaignIds, actionTypes);
  const monthlyCountryByKey = await readMonthlyCountryRows(reader, window, campaignIds, actionTypes);

  // The anchor is the first month in the window that actually delivered. It
  // stays put as long as the programme's first month remains inside the window,
  // which is what makes the nightly refresh cheap.
  const firstDelivering = monthList.find((month) => number(monthlyByKey[month.key]?.reach) > 0);
  const anchor = firstDelivering ? firstDelivering.since : window.since;
  const activeMonths = monthList.filter((month) => month.since >= anchor);

  const cached = force ? new Map() : reusableCumulative(previous, anchor, campaignKey);
  const restatementReason = describeSetChange(previous, anchor, campaignKey, campaigns);

  const rows = [];
  let previousCumulative = 0;
  let previousCumulativeByCountry = {};

  for (const month of activeMonths) {
    const cachedPoint = cached.get(month.key);
    const point = cachedPoint || {
      ...(await readCumulativePoint(reader, anchor, month.until, campaignIds)),
      byCountry: await readCumulativeCountries(reader, anchor, month.until, campaignIds)
    };

    const monthly = monthlyByKey[month.key] || null;
    const monthlyMarkets = monthlyCountryByKey[month.key] || {};
    const monthlyReach = number(monthly?.reach);
    const rawNetNew = number(point.reach) - previousCumulative;
    const netNewReach = number(point.reach) > 0 ? Math.max(0, rawNetNew) : 0;
    const spend = number(monthly?.spend);
    const newCustomers = monthly?.newCustomers == null ? null : number(monthly.newCustomers);
    const repeatReach = Math.max(0, monthlyReach - netNewReach);
    const monthlyImpressions = number(monthly?.impressions);
    const revenue = number(monthly?.revenue);

    const marketsByCode = {};
    const marketCodes = new Set([
      ...Object.keys(monthlyMarkets),
      ...Object.keys(point.byCountry || {})
    ]);
    for (const code of marketCodes) {
      marketsByCode[code] = buildMarketRow({
        code,
        monthly: monthlyMarkets[code],
        cumulative: (point.byCountry || {})[code]?.reach,
        previousCumulative: previousCumulativeByCountry[code]?.reach
      });
    }

    const marketReachSum = Object.values(marketsByCode)
      .reduce((total, market) => total + market.monthlyReach, 0);

    rows.push({
      month: month.key,
      since: month.since,
      until: month.until,
      days: daysBetween(month.since, month.until),
      partial: month.partial,
      fromCache: Boolean(cachedPoint),
      monthlyReach,
      impressions: number(monthly?.impressions),
      frequency: number(monthly?.frequency),
      cumulativeReach: number(point.reach),
      cumulativeSpend: round(point.spend, 2),
      cumulativeByCountry: point.byCountry || {},
      netNewReach,
      // Never below zero: Meta can restate a cumulative window by a fraction,
      // and a negative "first time" would be an artefact rather than a fact.
      // The flag keeps the artefact visible instead of swallowing it.
      cumulativeRestated: number(point.reach) > 0 && rawNetNew < 0,
      repeatReach,
      repeatShare: monthlyReach > 0 ? round(repeatReach / monthlyReach, 4) : null,
      spend,
      newCustomers,
      revenue,
      newCustomerRevenue: monthly?.newCustomerRevenue == null ? null : number(monthly.newCustomerRevenue),
      roas: roasFrom(revenue, spend),
      cpm: monthlyImpressions > 0 ? round((spend / monthlyImpressions) * 1000, 2) : null,
      costPerThousandNewlyReached: netNewReach > 0 ? round((spend / netNewReach) * 1000, 2) : null,
      costPerNewCustomer: newCustomers > 0 ? round(spend / newCustomers, 2) : null,
      newCustomersPerThousandNewlyReached: newCustomers != null && netNewReach > 0
        ? round((newCustomers / netNewReach) * 1000, 3)
        : null,
      marketsByCode,
      marketReachSum,
      // Countries overlap: a person reached in two of them counts in both, so
      // the sum runs above the deduplicated account figure. Reported, never
      // corrected for, and never used in place of the account figure.
      marketOverlapShare: monthlyReach > 0 ? round((marketReachSum - monthlyReach) / monthlyReach, 4) : null
    });

    if (number(point.reach) > 0) {
      previousCumulative = number(point.reach);
      previousCumulativeByCountry = point.byCountry || {};
    }
  }

  const likeForLike = await buildLikeForLike({
    reader,
    rows,
    anchor,
    campaignIds,
    campaignKey,
    actionTypes,
    previous,
    force
  });

  const marketSeries = buildMarketSeries(rows);
  const latest = rows[rows.length - 1] || null;
  const restatements = collectRestatements(previous, rows, restatementReason);

  // The ad-level drill-down covers the last three months, which is the same
  // stretch the markets table's middle window describes, so the two can be read
  // against each other without converting anything. One window rather than
  // three: this is the only read here that is per ad, and a creative decision
  // does not need the month in progress on its own.
  const adWindowRows = rows.slice(-3);
  const adWindow = adWindowRows.length
    ? { since: adWindowRows[0].since, until: adWindowRows[adWindowRows.length - 1].until }
    : null;
  let adBreakdown = null;
  if (adWindow) {
    const adRows = await readAdBreakdown(reader, adWindow.since, adWindow.until, campaignIds, actionTypes);
    const thumbnails = adRows.length
      ? await readAdThumbnails(reader, adRows.map((row) => row.adId))
      : {};
    // Meta reports spend for some campaigns at campaign level and attributes
    // almost none of it to their individual ads. On this account the three new
    // market campaigns spent 53.473 kr. in September and the ad-level read
    // accounts for 1.441 of it, so the drill-down is blind in exactly the
    // markets being expanded into. Each country therefore carries what its ads
    // account for against what the market itself reports.
    const reconciliation = {};
    for (const market of marketSeries) {
      const windowSpend = number(market.windows?.quarter?.spend);
      const adSpend = adRows
        .filter((row) => row.country === market.code)
        .reduce((total, row) => total + number(row.spend), 0);
      const unaccounted = round(windowSpend - adSpend, 2);
      reconciliation[market.code] = {
        marketSpend: round(windowSpend, 2),
        adSpend: round(adSpend, 2),
        unaccounted,
        share: windowSpend > 0 ? round(unaccounted / windowSpend, 4) : null,
        reconciles: windowSpend > 0
          ? Math.abs(unaccounted) / windowSpend <= AD_RECONCILIATION_TOLERANCE
          : adSpend === 0
      };
    }

    adBreakdown = {
      since: adWindow.since,
      until: adWindow.until,
      months: adWindowRows.map((row) => row.month),
      rows: adRows,
      thumbnails,
      reconciliation,
      adCount: new Set(adRows.map((row) => row.adId)).size,
      countryCount: new Set(adRows.map((row) => row.country)).size
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    accountId: normalizedAccountId,
    timezone: ACCOUNT_TIME_ZONE,
    today,
    window,
    anchor,
    campaignKey,
    available: rows.some((row) => row.monthlyReach > 0),
    months: rows,
    marketSeries,
    marketCount: marketSeries.length,
    adBreakdown,
    likeForLike,
    restatements,
    customerConversion: {
      available: Boolean(actionTypes.available),
      resolved: actionTypes.resolved?.new || [],
      unavailableReason: actionTypes.available
        ? ""
        : "No custom conversion named New_customer was found on this ad account, so new customers cannot be counted against reach."
    },
    marketOverlap: latest
      ? {
        month: latest.month,
        accountReach: latest.monthlyReach,
        marketReachSum: latest.marketReachSum,
        share: latest.marketOverlapShare,
        notable: number(latest.marketOverlapShare) >= MARKET_OVERLAP_NOTICE_SHARE
      }
      : null,
    campaigns,
    campaignCount: campaigns.length,
    graphCalls: reader.state.calls,
    notes: [
      "Reach is read at account level, filtered to the incremental campaigns. It is never summed across campaigns.",
      "Net-new reach is the rise in cumulative unique reach since the anchor month, so it counts people reached for the first time since the programme began.",
      "Markets come from Meta's country breakdown. Each country's reach is deduplicated inside that country, so countries must not be added together - a person reached in two of them counts in both.",
      "New customers are a monthly count set beside a monthly reach figure, not a cohort: the customers in a month are not necessarily the people first reached in it.",
      "The incrementality set is a segment of the account, not a measured uplift."
    ]
  };
}

module.exports = {
  syncExpansionReach,
  readAdBreakdown,
  buildMonths,
  buildMarketSeries,
  buildLikeForLike,
  previousMonthElapsedWindow,
  todayInAccountTimeZone,
  reusableCumulative,
  reusableLikeForLike,
  collectRestatements,
  describeSetChange,
  countryLabel,
  DEFAULT_MONTHS,
  MAX_MONTHS,
  MARKET_OVERLAP_NOTICE_SHARE
};
