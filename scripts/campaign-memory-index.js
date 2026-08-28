const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "server", "campaign", "memory.generated.json");
const APPROVAL_PATH = path.join(ROOT, "campaign-memory", "approved-references.json");
const LIBRARIES = [
  {
    directory: path.join(ROOT, "campaign-memory", "imports"),
    type: "owned_campaign",
    sourceName: "Westpack"
  },
  {
    directory: path.join(ROOT, "campaign-memory", "external", "imports"),
    type: "external_inspiration",
    sourceName: "Really Good Emails"
  }
];

function compactList(values, limit = 8) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildSafeRecord(record, defaults) {
  const analysis = record?.analysis || {};
  const visual = analysis.visualStyle || {};
  const copy = analysis.copyStyle || {};
  const libraryType = record?.library?.type || defaults.type;

  return {
    id: String(record?.id || ""),
    libraryType,
    sourceName: String(record?.library?.sourceName || defaults.sourceName),
    imagePath: String(record?.source?.relativePath || "").replace(/\\/g, "/"),
    title: String(analysis.campaignTitle || "Untitled reference"),
    family: String(analysis.campaignFamily || ""),
    campaignType: String(analysis.campaignType || "other"),
    funnelStage: String(analysis.funnelStage || "unknown"),
    language: String(analysis.language || "unknown"),
    primaryGoal: String(analysis.primaryGoal || ""),
    audience: String(analysis.audience || ""),
    offer: String(analysis.offer || ""),
    themes: compactList(analysis.themes),
    products: compactList(analysis.products, 6),
    visualPatterns: compactList([
      visual.mood,
      visual.imageStyle,
      ...compactList(visual.layoutPatterns, 6)
    ], 8),
    copyPatterns: compactList([
      copy.tone,
      ...compactList(copy.structure, 6),
      copy.urgency
    ], 8),
    reusablePatterns: compactList(analysis.reusablePatterns, 8),
    confidence: Number(analysis?.confidence?.overall || 0),
    owned: libraryType === "owned_campaign"
  };
}

function buildCampaignMemoryIndex() {
  const approval = JSON.parse(fs.readFileSync(APPROVAL_PATH, "utf8"));
  const approvedIds = new Set(Array.isArray(approval?.ids) ? approval.ids : []);
  const references = [];
  for (const library of LIBRARIES) {
    if (!fs.existsSync(library.directory)) continue;
    for (const fileName of fs.readdirSync(library.directory).filter((name) => name.endsWith(".json"))) {
      const record = JSON.parse(fs.readFileSync(path.join(library.directory, fileName), "utf8"));
      const safeRecord = buildSafeRecord(record, library);
      if (safeRecord.id && safeRecord.confidence >= 0.7 && approvedIds.has(safeRecord.id)) references.push(safeRecord);
    }
  }

  references.sort((left, right) => {
    if (left.owned !== right.owned) return left.owned ? -1 : 1;
    return right.confidence - left.confidence || left.title.localeCompare(right.title, "da");
  });

  const index = {
    version: 2,
    generatedAt: new Date().toISOString(),
    policy: "Only explicitly curated references are available. Owned campaigns inform brand patterns; external references inform abstract design principles only.",
    counts: {
      owned: references.filter((item) => item.owned).length,
      external: references.filter((item) => !item.owned).length
    },
    references
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

if (require.main === module) {
  const index = buildCampaignMemoryIndex();
  process.stdout.write(`Campaign memory index: ${index.counts.owned} owned, ${index.counts.external} external\n`);
}

module.exports = { buildCampaignMemoryIndex };
