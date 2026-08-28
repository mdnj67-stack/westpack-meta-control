const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { buildCampaignMemoryIndex } = require("./campaign-memory-index");

const ROOT = path.resolve(__dirname, "..");
const LIBRARIES = {
  westpack: {
    sourceDir: path.join(ROOT, "campaign-import", "unsorted-email"),
    outputDir: path.join(ROOT, "campaign-memory", "imports"),
    manifestPath: path.join(ROOT, "campaign-memory", "manifest.json"),
    libraryType: "owned_campaign",
    sourceName: "Westpack"
  },
  rge: {
    sourceDir: path.join(ROOT, "campaign-import", "rge-inspiration"),
    outputDir: path.join(ROOT, "campaign-memory", "external", "imports"),
    manifestPath: path.join(ROOT, "campaign-memory", "external", "manifest.json"),
    libraryType: "external_inspiration",
    sourceName: "Really Good Emails"
  }
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).reduce((values, line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return values;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value.replace(/\\n/g, "\n");
    return values;
  }, {});
}

function parseArgs(argv) {
  const options = { force: false, limit: Number.POSITIVE_INFINITY, file: "", source: "westpack" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--force") options.force = true;
    if (argv[index] === "--limit") options.limit = Math.max(1, Number(argv[index + 1]) || 1);
    if (argv[index] === "--file") options.file = String(argv[index + 1] || "");
    if (argv[index] === "--source") options.source = String(argv[index + 1] || "westpack").toLowerCase();
  }
  return options;
}

function slugify(value) {
  return String(value || "campaign")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "campaign";
}

function normalizeLanguageCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "da" || normalized.includes("danish") || normalized.includes("dansk")) return "da-DK";
  if (normalized === "en" || normalized.includes("english") || normalized.includes("engelsk")) return "en-GB";
  return normalized || "unknown";
}

function deriveWeek(record) {
  const sourceWeek = String(record?.source?.file || "").match(/\bW(\d{1,2})\b/i)?.[1];
  const analysisWeek = String(record?.analysis?.week || "").match(/(\d{1,2})/)?.[1];
  const week = sourceWeek || analysisWeek || "";
  return week ? `W${week.padStart(2, "0")}` : "";
}

function deriveFamilyKey(record) {
  const fileName = String(record?.source?.file || "");
  const explicitSeries = fileName.match(/\b(W\d{1,2})\s+([^\d_]+?)\s+\d+[_:\s-]/i);
  if (explicitSeries) return slugify(`${explicitSeries[1]} ${explicitSeries[2]}`);
  const week = deriveWeek(record);
  const family = String(record?.analysis?.campaignFamily || "").trim();
  return slugify([week, family || record?.analysis?.campaignTitle || path.parse(fileName).name].filter(Boolean).join(" "));
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text;
    }
  }
  throw new Error("OpenAI returned no analysis text.");
}

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "campaignTitle", "week", "language", "campaignFamily", "campaignType", "funnelStage",
    "primaryGoal", "audience", "offer", "subjectLineVisible", "preheaderVisible", "primaryCta",
    "secondaryCtas", "products", "themes", "visualStyle", "copyStyle", "reusablePatterns", "risks", "confidence"
  ],
  properties: {
    campaignTitle: { type: "string" },
    week: { type: "string" },
    language: { type: "string" },
    campaignFamily: { type: "string" },
    campaignType: { type: "string", enum: ["sale", "product", "brand", "educational", "customer_story", "seasonal", "lead_generation", "other"] },
    funnelStage: { type: "string", enum: ["awareness", "consideration", "conversion", "retention", "mixed", "unknown"] },
    primaryGoal: { type: "string" },
    audience: { type: "string" },
    offer: { type: "string" },
    subjectLineVisible: { type: "string" },
    preheaderVisible: { type: "string" },
    primaryCta: { type: "string" },
    secondaryCtas: { type: "array", items: { type: "string" } },
    products: { type: "array", items: { type: "string" } },
    themes: { type: "array", items: { type: "string" } },
    visualStyle: {
      type: "object",
      additionalProperties: false,
      required: ["palette", "mood", "layoutPatterns", "imageStyle"],
      properties: {
        palette: { type: "array", items: { type: "string" } },
        mood: { type: "string" },
        layoutPatterns: { type: "array", items: { type: "string" } },
        imageStyle: { type: "string" }
      }
    },
    copyStyle: {
      type: "object",
      additionalProperties: false,
      required: ["tone", "structure", "urgency"],
      properties: {
        tone: { type: "string" },
        structure: { type: "array", items: { type: "string" } },
        urgency: { type: "string" }
      }
    },
    reusablePatterns: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "textReadability", "notes"],
      properties: {
        overall: { type: "number", minimum: 0, maximum: 1 },
        textReadability: { type: "number", minimum: 0, maximum: 1 },
        notes: { type: "string" }
      }
    }
  }
};

async function analyzeImage({ apiKey, model, filePath, fileName, library }) {
  const image = fs.readFileSync(filePath);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              library.libraryType === "external_inspiration"
                ? "Analyze this manually selected Really Good Emails reference for an internal design-pattern inspiration library."
                : "Analyze this historical Westpack email campaign screenshot for a reusable Campaign Memory Library.",
              `Source filename: ${fileName}`,
              "Read the complete email from top to bottom. Use the filename only as supporting evidence.",
              "Separate direct observations from interpretation by keeping uncertain fields conservative.",
              "Do not rate this as a high performer because no performance data is supplied.",
              "Reusable patterns must be abstract design/copy patterns, never instructions to copy exact creative.",
              library.libraryType === "external_inspiration"
                ? "Do not reproduce distinctive copy, branded artwork, or exact composition. Describe transferable principles only."
                : "Treat this as owned historical material, but do not infer performance without metrics.",
              "Return concise English metadata, but preserve visible Danish CTA or subject wording exactly when readable.",
              "Use an empty string or empty array when information is not visible. Confidence must reflect actual readability."
            ].join("\n")
          },
          {
            type: "input_image",
            image_url: `data:image/png;base64,${image.toString("base64")}`,
            detail: "high"
          }
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: "westpack_campaign_memory_email",
          schema: analysisSchema
        }
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed (${response.status}).`);
  return { analysis: JSON.parse(extractOutputText(payload)), model: payload.model || model };
}

function buildManifest(library) {
  const entries = fs.existsSync(library.outputDir)
    ? fs.readdirSync(library.outputDir).filter((name) => name.endsWith(".json")).map((name) => {
        const record = JSON.parse(fs.readFileSync(path.join(library.outputDir, name), "utf8"));
        return {
          id: record.id,
          sourceFile: record.source.file,
          campaignTitle: record.analysis.campaignTitle || path.parse(record.source.file).name,
          week: deriveWeek(record),
          familyKey: deriveFamilyKey(record),
          campaignFamily: record.analysis.campaignFamily,
          campaignType: record.analysis.campaignType,
          language: normalizeLanguageCode(record.analysis.language),
          themes: record.analysis.themes,
          confidence: record.analysis.confidence.overall,
          reviewStatus: record.review.status,
          approvedAsReference: Boolean(record.review.approvedAsReference),
          libraryType: record.library?.type || library.libraryType,
          sourceName: record.library?.sourceName || library.sourceName,
          sourceUrl: record.library?.sourceUrl || "",
          recordPath: path.relative(ROOT, path.join(library.outputDir, name)).replace(/\\/g, "/")
        };
      })
    : [];
  entries.sort((left, right) => left.sourceFile.localeCompare(right.sourceFile, "da"));
  fs.mkdirSync(path.dirname(library.manifestPath), { recursive: true });
  fs.writeFileSync(library.manifestPath, `${JSON.stringify({ version: 1, libraryType: library.libraryType, generatedAt: new Date().toISOString(), count: entries.length, campaigns: entries }, null, 2)}\n`);
  return entries;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const library = LIBRARIES[options.source];
  if (!library) throw new Error(`Unknown source library: ${options.source}. Use westpack or rge.`);
  const fileEnv = readEnvFile(path.join(ROOT, ".vercel.live.env"));
  const apiKey = process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || fileEnv.OPENAI_MODEL || "gpt-4.1";
  if (!apiKey) throw new Error("OPENAI_API_KEY is unavailable.");

  fs.mkdirSync(library.outputDir, { recursive: true });
  let files = fs.readdirSync(library.sourceDir)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "da"));
  if (options.file) files = files.filter((name) => name.toLowerCase().includes(options.file.toLowerCase()));
  files = files.slice(0, options.limit);

  let analyzed = 0;
  let skipped = 0;
  for (const fileName of files) {
    const filePath = path.join(library.sourceDir, fileName);
    const bytes = fs.readFileSync(filePath);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const idPrefix = options.source === "westpack" ? "" : `${options.source}-`;
    const id = `${idPrefix}${slugify(path.parse(fileName).name)}-${sha256.slice(0, 10)}`;
    const outputPath = path.join(library.outputDir, `${id}.json`);
    if (!options.force && fs.existsSync(outputPath)) {
      skipped += 1;
      process.stdout.write(`SKIP ${fileName}\n`);
      continue;
    }
    process.stdout.write(`ANALYZE ${fileName}\n`);
    try {
      const result = await analyzeImage({ apiKey, model, filePath, fileName, library });
      const record = {
        schemaVersion: 1,
        id,
        source: {
          file: fileName,
          relativePath: path.relative(ROOT, filePath).replace(/\\/g, "/"),
          sha256,
          bytes: bytes.length
        },
        library: {
          type: library.libraryType,
          sourceName: library.sourceName,
          sourceUrl: "",
          attributionRequired: library.libraryType === "external_inspiration"
        },
        analysis: result.analysis,
        performance: null,
        review: {
          status: library.libraryType === "external_inspiration" ? "external_needs_review" : "needs_review",
          approvedAsReference: false,
          notes: ""
        },
        provenance: {
          analyzedAt: new Date().toISOString(),
          model: result.model,
          method: "openai_vision"
        }
      };
      fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);
      analyzed += 1;
    } catch (error) {
      process.stderr.write(`ERROR ${fileName}: ${error.message}\n`);
    }
  }
  const entries = buildManifest(library);
  buildCampaignMemoryIndex();
  process.stdout.write(`COMPLETE analyzed=${analyzed} skipped=${skipped} manifest=${entries.length}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
