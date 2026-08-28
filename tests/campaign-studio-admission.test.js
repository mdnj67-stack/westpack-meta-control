const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("Campaign Studio admits terminal artifact drafts from score 70 without approving them", () => {
  assert.match(app, /const CAMPAIGN_STUDIO_MIN_SCORE = 70;/);
  assert.match(app, /\["ready_for_review", "quality_blocked"\]\.includes\(job\?\.state\)/);
  assert.match(app, /getContentAgentJobQualityScore\(job\) >= CAMPAIGN_STUDIO_MIN_SCORE/);
  assert.match(app, /Editable Studio draft · not quality approved/);
  assert.match(app, /Quality blockers remain active; this is not an approved campaign/);
});

test("Campaign Studio refuses arbitrary or unfinished agent outputs", () => {
  assert.match(app, /if \(!isContentAgentJobStudioEligible\(job\) \|\| !output\?\.artifactPack\?\.artifacts\) return false;/);
});
