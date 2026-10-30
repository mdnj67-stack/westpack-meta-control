// Email check: an email read twice before it goes to customers.
//
// First what can be read off the HTML for certain - a store link that sends every market to the
// Danish shop, an Asana image that dies within hours, a <link> Klaviyo will strip, copy that
// Duplicate & translate cannot reach, Danish left in a German version, the house rules. Those are
// instant and never wrong about what they report.
//
// Then a careful read by the strong model against the site's own facts and the marketing team's
// rules. Every finding has to quote the email word for word; one whose quote is not in the email
// is dropped rather than shown, because a reviewer that invents problems costs more attention
// than it saves.

const crypto = require("crypto");
const { RULES } = require("../klaviyo/subject-line-rules");
const { FORM_OF_ADDRESS } = require("../lib/form-of-address");

const SEVERITY_ORDER = { must_fix: 0, should_fix: 1, consider: 2 };
const GMAIL_CLIP_BYTES = 102 * 1024;
const GMAIL_WARN_BYTES = 90 * 1024;
const REVIEW_TEXT_LIMIT = 40000;
const SERIES_NAMES = ["Amsterdam", "Rome", "London", "Tokyo", "Monaco", "Boston", "Plano", "Paris", "Madrid", "Stockholm", "Milano", "New York", "Frankfurt", "Copenhagen", "Palma", "Sofia", "Vienna", "Rio", "Seville", "Oxford", "Torino", "Seoul"];
// free_logo is left to the review: it looks for the claim in the email itself, which in a body
// check is always where it is.
const BODY_RULES = new Set(["eco_claim", "free_samples", "delivery_promise", "single_date", "watch_box", "star_rating", "talks_down"]);
const RULE_SEVERITY = { block: "must_fix", warn: "should_fix", note: "consider" };

const MARKET_LANGUAGE = {
  DK: "Danish", UK: "British English", EU: "English", US: "American English", DE: "German", FR: "French",
  IT: "Italian", ES: "Spanish", NL: "Dutch", PT: "Portuguese", SE: "Swedish", NO: "Norwegian", FI: "Finnish",
  PL: "Polish", RO: "Romanian", CZ: "Czech", SK: "Slovak", HU: "Hungarian"
};

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", aelig: "æ", AElig: "Æ", oslash: "ø", Oslash: "Ø", aring: "å", Aring: "Å", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", euro: "€", copy: "©", trade: "™", reg: "®" };

function decodeEntities(text = "") {
  return String(text)
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : match));
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function clip(value = "", length = 160) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function stripNonVisible(html = "") {
  return String(html)
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

// The email as a reader sees it: block elements on their own lines, Klaviyo tags removed.
function htmlToText(html = "") {
  const stripped = stripNonVisible(html)
    .replace(/<(br|\/p|\/div|\/td|\/tr|\/h[1-6]|\/li|\/table)[^>]*>/gi, "\n")
    .replace(/<img[^>]*\balt="([^"]+)"[^>]*>/gi, " $1 ")
    .replace(/<\/?(span|a|strong|b|em|i|u|font|sup|sub|small|mark|abbr|s|strike)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{%[\s\S]*?%\}/g, " ")
    .replace(/\{\{[\s\S]*?\}\}/g, " ");
  return decodeEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function parseAttributes(tag = "") {
  const attributes = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? "");
  }
  return attributes;
}

function findTags(html, name) {
  return [...String(html).matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => ({ source: match[0], index: match.index, attributes: parseAttributes(match[0]) }));
}

// Visible text runs between tags, with the opening tag that directly precedes each.
function textRuns(html = "") {
  const body = stripNonVisible(html);
  const runs = [];
  let lastTag = "";
  for (const match of body.matchAll(/(<[^>]+>)|([^<]+)/g)) {
    if (match[1]) {
      if (!match[1].startsWith("</")) lastTag = match[1];
      continue;
    }
    const raw = match[2];
    if (!raw.trim()) continue;
    runs.push({ raw, text: decodeEntities(raw).replace(/\s+/g, " ").trim(), tag: lastTag });
  }
  return runs;
}

function finding({ check, severity, area, title, detail, fix, excerpt = "" }) {
  return { id: `${check}:${hash(`${title}|${excerpt}`)}`, check, severity, area, title, detail, fix, excerpt: clip(excerpt), source: "check" };
}

// ---------------------------------------------------------------------------------------------

function checkLinks(html) {
  const findings = [];
  const anchors = findTags(html, "a").map((tag) => tag.attributes.href ?? null).filter((href) => href !== null);
  const storeLinks = [...new Set(anchors.filter((href) => /^https?:\/\/(www\.)?westpack\.[a-z.]+/i.test(href)))];
  if (storeLinks.length) {
    findings.push(finding({
      check: "store_links",
      severity: "must_fix",
      area: "links",
      title: `${storeLinks.length} store ${storeLinks.length === 1 ? "link is" : "links are"} absolute`,
      detail: `An absolute link sends every market to the same store and language when the email is rolled out: ${storeLinks.slice(0, 4).map((href) => clip(href, 90)).join(", ")}${storeLinks.length > 4 ? ", ..." : ""}`,
      fix: "Write store links as {{ organization.url }}path (no slash after the tag), so each account lands in its own store.",
      excerpt: storeLinks[0]
    }));
  }
  const empty = anchors.filter((href) => !href.trim() || href.trim() === "#" || /^javascript:/i.test(href.trim()));
  if (empty.length) {
    findings.push(finding({
      check: "empty_links",
      severity: "should_fix",
      area: "links",
      title: `${empty.length} ${empty.length === 1 ? "link goes" : "links go"} nowhere`,
      detail: "A button or link with an empty href or # does nothing when tapped.",
      fix: "Give each link its destination, or remove the link."
    }));
  }
  const insecure = [...new Set(anchors.filter((href) => /^http:\/\//i.test(href)))];
  if (insecure.length) {
    findings.push(finding({
      check: "insecure_links",
      severity: "consider",
      area: "links",
      title: `${insecure.length} ${insecure.length === 1 ? "link uses" : "links use"} http://`,
      detail: insecure.slice(0, 3).map((href) => clip(href, 90)).join(", "),
      fix: "Use https:// so mail clients do not warn.",
      excerpt: insecure[0]
    }));
  }
  return findings;
}

function checkImages(html) {
  const findings = [];
  const images = findTags(html, "img").filter((tag) => !(tag.attributes.width === "1" && tag.attributes.height === "1"));
  const expiring = images.filter((tag) => /asanausercontent\.com|X-Amz-|[?&]Expires=|[?&]Signature=|[?&]token=/i.test(tag.attributes.src || ""));
  if (expiring.length) {
    findings.push(finding({
      check: "expiring_images",
      severity: "must_fix",
      area: "images",
      title: `${expiring.length} ${expiring.length === 1 ? "image is" : "images are"} on a link that expires`,
      detail: "Asana and other signed links stop working within hours, so the image is gone by the time most people open the email.",
      fix: "Upload the image to Klaviyo's image library and use its CDN address.",
      excerpt: expiring[0].attributes.src
    }));
  }
  const inline = images.filter((tag) => /^data:/i.test(tag.attributes.src || ""));
  if (inline.length) {
    findings.push(finding({
      check: "inline_images",
      severity: "must_fix",
      area: "images",
      title: `${inline.length} ${inline.length === 1 ? "image is" : "images are"} embedded as data`,
      detail: "Gmail and Outlook block images embedded in the HTML, and they push the email towards Gmail's size limit.",
      fix: "Upload the image to Klaviyo's image library and link it."
    }));
  }
  const noAlt = images.filter((tag) => tag.attributes.alt === undefined);
  if (noAlt.length) {
    findings.push(finding({
      check: "image_alt",
      severity: "should_fix",
      area: "images",
      title: `${noAlt.length} ${noAlt.length === 1 ? "image has" : "images have"} no alt text`,
      detail: "Outlook blocks images by default for most senders and shows the alt text instead; without it the reader sees an empty box.",
      fix: "Describe each image in a few words (alt=\"\" for purely decorative ones). Alt text is translated with the rest.",
      excerpt: noAlt[0].attributes.src || ""
    }));
  }
  return findings;
}

function checkRendering(html) {
  const findings = [];
  const bytes = Buffer.byteLength(String(html), "utf8");
  if (bytes >= GMAIL_WARN_BYTES) {
    const clipped = bytes >= GMAIL_CLIP_BYTES;
    findings.push(finding({
      check: "gmail_size",
      severity: clipped ? "must_fix" : "should_fix",
      area: "rendering",
      title: `The HTML is ${Math.round(bytes / 1024)} KB`,
      detail: clipped
        ? "Gmail cuts emails above 102 KB and hides the rest behind \"View entire message\" - including the footer and unsubscribe link."
        : "Close to Gmail's 102 KB limit. Klaviyo's tracking links add more, so the sent email is larger than this.",
      fix: "Remove unused CSS and duplicated markup, or move content to the landing page."
    }));
  }
  const stylesheets = findTags(html, "link").filter((tag) => /stylesheet/i.test(tag.attributes.rel || ""));
  if (stylesheets.length) {
    findings.push(finding({
      check: "link_tags",
      severity: "must_fix",
      area: "rendering",
      title: "A <link> stylesheet will be removed by Klaviyo",
      detail: "Klaviyo drops every <link> from a code template, so the font never reaches the reader and the email falls back to a system font.",
      fix: "Load the font with @import url(...) as the first rule inside <style>.",
      excerpt: stylesheets[0].attributes.href || ""
    }));
  }
  if (!/unsubscribe/i.test(html)) {
    findings.push(finding({
      check: "unsubscribe",
      severity: "must_fix",
      area: "compliance",
      title: "No unsubscribe link",
      detail: "Marketing email must carry one, and Klaviyo will not send a campaign without it.",
      fix: "Keep the locked Westpack footer, or add {% unsubscribe %}."
    }));
  }
  if (!/@media[^{]*(max-width|min-width)/i.test(html)) {
    findings.push(finding({
      check: "mobile_rules",
      severity: "consider",
      area: "rendering",
      title: "No mobile layout rules",
      detail: "Most opens are on phones. Without a media query the email relies on the desktop layout shrinking.",
      fix: "Check it at 375 px and 320 px before sending."
    }));
  }
  if (!/prefers-color-scheme|color-scheme/i.test(html)) {
    findings.push(finding({
      check: "dark_mode",
      severity: "consider",
      area: "rendering",
      title: "Nothing tells mail apps how to handle dark mode",
      detail: "Gmail and Outlook apps then invert the colours themselves; a transparent black logo on the white header disappears.",
      fix: "Check it in dark mode, and put the logo on its own white plate."
    }));
  }
  return findings;
}

// Duplicate & translate skips any fragment that holds a Klaviyo tag, so copy that shares a text run
// with one ships in Danish in every market. Only the Danish master is rolled out.
function checkTranslatable(html, country) {
  if (country !== "DK") return [];
  const findings = [];
  const tagged = textRuns(html)
    .filter((run) => /\{\{|\{%/.test(run.raw))
    .map((run) => ({ run, words: decodeEntities(run.raw.replace(/\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g, " ")).replace(/\s+/g, " ").trim() }))
    .filter(({ words }) => /\p{L}{2,}/u.test(words));
  for (const { words } of tagged.slice(0, 6)) {
    findings.push(finding({
      check: "tag_fragment",
      severity: "should_fix",
      area: "translation",
      title: "Copy next to a Klaviyo tag will not be translated",
      detail: `"${clip(words, 80)}" sits in the same text as a Klaviyo tag, so Duplicate & translate skips it and every market gets the Danish words.`,
      fix: "Put the copy in its own element, e.g. {% if ... %}<span>Hej</span>{% endif %}.",
      excerpt: words
    }));
  }
  const series = new RegExp(`^(${SERIES_NAMES.map((name) => name.replace(/ /g, "\\s+")).join("|")})$`, "i");
  const standalone = textRuns(html).filter((run) => series.test(run.text) && !/translate\s*=\s*["']?no|notranslate/i.test(run.tag));
  for (const run of standalone.slice(0, 6)) {
    findings.push(finding({
      check: "series_name",
      severity: "should_fix",
      area: "translation",
      title: `"${run.text}" stands alone and may be translated`,
      detail: `On its own, "${run.text}" has nothing saying it is a product, so the translator may turn it into the city's local name (Vienna becomes Wien).`,
      fix: "Mark the element translate=\"no\".",
      excerpt: run.text
    }));
  }
  return findings;
}

// A translated version: Danish left behind, and the market's own form of address.
function checkMarketLanguage(html, country) {
  if (!country || country === "DK") return [];
  const findings = [];
  const runs = textRuns(html).map((run) => run.text);
  const alts = findTags(html, "img").map((tag) => tag.attributes.alt || "").filter(Boolean);
  if (country !== "NO") {
    const danish = [...runs, ...alts].filter((text) => /[æøÆØ]/.test(text));
    if (danish.length) {
      findings.push(finding({
        check: "danish_left",
        severity: "must_fix",
        area: "translation",
        title: `Danish left in the ${country} version`,
        detail: `${danish.length} ${danish.length === 1 ? "passage still has" : "passages still have"} æ or ø, e.g. "${clip(danish[0], 80)}".`,
        fix: "Translate the passage, or check it was not inside a Klaviyo tag fragment in the Danish master.",
        excerpt: danish[0]
      }));
    }
  }
  const text = runs.join("\n");
  const informal = {
    DE: /(?<![\p{L}])(du|dich|dir|dein\p{L}*|euch|euer\p{L}*)(?![\p{L}])/iu,
    FR: /(?<![\p{L}])(tu|toi)(?![\p{L}])/iu,
    PT: /(?<![\p{L}])(tu)(?![\p{L}])/iu
  }[country];
  const match = informal ? text.match(informal) : null;
  if (match) {
    findings.push(finding({
      check: "form_of_address",
      severity: "must_fix",
      area: "translation",
      title: `"${match[0]}" breaks the ${country} form of address`,
      detail: `${country} writes ${FORM_OF_ADDRESS[country]}.`,
      fix: "Make the whole email use one form of address.",
      excerpt: match[0]
    }));
  }
  return findings;
}

// The subject line rules were written for one line of copy. In a whole email three things they
// would flag are the house's own approved wording, found in real sends on 2026-10-30:
// - the locked footer's FSC licence text, which is legal boilerplate, not a claim;
// - "delivery before Christmas cannot be guaranteed", the line the deadlines page asks for;
// - "the first deadlines fall on 10 December - and they differ by country", the approved way to
//   give a date in a master that goes to every market.
const LEGAL_BOILERPLATE = /fsc\.org|FSC®?\s*C\d{5,}/i;
const NO_GUARANTEE = /ikke\s+garanter|kan\s+ikke\s+garanteres|cannot\s+be\s+guaranteed|not\s+guaranteed|no\s+guarantee/i;
const EARLIEST_DEADLINE = /(første|tidligste|first|earliest)\b[^.]{0,60}\b(frist|deadline)|forskellige fra land til land|differ\w*\s+(from|by)\s+(country|market)/i;

function checkHouseRules(text) {
  const findings = [];
  const seen = new Set();
  const rules = RULES.filter((rule) => BODY_RULES.has(rule.id));
  for (const line of text.split("\n")) {
    if (LEGAL_BOILERPLATE.test(line)) continue;
    for (const rule of rules) {
      if (rule.id === "delivery_promise" && NO_GUARANTEE.test(line)) continue;
      if (rule.id === "single_date" && EARLIEST_DEADLINE.test(line)) continue;
      const result = rule.check({ text: line, subject: line, preview: "", emailText: text });
      if (!result) continue;
      if (rule.id === "watch_box") {
        const key = `watch_box:${(result.match || "").toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push(finding({
          check: "rule_watch_box",
          severity: "consider",
          area: "rules",
          title: "A watch box is mentioned",
          detail: `"${clip(result.match, 40)}" - watch boxes are never mentioned for the plastic series (Rio, Seville ECO). Fine for a series that really has one.`,
          fix: "Check the series in this passage has a watch box.",
          excerpt: line
        }));
        continue;
      }
      const key = `${rule.id}:${(result.match || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // "ECO" on its own is a series name. In a subject line it reads as a claim; in a product
      // overview it names the box.
      const seriesOnly = rule.id === "eco_claim" && /^eco$/i.test(result.match || "");
      findings.push(finding({
        check: `rule_${rule.id}`,
        severity: seriesOnly ? "consider" : RULE_SEVERITY[result.severity || rule.severity] || "should_fix",
        area: "rules",
        title: rule.label,
        detail: `"${clip(result.match || line, 80)}" - ${rule.prompt}`,
        fix: "Rewrite the passage within the rule.",
        excerpt: line
      }));
    }
  }
  return findings;
}

function sortFindings(findings) {
  return [...findings].sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]);
}

function analyseEmailHtml({ html = "", country = "DK" } = {}) {
  const market = String(country || "DK").toUpperCase();
  const text = htmlToText(html);
  const links = findTags(html, "a")
    .map((tag) => ({ href: tag.attributes.href || "", label: "" }))
    .filter((link) => link.href);
  const findings = sortFindings([
    ...checkLinks(html),
    ...checkImages(html),
    ...checkRendering(html),
    ...checkTranslatable(html, market),
    ...checkMarketLanguage(html, market),
    ...checkHouseRules(text)
  ]);
  return {
    country: market,
    text,
    findings,
    stats: {
      bytes: Buffer.byteLength(String(html), "utf8"),
      words: (text.match(/\p{L}+/gu) || []).length,
      links: links.length,
      images: findTags(html, "img").length
    }
  };
}

// Link text with its destination, so the reviewer can tell a button that says one thing and
// goes somewhere else.
function describeLinks(html = "") {
  const lines = [];
  for (const match of stripNonVisible(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = parseAttributes(match[1]).href || "";
    const label = htmlToText(match[2]).replace(/\n/g, " ").trim() || (match[2].match(/alt="([^"]*)"/i)?.[1] ?? "(image)");
    if (href) lines.push(`- "${clip(label, 70)}" -> ${clip(href, 140)}`);
  }
  return [...new Set(lines)].slice(0, 40).join("\n");
}

// ---------------------------------------------------------------------------------------------
// The review

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "findings", "claims"],
  properties: {
    verdict: { type: "string", enum: ["ready", "fix_first"] },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "area", "quote", "problem", "fix"],
        properties: {
          severity: { type: "string", enum: ["must_fix", "should_fix", "consider"] },
          area: { type: "string", enum: ["claims", "rules", "tone", "clarity", "cta", "language", "consistency"] },
          quote: { type: "string" },
          problem: { type: "string" },
          fix: { type: "string" }
        }
      }
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "verdict", "evidence"],
        properties: {
          claim: { type: "string" },
          verdict: { type: "string", enum: ["supported", "not_found", "contradicted"] },
          evidence: { type: "string" }
        }
      }
    }
  }
};

const HOUSE_RULES = [
  "Every factual claim (a figure, an offer, a USP, a production time, a minimum quantity, a review score) must be supported by the Westpack site facts below. A claim that is not there is not_found; one that disagrees is contradicted.",
  "No environmental claims at all: no FSC, recycled, sustainable, CO2 or similar - even for products in an ECO series.",
  "Samples are not free: freight is added and logo samples cost a small amount.",
  "Logo print is included on (most) jewellery boxes only. Bags, pouches and flat-pack boxes may carry a surcharge.",
  "Production time is not delivery time. 7-8 working days (new logo) and 4-5 (existing logo) are production. Never promise when goods arrive or imply it (\"get the boxes in...\", \"ready at your door\").",
  "One Danish master is translated into about fifteen markets with different deadlines. What is wrong is one country's deadline presented as the deadline. A date is fine when it is the earliest deadline across markets and the email says they differ by country - the approved wording is \"De første anbefalede frister for ordrer med tryk falder allerede 10. december – og de er forskellige fra land til land.\" Christmas copy should link the deadlines page and keep its line that delivery before Christmas cannot be guaranteed.",
  "Never mention watch boxes.",
  "Trustpilot shows TrustScore 4.6. Never claim five stars.",
  "Never talk down to the reader's shop, packaging or choices. The energy comes from wanting the product, never from what is wrong with theirs.",
  "Sell the category (\"jewellery boxes with your logo\") rather than a series name - except in an email that presents several series side by side.",
  "Most newsletter readers are existing customers whose logo is already printed by Westpack. Onboarding copy aimed at first-time buyers is a weak spot, not an error.",
  "Copy may have edge and humour; that is a choice, not a problem. Report taste only when it risks offending a customer.",
  "Kevin ROIberg emails are deliberately absurd - a hotline menu, a calculator, a character who oversells. A playful call to action is fine when the reader can tell from the email where it leads; report it only if no reader could expect that destination.",
  "The locked Westpack footer is legal boilerplate on every email - the company address, the FSC licence lines (\"FSC® er miljømærket ...\", \"... licens nummer er FSC®C112509\"), the unsubscribe and social links. Never report it and never list it as a claim."
];

function buildReviewInput({ text, html, country, name, siteFacts }) {
  const market = String(country || "DK").toUpperCase();
  const language = MARKET_LANGUAGE[market] || "the market's language";
  const address = FORM_OF_ADDRESS[market];
  const instructions = [
    "You check Westpack's marketing emails before they are sent. Westpack sells retail packaging - jewellery boxes, gift boxes, carrier bags, pouches, displays, shipping boxes - business to business, to shops in 18 markets.",
    "",
    "Report only real problems a careful editor at Westpack would fix before sending: a claim the site does not support, a broken house rule, a call to action that does not match where its link goes, a contradiction inside the email, a mistake in the language, copy that is unclear about what the reader should do. If the email is fine, say so and return no findings. Fewer, certain findings are worth more than many uncertain ones.",
    "",
    "Every finding must quote the email exactly - copy the words character for character, at most 160 characters - so the editor can find the passage. Do not quote text that is not in the email. Write problem and fix in plain English, one or two sentences each.",
    "",
    "List the factual claims the email makes in claims, each with its verdict against the site facts and the line of the site facts that decides it (or \"not in the site facts\").",
    "",
    "The site facts are a summary of the website, not all of it: a product, feature or offer missing from them may well exist. So a claim the site facts do not mention is should_fix at most, with the fix \"confirm it\" - never must_fix. must_fix is for a claim the site facts contradict, a broken house rule, a broken link or call to action, or something that would mislead or embarrass in front of a customer. Language and clarity are should_fix or consider.",
    "",
    "House rules from the marketing team:",
    ...HOUSE_RULES.map((rule) => `- ${rule}`),
    "",
    `This version is for the ${market} market and is written in ${language}.${market === "DK" ? " It is the Danish master that Duplicate & translate rolls out to the other markets." : ` Check the ${language} for mistakes and for anything left in Danish.`}${address ? ` Its form of address is ${address}; any mixing is a finding.` : ""}`
  ].join("\n");
  const email = [
    `Email: ${name || "(untitled)"}`,
    "",
    "Links (text -> destination):",
    describeLinks(html) || "(none)",
    "",
    "Email text:",
    text.slice(0, REVIEW_TEXT_LIMIT)
  ].join("\n");
  return [
    { role: "system", content: instructions },
    { role: "user", content: `Westpack site facts (from the company's own website):\n\n${siteFacts || "(not available)"}` },
    { role: "user", content: email }
  ];
}

function comparable(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[“”„«»"'’‘`]/g, "")
    .replace(/…|\.\.\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The locked footer's lines. They are the same on every email and are not the editor's to change.
const LOCKED_FOOTER = /fsc\.org|FSC®?\s*C\d{5,}|miljømærket for ansvarligt skovbrug|Sletten 21|DK-7500 Holstebro/i;

// A finding the reader cannot find in the email is worse than no finding.
function finalizeReview(parsed = {}, text = "") {
  const haystack = comparable(text);
  const findings = [];
  let dropped = 0;
  for (const item of parsed.findings || []) {
    if (LOCKED_FOOTER.test(item.quote || "")) continue;
    const quote = comparable(item.quote);
    const pieces = quote.split(" ").filter(Boolean);
    const found = quote.length >= 3 && (haystack.includes(quote) || (pieces.length >= 6 && haystack.includes(pieces.slice(0, 6).join(" "))));
    if (!found) {
      dropped += 1;
      continue;
    }
    findings.push({
      id: `review:${hash(`${item.quote}|${item.problem}`)}`,
      check: `review_${item.area}`,
      severity: SEVERITY_ORDER[item.severity] === undefined ? "consider" : item.severity,
      area: item.area,
      title: clip(item.problem, 140),
      detail: item.problem,
      fix: item.fix,
      excerpt: clip(item.quote),
      source: "review"
    });
  }
  return {
    verdict: parsed.verdict === "ready" && !findings.some((item) => item.severity === "must_fix") ? "ready" : "fix_first",
    summary: String(parsed.summary || ""),
    findings: sortFindings(findings),
    claims: (parsed.claims || [])
      .filter((claim) => !LOCKED_FOOTER.test(`${claim.claim} ${claim.evidence}`) && !/^FSC\b/i.test(claim.claim || ""))
      .map((claim) => ({ claim: clip(claim.claim, 200), verdict: claim.verdict, evidence: clip(claim.evidence, 240) })),
    droppedUnverified: dropped
  };
}

module.exports = {
  MARKET_LANGUAGE,
  REVIEW_SCHEMA,
  analyseEmailHtml,
  buildReviewInput,
  finalizeReview,
  htmlToText,
  textRuns
};
