# The Boxulator 3000™ – Kevins æske-lommeregner på bloggen

Et blogindlæg med en lommeregner, der virker. Den hører til W46-mailen "Kevins æske lommeregner"
(udsendes 13/11 2026), hvor Kevin sælger lommeregneren i en tv-shop. Mailen sender folk hertil.

Lommeregneren regner kun i æsker og runder altid op. Hver fjerde udregning lægger den én æske til
"for safety". Minus-tasten er pakket ind i gavebånd. Deler man med nul, danser den og nynner Jingle Bells.
Udvalgte tal giver en kommentar (1953, 48, 96, 72, 180, 7, 20, 2,4, 1987, 600, 0). Hvis man trykker for
hurtigt, bliver den stresset. Ligger den urørt i 25 sekunder, siger den hej. Hvert resultat bliver printet
på en kvittering med en Kevin-kommentar.

Under den står brugsanvisning, datablad, kendte fejl og FAQ. Til sidst kommer **juleformlen**, som Team
Westpack har bygget. Den kan trække fra: sidste års forbrug + forventet vækst − lager = det, man skal
bestille. Den linker til smykkeæskerne, ordrehistorikken og julefristerne.

## Sådan lægger du indlægget op

Indlægget skal ligge i **alle 18 butikker med samme URL-nøgle**, ellers giver mailens link en 404-fejl:

**URL-nøgle: `boxulator-3000`**, altså `…/blog/boxulator-3000` i alle butikker. Den er ledig i alle 18
(tjekket 29/10).

1. Opret et nyt blogindlæg i Amasty Blog, som du plejer.
2. I indholdet indsætter du **ét Page Builder-element af typen "HTML Code"** og sætter hele indholdet af
   sprogets fil ind (se tabellen). Tilføj ikke andet tekst rundt om. Blokken har selv overskrift, tekst
   og billeder.
3. Sæt `cover.jpg` som indlæggets billede i bloglisten.
4. Gem og åbn indlægget på sitet. Tryk 2 + 2 =. Står der "4 æsker" på kvitteringen, virker det.

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
  været læst af en med sproget som modersmål. Kevins engelske replikker er bevidst ikke oversat.
- **Al tekst står i HTML'en**, også kvitteringens kommentarer. Den ligger i en skjult liste nederst i
  blokken. Hvis en sætning skal rettes, så ret den dér. Scriptet indeholder ingen tekst.
- **Billederne ligger i Klaviyos billedbibliotek** (`d3k81ch9hvuctc.cloudfront.net`), som butikkens
  sikkerhedsregler allerede tillader. Skrifttyperne kommer fra Google Fonts.
- **Script i et HTML Code-element virker på bloggen.** Kundeservice-blokken med "Chat med os" gør det
  samme. Butikkens Content-Security-Policy er sat til "report-only" og tillader inline script.
- Al CSS hænger på `#boxulator`, så temaet ikke kan ændre lommeregneren, og lommeregneren ikke kan ændre
  resten af siden.
- Lyden (tastetryk, Jingle Bells) er slået til, men den lyder først, når man trykker. Knappen "Lyd: til"
  slår den fra.

## Afprøvet 29/10 2026

Blokken er sat ind i en gemt kopi af DK's adventskalender-indlæg med butikkens eget tema-CSS og testet
ved 375 og 1280 px: ingen overløb og ingen JavaScript-fejl. Alle funktioner er kørt igennem: regnestykker,
oprunding, sikkerhedsæske, minus, deling med nul, påskeæg, M, K, panik, tastatur og juleformlen
(400 + 15 % − 120 = 340). Det samme på engelsk og tysk. Alle 15 oversættelser er tjekket maskinelt:
script og CSS er uændret, alle tekster og påskeæg er med, links og billeder er uændrede, og Kevins
replikker står på engelsk.
