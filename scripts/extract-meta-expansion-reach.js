// Twelve-month campaign extraction for the expansion strategy, with the reach
// curves the strategy is actually judged on.
//
// Usage:
//   node scripts/extract-meta-expansion-reach.js <output-dir> [months]
//
// Writes one JSON file per phase plus a consolidated analysis.json.
//
// Why this exists as a script rather than an API route: it reads a full year of
// campaign history, which is far more than the dashboard's snapshot needs, and
// it must be run deliberately rather than on every page load. The ad account
// throttles after a handful of paginated reads, and a throttle locks the
// marketing team's own dashboard out too - so the whole extraction is budgeted:
// rate limits are never retried, every phase writes to disk the moment it lands,
// and a failure in one phase does not discard the phases that already succeeded.
// A complete run costs 19 Graph calls.

const fs = require("fs");
const path = require("path");
const { getConfig } = require("../server/lib/config");
const { graphRequest, ensureAccountId, isRateLimitMessage } = require("../server/lib/meta");

const OUT_DIR = process.argv[2] || path.join(process.cwd(), "tmp", "meta-expansion");
const MONTH_COUNT = Math.max(1, Math.min(24, Number(process.argv[3] || 12)));

// The two custom conversions the marketing department is measured on. They are
// resolved by name at runtime rather than hardcoded, because the account carries
// archived duplicates of both and only the live pair should count.
const NEW_CUSTOMER_NAME = "New_customer";
const EXISTING_CUSTOMER_NAME = "Existing_customer";

const config = getConfig();
if (!config.metaAccessToken || !config.metaAdAccountId) {
  throw new Error("Meta connection is not configured.");
}
const ACCESS_TOKEN = config.metaAccessToken;
const ACCOUNT_ID = ensureAccountId(config.metaAdAccountId);

let callCount = 0;

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);
}

function save(name, value) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(value, null, 2));
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// A single Graph read. No rate-limit retry: failing fast is deliberate, because
// each retry spends another slice of a quota Meta measures in minutes to an hour,
// and the run is cheap enough to simply repeat later.
async function get(pathname, params, label) {
  callCount += 1;
  try {
    const payload = await graphRequest(pathname, ACCESS_TOKEN, { params, maxRetries: 0 });
    log(`call ${callCount} ${label} -> ${(payload.data || []).length} rows`);
    return payload;
  } catch (error) {
    if (isRateLimitMessage(error.message)) {
      throw new Error(`Rate limited after ${callCount} calls on "${label}". Wait before retrying: ${error.message}`);
    }
    throw error;
  }
}

async function getAll(pathname, params, label, maxPages = 12) {
  const rows = [];
  let payload = await get(pathname, params, `${label} p1`);
  rows.push(...(payload.data || []));
  let page = 1;
  while (payload?.paging?.next && page < maxPages) {
    page += 1;
    callCount += 1;
    const response = await fetch(payload.paging.next);
    const body = await response.json();
    if (body.error) {
      const message = body.error.message || "";
      throw new Error(`${isRateLimitMessage(message) ? "Rate limited paging " : ""}${label} page ${page}: ${message}`);
    }
    log(`call ${callCount} ${label} p${page} -> ${(body.data || []).length} rows`);
    rows.push(...(body.data || []));
    payload = body;
  }
  if (payload?.paging?.next) {
    log(`WARNING: ${label} still had further pages at the ${maxPages}-page cap`);
  }
  return rows;
}

// Dates resolve in the ad account's own timezone, not Copenhagen's. Meta draws
// this account's day boundaries in America/Los_Angeles, about nine hours behind,
// so a window built from the local clock would be off by a day at the edges.
function todayInAccountTimeZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildMonths(today) {
  const [year, month] = today.split("-").map(Number);
  const months = [];
  for (let offset = MONTH_COUNT; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = `${key}-${String(lastDay).padStart(2, "0")}`;
    months.push({ key, since: `${key}-01`, until: last > today ? today : last, partial: last > today });
  }
  return months;
}

function action(row, type) {
  return num((row.actions || []).find((item) => item.action_type === type)?.value);
}

function actionValue(row, type) {
  return num((row.action_values || []).find((item) => item.action_type === type)?.value);
}

async function main() {
  const today = todayInAccountTimeZone();
  const months = buildMonths(today);
  const window = { since: months[0].since, until: months[months.length - 1].until };

  log(`account ${ACCOUNT_ID}, window ${window.since} -> ${window.until} (account-timezone today: ${today})`);
  save("window", { accountId: ACCOUNT_ID, window, months, extractedAt: new Date().toISOString() });

  // Campaign catalogue.
  const campaigns = await getAll(`/${ACCOUNT_ID}/campaigns`, {
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time",
    limit: "200"
  }, "campaigns", 6);
  save("campaigns", campaigns);

  // Custom conversions, so New_customer resolves by name rather than by a
  // hardcoded id that the account has archived duplicates of.
  const customConversions = await getAll(`/${ACCOUNT_ID}/customconversions`, {
    fields: "id,name,custom_event_type,is_archived",
    limit: "100"
  }, "custom_conversions", 2);
  save("custom-conversions", customConversions);

  const liveConversion = (name) => customConversions.find((item) => item.name === name && !item.is_archived)?.id || null;
  const newCustomerAction = liveConversion(NEW_CUSTOMER_NAME) ? `offsite_conversion.custom.${liveConversion(NEW_CUSTOMER_NAME)}` : null;
  const existingCustomerAction = liveConversion(EXISTING_CUSTOMER_NAME) ? `offsite_conversion.custom.${liveConversion(EXISTING_CUSTOMER_NAME)}` : null;

  // Per-campaign monthly delivery. attribution_setting is deliberately NOT asked
  // for here: requesting it returns a row for every campaign that ever existed,
  // which at monthly granularity is thousands of empty rows and many pages of
  // quota. It is fetched once, unsegmented, in the next call instead.
  const monthly = await getAll(`/${ACCOUNT_ID}/insights`, {
    level: "campaign",
    time_range: JSON.stringify(window),
    time_increment: "monthly",
    limit: "500",
    fields: [
      "campaign_id", "campaign_name", "objective", "date_start", "date_stop",
      "spend", "impressions", "reach", "frequency", "clicks", "cpm", "cpc", "ctr",
      "actions", "action_values", "cost_per_action_type"
    ].join(",")
  }, "campaign_monthly", 10);
  save("campaign-monthly", monthly);

  // Attribution per campaign over the whole window. This is what decides which
  // campaigns are the incremental ones - Meta's own field, never the name tag.
  const attribution = await getAll(`/${ACCOUNT_ID}/insights`, {
    level: "campaign",
    time_range: JSON.stringify(window),
    limit: "500",
    fields: "campaign_id,campaign_name,attribution_setting,spend,impressions,clicks,reach,actions,action_values"
  }, "campaign_attribution", 4);
  save("campaign-attribution", attribution);

  const incrementalIds = attribution
    .filter((row) => row.attribution_setting === "incrementality")
    .filter((row) => num(row.spend) > 0 || num(row.impressions) > 0)
    .map((row) => String(row.campaign_id));
  save("incremental-campaign-ids", incrementalIds);
  log(`${incrementalIds.length} campaigns on incrementality attribution`);

  // Deduplicated reach per month at account level. Reach is a count of distinct
  // people, so it cannot be summed across campaigns - the only honest monthly
  // figure comes from one account-level query with a monthly increment.
  const accountMonthlyReach = await getAll(`/${ACCOUNT_ID}/insights`, {
    level: "account",
    time_range: JSON.stringify(window),
    time_increment: "monthly",
    limit: "50",
    fields: "date_start,date_stop,reach,impressions,frequency,spend"
  }, "account_monthly_reach", 2);
  save("account-monthly-reach", accountMonthlyReach);

  const incrementalFilter = JSON.stringify([
    { field: "campaign.id", operator: "IN", value: incrementalIds }
  ]);

  const incrementalMonthlyReach = incrementalIds.length
    ? (await get(`/${ACCOUNT_ID}/insights`, {
        level: "account",
        time_range: JSON.stringify(window),
        time_increment: "monthly",
        filtering: incrementalFilter,
        limit: "50",
        fields: "date_start,date_stop,reach,impressions,frequency,spend,clicks,actions,action_values"
      }, "incremental_monthly_reach")).data || []
    : [];
  save("incremental-monthly-reach", incrementalMonthlyReach);

  // Cumulative unique reach, window start to each month end. One call per month,
  // because Meta has no cumulative deduplicated figure and no way to derive one
  // from the monthly rows: the same person can appear in several of them.
  const cumulative = [];
  for (const month of months) {
    if (!incrementalIds.length) break;
    const rows = (await get(`/${ACCOUNT_ID}/insights`, {
      level: "account",
      time_range: JSON.stringify({ since: window.since, until: month.until }),
      filtering: incrementalFilter,
      limit: "1",
      fields: "reach,impressions,frequency,spend"
    }, `incremental_cumulative_${month.key}`)).data || [];
    const row = rows[0] || {};
    cumulative.push({
      month: month.key,
      until: month.until,
      partial: month.partial,
      reach: num(row.reach),
      impressions: num(row.impressions),
      spend: num(row.spend)
    });
    save("incremental-cumulative-reach", cumulative);
  }

  // -------------------------------------------------------------------------
  // Consolidation. Net-new reach is the month-on-month rise in cumulative unique
  // reach: the people the set touched for the first time that month. Repeat
  // reach is the rest of the month's reach. That split is the expansion signal -
  // when repeat reach grows while net-new falls, the audience is saturating.
  // -------------------------------------------------------------------------
  const monthlyByKey = Object.fromEntries(incrementalMonthlyReach.map((row) => [row.date_start.slice(0, 7), row]));
  const accountByKey = Object.fromEntries(accountMonthlyReach.map((row) => [row.date_start.slice(0, 7), row]));

  let previousCumulative = 0;
  const reachSeries = months.map((month) => {
    const cumulativeReach = num(cumulative.find((row) => row.month === month.key)?.reach);
    const monthRow = monthlyByKey[month.key] || null;
    const monthlyReach = num(monthRow?.reach);
    const netNew = cumulativeReach > 0 ? cumulativeReach - previousCumulative : 0;
    if (cumulativeReach > 0) previousCumulative = cumulativeReach;
    const spend = num(monthRow?.spend);
    return {
      month: month.key,
      partial: month.partial,
      active: monthlyReach > 0,
      monthlyReach,
      cumulativeReach,
      netNewReach: netNew,
      // Never below zero: a cumulative window can dip slightly as Meta remodels,
      // and a negative "repeat" would be an artefact rather than a fact.
      repeatReach: Math.max(0, monthlyReach - netNew),
      repeatShare: monthlyReach > 0 ? Math.max(0, monthlyReach - netNew) / monthlyReach : null,
      spend,
      frequency: num(monthRow?.frequency),
      costPerThousandNewlyReached: netNew > 0 ? (spend / netNew) * 1000 : null,
      accountMonthlyReach: num(accountByKey[month.key]?.reach),
      accountSpend: num(accountByKey[month.key]?.spend)
    };
  });

  const campaignById = Object.fromEntries(campaigns.map((item) => [String(item.id), item]));
  const incrementalCampaigns = attribution
    .filter((row) => incrementalIds.includes(String(row.campaign_id)))
    .map((row) => {
      const meta = campaignById[String(row.campaign_id)] || {};
      return {
        id: String(row.campaign_id),
        name: row.campaign_name,
        status: meta.effective_status || meta.status || null,
        objective: meta.objective || null,
        spend: num(row.spend),
        impressions: num(row.impressions),
        clicks: num(row.clicks),
        // Named "delivered" as a warning: this is the campaign's own
        // deduplicated reach and must never be summed with its siblings'.
        deliveredReach: num(row.reach),
        purchases: action(row, "purchase"),
        revenue: actionValue(row, "purchase"),
        newCustomers: newCustomerAction ? action(row, newCustomerAction) : null,
        existingCustomers: existingCustomerAction ? action(row, existingCustomerAction) : null
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const attributionMix = Object.entries(
    attribution.filter((row) => num(row.spend) > 0).reduce((acc, row) => {
      const key = row.attribution_setting || "(not reported)";
      acc[key] = (acc[key] || 0) + num(row.spend);
      return acc;
    }, {})
  ).map(([setting, spend]) => ({ setting, spend })).sort((a, b) => b.spend - a.spend);

  const analysis = {
    meta: {
      accountId: ACCOUNT_ID,
      window,
      timezone: "America/Los_Angeles",
      extractedAt: new Date().toISOString(),
      graphCalls: callCount,
      incrementalCampaignCount: incrementalIds.length,
      newCustomerAction,
      existingCustomerAction,
      notes: [
        "Reach comes from account-level queries, per month and cumulative. It is never summed across campaigns.",
        "Net-new reach is the rise in cumulative unique reach, so it is relative to the window start.",
        "The incrementality set reports Meta's standard figures on this account: the lens is a segment, not a measured uplift."
      ]
    },
    reachSeries,
    incrementalCampaigns,
    attributionMix
  };

  save("analysis", analysis);
  log(`done in ${callCount} Graph calls -> ${path.join(OUT_DIR, "analysis.json")}`);
}

main().catch((error) => {
  log(`FAILED after ${callCount} calls: ${error.message}`);
  try {
    save("error", { error: error.message, callCount });
  } catch (writeError) {
    // The run already failed; losing the error file too changes nothing.
  }
  process.exitCode = 1;
});
