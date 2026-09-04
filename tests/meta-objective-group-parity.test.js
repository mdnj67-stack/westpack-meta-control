const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const serverModule = require("../server/meta/budget-allocation");

// The objective table exists twice: once as CommonJS for the API handler and the snapshot
// builders, once as an ES module for the browser. There is no bundler in this repo, so
// the duplication cannot be removed - this test is what keeps the two from drifting. A
// mismatch means the dashboard would bucket a campaign differently server-side and
// client-side, which is exactly the class of bug that made the budget split untrustworthy.
const browserSource = readFileSync(join(__dirname, "..", "src", "meta-objectives.js"), "utf8");

function parseBrowserPairs(source) {
  const block = source.match(/OBJECTIVE_GROUP_BY_OBJECTIVE = new Map\(\[([\s\S]*?)\]\);/);
  assert.ok(block, "could not locate OBJECTIVE_GROUP_BY_OBJECTIVE in src/meta-objectives.js");
  return [...block[1].matchAll(/\[\s*"([A-Z_]+)"\s*,\s*"([a-z_]+)"\s*\]/g)]
    .map((match) => [match[1], match[2]]);
}

function parseBrowserStringArray(source, name) {
  const block = source.match(new RegExp(`${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(block, `could not locate ${name} in src/meta-objectives.js`);
  return [...block[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

function parseBrowserObject(source, name) {
  const block = source.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\};`));
  assert.ok(block, `could not locate ${name} in src/meta-objectives.js`);
  return Object.fromEntries(
    [...block[1].matchAll(/([a-z_]+):\s*"([^"]*)"/g)].map((match) => [match[1], match[2]])
  );
}

test("browser and server agree on every objective to group mapping", () => {
  const browserPairs = parseBrowserPairs(browserSource);
  assert.ok(browserPairs.length > 0, "parsed no objective pairs from the browser module");

  const serverPairs = [...serverModule.OBJECTIVE_GROUP_BY_OBJECTIVE.entries()];
  assert.deepEqual(
    browserPairs.slice().sort(),
    serverPairs.slice().sort(),
    "src/meta-objectives.js and server/meta/budget-allocation.js disagree on objective grouping"
  );
});

test("browser and server agree on group order", () => {
  assert.deepEqual(
    parseBrowserStringArray(browserSource, "OBJECTIVE_GROUP_ORDER"),
    serverModule.OBJECTIVE_GROUP_ORDER
  );
});

test("browser and server agree on display order", () => {
  assert.deepEqual(
    parseBrowserStringArray(browserSource, "OBJECTIVE_GROUP_DISPLAY_ORDER"),
    serverModule.OBJECTIVE_GROUP_DISPLAY_ORDER
  );
});

test("display order is a permutation of the canonical group set", () => {
  // If the two ever diverge in membership, a group would either render twice or vanish
  // from the split while still holding budget.
  assert.deepEqual(
    [...serverModule.OBJECTIVE_GROUP_DISPLAY_ORDER].sort(),
    [...serverModule.OBJECTIVE_GROUP_ORDER].sort()
  );
  assert.equal(
    serverModule.OBJECTIVE_GROUP_DISPLAY_ORDER.length,
    new Set(serverModule.OBJECTIVE_GROUP_DISPLAY_ORDER).size
  );
});

test("the marketing pair leads the display order and unclassified trails it", () => {
  const order = serverModule.OBJECTIVE_GROUP_DISPLAY_ORDER;
  assert.deepEqual(order.slice(0, 3), ["awareness", "conversion", "leads"]);
  assert.equal(order[order.length - 1], "unclassified");
});

test("browser and server agree on group labels and lens mapping", () => {
  assert.deepEqual(
    parseBrowserObject(browserSource, "OBJECTIVE_GROUP_LABELS"),
    serverModule.OBJECTIVE_GROUP_LABELS
  );
  assert.deepEqual(
    parseBrowserObject(browserSource, "LENS_BY_OBJECTIVE_GROUP"),
    serverModule.LENS_BY_OBJECTIVE_GROUP
  );
});

test("every mapped group is a known group, and every group has a label", () => {
  const groups = new Set(serverModule.OBJECTIVE_GROUP_ORDER);
  for (const [objective, group] of serverModule.OBJECTIVE_GROUP_BY_OBJECTIVE) {
    assert.ok(groups.has(group), `objective ${objective} maps to unknown group ${group}`);
  }
  for (const group of serverModule.OBJECTIVE_GROUP_ORDER) {
    assert.ok(serverModule.OBJECTIVE_GROUP_LABELS[group], `group ${group} has no label`);
  }
  for (const group of Object.keys(serverModule.LENS_BY_OBJECTIVE_GROUP)) {
    assert.ok(groups.has(group), `lens mapping references unknown group ${group}`);
  }
  // "unclassified" is a sink, so nothing may map to it explicitly.
  assert.equal(
    [...serverModule.OBJECTIVE_GROUP_BY_OBJECTIVE.values()].includes("unclassified"),
    false
  );
});

test("no objective is mapped twice", () => {
  const objectives = [...serverModule.OBJECTIVE_GROUP_BY_OBJECTIVE.keys()];
  assert.equal(objectives.length, new Set(objectives).size);

  // The browser module is a Map literal, so a duplicated key would be silently
  // overwritten rather than reported. Check the source text instead.
  const browserObjectives = parseBrowserPairs(browserSource).map(([objective]) => objective);
  assert.equal(browserObjectives.length, new Set(browserObjectives).size);
});
