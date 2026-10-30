# Westpack Signup Lab

Tre tilmeldingsoplevelser til Westpacks nyhedsbrev, bygget som ét system, der kører på alle 18 webshops via én
script-linje og tilmelder direkte i Klaviyo med korrekt samtykke. Bygget 2026-10-28/29.

- **Preview (desktop og mobil):** https://project-4fcxa.vercel.app/signup/preview/
- **På en rigtig butik:** `https://www.westpack.com/dkk_dk_den/?wps=preview` (når tagget er sat ind)
- **Implementering:** [`IMPLEMENTERING.md`](IMPLEMENTERING.md) – tagget, at tænde, at rulle tilbage
- **Koncepter og valg:** [`CONCEPTS.md`](CONCEPTS.md)

| Oplevelse | Fil | Idé |
|---|---|---|
| Logo-studiet | `concepts/logo-studio.js/.css` | Dit brandnavn – eller dit eget logo – i folie på seks rigtige Westpack-låg, live, med lys der følger musen/fingeren. Primært koncept. |
| Æske-match | `concepts/swipe-match.js/.css` | Swipe seks rigtige æsker, få en emballageprofil. |
| Pakket & sendt | `concepts/pack-and-ship.js/.css` | Formularen er oplevelsen: adressen printes på et forsendelsesmærkat. |

## Sådan virker det

```
<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>
```

0. **Hovedkontakten** er `LIVE` i `core/markets.js`. Står den på `false`, gør tagget på butikken intet – undtagen
   når adressen har `?wps=preview` (eller `?wps=<oplevelse>`): så åbner oplevelsen med det samme i testtilstand
   (tilmelding kun til testlisten). Sådan kan tagget sættes ind før lanceringen og tjekkes på den rigtige butik.
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
| `../tests/signup-lab.test.js` | 22 unit-tests |
| `../tools/signup/go-live.js` | Status, og Klaviyo-halvdelen af at tænde: sluk/genudgiv The Insert-popupperne |
| `../tools/signup/store-check.js` | Kører det hele på de 18 rigtige butikker som en besøgende og tjekker det |

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

## Logo-studiet: trykket

- **Seks rigtige låg:** mat sort plast, creme soft touch, sort med guldkant, støvet grøn karton, lysebrun soft touch
  og hvid karton i hør-look (materialer læst i sitets produktdata). Swipe eller thumbnails skifter låg; hvert låg viser sin
  egen naturlige folie, til den besøgende vælger en.
- **Folierne er dem, logotryk-siden lister:** guld, sølv, rosaguld, old rose, hvid og sort. Blindpræg er taget ud (2026-10-29).
- **Trykket tegnes som SVG med rigtigt lys:** en spejlende glans fra en lyskilde, der følger musen eller fingeren
  (og driver langsomt af sig selv), fin foliestruktur, og trykket presset ned i overfladen – skygge på den ene
  indervæg, lys på den anden.
- **Trykket ligger lige på låget:** hvert låg er målt på sit foto (`node tools/signup/lid-geometry.js refine`).
  Værktøjet finder lågets fire kanter på pixlen og lægger trykket på lågets flade med én perspektivtransformation,
  så det følger kanterne og forkortes præcis som kameraet så låget. Størrelsen er sitets maksimale logostørrelse
  (45×45–50×50 mm på et 60–65 mm låg), og et kvadratisk logo i fuld størrelse når aldrig ud over billedet (testet).
- **Trykket er lige så lyst som rigtig folie på netop det foto:** Westpacks egne demo-tryk blev målt i
  originalfotoene (fx guld på Seville med median 108, guld på det hvide låg 98, sølv på London 136), og hver folie
  er kalibreret mod dem. Lågets eget lysfald over trykfladen og – på struktureret, hør- og velourkarton – kartonens
  struktur går igennem i folien.
- **Kontrol:** `node tools/signup/lid-geometry.js review <mappe>` tegner de målte kanter, gitteret og en prøvetekst
  på hvert låg.
- **Dit eget logo:** PNG, JPG eller SVG gøres til en én-farvet foliemaske i browseren (folie trykkes i én farve).
  Filen forlader aldrig browseren; kun `wp_logo_uploaded: yes` følger med en tilmelding.
- **Lup** over æsken på desktop, **"Se trykket tæt på"** (zoom) overalt.
- **På mobil** sidder navnefeltet lige under æsken; mens man skriver, ligger æsken fast øverst over tastaturet, og
  når man scroller ned til folierne, svæver en lille levende kopi af æsken i hjørnet.

### Designet (2026-10-30)

- **Æsken er hele scenen.** På desktop fylder lågfotoet en kvadratisk scene så stor, som skærmen tillader (op til
  780 px), med lågets navn, zoom, thumbnails og lys-hint lagt nederst i billedet. Valgene står i et smalt panel ved
  siden af. På mobil går æsken fra kant til kant.
- **Åbningen:** kameraet glider ind på låget, og det første tryk sættes.
- **Trykket sættes, hver gang noget ændres:** et varmt glimt over trykket, folien sætter sig i låget, og lyset glider
  én gang hen over det, når man holder en pause i skrivningen, skifter folie, skrift eller låg, eller lægger et logo
  ind. Lyset glider ikke, mens den besøgende selv holder det med musen eller fingeren.
- **Folierne er metalmønter** (guld, sølv, rosaguld, old rose, hvid, sort), og **skrifterne viser den besøgendes
  eget navn** sat i hver skrift, skrumpet til kortet i stedet for at blive klippet.
- **Resultatet er en kollektion:** navnet eller logoet står på alle seks låg på én gang, det valgte markeret, og
  kortene glider ind et ad gangen.
- **Et langt navn passer på låget, uanset hvor lille det tegnes.** Bogstavafstanden følger skriftstørrelsen, og et
  låg, der var skjult, mens navnet blev skrevet (thumbnails på mobil og kollektionen), måles igen, når det vises
  (`tools/signup/qa.js` tjekker det med et navn på 27 tegn).
- **Reduceret bevægelse** springer kamera, glimt og lysglid over; trykket står færdigt med det samme.

## Billeder

Alle billeder er Westpacks egne fra Asana-biblioteket, behandlet af `node tools/signup/build-assets.js`:
originalen hentes gennem produktionen, beskæres og komprimeres til WebP (4–56 KB) i `assets/`, og seks
låg får Westpacks demo-tryk fjernet, så den besøgendes navn kan sættes i stedet (`tools/signup/clean-plate.html`):
de tre med tyndt tryk renset morfologisk, de tre med tykt tryk (Frankfurt, Seoul, Madrid) udfyldt harmonisk med
lågets egen struktur lagt tilbage. Frankfurt er det hvide låg fra "Shipping Smykkeæsker" (Reshoot-10), fordi alle
fire kanter er synlige der; det sorte nærbillede havde ingen kanter at måle perspektivet på. To af kategori-billederne
har et indstik med "MADE FROM RECYCLED PLASTIC"; beskæringerne holder det ude, fordi ingen kreativ må vise en miljøpåstand. Intet peger på Asana, hvis links udløber efter timer.
Kundefotos er fra "Kundebilleder Uge 40" (frigivet til fri brug 2026-10-07); billedet med Deutsche Bank/Equinix
er udeladt.

Billederne caches i 30 dage under samme navn (`vercel.json`), så en browser blev ved med at vise et billede, der var
blevet erstattet. Derfor bærer hver billedadresse en version (`ASSET_VERSION` i `westpack-signup.js`), og
`build-assets.js` sætter en ny, hver gang det skriver billeder. Ret den i hånden, hvis du udskifter et billede uden
scriptet.

## Klaviyos bot-beskyttelse (vigtigt)

Den 29. oktober accepterede Klaviyo tre test-tilmeldinger og satte dem korrekt på testlisten med samtykke og
kilde. Gentagne automatiserede tilmeldinger fra samme maskine minutter senere blev også accepteret (202), men
Klaviyo undertrykte dem et sekund efter med "Manually Suppressed from Email Marketing", `method: BOT_PROTECTION`.
Browseren kan ikke se det. Klaviyo dokumenterer ikke funktionen; et community-indlæg fra juni 2026 beskriver den
som IP-baseret. Rigtige mennesker, der tilmelder sig én gang, forventes at gå igennem, men det skal **måles i
de første dage**: `?action=confirmed` viser bekræftede og bot-blokerede pr. oplevelse. Er bot-andelen for rigtig
trafik ikke tæt på nul, skal Klaviyo support kontaktes, før testen fortsætter.

## Til produktion

Se [`IMPLEMENTERING.md`](IMPLEMENTERING.md). Kort: ét Custom HTML-tag i Tag Manager GTM-5QRXWTJ (alle 18
butikker), som kan sættes ind nu, fordi det intet gør, før `LIVE` står på `true`; at tænde er `LIVE = true`,
deploy og `node tools/signup/go-live.js unpublish --apply` i de samme minutter. Rul tilbage med `LIVE = false` og
`go-live.js republish --apply`.

## Butikstjek (2026-10-29)

`node tools/signup/store-check.js <mappe> --simulate-live` på alle 18 butikker, desktop, og `--mobile` på DK, UK, US,
DE, FR og PL, med tagget lagt ind som Tag Manager vil gøre det og cookie-banneret besvaret:

- **Kontakten slukket:** tagget er tavst på alle 18.
- **`?wps=logo-studio`:** åbner på alle 18, med rigtigt marked, butikkens sprog og butikkens egen samtykketekst.
- **Kontakten tændt** (kun i testbrowseren): dialogen kommer af sig selv på forsiden på desktop, på mobil kommer det
  lille kort; intet i kurven; ingen JavaScript-fejl fra os.
- **The Insert-popuppen fra Klaviyo vises i dag på alle butikker.** Det er derfor, den skal slukkes i de samme
  minutter, som vi tænder (`go-live.js unpublish --apply`).

Samme kommando uden `--simulate-live` tjekker butikkerne efter lanceringen: med `LIVE = true` i produktion
forventer den, at oplevelsen kommer af sig selv.

## Verificeret – og hvad der ikke er

Verificeret 2026-10-29:
- Rigtig tilmelding i Klaviyo fra den rigtige runtime i en rigtig browser, alle tre oplevelser, til testlisten
  "TEST - Signup Lab (preview only)" (`WUDjfX`, DK-kontoen): profil på listen, `SUBSCRIBED`, kilde
  "Westpack Signup Lab · <oplevelse>", locale, alle profilfelter, `organization` fra Logo-studiet og
  tidslinje-eventet. Testprofilerne er slettet igen.
- Ugyldig e-mail afvises i browseren uden kald til Klaviyo; dobbeltklik giver ét kald.
- 67 browser-checks (`tools/signup/qa.js`), herunder at folielyset følger musen, at luppen åbner, at et uploadet logo bliver en foliemaske, og at en ikke-billedfil får en klar besked: 360×640, alle 17 sprog uden vandret overflow på mobil, tastatur (fokus inde,
  Tab bliver i dialogen, Escape lukker), reduceret bevægelse, langsom 3G (åbner stylet efter 5 s), manglende
  billeder, double opt-in-tekst, tracking uden persondata, ingen JavaScript-fejl.
- 22 unit-tests (`node --test tests/signup-lab.test.js`).
- **På de 18 rigtige butikker** (`tools/signup/store-check.js`, med tagget lagt ind som Tag Manager vil gøre det):
  tagget er tavst med kontakten slukket, `?wps=preview` åbner på butikkens sprog med dens egen samtykketekst, og
  med kontakten tændt (kun i testbrowseren) kommer oplevelsen af sig selv på forsiden og aldrig i kurven. Se
  resultatet i "Butikstjek" nedenfor.
- **Tre browsermotorer:** Chromium og Firefox tegner trykket inden for 0,06 % af det målte låg. WebKit til Windows
  tegner perspektivet fladt; siden opdager det og bruger den bedste flade tilnærmelse.

Ikke verificeret:
- **Live på westpack.com** – kræver script-linjen (adgang mangler).
- **Double opt-in end-to-end** – ingen liste er double opt-in; UI-teksten er testet med en simuleret tilmelding.
- **Skærmlæser** – semantik og fokus er bygget og testet med tastatur, men ikke med VoiceOver/TalkBack.
- **Eksisterende abonnenter:** Klaviyos client-API svarer ens for nye og eksisterende (det kan ikke skelnes i
  browseren); et eksisterende samtykke bevares af Klaviyo. Besøgende fra mails og genkendte besøgende ser
  oplevelsen slet ikke.
- **De 15 transcreerede sprog** er korrekturlæst af en uafhængig modelgennemgang (56 rettelser), men ikke læst af
  nogen med sproget som modersmål.
- **Safari på en rigtig iPhone.**
