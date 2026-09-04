const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCustomerAcquisition,
  buildCustomerAcquisitionWarnings,
  extractCustomerAcquisition,
  resolveCustomerConversionActionTypes,
  sumActionTypes
} = require("../server/meta/customer-acquisition");

// Mirrors the real Westpack account: two custom conversions created 2024-10-22 on the
// Magento events new_customer / existing_customer, plus an unrelated traffic one.
const WESTPACK_CONVERSIONS = [
  { id: "1816503948926827", name: "Google Traffic", custom_event_type: "OTHER" },
  { id: "573537871687880", name: "Existing_customer", custom_event_type: "OTHER" },
  { id: "775766277988531", name: "New_customer", custom_event_type: "OTHER" }
];

const NEW_TYPE = "offsite_conversion.custom.775766277988531";
const EXISTING_TYPE = "offsite_conversion.custom.573537871687880";

const formatCurrency = (value, currency) => `${currency} ${Math.round(Number(value) || 0)}`;

test("the account's custom conversions resolve to the right action types", () => {
  const resolved = resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS);

  assert.deepEqual(resolved.newCustomerActionTypes, [NEW_TYPE]);
  assert.deepEqual(resolved.existingCustomerActionTypes, [EXISTING_TYPE]);
  assert.equal(resolved.available, true);
  // The traffic conversion must not be mistaken for a customer signal.
  assert.equal(resolved.newCustomerActionTypes.includes("offsite_conversion.custom.1816503948926827"), false);
  assert.equal(resolved.existingCustomerActionTypes.includes("offsite_conversion.custom.1816503948926827"), false);
});

test("naming variants resolve, so renaming in Events Manager does not silently break", () => {
  for (const name of ["New_customer", "new customer", "NewCustomer", "new-customers", "NEW_CUSTOMER", "Ny kunde"]) {
    const resolved = resolveCustomerConversionActionTypes([{ id: "1", name }]);
    assert.equal(resolved.available, true, `did not resolve "${name}"`);
  }
  for (const name of ["Existing_customer", "returning customer", "ExistingCustomers", "Eksisterende kunde"]) {
    const resolved = resolveCustomerConversionActionTypes([{ id: "2", name }]);
    assert.equal(resolved.existingCustomerActionTypes.length, 1, `did not resolve "${name}"`);
  }
});

test("archived conversions and unrelated names are ignored", () => {
  const resolved = resolveCustomerConversionActionTypes([
    { id: "1", name: "New_customer", is_archived: true },
    { id: "2", name: "Newsletter signup" },
    { id: "3", name: "" },
    { id: "", name: "New_customer" }
  ]);
  assert.equal(resolved.available, false);
  assert.deepEqual(resolved.newCustomerActionTypes, []);
  assert.match(resolved.newCustomerActionTypes.length ? "" : "no new customer conversion", /no new customer/);
});

test("a missing conversion reports unavailable rather than zero new customers", () => {
  // The distinction matters: zero would read as "we acquired nobody", which is a business
  // claim the data does not support.
  const resolved = resolveCustomerConversionActionTypes([]);
  const acquisition = buildCustomerAcquisition({
    campaigns: [{ id: "c1", spend_value: 5000, purchases_value: 40 }],
    actionTypes: resolved,
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.available, false);
  assert.match(acquisition.unavailableReason, /No custom conversion named New_customer/);
  assert.equal(acquisition.newCustomers, 0);
  assert.deepEqual(buildCustomerAcquisitionWarnings(acquisition), [acquisition.unavailableReason]);
});

test("sumActionTypes adds every matching type and ignores the rest", () => {
  const actions = [
    { action_type: NEW_TYPE, value: "12" },
    { action_type: EXISTING_TYPE, value: "30" },
    { action_type: "omni_purchase", value: "50" }
  ];
  assert.equal(sumActionTypes(actions, [NEW_TYPE]), 12);
  assert.equal(sumActionTypes(actions, [NEW_TYPE, EXISTING_TYPE]), 42);
  assert.equal(sumActionTypes(actions, []), 0);
  assert.equal(sumActionTypes(null, [NEW_TYPE]), 0);
});

test("per-campaign extraction pulls counts and revenue off the insight row", () => {
  const actionTypes = resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS);
  const extracted = extractCustomerAcquisition({
    actions: [{ action_type: NEW_TYPE, value: "108" }, { action_type: EXISTING_TYPE, value: "285" }],
    action_values: [{ action_type: NEW_TYPE, value: "150000" }, { action_type: EXISTING_TYPE, value: "840000" }]
  }, actionTypes);

  assert.equal(extracted.new_customers_value, 108);
  assert.equal(extracted.new_customer_revenue_value, 150000);
  assert.equal(extracted.existing_customers_value, 285);
  assert.equal(extracted.existing_customer_revenue_value, 840000);
});

test("extraction on a row with no customer events yields zeros, not undefined", () => {
  const actionTypes = resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS);
  const extracted = extractCustomerAcquisition({ actions: [], action_values: [] }, actionTypes);
  assert.deepEqual(extracted, {
    new_customers_value: 0,
    new_customer_revenue_value: 0,
    existing_customers_value: 0,
    existing_customer_revenue_value: 0
  });
  assert.deepEqual(extractCustomerAcquisition({}, {}), {
    new_customers_value: 0,
    new_customer_revenue_value: 0,
    existing_customers_value: 0,
    existing_customer_revenue_value: 0
  });
});

test("untagged purchases are reported separately and never folded into either side", () => {
  // The real account has ~22% of purchases matching neither conversion. Hiding that in
  // either bucket would misstate the acquisition number the team budgets against.
  const acquisition = buildCustomerAcquisition({
    campaigns: [{
      id: "c1",
      name: "Conv - 06 - FR",
      spend_value: 58861,
      purchases_value: 525,
      revenue_value: 1400000,
      new_customers_value: 108,
      new_customer_revenue_value: 150000,
      existing_customers_value: 285,
      existing_customer_revenue_value: 840000
    }],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.newCustomers, 108);
  assert.equal(acquisition.existingCustomers, 285);
  assert.equal(acquisition.taggedPurchases, 393);
  assert.equal(acquisition.totalPurchases, 525);
  assert.equal(acquisition.untaggedPurchases, 132);
  assert.equal(acquisition.untaggedShare, 25.1);
  assert.equal(acquisition.taggedShare, 74.9);
  // Revenue reconciles the same way.
  assert.equal(acquisition.untaggedRevenue, 1400000 - 150000 - 840000);
  // Shares never exceed the whole.
  assert.equal(acquisition.taggedShare + acquisition.untaggedShare, 100);
});

test("a tagged count above the purchase count clamps instead of going negative", () => {
  // Custom conversions can use a different attribution window than omni_purchase, so
  // tagged > purchases is possible and must not produce a negative remainder.
  const acquisition = buildCustomerAcquisition({
    campaigns: [{
      id: "c1", spend_value: 1000, purchases_value: 10, revenue_value: 5000,
      new_customers_value: 8, existing_customers_value: 9,
      new_customer_revenue_value: 4000, existing_customer_revenue_value: 4000
    }],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.untaggedPurchases, 0);
  assert.equal(acquisition.untaggedRevenue, 0);
  assert.ok(acquisition.untaggedShare >= 0);
});

test("cost per new customer is reported on two explicit bases", () => {
  // The narrower basis is the objective the advertiser set, not a new-vs-existing ratio.
  // A ratio rule was tried and rejected: on this account every conversion campaign brings
  // more existing than new customers, so it matched only a high-spend awareness outlier
  // and reported a cost per new customer worse than the blended figure.
  const acquisition = buildCustomerAcquisition({
    campaigns: [
      { id: "a", name: "Conv - 06 - FR", category: "conversion",
        spend_value: 30000, purchases_value: 100, revenue_value: 200000,
        new_customers_value: 60, existing_customers_value: 40,
        new_customer_revenue_value: 80000, existing_customer_revenue_value: 120000 },
      { id: "b", name: "Conv - 05 - DE", category: "conversion",
        spend_value: 12000, purchases_value: 164, revenue_value: 400000,
        new_customers_value: 16, existing_customers_value: 148,
        new_customer_revenue_value: 20000, existing_customer_revenue_value: 380000 },
      // Awareness: heavy spend, almost no attributed customers. Including it in the
      // narrow basis is exactly what we want to avoid.
      { id: "c", name: "BA-01", category: "awareness",
        spend_value: 116783, purchases_value: 10, revenue_value: 30000,
        new_customers_value: 2, existing_customers_value: 13,
        new_customer_revenue_value: 3000, existing_customer_revenue_value: 27000 }
    ],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  const totalNew = 60 + 16 + 2;
  assert.equal(acquisition.costPerNewCustomer, (30000 + 12000 + 116783) / totalNew);
  assert.match(acquisition.costPerNewCustomerBasis, /^Blended/);

  assert.equal(acquisition.conversionCampaignCount, 2);
  assert.equal(acquisition.conversionCostPerNewCustomer, (30000 + 12000) / (60 + 16));
  assert.match(acquisition.conversionCostPerNewCustomerBasis, /Conversion campaigns only/);

  // The narrow basis must be the cheaper, more useful one - that is its whole purpose.
  assert.ok(
    acquisition.conversionCostPerNewCustomer < acquisition.costPerNewCustomer,
    "conversion-only cost per new customer should be below the blended figure"
  );
});

test("the narrow basis reports nothing rather than a wrong number without objectives", () => {
  // If objective groups are missing, no campaign qualifies and the figure must go blank
  // instead of silently falling back to something else.
  const acquisition = buildCustomerAcquisition({
    campaigns: [{ id: "a", spend_value: 1000, purchases_value: 10, revenue_value: 5000, new_customers_value: 4 }],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.conversionCampaignCount, 0);
  assert.equal(acquisition.conversionCostPerNewCustomer, 0);
  assert.equal(acquisition.formattedConversionCostPerNewCustomer, "--");
  // The blended figure is still reported.
  assert.equal(acquisition.costPerNewCustomer, 250);
});

test("per-campaign rows carry their own cost per new customer, sorted by new customers", () => {
  const acquisition = buildCustomerAcquisition({
    campaigns: [
      { id: "a", name: "Small", spend_value: 1000, purchases_value: 5, revenue_value: 9000,
        new_customers_value: 2, existing_customers_value: 3 },
      { id: "b", name: "Big", spend_value: 50000, purchases_value: 300, revenue_value: 900000,
        new_customers_value: 100, existing_customers_value: 200 },
      { id: "c", name: "NoCustomers", spend_value: 7000, purchases_value: 0, revenue_value: 0 }
    ],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.deepEqual(acquisition.campaigns.map((row) => row.name), ["Big", "Small"]);
  assert.equal(acquisition.campaigns[0].costPerNewCustomer, 500);
  assert.equal(acquisition.campaigns[1].costPerNewCustomer, 500);
  assert.equal(acquisition.campaigns[0].formattedCostPerNewCustomer, "DKK 500");
  // A campaign with neither customer type is not listed as an acquisition source.
  assert.equal(acquisition.campaigns.some((row) => row.name === "NoCustomers"), false);
});

test("average order value is reported per customer type", () => {
  const acquisition = buildCustomerAcquisition({
    campaigns: [{
      id: "a", spend_value: 1000, purchases_value: 100, revenue_value: 300000,
      new_customers_value: 50, new_customer_revenue_value: 70000,
      existing_customers_value: 50, existing_customer_revenue_value: 150000
    }],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.averageNewCustomerOrderValue, 1400);
  assert.equal(acquisition.averageExistingCustomerOrderValue, 3000);
  assert.equal(acquisition.newCustomerShare, 50);
});

test("an empty account does not divide by zero", () => {
  const acquisition = buildCustomerAcquisition({
    campaigns: [],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.newCustomers, 0);
  assert.equal(acquisition.costPerNewCustomer, 0);
  assert.equal(acquisition.formattedCostPerNewCustomer, "--");
  assert.equal(acquisition.newCustomerShare, 0);
  assert.equal(acquisition.untaggedShare, 0);
  assert.deepEqual(acquisition.campaigns, []);
  assert.equal(Number.isFinite(acquisition.averageNewCustomerOrderValue), true);
});

test("warnings flag the untagged gap and a silent event outage", () => {
  const actionTypes = resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS);

  const gap = buildCustomerAcquisition({
    campaigns: [{
      id: "a", spend_value: 1000, purchases_value: 2141, revenue_value: 5737738,
      new_customers_value: 471, new_customer_revenue_value: 658033,
      existing_customers_value: 1195, existing_customer_revenue_value: 3544528
    }],
    actionTypes, currency: "DKK", formatCurrency
  });
  const gapWarnings = buildCustomerAcquisitionWarnings(gap);
  assert.equal(gap.untaggedPurchases, 475);
  assert.equal(gap.untaggedShare, 22.2);
  assert.ok(gapWarnings.some((w) => /22.2% of purchases \(475\)/.test(w)));
  assert.ok(gapWarnings.some((w) => /floor rather than a total/.test(w)));

  // Purchases but no new-customer events: the shop probably stopped sending the event.
  const outage = buildCustomerAcquisition({
    campaigns: [{ id: "a", spend_value: 1000, purchases_value: 80, revenue_value: 100000, existing_customers_value: 80, existing_customer_revenue_value: 100000 }],
    actionTypes, currency: "DKK", formatCurrency
  });
  assert.ok(buildCustomerAcquisitionWarnings(outage).some((w) => /stopped sending the new_customer event/.test(w)));

  // A clean account produces no noise.
  const clean = buildCustomerAcquisition({
    campaigns: [{ id: "a", spend_value: 1000, purchases_value: 100, revenue_value: 100000, new_customers_value: 40, existing_customers_value: 60, new_customer_revenue_value: 40000, existing_customer_revenue_value: 60000 }],
    actionTypes, currency: "DKK", formatCurrency
  });
  assert.deepEqual(buildCustomerAcquisitionWarnings(clean), []);
});

test("the real 90-day account figures reproduce the numbers read off Meta", () => {
  // Guards the arithmetic against the values actually returned by the ad account on
  // 2026-09-04, so a refactor that changes any of them shows up here.
  const acquisition = buildCustomerAcquisition({
    campaigns: [{
      id: "account", spend_value: 719930, purchases_value: 2141, revenue_value: 5737738,
      new_customers_value: 471, new_customer_revenue_value: 658033,
      existing_customers_value: 1195, existing_customer_revenue_value: 3544528
    }],
    actionTypes: resolveCustomerConversionActionTypes(WESTPACK_CONVERSIONS),
    currency: "DKK",
    formatCurrency
  });

  assert.equal(acquisition.newCustomers, 471);
  assert.equal(acquisition.existingCustomers, 1195);
  assert.equal(acquisition.taggedPurchases, 1666);
  assert.equal(acquisition.untaggedPurchases, 475);
  assert.equal(acquisition.untaggedShare, 22.2);
  assert.equal(acquisition.newCustomerShare, 28.3);
  assert.equal(Math.round(acquisition.costPerNewCustomer), 1529);
  assert.equal(Math.round(acquisition.averageNewCustomerOrderValue), 1397);
  assert.equal(Math.round(acquisition.averageExistingCustomerOrderValue), 2966);
});
