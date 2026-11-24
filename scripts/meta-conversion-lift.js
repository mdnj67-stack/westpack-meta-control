/**
 * The whole-account Meta Conversion Lift test, ready to start on a go.
 *
 * Designed 2026-11-24 (see knowledge/meta-research/07-measurement-ladder.md and the measurement plan): one cell = the
 * whole ad account incl. awareness, 20 % holdout, three months, primary outcome the New_customer custom conversion
 * (after MCB's tagging fix), Purchase as a secondary outcome. With Navision's Jan-Mar volumes this detects a lift of
 * ~13 % (80 % power). The two lift tests of 2026 (JB Retargeting Jan-Feb, FR Conv 06 May-Jun) spent 1.1k and 4.4k kr
 * on Purchase and could not show anything either way - this design avoids both mistakes.
 *
 * Nothing is created without --apply. A study starts by itself at its start_time; Meta has no draft state.
 *
 *   node scripts/meta-conversion-lift.js                         dry run: the study it would create + existing studies
 *   node scripts/meta-conversion-lift.js --apply --start=2027-01-04 --end=2027-04-01 [--holdout=20]
 *
 * Dates are Copenhagen midnights; the end date is exclusive. Meta requires a start in the future. After the start the
 * holdout share and the account cannot be changed; start, cells and objectives can be edited until then.
 * API notes: studies live on the business node; `cooldown_start_time` is required although the guide calls it
 * deprecated (error 1840013); the custom-conversion field on an objective is `customconversions`.
 */
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { graphRequest } = require(path.join(ROOT, "server", "lib", "meta.js"));

const BUSINESS_ID = "347013055746322"; // Westpack A/S
const AD_ACCOUNT_ID = 77936603;
const NEW_CUSTOMER_CUSTOM_CONVERSION = "775766277988531"; // event new_customer, URL contains westpack
const PIXEL_ID = "153927735202325";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));

function copenhagenMidnight(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error(`Expected YYYY-MM-DD, got ${date}`);
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", timeZoneName: "shortOffset" })
    .formatToParts(new Date(utcMidnight)).find((p) => p.type === "timeZoneName").value; // "GMT+1" / "GMT+2"
  const hours = Number(offset.replace("GMT", "") || 0);
  return Math.floor((utcMidnight - hours * 3600e3) / 1000);
}

function buildStudy({ start, end, holdout }) {
  const startTs = copenhagenMidnight(start);
  const endTs = copenhagenMidnight(end);
  if (endTs <= startTs) throw new Error("The end date must be after the start date.");
  if (startTs * 1000 <= Date.now()) throw new Error("Meta requires a start in the future.");
  if (!(holdout >= 5 && holdout <= 50)) throw new Error("Holdout must be 5-50 %.");
  return {
    name: `Hele kontoen - nye kunder - Conversion Lift - ${start} til ${end}`,
    description: `Holdout ${holdout} % af hele kontoen (inkl. awareness). Primaert maal New_customer, sekundaert Purchase. `
      + "Aftalt foer start: 23 %+ = skaler inkl. DE/FR/IT; 9-15 % = som nu; ikke-signifikant er ikke nul.",
    type: "LIFT",
    start_time: startTs,
    cooldown_start_time: startTs,
    end_time: endTs,
    observation_end_time: endTs,
    cells: [{ name: "Hele kontoen", treatment_percentage: 100 - holdout, control_percentage: holdout, adaccounts: [AD_ACCOUNT_ID] }],
    objectives: [
      { name: "Nye kunder (New_customer)", type: "CONVERSIONS", is_primary: true, customconversions: [{ id: NEW_CUSTOMER_CUSTOM_CONVERSION }] },
      { name: "Purchase", type: "CONVERSIONS", is_primary: false, adspixels: [{ id: PIXEL_ID, event_names: ["Purchase"] }] }
    ]
  };
}

async function main() {
  const token = getConfig().metaAccessToken;
  const study = buildStudy({ start: args.start || "2027-01-04", end: args.end || "2027-04-01", holdout: Number(args.holdout || 20) });
  console.log("Study:", JSON.stringify({ ...study, start_time: new Date(study.start_time * 1000).toISOString(), end_time: new Date(study.end_time * 1000).toISOString() }, null, 1));

  const existing = await graphRequest(`/${BUSINESS_ID}/ad_studies`, token, { maxRetries: 0, params: { fields: "id,name,type,start_time,end_time,canceled_time", limit: 50 } });
  const lifts = existing.data.filter((s) => s.type === "LIFT");
  console.log("\nLift studies in the business:");
  lifts.forEach((s) => console.log(`  ${s.id}  ${s.start_time} -> ${s.end_time}${s.canceled_time ? " (canceled)" : ""}  ${s.name}`));
  const pending = lifts.filter((s) => !s.canceled_time && Date.parse(s.end_time) > Date.now());
  if (pending.length) console.log(`\n${pending.length} lift study/studies scheduled or running - check before creating another.`);

  if (!args.apply) { console.log("\nDry run. Add --apply to create it."); return; }
  if (pending.length && !args.force) throw new Error("A lift study is already scheduled or running. Re-run with --force only if that is intended.");

  const created = await graphRequest(`/${BUSINESS_ID}/ad_studies`, token, { method: "POST", maxRetries: 0, params: study });
  const readBack = await graphRequest(`/${created.id}`, token, { maxRetries: 0, params: {
    fields: "id,name,start_time,end_time,cells{name,treatment_percentage,control_percentage,adaccounts{id}},objectives{name,is_primary,customconversions,adspixels}"
  } });
  console.log("\nCreated:", JSON.stringify(readBack, null, 1));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
