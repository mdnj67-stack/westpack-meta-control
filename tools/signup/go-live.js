/**
 * Signup Lab go-live: where launch stands, and the Klaviyo half of switching over.
 *
 * Going live is two things done in the same few minutes (signup/IMPLEMENTERING.md):
 *   1. LIVE = true in signup/core/markets.js, committed and deployed;
 *   2. The Insert popups unpublished in all 18 Klaviyo accounts, or every visitor gets two popups.
 * This script does the second half, never the first, and only with --apply. Without it every command is a dry run.
 *
 * Usage:
 *   node tools/signup/go-live.js status                  production's switch, and which Insert popups are live
 *   node tools/signup/go-live.js unpublish [--apply]     unpublish every live "Popup - The Insert" form
 *   node tools/signup/go-live.js republish [--apply]     roll back: publish again exactly the forms unpublish took
 *                                                        down (recorded in tmp/signup-go-live-unpublished.json), or
 *                                                        the ones given as MARKET:formId arguments
 *
 * Only forms named "... - Popup - The Insert ..." are touched. The embedded forms (front page, newsletter page)
 * stay, and so does the "Always on sale" flyout, which shows only on sale and outlet pages - the pages the Signup
 * Lab stays away from.
 */
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
process.chdir(ROOT);
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));

const PROD = "https://project-4fcxa.vercel.app";
const REV = "2026-10-15";
const INSERT = / - Popup - The Insert\b/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = require("fs");
const RECORD = path.join(ROOT, "tmp", "signup-go-live-unpublished.json");

function accounts() {
  let m = getConfig().klaviyoMarketsJson;
  if (typeof m === "string") m = JSON.parse(m);
  return (m || []).filter((x) => x && x.privateKey && x.country);
}
async function kv(key, url, { method = "GET", body } = {}) {
  for (let a = 0; a < 6; a++) {
    const res = await fetch(url.startsWith("http") ? url : `https://a.klaviyo.com${url}`, {
      method,
      headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: REV, accept: "application/vnd.api+json", ...(body ? { "content-type": "application/vnd.api+json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep((Number(res.headers.get("retry-after") || 3) + 1) * 1000); continue; }
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
    return { status: res.status, json };
  }
  return { status: 429, json: { errors: [{ detail: "throttled after retries" }] } };
}
async function forms(key, status) {
  const out = [];
  let url = `/api/forms/?filter=equals(status,'${status}')&fields[form]=name,status,updated_at`;
  while (url) {
    const r = await kv(key, url);
    if (r.status >= 400) throw new Error(`forms ${status}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    out.push(...(r.json.data || []));
    url = r.json.links && r.json.links.next;
  }
  return out;
}
async function liveVersions(key, id) {
  const r = await kv(key, `/api/forms/${id}/form-versions`);
  return (r.json.data || []).filter((v) => v.attributes.status === "live").length;
}

async function productionSwitch() {
  try {
    const js = await (await fetch(`${PROD}/signup/core/markets.js?nocache=${Date.now()}`)).text();
    const m = js.match(/const LIVE = (true|false);/);
    return m ? m[1] === "true" : null;
  } catch (e) { return null; }
}

async function status() {
  const live = await productionSwitch();
  console.log(`Production switch (signup/core/markets.js): ${live === null ? "could not read" : live ? "LIVE = true - the stores run the Signup Lab" : "LIVE = false - the stores' tag does nothing but ?wps=preview"}`);
  console.log("\nThe Insert popups in Klaviyo:");
  let liveCount = 0;
  for (const a of accounts()) {
    const all = [...(await forms(a.privateKey, "live")), ...(await forms(a.privateKey, "draft"))].filter((f) => INSERT.test(f.attributes.name));
    const shown = all.map((f) => `${f.id} ${f.attributes.status}`).join(", ") || "none";
    liveCount += all.filter((f) => f.attributes.status === "live").length;
    console.log(`  ${a.country.padEnd(3)} ${shown}`);
  }
  console.log(`\n${liveCount} live.`);
  if (live && liveCount) console.log("WARNING: the Signup Lab is live and so are Insert popups - visitors can get two popups.");
  if (live === false && !liveCount) console.log("WARNING: nothing collects signups by popup right now.");
}

async function publishJob(a, id, publish) {
  const r = await kv(a.privateKey, `/api/form-${publish ? "" : "un"}publish-jobs`, { method: "POST", body: { data: { type: `form-${publish ? "" : "un"}publish-job`, relationships: { form: { data: { type: "form", id } } } } } });
  const after = await liveVersions(a.privateKey, id);
  return { ok: r.status < 300 && (publish ? after > 0 : after === 0), status: r.status, after, detail: r.status >= 300 ? JSON.stringify(r.json.errors || r.json).slice(0, 200) : "" };
}

async function unpublish(apply) {
  const done = [];
  for (const a of accounts()) {
    for (const f of (await forms(a.privateKey, "live")).filter((x) => INSERT.test(x.attributes.name))) {
      if (!apply) { console.log(`  would unpublish ${a.country} ${f.id} "${f.attributes.name}"`); done.push(f.id); continue; }
      const r = await publishJob(a, f.id, false);
      console.log(`  ${r.ok ? "ok  " : "FAIL"} ${a.country} ${f.id} "${f.attributes.name}" -> ${r.status}, live versions now ${r.after} ${r.detail}`);
      if (r.ok) done.push({ market: a.country, id: f.id, name: f.attributes.name, at: new Date().toISOString() });
    }
  }
  if (apply && done.length) {
    fs.mkdirSync(path.dirname(RECORD), { recursive: true });
    const before = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, "utf8")) : [];
    fs.writeFileSync(RECORD, JSON.stringify(before.concat(done), null, 2));
    console.log(`Recorded in ${path.relative(ROOT, RECORD)} for a rollback.`);
  }
  console.log(`${apply ? "Done" : "Dry run"}: ${done.length} form(s).${apply ? "" : " Add --apply to do it."}`);
}

async function republish(apply, args) {
  const given = args.filter((x) => /^[A-Z]{2}:[A-Za-z0-9]{6}$/.test(x)).map((x) => ({ market: x.slice(0, 2), id: x.slice(3) }));
  const list = given.length ? given : fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, "utf8")) : [];
  if (!list.length) { console.log("Nothing recorded to roll back. Give the forms as MARKET:formId, e.g. DK:SPPrjA."); return; }
  const byMarket = Object.fromEntries(accounts().map((a) => [a.country, a]));
  for (const t of list) {
    const a = byMarket[t.market];
    if (!a) { console.log(`  FAIL ${t.market} ${t.id}: no Klaviyo account configured`); continue; }
    if (!apply) { console.log(`  would publish ${t.market} ${t.id}${t.name ? ` "${t.name}"` : ""}`); continue; }
    const r = await publishJob(a, t.id, true);
    console.log(`  ${r.ok ? "ok  " : "FAIL"} ${t.market} ${t.id} -> ${r.status}, live versions now ${r.after} ${r.detail}`);
  }
  console.log(`${apply ? "Done" : "Dry run"}: ${list.length} form(s).${apply ? "" : " Add --apply to do it."}`);
}

(async () => {
  const [cmd] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");
  if (cmd === "status") return status();
  if (cmd === "unpublish") {
    const live = await productionSwitch();
    if (apply && live !== true) console.log("Note: production does not run the Signup Lab yet (LIVE is not true). Unpublishing now leaves the stores without a signup popup until it does.");
    return unpublish(apply);
  }
  if (cmd === "republish") return republish(apply, process.argv.slice(3));
  console.log("Usage: node tools/signup/go-live.js status | unpublish [--apply] | republish [--apply]");
})().catch((e) => { console.error(e.message); process.exit(1); });
