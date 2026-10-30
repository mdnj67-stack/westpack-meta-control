# Kevins æske-lommeregner på bloggen

Et blogindlæg med en lommeregner, der virker, bygget som et lille spil. Det hører til W46-mailen "Kevins æske
lommeregner" (udsendes 13/11 2026), og mailen sender folk hertil. Udtrykket er Kevin-klassisk, altså samme stil
som Kevin-mailene fra 2025: bordeaux, rød kant, creme og Georgia.

> **Status 30/10:** Kun den danske fil, `boxulator-da.html`, er den nye version uden Kevins talebobler og med
> oplæser og lydeffekter. De 15 andre sprog er den gamle version, og de indeholder emojis, som Magento afviser.
> **Brug dem ikke.** De bliver lavet igen ud fra den danske, når den er godkendt.

**Lommeregneren** har smykkeæsker som taster og regner kun i æsker:

- Den runder altid op, og nogle gange blander Kevin sig: han lægger en æske til, sætter et nul bag på
  resultatet eller runder op til nærmeste hundrede. Et lille "+1", "×10" eller "↑100" i hjørnet af displayet er
  det eneste, han indrømmer.
- Hver tredje gang spørger den, om det skal være lidt flere æsker. Der er to knapper, og begge siger ja.
  Svarer man ikke, tager Kevin det som et ja.
- Minus-tasten er pakket ind i gavebånd og flygter, når man prøver at trykke på den.
- Deler man med nul, danser den og spiller Jingle Bells.
- Nogle tal udløser noget: 1953 (Westpacks fødselsår, på kazoo), 0, 112, 911 og juledagene 2412, 2512, 1224 og
  1225. Ingen af dem bliver forklaret. Det er dem, man skal finde.

**Ingen i spillet taler et rigtigt sprog**, så lyden passer i alle 18 butikker:

- Tallene er **gummiænder**, stemt så et tal spiller en lille melodi. Nu og da svarer noget andet i stedet:
  ko, ged, kat, and, cykelhorn, kukkeur, boing, glidefløjte eller kazoo.
- `+` dytter, `×` siger boing, `÷` glider ned, `C` scratcher en plade, `M` er et kukkeur, minus giver
  "dun dun duuun", `=` giver "ba-dum-tss", og `K` giver et air horn.
- En **oplæser** taler gennem en megafon på et sprog, der ikke findes, med enorm overbevisning. Mens han taler,
  lyser **ON AIR**-skiltet over spillet. Et **studiepublikum** siger "åhh" og "øvv", griner og klapper.
- **Kevin siger ikke noget.** Han kigger op over lommeregneren og holder øje.

Al lyd laves i browseren, så der er ingen lydfiler og ingen rettigheder at tænke på. Højttalerknappen slår den fra.

**Spillet:** der er **12 hemmeligheder** at finde, en tæller for "æsker regnet" og **Kevins Q4-mål**, som han
hæver, hver gang man når det. Alle resultater regner ned som små æsker på lageret ("North Pole South"), til
bunken vælter. Finder man alle 12, får man diplomet "Certified Box Counter™" med en knap til æskerne.

Når lommeregneren kommer til syne, går showet on air, og Kevin kigger op. Lyden starter ved første tryk, for
browsere må ikke spille lyd før. Fremskridtet (fundne hemmeligheder, æsker regnet og Kevins mål) gemmes i den
besøgendes browser, så det er der stadig næste gang, og så står der HELL0 i displayet. På telefoner reagerer
tasterne med det samme og giver et lille vibrations-tik på Android.

**Under spillet** står **juleformlen**, som Team Westpack har bygget, og den kan trække fra: sidste års
forbrug + forventet vækst − lager = det, man skal bestille. Den linker til smykkeæskerne, ordrehistorikken og
julefristerne.

## Sådan lægger du indlægget op

Indlægget skal ligge i **alle 18 butikker med samme URL-nøgle**, ellers giver mailens link en 404-fejl:

**URL-nøgle: `boxulator-3000`**, altså `…/blog/boxulator-3000` i alle butikker. Den er ledig i alle 18
(tjekket 29/10).

### I Amasty Blog Pro

1. Gå til indlæggene i Amasty Blog Pro i admin, og opret et nyt indlæg (Add New Post).
2. Titel: se tabellen. Temaet viser indlæggets titel øverst, og spillet har selv overskriften "The Boxulator
   3000™", så titlen er bevidst den anden halvdel og ikke navnet igen. URL-nøgle: `boxulator-3000`.
3. Indhold: åbn **Page Builder** (Edit with Page Builder). Træk ét element af typen **HTML Code** (under
   Elements) ind, og sæt **hele** indholdet af sprogets fil ind. Tilføj ikke andre elementer, for blokken har
   selv overskrift og tekst. Brug **ikke** den almindelige teksteditor (WYSIWYG): den fjerner `<script>` og
   `<style>`, og så virker lommeregneren ikke.
4. Sæt `cover.jpg` som indlæggets billede (listebillede).
5. Vælg butikken (store view), og gem. Gentag for hver butik med sprogets fil.
6. Åbn indlægget på sitet, og tryk 2 + 2 =. Står der 4 i displayet, og lyser ON AIR, virker det.

Får du **"Please remove invalid characters"**, er det en af de gamle sprogfiler med emojis. Magentos database
kan ikke gemme emojis, så den nye version har tegnede ikoner i stedet.

Filerne er komprimerede (cirka 54 KB hver), så de er langt fra den grænse, Magento kan have for et indlægs
indhold. De læsbare udgaver ligger i `src/`. Ret i dem, hvis en tekst skal ændres, og lav de komprimerede
filer igen.

| Butik(ker) | Fil | Titel (indlæggets titel) |
|---|---|---|
| DK | `boxulator-da.html` | Kevins æske-lommeregner |
| EU (engelsk), UK, US | `boxulator-en.html` | Kevin’s box calculator |
| DE | `boxulator-de.html` | Kevins Taschenrechner aus Schmuckschachteln |
| FR | `boxulator-fr.html` | La calculatrice de boîtes de Kevin |
| IT | `boxulator-it.html` | La calcolatrice di scatole di Kevin |
| ES | `boxulator-es.html` | La calculadora de cajas de Kevin |
| NL | `boxulator-nl.html` | Kevins rekenmachine van sieradendoosjes |
| SE | `boxulator-sv.html` | Kevins miniräknare byggd av askar |
| NO | `boxulator-no.html` | Kevins eskekalkulator |
| FI | `boxulator-fi.html` | Kevinin korurasialaskin |
| PL | `boxulator-pl.html` | Kalkulator pudełek Kevina |
| PT | `boxulator-pt.html` | A calculadora de caixas do Kevin |
| RO | `boxulator-ro.html` | Calculatorul de cutii al lui Kevin |
| CZ | `boxulator-cs.html` | Kevinova kalkulačka na krabičky |
| SK | `boxulator-sk.html` | Kevinova kalkulačka na krabičky |
| HU | `boxulator-hu.html` | Kevin ékszerdoboz-számológépe |

Alle filer har **de danske butikslinks** (`dkk_dk_den`). Det er meningen. Blokken skifter selv til den
butik, siden står i, så de samme filer kan bruges overalt. Lad linksene stå.

## Godt at vide

- **Teksten er maskinoversat** med vores egen oversætter (samme som Duplicate & translate) og derefter
  korrekturlæst af en stærkere model, der læser som en modersmålsredaktør. Rettelserne er gennemgået én for
  én: 468 er skrevet ind, fire er skrevet i hånden, og forslag, der ødelagde en pointe, er afvist. Det er ikke det samme som en læsning
  af et menneske med sproget som modersmål. Hvert marked har sin egen tiltaleform: tysk Sie, fransk vous,
  portugisisk você og du-form i resten. Portugisisk er europæisk, ikke brasiliansk.
- **Al tekst står i HTML'en**, også navnene på hemmelighederne. Scriptet indeholder ingen tekst, og lydene
  siger ikke noget på noget sprog, så en oversættelse rører kun HTML'en.
- **Ingen emojis.** Magentos database (utf8mb3) afviser tegn på 4 bytes, så ikonerne er tegnet som SVG.
- **Billederne ligger i Klaviyos billedbibliotek** (`d3k81ch9hvuctc.cloudfront.net`), som butikkens
  sikkerhedsregler allerede tillader.
- **Script i et HTML Code-element virker på bloggen.** Kundeservice-blokken med "Chat med os" gør det
  samme. Butikkens Content-Security-Policy er sat til "report-only" og tillader inline script.
- Al CSS hænger på `#boxulator`, så temaet ikke kan ændre spillet, og spillet ikke kan ændre resten af siden.
- Fremskridtet gemmes kun i den besøgendes egen browser (localStorage). Intet sendes nogen steder hen.

## Afprøvet 30/10 2026

**Den danske version uden tale:** Den er spillet helt igennem ved 375 og 1280 px, i en gemt kopi af DK's
adventskalender-indlæg med butikkens eget tema-CSS. Alle 12 hemmeligheder blev fundet, og diplomet blev vist,
uden overløb og uden JavaScript-fejl. Hver hændelse giver lyd, og ON AIR lyser, mens oplæseren taler.
Fremskridtet overlever en genindlæsning. Alle lyde er renderet offline og målt, så ingen er tavse eller langt
højere end resten, og blokken indeholder ingen tegn på 4 bytes.

**Den tidligere version, alle 16 sprog:**

Alle 16 komprimerede blokke er sat ind i en gemt kopi af DK's adventskalender-indlæg med butikkens eget
tema-CSS. Hver af dem er indlæst uden fejl, regner 2 + 2 = 4, lader Kevin hilse og svare på sproget og giver
400 + 15 % − 120 = 340 i juleformlen. Den danske er desuden spillet helt igennem ved 375 og 1280 px: alle 12
hemmeligheder fundet, diplomet vist, ingen overløb og ingen JavaScript-fejl. Fremskridt og "Du kom tilbage"
overlevede en genindlæsning, og minus-tasten flygtede.
