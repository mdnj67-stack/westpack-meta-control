const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The autonomous Content Agent was decommissioned on 2026-10-30: 60 jobs, one admitted to review.
// Campaign Studio's manual path stays. These pin the removal, and the two ways it could break the
// rest of the Studio if it were half undone.

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("the worker and the modules only it used are gone", () => {
  for (const file of ["content-agent-worker.js", "content-agent.js", "quality-agent.js", "creative-production.js"]) {
    assert.equal(fs.existsSync(path.join(root, "server", "campaign", file)), false, file);
  }
});

test("the API has no agent actions, and no request reaches it without the dashboard session", () => {
  const api = read("api", "campaign", "brain.js");
  assert.doesNotMatch(api, /agent_(status|scan|work|discover|start|control|retry|reject_restart)/);
  // The hourly scheduler used to call in with CRON_SECRET and an action header instead of a
  // session. Nothing else needs that, so it must not come back with the agent gone.
  assert.doesNotMatch(api, /x-content-agent-action/i);
  assert.doesNotMatch(api, /cronSecret/);
  assert.match(api, /if \(!requireAuth\(req, res, config\)\) \{\r?\n\s*return;\r?\n\s*\}/);
});

test("the browser neither calls nor renders the agent", () => {
  assert.doesNotMatch(read("src", "services.js"), /agent_(status|start|control|retry|reject_restart)/);
  assert.doesNotMatch(read("app.js"), /content-agent|contentAgent|ContentAgent|campaignStudioReviewJob/);
  assert.doesNotMatch(read("index.html"), /content-agent/);
});

test("Campaign Studio opens on its own workspace, which nothing hides any more", () => {
  // The agent console held the only button that opened the workspace, and a rule hid the
  // workspace until it was pressed. Without the console that rule would leave the page empty.
  assert.doesNotMatch(read("styles.css"), /is-manual-workspace-open/);
  assert.doesNotMatch(read("design-system.css"), /is-manual-workspace-open/);
  assert.doesNotMatch(read("app.js"), /campaignManualWorkspaceOpen/);
  // The manual path's own entry points must still be there.
  const app = read("app.js");
  assert.match(app, /id="campaign-asana-load-button"/);
  assert.match(app, /id="campaign-meta-master-generate"/);
  assert.match(app, /requestCampaignArtifacts\(/);
});

test("CONTENT_AGENT_MODEL stays: the subject line writers run on it", () => {
  assert.match(read("server", "lib", "config.js"), /contentAgentModel: process\.env\.CONTENT_AGENT_MODEL/);
  assert.match(read("server", "klaviyo", "subject-line-generator.js"), /config\.contentAgentModel/);
});
