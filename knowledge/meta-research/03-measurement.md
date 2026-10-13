# Measurement, attribution and incrementality on Meta, 2025–2026: evidence for Westpack

Research date: 2026-10-13. Desk research only: no Meta API calls, nothing read from the ad account.
Evidence grades used throughout: **[Doc]** platform documentation or regulator text, **[Peer]**
peer-reviewed or academic working paper, **[Vendor]** figures from a company that sells measurement
(Haus, Stella, WorkMagic, Sellforte, Triple Whale, Seer as an agency), **[Practitioner]** blogs and
trade press, **[Reasoning]** this report's own inference or arithmetic. Awareness-specific evidence
(Haus upper-funnel factors, Binet & Field) is in `00-awareness-and-budget-split.md` and is only
referenced here.

**Summary.** Meta's Incremental Attribution (IA, April 2025) is a model, not an experiment: it
predicts per campaign and query how many conversions were caused by ads, trained on Meta's
Conversion Lift studies. The closest public description of the method is the Gordon–Moakler–Zettelmeyer
"PIE" paper (2,226 Meta RCTs, out-of-sample R² 0.88 against 0.19 for 7-day last-click), which makes
IA a far better default reporting basis than any click/view window. It is not a substitute for a test
on Westpack's own data, though. For Westpack, IA is *not* uniformly conservative: on Conv - 04 - EU,
where 85% of reported purchases are 1-day view, IA credits roughly 2.7x the click-through count. The
only independent evidence on *optimising* to IA (Haus, July 2026, modest sample, vendor) found IA
optimisation earned 1.26x the incremental return of standard settings in the last 12 months, after
losing (0.80x) the year before. That is the strongest outside argument against the DE/FR/IT switch to
standard optimisation, and it should be checked on Westpack's own first-time-buyer data, not taken on
trust. Meta's own Conversion Lift is almost certainly under-powered at ~20–40 incremental new
customers a week unless the holdout is large. A geo test on Magento first-time buyers using
sub-national regions is feasible but needs a power simulation first. Westpack has already run an
accidental one: DE/FR/IT ran no Meta ads from May to August 2026. MMM is not worth building at this
size today. API changes in January 2026 removed 7-day and 28-day view windows and capped unique-count
breakdowns at 13 months, which affects the dashboard's reach history. The reporting rule for
management should be: Magento first-time buyers by market are the truth, Meta's IA figure is a
modelled share of them, and an experiment settles disputes between the two.

---

## 1. Meta's Incremental Attribution, attribution windows and what changed in 2025–2026

### 1.1 What IA is

- **Launch and availability.** Rolled out in Ads Manager in April 2025. Reporting data is
  retroactive to 1 April 2025, and it can be viewed through Columns → Compare attribution settings
  without changing delivery. [Practitioner: Seer Interactive, 2025-07-30,
  https://www.seerinteractive.com/insights/we-tested-metas-new-incremental-attribution-setting-on-1m-in-ad-spend.-heres-how-it-works;
  Stella, https://www.stellaheystella.com/blog/metas-new-incremental-attribution-model-a-step-forward-or-a-step-back]
  Meta's own help articles exist ("How to use incremental attribution",
  https://www.facebook.com/business/help/644554008179419; "How to view results for incremental
  attribution", https://www.facebook.com/business/help/1271619100603114), but both returned only
  their title to the fetcher on 2026-10-13, so their body text is **not verified here**.
- **Two uses.** (a) An *optimisation* setting at ad-set level, chosen under the performance goal
  ("Show more options" → attribution model: Standard or Incremental) for Sales-type objectives with
  Maximise conversions / value; and (b) a *reporting* basis. Selecting Incremental removes the
  click/engage/view window controls. Not available on Traffic or Awareness objectives.
  [Practitioner: Jon Loomer, 2026-03-10, https://www.jonloomer.com/meta-ads-attribution-2026/;
  WorkMagic, updated 2026-04-25, https://www.workmagic.io/blog/incremental-attribution-meta]
- **API.** `action_attribution_windows` accepts `incrementality` alongside `1d_click`, `7d_click`,
  `1d_view`. [Doc: Insights breakdowns, https://developers.facebook.com/docs/marketing-api/insights/breakdowns]
  This is what Westpack's dashboard already uses.

### 1.2 What the model is

- **Meta's description, as relayed:** machine-learning models trained on Meta's historical
  Conversion Lift data that predict whether a conversion would have happened without the ad. There
  is no advertiser-designed holdout behind any specific figure. [Practitioner/Vendor summaries above;
  BooleanMaths, 2025-05-03, https://booleanmaths.substack.com/p/understanding-metas-new-incremental]
- **The closest public method: PIE.** Gordon (Northwestern), Moakler (Meta) and Zettelmeyer,
  "Predicted Incrementality by Experimentation (PIE) for Ad Measurement", Management Science
  (https://pubsonline.informs.org/doi/10.1287/mnsc.2023.01108), NBER WP 35044, April 2026
  (https://www.nber.org/papers/w35044); arXiv 2304.06828. [Peer]
  - Treats measurement as **campaign-level prediction**: train on RCTs, predict incremental
    conversions for campaigns that were never tested, using post-campaign signals (including
    last-click counts) as features.
  - On 2,226 Meta experiments: out-of-sample R² 0.88 for incremental conversions per dollar,
    against 0.19 for 7-day last-click. Decisions disagree with the RCT in 8–12% of campaigns,
    against 12–20% for last-click.
  - The arXiv version states that Meta's Incremental Attribution "makes use of similar approaches"
    (as reported by the search summary; the NBER page itself does not name the product).
  - Authors' caveats: requires a representative training set and a stable feature→effect mapping.
- **Why this matters [Reasoning].** A campaign-level prediction explains something Westpack's
  dashboard already measured: IA figures do not add up across days (1–6 October: 37 summed daily vs
  39–40 for the period). A model evaluated per query is not additive, so the dashboard's rule of
  reading period figures from period queries is correct and should stay.
- **The canonical warning about the alternative.** Gordon, Moakler & Zettelmeyer, "Close Enough?",
  Marketing Science 42(4), 2023 (https://pubsonline.informs.org/doi/10.1287/mksc.2022.1413; arXiv
  2201.07055) [Peer]: on 663 Facebook RCTs, observational methods (double ML, propensity matching)
  with 5,000+ user features overstated lift badly. Lower-funnel median lift was 5% in the RCTs
  against 24% (DML) and 64% (SPSM). The authors could not recover causal effects without randomisation.
  This is the reason any "exposed vs similar unexposed" comparison, including an in-house one, should
  not be called incrementality.

### 1.3 How IA differs from Conversion Lift

| | Conversion Lift | Incremental Attribution |
|---|---|---|
| Basis | Randomised holdout of *your* audience during *your* test | Model trained on *other* advertisers' lift tests |
| Output | One estimate with a confidence interval, for one test scope | A point figure per query, every day, no interval shown |
| Cost | Holdout reach forgone; approval needed | Free, retroactive |
| Fails when | Under-powered | Your account is unlike the training set |

### 1.4 Independent assessments

- **Haus, optimisation outcome, July 2026** [Vendor]
  (https://www.haus.io/blog/is-metas-incremental-attribution-outperforming-standard-attribution-what-the-data-shows,
  published 2026-07-16). This compares the incremental return earned *when delivery is optimised* to IA
  against standard settings. It does not compare what each setting reports. Methods: head-to-head
  equal-budget cells, plus IA holdouts benchmarked against the same brand's standard-setting tests.
  - All tests: 1.11x (IA ÷ standard). Jul 2024–Jun 2025: **0.80x** (standard better). Jul 2025–Jun
    2026: **1.26x** (80% range 1.11–1.43).
  - DTC-only 1.38x, omnichannel 1.02x. No systematic size effect. Slight lean to IA on
    acquisition outcomes, which Haus calls within noise.
  - Caveats stated by Haus: sample "modest" and test count not given. The recent window has more
    DTC brands, and within-brand retests were mixed.
  - Haus's 2025 figure (IA beat standard in 43% of tests) is superseded by this re-analysis. [Vendor:
    https://www.haus.io/blog/the-meta-report-lessons-from-640-haus-incrementality-experiments, 2025-07-28 with 2026 editor's note]
- **Seer Interactive, reporting comparison, July 2025** [Practitioner, agency]: across six accounts
  and $1.05M in April 2025, Meta called 87% of conversions incremental while a GA4 cross-check
  suggested 67%. Retargeting and very broad targeting showed the lowest incrementality. GA4 is not a
  causal benchmark either, so this shows disagreement rather than error.
- **Meta's own claims** (46% more incremental conversions, Q1 2025 earnings call; 20% from 45
  advertisers in 2024 tests) are relayed by third parties and are **unverified**.
- **Haus 640-test report** [Vendor, 2025-07-28]: on average Meta *under*-reports incrementality for
  click-only 7-day-click DTC attribution by ~15%. Advantage+ over-reports relative to manual by ~12
  points. Average test length was 18.6 days plus 8.8 post-treatment days. Population: US DTC
  advertisers averaging ~$14M a year on Meta, with no B2B.

### 1.5 Does optimising to IA change delivery?

Yes, by design: the ad set's optimisation target changes from "conversions inside the window" to
"predicted caused conversions". Practitioners report a learning-phase reset and a few weeks of
instability on switching [Practitioner: Stella]. Loomer reports he has seen little difference in
results and suggests IA suits high-volume accounts rather than ones struggling to exit learning
[Practitioner, 2026-03-10]. The Haus 2026 data is the only experiment-based outcome evidence
found, and it is vendor data.

### 1.6 Attribution windows, 2025–2026

- **API, 12 January 2026** [Doc: Meta developer blog, 2025-10-16,
  https://developers.facebook.com/blog/post/2025/10/16/ads-insights-api-metric-availability-updates/]:
  - `7d_view` and `28d_view` no longer returned. Remaining: `1d_click`, `7d_click`, `28d_click`,
    `1d_ev` (1-day engaged view), `1d_view`, plus the advertiser's default windows.
  - **Unique-count fields** (`reach`-type, `unique_actions`) with breakdowns, and hourly breakdowns,
    are limited to **13 months** of history. Frequency breakdowns (`frequency_value`) are limited to
    **6 months**. `breakdowns=mmm` is async-only. Totals remain available for 37 months.
- **Ads Manager, March 2026** [Practitioner, not verified against Meta text: Loomer,
  https://www.jonloomer.com/meta-ads-attribution-2026/; AlmCorp; Dataslayer]:
  - Click-through now means **link clicks only**. Reactions, comments, shares, saves and other
    non-link clicks moved to a new **1-day engage-through** bucket, which replaced engaged-view and
    covers all formats. The video engaged-view threshold is now 5 seconds.
  - New default: 7-day click + 1-day engage-through + 1-day view.
  - 28-day click is no longer an optimisation window but is viewable in comparison.
  - Billing is unaffected.
- Effect reports of "15–40% fewer reported conversions" after the January change are vendor blog
  claims and **unverified**.

### For Westpack

1. **Keep IA as the reporting basis, but stop calling it conservative across the board.** From
   the observed Conv - 04 - EU numbers, reported ≈ 2.5 × IA and 85% of reported purchases are
   1-day view. That puts the click-through share at ≈ 0.15 × 2.5 = 0.375 × IA, so **IA credits about
   2.7x what link clicks alone would** [Reasoning, from Westpack's own figures]. IA is conservative
   relative to 7dc+1dv, but generous relative to click-only.
   - *Case that IA is right here:* B2B buyers plausibly see an ad on a phone and order from a work
     desktop, and Meta's logged-in cross-device graph sees that link where click-only cannot. PIE's
     evidence says the model beats click rules on average.
   - *Case that IA overstates here:* Haus's (DTC, US) average says click-only 7dc *under*-reports by
     only ~15%. If that held for Conv - 04, true incrementality would be ~0.43 × IA. Westpack, being
     EU, B2B and small, is likely under-represented in Meta's training set.
   - Only Westpack's own experiment can settle which case holds. Until then, present IA as a
     modelled estimate with a plausible range, not as a floor.
2. **The DE/FR/IT switch to standard optimisation runs against the best outside evidence** (Haus
   2026: IA optimisation 1.26x over the last year). Low volume is the counter-argument. Per-market
   ad sets on ~5–15 new customers a week struggle to learn, and IA is suggested for high-volume
   accounts. Standard 7dc/1dv gives the algorithm more (if less causal) signal. Either side is
   defensible. Decide on Westpack's first-time-buyer data per market (the existing
   `scripts/attribution-switch-evaluation.js` approach) rather than on IA itself, because IA will by
   construction favour campaigns optimised to IA. Make the evaluation symmetric: an IA-optimised
   control market over the same weeks, with a pre-agreed window (≥6–8 weeks, given the
   learning-phase reset).
3. **Check what "standard" means after March 2026.** If DE/FR/IT were set to 7-day click + 1-day
   view with engage-through *off*, conversions after likes, saves or non-link clicks are no longer
   in their optimisation signal at all. Confirm the ad-set setting in Ads Manager.
4. **The 13-month cap on unique-count breakdowns limits the dashboard.** The Expansion tab's country
   breakdown of reach, and any reach/frequency history older than 13 months (6 for frequency
   breakdowns), can no longer be fetched. Snapshots already stored are the only long-run record,
   so keep them.

---

## 2. Conversion Lift and multi-cell lift

- **Design** [Doc: Marketing API lift studies, https://developers.facebook.com/docs/marketing-api/guides/lift-studies]:
  - User-level randomisation into test and no-ad control, with per-cell treatment and control
    percentages, so multi-cell studies are supported.
  - Analysis is intent-to-treat, and control users enter the same auction ("ghost ads"-style).
    [Vendor: Sellforte, 2026-08-31, https://sellforte.com/blog/asked-by-marketers/trust-meta-conversion-lift-tests]
- **Validity** [Peer-ish: Burtch, Moakler, Zhang, Hill, Gordon, arXiv 2508.21251, 2025-08-28, Meta
  co-authors, https://arxiv.org/html/2508.21251v1]:
  - Across 3,204 lift tests, randomisation stayed balanced: 0.16% of SMDs exceeded 0.2.
  - Across 181,890 Meta **A/B tests** (campaign vs campaign, no holdout), 22% of SMDs exceeded 0.2:
    *divergent delivery*. An A/B test therefore compares audiences as much as creatives or
    settings. Imbalance was worse for conversion-optimised tests (14.4%) than for awareness ones (5.1%).
- **Access and minimums: no current Meta page was retrievable.** Third-party figures conflict:
  - $5,000 spend and 500 conversions in the past year [Vendor: Triple Whale,
    https://kb.triplewhale.com/en/articles/10605805-meta-conversion-lift-experiment].
  - ≥7 days, ≥10% of the audience per cell, and **Meta approval** [Vendor: Haus,
    https://www.haus.io/article/meta-incrementality-testing].
  - Unsourced claims of $30k–50k+ a month.
  - Treat all of these as unverified, and check the Experiments tab in Ads Manager.
- **Limits** [Vendor: Sellforte]:
  - Measures only pixel/CAPI/offline events, and only for the scope, spend level and dates tested,
    so it gives one point on the response curve.
  - Multi-cell designs need materially more volume.
  - Meta disclosed a lift-reporting bug in 2020 that went unnoticed for about a year
    (https://www.adexchanger.com/platforms/facebook-conversion-lift-measurement-issue-goes-undetected-for-12-months/).

### For Westpack

- **Power is the binding constraint [Reasoning, illustrative].** Suppose a 4-week test has ~400
  pixel-tracked New_customer events in the eligible population, of which ~25% are incremental (a
  true lift of ~33%).
  - 10% holdout: control expects ~30 events. The SE of log(ratio) is about √(1/30 + 1/370) ≈ 0.19,
    against log(1.33) ≈ 0.29, so z ≈ 1.5. That is **under-powered**.
  - 50% holdout: z ≈ 2.6, which is adequate, but half the audience is unserved for a month.
  - Meta's lift readouts would also only see conversions Meta can observe.
- **What a lift test could answer** if Meta grants access: "does Conv - 04 cause new customers at
  all, and is the IA figure in the right range?" The second question is the valuable one, because
  it calibrates IA for this account. A two-cell IA-optimised vs standard-optimised study is the
  rigorous version of the DE/FR/IT question, but it needs roughly twice the volume.
- **Never use Meta's A/B test tool to judge IA vs standard, or awareness vs conversion.** Divergent
  delivery makes the cells non-comparable. Use a lift study or a geo split.

---

## 3. Geo experiments

- **Tools.**
  - **GeoLift** (Meta, open source R): synthetic control, using augmented SCM via `augsynth`. It
    has built-in market selection and power simulation, reporting `Average_MDE`, power by effect
    size and investment. No numeric minimums are documented. The walkthrough uses 40 US cities, 90
    daily pre-periods and 10–15 day tests, and advises covering at least one full purchase cycle.
    [Doc: https://github.com/facebookincubator/GeoLift;
    https://facebookincubator.github.io/GeoLift/docs/GettingStarted/Walkthrough]
  - **Google Meridian GeoX** (open source, GA 2026-09-09): stratified designs, holdback, go-dark
    and heavy-up tests, native multi-cell, and output that calibrates Meridian priors. The "31%
    cheaper" claim comes from Google's internal benchmarks and is unverified.
    [Practitioner: ppc.land, https://ppc.land/googles-meridian-geox-exits-beta-claiming-31-cheaper-geo-experiments/]
  - **Haus/Stella-type vendors**: managed geo holdouts. No public pricing. Practitioners report
    little uptake under ~$5M revenue. [Practitioner/vendor listings, e.g.
    https://www.emarketer.com/content/faq-on-incrementality-how-prove-your-ads-actually-work-2026]
- **Rules of thumb** [Practitioner, not package requirements]:
  - 20+ geo units, at least 25 pre-periods (minimum 10), and a pre-period of 4–5x the test length.
  - Daily rather than weekly data.
  - Simulate power on your own history rather than using closed-form formulas.
  - Validate the MDE on held-out periods, because back-tests on the fitting panel flatter it
    (https://mlsynth.readthedocs.io/en/latest/replications/geox.html).

### For Westpack

1. **Use the accidental experiment first.** DE, FR and IT ran no Meta ads from May to August 2026
   and returned on 9 September (dashboard notes, 2026-09-16). A synthetic-control read of Magento
   first-time buyers in DE/FR/IT, against markets that ran throughout, gives a free if confounded
   estimate of what Meta adds in those markets. Compare that with the IA new-customer figure for the
   same markets after the restart.
   - It is quasi-experimental, not random: summer seasonality and the 9 September rebuild coincide
     with the on/off dates.
   - It is still the cheapest calibration of IA available.
2. **Country is too coarse a unit for a designed test.** Thirty countries with very different sizes
   give few good synthetic controls. Meta targets by region and postcode, and Magento orders carry a
   **delivery postcode**. That is a clean geo key for B2B: the shop's address does not move, so
   cross-border shopping is less of a problem than in B2C. Splitting large markets (DE, UK, FR, IT,
   DK, NL) into regions gives dozens of units.
3. **Expect a large MDE; simulate before committing [Reasoning, illustrative].**
   - Let T be account-wide first-time buyers a week (from Magento) and assume Meta truly causes the
     ~25 a week IA reports. A go-dark in markets holding a share *s* of T for *W* weeks then needs
     roughly s·W ≥ (2.1·k)²·T / 625. Here k ≥ 1 inflates Poisson noise for model error, with
     one-sided α = 0.10 and 80% power.
   - With T = 150 and k = 1.5: s·W ≈ 2.4, so half the markets dark for about 5 weeks.
   - With T = 300 and k = 2: about 17 weeks, which is not practical.
   - Run GeoLift's power function on 12+ months of daily Magento first-time buyers by region
     before deciding.
   - A go-dark of half the markets costs about 12 incremental customers a week, if IA is right.
4. **Pitfalls specific to Westpack.**
   - Language markets: the "EU" ad set serves several countries, so a holdout must exclude those
     countries from EU-wide ad sets too, or it leaks.
   - Klaviyo email and Google Ads must be held constant across cells.
   - Lookalike expansion and Advantage+ audience may deliver outside the intended geography, so
     check delivery by region during the test.
   - B2B reorder cycles are long. A new-customer KPI avoids most carry-over, but include a
     post-treatment window (Haus averages about 9 days).

---

## 4. Marketing mix modelling

- **Meridian (Google)** [Doc: changelog, https://github.com/google/meridian/blob/main/CHANGELOG.md]:
  - 2.0.0 (2026-09-02): JAX backend, plus prior calibration from experiments such as GeoX.
  - 2.1.0 (2026-09-17): declarative calibration and holdout specs.
  - Scenario Planner launched February 2026.
  - A brand-equity framework using branded Google query volume was reported with 2.0, though it
    is not named in the changelog [Practitioner: ppc.land].
- **Data guidance** [Doc: https://developers.google.cn/meridian/docs/pre-modeling/amount-data-needed?hl=en]:
  - There is no fixed minimum. A national model with 2 years of weekly data (104 points) and 26
    effects is called too little; the remedies are fewer channels and knots, 3 years of data, or a
    **geo model**.
  - Geo models pool across geos.
  - Campaign-level modelling is discouraged.
  - Meridian's likelihood is built for continuous KPIs. Many zero-count market-weeks fit poorly
    [Reasoning].
- **Robyn (Meta)** [Doc: CRAN 3.12.1, 2025-07-02, https://cran.rstudio.com/web/packages/Robyn/index.html;
  arXiv 2403.14674]:
  - R package; calibration enters as a third optimisation objective (MAPE.LIFT against
    experiment results).
  - The Python port is beta.
  - Its creator joined Fospha as an advisor in October 2026, and Meta's maintenance commitment is
    not evident.
- **Calibration practice** [Vendor: Sellforte 2026]:
  - Treat each experiment as scoped evidence for the matching channel, and carry its interval into
    the prior.
  - Do not count two tests of the same intervention as independent.

### For Westpack

- **Not now.** With Meta as the main paid channel, about 30 markets and roughly 20–40 incremental
  customers a week, an MMM would mostly re-estimate one channel from noisy on/off variation. It
  would add months of analyst work for little beyond what a geo read of the May–August pause gives.
- **The case for later.** The per-market on/off history (May–August, the September rebuild) is
  exactly the variation a geo-level MMM needs. Software is free. If Google Ads and Klaviyo spend
  grow into the decision, a light Meridian geo model on weekly first-time buyers, calibrated with
  one geo test, becomes reasonable.
- **Keep the inputs now** at weekly × market granularity: spend, impressions, first-time buyers
  and revenue. That keeps the option open, and the 13-month cap on Meta unique-count breakdowns
  means history not stored now may be lost.

---

## 5. Signals and data quality

- **Conversions API / EMQ** [Doc: Dataset Quality API, new metrics from 2025-05-28,
  https://developers.facebook.com/docs/marketing-api/conversions-api/dataset-quality-api/]:
  - Event coverage, deduplication, freshness and match-quality diagnostics are readable over the
    API.
  - Benchmarks such as "browser-only pixel 3–5, CAPI with hashed data 6–8+" are practitioner
    claims.
  - Reports that the AEM 8-event cap was removed in June 2025 conflict with other 2026 guides, so
    that is **unverified**.
- **EU "less personalised ads" (LPA)** [Doc: European Commission, 2025-12-08,
  https://digital-markets-act.ec.europa.eu/meta-commits-give-eu-users-choice-personalised-ads-under-dma-2025-12-08_en]:
  - The original option launched in November 2024. The Commission found the pay-or-consent model
    non-compliant in April 2025 (€200M fine).
  - Meta committed to a revised choice for EU users from January 2026: full data and fully
    personalised ads, or less data and less personalised ads.
  - Per Meta's newsroom as summarised, LPA uses session context, age, location, gender and ad
    engagement, and no browsing history.
  - Meta's SEC filings call LPA "less relevant and effective"
    (https://www.sec.gov/Archives/edgar/data/0001326801/000162828026050705/meta-20260630.htm). The
    CFO flagged it as a Q3 2026 headwind.
  - **No uptake share and no measurement documentation is public.** BEUC argued in March 2026 that
    it is still unlawful.
- **Modelled conversions.** Meta models conversions it cannot observe, but no current official
  documentation of the EU method was found. "Meta consent mode" accuracy claims come from consent
  vendors and are **unverified**.
- **iOS/ATT.** Adjust reports a 35% average opt-in in Q2 2025 among users shown the prompt
  (https://www.adjust.com/blog/att-opt-in-rates-2025, via search summary; the fetch was
  rate-limited).

### For Westpack

- **LPA users shrink what Meta can learn from and measure in all of Westpack's markets,** by an
  unknown amount. This is another reason the independent Magento series matters. If IA-reported new
  customers drift down relative to Magento first-time buyers from early 2026, LPA and consent are
  candidate causes alongside performance.
- **Track the ratio IA New_customer ÷ Magento first-time buyers per market monthly.** A step change
  without a spend change signals a measurement shift, not a performance shift.
- **Audit CAPI for the New_customer path.**
  - Is the first-order flag computed server-side from Magento order history, and sent with the
    hashed email and a shared `event_id` for deduplication?
  - Check EMQ for that event in Events Manager or the Dataset Quality API.
  - Do not send server events for visitors who refused consent without legal sign-off. GDPR
    consent applies to CAPI as much as to the pixel.
- **ATT matters less here** [Reasoning]: B2B orders are often completed on desktop. Mobile ad views
  still feed view-through and cross-device attribution, which is part of why the 1-day-view share
  is high.

---

## 6. A practical measurement stack for Westpack

Sophisticated small and mid advertisers typically report on a ladder of evidence: business data,
then platform model, then experiments. They do not report one platform number. The "triangulation"
framing (MMM + experiments + attribution, Google's Modern Measurement Playbook) is common, and also
criticised as costly and confusing for small teams [Practitioner: Marketing Week,
https://www.marketingweek.com/grace-kite-bermuda-triangle-marketing-measurement/]. At Westpack's
scale the lean version below is enough.

| Layer | Metric | Source | Cadence |
|---|---|---|---|
| Truth | First-time buyers by market (delivery country/region) | Magento/Klaviyo | Weekly |
| Efficiency | Blended cost per new customer = total paid media ÷ first-time buyers; MER = revenue ÷ paid media | Magento + spend | Weekly, 4-week rolling |
| Mix | New-customer share of orders and revenue | Magento | Monthly |
| Platform | IA New_customer, cost per IA new customer, IA ÷ Magento ratio | Meta (IA) | Weekly |
| Causal check | Geo read or lift test, pre-registered | Experiment | 1–2 a year |

### For Westpack

- **Lead management reporting with Magento first-time buyers and blended cost per new customer.**
  Meta's IA figure belongs in the report as "the share Meta's model attributes to Meta", not as the
  headline. This also protects the report from Meta changing its definitions, as it did in January
  and March 2026.
- **Report Meta's figure with a range and its basis named**: "IA estimate; last calibrated against
  experiment X on date Y". Before any calibration, say so. It follows the dashboard's existing rule
  that a missing number beats a wrong one.
- **Give per-market first-time buyers a 4–8 week rolling view, with Poisson intervals.** At 5–15 a
  week per market, week-to-week moves are mostly noise. The saturation view already applies this
  rule to new customers.
- **Pre-register every evaluation** with the decision, metric, window and threshold set before
  looking. The DE/FR/IT attribution switch is the immediate candidate.

---

## Confidence and gaps

- **High:** January 2026 API window and retention changes [Doc]; PIE results [Peer]; lift test vs A/B
  balance [Peer, Meta-authored]; Meridian release facts [Doc].
- **Medium:**
  - Haus IA-optimisation figures (vendor, modest sample, US DTC skew).
  - March 2026 engage-through change (consistent across several practitioners, but Meta's text was
    not retrieved).
  - LPA facts (regulator and filings, with no uptake data).
- **Low or unverified:**
  - Conversion Lift minimums and access rules.
  - AEM cap status.
  - Modelled-conversion mechanics in the EU.
  - Whether IA optimisation is available for custom-conversion events such as New_customer.
  - The "first conversion" conversion-count optimisation option reported for late 2025.
- **Process note:** the session's shared web-search budget ran out before the last two items could
  be checked. Meta Help Center pages returned no body text to the fetcher. Verify those items in
  Ads Manager directly.
