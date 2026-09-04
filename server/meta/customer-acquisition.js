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

// omni_purchase and its aliases, needed so each window can compute its own untagged
// remainder rather than borrowing the dashboard range's.
const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.purchase",
  "offsite_conversion.fb_pixel_purchase"
];

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

function firstActionValue(entries = [], actionTypes = []) {
  const list = Array.isArray(entries) ? entries : [];
  for (const type of actionTypes) {
    const match = list.find((entry) => entry.action_type === type);
    if (match && match.value != null) return readNumber(match.value, 0);
  }
  return 0;
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

// --- Month-to-date trend ------------------------------------------------------------
//
// New customers is the figure the marketing team is measured on, so a bare count is not
// enough: the question is whether acquisition is improving. The comparison asked for is
// month-to-date against the SAME ELAPSED POINT in the previous month - on 4 September,
// 1-4 September against 1-4 August. Comparing a partial month against a whole one would
// always make the current month look worse.
//
// Boundaries are computed in the ad account's own timezone, because that is the timezone
// Meta evaluates an insights time_range in. This account is on America/Los_Angeles, about
// nine hours behind Copenhagen, so "today" here is not always the user's today.
function accountDateParts(date, timeZone) {
  try {
    // en-CA formats as YYYY-MM-DD.
    const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date).split("-").map(Number);
    return { year, month, day };
  } catch (error) {
    const iso = new Date(date).toISOString().slice(0, 10).split("-").map(Number);
    return { year: iso[0], month: iso[1], day: iso[2] };
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveMonthToDateWindows(now = new Date(), timeZone = "") {
  const { year, month, day } = accountDateParts(now, timeZone);

  // Today is excluded from the compared windows. It is still in progress, while the
  // matching day last month is complete, so including it always penalises the current
  // month - and on this account it penalises it by nearly a whole day, because the ad
  // account runs on America/Los_Angeles and the Copenhagen working day is most of the way
  // through before Meta's day has really started. On 2026-09-04 including today read as
  // +26% where complete days alone read as +71%: the same data, opposite impressions.
  // Today is still reported, separately, so nothing is hidden.
  const comparedDay = day - 1;
  const comparable = comparedDay >= 1;

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthLength = daysInMonth(previousYear, previousMonth);
  // 31 March has no 31 February. Clamp and say so, rather than silently comparing
  // 31 days against 28.
  const previousDay = Math.min(Math.max(comparedDay, 1), previousMonthLength);

  return {
    timeZone: timeZone || "UTC",
    comparable,
    notComparableReason: comparable
      ? ""
      : "It is the first of the month in the ad account's timezone, so there are no completed days to compare yet.",
    current: {
      since: `${year}-${pad(month)}-01`,
      until: `${year}-${pad(month)}-${pad(Math.max(comparedDay, 1))}`,
      days: comparable ? comparedDay : 0,
      label: comparable ? `the first ${comparedDay} days of this month` : "this month so far"
    },
    previous: {
      since: `${previousYear}-${pad(previousMonth)}-01`,
      until: `${previousYear}-${pad(previousMonth)}-${pad(previousDay)}`,
      days: comparable ? previousDay : 0,
      label: comparable ? `the same ${previousDay} days last month` : "the same days last month"
    },
    // The day in progress, reported on its own rather than folded into the comparison.
    today: {
      date: `${year}-${pad(month)}-${pad(day)}`,
      label: "so far today"
    },
    // The window a single daily fetch has to cover to serve all three.
    fetch: {
      since: `${previousYear}-${pad(previousMonth)}-01`,
      until: `${year}-${pad(month)}-${pad(day)}`
    },
    clamped: comparable && previousDay < comparedDay,
    clampedNote: comparable && previousDay < comparedDay
      ? `The previous month has only ${previousMonthLength} days, so the comparison covers its first ${previousDay} days against this month's first ${comparedDay}.`
      : ""
  };
}

// --- Panel-local window presets ------------------------------------------------------
//
// The acquisition panel gets its own period selector, independent of the dashboard's
// global date filter, so "how did August look in total" can be answered without
// disturbing every other lens. The default stays month-to-date.
//
// Every preset compares against an immediately preceding window of the SAME length. That
// invariant is the whole reason the comparison means anything: a complete month against a
// partial one, or 30 days against 31, reads as a change that is really just arithmetic.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function isoDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function shiftIsoDays(iso, days) {
  const [year, month, day] = String(iso).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function isoDaysBetween(since, until) {
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

// A rolling window of `days` ending yesterday, against the equally long window before it.
function rollingPreset(key, label, days, yesterday) {
  const currentSince = shiftIsoDays(yesterday, -(days - 1));
  const previousUntil = shiftIsoDays(currentSince, -1);
  const previousSince = shiftIsoDays(previousUntil, -(days - 1));
  return {
    key,
    label,
    comparable: true,
    note: "",
    current: { since: currentSince, until: yesterday, days, label: `the last ${days} days` },
    previous: { since: previousSince, until: previousUntil, days, label: `the ${days} days before that` }
  };
}

// A complete calendar month against the complete month before it.
//
// Calendar months are the one preset where the two windows can differ in length: 31
// against 30, or February against anything. That is what month-over-month reporting
// normally means, so it is offered - but the size of the mismatch is stated, because a
// 31-versus-28-day comparison carries an 11% arithmetic bias before any real change.
function calendarMonthPreset(key, year, month) {
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const currentDays = daysInMonth(year, month);
  const previousDays = daysInMonth(previousYear, previousMonth);
  const dayGap = Math.abs(currentDays - previousDays);
  const lengthNote = currentDays === previousDays
    ? ""
    : `${MONTH_NAMES[month - 1]} has ${currentDays} days against ${MONTH_NAMES[previousMonth - 1]}'s ${previousDays}, so about ${Math.round((dayGap / previousDays) * 100)}% of any difference is just the ${dayGap === 1 ? "extra day" : `${dayGap} days`}.`;

  return {
    key,
    label,
    comparable: true,
    note: lengthNote,
    current: {
      since: isoDate(year, month, 1),
      until: isoDate(year, month, daysInMonth(year, month)),
      days: daysInMonth(year, month),
      label
    },
    previous: {
      since: isoDate(previousYear, previousMonth, 1),
      until: isoDate(previousYear, previousMonth, daysInMonth(previousYear, previousMonth)),
      days: daysInMonth(previousYear, previousMonth),
      label: `${MONTH_NAMES[previousMonth - 1]} ${previousYear}`
    }
  };
}

function resolveAcquisitionWindowPresets(now = new Date(), timeZone = "") {
  const monthToDate = resolveMonthToDateWindows(now, timeZone);
  const { year, month, day } = accountDateParts(now, timeZone);
  // Everything is anchored on yesterday, because today is still running.
  const yesterday = shiftIsoDays(isoDate(year, month, day), -1);

  // The last two complete calendar months, named, so picking "August 2026" is one click.
  const lastFullMonth = month === 1 ? 12 : month - 1;
  const lastFullYear = month === 1 ? year - 1 : year;
  const priorMonth = lastFullMonth === 1 ? 12 : lastFullMonth - 1;
  const priorYear = lastFullMonth === 1 ? lastFullYear - 1 : lastFullYear;

  const presets = [
    {
      key: "month_to_date",
      label: "This month so far",
      comparable: monthToDate.comparable,
      note: monthToDate.comparable ? monthToDate.clampedNote : monthToDate.notComparableReason,
      current: monthToDate.current,
      previous: monthToDate.previous
    },
    calendarMonthPreset("last_full_month", lastFullYear, lastFullMonth),
    calendarMonthPreset("prior_full_month", priorYear, priorMonth),
    rollingPreset("last_7_days", "Last 7 days", 7, yesterday),
    rollingPreset("last_30_days", "Last 30 days", 30, yesterday),
    rollingPreset("last_90_days", "Last 90 days", 90, yesterday)
  ];

  // One fetch has to reach the earliest day any preset needs, plus today so the
  // in-progress figure can still be reported.
  const earliest = presets
    .map((preset) => preset.previous.since)
    .filter(Boolean)
    .sort()[0];

  return {
    timeZone: timeZone || "UTC",
    defaultPreset: "month_to_date",
    today: monthToDate.today,
    presets,
    fetch: {
      since: earliest,
      until: isoDate(year, month, day)
    }
  };
}

function withinWindow(date, window) {
  const value = String(date || "");
  return Boolean(value) && value >= window.since && value <= window.until;
}

function sumWindow(dailyRows = [], window, actionTypes = {}) {
  let newCustomers = 0;
  let existingCustomers = 0;
  let newCustomerRevenue = 0;
  let existingCustomerRevenue = 0;
  let purchases = 0;
  let spend = 0;
  let days = 0;

  for (const row of dailyRows || []) {
    if (!withinWindow(row?.date_start, window)) continue;
    days += 1;
    spend += readNumber(row?.spend, 0);
    const extracted = extractCustomerAcquisition(row, actionTypes);
    newCustomers += extracted.new_customers_value;
    existingCustomers += extracted.existing_customers_value;
    newCustomerRevenue += extracted.new_customer_revenue_value;
    existingCustomerRevenue += extracted.existing_customer_revenue_value;
    purchases += firstActionValue(row?.actions, PURCHASE_ACTION_TYPES);
  }

  return {
    newCustomers,
    existingCustomers,
    newCustomerRevenue,
    existingCustomerRevenue,
    purchases,
    spend,
    daysWithData: days
  };
}

// Shared comparison for one preset. Every preset uses the same maths, so a change to how
// direction or the summary reads can never apply to some periods and not others.
function compareAcquisitionWindow({
  dailyRows = [],
  preset,
  actionTypes = {},
  available = false,
  todayTotals = null,
  currency = "DKK",
  formatCurrency = (value) => String(value)
}) {
  const current = sumWindow(dailyRows, preset.current, actionTypes);
  const previous = sumWindow(dailyRows, preset.previous, actionTypes);

  const delta = current.newCustomers - previous.newCustomers;
  const percentChange = previous.newCustomers > 0
    ? Number((((current.newCustomers - previous.newCustomers) / previous.newCustomers) * 100).toFixed(1))
    : null;

  const comparable = available && preset.comparable !== false;
  const direction = !comparable
    ? "unknown"
    : previous.newCustomers === 0 && current.newCustomers === 0
      ? "flat"
      : previous.newCustomers === 0
        ? "new"
        : delta > 0
          ? "up"
          : delta < 0
            ? "down"
            : "flat";

  // The summary names both periods rather than describing them, so it reads correctly
  // whether the preset is a calendar month, a rolling window, or month to date.
  const currentPhrase = preset.current.label || "this period";
  const previousPhrase = preset.previous.label || "the period before";

  // Each window carries its own three-way purchase split. The first version let the panel
  // draw one bar from a preset's new-customer count against the dashboard range's
  // existing and untagged counts, which produced a bar that grew as the period widened
  // while its caption stayed on "this month" - the segments were from different periods.
  const windowSplit = (totals) => {
    const tagged = totals.newCustomers + totals.existingCustomers;
    const untagged = Math.max(0, totals.purchases - tagged);
    return {
      purchases: totals.purchases,
      taggedPurchases: tagged,
      untaggedPurchases: untagged,
      untaggedShare: totals.purchases > 0 ? Number(((untagged / totals.purchases) * 100).toFixed(1)) : 0,
      newCustomerShare: tagged > 0 ? Number(((totals.newCustomers / tagged) * 100).toFixed(1)) : 0,
      averageNewCustomerOrderValue: totals.newCustomers > 0 ? totals.newCustomerRevenue / totals.newCustomers : 0,
      averageExistingCustomerOrderValue: totals.existingCustomers > 0
        ? totals.existingCustomerRevenue / totals.existingCustomers
        : 0
    };
  };

  return {
    key: preset.key,
    label: preset.label,
    comparable,
    note: preset.note || "",
    // A preset whose windows differ in length is reported rather than quietly compared.
    equalLengthWindows: preset.current.days === preset.previous.days,

    current: {
      ...preset.current,
      newCustomers: current.newCustomers,
      existingCustomers: current.existingCustomers,
      newCustomerRevenue: current.newCustomerRevenue,
      formattedNewCustomerRevenue: formatCurrency(current.newCustomerRevenue, currency),
      existingCustomerRevenue: current.existingCustomerRevenue,
      formattedExistingCustomerRevenue: formatCurrency(current.existingCustomerRevenue, currency),
      ...windowSplit(current),
      spend: current.spend,
      formattedSpend: formatCurrency(current.spend, currency),
      costPerNewCustomer: current.newCustomers > 0 ? current.spend / current.newCustomers : 0,
      formattedCostPerNewCustomer: current.newCustomers > 0 ? formatCurrency(current.spend / current.newCustomers, currency) : "--",
      daysWithData: current.daysWithData
    },
    previous: {
      ...preset.previous,
      newCustomers: previous.newCustomers,
      existingCustomers: previous.existingCustomers,
      newCustomerRevenue: previous.newCustomerRevenue,
      formattedNewCustomerRevenue: formatCurrency(previous.newCustomerRevenue, currency),
      existingCustomerRevenue: previous.existingCustomerRevenue,
      formattedExistingCustomerRevenue: formatCurrency(previous.existingCustomerRevenue, currency),
      ...windowSplit(previous),
      spend: previous.spend,
      formattedSpend: formatCurrency(previous.spend, currency),
      costPerNewCustomer: previous.newCustomers > 0 ? previous.spend / previous.newCustomers : 0,
      formattedCostPerNewCustomer: previous.newCustomers > 0 ? formatCurrency(previous.spend / previous.newCustomers, currency) : "--",
      daysWithData: previous.daysWithData
    },

    delta,
    percentChange,
    direction,
    summary: !available
      ? "New customers cannot be counted for this ad account."
      : preset.comparable === false
        ? `${preset.note || "Nothing to compare yet."} ${todayTotals ? `${todayTotals.newCustomers} new customers so far today.` : ""}`.trim()
        : previous.newCustomers === 0 && current.newCustomers === 0
          ? `No new customers in ${currentPhrase} or ${previousPhrase}.`
          : previous.newCustomers === 0
            ? `${current.newCustomers} new customers in ${currentPhrase}, against none in ${previousPhrase}.`
            : `${current.newCustomers} new customers in ${currentPhrase}, against ${previous.newCustomers} in ${previousPhrase} (${delta >= 0 ? "+" : ""}${delta}, ${percentChange >= 0 ? "+" : ""}${percentChange}%).`
  };
}

// All panel presets, computed server side from one daily series so switching period in the
// UI costs no extra Meta request.
function buildCustomerAcquisitionWindows({
  dailyRows = [],
  actionTypes = {},
  now = new Date(),
  timeZone = "",
  currency = "DKK",
  formatCurrency = (value) => String(value)
} = {}) {
  const resolved = resolveAcquisitionWindowPresets(now, timeZone);
  const available = Boolean(actionTypes.available);
  const todayTotals = sumWindow(
    dailyRows,
    { since: resolved.today.date, until: resolved.today.date },
    actionTypes
  );

  return {
    available,
    defaultPreset: resolved.defaultPreset,
    timeZone: resolved.timeZone,
    today: { ...resolved.today, newCustomers: todayTotals.newCustomers, existingCustomers: todayTotals.existingCustomers },
    presets: resolved.presets.map((preset) => compareAcquisitionWindow({
      dailyRows, preset, actionTypes, available, todayTotals, currency, formatCurrency
    }))
  };
}
// Month-to-date is just one of the panel presets, so this delegates to it rather than
// recomputing the same comparison. The previous version duplicated 114 lines of the same
// maths, which meant the panel headline and the trend badge could drift apart - and a
// blind edit to one copy left `windowSplit` undefined in the other.
//
// The top-level fields are kept because the dashboard payload and its consumers were
// built against them.
function buildCustomerAcquisitionTrend({
  dailyRows = [],
  actionTypes = {},
  now = new Date(),
  timeZone = "",
  currency = "DKK",
  formatCurrency = (value) => String(value)
} = {}) {
  const windows = buildCustomerAcquisitionWindows({
    dailyRows, actionTypes, now, timeZone, currency, formatCurrency
  });
  const monthToDate = windows.presets.find((preset) => preset.key === windows.defaultPreset)
    || windows.presets[0];

  return {
    available: windows.available,
    timeZone: windows.timeZone,
    comparable: monthToDate.comparable,
    notComparableReason: monthToDate.comparable ? "" : monthToDate.note,
    clamped: Boolean(monthToDate.note),
    clampedNote: monthToDate.note || "",

    current: monthToDate.current,
    previous: monthToDate.previous,
    today: windows.today,

    delta: monthToDate.delta,
    percentChange: monthToDate.percentChange,
    direction: monthToDate.direction,
    summary: monthToDate.summary,

    // Every panel preset, computed from the same daily series, so switching period in the
    // UI needs no extra Meta request.
    windows,

    // Daily counts across the whole fetched span, labelled by which window each day falls
    // in, so a sparkline can be added without another fetch.
    dailySeries: (dailyRows || [])
      .map((row) => ({
        date: String(row?.date_start || ""),
        newCustomers: extractCustomerAcquisition(row, actionTypes).new_customers_value,
        month: withinWindow(row?.date_start, monthToDate.current)
          ? "current"
          : withinWindow(row?.date_start, monthToDate.previous)
            ? "previous"
            : "outside"
      }))
      .filter((point) => point.date)
      .sort((left, right) => left.date.localeCompare(right.date))
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
  buildCustomerAcquisitionTrend,
  buildCustomerAcquisitionWindows,
  compareAcquisitionWindow,
  resolveAcquisitionWindowPresets,
  resolveMonthToDateWindows,
  buildCustomerAcquisitionWarnings,
  extractCustomerAcquisition,
  resolveCustomerConversionActionTypes,
  sumActionTypes
};
