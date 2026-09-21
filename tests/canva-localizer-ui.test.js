const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// A characterization test, in the same style as the other UI-adjacent tests here: it reads the
// source and pins the things that must not silently drift. It catches pattern drift, not
// behaviour, which matters most for the honesty requirements below - those are easy to delete by
// accident during a redesign and impossible to notice from a screenshot.

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const localizerJs = fs.readFileSync(path.join(root, "src", "canva-localizer.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const designSystemCss = fs.readFileSync(path.join(root, "design-system.css"), "utf8");
const klaviyoDomain = fs.readFileSync(path.join(root, "src", "klaviyo-dashboard-domain.js"), "utf8");

test("Canva Localizer is reachable from the rail and has a panel to switch to", () => {
  assert.match(indexHtml, /data-klaviyo-view="canva_localizer"/);
  assert.match(indexHtml, /id="klaviyo-canva-localizer-panel"/);
  // Both lists have to accept the view, or the rail and the page disagree - the exact defect
  // campaign_brain already hit once.
  assert.match(appJs, /"campaign_brain",\s*"canva_localizer"/);
  assert.match(klaviyoDomain, /"campaign_brain",\s*"canva_localizer"/);
  assert.match(appJs, /klaviyo-canva-localizer-panel/);
});

test("the four steps are all on one screen, because eighteen versions is a batch job not a wizard", () => {
  for (const step of ["Choose the design", "The text that will change", "Markets", "Review the versions"]) {
    assert.ok(indexHtml.includes(step), `missing step: ${step}`);
  }
  assert.match(indexHtml, /data-canva-action="run-all"/);
  assert.match(indexHtml, /data-canva-action="export"/);
});

test("the page states that only tagged fields are touched, so nothing implies the original is edited", () => {
  assert.match(indexHtml, /Only tagged data fields are touched/);
  assert.match(indexHtml, /can never be overwritten/);
  // create_from_design is the only write path used anywhere in the feature.
  const localizerApi = fs.readFileSync(path.join(root, "api", "canva", "localizer.js"), "utf8");
  assert.equal(/update_design/.test(localizerApi), false, "update_design would edit the operator's original");
  assert.match(fs.readFileSync(path.join(root, "server", "canva", "connect-client.js"), "utf8"), /create_from_design/);
});

test("OCR-read source text is labelled as OCR everywhere it is offered", () => {
  assert.match(indexHtml, /Read text from design \(OCR\)/);
  assert.match(localizerJs, /rendered export/);
  const vision = fs.readFileSync(path.join(root, "api", "canva", "localizer.js"), "utf8");
  assert.match(vision, /source: "ocr"/);
  assert.match(vision, /not from Canva's API/);
});

test("the plan restriction is surfaced as a capability, not discovered as eighteen failures", () => {
  assert.match(localizerJs, /cannot generate language versions/);
  assert.match(localizerJs, /Canva Enterprise organisation/);
  assert.match(indexHtml, /id="canva-capability-notice"/);
});

test("the length flag never claims to be a pixel measurement", () => {
  assert.match(indexHtml, /Length flags are a prediction from the character budget/);
  assert.match(localizerJs, /Canva exposes no font size or box size/);
});

test("export links are described as expiring, because Canva kills them after 24 hours", () => {
  assert.match(localizerJs, /stop working 24 hours/);
});

test("the Canva styles live in the design system, not in a second pass over styles.css", () => {
  for (const selector of [".canva-design-card", ".canva-market-chip", ".canva-version-card", ".canva-summary-list"]) {
    assert.ok(designSystemCss.includes(selector), `missing ${selector} in design-system.css`);
  }
  const legacyCss = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.equal(/\.canva-version-card/.test(legacyCss), false, "Canva Localizer must not grow rules in the legacy sheet");
  // Tokens only - a hard-coded colour here is the start of a second palette.
  const canvaBlock = designSystemCss.slice(designSystemCss.indexOf(".canva-connection-actions"));
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(canvaBlock), false, "Canva Localizer styles must read colour tokens");
});
