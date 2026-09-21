const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

// The trend cards draw the previous period over the current one, which invites the reader
// to compare the two lines point for point. Each line used to be spread across the full
// width by its own array length, and Meta omits days with no delivery, so a previous
// window with five rows and a current window with twenty-nine were stretched to the same
// width. Day 3 of one then sat above day 17 of the other.
//
// The chart these cards use is src/chart.js now, so that is what this checks. It is an ES
// module and the repo has no package.json, so the source is lifted out and evaluated the
// way the stack-width test does.

const root = join(__dirname, "..");
const chartSource = readFileSync(join(root, "src", "chart.js"), "utf8");

function loadTimeSeriesChart() {
  // Everything except the import line and the hover layer, which needs a DOM.
  const start = chartSource.indexOf("const PLOT = 100;");
  assert.notEqual(start, -1, "src/chart.js no longer defines the plot box");
  const end = chartSource.indexOf("/* ---------------------------------------------------------------------------\n   Hover");
  assert.notEqual(end, -1, "could not find the end of the drawing half of src/chart.js");

  const context = {
    // The formatters come from src/format.js; the axis text is not what is under test.
    formatMoney: (value) => String(value),
    formatCount: (value) => String(value),
    formatDecimal: (value) => String(value),
    NUMBER_LOCALE: "da-DK",
    // Declared at the foot of the module, past the slice this harness takes.
    escapeHtml: (value = "") => String(value)
  };
  vm.createContext(context);
  vm.runInContext(
    `${chartSource.slice(start, end).replace(/^export /gm, "")}\nthis.timeSeriesChart = timeSeriesChart;`,
    context
  );
  return context.timeSeriesChart;
}

const timeSeriesChart = loadTimeSeriesChart();

function xCoordinates(pathAttribute) {
  return [...pathAttribute.matchAll(/[ML](-?\d+(?:\.\d+)?),/g)].map((match) => Number(match[1]));
}

function pathFor(html, className) {
  const match = html.match(new RegExp(`<path class="${className}" d="([^"]+)"`));
  return match ? match[1] : null;
}

function day(date, value) {
  return { date, value };
}

test("both lines are placed by day within their window, not by array position", () => {
  // A full current window against a previous window that only delivered on three days.
  const current = [
    day("2026-09-01", 10), day("2026-09-02", 10), day("2026-09-03", 10),
    day("2026-09-04", 10), day("2026-09-05", 10), day("2026-09-06", 10),
    day("2026-09-07", 10)
  ];
  const previous = [day("2026-08-25", 5), day("2026-08-28", 5), day("2026-08-31", 5)];

  const html = timeSeriesChart({ series: current, comparisonSeries: previous, tone: "conversion" });
  const currentX = xCoordinates(pathFor(html, "wp-chart-line"));
  const previousX = xCoordinates(pathFor(html, "wp-chart-previous"));

  assert.equal(currentX.length, 7);
  assert.equal(previousX.length, 3);

  // Day one of each window starts at the same place.
  assert.equal(currentX[0], 0);
  assert.equal(previousX[0], 0);

  // The previous window's three points fall on days 0, 3 and 6, so they land on the same
  // x as the current window's days 0, 3 and 6 rather than being spread to the edge.
  assert.equal(previousX[1], currentX[3]);
  assert.equal(previousX[2], currentX[6]);

  // Placing by array position would spread three points evenly across the card, so the
  // middle one would sit at half width whichever day it belonged to. This window is
  // chosen so the two answers disagree.
  const unevenPrevious = [day("2026-08-25", 5), day("2026-08-26", 5), day("2026-08-31", 5)];
  const unevenHtml = timeSeriesChart({ series: current, comparisonSeries: unevenPrevious, tone: "conversion" });
  const unevenX = xCoordinates(pathFor(unevenHtml, "wp-chart-previous"));
  assert.equal(unevenX[1], currentX[1], "day 2 of the previous window belongs above day 2 of the current one");
  assert.notEqual(unevenX[1], 50, "even spacing by array position would have put it at half width");
});

test("a window longer than the other sets the shared scale", () => {
  const current = [day("2026-09-01", 1), day("2026-09-02", 1)];
  const previous = [day("2026-08-01", 1), day("2026-08-11", 1)];

  const html = timeSeriesChart({ series: current, comparisonSeries: previous, tone: "conversion" });
  const currentX = xCoordinates(pathFor(html, "wp-chart-line"));
  const previousX = xCoordinates(pathFor(html, "wp-chart-previous"));

  // The previous window spans ten days, the current two, so the current line occupies
  // only the first fifth of the width rather than being blown up to fill it.
  assert.equal(previousX[1], 100);
  assert.equal(currentX[1], 10);
});

test("points with unusable dates keep their value rather than being dropped", () => {
  // A measured value with a broken date is still a measured value. It loses its place on
  // the time axis and falls back to its position, which is the wrong axis but not a lie
  // about what was measured.
  const html = timeSeriesChart({ series: [day("", 3), day("", 6), day("", 9)], tone: "conversion" });
  const xs = xCoordinates(pathFor(html, "wp-chart-line"));

  assert.equal(xs.length, 3, "a point with an unusable date was silently discarded");
  assert.equal(xs[0], 0);
  assert.ok(xs[2] > xs[1] && xs[1] > xs[0], "the line must still advance across the card");
});

test("an empty series renders an empty state rather than an invalid path", () => {
  const html = timeSeriesChart({ series: [], comparisonSeries: [], tone: "conversion" });
  assert.match(html, /wp-chart-empty/);
  assert.equal(/<path class="wp-chart-line"/.test(html), false, "an empty series still drew a line element");
});
