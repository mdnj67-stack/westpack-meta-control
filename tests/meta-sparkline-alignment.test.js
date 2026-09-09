const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

// The trend cards draw the previous period as an overlay on the current one, and label it
// "Previous period overlay", which invites the reader to compare the two lines point for
// point. Each line used to be spread across the full width by its own array length, and
// Meta omits days with no delivery, so a previous window with five rows and a current
// window with twenty-nine were stretched to the same width. Day 3 of one then sat above
// day 17 of the other.
//
// src/ui.js is an ES module and the repo has no package.json, so the function is lifted
// out of the file and evaluated rather than imported, the way the stack-width test does.

const root = join(__dirname, "..");
const uiSource = readFileSync(join(root, "src", "ui.js"), "utf8");

function loadBuildSparkline() {
  const start = uiSource.indexOf("function buildSparkline(");
  assert.notEqual(start, -1, "buildSparkline is gone");
  const end = uiSource.indexOf("\nfunction escapeHtml(", start);
  assert.notEqual(end, -1, "could not find the end of buildSparkline");

  const context = {
    escapeHtml: (value = "") => String(value)
  };
  vm.createContext(context);
  vm.runInContext(`${uiSource.slice(start, end)}\nthis.buildSparkline = buildSparkline;`, context);
  return context.buildSparkline;
}

const buildSparkline = loadBuildSparkline();

function xCoordinates(pathAttribute) {
  return [...pathAttribute.matchAll(/[ML](-?\d+(?:\.\d+)?),/g)].map((match) => Number(match[1]));
}

function pathFor(svg, className) {
  const match = svg.match(new RegExp(`<path class="${className}" d="([^"]+)"`));
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

  const svg = buildSparkline(current, "conversion", previous);
  const currentX = xCoordinates(pathFor(svg, "line"));
  const previousX = xCoordinates(pathFor(svg, "comparison-line"));

  assert.equal(currentX.length, 7);
  assert.equal(previousX.length, 3);

  // Day one of each window starts at the same place.
  assert.equal(currentX[0], 0);
  assert.equal(previousX[0], 0);

  // The previous window's three points fall on days 0, 3 and 6, so they must land on the
  // same x as the current window's days 0, 3 and 6 rather than being spread to the edge.
  assert.equal(previousX[1], currentX[3]);
  assert.equal(previousX[2], currentX[6]);

  // Placing by array position would have spread three points evenly across the card, so
  // the middle one would sit at half width regardless of which day it belonged to. Here
  // day 3 of a 6-day span genuinely is half way, so the check that matters is the gap
  // between the first two points: even spacing would give 110, day-based gives 110 only
  // because it is the same day. Use a window where the two disagree instead.
  const unevenPrevious = [day("2026-08-25", 5), day("2026-08-26", 5), day("2026-08-31", 5)];
  const unevenSvg = buildSparkline(current, "conversion", unevenPrevious);
  const unevenX = xCoordinates(pathFor(unevenSvg, "comparison-line"));
  assert.equal(unevenX[1], currentX[1], "day 2 of the previous window belongs above day 2 of the current one");
  assert.notEqual(unevenX[1], 110, "even spacing by array position would have put it at half width");
});

test("a window longer than the other sets the shared scale", () => {
  const current = [day("2026-09-01", 1), day("2026-09-02", 1)];
  const previous = [day("2026-08-01", 1), day("2026-08-11", 1)];

  const svg = buildSparkline(current, "conversion", previous);
  const currentX = xCoordinates(pathFor(svg, "line"));
  const previousX = xCoordinates(pathFor(svg, "comparison-line"));

  // The previous window spans ten days, the current two, so the current line must occupy
  // only the first fifth of the width rather than being blown up to fill it.
  assert.equal(previousX[1], 220);
  assert.equal(currentX[1], 22);
});

test("points with unusable dates fall back to their position rather than collapsing", () => {
  const series = [day("", 3), day("", 6), day("", 9)];
  const svg = buildSparkline(series, "conversion", []);
  const xs = xCoordinates(pathFor(svg, "line"));

  assert.equal(xs.length, 3);
  assert.equal(xs[0], 0);
  assert.ok(xs[2] > xs[1] && xs[1] > xs[0], "the line must still advance across the card");
});

test("an empty pair still renders an axis instead of throwing", () => {
  const svg = buildSparkline([], "conversion", []);
  assert.match(svg, /No trend data/);
  assert.match(svg, /<line class="axis"/);
});
