/**
 * Signup Lab funnel store: one small record per exposure (an experience shown to a visitor), counts only, never a
 * person. core/rules.js sanitizeTracking decides what a record may hold before it gets here.
 *
 * Records are written one per file to Vercel Blob (private store), under signup-funnel/<env>/<YYYY-MM-DD>/ (UTC), so
 * two visitors finishing at the same moment can never overwrite each other. A file per exposure is cheap to write and
 * expensive to read - a busy day on the live stores is thousands of them - so a report folds them as it reads:
 * - a finished day becomes one daily file (signup-funnel/<env>/daily/<date>.json) and its shards are deleted;
 * - today, shards older than a couple of minutes are folded into a part file (signup-funnel/<env>/parts/<date>/...),
 *   once there are enough of them to be worth it, so a report reads a few parts and the last minutes' shards.
 * Each record carries its shard's name as an id, so two reports folding the same shards at once cannot count a record
 * twice. Redis is not used: it has been at its plan limit since 2026-10-21. Without a Blob token (local development)
 * records go to tmp/signup-funnel/.
 *
 * Reports are read in the team's own day (Europe/Copenhagen): "today" and the per-day series are Danish days.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const ROOT = path.resolve(__dirname, "..", "..");
const LOCAL_DIR = path.join(ROOT, "tmp", "signup-funnel");
const PREFIX = "signup-funnel";
const DAY_MS = 86400000;
const TIME_ZONE = "Europe/Copenhagen";
// today's shards are folded once at least this many are older than SETTLE_MS
const PART_MIN_SHARDS = 40;
const SETTLE_MS = 2 * 60 * 1000;
const LATEST_KEPT = 25;

const token = () => String(process.env.BLOB_READ_WRITE_TOKEN || "");
const storeHost = () => { const id = token().split("_")[3] || ""; if (!id) throw new Error("BLOB_READ_WRITE_TOKEN does not name a Blob store."); return `https://${id}.private.blob.vercel-storage.com`; };
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const LOCAL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const localDay = (ms) => LOCAL_DAY.format(new Date(ms));

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

// A shard's name is `<ms>-<random>.json`: the record's id, and when it was written.
const shardId = (pathname) => path.posix.basename(pathname, ".json");
const shardTime = (pathname) => Number(shardId(pathname).split("-")[0]) || 0;

// Records from several files, each counted once.
function dedupe(records) {
  const seen = new Set(), out = [];
  for (const r of records) {
    if (!r) continue;
    if (r.id) { if (seen.has(r.id)) continue; seen.add(r.id); }
    out.push(r);
  }
  return out;
}

/**
 * Sort one env's listing into the three kinds of file, by UTC date:
 *   <PREFIX>/<env>/<date>/<shard>.json, <PREFIX>/<env>/daily/<date>.json, <PREFIX>/<env>/parts/<date>/<part>.json
 */
function classifyListing(env, blobs) {
  const byDate = {};
  const at = (date) => (byDate[date] = byDate[date] || { daily: null, parts: [], shards: [] });
  const base = `${PREFIX}/${env}/`;
  for (const b of blobs) {
    const rest = String(b.pathname || "").slice(base.length).split("/");
    if (rest[0] === "daily" && /^\d{4}-\d{2}-\d{2}\.json$/.test(rest[1] || "")) at(rest[1].slice(0, 10)).daily = b;
    else if (rest[0] === "parts" && /^\d{4}-\d{2}-\d{2}$/.test(rest[1] || "") && rest[2]) at(rest[1]).parts.push(b);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(rest[0]) && rest[1]) at(rest[0]).shards.push(b);
  }
  return byDate;
}

async function readBlobDay(env, date, files, today, now) {
  const [daily, parts, shards] = await Promise.all([
    files.daily ? blobGet(files.daily.pathname).catch(() => null) : null,
    pool(files.parts, 8, (b) => blobGet(b.pathname).catch(() => null)),
    pool(files.shards, 16, async (b) => { const r = await blobGet(b.pathname).catch(() => null); return r ? Object.assign({ id: shardId(b.pathname) }, r) : null; })
  ]);
  const shardRecords = shards.filter(Boolean);
  const records = dedupe([...(daily ? daily.records : []), ...parts.filter(Boolean).flatMap((p) => p.records || []), ...shardRecords]);
  // A finished day is folded into one file, so later reports read one blob instead of thousands.
  if (date < today && (files.shards.length || files.parts.length)) {
    await blobPut(`${PREFIX}/${env}/daily/${date}.json`, { env, date, compactedAt: new Date(now).toISOString(), records });
    await blobDelete([...files.shards, ...files.parts].map((b) => b.url));
  } else if (date === today) {
    // Today: fold the shards that have settled, once there are enough of them to be worth a file.
    const settled = files.shards.filter((b, i) => shards[i] && now - shardTime(b.pathname) > SETTLE_MS);
    if (settled.length >= PART_MIN_SHARDS) {
      const ids = new Set(settled.map((b) => shardId(b.pathname)));
      const partRecords = shardRecords.filter((r) => ids.has(r.id));
      await blobPut(`${PREFIX}/${env}/parts/${date}/${now}-${crypto.randomBytes(4).toString("hex")}.json`, { env, date, records: partRecords });
      await blobDelete(settled.map((b) => b.url));
    }
  }
  return records;
}

function readLocalDay(env, date) {
  const dir = path.join(LOCAL_DIR, env, date);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => Object.assign({ id: shardId(f) }, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
}

/** Every record of one env written on the given UTC dates. */
async function readDays(env, dates, now = Date.now()) {
  if (!dates.length) return [];
  if (!token()) return dates.flatMap((d) => readLocalDay(env, d));
  const today = day(now);
  const byDate = classifyListing(env, await blobList(`${PREFIX}/${env}/`));
  const perDay = await pool(dates, 4, (d) => (byDate[d] ? readBlobDay(env, d, byDate[d], today, now) : []));
  return perDay.flat();
}

const blank = () => ({ exposures: 0, peekShown: 0, opened: 0, interacted: 0, emailFocus: 0, submitted: 0, subscribed: 0, closed: 0, errors: 0, linkOut: 0, steps: {}, outcomes: {}, devices: {}, markets: {}, msToSubscribe: [] });

function aggregate(records, { days = [] } = {}) {
  const total = blank(), byConcept = {}, byMarket = {};
  const byDay = Object.fromEntries(days.map((d) => [d, { date: d, exposures: 0, opened: 0, subscribed: 0 }]));
  const latest = [];
  for (const r of records) {
    const names = new Set((r.steps || []).map((s) => s.n));
    const subscribed = names.has("subscribed");
    const opened = names.has("open");
    for (const b of [total, byConcept[r.concept] || (byConcept[r.concept] = blank())]) {
      b.exposures++;
      if (names.has("peek_shown")) b.peekShown++;
      if (opened) b.opened++;
      if ([...names].some((n) => !["peek_shown", "open", "peek_dismissed"].includes(n) && !n.startsWith("close_"))) b.interacted++;
      if (names.has("email_focus")) b.emailFocus++;
      if (names.has("submit")) b.submitted++;
      if (subscribed) { b.subscribed++; const s = r.steps.find((x) => x.n === "subscribed"); if (s) b.msToSubscribe.push(s.t); }
      if (r.outcome === "closed") b.closed++;
      if (r.outcome === "link") b.linkOut++;
      if ((r.errors || []).length) b.errors++;
      for (const n of names) b.steps[n] = (b.steps[n] || 0) + 1;
      b.outcomes[r.outcome] = (b.outcomes[r.outcome] || 0) + 1;
      b.devices[r.device] = (b.devices[r.device] || 0) + 1;
      b.markets[r.market] = (b.markets[r.market] || 0) + 1;
    }
    const m = byMarket[r.market] || (byMarket[r.market] = { exposures: 0, opened: 0, subscribed: 0 });
    m.exposures++; if (opened) m.opened++; if (subscribed) m.subscribed++;
    const d = Number.isFinite(r.at) ? byDay[localDay(r.at)] : null;
    if (d) { d.exposures++; if (opened) d.opened++; if (subscribed) d.subscribed++; }
    if (subscribed && Number.isFinite(r.at)) {
      const s = r.steps.find((x) => x.n === "subscribed");
      latest.push({ at: new Date(r.at).toISOString(), market: r.market, concept: r.concept, device: r.device, page: r.page || "", seconds: s ? Math.round(s.t / 1000) : null });
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
  for (const m of Object.values(byMarket)) m.subscribedPerExposure = m.exposures ? m.subscribed / m.exposures : null;
  latest.sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    total: finish(total),
    concepts: Object.fromEntries(Object.entries(byConcept).map(([k, v]) => [k, finish(v)])),
    byMarket,
    days: days.map((d) => byDay[d]),
    latest: latest.slice(0, LATEST_KEPT)
  };
}

// Every Danish day from the one holding `since` to the one holding `until`.
function localDays(sinceMs, untilMs) {
  const out = [];
  for (let t = sinceMs; localDay(t) <= localDay(untilMs); t += DAY_MS / 2) {
    const d = localDay(t);
    if (out[out.length - 1] !== d) out.push(d);
  }
  return out;
}

/**
 * The funnel for one env between two instants. `since` is an ISO time or a YYYY-MM-DD date (that UTC day's start);
 * without one, the last 14 days.
 */
async function report({ env = "live", since, from, to, now = Date.now() } = {}) {
  const start = since || from;
  const sinceMs = Number.isFinite(Date.parse(start || "")) ? Date.parse(start) : now - 13 * DAY_MS - (now % DAY_MS);
  const untilMs = Number.isFinite(Date.parse(to || "")) ? Math.min(now, Date.parse(to) + (/^\d{4}-\d{2}-\d{2}$/.test(to) ? DAY_MS - 1 : 0)) : now;
  const dates = [];
  for (let t = Date.parse(day(sinceMs)); t <= untilMs; t += DAY_MS) dates.push(day(t));
  const records = (await readDays(env, dates, now)).filter((r) => !Number.isFinite(r.at) || (r.at >= sinceMs && r.at <= untilMs));
  return {
    env,
    since: new Date(sinceMs).toISOString(),
    until: new Date(untilMs).toISOString(),
    from: localDay(sinceMs),
    to: localDay(untilMs),
    timeZone: TIME_ZONE,
    records: records.length,
    ...aggregate(records, { days: localDays(sinceMs, untilMs) })
  };
}

module.exports = { writeExposure, readDays, classifyListing, dedupe, aggregate, report, localDay, localDays, TIME_ZONE };
