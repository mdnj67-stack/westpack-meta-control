// Value of a new customer over time, from the cohorts, and payback at different costs per customer.
// Writes data/deck-numbers.json for the deck.
const fs = require("fs");
const path = require("path");
const { SCRATCH } = require("./lib");
const all = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "cohorts", "customers.json"), "utf8"));
const paid = all.filter((c) => c.total > 0);

// Per cohort: yearly sales per acquired customer, complete fiscal years only (<= 2025).
const cohortRows = {};
for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) {
  const m = paid.filter((c) => c.fy0 === y);
  const rev = [], act = [], perActive = [];
  for (let fy = y; fy <= 2025; fy++) {
    const r = m.reduce((s, c) => s + (c.sales[fy] || 0), 0) / m.length;
    const a = m.filter((c) => (c.sales[fy] || 0) > 0).length / m.length;
    rev.push(r); act.push(a); perActive.push(r / a);
  }
  cohortRows[y] = { n: m.length, rev, act, perActive };
}

// "Recent" value curve: each year offset averaged over the cohorts 2022-2024 that have it (weighted by n);
// offsets the recent cohorts have not reached yet are extended with the decay the 2020-2021 cohorts showed.
function curve(cohorts) {
  const out = [];
  for (let t = 0; t <= 5; t++) {
    const have = cohorts.filter((y) => cohortRows[y].rev[t] != null);
    if (!have.length) { out.push(null); continue; }
    const n = have.reduce((s, y) => s + cohortRows[y].n, 0);
    out.push(have.reduce((s, y) => s + cohortRows[y].rev[t] * cohortRows[y].n, 0) / n);
  }
  return out;
}
const old = curve([2020, 2021]);
const recent = curve([2022, 2023, 2024]);
for (let t = 1; t <= 5; t++) if (recent[t] == null) recent[t] = recent[t - 1] * (old[t] / old[t - 1]);
const cum = (arr) => arr.reduce((o, v) => (o.push((o.length ? o[o.length - 1] : 0) + v), o), []);
const recentCum = cum(recent), oldCum = cum(old);
const kr = (v) => Math.round(v).toLocaleString("da-DK").padStart(7);
console.log("Sales per acquired customer by fiscal year since acquisition (t0 = acquisition year, on average ~6 months)");
console.log("        ", [0, 1, 2, 3, 4, 5].map((t) => `t${t}`.padStart(7)).join(""));
console.log("2020-21 ", old.map(kr).join(""), "   cumulative", oldCum.map(kr).join(""));
console.log("2022-24 ", recent.map(kr).join(""), "   cumulative", recentCum.map(kr).join(""), " (t3+ extended with the 2020-21 decay)");
console.log(`share of 5-year sales that arrives after the acquisition year: 2020-21 ${Math.round((1 - oldCum[0] / oldCum[5]) * 100)}%, 2022-24 ${Math.round((1 - recentCum[0] / recentCum[5]) * 100)}%`);

// Payback: cumulative contribution (sales x margin) against a cost per new customer.
const margins = [0.35, 0.45, 0.55];
const cacs = [800, 1900, 2750, 4800];
console.log("\nCumulative contribution per new customer (recent curve) at margin 35 / 45 / 55%");
for (const g of margins) console.log(`  ${g * 100}%:`, recentCum.map((v) => kr(v * g)).join(""));
console.log("\nKroner back per krone spent on a new customer, after t0..t5 (recent curve, 45% margin)");
for (const c of cacs) console.log(`  CAC ${String(c).padStart(5)}:`, recentCum.map((v) => ((v * 0.45) / c).toFixed(2).padStart(7)).join(""));
console.log("\nMaximum affordable cost per new customer to break even within N fiscal years (recent curve)");
for (const g of margins) console.log(`  ${g * 100}%:`, [1, 2, 3, 5].map((t) => `${t + 0}y→${kr(recentCum[t] * g)}`).join("  "));

// Layer cake: total invoiced sales per fiscal year, split by acquisition cohort (customers won since May 2019).
const cake = {};
for (const c of paid) for (const [fy, v] of Object.entries(c.sales)) { cake[fy] = cake[fy] || {}; cake[fy][c.fy0] = (cake[fy][c.fy0] || 0) + v; }
console.log("\nSales (m DKK) per fiscal year from customers won since May 2019, by the year they were won");
for (const fy of Object.keys(cake).sort()) console.log(`  FY${fy}:`, Object.entries(cake[fy]).map(([c, v]) => `${c}:${(v / 1e6).toFixed(1)}`).join(" "), " total", (Object.values(cake[fy]).reduce((s, v) => s + v, 0) / 1e6).toFixed(1));

// Of 100 new customers: how many buy in each later year, and how many ever buy again (recent cohorts, complete years).
const of100 = [1, 2, 3].map((t) => {
  const el = paid.filter((c) => c.fy0 >= 2020 && c.fy0 + t <= 2025);
  return { t, active: el.filter((c) => (c.sales[c.fy0 + t] || 0) > 0).length / el.length, ever: el.filter((c) => { for (let y = c.fy0 + 1; y <= c.fy0 + t; y++) if ((c.sales[y] || 0) > 0) return true; return false; }).length / el.length };
});
console.log("\nOf 100 new customers (cohorts 2020-2024):", of100.map((o) => `year ${o.t + 1}: ${Math.round(o.active * 100)} buy, ${Math.round(o.ever * 100)} have bought again`).join(" | "));

fs.writeFileSync(path.join(SCRATCH, "data", "deck-numbers.json"), JSON.stringify({ cohortRows, old, recent, oldCum, recentCum, cake, of100 }, null, 1));
