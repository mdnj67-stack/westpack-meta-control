// The subject line generator: reads one Danish campaign email, analyses it, and writes subject
// line + preheader pairs from three layers - Westpack's own measured sends (layer 1), the pattern
// bank (layer 2) and the rules (layer 3).
//
// Two model calls, deliberately separate. The analysis is the brief: what the email actually says,
// what it may and may not promise, and which mechanisms suit it. It is shown to the operator before
// anything is written, so a wrong reading of the email is caught at the brief rather than in
// eighteen subject lines built on it. Generation then writes against that brief.
//
// The model is told the rules and the facts; the deterministic check afterwards is what enforces
// them. Every candidate goes through checkSubjectLine with the email's own text, so an invented
// "-30%" or a delivery promise is flagged on screen no matter how fluent it reads.

const { buildWestpackKnowledgePromptBlock } = require("../lib/westpack-knowledge");
const { repairModelJsonText } = require("../lib/model-json");
const { MECHANISMS, CAMPAIGN_TYPES, MECHANISM_KEYS, CAMPAIGN_TYPE_KEYS, TRANSLATION_RISKS, TONE_KEYS, mechanismLabel } = require("./subject-line-taxonomy");
const { buildGlossaryPromptBlock } = require("../lib/glossary");
const { buildRulesPromptBlock, checkSubjectLine } = require("./subject-line-rules");

const EMAIL_TEXT_LIMIT = 9000;
const PROMPT_EMAIL_TEXT_LIMIT = 6500;
// Twelve strong lines, with the writer's own three picks on top, is what an operator can actually
// weigh; "write new ones" adds more without repeats.
const DEFAULT_CANDIDATE_COUNT = 12;
// Two attempts (the stronger model, then the default) must fit inside the function's 300 seconds.
const REQUEST_TIMEOUT_MS = 130_000;

const NAMED_ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  ndash: "–", mdash: "—", hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", euro: "€",
  aelig: "æ", oslash: "ø", aring: "å", AElig: "Æ", Oslash: "Ø", Aring: "Å", eacute: "é", Eacute: "É",
  uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", auml: "ä", Auml: "Ä", szlig: "ß", egrave: "è", agrave: "à"
};

function decodeEntities(text = "") {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : match));
}

// The email as a reader sees it: text only, block elements on their own lines, Klaviyo template
// tags removed. This is also the haystack the "claim not in email" rule searches.
function extractEmailText({ html = "", text = "" } = {}) {
  const source = String(html || "").trim();
  if (!source) return decodeEntities(String(text || "")).replace(/\s+\n/g, "\n").trim().slice(0, EMAIL_TEXT_LIMIT);
  const stripped = source
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/td|\/tr|\/h[1-6]|\/li|\/table)[^>]*>/gi, "\n")
    .replace(/<img[^>]*alt="([^"]+)"[^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{%[\s\S]*?%\}/g, " ")
    .replace(/\{\{[\s\S]*?\}\}/g, " ");
  return decodeEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, EMAIL_TEXT_LIMIT);
}

function extractJsonText(payload) {
  const parts = [];
  for (const item of payload?.output || []) {
    for (const chunk of item?.content || []) {
      if (typeof chunk?.text === "string") parts.push(chunk.text);
    }
  }
  if (!parts.length && typeof payload?.output_text === "string") parts.push(payload.output_text);
  return repairModelJsonText(parts.join("\n").trim());
}

// Writing gets the stronger model, because it writes better Danish. Reading the email and tagging
// imported lines get the default one: on 2026-10-27 the stronger model ran past 130 seconds on the
// analysis alone, where the default answered in about ten.
function resolveModels(config = {}, { writing = false } = {}) {
  const strong = config.contentAgentModel || config.openAiModel;
  const ordered = writing ? [strong, config.openAiModel] : [config.openAiModel, strong];
  return [...new Set(ordered.filter(Boolean))];
}

// When the preferred model is unavailable on the key or times out, the other one still produces a
// usable answer rather than an error.
async function requestStructured(config, { input, schemaName, schema, reasoningEffort = "", writing = false, temperature = null }) {
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
  let lastError = null;
  for (const model of resolveModels(config, { writing })) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const reasoningModel = /^gpt-5/i.test(model);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
        body: JSON.stringify({
          model,
          input,
          text: { format: { type: "json_schema", name: schemaName, schema } },
          ...(reasoningEffort && reasoningModel ? { reasoning: { effort: reasoningEffort } } : {}),
          // Reasoning models refuse a temperature; the others take one.
          ...(temperature !== null && !reasoningModel ? { temperature } : {})
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `OpenAI request failed (${response.status}).`;
        lastError = new Error(message);
        if (/model/i.test(message) && (response.status === 404 || response.status === 400 || response.status === 403)) continue;
        throw lastError;
      }
      return { parsed: JSON.parse(extractJsonText(payload)), model: payload.model || model };
    } catch (error) {
      if (error?.name === "AbortError") lastError = new Error(`OpenAI request exceeded ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
      else lastError = error;
      if (error?.name !== "AbortError" && !/model/i.test(String(error?.message || ""))) throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("OpenAI request failed.");
}

function taxonomyBlock() {
  return [
    "Mechanisms (why a subject line gets opened) - use these keys:",
    ...MECHANISMS.map((item) => `- ${item.key}: ${item.label}. ${item.description}`),
    "",
    "Campaign types (what the email is about) - use these keys:",
    ...CAMPAIGN_TYPES.map((item) => `- ${item.key}: ${item.label}. ${item.description}`)
  ].join("\n");
}

function pct(value, digits = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "n/a";
}

function describeSend(entry) {
  const index = Number.isFinite(entry.openIndex) ? `åbningsindeks ${entry.openIndex.toFixed(2)}` : "intet indeks";
  const click = Number.isFinite(entry.clickIndex) ? `, klikindeks ${entry.clickIndex.toFixed(2)}` : "";
  return `"${entry.subject}"${entry.previewText ? ` / "${entry.previewText}"` : ""} (${String(entry.sentAt).slice(0, 10)}, ${index}${click})`;
}

function describeTest(test) {
  const arms = test.arms.map((arm) => `${arm.letter}: "${arm.subject}"${arm.previewText && test.differs !== "subject" ? ` / "${arm.previewText}"` : ""} - ${pct(arm.openRate)} åbning, ${pct(arm.clickRate, 2)} klik, ${arm.received} modtagere`).join("; ");
  const winner = test.arms.find((arm) => arm.id === test.winnerId)?.letter || "?";
  const note = test.includesRemainder ? " Den største arm var Klaviyos valg og blev også sendt til resten af listen bagefter, så tallene er ikke helt sammenlignelige." : "";
  return `[ab:${test.campaignId}] ${test.country} ${String(test.sentAt).slice(0, 10)} ${test.campaignName}: ${arms}. Vinder på åbning: ${winner} (${test.verdict}, z=${test.z}).${note}`;
}

function buildHouseEvidenceBlock(insights = {}, { compact = false, features = true } = {}) {
  if (!insights?.sendCount) {
    return "Westpack's own send history is not synced yet, so there is no house evidence for this campaign. Say so where it matters rather than guessing.";
  }
  const lines = [
    `Westpack's own sends from the ${insights.country} account: ${insights.sendCount} subject lines since 2021, ${insights.abTestCount} A/B tests of subject or preheader.`,
    "How to read the figures: open rates are inflated by Apple Mail Privacy Protection, so each send is scored as an open index against its own market's typical open rate in the weeks around it (1.00 = typical). Inside an A/B test the inflation hits both arms equally, so the difference is real; A/B tests are the strongest evidence here. Click index is the same idea for clicks, with bot clicks removed.",
    ""
  ];
  if (insights.abLessons?.length) {
    lines.push("A/B tests with a winner (most relevant first):");
    insights.abLessons.slice(0, compact ? 6 : 12).forEach((test) => lines.push(`- ${describeTest(test)}`));
    lines.push("");
  }
  if (insights.abFamilies?.length) {
    lines.push("The same test run in several markets:");
    insights.abFamilies.forEach((family) => lines.push(`- ${family.campaignName}: variant ${family.leader} won in ${family.leaderWins} of ${family.tests} markets (${family.markets.join(", ")}), ${family.decisive} of them clearly.`));
    lines.push("");
  }
  if (!compact && insights.topPerformers?.length) {
    lines.push("Highest open index in the last three years:");
    insights.topPerformers.slice(0, 12).forEach((entry) => lines.push(`- ${describeSend(entry)}`));
    lines.push("");
    lines.push("Lowest open index in the last three years:");
    (insights.weakest || []).slice(0, 6).forEach((entry) => lines.push(`- ${describeSend(entry)}`));
    lines.push("");
  }
  if (insights.relevant?.length) {
    lines.push("Past sends about something similar:");
    insights.relevant.slice(0, compact ? 6 : 10).forEach((entry) => lines.push(`- ${describeSend(entry)}`));
    lines.push("");
  }
  // Only a significant record is told to the writer. A "leans" verdict on twenty tests moved when
  // the same lines were tagged twice, and a model told it would treat it as a rule.
  const evidence = insights.mechanismEvidence;
  if (evidence?.headToHeads) {
    const significant = (evidence.byMechanism || []).filter((item) => item.signal === "wins" || item.signal === "loses");
    if (significant.length) {
      lines.push(`Mechanisms with a significant record in Westpack's own A/B tests (sign test on distinct tests, opens):`);
      significant.forEach((item) => lines.push(`- ${mechanismLabel(item.mechanism)} ${item.signal === "wins" ? "wins" : "loses"} more often than chance: ${item.familyWins} of ${item.familyTests} distinct tests; on clicks ${item.clickWins} of ${item.headToHeads} head-to-heads.`));
    } else {
      lines.push(`Across ${evidence.headToHeads} head-to-heads in Westpack's own A/B tests where the two lines used different mechanisms, no mechanism wins or loses more often than a coin flip on distinct tests. The house's tests do not pick a mechanism: choose by what the email is about.`);
    }
    const offer = evidence.offerCheck;
    if (offer?.headToHeads) {
      lines.push(`An offer in the subject (a discount, %, "spar", "rabat") against no offer: the offer line won ${offer.familyWins} of ${offer.familyTests} distinct tests on opens and ${offer.clickWins} of ${offer.headToHeads} head-to-heads on clicks - ${offer.signal === "wins" ? "it wins more often than chance" : offer.signal === "loses" ? "it loses more often than chance" : "no reliable difference either way"}. Use an offer when the email has one, and never invent one.`);
    }
    lines.push("");
  }
  const outcomes = insights.generatorOutcomes;
  if (outcomes?.sent) {
    lines.push(`Lines this generator wrote that Westpack then sent (${outcomes.sent} so far, median open index ${Number(outcomes.medianOpenIndex).toFixed(2)}):`);
    outcomes.rows.filter((row) => row.sent).slice(0, 10).forEach((row) => lines.push(`- "${row.sent.subject}" (${mechanismLabel(row.mechanism)}, ${String(row.sent.sentAt).slice(0, 10)}, open index ${Number.isFinite(row.sent.openIndex) ? row.sent.openIndex.toFixed(2) : "n/a"})`));
    lines.push("");
  }
  if (features && insights.featureStats?.length) {
    lines.push("Median open index with and without a feature (correlation across different emails and seasons - weak evidence, never a rule):");
    insights.featureStats.slice(0, 8).forEach((stat) => lines.push(`- ${stat.label}: ${stat.openIndexWith.toFixed(2)} with (${stat.withCount}) vs ${stat.openIndexWithout.toFixed(2)} without (${stat.withoutCount}); click index ${stat.clickIndexWith ?? "n/a"} vs ${stat.clickIndexWithout ?? "n/a"}.`));
  }
  return lines.join("\n").trim();
}

function enumWithEmpty(values) {
  return { type: "string", enum: [...values, ""] };
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    coreMessage: { type: "string" },
    campaignType: { type: "string", enum: CAMPAIGN_TYPE_KEYS },
    secondaryType: enumWithEmpty(CAMPAIGN_TYPE_KEYS),
    readerMoment: { type: "string" },
    offer: { type: "string" },
    deadline: { type: "string" },
    products: { type: "array", maxItems: 8, items: { type: "string" } },
    hooks: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { hook: { type: "string" }, evidence: { type: "string" } },
        required: ["hook", "evidence"]
      }
    },
    facts: { type: "array", maxItems: 10, items: { type: "string" } },
    mustNotPromise: { type: "array", maxItems: 6, items: { type: "string" } },
    emotionalAngle: { type: "string" },
    recommendedMechanisms: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { mechanism: { type: "string", enum: MECHANISM_KEYS }, reason: { type: "string" } },
        required: ["mechanism", "reason"]
      }
    },
    avoidMechanisms: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { mechanism: { type: "string", enum: MECHANISM_KEYS }, reason: { type: "string" } },
        required: ["mechanism", "reason"]
      }
    },
    translationNotes: { type: "string" },
    houseEvidence: { type: "string" }
  },
  required: ["coreMessage", "campaignType", "secondaryType", "readerMoment", "offer", "deadline", "products", "hooks", "facts", "mustNotPromise", "emotionalAngle", "recommendedMechanisms", "avoidMechanisms", "translationNotes", "houseEvidence"]
};

async function analyseCampaign({ config, templateName = "", emailText = "", insights = {} }) {
  const input = [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          "You are Westpack's senior email strategist.",
          "Westpack is a Danish B2B packaging supplier - jewellery boxes, pouches, gift boxes, carrier bags, displays - selling to shops and brands that package what they sell, with jewellery businesses at the core. Emails go out from a Danish master and are translated into about fifteen markets.",
          "You read one Danish campaign email and write the brief a copywriter needs for its subject line and preheader.",
          "`coreMessage` is one sentence of at most 25 words: the single thing the email wants the reader to do or feel. Detail belongs in the other fields.",
          "Never invent. Every offer, number, deadline, product and fact you list must be in the email text; if the email has no offer, `offer` is empty. `evidence` quotes the email.",
          "`mustNotPromise` lists what a subject line could plausibly be tempted to promise that the email does not deliver, plus any of Westpack's standing rules this email comes close to.",
          "`recommendedMechanisms` are ranked; the reasons refer to this email and, where it exists, to Westpack's own A/B evidence below. Weigh the mechanism record from Westpack's A/B tests: a mechanism that keeps winning head-to-heads deserves a place when it fits the email, one that keeps losing needs a reason from this email to be recommended. Never let the record override what the email is about. `avoidMechanisms` only where a mechanism would mislead or clash with the email.",
          "`houseEvidence` is two or three sentences on what Westpack's own sends and A/B tests suggest for an email like this one, naming the tests by their campaign name - never by an id in square brackets. A single A/B test is a single result: say what it showed (\"in W31 the question beat the statement\"), never that a mechanism \"performs best\" or \"clearly wins\" unless the mechanism record below says it wins more often than chance. If the evidence is thin or inconclusive, say so plainly.",
          "Each mechanism appears at most once in `recommendedMechanisms`.",
          "Write every prose field in Danish.",
          "",
          taxonomyBlock(),
          "",
          buildWestpackKnowledgePromptBlock({ sourceTexts: [templateName, emailText], channel: "klaviyo", keepSourceClaims: true })
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: [
          `Campaign template: ${templateName || "(unnamed)"}`,
          "",
          "The email, as text:",
          emailText.slice(0, PROMPT_EMAIL_TEXT_LIMIT),
          "",
          buildHouseEvidenceBlock(insights, { compact: true })
        ].join("\n")
      }]
    }
  ];
  const { parsed, model } = await requestStructured(config, { input, schemaName: "westpack_subject_line_analysis", schema: ANALYSIS_SCHEMA, reasoningEffort: "low" });
  // Ids the model was told not to write still come through now and then; they become the test's
  // name, as in the suggestions' rationales.
  const phrases = evidencePhrases({ abTests: insights.abLessons || [] });
  // The schema cannot forbid a repeated mechanism, and a repeat would give it two slots' weight.
  const seen = new Set();
  const analysis = {
    ...parsed,
    houseEvidence: cleanRationale(parsed?.houseEvidence, phrases),
    recommendedMechanisms: (parsed?.recommendedMechanisms || [])
      .filter((item) => (seen.has(item.mechanism) ? false : seen.add(item.mechanism)))
      .map((item) => ({ ...item, reason: cleanRationale(item.reason, phrases) })),
    avoidMechanisms: (parsed?.avoidMechanisms || []).map((item) => ({ ...item, reason: cleanRationale(item.reason, phrases) }))
  };
  return { analysis, model };
}

function buildCandidateSchema(count) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      candidates: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject: { type: "string" },
            preview: { type: "string" },
            mechanism: { type: "string", enum: MECHANISM_KEYS },
            secondaryMechanism: enumWithEmpty(MECHANISM_KEYS),
            rationale: { type: "string" },
            evidence: { type: "array", maxItems: 4, items: { type: "string" } },
            translationRisk: { type: "string", enum: TRANSLATION_RISKS },
            translationNote: { type: "string" }
          },
          required: ["subject", "preview", "mechanism", "secondaryMechanism", "rationale", "evidence", "translationRisk", "translationNote"]
        }
      },
      picks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { number: { type: "integer" }, why: { type: "string" } },
          required: ["number", "why"]
        }
      },
      abTest: {
        type: "object",
        additionalProperties: false,
        properties: { a: { type: "integer" }, b: { type: "integer" }, why: { type: "string" } },
        required: ["a", "b", "why"]
      }
    },
    required: ["candidates", "picks", "abTest"]
  };
}

function describeBankExample(entry) {
  const origin = entry.source === "imported"
    ? `importeret fra ${entry.sender || "en afsender"}`
    : entry.source === "collected"
      ? `sendt af ${entry.sender || "et andet brand"} (${entry.collectedFrom || "indsamlet"})`
      : entry.context === "generisk" ? "skrevet til banken, anden branche" : "skrevet til banken";
  return `[${entry.id}] ${entry.mechanisms.join("+")} · ${entry.campaignType} · ${entry.language}: "${entry.subject}" / "${entry.preview}" (${origin}${entry.why ? ` - ${entry.why}` : ""})`;
}

async function generateSubjectLines({ config, templateName = "", emailText = "", analysis = {}, insights = {}, examples = [], favourites = [], banned = [], avoid = [], note = "", count = DEFAULT_CANDIDATE_COUNT, reasoningEffort = "" }) {
  const total = Math.max(6, Math.min(30, Number(count) || DEFAULT_CANDIDATE_COUNT));
  const input = [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          "You are the best Danish email copywriter Westpack could hire, writing subject lines and preheaders for one campaign email.",
          "The readers are owners and buyers at shops and brands that package what they sell - jewellery businesses at the core - opening B2B email from their packaging supplier between customers. Sender name in the inbox: " + (insights.senderLabel || "Westpack") + ".",
          "",
          "What to deliver:",
          `- Exactly ${total} pairs of subject line + preheader, in Danish, for this email.`,
          "- Spread them over at least six different mechanisms, at most three pairs per mechanism. The brief's recommended mechanisms carry about two thirds; the rest are deliberate alternatives the operator would not have thought of.",
          "- Subject: aim for 41 characters or fewer with the hook in the first 30, because iPhone Mail cuts the rest. Never over 60.",
          "- Preheader: 40-90 characters that complete the subject - read together as one line in the inbox. Never repeat or paraphrase the subject.",
          "- An emoji only where it adds meaning, at most one per subject, in at most half of the pairs.",
          "- Every offer, number, product and fact must be in the email text. Respect the brief's mustNotPromise. A subject that promises more than the email delivers costs the next open.",
          "- No two pairs may share an opening or a construction. Never reuse a past Westpack subject line, and never copy a bank example: borrow the construction, not the words.",
          "- The Danish master is translated into about fifteen languages. Mark translationRisk honestly (wordplay and idiom are hoej) and give at least four pairs with translationRisk lav. translationNote says what would break, or is empty.",
          "- rationale: one Danish sentence on why this pair gets this email opened, naming in words the evidence you leaned on (\"A/B-testen W17 Urskrin\", \"en tidligere udsendelse\"). Never put an id in the rationale. evidence lists the ids from square brackets you used, such as ab:... or pb-..., and nothing else.",
          "- picks: the three pairs you would send, best first, by their number in your list (1 = the first pair). why: one short Danish sentence each, written for a busy marketer.",
          "- abTest: the two pairs you would A/B test against each other - both strong, built on different mechanisms, so the test teaches something. why: one short Danish sentence on what the test would show.",
          "",
          "Westpack's house voice is warm, concrete and a little cheeky - recent sends below show it. Match that voice and beat it. Energy comes from desire for the product and from the reader's own situation, never from belittling the reader's shop or packaging.",
          "",
          buildRulesPromptBlock(),
          "",
          buildWestpackKnowledgePromptBlock({ sourceTexts: [templateName, emailText], channel: "klaviyo", keepSourceClaims: true }),
          "",
          taxonomyBlock()
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: [
          `Campaign template: ${templateName || "(unnamed)"}`,
          "",
          "The brief (from the analysis, confirmed by the operator):",
          JSON.stringify(analysis, null, 1),
          "",
          "The email, as text:",
          emailText.slice(0, PROMPT_EMAIL_TEXT_LIMIT),
          "",
          "Recent Westpack subject lines, for the voice (newest first):",
          ...(insights.voiceSamples || []).slice(0, 15).map((entry) => `- "${entry.subject}"${entry.previewText ? ` / "${entry.previewText}"` : ""}`),
          "",
          buildHouseEvidenceBlock(insights, { compact: true, features: false }),
          "",
          "Pattern bank - chosen for this brief. Some are real lines other brands sent (their results are unknown), some were written for the bank; none is evidence, use them for range. Most real ones are in English: borrow the construction into natural Danish, never translate them word for word:",
          ...examples.map((entry) => `- ${describeBankExample(entry)}`),
          ...(favourites.length ? ["", "Lines the team has saved as favourites before (taste, not templates):", ...favourites.slice(0, 15).map((item) => `- "${item.subject}"${item.preview ? ` / "${item.preview}"` : ""}`)] : []),
          ...(banned.length ? ["", "The team has banned these patterns or phrases - do not write anything like them:", ...banned.slice(0, 20).map((item) => `- ${item.subject || item.phrase}${item.reason ? ` (${item.reason})` : ""}`)] : []),
          ...(avoid.length ? ["", "Already shown to the operator for this email - write different ones:", ...avoid.slice(0, 40).map((subject) => `- "${subject}"`)] : []),
          ...(note ? ["", `Operator's note: ${note}`] : [])
        ].filter((line) => line !== undefined).join("\n")
      }]
    }
  ];
  // Writing reasons on "low". Measured 2026-10-27 on one brief, the same examples and email: medium
  // took 68 seconds and low 30, with all twelve lines passing the rules both times and no loss a
  // reader would notice. Half a minute is what makes one click from campaign to lines feel immediate.
  const { parsed, model } = await requestStructured(config, {
    input,
    schemaName: "westpack_subject_line_candidates",
    schema: buildCandidateSchema(total),
    reasoningEffort: reasoningEffort || "low",
    writing: true
  });
  return {
    candidates: Array.isArray(parsed?.candidates) ? parsed.candidates : [],
    picks: Array.isArray(parsed?.picks) ? parsed.picks : [],
    abTest: parsed?.abTest || null,
    model
  };
}

// The writer's picks refer to its own numbering, which is the candidates' ids (c1, c2, ...) before
// blocked lines are moved last. A pick that breaks a rule is dropped and the next line that passes
// takes its place, so the top of the screen is always something that can be sent.
function resolvePicks({ picks = [], abTest = null, candidates = [] }) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const sendable = (id) => byId.has(id) && byId.get(id).status !== "block";
  const chosen = [];
  for (const pick of picks) {
    const id = `c${Number(pick?.number)}`;
    if (sendable(id) && !chosen.some((item) => item.id === id)) chosen.push({ id, why: String(pick.why || "") });
  }
  for (const candidate of candidates) {
    if (chosen.length >= 3) break;
    if (candidate.status === "ok" && !chosen.some((item) => item.id === candidate.id)) chosen.push({ id: candidate.id, why: "" });
  }
  const a = `c${Number(abTest?.a)}`;
  const b = `c${Number(abTest?.b)}`;
  const pair = abTest && a !== b && sendable(a) && sendable(b) ? { a, b, why: String(abTest.why || "") } : null;
  return { picks: chosen.slice(0, 3), abTest: pair };
}

function comparable(value = "") {
  return String(value || "").toLowerCase().replace(/[^\p{L}\d%]+/gu, " ").trim();
}

const EVIDENCE_ID = /\s*[[(]((?:ab:|pb-|im-|rg-)[^\])]*)[\])]/g;

// The model is told to keep ids out of the rationale and still writes "[ab:01GV...]" now and then.
// A known id is replaced by what it points at, so the sentence still reads; an unknown one is
// dropped, together with the connective it leaves dangling ("strukturen i og.").
function cleanRationale(text = "", lookup = new Map()) {
  // An id written in parentheses keeps them, so "(ab:X)" reads "(A/B-testen ...)".
  let cleaned = String(text || "").replace(EVIDENCE_ID, (match, id) => {
    if (!lookup.has(id)) return "";
    return match.trim().startsWith("(") ? ` (${lookup.get(id)})` : ` ${lookup.get(id)}`;
  });
  for (let pass = 0; pass < 4; pass += 1) {
    const next = cleaned.replace(/\s+(?:i|og|fra|samt|via|jf\.?|som i|ligesom)\s*(?=[.,;:)]|$)/g, "");
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function evidencePhrases({ abTests = [], examples = [] } = {}) {
  const phrases = new Map();
  for (const test of abTests) phrases.set(`ab:${test.campaignId}`, `A/B-testen ${test.campaignName}`);
  for (const entry of examples) {
    phrases.set(entry.id, entry.source === "authored" ? `mønsteret »${entry.subject}«` : `»${entry.subject}« fra ${entry.sender || "en anden afsender"}`);
  }
  return phrases;
}

// Ids the operator cannot read become the A/B test's campaign or the pattern's own line.
function describeEvidence(ids = [], { abTests = [], examples = [] } = {}) {
  const tests = new Map(abTests.map((test) => [`ab:${test.campaignId}`, test]));
  const patterns = new Map(examples.map((entry) => [entry.id, entry]));
  return [...new Set(ids.map((id) => String(id || "").replace(/^\[|\]$/g, "").trim()))]
    .map((id) => {
      if (tests.has(id)) {
        const test = tests.get(id);
        return { id, kind: "ab", label: `A/B: ${test.campaignName}` };
      }
      if (patterns.has(id)) {
        const entry = patterns.get(id);
        if (entry.source === "authored") return { id, kind: "pattern", label: `Pattern: "${entry.subject}"` };
        return { id, kind: entry.source, label: `${entry.sender || "Another sender"}: "${entry.subject}"` };
      }
      return null;
    })
    .filter(Boolean);
}

// Runs the rules over every candidate with the email's own text, flags a line that repeats a past
// send or copies a bank example, and orders blocked candidates last without removing them.
function finalizeCandidates(candidates = [], { emailText = "", pastSubjects = [], examples = [], abTests = [] } = {}) {
  const past = new Map(pastSubjects.map((item) => [comparable(item.subject), item]));
  const bank = new Map(examples.map((entry) => [comparable(entry.subject), entry]));
  const phrases = evidencePhrases({ abTests, examples });
  const severityRank = { ok: 0, warn: 1, block: 2 };
  return candidates
    .map((candidate, index) => {
      const subject = String(candidate.subject || "").trim();
      const preview = String(candidate.preview || "").trim();
      const check = checkSubjectLine({ subject, preview, emailText });
      const issues = [...check.issues];
      const reused = past.get(comparable(subject));
      if (reused) issues.push({ ruleId: "reused", label: "Used before", severity: "warn", message: `Sendt før, ${String(reused.sentAt).slice(0, 10)}.`, match: "" });
      const copied = bank.get(comparable(subject));
      if (copied) issues.push({ ruleId: "copied", label: "Copied from the bank", severity: "warn", message: `Ordret fra banken (${copied.id}).`, match: "" });
      const status = issues.some((issue) => issue.severity === "block") ? "block" : issues.length ? "warn" : "ok";
      return {
        id: `c${index + 1}`,
        subject,
        preview,
        mechanism: candidate.mechanism,
        secondaryMechanism: candidate.secondaryMechanism || "",
        rationale: cleanRationale(candidate.rationale, phrases),
        evidence: describeEvidence([
          ...(Array.isArray(candidate.evidence) ? candidate.evidence : []),
          ...(String(candidate.rationale || "").match(/(?:ab:|pb-|im-|rg-)[^\])\s,]+/g) || [])
        ], { abTests, examples }),
        translationRisk: candidate.translationRisk,
        translationNote: String(candidate.translationNote || ""),
        status,
        issues,
        metrics: check.metrics
      };
    })
    .sort((left, right) => (severityRank[left.status] === 2) - (severityRank[right.status] === 2));
}

// How a Danish line will read in the other markets, before anyone commits to it. Duplicate &
// translate does the real translation later, with the whole email; this is a quick look at the
// two lines alone - length against the phone's cut, and wordplay that does not survive.
const PREVIEW_LANGUAGES = [
  { code: "de", name: "German", markets: ["DE"], glossary: "DE" },
  { code: "en", name: "English (UK)", markets: ["UK", "EU", "US"], glossary: "UK" },
  { code: "fr", name: "French", markets: ["FR"], glossary: "FR" },
  { code: "nl", name: "Dutch", markets: ["NL"], glossary: "NL" },
  { code: "sv", name: "Swedish", markets: ["SE"], glossary: "SE" },
  { code: "nb", name: "Norwegian (Bokmål)", markets: ["NO"], glossary: "NO" },
  { code: "fi", name: "Finnish", markets: ["FI"], glossary: "FI" },
  { code: "it", name: "Italian", markets: ["IT"], glossary: "IT" },
  { code: "es", name: "Spanish", markets: ["ES"], glossary: "ES" },
  { code: "pt", name: "Portuguese", markets: ["PT"], glossary: "PT" },
  { code: "pl", name: "Polish", markets: ["PL"], glossary: "PL" },
  { code: "ro", name: "Romanian", markets: ["RO"], glossary: "RO" }
];

async function previewInMarkets({ config, subject = "", preview = "" }) {
  const sourceTexts = [subject, preview];
  const glossary = PREVIEW_LANGUAGES
    .map((language) => buildGlossaryPromptBlock({ targetLanguage: language.glossary, sourceTexts }))
    .filter(Boolean)
    .join("\n\n");
  const input = [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: [
          "You translate one Danish email subject line and its preheader for Westpack, a B2B packaging supplier, into its other markets' languages.",
          "Write what a native marketing copywriter in each market would send: natural, the same intent and tone, emoji kept where they are, as short as the language allows. Never add a claim, number or offer.",
          "`note` is empty unless something is lost - wordplay, an idiom, a cultural reference - in which case say what in one short English clause.",
          glossary ? `\n${glossary}` : ""
        ].join("\n")
      }]
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: [`Subject: ${subject}`, `Preheader: ${preview || "(none)"}`, "", `Languages: ${PREVIEW_LANGUAGES.map((language) => `${language.code} (${language.name})`).join(", ")}`].join("\n")
      }]
    }
  ];
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      translations: {
        type: "array",
        minItems: PREVIEW_LANGUAGES.length,
        maxItems: PREVIEW_LANGUAGES.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            language: { type: "string", enum: PREVIEW_LANGUAGES.map((language) => language.code) },
            subject: { type: "string" },
            preview: { type: "string" },
            note: { type: "string" }
          },
          required: ["language", "subject", "preview", "note"]
        }
      }
    },
    required: ["translations"]
  };
  const { parsed, model } = await requestStructured(config, { input, schemaName: "westpack_subject_line_market_preview", schema });
  const byCode = new Map((parsed?.translations || []).map((item) => [item.language, item]));
  return {
    model,
    sourceLength: [...subject].length,
    markets: PREVIEW_LANGUAGES.map((language) => {
      const item = byCode.get(language.code) || { subject: "", preview: "", note: "" };
      return {
        language: language.code,
        name: language.name,
        markets: language.markets,
        subject: String(item.subject || ""),
        preview: String(item.preview || ""),
        note: String(item.note || ""),
        subjectLength: [...String(item.subject || "")].length
      };
    })
  };
}

const IMPORT_SCHEMA_ITEM = {
  type: "object",
  additionalProperties: false,
  properties: {
    index: { type: "integer" },
    language: { type: "string" },
    mechanisms: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", enum: MECHANISM_KEYS } },
    campaignType: { type: "string", enum: CAMPAIGN_TYPE_KEYS },
    tone: { type: "string", enum: TONE_KEYS },
    translationRisk: { type: "string", enum: TRANSLATION_RISKS },
    why: { type: "string" }
  },
  required: ["index", "language", "mechanisms", "campaignType", "tone", "translationRisk", "why"]
};

// Tags lines a person pasted from their own inbox, so they enter the bank on the same terms as the
// authored ones. The text is never rewritten - only described.
async function tagImportedLines({ config, rows = [] }) {
  const tagged = [];
  for (let start = 0; start < rows.length; start += 50) {
    const batch = rows.slice(start, start + 50);
    const input = [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: [
            "You tag real email subject lines for a pattern bank. Do not rewrite them.",
            "For each line give: language (ISO 639-1 code, e.g. da, en, sv, de), one or two mechanisms (the first is primary), the campaign type it most likely belongs to, its tone, how badly it would survive translation (lav, middel, hoej), and `why`: one Danish sentence on why it gets opened.",
            "",
            taxonomyBlock(),
            "",
            `Tones: ${TONE_KEYS.join(", ")}.`
          ].join("\n")
        }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: batch.map((row, index) => `${index}. "${row.subject}"${row.preview ? ` / "${row.preview}"` : ""}`).join("\n") }]
      }
    ];
    const { parsed } = await requestStructured(config, {
      input,
      schemaName: "westpack_subject_line_import_tags",
      schema: { type: "object", additionalProperties: false, properties: { lines: { type: "array", minItems: batch.length, maxItems: batch.length, items: IMPORT_SCHEMA_ITEM } }, required: ["lines"] },
      // Tags feed a tally; two taggings of the same lines once disagreed enough to move a verdict.
      temperature: 0
    });
    for (const tag of parsed?.lines || []) {
      const row = batch[tag.index];
      if (!row) continue;
      tagged.push({
        ...row,
        language: String(tag.language || "").toLowerCase().slice(0, 5),
        mechanisms: tag.mechanisms,
        campaignType: tag.campaignType,
        tone: tag.tone,
        translationRisk: tag.translationRisk,
        why: tag.why
      });
    }
  }
  return tagged;
}

module.exports = {
  ANALYSIS_SCHEMA,
  DEFAULT_CANDIDATE_COUNT,
  IMPORT_SCHEMA_ITEM,
  analyseCampaign,
  buildCandidateSchema,
  buildHouseEvidenceBlock,
  cleanRationale,
  extractEmailText,
  finalizeCandidates,
  generateSubjectLines,
  PREVIEW_LANGUAGES,
  previewInMarkets,
  resolvePicks,
  tagImportedLines
};
