# westpack-meta-control — Campaign Studio notes

Internal Westpack marketing ops app (Meta ads + Klaviyo). This file captures facts about the
Campaign Studio / Campaign Brain subsystem discovered while taking the project over from a prior
AI (Codex/Codex CLI) session, so future sessions don't have to re-derive them. The autonomous
Content Agent that used to sit on top of it was decommissioned on 2026-10-30 (see below).

## Repo mechanics

- No `package.json`, no npm, no `node_modules` at the repo root — this is deliberate, not an
  oversight. Do not add one. Tests run directly with Node's built-in runner:
  `node --test tests/<file>.test.js`.
- Start the local server with `serve-local.ps1`; restart it after backend/api changes.
  `node smoke-local.js` is the local smoke test.
- `app.js` (~680KB) is a single monolithic front-end file. Campaign Studio's UI (drag/drop module
  canvas, carousel card builder, asset library, crop editor) lives inline in it — there is no
  separate front-end module for Campaign Studio.
- Many existing tests, especially UI-adjacent ones (e.g. `tests/campaign-email-editor-usability.test.js`,
  `tests/campaign-studio-draft-store.test.js`), are characterization tests: they `readFileSync`
  `app.js`/`styles.css` and `assert.match` literal regex patterns against the raw source, rather
  than calling exported functions. They catch string/pattern drift, not behavior — keep that in
  mind when a "passing test" is used as evidence a change is correct. Working copies are a mix of
  LF and CRLF files, so a multi-line pattern needs `\r?\n`.
- `tests/e2e/campaign-brain-ui.spec.js` (Playwright) is committed but not runnable from a fresh
  clone as-is: no `playwright` package and no `node_modules` exist at the repo root. The ad-hoc
  `tmp/playwright-runner/` sub-project has its own `package.json` and an installed `playwright`
  (Chromium, WebKit, Firefox). It is gitignored, so it is one `git clean` away from being lost —
  check whether it is there before assuming e2e QA has to be rebuilt. Its `content-agent-ui` spec
  is obsolete since the agent was removed; `studio-decommission-check.js` there is the current
  Campaign Studio check (one page load, Meta/Klaviyo/OpenAI blocked, Asana mocked).
- **Other Claude sessions commit in this same working tree. Never stage anything until you
  commit, and commit with explicit paths.** Their commit takes whatever is in the index. On
  2026-10-30 a `git rm` staged mid-change went out inside another session's unrelated commit,
  without the edits that made it safe: `agent-store.js` still required a deleted file, and
  Klaviyo push, Meta publish-ad, Canva, subscriber history, the campaign overview and the
  Campaign Studio API all returned 500 for about three minutes. Delete with plain `rm`, and use
  `git commit -m ... -- <paths>`, which commits exactly those paths whatever the index holds.
- **The cheapest check that a deploy did not break module loading** is an unauthenticated request:
  a route that loads answers 401 (or its own 405), one whose `require` chain is broken answers 500.
  No login, no quota.

## Campaign Studio architecture

Pipeline: Asana ingestion → assembly → plan → artifact pack → a person edits it in Campaign
Studio → (separately) Klaviyo draft / paused Meta ad. Key files:

- `server/campaign/object.js` — assembles the campaign object from Asana input.
- `server/campaign/brain.js` — plan/artifact prompts+schemas, email compilation entry point.
  Distinct from `api/campaign/brain.js` (the HTTP router that imports and dispatches to it, plus
  `object.js` and `meta-from-master.js`) — easy to confuse, same basename.
- `server/campaign/email-design.js` — server-side compiler (`renderPremiumCampaignEmail`) that
  enforces the locked header/footer/legal/preheader (`email-universal-content.js`) and the
  `westpack-campaign-master-v2` module contract (`email-module-library.js`).
- `server/campaign/meta-from-master.js`, `master-design-dna.js`, `meta-carousel-contract.js`,
  `meta-quality-director.js` — the "Meta from Master" carousel path: Design DNA extraction, UK-English
  5-card structural contract, separate visual Creative Director rubric (90 overall / 80 per-dimension).
  The Creative Director's score is the only quality score Campaign Studio still shows.
- `server/campaign/agent-store.js` — **not** the agent's store any more, despite the name. It is
  the shared persistence plumbing (`redisCommand`, `canUseLocalFile`, `acquireLocalLock` /
  `releaseLocalLock`, `getAgentStoreProfile`) for the Studio drafts, asset library, audit log,
  campaign learning, Canva and Klaviyo subscriber history stores: Redis when configured, an atomic
  local file in development, volatile memory otherwise. The name was kept because eight modules
  import it. Every caller of the local lock passes its own lock file.
- `server/campaign/email-asset-hosting.js` — the single Klaviyo image uploader, used by the
  `host_email_asset` route.

### The Content Agent was decommissioned (2026-10-30)

An autonomous worker picked campaigns up from Asana every hour (QStash schedule
`westpack-content-agent-hourly`), produced email/Meta/blog drafts and ran them through an AI
Quality Director before a person saw them. Over 60 jobs it admitted **one** to review (44
`quality_blocked`, median score 79 against a pass mark of 87); the main mechanical cause was that
campaign photographs were never hosted, so the reviewer kept reporting missing imagery that the
copy-only revision loop could not fix. Meanwhile the team's emails were being made by hand, with
an assistant, and they worked. The user decided to remove it.

Removed: the QStash schedule (deleted), `content-agent-worker.js`, `content-agent.js`,
`quality-agent.js`, `creative-production.js`, the `agent_*` actions on `/api/campaign/brain`, the
`CRON_SECRET` bypass that let the scheduler call that route without a session, the console and
Learning Studio panel that sat on top of Campaign Studio, about 3,000 lines of CSS for them, and
the scripts that operated the agent. `tests/content-agent-decommissioned.test.js` pins all of it.

What stays, and why:

- **Campaign Studio's manual path** — Asana Combo "Create campaign", Meta from Master, HTML
  Master, Manual Brief — is untouched. The console held the *only* button that opened the Studio
  workspace, and `.is-guided-intake:not(.is-manual-workspace-open) .klaviyo-studio-shell` hid the
  workspace until it was pressed; that rule and the toggle are gone, so Studio opens straight on
  its workspace. Removing the console without that rule leaves an empty page — the decommission
  test fails if it comes back.
- **`CONTENT_AGENT_MODEL` / `config.contentAgentModel`** — the subject line writers and editor
  run on it. Do not remove it with the agent.
- **Campaign learning** (`campaign-learning*.js`, `campaign_learning_*` actions) still records
  events from Studio saves and the Klaviyo campaign overview, but nothing reads them any more —
  the worker was the only consumer and the moderation UI lived in the console. Whether to remove
  it is an open decision for the user.
- `audit-log.js` keeps `job_rejected_restarted` in its allowed types so older entries still read.
- Redis still holds the agent's job history under `westpack:content-agent:state:v1` (and
  `:operator-controls`). It was left in place, not deleted; it is a candidate for freeing space
  while the Upstash plan is full.

### Campaign images must be hosted, not merely refreshed

Asana serves attachments from signed URLs that expire within hours, so anything that keeps one —
a saved Studio draft, an asset library record, a draft a human opens days later — ends up pointing
at a dead link. Campaign Studio copies each image into Klaviyo's permanent image library
(`host_email_asset`, which hands Klaviyo the URL via `import_from_url`, so the bytes never pass
through this process) before using it. A URL already on Klaviyo's CDN must pass through untouched;
re-importing it duplicates the library entry.

### A module the producer authored must reach the compiled email

`normalizeEmailSections` (`email-module-library.js`) drops any section whose headline is blank,
and caps the list at four. Both used to happen silently. The producer's schema requires a
`headline` string but an **empty string satisfies it**, so a model with nothing left to say
emits a fourth section that compilation then discards — the locked plan promises four modules and
three are compiled.

- `describeEmailSectionNormalization` returns `{ sections, dropped, authoredCount }`.
  `normalizeEmailSections` is a thin wrapper over it, so existing callers are unaffected.
- `compileCampaignEmailDraft` records `moduleSystem.authoredCount` and
  `moduleSystem.droppedSections` beside the compiled module list.
- The prompt block tells the producer that a blank headline destroys the module and that it should
  deliver fewer, stronger modules instead. The schema was deliberately **not** given a
  `minLength` on headline — the rest of this schema sticks to the subset the structured-output API
  is known to accept here (`enum`, `minItems`/`maxItems`, `additionalProperties: false`), and a
  rejected schema would fail every generation rather than one section.

### The operator's draft lives on the server, not only in their browser

Everything a human did to a campaign in Studio — module edits, carousel card drafts, the chosen
creative route, Meta targeting — used to live only in that operator's `localStorage`. Two people
could not work on the same campaign, an edit did not survive a change of machine, and a cleared
cache lost the work outright.

`server/campaign/studio-draft-store.js` keeps the operator's draft on the shared backends from
`agent-store.js`, one key per campaign rather than one blob for everything.
Keys are `westpack:campaign-studio:draft:v1:<campaignKey>` with a 90-day TTL, and a
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
campaign was pushed to Klaviyo, which paused ad was created in Meta, when a Studio draft was
saved, which Canva designs were created. Nothing else recorded what a human did, so "who sent
this email, and when" had no answer.

Recorded server-side at the moment the thing actually happens — `api/klaviyo/push-template-rollout.js`,
all three ad-creation paths in `api/meta/publish-ad.js` (single image, carousel, video), the
Canva Localizer's generate step and the Studio draft save in `api/campaign/brain.js`. Read it with `GET /api/campaign/brain?action=audit_log`
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

`.env.production` is a stale partial `vercel env pull` from April and does **not** list most of
the production keys. Do not read its absence as evidence that anything is unconfigured. The real
deployment (`https://project-4fcxa.vercel.app`, Vercel project `project-4fcxa`) has Asana and
Redis wired. `vercel env pull` returns "Encrypted" variables with their values but "Sensitive"
ones empty; `vercel env ls production` says which is which.

`GET /api/system/health` reports OpenAI, Meta, Asana and Klaviyo configuration, but nothing about
Redis. For the stores, read the `store` profile that `studio_draft_load`, `asset_library_load` and
`audit_log` each return.

A deploy is confirmed by calling a **new API action**, not by fetching a new server file over
HTTP. Server sources are served statically, but a newly added one can 404 long after the
function itself is live, so the file probe reports failure when the deploy has actually landed.
Deploys observed here took between one and five minutes to answer on the API.

## Test suite status

As of 2026-10-30, `node --test "tests/*.test.js"` (quoted so the shell does not expand the glob —
`node --test tests/` does not work) runs 816 tests: 809 pass and 7 fail, all seven in
`tests/meta-expansion-reach.test.js`. Those seven failed identically before the Content Agent was
removed and have not been investigated. The count drifts as tests are added — re-run the command
rather than trusting the number if it looks stale.

Git history before commit `d56f472` ("Sync full local project state to repo") was squashed on
import, so `git log` per-file is uninformative for chronology before then.

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
(`src/ui.js`). The question is how many people the conversion campaigns reached for the
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
- **The campaign set is every campaign whose Meta `objective` resolves to the `conversion`
  group and that delivered in the rolling window** (`readConversionCampaigns`, via
  `resolveObjectiveGroup` in `budget-allocation.js`) — never names, never
  `attribution_setting`. It used to be "campaigns reporting `incrementality`"; on 2026-09-29
  Westpack moved Conv - 01/02/03 to standard attribution *inside the same campaigns*, Meta
  then reported them as `multiple`, and they silently dropped out of the set. An objective
  does not change when attribution does. `attribution_setting` is still carried per campaign
  as description only.
- **Results are read on Meta's incremental attribution for every campaign.** Every insights
  call that carries `actions`/`action_values` sends
  `action_attribution_windows=["incrementality"]`, and `actionEntryValue` reads each entry's
  `incrementality` key, falling back to `value` only when the key is absent (on-platform
  actions such as leads). `value` is the ad set's own setting and is wrong here. Reach,
  impressions and spend are unaffected. It is still Meta's model, not a lift test — the UI
  says "not a measured uplift".
- **The set still changes under the series** as campaigns enter and leave the window, which
  rewrites completed months. `collectRestatements` records both figures and the reason; the
  anchor also moves once the first delivering month rolls out of the window, which re-bases
  every figure. Snapshots carry `setDefinition: "conversion-objective"`; one without it (the
  old incrementality set) is never reused from cache, and the first sync after the switch
  logs a restatement whose reason names the definition change.
- Cold sync ≈ 24 Graph calls, warm ≈ 7. Rate limits are never retried here.
- **The snapshots live in Vercel Blob, not Redis, once `BLOB_READ_WRITE_TOKEN` is set**
  (`server/meta/historical-store.js`, private store, pathnames under `meta-snapshots/`).
  On 2026-10-21 the Upstash database hit its fixed plan limit and refused reads as well as
  writes, so the tab was blank for days while Meta had the figures. An empty Blob falls back
  to Redis once, and a failing Redis then reads as "no snapshot" rather than an error.

### Audience saturation leads the Expansion tab (2026-10-08)

The user wants Expansion to answer "how much of my audiences am I using up, and where does
the next krone still buy new people", across **every** campaign, as a hand on budget and
audience decisions. `server/meta/audience-saturation.js` builds one row per ad set,
grouped by the market in its targeting, and the tab renders it above the first-time-reach
series (which stays conversion-only and says so).

- **One insights call** at `level=adset` with `time_ranges` returns six ranges per ad set:
  for each of two 14-day periods ending yesterday, the period itself, lookback-start to
  period end, and lookback-start to the day before. New reach is the difference of the
  two cumulative figures (90-day lookback), so it is deduplicated by Meta, never summed.
  The whole sync is about nine Graph calls; it runs inside `?expansion=sync` (nightly, on
  its own try) and alone as `?saturation=sync`. `?expansion=status` returns it for free.
- **A broad ad set has no audience to use up.** Its delivery estimate is a country's
  population, not Westpack's market, so no share is computed and no estimate is fetched.
  Only ad sets with custom/lookalike audiences get `delivery_estimate` and a share.
- **Lookalike expansion and Advantage+ audience make the share approximate.** On
  2026-10-07 `LAL - FR/IT/DE` reached 2.3-3.3x their audience estimate in 14 days because
  `targeting_relaxation_types.lookalike = 1`. That is never read as "saturated"; the row
  says Meta is delivering beyond the audience. `LAL - EU` (expansion off) at 85% is.
- **A launch period is everyone-new by definition**, so the period after it always reads
  as a fall. On the first run that alone marked ten ad sets "saturating" after the
  2026-09-09 rebuild. A previous period counts as a launch when the ad set's reach before
  it was under half the period's own reach (`launchReachShare`) - zero alone failed once
  the windows moved a day past the rebuild. Against a launch only the level is judged.
- **"Reaches, does not convert"** needs 3x the account's own cost per new customer spent
  with none (about a 5% chance by Poisson if the ad set performed like the account), not a
  fixed amount. Awareness rows are judged on their 5-a-week frequency target instead.
- **Awareness is judged on repetition, not on new people.** The user's correction
  (2026-10-08): LAL - EU read "saturated" at 84% of its audience while each person saw
  the ads 1.6 times a week, against the 5-a-week target in
  `brand-awareness-needs-real-frequency`. Coverage plus a low new share is the plan for
  awareness. So an awareness ad set is `saturated` only when covered **and** at or past
  the frequency target; covered below it is `covered` ("Covered, room for frequency",
  with an estimate of the daily spend that would reach the target at today's cost per
  impression); and below the target a falling new share is never "saturating".
- **An objective review (2026-10-08) found the figures sound and the judgement weak**,
  and everything below was fixed in response. Keep it that way:
  - **The rules live in `src/saturation-rules.js`, one copy for server and browser.** It
    is a plain script (`module.exports` in Node, `globalThis.WestpackSaturationRules`
    from a classic `<script>` in index.html, loaded before app.js), so the browser can
    reclassify with exactly the server's rules when a viewer moves a threshold in "Adjust
    the rules". Overrides are per browser (localStorage) and never touch the snapshot.
  - **Frequency per week comes from real weeks** (two 7-day ranges per period in the
    same `time_ranges` call). The old "period frequency / 2" understated it whenever
    audiences rotate: on 2026-10-08 LAL - EU read 1.6 against a true 2.3, and Conv - 04
    3.1 against 4.9.
  - **The budget estimate is only shown where budget is the limit.** The ad set's
    `frequency_control_specs` cap is read (LAL ad sets: 5 per 7 days), and so is last
    week's spend against its own daily budget. LAL - EU spent 81% of its 400 kr., so
    more budget is not the lever there; the row says "Not budget" instead of a number.
  - **Cost rises are read net of the account's CPM change** between the same periods
    (one extra account-level call), so Q4 getting dearer is not read as saturation.
  - **Uncertainty is shown, not hidden**: Meta's audience size is a range and so is the
    share (reach / upper to reach / lower); a status that rests on a range straddling
    its line is tagged "uncertain"; new-customer counts carry a 95% Poisson interval and
    a cost per customer under five customers says "too few to price".
  - **The statuses are signals, not verdicts**, and the card says so. None of the
    thresholds has been validated against an outcome.
  - Meta's `delivery_estimate.daily_outcomes_curve` (spend -> reach) was probed as a
    marginal-return measure and came back as a single zero point on both ad sets tried.
    It is not used. Re-probe before building on it.
- **It is drawn as meters, not a table** (2026-10-08, at the user's request: "mere graf
  baseret ... hvad er det der gør at man fx er saturated"). Each rule that can set a status
  - new share, audience used, weekly frequency - is a meter with its threshold line drawn
  on it, and only the measure that tripped is coloured; the classifier returns that as
  `causes`. Status is never colour alone: each has a CSS shape (circle, triangle, square,
  diamond) and its label. The table stays behind "Show every figure as a table".
  `--wp-warning` is ΔE 1.4 from `--wp-danger` under deuteranopia, so chart fills use
  `--wp-chart-warning` (#c98a1b), validated with the dataviz palette script.
- Every status ships with its reasons, and the thresholds are printed under the table.
- **Only active ad sets are shown, and every active one is** (2026-10-13, the user's
  rule). The filter is `effective_status === "ACTIVE"` in the browser
  (`isActiveSaturationRow`), so a paused ad set or one in a paused campaign drops out;
  the snapshot still holds them. An active ad set under 1,000 people or 500 kr. is drawn
  in its market with the "Too little delivery" status rather than folded away. A
  market's spend is summed from the rows shown, never taken from the snapshot's
  `market.spend`, which includes paused ones; what was left out is counted in one line.
  An active ad set that delivered nothing in the period is not in the snapshot at all.
- `tests/browser-files-parse.test.js` runs `node --check` on app.js and src/*.js. The
  pattern-matching tests pass on a file that does not parse, and a parse error in the
  browser stops the app before even the login form shows.

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
- **Change badges are computed once, on the server, from the two real windows.**
  `buildValueChange` (`api/meta/account-snapshot.js`) is the one rule for every badge;
  the browser renders them and computes none. `src/meta-dashboard-metrics.js` is imported
  by nothing.
- **Date ranges resolve in the ad account timezone** (`America/Los_Angeles`), via
  `resolveTodayInTimeZone`. The account is fetched before `buildDateScope` for this reason;
  do not move that call back.
- **Campaign status is Meta's `effective_status`**, mapped through
  `describeDeliveryStatus`. It was the literal string "Healthy" on every row.
- **Currency falls back to DKK everywhere**, matching the account and
  `budget-allocation.js`. A EUR fallback in the display path once meant kroner could print
  with a euro sign.
- **Every result is on one measurement basis** - see "One measurement basis" below. The
  incremental/standard lens split, the campaign-name tag and the "Meta returns the same
  figures for the incrementality window" warning are gone, and must not come back.
  Asking insights for `attribution_setting` still returns a row for every campaign that
  ever existed (configuration, not a result: 358 rows, 343 empty), so the handler drops
  rows with no spend, impressions, clicks or actions before anything reads them.
- **The data quality panel is visible on every lens**, including General. It used to sit
  inside the section the render hides there, so the first view people open was the one
  that never showed whether its own numbers could be trusted.

### One measurement basis: Meta's incremental attribution (2026-10-01)

Meta attributes a purchase under the attribution setting of the ad set that earned it.
This account has run incremental attribution, 7-day click + 1-day view, and 7-day click +
1-day view + 1-day engaged view side by side, and the mix changed on 2026-09-09 (rebuild
by market) and on 2026-09-29, when DE, FR and IT switched from incremental to standard
**inside the same campaigns** (each now has a paused incremental ad set and an active
standard one, Meta reports the campaign as `multiple`, and the "Inkremental" tag was
taken out of the names). Summing `value` across campaigns therefore added different
measurements together: new customers read +37% August to September where one method in
both months reads +9% (incrementality) or +20% (7-day click), on +72% spend.

- **Every insights query that reads results asks for
  `action_attribution_windows=["incrementality"]`**, and `server/meta/measurement-basis.js`
  normalises each row as it arrives: `value` becomes Meta's incremental figure and the ad
  set's own figure moves to `reported_value`. Every total, lens, comparison and the
  new-customer panel then read one method with no second code path. The team runs Meta on
  incremental attribution by choice, as the conservative reading.
- **Meta does return a separate incremental figure**:
  `{"value":"471","1d_view":"401","7d_click":"70","incrementality":"136"}` for
  Conv - 04 - EU - Standard in September. An earlier version ran two extra queries and read
  `value` from both, so it "verified" that the two were identical and printed that as a
  warning. That conclusion was wrong; do not re-derive it.
- **On-platform actions (`lead`, `onsite_conversion.lead_grouped`, link clicks) carry no
  incrementality key** - they happen on Meta - and keep their reported value. Purchases,
  revenue, add to cart and the New_customer/Existing_customer custom conversions all have
  it, daily and aggregated, back to at least October 2025.
- **One Conversion lens**: every campaign with a conversion objective. Its table shows each
  campaign's `attribution_setting` and "ROAS as reported" (`reported_roas_value`) so a
  figure in Ads Manager can be found here; reported figures are never added into a total.
- **The browser does not classify campaigns.** It used to re-classify by name and overwrite
  the server, so a lens's stat cards and its table could describe different campaigns.
- Expect Conv - 04 - EU's reported ROAS (~37) to sit far above its incremental ROAS (~9):
  85% of its reported purchases are 1-day view-through.

### The account was rebuilt on 2026-09-09

The Meta setup was restructured from product themes to markets. What the dashboard now
sees, and the two defects that surfaced with it:

- **Active conversion:** `Conv - 01 - DE`, `Conv - 02 - FR`, `Conv - 03 - IT` (named
  "... - Inkremental" until they switched to standard attribution on 2026-09-29) and
  `Conv - 04 - EU - Standard`. The old themed
  campaigns (Smykkekunde, Giftpackaging, Forsendelse) are paused but still carry spend in
  a 30-day window, so they stay in the lens.
- The incremental/standard classification that this section used to describe (name tags,
  their spelling, Meta's attribution setting deciding a lens) was removed on 2026-10-01 in
  favour of one measurement basis. See above.
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

### What each part of the Meta setup is for (2026-10-13)

The campaigns do different jobs, and each must be judged on its own job. Getting this wrong
produces a confident "biggest inefficiency on the account" verdict that the user has
explicitly rejected.

- **Conv - 04 - EU - Standard is the profit engine.** One broad English ad set across Europe,
  ~3,800 DKK/day from 13 Oct 2026, ~770 DKK per incremental new customer. This is where
  Westpack makes money, and it is judged on cost per new customer and marginal cost of each
  budget step (8-week windows; CPM-adjusted through Q4).
- **Conv - 01 DE, 02 FR, 03 IT are a deliberate market-entry investment**, in the local
  language, ~2,400 DKK/day each, ~4,000–7,000 DKK per incremental new customer. The user runs
  them knowing they are less efficient: "Det handler om at komme ind på markedet. En
  investering og forhåbentligt hopper de på." The EU campaign's profit funds them. Never
  recommend cutting or merging them on cost-per-customer grounds, and never compare them with
  the EU campaign as if they had the same job. Judge them as an investment instead: the trend
  in Magento first-time buyers per market (all channels, not only Meta-attributed), repeat
  purchases by customers acquired there, branded search per country, and the rolling 8-week
  trend in Meta cost per new customer — against a budget envelope and checkpoints agreed in
  advance. Repeat value by first-order market has never been measured; it is the number that
  decides whether the investment pays back.
- **BA - Reach (awareness, ~30% of spend) is a brand bet with no direct attribution.** It is
  judged on reach/frequency in the audience, branded search and blended cost per new customer,
  ideally via a pre-registered geo test — see `knowledge/meta-research/00-awareness-and-budget-split.md`.
  Ad set budget sharing is on, which moves up to 20% of DE/UK/EU awareness budget to FR/IT.

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
- **Change badges compare completed days only, over equal windows.** On 2026-10-01 "This
  month" read spend as -84% "vs previous day": a few hours of today against all of
  yesterday. `resolveCompletedDayComparison` drops today from the current window and sizes
  the previous one to match; a range that is only today gets no badge.
- **Rolling presets end yesterday**, as Ads Manager's do (`buildPresetRange`). Only
  "Today" and "This month" include the day in progress, and pace on those uses finished
  days only - with none yet, there is no pace, rather than 0%.
- **One rule for badges** (`buildValueChange`): no badge for an undefined rate
  (`computeAggregateMetric` returns NaN, not 0, when the denominator is empty) or for
  zero against zero; "New" is neutral; spend is neutral. Reach and frequency carry no
  badge, because the only per-day reach is summed daily reach.
- **The previous window includes campaigns that have since been paused**
  (`buildPreviousOnlyCampaigns`). Without them a restructure read as growth. They feed
  comparisons only - never a table or a current total.
- **Today's new customers ride the strip's cache, not the finished days'.** Finished
  windows are cached for 3 hours because they barely change; today used to ride along in
  that cache, so the panel read 0 new customers under a strip reading 4. Both the window
  totals and the daily chart rows fetch anything that includes today separately, on the
  15-minute insights cache. `tests/meta-completed-day-comparison.test.js` and
  `tests/meta-acquisition-window-totals.test.js` pin it.

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
- **A period's new-customer figure is never a sum of days.** Meta's incremental figure is
  a model evaluated per query, so it does not add up: measured 2026-10-07, 1-6 October
  read 37 from the six daily account rows, 39 for the account asked as one period and 40
  from the campaigns asked as one period (September: 103 / 101 / 100). The panel and strip
  used to print the daily sum while the campaign tables printed the period figures, so
  the tables never added up to the headline. The rule now: **every period figure is the
  campaigns' own Meta figures for that period, summed** - the same basis as every table
  and every other total. `fetchCustomerAcquisitionWindowTotals` reads every window the
  panel, today and the strip's badges need in one `level=campaign` call with
  `time_ranges` (`listAcquisitionWindows` builds the list), split into a 3-hour cache for
  finished windows and the 15-minute cache for windows that include today.
  `indexWindowTotals` sums them per window. Without window rows the panel reports the
  figures as unavailable; there is no fallback to summing days.
  `tests/meta-acquisition-window-totals.test.js` pins this with the real October figures.
- The **KPI strip leads with new customers and cost per new customer** for the selected
  range: `customerAcquisition.newCustomers`, the campaign rows for the range, so the
  per-campaign tables add up to it exactly. Their badges compare the same finished days
  as Spend and ROAS beside them (`rangeComparison`, `buildAcquisitionRangeChange`), each
  side read as a window. Month to date against the same days last month lives in the
  panel, which names its window.
- The panel draws **new customers per day** with the previous period underneath, on a
  shared day-of-window scale. A count with a change badge cannot distinguish a month
  building steadily from one that died after the first week. The series comes from the
  account's daily rows (`fetchCustomerAcquisitionTrend`, `windowDailySeries`) and is
  **only** for drawing; the chart says under it that the days do not add up exactly to
  the period total.
- The Expansion tab's new customers cover **conversion campaigns only** and say so on the
  tile, because the Performance tab's figure counts every campaign and is always higher.
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
also lost its stat row, which restated the budget panel's totals and shares. On
2026-10-01 the Campaign pulse ("Scale", "Cut waste", "Stop bleed" over hand-weighted
scores) went the same way, and the Data quality panel was cut to trust state, data source,
spend reconciliation against the account total and warnings.

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

## The design system owns how this product looks

Reworked 2026-09-18, when the app stopped being one person's tool and started being rolled
out across the company. The standing rule for anything visual from here on: **there is one
source of truth, and it is `design-system.css`.**

### How the two stylesheets fit together

- `styles.css` (18k lines) is wrapped in `@layer wp-legacy { ... }`. `design-system.css` is
  **unlayered**, so every property it declares beats the legacy sheet regardless of how
  specific the legacy selector is. That is the whole mechanism: it is what let one palette
  and one set of primitives take over the app without rewriting the layout work.
  `index.html` must keep loading them in that order. `tests/design-system.test.js` fails if
  either half comes apart.
- Consequence to remember: an `!important` inside the layer still beats an unlayered
  `!important`, because layer order reverses for important declarations. There are about
  twenty of them and none currently conflicts, but that is where to look if an override
  mysteriously does not apply.
- The legacy `:root` block no longer holds colours. `--accent`, `--line`, `--surface`,
  `--muted` and the rest are **aliases** onto `--wp-*` tokens, so the hundreds of legacy
  rules that read them follow the system automatically.
- New styling goes in `design-system.css`. `styles.css` is edited only to delete something
  the system now owns, or to fix a layout rule with no home in the system.

### What the system is

Tokens (colour, type, space, radius, elevation, motion), then `.wp-*` components: button,
icon button, input/select/textarea, field, check, badge, status, delta, card, metric strip,
data table, pagination, toolbar, search, filter chip, tabs, segmented control, empty/error/
loading/partial states, alert, modal, drawer, menu, tooltip, chart container, and the app
shell. `design-system.html` renders all of it and loads **only** `design-system.css` — if
that page needs a rule from `styles.css`, the rule belongs in the system and has not moved
yet.

Decisions worth not re-litigating:

- **Brand is `#34453F`, used as an accent, not a theme.** It marks the primary action, the
  current page and the focus ring. The interface is otherwise neutral grey. The old cream
  and crimson identity is gone from both stylesheets and the test asserts it stays gone.
- **One typeface, IBM Plex Sans.** Space Grotesk was dropped; headings earn their place
  through size and weight. Numerals are tabular everywhere.
- **Radius collapses to 4/6/8/12px plus pills.** It was 26 distinct values.
- **Depth comes from borders and surface contrast**, not shadows. Shadows are only for
  things that genuinely float: menus, modals, drawers.
- **Metrics share one bordered strip divided by hairlines**, not a row of floating cards.
  `.stats-grid` / `.stat-card` are retargeted onto that.
- **Three dark panels, all deep green**: new customers, budget split, expansion reach. That
  is a hierarchy decision (new customers is the KPI the department is measured on), and
  `tests/meta-panel-contrast.test.js` enforces that a light-text panel keeps a dark
  background. Nothing else in the product is dark.
- **A previous "Premium dashboard pass"** — about 600 lines of id-scoped overrides under
  `#meta-product-panel` / `#dashboard-panel`, plus a 420px radial wash and a rainbow rule
  across the header — was deleted. Do not reintroduce a second design pass scoped to one
  screen; fix the component instead.

### Navigation: both platforms, always visible

The old header had a workspace toggle, so half the product (Klaviyo, or Meta) was invisible
unless you already knew it was there. The rail now lists **Meta ads** (Performance, Create &
manage ads) and **Klaviyo email** (Overview, Duplicate & translate, Template AI, Campaign
Studio) at the same time.

- Existing handlers are untouched. Each nav item carries `data-nav-workspace`, and a
  delegated listener registered **before** the per-button handlers sets the workspace first;
  otherwise `setWorkspace` re-applies the previously active Klaviyo view and undoes the click.
- Only the group matching `body[data-workspace]` may render as current, enforced in CSS so
  it cannot drift.
- **Template AI was orphaned**: `campaign_ai` was a valid view with no way to reach it. It is
  in the rail now.
- `syncKlaviyoNavigation` was missing `campaign_brain` from its supported list, so every
  render of the Klaviyo workspace reset the state to the overview while Campaign Studio was
  still on screen. Fixed in `src/klaviyo-dashboard-domain.js`.

### Page structure

Page header (title, one line of context, page actions) → toolbar (filters, one control
height) → content. `switchTab` writes both the title and the description from
`META_VIEW_COPY` in `src/ui.js`, and hides the dashboard toolbar on the ads screen, because a
date range that scopes nothing is worse than no filter. `.topbar-sub` was `display: none` in
the legacy sheet, so every screen had lost its one sentence of context; it is visible again.

The `#openai-status-pill` used to be the literal string "OpenAI ready", set in markup and
never updated — it claimed a working connection whatever the truth was. `renderSettings` now
writes the reported status into it.

### Verifying visual work

Log in for real. `startApp()` only runs once authenticated, so removing `auth-locked` from
the body gives you inert markup and every screenshot is a lie. Start the server with
`AUTH_PASSWORD` set in the environment (it takes precedence over the config file) and log in
through the form.

`tmp/playwright-runner/ds-review.js` screenshots every screen and viewport from **one** page
load — reloading per screenshot spends the marketing department's Meta quota, and this
session hit the rate limit doing exactly that. Re-read the rate-limit warning in "What the
dashboard is allowed to claim" before running anything against live.

## Canva Localizer — what Canva actually exposes

Added 2026-09-21. One campaign graphic becomes one Canva design per market, translated, named
`campaign_DE` and exported for email. Before changing anything here, read this section: most of
the design is forced by limits in Canva's API that are not obvious and are easy to "fix" by
building something that cannot work.

Verified against Canva's published OpenAPI spec (`https://www.canva.dev/sources/connect/api/latest/api.yml`,
api version `2024-06-18`). Re-download it rather than trusting this summary if the answer matters.

### The three limits that shape everything

- **There is no element or layer API in Canva Connect.** The only text the REST API can see is
  text a designer tagged as an *autofill data field*, using the **Data autofill** app inside the
  Canva editor. `GET /v1/designs/{id}/dataset` lists those fields. Untagged text is invisible and
  can never be overwritten — which is why brand names, logos and URLs are excluded by simply not
  tagging them, and why the "exclude from translation" requirement needed no enforcement
  mechanism. Tagging is a one-time job per master design.
- **The dataset returns field names and types only — never the current text.** `{"headline":
  {"type":"text"}}` is the whole answer. So the source text cannot be read from the design over
  the API. The operator types it once, and `server/canva/design-vision.js` can pre-fill it by
  running a vision model over a PNG export. That is OCR, it is labelled as OCR everywhere it
  surfaces, and `tests/canva-localizer-ui.test.js` fails if the label is removed.
- **Nothing exposes font size, text box geometry, line count or overflow.** "Reduce the headline
  from 42px to 38px" cannot be built on the Connect API at all. Fit is therefore controlled in
  the *translation* — every field carries a character budget derived from its source length, and
  the model is asked for a compact alternative it can fall back to — and then *observed* on the
  rendered result. The character flag is a prediction and says so; `inspect_fit` renders the
  generated design and reports what is actually on the page.

### Autofill is gated on Canva Enterprise

`POST /v1/autofills` — the only way to write text into a design over REST — requires the
connected user to be in a Canva Enterprise organisation. Paid plans get a limited development
trial only. Everything else works on Pro: OAuth, listing and reading designs, reading the
dataset, and exporting.

This is read from the account itself rather than assumed: `GET /v1/users/me/capabilities`
returns `autofill` when the plan allows it, it is stored with the tokens at connect time, and
`handleGenerate` refuses up front with that specific message. Do not replace that with a generic
error — the failure mode it prevents is an operator discovering the restriction as eighteen
identical 403s after tagging a design.

### Files

- `server/canva/connect-client.js` — the REST client. Rate limits (429) are deliberately **not**
  retried, same rule as the Meta snapshot path; 502/503/504 get two retries. Async jobs
  (autofill, export) poll with exponential backoff.
- `server/canva/token-store.js` — OAuth tokens on the usual three backends, reusing
  `agent-store.js`'s plumbing. Canva's refresh tokens are **single use and rotating**, so the
  refresh runs under a real lock and re-reads the store after acquiring it; a refresh Canva
  rejects clears the connection rather than leaving a dead pair that fails forever. It also
  holds the PKCE verifiers between the authorize redirect and the callback.
- `server/canva/localization.js` — the pure domain: markets, language grouping, character
  budgets, fit grading, job state. No I/O, and it carries most of the tests.
- `server/canva/localization-store.js` — jobs, one Redis key each rather than one blob, so two
  languages finishing at once cannot lose each other. Also the recurring-exclusion memory.
- `server/canva/translate-fields.js` — reuses the existing glossary and Westpack knowledge prompt
  blocks. One call per language covering all fields at once.
- `api/canva/oauth.js` — both halves of the OAuth flow on one URL, because Canva matches the
  registered redirect exactly. The callback does **not** require the dashboard session: the
  session cookie is `SameSite=Strict` and is not sent on the cross-site navigation back from
  canva.com, so the single-use server-side `state` is what protects it.
- `api/canva/localizer.js` — `?action=` dispatch. Every batch action persists after each target,
  catches per target, and stops at a 210s soft deadline reporting what is left; the client just
  calls again, so continuing and starting are the same request and there is no separate resume
  path to get wrong.
- `src/canva-localizer.js` + the `klaviyo-canva-localizer-panel` section in `index.html`.

### Rules that are load-bearing

- **`create_from_design`, never `update_design`.** The autofill API can edit a design in place;
  this feature must never do that, because the source is the operator's master. The route test
  asserts `update_design` appears nowhere in the API layer.
- **Markets that share a language are translated once.** UK, US and EU are all English: three
  designs, one translation. Three separate translations would also drift from each other.
- **A batch of eighteen is never one pass/fail.** `partial` is a real state, and a retry
  regenerates only the failures — regenerating the successes would leave orphaned duplicate
  designs in the shared Canva account.
- **A translation that returns no fields is a failure.** Marking it translated would send the
  Danish original into Canva under a German name and look like a success.
- Export links from Canva die after **24 hours**, and the UI says so.

### Setup this needs before it can do anything

`CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET` from a Canva developer app
(https://www.canva.com/developers/), with `https://project-4fcxa.vercel.app/api/canva/oauth`
registered as an authentication redirect URL and the four scopes granted (`design:meta:read`,
`design:content:read`, `design:content:write`, `profile:read`). `CANVA_REDIRECT_URI` is optional
and only needed if the app is reached on a host other than the registered one. Until those are
set the page says so plainly and every action is refused with the same message.

### The Apps SDK is the Phase 2, not the architecture

Canva's **Design Editing API** (Apps SDK) *does* expose full element read/write including font
size, position and colour — but only to code running inside the Canva editor as a Canva app. It
cannot be driven from this dashboard. It is the right way to add real font-fit correction later,
as a small Canva-side companion app that talks to this backend. Browser automation against the
Canva editor is not an option worth revisiting: the editor is a canvas application, so there is
no stable DOM, and it would fail by producing wrong artwork rather than an error.

## Subject line generator — Klaviyo email → Subject lines

Added 2026-10-27 at the user's request ("emnelinje generator i biblen" - "biblen" is this app, once
"Mads' bibel"). Choose a Danish template from the DK account (the same 20-template list Duplicate &
translate offers), read the brief the analysis makes of it, then write subject line + preheader pairs
from three layers. `api/klaviyo/subject-lines.js` (`?action=` status / analyse / generate / check /
history / bank / team / sync_history), `src/klaviyo-subject-lines.js`, `server/klaviyo/subject-line-*.js`.

### What Klaviyo exposes (verified against the live accounts 2026-10-27)

- Subject, preheader and sender label ("Ida/Jette/Louise fra Westpack") are on the **campaign
  message**: `GET /api/campaigns/?filter=...&include=campaign-messages`, `attributes.content.subject`
  / `preview_text` / `from_label` on revision 2024-10-15. 100 campaigns a page.
- ~7,050 sent subject lines across 18 accounts since September 2021 (DK 775, UK 747, NL/DE/EU ~520,
  most others ~420; CZ/HU/SK one each). **~500 A/B tests of a subject or preheader**, almost all in
  DK, UK, DE, NL and EU, and almost all from 2021–2023.
- `campaign-values-reports` cannot tell A/B arms apart (one row per campaign), allows at most **one
  year** per request ("Passed in timeframe is greater than 1 year") and throttles after two calls.
  Not used here.
- **Event aggregates can.** `metric-aggregates` grouped by `$message` (= campaign id, not message
  id) and `$variation` (= the A/B arm's message id; empty for a single send) gives Received/Opened/
  Clicked per arm. A third dimension `Bot Click` removes link scanners. Three calls per year per
  account. Klaviyo exposes **no** machine-open (Apple MPP) dimension - "Apple Privacy Open",
  "Machine Open" etc. are all refused.
- Listing every sent campaign with its messages is what a sync spends its time on, not the
  aggregates. The first production sync (2026-10-27) took two calls, 199 s and 181 s - and the second
  re-read every account although only the current year's figures were needed. So a sync now lists
  only campaigns `updated_at` since the last one (three days' overlap) and merges them over the
  stored rows; the full list is re-read once a week (`fullListAt`). Only the current year's
  aggregates are re-read (plus last year in January). The route starts no new market after 120 s.

### How the figures may be read

- Open rates are 55-70% because Apple Mail and Gmail's proxy open mail nobody read. Every send is
  scored as an **open index** against its own market's median in the ±45 days around it (1.00 =
  typical), never as a raw rate. Inside an A/B test the inflation hits both arms alike, so the
  difference is real: A/B tests are the strong evidence, judged by a two-proportion z-test (`klar`
  ≥ 1.96, `tendens` ≥ 1.28, else `uafgjort`). In DK 9 of 98 subject tests are clear; most lists of
  ~800 cannot separate two good lines.
- Klaviyo sends the winning arm on to the rest of the list, so a much larger arm mixes the test with
  a later send (`includesRemainder`). Shown on screen and in the prompt.
- Surface features (question, emoji, length, number) move DK's median open index by less than ±3%;
  a discount in the subject goes with a click index of 1.6. Correlation only, and labelled so.

### Three layers, and what each is allowed to claim

1. **History** - measured. Stored in Vercel Blob (`klaviyo-snapshots/subject-line-history.json`, via
   `server/meta/historical-store.js`), not Redis, which has been full since 2026-10-21.
2. **Pattern bank** - `knowledge/subject-lines/` (16 mechanisms, 11 campaign types). ~2,000 pairs
   **authored** for the bank (Danish-first), plus real lines other brands sent, **collected** from
   Really Good Emails within its robots.txt (category listings and sitemap email pages; `/api/` is
   disallowed and never touched), plus lines the team **imports** from its own inbox on the screen.
   None is measured, and every line says which kind it is. Retrieval gives real lines about half of
   each mechanism's slots. **Milled is not collected**: its robots.txt disallows ClaudeBot and AI
   agents by name, it 403s bots, and its archive is its product - the user asked to bypass it on
   2026-10-27 and was told no. Refresh: `tools/collect-rge.js`, `tools/tag-collected.js`, then
   `tools/build-bank.js` (see the README there).
3. **Rules** - `server/klaviyo/subject-line-rules.js`: the standing corrections (no eco claims, no
   free samples, production time not delivery, no single deadline date, no five stars, no watch boxes,
   never talk down) plus numbers/claims that must appear in the email itself. Written into the prompt
   *and* run over every candidate; a blocked candidate stays on screen, last, with the reason.
   Patterns use Unicode letter boundaries - `\b` treats æ/ø/å as non-letters.

### What wins for Westpack - the mechanism record (2026-10-27)

Westpack's own lines are tagged with the bank's mechanisms (`server/klaviyo/subject-line-mechanisms.js`,
tags in Blob `klaviyo-snapshots/subject-line-tags.json`, keyed by message id): every arm of every
subject/preheader A/B test in all markets (1,006 arms) and DK's sends. An A/B test whose two arms
used different mechanisms is a head-to-head - 258 in production. **The finding is that there is no
finding**, and three traps had to be closed to see it - do not reopen them:

- **A test translated into five markets is one experiment.** Per head-to-head "Konkret værdi" won
  54 of 87 (62%); per distinct test (`familyKey`) 20 of 34 - no pattern. Verdicts (`signal`) are a
  sign test on distinct tests only.
- **The model's tags are fuzzy.** One tagging said offer-led lines lose on opens (5 of 25 distinct
  tests, z = -3.0); a second tagging of the same lines said 8.5 of 24 (z = -1.4). Read from the
  words of the line (`buildOfferCheck`: %, rabat, spar, tilbud and their DE/NL/EN forms), an offer
  against no offer is **8.5 of 19 distinct tests on opens and 28 of 58 on clicks - no difference**.
  The tagger had called weak offer lines "tilbud" and strong ones "konkret værdi". This was briefly
  reported as a robust result on 2026-10-27 and then retracted.
- **DK sends outside tests** show flat open indexes (0.98-1.08) for every mechanism: Apple MPP.

So the writer is told about a mechanism only if its record is significant (none is), and otherwise
that the house's tests do not pick a mechanism; the offer check is told as is. Lists of a few
hundred simply cannot separate two decent lines - the value of the generator is range, quality and
the rules, and its own outcome record (below) is what will eventually say whether it helps.
Tagging runs at temperature 0. New lines are tagged by the nightly sync (200 a night);
`?action=tag_history` catches up in chunks of 600.

### The generator's own record

Copy, Save and "Use in Duplicate & translate" are recorded (`op: record_use`, team doc `used`).
`server/klaviyo/subject-line-outcomes.js` pairs each recorded line with a DK send from a day before
to sixty days after - same words (emoji ignored) or a near match (≥75% of the words, "edited before
sending") - so the screen and the writer's prompt can show how the generator's own lines did. The
first such pairs can only appear after a campaign written with it has been sent and synced.

### Simple out of the box (2026-10-27)

The user's standing direction for this screen: "pisse godt out of the box", simple, work on
functionality - not more analysis on screen. So:

- **One click.** Choosing a template reads the email and writes; there is no Analyse step. The
  brief lives in a closed "Brief and steering" panel below the lines (mechanisms, count, note,
  "Read the email again"). Restored work for a template shows at once instead of re-running.
- **The writer's three picks and an A/B pair come first** (`picks`/`abTest` in the schema,
  `resolvePicks` swaps a pick that breaks a rule for the next line that passes), then the rest as
  inbox rows. Default 12 lines; "Write new ones" adds more without repeats.
- **Quality over speed** (the user, 2026-10-27: "Jeg er ligeglad med hvor lang tid det tager hvis
  outputtet er derefter"). Writing used to reason on "low" for a 45 s click-to-lines; that is
  superseded by the pipeline below. Click to lines is now ~3 minutes, shown as stages with a clock.
- **Only real problems mark a line.** Length (42-60 characters) and a series name are notes on the
  line's detail (`NOTE`), not "check"; over 60 characters still warns.
- The statistics moved to the bank's last tab ("Statistics"); the bank opens on Westpack's sends.

### The writer knows the whole bank, not just what it is shown (2026-10-27)

The writer is shown 24 of the bank's 5,340 lines per run, so on its own a bigger bank changed
almost nothing. The user asked how the generator gets *all* of that knowledge. Two parts:

- **A playbook in every prompt.** `knowledge/subject-lines/playbook.json` (`tools/build-playbook.js`)
  is every line of each mechanism read by the strong model and distilled into 8 constructions: a
  formula with placeholders, why it is opened, when it fits, how it goes wrong, and 1-3 real lines
  that use it. `server/klaviyo/subject-line-playbook.js` puts the brief's three mechanisms in full
  and the other thirteen as one line of formulas (~20k characters). Measured on one brief, it adds
  a few seconds at most to writing; run-to-run variance is larger.
  - **No model-written example lines in it.** The first version had them; they copied library lines
    nearly word for word and invented facts ("kundeservice har åbent til 18"). A cited line must
    exist in the bank or it is dropped, and a pattern with none is dropped.
  - **The build refuses the fallback model.** At the app's 130 s timeout four mechanisms quietly fell
    back to gpt-4.1, which wrote "utbytte" and cited only lines written for the bank. The build
    allows 290 s and fails a mechanism answered by anything but `CONTENT_AGENT_MODEL`.
  - The strong model's lists sometimes run on in the last item (the rules pasted back in English,
    glued sentences, "*REMOVE*"). Items over 200 characters are dropped (`--tidy` reruns that alone).
- **The lines shown are the closest in meaning.** `server/klaviyo/subject-line-semantic.js`: every
  bank line has a text-embedding-3-small vector (256 dimensions, one signed byte each, 1.3 MB in
  `pattern-bank.vectors.bin`, ids in `.vectors.json`, built by `tools/build-embeddings.js` and
  bundled via `includeFiles` in `vercel.json`). Each run embeds the brief and the team's imported
  lines in one call (~0.3 s). Within each mechanism's slots lines rank by similarity plus a small
  bonus for the brief's campaign type, with a redundancy penalty against lines already chosen in
  any mechanism; "Write new ones" moves to the next lines in that order. Tag scoring is the fallback
  when the file is missing or stale, or the call fails; the response says which (`retrieval`).
  - **Series names stay out of the query.** "Monaco" and "Grand Prix" pulled in Formula 1 lines.
    Danish nouns are lower case, so a capitalised product is a name and is left out.
  - Rebuild order when the bank changes: `build-bank.js`, then `build-embeddings.js` (the vectors
    are checked against the bank's ids and ignored if they do not line up, and a test fails), then
    `build-playbook.js`.
- Tests: `tests/klaviyo-subject-line-knowledge.test.js`.

### Two writers, an editor, no ceiling (2026-10-28)

Chosen by a blind comparison on three live DK campaigns (W45 Lux, W46 Under luppen, W45 Grand
Prix), four pipelines with the same brief, email and evidence: A one writer on low (what shipped
before), B one writer on high, C two writers on medium (each shown different bank lines) and an
editor on high, D two writers on low and the editor. A judge on gpt-5.6 high ranked the four
under shuffled letters, twice per campaign, checking every claim against the email; a separate
blind human read agreed on the two campaigns it covered. Mean rank over eight judgements: **C 2.00**,
B 2.13, D 2.50, A 3.38. C won two campaigns outright and was never last on average; B won Lux (the
"117 gram / Oxford" angle) but came last on Grand Prix, where it and A left 3-5 lines breaking the
rules while both editor pipelines delivered twelve clean ones. The margin between C and B is small;
the margin over A is not. The scripts and results are not in the repo; rerun a comparison like it
before changing the pipeline again.

- **The writers and the editor run as OpenAI background jobs** (`background: true`,
  `startStructured`/`readStructured`), and the screen polls `?action=poll` every 4 s. The editor
  on high ran past 280 s in three of nine calls during the comparison, so inside one Vercel
  function (300 s) it failed a third of the time. A pending poll is two cheap reads from OpenAI;
  only a finished job reads the template and history to run the rules.
- Actions: `generate` starts the two writers and answers at once (`jobs`, `examples`); `poll` with
  `kind: "write"` returns the drafts, finalised and checked; `edit` starts the editor over them;
  `poll` with `kind: "edit"` returns the final set. Every request carries the brief, so no step
  depends on another having run on the same server instance.
- **No silent weaker model.** `requestStructured` takes `fallbackOnTimeout`; writing and editing pass
  false, so a slow strong model fails openly instead of handing over gpt-4.1 lines. Only an
  unavailable model moves on to the next one.
- The rules' verdict on each draft is recomputed on the server before the editor sees it; the
  editor is told a draft marked RULES must be fixed or dropped. If one writer fails the other's
  drafts still go to the editor. If the editor fails, the screen shows the drafts and says plainly
  that they are unedited.
- The judge does not know the sender label, so it flagged "Jette" as invented. DK's label really is
  "Jette fra Westpack" (`senderLabel`, the most common recent `from_label`). Give a future judge the
  sender.
- Tests: `tests/klaviyo-subject-line-quality.test.js`.

### Other decisions

- The analysis runs on the default model (`OPENAI_MODEL`, ~10 s); writing runs on
  `CONTENT_AGENT_MODEL` (gpt-5.6) - see above. The strong model ran past 130 s on the analysis
  alone, and the analysis was not part of the comparison.
- A full page load of the app also loads the Meta dashboard snapshot, so browser tests of this
  screen spend Meta quota too - test with one page load, or with fixtures injected into
  `__subjectLinesInternals.state` (see `tmp/playwright-runner/subject-lines-design.js`).
- "Read the email again" fetches the template fresh; writing reuses a 10-minute cache.
- "Preview in the other markets" (`?action=preview_markets`) translates just the pair into the 12
  other languages with the glossary, one call, ~5 s, and shows each against the iPhone cut. The
  rollout translates again with the whole email; this is a look before committing.
- The brief and suggestions for a template are kept in the browser (`localStorage`, last 10
  templates, try/catch) and restored when it is chosen again. Shared state stays on the server.
- Duplicate & translate shows the chosen subject line under its source picker, with a way back to
  the template name.
- Rationales and the analysis' evidence text get model-written ids (`[ab:…]`, `(pb-…)`, `rg-…`)
  replaced by what they point at, and a cited A/B test can be opened on the suggestion itself.
- A Klaviyo template has no subject line. Duplicate & translate used to translate the template's
  **name** as the subject. "Use in Duplicate & translate" sets `appState.klaviyoTemplateSubjectOverride`
  for that one template, so the rollout translates the chosen pair into every market.
- Read-only towards Klaviyo; the only POST is the metric-aggregates query.
- Tests: `tests/klaviyo-subject-line-{rules,history,bank,generator,knowledge,quality}.test.js`,
  `tests/klaviyo-subject-lines-ui.test.js`.

## Model JSON output can carry NUL characters

Added 2026-09-24, from an operator report that duplicating and translating a Klaviyo campaign
sometimes failed for some languages with **"null characters not allowed"**.

That message is Klaviyo's, passed through verbatim by `klaviyoRequest` (which surfaces
`errors[0].detail`). Klaviyo's API is Django/DRF, whose `ProhibitNullCharactersValidator`
rejects any string field containing U+0000, so one stray NUL fails the whole template create for
that market while the other languages go through.

The NUL comes from the model, not from Klaviyo and not from the source template. GPT-4.1 — the
default `OPENAI_MODEL` here — corrupts non-ASCII characters in structured JSON output on long
inputs: it emits `\u0000dc` where it meant `\u00dc`, so `JSON.parse` yields a NUL followed by
the two hex digits (openai/openai-go#664). Email templates are comfortably past the ~10KB where
this starts, and the languages that carry accented characters — DE, FR, ES, and Danish æ/ø/å —
are the ones exposed. English almost never trips it, which is why it looks intermittent.

- The repair runs on the **raw JSON text before parsing**, in `server/lib/model-json.js`
  (`repairModelJsonText` / `parseModelJson`). Stripping the NUL after parsing is not equivalent
  and is worse than the error: it leaves the hex digits as literal copy, so "Überraschung" ships
  as "dcberraschung" and nothing raises.
- It is wired into every place that parses model JSON: `api/openai/klaviyo-translate-template.js`
  (both the translate and the variant path), `api/openai/klaviyo-agent.js`,
  `api/openai/generate-ad-copy.js`, `server/campaign/brain.js` (which covers
  `api/campaign/brain.js`), and both Canva callers.
- `stripNullCharactersDeep` is the last guard inside `klaviyoRequest`
  (`api/klaviyo/push-template-rollout.js`), so a NUL from any other origin costs one character
  rather than the market's whole template.
- `tests/model-json-null-characters.test.js` pins the repair, the escaped-backslash edge case and
  the fact that every parse path and the Klaviyo write path are wired to it.

## What Duplicate & translate actually sends to the model

`extractHtmlSegments` (`server/lib/klaviyo-template-variant.js`) cuts the email into fragments:
the text between two tags, plus — since 2026-10-29 — the values of `alt`, `title` and
`aria-label`. Until then every alt text reached every market in Danish, and Outlook shows alt
text while images are blocked, which is its default for most senders. Writing an email for the
rollout means writing for these rules:

- **A fragment holding a Klaviyo tag (`{{`, `{%`) is skipped whole.** Fallback copy inside an
  `{% if %}` therefore needs its own element — `{% else %}<span>Dit navn</span>{% endif %}` — or
  it ships in Danish everywhere.
- **`translate="no"` (or `class="notranslate"`) protects an element and its attributes.** Use it
  on a series name that stands alone (a button, a column head): "Vienna" on its own has no
  context saying it is a product, and is Wien in German. The prompt also tells the model to keep
  city-named series names as written inside sentences.
- Attribute values go back escaped for their own quote character. `tests/klaviyo-translation-integrity.test.js`.

## What Westpack's own website says — `knowledge/westpack-site/`

Added 2026-09-30. A crawl of the whole UK English store (2,491 products, 322 content and category
pages) lives in `knowledge/westpack-site/`, with a distilled `README.md` on top: company facts,
the offer (clichés, MOQs, samples, delivery, reviews), the carrier-bag range with sizes and logo
areas, and which claims are safe to put in an ad. Read that README before writing ad or email
copy about Westpack, rather than inventing USPs. Two claims that sound right and are not:
samples are **not** free (freight, plus a small charge per logo sample), and logo print is
included only on jewellery boxes. Refresh with the two scripts in `tools/`.

## Kevin ROIberg, the high-season email character — `knowledge/kevin/`

Added 2026-10-29. Kevin is the recurring character in Westpack's Christmas emails (seven DK sends
2025–2026, each rolled out to 12 markets; four more planned W46–W49 2026). `knowledge/kevin/README.md`
is the canon, voice, "how crazy" scale, the user's direction on Kevin drafts, formats, what the click
data says and a recipe; `knowledge/kevin/emails/` holds the full text of every Kevin email and his
blog whitepaper. Read it before writing a Kevin email. The one-line version: Kevin wraps a real reason
to click (offer, report behind the click, tool, deadlines) — the 2025 emails that did won, the 2026
ones that told the whole story in the email lost.

`GET /api/klaviyo/templates?country=XX&messageId=<id>` returns the HTML a **sent** campaign used (the
template list never shows those); the message id is `id` on a subject-line history row.

## Asana projects the app can read

`GET /api/campaign/brain?action=asana_tasks&kind=` lists one of three projects, resolved by
`resolveAsanaProjectGid` (`server/lib/asana.js`): `campaign`, `content` (the Content Library) and
`creatives` — **"Meta Creatives"** (1218826645554863, added 2026-10-20), where designed ads per
language move Drafts → To Do → In progress → Review. The user's rule: creatives in **Review** may
be used in ads. An unknown kind is a 400, never a fallback. `action=asana_task&taskGid=…&comments=true`
also returns the task's comments, which is where reviewers leave feedback on a creative.

The local `ASANA_ACCESS_TOKEN` in `.vercel.live.env` is expired, and `vercel env pull` returns
sensitive variables empty, so Asana is read through production (log in as `smoke-local.js` does).

## Meta advertising research — `knowledge/meta-research/`

Added 2026-10-13. Seven dated research reports (~30,000 words) on Meta advertising for Westpack's
situation: awareness share and frequency, delivery/structure/bidding, creative, measurement, B2B and
multi-market Europe, scaling decisions, and a 2025–2026 platform changelog. Every claim is labelled by
source type and each section ends "For Westpack". Read `README.md` there first — it holds the
cross-cutting conclusions, the open disagreements and a list of account and code checks the research
turned up (including deprecated fields still sent by `api/meta/publish-ad.js`). Before advising on a
Meta setting, budget split or test design, start from these reports rather than general knowledge,
and refresh any part older than about six months.

## The Trustpilot carousel is a template — `templates/meta-trustpilot-carousel/`

Added 2026-10-27 at the user's request: "a carousel we can always use on Meta with Trustpilot, across
languages, images swapped, but the graphics and overlay always the same". The design is the French
carousel the user approved that day (PH - AD26). A new version is a spec file (`specs/`): language,
TrustScore, 1–8 verbatim reviews and photos. Do not redesign it per market; change data, not CSS. Its
README (Danish, for the marketing team) holds the workflow and rules.

- `carousel-spec.js` turns a spec into every text on the cards **and** in the Meta creative, so the two
  cannot drift. It is a plain script like `src/saturation-rules.js` (Node and browser).
- `render.js --reviews=<Trustpilot Business export>` checks every quote word for word, same author,
  rating and date, and refuses to render on a mismatch or on text that does not fit. The export holds
  reviewers' e-mail addresses: it is never committed. trustpilot.com refuses automated reads, so the
  export is the only source of reviews.
- `publish.js` creates the ad **PAUSED** only, never retries a write, refuses a spec changed since the
  render, and opts out of every Advantage+ creative feature. Those features rewrite text, and one added
  a "See offer" button to the first build. Test a change with `--creative-only` (builds the creative, no
  ad) and delete that test creative afterwards.
- `locales.js`: `fr` is approved; `de`, `it`, `en`, `en-uk`, `en-us` are drafts whose offer claims were
  read off each store on 2026-10-27. Logo print is free on jewellery boxes only, so the packs are for
  jewellery-box carousels.
- `tests/meta-trustpilot-carousel.test.js` pins the French text to what AD26 carries.

## Signup Lab - the store's newsletter signup, built outside Klaviyo's form builder

Added 2026-10-29 from the user's brief "Reinvent email signup for Westpack". `signup/` (README.md in Danish
for the team; CONCEPTS.md has the ten concepts and why three were built): Logo studio (the visitor's brand
name foil-printed on a real lid), Swipe match (six real boxes, a packaging profile) and Pack & ship (the email
field prints onto a shipping label). One runtime, `signup/westpack-signup.js`, loaded by one script tag.

- **Why not Klaviyo forms:** the forms API and the custom HTML block run no JavaScript, strip `<input>`,
  `<svg>`, `<style>` and inline styles, and a button can only go to the *next* step (verified against the
  OpenAPI spec and Klaviyo's help pages 2026-10-28). Swipe, live text on a photo and per-step tracking need code.
- **Signups use Klaviyo's client subscription API** with each market's public key and newsletter list
  (`signup/core/markets.js`), `custom_source` "Westpack Signup Lab · <concept>", and the store's own consent
  sentence stored on the profile. The runtime does not need klaviyo.js, which the stores lost on 2026-10-26.
- **Klaviyo's bot protection suppresses repeated automated signups** after accepting them with 202
  ("Manually Suppressed from Email Marketing", `method: BOT_PROTECTION`), seen on the 4th+ test signup within
  minutes from one machine. The browser cannot see it, so `/api/signup/track?action=confirmed` reconciles
  submitted vs confirmed vs bot-blocked per market. Space out e2e runs, and delete test profiles afterwards
  (`tools/signup/klaviyo-e2e.js` does) - a SUBSCRIBED test profile can land in a consent segment.
- Tests and the preview subscribe only to `WUDjfX` "TEST - Signup Lab (preview only)" in the DK account.
- **Not live, and ready to go** (2026-10-29; `signup/IMPLEMENTERING.md`). `LIVE` in `signup/core/markets.js` is
  the master switch: off, the store tag does nothing except answer `?wps=preview` / `?wps=<concept>`, which opens
  the experience at once in test mode (test list only) - so the tag can go in before launch and be checked on the
  real store. **The tag goes into Magento, not Tag Manager** (the user, 2026-10-30: "er træt af det er tag
  manager"): one line in Content → Design → Configuration → Global → HTML Head → Scripts and Style Sheets, then
  flush the cache. It was tested placed at the top of `<head>` in the real stores' HTML, before `<body>` exists
  (the runtime waits for DOMContentLoaded); the stores' CSP is report-only. GTM-5QRXWTJ, which all 18 stores also
  load, is the fallback - never both. Launch is
  `LIVE = true` + deploy and `node tools/signup/go-live.js unpublish --apply` in the same minutes (it touches only
  forms named "… - Popup - The Insert …" and records them for `republish --apply`); the embeds and the "Always on
  sale" flyout (sale/outlet pages only, which the Signup Lab avoids) stay. Launch needs the user's go and the line
  in Magento.
- `tools/signup/store-check.js` opens the 18 real storefronts, answers the cookie banner, adds the tag and checks:
  silent with the switch off (or showing with it on), preview opens in the store's language with its consent
  sentence, never on the cart. `--local` serves this checkout, `--simulate-live` forces the switch on in the test
  browser only, `--installed` adds nothing and fails every store whose own page lacks the tag - the check to run
  once it is in Magento, and at launch.
- The 15 transcreated languages had an independent read (`tools/signup/proofread.js`, gpt-5.6 high, findings in
  `tmp/signup-proofread/`): 56 fixes applied after review, mostly the right local term for hot-foil stamping;
  suggestions that would replace a store's own newsletter wording were rejected. Still not a native read.
- Deboss ("Blindpræg") was removed at the user's request (2026-10-29); the foils are gold, silver, rose gold, old
  rose, white and black.
- Funnel records go to Vercel Blob under `signup-funnel/` (one file per exposure, compacted per day), never
  Redis. `rules.sanitizeTracking` drops any value containing "@", in the browser and on the server.
- The logo studio shows six real lids (`LOGO_BOXES` in `tools/signup/build-assets.js`); Frankfurt is the white
  linen-look lid from Shipping_Smykkeæsker_Reshoot-10, because the black close-up had no edges to measure. Their demo print is
  removed by `tools/signup/clean-plate.html`: thin print morphologically (gold on black needs `print: "light"` -
  closing first swells thick strokes into blocks), thick print (Frankfurt, Seoul, Madrid) by a harmonic fill with
  the lid's own fine grain mirror-tiled back (`detailRadius: 1`; a wider band carries the patch's light and shows
  the tiling). Kategori_Reshoot-36 and -46 contain a "MADE FROM RECYCLED PLASTIC" insert; their crops leave it out.
- **The print is laid on each lid by a homography, measured, not guessed** (2026-10-29, the user: "lige på
  æskerne ... grundighed fremfor fart"). `tools/signup/lid-geometry.js refine` fits each lid's four edges on its
  plate (rough lines in `lid-geometry.json`, then the strongest brightness step at 48 points per edge, a line
  fit and outlier rejection; `polarity` picks the right one of two close lines, e.g. the inside of Torino's gold
  frame), intersects them into a quad, reads the light across the print area, and writes the `LIDS` block between
  the `lids:begin`/`lids:end` markers in `logo-studio.js`. The browser lays the print with `matrix3d` inside a
  1000×1000 "plate" scaled to the frame. `review <dir>` draws the fit for a human; the unit tests check every
  corner of every print area stays inside the photo.
- The perspective alone gives the lid's proportions (Torino's square frame measures 0.97, the white Frankfurt lid
  1.02), but it is ill-conditioned with these long lenses (Seville measured 0.82), so square products are set to
  1 from the site's dimensions. The print area is the site's *maximum* logo size, which is what Westpack's own
  demo prints use; Seville, London and Torino are trimmed so a square logo is never cut by the photo or caption.
- **Foil brightness is calibrated against Westpack's real demo prints in the original photos** (per-lid
  `exposure` in `lid-geometry.json`): measure the print's pixels in the original the same way as in a render and
  match on the stroke cores (p10/p90), not the median, because the demo lettering is heavier than a typed name.
  Madrid's demo print is old rose pigment, so that is its default. All grain is multiplicative around grey 0.5: a
  soft-light blend with noise turned white foil grey and drained gold of colour. The board's texture is drawn
  (`GRAINS`), not read from the plates - at that scale the WebP plates hold compression blocks, not board.
- **Chrome stops drawing a perspective layer after its parent's scale animates** (seen when the phone's frame
  shrank for the keyboard): the scene is flat at rest (`--tilt: none`, no `will-change`; the desktop tilt brings
  its own `perspective()`), the frame's width no longer transitions, and after a resize settles the print layer
  is nudged one pixel for one frame. Check the phone's typing and result states whenever this area changes.
- **Checked in three engines** (`tmp/playwright-runner` now has WebKit and Firefox too): Chromium and Firefox draw
  the print within 0.06% of the measured quad. Playwright's WebKit for Windows paints matrix3d without its
  perspective (no compositing), so the page measures one corner on load and falls back to the centre-matched
  affine transform when it is off (worst corner 2.6% instead of 13%); real Safari composites 3D transforms and was
  not available to test. Two filter rules came out of WebKit and hold everywhere: every foil step runs on opaque
  images and the glyph shape is cut out once at the end (an arithmetic sum adds alpha, and WebKit gives the
  specular highlight alpha 1, which thickened and greyed every letter), and the metal gradient is
  `userSpaceOnUse` sized from the fitted text box (WebKit painted an objectBoundingBox gradient on text in its
  first, darkest stop). Fixing the edges brightened thin strokes in Chrome too, so the exposures were re-matched.
- The light follows the pointer to the point on the lid under it (inverse homography); the loupe and the phone's
  floating preview are clones of the scene that reuse the same filter ids, so one light drives all three. An
  uploaded logo becomes a one-colour mask in the browser and is never sent anywhere.
- **The redesign (2026-10-30, the user: "Jeg bad om at du gik all in på designet")** made the box the whole scene
  (desktop: a square stage up to 780px with an overlay bar for lid name, zoom and thumbnails), an opening camera push,
  a "press" on every change, foil coins, type cards set in the visitor's own name and a six-lid collection as the
  result. Four things it broke once, each now pinned in `tools/signup/qa.js` (69 checks) or fixed at the root:
  - **The engine probe must run on the scene at rest.** It measures where the print's far corner lands; run during
    the camera push it read every browser as broken and forced the flat fallback everywhere (2.6% instead of 0.01%).
    `checkEngine` runs when `is-intro` ends, or at once under reduced motion.
  - **SVG text letter-spacing is in print units, so it must scale with the font size**, or a long name stays wider
    than the lid however small it gets. The text also carries `text-rendering="geometricPrecision"`: at a thumbnail's
    few pixels Chrome's hinted advances made a name fitted at one size overflow at another. A print that is hidden
    when its name is set (phone thumbnails while typing, the collection before the result) cannot be measured, so
    `refit()` sizes it once shown.
  - **Zoomed in, the zoom button is the only way out**: the bar may fade, the button may not lose pointer events.
  - **The pointer owns the light**: a sweep never starts while the visitor is moving it, and moving it cancels one.
- **Every asset URL carries `?v=ASSET_VERSION`** (`signup/westpack-signup.js`), because `vercel.json` caches the
  WebP images for 30 days under unchanged names and the user saw an old image after a rebuild. `build-assets.js`
  stamps a new version whenever it writes images; the runtime JS and CSS revalidate on every load, so the new
  version reaches every browser at once.
- Copy: `da`/`en` are masters; 15 languages are transcreated (`tools/signup/transcreate.js`) and marked
  `needsNativeReview`. No visible text may live in concept code (tested).
- Checks: `node --test tests/signup-lab.test.js`, `node tools/signup/qa.js <dir>` (69 browser checks, every language),
  `node tools/signup/screens.js <dir> [concept] [market] --steps`.

## Agent workflow for this subsystem

`.claude/workflows/campaign-studio-pipeline.js` is a saved Workflow implementing a scope → build →
test loop for Campaign Studio changes (three roles: Scope breaks a goal into small tasks with
acceptance criteria; Build implements one task at a time — sequential, not parallel, because
`app.js` is a single shared file and parallel builders would race on it; Test independently verifies
against acceptance criteria and real test runs, looping feedback back to Build for up to 3 rounds).
Invoke with `Workflow({name: 'campaign-studio-pipeline', args: {goal: '...'}})`.
