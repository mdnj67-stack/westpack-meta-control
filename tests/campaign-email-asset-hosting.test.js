const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const apiSource = readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

test("remote email assets use Klaviyo URL import instead of a size-limited Vercel download", () => {
  const actionStart = apiSource.indexOf('if (action === "host_email_asset")');
  const actionEnd = apiSource.indexOf('if (action === "agent_start")', actionStart);
  const actionSource = apiSource.slice(actionStart, actionEnd);

  assert.match(actionSource, /uploadEmailVisualToKlaviyo/);
  assert.match(actionSource, /assertSafeCampaignAssetUrl\(rawInput\?\.sourceUrl/);
  assert.doesNotMatch(actionSource, /downloadCampaignAssetFile/);
  assert.match(actionSource, /uploadEmailVisualFileToKlaviyo/);
});
