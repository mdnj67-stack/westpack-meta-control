# Kundeundersøgelsen – én side pr. butik

Lavet af `../sprog.js` ud fra `../survey.html`. Ret i `survey.html` og kør `node templates/customer-feedback-survey/sprog.js`,
ikke i filerne her.

Hver butik har sin egen side i Magento (Content → Pages). Alle sider får de samme felter, undtagen butikken og koden:

- **URL Key:** `customer-survey-2026` (præcis sådan – alle links i mailene går dertil)
- **Page in Websites:** kun butikkens eget store view
- **Content Heading:** tom
- **Design → Layout:** 1 column
- **Indhold:** ét **HTML Code**-element i Page Builder. Tøm feltet, og sæt **hele** butikkens fil ind.
- **Page Title** ses kun i browserfanen; forslaget står i tabellen.

Test bagefter med `#k=test` efter adressen, fx `https://www.westpack.com/eur_eu_ger/customer-survey-2026#k=test`,
eller alle 18 på én gang: `node tmp/playwright-runner/survey-languages-check.js`.

| Butik | Store view | Fil | Sprog | Page Title (fanen) |
|---|---|---|---|---|
| Danmark | `dkk_dk_den` | [dkk_dk_den.html](dkk_dk_den.html) | dansk | Vi vil gerne høre fra dig |
| UK | `gbp_uk_eng` | [gbp_uk_eng.html](gbp_uk_eng.html) | engelsk | We'd like to hear from you |
| EU (engelsk) | `eur_eu_eng` | [eur_eu_eng.html](eur_eu_eng.html) | engelsk | We'd like to hear from you |
| USA | `usd_us_eng` | [usd_us_eng.html](usd_us_eng.html) | engelsk | We'd like to hear from you |
| Tyskland | `eur_eu_ger` | [eur_eu_ger.html](eur_eu_ger.html) | tysk | Wir möchten von Ihnen hören |
| Frankrig | `eur_eu_fra` | [eur_eu_fra.html](eur_eu_fra.html) | fransk | Nous aimerions avoir de vos nouvelles |
| Italien | `eur_eu_ita` | [eur_eu_ita.html](eur_eu_ita.html) | italiensk | Ci farebbe piacere sentirti |
| Spanien | `eur_eu_spa` | [eur_eu_spa.html](eur_eu_spa.html) | spansk | Nos gustaría saber de ti |
| Holland | `eur_eu_ned` | [eur_eu_ned.html](eur_eu_ned.html) | hollandsk | We horen graag van je |
| Portugal | `eur_eu_por` | [eur_eu_por.html](eur_eu_por.html) | portugisisk | Gostaríamos de ter notícias suas |
| Sverige | `sek_se_swe` | [sek_se_swe.html](sek_se_swe.html) | svensk | Vi vill gärna höra från dig |
| Norge | `nok_no_nor` | [nok_no_nor.html](nok_no_nor.html) | norsk | Vi vil gjerne høre fra deg |
| Finland | `eur_eu_fin` | [eur_eu_fin.html](eur_eu_fin.html) | finsk | Haluamme kuulla sinusta |
| Polen | `pln_pl_pol` | [pln_pl_pol.html](pln_pl_pol.html) | polsk | Chcielibyśmy poznać Twoje zdanie |
| Rumænien | `eur_eu_rou` | [eur_eu_rou.html](eur_eu_rou.html) | rumænsk | Ne-ar plăcea să aflăm părerea ta |
| Tjekkiet | `eur_eu_cze` | [eur_eu_cze.html](eur_eu_cze.html) | tjekkisk | Rádi bychom slyšeli váš názor |
| Slovakiet | `eur_eu_svk` | [eur_eu_svk.html](eur_eu_svk.html) | slovakisk | Radi by sme poznali váš názor |
| Ungarn | `eur_eu_hun` | [eur_eu_hun.html](eur_eu_hun.html) | ungarsk | Szeretnénk hallani felőled |

UK, EU og USA har samme engelske tekst; filerne er ens bortset fra linket til webshoppen. Butikker uden for de 18
(fx Grækenland, Kroatien) får ingen mails med link, så de behøver ingen side.
