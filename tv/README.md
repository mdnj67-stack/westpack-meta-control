# Brændeovnen — afdelingens tv

En brændeovn, der brænder hele dagen på tv'et i afdelingen. Hvert halve minut stiger et af
afdelingens tal op af røgen, bliver stående og brænder så væk igen. Alt tegnes live i browseren
(WebGL) — ingen video, ingen billeder — så ilden aldrig gentager sig.

**Adresse:** https://project-4fcxa.vercel.app/tv

## Sådan sættes den op

1. Åbn adressen i tv'ets browser (eller på en Chromecast/Fire TV-stick/bærbar koblet til tv'et).
2. Skriv koden til Westpack Marketing OS én gang. Skærmen husker den i et år, eller indtil
   koden skiftes.
3. Tryk `F` eller klik på skærmen for fuld skærm.

Skærmen beder browseren om ikke at gå i dvale. Nogle tv'er bestemmer selv; slå i så fald tv'ets
egen pauseskærm/energisparer fra. Hver morgen kl. 05:30 genindlæser siden sig selv, så en ny
version når frem uden at nogen rører tv'et.

## Hvad den viser

Kun tal, som appen selv viser, hentet fra serveren hvert 10. minut:

- **Nye kunder fra Meta** i måneden til og med i går, mod de samme dage sidste måned
  (Metas inkrementelle attribution, som på dashboardet).
- **Pris pr. ny kunde** for de samme dage.
- **Nye mennesker nået** af konverteringskampagnerne (Expansion-fanen).
- **Modtagere af nyhedsbrevet** i alle 18 markeder (medlemmer af den ene nyhedsbrevsliste pr. land).
- **Nyhedsmails leveret** og **klik fra nyhedsmails** i måneden.
- **Dage til juleaften** (fra 60 dage før).

Et tal, der ikke kan hentes korrekt, bliver udeladt — der står aldrig et 0 i stedet for et
manglende tal. Mister skærmen forbindelsen, viser den de sidste tal og skriver
"ingen forbindelse, tal fra kl. …" på ovnens messingplade.

## Ilden følger arbejdsdagen

Tændes kl. 6–7, brænder fuldt til kl. 17, brænder ned til gløder hen over aftenen. Det sparer
strøm og skåner skærmen. Tallene kører videre hele døgnet.

## Til fejlfinding

| Adresse | Gør |
|---|---|
| `/tv?demo` | Eksempeltal uden login. Der står **DEMO · IKKE RIGTIGE TAL** på pladen. |
| `/tv?level=1` | Fuld ild uanset klokkeslæt (`0`–`1.2`). |
| `/tv?debug` | Billeder pr. sekund og opløsning. |

Siden tilpasser selv opløsningen, hvis tv'et er langsomt. Uden WebGL2 vises tallene som almindelig
tekst på en varm baggrund.
