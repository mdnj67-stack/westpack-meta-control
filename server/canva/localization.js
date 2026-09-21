// Canva Localizer - the pure domain.
//
// Everything in this file is a plain function over plain data: no network, no storage, no config
// reads. The Canva REST surface is thin and asynchronous, and the interesting decisions (which
// markets share a language, how much longer a translation may be before it wrecks the artwork,
// what a half-finished batch of 18 should be called) are exactly the ones worth testing without
// standing up OAuth. `tests/canva-localization.test.js` covers this file directly.
//
// Two facts about Canva shape the whole model and are worth stating once here, because they are
// not obvious and they are the reason this feature looks the way it does:
//
// 1. The Connect REST API cannot see a design's elements. It can only see *autofill data fields*
//    that a designer tagged in the Canva editor with the Data autofill app. Untagged text is
//    invisible to us and can never be overwritten - which is why brand names, logos and URLs are
//    excluded by simply not tagging them, and why `GET /v1/designs/{id}/dataset` is authoritative
//    about what exists but silent about what it currently says.
// 2. There is no font size, text box geometry or overflow signal anywhere in the REST API. Fit
//    therefore cannot be corrected after the fact by shrinking type; it has to be controlled in
//    the translation, by giving each field a character budget, and then verified visually on the
//    rendered result. `resolveCharacterBudget` and `assessFieldFit` below are that control.

// The 18 markets are the ones the Klaviyo config already lists, so the language set follows the
// markets the department actually sends to rather than a second list that can drift out of step.
// Only the language name lives here; the market list itself is read from config at the edge.
const MARKET_LANGUAGES = {
  CZ: { language: "Czech", nativeName: "Čeština" },
  DE: { language: "German", nativeName: "Deutsch" },
  DK: { language: "Danish", nativeName: "Dansk" },
  ES: { language: "Spanish", nativeName: "Español" },
  EU: { language: "English (EU)", nativeName: "English" },
  FI: { language: "Finnish", nativeName: "Suomi" },
  FR: { language: "French", nativeName: "Français" },
  HU: { language: "Hungarian", nativeName: "Magyar" },
  IT: { language: "Italian", nativeName: "Italiano" },
  NL: { language: "Dutch", nativeName: "Nederlands" },
  NO: { language: "Norwegian", nativeName: "Norsk bokmål" },
  PL: { language: "Polish", nativeName: "Polski" },
  PT: { language: "Portuguese", nativeName: "Português" },
  RO: { language: "Romanian", nativeName: "Română" },
  SE: { language: "Swedish", nativeName: "Svenska" },
  SK: { language: "Slovak", nativeName: "Slovenčina" },
  UK: { language: "English (UK)", nativeName: "English" },
  US: { language: "English (US)", nativeName: "English" }
};

// Markets that share one language share one translation. The department still wants a separately
// named design per market (campaign_UK, campaign_US), but paying for the same English three times
// is waste, and three independently generated translations of one sentence would also drift.
const LANGUAGE_GROUP_BY_MARKET = {
  CZ: "cs", DE: "de", DK: "da", ES: "es", EU: "en", FI: "fi", FR: "fr", HU: "hu", IT: "it",
  NL: "nl", NO: "nb", PL: "pl", PT: "pt", RO: "ro", SE: "sv", SK: "sk", UK: "en", US: "en"
};

const TARGET_STATES = ["pending", "translated", "generated", "failed", "skipped"];

const JOB_STATES = ["draft", "translating", "generating", "complete", "partial", "failed"];

// A translation is allowed to run this much longer than its source before it is called tight.
// Ten per cent is deliberately strict: German runs 10-30% longer than English as a matter of
// course, so a default that tolerated that would flag nothing and the whole check would be
// decoration.
const DEFAULT_LENGTH_TOLERANCE = 0.1;
// Short strings need absolute slack, not relative slack. "Shop now" to "Jetzt kaufen" is +50% and
// completely fine inside a button; the same +50% on a 60-character paragraph is not. Four
// characters of headroom keeps the short-string case out of the warning list.
const MINIMUM_LENGTH_HEADROOM = 4;
// Past the budget but under this multiple of it, the artwork usually survives (Canva wraps, and a
// text box set to auto-shrink absorbs the rest). Past it, a human should look before it ships.
const TIGHT_FIT_MULTIPLIER = 1.15;

function normalizeMarketCode(value = "") {
  return String(value || "").trim().toUpperCase().slice(0, 4);
}

function normalizeText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePhrase(value = "") {
  return normalizeText(value).toLowerCase();
}

function describeMarket(marketCode = "") {
  const code = normalizeMarketCode(marketCode);
  const entry = MARKET_LANGUAGES[code];
  return {
    marketCode: code,
    language: entry?.language || code,
    nativeName: entry?.nativeName || "",
    languageGroup: LANGUAGE_GROUP_BY_MARKET[code] || code.toLowerCase(),
    known: Boolean(entry)
  };
}

function listSupportedMarkets(marketCodes = []) {
  const codes = Array.isArray(marketCodes) ? marketCodes : [];
  const seen = new Set();
  return codes
    .map((code) => normalizeMarketCode(code))
    .filter((code) => {
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .map((code) => describeMarket(code))
    .sort((left, right) => left.marketCode.localeCompare(right.marketCode));
}

// One translation per language, reused across every market that speaks it. The returned groups
// carry their markets so the generation step can still produce one named design per market.
function groupMarketsByLanguage(marketCodes = []) {
  const groups = new Map();
  for (const market of listSupportedMarkets(marketCodes)) {
    const existing = groups.get(market.languageGroup);
    if (existing) {
      existing.markets.push(market.marketCode);
      continue;
    }
    groups.set(market.languageGroup, {
      languageGroup: market.languageGroup,
      language: market.language,
      markets: [market.marketCode]
    });
  }
  return [...groups.values()].sort((left, right) => left.language.localeCompare(right.language));
}

function resolveCharacterBudget(sourceText = "", tolerance = DEFAULT_LENGTH_TOLERANCE) {
  const length = normalizeText(sourceText).length;
  if (!length) return 0;
  const ratioBudget = Math.ceil(length * (1 + Math.max(0, Number(tolerance) || 0)));
  return Math.max(length + MINIMUM_LENGTH_HEADROOM, ratioBudget);
}

// Fit is a statement about character count, not about pixels, and it says so. Pixel truth only
// exists once Canva has rendered the design, which is what the review step's thumbnail and the
// optional vision check are for.
function assessFieldFit({ sourceText = "", translatedText = "", budget = 0 } = {}) {
  const source = normalizeText(sourceText);
  const translated = normalizeText(translatedText);
  const resolvedBudget = Number(budget) > 0 ? Number(budget) : resolveCharacterBudget(source);
  const length = translated.length;

  if (!translated) {
    return { status: "empty", length: 0, budget: resolvedBudget, overflow: 0, ratio: 0 };
  }
  if (!resolvedBudget) {
    return { status: "fits", length, budget: 0, overflow: 0, ratio: 1 };
  }

  const ratio = source.length ? Number((length / source.length).toFixed(3)) : 1;
  if (length <= resolvedBudget) {
    return { status: "fits", length, budget: resolvedBudget, overflow: 0, ratio };
  }

  const overflow = length - resolvedBudget;
  const status = length <= Math.ceil(resolvedBudget * TIGHT_FIT_MULTIPLIER) ? "tight" : "over";
  return { status, length, budget: resolvedBudget, overflow, ratio };
}

const FIT_SEVERITY = { fits: 0, empty: 1, tight: 2, over: 3 };

function assessTargetFit(fieldFits = []) {
  const entries = Array.isArray(fieldFits) ? fieldFits.filter(Boolean) : [];
  if (!entries.length) return { status: "fits", worstField: "", tight: 0, over: 0, empty: 0 };

  let worst = entries[0];
  const counts = { tight: 0, over: 0, empty: 0 };
  for (const entry of entries) {
    if (counts[entry.status] !== undefined) counts[entry.status] += 1;
    if ((FIT_SEVERITY[entry.status] ?? 0) > (FIT_SEVERITY[worst.status] ?? 0)) worst = entry;
  }

  return {
    status: worst.status === "fits" ? "fits" : worst.status,
    worstField: worst.key || "",
    tight: counts.tight,
    over: counts.over,
    empty: counts.empty
  };
}

function describeFit(fit = {}) {
  if (!fit || fit.status === "fits") return "All text fits";
  if (fit.status === "empty") return "A field came back empty";
  if (fit.status === "tight") return `Tight on ${fit.worstField || "one field"} - check before sending`;
  return `Too long on ${fit.worstField || "one field"} - overflow likely`;
}

// Canva allows 1-255 characters for a design title. The base title is stripped of any market
// suffix it already carries so re-running a job against a generated design cannot produce
// campaign_DE_DE.
function buildLocalizedTitle(baseTitle = "", marketCode = "") {
  const code = normalizeMarketCode(marketCode);
  const knownCodes = Object.keys(MARKET_LANGUAGES).join("|");
  const base = normalizeText(baseTitle)
    .replace(new RegExp(`[ _-](${knownCodes})$`, "i"), "")
    .trim() || "Untitled design";
  const suffix = code ? `_${code}` : "";
  return `${base.slice(0, 255 - suffix.length)}${suffix}`;
}

// Recurring exclusions. A field is excluded either because its name was excluded before (the
// designer names the brand line "brand" in every master) or because its source text was. Both are
// remembered, because operators think in both terms.
function applyExclusionMemory(fields = [], memory = {}) {
  const excludedKeys = new Set((memory?.fieldKeys || []).map((key) => normalizePhrase(key)));
  const excludedPhrases = new Set((memory?.phrases || []).map((phrase) => normalizePhrase(phrase)));

  return (Array.isArray(fields) ? fields : []).map((field) => {
    if (field.translate === false) return field;
    const keyExcluded = excludedKeys.has(normalizePhrase(field.key));
    const phraseExcluded = Boolean(field.sourceText) && excludedPhrases.has(normalizePhrase(field.sourceText));
    if (!keyExcluded && !phraseExcluded) return field;
    return { ...field, translate: false, excludedBy: keyExcluded ? "field_name" : "phrase" };
  });
}

function rememberExclusions(memory = {}, fields = []) {
  const fieldKeys = new Set((memory?.fieldKeys || []).map((key) => normalizePhrase(key)).filter(Boolean));
  const phrases = new Set((memory?.phrases || []).map((phrase) => normalizePhrase(phrase)).filter(Boolean));

  for (const field of Array.isArray(fields) ? fields : []) {
    if (field?.translate !== false) continue;
    if (field.key) fieldKeys.add(normalizePhrase(field.key));
    // Only short strings are remembered by phrase. A remembered paragraph would never match
    // again, and the memory would fill with noise nobody can audit.
    const phrase = normalizePhrase(field.sourceText);
    if (phrase && phrase.length <= 40) phrases.add(phrase);
  }

  return {
    fieldKeys: [...fieldKeys].sort().slice(0, 200),
    phrases: [...phrases].sort().slice(0, 200)
  };
}

// Canva returns the dataset as { fieldName: { type } } and nothing else - no current value. The
// plan therefore pairs each field with source text the operator supplies (or that the optional
// OCR read proposes), and carries the field's type so image and chart fields are never handed a
// string.
function buildFieldPlan({ dataset = {}, sourceTexts = {}, exclusions = {}, tolerance = DEFAULT_LENGTH_TOLERANCE } = {}) {
  const entries = Object.entries(dataset || {});
  const fields = entries.map(([key, definition]) => {
    const type = String(definition?.type || "text");
    const sourceText = normalizeText(sourceTexts?.[key]);
    return {
      key,
      type,
      sourceText,
      translate: type === "text",
      budget: type === "text" ? resolveCharacterBudget(sourceText, tolerance) : 0,
      excludedBy: type === "text" ? "" : "not_text"
    };
  });

  return applyExclusionMemory(fields, exclusions).sort((left, right) => left.key.localeCompare(right.key));
}

function summariseFieldPlan(fields = []) {
  const list = Array.isArray(fields) ? fields : [];
  const text = list.filter((field) => field.type === "text");
  const translatable = text.filter((field) => field.translate !== false);
  return {
    total: list.length,
    text: text.length,
    translatable: translatable.length,
    excluded: text.length - translatable.length,
    missingSourceText: translatable.filter((field) => !field.sourceText).length,
    nonText: list.length - text.length
  };
}

function isFieldPlanReady(fields = []) {
  const summary = summariseFieldPlan(fields);
  return summary.translatable > 0 && summary.missingSourceText === 0;
}

function createTarget(marketCode = "") {
  const market = describeMarket(marketCode);
  return {
    marketCode: market.marketCode,
    language: market.language,
    nativeName: market.nativeName,
    languageGroup: market.languageGroup,
    state: "pending",
    title: "",
    translatedFields: {},
    fieldFits: [],
    fit: { status: "fits", worstField: "", tight: 0, over: 0, empty: 0 },
    designId: "",
    designUrl: "",
    editUrl: "",
    thumbnailUrl: "",
    exportUrls: [],
    exportedAt: "",
    visualCheck: null,
    attempts: 0,
    error: "",
    updatedAt: ""
  };
}

function createLocalizationJob({
  id = "",
  sourceDesignId = "",
  sourceDesignTitle = "",
  sourceLanguage = "Danish",
  baseTitle = "",
  fields = [],
  marketCodes = [],
  operator = "",
  createdAt = new Date().toISOString()
} = {}) {
  return normalizeLocalizationJob({
    id,
    sourceDesignId,
    sourceDesignTitle,
    sourceLanguage,
    baseTitle: baseTitle || sourceDesignTitle,
    fields,
    targets: listSupportedMarkets(marketCodes).map((market) => createTarget(market.marketCode)),
    operator,
    createdAt,
    updatedAt: createdAt,
    state: "draft"
  });
}

function normalizeTarget(target = {}) {
  const base = createTarget(target?.marketCode);
  const state = TARGET_STATES.includes(target?.state) ? target.state : "pending";
  const fieldFits = Array.isArray(target?.fieldFits) ? target.fieldFits : [];
  return {
    ...base,
    ...target,
    marketCode: base.marketCode,
    language: base.language,
    nativeName: base.nativeName,
    languageGroup: base.languageGroup,
    state,
    translatedFields: target?.translatedFields && typeof target.translatedFields === "object"
      ? target.translatedFields
      : {},
    fieldFits,
    fit: target?.fit && typeof target.fit === "object" ? target.fit : assessTargetFit(fieldFits),
    exportUrls: Array.isArray(target?.exportUrls) ? target.exportUrls : [],
    attempts: Number(target?.attempts) || 0,
    error: String(target?.error || "")
  };
}

function normalizeLocalizationJob(job = {}) {
  const targets = (Array.isArray(job?.targets) ? job.targets : []).map((target) => normalizeTarget(target));
  const fields = (Array.isArray(job?.fields) ? job.fields : []).map((field) => ({
    key: String(field?.key || ""),
    type: String(field?.type || "text"),
    sourceText: normalizeText(field?.sourceText),
    translate: field?.translate !== false,
    budget: Number(field?.budget) || 0,
    excludedBy: String(field?.excludedBy || "")
  })).filter((field) => field.key);

  const normalized = {
    id: String(job?.id || ""),
    sourceDesignId: String(job?.sourceDesignId || ""),
    sourceDesignTitle: String(job?.sourceDesignTitle || ""),
    sourceLanguage: String(job?.sourceLanguage || "Danish"),
    baseTitle: String(job?.baseTitle || job?.sourceDesignTitle || ""),
    operator: String(job?.operator || ""),
    createdAt: String(job?.createdAt || new Date().toISOString()),
    updatedAt: String(job?.updatedAt || job?.createdAt || new Date().toISOString()),
    fields,
    targets,
    notes: Array.isArray(job?.notes) ? job.notes.slice(-40) : [],
    state: JOB_STATES.includes(job?.state) ? job.state : "draft"
  };

  normalized.state = resolveJobState(normalized);
  return normalized;
}

function resolveJobState(job = {}) {
  const targets = Array.isArray(job?.targets) ? job.targets : [];
  const live = targets.filter((target) => target.state !== "skipped");
  if (!live.length) return "draft";

  const generated = live.filter((target) => target.state === "generated").length;
  const failed = live.filter((target) => target.state === "failed").length;
  const translated = live.filter((target) => target.state === "translated").length;

  if (generated === live.length) return "complete";
  if (failed === live.length) return "failed";
  // A batch of 18 must never be reported as a single pass/fail. Partial is the honest state for
  // "most of them are live in Canva and two are not", and it is the state the retry path acts on.
  if (generated > 0 && generated + failed === live.length) return "partial";
  if (generated > 0) return "generating";
  if (translated > 0) return failed ? "generating" : "translating";
  return failed ? "failed" : "draft";
}

function summariseLocalizationJob(job = {}) {
  const targets = Array.isArray(job?.targets) ? job.targets : [];
  const live = targets.filter((target) => target.state !== "skipped");
  const generated = live.filter((target) => target.state === "generated");
  return {
    total: live.length,
    pending: live.filter((target) => target.state === "pending").length,
    translated: live.filter((target) => target.state === "translated").length,
    generated: generated.length,
    failed: live.filter((target) => target.state === "failed").length,
    skipped: targets.length - live.length,
    needsReview: generated.filter((target) => target.fit?.status && target.fit.status !== "fits").length,
    exported: generated.filter((target) => (target.exportUrls || []).length > 0).length,
    state: resolveJobState(job)
  };
}

// Which targets a given action should touch. Retrying a partial batch must not regenerate the
// fifteen designs that already exist - that would leave fifteen orphaned duplicates in Canva and
// spend the autofill quota for nothing.
function selectTargetsForTranslation(job = {}, { marketCodes = [], includeTranslated = false } = {}) {
  const requested = new Set(listSupportedMarkets(marketCodes).map((market) => market.marketCode));
  return (job?.targets || []).filter((target) => {
    if (target.state === "skipped") return false;
    if (requested.size && !requested.has(target.marketCode)) return false;
    if (target.state === "generated") return false;
    if (target.state === "translated" && !includeTranslated) return false;
    return true;
  });
}

function selectTargetsForGeneration(job = {}, { marketCodes = [], regenerate = false } = {}) {
  const requested = new Set(listSupportedMarkets(marketCodes).map((market) => market.marketCode));
  return (job?.targets || []).filter((target) => {
    if (target.state === "skipped") return false;
    if (requested.size && !requested.has(target.marketCode)) return false;
    if (target.state === "generated" && !regenerate) return false;
    if (target.state === "pending") return false;
    return Object.keys(target.translatedFields || {}).length > 0;
  });
}

module.exports = {
  DEFAULT_LENGTH_TOLERANCE,
  JOB_STATES,
  MARKET_LANGUAGES,
  TARGET_STATES,
  TIGHT_FIT_MULTIPLIER,
  applyExclusionMemory,
  assessFieldFit,
  assessTargetFit,
  buildFieldPlan,
  buildLocalizedTitle,
  createLocalizationJob,
  createTarget,
  describeFit,
  describeMarket,
  groupMarketsByLanguage,
  isFieldPlanReady,
  listSupportedMarkets,
  normalizeLocalizationJob,
  normalizeMarketCode,
  normalizeText,
  rememberExclusions,
  resolveCharacterBudget,
  resolveJobState,
  selectTargetsForGeneration,
  selectTargetsForTranslation,
  summariseFieldPlan,
  summariseLocalizationJob
};
