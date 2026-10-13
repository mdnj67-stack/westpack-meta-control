# Meta delivery system, account structure, budgets and bidding (2025–2026) — for Westpack

Research date: **2026-10-13**. One of six parallel research passes.

**Summary.** Meta's delivery stack changed materially in 2024–2026: Andromeda (retrieval, Dec 2024), GEM (ranking foundation model, Nov 2025) and the Adaptive Ranking Model (Instagram, Q4 2025) are documented by Meta's own engineering blog, with modest, self-reported gains (+3–8%) and no advertiser guidance in them. Almost everything advertisers are told to *do* because of them ("Entity ID", similarity thresholds, "creative is the new targeting") is practitioner interpretation, partly echoed by Meta sales reps. Product-wise, three changes matter most for Westpack: (1) the 2025 unification of Advantage+ sales and manual campaigns, which **removed the existing-customer budget cap** for new Advantage+ campaigns (Marketing API docs); (2) **value rules** (June 2025, extended to audience labels in April 2026), which let an ad set bid up or down by country, placement or customer label inside one ad set — the most useful new lever for an account that wants no more ad sets; (3) a **"customer lifecycle strategy / new customer acquisition"** ad-set setting rolling out in 2026 (vendor-reported, not yet in Meta's developer docs). The learning-phase rule (~50 optimisation events per ad set per 7 days) is unchanged in practice and is structurally out of reach for Westpack's per-market conversion ad sets; that is a constraint to plan around, not a reason to consolidate. Evidence for nearly all of this is B2C e-commerce; nothing found is B2B-specific.

**Source caveats.** Meta Business Help Center pages render client-side and returned only titles; facts attributed to them below come from developer docs (fetched as markdown from `developers.facebook.com/documentation/ads-commerce/*.md`, which do render) or are marked *(secondary)*. The shared web-search budget ran out near the end of this pass, so one question — whether Meta's new-customer setting interacts with a custom `New_customer` conversion — could not be researched further and is marked unverified.

Labels: **[Meta-doc]** official Meta documentation; **[Meta-eng]** Meta engineering blog; **[Meta-claim]** Meta's performance claim without published method; **[practitioner]** named practitioner; **[vendor]** company selling a tool/service; **[secondary]** trade press / blog summary.

---

## 1. Andromeda, GEM, Lattice and the 2025–2026 ranking stack

### What Meta has actually published

| System | What it is (Meta's words) | Reported gains | Source |
|---|---|---|---|
| **Lattice** (2023) | One large model replacing many siloed ad-prediction models; shares learning across surfaces (Feed/Stories/Reels) and objectives; "generalize learnings across domains… which matters most when data is limited". | Qualitative + early Instagram results | [Meta AI blog, 2023-05-11](https://ai.meta.com/blog/ai-ads-performance-efficiency-meta-lattice/) [Meta-eng] — older but still the canonical source |
| **Andromeda** (retrieval) | First stage: narrows "tens of millions" of ad candidates to a few thousand for ranking. Replaces rule-based heuristics with deep neural nets and a hierarchical index built to handle growing creative volume. | +6% recall, +8% ads quality "on selected segments"; 10x inference efficiency | [Meta engineering, 2024-12-02](https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/) [Meta-eng] |
| **GEM** (Generative Ads Recommendation Model) | "Largest foundation model for RecSys in the industry"; teaches hundreds of vertical ranking models via distillation. Models long user-behaviour sequences (thousands of events); learns across surfaces (e.g. IG video engagement improves FB Feed predictions). Creative format/representation are inputs. | +5% ad conversions on Instagram, +3% on Facebook Feed (Q2 2025) | [Meta engineering, 2025-11-10](https://engineering.fb.com/2025/11/10/ml-applications/metas-generative-ads-model-gem-the-central-brain-accelerating-ads-recommendation-ai-innovation/) [Meta-eng] |
| **Adaptive Ranking Model** | Routes each request to the right-sized model so LLM-scale (~1T parameter) ranking fits sub-second latency; computes user signals once per request. Launched on Instagram Q4 2025. | +3% conversions, +5% CTR "for targeted users"; no baseline/method | [Meta engineering, 2026-03-31](https://engineering.fb.com/2026/03/31/ml-applications/meta-adaptive-ranking-model-bending-the-inference-scaling-curve-to-serve-llm-scale-models-for-ads/) [Meta-eng] |
| Ads-retrieval kernel scheduler | Infra change: −28% p99 latency on the retrieval path, +1.1% "weighted ads ranked". | Infra | [Meta engineering, 2026-07-13](https://engineering.fb.com/2026/07/13/ml-applications/modernizing-the-meta-ads-service-with-an-open-source-kernel-scheduler/) [Meta-eng] |

None of these posts gives advertiser-facing instructions. The "GEM is teacher, Lattice/Andromeda are students" framing is a third-party synthesis ([aimerce newsletter](https://newsletter.aimerce.ai/p/how-meta-s-ai-ad-stack-really-works-lattice-andromeda-and-utis), [secondary]), not Meta's.

### What advertisers are told, and how good the evidence is

- **"Creative diversification is the best lever to reach relevant audiences."** Attributed to a Meta Business news post of April 2025 ("The Creative Advantage: Unlocking the Power of Diversification with Meta Andromeda"), quoted by [Jon Loomer, 2025-08-19 upd. 2025-12-15](https://www.jonloomer.com/meta-andromeda/) [practitioner]. Meta-originated advice, but no published test behind it.
- **Meta dropped its "max 6 ads per ad set" recommendation in February 2025** (Loomer, same post). Loomer has run 50 ads in one ad set and says more ads help only if they are genuinely different.
- **Creative similarity score.** Meta reps showed agencies an account-level "creative similarity score"; quoted: "any account with a similarity score above 65% is highly likely to show ads to the same group of people" ([Growth Collective, 2026-02-11](https://growthcollective.beehiiv.com/p/what-meta-told-us-about-andromeda), [practitioner, second-hand Meta rep quote]). Even the reps saw only one number, without a definition.
- **Folklore / unverified:** "Entity ID" as a hard auction ticket; a 60% suppression threshold; "8–12 concepts × 2–3 variants"; "20+ new ads a month = +65% ROAS"; "April 2026 Andromeda update made more edits reset learning" ([Pixis](https://pixis.ai/blog/ai-learning-phases-why-advertisers-kill-campaigns-too-early/), [vendor], uncorroborated). [Precis, 2026-07-19](https://www.precis.com/resources/meta-andromeda-and-creative-strategy-what-actually-changed-and-what-didnt) [vendor] is a fair example of the genre: confident mechanism descriptions, no data, no Meta citation.
- **Reasonable inference** (mine, from the engineering posts): as retrieval and ranking get more personalised and use longer behaviour histories, the ad itself (format, message, visual) carries more of the "who is this for" signal than targeting does. That supports broad targeting and genuinely varied creative. It does not support any specific number of ads.

**For Westpack:**
- The documented gains are a few percent and B2C-measured. Nothing in Meta's posts says small, low-volume B2B advertisers behave differently, but Lattice's own rationale (transfer learning "when data is limited") is the best argument that Meta's models can work with Westpack's thin signal at all — they learn mostly from cross-advertiser data, not from Westpack's 20–40 weekly new customers.
- **Max 5 active ads per ad set** conflicts with Meta's own (dropped-cap, more-diversity) direction. The case for Westpack's cap: at ~2,400 DKK/day per market and single-digit weekly conversions, more ads split very little delivery further and make per-ad reads meaningless; Meta concentrates spend on 1–2 ads anyway. The case against: under Andromeda the cost of an extra *different* ad is low and it widens who can be retrieved. Practical resolution within the rule: treat the 5 slots as 5 *distinct concepts* (different message, format, visual world) rather than variants of one idea, and rotate concepts rather than refreshing variants. Measure similarity by eye, since the similarity score is not exposed through the API.
- Do not attribute week-to-week swings to "Andromeda updates"; there is no documented 2026 retrieval change advertisers can see.

---

## 2. Account structure in 2025–2026

### Advantage+ sales campaigns (the 2025 unification)

- [Meta-doc] Separate ASC / AAC / manual creation flows were replaced by one flow. A campaign is in **Advantage+ state** when three levers are on: **Advantage+ campaign budget**, **Advantage+ audience** and **Advantage+ placements**. `advantage_state` (read-only) = `ADVANTAGE_PLUS_SALES` / `_APP` / `_LEADS` / `DISABLED`. Any lever off → `DISABLED`, i.e. a normal manual campaign. ([Advantage+ campaigns, Marketing API docs, read 2026-10-13](https://developers.facebook.com/docs/marketing-api/advantage-campaigns))
- Audience qualifies with `advantage_audience=1`, or with only `geo_locations`, or with relaxed lookalike/custom/detailed targeting. **Custom-audience exclusions, location, minimum age and language remain hard constraints** under Advantage+ audience ([Advantage+ audience docs](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience.md) [Meta-doc]). Under Advantage+ audience `age_min` may be 18–25 only and `age_max` is fixed at 65. Since API v23, new ad sets default to `advantage_audience=1` unless set explicitly.
- Account-level placement exclusions do not disqualify Advantage+ state; campaign-level placement exclusions do.
- **`existing_customer_budget_percentage` (the ASC existing-customer cap) is not available for new Advantage+ campaigns.** Legacy ASC campaigns using it are paused at API v26. Meta's replacement: two ad sets, one targeting an existing-customer custom audience (relaxation off), one excluding it, each with its own spend limit ([Meta-doc], same page). Several 2026 vendor guides still describe the cap as live — they are out of date.
- Migrating a legacy ASC campaign forces it back into learning "with no workaround" ([Meta-doc]).
- Meta's performance claims: Advantage+ leads with Advantage+ on, 10% lower cost per qualified lead in early tests ([Social Media Today, Feb 2025](https://www.socialmediatoday.com/news/meta-advantage-plus-ad-updates-february-2025/739472/), [Meta-claim]); 9% lower CPA for Advantage+ sales cited in Meta's festive-season guide ([secondary](https://influencermarketinghub.com/meta-holiday-blueprint)). Counter-evidence: Wicked Reports' 55,661-campaign dataset showed Advantage+ cost per *new* customer rising from $257 (May 2024) to $528 (May 2025) while manual campaigns' fell ([Wicked Reports, 2025-06-10](https://www.wickedreports.com/blog/meta-advantage-research-results), [vendor], one month, no stats). Neither side is decisive.

### Advantage+ audience vs original audience

- The best public test found: [Jon Loomer, 2024-09-09](https://www.jonloomer.com/test-results-advantage-plus-audience-detailed-targeting-lookalikes/) [practitioner], 30-day Meta A/B test, ~$2,250. Advantage+ audience without suggestions beat lookalikes significantly and detailed targeting non-significantly (Meta: 36% chance detailed targeting wins on rerun); CRM-verified quality was also better. Remarketing share was ~9–10% in all three arms. Small, one account, B2C-ish, 2024 — but nothing better is public.

### Consolidation vs segmentation; multiple countries

- The practitioner consensus for 2025–2026 is "one campaign per goal, few broad ad sets, targeting through creative" (Loomer, above). Its premise is signal density per ad set.
- On multi-country sales campaigns, [Loomer, 2026-06-17](https://pubcast.jonloomer.com/does-worldwide-targeting-actually-work-for-sales/) [practitioner]: start with one ad set, check the country breakdown, and if delivery skews to non-buying countries **narrow the countries or use value rules by country rather than splitting ad sets**. He names the main legitimate reason to split as *making ads more relevant per country* — which is exactly the multi-language case.
- Agencies working multi-market tend to group by **language** rather than by country, with separate ad sets for multilingual countries ([RocketShip HQ](https://www.rocketshiphq.com/?p=5251), [practitioner], undated). Meta now offers auto-translation of primary text/headlines (Advantage+ creative "Translate text", single image/video only, languages vary by account, no edit control — [Loomer QVT](https://www.jonloomer.com/qvt/translate-text-feature/) [practitioner], undated) and 2026 expansions to text-on-image and voice-over translation ([eMarketer](https://www.emarketer.com/content/meta-ramps-up-genai-powered-ad-creation-marketers-weigh-consumer-trust), [secondary]). No evidence was found on how well auto-translated ads perform against native copy.

### Learning phase

- Rule as reported everywhere: an ad set exits learning after **~50 optimisation events within 7 days of the last significant edit**; failing that it shows **Learning limited** ([ppc.land](https://ppc.land/learning-phase/), [secondary, citing Meta Help Center]; Help Center page itself unrendered — "snippet"). No 2025–2026 source shows Meta changing the number.
- **Significant edits** (secondary consensus): targeting, optimisation event, bid strategy, creative edits/adding ads (disputed), large budget changes, and pausing ≥7 days. Meta's own budget example only contrasts $100→$101 with $100→$1,000; the "20%" threshold is folklore, not documented ([Loomer via search snippet](https://www.jonloomer.com/?p=29652), [practitioner]).
- [Loomer, 2025-10-15](https://pubcast.jonloomer.com/the-learning-phase-is-just-a-label/) [practitioner]: "Learning" is a label, the system always learns; adding a new ad to a high-performing ad set did not reset learning in his test; ad sets Meta classes as high-performing tolerate larger budget increases. Advice: judge results, not the label; don't avoid needed changes for fear of learning.

**For Westpack:**
- **Learning limited is structural for DE/FR/IT and should be treated as a permanent state, not a fault.** At ~2,400 DKK/day and ~3,500 DKK per incremental new customer, each market produces roughly 5 incremental new customers a week; even all purchases on standard attribution will be far from 50/7 days. The usual remedy (pool markets) is off the table by decision ([markets-keep-their-own-ad-sets]). What still helps without merging: optimise on the purchase event rather than on the rarer custom conversion if they are not already doing so, avoid stacking edits, and judge on 14–28-day windows.
- **The best-supported reason for Westpack's per-market ad sets is language**, which is also the one reason practitioners still accept. DE/FR/IT copy is market-specific; that is a legitimate split. Conv - 04 - EU (one ad set across Europe, many languages) is the structure the "consolidate" camp would recommend — and is the account's cheapest source of new customers (~780 vs ~3,500 DKK). That is consistent with the signal-density argument, but the two are not comparable on cost per customer (different country mixes, and DE/FR/IT were on incremental optimisation until 2026-09-29; see [never-compare-across-attribution-settings]).
- Each conversion campaign has one ad set, so Advantage campaign budget vs ad set budget is functionally identical there. Whether those campaigns are formally in Advantage+ state is cosmetic; switching them to gain the label is a significant edit for no documented benefit.
- Westpack's "exclude buyers 180d" is a hard constraint that survives Advantage+ audience — no conflict.

---

## 3. Budgets and bidding

### Budget mechanics [Meta-doc]

- **Daily budget is an average.** Developer budget page still says up to 25% over; newer Meta messaging and the budget-sharing doc state **up to 75% over on a day, never more than 7× daily in a week** (Sunday–Saturday) ([Loomer, budget flexibility](https://www.jonloomer.com/updates-to-meta-ads-budgeting/) [practitioner quoting Meta UI]; [ad set budget sharing docs](https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/adset-budget-sharing) [Meta-doc]).
- **Lifetime budget** caps the flight total and paces unevenly across days ([budgets doc](https://developers.facebook.com/docs/marketing-api/bidding/overview/budgets)). Needed for scheduling and for auction Target frequency (see 00-awareness file).
- **Advantage campaign budget** (CBO) distributes in real time across ad sets; ad-set **min/max spend targets** are "best effort", not guarantees ([Advantage campaign budget docs](https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/advantage-campaign-budget.md)).
- **Ad set budget sharing**: each ad set may give/receive up to 20% of its daily budget to siblings; daily budget campaigns only; same bid strategy required on all ad sets; cannot be switched on mid-flight (only off); cannot change bid strategy while on; from v24 the flag must be set explicitly ([Meta-doc], read 2026-10-13).

### Bid strategies — what each does and the evidence

| Strategy | Meta definition [Meta-doc] | Evidence |
|---|---|---|
| **Highest volume** (`LOWEST_COST_WITHOUT_CAP`) | Spend full budget for most results; costs rise as cheap inventory is used. | Default; Loomer uses it ~90% of the time ([2023, upd. 2025-03-01](https://www.jonloomer.com/bid-strategies-best-practices-for-meta-advertising/), [practitioner]). |
| **Cost per result goal** (`COST_CAP`) | Targets an average CPA; "adherence… is not guaranteed"; may under-spend. | CTC, 253 accounts, $200M, Mar 2025–Jul 2026: delivered **140% of target** on average ([Common Thread, 2026-08-06](https://commonthreadco.com/blogs/coachs-corner/meta-cost-controls-study-taylor-holiday-andrew-faris), [vendor/agency]). |
| **Bid cap** | Hard max bid per auction; needs manual management; may under-spend. | CTC: 123% of target on a small $3M subset; now CTC's default. Loomer: "only the most advanced" should use it. |
| **ROAS goal** (`MIN_ROAS`) | Value optimisation only; floor too high → under-delivery. | CTC: 96.5% of target in aggregate, but 67% of accounts finished >5% below target. |

Failure mode differs: cost/ROAS goals fail by **under-spending**, highest volume fails by **overpaying**. All evidence is B2C e-commerce with catalogue price variance.

### Scaling budget

- No Meta document gives a safe increment. "20% every 3–5 days" is universal practitioner folklore ([tryatria](https://www.tryatria.com/blog/how-to-scale-facebook-ads-profitably), [vendor]), with no published test behind it. Loomer reports larger increases on high-performing ad sets without re-entering learning (above). Meta's 2024 claim that gradual changes do not restart learning from scratch is reported only second-hand.
- What is documented: costs rise as budget grows on highest volume (marginal CPA > average CPA) — Meta's own bid-strategy text ([Meta-doc]).

### Value rules (June 2025; audience labels April 2026)

- [Meta-doc] ([Value rules](https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/value-rules.md), read 2026-10-13): bid adjustments by **AGE, GENDER, OS, DEVICE_PLATFORM, LOCATION (country/region/city), PLACEMENT, conversion location, AUDIENCE_LABEL** (`NEW_USERS`, `HIGH_VALUE`, `LOW_VALUE`, `AT_RISK`, `ENGAGED_USERS`, …). Increase 1–1000%, decrease 1–90%. Up to 10 rules per set, 6 sets per account; first matching rule wins. Works with **highest volume and cost per result goal** (not ROAS goal or bid cap per secondary sources). Meta's own warning: "you may see more conversions from your preferred audiences, but your overall cost per result may increase." Meta positions value rules explicitly as a way to **consolidate campaigns**.
- Audience labels come from labels on customer-list and website custom audiences, not from Advertising Settings audience segments ([Loomer, 2026-04-21](https://www.jonloomer.com/meta-value-rules-audiences/) [practitioner]; [Alex Neiman, Apr 2026](https://alexneiman.com/meta-value-rules-for-audiences/) [practitioner]). Neiman's ~100 conversions per segment per month before relying on them is his own heuristic.

### New-customer acquisition features

- **Existing-customer budget cap:** gone for new Advantage+ campaigns (above) [Meta-doc].
- **Audience segments** (Advertising Settings: Engaged audience, Existing customers; everyone else "New audience") are a **reporting breakdown**, originally said not to affect delivery ([Loomer QVT](https://www.jonloomer.com/qvt/engaged-customers-now-engaged-audience/) [practitioner]; [Flighted](https://www.flighted.co/blog/meta-audience-segments-explained-what-they-are-and-how-to-define-them) [vendor]). Social engagers are always "New".
- **Customer lifecycle strategy → "New customer acquisition"** (ad-set level, manual Sales campaigns, rolling out from early 2026): options "Get conversions from all audiences" vs "New customer acquisition"; "new" = no purchase in ~180 days per pixel, CAPI and customer lists ([Spilno, 2026-06-24 upd. 2026-10-10](https://spilnoagency.com.ua/en/news-en/meta-ads-new-customer-acquisition) [vendor]; [EasyInsights, 2026-04-13](https://easyinsights.ai/blog/metas-customer-lifecycle-strategy-the-small-setting-that-changes-everything/) [vendor]). No published results. Not found in Meta's developer docs as of 2026-10-13.
- **Does it work with a custom `New_customer` conversion?** **Unverified.** No source addresses it. Mechanically the setting restricts *who* is eligible (by Meta's own purchaser data); the optimisation event is a separate choice, so combining it with purchase or custom-conversion optimisation is plausible — but Meta's definition of "new" (pixel Purchase / customer list, ~180 days) is not Westpack's definition (shop's `new_customer` flag, presumably first order ever). Expect the two counts to disagree.
- Evidence that excluding existing customers works: agency case, nCAC −54% Oct–Dec 2024 after excluding 3–5-year buyers and 90-day visitors ([DMi Partners](https://www.dmipartners.com/blog/how-we-used-metas-levers-to-drive-new-customer-acquisition/), [agency, self-reported], B2C, Q4).

### Incremental attribution as an *optimisation* setting

- Launched spring 2025; available with conversion goals; optimises towards people Meta's lift-trained model thinks will convert *because of* the ad ([Loomer, 2025-09-10](https://pubcast.jonloomer.com/incremental-attribution-explained/) [practitioner]). Meta-side claims of +20% / +46% incremental conversions circulate without method ([secondary](https://www.workmagic.io/blog/incremental-attribution-meta)). Loomer's early tests: worse costs, no clear quality gain. Seer (6 accounts, $1.05M, April 2025): Meta's model called ~87% of conversions incremental vs ~67% by a GA4 cross-check ([Seer, 2025-07-30](https://www.seerinteractive.com/insights/we-tested-metas-new-incremental-attribution-setting-on-1m-in-ad-spend.-heres-how-it-works) [agency]).

**For Westpack:**
- **Value rules by country are the strongest new tool for Conv - 04 - EU.** About 25–31% of its spend goes to countries with ≤1 new customer (internal analysis, 2026-10-12). Rather than a new ad set or hard exclusions, a `LOCATION` rule decreasing bids 30–50% in the weak countries (or increasing in SE/BE/NO/NL/DK…) keeps one ad set and one learning pool. Cost: a documented warning that overall CPA may rise; it is a significant edit. This matches both Loomer's multi-country advice and the user's "no more ad sets" preference. Verify in Ads Manager that value rules are available on this account before proposing it.
- **Highest volume is the right default for DE/FR/IT**: at ~5 incremental new customers a week, a cost goal or bid cap would have too few events to pace against and would most likely under-spend. Revisit only for Conv - 04 - EU, and only after a stable 4-week CPA baseline exists.
- **The 2,500→3,800 DKK/day step on Conv - 04 - EU (+52%)** is larger than any practitioner rule, but no evidence says it *must* break performance. Expect marginal cost per new customer above the average for a while; judge after 14+ days (the planned stop rule, >~1,500 DKK per extra customer, is sound). Do not undo and redo — repeated large edits are the worse case.
- **Daily-budget flex up to 75%** means single days far above 3,800 DKK are normal and not a reason to react.
- **New customer acquisition setting**: Westpack already excludes 180d buyers, which does most of the same job. The setting adds Meta's own purchaser data (CAPI/customer list beyond the exclusion audience). Worth a check whether it exists in the account; if it does, test it on one market rather than adding it everywhere, and read results on the shop's own new-customer flag, not Meta's.
- **Incremental optimisation vs incremental reporting**: the user reads results on incremental attribution deliberately. Optimising on it was abandoned for DE/FR/IT on 2026-09-29. Case for staying on standard optimisation: incremental optimisation counts fewer events and Westpack is already starved of them; practitioner tests show worse costs. Case for going back: it aims at exactly the outcome the user values. With this volume the second case cannot be proven by Meta's own numbers in any reasonable time — it needs the market-level test (`scripts/incremental-market-lift.js`).
- **Ad set budget sharing** on BA - Reach explains the 80%/120% pattern (see [ba-reach-budget-sharing]); it cannot be re-enabled mid-flight once switched off, so switching off is effectively one-way for that campaign.

---

## 4. Signals: CAPI, match quality, deduplication, offline

- [Meta-doc] Meta recommends Pixel + Conversions API in a **"redundant setup"** with deduplication by **`event_id` + event name** (or `fbp`/`external_id`); dedup only works within **48 hours** of the first event ([dedup docs](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events.md)). Server events are used for optimisation "in a similar way" as pixel events ([CAPI overview](https://developers.facebook.com/documentation/ads-commerce/conversions-api.md)).
- **Event Match Quality** is a 0–10 score for how well server events match Meta accounts; web events only; Meta says higher EMQ "may improve ads attribution and performance". The **Dataset Quality API** exposes EMQ, **Additional Conversions Reported (ACR)**, **event coverage** (7-day share of pixel events also sent by CAPI with dedup keys), dedup-key feedback and data freshness ([Meta-doc](https://developers.facebook.com/documentation/ads-commerce/conversions-api/dataset-quality-api.md)). This reads the dataset, not the ad account.
- Meta's headline claim: Pixel + CAPI = **13% lower CPA on average** (Blueprint course, [Meta-claim], no method published). Independent evidence is anecdotal.
- **Offline Conversions API was discontinued (May 2025)**; offline/CRM events now go through the normal Conversions API, `event_time` up to 7 days back, upload daily or real-time for optimisation ([Graph API v20 changelog](https://developers.facebook.com/docs/graph-api/changelog/version20.0); [offline events doc](https://developers.facebook.com/documentation/ads-commerce/conversions-api/offline-events.md) [Meta-doc]).
- Low-volume implication: everything Meta does with Westpack's data is limited by event count. Signal quality (match rate, completeness, dedup) matters *more* when events are scarce, because each lost purchase is a larger share of the learning signal. No B2B-specific evidence was found.

**For Westpack:**
- **Highest-value check, read-only:** pull EMQ, event coverage and ACR for the Purchase event and for the `new_customer` event from the Dataset Quality API. If `new_customer` is pixel-only, sending it server-side from Magento (with `event_id` dedup, hashed email/phone, company email) is the cleanest improvement to the account's headline KPI — it makes the New_customer count robust to browser loss and ad blockers, which matter for B2B buyers on work machines.
- B2B order values vary widely (one jeweller's box order vs a chain's), so passing `value` correctly on Purchase is worth verifying, even though value optimisation is unrealistic at this volume.
- A **qualified-signal option** for later: send a server-side event for "first order above X DKK" or "repeat within 90 days" and use it as a value-rule label or reporting event. Do not optimise on it — it would be rarer still.

---

## 5. Placements

- [Meta-doc] Advantage+ placements is the default. If you set placements manually, `publisher_platforms` must include **facebook**; Threads requires Instagram `stream` too; several positions (FB Stories, Messenger, notifications, WhatsApp Status) can only be chosen alongside a parent placement ([placement targeting docs](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/placement-targeting.md)).
- **Limited spend on excluded placements** (from 2025-10-08): in Sales and Leads ad sets, Meta may spend **up to 5% per excluded placement** where it expects better performance. Off by default in the API; **on by default in Ads Manager** when a placement is removed ([Meta dev blog, 2025-10-08](https://developers.facebook.com/blog/post/2025/10/08/introducing-limited-spend-on-excluded-placements-in-marketing-api/) [Meta-doc]; [PPC Land, 2025-10-16](https://ppc.land/meta-pushes-spending-5-on-excluded-placements-for-sales-and-leads-campaigns/) [secondary]). API field `placement_soft_opt_out`. Meta has published no data showing it helps.
- **Threads** is in Advantage+ placements by default since the global rollout (completed ~January 2026), opt-out via manual placements ([Marketing Dive](https://www.marketingdive.com/news/threads-ads-expanded-to-all-meta-advertisers/746147/) [secondary]).
- **Value rules can bid placements down** instead of excluding them (FB/IG Feed, Stories, Reels, Marketplace, Search, Video, Explore, Audience Network) [Meta-doc].
- Audience Network still allows publisher block lists and category exclusions.

**For Westpack:**
- Awareness delivery is already ~56% Reels, no Audience Network (00-awareness file). For the conversion ad sets, check whether any placement is excluded — if so, the 5%-per-placement box is probably ticked and some spend is going there anyway. If a placement must truly stay out (e.g. Audience Network for brand safety), untick it explicitly.
- If a placement is merely weak for B2B buyers (Marketplace is the usual suspect), a negative placement value rule is the softer, reversible option and does not remove the ad set from Advantage+ state.

---

## Confidence key for the main conclusions

| Conclusion | Confidence |
|---|---|
| Andromeda/GEM/Adaptive Ranking exist as described; gains of a few % | High (Meta engineering) |
| Specific Andromeda tactics (Entity ID, thresholds, ad counts) | Low (practitioner folklore) |
| Existing-customer budget cap removed for new Advantage+ campaigns | High (Meta docs) |
| Value rules: criteria, ranges, supported bid strategies, CPA warning | High (Meta docs) |
| New-customer acquisition setting exists and defines "new" by 180 days | Medium (two vendors, consistent) |
| It works together with a custom New_customer conversion | Unverified |
| 50 events / 7 days learning rule unchanged | Medium-high (consistent secondary, Help Center unrendered) |
| "20% budget step" as a safe rule | Low (folklore) |
| Cost cap overshoots ~40%, bid cap ~23% | Medium (one large agency dataset, B2C) |
| 5%-per-excluded-placement default on in Ads Manager | Medium-high (Meta API post + two secondaries) |
| CAPI + dedup + EMQ improve delivery | Medium (Meta claim, mechanism documented, no independent measurement) |
