const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const { OBJECTIVE_GROUP_ORDER } = require("../server/meta/budget-allocation");

const root = join(__dirname, "..");
const uiSource = readFileSync(join(root, "src", "ui.js"), "utf8");
const cssSource = readFileSync(join(root, "styles.css"), "utf8");

function parseTones(source) {
  const block = source.match(/const OBJECTIVE_TONES = \{([\s\S]*?)\};/);
  assert.ok(block, "could not locate OBJECTIVE_TONES in src/ui.js");
  return Object.fromEntries(
    [...block[1].matchAll(/([a-z_]+):\s*"([a-z-]+)"/g)].map((match) => [match[1], match[2]])
  );
}

const tones = parseTones(uiSource);

// A group with no tone renders as an unstyled transparent segment, which reads as a gap
// in the bar rather than as spend. Every objective family the server can emit therefore
// needs a tone in the renderer and a matching rule in the stylesheet.
test("every objective group has a renderer tone", () => {
  for (const group of OBJECTIVE_GROUP_ORDER) {
    assert.ok(tones[group], `no OBJECTIVE_TONES entry for ${group}`);
  }
});

test("every renderer tone maps to a real objective group", () => {
  const groups = new Set(OBJECTIVE_GROUP_ORDER);
  for (const group of Object.keys(tones)) {
    assert.ok(groups.has(group), `OBJECTIVE_TONES has an entry for unknown group ${group}`);
  }
});

test("every tone has a stacked-segment style", () => {
  for (const [group, tone] of Object.entries(tones)) {
    assert.ok(
      cssSource.includes(`.meta-budget-segment.tone-${tone}`),
      `styles.css has no .meta-budget-segment.tone-${tone} rule (group ${group})`
    );
  }
  // The fallback tone used for anything unmapped must be styled too.
  assert.ok(cssSource.includes(".meta-budget-segment.tone-neutral"));
});

test("every tone has a budget row fill style", () => {
  for (const [group, tone] of Object.entries(tones)) {
    assert.ok(
      cssSource.includes(`.meta-budget-row.tone-${tone} .meta-budget-row-fill`),
      `styles.css has no .meta-budget-row.tone-${tone} fill rule (group ${group})`
    );
  }
  assert.ok(cssSource.includes(".meta-budget-row.tone-neutral .meta-budget-row-fill"));
});

test("the actual-vs-planned window separation is styled", () => {
  // Actual spend covers the selected range while planned budget is always a 30-day
  // figure. The panel has to make that split visible, so every class the renderer emits
  // for it must exist in the stylesheet or the two halves read as one period.
  const classes = [
    "meta-budget-window-strip",
    "meta-budget-window-tag",
    "meta-budget-window-note",
    "meta-budget-window-divider",
    "meta-budget-window.is-actual",
    "meta-budget-window.is-planned",
    "meta-budget-stack-card.is-actual-card",
    "meta-budget-stack-card.is-planned-card",
    "meta-budget-kpi-card.is-pace"
  ];

  for (const className of classes) {
    const bare = className.split(".")[0];
    assert.ok(uiSource.includes(bare), `renderer never emits ${bare}`);
    assert.ok(cssSource.includes(`.${className}`), `styles.css has no .${className} rule`);
  }
});

test("the retired mode-strip styles are gone with their markup", () => {
  assert.equal(uiSource.includes("meta-budget-mode-pill"), false);
  assert.equal(cssSource.includes("meta-budget-mode-pill"), false);
  assert.equal(cssSource.includes("meta-budget-mode-strip"), false);
});

test("the customer-acquisition panel is styled", () => {
  // Same drift protection as the objective tones: a class the renderer emits with no rule
  // in the stylesheet renders as an unstyled gap, which on a stacked bar reads as missing
  // data rather than as a segment.
  const classes = [
    "meta-acq",
    "meta-acq-kpis",
    "meta-acq-kpi.is-new",
    "meta-acq-kpi.is-cac",
    "meta-acq-kpi.is-existing",
    "meta-acq-mix-card",
    "meta-acq-gap",
    "meta-acq-aov",
    "meta-acq-rows",
    "meta-acq-row.is-head",
    "meta-acq-name",
    "meta-acq-new",
    "meta-budget-segment.tone-acq-new",
    "meta-budget-segment.tone-acq-existing",
    "meta-budget-segment.tone-acq-untagged"
  ];

  for (const className of classes) {
    const bare = className.split(".")[0];
    assert.ok(uiSource.includes(bare), `renderer never emits ${bare}`);
    assert.ok(cssSource.includes(`.${className}`), `styles.css has no .${className} rule`);
  }
});

test("the untagged customer segment is visually distinct from the real types", () => {
  // It must not look like a third customer type. The objective split uses a hatched
  // pattern for Unclassified; this reuses it so the two read the same way.
  const block = cssSource.match(/\.meta-budget-segment\.tone-acq-untagged\s*\{([\s\S]*?)\}/);
  assert.ok(block, "no rule for the untagged segment");
  assert.match(block[1], /repeating-linear-gradient/);
});

test("the budget-unavailable state and unknown pacing pill are styled", () => {
  // The planned-budget bar is replaced by this note when no server-normalised budget is
  // present, so it must not render as unstyled text.
  assert.ok(uiSource.includes("meta-budget-empty"), "renderer never emits meta-budget-empty");
  assert.ok(cssSource.includes(".meta-budget-empty"), "styles.css has no .meta-budget-empty rule");
  assert.ok(uiSource.includes("is-unknown"), "renderer never emits the is-unknown pacing tone");
  assert.ok(
    cssSource.includes(".meta-budget-variance-pill.is-unknown"),
    "styles.css has no .meta-budget-variance-pill.is-unknown rule"
  );
});
