# The measurement ladder for Westpack — what our own data can and cannot show (2026-11-04)

Holst Mouritsen presented a "measurement ladder" (måletrappen) at Social Ads Conference, Copenhagen, on
3 November 2026, which the user found "ultra værdifuldt" (notes: `knowledge/social-ads-conference-2026/`).
This report has three parts: what Westpack's own Navision and Meta data showed when we tried to climb the
ladder (measured 2026-11-04), desk research on the steps we do not have yet, and corrections to reports
03 and 00. The management deck built from it is https://claude.ai/artifact/Yaw6oNh9E4MuDpFHduvfm9; the
scripts are `tools/navision-cohorts/`.

Labels: [Own] measured on Westpack data · [Doc] platform documentation · [Peer] peer-reviewed ·
[Practitioner] · [Vendor] (flag vendor funding) · [Reasoning].

## The ladder and where Westpack stands

| Step | Measures | Westpack (Nov 2026) | Next step |
|---|---|---|---|
| 1 Response | clicks, CTR, CPM | Have (dashboard) | – |
| 2 Reported return | ROAS, CAC, CPA | Have (Meta incremental attribution) | – |
| 3 Brand signals | share of search, relevant traffic, product searches, brand lift | **Missing** | Store Search Console by country now |
| 4 Brand measurement | awareness, consideration | **Missing** | "Where did you first hear about us?" in the first-order Klaviyo mail |
| 5 MMM | value of the next krone; length of the tail | Not now | After a first calibration point |
| 6 Test | holdout / geo test | Natural experiments only | Meta Conversion Lift, Jan–Mar 2027 |
| 7 Attribution | who gets the credit | Have | – |
| 8 Brand equity model | long-term brand value | Later | – |
| 9 Forecasting | budget response | Partly (marginal CAC reads) | Written forecast before every budget change |
| + Customer value | cohorts | **Built 2026-11-04** | Quarterly |

Customer value is not on his ladder and should be: without it no cost per customer can be called good
or bad.

## Part 1 — what our own data showed [Own]

**Data.** Navision first-order customers (113,726 since May 2019; 99,077 ever invoiced) with invoiced
sales per fiscal year, from ast's report run at eight cut-offs; Meta spend by country and month from
November 2023 (the API keeps 37 months) and New_customer on incremental attribution from April 2025.

**What a new customer is worth.**
- Of 100 new customers, 32 buy in the next fiscal year, 23 in the one after, 19 in the third; 43 have bought
  again within four years. Year-2 retention fell cohort by cohort: 39 % (2020/21), 36, 30, 29, 28 % (2024/25).
- Those who stay grow: cohort 2020, sales per active customer 2,268 → 6,113 → 10,677 kr. (year 6).
- Cumulative sales per acquired customer, cohorts 2022–24: 1,913 kr. in the acquisition year (≈6 months
  on average), 3,471 after +1 year, 4,734 after +2, 5,851 after +3 (one cohort), est. 7,744 after +5.
  Cohorts 2020–21 reached 12,639. **75–83 % of five-year sales arrives after the acquisition year.**
- Heavily skewed: in a cohort the top 1 % of customers carry 42 % of sales, the top 10 % 79 %.
  First invoice ≥ 2,000 kr. → 15,000–51,000 kr. over ~3½ years; 500–1,000 kr. → 5,400.
- Maximum cost per new customer to break even (45 % margin): 861 kr. within the acquisition year,
  2,130 within ~2½ years, 3,485 within ~5½ years (35 % / 55 % margin: ×0.78 / ×1.22).
- Each cohort is an annuity: cohort 2020 invoiced 27.6m kr. in its first year and 22.4m in its sixth.

**What Meta costs per new customer (Meta's incremental count).**
- April 2025–September 2026: 1,198 new customers = 5.8 % of 20,685 Navision paying new customers
  (14.3 % on Meta's standard attribution); 2,874 kr. each with all spend, 2,233 with conversion campaigns only.
  By country 3–10 % (US 0.9 %), cost 1,600 (SE, FI) to 4,800 kr. (IT, awareness included).
- Last 90 days by campaign: Conv - 04 - EU 854 kr., Conv - 03 - IT 2,664, Conv - 01 - DE 3,275,
  Conv - 02 - FR 5,784. Awareness ≈ one third of spend.
- Payback at 45 % margin and the 2022–24 value curve: EU in the acquisition year; all conversion
  (2,233) after ~3½ years; all Meta (2,874) after ~4½; IT incl. awareness (4,770) 0.73 kr. per kr. after ~5½.

**Can the effect be seen in Navision? No — in either direction.**
- 12-month rolling: Meta spend ×5.5 (0.48 → 2.66m kr.) while paying new customers +14 % (12,395 → 14,188).
- Country × month, year-on-year, month fixed effects, cluster bootstrap over 17 countries (Nov 2024–Sep
  2026): +0.9 % new customers per extra 10,000 kr. a month, 95 % CI −5.3 % to +8.3 %. Meta's claim
  (≈5.6 % per 10k at the average market size) lies inside; so does zero. A placebo (next year's spend
  change) gives +1.9 % — same size, so it is noise.
- **DE/FR/IT relaunch, Sep–Oct 2026 vs Sep–Oct 2025:** Meta spend +323 % (132k → 559k kr.) against −20 % in
  the other markets; paying new customers +5.0 % vs +5.2 %. Meta claims ≈110 (≈10 %); two months can only
  see ~30 %+. Not a contradiction of Meta, but it rules out Meta as a large hidden engine.
  (May–Aug 2026 was not a real pause: DE/FR/IT still got 268k kr. via the EU campaign and awareness.)

**IT vs ES (the user's idea) — useful as a design, not as proof from history.**
- When IT's conversion campaign started (Sep–Nov 2024) IT grew 69 % y/y vs ES 15 % (DiD +47 %, Poisson CI
  10–96 %). But placebo windows with no conversion spend in either country swing as much: +38 % (2023),
  +84 % (2023/24), +208 % (2021), −61 % (2022), −49 % (2022/23); in 2025, with IT spending most, −4 % and −8 %.
  Monthly correlation IT–ES 2019–24: 0.42. ES is not unexposed: 5–16k kr./month conversion (EU campaign)
  plus up to 12k awareness — "a lot vs a little", not "with vs without".
- Correction to the research agent's advice: ES is **not** disqualified by a Spain anomaly. Power BI's
  +222 (Jun–Sep 2026) is a definition effect; first-order ES customers were 194 vs 158.

**How big an effect a geo test could detect** (SD of the y/y log difference between treated and control,
windows starting May 2022–Aug 2024; MDE = 80 % power, 5 % two-sided):

| Treated vs control | 3 months | 6 months | 12 months |
|---|---|---|---|
| IT vs ES | 613 % | 607 % | 363 % |
| IT vs all other markets | 136 % | 135 % | 97 % |
| Half the EU-campaign markets vs the other half | 139 % | 106 % | 46 % |
| DE vs all other markets | 65 % | 54 % | 27 % |
| DE + FR + IT vs all other markets | 59 % | 47 % | 20 % |

Meta's claimed effect per market is 3–10 %. **No market-level test on Navision new customers can see it
in a practical time**, whatever the design; IT vs ES is the weakest of all. Report 03's Poisson-based
power arithmetic was far too optimistic because real between-country noise dwarfs Poisson noise.

## Part 2 — research on the missing steps

### Step 3: brand signals
- **Share of search** (Binet, IPA 2020) correlates with and leads market share in cars, energy and
  handsets; Hankins/IPA put it at ~83 % of market share [Practitioner]. No peer-reviewed and no B2B
  validation found; critiques: not causal, search outside Google [Practitioner]. Google + Tracksuit
  (June 2026): +5 pts awareness ≈ +5 pts share of search near 30 % awareness [Vendor ×2].
- Google Trends website rescales per request (max 5 terms); the **Trends API** (alpha, July 2025) scales
  consistently, dozens of terms, 1,800 days, by region [Doc] — allowlisted, apply.
- **Search Console**: branded/non-branded filter (Nov 2025, all eligible sites March 2026) in the UI only;
  use a regex in the API. **Keeps 16 months** — store daily by country now [Doc]. Not consent-gated, unlike GA4.
- Westpack traps: **"Westpac"** (the Australian bank) collides with the brand term; most packaging demand is
  generic search, so read brand share beside generic-search share. Competitor set from Google Ads Auction
  Insights; Packhelp, noissue, Vistaprint advertise on Meta (report 04); RAJA/ratioform unverified as rivals.
- **Meta Brand Lift**: self-serve "brand survey" tests in Experiments; minimums from search snippets
  US $30k, CA $19k, BR $23k; EU minimums not retrievable — this **conflicts with report 00's
  $175k/$110k/$64k**; read the real figure in Ads Manager. 2–4 weeks; measures ad recall, not category buyers.
  BA - Reach (~$23k/month) might qualify account-wide only.

### Step 4: brand measurement
- Syndicated trackers measure consumers, not B2B buyers: Tracksuit (US/CA/UK/IE/AU/NZ + FR/DE; Vendr
  median $97,640/yr), Latana from €7,900 per market per year. Custom B2B panel completes ~$40–200 each;
  a 5-point move needs ~1,100 per wave [Vendor; Reasoning]. Not worth it now.
- **Cheapest strong signal:** "Where did you first hear about Westpack?" in the first-order flow. At
  1,400–2,500 new customers a month, 15 % response gives 200–375 answers a month — ten times Meta's
  incremental count. Do it in **Klaviyo**, not on the webshop (`never-change-the-webshop` rule).
- The "Day One list": Google/Bain 2022 — 86 % of B2B buyers have one, 92 % buy from it (1,208 US buyers
  of software, cloud, hardware, telecom, logistics, marketing, industrial); 6sense 2025: 94 % / 77 %
  [Vendor/Consultancy]. Enterprise purchasing; direction only for Westpack.

### Step 5: MMM, and "how long is the tail"
- Meridian 2.1.0 (PyPI 2026-09-25) is still current; GeoX GA 2026-09-09/10 with "brand signals" incl.
  branded Google Query Volume (role in the model unverified). Normal likelihood, no count KPI; drop
  micro-geos; no fixed data minimum [Doc].
- Managed MMM: Cassandra from €3,000/month (0.6 % of media), Sellforte $4,500/month [Vendor list prices].
  Nordic Meridian partners: s360, dentsu Denmark, Artefact. **Not now**: with our noise a model mostly
  returns its prior until an experiment calibrates it.
- The tail: Meridian `max_lag` default 8 weeks; Robyn's Facebook decay bound implies a half-life under
  ~0.6 weeks [Doc]. Long-term multipliers (Profit Ability 2: 2.2×, 58 % of profit after week 13; Meta-
  commissioned Nielsen/Nepa/GfK: ~2.5×; IPA 2025 paid social 1.98×) are big-brand, interested-party
  studies [Vendor/Practitioner]; Cain (2025) warns dual adstock can invent long-term effects [Peer].
  **For a new-customer KPI, the tail that matters is repeat purchase — and we now measure it (Part 1).**

### Step 6: tests
- **Meta Conversion Lift** looks self-serve (campaign started within a year, ≥$5,000 spend and 500
  conversions, ≥28 days recommended) [Practitioner relaying Meta Help] — verify in Ads Manager. Randomised
  at person level inside a market, so between-country noise disappears; the only test with a realistic
  chance of seeing 5–10 %. Power on New_customer must be checked first. Run Jan–Mar 2027, no other edits.
- Geo tools if ever needed: GeoLift (any granularity); Meridian GeoX needs **daily** data, ≥10 geos,
  pre-period ≥3× test [Doc]. Exclude a holdout country from every ad set incl. LAL - EU and cut the EU
  budget by its share, or the rest gets a heavy-up.

### Step 8: brand equity model
- Ehrenberg-Bass/Romaniuk B2B method (LinkedIn B2B Institute 2022): find 5–8 category entry points,
  pick-any CEP × brand grid (n≈300–600), Mental Market Share / Mental Penetration / Network Size.
  For Westpack later: one baseline in DK and DE, recruited outside our own Meta ads, roughly
  $12–60k per market — get quotes. Kantar MDS: out of scale. Meridian full-funnel (branded search as
  mediator) only after 2+ years of stored weekly branded search by country.

### Step 9: forecasting
- Response curves outside the observed spend range are the prior, not data. Validate by predict-then-verify:
  before each budget change, write the expected extra customers with an interval and the read date.

## Recommendations, ranked
1. **Report on Navision**: paying new customers, value after 12 months, blended marketing cost per new
   customer; Meta's incremental count as "Meta's share by Meta's model". Quarterly cohort report.
2. **Store Search Console by country now** (16-month horizon), filter Westpac.
3. **"Where did you first hear about us?"** in the first-order Klaviyo mail, all markets.
4. **Meta Conversion Lift, Jan–Mar 2027**, on Conv - 04 - EU and DE/FR/IT, pre-registered.
5. **Forecast log** before every budget change.
6. Later: Brand Lift if eligible account-wide; CEP baseline; Meridian only after calibration.

## Corrections to earlier reports
- 03 §3 power arithmetic assumed Poisson noise plus a modest factor; measured between-country noise is
  far larger (table above). Treat geo tests on Navision counts as underpowered for Meta-sized effects.
- 00's Brand Lift minimums conflict with Meta's own page as quoted in search — unconfirmed both ways.
- ES is not disqualified as a comparison market by the Power BI "Spain anomaly" — it is a definition effect.
