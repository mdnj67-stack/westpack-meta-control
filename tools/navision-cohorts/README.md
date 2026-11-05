# Navision cohorts — what a new customer is worth, and what Meta costs per customer

Built 2026-11-04 for the management deck "Meta som investering i nye kunder"
(https://claude.ai/artifact/Yaw6oNh9E4MuDpFHduvfm9). The findings and the measurement-ladder research
are in `knowledge/meta-research/07-measurement-ladder.md`. These scripts reproduce the analysis and
are the "quarterly cohort report" the deck promises.

All data goes to `tmp/navision-cohorts/` (gitignored; override with `NAV_COHORT_DIR`). The Navision
exports hold customer names — never commit them.

## Where the Navision data comes from

ast's workbook `Nye_kunder_SQL_login.xlsm` ("Nye kunder ved første salgsordre"), which queries
`sil-wep-sql01 / westpack-live` with an SQL login stored in Windows. A Windows-integrated login is refused
for ordinary users, and the stored SQL login is the workbook's business: **never read it out of
Windows**. The scripts only press the workbook's own "Opdater fra Navision" button on a copy.

One run returns every customer whose **first-ever** sales order falls in the chosen period, with the
invoiced sales (LCY, ex VAT, credit notes netted) from that first order to the period's end date
(`OmsTilSkaering`), plus the same for the period one year earlier ("Foer" rows). Runs that share a start
date (1 May 2019) and end at each fiscal-year end give each customer's sales per fiscal year as the
difference between two runs.

## Running it

1. `powershell -File tools/navision-cohorts/run-nav-batch.ps1 -Cutoffs 2020-04-30,2021-04-30,2022-04-30,2023-04-30,2024-04-30,2025-04-30,2026-04-30,<yesterday>`
   One run at a time (30–80 s each). A visible Excel window opens and closes; leave it alone.
   `watch-dialogs.ps1` clicks the workbook's "N nye kunder" OK box; anything asking for a login is left
   for the person at the PC and the watcher stops. The first time on a new PC the workbook itself asks
   for the SQL login.
2. `NAV_FULL_TAG=c<yesterday as yyyymmdd> node --max-old-space-size=6000 tools/navision-cohorts/build-cohorts.js`
   → `tmp/navision-cohorts/data/cohorts/customers.json`, one record per customer with sales per fiscal year.
3. Tables: `cohort-tables.js` (all; `--country=IT` for one market), `cohort-markets.js` (markets, first
   invoice size, duplicate-name sensitivity), `ltv-payback.js` (value curve, payback, layer cake),
   `market-payback.js` (value vs Meta cost per market).
4. Meta, from the repo root (it reads the app's config): `node tools/navision-cohorts/meta-fetch.js`
   (9 calls: spend, awareness spend and New_customer on incremental attribution, by country and month)
   and `meta-campaigns.js` (2 calls, campaign level). No retries — the team's dashboard shares the quota.
5. Effect checks: `panel-yoy.js` (country × month year-on-year, cluster bootstrap, placebo),
   `it-es-did.js` (IT vs ES with placebo windows), `geo-power.js` (how big an effect a geo test could see),
   `dfi-pause.js` (DE+FR+IT relaunch vs the other markets), `country-overview.js`.
6. `charts.js` prints the deck's chart snippets (SVG marks + pinned labels) to `data/charts/`.

The analyses carry the November 2026 windows (fiscal years to 2025/26, months to October 2026).
For a new quarter, move those constants forward rather than reading the old numbers as current.

## Traps (each one changed a number before it was found)

- **Order history starts April 2019.** The 2019/20 cohort contains old customers; leave it out.
- **Department codes changed** (GB under 3490/IE until 2020; CZ/SK/HU/RO split from 3400 in 2021).
  Count markets by `Kundeland`, never by `Afdeling`.
- **13 % of first orders are never invoiced.** A new customer is a paying one (`salesToCutoff > 0`).
  The latest month is under-invoiced (October 2026 read 71 % on 3 November against a normal ~95 %).
- **~2 % of customer numbers are the same company twice.** Merging by name moves retention by about one
  point; placeholder names ("Privato", "particulier", "none") are private buyers, not duplicates.
- **Power BI's "new" (no purchase in a year) is not first-order.** The Spain +222 (Jun–Sep 2026) seen in
  Power BI does not exist in first-order data (194 vs 158).
- **Meta keeps 37 months** of insights (country spend from Nov 2023); its incrementality figure exists
  from April 2025, and an absent key is missing, not zero (`meta-load.js`).
- **A first order invoiced after 30 April lands in the next fiscal year** (3–6 % of each cohort). Count a
  repurchase only for customers invoiced in their acquisition year, or "bought again" reads 32 % for 29.5 %.
- **The pre-2019 number series (`10xxxxx`) marks old accounts** first seen in the history: 7.6 % of the
  2020 cohort, 3.4 % of 2021, ≤ 1.4 % later. Negligible for 2022–24 values, 2–4 % on 2020–21.
- **Awareness belongs to the same window as the conversion spend.** An Aug–Oct average understated the
  30-day awareness in DE+FR+IT by a quarter after the relaunch (`market-entry.js` now prorates).
- **Finance's Power BI cohort report (KAS/DETAIL = DETAIL) is not the same "DETAIL".** The workbook selects
  customers by its 25 departments ("DETAIL findes ikke som dimensionsværdi i udtrækket") and counts all their
  sales. Checked 2026-11-05 (`tmp/navision-cohorts/scratch/finance-compare.js`): acquisition years agree within
  0–9 %; later years ours is 5–17 % higher for 2022/23–2024/25 and 34–51 % for 2020/21–2021/22, and the gap is
  70–100 % of what customers buying over 100,000 kr. a year spend (22–33 per old cohort). Finance's DETAIL leaves
  out the customers who grew big. For the deck's cohorts that is 5–9 % less value (5,850 → ~5,300 kr.).
  **Confirmed the same day: they are KAS.** Customer 222356 (4.94m in 2022/23) is absent under DETAIL and present under
  KAS in Power BI; (Tom) is negligible. Dropping every customer whose biggest fiscal year exceeds 150,000 kr. (104 in
  the 2020/21–2025/26 cohorts) reproduces finance's DETAIL report in all 21 cells within −4..+2 % (mean 1.6 %;
  `finance-threshold.js`). Run any script on that basis with `NAV_COHORT_DIR=tmp/navision-cohorts-detail` (filtered
  customers.json, a junction to nav-runs). Value per new customer 5,851 → 5,340; whole account 1.33 → 1.21.
- **Compare all first orders with all first orders** in a recent window: invoiced-only, a 30-day window
  ending today reads 30–50 % down simply because recent orders are not invoiced yet.
