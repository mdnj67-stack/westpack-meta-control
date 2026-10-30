# The Boxulator 3000™ – Kevins æske-lommeregner på bloggen

Et blogindlæg med en lommeregner, der virker, bygget som et lille spil. Det hører til W46-mailen "Kevins æske
lommeregner" (udsendes 13/11 2026), og mailen sender folk hertil. Udtrykket er Kevin-klassisk, altså samme stil
som Kevin-mailene fra 2025: bordeaux, rød kant, creme og Georgia.

**Lommeregneren** har smykkeæsker som taster og regner kun i æsker:

- Den runder altid op, og nogle gange blander Kevin sig: han lægger en æske til "for en sikkerheds skyld",
  sætter et nul bag på resultatet eller runder op til nærmeste hundrede.
- Hver tredje gang spørger Kevin, om det skal være lidt flere æsker. Der er to knapper, og begge siger ja.
  Svarer man ikke, tager han det som et ja.
- Minus-tasten er pakket ind i gavebånd og flygter, når man prøver at trykke på den.
- Deler man med nul, danser den og nynner Jingle Bells.
- Udvalgte tal giver en kommentar: 1953, 48, 96, 72, 180, 7, 20, 2,4, 1987, 600 og 0.

Hvert tryk har en fuldstændig malplaceret lyd: ko, kat, ged, and, prut med tungen, boing, laser og kazoo. =
giver "ba-dum-tss", minus en sad trombone og K et air horn. Kevin kigger op over lommeregneren og kommenterer
det hele. Lyden laves i browseren, så der er ingen lydfiler og ingen rettigheder at tænke på. 🔊-knappen slår den fra.

**Spillet:** der er **12 hemmeligheder** at finde, en tæller for "æsker regnet" og **Kevins Q4-mål**, som han
hæver, hver gang man når det. Alle resultater regner ned som små æsker på lageret ("North Pole South"), til
bunken vælter. Finder man alle 12, får man diplomet "Certified Box Counter™" med en knap til æskerne.

**Under spillet** står **juleformlen**, som Team Westpack har bygget, og den kan trække fra: sidste års
forbrug + forventet vækst − lager = det, man skal bestille. Den linker til smykkeæskerne, ordrehistorikken og
julefristerne.

## Sådan lægger du indlægget op

Indlægget skal ligge i **alle 18 butikker med samme URL-nøgle**, ellers giver mailens link en 404-fejl:

**URL-nøgle: `boxulator-3000`**, altså `…/blog/boxulator-3000` i alle butikker. Den er ledig i alle 18
(tjekket 29/10).

1. Opret et nyt blogindlæg i Amasty Blog, som du plejer.
2. I indholdet indsætter du **ét Page Builder-element af typen "HTML Code"** og sætter hele indholdet af
   sprogets fil ind (se tabellen). Tilføj ikke andet tekst rundt om. Blokken har selv overskrift og tekst.
3. Sæt `cover.jpg` som indlæggets billede i bloglisten.
4. Gem og åbn indlægget på sitet. Tryk 2 + 2 =. Står der 4 i displayet, og siger Kevin noget, virker det.

| Butik(ker) | Fil | Titel |
|---|---|---|
| DK | `boxulator-da.html` | The Boxulator 3000™ – Kevins æske-lommeregner |
| EU (engelsk), UK, US | `boxulator-en.html` | The Boxulator 3000™ – Kevin's box calculator |
| DE | `boxulator-de.html` | The Boxulator 3000™ – Kevins Schachtel-Taschenrechner |
| FR | `boxulator-fr.html` | The Boxulator 3000™ – La calculette à boîtes de Kevin |
| IT | `boxulator-it.html` | The Boxulator 3000™ – Il calcolatore di scatole di Kevin |
| ES | `boxulator-es.html` | The Boxulator 3000™ – La calculadora de cajas de Kevin |
| NL | `boxulator-nl.html` | The Boxulator 3000™ – Kevins doos-calculator |
| SE | `boxulator-sv.html` | The Boxulator 3000™ – Kevins ask-kalkylator |
| NO | `boxulator-no.html` | The Boxulator 3000™ – Kevins eske-kalkulator |
| FI | `boxulator-fi.html` | The Boxulator 3000™ – Kevinin laatikkolaskin |
| PL | `boxulator-pl.html` | The Boxulator 3000™ – Kalkulator pudełek Kevina |
| PT | `boxulator-pt.html` | The Boxulator 3000™ – A calculadora de caixas do Kevin |
| RO | `boxulator-ro.html` | The Boxulator 3000™ – Calculatorul de cutii al lui Kevin |
| CZ | `boxulator-cs.html` | The Boxulator 3000™ – Kevinova krabičková kalkulačka |
| SK | `boxulator-sk.html` | The Boxulator 3000™ – Kevinova kalkulačka na krabičky |
| HU | `boxulator-hu.html` | The Boxulator 3000™ – Kevin doboz-számológépe |

Alle filer har **de danske butikslinks** (`dkk_dk_den`). Det er meningen. Blokken skifter selv til den
butik, siden står i, så de samme filer kan bruges overalt. Lad linksene stå.

## Godt at vide

- **Teksten er maskinoversat** med vores egen oversætter (samme som Duplicate & translate) og har ikke
  været læst af en med sproget som modersmål. Hvert marked har sin egen tiltaleform: tysk Sie, fransk vous,
  portugisisk você og du-form i resten. Det er tjekket på tysk, fransk og portugisisk, og to slip er rettet i hånden.
- **Al tekst står i HTML'en**, også Kevins replikker i talebobler og navnene på hemmelighederne. De ligger i en
  skjult liste nederst i blokken. Hvis en sætning skal rettes, så ret den dér. Scriptet indeholder ingen tekst.
- **Billederne ligger i Klaviyos billedbibliotek** (`d3k81ch9hvuctc.cloudfront.net`), som butikkens
  sikkerhedsregler allerede tillader.
- **Script i et HTML Code-element virker på bloggen.** Kundeservice-blokken med "Chat med os" gør det
  samme. Butikkens Content-Security-Policy er sat til "report-only" og tillader inline script.
- Al CSS hænger på `#boxulator`, så temaet ikke kan ændre spillet, og spillet ikke kan ændre resten af siden.

## Afprøvet 30/10 2026

Den danske blok er sat ind i en gemt kopi af DK's adventskalender-indlæg med butikkens eget tema-CSS og spillet
helt igennem ved 375 og 1280 px: alle 12 hemmeligheder fundet, diplomet vist, ingen overløb og ingen
JavaScript-fejl. Minus-tasten flygtede ved hover, og juleformlen gav 400 + 15 % − 120 = 340. Alle 16 sprog er
indlæst og afprøvet på samme måde: 2 + 2 giver 4, Kevin svarer på sproget, og formlen giver 340. Alle 15
oversættelser er tjekket maskinelt: script og CSS er uændret, alle tekster og påskeæg er med, og links og
billeder er uændrede.
