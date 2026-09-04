const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const {
  buildCustomerAcquisitionTrend,
  buildCustomerAcquisitionWindows,
  resolveAcquisitionWindowPresets,
  resolveCustomerConversionActionTypes
} = require("../server/meta/customer-acquisition");

const NEW_TYPE = "offsite_conversion.custom.775766277988531";
const EXISTING_TYPE = "offsite_conversion.custom.573537871687880";
const actionTypes = resolveCustomerConversionActionTypes([
  { id: "775766277988531", name: "New_customer" },
  { id: "573537871687880", name: "Existing_customer" }
]);
const formatCurrency = (value, currency) => `${currency} ${Math.round(Number(value) || 0)}`;
const TZ = "America/Los_Angeles";
const NOW = new Date("2026-09-04T18:00:00Z");

function day(date, newCustomers, existingCustomers = 0, revenue = 0, spend = 0) {
  return {
    date_start: date,
    spend: String(spend),
    actions: [
      { action_type: NEW_TYPE, value: String(newCustomers) },
      { action_type: EXISTING_TYPE, value: String(existingCustomers) }
    ],
    action_values: [{ action_type: NEW_TYPE, value: String(revenue) }]
  };
}

function monthOfDays(year, month, days, newPerDay, spendPerDay = 1000) {
  return Array.from({ length: days }, (_, index) =>
    day(`${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`, newPerDay, 2, 100, spendPerDay));
}

test("the default preset is month to date, unchanged by adding the selector", () => {
  // The user asked for the panel's standard view to stay exactly as it was. If the
  // default ever shifts to a different period, that is a silent change to the number
  // people read every day.
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  assert.equal(resolved.defaultPreset, "month_to_date");
  assert.equal(resolved.presets[0].key, "month_to_date");

  const monthToDate = resolved.presets[0];
  assert.equal(monthToDate.current.since, "2026-09-01");
  assert.equal(monthToDate.current.until, "2026-09-03");
  assert.equal(monthToDate.previous.since, "2026-08-01");
  assert.equal(monthToDate.previous.until, "2026-08-03");
});

test("the default preset matches the standalone month-to-date trend exactly", () => {
  // Two code paths compute the same figure, so they must agree. If they drift, the panel
  // headline and the trend badge would disagree with each other.
  const rows = [
    ...monthOfDays(2026, 8, 31, 5),
    day("2026-09-01", 11), day("2026-09-02", 7), day("2026-09-03", 6), day("2026-09-04", 2)
  ];

  const trend = buildCustomerAcquisitionTrend({ dailyRows: rows, actionTypes, now: NOW, timeZone: TZ, formatCurrency });
  const preset = trend.windows.presets.find((entry) => entry.key === "month_to_date");

  assert.equal(preset.current.newCustomers, trend.current.newCustomers);
  assert.equal(preset.previous.newCustomers, trend.previous.newCustomers);
  assert.equal(preset.delta, trend.delta);
  assert.equal(preset.percentChange, trend.percentChange);
  assert.equal(preset.direction, trend.direction);
});

test("every preset is offered and each names both of its windows", () => {
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  assert.deepEqual(
    resolved.presets.map((preset) => preset.key),
    ["month_to_date", "last_full_month", "prior_full_month", "last_7_days", "last_30_days", "last_90_days"]
  );

  for (const preset of resolved.presets) {
    assert.ok(preset.label, `${preset.key} has no label`);
    assert.ok(preset.current.label, `${preset.key} current window has no label`);
    assert.ok(preset.previous.label, `${preset.key} previous window has no label`);
    assert.match(preset.current.since, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(preset.previous.until, /^\d{4}-\d{2}-\d{2}$/);
    // The previous window must end before the current one starts.
    assert.ok(preset.previous.until < preset.current.since, `${preset.key} windows overlap`);
  }
});

test("rolling presets always compare equal-length windows", () => {
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  for (const key of ["last_7_days", "last_30_days", "last_90_days"]) {
    const preset = resolved.presets.find((entry) => entry.key === key);
    assert.equal(preset.current.days, preset.previous.days, `${key} windows differ in length`);
    assert.equal(preset.note, "", `${key} should need no caveat`);
  }
});

test("rolling presets end yesterday, never including the day in progress", () => {
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  const sevenDays = resolved.presets.find((entry) => entry.key === "last_7_days");
  // Account-local today is 2026-09-04, so the window ends on the 3rd.
  assert.equal(sevenDays.current.until, "2026-09-03");
  assert.equal(sevenDays.current.since, "2026-08-28");
  assert.equal(sevenDays.previous.until, "2026-08-27");
  assert.equal(sevenDays.previous.since, "2026-08-21");
});

test("the named calendar months are the two most recent complete ones", () => {
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  const lastFull = resolved.presets.find((entry) => entry.key === "last_full_month");
  const prior = resolved.presets.find((entry) => entry.key === "prior_full_month");

  assert.equal(lastFull.label, "August 2026");
  assert.equal(lastFull.current.since, "2026-08-01");
  assert.equal(lastFull.current.until, "2026-08-31");
  assert.equal(lastFull.previous.since, "2026-07-01");
  assert.equal(lastFull.previous.until, "2026-07-31");
  // Both 31 days, so no caveat is needed.
  assert.equal(lastFull.note, "");

  assert.equal(prior.label, "July 2026");
  assert.equal(prior.current.until, "2026-07-31");
  assert.equal(prior.previous.until, "2026-06-30");
});

test("a calendar month against a shorter one states the arithmetic bias", () => {
  // 31 versus 28 days is an 11% head start before any real change. Comparing them is
  // normal month-over-month reporting, but it must not be presented as a clean result.
  const april = resolveAcquisitionWindowPresets(new Date("2026-04-10T18:00:00Z"), TZ);
  const march = april.presets.find((entry) => entry.key === "last_full_month");
  assert.equal(march.label, "March 2026");
  assert.match(march.note, /March has 31 days against February's 28/);
  assert.match(march.note, /about 11% of any difference is just the 3 days/);

  const february = april.presets.find((entry) => entry.key === "prior_full_month");
  assert.match(february.note, /February has 28 days against January's 31/);
  assert.match(february.note, /the 3 days/);
});

test("January's named months roll back into the previous year", () => {
  const resolved = resolveAcquisitionWindowPresets(new Date("2026-01-15T18:00:00Z"), TZ);
  const lastFull = resolved.presets.find((entry) => entry.key === "last_full_month");
  const prior = resolved.presets.find((entry) => entry.key === "prior_full_month");

  assert.equal(lastFull.label, "December 2025");
  assert.equal(lastFull.previous.since, "2025-11-01");
  assert.equal(prior.label, "November 2025");
  assert.equal(prior.previous.since, "2025-10-01");
});

test("one fetch window covers every preset, plus today", () => {
  // If the fetch is narrower than the widest preset, that preset silently reports zero.
  const resolved = resolveAcquisitionWindowPresets(NOW, TZ);
  const earliest = resolved.presets.map((preset) => preset.previous.since).sort()[0];
  assert.equal(resolved.fetch.since, earliest);
  for (const preset of resolved.presets) {
    assert.ok(preset.previous.since >= resolved.fetch.since, `${preset.key} starts before the fetch window`);
    assert.ok(preset.current.until <= resolved.fetch.until, `${preset.key} ends after the fetch window`);
  }
  // Today is inside the window so the in-progress figure can still be reported.
  assert.equal(resolved.fetch.until, "2026-09-04");
  assert.equal(resolved.today.date, "2026-09-04");
});

test("switching preset changes the counts, computed from the same series", () => {
  const rows = [
    ...monthOfDays(2026, 6, 30, 3, 900),
    ...monthOfDays(2026, 7, 31, 4, 1000),
    ...monthOfDays(2026, 8, 31, 5, 1100),
    day("2026-09-01", 11, 2, 100, 1200),
    day("2026-09-02", 7, 2, 100, 1200),
    day("2026-09-03", 6, 2, 100, 1200),
    day("2026-09-04", 1, 0, 0, 500)
  ];

  const windows = buildCustomerAcquisitionWindows({
    dailyRows: rows, actionTypes, now: NOW, timeZone: TZ, currency: "DKK", formatCurrency
  });
  const by = Object.fromEntries(windows.presets.map((preset) => [preset.key, preset]));

  assert.equal(by.month_to_date.current.newCustomers, 24);
  assert.equal(by.month_to_date.previous.newCustomers, 15);

  // August total, which is what "how did August look" asks for.
  assert.equal(by.last_full_month.current.newCustomers, 31 * 5);
  assert.equal(by.last_full_month.previous.newCustomers, 31 * 4);
  assert.equal(by.last_full_month.direction, "up");

  assert.equal(by.prior_full_month.current.newCustomers, 31 * 4);
  assert.equal(by.prior_full_month.previous.newCustomers, 30 * 3);

  // Today is excluded from every comparison but still reported once.
  assert.equal(windows.today.newCustomers, 1);
});

test("cost per new customer is available for every preset, from that period's spend", () => {
  const rows = [
    ...monthOfDays(2026, 7, 31, 4, 1000),
    ...monthOfDays(2026, 8, 31, 5, 2000)
  ];
  const windows = buildCustomerAcquisitionWindows({
    dailyRows: rows, actionTypes, now: NOW, timeZone: TZ, currency: "DKK", formatCurrency
  });
  const august = windows.presets.find((preset) => preset.key === "last_full_month");

  assert.equal(august.current.spend, 31 * 2000);
  assert.equal(august.current.costPerNewCustomer, (31 * 2000) / (31 * 5));
  assert.equal(august.current.formattedCostPerNewCustomer, "DKK 400");
  assert.equal(august.previous.costPerNewCustomer, (31 * 1000) / (31 * 4));
  assert.equal(august.previous.formattedCostPerNewCustomer, "DKK 250");
});

test("an account without the conversions reports unknown on every preset", () => {
  const windows = buildCustomerAcquisitionWindows({
    dailyRows: monthOfDays(2026, 8, 31, 5),
    actionTypes: resolveCustomerConversionActionTypes([]),
    now: NOW, timeZone: TZ, formatCurrency
  });

  assert.equal(windows.available, false);
  for (const preset of windows.presets) {
    assert.equal(preset.direction, "unknown", `${preset.key} should not claim a direction`);
    assert.match(preset.summary, /cannot be counted/);
  }
});

test("the picker is local to the panel and never writes the global date filter", () => {
  // The user asked explicitly that this adjust only the panel. A handler that reached for
  // appState.dashboardDateRange or dispatched a dashboard refresh would break that.
  const ui = readFileSync(join(__dirname, "..", "src", "ui.js"), "utf8");
  const start = ui.indexOf("function bindAcquisitionPresetPicker(");
  assert.notEqual(start, -1, "the picker binder is gone");
  const body = ui.slice(start, ui.indexOf("\n}", start));

  for (const forbidden of ["appState", "dashboardDate", "renderDashboard", "fetch("]) {
    assert.equal(body.includes(forbidden), false, `the picker handler touches ${forbidden}`);
  }
});

test("the period selector and its scope note are styled", () => {
  const ui = readFileSync(join(__dirname, "..", "src", "ui.js"), "utf8");
  const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
  for (const className of ["meta-acq-periods", "meta-acq-period", "meta-acq-period.is-active", "meta-acq-scope-note"]) {
    const bare = className.split(".")[0];
    assert.ok(ui.includes(bare), `renderer never emits ${bare}`);
    assert.ok(css.includes(`.${className}`), `styles.css has no .${className} rule`);
  }
});

test("every window reports its own three-way purchase split, reconciled", () => {
  // The bug this pins: the panel drew one bar from a preset's new-customer count against
  // the dashboard range's existing and untagged counts. The bar grew as the period
  // widened while its caption still said "this month", and nothing on screen revealed
  // that the segments came from different periods.
  const day = (date, newC, existing, purchases) => ({
    date_start: date,
    spend: "1000",
    actions: [
      { action_type: NEW_TYPE, value: String(newC) },
      { action_type: EXISTING_TYPE, value: String(existing) },
      { action_type: "omni_purchase", value: String(purchases) }
    ],
    action_values: [
      { action_type: NEW_TYPE, value: "1000" },
      { action_type: EXISTING_TYPE, value: "3000" }
    ]
  });

  const rows = [];
  for (let d = 1; d <= 30; d += 1) rows.push(day(`2026-06-${String(d).padStart(2, "0")}`, 3, 6, 12));
  for (let d = 1; d <= 31; d += 1) rows.push(day(`2026-07-${String(d).padStart(2, "0")}`, 4, 8, 15));
  for (let d = 1; d <= 31; d += 1) rows.push(day(`2026-08-${String(d).padStart(2, "0")}`, 5, 10, 19));
  rows.push(day("2026-09-01", 11, 8, 25), day("2026-09-02", 7, 7, 18), day("2026-09-03", 6, 10, 21));

  const windows = buildCustomerAcquisitionWindows({
    dailyRows: rows, actionTypes, now: NOW, timeZone: TZ, currency: "DKK", formatCurrency
  });

  for (const preset of windows.presets) {
    for (const side of ["current", "previous"]) {
      const w = preset[side];
      assert.equal(
        w.newCustomers + w.existingCustomers + w.untaggedPurchases,
        w.purchases,
        `${preset.key}.${side} split does not reconcile to its own purchase count`
      );
      assert.ok(w.untaggedPurchases >= 0, `${preset.key}.${side} has a negative remainder`);
      assert.ok(w.untaggedShare >= 0 && w.untaggedShare <= 100, `${preset.key}.${side} share out of range`);
    }
  }

  // The whole point: a wider period has a genuinely larger purchase count, so the split
  // scales together instead of one segment outgrowing the others.
  const by = Object.fromEntries(windows.presets.map((preset) => [preset.key, preset.current]));
  assert.ok(by.last_90_days.purchases > by.last_30_days.purchases);
  assert.ok(by.last_30_days.purchases > by.last_7_days.purchases);
  assert.ok(by.last_90_days.existingCustomers > by.month_to_date.existingCustomers);
});

test("average order value is computed per window, not carried from the dashboard range", () => {
  const day = (date, newC, existing, newRev, existingRev) => ({
    date_start: date,
    spend: "1000",
    actions: [
      { action_type: NEW_TYPE, value: String(newC) },
      { action_type: EXISTING_TYPE, value: String(existing) },
      { action_type: "omni_purchase", value: String(newC + existing) }
    ],
    action_values: [
      { action_type: NEW_TYPE, value: String(newRev) },
      { action_type: EXISTING_TYPE, value: String(existingRev) }
    ]
  });

  const rows = [];
  // July orders are small, August orders are large, so the two months must not report the
  // same average.
  for (let d = 1; d <= 31; d += 1) rows.push(day(`2026-07-${String(d).padStart(2, "0")}`, 2, 2, 2000, 4000));
  for (let d = 1; d <= 31; d += 1) rows.push(day(`2026-08-${String(d).padStart(2, "0")}`, 2, 2, 6000, 10000));

  const windows = buildCustomerAcquisitionWindows({
    dailyRows: rows, actionTypes, now: NOW, timeZone: TZ, currency: "DKK", formatCurrency
  });
  const august = windows.presets.find((preset) => preset.key === "last_full_month");
  const july = windows.presets.find((preset) => preset.key === "prior_full_month");

  assert.equal(august.current.averageNewCustomerOrderValue, 3000);
  assert.equal(august.current.averageExistingCustomerOrderValue, 5000);
  assert.equal(july.current.averageNewCustomerOrderValue, 1000);
  assert.equal(july.current.averageExistingCustomerOrderValue, 2000);
  assert.notEqual(august.current.averageNewCustomerOrderValue, july.current.averageNewCustomerOrderValue);
});

test("the panel reads every scoped figure from one source, never a mix", () => {
  const ui = readFileSync(join(__dirname, "..", "src", "ui.js"), "utf8");
  const start = ui.indexOf("export function renderOverviewCustomerAcquisition(");
  const body = ui.slice(start, ui.indexOf("\n}", ui.indexOf("bindAcquisitionPresetPicker();", start)));

  // The three bar segments must all come from the same scope object.
  const segments = body.match(/buildStackSegments\(\s*\[([\s\S]*?)\]/);
  assert.ok(segments, "the purchase-split bar is gone");
  assert.match(segments[1], /amount: newCount/);
  assert.match(segments[1], /amount: existingCount/);
  assert.match(segments[1], /amount: untagged/);

  // And those three must be assigned from scope, not from the model directly.
  assert.match(body, /const newCount = scope\.newCount;/);
  assert.match(body, /const existingCount = scope\.existingCount;/);
  assert.match(body, /const untagged = scope\.untagged;/);
});

test("today's partial count is only shown on the default preset", () => {
  const ui = readFileSync(join(__dirname, "..", "src", "ui.js"), "utf8");
  const start = ui.indexOf("function adaptPresetToTrend(");
  const body = ui.slice(start, ui.indexOf("\n}", start));
  // A completed calendar month or a rolling window has nothing to do with today.
  assert.match(body, /showToday: preset\.key === \(windows\.defaultPreset/);

  const trendStart = ui.indexOf("function renderAcquisitionTrend(");
  const trendBody = ui.slice(trendStart, ui.indexOf("\n}", ui.indexOf("clampedNote", trendStart)));
  assert.match(trendBody, /trend\.showToday/, "the trend renderer ignores showToday");
  // The old hardcoded phrasing described only the month-to-date case.
  assert.equal(trendBody.includes("in the same days last month"), false);
  assert.equal(trendBody.includes("both months"), false);
});

test("the presets roll over correctly on every day of two years", () => {
  // Answers "does this keep working at a month change" by exhaustion rather than by
  // reasoning: every day across 2026-2028, including both January year-boundaries, the
  // leap February of 2028, and both DST switches in the ad account's timezone.
  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const lengthOf = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

  const failures = [];
  let checked = 0;

  for (let year = 2026; year <= 2028; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      for (let dayOfMonth = 1; dayOfMonth <= lengthOf(year, month); dayOfMonth += 1) {
        const resolved = resolveAcquisitionWindowPresets(
          new Date(Date.UTC(year, month - 1, dayOfMonth, 20, 0, 0)),
          TZ
        );
        checked += 1;
        const where = `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
        const fail = (message) => failures.push(`${where}: ${message}`);

        for (const preset of resolved.presets) {
          if (!(preset.previous.until < preset.current.since)) fail(`${preset.key} windows overlap`);
          if (preset.previous.since < resolved.fetch.since) fail(`${preset.key} starts before the fetch window`);
          if (preset.current.until > resolved.fetch.until) fail(`${preset.key} ends after the fetch window`);
        }

        for (const key of ["last_7_days", "last_30_days", "last_90_days"]) {
          const preset = resolved.presets.find((entry) => entry.key === key);
          if (preset.current.days !== preset.previous.days) fail(`${key} unequal lengths`);
          if (preset.current.until >= resolved.today.date) fail(`${key} includes the day in progress`);
        }

        // The named months must be the two most recent COMPLETE ones, rolling into the
        // previous year in January, and must never touch the month in progress.
        const expectedMonth = month === 1 ? 12 : month - 1;
        const expectedYear = month === 1 ? year - 1 : year;
        const lastFull = resolved.presets.find((entry) => entry.key === "last_full_month");
        const prior = resolved.presets.find((entry) => entry.key === "prior_full_month");
        if (lastFull.label !== `${MONTHS[expectedMonth - 1]} ${expectedYear}`) {
          fail(`last_full_month is "${lastFull.label}"`);
        }
        if (lastFull.current.days !== lengthOf(expectedYear, expectedMonth)) {
          fail(`last_full_month does not cover the whole of ${lastFull.label}`);
        }
        if (lastFull.current.until >= `${year}-${String(month).padStart(2, "0")}-01`) {
          fail("last_full_month reaches into the month in progress");
        }
        if (!(prior.current.until < lastFull.current.since)) fail("prior_full_month is not before last_full_month");

        // A length mismatch must always be disclosed, and never invented.
        for (const preset of [lastFull, prior]) {
          const unequal = preset.current.days !== preset.previous.days;
          if (unequal && !preset.note) fail(`${preset.key} (${preset.label}) hides a length mismatch`);
          if (!unequal && preset.note) fail(`${preset.key} (${preset.label}) invents a caveat`);
        }

        // Month to date is only comparable once a day has completed.
        const mtd = resolved.presets.find((entry) => entry.key === "month_to_date");
        const accountDay = Number(resolved.today.date.slice(8, 10));
        if (accountDay === 1 && mtd.comparable) fail("month_to_date is comparable on the 1st");
        if (accountDay > 1 && !mtd.comparable) fail("month_to_date is not comparable mid-month");
        if (mtd.comparable && mtd.previous.days !== Math.min(accountDay - 1, lengthOf(expectedYear, expectedMonth))) {
          fail(`month_to_date previous window is ${mtd.previous.days} days`);
        }
      }
    }
  }

  assert.equal(checked, 1096, "the walk did not cover the expected number of days");
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} rollover failures`);
});

test("a month rollover cannot serve a stale cached window", () => {
  // The daily series is cached for 3 hours. If the cache key did not move with the
  // window, the first refresh of a new month would answer from a series that stops before
  // the new month begins - every preset would silently read low.
  const fetchers = readFileSync(join(__dirname, "..", "server", "meta", "_snapshot-fetchers.js"), "utf8");
  const line = fetchers.split(/\r?\n/).find((entry) => entry.includes("insights_acquisition_trend"));
  assert.ok(line, "the trend fetch cache key is gone");
  assert.match(line, /trendWindow\.since/, "the cache key does not include the window start");
  assert.match(line, /trendWindow\.until/, "the cache key does not include the window end");

  // And the window itself moves every day, so the key does too.
  const before = resolveAcquisitionWindowPresets(new Date("2026-09-30T20:00:00Z"), TZ).fetch;
  const after = resolveAcquisitionWindowPresets(new Date("2026-10-01T20:00:00Z"), TZ).fetch;
  assert.notEqual(`${before.since}|${before.until}`, `${after.since}|${after.until}`);
  assert.equal(after.until, "2026-10-01");
});
