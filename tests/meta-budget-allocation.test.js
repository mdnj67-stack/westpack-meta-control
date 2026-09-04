const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OBJECTIVE_GROUP_ORDER,
  buildBudgetSanityWarnings,
  calculateBudgetAllocation,
  normalizeBudgetValue,
  resolveBudgetNormalization,
  resolveCurrencyMinorUnitDivisor,
  resolveDailyBudget,
  resolveScheduleDays
} = require("../server/meta/budget-allocation");

test("currency minor unit divisor is deterministic per currency", () => {
  assert.equal(resolveCurrencyMinorUnitDivisor("DKK"), 100);
  assert.equal(resolveCurrencyMinorUnitDivisor("dkk"), 100);
  assert.equal(resolveCurrencyMinorUnitDivisor("EUR"), 100);
  assert.equal(resolveCurrencyMinorUnitDivisor("JPY"), 1);
  assert.equal(resolveCurrencyMinorUnitDivisor("KWD"), 1000);
  // Unknown or missing currency falls back to the two-decimal default.
  assert.equal(resolveCurrencyMinorUnitDivisor(""), 100);
  assert.equal(resolveCurrencyMinorUnitDivisor("not-a-code"), 100);
});

test("budget normalization does not depend on the observed budget magnitudes", () => {
  // The old heuristic guessed the divisor from how big the raw numbers looked, so a
  // small account could be normalized differently from a large one. Same currency must
  // now always produce the same divisor.
  const small = resolveBudgetNormalization("DKK");
  const large = resolveBudgetNormalization("DKK");
  assert.equal(small.divisor, 100);
  assert.deepEqual(small, large);
  assert.equal(small.confidence, "exact");

  const missing = resolveBudgetNormalization("");
  assert.equal(missing.divisor, 100);
  assert.equal(missing.confidence, "assumed");
});

test("normalizeBudgetValue converts minor units and treats zero as absent", () => {
  assert.equal(normalizeBudgetValue("20000", 100), 200);
  assert.equal(normalizeBudgetValue(73300, 100), 733);
  assert.equal(normalizeBudgetValue("0", 100), null);
  assert.equal(normalizeBudgetValue(null, 100), null);
});

test("daily budgets are used directly, lifetime budgets are spread over their flight", () => {
  assert.deepEqual(
    resolveDailyBudget({ daily_budget: 200 }, 30),
    { dailyBudget: 200, source: "daily", scheduleDays: 0 }
  );

  const scheduled = resolveDailyBudget({
    lifetime_budget: 1000,
    start_time: "2026-09-01T00:00:00+0200",
    stop_time: "2026-09-11T00:00:00+0200"
  }, 30);
  assert.equal(scheduled.source, "lifetime");
  assert.equal(scheduled.scheduleDays, 10);
  assert.equal(scheduled.dailyBudget, 100);

  // Ad sets report the flight end as end_time rather than stop_time.
  const adSetScheduled = resolveDailyBudget({
    lifetime_budget: 700,
    start_time: "2026-09-01T00:00:00+0200",
    end_time: "2026-09-08T00:00:00+0200"
  }, 30);
  assert.equal(adSetScheduled.scheduleDays, 7);
  assert.equal(adSetScheduled.dailyBudget, 100);

  // With no usable flight the lifetime budget spreads across the reporting period, and
  // says so, so the dashboard can warn about it.
  const unscheduled = resolveDailyBudget({ lifetime_budget: 600 }, 30);
  assert.equal(unscheduled.source, "lifetime_unscheduled");
  assert.equal(unscheduled.dailyBudget, 20);

  assert.equal(resolveDailyBudget({}, 30).source, "none");
});

test("resolveScheduleDays falls back to the period when the flight is unusable", () => {
  assert.equal(resolveScheduleDays({ start_time: "2026-09-01", stop_time: "2026-09-01" }, 14), 14);
  assert.equal(resolveScheduleDays({ start_time: "nonsense", stop_time: "also-nonsense" }, 7), 7);
  assert.equal(resolveScheduleDays({}, 0), 30);
});

test("lifetime-budget campaigns contribute to their objective group instead of zero", () => {
  // This is the regression the dashboard shipped with: calculateBudgetAllocation read
  // only daily_budget, so a lifetime-budget campaign counted as 0 kr and 0% of the mix.
  const allocation = calculateBudgetAllocation(
    [
      { id: "c1", objective: "OUTCOME_AWARENESS", daily_budget: 200 },
      {
        id: "c2",
        objective: "OUTCOME_SALES",
        lifetime_budget: 3000,
        start_time: "2026-09-01T00:00:00+0200",
        stop_time: "2026-09-11T00:00:00+0200"
      }
    ],
    [],
    30
  );

  assert.equal(allocation.awarenessDailyBudget, 200);
  assert.equal(allocation.conversionDailyBudget, 300);
  assert.equal(allocation.totalDailyBudget, 500);
  assert.equal(allocation.totalMonthlyBudget, 15000);
  assert.equal(allocation.lifetimeBudgetCampaignCount, 1);
  assert.equal(allocation.unscheduledLifetimeBudgetCampaignCount, 0);
});

test("campaign budget optimisation wins over ad set budgets, ABO sums its ad sets", () => {
  const allocation = calculateBudgetAllocation(
    [
      { id: "cbo", objective: "OUTCOME_SALES", daily_budget: 500 },
      { id: "abo", objective: "OUTCOME_LEADS" }
    ],
    [
      // A CBO campaign's ad sets must not be added on top of the campaign budget.
      { id: "a1", campaignId: "cbo", daily_budget: 900 },
      { id: "a2", campaignId: "abo", daily_budget: 120 },
      { id: "a3", campaignId: "abo", daily_budget: 80 },
      // Ad sets on an unknown campaign are ignored rather than inflating the total.
      { id: "a4", campaignId: "does-not-exist", daily_budget: 10000 }
    ],
    30
  );

  assert.equal(allocation.conversionDailyBudget, 500);
  assert.equal(allocation.leadsDailyBudget, 200);
  assert.equal(allocation.totalDailyBudget, 700);
});

test("group budgets always reconcile to the reported total", () => {
  const allocation = calculateBudgetAllocation(
    [
      { id: "c1", objective: "OUTCOME_AWARENESS", daily_budget: 100 },
      { id: "c2", objective: "OUTCOME_SALES", daily_budget: 250 },
      { id: "c3", objective: "OUTCOME_LEADS", daily_budget: 50 },
      { id: "c4", objective: "OUTCOME_TRAFFIC", daily_budget: 75 },
      { id: "c5", objective: "SOMETHING_META_ADDED_LATER", daily_budget: 25 }
    ],
    [],
    7
  );

  const groupSum = OBJECTIVE_GROUP_ORDER
    .reduce((sum, group) => sum + allocation.periodBudgetByGroup[group], 0);
  assert.equal(groupSum, allocation.totalPeriodBudget);
  assert.equal(allocation.totalPeriodBudget, 500 * 7);

  // An objective this dashboard does not map keeps its money visible in its own group.
  assert.equal(allocation.unclassifiedDailyBudget, 25);
  assert.equal(allocation.trafficDailyBudget, 75);
});

test("conversion budget splits across standard and incremental attribution", () => {
  const allocation = calculateBudgetAllocation(
    [
      { id: "c1", objective: "OUTCOME_SALES", daily_budget: 300, attribution_mode: "standard" },
      { id: "c2", objective: "OUTCOME_SALES", daily_budget: 200, attribution_mode: "incremental" }
    ],
    [],
    30,
    { classifyConversionAttribution: (campaign) => campaign.attribution_mode }
  );

  assert.equal(allocation.conversionDailyBudget, 500);
  assert.equal(allocation.conversionStandardDailyBudget, 300);
  assert.equal(allocation.conversionIncrementalDailyBudget, 200);
  assert.equal(
    allocation.conversionStandardDailyBudget + allocation.conversionIncrementalDailyBudget,
    allocation.conversionDailyBudget
  );
});

test("campaigns with no budget are counted, not silently dropped", () => {
  const allocation = calculateBudgetAllocation(
    [
      { id: "c1", objective: "OUTCOME_SALES", daily_budget: 100 },
      { id: "c2", objective: "OUTCOME_SALES" },
      { id: "c3", objective: "OUTCOME_AWARENESS", daily_budget: 0 }
    ],
    [],
    30
  );

  assert.equal(allocation.campaignsWithoutBudgetCount, 2);
  assert.equal(allocation.totalDailyBudget, 100);
});

test("period days are normalised and never collapse the totals", () => {
  const zero = calculateBudgetAllocation([{ id: "c1", objective: "OUTCOME_SALES", daily_budget: 10 }], [], 0);
  assert.equal(zero.periodDays, 30);

  const week = calculateBudgetAllocation([{ id: "c1", objective: "OUTCOME_SALES", daily_budget: 10 }], [], 7);
  assert.equal(week.periodDays, 7);
  assert.equal(week.totalPeriodBudget, 70);
  // The topline stays a 30-day projection regardless of the selected range.
  assert.equal(week.totalMonthlyBudget, 300);
});

test("budget sanity warnings replace the silent divisor rewrite", () => {
  assert.deepEqual(
    buildBudgetSanityWarnings({ totalMonthlyBudget: 0, totalSpend: 5000, periodDays: 30 }),
    ["No active campaign or ad set budget was reported, so the planned budget split is empty."]
  );

  // 100x too high is exactly what a wrong unit conversion looks like.
  const inflated = buildBudgetSanityWarnings({
    totalMonthlyBudget: 1500000,
    totalSpend: 15000,
    periodDays: 30,
    currency: "DKK"
  });
  assert.equal(inflated.length, 1);
  assert.match(inflated[0], /100x the current spend pace/);

  const deflated = buildBudgetSanityWarnings({
    totalMonthlyBudget: 150,
    totalSpend: 15000,
    periodDays: 30,
    currency: "DKK"
  });
  assert.equal(deflated.length, 1);
  assert.match(deflated[0], /wrong unit/);

  // A plausible budget produces no noise.
  assert.deepEqual(
    buildBudgetSanityWarnings({ totalMonthlyBudget: 15000, totalSpend: 14000, periodDays: 30 }),
    []
  );
});

test("real Westpack budget figures normalise to the expected kroner", () => {
  // Raw ore values taken from the committed live snapshot in data/meta-live.js.
  const rawDailyBudgets = [20000, 60000, 40000, 90000, 70000, 73300, 110000];
  const { divisor } = resolveBudgetNormalization("DKK");
  const campaigns = rawDailyBudgets.map((raw, index) => ({
    id: `c${index}`,
    objective: "OUTCOME_SALES",
    daily_budget: normalizeBudgetValue(raw, divisor)
  }));

  const allocation = calculateBudgetAllocation(campaigns, [], 30);
  assert.equal(allocation.totalDailyBudget, 4633);
  assert.equal(allocation.totalMonthlyBudget, 138990);
});
