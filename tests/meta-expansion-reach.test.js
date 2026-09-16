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
  return responder(params, pathname);
};

const {
  syncExpansionReach,
  buildMonths,
  todayInAccountTimeZone,
  reusableCumulative,
  previousMonthElapsedWindow,
  collectRestatements,
  countryLabel
} = require("../server/meta/expansion-reach");

const ACCOUNT = "act_123";
const TOKEN = "token";
const NEW_CUSTOMER_ACTION = "offsite_conversion.custom.111";

const months = buildMonths(todayInAccountTimeZone(), 12);
const delivering = months.slice(-4);

// Cumulative rises every month; monthly reach is larger than the month's net-new
// from the second month on, so there is a real repeat share to assert against.
const CUMULATIVE = [100000, 180000, 240000, 300000];
const CUMULATIVE_SPEND = [12000, 36000, 72000, 120000];
const MONTHLY = [100000, 100000, 90000, 95000];
const EXPECTED_NET_NEW = [100000, 80000, 60000, 60000];
const EXPECTED_REPEAT = [0, 20000, 30000, 35000];
const MONTHLY_NEW_CUSTOMERS = [10, 20, 30, 40];

// Two markets, so the country split has something to divide. IT carries most of
// the reach; DE only starts delivering in the third month, which is the shape
// the real account has after a market rebuild.
const COUNTRY_CUMULATIVE = {
  IT: [70000, 120000, 150000, 180000],
  DE: [0, 0, 60000, 100000]
};
const COUNTRY_MONTHLY = {
  IT: [70000, 60000, 55000, 55000],
  DE: [0, 0, 60000, 50000]
};

// The like-for-like point: the same elapsed stretch of the previous month.
const LIKE_FOR_LIKE_CUMULATIVE = 210000;
const LIKE_FOR_LIKE_SPEND = 60000;
// Spend and customers over the elapsed window are read directly, not derived
// from two cumulative points, so the stub answers that window on its own.
const LIKE_FOR_LIKE_WINDOW_SPEND = 24000;
const LIKE_FOR_LIKE_WINDOW_CUSTOMERS = 15;
const LIKE_FOR_LIKE_COUNTRIES = { IT: 135000, DE: 70000 };

const lastMonth = delivering[delivering.length - 1];
const likeForLikeWindow = previousMonthElapsedWindow({ key: lastMonth.key, until: lastMonth.until });

function isCumulativeCall(params) {
  return params.level === "account" && !params.time_increment && params.filtering;
}

function buildResponder({ campaignIds = ["1", "2"], withCustomConversion = true } = {}) {
  return (params, pathname = "") => {
    if (String(pathname).includes("customconversions")) {
      return {
        data: withCustomConversion
          ? [{ id: "111", name: "New_customer", is_archived: false }]
          : []
      };
    }

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
      if (params.breakdowns === "country") {
        const rows = [];
        delivering.forEach((month, index) => {
          for (const code of Object.keys(COUNTRY_MONTHLY)) {
            rows.push({
              date_start: month.since,
              date_stop: month.until,
              country: code,
              reach: String(COUNTRY_MONTHLY[code][index]),
              impressions: String(COUNTRY_MONTHLY[code][index] * 4),
              frequency: "4",
              spend: String(1000 * (index + 1)),
              actions: [{ action_type: NEW_CUSTOMER_ACTION, value: "5" }],
              action_values: [
                { action_type: "purchase", value: "4000" },
                { action_type: "offsite_conversion.fb_pixel_purchase", value: "4000" },
                { action_type: "omni_purchase", value: "4000" },
                { action_type: NEW_CUSTOMER_ACTION, value: "900" }
              ]
            });
          }
        });
        return { data: rows };
      }
      return {
        data: delivering.map((month, index) => ({
          date_start: month.since,
          date_stop: month.until,
          reach: String(MONTHLY[index]),
          impressions: String(MONTHLY[index] * 4),
          frequency: "4",
          spend: String(12000 * (index + 1)),
          actions: [{ action_type: NEW_CUSTOMER_ACTION, value: String(MONTHLY_NEW_CUSTOMERS[index]) }],
          action_values: [
            { action_type: "purchase", value: "30000" },
            { action_type: "omni_purchase", value: "30000" },
            { action_type: NEW_CUSTOMER_ACTION, value: "5000" }
          ]
        }))
      };
    }

    // Cumulative: keyed by the window end, which is the month's last day, or the
    // like-for-like date inside the previous month.
    const range = JSON.parse(params.time_range);
    if (range.until === likeForLikeWindow.until && range.since === likeForLikeWindow.since) {
      // The plain window: the same elapsed days of the previous month.
      return {
        data: [{
          spend: String(LIKE_FOR_LIKE_WINDOW_SPEND),
          impressions: "40000",
          actions: [{ action_type: NEW_CUSTOMER_ACTION, value: String(LIKE_FOR_LIKE_WINDOW_CUSTOMERS) }]
        }]
      };
    }
    if (range.until === likeForLikeWindow.until) {
      if (params.breakdowns === "country") {
        return {
          data: Object.entries(LIKE_FOR_LIKE_COUNTRIES)
            .map(([code, reach]) => ({ country: code, reach: String(reach), spend: "0" }))
        };
      }
      return { data: [{ reach: String(LIKE_FOR_LIKE_CUMULATIVE), spend: String(LIKE_FOR_LIKE_SPEND) }] };
    }

    const index = delivering.findIndex((month) => month.until === range.until);
    if (params.breakdowns === "country") {
      return {
        data: Object.keys(COUNTRY_CUMULATIVE).map((code) => ({
          country: code,
          reach: String(index >= 0 ? COUNTRY_CUMULATIVE[code][index] : 0),
          spend: "0"
        }))
      };
    }
    return {
      data: [{
        reach: String(index >= 0 ? CUMULATIVE[index] : 0),
        spend: String(index >= 0 ? CUMULATIVE_SPEND[index] : 0)
      }]
    };
  };
}

function reset(options) {
  calls.length = 0;
  responder = buildResponder(options);
}

function cumulativeCallCount() {
  return calls.filter((call) => isCumulativeCall(call.params) && !call.params.breakdowns).length;
}

function monthCurveCallCount() {
  return calls.filter((call) => {
    if (!isCumulativeCall(call.params) || call.params.breakdowns) return false;
    return JSON.parse(call.params.time_range).until !== likeForLikeWindow.until;
  }).length;
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
  // Cumulative for the last month comes back higher than monthly reach allows,
  // which would make monthly minus net-new go negative.
  responder = (params, pathname) => {
    if (isCumulativeCall(params) && !params.breakdowns) {
      const range = JSON.parse(params.time_range);
      if (range.until === delivering[delivering.length - 1].until) {
        return { data: [{ reach: "999999", spend: "120000" }] };
      }
    }
    return base(params, pathname);
  };

  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  for (const month of snapshot.months) {
    assert.ok(month.repeatReach >= 0, `repeat reach went negative in ${month.month}`);
  }
});

test("a cumulative window that shrinks is clamped to zero and flagged, never shown negative", async () => {
  calls.length = 0;
  const base = buildResponder();
  // Meta restates the last cumulative window downward, below the month before
  // it. The difference is negative, which is an artefact rather than a fact.
  responder = (params, pathname) => {
    if (isCumulativeCall(params) && !params.breakdowns) {
      const range = JSON.parse(params.time_range);
      if (range.until === delivering[delivering.length - 1].until) {
        return { data: [{ reach: "200000", spend: "120000" }] };
      }
    }
    return base(params, pathname);
  };

  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  const last = snapshot.months[snapshot.months.length - 1];
  assert.equal(last.netNewReach, 0);
  assert.equal(last.cumulativeRestated, true);
  assert.ok(last.repeatShare <= 1, "repeat share must never exceed the whole month");
});

test("a second run reuses completed months and only re-measures the month in progress", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  const coldCurveCalls = monthCurveCallCount();
  assert.equal(coldCurveCalls, delivering.length);

  reset();
  const second = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first });

  const partialCount = first.months.filter((month) => month.partial).length;
  assert.equal(monthCurveCallCount(), partialCount);
  assert.ok(monthCurveCallCount() < coldCurveCalls, "the warm run must cost fewer calls than the cold one");
  assert.deepEqual(second.months.map((month) => month.netNewReach), EXPECTED_NET_NEW);
});

test("the like-for-like point is measured once and then reused", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  assert.equal(first.likeForLike.fromCache, false);

  reset();
  const second = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first });
  assert.equal(second.likeForLike.fromCache, true);
  const likeForLikeCalls = calls.filter((call) => {
    if (!isCumulativeCall(call.params)) return false;
    return JSON.parse(call.params.time_range).until === likeForLikeWindow.until;
  });
  assert.equal(likeForLikeCalls.length, 0, "a closed like-for-like window must never be measured twice");
});

test("adding an incremental campaign re-measures the whole curve", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  // Every cumulative figure is measured over a campaign set. Change the set and
  // the old numbers describe a different question, so none may be reused.
  reset({ campaignIds: ["1", "2", "3"] });
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first });
  assert.equal(monthCurveCallCount(), delivering.length);
});

test("force re-measures even when the cache is valid", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  reset();
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first, force: true });
  assert.equal(monthCurveCallCount(), delivering.length);
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
      { month: "2026-01", partial: false, cumulativeReach: 100, cumulativeByCountry: { IT: { reach: 60 } } },
      { month: "2026-02", partial: true, cumulativeReach: 200, cumulativeByCountry: { IT: { reach: 120 } } }
    ]
  };

  assert.equal(reusableCumulative(previous, "2026-01-01", "1,2").size, 1, "only completed months are reusable");
  assert.equal(reusableCumulative(previous, "2026-02-01", "1,2").size, 0);
  assert.equal(reusableCumulative(previous, "2026-01-01", "1,2,3").size, 0);
  assert.equal(reusableCumulative(null, "2026-01-01", "1,2").size, 0);
});

test("a month cached without its country map is measured again rather than half-drawn", () => {
  const previous = {
    anchor: "2026-01-01",
    campaignKey: "1,2",
    months: [{ month: "2026-01", partial: false, cumulativeReach: 100 }]
  };
  assert.equal(reusableCumulative(previous, "2026-01-01", "1,2").size, 0);
});

// --- Markets -------------------------------------------------------------

test("markets come from the country breakdown and are never summed into the total", async () => {
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  const italy = snapshot.marketSeries.find((market) => market.code === "IT");
  const germany = snapshot.marketSeries.find((market) => market.code === "DE");
  assert.ok(italy, "Italy must appear in the market series");
  assert.ok(germany, "Germany must appear in the market series");

  // Each market's net-new is its own cumulative curve, differenced.
  assert.deepEqual(italy.months.map((month) => month.netNewReach), [70000, 50000, 30000, 30000]);
  assert.deepEqual(germany.months.map((month) => month.netNewReach), [0, 0, 60000, 40000]);

  // A market that only starts later reports when it started rather than
  // pretending it was flat before.
  assert.equal(germany.firstMonth, delivering[2].key);
  assert.equal(germany.deliveringMonths, 2);

  // The account total is never replaced by the sum of the markets.
  const last = snapshot.months[snapshot.months.length - 1];
  assert.equal(last.monthlyReach, MONTHLY[MONTHLY.length - 1]);
  assert.equal(last.marketReachSum, COUNTRY_MONTHLY.IT[3] + COUNTRY_MONTHLY.DE[3]);
  assert.ok(last.marketOverlapShare !== null, "the gap between the markets and the total must be reported");
});

test("the market split costs no call per market", async () => {
  reset();
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  const countryCalls = calls.filter((call) => call.params.breakdowns === "country" && call.params.level === "account").length;
  // One monthly breakdown, plus one cumulative breakdown per month on the curve,
  // plus the like-for-like point. Never one per country.
  assert.equal(countryCalls, 1 + delivering.length + 1);

  // The ad-level drill-down is one more read over the whole window, not one per
  // market either.
  const adCalls = calls.filter((call) => call.params.level === "ad").length;
  assert.equal(adCalls, 1);
});

test("the markets carry new customers beside the newly reached", async () => {
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  assert.equal(snapshot.customerConversion.available, true);
  const last = snapshot.months[snapshot.months.length - 1];
  assert.equal(last.newCustomers, MONTHLY_NEW_CUSTOMERS[MONTHLY_NEW_CUSTOMERS.length - 1]);
  assert.equal(last.newCustomersPerThousandNewlyReached, Math.round((40 / 60000) * 1000 * 1000) / 1000);

  const italy = snapshot.marketSeries.find((market) => market.code === "IT");
  assert.equal(italy.latestNewCustomers, 5);
});

test("an account without the New_customer conversion says so instead of reporting zero", async () => {
  reset({ withCustomConversion: false });
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  assert.equal(snapshot.customerConversion.available, false);
  assert.match(snapshot.customerConversion.unavailableReason, /New_customer/);
  for (const month of snapshot.months) {
    assert.equal(month.newCustomers, null, "no conversion means no count, not a count of zero");
    assert.equal(month.newCustomersPerThousandNewlyReached, null);
  }
});

// --- Like-for-like -------------------------------------------------------

test("a part month is compared against the same elapsed days of the month before", async () => {
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  const likeForLike = snapshot.likeForLike;
  assert.ok(likeForLike, "a part month must carry a like-for-like baseline");
  assert.equal(likeForLike.month, likeForLikeWindow.month);
  assert.equal(likeForLike.until, likeForLikeWindow.until);
  assert.equal(likeForLike.elapsedDays, likeForLikeWindow.elapsedDays);

  // Net-new over the same elapsed days: the like-for-like cumulative point minus
  // the last complete month before it.
  assert.equal(likeForLike.netNewReach, LIKE_FOR_LIKE_CUMULATIVE - CUMULATIVE[1]);
  assert.equal(likeForLike.spend, LIKE_FOR_LIKE_WINDOW_SPEND);
  assert.equal(likeForLike.newCustomers, LIKE_FOR_LIKE_WINDOW_CUSTOMERS);
  assert.equal(likeForLike.comparison.comparable, true);
  assert.equal(likeForLike.comparison.elapsedDays, snapshot.months[snapshot.months.length - 1].days);
});

test("a market with no delivery in the baseline window is not given a percentage", async () => {
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  // Germany only starts in the third month, so the like-for-like window for it
  // is measured but the comparison has to be readable as "new market".
  assert.ok(snapshot.likeForLike.markets.DE);
  assert.equal(typeof snapshot.likeForLike.markets.DE.netNewReach, "number");
});

test("previousMonthElapsedWindow clamps to a short month and says that it did", () => {
  const window = previousMonthElapsedWindow({ key: "2026-03", until: "2026-03-31" });
  assert.equal(window.month, "2026-02");
  assert.equal(window.until, "2026-02-28");
  assert.equal(window.clamped, true);
  assert.equal(window.requestedDays, 31);

  const january = previousMonthElapsedWindow({ key: "2026-01", until: "2026-01-15" });
  assert.equal(january.month, "2025-12");
  assert.equal(january.until, "2025-12-15");
  assert.equal(january.clamped, false);
});

// --- Restatements --------------------------------------------------------

test("a completed month that changes between runs is recorded with both figures", () => {
  const previous = {
    months: [
      { month: "2026-07", partial: false, netNewReach: 342550 },
      { month: "2026-08", partial: false, netNewReach: 309186 }
    ],
    restatements: []
  };
  const rows = [
    { month: "2026-07", partial: false, netNewReach: 342550 },
    { month: "2026-08", partial: false, netNewReach: 401000 }
  ];

  const log = collectRestatements(previous, rows, "Three campaigns joined the incremental set.");
  assert.equal(log.length, 1);
  assert.equal(log[0].month, "2026-08");
  assert.equal(log[0].from, 309186);
  assert.equal(log[0].to, 401000);
  assert.match(log[0].reason, /joined/);
});

test("the month in progress is never logged as a restatement", () => {
  const previous = {
    months: [{ month: "2026-09", partial: true, netNewReach: 700000 }],
    restatements: []
  };
  const rows = [{ month: "2026-09", partial: true, netNewReach: 750153 }];
  assert.deepEqual(collectRestatements(previous, rows, ""), []);
});

test("restatements from earlier runs are carried forward", () => {
  const previous = {
    months: [{ month: "2026-08", partial: false, netNewReach: 309186 }],
    restatements: [{ month: "2026-05", metric: "netNewReach", from: 1, to: 2 }]
  };
  const rows = [{ month: "2026-08", partial: false, netNewReach: 309186 }];
  const log = collectRestatements(previous, rows, "");
  assert.equal(log.length, 1);
  assert.equal(log[0].month, "2026-05");
});

test("a breakdown key is never asked for in the fields param", async () => {
  // Graph v25 rejects `country` in `fields` outright when it is also the
  // breakdown: the field list describes metrics, the breakdown describes how
  // they are cut. Asking for both failed the whole sync against the live
  // account, and it failed on the first country call, after the calls before it
  // had already been spent.
  reset();
  await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  const breakdownCalls = calls.filter((call) => call.params.breakdowns);
  assert.ok(breakdownCalls.length > 0, "the market split must actually ask for a breakdown");
  for (const call of breakdownCalls) {
    const fields = String(call.params.fields || "").split(",").map((field) => field.trim());
    assert.ok(
      !fields.includes(call.params.breakdowns),
      `${call.params.breakdowns} must not appear in fields alongside breakdowns=${call.params.breakdowns}`
    );
  }
});

test("new customers are compared over the same elapsed days, not month against month", () => {
  // Setting a part month's customers against a whole previous month understates
  // it twice over: fewer days, and a person first reached two days ago has had
  // two days to buy. September read 30 against August's 70 and looked like a
  // collapse; the same sixteen days is the comparison that holds.
  return syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN }).then((snapshot) => {
    const comparison = snapshot.likeForLike.comparison;
    assert.equal(comparison.newCustomers, MONTHLY_NEW_CUSTOMERS[MONTHLY_NEW_CUSTOMERS.length - 1]);
    assert.equal(comparison.customersComparable, true);
    assert.equal(
      comparison.newCustomersChange,
      Math.round(((40 - LIKE_FOR_LIKE_WINDOW_CUSTOMERS) / LIKE_FOR_LIKE_WINDOW_CUSTOMERS) * 10000) / 10000
    );
    assert.equal(snapshot.likeForLike.costPerNewCustomer, LIKE_FOR_LIKE_WINDOW_SPEND / LIKE_FOR_LIKE_WINDOW_CUSTOMERS);
  });
});

test("a baseline with no customers is given no percentage", async () => {
  // Zero is not a baseline to divide by, and a month where customers could not
  // be counted at all is not a month with none.
  reset({ withCustomConversion: false });
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  assert.equal(snapshot.likeForLike.newCustomers, null);
  assert.equal(snapshot.likeForLike.comparison.customersComparable, false);
  assert.equal(snapshot.likeForLike.comparison.newCustomersChange, null);
});

test("the elapsed window is measured once and then reused with its customers", async () => {
  reset();
  const first = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  reset();
  const second = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN, previous: first });
  assert.equal(second.likeForLike.fromCache, true);
  assert.equal(second.likeForLike.newCustomers, LIKE_FOR_LIKE_WINDOW_CUSTOMERS);
  const windowCalls = calls.filter((call) => {
    if (call.params.level !== "account" || call.params.time_increment) return false;
    return JSON.parse(call.params.time_range).until === likeForLikeWindow.until;
  });
  assert.equal(windowCalls.length, 0, "a closed window must never be measured twice");
});

test("revenue is the first purchase action value, never the sum of its aliases", async () => {
  // Meta reports the same purchase money under several action types at once. On
  // the live account, purchase, fb_pixel_purchase and omni_purchase all carried
  // an identical value on every country row - summing them would have trebled
  // every market's revenue and its ROAS with it.
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });

  const italy = snapshot.marketSeries.find((market) => market.code === "IT");
  const latestMonth = italy.months[italy.months.length - 1];
  assert.equal(latestMonth.revenue, 4000, "revenue was summed across the aliases");
  assert.equal(latestMonth.roas, Math.round((4000 / latestMonth.spend) * 1000) / 1000);

  const accountMonth = snapshot.months[snapshot.months.length - 1];
  assert.equal(accountMonth.revenue, 30000);
});

test("a market can be read over three windows, and reach is never summed across them", async () => {
  // A single part month is a thin basis for moving budget. Spend, revenue and
  // customers add up across months; reach does not, so a window's first-time
  // reach is the rise in that market's cumulative curve across it.
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  const italy = snapshot.marketSeries.find((market) => market.code === "IT");

  assert.ok(italy.windows.current && italy.windows.quarter && italy.windows.all);
  assert.equal(italy.windows.current.monthCount, 1);
  assert.equal(italy.windows.all.monthCount, italy.months.length);

  // Over everything since the anchor, first-time reach is simply the market's
  // own cumulative total - every one of those people was new at some point.
  assert.equal(italy.windows.all.netNewReach, italy.cumulativeReach);

  // Spend adds up; the window figure is the sum of its months.
  const quarterMonths = italy.months.slice(-3);
  assert.equal(
    italy.windows.quarter.spend,
    Math.round(quarterMonths.reduce((total, month) => total + month.spend, 0) * 100) / 100
  );

  // Frequency and repeat share are ratios over a deduplicated reach figure and
  // cannot be averaged, so a multi-month window reports its last month's.
  assert.equal(italy.windows.quarter.latestFrequency, quarterMonths[quarterMonths.length - 1].frequency);
});

test("a window carries no field that collides with the market it describes", async () => {
  // The window is merged onto the market row for rendering, so a field the two
  // share silently replaces the market's. A count named "months" replaced the
  // market's months series and the whole tab stopped rendering - caught only by
  // opening the page, because every unit test still passed.
  reset();
  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  const market = snapshot.marketSeries[0];
  const marketKeys = new Set(Object.keys(market));

  // A window deliberately overrides the market's own scalar totals - that is
  // the point of choosing a window. What it must never do is replace a
  // structure with a scalar: the count named "months" landed on top of the
  // market's months series and the sparkline had nothing left to draw.
  for (const [name, windowRow] of Object.entries(market.windows)) {
    if (!windowRow) continue;
    for (const key of Object.keys(windowRow)) {
      if (!marketKeys.has(key)) continue;
      const marketValue = market[key];
      const isStructure = Array.isArray(marketValue) || (marketValue && typeof marketValue === "object");
      assert.ok(
        !isStructure,
        `window "${name}" would replace the market's "${key}" structure with a plain value`
      );
    }
  }
});

test("a return on spend is not reported when there is no spend to divide by", async () => {
  // Meta placed 0,33 kr. of delivery in no country at all and attributed
  // 7.482 kr. of revenue to it. That is a ROAS of 22.670 and, sorted by return,
  // the best market on the account.
  calls.length = 0;
  const base = buildResponder();
  responder = (params, pathname) => {
    if (params.time_increment === "monthly" && params.breakdowns === "country") {
      const rows = base(params, pathname).data;
      // One country with revenue and effectively no spend at all.
      for (const row of rows) {
        if (row.country === "DE") {
          row.spend = "0.33";
          row.action_values = [{ action_type: "omni_purchase", value: "7481.5" }];
        }
      }
      return { data: rows };
    }
    return base(params, pathname);
  };

  const snapshot = await syncExpansionReach({ accountId: ACCOUNT, accessToken: TOKEN });
  const germany = snapshot.marketSeries.find((market) => market.code === "DE");
  const latest = germany.months[germany.months.length - 1];

  assert.equal(latest.spend, 0.33, "the spend itself is still reported");
  assert.equal(latest.revenue, 7481.5, "so is the revenue");
  assert.equal(latest.roas, null, "but the ratio between them is not");
  assert.equal(germany.windows.current.roas, null);
});

test("delivery Meta could not place is labelled, not passed off as a country", () => {
  // The country code UNKNOWN is real spend that Meta could not attribute to a
  // market. It stays in the table - unplaced spend has to stay visible - but it
  // is not somewhere budget can be moved to.
  assert.equal(countryLabel("UNKNOWN"), "Unattributed delivery");
  assert.equal(countryLabel("XX"), "Unattributed delivery");
  assert.equal(countryLabel("IT"), "Italy");
});
