const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// src/ui.js is an ES module and this repo has no package.json, so Node treats .js as
// CommonJS and cannot import it. Rather than copying the algorithm into the test (which
// would then be free to drift), the real function source is lifted out of the module and
// evaluated. If the function is renamed or removed, this test fails loudly.
function loadBuildStackSegments() {
  const source = readFileSync(join(__dirname, "..", "src", "ui.js"), "utf8");
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("function buildStackSegments("));
  assert.notEqual(start, -1, "buildStackSegments is no longer defined in src/ui.js");

  let end = start;
  while (end < lines.length && lines[end] !== "}") {
    end += 1;
  }
  assert.ok(end < lines.length, "could not find the end of buildStackSegments");

  const body = lines.slice(start, end + 1).join("\n");
  // eslint-disable-next-line no-new-func
  return new Function(`${body}; return buildStackSegments;`)();
}

const buildStackSegments = loadBuildStackSegments();

function totalWidth(segments) {
  return Number(segments.reduce((sum, segment) => sum + segment.width, 0).toFixed(2));
}

test("segment widths always add up to 100 percent", () => {
  // The previous renderer used Math.max(5, percentage) with no rescaling, so a small
  // objective pushed the bar past 100% and the drawn widths contradicted the printed
  // percentages sitting right next to them.
  const skewed = buildStackSegments(
    [
      { key: "awareness", amount: 92000 },
      { key: "conversion", amount: 5000 },
      { key: "leads", amount: 3000 }
    ],
    "amount"
  );
  assert.equal(totalWidth(skewed), 100);

  const extreme = buildStackSegments(
    [
      { key: "conversion", amount: 999000 },
      { key: "awareness", amount: 1 },
      { key: "leads", amount: 1 },
      { key: "traffic", amount: 1 }
    ],
    "amount"
  );
  assert.equal(totalWidth(extreme), 100);

  const even = buildStackSegments(
    [
      { key: "awareness", amount: 100 },
      { key: "conversion", amount: 100 },
      { key: "leads", amount: 100 }
    ],
    "amount"
  );
  assert.equal(totalWidth(even), 100);
});

test("a tiny non-zero slice stays visible without overflowing the track", () => {
  const segments = buildStackSegments(
    [
      { key: "conversion", amount: 100000 },
      { key: "leads", amount: 1 }
    ],
    "amount"
  );

  const leads = segments.find((segment) => segment.item.key === "leads");
  assert.ok(leads.width >= 3.5, `tiny slice collapsed to ${leads.width}%`);
  assert.equal(totalWidth(segments), 100);
});

test("zero-value groups get no width at all", () => {
  const segments = buildStackSegments(
    [
      { key: "awareness", amount: 500 },
      { key: "conversion", amount: 0 },
      { key: "leads", amount: 500 }
    ],
    "amount"
  );

  assert.equal(segments.find((segment) => segment.item.key === "conversion").width, 0);
  assert.equal(totalWidth(segments), 100);
});

test("an all-zero set renders no bar rather than an even fake split", () => {
  const segments = buildStackSegments(
    [
      { key: "awareness", budgetAmount: 0 },
      { key: "conversion", budgetAmount: 0 }
    ],
    "budgetAmount"
  );

  assert.equal(totalWidth(segments), 0);
  assert.equal(segments.every((segment) => segment.width === 0), true);
});

test("widths are read from the requested key and stay ordered with the items", () => {
  const items = [
    { key: "awareness", amount: 10, budgetAmount: 900 },
    { key: "conversion", amount: 90, budgetAmount: 100 }
  ];

  const spend = buildStackSegments(items, "amount");
  const budget = buildStackSegments(items, "budgetAmount");

  assert.deepEqual(spend.map((segment) => segment.item.key), ["awareness", "conversion"]);
  assert.deepEqual(budget.map((segment) => segment.item.key), ["awareness", "conversion"]);
  // Spend leans to conversion, planned budget leans to awareness.
  assert.ok(spend[1].width > spend[0].width);
  assert.ok(budget[0].width > budget[1].width);
  assert.equal(totalWidth(spend), 100);
  assert.equal(totalWidth(budget), 100);
});

test("empty input is handled without throwing", () => {
  assert.deepEqual(buildStackSegments([], "amount"), []);
  assert.deepEqual(buildStackSegments(undefined, "amount"), []);
});

test("negative or non-numeric values are treated as zero", () => {
  const segments = buildStackSegments(
    [
      { key: "awareness", amount: 100 },
      { key: "conversion", amount: -50 },
      { key: "leads", amount: "not a number" },
      { key: "traffic", amount: null }
    ],
    "amount"
  );

  assert.equal(segments.find((segment) => segment.item.key === "awareness").width, 100);
  assert.equal(totalWidth(segments), 100);
});
