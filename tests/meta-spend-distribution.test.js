const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildGeneralSpendDistribution,
  buildLensStats,
  buildQualityWarnings
} = require("../api/meta/account-snapshot").__internals;
const { calculateBudgetAllocation } = require("../server/meta/budget-allocation");

const DATE_SCOPE = { label: "Last 30 days", shortLabel: "30d", days: 30 };

// Mirrors the Westpack account: OUTCOME_SALES, OUTCOME_AWARENESS and OUTCOME_LEADS only.
function buildWestpackCampaigns() {
  return [
    { id: "c1", name: "BA - 01 - Reach DK", objective: "OUTCOME_AWARENESS", spend_value: 4000, impressions_value: 800000, reach_value: 400000 },
    { id: "c2", name: "BA - 02 - Reach EU", objective: "OUTCOME_AWARENESS", spend_value: 2000, impressions_value: 400000, reach_value: 200000 },
    { id: "c3", name: "Conv - 06 - FR", objective: "OUTCOME_SALES", spend_value: 9000, purchases_value: 180, revenue_value: 54000 },
    { id: "c4", name: "Conv - 07 - DE", objective: "OUTCOME_SALES", spend_value: 6000, purchases_value: 120, revenue_value: 30000 },
    { id: "c5", name: "LEAD - 02 - Unboxing Guide - EU", objective: "OUTCOME_LEADS", spend_value: 3000, leads_value: 60 }
  ];
}

function buildWestpackBudgetCampaigns() {
  return [
    { id: "c1", objective: "OUTCOME_AWARENESS", daily_budget: 200 },
    { id: "c2", objective: "OUTCOME_AWARENESS", daily_budget: 400 },
    { id: "c3", objective: "OUTCOME_SALES", daily_budget: 900 },
    { id: "c4", objective: "OUTCOME_SALES", daily_budget: 700 },
    { id: "c5", objective: "OUTCOME_LEADS", daily_budget: 300 }
  ];
}

test("only the objective groups the account uses get a row", () => {
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 30);
  const split = buildGeneralSpendDistribution(buildWestpackCampaigns(), DATE_SCOPE, "DKK", allocation);

  // Display order puts the pair the team compares day to day first.
  assert.deepEqual(split.items.map((item) => item.key), ["awareness", "conversion", "leads"]);
  // No permanent zero rows for objectives this account never runs.
  assert.equal(split.items.some((item) => item.key === "traffic"), false);
  assert.equal(split.items.some((item) => item.key === "unclassified"), false);
});

test("spend percentages reconcile to the reported spend total", () => {
  const campaigns = buildWestpackCampaigns();
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 30);
  const split = buildGeneralSpendDistribution(campaigns, DATE_SCOPE, "DKK", allocation);

  assert.equal(split.totalAmount, 24000);
  const spendSum = split.items.reduce((sum, item) => sum + item.amount, 0);
  assert.equal(spendSum, split.totalAmount);

  const percentSum = split.items.reduce((sum, item) => sum + item.percentage, 0);
  assert.ok(Math.abs(percentSum - 100) < 0.15, `spend percentages summed to ${percentSum}`);

  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));
  assert.equal(byKey.awareness.amount, 6000);
  assert.equal(byKey.awareness.percentage, 25);
  assert.equal(byKey.conversion.amount, 15000);
  assert.equal(byKey.conversion.percentage, 62.5);
  assert.equal(byKey.leads.amount, 3000);
  assert.equal(byKey.leads.percentage, 12.5);
});

test("budget percentages reconcile to the planned budget total", () => {
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 30);
  const split = buildGeneralSpendDistribution(buildWestpackCampaigns(), DATE_SCOPE, "DKK", allocation);

  // 2500 kr/day over a 30-day scope.
  assert.equal(split.totalBudgetAmount, 75000);
  assert.equal(split.kpiBudgetAmount, 75000);

  const budgetSum = split.items.reduce((sum, item) => sum + item.budgetAmount, 0);
  assert.equal(budgetSum, split.totalBudgetAmount);

  const percentSum = split.items.reduce((sum, item) => sum + item.budgetPercentage, 0);
  assert.ok(Math.abs(percentSum - 100) < 0.15, `budget percentages summed to ${percentSum}`);

  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));
  assert.equal(byKey.awareness.budgetAmount, 18000);
  assert.equal(byKey.awareness.budgetPercentage, 24);
  assert.equal(byKey.conversion.budgetAmount, 48000);
  assert.equal(byKey.conversion.budgetPercentage, 64);
  assert.equal(byKey.leads.budgetAmount, 9000);
  assert.equal(byKey.leads.budgetPercentage, 12);
});

test("budget is stated per 30-day month regardless of the selected range", () => {
  // The department budgets monthly: "the budget is 200k" means per 30 days. So a 7-day
  // range must not rescale the budget down to a 7-day figure.
  const weekScope = { label: "Last 7 days", shortLabel: "7d", days: 7 };
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 7);
  const split = buildGeneralSpendDistribution(buildWestpackCampaigns(), weekScope, "DKK", allocation);

  assert.equal(split.totalBudgetAmount, 2500 * 30);
  assert.equal(split.kpiBudgetAmount, 2500 * 30);
  assert.match(split.totalBudgetLabel, /30 days/);
  assert.match(split.budgetMixLabel, /30 days/);

  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));
  assert.equal(byKey.conversion.budgetAmount, 1600 * 30);
  assert.equal(byKey.conversion.budgetPercentage, 64);

  // Actual spend stays the real amount for the selected range and is not rescaled.
  assert.equal(split.totalAmount, 24000);
  assert.equal(byKey.conversion.amount, 15000);
});

test("pacing compares a 30-day spend pace against the 30-day budget", () => {
  const weekScope = { label: "Last 7 days", shortLabel: "7d", days: 7 };
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 7);
  const split = buildGeneralSpendDistribution(buildWestpackCampaigns(), weekScope, "DKK", allocation);

  // 24,000 kr over 7 days paces to 24000 / 7 * 30 across a month.
  const expectedPace = (24000 / 7) * 30;
  assert.ok(Math.abs(split.totalMonthlySpendPace - expectedPace) < 0.01);
  assert.equal(split.periodDays, 7);
  assert.match(split.paceLabel, /30-day spend pace/);

  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));
  const conversionPace = (15000 / 7) * 30;
  assert.ok(Math.abs(byKey.conversion.monthlySpendPace - conversionPace) < 0.01);
  assert.equal(
    byKey.conversion.pacePercentage,
    Number(((conversionPace / (1600 * 30)) * 100).toFixed(1))
  );
});

test("over a 30-day range the pace is the actual spend, so pacing reads directly", () => {
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 30);
  const split = buildGeneralSpendDistribution(buildWestpackCampaigns(), DATE_SCOPE, "DKK", allocation);

  assert.equal(split.totalMonthlySpendPace, split.totalAmount);
  assert.match(split.paceLabel, /^Spend vs monthly budget$/);

  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));
  assert.equal(byKey.conversion.monthlySpendPace, byKey.conversion.amount);
  // 15,000 kr spent against a 48,000 kr monthly budget.
  assert.equal(byKey.conversion.pacePercentage, 31.3);
});

test("pacing is zero rather than infinite when an objective has no budget", () => {
  const split = buildGeneralSpendDistribution(
    [{ id: "c1", objective: "OUTCOME_SALES", spend_value: 5000 }],
    DATE_SCOPE,
    "DKK",
    calculateBudgetAllocation([{ id: "c1", objective: "OUTCOME_SALES" }], [], 30)
  );

  const conversion = split.items.find((item) => item.key === "conversion");
  assert.equal(conversion.budgetAmount, 0);
  assert.equal(conversion.pacePercentage, 0);
  assert.equal(split.totalPacePercentage, 0);
  assert.equal(Number.isFinite(conversion.pacePercentage), true);
});

test("a lifetime-budget campaign shows real money instead of a zero row", () => {
  const campaigns = [
    { id: "c1", objective: "OUTCOME_AWARENESS", spend_value: 1000 },
    { id: "c2", objective: "OUTCOME_SALES", spend_value: 5000 }
  ];
  const allocation = calculateBudgetAllocation(
    [
      { id: "c1", objective: "OUTCOME_AWARENESS", daily_budget: 100 },
      {
        id: "c2",
        objective: "OUTCOME_SALES",
        lifetime_budget: 6000,
        start_time: "2026-09-01T00:00:00+0200",
        stop_time: "2026-09-21T00:00:00+0200"
      }
    ],
    [],
    30
  );
  const split = buildGeneralSpendDistribution(campaigns, DATE_SCOPE, "DKK", allocation);
  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));

  // 6000 kr over a 20-day flight is 300 kr/day, so 9000 kr across the 30-day scope.
  assert.equal(byKey.conversion.budgetAmount, 9000);
  assert.notEqual(byKey.conversion.formattedBudgetAmount, "--");
  assert.equal(byKey.conversion.budgetPercentage, 75);
});

test("an unmapped objective is surfaced as its own row, not folded into awareness", () => {
  const campaigns = [
    { id: "c1", objective: "OUTCOME_AWARENESS", spend_value: 1000 },
    { id: "c2", objective: "OUTCOME_SOMETHING_META_ADDED", spend_value: 4000 }
  ];
  const split = buildGeneralSpendDistribution(campaigns, DATE_SCOPE, "DKK", null);
  const byKey = Object.fromEntries(split.items.map((item) => [item.key, item]));

  assert.equal(byKey.awareness.amount, 1000);
  assert.ok(byKey.unclassified, "unmapped spend has no row");
  assert.equal(byKey.unclassified.amount, 4000);
  assert.equal(byKey.unclassified.label, "Unclassified");
  assert.equal(split.unclassifiedAmount, 4000);
  assert.equal(split.unclassifiedCampaignCount, 1);
  // Reconciliation still holds with an unmapped group present.
  assert.equal(split.items.reduce((sum, item) => sum + item.amount, 0), split.totalAmount);
});

test("a missing budget allocation blanks the budget figures rather than inventing them", () => {
  const split = buildGeneralSpendDistribution(buildWestpackCampaigns(), DATE_SCOPE, "DKK", null);

  assert.equal(split.totalBudgetAmount, 0);
  assert.equal(split.formattedTotalBudgetAmount, "--");
  assert.equal(split.formattedKpiBudgetAmount, "--");
  assert.equal(split.items.every((item) => item.formattedBudgetAmount === "--"), true);
  assert.equal(split.items.every((item) => item.budgetPercentage === 0), true);
  // Spend is real data and must still be reported.
  assert.equal(split.totalAmount, 24000);
});

test("an empty account produces an empty split without dividing by zero", () => {
  const split = buildGeneralSpendDistribution([], DATE_SCOPE, "DKK", calculateBudgetAllocation([], [], 30));

  assert.deepEqual(split.items, []);
  assert.equal(split.totalAmount, 0);
  assert.equal(split.formattedTotalBudgetAmount, "--");
});

test("general lens stat cards follow the same dynamic objective rows", () => {
  const campaigns = buildWestpackCampaigns();
  const allocation = calculateBudgetAllocation(buildWestpackBudgetCampaigns(), [], 30);
  const generalSpendDistribution = buildGeneralSpendDistribution(campaigns, DATE_SCOPE, "DKK", allocation);
  const stats = buildLensStats(campaigns, "general", DATE_SCOPE, {
    currency: "DKK",
    generalSpendDistribution
  });

  // A total card plus one card per objective group present.
  assert.equal(stats.length, generalSpendDistribution.items.length + 1);
  assert.match(stats[0].label, /Spend/);
  assert.deepEqual(
    stats.slice(1).map((stat) => stat.label),
    generalSpendDistribution.items.map((item) => item.label)
  );
});

test("quality warnings report unmapped objectives and budget coverage gaps", () => {
  const allocation = calculateBudgetAllocation(
    [
      { id: "c1", objective: "OUTCOME_SALES", daily_budget: 500 },
      { id: "c2", objective: "OUTCOME_AWARENESS", lifetime_budget: 3000 },
      { id: "c3", objective: "OUTCOME_LEADS" }
    ],
    [],
    30
  );

  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, confidence: "exact", reason: "exact" },
    campaignSpendTotal: 20000,
    budgetAllocation: allocation,
    unclassifiedCampaignCount: 2,
    unclassifiedSpendTotal: 4500,
    accountCurrency: "DKK",
    periodDays: 30
  });

  assert.ok(warnings.some((warning) => /2 campaign\(s\) carry an objective this dashboard does not map/.test(warning)));
  assert.ok(warnings.some((warning) => /lifetime budget with no end date/.test(warning)));
  assert.ok(warnings.some((warning) => /reported no daily or lifetime budget/.test(warning)));
  // An exact divisor must not produce a confidence warning any more.
  assert.equal(warnings.some((warning) => /confidence/.test(warning)), false);
});

test("the unclassified warning names the campaigns and the objectives Meta reported", () => {
  // A bare count gives nowhere to start: either the objective belongs in the mapping
  // table or the campaign needs fixing in Ads Manager, and you need the name to tell.
  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, confidence: "exact", reason: "exact" },
    campaignSpendTotal: 20000,
    budgetAllocation: calculateBudgetAllocation([], [], 30),
    unclassifiedCampaignCount: 2,
    unclassifiedSpendTotal: 4500,
    unclassifiedCampaigns: [
      { id: "c9", name: "Store Visits DK", objective: "OUTCOME_STORE_TRAFFIC" },
      { id: "c10", name: "Legacy import", objective: "" }
    ],
    accountCurrency: "DKK",
    periodDays: 30
  });

  const warning = warnings.find((entry) => /does not map/.test(entry));
  assert.ok(warning, "no unclassified warning was produced");
  assert.match(warning, /Store Visits DK \(OUTCOME_STORE_TRAFFIC\)/);
  assert.match(warning, /Legacy import \(no objective reported\)/);
});

test("the unclassified warning caps the named campaigns and reports the remainder", () => {
  const many = Array.from({ length: 9 }, (_, index) => ({
    id: `c${index}`,
    name: `Campaign ${index}`,
    objective: "OUTCOME_MYSTERY"
  }));

  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, confidence: "exact", reason: "exact" },
    campaignSpendTotal: 20000,
    budgetAllocation: calculateBudgetAllocation([], [], 30),
    unclassifiedCampaignCount: many.length,
    unclassifiedSpendTotal: 9000,
    unclassifiedCampaigns: many,
    accountCurrency: "DKK",
    periodDays: 30
  });

  const warning = warnings.find((entry) => /does not map/.test(entry));
  assert.match(warning, /Campaign 0 \(OUTCOME_MYSTERY\)/);
  assert.match(warning, /Campaign 4 \(OUTCOME_MYSTERY\)/);
  assert.equal(/Campaign 5 /.test(warning), false, "named more than five campaigns");
  assert.match(warning, /and 4 more/);
});

test("the unclassified warning survives a missing campaign list", () => {
  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, confidence: "exact", reason: "exact" },
    campaignSpendTotal: 20000,
    budgetAllocation: calculateBudgetAllocation([], [], 30),
    unclassifiedCampaignCount: 3,
    unclassifiedSpendTotal: 1000,
    accountCurrency: "DKK",
    periodDays: 30
  });

  const warning = warnings.find((entry) => /does not map/.test(entry));
  assert.ok(warning);
  assert.match(warning, /3 campaign\(s\)/);
});
