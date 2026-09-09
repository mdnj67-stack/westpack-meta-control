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

test("each objective colour is defined once and both places read the same token", () => {
  // The budget panel styled every objective twice with two slightly different colours:
  // awareness was rgba(210,169,95) as a mix-bar segment and #d4a24f as a row fill,
  // conversion rgba(95,137,123) against #5d887a. A bar segment and the row beneath it
  // describe the same objective and the eye is meant to connect them, so the near-match
  // both weakened that link and hid any real drift from review.
  const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
  const tones = ["awareness", "conversion", "leads", "traffic", "engagement", "app-promotion", "unclassified"];

  for (const tone of tones) {
    assert.match(
      css,
      new RegExp(`--tone-${tone}-rgb:\\s*\\d+ \\d+ \\d+;`),
      `no channel token for ${tone}`
    );
    assert.match(
      css,
      new RegExp(`--tone-${tone}-soft-rgb:\\s*\\d+ \\d+ \\d+;`),
      `no soft channel token for ${tone}`
    );

    const segment = readRuleBody(css, `.meta-budget-segment.tone-${tone}`);
    const row = readRuleBody(css, `.meta-budget-row.tone-${tone} .meta-budget-row-fill`);
    assert.ok(segment, `no segment rule for ${tone}`);
    assert.ok(row, `no row rule for ${tone}`);

    for (const [label, body] of [["segment", segment], ["row", row]]) {
      // Either variant is fine - the dark surface uses the lighter tint at both ends -
      // but it has to be this tone's token and not another tone's, and not a literal.
      const readsOwnToken = new RegExp(`var\\(--tone-${tone}-(soft-)?rgb\\)`).test(body);
      const readsAnotherTone = new RegExp(`var\\(--tone-(?!${tone}-)`).test(body);
      assert.ok(readsOwnToken, `the ${tone} ${label} does not read its own tone token`);
      assert.ok(!readsAnotherTone, `the ${tone} ${label} is reading another objective's colour`);
      assert.ok(
        !/#[0-9a-fA-F]{3,8}|rgba?\(\s*\d/.test(body),
        `the ${tone} ${label} still hard-codes a colour: ${body.trim()}`
      );
    }
  }
});

// Returns the body of the first rule whose selector list contains this exact selector.
// The list is split on commas, so ".tone-unclassified, .tone-neutral" is found by either
// member, and ".meta-acq" is never matched by ".meta-acq-kpi".
//
// This walks braces rather than matching a pattern: a plain regex loses its place at the
// first at-rule, because a media block's body contains braces of its own.
function readRuleBody(css, selector) {
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open === -1) return null;

    const prelude = css.slice(index, open).replace(/\/\*[\s\S]*?\*\//g, "").trim();

    let depth = 0;
    let close = open;
    for (; close < css.length; close += 1) {
      if (css[close] === "{") depth += 1;
      else if (css[close] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = css.slice(open + 1, close);

    if (prelude.startsWith("@")) {
      // Recurse into the at-rule, which holds rules of its own.
      const inner = readRuleBody(body, selector);
      if (inner !== null) return inner;
    } else if (prelude.split(",").map((part) => part.trim()).includes(selector)) {
      return body;
    }

    index = close + 1;
  }
  return null;
}

test("an objective keeps one colour whichever panel it appears in", () => {
  // The colour that identifies an objective used to change with the panel: awareness was
  // the brand red in the overview cards, trend cards, sparklines and objective bars, and
  // gold in the budget panel; conversion was green in one place and sage in another. That
  // defeats the point of colour-coding, because the reader cannot carry a colour from one
  // panel to the next.
  //
  // Every rule that paints an objective must now read that objective's token, so the hue
  // is shared even where the lightness is not.
  const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
  const painted = [
    ".overview-card.tone-awareness::before",
    ".overview-card.tone-leads::before",
    ".overview-card.tone-conversion::before",
    ".overview-card.tone-incremental::before",
    ".trend-card.tone-awareness::before",
    ".trend-card.tone-leads::before",
    ".trend-card.tone-conversion::before",
    ".trend-card.tone-incremental::before",
    ".objective-bar-row.tone-awareness .objective-bar-fill",
    ".objective-bar-row.tone-conversion .objective-bar-fill",
    ".objective-bar-row.tone-leads .objective-bar-fill"
  ];

  for (const selector of painted) {
    const tone = selector.match(/tone-([a-z-]+?)(?:::before| |$)/)[1];
    const body = readRuleBody(css, selector);
    assert.ok(body, `no rule for ${selector}`);
    assert.ok(
      new RegExp(`var\\(--tone-${tone}-(soft-)?rgb\\)`).test(body),
      `${selector} paints ${tone} with something other than the ${tone} token: ${body.trim()}`
    );
    assert.ok(
      !/#[0-9a-fA-F]{3,8}|rgba?\(\s*\d/.test(body),
      `${selector} still hard-codes a colour: ${body.trim()}`
    );
  }
});

test("the dark budget surface uses the light tint of the same hue, not the dark one", () => {
  // A solid #cf1f25 on the panel's navy goes muddy, so both ends of the gradient there
  // come from the lighter tint. Sharing the hue is the point; sharing the lightness would
  // cost legibility.
  const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");

  for (const tone of ["awareness", "conversion", "leads"]) {
    const segment = readRuleBody(css, `.meta-budget-segment.tone-${tone}`);
    assert.ok(
      segment.includes(`--tone-${tone}-soft-rgb`),
      `the ${tone} segment is not using the light tint`
    );
    assert.ok(
      !new RegExp(`var\\(--tone-${tone}-rgb\\)`).test(segment),
      `the ${tone} segment uses the dark identity hue, which is unreadable on this surface`
    );
  }
});
