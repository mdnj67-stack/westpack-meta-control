/**
 * EU budget pilot, read once a morning: does Conv - 04 - EU's last budget step still pay for itself, and does anything
 * point to it stopping? Rules in server/meta/budget-pilot.js. Read-only: it never changes a budget.
 *
 * Four Graph calls (conversions, campaign, daily insights, reach for two weeks). The last complete day is yesterday
 * in the ad account's time zone (America/Los_Angeles), i.e. from 09:00 Danish time.
 *
 * Usage: node scripts/eu-budget-pilot.js [--backtest[=YYYY-MM-DD]] [--json]
 */

const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { graphRequest, ensureAccountId } = require(path.join(ROOT, "server", "lib", "meta.js"));
const pilot = require(path.join(ROOT, "server", "meta", "budget-pilot.js"));

const ACCOUNT_TZ = "America/Los_Angeles";
const dayInAccountTz = (offset) => pilot.addDays(new Intl.DateTimeFormat("en-CA", { timeZone: ACCOUNT_TZ }).format(new Date()), offset);
const arg = (name) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] || true : null;
};

// GET parameters that are objects or arrays go to Graph as JSON. No retries: a rate limit stops the run instead of
// spending more of the quota the team's dashboard shares.
async function get(p, token, params = {}) {
  const enc = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v && typeof v === "object" ? JSON.stringify(v) : v]));
  return graphRequest(p, token, { maxRetries: 0, params: enc });
}
async function all(p, token, params) {
  const rows = [];
  let after = null;
  do {
    const page = await get(p, token, { ...params, after });
    rows.push(...(page.data || []));
    after = page.paging && page.paging.next ? page.paging.cursors.after : null;
  } while (after);
  return rows;
}

const kr = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("da-DK") : "–");
const dec = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
const pct = (n) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${Math.round(n * 100)} %` : "–");
const dm = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
const wd = (iso) => ["søn", "man", "tir", "ons", "tor", "fre", "lør"][new Date(`${iso}T12:00:00Z`).getUTCDay()];

const VERDICT = {
  hold: "HOLD - budgettet bliver",
  watch: "HOLD, MEN KIG IGEN I MORGEN",
  down: "SÆNK ét trin",
  down_now: "SÆNK ét trin nu (nødbremse)",
  up_room: "PLADS TIL AT HÆVE ét trin (din beslutning)",
  cooldown: "HOLD - for tidligt at dømme det nye niveau",
  no_base: "INTET KRAV - intet lavere niveau er målt"
};
const SIGNAL_LABEL = {
  cpm: "Pris (CPM), 3 dage mod samme ugedage ugen før",
  ctr: "Klikrate, 7 dage mod de 7 før",
  buyers: "Køb pr. klik (7-dages klik), 7 dage mod de 7 før",
  frequency: "Frekvens, 7 dage mod de 7 før",
  pace: "Nye kunder, 3 dage mod samme dage ugen før"
};
function signalValue(key, v) {
  if (key === "cpm") return `${dec(v.now)} mod ${dec(v.before)} kr.`;
  if (key === "ctr") return `${dec(v.now * 100, 2)} mod ${dec(v.before * 100, 2)} %`;
  if (key === "buyers") return `${dec(v.now * 1000, 1)} mod ${dec(v.before * 1000, 1)} pr. 1.000 klik`;
  if (key === "frequency") return `${dec(v.now, 2)} mod ${dec(v.before, 2)}`;
  return `${v.now} mod ${v.before} (inkr. + 7-dages klik)`;
}

function reason(r) {
  const req = r.requirement;
  if (!req) return "Der er ikke målt et lavere budgetniveau i mindst 7 dage, så trinnet kan ikke regnes hjem.";
  const under = [r.margin.nci < 0 ? "inkrementelle" : null, r.margin.nc7 < 0 ? "7-dages klik" : null].filter(Boolean);
  switch (r.verdict) {
    case "down_now":
      return `Nye kunder de sidste 3 dage er faldet mindst 40 % mod samme ugedage ugen før på begge mål, tempoet er under kravet, og pris eller køb pr. klik bekræfter det.`;
    case "cooldown":
      return `Niveauet har kun kørt ${r.daysAtLevel} dage; der skal en hel uge til at dømme det. Nødbremsen er stadig aktiv.`;
    case "down":
      if (r.outcome === "red") return "Under kravet på begge mål de sidste 7 dage: de ekstra penge betaler sig ikke længere.";
      if (r.outcome === "amber") return `Under kravet på ${under.join(" og ")}, og ${r.pressure} pres-point forklarer hvorfor - det er ikke støj.`;
      return `Lige over kravet (svageste mål ${pct(r.weakest)}), men ${r.pressure} pres-point peger nedad - samme mønster som sidste år lige før faldet.`;
    case "watch":
      if (r.outcome === "amber") return `Under kravet på ${under.join(" og ")}, men kun ${r.pressure} pres-point: kan være støj. Kig igen i morgen.`;
      return r.weakest < 0.1 ? `Tæt på kravet (svageste mål ${pct(r.weakest)}). Kig igen i morgen.` : `Over kravet, men ${r.pressure} pres-point. Kig igen i morgen.`;
    case "up_room":
      return "Mindst 30 % over kravet på begge mål to uger i træk, og intet pres. Et trin op skal selv tjene sit krav ugen efter.";
    default:
      return `Over kravet på begge mål (svageste ${pct(r.weakest)}) og ${r.pressure} pres-point.`;
  }
}

function report(r, campaign) {
  const req = r.requirement;
  const lines = [];
  lines.push(`EU-budgetpilot · data til og med ${wd(r.asOf)} ${dm(r.asOf)} (kontoens dag)`);
  lines.push(`${campaign.name}: ${kr(r.level.daily)} kr./dag siden ${dm(r.level.from)} (${r.daysAtLevel} dage)${r.level.detected ? " - nyt niveau fundet ud fra forbruget" : ""}`);
  lines.push("");
  lines.push(`BESLUTNING: ${VERDICT[r.verdict]}${r.target !== r.level.daily && r.target != null ? ` -> ${kr(r.target)} kr./dag` : ""}`);
  lines.push(reason(r));
  lines.push("");
  if (req) {
    lines.push(`Nye kunder, 7 dage ${dm(pilot.addDays(r.asOf, -6))}-${dm(r.asOf)} (forbrug ${kr(r.last7.spend)} kr.):`);
    lines.push(`  inkrementelle  ${String(r.last7.nci).padStart(3)}   krav ${dec(req.nci, 0).padStart(3)}   ${pct(r.margin.nci)}   (${kr(r.last7.spend / r.last7.nci)} kr. pr. kunde)`);
    lines.push(`  7-dages klik   ${String(r.last7.nc7).padStart(3)}   krav ${dec(req.nc7, 0).padStart(3)}   ${pct(r.margin.nc7)}   (${kr(r.last7.spend / r.last7.nc7)} kr. pr. kunde)`);
    lines.push(`  Kravet: ${kr(req.base.daily)} kr./dag gav ${dec(req.base.nciPerDay * 7, 0)} / ${dec(req.base.nc7PerDay * 7, 0)} om ugen (${dm(req.base.measuredFrom)}-${dm(req.base.measuredTo)}); de ekstra ${kr(r.level.daily - req.base.daily)} kr./dag skal give ${dec(req.extraPerWeek, 1)} mere om ugen (${kr(pilot.DEFAULTS.breakEven)} kr. pr. kunde).`);
    lines.push("");
  }
  lines.push(`Pres: ${r.pressure} af 10 point`);
  for (const [k, v] of Object.entries(r.signals)) {
    lines.push(`  ${"●".repeat(v.points)}${"○".repeat(2 - v.points)}  ${SIGNAL_LABEL[k]}: ${signalValue(k, v)} (${pct(v.change)})`);
  }
  lines.push("");
  lines.push("Regler: sænk når begge mål er under kravet; eller ét under + mindst 3 pres-point; eller lige over (<10 %) + mindst 5 pres-point.");
  lines.push("Nødbremse: nye kunder -40 % mod samme ugedage ugen før på begge mål, under kravets tempo, og pris eller køb pr. klik bekræfter. Ellers ingen dom de første 7 dage på et nyt niveau.");
  lines.push("Hæv-plads: 30 % over kravet på begge mål to uger i træk, højst 1 pres-point, mindst 14 dage på niveauet.");
  return lines.join("\n");
}

(async () => {
  const config = getConfig();
  const token = config.metaAccessToken;
  const account = ensureAccountId(config.metaAdAccountId);
  const asOf = dayInAccountTz(-1);
  const id = pilot.EU_CAMPAIGN_ID;
  const since = pilot.addDays(pilot.EU_BUDGET_HISTORY[0].from, -14);

  const [conversions, campaign, rows, reachRows] = await Promise.all([
    all(`/${account}/customconversions`, token, { fields: "id,name,is_archived", limit: 100 }),
    get(`/${id}`, token, { fields: "name,daily_budget,effective_status" }),
    all(`/${id}/insights`, token, {
      time_increment: 1, time_range: { since, until: asOf }, action_attribution_windows: ["7d_click", "incrementality"],
      fields: "spend,impressions,inline_link_clicks,actions", limit: 500
    }),
    get(`/${id}/insights`, token, {
      time_ranges: [{ since: pilot.addDays(asOf, -6), until: asOf }, { since: pilot.addDays(asOf, -13), until: pilot.addDays(asOf, -7) }],
      fields: "reach,impressions"
    })
  ]);
  const ncTypes = pilot.newCustomerActionTypes(conversions);
  if (!ncTypes.length) throw new Error("No New_customer custom conversion found on the account.");
  const days = rows.map((r) => pilot.normaliseDay(r, ncTypes));
  const history = pilot.withLiveBudget(pilot.EU_BUDGET_HISTORY, Number(campaign.daily_budget) / 100, days, asOf);
  const byStart = Object.fromEntries((reachRows.data || []).map((r) => [r.date_start, { reach: Number(r.reach), impressions: Number(r.impressions) }]));
  const reach = { current: byStart[pilot.addDays(asOf, -6)], previous: byStart[pilot.addDays(asOf, -13)] };

  const backtest = arg("backtest");
  if (backtest) {
    const from = backtest === true ? "2026-10-20" : backtest;
    console.log("dag        niveau  inkr/krav  7dc/krav  pres  dom");
    for (let d = from; d <= asOf; d = pilot.addDays(d, 1)) {
      const r = pilot.evaluate({ days, history, asOf: d });
      const req = r.requirement;
      console.log(`${wd(d)} ${dm(d).padEnd(6)} ${kr(r.level?.daily).padStart(6)}  ${req ? `${String(r.last7.nci).padStart(3)}/${dec(req.nci, 0).padStart(3)}` : "    -  "}   ${req ? `${String(r.last7.nc7).padStart(3)}/${dec(req.nc7, 0).padStart(3)}` : "   -   "}   ${String(r.pressure).padStart(2)}   ${r.verdict}${r.target && r.target !== r.level?.daily ? ` -> ${r.target}` : ""}`);
    }
    console.log("(frekvens indgår ikke i tilbageblikket)");
    return;
  }

  const result = pilot.evaluate({ days, history, asOf, reach });
  if (arg("json")) console.log(JSON.stringify({ campaign, ...result }, null, 1));
  else console.log(report(result, campaign));
  if (campaign.effective_status !== "ACTIVE") console.log(`\nOBS: kampagnen står som ${campaign.effective_status}.`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
