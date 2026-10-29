// The one form of address each market uses, for the Klaviyo translator.
//
// The translator works in batches of 40 fragments, and each batch used to pick its own form: on 2026-10-29 one email
// came back in German with "Sie" in the first half and "du" in the second, and in French with "tu" and "vous". So
// every batch is now told the market's own convention, read off what each market has actually sent (subject and
// preview text since June 2025, formal / informal pronouns): DE Sie 68/19, FR vous 65/11, PT você 41/5; NL je 61/8,
// IT tu 48/0, ES tú 59/0, PL 30/2, RO 42/2, SE du 69/0, NO du 61/3, FI 2/0. CZ, SK and HU have almost no sends, so
// they get only the instruction not to mix. English has one "you".
const FORM_OF_ADDRESS = {
  DE: "formal: Sie / Ihr / Ihnen (never du)",
  FR: "formal: vous / votre / vos (never tu)",
  PT: "formal: você with o seu / a sua (never tu)",
  NL: "informal: je / jij / jouw (never u / uw)",
  IT: "informal: tu / tuo / tua (never Lei)",
  ES: "informal: tú / tu / tus (never usted)",
  PL: "informal: second person singular, ty / twój (never Pan / Pani / Państwo)",
  RO: "informal: tu / tău / ta (never dumneavoastră)",
  SE: "informal: du / din / ditt",
  NO: "informal: du / din / ditt",
  FI: "informal: second person singular (sinä)",
};

// The rollout passes the catalogue label ("Tysk (DE)"); other callers pass a language name.
const NAMES = {
  german: "DE", tysk: "DE", deutsch: "DE", french: "FR", fransk: "FR", "français": "FR", portuguese: "PT", portugisisk: "PT",
  dutch: "NL", hollandsk: "NL", nederlands: "NL", italian: "IT", italiensk: "IT", spanish: "ES", spansk: "ES",
  polish: "PL", polsk: "PL", romanian: "RO", "rumænsk": "RO", swedish: "SE", svensk: "SE", norwegian: "NO", norsk: "NO",
  finnish: "FI", finsk: "FI",
};

function marketForLanguage(targetLanguage = "") {
  const text = String(targetLanguage || "");
  const code = (text.match(/\(([A-Z]{2})\)/) || [])[1];
  if (code) return code;
  return NAMES[text.trim().toLowerCase().split(/[\s(]/)[0]] || "";
}

function formOfAddressRule(targetLanguage = "") {
  const form = FORM_OF_ADDRESS[marketForLanguage(targetLanguage)];
  const always = "Address the reader with one form of address throughout the whole email - in every fragment, including quoted speech, menu instructions and asides - and never mix formal and informal.";
  return form ? `${always} In this language that form is ${form}.` : always;
}

module.exports = { FORM_OF_ADDRESS, marketForLanguage, formOfAddressRule };
