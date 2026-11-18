const test = require("node:test");
const assert = require("node:assert/strict");

const pilot = require("../server/meta/budget-pilot");

const { addDays, evaluate } = pilot;

// Base level 5,000 from 1/10 (5 incremental and 4 7-day-click new customers a day), 10,000 from 20/10.
const HISTORY = [
  { from: "2026-10-01", daily: 5000 },
  { from: "2026-10-20", daily: 10000 }
];
const STEADY = { spend: 10000, impressions: 220000, clicks: 2000, purchases: 40, nci: 5, nc7: 4 };

function makeDays(from, to, fn) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const base = d < "2026-10-20" ? { ...STEADY, spend: 5000, impressions: 110000, clicks: 1000, purchases: 20, nci: 5, nc7: 4 } : { ...STEADY };
    days.push({ date: d, ...base, ...(fn ? fn(d, base) : {}) });
  }
  return days;
}
const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

test("the requirement is the measured level below plus the step at break-even, without the change day", () => {
  const days = makeDays("2026-09-20", "2026-11-05", (d) => (d === "2026-10-01" ? { nci: 99, nc7: 99 } : d >= "2026-10-20" ? { nci: 8, nc7: 7 } : {}));
  const r = evaluate({ days, history: HISTORY, asOf: "2026-11-05" });
  const extra = (5000 * 7) / pilot.DEFAULTS.breakEven;
  assert.equal(r.requirement.base.daily, 5000);
  assert.ok(Math.abs(r.requirement.nci - (35 + extra)) < 1e-9);
  assert.ok(Math.abs(r.requirement.nc7 - (28 + extra)) < 1e-9);
});

test("over the requirement on both measures, no pressure: hold", () => {
  const days = makeDays("2026-09-20", "2026-11-05", (d) => (d >= "2026-10-20" ? { nci: 8, nc7: 7 } : {}));
  const r = evaluate({ days, history: HISTORY, asOf: "2026-11-05" });
  assert.equal(r.outcome, "green");
  assert.equal(r.pressure, 0);
  assert.equal(r.verdict, "hold");
  assert.equal(r.target, 10000);
});

test("under the requirement on both measures: one step down", () => {
  const days = makeDays("2026-09-20", "2026-11-05", (d) => (d >= "2026-10-20" ? { nci: 6, nc7: 5 } : {}));
  const r = evaluate({ days, history: HISTORY, asOf: "2026-11-05" });
  assert.equal(r.outcome, "red");
  assert.equal(r.verdict, "down");
  assert.equal(r.target, 7500);
});

test("under on one measure is noise until the leading signals explain it", () => {
  const asOf = "2026-11-05";
  const quiet = makeDays("2026-09-20", asOf, (d) => (d >= "2026-10-20" ? { nci: 8, nc7: 5 } : {}));
  assert.equal(evaluate({ days: quiet, history: HISTORY, asOf }).verdict, "watch");

  // CPM +25 % over the last 3 days (2 points) and click rate -15 % over the last 7 (1 point).
  const pressed = makeDays("2026-09-20", asOf, (d) => {
    if (d < "2026-10-20") return {};
    const x = { nci: 8, nc7: 5 };
    if (d >= addDays(asOf, -6)) x.clicks = 1700;
    if (d >= addDays(asOf, -2)) x.spend = 12500;
    return x;
  });
  const r = evaluate({ days: pressed, history: HISTORY, asOf });
  assert.equal(r.outcome, "amber");
  assert.equal(r.signals.cpm.points, 2);
  assert.equal(r.signals.ctr.points, 1);
  assert.equal(r.verdict, "down");
});

test("a price rise alone never steps down while new customers hold", () => {
  const asOf = "2026-11-05";
  const days = makeDays("2026-09-20", asOf, (d) => {
    if (d < "2026-10-20") return {};
    return { nci: 9, nc7: 8, ...(d >= addDays(asOf, -2) ? { spend: 13000 } : {}), ...(d >= addDays(asOf, -6) ? { clicks: 1500 } : {}) };
  });
  const r = evaluate({ days, history: HISTORY, asOf });
  assert.equal(r.outcome, "green");
  assert.ok(r.pressure >= 4);
  assert.notEqual(r.verdict, "down");
});

test("no verdict in the first seven days of a level, except the emergency brake", () => {
  const history = [{ from: "2026-10-01", daily: 5000 }, { from: "2026-11-02", daily: 10000 }];
  const days = makeDays("2026-09-20", "2026-11-05", (d) => (d >= "2026-11-02" ? { nci: 5, nc7: 4 } : {}));
  const r = evaluate({ days, history, asOf: "2026-11-05" });
  assert.equal(r.outcome, "red");
  assert.equal(r.verdict, "cooldown");
});

test("a B2B weekend never pulls the emergency brake", () => {
  const history = [{ from: "2026-10-01", daily: 5000 }, { from: "2026-11-01", daily: 10000 }];
  const days = makeDays("2026-09-20", "2026-11-30", (d) => {
    const weekend = weekday(d) === 0 || weekday(d) === 6;
    return d >= "2026-11-01" ? (weekend ? { nci: 2, nc7: 1 } : { nci: 9, nc7: 8 }) : weekend ? { nci: 1, nc7: 1 } : { nci: 6, nc7: 5 };
  });
  for (let asOf = "2026-11-03"; asOf <= "2026-11-30"; asOf = addDays(asOf, 1)) {
    assert.notEqual(evaluate({ days, history, asOf }).verdict, "down_now", asOf);
  }
});

test("a collapse confirmed by price pulls the emergency brake inside the cool-down", () => {
  const asOf = "2026-11-05";
  const history = [{ from: "2026-10-01", daily: 5000 }, { from: "2026-10-31", daily: 10000 }];
  const days = makeDays("2026-09-20", asOf, (d) => {
    if (d < "2026-10-31") return {};
    return d >= addDays(asOf, -2) ? { nci: 2, nc7: 1, spend: 12500 } : { nci: 8, nc7: 7 };
  });
  const r = evaluate({ days, history, asOf });
  assert.equal(r.daysAtLevel, 5);
  assert.equal(r.verdict, "down_now");
  assert.equal(r.target, 7500);
});

test("the same collapse without price or buyers confirming it is not an emergency", () => {
  const asOf = "2026-11-05";
  const history = [{ from: "2026-10-01", daily: 5000 }, { from: "2026-10-31", daily: 10000 }];
  const days = makeDays("2026-09-20", asOf, (d) => (d < "2026-10-31" ? {} : d >= addDays(asOf, -2) ? { nci: 2, nc7: 1 } : { nci: 8, nc7: 7 }));
  assert.equal(evaluate({ days, history, asOf }).verdict, "cooldown");
});

test("room to step up needs 30 % over on both measures two weeks running and no pressure", () => {
  const days = makeDays("2026-09-20", "2026-11-05", (d) => (d >= "2026-10-20" ? { nci: 10, nc7: 9 } : {}));
  const r = evaluate({ days, history: HISTORY, asOf: "2026-11-05" });
  assert.equal(r.verdict, "up_room");
  assert.equal(r.target, 12500);
  const early = evaluate({ days, history: HISTORY, asOf: "2026-10-30" });
  assert.notEqual(early.verdict, "up_room");
});

test("frequency counts when reach is given", () => {
  const days = makeDays("2026-09-20", "2026-11-05", (d) => (d >= "2026-10-20" ? { nci: 8, nc7: 7 } : {}));
  const reach = { current: { reach: 400000, impressions: 1540000 }, previous: { reach: 550000, impressions: 1540000 } };
  const r = evaluate({ days, history: HISTORY, asOf: "2026-11-05", reach });
  assert.equal(r.signals.frequency.points, 2);
});

test("a new live budget is appended from the day spend moved to it", () => {
  const days = makeDays("2026-10-25", "2026-11-05", (d) => ({ spend: d >= "2026-11-02" ? 7400 : 10100 }));
  const h = pilot.withLiveBudget(HISTORY, 7500, days, "2026-11-05");
  assert.deepEqual(h[h.length - 1], { from: "2026-11-02", daily: 7500, detected: true });
  assert.equal(pilot.withLiveBudget(HISTORY, 10000, days, "2026-11-05"), HISTORY);
});

test("only the live New_customer conversion counts", () => {
  const types = pilot.newCustomerActionTypes([
    { id: "1", name: "New_customer", is_archived: false },
    { id: "2", name: "New_customer", is_archived: true },
    { id: "3", name: "Existing_customer", is_archived: false }
  ]);
  assert.deepEqual(types, ["offsite_conversion.custom.1"]);
});
