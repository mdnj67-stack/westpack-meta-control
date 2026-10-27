// Builds knowledge/subject-lines/pattern-bank.json from the authored files in source/.
//
//   node knowledge/subject-lines/tools/build-bank.js
//
// Every entry is validated against the taxonomy and run through the same rule check the generator
// applies to its own candidates. An entry that breaks a blocking rule is left out - the bank is
// what the generator imitates, so a line that would be refused as output must not be shown to it
// as an example. Near-duplicates (same words, different punctuation or emoji) are dropped, and each
// entry gets an id derived from its text, so an id survives a rebuild and a ban keeps working.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MECHANISM_KEYS } = require("../../../server/klaviyo/subject-line-taxonomy");
const { isValidEntry } = require("../../../server/klaviyo/subject-line-bank");
const { checkSubjectLine } = require("../../../server/klaviyo/subject-line-rules");

const root = path.join(__dirname, "..");
const sourceDir = path.join(root, "source");
const outputPath = path.join(root, "pattern-bank.json");
const collectedPath = path.join(root, "collected", "really-good-emails.json");

function dedupeKey(subject = "") {
  return String(subject).toLowerCase().replace(/[^\p{L}\d]+/gu, " ").trim();
}

function entryId(entry) {
  return `pb-${crypto.createHash("sha1").update(`${entry.subject}\n${entry.preview}`).digest("hex").slice(0, 10)}`;
}

function build() {
  const files = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".json")).sort();
  const seen = new Set();
  const entries = [];
  const report = { files: {}, invalid: [], blocked: [], duplicates: 0, warned: 0 };

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(sourceDir, file), "utf8"));
    const list = Array.isArray(raw) ? raw : [];
    report.files[file] = list.length;
    for (const item of list) {
      const entry = {
        subject: String(item.subject || "").trim(),
        preview: String(item.preview || "").trim(),
        language: item.language,
        mechanisms: Array.isArray(item.mechanisms) ? item.mechanisms.slice(0, 2) : [],
        campaignType: item.campaignType,
        tone: item.tone,
        context: item.context === "generisk" ? "generisk" : "westpack",
        translationRisk: item.translationRisk,
        why: String(item.why || "").trim(),
        source: "authored"
      };
      if (!isValidEntry(entry)) {
        report.invalid.push(`${file}: ${entry.subject || "(empty)"}`);
        continue;
      }
      const key = dedupeKey(entry.subject);
      if (seen.has(key)) {
        report.duplicates += 1;
        continue;
      }
      const check = checkSubjectLine({ subject: entry.subject, preview: entry.preview });
      if (check.status === "block") {
        report.blocked.push(`${file}: ${entry.subject} (${check.issues.map((issue) => issue.ruleId).join(", ")})`);
        continue;
      }
      if (check.status === "warn") report.warned += 1;
      seen.add(key);
      entries.push({ id: entryId(entry), ...entry });
    }
  }

  // Real lines other brands sent, collected by tools/collect-rge.js and tagged by tag-collected.js.
  // Same validation and the same rules: a real "arrives by Christmas" would still teach the
  // generator a delivery promise.
  report.collected = { file: 0, kept: 0, blocked: 0, duplicates: 0, invalid: 0 };
  if (fs.existsSync(collectedPath)) {
    const collected = JSON.parse(fs.readFileSync(collectedPath, "utf8"));
    const list = Array.isArray(collected?.entries) ? collected.entries : [];
    report.collected.file = list.length;
    for (const item of list) {
      const entry = {
        id: String(item.id || ""),
        subject: String(item.subject || "").trim(),
        preview: String(item.preview || "").trim(),
        language: String(item.language || "").toLowerCase(),
        mechanisms: Array.isArray(item.mechanisms) ? item.mechanisms.slice(0, 2) : [],
        campaignType: item.campaignType,
        tone: item.tone,
        context: "generisk",
        translationRisk: item.translationRisk,
        why: String(item.why || "").trim(),
        source: "collected",
        sender: String(item.sender || ""),
        collectedFrom: String(item.collectedFrom || ""),
        url: String(item.url || ""),
        publishedAt: String(item.publishedAt || "")
      };
      if (!entry.id || !isValidEntry(entry)) {
        report.collected.invalid += 1;
        continue;
      }
      const key = dedupeKey(entry.subject);
      if (seen.has(key)) {
        report.collected.duplicates += 1;
        continue;
      }
      if (checkSubjectLine({ subject: entry.subject, preview: entry.preview }).status === "block") {
        report.collected.blocked += 1;
        continue;
      }
      seen.add(key);
      entries.push(entry);
      report.collected.kept += 1;
    }
  }

  entries.sort((left, right) => MECHANISM_KEYS.indexOf(left.mechanisms[0]) - MECHANISM_KEYS.indexOf(right.mechanisms[0]) || left.id.localeCompare(right.id));
  const bank = {
    note: "Generated by knowledge/subject-lines/tools/build-bank.js from source/*.json (authored patterns) and collected/*.json (real lines other brands sent). Nothing here has a measured result. Do not edit by hand.",
    count: entries.length,
    entries
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(bank, null, 1)}\n`, "utf8");
  return { ...report, count: entries.length };
}

if (require.main === module) {
  const report = build();
  console.log(`pattern-bank.json: ${report.count} entries`);
  console.log(`source files: ${JSON.stringify(report.files)}`);
  console.log(`duplicates dropped: ${report.duplicates}, invalid: ${report.invalid.length}, blocked by rules: ${report.blocked.length}, kept with warnings: ${report.warned}`);
  console.log(`collected: ${report.collected.kept} kept of ${report.collected.file} (blocked ${report.collected.blocked}, duplicates ${report.collected.duplicates}, invalid ${report.collected.invalid})`);
  for (const line of [...report.invalid, ...report.blocked].slice(0, 40)) console.log(`  - ${line}`);
}

module.exports = { build };
