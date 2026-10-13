# B2B-to-SMB acquisition and multi-market Europe on Meta (2025–2026)

**Research date:** 2026-10-13. Researcher 4 of 6. Scope: B2B-to-SMB acquisition, LTV/payback, multi-market
Europe, EU regulation, market-expansion testing.

## Summary

There is almost no published, numbers-bearing evidence on B2B-to-SMB acquisition on Meta. I searched for
Packhelp, noissue, Vistaprint, Moo, Printful, Shopify, Faire, Ankorstore and SumUp, and none has published a
Meta case study with results. What is left is either Meta's own documentation and filings or practitioner and
vendor writing based on B2C ecommerce. The firmest findings are mechanical, not B2B-specific:

- **Targeting is now mostly a suggestion.** Detailed-targeting exclusions are gone, and interests were consolidated again, with a delivery cutoff on 15 Jan 2026.
- **Country spend in a multi-country ad set follows the cheapest optimisation events.** It does not follow business value. Meta's **value rules** (since July 2025) can bid countries down inside one ad set, so Westpack can fix its weak-country spend without adding ad sets.
- **Meta now has a native "New customer acquisition" setting** at ad-set level, rolling out gradually since early 2026.
- **The EU's Less Personalised Ads (LPA) choice was re-presented to every EEA user in January 2026.** Meta's own early figures say LPA ads drive 61–70% fewer conversions, but uptake has never been published.
- **Meta's average price per ad in Europe rose 10–19% year on year in each quarter from Q1 2025 to Q2 2026.** CAC will drift upward even when nothing in the account changes.
- **On Westpack's own economics,** the EU-English campaign roughly breaks even on the first order. The DE/FR/IT campaigns need about 4.5 first-order equivalents of contribution per customer to pay back. That makes repeat-order data by market the single most important missing input.

Evidence labels used below: **[Fact]** documented by Meta or a regulator; **[Measured]** measured data from a named
source; **[Vendor]** vendor or agency claim; **[Opinion]** practitioner view; **[B2C]** evidence that comes from consumer
ecommerce only.

> Method note: this session hit its web-search budget before finishing. Three topics were therefore not
> researched: Cimpress/Vistaprint shareholder-letter disclosures on customer value, Shopify's disclosures on
> merchant-acquisition payback, and currency/price display in multi-currency ads. They are marked as gaps where
> they come up.

---

## 1. How B2B-to-SMB sellers acquire customers on Meta (2025–2026)

### 1.1 What has changed in targeting

- **[Fact] Detailed-targeting exclusions removed.** Meta announced the removal on 21 Jan 2025 and claimed a 22.6%
  improvement in median cost per conversion. That figure comes from Meta's own tests.
  ([ppc.land, Jan 2025](https://ppc.land/meta-removes-detailed-targeting-exclusions-for-ad-accounts/);
  [Social Media Today](https://www.socialmediatoday.com/news/meta-removes-detailed-targeting-exclusions-from-ad-campaigns/723389/))
  Custom-audience exclusions still work.
- **[Fact] More interests consolidated.** Ads Manager showed the notice "Some detailed targeting options have been
  combined". Ad sets using retired options stopped delivering from **15 Jan 2026**. Meta published no list of
  the affected options; they are visible only inside Ads Manager.
  ([MediaPost, 18 Aug 2025](https://www.mediapost.com/publications/article/408262/))
  Jon Loomer reported a different cutoff (18 March) for one wave, so the waves overlap
  ([jonloomer.com](https://www.jonloomer.com/qvt/detailed-targeting-announcement/)).
- **[Vendor/Opinion] Inputs are suggestions.** Under Advantage+ audience, interests, lookalikes and customer
  lists are suggestions, and only location and minimum age are hard limits. Several 2026 guides say niche B2B
  is the main case where manual targeting should still be *tested* against broad, rather than assumed to lose
  ([Conversios 2026](https://www.conversios.io/blog/meta-advantage-audience-vs-detailed-targeting-2026-guide/);
  [Linear Design](https://lineardesign.com/blog/metas-advantage-audience/)). I found no measured B2B comparison.
- **[Fact, reported] Manual placement selection is being removed from ad sets** for some advertisers. Value
  rules are positioned as the replacement. Reports started on 25 Aug 2026 and the rollout is gradual.
  ([ppc.land](https://ppc.land/some-meta-advertisers-lose-placement-controls-with-bid-cuts-capped-at-90/);
  [AdRise Lab](https://adriselab.com/blog/meta-placement-controls-removed-value-rules-2026))

### 1.2 Lookalikes and customer-list seeds

- **[Vendor] Value-based lookalikes.** These weight high-value seed users more heavily, and they are the variant
  practitioners still recommend. The often-quoted "+15–30% ROAS vs standard lookalikes" has no traceable test
  behind it. The consensus pattern for 2026 is a hybrid: give Advantage+ a clean, high-LTV seed as a
  *suggestion*, and test that against plain broad with the same creative and budget. Manual lookalikes reportedly still
  win at low conversion volume (<50/week), in narrow B2B niches and in small markets.
  ([adlibrary.com 2026](https://adlibrary.com/posts/lookalike-audience-model-2026);
  [Madgicx 2026](https://madgicx.com/blog/why-facebook-lookalike-audiences-are-worth-your-ad-spend))
- **Segmenting seeds by vertical.** Separate lookalikes for jewellers and for florists or bakeries, for example,
  is logical, but I found no published test of it. **Gap.**

### 1.3 Choosing the optimisation event

- **[Fact] Learning phase.** Meta's benchmark is still about **50 optimisation events per ad set in 7 days** after
  the last significant edit. Vendors report lower exit thresholds (10 events in 2024; 25 for Advantage+ shopping
  in Aug 2026), but Meta has published no documentation for either
  ([ppc.land learning-phase explainer](https://ppc.land/learning-phase/)).
- **[Vendor] Low volume.** Below about 50 events a week, the standard advice is to optimise on the deepest event
  that still has volume, and to carry the deeper event (new customer) as a secondary signal or a value
  ([Cometly](https://www.cometly.com/academy/optimizing-meta-google-for-paying-customers)).
  Optimising for a "new-customer purchase" event means Meta is rewarded only for first-time buyers. Excluding
  existing customers through audiences does *not* change what the algorithm is rewarded for
  ([Mable](https://support.mable.ai/en/articles/3913391517-neukundenoptimierung-in-meta)).
- **[Fact, partially documented] Customer lifecycle strategy.** This new ad-set block in manual Sales campaigns
  offers "Get conversions from all audiences" or **"New customer acquisition"**. It began rolling out in early
  2026 and is not in every account yet. Meta warns that it "may increase your cost per result". New and existing
  customers are identified from the pixel, the Conversions API and customer lists. The "180-day" definition
  circulating in blogs is **unverified**.
  ([Spilno, 24 Jun 2026, updated 10 Oct 2026](https://spilnoagency.com.ua/en/news-en/meta-ads-new-customer-acquisition);
  [EasyInsights](https://easyinsights.ai/blog/metas-customer-lifecycle-strategy-the-small-setting-that-changes-everything/))
  Sources conflict on whether the Advantage+ Sales "existing customer budget cap" still exists
  ([adadvisor](https://adadvisor.ai/blog/meta-advantage-plus);
  [Dollar Commerce](https://dollarcommerce.substack.com/p/why-did-facebook-remove-the-existing)).
- **Leads and samples as the event.** Jon Loomer's point about lead optimisation is that "Meta thinks any lead is a
  good lead": it chases the cheapest leads, and those land in cheap countries
  ([jonloomer.com, 2023/2025](https://www.jonloomer.com/strategically-target-countries-for-quality-leads-with-meta-ads/)).
  **[Opinion]** For a seller with MOQs and a paid sample, a website purchase is a much stronger quality filter
  than a lead or a sample request. A paid order is, in practice, a business qualifying itself.

### 1.4 Cases from packaging, print, supplies, wholesale and SMB SaaS

**No published Meta results exist** for Packhelp, noissue, Vistaprint, Moo, Printful, Faire, Ankorstore or SumUp.
I searched for each one.

- Ad-library directories show that Packhelp, noissue and Vistaprint run Meta ads continuously. Vistaprint was
  estimated at 149 active ads and about 9 new creatives a week, relying on social proof and discount codes.
  These are third-party estimates, not results
  ([adlibrary Packhelp](https://adlibrary.com/brands/packhelp-facebook-ads);
  [Motion Vistaprint](https://motionapp.com/library/vistaprint)).
- An Ankorstore job ad describes paid acquisition as budget allocated *per market within CAC limits*, on both the
  retailer and brand sides. That is the structure, with no figures
  ([Welcome to the Jungle](https://welcometothejungle.com/en/companies/ankorstore/jobs/team-lead-paid_paris_ANKOR_P0P39YW)).
- A podcast summary claims Facebook was SumUp's winning early channel with a **9-month payback**. It is
  unverified ([EU Icons podcast](https://euicons.podbean.com/e/run-all-distances-how-sumup-competes-in-every-vertical-without-owning-any/)).
- **Gap:** Cimpress/Vistaprint shareholder letters (which discuss customer value) were not reached before the
  search budget ran out.

**For Westpack:**
- **Westpack is already ahead of the published playbook.** It optimises for purchases on broad targeting, tracks
  New_customer and reads results incrementally. Nobody in the category publishes anything better to copy.
- **Test the new "New customer acquisition" setting on one market, against a control.** If it is available, it
  is the native version of what the New_customer custom conversion approximates. **Case for:** Meta stops being
  rewarded for re-orders that Klaviyo would have produced anyway. **Case against:** it may raise cost per result,
  the definition is opaque, and DE/FR/IT probably do not have enough volume to learn on it. That is the next point.
- **Check the volume on DE/FR/IT before going further down the funnel.** At about 2,400 DKK/day and about
  3,500 DKK per incremental customer, these campaigns produce roughly **5 incremental new customers a week**. If an
  ad set is optimised on the New_customer custom conversion, it is almost certainly "Learning limited". Reported
  (non-incremental) volume is higher, so check the ad set's `learning_stage_info` before assuming. **Case for
  staying on Purchase:** more signal. **Case for New_customer:** the signal is right, and a "learning limited"
  label is not proof of poor delivery (Jon Loomer, ["The learning phase is just a label"](https://pubcast.jonloomer.com/the-learning-phase-is-just-a-label/), Oct 2025).
- **Rebuild the awareness lookalikes on value.** Use customers with two or more orders, or the top quartile by
  12-month contribution, as a value-based seed, ideally jewellery-only. The current seed is a 1% lookalike of
  all customers.
- **Do not trust the "intersect with business-owner behaviours" layer to hold.** Under Advantage+ audience those
  inputs are suggestions, and lookalike expansion is on for the DE/FR/IT awareness ad sets (see the project
  notes). The narrowing on paper is probably not the narrowing in delivery.

---

## 2. LTV and payback: setting CAC targets for a repeat-purchase B2B seller

- **[Canonical method] Target CAC comes from contribution, not ROAS.** Take contribution per order × expected
  orders within your payback window, minus a margin of safety. Then **scale only while *marginal* CAC stays
  under that target**. Marginal CAC is Δspend / Δnew customers between two spend levels over the same window.
  ([eightx, 16 Jul 2026](https://eightx.co/blog/marginal-cac-scaling-reality);
  [Ryze](https://www.get-ryze.ai/blog/meta-ads-optimization-principles-marginal-cpa-vs-average-cpa))
- **[Measured, B2C panel] Spend and CAC moved together.** Northbeam's panel of 1,000+ ecommerce brands (April 2026)
  showed median ad spend +9.6% year on year and median new-customer CAC +9.7%; the $5–10M revenue band saw
  CAC +17.1%. These are separate medians, not a matched elasticity (cited via eightx).
- **[Illustrative model, not data] How fast marginal CAC can climb.** With a short-run elasticity of 0.10,
  doubling spend moves average CAC from 60 to 112, but the marginal customer costs about 836, which is 14× the
  starting average. eightx says outright that no published source maps a spend multiple to a CAC increase.
- **[Fact] Meta's European ad prices rose every quarter.** Average price per ad in Europe, year on year: +9%
  (Q1 2025), +17% (Q2), +19% (Q3), +12% (Q4), +19% (Q1 2026), +10% (Q2 2026). Europe ad impressions rose
  +13–17% in the same period ([adsuploader tracker of Meta 10-Q/10-K regional tables](https://adsuploader.com/blog/meta-earnings-for-advertisers)).
  Part of any CAC rise is the market, not the account.

**For Westpack** (the arithmetic uses the figures in the brief; a 776 DKK first-order contribution):

| Campaign | CAC (incremental) | First-order contribution / CAC | Orders of equal contribution needed to pay back |
|---|---|---|---|
| All-Europe English | ~780 DKK | ~1.0× | ~1 (break-even on order one) |
| DE / FR / IT each | ~3,500 DKK | ~0.22× | ~4.5 |

- **The decision rests on one number Westpack has not shown here:** expected contribution per new customer over
  12–24 months, by market. Reorders of logo print (where the cliché is already paid for) probably carry *higher*
  contribution than the first order. If that is true, the 4.5-order hurdle is lower than the table suggests.
  - **Case for DE/FR/IT:** if a German jeweller places about 5 orders in 2–3 years, the campaign pays back.
    Local-language presence may also be what wins those larger, stickier accounts.
  - **Case against:** at 4.5× the first-order hurdle, the campaigns are a bet on repeat rates that must be about
    4–5× better than the English campaign's customers need. The English campaign is already profitable after
    order one.
  - **What to do:** pull Klaviyo/Shopify order history and build cohorts by first-order market and first-order
    month. Compute contribution at 6, 12 and 24 months. Set each market's ceiling CAC to that figure at 12
    months (cautious) or 24 months (aggressive).
- **Compare marginal CAC, not averages.** A budget step on the EU-English campaign should be judged on the
  *extra* customers it bought. Because it sits at about first-order break-even on average, its marginal
  customer is almost certainly below break-even on order one. Whether that is acceptable depends only on the
  repeat curve.
- **Hold each budget step long enough** to clear noise. At about 5 incremental customers a week (DE/FR/IT), a
  one-week read cannot tell a 3,000 DKK CAC from a 4,500 DKK one. You need roughly 4+ weeks per step. See §5.

---

## 3. Multi-market Europe

### 3.1 One ad set or one per country or language

- **[Fact/Opinion, Jon Loomer] How a combined ad set spends.** It balances cost and conversion rate across
  countries "to maximize overall results". Spend will not split evenly and "is driven by where conversions are
  available". Split countries mainly for relevance (language, offer), and only where each ad set keeps enough
  volume. If volume or stability is the problem, combine and stop worrying about the split
  ([Pubcast, 1 Apr 2026](https://pubcast.jonloomer.com/does-a-higher-cpm-mean-you-should-spend-more/)).
  His June 2026 episode on worldwide targeting for sales argues that a purchase-optimised ad set rarely wastes
  budget on non-converting countries, and points to value rules as the fix rather than splitting
  ([Pubcast, 17 Jun 2026](https://pubcast.jonloomer.com/does-worldwide-targeting-actually-work-for-sales/), not fetchable; summary via search).
- **[Measured, anecdotal] Lead and traffic campaigns skew hard.** With lead or traffic optimisation, low-CPM
  countries absorb almost all delivery and high-CPM countries get almost none. His fix was to group countries
  by CPM tier ([jonloomer.com, 2018/2025](https://www.jonloomer.com/facebook-ad-spend-by-country/)).
- **[Vendor] "Budget skew toward the cheapest market regardless of business value"** is widely repeated, but I
  found no Meta document confirming it for purchase optimisation
  ([Benly](https://benly.ai/learn/meta-ads/meta-ads-international-targeting)).
- **Mechanism (inference from how lowest-cost bidding works):** Meta minimises cost per *optimisation event*. A
  country gets spend when it produces events cheaply *by Meta's own attribution*. That attribution is typically
  7-day click / 1-day view, so it includes view-through. If cheap-CPM countries generate cheap *attributed*
  purchases that Westpack's incremental read does not confirm, Meta will keep funding them. That is the most
  likely explanation for spend in countries with ≤1 incremental new customer a month.

### 3.2 Value rules: steer countries without new ad sets

- **[Fact]** Value rules let you adjust bids by segment (location, age, gender, OS, device, placement) inside
  one ad set.
  - **Range:** from +1,000% to −90%. A country can be made expensive, but it **cannot be excluded** by a rule.
  - **Limits:** up to 10 rules per set, two criteria each, first matching rule wins.
  - **Where they work:** Sales and App-promotion objectives with website or app conversions.
  - **Where they do not work:** ROAS goals, bid caps, maximise-value and Special Ad Categories.
  - **Meta's warning:** advertisers must tick a box acknowledging that "your overall cost per result may
    increase".
  - Available since about July 2025.
  ([ppc.land, 6 Jan 2026](https://ppc.land/metas-value-rules-might-actually-cost-more-than-theyre-worth/);
  [Passive Promotion, 1 Sep 2025](https://passivepromotion.com/when-every-country-isnt-equal-value-rules-in-meta-ads/))
- **[Opinion]** Critics, including Loomer, say to use value rules only with clear segment-profit data and stable
  measurement, because a wrong assumption is amplified. One practitioner found that adding an age rule
  "seriously threw off the country balance".

### 3.3 Language and translated creative

- **[Fact, older doc] Multi-language ads.** One ad carries a default language plus variants, and each person sees
  their own language where a variant exists, "so you don't need separate ad sets with language targeting"
  ([Meta Help 1852644738394400](https://www.facebook.com/business/help/1852644738394400); the page body could
  not be fetched). Jon Loomer documented one version as limited to 6 languages, one image for all variants, and
  no translation of text inside the image
  ([jonloomer.com](https://www.jonloomer.com/facebook-ads-dynamic-language-optimization/)). Current limits need
  checking in Ads Manager.
- **[Fact, 2025] AI voice-over translation** ("Translate Voiceover") exists
  ([Jon Loomer, 83 changes 2025](https://www.jonloomer.com/meta-advertising-changes-2025/)).
- **Gap:** I found no 2025–2026 evidence measuring translated against English creative for B2B in Europe.

### 3.4 CPM levels and seasonality

**[Vendor, ecommerce benchmark, USD implied, no sample size]** Lebesgue 2026
([lebesgue.io, Jul 2026](https://lebesgue.io/facebook-ads/facebook-cpm-by-country)):

| Country | CPM |
|---|---|
| GB | 11.81 |
| DE | 9.05 |
| DK | 8.74 |
| NL | 8.58 |
| IE | 8.26 |
| SE | 8.12 |
| BE | 7.96 |
| FI | 7.72 |
| NO | 7.31 |
| FR | 6.95 |
| ES | 6.65 |
| LT | 6.51 |
| IT | 6.06 |
| PT | 6.02 |
| CZ | 5.70 |
| PL | 5.55 |
| HR | 5.39 |
| HU | 5.24 |
| SK | 5.12 |
| GR | 4.89 |
| BG | 4.21 |

- **Seasonality [Vendor]:** Superads shows a global CPM rise of about +18% from October to November. Germany
  rose about +94% (12.03 → 23.35, all industries), then fell back about half in December
  ([superads DE](https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/germany)). Figures vary widely by
  industry.
- **Gap:** currency and shipping/price display in multi-country ads were not researched (search budget ran out).

**For Westpack:**
- **The 25–30% problem is a mechanism, not bad luck.** Of the EU-English campaign's 3,800 DKK/day, about
  950–1,140 DKK/day lands in GR, HU, CZ, SK, HR and LT. Those countries have the lowest CPMs on the list
  (4.9–6.5), and that is exactly where a lowest-cost purchase optimiser goes when it gets attributed, cheap
  events there.
  - **Illustration (my arithmetic):** assume about 146 incremental customers a month (3,800 × 30 / 780), with ≤6
    of them in the weak countries. The weak countries then cost about 5,000+ DKK per incremental customer. The
    rest of the campaign costs about 600 DKK. Moving that spend would be worth many more customers than any
    creative change. This is an estimate and needs the per-country incremental figures behind it, which are
    noisy at these counts.
- **Three options, none of which adds an ad set:**
  - **(a) Value rules, −70 to −90% on the weak countries.**
    - For: keeps one ad set and keeps some exploration.
    - Against: Meta warns that cost per result may rise. It only works on lowest-cost bidding toward a website
      conversion, not on ROAS goals or caps.
  - **(b) Remove the weak countries from targeting.**
    - For: simplest, and it is certain.
    - Against: it gives up any later discovery. Losing Advantage+ freedom over geography has no known cost here,
      because geography is a hard limit anyway.
  - **(c) Leave it.**
    - The only case for this: the spend is building awareness or future demand that a 30-day incremental read
      cannot see. For a B2B packaging seller in HU or SK, that is weak.
  - **Recommendation:** (a) or (b), judged over 4–6 weeks on the campaign's total incremental new customers.
- **The DE/FR/IT gap is not about CPM.** DE, FR and IT CPMs (9.05 / 6.95 / 6.06) sit *below* GB (11.81), yet their
  CAC is 4.5× the English campaign's. So the gap is conversion rate per impression. Possible causes: smaller
  real demand, competition, site and checkout experience in the language, price and shipping, and the market
  audience being harder to find in local-language creative. Splitting by country gives control but costs
  volume per ad set, and at about 5 incremental customers a week these ad sets are volume-starved.
- **Multi-language ads could localise the English campaign** for SE, NL, ES, PL and others without new ad sets.
  Only do it if the landing pages exist in those languages; a translated ad that lands on an English page is a
  mismatch.
- **Q4: don't chase the consumer peak.** Westpack's buyers (jewellers and shops) stock up for Christmas before
  November. Consumer Black Friday CPMs, which roughly doubled in DE in the benchmark, buy Westpack nothing extra.
  **[Opinion]:** front-load into September–October and test pulling back in the last two weeks of November. This
  is untested for Westpack; check last year's November CAC by market before acting.

---

## 4. EU regulation affecting delivery and targeting (2025–2027)

### 4.1 DMA and Less Personalised Ads (LPA)

- **[Fact] The non-compliance decision.** In April 2025 the Commission found Meta's pay-or-consent model
  non-compliant with the DMA and fined Meta €200m. Meta is appealing.
- **[Fact] Meta's commitment.** On 8 Dec 2025 the Commission announced that Meta had committed to present EU
  users with a choice between full personalisation and sharing less data for "more limited personalised
  advertising", from **January 2026**. The Commission will gather evidence on uptake and impact
  ([EC DMA site, 8 Dec 2025](https://digital-markets-act.ec.europa.eu/meta-commits-give-eu-users-choice-personalised-ads-under-dma-2025-12-08_en)).
- **[Fact, reported] The revised flows.**
  - They went to all EEA users in January 2026.
  - A non-dismissible reminder follows in **January 2027** for users who clicked through without choosing.
  - LPA uses about 90% less data and relies on minimal signals.
  ([ppc.land, 10 Mar 2026](https://ppc.land/metas-2026-dma-report-reveals-whatsapp-ads-a-eu200m-fine-and-a-defiant-stance-on-personalized-advertising/))
- **What LPA targets on.** Context, age, location, gender and ad engagement, not browsing history. It includes
  unskippable "ad breaks" of a few seconds
  ([Cittago, 6 Sep 2026, citing the Meta newsroom of 12 Nov 2024](https://cittago.com/blog/meta-less-personalised-ads-eu-filings-2026/);
  [EU Perspectives, 19 Mar 2026](https://euperspectives.eu/2026/03/meta-pay-or-ok/)).
- **[Vendor claim by Meta, "early feedback"]** LPA ads produce **70% fewer onsite and 61% fewer offsite
  conversions** than personalised ads, and an "almost 800%" rise in ads being closed. Meta calls SMEs the most
  affected advertisers ([Meta newsroom, 2 Jul 2025](https://about.fb.com/news/2025/07/why-the-commissions-decision-undermines-the-goals-of-the-dma/)).
  This is an interested party lobbying a regulator, so treat it as an upper bound.
- **[Fact] No uptake share has been published.** Meta's 10-K (FY2025) and 10-Qs (Q1, Q2 2026) carry an unchanged
  risk paragraph calling LPA "less relevant and effective" with a potentially significant effect on European
  revenue, and give no figure (Cittago). On the Q2 2026 call, Meta reportedly flagged "policy changes in Europe
  that allow for less personalized ads" as a possible Q3 2026 headwind
  ([secondary report, 31 Jul 2026](https://completeaitraining.com/news/meta-reports-27-percent-ad-revenue-growth-but-misses/); not verified against the transcript).
- **Not affected:** UK, US and Switzerland. LPA is EEA-wide, so it includes NO.

### 4.2 DSA

- **[Fact] Beneficiary and payer on every EU ad.** Ads targeting the EU must name a beneficiary and a payer, or
  they cannot publish. The EU Ad Library shows the payer, the beneficiary, the targeting parameters chosen
  (age, gender, locations) and the estimated reach per member state
  ([Jon Loomer](https://www.jonloomer.com/beneficiary-and-payer-requirements-for-meta-ads-in-the-european-union/);
  [adlibrary.com on the DSA repositories](https://adlibrary.com/posts/eu-dsa-ad-repositories-developers)).
  A tracker shows a policy clause disappearing in July 2026, but the page does not identify the clause.
  **Unconfirmed**; there is no evidence the requirement ended.
- **[Fact, the regulation itself; not re-fetched]** The DSA bans ads based on profiling with special-category
  data, and profiling-based ads to minors. Meta restricts teen targeting to age and location globally
  ([Search Engine Land](https://searchengineland.com/meta-introduces-new-ad-targeting-limits-for-teens-391259)).

### 4.3 TTPA (political ads)

- **[Fact]** Meta stopped political, electoral and social-issue ads in the EU from **6 Oct 2025**, ahead of the
  TTPA applying on 10 Oct 2025
  ([Meta newsroom](https://about.fb.com/news/2025/07/ending-political-electoral-and-social-issue-advertising-in-the-eu/amp/);
  [ppc.land](https://ppc.land/meta-blocks-political-ads-in-eu-as-ttpa-regulation-takes-effect)).

### 4.4 Coming next

- **[Fact] Digital Fairness Act.** The proposal had not been tabled as of September 2026. Parliament's
  Legislative Train lists Q4 2026. It is expected to address personalised advertising based on profiling and
  dynamic pricing; whether it restricts them is speculation
  ([EP Legislative Train](https://www.europarl.europa.eu/legislative-train/theme-protecting-our-democracy-upholding-our-values/file-digital-fairness-act)).
- **[Fact] Digital Omnibus.** Proposed in November 2025, not law. It would move cookie consent into the GDPR
  (Art. 88a/88b) and make browser consent signals binding. Consent remains the rule for advertising tracking
  ([Osborne Clarke](https://www.osborneclarke.com/insights/digital-omnibus-reshapes-eu-cookie-rules-leaves-banner-fatigue-largely-intact)).

**For Westpack:**
- **Expect LPA to shrink what Meta can learn from in the EEA.** Every EEA market Westpack runs, everything except
  GB and US, has a share of users with far less signal. That shrinks lookalike match pools, retargeting pools
  and conversion signal there. The size of the share is unknown, so treat it as an unquantified headwind rather
  than a number to plan on.
- **GB is the cleanest market structurally.** It is outside LPA, and it is already the best country in the
  English campaign. Protect its share of budget.
- **The EU Ad Library is free competitor intelligence.** Packhelp's and noissue's EU ads expose their targeting
  choices and reach by country. Westpack's ads expose the same about Westpack.
- **Check sustainability copy against TTPA.** Eco-product ads (Rio Eco) are product claims, not social-issue
  advocacy. Copy that strays into environmental *policy* could be classified as a social-issue ad and refused
  in the EU.

---

## 5. Market-expansion playbooks: testing a new country

- **The evidence is thin.** I found no rigorous published playbook, and no company case with budgets and
  thresholds. Vendor guidance ranges from "2–3× expected daily spend for 7–14 days" to "4–6 weeks minimum".
  The recurring sound advice is: define the CPA ceiling before launch, test one or two markets at a time,
  and size the budget to the learning threshold (weekly budget ≈ target cost per result × 50)
  ([adamigo](https://www.adamigo.ai/blog/ultimate-guide-to-meta-ads-geographic-expansion);
  [extuitive](https://extuitive.com/articles/meta-ads-minimum-budget-for-testing)).
- **[Fact] Measurement tools.** Meta's open-source **GeoLift** builds a synthetic control from untreated regions.
  Practitioners suggest 4–8 weeks of pre-period history and a 10–20% holdout
  ([Triple Whale](https://www.triplewhale.com/blog/geolift-geo-based-incrementality-testing)).
- **[Statistics, not a source] Size tests on customer counts.** With 10 new customers observed, the 95% Poisson
  interval runs from about 4.8 to 18.4, so a CAC read is uncertain by about ±2×. You need about 25–30 customers
  to get within about ±40%.

**For Westpack:**
- **The English campaign is already a 25-country market test that never reads its own results.** Make it
  explicit. Each quarter:
  - Rank countries by incremental new customers and by cost per new customer.
  - Treat any country with fewer than 3 incremental new customers in 90 days, at more than 3× the campaign
    average CAC, as **failed**, and bid it down or remove it.
  - Treat any country running near or below the campaign average with growing counts as a **candidate for
    its own language treatment**.
  - Both thresholds are proposals; set them before reading the data.
- **A new local-language market (ES or NL, say) needs a decision rule fixed before launch.**
  - **Budget:** enough to buy about 25 customers at the ceiling CAC, roughly 2× the ceiling × 25 if CAC
    lands high. At a 1,500 DKK ceiling that is about 37,500–75,000 DKK.
  - **Duration:** 6–8 weeks.
  - **Stop rule:** marginal CAC above the 12-month cohort contribution.
- **The case against new markets at all.** DE/FR/IT show that a local-language campaign costs more than 4× the
  English campaign per customer. Unless repeat data says those customers are worth more than 4× as much, the
  cheapest "expansion" is to localise the English campaign (multi-language ads plus a local landing page)
  rather than to launch new campaigns. That also fits the "no more ad sets" constraint.

---

## Gaps and confidence

**High confidence:**
- The timelines for exclusion removal and interest consolidation.
- The value-rules mechanics.
- The LPA rollout dates and the fact that no uptake has been published.
- The DSA beneficiary/payer requirement.
- The TTPA dates.
- Meta's European price-per-ad trend.

**Medium confidence:**
- Country spend skew under purchase optimisation. This is practitioner-observed, and Meta has not documented it.
- The availability and definition of the Customer lifecycle strategy setting.
- The CPM levels, which are vendor data with no stated sample.

**Low confidence, or no evidence:**
- Any B2B-specific performance figure.
- Any figure on value-based against standard lookalikes.
- The size of the LPA effect on Westpack.
- Market-test thresholds.
- Cimpress/Vistaprint and Shopify disclosures; currency display. These were not researched because the search
  budget ran out.
