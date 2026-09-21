const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Every time series in the product is drawn by timeSeriesChart in src/chart.js. Before
// it there were four hand-rolled SVG builders: three had no axis at all, none could be
// hovered, two placed points by array index so a skipped day was drawn as a normal step,
// and one drew a solid black area because its fill never resolved.
//
// These tests pin the parts of that system that are invisible until they are wrong.

const root = join(__dirname, "..");
const chart = readFileSync(join(root, "src", "chart.js"), "utf8");
const css = readFileSync(join(root, "design-system.css"), "utf8");
const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");
const handler = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");

test("every chart in the product comes from the shared builder", () => {
  // A second hand-rolled SVG chart is how the first four happened.
  for (const [name, source] of [["src/ui.js", ui], ["app.js", app]]) {
    const inlineCharts = [...source.matchAll(/<svg[^>]*viewBox/g)];
    assert.ok(
      inlineCharts.length === 0,
      `${name} builds ${inlineCharts.length} chart(s) by hand instead of calling timeSeriesChart`
    );
    assert.match(source, /timeSeriesChart\(/, `${name} no longer uses the shared chart builder`);
  }
});

test("points are placed by date, never by position in the array", () => {
  // Meta and the nightly Klaviyo job both skip periods with nothing to report. Spacing
  // readings evenly draws a three-day gap as a one-day step.
  assert.match(chart, /function dayNumber/);
  assert.match(chart, /dayNumber\(point\.date\)/, "the x position no longer reads the date");
  assert.equal(
    /const x = padding \+ \(\(width - padding \* 2\) \* index\)/.test(chart),
    false,
    "index-based spacing is back"
  );
});

test("a gap in the data breaks the line instead of interpolating across it", () => {
  assert.match(chart, /function toRuns/);
  assert.match(chart, /point\.gap > 1/, "runs are no longer split on a gap");
  // And the area under the line breaks with it, or the fill closes across the hole.
  assert.match(chart, /function areaOf/);
  assert.match(chart, /toRuns\(points\)[\s\S]{0,200}?filter\(\(run\) => run\.length > 1\)/);
});

test("a zero-baselined quantity never gets a negative axis", () => {
  // An all-zero leads series sent niceScale into its flat branch, which padded
  // symmetrically and labelled the floor "-1" - a count of people below nothing.
  assert.match(chart, /if \(useZero && scale\.min < 0\)/);
  assert.match(chart, /scale\.ticks = scale\.ticks\.filter\(\(tick\) => tick >= 0\)/);
});

test("the axis abbreviates and the tooltip does not", () => {
  assert.match(chart, /export function formatAxisValue/);
  assert.match(chart, /export function formatExactValue/);
  // The axis is where 12k belongs; the exact figure belongs in the tooltip.
  assert.match(chart, /return `\$\{trimZero\(number \/ 1000, 0\)\}k\$\{suffix\}`/);
  assert.match(chart, /if \(format === "currency"\) return formatMoney\(number, currency\)/);
});

test("ticks land on round numbers", () => {
  assert.match(chart, /export function niceScale/);
  assert.match(chart, /normalized > 5 \? 10 : normalized > 2\.5 \? 5/, "the nice-step ladder is gone");
});

test("the hover is one delegated listener and one tooltip", () => {
  // Per-chart handlers are what made tooltips flicker against each other.
  assert.match(chart, /export function attachChartHover/);
  assert.match(app, /attachChartHover\(\)/, "the hover layer is never attached");

  const listeners = [...chart.matchAll(/addEventListener\("(pointermove|mousemove)"/g)];
  assert.equal(listeners.length, 2, "the move handler is no longer a single delegated pair");

  // pointerleave and mouseleave do not bubble, so catching them in the capture phase
  // fires for every element boundary inside the chart and the tooltip vanishes mid-move.
  assert.equal(
    /addEventListener\("(pointerleave|mouseleave)", hide, true\)/.test(chart),
    false,
    "a capture-phase leave listener is back; it will hide the tooltip on every move"
  );
});

test("the tooltip carries the comparison, not just the value", () => {
  assert.match(chart, /wp-chart-tooltip-date/);
  assert.match(chart, /comparisonLabel \|\| "Previous period"/);
  assert.match(chart, /function changeBetween/);
  // Percent change divides by the real baseline, and a zero baseline has no percentage.
  assert.match(chart, /if \(!Number\.isFinite\(previous\) \|\| previous === 0\) return null/);
});

test("the tooltip is kept inside the window", () => {
  assert.match(chart, /window\.innerWidth - size\.width/, "the tooltip can be pushed off screen");
  assert.match(chart, /above > 8 \? above : y \+ 18/, "the tooltip no longer flips when it would clip the top");
});

test("the current period outweighs the comparison", () => {
  // The hierarchy is the whole point: if the previous period is as loud as the current
  // one, the card has two heroes and no answer.
  const line = css.match(/\.wp-chart-line \{([^}]*)\}/);
  const previous = css.match(/\.wp-chart-previous \{([^}]*)\}/);
  assert.ok(line && previous);
  assert.match(line[1], /stroke-width: 2/);
  assert.match(previous[1], /stroke-width: 1/);
  assert.match(previous[1], /stroke-dasharray/);
  assert.match(previous[1], /--wp-grey-400/, "the comparison line is no longer subdued");
});

test("the chart draws correctly without the legacy stylesheet", () => {
  // design-system.html loads no legacy sheet. Without a fallback the tone token does not
  // resolve, the fill is invalid, and CSS renders that as a solid black area under every
  // line - which is exactly what shipped for an afternoon.
  for (const tone of ["awareness", "leads", "conversion", "incremental", "traffic", "engagement"]) {
    const rule = new RegExp(`--wp-chart-ink-rgb: var\\(--tone-${tone}-rgb, \\d+ \\d+ \\d+\\)`);
    assert.match(css, rule, `the ${tone} chart tone has no fallback`);
  }
  // In a declaration, not in the comment that explains why it is not used.
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(declarations.includes("color-mix("), false, "color-mix is back; it resolved to nothing here");
});

test("the fallback tones match the real ones", () => {
  // A fallback that has drifted is worse than none: it only shows up on the one page
  // that does not load styles.css.
  const legacy = readFileSync(join(root, "styles.css"), "utf8");
  for (const tone of ["awareness", "leads", "conversion", "incremental", "traffic", "engagement"]) {
    const real = legacy.match(new RegExp(`--tone-${tone}-rgb:\\s*(\\d+ \\d+ \\d+);`));
    const fallback = css.match(new RegExp(`--wp-chart-ink-rgb: var\\(--tone-${tone}-rgb, (\\d+ \\d+ \\d+)\\)`));
    assert.ok(real && fallback, `no tone or fallback for ${tone}`);
    assert.equal(fallback[1], real[1], `the ${tone} chart fallback has drifted from the real token`);
  }
});

test("every trend card says how its numbers should be read", () => {
  // The axis and the tooltip both read this. Without an entry a card falls back to a
  // plain count, which would print kroner as a bare number.
  assert.match(handler, /const TREND_CARD_READING = Object\.freeze\(/);

  const table = handler.slice(handler.indexOf("const TREND_CARD_READING"));
  const known = new Set([...table.slice(0, table.indexOf("});")).matchAll(/"([^"]+)": \{/g)].map((m) => m[1]));

  // Every title the builder actually emits has to be in the table.
  const builder = handler.slice(handler.indexOf("function buildTrendCards"));
  const emitted = [...builder.slice(0, builder.indexOf("\nfunction ")).matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(emitted.length >= 10, `expected the trend card titles, found ${emitted.length}`);
  for (const title of new Set(emitted)) {
    assert.ok(known.has(title), `the trend card "${title}" has no reading in TREND_CARD_READING`);
  }
});

test("a rate's change is summed numerator over summed denominator", () => {
  // Adding up per-day rates gives the sum of the rates. This file already carries that
  // rule for the figures; the comparison badge has to obey it too.
  assert.match(handler, /aggregate: denominator > 0 \? numerator \/ denominator : null/);
  assert.match(handler, /currentTotal: current\.aggregate/);
});

test("a change against nothing is reported as new, not as a percentage", () => {
  assert.match(handler, /if \(previous === 0 && current > 0\)/);
  assert.match(handler, /direction: "new", value: "New"/);
});

test("a cost metric reads the right way round", () => {
  // Cheaper is better. Without this a rising cost per lead would show green.
  assert.match(handler, /"CPL trend": \{ format: "currency", baseline: "auto", goodWhen: "down" \}/);
  assert.match(handler, /"CPA trend": \{ format: "currency", baseline: "auto", goodWhen: "down" \}/);
  assert.match(handler, /direction === good \? "positive" : "negative"/);
});

test("the chart card leads with the figure, then the comparison, then the chart", () => {
  // The default branch, after the dual-trend and funnel kinds have had their turn -
  // those draw their own smaller charts and have no headline figure of their own.
  const body = ui.slice(ui.indexOf("function renderTrendCardBody"));
  const card = body.slice(body.lastIndexOf("wp-chart-card-head"), body.indexOf("\nexport function "));
  const valueAt = card.indexOf("wp-chart-card-value");
  const compareAt = card.indexOf("wp-chart-card-compare");
  const chartAt = card.indexOf("timeSeriesChart(");
  assert.ok(valueAt > -1 && compareAt > valueAt && chartAt > compareAt, "the card hierarchy has been reordered");
});
