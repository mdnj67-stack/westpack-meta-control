const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const apiSource = readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

test("campaign image proxy streams large source images for the crop canvas", () => {
  const start = apiSource.indexOf("async function proxyCampaignAsset");
  const end = apiSource.indexOf("async function downloadCampaignAssetFile", start);
  const proxySource = apiSource.slice(start, end);

  assert.match(proxySource, /const maxStreamBytes = 20_000_000/);
  assert.match(proxySource, /for await \(const chunk of response\.body\)/);
  assert.match(proxySource, /res\.write\(Buffer\.from\(chunk\)\)/);
  assert.doesNotMatch(proxySource, /response\.arrayBuffer\(\)/);
});
