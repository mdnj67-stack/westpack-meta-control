const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "templates", "meta-trustpilot-carousel");
const T = require(path.join(DIR, "carousel-spec.js"));
const LOCALES = require(path.join(DIR, "locales.js"));
const FR_SPEC = JSON.parse(fs.readFileSync(path.join(DIR, "specs", "fr-ecrins-2026-10.json"), "utf8"));
const NB = " ";

test("every language pack carries every text the design prints, and the Trustpilot wording", () => {
  for (const [key, L] of Object.entries(LOCALES)) {
    assert.ok(L.intl && L.trustLabel, `${key}: intl and trustLabel`);
    assert.match(L.link, /^https:\/\/www\.westpack\.com\/[a-z]{3}_[a-z]{2}_[a-z]{3}\//, `${key}: a store link`);
    assert.equal(L.hero.headline.length, 2, `${key}: the hero headline is two lines`);
    assert.match(L.hero.rating, /TrustScore \{score\}/, `${key}: the rating line says TrustScore`);
    assert.match(L.hero.rating, /\{reviews\}/, `${key}: the rating line carries the review count`);
    assert.match(L.hero.rating, /\{month\}/, `${key}: the rating line carries the month`);
    assert.equal(L.offer.checks.length, 2, `${key}: two checks on the offer card`);
    assert.match(L.cardText.quote, /\{stars\}/, `${key}: quote card headline names the stars`);
    const text = L.primaryText.join("\n");
    for (const p of ["{label}", "{score}", "{reviews}", "{month}"]) assert.ok(text.includes(p), `${key}: primary text has ${p}`);
    assert.ok(L.sources.length >= 3, `${key}: every claim names where on the store it was read`);
  }
});

test("only French is approved; the other languages say they are drafts", () => {
  assert.equal(LOCALES.fr.status, "approved");
  const r = T.resolveSpec(Object.assign({}, FR_SPEC, { locale: "de" }));
  assert.ok(r.warnings.some((w) => /first draft/.test(w)));
  assert.deepEqual(T.resolveSpec(FR_SPEC).warnings, []);
});

test("the French spec reproduces the text of PH - AD26 exactly", () => {
  const r = T.resolveSpec(FR_SPEC);
  assert.deepEqual(r.errors, []);
  assert.equal(r.meta.primaryText, [
    "Ce sont nos clients qui en parlent le mieux ✨",
    `Westpack est noté Excellent sur Trustpilot${NB}: TrustScore 4,6 sur 2${NB}796 avis (octobre 2026).`,
    "",
    "✔ Écrins à bijoux à votre logo dès 48 pièces",
    "✔ Impression du logo gratuite sur les écrins à bijoux",
    "✔ Cliché offert avec la première commande"
  ].join("\n"));
  assert.deepEqual(r.meta.cards.map((c) => [c.name, c.description]), [
    ["Écrins à bijoux à votre logo", `TrustScore 4,6 · 2${NB}796 avis`],
    ["Avis 5 étoiles", "Les Néréides Montmartre"],
    ["Avis 5 étoiles", "NØMARA"],
    ["Avis 5 étoiles", "Serengeti Gems & Jewels"],
    ["Avis 5 étoiles", "Ancoria Bijoutière holistique"],
    ["Dès 48 pièces", "Logo imprimé gratuitement"]
  ]);
  assert.equal(r.meta.link, "https://www.westpack.com/eur_eu_fra/ecrins-a-bijoux.html");
  assert.equal(r.cards[0].rating, `TrustScore 4,6 · 2${NB}796 avis · octobre 2026`);
  assert.deepEqual(r.cards.slice(1, 5).map((c) => c.date), ["24 oct. 2026", "27 juil. 2026", "16 juil. 2026", "25 août 2025"]);
});

test("stars follow the TrustScore in half stars, and Excellent is only used from 4.3", () => {
  assert.equal(T.starsFileForScore(4.6), "stars-4.5.svg");
  assert.equal(T.starsFileForScore(4.8), "stars-5.svg");
  assert.equal(T.starsFileForScore(4.2), "stars-4.svg");
  assert.equal(T.starsFileForScore(2.4), null);
  const low = T.resolveSpec(Object.assign({}, FR_SPEC, { trustpilot: { score: 4.2, reviews: 3000, asOf: "2027-01" } }));
  assert.ok(low.errors.some((e) => /below 4.3/.test(e)));
  const labelled = T.resolveSpec(Object.assign({}, FR_SPEC, { trustpilot: { score: 4.2, reviews: 3000, asOf: "2027-01", label: "Très bien" } }));
  assert.deepEqual(labelled.errors, []);
  assert.match(labelled.meta.primaryText, /noté Très bien sur Trustpilot/);
});

test("numbers are grouped in every language, Italian included", () => {
  assert.equal(T.formatCount(2796, "it-IT"), "2.796");
  assert.equal(T.formatCount(2796, "de-DE"), "2.796");
  assert.equal(T.formatCount(2796, "en-GB"), "2,796");
  assert.equal(T.formatCount(2796, "fr-FR"), `2${NB}796`);
});

test("a spec with missing parts is refused, not rendered half-way", () => {
  const broken = JSON.parse(JSON.stringify(FR_SPEC));
  broken.quotes[1].date = "27/07/2026";
  broken.quotes[2].stars = 6;
  delete broken.offer.photo;
  const r = T.resolveSpec(broken);
  assert.ok(r.errors.some((e) => /quotes\[1\]: date/.test(e)));
  assert.ok(r.errors.some((e) => /quotes\[2\]: stars/.test(e)));
  assert.ok(r.errors.some((e) => /offer: photo/.test(e)));
  assert.ok(T.resolveSpec(Object.assign({}, FR_SPEC, { locale: "xx" })).errors[0].startsWith('unknown locale "xx"'));
});

test("quotes are checked word for word against the Trustpilot export", () => {
  const reviews = [
    { author: "Serengeti Gems & Jewels", content: "La qualité est constante, sans surprise. Et surtout : au moindre souci, on peut parler à un humain. Pas un robot.", stars: "5", date: "2026-07-16 16:21" },
    { author: "Ancoria Bijoutière holistique", content: "Heureuse d’avoir reçu mes boîtes avec mon logo La matière est magnifique avec de belles finitions.  Un service impeccable", stars: "5", date: "2025-08-25 12:46" }
  ];
  const spec = (text, extra) => ({ quotes: [Object.assign({ text, author: "Serengeti Gems & Jewels", stars: 5, date: "2026-07-16" }, extra)] });

  assert.deepEqual(T.verifyQuotes(spec("Et surtout : au moindre souci, on peut parler à un humain."), reviews)[0].errors, []);
  // re-casing the first letter to make an excerpt look like a sentence is an alteration
  assert.match(T.verifyQuotes(spec("Au moindre souci, on peut parler à un humain."), reviews)[0].errors[0], /word for word/);
  // a lower-case start is a cut mid-sentence
  assert.match(T.verifyQuotes(spec("au moindre souci, on peut parler à un humain."), reviews)[0].warnings[0], /mid-sentence/);
  // a capital after a missing full stop is the reviewer's own sentence start
  const ancoria = T.verifyQuotes({ quotes: [{ text: "La matière est magnifique avec de belles finitions. Un service impeccable", author: "Ancoria Bijoutière holistique", stars: 5, date: "2025-08-25" }] }, reviews)[0];
  assert.deepEqual([ancoria.errors, ancoria.warnings], [[], []]);
  assert.match(T.verifyQuotes(spec("Et surtout : au moindre souci", { stars: 4 }), reviews)[0].errors[0], /4/);
  assert.match(T.verifyQuotes(spec("Et surtout : au moindre souci", { date: "2026-07-17" }), reviews)[0].errors[0], /dated 2026-07-16/);
  assert.match(T.verifyQuotes(spec("x", { author: "Somebody Else" }), reviews)[0].errors[0], /no review by/);
});

test("a private reviewer is shown by display name while the check still matches the Trustpilot name", () => {
  const spec = JSON.parse(JSON.stringify(FR_SPEC));
  spec.quotes[0] = Object.assign({}, spec.quotes[0], { author: "Matthew Bogosian", display: "Matthew B. · Los Angeles" });
  const r = T.resolveSpec(spec);
  assert.equal(r.cards[1].author, "Matthew B. · Los Angeles");
  assert.equal(r.meta.cards[1].description, "Matthew B. · Los Angeles");
  const reviews = [{ author: "Matthew Bogosian", content: spec.quotes[0].text, stars: "5", date: `${spec.quotes[0].date} 16:28` }];
  assert.deepEqual(T.verifyQuotes({ quotes: [spec.quotes[0]] }, reviews)[0].errors, []);
  spec.quotes[0].display = " ";
  assert.ok(T.resolveSpec(spec).errors.some((e) => /display is empty/.test(e)));
});

test("a reviewer who names their country can carry its flag on the card and in the Meta description", () => {
  const spec = JSON.parse(JSON.stringify(FR_SPEC));
  spec.quotes[0] = Object.assign({}, spec.quotes[0], { display: "Tony B.", flag: "us" });
  const r = T.resolveSpec(spec);
  assert.equal(r.cards[1].flag, "us");
  assert.equal(r.meta.cards[1].description, "Tony B. \u{1F1FA}\u{1F1F8}");
  assert.equal(r.cards[2].flag, null);
  assert.ok(fs.existsSync(path.join(DIR, "assets", "flag-us.svg")));
  spec.quotes[0].flag = "USA";
  assert.ok(T.resolveSpec(spec).errors.some((e) => /two-letter country code/.test(e)));
});

test("French typography keeps punctuation on its word's line without touching the characters", () => {
  assert.equal(T.typographicSpaces("du rendu !"), `du rendu${NB}!`);
  assert.equal(T.typographicSpaces("Et surtout : au"), `Et surtout${NB}: au`);
  assert.equal(T.typographicSpaces("je recommande!"), "je recommande!");
});

test("every photo a spec names and every graphic the design uses is in the template", () => {
  for (const file of fs.readdirSync(path.join(DIR, "specs")).filter((f) => f.endsWith(".json"))) {
    const spec = JSON.parse(fs.readFileSync(path.join(DIR, "specs", file), "utf8"));
    const photos = [spec.hero.photo.src, spec.offer.photo.src, ...spec.quotes.map((q) => q.photo.src)];
    photos.forEach((src) => assert.ok(fs.existsSync(path.join(DIR, src)), `${file}: ${src}`));
  }
  for (const asset of ["logo-black.svg", "westpack-logo.svg", "stars-3.svg", "stars-3.5.svg", "stars-4.svg", "stars-4.5.svg", "stars-5.svg"]) {
    assert.ok(fs.existsSync(path.join(DIR, "assets", asset)), asset);
  }
});

test("publish.js can only create paused ads, never retries a write, and keeps the review text untouched", () => {
  const src = fs.readFileSync(path.join(DIR, "publish.js"), "utf8");
  assert.match(src, /status: "PAUSED"/);
  assert.doesNotMatch(src, /"ACTIVE"/);
  assert.match(src, /maxRetries: 0/);
  for (const f of ["text_optimizations", "text_generation", "text_translation", "generate_cta", "add_text_overlay", "description_automation"]) {
    assert.ok(src.includes(`"${f}"`), `${f} is opted out`);
  }
  assert.match(src, /multi_share_optimized: false/);
  assert.match(src, /multi_share_end_card: false/);
});
