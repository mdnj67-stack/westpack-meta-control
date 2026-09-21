/**
 * The chart system.
 *
 * Every time series in this product is drawn by `timeSeriesChart` below, so a line on the
 * Meta dashboard and a line in the Klaviyo overview are the same object: same grid, same
 * axis, same comparison treatment, same hover, same number formatting. Before this there
 * were four hand-rolled SVG builders with four sets of geometry, three of which had no
 * axis at all and none of which could be hovered.
 *
 * How it is built, and why:
 *
 * - The plot is a 0..100 x 0..100 viewBox stretched with `preserveAspectRatio="none"`, so
 *   the chart fills whatever width the card gives it and every coordinate is already a
 *   percentage. Strokes carry `vector-effect="non-scaling-stroke"` so they stay the width
 *   they are declared at instead of smearing with the stretch.
 * - Axis labels and the hover marks are HTML, positioned with the same percentages. Text
 *   inside a non-uniformly stretched SVG distorts, and a `<circle>` becomes an ellipse.
 * - Every point is written into `data-chart` on the figure. The hover layer
 *   (attachChartHover) is one delegated listener and one tooltip element for the whole
 *   application, which is what makes the tooltip behave identically everywhere and stops
 *   it flickering between per-chart implementations.
 *
 * The numbers stay honest: the axis is generated from the data rather than rounded to
 * something tidy that happens to clip a peak, a day the source reported nothing breaks
 * the line instead of being interpolated through, and a flat series is drawn where it
 * actually sits rather than being pinned to the floor.
 */

import { formatMoney, formatCount, formatDecimal, NUMBER_LOCALE } from "./format.js?v=20260921-format1";

const PLOT = 100;

/* ---------------------------------------------------------------------------
   Numbers on an axis
--------------------------------------------------------------------------- */

/**
 * Axis labels are abbreviated, because "12.000" three times down the side of a chart is
 * three times the ink for the same information. The exact value is in the tooltip.
 */
export function formatAxisValue(value, { format = "count", currency = "DKK" } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";

  if (format === "percent") return `${trimZero(number, Math.abs(number) < 10 ? 1 : 0)}%`;
  if (format === "ratio") return trimZero(number, Math.abs(number) < 10 ? 2 : 1);

  const abs = Math.abs(number);
  // The account reports in DKK, but the suffix follows the currency rather than assuming
  // it: an axis labelled "12k kr." against euros would be a wrong number, not a typo.
  const suffix = format === "currency"
    ? (String(currency || "DKK").toUpperCase() === "DKK" ? " kr." : ` ${String(currency).toUpperCase()}`)
    : "";
  if (abs >= 1_000_000) return `${trimZero(number / 1_000_000, abs >= 10_000_000 ? 0 : 1)} mio.${suffix}`;
  if (abs >= 10_000) return `${trimZero(number / 1000, 0)}k${suffix}`;
  if (abs >= 1000) return `${trimZero(number / 1000, 1)}k${suffix}`;
  return `${trimZero(number, 0)}${suffix}`;
}

function trimZero(value, digits) {
  return Number(value)
    .toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** The exact value, for a tooltip. Never abbreviated. */
export function formatExactValue(value, { format = "count", currency = "DKK" } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (format === "currency") return formatMoney(number, currency);
  if (format === "percent") return `${formatDecimal(number, 2)}%`;
  if (format === "ratio") return formatDecimal(number, 2);
  return formatCount(number);
}

/* ---------------------------------------------------------------------------
   Axis scale

   Ticks land on 1, 2, 2.5 or 5 times a power of ten, so the reader gets 12k / 24k / 36k
   rather than 11.842 / 23.684 / 35.526.
--------------------------------------------------------------------------- */

export function niceScale(min, max, tickCount = 4) {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : 1;

  if (hi === lo) {
    // A flat series still needs a scale with height, or it divides by zero and the line
    // has nowhere to sit. It is centred on its own value.
    const pad = Math.abs(hi) > 0 ? Math.abs(hi) * 0.5 : 1;
    return { min: lo - pad, max: hi + pad, ticks: [lo - pad, lo, hi + pad] };
  }

  const rawStep = (hi - lo) / Math.max(1, tickCount);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized > 5 ? 10 : normalized > 2.5 ? 5 : normalized > 2 ? 2.5 : normalized > 1 ? 2 : 1) * magnitude;

  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  const ticks = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return { min: niceMin, max: niceMax, ticks };
}

/* ---------------------------------------------------------------------------
   Dates
--------------------------------------------------------------------------- */

const SHORT_DATE = new Intl.DateTimeFormat(NUMBER_LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const FULL_DATE = new Intl.DateTimeFormat(NUMBER_LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatChartDate(iso, { long = false } = {}) {
  const at = Date.parse(`${String(iso || "").slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(at)) return String(iso || "");
  return (long ? FULL_DATE : SHORT_DATE).format(new Date(at)).replace(/\.$/, "");
}

function dayNumber(iso) {
  const at = Date.parse(`${String(iso || "").slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(at) ? Math.round(at / 86400000) : null;
}

/* ---------------------------------------------------------------------------
   The chart
--------------------------------------------------------------------------- */

/**
 * A point is kept if it has a usable value. A missing or unparseable date costs it its
 * place on the time axis - it falls back to its position in the array - but it is not
 * dropped: silently discarding a measured value is a worse failure than drawing it in
 * roughly the right place.
 *
 * Sorting only happens when every point can be dated, or the dateless ones would all be
 * swept to the front.
 */
function normalizeSeries(series = []) {
  const points = (Array.isArray(series) ? series : [])
    .map((point) => ({
      date: String(point?.date || "").slice(0, 10),
      value: Number(point?.value)
    }))
    .filter((point) => Number.isFinite(point.value));

  return points.every((point) => dayNumber(point.date) !== null)
    ? points.sort((a, b) => a.date.localeCompare(b.date))
    : points;
}

/**
 * Both series are placed on one shared day axis, so day 3 of the current period sits
 * above day 3 of the previous one. Placing them by array index instead - which is what
 * three of the four old charts did - put day 3 above day 17 whenever the source omitted
 * days, while the card invited the reader to compare the two lines directly.
 */
function buildGeometry(series, comparison, { baseline }) {
  const current = normalizeSeries(series);
  const previous = normalizeSeries(comparison);
  if (!current.length && !previous.length) return null;

  const spanOf = (points) => {
    if (points.length < 2) return 0;
    return (dayNumber(points[points.length - 1].date) ?? 0) - (dayNumber(points[0].date) ?? 0);
  };
  const span = Math.max(spanOf(current), spanOf(previous), 1);

  const values = [...current, ...previous].map((point) => point.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  // Zero baseline for anything that is a quantity of something: a bar of spend starting
  // at 40.000 exaggerates every wobble. Ratios and levels get a fitted axis, because a
  // zero baseline flattens a ROAS of 5.4 against 5.6 into one straight line - and the
  // axis labels say which of the two the reader is looking at.
  const useZero = baseline === "zero" && dataMin >= 0;
  const scale = niceScale(useZero ? 0 : dataMin, dataMax, 3);
  // A zero-baselined quantity must not be given a negative axis. An all-zero series sent
  // niceScale into its flat branch, which padded symmetrically and labelled the floor of
  // a leads chart "-1" - a count of people that cannot go below nothing.
  if (useZero && scale.min < 0) {
    scale.min = 0;
    scale.ticks = scale.ticks.filter((tick) => tick >= 0);
    if (!scale.ticks.includes(0)) scale.ticks.unshift(0);
  }

  const project = (points) => {
    const dated = points.every((point) => dayNumber(point.date) !== null);
    const first = points.length ? dayNumber(points[0].date) : 0;
    const range = scale.max - scale.min || 1;

    return points.map((point, index) => {
      // Where a point cannot be dated the series falls back to even spacing by position.
      // It is the wrong axis, but it keeps a measured value on screen, which is better
      // than dropping it; every series the product actually feeds in is fully dated.
      const offset = points.length < 2
        ? 0.5
        : dated
          ? ((dayNumber(point.date) ?? first) - first) / span
          : index / (points.length - 1);

      return {
        x: offset * PLOT,
        y: PLOT - ((point.value - scale.min) / range) * PLOT,
        date: point.date,
        value: point.value,
        // Only a dated series can have a gap. Without dates, consecutive positions are
        // consecutive by definition, so the line must not be broken.
        gap: dated && index > 0 ? (dayNumber(point.date) ?? 0) - (dayNumber(points[index - 1].date) ?? 0) : 0
      };
    });
  };

  return { current: project(current), previous: project(previous), scale };
}

/** Runs of consecutive days. A gap is a gap, not a diagonal through invented values. */
function toRuns(points) {
  return points.reduce((runs, point) => {
    if (!runs.length || point.gap > 1) runs.push([point]);
    else runs[runs.length - 1].push(point);
    return runs;
  }, []);
}

function pathOf(points) {
  return toRuns(points)
    .map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "))
    .join(" ");
}

function areaOf(points) {
  return toRuns(points)
    .filter((run) => run.length > 1)
    .map((run) => {
      const line = run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
      return `${line} L${run[run.length - 1].x.toFixed(2)},${PLOT} L${run[0].x.toFixed(2)},${PLOT} Z`;
    })
    .join(" ");
}

/**
 * Three or four date labels, never one per point, and never two close enough to collide.
 *
 * Labels are taken at even positions along the array, but the x axis is measured in days
 * - so where the source skipped a week, two array-adjacent labels land on top of each
 * other. "20. aug24. aug" is what that looks like. A label is dropped if it would sit
 * within a label's width of the one before it.
 */
function xLabels(points) {
  if (points.length < 2) return points.map((p) => ({ x: p.x, label: formatChartDate(p.date) }));

  // Three labels, not four. These cards sit three to a row, so a plot is often around
  // 300px: four labels put "20. aug" and "24. aug" close enough to touch. Three at the
  // start, middle and end cannot collide at any width the layout produces.
  const MIN_GAP = 25; // percent of the plot, comfortably wider than "20. aug"
  const wanted = Math.min(3, points.length);
  const step = (points.length - 1) / (wanted - 1);
  const out = [];

  for (let i = 0; i < wanted; i += 1) {
    const point = points[Math.round(i * step)];
    if (!point) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(point.x - last.x) < MIN_GAP) continue;
    out.push({ x: point.x, label: formatChartDate(point.date) });
  }

  // The last reading is the one people look for, so it wins a collision with the label
  // before it rather than being the one dropped.
  const final = points[points.length - 1];
  const last = out[out.length - 1];
  if (last && final && last.x !== final.x) {
    if (Math.abs(final.x - last.x) < MIN_GAP) out.pop();
    out.push({ x: final.x, label: formatChartDate(final.date) });
  }
  return out;
}

/**
 * A time series, ready to drop into a card.
 *
 * `format` drives the axis and the tooltip: "currency" | "count" | "ratio" | "percent".
 * `baseline` is "zero" for quantities and "auto" for ratios and levels.
 */
export function timeSeriesChart({
  series = [],
  comparisonSeries = [],
  format = "count",
  currency = "DKK",
  tone = "default",
  baseline = "zero",
  height = 132,
  label = "",
  comparisonLabel = "Previous period",
  emptyMessage = "No data in this range"
} = {}) {
  const geometry = buildGeometry(series, comparisonSeries, { baseline });
  if (!geometry || !geometry.current.length) {
    return `<div class="wp-chart-empty" style="min-height:${height}px">${escapeHtml(emptyMessage)}</div>`;
  }

  const { current, previous, scale } = geometry;
  const hasComparison = previous.length > 1;
  const yAt = (value) => ((scale.max - value) / (scale.max - scale.min || 1)) * 100;

  // Only the points are needed for the hover, and only the fields it shows.
  const payload = {
    format,
    currency,
    label,
    comparisonLabel,
    points: current.map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), d: p.date, v: p.value })),
    previous: hasComparison
      ? previous.map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), d: p.date, v: p.value }))
      : []
  };

  return `
    <figure class="wp-chart tone-${escapeHtml(tone)}" data-chart="${escapeHtml(JSON.stringify(payload))}">
      <div class="wp-chart-plot" style="height:${height}px">
        <svg viewBox="0 0 ${PLOT} ${PLOT}" preserveAspectRatio="none" aria-hidden="true">
          ${scale.ticks.map((tick) => `<line class="wp-chart-grid" x1="0" x2="${PLOT}" y1="${yAt(tick).toFixed(2)}" y2="${yAt(tick).toFixed(2)}" vector-effect="non-scaling-stroke"></line>`).join("")}
          ${hasComparison ? `<path class="wp-chart-previous" d="${pathOf(previous)}" vector-effect="non-scaling-stroke"></path>` : ""}
          <path class="wp-chart-area" d="${areaOf(current)}"></path>
          <path class="wp-chart-line" d="${pathOf(current)}" vector-effect="non-scaling-stroke"></path>
        </svg>
        ${
          // A lone reading has no line to draw - a moveto with nothing after it renders
          // as an empty chart. It gets a dot, which is the honest picture of one reading.
          current.length === 1
            ? `<div class="wp-chart-point" style="left:${current[0].x.toFixed(2)}%;top:${current[0].y.toFixed(2)}%"></div>`
            : ""
        }
        <div class="wp-chart-cursor" hidden></div>
        <div class="wp-chart-marker" hidden></div>
        ${hasComparison ? `<div class="wp-chart-marker is-previous" hidden></div>` : ""}
        <div class="wp-chart-axis-y">
          ${scale.ticks.slice().reverse().map((tick) => `<span style="top:${yAt(tick).toFixed(2)}%">${escapeHtml(formatAxisValue(tick, { format, currency }))}</span>`).join("")}
        </div>
      </div>
      <figcaption class="wp-chart-axis-x">
        ${xLabels(current).map((entry) => `<span style="left:${entry.x.toFixed(2)}%">${escapeHtml(entry.label)}</span>`).join("")}
      </figcaption>
    </figure>
  `;
}

/* ---------------------------------------------------------------------------
   Hover

   One listener and one tooltip for every chart in the application. Per-chart handlers
   are what make tooltips flicker against each other and clip out of their card.
--------------------------------------------------------------------------- */

let tooltipNode = null;
let activeChart = null;

function tooltip() {
  if (tooltipNode) return tooltipNode;
  tooltipNode = document.createElement("div");
  tooltipNode.className = "wp-chart-tooltip";
  tooltipNode.hidden = true;
  document.body.appendChild(tooltipNode);
  return tooltipNode;
}

function nearest(points, ratio) {
  let best = points[0];
  let bestGap = Infinity;
  for (const point of points) {
    const gap = Math.abs(point.x / 100 - ratio);
    if (gap < bestGap) { bestGap = gap; best = point; }
  }
  return best;
}

function changeBetween(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function show(figure, event) {
  let payload;
  try { payload = JSON.parse(figure.dataset.chart || "{}"); } catch { return; }
  if (!payload.points?.length) return;

  const plot = figure.querySelector(".wp-chart-plot");
  if (!plot) return;
  const box = plot.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));

  const point = nearest(payload.points, ratio);
  const twin = payload.previous?.length ? nearest(payload.previous, point.x / 100) : null;
  const options = { format: payload.format, currency: payload.currency };
  const delta = twin ? changeBetween(point.v, twin.v) : null;

  const cursor = figure.querySelector(".wp-chart-cursor");
  const marker = figure.querySelector(".wp-chart-marker:not(.is-previous)");
  const twinMarker = figure.querySelector(".wp-chart-marker.is-previous");
  if (cursor) { cursor.style.left = `${point.x}%`; cursor.hidden = false; }
  if (marker) { marker.style.left = `${point.x}%`; marker.style.top = `${point.y}%`; marker.hidden = false; }
  if (twinMarker && twin) { twinMarker.style.left = `${twin.x}%`; twinMarker.style.top = `${twin.y}%`; twinMarker.hidden = false; }

  const node = tooltip();
  node.innerHTML = `
    <p class="wp-chart-tooltip-date">${escapeHtml(formatChartDate(point.d, { long: true }))}</p>
    <div class="wp-chart-tooltip-row">
      <span>${escapeHtml(payload.label || "Value")}</span>
      <strong>${escapeHtml(formatExactValue(point.v, options))}</strong>
    </div>
    ${twin ? `
      <div class="wp-chart-tooltip-row is-previous">
        <span>${escapeHtml(payload.comparisonLabel || "Previous period")}</span>
        <strong>${escapeHtml(formatExactValue(twin.v, options))}</strong>
      </div>
      ${delta === null ? "" : `
        <div class="wp-chart-tooltip-delta ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}">
          ${delta > 0 ? "&#8593;" : delta < 0 ? "&#8595;" : "&#8594;"} ${escapeHtml(formatDecimal(Math.abs(delta), 1))}%
        </div>`}
    ` : ""}
  `;
  node.hidden = false;

  // Positioned against the viewport and flipped near an edge, so it never leaves the
  // screen and never covers the point it is describing.
  const size = node.getBoundingClientRect();
  const x = box.left + (point.x / 100) * box.width;
  const y = box.top + (point.y / 100) * box.height;
  const left = Math.min(Math.max(8, x - size.width / 2), window.innerWidth - size.width - 8);
  const above = y - size.height - 14;
  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(above > 8 ? above : y + 18)}px`;

  activeChart = figure;
}

function hide() {
  if (tooltipNode) tooltipNode.hidden = true;
  if (activeChart) {
    activeChart.querySelectorAll(".wp-chart-cursor, .wp-chart-marker").forEach((node) => { node.hidden = true; });
    activeChart = null;
  }
}

let attached = false;

/** Called once at start-up. Charts rendered later are picked up by delegation. */
export function attachChartHover(root = document) {
  if (attached) return;
  attached = true;

  // Both mousemove and pointermove: a touch device sends pointer events without mouse
  // ones, and some automation and older input paths send the reverse. The handler is
  // idempotent, so receiving both costs a redundant read of the same position.
  const track = (event) => {
    const figure = event.target instanceof Element ? event.target.closest(".wp-chart") : null;
    if (!figure) { if (activeChart) hide(); return; }
    if (activeChart && activeChart !== figure) hide();
    show(figure, event);
  };

  root.addEventListener("pointermove", track, { passive: true });
  root.addEventListener("mousemove", track, { passive: true });

  // Deliberately no pointerleave/mouseleave listener on the document. Those do not
  // bubble, so catching them in the capture phase fires for every element boundary the
  // pointer crosses - including the ones inside the chart - and the tooltip flickered
  // out on every move. Moving off the chart already reaches `track` with no figure, and
  // that is what closes it.
  root.addEventListener("pointerdown", hide, true);
  document.documentElement.addEventListener("mouseleave", hide);
  window.addEventListener("scroll", hide, { passive: true, capture: true });
  window.addEventListener("resize", hide, { passive: true });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ---------------------------------------------------------------------------
   Sparkline

   The small sibling: a trend shape beside a figure, with no axis and nothing to read a
   value off. It is a genuinely different form from timeSeriesChart, not a smaller copy
   of one - which is why it lives here rather than being hand-rolled next to whichever
   card needed it first. Taking plain numbers keeps it usable where no date series
   exists, and it is decorative, so it is hidden from assistive technology: the figure it
   sits beside is the content.
--------------------------------------------------------------------------- */

export function sparkline(values = [], { tone = "default", height = 42, emptyMessage = "No trend yet" } = {}) {
  const points = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  if (!points.length) return `<span class="wp-spark-empty-note">${escapeHtml(emptyMessage)}</span>`;

  const width = 160;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const flat = max - min === 0;
  const range = Math.max(max - min, 1);
  const mid = height / 2;

  // One reading has no shape, and a flat series is drawn where it sits rather than on
  // the floor: a run of sevens and a run of zeros are not the same reading.
  const at = (value, index) => ({
    x: points.length === 1 ? width / 2 : pad + ((width - pad * 2) * index) / (points.length - 1),
    y: flat ? mid : height - pad - (((value - min) / range) * (height - pad * 2))
  });

  if (points.length === 1) {
    const only = at(points[0], 0);
    return `
      <svg class="wp-spark tone-${escapeHtml(tone)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <line class="wp-spark-line" x1="${(only.x - 14).toFixed(2)}" x2="${(only.x + 14).toFixed(2)}" y1="${only.y.toFixed(2)}" y2="${only.y.toFixed(2)}" vector-effect="non-scaling-stroke"></line>
      </svg>
    `;
  }

  const path = points
    .map((value, index) => {
      const point = at(value, index);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg class="wp-spark tone-${escapeHtml(tone)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path class="wp-spark-line" d="${path}" vector-effect="non-scaling-stroke"></path>
    </svg>
  `;
}
