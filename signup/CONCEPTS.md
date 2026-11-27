# Signup Lab – koncepter, vurdering og valg

Skrevet 2026-10-29. Ti grundlæggende forskellige interaktionsformer, vurderet efter briefens syv kriterier.
De tre valgte er bygget færdigt (se `README.md`).

## Det vi vidste på forhånd (Westpacks egne tal)

- Popups konverterer **0,2–0,9 %** af dem, der ser dem. "Always on sale"-flyouten 1,7–2,2 % (med tilbud).
- Den gamle **quiz-popup gav de bedste abonnenter** (9 % købte inden for et år mod 6 %; 11 % afmeldte inden for
  90 dage mod 18 %), men konverterede kun **0,46 %**.
- **The Insert** (æske, der åbnes i tre trin) viste prisen for et klik foran e-mailen: kun **4–7 %** trykkede
  "åbn æsken". Uden for Frankrig lå den på niveau med Kick-off (−1 %, interval −29 % til +37 %).

Konsekvensen for designet: **oplevelsen skal starte i første billede** (ingen "start"-knap), resultatet vises
**før** der bedes om noget, og e-mailen skal stå lige ved siden af toppen af nysgerrigheden. Vild interaktion,
der kommer foran værdien, giver færre tilmeldinger, ikke flere.

## De ti koncepter

| # | Koncept | Interaktion | Kort |
|---|---|---|---|
| 1 | **Logo-studiet** ("Folieprøven") | Skab | Skriv dit brandnavn, se det i guld/sølv/rosa/old rose/hvid/sort på et rigtigt Westpack-låg – live, lagt lige på låget i dets eget perspektiv. |
| 2 | **Æske-match** | Swipe | Tinder for emballage: seks rigtige æsker, hjerte eller nej tak, og ud kommer en emballageprofil i procent. |
| 3 | **Pakket & sendt** | Formularen *er* oplevelsen | Forsendelsesmærkatet på en rigtig postæske printer din adresse, mens du skriver; tilmelding = stempel, tape, afsendt. |
| 4 | Æsketypen | Quiz | Tre billedspørgsmål om dit brand, et lidt absurd personlighedsresultat med en rigtig æske. |
| 5 | Unboxing | Åbn | En æske, man selv løfter låget af med fingeren, og som afslører nyhedsbrevet. |
| 6 | Brand vibe check | Moodboard | Vælg tre billeder, der ligner dit brand; få emballage, der matcher. |
| 7 | Æsken der taler | Karakter | En smykkeæske, hvis låg bevæger sig som en mund, og som kommenterer, at den er en popup. |
| 8 | Gæt finishen | Visuel udfordring | Ekstreme nærbilleder af folie, velour og karton – gæt materialet, se hele æsken. |
| 9 | Live fra produktionen | Skrab/afslør | Visk "dug" af billeder og afslør rigtige kunders logo-æsker én efter én. |
| 10 | Smykkekast | Mini-spil | Fang faldende smykker i den rigtige æske på 20 sekunder; få en titel. |

## Vurdering (1–5, 5 er bedst)

| # | Koncept | Effekt på relevante tilmeldinger | Forstås hurtigt | Originalitet / wow | Relevans for B2B-kunder | Mobil | Gennemførlighed | Kan testes og optimeres | **Sum** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Logo-studiet | 4 | 5 | 5 | 5 | 4 | 4 | 4 | **31** |
| 3 | Pakket & sendt | 4 | 5 | 4 | 3 | 5 | 5 | 5 | **31** |
| 2 | Æske-match | 3 | 5 | 4 | 4 | 5 | 4 | 5 | **30** |
| 4 | Æsketypen | 3 | 3 | 3 | 4 | 4 | 4 | 4 | 25 |
| 9 | Live fra produktionen | 3 | 4 | 4 | 4 | 4 | 3 | 3 | 25 |
| 6 | Brand vibe check | 3 | 3 | 3 | 4 | 3 | 4 | 4 | 24 |
| 7 | Æsken der taler | 2 | 4 | 4 | 2 | 4 | 4 | 3 | 23 |
| 5 | Unboxing | 2 | 4 | 3 | 3 | 4 | 4 | 3 | 23 |
| 8 | Gæt finishen | 2 | 3 | 4 | 3 | 4 | 4 | 3 | 23 |
| 10 | Smykkekast | 1 | 4 | 5 | 1 | 3 | 3 | 2 | 19 |

## Hvorfor de tre

**1 Logo-studiet – det primære koncept.** Logotryk er kerneforretningen, og intet er mere relevant for et
smykkebrand end at se sit eget navn i guld på en rigtig æske. Det forstås på et sekund ("Skriv dit brandnavn"),
resultatet er personligt og vises uden e-mail, og navnet gemmes som `organization` på profilen, så den, der
tilmelder sig, er en kvalificeret B2B-kontakt. Lågene er Westpacks egne nærbilleder med demo-trykket fjernet, og
finishes er præcis dem, logotryk-siden lister. Risiko: to handlinger før e-mail (skriv, "Det ser godt ud").
Den er holdt så lille som muligt.

**3 Pakket & sendt – det radikale alternativ.** Briefens eget spørgsmål: konverterer en kort, stærk oplevelse
bedre end interaktion først? Her er intet trin før e-mailfeltet; selve tilmeldingen er belønningen (stempel,
tape, poststempel med dagens dato). Den tester hypotesen "friktion koster mere end wow tjener" direkte. Mindst
relevant som indhold, men den mest ærlige test af formen.

**2 Æske-match – det tredje, reelt forskellige.** Swipe er den mest mobil-native interaktion, der findes,
viser seks rigtige æsker (aktiv brug af biblioteket) og giver en profil, der gemmes på profilen
(`wp_style_profile`, `wp_liked_boxes`) til senere, relevante mails. Den ligger tættest på quizzen, som gav de
bedste abonnenter, men med ét tryk pr. kort i stedet for spørgsmål.

**Fravalgt:** Æsketypen (4) overlapper W44-mailen "Æsketype-testen" og quizzen, der konverterede 0,46 %.
Unboxing (5) er i praksis The Insert, og den er målt. Vibe check (6) er et langsommere Æske-match. Æsken der
taler (7) og Gæt finishen (8) har humor, men ingen værdi for den besøgende. "Live fra produktionen" (9) er
stærkt bevis, men ikke personligt – det er i stedet blevet bevis-striben i Logo-studiet. Smykkekast (10) har
størst wow og mindst relevans: et spil, der lærer folk at fange smykker, sælger ikke emballage.

## Anbefaling

- **Mest kommercielt:** Logo-studiet. Det sælger kerneydelsen og kvalificerer kontakten.
- **Størst wow:** Logo-studiet – dit eget navn i folie på et rigtigt låg er det, folk vil vise kollegaen.
- **Test først:** alle tre samtidigt, ligeligt fordelt (det er standardopsætningen). Hvis trafikken er for lille
  til tre arme, så Logo-studiet mod Pakket & sendt: de to står for de to modsatte hypoteser (personlig skabelse
  mod nul friktion), og svaret fortæller, hvilken vej næste koncept skal gå.
- Forvent ærligt, at Pakket & sendt giver flest tilmeldinger pr. visning og Logo-studiet de mest relevante. Det
  er derfor, målingen også følger kvaliteten (se README, "A/B-test").

## Koncept 4: Direkte (2026-11-27)

Bestilt som "en ny sign-up idé/koncept, som virkeligt er hardcore med permission indsamling". Kode:
`concepts/direct.js/.css`, preview: `?wps=direct` på en butik eller "Direkte" i preview-værktøjet. **Ikke live nogen
steder**: `CURRENT` er stadig Logo-studiet, og Control er ikke rørt.

### Hvad tallene sagde

Logo-studiet live i CZ og IT, 19.–27. november: 888 visninger, 663 åbnede, **407 trykkede luk i første billede**, 43
skrev et navn, 27 nåede nogensinde e-mailfeltet, 8 tilmeldte sig (0,9 % pr. visning). The Insert ligger på samme niveau
(~0,8 % pr. viser). Alt, der står foran e-mailfeltet, koster folk – også når det er smukt.

### Princippet

Hardcore på **hvor tidligt, hvor tit og hvor let** spørgsmålet stilles – aldrig på om svaret er frivilligt.

1. **E-mailen står i første billede.** Grund, felt, knap og butikkens egen samtykkesætning – intet før. På en computer
   står markøren allerede i feltet.
2. **Grunden er konkret og følger kalenderen** (`rules.directSeason`): resten af året "Nye æsker, frister og
   nytårsudsalget. Vi siger til i god tid." Ingen rabat, ingen procent, ingen dato.
3. **Nytårsudsalget har sin egen version, 10. december – 3. januar** (brugeren 27/11: "sådan 10. dec agtigt. når vi lige
   er totalt ovre det her bf"): "Få besked, når nytårsudsalget starter – direkte i din indbakke." Billedvæggen bliver til
   en indbakke, hvor mailen "Nytårsudsalget er startet" lander øverst, med det ærlige preview "Varer, der udgår, er sat
   ned – så længe lager haves." Efter tilmeldingen: "Vi skriver, når nytårsudsalget starter." Pillen siger "Få besked,
   når udsalget starter". Den stopper 3. januar, fordi "når det starter" ikke er sandt, når det er startet (første mail
   4/1). Knappen siger stadig "Tilmeld nyhedsbrevet" – det er nyhedsbrevet, de siger ja til.
   **Aldrig "eksklusivt", "først", "før alle andre", "VIP" eller "early access"** (brugeren: "vi ikke siger eksklusivt
   nytår på email for det er det ikke"): udsalget ligger i butikken for alle, mailen siger bare, hvornår det starter. En
   test fejler, hvis et af de 17 sprog siger det, og oversættelsesværktøjet afviser det.
4. **Rigtigt bevis:** seks kunders egne logo-æsker som billedvæg, og "Over 20.000 i Europa og USA får allerede
   nyhedsbrevet" (25.239 på de 18 lister 24/11; "over 20.000" holder med god margin).
5. **Et "nej tak" er ikke slutningen.** Lukkes popuppen, bliver en lille pille stående nederst på siden – på denne og de
   næste sider – ét tryk fra feltet (`rules.dockAllowed`). Popuppen selv holder samme pause som alle andre (14/45/120
   dage); pillen har sit eget kryds (14 dage). Den løfter sig over butikkens egne faste elementer (cookie-knap, chat,
   en klæbende kurv-bjælke).
6. **Det, vi vil vide, kommer efter tilladelsen, aldrig før:** "Hvad sælger I?" med seks svar på ét tryk, frivilligt,
   sendt som sin egen hændelse ("Signup Lab Answered", `wp_business_type`). Et oversprunget spørgsmål koster intet.

Det, den ikke gør: intet forudkrydset, intet samtykke i et klik på noget andet, ingen cookie-mur eller mur foran
indholdet, altid et synligt kryds, ingen skyld i et nej, og ingen e-mail opsamlet, før knappen er trykket.

På en telefon er den et normalt popup-kort midt på skærmen: højst 73 % af en 360×640-skærm på det længste sprog, 67 % på
en iPhone 13, i begge versioner – intet skal scrolles, og mailens emnelinje klippes aldrig.

### Sådan bliver den målt

- Primært: bekræftede tilmeldinger pr. **selvåbnet** visning (trigger `delay`/`exit`) – tilmeldinger via pillen tæller
  med i tælleren, ikke i nævneren, ellers straffes pillen for at virke. `wp_signup_trigger` på profilen siger, hvor
  mange der kom ind via pillen; `wp_signup_season` hvilken grund de så.
- Kvalitet bagefter som altid: afmeldinger inden for 90 dage og køb inden for et år, segmenteret på `wp_signup_concept`.

### Det næste – ikke bygget, kræver et ja

**Kvitteringssiden er den største permission-mulighed Westpack har, og den står tom.** Checkout-tilmeldingen gav 7,7 % af
ordrerne frem til 30/6 (gæster ~43 %), faldt til 0,5 %, da gæstecheckout forsvandt 1/7, og er ~0 uden for DK siden 26/10
(se `klaviyo-checkout-optin-break`). Checkout-tilmeldte er de bedste abonnenter: 23 % af de nye køber inden for et år mod
7,2 % fra popups. Der kommer ~190 ordrer om dagen; siger 5–10 % ja på kvitteringssiden, er det 10–19 tilmeldinger om dagen
– på niveau med alle popups i alle 18 markeder tilsammen (The Insert: ~24/dag). Scriptet sidder allerede på siden; det
kræver en regel for `/checkout/onepage/success`, et kort uden pause og at det ikke spørger dem, der krydsede af i checkout
(dataLayer `newsletter_consent_updated`). Det er et skridt ind på købsflowet og ligger ved siden af MCB's rettelse af
checkout-boksen, så det er en beslutning, ikke en kodeændring.
