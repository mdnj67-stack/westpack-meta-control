/**
 * Westpack Signup Lab - one entry per webshop storefront.
 *
 * Everything a market needs lives here, so a popup is never edited to change a market:
 * - companyId: the Klaviyo account's PUBLIC key (site id). Public by design; it is what klaviyo.js uses on the
 *   store. Never put a private key in this file or anywhere under signup/.
 * - listId: the market's newsletter list, read off the market's own signup forms (2026-10-28). The listId in the
 *   app's klaviyoMarketsJson is not the newsletter list in most accounts.
 * - optIn: the list's opt-in process as Klaviyo reported it (all single_opt_in on 2026-10-28). It only changes the
 *   copy after a signup; Klaviyo itself decides whether to send a confirmation email.
 * - consent: the store's own consent sentence from its /newsletter-signup page, verbatim, with privacyLink being
 *   the words in it that link to the privacy page. A popup on the store says what the store's own signup page says.
 *
 * Plain script: module.exports in Node (tests), globalThis.WestpackSignupMarkets in the browser.
 */
(function (root) {
  // The master switch. Off, the script on the stores does nothing at all - so the store's tag can go in before launch
  // - except on a page opened with ?wps=preview (westpack-signup.js). Going live is setting this to true and deploying,
  // in the same minutes as The Insert popups are unpublished (node tools/signup/go-live.js; see IMPLEMENTERING.md).
  const LIVE = false;

  const privacy = (code) => `https://www.westpack.com/${code}/westpack-gdpr`;
  const store = (code) => `https://www.westpack.com/${code}/`;

  const MARKETS = {
    dkk_dk_den: {
      market: "DK", lang: "da", locale: "da-DK", companyId: "VRPp5S", listId: "SbvRDH", optIn: "single",
      consent: "Ved at tilmelde dig accepterer du at modtage e-mails fra Westpack med nyheder, produktinformation og kampagner. Du kan til enhver tid afmelde dig via link i mailen. Vi passer godt på dine data – læs mere i vores persondatapolitik.",
      privacyLink: "persondatapolitik",
    },
    gbp_uk_eng: {
      market: "UK", lang: "en", locale: "en-GB", companyId: "UG4yb7", listId: "RVh6qy", optIn: "single",
      consent: "By signing up, you agree to receive emails from Westpack with news, product updates, and promotional content. You can unsubscribe at any time using the link in our emails. We take good care of your data – read more in our personal data policy.",
      privacyLink: "personal data policy",
    },
    eur_eu_eng: {
      market: "EU", lang: "en", locale: "en", companyId: "WkyaSU", listId: "Ue5ZZe", optIn: "single",
      consent: "By signing up, you agree to receive emails from Westpack with news, product updates, and promotional content. You can unsubscribe at any time using the link in our emails. We treat your data with care – read more in our personal data policy.",
      privacyLink: "personal data policy",
    },
    usd_us_eng: {
      market: "US", lang: "en-US", locale: "en-US", companyId: "Y5Lyaa", listId: "W29TuN", optIn: "single",
      consent: "By signing up, you agree to receive emails from Westpack with news, product updates, and promotions. You can unsubscribe at any time using the link in our emails. We take good care of your data – read more in our Privacy Policy.",
      privacyLink: "Privacy Policy",
    },
    eur_eu_ger: {
      market: "DE", lang: "de", locale: "de-DE", companyId: "T2raST", listId: "WaGU4J", optIn: "single",
      consent: "Mit Ihrer Anmeldung stimmen Sie dem Erhalt von E-Mails von Westpack mit Neuigkeiten, Produkt-Updates und Werbeinhalten zu. Sie können sich jederzeit über den Abmeldelink in unseren E-Mails abmelden. Wir gehen sorgfältig mit Ihren Daten um – lesen Sie mehr in unserer Datenschutzrichtlinie.",
      privacyLink: "Datenschutzrichtlinie",
    },
    eur_eu_fra: {
      market: "FR", lang: "fr", locale: "fr-FR", companyId: "XnmZ8y", listId: "SWpazR", optIn: "single",
      consent: "En vous inscrivant, vous acceptez de recevoir des e-mails de Westpack contenant des actualités, des mises à jour produits et du contenu promotionnel. Vous pouvez vous désinscrire à tout moment en utilisant le lien présent dans nos e-mails. Nous prenons grand soin de vos données – lisez-en plus dans notre politique de protection des données personnelles.",
      privacyLink: "politique de protection des données personnelles",
    },
    eur_eu_ita: {
      market: "IT", lang: "it", locale: "it-IT", companyId: "R7tLRX", listId: "WBKFUe", optIn: "single",
      consent: "Iscrivendoti, accetti di ricevere e-mail da Westpack con notizie, aggiornamenti sui prodotti e contenuti promozionali. Puoi annullare l'iscrizione in qualsiasi momento utilizzando il link presente nelle nostre e-mail. Trattiamo i tuoi dati con cura – leggi di più nella nostra informativa sulla privacy.",
      privacyLink: "informativa sulla privacy",
    },
    eur_eu_spa: {
      market: "ES", lang: "es", locale: "es-ES", companyId: "YrXjxM", listId: "SiM7Sm", optIn: "single",
      consent: "Al suscribirte, aceptas recibir correos electrónicos de Westpack con noticias, actualizaciones de productos y contenido promocional. Puedes darte de baja en cualquier momento mediante el enlace incluido en nuestros correos. Cuidamos tus datos con responsabilidad – lee más en nuestra política de privacidad.",
      privacyLink: "política de privacidad",
    },
    eur_eu_ned: {
      market: "NL", lang: "nl", locale: "nl-NL", companyId: "Ta9bu4", listId: "VyamuZ", optIn: "single",
      consent: "Door je aan te melden, ga je akkoord met het ontvangen van e-mails van Westpack met nieuws, productupdates en promotionele inhoud. Je kunt je op elk moment afmelden via de link in onze e-mails. We behandelen je gegevens zorgvuldig – lees meer in ons privacybeleid.",
      privacyLink: "privacybeleid",
    },
    eur_eu_por: {
      market: "PT", lang: "pt", locale: "pt-PT", companyId: "UJPi3P", listId: "QTQvXe", optIn: "single",
      consent: "Ao inscrever-se, concorda em receber e-mails da Westpack com notícias, atualizações de produtos e conteúdo promocional. Pode cancelar a sua subscrição a qualquer momento através do link presente nos nossos e-mails. Tratamos os seus dados com todo o cuidado – leia mais na nossa política de privacidade.",
      privacyLink: "política de privacidade",
    },
    sek_se_swe: {
      market: "SE", lang: "sv", locale: "sv-SE", companyId: "VbJPYT", listId: "SZmaQa", optIn: "single",
      consent: "Genom att prenumerera godkänner du att få e-post från Westpack med nyheter, produktuppdateringar och marknadsföringsinnehåll. Du kan när som helst avsluta din prenumeration via länken i våra mejl. Vi hanterar dina uppgifter med stor omsorg – läs mer i vår policy för personuppgifter.",
      privacyLink: "policy för personuppgifter",
    },
    nok_no_nor: {
      market: "NO", lang: "nb", locale: "nb-NO", companyId: "VeA6fJ", listId: "V6S5Ez", optIn: "single",
      consent: "Ved å melde deg på godtar du å motta e-poster fra Westpack med nyheter, produktoppdateringer og kampanjeinnhold. Du kan når som helst melde deg av ved å bruke lenken i e-postene våre. Vi behandler dataene dine med omhu – les mer i vår personvernpolicy.",
      privacyLink: "personvernpolicy",
    },
    eur_eu_fin: {
      market: "FI", lang: "fi", locale: "fi-FI", companyId: "RuQitR", listId: "WegqiS", optIn: "single",
      consent: "Rekisteröitymällä hyväksyt, että Westpack saa lähettää sinulle sähköposteja uutisista, tuoteuutuuksista ja markkinointisisällöstä. Voit peruuttaa tilauksesi milloin tahansa käyttämällä sähköpostiemme lopussa olevaa linkkiä. Käsittelemme tietojasi huolellisesti – lue lisää henkilötietopolitiikastamme.",
      privacyLink: "henkilötietopolitiikastamme",
    },
    pln_pl_pol: {
      market: "PL", lang: "pl", locale: "pl-PL", companyId: "VR8SLW", listId: "XFkwqv", optIn: "single",
      consent: "Zapisując się, wyrażasz zgodę na otrzymywanie od Westpack wiadomości e-mail z nowościami, aktualizacjami produktów i treściami promocyjnymi. W każdej chwili możesz zrezygnować z subskrypcji, korzystając z linku w naszych e-mailach. Dbamy o Twoje dane – przeczytaj więcej w naszej polityce prywatności.",
      privacyLink: "polityce prywatności",
    },
    eur_eu_rou: {
      market: "RO", lang: "ro", locale: "ro-RO", companyId: "SrHdJj", listId: "TBmyB7", optIn: "single",
      consent: "Prin abonare, ești de acord să primești e-mailuri de la Westpack cu știri, actualizări de produse și conținut promoțional. Te poți dezabona oricând folosind linkul din e-mailurile noastre. Avem grijă de datele tale – citește mai multe în politica noastră de confidențialitate.",
      privacyLink: "politica noastră de confidențialitate",
    },
    eur_eu_cze: {
      market: "CZ", lang: "cs", locale: "cs-CZ", companyId: "SxZudj", listId: "RgEnRn", optIn: "single",
      consent: "Přihlášením k odběru souhlasíte se zasíláním e-mailů od společnosti Westpack s novinkami, aktualizacemi produktů a propagačním obsahem. Odběr můžete kdykoliv zrušit pomocí odkazu v našich e-mailech. Vaše údaje pečlivě chráníme – více se dozvíte v našich zásadách ochrany osobních údajů.",
      privacyLink: "zásadách ochrany osobních údajů",
    },
    eur_eu_svk: {
      market: "SK", lang: "sk", locale: "sk-SK", companyId: "RECavC", listId: "SQgvnq", optIn: "single",
      consent: "Prihlásením sa súhlasíte so zasielaním e-mailov od spoločnosti Westpack s novinkami, produktovými aktualizáciami a propagačným obsahom. Z odberu sa môžete kedykoľvek odhlásiť pomocou odkazu v našich e-mailoch. O vaše údaje sa staráme s maximálnou starostlivosťou – viac informácií nájdete v našich zásadách ochrany osobných údajov.",
      privacyLink: "zásadách ochrany osobných údajov",
    },
    eur_eu_hun: {
      market: "HU", lang: "hu", locale: "hu-HU", companyId: "WME3XY", listId: "YjQqnR", optIn: "single",
      consent: "A feliratkozással hozzájárulsz ahhoz, hogy a Westpack e-maileket küldjön neked hírekkel, termékfrissítésekkel és promóciós tartalommal. Bármikor leiratkozhatsz az e-mailjeinkben található hivatkozás segítségével. Gondosan kezeljük adataidat – további információt az adatvédelmi szabályzatunkban találsz.",
      privacyLink: "adatvédelmi szabályzatunkban",
    },
  };

  // the jewellery-box category, whose path four stores translate (all 18 answered 200 on 2026-10-29)
  const BOXES_PATH = { usd_us_eng: "jewelry-boxes.html", eur_eu_ger: "schmuckschachteln.html", nok_no_nor: "smykkeesker.html", pln_pl_pol: "pudelka-na-bizuterie.html" };

  for (const [code, m] of Object.entries(MARKETS)) {
    m.storeCode = code;
    m.privacyUrl = privacy(code);
    m.storeUrl = store(code);
    m.boxesUrl = store(code) + (BOXES_PATH[code] || "jewellery-boxes.html");
    // which experiences may run, and with what share of new visitors; an A/B test is a change here, not in code
    m.concepts = m.concepts || { "logo-studio": 1, "swipe-match": 1, "pack-and-ship": 1 };
    // a market with enabled: false gets nothing; switch a market off here rather than in the store
    if (m.enabled === undefined) m.enabled = true;
  }

  // The preview and every automated test subscribe here, never to a real newsletter list: a list made for the
  // purpose in the DK account (2026-10-28), single opt-in, with no flow attached.
  const TEST_TARGET = { companyId: "VRPp5S", listId: "WUDjfX", name: "TEST - Signup Lab (preview only)" };

  // Stores where the experience runs by itself whatever LIVE says, exactly as it will on the live stores, except that
  // every signup goes to TEST_TARGET, tracking is marked test and links stay on that host. Wexo's staging store, behind
  // basic auth, where the user tests the whole thing before live (2026-10-30).
  const STAGING_HOSTS = ["westpack-staging.wexohosting.com"];

  const api = { LIVE, MARKETS, TEST_TARGET, STAGING_HOSTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WestpackSignupMarkets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
