const fs = require("fs");
const path = require("path");

let glossaryCache = null;

function loadGlossary() {
  if (glossaryCache) {
    return glossaryCache;
  }

  try {
    const glossaryPath = path.join(process.cwd(), "data", "easy-glossary.json");
    const raw = fs.readFileSync(glossaryPath, "utf8").replace(/^\uFEFF/, "");
    glossaryCache = JSON.parse(raw);
  } catch (error) {
    glossaryCache = { sourceLanguage: "Uk", languages: ["Uk"], entries: [] };
  }

  return glossaryCache;
}

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveGlossaryLanguage(targetLanguage = "") {
  const normalized = normalize(targetLanguage);
  const aliases = new Map([
    ["uk", "Uk"],
    ["engelsk", "Uk"],
    ["engelsk uk", "Uk"],
    ["engelsk eu", "Uk"],
    ["engelsk us", "Uk"],
    ["english", "Uk"],
    ["english uk", "Uk"],
    ["english eu", "Uk"],
    ["english us", "Uk"],
    ["en", "Uk"],
    ["en gb", "Uk"],
    ["en uk", "Uk"],
    ["en eu", "Uk"],
    ["en us", "Uk"],
    ["eu", "Uk"],
    ["us", "Uk"],
    ["dansk", "Uk"],
    ["german", "DE"],
    ["tysk", "DE"],
    ["tysk de", "DE"],
    ["deutsch", "DE"],
    ["de", "DE"],
    ["de de", "DE"],
    ["danish", "Uk"],
    ["dansk dk", "Uk"],
    ["da", "Uk"],
    ["da dk", "Uk"],
    ["swedish", "SE"],
    ["svensk", "SE"],
    ["svensk se", "SE"],
    ["svenska", "SE"],
    ["sv", "SE"],
    ["sv se", "SE"],
    ["norwegian", "Uk"],
    ["norsk no", "Uk"],
    ["norsk", "Uk"],
    ["no", "Uk"],
    ["french", "FR"],
    ["fransk", "FR"],
    ["fransk fr", "FR"],
    ["francais", "FR"],
    ["français", "FR"],
    ["fran ais", "FR"],
    ["fran ais fr", "FR"],
    ["fr", "FR"],
    ["fr fr", "FR"],
    ["dutch", "NL"],
    ["hollandsk", "NL"],
    ["hollandsk nl", "NL"],
    ["nl", "NL"],
    ["finnish", "FI"],
    ["finsk", "FI"],
    ["finsk fi", "FI"],
    ["fi", "FI"],
    ["hungarian", "HU"],
    ["hu", "HU"],
    ["italian", "IT"],
    ["italiensk", "IT"],
    ["italiensk it", "IT"],
    ["it", "IT"],
    ["polish", "PL"],
    ["polsk", "PL"],
    ["polsk pl", "PL"],
    ["pl", "PL"],
    ["portuguese", "PT"],
    ["portugisisk", "PT"],
    ["portugisisk pt", "PT"],
    ["pt", "PT"],
    ["romanian", "RO"],
    ["rumænsk", "RO"],
    ["rumansk", "RO"],
    ["rumænsk ro", "RO"],
    ["rumansk ro", "RO"],
    ["rum nsk", "RO"],
    ["rum nsk ro", "RO"],
    ["ro", "RO"],
    ["slovak", "SK"],
    ["sk", "SK"],
    ["spanish", "ES"],
    ["spansk", "ES"],
    ["spansk es", "ES"],
    ["es", "ES"],
    ["czech", "CZ"],
    ["cz", "CZ"]
  ]);

  return aliases.get(normalized) || String(targetLanguage || "").trim() || "Uk";
}

function collectGlossaryMatches({ targetLanguage, sourceTexts = [], limit = 40 } = {}) {
  const glossary = loadGlossary();
  const targetCode = resolveGlossaryLanguage(targetLanguage);
  const haystack = normalize(sourceTexts.filter(Boolean).join(" \n "));
  if (!haystack) {
    return [];
  }

  const scored = [];
  for (const entry of glossary.entries || []) {
    const source = String(entry?.source || "").trim();
    const translation = String(entry?.translations?.[targetCode] || "").trim();
    if (!source || !translation || translation === source) continue;

    const normalizedSource = normalize(source);
    if (!normalizedSource || normalizedSource.length < 3) continue;
    if (!haystack.includes(normalizedSource)) continue;

    scored.push({
      source,
      translation,
      length: normalizedSource.length
    });
  }

  const seen = new Set();
  return scored
    .sort((left, right) => right.length - left.length || left.source.localeCompare(right.source))
    .slice(0, limit)
    .map(({ source, translation }) => ({ source, translation, targetCode }))
    .filter((item) => {
      const key = item.source;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildGlossaryPromptBlock(options = {}) {
  const matches = collectGlossaryMatches(options);
  if (!matches.length) {
    return "";
  }

  return [
    `Glossary matches for ${matches[0].targetCode}:`,
    ...matches.map((item) => `${item.source} => ${item.translation}`),
    "Use these translations whenever the source term appears. Keep product names and category names consistent with the glossary."
  ].join("\n");
}

module.exports = {
  buildGlossaryPromptBlock,
  collectGlossaryMatches,
  loadGlossary,
  resolveGlossaryLanguage
};
