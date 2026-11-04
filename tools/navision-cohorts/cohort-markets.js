// Cohort value and retention by market and by first-order size, complete fiscal years only.
// Cohorts 2020-2024 (2019 is left-censored: Navision order history starts April 2019).
const fs = require("fs");
const path = require("path");
const { SCRATCH } = require("./lib");
const all = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "cohorts", "customers.json"), "utf8"));
const paid = all.filter((c) => c.total > 0 && c.fy0 >= 2020 && c.fy0 <= 2025);

const MARKET = (cc) => ({
  DK: "DK", FO: "DK", GL: "DK", IS: "DK", DE: "DE", AT: "AT/CH", CH: "AT/CH", FR: "FR", IT: "IT", ES: "ES", PT: "PT",
  GB: "GB", IE: "IE", NL: "NL", BE: "BE", LU: "BE", SE: "SE", NO: "NO", FI: "FI", PL: "PL", US: "US",
}[cc] || "Other");

// Metrics for a set of customers, using only fiscal years that are complete (<= 2025) for each offset.
function metrics(list) {
  const out = { n: list.length };
  for (const t of [1, 2, 3]) {
    const eligible = list.filter((c) => c.fy0 + t <= 2025);
    if (eligible.length < 30) continue;
    out[`active_t${t}`] = eligible.filter((c) => (c.sales[c.fy0 + t] || 0) > 0).length / eligible.length;
    // Cumulative sales through the end of fiscal year fy0 + t.
    out[`cum_t${t}`] = eligible.reduce((s, c) => { let v = 0; for (let y = c.fy0; y <= c.fy0 + t; y++) v += c.sales[y] || 0; return s + v; }, 0) / eligible.length;
    // Bought again in ANY year after the acquisition year, up to fy0 + t.
    out[`ever_t${t}`] = eligible.filter((c) => { for (let y = c.fy0 + 1; y <= c.fy0 + t; y++) if ((c.sales[y] || 0) > 0) return true; return false; }).length / eligible.length;
  }
  const first = list.map((c) => c.firstInvoice).sort((a, b) => a - b);
  out.medianFirstMonth = first[Math.floor(first.length / 2)];
  return out;
}
const pct = (v) => (v == null ? "  –  " : `${Math.round(v * 100)}%`.padStart(5));
const kr = (v) => (v == null ? "    –" : Math.round(v).toLocaleString("da-DK").padStart(7));
const line = (label, m) => console.log(label.padEnd(16), String(m.n).padStart(6), kr(m.medianFirstMonth), "|", pct(m.active_t1), pct(m.active_t2), pct(m.active_t3), "|", pct(m.ever_t1), pct(m.ever_t3), "|", kr(m.cum_t1), kr(m.cum_t2), kr(m.cum_t3));
const header = () => console.log("".padEnd(16), "     n", "medFirst", "| act1  act2  act3 | ever1 ever3 |   cum1    cum2    cum3");

console.log("Cohorts FY2020-FY2025 (paying). act t = bought in fiscal year t after acquisition; ever = bought again at all by year t; cum = sales per acquired customer through year t (DKK)");
header();
line("ALL", metrics(paid));
const byMarket = {};
for (const c of paid) (byMarket[MARKET(c.country)] = byMarket[MARKET(c.country)] || []).push(c);
for (const [m, list] of Object.entries(byMarket).sort((a, b) => b[1].length - a[1].length)) line(m, metrics(list));

console.log("\nBy cohort year, all markets");
header();
for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) line(`FY${y}`, metrics(paid.filter((c) => c.fy0 === y)));

console.log("\nBy size of the first invoice (all cohorts)");
header();
const bands = [[0, 1], [1, 200], [200, 500], [500, 1000], [1000, 2000], [2000, 5000], [5000, 1e12]];
for (const [a, b] of bands) line(`${a}-${b === 1e12 ? "" : b}`, metrics(paid.filter((c) => c.firstInvoice >= a && c.firstInvoice < b)));

console.log("\nIT and ES by cohort year");
header();
for (const cc of ["IT", "ES"]) for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) line(`${cc} FY${y}`, metrics(paid.filter((c) => c.country === cc && c.fy0 === y)));

// Duplicate-name sensitivity: merge customers that share a normalised name and country, leaving
// placeholder names alone, and see how much year-1 retention moves.
const PLACEHOLDER = /^(none|privato|privat|particulier|particular|nessuna|private|privatkunde|n\/a|na|-|x|test)$/i;
const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const groups = {};
for (const c of paid) {
  const k = PLACEHOLDER.test(c.name.trim()) || norm(c.name).length < 4 ? `#${c.no}` : `${norm(c.name)}|${c.country}`;
  (groups[k] = groups[k] || []).push(c);
}
const merged = Object.values(groups).map((g) => {
  g.sort((a, b) => a.first.localeCompare(b.first));
  const sales = {};
  for (const c of g) for (const [y, v] of Object.entries(c.sales)) sales[y] = (sales[y] || 0) + v;
  return { ...g[0], sales, firstMonthSales: g[0].firstMonthSales };
});
console.log(`\nDuplicate-name sensitivity: ${paid.length} customer numbers -> ${merged.length} merged companies (${Math.round((1 - merged.length / paid.length) * 1000) / 10}% fewer)`);
header();
line("as numbers", metrics(paid));
line("merged by name", metrics(merged));
