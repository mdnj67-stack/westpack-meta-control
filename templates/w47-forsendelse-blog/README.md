# Den store forsendelsesguide – blogindlæg (W47)

Et blogindlæg om julepakning i postæsker: fem julelooks, en trin-for-trin-guide, en indkøbsliste til hvert look,
logotryk og alt det praktiske. Det er **landingssiden for W47-mailen "Den store forsendelse"**: mailens fem
look-felter åbner hvert sit look her, og linket under trinene åbner guiden med Guldstjerner.

**Funktionerne er nye, men layout og stil er Westpacks egne blogindlæg** (18/11). Analysen af teamets egne indlæg
ligger i `knowledge/westpack-blog-style/README.md`. Indlægget følger den sådan:

- **Skrift og farver:** temaets Inter til alt undtagen overskrifterne. Brødtekst 14 px i hele spaltens bredde. Grå
  numre ("01"), tynde streger mellem afsnittene og lysegrå bokse (#f5f4f0) med 8 px hjørner. Grønne links med pil,
  sorte knapper med ➔.
- **Overskrifterne (H2) står i Instrument Serif**, mailens overskriftsskrift, og svaret under hver står i skråskrift i
  mailens tyttebærrøde farve (#9b3a32). Kirsten bad om det i sin anden korrektur (20/11): "Alle H2'erne skal have en tur
  med farveladen eller den flotte skrifttype, så de træder frem uden at blive en H1'er". Den store overskrift øverst
  (H1) er stadig temaets Inter.
- **Opbygning:** én spalte. Hvert afsnit starter med en beskrivende overskrift ("Trin for trin", "Fem looks", "Logo på
  postæsken" ...). Indvendingen står i almindelig tekst og svaret under den, som i Kick-off 5 Julelogotryk.
- **Looks:** som sættene i "9 inspirerende sæt". Hvert look har overskriften "Look 01: Rosa & guld", en kort tekst og
  billederne, hvor ét stort står ved siden af to små som i Kick-off 9. Derefter kommer "Det skal du bruge" som
  punktliste med links, "Gratis logotryk" som grå pille fra Top 5 og husets sorte knap.

To ting fra Kirstens kommentar er beholdt: farven skifter med looket i toppen, nu i rammen om det store billede. Og
afslutningen er grøn, som husets mørke afslutningsbokse i fx Halloween.

> **Status 18/11:** Rettet efter Kirstens korrektur (Asana, "Korrektur + blopost"). Ny tekst øverst, i "Ikke i
> december" punkt 01, i trin 1, 2 og 5 (vejledning frem for salgssætninger) og i Look 04. Look 04 har også fået et
> billede af den færdigt indpakkede postæske. Der står "digitaltryk", hvor der før stod "tryk". Den 18/11 blev hele
> designet lagt om til husets blogstil (se ovenfor). Mads mente, at funktionerne godt måtte være nye, men at layout
> og stil skulle være Westpacks. **18/11: Indlægget ligger i Magento** med URL-nøglen
> `the-complete-christmas-shipping-guide-2026` og status Hidden (kan åbnes på adressen, men står ikke på
> blogoversigten). Mailen linker dertil fra v13, og alle dens dybe links er afprøvet på det live indlæg.

> **Status 24/11:** Rettet efter Kirstens anden korrektur (20/11, samme subtask). Brødteksten fylder hele bredden.
> Overskrifterne står i Instrument Serif med svaret i rødt under (også "Syv svar, før du bestiller."). "Look 06: Mix
> dit eget" er blevet en boks i looksenes farver med en postæske + et papir + et bånd og knappen **Bland igen**. **Den
> nye version skal sættes ind i Magento** i stedet for den gamle (se nedenfor). URL-nøglen og alle mailens dybe links er de
> samme.
>
> Samme dag, før mailen sendes: **produktionstiden er 8–9 hverdage med et nyt logo og 5–6 ved genbestilling**, som
> postæskernes produktsider skriver siden 20/11 (før 7–8 / 4–5), i faktaboksen og i spørgsmålet om logo. Og **mailens dybe
> links lander nu også ved første besøg**: butikkens cookie-banner låser siden, indtil man svarer, så hoppet til
> `#look-03` gik tabt, og læseren stod øverst i artiklen efter "Accepter alle" eller "Afvis alle". Blokken lander igen,
> når banneret slipper siden. Afprøvet på den rigtige side uden samtykke (Chromium og WebKit, begge svar, alle ti
> ankre i mailen).
>
> Samme dag: **indlægget findes på alle 24 store views' sprog** (`sprog/`), oversat med Duplicate & translate via engelsk,
> og design og script ligger nu på vores server, så alle sprog kan være i feltet. Alle links er afprøvet i hver butik, og
> de fem smykkeæsker har tryk til 0 kr. i alle butikker (butikkens egen søgning, `print_fee`). Indtil et store view får sin
> fil, viser det den danske tekst.

## Sådan lægger du indlægget op – på alle sprog

Indlægget har **URL-nøglen `the-complete-christmas-shipping-guide-2026`** i alle butikker, altså
`…/<butik>/blog/the-complete-christmas-shipping-guide-2026`. Teamet valgte den, da indlægget blev lagt op. Mailen (v13) linker
dertil i alle markeder, så den må ikke ændres, uden at mailens links ændres med.

**Der er én fil pr. store view i `sprog/`** (24 i alt, fx `sprog/eur_eu_ger.html`), og felterne til hvert sprog står i
[`sprog/felter.md`](sprog/felter.md). Det er samme mønster som teamets egne indlæg, fx "9 inspirerende sæt": ét indlæg,
samme URL-nøgle, og hvert store view har sit eget sprog i indholdet.

1. Åbn indlægget i Amasty Blog Pro, og vælg **store view** øverst (fx Germany).
2. Fjern fluebenet i **Use Default Value** ved titel, kort beskrivelse, indhold, meta title og meta description, og udfyld
   dem fra `sprog/felter.md`. URL-nøglen beholder **Use Default Value**.
3. Indhold: åbn **Page Builder**, klik i **HTML Code**-elementet, tryk **Ctrl+A** og **Delete**, og sæt **hele** indholdet af
   store viewets fil ind (fx `sprog/eur_eu_ger.html`). Brug **ikke** den almindelige teksteditor (WYSIWYG): den fjerner
   `<script>`.
4. Gem, og gentag for næste store view. Danmark er `sprog/dkk_dk_den.html`.
5. Åbn indlægget på sitet, og tjek tre ting:
   - Øverst skifter de fem looks af sig selv, og knapperne under billedet skifter look.
   - I trin-for-trin kan du skifte til det andet look, og billederne skifter med.
   - `…/blog/the-complete-christmas-shipping-guide-2026#look-03` lander på look 03.

**Design og script ligger ikke i filerne**, men på vores egen server
(`project-4fcxa.vercel.app/store-blog/w47-forsendelse/w47fs.css` og `w47fs.js`), og hver fil henter dem. Det er derfor, alle
sprog kan være i feltet: med design og script indeni ville tysk, finsk og polsk ramme grænsen på 64 KB, og græsk og bulgarsk (to
bytes pr. bogstav) ville gå over. Og en rettelse af designet når alle 24 store views med det samme, uden at nogen skal sætte
noget ind igen. Filerne fylder 41–57 KB.

### Når den danske tekst ændres

Den danske master er **`src/forsendelse-da.html`**, og sprogversionerne laves af `sprog.js` (se toppen af filen):
`build` → `translate en` → læs den engelske → `translate all` → `links` → `assemble`. Oversættelsen er appens egen
Duplicate & translate (ordliste, tiltaleform pr. marked, beskyttede serienavne) via engelsk, som mailene. `assemble` nægter at
lave filer af oversættelser fra en ældre dansk tekst, så ingen kommer til at sætte en forældet version ind.
Rettelser i hånden (`sprog/tr/fixes.json`) og lookenes navne pr. sprog (`sprog/tr/names.json`) bruges igen hver gang.
Ingen af oversættelserne er læst af en indfødt.

Får du **"Please remove invalid characters"**, er der kommet tegn med i feltet, som databasen ikke kan gemme. Tøm
feltet helt, og sæt filen ind igen.

## Hvad der sker på siden

- **Toppen** åbner som Kick-off 9 og Mix & Match. Øverst står en stor overskrift (36 px, på telefonen 26 px): "Den
  store forsendelsesguide: Gør hver ordre til en julegave". Den har titel og undertitel ligesom "Mix & Match: Giv dine
  smykkeæsker et helt nyt look". Derefter kommer indledningen og indholdet som piller ("Fem trin", "Fem looks", "Dit
  logo", "Det praktiske"). Så kommer det store billede med de fem færdige looks. De skifter hvert fjerde sekund, til
  man vælger et selv med pillerne under billedet, og rammen skifter farve med looket. "Se looket" hopper ned til
  lookets afsnit. Blokken har 32 px luft over sig, så overskriften ikke klistrer til datoen.
- **"Ikke i december."** Tre grunde til at gøre sig umage i husets nummererede bokse, skrevet som et svar på “Det er
  jo bare en postæske.”
- **Trin for trin** har fem trin med billede, tip og link. Man kan se dem med Rosa & guld eller Guldstjerner, bladre,
  swipe på telefonen eller trykke **Afspil**. Guiden spiller selv én gang, når den kommer til syne.
- **Fem looks** står i én spalte efter hinanden med en streg imellem. Hvert look har en overskrift, en kort tekst, tre
  billeder, en indkøbsliste som punktliste med links og en knap. Look 04 (Grønne grene) viser også postæsken pakket ind i sit eget gavepapir (billede 70 fra
  fotograferingen): papir, bånd, gavemærke og rensdyr i æsken er afmålt til at pakke den ind.
  Smykkeæsken i hvert look er markeret med "gratis logotryk": Boston ECO, Melbourne ECO, Santorini ECO, Seoul ECO og
  Vienna. Det står på hver af deres produktsider (tjekket 6/11).
- **Look 06: Mix dit eget** (ny 24/11, Kirsten: "gør noget ;) ... en boks til netop denne og måske et par billeder
  mere") står i en boks i looksenes farver. Den viser det, teksten siger: en postæske + et papir + et bånd, og åbner på
  tekstens eget eksempel (rosa postæske, sort silkepapir, guldfarvet bånd). **Bland igen** viser tre andre dele, aldrig
  alle tre fra samme look. Der er 4 postæsker, 5 papirer og 3 bånd, og hver del linker til sin produktside. Billederne er
  udsnit af fotografens egne billeder (Asana, "Billeder"). Kun de tre viste hentes, og resten hentes, første gang man
  rører knappen. Uden JavaScript står de tre første, og knappen er skjult.
- **Ikke kun til smykker** (tilføjet 10/11) svarer på “Postæsker? Vi sælger jo ikke smykker.” med "Det gør postæsken
  heller ikke." Der er to felter side om side. Det ene er en lille tegnet animation, hvor et duftlys, et tørklæde, en
  creme, en kop, solbriller, en dåbsske og til sidst en smykkeæske falder ned i en postæske efter tur, med navnet under.
  Det andet er Westpacks eget prøvetryk "FILLED WITH LOVE … and other cool stuff" (Content Library, "Digital print
  (postæsker)"). Derunder står ét faktum: postæskerne går fra 2,2 til 12,8 cm i højden og op til 40 cm i længden. Det er
  tjekket på kategorisiden 10/11, og æsker på restsalg er ikke talt med (XXL 455 × 305 × 255 og 3237 9-serien udgår).
  Animationen er ren CSS på en indlejret SVG, ca. 3 KB. Den står stille for dem, der har slået bevægelse fra.
- **Logo på postæsken** handler kun om postæsken, for kampagnen handler om forsendelsen og ikke om smykkeæsker.
  Indvendingen “Logo på postæsken? Det er kun for de store.” får svaret "Fra 200 stk. Så ligner du en af dem." Der er
  fire rigtige kunders postæsker på gul baggrund (det gule er fotoet) og tre fakta i husets bokse: fra 200 stk. (logoet koster ekstra pr. æske), folie
  eller digitaltryk, og produktionstiden. Der står "digitaltryk" overalt, ikke bare "tryk": butikken sælger to
  teknikker til postæsker, folie og digitaltryk, og det er dem, kunden skal vælge imellem.
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

- **Butikslinksene står med hver butiks egen kode og uden domæne** (`/eur_eu_ger/…`), og kategorien postæsker med butikkens
  egen adresse, hvor den er en anden (`sprog.js links` finder dem). Indlægget ligger altid på www.westpack.com.
- **Billederne ligger i Klaviyos billedbibliotek** (DK, `w47-blog-*`) og hentes fra `d3k81ch9hvuctc.cloudfront.net`,
  som butikkens sikkerhedsregler allerede tillader.
- **Al CSS hænger på blokkens id (`#w47fs`)**, så temaet ikke kan ændre indlægget, og indlægget ikke kan ændre resten
  af siden.
- **Uden JavaScript** står alle fem trin under hinanden med billede, og intet forsvinder.
- **Ingen emojis** og ingen tegn på 4 bytes, for Magentos database afviser dem.
- **Overskriftsskriften hentes fra vores egen server, ikke fra Google** (`project-4fcxa.vercel.app/signup/assets/fonts/instrument-serif.css`,
  ved siden af Signup Labs skrifter). Google Fonts fra Googles servere sender hver besøgendes IP-adresse til Google, og
  det har en tysk domstol kaldt ulovligt uden samtykke (LG München I, 2022). Butikkens eget tema henter også selv sin
  Inter. `fetch-font.js` henter skriften igen, og byggeriet afviser en fil, der henter fra Google.
- Sprogfilerne fylder 41–57 KB (græsk mest). Design og script fylder ikke i dem, se ovenfor. Den læsbare udgave ligger i `src/`. Ret dér, og byg den komprimerede igen.
- **Teksten er læst igennem efter Copywriter-oplægget** (Hvad så?-testen, comeback-snydekoden, du-form, aktive
  verber), og hver påstand er tjekket mod butikkens egne sider.
- **Animationen kan oversættes.** Tegningen har ingen ord. De syv navne ("Et duftlys." … "Og ja – smykker.") står som
  almindelig tekst i `<figcaption class="fs-cn">` under den, ligesom "Det står der jo på låget.". Oversæt dem som al
  anden tekst. Rækkefølgen skal blive den samme, for navn nummer 1 hører til tegning nummer 1. Et langt navn må gerne
  fylde to linjer, for feltet holder højden. Mailens GIF har heller ingen ord. Navnene står som tekst under den, så
  Duplicate & translate oversætter dem til hvert marked (fra mail v11).
- **Oversættelsen** klarer `sprog.js`: teksterne, siden skifter til (`data-r-t` / `data-w-t`), og indlæggets felter rejser
  med som skjulte afsnit og sættes tilbage bagefter. `data-l` og `data-m` i Look 06 oversættes ikke og skal blive, som de er.
- Bloggen sender links med `?utm_…` videre til samme side uden parametrene. Ankeret (`#look-03`) følger med.
  Klaviyo tæller klikket alligevel.
