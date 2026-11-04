// Cohort tables from data/cohorts/customers.json.
// A cohort = paying new customers whose first order fell in fiscal year c (May-April).
// Year offset t = fiscal year - c; t = 0 is the (partial) acquisition year. FY2026 is May-3 Nov only.
const fs = require("fs");
const path = require("path");
const { SCRATCH } = require("./lib");
const all = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "cohorts", "customers.json"), "utf8"));

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const only = arg("country", "");            // e.g. --country=IT  or  --country=IT,ES
const groups = only ? new Set(only.split(",")) : null;
const paid = all.filter((c) => c.total > 0 && (!groups || groups.has(c.country)));
const unpaid = all.filter((c) => !(c.total > 0) && (!groups || groups.has(c.country)));

const cohorts = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const f0 = (n) => (n == null ? "" : Math.round(n).toLocaleString("da-DK"));
const pct = (n) => (n == null ? "" : `${Math.round(n * 100)}%`);
console.log(`Scope: ${only || "all markets"}; paying new customers ${paid.length}, never invoiced ${unpaid.length}`);

const rows = [];
for (const c of cohorts) {
  const members = paid.filter((x) => x.fy0 === c);
  if (!members.length) continue;
  const r = { cohort: c, n: members.length, active: [], rev: [], cum: [] };
  let cum = 0;
  for (let t = 0; c + t <= 2026; t++) {
    const fy = c + t;
    const act = members.filter((x) => (x.sales[fy] || 0) > 0).length;
    const rev = members.reduce((s, x) => s + (x.sales[fy] || 0), 0);
    cum += rev;
    r.active.push(act / members.length);
    r.rev.push(rev / members.length);
    r.cum.push(cum / members.length);
  }
  rows.push(r);
}
const W = 8;
const head = ["cohort", "n", ...Array.from({ length: 8 }, (_, t) => `t${t}`)].map((h, i) => (i < 2 ? h.padEnd(i ? 7 : 7) : h.padStart(W))).join("");
console.log("\nShare of the cohort that bought in each fiscal year after acquisition (t0 = acquisition year; last column for each cohort is FY2026 to 3 Nov)");
console.log(head);
for (const r of rows) console.log(String(r.cohort).padEnd(7) + String(r.n).padEnd(7) + r.active.map((v) => pct(v).padStart(W)).join(""));
console.log("\nInvoiced sales per acquired customer in each fiscal year (DKK, excl. VAT)");
console.log(head);
for (const r of rows) console.log(String(r.cohort).padEnd(7) + String(r.n).padEnd(7) + r.rev.map((v) => f0(v).padStart(W)).join(""));
console.log("\nCumulative invoiced sales per acquired customer (DKK)");
console.log(head);
for (const r of rows) console.log(String(r.cohort).padEnd(7) + String(r.n).padEnd(7) + r.cum.map((v) => f0(v).padStart(W)).join(""));

// Revenue concentration: how much of a cohort's lifetime sales comes from its top 10% customers.
console.log("\nConcentration (cohort 2021, sales to 3 Nov 2026):");
const c21 = paid.filter((x) => x.fy0 === 2021).map((x) => x.total).sort((a, b) => b - a);
const tot = c21.reduce((s, v) => s + v, 0);
for (const share of [0.01, 0.1, 0.2, 0.5]) console.log(`  top ${share * 100}% of customers: ${pct(c21.slice(0, Math.ceil(c21.length * share)).reduce((s, v) => s + v, 0) / tot)} of sales`);
fs.writeFileSync(path.join(SCRATCH, "data", "cohorts", `tables${only ? "-" + only.replace(/,/g, "_") : ""}.json`), JSON.stringify(rows));
