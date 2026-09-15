const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_ENTRIES,
  appendSubscriberSnapshot,
  buildSubscriberFlowSeries,
  createEmptyHistory,
  normalizeHistory
} = require("../server/klaviyo/subscriber-history");

function history(entries) {
  return { version: 1, updatedAt: "", entries };
}

test("removals are derived as previous total plus joins minus current total", () => {
  // The real April-to-September figures for DE: 2,149 members, 217 joins, 1,946 members.
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-04-16", markets: { DE: { total: 2149, joined: 0 } } },
    { date: "2026-09-15", markets: { DE: { total: 1946, joined: 217 } } }
  ]));

  assert.equal(series.available, true);
  const de = series.markets.find((row) => row.country === "DE");
  assert.deepEqual(de.joined, [217]);
  assert.deepEqual(de.removed, [420]);
  assert.deepEqual(de.net, [-203]);
  assert.equal(de.total, 1946);
});

test("the net always reconciles the two recorded totals, whatever the gross flows are", () => {
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-04-16", markets: { EU: { total: 4260, joined: 0 }, UK: { total: 4553, joined: 0 } } },
    { date: "2026-09-15", markets: { EU: { total: 4798, joined: 1135 }, UK: { total: 4356, joined: 444 } } }
  ]));

  assert.deepEqual(series.totals.joined, [1579]);
  assert.deepEqual(series.totals.removed, [597 + 641]);
  assert.deepEqual(series.totals.net, [538 - 197]);
  // joined - removed must equal net, or the derivation is not self-consistent.
  assert.equal(series.totals.joined[0] - series.totals.removed[0], series.totals.net[0]);
});

test("a single snapshot yields no series, and says why rather than drawing a flat line", () => {
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-04-16", markets: { DE: { total: 2149, joined: 0 } } }
  ]));
  assert.equal(series.available, false);
  assert.match(series.reason, /one subscriber snapshot/i);
  assert.deepEqual(series.periods, []);
});

test("an empty archive reports that nothing has been recorded", () => {
  const series = buildSubscriberFlowSeries(createEmptyHistory());
  assert.equal(series.available, false);
  assert.match(series.reason, /No subscriber snapshots/i);
});

test("a market missing from one snapshot yields a gap, never a zero", () => {
  // A zero would claim the list emptied; the market simply was not measured that day.
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-04-16", markets: { DE: { total: 2149, joined: 0 }, UK: { total: 4553, joined: 0 } } },
    { date: "2026-09-15", markets: { DE: { total: 1946, joined: 217 } } }
  ]), { markets: ["DE", "UK"] });

  const uk = series.markets.find((row) => row.country === "UK");
  assert.equal(uk, undefined, "a market with no comparable interval is left out rather than zeroed");
  const de = series.markets.find((row) => row.country === "DE");
  assert.deepEqual(de.removed, [420]);
});

test("periods carry the interval they actually cover", () => {
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-09-01", markets: { DK: { total: 1000, joined: 0 } } },
    { date: "2026-09-15", markets: { DK: { total: 1010, joined: 30 } } }
  ]));
  assert.deepEqual(series.periods, [{ from: "2026-09-01", to: "2026-09-15", days: 14 }]);
});

test("a growing list still reports its removals", () => {
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-04-16", markets: { FR: { total: 3567, joined: 0 } } },
    { date: "2026-09-15", markets: { FR: { total: 3653, joined: 502 } } }
  ]));
  const fr = series.markets.find((row) => row.country === "FR");
  assert.deepEqual(fr.net, [86]);
  assert.deepEqual(fr.removed, [416], "growth of 86 still hides 416 removals");
});

test("recording the same day twice replaces the earlier entry rather than doubling it", () => {
  let store = appendSubscriberSnapshot(createEmptyHistory(), {
    date: "2026-09-15",
    markets: { DE: { total: 1900, joined: 100 } }
  });
  store = appendSubscriberSnapshot(store, {
    date: "2026-09-15",
    markets: { DE: { total: 1946, joined: 217 } }
  });
  assert.equal(store.entries.length, 1);
  assert.equal(store.entries[0].markets.DE.total, 1946);
});

test("entries are kept in date order however they arrive", () => {
  let store = appendSubscriberSnapshot(createEmptyHistory(), { date: "2026-09-15", markets: { DE: { total: 1946, joined: 217 } } });
  store = appendSubscriberSnapshot(store, { date: "2026-04-16", markets: { DE: { total: 2149, joined: 0 } } });
  assert.deepEqual(store.entries.map((entry) => entry.date), ["2026-04-16", "2026-09-15"]);
});

test("the archive is bounded so it stays inside a single round trip", () => {
  const entries = [];
  for (let index = 0; index < MAX_ENTRIES + 25; index += 1) {
    const day = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
    entries.push({ date: day, markets: { DE: { total: 2000 + index, joined: 1 } } });
  }
  const normalized = normalizeHistory(history(entries));
  assert.equal(normalized.entries.length, MAX_ENTRIES);
  // The oldest entries are the ones dropped, so the recent series stays intact.
  assert.equal(normalized.entries[normalized.entries.length - 1].markets.DE.total, 2000 + MAX_ENTRIES + 24);
});

test("malformed entries are discarded instead of poisoning the series", () => {
  const normalized = normalizeHistory(history([
    { date: "not-a-date", markets: { DE: { total: 10, joined: 1 } } },
    { date: "2026-09-15", markets: { DE: { total: "nonsense", joined: 1 } } },
    { date: "2026-09-16", markets: { DE: { total: 1946, joined: 217 } } }
  ]));
  assert.equal(normalized.entries.length, 1);
  assert.equal(normalized.entries[0].date, "2026-09-16");
});

test("a snapshot without a usable date is refused rather than stored under a wrong one", () => {
  assert.throws(() => appendSubscriberSnapshot(createEmptyHistory(), { markets: { DE: { total: 1 } } }), /YYYY-MM-DD/);
});

test("the basis of each series is stated, because removals cannot be measured directly", () => {
  const series = buildSubscriberFlowSeries(history([
    { date: "2026-04-16", markets: { DE: { total: 2149, joined: 0 } } },
    { date: "2026-09-15", markets: { DE: { total: 1946, joined: 217 } } }
  ]));
  assert.match(series.basis.removed, /Derived/i);
  assert.match(series.basis.joined, /joined_group_at/);
  assert.match(series.basis.net, /Exact/i);
});
