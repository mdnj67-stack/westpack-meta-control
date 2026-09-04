// Canonical budget/objective logic for the Meta dashboard.
//
// Everything that decides "how much money goes to which objective" lives here so the
// HTTP handler, the snapshot builders and the tests all agree. Two rules drive the
// design:
//
// 1. A campaign's objective group comes from Meta's own `objective` field and nothing
//    else. No campaign-name regexes, no "it recorded purchases so it must be
//    conversion" inference, and no silent fallback bucket that hides unmapped spend
//    inside a real category.
// 2. Budget amounts are converted from Meta's minor currency units with a deterministic
//    per-currency exponent, not a heuristic guess.

// Meta returns budget fields in the account currency's minor unit. For DKK (and most
// currencies) that is 1/100 of the major unit. These two sets cover the currencies where
// the exponent is not 2, per ISO 4217.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"
]);

// Meta's objective families. Keys are the raw `objective` values the Marketing API
// returns, including the legacy pre-ODAX names, so historical campaigns keep mapping to
// the same group they always did.
const OBJECTIVE_GROUP_BY_OBJECTIVE = new Map([
  ["OUTCOME_AWARENESS", "awareness"],
  ["AWARENESS", "awareness"],
  ["BRAND_AWARENESS", "awareness"],
  ["REACH", "awareness"],
  ["VIDEO_VIEWS", "awareness"],
  ["THRUPLAY", "awareness"],

  ["OUTCOME_TRAFFIC", "traffic"],
  ["TRAFFIC", "traffic"],
  ["LINK_CLICKS", "traffic"],

  ["OUTCOME_ENGAGEMENT", "engagement"],
  ["ENGAGEMENT", "engagement"],
  ["POST_ENGAGEMENT", "engagement"],
  ["PAGE_LIKES", "engagement"],
  ["EVENT_RESPONSES", "engagement"],

  ["OUTCOME_LEADS", "leads"],
  ["LEAD_GENERATION", "leads"],
  ["MESSAGES", "leads"],

  ["OUTCOME_SALES", "conversion"],
  ["CONVERSIONS", "conversion"],
  ["CATALOG_SALES", "conversion"],
  ["PRODUCT_CATALOG_SALES", "conversion"],
  ["STORE_VISITS", "conversion"],

  ["OUTCOME_APP_PROMOTION", "app_promotion"],
  ["APP_INSTALLS", "app_promotion"]
]);

// Canonical set of groups. Used for iteration, reconciliation and allocation totals -
// order here is Meta's funnel order and is not what the dashboard renders.
const OBJECTIVE_GROUP_ORDER = [
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "conversion",
  "app_promotion",
  "unclassified"
];

// Render order for the objective split, which deliberately differs from the funnel order:
// awareness and conversion are the two the marketing team compares day to day, so they sit
// next to each other at the top. Groups with no campaigns and no budget are omitted, so an
// account that only runs awareness/sales/leads sees exactly those three rows, and
// "unclassified" always sorts last.
const OBJECTIVE_GROUP_DISPLAY_ORDER = [
  "awareness",
  "conversion",
  "leads",
  "traffic",
  "engagement",
  "app_promotion",
  "unclassified"
];

const OBJECTIVE_GROUP_LABELS = {
  awareness: "Brand Awareness",
  traffic: "Traffic",
  engagement: "Engagement",
  leads: "Leads",
  conversion: "Conversion",
  app_promotion: "App Promotion",
  unclassified: "Unclassified"
};

// The three drill-down lenses the dashboard exposes. Groups outside this map are still
// counted in General and in the objective split, they just have no dedicated lens.
const LENS_BY_OBJECTIVE_GROUP = {
  awareness: "awareness",
  leads: "leads",
  conversion: "conversion"
};

function readNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeObjective(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCurrency(value, fallback = "DKK") {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function isObjectiveGroup(value) {
  return OBJECTIVE_GROUP_ORDER.includes(String(value || ""));
}

// Deterministic replacement for the old inferBudgetDivisor heuristic. Meta's contract is
// fixed: budgets are always in the account currency's minor unit.
function resolveCurrencyMinorUnitDivisor(currency) {
  const code = normalizeCurrency(currency, "");
  if (!code) return 100;
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000;
  return 100;
}

function resolveBudgetNormalization(currency) {
  const code = normalizeCurrency(currency, "");
  const divisor = resolveCurrencyMinorUnitDivisor(code || "DKK");
  return {
    divisor,
    currency: code || "DKK",
    confidence: code ? "exact" : "assumed",
    reason: code
      ? `Meta returns budgets in ${code} minor units, so raw values are divided by ${divisor}.`
      : `No account currency was reported, so budgets were divided by ${divisor} (the two-decimal default).`
  };
}

function normalizeBudgetValue(value, divisor = 1) {
  const numeric = readNumber(value, 0);
  if (!numeric || numeric <= 0) {
    return null;
  }
  return numeric / Math.max(divisor, 1);
}

// Strictly Meta's objective field. An objective we do not recognise, or a campaign with
// no objective at all, becomes "unclassified" rather than being folded into awareness.
function resolveObjectiveGroup(campaign) {
  const explicit = String(campaign?.objective_group || campaign?.category || campaign?.lens || "").trim().toLowerCase();
  if (isObjectiveGroup(explicit)) {
    return explicit;
  }

  const objective = normalizeObjective(campaign?.objective);
  if (!objective) {
    return "unclassified";
  }

  return OBJECTIVE_GROUP_BY_OBJECTIVE.get(objective) || "unclassified";
}

function resolveObjectiveGroupLabel(group) {
  return OBJECTIVE_GROUP_LABELS[String(group || "")] || OBJECTIVE_GROUP_LABELS.unclassified;
}

function resolveLensForObjectiveGroup(group) {
  return LENS_BY_OBJECTIVE_GROUP[String(group || "")] || "";
}

function classifyCampaign(campaign) {
  return resolveObjectiveGroup(campaign);
}

// Returns one bucket per objective group. Reads of `.awareness`, `.leads` and
// `.conversion` keep working exactly as before; the extra keys make unmapped spend
// visible instead of hiding it.
function splitByCategory(campaigns) {
  const buckets = {};
  for (const group of OBJECTIVE_GROUP_ORDER) {
    buckets[group] = [];
  }

  for (const campaign of campaigns || []) {
    const group = resolveObjectiveGroup(campaign);
    buckets[group].push(campaign);
  }

  return buckets;
}

// A lifetime budget covers the entity's flight, so it has to be spread across that
// flight to be comparable with a daily budget. When Meta gives us no schedule we spread
// it across the reporting period instead and say so via the returned source.
// Campaigns expose the flight end as `stop_time`, ad sets as `end_time`.
function resolveFlight(entity) {
  const start = Date.parse(String(entity?.start_time || ""));
  const stop = Date.parse(String(entity?.stop_time || entity?.end_time || ""));
  const complete = Number.isFinite(start) && Number.isFinite(stop) && stop > start;
  return { start, stop, complete };
}

function resolveScheduleDays(entity, periodDays = 30) {
  const flight = resolveFlight(entity);
  if (flight.complete) {
    return Math.max(1, Math.round((flight.stop - flight.start) / 86400000));
  }
  return Math.max(1, Math.round(readNumber(periodDays, 30) || 30));
}

function resolveDailyBudget(entity, periodDays = 30) {
  const daily = readNumber(entity?.daily_budget, 0);
  if (daily > 0) {
    return { dailyBudget: daily, source: "daily", scheduleDays: 0 };
  }

  const lifetime = readNumber(entity?.lifetime_budget, 0);
  if (lifetime > 0) {
    const scheduleDays = resolveScheduleDays(entity, periodDays);
    return {
      dailyBudget: lifetime / scheduleDays,
      source: resolveFlight(entity).complete ? "lifetime" : "lifetime_unscheduled",
      scheduleDays
    };
  }

  return { dailyBudget: 0, source: "none", scheduleDays: 0 };
}

function createEmptyGroupTotals() {
  const totals = {};
  for (const group of OBJECTIVE_GROUP_ORDER) {
    totals[group] = 0;
  }
  return totals;
}

function calculateBudgetAllocation(campaigns = [], adSets = [], periodDays = 30, options = {}) {
  const normalizedPeriodDays = Math.max(1, Math.round(readNumber(periodDays, 30) || 30));
  const classifyAttribution = typeof options.classifyConversionAttribution === "function"
    ? options.classifyConversionAttribution
    : () => "standard";

  const campaignMap = new Map();
  for (const campaign of campaigns || []) {
    const campaignId = String(campaign?.id || "").trim();
    if (!campaignId) {
      continue;
    }

    const campaignBudget = resolveDailyBudget(campaign, normalizedPeriodDays);
    campaignMap.set(campaignId, {
      id: campaignId,
      group: resolveObjectiveGroup(campaign),
      attributionMode: classifyAttribution(campaign),
      campaignDailyBudget: campaignBudget.dailyBudget,
      campaignBudgetSource: campaignBudget.source,
      adSetDailyBudget: 0,
      adSetBudgetSources: new Set()
    });
  }

  for (const adSet of adSets || []) {
    const campaignId = String(adSet?.campaignId || adSet?.campaign?.id || "").trim();
    if (!campaignId || !campaignMap.has(campaignId)) {
      continue;
    }

    const entry = campaignMap.get(campaignId);
    const adSetBudget = resolveDailyBudget(adSet, normalizedPeriodDays);
    if (adSetBudget.dailyBudget > 0) {
      entry.adSetDailyBudget += adSetBudget.dailyBudget;
      entry.adSetBudgetSources.add(adSetBudget.source);
    }
  }

  const dailyByGroup = createEmptyGroupTotals();
  let totalDailyBudget = 0;
  let conversionStandardDailyBudget = 0;
  let conversionIncrementalDailyBudget = 0;
  let lifetimeBudgetCampaignCount = 0;
  let unscheduledLifetimeBudgetCampaignCount = 0;
  const campaignsWithoutBudget = [];

  for (const entry of campaignMap.values()) {
    // Campaign budget optimisation overrides ad set budgets, so a campaign-level budget
    // wins whenever Meta reports one. Only ABO campaigns fall through to the ad set sum.
    const usesCampaignBudget = entry.campaignDailyBudget > 0;
    const dailyBudget = usesCampaignBudget ? entry.campaignDailyBudget : entry.adSetDailyBudget;
    const budgetSources = usesCampaignBudget
      ? [entry.campaignBudgetSource]
      : Array.from(entry.adSetBudgetSources);

    if (!(dailyBudget > 0)) {
      campaignsWithoutBudget.push(entry.id);
      continue;
    }

    if (budgetSources.some((source) => String(source).startsWith("lifetime"))) {
      lifetimeBudgetCampaignCount += 1;
    }
    if (budgetSources.includes("lifetime_unscheduled")) {
      unscheduledLifetimeBudgetCampaignCount += 1;
    }

    totalDailyBudget += dailyBudget;
    dailyByGroup[entry.group] += dailyBudget;

    if (entry.group === "conversion") {
      if (entry.attributionMode === "incremental") {
        conversionIncrementalDailyBudget += dailyBudget;
      } else {
        conversionStandardDailyBudget += dailyBudget;
      }
    }
  }

  const allocation = {
    periodDays: normalizedPeriodDays,
    totalDailyBudget,
    totalMonthlyBudget: totalDailyBudget * 30,
    totalPeriodBudget: totalDailyBudget * normalizedPeriodDays,
    dailyBudgetByGroup: dailyByGroup,
    monthlyBudgetByGroup: {},
    periodBudgetByGroup: {},
    conversionStandardDailyBudget,
    conversionStandardMonthlyBudget: conversionStandardDailyBudget * 30,
    conversionStandardPeriodBudget: conversionStandardDailyBudget * normalizedPeriodDays,
    conversionIncrementalDailyBudget,
    conversionIncrementalMonthlyBudget: conversionIncrementalDailyBudget * 30,
    conversionIncrementalPeriodBudget: conversionIncrementalDailyBudget * normalizedPeriodDays,
    lifetimeBudgetCampaignCount,
    unscheduledLifetimeBudgetCampaignCount,
    campaignsWithoutBudgetCount: campaignsWithoutBudget.length
  };

  for (const group of OBJECTIVE_GROUP_ORDER) {
    allocation.monthlyBudgetByGroup[group] = dailyByGroup[group] * 30;
    allocation.periodBudgetByGroup[group] = dailyByGroup[group] * normalizedPeriodDays;
    // Flat aliases (awarenessDailyBudget, conversionPeriodBudget, ...) keep the existing
    // dashboard payload shape intact for consumers that read a single group directly.
    allocation[`${group}DailyBudget`] = dailyByGroup[group];
    allocation[`${group}MonthlyBudget`] = dailyByGroup[group] * 30;
    allocation[`${group}PeriodBudget`] = dailyByGroup[group] * normalizedPeriodDays;
  }

  return allocation;
}

// The old heuristic silently rewrote budget magnitudes. Now that the divisor is exact, a
// budget that is wildly out of line with real spend is surfaced as a warning instead.
function buildBudgetSanityWarnings({ totalMonthlyBudget = 0, totalSpend = 0, periodDays = 30, currency = "DKK" }) {
  const warnings = [];
  const safePeriodDays = Math.max(1, readNumber(periodDays, 30) || 30);
  const spendPace = readNumber(totalSpend, 0) > 0 ? (readNumber(totalSpend, 0) / safePeriodDays) * 30 : 0;
  const monthlyBudget = readNumber(totalMonthlyBudget, 0);

  if (!(monthlyBudget > 0)) {
    warnings.push("No active campaign or ad set budget was reported, so the planned budget split is empty.");
    return warnings;
  }

  if (spendPace > 0) {
    const ratio = monthlyBudget / spendPace;
    if (ratio >= 50) {
      warnings.push(`Planned monthly budget is ${ratio.toFixed(0)}x the current spend pace, which suggests a ${currency} unit mismatch or heavily paused delivery.`);
    } else if (ratio <= 0.02) {
      warnings.push(`Planned monthly budget is only ${(ratio * 100).toFixed(1)}% of the current spend pace, which suggests budgets were read in the wrong unit.`);
    }
  }

  return warnings;
}

module.exports = {
  ZERO_DECIMAL_CURRENCIES,
  THREE_DECIMAL_CURRENCIES,
  OBJECTIVE_GROUP_BY_OBJECTIVE,
  OBJECTIVE_GROUP_DISPLAY_ORDER,
  OBJECTIVE_GROUP_ORDER,
  OBJECTIVE_GROUP_LABELS,
  LENS_BY_OBJECTIVE_GROUP,
  buildBudgetSanityWarnings,
  calculateBudgetAllocation,
  classifyCampaign,
  isObjectiveGroup,
  normalizeBudgetValue,
  resolveBudgetNormalization,
  resolveCurrencyMinorUnitDivisor,
  resolveDailyBudget,
  resolveLensForObjectiveGroup,
  resolveObjectiveGroup,
  resolveObjectiveGroupLabel,
  resolveScheduleDays,
  splitByCategory
};
