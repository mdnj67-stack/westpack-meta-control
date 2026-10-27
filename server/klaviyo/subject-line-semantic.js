// Semantic retrieval for the pattern bank: which of its lines resemble the email being written for.
//
// Tags alone choose a mechanism and a campaign type, then pick by chance inside them - so a vote on
// gift boxes was shown whatever "konkurrence" lines came up. Each bank line carries an embedding
// (knowledge/subject-lines/tools/build-embeddings.js); the brief is embedded at writing time, and
// lines close to it in meaning rank first within each mechanism's slots. The team's imported lines
// have no stored vector, so they are embedded in the same call. One call per run, a few hundred
// milliseconds. Without the vectors file, or if the call fails, retrieval falls back to tags and
// nothing else changes.

const fs = require("fs");
const path = require("path");

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 256;
const MAX_INPUTS = 2048;
const VECTORS_BIN = path.join(__dirname, "..", "..", "knowledge", "subject-lines", "pattern-bank.vectors.bin");
const VECTORS_META = path.join(__dirname, "..", "..", "knowledge", "subject-lines", "pattern-bank.vectors.json");

let cached;

function entryText(entry = {}) {
  return [entry.subject, entry.preview].filter(Boolean).join(" — ");
}

function normalize(vector) {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum) || 1;
  return Float32Array.from(vector, (value) => value / norm);
}

function dot(left, right) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
  return sum;
}

// One signed byte per dimension. Cosine similarity does not depend on a vector's length, so the
// scale is not stored: a row is renormalised when it is read.
function quantize(vector) {
  const unit = normalize(vector);
  let max = 0;
  for (const value of unit) max = Math.max(max, Math.abs(value));
  const scale = max / 127 || 1;
  return Int8Array.from(unit, (value) => Math.round(value / scale));
}

async function embedTexts(config, texts = []) {
  if (!config?.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts, dimensions: EMBEDDING_DIMENSIONS })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Embedding request failed (${response.status}).`);
  return (payload.data || []).sort((left, right) => left.index - right.index).map((item) => item.embedding);
}

function makeVectors(ids = [], data = new Int8Array(0), dimensions = EMBEDDING_DIMENSIONS) {
  return { ids, data, dimensions, rows: new Map(ids.map((id, row) => [id, row])) };
}

// The vectors are tied to the bank by id, row for row. A file built for an older bank is ignored.
function loadVectors(bank = []) {
  if (cached !== undefined) return cached;
  try {
    const meta = JSON.parse(fs.readFileSync(VECTORS_META, "utf8"));
    const buffer = fs.readFileSync(VECTORS_BIN);
    const data = new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const aligned = meta.ids.length === bank.length && meta.ids.every((id, index) => id === bank[index]?.id);
    cached = aligned && meta.dimensions === EMBEDDING_DIMENSIONS && data.length === meta.ids.length * EMBEDDING_DIMENSIONS
      ? { ...makeVectors(meta.ids, data, meta.dimensions), builtAt: meta.builtAt }
      : null;
  } catch (error) {
    cached = null;
  }
  return cached;
}

function rowVector(vectors, row) {
  const offset = row * vectors.dimensions;
  return normalize(vectors.data.subarray(offset, offset + vectors.dimensions));
}

// How close each line is to the brief, and to each other line, for the bank and any extra lines
// embedded alongside the query. Lines with no vector have no similarity, and rank last.
function buildRelevance(vectors, query, extra = new Map()) {
  const unit = normalize(query);
  const similarity = new Map();
  for (let row = 0; row < vectors.ids.length; row += 1) {
    const offset = row * vectors.dimensions;
    let product = 0;
    let norm = 0;
    for (let column = 0; column < vectors.dimensions; column += 1) {
      const value = vectors.data[offset + column];
      product += unit[column] * value;
      norm += value * value;
    }
    similarity.set(vectors.ids[row], norm ? product / Math.sqrt(norm) : 0);
  }
  const unitVectors = new Map();
  for (const [id, vector] of extra) {
    const extraUnit = normalize(vector);
    unitVectors.set(id, extraUnit);
    similarity.set(id, dot(extraUnit, unit));
  }
  const vectorOf = (id) => {
    if (!unitVectors.has(id)) {
      const row = vectors.rows.get(id);
      unitVectors.set(id, row === undefined ? null : rowVector(vectors, row));
    }
    return unitVectors.get(id);
  };
  return {
    similarity,
    between(left, right) {
      const a = vectorOf(left);
      const b = vectorOf(right);
      return a && b ? dot(a, b) : 0;
    }
  };
}

// Series names stay out of the query: "Monaco" and "Grand Prix" pulled in Formula 1 lines. Danish
// writes nouns in lower case, so a product with a capital is a name and the category is what counts.
function briefText(analysis = {}) {
  return [
    analysis.coreMessage,
    analysis.readerMoment,
    analysis.offer,
    (analysis.products || []).filter((product) => !/^\p{Lu}/u.test(String(product).trim())).join(", "),
    ...(analysis.hooks || []).map((hook) => hook.hook)
  ].filter(Boolean).join(". ");
}

async function relevanceToBrief(config, { bank = [], analysis = {}, extra = [] } = {}) {
  const vectors = loadVectors(bank);
  const query = briefText(analysis);
  if (!vectors || !query) return null;
  const lines = extra.filter((entry) => entry?.id && entry.subject).slice(0, MAX_INPUTS - 1);
  try {
    const [queryVector, ...lineVectors] = await embedTexts(config, [query, ...lines.map(entryText)]);
    if (!queryVector) return null;
    return buildRelevance(vectors, queryVector, new Map(lines.map((entry, index) => [entry.id, lineVectors[index]]).filter(([, vector]) => vector)));
  } catch (error) {
    return null;
  }
}

module.exports = {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  briefText,
  buildRelevance,
  embedTexts,
  entryText,
  loadVectors,
  makeVectors,
  quantize,
  relevanceToBrief
};
