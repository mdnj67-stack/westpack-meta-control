const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const services = fs.readFileSync(path.join(root, "src", "services.js"), "utf8");

test("Learning Studio exposes transparent patterns, effectiveness and evidence controls", () => {
  assert.match(app, /function renderCampaignLearningStudio/);
  assert.match(app, /Repeated preferences/);
  assert.match(app, /Decision → outcome links/);
  assert.match(app, /data-learning-operation="approve"/);
  assert.match(app, /data-learning-operation="disable"/);
  assert.match(app, /data-learning-operation="delete"/);
});

test("Learning Studio moderation is wired to the authenticated API", () => {
  assert.match(app, /requestCampaignLearningModeration\(eventId, operation\)/);
  assert.match(services, /action: "campaign_learning_moderate"/);
  assert.match(app, /learningDeleteConfirmId !== eventId/);
});

test("Learning Studio has desktop and responsive design contracts", () => {
  assert.match(styles, /\.campaign-learning-studio\s*\{/);
  assert.match(styles, /\.campaign-learning-columns\s*\{/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
});
