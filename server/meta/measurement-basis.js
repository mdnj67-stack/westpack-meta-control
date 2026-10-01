// One measurement basis for every result the dashboard shows.
//
// Meta attributes a purchase according to the attribution setting of the ad set that
// earned it. On this account that has meant incremental attribution on some ad sets,
// 7-day click + 1-day view on others and 7-day click + 1-day view + 1-day engaged view on
// Conv - 04 - EU - Standard, and the mix changed on 2026-09-09 (account rebuilt by market)
// and again on 2026-09-29 (DE/FR/IT switched from incremental to standard inside the same
// campaigns). Summing `value` across campaigns therefore added different measurements
// together, and any comparison across those dates measured the change of method as much
// as the change in performance: new customers read +37% August to September where the
// same method in both months gives +9%.
//
// Asking insights for `action_attribution_windows=["incrementality"]` makes Meta return
// its incremental estimate as an extra key on every action entry, beside `value`:
//
//   {"action_type":"omni_purchase","value":"471","1d_view":"401","7d_click":"70","incrementality":"136"}
//
// Every row is normalised here, as soon as it is fetched: `value` becomes the incremental
// figure and the ad set's own figure moves to `reported_value`. Everything downstream -
// totals, lenses, the new-customer panel, comparisons - then reads one method for every
// campaign and every period, with no second code path to keep in step. The team runs Meta
// on incremental attribution by choice, as the conservative reading, so this is the
// figure they already budget against.
//
// On-platform actions (`lead`, `onsite_conversion.lead_grouped`, link clicks, video
// views) carry no incrementality key: they happen on Meta, so there is nothing to
// attribute. Those keep their reported value, and `basis` on the entry says so.
//
// An earlier version requested the incrementality window on two separate queries and then
// read `value` from them, concluded that Meta "returns the same figures for both", and
// printed that as a warning. It was comparing `value` with itself.

const INCREMENTAL_ATTRIBUTION_WINDOWS = JSON.stringify(["incrementality"]);
const BASIS_MARKER = "__measurementBasis";
const BASIS = "incrementality";

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || "reported_value" in entry) {
    return entry;
  }
  const hasIncremental = entry.incrementality !== undefined && entry.incrementality !== null;
  return {
    ...entry,
    reported_value: entry.value,
    value: hasIncremental ? entry.incrementality : entry.value,
    basis: hasIncremental ? BASIS : "reported"
  };
}

function normalizeEntries(entries) {
  return Array.isArray(entries) ? entries.map(normalizeEntry) : entries;
}

// Idempotent, so a row that has already been through it (from a cache, say) is left alone.
function applyMeasurementBasis(row) {
  if (!row || typeof row !== "object" || row[BASIS_MARKER]) {
    return row;
  }
  return {
    ...row,
    actions: normalizeEntries(row.actions),
    action_values: normalizeEntries(row.action_values),
    purchase_roas: normalizeEntries(row.purchase_roas),
    [BASIS_MARKER]: BASIS
  };
}

function applyMeasurementBasisToCollection(collection) {
  if (!collection || !Array.isArray(collection.data)) {
    return collection;
  }
  return { ...collection, data: collection.data.map(applyMeasurementBasis) };
}

// The ad set's own figure for an entry, for the one place it is still shown: the
// "Reported by Meta" column beside each campaign.
function reportedEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!entry || !("reported_value" in entry)) return entry;
    return { ...entry, value: entry.reported_value };
  });
}

module.exports = {
  INCREMENTAL_ATTRIBUTION_WINDOWS,
  MEASUREMENT_BASIS: BASIS,
  applyMeasurementBasis,
  applyMeasurementBasisToCollection,
  reportedEntries
};
