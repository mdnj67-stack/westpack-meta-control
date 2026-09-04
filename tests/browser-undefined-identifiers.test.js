const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// `node --check` cannot catch a free variable in an ES module - it is only a
// ReferenceError once the line actually runs. That is how "objectiveLabels is not
// defined" reached production: a local lookup table was deleted and two of its three
// call sites were updated. The one missed reference threw during render, which stopped
// the dashboard loading data at all, so every figure showed 0.
//
// A general "find every undeclared identifier" scan was tried first and rejected: to
// avoid false positives on a 780KB file it had to over-approximate the set of declared
// names so heavily that it stopped reporting the real bug, i.e. it passed vacuously.
// This test is narrower but sound - it asserts that specific identifiers which no longer
// exist are not referenced anywhere. Add to the list whenever a shared helper is deleted.

const root = join(__dirname, "..");

// Identifiers removed while reworking the Meta budget/objective split. Each entry is a
// name that no longer exists, so any surviving reference is a guaranteed crash (or, for
// a model field, a silently dead branch).
const REMOVED_IDENTIFIERS = [
  // Local lookup table replaced by resolveObjectiveGroupLabel from the shared module.
  // This is the one that actually broke production.
  "objectiveLabels",
  // Client-side budget estimator; budgets are now normalised only on the server.
  "estimateMonthlyBudgetFrontend",
  // Retired renderer: it had no DOM, was called with visible:false, and gated on a field
  // no model produced.
  "renderMetaBudgetVisualization",
  // The phantom field that renderer gated on.
  "totalMonthlyAmount",
  // Local tone map replaced by resolveObjectiveTone.
  "toneMap",
  // Superseded by the canonical set in src/meta-objectives.js.
  "OBJECTIVE_GROUP_ORDER"
];

const BROWSER_FILES = ["app.js", "src/ui.js"];

for (const file of BROWSER_FILES) {
  const source = readFileSync(join(root, file), "utf8");

  for (const identifier of REMOVED_IDENTIFIERS) {
    test(`${file} does not reference removed identifier ${identifier}`, () => {
      const pattern = new RegExp(`(?<![\\w.$])${identifier}(?![\\w$])`, "g");
      const hits = source
        .split(/\r?\n/)
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter((entry) => pattern.test(entry.line) && !entry.line.startsWith("//"));

      assert.deepEqual(
        hits.map((entry) => `${file}:${entry.number}  ${entry.line}`),
        [],
        `${identifier} was removed but is still referenced`
      );
    });
  }
}

test("every name app.js imports from meta-objectives.js is exported there", () => {
  // The other half of the same failure mode: importing a name the module does not export
  // is also only an error at load time.
  const app = readFileSync(join(root, "app.js"), "utf8");
  const mod = readFileSync(join(root, "src", "meta-objectives.js"), "utf8");

  const block = app.match(/import \{([^}]*)\} from "\.\/src\/meta-objectives\.js[^"]*";/);
  assert.ok(block, "app.js no longer imports from src/meta-objectives.js");

  const exported = new Set([...mod.matchAll(/export (?:function|const) (\w+)/g)].map((m) => m[1]));
  const missing = block[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => !exported.has(name));

  assert.deepEqual(missing, [], "app.js imports names meta-objectives.js does not export");
});

test("every name app.js imports from ui.js is exported there", () => {
  const app = readFileSync(join(root, "app.js"), "utf8");
  const ui = readFileSync(join(root, "src", "ui.js"), "utf8");

  const blocks = [...app.matchAll(/import \{([^}]*)\} from "\.\/src\/ui\.js[^"]*";/g)];
  assert.ok(blocks.length > 0, "app.js no longer imports from src/ui.js");

  const exported = new Set([...ui.matchAll(/export (?:function|const) (\w+)/g)].map((m) => m[1]));
  const missing = blocks
    .flatMap((block) => block[1].split(","))
    .map((name) => name.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean)
    .filter((name) => !exported.has(name));

  assert.deepEqual(missing, [], "app.js imports names ui.js does not export");
});

test("every name ui.js imports from meta-objectives.js is exported there", () => {
  const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
  const mod = readFileSync(join(root, "src", "meta-objectives.js"), "utf8");

  const block = ui.match(/import \{([^}]*)\} from "\.\/meta-objectives\.js[^"]*";/);
  assert.ok(block, "src/ui.js no longer imports from meta-objectives.js");

  const exported = new Set([...mod.matchAll(/export (?:function|const) (\w+)/g)].map((m) => m[1]));
  const missing = block[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => !exported.has(name));

  assert.deepEqual(missing, [], "ui.js imports names meta-objectives.js does not export");
});

test("the removed-identifier list is not silently empty or malformed", () => {
  // Guards the guard: if the list were emptied, every test above would pass vacuously.
  assert.ok(REMOVED_IDENTIFIERS.length >= 6);
  assert.ok(REMOVED_IDENTIFIERS.includes("objectiveLabels"));
  for (const identifier of REMOVED_IDENTIFIERS) {
    assert.match(identifier, /^[A-Za-z_$][\w$]*$/);
  }
});
