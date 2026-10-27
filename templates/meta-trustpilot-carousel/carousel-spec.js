/**
 * Turns a carousel spec (language, Trustpilot figures, photos, review quotes) into every text the carousel
 * prints and every text the Meta creative carries, so the cards and the ad copy cannot drift apart.
 * carousel.html renders from it in the browser; publish.js builds the creative from it in Node.
 *
 * It also holds the rules the user set for review ads (2026-10-27), as checks rather than advice:
 * - a quote is the customer's own words, unchanged; `verifyQuotes` finds each one in the Trustpilot export
 * - an excerpt starts where a sentence starts, so no letter is re-cased to make it look like one
 * - the score always carries the word "TrustScore", a review count and the month it was read
 * - "Excellent" (and its translations) is Trustpilot's word for 4.3 and up only
 *
 * A plain script: module.exports in Node, globalThis.WestpackTrustpilotCarousel in the browser.
 */
(function (root) {
  const isNode = typeof module !== "undefined" && module.exports;
  const LOCALES = isNode ? require("./locales.js") : root.WestpackTrustpilotLocales;

  const NBSP = " ";
  const STAR_FILES = { 3: "stars-3.svg", 3.5: "stars-3.5.svg", 4: "stars-4.svg", 4.5: "stars-4.5.svg", 5: "stars-5.svg" };
  // Trustpilot labels 4.3 and above "Excellent"; below that the word would be untrue.
  const EXCELLENT_FROM = 4.3;
  const MAX_QUOTES = 8; // Meta allows ten cards; hero and offer take two
  const DEFAULT_PHOTO = { y: -640, x: "50%", zoom: 1080 };

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, (m, key) => (Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : m));
  }

  // Intl writes French thousands with U+202F; Montserrat has no such glyph, so it would fall back to another font.
  function plainSpaces(s) {
    return String(s).replace(/[  ]/g, NBSP);
  }

  function formatScore(score, intl) {
    return new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(score);
  }

  // "always": Italian and Spanish CLDR leave four-digit numbers ungrouped, and "2796" reads like a code.
  function formatCount(n, intl) {
    return plainSpaces(new Intl.NumberFormat(intl, { useGrouping: "always" }).format(n));
  }

  function formatMonth(asOf, intl) {
    const [y, m] = String(asOf).split("-").map(Number);
    return new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 15));
  }

  function formatDay(date, intl) {
    const [y, m, d] = String(date).split("-").map(Number);
    return plainSpaces(new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d)));
  }

  // Half stars, as Trustpilot's own widget draws them: 4.6 shows four and a half.
  function starsFileForScore(score) {
    const half = Math.round(Number(score) * 2) / 2;
    return STAR_FILES[half] || null;
  }

  function isDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
  }

  function normalizePhoto(photo, where, errors) {
    if (!photo || !photo.src) {
      errors.push(`${where}: photo.src is missing`);
      return null;
    }
    return Object.assign({}, DEFAULT_PHOTO, photo);
  }

  // A spec may override any locale text (spec.text); objects merge one level deep, arrays and strings replace.
  function mergeText(base, override) {
    const out = Object.assign({}, base);
    Object.entries(override || {}).forEach(([key, value]) => {
      out[key] = value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])
        ? Object.assign({}, base[key], value)
        : value;
    });
    return out;
  }

  function resolveSpec(spec, locales) {
    const table = locales || LOCALES;
    const errors = [];
    const warnings = [];
    const s = spec || {};
    const localeKey = String(s.locale || "");
    const base = table[localeKey];
    if (!base) {
      return { errors: [`unknown locale "${localeKey}" - use one of: ${Object.keys(table).join(", ")}`], warnings, cards: [], meta: null };
    }
    const L = mergeText(base, s.text);
    if (base.status !== "approved") warnings.push(`the ${localeKey} copy is a first draft - have someone fluent in it read every card and the ad text before it runs`);

    const tp = s.trustpilot || {};
    const score = Number(tp.score);
    const reviews = Number(tp.reviews);
    if (!(score >= 1 && score <= 5)) errors.push("trustpilot.score must be the TrustScore, 1.0-5.0");
    if (!(Number.isInteger(reviews) && reviews > 0)) errors.push("trustpilot.reviews must be the review count Trustpilot shows");
    if (!/^\d{4}-\d{2}$/.test(String(tp.asOf || ""))) errors.push('trustpilot.asOf must be the month the figures were read, "YYYY-MM"');
    let label = tp.label || "";
    if (!label) {
      if (score >= EXCELLENT_FROM) label = L.trustLabel;
      else errors.push(`TrustScore ${tp.score} is below ${EXCELLENT_FROM}, so it is not "Excellent" - set trustpilot.label to Trustpilot's own word for it`);
    }
    const heroStars = starsFileForScore(score);
    if (score >= 1 && !heroStars) errors.push(`no star graphic for TrustScore ${tp.score}; the template carries 3 to 5 stars`);

    const quotes = Array.isArray(s.quotes) ? s.quotes : [];
    if (quotes.length < 1 || quotes.length > MAX_QUOTES) errors.push(`quotes: 1-${MAX_QUOTES} reviews, got ${quotes.length}`);

    const values = {
      score: score >= 1 ? formatScore(score, L.intl) : "",
      reviews: reviews > 0 ? formatCount(reviews, L.intl) : "",
      month: /^\d{4}-\d{2}$/.test(String(tp.asOf || "")) ? formatMonth(tp.asOf, L.intl) : "",
      label
    };
    const rating = fill(L.hero.rating, values);
    if (!/TrustScore/.test(rating)) errors.push('the rating line must say "TrustScore" (Trustpilot\'s rule)');

    const cards = [];
    cards.push({
      kind: "hero",
      photo: normalizePhoto(s.hero && s.hero.photo, "hero", errors),
      headline: [].concat(L.hero.headline),
      sub: L.hero.sub,
      rating,
      stars: heroStars
    });

    quotes.forEach((q, i) => {
      const where = `quotes[${i}]`;
      const text = String(q.text || "").trim();
      const stars = Number(q.stars);
      if (!text) errors.push(`${where}: text is empty`);
      if (!String(q.author || "").trim()) errors.push(`${where}: author is missing - use the name exactly as it stands on Trustpilot`);
      if (!isDate(q.date)) errors.push(`${where}: date must be the review date, "YYYY-MM-DD"`);
      if (!STAR_FILES[stars] || !Number.isInteger(stars)) errors.push(`${where}: stars must be 3, 4 or 5 - the review's own rating`);
      cards.push({
        kind: "quote",
        photo: normalizePhoto(q.photo, where, errors),
        text,
        author: String(q.author || "").trim(),
        date: isDate(q.date) ? formatDay(q.date, L.intl) : "",
        stars: STAR_FILES[stars] || null,
        starCount: stars
      });
    });

    cards.push({
      kind: "offer",
      photo: normalizePhoto(s.offer && s.offer.photo, "offer", errors),
      headline: L.offer.headline,
      accent: L.offer.accent,
      checks: [].concat(L.offer.checks),
      stars: heroStars
    });

    const cardText = cards.map((card) => {
      if (card.kind === "hero") return { name: fill(L.cardText.hero[0], values), description: fill(L.cardText.hero[1], values) };
      if (card.kind === "offer") return { name: L.cardText.offer[0], description: L.cardText.offer[1] };
      return { name: fill(L.cardText.quote, { stars: card.starCount }), description: card.author };
    });

    const primaryText = fill([].concat(L.primaryText).join("\n"), values);

    return {
      errors,
      warnings,
      locale: localeKey,
      intl: L.intl,
      cards,
      meta: {
        link: s.link || L.link,
        cta: "LEARN_MORE",
        primaryText,
        cards: cardText,
        urlTags: "utm_source=facebook&utm_medium=paidsocial&utm_campaign={{campaign.name}}&utm_content={{ad.name}}"
      }
    };
  }

  // French sets a space before : ; ! ? and inside « »; a no-break space keeps the mark on its word's line.
  // Typography only - the characters of the quote are not touched.
  function typographicSpaces(text) {
    return String(text).replace(/ ([:;!?»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
  }

  function collapse(s) {
    return String(s || "").replace(/[\s  ]+/g, " ").trim();
  }

  /**
   * Checks every quote against the reviews in a Trustpilot Business export: same author, same rating, same
   * date, and the text found word for word. `reviews` is [{ author, title, content, stars, date }].
   */
  function verifyQuotes(spec, reviews) {
    const results = [];
    (spec.quotes || []).forEach((q, i) => {
      const author = collapse(q.author);
      const mine = reviews.filter((r) => collapse(r.author) === author);
      const out = { index: i, author, errors: [], warnings: [] };
      results.push(out);
      if (!mine.length) {
        out.errors.push(`no review by "${author}" in the export - check the spelling against Trustpilot`);
        return;
      }
      const needle = collapse(q.text);
      const hit = mine.map((r) => ({ r, body: collapse(r.content), at: collapse(r.content).indexOf(needle) })).find((x) => x.at >= 0);
      if (!hit) {
        out.errors.push("the text is not in the review word for word - quote it exactly, punctuation and capitals included");
        return;
      }
      // A capital after no full stop is a reviewer who left the stop out ("…avec mon logo La matière…");
      // a lower-case start is an excerpt cut mid-sentence, which reads as if a letter had been dropped.
      const before = hit.body.slice(0, hit.at).trimEnd();
      if (before && !/[.!?…]$/.test(before) && /^\p{Ll}/u.test(needle)) {
        out.warnings.push(`starts mid-sentence (after "…${before.slice(-30)}") - start the excerpt where a sentence starts`);
      }
      if (Number(hit.r.stars) !== Number(q.stars)) out.errors.push(`the review has ${hit.r.stars} stars, the spec says ${q.stars}`);
      if (String(hit.r.date || "").slice(0, 10) !== String(q.date)) out.errors.push(`the review is dated ${String(hit.r.date).slice(0, 10)}, the spec says ${q.date}`);
    });
    return results;
  }

  const api = { resolveSpec, verifyQuotes, typographicSpaces, starsFileForScore, formatCount, formatDay, formatMonth, LOCALES, MAX_QUOTES };
  if (isNode) module.exports = api;
  else root.WestpackTrustpilotCarousel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
