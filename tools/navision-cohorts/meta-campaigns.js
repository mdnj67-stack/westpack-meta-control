// Campaign-level spend and new customers (incremental, 7d click, 1d view, as reported) for two windows.
// Two calls, no retries.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { ensureAccountId } = require(path.join(ROOT, "server", "lib", "meta.js"));
const { SCRATCH } = require("./lib");
const OUT = path.join(SCRATCH, "data", "meta");
const NEW = "offsite_conversion.custom.775766277988531";
let token = "";
async function all(p, params) {
  const rows = []; let after = null;
  do {
    const url = new URL("https://graph.facebook.com/v25.0" + p);
    for (const [k, v] of Object.entries({ ...params, after, limit: "500" })) if (v != null && v !== "") url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    url.searchParams.set("access_token", token);
    const body = await (await fetch(url)).json();
    if (body.error) throw new Error(body.error.message);
    rows.push(...(body.data || []));
    after = body.paging && body.paging.next ? body.paging.cursors.after : null;
  } while (after);
  return rows;
}
(async () => {
  const config = getConfig(); token = config.metaAccessToken;
  const account = ensureAccountId(config.metaAdAccountId);
  const out = {};
  for (const [label, since, until] of [["last90", "2026-08-05", "2026-11-02"], ["apr25-oct26", "2025-04-01", "2026-10-31"]]) {
    const rows = await all(`/${account}/insights`, { level: "campaign", time_range: { since, until }, fields: "campaign_name,objective,spend,actions", action_attribution_windows: ["incrementality", "7d_click", "1d_view"] });
    out[label] = rows.map((r) => {
      const a = (r.actions || []).find((x) => x.action_type === NEW) || {};
      return { name: r.campaign_name, objective: r.objective, spend: Number(r.spend), ia: a.incrementality != null ? Number(a.incrementality) : null, click7: Number(a["7d_click"] || 0), view1: Number(a["1d_view"] || 0), reported: Number(a.value || 0) };
    }).filter((r) => r.spend > 1000).sort((a, b) => b.spend - a.spend);
    console.log(`\n${label} (${since} - ${until})`);
    for (const r of out[label].slice(0, 16)) console.log(r.name.slice(0, 38).padEnd(38), r.objective.padEnd(18), String(Math.round(r.spend)).padStart(8), "IA", String(r.ia ?? "–").padStart(5), "kr/IA", r.ia ? String(Math.round(r.spend / r.ia)).padStart(6) : "     –", "reported", String(r.reported).padStart(4));
  }
  fs.writeFileSync(path.join(OUT, "campaigns.json"), JSON.stringify(out, null, 1));
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
