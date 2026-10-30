/**
 * The signup forms in the 18 Klaviyo accounts: list them, and publish or unpublish one. The Signup page lists them
 * all; it only ever publishes or unpublishes The Insert popups, and only as part of switching the Signup Lab on or
 * off on a live store (server/signup/control.js decides which). tools/signup/go-live.js does the same from the
 * command line.
 */
const REV = "2026-10-15";
const INSERT = / - Popup - The Insert\b/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function accountKeys(config) {
  let accounts = config.klaviyoMarketsJson;
  if (typeof accounts === "string") { try { accounts = JSON.parse(accounts); } catch (e) { accounts = []; } }
  return Object.fromEntries((accounts || []).filter((a) => a && a.privateKey && a.country).map((a) => [String(a.country).toUpperCase(), a.privateKey]));
}

async function kv(key, url, { method = "GET", body, fetchImpl = fetch } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchImpl(url.startsWith("http") ? url : `https://a.klaviyo.com${url}`, {
      method,
      headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: REV, accept: "application/vnd.api+json", ...(body ? { "content-type": "application/vnd.api+json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429) { await sleep((Math.min(Number(res.headers.get("retry-after") || 2), 10) + 1) * 1000); continue; }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (e) { json = {}; }
    return { status: res.status, json };
  }
  return { status: 429, json: { errors: [{ detail: "Klaviyo kept saying too many requests" }] } };
}

async function listForms(key, opts = {}) {
  const out = [];
  for (const status of ["live", "draft"]) {
    let url = `/api/forms/?filter=equals(status,'${status}')&fields[form]=name,status,updated_at,created_at`;
    while (url) {
      const r = await kv(key, url, opts);
      if (r.status >= 400) throw new Error(`Klaviyo forms (${status}) answered ${r.status}`);
      for (const f of r.json.data || []) out.push({ id: f.id, name: f.attributes.name, status: f.attributes.status, updatedAt: f.attributes.updated_at, createdAt: f.attributes.created_at, insert: INSERT.test(f.attributes.name || "") });
      url = r.json.links && r.json.links.next;
    }
  }
  return out;
}

async function liveVersions(key, id, opts) {
  const r = await kv(key, `/api/forms/${id}/form-versions`, opts);
  return (r.json.data || []).filter((v) => v.attributes.status === "live").length;
}

// A publish job is accepted before it is done; the form's live versions say whether it happened.
async function setPublished(key, id, publish, opts = {}) {
  const kind = `form-${publish ? "" : "un"}publish-job`;
  const r = await kv(key, `/api/${kind}s`, { ...opts, method: "POST", body: { data: { type: kind, relationships: { form: { data: { type: "form", id } } } } } });
  let after = await liveVersions(key, id, opts);
  if (r.status < 300 && (publish ? after === 0 : after > 0)) { await sleep(1500); after = await liveVersions(key, id, opts); }
  return { ok: r.status < 300 && (publish ? after > 0 : after === 0), status: r.status, after, detail: r.status >= 300 ? JSON.stringify(r.json.errors || r.json).slice(0, 200) : "" };
}

module.exports = { INSERT, accountKeys, listForms, setPublished };
