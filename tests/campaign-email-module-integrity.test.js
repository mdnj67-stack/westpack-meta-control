const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const {
  buildEmailModulePromptBlock,
  describeEmailSectionNormalization,
  normalizeEmailSections
} = require("../server/campaign/email-module-library");
const { buildQualityAudit } = require("../server/campaign/content-agent-worker");

const workerSource = readFileSync(path.join(__dirname, "..", "server", "campaign", "content-agent-worker.js"), "utf8");

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

test("the deterministic audit fails when the compiled email lost a module the producer authored", () => {
  // This is the defect the revision loop could never repair. The Quality Director saw only a
  // module-count mismatch against the locked plan; the producer was asked to fix copy, which was
  // never the problem, and the job burned five revisions and ended quality_blocked.
  const artifactPack = {
    artifacts: {
      email: {
        bodyHtml: "<!-- Email module: editorial_text --><div data-email-module=\"editorial_text\"></div>",
        moduleSystem: {
          locked: true,
          version: "westpack-email-modules-v2",
          master: { id: "westpack-campaign-master-v2" },
          authoredCount: 4,
          droppedSections: [{ position: 2, reason: "empty_headline", moduleId: "image_full" }]
        }
      }
    }
  };

  const audit = buildQualityAudit({}, {}, artifactPack, [], null);
  const integrity = audit.checks.find((check) => check.key === "email_module_integrity");

  assert.ok(integrity, "the audit must carry an email_module_integrity check");
  assert.equal(integrity.passed, false);
  assert.ok(audit.missing.includes("email_module_integrity"));
  assert.deepEqual(audit.droppedEmailSections, [{ position: 2, reason: "empty_headline", moduleId: "image_full" }]);
});

test("an email that lost nothing passes the integrity check", () => {
  const artifactPack = {
    artifacts: {
      email: {
        bodyHtml: [
          "<!-- Email module: editorial_text --><div data-email-module=\"editorial_text\"></div>",
          "<!-- Email module: statement --><div data-email-module=\"statement\"></div>",
          "<!-- Email module: steps --><div data-email-module=\"steps\"></div>"
        ].join(""),
        moduleSystem: {
          locked: true,
          version: "westpack-email-modules-v2",
          master: { id: "westpack-campaign-master-v2" },
          authoredCount: 3,
          droppedSections: []
        }
      }
    }
  };

  const audit = buildQualityAudit({}, {}, artifactPack, [], null);

  assert.equal(audit.checks.find((check) => check.key === "email_module_integrity").passed, true);
  assert.deepEqual(audit.droppedEmailSections, []);
});

test("the deterministic failure reaches the producer, because a failed check blocks the gate", () => {
  // evaluateQualityGate only passes when the audit verdict is "ready", and the whole audit -
  // including droppedEmailSections - is handed to the reviewer, so the revision brief can name
  // the module that was lost instead of guessing at the count.
  assert.match(workerSource, /droppedEmailSections,/);
  const qualitySource = readFileSync(path.join(__dirname, "..", "server", "campaign", "quality-agent.js"), "utf8");
  assert.match(qualitySource, /DETERMINISTIC SAFETY AUDIT/);
  assert.match(qualitySource, /deterministicAudit\?\.verdict === "ready"/);
});

test("the producer is told a blank headline destroys the module, not just that one is required", () => {
  const block = buildEmailModulePromptBlock();

  assert.match(block, /non-empty headline/i);
  assert.match(block, /discarded during compilation/i);
  assert.match(block, /leave it out entirely/i);
});
