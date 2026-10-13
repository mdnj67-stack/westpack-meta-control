# Creative strategy and creative testing on Meta, 2025–2026: evidence for Westpack

Research date: **2026-10-13**. Desk research only: no Meta API calls, no changes to the ad account.
Sources are labelled by type: **[Meta-doc]** for Meta documentation or engineering posts, **[Meta-study]**
for Meta's own research (real data, but Meta sells the product), **[Dataset]** for large third-party
datasets (often a vendor's), **[Practitioner]** for named experts' experience and opinion, and **[Vendor]**
for tool or agency marketing. Almost all outside evidence is B2C/DTC e-commerce. That is flagged where
it matters.

Limit of this pass: the shared web-search budget ran out partway through. Primary-page fetches
continued afterwards, but three areas are thinner than intended: large-sample copy-length and headline
studies, packaging-category cases, and Meta's own Reels guidance. These are marked **gap** below.

## Summary

Meta's own engineering material confirms the mechanism behind "creative is the new targeting". Andromeda
is a retrieval stage that cuts tens of millions of ads to a few thousand candidates per impression, and
Meta's April 2025 guidance says outright that "the focus has shifted from niche targeting to creative
diversification". The popular details are not Meta's: the "Entity ID", similarity thresholds of 40% or
60%, and "50 similar ads count as one" all come from practitioners. Meta has never published them. They
remain a reasonable working model, and Meta has since shipped an ad-set "Creative diversity" rating
(reported August 2026). The strongest numbers come from Motion's dataset (578,750 creatives, $1.29B,
Sep 2025–Jan 2026). About 5% of creatives become "winners", and winners take 55% of spend. That makes one
carrier-bag ad carrying ~40% of EU spend normal rather than alarming. Motion defines "winner" by how much
Meta chose to spend on an ad, not by results, and its window includes Black Friday. At Westpack's volume
(a few dozen new customers a week in the EU campaign), no creative test can tell ads apart on new
customers inside a month. Meta's native Creative Testing tool helps with even budget, but upstream
signals plus a pre-agreed decision rule are the realistic method. Fatigue should be judged by an ad's
cost per result and CTR against its own baseline, not by frequency alone. Meta's 2023 analysis found a
~45% drop in conversion likelihood by the fourth exposure to the same creative, and ~8% higher
conversion rate when new ads were added to fatigued ad sets. The 5-ads cap is defensible at Westpack's
budget. It does conflict with Meta's softened ad-volume guidance, and the Flexible format (one ad, up to
10 assets) reconciles the two only if each ad holds one concept. Advantage+ creative's generative and
text features are a real risk to Westpack's factual-claims rules (documented incidents in 2025–2026).
Westpack's ad-creation code does not set them explicitly, so they should be audited. Meta's October 2026
creator paper is the most relevant new evidence for localisation: ≥30% partnership ads gave 45% lower
cost per incremental purchase across 20 EMEA lift studies. It is Meta's own study, at 92% confidence.

---

## 1. "Creative is the new targeting": what Andromeda does with creative

### What Meta has documented

- **Andromeda is the retrieval stage.** It narrows "tens of millions" of ad candidates to "a few thousand"
  for later ranking, using a jointly trained hierarchical index. Meta reports +6% recall and +8% ads
  quality on selected segments, a 10,000x increase in model capacity, and that "the number of ads
  creatives in Meta's recommendation systems is expected to grow significantly" because of GenAI tools.
  [Meta-doc] Meta Engineering, 2024-12-02:
  https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/
- **The ranking stack around it.** GEM (up to +5% conversions on Reels at launch), Lattice (~+12% ad
  quality, up to +6% conversions) and sequence learning (+3% conversions). Meta writes that as businesses
  "upload more and more creatives to support a diversification strategy", Andromeda powers more complex
  selection. No number of creatives is given. [Meta-doc] Meta for Business, 2025-03-27:
  https://www.facebook.com/business/news/ai-innovation-in-metas-ads-ranking-driving-advertiser-performance
- **Meta's explicit guidance.** "With the rise of AI-enabled advertising tools, the focus has shifted
  from niche targeting to creative diversification." Diversification is defined as "a wide range of ad
  creatives with different themes, messages, and visuals to cater to diverse audience segments". The
  case cited: Dribbleup went from 3–4 to ~50 new creatives a week with "steady performance". That is
  steady performance, not better performance. [Meta-doc] Meta for Business, 2025-04-22:
  https://www.facebook.com/business/news/the-creative-advantage-unlocking-the-power-of-diversification-with-meta-andromeda
- **Ad volume guidance was softened.** Meta's "About managing ad volume" page used to say there was no
  benefit beyond about six ads per ad set. Per Jon Loomer, that sentence was removed (around early 2025),
  but the page still warns that each ad delivers less often when too many run at once. [Practitioner
  reporting a Meta-doc change] Loomer pubcast, 2026-05-06:
  https://pubcast.jonloomer.com/does-adding-more-ads-actually-hurt-performance/ and
  https://www.jonloomer.com/meta-andromeda/
- **Creative diversity rating.** An ad-set column, "Creative diversity" (Low/Medium/High), reportedly
  went live on 2026-08-26. Meta calls it "estimated and in development". [Vendor reporting]
  CommonThread, 2026-09-09:
  https://commonthreadco.com/blogs/coachs-corner/metas-new-creative-diversity-score-is-live-in-ads-manager-what-ecommerce-brands-must-act-on-now
  Vendors also describe "Creative similarity" and "Creative fatigue" diagnostics under Analyze & Report,
  but menu paths vary and I could not reach Meta's help page. Check in the account.

### What is not documented (practitioner model)

- **"Entity ID" is not a Meta term.** Practitioners use it for the idea that Andromeda clusters
  near-identical ads so they compete as one candidate. Motion's July 2026 Andromeda 2.0 talk says so
  explicitly and calls it a "semantic fingerprint" from vision, text and audio. [Practitioner]
  https://motionapp.com/library/talk/andromeda-2-0-explained-how-meta-s-algorithm-actually-picks-your-winning-ads/
  ; Silverback, https://www.silverbackstrategies.com/blog/creative-is-the-new-targeting-how-to-master-entity-ids-and-unlock-scale/
- **The similarity thresholds are unsourced.** "Above 60% similarity is suppressed, keep it under 40%"
  and "25 diverse ads in one ad set gave 17% more conversions at 16% lower cost" circulate with no
  primary source. One frequently cited post admits that Entity IDs "are not exposed to advertisers".
  [Vendor] https://nikhil.pro/meta-ads-creative-similarity-explained/ (2026-08-05)
- **What counts as distinct, by consensus.** Practitioners agree on the following, though Meta has not
  documented it:
  - A different **persona, problem/motivation, angle, or visual world** (setting, talent, format family)
    is a new concept.
  - A changed **headline, word, colour, music or thumbnail** is a variant.
  - Running the same angle as video, static and carousel is still one concept, not diversity (Caleb
    Kruse, Motion talk, January 2026).

  Shooting everything in one location can merge otherwise different ads, because setting is a strong
  visual signal. [Practitioner]

### Evidence on diversity and concentration (numbers)

- **Motion Creative Benchmarks 2026** [Dataset; Motion sells creative analytics]:
  https://motionapp.com/library/research/creative-benchmarks-2026/ and its methodology page,
  https://motionapp.com/library/research/creative-benchmarks-2026/methodology/
  - Scope: $1.29B spend, 578,750 creatives, 6,015 accounts, 2025-09-01 to 2026-01-01.
  - "Winner" means at least 10x the account's median creative spend and at least $500. About 5% of
    creatives qualify, and winners take **55% of spend** (23% at Micro, 64% at Enterprise).
  - Per-tier winner share: Micro 3.7%, Small 6.2%, Medium 7.3%, Large 8.1%, Enterprise 8.2%. About half
    of all creatives are "losers" (switched off or never spending before 28 days).
  - Launch cadence for **Small ($10–50K/month)**: 4.1 new creatives a week on average, 8.1 for the top
    quartile. Source: Motion talk, March 2026,
    https://motionapp.com/library/talk/meta-ads-in-2026-how-many-creatives-do-you-actually-need-to-launch/
  - **Critical caveat:** a winner is defined by spend, which is Meta's own allocation, and not by
    conversions, ROAS or incrementality. The window includes BFCM, which flatters offer-led ads.
- **Reported ad-account composition.** The median top account ran ~491 ads over 30 days, at 61% static
  and 39% video, from a 67,000-ad analysis cited via a LinkedIn post. [Vendor, secondary] Segwise,
  2026-03-23: https://segwise.ai/blog/static-video-ratio-meta-ads
- **No independent controlled study** shows that diversity *causes* lower CPA. The causal evidence is
  Meta's aggregate claims plus practitioner experience.

**For Westpack:**

- **Read the 7 October jump as consistent with the mechanism, not as proof.** CTR rose from 0.99% to
  1.48% and new customers per week roughly doubled after the new EU ads went live. That fits the
  mechanism: new concepts get retrieved for people the old set never reached. Three things confound it:
  - The budget went from 2,500 to 3,800 kr/day on 2026-10-12.
  - The DE/FR/IT copy reset on 2026-10-07 restarted learning.
  - One week of new-customer counts carries a wide Poisson interval (see §2).

  Treat it as a strong hypothesis. The test is whether the new ads keep their spend share and whether the
  account's cost per new customer holds over the next 3–4 weeks.
- **One ad carrying ~40% of spend is the expected pattern, not a fault.** Winners take 55% of spend in
  Motion's data. The real risk is dependence: when that ad fatigues, the campaign has no second engine.
  Measure "concepts in the ad set that each carry ≥10% of spend" and aim for at least two.
- **Count concepts, not ads.** Under the 5-ad cap, every slot should hold a different concept, for
  example: carrier bags with your logo (product/offer), jewellery-box unboxing (experience), "from 48
  pieces" (MOQ/price clarity), production or employees (proof/founder-led), customer-logo photos (social
  proof). A second carrier-bag ad that only changes the headline spends a slot on a variant.
- Check the "Creative diversity" column on the EU and market ad sets once it appears in the account.

## 2. Creative testing frameworks, and what can be concluded at low volume

### What sophisticated advertisers do (2025–2026)

1. **Test inside the business-as-usual (BAU) ad set** (most common after Andromeda): launch new concepts
   into the live ad set and let Meta allocate. This is cheapest and closest to real delivery. It cannot
   give a clean comparison, because Meta starves most new ads, so "not spent on" mixes "worse" with
   "never retrieved or explored". [Practitioner] Loomer, 2026-05-06 (link above).
2. **A dedicated testing campaign or ad set (often ABO):** gives a controlled budget per concept.
   Winners are then moved into BAU, where they often perform differently because the auction context
   changes. Loomer and others report this. [Practitioner]
3. **Meta's native Creative Testing tool**, at ad level [Meta feature, described by a practitioner].
   Jon Loomer, 2025-10-13 (updated 2026-01-03): https://www.jonloomer.com/meta-creative-testing/
   - Setup: 2–5 test ads, created as duplicates of the starting ad (the original is not part of the
     test). Budget is a share of the campaign or ad set, Meta recommends ≤20%. The default is 7 days, the
     maximum reportedly 30. Choose a success metric (cost per result, CPC, CPM, or a custom conversion).
   - It is a true A/B test: each person sees one test ad, spend is kept roughly even, and results land
     in Experiments. Afterwards the ads keep running without the even split.
   - It requires the **Highest volume** bid strategy. Cost cap, bid cap and ROAS goal are excluded.
   - Some reports say the limit is rising to 10 ads. Loomer has also logged bugs with uneven spend:
     https://www.jonloomer.com/qvt/creative-testing-tool-bugs/
4. **Flexible format / Advantage+ creative** is explicitly **not** a testing tool. Breakdowns by asset do
   not work for Flexible, so you cannot see which asset won. [Practitioner] Loomer, 2025-04-14:
   https://www.jonloomer.com/how-i-use-flexible-ad-format/
5. **A/B test (Experiments) at campaign or ad-set level.** This is the cleanest design, but it duplicates
   structure and splits learning, and it rarely reaches significance for small advertisers.

### What the numbers allow (my calculation, standard Poisson power arithmetic)

To tell two ads apart on a count outcome such as new customers, at 80% power and α=0.05 with equal
exposure:

| True difference in cost per new customer | Conversions needed **per ad** |
|---|---|
| 50% (1.5x) | ~95 |
| 30% (1.3x) | ~230 |
| 20% (1.2x) | ~470 |

Westpack's EU campaign at ~782 kr per new customer and ~3,800 kr/day produces on the order of 30–35 new
customers a week in total. A test that puts 20% of budget across three ads gets roughly 2 per ad per
week, so **no creative test on new customers can conclude anything within a quarter.** Purchases of all
kinds give a few times more events, which still only detects very large differences.

Practitioners' rule of thumb is ~50 optimisation events per week per ad set (Loomer, above). That is a
learning-phase heuristic, not a test-power rule.

### What can be concluded

- **Upstream signals are measurable quickly.** At Westpack's impression volume, a few days give enough
  data for CTR, cost per landing-page view, 3-second view rate and add-to-cart rate. For example, CTR at
  1.0% versus 1.3% is detectable within days. These signals select for *attention and relevance*. They
  are only loosely linked to new customers on incremental attribution.
- **"Meta spends on it" is a selection signal too.** It is how Motion defines a winner, and it is cheap.
  It carries Meta's bias toward cheap engagement in its own model, not causal value.
- **The defensible approach is a two-stage decision rule, agreed before launch:**
  - Kill a concept on clear upstream failure (for example, CTR below half the ad-set median after
    ~5,000 impressions, or no meaningful spend after 7–10 days).
  - Keep or scale it on spend share plus a cost per new customer that is *not significantly worse* over
    4+ weeks.
  - Accept that "better on new customers" is rarely provable at creative level. Prove it at campaign or
    account level instead, as the 7 October episode does.

**For Westpack:**

- **Do not build a separate testing campaign.** The user does not want more structure ("det skaber kun
  mere arbejde"), and at this volume a separate campaign mostly proves nothing on new customers.
  Recommended instead: test inside BAU, use the Placeholder bank as the pipeline, and run Meta's native
  Creative Testing tool occasionally on the EU campaign for **concept-level** questions (for example,
  unboxing video against MOQ static), judged on CTR, cost per add-to-cart and cost per purchase.
- **Conflict to check:** the native tool requires Highest volume. If any conversion ad set uses a cost
  cap, the tool cannot be used there.
- **Pre-register the decision rule** in the same way the attribution-switch evaluation is pre-registered
  (`scripts/attribution-switch-evaluation.js`). That stops "this ad is winning" from being read off a
  few customers.
- **The case for a testing campaign anyway:** it would protect the 40% carrier-bag ad from new ads
  diluting its delivery, and it gives cleaner reads. **Against:** more ad sets, split learning, and
  results that do not transfer to BAU. At Westpack's size the balance favours BAU testing.

## 3. Creative fatigue: detection, half-life, refresh, and the 5-ad cap

### Evidence

- **Meta's in-product statuses** [Meta-doc, as reported by third parties; I could not open the help page]:
  - "Creative limited": cost per result above the ad's past level but under 2x.
  - "Creative fatigue": 2x or more.
  - Both appear reliably only for ad sets with **one creative** (or catalog, dynamic creative and
    Advantage+ app), so they are lagging and often absent in multi-ad ad sets. Meta may warn before
    publishing when it predicts fatigue within 7 days.

  Loomer, 2025-09-15: https://www.jonloomer.com/creative-fatigue-meta-ads/ ; adsuploader, 2026-05-17:
  https://adsuploader.com/blog/facebook-ad-fatigue
- **Analytics at Meta, "Creative fatigue"** (November 2023, canonical) [Meta-study, read via secondary
  sources because Medium returned 403]:
  https://medium.com/@AnalyticsAtMeta/creative-fatigue-how-advertisers-can-improve-performance-by-managing-repeated-exposures-e76a0ea1084d
  - Method: exposure measured per person *per creative* over 30 days, in direct-response campaigns.
  - The average impression went to someone who had already seen the creative **4.2 times**, and 19% of
    impressions went to people who had seen it 5 or more times.
  - Click likelihood decays roughly as **(N+1)^-0.43**, which puts conversion likelihood about **45%
    lower by the fourth exposure**. There was **no warm-up effect** for direct response.
  - In a randomised experiment (~26,000 observations), **adding new ads to fatigued ad sets raised
    conversion rate by ~8%** among high-fatigue cases.

  This is the best causal evidence in this report, and it is about **adding** creative, not replacing
  it.
- **Frequency alone is not fatigue.** "If results aren't tanking, I don't care what your frequency is."
  [Practitioner] Loomer, 2025-09-15.
- **Half-life benchmarks are unreliable.**
  - AdSpyder (24,650 ads, May 2026): median observed run ~4 days, yet ~30% ran 30+ days and ~15.5% ran
    90+ days.
  - Benly (tech/software, Q1 2026): median 26 days.
  - The often-quoted "36 days" comes from Pattern89 data last updated in 2021, per Adligator (August
    2026).

  These measure how long ads *run*, which is not decay. [Vendor/Dataset]
  https://adspyder.io/blog/ad-fatigue-benchmarks/ ; https://benly.ai/benchmarks/technology-software ;
  https://adligator.com/blog/facebook-ad-creative-lifespan-how-long-ads-last-2026
- **Proper detection, as practitioners agree:** compare each ad against its **own** trailing baseline,
  not against an industry figure:
  - CTR (link) falling for 2–3 weeks while CPM is stable or rising
  - cost per result rising
  - for video, 3-second view rate ("hook rate") falling
  - spend share falling, which is Meta moving away from the ad
  - frequency rising within the ad's own delivery pool

  Adjust CPM for account-wide seasonality (Q4). The audience-saturation module already does this for
  ad sets with `cpmChange`.

### Refresh cadence

No credible source supports a fixed cadence. "Every 2–3 weeks" and "50/30/20 refresh" are unsourced
practitioner rules. Motion's top-quartile Small accounts launch ~8 creatives a week, but that is a
correlation among accounts that spend more, not proof that volume causes better results.

**For Westpack:**

- **The 5-ad rule matches the study only if replacement is prompt.** Meta's ~8% result is about adding
  fresh ads to a fatigued ad set, and the rule's "pause the weakest to make room" achieves the same
  thing.
- **Case for the cap:** at ~3,800 kr/day, budget concentrates on 1–3 ads anyway, extra ads mostly sit
  unspent, and the cap forces deliberate choices and keeps reads clean.
- **Case against:** Meta removed its "about six" line, and Andromeda's retrieval works best with more
  distinct candidates. With five slots and one holding 40% of spend, there may be only 2–3 genuinely
  exploring concepts.
- **Reconciling them:** keep the cap, but give each slot a **different concept**, and use the Flexible
  format so a slot can hold up to 10 assets of *one* concept. Two costs come with this: no asset-level
  reporting, and one URL per ad.
- **For the 40% carrier-bag ad**, watch weekly against its own 4-week baseline: link CTR, cost per
  purchase on the incrementality key, and its spend share. Have a replacement concept ready in the
  Placeholder bank *before* it fades (PH-AD02 carrier bags, PH-AD12 bag mosaic). Do not pause it on age
  or frequency alone. This is already the rule.

## 4. Formats, placements, and Advantage+ creative / generative AI

### Formats (2025–2026 evidence)

- **Motion asset types**, ranked by hit rate (roughly 4–12%), Sep 2025 to Jan 2026 [Dataset, spend-defined
  winners, BFCM-weighted]:
  https://motionapp.com/library/research/creative-benchmarks-2026/top-asset-types/
  - Top: **text-only**, then **product image with text**, lifestyle-product image, UGC, high production.
  - **Carousel last**, animation second to last. Both also under-capture spend relative to their share
    of creatives.
  - Text-only leads at an 11.6% hit rate (Motion talk, March 2026).
- **Motion visual formats** [same caveats]:
  https://motionapp.com/library/research/creative-benchmarks-2026/top-visual-formats/
  - Offer-first banner: 8.6% hit rate, 29.3% of spend
  - Demo: 8.1%
  - Testimonial: 6.5%
  - **Unboxing: 9.8% hit rate**, the highest listed, but only 2.1% of creatives
  - Celebrity: 5.9%
  - "Founder" and "Behind the scene" sit in the 5–9% band.
- **Video against static.** No independent large-sample study isolates Reels cost per purchase. Agency
  figures conflict:
  - ATTN 2026: video CTR 1.9% against 1.1% for static, but CPA $48.20 against $34.50, static cheaper.
  - MHI ($30M+ DTC spend): video 35–50% higher CTR, static 40–60% lower CPM.

  Treat all of this as vendor data. Segwise, 2026-03-23 (link above).
- **Placements.** Meta's AI dubbing, Reels-first ranking (GEM launched on Reels) and safe-zone guidance
  all push toward native 9:16 for Reels and Stories and 4:5 for Feed. Third-party safe zones: keep text
  out of the top ~14% and bottom ~35% of 9:16 (Moda). **Gap:** Meta's own Reels creative guidance was
  not fetched.

### Advantage+ creative features: what they do (Meta-doc)

Meta's feature list with API enums is in Marketing API, "Get started with Advantage+ creative":
https://developers.facebook.com/docs/marketing-api/creative/advantage-creative/get-started
Since v22 (2025-01-17) the "standard enhancements" bundle is deprecated and features are opted into one
by one:
https://developers.facebook.com/blog/post/2025/01/17/marketing-api-v22-impacts-to-advantage-plus-creative-enhancements/

| Feature (enum) | What it does | Risk for Westpack |
|---|---|---|
| `text_optimizations` (Text improvements) | Swaps or rewrites primary text, headline and description, including AI variants | **High.** Can produce claims the site does not state ("free samples", delivery time) |
| `image_templates` (Add overlays), `add_text_overlay` | AI or catalog text overlays on images | **High.** Unreviewed claims burned into the image |
| `image_background_gen`, `image_uncrop`, `video_uncrop`, `image_animation` | Generated backgrounds, AI expansion, animation | **High** for product truth. A box or bag can be warped or invented |
| `text_translation`, `image_text_translation`, `translate_voiceover` | Machine translation of copy, of in-image text, and EN→ES voiceover | **High.** Repeats the 7 Oct translation defects. "Du/Sie" register cannot be controlled |
| `enhance_cta`, `creative_stickers` | Pairs phrases with the CTA, AI CTA stickers | Medium. Unreviewed wording |
| `inline_comment` (Relevant comments) | Shows a comment under the ad | Medium. A complaint can surface |
| `reveal_details_over_time`, `description_automation`, `product_extensions` | Page or catalog details | Low–medium |
| `adapt_to_placement`, `image_touchups`, `video_auto_crop`, `image_brightness_and_contrast`, `video_filtering` | Crops, fit and colour | Low. On by default for adapt_to_placement. Check crops of logos and text |
| `music` (`asset_feed_spec.audios`) | Adds music | Low–medium (brand tone) |

Meta claims Advantage+ creative image generation gave +11% CTR and +7.6% conversion rate (2025-04-22
post). That is an unpublished-methodology vendor claim.

### Documented failures (2025–2026)

TNW, reporting a Business Insider investigation, 2026-07-14:
https://thenextweb.com/news/meta-ai-ad-tools-brands-chaos

- Products warped and changed.
- An REI bike rendered with two handlebars. REI said it was "auto-enrolled".
- Gibberish copy, and apparel changed into different garments.
- Agencies reported a bug that toggled AI settings back on.
- Meta's answer: its terms say "AI can make mistakes", and review is the advertiser's job.

**For Westpack:**

- **This is the clearest conflict with Westpack's rules.** Claims must come from the site, samples are
  not free, and logo days are production time. Text improvements, overlays and translation can
  silently break all three.
- **The code does not lock the features off.** Westpack's ad-creation code (`server/lib/meta.js`,
  `createAdCreative*`) never sets `creative_features_spec`. For asset-feed ads it copies the source ad's
  `degrees_of_freedom_spec`. New ads therefore inherit whatever the source ad or account defaults carry.
  **Recommended:** check account-level creative feature defaults in Ads Manager, and set explicit
  `OPT_OUT` for the high-risk rows above when the app creates ads. Keep placement crops on, and review
  them.
- **Re-check after publishing,** given the reported toggle-back bug.
- **Case for leaving some features on:** Meta's own data shows small lifts, and visual touch-ups help
  placement fit. **Against:** a single false claim in a B2B ad costs more than a few percent of CTR, and
  the user approves copy line by line.
- **Formats:** Motion's ranking supports what Westpack already has: simple product-with-text statics,
  unboxing, demos and production clips. Carousels rank last in the dataset, but Westpack's
  series-video carousel (PH-AD11) is worth a native test rather than an assumption.

## 5. Creative for B2B and SMB buyers, and for packaging

### Evidence

- **No controlled B2B creative study on Meta was found.** The material is practitioner and agency
  guidance:
  - Phone-shot founder or employee video beats polished corporate video for cold B2B prospecting.
  - Faces beat logos.
  - Specific role or company references in copy help the audience self-qualify ("for jewellers who…").

  [Vendor/Practitioner] e.g. https://www.flighted.co/blog/can-facebook-ads-work-for-b2b-brands ;
  https://saashero.net/strategy/b2b-ad-creative-design-guide/ (2026-09-04)
- **"Creator-led ads up to 32% more efficient" in B2B** is an unsourced talk claim attributed to Meta,
  with no method or definition given. [Practitioner] Motion talk, December 2025:
  https://motionapp.com/library/talk/the-creator-led-strategy-boosting-b2b-ad-efficiency-32-meta-study/
- **Meta creator paper, 2026-10-07** [Meta-study, the most recent and most relevant to Europe]:
  - Results: in **20 EMEA conversion lift studies** (2025-01 to 2025-06), advertisers with ≥30% of assets
    as partnership ads in BAU saw **45% lower median cost per incremental purchase** and **35% higher
    incremental ROAS**, at **92% confidence**, below the usual 95%.
  - 63% of partnership-ad reach was new to the advertiser's BAU ads.
  - Meta recommends putting partnership ads **in the same ad set** as BAU, not running them alone.
  - Verticals were consumer-heavy, and Meta has a commercial interest.

  Summary and caveats: PPC Land, 2026-10-11:
  https://ppc.land/meta-says-partnership-ads-cut-incremental-purchase-costs-45-in-emea-tests/
- **B2B buying is mostly out-of-market** (the 95-5 rule): ~95% of potential buyers are not in market at
  any time. Creative should therefore link the brand to buying situations ("category entry points"),
  for example opening a shop, a new collection, Christmas stock or a rebrand. [Research, B2B Institute
  with Ehrenberg-Bass, canonical, older]:
  https://business.linkedin.com/marketing-solutions/b2b-institute/b2b-research/trends/95-5-rule
- **Motion visual formats relevant to packaging:** unboxing has the highest hit rate (9.8%), and demo
  (8.1%) and testimonial are strong. Offer-first banners lead on spend, but that is inflated by BFCM.
- **Packaging, print and supplies cases are a gap.** No published Meta case study was found for Packhelp,
  noissue, Vistaprint, Moo or Printful. The useful next step is a manual Meta Ad Library review of those
  brands' long-running ads, since an ad that has run for 60+ days is a revealed-preference signal.

**For Westpack:**

- **The audience is a business owner scrolling as a consumer.** Creative has to do the targeting, because
  the conversion ad sets are completely broad. What follows from that:
  - Call out the buyer in the first frame or line ("Running a jewellery shop?", "Your logo on 48
    boxes").
  - Show the product in a shop or a customer's hands.
  - Make the price and MOQ concrete with site-stated facts: from 48 pieces with logo, a free cliché on
    the first order (not on plastic bags), "2,000+ five-star reviews", a digital proof before production.
  - State production time only as production time, never as delivery time.
- **Customer-logo photos are cleared for use, and are proof and UGC at once.** Avoid large corporate
  brands in them.
- **Employees on camera are welcome.** Founder or production clips ("live from production", "how it feels
  to pack") are the closest B2B analogue to founder-led video.
- **Partnership ads with local creators** (French and others) are supported by Meta's EMEA lift
  evidence and by the user's own experience. Run them **inside** the existing market ad sets, not as a
  new campaign, which fits both Meta's recommendation and the no-new-ad-sets preference.
- **Edge without talking down.** "Interrupt" hooks such as Contrarian, Myth-busting or Confession test
  well for top-of-funnel in Motion's data, but the rule against disparaging customers rules out the
  "you're doing packaging wrong" variety. Aim the contrarian angle at the category, never at the buyer.

## 6. Localisation across many European markets

### Evidence

- **Language preference (canonical, B2C, older).** CSA Research "Can't Read, Won't Buy" (2020, 8,709
  consumers, 29 countries): ~76% prefer buying with information in their own language, and 40% never
  buy from sites in other languages. A **B2B edition** (946 business buyers, 24 locales, 2020) exists,
  but its figures sit behind a paywall. [Research]
  https://csa-research.com/l/media/Consumers-Prefer-their-Own-Language
- **Meta's Multi-Language Ads** [Meta-doc]:
  https://developers.facebook.com/docs/marketing-api/multi-language-ads/
  - One ad holds per-language text, image or video and **link URL**.
  - Delivery follows the viewer's locale, with a default version for everyone else, so "broad targeting
    is retained".
  - It works with conversion objectives, for single image or single video.
  - An optional `autotranslate` replaces manual edits for the languages it is set on.
- **Advantage+ "Translate text"** machine-translates copy for speakers of other languages. Languages and
  wording cannot be customised.
- **No independent study** was found comparing translated with native-made ads on Meta.
- **The closest evidence for native-made content** is Meta's creator paper (partnership ads in EMEA, §5)
  and the user's own observation that French partners speaking French reach a French audience in a way
  translated copy does not.

**For Westpack:**

- **Conv - 04 - EU runs English across ~25 markets.** Multi-language ads could serve NL, ES, PL and
  others in their own languages inside the same ad set, adding no ad sets.
- **It only pays off where Westpack has a matching-language store or landing page.** A localised ad that
  lands on an English page probably loses the gain. **Check which store languages exist** before
  building any.
- **Never use `autotranslate` or Translate text.** The 7 Oct DE/FR/IT copy defects (clamped sentences,
  a translated placeholder, the du/Sie mix) show what unreviewed translation does. Every language
  version needs human review and a Danish back-translation for the user.
- **For DE/FR/IT, native-made beats translated.** That means native creators or partnership ads, plus
  native-speaker copy review. Translated copy is the floor, not the goal.
- **Case for staying English in the EU campaign:** B2B buyers in NL and the Nordics read English well,
  English is cheaper to produce and keeps one learning pool, and the EU campaign is already the
  cheapest source of new customers. **Against:** CSA's preference data, and ~25–31% of EU spend landing
  in countries with ≤1 new customer, which may partly be a language problem. A Multi-Language test on
  2–3 large non-English EU markets, judged at campaign level over 6–8 weeks, would settle it.

## 7. Hooks, copy length, headlines and CTAs (2025–2026)

### Evidence

- **Hook tactics** (Motion, Sep 2025 to Jan 2026, spend-defined winners) [Dataset]:
  https://motionapp.com/library/research/creative-benchmarks-2026/top-hook-tactics/
  - Highest hit rates (6–11% against a 4–8% baseline): **Newness, sale announcement, price anchor,
    urgency, announcement, offer only, FOMO, new product announcement, confession**.
  - "Interrupt" hooks (contrarian, myth-busting, warning) win less often but with higher variance.
  - Motion itself warns this is **not ROAS-weighted** and is BFCM-inflated.
- **Hook rate** (3-second views ÷ impressions):
  - Billo, 88,329 sales-objective videos, H1 2026: average 25.4%. Billo is a UGC producer. [Vendor]
  - AdSights: cold feed median ~22–23%, Reels ~30%.
  - Motion's rule of thumb: under 25% weak, 25–35% solid, over 35% strong.

  https://motionapp.com/blog/key-creative-performance-metrics
- **First seconds:** a face, motion or a direct statement of the viewer's situation. No logo card first
  (Tiger Pistol). CreativeX, quoted in Meta's creator paper: over half of branded creator content does not
  show the brand in the first 3 seconds.
- **Copy length, headlines and CTAs are a gap.** No large-sample 2025–2026 study was retrieved before the
  search budget ran out. The median top account reportedly runs 28 primary texts and 24 headlines over
  30 days (Segwise/Howland, above), which is evidence of variety, not of a best length.

**For Westpack:**

- **Use the promotional hook cluster with site-true offers only:**
  - Newness: new colours, a new series, the Valentine 2027 range.
  - Price anchor: "from £0.99 per bag".
  - Concrete offer: free cliché on the first order.
  - Never invented urgency or "free samples".
- **Westpack's evergreen B2B buying cycle needs more than offer hooks.** Expect offer-first ads to win on
  Meta's spend allocation, and protect at least one slot for a category-entry-point or proof concept.
  Spend-based rankings under-value it.
- **Track hook rate per video ad** against the account's own median, not the 25% benchmark. The
  audience is B2B in broad delivery, so hook rates may sit lower without the ad being bad.

---

## Confidence summary

| Finding | Confidence | Basis |
|---|---|---|
| Andromeda retrieves a shortlist; Meta says creative diversification has replaced niche targeting | High | Meta engineering and business posts, 2024–2025 |
| "Entity ID" and similarity thresholds | Low (mechanism plausible, numbers unsourced) | Practitioners only |
| Spend concentrates on ~5% of creatives (55% of spend) | Medium-high, as a description | Motion dataset; winners defined by spend |
| Creative tests cannot reach significance on new customers at Westpack's volume | High | Standard power arithmetic on account volumes |
| ~45% lower conversion likelihood by the 4th exposure; adding new ads to fatigued ad sets gives ~8% higher conversion rate | Medium-high | Analytics at Meta 2023, read via secondary sources |
| Advantage+ generative and text features can create false claims | High | Meta docs on the features plus documented incidents |
| Partnership ads (≥30%) cut cost per incremental purchase 45% in EMEA | Medium | Meta's own lift meta-analysis, 92% confidence, B2C |
| Static product-with-text and unboxing over-index; carousel under-indexes | Low–medium | Motion, BFCM window, B2C |
| Localised beats English for EU B2B buyers | Low–medium | CSA 2020 B2C; no Meta ad study |
