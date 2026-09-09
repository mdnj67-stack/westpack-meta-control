const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Awareness campaigns had their totals replaced by the sum of their ad sets. Meta's
// campaign-level figure is the authoritative one and the ad-set breakdown is a
// convenience, so an incomplete breakdown did not add detail, it lost money.
//
// Measured on the live account on 2026-09-09: the BA - LAL campaign spent 38,888 DKK and
// its four ad sets accounted for 22,753 of it. The awareness lens therefore reported
// 82,578 DKK where Meta said 98,694 - a 16.3% understatement, with CPM pulled down to
// match.
//
// The check that should have caught it summed the already-overridden campaign totals and
// compared them against the ad-set totals: the same number on both sides, so it could
// never fire.

const root = join(__dirname, "..");

// Warnings about the ad-set breakdown specifically. The phrase "ad set" also turns up in
// the budget-coverage warning, which is a different fact about a different thing.
function breakdownWarnings(warnings) {
  return warnings.filter((warning) => /did not add up|returned no ad set insights/.test(warning));
}
const { buildQualityWarnings } = require(join(root, "api", "meta", "account-snapshot.js")).__internals;

test("an incomplete ad-set breakdown never replaces the campaign total", () => {
  const transformers = readFileSync(join(root, "server", "meta", "_snapshot-transformers.js"), "utf8");
  const override = transformers.slice(
    transformers.indexOf('if (baseCategory === "awareness")'),
    transformers.indexOf("const roas = spend > 0")
  );
  assert.ok(override.length > 0, "the awareness override is gone");

  // The campaign-level figure has to be captured before anything overwrites it.
  assert.match(transformers, /const campaignLevelSpend = spend;/);
  assert.match(override, /const adSetBreakdownReconciles/);
  assert.match(override, /if \(adSetsWithInsights\.length && adSetBreakdownReconciles\) \{/);

  // And the unguarded swap must be gone.
  assert.ok(
    !/if \(adSetsWithInsights\.length\) \{\s*\n\s*awarenessUsingAdSetInsights \+= 1;/.test(override),
    "the breakdown can still overwrite the campaign totals unconditionally"
  );
});

test("the reconciliation compares two different things", () => {
  // It used to read spend_value on both sides, which the override had already replaced
  // with the ad-set sum. A check that compares a value to itself always passes.
  const dashboard = readFileSync(join(root, "server", "meta", "_snapshot-dashboard.js"), "utf8");
  const line = dashboard.slice(
    dashboard.indexOf("const awarenessCampaignSpendTotal"),
    dashboard.indexOf("const awarenessAdSetSpendTotal")
  );

  assert.match(line, /campaign_level_spend_value/, "the campaign side is reading the overridden value again");
  assert.ok(!/^\s*const awarenessCampaignSpendTotal = buckets\.awareness\.reduce\(\(sum, campaign\) => sum \+ readNumber\(campaign\?\.spend_value, 0\), 0\);/m.test(dashboard));
});

test("the campaign-level figure travels in the payload", () => {
  // Without it the reconciliation has nothing to compare against, and nobody reading the
  // snapshot could tell an override had happened.
  const transformers = readFileSync(join(root, "server", "meta", "_snapshot-transformers.js"), "utf8");
  assert.match(transformers, /campaign_level_spend_value: campaignLevelSpend,/);
});

test("a rejected breakdown is reported, and only once", () => {
  // Three warnings fired for this one fact before: the rejection, "not all awareness
  // campaigns had ad set insight coverage", and "spend differ by more than 3%". The last
  // two were restatements of the first on a panel whose job is to be worth reading.
  const rejected = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 15,
    campaignsWithPeriodDataCount: 15,
    awarenessCampaignCount: 3,
    awarenessUsingAdSetInsights: 2,
    awarenessAdSetBreakdownRejected: 1,
    awarenessCampaignSpendTotal: 98694,
    awarenessAdSetSpendTotal: 82589,
    campaignSpendTotal: 252810,
    budgetAllocation: null
  });

  const aboutAdSets = breakdownWarnings(rejected);
  assert.equal(aboutAdSets.length, 1, `one fact, one warning, got: ${JSON.stringify(aboutAdSets)}`);
  assert.match(aboutAdSets[0], /did not add up/);
  assert.match(aboutAdSets[0], /campaign totals are shown/, "it must say what was done about it");
});

test("no ad-set data at all is a different message from a breakdown that failed to add up", () => {
  // A campaign with no ad-set insights has nothing to reconcile, so the rejection wording
  // would be wrong for it.
  const noData = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 15,
    campaignsWithPeriodDataCount: 15,
    awarenessCampaignCount: 3,
    awarenessUsingAdSetInsights: 0,
    awarenessAdSetBreakdownRejected: 0,
    awarenessCampaignSpendTotal: 98694,
    awarenessAdSetSpendTotal: 0,
    campaignSpendTotal: 252810,
    budgetAllocation: null
  });

  const aboutAdSets = breakdownWarnings(noData);
  assert.equal(aboutAdSets.length, 1);
  assert.match(aboutAdSets[0], /returned no ad set insights/);
});

test("a breakdown that reconciles says nothing at all", () => {
  const clean = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 15,
    campaignsWithPeriodDataCount: 15,
    awarenessCampaignCount: 3,
    awarenessUsingAdSetInsights: 3,
    awarenessAdSetBreakdownRejected: 0,
    awarenessCampaignSpendTotal: 98694,
    awarenessAdSetSpendTotal: 98694,
    campaignSpendTotal: 252810,
    budgetAllocation: null
  });

  assert.deepEqual(breakdownWarnings(clean), []);
});

test("the reach query covers the campaigns the lens shows, not just the active ones", () => {
  // The lens shows every awareness campaign that is active or spent in the period. The
  // reach query covered only the active ones, so on the rebuilt account the Reach figure
  // described a different set of campaigns from the Spend printed beside it.
  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  const block = handler.slice(
    handler.indexOf("const campaignIdsWithPeriodSpend"),
    handler.indexOf("const [accountReach, awarenessReach]")
  );
  assert.ok(block.length > 0, "the awareness id set is gone");

  assert.match(block, /campaign\.status === "ACTIVE" \|\| campaignIdsWithPeriodSpend\.has\(id\)/);
  assert.ok(
    !/activeCampaigns\s*\n\s*\.filter\(\(campaign\) => classifyCampaign\(campaign\) === "awareness"\)/.test(handler),
    "the id set is being built from the active list again"
  );
});
