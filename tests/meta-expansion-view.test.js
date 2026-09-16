const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// The Expansion surfaces are rendered from src/ui.js, which is ESM in a repo
// with no package.json, so Node cannot import it here. These are pattern tests
// over the source, in the same style as the rest of the UI-adjacent suite: they
// pin the rules that were broken before, not the behaviour.
//
// The rules, all of them mistakes this panel actually made:
//
//  1. A part month is never set against a complete month.
//  2. The panel says it ignores the dashboard's date range, because it does.
//  3. The snapshot's age is stated and goes to a warning when it is stale.
//  4. Country reach is never summed into a total.
//  5. A market with no baseline gets a label, not a percentage.
//  6. A rising cost is never coloured as good news.

const root = join(__dirname, "..");
const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const styles = readFileSync(join(root, "styles.css"), "utf8");

test("the part month is compared like for like, never against a whole month", () => {
  // The old copy read "sep, against 309.186 in aug" with September covering 15
  // days and August 31. The comparison now comes from the server's like-for-like
  // window and names the elapsed days.
  assert.match(ui, /likeForLike\.elapsedDays/);
  assert.match(ui, /over the same \$\{likeForLike\.elapsedDays\} days of/);

  // And when no baseline was measured, it says so rather than reaching for the
  // previous month's complete figure.
  assert.match(ui, /No like-for-like baseline was measured/);
});

test("the panel states that it does not follow the date picker", () => {
  assert.match(ui, /does not follow the date picker/i);
  assert.match(ui, /does not follow the date range/i);
});

test("the snapshot age is shown, and a stale snapshot is called out", () => {
  assert.match(ui, /const EXPANSION_STALE_HOURS = \d+/);
  assert.match(ui, /function describeSnapshotAge/);
  assert.match(ui, /The nightly sync has not landed/);
  // The warning needs a colour of its own, or it is just more grey text.
  assert.match(styles, /\.meta-expansion-freshness\.is-stale/);
  assert.match(styles, /\.meta-expansion-freshness \.is-warn/);
});

test("the market breakdown never replaces the deduplicated account figure", () => {
  assert.match(ui, /must not be added together/i);
  assert.match(ui, /reached in more than one country/i);
  assert.match(ui, /The account figure is the one that speaks for the whole set/);
});

test("a market with no baseline is labelled new rather than given a percentage", () => {
  assert.match(ui, /is-new-market/);
  assert.match(ui, /if \(!comparable\) return `<span class="meta-expansion-badge is-new-market">\$\{emptyLabel\}/);
  assert.match(styles, /\.meta-expansion-badge\.is-new-market/);
});

test("a rising cost per thousand is not coloured as an improvement", () => {
  assert.match(ui, /function expansionChangeBadge\(change, comparable, suffix = "", invert = false, emptyLabel = "New"\)/);
  assert.match(ui, /const good = invert \? value < 0 : value > 0;/);
  assert.match(ui, /expansionChangeBadge\(customerCostChange, true, "", true\)/);
});

test("the month in progress is hatched and labelled with its day range", () => {
  assert.match(ui, /function expansionDayRange/);
  assert.match(ui, /month\.partial \? expansionDayRange\(month\) : expansionMonthName\(month\.month\)/);
  assert.match(styles, /\.meta-expansion-bar\.is-partial \.meta-expansion-column em/);
});

test("the Expansion tab exists and is wired to its own lens", () => {
  assert.match(html, /data-dashboard-lens="expansion"/);
  assert.match(html, /id="expansion-view"/);
  assert.match(html, /id="expansion-content"/);
  assert.match(app, /const expansionVisible = lens === "expansion";/);
  assert.match(ui, /export function renderExpansionView/);
});

test("the Expansion tab does not inherit the range-driven not-synced banner", () => {
  // The banner is about a payload this view never reads. Showing it above a full
  // set of figures was the contradiction that started this work.
  assert.match(app, /const emptyStateCopy = expansionVisible\s*\n\s*\? null/);
  // And the hero panel, which does read the range, is empty on this tab.
  assert.match(app, /renderHeroPanel\(expansionVisible\s*\n\s*\? \[\]/);
});

test("every expansion render is guarded like the rest of the dashboard", () => {
  assert.match(app, /renderPanelSafely\("Expansion Surfaces"/);
  assert.match(app, /renderPanelSafely\("Expansion View"/);
  assert.match(app, /renderPanelSafely\("Overview Expansion Reach"/);
});

test("the view survives a snapshot stored before the market split", () => {
  // A day count and a country breakdown are both new fields. The nightly job
  // fills them in, but the page must stay honest in between.
  assert.match(ui, /function expansionRowDays/);
  assert.match(ui, /The stored snapshot carries no country breakdown yet/);
});

test("a value the server could not measure is never rendered as a zero", () => {
  // Number(null) is 0 and 0 is finite, so the old guard turned "not measured"
  // into a measured zero: January printed a cost per new customer of 0,00 kr.
  // against no new customers at all.
  assert.match(ui, /function expansionMeasured\(value\)/);
  assert.match(ui, /if \(value === null \|\| value === undefined \|\| value === ""\) return false;/);

  // And nothing in the expansion renderers may go back to the raw finite check.
  const expansionSource = ui.slice(ui.indexOf("function expansionMeasured"), ui.indexOf("export function renderOverviewSpendSplit"));
  const rawChecks = expansionSource
    .split("\n")
    .filter((line) => line.includes("Number.isFinite(Number("))
    .filter((line) => !line.includes("Number(change)"))
    // The helper itself is where the finite check belongs.
    .filter((line) => !line.includes("return Number.isFinite(Number(value));"));
  assert.deepEqual(rawChecks, [], "these still treat an unmeasurable value as zero");
});

test("a market that went dark and came back is not labelled new", () => {
  // Italy, France and Germany delivered from January, ran nothing from May to
  // August, and returned in September. With no baseline in the comparison
  // window they were labelled "New", which contradicted the first-delivery date
  // printed in the same row.
  assert.match(ui, /const emptyLabel = likeForLike && row\.firstMonth && row\.firstMonth < likeForLike\.month/);
  assert.match(ui, /\? "Resumed"/);
});

test("the tab carries no method or provenance panel", () => {
  // A "how this is measured" block - anchor, campaign set, timezone, Graph call
  // counts, a standing caveat list - was built to make the view defensible and
  // was noise on the operator's screen. Provenance lives in the code and in
  // CLAUDE.md; only the caveats that change how a number is read stay, inline
  // with that number.
  assert.doesNotMatch(ui, /How this is measured/);
  assert.doesNotMatch(ui, /meta-expansion-method/);
  assert.doesNotMatch(ui, /The campaigns behind it/i);
  assert.doesNotMatch(ui, /Everything needed to argue with the numbers above/);

  // The two rules that do change a reading are still on screen, each next to
  // what it qualifies.
  assert.match(ui, /not a measured uplift/);
  assert.match(ui, /not a cohort of the people newly reached/i);
  assert.match(ui, /must not be added together/i);
});

test("the restatement log renders only when something was restated", () => {
  // "No completed month has changed since the previous run" is furniture. The
  // same log appearing only when a figure moved is the useful half.
  assert.match(ui, /function renderExpansionRestatements\(model\)/);
  assert.match(ui, /if \(!restatements\.length\) return "";/);
  assert.doesNotMatch(ui, /No completed month has changed since the previous run/);
});

test("the data quality panel does not follow onto the Expansion tab", () => {
  // It describes the live snapshot - freshness, pagination, validation - which
  // this tab never reads. It also sits outside the playbook, so hiding the
  // playbook does not reach it.
  assert.match(app, /renderMetaQualityPanel\(expansionVisible \? \[\] : buildMetaQualityCards\(\)\)/);
});

test("every column in both tables explains itself on hover", () => {
  // The headers carry definitions that change how a figure is read - which
  // window it covers, whether it may be added up, that the customer count is a
  // floor. A header alone cannot say that, and a paragraph above the table is
  // the panel that was removed for being noise.
  assert.match(ui, /function expansionHeadRow\(columns\)/);
  assert.match(ui, /data-tip="\$\{escapeHtml\(tip\)\}"/);

  // No bare header is left in either table.
  const tables = ui.slice(ui.indexOf("function expansionHeadCell"), ui.indexOf("function renderExpansionRestatements"));
  const bareHeaders = tables
    .split("\n")
    .filter((line) => /<th[ >]/.test(line))
    // The helper itself is the one place a <th> is written out.
    .filter((line) => !line.includes("data-tip="));
  assert.deepEqual(bareHeaders, [], "these headers carry no explanation");

  // The two counts that are most often misread say so explicitly. Reach that
  // cannot be added up now lives on the ad table, where each row is one ad's
  // own deduplicated count inside one country.
  assert.match(ui, /Do not add the column up/);
  assert.match(ui, /floor rather than a total/);
});

test("the explanation is reachable without a mouse and cannot be clipped away", () => {
  // The table scrolls horizontally, so a bubble rising above the header row
  // would be cut off by that container, and one anchored left would leave it at
  // the right-hand edge.
  assert.match(ui, /tabindex="0"/);
  assert.match(styles, /\.meta-expansion-table th\.has-tip:focus::after/);
  assert.match(styles, /\.meta-expansion-table th\.has-tip\.tip-end::after/);
  assert.match(styles, /transform: translateX\(var\(--tip-shift, 0px\)\)/);
  assert.match(ui, /function bindExpansionTips\(root\)/);
  assert.match(styles, /top: calc\(100% \+ 6px\)/);
});

test("the explanation opens inwards, and is nudged back when it still falls out", () => {
  // Anchoring the bubble to the right because the figures are right-aligned
  // pushed it out of the scroll container from narrow columns near the left
  // edge - measured at 168px outside on "Days" and 84px on "Reached". The edge
  // it hangs from now follows the column's position in the row.
  assert.match(ui, /const half = columns\.length \/ 2;/);
  assert.match(ui, /index >= half \? "tip-end" : "tip-start"/);

  // Position alone cannot know how far a wide table has been scrolled, nor that
  // a phone is narrower than the bubble, so the rest is measured at runtime.
  assert.match(ui, /const overflowRight = left \+ width - \(bounds\.right - 8\);/);
  assert.match(ui, /th\.style\.setProperty\("--tip-shift"/);
  assert.match(ui, /bindExpansionTips\(node\);/);
});

test("new customers is shown as the count, compared over the same elapsed days", () => {
  // "New customers per 1,000 new" read as a conversion rate on the people newly
  // reached, which it is not: most of a month's customers were first reached in
  // an earlier month, and a person reached two days ago has had two days to buy.
  // September's 0,04 against August's 0,23 looked like a collapse and was mostly
  // the part month.
  assert.doesNotMatch(ui, /New customers per 1,000 new/);
  assert.match(ui, /<span>New customers<\/span>/);
  assert.match(ui, /latest\.newCustomers == null \? "--" : formatCompactNumber\(latest\.newCustomers\)/);

  // The comparison is the same elapsed days, and it is absent when there is no
  // baseline to divide by.
  assert.match(ui, /Against \$\{formatCompactNumber\(likeForLike\.newCustomers\)\} over the same \$\{likeForLike\.elapsedDays\} days/);
  assert.match(ui, /likeForLike\.comparison\.customersComparable/);
});

test("a market opens onto the ads that produced its value", () => {
  // A market total says Poland returned ten times what it cost. It cannot say
  // which ad did it, which is the only form of the answer anyone can act on.
  assert.match(ui, /function renderExpansionAdPanel\(model, code, label, currency\)/);
  assert.match(ui, /data-expansion-market="\$\{escapeHtml\(row\.code\)\}"/);
  assert.match(ui, /expansionTableState\.openMarket === code \? "" : code/);

  // Reachable without a mouse, since the row is the only way in.
  assert.match(ui, /root\.addEventListener\("keydown"/);
  assert.match(ui, /if \(event\.key !== "Enter" && event\.key !== " "\) return;/);

  // The creative itself, not just its name.
  assert.match(ui, /row\.thumbnailUrl/);
  assert.match(ui, /loading="lazy"/);
});

test("ad-level reach is named as a figure that cannot be added up", () => {
  // Each row is one ad's own deduplicated count inside one country. Summing the
  // column counts a person once per ad they saw.
  assert.match(ui, /key: "deliveredReach", label: "Reach"/);
  assert.match(ui, /Do not add the column up: one person who saw three of these ads counts in all three rows/);
  assert.match(ui, /is never added across the rows/);

  // And the attribution caveat sits with the revenue it qualifies.
  assert.match(ui, /not what the ad caused/);
});

test("the market table ranks on new customers, not on the price of reach", () => {
  // Westpack sells packaging to businesses - jewellery businesses at its core -
  // and these ad sets run broad: a country, ages 18-65, no detailed targeting at
  // all. A reach figure therefore counts strangers by design, and cost per
  // thousand reached would rank whichever market finds the cheapest of them.
  // Italy led that column at 57 kr. per thousand and produced no new customers.
  const columns = ui.slice(ui.indexOf("const EXPANSION_MARKET_COLUMNS"), ui.indexOf("function expansionMarketRows"));
  assert.ok(
    !columns.includes('key: "costPerThousandNewlyReached"'),
    "the market table still ranks on the price of reach"
  );
  for (const key of ["revenue", "roas", "cpm"]) {
    assert.ok(!columns.includes(`key: "${key}"`), `the market table still carries ${key}`);
  }

  // What it leads with instead, and in that order.
  const order = [...columns.matchAll(/key: "([a-zA-Z]+)"/g)].map((match) => match[1]);
  assert.equal(order[0], "label");
  assert.equal(order[1], "newCustomers", "new customers must be the first figure in the row");
  assert.equal(order[2], "costPerNewCustomer");
  assert.ok(
    order.indexOf("netNewReach") > order.indexOf("costPerNewCustomer"),
    "reach must sit after the customer figures, as a diagnostic"
  );

  // And it sorts on that figure by default, over a window wide enough to carry
  // it: a single part month leaves most markets on zero customers.
  assert.match(ui, /sortKey: "newCustomers"/);
  assert.match(ui, /window: "quarter"/);
});

test("reach is named on screen as a diagnostic rather than a goal", () => {
  // The whole premise correction: a rising reach bar is not progress when
  // almost everyone counted was never a possible customer.
  assert.match(ui, /A diagnostic, not a goal/);
  assert.match(ui, /never a possible customer/);
  assert.match(ui, /function renderExpansionCustomerCurve/);
});
