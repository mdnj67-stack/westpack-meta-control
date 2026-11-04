// Builds one record per new customer with invoiced sales per fiscal year since acquisition, from
// the report runs that share From = 2019-05-01 and end at each fiscal-year end.
// Output: data/cohorts/customers.json  [{no, name, country, dept, first, fy0, sales:{2019:..,..}, ytd2026}]
const fs = require("fs");
const path = require("path");
const { loadRun, fiscalYear, SCRATCH, FULL_TAG } = require("./lib");

// Cut-off run per fiscal-year end. FY y ends 30 April y+1.
const CUTS = [
  [2019, "c20200430"], [2020, "c20210430"], [2021, "c20220430"], [2022, "c20230430"],
  [2023, "c20240430"], [2024, "c20250430"], [2025, "c20260430"],
];
const FULL = FULL_TAG; // cut-off = the latest run: FY to date

const cum = {}; // customer -> { fyEnd: cumulative sales }
const base = {};
const checkFirst = {};
for (const [fy, tag] of [...CUTS, [2026, FULL]]) {
  const { customers } = loadRun(tag);
  let n = 0;
  for (const c of customers) {
    if (c.period !== "Nu") continue;
    n++;
    (cum[c.no] = cum[c.no] || {})[fy] = c.salesToCutoff;
    // The first order date must not move between runs; if it does, the customer is flagged.
    const f = c.first.toISOString().slice(0, 10);
    if (checkFirst[c.no] && checkFirst[c.no] !== f) (base[c.no] = base[c.no] || {}).firstMoved = true;
    checkFirst[c.no] = f;
    if (tag === FULL) base[c.no] = { ...(base[c.no] || {}), no: c.no, name: c.name, country: c.country, dept: c.dept, first: f, firstInvoice: c.firstInvoice, firstMonthSales: c.firstMonthSales, total: c.salesToCutoff, source: c.source };
  }
  console.log(`${tag}: ${n} customers (FY ${fy} end)`);
}

const out = [];
let moved = 0, missing = 0, negative = 0;
for (const no of Object.keys(base)) {
  const b = base[no];
  if (!b.name && !b.first) continue;
  if (b.firstMoved) moved++;
  const fy0 = fiscalYear(new Date(b.first + "T00:00:00Z"));
  const sales = {};
  let prev = 0;
  for (let fy = fy0; fy <= 2026; fy++) {
    const c = cum[no] && cum[no][fy];
    if (c === undefined) { missing++; continue; }
    sales[fy] = Math.round((c - prev) * 100) / 100;
    if (sales[fy] < -1) negative++;
    prev = c;
  }
  out.push({ ...b, fy0, sales });
}
const dir = path.join(SCRATCH, "data", "cohorts");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "customers.json"), JSON.stringify(out));
console.log({ customers: out.length, firstDateMovedBetweenRuns: moved, missingCutoffValues: missing, negativeYears: negative });
