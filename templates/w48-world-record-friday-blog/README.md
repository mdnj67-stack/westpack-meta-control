# World Record Friday: resultaterne – blogindlæg (W48)

Blogindlægget afslører resultaterne fra World Record Friday med de fem videoer: introen og de fire rekordforsøg
(Martin, Mia, Cecilia og Niklas). Det er **landingssiden for fredagsmailen** (W48: World Record Friday, sendes fredag
27. november). Mailens knapper "Se forsøget" åbner hver sin deltager her.

Indlægget er **med vilje sort**. Det er kampagnens sorte udgave, i samme design som Pre Black Friday-mailen og
fredagsmailen: sort flade, Inter Tight i overskrifterne, de store tal 01–04 og rødt kun i stregen gennem "Black".
Forsendelsesguiden fra W47 blev tonet ned til butikkens hvide udtryk efter Kirstens korrektur, men det her indlæg er en
del af én kampagne og skal ligne den. Butikkens hvide side står rundt om blokken.

> **Status 18/11:** Bygget, ikke lagt op. Kun dansk. Afstemningen fra mandagens mail er ikke talt endnu, så filen her
> er **uden** afsnittet "Jeres favorit". Fredag morgen tæller Claude stemmerne og bygger filen igen med dem.

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
   - **Meta title:** World Record Friday: resultaterne | Westpack
   - **Meta description:** Fire kolleger fra Westpack gik efter fire verdensrekorder. Se videoerne, resultaterne og
     rekorderne, de skulle slå.
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
- **Kevin** – bonusforsøget uden video: flest gange i træk at sige “touchpoint density”. Resultat: 4.000+, samme tal
  som i mailen ("Optagelsen kører stadig. Vi har skiftet batteri to gange.").
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

Kun dansk indtil videre. Al tekst ligger i HTML'en, så indlægget kan oversættes som normalt. Husk også teksten i
`aria-label` og `data-title` på videoerne (fx "Se Martins tårn"). Citaterne fra videoerne (“Pretty close”, “We might
need another Friday.”) er engelske i originalen og kan blive stående. Links til butikken peger automatisk på den butik,
indlægget ligger i.

## Filer

- `world-record-friday-da.html` – blokken, der sættes ind (ca. 40 KB).
- `cover.jpg` – listebilledet.

Billederne ligger i Klaviyos billedbibliotek (DK). Produktbillederne er de samme som i Pre Black Friday-mailen.
