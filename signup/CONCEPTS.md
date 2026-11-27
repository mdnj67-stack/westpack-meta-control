# Signup Lab – koncepter, vurdering og valg

Skrevet 2026-10-29. Ti grundlæggende forskellige interaktionsformer, vurderet efter briefens syv kriterier.
De tre valgte blev bygget færdigt (se `README.md`); Æske-match blev fjernet igen 2026-11-27 efter ønske, så
Logo-studiet og Pakket & sendt er tilbage.

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

**2 Æske-match – det tredje, reelt forskellige (fjernet 2026-11-27).** Swipe er den mest mobil-native interaktion, der findes,
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

## Nytårsudsalg (2026-11-27)

Brugerens idé: "Tilmeld dig og få besked når nytårsudsalget starter direkte i din indbakke ... sådan 10. dec agtigt, når
vi lige er totalt ovre det her bf" – som en selvstændig oplevelse ("en specifik og separat"). Kode:
`concepts/new-year-sale.js/.css`, preview: "New Year sale" i Lab'ens Preview eller `?wps=new-year-sale` på en butik.

- **Ét løfte, sagt ligeud:** "Få besked, når nytårsudsalget starter – direkte i din indbakke." Første billede er
  overskriften, e-mailfeltet, knappen og butikkens egen samtykketekst – intet før e-mailen. Knappen siger stadig
  "Tilmeld nyhedsbrevet": det er nyhedsbrevet, de siger ja til.
- **Billedet er løftet:** en indbakke, hvor mailen "Nytårsudsalget er startet" lander øverst, med det ærlige preview
  "Varer, der udgår, er sat ned – så længe lager haves." Efter tilmeldingen: "Vi skriver, når nytårsudsalget starter."
- **Aldrig "eksklusivt", "først", "før alle andre", "VIP" eller "early access"** (brugeren: "vi ikke siger eksklusivt
  nytår på email for det er det ikke"). Udsalget ligger i butikken for alle; mailen siger bare, hvornår det starter. En
  test fejler, hvis et af de 17 sprog siger det.
- **Den kan ikke stå forkert:** live kører den kun 1. november – 3. januar (`CONCEPT_SEASONS` i `core/rules.js`). Står
  Control stadig på den 4. januar, viser butikkerne Logo-studiet af sig selv, for "når det starter" er ikke sandt, når
  det er startet. Preview viser den alle dage.
- **Udtrykket** (brugeren: "lidt mere lækker, lidt mere nytår ... uden at stikke totalt ud"): butikkens egen forside er en
  mørkegrøn pose med guldfolie ved siden af en cremefarvet, så paletten er den samme – en mørkegrøn nat på billedsiden,
  creme på formularsiden. Nytåret ligger kun i billedet: det kommende år i guldfolie (Westpack trykker i folie) med et lys,
  der glider over, tynde guldstråler, der blusser op og falmer, og langsom konfetti i guld, creme og lidt af butikkens
  rød. På en computer lander mailen under årstallet. Formularsiden er rolig med én guldstjerne ved overskriften. Kun
  transforms; ingen lysbevægelse på telefon, intet der bevæger sig ved "reduceret bevægelse". Årstallet er det næste
  nytår (november–december: næste år).
- Højst 72 % af en 360×640-skærm i det længste sprog; emnelinjen i indbakken klippes aldrig.
- Teksterne er gpt-5.6's, ingen modersmålslæsning endnu.
