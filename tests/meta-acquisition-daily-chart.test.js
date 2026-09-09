const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// New customers is the figure the marketing department is measured on. A count with a
// change badge cannot show whether acquisition is climbing or collapsing: two months that
// both end on 58 new customers look identical in a badge and completely different on a
// chart, one rising steadily and one dead after the first week.
//
// The daily rows this needs are already fetched for the period comparison, so the chart
// costs no extra Meta request. These tests build those rows directly.

const root = join(__dirname, "..");
const {
  buildCustomerAcquisitionWindows,
  resolveCustomerConversionActionTypes,
  windowDailySeries
} = require(join(root, "server", "meta", "customer-acquisition.js"));

const NEW_CONVERSION_ID = "111";
const EXISTING_CONVERSION_ID = "222";
const ACTION_TYPES = resolveCustomerConversionActionTypes([
  { id: NEW_CONVERSION_ID, name: "New_customer", is_archived: false },
  { id: EXISTING_CONVERSION_ID, name: "Existing_customer", is_archived: false }
]);

// The account reports in America/Los_Angeles, so windows are resolved there.
const TIME_ZONE = "America/Los_Angeles";
const NOW = new Date("2026-09-09T17:00:00.000Z"); // 10:00 in Los Angeles on the 9th

function row(date, newCustomers, existingCustomers = 0, spend = 1000) {
  return {
    date_start: date,
    spend: String(spend),
    actions: [
      { action_type: `offsite_conversion.custom.${NEW_CONVERSION_ID}`, value: String(newCustomers) },
      { action_type: `offsite_conversion.custom.${EXISTING_CONVERSION_ID}`, value: String(existingCustomers) },
      { action_type: "omni_purchase", value: String(newCustomers + existingCustomers) }
    ],
    action_values: [
      { action_type: `offsite_conversion.custom.${NEW_CONVERSION_ID}`, value: String(newCustomers * 1500) },
      { action_type: `offsite_conversion.custom.${EXISTING_CONVERSION_ID}`, value: String(existingCustomers * 2500) },
      { action_type: "omni_purchase", value: String(newCustomers * 1500 + existingCustomers * 2500) }
    ]
  };
}

// August climbs to a strong finish; September front-loads and dies. Both months reach the
// same total, which is the case a change badge cannot tell apart.
function buildRows() {
  const august = [1, 2, 3, 4, 5, 6, 7, 8].map((day, index) => row(`2026-08-0${day}`, index + 1));
  const september = [1, 2, 3, 4, 5, 6, 7, 8].map((day, index) => row(`2026-09-0${day}`, 8 - index));
  return [...august, ...september];
}

test("each period carries its own daily series for both windows", () => {
  const windows = buildCustomerAcquisitionWindows({
    dailyRows: buildRows(),
    actionTypes: ACTION_TYPES,
    now: NOW,
    timeZone: TIME_ZONE,
    currency: "DKK",
    formatCurrency: (value) => `DKK ${Number(value).toFixed(2)}`
  });

  const monthToDate = windows.presets.find((preset) => preset.key === "month_to_date");
  assert.ok(monthToDate, "the month-to-date preset is gone");

  assert.ok(Array.isArray(monthToDate.current.dailyNewCustomers), "the current window has no series");
  assert.ok(Array.isArray(monthToDate.previous.dailyNewCustomers), "the previous window has no series");

  // Every point must fall inside the window it belongs to, or the chart would draw days
  // from one month against the axis of another.
  for (const [side, window] of [["current", monthToDate.current], ["previous", monthToDate.previous]]) {
    for (const point of window.dailyNewCustomers) {
      assert.ok(
        point.date >= window.since && point.date <= window.until,
        `${side} series carries ${point.date}, outside ${window.since}..${window.until}`
      );
    }
  }

  // The series has to reconcile with the total printed beside it.
  const seriesTotal = monthToDate.current.dailyNewCustomers.reduce((sum, point) => sum + point.value, 0);
  assert.equal(seriesTotal, monthToDate.current.newCustomers, "the chart and the headline disagree");
});

test("two periods with the same total still have different shapes", () => {
  // This is the whole reason the chart exists.
  const windows = buildCustomerAcquisitionWindows({
    dailyRows: buildRows(),
    actionTypes: ACTION_TYPES,
    now: NOW,
    timeZone: TIME_ZONE,
    currency: "DKK",
    formatCurrency: (value) => `DKK ${Number(value).toFixed(2)}`
  });
  const monthToDate = windows.presets.find((preset) => preset.key === "month_to_date");

  const current = monthToDate.current.dailyNewCustomers.map((point) => point.value);
  const previous = monthToDate.previous.dailyNewCustomers.map((point) => point.value);

  assert.equal(
    current.reduce((a, b) => a + b, 0),
    previous.reduce((a, b) => a + b, 0),
    "the fixture is meant to give both windows the same total"
  );
  assert.notDeepEqual(current, previous, "and different day-by-day shapes");
  assert.ok(current[0] > current[current.length - 1], "September should be falling away");
  assert.ok(previous[0] < previous[previous.length - 1], "August should be building");
});

test("a day Meta reported nothing for is absent, not a zero", () => {
  // The sparkline aligns by day within the window, so a gap must stay a gap. Writing a
  // zero would claim Meta said there were no new customers that day, which is a different
  // statement from Meta not having reported the day at all.
  const rows = [row("2026-09-01", 4), row("2026-09-03", 6)];
  const series = windowDailySeries(rows, { since: "2026-09-01", until: "2026-09-05" }, ACTION_TYPES);

  assert.deepEqual(series.map((point) => point.date), ["2026-09-01", "2026-09-03"]);
  assert.deepEqual(series.map((point) => point.value), [4, 6]);
});

test("the series is sorted, whatever order Meta returned the rows in", () => {
  const rows = [row("2026-09-05", 1), row("2026-09-01", 2), row("2026-09-03", 3)];
  const series = windowDailySeries(rows, { since: "2026-09-01", until: "2026-09-30" }, ACTION_TYPES);
  assert.deepEqual(series.map((point) => point.date), ["2026-09-01", "2026-09-03", "2026-09-05"]);
});

test("an account without the conversion is gated by availability, not by its zeros", () => {
  // With no New_customer conversion resolved, every day reads zero. Those zeros are
  // meaningless rather than a result, which is why the whole panel keys off `available`
  // and shows the setup gap instead. This pins that the gate is what protects the
  // reader, because the series itself cannot tell the difference.
  const none = resolveCustomerConversionActionTypes([]);
  const series = windowDailySeries(buildRows(), { since: "2026-09-01", until: "2026-09-30" }, none);

  assert.deepEqual(series.map((point) => point.value), [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(none.available, false, "the panel must know it cannot count new customers at all");

  const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
  assert.match(ui, /if \(!model\.available\) \{/, "the panel no longer gates on availability");
});

test("the panel draws the chart from the period it is showing", () => {
  const ui = readFileSync(join(root, "src", "ui.js"), "utf8");

  assert.match(ui, /function renderAcquisitionDailyChart\(preset\)/);
  // It must read the resolved preset, not the model's default window, or the chart would
  // stay on month-to-date while the figures beside it moved to another period.
  assert.match(ui, /\$\{renderAcquisitionDailyChart\(active\)\}/);
  assert.match(ui, /preset\.current\?\.dailyNewCustomers/);
  assert.match(ui, /preset\.previous\?\.dailyNewCustomers/);
  // The previous window goes in as the comparison series so the overlay is day-aligned.
  assert.match(ui, /buildSparkline\(current, "acq-new", previous\)/);
});

test("the chart is legible on the panel's dark surface", () => {
  // The shared sparkline colours are drawn for a light card. The acquisition panel is
  // dark navy, and this is exactly the mistake that shipped once before on this panel:
  // light-surface ink copied onto a dark background, invisible and passing every test.
  const css = readFileSync(join(root, "styles.css"), "utf8");

  for (const selector of [
    ".meta-acq-chart .trend-spark .line",
    ".meta-acq-chart .trend-spark .comparison-line",
    ".meta-acq-chart .trend-spark .axis"
  ]) {
    assert.ok(css.includes(selector), `${selector} has no dark-surface override`);
  }
  assert.match(css, /\.meta-acq-chart \{/);
  assert.match(css, /\.meta-acq-chart-legend \{/);
});

test("the new-customer panel comes before the budget panel on General", () => {
  // It is the figure the department is measured on, so it is the first thing on the page.
  const html = readFileSync(join(root, "index.html"), "utf8");
  const acquisitionAt = html.indexOf('id="overview-acquisition"');
  const budgetAt = html.indexOf('id="overview-spend-split"');

  assert.notEqual(acquisitionAt, -1, "the acquisition panel is gone");
  assert.notEqual(budgetAt, -1, "the budget panel is gone");
  assert.ok(acquisitionAt < budgetAt, "the budget panel is being shown first again");
});
