// Layer 3 of the subject line generator: the rules a Westpack subject line may never break.
//
// Each rule is data - an id, a severity, a sentence for the prompt and a check - so the same list
// is written into the generator's instructions, shown on screen and run over every candidate
// afterwards. The model is told the rules and still breaks them now and then; the check is what
// makes "never" true. A candidate that breaks a blocking rule is kept on screen with the reason,
// rather than dropped silently, so the operator can see what the model tried.
//
// The rules come from standing corrections in this project, not from generic email advice:
// no environmental claims, samples are not free, production time is never delivery time, one
// Danish master goes to ~15 markets so no single deadline date, never talk down to the customer,
// no watch boxes, a Trustpilot score is not "five stars". Where a check can only guess (talking
// down, a series name) it warns rather than blocks.

const BLOCK = "block";
const WARN = "warn";

// iPhone Mail in portrait shows roughly this many characters of a subject before the ellipsis.
// Gmail on Android shows a few more, Outlook on a desktop far more. The generator aims under it;
// the check only warns, because a strong line that runs to 45 still beats a weak one at 38.
const MOBILE_SUBJECT_VISIBLE = 41;
const SUBJECT_HARD_LONG = 60;
const PREVIEW_LONG = 110;

// JavaScript's \b treats æ, ø and å as non-letters, so /\bmiljø\b/ never matches "miljø" and
// /\bøkologisk/ never matches at all. Every word pattern here is bounded on Unicode letters instead.
function term(source) {
  return new RegExp(`(?<![\\p{L}\\d])(?:${source})(?![\\p{L}\\d])`, "iu");
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ECO_PATTERN = term("fsc|bæredygtig\\p{L}*|baeredygtig\\p{L}*|miljø\\p{L}*|genbrug\\p{L}*|genanvend\\p{L}*|co2\\p{L}*|klimaneutral\\p{L}*|klimavenlig\\p{L}*|økologisk\\p{L}*|recycl\\p{L}*|sustainab\\p{L}*|eco[- ]?friendly|carbon[- ]neutral|environmentally");
const ECO_SERIES_WORD = term("eco");
const FREE_SAMPLE_PATTERN = term("gratis\\s+(?:vare)?prøve\\p{L}*|gratis\\s+sample\\p{L}*|free\\s+samples?");
const DELIVERY_PATTERNS = [
  term("levering\\p{L}*\\s+(?:på|inden|før|om|i løbet af)"),
  term("(?:leveret|fremme|hos dig|i butikken)\\s+(?:på|inden|før|om)\\s+\\d+"),
  term("klar\\s+hos\\s+dig"),
  term("når\\s+(?:de\\s+|den\\s+|det\\s+|æskerne\\s+|varerne\\s+)?(?:frem|ud til dig)"),
  term("få(?:r)?\\s+(?:dem|æskerne|æsken|varerne|poserne|posen|ordren)\\s+(?:på|inden|før|om)"),
  term("(?:delivered|arrives?|delivery)\\s+(?:in|within|by|before)")
];
const DATE_PATTERN = term("\\d{1,2}\\.?\\s*(?:januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|okt|nov|dec)|\\d{1,2}\\/\\d{1,2}");
// Order deadlines differ per market; a vote closing or an event date is the same everywhere. Only a
// date beside an ordering word blocks; any other date warns.
const ORDER_DEADLINE_WORD = term("frist\\p{L}*|bestil\\p{L}*|ordre\\p{L}*|deadline|order by|last order|levering\\p{L}*");
const WATCH_BOX_PATTERN = term("uræske\\p{L}*|ur-æske\\p{L}*|watch\\s+box\\p{L}*");
const STARS_PATTERN = term("(?:5|fem|five)[- ]?(?:stjerne\\p{L}*|star\\p{L}*)|femstjern\\p{L}*");
const FREE_LOGO_PATTERN = term("gratis\\s+logo\\p{L}*|free\\s+logo\\p{L}*");
const FAKE_REPLY_PATTERN = /^\s*(re|fwd?|sv|vs|aw|wg)\s*:/i;
const TALKS_DOWN_PATTERN = term("kedelig\\p{L}*|grim\\p{L}*|pinlig\\p{L}*|du gør det forkert|stop med at|din emballage er|boring packaging|ugly");
const SPAM_PATTERN = term("klik her|click here|100\\s?% gratis|risikofri|garanteret|bedste pris nogensinde|act now");
const CLAIM_WORDS = term("gratis|fri fragt|free shipping|garanti\\p{L}*|guarantee\\p{L}*");
const CAPS_WORD = /(?<![\p{L}\d])\p{Lu}{4,}(?![\p{L}\d])/gu;

// Series names Westpack sells under. Buyers rarely know them, so a subject built on one alone
// usually undersells the email - except in product-feature emails that present the series by name.
const SERIES_NAMES = ["Amsterdam", "Rome", "London", "Tokyo", "Monaco", "Boston", "Plano", "Paris", "Madrid", "Stockholm", "Milano", "New York", "Frankfurt", "Copenhagen", "Palma", "Sofia", "Vienna", "Rio", "Seville"];
const CATEGORY_WORD = /(æske|pose|bærepose|display|bakke|kalender|bånd|emballage|box|bag|pouch)/i;
const ACRONYMS = new Set(["WTP", "MOQ", "USA", "ECO", "B2B"]);

function countEmoji(text = "") {
  return (String(text).match(/\p{Extended_Pictographic}/gu) || []).length;
}

function normalizeForMatch(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(\d)[.\s](?=\d{3}\b)/g, "$1")
    .trim();
}

function wordSet(text = "") {
  return new Set(String(text || "").toLowerCase().match(/[\p{L}\d]{3,}/gu) || []);
}

function overlapShare(left = "", right = "") {
  const a = wordSet(left);
  const b = wordSet(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

// Numbers and percentages in the line that the email itself does not contain. A model asked for a
// "tal" line will happily write "-30%" for an email offering 20%, and this is the cheapest check
// that catches it.
// Matched as whole numbers: "5" must not count as present because the email says "W45" or "2025".
function numbersMissingFromEmail(line = "", emailText = "") {
  if (!emailText) return [];
  const haystack = normalizeForMatch(emailText);
  const tokens = String(line || "").match(/-?\d+(?:[.,]\d+)?\s?%?/g) || [];
  return [...new Set(tokens.map((token) => token.trim()))]
    .filter((token) => {
      const digits = normalizeForMatch(token).replace(/[^\d.,]/g, "");
      if (!digits) return false;
      const percent = token.includes("%") ? "\\s?%" : "";
      return !new RegExp(`(?<![\\d.,])${escapeRegex(digits)}(?![\\d])${percent}`).test(haystack);
    });
}

const RULES = [
  {
    id: "eco_claim",
    severity: BLOCK,
    label: "No environmental claims",
    prompt: "Never make an environmental claim: no FSC, bæredygtig, miljø, genbrug, CO2, klimaneutral or similar - not even for products in an ECO series.",
    check: ({ text }) => {
      const match = text.match(ECO_PATTERN);
      if (match) return { message: `Miljøpåstand: "${match[0]}". Westpack bruger ingen miljøpåstande i markedsføring.`, match: match[0] };
      const series = text.match(ECO_SERIES_WORD);
      if (series) return { severity: WARN, message: "\"ECO\" er et serienavn. I en emnelinje læses det som en miljøpåstand.", match: series[0] };
      return null;
    }
  },
  {
    id: "free_samples",
    severity: BLOCK,
    label: "Samples are not free",
    prompt: "Samples are never free: freight is added and logo samples cost a small amount. Never write 'gratis prøve'.",
    check: ({ text }) => {
      const match = text.match(FREE_SAMPLE_PATTERN);
      return match ? { message: `"${match[0]}" passer ikke: prøver koster fragt, og logoprøver koster et mindre beløb.`, match: match[0] } : null;
    }
  },
  {
    id: "delivery_promise",
    severity: BLOCK,
    label: "Production time, never delivery time",
    prompt: "Never promise when goods arrive. Production time (new logo 7-8 working days) may be named as production time; delivery differs too much between markets to promise.",
    check: ({ text }) => {
      for (const pattern of DELIVERY_PATTERNS) {
        const match = text.match(pattern);
        if (match) return { message: `"${match[0]}" lover en leveringstid. Brug produktionstid, eller lad være.`, match: match[0] };
      }
      return null;
    }
  },
  {
    id: "single_date",
    severity: BLOCK,
    label: "No single deadline date",
    prompt: "Never print a specific order deadline date: one Danish master is translated to about fifteen markets with different deadlines. Say the deadlines come early and point to the deadline for their country.",
    check: ({ text }) => {
      const match = text.match(DATE_PATTERN);
      if (!match) return null;
      if (ORDER_DEADLINE_WORD.test(text)) {
        return { message: `"${match[0]}" som frist passer kun i ét marked. Mailen oversættes til ca. 15 markeder med hver sin frist.`, match: match[0] };
      }
      return { severity: WARN, message: `Datoen "${match[0]}" skal være den samme i alle markeder, mailen oversættes til.`, match: match[0] };
    }
  },
  {
    id: "watch_box",
    severity: BLOCK,
    label: "No watch boxes",
    prompt: "Never mention watch boxes (uræsker).",
    check: ({ text }) => {
      const match = text.match(WATCH_BOX_PATTERN);
      return match ? { message: "Uræsker nævnes aldrig.", match: match[0] } : null;
    }
  },
  {
    id: "star_rating",
    severity: BLOCK,
    label: "No star counts",
    prompt: "Never claim five stars. Trustpilot shows a TrustScore of 4.6; if reviews are used, say TrustScore 4.6.",
    check: ({ text }) => {
      const match = text.match(STARS_PATTERN);
      return match ? { message: `"${match[0]}" passer ikke: Trustpilot viser TrustScore 4,6.`, match: match[0] } : null;
    }
  },
  {
    id: "fake_reply",
    severity: BLOCK,
    label: "No fake replies",
    prompt: "Never start a subject with Re:, Fwd:, SV: or similar.",
    check: ({ subject }) => {
      const match = subject.match(FAKE_REPLY_PATTERN);
      return match ? { message: "Et falsk \"Re:\" eller \"Fwd:\" snyder modtageren.", match: match[0] } : null;
    }
  },
  {
    id: "free_logo",
    severity: WARN,
    label: "Logo print is included on jewellery boxes only",
    prompt: "Logo print is included on most jewellery boxes only; bags, pouches and flat-pack boxes may carry a surcharge. Do not say 'gratis logotryk' unless the email is about jewellery boxes and says so.",
    check: ({ text, emailText }) => {
      const match = text.match(FREE_LOGO_PATTERN);
      if (!match) return null;
      if (emailText && /gratis logo/i.test(emailText)) return null;
      return { message: "Logotryk er kun inkluderet på (de fleste) smykkeæsker. Står det ikke i mailen, skal det ud.", match: match[0] };
    }
  },
  {
    id: "talks_down",
    severity: WARN,
    label: "Never talk down to the customer",
    prompt: "Never make the reader's shop, packaging or choices the punchline. The energy comes from desire for the product, not from what is wrong with theirs.",
    check: ({ text }) => {
      const match = text.match(TALKS_DOWN_PATTERN);
      return match ? { message: `"${match[0]}" kan læses som en nedgørelse af modtagerens butik eller emballage.`, match: match[0] } : null;
    }
  },
  {
    id: "claim_not_in_email",
    severity: WARN,
    label: "Every number and claim comes from the email",
    prompt: "Every number, percentage, offer and claim in the subject or preheader must appear in the email itself. Never invent a discount, a count or a benefit.",
    check: ({ subject, preview, emailText }) => {
      if (!emailText) return null;
      const missing = numbersMissingFromEmail(`${subject} ${preview}`, emailText);
      if (missing.length) return { message: `${missing.map((item) => `"${item}"`).join(", ")} står ikke i mailen.`, match: missing[0] };
      const claim = `${subject} ${preview}`.match(CLAIM_WORDS);
      if (claim && !term(escapeRegex(claim[0])).test(emailText)) {
        return { message: `"${claim[0]}" står ikke i mailen.`, match: claim[0] };
      }
      return null;
    }
  },
  {
    id: "subject_length",
    severity: WARN,
    label: "Readable on a phone",
    prompt: `Aim for a subject under ${MOBILE_SUBJECT_VISIBLE} characters, with the hook in the first 30; iPhone Mail cuts the rest. Never over ${SUBJECT_HARD_LONG}.`,
    check: ({ subject }) => {
      const length = [...subject].length;
      if (length > SUBJECT_HARD_LONG) return { message: `${length} tegn. Over ${SUBJECT_HARD_LONG} ses slutningen ikke nogen steder.` };
      if (length > MOBILE_SUBJECT_VISIBLE) return { message: `${length} tegn. iPhone viser ca. ${MOBILE_SUBJECT_VISIBLE}, så slutningen ses ikke på mobil.` };
      return null;
    }
  },
  {
    id: "preview_adds",
    severity: WARN,
    label: "The preheader adds something",
    prompt: "The preheader is read as the second half of the subject. It must add something new - never repeat or paraphrase the subject - and should stay under 90 characters.",
    check: ({ subject, preview }) => {
      if (!preview.trim()) return { message: "Ingen preheader. Klaviyo viser så starten af mailens tekst, ofte \"Se mailen i browseren\"." };
      if (overlapShare(subject, preview) >= 0.6) return { message: "Preheaderen gentager emnelinjen i stedet for at tilføje noget." };
      if ([...preview].length > PREVIEW_LONG) return { message: `Preheaderen er ${[...preview].length} tegn. Det meste over ca. 90 ses ikke.` };
      return null;
    }
  },
  {
    id: "shouting",
    severity: WARN,
    label: "No shouting",
    prompt: "At most one emoji in the subject, no '!!', and no words in capitals except an occasional single short emphasis word.",
    check: ({ subject }) => {
      const emoji = countEmoji(subject);
      if (emoji > 1) return { message: `${emoji} emojis. Én er nok, flere ligner et udsalg.` };
      if (/!{2,}/.test(subject) || (subject.match(/!/g) || []).length > 1) return { message: "Flere udråbstegn virker som et råb." };
      const caps = (subject.match(CAPS_WORD) || []).filter((word) => !ACRONYMS.has(word));
      if (caps.length) return { message: `"${caps[0]}" i versaler virker som et råb.`, match: caps[0] };
      return null;
    }
  },
  {
    id: "spam_words",
    severity: WARN,
    label: "No spam phrasing",
    prompt: "Avoid spam phrasing such as 'klik her', '100% gratis', 'garanteret' and 'risikofri'.",
    check: ({ text }) => {
      const match = text.match(SPAM_PATTERN);
      return match ? { message: `"${match[0]}" ligner spam og koster placering i indbakken.`, match: match[0] } : null;
    }
  },
  {
    id: "series_name",
    severity: WARN,
    label: "Sell the category, not the series name",
    prompt: "Buyers rarely know Westpack's series names. Lead with the category (smykkeæsker, gaveæsker, bæreposer) unless the email presents named series side by side.",
    check: ({ subject }) => {
      const series = SERIES_NAMES.find((name) => term(escapeRegex(name)).test(subject));
      if (!series || CATEGORY_WORD.test(subject)) return null;
      return { message: `"${series}" alene siger ikke køberen, hvad det er. Nævn kategorien, medmindre mailen præsenterer serierne.`, match: series };
    }
  }
];

function checkSubjectLine({ subject = "", preview = "", emailText = "" } = {}) {
  const cleanSubject = String(subject || "").trim();
  const cleanPreview = String(preview || "").trim();
  const context = {
    subject: cleanSubject,
    preview: cleanPreview,
    text: `${cleanSubject} ${cleanPreview}`,
    emailText: String(emailText || "")
  };

  const issues = [];
  for (const rule of RULES) {
    const result = rule.check(context);
    if (!result) continue;
    issues.push({
      ruleId: rule.id,
      label: rule.label,
      severity: result.severity || rule.severity,
      message: result.message,
      match: result.match || ""
    });
  }

  const status = issues.some((issue) => issue.severity === BLOCK)
    ? BLOCK
    : issues.length ? WARN : "ok";

  return {
    status,
    issues,
    metrics: {
      subjectLength: [...cleanSubject].length,
      previewLength: [...cleanPreview].length,
      emoji: countEmoji(cleanSubject)
    }
  };
}

function buildRulesPromptBlock() {
  return [
    "Westpack's rules for subject lines and preheaders. Breaking one disqualifies the line:",
    ...RULES.map((rule) => `- ${rule.prompt}`)
  ].join("\n");
}

function describeRules() {
  return RULES.map(({ id, severity, label, prompt }) => ({ id, severity, label, description: prompt }));
}

module.exports = {
  BLOCK,
  WARN,
  MOBILE_SUBJECT_VISIBLE,
  RULES,
  buildRulesPromptBlock,
  checkSubjectLine,
  countEmoji,
  describeRules,
  numbersMissingFromEmail
};
