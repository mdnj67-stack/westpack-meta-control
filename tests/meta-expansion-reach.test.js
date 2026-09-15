const test = require("node:test");
const assert = require("node:assert/strict");

// The Graph client is stubbed before expansion-reach is required, because that
// module destructures graphRequest at load time. Every assertion below is about
// the arithmetic and the call budget, never about Meta.
const metaLib = require("../server/lib/meta");

const calls = [];
let responder = () => ({ data: [] });

metaLib.graphRequest = async (pathname, accessToken, options = {}) => {
  const params = options.params || {};
  calls.push({ pathname, params });
  return responder(params);
};

const {
  syncExpansionReach,
  buildMonths,
  todayInAccountTimeZone,
  reusableCumulative
} = require("../server/meta/expansion-reach");

const ACCOUNT = "act_123";
const TOKEN = "token";

const months = buildMonths(todayInAccountTimeZone(), 12);
const delivering = months.slice(-4);

// Cumulative rises every month; monthly reach is larger than the month's net-new
// from the second month on, so there is a real repeat share to assert against.
const CUMULATIVE = [100000, 180000, 240000, 300000];
const MONTHLY = [100000, 100000, 90000, 95000];
const EXPECTED_NET_NEW = [100000, 80000, 60000, 60000];
const EXPECTED_REPEAT = [0, 20000, 30000, 35000];

function buildResponder({ campaignIds = ["1", "2"] } = {}) {
  return (params) => {
    if (params.level === "campaign") {
      return {
        data: campaignIds.map((id, index) => ({
          campaign_id: id,
          campaign_name: `Conv ${id}`,
          attribution_setting: "incrementality",
          spend: String(1000 * (index + 1)),
          impressions: "50000",
          reach: "20000"
        }))
      };
    }
    if (params.time_increment === "monthly") {
      return {
        data: delivering.map((month, index) => ({
          date_start: month.since,
          date_stop: month.until,
          reach: String(MONTHLY[index]),
          impressions: String(MONTHLY[index] * 4),
          frequency: "4",
          spend: String(12000 * (index + 1))
        }))
      };
    }
    // Cumulative: keyed by the window end, which is the month's last day.
    const range = JSON.parse(params.time_range);
    const index = delivering.findIndex((month) => month.until === range.until);
    return { data: [{ reach: String(index >= 0 ? CUMULATIVE[index] : 0) }] };
  };
}

function reset(options) {
  calls.length = 0;
  responder = buildResponder(options);
}

function cumulativeCallCount() {
  return calls.filter((call) => call.params.level === "account" && !call.params.time_increment).length;
}

test("net-new reach is the rise in cumulative unique reach, and repeat is the remainder", async () => {
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.months.length, delivering.length);
  assert.deepEqual(snapshot.months.map((month) => month.netNewReach), EXPECTED_NET_NEW);
  assert.deepEqual(snapshot.months.map((month) => month.repeatReach), EXPECTED_REPEAT);
  assert.deepEqual(snapshot.months.map((month) => month.cumulativeReach), CUMULATIVE);
});

test("reach is only ever read at account level, never summed from campaign rows", async () => {
  reset();
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  const reachCalls = calls.filter((call) => String(call.params.fields || "").includes("reach"));
  const campaignLevelReach = reachCalls.filter((call) => call.params.level === "campaign");
  // The attribution call does ask for reach, but only to report each campaign's
  // own delivered reach. Nothing in the series is derived from it.
  for (const call of campaignLevelReach) {
    assert.ok(!call.params.time_increment, "campaign-level reach must never be read as a series");
  }
  assert.ok(reachCalls.some((call) => call.params.level === "account"));
});

test("a repeat share is never negative when Meta restates a cumulative window", async () => {
  calls.length = 0;
  const base = buildResponder();
  // Cumulative for the last month comes back slightly higher than monthly reach
  // allows, which would make monthly minus net-new go negative.
  responder = (params) => {
    if (params.level === "account" && !params.time_increment) {
      const range = JSON.parse(params.time_range);
      if (range.until === delivering[delivering.length - 1].until) {
        return { data: [{ reach: "999999" }] };
      }
    }
    return base(params);
  };

  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  for (const month of snapshot.months) {
    assert.ok(month.repeatReach >= 0, `repeat reach went negative in ${month.month}`);
  }
});

test("a second run reuses completed months and only re-measures the month in progress", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  const coldCumulativeCalls = cumulativeCallCount();
  assert.equal(coldCumulativeCalls, delivering.length);

  reset();
  const second = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first });

  const partialCount = first.months.filter((month) => month.partial).length;
  assert.equal(cumulativeCallCount(), partialCount);
  assert.ok(cumulativeCallCount() < coldCumulativeCalls, "the warm run must cost fewer calls than the cold one");
  assert.deepEqual(second.months.map((month) => month.netNewReach), EXPECTED_NET_NEW);
});

test("adding an incremental campaign re-measures the whole curve", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  // Every cumulative figure is measured over a campaign set. Change the set and
  // the old numbers describe a different question, so none may be reused.
  reset({ campaignIds: ["1", "2", "3"] });
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first });
  assert.equal(cumulativeCallCount(), delivering.length);
});

test("force re-measures even when the cache is valid", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  reset();
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first, force: true });
  assert.equal(cumulativeCallCount(), delivering.length);
});

test("an account with no incrementality campaign reports why instead of throwing", async () => {
  calls.length = 0;
  responder = (params) => {
    if (params.level === "campaign") {
      return {
        data: [{
          campaign_id: "9",
          campaign_name: "Standard",
          attribution_setting: "1d_view_7d_click",
          spend: "500",
          impressions: "1000"
        }]
      };
    }
    return { data: [] };
  };

  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  assert.equal(snapshot.available, false);
  assert.match(snapshot.unavailableReason, /incrementality/i);
  assert.deepEqual(snapshot.months, []);
  assert.equal(cumulativeCallCount(), 0);
});

test("reusableCumulative refuses a cache from a different anchor or campaign set", () => {
  const previous = {
    anchor: "2026-01-01",
    campaignKey: "1,2",
    months: [
      { month: "2026-01", partial: false, cumulativeReach: 100 },
      { month: "2026-02", partial: true, cumulativeReach: 200 }
    ]
  };

  assert.equal(reusableCumulative(previous, "2026-01-01", "1,2").size, 1, "only completed months are reusable");
  assert.equal(reusableCumulative(previous, "2026-02-01", "1,2").size, 0);
  assert.equal(reusableCumulative(previous, "2026-01-01", "1,2,3").size, 0);
  assert.equal(reusableCumulative(null, "2026-01-01", "1,2").size, 0);
});
