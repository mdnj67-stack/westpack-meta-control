# World Record Friday: resultaterne – blogindlæg (W48)

Blogindlægget afslører resultaterne fra World Record Friday med de fem videoer: introen og de fire rekordforsøg
(Martin, Mia, Cecilia og Niklas). Det er **landingssiden for fredagsmailen** (W48: World Record Friday, sendes fredag
27. november). Mailens knapper "Se forsøget" åbner hver sin deltager her.

Indlægget er **med vilje sort**. Det er kampagnens sorte udgave, i samme design som Pre Black Friday-mailen og
fredagsmailen: sort flade, Inter Tight i overskrifterne, de store tal 01–04 og rødt kun i stregen gennem "Black".
Forsendelsesguiden fra W47 blev tonet ned til butikkens hvide udtryk efter Kirstens korrektur, men det her indlæg er en
del af én kampagne og skal ligne den. Butikkens hvide side står rundt om blokken.

> **Status 26/11:** Live på DK under `world-record-friday-2026` med Kirstens egen redigering af teksten.
> `world-record-friday-da.html` er nu **den live blok** plus hendes tre punkter fra korrekturen i Asana: indledningen
> ("Det var muligvis lidt for ambitiøst…" i stedet for "Det var muligvis en fejl.", som kunne læses, som om det var en
> fejl ikke at holde Black Friday), og studieværten er "hende" to steder. Den skal sættes ind i stedet for den live blok.
> Kun dansk, og uden afsnittet "Jeres favorit".
>
> **26/11, senere:** To kodefejl er rettet. Mailens links landede øverst på siden for nye besøgende, fordi cookiebanneret
> låser siden og sender læseren til toppen, når det besvares. Nu lander siden igen, når låsen slipper (samme løsning som
> W47). Og Niklas' mål havde 164 streger, nu 161. I Amasty skal **datoen sættes til 27. november** (temaet skriver
> "18. november 2026" lige over blokken), og meta description stod på "Default Description". Brug teksten nedenfor.
>
> **Byg den ikke igen med builderen** (`bf/friday.js`, `bf/blog/build.js`): den kender ikke Kirstens tekst og ville
> skrive den gamle oven på. Ret i denne fil. Afsnittet nedenfor om at tælle stemmerne fredag morgen gælder ikke længere.
>
> **26/11, eftermiddag: indlægget findes nu på sproget i alle 15 butikker, mailen går til** (`sprog/`). Indtil de er sat
> ind, viser alle 24 butikker den danske tekst, fordi den ligger i All Store Views. Se "Sådan lægger du sprogene op"
> nedenfor.

## Sådan lægger du sprogene op

Der er **én fil pr. store view i `sprog/`** (fx `sprog/eur_eu_ger.html`), og titel, kort beskrivelse, meta title og meta
description for hvert sprog står i [`sprog/felter.md`](sprog/felter.md). Samme fremgangsmåde som W47-forsendelsesguiden.

**Rækkefølgen er vigtig.** Lige nu ligger den danske tekst i **All Store Views**, og Danmark bruger den derfra. Skifter du
All Store Views til engelsk først, bliver det danske indlæg engelsk.

1. **Danmark først.** Åbn indlægget i Amasty Blog Pro, og vælg store view **Denmark** øverst. Fjern fluebenet i
   **Use Default Value** ved titel, kort beskrivelse, indhold, meta title og meta description. Sæt
   `sprog/dkk_dk_den.html` ind i HTML Code-elementet (Page Builder, Ctrl+A, Delete, Ctrl+V), og udfyld felterne fra
   `felter.md`. Filen er præcis den blok, der ligger live nu. Gem.
2. **All Store Views** (standarden): `sprog/alle-store-views.html` og de engelske felter. Det er den britiske tekst med
   Magentos `{{store}}` foran hvert butikslink, så de ni butikker uden egen fil (CZ, SK, HU, GR, BG, EE, HR, LV, LT)
   viser engelsk og sender læseren ind i deres egen butik. Gem.
3. **De andre 13 store views**, ét ad gangen: vælg store view, fjern fluebenet i **Use Default Value** ved de fem felter,
   sæt store viewets fil ind, udfyld felterne, og gem. URL-nøglen beholder **Use Default Value** overalt.
4. **Datoen**: sæt udgivelsesdatoen til **27. november**. Det er feltet, temaet skriver over blokken ("18. november 2026"
   i dag). Den står ikke i blokken.
5. Tjek et par sprog på sitet: overskriften står på sproget, "Til og med søndag"-tavlen står på sproget, og
   `…/eur_eu_ger/blog/world-record-friday-2026#niklas` lander på Niklas.

Brug **ikke** den almindelige teksteditor (WYSIWYG): den fjerner `<script>` og `<style>`. Design og script ligger i hver
fil (45–46 KB, under feltets 64 KB), så indlægget henter intet fra vores server.

### Sådan blev sprogene lavet

`sprog.js` (se toppen af filen): `prep` → `translate all` → `proofread all` → `apply all` → `links` → `assemble`.
Oversættelsen er appens egen Duplicate & translate direkte fra dansk til hvert marked, som mailen W48 Pre Black Friday,
med butikkens egne ord for WTP-skrinene. Derefter en uafhængig korrektur pr. sprog på den stærke model (`proofread`), som
kun kan ændre tekst. Den fandt fx, at Martins æsker er smykkeæsker og ikke skrin, "clothespins" på amerikansk og
"Peso mosca" i ental på italiensk.

- `sprog/tr/rejected.json` er korrekturforslag, der ikke er taget med. Fem af dem ville gøre "Så **I** holder stadig ikke
  Black Friday?" til ental. Spørgsmålet stilles til Westpack, ikke til læseren, så det skal være flertal på alle sprog.
- `sprog/tr/fixes.json` er rettelser i hånden: flertal i PT/RO, norsk "Tilbudet", svensk "inget" (rekord er intetkøn).
- `sprog/tr/same-ok.json` er tekster, der er gennemlæst og står ens på dansk og sproget (norsk "Se introen", tysk "Rekord: 65").
- `assemble` tjekker hvert sprog: alle tal fra den danske tekst er med, ingen dansk tilbage, ingen 4-byte-tegn, under
  62 KB, og alle butikslinks svarer 200 i butikken (`links`). På engelsk tæller tallene op med punktum ("6.5 m").
- Ingen af oversættelserne er læst af en indfødt.

Ændres den danske tekst, skal sprogene laves igen: `assemble` nægter at bygge fra en ældre dansk tekst.

## Hvornår den skal lægges op

**Fredag 27. november om morgenen, før mailen går ud – ikke før.** Indlægget afslører resultaterne, og mandagens mail
lovede, at de kom fredag. Lægges det op tidligere, kan det findes på bloggen, og overraskelsen er væk. **Opret også
indlægget fredag** (eller sæt datoen til 27. november): temaet skriver indlæggets dato over blokken.

Fredag morgen sker det i denne rækkefølge:

1. Stemmerne fra mandagens mail tælles, og indlægget bygges igen. Det gør Claude (én kommando, der også bygger mailen).
   Derefter står vinderen og fordelingen i afsnittet "Jeres favorit".
2. Indlægget lægges op med den nye `world-record-friday-da.html`.
3. Mailen sendes.

Bliver punkt 1 ikke kørt, virker indlægget stadig, bare uden afsnittet med stemmerne.

## Sådan lægger du indlægget op

Indlægget skal have **URL-nøglen `world-record-friday-2026`**, altså `…/blog/world-record-friday-2026`. Den er ledig
(tjekket 18/11 i DK, EU og DE). Mailens links går dertil, så den skal være præcis sådan.

1. Gå til indlæggene i Amasty Blog Pro i admin, og opret et nyt indlæg (Add New Post).
2. Udfyld felterne:
   - **Titel:** World Record Friday: resultaterne
   - **URL-nøgle:** `world-record-friday-2026`
   - **Kort beskrivelse (listen):** Traditionen tro holder vi ikke Black Friday. Fire kolleger gik efter hver sin rekord
     i stedet – her er alle fem videoer.
   - **Meta title:** World Record Friday 2026: Sådan gik det | Westpack
   - **Meta description:** Vi holder ikke Black Friday. I stedet gik fire kolleger efter verdensrekorder med
     smykkeæsker, M&M’s, elastik og tøjklemmer. Se alle fem videoer her.
     (Ingen rabat i den, så den ikke er forældet, når tilbuddet slutter søndag.)
   - **Kategori:** Westpack
   - **Billede (listebillede):** `cover.jpg` fra denne mappe (1200 × 800, de fire deltagere, ingen tekst)
3. Indhold: åbn **Page Builder** (Edit with Page Builder). Træk ét element af typen **HTML Code** (under Elements)
   ind. Klik i feltet, tryk **Ctrl+A** og **Delete**, så det er tomt, og sæt **hele** indholdet af
   `world-record-friday-da.html` ind. Tilføj ikke andre elementer. Brug **ikke** den almindelige teksteditor (WYSIWYG):
   den fjerner `<script>` og `<style>`.
4. Vælg butikken (store view: DK), og gem.
5. Åbn indlægget på sitet, og tjek fire ting:
   - Øverst står "World Record ~~Black~~ Friday" med en rød streg gennem "Black", og de fire deltagere står med
     resultatet under.
   - Tryk på Martins video: den starter i billedet (Vimeo). Kun én video spiller ad gangen. **Det skal tjekkes af et
     menneske**: Vimeo afviser automatiske browsere, så afspilningen kunne ikke testes med et script.
   - På mobilen fylder den sorte flade hele skærmens bredde, uden at siden kan skubbes til siden.
   - Tryk på "0:17" under Martin: videoen springer dertil.
   - `…/blog/world-record-friday-2026#niklas` lander på Niklas.

Får du **"Please remove invalid characters"**, er der kommet tegn med i feltet, som databasen ikke kan gemme. Tøm
feltet helt, og sæt filen ind igen.

## Hvad der er på siden

- **Toppen** – overskriften fra Pre Black Friday-mailen, “Og I filmede det hele?” / "Hver eneste klemme." og så lige
  ud: "Traditionen tro holder vi ikke Black Friday – i hvert fald ikke den med nedtællingsure og “kun i dag”."
  Ved siden af ligger introvideoen (0:49). Under den står
  **slutstillingen**: de fire deltagere som i mandagens "vælg din spiller"-skærm, med resultat og rekord. Billederne
  lyser op én ad gangen, når man ruller ned til dem, ligesom i mandagens animation. Et tryk på en deltager hopper ned
  til forsøget. Under introvideoen står studieværtens dom: “There were questionable techniques, definitely.”
  På en telefon går den sorte flade ud til skærmens kanter (som i mailene), i stedet for at ligge som et smalt kort i
  temaets hvide kolonne. Det sker i blokkens script, målt på skærmen, så siden aldrig kan rulle sidelæns.
- **Fire afsnit, ét pr. deltager** – video, resultat over for rekorden, en lille tegning af forsøget i dets egne ting og
  tre-fire øjeblikke fra optagelserne. Et tryk på et tidspunkt (fx "0:17") starter videoen dér. Til sidst kommer
  deltagerens kampråb fra mandagens mail, og hvordan det gik med det.
  - Martin: 12 smykkeæsker i ét tårn. Der findes ingen rekord, så tårnet står som den første. Tegningen er et tårn af
    12 æsker. Mandagens mail lovede pakketape om hænderne. I videoen er det engangshandsker, og det siger indlægget
    ærligt (0:07: "Engangshandsker på. Det er nok den slags, studieværten kalder “questionable techniques”.").
  - Mia: 18 M&M's på ét minut med spisepinde. Rekorden er 65 (fra 2011). Tegningen er 65 prikker, og 18 af dem er
    farvede.
  - Cecilia: 6,5 meter med en elastik (bedste af tre skud). Rekorden er 30,16 meter (fra 1999). Tegningen er en streg på
    30,16 meter med elastikken ved 6,5.
  - Niklas: 52 tøjklemmer i ansigtet. Rekorden er 161 (fra 2013). Tegningen er 161 streger, og 52 af dem er farvede.
    Hans video er den lange (4:51).
- **Jeres favorit** – stemmerne fra mandagens mail (et klik på "Hold med …" var en stemme), som søjler og en
  vinderlinje. Er der delt førsteplads, står der det. Er stemmerne ikke talt, er afsnittet der ikke.
- **Tilbuddet** – "Det eneste, vi slog, var prisen.": 20 % på alle smykke- og rejseskrin (hele WTP-serien) til og med
  søndag 29. november, med vægtklasserne fra mandagens mail (Hawaii, Capri, Bali, Tahiti og Stackables). Alle fem var
  på lager og ikke på "Sidste chance" 18/11. Knappen "Se alle WTP-skrin med 20 %" går til alle WTP-skrin (urskrinene er ikke med: de er på 50 % "Sidste
  chance"). Priserne kræver login.
  **Tilbuddet forsvinder af sig selv** fra mandag 30. november kl. 00.00 (dansk tid). Derefter står der kun én linje
  om, at rabatten sluttede søndag, med et link til skrinene. Indlægget kan derfor blive liggende.
- **Til sidst** – “We might need another Friday.”, det sidste studieværten siger i introen (0:47–0:49).

Alle citater fra videoerne står i de indbrændte undertekster og er tjekket billede for billede 18/11: “None!” (Martin
0:02), “pretty close” (Mia 0:34), “Sadly just a tiny bit off.” (Cecilia 0:31), “Impressive … but not quite there.”
(Niklas 4:29–4:32, underteksten lyder "52 impressive" / "but not quite there") og de to linjer fra introen.

### Links ind på siden

| Link | Åbner |
|---|---|
| `#intro` | toppen med introvideoen |
| `#martin` · `#mia` · `#cecilia` · `#niklas` | deltagerens afsnit. Videoen er markeret, så den er det næste naturlige tryk |
| `#stemmerne` | "Jeres favorit" (uden stemmer: slutstillingen) |
| `#tilbuddet` | tilbuddet |

Links fra mailen har sporingen før ankeret, fx `…/blog/world-record-friday-2026?utm_content=wrf_fri_card_niklas#niklas`.
Bloggen fjerner sporingen, men ankeret bliver, og siden hopper til det rigtige afsnit.

## Videoerne

Videoerne ligger på Westpacks Vimeo-konto (de samme fem klip som i Asana, "Billeder" under W48: World Record
Friday). De har engelske undertekster, som er brændt ind i videoen. På siden står et stillbillede fra hver video med en
afspilknap. Vimeo-afspilleren hentes først, når man trykker, og med Vimeos "Do Not Track", så siden er hurtig og ikke
sætter Vimeo-cookies, før nogen vil se en video. Butikkens sikkerhedsregler (CSP) tillader Vimeo, og
cookie-banneret (Cookie Information) blokerer ikke afspilleren. Begge dele er tjekket på den rigtige side 18/11, både
med "Afvis alle" og med "Accepter alle".

Skifter nogen privatlivsindstillingen på Vimeo, så videoerne ikke længere må vises på andre sider, holder de op med at
virke her.

## Oversættelse

Se "Sådan lægger du sprogene op" øverst. `sprog.js` oversætter også `aria-label`, `alt` og videoernes `data-title`.
Citaterne fra videoerne (“Pretty close”, “We might need another Friday.”) er engelske i originalen og står på engelsk i
alle sprog. Links til butikken peger på den butik, indlægget ligger i (i filen og igen i scriptet).

## Filer

- `world-record-friday-da.html` – den danske master (= den live blok, ca. 45 KB).
- `sprog/` – én fil pr. store view, `alle-store-views.html` og `felter.md`. `sprog/tr/` er oversættelserne, korrekturen
  og rettelserne, som `sprog.js` bygger filerne af.
- `sprog.js` – laver sprogfilerne (se "Sådan blev sprogene lavet").
- `cover.jpg` – listebilledet. `post-image-600.jpg` – Niklas med klemmer, 600 × 600.

Billederne ligger i Klaviyos billedbibliotek (DK). Produktbillederne er de samme som i Pre Black Friday-mailen.
