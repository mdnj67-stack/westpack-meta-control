# Westpacks egne blogindlæg – hvordan de ser ud

Dette er en analyse af teamets egne indlæg på westpack.com (DK), lavet 18/11-2026 til W47-indlægget "Den store
forsendelsesguide". Brug den, når et nyt indlæg skal ligne resten. Et indlæg må gerne kunne noget nyt, men layout og
stil skal være som i de andre (Mads, 18/11).

**Kilde:** 14 indlæg er målt i browseren med beregnede styles og fuldsideskærmbilleder:

- Kick-off 9 Mersalg, 9 inspirerende sæt og Kick-off 5 Julelogotryk
- 4 måder at pakke julegaver ind og Mix & Match
- Top 5 smykkeæsker, Top 5 bæreposer og Halloween 2026
- Kick-off intro, Get your shop ready og 3 ways packaging builds your brand
- How to get ready for autumn, Paul Stephenson og Day of the forests

Indlæggene er bygget af forskellige og varierer. De nyeste (Kick-off 9, Top 5 smykkeæsker og bæreposer, 9
inspirerende sæt) deler de samme værdier, og dem er der lagt vægt på her.

## Det, alle indlæg har til fælles

- **Én skrift:** temaets Inter. Brødtekst 14 px med 21 px linjehøjde. H2 20 px halvfed (600), H3 18 px halvfed. Ingen
  anden skrifttype, ingen skråskrift og ingen spærrede versaler.
- **Én spalte:** indholdet følger indlæggets spalte (ca. 797 px ved siden af sidebaren) uden ekstra margen. Afsnit
  står efter hinanden og er adskilt af en tynd streg med ca. 56 px luft over og under.
- **Toppen:** et stort billede i fuld bredde, ofte 3:2. I de nyeste står indledningen først (2-3 korte afsnit), så
  "indholdspiller" (runde links til afsnittene) og så billedet.
- **Overskrifter beskriver:** "Tre enkle tanker om mersalg", "Den nemme løsning: Vælg et færdigt julemotiv", "Mix 1:
  Stockholm ECO i terracotta og grå". Nummererede punkter skrives som "1. …" eller "Mix 1: …".
- **Spørgsmål og svar:** et spørgsmål eller en indvending i almindelig tekst og svaret i fed på næste linje. Eksempel
  fra Julelogotryk: "Vil du hurtigt give din emballage et julet twist?" / **"Så er det her den nemme vej."** Korte,
  fede linjer bruges som slag i teksten.
- **Produktlister:** punktliste, hvor hvert punkt er et link med pil ("Lys grøn luxpose →"), under en H3 som
  "Materialer" eller "Sættet består af".
- **Tips:** en lys boks med en farvet kant til venstre. Kanten er 2-4 px, brun, grå eller sort, og teksten starter med
  "**Tip:**" eller "**Det vigtigste greb:**".
- **Afslutning:** en boks med centreret H2, en kort tekst og en knap. Den er oftest lys. Halloween og Kick-off-intro
  har en mørk afslutning i indlæggets egen farve.

## Værdierne i de nyeste indlæg

| Del | Værdi |
|---|---|
| Overskrifter | #252725, 600, letter-spacing -0,03em |
| Brødtekst | #2f312f, 14/21 px, afsnit med 18 px imellem |
| Grå tekst og numre ("01") | #73766f, 14 px |
| Streger | 1 px #dedfda |
| Bokse og kort | #f5f4f0, 8 px hjørner, 26-28 px indvendig luft, 18-20 px mellem kort, tre i bredden |
| Billedrammer | #f5f3ef bag billedet, 6-8 px hjørner (heltebilledet ofte uden hjørner) |
| Links | #34453f, 600, understreget (4 px under teksten), "Se X →" |
| Knapper | #222 med hvid tekst, 4 px hjørner, 14 px, 17 × 24 px luft, "Shop X ➔" |
| Indholdspiller | hvid, 1 px #d9d9d4 kant, helt runde, 15 px, 10 px imellem |
| Produktfakta | grå piller #f5f4f0 (14 px, #50534f), fx "Gratis logotryk", "Min. 48 stk.", "17 mm høj" |

## Det, der ikke er Westpack

Det første udkast til W47 havde alle disse ting. Kirsten fandt dem, og Mads var enig:

- en anden skrifttype til overskrifterne (Instrument Serif) og skråskrift
- små overskrifter med store, spærrede bogstaver ("TRIN FOR TRIN")
- farvede bånd hen over hele siden, og et nyt baggrundsfarve-tema for hvert afsnit
- et gråt citat over overskriften
- indhold i to spalter, der skifter side for hvert punkt, hvor huset bruger én spalte
- røde mærker; husets mærke for "gratis logotryk" er en grå pille
- animation, der får afsnit til at glide ind, når man scroller

## Sådan blev det målt igen

Med `tmp/playwright-runner` (Chromium) åbnes hvert indlæg én gang. Spalten findes som den mindste boks med de
fleste af indlæggets overskrifter og afsnit. Hvert element skrives ud med type, størrelse, vægt, farve, baggrund,
hjørner og gitter, og der tages et skærmbillede af spalten. Mål et par af de nyeste indlæg igen, før et nyt indlæg
bygges. Teamet laver løbende nye, og stilen kan flytte sig.
