// The vocabulary the subject line generator thinks in. One copy, used by the pattern bank's
// validation, the retrieval that picks examples for a campaign, the generator's output schema and
// the labels on screen - so a mechanism can never be called one thing in the bank and another in
// the prompt.
//
// A mechanism (virkemiddel) is *why* a subject line gets opened, not what it is about. Campaign
// type is what the email is about. The two are tagged separately because the same mechanism works
// across many campaign types ("tal" sells a guide and a bestseller list alike), and retrieval needs
// to vary one while holding the other.

const MECHANISMS = [
  { key: "nysgerrighed", label: "Nysgerrighed", description: "Åbner et hul, som kun mailen lukker. Lover ikke mere, end mailen holder." },
  { key: "konkret_vaerdi", label: "Konkret værdi", description: "Siger præcist, hvad modtageren får ud af at åbne." },
  { key: "tal", label: "Tal og lister", description: "Et konkret antal gør indholdet håndgribeligt og hurtigt at vurdere." },
  { key: "spoergsmaal", label: "Spørgsmål", description: "Et spørgsmål modtageren svarer på i hovedet, før de har besluttet sig for at åbne." },
  { key: "deadline", label: "Frist", description: "En reel tidsgrænse og hvorfor den betyder noget for modtageren." },
  { key: "social_proof", label: "Andre gør det", description: "Kunder, bestsellere og genbestillinger viser vejen." },
  { key: "bag_kulisserne", label: "Bag kulisserne", description: "Produktion, mennesker og proces, som modtageren ellers aldrig ser." },
  { key: "kontrast", label: "Kontrast", description: "To ting, der ikke burde passe sammen, eller en forventning der vendes." },
  { key: "nyhed", label: "Nyhed", description: "Noget nyt, sagt så det mærkes nyt og ikke som en pressemeddelelse." },
  { key: "guide", label: "Guide og tips", description: "Lærer modtageren noget, de kan bruge i deres egen butik." },
  { key: "personlig", label: "Personlig stemme", description: "En afsender, der taler som et menneske til et menneske." },
  { key: "historie", label: "Historie", description: "En karakter eller situation, der trækker modtageren ind." },
  { key: "eksklusivitet", label: "Først til", description: "Forhåndsadgang, begrænset antal eller kun for kunder - når det er sandt." },
  { key: "humor", label: "Humor og ordspil", description: "Et smil først, budskabet bagefter. Overlever sjældent en oversættelse." },
  { key: "tilbud", label: "Tilbud", description: "Rabat eller fordel sagt direkte, uden omsvøb." },
  { key: "oejeblik", label: "Øjeblikket", description: "Sæsonen, datoen eller travlheden, modtageren står midt i lige nu." }
];

const CAMPAIGN_TYPES = [
  { key: "produktnyhed", label: "Produktnyhed", description: "Ny serie, nyt produkt eller nye farver." },
  { key: "produktfokus", label: "Produktfokus", description: "En eksisterende serie, kategori eller bestsellere i spotlight." },
  { key: "tilbud", label: "Tilbud", description: "Rabat, udsalg eller kampagnepris." },
  { key: "frist", label: "Frist", description: "Logotryk- og julefrister, sidste chance." },
  { key: "inspiration", label: "Inspiration", description: "Guide, tips, trends, looks og how-to." },
  { key: "kundecase", label: "Kundecase", description: "En kunde, en partner eller anmeldelser." },
  { key: "saeson", label: "Sæson", description: "Jul, Black Friday, Valentins, Halloween, højsæson." },
  { key: "virksomhed", label: "Virksomheden", description: "Produktion, medarbejdere og nyt fra Westpack." },
  { key: "konkurrence", label: "Konkurrence", description: "Konkurrence, gavekort eller afstemning." },
  { key: "forhandler", label: "Forhandler og partner", description: "B2B-programmer som WTP-forhandler og partnerskab." },
  { key: "service", label: "Service", description: "Logotryk, prøver, bulk, lager - sådan arbejder Westpack." }
];

const TONES = [
  { key: "legende", label: "Legende" },
  { key: "direkte", label: "Direkte" },
  { key: "varm", label: "Varm" },
  { key: "premium", label: "Premium" },
  { key: "saglig", label: "Saglig" },
  { key: "kaek", label: "Kæk" }
];

// How likely the line is to break when the Danish master is translated into the other markets.
// Wordplay and idiom are high; a plain benefit is low.
const TRANSLATION_RISKS = ["lav", "middel", "hoej"];

const MECHANISM_KEYS = MECHANISMS.map((item) => item.key);
const CAMPAIGN_TYPE_KEYS = CAMPAIGN_TYPES.map((item) => item.key);
const TONE_KEYS = TONES.map((item) => item.key);

function labelFor(list, key) {
  return list.find((item) => item.key === key)?.label || String(key || "");
}

module.exports = {
  MECHANISMS,
  CAMPAIGN_TYPES,
  TONES,
  TRANSLATION_RISKS,
  MECHANISM_KEYS,
  CAMPAIGN_TYPE_KEYS,
  TONE_KEYS,
  mechanismLabel: (key) => labelFor(MECHANISMS, key),
  campaignTypeLabel: (key) => labelFor(CAMPAIGN_TYPES, key),
  toneLabel: (key) => labelFor(TONES, key)
};
