// New vs existing customer counting for the Meta dashboard.
//
// Westpack's Magento shop already fires `new_customer` and `existing_customer` events,
// and the ad account has had matching custom conversions since 2024-10-22. Meta therefore
// already holds the numbers - they had simply never been read. This module turns those
// custom conversions into a count the dashboard can show.
//
// Two rules, both inherited from how the objective split works:
//
// 1. The custom conversions are resolved by NAME at snapshot time, never by hardcoded id.
//    An id baked into source would keep "working" while silently reporting nothing if
//    someone recreated the conversion in Events Manager.
// 2. Purchases that match neither conversion get their own visible bucket. Roughly a
//    fifth of purchases are currently untagged, and folding them into either side would
//    misstate the acquisition number people budget against.

// Accepted names for each side, lowercased with separators stripped, so "New_customer",
// "new customer" and "NewCustomer" all resolve.
const NEW_CUSTOMER_NAMES = new Set(["newcustomer", "newcustomers", "newcustomerpurchase", "nykunde", "nyekunder"]);
const EXISTING_CUSTOMER_NAMES = new Set([
  "existingcustomer", "existingcustomers", "existingcustomerpurchase",
  "returningcustomer", "returningcustomers", "eksisterendekunde", "eksisterendekunder"
]);

function readNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s._-]+/g, "");
}

function toActionType(id) {
  return `offsite_conversion.custom.${String(id).trim()}`;
}

// Turns the account's custom conversion list into the action types to read out of
// insights. Returns empty arrays when the conversions are absent, which the callers treat
// as "this account cannot report new customers" rather than as zero new customers.
function resolveCustomerConversionActionTypes(customConversions = []) {
  const newTypes = [];
  const existingTypes = [];
  const resolved = { new: [], existing: [] };

  for (const conversion of customConversions || []) {
    if (!conversion || conversion.is_archived) continue;
    const id = String(conversion.id || "").trim();
    if (!id) continue;

    const name = normalizeName(conversion.name);
    if (NEW_CUSTOMER_NAMES.has(name)) {
      newTypes.push(toActionType(id));
      resolved.new.push({ id, name: conversion.name });
    } else if (EXISTING_CUSTOMER_NAMES.has(name)) {
      existingTypes.push(toActionType(id));
      resolved.existing.push({ id, name: conversion.name });
    }
  }

  return {
    newCustomerActionTypes: newTypes,
    existingCustomerActionTypes: existingTypes,
    resolved,
    available: newTypes.length > 0
  };
}

function sumActionTypes(entries = [], actionTypes = []) {
  const list = Array.isArray(entries) ? entries : [];
  let total = 0;
  for (const type of actionTypes) {
    const match = list.find((entry) => entry.action_type === type);
    if (match && match.value != null) {
      total += readNumber(match.value, 0);
    }
  }
  return total;
}

// Per-campaign extraction, called from the snapshot transformer where the raw insight row
// is still available.
function extractCustomerAcquisition(insight = {}, actionTypes = {}) {
  const actions = insight.actions || [];
  const values = insight.action_values || [];
  return {
    new_customers_value: sumActionTypes(actions, actionTypes.newCustomerActionTypes || []),
    new_customer_revenue_value: sumActionTypes(values, actionTypes.newCustomerActionTypes || []),
    existing_customers_value: sumActionTypes(actions, actionTypes.existingCustomerActionTypes || []),
    existing_customer_revenue_value: sumActionTypes(values, actionTypes.existingCustomerActionTypes || [])
  };
}

// Cost per new customer is reported on two explicit bases rather than picking the
// flattering one. Per campaign it is that campaign's own spend over its own new
// customers. For the account it is all spend over all new customers, labelled blended,
// because awareness spend contributes to acquisition without being attributed to it.
function buildCustomerAcquisition({
  campaigns = [],
  actionTypes = {},
  currency = "DKK",
  formatCurrency = (value) => String(value),
  dateScope = null
} = {}) {
  const available = Boolean(actionTypes.available);

  const rows = (campaigns || []).map((campaign) => {
    const spend = readNumber(campaign?.spend_value, 0);
    const newCustomers = readNumber(campaign?.new_customers_value, 0);
    const existingCustomers = readNumber(campaign?.existing_customers_value, 0);
    const purchases = readNumber(campaign?.purchases_value, 0);
    const tagged = newCustomers + existingCustomers;

    return {
      id: String(campaign?.id || ""),
      name: String(campaign?.name || ""),
      objectiveGroup: String(campaign?.category || ""),
      spend,
      purchases,
      purchaseRevenue: readNumber(campaign?.revenue_value, 0),
      newCustomers,
      newCustomerRevenue: readNumber(campaign?.new_customer_revenue_value, 0),
      existingCustomers,
      existingCustomerRevenue: readNumber(campaign?.existing_customer_revenue_value, 0),
      // Never negative: a tagged count above the purchase count means the two use
      // different attribution windows, not that purchases went missing.
      untaggedPurchases: Math.max(0, purchases - tagged),
      costPerNewCustomer: newCustomers > 0 ? spend / newCustomers : 0,
      newCustomerShare: tagged > 0 ? (newCustomers / tagged) * 100 : 0
    };
  });

  const totals = rows.reduce((acc, row) => ({
    spend: acc.spend + row.spend,
    purchases: acc.purchases + row.purchases,
    purchaseRevenue: acc.purchaseRevenue + row.purchaseRevenue,
    newCustomers: acc.newCustomers + row.newCustomers,
    newCustomerRevenue: acc.newCustomerRevenue + row.newCustomerRevenue,
    existingCustomers: acc.existingCustomers + row.existingCustomers,
    existingCustomerRevenue: acc.existingCustomerRevenue + row.existingCustomerRevenue
  }), {
    spend: 0, purchases: 0, purchaseRevenue: 0, newCustomers: 0, newCustomerRevenue: 0,
    existingCustomers: 0, existingCustomerRevenue: 0
  });

  const tagged = totals.newCustomers + totals.existingCustomers;
  const untaggedPurchases = Math.max(0, totals.purchases - tagged);
  const costPerNewCustomer = totals.newCustomers > 0 ? totals.spend / totals.newCustomers : 0;

  // A second, narrower basis: conversion-objective campaigns only. This excludes awareness
  // spend, which contributes to acquisition but barely attributes to it and therefore
  // inflates the blended figure.
  //
  // An earlier version selected campaigns where new >= existing, on the theory that those
  // are the prospecting ones. On this account every conversion campaign brings more
  // existing than new customers, so that rule matched only a high-spend outlier and
  // produced a cost per new customer far worse than the blended one - the opposite of what
  // the narrower basis is for. The objective the advertiser actually set is both more
  // meaningful and explainable.
  const conversionRows = rows.filter((row) => row.objectiveGroup === "conversion");
  const conversionSpend = conversionRows.reduce((sum, row) => sum + row.spend, 0);
  const conversionNew = conversionRows.reduce((sum, row) => sum + row.newCustomers, 0);

  const rangeLabel = dateScope?.label || "Selected range";

  return {
    available,
    currency,
    rangeLabel,
    resolvedConversions: actionTypes.resolved || { new: [], existing: [] },
    unavailableReason: available
      ? ""
      : "No custom conversion named New_customer was found on this ad account, so new customers cannot be counted.",

    newCustomers: totals.newCustomers,
    newCustomerRevenue: totals.newCustomerRevenue,
    existingCustomers: totals.existingCustomers,
    existingCustomerRevenue: totals.existingCustomerRevenue,
    taggedPurchases: tagged,
    totalPurchases: totals.purchases,
    totalPurchaseRevenue: totals.purchaseRevenue,
    untaggedPurchases,
    // What total purchase revenue is left once both customer types are accounted for.
    untaggedRevenue: Math.max(
      0,
      totals.purchaseRevenue - totals.newCustomerRevenue - totals.existingCustomerRevenue
    ),
    taggedShare: totals.purchases > 0 ? Number(((tagged / totals.purchases) * 100).toFixed(1)) : 0,
    untaggedShare: totals.purchases > 0 ? Number(((untaggedPurchases / totals.purchases) * 100).toFixed(1)) : 0,
    newCustomerShare: tagged > 0 ? Number(((totals.newCustomers / tagged) * 100).toFixed(1)) : 0,

    spend: totals.spend,
    costPerNewCustomer,
    formattedCostPerNewCustomer: costPerNewCustomer > 0 ? formatCurrency(costPerNewCustomer, currency) : "--",
    costPerNewCustomerBasis: "Blended: all spend in range divided by new customers.",
    conversionCostPerNewCustomer: conversionNew > 0 ? conversionSpend / conversionNew : 0,
    formattedConversionCostPerNewCustomer: conversionNew > 0
      ? formatCurrency(conversionSpend / conversionNew, currency)
      : "--",
    conversionCostPerNewCustomerBasis: "Conversion campaigns only, excluding awareness spend.",
    conversionCampaignCount: conversionRows.length,

    averageNewCustomerOrderValue: totals.newCustomers > 0 ? totals.newCustomerRevenue / totals.newCustomers : 0,
    averageExistingCustomerOrderValue: totals.existingCustomers > 0
      ? totals.existingCustomerRevenue / totals.existingCustomers
      : 0,

    formattedNewCustomerRevenue: formatCurrency(totals.newCustomerRevenue, currency),
    formattedExistingCustomerRevenue: formatCurrency(totals.existingCustomerRevenue, currency),

    // Rows the panel renders, biggest acquisition source first.
    campaigns: rows
      .filter((row) => row.newCustomers > 0 || row.existingCustomers > 0)
      .sort((left, right) => right.newCustomers - left.newCustomers)
      .map((row) => ({
        ...row,
        formattedSpend: formatCurrency(row.spend, currency),
        formattedNewCustomerRevenue: formatCurrency(row.newCustomerRevenue, currency),
        formattedCostPerNewCustomer: row.costPerNewCustomer > 0
          ? formatCurrency(row.costPerNewCustomer, currency)
          : "--"
      }))
  };
}

function buildCustomerAcquisitionWarnings(acquisition = null) {
  const warnings = [];
  if (!acquisition) return warnings;

  if (!acquisition.available) {
    warnings.push(acquisition.unavailableReason);
    return warnings;
  }

  if (acquisition.untaggedShare >= 5) {
    warnings.push(`${acquisition.untaggedShare}% of purchases (${acquisition.untaggedPurchases}) matched neither the New_customer nor the Existing_customer conversion, so the new-customer count is a floor rather than a total.`);
  }

  if (!(acquisition.newCustomers > 0) && acquisition.totalPurchases > 0) {
    warnings.push("Purchases were recorded but no New_customer conversions fired, which usually means the shop stopped sending the new_customer event.");
  }

  return warnings;
}

module.exports = {
  EXISTING_CUSTOMER_NAMES,
  NEW_CUSTOMER_NAMES,
  buildCustomerAcquisition,
  buildCustomerAcquisitionWarnings,
  extractCustomerAcquisition,
  resolveCustomerConversionActionTypes,
  sumActionTypes
};
