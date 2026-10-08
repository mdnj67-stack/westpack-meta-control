const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// How much of each audience is used up, one row per ad set. The figures in these
// fixtures are the live account's on 2026-10-07, so the rules are pinned against
// the cases that shaped them.

const root = join(__dirname, "..");
const {
  PERIOD_DAYS,
  LOOKBACK_DAYS,
  buildAudienceSaturation,
  classifySaturation,
  describeAudience,
  describeMarket,
  resolveSaturationWindows,
  syncAudienceSaturation
} = require(join(root, "server", "meta", "audience-saturation.js"));

const NEW_TYPE = "offsite_conversion.custom.775766277988531";
const actionTypes = { newCustomerActionTypes: [NEW_TYPE], existingCustomerActionTypes: [], available: true };
const TODAY = "2026-10-07";
const windows = resolveSaturationWindows(TODAY);

// Six rows per ad set, one per range, as `time_ranges` returns them.
function rowsFor(id, { current, previous, campaign = "Conv - 02 - FR" }) {
  const make = (range, figures) => figures ? {
    adset_id: id,
    adset_name: id,
    campaign_name: campaign,
    date_start: range.since,
    date_stop: range.until,
    reach: String(figures.reach),
    impressions: String(figures.impressions ?? figures.reach * 2),
    spend: String(figures.spend ?? 0),
    actions: figures.newCustomers == null ? [] : [{ action_type: NEW_TYPE, value: String(figures.newCustomers) }]
  } : null;
  return [
    make(windows.current.period, current.period),
    make(windows.current.through, current.through),
    make(windows.current.before, current.before),
    make(windows.previous.period, previous?.period),
    make(windows.previous.through, previous?.through),
    make(windows.previous.before, previous?.before)
  ].filter(Boolean);
}

const broadConversion = (id, objective = "OUTCOME_SALES") => ({
  id,
  name: id,
  effective_status: "ACTIVE",
  campaign: { id: `c-${id}`, name: "Conv - 02 - FR", objective },
  targeting: { geo_locations: { countries: ["FR"] }, targeting_automation: { advantage_audience: 1 } }
});

const lookalike = (id, { expansion = false, country = "FR" } = {}) => ({
  id,
  name: id,
  effective_status: "ACTIVE",
  campaign: { id: `c-${id}`, name: "BA - Reach", objective: "OUTCOME_AWARENESS" },
  targeting: {
    geo_locations: { countries: [country] },
    custom_audiences: [{ id: "1", name: `Lookalike (${country}, 1%)` }],
    targeting_relaxation_types: { lookalike: expansion ? 1 : 0, custom_audience: 0 },
    targeting_automation: { advantage_audience: 0 }
  }
});

test("two equal periods end yesterday, each with the two cumulative ranges behind its new reach", () => {
  assert.equal(PERIOD_DAYS, 14);
  assert.equal(LOOKBACK_DAYS, 90);
  assert.deepEqual(windows.current.period, { since: "2026-09-23", until: "2026-10-06" });
  assert.deepEqual(windows.previous.period, { since: "2026-09-09", until: "2026-09-22" });
  assert.deepEqual(windows.current.through, { since: "2026-06-25", until: "2026-10-06" });
  assert.deepEqual(windows.current.before, { since: "2026-06-25", until: "2026-09-22" });
  assert.equal(windows.ranges.length, 6, "one insights call carries all six");
});

test("new reach is the rise in deduplicated reach, never a sum", () => {
  const snapshot = buildAudienceSaturation({
    today: TODAY,
    insightRows: rowsFor("a", {
      current: { period: { reach: 122397, spend: 15339, newCustomers: 1 }, through: { reach: 400000 }, before: { reach: 326850 } },
      previous: { period: { reach: 203000, spend: 13000 }, through: { reach: 203000 }, before: { reach: 0 } }
    }),
    adSetMeta: [broadConversion("a")],
    actionTypes
  });
  const row = snapshot.adSets[0];
  assert.equal(row.current.newReach, 73150);
  assert.equal(row.current.newShare, 0.5976);
  assert.equal(row.current.repeatReach, 122397 - 73150);
  assert.equal(row.current.weeklyFrequency, 1, "impressions per person over two weeks, halved");
});

test("the period after a launch is not read as saturation", () => {
  // Broad - FR after the 2026-09-09 rebuild: its first fortnight was everyone-new
  // by definition, so 60% in the second read as a 40-point fall. That alone put
  // ten ad sets in "saturating".
  const result = classifySaturation({
    current: { reach: 122397, spend: 15339, newShare: 0.6009, costPerThousandNew: 208.56, newCustomers: 1 },
    previous: { reach: 200000, spend: 13000, newShare: 1, costPerThousandNew: 76.35, reachBefore: 0 },
    objectiveGroup: "conversion",
    accountCostPerNewCustomer: 2233.58
  });
  assert.equal(result.status, "room");
  assert.ok(result.reasons.some((reason) => /launch/.test(reason)));

  // The same movement against an established period is saturation.
  const established = classifySaturation({
    current: { reach: 122397, spend: 15339, newShare: 0.38, costPerThousandNew: 208.56, newCustomers: 1 },
    previous: { reach: 200000, spend: 13000, newShare: 0.6, costPerThousandNew: 76.35, reachBefore: 50000 },
    objectiveGroup: "conversion",
    accountCostPerNewCustomer: 2233.58
  });
  assert.equal(established.status, "saturated");
});

test("a falling new share or a rising cost of new people against an established period is saturating", () => {
  // EU - Lead - 1: 68% new before, 48% now.
  const result = classifySaturation({
    current: { reach: 15216, spend: 2220, newShare: 0.4845, costPerThousandNew: 301.18 },
    previous: { reach: 20000, spend: 2400, newShare: 0.6784, costPerThousandNew: 277.91, reachBefore: 9000 },
    objectiveGroup: "leads"
  });
  assert.equal(result.status, "saturating");
  assert.ok(result.reasons.some((reason) => /fell 19 points on the 14 days before/.test(reason)));
});

test("a fixed audience reached 80% in one period is used up", () => {
  // LAL - EU, lookalike expansion off: 175,881 of an estimated ~207,000.
  const result = classifySaturation({
    current: { reach: 175881, spend: 4699, newShare: 0.5675, costPerThousandNew: 47.08 },
    previous: { reach: 150000, spend: 4000, newShare: 1, reachBefore: 0 },
    audienceShare: 0.8499,
    audienceShareApproximate: false,
    objectiveGroup: "awareness"
  });
  assert.equal(result.status, "saturated");
  assert.match(result.reasons[0], /Reached 85% of the audience/);
});

test("an audience Meta may go beyond is never read as used up, and spilling past it is said plainly", () => {
  // LAL - FR, lookalike expansion on: 795,966 people against an estimate of
  // ~280,000. That is delivery beyond the lookalike, not an exhausted one.
  const snapshot = buildAudienceSaturation({
    today: TODAY,
    insightRows: rowsFor("lal-fr", {
      campaign: "BA - Reach",
      current: { period: { reach: 795966, spend: 14843 }, through: { reach: 1600000 }, before: { reach: 1233000 } },
      previous: { period: { reach: 900000, spend: 9000 }, through: { reach: 900000 }, before: { reach: 0 } }
    }),
    adSetMeta: [lookalike("lal-fr", { expansion: true })],
    estimates: { "lal-fr": { estimate_mau_lower_bound: 260000, estimate_mau_upper_bound: 300000 } },
    actionTypes
  });
  const row = snapshot.adSets[0];
  assert.notEqual(row.status, "saturated");
  assert.equal(row.audience.shareApproximate, true);
  assert.equal(row.audience.beyondAudience, true);
  assert.ok(row.reasons.some((reason) => /2\.8x the audience estimate: lookalike expansion lets Meta go beyond it/.test(reason)));
  assert.equal(row.frequency.tone, "low", "awareness is judged against the 5-a-week target too");
});

test("a broad ad set gets no audience share, because its estimate is a population", () => {
  const snapshot = buildAudienceSaturation({
    today: TODAY,
    insightRows: rowsFor("broad", {
      current: { period: { reach: 100000, spend: 9000 }, through: { reach: 100000 }, before: { reach: 0 } }
    }),
    adSetMeta: [broadConversion("broad")],
    estimates: { broad: { estimate_mau_lower_bound: 40000000, estimate_mau_upper_bound: 47000000 } },
    actionTypes
  });
  const row = snapshot.adSets[0];
  assert.equal(row.audience.kind, "broad");
  assert.equal(row.audience.share, null);
  assert.equal(row.audience.size, null);
  assert.equal(row.audience.population, 43500000);
});

test("'does not convert' is measured against the account's own cost per new customer", () => {
  const base = {
    current: { reach: 186433, spend: 6000, newShare: 0.7, costPerThousandNew: 50, newCustomers: 0 },
    previous: { reach: 150000, spend: 6000, newShare: 0.75, costPerThousandNew: 48, reachBefore: 40000 },
    objectiveGroup: "conversion"
  };
  // Under three times the account's cost per new customer, a zero is noise.
  assert.equal(classifySaturation({ ...base, accountCostPerNewCustomer: 2233.58 }).status, "room");
  // Over it, it is evidence (a ~5% chance if the ad set performed like the account).
  const result = classifySaturation({ ...base, current: { ...base.current, spend: 7000 }, accountCostPerNewCustomer: 2233.58 });
  assert.equal(result.status, "not_converting");
  assert.ok(result.reasons.some((reason) => /reach is not the limit/.test(reason)));
  // Awareness is never judged on customers.
  assert.equal(classifySaturation({ ...base, current: { ...base.current, spend: 7000 }, objectiveGroup: "awareness", accountCostPerNewCustomer: 2233.58 }).status, "room");
});

test("too little delivery is set aside rather than judged", () => {
  const result = classifySaturation({
    current: { reach: 3729, spend: 259, newShare: 0.1368 },
    previous: { reach: 9000, spend: 900, newShare: 0.696, reachBefore: 5000 }
  });
  assert.equal(result.status, "insufficient");
});

test("markets group rows by spend only, and every delivering ad set is in exactly one", () => {
  const snapshot = buildAudienceSaturation({
    today: TODAY,
    insightRows: [
      ...rowsFor("a", { current: { period: { reach: 50000, spend: 9000 }, through: { reach: 50000 }, before: { reach: 0 } } }),
      ...rowsFor("b", { current: { period: { reach: 70000, spend: 6000 }, through: { reach: 70000 }, before: { reach: 0 } } })
    ],
    adSetMeta: [broadConversion("a"), lookalike("b", { country: "FR" })],
    actionTypes
  });
  assert.equal(snapshot.markets.length, 1);
  assert.equal(snapshot.markets[0].label, "France");
  assert.equal(snapshot.markets[0].spend, 15000);
  assert.ok(!("reach" in snapshot.markets[0]), "reach does not add up across ad sets");
  assert.deepEqual(snapshot.markets[0].adSetIds.slice().sort(), ["a", "b"]);
});

test("audience and market are read from the ad set's own targeting", () => {
  assert.equal(describeAudience({ geo_locations: { countries: ["DE"] }, targeting_automation: { advantage_audience: 1 } }).kind, "broad");
  const lal = describeAudience(lookalike("x", { expansion: true }).targeting);
  assert.equal(lal.kind, "defined");
  assert.equal(lal.expansionAllowed, true);
  assert.equal(describeAudience({ custom_audiences: [{ id: "1" }], targeting_optimization: "expansion_all" }).expansionAllowed, true);
  assert.equal(describeMarket({ geo_locations: { country_groups: ["europe"] } }).label, "Europe");
  assert.equal(describeMarket({ geo_locations: { countries: ["DE", "AT"] } }).key, "AT+DE");
});

test("the sync is one insights call for every range, and estimates only defined, active audiences", async () => {
  const meta = require(join(root, "server", "lib", "meta.js"));
  const original = meta.graphRequest;
  const calls = [];
  // expansion-reach captured graphRequest at require time, so the stub goes in
  // through the module cache before the saturation module is loaded fresh.
  delete require.cache[require.resolve(join(root, "server", "meta", "expansion-reach.js"))];
  delete require.cache[require.resolve(join(root, "server", "meta", "audience-saturation.js"))];
  meta.graphRequest = async (path, token, { params }) => {
    calls.push({ path, params });
    if (path.endsWith("/insights")) {
      return { data: [
        ...rowsFor("broad", { current: { period: { reach: 50000, spend: 9000 }, through: { reach: 50000 }, before: { reach: 0 } } }),
        ...rowsFor("lal", { current: { period: { reach: 70000, spend: 6000 }, through: { reach: 70000 }, before: { reach: 0 } } })
      ] };
    }
    if (path === "/") return { broad: broadConversion("broad"), lal: lookalike("lal") };
    if (path.endsWith("/delivery_estimate")) return { data: [{ estimate_mau_lower_bound: 100000, estimate_mau_upper_bound: 120000, estimate_ready: true }] };
    if (path.endsWith("/customconversions")) return { data: [{ id: "775766277988531", name: "New_customer" }] };
    throw new Error(`unexpected ${path}`);
  };
  try {
    const { syncAudienceSaturation: sync } = require(join(root, "server", "meta", "audience-saturation.js"));
    const snapshot = await sync({ accountId: "act_1", accessToken: "t", today: TODAY });
    const insights = calls.filter((call) => call.path.endsWith("/insights"));
    assert.equal(insights.length, 1);
    assert.equal(insights[0].params.level, "adset");
    assert.equal(JSON.parse(insights[0].params.time_ranges).length, 6);
    assert.equal(insights[0].params.action_attribution_windows, JSON.stringify(["incrementality"]));
    const estimates = calls.filter((call) => call.path.endsWith("/delivery_estimate"));
    assert.deepEqual(estimates.map((call) => call.path), ["/lal/delivery_estimate"], "no estimate for a broad ad set");
    assert.equal(snapshot.adSets.find((row) => row.id === "lal").audience.share, 0.6364);
  } finally {
    meta.graphRequest = original;
    delete require.cache[require.resolve(join(root, "server", "meta", "expansion-reach.js"))];
    delete require.cache[require.resolve(join(root, "server", "meta", "audience-saturation.js"))];
  }
  assert.equal(typeof syncAudienceSaturation, "function");
});

test("the table is read on the free status call and built by the nightly sync, on its own try", () => {
  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  assert.match(handler, /readAudienceSaturation\(\)\.catch\(\(\) => null\)/);
  assert.match(handler, /saturation: saturation \|\| null/);
  assert.match(handler, /await writeExpansionReach\(snapshot\);\s*const \{ saturation, saturationError \} = await runSaturationSync\(\);/);
  assert.match(handler, /String\(req\.query\?\.saturation \|\| ""\)\.toLowerCase\(\) === "sync"/);
});

test("the Expansion tab leads with the table, whatever state the series below it is in", () => {
  const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
  const app = readFileSync(join(root, "app.js"), "utf8");
  assert.match(ui, /export function renderExpansionView\(model = null, visible = false, currency = "DKK", errorMessage = "", saturation = null\)/);
  assert.match(ui, /host\.innerHTML = `\$\{saturationHtml\}\$\{html\}`;/);
  assert.match(ui, /<details class="saturation-thin">/, "thin delivery is folded away");
  assert.match(app, /appState\.metaAudienceSaturation = payload\?\.saturation \|\| null;/);
  assert.match(app, /metaExpansionReachError,\s*appState\.metaAudienceSaturation \|\| null/);
});
