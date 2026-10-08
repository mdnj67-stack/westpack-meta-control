const test = require("node:test");
const assert = require("node:assert/strict");
const { readdirSync, mkdtempSync, copyFileSync, rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

// Every browser module must parse. The characterization tests read app.js and
// src/*.js as text and match patterns in them, so a file that no longer parses
// still passes all of them - and in the browser a parse error stops the module
// graph before startApp runs, which leaves even the login form hidden. That
// shipped as far as a local check on 2026-10-08: a literal newline inside a
// string in src/ui.js, with 714 tests green.
//
// The files are ES modules and the repo has no package.json, so each is copied
// to a .mjs name for `node --check`.

const root = join(__dirname, "..");
const files = [
  "app.js",
  ...readdirSync(join(root, "src")).filter((name) => name.endsWith(".js")).map((name) => `src/${name}`)
];

test("every browser module parses", () => {
  const dir = mkdtempSync(join(tmpdir(), "wp-parse-"));
  try {
    const failures = [];
    for (const file of files) {
      const target = join(dir, `${file.replace(/[\\/]/g, "__")}.mjs`);
      copyFileSync(join(root, file), target);
      const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
      if (result.status !== 0) {
        failures.push(`${file}: ${String(result.stderr).split(/\r?\n/).filter(Boolean).slice(-1)[0]}`);
      }
    }
    assert.deepEqual(failures, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
