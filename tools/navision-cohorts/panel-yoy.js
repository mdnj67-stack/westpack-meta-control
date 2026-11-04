// Does a country's change in Meta spend show up in its change in new customers?
// Unit: country x month, Nov 2024 - Sep 2026 (needs spend 12 months earlier; spend data start Nov 2023).
// y = log(new paying customers) - log(same month a year earlier)  -> removes the country's level and seasonality
// x = (Meta spend - spend a year earlier) in 10,000 DKK; also the sum of the change over the last 3 months.
// Month fixed effects absorb anything that hit every market in the same month.
// Uncertainty: cluster bootstrap over countries (2,000 draws), plus a placebo with NEXT year's spend change.
const { loadRun, ym, FULL_TAG } = require("./lib");
const { loadMeta } = require("./meta-load");
const meta = loadMeta();
const { customers } = loadRun(FULL_TAG);

const COUNTRIES = ["GB", "DE", "FR", "NL", "PL", "IT", "ES", "DK", "BE", "SE", "FI", "PT", "AT", "CH", "IE", "US", "RO"];
const nc = {};
for (const c of customers) if (c.period === "Nu" && c.salesToCutoff > 0) { const k = `${c.country}|${ym(c.first)}`; nc[k] = (nc[k] || 0) + 1; }
const spend = (cc, m) => (meta[`${cc}|${m}`] || {}).spend || 0;
const shift = (m, d) => { const t = new Date(`${m}-01T00:00:00Z`); t.setUTCMonth(t.getUTCMonth() + d); return t.toISOString().slice(0, 7); };
const months = []; for (let m = "2024-11"; m <= "2026-09"; m = shift(m, 1)) months.push(m);

const obs = [];
for (const cc of COUNTRIES) for (const m of months) {
  const a = nc[`${cc}|${m}`] || 0, b = nc[`${cc}|${shift(m, -12)}`] || 0;
  if (a < 5 || b < 5) continue;
  const dx = (spend(cc, m) - spend(cc, shift(m, -12))) / 1e4;
  const dx3 = [0, 1, 2].reduce((s, l) => s + (spend(cc, shift(m, -l)) - spend(cc, shift(m, -l - 12))), 0) / 1e4;
  const lead = shift(m, 12) <= "2026-09" ? (spend(cc, shift(m, 12)) - spend(cc, m)) / 1e4 : null; // placebo: next year's change
  obs.push({ cc, m, y: Math.log(a) - Math.log(b), dx, dx3, lead, n: a, nPrev: b });
}

// OLS with month dummies via within-month demeaning (Frisch-Waugh): regress demeaned y on demeaned x.
function beta(rows, key) {
  const byM = {};
  for (const r of rows) (byM[r.m] = byM[r.m] || []).push(r);
  let sxy = 0, sxx = 0;
  for (const g of Object.values(byM)) {
    const my = g.reduce((s, r) => s + r.y, 0) / g.length, mx = g.reduce((s, r) => s + r[key], 0) / g.length;
    for (const r of g) { sxy += (r[key] - mx) * (r.y - my); sxx += (r[key] - mx) ** 2; }
  }
  return sxx > 0 ? sxy / sxx : NaN;
}
function boot(rows, key, draws = 2000) {
  const ccs = [...new Set(rows.map((r) => r.cc))];
  const byC = Object.fromEntries(ccs.map((c) => [c, rows.filter((r) => r.cc === c)]));
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bs = [];
  for (let i = 0; i < draws; i++) {
    const sample = [];
    for (let j = 0; j < ccs.length; j++) sample.push(...byC[ccs[Math.floor(rnd() * ccs.length)]].map((r) => ({ ...r, m: r.m })));
    const b = beta(sample, key); if (Number.isFinite(b)) bs.push(b);
  }
  bs.sort((a, b) => a - b);
  return [bs[Math.floor(bs.length * 0.025)], bs[Math.floor(bs.length * 0.975)]];
}
const meanNc = obs.reduce((s, r) => s + r.n, 0) / obs.length;
const show = (label, rows, key) => {
  const b = beta(rows, key), [lo, hi] = boot(rows, key);
  // b is the change in log new customers per 10k DKK a month; at the average market size that is
  // b * meanNc extra customers a month, i.e. a marginal cost of 10,000 / (b * meanNc) DKK per customer.
  const per = (v) => (v > 0 ? Math.round(1e4 / (v * meanNc)).toLocaleString("da-DK") : "n/a (≤0)");
  console.log(`${label.padEnd(44)} b=${(b * 100).toFixed(2)}% per 10k  95% CI [${(lo * 100).toFixed(2)}%, ${(hi * 100).toFixed(2)}%]  -> marginal cost/customer ${per(b)} (CI ${per(hi)} – ${per(lo)})`);
};
console.log(`obs ${obs.length}, countries ${new Set(obs.map((r) => r.cc)).size}, months ${new Set(obs.map((r) => r.m)).size}, mean new customers per country-month ${meanNc.toFixed(1)}`);
show("same-month spend change", obs, "dx");
show("spend change summed over last 3 months", obs, "dx3");
show("PLACEBO: next year's spend change", obs.filter((r) => r.lead != null), "lead");
show("same-month, excl. IT", obs.filter((r) => r.cc !== "IT"), "dx");
show("same-month, Nov 2025 - Sep 2026 only", obs.filter((r) => r.m >= "2025-11"), "dx");
// Meta's own figure for comparison: incremental new customers per DKK at account level, Apr 2025 - Sep 2026.
let s = 0, ia = 0; for (const v of Object.values(meta)) if (v.month >= "2025-04" && v.month <= "2026-09" && v.ia != null) { s += v.spend; ia += v.ia; }
console.log(`Meta's own incremental figure Apr 2025 - Sep 2026: ${Math.round(ia)} new customers on ${Math.round(s).toLocaleString("da-DK")} DKK = ${Math.round(s / ia).toLocaleString("da-DK")} DKK per new customer (average, not marginal)`);
