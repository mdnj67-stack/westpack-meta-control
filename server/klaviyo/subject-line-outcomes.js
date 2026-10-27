// Did the generator's lines do any good? The only honest answer comes from sends.
//
// When an operator copies a suggestion, saves it or hands it to Duplicate & translate, the screen
// records it. Once the campaign has gone out, the nightly sync brings the sent subject line into
// layer 1 with its results, and this module pairs the two: a recorded line and a DK send with the
// same words, sent from a day before the line was recorded to sixty days after. Operators edit
// lines before sending, so a near match (most of the same words) counts too, and says so.
//
// The result is the generator's own record - how many of its lines were sent and how they did
// against each market's usual level - which is shown on the screen and fed back to the writer.

const MATCH_WINDOW_BEFORE_MS = 86_400_000;
const MATCH_WINDOW_AFTER_MS = 60 * 86_400_000;
const NEAR_MATCH = 0.75;

function words(value = "") {
  return String(value || "").toLowerCase().match(/[\p{L}\d%]+/gu) || [];
}

function comparable(value = "") {
  return words(value).join(" ");
}

function overlap(left = "", right = "") {
  const a = new Set(words(left));
  const b = new Set(words(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function matchSend(line, entries) {
  const at = Date.parse(line.at || "");
  if (!Number.isFinite(at)) return null;
  const candidates = entries.filter((entry) => {
    const sent = Date.parse(entry.sentAt);
    return Number.isFinite(sent) && sent >= at - MATCH_WINDOW_BEFORE_MS && sent <= at + MATCH_WINDOW_AFTER_MS;
  });
  const exact = candidates.find((entry) => comparable(entry.subject) === comparable(line.subject));
  if (exact) return { entry: exact, match: "exact" };
  const near = candidates
    .map((entry) => ({ entry, score: overlap(entry.subject, line.subject) }))
    .filter((item) => item.score >= NEAR_MATCH)
    .sort((left, right) => right.score - left.score)[0];
  return near ? { entry: near.entry, match: "near" } : null;
}

function buildGeneratorOutcomes({ used = [], dkEntries = [] } = {}) {
  // One record per line and template: copying the same line twice is one decision.
  const lines = new Map();
  for (const item of used) {
    const key = `${item.templateId}|${comparable(item.subject)}`;
    const existing = lines.get(key);
    if (!existing || String(item.at) < String(existing.at)) lines.set(key, item);
  }
  const rows = [...lines.values()].map((line) => {
    const matched = matchSend(line, dkEntries);
    return {
      subject: line.subject,
      preview: line.preview || "",
      mechanism: line.mechanism || "",
      templateName: line.templateName || "",
      kind: line.kind || "",
      at: line.at,
      sent: matched ? {
        subject: matched.entry.subject,
        sentAt: matched.entry.sentAt,
        match: matched.match,
        abTest: Boolean(matched.entry.abTest),
        received: matched.entry.received,
        openIndex: matched.entry.openIndex,
        clickIndex: matched.entry.clickIndex
      } : null
    };
  }).sort((left, right) => String(right.at).localeCompare(String(left.at)));

  const sent = rows.filter((row) => row.sent);
  const byMechanism = {};
  for (const row of sent) {
    const list = byMechanism[row.mechanism] || (byMechanism[row.mechanism] = []);
    list.push(row.sent);
  }
  return {
    recorded: rows.length,
    sent: sent.length,
    medianOpenIndex: median(sent.map((row) => row.sent.openIndex)),
    medianClickIndex: median(sent.map((row) => row.sent.clickIndex)),
    byMechanism: Object.entries(byMechanism).map(([mechanism, list]) => ({
      mechanism,
      sent: list.length,
      medianOpenIndex: median(list.map((item) => item.openIndex))
    })),
    rows: rows.slice(0, 200)
  };
}

module.exports = {
  buildGeneratorOutcomes,
  matchSend
};
