/**
 * One-off follow-up on the Conv - 04 - EU - Standard budget raise.
 *
 * On 2026-09-30 the daily budget went from 2,000 to 2,500 DKK (60k -> 75k per 30 days) and AD09
 * (the carrier-bag carousel) was switched on in the same ad set. The criterion agreed beforehand:
 * if the first full week on the new budget does not bring more new customers than the 36 of each
 * of the two weeks before it, the extra money is not buying anything and the budget goes back.
 *
 * This compares Conv - 04 only against its own history. It runs on standard attribution, so it
 * must never be ranked against the incremental DE/FR/IT campaigns (see CLAUDE.md and the memory
 * on attribution settings). Figures are Meta-attributed, 7-day click / 1-day view, so the newest
 * week keeps rising for about seven days after it ends.
 *
 * Usage: node scripts/conv04-budget-followup.js [--out=report.html]
 * Writes an HTML report and prints its path. scripts/conv04-budget-followup.ps1 mails it.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { graphRequest, ensureAccountId } = require(path.join(ROOT, "server", "lib", "meta.js"));

const CAMPAIGN_ID = "52547986372452";
const AD09_ID = "52552585497652";
const RAISE_DATE = "2026-09-30";
const THRESHOLD_NEW_CUSTOMERS = 36;
const ACCOUNT_TZ = "America/Los_Angeles";

const WEEKS = [
  { label: "9.–15. sep", since: "2026-09-09", until: "2026-09-15", budget: "2.000" },
  { label: "16.–22. sep", since: "2026-09-16", until: "2026-09-22", budget: "2.000" },
  { label: "23.–29. sep", since: "2026-09-23", until: "2026-09-29", budget: "2.000" },
  { label: "30. sep–6. okt", since: "2026-09-30", until: "2026-10-06", budget: "2.500", isNew: true }
];

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
}

function yesterdayInAccountTz() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ACCOUNT_TZ }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const sumTypes = (list, types) => (list || []).filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
const kr = (n) => Math.round(n).toLocaleString("da-DK");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

(async () => {
  const config = getConfig();
  const token = config.metaAccessToken;
  const account = ensureAccountId(config.metaAdAccountId);
  const until = yesterdayInAccountTz();

  const conversions = await graphRequest(`/${account}/customconversions`, token, { params: { fields: "id,name,is_archived", limit: "100" } });
  const typeFor = (re) => (conversions.data || []).filter((c) => !c.is_archived && re.test(c.name)).map((c) => `offsite_conversion.custom.${c.id}`);
  const NEW = typeFor(/^new[_ ]?customers?$/i);
  const EXISTING = typeFor(/^existing[_ ]?customers?$/i);
  const PURCHASE = ["offsite_conversion.fb_pixel_purchase"];
  if (!NEW.length) throw new Error("No New_customer custom conversion found on the account.");

  const campaign = await graphRequest(`/${CAMPAIGN_ID}`, token, { params: { fields: "name,daily_budget,effective_status,adsets{name,learning_stage_info,effective_status}" } });
  const daily = await graphRequest(`/${CAMPAIGN_ID}/insights`, token, {
    params: { fields: "spend,impressions,actions,action_values", time_increment: "1", limit: "500", time_range: JSON.stringify({ since: WEEKS[0].since, until }) }
  });
  // Before the first full day on the new budget there is nothing after the raise to break down.
  const hasPostData = until >= RAISE_DATE;
  const countries = hasPostData ? await graphRequest(`/${CAMPAIGN_ID}/insights`, token, {
    params: { fields: "spend,actions", breakdowns: "country", limit: "200", time_range: JSON.stringify({ since: RAISE_DATE, until }) }
  }) : { data: [] };
  const ad09 = hasPostData ? await graphRequest(`/${AD09_ID}/insights`, token, {
    params: { fields: "spend,impressions,clicks,actions", time_range: JSON.stringify({ since: RAISE_DATE, until }) }
  }) : { data: [] };

  const rows = daily.data || [];
  const weeks = WEEKS.map((w) => {
    const days = rows.filter((r) => r.date_start >= w.since && r.date_start <= w.until);
    const spend = days.reduce((s, r) => s + Number(r.spend), 0);
    const impressions = days.reduce((s, r) => s + Number(r.impressions), 0);
    const newCustomers = days.reduce((s, r) => s + sumTypes(r.actions, NEW), 0);
    const existing = days.reduce((s, r) => s + sumTypes(r.actions, EXISTING), 0);
    const newRevenue = days.reduce((s, r) => s + sumTypes(r.action_values, NEW), 0);
    return { ...w, dayCount: days.length, spend, impressions, newCustomers, existing, newRevenue };
  });

  const current = weeks[weeks.length - 1];
  const complete = current.dayCount === 7;
  const passed = current.newCustomers > THRESHOLD_NEW_CUSTOMERS;
  const prev = weeks[weeks.length - 2];
  const extraSpend = current.spend - prev.spend;
  const extraNew = current.newCustomers - prev.newCustomers;

  const countryRows = (countries.data || []).map((r) => ({ c: r.country, spend: Number(r.spend), n: sumTypes(r.actions, NEW) }))
    .filter((r) => r.spend > 50).sort((a, b) => b.n - a.n || b.spend - a.spend);
  const weakMarkets = countryRows.filter((r) => r.n <= 1);
  const adRow = (ad09.data || [])[0] || {};
  const adset = (campaign.adsets?.data || [])[0] || {};
  const budgetNow = Number(campaign.daily_budget || 0) / 100;

  const verdict = passed
    ? `<b>Foreløbigt: ja.</b> Ugen på det nye budget har ${current.newCustomers} nye kunder mod tærsklen på ${THRESHOLD_NEW_CUSTOMERS}. De ekstra penge ser ud til at købe nye kunder.`
    : `<b>Foreløbigt: ikke endnu.</b> Ugen på det nye budget har ${current.newCustomers} nye kunder mod tærsklen på ${THRESHOLD_NEW_CUSTOMERS}. Tallet stiger stadig de næste dage (7-dages klik), så vent med at rulle tilbage til tallene er færdige omkring 13. oktober.`;

  const tr = (w) => `<tr${w.isNew ? ' style="background:#eef3f1;font-weight:600"' : ""}><td>${esc(w.label)}</td><td>${w.budget} kr.</td><td style="text-align:right">${kr(w.spend / Math.max(w.dayCount, 1))} kr.</td><td style="text-align:right">${w.newCustomers}</td><td style="text-align:right">${w.newCustomers ? kr(w.spend / w.newCustomers) + " kr." : "–"}</td><td style="text-align:right">${w.impressions ? (w.spend / w.impressions * 1000).toFixed(0) : "–"}</td><td style="text-align:right">${w.existing}</td></tr>`;

  const html = `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1d2522;max-width:680px">
<p>Hej Mads,</p>
<p>Her er opfølgningen på budgetløftet i <b>${esc(campaign.name)}</b> fra 2.000 til 2.500 kr./dag den 30. september (sammen med AD09-karrusellen).</p>
<p style="padding:10px 12px;border-left:4px solid #34453F;background:#f4f6f5">${verdict}</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:13px" border="1" bordercolor="#d9dedc">
<tr style="background:#34453F;color:#fff"><th align="left">Uge</th><th align="left">Budget/dag</th><th>Forbrug/dag</th><th>Nye kunder</th><th>Pris pr. ny</th><th>CPM</th><th>Eksist. kunder</th></tr>
${weeks.map(tr).join("\n")}
</table>
<p style="font-size:12px;color:#5b6461">Data til og med ${until}${complete ? "" : ` – den nye uge har kun ${current.dayCount} af 7 dage`}. Standardattribution (7 dages klik / 1 dags visning), så den nyeste uge stiger typisk i op til en uge endnu. Kampagnen er kun sammenlignet med sin egen historik, ikke med DE/FR/IT.</p>
${complete ? `<p><b>Marginalt:</b> ${kr(extraSpend)} kr. mere end ugen før gav ${extraNew >= 0 ? "+" : ""}${extraNew} nye kunder${extraNew > 0 ? ` – ca. ${kr(extraSpend / extraNew)} kr. pr. ekstra ny kunde` : ""}. Til sammenligning giver en ny kundes første ordre ca. 776 kr. i dækningsbidrag ved 50 % margin.</p>` : ""}
<p><b>AD09 (karrusellen):</b> ${kr(Number(adRow.spend || 0))} kr. brugt, ${Number(adRow.clicks || 0)} klik, ${sumTypes(adRow.actions, NEW)} nye kunder siden den blev slået til.</p>
<p><b>Markeder siden løftet</b> (nye kunder): ${countryRows.slice(0, 8).map((r) => `${r.c} ${r.n}`).join(" · ")}.<br>
${weakMarkets.length ? `${weakMarkets.length} markeder med højst 1 ny kunde brugte ${kr(weakMarkets.reduce((s, r) => s + r.spend, 0))} kr. (${weakMarkets.map((r) => r.c).join(", ")}).` : ""}</p>
<p style="font-size:12px;color:#5b6461">Status nu: budget ${kr(budgetNow)} kr./dag, ad set ${esc(adset.effective_status || "")} / learning: ${esc(adset.learning_stage_info?.status || "ukendt")}.</p>
<p>Den endelige vurdering kræver de færdige tal omkring 13. oktober. Vil du have det attributionsfrie svar (rigtige førstegangskøbere fra Klaviyo), så kør <code>node scripts/market-new-customer-lift.js</code>.</p>
<p>– Sendt automatisk fra westpack-meta-control (scripts/conv04-budget-followup.js)</p>
</body></html>`;

  const out = arg("out") || path.join(ROOT, "tmp", "conv04-followup", `report-${until}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");
  console.log(out);
  console.log(`SUBJECT:Conv - 04 efter budgetløft: ${current.newCustomers} nye kunder i ugen på 2.500 kr./dag${passed ? " (over tærsklen)" : " (under tærsklen, foreløbigt)"}`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
