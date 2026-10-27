const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// A characterization test, like the other UI-adjacent ones here: it reads the source and pins what
// must not silently drift - above all the honesty requirements, which are easy to delete in a
// redesign and impossible to notice from a screenshot.

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const indexHtml = read("index.html");
const appJs = read("app.js");
const moduleJs = read("src", "klaviyo-subject-lines.js");
const klaviyoDomain = read("src", "klaviyo-dashboard-domain.js");
const templateDomain = read("src", "klaviyo-template-domain.js");
const apiJs = read("api", "klaviyo", "subject-lines.js");
const vercel = JSON.parse(read("vercel.json"));
const designSystemCss = read("design-system.css");

test("Subject lines is reachable from the rail and both view lists accept it", () => {
  assert.match(indexHtml, /data-klaviyo-view="subject_lines"/);
  assert.match(indexHtml, /id="klaviyo-subject-lines-panel"/);
  assert.match(appJs, /"canva_localizer",\s*"subject_lines"/);
  assert.match(klaviyoDomain, /"canva_localizer",\s*"subject_lines"/);
  assert.match(appJs, /klaviyo-subject-lines-panel/);
  assert.match(appJs, /loadSubjectLines\(\)/);
});

test("Campaign Studio's mode buttons never match the Campaign Studio panel itself", () => {
  // The panel carries data-campaign-mode for styles.css. An unscoped [data-campaign-mode] selector
  // marked the panel "active" on every Klaviyo render, so Campaign Studio showed above whichever
  // Klaviyo screen was open - found while building Subject lines, 2026-10-27.
  assert.doesNotMatch(appJs, /querySelectorAll\("\[data-campaign-mode\]"\)/);
  assert.match(appJs, /querySelectorAll\("button\[data-campaign-mode\]"\)/);
});

test("the three steps are one flow, and the suggestions are an inbox list", () => {
  for (const step of ['id="subject-step-campaign"', 'id="subject-step-brief"', 'id="subject-step-results"', "<h3>Campaign</h3>", "<h3>Brief</h3>", "<h3>Suggestions</h3>"]) {
    assert.ok(indexHtml.includes(step), `missing: ${step}`);
  }
  assert.match(moduleJs, /api\/klaviyo\/templates\?country=\$\{SOURCE_ACCOUNT\}/);
  assert.match(moduleJs, /const SOURCE_ACCOUNT = "DK"/);
  assert.match(moduleJs, /class="subject-inbox" role="list"/);
  // Duplicate & translate's own translated copies are not campaigns to write for.
  assert.match(moduleJs, /const ROLLOUT_DRAFT = /);
});

test("open rates are shown as an index against the market's own level, and the screen says why", () => {
  assert.match(moduleJs, /Apple Mail/);
  assert.match(moduleJs, /typical/);
  assert.match(indexHtml, /Apple Mail Privacy Protection opens mail nobody read/);
});

test("an A/B arm only 'won' when the test is clear, and the remainder note names Klaviyo's pick", () => {
  assert.match(moduleJs, /test\.verdict === "klar" \? "Won on opens" : "Ahead on opens"/);
  // Explained once above a list of tests, and marked on the arm itself.
  assert.match(moduleJs, /const REMAINDER_NOTE = "\+ rest of list: the larger arm was Klaviyo's pick/);
  assert.match(moduleJs, /class="subject-ab-rest"/);
});

test("the pattern bank says which lines are real and that none of it is measured", () => {
  assert.match(moduleJs, /Their results are unknown/);
  assert.match(moduleJs, /written for the bank and never sent/);
  assert.match(moduleJs, /Patterns, not proof/);
  assert.match(moduleJs, /sent by \$\{escapeHtml\(entry\.sender/);
});

test("a chosen pair reaches Duplicate & translate for that template only", () => {
  assert.match(moduleJs, /westpack-subject-line-use/);
  assert.match(appJs, /addEventListener\("westpack-subject-line-use"/);
  assert.match(appJs, /klaviyoTemplateSubjectOverride = \{/);
  assert.match(templateDomain, /chosen\.templateId !== template\?\.id/);
});

test("the chosen pair replaces the template name as the rollout's subject, for that template only", async () => {
  const { createKlaviyoTemplateDomain } = await import(`data:text/javascript;base64,${Buffer.from(templateDomain).toString("base64")}`);
  const appState = {
    klaviyoMarkets: ["DK", "DE"],
    klaviyoTemplateSourceAccount: "DK",
    klaviyoTemplateSourceTemplate: "YjmdfN",
    klaviyoTemplateLiveAccount: "DK",
    klaviyoTemplateCatalogLive: [{ id: "YjmdfN", account: "DK", name: "W45 Gaveæske feature – Grand Prix" }, { id: "XzKYJD", account: "DK", name: "W43: Højsæsonen" }],
    klaviyoTemplateSourceDetail: { id: "YjmdfN", account: "DK", name: "W45 Gaveæske feature – Grand Prix", subject: "", previewText: "Body text excerpt", html: "<p>x</p>" },
    klaviyoTemplateTargets: ["DE"]
  };
  const domain = createKlaviyoTemplateDomain({ appState });
  // Without a chosen line the rollout falls back to the template's name - the old behaviour.
  assert.equal(domain.getSelectedKlaviyoTemplate().subject, "W45 Gaveæske feature – Grand Prix");

  appState.klaviyoTemplateSubjectOverride = { account: "DK", templateId: "YjmdfN", subject: "Fire gaveæsker. Én titel.", preview: "Stem på din favorit med ét klik." };
  const chosen = domain.getSelectedKlaviyoTemplate();
  assert.equal(chosen.subject, "Fire gaveæsker. Én titel.");
  assert.equal(chosen.previewText, "Stem på din favorit med ét klik.");

  appState.klaviyoTemplateSourceTemplate = "XzKYJD";
  appState.klaviyoTemplateSourceDetail = { id: "XzKYJD", account: "DK", name: "W43: Højsæsonen", subject: "", html: "<p>y</p>" };
  assert.equal(domain.getSelectedKlaviyoTemplate().subject, "W43: Højsæsonen", "another template never inherits the line");
});

test("the screen records what is done with a line, remembers work per browser, and can preview markets", () => {
  for (const kind of ['recordUse("copy"', 'recordUse("save"', 'recordUse("use"']) assert.ok(moduleJs.includes(kind), kind);
  // Browser storage can throw (private window, blocked site data); the screen must still work.
  assert.match(moduleJs, /function readWork\(\) \{\s*try \{/);
  assert.match(moduleJs, /function saveWork\(\) \{\s*if[^\n]*\n\s*try \{/);
  assert.match(moduleJs, /data-subject-action="preview-markets"/);
  assert.match(moduleJs, /function renderCitedTests\(candidate\)/);
  assert.match(indexHtml, /data-subject-bank-tab="works"/);
  for (const action of ["tag_history", "preview_markets", "record_use"]) assert.ok(apiJs.includes(action), action);
  // The nightly cron may tag new lines without a session, like the sync.
  assert.match(apiJs, /action === "tag_history" && \(isVercelCronRequest\(req\) \|\| isAuthorizedCronRequest\(req, config\)\)/);
});

test("Duplicate & translate shows the chosen subject line and can drop it", () => {
  const rollout = read("src", "klaviyo-template-rollout.js");
  assert.match(indexHtml, /id="klaviyo-chosen-subject"/);
  assert.match(rollout, /subjectSource === "subject_lines"/);
  assert.match(appJs, /data-clear-chosen-subject/);
});

test("the API never writes to Klaviyo", () => {
  assert.doesNotMatch(apiJs, /method:\s*"(PATCH|PUT|DELETE)"/);
  assert.doesNotMatch(apiJs, /campaign-messages|\/api\/campaigns\//);
  const history = read("server", "klaviyo", "subject-line-history.js");
  // The only POST is the read-only metric-aggregates query.
  const posts = history.match(/method: "POST"/g) || [];
  assert.equal(posts.length, 1);
  assert.match(history, /metric-aggregates/);
});

test("the history sync runs nightly and the route has the long function budget", () => {
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/klaviyo/subject-lines?action=sync_history"));
  assert.equal(vercel.functions["api/klaviyo/subject-lines.js"].maxDuration, 300);
});

test("status is never colour alone, and the screen is styled in the design system", () => {
  assert.match(moduleJs, /aria-label="Breaks a rule">■/);
  assert.match(moduleJs, /aria-label="Check">▲/);
  assert.match(moduleJs, /aria-label="Passes the rules">●/);
  const ownCss = designSystemCss.slice(designSystemCss.indexOf("   Subject lines"));
  assert.match(ownCss, /\.subject-row \{/);
  assert.doesNotMatch(ownCss, /#[0-9a-f]{3,6}\b/i, "colours come from tokens");
  assert.doesNotMatch(ownCss, /box-shadow:\s*0\s/, "no drop shadows on a work surface");
});
