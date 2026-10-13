# 05 — Scaling, optimisation decisions and account discipline (Meta, 2025–2026)

**Research date:** 2026-10-13. **Scope:** when to scale, cut, change or leave alone; how to judge small numbers; edit cadence; Q4 seasonality; common mistakes; how to report a Meta budget to management.

## Summary

Most of what circulates as "scaling rules" is folklore. Meta has never published a safe budget-increase percentage. Its own wording, as quoted by practitioners who checked the help pages in 2025–2026, is that a budget change "may" be significant and that this "depends on the magnitude". The "20% every 3 days" rule shows up on dozens of agency blogs and on no Meta page. Daily budgets have also been effectively weekly since Meta allowed spending up to 75% over the daily figure, capped at 7 × daily per week. Three things are well supported:

- **Judge the marginal customer, not the average.** Haus's May 2026 framework shows the last 25% of spend can cost three times the average.
- **Don't cut assets on their average CPA.** Meta calls this misreading the "breakdown effect".
- **Small counts need statistics, not intuition.**

For Westpack the binding constraint is not learning-phase mechanics. It is statistical power. A country campaign buying about 4.8 incremental new customers a week cannot be told apart from a 2,300 or a 5,900 DKK CPA after four weeks. The EU campaign's 52% step on 13 October happened while CPM was already up about 35% for the season, so a naïve before/after will blame scale for what Q4 did. The recommendations below are therefore mainly about **pre-registering decisions, normalising for CPM, and evaluating over windows long enough to mean something**.

*Method note:* the web-search budget for this session ran out before every planned source was reached. Andrew Faris's and Barry Hott's own material, and Meta's help-centre text (which renders client-side and could not be fetched), are covered only through secondary quotation and are flagged as such.

Evidence labels used throughout:

- **[Meta]** Meta documentation or filings.
- **[Measured]** Experiments or panel data with a stated method.
- **[Vendor]** A tool or agency with a commercial interest.
- **[Opinion]** A practitioner's judgement.
- **[Own calc]** Arithmetic done for this report.

---

## 1. Scaling budget: increment size, learning resets, vertical vs horizontal, diminishing returns

### What Meta actually says

- **[Meta via secondary]** Significant edits are grouped as:
  - **always significant:** creative changes, adding a new ad, changing the optimisation event, changing targeting, and pausing the ad set;
  - **significant by magnitude:** budget, bid and spending-limit changes, which "may also be significant" and "depend on the magnitude of the change". Meta publishes no threshold.
  - Exiting learning takes "around 50 optimization events since its last significant edit". That is counted from the edit, not as "50 per week" as often repeated.
  - Sources: Scalemate, which checked Meta's pages on 27–28 July 2026 (https://www.scalemate.co/blog/meta-ads-learning-phase-reset, 2026-07-28), and the GoodMorning summary linking Meta help pages 316478108955072, 112167992830700 and 942374239243867 (https://goodmorningco.com/blog/meta-ads-significant-edits-learning-phase, 2026-10-07).
- **[Meta example]** Meta's only worked example: going from $100 to $101 is unlikely to restart learning, while $100 to $1,000 may (Jon Loomer, https://www.jonloomer.com/updates-to-meta-ads-budgeting/, 2023-11-02).
- **[Meta UI]** Meta has shown advertisers in-product recommendations such as *"You can increase your daily budget up to $179 without reentering the learning phase"*, a 79% step on a $100 budget. A 2025 variant reads *"High-performing ad sets won't reenter the learning phase."* These are the closest Meta has come to a number, and they are larger than 20%. Sources: Loomer, above, and Loomer's Pubcast (https://pubcast.jonloomer.com/the-learning-phase-is-just-a-label/, 2025-10-15).
- **[Meta]** Budget flexibility: Meta may spend up to 75% above the daily budget on a given day (raised from 25%), but no more than 7 × daily budget over the week. In Loomer's words, "your daily budget has become more of a weekly budget". Sources: Loomer, 2023-11-02, above; Cropink (https://cropink.com/facebook-ad-budget, updated 2025-10-13).

### The 20% rule

- **[Folklore, labelled as such by careful sources]**
  - Scalemate: the 20% figure "comes from third-party blogs" (2026-07-28).
  - Canem Errant: "A 20% step can be an operational hypothesis; it is neither a universal Meta requirement nor a ROAS guarantee" (https://canemerrant.com/en/blog/meta-ads-budget-scaling-strategy/, 2026-07-17, updated 2026-10-03).
- **No public controlled study of step size versus CPA was found.** Tables claiming "+5–15% CPA for 20% steps, +100–300% for doubling" (for example Ryze AI, 2026) give no method or sample and should be ignored.
- **[Opinion, Loomer 2025-10-15]**
  - The "Learning" label mostly signals instability, not a different algorithmic state.
  - Adding an ad to a well-performing ad set did not restart learning in his test, which contradicts the documented list.
  - His advice: do not fear the label; make important changes deliberately instead of tinkering.
- **The real cost of a big step is mechanical, not mystical.** More budget in the same auction means buying progressively more expensive impressions and less-ready people: diminishing returns. That happens whatever the learning label says. A 20% step does not avoid it; it only makes it harder to see.

### Vertical vs horizontal scaling

- **[Opinion, broad consensus 2025–2026]** Duplicating ad sets into overlapping audiences (the old "horizontal" scaling) is now generally discouraged. It fragments signal and puts you in auction against yourself (Loomer, "The mistakes I see in almost every ad account", https://pubcast.jonloomer.com/the-mistakes-i-see-in-almost-every-ad-account/, 2026-06-01). CTC's 2025 position is to consolidate and launch new campaigns only for meaningfully different products, promotions or tests (https://commonthreadco.com/blogs/ecommerce-playbook/2025-guide-to-meta-media-buying, 2025-04-22).
- Since Andromeda (Meta Engineering, https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/, 2024-12-02), the "horizontal" lever experts actually use is **new creative concepts that reach different people**. As Andrew Foxwell put it, "The algorithm doesn't do the targeting anymore. Your creative does" (The Marketing Factor, https://themarketingfactor.beehiiv.com/p/what-actually-moves-the-needle-on-meta-right-now, 2026-03-10). CTC (https://commonthreadco.com/blogs/coachs-corner/how-meta-actually-works-2026, 2026-07-07) calls loosening cost or ROAS constraints "the last lever, not the first" and treats creative as the main delivery lever.
- **Legitimate horizontal splits are those with a real business reason:** different markets, languages, margins or offers. Westpack's per-market ad sets are exactly this (see project memory "markets keep their own ad sets").

### Estimating diminishing returns and marginal CAC from your own data

- **[Measured / vendor, Haus, https://haus.io/blog/diversifying-the-right-way-a-framework-for-calculating-the-marginal-efficiency-of-your-marketing-channels, 2026-05-12]** Haus defines marginal efficiency as the cost per incremental acquisition of the *last* tranche of spend. In its worked example:
  - Meta at $320k had a CPIA of $337.
  - +25% spend lifted the overall CPIA only to $392.
  - But the extra $80k bought just 76 customers, a **marginal CPIA of about $1,050, three times the average**.

  Haus describes three designs:
  1. **Sequential back-to-back:** the simplest, but not seasonality-controlled.
  2. **Three cells (holdout / BAU / scaled):** the cleanest design.
  3. **Stacked geo:** extra spend in some regions only. It gives the marginal figure only, and Meta may deprioritise heavy-spend regions.

  Haus also sells spend-increase and spend-decrease tests to trace the curve (https://www.haus.io/use-cases/optimal-spend-level, undated).
- **[Explainer, BooleanMaths, undated]** Average ROAS "is still aggregating all efficient spend that came before". A blended figure can look stable long after the marginal return has collapsed (https://booleanmaths.com/resources/marginal-roas-saturation-curves).
- **Meta's own estimators are not usable for this today.**
  - Westpack probed `delivery_estimate.daily_outcomes_curve` on 2026-10-08 and got a single zero point (see CLAUDE.md, "Audience saturation").
  - The "increase to $X without re-entering learning" prompt is a learning-state statement, not a marginal-return estimate.
- **[Own calc] A practical spend–response method for a single campaign.**
  1. **Decide the question before the step.** Write it down: "the step is worth keeping if marginal CAC is below X".
  2. **Use a long pre-period** (6–8 weeks if stable) at the old budget and an equal or longer post-period.
     - Exclude the first 7 days after the step. Meta says to let learning end before judging, and spend is volatile then.
  3. **Measure response net of market price.** Compare new customers per 1,000 impressions, or per 1,000 people reached, before and after. A CPM change caused by the season then cancels out. Westpack already nets account CPM change in the saturation module.
  4. **Marginal CAC = Δspend / Δnew customers**, with an interval (see section 2).
     - If Δ is within noise, record "not distinguishable". Do not record "zero".

**For Westpack:**

- **The EU step from 2,500 to 3,800 DKK/day (+52%) on 13 Oct is defensible under everything Meta has documented.** Meta itself prompts steps of that size. Daily spend already swings up to 75% on its own.
  - *Case against:* splitting it into two steps would have given two smaller, separable readings of the marginal return.
  - *Case for:* with 20–25 customers a week, a 20% step adds only about 1–2 expected customers a week, which is invisible in Poisson noise. A large step is the only kind Westpack can *measure*. Keep the single step, but evaluate it properly.
- **The real threat to judging the step is the season, not learning.** EU CPM went from 34 to 46 DKK (+35%) between mid-September and now.
  - If conversion per impression held constant, average CAC would rise from about 780 to about 1,050 DKK **from CPM alone**, before any diminishing return. A naïve before/after will attribute that to the budget step.
  - Evaluate on new customers per 1,000 impressions, and on the account-wide CPM index, not on CAC.
- **[Own calc, Poisson simulation, baseline 22.5/week]** How precise is a marginal-CAC read on the +9,100 DKK/week step, comparing equal-length pre and post windows? The figures below are the 10th–90th percentile of the estimate.

  | True marginal CAC | After 4 weeks | After 8 weeks |
  |---|---|---|
  | 780 DKK (no diminishing return) | 550–1,350 | 600–1,100 |
  | 1,500 DKK | 850–6,000 | 980–3,200 |
  | 3,000 DKK | 1,200 to "unmeasurable" | 1,460 to "unmeasurable" |

  So four weeks can confirm "the step still buys customers cheaply", but cannot separate a 1,500 marginal CAC from a 3,000 one.
  - Pre-commit to an **8-week read** (to about 8 December).
  - Use a longer pre-baseline (August–mid-September at 2,500/day), which roughly halves the baseline's contribution to the variance.
  - Overdispersion: the incremental-attribution model adds noise beyond Poisson (CLAUDE.md records daily vs period figures disagreeing by 5–8%). Treat these intervals as the *best case*.
- **Write the keep/revert rule down now**, for example: keep 3,800 if marginal new customers per week ≥ 6 (marginal CAC ≤ ~1,500 DKK), CPM-adjusted, at 8 weeks. Otherwise step back to the level whose marginal CAC is known.
  - The threshold must come from what a new customer is worth to Westpack (first-order margin plus repeat), not from the 780 average.

---

## 2. Decision rules with small numbers

### The arithmetic

**[Own calc]** Exact Poisson 95% intervals show how wide small counts are:

| Observed count | 95% interval for the true rate | Relative to observed |
|---|---|---|
| 5 | 1.6–11.7 | ×0.32–×2.3 |
| 10 | 4.8–18.4 | ×0.48–×1.8 |
| 20 | 12.2–30.9 | ×0.61–×1.5 |
| 40 | 28.6–54.5 | ×0.71–×1.4 |
| 100 | 81–122 | ×0.81–×1.2 |

- A week of 20 new customers is consistent with a true rate anywhere from 12 to 31. "20 ± 9" in the brief is right.
- If the true rate is 22.5 a week, a single week at 15 or below happens about **6%** of the time, and a week at 30 or above about **7.5%**. So about one week in seven will look like a "crisis" or a "breakthrough" with nothing changed.

For a country campaign at 2,400 DKK/day and a true CPA of 3,500 DKK (about 4.8 new customers a week):

| Window | Expected count | 95% CPA interval |
|---|---|---|
| 1 week | 5 | 1,440–10,350 DKK |
| 4 weeks | 19 | 2,265–5,875 DKK |
| 8 weeks | 38 | 2,580–5,000 DKK |
| 13 weeks | 62 | 2,750–4,600 DKK |

- A 30-day month for one country expects 20.6 new customers, and anything from **12 to 30** is ordinary.
- A whole week with **zero** new customers has a probability of 0.8% if CPA is truly 3,500. That is rare enough to investigate (tracking or delivery) but is not a CPA verdict.

### What practitioners use

- **[Vendor/opinion]**
  - A common creative-testing kill rule is "spent 1.5× target CPA with zero conversions and no micro-signal".
  - Foxwell Digital says judging a creative usually takes "2–3× the CPA", and gives "20× CPA" as the spend for statistical significance in its worked example (https://www.foxwelldigital.com/blog/meta-ads-how-much-creative-is-needed-by-volume, dated "Feb 18", year not shown).
- **[Own calc] Zero-conversion rules are cheap to calibrate with Poisson.** If the true CPA equals the target, the chance of zero conversions after spending 1× target is 37%, after 2× it is 13.5%, after 3× it is 5%, and after 4× it is 1.8%.
  - So "1.5× CPA with zero" kills good assets about 22% of the time.
  - **3× CPA with zero** is the defensible minimum for a kill on conversions alone. That is the same rule the saturation module already uses ("3× the account's own cost per new customer spent with none").
- **[Measured]** Loomer ran three *identical* ad sets in a Meta A/B test, and Meta's simulation still declared win probabilities of 59/27/14% (https://www.jonloomer.com/results-identical-ad-sets/, cited via search; not fetched). This shows how easily noise produces confident-looking rankings.
- **[Meta]** "Let the learning phase end before judging a significant edit", and about a week minimum (Scalemate summary of Meta, 2026-07-28).

### Defensible stop and scale rules

**[Own synthesis]** These rules use a Gamma–Poisson (Bayesian) model:

- **Model.** Treat new customers per DKK as a rate λ.
  - Prior: Gamma(α₀, β₀), set from the account's own history. For example, weight the account-level rate as if it were 10 customers' worth of evidence: α₀ = 10, β₀ = 10 × CPA_account.
  - After observing k customers on spend S, the posterior is Gamma(α₀ + k, β₀ + S).
  - Shrinking toward the account rate stops one lucky or unlucky fortnight from moving money.
- **Stop or reduce rule:** act when P(CPA > ceiling) > 90% **and** spend since the last significant edit ≥ 3× the ceiling **and** at least 14 days have passed since the edit.
  - The ceiling is the most you are willing to pay for an incremental new customer in that market.
- **Scale rule:** act when P(CPA < target) > 80% over at least 28 days.
  - Scale in a step large enough to measure. For Westpack that is +30–50% rather than +20%.
  - Then hold for the evaluation window (section 1).
- **Never act on a single day.** The 75% budget flexibility and the per-query incremental model make daily figures uninterpretable for counts under about 10 a day.
- **Separate investigate triggers from act triggers.** A spend or delivery anomaly, a tracking break or zero conversions in a week should trigger *investigation* immediately, but a budget move only once the rule above is met.

**For Westpack:**

- **DE/FR/IT restarted learning on 7 October.** At about 4.8 customers a week each, the earliest honest read is about 4 weeks of clean data (early November), with a CPA interval still spanning roughly 2,300–5,900.
  - **Pool the three markets for the go/no-go on the *copy fix*.** Pooled, that is about 14 a week, or about 58 in four weeks, with an interval of roughly ±25%.
  - Keep per-market budgets independent, but do not cut a single market on fewer than 8 weeks of data unless it trips the 3×-ceiling-with-zero rule.
- **This conflicts with the evaluate-over-30-day-months habit in one specific way.** A calendar month is a good *reporting* unit, but a market-level decision needs about 8 weeks at Westpack's volume.
  - *Case for monthly:* management cadence and comparability.
  - *Case for longer:* the 30-day interval for a country (12–30 customers) is too wide to separate a good market from a bad one.
  - Report monthly; decide on rolling 8-week windows with intervals shown.
- **The 3,500 vs 780 DKK gap between country and EU campaigns is large enough to be real.** Their intervals do not overlap even at four weeks. That is the comparison that should drive cross-market budget, through marginal rather than average figures where possible.

---

## 3. Optimisation cadence and the case for being hands-off

- **[Meta]** Every always-significant edit resets the "50 events since last significant edit" clock (sources in section 1).
  - At Westpack's volume (4.8 a week in a country), no country ad set will ever exit learning by Meta's definition.
  - Learning Limited is therefore the permanent state, which is acceptable. The cost of edits is *lost evaluation time and reset delivery*, not a label.
- **[Meta, as reported]** Meta's Performance 5 guidance advises not spending more than about 20% of budget in learning (Tiger Pistol / StackedMarketer summaries, 2023–2024; not verified on Meta's current page).
- **[Opinion, Loomer, 2025-05-19, https://www.jonloomer.com/breakdown-effect/]** Meta calls it the "breakdown effect" when advertisers see an asset with a higher average CPA getting more budget and override it. That "typically makes performance less efficient". Loomer recommends a "hands-off approach over micromanagement" and judging at campaign or ad-set level.
- **[Opinion, CTC 2026-07-07]** Meta's documentation says "the relationship between historical performance and future delivery is not deterministic". CTC advises *against* turning off ads with weak historical ROAS, because "the algorithm has usually already reduced their allocation".
- **[Opinion, CTC 2025-04-22]** Roll changes out sequentially (bidding, then attribution, then audiences) so each effect can be measured. "Resetting everything at once" confuses the account.
- **Automated rules.** **[Vendor]** The typical rules ("raise 15–20% when ROAS > X for 3 days", "pause if CPA > target +25% over 3 days") act on exactly the noisy short windows section 2 warns about. At 5–25 conversions a week, a 3-day window is dominated by noise. **Their main defensible use is guardrails:** spend caps, alerts on zero delivery, and tracking failure (AnyTrack 2025, https://anytrack.io/blog/meta-ads-automation-rules-that-actually-work-in-2025).
- **When intervention is right.**
  - Broken tracking or broken landing pages.
  - A disapproved or fatigued creative, where frequency is rising and new reach is falling (see the saturation module).
  - A pre-registered decision rule that has tripped.
  - A business change: a new offer, stock, or a market opening or closing.

  Not right: day-to-day CPA, a single bad week, or an ad with a high average CPA that Meta is still funding.

**For Westpack:**

- **"Performers are not paused without fatigue" matches the best-supported practitioner position** (breakdown effect).
- **The 5-active-ads cap is where Westpack departs most from 2025–2026 practice.**
  - Against it:
    - Meta dropped its old "no more than six ads per ad set" guidance (reported by Loomer).
    - Loomer runs an ad set with 50 ads.
    - CTC fills evergreen ad sets toward Meta's 150-ad limit.
    - Foxwell-attributed figures (second-hand) relate more ads to longer creative lifespans.
    - Motion's 2026 benchmark (over 550k ads, Sep 2025–Jan 2026, vendor) finds only 5–8% of ads become winners and about half never get meaningful spend. More ads therefore cost little, because Meta starves the losers itself.
  - For it:
    - At 2,400 DKK/day and about 5 customers a week, every ad added thins the signal per ad.
    - Westpack's copy must be checked against the site's claims (project memory), so each ad carries review cost.
    - A cap keeps the account explainable.
  - **Suggested middle course:** keep the cap where volume is low (the country campaigns), and run a **time-boxed test of 8–10 genuinely distinct concepts in Conv - 04 - EU**. That campaign has the volume to show whether added diversity lowers CPA. Judge it on the campaign's new customers, not per-ad CPA.
- **Batch edits.** One planned edit window a week (for example Monday), with new creative added in batches rather than drip-fed. The country campaigns should get no structural edits until their post-7-October read.

---

## 4. Seasonality: Q4 2025 / Q4 2026, B2B suppliers, budgeting through CPM rises

### What the data show

- **[Meta filings]** Global average price per ad:
  - +6% YoY in Q4 2025 and +9% for full-year 2025, with impressions +18% in Q4 (Meta Q4 2025 release, https://s21.q4cdn.com/399680738/files/doc_news/Meta-Reports-Fourth-Quarter-and-Full-Year-2025-Results-2026.pdf, 2026-01-28).
  - +12% YoY in Q2 2026, which Meta attributed partly to currency (https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/, 2026-07-29/30).
  - Europe's impressions grew 9% in Q3 2025, and Europe's ad revenue rose 29% (Q3 2025 coverage, https://www.nasdaq.com/articles/meta-platforms-q3-earnings-and-revenues-surpass-estimates-rise-y-y). Expect Q4 2026 European prices to sit **above** Q4 2025's.
- **[Vendor panel, SuperAds medians via AdMake, https://admakeai.com/blog/cost-per-impression-cpm-explained, 2026]** Global median Meta CPM:

  | Period | Median CPM | Note |
  |---|---|---|
  | Apr–Sep 2025 | $18.6–20.4 | |
  | Oct 2025 | $21.69 | |
  | Nov 2025 | $25.22 | Peak |
  | Dec 2025 | $22.04 | |
  | Jan 2026 | $15.74 | 13-month low, about −29% from December |

  November was about +25–35% over the summer band. Germany's Q4 peak was about $14.96 in the same vendor's data, well below the global level.
- **[Agency panel, GeistM, https://geistm.com/blog/meta-rate-trends-q4-2025/, 2026-01-13, method not stated]** CPM change by fortnight in 2025:

  | Fortnight | CPM change |
  |---|---|
  | 1–15 Oct | −12% |
  | 16–31 Oct | +7% |
  | 1–15 Nov | +3% |
  | 16–30 Nov | +11% |
  | 1–15 Dec | +11% |
  | 16–31 Dec | −10% |

  The peak runs from late November to mid-December.
- **[Vendor]**
  - Triple Whale BFCM 2025 (33k shops, mostly US DTC): Meta CPM $22.26, about +7.8% YoY (https://www.triplewhale.com/blog/facebook-ads-bfcm; page returned 403, figures via search excerpt).
  - Tinuiti Q4 2025 (via Karooya summary): Facebook CPM −13% YoY as Reels inventory grew; Instagram +8%.

  Q4 2025 was **not** a dramatic year-on-year shock. The seasonal shape is the reliable part.
- **[Measured, Northbeam, 950+ advertisers, https://themediabuyer.northbeam.io/p/data-why-is-everybody-s-meta-performance-tanking, 2026-06-01]** New-customer CAC hit a 12-month low in February 2026, then rose sharply, and CPMs rose 10–20% from January 2026. **January's cheap CPMs did not translate into lasting cheap acquisition for everyone.**
- **[Vendor/opinion]** B2B verticals see milder Q4 lifts (10–25%), but feel the auction pressure from B2C regardless. Several sources suggest pulling back in late December when buyers stop working (Stackmatix, Choozle; low confidence).

### Packaging buyers' calendar

**[Vendor, packaging suppliers]**

- Custom packaging for Christmas is ordered roughly **August–October**.
- UK custom bags take 2–4 weeks from approval, with a Christmas order window of "late Oct–early Nov".
- Offshore orders need to be placed in August–September.

Sources: Tiny Box Company (https://www.tinyboxcompany.co.uk/blog/post/plan-festive-packaging-timelines-with-confidence), Paperpak (Australia), PakFactory (2024).

Retailers buy packaging *before* their own peak and are busy selling during it.

**For Westpack:**

- **The EU CPM rise from 34 to 46 DKK (+35%) since mid-September is larger than the median panel lift to November (+25–35% over summer), and November–mid-December is still ahead.** Plan for another **+10–20%** in late November–mid-December and a sharp fall in January (−25–30% in the 2025/26 panel).
- **Westpack's demand calendar probably *leads* the consumer peak.** Custom logo packaging needs production time. The project memory says logo-print days are *production* time and must never be presented as delivery time.
  - That implies the most valuable weeks for acquiring a jeweller or boutique are **September to early November**. Late November–December buys the dearest impressions at the moment retailers are busiest selling.
  - *Case for holding spend through December:* stock (non-printed) packaging is bought late, a retailer who runs out reorders, and new shops open for the season. Westpack's own history must decide this.
  - **Action:** pull new-customer first orders by week (and by printed vs stock) for 2024 and 2025 from the shop, and see whether first orders peak before or with the CPM peak. That is a single query and settles the question with Westpack's own data instead of folklore.
- **Budget rule through the season:** hold the *CPM-adjusted* targets (new customers per 1,000 impressions) rather than absolute CAC targets in late November and December. Decide in advance whether to:
  - (a) accept a seasonally higher CAC, if Q4 customers are as valuable as others; or
  - (b) shift budget from late November–December into January, when CPMs are lowest. January buyers are restocking after the season and planning spring.

  Northbeam's 2026 data says January's cheapness can be brief, so do not over-commit to it.
- **Year-on-year comparison is the right lens for Q4.** Compare Q4 2026 against Q4 2025 at matching weeks, not against September.

---

## 5. Common expensive mistakes, and how experts diagnose an account

All items are **[Opinion]** unless marked otherwise.

- **Loomer's five mistakes he sees "in almost every ad account"** (https://pubcast.jonloomer.com/the-mistakes-i-see-in-almost-every-ad-account/, 2026-06-01):
  1. Audience segments not defined in Advertiser Settings, so new-vs-existing reporting is blind.
  2. Unnecessary remarketing, which inflates results and is low-incrementality.
  3. Inflated conversion results. Check click vs view vs engaged-view, use first conversions, and compare attribution settings.
  4. Needless age, gender and placement restrictions. Use value rules if you know something Meta doesn't.
  5. Over-split structure that fragments budget and overlaps.
- **CTC (2025-04-22 and 2026-07-07):**
  - Too many campaigns; near-duplicate creative, which Meta deprioritises ("twenty very different ads can outperform 200 similar ones").
  - Cutting assets on historical ROAS.
  - Changing bidding, attribution and audiences at once.
  - Cost controls without inflated budgets.
- **Foxwell (2026-03-10):** Meta's automatic enhancements are switched on by default and can hurt; set them intentionally.
- **Haus (2025-07-28 Meta report; 2026-04-07; 2026-07-16)** **[Measured/vendor]**:
  - Across 640 experiments, Meta lifted the primary KPI by 19% on average.
  - Advantage+ over-reported by about 12 percentage points relative to manual.
  - Reach/awareness had an "incrementality factor" of about 6× relative to its reported results, versus 1× for lower-funnel.
  - In the July 2026 re-analysis, **Incremental Attribution beat standard attribution on incremental return per dollar by 1.26× (range 1.11–1.43×), Jul 2025–Jun 2026**. That reversed the 0.80× of the prior year. Haus calls it "real but still developing", from a "modest number of tests", and says "test for yourself".
- **Recurring audit order across practitioners:**
  1. Tracking and attribution integrity first.
  2. Objective-to-KPI fit.
  3. Structure and overlap.
  4. Creative diversity and volume.
  5. Budget distribution versus marginal return.
  6. Edit history and cadence.
- **Andrew Faris and Barry Hott:** primary material could not be retrieved within this session's search budget. A vendor page attributes to Faris a "70% of mature DTC spend on Target ROAS" rule; this is unverified and DTC-specific, so it is not used here.

**For Westpack:**

- **Already right:**
  - Incremental attribution as the single basis. This is now supported by Haus's 2026 data, with caveats.
  - Market-level structure with a business reason.
  - Not pausing performers.
  - A deduplicated, reconciled dashboard.
- **Worth checking against the list:**
  - (a) Are Advantage+ creative enhancements and placement or automatic settings deliberately chosen?
  - (b) Is the existing-customer segment defined in Advertiser Settings? This is needed for Meta's own new-vs-existing split, separate from the custom conversions.
  - (c) How much of the EU campaign's spend is effectively remarketing? Conv - 04's reported purchases are about 85% 1-day view-through (CLAUDE.md), the classic sign Loomer describes.
  - (d) Creative diversity under the 5-ad cap (section 3).
- **Awareness at ~30% of spend** is far above Haus's observed ~6% upper-funnel share in its customer base, which is DTC with $14M/yr average Meta spend. Haus also found upper-funnel iROAS 46% lower during tests, but with 81% new-customer share and large omnichannel halo. For a B2B buyer with long consideration, the halo argument is stronger.
  - The defensible move is not to cut on this benchmark, but to **test it**: a geo holdout of awareness in one or two markets for 6–8 weeks, measuring conversion-campaign new customers. (See the companion report 00 on awareness.)

---

## 6. Reporting and governing a Meta budget with management

- **[Measured/vendor, Haus 2026-05-12]** Report **marginal** efficiency alongside **average**. "What matters is how it compares to the last dollars you're spending on Meta." Haus also: "All of this should be leading to strong action and not just testing to validate."
- **[Opinion, Canem Errant 2026-07/10]** Use a bounded scaling protocol:
  1. Record the baseline.
  2. Set the increase **and a maximum acceptable loss**.
  3. Observe an order cycle.
  4. Reconcile Meta with shop/CRM order IDs.
  5. Decide increase, hold or reduce on criteria set in advance.

  Also: "If the next euro cannot be evaluated against additional confirmed sales, clarify measurement first."
- **[Opinion, CTC / Taylor Holiday, via Polar Analytics template]** Govern against **contribution margin** and first-order economics, not ROAS. Gate budget on whether paid CAC is below first-order contribution margin, or a stated payback period.
- **[Measured, Northbeam 2026-06-01]** Blended metrics can stay flat while new-customer CAC rises sharply. Always report the new-customer line separately.

**For Westpack** (a governance template consistent with the dashboard's existing rules):

- **The monthly report has five lines per campaign group and for the account:**
  1. Incremental new customers, with a 95% Poisson interval.
  2. Average cost per new customer.
  3. **Marginal cost per new customer of the last budget change**, or "not yet measurable", with the date it will be.
  4. CPM index versus the same weeks last year.
  5. New customers per 1,000 impressions, which is the CPM-free efficiency.

  This matches the dashboard's own rules: one measurement basis, no badge where nothing honest can be compared, and uncertainty shown rather than hidden.
- **Guardrails agreed with management in advance:**
  - (a) A **ceiling marginal CAC** per market, derived from new-customer value. The average CAC is not the guardrail. EU at 780 average may still have a marginal near 1,500, and that is fine if a customer is worth more.
  - (b) **Minimum evaluation windows:** 8 weeks per market, and 4 weeks pooled for account-level changes.
  - (c) **Step sizes:** ±30–50%, one change at a time per campaign, logged with a date.
  - (d) **Stop rules** from section 2.
  - (e) **A seasonal clause:** Q4 targets are CPM-adjusted.
- **"Budget follows proof of new customers"** is exactly the right principle. Operationalised, it means budget moves toward the campaign with the **lowest marginal** cost per new customer until marginals equalise across markets, subject to per-market strategic floors (markets keep their own ad sets).
  - At current numbers the EU campaign's *average* is 4–5× cheaper than the countries', so the burden of proof sits with the country budgets. But after the 13 October step the EU's marginal figure is the unknown, and it is exactly what the 8-week read will reveal.
- **Present both sides.** Every budget recommendation to management should state the upside case, the downside case and the confidence level, in line with the user's standing preference (project memory "present both sides of a marketing verdict").

---

## Source list (with dates)

- Meta Engineering, Andromeda — 2024-12-02 — https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/
- Meta Q4/FY2025 results — 2026-01-28 — https://s21.q4cdn.com/399680738/files/doc_news/Meta-Reports-Fourth-Quarter-and-Full-Year-2025-Results-2026.pdf
- Meta Q2 2026 results — 2026-07 — https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/
- Meta help pages (could not be rendered; quoted via secondary sources) — 316478108955072, 112167992830700, 942374239243867
- Scalemate, learning-phase resets — 2026-07-28 — https://www.scalemate.co/blog/meta-ads-learning-phase-reset
- GoodMorning, significant edits — 2026-10-07 — https://goodmorningco.com/blog/meta-ads-significant-edits-learning-phase
- Jon Loomer, budgeting updates — 2023-11-02 — https://www.jonloomer.com/updates-to-meta-ads-budgeting/
- Jon Loomer, "The learning phase is just a label" — 2025-10-15 — https://pubcast.jonloomer.com/the-learning-phase-is-just-a-label/
- Jon Loomer, breakdown effect — 2025-05-19 — https://www.jonloomer.com/breakdown-effect/
- Jon Loomer, mistakes in every account — 2026-06-01 — https://pubcast.jonloomer.com/the-mistakes-i-see-in-almost-every-ad-account/
- Haus, Meta Report (640 experiments) — 2025-07-28 (editor's note 2026) — https://www.haus.io/blog/the-meta-report-lessons-from-640-haus-incrementality-experiments
- Haus, IA vs standard re-analysis — 2026-07-16 — https://haus.io/blog/is-metas-incremental-attribution-outperforming-standard-attribution-what-the-data-shows
- Haus, attribution overhaul — 2026-04-07 — https://haus.io/blog/metas-attribution-overhaul-what-marketers-should-do-next
- Haus, marginal efficiency framework — 2026-05-12 — https://haus.io/blog/diversifying-the-right-way-a-framework-for-calculating-the-marginal-efficiency-of-your-marketing-channels
- Haus, optimal spend level — undated — https://www.haus.io/use-cases/optimal-spend-level
- CTC, 2025 guide to Meta media buying — 2025-04-22 — https://commonthreadco.com/blogs/ecommerce-playbook/2025-guide-to-meta-media-buying
- CTC, navigating Meta changes 2025 — 2025-04-30 — https://commonthreadco.com/blogs/tactics/navigate-meta-ads-changes-2025
- CTC, How Meta actually works in 2026 — 2026-07-07 — https://commonthreadco.com/blogs/coachs-corner/how-meta-actually-works-2026
- Foxwell (via The Marketing Factor) — 2026-03-10 — https://themarketingfactor.beehiiv.com/p/what-actually-moves-the-needle-on-meta-right-now
- Foxwell Digital, creative by spend volume — "Feb 18", year not shown — https://www.foxwelldigital.com/blog/meta-ads-how-much-creative-is-needed-by-volume
- Canem Errant, budget scaling — 2026-07-17 / 2026-10-03 — https://canemerrant.com/en/blog/meta-ads-budget-scaling-strategy/
- GeistM, Q4 2025 rate trends — 2026-01-13 — https://geistm.com/blog/meta-rate-trends-q4-2025/
- AdMake (SuperAds medians) — 2026 — https://admakeai.com/blog/cost-per-impression-cpm-explained
- Northbeam / The Media Buyer — 2026-06-01 — https://themediabuyer.northbeam.io/p/data-why-is-everybody-s-meta-performance-tanking
- Triple Whale BFCM 2025 (figures via search excerpt) — https://www.triplewhale.com/blog/facebook-ads-bfcm
- Motion 2026 creative benchmarks (headline via search) — https://motionapp.com/events/2026-creative-strategy-bootcamp/homebase/2026-creative-benchmarks
- AnyTrack, automation rules — 2025 — https://anytrack.io/blog/meta-ads-automation-rules-that-actually-work-in-2025
- Tiny Box Company, festive packaging timelines — https://www.tinyboxcompany.co.uk/blog/post/plan-festive-packaging-timelines-with-confidence
- Own calculations: exact Poisson intervals (chi-square/Garwood) and a 40,000-draw Poisson simulation of the EU step, run 2026-10-13.
