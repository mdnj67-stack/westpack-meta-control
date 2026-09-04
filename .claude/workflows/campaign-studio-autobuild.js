export const meta = {
  name: 'campaign-studio-autobuild',
  description: 'Continuously discover, build and test Campaign Studio improvements in parallel until the backlog runs dry',
  phases: [
    { title: 'Scope', detail: 'each round: find up to 5 small, independently verifiable tasks' },
    { title: 'Build & Test', detail: 'file-disjoint tasks run in parallel; same-file tasks run one at a time' },
  ],
}

const REPO = 'c:\\Projects\\westpack-meta-control'
const MAX_ROUNDS = 5
const MAX_TASKS_PER_ROUND = 5
const MAX_ITERATIONS = 3

const SCOPE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'array', items: { type: 'string' } },
          likelyFiles: { type: 'array', items: { type: 'string' } },
          riskNotes: { type: 'string' },
        },
        required: ['id', 'title', 'description', 'acceptanceCriteria', 'likelyFiles'],
      },
    },
  },
  required: ['tasks'],
}

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    summary: { type: 'string' },
    testsRun: { type: 'array', items: { type: 'string' } },
    failures: { type: 'array', items: { type: 'string' } },
    feedbackForBuilder: { type: 'string' },
  },
  required: ['pass', 'summary'],
}

const REPO_FACTS = `
Repo facts you must respect:
- Root: ${REPO}. There is no package.json and no npm/node_modules setup — do not add one.
- Read CLAUDE.md and README.md first — they capture what is already known about this subsystem (architecture, known risk areas, where the prior AI session left off). Do not repeat investigation they already contain; build on it.
- Tests run with Node's built-in test runner directly against files, e.g. \`node --test tests/<file>.test.js\`.
- Many existing tests (e.g. tests/campaign-studio-admission.test.js) assert against literal regex patterns in app.js's/styles.css's source text rather than calling exported functions. Check how existing tests for the file(s) you touch actually work before assuming a different style, and before trusting a "passing test" as full behavioral proof.
- app.js is a single large (~780KB) file that a lot of Campaign Studio front-end behavior lives in directly. styles.css is similarly large. Treat both as high-collision-risk files.
- Follow existing code conventions in touched files. No comments unless they explain a non-obvious WHY. No refactors or abstractions beyond what the task requires. No new dependencies, frameworks or config files.
- Hard guardrails, non-negotiable regardless of task: never touch secrets/credentials/.env* files; never change anything that would let the Content Agent worker auto-publish (publishCapability must stay false everywhere it already is); never run destructive git operations (no reset --hard, no force push, no discarding uncommitted work); never delete a test without replacing it with an equal-or-better check; never commit — leave changes in the working tree for a human to review.
`.trim()

const DEFAULT_GOAL = `
Keep discovering and completing real, valuable engineering work on the Campaign Studio / Campaign Brain /
Content Agent subsystem, round after round, until there is genuinely nothing safe and valuable left to do.
Known candidate risk areas already documented in CLAUDE.md include: agent-store.js's advisory lock only
being real when Redis is configured (no mutual exclusion in local-file/volatile mode), the e2e Playwright
harness (tests/e2e/campaign-brain-ui.spec.js) not being runnable from a fresh clone, a corrupted line in
.gitignore ("k.includes( ' npm ' )))"), and the three-layer module contract (email-module-library.js /
email-design.js / quality-agent.js) that must stay in sync. Also look for anything else you find by reading
the real code: real bugs, missing error handling at real boundaries, incomplete features, genuine test gaps.
Do not invent speculative features nobody asked for, and do not do cosmetic refactors — prioritize fixing
real bugs, closing real gaps, and hardening real risk, in order of risk and impact.
`.trim()

const GOAL = (args && args.goal) ? args.goal : DEFAULT_GOAL

function scopePrompt(round, priorTitles) {
  return `
You are the SCOPE agent, round ${round}, in a continuous scope -> build -> test loop improving the
Campaign Studio subsystem of the westpack-meta-control repo. This loop keeps running, round after round,
until you report there is nothing left worth doing — nobody will check in on you between rounds, so be honest
and rigorous rather than optimistic.

${REPO_FACTS}

GOAL:
${GOAL}

${priorTitles.length
    ? `Already completed and verified in earlier rounds (do not repeat; if one of these is now suspect, say so in riskNotes instead of silently re-adding it):\n${priorTitles.map((t) => `- ${t}`).join('\n')}`
    : 'This is the first round.'}

Investigate the real code fresh — files may have changed since the last round. Return at most ${MAX_TASKS_PER_ROUND}
small, independently buildable tasks for THIS round only, ordered by risk/impact (most important first). Each
task needs concrete, independently verifiable acceptance criteria (not "works correctly") and an accurate,
exhaustive list of every file you expect the builder to touch — this list decides which tasks can safely run
at the same time versus which must run one after another, so be honest about it, especially for app.js/styles.css.
If you genuinely find nothing safe and valuable left to do, return an empty tasks array. Do not invent busywork
just to have something to report.
`.trim()
}

function buildPrompt(task, feedback) {
  return `
You are the BUILDER agent in a scope -> build -> test loop for Campaign Studio. This is a real, in-use
internal Westpack app, not a sandbox — make real, minimal, working edits directly in the repo with your file tools.

${REPO_FACTS}

TASK: ${task.title}
${task.description}

Acceptance criteria:
${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}

Likely files (verify — may be incomplete or wrong): ${(task.likelyFiles || []).join(', ') || 'unknown, investigate first'}
${task.riskNotes ? `\nRisk notes from scoping: ${task.riskNotes}` : ''}
${feedback ? `\nPREVIOUS TEST ATTEMPT FAILED. Fix this before anything else:\n${feedback}` : ''}

Make the change now. Report back: which files you changed, a short summary of each change, and exactly how it
satisfies each acceptance criterion. Do not claim something works if you have not verified it — say plainly
what you could not complete or confirm.
`.trim()
}

function testPrompt(task, buildSummary) {
  return `
You are the QUALITY TESTER agent in a scope -> build -> test loop for Campaign Studio. A BUILDER agent just
reported implementing a task; verify it independently and skeptically — do not trust the builder's self-report.

${REPO_FACTS}

TASK: ${task.title}
${task.description}

Acceptance criteria:
${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}

BUILDER'S REPORT:
${buildSummary}

Verify by:
1. Finding the actual changed files (git status / git diff if the builder's file list is incomplete) and reading the real diff.
2. Running the relevant tests with Node's built-in runner (there is no npm here), e.g. \`node --test tests/<relevant-file>.test.js\`; run the broader campaign-related suite if the change could have wider impact.
3. Checking each acceptance criterion individually against the actual code, not the builder's claim.
4. Looking for regressions: anything changed outside intended scope, a broken README/CLAUDE.md contract, or a repo left in a broken state (syntax errors, tests that no longer run).
5. Confirming none of the hard guardrails (secrets, publish capability, destructive git, deleted tests, commits) were violated.

pass=true only if every acceptance criterion is verifiably met, nothing regresses, and no guardrail was violated.
Otherwise pass=false with concrete, actionable feedback for the builder: exact failing test names, exact missing
behavior, exact file/line where possible.
`.trim()
}

function finalCheckPrompt(results) {
  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  return `
You are the FINAL VERIFICATION agent at the end of a multi-round autobuild run on the Campaign Studio subsystem
of the westpack-meta-control repo. ${results.length} task(s) were attempted across all rounds: ${passed} passed,
${failed} did not reach a pass within their iteration budget.

${REPO_FACTS}

Do a final sanity pass:
1. Run the full campaign-related unit test suite: node --test against every tests/campaign-*.test.js plus
   tests/content-agent-domain.test.js, tests/content-quality-agent.test.js, tests/creative-production.test.js,
   tests/master-design-dna.test.js, tests/meta-carousel-contract.test.js, tests/meta-quality-director.test.js.
   Report exact pass/fail counts.
2. Run git status and git diff --stat to summarize everything changed across the whole run.
3. Flag anything that looks broken, half-finished, contradictory, or that violates a hard guardrail (secrets
   touched, publish capability changed, destructive git history, a deleted test, an actual commit made).
Report a clear plain-text summary a human can read before deciding whether to commit: overall test result,
files changed, and any concerns.
`.trim()
}

async function buildAndTest(task) {
  let feedback = null
  let lastBuildSummary = null
  let lastTest = null
  let iterations = 0

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations = i + 1
    lastBuildSummary = await agent(buildPrompt(task, feedback), { label: `build:${task.id}`, phase: 'Build & Test' })
    lastTest = await agent(testPrompt(task, lastBuildSummary), { label: `test:${task.id}`, phase: 'Build & Test', schema: TEST_SCHEMA })
    log(`[${task.id}] "${task.title}" — iteration ${iterations}/${MAX_ITERATIONS}: ${lastTest.pass ? 'PASS' : 'FAIL'} — ${lastTest.summary}`)
    if (lastTest.pass) break
    feedback = lastTest.feedbackForBuilder || lastTest.summary
  }

  return { task, buildSummary: lastBuildSummary, test: lastTest, iterations, passed: !!(lastTest && lastTest.pass) }
}

function partitionByFileOverlap(tasks) {
  const parent = tasks.map((_, i) => i)
  function find(i) {
    while (parent[i] !== i) i = parent[i]
    return i
  }
  function union(i, j) {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) parent[ri] = rj
  }
  const fileOwner = new Map()
  tasks.forEach((task, i) => {
    const files = task.likelyFiles && task.likelyFiles.length ? task.likelyFiles : [`__solo_${i}__`]
    for (const f of files) {
      const key = f.toLowerCase()
      if (fileOwner.has(key)) union(i, fileOwner.get(key))
      else fileOwner.set(key, i)
    }
  })
  const groups = new Map()
  tasks.forEach((task, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(task)
  })
  return Array.from(groups.values())
}

let round = 0
let dryRounds = 0
const allResults = []
const completedTitles = []

while (round < MAX_ROUNDS && dryRounds < 2) {
  round++
  phase('Scope')
  const scope = await agent(scopePrompt(round, completedTitles), { label: `scope:r${round}`, phase: 'Scope', schema: SCOPE_SCHEMA })

  if (!scope.tasks || !scope.tasks.length) {
    dryRounds++
    log(`Round ${round}: scope found no remaining work (${dryRounds}/2 dry rounds before stopping)`)
    continue
  }
  dryRounds = 0
  log(`Round ${round}: ${scope.tasks.length} task(s) — ${scope.tasks.map((t) => t.title).join('; ')}`)

  phase('Build & Test')
  const groups = partitionByFileOverlap(scope.tasks)
  log(`Round ${round}: ${groups.length} file-disjoint group(s) running in parallel (sizes: ${groups.map((g) => g.length).join(', ')})`)

  const groupResults = await parallel(
    groups.map((group) => async () => {
      const out = []
      for (const task of group) {
        out.push(await buildAndTest(task))
      }
      return out
    }),
  )

  const flat = groupResults.filter(Boolean).flat()
  allResults.push(...flat)
  completedTitles.push(...flat.filter((r) => r.passed).map((r) => r.task.title))
  const failed = flat.filter((r) => !r.passed)
  if (failed.length) {
    log(`Round ${round}: ${failed.length} task(s) did not pass after ${MAX_ITERATIONS} iterations: ${failed.map((r) => r.task.title).join(', ')}`)
  }
}

if (round >= MAX_ROUNDS) {
  log(`Hit the ${MAX_ROUNDS}-round safety cap for this batch — there may still be more work; run again to continue.`)
}

phase('Build & Test')
const finalCheck = await agent(finalCheckPrompt(allResults), { label: 'final-verification', phase: 'Build & Test' })
log(finalCheck)

return {
  rounds: round,
  hitRoundCap: round >= MAX_ROUNDS,
  taskCount: allResults.length,
  passed: allResults.filter((r) => r.passed).length,
  failed: allResults.filter((r) => !r.passed).length,
  results: allResults,
  finalCheck,
}
