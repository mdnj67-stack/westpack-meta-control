# Kevins æske-lommeregner på bloggen

Et blogindlæg med en lommeregner, der virker, bygget som et spil. Det hører til W46-mailen "Kevins æske
lommeregner" (udsendes 13/11 2026), og mailen sender folk hertil. Udtrykket er Kevin-klassisk, altså samme stil
som Kevin-mailene fra 2025: bordeaux, rød kant, creme og Georgia.

> **Status 30/10:** Kun den danske fil, `boxulator-da.html`, er den nye version: en artikel med spillet
> (20 hemmeligheder, titler, gummiænder og oplæser) og juleformlen. De 15 andre sprog er en gammel version med
> emojis, som Magento afviser. **Brug dem ikke.** De bliver lavet igen ud fra den danske, når den er godkendt.
>
> **Vil I tilbage til en tidligere dansk version?** Sæt den ind på samme måde. De ligger i `tidligere/`:
> - `boxulator-da-v5.html`: samme spil, uden artikelintro.
> - `boxulator-da-v4.html`: 12 hemmeligheder og ingen titler. Den er også tagget `boxulator-da-v4` i git.

Indlægget er bygget som en artikel i tre dele:

1. **Introen** ("Et spil forklædt som en lommeregner") siger det rent ud: det her er et spil. Den har tre trin.
   - "Skru op for lyden". Knappen **Test lyden** spiller en gummiand og oplæseren, og trykket er også det, der
     låser lyden op i browseren.
   - "Find de 20 hemmeligheder".
   - "Skal du bare bruge et tal?" med et link, der glider ned til juleformlen.
2. **Spillet**, "Udviklet af Kevin · Godkendt af ingen", med en resultattavle øverst: din titel, æsker regnet og
   Kevins Q4-mål. Tavlen står over lommeregneren, så man kan se pointene stige, mens man trykker.
3. **Juleformlen**, "Bygget af Team Westpack · Uden Kevin", som regner rigtigt. Kevins version er vrøvl, holdets
   version er den, man kan bruge.

## Lommeregneren

Den har smykkeæsker som taster og regner kun i æsker:

- Den runder altid op, og nogle gange blander Kevin sig: han lægger en æske til, sætter et nul bag på
  resultatet eller runder op til nærmeste hundrede. Et lille "+1", "×10" eller "↑100" i hjørnet af displayet er
  det eneste, han indrømmer.
- **Combo:** regner man igen inden for 8 sekunder, ganges æskerne med 2, 3, 4 og op til 5. Det står i
  displayet ("×3"), og hvert resultat flyver op som "+56 ×3".
- Hver tredje gang spørger den, om det skal være lidt flere æsker. Der er to knapper, og begge siger ja.
  Svarer man ikke, tager Kevin det som et ja.
- Hvert femte resultat kommer der et **jordskælv**: tasterne bytter plads i ni sekunder.
- Nu og da falder en **guldæske** ned på lommeregneren. Fanger man den, giver den 10 % ekstra æsker.
- Minus-tasten er pakket ind i gavebånd og flygter, når man prøver at trykke på den.
- Alle resultater regner ned som små æsker på lageret ("North Pole South"), til bunken vælter.

## Lyd: ingen taler et rigtigt sprog

Lyden passer derfor i alle 18 butikker:

- Tallene er **gummiænder**, stemt så et tal spiller en lille melodi, og der hopper en and op af tasten. Nu og
  da svarer noget andet i stedet: ko, ged, kat, and, cykelhorn, kukkeur, boing, glidefløjte eller kazoo.
- `+` dytter, `×` siger boing, `÷` glider ned, `C` scratcher en plade, `M` er et kukkeur, minus giver
  "dun dun duuun", `=` giver "ba-dum-tss", og `K` giver et air horn.
- En **oplæser** taler gennem en megafon på et sprog, der ikke findes, med enorm overbevisning. Mens han taler,
  lyser **ON AIR**-skiltet. Et **studiepublikum** siger "åhh" og "øvv", griner og klapper.
- **Kevin siger ikke noget.** Han kigger op over lommeregneren og holder øje.

Al lyd laves i browseren, så der er ingen lydfiler og ingen rettigheder at tænke på. Højttalerknappen slår den fra.
Lyden starter ved første tryk, fordi browsere ikke må spille lyd før. En iPhone spiller lyden, ligesom den spiller
video, også når lydløs-knappen er slået til (Safari 16.4 og nyere).

## 20 hemmeligheder og en titel

Hver gang man finder en hemmelighed, dukker den op over lommeregneren. Efterhånden **forfremmer Kevin én**, og
hver titel pynter lommeregneren lidt mere:

| Titel | Ved | Lommeregneren får |
|---|---|---|
| Praktikant | 0 | – |
| Lagerelev | 2 | en julelyskæde |
| Æske-entusiast | 5 | guldkant på tasterne |
| Box Manager | 8 | grønt baglys i displayet |
| Regional Box Director | 12 | bordeaux kabinet |
| Chief Box Officer | 16 | et lig-med i guld |
| Kevin | 20 | guld over det hele og disko-taster |

Finder man alle 20, får man diplomet "Certified Box Counter™" med en knap til æskerne. Til test, så I ved hvad I
leder efter:

| Hemmelighed | Sådan |
|---|---|
| Første æske | tryk = |
| Rundet op | et resultat med decimaler, fx 10 ÷ 3 |
| Ekstra æske | andet resultat (Kevin lægger én til) |
| Minus-jæger | fang minus-tasten tre gange |
| Mariah-alarm | del med nul |
| Født 1953 | 1953 = (Happy Birthday på kazoo) |
| Glimmer i næsen | tryk 14 taster på 2 sekunder |
| Kevin-fan | tryk K fem gange |
| Overflow | et resultat over 99.999.999 |
| Sagde ja | sig ja til Kevins tilbud |
| Mål nået | nå Kevins Q4-mål (han hæver det bagefter) |
| Lavine | fyld lageret, til det vælter |
| Boop | klik på Kevins hoved over lommeregneren |
| Solformørkelse | klik på solcellen: lommeregneren dør og genstarter |
| På hovedet | 7734 = (den vender sig og siger "hELL") |
| Opsendelse | 3000 = (den flyver) |
| Guldæsken | fang en guldæske |
| Faldt i søvn | rør ingenting i 20 sekunder: den snorker |
| Jordskælv | regn færdig, mens tasterne er blandet |
| I flow | fem resultater i træk, hurtigt (combo ×5) |

Andre tal gør også noget: 0, 112, 911 og juledagene 2412, 2512, 1224 og 1225.

Fremskridtet (hemmeligheder, titel, æsker regnet og Kevins mål) gemmes i den besøgendes browser, så det er der
stadig næste gang. På telefoner reagerer tasterne med det samme og giver et lille vibrations-tik på Android.

## Sådan lægger du indlægget op

Indlægget skal ligge i **alle 18 butikker med samme URL-nøgle**, ellers giver mailens link en 404-fejl:

**URL-nøgle: `boxulator-3000`**, altså `…/blog/boxulator-3000` i alle butikker. Den er ledig i alle 18
(tjekket 29/10).

### I Amasty Blog Pro

1. Gå til indlæggene i Amasty Blog Pro i admin, og opret et nyt indlæg (Add New Post).
2. Titel: se tabellen. Temaet viser indlæggets titel øverst, og spillet har selv overskriften "The Boxulator
   3000™", så titlen er bevidst den anden halvdel og ikke navnet igen. URL-nøgle: `boxulator-3000`.
3. Indhold: åbn **Page Builder** (Edit with Page Builder). Træk ét element af typen **HTML Code** (under
   Elements) ind. Klik i feltet, tryk **Ctrl+A** og **Delete**, så det er tomt, og sæt **hele** indholdet af
   sprogets fil ind. Tilføj ikke andre elementer, for blokken har selv overskrift og tekst. Brug **ikke** den
   almindelige teksteditor (WYSIWYG): den fjerner `<script>` og `<style>`, og så virker lommeregneren ikke.
4. Sæt `cover.jpg` som indlæggets billede (listebillede).
5. Vælg butikken (store view), og gem. Gentag for hver butik med sprogets fil.
6. Åbn indlægget på sitet, og tryk 2 + 2 =. Står der 4 i displayet, og lyser ON AIR, virker det.

Får du **"Please remove invalid characters"**, ligger der stadig gammel kode med emojis i feltet. Tøm feltet
helt, og sæt filen ind igen.

Filerne er komprimerede til cirka 63 KB. Page Builder gemmer et HTML Code-element ukodet
(`data-decoded="true"` på bloggen), så det er den størrelse, der gemmes. Det er under 64 KB, den mindste grænse
Magento kan have for et indlæg. I de komprimerede filer har blokken id'et `kb3` og korte klassenavne. De læsbare
udgaver i `src/` har de lange (`#boxulator`, `bx-…`). Ret altid i `src/`, og lav de komprimerede filer igen.

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

- **Al tekst står i HTML'en**, også navnene på hemmelighederne og titlerne. Scriptet indeholder ingen tekst, og
  lydene siger ikke noget på noget sprog, så en oversættelse rører kun HTML'en.
- **Oversættelserne** (når de laves igen): vores egen oversætter (samme som Duplicate & translate) og derefter
  korrektur af en stærkere model. Hvert marked har sin egen tiltaleform: tysk Sie, fransk vous, portugisisk
  você og du-form i resten. Portugisisk er europæisk, ikke brasiliansk.
- **Ingen emojis.** Magentos database (utf8mb3) afviser tegn på 4 bytes, så ikonerne er tegnet som SVG.
- **Billederne ligger i Klaviyos billedbibliotek** (`d3k81ch9hvuctc.cloudfront.net`), som butikkens
  sikkerhedsregler allerede tillader.
- **Script i et HTML Code-element virker på bloggen.** Kundeservice-blokken med "Chat med os" gør det
  samme. Butikkens Content-Security-Policy er sat til "report-only" og tillader inline script.
- Al CSS hænger på blokkens id, så temaet ikke kan ændre spillet, og spillet ikke kan ændre resten af siden.
- Fremskridtet gemmes kun i den besøgendes egen browser (localStorage). Intet sendes nogen steder hen.

## Afprøvet 30/10 2026

**Den danske version med artikel:** Den komprimerede fil er afprøvet i en gemt kopi af DK's
adventskalender-indlæg med butikkens eget tema-CSS:

- Den er spillet helt igennem ved 375 og 1280 px. Alle 20 hemmeligheder blev fundet, og man blev forfremmet hele
  vejen til Kevin. Diplomet blev vist, og der var ingen JavaScript-fejl.
- "Test lyden" spiller lyd, og "Til juleformlen" lander på formlen. På desktop flugter lommeregneren og
  hemmelighederne i top og bund.
- Fremskridt, titel og pynt overlevede en genindlæsning.
- Et færdigt spil med ni-cifrede tal blev tjekket ved 320, 360, 375 og 414 px: intet stikker ud over kanten.
- Alle lyde er renderet offline og målt, så ingen er tavse eller langt højere end resten.
- Blokken indeholder ingen tegn på 4 bytes.
