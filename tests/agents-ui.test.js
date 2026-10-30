const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("the rail has an Agents group with Overview, Watchdog and Email check", () => {
  const html = read("index.html");
  assert.match(html, /<p class="wp-nav-group-label" id="wp-nav-label-agents">Agents<\/p>/);
  for (const view of ["overview", "watchdog", "email_check"]) {
    assert.match(html, new RegExp(`data-agents-view="${view}" data-nav-workspace="agents"`));
    assert.match(html, new RegExp(`data-agents-panel="${view}"`));
  }
  assert.match(html, /id="agents-watchdog-count"/);
  assert.match(html, /id="agents-product-panel"/);
});

test("Agents is a workspace of its own: 'not Meta' no longer means Klaviyo", () => {
  const app = read("app.js");
  assert.match(app, /import \{ initAgents, refreshAgentsBadge, showAgentsView \} from "\.\/src\/agents\.js\?v=/);
  assert.match(app, /appState\.workspace = \["klaviyo", "agents"\]\.includes\(nextWorkspace\) \? nextWorkspace : "meta";/);
  assert.match(app, /getElementById\("klaviyo-product-panel"\)\?\.classList\.toggle\("active", isKlaviyo\)/);
  assert.match(app, /getElementById\("agents-product-panel"\)\?\.classList\.toggle\("active", appState\.workspace === "agents"\)/);
  assert.doesNotMatch(app, /if \(!isMeta\) \{\s*renderKlaviyoWorkspace\(\)/);
  assert.match(app, /refreshAgentsBadge\(\)\.catch/);
});

test("while Agents is open, neither platform group reads as current", () => {
  const css = read("design-system.css");
  assert.match(css, /body\[data-workspace="agents"\] \.tab-button\.active,\s*body\[data-workspace="agents"\] \.subnav-button\.active \{/);
  assert.match(css, /\.wp-nav-item > \.wp-nav-count \{/);
});

test("the watchdog runs every hour, and the scheduled run is accepted only with the cron secret", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/agents?action=watchdog_run" && cron.schedule === "7 * * * *"));
  assert.equal(vercel.functions["api/agents.js"].includeFiles, "knowledge/westpack-site/README.md");
  const route = read("api", "agents.js");
  assert.match(route, /if \(action === "watchdog_run" && req\.method === "GET"\) \{\s*if \(!isAuthorizedCronRequest\(req, config\)\)/);
  // A header anyone can send is not proof the request came from Vercel's scheduler.
  assert.doesNotMatch(route, /x-vercel-cron|vercel-cron/i);
});

test("the page uses the design system's own components, and shows severity in words", () => {
  const source = read("src", "agents.js");
  for (const component of ["wp-badge", "wp-status", "wp-metrics", "wp-table", "wp-state", "wp-alert", "wp-segment", "wp-select", "wp-textarea", "wp-button"]) {
    assert.match(source, new RegExp(component), component);
  }
  assert.match(source, /must_fix: \{ label: "Must fix"/);
  assert.match(source, /error: \{ label: "Couldn't check"/);
  assert.doesNotMatch(source, /window\.prompt|alert\(/);
});
