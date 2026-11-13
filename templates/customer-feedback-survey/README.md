# Kundeundersøgelse – hvorfor har vi ikke set dig i et år? (blogindlæg)

Et kort spørgeskema på bloggen til kunder, der ikke har bestilt i webshoppen det seneste år. Tre spørgsmål:

1. **Hvad er den vigtigste grund?** (ét svar: lager, bestiller på en anden måde, anden leverandør, pris, levering,
   kvalitet/logotryk, forretningen har ændret sig, andet)
2. **Et opfølgende spørgsmål, der passer til svaret.** Fritekst og valgfrit, fx "Hvad gør den nye leverandør bedre end
   os?" eller "Hvornår regner du med at skulle bruge ny emballage?"
3. **Må vi kontakte dig om dit svar?** (ja/nej)

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

- **En kunde tæller én gang.** Svarer de igen, er det det nyeste svar, der gælder.
- **Beskyttelse mod spam.** Der er et skjult felt, som kun robotter udfylder. Desuden bliver et svar, der er sendt
  hurtigere end 2,5 sekunder efter, at siden blev åbnet, ignoreret.
- **Tekst om data under knappen:** "Vi gemmer dit svar hos Westpack og bruger det kun til at blive bedre. Kom du hertil
  via et link fra os, kan vi se, hvilken kunde svaret er fra."
- **Oversættelse:** al tekst ligger i `STR` i blokkens script, ét sæt pr. sprog. Butikken vælger sproget i
  `STORE_LANG`. Et nyt sprog tilføjes ved at oversætte `da` og indsætte det som fx `de` i `STR`. En test kræver, at
  hvert sprog har alle tekster.
- **Kode:** `api/survey.js` (gemmer og læser), `server/survey/` (regler og lager), `src/customer-survey.js` (siden i
  biblen) og `tests/customer-survey.test.js`.
