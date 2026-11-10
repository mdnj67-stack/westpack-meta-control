// Keeps this month's new-customer trend where the office TV can read it without a Graph call.
//
// The dashboard snapshot lives only in each function instance's memory, so the TV would otherwise
// have to build one of its own (13-16 Graph calls) to learn a figure the dashboard already computed.
// Instead the snapshot route hands every freshly built snapshot to `recordTvMetaAcquisition`, which
// stores the month-to-date part of `dashboard.quality.customerAcquisition.trend` in
// tv/meta-acquisition.json. The trend does not depend on the dashboard's date range, so a build for
// any range will do.
//
// It must never cost the dashboard anything: it never throws, and it stops waiting after five seconds.

const { writeTvMetaAcquisition } = require("../meta/historical-store");

const TV_META_WRITE_TIMEOUT_MS = 5000;

function buildTvMetaAcquisitionDoc(payload, now = new Date()) {
  const trend = payload?.dashboard?.quality?.customerAcquisition?.trend;
  if (!trend || trend.available !== true) return null;
  // `windows` holds every panel preset and `dailySeries` the whole fetched span; the TV reads the
  // month-to-date comparison only.
  const { windows, dailySeries, ...monthToDate } = trend;
  return {
    version: 1,
    writtenAt: now.toISOString(),
    snapshotGeneratedAt: String(payload?.generatedAt || ""),
    currency: String(payload?.account?.currency || payload?.dashboard?.currency || "DKK"),
    trend: monthToDate
  };
}

async function recordTvMetaAcquisition(payload, {
  write = writeTvMetaAcquisition,
  timeoutMs = TV_META_WRITE_TIMEOUT_MS,
  now = new Date()
} = {}) {
  let timer;
  try {
    const doc = buildTvMetaAcquisitionDoc(payload, now);
    if (!doc) return { written: false, reason: "The new-customer trend is not available in this snapshot." };
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    // Promise.race subscribes to both, so a write that fails after the timeout is still handled.
    const outcome = await Promise.race([Promise.resolve().then(() => write(doc)).then(() => "written"), timeout]);
    return outcome === "written"
      ? { written: true }
      : { written: false, reason: `The write did not finish within ${timeoutMs} ms.` };
  } catch (error) {
    return { written: false, reason: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  TV_META_WRITE_TIMEOUT_MS,
  buildTvMetaAcquisitionDoc,
  recordTvMetaAcquisition
};
