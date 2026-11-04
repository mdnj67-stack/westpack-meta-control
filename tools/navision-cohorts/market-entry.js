// The market-entry case for DE, FR and IT, from measured data only:
//  1. how big each market is against how much Westpack wins there (Eurostat business counts),
//  2. what a customer there is worth over 5½ years (cohorts 2020-21, fully measured) and 3½ years (2022-24),
//  3. the investment curve ("J-curve") of 30 days of spend in the local campaigns,
//  4. awareness spend per market on top.
// Eurostat: sbs_ovw_act (enterprises, 2022) for NACE 47.77 (watches and jewellery) and 47 (all retail);
// demo_pjan population 1 Jan 2025. Fetched live; written to data/market-entry.json.
const fs = require("fs");
const path = require("path");
const { SCRATCH, ym } = require("./lib");
const { loadMeta } = require("./meta-load");

const EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
async function eurostat(dataset, params) {
  const q = new URLSearchParams({ format: "JSON", lang: "EN", ...params });
  const j = await (await fetch(`${EUROSTAT}/${dataset}?${q}`)).json();
  if (j.error) throw new Error(`${dataset}: ${JSON.stringify(j.error)}`);
  const out = {};
  for (const [code, i] of Object.entries(j.dimension.geo.category.index)) if (j.value[i] != null) out[code] = j.value[i];
  return out;
}

(async () => {
  const jewellers = await eurostat("sbs_ovw_act", { nace_r2: "G4777", indic_sbs: "ENT_NR", time: "2022" });
  const retail = await eurostat("sbs_ovw_act", { nace_r2: "G47", indic_sbs: "ENT_NR", time: "2022" });
  const pop = await eurostat("demo_pjan", { age: "TOTAL", sex: "T", time: "2025" });

  const all = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "cohorts", "customers.json"), "utf8")).filter((c) => c.total > 0);
  // New paying customers in fiscal year 2025/26 (May 2025 - Apr 2026), by customer country.
  const fy25 = {};
  for (const c of all) if (c.fy0 === 2025) fy25[c.country] = (fy25[c.country] || 0) + 1;
  const toEu = (cc) => (cc === "GR" ? "EL" : cc);
  const markets = ["DK", "NL", "SE", "BE", "FR", "AT", "DE", "PL", "FI", "PT", "ES", "IT", "CZ", "HU", "IE", "NO"];
  const pen = markets.map((cc) => ({
    cc, newFy25: fy25[cc] || 0, jewellers: jewellers[toEu(cc)] ?? null, retail: retail[toEu(cc)] ?? null, pop: pop[toEu(cc)] ?? null,
  })).map((r) => ({ ...r, per100Jewellers: r.jewellers ? (r.newFy25 / r.jewellers) * 100 : null, per10kRetail: r.retail ? (r.newFy25 / r.retail) * 1e4 : null, perMillion: r.pop ? r.newFy25 / (r.pop / 1e6) : null }));
  console.log("cc  new FY25  jewellers  per100J  retail    per10kR  pop(m)  perM");
  for (const r of pen.sort((a, b) => (b.per100Jewellers ?? 0) - (a.per100Jewellers ?? 0))) {
    console.log(r.cc.padEnd(3), String(r.newFy25).padStart(8), String(r.jewellers ?? "–").padStart(10), (r.per100Jewellers ?? 0).toFixed(1).padStart(8), String(r.retail ?? "–").padStart(9), (r.per10kRetail ?? 0).toFixed(1).padStart(8), ((r.pop ?? 0) / 1e6).toFixed(1).padStart(7), (r.perMillion ?? 0).toFixed(0).padStart(5));
  }

  // Value per customer by market: cumulative sales through each fiscal year after acquisition.
  const curve = (ccs, from, to, maxT) => {
    const set = new Set(ccs);
    let cum = 0;
    const out = [];
    for (let t = 0; t <= maxT; t++) {
      const el = all.filter((c) => set.has(c.country) && c.fy0 >= from && c.fy0 <= to && c.fy0 + t <= 2025);
      if (el.length < 100) break;
      cum += el.reduce((s, c) => s + (c.sales[c.fy0 + t] || 0), 0) / el.length;
      out.push({ t, cum: Math.round(cum), n: el.length });
    }
    return out;
  };
  const EU = ["GB", "NL", "BE", "PL", "ES", "PT", "SE", "FI", "AT", "CH", "IE", "NO", "CZ", "SK", "HU", "RO", "GR", "HR", "BG", "LU", "EE", "LV", "LT", "SI"];
  const groups = { EU, IT: ["IT"], DE: ["DE"], FR: ["FR"], ALL: null };
  const value = {};
  for (const [k, ccs] of Object.entries(groups)) {
    const list = ccs || [...new Set(all.map((c) => c.country))];
    value[k] = { recent: curve(list, 2022, 2024, 3), older: curve(list, 2020, 2021, 5) };
    console.log(`${k.padEnd(4)} recent ${value[k].recent.map((x) => `${x.cum}(n${x.n})`).join(" ")} | 2020-21 ${value[k].older.map((x) => `${x.cum}(n${x.n})`).join(" ")}`);
  }
  // Retention by market (year after acquisition), cohorts 2020-24. Only customers invoiced in their acquisition year:
  // a first order invoiced after 30 April lands in the next fiscal year and would otherwise count as a repurchase
  // (3-6 % of each cohort; it put the all-market rate at 32 % instead of 29.5 %).
  for (const k of ["IT", "DE", "FR", "EU"]) {
    const set = new Set(groups[k]);
    const el = all.filter((c) => set.has(c.country) && c.fy0 >= 2020 && c.fy0 <= 2024 && (c.sales[c.fy0] || 0) > 0);
    console.log(`${k} bought again next FY: ${Math.round((el.filter((c) => (c.sales[c.fy0 + 1] || 0) > 0).length / el.length) * 100)}% (n ${el.length})`);
  }

  // Investment curve for 30 days of spend: contribution (45%) from the customers it buys, minus the spend.
  // Spend and Meta's incremental new customers = the last 30 days of the current setup (meta-precision.js).
  const P = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "meta", "precision.json"), "utf8")).last30;
  const c30 = (name) => { const r = P.find((x) => x.name === name); return { cpa: r.spend / r.ia, spend30: r.spend }; };
  const camp = { EU: c30("Conv - 04 - EU - Standard"), IT: c30("Conv - 03 - IT"), DE: c30("Conv - 01 - DE"), FR: c30("Conv - 02 - FR") };
  const jcurve = {};
  for (const [k, c] of Object.entries(camp)) {
    const customers = c.spend30 / c.cpa;
    jcurve[k] = {
      spend30: Math.round(c.spend30), customers: Math.round(customers * 10) / 10,
      recent: value[k].recent.map((x) => Math.round(customers * x.cum * 0.45 - c.spend30)),
      older: value[k].older.map((x) => Math.round(customers * x.cum * 0.45 - c.spend30)),
    };
    console.log(`${k} spend/30d ${jcurve[k].spend30} customers ${jcurve[k].customers} net: recent ${jcurve[k].recent.join(" / ")} | 2020-21 behaviour ${jcurve[k].older.join(" / ")}`);
  }
  const sum = (key) => jcurve.IT[key].map((_, i) => (jcurve.IT[key][i] ?? 0) + (jcurve.DE[key][i] ?? 0) + (jcurve.FR[key][i] ?? 0));
  console.log("DE+FR+IT net per 30 days: recent", sum("recent").join(" / "), "| 2020-21 behaviour", sum("older").join(" / "));

  // Awareness spend per market in the SAME 30 days as the conversion spend above (precision.json's window), each month
  // prorated by its days inside the window. An Aug-Oct average once stood in for it and understated DE+FR+IT by a
  // quarter (67k against 88k), because awareness rose every month after the relaunch.
  const meta = loadMeta();
  const { SINCE30, UNTIL } = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "meta", "precision.json"), "utf8"));
  const day = (s) => new Date(`${s}T00:00:00Z`).getTime() / 864e5;
  const share = (month) => {
    const first = day(`${month}-01`);
    const end = Math.min(first + new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate() - 1, day(UNTIL)); // the Meta data stop at UNTIL
    const overlap = end - Math.max(first, day(SINCE30)) + 1;
    return overlap > 0 ? overlap / (end - first + 1) : 0;
  };
  const aware = {};
  for (const v of Object.values(meta)) { const f = share(v.month); if (f) aware[v.country] = (aware[v.country] || 0) + v.aware * f; }
  console.log(`Awareness ${SINCE30} - ${UNTIL}:`, ["DE", "FR", "IT", "ES", "GB", "NL"].map((cc) => `${cc} ${Math.round(aware[cc] || 0)}`).join(", "));

  fs.writeFileSync(path.join(SCRATCH, "data", "market-entry.json"), JSON.stringify({ pen, value, jcurve, aware }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
