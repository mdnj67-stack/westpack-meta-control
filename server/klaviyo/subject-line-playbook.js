// The playbook: what the whole pattern bank teaches, small enough for every prompt.
//
// The writer is shown two dozen of the bank's 5,000+ lines per campaign. The playbook
// (knowledge/subject-lines/playbook.json, built by tools/build-playbook.js) is the rest of it: for
// each mechanism, the constructions that recur across every line, as formulas with placeholders,
// why they get opened, how they go wrong and real lines that use them. The brief's own mechanisms
// go in in full; the others as one line of formulas each, so the writer still reaches for them
// when it writes its alternatives.

const { MECHANISMS } = require("./subject-line-taxonomy");

const FOCUS_LIMIT = 3;
let cachedPlaybook;

// A static require is what makes Vercel bundle the file with the function.
function loadPlaybook() {
  if (cachedPlaybook !== undefined) return cachedPlaybook;
  try {
    const playbook = require("../../knowledge/subject-lines/playbook.json");
    cachedPlaybook = playbook?.mechanisms && Object.keys(playbook.mechanisms).length ? playbook : null;
  } catch (error) {
    cachedPlaybook = null;
  }
  return cachedPlaybook;
}

function focusMechanisms(analysis = {}) {
  const avoided = new Set((analysis.avoidMechanisms || []).map((item) => item.mechanism || item));
  return [...new Set((analysis.recommendedMechanisms || []).map((item) => item.mechanism || item))]
    .filter((key) => !avoided.has(key))
    .slice(0, FOCUS_LIMIT);
}

function describeSeen(line) {
  return `"${line.subject}"${line.source === "authored" ? "" : ` (${line.sender || "real send"})`}`;
}

function fullSection(entry) {
  return [
    `## ${entry.label} (${entry.mechanism})`,
    entry.essence,
    ...entry.patterns.map((pattern) => `- ${pattern.name}: ${pattern.formula}. ${pattern.why} Watch out: ${pattern.watchOut} Fits: ${pattern.bestFor.join(", ")}. Seen in: ${pattern.seenIn.slice(0, 2).map(describeSeen).join("; ")}`),
    ...(entry.preheaderMoves.length ? [`Preheader: ${entry.preheaderMoves.join(" ")}`] : []),
    ...(entry.avoid.length ? [`Avoid: ${entry.avoid.join(" ")}`] : [])
  ].join("\n");
}

function compactLine(entry) {
  return `- ${entry.label} (${entry.mechanism}): ${entry.patterns.map((pattern) => pattern.formula).join(" | ")}`;
}

function buildPlaybookPromptBlock(analysis = {}, playbook = loadPlaybook()) {
  if (!playbook) return "";
  const focus = focusMechanisms(analysis).filter((key) => playbook.mechanisms[key]);
  const rest = MECHANISMS.map((item) => item.key).filter((key) => playbook.mechanisms[key] && !focus.includes(key));
  return [
    `Playbook - the constructions that recur across all ${playbook.bankSize || "the"} lines in the bank. Most come from real sends by other brands whose results are unknown, so this is craft, not evidence. Build on the constructions in natural Danish with this email's own facts; never copy a line's words.`,
    "",
    ...focus.map((key) => `${fullSection(playbook.mechanisms[key])}\n`),
    ...(rest.length ? ["The other mechanisms, as formulas, for the alternatives:", ...rest.map((key) => compactLine(playbook.mechanisms[key]))] : [])
  ].join("\n");
}

module.exports = {
  buildPlaybookPromptBlock,
  focusMechanisms,
  loadPlaybook
};
