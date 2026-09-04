const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OBJECTIVE_GROUP_ORDER,
  classifyCampaign,
  resolveLensForObjectiveGroup,
  resolveObjectiveGroup,
  resolveObjectiveGroupLabel,
  splitByCategory
} = require("../server/meta/budget-allocation");

test("the objectives this account actually runs map to the expected groups", () => {
  // These three are the only objectives present in the Westpack account.
  assert.equal(resolveObjectiveGroup({ objective: "OUTCOME_AWARENESS" }), "awareness");
  assert.equal(resolveObjectiveGroup({ objective: "OUTCOME_SALES" }), "conversion");
  assert.equal(resolveObjectiveGroup({ objective: "OUTCOME_LEADS" }), "leads");
});

test("legacy pre-ODAX objectives keep mapping to the same groups", () => {
  assert.equal(resolveObjectiveGroup({ objective: "BRAND_AWARENESS" }), "awareness");
  assert.equal(resolveObjectiveGroup({ objective: "REACH" }), "awareness");
  assert.equal(resolveObjectiveGroup({ objective: "VIDEO_VIEWS" }), "awareness");
  assert.equal(resolveObjectiveGroup({ objective: "LEAD_GENERATION" }), "leads");
  assert.equal(resolveObjectiveGroup({ objective: "MESSAGES" }), "leads");
  assert.equal(resolveObjectiveGroup({ objective: "CONVERSIONS" }), "conversion");
  assert.equal(resolveObjectiveGroup({ objective: "CATALOG_SALES" }), "conversion");
  assert.equal(resolveObjectiveGroup({ objective: "APP_INSTALLS" }), "app_promotion");
});

test("traffic and engagement are their own groups, not awareness", () => {
  // The previous classifier folded these into awareness, which inflated the awareness
  // share of spend. They are distinct objective families and are reported as such.
  assert.equal(resolveObjectiveGroup({ objective: "OUTCOME_TRAFFIC" }), "traffic");
  assert.equal(resolveObjectiveGroup({ objective: "TRAFFIC" }), "traffic");
  assert.equal(resolveObjectiveGroup({ objective: "OUTCOME_ENGAGEMENT" }), "engagement");
  assert.equal(resolveObjectiveGroup({ objective: "POST_ENGAGEMENT" }), "engagement");
  assert.equal(resolveObjectiveGroup({ objective: "PAGE_LIKES" }), "engagement");
});

test("objective casing and surrounding whitespace do not change the group", () => {
  assert.equal(resolveObjectiveGroup({ objective: "  outcome_sales  " }), "conversion");
  assert.equal(resolveObjectiveGroup({ objective: "Outcome_Awareness" }), "awareness");
});

test("campaign names never decide the objective group", () => {
  // The old classifier ran name regexes: /^ba\d/, /awareness|reach/, /remarket|conv|
  // sales/, /lead|form|kontakt/. A name must no longer override or supply a group.
  assert.equal(
    resolveObjectiveGroup({ name: "BA1 - Brand awareness reach push", objective: "OUTCOME_SALES" }),
    "conversion"
  );
  assert.equal(
    resolveObjectiveGroup({ name: "Conv - 06 - FR remarketing sales", objective: "OUTCOME_AWARENESS" }),
    "awareness"
  );
  assert.equal(
    resolveObjectiveGroup({ name: "LEAD - 02 - Unboxing Guide - EU kontakt form", objective: "OUTCOME_SALES" }),
    "conversion"
  );
  // With no objective at all, a suggestive name still produces no guess.
  assert.equal(resolveObjectiveGroup({ name: "Jewelry Boxes | DE | Prospecting" }), "unclassified");
  assert.equal(resolveObjectiveGroup({ name: "Ribbon Upsell | UK | Remarketing" }), "unclassified");
  assert.equal(resolveObjectiveGroup({ name: "BA1 - awareness" }), "unclassified");
});

test("downstream metrics never decide the objective group", () => {
  // "It recorded purchases, so it is a conversion campaign" is an inference the source
  // system never asserted, so it must not classify.
  assert.equal(resolveObjectiveGroup({ purchases_value: 412, revenue_value: 90000 }), "unclassified");
  assert.equal(resolveObjectiveGroup({ leads_value: 37 }), "unclassified");
  assert.equal(
    resolveObjectiveGroup({ objective: "OUTCOME_AWARENESS", purchases_value: 412 }),
    "awareness"
  );
});

test("unknown and missing objectives land in unclassified, never in awareness", () => {
  // The old classifier ended in `return "awareness"`, hiding unmapped spend inside a
  // real category that the user reads budget shares off.
  assert.equal(resolveObjectiveGroup({ objective: "OUTCOME_SOMETHING_NEW" }), "unclassified");
  assert.equal(resolveObjectiveGroup({ objective: "" }), "unclassified");
  assert.equal(resolveObjectiveGroup({}), "unclassified");
  assert.equal(resolveObjectiveGroup(null), "unclassified");
});

test("an explicit category on the campaign is honoured, but only if it is a real group", () => {
  assert.equal(resolveObjectiveGroup({ category: "conversion", objective: "OUTCOME_AWARENESS" }), "conversion");
  assert.equal(resolveObjectiveGroup({ objective_group: "leads" }), "leads");
  assert.equal(resolveObjectiveGroup({ lens: "traffic" }), "traffic");
  // A junk category falls through to the objective rather than being trusted.
  assert.equal(resolveObjectiveGroup({ category: "made-up", objective: "OUTCOME_SALES" }), "conversion");
});

test("classifyCampaign is the objective group", () => {
  assert.equal(classifyCampaign({ objective: "OUTCOME_SALES" }), "conversion");
  assert.equal(classifyCampaign({}), "unclassified");
});

test("splitByCategory buckets every campaign exactly once and loses none", () => {
  const campaigns = [
    { id: "1", objective: "OUTCOME_AWARENESS" },
    { id: "2", objective: "OUTCOME_SALES" },
    { id: "3", objective: "OUTCOME_SALES" },
    { id: "4", objective: "OUTCOME_LEADS" },
    { id: "5", objective: "OUTCOME_TRAFFIC" },
    { id: "6", objective: "WHO_KNOWS" },
    { id: "7" }
  ];

  const buckets = splitByCategory(campaigns);

  // Every group key exists so consumers can read buckets.awareness et al. unguarded.
  for (const group of OBJECTIVE_GROUP_ORDER) {
    assert.ok(Array.isArray(buckets[group]), `missing bucket for ${group}`);
  }

  assert.equal(buckets.awareness.length, 1);
  assert.equal(buckets.conversion.length, 2);
  assert.equal(buckets.leads.length, 1);
  assert.equal(buckets.traffic.length, 1);
  assert.equal(buckets.unclassified.length, 2);

  const bucketed = OBJECTIVE_GROUP_ORDER.reduce((sum, group) => sum + buckets[group].length, 0);
  assert.equal(bucketed, campaigns.length);

  const bucketedIds = OBJECTIVE_GROUP_ORDER
    .flatMap((group) => buckets[group].map((campaign) => campaign.id))
    .sort();
  assert.deepEqual(bucketedIds, ["1", "2", "3", "4", "5", "6", "7"]);
});

test("splitByCategory tolerates empty and missing input", () => {
  const empty = splitByCategory([]);
  assert.equal(OBJECTIVE_GROUP_ORDER.every((group) => empty[group].length === 0), true);
  assert.equal(splitByCategory(undefined).awareness.length, 0);
});

test("every group has a display label and a defined lens mapping", () => {
  for (const group of OBJECTIVE_GROUP_ORDER) {
    const label = resolveObjectiveGroupLabel(group);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `missing label for ${group}`);
  }

  assert.equal(resolveObjectiveGroupLabel("awareness"), "Brand Awareness");
  assert.equal(resolveObjectiveGroupLabel("unclassified"), "Unclassified");
  assert.equal(resolveObjectiveGroupLabel("not-a-group"), "Unclassified");

  // Only these three families have a drill-down lens; the rest appear in General only.
  assert.equal(resolveLensForObjectiveGroup("awareness"), "awareness");
  assert.equal(resolveLensForObjectiveGroup("leads"), "leads");
  assert.equal(resolveLensForObjectiveGroup("conversion"), "conversion");
  assert.equal(resolveLensForObjectiveGroup("traffic"), "");
  assert.equal(resolveLensForObjectiveGroup("unclassified"), "");
});
