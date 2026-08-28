function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function splitAggregateSeries(series = []) {
  if (!Array.isArray(series) || !series.length) {
    return { previous: [], current: [] };
  }

  const midpoint = Math.max(1, Math.floor(series.length / 2));
  return {
    previous: series.slice(0, midpoint),
    current: series.slice(midpoint)
  };
}

export function sumAggregateMetric(series = [], key) {
  return (series || []).reduce((sum, point) => sum + toFiniteNumber(point?.[key]), 0);
}

export function computeAggregateMetric(series = [], metric) {
  const spend = sumAggregateMetric(series, "spend");
  const impressions = sumAggregateMetric(series, "impressions");
  const clicks = sumAggregateMetric(series, "clicks");
  const addToCart = sumAggregateMetric(series, "add_to_cart");
  const purchases = sumAggregateMetric(series, "purchases");
  const revenue = sumAggregateMetric(series, "revenue");
  const leads = sumAggregateMetric(series, "leads");

  if (metric === "spend") return spend;
  if (metric === "revenue") return revenue;
  if (metric === "clicks") return clicks;
  if (metric === "add_to_cart") return addToCart;
  if (metric === "ctr") return impressions > 0 ? (clicks / impressions) * 100 : 0;
  if (metric === "conversion_rate") return clicks > 0 ? (purchases / clicks) * 100 : 0;
  if (metric === "cost_per_add_to_cart") return addToCart > 0 ? spend / addToCart : 0;
  if (metric === "cpm") return impressions > 0 ? (spend / impressions) * 1000 : 0;
  if (metric === "leads") return leads;
  if (metric === "cpl") return leads > 0 ? spend / leads : 0;
  if (metric === "purchases") return purchases;
  if (metric === "cpa") return purchases > 0 ? spend / purchases : 0;
  if (metric === "roas") return spend > 0 ? revenue / spend : 0;
  return 0;
}

export function formatDashboardComparisonWindowLabel(days = 0) {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 0;
  if (!safeDays) {
    return "period";
  }
  if (safeDays === 1) {
    return "day";
  }
  return `${safeDays} days`;
}

export function buildDashboardChangeLabel(direction = "flat", windowLabel = "selected period") {
  if (direction === "new") return `new vs previous ${windowLabel}`;
  return `vs previous ${windowLabel}`;
}

export function getWindowChangeSummary(series = [], metric, options = {}) {
  const { previous, current } = splitAggregateSeries(series);
  const windowLabel = options.windowLabel || formatDashboardComparisonWindowLabel(options.windowDays);
  if (!previous.length && !current.length) {
    return null;
  }

  const previousValue = computeAggregateMetric(previous, metric);
  const currentValue = computeAggregateMetric(current, metric);
  if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
    return null;
  }

  if (previousValue <= 0 && currentValue <= 0) {
    return {
      value: "0.0%",
      percentChange: 0,
      tone: "neutral",
      label: buildDashboardChangeLabel("flat", windowLabel),
      direction: "flat",
      currentValue,
      previousValue
    };
  }

  if (previousValue <= 0 && currentValue > 0) {
    return {
      value: "New",
      percentChange: null,
      tone: options.positiveDirection === "down" ? "negative" : "positive",
      label: buildDashboardChangeLabel("new", windowLabel),
      direction: "new",
      currentValue,
      previousValue
    };
  }

  const change = ((currentValue - previousValue) / Math.max(Math.abs(previousValue), 1)) * 100;
  const isPositive = options.positiveDirection === "down" ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 0.1;

  return {
    value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
    percentChange: change,
    tone: isNeutral ? "neutral" : (isPositive ? "positive" : "negative"),
    label: buildDashboardChangeLabel(isNeutral ? "flat" : (change > 0 ? "up" : "down"), windowLabel),
    direction: isNeutral ? "flat" : (change > 0 ? "up" : "down"),
    currentValue,
    previousValue
  };
}

export function buildWindowChange(series = [], metric, options = {}) {
  return getWindowChangeSummary(series, metric, options);
}
