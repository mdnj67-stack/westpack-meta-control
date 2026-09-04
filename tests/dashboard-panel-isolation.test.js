const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Both dashboard outages on 2026-09-04 were one ReferenceError apiece - "objectiveLabels
// is not defined" in an objective label, "buildCustomerAcquisitionTrend is not a function"
// in a trend badge. Neither figure mattered. Each aborted renderDashboard partway, so
// spend, revenue, ROAS, purchases and every remaining panel never rendered and the page
// read zeros.
//
// This pins the isolation that now stands between one bad panel and a blank dashboard.

const root = join(__dirname, "..");
const app = readFileSync(join(root, "app.js"), "utf8");

function renderDashboardBody() {
  const lines = app.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("function renderDashboard()"));
  assert.notEqual(start, -1, "renderDashboard is gone");
  let end = start;
  while (end < lines.length && lines[end] !== "}") end += 1;
  return lines.slice(start, end + 1);
}

test("every top-level render call inside renderDashboard is guarded", () => {
  // A single unguarded call is enough to reinstate the old failure mode, because it can
  // throw before the calls after it run.
  const body = renderDashboardBody();
  const unguarded = body
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^ {2}render[A-Z]\w*\(/.test(line) && !line.includes("renderPanelSafely"));

  assert.deepEqual(
    unguarded.map(({ line }) => line.trim()),
    [],
    "these render calls can still abort the whole dashboard"
  );

  // And there must actually be guarded calls - an empty function would pass the above.
  const guarded = body.filter((line) => line.includes("renderPanelSafely(")).length;
  assert.ok(guarded >= 15, `expected the panels to be guarded, found ${guarded} guards`);
});

test("the analysis phase and the hero copy are guarded too", () => {
  // The objectiveLabels error was in the analysis phase, before any renderer ran. Guarding
  // only the render calls would not have contained it.
  const body = renderDashboardBody().join("\n");
  assert.match(body, /renderPanelSafely\("Analysis", \(\) => \{/);
  assert.match(body, /renderPanelSafely\("Hero copy", \(\) => \{/);
  // On failure the analysis must fall back to a usable shape, not stay undefined.
  assert.match(body, /let analysis = emptyDashboardAnalysis\(\);/);
});

test("renderPanelSafely catches, records and keeps going", () => {
  // Executed, not just read: a helper that looks right but rethrows would leave the
  // dashboard exactly as fragile as before.
  const source = app.slice(app.indexOf("const dashboardPanelFailures = []"));
  const helper = source.slice(0, source.indexOf("function reportDashboardPanelFailures"));

  const sandbox = { console: { error() {} } };
  // eslint-disable-next-line no-new-func
  const build = new Function("console", `${helper}; return { renderPanelSafely, dashboardPanelFailures, emptyDashboardAnalysis };`);
  const { renderPanelSafely, dashboardPanelFailures, emptyDashboardAnalysis } = build(sandbox.console);

  const order = [];
  assert.equal(renderPanelSafely("First", () => { order.push("first"); }), true);
  assert.equal(renderPanelSafely("Broken", () => { throw new ReferenceError("objectiveLabels is not defined"); }), false);
  assert.equal(renderPanelSafely("Third", () => { order.push("third"); }), true);

  // The panel after the failure still ran. That is the whole point.
  assert.deepEqual(order, ["first", "third"]);
  assert.equal(dashboardPanelFailures.length, 1);
  assert.equal(dashboardPanelFailures[0].label, "Broken");
  assert.match(dashboardPanelFailures[0].message, /objectiveLabels is not defined/);

  // A thrown non-Error must not produce "undefined" as the message.
  renderPanelSafely("Odd", () => { throw "just a string"; });
  assert.equal(dashboardPanelFailures[1].message, "just a string");

  // The fallback analysis must have every shape the renderers read.
  const empty = emptyDashboardAnalysis();
  for (const key of ["executiveBrief", "pressureGroups", "cards", "pulseRows", "signals", "tableCampaigns"]) {
    assert.ok(key in empty, `the fallback analysis is missing ${key}`);
  }
  for (const key of ["pressureGroups", "cards", "pulseRows", "signals", "tableCampaigns"]) {
    assert.ok(Array.isArray(empty[key]), `${key} must be an array so .slice and .map are safe`);
  }
});

test("failures are reported without clobbering a clean status line", () => {
  // The status line is where the data layer reports mode, currency and cache state. On a
  // clean render the panel reporter must leave it alone, or every refresh would wipe it.
  const start = app.indexOf("function reportDashboardPanelFailures");
  const body = app.slice(start, app.indexOf("\n}", start));
  assert.match(body, /if \(!dashboardPanelFailures\.length\) \{[\s\S]*?return;/);
  // And when something did fail, it says so and points at the console.
  assert.match(body, /setSyncStatus\(/);
  assert.match(body, /failed to render/);
  assert.match(body, /rest of the dashboard is unaffected/);
});

test("the failure list is cleared at the start of each render", () => {
  // Otherwise a transient failure would be reported forever.
  const body = renderDashboardBody().join("\n");
  assert.match(body, /^function renderDashboard\(\) \{\n  dashboardPanelFailures\.length = 0;/);
});
