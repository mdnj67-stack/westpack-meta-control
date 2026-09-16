# westpack-meta-control — Campaign Studio notes

Internal Westpack marketing ops app (Meta ads + Klaviyo). This file captures facts about the
Campaign Studio / Campaign Brain / Content Agent subsystem discovered while taking the project
over from a prior AI (Codex/Codex CLI) session, so future sessions don't have to re-derive them.

## Repo mechanics

- No `package.json`, no npm, no `node_modules` at the repo root — this is deliberate, not an
  oversight. Do not add one. Tests run directly with Node's built-in runner:
  `node --test tests/<file>.test.js`.
- Start the local server with `serve-local.ps1`; restart it after backend/api changes.
  `node smoke-local.js` is the local smoke test.
- `app.js` (~780KB) is a single monolithic front-end file. Campaign Studio's UI (drag/drop module
  canvas, carousel card builder, asset library, crop editor) lives inline in it — there is no
  separate front-end module for Campaign Studio.
- Many existing tests, especially UI-adjacent ones (e.g. `tests/campaign-studio-admission.test.js`,
  `tests/campaign-email-editor-usability.test.js`), are characterization tests: they `readFileSync`
  `app.js`/`styles.css` and `assert.match` literal regex patterns against the raw source, rather
  than calling exported functions. They catch string/pattern drift, not behavior — keep that in
  mind when a "passing test" is used as evidence a change is correct.
- `tests/e2e/campaign-brain-ui.spec.js` (Playwright) is committed but not runnable from a fresh
  clone as-is: no `playwright` package and no `node_modules` exist at the repo root. The ad-hoc
  `tmp/playwright-runner/` sub-project a prior session built for this **still exists** as of
  2026-09-11, with its own `package.json`, an installed `playwright` and six spec files
  (`campaign-studio-smoke`, `content-agent-ui`, `meta-master-ui`, `meta-master-live`,
  `asana-campaign-picker`, `asana-content-assets`). It is gitignored, so it is one `git clean`
  away from being lost — check whether it is there before assuming e2e QA has to be rebuilt.

## Campaign Studio architecture

Pipeline: Asana ingestion → assembly → plan/concept → channel production → deterministic + AI
quality gate → human review → (separately) Meta/Klaviyo publish. Key files:

- `server/campaign/object.js` — assembles the campaign object from Asana input.
- `server/campaign/brain.js` — plan/artifact prompts+schemas, email compilation entry point.
  Distinct from `api/campaign/brain.js` (the HTTP router that imports and dispatches to it, plus
  `content-agent-worker.js`, `object.js`, `meta-from-master.js`) — easy to confuse, same basename.
- `server/campaign/email-design.js` — server-side compiler (`renderPremiumCampaignEmail`) that
  enforces the locked header/footer/legal/preheader (`email-universal-content.js`) and the
  `westpack-campaign-master-v2` module contract (`email-module-library.js`).
- `server/campaign/creative-production.js` — channel specialists, pre-production concept gate
  (requires three genuinely distinct routes, not cosmetic variants).
- `server/campaign/quality-agent.js` — the Quality Director. **Current contract id is
  `westpack-quality-director-v5`**, not v2/v4 as README.md still says. Constants:
  `QUALITY_PASS_SCORE = 87`, `QUALITY_DIMENSION_FLOOR = 78`, plus a review-tier
  `QUALITY_REVIEW_SCORE = 82` / `QUALITY_REVIEW_DIMENSION_FLOOR = 75`. There are three outcomes,
  not two: `admit_to_review` (full pass), a **`reviewable`-with-notes tier** (factually safe but
  never auto-publishable, wired into `content-agent-worker.js`), and `quality_blocked`. README.md
  does not mention the reviewable tier at all — treat README's prose as directionally right but
  not numerically authoritative for this file.
- `server/campaign/content-agent-worker.js` (~70KB, largest file) — the state machine engine:
  `queued → analysing → producing → quality_review → ready_for_review | quality_blocked`, plus
  `rejected`, `failed`, `dead_letter`, `reviewable`. Highest-risk file in the subsystem; recovery,
  manual control and continuous-queue advancement are all interleaved here.
- `server/campaign/agent-store.js` — persistence (Redis / atomic local file / volatile memory),
  reads/writes the entire agent state as one JSON blob per operation. `acquireAgentLock` does a
  real `SET NX EX` lock when Redis is configured, and a real file-based lock (`acquireLocalLock`,
  atomic `wx`-flag create) in local-file mode. Only volatile mode unconditionally returns `true`
  with no real mutual exclusion — deliberately so, since volatile mode has no cross-invocation
  persistence at all. Be careful about concurrent worker invocations in any environment that falls
  back to volatile mode (neither Redis nor local-file storage configured).
- `server/campaign/meta-from-master.js`, `master-design-dna.js`, `meta-carousel-contract.js`,
  `meta-quality-director.js` — the "Meta from Master" carousel path: Design DNA extraction, UK-English
  5-card structural contract, separate visual Creative Director rubric (90 overall / 80 per-dimension).
- The worker cannot publish under any code path: `publishCapability: false` and a `draft_only`
  health check are hard-coded, not just conventional.
- `server/campaign/email-asset-hosting.js` — the single Klaviyo image uploader, shared by
  `api/campaign/brain.js` (the `host_email_asset` route) and the worker. See below for why the
  worker has to call it.

### Campaign images must be hosted, not merely refreshed

Asana serves attachments from signed URLs that expire within hours. Until 2026-09-11 the worker
only ever *refreshed* them — `buildRefreshedAssetUrlMap` swaps an expired Asana URL for a fresh
Asana URL — while permanent hosting (`host_email_asset`, Klaviyo's image library) ran solely from
the browser, when an operator happened to be sitting in Campaign Studio. Everything the worker
left behind therefore pointed at links that were dead within hours.

Measured against production on 2026-09-11: of 52 unique image URLs across the stored compiled
emails, 46 were Asana URLs returning **403** and 6 were on Klaviyo's CDN — and five of those six
were the locked footer's social icons. Effectively no campaign photograph had ever been hosted.

That is the mechanical reason the pipeline had a ~2% admission rate (see below). `email_quality`
(avg 64.2) and `visual_design` (avg 64.5) were by far the worst dimensions and the two most
frequent veto failures, while every copy dimension sat in the low 80s. The Quality Director was
correctly reporting missing imagery; the revision loop could only rewrite copy, so five revisions
burned against a defect the producer could not reach.

The rule now: **every campaign image is copied into Klaviyo's permanent library before it can
enter an artifact, a quality review or a human's screen.** `hostCampaignImagery` in the worker
runs on the fresh path before any AI generation, and on every resume so in-flight jobs are
rewritten too. Details that matter:

- The hosted map lives in the job checkpoint (`hostedAssetUrls`). Every stage is a fresh
  invocation that re-reads Asana and gets new signed URLs, so the cache is keyed by
  `assetIdentity` (the asset's descriptive text, URL stripped) rather than by the URL. Keying on
  the URL would re-import the same photograph at all ten-odd stages and fill the image library
  with duplicates.
- A URL already on the Klaviyo CDN passes through untouched — re-importing it would duplicate it.
- Hosting failures are **not** fatal. A failed image keeps its source URL and is recorded as a
  production note. Losing a whole campaign because one attachment could not be copied would be
  worse than compiling with a URL that may expire.
- Klaviyo fetches the image itself via `import_from_url`, so a still-valid Asana link is handed
  straight over; the bytes never pass through this process.

### A module the producer authored must reach the compiled email

`normalizeEmailSections` (`email-module-library.js`) drops any section whose headline is blank,
and caps the list at four. Both used to happen silently. The producer's schema requires a
`headline` string but an **empty string satisfies it**, so a model with nothing left to say
emits a fourth section that compilation then discards — the locked plan promises four modules,
three are compiled, and the only party that notices is the Quality Director, which reports it as
`brief_fidelity`: *"Compiled evidence reports only three modules, against the locked requirement
for four."* The revision loop can only rewrite copy, so it burned all five revisions against a
defect it was never told about.

Three changes, and they belong together:

- `describeEmailSectionNormalization` returns `{ sections, dropped, authoredCount }`.
  `normalizeEmailSections` is now a thin wrapper over it, so existing callers are unaffected.
- `compileCampaignEmailDraft` records `moduleSystem.authoredCount` and
  `moduleSystem.droppedSections` beside the compiled module list.
- `buildQualityAudit` has an `email_module_integrity` check, and the audit carries
  `droppedEmailSections`. Because `evaluateQualityGate` only passes on
  `deterministicAudit.verdict === "ready"`, a dropped module now fails deterministically and the
  whole audit is in the reviewer's prompt, so the revision brief can name the lost module.

Note that `email_module_contract` does **not** catch this: it only checks that the compiled count
is between 3 and 4, and three compiled modules out of four authored is inside that range.

The prompt block now also tells the producer that a blank headline destroys the module and that
it should deliver fewer, stronger modules instead. The schema was deliberately **not** given a
`minLength` on headline — the rest of this schema sticks to the subset the structured-output API
is known to accept here (`enum`, `minItems`/`maxItems`, `additionalProperties: false`), and a
rejected schema would fail every job rather than one section.

### The operator's draft lives on the server, not only in their browser

The Content Agent's output was always server-side, but everything a human then did to it — module
edits, carousel card drafts, the chosen creative route, Meta targeting — lived only in that
operator's `localStorage`. Two people could not work on the same campaign, an edit did not survive
a change of machine, and a cleared cache lost the work outright.

`server/campaign/studio-draft-store.js` keeps the operator's draft beside the agent's own state,
on the same three backends. It imports `canUseLocalFile` and `redisCommand` from `agent-store.js`
rather than growing a second copy of the Redis plumbing, but it does **not** share the agent's
state blob: that is read and written whole on every operation, so drafts in it would contend with
the worker. Keys are `westpack:campaign-studio:draft:v1:<campaignKey>` with a 90-day TTL, and a
draft above 4MB is refused with a message rather than half-written (rendered carousel cards can be
data URIs). API actions: `studio_draft_load`, `studio_draft_save`, `studio_draft_clear`.

The browser copy stays. It is written synchronously so an edit survives a reload instantly; the
server copy follows on a 2.5s debounce. On opening a campaign the local copy paints first and
`reconcileCampaignStudioDraftWithServer` then adopts the server copy **only if it is newer**, so
a colleague's more recent work wins and this operator's does not get clobbered. Clearing a draft
clears both copies and cancels any pending sync — otherwise the discarded draft would be adopted
back on the next open and read as though it had returned by itself.

Where the server copy cannot be written the UI says "Browser only" in the warning colour. That is
deliberate: the operator needs to know the work is one cleared cache from being gone while they
can still do something about it.

### The asset library is shared, and holds no image bytes

The library was IndexedDB (`westpack-campaign-asset-library`) with the image inlined in each
record's `imageUrl` as a data URI. Every cropped variant, generated environment shot and approved
source photograph was therefore private to one machine, and clearing site data destroyed it.

The fix is not a blob store. Image bytes go to **Klaviyo's image library** — the client calls
`host_email_asset` before saving, so the record carries a permanent CDN URL — and
`server/campaign/asset-library-store.js` holds metadata only. That keeps the whole library small
enough to move in one round trip, and the images end up somewhere a campaign email can use
directly. `normalizeRecord` **refuses** a record whose `imageUrl` is still a `data:` URI; that is
the backstop against putting binaries back where they came from.

- A save **merges by id** rather than replacing the library. Two operators add assets to the same
  campaign, and a wholesale replacement would silently delete a colleague's uploads.
- Hydration merges the shared library into the local one and **the local record wins on id**: an
  operator's own IndexedDB copy may hold an unhosted image the server does not have, and losing
  it to a merge would be worse than showing it only locally.
- A failed host keeps the asset on its data URI rather than dropping it. It stays browser-only,
  and `syncCampaignAssetRecordToServer` refuses to push it, so an unhosted asset can never reach
  the shared library.
- A failed read of the shared library still renders the operator's own assets.
- API: `asset_library_load` (GET), `asset_library_save`, `asset_library_delete`. There is no
  delete path in the UI today — assets are archived by flipping `approved` — but tag and approval
  changes do sync, or a colleague would keep seeing the asset as first saved.

### There is a record of what a human committed

`server/campaign/audit-log.js` is an append-only trail of the decisions a person made: which
campaign was pushed to Klaviyo, which paused ad was created in Meta, which run was rejected and
restarted, when a Studio draft was saved. The agent logged its own reasoning in full, but nothing
recorded what a human then did with it, so "who sent this email, and when" had no answer.

Recorded server-side at the moment the thing actually happens — `api/klaviyo/push-template-rollout.js`,
all three ad-creation paths in `api/meta/publish-ad.js` (single image, carousel, video) and two
places in `api/campaign/brain.js`. Read it with `GET /api/campaign/brain?action=audit_log`
(optionally `&campaignKey=`), newest first.

Three properties that are deliberate:

- **A failed audit write never fails the action.** By the time `recordAuditEvent` runs, the
  template exists in Klaviyo or the ad exists in Meta. Throwing would tell the operator their
  handoff failed when it did not, so failures come back in the return value instead.
- **Bounded at 500 entries.** The whole log is read and written as one value, so it has to fit in
  a single round trip.
- **It is an activity trail, not an authenticated one.** The app sits behind a single shared
  password, so there is no per-person identity to record. Entries carry a self-declared `operator`
  label when the client supplies one and are honest in the module header about what that means.
  Real attribution needs per-user accounts, which this app does not have.

The client sends `campaignKey`/`campaignTitle` on both handoffs. Without them an entry records
that a template or ad was created but not which campaign it belonged to, which is most of the
question.

### Campaign Studio is live in production — check it, don't infer it

`.env.production` is a stale partial `vercel env pull` from April and does **not** list the
Content Agent's keys. Do not read its absence as evidence that anything is unconfigured. The
real deployment (`https://project-4fcxa.vercel.app`, Vercel project `project-4fcxa`) has Asana,
Redis and QStash all wired, and as of 2026-09-11 the agent reported `status: healthy`, Redis
persistence and an hourly heartbeat.

To check the truth cheaply, log in the way `smoke-local.js` does and read two endpoints — both
are read-only and neither touches the Meta quota:

- `GET /api/system/health` — OpenAI, Meta, Asana and Klaviyo configuration.
- `GET /api/campaign/brain?action=agent_status` — store mode, health contract, heartbeat age and
  the full job history with every quality audit. This is the only place the real production
  behaviour of the pipeline is visible, and it is worth saving to a file and analysing offline.

Note that `/api/system/health` reports nothing about Redis, QStash or the agent itself, which is
exactly the layer that decides whether 24/7 production runs. Use `agent_status` for that.

Two more places README drifts from what production actually reports: the live policy is
`maximumQualityRevisions: 2`, not the five README describes, and `automaticCreativeResets: 0`.
Read the policy off `agent_status` rather than off README.

A deploy is confirmed by calling a **new API action**, not by fetching a new server file over
HTTP. Server sources are served statically, but a newly added one can 404 long after the
function itself is live, so the file probe reports failure when the deploy has actually landed.
Deploys observed here took roughly three to five minutes to answer on the API.

As of 2026-09-11 the agent had produced 60 jobs — 44 `quality_blocked`, 10 `superseded`, 3
`failed`, 2 `rejected` and **1** `ready_for_review` (2026-09-02, score 89, tier `excellent`).
Blocked scores ran 42–83 with a median of 79 against a pass mark of 87, so nothing else has ever
come close. The queue is empty because all 41 eligible Asana tasks are already in
`processedTasks`, not because there is no work. See the image-hosting section above for the
mechanical cause of that admission rate.

Fourteen tasks sit outside the `Kampagner` section (`Årshjulet`, `WTP Nyheder`, and others) and
are therefore never produced. That is a workflow question for the marketing team, not a defect.

## Where the prior session (Codex) left off

Git history before commit `d56f472` ("Sync full local project state to repo") was squashed on
import, so `git log` per-file is uninformative for chronology — use file mtimes instead. Campaign
Studio work stopped around 2026-07-24 08:38 (last edit: `tests/campaign-email-editor-usability.test.js`),
while unrelated Meta-dashboard/Klaviyo work continued into August. This reads as a clean stopping
point (last full unit run was green), not a mid-crash — but re-verify before assuming the
email-editor-usability change is fully finished.

As of 2026-09-01, running the full campaign-related unit suite
(`node --test tests/campaign-*.test.js tests/content-agent-domain.test.js tests/content-quality-agent.test.js tests/creative-production.test.js tests/master-design-dna.test.js tests/meta-carousel-contract.test.js tests/meta-quality-director.test.js tests/agent-store.test.js tests/content-agent-worker-retry.test.js tests/content-agent-worker-revision-resume.test.js tests/meta-from-master.test.js`)
passes 138/138. As of 2026-09-09, `node --test "tests/*.test.js"` (the whole suite, quoted so
the shell does not expand the glob — `node --test tests/` does not work) passes 370/370. That
includes `tests/meta-dashboard-truthfulness.test.js`, which pins the nine figures corrected in
the 2026-09-09 pass. One Campaign Studio test,
"redis mode: readAgentState falls back to a safe initial state instead of throwing on a corrupted
blob" in `tests/agent-store.test.js`, failed once in a full-suite run and passed both in
isolation and on the next full run, so treat it as flaky rather than as a regression signal.
(The `tests/campaign-*.test.js` glob already picks up `tests/campaign-learning-store.test.js`
and `tests/campaign-learning-store-local-file-lock.test.js`; the four files listed explicitly above are the
ones added since the prior 100/100 count that the glob doesn't already cover.) The e2e Playwright spec was
not run (see above — not runnable without manual setup). This count will drift forward again as more tests
are added — re-run the command rather than trusting the number if it looks stale.

## Meta dashboard budget / objective split

Reworked 2026-09-04. The rule for this area: a campaign's objective group comes from
Meta's `objective` field and nothing else, and budget magnitudes are converted with a
deterministic per-currency exponent.

- `server/meta/budget-allocation.js` — the canonical module (CJS). Owns the
  objective→group table, `resolveObjectiveGroup`/`classifyCampaign`/`splitByCategory`,
  `resolveCurrencyMinorUnitDivisor`/`resolveBudgetNormalization`, `resolveDailyBudget`
  (including lifetime budgets) and `calculateBudgetAllocation`. `api/meta/account-snapshot.js`
  and the `server/meta/_snapshot-*.js` builders all import from here — there are no local
  copies of these functions any more.
- `src/meta-objectives.js` — ES-module mirror of the objective table for the browser.
  There is no bundler, so the table is duplicated by necessity;
  `tests/meta-objective-group-parity.test.js` parses both files and fails on any drift.
  Budget maths is deliberately absent from this file.
- Seven objective groups exist (`awareness`, `traffic`, `engagement`, `leads`,
  `conversion`, `app_promotion`, `unclassified`). Only three have a drill-down lens
  (`LENS_BY_OBJECTIVE_GROUP`); the rest appear in General and in the objective split only.
  The split renders only groups that have campaigns or budget, so the Westpack account
  (which uses solely `OUTCOME_AWARENESS`, `OUTCOME_SALES`, `OUTCOME_LEADS`) shows three rows.
- Two order constants, and they are not interchangeable. `OBJECTIVE_GROUP_ORDER` is the
  canonical set used for iteration, allocation totals and reconciliation (Meta funnel
  order). `OBJECTIVE_GROUP_DISPLAY_ORDER` is what gets rendered: awareness → conversion →
  leads → traffic → engagement → app_promotion → unclassified, because awareness and
  conversion are the pair the marketing team compares daily. The parity test asserts the
  two are permutations of each other, so a group can never render twice or vanish.

### Budget is always a 30-day month

The marketing department budgets monthly and treats a month as 30 days — "the budget is
200k" means 200,000 kr per 30 days. The dashboard follows that unit:

- Planned budget, both topline and per-objective, is **always** the 30-day figure
  (`totalMonthlyBudget` / `monthlyBudgetByGroup`), never rescaled to the selected range.
  An earlier version scaled it by `periodDays`, which produced numbers nobody could map
  onto how the team talks.
- Actual spend stays the real amount spent in the selected range — it is not rescaled,
  because it is a fact about money that left the account.
- The two therefore cover different windows, so comparison goes through a 30-day spend
  pace: `spend / periodDays * 30` versus the monthly budget (`pacePercentage`,
  `monthlySpendPace`). When the selected range is already 30 days the pace equals actual
  spend and `paceLabel` shortens accordingly.
- Because the windows differ, the UI must state both explicitly. That is the
  `meta-budget-window-strip` (Actual · selected range **vs** Planned · 30 days) plus the
  gold/green colour coding carried onto `.is-actual-card` / `.is-planned-card`. This is a
  correctness affordance, not decoration — do not collapse it into small print.
- `unclassified` is a sink, never a mapping target. Nothing may reclassify into it and it
  must never be folded into a real group — unmapped spend has to stay visible, and
  `buildQualityWarnings` reports its size.
- Budgets are **never** computed in the browser. The client renders
  `quality.budgetAllocation` from the server or shows a "Budget not synced" state. The old
  client-side estimator read raw `daily_budget` straight out of the static snapshot in
  `data/meta-live.js` (values are in øre there) and produced 100x figures.
- Lifetime budgets are spread across their flight, so campaigns need `start_time`/`stop_time`
  and ad sets need `start_time`/`end_time` (note the different field names) — both are in the
  fetch field lists in `_snapshot-fetchers.js`.
- `api/meta/account-snapshot.js` exposes `module.exports.__internals`
  (`buildGeneralSpendDistribution`, `buildLensStats`, `buildQualityWarnings`,
  `buildDashboardValidation`) purely so these can be unit tested without HTTP or Meta.
- Tests: `tests/meta-budget-allocation.test.js`, `tests/meta-objective-classification.test.js`,
  `tests/meta-objective-group-parity.test.js`, `tests/meta-spend-distribution.test.js`,
  `tests/meta-budget-stack-widths.test.js`, `tests/meta-objective-tone-coverage.test.js`.
  `src/ui.js` is ESM and the repo has no `package.json`, so Node cannot import it; the
  stack-width test lifts the real `buildStackSegments` source out of the file and evaluates
  it rather than copying the algorithm.
- Adding an objective group means: the table in both modules, a tone in `OBJECTIVE_TONES`
  (`src/ui.js`) and matching `.meta-budget-segment.tone-*` / `.meta-budget-row.tone-*` rules
  in `styles.css`. `tests/meta-objective-tone-coverage.test.js` enforces all four.
- Objective colours are `--tone-<group>-rgb` / `--tone-<group>-soft-rgb` tokens on `:root`,
  stored as space-separated channel triples so one value serves both the solid row fill
  and the semi-transparent mix-bar segment. Both rules must read the tokens and neither
  may hard-code a colour; the tone-coverage test enforces that too.

## Expansion reach — its own tab, its own rules

`server/meta/expansion-reach.js` + `renderExpansionView`/`renderOverviewExpansionReach`
(`src/ui.js`). The question is how many people the incremental campaigns reached for the
**first time**, which Meta has no field for. The only route is the cumulative curve: unique
reach from a fixed anchor to each month end, differenced. Every point costs a Graph call, so
this is a nightly snapshot (`?expansion=sync`, cron 03:10 UTC) and the browser only ever
reads it (`?expansion=status`, zero quota).

- **The Expansion sub-tab is not a lens.** `lens === "expansion"` hides the playbook, the
  hero panel and the range-driven "figures are not synced" state, because it reads whole
  calendar months from a stored snapshot and never touches the date picker. Two periods on
  one screen with nothing saying so is the defect this replaced.
- **A part month is never compared against a whole one.** The nightly job measures
  cumulative reach to the *same day of the previous month* (`buildLikeForLike`), so both
  sides cover the same elapsed days; cumulative spend comes back on the same call, so the
  cost per thousand is comparable too. Same rule as the new-customer month-to-date
  comparison. A baseline window with no delivery gets a label, never a percentage.
- **Markets come from `breakdowns=country`, not from campaign names.** One call returns
  every country for every month, so the split costs the same as the unbroken series.
  **Graph v25 rejects `country` in `fields` when it is also the breakdown** — the breakdown
  key comes back on its own. This failed the whole live sync once; `tests/meta-expansion-reach.test.js`
  pins the rule for every breakdown, not just this field. (Probes on v21 tolerated it, so
  probe against v25 — `GRAPH_BASE` in `server/lib/meta.js`.)
- **Country reach must never be summed.** Countries are deduplicated inside each country,
  not across them: measured 2026-09-16, the countries add to 960,654 against a deduplicated
  account figure of 940,699, so 2.1% of people were reached in more than one. The account
  figure stays authoritative and the gap is reported, never corrected for.
- **`Number(null)` is 0 and 0 is finite.** Every optional figure goes through
  `expansionMeasured`, because rendering a null as a measured zero says something the
  account never reported.
- **The campaign set is Meta's current `attribution_setting` over a rolling window**, so it
  changes under the series and rewrites completed months. `collectRestatements` records both
  figures and the reason; the anchor also moves once the first delivering month rolls out of
  the window, which re-bases every figure.
- Cold sync ≈ 24 Graph calls, warm ≈ 7. Rate limits are never retried here.

What the live data showed on 2026-09-16, worth knowing before re-deriving it:

- IT, FR and DE delivered from January, ran **nothing from May to August**, and returned on
  9 September. Do not read two months of country data and conclude they are new markets.
- September 1–16: 780,874 first time at 125 kr/1,000, against 171,729 at 252 kr/1,000 over
  the same 16 days of August. The cheap new reach is real.
- But new customers per 1,000 newly reached is 0.04 in September against 0.23 in August, and
  IT contributed 0 new customers on 291k first-time reach. Reach and customers disagree —
  do not report the reach figure alone as a win.
- GB and DK have run all year and are saturating: DK is 761 kr/1,000 at 46% repeat and
  frequency 7.8.

## What the dashboard is allowed to claim

Reworked 2026-09-09. The standing rule for this dashboard, from the user: it must be
"100% korrekt", aimed at growth in the Meta setup, "super clean og ikke fyldt med alt
muligt fyld som ikke har interesse". Correctness outranks features, and removing a panel
is a legitimate deliverable. A missing number is acceptable where a wrong one is not.

Nine figures were wrong before this pass. Do not reintroduce any of them:

- **Reach can never be summed.** Meta deduplicates reach only inside the entity queried,
  so adding campaign reach counts anyone who saw two campaigns twice - on this account
  that inflated the awareness figure from roughly 6M to 12.2M. `fetchDeduplicatedReach`
  (`server/meta/_snapshot-fetchers.js`) asks at `level: "account"`, once for the whole
  account and once filtered to the awareness campaign ids, which is what Ads Manager shows
  for that selection. Frequency uses the same denominator. Where the deduplicated figure
  is missing the summed one is shown but explicitly labelled as a sum.
- **A rate over several campaigns is summed numerator over summed denominator.**
  `buildComparisonSeriesTotals` adds its accessor's output across campaigns, so feeding it
  a ratio plots the sum of the ratios. Use `buildDerivedSeriesTotals` for ROAS, CPM, CPL,
  CTR and frequency.
- **Percent change divides by the real baseline.** The zero and negative cases return
  before the division, so flooring the divisor at 1 guards nothing and silently flattens
  every metric whose baseline is below 1.
- **The client uses `comparison_window`, never a half-split.** `splitAggregateSeries` cuts
  one range in half and calls the first half "previous"; `getComparisonWindowChange`
  (`src/meta-dashboard-metrics.js`) takes the two real windows instead.
- **Date ranges resolve in the ad account timezone** (`America/Los_Angeles`), via
  `resolveTodayInTimeZone`. The account is fetched before `buildDateScope` for this reason;
  do not move that call back.
- **Campaign status is Meta's `effective_status`**, mapped through
  `describeDeliveryStatus`. It was the literal string "Healthy" on every row.
- **Currency falls back to DKK everywhere**, matching the account and
  `budget-allocation.js`. A EUR fallback in the display path once meant kroner could print
  with a euro sign.
- **The incremental split comes from Meta's `attribution_setting`, not from the campaign
  name.** The account does report it, on the campaign's insights row, and Ads Manager
  prints it in its "Attribution setting" column. Values seen here: `incrementality`,
  `1d_view_7d_click_1d_ev`, `1d_view_7d_click`, `1d_view_28d_click`, `7d_click` and
  `multiple` - machine values, not the wording the UI shows, so a word-boundary pattern
  around "click" matches nothing inside `7d_click_1d_ev`. `resolveReportedAttribution`
  reads it and outranks the name tag. The name tag stays as the fallback for when Meta
  reports nothing, because the team maintains that register deliberately and a silent
  field must never reclassify a campaign they have tagged. `multiple` means the
  campaign's ad sets disagree and is **not** read as standard.
  Asking for the field returns a row for every campaign that ever existed, because it is
  configuration rather than a result - that took the snapshot from 15 campaigns to 358,
  of which 343 had no spend, impressions, clicks or actions. The handler drops rows with
  none of those four before anything reads them.
  Meta still returns the standard figures for the incrementality attribution window on
  this account, verified field by field. `incremental_matches_standard` detects that and
  `buildQualityWarnings` discloses it. **Never present the lens as a measured uplift** -
  the split is now sourced correctly, but the numbers inside it are still standard
  attribution.
- **The data quality panel is visible on every lens**, including General. It used to sit
  inside the section the render hides there, so the first view people open was the one
  that never showed whether its own numbers could be trusted.

### The account was rebuilt on 2026-09-09

The Meta setup was restructured from product themes to markets. What the dashboard now
sees, and the two defects that surfaced with it:

- **Active conversion:** `Conv - 01 - DE - Inkremental`, `Conv - 02 - FR - Inkremental`,
  `Conv - 03 - IT - Inkremental` and `Conv - 04 - EU - Standard`. The old themed
  campaigns (Smykkekunde, Giftpackaging, Forsendelse) are paused but still carry spend in
  a 30-day window, so they stay in the lens.
- **The attribution setting supersedes all of this** (see above). Found on 2026-09-10
  from a screenshot of Ads Manager, whose "Attribution setting" column read "Incremental
  attribution" against the three Inkremental campaigns and "7-day click" against
  Conv - 04 - EU - Standard. It also settles three of the four untagged campaigns, and
  reveals that `Kick-off Placeholder` is on incremental attribution despite carrying no
  tag. The name-tag history below is kept because the tag is still the fallback.
- **The new campaigns spell it "Inkremental" with an a**, where the previous set said
  "Inkrementel". The matcher looked for those exact words and put all three in the
  standard lens with 216,000 DKK of monthly budget, while validation reported five passes
  and no failures. `hasIncrementalNameTag` now matches the stem `in[kc]rement`, and a
  conversion campaign carrying neither tag is **named** in a data-quality warning rather
  than silently counted as standard. The team tags both sides today, so an untagged
  conversion campaign is a real signal.
- **`BA - LAL`** is the new active awareness campaign and carries its budget on four ad
  sets (`LAL - DE/FR/IT/EU`, 925 DKK each) rather than on the campaign. Ad-set budgets
  are picked up correctly; nothing needed changing there.
- **An ad-set breakdown may never replace a campaign total unless it reconciles.** Meta's
  campaign-level figure is authoritative and the breakdown is a convenience. BA - LAL
  spent 38,888 DKK while its four ad sets accounted for 22,753, so the old unconditional
  override understated awareness spend by 16,103 DKK, 16.3% of the lens, and pulled CPM
  down with it. The override now requires agreement within 1%; otherwise campaign totals
  stand and the panel says so. Campaigns carry `campaign_level_spend_value` from before
  any override so the reconciliation has a real other side - the previous check summed the
  already-overridden value and compared it against the ad-set total, the same number twice,
  and could never fire.
- **Whatever set of campaigns a lens shows, every figure in it must cover that same set.**
  The deduplicated reach query was keyed on active campaigns while the lens shows active
  or spent-in-period, so Reach described different campaigns from the Spend beside it.

Checked and correct after the rebuild: all objectives map with no unclassified spend, the
`New_customer` and `Existing_customer` conversions resolve to exactly one each, and the
dashboard's total spend now equals the account total to the krone.

### One number per fact, and one place for it

The KPI strip and the stat cards beneath it described the same metrics and disagreed:
the incremental lens read 74 purchases in the strip and 78 in the card, at the same
time, because the strip summed the daily series while the cards summed the campaign
totals - and the series only carries days Meta returned a row for.

- **The strip exists only on General**, which has no stat row. On every other lens it
  was a strict subset of the cards below it, so it is gone. Two panels that never show
  the same figure cannot contradict each other, which is a stronger guarantee than
  getting the arithmetic to agree.
- **Headline figures come from campaign totals, never the daily series.** The series is
  for drawing shapes. `tests/meta-hero-stats-agreement.test.js` fails if either rule is
  broken.

### Reaching Meta, and saying so when it fails

- `fetchWithTimeout` throws **"Request timed out after 30000ms"** - "timed out", with a
  space. The transient-error list tested for `timeout` and so never matched the one
  error this code raises itself, meaning a single slow call failed the whole snapshot
  with no retry at all. `isMetaTimeoutError` now covers both spellings.
- **The per-request limit is 30s**, not 15s. The ad-set daily query measured 15,009ms on
  this account and failed by nine milliseconds. The function has a 300s budget
  (`vercel.json`), so the per-request limit was the binding constraint, not the
  platform. A timeout gets two retries rather than four, because it has already spent
  its budget before it fails.
- **Any failure to reach Meta falls back to the last cached snapshot**, not just a rate
  limit, labelled with its age and with why the fresh read failed. Where nothing is
  cached the panels are **cleared before** the explanation is written - the failure
  state does not clear them by itself, so "Meta data could not be loaded" used to appear
  above a full set of undated figures.

### New customers is the first-class figure

New customers acquired is what the marketing department is measured on, so the dashboard
is arranged around it rather than treating it as one panel among many:

- The **new-customer panel comes first** in the General overview, above the budget split.
  Budget is the lever you pull once you know what acquisition is doing.
- The **KPI strip leads with new customers and cost per new customer**, each carrying the
  panel's own month-to-date comparison via `buildAcquisitionChange`. Cost runs the
  opposite way, since cheaper is better. That window is month to date against the same
  elapsed days of last month, which is **not** the dashboard's selected range that the
  spend and ROAS badges use, so every badge names its own period in the tile caption.
- The panel draws **new customers per day** with the previous period underneath, on a
  shared day-of-window scale. A count with a change badge cannot distinguish a month
  building steadily from one that died after the first week. The series comes from
  `windowDailySeries`, attached to each preset's `current`/`previous` as
  `dailyNewCustomers`, so switching the panel's period needs no browser date maths and
  no extra Meta request - the daily rows were already fetched for the comparison.
- Both **conversion tables carry New customers and Cost / new** per campaign, read from
  `new_customers_value` on the snapshot row rather than recomputed. Awareness and leads
  keep their own columns: those campaigns are not run against a customer count.
- A day Meta reported nothing for stays **absent from the series, never a zero** - the
  day-aligned overlay wants a gap, and a zero would claim Meta said there were no new
  customers that day.
- Where there is nothing honest to compare, there is **no badge**. On the first of the
  month, or on an account with no `New_customer` conversion, a "0.0% flat" would assert
  that nothing changed.

Panels deleted in this pass, with the user's agreement: Executive brief, Decision buckets,
Decision board and Signals (all four were computed every render and then hidden by the
render itself, and all four were generated advice prose over invented priority scores),
and the Recommended moves panel with its `api/openai/dashboard-agent.js` route. General
also lost its stat row, which restated the budget panel's totals and shares.

Verification here means checking against the live account, not against fixtures. Start the
server with `serve-local.ps1`, log in the way `smoke-local.js` does, and read
`/api/meta/account-snapshot?force=1&preset=last_30d`. **Restart the server after any
server-side change** - it holds the modules in Node's require cache. The account throttles
easily: a forced refresh makes about thirteen paginated Graph calls, and a handful of them
in one session will earn "There have been too many calls to this ad-account" for the rest
of it - which locks out the marketing team's own dashboard too, not just the test.

So budget those refreshes. Get one snapshot, save the JSON, and analyse the file rather
than refetching; poll `?health=1`, which costs a single call, rather than retrying the
snapshot; and never leave a retry loop running against the account unattended. A session
on 2026-09-09 spent the account's whole window this way and could not verify its own work
against live data as a result.

Rate limits are deliberately **not** retried inside a request (`isRetryableMetaError` in
`_snapshot-runtime.js`). They used to count as transient, so each throttled call was
retried four more times against a limit Meta measures in minutes to an hour: five calls'
worth of quota spent per failure, for nothing. Failing fast is also what lets the
stale-cache fallback serve the last good snapshot. Do not fold rate limits back into
`isTransientMetaError`'s retry path.

## Agent workflow for this subsystem

`.claude/workflows/campaign-studio-pipeline.js` is a saved Workflow implementing a scope → build →
test loop for Campaign Studio changes (three roles: Scope breaks a goal into small tasks with
acceptance criteria; Build implements one task at a time — sequential, not parallel, because
`app.js` is a single shared file and parallel builders would race on it; Test independently verifies
against acceptance criteria and real test runs, looping feedback back to Build for up to 3 rounds).
Invoke with `Workflow({name: 'campaign-studio-pipeline', args: {goal: '...'}})`.
