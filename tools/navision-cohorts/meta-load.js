// Loads the Meta country x month files into one table: { "IT|2025-10": {spend, aware, impressions, ia, click7, purchasesIa, ...} }.
const fs = require("fs");
const path = require("path");
const { SCRATCH } = require("./lib");
const DIR = path.join(SCRATCH, "data", "meta");
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

function loadMeta() {
  const { types } = read("custom-conversions.json");
  const NEW = new Set(types.newCustomerActionTypes);
  const t = {};
  const cell = (r) => {
    const k = `${r.country}|${r.date_start.slice(0, 7)}`;
    return (t[k] = t[k] || { country: r.country, month: r.date_start.slice(0, 7), spend: 0, aware: 0, impressions: 0, reach: 0, clicks: 0, ia: null, click7: null, view1: null, reported: null });
  };
  for (const r of read("spend-country-month.json")) {
    const c = cell(r);
    c.spend += Number(r.spend || 0); c.impressions += Number(r.impressions || 0); c.reach += Number(r.reach || 0); c.clicks += Number(r.inline_link_clicks || 0);
  }
  for (const r of read("awareness-country-month.json")) cell(r).aware += Number(r.spend || 0);
  for (const r of read("results-country-month.json")) {
    const c = cell(r);
    const hits = (r.actions || []).filter((a) => NEW.has(a.action_type));
    // A key Meta did not return is missing, not zero (incrementality only exists from autumn 2025).
    const sum = (key) => (hits.some((a) => a[key] !== undefined) ? hits.reduce((s, a) => s + Number(a[key] || 0), 0) : null);
    c.ia = sum("incrementality"); c.click7 = sum("7d_click"); c.view1 = sum("1d_view"); c.reported = sum("value");
  }
  return t;
}
module.exports = { loadMeta };
