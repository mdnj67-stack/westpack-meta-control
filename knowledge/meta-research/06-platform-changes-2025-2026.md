# Meta ads platform changes, January 2025 to October 2026, and what is announced for late 2026–2027

**Research date:** 2026-10-13. **Scope:** product, delivery system, Marketing API, EU policy and pricing changes that affect a B2B e-commerce advertiser running in about 30 European markets. **Method:** web research only. No call was made to the Meta API or the ad account.

## Summary

Between January 2025 and October 2026 Meta made its automated campaign structure the default and then the only structure for sales, app and leads campaigns. Legacy Advantage+ Shopping and App campaigns can no longer be created over the API, and the remaining ones are scheduled to be paused in v26. Meta also replaced most of its delivery stack: Andromeda for retrieval, GEM as the "teacher" ranking model, Lattice consolidation, an LLM-scale "Adaptive Ranking Model" and, from mid-2026, a "Generative Recommender". It changed what attribution means three times. Incremental attribution launched in 2025. The 7-day and 28-day view windows were removed from the Insights API on 12 January 2026. On about 3 March 2026 "click-through" was narrowed to link clicks only, and non-link engagement moved into a new 1-day "engage-through" bucket.

In Europe, Meta rolled out a "less personalised ads" choice in the EU from January 2026, fully rolled out by Q2. Meta itself calls this a revenue headwind for Q3 2026. On 1 July 2026 Meta started charging location fees of 2–5% in the UK, France, Italy, Spain, Austria and Türkiye. Prices rose faster than volume through 2025 and into 2026: average price per ad was up 9% in 2025 worldwide and up 12% year over year in both Q1 and Q2 2026. In Europe the price per ad was up 19% year over year in Q4 2025.

For an API-driven dashboard, the breaking items are these:

- the removed view windows
- the new 13-month and 6-month history limits on unique, hourly and frequency breakdowns, plus the June 2025 rule that drops reach for breakdown queries starting more than 13 months back
- removal of `daily_outcomes_curve` and other delivery-estimate fields, on all versions from 27 October 2026
- the v24 sunset on 6 October 2026
- placement removals (Facebook video feeds, Instagram Explore) and the `instagram_actor_id` deprecation in the ad-creation path

Evidence labels used below:
- **[Official]**: from a Meta newsroom, developer, investor or help page.
- **[Meta claim]**: a performance figure Meta published without a method. Treat it as marketing.
- **[Trade]**: trade press or practitioner.
- **[Vendor]**: a tool or agency with a commercial interest.
- **[Unconfirmed]**: only secondary sources, or sources that conflict.

---

## 1. Changelog (chronological)

### 2025

**2025-01-21 — Marketing API v22.0 released** [Official] (expired 2026-02-19)
- Advantage+ creative `STANDARD_ENHANCEMENTS` bundle no longer supported. Individual enhancement features replace it.
- Detailed-targeting exclusions: custom audiences in `exclusions` deprecated in favour of `excluded_custom_audiences` (all versions from 2025-04-21). Duplicated ad sets drop detailed-targeting exclusions. Only employer exclusions remain as an account-level control.
- "Reach people interested in selected cities and regions" location expansion added.
- `instagram_actor_id` deprecated in favour of `instagram_user_id`, **for all versions from 2025-09-09**.
- Source: https://developers.facebook.com/docs/graph-api/changelog/version22.0

**2025-01-31 — Detailed targeting exclusions stop on remaining campaigns** [Trade]
- New campaigns had lost exclusions in 2024. Existing campaigns using them ran until 31 January 2025.
- Meta's justification: a 22.6% lower median cost per conversion without exclusions [Meta claim].
- https://www.socialmediatoday.com/news/meta-removes-detailed-targeting-exclusions-from-ad-campaigns/723389/

**2025 (Jan–Feb) — Health and wellness and financial "sensitive category" optimisation limits begin**, followed by proactive scanning that disables flagged custom audiences and custom conversions (July–September 2025). [Vendor/Trade]
- Not expected to affect Westpack's packaging vertical, but any custom conversion or audience Meta flags stops receiving data.
- From 2026-01-06, campaigns using flagged audiences or conversions cannot be created or updated (v24 changelog) [Official].
- https://docs.liveramp.com/connect/en/announcement--upcoming-meta-restrictions-on-certain-custom-audiences-and-custom-conversions--7-17-25-.html

**2025-02 — Advantage+ Shopping renamed Advantage+ Sales; Advantage+ extended to leads; Opportunity Score (0–100) introduced** [Trade]
- Meta claims about 10% lower cost per qualified lead in early leads tests [Meta claim].
- https://www.socialmediatoday.com/news/meta-advantage-plus-ad-updates-february-2025/
- https://www.jonloomer.com/advantage-plus-sales-app-leads-campaigns/

**2025 (spring–summer) — Incremental attribution setting in Ads Manager** [Trade/Official via earnings]
- An attribution setting, not a window: a model trained on Meta's Conversion Lift data estimates which conversions the ad caused.
- Initially limited to sales campaigns with a website conversion location and the Maximise conversions or Maximise value goals.
- Launch dates conflict: the vendor WorkMagic says April 2025, others "last August". On the Q4 2025 call Meta said it reached a "multi-billion dollar annual run-rate seven months after launch", which points to about mid-2025.
- Claims: "24% more incremental conversions than standard attribution" (Q4 2025 call) and a "46% lift" in Meta tests (vendor-reported) [Meta claim; no method published].
- https://www.workmagic.io/blog/incremental-attribution-meta
- https://ppc.land/metas-ad-business-hits-record-58b-as-ai-drives-conversion-gains/
- In the API, `incrementality` is a value accepted in `action_attribution_windows`, and each action entry carries an `incrementality` key: https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/breakdowns
- Independent test: Seer Interactive ran it on about $1.05M of April 2025 spend: https://www.seerinteractive.com/insights/we-tested-metas-new-incremental-attribution-setting-on-1m-in-ad-spend.-heres-how-it-works

**2025-04 — DMA non-compliance decision: EUR 200M fine** over pay-or-consent. This led to the December 2025 commitment below. [Official/Trade]

**2025-04-23 — Threads ads opened to all eligible advertisers globally**, delivered in "select markets" first [Trade].
- The Threads feed placement is **on by default** in Advantage+ and manual placements.
- The UK and EU were added later; per the Q4 2025 call (2026-01-28), Threads ads are "expanding to all remaining countries, including the UK, EU and Brazil".
- Meta says Threads will not be a meaningful revenue driver in 2026.
- https://www.socialmediatoday.com/news/threads-ads-expanded-to-all-meta-advertisers/746072/

**2025-05-29 — Marketing API v23.0 released** [Official] (expired 2026-06-09)
- `advantage_state_info.advantage_state` (read-only) shows whether a campaign counts as fully "Advantage+".
- **Advantage+ audience is on by default for new ad sets** using the default or relaxed setup.
- Age and gender can be suggestions (`targeting_automation`).
- `smart_promotion_type` can no longer create campaigns from v25.
- https://developers.facebook.com/docs/graph-api/changelog/version23.0

**2025-06 — WSJ reports Meta aims to let brands fully automate ad creation and targeting by end-2026** (product image plus budget in, campaign out) [Trade, reporting on anonymous sources].
- https://www.mediapost.com/publications/article/406315/

**2025-06-10 — Reach with breakdowns limited to 13 months of history** [Official docs + connector notices]
- Reach, frequency and CPP are omitted, not errored, for standard queries that combine breakdowns with a start date more than 13 months back.
- Async jobs can still fetch them, capped at 10 per ad account per day (header `x-Fb-Ads-Insights-Reach-Throttle`).
- https://developers.facebook.com/docs/marketing-api/insights/best-practices
- https://windsor.ai/documentation/facebook-ads-meta-api-updates-june-10-2025/

**2025-06-16/17 — WhatsApp ads announced (Status ads and promoted channels in the Updates tab)** [Official/Trade]
- Global rollout followed in February 2026, and Meta expects it to finish during 2026.
- EU timing ran later (mid-2026 per onlinemarketing.de [Unconfirmed]).
- v26 adds offsite-conversion and LPV optimisation for WhatsApp Status, plus 10-card carousels.
- https://www.tomsguide.com/computing/mobile-apps/ads-are-coming-to-whatsapp-heres-where-youll-see-them-and-where-you-wont
- https://storyboard18.com/brand-makers/whatsapp-introduces-global-status-ads-promoted-channels-and-new-controls-for-users-in-updates-tab-91018.htm

**2025-06-17 — Cannes Lions 2025: generative AI for ads** [Trade]
- "Video Generation 2.0" (multi-scene video from images) entered testing.
- Also: video highlights, an expanded virtual try-on test, Creative Sticker CTAs, and AI text and image branding tools. Business AI agents were tested in Reels and Stories ads.
- Claims: Advantage+ sales "+22% ROAS", GEM "up to +5% conversions" [Meta claim].
- https://ppc.land/meta-announces-generative-ai-advances-for-advertisers-at-cannes-lions/

**2025-06-23 — Detailed-targeting consolidation begins** [Trade + Official v24]
- Similar interests were merged (Ads Manager from 2025-06-23, Business Suite and boosted posts from 2025-08-21).
- Ad sets using removed options **stopped delivering from 2026-01-15** unless edited.
- https://www.mediapost.com/publications/article/408262/meta-further-consolidates-ad-targeting-options.

**2025-07 (announced 2025-07-25) — Meta stops political, electoral and social-issue ads in the EU from early October 2025** (TTPA in force 2025-10-10). Not relevant to Westpack, but it explains "social issue" disapprovals on borderline copy. [Trade]
- https://techcrunch.com/2025/07/25/meta-to-stop-selling-political-ads-in-the-eu-from-october

**2025 (H2) — Andromeda retrieval rollout completes; GEM scaled** [Official/Trade]
- Andromeda was announced 2024-12-02: "+6% recall, +8% ads quality on selected segments" [Meta claim]. https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/
- Trade sources date the broad rollout to about July–October 2025 [Unconfirmed].
- GEM paper and blog, 2025-11-10: GEM is a large foundation model that transfers its knowledge into serving models. "+5% conversions on Instagram, +3% on Facebook Feed" [Meta claim]. https://engineering.fb.com/2025/11/10/ml-applications/metas-generative-ads-model-gem-the-central-brain-accelerating-ads-recommendation-ai-innovation/
- Q3 2025 call: retrieval plus early-stage ranking lifted Facebook ads quality by 14% [Meta claim].
- Independent reaction: a vendor study by Confect (3,014 e-commerce advertisers, 2025) found Meta-**reported** ROAS down an average of 7%, worst for previously strong accounts. https://confect.io/tactics/meta-andromeda-2026
- Counter-view (Segwise, 12 accounts): much of the drop is more conservative attribution, with GA4 and business revenue near flat. https://segwise.ai/blog/meta-andromeda-roas-drop
- Neither study is independent or controlled.
- Practitioner consensus: creative diversification is now the main targeting lever, meaning concepts that genuinely differ rather than variants of one idea. https://www.jonloomer.com/meta-andromeda/

**2025-10-07 — Notice: Meta AI chat content used for ad personalisation from 2025-12-16** [Trade]. The EU, UK and South Korea are excluded at first.
- https://ppc.land/meta-plans-to-use-ai-chat-data-for-ad-targeting-starting-december/

**2025-10-08 — Marketing API v24.0 released** [Official] (**expired 2026-10-06**)
- **`is_adset_budget_sharing_enabled` must be sent (true or false) when creating a campaign with ad-set budgets.** Omitting it returns error 4834011. Meta recommends `true`.
- Budget sharing moves up to 20% of an ad set's budget to other ad sets in the campaign. It needs a daily budget and the same bid strategy on every ad set. It applies to new and duplicated campaigns only, cannot be switched on mid-flight (it can be switched off), and the bid strategy cannot change while it is on. https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/adset-budget-sharing
- **Daily budget flexibility raised from 25% to 75%.** An ad set can spend up to 1.75× its daily budget on a given day, but no more than 7× the daily budget across the week (Sunday to Saturday). https://www.jonloomer.com/updates-to-meta-ads-budgeting/
- Creating, duplicating or updating Advantage+ Shopping and App campaigns is blocked on v24+.
- `placement_soft_opt_out`: up to 5% of spend may go to excluded placements (Sales and Leads objectives).
- **Facebook video feeds placement deprecated.** Delivery stops, and creating or updating with it returns an error.
- Meta may choose the landing page on your site ("website destination optimisation").
- Messenger lead ads can no longer be created via the API.
- Changes for all versions from 2026-01-06: flagged custom audiences, lookalikes and conversions fail on update, and merged interests are unsupported.
- https://developers.facebook.com/docs/graph-api/changelog/version24.0

**2025-10-08 — Migration guide for ASC/AAC to the Advantage+ structure** [Official]
- https://developers.facebook.com/blog/post/2025/10/08/upcoming-asc-and-aac-mapi-deprecation-migration-options-to-advantage-plus/

**2025-10-09 — Messenger Inbox placement (`messenger_home`) removed** (all versions from 2025-11-11) [Trade].

**2025-10-16 — Ads Insights API metric availability changes, effective 2026-01-12** [Official]
- `action_attribution_windows` **no longer returns `7d_view` or `28d_view`**.
- Still available: 1d_click, 7d_click, 28d_click, 1d_ev (engaged view) and 1d_view.
- Unique-count fields (`unique_actions`, `cost_per_unique_action_type`, …) with any breakdown: **13 months of history**.
- Hourly breakdowns (`hourly_stats_aggregated_by_advertiser_time_zone` / `_audience_time_zone`): **13 months**.
- `frequency_value` breakdown: **6 months**.
- `mmm` breakdown: async only.
- Totals are still available for 37 months.
- Several connector vendors report that the removed windows return empty data rather than an error [Vendor].
- https://developers.facebook.com/blog/post/2025/10/16/ads-insights-api-metric-availability-updates/

**2025-Q4 (Advertising Week, October 2025) — "Business AI"** sales assistant for SMBs announced [Trade].

**2025-12-08 — EU: Meta commits to a "less personalised ads" (LPA) choice under the DMA**, to be shown to EU users from January 2026. The Commission continues to monitor; Meta is appealing the April 2025 decision in court. [Official, European Commission]
- https://digital-markets-act.ec.europa.eu/meta-commits-give-eu-users-choice-personalised-ads-under-digital-markets-act-2025-12-08_en

### 2026

**2026-01-12 — The Insights API changes above take effect** (view windows removed, history limits). [Official]

**2026-01-15 — Ad sets using consolidated or removed detailed-targeting interests stop delivering** unless edited. [Official v24 / Trade]

**2026-01-28 — Q4 2025 earnings call** [Official via Trade]
- GEM: the training cluster was doubled and a new sequence-learning architecture adopted, giving "+3.5% Facebook ad clicks, >1% Instagram conversions" [Meta claim].
- A "runtime model" on Instagram Feed, Stories and Reels: "+3% conversion rate" [Meta claim].
- Lattice consolidation: "+12% ads quality" [Meta claim].
- Andromeda now runs on Nvidia, AMD and MTIA, with "about 3× compute efficiency".
- Europe Q4 2025: ad revenue $14.2B (+18%), impressions +13%, **price per ad +19%**.
- Meta warned that LPA could be a 2026 headwind.
- 2026 plan: "consolidate more models in 2026 than in the previous two years combined" and merge LLMs with recommendation systems.
- https://ppc.land/metas-ad-business-hits-record-58b-as-ai-drives-conversion-gains/

**2026-01 to Q2 — LPA rollout in the EU**: phased in Q1 2026, "fully rolled out" by Q2 2026. Meta says the revenue impact was larger in Q2 than Q1 and named it a Q3 headwind. [Official via Trade]
- The mechanism matters for advertisers. Users who choose LPA receive ads targeted on less data, so expect weaker optimisation signal and some CPM and conversion-rate pressure on EU inventory. Meta has published no magnitude.
- https://ppc.land/meta-q1-2026-56-3b-revenue-as-ai-tools-double-advertiser-adoption/
- https://www.mbi-deepdives.com/meta2q26/

**2026-02-13/18 — Marketing API v25.0 released (2026-02-18)** [Official] — the version the Westpack dashboard uses
- Creating, duplicating and updating ASC/AAC is blocked on v25+, and **on all versions from 2026-05-19**.
- In **v26 (estimated September 2026) all remaining ASC/AAC campaigns are to be paused**. Campaigns using the Existing Customer Budget Cap stayed editable until then and can only be migrated by duplicating them in Ads Manager.
- Async insights jobs gain default error fields (`error_code` and others); `error_code` changes type from uint to int.
- Page, post, video and story reach and 3-second-view metrics are deprecated across versions, along with the `metadata=1` parameter. These are organic Page metrics, not ad insights.
- https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25
- https://developers.facebook.com/blog/post/2026/02/13/asc-and-aac-deprecation-mapi-v25/

**2026-02 — Unified campaign flow**: the manual and Advantage+ setups merged into one experience for Sales, App and Leads. Advantage+ is on by default; changing certain settings turns the campaign "off" Advantage+. [Trade/Official docs]
- https://developers.facebook.com/docs/marketing-api/advantage-campaigns

**2026-02/03 — Meta announces location fees** (reported March 2026). See the 2026-07-01 entry.

**2026-03-03 (rollout mid to late March) — Click attribution redefined** [Official]
- **Click-through now counts link clicks only.** Conversions after likes, comments, shares, saves or profile visits move to **"engage-through"**, which replaces "engaged-view" and also still covers video views of 5 seconds or more. Engage-through has a fixed 1-day window.
- Default for website conversions: **7-day click + 1-day engage-through + 1-day view**.
- There is no legacy view, so historical series break at the change.
- Billing and delivery are unaffected, according to Meta.
- https://www.facebook.com/business/news/click-attribution
- https://www.leafsignal.com/blog/meta-march-2026-attribution-update
- https://dataslayer.ai/blog/meta-attribution-change-2026-what-engage-through-attribution-is-and-why-your-numbers-look-different

**2026-04 to 05 — Practitioner field notes** [Trade]
- One-click Conversions API setup.
- Up to 10 images or videos in one ad (flexible format).
- **Value rules for audiences**: bid more or less for custom audience groups.
- AI translations, live video ads, and a return of video generation.
- Expanded purchase-audience retention.
- Jon Loomer's commentary: "Detailed targeting is now mostly a suggestion".
- Index: https://www.jonloomer.com/category/meta-advertising/

**2026-04-29 — Q1 2026 results** [Official]
- Impressions **+19%**, price per ad **+12%** worldwide.
- Europe ad revenue $13.5B, impressions +17%.
- "Adaptive Ranking Model" (an LLM-scale recommender used at inference, routing to heavier models when conversion probability is high), rolled out for offsite-conversion ads in H2 2025: "+1.6% conversion rate" [Meta claim].
- Lattice plus GEM: ">6% conversion rate for landing-page-view ads" [Meta claim].
- More than 8M advertisers use at least one generative AI creative tool. Video generation users show "+3% conversion rate" [Meta claim].
- https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-First-Quarter-2026-Results/
- https://ppc.land/meta-q1-2026-56-3b-revenue-as-ai-tools-double-advertiser-adoption/

**2026-05-04 — "Marketing API Access Tier" replaces "Ads Management Standard Access"** [Official]
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog

**2026-05-19 — ASC/AAC create, update and duplicate blocked on every API version** [Official].

**2026-06 (Cannes Lions 2026) — Agentic and creative push** [Trade]
- An end-to-end creative workspace in Ads Manager ("Ads Creative Studio", in limited test).
- "Brand memory" (in development).
- Better text generation and translation, and a creative approval workflow (in test).
- Creator Marketing Hub, which merges Creator Marketplace and Partnership Ads Hub.
- Meta Business Agent Platform, launched in July.
- Claim: "$4.13 revenue per $1" [Meta claim, Meta-commissioned analysis].
- https://www.emarketer.com/content/meta-s-ai-push-cannes-lions-highlights-social-s-automation-race
- https://www.shopifreaks.com/meta-unveils-new-ai-creative-and-creator-tools-at-cannes-lions-2026-heres-a-recap-of-whats-new/

**2026-06 (end) — Organic "Viewers" metric replaces legacy Page reach in the Graph API** [Official, announced with v25]. This is organic only.

**2026-07-01 — Location fees in force** [Official help page; rates from trade coverage that cites it]
- **UK 2%, France 3%, Italy 3%, Spain 3%, Austria 5%, Türkiye 5%.**
- The fee is set by **where the ad was delivered**, not where the advertiser is.
- It is **charged on top of spend as a separate invoice line**, not taken from the budget. It **does not appear in Ads Manager metrics, exports or API spend**, only in Billing.
- VAT is charged on spend plus fee.
- Meta says the countries and rates may change.
- Help page: https://www.facebook.com/business/help/1238737454289085
- Guide: https://digitalapplied.com/blog/meta-europe-location-fees-july-2026-advertiser-guide

**2026-07-29 — Marketing API v26.0 released** [Official]
- **Delivery estimate**: `daily_outcomes_curve`, `budget_guardrail` and `estimate_dau` removed (v26 now; **all versions 2026-10-27**). No replacement.
- **Instagram Explore placement removed** on v26+. Specifying it returns an error, and spend shifts elsewhere.
- Messenger Stories (`messenger_positions: story`) silently dropped (all versions 2026-10-27).
- Poll ads blocked, and `web_only` applink treatment blocked in Web+App campaigns (all versions 2026-10-27).
- Shop ads: eligible creatives default to `WEBSITE_AND_SHOP` when the advertiser has a shop (opt out with `WEBSITE_AND_SHOP_OPT_OUT`).
- Special-category ad sets must set `advantage_audience` explicitly.
- WhatsApp Status ads expanded.
- Commerce order-management endpoints blocked, and removed on all versions 2026-10-27.
- Legacy protocol parameters (`pretty`, `debug`, `date_format`, root `?ids=`) removed, on all versions 2026-10-27.
- The ASC/AAC pause is not listed on the v26 page, so whether it has been applied is **[Unconfirmed]**.
- https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/
- https://developers.facebook.com/docs/graph-api/changelog/version26.0

**2026-07-29 — Q2 2026 results** [Official]
- Impressions **+14%**, price per ad **+12%**, ad revenue $59.36B (+27%).
- Q3 revenue guidance is $61–64B, with LPA in Europe named as a headwind.
- The growth slowdown came mostly from Europe and APAC, driven by price (MBI analysis).
- "Meta Generative Recommender": an LLM reasons about ad content and user preferences together, and the first generative model is now deployed in ads retrieval. Combined with GEM and sequence learning: "+8.3% clicks, +15.7% conversions on Facebook" [Meta claim, via MBI's call notes].
- Business Agent messages are charged per token from 2026-08-01.
- https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/
- https://www.mbi-deepdives.com/meta2q26/

**2026-09-24 — Graph API v20 removed.** **2026-10-06 — Marketing API v24 expired.** [Official]

**2026-10-06 — Advertising Week New York 2026** [Official post via Trade]
- **Customer Lifecycle Strategy is open to all advertisers.** When a campaign is set to acquisition, Meta recommends excluding existing customers. It depends on the Existing Customers segment defined in Advertising Settings.
- Excluding existing customers with a single "Audience Label" is in test.
- Advantage+ creative video from still images is generally available.
- Ads Creative Studio rolling out more broadly.
- AI audience discovery in Detailed Targeting "by end of 2026".
- **Agentic actions in the Meta AI business assistant** (campaign set-up, targeting and budget changes) are beginning tests. Scheduled reports and alerts are in test.
- The ads MCP server lets agent-built work land as drafts in Ads Manager.
- Claim: "+5% conversions at the same CPA for advertisers following assistant recommendations" [Meta claim, no method].
- https://www.relevantaudience.com/meta/meta-advertising-week-new-york-2026-ad-tools/
- https://www.facebook.com/business/news/advertising-week-new-york-2026

**2026-10-27 (upcoming) — v26 removals apply to all versions** (delivery-estimate fields, Messenger Stories, polls, web_only, legacy params, commerce endpoints). **2026-10-28 (expected) — Q3 2026 results.**

---

## 2. Delivery and ranking system: what Meta says and how much to believe

| System | Role | Meta's stated effect | Status of evidence |
|---|---|---|---|
| Andromeda (Dec 2024; broad rollout 2025) | Retrieval: tens of millions of candidates down to thousands | +6% recall, +8% ads quality (selected segments); +14% FB ads quality with early-stage ranking (Q3 2025) | Meta claim |
| Lattice (2023 onward, consolidation in 2025–26) | One shared ranking model replacing many per-objective models | +12% ads quality (Q4 2025); with GEM, >6% LPV conversion rate (Q1 2026) | Meta claim |
| GEM (paper Nov 2025) | Foundation "teacher" model distilled into serving models | +5% IG / +3% FB Feed conversions; +3.5% FB clicks after 2× training (Q4 2025) | Meta claim; an architecture paper exists, no causal advertiser method |
| Adaptive Ranking Model (H2 2025) | LLM-scale inference-time ranking for offsite conversions | +1.6% conversion rate | Meta claim |
| Generative Recommender (2026) | LLM reasoning over ad content and user; generative retrieval | +8.3% clicks, +15.7% conversions on FB (with GEM and sequence learning) | Meta claim, second-hand |

**Practical reading.** Retrieval now picks ads by creative content. Practitioners agree on what works:
- many genuinely different creatives
- fewer, broader ad sets
- audience inputs treated as suggestions

Meta-reported ROAS fell for many e-commerce accounts during 2025. That is a vendor finding; whether it was a real or a measurement effect is disputed. None of Meta's numbers come with an advertiser-level method, so treat them as direction, not size.

## 3. Marketing API v22 to v26: things that touch reporting and ad creation

| Change | Version / date | Relevance |
|---|---|---|
| `7d_view`, `28d_view` removed from `action_attribution_windows` | all versions 2026-01-12 | Any request for them returns nothing |
| Unique fields with breakdowns, and hourly breakdowns: 13 months; `frequency_value`: 6 months; `mmm` async only | 2026-01-12 | History limit |
| Reach/frequency/CPP omitted for breakdown queries starting more than 13 months back (async exception, 10/day) | 2025-06-10 | Long-range country reach |
| Click-through means link clicks only; engaged-view becomes engage-through (1-day) | about 2026-03 | Break in the `value` (reported) series |
| `is_adset_budget_sharing_enabled` required for ad-set-budget campaigns | v24+ | Campaign creation |
| Daily budget flexibility 75% (weekly cap 7× daily) | about Oct 2025 | Pacing reads |
| ASC/AAC create, update and duplicate blocked; pause in v26 | v24/v25; all versions 2026-05-19 | Campaign structure |
| Facebook `video_feeds` placement deprecated (error on create/update) | v24+ | Ad creation |
| Instagram Explore placement removed (error if specified) | v26+ | Ad creation after upgrade |
| `instagram_actor_id` replaced by `instagram_user_id` | all versions 2025-09-09 | Ad creation |
| Delivery estimate `daily_outcomes_curve`, `budget_guardrail`, `estimate_dau` removed | all versions 2026-10-27 | Saturation work |
| Async report error fields; `error_code` uint to int | v25+ | Error handling |
| Advantage+ audience on by default for new ad sets | v23+ | Creation defaults |
| Version sunsets: v22 2026-02-19, v23 2026-06-09, v24 2026-10-06, v25 TBD | — | Upgrade planning |

`frequency_control_specs` itself had no announced breaking change in v22–v26. I found no evidence of one.

## 4. EU policy, regulation and pricing

- **Less personalised ads (DMA)**: offered to EU users from January 2026 and fully rolled out by Q2 2026. Meta names it as a Q3 2026 revenue headwind. No advertiser-facing figure for the size of the LPA audience has been published. [Official]
- **Location fees**: from 2026-07-01, UK 2%, FR, IT and ES 3%, AT and TR 5%. Charged on delivered impressions, on top of spend, and invisible in reporting. [Official help page]
- **DST pipeline** (may become new fees):
  - Poland published a draft 3% DST on 2026-07-31, with 60-day consultation. [Official via EY] https://globaltaxnews.ey.com/news/2026-1678
  - Germany has discussed a 10% platform levy since May 2025, with no enacted law found. [Unconfirmed]
- **TTPA**: no political or social-issue ads in the EU from October 2025.
- **Payer/beneficiary disclosure (DSA)**: still required for ads delivered in the EU (in place since 2023). No 2025–26 change found.
- **Detailed targeting**: exclusions gone (January 2025), interests consolidated (June 2025 to January 2026), Advantage+ audience on by default, and AI audience discovery coming by end-2026.
- **Sensitive categories**: health and finance flagging of audiences and conversions (2025). It does not affect packaging but can mis-flag custom conversions.

## 5. Market trends (Meta-reported, worldwide unless stated)

| Quarter | Ad impressions YoY | Avg price per ad YoY | Notes |
|---|---|---|---|
| Q1 2025 | +5% | +10% | secondary source (Mobile Dev Memo) |
| Q2 2025 | +11% | +9% | Europe price +17% (eMarketer) |
| Q3 2025 | +14% | +10% | Europe impressions +9% |
| Q4 2025 | +18% | +6% | **Europe: impressions +13%, price +19%**, ad revenue $14.2B (+18%) |
| FY 2025 | +12% | +9% | |
| Q1 2026 | +19% | +12% | Europe ad revenue $13.5B, impressions +17% |
| Q2 2026 | +14% | +12% | Europe slowed, mainly on price (FX and LPA) |

Sources: Meta IR press releases and 10-Qs; SEC Q4 2025 exhibit https://www.sec.gov/Archives/edgar/data/1326801/000162828026003832/meta-12312025xexhibit991.htm; Q3 2025 10-Q https://www.sec.gov/Archives/edgar/data/1326801/000162828025047240/meta-20250930.htm.

"Price per ad" is revenue divided by impressions. It moves with mix (more cheap Reels and Threads inventory pulls it down), so it is not a CPM index. Even so, European advertisers faced high-teens price growth in late 2025.

**Q4 seasonality**: practitioner benchmarks put October–December CPMs 20–50% above the year's average, with Q1 the cheapest. This is vendor data and not measured for Westpack. Location fees add 2–5% on top in the affected markets from July 2026.

## 6. Announced or rumoured for late 2026 to 2027

**Announced by Meta:**
- v26 removals reach all API versions on **2026-10-27**.
- Graph v21 is removed 2027-01-21.
- v25's end date is TBD; going by the usual cadence, expect about Q1–Q2 2027.
- The next version (v27) is likely around early 2027. That is an inference from cadence, not an announcement.
- ASC/AAC pause "in v26".
- AI audience discovery in Detailed Targeting by end-2026.
- Agentic actions in the business assistant (set-up, budgets) are in test now.
- Brand memory.
- Creator Marketing Hub "later this year".
- Direct checkout in Meta AI and Business Agent, testing "this fall".
- Business Agent Platform capabilities "through 2026 and into 2027".
- More model consolidation in 2026, and LLMs merged with recommendation systems.
- WhatsApp Status ads rollout to finish in 2026.

**Reported, not confirmed:**
- End-to-end "image + budget in, campaign out" automation by end-2026 (WSJ, June 2025). As of October 2026 only parts of it exist, in test.
- Placement and ranking claims by vendors (for example, that Messenger Stories requests are silently dropped) are partly confirmed by the v26 changelog.

**Regulatory, possible:**
- Further DMA changes if the Commission finds LPA uptake insufficient.
- New location fees if Poland's or Germany's DST is enacted.

---

## For Westpack

### Changes that matter for this setup

1. **Incremental attribution is the right basis and is supported in the API.** The dashboard already sends `action_attribution_windows=["incrementality"]` and reads the `incrementality` key. Nothing in v22–v26 removes this. *Confidence: high.* Caveat: Meta calls its incremental figure a model trained on lift tests, not a measurement. Keep the dashboard's "not a measured uplift" wording.
2. **The March 2026 click redefinition breaks the `reported_value` series.** "ROAS as reported" and anything comparing standard-attribution campaigns (DE, FR and IT since 2026-09-29) across early March 2026 compares two different definitions. The incrementality series is not documented as affected. *Confidence: medium-high.*
3. **Location fees are not in API spend.** For UK, FR, IT, ES and AT delivery, true cost is 2–5% above dashboard spend. Cost per new customer and the 30-day budget pace are therefore understated there. Conv - 02 - FR and Conv - 03 - IT pay 3%, and EU and LAL ad sets pay on the delivered share. Reconcile against invoices, not against insights. *Confidence: high on the mechanism; check the current country list on the help page.*
4. **EU less personalised ads (fully rolled out by Q2 2026)** plus European price growth (+19% in Q4 2025) is a confounder for any 2025-to-2026 comparison of CPM, frequency or new-customer cost in EU markets. *Confidence: medium.*
5. **Daily budget flexibility of 75% (weekly cap 7×)** applies to the ad-set budgets in both the conversion and awareness campaigns. Together with ad set budget sharing (up to 20% moved, at most 175% of daily plus the shared amount), a single day's spend versus budget is not a pacing signal; use weekly figures. *Confidence: high.*
6. **Customer Lifecycle Strategy** (generally available 2026-10-06) and the Existing Customers segment directly serve the new-customer KPI. Check that the Existing Customers and Engaged audience segments in Advertising Settings are defined and current, and consider the acquisition setting for the Conv campaigns. *Confidence: high that the feature exists; its effect is unmeasured.*
7. **Andromeda, GEM and the Generative Recommender** reward creative diversity over audience slicing. That is consistent with the 5-ads-per-ad-set cap only if those five are genuinely different concepts. *Confidence: medium; practitioner consensus, not causal evidence.*

### What may break the dashboard's API use

- **`daily_outcomes_curve` is removed on all versions on 2026-10-27.** Audience saturation does not use it (the field was probed and returned a single zero point). Make sure nothing requests it; `delivery_estimate` itself remains. *High.*
- **History limits.**
  - Expansion reach with `breakdowns=country` uses a 12-month default plus the current month. On the last days of a month the anchor sits right at the 13-month line, and **`MAX_MONTHS = 24` would exceed it**. Beyond 13 months, Meta *omits* reach for breakdown queries, with no error. Either cap at 12 months or use async jobs.
  - Hourly breakdowns are limited to 13 months and `frequency_value` to 6 months.
  - *High.*
- **`7d_view` / `28d_view`**: if any table maps old windows (for example `src/ui.js` labels for `1d_view_7d_click_1d_ev`), expect the engaged-view naming to change to "engage-through". No 7d_view requests were found in the code. *Medium.*
- **API version**: the dashboard is on v25.0 (`server/lib/meta.js`, `api/meta/account-snapshot.js`). v24 expired on 2026-10-06. v25's end is not announced, so plan the v26 upgrade before about Q1–Q2 2027. *High.*
- **Ad creation path (`api/meta/publish-ad.js`, `server/lib/meta.js`)**, three issues worth testing with a `validate_only` call:
  - `asset_customization_rules` still list `facebook_positions: "video_feeds"`, deprecated in v24, where creating or updating with it returns an error. Whether that applies to asset customisation rules is unconfirmed.
  - They also list `instagram_positions: "explore"`, which **errors on v26+** (Explore Feed removed).
  - The image and carousel paths still set `object_story_spec.instagram_actor_id`, deprecated on all versions since 2025-09-09; the video path already uses `instagram_user_id`. If ads are currently being created successfully, Meta may still map the old field, but this should be migrated before the v26 upgrade.
  - *Medium.*
- **Async insights**: `error_code` is now an int, with new default error fields (v25). This only matters if async jobs are added. *Low.*

### Settings worth checking in the account

- **Placements**: Threads feed (on by default since April 2025) and WhatsApp Status are now in Advantage+ placements. Check the placement breakdown for new-customer cost by placement. Use `placement_soft_opt_out` deliberately.
- **Advantage+ audience** on by default for new ad sets (v23). LAL ad sets with `targeting_relaxation_types.lookalike = 1` already over-deliver past the audience.
- **The awareness campaign** keeps ad set budget sharing on. It cannot be re-enabled mid-flight once switched off, and the bid strategy cannot be changed while it is on.
- **Existing Customers segment** and the Customer Lifecycle Strategy acquisition setting.
- **Attribution setting per ad set**: DE, FR and IT now run standard 7-day click + 1-day engage-through + 1-day view. Results are still read on incrementality, so this mainly affects delivery optimisation.
- **Billing**: confirm the location-fee lines on invoices from July 2026 and add them to any cost per new customer the marketing team reports.
- **No legacy ASC campaigns** should remain, since they are scheduled to be paused in v26.
