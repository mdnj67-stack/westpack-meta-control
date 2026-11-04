// IT vs ES: are they alike before, and does the gap move when IT gets much more Meta?
// Paying first-time customers by customer country. Ratio = IT / ES for the same months.
const fs = require("fs");
const path = require("path");
const { loadRun, ym, SCRATCH, FULL_TAG } = require("./lib");
const { loadMeta } = require("./meta-load");
const meta = loadMeta();
const { customers } = loadRun(FULL_TAG);
const nc = {};
for (const c of customers) if (c.period === "Nu" && c.salesToCutoff > 0) { const k = `${c.country}|${ym(c.first)}`; nc[k] = (nc[k] || 0) + 1; }
// October 2026 is only ~71% invoiced so far; count its first orders at the usual 95% paid rate.
const octAll = customers.filter((c) => c.period === "Nu" && ym(c.first) === "2026-10");
for (const cc of ["IT", "ES"]) nc[`${cc}|2026-10`] = Math.round(octAll.filter((c) => c.country === cc).length * 0.95);

const get = (cc, m) => nc[`${cc}|${m}`] || 0;
const sp = (cc, m) => meta[`${cc}|${m}`] || { spend: 0, aware: 0 };
const shift = (m, d) => { const t = new Date(`${m}-01T00:00:00Z`); t.setUTCMonth(t.getUTCMonth() + d); return t.toISOString().slice(0, 7); };
const range = (a, b) => { const o = []; for (let m = a; m <= b; m = shift(m, 1)) o.push(m); return o; };

// 1. Similarity: monthly correlation of the two series and of their year-on-year changes, 2019-2024.
const pre = range("2019-05", "2024-08");
const it = pre.map((m) => get("IT", m)), es = pre.map((m) => get("ES", m));
const corr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
console.log(`Before Meta conversion spend (May 2019 - Aug 2024): IT ${it.reduce((s, v) => s + v, 0)} vs ES ${es.reduce((s, v) => s + v, 0)} new customers; monthly correlation ${corr(it, es).toFixed(2)}`);

// 2. The ratio IT/ES for the same four windows every year.
const windows = [["Sep-Nov", "09", "11"], ["Dec-Apr", "12", "04"], ["May-Aug", "05", "08"]];
console.log("\nIT/ES ratio by window and year (IT n / ES n), with Meta spend in the window (IT kr / ES kr)");
const ratioRows = [];
for (const [label, a, b] of windows) {
  const cells = [];
  for (let y = 2019; y <= 2026; y++) {
    const start = `${y}-${a}`; const end = Number(b) < Number(a) ? `${y + 1}-${b}` : `${y}-${b}`;
    if (start < "2019-05" || end > "2026-10") continue;
    const ms = range(start, end);
    const i = ms.reduce((s, m) => s + get("IT", m), 0), e = ms.reduce((s, m) => s + get("ES", m), 0);
    const si = ms.reduce((s, m) => s + sp("IT", m).spend, 0), se = ms.reduce((s, m) => s + sp("ES", m).spend, 0);
    cells.push({ y, i, e, r: i / e, si, se });
    ratioRows.push({ window: label, year: y, it: i, es: e, ratio: i / e, itSpend: si, esSpend: se });
  }
  console.log(label.padEnd(8), cells.map((c) => `${c.y}: ${c.r.toFixed(2)} (${c.i}/${c.e}${c.si + c.se > 0 ? `; ${Math.round(c.si / 1000)}k/${Math.round(c.se / 1000)}k` : ""})`).join("  "));
}

// 3. Difference-in-differences on logs: event window vs the same window a year earlier, IT minus ES.
// Standard error from Poisson counts: var(log n) ~ 1/n.
function did(label, ms) {
  const a = (cc, list) => list.reduce((s, m) => s + get(cc, m), 0);
  const prev = ms.map((m) => shift(m, -12));
  const I1 = a("IT", ms), I0 = a("IT", prev), E1 = a("ES", ms), E0 = a("ES", prev);
  const d = Math.log(I1 / I0) - Math.log(E1 / E0);
  const se = Math.sqrt(1 / I1 + 1 / I0 + 1 / E1 + 1 / E0);
  const spendDiff = ms.reduce((s, m) => s + sp("IT", m).spend - sp("IT", shift(m, -12)).spend - (sp("ES", m).spend - sp("ES", shift(m, -12)).spend), 0);
  console.log(`${label.padEnd(36)} IT ${I0}->${I1} (${((I1 / I0 - 1) * 100).toFixed(0)}%), ES ${E0}->${E1} (${((E1 / E0 - 1) * 100).toFixed(0)}%): IT vs ES ${((Math.exp(d) - 1) * 100).toFixed(0)}% [95% ${((Math.exp(d - 1.96 * se) - 1) * 100).toFixed(0)}%, ${((Math.exp(d + 1.96 * se) - 1) * 100).toFixed(0)}%]; extra IT spend vs ES ${Math.round(spendDiff / 1000)}k`);
  return { label, I0, I1, E0, E1, did: Math.exp(d) - 1, lo: Math.exp(d - 1.96 * se) - 1, hi: Math.exp(d + 1.96 * se) - 1, extraSpend: spendDiff };
}
console.log("\nDifference-in-differences (each window vs the same months a year earlier)");
const events = [
  did("A. IT conv starts (Sep-Nov 2024)", range("2024-09", "2024-11")),
  did("B. both on, IT heavier (Dec 24-Aug 25)", range("2024-12", "2025-08")),
  did("C. autumn 2025 (Sep-Nov 2025)", range("2025-09", "2025-11")),
  did("D. IT local campaign off (May-Aug 26)", range("2026-05", "2026-08")),
  did("E. IT relaunch, heavy (Sep-Oct 2026)", range("2026-09", "2026-10")),
];
// Placebo windows before any IT conversion spend: does the method find "effects" where there is none?
console.log("\nPlacebo windows (no conversion spend in either country)");
const placebo = [
  did("P1. Sep-Nov 2022", range("2022-09", "2022-11")),
  did("P2. Sep-Nov 2023", range("2023-09", "2023-11")),
  did("P3. Dec 22-Aug 23", range("2022-12", "2023-08")),
  did("P4. Dec 23-Aug 24", range("2023-12", "2024-08")),
  did("P5. Sep-Nov 2021", range("2021-09", "2021-11")),
];
fs.writeFileSync(path.join(SCRATCH, "data", "it-es.json"), JSON.stringify({ ratioRows, events, placebo, monthly: range("2019-05", "2026-10").map((m) => ({ m, it: get("IT", m), es: get("ES", m), itSpend: sp("IT", m).spend, esSpend: sp("ES", m).spend, itAware: sp("IT", m).aware, esAware: sp("ES", m).aware })) }));
