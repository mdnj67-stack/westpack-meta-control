/**
 * Storage for the customer feedback survey: Vercel Blob (private store), never Redis - the Upstash database has been
 * at its plan limit since 2026-10-21.
 *
 * - One file per answer under surveys/<survey>/responses/, so two customers answering at once can never overwrite
 *   each other, and nothing is read before an answer is written.
 * - The recipient list (token -> customer) is one file, surveys/<survey>/recipients.json. It holds company, contact
 *   name, market and lifetime webshop value - no e-mail addresses or phone numbers.
 * - Without BLOB_READ_WRITE_TOKEN (local development) the same layout is written under tmp/surveys/.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const ROOT = path.resolve(__dirname, "..", "..");
const LOCAL_DIR = path.join(ROOT, "tmp");

const token = () => String(process.env.BLOB_READ_WRITE_TOKEN || "");
const storeHost = () => {
  const id = token().split("_")[3] || "";
  if (!id) throw new Error("BLOB_READ_WRITE_TOKEN does not name a Blob store.");
  return `https://${id}.private.blob.vercel-storage.com`;
};
const prefix = (survey) => `surveys/${survey}`;

async function blobPut(pathname, body) {
  const r = await fetch(`${BLOB_API_URL}/?${new URLSearchParams({ pathname })}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token()}`,
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-content-type": "application/json",
    },
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
async function blobList(pathPrefix) {
  const out = [];
  let cursor = "";
  do {
    const q = new URLSearchParams({ prefix: pathPrefix, limit: "1000", ...(cursor ? { cursor } : {}) });
    const r = await fetch(`${BLOB_API_URL}?${q}`, { headers: { Authorization: `Bearer ${token()}`, "x-api-version": BLOB_API_VERSION } });
    if (!r.ok) throw new Error(`Blob list failed (${r.status}).`);
    const j = await r.json();
    out.push(...(j.blobs || []));
    cursor = j.hasMore ? j.cursor : "";
  } while (cursor);
  return out;
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const localPath = (pathname) => path.join(LOCAL_DIR, ...pathname.split("/"));
function localWrite(pathname, body) {
  fs.mkdirSync(path.dirname(localPath(pathname)), { recursive: true });
  fs.writeFileSync(localPath(pathname), JSON.stringify(body));
}
function localRead(pathname) {
  try { return JSON.parse(fs.readFileSync(localPath(pathname), "utf8")); } catch { return null; }
}

function storeMode() {
  return token() ? "blob" : "local_file";
}

// One more try after a short pause: one failed request to Blob must neither lose an answer nor hide one. Both are
// safe to repeat - a write goes to its own fixed name, a read changes nothing.
async function twice(fn, pauseMs = 400) {
  try { return await fn(); } catch (e) {
    await new Promise((r) => setTimeout(r, pauseMs));
    return fn();
  }
}

async function writeResponse(survey, record, now = Date.now()) {
  const pathname = `${prefix(survey)}/responses/${now}-${crypto.randomBytes(5).toString("hex")}.json`;
  if (!token()) { localWrite(pathname, record); return { mode: "local_file" }; }
  await twice(() => blobPut(pathname, record));
  return { mode: "blob" };
}

// An answer under a name of its own (a mail reply's id), so writing it again rewrites the one file: re-importing the
// same mail never adds a second answer.
async function writeNamedResponse(survey, name, record) {
  if (!/^mail-[a-f0-9]{16,40}$/.test(String(name))) throw new Error("Bad answer name.");
  const pathname = `${prefix(survey)}/responses/${name}.json`;
  if (!token()) { localWrite(pathname, record); return { mode: "local_file" }; }
  await twice(() => blobPut(pathname, record));
  return { mode: "blob" };
}

// Every saved answer, read file by file. A file that cannot be read on the second try either is counted in
// `unreadable`, never dropped in silence: biblen says so, so a short count is never taken for the real one.
async function readResponseFiles(survey) {
  if (!token()) {
    const dir = localPath(`${prefix(survey)}/responses`);
    if (!fs.existsSync(dir)) return { records: [], unreadable: 0 };
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => localRead(`${prefix(survey)}/responses/${f}`));
    return { records: files.filter(Boolean), unreadable: files.filter((r) => !r).length };
  }
  const blobs = await blobList(`${prefix(survey)}/responses/`);
  const got = await pool(blobs, 24, (b) => twice(() => blobGet(b.pathname)).then((record) => ({ record }), () => ({ failed: true })));
  return { records: got.map((g) => g.record).filter(Boolean), unreadable: got.filter((g) => g.failed).length };
}

async function readResponses(survey) {
  return (await readResponseFiles(survey)).records;
}

async function readRecipients(survey) {
  const pathname = `${prefix(survey)}/recipients.json`;
  const doc = token() ? await blobGet(pathname) : localRead(pathname);
  return doc && Array.isArray(doc.recipients) ? doc : { updatedAt: null, recipients: [] };
}

async function writeRecipients(survey, recipients, now = Date.now()) {
  const pathname = `${prefix(survey)}/recipients.json`;
  const doc = { survey, updatedAt: new Date(now).toISOString(), recipients };
  if (!token()) localWrite(pathname, doc);
  else await blobPut(pathname, doc);
  return doc;
}

// Marks answers as a test in place (the file keeps its name; nothing is deleted), so a test someone gave without
// #k=test stops counting and stays readable under "Show test answers". `isMarked(record)` decides.
async function markResponsesTest(survey, isMarked, now = Date.now()) {
  const stamp = new Date(now).toISOString();
  const dir = `${prefix(survey)}/responses`;
  const entries = token()
    ? await pool(await blobList(`${dir}/`), 16, async (b) => ({ pathname: b.pathname, record: await twice(() => blobGet(b.pathname)).catch(() => null) }))
    : (fs.existsSync(localPath(dir)) ? fs.readdirSync(localPath(dir)).filter((n) => n.endsWith(".json")) : []).map((n) => ({ pathname: `${dir}/${n}`, record: localRead(`${dir}/${n}`) }));
  let marked = 0;
  for (const { pathname, record } of entries) {
    if (!record || !isMarked(record)) continue;
    const next = Object.assign({}, record, { test: true, markedTestAt: stamp });
    if (token()) await blobPut(pathname, next);
    else localWrite(pathname, next);
    marked++;
  }
  return { marked, files: entries.length };
}

async function blobDelete(urls) {
  const r = await fetch(`${BLOB_API_URL}/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "x-api-version": BLOB_API_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!r.ok) throw new Error(`Blob delete failed (${r.status}).`);
}

// Deletes the answers marked as a test, for good (25/11, the user: "vil du i biblen fjerne alle test svar" - a clean
// start before the mails go out). Only a file that reads back with test: true goes; one that cannot be read stays,
// because it could be a customer's. `dryRun` counts without deleting.
async function deleteTestResponses(survey, { dryRun = false } = {}) {
  const dir = `${prefix(survey)}/responses`;
  const entries = token()
    ? await pool(await blobList(`${dir}/`), 16, async (b) => ({ pathname: b.pathname, url: b.url, record: await twice(() => blobGet(b.pathname)).catch(() => null) }))
    : (fs.existsSync(localPath(dir)) ? fs.readdirSync(localPath(dir)).filter((n) => n.endsWith(".json")) : []).map((n) => ({ pathname: `${dir}/${n}`, record: localRead(`${dir}/${n}`) }));
  const tests = entries.filter((e) => e.record && e.record.test === true);
  const unreadable = entries.filter((e) => !e.record).length;
  if (!dryRun && tests.length) {
    if (token()) for (let i = 0; i < tests.length; i += 100) await twice(() => blobDelete(tests.slice(i, i + 100).map((e) => e.url)));
    else for (const e of tests) fs.unlinkSync(localPath(e.pathname));
  }
  return { deleted: dryRun ? 0 : tests.length, testFiles: tests.length, kept: entries.length - tests.length, unreadable, files: entries.length, dryRun };
}

module.exports = { storeMode, writeResponse, writeNamedResponse, readResponses, readResponseFiles, readRecipients, writeRecipients, markResponsesTest, deleteTestResponses };
