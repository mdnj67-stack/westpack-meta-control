# Kundeundersøgelse – hvorfor har vi ikke set dig i et år? (side i webshoppen)

Et kort spørgeskema til kunder, der ikke har bestilt i webshoppen det seneste år. Det ligger på **sin egen side i
webshoppen** (en CMS-side), ikke på bloggen. Fra 23/11 er det en side: på bloggen stod skemaet mellem kategorier, tags
og "Seneste indlæg", og det så forkert ud (Mads: "Det her kategori halløj osv ligner lort i siden").

**Kunden svarer med egne ord. Der er ingen svarmuligheder at vælge imellem** (Mads 13/11: "hvis vi får skrevne og
specifikke svar så har det mere værdi"). Det tager under et minut: ét spørgsmål, ét tryk på "Send svar", og så takken.
Der er ingen trintæller og intet kontaktspørgsmål (Mads 23/11: "Der er vel kun et trin?"). Vil kunden tales ved, står
sales@westpack.com i takken.

**Sådan ser siden ud.** Ét stort kort mellem butikkens header og footer. På computer står et foto til venstre i en
ramme inde i kortet: en medarbejder, der smiler med armene fulde af Westpack-æsker (fotoet fra "Om Westpack",
`Jewellery-boxes_woman.jpg` på butikkens CDN), med et lille mærke "Vi læser hvert eneste svar". Til højre står "Vi vil
gerne høre fra dig" som en rød overlinje og spørgsmålet i butikkens røde overskriftsstil. På telefon ligger fotoet som et bånd øverst, og spørgsmål, tekstfelt og knap kan ses
uden at scrolle. Fotoet toner langsomt frem, og ingen bevægelse vises for den, der har slået animationer fra.

**Siden fortæller ikke kunden, at vi ved, hvem de er** (Mads 23/11: "Vi skal ikke fortælle kunden at vi ved hvem de
er"). Der er ingen hilsen med firmanavn, takken nævner ingen navne, og teksten om data nævner ikke, at vi kan se,
hvem svaret er fra. Svaret bliver stadig knyttet til kunden via linket.

1. **"Hvorfor har du ikke handlet hos os på det seneste?"** (Mads 23/11) Et stort tekstfelt. Under overskriften står:
   "Du har tidligere handlet hos Westpack, men det er noget tid siden sidst. Vi vil gerne forstå, hvad der har ændret
   sig." Ved knappen står "Skriv med dine egne ord – én sætning er nok." Feltet vokser, mens man skriver, og "Send svar" virker
   først, når der står en sætning (mindst 12 bogstaver). **Svaret gemmes, når man trykker Send.** Går det ikke
   igennem, prøver siden én gang til, før kunden får en fejlbesked, og teksten bliver stående i feltet. Der er bevidst
   ingen eksempelsvar, for folk skriver eksemplet af i stedet for deres egen grund.
2. **Takken** (Mads 23/11): "Tak for dit svar!" og "Vi sætter stor pris på din feedback og håber, at vi får mulighed
   for at handle sammen igen." Derunder: "Er der noget, vi kan hjælpe dig med, eller noget, der står i vejen for din
   næste bestilling? Så hører vi meget gerne fra dig på sales@westpack.com." Adressen er et link, der åbner en mail.
   Så kommer knappen "Til webshoppen" og linket "Ret mit svar". Spørgsmålet "Må vi vende tilbage til dig om det?" med
   Ja/Nej og e-mailfelt er fjernet.

**Udseendet er butikkens eget**, så siden ligner resten af webshoppen og ikke en kampagne. Den bruger
temaets skrift Inter, Westpack-rød `#d10a11` på knapper og detaljer, og temaets røde overskrifter. Blokken henter ingen
skrifttyper selv.

Butikkens CMS-sider viser ikke sidens titel, så overskriften på fotoet er sidens titel. Den står i blokken
("Vi vil gerne høre fra dig" / "We'd like to hear from you"). Titlen, I skriver i Magento, ses kun i browserfanen.

Svarene gemmes i biblens eget lager (Vercel Blob) og kan læses under **Klaviyo email → Customer survey**. Der ser du
også hver kundes personlige link, og hvem der har svaret. Intet bliver skrevet til Klaviyo, Magento eller Navision.

> **Status 13/11:** Dansk og engelsk. Alle andre butikker viser den engelske tekst, indtil oversættelserne er lavet.
> Den danske tekst skal godkendes først.

## Hvem får linket

Det er de 500 kunder med den største webshop-omsætning gennem tiden, som ikke har bestilt i webshoppen siden
13/11/2025. Følgende er sorteret fra:

- **Kendte KAS-kunder.** Det er kunder med deres egen kundegruppe i webshoppen (aftalepriser) eller et regnskabsår over
  150.000 kr. i Navision. 11 er taget ud.
- **Kunder, der har handlet alligevel.** Det er kunder, hvis e-mail har bestilt i et andet lands konto, og kunder, der
  er faktureret i Navision siden 1. maj 2026.

Navision-dataene indeholder kun DETAIL-kunder. Kontakt derfor ikke nogen fra listen, før et menneske har gennemgået den
for KAS-kunder.

Hver kunde har et personligt link som `https://www.westpack.com/dkk_dk_den/customer-survey-2026#k=abc12345`.
Koden står efter `#`, og svaret bliver knyttet til kunden. Siden viser ikke, at den kender koden. Uden kode virker
siden også, men så er svaret anonymt.

## Sådan laver du siden

> **Siden findes (23/11):** den blev lavet med URL-nøglen `Customer-Survey-2026`, som Magento viser som
> **`customer-survey-2026`** i alle 18 butikker, med titlen "Customer Survey". Alle 3.393 links i biblen, i Excel-listerne
> og i sendescriptet peger dertil. Ændr ikke URL-nøglen nu, for så holder alle links op med at virke. Vejledningen
> herunder er til, hvis siden skal laves igen.

Siden skal have **URL-nøglen `customer-survey-2026`** i alle 18 butikker. Linkene i mailene går dertil, så den skal
være præcis sådan.

1. Gå til **Content → Elements → Pages** i admin, og tryk **Add New Page**.
2. Udfyld felterne:
   - **Enable Page:** Yes
   - **Page Title:** Vi vil gerne høre fra dig. Titlen ses kun i browserfanen. Én side til alle butikker er nok. Vil I
     have en engelsk titel i de andre butikker, så lav to sider med samme URL-nøgle: én til DK og én til de 17 andre.
   - Under **Search Engine Optimization:** URL Key `customer-survey-2026` og Meta Title "Vi vil gerne høre fra dig |
     Westpack". Har I feltet **Meta Robots**, så vælg `NOINDEX,NOFOLLOW`, for siden er kun til dem, der får linket.
   - Under **Page in Websites:** alle 18 store views.
   - Under **Design:** Layout **1 column**, ligesom "Om Westpack" og FAQ. Så står siden uden kolonner og sidebar.
   - Siden skal **ikke** i menuen eller footeren.
3. Indhold: åbn **Page Builder**. Træk ét element af typen **HTML Code** (under Elements) ind. Klik i feltet, tryk
   **Ctrl+A** og **Delete**, så det er tomt, og sæt **hele** indholdet af `survey.html` ind. Tilføj ikke andre
   elementer, heller ikke en overskrift: siden har sin egen. Brug **ikke** den almindelige teksteditor (WYSIWYG), for
   den fjerner `<script>` og `<style>`.
4. Gem, og test i to butikker:
   - `https://www.westpack.com/dkk_dk_den/customer-survey-2026#k=test` – dansk tekst
   - `https://www.westpack.com/gbp_uk_eng/customer-survey-2026#k=test` – engelsk tekst

   Med `#k=test` bliver svaret gemt som en test. I biblen kan det ses med "Show test answers", men det tæller ikke med.
   Er et testsvar alligevel gemt som rigtigt, fx fordi nogen skrev "Test" uden `#k=test`, så tryk **Mark as test** ud
   for det i biblen. Det bliver ikke slettet, men flytter ned under "Show test answers".
5. **Slå blogindlægget fra** (Status: Disabled), når siden virker. Ingen mails linker til det. Et svar, der allerede er
   givet dér, ligger stadig i biblen.

> **23/11:** Først lå skemaet på bloggen: som "Churn survey" på `churn-survey`, så på `customer-feedback-2026` med
> titlen "Customer Feedback Survey". Samme dag blev det flyttet til en side, og siden fik adressen
> `customer-survey-2026`. Der var endnu ikke sendt nogen mails, så intet link i en indbakke peger på en af de gamle
> adresser. Biblen godtager stadig links af de gamle former, og sendescriptet skriver dem om til sidens adresse.
>
> **Mailen sendes fra den delte postkasse "Westpack" (`wpsales@westpack.com`).** Sendescriptet bruger den som
> standard, og en test 23/11 kom frem som `From: Westpack <wpsales@westpack.com>`, ikke "på vegne af". Svarer en kunde
> på mailen, lander svaret i den postkasses indbakke.
>
> Test af hele kæden gennem den rigtige side med rigtige links (svaret gemmes som test, aldrig på kunden):
> `node tmp/playwright-runner/survey-live-e2e.js`. Før siden findes, viser `node tmp/playwright-runner/survey-page-preview.js`
> blokken på en af butikkens rigtige CMS-sider (computer, tablet og telefon, dansk og engelsk) uden at gemme noget.

Samme blok bruges i alle butikker. Den finder selv sproget ud fra butikkens adresse, og "Til webshoppen" peger på den
butik, siden står i. Den virker også, hvis den bliver sat ind i et blogindlæg.

Får du **"Please remove invalid characters"**, er der kommet tegn med i feltet, som databasen ikke kan gemme. Tøm
feltet helt, og sæt filen ind igen.

## Godt at vide

- **En kunde tæller én gang.** Ét besøg er ét svar. En kunde med personligt link tæller én gang, også på tværs af
  besøg og enheder, og det er det nyeste svar, der gælder. Svar fra før 23/11 kan have et kontaktsvar (Ja/Nej) og en
  e-mail; nye svar har ingen.
- **Genindlæser kunden siden** efter at have svaret, ser de takken med "Ret mit svar" i stedet for skemaet igen.
- **Tastatur:** Ctrl+Enter (Cmd+Enter på Mac) sender svaret.
- **Svar fra den første version** (med svarmuligheder) står stadig i biblen med deres grund. Tabellen med grunde vises
  kun, når der er sådanne svar.
- **Beskyttelse mod spam.** Der er et skjult felt, som kun robotter udfylder. Desuden bliver et svar, der er sendt
  hurtigere end 1,2 sekunder efter, at siden blev åbnet, ignoreret.
- **Går serveren ned,** står kunden stadig ved spørgsmålet med sin tekst og en fejlbesked og kan prøve igen.
- **Butikkens nyhedsbrev-popup vises ikke på siden.** Klaviyos "The Insert" åbner på alle sider efter ca. 5 sekunder.
  På skemaet tog den tastaturet, mens kunden skrev (23/11 forsvandt 38-62 skrevne bogstaver i DK, DE og PL), og låste
  siden, så man ikke kunne scrolle. Blokken holder den skjult og ophæver låsen. Der er ikke ændret noget i Klaviyo, og
  andre sider viser den som før. Signup Lab kører heller ikke på siden.
- **Tekst om data nederst:** "Dit svar gemmes hos Westpack og bruges kun til at gøre os bedre."
- **Oversættelse:** al tekst ligger i `STR` i blokkens script, ét sæt pr. sprog. Butikken vælger sproget i
  `STORE_LANG`. Et nyt sprog tilføjes ved at oversætte `da` og indsætte det som fx `de` i `STR`. En test kræver, at
  hvert sprog har alle tekster.
- **Kode:** `api/survey.js` (gemmer og læser), `server/survey/` (regler og lager), `src/customer-survey.js` (siden i
  biblen) og `tests/customer-survey.test.js`.
