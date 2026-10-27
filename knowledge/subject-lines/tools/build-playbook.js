// Distils the whole pattern bank into a playbook the writer reads on every run.
//
//   node knowledge/subject-lines/tools/build-playbook.js [mechanism ...]
//
// The writer is shown about two dozen lines from the bank per campaign, so on its own the bank's
// 5,000+ lines would mostly sit unused. This reads every line of each mechanism - the authored
// pairs and the real lines other brands sent - and asks the strong model for the constructions that
// recur: what each is, as a formula with placeholders, why it gets opened, when it fits and how it
// goes wrong. The result is small enough to go into every prompt, so the writer knows the bank's
// patterns even for the lines it is not shown.
//
// No made-up example lines: a first version had the model write Danish examples, and they copied
// library lines nearly word for word and invented facts ("kundeservice har åbent til 18"), which is
// exactly what the writer must not learn. Each pattern carries the formula and real lines from the
// library instead, and a "seen in" line that does not exist in the bank is dropped.
//
// Rebuild after the bank changes (build-bank.js), one mechanism at a time if you like.
// `--tidy` rebuilds nothing and only runs the clean-up below over the file.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");
process.chdir(ROOT);
const { getConfig } = require(path.join(ROOT, "server", "lib", "config"));
const { requestStructured } = require(path.join(ROOT, "server", "klaviyo", "subject-line-generator"));
const { buildRulesPromptBlock, checkSubjectLine } = require(path.join(ROOT, "server", "klaviyo", "subject-line-rules"));
const { MECHANISMS, CAMPAIGN_TYPE_KEYS, mechanismLabel } = require(path.join(ROOT, "server", "klaviyo", "subject-line-taxonomy"));

const BANK = require(path.join(__dirname, "..", "pattern-bank.json")).entries;
const OUTPUT = path.join(__dirname, "..", "playbook.json");
const MAX_LINES = 700;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    essence: { type: "string" },
    patterns: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          formula: { type: "string" },
          why: { type: "string" },
          bestFor: { type: "array", maxItems: 4, items: { type: "string", enum: CAMPAIGN_TYPE_KEYS } },
          watchOut: { type: "string" },
          seenIn: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } }
        },
        required: ["name", "formula", "why", "bestFor", "watchOut", "seenIn"]
      }
    },
    preheaderMoves: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    avoid: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } }
  },
  required: ["essence", "patterns", "preheaderMoves", "avoid"]
};

function linesFor(mechanism) {
  const entries = BANK.filter((entry) => entry.mechanisms[0] === mechanism);
  // Real lines first (they are what senders actually wrote), then the authored ones, capped.
  const real = entries.filter((entry) => entry.source !== "authored");
  const authored = entries.filter((entry) => entry.source === "authored");
  const step = Math.max(1, Math.ceil(real.length / Math.max(1, MAX_LINES - authored.length)));
  return [...real.filter((_, index) => index % step === 0), ...authored].slice(0, MAX_LINES);
}

async function distil(config, mechanism) {
  const meta = MECHANISMS.find((item) => item.key === mechanism);
  const lines = linesFor(mechanism);
  const input = [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          "You are a senior email copywriter distilling a library of subject lines into a playbook for a Danish B2B writer.",
          "The writer works for Westpack, a Danish packaging supplier (jewellery boxes, gift boxes, bags, pouches, displays) whose readers are owners and buyers at shops and brands that package what they sell, jewellery businesses at the core. Emails go out from a Danish master and are translated into about fifteen markets.",
          `Mechanism: ${meta.label} (${mechanism}) - ${meta.description}`,
          "",
          "From the lines below, find the constructions that recur and that a strong writer would reuse. For each:",
          "- name: a short Danish name for the construction.",
          "- formula: the construction with placeholders in square brackets, in Danish, e.g. \"[Antal] [ting] kunderne bestiller igen\".",
          "- why: one Danish sentence on why it gets opened.",
          "- bestFor: the campaign types it suits.",
          "- watchOut: one Danish sentence on how it goes wrong (overpromising, cliché, translation).",
          "- seenIn: one to three subject lines from the library that show the construction, copied exactly, subject only. Prefer real lines over written ones.",
          "Also: essence (two Danish sentences on what makes this mechanism work in B2B retail email), preheaderMoves (how the preheader completes this mechanism, Danish), avoid (failures and clichés you saw, Danish).",
          "Real lines are what other brands sent; their results are unknown. Lines written for the bank were never sent. Prefer constructions that appear in real lines.",
          "",
          buildRulesPromptBlock()
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: lines.map((entry) => `- ${entry.subject}${entry.preview ? ` / ${entry.preview}` : ""} [${entry.source === "authored" ? "written" : entry.sender || "real"}, ${entry.language}]`).join("\n")
      }]
    }
  ];
  // A playbook read on every run is worth waiting for. The first build timed four mechanisms out at
  // the app's 130 seconds and quietly fell back to the default model, which wrote weaker Danish and
  // cited only lines written for the bank; a result from any model but the writing one is refused.
  const { parsed, model } = await requestStructured(config, { input, schemaName: "westpack_subject_line_playbook", schema: SCHEMA, reasoningEffort: "medium", writing: true, timeoutMs: 290_000 });
  const writer = config.contentAgentModel || config.openAiModel;
  if (!String(model).startsWith(writer)) throw new Error(`answered by ${model}, not ${writer}`);
  const known = new Map(lines.map((entry) => [entry.subject.trim().toLowerCase(), entry]));
  for (const pattern of parsed.patterns) {
    pattern.seenIn = pattern.seenIn
      .map((subject) => known.get(String(subject).trim().toLowerCase()))
      .filter((entry) => entry && checkSubjectLine({ subject: entry.subject, preview: entry.preview }).status !== "block")
      .map((entry) => ({ subject: entry.subject, preview: entry.preview, source: entry.source, sender: entry.sender || "" }));
  }
  return { mechanism, label: meta.label, linesRead: lines.length, model, ...parsed };
}

// The strong model's lists sometimes run on in their last item: the rules block pasted back in
// English, sentences glued together without a space, "*REMOVE*". The real items are one or two
// sentences, well under 200 characters, so a longer one is dropped rather than repaired. The rules
// are in the writer's prompt anyway.
const MAX_ITEM_LENGTH = 200;

function tidy(mechanism) {
  const short = (list) => list.map((item) => String(item).trim()).filter((item) => item && item.length <= MAX_ITEM_LENGTH);
  mechanism.preheaderMoves = short(mechanism.preheaderMoves);
  mechanism.avoid = short(mechanism.avoid);
  for (const pattern of mechanism.patterns) {
    const seen = new Set();
    pattern.seenIn = pattern.seenIn.filter((line) => (seen.has(line.subject) ? false : seen.add(line.subject)));
  }
  mechanism.patterns = mechanism.patterns.filter((pattern) => pattern.seenIn.length && pattern.formula.length <= MAX_ITEM_LENGTH);
  return mechanism;
}

async function build() {
  const config = getConfig();
  const wanted = process.argv.slice(2);
  const existing = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, "utf8")) : { mechanisms: {} };
  const todo = wanted.includes("--tidy") ? [] : MECHANISMS.map((item) => item.key).filter((key) => !wanted.length || wanted.includes(key));
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const mechanism = todo[cursor];
      cursor += 1;
      const started = Date.now();
      try {
        existing.mechanisms[mechanism] = await distil(config, mechanism);
        console.log(`${mechanismLabel(mechanism)}: ${existing.mechanisms[mechanism].patterns.length} patterns from ${existing.mechanisms[mechanism].linesRead} lines in ${((Date.now() - started) / 1000).toFixed(0)} s`);
      } catch (error) {
        console.log(`${mechanismLabel(mechanism)}: failed - ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  Object.values(existing.mechanisms).forEach(tidy);
  existing.note = "Generated by knowledge/subject-lines/tools/build-playbook.js from pattern-bank.json. The constructions that recur across the whole bank, for the writer's prompt. Do not edit by hand.";
  existing.builtAt = new Date().toISOString();
  existing.bankSize = BANK.length;
  fs.writeFileSync(OUTPUT, `${JSON.stringify(existing, null, 1)}\n`);
  console.log(`playbook.json: ${Object.keys(existing.mechanisms).length} mechanisms`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
