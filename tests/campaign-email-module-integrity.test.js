const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildEmailModulePromptBlock,
  describeEmailSectionNormalization,
  normalizeEmailSections
} = require("../server/campaign/email-module-library");

function section(overrides = {}) {
  return { headline: "A real headline", body: "Body copy.", moduleId: "editorial_text", layout: "editorial_text", ...overrides };
}

test("a section with a blank headline is reported as dropped, not silently discarded", () => {
  const result = describeEmailSectionNormalization([
    section(),
    section({ headline: "  ", moduleId: "image_full" }),
    section({ headline: "Third" }),
    section({ headline: "Fourth" })
  ]);

  assert.equal(result.authoredCount, 4);
  assert.equal(result.sections.length, 3);
  assert.deepEqual(result.dropped, [{ position: 2, reason: "empty_headline", moduleId: "image_full" }]);
});

test("sections beyond the four-module limit are reported rather than quietly truncated", () => {
  const result = describeEmailSectionNormalization([
    section(), section(), section(), section(), section({ moduleId: "statement" })
  ]);

  assert.equal(result.sections.length, 4);
  assert.equal(result.dropped.length, 1);
  assert.equal(result.dropped[0].reason, "over_module_limit");
});

test("a clean set of sections reports no loss at all", () => {
  const result = describeEmailSectionNormalization([section(), section(), section()]);

  assert.equal(result.authoredCount, 3);
  assert.equal(result.sections.length, 3);
  assert.deepEqual(result.dropped, []);
  assert.equal(result.sections[2].position, 3, "surviving sections are renumbered contiguously");
});

test("normalizeEmailSections keeps its old shape for existing callers", () => {
  const sections = normalizeEmailSections([section(), section({ headline: "" }), section()]);

  assert.ok(Array.isArray(sections));
  assert.equal(sections.length, 2);
  assert.equal(sections[0].moduleId, "editorial_text");
});

test("the producer is told a blank headline destroys the module, not just that one is required", () => {
  const block = buildEmailModulePromptBlock();

  assert.match(block, /non-empty headline/i);
  assert.match(block, /discarded during compilation/i);
  assert.match(block, /leave it out entirely/i);
});
