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
  clone as-is: no `playwright` package and no `node_modules` exist at the repo root. A prior
  session used an ad-hoc, gitignored `tmp/playwright-runner/` sub-project with its own
  `package.json` for manual visual verification (screenshots under `tmp/`, also gitignored). If
  e2e/visual QA needs to continue, that harness has to be recreated or the setup documented.

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
- **The incremental lens is a campaign grouping, not a measurement.** Conv 01 to 03 carry
  `Inkrementel` in the campaign name and the marketing team maintains that register
  deliberately, so the name tag stays and is the correct source here. But Meta returns the
  incrementality attribution window for every campaign on this account and gives back the
  standard figures, verified field by field. `incremental_matches_standard` detects that
  and `buildQualityWarnings` discloses it. Never present the lens as a measured uplift.
- **The data quality panel is visible on every lens**, including General. It used to sit
  inside the section the render hides there, so the first view people open was the one
  that never showed whether its own numbers could be trusted.

Panels deleted in this pass, with the user's agreement: Executive brief, Decision buckets,
Decision board and Signals (all four were computed every render and then hidden by the
render itself, and all four were generated advice prose over invented priority scores),
and the Recommended moves panel with its `api/openai/dashboard-agent.js` route. General
also lost its stat row, which restated the budget panel's totals and shares.

Verification here means checking against the live account, not against fixtures. Start the
server with `serve-local.ps1`, log in the way `smoke-local.js` does, and read
`/api/meta/account-snapshot?force=1&preset=last_30d`. **Restart the server after any
server-side change** - it holds the modules in Node's require cache. The account throttles
easily: a forced refresh makes about thirteen paginated Graph calls and repeated forcing
will earn "There have been too many calls to this ad-account" for the best part of an hour.
Poll `?health=1`, which costs one call, rather than retrying the snapshot.

## Agent workflow for this subsystem

`.claude/workflows/campaign-studio-pipeline.js` is a saved Workflow implementing a scope → build →
test loop for Campaign Studio changes (three roles: Scope breaks a goal into small tasks with
acceptance criteria; Build implements one task at a time — sequential, not parallel, because
`app.js` is a single shared file and parallel builders would race on it; Test independently verifies
against acceptance criteria and real test runs, looping feedback back to Build for up to 3 rounds).
Invoke with `Workflow({name: 'campaign-studio-pipeline', args: {goal: '...'}})`.
