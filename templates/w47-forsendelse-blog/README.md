# Den store forsendelse – blogindlæg (W47)

Et blogindlæg om julepakning i postæsker: fem julelooks, en trin-for-trin-guide, en indkøbsliste til hvert look,
logotryk og alt det praktiske. Det er **landingssiden for W47-mailen "Den store forsendelse"**: mailens fem
look-felter åbner hvert sit look her, og linket under trinene åbner guiden med Guldstjerner.

Udtrykket er det samme som mailens: skandinavisk, creme og dæmpede farver, dyb grøn, Instrument Serif og Jost.

> **Status 6/11:** Kun dansk. Oversættelserne laves, når den danske er godkendt.

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
- **Logo på postæsken** handler kun om postæsken, for kampagnen handler om forsendelsen og ikke om smykkeæsker.
  Indvendingen “Logo på postæsken? Det er kun for de store.” får svaret "Fra 200 stk. Så ligner du en af dem." Der er
  fire rigtige kunders postæsker på gul baggrund og tre fakta: fra 200 stk. (logoet koster ekstra pr. æske), folie
  eller tryk, og produktionstiden.
- **Alt det praktiske** har syv spørgsmål: valg af postæske, antal og opbevaring, logo på postæsken, gratis logotryk
  på smykkeæsker, silkepapir og bånd med logo, prøver og frister.
- **Klar til jul** har den godkendte sætning om frister og links til frister og genbestilling.

### Links ind på siden

| Link | Åbner |
|---|---|
| `#look-01` … `#look-05` | det look (toppen viser også looket) |
| `#trin-guldstjerner` | trin for trin med Guldstjerner valgt |
| `#fs-trin`, `#fs-looks`, `#fs-logo`, `#fs-praktisk` | det afsnit |

## Godt at vide

- **Butikslinksene er danske** (`dkk_dk_den`). Blokken skifter dem selv til den butik, siden står i, ligesom
  Boxulatoren.
- **Billederne ligger i Klaviyos billedbibliotek** (DK, `w47-blog-*`) og hentes fra `d3k81ch9hvuctc.cloudfront.net`,
  som butikkens sikkerhedsregler allerede tillader.
- **Al CSS hænger på blokkens id (`#w47fs`)**, så temaet ikke kan ændre indlægget, og indlægget ikke kan ændre resten
  af siden.
- **Uden JavaScript** står alle fem trin under hinanden med billede, og intet forsvinder.
- **Ingen emojis** og ingen tegn på 4 bytes, for Magentos database afviser dem.
- Filen er ca. 56 KB. Den læsbare udgave ligger i `src/`. Ret dér, og byg den komprimerede igen.
- **Teksten er læst igennem efter Copywriter-oplægget** (Hvad så?-testen, comeback-snydekoden, du-form, aktive
  verber), og hver påstand er tjekket mod butikkens egne sider.
- **Til oversættelsen:** teksterne til Guldstjerner-udgaven af trinene ligger i attributterne `data-w-t` (og
  Rosa-teksterne i `data-r-t`). De skal oversættes med, ellers skifter guiden til dansk, når man vælger Guldstjerner.
- Bloggen sender links med `?utm_…` videre til samme side uden parametrene. Ankeret (`#look-03`) følger med.
  Klaviyo tæller klikket alligevel.
