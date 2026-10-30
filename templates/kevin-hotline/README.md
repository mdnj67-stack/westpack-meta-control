# Kevins juleæske-hotline på bloggen

Et blogindlæg, hvor man ringer op til Kevins juleæske-hotline. Det hører til W46-mailen "Jule sortimentet
(juleæsker)" (udsendes 9/11 2026), og mailen sender folk hertil. Udtrykket er det samme som i mailen:
mørkegrøn, en beige telefon med mørkt display og creme taster.

**Sådan virker det:**

- Man trykker på den grønne knap. Telefonen ringer op, der er "hul igennem", og Kevins automatiske besked
  spiller. Hans replikker står på skærmen, og hvor enheden har en stemme på sidens sprog, læser den dem op.
  Beskeden kan springes over.
- Bagefter taster man sig gennem menuen. Alle 12 taster gør noget, og ordet under hvert tal siger hvad:
  1 genbestil fra tidligere ordrer, 2 julemotiverne, 3 eget logo udenpå og jul indeni, 4 julefristerne,
  5 Kevin selv (han springer op af en æske og stiller videre til sin rapport), 6 rensdyret (optaget),
  7 Kevin læser sit Excel-ark op, 8 resten af julesortimentet, 9 nyhedsbrevet, * kundenummer (alle numre er
  forkerte, nogle på en særlig måde: prøv 1953 og 212), 0 kundeservice, # menuen igen.
- Taster man ikke noget i 25 sekunder, bliver man sat i kø. Køen tæller den forkerte vej, og ventemusikken er
  Jingle Bells og Glade jul på samme tid, en halv tone forskudt.
- Lægger man på, siger hotlinen "Bip. Bip. Bip." og viser vejen til juleæskerne.
- Finder man alle 12 taster, får man diplomet "Certified Hotline Survivor™" med en knap til juleæskerne.
  Det, man har fundet, og hvor mange gange man har ringet, huskes i browseren, så Kevin siger velkommen
  tilbage næste gang.

Al lyd laves i browseren: rigtige telefontoner på tasterne, ringetone, optagettone og ventemusik. Der er ingen
lydfiler og ingen rettigheder at tænke på. Jingle Bells og Glade jul er fri for ophavsret. Knappen "Lyd: til"
slår lyden fra. På en computer kan man også taste på tastaturet.

**Under telefonen** står "Kort fortalt. Uden Kevin.": hvad en juleæske er, hvordan man bestiller den i
logomodulet, at logotryk er gratis på smykkeæsker, og at de første frister falder 10. december. Den linker til
smykkeæskerne, julemotiv-guiden, ordrehistorikken og julefristerne.

## Sådan lægger du indlægget op

Indlægget skal ligge i **alle 18 butikker med samme URL-nøgle**, ellers giver mailens link en 404-fejl:

**URL-nøgle: `kevins-hotline`**, altså `…/blog/kevins-hotline` i alle butikker. Den er ledig i alle 18
(tjekket 30/10).

1. Opret et nyt blogindlæg i Amasty Blog, som du plejer.
2. I indholdet indsætter du **ét Page Builder-element af typen "HTML Code"** og sætter hele indholdet af
   sprogets fil ind (se tabellen). Tilføj ikke anden tekst rundt om. Blokken har selv overskrift og tekst.
3. Brug titlen fra tabellen.
4. Sæt `cover.jpg` som indlæggets billede i bloglisten.
5. Gem og åbn indlægget på sitet. Tryk på den grønne knap, tryk "Spring beskeden over" og tast 2. Ser du tre
   juleæsker, virker det.

| Butik(ker) | Fil | Titel (indlæggets titel) |
|---|---|---|
| DK | `hotline-da.html` | Kevins juleæske-hotline |
| EU (engelsk), UK, US | `hotline-en.html` | Kevin's Christmas Box Hotline |
| DE | `hotline-de.html` | Kevins Weihnachtsetui-Hotline |
| FR | `hotline-fr.html` | La hotline de Noël de Kevin |
| IT | `hotline-it.html` | La hotline di Natale di Kevin |
| ES | `hotline-es.html` | La línea navideña de Kevin |
| NL | `hotline-nl.html` | Kevins kerstdoos-hotline |
| SE | `hotline-sv.html` | Kevins julask-hotline |
| NO | `hotline-no.html` | Kevins juleeske-hotline |
| FI | `hotline-fi.html` | Kevinin jouluboksi-hotline |
| PL | `hotline-pl.html` | Świąteczna infolinia Kevina |
| PT | `hotline-pt.html` | A linha de Natal do Kevin |
| RO | `hotline-ro.html` | Linia de Crăciun a lui Kevin |
| CZ | `hotline-cs.html` | Kevinova vánoční linka |
| SK | `hotline-sk.html` | Kevinova vianočná linka |
| HU | `hotline-hu.html` | Kevin karácsonyi forródrótja |

Alle filer har **de danske butikslinks** (`dkk_dk_den`). Det er meningen. Blokken skifter selv til den
butik, siden står i, så de samme filer kan bruges overalt. Lad linksene stå. Norge har ingen `christmas.html`;
blokken sender tast 8 til Norges egen julekategori.

## Godt at vide

- **Teksten er maskinoversat** med vores egen oversætter (samme som Duplicate & translate) og har ikke
  været læst af en med sproget som modersmål. Hvert marked har sin egen tiltaleform: tysk Sie, fransk vous,
  portugisisk você og du-form i resten. Alle 16 sprog er læst igennem maskinelt og i stikprøver, og fejl er
  rettet i hånden: ord under tasterne (fx "julesang" i stedet for "jul" på hollandsk, polsk og tjekkisk),
  den italienske overskrift, "Petit papa Noël" på fransk (ophavsretsbeskyttet, og ikke den sang der spiller)
  og former, der gav læseren et køn.
- **Al tekst står i HTML'en**, også Kevins replikker, Excel-fanerne og svarene på kundenumre. De ligger i en
  skjult liste nederst i blokken. Hvis en sætning skal rettes, så ret den dér. Scriptet indeholder ingen tekst.
- **Kevins stemme** er browserens egen oplæsning (Web Speech API) på sidens sprog. Hvor enheden ikke har en
  stemme på sproget, står replikkerne bare på skærmen, og beskeden går videre i læsetempo.
- **Billederne ligger i Klaviyos billedbibliotek** (`d3k81ch9hvuctc.cloudfront.net`), som butikkens
  sikkerhedsregler allerede tillader. Det samme gælder Google Fonts.
- **Script i et HTML Code-element virker på bloggen.** Det er samme teknik som Boxulator-indlægget
  (`templates/kevin-boxulator`). Al CSS hænger på `#kvhotline`, så temaet ikke kan ændre telefonen, og
  telefonen ikke kan ændre resten af siden.
- Links i telefonens kort bærer `utm_source=blog&utm_content=kh_key1` osv., så det kan ses, hvilke taster der
  sender folk videre.

## Afprøvet 30/10 2026

Den danske blok er sat ind i en gemt kopi af DK's adventskalender-indlæg med butikkens eget tema-CSS og spillet
helt igennem ved 375 og 1280 px: ring op, beskeden, alle 12 taster, kundenumre (1234, 1953, tomt), køen efter
25 sekunder med ventemusik, tilbage fra køen, læg på, ring op igen ("velkommen tilbage") og diplomet. Ingen
JavaScript-fejl og intet overløb. Alle 16 sprog er spillet igennem på samme måde ved 375 og 1280 px: ingen
fejl, intet overløb, diplomet vises, og kundenummer-svarene og slutkortet står på sproget.
