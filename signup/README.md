# Westpack Signup Lab

Tre tilmeldingsoplevelser til Westpacks nyhedsbrev, bygget som ét system, der kører på alle 18 webshops via én
script-linje og tilmelder direkte i Klaviyo med korrekt samtykke. Bygget 2026-10-28/29.

- **Preview (desktop og mobil):** https://project-4fcxa.vercel.app/signup/preview/
- **Koncepter og valg:** [`CONCEPTS.md`](CONCEPTS.md)

| Oplevelse | Fil | Idé |
|---|---|---|
| Logo-studiet | `concepts/logo-studio.js/.css` | Dit brandnavn i folie på et rigtigt Westpack-låg, live. Primært koncept. |
| Æske-match | `concepts/swipe-match.js/.css` | Swipe seks rigtige æsker, få en emballageprofil. |
| Pakket & sendt | `concepts/pack-and-ship.js/.css` | Formularen er oplevelsen: adressen printes på et forsendelsesmærkat. |

## Sådan virker det

```
<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>
```

1. `westpack-signup.js` læser butikskoden i stien (`/eur_eu_ger/...` → DE) og henter `core/markets.js`,
   `core/rules.js` og kun det ene sprog, der skal bruges (`core/copy/de.js`).
2. `core/rules.js` afgør, om den besøgende må se noget (se "Hvem ser hvad"), og tildeler én af de tre
   oplevelser til A/B-testen. Den besøgende beholder sin oplevelse.
3. Oplevelsen hentes først, når den skal vises (JS, CSS, billeder, skrifter), og kører i en **shadow root**:
   butikkens CSS kan ikke ødelægge den, og dens CSS kan ikke ødelægge butikken.
4. Tilmelding går direkte til Klaviyos **client subscription API** med markedets *offentlige* nøgle og
   nyhedsbrevsliste. Ingen hemmelige nøgler i browseren. Samme API, som Klaviyos egne formularer bruger.
5. Tracking går til appens endpoint `/api/signup/track` som optællinger – aldrig en person.

Systemet afhænger **ikke** af Klaviyos onsite-script (det, der forsvandt fra butikkerne 26. oktober).
Findes klaviyo.js på siden, bruges det kun til at lade genkendte besøgende være i fred.

### Filer

| Sti | Hvad |
|---|---|
| `westpack-signup.js` | Runtime: trigger, frekvens, A/B, skal, fokus, tilmelding, tracking |
| `westpack-signup.css` | Skallen og den fælles formular (tokens, bundark på mobil, kort på desktop) |
| `core/markets.js` | Alle 18 butikker: Klaviyo-konto (offentlig nøgle), liste, opt-in, samtykketekst, links, A/B-vægte |
| `core/rules.js` | Reglerne uden DOM: hvem, hvornår, hvilken, hvad sendes til Klaviyo og til tracking. Testet i Node. |
| `core/copy/<sprog>.js` | Al tekst. `da` og `en` er master; 15 sprog er transcreeret (se "Sprog") |
| `concepts/` | De tre oplevelser |
| `assets/` | Billeder (WebP) og selvhostede skrifter |
| `preview/` | Preview-miljøet og en butiksside at køre det på |
| `../api/signup/track.js`, `../server/signup/` | Tracking-endpoint, lager og afstemning mod Klaviyo |
| `../tools/signup/` | Asset-pipeline, skrifter, transcreation, skærmbilleder, QA og Klaviyo-e2e |
| `../tests/signup-lab.test.js` | 18 unit-tests |

## Hvem ser hvad, og hvornår

- **Desktop:** dialogen åbner efter 11 sekunder (6 på side to) eller når musen forlader vinduet.
- **Mobil og tablet:** ingen automatisk fuldskærm. Et lille kort glider ind efter 7 sekunder eller 30 % scroll;
  oplevelsen åbner kun, hvis man trykker på det.
- **Aldrig:** checkout, kurv, konto, nyhedsbrevssiden, udsalg og outlet (i alle butikkers sprog), eller mens
  cookie-banneret står åbent (den venter på valget).
- **Aldrig for:** dem, der er tilmeldt via oplevelsen; dem, der kommer fra en af vores mails (`_kx`,
  `utm_medium=email`; 180 dage); besøgende, Klaviyo genkender.
- **Én gang pr. besøg.** Lukket én gang: pause i 14 dage, to gange: 45 dage, tre gange: 120 dage. Peek-kortet
  lukket: 7 dage.
- Hukommelsen ligger i `localStorage`/`sessionStorage` uden identifikatorer (kun datoer og den tildelte
  oplevelse). Ingen cookies.

## Samtykke og GDPR

- Samtykketeksten er **butikkens egen sætning fra dens /newsletter-signup-side**, ordret, med link til butikkens
  privatlivsside. Knappen siger altid "nyhedsbrev". Intet er forudkrydset; klik i quiz, swipe eller logo-studie
  er aldrig samtykke – kun e-mail + knappen ved siden af samtykketeksten.
- Klaviyo registrerer samtykket som `SUBSCRIBED` med `custom_method_detail: "Westpack Signup Lab · <oplevelse>"`,
  tidspunkt og metode. Profilen får desuden `wp_consent_text` (præcis den tekst, der blev vist) og
  `wp_consent_page` (siden, uden query-streng).
- **Double opt-in:** alle 18 lister er single opt-in i dag (læst i Klaviyo 2026-10-28). Skiftes en liste til
  double opt-in, sender Klaviyo bekræftelsesmailen selv; sæt `optIn: "double"` for markedet i `core/markets.js`,
  så takketeksten beder om bekræftelse (testet). **Anbefaling: Tyskland bør køre double opt-in** (tysk praksis
  efter UWG § 7); det kræver en tysk bekræftelsesmail i Klaviyo og er en beslutning, ikke en kodeændring.
- Skrifterne er selvhostede: Google Fonts fra Googles servere sender besøgendes IP til Google (LG München I, 2022).
- Tracking indeholder aldrig e-mail eller navn: både browseren og serveren afviser enhver værdi med "@", og
  kun en fast liste af felter gemmes (testet).

## Tracking og måling

Pr. visning (en oplevelse, der blev vist) gemmes én post: marked, sprog, oplevelse, enhed, trigger, udfald og
trinnene med tid (fx `peek_shown > open > name_typed > option_foil > result > email_focus > submit > subscribed`).

- **Tragt:** `GET /api/signup/track?action=report&env=live&from=2026-11-01` (log ind i appen først):
  visninger, åbninger, interaktion, e-mailfokus, indsendt, tilmeldt, lukket, fejl – pr. oplevelse, enhed og marked.
- **Hvad der faktisk kom ind i Klaviyo:** `GET /api/signup/track?action=confirmed&from=2026-11-01` sammenholder
  pr. marked og oplevelse: *indsendt* (eventet "Signup Lab Subscribed"), *bekræftet* (på nyhedsbrevslisten med
  Signup Lab som kilde) og *taget af bot-filteret*. Se "Klaviyos bot-beskyttelse" nedenfor – det er derfor, den
  findes.
- **I Klaviyo:** profilen får `wp_signup_concept`, `wp_signup_market` m.fl. og eventet "Signup Lab Subscribed",
  så flows og segmenter kan skelne. Logo-studiet gemmer `wp_brand_name` (og `organization`), folie, låg og skrift;
  Æske-match gemmer `wp_style_profile`, `wp_style_scores` og `wp_liked_boxes`.
- **dataLayer:** `wp_signup` (hvert trin) og `wp_signup_subscribed` uden persondata, klar til GA4, hvis nogen
  opsætter en trigger i Tag Manager.

## A/B-test

- Standard: de tre oplevelser ligeligt fordelt i alle markeder (`concepts` i `core/markets.js`). En vægt på 0
  slår en oplevelse fra; ændringer kræver ingen kode i oplevelserne.
- **Primært mål:** bekræftede tilmeldinger pr. visning, pr. oplevelse, alle markeder samlet. Visningen udløses af
  den samme trigger for alle tre, så sammenligningen er fair.
- **Hvor længe:** med ca. 0,4 % tilmelding pr. visning skal hver arm have omkring 50.000 visninger for at se en
  forskel på 30 % (80 % power). Ud fra Kick-off-popuppernes trafik (~6.500 visninger om dagen på tværs af
  markederne) er det **cirka fire uger** med tre arme; en forskel på 50 % kan ses efter cirka halvanden uge.
  Stop ikke tidligt på en flot første uge.
- **Værn:** lukkerate pr. trin, fejl, og andelen taget af bot-filteret. En arm med høj bot-andel er ikke en vinder.
- **Kvalitet bagefter:** segmentér på `wp_signup_concept` i Klaviyo og følg afmeldinger inden for 90 dage,
  bot-filtrerede klik og køb inden for et år (samme mål som tilmeldingskildeanalysen fra oktober 2026).

## Sprog

- `da` og `en` er skrevet til formålet; `en-US`, `de`, `fr`, `it`, `es`, `nl`, `pt`, `sv`, `nb`, `fi`, `pl`, `ro`,
  `cs`, `sk`, `hu` er **transcreeret** med gpt-5.6 af `tools/signup/transcreate.js` med hver butiks egne ord, egne
  løfter, tiltaleform og de faste copy-regler; nøgler og pladsholdere kontrolleres. Hver fil er mærket
  `needsNativeReview: true` – lad en, der har sproget som modersmål, læse den, før markedet går live, eller slå
  markedet fra med `enabled: false` indtil da.
- Ny tekst: ret `da.js`/`en.js` og kør `node tools/signup/transcreate.js` (eller kun `... de,fr`).
- Ingen synlig tekst står i oplevelsernes kode (testet).

## Billeder

Alle billeder er Westpacks egne fra Asana-biblioteket, behandlet af `node tools/signup/build-assets.js`:
originalen hentes gennem produktionen, beskæres og komprimeres til WebP (4–56 KB) i `assets/`, og to
nærbilleder af logotryk (London på creme, Seville på sort) får Westpacks demo-tryk fjernet, så den besøgendes
navn kan sættes i stedet (`tools/signup/clean-plate.html`). Intet peger på Asana, hvis links udløber efter timer.
Kundefotos er fra "Kundebilleder Uge 40" (frigivet til fri brug 2026-10-07); billedet med Deutsche Bank/Equinix
er udeladt.

## Klaviyos bot-beskyttelse (vigtigt)

Den 29. oktober accepterede Klaviyo tre test-tilmeldinger og satte dem korrekt på testlisten med samtykke og
kilde. Gentagne automatiserede tilmeldinger fra samme maskine minutter senere blev også accepteret (202), men
Klaviyo undertrykte dem et sekund efter med "Manually Suppressed from Email Marketing", `method: BOT_PROTECTION`.
Browseren kan ikke se det. Klaviyo dokumenterer ikke funktionen; et community-indlæg fra juni 2026 beskriver den
som IP-baseret. Rigtige mennesker, der tilmelder sig én gang, forventes at gå igennem, men det skal **måles i
de første dage**: `?action=confirmed` viser bekræftede og bot-blokerede pr. oplevelse. Er bot-andelen for rigtig
trafik ikke tæt på nul, skal Klaviyo support kontaktes, før testen fortsætter.

## Til produktion – implementeringsplan

1. **Godkendelse fra dig** (briefen: publicering til live trafik kræver godkendelse).
2. **Læs sprogene** for de markeder, der skal med først. Forslag: DK, UK, EU, US (master) + DE, FR, IT, NL.
   Slå de øvrige fra med `enabled: false`, til de er læst.
3. **Én linje på butikken** (se øverst), på alle sider i alle butikker – via Google Tag Manager (Custom HTML-tag,
   udløst på alle sider) eller i Magento-temaets footer. **Det kræver den adgang, vi ikke har**: den, der
   administrerer webshoppen eller dens Tag Manager. Linjen tilføjer kun; intet eksisterende ændres.
4. **Samtidig: sluk The Insert-popupperne i Klaviyo** (US, DE, NL, SE, FI, PL, SK, IT, UK, EU, FR m.fl.), ellers
   får besøgende to popups. Det kan gøres via Klaviyos API (`form-unpublish-jobs`).
5. **Første uge:** følg `?action=report` og `?action=confirmed` dagligt (bot-andel, fejl, lukninger pr. trin).
6. **Efter fire uger:** vælg vinder på bekræftede tilmeldinger pr. visning; følg kvaliteten i 90 dage.

Rul tilbage ved at fjerne linjen (eller sætte `enabled: false` for alle markeder og deploye).

## Verificeret – og hvad der ikke er

Verificeret 2026-10-29:
- Rigtig tilmelding i Klaviyo fra den rigtige runtime i en rigtig browser, alle tre oplevelser, til testlisten
  "TEST - Signup Lab (preview only)" (`WUDjfX`, DK-kontoen): profil på listen, `SUBSCRIBED`, kilde
  "Westpack Signup Lab · <oplevelse>", locale, alle profilfelter, `organization` fra Logo-studiet og
  tidslinje-eventet. Testprofilerne er slettet igen.
- Ugyldig e-mail afvises i browseren uden kald til Klaviyo; dobbeltklik giver ét kald.
- 27 browser-checks (`tools/signup/qa.js`): 360×640, fem sprog uden vandret overflow, tastatur (fokus inde,
  Tab bliver i dialogen, Escape lukker), reduceret bevægelse, langsom 3G (åbner stylet efter 5 s), manglende
  billeder, double opt-in-tekst, tracking uden persondata, ingen JavaScript-fejl.
- 18 unit-tests (`node --test tests/signup-lab.test.js`).

Ikke verificeret:
- **Live på westpack.com** – kræver script-linjen (adgang mangler).
- **Double opt-in end-to-end** – ingen liste er double opt-in; UI-teksten er testet med en simuleret tilmelding.
- **Skærmlæser** – semantik og fokus er bygget og testet med tastatur, men ikke med VoiceOver/TalkBack.
- **Eksisterende abonnenter:** Klaviyos client-API svarer ens for nye og eksisterende (det kan ikke skelnes i
  browseren); et eksisterende samtykke bevares af Klaviyo. Besøgende fra mails og genkendte besøgende ser
  oplevelsen slet ikke.
- **De 15 transcreerede sprog** er ikke læst af nogen med sproget som modersmål.
