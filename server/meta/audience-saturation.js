const { ensureAccountId } = require("../lib/meta");
const { resolveObjectiveGroup } = require("./budget-allocation");
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

// The rules behind each status. They are stated on screen beside every row, so a
// status is never a verdict without its reason.
const THRESHOLDS = {
  // Below this a period's figures are too thin to read a trend from.
  minimumReach: 1000,
  minimumSpend: 500,
  // Share of the period's reach that is new to the ad set.
  saturatedNewShare: 0.25,
  saturatingNewShare: 0.4,
  // Movement against the previous period that marks an audience running out.
  newShareDrop: 0.1,
  costPerThousandNewRise: 0.25,
  // The previous period counts as a launch when the ad set's reach in the whole
  // lookback before it was under this share of the period's own reach: it had
  // barely delivered yet. Zero alone was too strict - once the windows moved a
  // day, the single rebuild day (2026-09-09) fell before the period and
  // Conv - 04 read 85% -> 69% as saturation.
  launchReachShare: 0.5,
  // A defined audience reached this far inside one period is used up.
  saturatedAudienceShare: 0.8,
  // A conversion ad set that has spent this many times the account's cost per new
  // customer without one. At three, a zero is about a 5% chance if the ad set
  // performed like the account (Poisson), so it is evidence rather than noise.
  notConvertingCostMultiple: 3,
  // Brand awareness is built at around five impressions per person per week.
  awarenessWeeklyFrequencyTarget: 5,
  awarenessWeeklyFrequencyLow: 3,
  awarenessWeeklyFrequencyHigh: 8
};

const STATUS_ORDER = ["saturated", "not_converting", "saturating", "room", "insufficient"];
const STATUS_LABELS = {
  room: "Room to grow",
  saturating: "Saturating",
  saturated: "Saturated",
  not_converting: "Reaches, does not convert",
  insufficient: "Too little delivery"
};

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
      before: { since: lookbackSince, until: shiftIsoDays(since, -1) }
    };
  };
  const current = build(until);
  const previous = build(shiftIsoDays(current.since, -1));
  const ranges = [current, previous].flatMap((window) => [window.period, window.through, window.before]);
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
    weeklyFrequency: reach > 0 ? round(impressions / reach / (window.days / 7), 2) : null,
    purchases: firstAction(period?.actions, PURCHASE_ACTION_TYPES),
    newCustomers,
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

// The status and every reason behind it. Order matters: too little delivery
// first, because nothing else can be read from it; then a used-up audience,
// because that is the lesson even when the ad set also does not convert.
function classifySaturation({
  current,
  previous,
  audienceShare = null,
  audienceShareApproximate = false,
  objectiveGroup = "",
  accountCostPerNewCustomer = null
}) {
  const t = THRESHOLDS;
  const reasons = [];

  if (current.reach < t.minimumReach || current.spend < t.minimumSpend) {
    reasons.push(`Under ${t.minimumReach.toLocaleString("en")} people or ${t.minimumSpend} kr. in the last ${PERIOD_DAYS} days.`);
    return { status: "insufficient", reasons, causes: [], comparable: false };
  }

  // A launch period is everyone-new by construction, so the next period always
  // reads as a fall. Measured on the 2026-09-09 rebuild, that alone marked ten ad
  // sets as saturating in their second fortnight. Against a launch, only the
  // current level is read.
  const previousWasLaunch = Boolean(previous && previous.reach > 0 && previous.reachBefore < previous.reach * t.launchReachShare);
  const comparable = previous && !previousWasLaunch && previous.reach >= t.minimumReach && previous.newShare != null;
  const shareDrop = comparable && current.newShare != null ? previous.newShare - current.newShare : null;
  const costRise = comparable && current.costPerThousandNew != null && previous.costPerThousandNew > 0
    ? current.costPerThousandNew / previous.costPerThousandNew - 1
    : null;

  const shareText = current.newShare == null ? "" : `${Math.round(current.newShare * 100)}% of those reached were new to it`;
  const dropText = shareDrop != null && shareDrop >= t.newShareDrop
    ? `New share fell ${Math.round(shareDrop * 100)} points on the ${PERIOD_DAYS} days before`
    : "";
  const costText = costRise != null && costRise >= t.costPerThousandNewRise
    ? `New people cost ${Math.round(costRise * 100)}% more per thousand than the ${PERIOD_DAYS} days before`
    : "";
  // Only a bounded audience can be used up. Where Meta may go beyond it, a share
  // above 100% means delivery is spilling past the audience, not exhausting it.
  const audienceText = audienceShare != null && !audienceShareApproximate && audienceShare >= t.saturatedAudienceShare
    ? `Reached ${Math.round(audienceShare * 100)}% of the audience in ${PERIOD_DAYS} days`
    : "";
  const startedInPeriod = !previous || (previous.reach === 0 && current.newShare === 1);
  const movingWrong = Boolean(dropText || costText);
  // Which rule tripped, so the view can colour the measure that caused the status
  // and leave the others grey. Order is the order the reasons are written in.
  const lowShare = current.newShare != null && current.newShare < t.saturatingNewShare;
  const trendCauses = [dropText ? "newShareTrend" : "", costText ? "costTrend" : ""].filter(Boolean);
  const shared = { comparable: Boolean(comparable), previousWasLaunch };

  const saturated = Boolean(audienceText)
    || (current.newShare != null && current.newShare < t.saturatedNewShare)
    || (current.newShare != null && current.newShare < t.saturatingNewShare && movingWrong);
  if (saturated) {
    reasons.push(...[audienceText, shareText, dropText, costText].filter(Boolean));
    const causes = [
      audienceText ? "audience" : "",
      (current.newShare != null && current.newShare < t.saturatedNewShare) || (lowShare && movingWrong) ? "newShare" : "",
      ...trendCauses
    ].filter(Boolean);
    return { status: "saturated", reasons, causes, ...shared };
  }

  const notConvertingSpend = accountCostPerNewCustomer > 0
    ? accountCostPerNewCustomer * t.notConvertingCostMultiple
    : null;
  if (objectiveGroup === "conversion"
    && notConvertingSpend != null
    && current.newCustomers != null
    && current.newCustomers < 1
    && current.spend >= notConvertingSpend) {
    reasons.push(`${Math.round(current.spend).toLocaleString("en")} kr. spent and no new customer in the last ${PERIOD_DAYS} days, over ${t.notConvertingCostMultiple}x the account's cost per new customer`);
    if (shareText) reasons.push(`${shareText}, so reach is not the limit`);
    return { status: "not_converting", reasons, causes: ["customers"], ...shared };
  }

  if (movingWrong || (current.newShare != null && current.newShare < t.saturatingNewShare)) {
    reasons.push(...[shareText, dropText, costText].filter(Boolean));
    if (previousWasLaunch) reasons.push(`The ${PERIOD_DAYS} days before were its launch, so it is judged on level only`);
    return { status: "saturating", reasons, causes: [lowShare ? "newShare" : "", ...trendCauses].filter(Boolean), ...shared };
  }

  if (startedInPeriod) {
    reasons.push(`Started in this period, so everyone is new. A trend shows after the next ${PERIOD_DAYS} days`);
    return { status: "room", reasons, causes: [], startedInPeriod: true, ...shared };
  }
  if (shareText) reasons.push(shareText);
  if (previousWasLaunch) {
    reasons.push(`The ${PERIOD_DAYS} days before were its launch (everyone new), so it is judged on level only`);
  } else if (!comparable) {
    reasons.push(`Too little delivery in the previous ${PERIOD_DAYS} days to compare against`);
  }
  return { status: "room", reasons, causes: [], ...shared };
}

// Awareness is judged against its own frequency target as well: high frequency
// is the plan there, not a sign of waste.
function describeFrequency(current, objectiveGroup) {
  if (objectiveGroup !== "awareness" || current.weeklyFrequency == null) return null;
  const t = THRESHOLDS;
  const value = current.weeklyFrequency;
  if (value < t.awarenessWeeklyFrequencyLow) {
    return { tone: "low", text: `${value.toFixed(1)} a week, below the ${t.awarenessWeeklyFrequencyTarget}-a-week awareness target` };
  }
  if (value > t.awarenessWeeklyFrequencyHigh) {
    return { tone: "high", text: `${value.toFixed(1)} a week, well above the ${t.awarenessWeeklyFrequencyTarget}-a-week target` };
  }
  return { tone: "on", text: `${value.toFixed(1)} a week, around the ${t.awarenessWeeklyFrequencyTarget}-a-week target` };
}

function buildAdSetRow({ meta, rowsByRange, windows, actionTypes, estimate = null, accountCostPerNewCustomer = null }) {
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
  const { status, reasons, causes = [], comparable = false, previousWasLaunch = false, startedInPeriod = false } = classifySaturation({
    current,
    previous,
    audienceShare,
    audienceShareApproximate: shareApproximate,
    objectiveGroup,
    accountCostPerNewCustomer
  });
  // Delivery past a lookalike's own size is worth saying in plain words: the
  // budget is buying people outside the audience the ad set was built on.
  if (shareApproximate && audienceShare != null && audienceShare > 1) {
    reasons.push(`Reached ${round(audienceShare, 1)}x the audience estimate: ${audience.advantageAudience ? "Advantage+ audience" : "lookalike expansion"} lets Meta go beyond it`);
  }

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
      shareSinceLookback: audienceShareSinceLookback,
      shareApproximate,
      beyondAudience: shareApproximate && audienceShare != null && audienceShare > 1
    },
    current,
    previous,
    spendPerDay: round(current.spend / PERIOD_DAYS, 2),
    status,
    statusLabel: STATUS_LABELS[status],
    reasons,
    causes,
    comparable,
    previousWasLaunch,
    startedInPeriod,
    frequency: describeFrequency(current, objectiveGroup)
  };
}

function sortRows(rows) {
  return rows.slice().sort((left, right) => {
    const byStatus = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status);
    return byStatus || right.current.spend - left.current.spend;
  });
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
function buildAudienceSaturation({ today, insightRows = [], adSetMeta = [], estimates = {}, actionTypes = {}, graphCalls = 0, accountId = "" }) {
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

  const rows = delivering.map(({ id, meta, rowsByRange }) => buildAdSetRow({
    meta, rowsByRange, windows, actionTypes, estimate: estimates[id] || null, accountCostPerNewCustomer
  }));

  const sorted = sortRows(rows);
  const statusCounts = {};
  for (const row of sorted) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;

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
      "New customers use Meta's incremental attribution, as everywhere else on the dashboard."
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
      fields: "id,name,effective_status,optimization_goal,targeting,campaign{id,name,objective,effective_status}"
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

  return buildAudienceSaturation({
    today,
    insightRows,
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
