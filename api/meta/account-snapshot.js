const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { fetchWithTimeout, sendJson } = require("../../server/lib/http");
const { createMetaSnapshotRuntime } = require("../../server/meta/_snapshot-runtime");
const { createMetaSnapshotFetchers } = require("../../server/meta/_snapshot-fetchers");
const { createMetaSnapshotTransformers } = require("../../server/meta/_snapshot-transformers");
const { createMetaSnapshotDashboardBuilder } = require("../../server/meta/_snapshot-dashboard");
const { isStudioSelectableStatus, isDuplicatableAdStatus } = require("../../server/meta/_catalog-selection");
const {
  buildCustomerAcquisition,
  buildCustomerAcquisitionTrend,
  buildCustomerAcquisitionWarnings,
  compareAcquisitionWindow,
  extractCustomerAcquisition,
  resolveAcquisitionWindowPresets,
  resolveCustomerConversionActionTypes
} = require("../../server/meta/customer-acquisition");
const {
  OBJECTIVE_GROUP_DISPLAY_ORDER,
  buildBudgetSanityWarnings,
  calculateBudgetAllocation,
  classifyCampaign,
  normalizeBudgetValue,
  resolveBudgetNormalization,
  resolveObjectiveGroupLabel,
  splitByCategory
} = require("../../server/meta/budget-allocation");
const { syncHistoricalIntelligence } = require("../../server/meta/historical-intelligence");
const { syncExpansionReach } = require("../../server/meta/expansion-reach");
const {
  getHistoricalStoreProfile,
  readHistoricalIntelligence,
  writeHistoricalIntelligence,
  readExpansionReach,
  writeExpansionReach
} = require("../../server/meta/historical-store");
const {
  sendMetaCatalogCacheHit,
  sendMetaCatalogFallback,
  sendMetaHealthOk,
  sendMetaRateLimitedHealth,
  sendMetaSnapshotCacheHit,
  sendMetaSnapshotFallback,
  sendMetaTransientCatalogFallback
} = require("../../server/meta/_snapshot-responses");

const GRAPH_BASE = "https://graph.facebook.com/v25.0";
const META_SNAPSHOT_SCHEMA_VERSION = 1;
const COPENHAGEN_TIMEZONE = "Europe/Copenhagen";
// A full dashboard snapshot costs about 15 percentage points of Meta's hourly CPU-time
// budget on this account, measured 2026-09-04: the ceiling was 89% before one snapshot and
// 104% after. That is roughly six full refreshes an hour on the development access tier,
// and the throttle is on CPU time, not call count (call_count sat at 4%).
//
// These TTLs were 2 minutes while auto-refresh runs hourly, so the cache had always
// expired by the time it mattered and every click through the dashboard paid for another
// full snapshot. 15 minutes makes routine viewing free without touching the hourly
// refresh, and an explicit "Update snapshot" bypasses every layer, so nobody is stuck
// with figures they cannot refresh.
const META_SNAPSHOT_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const META_CATALOG_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const META_METADATA_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const META_ADS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const META_INSIGHTS_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
// The acquisition panel serves every period preset from one daily series. Those days are
// finished, so the series barely changes; a long TTL keeps the widest query off the
// per-refresh path, which matters while the app is on the development access tier.
const META_ACQUISITION_TREND_CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const META_SERVER_CRON_SCHEDULES = ["45 5 * * *"];
// Fifteen seconds was tighter than this account's heaviest query: the ad-set daily
// insights call was measured at 15,009ms, so it failed by nine milliseconds and took the
// whole snapshot with it. The function itself has a 300s budget (vercel.json), so the
// per-request limit was the binding constraint, not the platform.
const META_REQUEST_TIMEOUT_MS = 30000;
const META_TARGET_REFRESH_SLOTS = [
  { hour: 7, minute: 45, label: "07:45" },
  { hour: 13, minute: 0, label: "13:00" }
];

function buildHistoricalClientSnapshot(snapshot) {
  if (!snapshot) return {};
  return {
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    range: snapshot.range,
    coverage: snapshot.coverage,
    dna: snapshot.dna
  };
}

const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.purchase",
  "offsite_conversion.fb_pixel_purchase"
];

const ADD_TO_CART_ACTION_TYPES = [
  "omni_add_to_cart",
  "add_to_cart",
  "offsite_conversion.add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart"
];

const LEAD_ACTION_TYPES = [
  "lead",
  "omni_lead",
  "offsite_conversion.lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead",
  "submit_application"
];

const {
  buildMetaResourceCacheKey,
  buildSnapshotCacheKey,
  getCachedMetaCollection,
  getCachedSnapshot,
  isCacheFresh,
  isRateLimitError,
  isTransientMetaError,
  metaGet,
  metaGetAll,
  readBundledCatalogFallback,
  setCachedSnapshot
} = createMetaSnapshotRuntime({
  fetchWithTimeout,
  graphBase: GRAPH_BASE,
  requestTimeoutMs: META_REQUEST_TIMEOUT_MS
});
const {
  fetchAwarenessAdSetInsightsCollections,
  fetchCampaignInsightsCollections,
  fetchCustomerAcquisitionTrend,
  fetchDeduplicatedReach,
  fetchCatalogCollections,
  fetchDashboardMetadataCollections
} = createMetaSnapshotFetchers({
  buildMetaResourceCacheKey,
  getCachedMetaCollection,
  metaGetAll
});
const {
  buildActiveAds,
  buildAdSetCollections,
  buildCampaignMetricCollections,
  buildIncludedCampaignContext,
  buildInsightMap,
  buildPreviousOnlyCampaigns,
  buildSeriesMap,
  buildSnapshotStats,
  enrichCampaignsWithAttribution
} = createMetaSnapshotTransformers({
  readNumber,
  getPreferredActionValue,
  getRoasFromInsight,
  sortSeries,
  splitSeriesByDateRange,
  classifyCampaign,
  normalizeBudgetValue,
  formatCurrency,
  resolveBudgetNormalization,
  extractCustomerAcquisition,
  isActiveDeliveryStatus,
  purchaseActionTypes: PURCHASE_ACTION_TYPES,
  addToCartActionTypes: ADD_TO_CART_ACTION_TYPES,
  leadActionTypes: LEAD_ACTION_TYPES
});
const {
  buildSnapshotDashboardAssembly
} = createMetaSnapshotDashboardBuilder({
  splitByCategory,
  classifyCampaign,
  buildQualityWarnings,
  normalizeBudgetValue,
  calculateBudgetAllocation,
  buildCustomerAcquisition,
  buildCustomerAcquisitionTrend,
  buildCustomerAcquisitionWarnings,
  compareAcquisitionWindow,
  resolveAcquisitionWindowPresets,
  resolveCompletedDayComparison,
  formatCurrency,
  buildGeneralSpendDistribution,
  buildLensStats,
  buildHeroPanelItems,
  buildTrendCards,
  buildOverviewCards,
  buildDashboardValidation,
  readNumber
});

function nowMs() {
  return Date.now();
}

function isVercelCronRequest(req) {
  const cronHeader = String(req?.headers?.["x-vercel-cron"] || "").trim();
  const userAgent = String(req?.headers?.["user-agent"] || "").toLowerCase();
  return Boolean(cronHeader) || userAgent.includes("vercel-cron");
}

function isAuthorizedCronRequest(req, config = {}) {
  const authHeader = String(req?.headers?.authorization || "").trim();
  if (!config.cronSecret) {
    return false;
  }
  return authHeader === `Bearer ${config.cronSecret}`;
}

function buildScheduleDiagnostics() {
  return {
    timezone: COPENHAGEN_TIMEZONE,
    targetSlots: META_TARGET_REFRESH_SLOTS.map((slot) => ({ ...slot })),
    serverCronSchedulesUtc: [...META_SERVER_CRON_SCHEDULES],
    serverCronSummary: "One server-side Vercel cron is configured right now.",
    browserDailySummary: "Browser daily refresh can target 07:45 and 13:00 Copenhagen while the dashboard tab is open.",
    notes: [
      "Vercel cron schedules are defined in UTC.",
      "The current production config only includes one server cron path invocation per day.",
      "Browser daily refresh is session-dependent and only runs while an operator has the dashboard open."
    ]
  };
}

function ensureAccountId(accountId) {
  if (!accountId) {
    throw new Error("Missing Meta ad account ID.");
  }

  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

function readNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCurrencyCode(value, fallback = "DKK") {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return normalized || fallback;
}

// The browser formats every other figure through src/format.js. These few are formatted
// here because they are computed here, so they have to agree with it: same locale, same
// decimals. There is no bundler in this repo, so the two constants are duplicated and
// tests/number-format-parity.test.js fails if they drift apart.
const NUMBER_LOCALE = "da-DK";
const MONEY_FRACTION_DIGITS = 0;

function formatCurrency(value, currency = "DKK", fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return new Intl.NumberFormat(NUMBER_LOCALE, {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    minimumFractionDigits: MONEY_FRACTION_DIGITS,
    maximumFractionDigits: MONEY_FRACTION_DIGITS
  }).format(number);
}


function getPreferredActionValue(items, actionTypes) {
  const list = Array.isArray(items) ? items : [];
  const types = Array.isArray(actionTypes) ? actionTypes : [actionTypes];

  for (const type of types) {
    const match = list.find((entry) => entry.action_type === type);
    if (match && match.value != null) {
      return readNumber(match.value, 0);
    }
  }

  return 0;
}

function getRoasFromInsight(insight) {
  const roasList = Array.isArray(insight.purchase_roas) ? insight.purchase_roas : [];
  if (roasList.length && roasList[0]?.value != null) {
    return readNumber(roasList[0].value, 0);
  }

  const webRoasList = Array.isArray(insight.website_purchase_roas) ? insight.website_purchase_roas : [];
  if (webRoasList.length && webRoasList[0]?.value != null) {
    return readNumber(webRoasList[0].value, 0);
  }

  return 0;
}

function normalizeObjective(value) {
  return String(value || "").trim().toUpperCase();
}

function sumMetric(campaigns, key) {
  return (campaigns || []).reduce((sum, item) => sum + readNumber(item?.[key], 0), 0);
}

function isBudgetEligibleStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!status) {
    return false;
  }

  return !new Set([
    "ARCHIVED",
    "DELETED",
    "PENDING_DELETION"
  ]).has(status);
}

function isActiveDeliveryStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "ACTIVE";
}

function buildGeneralSpendDistribution(campaigns = [], dateScope = null, currency = "DKK", budgetAllocation = null) {
  const normalizedCurrency = normalizeCurrencyCode(currency, "DKK");
  const buckets = splitByCategory(campaigns);
  const totalSpend = sumMetric(campaigns, "spend_value");
  const spendLabel = `Spend (${dateScope?.shortLabel || "Scope"})`;
  const safeBudgetAllocation = budgetAllocation || {};
  const periodDays = Math.max(1, readNumber(dateScope?.days, readNumber(safeBudgetAllocation.periodDays, 30)) || 30);

  // Budget is always stated per 30-day month, whatever range is selected, because that is
  // the unit the marketing team budgets and talks in ("the budget is 200k" means per
  // month). Actual spend stays the real amount spent in the selected range, so the two
  // sides cover different windows on purpose and are compared via a 30-day pace below.
  const monthlyBudgetByGroup = safeBudgetAllocation.monthlyBudgetByGroup || {};
  const totalBudgetAmount = readNumber(safeBudgetAllocation.totalMonthlyBudget, 0);
  // Pace is measured on finished days only. "Today" and "This month" include the day in
  // progress, and counting a few hours of spend as a whole day made every pace on those
  // ranges read low - on the first of the month, absurdly so. Where the range has no
  // finished day yet there is no pace, which the panel says rather than printing 0%.
  const paceWindow = resolveCompletedDayComparison(dateScope);
  const paceExcludesToday = Boolean(paceWindow?.excludesToday);
  const paceDays = paceExcludesToday ? (paceWindow.comparable ? paceWindow.days : 0) : periodDays;
  const paceSpendOf = (list = []) => {
    if (!paceExcludesToday) return sumMetric(list, "spend_value");
    if (!paceWindow.comparable) return 0;
    return (list || []).reduce((sum, campaign) => sum + (campaign?.series || [])
      .filter((point) => point.date >= paceWindow.current.since && point.date <= paceWindow.current.until)
      .reduce((total, point) => total + readNumber(point.spend, 0), 0), 0);
  };
  const spendToMonthlyPace = paceDays > 0 ? 30 / paceDays : NaN;
  const totalMonthlySpendPace = paceDays > 0 ? paceSpendOf(campaigns) * spendToMonthlyPace : null;

  const items = OBJECTIVE_GROUP_DISPLAY_ORDER
    .map((group) => ({
      key: group,
      label: resolveObjectiveGroupLabel(group),
      campaignCount: (buckets[group] || []).length,
      amount: sumMetric(buckets[group] || [], "spend_value"),
      budgetAmount: readNumber(monthlyBudgetByGroup[group], 0)
    }))
    .filter((item) => item.campaignCount > 0 || item.amount > 0 || item.budgetAmount > 0)
    .map((item) => {
      const monthlySpendPace = paceDays > 0 ? paceSpendOf(buckets[item.key] || []) * spendToMonthlyPace : null;
      return {
        ...item,
        percentage: totalSpend > 0 ? Number(((item.amount / totalSpend) * 100).toFixed(1)) : 0,
        formattedAmount: formatCurrency(item.amount, normalizedCurrency),
        formattedBudgetAmount: item.budgetAmount > 0 ? formatCurrency(item.budgetAmount, normalizedCurrency) : "--",
        budgetPercentage: totalBudgetAmount > 0 ? Number(((item.budgetAmount / totalBudgetAmount) * 100).toFixed(1)) : 0,
        monthlySpendPace,
        formattedMonthlySpendPace: monthlySpendPace === null ? "--" : formatCurrency(monthlySpendPace, normalizedCurrency),
        // Pacing compares like with like: a 30-day spend pace against the 30-day budget.
        pacePercentage: item.budgetAmount > 0 && monthlySpendPace !== null
          ? Number(((monthlySpendPace / item.budgetAmount) * 100).toFixed(1))
          : null
      };
    });

  const unclassifiedItem = items.find((item) => item.key === "unclassified") || null;

  return {
    currency: normalizedCurrency,
    totalAmount: totalSpend,
    formattedTotalAmount: formatCurrency(totalSpend, normalizedCurrency),
    totalLabel: spendLabel,
    periodDays,
    paceDays,
    paceExcludesToday,
    totalMonthlySpendPace,
    formattedTotalMonthlySpendPace: totalMonthlySpendPace === null ? "--" : formatCurrency(totalMonthlySpendPace, normalizedCurrency),
    totalPacePercentage: totalBudgetAmount > 0 && totalMonthlySpendPace !== null
      ? Number(((totalMonthlySpendPace / totalBudgetAmount) * 100).toFixed(1))
      : null,
    totalBudgetAmount,
    formattedTotalBudgetAmount: totalBudgetAmount > 0 ? formatCurrency(totalBudgetAmount, normalizedCurrency) : "--",
    kpiBudgetAmount: totalBudgetAmount,
    formattedKpiBudgetAmount: totalBudgetAmount > 0 ? formatCurrency(totalBudgetAmount, normalizedCurrency) : "--",
    kpiBudgetLabel: "Planned budget (30 days)",
    kpiBudgetMeta: "Monthly budget from the active Meta campaign and ad set budgets, including lifetime budgets spread across their flight.",
    totalBudgetLabel: "Planned budget (30 days)",
    budgetMixLabel: "Planned budget mix (30 days)",
    spendMixLabel: `Actual spend mix (${dateScope?.shortLabel || "selected range"})`,
    paceLabel: paceDays === 30 ? "Spend vs monthly budget" : "30-day spend pace vs monthly budget",
    rangeLabel: dateScope?.label || "Selected range",
    summaryMeta: `Actual spend covers ${dateScope?.label || "the selected range"}. Planned budget is always stated per 30-day month, and pacing compares a 30-day spend pace against it.`,
    title: "Spend and planned budget",
    subtitle: `Actual spend for ${dateScope?.label || "the selected range"} against the 30-day planned budget, grouped by the objective Meta reports on each campaign.`,
    unclassifiedAmount: readNumber(unclassifiedItem?.amount, 0),
    unclassifiedCampaignCount: readNumber(unclassifiedItem?.campaignCount, 0),
    items
  };
}

function buildQualityWarnings({
  budgetNormalization,
  activeCampaignsWithoutSpend = [],
  dateScope = null,
  awarenessCampaignCount = 0,
  awarenessUsingAdSetInsights = 0,
  awarenessAdSetBreakdownRejected = 0,
  acquisitionTrendUnavailable = false,
  campaignSpendTotal = 0,
  accountSpend = NaN,
  awarenessCampaignSpendTotal = 0,
  awarenessAdSetSpendTotal = 0,
  budgetAllocation = null,
  unclassifiedCampaignCount = 0,
  unclassifiedSpendTotal = 0,
  unclassifiedCampaigns = [],
  accountCurrency = "DKK",
  periodDays = 30
}) {
  const warnings = [];

  if (!budgetNormalization) {
    warnings.push("No budget normalization metadata available.");
  } else if (budgetNormalization.confidence === "assumed") {
    warnings.push("Meta returned no account currency, so budgets were normalized with the two-decimal default.");
  }

  warnings.push(...buildBudgetSanityWarnings({
    totalMonthlyBudget: readNumber(budgetAllocation?.totalMonthlyBudget, 0),
    totalSpend: campaignSpendTotal,
    periodDays,
    currency: accountCurrency
  }));

  // Unmapped objectives are reported rather than absorbed into a real category, because
  // the objective split is used to read budget shares off the dashboard.
  if (unclassifiedCampaignCount > 0) {
    // Name the campaigns and the objectives Meta actually reported, so the warning can be
    // acted on: either the objective belongs in the mapping table, or the campaign needs
    // fixing in Ads Manager. A count alone leaves nowhere to start.
    const named = unclassifiedCampaigns
      .slice(0, 5)
      .map((campaign) => {
        const name = String(campaign?.name || campaign?.id || "unnamed").trim() || "unnamed";
        const objective = String(campaign?.objective || "").trim();
        return objective ? `${name} (${objective})` : `${name} (no objective reported)`;
      });
    const overflow = unclassifiedCampaignCount - named.length;
    const detail = named.length
      ? ` ${named.join("; ")}${overflow > 0 ? `; and ${overflow} more` : ""}.`
      : "";
    warnings.push(`${unclassifiedCampaignCount} campaign(s) carry an objective this dashboard does not map, holding ${formatCurrency(unclassifiedSpendTotal, accountCurrency)} of spend in the Unclassified group.${detail}`);
  }

  if (readNumber(budgetAllocation?.unscheduledLifetimeBudgetCampaignCount, 0) > 0) {
    warnings.push(`${budgetAllocation.unscheduledLifetimeBudgetCampaignCount} campaign(s) use a lifetime budget with no end date, so their budget was spread across the reporting period instead of a real flight.`);
  }

  if (readNumber(budgetAllocation?.campaignsWithoutBudgetCount, 0) > 0) {
    warnings.push(`${budgetAllocation.campaignsWithoutBudgetCount} active campaign(s) reported no daily or lifetime budget and contribute nothing to the planned budget split.`);
  }

  // Named, and only once the range holds a finished day: on "Today" every campaign has
  // spent nothing yet at 01:00 in the account's timezone, which is not a finding.
  const rangeHasFinishedDay = resolveCompletedDayComparison(dateScope)?.comparable !== false;
  if (activeCampaignsWithoutSpend.length > 0 && rangeHasFinishedDay) {
    const names = activeCampaignsWithoutSpend.slice(0, 4).map((campaign) => `"${String(campaign?.name || "unnamed")}"`).join(", ");
    const remainder = activeCampaignsWithoutSpend.length > 4 ? ` and ${activeCampaignsWithoutSpend.length - 4} more` : "";
    warnings.push(`${activeCampaignsWithoutSpend.length} active campaign${activeCampaignsWithoutSpend.length === 1 ? " has" : "s have"} spent nothing in the selected period: ${names}${remainder}.`);
  }

  if (awarenessAdSetBreakdownRejected > 0) {
    warnings.push(
      `${awarenessAdSetBreakdownRejected} awareness campaign${awarenessAdSetBreakdownRejected === 1 ? "'s" : "s'"} ad sets did not add up to what Meta reported for the campaign, so the campaign totals are shown instead of the ad-set breakdown. Reach and CPM are still per campaign; only the per-ad-set detail is missing.`
    );
  }

  const awarenessMissingAdSetData = awarenessCampaignCount - awarenessUsingAdSetInsights - awarenessAdSetBreakdownRejected;
  if (awarenessMissingAdSetData > 0) {
    warnings.push(
      `${awarenessMissingAdSetData} awareness campaign${awarenessMissingAdSetData === 1 ? "" : "s"} returned no ad set insights, so ${awarenessMissingAdSetData === 1 ? "its" : "their"} figures come from the campaign level with no per-ad-set breakdown.`
    );
  }

  if (!(campaignSpendTotal > 0)) {
    warnings.push("No campaign spend was returned for the selected period.");
  }

  // The campaign rows must add up to what the account itself reports. Meta rounds per
  // entity, so a few kroner either way is expected; more than 1% means rows are missing,
  // for instance a campaign archived after it spent.
  if (Number.isFinite(accountSpend) && accountSpend > 0) {
    const gap = Math.abs(accountSpend - campaignSpendTotal);
    if (gap / accountSpend > 0.01) {
      warnings.push(`Campaign spend adds up to ${formatCurrency(campaignSpendTotal, accountCurrency)}, but the account reports ${formatCurrency(accountSpend, accountCurrency)} for the same period. Some spend is not in the campaign figures.`);
    }
  }

  if (acquisitionTrendUnavailable) {
    warnings.push("The day-by-day new-customer figures could not be read from Meta, so the new-customer comparison is missing from this snapshot.");
  }

  return warnings;
}

function buildSpendShare(value, totalSpend) {
  if (!totalSpend || totalSpend <= 0) {
    return "--";
  }
  return `${((value / totalSpend) * 100).toFixed(1)}%`;
}

function buildLensStats(campaigns, lens, dateScope, options = {}) {
  const currency = normalizeCurrencyCode(options.currency, "DKK");
  const comparison = resolveCompletedDayComparison(dateScope);
  const comparisonWindow = buildAggregateComparisonWindow(clipCampaignsToComparison([...campaigns, ...(options.previousOnlyCampaigns || [])], comparison));
  const changeWindowLabel = describeComparisonWindow(comparison, dateScope);
  const spend = sumMetric(campaigns, "spend_value");
  const impressions = sumMetric(campaigns, "impressions_value");
  // Reach counts people, so adding it up across campaigns counts anyone who saw two of
  // them twice. Meta's own deduplicated figure for this set of campaigns is used where
  // it is available; the summed value is kept only as a labelled fallback.
  const deduplicatedReach = readNumber(options.deduplicatedReach?.reach, 0);
  const summedReach = sumMetric(campaigns, "reach_value");
  const reach = deduplicatedReach > 0 ? deduplicatedReach : summedReach;
  const reachIsDeduplicated = deduplicatedReach > 0;
  const clicks = sumMetric(campaigns, "clicks_value");
  const purchases = sumMetric(campaigns, "purchases_value");
  const revenue = sumMetric(campaigns, "revenue_value");
  const leads = sumMetric(campaigns, "leads_value");
  const frequency = reach > 0 ? impressions / reach : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const spendLabel = `Spend (${dateScope?.shortLabel || "Scope"})`;

  // General has no status row of its own. Total spend and the per-objective shares live
  // in the budget panel, next to the planned budget and the pacing they are read against,
  // so repeating them here was a second copy of one fact.
  if (lens === "general") {
    return [];
  }

  if (lens === "awareness") {
    return [
      { label: spendLabel, value: formatCurrency(spend, currency), meta: "Awareness campaigns", change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "neutral", windowLabel: changeWindowLabel }) },
      {
        label: "Reach",
        value: formatDashboardNumber(reach, 0),
        meta: reachIsDeduplicated
          ? `People reached, deduplicated ${dateScope?.label ? "- " + dateScope.label : ""}`.trim()
          : "Sum of campaign reach - people in more than one campaign are counted twice",
        // No badge: the only reach available per day is each campaign's daily reach, and
        // adding that up counts a person once for every day they were reached. The
        // headline is deduplicated; a badge from person-days would not describe it.
        change: null
      },
      {
        label: "Frequency",
        value: frequency ? formatDashboardNumber(frequency, 2) : "--",
        meta: reachIsDeduplicated ? "Impressions / deduplicated reach" : "Impressions / summed reach",
        change: null
      },
      { label: "CPM", value: cpm ? formatCurrency(cpm, currency) : "--", meta: "Spend / 1,000 impressions", change: buildWindowChange(comparisonWindow, "cpm", { positiveDirection: "down", windowLabel: changeWindowLabel }) }
    ];
  }

  if (lens === "leads") {
    return [
      { label: spendLabel, value: formatCurrency(spend, currency), meta: "Lead campaigns", change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "neutral", windowLabel: changeWindowLabel }) },
      { label: "Leads", value: formatDashboardNumber(leads, 0), meta: "Counted as Meta reports them", change: buildWindowChange(comparisonWindow, "leads", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
      { label: "CPL", value: leads > 0 ? formatCurrency(cpl, currency) : "--", meta: "Spend / leads", change: buildWindowChange(comparisonWindow, "cpl", { positiveDirection: "down", windowLabel: changeWindowLabel }) },
      { label: "CTR", value: impressions > 0 ? `${formatDashboardNumber(ctr, 2)}%` : "--", meta: "Clicks / impressions", change: buildWindowChange(comparisonWindow, "ctr", { positiveDirection: "up", windowLabel: changeWindowLabel }) }
    ];
  }

  return [
    { label: spendLabel, value: formatCurrency(spend, currency), meta: "Conversion campaigns", change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "neutral", windowLabel: changeWindowLabel }) },
    { label: "Purchases", value: formatDashboardNumber(purchases, 0), meta: "Incremental attribution", change: buildWindowChange(comparisonWindow, "purchases", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
    { label: "CPA", value: purchases > 0 ? formatCurrency(cpa, currency) : "--", meta: "Spend / purchases", change: buildWindowChange(comparisonWindow, "cpa", { positiveDirection: "down", windowLabel: changeWindowLabel }) },
    { label: "ROAS", value: spend > 0 ? formatDashboardNumber(roas, 2) : "--", meta: "Revenue / spend", change: buildWindowChange(comparisonWindow, "roas", { positiveDirection: "up", windowLabel: changeWindowLabel }) }
  ];
}

function buildAggregateSeries(campaigns = []) {
  const totals = new Map();

  for (const campaign of campaigns || []) {
    for (const point of campaign.series || []) {
      const key = String(point.date || "");
      const current = totals.get(key) || {
        spend: 0,
        reach: 0,
        impressions: 0,
        clicks: 0,
        add_to_cart: 0,
        purchases: 0,
        revenue: 0,
        leads: 0
      };

      totals.set(key, {
        spend: current.spend + readNumber(point.spend, 0),
        reach: current.reach + readNumber(point.reach, 0),
        impressions: current.impressions + readNumber(point.impressions, 0),
        clicks: current.clicks + readNumber(point.clicks, 0),
        add_to_cart: current.add_to_cart + readNumber(point.add_to_cart, 0),
        purchases: current.purchases + readNumber(point.purchases, 0),
        revenue: current.revenue + readNumber(point.revenue, 0),
        leads: current.leads + readNumber(point.leads, 0)
      });
    }
  }

  return Array.from(totals.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({ date, ...value }));
}

function splitAggregateSeries(series = []) {
  if (!Array.isArray(series) || !series.length) {
    return { previous: [], current: [] };
  }

  const midpoint = Math.max(1, Math.floor(series.length / 2));
  return {
    previous: series.slice(0, midpoint),
    current: series.slice(midpoint)
  };
}

function sumAggregateMetric(series = [], key) {
  return (series || []).reduce((sum, point) => sum + readNumber(point?.[key], 0), 0);
}

function computeAggregateMetric(series = [], metric) {
  const spend = sumAggregateMetric(series, "spend");
  const reach = sumAggregateMetric(series, "reach");
  const impressions = sumAggregateMetric(series, "impressions");
  const clicks = sumAggregateMetric(series, "clicks");
  const addToCart = sumAggregateMetric(series, "add_to_cart");
  const purchases = sumAggregateMetric(series, "purchases");
  const revenue = sumAggregateMetric(series, "revenue");
  const leads = sumAggregateMetric(series, "leads");

  if (metric === "spend") return spend;
  if (metric === "reach") return reach;
  if (metric === "impressions") return impressions;
  // A rate with nothing underneath it is undefined, not zero. Returning 0 made a CPA with
  // no purchases read as a -100% "improvement" on the badge.
  if (metric === "frequency") return reach > 0 ? impressions / reach : NaN;
  if (metric === "clicks") return clicks;
  if (metric === "add_to_cart") return addToCart;
  if (metric === "revenue") return revenue;
  if (metric === "ctr") return impressions > 0 ? (clicks / impressions) * 100 : NaN;
  if (metric === "cpm") return impressions > 0 ? (spend / impressions) * 1000 : NaN;
  if (metric === "leads") return leads;
  if (metric === "cpl") return leads > 0 ? spend / leads : NaN;
  if (metric === "purchases") return purchases;
  if (metric === "cpa") return purchases > 0 ? spend / purchases : NaN;
  if (metric === "roas") return spend > 0 ? revenue / spend : NaN;
  return 0;
}

function formatDashboardNumber(value, digits = 0, fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  // Same locale as src/format.js. This was pinned to en-GB, so "45.3%" sat beside
  // "2.013 kr." on one screen.
  return number.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDashboardPercent(value, digits = 1, fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return `${formatDashboardNumber(number, digits)}%`;
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildSeriesTotals(campaigns = [], metricAccessor) {
  const totals = new Map();

  for (const campaign of campaigns || []) {
    for (const point of campaign.series || []) {
      const key = String(point.date || "");
      const current = totals.get(key) || 0;
      totals.set(key, current + readNumber(metricAccessor(point, campaign), 0));
    }
  }

  return Array.from(totals.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({ date, value }));
}

function buildComparisonSeriesTotals(campaigns = [], metricAccessor) {
  const current = buildSeriesTotals(campaigns, (point, campaign) => metricAccessor(point, campaign, "current"));
  const previousCampaigns = (campaigns || [])
    .map((campaign) => ({
      ...campaign,
      series: Array.isArray(campaign?.comparison_window?.previous) ? campaign.comparison_window.previous : []
    }));
  const previous = buildSeriesTotals(previousCampaigns, (point, campaign) => metricAccessor(point, campaign, "previous"));
  // Additive metrics, so the period figure is the sum. Carried alongside the series so
  // the card's comparison badge reads the same basis the headline figure does.
  const sum = (series) => (series || []).reduce((total, point) => total + readNumber(point.value, 0), 0);
  return { current, previous, currentTotal: sum(current), previousTotal: sum(previous) };
}

function buildDerivedSeriesTotals(campaigns = [], numeratorAccessor, denominatorAccessor) {
  const buildDerivedSeries = (inputCampaigns = [], scope = "current") => {
    const totals = new Map();

    for (const campaign of inputCampaigns || []) {
      for (const point of campaign.series || []) {
        const key = String(point.date || "");
        const current = totals.get(key) || { numerator: 0, denominator: 0 };
        totals.set(key, {
          numerator: current.numerator + readNumber(numeratorAccessor(point, campaign, scope), 0),
          denominator: current.denominator + readNumber(denominatorAccessor(point, campaign, scope), 0)
        });
      }
    }

    const rows = Array.from(totals.entries()).sort((left, right) => left[0].localeCompare(right[0]));
    const numerator = rows.reduce((sum, [, value]) => sum + value.numerator, 0);
    const denominator = rows.reduce((sum, [, value]) => sum + value.denominator, 0);

    return {
      series: rows.map(([date, value]) => ({
        date,
        value: value.denominator > 0 ? value.numerator / value.denominator : 0
      })),
      // A rate over a period is the summed numerator over the summed denominator. The
      // per-day values above are each a rate, so adding them would give the sum of the
      // rates - the mistake this file already carries a rule about. The period figure is
      // computed here so the comparison badge on the card cannot get it wrong.
      aggregate: denominator > 0 ? numerator / denominator : null
    };
  };

  const current = buildDerivedSeries(campaigns, "current");
  const previousCampaigns = (campaigns || [])
    .map((campaign) => ({
      ...campaign,
      series: Array.isArray(campaign?.comparison_window?.previous) ? campaign.comparison_window.previous : []
    }));
  const previous = buildDerivedSeries(previousCampaigns, "previous");

  return {
    current: current.series,
    previous: previous.series,
    currentTotal: current.aggregate,
    previousTotal: previous.aggregate
  };
}

function buildAggregateComparisonWindow(campaigns = []) {
  const previousCampaigns = [];
  const currentCampaigns = [];

  for (const campaign of campaigns || []) {
    const comparisonWindow = campaign?.comparison_window || null;
    if (comparisonWindow?.previous?.length) {
      previousCampaigns.push({ series: comparisonWindow.previous });
    }
    if (comparisonWindow?.current?.length) {
      currentCampaigns.push({ series: comparisonWindow.current });
      continue;
    }
    if (Array.isArray(campaign?.series) && campaign.series.length) {
      currentCampaigns.push({ series: campaign.series });
    }
  }

  const previous = buildAggregateSeries(previousCampaigns);
  const current = buildAggregateSeries(currentCampaigns);
  if (previous.length || current.length) {
    return { previous, current };
  }

  return splitAggregateSeries(buildAggregateSeries(campaigns));
}

function formatComparisonWindowLabel(days = 0) {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 0;
  if (!safeDays) {
    return "period";
  }
  if (safeDays === 1) {
    return "day";
  }
  return `${safeDays} days`;
}

// Period-over-period badges compare completed days only, over two windows of the same
// length. Every preset except "yesterday" ends today, and today is still running while
// the matching day of the previous window is finished - so on the first of the month
// "This month" read spend as -84% against yesterday, an artefact of the clock rather
// than anything the account did. Same rule as the new-customer month-to-date comparison.
// With no completed day in range there is nothing honest to compare, so no badge.
//
// A scope without `today` (older callers, fixtures) keeps the whole range, which is
// what the badges always compared.
function resolveCompletedDayComparison(dateScope = null) {
  const since = String(dateScope?.since || "");
  const until = String(dateScope?.until || "");
  const today = String(dateScope?.today || "");
  const sinceDate = parseIsoDate(since);
  if (!sinceDate || !parseIsoDate(until)) {
    return null;
  }

  const excludesToday = Boolean(parseIsoDate(today)) && until >= today;
  const currentUntil = excludesToday ? formatIsoDate(shiftDays(parseIsoDate(today), -1)) : until;
  const currentUntilDate = parseIsoDate(currentUntil);
  const days = Math.round((currentUntilDate.getTime() - sinceDate.getTime()) / 86400000) + 1;
  if (days < 1) {
    return { comparable: false, days: 0, excludesToday };
  }

  const previousUntilDate = shiftDays(sinceDate, -1);
  return {
    comparable: true,
    days,
    excludesToday,
    current: { since, until: currentUntil },
    previous: { since: formatIsoDate(shiftDays(previousUntilDate, -(days - 1))), until: formatIsoDate(previousUntilDate) }
  };
}

// The campaigns as the badges should see them: both series cut to the compared windows.
// The drawn series are left whole - this is only for the totals behind a change badge.
function clipCampaignsToComparison(campaigns = [], comparison = null) {
  if (!comparison) {
    return campaigns || [];
  }
  if (!comparison.comparable) {
    return [];
  }
  const within = (window) => (point) => {
    const date = String(point?.date || "");
    return date >= window.since && date <= window.until;
  };
  return (campaigns || []).map((campaign) => {
    const current = (Array.isArray(campaign?.series) ? campaign.series : []).filter(within(comparison.current));
    const previous = (Array.isArray(campaign?.comparison_window?.previous) ? campaign.comparison_window.previous : [])
      .filter(within(comparison.previous));
    return { ...campaign, series: current, comparison_window: { previous, current } };
  });
}

function describeComparisonWindow(comparison = null, dateScope = null) {
  if (!comparison?.comparable) {
    return formatComparisonWindowLabel(dateScope?.days);
  }
  const label = formatComparisonWindowLabel(comparison.days);
  return comparison.excludesToday ? `${label}, today excluded` : label;
}

// The one rule for every change badge on the dashboard.
//
// - No badge when either side is undefined: a CPA with no purchases has no value to
//   compare, and treating it as 0 printed a green -100%.
// - No badge when both sides are zero: "0.0% flat" asserts that nothing changed, where
//   the truth is that there was nothing to measure.
// - "New" when the previous period had nothing, in a neutral tone: growth from zero is a
//   fact about the baseline, not a verdict.
// - Otherwise the change over the real baseline, coloured by whether up is good for this
//   metric. Spend is neutral: more spend is neither good nor bad by itself.
//
// The stat cards, the trend cards and the General strip used to run three versions of
// this with three different answers to the zero cases.
function buildValueChange(currentValue, previousValue, options = {}) {
  const windowLabel = options.windowLabel || "selected period";
  const label = `vs previous ${windowLabel}`;
  const goodWhen = options.positiveDirection || "up";
  if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
    return null;
  }
  if (previousValue <= 0 && currentValue <= 0) {
    return null;
  }
  if (previousValue <= 0) {
    return { value: "New", percentChange: null, tone: "neutral", label, direction: "new", currentValue, previousValue };
  }

  const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const rounded = Math.round(change * 10) / 10;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const tone = goodWhen === "neutral" || direction === "flat"
    ? "neutral"
    : ((goodWhen === "down") === (direction === "down") ? "positive" : "negative");

  return {
    value: direction === "flat" ? "0,0%" : `${rounded > 0 ? "+" : ""}${formatDashboardNumber(rounded, 1)}%`,
    percentChange: change,
    tone,
    label,
    direction,
    currentValue,
    previousValue
  };
}

function buildWindowChange(series = [], metric, options = {}) {
  const comparisonWindow = series && !Array.isArray(series) && Array.isArray(series.previous) && Array.isArray(series.current)
    ? series
    : null;
  if (!comparisonWindow || (!comparisonWindow.previous.length && !comparisonWindow.current.length)) {
    return null;
  }
  return buildValueChange(
    computeAggregateMetric(comparisonWindow.current, metric),
    computeAggregateMetric(comparisonWindow.previous, metric),
    options
  );
}

// Spend share and efficiency per objective, on General.
//
// Shares are of the account's whole spend and every figure comes from campaign totals, so
// this card agrees with the budget split beside it. It used to take shares of only three
// objectives, read efficiency off the daily series, and draw every objective with spend at
// least 12% wide - a 1% objective looked like an eighth of the account.
function buildGeneralObjectivePerformanceRows(campaigns = [], currency = "DKK") {
  const buckets = splitByCategory(campaigns);
  const totalSpend = sumMetric(campaigns, "spend_value");
  const efficiency = {
    awareness: (list) => {
      const impressions = sumMetric(list, "impressions_value");
      return { label: "CPM", value: impressions > 0 ? formatCurrency((sumMetric(list, "spend_value") / impressions) * 1000, currency) : "--" };
    },
    conversion: (list) => {
      const spend = sumMetric(list, "spend_value");
      return { label: "ROAS", value: spend > 0 ? formatDashboardNumber(sumMetric(list, "revenue_value") / spend, 2) : "--" };
    },
    leads: (list) => {
      const leads = sumMetric(list, "leads_value");
      return { label: "CPL", value: leads > 0 ? formatCurrency(sumMetric(list, "spend_value") / leads, currency) : "--" };
    }
  };

  return OBJECTIVE_GROUP_DISPLAY_ORDER
    .map((key) => ({ key, list: buckets[key] || [] }))
    .filter(({ list }) => sumMetric(list, "spend_value") > 0)
    .map(({ key, list }) => {
      const spend = sumMetric(list, "spend_value");
      const share = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
      const metric = efficiency[key] ? efficiency[key](list) : { label: "", value: "" };
      return {
        key,
        label: resolveObjectiveGroupLabel(key),
        tone: key,
        spend: formatCurrency(spend, currency),
        share: formatDashboardPercent(share, 1),
        width: share,
        metricLabel: metric.label,
        metricValue: metric.value
      };
    });
}

/**
 * How each trend card's numbers are read.
 *
 * Keyed on the card title, because the titles in this file are fixed literals and an
 * explicit table is auditable in a way that sniffing the title for "ROAS" is not. The
 * axis and the tooltip both read this, so a chart cannot end up labelling kroner as a
 * plain count. tests/meta-chart-system.test.js fails if a card is added without an entry.
 *
 *   format   currency | count | ratio | percent
 *   baseline zero for a quantity of something, auto for a rate or a level. A zero
 *            baseline on a ROAS of 5.4 against 5.6 draws one flat line.
 *   goodWhen which direction is an improvement, for the comparison badge. Cost metrics
 *            run the other way: cheaper is better.
 */
const TREND_CARD_READING = Object.freeze({
  "Spend over time": { format: "currency", baseline: "zero", goodWhen: "neutral" },
  "Spend trend": { format: "currency", baseline: "zero", goodWhen: "neutral" },
  "Revenue over time": { format: "currency", baseline: "zero", goodWhen: "up" },
  "Revenue trend": { format: "currency", baseline: "zero", goodWhen: "up" },
  "ROAS over time": { format: "ratio", baseline: "auto", goodWhen: "up" },
  "ROAS trend": { format: "ratio", baseline: "auto", goodWhen: "up" },
  "Reach delivery": { format: "count", baseline: "zero", goodWhen: "up" },
  "CPM trend": { format: "currency", baseline: "auto", goodWhen: "down" },
  "Frequency trend": { format: "ratio", baseline: "auto", goodWhen: "neutral" },
  "Leads trend": { format: "count", baseline: "zero", goodWhen: "up" },
  "CPL trend": { format: "currency", baseline: "auto", goodWhen: "down" },
  "CTR trend": { format: "percent", baseline: "auto", goodWhen: "up" },
  "Purchase trend": { format: "count", baseline: "zero", goodWhen: "up" },
  "CPA trend": { format: "currency", baseline: "auto", goodWhen: "down" },
  "Objective performance": { format: "currency", baseline: "zero", goodWhen: "neutral" }
});

/**
 * Adds the reading and the period-over-period change to each card.
 *
 * The change divides by the real baseline. A period that started from nothing has no
 * percentage to report - "new" says that, where "+100%" would be arithmetic dressed up
 * as a finding.
 */
function withTrendCardReading(cards = [], currency = "DKK", windowLabel = "period") {
  return (cards || []).map((card) => {
    const reading = TREND_CARD_READING[card.title] || { format: "count", baseline: "zero", goodWhen: "neutral" };
    // null means the rate was undefined in that window. readNumber(null) is 0, which is
    // exactly the trap: it turned an undefined rate into a baseline of zero.
    const asNumber = (value) => (value === null || value === undefined ? NaN : Number(value));
    const current = asNumber(card.currentTotal);
    const previous = asNumber(card.previousTotal);

    // Reach and frequency cards draw summed daily reach, which counts a person once per
    // day they were reached. That is a fine shape to draw and a wrong number to compare,
    // so those cards carry no badge; the deduplicated figure is the card's headline.
    const change = card.noComparison
      ? null
      : buildValueChange(current, previous, { positiveDirection: reading.goodWhen, windowLabel });
    const { currentTotal, previousTotal, ...rest } = card;
    return { ...rest, format: reading.format, baseline: reading.baseline, currency, change };
  });
}

function buildTrendCards(campaigns = [], lens = "general", dateScope = null, currency = "DKK", options = {}) {
  const deduplicatedReachTotal = readNumber(options.deduplicatedReach?.reach, 0);
  // Named so the comparison badge says what it is measured against, rather than the
  // bare "vs previous period" that could mean any window.
  const comparison = resolveCompletedDayComparison(dateScope);
  const withPreviousOnly = [...campaigns, ...(options.previousOnlyCampaigns || [])];
  const comparisonCampaigns = clipCampaignsToComparison(withPreviousOnly, comparison);
  const comparisonWindowLabel = describeComparisonWindow(comparison, dateScope);
  const trendDates = (campaigns || [])
    .flatMap((campaign) => campaign.series || [])
    .map((point) => point.date)
    .filter(Boolean)
    .sort();
  const lastDate = trendDates[trendDates.length - 1];
  const meta = lastDate
    ? `${dateScope?.label || "Selected range"} ending ${formatShortDate(lastDate)}`
    : (dateScope?.label || "Selected range");
  // The drawn series cover the whole range; the badge totals cover completed days only.
  const withComparison = (buildTotals) => {
    const totals = buildTotals(withPreviousOnly);
    const compared = buildTotals(comparisonCampaigns);
    return {
      series: totals.current,
      comparisonSeries: totals.previous,
      currentTotal: compared.currentTotal,
      previousTotal: compared.previousTotal
    };
  };

  if (lens === "general") {
    const totalSpend = sumMetric(campaigns, "spend_value");
    const totalRevenue = sumMetric(campaigns, "revenue_value");
    return withTrendCardReading([
      {
        title: "Spend over time",
        meta,
        value: formatCurrency(totalSpend, currency),
        ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.spend || 0)),
        tone: "conversion"
      },
      {
        title: "Revenue over time",
        meta,
        value: formatCurrency(totalRevenue, currency),
        tone: "conversion",
        ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.revenue || 0))
      },
      {
        title: "ROAS over time",
        meta,
        value: totalSpend > 0 ? formatDashboardNumber(totalRevenue / totalSpend, 2) : "--",
        tone: "conversion",
        ...withComparison((input) => buildDerivedSeriesTotals(input,
          (point) => readNumber(point.revenue, 0),
          (point) => readNumber(point.spend, 0)
        ))
      },
      {
        title: "Objective performance",
        meta: "Spend plus efficiency by objective",
        kind: "objective-bars",
        tone: "conversion",
        rows: buildGeneralObjectivePerformanceRows(campaigns, currency)
      }
    ], currency, comparisonWindowLabel);
  }

  if (lens === "awareness") {
    const impressions = sumMetric(campaigns, "impressions_value");
    const spend = sumMetric(campaigns, "spend_value");
    return withTrendCardReading([
      {
        title: "Spend trend",
        meta,
        value: formatCurrency(spend, currency),
        ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.spend || 0)),
        tone: "awareness"
      },
      {
        title: "Reach delivery",
        meta,
        value: formatDashboardNumber(deduplicatedReachTotal > 0 ? deduplicatedReachTotal : sumMetric(campaigns, "reach_value"), 0),
        ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.reach || 0)),
        noComparison: true,
        tone: "awareness",
        hero: true
      },
      {
        title: "CPM trend",
        meta,
        value: impressions > 0 ? formatCurrency((spend / impressions) * 1000, currency) : "--",
        ...withComparison((input) => buildDerivedSeriesTotals(input,
          (point) => readNumber(point.spend, 0) * 1000,
          (point) => readNumber(point.impressions, 0)
        )),
        tone: "awareness"
      },
      {
        title: "Frequency trend",
        meta,
        value: (() => {
          // An unweighted mean of per-campaign frequency, divided by every campaign
          // including the ones that never delivered, is not this set's frequency.
          const totalImpressions = sumMetric(campaigns, "impressions_value");
          const totalReach = deduplicatedReachTotal > 0 ? deduplicatedReachTotal : sumMetric(campaigns, "reach_value");
          return totalReach > 0 ? formatDashboardNumber(totalImpressions / totalReach, 2) : "--";
        })(),
        ...withComparison((input) => buildDerivedSeriesTotals(input,
          (point) => readNumber(point.impressions, 0),
          (point) => readNumber(point.reach, 0)
        )),
        noComparison: true,
        tone: "awareness"
      }
    ], currency, comparisonWindowLabel);
  }

  if (lens === "leads") {
    const totalLeads = sumMetric(campaigns, "leads_value");
    const totalSpend = sumMetric(campaigns, "spend_value");
    const totalImpressions = sumMetric(campaigns, "impressions_value");
    const totalClicks = sumMetric(campaigns, "clicks_value");
    return withTrendCardReading([
      {
        title: "Spend trend",
        meta,
        value: formatCurrency(totalSpend, currency),
        ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.spend || 0)),
        tone: "leads"
      },
      {
        title: "Leads trend",
        meta,
        value: formatDashboardNumber(totalLeads, 0),
        ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.leads || 0)),
        tone: "leads",
        hero: true
      },
      {
        title: "CPL trend",
        meta,
        value: totalLeads > 0 ? formatCurrency(totalSpend / totalLeads, currency) : "--",
        ...withComparison((input) => buildDerivedSeriesTotals(input,
          (point) => readNumber(point.spend, 0),
          (point) => readNumber(point.leads, 0)
        )),
        tone: "leads"
      },
      {
        title: "CTR trend",
        meta,
        value: totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : "--",
        ...withComparison((input) => buildDerivedSeriesTotals(input,
          (point) => readNumber(point.clicks, 0) * 100,
          (point) => readNumber(point.impressions, 0)
        )),
        tone: "leads"
      }
    ], currency, comparisonWindowLabel);
  }

  const totalSpend = sumMetric(campaigns, "spend_value");
  const totalRevenue = sumMetric(campaigns, "revenue_value");
  const totalPurchases = sumMetric(campaigns, "purchases_value");
  const tone = "conversion";

  return withTrendCardReading([
    {
      title: "Spend trend",
      meta,
      value: formatCurrency(totalSpend, currency),
      ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.spend || 0)),
      tone
    },
    {
      title: "Revenue trend",
      meta,
      value: formatCurrency(totalRevenue, currency),
      ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.revenue || 0)),
      tone,
      hero: true
    },
    {
      title: "ROAS trend",
      meta,
      value: totalSpend > 0 ? formatDashboardNumber(totalRevenue / totalSpend, 2) : "--",
      ...withComparison((input) => buildDerivedSeriesTotals(input,
        (point) => point.revenue || 0,
        (point) => point.spend || 0
      )),
      tone
    },
    {
      title: "CPA trend",
      meta,
      value: totalPurchases > 0 ? formatCurrency(totalSpend / totalPurchases, currency) : "--",
      ...withComparison((input) => buildDerivedSeriesTotals(input,
        (point) => point.spend || 0,
        (point) => point.purchases || 0
      )),
      tone
    },
    {
      title: "Purchase trend",
      meta,
      value: formatDashboardNumber(totalPurchases, 0),
      ...withComparison((input) => buildComparisonSeriesTotals(input, (point) => point.purchases || 0)),
      tone
    }
  ], currency, comparisonWindowLabel);
}

function buildOverviewCards(campaigns = [], currency = "DKK", options = {}) {
  const deduplicatedAwarenessReach = readNumber(options.deduplicatedReach?.reach, 0);
  const buckets = splitByCategory(campaigns);
  const totalSpend = sumMetric(campaigns, "spend_value");
  const spendShare = (value) => totalSpend > 0
    ? `${((readNumber(value, 0) / totalSpend) * 100).toFixed(1)}% of spend`
    : null;

  const buildTopItems = (list, metricKey, formatter) => (
    [...list]
      .sort((left, right) => readNumber(right?.[metricKey], 0) - readNumber(left?.[metricKey], 0))
      .slice(0, 3)
      .map((campaign) => ({
        label: campaign.name,
        value: formatter(readNumber(campaign?.[metricKey], 0))
      }))
  );

  return [
    {
      key: "awareness",
      meta: [`${buckets.awareness.length} campaigns in lens`, spendShare(sumMetric(buckets.awareness, "spend_value"))].filter(Boolean).join(" · "),
      metric: formatDashboardNumber(deduplicatedAwarenessReach > 0 ? deduplicatedAwarenessReach : sumMetric(buckets.awareness, "reach_value"), 0),
      items: buildTopItems(buckets.awareness, "reach_value", (value) => `${formatDashboardNumber(value, 0)} reach`)
    },
    {
      key: "leads",
      meta: [`${buckets.leads.length} campaigns in lens`, spendShare(sumMetric(buckets.leads, "spend_value"))].filter(Boolean).join(" · "),
      metric: formatDashboardNumber(sumMetric(buckets.leads, "leads_value"), 0),
      items: buildTopItems(buckets.leads, "leads_value", (value) => `${formatDashboardNumber(value, 0)} leads`)
    },
    {
      key: "conversion",
      meta: [`${buckets.conversion.length} campaigns in lens`, spendShare(sumMetric(buckets.conversion, "spend_value"))].filter(Boolean).join(" · "),
      metric: formatCurrency(sumMetric(buckets.conversion, "revenue_value"), currency),
      items: buildTopItems(buckets.conversion, "revenue_value", (value) => formatCurrency(value, currency))
    }
  ];
}

// The change badges on the two new-customer tiles in the General strip.
//
// They compare the same completed days as the Spend and ROAS tiles beside them, from the
// account-level daily rows the new-customer panel is built on. The tiles used to print the
// selected range's count beside a month-to-date badge: on "Last 7 days" a 7-day number sat
// next to a change measured over a different month. Month to date lives in the panel
// directly below, which names its own window.
function buildAcquisitionRangeChange(rangeComparison = null, field = "newCustomers", options = {}) {
  if (!rangeComparison) {
    return null;
  }
  const read = (side) => {
    const totals = rangeComparison[side] || {};
    if (field === "costPerNewCustomer") {
      const customers = readNumber(totals.newCustomers, 0);
      return customers > 0 ? readNumber(totals.spend, 0) / customers : NaN;
    }
    return readNumber(totals[field], NaN);
  };
  return buildValueChange(read("current"), read("previous"), options);
}

function buildHeroPanelItems(campaigns = [], lens = "general", currency = "DKK", dateScope = null, options = {}) {
  const deduplicatedHeroReach = readNumber(options.deduplicatedReach?.reach, 0);
  const comparison = resolveCompletedDayComparison(dateScope);
  const comparisonWindow = buildAggregateComparisonWindow(clipCampaignsToComparison([...campaigns, ...(options.previousOnlyCampaigns || [])], comparison));
  const changeWindowLabel = describeComparisonWindow(comparison, dateScope);

  // Every figure here comes from the campaign totals Meta reported for the range, which
  // is the same basis `buildLensStats` uses for the cards directly below this strip.
  //
  // These used to be summed from the daily series instead. The series only carries the
  // days Meta returned a row for, so the two panels disagreed whenever a day was missing
  // or an action was attributed after the fact - the incremental lens showed 74 purchases
  // in the strip and 78 in the card underneath it, on the same screen, for the same
  // period. The daily series is for drawing shapes; the campaign total is the answer.
  const spend = sumMetric(campaigns, "spend_value");
  const impressions = sumMetric(campaigns, "impressions_value");
  const revenue = sumMetric(campaigns, "revenue_value");
  const purchases = sumMetric(campaigns, "purchases_value");
  const leads = sumMetric(campaigns, "leads_value");
  const reach = deduplicatedHeroReach > 0 ? deduplicatedHeroReach : sumMetric(campaigns, "reach_value");
  // Rates are summed numerator over summed denominator, never an average of per-campaign
  // rates.
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

  if (lens === "general") {
    const acquisition = options.customerAcquisition || null;
    // Account-level figures for the range where they exist (see rangeTotals), so the
    // strip and the new-customer panel print one number for one fact.
    const rangeTotals = acquisition?.rangeTotals || null;
    const newCustomers = rangeTotals ? readNumber(rangeTotals.newCustomers, 0) : readNumber(acquisition?.newCustomers, 0);
    const costPerNewCustomer = rangeTotals
      ? (readNumber(rangeTotals.newCustomers, 0) > 0 ? readNumber(rangeTotals.spend, 0) / readNumber(rangeTotals.newCustomers, 0) : 0)
      : readNumber(acquisition?.costPerNewCustomer, 0);
    const acquisitionAvailable = Boolean(acquisition?.available);
    const rangeComparison = acquisition?.rangeComparison || null;
    const newCustomerChange = buildAcquisitionRangeChange(rangeComparison, "newCustomers", { positiveDirection: "up", windowLabel: changeWindowLabel });
    const costPerNewCustomerChange = buildAcquisitionRangeChange(rangeComparison, "costPerNewCustomer", { positiveDirection: "down", windowLabel: changeWindowLabel });

    return [
      {
        label: "New customers",
        value: acquisitionAvailable ? formatDashboardNumber(newCustomers, 0) : "--",
        meta: acquisitionAvailable
          ? `${dateScope?.label || "Selected range"} · New_customer conversion`
          : "No New_customer conversion on this account",
        change: newCustomerChange,
        tone: "success"
      },
      {
        label: "Cost per new customer",
        value: acquisitionAvailable && costPerNewCustomer > 0 ? formatCurrency(costPerNewCustomer, currency) : "--",
        meta: acquisitionAvailable ? String(acquisition?.costPerNewCustomerBasis || "Spend / new customers") : "Not available",
        change: costPerNewCustomerChange,
        tone: "warning"
      },
      {
        label: "Spend",
        value: formatCurrency(spend, currency),
        meta: dateScope?.label || "Selected range",
        change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "neutral", windowLabel: changeWindowLabel }),
        tone: "neutral"
      },
      {
        label: "ROAS",
        value: spend > 0 ? formatDashboardNumber(roas, 2) : "--",
        meta: "Revenue / spend",
        change: buildWindowChange(comparisonWindow, "roas", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "success"
      }
    ];
  }

  // Every other lens has a stat row directly below this strip, and the strip was a
  // strict subset of it: Spend, Purchases and ROAS on the conversion lenses, Spend,
  // Reach and CPM on awareness, Spend, Leads and CPL on leads. The same facts twice on
  // one screen, which is the same reason General lost its stat row.
  //
  // It was not merely redundant. The two panels were computed from different sources -
  // this one from the daily series, the cards from the campaign totals - so the
  // incremental lens showed 74 purchases in the strip and 78 in the card underneath it.
  // One number per fact is what stops that happening again.
  //
  // General keeps its strip because General has no stat row, and because new customers
  // and cost per new customer belong at the top of the page.
  return [];
}

function buildValidationCheck(id, label, status, detail, extra = {}) {
  return {
    id,
    label,
    status,
    detail,
    ...extra
  };
}

function buildDashboardValidation({ campaigns = [], dashboard = null }) {
  const quality = dashboard?.quality || {};
  const currency = dashboard?.currency || "DKK";
  const statsByLens = dashboard?.statsByLens || {};
  const checks = [];

  // The one reconciliation with a genuinely independent other side: what the campaign
  // rows add up to against what Meta reports for the account as a whole. The split and
  // budget checks that used to sit here compared a sum with itself and could not fail.
  const campaignSpend = readNumber(quality.reconciliation?.campaignSpendTotal, sumMetric(campaigns, "spend_value"));
  const accountSpend = readNumber(quality.reconciliation?.accountSpend, NaN);
  if (Number.isFinite(accountSpend) && accountSpend > 0) {
    const gap = Math.abs(accountSpend - campaignSpend);
    const within = gap / accountSpend <= 0.01;
    checks.push(buildValidationCheck(
      "account-spend",
      "Spend reconciles to the account",
      within ? "pass" : "fail",
      within
        ? `Campaign spend ${formatCurrency(campaignSpend, currency)} matches the account's ${formatCurrency(accountSpend, currency)}.`
        : `Campaign spend ${formatCurrency(campaignSpend, currency)} against the account's ${formatCurrency(accountSpend, currency)}.`,
      { expected: accountSpend, actual: campaignSpend, delta: Number((accountSpend - campaignSpend).toFixed(2)) }
    ));
  } else {
    checks.push(buildValidationCheck(
      "account-spend",
      "Spend reconciles to the account",
      "warn",
      "The account total did not come back, so campaign spend could not be checked against it."
    ));
  }

  // General has no stat row by design: its totals and objective shares are the budget
  // panel's, and repeating them was one fact in two places.
  const statLenses = ["awareness", "leads", "conversion"];
  const missingStatsLenses = statLenses.filter((lens) => !Array.isArray(statsByLens[lens]) || !statsByLens[lens].length);
  checks.push(buildValidationCheck(
    "lens-coverage",
    "Lens coverage",
    !missingStatsLenses.length ? "pass" : "fail",
    !missingStatsLenses.length
      ? "Every lens that has a stat row has one."
      : `Missing stats for: ${missingStatsLenses.join(", ")}.`
  ));

  checks.push(buildValidationCheck(
    "campaign-coverage",
    "Campaign coverage",
    campaigns.length > 0 ? "pass" : "warn",
    campaigns.length > 0
      ? `${campaigns.length} campaigns were included in the snapshot payload.`
      : "No campaigns were included in the snapshot payload."
  ));

  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const failCount = checks.filter((check) => check.status === "fail").length;

  return {
    ok: failCount === 0,
    passCount,
    warnCount,
    failCount,
    checks
  };
}

function sortSeries(series) {
  return (series || []).slice().sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function resolveTodayInTimeZone(timeZone = "", now = new Date()) {
  if (!timeZone) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
    const year = read("year");
    const month = read("month");
    const day = read("day");
    if (!year || !month || !day) {
      throw new Error("incomplete parts");
    }
    return new Date(Date.UTC(year, month - 1, day));
  } catch (error) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}

function buildPresetRange(preset, timeZone = "") {
  const todayUtc = resolveTodayInTimeZone(timeZone);

  if (preset === "today") {
    return { since: formatIsoDate(todayUtc), until: formatIsoDate(todayUtc), label: "Today" };
  }
  if (preset === "yesterday") {
    const yesterday = shiftDays(todayUtc, -1);
    return { since: formatIsoDate(yesterday), until: formatIsoDate(yesterday), label: "Yesterday" };
  }
  // The rolling presets are whole days ending yesterday, which is what Ads Manager means
  // by "Last 7 days", so a figure here can be found there. They used to end today: a few
  // hours of the current day were counted as a day, pacing ran low, and "Last 30 days"
  // here was a different window from "Last 30 days" in the new-customer panel below.
  const yesterdayUtc = shiftDays(todayUtc, -1);
  if (preset === "last_14d") {
    return { since: formatIsoDate(shiftDays(todayUtc, -14)), until: formatIsoDate(yesterdayUtc), label: "Last 14 days" };
  }
  if (preset === "last_30d") {
    return { since: formatIsoDate(shiftDays(todayUtc, -30)), until: formatIsoDate(yesterdayUtc), label: "Last 30 days" };
  }
  if (preset === "this_month") {
    return { since: formatIsoDate(startOfMonth(todayUtc)), until: formatIsoDate(todayUtc), label: "This month" };
  }

  return { since: formatIsoDate(shiftDays(todayUtc, -7)), until: formatIsoDate(yesterdayUtc), label: "Last 7 days" };
}

function formatScopeLabel(since, until, fallback) {
  if (!since || !until) return fallback;
  if (since === until) return fallback;

  const sinceDate = parseIsoDate(since);
  const untilDate = parseIsoDate(until);
  if (!sinceDate || !untilDate) return fallback;

  const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  return `${formatter.format(sinceDate)} - ${formatter.format(untilDate)}`;
}

function buildDateScope(query = {}, timeZone = "") {
  const preset = String(query.preset || "last_7d");
  // Carried so the change badges can leave out the day still in progress.
  const today = formatIsoDate(resolveTodayInTimeZone(timeZone));
  const from = String(query.from || "");
  const to = String(query.to || "");

  if (preset === "custom") {
    const fromDate = parseIsoDate(from);
    const toDate = parseIsoDate(to);
    if (!fromDate || !toDate) {
      throw new Error("Custom date range requires valid from/to dates.");
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error("From date must be before or equal to to date.");
    }

    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (diffDays > 90) {
      throw new Error("Custom date range must be 90 days or less.");
    }

    return {
      since: from,
      until: to,
      label: formatScopeLabel(from, to, "Custom range"),
      shortLabel: formatScopeLabel(from, to, "Custom"),
      days: diffDays,
      preset: "custom",
      today
    };
  }

  const range = buildPresetRange(preset, timeZone);
  const sinceDate = parseIsoDate(range.since);
  const untilDate = parseIsoDate(range.until);
  const diffDays = sinceDate && untilDate
    ? Math.round((untilDate.getTime() - sinceDate.getTime()) / 86400000) + 1
    : 7;
  return {
    ...range,
    shortLabel: range.label,
    days: diffDays,
    preset,
    today
  };
}

function buildComparisonDateScope(scope = {}) {
  const untilDate = parseIsoDate(scope?.until || "");
  const days = Number.isFinite(scope?.days) && scope.days > 0 ? Math.round(scope.days) : 0;
  if (!untilDate || !days) {
    return null;
  }

  const comparisonUntil = shiftDays(untilDate, -days);
  const comparisonSince = shiftDays(comparisonUntil, -(days - 1));
  return {
    since: formatIsoDate(comparisonSince),
    until: formatIsoDate(untilDate)
  };
}

function splitSeriesByDateRange(series = [], since = "", until = "") {
  const previous = [];
  const current = [];

  for (const point of sortSeries(series)) {
    const date = String(point?.date || "");
    if (!date) {
      continue;
    }
    if (since && date >= since && (!until || date <= until)) {
      current.push(point);
    } else if (!since || date < since) {
      previous.push(point);
    }
  }

  return { previous, current };
}

// Remembered from the last successful read, so a request whose very first call fails can
// still find the cached snapshot for its range. The range is resolved in the account's
// timezone, and without it the cache key could not be built at all.
let lastKnownAccountTimeZone = "";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  const cronRequest = isVercelCronRequest(req);
  const authorizedCronRequest = isAuthorizedCronRequest(req, config);
  if (!cronRequest && !authorizedCronRequest && !requireAuth(req, res, config)) {
    return;
  }
  if (!config.metaAccessToken || !config.metaAdAccountId) {
    sendJson(res, 500, { error: "Missing Meta credentials." });
    return;
  }

  const historicalAction = String(req.query?.historical || "").toLowerCase();
  if (["status", "sync"].includes(historicalAction)) {
    try {
      if (historicalAction === "sync") {
        const snapshot = await syncHistoricalIntelligence({
          accountId: config.metaAdAccountId,
          accessToken: config.metaAccessToken,
          days: req.query?.days
        });
        await writeHistoricalIntelligence(snapshot);
        sendJson(res, 200, { ok: true, ready: true, store: getHistoricalStoreProfile(), ...buildHistoricalClientSnapshot(snapshot) });
        return;
      }
      const snapshot = await readHistoricalIntelligence();
      sendJson(res, 200, {
        ok: true,
        ready: Boolean(snapshot),
        store: getHistoricalStoreProfile(),
        ...buildHistoricalClientSnapshot(snapshot)
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || "Meta historical intelligence failed." });
    }
    return;
  }

  // The expansion reach series. "status" is what the dashboard calls on every
  // load and costs no Meta quota at all - it reads the stored snapshot. "sync"
  // is the nightly cron, and is the only path that spends calls. Keep it that
  // way: the cumulative curve behind this series costs one call per month on a
  // cold run, which is more than the whole dashboard snapshot.
  const expansionAction = String(req.query?.expansion || "").toLowerCase();
  if (["status", "sync"].includes(expansionAction)) {
    try {
      if (expansionAction === "sync") {
        const previous = await readExpansionReach().catch(() => null);
        const snapshot = await syncExpansionReach({
          accountId: config.metaAdAccountId,
          accessToken: config.metaAccessToken,
          previous,
          months: req.query?.months,
          force: String(req.query?.force || "") === "1"
        });
        await writeExpansionReach(snapshot);
        sendJson(res, 200, { ok: true, ready: true, store: getHistoricalStoreProfile(), expansion: snapshot });
        return;
      }
      const snapshot = await readExpansionReach();
      sendJson(res, 200, {
        ok: true,
        ready: Boolean(snapshot),
        store: getHistoricalStoreProfile(),
        expansion: snapshot || null
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || "Meta expansion reach sync failed." });
    }
    return;
  }

  let healthOnly = false;
  let catalogOnly = false;
  let dateScope = null;
  let comparisonDateScope = null;
  let snapshotCacheKey = "";
  let forceRefresh = false;

  try {
    healthOnly = String(req.query?.health || "") === "1";
    catalogOnly = String(req.query?.catalog || "") === "1";
    forceRefresh = String(req.query?.force || "") === "1";
    const accountId = ensureAccountId(config.metaAdAccountId);
    // The account is read first because its timezone decides what "today" means to Meta.
    // Building the date range before knowing that produced ranges shifted by most of a
    // day against the data they asked for.
    const account = await metaGet(
      `/${accountId}`,
      config.metaAccessToken,
      {
        fields: "id,name,account_status,currency,timezone_name"
      },
      {
        maxRetries: healthOnly ? 1 : 4
      }
    );
    const accountCurrency = normalizeCurrencyCode(account.currency, "DKK");
    const accountTimeZone = String(account.timezone_name || "").trim();
    lastKnownAccountTimeZone = accountTimeZone || lastKnownAccountTimeZone;

    dateScope = buildDateScope(req.query || {}, accountTimeZone);
    comparisonDateScope = buildComparisonDateScope(dateScope);
    snapshotCacheKey = buildSnapshotCacheKey(dateScope);

    if (healthOnly) {
      sendMetaHealthOk({
        res,
        sendJson,
        schedule: buildScheduleDiagnostics(),
        account,
        currency: accountCurrency
      });
      return;
    }

    if (catalogOnly) {
      const catalogCacheKey = "catalog";
      const forceCatalogRefresh = forceRefresh;
      const cachedCatalog = getCachedSnapshot(catalogCacheKey);
      if (!forceCatalogRefresh && isCacheFresh(cachedCatalog, META_CATALOG_CACHE_MAX_AGE_MS)) {
        sendMetaCatalogCacheHit({
          res,
          sendJson,
          cachedCatalog
        });
        return;
      }

      const { campaignResponse, adsResponse, adSetsResponse } = await fetchCatalogCollections({
        accountId,
        accessToken: config.metaAccessToken,
        metadataCacheMaxAgeMs: META_METADATA_CACHE_MAX_AGE_MS,
        adsCacheMaxAgeMs: META_ADS_CACHE_MAX_AGE_MS
      });

      const selectableCampaigns = (campaignResponse.data || []).filter((campaign) => {
        return isStudioSelectableStatus(campaign?.effective_status || campaign?.status);
      });
      const selectableCampaignIds = new Set(selectableCampaigns.map((campaign) => String(campaign?.id || "")));

      const adSets = (adSetsResponse.data || [])
        .filter((adSet) => {
          const campaignId = String(adSet?.campaign?.id || "");
          return campaignId
            && selectableCampaignIds.has(campaignId)
            && isStudioSelectableStatus(adSet?.effective_status || adSet?.status);
        })
        .map((adSet) => ({
          id: adSet.id,
          name: adSet.name,
          status: adSet.status || adSet.effective_status || "",
          attribution_spec: Array.isArray(adSet.attribution_spec) ? adSet.attribution_spec : [],
          attribution_setting: adSet.attribution_setting || "",
          campaignId: adSet?.campaign?.id || "",
          campaignName: adSet?.campaign?.name || ""
        }));

      const activeAds = (adsResponse.data || []).filter((ad) => {
        const campaignId = String(ad?.campaign?.id || "");
        return campaignId
          && selectableCampaignIds.has(campaignId)
          && isDuplicatableAdStatus(ad?.effective_status || ad?.status);
      });

      const responsePayload = {
        schemaVersion: META_SNAPSHOT_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        scope: {
          label: "Studio catalog",
          shortLabel: "Catalog",
          preset: "catalog"
        },
        account: {
          id: account.id,
          name: account.name,
          currency: accountCurrency
        },
        campaigns: selectableCampaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status || campaign.effective_status || "",
          objective: campaign.objective || ""
        })),
        adSets,
        ads: activeAds.map((ad) => ({
          id: ad.id,
          name: ad.name,
          campaign: ad?.campaign?.name || "",
          primary: "Live ad synced from Meta",
          headline: ad?.creative?.name || "Creative headline not loaded yet",
          description: "Creative details can be expanded in the next integration step.",
          adset: ad?.adset?.name || ""
        })),
        stats: [],
        dashboard: null
      };

      setCachedSnapshot(catalogCacheKey, responsePayload);
      sendJson(res, 200, responsePayload);
      return;
    }

    const cachedSnapshot = getCachedSnapshot(snapshotCacheKey);
    if (!forceRefresh && isCacheFresh(cachedSnapshot, META_SNAPSHOT_CACHE_MAX_AGE_MS)) {
      sendMetaSnapshotCacheHit({
        res,
        sendJson,
        cachedSnapshot
      });
      return;
    }

    const timings = {};
    const snapshotStartedAt = nowMs();

    const { campaignResponse, adsResponse, adSetsResponse, customConversionsResponse } = await fetchDashboardMetadataCollections({
      accountId,
      accessToken: config.metaAccessToken,
      metadataCacheMaxAgeMs: META_METADATA_CACHE_MAX_AGE_MS,
      adsCacheMaxAgeMs: META_ADS_CACHE_MAX_AGE_MS,
      timings,
      bypassCache: forceRefresh
    });

    // New_customer / Existing_customer are resolved by name from the account's own
    // custom conversions, so recreating them in Events Manager cannot silently break the
    // count the way a hardcoded id would.
    const customerConversionActionTypes = resolveCustomerConversionActionTypes(customConversionsResponse?.data || []);

    const activeCampaigns = (campaignResponse.data || []).filter((campaign) => campaign.status === "ACTIVE");
    const budgetCampaignsRaw = (campaignResponse.data || []).filter((campaign) => {
      return isActiveDeliveryStatus(campaign?.effective_status || campaign?.status);
    });

    const {
      aggregatedInsightsResponse: rawAggregatedInsightsResponse,
      dailyInsightsResponse
    } = await fetchCampaignInsightsCollections({
      accountId,
      accessToken: config.metaAccessToken,
      dateScope,
      comparisonDateScope,
      insightsCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
      timings,
      bypassCache: forceRefresh
    });
    // Asking for `attribution_setting` makes Meta return a row for every campaign that
    // has ever existed on the account, because an attribution setting is configuration
    // and exists whether or not the campaign delivered. Without this the snapshot went
    // from 15 campaigns to 358, of which 343 were entirely empty, and every lens table
    // filled up with campaigns that spent nothing in the range.
    //
    // A row with no spend, no impressions, no clicks and no actions is a configuration
    // echo rather than a result. Dropping it restores exactly the set Meta used to
    // return, which is what `includedCampaigns` and the reach filters are built around.
    const aggregatedInsightsResponse = {
      ...rawAggregatedInsightsResponse,
      data: (rawAggregatedInsightsResponse?.data || []).filter((row) => {
        return readNumber(row?.spend, 0) > 0
          || readNumber(row?.impressions, 0) > 0
          || readNumber(row?.inline_link_clicks, 0) > 0
          || (Array.isArray(row?.actions) && row.actions.length > 0);
      })
    };

    // New customers is the KPI the marketing team is measured on, so it needs a trend
    // beside the level: month to date against the same elapsed point last month.
    // Boundaries are resolved in the ad account timezone, which is what Meta uses for a
    // time_range, and is not the user timezone on this account.
    // Wide enough for every panel preset, not just month to date.
    const acquisitionTrendWindows = resolveAcquisitionWindowPresets(new Date(), account.timezone_name || "");
    const acquisitionTrendResponse = await fetchCustomerAcquisitionTrend({
      accountId,
      accessToken: config.metaAccessToken,
      trendWindow: acquisitionTrendWindows.fetch,
      today: acquisitionTrendWindows.today?.date || "",
      insightsCacheMaxAgeMs: META_ACQUISITION_TREND_CACHE_MAX_AGE_MS,
      todayCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
      timings,
      bypassCache: forceRefresh
    }).catch(() => ({ data: [], pageCount: 0, unavailable: true }));

    // Matches the lens: active now, or spent in the selected period. Deriving it from
    // the active list alone made the reach figure cover a different set of campaigns from
    // the spend printed next to it.
    const campaignIdsWithPeriodSpend = new Set(
      (aggregatedInsightsResponse.data || [])
        .map((row) => String(row?.campaign_id || ""))
        .filter(Boolean)
    );
    const awarenessCampaignIds = new Set(
      (campaignResponse.data || [])
        .filter((campaign) => classifyCampaign(campaign) === "awareness")
        .filter((campaign) => {
          const id = String(campaign?.id || "");
          return id && (campaign.status === "ACTIVE" || campaignIdsWithPeriodSpend.has(id));
        })
        .map((campaign) => String(campaign?.id || ""))
    );

    const [accountReach, awarenessReach] = await Promise.all([
      fetchDeduplicatedReach({
        accountId,
        accessToken: config.metaAccessToken,
        dateScope,
        scopeKey: "account",
        insightsCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
        timings,
        bypassCache: forceRefresh
      }).catch(() => null),
      fetchDeduplicatedReach({
        accountId,
        accessToken: config.metaAccessToken,
        dateScope,
        campaignIds: Array.from(awarenessCampaignIds),
        scopeKey: "awareness",
        insightsCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
        timings,
        bypassCache: forceRefresh
      }).catch(() => null)
    ]);

    let aggregatedAdSetInsightsResponse = { data: [], pageCount: 0 };
    let dailyAdSetInsightsResponse = { data: [], pageCount: 0 };
    if (awarenessCampaignIds.size > 0) {
      ({
        aggregatedAdSetInsightsResponse,
        dailyAdSetInsightsResponse
      } = await fetchAwarenessAdSetInsightsCollections({
        accountId,
        accessToken: config.metaAccessToken,
        dateScope,
        comparisonDateScope,
        insightsCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
        timings,
        bypassCache: forceRefresh
      }));
    } else {
      timings.adset_insights_aggregated_ms = 0;
      timings.adset_insights_daily_ms = 0;
      timings.adset_insights_skipped = "no_awareness_campaigns";
    }

    const insightMap = buildInsightMap(aggregatedInsightsResponse.data || [], "campaign_id");
    const seriesMap = buildSeriesMap(dailyInsightsResponse.data || [], "campaign_id");
    const adSetInsightMap = buildInsightMap(aggregatedAdSetInsightsResponse.data || [], "adset_id");
    const adSetSeriesMap = buildSeriesMap(dailyAdSetInsightsResponse.data || [], "adset_id");

    const {
      includedCampaignIds,
      includedCampaigns,
      totalSpend,
      budgetNormalization
    } = buildIncludedCampaignContext({
      campaignRows: campaignResponse.data || [],
      activeCampaigns,
      budgetCampaignsRaw,
      adSetRows: adSetsResponse.data || [],
      insightMap,
      dateScope,
      accountCurrency
    });

    const {
      adSets,
      budgetAdSets,
      adSetsByCampaignId
    } = buildAdSetCollections({
      adSetRows: adSetsResponse.data || [],
      includedCampaignIds,
      budgetNormalization,
      adSetInsightMap,
      adSetSeriesMap
    });

    const activeAds = buildActiveAds(adsResponse.data || [], includedCampaignIds);
    const stats = buildSnapshotStats({
      includedCampaigns,
      activeAds,
      insightMap,
      dateScope,
      accountCurrency
    });

    const {
      awarenessUsingAdSetInsights,
      awarenessAdSetBreakdownRejected,
      campaigns
    } = buildCampaignMetricCollections({
      includedCampaigns,
      adSetsByCampaignId,
      insightMap,
      seriesMap,
      dateScope,
      accountCurrency,
      budgetNormalization,
      customerConversionActionTypes
    });

    const enrichedCampaigns = enrichCampaignsWithAttribution({
      campaigns,
      adSetsByCampaignId
    });
    const previousOnlyCampaigns = buildPreviousOnlyCampaigns({
      campaignRows: campaignResponse.data || [],
      includedCampaignIds,
      seriesMap,
      dateScope
    });

    const {
      dashboard,
      ads,
      qualityWarnings
    } = buildSnapshotDashboardAssembly({
      enrichedCampaigns,
      previousOnlyCampaigns,
      includedCampaigns,
      adSets,
      activeAds,
      budgetCampaignsRaw,
      budgetAdSets,
      adSetsByCampaignId,
      budgetNormalization,
      customerConversionActionTypes,
      acquisitionTrendRows: acquisitionTrendResponse?.data || [],
      acquisitionTrendUnavailable: Boolean(acquisitionTrendResponse?.unavailable),
      accountTimezone: account.timezone_name || "",
      deduplicatedReach: { account: accountReach, awareness: awarenessReach },
      awarenessUsingAdSetInsights,
      awarenessAdSetBreakdownRejected,
      totalSpend,
      dateScope,
      accountCurrency,
      activeCampaigns,
      campaignResponse,
      aggregatedInsightsResponse,
      dailyInsightsResponse,
      adSetsResponse,
      aggregatedAdSetInsightsResponse,
      dailyAdSetInsightsResponse,
      adsResponse,
      timings,
      buildScheduleDiagnostics
    });
    timings.total_snapshot_ms = nowMs() - snapshotStartedAt;

    const responsePayload = {
      schemaVersion: META_SNAPSHOT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      scope: dateScope,
      account: {
        id: account.id,
        name: account.name,
        currency: accountCurrency
      },
      campaigns: enrichedCampaigns,
      adSets,
      ads,
      stats,
      dashboard
    };

    setCachedSnapshot(snapshotCacheKey, responsePayload);
    console.log("[meta-sync]", JSON.stringify({
      scope: `${dateScope.since}:${dateScope.until}`,
      totalMs: timings.total_snapshot_ms,
      includedCampaignCount: includedCampaigns.length,
      warnings: qualityWarnings.length,
      timings
    }));
    sendJson(res, 200, responsePayload);
  } catch (error) {
    if (!healthOnly && catalogOnly && isTransientMetaError(error.message || "")) {
      const cachedCatalog = getCachedSnapshot("catalog");
      if (cachedCatalog?.payload) {
        sendMetaTransientCatalogFallback({
          res,
          sendJson,
          cachedCatalog,
          reason: error.message || "Meta transient error"
        });
        return;
      }
    }
    if (healthOnly && isRateLimitError(error.message || "")) {
      sendMetaRateLimitedHealth({
        res,
        sendJson,
        schedule: buildScheduleDiagnostics(),
        accountId: ensureAccountId(config.metaAdAccountId),
        error: error.message || "Meta rate limit"
      });
      return;
    }
    if (catalogOnly) {
      const cachedCatalog = getCachedSnapshot("catalog");
      const bundledCatalog = readBundledCatalogFallback();
      const fallbackCatalog = cachedCatalog?.payload || bundledCatalog;
      if (fallbackCatalog) {
        sendMetaCatalogFallback({
          res,
          sendJson,
          fallbackCatalog,
          cachedAt: cachedCatalog?.cachedAt || "",
          reason: error.message || "Meta rate limit"
        });
        return;
      }
    }
    // Any failure to reach Meta serves the last snapshot for this range, labelled with its
    // age and the reason. It used to be rate limits only, so a timeout returned a bare 500,
    // and when the account call itself failed there was no cache key to look up.
    const fallbackCacheKey = snapshotCacheKey || (() => {
      try {
        return buildSnapshotCacheKey(buildDateScope(req.query || {}, lastKnownAccountTimeZone));
      } catch {
        return "";
      }
    })();
    if (!healthOnly && !catalogOnly && fallbackCacheKey) {
      const cachedSnapshot = getCachedSnapshot(fallbackCacheKey);
      if (cachedSnapshot?.payload) {
        sendMetaSnapshotFallback({
          res,
          sendJson,
          cachedSnapshot,
          reason: error.message || "Meta could not be reached"
        });
        return;
      }
    }
    sendJson(res, 500, {
      error: error.message || "Meta snapshot refresh failed."
    });
  }
};

// Test-only surface. The Vercel handler is the default export above; these internals are
// attached so the objective split and its reconciliation checks can be unit tested
// without standing up an HTTP request or calling the Meta Graph API.
module.exports.__internals = {
  buildHeroPanelItems,
  buildDashboardValidation,
  buildGeneralSpendDistribution,
  buildLensStats,
  buildQualityWarnings,
  buildAcquisitionRangeChange,
  buildPresetRange,
  buildSnapshotDashboardAssembly,
  buildTrendCards,
  buildWindowChange,
  buildValueChange,
  resolveTodayInTimeZone
};
