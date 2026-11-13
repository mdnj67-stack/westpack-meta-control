# Kundeundersøgelse – hvorfor har vi ikke set dig i et år? (blogindlæg)

Et kort spørgeskema på bloggen til kunder, der ikke har bestilt i webshoppen det seneste år. Det er lavet til folk, der
ikke vil bruge ret meget tid på os: **ét klik er nok**, og resten er frivilligt. Det tager ca. 20 sekunder, og man ser
ét spørgsmål ad gangen i et kort med "1 af 3" øverst.

1. **"Hvorfor har vi ikke set dig i et stykke tid?"** Otte felter med ikon og kort tekst: lager, bestiller på en anden
   måde, anden leverandør, prisen, leveringen, kvalitet eller logotryk, forretningen har ændret sig, noget andet.
   **Svaret gemmes i det øjeblik, man trykker**, og så går skemaet selv videre. Den, der stopper der, har givet os det
   vigtigste.
2. **Et opfølgende spørgsmål, der passer til grunden. Det kan besvares med ét tryk.** Fx "Hvad gør de bedre end os?"
   med Lavere pris, Hurtigere levering, Lavere minimumsantal, Bedre kvalitet, Et sortiment, vi manglede og En lokal
   leverandør. Eller "Hvornår regner du med at skulle bruge ny emballage?" med Inden for 3 måneder, Om 3–6 måneder,
   Senere og Ved ikke endnu. Der er også et frivilligt tekstfelt, og man kan springe spørgsmålet over.
3. **"Må vi vende tilbage til dig om det?"** Ja eller nej med ét tryk.

Til sidst takker skemaet med firmanavnet. Har kunden svaret "lager" eller "bestiller på en anden måde", får de et link
til at genbestille fra deres ordrehistorik. Udtrykket er bloggens eget: dyb grøn, havre og champagne, Instrument Serif
og Jost, som i W47-indlægget.

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

Hver kunde har et personligt link som `https://www.westpack.com/dkk_dk_den/blog/customer-feedback-2026#k=abc12345`.
Koden står efter `#`, fordi bloggen fjerner alt efter `?` i adressen. Den, der åbner et personligt link, bliver hilst
med firmanavnet ("Til …"), og svaret bliver knyttet til kunden. Uden kode virker siden også, men så er svaret anonymt.
Siger personen ja til at blive kontaktet, bliver de spurgt om deres e-mail.

## Sådan lægger du indlægget op

Indlægget skal have **URL-nøglen `customer-feedback-2026`** i alle butikker. Den var ledig 13/11 i DK, UK, EU, DE og
US. Linkene går dertil, så den skal være præcis sådan.

1. Gå til indlæggene i Amasty Blog Pro i admin, og opret et nyt indlæg (Add New Post).
2. Udfyld felterne:
   - **Titel:** Vi vil gerne høre fra dig (engelske butikker: *We would like to hear from you*)
   - **URL-nøgle:** `customer-feedback-2026`
   - **Status:** *Hidden*, hvis jeres version har den. Så kan indlægget kun åbnes via linket og står ikke i
     blogoversigten. Ellers *Enabled*.
   - **Butikker (store views):** alle 18
   - **Meta title:** Vi vil gerne høre fra dig | Westpack
3. Indhold: åbn **Page Builder** (Edit with Page Builder). Træk ét element af typen **HTML Code** (under Elements)
   ind. Klik i feltet, tryk **Ctrl+A** og **Delete**, så det er tomt, og sæt **hele** indholdet af `survey.html` ind.
   Tilføj ikke andre elementer. Brug **ikke** den almindelige teksteditor (WYSIWYG): den fjerner `<script>` og
   `<style>`.
4. Gem, og test i to butikker:
   - `https://www.westpack.com/dkk_dk_den/blog/customer-feedback-2026#k=test` – dansk tekst
   - `https://www.westpack.com/gbp_uk_eng/blog/customer-feedback-2026#k=test` – engelsk tekst

   Med `#k=test` bliver svaret gemt som en test. I biblen kan det ses med "Show test answers", men det tæller ikke med.

Samme blok bruges i alle butikker. Den finder selv sproget ud fra butikkens adresse, og "Til webshoppen" peger på den
butik, siden står i.

Får du **"Please remove invalid characters"**, er der kommet tegn med i feltet, som databasen ikke kan gemme. Tøm
feltet helt, og sæt filen ind igen.

## Godt at vide

- **En kunde tæller én gang.** Svaret gemmes efter hvert spørgsmål, men ét besøg er ét svar. En kunde med personligt
  link tæller én gang, også på tværs af besøg og enheder, og det er det nyeste svar, der gælder. I biblen står der
  "Stopped after question 1", hvis en kunde ikke gik videre efter første tryk.
- **Genindlæser kunden siden** efter at have svaret, ser de takken med "Ret mit svar" i stedet for skemaet igen.
- **Tastatur:** Piletasterne vælger en grund uden at gå videre, Enter går videre, og fokus flytter til næste spørgsmål.
  Et tryk eller klik går selv videre.
- **Beskyttelse mod spam.** Der er et skjult felt, som kun robotter udfylder. Desuden bliver et svar, der er sendt
  hurtigere end 1,2 sekunder efter, at siden blev åbnet, ignoreret.
- **Går serveren ned,** står kunden stadig på sidste spørgsmål med en fejlbesked og kan prøve igen.
- **Tekst om data nederst:** "Dit svar gemmes hos Westpack og bruges kun til at gøre os bedre. Kom du hertil via et link
  fra os, kan vi se, hvilken kunde svaret er fra."
- **Oversættelse:** al tekst ligger i `STR` i blokkens script, ét sæt pr. sprog. Butikken vælger sproget i
  `STORE_LANG`. Et nyt sprog tilføjes ved at oversætte `da` og indsætte det som fx `de` i `STR`. En test kræver, at
  hvert sprog har alle tekster.
- **Kode:** `api/survey.js` (gemmer og læser), `server/survey/` (regler og lager), `src/customer-survey.js` (siden i
  biblen) og `tests/customer-survey.test.js`.
