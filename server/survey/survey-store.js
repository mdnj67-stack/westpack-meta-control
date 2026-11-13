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

async function writeResponse(survey, record, now = Date.now()) {
  const pathname = `${prefix(survey)}/responses/${now}-${crypto.randomBytes(5).toString("hex")}.json`;
  if (!token()) { localWrite(pathname, record); return { mode: "local_file" }; }
  await blobPut(pathname, record);
  return { mode: "blob" };
}

async function readResponses(survey) {
  if (!token()) {
    const dir = localPath(`${prefix(survey)}/responses`);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => localRead(`${prefix(survey)}/responses/${f}`)).filter(Boolean);
  }
  const blobs = await blobList(`${prefix(survey)}/responses/`);
  return (await pool(blobs, 16, (b) => blobGet(b.pathname).catch(() => null))).filter(Boolean);
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

module.exports = { storeMode, writeResponse, readResponses, readRecipients, writeRecipients };
