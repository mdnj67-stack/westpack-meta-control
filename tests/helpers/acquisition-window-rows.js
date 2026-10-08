// Test fixtures for the new-customer panel.
//
// Production reads every period's figure from Meta as a period (`time_ranges`), because
// Meta's incremental figure does not add up across days. Most fixtures are written as
// daily rows, which ARE additive by construction, so this turns them into the window rows
// the production fetch would return: one row per window the panel asks for, holding the
// sum of the fixture days inside it. Tests that pin the non-additivity itself build their
// window rows by hand (see meta-acquisition-window-totals.test.js).
const {
  listAcquisitionWindows,
  resolveAcquisitionWindowPresets
} = require("../../server/meta/customer-acquisition");

function windowRowsFromDays(dailyRows = [], { now = new Date(), timeZone = "", extraWindows = [] } = {}) {
  const windows = listAcquisitionWindows(resolveAcquisitionWindowPresets(now, timeZone), extraWindows);
  return windows.map(({ since, until }) => {
    const inside = (dailyRows || []).filter((row) => row?.date_start >= since && row?.date_start <= until);
    const sumEntries = (field) => {
      const totals = new Map();
      for (const row of inside) {
        for (const entry of row?.[field] || []) {
          totals.set(entry.action_type, (totals.get(entry.action_type) || 0) + (Number(entry.value) || 0));
        }
      }
      return Array.from(totals, ([action_type, value]) => ({ action_type, value: String(value) }));
    };
    return {
      campaign_id: "fixture",
      date_start: since,
      date_stop: until,
      spend: String(inside.reduce((sum, row) => sum + (Number(row?.spend) || 0), 0)),
      actions: sumEntries("actions"),
      action_values: sumEntries("action_values")
    };
  });
}

// Wraps a builder so a test written against daily rows also receives the matching window
// rows, unless it passes its own.
function withWindowRows(build) {
  return (args = {}) => build({
    ...args,
    windowRows: args.windowRows ?? windowRowsFromDays(args.dailyRows, { now: args.now, timeZone: args.timeZone })
  });
}

module.exports = { windowRowsFromDays, withWindowRows };
