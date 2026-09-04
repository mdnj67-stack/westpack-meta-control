export const meta = {
  name: 'campaign-studio-pipeline',
  description: 'Scope a Campaign Studio change, build it, then QA-loop build<->test until it passes',
  phases: [
    { title: 'Scope', detail: 'break the goal into small, independently buildable tasks' },
    { title: 'Build & Test', detail: 'each task loops build -> test -> revise until it passes or hits the iteration cap' },
  ],
}

const REPO = 'c:\\Projects\\westpack-meta-control'
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
        required: ['id', 'title', 'description', 'acceptanceCriteria'],
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
- Tests run with Node's built-in test runner directly against files, e.g. \`node --test tests/<file>.test.js\`.
- Many existing tests (e.g. tests/campaign-studio-admission.test.js) assert against literal regex patterns in app.js's source text rather than calling exported functions. Check how existing tests for the file(s) you touch actually work before assuming a different style.
- app.js is a single large (~780KB) file that a lot of Campaign Studio behavior lives in directly.
- Campaign Studio production behavior is governed by contracts described in README.md: the module library (3-4 modules from an approved ten-module set), the campaign master compiler (westpack-campaign-master-v2), the Quality Director rubric (westpack-quality-director-v2/v4) and the Content Agent job state machine (queued -> analysing -> producing -> quality_review -> ready_for_review / quality_blocked). Do not violate these contracts.
- Follow existing code conventions in touched files. No comments unless they explain a non-obvious WHY. No refactors or abstractions beyond what the task requires. No new dependencies, frameworks or config files.
`.trim()

if (!args || !args.goal) {
  throw new Error(
    "campaign-studio-pipeline requires args.goal — a plain-English description of the Campaign Studio change to scope, build and test, e.g. Workflow({name: 'campaign-studio-pipeline', args: {goal: '...'}})",
  )
}

phase('Scope')
const scopePrompt = `
You are the SCOPE agent in a scope -> build -> test pipeline for the Campaign Studio subsystem of the westpack-meta-control repo.

${REPO_FACTS}

GOAL:
${args.goal}

Investigate the actual code (don't rely on README alone) enough to produce an ordered list of small, independently buildable tasks that together achieve the goal. Each task must be scoped so a single builder pass can plausibly finish it, and must carry concrete, independently verifiable acceptance criteria (not vague statements like "works correctly"). Note likely files to touch per task, and flag any task whose risk (shared-state, contract, or migration risk) the builder/tester should be extra careful about.
`.trim()

const scope = await agent(scopePrompt, { label: 'scope', schema: SCOPE_SCHEMA })
log(`Scoped ${scope.tasks.length} task(s): ${scope.tasks.map((t) => t.title).join(', ')}`)

phase('Build & Test')

async function buildAndTest(task) {
  let feedback = null
  let lastBuildSummary = null
  let lastTest = null
  let iterations = 0

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations = i + 1

    const buildPrompt = `
You are the BUILDER agent in a scope -> build -> test pipeline for Campaign Studio. This is a real, in-use internal Westpack app, not a sandbox — make real, minimal, working edits directly in the repo with your file tools.

${REPO_FACTS}

TASK: ${task.title}
${task.description}

Acceptance criteria:
${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}

Likely files (verify — may be incomplete or wrong): ${(task.likelyFiles || []).join(', ') || 'unknown, investigate first'}
${task.riskNotes ? `\nRisk notes from scoping: ${task.riskNotes}` : ''}
${feedback ? `\nPREVIOUS TEST ATTEMPT FAILED. Fix this before anything else:\n${feedback}` : ''}

Make the change now. Report back: which files you changed, a short summary of each change, and exactly how it satisfies each acceptance criterion. Do not claim something works if you have not verified it — say plainly what you could not complete or confirm.
`.trim()

    lastBuildSummary = await agent(buildPrompt, { label: `build:${task.id}`, phase: 'Build & Test' })

    const testPrompt = `
You are the QUALITY TESTER agent in a scope -> build -> test pipeline for Campaign Studio. A BUILDER agent just reported implementing a task; verify it independently and skeptically — do not trust the builder's self-report.

${REPO_FACTS}

TASK: ${task.title}
${task.description}

Acceptance criteria:
${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}

BUILDER'S REPORT:
${lastBuildSummary}

Verify by:
1. Finding the actual changed files (git status / git diff if the builder's file list is incomplete) and reading the real diff.
2. Running the relevant tests with Node's built-in runner (there is no npm here), e.g. \`node --test tests/<relevant-file>.test.js\`; run the broader campaign-related suite if the change could have wider impact.
3. Checking each acceptance criterion individually against the actual code, not the builder's claim.
4. Looking for regressions: anything changed outside intended scope, a broken README contract (module limits, quality gate thresholds, state machine transitions), or a repo left in a broken state (syntax errors, tests that no longer run).

pass=true only if every acceptance criterion is verifiably met and nothing regresses. Otherwise pass=false with concrete, actionable feedback for the builder: exact failing test names, exact missing behavior, exact file/line where possible.
`.trim()

    lastTest = await agent(testPrompt, { label: `test:${task.id}`, phase: 'Build & Test', schema: TEST_SCHEMA })
    log(`[${task.id}] iteration ${iterations}/${MAX_ITERATIONS}: ${lastTest.pass ? 'PASS' : 'FAIL'} - ${lastTest.summary}`)

    if (lastTest.pass) break
    feedback = lastTest.feedbackForBuilder || lastTest.summary
  }

  return { task, buildSummary: lastBuildSummary, test: lastTest, iterations, passed: !!(lastTest && lastTest.pass) }
}

const results = []
for (const task of scope.tasks) {
  results.push(await buildAndTest(task))
}

const failed = results.filter((r) => !r.passed)
if (failed.length) {
  log(`${failed.length}/${results.length} task(s) did not pass within ${MAX_ITERATIONS} iterations: ${failed.map((r) => r.task.title).join(', ')}`)
}

return { scope, results }
