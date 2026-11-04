// Per country: Meta spend and Meta's incremental new customers, against Navision first-time paying
// customers, for fiscal years 2024 (May 24-Apr 25), 2025 (May 25-Apr 26) and 2026 to date (May-Oct).
const { loadRun, ym, FULL_TAG } = require("./lib");
const { loadMeta } = require("./meta-load");
const meta = loadMeta();
const { customers } = loadRun(FULL_TAG);
const now = customers.filter((c) => c.period === "Nu" && c.salesToCutoff > 0);

const fyOf = (m) => (Number(m.slice(5, 7)) >= 5 ? Number(m.slice(0, 4)) : Number(m.slice(0, 4)) - 1);
const T = {};
const add = (cc, fy, k, v) => { T[cc] = T[cc] || {}; T[cc][fy] = T[cc][fy] || { spend: 0, aware: 0, ia: 0, iaMonths: 0, nav: 0, navSame: 0 }; T[cc][fy][k] += v; };
for (const v of Object.values(meta)) {
  if (v.month > "2026-10") continue;
  const fy = fyOf(v.month);
  add(v.country, fy, "spend", v.spend); add(v.country, fy, "aware", v.aware);
  if (v.ia != null) { add(v.country, fy, "ia", v.ia); add(v.country, fy, "iaMonths", 1); }
}
for (const c of now) {
  const m = ym(c.first);
  if (m > "2026-10") continue;
  add(c.country, fyOf(m), "nav", 1);
  // Same months as FY2026 to date (May-Oct) in every year, for a like-for-like comparison.
  if (Number(m.slice(5, 7)) >= 5 && Number(m.slice(5, 7)) <= 10) add(c.country, fyOf(m), "navSame", 1);
}
const f = (n, w = 8) => Math.round(n || 0).toLocaleString("da-DK").padStart(w);
const list = Object.keys(T).filter((cc) => (T[cc][2025] || {}).spend > 20000 || (T[cc][2025] || {}).nav > 150)
  .sort((a, b) => ((T[b][2025] || {}).spend || 0) - ((T[a][2025] || {}).spend || 0));
console.log("cc   | Meta spend FY24  FY25  FY26ytd | aware FY25 | IA new FY25 | Navision new FY23  FY24  FY25 | May-Oct FY25  FY26 | Δ%");
for (const cc of list) {
  const g = (fy, k) => (T[cc][fy] || {})[k] || 0;
  const d = g(2025, "navSame") ? (g(2026, "navSame") / g(2025, "navSame") - 1) * 100 : NaN;
  console.log(cc.padEnd(4), "|", f(g(2024, "spend")), f(g(2025, "spend")), f(g(2026, "spend")), "|", f(g(2025, "aware")), "|", f(g(2025, "ia"), 6), "|", f(g(2023, "nav"), 6), f(g(2024, "nav"), 6), f(g(2025, "nav"), 6), "|", f(g(2025, "navSame"), 6), f(g(2026, "navSame"), 6), "|", Number.isFinite(d) ? d.toFixed(0).padStart(4) : "");
}
const tot = (fy, k) => Object.values(T).reduce((s, x) => s + ((x[fy] || {})[k] || 0), 0);
console.log("ALL  |", f(tot(2024, "spend")), f(tot(2025, "spend")), f(tot(2026, "spend")), "|", f(tot(2025, "aware")), "|", f(tot(2025, "ia"), 6), "|", f(tot(2023, "nav"), 6), f(tot(2024, "nav"), 6), f(tot(2025, "nav"), 6), "|", f(tot(2025, "navSame"), 6), f(tot(2026, "navSame"), 6));
