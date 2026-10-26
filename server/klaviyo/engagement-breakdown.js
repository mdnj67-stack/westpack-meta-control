// Who reads Westpack's emails, and on what. Klaviyo records the client behind every open and click
// (Client Type, Client Name, Inbox Provider, ...) and its metric-aggregates endpoint groups them in a
// single request, so a design rule like "mobile first" can be checked against the list instead of
// assumed. The same grouping by URL is how a click vote (utm_content tags) is counted. Read-only.

const BREAKDOWN_METRICS = ["Opened Email", "Clicked Email"];
const BREAKDOWN_DIMENSIONS = ["Client Type", "Client Name", "Client OS Family", "Client Canonical", "Inbox Provider", "URL", "$message"];
const MAX_BREAKDOWN_DAYS = 365;

function formatKlaviyoDate(date) {
  return date.toISOString().slice(0, 19);
}

function resolveBreakdownQuery(query = {}) {
  const metric = String(query.metric || "Clicked Email").trim();
  const by = String(query.by || "Client Type").trim();
  const days = Math.max(1, Math.min(MAX_BREAKDOWN_DAYS, Math.floor(Number(query.days || 90)) || 90));
  if (!BREAKDOWN_METRICS.includes(metric)) {
    return { error: `metric must be one of: ${BREAKDOWN_METRICS.join(", ")}.` };
  }
  if (!BREAKDOWN_DIMENSIONS.includes(by)) {
    return { error: `by must be one of: ${BREAKDOWN_DIMENSIONS.join(", ")}.` };
  }
  return { metric, by, days };
}

function buildBreakdownRequestBody({ metricId, by, days, now = new Date() }) {
  const end = new Date(now);
  const start = new Date(end.getTime() - days * 86_400_000);
  return {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: metricId,
        measurements: ["count"],
        interval: "month",
        by: [by],
        page_size: 500,
        filter: [`greater-or-equal(datetime,${formatKlaviyoDate(start)})`, `less-than(datetime,${formatKlaviyoDate(end)})`],
        timezone: "Europe/Copenhagen"
      }
    }
  };
}

// Klaviyo returns one count per interval for each dimension value; the period total is their sum.
// Counts are events, not people: one reader who clicks three links counts three times.
function summarizeBreakdown(payload) {
  const groups = Array.isArray(payload?.data?.attributes?.data) ? payload.data.attributes.data : [];
  const rows = groups.map((group) => ({
    value: String(Array.isArray(group?.dimensions) && group.dimensions[0] != null && group.dimensions[0] !== "" ? group.dimensions[0] : "(not recorded)"),
    count: (Array.isArray(group?.measurements?.count) ? group.measurements.count : []).reduce((sum, value) => sum + (Number(value) || 0), 0)
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    total,
    rows: rows
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count)
      .map((row) => ({ ...row, share: total ? row.count / total : 0 }))
  };
}

function findKlaviyoMetricId(metrics = [], name) {
  const match = (Array.isArray(metrics) ? metrics : []).find((metric) =>
    metric?.attributes?.name === name
    && String(metric?.attributes?.integration?.key || metric?.attributes?.integration?.name || "").toLowerCase() === "klaviyo");
  return match?.id || "";
}

module.exports = {
  BREAKDOWN_DIMENSIONS,
  BREAKDOWN_METRICS,
  buildBreakdownRequestBody,
  findKlaviyoMetricId,
  resolveBreakdownQuery,
  summarizeBreakdown
};
