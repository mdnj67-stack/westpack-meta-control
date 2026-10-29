/**
 * Signup Lab funnel store: one small record per exposure (an experience shown to a visitor), counts only, never a
 * person. core/rules.js sanitizeTracking decides what a record may hold before it gets here.
 *
 * Records are written one per file to Vercel Blob (private store), under signup-funnel/<env>/<YYYY-MM-DD>/, so two
 * visitors finishing at the same moment can never overwrite each other. A finished day is compacted into one
 * daily file the first time a report reads it, and its shards are then deleted. Redis is not used: it has been at
 * its plan limit since 2026-10-21. Without a Blob token (local development) records go to tmp/signup-funnel/.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const ROOT = path.resolve(__dirname, "..", "..");
const LOCAL_DIR = path.join(ROOT, "tmp", "signup-funnel");
const PREFIX = "signup-funnel";

const token = () => String(process.env.BLOB_READ_WRITE_TOKEN || "");
const storeHost = () => { const id = token().split("_")[3] || ""; if (!id) throw new Error("BLOB_READ_WRITE_TOKEN does not name a Blob store."); return `https://${id}.private.blob.vercel-storage.com`; };
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

async function blobPut(pathname, body) {
  const r = await fetch(`${BLOB_API_URL}/?${new URLSearchParams({ pathname })}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token()}`, "x-api-version": BLOB_API_VERSION, "x-vercel-blob-access": "private", "x-add-random-suffix": "0", "x-allow-overwrite": "1", "x-content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Blob write failed (${r.status}).`);
}
async function blobGet(pathname) {
  const r = await fetch(`${storeHost()}/${pathname}?cache=0`, { headers: { Authorization: `Bearer ${token()}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Blob read failed (${r.status}).`);
  return JSON.parse(await r.text());
}
async function blobList(prefix) {
  const out = []; let cursor = "";
  do {
    const q = new URLSearchParams({ prefix, limit: "1000", ...(cursor ? { cursor } : {}) });
    const r = await fetch(`${BLOB_API_URL}?${q}`, { headers: { Authorization: `Bearer ${token()}`, "x-api-version": BLOB_API_VERSION } });
    if (!r.ok) throw new Error(`Blob list failed (${r.status}).`);
    const j = await r.json();
    out.push(...(j.blobs || []));
    cursor = j.hasMore ? j.cursor : "";
  } while (cursor);
  return out;
}
async function blobDelete(urls) {
  for (let i = 0; i < urls.length; i += 500) {
    await fetch(`${BLOB_API_URL}/delete`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "x-api-version": BLOB_API_VERSION, "content-type": "application/json" }, body: JSON.stringify({ urls: urls.slice(i, i + 500) }) });
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function writeExposure(record, now = Date.now()) {
  const date = day(now);
  const name = `${now}-${crypto.randomBytes(5).toString("hex")}.json`;
  const stored = Object.assign({ at: now }, record);
  if (!token()) {
    const dir = path.join(LOCAL_DIR, record.env, date);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), JSON.stringify(stored));
    return { mode: "local_file" };
  }
  await blobPut(`${PREFIX}/${record.env}/${date}/${name}`, stored);
  return { mode: "blob" };
}

async function readDay(env, date, today) {
  if (!token()) {
    const dir = path.join(LOCAL_DIR, env, date);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
  const dailyPath = `${PREFIX}/${env}/daily/${date}.json`;
  const shards = await blobList(`${PREFIX}/${env}/${date}/`);
  const compacted = await blobGet(dailyPath).catch(() => null);
  const fresh = await pool(shards, 16, (b) => blobGet(b.pathname).catch(() => null));
  const records = (compacted ? compacted.records : []).concat(fresh.filter(Boolean));
  // a finished day is folded into one file, so later reports read one blob instead of thousands
  if (date < today && shards.length) {
    await blobPut(dailyPath, { env, date, compactedAt: new Date().toISOString(), records });
    await blobDelete(shards.map((b) => b.url));
  }
  return records;
}

function aggregate(records) {
  const blank = () => ({ exposures: 0, peekShown: 0, opened: 0, interacted: 0, emailFocus: 0, submitted: 0, subscribed: 0, closed: 0, errors: 0, linkOut: 0, steps: {}, outcomes: {}, devices: {}, markets: {}, msToSubscribe: [] });
  const total = blank(), byConcept = {};
  for (const r of records) {
    for (const b of [total, byConcept[r.concept] || (byConcept[r.concept] = blank())]) {
      const names = new Set((r.steps || []).map((s) => s.n));
      b.exposures++;
      if (names.has("peek_shown")) b.peekShown++;
      if (names.has("open")) b.opened++;
      if ([...names].some((n) => !["peek_shown", "open", "peek_dismissed"].includes(n) && !n.startsWith("close_"))) b.interacted++;
      if (names.has("email_focus")) b.emailFocus++;
      if (names.has("submit")) b.submitted++;
      if (names.has("subscribed")) { b.subscribed++; const s = r.steps.find((x) => x.n === "subscribed"); if (s) b.msToSubscribe.push(s.t); }
      if (r.outcome === "closed") b.closed++;
      if (r.outcome === "link") b.linkOut++;
      if ((r.errors || []).length) b.errors++;
      for (const n of names) b.steps[n] = (b.steps[n] || 0) + 1;
      b.outcomes[r.outcome] = (b.outcomes[r.outcome] || 0) + 1;
      b.devices[r.device] = (b.devices[r.device] || 0) + 1;
      b.markets[r.market] = (b.markets[r.market] || 0) + 1;
    }
  }
  const finish = (b) => {
    const t = b.msToSubscribe.sort((x, y) => x - y);
    b.medianSecondsToSubscribe = t.length ? Math.round(t[Math.floor(t.length / 2)] / 1000) : null;
    delete b.msToSubscribe;
    b.subscribedPerExposure = b.exposures ? b.subscribed / b.exposures : null;
    b.subscribedPerOpen = b.opened ? b.subscribed / b.opened : null;
    return b;
  };
  return { total: finish(total), concepts: Object.fromEntries(Object.entries(byConcept).map(([k, v]) => [k, finish(v)])) };
}

async function report({ env = "live", from, to, now = Date.now() } = {}) {
  const today = day(now);
  const end = to || today;
  const start = from || day(Date.parse(end) - 13 * 86400000);
  const days = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) days.push(day(t));
  const perDay = await pool(days, 4, (d) => readDay(env, d, today));
  const records = perDay.flat();
  return { env, from: start, to: end, records: records.length, ...aggregate(records) };
}

module.exports = { writeExposure, readDay, aggregate, report };
