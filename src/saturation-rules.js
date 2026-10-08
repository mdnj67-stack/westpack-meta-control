// The rules that turn an ad set's audience figures into a signal: room to grow,
// covered, saturating, saturated, or reaches without converting.
//
// One copy, used twice. The nightly job on the server classifies with it
// (server/meta/audience-saturation.js), and the Expansion tab runs the very same
// functions again in the browser when someone moves a threshold, so a line that
// is adjusted on screen can never drift from the one the server applied. That is
// why this file is neither CommonJS nor an ES module: it is a plain script that
// exports through `module.exports` where there is one (Node) and through
// `globalThis.WestpackSaturationRules` where there is not (a classic <script>
// tag in index.html).
//
// These are rules of thumb, not measured truths. Every threshold below is a
// judgement that has not been validated against an outcome, which is why each is
// printed beside the table, every status carries its reasons, and the lines can
// be moved. The figures they read are Meta's own and are measured correctly; the
// judgement on top of them is ours.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    root.WestpackSaturationRules = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_THRESHOLDS = {
    // Below this a period's figures are too thin to read anything from.
    minimumReach: 1000,
    minimumSpend: 500,
    // Share of the period's reach that is new to the ad set.
    saturatedNewShare: 0.25,
    saturatingNewShare: 0.4,
    // Movement against the previous period that marks an audience running out.
    newShareDrop: 0.1,
    // Measured after taking out the account's own CPM change, so a market getting
    // dearer for everyone (Q4) is not read as one audience running out.
    costPerThousandNewRise: 0.25,
    // The previous period counts as a launch when the ad set's reach in the whole
    // lookback before it was under this share of the period's own reach.
    launchReachShare: 0.5,
    // A defined audience reached this far inside one period is covered.
    saturatedAudienceShare: 0.8,
    // A conversion ad set that has spent this many times the account's cost per new
    // customer without one. At three, a zero is about a 5% chance if it performed
    // like the account (Poisson: e^-3).
    notConvertingCostMultiple: 3,
    // The team's own awareness goal: about five impressions per person per week.
    // It is their strategy, not an established law of advertising.
    awarenessWeeklyFrequencyTarget: 5,
    awarenessWeeklyFrequencyLow: 3,
    awarenessWeeklyFrequencyHigh: 8,
    // An ad set spending less than this share of its own daily budget is not
    // budget-limited, so more budget is not the lever.
    budgetUtilizationFloor: 0.9
  };

  // The thresholds someone may move on screen, with the bounds that keep them sane.
  const ADJUSTABLE = [
    { key: "saturatedNewShare", label: "Saturated under this share new", unit: "%", min: 5, max: 60, step: 5 },
    { key: "saturatingNewShare", label: "Saturating under this share new", unit: "%", min: 10, max: 80, step: 5 },
    { key: "newShareDrop", label: "Saturating if the new share falls by", unit: "pts", min: 5, max: 40, step: 5 },
    { key: "costPerThousandNewRise", label: "Saturating if new people cost more by", unit: "%", min: 10, max: 100, step: 5 },
    { key: "saturatedAudienceShare", label: "A fixed audience is covered at", unit: "%", min: 40, max: 100, step: 5 },
    { key: "awarenessWeeklyFrequencyTarget", label: "Awareness target, impressions a week", unit: "", min: 1, max: 10, step: 0.5 },
    { key: "notConvertingCostMultiple", label: "Not converting after this many times the account's cost per new customer", unit: "x", min: 2, max: 6, step: 0.5 }
  ];

  const STATUS_ORDER = ["saturated", "not_converting", "saturating", "covered", "room", "insufficient"];
  const STATUS_LABELS = {
    room: "Room to grow",
    covered: "Covered, room for frequency",
    saturating: "Saturating",
    saturated: "Saturated",
    not_converting: "Reaches, does not convert",
    insufficient: "Too little delivery"
  };

  function finite(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function pct(value) {
    return Math.round(Number(value) * 100);
  }

  function kr(value) {
    return `${Math.round(Number(value)).toLocaleString("en")} kr.`;
  }

  // Inverse of the standard normal CDF (Acklam's rational approximation), used
  // only for the chi-square quantiles of the Poisson interval below.
  function normalQuantile(p) {
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
    const low = 0.02425;
    if (p < low) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - low) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Chi-square quantile by the Wilson-Hilferty approximation.
  function chiSquareQuantile(p, degrees) {
    if (degrees <= 0) return 0;
    const z = normalQuantile(p);
    const term = 1 - 2 / (9 * degrees) + z * Math.sqrt(2 / (9 * degrees));
    return degrees * Math.pow(term, 3);
  }

  // A 95% interval for a count of events (Garwood). Five new customers is
  // consistent with anything from about 1.6 to 11.7: a cost per new customer
  // read off a single-digit count is a range, not a price.
  function poissonInterval(count) {
    const n = Math.max(0, Math.round(Number(count) || 0));
    const lower = n === 0 ? 0 : chiSquareQuantile(0.025, 2 * n) / 2;
    const upper = chiSquareQuantile(0.975, 2 * n + 2) / 2;
    return [Math.round(lower * 10) / 10, Math.round(upper * 10) / 10];
  }

  function describeFrequency(current, objectiveGroup, thresholds) {
    const t = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
    if (objectiveGroup !== "awareness" || !finite(current?.weeklyFrequency)) return null;
    const value = Number(current.weeklyFrequency);
    const target = t.awarenessWeeklyFrequencyTarget;
    if (value < Math.min(t.awarenessWeeklyFrequencyLow, target)) {
      return { tone: "low", text: `${value.toFixed(1)} a week, below the ${target}-a-week awareness target` };
    }
    if (value > Math.max(t.awarenessWeeklyFrequencyHigh, target)) {
      return { tone: "high", text: `${value.toFixed(1)} a week, well above the ${target}-a-week target` };
    }
    return { tone: "on", text: `${value.toFixed(1)} a week, around the ${target}-a-week target` };
  }

  // The status, the reasons behind it, and which measures set it.
  //
  // `row` carries the figures (current, previous, audience, delivery, objective
  // group); `context` the account-level ones (cost per new customer, CPM change,
  // period length). Order matters: too little delivery first, because nothing
  // else can be read from it; then awareness, which has its own job; then a
  // used-up audience; then not converting; then saturating.
  function classifyRow(row, context, thresholds) {
    const t = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
    const ctx = context || {};
    const days = Number(ctx.periodDays) || 14;
    const current = row?.current || {};
    const previous = row?.previous || null;
    const audience = row?.audience || {};
    const delivery = row?.delivery || {};
    const objectiveGroup = String(row?.objectiveGroup || "");
    const reasons = [];
    const notes = [];

    const done = (status, causes, extra) => ({
      status,
      statusLabel: STATUS_LABELS[status],
      reasons: reasons.concat(notes).filter(Boolean),
      causes: causes || [],
      comparable: false,
      previousWasLaunch: false,
      startedInPeriod: false,
      frequencyBudgetPerDay: null,
      limitedBy: null,
      uncertain: false,
      frequency: describeFrequency(current, objectiveGroup, t),
      ...(extra || {})
    });

    if (!(Number(current.reach) >= t.minimumReach) || !(Number(current.spend) >= t.minimumSpend)) {
      reasons.push(`Under ${t.minimumReach.toLocaleString("en")} people or ${t.minimumSpend} kr. in the last ${days} days.`);
      return done("insufficient");
    }

    const startedInPeriod = !previous || !(Number(previous.reach) > 0);
    // A launch is everyone-new by construction, so the next period always reads as
    // a fall. Against a launch only the current level is judged.
    const previousWasLaunch = Boolean(previous && Number(previous.reach) > 0
      && Number(previous.reachBefore) < Number(previous.reach) * t.launchReachShare);
    const comparable = Boolean(previous && !startedInPeriod && !previousWasLaunch
      && Number(previous.reach) >= t.minimumReach && finite(previous.newShare));
    const shared = { comparable, previousWasLaunch, startedInPeriod };

    const newShare = finite(current.newShare) ? Number(current.newShare) : null;
    const shareDrop = comparable && newShare != null ? Number(previous.newShare) - newShare : null;
    // The cost of new people, against the account's own CPM movement between the
    // same two periods, so a market that got dearer for everyone does not read as
    // one audience running out.
    const marketRatio = finite(ctx.accountCpmChange) ? 1 + Number(ctx.accountCpmChange) : 1;
    const rawCostRatio = comparable && finite(current.costPerThousandNew) && Number(previous.costPerThousandNew) > 0
      ? Number(current.costPerThousandNew) / Number(previous.costPerThousandNew)
      : null;
    const costRise = rawCostRatio != null && marketRatio > 0 ? rawCostRatio / marketRatio - 1 : null;

    const shareText = newShare == null ? "" : `${pct(newShare)}% of those reached were new to it`;
    const dropText = shareDrop != null && shareDrop >= t.newShareDrop
      ? `New share fell ${pct(shareDrop)} points on the ${days} days before`
      : "";
    const costText = costRise != null && costRise >= t.costPerThousandNewRise
      ? `New people cost ${pct(costRise)}% more per thousand than the ${days} days before${finite(ctx.accountCpmChange) ? `, after the account's own CPM change of ${pct(ctx.accountCpmChange) >= 0 ? "+" : ""}${pct(ctx.accountCpmChange)}%` : ""}`
      : "";

    // Only a bounded audience can be covered. Meta's size is a range; the rule reads
    // its midpoint and says so when the range straddles the line.
    const share = finite(audience.share) ? Number(audience.share) : null;
    const bounded = share != null && !audience.shareApproximate;
    const straddles = bounded && finite(audience.shareLow) && finite(audience.shareHigh)
      && Number(audience.shareLow) < t.saturatedAudienceShare && Number(audience.shareHigh) >= t.saturatedAudienceShare;
    const audienceText = bounded && share >= t.saturatedAudienceShare
      ? `Reached ${pct(share)}% of the audience in ${days} days${straddles ? ` (Meta's size estimate puts it between ${pct(audience.shareLow)}% and ${pct(audience.shareHigh)}%)` : ""}`
      : "";
    if (audience.shareApproximate && share != null && share > 1) {
      notes.push(`Reached ${(Math.round(share * 10) / 10).toFixed(1)}x the audience estimate: ${audience.advantageAudience ? "Advantage+ audience" : "lookalike expansion"} lets Meta go beyond it`);
    }

    // Whether budget is what limits delivery. Read over the last week against the
    // ad set's own daily budget; a campaign budget cannot be attributed to one ad set.
    const utilization = finite(delivery.budgetUtilization) ? Number(delivery.budgetUtilization) : null;
    const underspending = utilization != null && utilization < t.budgetUtilizationFloor;
    if (underspending) {
      notes.push(`Spent ${pct(utilization)}% of its daily budget over the last week, so budget is not what limits it`);
    }

    const movingWrong = Boolean(dropText || costText);
    const lowShare = newShare != null && newShare < t.saturatingNewShare;
    const trendCauses = [dropText ? "newShareTrend" : "", costText ? "costTrend" : ""].filter(Boolean);

    // Awareness is the opposite job: the same people again and again, about five
    // times a week. A covered audience and a low new share are the plan. It is only
    // saturated once covered AND at the target.
    const frequency = finite(current.weeklyFrequency) ? Number(current.weeklyFrequency) : null;
    if (objectiveGroup === "awareness" && frequency != null) {
      const target = t.awarenessWeeklyFrequencyTarget;
      const covered = Boolean(audienceText) || lowShare;
      const coverText = audienceText || shareText;
      const coverCause = audienceText ? "audience" : "newShare";
      if (covered && frequency >= target) {
        reasons.push(coverText, `${frequency.toFixed(1)} impressions per person a week, at or past the ${target}-a-week target: more budget only adds repetition beyond it`);
        return done("saturated", [coverCause, "frequency"], { ...shared, uncertain: straddles });
      }
      if (covered) {
        reasons.push(`${coverText}, at ${frequency.toFixed(1)} a week against the ${target}-a-week target`);
        const capPerWeek = finite(delivery.frequencyCapPerWeek) ? Number(delivery.frequencyCapPerWeek) : null;
        let limitedBy = "budget";
        let estimate = null;
        if (capPerWeek != null && capPerWeek < target) {
          limitedBy = "cap";
          reasons.push(`Its frequency cap allows only ${capPerWeek.toFixed(1)} a week, below the target: the cap has to go up before budget can help`);
        } else if (underspending) {
          limitedBy = "delivery";
          reasons.push(`More budget would not raise frequency while it does not spend what it has${delivery.optimizationGoal === "REACH" ? ". It is optimised for reach, so Meta favours new people over repetition" : ""}`);
        } else {
          estimate = Number(current.spend) > 0 ? (Number(current.spend) / days) * (target / frequency) : null;
          if (estimate) {
            reasons.push(`Reaching ${target} a week across the same people would take at least ${kr(estimate)} a day: an estimate at today's cost per impression, which usually rises as frequency is pushed`);
          }
        }
        return done("covered", ["frequency"], {
          ...shared,
          frequencyBudgetPerDay: estimate ? Math.round(estimate) : null,
          limitedBy,
          uncertain: straddles
        });
      }
      if (frequency < target) {
        reasons.push(startedInPeriod ? "Started in this period, so everyone is new" : shareText,
          `${frequency.toFixed(1)} a week against the ${target}-a-week target, so there is room for reach and repetition`);
        return done("room", [], shared);
      }
    }

    const saturated = Boolean(audienceText)
      || (newShare != null && newShare < t.saturatedNewShare)
      || (lowShare && movingWrong);
    if (saturated) {
      reasons.push(audienceText, shareText, dropText, costText);
      const causes = [
        audienceText ? "audience" : "",
        (newShare != null && newShare < t.saturatedNewShare) || (lowShare && movingWrong) ? "newShare" : "",
        ...trendCauses
      ].filter(Boolean);
      return done("saturated", causes, { ...shared, uncertain: straddles && !(newShare != null && newShare < t.saturatedNewShare) });
    }

    const notConvertingSpend = Number(ctx.accountCostPerNewCustomer) > 0
      ? Number(ctx.accountCostPerNewCustomer) * t.notConvertingCostMultiple
      : null;
    if (objectiveGroup === "conversion" && notConvertingSpend != null && finite(current.newCustomers)
      && Number(current.newCustomers) < 1 && Number(current.spend) >= notConvertingSpend) {
      reasons.push(`${kr(current.spend)} spent and no new customer in the last ${days} days, over ${t.notConvertingCostMultiple}x the account's cost per new customer`);
      if (shareText) reasons.push(`${shareText}, so reach is not the limit`);
      return done("not_converting", ["customers"], shared);
    }

    if (movingWrong || lowShare) {
      reasons.push(shareText, dropText, costText);
      if (previousWasLaunch) reasons.push(`The ${days} days before were its launch, so it is judged on level only`);
      return done("saturating", [lowShare ? "newShare" : "", ...trendCauses].filter(Boolean), shared);
    }

    if (startedInPeriod) {
      reasons.push(`Started in this period, so everyone is new. A trend shows after the next ${days} days`);
      return done("room", [], shared);
    }
    reasons.push(shareText);
    if (previousWasLaunch) {
      reasons.push(`The ${days} days before were its launch (everyone new), so it is judged on level only`);
    } else if (!comparable) {
      reasons.push(`Too little delivery in the previous ${days} days to compare against`);
    }
    return done("room", [], shared);
  }

  function sortRows(rows) {
    return rows.slice().sort((left, right) => {
      const byStatus = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status);
      return byStatus || Number(right.current?.spend || 0) - Number(left.current?.spend || 0);
    });
  }

  function countStatuses(rows) {
    const counts = {};
    for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }

  return {
    ADJUSTABLE,
    DEFAULT_THRESHOLDS,
    STATUS_LABELS,
    STATUS_ORDER,
    classifyRow,
    countStatuses,
    describeFrequency,
    poissonInterval,
    sortRows
  };
});
