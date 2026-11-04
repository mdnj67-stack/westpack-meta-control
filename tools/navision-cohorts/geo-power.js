// How noisy is "treated market vs control" before any Meta, by control choice and window length?
// For each start month in May 2019 - (Aug 2024 - window), compare the window with the same months a
// year earlier: d = log(T1/T0) - log(C1/C0). The spread (SD) of d across starts, when nothing was
// switched on, is the noise a real test must beat. MDE (80% power, 5% two-sided) ~ 2.8 x SD.
// Controls: ES alone; a fixed basket; and a synthetic control fitted on 2019-2022, judged on 2022-2024.
const { loadRun, ym, FULL_TAG } = require("./lib");
const { customers } = loadRun(FULL_TAG);
const nc = {};
for (const c of customers) if (c.period === "Nu" && c.salesToCutoff > 0) { const k = `${c.country}|${ym(c.first)}`; nc[k] = (nc[k] || 0) + 1; }
const shift = (m, d) => { const t = new Date(`${m}-01T00:00:00Z`); t.setUTCMonth(t.getUTCMonth() + d); return t.toISOString().slice(0, 7); };
const range = (a, b) => { const o = []; for (let m = a; m <= b; m = shift(m, 1)) o.push(m); return o; };
const sum = (ccs, ms) => ms.reduce((s, m) => s + ccs.reduce((t, cc) => t + (nc[`${cc}|${m}`] || 0), 0), 0);

const DONORS = ["DE", "FR", "GB", "NL", "PL", "ES", "DK", "BE", "SE", "FI", "PT", "AT", "CH", "IE", "US"];
function noise(treated, control, len, from = process.env.FROM || "2020-05", to = "2024-08") {
  const ds = [];
  for (let s = from; shift(s, len - 1) <= to; s = shift(s, 1)) {
    const ms = range(s, shift(s, len - 1)), prev = ms.map((m) => shift(m, -12));
    const T1 = sum(treated, ms), T0 = sum(treated, prev), C1 = sum(control, ms), C0 = sum(control, prev);
    if (!T1 || !T0 || !C1 || !C0) continue;
    ds.push(Math.log(T1 / T0) - Math.log(C1 / C0));
  }
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / (ds.length - 1));
  return { sd, mde: Math.exp(2.8 * sd) - 1, n: ds.length };
}
const pct = (v) => `${Math.round(v * 100)}%`.padStart(5);
const row = (label, t, c) => console.log(label.padEnd(40), [3, 6, 12].map((L) => { const r = noise(t, c, L); return `${L}m: sd ${r.sd.toFixed(2)} MDE ${pct(r.mde)}`; }).join("   "));

console.log("Noise before Meta (windows starting May 2020 - Aug 2024, each vs a year earlier). MDE = smallest effect a test of that length would reliably detect.");
row("IT vs ES", ["IT"], ["ES"]);
row("IT vs ES+PT", ["IT"], ["ES", "PT"]);
row("IT vs all other markets", ["IT"], DONORS);
row("ES vs all other markets", ["ES"], DONORS.filter((c) => c !== "ES"));
row("IT+ES vs all other markets", ["IT", "ES"], DONORS.filter((c) => c !== "ES"));
row("DE vs all other markets", ["DE"], DONORS.filter((c) => c !== "DE"));
row("FR vs all other markets", ["FR"], DONORS.filter((c) => c !== "FR"));
row("half the EU-campaign markets vs other half", ["NL", "BE", "SE", "FI", "AT", "IE", "PT"], ["PL", "DK", "CH", "ES", "GB"]);
row("DE+FR+IT vs all other markets", ["DE", "FR", "IT"], DONORS.filter((c) => !["DE", "FR"].includes(c)));

// Monthly volumes for scale.
const vol = (cc) => Math.round(sum([cc], range("2025-05", "2026-04")) / 12);
console.log("\nAverage paying new customers a month, May 2025 - Apr 2026:", ["IT", "ES", "DE", "FR", "GB", "NL", "PL", "DK", "PT"].map((cc) => `${cc} ${vol(cc)}`).join(", "));
