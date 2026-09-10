const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// The incremental split was decided by a hand-typed campaign name, because the account
// did not appear to report the setting. It does: Ads Manager shows an "Attribution
// setting" column, and Meta returns it on the campaign's insights row.
//
// This matters because the name already misfiled all three incremental campaigns once,
// on a single vowel, with 216,000 DKK of monthly budget attached. The standing rule for
// this dashboard is that a category comes from the source system wherever the source
// system has one.
//
// Every value below was observed on the live Westpack account on 2026-09-10.

const root = join(__dirname, "..");
const {
  resolveReportedAttribution,
  classifyConversionAttribution
} = require(join(root, "api", "meta", "account-snapshot.js")).__internals;

test("Meta's own answer decides, whichever way it points", () => {
  assert.deepEqual(
    resolveReportedAttribution({ attribution_setting: "incrementality" }),
    { mode: "incremental", source: "Meta attribution setting", explicit: true }
  );

  for (const window of ["1d_view_7d_click_1d_ev", "1d_view_7d_click", "1d_view_28d_click", "7d_click"]) {
    assert.deepEqual(
      resolveReportedAttribution({ attribution_setting: window }),
      { mode: "standard", source: "Meta attribution setting", explicit: true },
      `${window} is a named conversion window and means standard attribution`
    );
  }
});

test("the machine values are matched, not the wording Ads Manager prints", () => {
  // Meta answers "1d_view_7d_click_1d_ev", not "7-day click, 1-day view". Underscores are
  // word characters, so a \bclick\b pattern finds nothing inside 7d_click_1d_ev - which
  // is exactly how the first version of this let every standard campaign fall through to
  // the name tag.
  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  const fn = handler.slice(
    handler.indexOf("function resolveReportedAttribution"),
    handler.indexOf("function resolveConversionAttribution")
  );
  assert.ok(!/\\bclick\\b|\\bview\\b|\\bday\\b/.test(fn), "the word-boundary pattern is back and cannot match Meta's format");
  assert.match(fn, /\\d\+d_\(view\|click\|ev\)/);
});

test("Meta outranks the campaign name", () => {
  // A name that says one thing and a setting that says another is exactly the case the
  // name tag cannot be trusted for.
  assert.equal(
    classifyConversionAttribution({ attribution_setting: "incrementality", name: "Conv - 04 - EU - Standard" }),
    "incremental",
    "the reported setting must win over a Standard tag in the name"
  );
  assert.equal(
    classifyConversionAttribution({ attribution_setting: "1d_view_7d_click", name: "Conv - 01 - DE - Inkremental" }),
    "standard",
    "and over an Inkremental tag in the name"
  );
});

test("the name tag still catches what Meta does not report", () => {
  // Not a fallback to be embarrassed about: the team maintains the register deliberately,
  // and an account or a period where Meta returns no setting must not silently reclassify
  // a campaign they have tagged.
  assert.equal(resolveReportedAttribution({ attribution_setting: "" }), null);
  assert.equal(resolveReportedAttribution({}), null);
  assert.equal(resolveReportedAttribution(null), null);

  assert.equal(
    classifyConversionAttribution({ attribution_setting: "", name: "Conv - 01 - DE - Inkremental" }),
    "incremental"
  );
  assert.equal(
    classifyConversionAttribution({ attribution_setting: "", name: "Conv - 05 - DE" }),
    "standard"
  );
});

test("'multiple' is not read as standard", () => {
  // It means this campaign's ad sets disagree with each other, which is an answer to a
  // different question. Reading it as standard would quietly file a campaign whose ad
  // sets are partly on incremental attribution.
  assert.equal(resolveReportedAttribution({ attribution_setting: "multiple" }), null);

  // So the name decides instead, in whichever direction it points.
  assert.equal(
    classifyConversionAttribution({ attribution_setting: "multiple", name: "Conv - 09 - Inkremental" }),
    "incremental"
  );
  assert.equal(
    classifyConversionAttribution({ attribution_setting: "multiple", name: "Konvertering - Alle lande" }),
    "standard"
  );
});

test("an unfamiliar value falls through rather than denying the tag", () => {
  // Meta has changed this vocabulary before. A wording nobody has seen yet must not be
  // read as "not incremental" and quietly move a tagged campaign into the other lens.
  assert.equal(resolveReportedAttribution({ attribution_setting: "some future wording" }), null);
  assert.equal(
    classifyConversionAttribution({ attribution_setting: "some future wording", name: "Conv - 02 - FR - Inkremental" }),
    "incremental"
  );
});

test("asking for the setting must not drag in every campaign that ever existed", () => {
  // An attribution setting is configuration, so Meta returns a row for every campaign on
  // the account whether or not it delivered. Adding the field took the snapshot from 15
  // campaigns to 358, of which 343 had no spend, no impressions, no clicks and no
  // actions, and every lens table filled with campaigns that spent nothing in the range.
  const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");
  const filter = handler.slice(
    handler.indexOf("const aggregatedInsightsResponse = {"),
    handler.indexOf("const incrementalInsightsAvailable")
  );
  assert.ok(filter.length > 0, "the empty-row filter is gone");

  for (const signal of ["spend", "impressions", "inline_link_clicks", "actions"]) {
    assert.ok(filter.includes(signal), `the filter does not consider ${signal}`);
  }

  // Reproduce it, rather than trusting that it reads correctly.
  const keep = (row) => Number(row?.spend || 0) > 0
    || Number(row?.impressions || 0) > 0
    || Number(row?.inline_link_clicks || 0) > 0
    || (Array.isArray(row?.actions) && row.actions.length > 0);

  assert.equal(keep({ spend: "1876.4", impressions: "38064", attribution_setting: "incrementality" }), true);
  assert.equal(keep({ impressions: "12", spend: "0" }), true, "delivery without billed spend is still delivery");
  assert.equal(keep({ actions: [{ action_type: "omni_purchase", value: "1" }] }), true, "a late-attributed action counts");
  assert.equal(keep({ spend: "0", impressions: "0", attribution_setting: "1d_view_7d_click" }), false, "a bare configuration echo does not");
  assert.equal(keep({}), false);
});
