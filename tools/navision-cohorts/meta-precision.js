// How precise is "cost per new customer" on Meta? Campaign level, last 30 days and week by week since
// the 9 Sep 2026 relaunch, on incremental attribution and Meta's standard attribution, with Poisson
// 95% intervals. Two insights calls, no retries. Run from the repo root.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { ensureAccountId } = require(path.join(ROOT, "server", "lib", "meta.js"));
const { SCRATCH } = require("./lib");
const NEW = "offsite_conversion.custom.775766277988531";
const UNTIL = process.env.UNTIL || "2026-11-03";
const SINCE30 = process.env.SINCE30 || "2026-10-05";
let token = "", calls = 0;

async function all(p, params) {
  const rows = []; let after = null;
  do {
    const url = new URL("https://graph.facebook.com/v25.0" + p);
    for (const [k, v] of Object.entries({ ...params, after, limit: "500" })) if (v != null && v !== "") url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    url.searchParams.set("access_token", token);
    calls++;
    const body = await (await fetch(url)).json();
    if (body.error) throw new Error(body.error.message);
    rows.push(...(body.data || []));
    after = body.paging && body.paging.next ? body.paging.cursors.after : null;
  } while (after);
  return rows;
}
const pick = (r) => {
  const a = (r.actions || []).find((x) => x.action_type === NEW) || {};
  return { name: r.campaign_name, start: r.date_start, spend: Number(r.spend || 0), ia: a.incrementality != null ? Number(a.incrementality) : 0, reported: Number(a.value || 0), click7: Number(a["7d_click"] || 0), view1: Number(a["1d_view"] || 0) };
};
// 95% interval for a count (exact Poisson via chi-square approximation by Wilson-Hilferty).
function poissonCI(n) {
  if (n <= 0) return [0, 3.69];
  const q = (k, z) => k * Math.pow(1 - 1 / (9 * k) + z / (3 * Math.sqrt(k)), 3);
  return [q(n, -1.96), q(n + 1, 1.96)];
}
const kr = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString("da-DK") : "–");

(async () => {
  const config = getConfig(); token = config.metaAccessToken;
  const account = ensureAccountId(config.metaAdAccountId);
  const windows = ["incrementality", "7d_click", "1d_view"];
  const last30 = (await all(`/${account}/insights`, { level: "campaign", time_range: { since: SINCE30, until: UNTIL }, fields: "campaign_name,objective,spend,actions", action_attribution_windows: windows })).map(pick);
  const weekly = (await all(`/${account}/insights`, { level: "campaign", time_range: { since: "2026-09-09", until: UNTIL }, time_increment: "7", fields: "campaign_name,spend,actions", action_attribution_windows: windows })).map(pick);
  fs.writeFileSync(path.join(SCRATCH, "data", "meta", "precision.json"), JSON.stringify({ last30, weekly, SINCE30, UNTIL }, null, 1));

  console.log(`Last 30 days ${SINCE30} - ${UNTIL} (incremental = Meta's model; reported = the ad set's own attribution)`);
  console.log("campaign".padEnd(34), "spend".padStart(8), "IA".padStart(5), "kr/IA".padStart(7), "95% range".padStart(15), "rep".padStart(5), "kr/rep".padStart(7), "IA/rep".padStart(7));
  for (const r of last30.filter((r) => r.spend > 3000).sort((a, b) => b.spend - a.spend)) {
    const [lo, hi] = poissonCI(r.ia);
    console.log(r.name.slice(0, 34).padEnd(34), kr(r.spend).padStart(8), String(Math.round(r.ia)).padStart(5), kr(r.spend / r.ia).padStart(7), `${kr(r.spend / hi)}–${kr(r.spend / lo)}`.padStart(15), String(Math.round(r.reported)).padStart(5), kr(r.spend / r.reported).padStart(7), (r.reported ? r.ia / r.reported : 0).toFixed(2).padStart(7));
  }
  const focus = ["Conv - 04 - EU - Standard", "Conv - 01 - DE", "Conv - 02 - FR", "Conv - 03 - IT"];
  console.log("\nWeek by week since the relaunch (week starting): spend / IA / kr per IA");
  for (const name of focus) {
    const rows = weekly.filter((r) => r.name === name).sort((a, b) => a.start.localeCompare(b.start));
    console.log(name.padEnd(28), rows.map((r) => `${r.start.slice(5)}: ${Math.round(r.spend / 1000)}k/${Math.round(r.ia)}/${r.ia ? kr(r.spend / r.ia) : "–"}`).join("  "));
  }
  console.log(`\n${calls} calls`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
