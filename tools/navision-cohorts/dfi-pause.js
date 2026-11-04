// DE+FR+IT against all other markets around the 2026 pause (May-Aug) and the 9 Sep restart,
// each window against the same months a year earlier. Oct 2026 first orders at the usual 95% paid rate.
const { loadRun, ym, FULL_TAG } = require("./lib");
const { loadMeta } = require("./meta-load");
const meta = loadMeta();
const { customers } = loadRun(FULL_TAG);
const nc = {}, allOct = {};
for (const c of customers) if (c.period === "Nu") { const k = `${c.country}|${ym(c.first)}`; if (c.salesToCutoff > 0) nc[k] = (nc[k] || 0) + 1; if (ym(c.first) === "2026-10") allOct[c.country] = (allOct[c.country] || 0) + 1; }
for (const [cc, n] of Object.entries(allOct)) nc[`${cc}|2026-10`] = Math.round(n * 0.95);
const T = ["DE", "FR", "IT"], C = ["GB", "NL", "PL", "ES", "DK", "BE", "SE", "FI", "PT", "AT", "CH", "IE"];
const sum = (ccs, ms) => ms.reduce((s, m) => s + ccs.reduce((t, cc) => t + (nc[`${cc}|${m}`] || 0), 0), 0);
const spend = (ccs, ms) => ms.reduce((s, m) => s + ccs.reduce((t, cc) => t + ((meta[`${cc}|${m}`] || {}).spend || 0), 0), 0);
const prevY = (ms) => ms.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`);
for (const [label, ms] of [["May-Aug 2026 (local campaigns off)", ["2026-05", "2026-06", "2026-07", "2026-08"]], ["Sep-Oct 2026 (relaunch)", ["2026-09", "2026-10"]]]) {
  const t1 = sum(T, ms), t0 = sum(T, prevY(ms)), c1 = sum(C, ms), c0 = sum(C, prevY(ms));
  const d = Math.log(t1 / t0) - Math.log(c1 / c0);
  console.log(`${label}: DE+FR+IT ${t0}->${t1} (${((t1 / t0 - 1) * 100).toFixed(1)}%), others ${c0}->${c1} (${((c1 / c0 - 1) * 100).toFixed(1)}%) => DE+FR+IT vs others ${((Math.exp(d) - 1) * 100).toFixed(1)}%;  spend DE+FR+IT ${Math.round(spend(T, prevY(ms)) / 1000)}k -> ${Math.round(spend(T, ms) / 1000)}k, others ${Math.round(spend(C, prevY(ms)) / 1000)}k -> ${Math.round(spend(C, ms) / 1000)}k`);
}
console.log("Noise for a 4-month / 2-month DE+FR+IT vs others comparison before Meta: SD of the log difference ~0.14-0.16 => only effects above ~35-60% are distinguishable.");
