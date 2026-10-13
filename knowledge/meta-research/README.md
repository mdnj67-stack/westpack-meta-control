# Meta advertising knowledge base — read this first

Research date: 2026-10-13. Seven reports, ~30,000 words, written for Westpack's Meta account: B2B
retail packaging sold online to small retailers and jewellers in ~30 European markets plus UK/US, with
new customers on Meta's incremental attribution as the headline KPI. Each report labels every claim by
source type (Meta documentation, Meta claim, peer-reviewed, vendor, practitioner, own calculation) and
ends each section with "For Westpack". Refresh anything older than about six months; Meta changes fast.

| File | Covers |
|---|---|
| [00-awareness-and-budget-split.md](00-awareness-and-budget-split.md) | Awareness share (30/70 vs 40/60), frequency, upper-funnel evidence, success criteria, the BA - Reach budget-sharing finding |
| [01-delivery-structure-budget.md](01-delivery-structure-budget.md) | Andromeda/GEM, structure, learning phase, budgets and bidding, value rules, signals/CAPI, placements |
| [02-creative.md](02-creative.md) | Creative diversity, testing at low volume, fatigue, formats, Advantage+ creative risks, localisation |
| [03-measurement.md](03-measurement.md) | Incremental attribution, lift tests, geo tests, MMM, EU privacy, management reporting |
| [04-b2b-and-europe.md](04-b2b-and-europe.md) | Finding business buyers, LTV/payback, multi-country delivery, EU regulation, market expansion |
| [05-scaling-and-decisions.md](05-scaling-and-decisions.md) | Budget steps, decision rules with small numbers, edit cadence, Q4, governance |
| [06-platform-changes-2025-2026.md](06-platform-changes-2025-2026.md) | Dated changelog: products, API v22–v26, policy, prices, what is coming |

Limits: Meta's Help Center renders client-side, so several Meta quotes come via developer-doc markdown or
practitioner summaries; the shared web-search budget ran out late in five of the six passes, so copy-length
studies, packaging-category cases and some vendor disclosures are thin. Almost no evidence is B2B.

## The cross-cutting conclusions

These are the points where several reports agree independently. Where they disagree, it says so.

1. **Small numbers are the binding constraint on every decision.** At ~20–40 incremental new customers a
   week (DE/FR/IT ~5 each), nothing can be judged weekly or per market per month. Pool markets, use
   rolling 8-week windows, write decision rules down before acting, and judge creative on leading
   metrics (CTR, cost per add-to-cart, spend share). DE/FR/IT are permanently "learning limited" (~50
   events/7 days rule); treat that as a constraint, not a fault. (03, 05, 01, 02)
2. **Incremental attribution is the best basis available, but it is a model.** Meta's IA is trained on
   lift tests; an April 2026 paper on 2,226 experiments found R² 0.88 vs 0.19 for last click. On Conv - 04
   - EU it credits ~2.7x what link clicks alone would, so it is not uniformly conservative. Lead
   management reporting with Magento first-time buyers and blended cost per new customer; show IA as a
   modelled share. (03, 01)
3. **Creative is the main lever Westpack controls.** Meta's own 2025 guidance moved from targeting to
   "creative diversification"; Meta dropped its ~6-ads guidance in Feb 2025. The specific tactics
   ("Entity ID", similarity thresholds, magic ad counts) are folklore. Within the user's 5-ad cap, make
   each slot a genuinely different concept and keep replacements ready. Whether to test 8–10 concepts in
   Conv - 04 - EU is the user's call; the case for the cap is thin signal and copy-review load. (02, 01, 05)
4. **Weak countries can be handled without new ad sets.** Meta optimises on its own attribution
   (including view-through), and view-through is cheapest in GR/HU/CZ/SK/HR/LT, so spend drifts there.
   Value rules (since ~July 2025) bid down by country inside one ad set, −90% to +1000%; the blunter
   alternative is removing the countries. Both reports agree; check availability in the account. (01, 04)
5. **Budget steps: no safe size is documented.** "20% every 3 days" has no Meta source. The +52% step on
   Conv - 04 - EU is defensible; read it after 8 weeks on new customers per 1,000 impressions (CPM is up
   ~35% for season), not on average CAC. (05, 01)
6. **Seasonality cuts both ways for a B2B supplier.** Meta price per ad rose 9% in 2025 and 12% y/y in
   Q1–Q2 2026; late Nov–mid Dec is the dearest window. Retailers likely order packaging Aug–Oct, before
   the consumer peak. Check Westpack's own weekly first orders 2024–25 before planning Q4. (05, 04, 06)
7. **Repeat value per market is the missing number.** First-order contribution (~776 DKK) roughly pays
   back the English EU campaign; DE/FR/IT need ~4.5 orders' worth. Klaviyo cohorts by first-order market
   at 6/12/24 months should set each market's CAC ceiling. (04, 05)
8. **EU privacy shrinks the signal.** "Less personalised ads" reached all EEA users from Jan 2026 (not GB,
   US, CH); a non-dismissible reminder follows Jan 2027. Uptake is unpublished. Another reason to protect
   GB. (04, 03, 06)
9. **Signal quality is the cheapest real improvement.** Check event match quality and whether
   `New_customer` is also sent server-side from Magento via CAPI (dedup by event_id within 48h). Offline
   Conversions API closed May 2025. (01, 03)
10. **Advantage+ creative features threaten the claim rules.** AI text, overlays, backgrounds and
    translation can invent free samples or delivery promises. Westpack's ad-creation code never sets
    these options, so ads inherit account defaults. Audit and switch off explicitly. (02)

## Disagreements and unverified claims

- **Do the business-behaviour/interest layers narrow awareness delivery?** 04 says detailed targeting is
  now mostly a suggestion. 00 (Loomer, Oct 2025) says the Reach goal can still restrict to the defined
  audience, and BA - Reach has Advantage+ audience off. Unresolved; the account's own country/reach data
  is the way to check.
- **Optimising DE/FR/IT on standard vs incremental attribution.** Haus (Jul 2026, vendor, modest sample)
  found IA optimisation 1.26x better, reversing its 2025 finding; practitioners report higher costs.
  Only a market-level test with Magento first-time buyers settles it.
- **The new "customer lifecycle → new customer acquisition" setting** (rolling out 2026; all advertisers
  from 2026-10-06 per 06) defines "new" as no purchase in ~180 days — not Westpack's definition — and
  compatibility with the custom `New_customer` conversion is unverified.
- **Meta Brand Lift and Conversion Lift minimums**: conflicting, unverified figures.
- **Creative claims for ads**: "free cliché on first order" is site-true only for standard clichés (not
  plastic bags); "2,000+ five-star reviews" is site wording — see `knowledge/westpack-site/README.md`.

## Concrete things to check in the account (found by the research)

- `api/meta/publish-ad.js` still sends `instagram_actor_id` (deprecated since 2025-09-09 per 06) on the
  image/carousel paths, and the `video_feeds` and Instagram `explore` placements. Verified present in
  code 2026-10-13; whether v25 rejects them is untested — check with `validate_only` before relying on it.
- Expansion reach: unique-count breakdowns are limited to 13 months since 2026-01-12 and `MAX_MONTHS` is
  24 in `server/meta/expansion-reach.js`; stored snapshots are the only long series.
- `7d_view`/`28d_view` windows were removed 2026-01-12; "click" means link click only from ~2026-03-03,
  which breaks the "ROAS as reported" series at that date.
- Location fees (UK 2%, FR/IT/ES 3%, AT 5%, from 2026-07-01) are not in API spend, so the dashboard
  understates cost per new customer in those markets.
- Sales/Leads ad sets may spend up to 5% on each excluded placement since Oct 2025 (default ticked).
- Ad set budget sharing can be switched off mid-flight but not back on (06).
- Delivery-estimate fields `daily_outcomes_curve`, `budget_guardrail`, `estimate_dau` removed on all
  versions 2026-10-27; saturation does not use them.
