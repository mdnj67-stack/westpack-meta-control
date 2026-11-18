/**
 * Budget pilot: each morning it says whether a conversion campaign's last budget step still pays for itself, and
 * whether anything points to it stopping. It recommends; it never changes a budget. The user turns the dial in
 * Ads Manager.
 *
 * The user's rules (2026-11-18): a budget goes down when the numbers say so, never because a date says so, and the
 * judgement is holistic - price, attention, buyers and new customers together, not one metric.
 *
 * 1. Requirement. The last step, from the measured level below (B) to the current level (L), must buy at least
 *    (L - B) * 7 / breakEven extra new customers a week. Requirement = B's measured weekly new customers + that, on
 *    both measures: Meta's incremental figure and 7-day click.
 * 2. Outcome over the last 7 complete days: green (both at or over), amber (one under), red (both under).
 * 3. Pressure: leading signals, 0-2 points each - CPM (last 3 days against the same weekdays a week earlier), click
 *    rate, buyers per click and frequency (7 days against the 7 before), and the 3-day pace of new customers against
 *    the same days a week earlier.
 * 4. Verdict: decide() below. New customers decide; pressure decides how sure and how fast.
 *
 * Known limit: B was measured in its own weeks. When the season falls, B would have fallen too, so the requirement
 * is then stricter than the true marginal - the pilot steps down a little early in a falling season, never late.
 */

const DEFAULTS = Object.freeze({
  // kr per new customer that pays back: contribution at 50 % DB over 3.5 years (status 6/11/2026; 2.5 years = 2,170).
  breakEven: 2670,
  step: 2500,
  coolDownDays: 7,
  thinMargin: 0.1,
  roomMargin: 0.3,
  pressureForAmberDown: 3,
  pressureForGreenDown: 5,
  pressureForUp: 1,
  // Change at which a signal scores 1 and 2 points. Positive = a rise is bad, negative = a fall is bad.
  signals: Object.freeze({
    cpm: [0.1, 0.2],
    ctr: [-0.1, -0.2],
    buyers: [-0.15, -0.3],
    frequency: [0.15, 0.3],
    pace: [-0.25, -0.4]
  })
});

// Conv - 04 - EU - Standard. Each level is measured from the day after it started.
const EU_CAMPAIGN_ID = "52547986372452";
const EU_BUDGET_HISTORY = Object.freeze([
  { from: "2026-09-30", daily: 2500 },
  { from: "2026-10-13", daily: 3800 },
  { from: "2026-10-23", daily: 5000 },
  { from: "2026-11-06", daily: 10000 }
]);

const PURCHASE = "offsite_conversion.fb_pixel_purchase";

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
}
const ratio = (a, b) => (b > 0 ? a / b : NaN);
const change = (now, before) => (Number.isFinite(now) && Number.isFinite(before) && before > 0 ? now / before - 1 : NaN);

/** The active, non-archived New_customer conversions, as action types. */
function newCustomerActionTypes(customConversions) {
  return (customConversions || [])
    .filter((c) => !c.is_archived && String(c.name).toLowerCase().replace(/[^a-z]/g, "") === "newcustomer")
    .map((c) => `offsite_conversion.custom.${c.id}`);
}

/** One daily insights row (with 7d_click and incrementality windows) -> the figures the pilot reads. */
function normaliseDay(row, ncTypes) {
  const pick = (types, key) => (row.actions || []).filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a[key] || 0), 0);
  return {
    date: row.date_start,
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.inline_link_clicks || 0),
    nci: pick(ncTypes, "incrementality"),
    nc7: pick(ncTypes, "7d_click"),
    purchases: pick([PURCHASE], "7d_click")
  };
}

function sumDays(days, from, to) {
  const t = { spend: 0, impressions: 0, clicks: 0, nci: 0, nc7: 0, purchases: 0, days: 0 };
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    t.spend += d.spend;
    t.impressions += d.impressions;
    t.clicks += d.clicks;
    t.nci += d.nci;
    t.nc7 += d.nc7;
    t.purchases += d.purchases;
    t.days += 1;
  }
  t.cpm = ratio(t.spend, t.impressions) * 1000;
  t.ctr = ratio(t.clicks, t.impressions);
  t.buyersPerClick = ratio(t.purchases, t.clicks);
  return t;
}

function levelOn(history, date) {
  let level = null;
  for (const h of history) if (h.from <= date) level = h;
  return level;
}

/** Per-day new customers at each level, from the day after it started to the day before the next (or asOf). */
function measureLevels(history, days, asOf) {
  return history.map((h, i) => {
    const from = addDays(h.from, 1);
    const next = history[i + 1];
    const to = next ? addDays(next.from, -1) : asOf;
    const t = sumDays(days, from, to < asOf ? to : asOf);
    return { ...h, measuredFrom: from, measuredTo: to < asOf ? to : asOf, days: t.days, nciPerDay: ratio(t.nci, t.days), nc7PerDay: ratio(t.nc7, t.days), spendPerDay: ratio(t.spend, t.days) };
  });
}

/** What the current level must deliver a week: the measured level below it plus the step at break-even. */
function requirementFor(level, measured, config = DEFAULTS) {
  const below = measured.filter((m) => m.daily < level.daily && m.days >= 7).sort((a, b) => b.daily - a.daily)[0];
  if (!below) return null;
  const extraPerWeek = ((level.daily - below.daily) * 7) / config.breakEven;
  return {
    base: below,
    extraPerWeek,
    nci: below.nciPerDay * 7 + extraPerWeek,
    nc7: below.nc7PerDay * 7 + extraPerWeek
  };
}

function points(value, [one, two]) {
  if (!Number.isFinite(value)) return 0;
  if (one >= 0) return value >= two ? 2 : value >= one ? 1 : 0;
  return value <= two ? 2 : value <= one ? 1 : 0;
}

/**
 * @param {object} input
 * @param {Array} input.days normalised days (normaliseDay), any order
 * @param {Array} input.history budget levels [{from, daily}], ascending
 * @param {string} input.asOf last complete day in the account's time zone
 * @param {object} [input.reach] {current: {reach, impressions}, previous: {reach, impressions}} for the two 7-day windows
 */
function evaluate({ days, history, asOf, reach = null, config = DEFAULTS }) {
  const level = levelOn(history, asOf);
  const measured = measureLevels(history, days, asOf);
  const requirement = level ? requirementFor(level, measured, config) : null;
  const daysAtLevel = level ? daysBetween(level.from, asOf) : 0;

  const last7 = sumDays(days, addDays(asOf, -6), asOf);
  const prev7 = sumDays(days, addDays(asOf, -13), addDays(asOf, -7));
  const last3 = sumDays(days, addDays(asOf, -2), asOf);
  const prev3 = sumDays(days, addDays(asOf, -9), addDays(asOf, -7));

  const freqNow = reach?.current ? ratio(reach.current.impressions, reach.current.reach) : NaN;
  const freqBefore = reach?.previous ? ratio(reach.previous.impressions, reach.previous.reach) : NaN;
  // Pace: new customers in the last 3 days against the same weekdays a week earlier; the better of the two measures,
  // so a fall counts only when both fall.
  const paceChange = Math.max(change(last3.nci, prev3.nci), change(last3.nc7, prev3.nc7));

  const s = config.signals;
  const signals = {
    cpm: { now: last3.cpm, before: prev3.cpm, change: change(last3.cpm, prev3.cpm) },
    ctr: { now: last7.ctr, before: prev7.ctr, change: change(last7.ctr, prev7.ctr) },
    buyers: { now: last7.buyersPerClick, before: prev7.buyersPerClick, change: change(last7.buyersPerClick, prev7.buyersPerClick) },
    frequency: { now: freqNow, before: freqBefore, change: change(freqNow, freqBefore) },
    pace: { now: last3.nci + last3.nc7, before: prev3.nci + prev3.nc7, change: Number.isFinite(paceChange) ? paceChange : NaN }
  };
  for (const [k, v] of Object.entries(signals)) v.points = points(v.change, s[k]);
  const pressure = Object.values(signals).reduce((t, v) => t + v.points, 0);

  const result = { asOf, level, daysAtLevel, requirement, last7, prev7, last3, prev3, signals, pressure, measured };
  if (!level || !requirement) return { ...result, verdict: "no_base", outcome: null };

  const vsReq = (t, req) => ({ nci: ratio(t.nci, req.nci) - 1, nc7: ratio(t.nc7, req.nc7) - 1 });
  const margin = vsReq(last7, requirement);
  const under = (margin.nci < 0 ? 1 : 0) + (margin.nc7 < 0 ? 1 : 0);
  const outcome = under === 0 ? "green" : under === 1 ? "amber" : "red";
  const weakest = Math.min(margin.nci, margin.nc7);
  // The 3-day pace as a weekly rate, against the requirement.
  const pace = { nci: ratio(last3.nci * 7 / 3, requirement.nci), nc7: ratio(last3.nc7 * 7 / 3, requirement.nc7) };
  // Emergency: a collapse like 2025's week 47 (new customers -41 % on the same spend). Judged against the same weekdays
  // a week earlier, because a B2B weekend halves new customers and a 3-day window that holds one reads as a collapse
  // every Sunday. Both measures down 40 %+, both under the requirement's pace, and price or buyers confirming it.
  const emergency = daysAtLevel >= 4 && signals.pace.points === 2 && pace.nci < 1 && pace.nc7 < 1 && signals.cpm.points + signals.buyers.points >= 1;

  const prevAtLevel = addDays(asOf, -13) > level.from;
  const prevMargin = prevAtLevel ? vsReq(prev7, requirement) : null;
  const room = outcome === "green" && prevMargin && Math.min(margin.nci, margin.nc7, prevMargin.nci, prevMargin.nc7) >= config.roomMargin;

  let verdict;
  if (emergency) verdict = "down_now";
  else if (daysAtLevel < config.coolDownDays) verdict = "cooldown";
  else if (outcome === "red") verdict = "down";
  else if (outcome === "amber") verdict = pressure >= config.pressureForAmberDown ? "down" : "watch";
  else if (weakest < config.thinMargin && pressure >= config.pressureForGreenDown) verdict = "down";
  else if (room && pressure <= config.pressureForUp && daysAtLevel >= 14) verdict = "up_room";
  else if (weakest < config.thinMargin || pressure >= config.pressureForAmberDown) verdict = "watch";
  else verdict = "hold";

  const target = verdict === "down" || verdict === "down_now" ? Math.max(level.daily - config.step, 0) : verdict === "up_room" ? level.daily + config.step : level.daily;
  return { ...result, outcome, margin, weakest, pace, emergency, prevMargin, room: Boolean(room), verdict, target };
}

/**
 * Append the live budget when it differs from the last known level; its start is the first day of the latest run of
 * days whose spend sits closer to the live budget than to the last known one. A 25 % step is inside any fixed band
 * around a budget, so the band cannot tell the two levels apart.
 */
function withLiveBudget(history, liveDaily, days, asOf) {
  const last = history[history.length - 1];
  if (!Number.isFinite(liveDaily) || liveDaily <= 0 || (last && last.daily === liveDaily)) return history;
  const sorted = days.filter((d) => d.date <= asOf).sort((a, b) => (a.date < b.date ? 1 : -1));
  const atLive = (spend) => (last ? Math.abs(spend - liveDaily) < Math.abs(spend - last.daily) : spend >= 0.6 * liveDaily);
  let from = null;
  for (const d of sorted) {
    if (atLive(d.spend)) from = d.date;
    else break;
  }
  return [...history, { from: from || asOf, daily: liveDaily, detected: true }];
}

module.exports = {
  DEFAULTS,
  EU_CAMPAIGN_ID,
  EU_BUDGET_HISTORY,
  addDays,
  evaluate,
  measureLevels,
  newCustomerActionTypes,
  normaliseDay,
  requirementFor,
  sumDays,
  withLiveBudget
};
