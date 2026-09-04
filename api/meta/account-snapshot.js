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
  resolveMonthToDateWindows,
  extractCustomerAcquisition,
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
const {
  getHistoricalStoreProfile,
  readHistoricalIntelligence,
  writeHistoricalIntelligence
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
const META_SNAPSHOT_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const META_CATALOG_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const META_METADATA_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const META_ADS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const META_INSIGHTS_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const META_SERVER_CRON_SCHEDULES = ["45 5 * * *"];
const META_REQUEST_TIMEOUT_MS = 15000;
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

const META_ATTRIBUTION_OVERRIDES = {
  campaignIds: {},
  campaignNames: {}
};
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
  resolveConversionAttribution,
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
  splitConversionByAttribution,
  buildIncrementalLensCampaigns,
  findCampaignIdOverlap,
  classifyCampaign,
  hasIncrementalNameTag,
  buildQualityWarnings,
  resolveConversionAttribution,
  classifyConversionAttribution,
  normalizeBudgetValue,
  calculateBudgetAllocation,
  buildCustomerAcquisition,
  buildCustomerAcquisitionTrend,
  buildCustomerAcquisitionWarnings,
  formatCurrency,
  buildGeneralSpendDistribution,
  buildLensStats,
  buildLensSummary,
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

function getCopenhagenNowParts() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: COPENHAGEN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(new Date());
  const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute")
  };
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

function normalizeCurrencyCode(value, fallback = "EUR") {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return normalized || fallback;
}

function resolveAttributionOverride(campaign) {
  const campaignId = String(campaign?.id || "").trim();
  const campaignName = String(campaign?.name || "").trim().toLowerCase();

  const byId = META_ATTRIBUTION_OVERRIDES.campaignIds?.[campaignId];
  if (byId === "standard" || byId === "incremental") {
    return { mode: byId, source: "manual override", explicit: true };
  }

  const byName = META_ATTRIBUTION_OVERRIDES.campaignNames?.[campaignName];
  if (byName === "standard" || byName === "incremental") {
    return { mode: byName, source: "manual override", explicit: true };
  }

  return null;
}

function formatCurrency(value, currency = "EUR", fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    maximumFractionDigits: 2
  }).format(number);
}

function getActionValue(items, actionTypes) {
  const list = Array.isArray(items) ? items : [];
  const types = Array.isArray(actionTypes) ? actionTypes : [actionTypes];

  return types.reduce((sum, type) => {
    const match = list.find((entry) => entry.action_type === type);
    if (!match || match.value == null) {
      return sum;
    }
    return sum + readNumber(match.value, 0);
  }, 0);
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

function hasIncrementalNameTag(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) {
    return false;
  }

  return /\binkrementel\b/.test(name)
    || /\bincremental\b/.test(name)
    || /\[inc\]|\(inc\)/.test(name);
}

function hasStandardNameTag(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) {
    return false;
  }

  return /\bstandard\b/.test(name)
    || /\[std\]|\(std\)/.test(name);
}

function resolveAttributionNameTag(campaign) {
  const rawName = String(campaign?.name || "").trim();
  if (!rawName) {
    return null;
  }

  if (hasIncrementalNameTag(rawName)) {
    return { mode: "incremental", source: "campaign naming tag", explicit: true };
  }
  if (hasStandardNameTag(rawName)) {
    return { mode: "standard", source: "campaign naming tag", explicit: true };
  }

  return null;
}

function resolveConversionAttribution(campaign, adSetNames = [], adSetAttributionSpecs = []) {
  const override = resolveAttributionOverride(campaign);
  if (override) {
    return override;
  }

  const nameTag = resolveAttributionNameTag(campaign);
  if (nameTag) {
    return nameTag;
  }

  const explicitMode = String(campaign?.attribution_mode || campaign?.attributionMode || campaign?.measurement_mode || "")
    .trim()
    .toLowerCase();
  if (explicitMode === "standard") {
    return { mode: "standard", source: "campaign field", explicit: true };
  }

  return { mode: "standard", source: "non-inkrementel default", explicit: false };
}

function classifyConversionAttribution(campaign) {
  return resolveConversionAttribution(campaign, campaign?.adset_names || [], campaign?.adset_attribution_specs || []).mode;
}

function splitConversionByAttribution(campaigns) {
  const buckets = { standard: [], incremental: [] };
  for (const campaign of campaigns || []) {
    const mode = classifyConversionAttribution(campaign);
    buckets[mode].push(campaign);
  }
  return buckets;
}

function buildIncrementalLensCampaigns(campaigns = []) {
  const conversionCampaigns = splitByCategory(campaigns).conversion;
  return splitConversionByAttribution(conversionCampaigns).incremental
    .map((campaign) => ({
      ...campaign,
      attribution_mode: "incremental",
      attribution_source: campaign?.attribution_source || "campaign naming tag",
      purchases_value: campaign?.incremental_metrics_available
        ? readNumber(campaign?.incremental_purchases_value, 0)
        : readNumber(campaign?.purchases_value, 0),
      revenue_value: campaign?.incremental_metrics_available
        ? readNumber(campaign?.incremental_revenue_value, 0)
        : readNumber(campaign?.revenue_value, 0),
      roas_value: campaign?.incremental_metrics_available
        ? readNumber(campaign?.incremental_roas_value, 0)
        : readNumber(campaign?.roas_value, 0),
      cpa_value: campaign?.incremental_metrics_available
        ? readNumber(campaign?.incremental_cpa_value, 0)
        : readNumber(campaign?.cpa_value, 0),
      series: Array.isArray(campaign?.incremental_series) && campaign.incremental_series.length
        ? campaign.incremental_series
        : campaign.series,
      comparison_window: campaign?.incremental_metrics_available
        ? (campaign?.incremental_comparison_window || campaign?.comparison_window || null)
        : (campaign?.comparison_window || null)
    }));
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
  const spendToMonthlyPace = 30 / periodDays;
  const totalMonthlySpendPace = totalSpend * spendToMonthlyPace;

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
      const monthlySpendPace = item.amount * spendToMonthlyPace;
      return {
        ...item,
        percentage: totalSpend > 0 ? Number(((item.amount / totalSpend) * 100).toFixed(1)) : 0,
        formattedAmount: formatCurrency(item.amount, normalizedCurrency),
        formattedBudgetAmount: item.budgetAmount > 0 ? formatCurrency(item.budgetAmount, normalizedCurrency) : "--",
        budgetPercentage: totalBudgetAmount > 0 ? Number(((item.budgetAmount / totalBudgetAmount) * 100).toFixed(1)) : 0,
        monthlySpendPace,
        formattedMonthlySpendPace: formatCurrency(monthlySpendPace, normalizedCurrency),
        // Pacing compares like with like: a 30-day spend pace against the 30-day budget.
        pacePercentage: item.budgetAmount > 0 ? Number(((monthlySpendPace / item.budgetAmount) * 100).toFixed(1)) : 0
      };
    });

  const unclassifiedItem = items.find((item) => item.key === "unclassified") || null;

  return {
    currency: normalizedCurrency,
    totalAmount: totalSpend,
    formattedTotalAmount: formatCurrency(totalSpend, normalizedCurrency),
    totalLabel: spendLabel,
    periodDays,
    totalMonthlySpendPace,
    formattedTotalMonthlySpendPace: formatCurrency(totalMonthlySpendPace, normalizedCurrency),
    totalPacePercentage: totalBudgetAmount > 0
      ? Number(((totalMonthlySpendPace / totalBudgetAmount) * 100).toFixed(1))
      : 0,
    totalBudgetAmount,
    formattedTotalBudgetAmount: totalBudgetAmount > 0 ? formatCurrency(totalBudgetAmount, normalizedCurrency) : "--",
    kpiBudgetAmount: totalBudgetAmount,
    formattedKpiBudgetAmount: totalBudgetAmount > 0 ? formatCurrency(totalBudgetAmount, normalizedCurrency) : "--",
    kpiBudgetLabel: "Planned budget (30 days)",
    kpiBudgetMeta: "Monthly budget from the active Meta campaign and ad set budgets, including lifetime budgets spread across their flight.",
    totalBudgetLabel: "Planned budget (30 days)",
    budgetMixLabel: "Planned budget mix (30 days)",
    spendMixLabel: `Actual spend mix (${dateScope?.shortLabel || "selected range"})`,
    paceLabel: periodDays === 30 ? "Spend vs monthly budget" : "30-day spend pace vs monthly budget",
    rangeLabel: dateScope?.label || "Selected range",
    summaryMeta: `Actual spend covers ${dateScope?.label || "the selected range"}. Planned budget is always stated per 30-day month, and pacing compares a 30-day spend pace against it.`,
    title: "Spend and planned budget",
    subtitle: `Actual spend for ${dateScope?.label || "the selected range"} against the 30-day planned budget, grouped by the objective Meta reports on each campaign. Conversion combines standard and incremental campaigns here.`,
    unclassifiedAmount: readNumber(unclassifiedItem?.amount, 0),
    unclassifiedCampaignCount: readNumber(unclassifiedItem?.campaignCount, 0),
    items
  };
}

function findCampaignIdOverlap(leftCampaigns = [], rightCampaigns = []) {
  const leftIds = new Set((leftCampaigns || []).map((campaign) => String(campaign?.id || "")).filter(Boolean));
  return (rightCampaigns || [])
    .map((campaign) => String(campaign?.id || ""))
    .filter((id) => id && leftIds.has(id));
}

function buildQualityWarnings({
  budgetNormalization,
  includedCampaignCount = 0,
  campaignsWithPeriodDataCount = 0,
  awarenessCampaignCount = 0,
  awarenessUsingAdSetInsights = 0,
  conversionCampaignCount = 0,
  explicitIncrementalCount = 0,
  incrementalNamedCount = 0,
  attributionOverlapCount = 0,
  nonNamedIncrementalMetricsCount = 0,
  campaignSpendTotal = 0,
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

  if (includedCampaignCount > campaignsWithPeriodDataCount) {
    warnings.push("Some included campaigns are active now but have no spend data in the selected period.");
  }

  if (awarenessCampaignCount > 0 && awarenessUsingAdSetInsights < awarenessCampaignCount) {
    warnings.push("Not all awareness campaigns had ad set insight coverage.");
  }

  if (awarenessCampaignCount > 0 && awarenessCampaignSpendTotal > 0) {
    const delta = Math.abs(awarenessCampaignSpendTotal - awarenessAdSetSpendTotal);
    const deltaRatio = delta / Math.max(awarenessCampaignSpendTotal, 1);
    if (deltaRatio > 0.03) {
      warnings.push("Awareness campaign spend and ad set spend differ by more than 3%.");
    }
  }

  if (!(campaignSpendTotal > 0)) {
    warnings.push("No campaign spend was returned for the selected period.");
  }

  if (conversionCampaignCount > 0 && incrementalNamedCount === 0) {
    warnings.push("No conversion campaigns were named 'inkrementel' in this snapshot.");
  }

  if (attributionOverlapCount > 0) {
    warnings.push("Standard and incremental conversion lenses overlap. Review attribution classification immediately.");
  }

  if (nonNamedIncrementalMetricsCount > 0) {
    warnings.push(`Incremental insight rows existed for ${nonNamedIncrementalMetricsCount} non-'inkrementel' conversion campaigns and were kept out of the incremental lens.`);
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
  const currency = normalizeCurrencyCode(options.currency, "EUR");
  const comparisonWindow = buildAggregateComparisonWindow(campaigns);
  const changeWindowLabel = formatComparisonWindowLabel(dateScope?.days);
  const spend = sumMetric(campaigns, "spend_value");
  const reach = sumMetric(campaigns, "reach_value");
  const impressions = sumMetric(campaigns, "impressions_value");
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

  if (lens === "general") {
    const generalSpendDistribution = options.generalSpendDistribution
      || buildGeneralSpendDistribution(campaigns, dateScope, currency);
    return [
      {
        label: generalSpendDistribution.totalLabel,
        value: generalSpendDistribution.totalAmount > 0 ? formatCurrency(generalSpendDistribution.totalAmount, currency) : "--",
        meta: "Real category spend base"
      },
      ...generalSpendDistribution.items.map((item) => ({
        label: item.label,
        value: item.formattedAmount,
        meta: `${item.percentage.toFixed(1)}% of total spend`
      }))
    ];
  }

  if (lens === "awareness") {
    return [
      { label: spendLabel, value: formatCurrency(spend, currency), meta: "Awareness campaigns", change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
      { label: "Reach", value: String(Math.round(reach)), meta: dateScope?.label || "Selected range", change: buildWindowChange(comparisonWindow, "reach", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
      { label: "Frequency", value: frequency ? frequency.toFixed(2) : "--", meta: "Impressions / reach", change: buildWindowChange(comparisonWindow, "frequency", { positiveDirection: "down", windowLabel: changeWindowLabel }) },
      { label: "CPM", value: cpm ? formatCurrency(cpm, currency) : "--", meta: "Spend / 1,000 impressions", change: buildWindowChange(comparisonWindow, "cpm", { positiveDirection: "down", windowLabel: changeWindowLabel }) }
    ];
  }

  if (lens === "leads") {
    return [
      { label: spendLabel, value: formatCurrency(spend, currency), meta: "Lead campaigns", change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
      { label: "Leads", value: String(Math.round(leads)), meta: "From actions", change: buildWindowChange(comparisonWindow, "leads", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
      { label: "CPL", value: leads > 0 ? formatCurrency(cpl, currency) : "--", meta: "Spend / leads", change: buildWindowChange(comparisonWindow, "cpl", { positiveDirection: "down", windowLabel: changeWindowLabel }) },
      { label: "CTR", value: ctr ? `${ctr.toFixed(2)}%` : "--", meta: "Clicks / impressions", change: buildWindowChange(comparisonWindow, "ctr", { positiveDirection: "up", windowLabel: changeWindowLabel }) }
    ];
  }

  return [
    { label: spendLabel, value: formatCurrency(spend, currency), meta: lens === "conversion_incremental" ? "Incremental campaigns" : "Conversion campaigns", change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
    { label: "Purchases", value: String(Math.round(purchases)), meta: "From actions", change: buildWindowChange(comparisonWindow, "purchases", { positiveDirection: "up", windowLabel: changeWindowLabel }) },
    { label: "CPA", value: purchases > 0 ? formatCurrency(cpa, currency) : "--", meta: "Spend / purchases", change: buildWindowChange(comparisonWindow, "cpa", { positiveDirection: "down", windowLabel: changeWindowLabel }) },
    { label: "ROAS", value: roas ? roas.toFixed(2) : "--", meta: "Revenue / spend", change: buildWindowChange(comparisonWindow, "roas", { positiveDirection: "up", windowLabel: changeWindowLabel }) }
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
  if (metric === "frequency") return reach > 0 ? impressions / reach : 0;
  if (metric === "clicks") return clicks;
  if (metric === "add_to_cart") return addToCart;
  if (metric === "revenue") return revenue;
  if (metric === "ctr") return impressions > 0 ? (clicks / impressions) * 100 : 0;
  if (metric === "cpm") return impressions > 0 ? (spend / impressions) * 1000 : 0;
  if (metric === "leads") return leads;
  if (metric === "cpl") return leads > 0 ? spend / leads : 0;
  if (metric === "purchases") return purchases;
  if (metric === "cpa") return purchases > 0 ? spend / purchases : 0;
  if (metric === "roas") return spend > 0 ? revenue / spend : 0;
  return 0;
}

function describeMetricDirection(previousValue, currentValue, threshold = 0.05) {
  const previous = readNumber(previousValue, 0);
  const current = readNumber(currentValue, 0);

  if (previous <= 0 && current <= 0) return "flat";
  if (previous <= 0 && current > 0) return "up";

  const delta = (current - previous) / Math.max(Math.abs(previous), 1);
  if (Math.abs(delta) < threshold) return "flat";
  return delta > 0 ? "up" : "down";
}

function buildMetricClause(label, previousValue, currentValue) {
  return `${label} ${describeMetricDirection(previousValue, currentValue)}`;
}

function buildLensSummary(campaigns, lens, dateScope) {
  const rangeLabel = dateScope?.label || "Selected range";
  const { previous, current } = buildAggregateComparisonWindow(campaigns);

  if (!current.length) {
    return `${rangeLabel}: no meaningful data in the selected scope.`;
  }

  if (lens === "awareness") {
    return `${rangeLabel}: ${buildMetricClause("spend", computeAggregateMetric(previous, "spend"), computeAggregateMetric(current, "spend"))}, ${buildMetricClause("CPM", computeAggregateMetric(previous, "cpm"), computeAggregateMetric(current, "cpm"))}, and ${buildMetricClause("CTR", computeAggregateMetric(previous, "ctr"), computeAggregateMetric(current, "ctr"))}.`;
  }

  if (lens === "leads") {
    return `${rangeLabel}: ${buildMetricClause("lead volume", computeAggregateMetric(previous, "leads"), computeAggregateMetric(current, "leads"))}, ${buildMetricClause("CPL", computeAggregateMetric(previous, "cpl"), computeAggregateMetric(current, "cpl"))}, and ${buildMetricClause("CTR", computeAggregateMetric(previous, "ctr"), computeAggregateMetric(current, "ctr"))}.`;
  }

  if (lens === "conversion_standard" || lens === "conversion_incremental") {
    return `${rangeLabel}: ${buildMetricClause("purchases", computeAggregateMetric(previous, "purchases"), computeAggregateMetric(current, "purchases"))}, ${buildMetricClause("CPA", computeAggregateMetric(previous, "cpa"), computeAggregateMetric(current, "cpa"))}, ${buildMetricClause("ROAS", computeAggregateMetric(previous, "roas"), computeAggregateMetric(current, "roas"))}, and ${buildMetricClause("CTR", computeAggregateMetric(previous, "ctr"), computeAggregateMetric(current, "ctr"))}.`;
  }

  const buckets = splitByCategory(campaigns);
  const conversionBuckets = splitConversionByAttribution(buckets.conversion);
  const incrementalCampaigns = buildIncrementalLensCampaigns(campaigns);
  const awareness = buildAggregateComparisonWindow(buckets.awareness);
  const leads = buildAggregateComparisonWindow(buckets.leads);
  const standard = buildAggregateComparisonWindow(conversionBuckets.standard);
  const incremental = buildAggregateComparisonWindow(incrementalCampaigns);

  return `${rangeLabel}: awareness ${buildMetricClause("CPM", computeAggregateMetric(awareness.previous, "cpm"), computeAggregateMetric(awareness.current, "cpm"))}, leads ${buildMetricClause("CPL", computeAggregateMetric(leads.previous, "cpl"), computeAggregateMetric(leads.current, "cpl"))}, standard conversion ${buildMetricClause("ROAS", computeAggregateMetric(standard.previous, "roas"), computeAggregateMetric(standard.current, "roas"))}, and incremental ${buildMetricClause("ROAS", computeAggregateMetric(incremental.previous, "roas"), computeAggregateMetric(incremental.current, "roas"))}.`;
}

function formatDashboardNumber(value, digits = 0, fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return number.toLocaleString("en-GB", {
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
  return { current, previous };
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

    return Array.from(totals.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({
        date,
        value: value.denominator > 0 ? value.numerator / value.denominator : 0
      }));
  };

  const current = buildDerivedSeries(campaigns, "current");
  const previousCampaigns = (campaigns || [])
    .map((campaign) => ({
      ...campaign,
      series: Array.isArray(campaign?.comparison_window?.previous) ? campaign.comparison_window.previous : []
    }));
  const previous = buildDerivedSeries(previousCampaigns, "previous");

  return { current, previous };
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

function buildChangeLabel(direction = "flat", windowLabel = "selected period") {
  if (direction === "new") return `new vs previous ${windowLabel}`;
  return `vs previous ${windowLabel}`;
}

function buildWindowChange(series = [], metric, options = {}) {
  const comparisonWindow = series && !Array.isArray(series) && Array.isArray(series.previous) && Array.isArray(series.current)
    ? series
    : splitAggregateSeries(series);
  const { previous, current } = comparisonWindow;
  const windowLabel = options.windowLabel || "selected period";
  if (!previous.length && !current.length) {
    return null;
  }

  const previousValue = computeAggregateMetric(previous, metric);
  const currentValue = computeAggregateMetric(current, metric);
  if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
    return null;
  }

  if (previousValue <= 0 && currentValue <= 0) {
    return {
      value: "0.0%",
      percentChange: 0,
      tone: "neutral",
      label: buildChangeLabel("flat", windowLabel),
      direction: "flat",
      currentValue,
      previousValue
    };
  }

  if (previousValue <= 0 && currentValue > 0) {
    return {
      value: "New",
      percentChange: null,
      tone: options.positiveDirection === "down" ? "negative" : "positive",
      label: buildChangeLabel("new", windowLabel),
      direction: "new",
      currentValue,
      previousValue
    };
  }

  const change = ((currentValue - previousValue) / Math.max(Math.abs(previousValue), 1)) * 100;
  const isPositive = options.positiveDirection === "down" ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 0.1;

  return {
    value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
    percentChange: change,
    tone: isNeutral ? "neutral" : (isPositive ? "positive" : "negative"),
    label: buildChangeLabel(isNeutral ? "flat" : (change > 0 ? "up" : "down"), windowLabel),
    direction: isNeutral ? "flat" : (change > 0 ? "up" : "down"),
    currentValue,
    previousValue
  };
}

function buildGeneralObjectivePerformanceRows(campaigns = [], currency = "EUR") {
  const buckets = splitByCategory(campaigns);
  const objectiveGroups = [
    {
      key: "awareness",
      label: "Brand Awareness",
      campaigns: buckets.awareness,
      tone: "awareness",
      metricLabel: "CPM",
      metricValue: (() => {
        const series = buildAggregateSeries(buckets.awareness);
        const cpm = computeAggregateMetric(series, "cpm");
        return cpm > 0 ? formatCurrency(cpm, currency) : "--";
      })()
    },
    {
      key: "conversion",
      label: "Conversion",
      campaigns: buckets.conversion,
      tone: "conversion",
      metricLabel: "ROAS",
      metricValue: (() => {
        const series = buildAggregateSeries(buckets.conversion);
        const roas = computeAggregateMetric(series, "roas");
        return roas > 0 ? formatDashboardNumber(roas, 2) : "--";
      })()
    },
    {
      key: "leads",
      label: "Leads",
      campaigns: buckets.leads,
      tone: "leads",
      metricLabel: "CPL",
      metricValue: (() => {
        const series = buildAggregateSeries(buckets.leads);
        const cpl = computeAggregateMetric(series, "cpl");
        return cpl > 0 ? formatCurrency(cpl, currency) : "--";
      })()
    }
  ];

  const maxSpend = Math.max(...objectiveGroups.map((group) => sumMetric(group.campaigns, "spend_value")), 1);
  const totalSpend = objectiveGroups.reduce((sum, group) => sum + sumMetric(group.campaigns, "spend_value"), 0);

  return objectiveGroups.map((group) => {
    const spend = sumMetric(group.campaigns, "spend_value");
    return {
      key: group.key,
      label: group.label,
      tone: group.tone,
      spend: formatCurrency(spend, currency),
      share: totalSpend > 0 ? formatDashboardPercent((spend / totalSpend) * 100, 1) : "0.0%",
      width: Math.max(spend > 0 ? 12 : 0, (spend / maxSpend) * 100),
      metricLabel: group.metricLabel,
      metricValue: group.metricValue
    };
  });
}

function buildTrendCards(campaigns = [], lens = "general", dateScope = null, currency = "EUR") {
  const trendDates = (campaigns || [])
    .flatMap((campaign) => campaign.series || [])
    .map((point) => point.date)
    .filter(Boolean)
    .sort();
  const lastDate = trendDates[trendDates.length - 1];
  const meta = lastDate
    ? `${dateScope?.label || "Selected range"} ending ${formatShortDate(lastDate)}`
    : (dateScope?.label || "Selected range");
  const withComparison = (totals) => ({
    series: totals.current,
    comparisonSeries: totals.previous
  });

  if (lens === "general") {
    const totalSpend = sumMetric(campaigns, "spend_value");
    const totalRevenue = sumMetric(campaigns, "revenue_value");
    return [
      {
        title: "Spend over time",
        meta,
        value: formatCurrency(totalSpend, currency),
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.spend || 0)),
        tone: "conversion"
      },
      {
        title: "Revenue over time",
        meta,
        value: formatCurrency(totalRevenue, currency),
        tone: "conversion",
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.revenue || 0))
      },
      {
        title: "ROAS over time",
        meta,
        value: totalSpend > 0 ? formatDashboardNumber(totalRevenue / totalSpend, 2) : "--",
        tone: "conversion",
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => {
          const spend = readNumber(point.spend, 0);
          const revenue = readNumber(point.revenue, 0);
          return spend > 0 ? revenue / spend : 0;
        }))
      },
      {
        title: "Objective performance",
        meta: "Spend plus efficiency by objective",
        kind: "objective-bars",
        tone: "conversion",
        rows: buildGeneralObjectivePerformanceRows(campaigns, currency)
      }
    ];
  }

  if (lens === "awareness") {
    const impressions = sumMetric(campaigns, "impressions_value");
    const spend = sumMetric(campaigns, "spend_value");
    return [
      {
        title: "Spend trend",
        meta,
        value: formatCurrency(spend, currency),
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.spend || 0)),
        tone: "awareness"
      },
      {
        title: "Reach delivery",
        meta,
        value: formatDashboardNumber(sumMetric(campaigns, "reach_value"), 0),
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.impressions || 0)),
        tone: "awareness",
        hero: true
      },
      {
        title: "CPM trend",
        meta,
        value: impressions > 0 ? formatCurrency((spend / impressions) * 1000, currency) : "--",
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => {
          const pointImpressions = readNumber(point.impressions, 0);
          const pointSpend = readNumber(point.spend, 0);
          return pointImpressions > 0 ? (pointSpend / pointImpressions) * 1000 : 0;
        })),
        tone: "awareness"
      },
      {
        title: "Frequency trend",
        meta,
        value: formatDashboardNumber(sumMetric(campaigns, "frequency_value") / Math.max(1, campaigns.length), 2),
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point, campaign) => {
          const reach = readNumber(point.reach || campaign.reach_value, 0);
          return reach > 0 ? readNumber(point.impressions, 0) / reach : 0;
        })),
        tone: "awareness"
      }
    ];
  }

  if (lens === "leads") {
    const totalLeads = sumMetric(campaigns, "leads_value");
    const totalSpend = sumMetric(campaigns, "spend_value");
    const totalImpressions = sumMetric(campaigns, "impressions_value");
    const totalClicks = sumMetric(campaigns, "clicks_value");
    return [
      {
        title: "Spend trend",
        meta,
        value: formatCurrency(totalSpend, currency),
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.spend || 0)),
        tone: "leads"
      },
      {
        title: "Leads trend",
        meta,
        value: formatDashboardNumber(totalLeads, 0),
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.leads || 0)),
        tone: "leads",
        hero: true
      },
      {
        title: "CPL trend",
        meta,
        value: totalLeads > 0 ? formatCurrency(totalSpend / totalLeads, currency) : "--",
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => {
          const leads = readNumber(point.leads, 0);
          const spend = readNumber(point.spend, 0);
          return leads > 0 ? spend / leads : 0;
        })),
        tone: "leads"
      },
      {
        title: "CTR trend",
        meta,
        value: totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : "--",
        ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => {
          const impressions = readNumber(point.impressions, 0);
          const clicks = readNumber(point.clicks, 0);
          return impressions > 0 ? (clicks / impressions) * 100 : 0;
        })),
        tone: "leads"
      }
    ];
  }

  const totalSpend = sumMetric(campaigns, "spend_value");
  const totalRevenue = sumMetric(campaigns, "revenue_value");
  const totalPurchases = sumMetric(campaigns, "purchases_value");
  const tone = lens === "conversion_incremental" ? "incremental" : "conversion";

  return [
    {
      title: "Spend trend",
      meta,
      value: formatCurrency(totalSpend, currency),
      ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.spend || 0)),
      tone
    },
    {
      title: "Revenue trend",
      meta,
      value: formatCurrency(totalRevenue, currency),
      ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.revenue || 0)),
      tone,
      hero: true
    },
    {
      title: "ROAS trend",
      meta,
      value: totalSpend > 0 ? formatDashboardNumber(totalRevenue / totalSpend, 2) : "--",
      ...withComparison(buildDerivedSeriesTotals(
        campaigns,
        (point) => point.revenue || 0,
        (point) => point.spend || 0
      )),
      tone
    },
    {
      title: "CPA trend",
      meta,
      value: totalPurchases > 0 ? formatCurrency(totalSpend / totalPurchases, currency) : "--",
      ...withComparison(buildDerivedSeriesTotals(
        campaigns,
        (point) => point.spend || 0,
        (point) => point.purchases || 0
      )),
      tone
    },
    {
      title: "Purchase trend",
      meta,
      value: formatDashboardNumber(totalPurchases, 0),
      ...withComparison(buildComparisonSeriesTotals(campaigns, (point) => point.purchases || 0)),
      tone
    }
  ];
}

function buildOverviewCards(campaigns = [], currency = "EUR") {
  const buckets = splitByCategory(campaigns);
  const conversionBuckets = splitConversionByAttribution(buckets.conversion);
  const incrementalCampaigns = buildIncrementalLensCampaigns(campaigns);
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
      metric: formatDashboardNumber(sumMetric(buckets.awareness, "reach_value"), 0),
      items: buildTopItems(buckets.awareness, "reach_value", (value) => `${formatDashboardNumber(value, 0)} reach`)
    },
    {
      key: "leads",
      meta: [`${buckets.leads.length} campaigns in lens`, spendShare(sumMetric(buckets.leads, "spend_value"))].filter(Boolean).join(" · "),
      metric: formatDashboardNumber(sumMetric(buckets.leads, "leads_value"), 0),
      items: buildTopItems(buckets.leads, "leads_value", (value) => `${formatDashboardNumber(value, 0)} leads`)
    },
    {
      key: "convstd",
      meta: [`${conversionBuckets.standard.length} campaigns in lens`, spendShare(sumMetric(conversionBuckets.standard, "spend_value"))].filter(Boolean).join(" · "),
      metric: formatCurrency(sumMetric(conversionBuckets.standard, "revenue_value"), currency),
      items: buildTopItems(conversionBuckets.standard, "revenue_value", (value) => formatCurrency(value, currency))
    },
    {
      key: "convinc",
      meta: [`${incrementalCampaigns.length} campaigns in lens`, spendShare(sumMetric(incrementalCampaigns, "spend_value"))].filter(Boolean).join(" · "),
      metric: formatCurrency(sumMetric(incrementalCampaigns, "revenue_value"), currency),
      items: buildTopItems(incrementalCampaigns, "revenue_value", (value) => formatCurrency(value, currency))
    }
  ];
}

function buildHeroPanelItems(campaigns = [], lens = "general", currency = "EUR", dateScope = null) {
  const series = buildAggregateSeries(campaigns);
  const comparisonWindow = buildAggregateComparisonWindow(campaigns);
  const changeWindowLabel = formatComparisonWindowLabel(dateScope?.days);
  const spend = computeAggregateMetric(series, "spend");
  const revenue = computeAggregateMetric(series, "revenue");
  const purchases = computeAggregateMetric(series, "purchases");
  const roas = computeAggregateMetric(series, "roas");
  const cpa = computeAggregateMetric(series, "cpa");
  const reach = sumMetric(campaigns, "reach_value");
  const leads = sumMetric(campaigns, "leads_value");
  const cpl = computeAggregateMetric(series, "cpl");
  const cpm = computeAggregateMetric(series, "cpm");

  if (lens === "general") {
    return [
      {
        label: "Revenue",
        value: formatCurrency(revenue, currency),
        meta: "Attributed revenue",
        change: buildWindowChange(comparisonWindow, "revenue", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "success"
      },
      {
        label: "ROAS",
        value: spend > 0 ? formatDashboardNumber(roas, 2) : "--",
        meta: "Revenue / spend",
        change: buildWindowChange(comparisonWindow, "roas", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "success"
      },
      {
        label: "Purchases",
        value: formatDashboardNumber(purchases, 0),
        meta: "Attributed conversions",
        change: buildWindowChange(comparisonWindow, "purchases", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "neutral"
      },
      {
        label: "CPA",
        value: purchases > 0 ? formatCurrency(cpa, currency) : "--",
        meta: "Spend / purchases",
        change: buildWindowChange(comparisonWindow, "cpa", { positiveDirection: "down", windowLabel: changeWindowLabel }),
        tone: "warning"
      }
    ];
  }

  if (lens === "awareness") {
    return [
      {
        label: "Spend",
        value: formatCurrency(spend, currency),
        meta: dateScope?.label || "Selected range",
        change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "awareness"
      },
      {
        label: "Reach",
        value: formatDashboardNumber(reach, 0),
        meta: "Delivered reach",
        change: buildWindowChange(comparisonWindow, "reach", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "awareness"
      },
      {
        label: "CPM",
        value: cpm > 0 ? formatCurrency(cpm, currency) : "--",
        meta: "Spend / 1,000 impressions",
        change: buildWindowChange(comparisonWindow, "cpm", { positiveDirection: "down", windowLabel: changeWindowLabel }),
        tone: "warning"
      }
    ];
  }

  if (lens === "leads") {
    return [
      {
        label: "Spend",
        value: formatCurrency(spend, currency),
        meta: "Lead campaigns",
        change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "leads"
      },
      {
        label: "Leads",
        value: formatDashboardNumber(leads, 0),
        meta: "Tracked leads",
        change: buildWindowChange(comparisonWindow, "leads", { positiveDirection: "up", windowLabel: changeWindowLabel }),
        tone: "leads"
      },
      {
        label: "CPL",
        value: leads > 0 ? formatCurrency(cpl, currency) : "--",
        meta: "Spend / leads",
        change: buildWindowChange(comparisonWindow, "cpl", { positiveDirection: "down", windowLabel: changeWindowLabel }),
        tone: "warning"
      }
    ];
  }

  return [
    {
      label: "Spend",
      value: formatCurrency(spend, currency),
      meta: lens === "conversion_incremental" ? "Incremental campaigns" : "Conversion campaigns",
      change: buildWindowChange(comparisonWindow, "spend", { positiveDirection: "up", windowLabel: changeWindowLabel }),
      tone: lens === "conversion_incremental" ? "incremental" : "conversion"
    },
    {
      label: "Purchases",
      value: formatDashboardNumber(purchases, 0),
      meta: "Tracked purchases",
      change: buildWindowChange(comparisonWindow, "purchases", { positiveDirection: "up", windowLabel: changeWindowLabel }),
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

function buildValidationCheck(id, label, status, detail, extra = {}) {
  return {
    id,
    label,
    status,
    detail,
    ...extra
  };
}

function isCloseEnough(left, right, tolerance = 0.05) {
  return Math.abs(readNumber(left, 0) - readNumber(right, 0)) <= tolerance;
}

function buildDashboardValidation({ campaigns = [], dashboard = null, budgetAllocation = null }) {
  const quality = dashboard?.quality || {};
  const visuals = dashboard?.visuals || {};
  const split = quality.generalSpendDistribution || {};
  const splitItems = Array.isArray(split.items) ? split.items : [];
  const splitSpendSum = splitItems.reduce((sum, item) => sum + readNumber(item?.amount, 0), 0);
  const splitBudgetSum = splitItems.reduce((sum, item) => sum + readNumber(item?.budgetAmount, 0), 0);
  // The split states budget per 30-day month, so the reconciliation target is the monthly
  // total, not the period-scaled one.
  const expectedBudgetTotal = readNumber(split.totalBudgetAmount, readNumber(budgetAllocation?.totalMonthlyBudget, 0));
  const expectedSpendTotal = readNumber(split.totalAmount, 0);
  const requiredLenses = [
    "general",
    "awareness",
    "leads",
    "conversion_standard",
    "conversion_incremental"
  ];

  const checks = [];
  checks.push(buildValidationCheck(
    "general-spend-sum",
    "General spend split",
    isCloseEnough(expectedSpendTotal, splitSpendSum) ? "pass" : "fail",
    isCloseEnough(expectedSpendTotal, splitSpendSum)
      ? "General objective spend split reconciles to the total spend."
      : `Expected ${formatCurrency(expectedSpendTotal, dashboard?.currency || "EUR")} but summed ${formatCurrency(splitSpendSum, dashboard?.currency || "EUR")}.`,
    {
      expected: expectedSpendTotal,
      actual: splitSpendSum,
      delta: Number((expectedSpendTotal - splitSpendSum).toFixed(4))
    }
  ));

  checks.push(buildValidationCheck(
    "general-budget-sum",
    "Planned budget split",
    isCloseEnough(expectedBudgetTotal, splitBudgetSum) ? "pass" : "fail",
    isCloseEnough(expectedBudgetTotal, splitBudgetSum)
      ? "Objective planned budget split reconciles to the planned total."
      : `Expected ${formatCurrency(expectedBudgetTotal, dashboard?.currency || "EUR")} but summed ${formatCurrency(splitBudgetSum, dashboard?.currency || "EUR")}.`,
    {
      expected: expectedBudgetTotal,
      actual: splitBudgetSum,
      delta: Number((expectedBudgetTotal - splitBudgetSum).toFixed(4))
    }
  ));

  const statsByLens = dashboard?.statsByLens || {};
  const summaryByLens = dashboard?.summaryByLens || {};
  const heroByLens = visuals.heroPanelByLens || {};
  const trendByLens = visuals.trendCardsByLens || {};
  const missingStatsLenses = requiredLenses.filter((lens) => !Array.isArray(statsByLens[lens]) || !statsByLens[lens].length);
  const missingSummaryLenses = requiredLenses.filter((lens) => !String(summaryByLens[lens] || "").trim());
  const missingHeroLenses = requiredLenses.filter((lens) => !Array.isArray(heroByLens[lens]) || !heroByLens[lens].length);
  const missingTrendLenses = requiredLenses.filter((lens) => !Array.isArray(trendByLens[lens]) || !trendByLens[lens].length);
  const overviewCards = Array.isArray(visuals.overviewCards) ? visuals.overviewCards : [];

  checks.push(buildValidationCheck(
    "lens-coverage",
    "Lens coverage",
    (!missingStatsLenses.length && !missingSummaryLenses.length) ? "pass" : "fail",
    (!missingStatsLenses.length && !missingSummaryLenses.length)
      ? "All dashboard lenses have stats and summaries."
      : `Missing stats for: ${missingStatsLenses.join(", ") || "none"}. Missing summaries for: ${missingSummaryLenses.join(", ") || "none"}.`
  ));

  checks.push(buildValidationCheck(
    "visual-coverage",
    "Visual coverage",
    (!missingHeroLenses.length && !missingTrendLenses.length && overviewCards.length === 4) ? "pass" : "warn",
    (!missingHeroLenses.length && !missingTrendLenses.length && overviewCards.length === 4)
      ? "Hero, trend and overview visuals are present for the dashboard payload."
      : `Missing hero lenses: ${missingHeroLenses.join(", ") || "none"}. Missing trend lenses: ${missingTrendLenses.join(", ") || "none"}. Overview cards: ${overviewCards.length}/4.`
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

function buildPresetRange(preset) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (preset === "today") {
    return { since: formatIsoDate(todayUtc), until: formatIsoDate(todayUtc), label: "Today" };
  }
  if (preset === "yesterday") {
    const yesterday = shiftDays(todayUtc, -1);
    return { since: formatIsoDate(yesterday), until: formatIsoDate(yesterday), label: "Yesterday" };
  }
  if (preset === "last_14d") {
    return { since: formatIsoDate(shiftDays(todayUtc, -13)), until: formatIsoDate(todayUtc), label: "Last 14 days" };
  }
  if (preset === "last_30d") {
    return { since: formatIsoDate(shiftDays(todayUtc, -29)), until: formatIsoDate(todayUtc), label: "Last 30 days" };
  }
  if (preset === "this_month") {
    return { since: formatIsoDate(startOfMonth(todayUtc)), until: formatIsoDate(todayUtc), label: "This month" };
  }

  return { since: formatIsoDate(shiftDays(todayUtc, -6)), until: formatIsoDate(todayUtc), label: "Last 7 days" };
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

function buildDateScope(query = {}) {
  const preset = String(query.preset || "last_7d");
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
      preset: "custom"
    };
  }

  const range = buildPresetRange(preset);
  const sinceDate = parseIsoDate(range.since);
  const untilDate = parseIsoDate(range.until);
  const diffDays = sinceDate && untilDate
    ? Math.round((untilDate.getTime() - sinceDate.getTime()) / 86400000) + 1
    : 7;
  return {
    ...range,
    shortLabel: range.label,
    days: diffDays,
    preset
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
    dateScope = buildDateScope(req.query || {});
    comparisonDateScope = buildComparisonDateScope(dateScope);
    snapshotCacheKey = buildSnapshotCacheKey(dateScope);

    const accountId = ensureAccountId(config.metaAdAccountId);
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
    const accountCurrency = normalizeCurrencyCode(account.currency, "EUR");

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
      timings
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
      aggregatedInsightsResponse,
      dailyInsightsResponse,
      aggregatedIncrementalInsightsResponse,
      dailyIncrementalInsightsResponse
    } = await fetchCampaignInsightsCollections({
      accountId,
      accessToken: config.metaAccessToken,
      dateScope,
      comparisonDateScope,
      insightsCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
      timings
    });
    const incrementalInsightsAvailable = !aggregatedIncrementalInsightsResponse?.unavailable && !dailyIncrementalInsightsResponse?.unavailable;

    // New customers is the KPI the marketing team is measured on, so it needs a trend
    // beside the level: month to date against the same elapsed point last month.
    // Boundaries are resolved in the ad account timezone, which is what Meta uses for a
    // time_range, and is not the user timezone on this account.
    const acquisitionTrendWindows = resolveMonthToDateWindows(new Date(), account.timezone_name || "");
    const acquisitionTrendResponse = await fetchCustomerAcquisitionTrend({
      accountId,
      accessToken: config.metaAccessToken,
      trendWindow: acquisitionTrendWindows.fetch,
      insightsCacheMaxAgeMs: META_INSIGHTS_CACHE_MAX_AGE_MS,
      timings
    }).catch(() => ({ data: [], pageCount: 0, unavailable: true }));

    const awarenessCampaignIds = new Set(
      activeCampaigns
        .filter((campaign) => classifyCampaign(campaign) === "awareness")
        .map((campaign) => String(campaign?.id || ""))
        .filter(Boolean)
    );

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
        timings
      }));
    } else {
      timings.adset_insights_aggregated_ms = 0;
      timings.adset_insights_daily_ms = 0;
      timings.adset_insights_skipped = "no_awareness_campaigns";
    }

    const insightMap = buildInsightMap(aggregatedInsightsResponse.data || [], "campaign_id");
    const seriesMap = buildSeriesMap(dailyInsightsResponse.data || [], "campaign_id");
    const incrementalInsightMap = buildInsightMap(aggregatedIncrementalInsightsResponse.data || [], "campaign_id");
    const incrementalSeriesMap = buildSeriesMap(dailyIncrementalInsightsResponse.data || [], "campaign_id");
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
      campaigns
    } = buildCampaignMetricCollections({
      includedCampaigns,
      adSetsByCampaignId,
      insightMap,
      seriesMap,
      incrementalInsightMap,
      incrementalSeriesMap,
      incrementalInsightsAvailable,
      dateScope,
      accountCurrency,
      budgetNormalization,
      customerConversionActionTypes
    });

    const enrichedCampaigns = enrichCampaignsWithAttribution({
      campaigns,
      adSetsByCampaignId
    });

    const {
      dashboard,
      ads,
      qualityWarnings
    } = buildSnapshotDashboardAssembly({
      enrichedCampaigns,
      includedCampaigns,
      adSets,
      activeAds,
      budgetCampaignsRaw,
      budgetAdSets,
      adSetsByCampaignId,
      budgetNormalization,
      customerConversionActionTypes,
      acquisitionTrendRows: acquisitionTrendResponse?.data || [],
      accountTimezone: account.timezone_name || "",
      awarenessUsingAdSetInsights,
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
      incrementalInsightsAvailable,
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
    if (!healthOnly && snapshotCacheKey && isRateLimitError(error.message || "")) {
      const cachedSnapshot = getCachedSnapshot(snapshotCacheKey);
      if (cachedSnapshot?.payload) {
        sendMetaSnapshotFallback({
          res,
          sendJson,
          cachedSnapshot,
          reason: error.message || "Meta rate limit"
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
  buildDashboardValidation,
  buildGeneralSpendDistribution,
  buildLensStats,
  buildQualityWarnings
};
