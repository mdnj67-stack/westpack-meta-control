const { ensureAccountId } = require("../lib/meta");
const { resolveCurrencyMinorUnitDivisor, resolveObjectiveGroup } = require("./budget-allocation");
// The classification rules live in one file shared with the browser, so a line
// moved on screen is the same line the nightly job applied.
const rules = require("../../src/saturation-rules.js");
const { PURCHASE_ACTION_TYPES } = require("./customer-acquisition");
const {
  actionEntryValue,
  countryLabel,
  createGraphReader,
  readCustomerConversionTypes,
  todayInAccountTimeZone
} = require("./expansion-reach");

// How much of each audience is used up, one row per ad set.
//
// The question the Expansion tab answers is "where does the next krone still buy
// new people, and where is it only buying the same people again". Ad sets are
// the unit because that is where the audience and the budget are both set.
//
// What can and cannot be measured, and why the table looks the way it does:
//
//  - A broad ad set (a country, 18-65, Advantage+ audience) has no audience to
//    use up. Meta's audience estimate for it is the country's adult population,
//    while Westpack's market is a few thousand businesses per country, so "4% of
//    Germany reached" would be a meaningless figure. Those rows carry no share.
//  - A defined audience (lookalike, custom audience) has a real size, from the
//    ad set's own delivery estimate, and there the share reached is shown. Where
//    the ad set lets Meta go beyond the audience (lookalike expansion, Advantage+
//    audience) the share is labelled approximate.
//  - Saturation itself is measured the same way for every row, from how delivery
//    moves: the share of the period's reach that is new to the ad set, the cost
//    of each thousand new people, and frequency. A used-up audience shows the
//    same shape whatever its size.
//
// "New" means not reached by this ad set in the LOOKBACK_DAYS before the period.
// Reach cannot be summed, so it is the rise in deduplicated reach from a fixed
// start: reach(start - lookback .. end) - reach(start - lookback .. start - 1).
// All six reach figures (two periods x three ranges) come back from one insights
// call with `time_ranges`, one row per ad set per range. It is per ad set: a
// person reached by awareness and then by conversion is new to both.
//
// Results use Meta's incremental attribution, as everywhere else on the
// dashboard (`action_attribution_windows=["incrementality"]`).

const ACCOUNT_TIME_ZONE = "America/Los_Angeles";
// Two weeks: long enough to carry a trend on this account's spend, short enough
// to react to a budget change. With 28 days the current period began on the day
// of the 2026-09-09 rebuild, so nearly every ad set read "everyone is new" with
// nothing before it to compare against.
const PERIOD_DAYS = 14;
const LOOKBACK_DAYS = 90;
const INCREMENTAL_ATTRIBUTION_WINDOWS = JSON.stringify(["incrementality"]);

const THRESHOLDS = rules.DEFAULT_THRESHOLDS;
const STATUS_LABELS = rules.STATUS_LABELS;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function shiftIsoDays(iso, days) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function rangeKey(range) {
  return `${range.since}..${range.until}`;
}

// Two equal periods ending yesterday (today is still running), each with the
// two cumulative ranges that give its new reach.
function resolveSaturationWindows(today) {
  const until = shiftIsoDays(today, -1);
  const build = (end) => {
    const since = shiftIsoDays(end, -(PERIOD_DAYS - 1));
    const lookbackSince = shiftIsoDays(since, -LOOKBACK_DAYS);
    return {
      since,
      until: end,
      days: PERIOD_DAYS,
      period: { since, until: end },
      through: { since: lookbackSince, until: end },
      before: { since: lookbackSince, until: shiftIsoDays(since, -1) },
      // Frequency per week is read off real weeks. Dividing the period's
      // frequency by two understates it whenever different people see the ads in
      // each week - by up to half - and always in the same direction.
      weeks: [
        { since, until: shiftIsoDays(since, 6) },
        { since: shiftIsoDays(since, 7), until: end }
      ]
    };
  };
  const current = build(until);
  const previous = build(shiftIsoDays(current.since, -1));
  const ranges = [current, previous].flatMap((window) => [window.period, window.through, window.before, ...window.weeks]);
  return { today, current, previous, lookbackDays: LOOKBACK_DAYS, ranges };
}

function sumActions(entries, actionTypes) {
  const list = Array.isArray(entries) ? entries : [];
  let total = 0;
  for (const type of actionTypes || []) {
    total += actionEntryValue(list.find((entry) => entry.action_type === type)) || 0;
  }
  return total;
}

function firstAction(entries, actionTypes) {
  const list = Array.isArray(entries) ? entries : [];
  for (const type of actionTypes) {
    const value = actionEntryValue(list.find((entry) => entry.action_type === type));
    if (value != null) return value;
  }
  return 0;
}

// The mean of each week's impressions per person, over the weeks that delivered.
function weeklyFrequency(rowsByRange, window) {
  const values = (window.weeks || [])
    .map((week) => rowsByRange.get(rangeKey(week)))
    .filter((row) => number(row?.reach) > 0)
    .map((row) => number(row.impressions) / number(row.reach));
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : null;
}

// One period's figures for one ad set, from its rows keyed by range. A range
// Meta returned no row for had no delivery, which is a real zero.
function buildPeriodMetrics(rowsByRange, window, actionTypes) {
  const period = rowsByRange.get(rangeKey(window.period));
  const through = rowsByRange.get(rangeKey(window.through));
  const before = rowsByRange.get(rangeKey(window.before));

  const reach = number(period?.reach);
  const impressions = number(period?.impressions);
  const spend = number(period?.spend);
  const newReach = reach > 0
    ? Math.max(0, Math.min(reach, number(through?.reach) - number(before?.reach)))
    : 0;
  const newCustomers = actionTypes?.newCustomerActionTypes?.length
    ? sumActions(period?.actions, actionTypes.newCustomerActionTypes)
    : null;

  return {
    since: window.since,
    until: window.until,
    reach,
    impressions,
    spend: round(spend, 2),
    newReach,
    // Reach in the lookback before the period. Zero means the period was the ad
    // set's first, where everyone is new by definition.
    reachBefore: number(before?.reach),
    repeatReach: Math.max(0, reach - newReach),
    newShare: reach > 0 ? round(newReach / reach, 4) : null,
    costPerThousandNew: newReach > 0 ? round((spend / newReach) * 1000, 2) : null,
    weeklyFrequency: weeklyFrequency(rowsByRange, window),
    lastWeekSpend: round(number(rowsByRange.get(rangeKey(window.weeks[window.weeks.length - 1]))?.spend), 2),
    purchases: firstAction(period?.actions, PURCHASE_ACTION_TYPES),
    newCustomers,
    // A single-digit count is a range, not a figure (95%, Garwood).
    newCustomersRange: newCustomers == null ? null : rules.poissonInterval(newCustomers),
    costPerNewCustomer: newCustomers > 0 ? round(spend / newCustomers, 2) : null
  };
}

// What the ad set is aimed at, read from its targeting.
function describeAudience(targeting = {}) {
  const customAudiences = (targeting.custom_audiences || []).map((audience) => audience.name || audience.id);
  const excluded = (targeting.excluded_custom_audiences || []).map((audience) => audience.name || audience.id);
  const relaxation = targeting.targeting_relaxation_types || {};
  const advantageAudience = number(targeting.targeting_automation?.advantage_audience) === 1;
  const expansionAllowed = advantageAudience
    || number(relaxation.lookalike) === 1
    || number(relaxation.custom_audience) === 1
    || targeting.targeting_optimization === "expansion_all";
  return {
    kind: customAudiences.length ? "defined" : "broad",
    customAudiences,
    excluded,
    expansionAllowed,
    advantageAudience,
    detailedTargeting: Array.isArray(targeting.flexible_spec) && targeting.flexible_spec.length > 0
  };
}

function describeMarket(targeting = {}) {
  const geo = targeting.geo_locations || {};
  const countries = (geo.countries || []).map((code) => String(code).toUpperCase());
  const groups = (geo.country_groups || []).map((group) => String(group).toLowerCase());
  if (groups.length) {
    const label = groups.map((group) => group.charAt(0).toUpperCase() + group.slice(1)).join(" + ");
    return { key: groups.sort().join("+"), label, countries };
  }
  if (countries.length === 1) {
    return { key: countries[0], label: countryLabel(countries[0]), countries };
  }
  if (countries.length > 1) {
    const sorted = countries.slice().sort();
    return { key: sorted.join("+"), label: sorted.map(countryLabel).join(", "), countries };
  }
  return { key: "other", label: "Other targeting", countries };
}

// The rules themselves are in src/saturation-rules.js. This keeps the shape the
// tests and callers were written against: a flat argument list for one ad set.
function classifySaturation({
  current,
  previous,
  audienceShare = null,
  audienceShareLow = null,
  audienceShareHigh = null,
  audienceShareApproximate = false,
  advantageAudience = false,
  objectiveGroup = "",
  accountCostPerNewCustomer = null,
  accountCpmChange = null,
  delivery = {},
  thresholds = null
}) {
  return rules.classifyRow({
    current,
    previous,
    objectiveGroup,
    audience: {
      share: audienceShare,
      shareLow: audienceShareLow,
      shareHigh: audienceShareHigh,
      shareApproximate: audienceShareApproximate,
      advantageAudience
    },
    delivery
  }, { accountCostPerNewCustomer, accountCpmChange, periodDays: PERIOD_DAYS }, thresholds);
}

function describeFrequency(current, objectiveGroup) {
  return rules.describeFrequency(current, objectiveGroup, THRESHOLDS);
}

// Frequency cap as impressions per person per week, from the ad set's own
// frequency_control_specs.
function weeklyFrequencyCap(specs) {
  const cap = (Array.isArray(specs) ? specs : []).find((spec) => spec?.event === "IMPRESSIONS" && number(spec?.max_frequency) > 0);
  if (!cap) return null;
  const days = number(cap.interval_days) || 7;
  return round((number(cap.max_frequency) * 7) / days, 2);
}

function buildAdSetRow({ meta, rowsByRange, windows, actionTypes, estimate = null, context = {}, budgetDivisor = 100 }) {
  const targeting = meta?.targeting || {};
  const objectiveGroup = resolveObjectiveGroup({ objective: meta?.campaign?.objective });
  const audience = describeAudience(targeting);
  const current = buildPeriodMetrics(rowsByRange, windows.current, actionTypes);
  const previous = buildPeriodMetrics(rowsByRange, windows.previous, actionTypes);

  // The estimate is a range; its midpoint is the size. Only a defined audience
  // gets a share, because a broad ad set's estimate is a population.
  const lower = number(estimate?.estimate_mau_lower_bound);
  const upper = number(estimate?.estimate_mau_upper_bound);
  const size = lower > 0 && upper > 0 ? Math.round((lower + upper) / 2) : null;
  const throughReach = number(rowsByRange.get(rangeKey(windows.current.through))?.reach);
  const audienceShare = audience.kind === "defined" && size ? round(current.reach / size, 4) : null;
  const audienceShareSinceLookback = audience.kind === "defined" && size ? round(throughReach / size, 4) : null;

  const shareApproximate = audience.kind === "defined" && audience.expansionAllowed;
  // Meta's size is a range, so the share is too: reach over the upper bound to
  // reach over the lower.
  const shareLow = audience.kind === "defined" && upper > 0 ? round(current.reach / upper, 4) : null;
  const shareHigh = audience.kind === "defined" && lower > 0 ? round(current.reach / lower, 4) : null;

  // Whether budget is what limits delivery: last week's spend against the ad set's
  // own daily budget. A campaign budget is shared, so it is not attributed here.
  const dailyBudget = number(meta?.daily_budget) > 0 ? round(number(meta.daily_budget) / budgetDivisor, 2) : null;
  const lastWeekPerDay = current.lastWeekSpend / 7;
  const delivery = {
    optimizationGoal: String(meta?.optimization_goal || ""),
    frequencyCapPerWeek: weeklyFrequencyCap(meta?.frequency_control_specs),
    dailyBudget,
    budgetUtilization: dailyBudget ? round(lastWeekPerDay / dailyBudget, 3) : null
  };

  const classification = rules.classifyRow({
    current,
    previous,
    objectiveGroup,
    delivery,
    audience: {
      share: audienceShare,
      shareLow,
      shareHigh,
      shareApproximate,
      advantageAudience: audience.advantageAudience
    }
  }, context, THRESHOLDS);

  return {
    id: String(meta?.id || ""),
    name: String(meta?.name || ""),
    campaignId: String(meta?.campaign?.id || ""),
    campaignName: String(meta?.campaign?.name || ""),
    objectiveGroup,
    effectiveStatus: String(meta?.effective_status || ""),
    market: describeMarket(targeting),
    audience: {
      ...audience,
      estimateLower: lower || null,
      estimateUpper: upper || null,
      size: audience.kind === "defined" ? size : null,
      population: audience.kind === "broad" ? size : null,
      share: audienceShare,
      shareLow,
      shareHigh,
      shareSinceLookback: audienceShareSinceLookback,
      shareApproximate,
      beyondAudience: shareApproximate && audienceShare != null && audienceShare > 1
    },
    delivery,
    current,
    previous,
    spendPerDay: round(current.spend / PERIOD_DAYS, 2),
    ...classification
  };
}

// Markets are a grouping, not a figure: spend adds up, reach does not, so a
// market header carries spend and the count of rows per status only.
function groupByMarket(rows) {
  const markets = new Map();
  for (const row of rows) {
    const entry = markets.get(row.market.key) || { key: row.market.key, label: row.market.label, spend: 0, adSetIds: [], statusCounts: {} };
    entry.spend = round(entry.spend + row.current.spend, 2);
    entry.adSetIds.push(row.id);
    entry.statusCounts[row.status] = (entry.statusCounts[row.status] || 0) + 1;
    markets.set(row.market.key, entry);
  }
  return Array.from(markets.values()).sort((left, right) => right.spend - left.spend);
}

function indexRows(insightRows) {
  const byAdSet = new Map();
  for (const row of insightRows || []) {
    const id = String(row?.adset_id || "");
    if (!id) continue;
    if (!byAdSet.has(id)) byAdSet.set(id, new Map());
    byAdSet.get(id).set(rangeKey({ since: row.date_start, until: row.date_stop }), row);
  }
  return byAdSet;
}

// Assembles the snapshot from already-fetched data, so it can be tested without
// Meta.
function buildAudienceSaturation({ today, insightRows = [], accountRows = [], adSetMeta = [], estimates = {}, actionTypes = {}, graphCalls = 0, accountId = "", currency = "DKK" }) {
  const windows = resolveSaturationWindows(today);
  const rowsByAdSet = indexRows(insightRows);
  const metaById = new Map((adSetMeta || []).map((meta) => [String(meta.id), meta]));

  const delivering = [];
  for (const [id, rowsByRange] of rowsByAdSet) {
    const period = rowsByRange.get(rangeKey(windows.current.period));
    // Only ad sets that delivered in the current period: the table is about where
    // money goes now.
    if (!period || (number(period.spend) <= 0 && number(period.impressions) <= 0)) continue;
    const meta = metaById.get(id) || {
      id,
      name: period.adset_name,
      campaign: { id: period.campaign_id, name: period.campaign_name },
      targeting: {}
    };
    delivering.push({ id, meta, rowsByRange });
  }

  // The bar for "does not convert" is set by the account itself: what a new
  // customer costs across its conversion ad sets in the same period.
  let conversionSpend = 0;
  let conversionCustomers = 0;
  for (const { meta, rowsByRange } of delivering) {
    if (resolveObjectiveGroup({ objective: meta?.campaign?.objective }) !== "conversion") continue;
    const metrics = buildPeriodMetrics(rowsByRange, windows.current, actionTypes);
    conversionSpend += metrics.spend;
    conversionCustomers += number(metrics.newCustomers);
  }
  const accountCostPerNewCustomer = conversionCustomers > 0 ? round(conversionSpend / conversionCustomers, 2) : null;

  // The account's own CPM in each period, so a cost rise can be read net of the
  // market getting dearer for everyone.
  const cpmFor = (window) => {
    const row = (accountRows || []).find((entry) => entry?.date_start === window.since && entry?.date_stop === window.until);
    return number(row?.impressions) > 0 ? (number(row.spend) / number(row.impressions)) * 1000 : null;
  };
  const currentCpm = cpmFor(windows.current);
  const previousCpm = cpmFor(windows.previous);
  const accountCpmChange = currentCpm && previousCpm ? round(currentCpm / previousCpm - 1, 4) : null;

  const context = { accountCostPerNewCustomer, accountCpmChange, periodDays: PERIOD_DAYS };
  const budgetDivisor = resolveCurrencyMinorUnitDivisor(currency);
  const rows = delivering.map(({ id, meta, rowsByRange }) => buildAdSetRow({
    meta, rowsByRange, windows, actionTypes, estimate: estimates[id] || null, context, budgetDivisor
  }));

  const sorted = rules.sortRows(rows);
  const statusCounts = rules.countStatuses(sorted);

  return {
    generatedAt: new Date().toISOString(),
    accountId,
    timezone: ACCOUNT_TIME_ZONE,
    today,
    available: sorted.length > 0,
    unavailableReason: sorted.length ? "" : `No ad set delivered in the last ${PERIOD_DAYS} days.`,
    periodDays: PERIOD_DAYS,
    lookbackDays: LOOKBACK_DAYS,
    current: { since: windows.current.since, until: windows.current.until },
    previous: { since: windows.previous.since, until: windows.previous.until },
    thresholds: THRESHOLDS,
    statusLabels: STATUS_LABELS,
    statusCounts,
    accountCostPerNewCustomer,
    accountCpm: { current: currentCpm ? round(currentCpm, 2) : null, previous: previousCpm ? round(previousCpm, 2) : null },
    accountCpmChange,
    context,
    adjustable: rules.ADJUSTABLE,
    resultAttribution: "incrementality",
    customerConversionAvailable: Boolean(actionTypes?.available),
    markets: groupByMarket(sorted),
    adSets: sorted,
    graphCalls,
    notes: [
      `New means not reached by this ad set in the ${LOOKBACK_DAYS} days before the period. It is per ad set: someone reached by an awareness ad set and later by a conversion ad set is new to both.`,
      "Reach is read deduplicated from Meta for each ad set and range, never added up.",
      "A broad ad set's audience estimate is a country's population, not Westpack's market, so no share is shown for it.",
      "A defined audience's size is Meta's delivery estimate for the ad set's own targeting. Where lookalike expansion or Advantage+ audience is on, Meta may reach beyond it and the share is approximate.",
      "New customers use Meta's incremental attribution, as everywhere else on the dashboard.",
      "Frequency per week is the mean of each week's impressions per person, read from Meta week by week.",
      "A change in the cost of new people is measured after taking out the account's own CPM change between the same two periods.",
      "The statuses are rules of thumb on top of Meta's figures. None of the thresholds has been validated against an outcome."
    ]
  };
}

async function syncAudienceSaturation({ accountId, accessToken, today = todayInAccountTimeZone() } = {}) {
  const normalizedAccountId = ensureAccountId(accountId);
  const reader = createGraphReader(normalizedAccountId, accessToken);
  const windows = resolveSaturationWindows(today);

  // Every ad set, every range, one call: reach is deduplicated per row by Meta.
  const insightRows = await reader.getAll(`/${normalizedAccountId}/insights`, {
    level: "adset",
    time_ranges: JSON.stringify(windows.ranges),
    action_attribution_windows: INCREMENTAL_ATTRIBUTION_WINDOWS,
    limit: "500",
    fields: "adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,reach,impressions,spend,actions"
  }, "ad set reach by range", 6);

  const currentKey = rangeKey(windows.current.period);
  const deliveringIds = Array.from(new Set(insightRows
    .filter((row) => `${row.date_start}..${row.date_stop}` === currentKey && (number(row.spend) > 0 || number(row.impressions) > 0))
    .map((row) => String(row.adset_id))));

  const adSetMeta = [];
  for (let index = 0; index < deliveringIds.length; index += 50) {
    const payload = await reader.get("/", {
      ids: deliveringIds.slice(index, index + 50).join(","),
      fields: "id,name,effective_status,optimization_goal,daily_budget,frequency_control_specs,targeting,campaign{id,name,objective,effective_status}"
    }, "ad set targeting");
    adSetMeta.push(...Object.values(payload || {}));
  }

  // The audience estimate costs one call per ad set, so only defined audiences
  // get one: a broad ad set's estimate is a population and is never shown as a
  // share.
  const estimates = {};
  for (const meta of adSetMeta) {
    if (describeAudience(meta.targeting).kind !== "defined") continue;
    if (meta.effective_status !== "ACTIVE") continue;
    try {
      const payload = await reader.get(`/${meta.id}/delivery_estimate`, {
        optimization_goal: meta.optimization_goal || "REACH"
      }, `delivery estimate ${meta.name}`);
      const estimate = (payload?.data || [])[0];
      if (estimate?.estimate_ready !== false) estimates[meta.id] = estimate;
    } catch (error) {
      // A missing estimate costs the share on one row, not the table. Rate limits
      // still stop the job, as everywhere else in this nightly path.
      if (/rate limit/i.test(error.message)) throw error;
    }
  }

  const actionTypes = await readCustomerConversionTypes(reader);

  // The account's own spend and impressions for both periods, for the CPM change.
  const accountRows = await reader.getAll(`/${normalizedAccountId}/insights`, {
    level: "account",
    time_ranges: JSON.stringify([windows.current.period, windows.previous.period]),
    fields: "date_start,date_stop,spend,impressions,account_currency",
    limit: "10"
  }, "account CPM by period", 1);

  return buildAudienceSaturation({
    today,
    insightRows,
    accountRows,
    currency: String(accountRows[0]?.account_currency || "DKK"),
    adSetMeta,
    estimates,
    actionTypes,
    graphCalls: reader.state.calls,
    accountId: normalizedAccountId
  });
}

module.exports = {
  LOOKBACK_DAYS,
  PERIOD_DAYS,
  STATUS_LABELS,
  THRESHOLDS,
  buildAudienceSaturation,
  buildPeriodMetrics,
  classifySaturation,
  describeAudience,
  describeFrequency,
  describeMarket,
  resolveSaturationWindows,
  syncAudienceSaturation
};
