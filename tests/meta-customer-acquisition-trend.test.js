const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCustomerAcquisitionTrend,
  resolveCustomerConversionActionTypes,
  resolveMonthToDateWindows
} = require("../server/meta/customer-acquisition");

const NEW_TYPE = "offsite_conversion.custom.775766277988531";
const EXISTING_TYPE = "offsite_conversion.custom.573537871687880";
const actionTypes = resolveCustomerConversionActionTypes([
  { id: "775766277988531", name: "New_customer" },
  { id: "573537871687880", name: "Existing_customer" }
]);
const formatCurrency = (value, currency) => `${currency} ${Math.round(Number(value) || 0)}`;

// The account is on America/Los_Angeles, so "today" for Meta is not the user's today.
const TZ = "America/Los_Angeles";

function day(date, newCustomers, existingCustomers = 0, revenue = 0) {
  return {
    date_start: date,
    actions: [
      { action_type: NEW_TYPE, value: String(newCustomers) },
      { action_type: EXISTING_TYPE, value: String(existingCustomers) }
    ],
    action_values: [{ action_type: NEW_TYPE, value: String(revenue) }]
  };
}

test("both months are compared over the same completed days, excluding today", () => {
  // On the 4th the comparison runs 1-3 September against 1-3 August. Today is left out
  // because it is still running while the matching day last month is complete. On the
  // real account that mattered a lot: including today read as +26% where completed days
  // alone read as +71%, from the same data.
  const windows = resolveMonthToDateWindows(new Date("2026-09-04T18:00:00Z"), TZ);

  assert.equal(windows.comparable, true);
  assert.equal(windows.current.since, "2026-09-01");
  assert.equal(windows.current.until, "2026-09-03");
  assert.equal(windows.current.days, 3);
  assert.equal(windows.previous.since, "2026-08-01");
  assert.equal(windows.previous.until, "2026-08-03");
  assert.equal(windows.previous.days, 3);
  assert.equal(windows.current.days, windows.previous.days);

  // Today is still identified, so it can be reported on its own.
  assert.equal(windows.today.date, "2026-09-04");
  // One fetch has to cover both windows plus today.
  assert.equal(windows.fetch.since, "2026-08-01");
  assert.equal(windows.fetch.until, "2026-09-04");
  assert.equal(windows.clamped, false);
});

test("boundaries are resolved in the ad account timezone, not UTC", () => {
  // 1 September 02:00 UTC is still 31 August in Los Angeles, so the account's current
  // month is August. Getting this wrong silently reports a near-empty month.
  const la = resolveMonthToDateWindows(new Date("2026-09-01T02:00:00Z"), TZ);
  assert.equal(la.current.since, "2026-08-01");
  assert.equal(la.current.until, "2026-08-30");
  assert.equal(la.today.date, "2026-08-31");

  const utc = resolveMonthToDateWindows(new Date("2026-09-01T02:00:00Z"), "UTC");
  assert.equal(utc.current.since, "2026-09-01");
  assert.equal(utc.today.date, "2026-09-01");
  assert.notEqual(utc.current.since, la.current.since);
});

test("the first of the month has nothing to compare yet", () => {
  // No completed days, so the comparison is withheld rather than shown against a single
  // partial day.
  const first = resolveMonthToDateWindows(new Date("2026-09-01T18:00:00Z"), TZ);

  assert.equal(first.comparable, false);
  assert.match(first.notComparableReason, /no completed days to compare yet/i);
  assert.equal(first.current.days, 0);
  assert.equal(first.previous.days, 0);
  assert.equal(first.today.date, "2026-09-01");
  // The fetch window still reaches back, so the moment a day completes it is available.
  assert.equal(first.fetch.since, "2026-08-01");
});

test("the comparison day is clamped when the previous month is shorter", () => {
  // On 31 March the completed window is 1-30 March, and February has only 28 days.
  const march = resolveMonthToDateWindows(new Date("2026-03-31T18:00:00Z"), TZ);
  assert.equal(march.current.until, "2026-03-30");
  assert.equal(march.previous.since, "2026-02-01");
  assert.equal(march.previous.until, "2026-02-28");
  assert.equal(march.clamped, true);
  assert.match(march.clampedNote, /only 28 days/);
  assert.match(march.clampedNote, /first 28 days against this month's first 30/);

  // A leap February clamps to 29 instead.
  const leap = resolveMonthToDateWindows(new Date("2028-03-31T18:00:00Z"), TZ);
  assert.equal(leap.previous.until, "2028-02-29");
  assert.equal(leap.clamped, true);

  // Mid-month in a long month needs no clamping.
  const mid = resolveMonthToDateWindows(new Date("2026-03-15T18:00:00Z"), TZ);
  assert.equal(mid.clamped, false);
  assert.equal(mid.previous.until, "2026-02-14");
});

test("January compares against December of the previous year", () => {
  const january = resolveMonthToDateWindows(new Date("2026-01-09T18:00:00Z"), TZ);
  assert.equal(january.current.since, "2026-01-01");
  assert.equal(january.current.until, "2026-01-08");
  assert.equal(january.previous.since, "2025-12-01");
  assert.equal(january.previous.until, "2025-12-08");
  assert.equal(january.clamped, false);
});

test("an unparseable timezone falls back rather than throwing", () => {
  const windows = resolveMonthToDateWindows(new Date("2026-09-04T18:00:00Z"), "Not/AZone");
  assert.equal(windows.current.since, "2026-09-01");
  assert.equal(windows.current.until, "2026-09-03");
});

test("only completed days inside each window are counted, and today is separate", () => {
  const trend = buildCustomerAcquisitionTrend({
    dailyRows: [
      day("2026-07-31", 99),   // before both windows
      day("2026-08-01", 5, 10),
      day("2026-08-02", 7, 12),
      day("2026-08-03", 4, 9),
      day("2026-08-04", 6, 11), // past the comparison point, must not leak in
      day("2026-08-31", 40),    // also excluded
      day("2026-09-01", 9, 8),
      day("2026-09-02", 11, 7),
      day("2026-09-03", 6, 10),
      day("2026-09-04", 8, 6)   // today, reported on its own
    ],
    actionTypes,
    now: new Date("2026-09-04T18:00:00Z"),
    timeZone: TZ,
    currency: "DKK",
    formatCurrency
  });

  assert.equal(trend.current.newCustomers, 9 + 11 + 6);
  assert.equal(trend.previous.newCustomers, 5 + 7 + 4);
  assert.equal(trend.current.existingCustomers, 8 + 7 + 10);
  assert.equal(trend.current.daysWithData, 3);
  assert.equal(trend.previous.daysWithData, 3);
  // Today is excluded from the comparison but still surfaced.
  assert.equal(trend.today.newCustomers, 8);
  assert.equal(trend.delta, 26 - 16);
});

test("delta, percentage and direction describe the same movement", () => {
  const on = (dailyRows) => buildCustomerAcquisitionTrend({
    dailyRows,
    actionTypes,
    now: new Date("2026-09-03T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });

  const up = on([day("2026-08-01", 5), day("2026-08-02", 5), day("2026-09-01", 8), day("2026-09-02", 7)]);
  assert.equal(up.current.newCustomers, 15);
  assert.equal(up.previous.newCustomers, 10);
  assert.equal(up.delta, 5);
  assert.equal(up.percentChange, 50);
  assert.equal(up.direction, "up");
  assert.match(up.summary, /15 new customers in the first 2 days of this month, against 10 in the same days last month \(\+5, \+50%\)/);

  const down = on([day("2026-08-01", 10), day("2026-08-02", 10), day("2026-09-01", 8), day("2026-09-02", 7)]);
  assert.equal(down.delta, -5);
  assert.equal(down.percentChange, -25);
  assert.equal(down.direction, "down");

  const flat = on([day("2026-08-01", 6), day("2026-08-02", 6), day("2026-09-01", 6), day("2026-09-02", 6)]);
  assert.equal(flat.delta, 0);
  assert.equal(flat.percentChange, 0);
  assert.equal(flat.direction, "flat");
});

test("a zero baseline reports no percentage instead of infinity", () => {
  const fromZero = buildCustomerAcquisitionTrend({
    dailyRows: [day("2026-09-01", 7)],
    actionTypes,
    now: new Date("2026-09-03T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });
  assert.equal(fromZero.previous.newCustomers, 0);
  assert.equal(fromZero.percentChange, null);
  assert.equal(fromZero.direction, "new");
  assert.match(fromZero.summary, /against none in the same days last month/);

  const bothZero = buildCustomerAcquisitionTrend({
    dailyRows: [],
    actionTypes,
    now: new Date("2026-09-03T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });
  assert.equal(bothZero.percentChange, null);
  assert.equal(bothZero.direction, "flat");
  assert.match(bothZero.summary, /No new customers in the first 2 days of either month/);
});

test("the first of the month reports unknown rather than a decline", () => {
  // Direction must not read as "down" merely because no day has completed.
  const trend = buildCustomerAcquisitionTrend({
    dailyRows: [day("2026-08-01", 10), day("2026-09-01", 2)],
    actionTypes,
    now: new Date("2026-09-01T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });

  assert.equal(trend.comparable, false);
  assert.equal(trend.direction, "unknown");
  assert.equal(trend.today.newCustomers, 2);
  assert.match(trend.summary, /nothing to compare/i);
  assert.match(trend.summary, /2 new customers so far today/);
});

test("an account without the conversions reports unknown, not a decline", () => {
  const trend = buildCustomerAcquisitionTrend({
    dailyRows: [day("2026-08-01", 10), day("2026-09-01", 0)],
    actionTypes: resolveCustomerConversionActionTypes([]),
    now: new Date("2026-09-03T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });

  assert.equal(trend.available, false);
  assert.equal(trend.direction, "unknown");
  assert.match(trend.summary, /cannot be counted/);
});

test("the daily series labels which window each day belongs to", () => {
  const trend = buildCustomerAcquisitionTrend({
    dailyRows: [
      day("2026-07-20", 3),
      day("2026-08-02", 4),
      day("2026-08-20", 6),
      day("2026-09-02", 5)
    ],
    actionTypes,
    now: new Date("2026-09-03T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });

  const byDate = Object.fromEntries(trend.dailySeries.map((p) => [p.date, p.month]));
  assert.equal(byDate["2026-08-02"], "previous");
  assert.equal(byDate["2026-09-02"], "current");
  // Inside the fetch window but past the comparison point.
  assert.equal(byDate["2026-08-20"], "outside");
  // Before the fetch window, dropped entirely.
  assert.equal(byDate["2026-07-20"], undefined);
  // Sorted ascending so a sparkline can render it directly.
  const dates = trend.dailySeries.map((p) => p.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("revenue is carried for both windows", () => {
  const trend = buildCustomerAcquisitionTrend({
    dailyRows: [day("2026-08-01", 4, 0, 40000), day("2026-09-01", 6, 0, 90000)],
    actionTypes,
    now: new Date("2026-09-03T18:00:00Z"),
    timeZone: TZ,
    currency: "DKK",
    formatCurrency
  });

  assert.equal(trend.current.newCustomerRevenue, 90000);
  assert.equal(trend.previous.newCustomerRevenue, 40000);
  assert.equal(trend.current.formattedNewCustomerRevenue, "DKK 90000");
});

test("the real 2026-09-04 account figures reproduce the completed-day comparison", () => {
  // Actual daily new-customer counts read off the ad account, which is where the
  // partial-day distortion was discovered.
  const trend = buildCustomerAcquisitionTrend({
    dailyRows: [
      day("2026-08-01", 6), day("2026-08-02", 3), day("2026-08-03", 5), day("2026-08-04", 5),
      day("2026-09-01", 11), day("2026-09-02", 7), day("2026-09-03", 6), day("2026-09-04", 0)
    ],
    actionTypes,
    now: new Date("2026-09-04T18:00:00Z"),
    timeZone: TZ,
    formatCurrency
  });

  assert.equal(trend.current.newCustomers, 24);
  assert.equal(trend.previous.newCustomers, 14);
  assert.equal(trend.delta, 10);
  assert.equal(trend.percentChange, 71.4);
  assert.equal(trend.direction, "up");
  assert.equal(trend.today.newCustomers, 0);

  // Had today been folded in, the same data would have read +26% against 19.
  const naive = 24 / (14 + 5) - 1;
  assert.ok(Math.round(naive * 100) === 26);
  assert.ok(trend.percentChange > 60, "completed-day comparison must not be dragged down by the partial day");
});
