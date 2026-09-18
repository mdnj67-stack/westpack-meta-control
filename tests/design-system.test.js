const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// The design system is one file that owns how the whole product looks, and it only works
// because of an arrangement that is invisible from any single rule: styles.css is held in
// a cascade layer, design-system.css is not, and that is what lets the system win without
// a specificity war. Break either half and nothing fails - the app just quietly goes back
// to looking like eight different products.
//
// These are characterisation tests over the source, the same way the other UI tests in
// this repo work. They catch the arrangement coming apart, not whether a colour is nice.

const root = join(__dirname, "..");
const system = readFileSync(join(root, "design-system.css"), "utf8");
const legacy = readFileSync(join(root, "styles.css"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");

test("the legacy stylesheet is held in the wp-legacy cascade layer", () => {
  // Without this, every rule in the 18,000-line legacy sheet competes with the system on
  // specificity, and the id-scoped ones win.
  assert.match(legacy, /@layer wp-legacy \{/);
  assert.equal(legacy.trimEnd().endsWith("}"), true, "the layer block is not closed");
});

test("the design system is not in a layer, so it outranks the legacy sheet", () => {
  assert.equal(/@layer/.test(system), false, "design-system.css must stay unlayered");
});

test("index.html loads the design system after the legacy sheet", () => {
  const legacyAt = html.indexOf("styles.css");
  const systemAt = html.indexOf("design-system.css");
  assert.notEqual(legacyAt, -1, "styles.css is no longer loaded");
  assert.notEqual(systemAt, -1, "design-system.css is not loaded");
  assert.ok(legacyAt < systemAt, "design-system.css must be loaded after styles.css");
});

test("the token set the rest of the system is built on is present", () => {
  // Every one of these is read by rules elsewhere in the file. A missing token does not
  // throw; it resolves to nothing and the declaration is dropped, so a control silently
  // loses its height or its border.
  const tokens = [
    "--wp-brand", "--wp-brand-hover", "--wp-brand-contrast", "--wp-brand-surface",
    "--wp-bg", "--wp-surface", "--wp-surface-sunken", "--wp-surface-inverse",
    "--wp-text", "--wp-text-muted", "--wp-text-subtle", "--wp-text-inverse",
    "--wp-border", "--wp-border-strong", "--wp-border-subtle",
    "--wp-success", "--wp-warning", "--wp-danger", "--wp-info",
    "--wp-font", "--wp-text-sm", "--wp-text-2xl", "--wp-weight-semibold",
    "--wp-space-1", "--wp-space-4", "--wp-space-8",
    "--wp-radius-md", "--wp-radius-lg", "--wp-radius-pill",
    "--wp-shadow-xs", "--wp-shadow-lg", "--wp-ring",
    "--wp-control-height", "--wp-control-height-sm", "--wp-duration", "--wp-ease"
  ];

  for (const token of tokens) {
    assert.match(
      system,
      new RegExp(`${token}\\s*:`),
      `design-system.css no longer defines ${token}`
    );
  }
});

test("the brand colour is the Westpack green", () => {
  assert.match(system, /--wp-brand:\s*#34453f;/i);
});

test("the legacy tokens are aliases onto the system, not a second palette", () => {
  // styles.css still reads --accent, --line, --surface and friends in hundreds of places.
  // They have to resolve to the system, or the app has two sources of truth for colour
  // and they drift apart the first time one of them is edited.
  for (const [legacyToken, systemToken] of [
    ["--accent", "--wp-brand"],
    ["--surface", "--wp-surface"],
    ["--line", "--wp-border"],
    ["--text", "--wp-text"],
    ["--muted", "--wp-text-muted"],
    ["--danger", "--wp-danger-text"],
    ["--success", "--wp-success-text"]
  ]) {
    assert.match(
      legacy,
      new RegExp(`${legacyToken}:\\s*var\\(${systemToken}\\);`),
      `${legacyToken} is not aliased onto ${systemToken}`
    );
  }
});

test("the old crimson identity is gone from both stylesheets", () => {
  // The product was cream and crimson. Every one of these appeared dozens of times, and a
  // single survivor reads as a mistake next to the green.
  for (const source of [["styles.css", legacy], ["design-system.css", system]]) {
    const [name, css] = source;
    for (const dead of ["#cf1f25", "#a90037", "#b6002a", "#a8161b", "rgba(207, 31, 37"]) {
      assert.equal(
        css.includes(dead),
        false,
        `${name} still contains the retired brand colour ${dead}`
      );
    }
  }
});

test("the radius scale is five steps plus pills and circles", () => {
  // It was twenty-six values between 2px and 30px, which is what made the old interface
  // read as a pile of unrelated widgets.
  const values = [...legacy.matchAll(/border-radius:\s*([^;}]+)/g)]
    .map((match) => match[1].trim())
    .filter((value) => !value.includes("var(") && !value.includes("%") && value !== "inherit")
    .flatMap((value) => [...value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));

  const allowed = new Set([0, 4, 6, 8, 10, 12, 999]);
  const strays = [...new Set(values)].filter((value) => !allowed.has(value));
  assert.deepEqual(strays, [], `styles.css uses radii outside the scale: ${strays.join(", ")}`);
});

test("every component the system claims to own is actually defined", () => {
  // The list in the file header is a promise to whoever styles the next screen. A missing
  // component means they write a one-off instead.
  const components = [
    ".wp-button", ".wp-icon-button", ".wp-input", ".wp-select", ".wp-textarea",
    ".wp-field", ".wp-label", ".wp-help", ".wp-error", ".wp-check",
    ".wp-badge", ".wp-status", ".wp-delta",
    ".wp-card", ".wp-card-header", ".wp-metrics", ".wp-metric",
    ".wp-table", ".wp-table-wrap", ".wp-pagination",
    ".wp-toolbar", ".wp-search", ".wp-filter-chip",
    ".wp-tabs", ".wp-tab", ".wp-segment",
    ".wp-state", ".wp-skeleton", ".wp-loading", ".wp-partial", ".wp-alert",
    ".wp-modal", ".wp-drawer", ".wp-menu", ".wp-tip", ".wp-chart",
    ".wp-sidebar", ".wp-nav-item", ".wp-page-header", ".wp-page-title"
  ];

  for (const component of components) {
    assert.ok(
      system.includes(`${component} {`) || system.includes(`${component},`),
      `design-system.css has no rule for ${component}`
    );
  }
});

test("the rail lists both platforms at once", () => {
  // The workspace toggle meant half the product was invisible unless you already knew it
  // was there. Both groups are in the markup now, and a nav item carries the workspace it
  // belongs to so one click can move both.
  assert.match(html, /data-nav-workspace="meta"/);
  assert.match(html, /data-nav-workspace="klaviyo"/);
  assert.equal(html.includes('data-workspace="meta"'), false, "the workspace toggle is back");

  for (const view of ["dashboard", "duplicate_translate", "campaign_ai", "campaign_brain"]) {
    assert.match(
      html,
      new RegExp(`data-klaviyo-view="${view}"`),
      `the rail has no entry for the ${view} view`
    );
  }
});

test("only the current workspace can show a current page", () => {
  // Each nav group keeps its own active item in the DOM, so without this the rail claims
  // you are in two places at once.
  assert.match(system, /body\[data-workspace="klaviyo"\] \.tab-button\.active/);
  assert.match(system, /body\[data-workspace="meta"\] \.subnav-button\.active/);
});

test("the page description is visible again", () => {
  // .topbar-sub was display:none in the legacy sheet, so every screen lost its one line of
  // context - the line that tells someone who did not build this what they are looking at.
  assert.match(system, /\.topbar-sub \{[^}]*display:\s*block/);
  assert.match(html, /id="view-description"/);
});

test("one typeface, and no display face on headings", () => {
  assert.equal(html.includes("Space+Grotesk"), false, "Space Grotesk is being loaded again");
  assert.match(html, /IBM\+Plex\+Sans/);
  assert.match(system, /--wp-font:\s*"IBM Plex Sans"/);
});

test("the reference page loads the system and nothing else", () => {
  // If design-system.html needs a rule from styles.css to render correctly, that rule
  // belongs in the system and has not been moved yet. The page only proves that while it
  // stays honest about what it loads.
  const reference = readFileSync(join(root, "design-system.html"), "utf8");
  assert.match(reference, /href="design-system\.css/);
  assert.equal(reference.includes('href="styles.css'), false);
});
