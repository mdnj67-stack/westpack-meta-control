# Den store forsendelse – blogindlæg (W47)

Et blogindlæg om julepakning i postæsker: fem julelooks, en trin-for-trin-guide, en indkøbsliste til hvert look,
logotryk og alt det praktiske. Det er **landingssiden for W47-mailen "Den store forsendelse"**: mailens fem
look-felter åbner hvert sit look her, og linket under trinene åbner guiden med Guldstjerner.

Udtrykket er det samme som mailens: skandinavisk, creme og dæmpede farver, dyb grøn, Instrument Serif og Jost.

> **Status 10/11:** Kun dansk. Mads oversætter selv artiklen.

## Sådan lægger du indlægget op

Indlægget skal have **URL-nøglen `christmas-unboxing-guide-2026`**, altså `…/blog/christmas-unboxing-guide-2026`.
Den er ledig (tjekket 6/11 i DK, EU og DE). Mailens links går dertil, så den skal være præcis sådan.

1. Gå til indlæggene i Amasty Blog Pro i admin, og opret et nyt indlæg (Add New Post).
2. Udfyld felterne:
   - **Titel:** Den store forsendelse: 5 julelooks til postæsken
   - **URL-nøgle:** `christmas-unboxing-guide-2026`
   - **Kort beskrivelse (listen):** Fem julelooks til postæsken, fem trin til at pakke dem – og alt det praktiske om
     logotryk, prøver og frister.
   - **Meta title:** Den store forsendelse: 5 julelooks til postæsken | Westpack
   - **Meta description:** Fem julelooks til postæsken med trin for trin, indkøbslister og alt det praktiske om
     logotryk, prøver og frister til jul.
   - **Kategorier:** Forsendelsesemballage, Indpakning, Tips & Tricks
   - **Billede (listebillede):** `cover.jpg` fra denne mappe (1200 × 800)
3. Indhold: åbn **Page Builder** (Edit with Page Builder). Træk ét element af typen **HTML Code** (under Elements)
   ind. Klik i feltet, tryk **Ctrl+A** og **Delete**, så det er tomt, og sæt **hele** indholdet af
   `forsendelse-da.html` ind. Tilføj ikke andre elementer. Brug **ikke** den almindelige teksteditor (WYSIWYG): den
   fjerner `<script>` og `<style>`.
4. Vælg butikken (store view: DK), og gem.
5. Åbn indlægget på sitet, og tjek tre ting:
   - Øverst skifter de fem looks af sig selv, og knapperne under billedet skifter look.
   - I trin-for-trin kan du skifte til **Guldstjerner**, og billederne skifter med.
   - `…/blog/christmas-unboxing-guide-2026#look-03` lander på Guldstjerner.

Får du **"Please remove invalid characters"**, er der kommet tegn med i feltet, som databasen ikke kan gemme. Tøm
feltet helt, og sæt filen ind igen.

## Hvad der sker på siden

- **Toppen** viser de fem færdige looks, der skifter hvert fjerde sekund, til man vælger et selv. Baggrunden skifter
  farve med looket. "Se looket" hopper ned til lookets afsnit.
- **"Ikke i december."** Tre grunde til at gøre sig umage, skrevet som et svar på “Det er jo bare en postæske.”
- **Trin for trin** har fem trin med billede, tip og link. Man kan se dem med Rosa & guld eller Guldstjerner, bladre,
  swipe på telefonen eller trykke **Afspil**. Guiden spiller selv én gang, når den kommer til syne.
- **Fem looks** har hvert sit farvefelt med tre billeder, en kort tekst, en indkøbsliste med links og en knap.
  Smykkeæsken i hvert look er markeret med "gratis logotryk": Boston ECO, Melbourne ECO, Santorini ECO, Seoul ECO og
  Vienna. Det står på hver af deres produktsider (tjekket 6/11). Til sidst kommer "Mix dit eget".
- **Ikke kun til smykker** (tilføjet 10/11) svarer på “Postæsker? Vi sælger jo ikke smykker.” med "Det gør postæsken
  heller ikke." Der er to felter side om side. Det ene er en lille tegnet animation, hvor et duftlys, et tørklæde, en
  creme, en kop, solbriller, en dåbsske og til sidst en smykkeæske falder ned i en postæske efter tur, med navnet under.
  Det andet er Westpacks eget prøvetryk "FILLED WITH LOVE … and other cool stuff" (Content Library, "Digital print
  (postæsker)"). Derunder står ét faktum: postæskerne går fra 2,2 til 12,8 cm i højden og op til 40 cm i længden. Det er
  tjekket på kategorisiden 10/11, og æsker på restsalg er ikke talt med (XXL 455 × 305 × 255 og 3237 9-serien udgår).
  Animationen er ren CSS på en indlejret SVG, ca. 3 KB. Den står stille for dem, der har slået bevægelse fra.
- **Logo på postæsken** handler kun om postæsken, for kampagnen handler om forsendelsen og ikke om smykkeæsker.
  Indvendingen “Logo på postæsken? Det er kun for de store.” får svaret "Fra 200 stk. Så ligner du en af dem." Der er
  fire rigtige kunders postæsker på gul baggrund og tre fakta: fra 200 stk. (logoet koster ekstra pr. æske), folie
  eller tryk, og produktionstiden.
- **Alt det praktiske** har syv spørgsmål (det første starter nu med "det, du sender", ikke smykkeæskerne): valg af postæske, antal og opbevaring, logo på postæsken, gratis logotryk
  på smykkeæsker, silkepapir og bånd med logo, prøver og frister.
- **Klar til jul** har den godkendte sætning om frister og links til frister og genbestilling.

### Links ind på siden

| Link | Åbner |
|---|---|
| `#look-01` … `#look-05` | det look (toppen viser også looket) |
| `#trin-guldstjerner` | trin for trin med Guldstjerner valgt |
| `#trin-1` … `#trin-5` | trin for trin, åbnet på det trin (mailen holder trin 4 og 5 tilbage og linker til `#trin-4`) |
| `#look-06` | "Mix dit eget" |
| `#faq-logo` (og `#faq-postaeske`, `#faq-antal`, `#faq-gratis`, `#faq-silkepapir`, `#faq-proeve`, `#faq-frister`) | det spørgsmål, foldet ud |
| `#fs-andet` | "Ikke kun til smykker" (mailens GIF og link lander her) |
| `#fs-trin`, `#fs-looks`, `#fs-logo`, `#fs-praktisk` | det afsnit |

Kommer man ind via et link, afspiller trin-guiden sig ikke selv. Den, der kom for noget bestemt, skal ikke se siden flytte sig.

## Godt at vide

- **Butikslinksene er danske og uden domæne** (`/dkk_dk_den/…`). Indlægget ligger altid på www.westpack.com, så de
  virker, og det sparer ca. 1,8 KB. Blokken skifter dem selv til den butik, siden står i, ligesom Boxulatoren.
- **Billederne ligger i Klaviyos billedbibliotek** (DK, `w47-blog-*`) og hentes fra `d3k81ch9hvuctc.cloudfront.net`,
  som butikkens sikkerhedsregler allerede tillader.
- **Al CSS hænger på blokkens id (`#w47fs`)**, så temaet ikke kan ændre indlægget, og indlægget ikke kan ændre resten
  af siden.
- **Uden JavaScript** står alle fem trin under hinanden med billede, og intet forsvinder.
- **Ingen emojis** og ingen tegn på 4 bytes, for Magentos database afviser dem.
- Filen er ca. 62 KB. Et HTML Code-element kan højst rumme 64 KB, så der er plads til lidt, men ikke til et afsnit mere. Den læsbare udgave ligger i `src/`. Ret dér, og byg den komprimerede igen.
- **Teksten er læst igennem efter Copywriter-oplægget** (Hvad så?-testen, comeback-snydekoden, du-form, aktive
  verber), og hver påstand er tjekket mod butikkens egne sider.
- **Animationen kan oversættes.** Tegningen har ingen ord. De syv navne ("Et duftlys." … "Og ja – smykker.") står som
  almindelig tekst i `<figcaption class="fs-cn">` under den, ligesom "Det står der jo på låget.". Oversæt dem som al
  anden tekst. Rækkefølgen skal blive den samme, for navn nummer 1 hører til tegning nummer 1. Et langt navn må gerne
  fylde to linjer, for feltet holder højden. Mailens GIF har heller ingen ord. Navnene står som tekst under den, så
  Duplicate & translate oversætter dem til hvert marked (fra mail v11).
- **Til oversættelsen:** teksterne til Guldstjerner-udgaven af trinene ligger i attributterne `data-w-t` (og
  Rosa-teksterne i `data-r-t`). De skal oversættes med, ellers skifter guiden til dansk, når man vælger Guldstjerner.
- Bloggen sender links med `?utm_…` videre til samme side uden parametrene. Ankeret (`#look-03`) følger med.
  Klaviyo tæller klikket alligevel.
