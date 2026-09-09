const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// The marketing team tags its incremental campaigns in the campaign name and maintains
// that register deliberately, so the name is the right source. It is also typed by hand.
//
// On 2026-09-09 the account was rebuilt and the three new incremental campaigns were
// spelled "Inkremental" where the previous set said "Inkrementel". The matcher looked for
// the exact words "inkrementel" and "incremental", so one vowel put all three in the
// standard lens - taking 216,000 DKK of monthly budget with them - while the dashboard
// reported "validation ok, 5 passes, 0 failures".
//
// These are the real campaign names from before and after that rebuild.

const root = join(__dirname, "..");
const { buildQualityWarnings } = require(join(root, "api", "meta", "account-snapshot.js")).__internals;

function loadNameTagMatchers(file) {
  const source = readFileSync(join(root, file), "utf8");
  const start = source.indexOf("function hasIncrementalNameTag(");
  assert.notEqual(start, -1, `hasIncrementalNameTag is gone from ${file}`);
  const end = source.indexOf("function resolveAttributionNameTag(", start);
  assert.notEqual(end, -1, `could not find the end of the matchers in ${file}`);

  // eslint-disable-next-line no-new-func
  return new Function(`${source.slice(start, end)}; return { hasIncrementalNameTag, hasStandardNameTag };`)();
}

const AFTER_REBUILD = [
  "Conv - 01 - DE - Inkremental",
  "Conv - 02 - FR - Inkremental",
  "Conv - 03 - IT - Inkremental"
];

const BEFORE_REBUILD = [
  "Conv - 01 - Smykkekunde - Inkrementel",
  "Conv - 02 - Giftpackaging - Inkrementel",
  "Conv - 03 - Forsendelse - Inkrementel"
];

const NOT_INCREMENTAL = [
  "Conv - 04 - EU - Standard",
  "Conv - 04 - IT",
  "Conv - 05 - DE",
  "Conv - 06 - FR",
  "BA - LAL",
  "BA-02 - Giftpackaging",
  "AW26 - Kick-off - Lead",
  "Kick-off Placeholder (opbevaring af klargjorte ads)"
];

for (const file of ["api/meta/account-snapshot.js", "app.js"]) {
  test(`${file} recognises both spellings the team has used`, () => {
    const { hasIncrementalNameTag } = loadNameTagMatchers(file);

    for (const name of [...AFTER_REBUILD, ...BEFORE_REBUILD]) {
      assert.equal(hasIncrementalNameTag(name), true, `${name} is not being recognised as incremental`);
    }
    for (const name of NOT_INCREMENTAL) {
      assert.equal(hasIncrementalNameTag(name), false, `${name} is being treated as incremental`);
    }
  });
}

test("the two copies of the matcher agree, name for name", () => {
  // One copy runs on the server and one in the browser. A fix applied to only one of them
  // means the lens a campaign lands in depends on which code path drew the panel.
  const server = loadNameTagMatchers("api/meta/account-snapshot.js");
  const client = loadNameTagMatchers("app.js");

  for (const name of [...AFTER_REBUILD, ...BEFORE_REBUILD, ...NOT_INCREMENTAL, "Campaign [INC]", "inkrementelle tests", "incrementality holdout"]) {
    assert.equal(
      server.hasIncrementalNameTag(name),
      client.hasIncrementalNameTag(name),
      `the two matchers disagree about "${name}"`
    );
    assert.equal(
      server.hasStandardNameTag(name),
      client.hasStandardNameTag(name),
      `the two standard matchers disagree about "${name}"`
    );
  }
});

test("the stem covers endings nobody has typed yet", () => {
  // The point of matching a stem rather than a list is not needing another edit the next
  // time someone writes it slightly differently.
  const { hasIncrementalNameTag } = loadNameTagMatchers("api/meta/account-snapshot.js");

  for (const name of [
    "Conv - Inkrementel",
    "Conv - Inkremental",
    "Conv - inkrementelle",
    "Conv - Incremental",
    "Conv - incrementality holdout",
    "Conv [INC] DE"
  ]) {
    assert.equal(hasIncrementalNameTag(name), true, `${name} should carry the tag`);
  }

  // And it must stay specific enough not to catch ordinary words.
  for (const name of ["Conv - Increase reach", "Conv - Instrument test", "Conv - Kremer"]) {
    assert.equal(hasIncrementalNameTag(name), false, `${name} must not be read as incremental`);
  }
});

test("a conversion campaign with no tag is named in a warning, not quietly filed", () => {
  // This is what let the rebuild through in silence: an unrecognised name fell into the
  // standard bucket with `explicit: false` and nothing on screen said so. The team tags
  // both sides now, so an untagged conversion campaign is a real signal.
  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 15,
    campaignsWithPeriodDataCount: 15,
    conversionCampaignCount: 11,
    incrementalNamedCount: 3,
    campaignSpendTotal: 151470,
    budgetAllocation: null,
    untaggedConversionCampaigns: [
      { name: "Conv - 04 - IT" },
      { name: "Conv - 05 - DE" }
    ]
  });

  const untagged = warnings.find((warning) => /neither an incremental nor a standard tag/.test(warning));
  assert.ok(untagged, `no warning about untagged campaigns among: ${JSON.stringify(warnings)}`);
  assert.match(untagged, /Conv - 04 - IT/, "the warning must name the campaign");
  assert.match(untagged, /Conv - 05 - DE/);
  assert.match(untagged, /counted as standard/, "and say what is being assumed");
});

test("the untagged warning stays quiet when every campaign is tagged", () => {
  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 15,
    campaignsWithPeriodDataCount: 15,
    conversionCampaignCount: 4,
    incrementalNamedCount: 3,
    campaignSpendTotal: 151470,
    budgetAllocation: null,
    untaggedConversionCampaigns: []
  });

  assert.ok(!warnings.some((warning) => /neither an incremental nor a standard tag/.test(warning)));
});

test("a long list of untagged campaigns is capped rather than dumped", () => {
  const warnings = buildQualityWarnings({
    budgetNormalization: { divisor: 100, currency: "DKK" },
    includedCampaignCount: 20,
    campaignsWithPeriodDataCount: 20,
    conversionCampaignCount: 12,
    incrementalNamedCount: 1,
    campaignSpendTotal: 151470,
    budgetAllocation: null,
    untaggedConversionCampaigns: Array.from({ length: 7 }, (unused, index) => ({ name: `Conv - ${index}` }))
  });

  const untagged = warnings.find((warning) => /neither an incremental nor a standard tag/.test(warning));
  assert.ok(untagged);
  assert.match(untagged, /and 3 more/, "the remainder must be counted rather than listed");
  assert.match(untagged, /^7 conversion campaigns/, "and the total stated up front");
});
