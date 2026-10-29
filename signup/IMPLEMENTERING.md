# Signup Lab – implementering

Alt er bygget, testet og deployet. Der mangler to ting, og ingen af dem kræver kode:

1. **Tagget på butikkerne** – én linje i Google Tag Manager. Det kan sættes ind nu: indtil vi tænder, gør det
   ingenting.
2. **At tænde** – én linje her i repoet og et script, der slukker The Insert-popupperne i Klaviyo. Det gør vi
   samme dag, i de samme minutter.

## 1. Tagget (kræver adgang til Tag Manager)

Alle 18 butikker bruger samme container, **GTM-5QRXWTJ** (læst på hver butiks forside 2026-10-29). Ét tag dækker
dem alle.

- **Tagtype:** Custom HTML
- **Indhold:**

  ```html
  <script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>
  ```

- **Trigger:** All Pages (Page View), én gang pr. side.
- Scriptet finder selv butikken i adressen (`/eur_eu_ger/…` → Tyskland), venter selv på svaret i cookie-banneret,
  før det viser noget, sætter ingen cookies og holder sig selv væk fra kurv, checkout, konto, nyhedsbrevssiden,
  udsalg og outlet. Det kører i sin egen shadow root, så det hverken kan ødelægge eller ødelægges af butikkens CSS.

**Tjek at tagget virker:** åbn en hvilken som helst butik med `?wps=preview` bag adressen, fx
`https://www.westpack.com/dkk_dk_den/?wps=preview` (eller `?wps=logo-studio`, `?wps=swipe-match`,
`?wps=pack-and-ship`). Oplevelsen åbner med det samme, på butikkens sprog. I den tilstand går en tilmelding kun til
testlisten "TEST - Signup Lab (preview only)" i DK-kontoen. Uden parameteren sker der intet, før vi tænder.

## 2. At tænde

Kør det i den rækkefølge, uden pause imellem:

1. Sæt `const LIVE = true;` i `signup/core/markets.js`, commit og push. Vent til
   `node tools/signup/go-live.js status` siger `LIVE = true` (3–5 minutter).
2. `node tools/signup/go-live.js unpublish --apply` – slukker The Insert-popupperne i alle 18 Klaviyo-konti, så ingen
   får to popups. Kun formularer, der hedder "… - Popup - The Insert …", røres. De indlejrede formularer (forside,
   nyhedsbrevsside) og "Always on sale"-flyoutet, der kun vises på udsalgs- og outletsider, bliver.
3. `node tools/signup/store-check.js tmp/signup-store-check` – åbner alle 18 butikker som en besøgende og tjekker,
   at oplevelsen kommer af sig selv, på det rigtige sprog med butikkens samtykketekst, og aldrig i kurven.

The Insert-popupperne, der slukkes (live 2026-10-29):

| CZ | DE | DK | ES | EU | FI | FR | HU | IT | NL | NO | PL | PT | RO | SE | SK | UK | US |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W2HqGi | Uf83fC | SPPrjA | Vdfmib | RkRWsd | SrgpCY | YmiXMm | RLPAUc | UDdGe8 | SqF9AC | TibdhM | Y745pu | WdpFvf | U742Dy | SV3VHk | S7kChL | TVzpg7 | WZ5YLi |

**Rul tilbage:** `const LIVE = false;` og deploy, og `node tools/signup/go-live.js republish --apply` (genudgiver
præcis de formularer, `unpublish` slukkede; de er gemt i `tmp/signup-go-live-unpublished.json`, og ellers kan de
gives som `DK:SPPrjA` osv.). Ét marked slås fra med `enabled: false` på markedet i samme fil.

## 3. Første uge

- **Hver dag:** `GET /api/signup/track?action=report&env=live&from=<startdato>` (tragten pr. oplevelse, enhed og
  marked) og `GET /api/signup/track?action=confirmed&from=<startdato>` (indsendt, bekræftet på listen og taget af
  Klaviyos bot-filter). Log ind i appen først.
- **Bot-andelen skal være tæt på nul.** Klaviyo undertrykte gentagne automatiske test-tilmeldinger som
  `BOT_PROTECTION`. Rigtige mennesker forventes at gå igennem, men det er det første tal at se på. Ellers kontaktes
  Klaviyo, før testen fortsætter.
- **A/B:** de tre oplevelser ligeligt fordelt. Cirka fire uger før en forskel på 30 % kan ses; stop ikke på en flot
  første uge. Vinderen vælges på bekræftede tilmeldinger pr. visning.

## Ikke blokerende, men værd at vide

- **Sprog:** dansk og engelsk er skrevet til formålet. De 15 andre er transcreeret og bagefter læst igennem af en
  uafhængig korrekturlæsning (`node tools/signup/proofread.js`, 2026-10-29): 56 rettelser (fagord for varmprægning
  med folie, grammatik, retstavning, typografi), mens forslag, der ville erstatte butikkens egne formuleringer,
  blev afvist. Det er ikke en modersmålslæsning; lad en med sproget som modersmål læse de største markeder, når der
  er lejlighed.
- **Tyskland og double opt-in:** alle 18 lister er single opt-in, ligesom Klaviyo-formularerne i dag. Tysk praksis
  peger mod double opt-in; det er en beslutning i Klaviyo (listen og en tysk bekræftelsesmail), ikke en kodeændring.
  Sættes listen til double opt-in, sættes `optIn: "double"` for DE, så takketeksten beder om bekræftelse.
- **Safari på iPhone** er ikke testet på en rigtig telefon. Chrome, Edge og Firefox tegner trykket inden for 0,06 %
  af det målte låg; WebKit til Windows tegner perspektivet fladt, og siden skifter da selv til den bedste flade
  tilnærmelse. Ægte Safari bør tegne perspektivet korrekt – åbn `?wps=preview` på en iPhone og se efter.

---

## For the Tag Manager administrator (English)

Please add one tag to container **GTM-5QRXWTJ** (used by all 18 Westpack stores):

- Tag type: **Custom HTML**, firing **once per page** on **All Pages**
- HTML: `<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>`

The script is inert until Westpack switches it on from its own side, so it is safe to publish now. It sets no
cookies, waits for the visitor's answer in the cookie banner before showing anything, and runs inside its own
shadow root. To check it after publishing, open any store with `?wps=preview` appended, e.g.
`https://www.westpack.com/dkk_dk_den/?wps=preview` – a newsletter signup opens straight away (in test mode). Without
the parameter nothing should happen. To remove it, pause or delete the tag.
