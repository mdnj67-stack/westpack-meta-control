// Monthly Meta spend and results per country, for the management deck.
// A handful of account-level calls; no retries (a rate limit stops the run, as in scripts/).
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { ensureAccountId } = require(path.join(ROOT, "server", "lib", "meta.js"));
const { resolveCustomerConversionActionTypes } = require(path.join(ROOT, "server", "meta", "customer-acquisition.js"));
const { SCRATCH } = require("./lib");

const GRAPH = "https://graph.facebook.com/v25.0";
const OUT = path.join(SCRATCH, "data", "meta");
fs.mkdirSync(OUT, { recursive: true });
let calls = 0;
let token = "";

async function get(p, params = {}) {
  const url = new URL(GRAPH + p);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  url.searchParams.set("access_token", token);
  calls++;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Meta ${p}: ${(body.error && body.error.message) || res.status}`);
  return body;
}
async function all(p, params) {
  const rows = [];
  let after = null;
  do {
    const page = await get(p, { ...params, after, limit: "500" });
    rows.push(...(page.data || []));
    after = page.paging && page.paging.next ? page.paging.cursors.after : null;
  } while (after);
  return rows;
}

(async () => {
  const config = getConfig();
  token = config.metaAccessToken;
  const account = ensureAccountId(config.metaAdAccountId);
  const until = "2026-11-03";

  const conversions = await all(`/${account}/customconversions`, { fields: "id,name,custom_event_type,is_archived,creation_time" });
  const types = resolveCustomerConversionActionTypes(conversions);
  fs.writeFileSync(path.join(OUT, "custom-conversions.json"), JSON.stringify({ conversions, types }, null, 1));

  // 1. Spend by country and month, all objectives, as far back as Meta keeps it.
  const spend = await all(`/${account}/insights`, {
    level: "account", breakdowns: "country", time_increment: "monthly",
    time_range: { since: "2023-11-01", until }, fields: "spend,impressions,reach,inline_link_clicks",
  });
  fs.writeFileSync(path.join(OUT, "spend-country-month.json"), JSON.stringify(spend));

  // 2. The same, awareness campaigns only, so conversion = all - awareness.
  const awareness = await all(`/${account}/insights`, {
    level: "account", breakdowns: "country", time_increment: "monthly",
    time_range: { since: "2023-11-01", until }, fields: "spend,impressions",
    filtering: [{ field: "campaign.objective", operator: "IN", value: ["OUTCOME_AWARENESS", "BRAND_AWARENESS", "REACH"] }],
  });
  fs.writeFileSync(path.join(OUT, "awareness-country-month.json"), JSON.stringify(awareness));

  // 3. New customers and purchases by country and month, on incremental attribution, since the
  //    New_customer conversion exists (2024-10-22).
  const results = await all(`/${account}/insights`, {
    level: "account", breakdowns: "country", time_increment: "monthly",
    time_range: { since: "2024-10-01", until }, fields: "spend,actions,action_values",
    action_attribution_windows: ["incrementality", "7d_click", "1d_view"],
  });
  fs.writeFileSync(path.join(OUT, "results-country-month.json"), JSON.stringify(results));

  console.log(JSON.stringify({ calls, spendRows: spend.length, awarenessRows: awareness.length, resultRows: results.length, newCustomerTypes: types.newCustomerActionTypes, resolved: types.resolved }, null, 1));
})().catch((e) => { console.error("FAILED after", calls, "calls:", e.message); process.exit(1); });
