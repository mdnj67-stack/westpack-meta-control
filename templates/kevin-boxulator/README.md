# Kevins æske-lommeregner på bloggen

Et blogindlæg med en lommeregner, der virker, bygget som et spil. Det hører til W46-mailen "Kevins æske
lommeregner" (udsendes 13/11 2026), og mailen sender folk hertil. Udtrykket er Kevin-klassisk, altså samme stil
som Kevin-mailene fra 2025: bordeaux, rød kant, creme og Georgia.

> **Status 12/11:** Alle 16 sprogfiler er den nye version: en artikel med spillet (20 hemmeligheder, titler,
> gummiænder og oplæser) og juleformlen. De 15 oversættelser er lavet 12/11 ud fra den danske, der er live i DK
> (teksten var identisk med repoets fil). Se "Oversættelserne" nedenfor for, hvordan de er lavet, og hvad der er
> valgt. Ingen af dem er læst af en, der har sproget som modersmål.
>
> **Live i DK (tjekket 12/11):** `…/blog/the-boxulator-3000`. `…/blog/boxulator-3000` giver 404. Brug samme
> URL-nøgle i de andre butikker.
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

**URL-nøgle: `the-boxulator-3000`**, altså `…/blog/the-boxulator-3000` i alle butikker, ligesom DK.

### I Amasty Blog Pro

1. Gå til indlæggene i Amasty Blog Pro i admin, og opret et nyt indlæg (Add New Post), eller åbn DK's indlæg og
   tilføj butikken.
2. Titel: **The Boxulator 3000**, som i DK. URL-nøgle: `the-boxulator-3000`.
3. Indhold: åbn **Page Builder** (Edit with Page Builder). Træk ét element af typen **HTML Code** (under
   Elements) ind. Klik i feltet, tryk **Ctrl+A** og **Delete**, så det er tomt, og sæt **hele** indholdet af
   sprogets fil ind. Tilføj ikke andre elementer, for blokken har selv overskrift og tekst. Brug **ikke** den
   almindelige teksteditor (WYSIWYG): den fjerner `<script>` og `<style>`, og så virker lommeregneren ikke.
4. Udfyld billede og metatekster:
   - **Post image (og listebillede):** `post-image-600.jpg` fra denne mappe (600 × 600). Bloggens liste viser
     alle indlæg i 600 × 600, så det brede `cover.jpg` (1200 × 800) bliver beskåret og skærer Kevin-hovederne
     over. Brug kun `cover.jpg`, hvis et felt beder om et bredt billede. Billedet har ingen tekst, så det kan
     bruges i alle butikker. Displayet viser 3000.
   - **Alt-tekst, meta title og meta description:** se "Felterne pr. sprog" nedenfor.
5. Vælg butikken (store view), og gem. Gentag for hver butik med sprogets fil.
6. Åbn indlægget på sitet, og tryk 2 + 2 =. Står der 4 i displayet, og lyser ON AIR, virker det.

Får du **"Please remove invalid characters"**, ligger der stadig gammel kode med emojis i feltet. Tøm feltet
helt, og sæt filen ind igen.

Filerne er komprimerede til 63,1-63,9 KB (tysk er størst). Page Builder gemmer et HTML Code-element ukodet
(`data-decoded="true"` på bloggen), så det er den størrelse, der gemmes. Det er under 64 KB, den mindste grænse
Magento kan have for et indlæg. Der er plads til et par hundrede tegn mere, ikke til et afsnit. I de komprimerede
filer har blokken id'et `kb3` og korte klassenavne. De læsbare udgaver i `src/` har de lange (`#boxulator`,
`bx-…`). Ret altid i `src/`, og lav de komprimerede filer igen.

### Felterne pr. sprog

Indlæggets titel er **The Boxulator 3000** i alle butikker. Meta description kan også bruges som kort beskrivelse
i listen. Butikker med samme sprog bruger samme fil og samme felter.

#### DK - `boxulator-da.html`

- **Meta title:** The Boxulator 3000: Kevins æske-lommeregner | Westpack
- **Meta description:** Kevin har bygget en lommeregner af smykkeæsker. Find de 20 hemmeligheder, eller lad juleformlen regne ud, hvor mange æsker du skal bestille før jul.
- **Alt-tekst:** Kevin kigger frem bag The Boxulator 3000, en kæmpe lommeregner med smykkeæsker som taster

#### EU (engelsk), UK, US - `boxulator-en.html`

- **Meta title:** The Boxulator 3000: Kevin’s box calculator | Westpack
- **Meta description:** Find the 20 secrets in Kevin's calculator, or let the Christmas Formula work out how many boxes you need to order before Christmas.
- **Alt-tekst:** Kevin, wearing a Santa hat, peeks out from behind The Boxulator 3000, a giant calculator with jewellery boxes for keys

#### DE - `boxulator-de.html`

- **Meta title:** The Boxulator 3000: Kevins Schachtelrechner | Westpack
- **Meta description:** Finden Sie die 20 Geheimnisse oder lassen Sie die Weihnachtsformel berechnen, wie viele Schachteln Sie vor Weihnachten bestellen sollten.
- **Alt-tekst:** Kevin trägt eine Weihnachtsmütze und schaut hinter The Boxulator 3000 hervor, einem riesigen Taschenrechner mit Schmuckschachteln als Tasten.

#### FR - `boxulator-fr.html`

- **Meta title:** The Boxulator 3000 : la calculatrice de Kevin | Westpack
- **Meta description:** Trouvez les 20 secrets, ou laissez la formule de Noël calculer combien d’écrins commander avant Noël.
- **Alt-tekst:** Kevin, coiffé d’un bonnet de Noël, pointe la tête de derrière The Boxulator 3000, une calculatrice géante avec des écrins à bijoux en guise de touches

#### IT - `boxulator-it.html`

- **Meta title:** The Boxulator 3000: la calcolatrice di Kevin | Westpack
- **Meta description:** Trova i 20 segreti oppure lascia che la formula natalizia calcoli quanti astucci devi ordinare prima di Natale.
- **Alt-tekst:** Kevin, con un cappello da Babbo Natale, fa capolino da dietro The Boxulator 3000, una calcolatrice gigante con astucci per gioielli al posto dei tasti

#### ES - `boxulator-es.html`

- **Meta title:** The Boxulator 3000: calculadora de cajas de Kevin | Westpack
- **Meta description:** Encuentra los 20 secretos de Kevin o deja que la fórmula navideña calcule cuántas cajas tienes que pedir antes de Navidad.
- **Alt-tekst:** Kevin, con gorro navideño, asomándose por detrás de The Boxulator 3000, una calculadora gigante cuyas teclas son cajas para joyas

#### NL - `boxulator-nl.html`

- **Meta title:** The Boxulator 3000: Kevins doosjesrekenmachine | Westpack
- **Meta description:** Vind de 20 geheimen in Kevins rekenmachine van sieradendoosjes, of laat de kerstformule uitrekenen hoeveel doosjes je voor kerst moet bestellen.
- **Alt-tekst:** Kevin gluurt met een kerstmuts op vanachter The Boxulator 3000, een gigantische rekenmachine met sieradendoosjes als toetsen

#### SE - `boxulator-sv.html`

- **Meta title:** The Boxulator 3000: Kevins miniräknare av askar | Westpack
- **Meta description:** Kevin har byggt en miniräknare av smyckesaskar. Hitta de 20 hemligheterna, eller låt julformeln räkna ut hur många askar du ska beställa före jul.
- **Alt-tekst:** Kevin med tomteluva kikar fram bakom The Boxulator 3000, en jättelik miniräknare med smyckesaskar som knappar

#### NO - `boxulator-no.html`

- **Meta title:** The Boxulator 3000: Kevins kalkulator av esker | Westpack
- **Meta description:** Kevin har bygget en kalkulator av smykkeesker. Finn de 20 hemmelighetene, eller la juleformelen regne ut hvor mange esker du bør bestille før jul.
- **Alt-tekst:** Kevin i nisselue kikker frem bak The Boxulator 3000, en kjempekalkulator med smykkeesker som taster

#### FI - `boxulator-fi.html`

- **Meta title:** The Boxulator 3000: Kevinin korurasialaskin | Westpack
- **Meta description:** Kevin rakensi laskimen korurasioista. Löydä 20 salaisuutta tai anna joulukaavan laskea, kuinka monta rasiaa sinun kannattaa tilata ennen joulua.
- **Alt-tekst:** Kevin kurkistaa tonttulakissa The Boxulator 3000 -jättilaskimen takaa. Laskimen näppäimet ovat korurasioita.

#### PL - `boxulator-pl.html`

- **Meta title:** The Boxulator 3000: kalkulator Kevina z opakowań | Westpack
- **Meta description:** Znajdź 20 sekretów lub pozwól, by świąteczny wzór policzył, ile opakowań musisz zamówić przed świętami.
- **Alt-tekst:** Kevin w czapce Mikołaja wygląda zza The Boxulator 3000, wielkiego kalkulatora, którego przyciskami są opakowania jubilerskie

#### PT - `boxulator-pt.html`

- **Meta title:** The Boxulator 3000: a calculadora do Kevin | Westpack
- **Meta description:** Encontre os 20 segredos ou deixe que a fórmula de Natal calcule quantas caixas deve encomendar antes do Natal.
- **Alt-tekst:** Kevin, com um gorro de Natal, espreita por detrás de The Boxulator 3000, uma calculadora gigante cujas teclas são caixas para joias.

#### RO - `boxulator-ro.html`

- **Meta title:** The Boxulator 3000: calculator din cutii de Kevin | Westpack
- **Meta description:** Găsește cele 20 de secrete sau lasă Formula de Crăciun să calculeze câte cutii să comanzi înainte de Crăciun.
- **Alt-tekst:** Kevin, cu căciulă de Crăciun, se uită de după The Boxulator 3000, un calculator uriaș ale cărui taste sunt cutii de bijuterii.

#### CZ - `boxulator-cs.html`

- **Meta title:** The Boxulator 3000: kalkulačka z krabiček | Westpack
- **Meta description:** Kevin postavil kalkulačku ze šperkovnic. Najděte 20 tajemství, nebo nechte vánoční vzorec spočítat, kolik krabiček máte před Vánoci objednat.
- **Alt-tekst:** Kevin ve vánoční čepici vykukuje zpoza The Boxulator 3000, obří kalkulačky, jejíž tlačítka jsou šperkovnice.

#### SK - `boxulator-sk.html`

- **Meta title:** The Boxulator 3000: kalkulačka z krabičiek | Westpack
- **Meta description:** Kevin postavil kalkulačku z krabičiek na šperky. Nájdi 20 tajomstiev alebo nechaj vianočný vzorec vypočítať, koľko krabičiek máš objednať pred Vianocami.
- **Alt-tekst:** Kevin vo vianočnej čiapke vykúka spoza The Boxulator 3000, obrovskej kalkulačky s krabičkami na šperky namiesto tlačidiel.

#### HU - `boxulator-hu.html`

- **Meta title:** The Boxulator 3000: Kevin dobozszámológépe | Westpack
- **Meta description:** Kevin ékszerdobozokból épített számológépén megtalálhatod a 20 titkot, vagy a karácsonyi képlet kiszámolja, hány dobozt rendelj karácsony előtt.
- **Alt-tekst:** Kevin mikulássapkában kikukucskál The Boxulator 3000 mögül, az óriás számológép gombjai pedig ékszerdobozok.

Alle filer har **de danske butikslinks** (`dkk_dk_den`). Det er meningen. Blokken skifter selv til den
butik, siden står i, så de samme filer kan bruges overalt. Lad linksene stå.

## Godt at vide

- **Al tekst står i HTML'en**, også navnene på hemmelighederne og titlerne. Scriptet indeholder ingen tekst, og
  lydene siger ikke noget på noget sprog, så en oversættelse rører kun HTML'en.
- **Oversættelserne (12/11)** er lavet med vores egen oversætter (samme som Duplicate & translate, med hvert
  markeds tiltaleform). Derefter har en stærkere model læst hver tekst ved siden af den danske som korrekturlæser,
  og hvert fund er gennemgået: 335 rettelser kom med. Rettelser, der gjorde teksten dårligere, blev afvist, fx
  forkortelser som "Arrondi sup." og "Obiettivo!", og nederlandsk "Ingeslapen", der også betyder "død". Tiltale:
  tysk Sie, fransk vous, portugisisk você, tjekkisk vy og du-form i resten. Portugisisk er europæisk.
  - **Ordet for æske følger butikken**, hvor butikkens ordliste har ét: écrin (FR), astuccio (IT), Schachtel (DE),
    opakowanie (PL, ordlisten har aldrig "pudełko"), šperkovnice for smykkeæsker og krabička for lommeregnerens
    æsker (CZ). Samme ord står i alle strenge på et sprog: resultattavlen og diplomet siger det samme, og
    juleformlen hedder det samme i trin 3, linket og overskriften.
  - **De tre engelske titler** (Box Manager, Regional Box Director, Chief Box Officer) står på engelsk i alle sprog,
    ligesom på dansk. Det er joken. "Certified Box Counter", "North Pole South" og "ON AIR" står også på engelsk.
  - **Lange ord har bløde bindestreger** (`&shy;`), ligesom "Sol&shy;formør&shy;kelse" på dansk. Feltets CSS
    knækker et ord, der ikke kan være der, midt i ordet. Derfor er hvert ord målt i browseren med sin egen skrift
    ved 320, 375, 414 og 1280 px, og hvert ord, der var for bredt, fik bløde bindestreger efter sprogets egne
    orddelingsregler. "99 999 999" har smalle hårde mellemrum, så tallet ikke deles over to linjer.
  - Rettes en tekst, så tjek længden: navnene på hemmelighederne står under en lille flise.
- **Ingen emojis.** Magentos database (utf8mb3) afviser tegn på 4 bytes, så ikonerne er tegnet som SVG.
- **Billederne ligger i Klaviyos billedbibliotek** (`d3k81ch9hvuctc.cloudfront.net`), som butikkens
  sikkerhedsregler allerede tillader.
- **Script i et HTML Code-element virker på bloggen.** Kundeservice-blokken med "Chat med os" gør det
  samme. Butikkens Content-Security-Policy er sat til "report-only" og tillader inline script.
- Al CSS hænger på blokkens id, så temaet ikke kan ændre spillet, og spillet ikke kan ændre resten af siden.
- Fremskridtet gemmes kun i den besøgendes egen browser (localStorage). Intet sendes nogen steder hen.

## Afprøvet 12/11 2026 (de 15 oversættelser)

Hver komprimeret fil er sat ind i en gemt kopi af det live DK-indlæg med butikkens eget tema og sidens sprog
(`<html lang>`), uden butikkens egne scripts:

- Script, CSS, links, billeder, id'er og tasterne er tegn for tegn som i den danske fil. Kun teksten er ændret.
  Der er ingen tegn på 4 bytes og ingen NUL-tegn.
- Ingen JavaScript-fejl. 2 + 2 = giver 4. Komma-tasten viser sprogets decimaltegn (punktum på engelsk).
  Juleformlen giver 450 for 500 / 10 % / 100.
- Ved 320, 360, 375, 414 og 1280 px stikker intet ud, hverken i et nyt eller i et færdigt spil. Intet ord er bredere
  end sin boks, undtagen det store tal på engelsk ved 320 px. Det er 2 px for bredt, ligesom på dansk.
- Den komprimerede danske fil, lavet med samme værktøj, er byte for byte identisk med den, der er live.

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
