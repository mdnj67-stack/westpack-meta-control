/**
 * Every word the Trustpilot carousel prints that is not a customer's review, per language.
 *
 * The design never changes between languages; only these strings, the store link and the number and date
 * formats do. Placeholders: {score} TrustScore, {reviews} review count, {month} month of the count, {label}
 * Trustpilot's own word for the score, {stars} a review's star count.
 *
 * Claims come from each store's own pages, read on 2026-10-27 (see `sources`): from 48 pieces, free logo
 * printing on jewellery boxes, and a free foil plate (cliché) with the first order. Logo print is free on
 * jewellery boxes only, so these packs are for jewellery-box carousels. `fr` is the copy the user approved for
 * PH - AD26; the others are first drafts that someone fluent in the language has to read before they run.
 *
 * A plain script, like src/saturation-rules.js: module.exports in Node, globalThis.WestpackTrustpilotLocales
 * in the browser.
 */
(function (root) {
  const nb = " ";

  const LOCALES = {
    fr: {
      intl: "fr-FR",
      status: "approved",
      link: "https://www.westpack.com/eur_eu_fra/ecrins-a-bijoux.html",
      trustLabel: "Excellent",
      hero: {
        headline: ["Écrins à bijoux", "à votre logo"],
        sub: "Ce que nos clients en disent",
        rating: "TrustScore {score} · {reviews} avis · {month}"
      },
      offer: {
        headline: "Écrins à bijoux à votre logo",
        accent: "dès 48 pièces",
        checks: ["Logo imprimé gratuitement", "Cliché offert à la 1re commande"]
      },
      // Facebook shows ~10-14 characters of a card headline beside the button, so these stay short.
      cardText: {
        hero: ["Écrins à bijoux à votre logo", "TrustScore {score} · {reviews} avis"],
        quote: "Avis {stars} étoiles",
        offer: ["Dès 48 pièces", "Logo imprimé gratuitement"]
      },
      // Instagram prints card 1's headline above this text, so it opens with the proof, not the product.
      primaryText: [
        "Ce sont nos clients qui en parlent le mieux ✨",
        `Westpack est noté {label} sur Trustpilot${nb}: TrustScore {score} sur {reviews} avis ({month}).`,
        "",
        "✔ Écrins à bijoux à votre logo dès 48 pièces",
        "✔ Impression du logo gratuite sur les écrins à bijoux",
        "✔ Cliché offert avec la première commande"
      ],
      sources: [
        "eur_eu_fra forside: « Commandez dès 48 pièces avec votre logo »",
        "eur_eu_fra: « Impression de logo gratuite sur écrins à bijoux »",
        "eur_eu_fra menu: « Cliché de marquage à chaud offert avec la première commande »"
      ]
    },

    de: {
      intl: "de-DE",
      status: "draft",
      link: "https://www.westpack.com/eur_eu_ger/schmuckschachteln.html",
      trustLabel: "Hervorragend",
      hero: {
        headline: ["Schmuckschachteln", "mit Ihrem Logo"],
        sub: "Das sagen unsere Kunden",
        rating: "TrustScore {score} · {reviews} Bewertungen · {month}"
      },
      offer: {
        headline: "Schmuckschachteln mit Ihrem Logo",
        accent: "ab 48 Stück",
        checks: ["Logodruck gratis", "Gratis Folienprägeplatte bei Erstbestellung"]
      },
      cardText: {
        hero: ["Schmuckschachteln mit Ihrem Logo", "TrustScore {score} · {reviews} Bewertungen"],
        quote: "{stars}-Sterne-Bewertung",
        offer: ["Ab 48 Stück", "Logodruck gratis"]
      },
      primaryText: [
        "Unsere Kunden sagen es am besten ✨",
        "Westpack ist auf Trustpilot mit „{label}“ bewertet: TrustScore {score} bei {reviews} Bewertungen ({month}).",
        "",
        "✔ Schmuckschachteln mit Ihrem Logo ab 48 Stück",
        "✔ Logodruck gratis auf Schmuckschachteln",
        "✔ Kostenlose Folienprägeplatte bei Erstbestellung"
      ],
      sources: [
        "eur_eu_ger Startseite: „Bestellen Sie ab 48 Stück mit Ihrem Logo“",
        "eur_eu_ger: „Logodruck gratis auf Schmuckschachteln“",
        "eur_eu_ger USP-Leiste: „Kostenlose Folienprägeplatte bei Erstbestellung“"
      ]
    },

    it: {
      intl: "it-IT",
      status: "draft",
      link: "https://www.westpack.com/eur_eu_ita/astucci-per-gioielli.html",
      trustLabel: "Eccezionale",
      hero: {
        headline: ["Astucci per gioielli", "con il vostro logo"],
        sub: "Cosa dicono i nostri clienti",
        rating: "TrustScore {score} · {reviews} recensioni · {month}"
      },
      offer: {
        headline: "Astucci per gioielli con il vostro logo",
        accent: "da 48 pezzi",
        checks: ["Stampa del logo gratuita", "Cliché gratuito per il primo ordine"]
      },
      cardText: {
        hero: ["Astucci con il vostro logo", "TrustScore {score} · {reviews} recensioni"],
        quote: "Recensione {stars} stelle",
        offer: ["Da 48 pezzi", "Stampa del logo gratuita"]
      },
      primaryText: [
        "Sono i nostri clienti a dirlo meglio ✨",
        "Westpack è valutata {label} su Trustpilot: TrustScore {score} su {reviews} recensioni ({month}).",
        "",
        "✔ Astucci per gioielli con il vostro logo da 48 pezzi",
        "✔ Stampa gratuita su scatole per gioielli",
        "✔ Cliché gratuito per il primo ordine"
      ],
      sources: [
        "eur_eu_ita home: «Ordinate anche solo 48 pezzi con il vostro logo»",
        "eur_eu_ita home: «Stampa gratuita su scatole per gioielli» (the category page says «sulla maggior parte»; the user confirmed 2026-10-27 that logo print is free on every jewellery box, whatever the material)",
        "eur_eu_ita USP: «Cliché gratuito per il primo ordine»"
      ]
    },

    en: {
      intl: "en-GB",
      status: "draft",
      link: "https://www.westpack.com/eur_eu_eng/jewellery-boxes.html",
      trustLabel: "Excellent",
      hero: {
        headline: ["Jewellery boxes", "with your logo"],
        sub: "What our customers say",
        rating: "TrustScore {score} · {reviews} reviews · {month}"
      },
      offer: {
        headline: "Jewellery boxes with your logo",
        accent: "from 48 pieces",
        checks: ["Free logo printing", "Free foil plate with your first order"]
      },
      cardText: {
        hero: ["Jewellery boxes with your logo", "TrustScore {score} · {reviews} reviews"],
        quote: "{stars}-star review",
        offer: ["From 48 pieces", "Free logo printing"]
      },
      primaryText: [
        "Our customers say it best ✨",
        "Westpack is rated {label} on Trustpilot: TrustScore {score} from {reviews} reviews ({month}).",
        "",
        "✔ Jewellery boxes with your logo from 48 pieces",
        "✔ Free logo printing on jewellery boxes",
        "✔ Complimentary foil stamping plate with your first order"
      ],
      sources: [
        "eur_eu_eng home: \"Order as few as 48 pieces with your logo\"",
        "eur_eu_eng: \"Free logo printing on jewellery boxes\"",
        "eur_eu_eng USP: \"Complimentary foil stamping plate with first order\""
      ]
    },

    "en-uk": null, // filled below: en with the UK store link
    "en-us": {
      intl: "en-US",
      status: "draft",
      link: "https://www.westpack.com/usd_us_eng/jewelry-boxes.html",
      trustLabel: "Excellent",
      hero: {
        headline: ["Jewelry boxes", "with your logo"],
        sub: "What our customers say",
        rating: "TrustScore {score} · {reviews} reviews · {month}"
      },
      // Duties replace the foil plate here: for a US buyer the import cost is the open question, and the
      // duties carousel was the US account's best ad (11 of 23 purchases).
      offer: {
        headline: "Jewelry boxes with your logo",
        accent: "from 48 units",
        checks: ["Free logo printing", "US duties included at checkout"]
      },
      cardText: {
        hero: ["Jewelry boxes with your logo", "TrustScore {score} · {reviews} reviews"],
        quote: "{stars}-star review",
        offer: ["From 48 units", "US duties included"]
      },
      primaryText: [
        "Our customers say it best ✨",
        "Westpack is rated {label} on Trustpilot: TrustScore {score} from {reviews} reviews ({month}).",
        "",
        "✔ Jewelry boxes with your logo from 48 units",
        "✔ Free logo printing on every jewelry box",
        "✔ All US duties included at checkout"
      ],
      sources: [
        "usd_us_eng jewelry boxes: \"MOQ: 48 units\"",
        "usd_us_eng: \"Free logo printing on jewelry boxes\" - on every jewelry box, whatever the material (user, 2026-10-27)",
        "usd_us_eng header: \"All Duties Included at Checkout for US Orders\" (also the blog post /usd_us_eng/blog/us-orders)"
      ]
    }
  };

  LOCALES["en-uk"] = Object.assign({}, LOCALES.en, {
    link: "https://www.westpack.com/gbp_uk_eng/jewellery-boxes.html",
    sources: LOCALES.en.sources.concat("gbp_uk_eng: the same three lines (knowledge/westpack-site/README.md)")
  });

  if (typeof module !== "undefined" && module.exports) module.exports = LOCALES;
  else root.WestpackTrustpilotLocales = LOCALES;
})(typeof globalThis !== "undefined" ? globalThis : this);
