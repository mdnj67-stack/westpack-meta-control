# Awareness on Meta and the brand/conversion split — evidence for Westpack

Research date: 2026-10-13. Three research passes (Meta delivery mechanics; brand/activation evidence;
practice, cases and success criteria) plus Westpack's own ad account data read the same day. Nearly all
outside evidence is B2C, and much is from vendors that sell measurement (Haus, Stella) — flagged below.

**Summary.** Westpack runs ~30% of Meta spend on awareness (BA - Reach: per-market 1% customer
lookalikes, Maximize reach, cap 5/7). The account data showed the awareness budget is fully spent; the
flat 80% on DE/UK/EU and ~120% on FR/IT is Meta's *ad set budget sharing*, not saturation. The reach goal
delivers ~2 impressions/person/week regardless of budget. Outside evidence: 30% is low against
whole-budget brand benchmarks (Binet & Field B2B ~46%) but ~5x what Meta advertisers typically put in
upper funnel (Haus ~6%). No source supports 5 impressions/week. At Westpack's volume, a test on new
customers alone cannot show a plausible effect within a budget cycle, so leading indicators (branded
search, direct/new visits, search lift) are needed. Recommendation on 2026-10-13: hold ~30%, do not raise
to 40%, agree KPIs with management up front, run a pre-registered geo test.

---

## 1. What the account showed (2026-10-13, read-only Graph API)

| Ad set | Budget DKK/day | Spend/day | Weekly frequency | CPM |
|---|---|---|---|---|
| LAL - DE | 900 | ~720 (80%) | 1.7 | 9.6 |
| LAL - UK | 500 | ~400 (80%) | 2.0 | 10.6 |
| LAL - EU | 400 | ~320 (80%) | 2.2 | 8.9 |
| LAL - FR | 900 | ~1,080 (120%) | 2.1 | 6.3 |
| LAL - IT | 900 | ~1,075 (120%) | 2.5 | 4.4 |
| BA - Reach total | 3,600 | ~3,560 (99%) | | |

- Activity log: `update_budget_flex_toggle_status = true` on BA - Reach at creation, 2026-09-18.
- Donor ad sets sit at exactly 80% every day for 25 days; receivers are the cheapest-CPM markets.
- More budget did not raise frequency on the reach goal (FR/IT at 120% still ~2/week).
- Placements (awareness, 29/9–12/10): IG Reels 38.5%, FB Reels 17.5%, FB Feed 15.1%, IG Feed 12.9%,
  Marketplace 10.6%, Stories 5.2%, Threads 0.1%. No Audience Network.
- LAL - EU spend by country (14/9–11/10) vs EU conversion new customers: ES+PT 35% of spend (10 new
  customers), PL/GR/RO/HU/LT/HR/CZ/SK 54% (4), BE/IE/SE/NL/FI/DK/NO 5% (36). CPM differences were small
  (8–10.5), so the skew is not price alone.

## 2. Meta mechanics (verified against live docs 2026-10-13)

- **Ad set budget sharing** — "share up to 20% of your daily budget with other ad sets… At a campaign
  level, spend remains the same" (facebook.com/business/help/1388266028979935). Daily max per ad set
  (budget + shared) x 1.75; weekly (budget + shared) x 7. API field `is_adset_budget_sharing_enabled`.
  Practitioners report it on by default in some accounts (TheOptimizer, 2026-06-03).
- **Frequency control** writable only for REACH and THRUPLAY goals (Marketing API
  frequency_control_specs, v26). Impressions and ad recall lift goals have no cap.
- **Target frequency** (auction) needs lifetime budget, ≥7 days, no bid controls (Jon Loomer
  2024-11-13; no official page found).
- **Reservation** buying: for audiences >200k, lifetime budget, default cap 2/7
  (facebook.com/business/help/251123081984768).
- **VAT** never included in budgets (help/155641834501332). Location fees from 2026-07-01 (AT 5%, FR/IT/ES
  3%, UK 2%) added on invoice, not in Ads Manager (help/1238737454289085).
- **Daily budget**: ≤175% on a day, ≤7x per Sun–Sat week (help/190490051321426).
- Performance goal documented as editable after publishing; in practice it was greyed out until the
  whole campaign was duplicated. Inspect tool help page now redirects — treat as retired.
- Lookalike expansion default on; can be switched off on REACH (Loomer 2025-10-06).

## 3. Brand vs activation split

- **Binet & Field, "5 Principles of Growth in B2B Marketing"** (LinkedIn B2B Institute, 2019): ~46% brand /
  54% activation; B2C ~60/40. "This ratio should not be followed too precisely." <50 IPA award cases,
  UK-skewed, big budgets; SME-selling firms "probably behave differently". Ratio is of the whole
  communications budget; brand vs activation defined by purpose, not channel. Long-term effects dominate
  only after ~6 months. Loyalty campaigns: zero success rate on very large effects.
- **IPA "Effectiveness in Context"** (2018): online-only brands optimum ~75:25 brand — put money where the
  task is harder.
- **WARC "The Multiplier Effect"** (Jan 2025, vendor coalition, method not public): min 30%, ideally 40–60%.
- **Haus Meta Report** (Jul/Aug 2025, 640 tests, vendor): upper funnel ~6% of Meta spend among clients.
- **Shapiro, Hitsch & Tuchman** (Econometrica 2021, peer-reviewed, TV): marginal ROI negative for >80% of brands.
- Critiques: survivorship bias (IPA blog), Byron Sharp 2022 ("terrible, very misleading").
- **95-5** (Dawes 2021): arithmetic from purchase cycles; applies to prospects; packaging is repeat-bought.
- Ehrenberg-Bass/B2B Institute "Easy to Find" (Nov 2025): branded search journeys ~19x more efficient
  than generic — branded search is a usable proxy.

## 4. Frequency

- **Meta "Effective Frequency"** (2016, 11 randomised campaigns): 1/week captured up to 80% of recall lift;
  2/week 95% of purchase-intent lift — for high-awareness brands; new/low-share brands may need more.
- Meta 2020 (2,439 campaigns): results plateau "after a handful" (5–6), unclear if per week.
- **Brainlabs** (46 Meta brand lift studies, UK, 2025–26, agency): recall strongest at 2 per 7 days; Reach
  found the least-aware people; Ad Recall/ThruPlay skew to people already aware.
- No source supports 5/week. Best argument for >2: Meta's own low-share caveat.

## 5. Does upper funnel lift conversions?

- **Haus** (2025, vendor): standard attribution under-reports reach/awareness ~6x; upper-funnel iROAS −46%
  vs bottom funnel in-test, −22% with post-period; 81% of its impact on new customers; tests ~34 days.
- **Mejuri** (jewellery, Feb–Mar 2025, Haus geo test 70/30): 25% of Meta moved up-funnel → +11%
  incremental revenue, +57% iROAS.
- **Javvy**: top-of-funnel video inside purchase campaigns 13x more incremental.
- **Brainlabs** search halo (17 studies): +19% search visits; adding reach campaigns gave +20% search
  visits for +2% cost per incremental visit.
- **Otrium** (Meta Power Lift): performance+awareness +5.5% purchases vs performance alone.
- Analytic Edge for Meta (published ~2023, commissioned by Meta): $4.30 per $1.
- No B2B, packaging or SMB-supplier awareness case exists.
- Peer-reviewed caution: Gordon et al. (Marketing Science 2019, 2023) — observational methods often fail
  to reproduce experimental lift; Lewis & Rao (QJE 2015) — ad ROI is very hard to measure precisely.

## 6. Practice 2025–2026

- Loomer "Master Brief" (2026-07-02), Foxwell (2026): consolidate into broad conversion campaigns;
  creative variety does the prospecting (Andromeda); separate top-of-funnel campaigns "solve imagined
  problems". Keep awareness only after a holdout proves it.
- Meta newsroom (2025-11-10, unverified claims): Advantage+ audience −15% cost per result for awareness.
- Practice for keeping budget under "prove it": fixed test slice with pre-agreed criteria (Mejuri,
  Javvy), 5–10% shift tests (SEJ 2026-01-19), contribution-margin/aMER governance (CTC), search lift as
  interim proof (Brainlabs).

## 7. Measurability at Westpack's volume (~20–40 new customers/week)

Two halves of markets, Poisson, perfectly matched (real tests do worse):

| Test length | Customers per arm | Smallest detectable lift |
|---|---|---|
| 8 weeks | ~120 | ~36% |
| 16 weeks | ~240 | ~25% |
| 26 weeks | ~390 | ~20% |

- Meta Brand Lift minimums reportedly US $175k / DE $110k / UK $64k (blog quoting Meta, 2026-09) — verify.
- Conversion Lift needs a Meta rep; breakdowns need ≥100 conversions.
- GeoLift: pre-period 4–5x test length, ≥20 geo units; DE/FR/IT had no delivery May–Aug 2026.
- Meridian (2026-06-03 docs) and Robyn: ~2 years weekly data; GeoX priors and branded-search signals GA
  2026-09-10.

## 8. Success criteria, most to least measurable

1. Reach and frequency in the defined audience; first-time impression share (proves exposure only).
2. Branded search per market (Google Search Console), direct and new-visitor sessions.
3. Search lift via Meta Conversion Lift with search-visit outcomes.
4. Blended cost per new customer incl. awareness; new-customer share of orders.
5. Incremental new customers via a long geo test (what management wants, least measurable).

## 9. Recommendation recorded 2026-10-13

Hold awareness ~30%; do not raise to 40% yet; stop treating 5/week as something to force; decide on
budget sharing (it moves ~340 DKK/day to FR/IT); agree KPIs with management before changing the split;
run a pre-registered 16–26 week geo test with branded search primary and new customers secondary; ask
the Meta rep about Conversion Lift.
