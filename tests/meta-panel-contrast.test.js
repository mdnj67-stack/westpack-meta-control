const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// The overview cards are light (rgba(255,255,255,0.92) on an off-white page), but two
// panels inside them are deliberately dark navy with light text. Getting that pairing
// wrong is invisible to every other check in this repo: the markup is right, the data is
// right, the tests pass, and the panel renders with every figure washed out to near
// white-on-white. That is exactly what shipped for the customer-acquisition panel - the
// light-on-dark text colours were copied from the budget panel without its dark surface.
//
// So: any panel root that sets light text must also carry a dark background, and every
// path in a panel's renderer must wrap its output in that root.

const root = join(__dirname, "..");
const cssSource = readFileSync(join(root, "styles.css"), "utf8");
const uiSource = readFileSync(join(root, "src", "ui.js"), "utf8");

// Panel roots that own a dark surface, and therefore may use light text inside.
const DARK_PANEL_ROOTS = [".meta-budget-premium", ".meta-acq"];

function readRule(selector) {
  // Matches the rule whose selector list ends with exactly this selector, so
  // ".meta-acq" does not pick up ".meta-acq-kpi".
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssSource.match(new RegExp(`(^|[,}])\\s*${escaped}\\s*\\{([^{}]*)\\}`, "m"));
  return match ? match[2] : null;
}

function declaration(body, property) {
  const match = String(body || "").match(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`, "i"));
  return match ? match[1].trim() : null;
}

// Average brightness of the darkest rgb()/rgba() triple in a value, 0-255.
function darkestChannelAverage(value) {
  const triples = [...String(value || "").matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)];
  if (!triples.length) return null;
  return Math.min(...triples.map((m) => (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3));
}

function brightestChannelAverage(value) {
  const raw = String(value || "");
  if (/#f{3}\b|#f{6}\b|#fff/i.test(raw)) return 255;
  const hex = raw.match(/#([0-9a-f]{6})\b/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 3;
  }
  const triples = [...raw.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)];
  if (!triples.length) return null;
  return Math.max(...triples.map((m) => (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3));
}

for (const selector of DARK_PANEL_ROOTS) {
  test(`${selector} carries its own dark surface`, () => {
    const body = readRule(selector);
    assert.ok(body, `no rule found for ${selector}`);

    const background = declaration(body, "background");
    assert.ok(background, `${selector} sets light text but declares no background`);

    const darkness = darkestChannelAverage(background);
    assert.ok(darkness !== null, `${selector} background has no inspectable colour: ${background}`);
    assert.ok(
      darkness < 100,
      `${selector} background is not dark (darkest channel average ${darkness}); its light text would be unreadable`
    );
  });

  test(`${selector} sets light text to match its dark surface`, () => {
    const body = readRule(selector);
    const color = declaration(body, "color");
    assert.ok(color, `${selector} has a dark background but sets no text colour`);
    const brightness = brightestChannelAverage(color);
    assert.ok(
      brightness !== null && brightness > 200,
      `${selector} text colour ${color} is too dark for its navy surface`
    );
  });
}

test("every customer-acquisition render path wraps its output in .meta-acq", () => {
  // If any path writes markup straight into the card, that markup lands on the light
  // surface while inheriting styles written for the dark one.
  const start = uiSource.indexOf("export function renderOverviewCustomerAcquisition(");
  assert.notEqual(start, -1, "renderOverviewCustomerAcquisition is gone");
  const next = uiSource.indexOf("\nexport function ", start + 1);
  const body = uiSource.slice(start, next === -1 ? undefined : next);

  const assignments = [...body.matchAll(/node\.innerHTML\s*=\s*([`"'])([\s\S]*?)\1/g)].map((m) => m[2]);
  assert.ok(assignments.length >= 2, `expected several innerHTML paths, found ${assignments.length}`);

  for (const markup of assignments) {
    const trimmed = markup.trim();
    if (trimmed === "") continue;
    assert.match(
      trimmed,
      /^<section class="meta-acq"/,
      `a render path writes markup that is not wrapped in .meta-acq:\n${trimmed.slice(0, 120)}`
    );
  }
});

test("the budget panel's empty state is styled for the dark surface it renders on", () => {
  // .meta-budget-empty renders inside .meta-budget-premium and inside .meta-acq, both
  // dark. It previously used var(--muted), which is the light-card muted tone.
  const body = readRule(".meta-budget-empty");
  assert.ok(body, "no rule for .meta-budget-empty");
  const color = declaration(body, "color");
  assert.ok(color, ".meta-budget-empty sets no colour");
  assert.equal(
    /var\(--muted\)/.test(color),
    false,
    ".meta-budget-empty uses the light-card muted tone on a dark panel"
  );
  const brightness = brightestChannelAverage(color);
  assert.ok(brightness !== null && brightness > 180, `.meta-budget-empty colour ${color} is too dark for a navy panel`);
});

test("the contrast helpers actually discriminate", () => {
  // Guards the guard: if these returned null or a constant, every test above would pass
  // vacuously.
  assert.ok(darkestChannelAverage("linear-gradient(160deg, rgba(24, 24, 55, 0.98) 0%, rgba(19, 18, 46, 0.99) 100%)") < 100);
  assert.ok(darkestChannelAverage("rgba(255, 255, 255, 0.92)") > 200);
  assert.equal(darkestChannelAverage("none"), null);

  assert.equal(brightestChannelAverage("#ffffff"), 255);
  assert.ok(brightestChannelAverage("#f5f1ff") > 200);
  assert.ok(brightestChannelAverage("#15110f") < 60);
  assert.ok(brightestChannelAverage("rgba(228, 233, 255, 0.76)") > 200);
});
