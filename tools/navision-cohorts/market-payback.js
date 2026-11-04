// Per market: value of a new customer (cohorts 2022-2024, complete years) against Meta's cost per
// incremental new customer (Apr 2025 - Sep 2026; all spend, and conversion-only), plus account-level
// monthly series for the deck. Appends to data/deck-numbers.json.
const fs = require("fs");
const path = require("path");
const { loadRun, ym, SCRATCH, FULL_TAG } = require("./lib");
const { loadMeta } = require("./meta-load");
const meta = loadMeta();
const file = path.join(SCRATCH, "data", "deck-numbers.json");
const deck = JSON.parse(fs.readFileSync(file, "utf8"));
const all = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "cohorts", "customers.json"), "utf8"));
const paid = all.filter((c) => c.total > 0);

const MARKETS = { DE: ["DE"], FR: ["FR"], IT: ["IT"], ES: ["ES"], GB: ["GB"], NL: ["NL"], BE: ["BE"], PL: ["PL"], DK: ["DK", "FO", "GL", "IS"], SE: ["SE"], AT: ["AT"], CH: ["CH"], PT: ["PT"], FI: ["FI"], IE: ["IE"] };
// Value through t2 (acquisition year + 2 full years, ~30 months), cohorts 2022-2023 (have t2 complete).
function value(ccs) {
  const set = new Set(ccs);
  const list = paid.filter((c) => set.has(c.country) && c.fy0 >= 2022 && c.fy0 <= 2023);
  const v = list.reduce((s, c) => s + (c.sales[c.fy0] || 0) + (c.sales[c.fy0 + 1] || 0) + (c.sales[c.fy0 + 2] || 0), 0) / list.length;
  const v1 = list.reduce((s, c) => s + (c.sales[c.fy0] || 0) + (c.sales[c.fy0 + 1] || 0), 0) / list.length;
  return { n: list.length, t1: v1, t2: v };
}
function cost(ccs) {
  let spend = 0, aware = 0, ia = 0;
  for (const v of Object.values(meta)) if (ccs.includes(v.country) && v.month >= "2025-04" && v.month <= "2026-09") { spend += v.spend; aware += v.aware; ia += v.ia || 0; }
  return { spend, aware, ia, cpaAll: spend / ia, cpaConv: (spend - aware) / ia };
}
const rows = [];
console.log("market | value per new customer t1 / t2 (DKK sales) | Meta IA new | CPA all / conv-only | contribution t2 @45% / CPA all");
for (const [mk, ccs] of Object.entries(MARKETS)) {
  const v = value(ccs), c = cost(ccs);
  const ratio = (v.t2 * 0.45) / c.cpaAll;
  rows.push({ market: mk, ...v, ...c, ratioT2: ratio });
  console.log(mk.padEnd(4), String(Math.round(v.t1)).padStart(6), String(Math.round(v.t2)).padStart(6), "|", String(Math.round(c.ia)).padStart(4), "|", String(Math.round(c.cpaAll)).padStart(6), String(Math.round(c.cpaConv)).padStart(6), "|", ratio.toFixed(2));
}
const tot = cost(Object.values(MARKETS).flat().concat(["US", "NO", "RO", "HU", "CZ", "SK", "GR", "HR", "LU", "BG", "SI", "EE", "LV", "LT"]));
let S = 0, A = 0, I = 0; for (const v of Object.values(meta)) if (v.month >= "2025-04" && v.month <= "2026-09") { S += v.spend; A += v.aware; I += v.ia || 0; }
console.log(`ACCOUNT Apr25-Sep26: spend ${Math.round(S)} aware ${Math.round(A)} (${Math.round(A / S * 100)}%) IA ${Math.round(I)} -> CPA all ${Math.round(S / I)}, conversion-only ${Math.round((S - A) / I)}`);

// Monthly account series: Meta spend and Navision paying new customers (Oct 2026 estimated at 95% paid).
const { customers } = loadRun(FULL_TAG);
const navM = {}, navAll = {};
for (const c of customers) if (c.period === "Nu") { const m = ym(c.first); navAll[m] = (navAll[m] || 0) + 1; if (c.salesToCutoff > 0) navM[m] = (navM[m] || 0) + 1; }
navM["2026-10"] = Math.round(navAll["2026-10"] * 0.95);
const months = Object.keys(navM).filter((m) => m >= "2019-05" && m <= "2026-10").sort();
const monthly = months.map((m) => {
  let spend = 0, aware = 0, ia = null;
  for (const v of Object.values(meta)) if (v.month === m) { spend += v.spend; aware += v.aware; if (v.ia != null) ia = (ia || 0) + v.ia; }
  return { m, nav: navM[m], spend: m >= "2023-11" ? spend : null, aware: m >= "2023-11" ? aware : null, ia };
});
deck.markets = rows; deck.account = { spend: S, aware: A, ia: I }; deck.monthly = monthly;
fs.writeFileSync(file, JSON.stringify(deck, null, 1));
console.log("monthly rows", monthly.length, "first", monthly[0], "last", monthly[monthly.length - 1]);
