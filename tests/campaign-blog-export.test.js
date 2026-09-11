const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const appSource = readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const stylesSource = readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("the blog article has a way out of Studio, like email and Meta already do", () => {
  // Email hands off as a Klaviyo draft and the carousel as a paused Meta ad. The article used to
  // have no export at all - an operator had to select raw HTML inside a textarea by hand.
  assert.match(appSource, /data-campaign-blog-export="copy"/);
  assert.match(appSource, /data-campaign-blog-export="download"/);
  assert.match(appSource, /const blogExportButton = target\.closest\("\[data-campaign-blog-export\]"\)/);
});

test("the export reads the draft at click time, so operator edits are included", () => {
  const start = appSource.indexOf("function buildCampaignBlogExportDocument()");
  const end = appSource.indexOf("function buildCampaignBlogExportFilename()", start);
  assert.ok(start > 0 && end > start, "the export document builder must exist");

  const builder = appSource.slice(start, end);
  assert.match(builder, /appState\.campaignArtifactDraft\?\.artifacts\?\.blog/);
  assert.match(builder, /<!doctype html>/);
  assert.match(builder, /escapeHtml\(title\)/);
});

test("a missing article is refused rather than exporting an empty document", () => {
  const start = appSource.indexOf("async function exportCampaignBlogArticle(");
  const end = appSource.indexOf("function setCampaignStudioBlogExportFeedback(", start);
  const exporter = appSource.slice(start, end);

  assert.match(exporter, /if \(!String\(blog\.bodyHtml \|\| ""\)\.trim\(\)\)/);
  assert.match(exporter, /There is no article HTML to export yet/);
});

test("a blocked clipboard tells the operator to download instead of failing silently", () => {
  const start = appSource.indexOf("async function exportCampaignBlogArticle(");
  const end = appSource.indexOf("function setCampaignStudioBlogExportFeedback(", start);
  const exporter = appSource.slice(start, end);

  assert.match(exporter, /navigator\.clipboard\.writeText/);
  assert.match(exporter, /catch \(error\) \{/);
  assert.match(exporter, /Use Download instead/);
});

test("the object URL is revoked, but not before the download can start", () => {
  const start = appSource.indexOf("async function exportCampaignBlogArticle(");
  const end = appSource.indexOf("function setCampaignStudioBlogExportFeedback(", start);
  const exporter = appSource.slice(start, end);

  assert.match(exporter, /URL\.createObjectURL/);
  assert.match(exporter, /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(blobUrl\), 10_000\)/);
});

test("the export filename is derived from the slug and is always safe", () => {
  const start = appSource.indexOf("function buildCampaignBlogExportFilename()");
  const end = appSource.indexOf("async function exportCampaignBlogArticle(", start);
  const builder = appSource.slice(start, end);

  assert.match(builder, /replace\(\/\[\^a-z0-9\]\+\/g, "-"\)/);
  assert.match(builder, /westpack-campaign-article/, "there is a fallback when nothing is named");
});

test("the export controls and their feedback line are styled", () => {
  assert.match(stylesSource, /\.campaign-studio-blog-actions \{/);
  assert.match(stylesSource, /\.campaign-studio-blog-export-feedback \{/);
});
