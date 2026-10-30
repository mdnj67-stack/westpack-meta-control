const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const { assertSafeCampaignAssetUrl } = require("../server/campaign/email-asset-hosting");

const apiSource = readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

test("remote email assets use Klaviyo URL import instead of a size-limited Vercel download", () => {
  const actionStart = apiSource.indexOf('if (action === "host_email_asset")');
  const actionEnd = apiSource.indexOf('if (action === "asset_library_save")', actionStart);
  assert.ok(actionStart > 0 && actionEnd > actionStart, "the host_email_asset action must be found before asset_library_save");
  const actionSource = apiSource.slice(actionStart, actionEnd);

  assert.match(actionSource, /uploadEmailVisualToKlaviyo/);
  assert.match(actionSource, /assertSafeCampaignAssetUrl\(rawInput\?\.sourceUrl/);
  assert.doesNotMatch(actionSource, /downloadCampaignAssetFile/);
  assert.match(actionSource, /uploadEmailVisualFileToKlaviyo/);
});

test("there is one Klaviyo image uploader, and the API route uses it rather than a copy", () => {
  assert.match(apiSource, /require\("\.\.\/\.\.\/server\/campaign\/email-asset-hosting"\)/);
  assert.doesNotMatch(apiSource, /async function uploadEmailVisualToKlaviyo/);
  assert.doesNotMatch(apiSource, /async function uploadEmailVisualFileToKlaviyo/);
  assert.doesNotMatch(apiSource, /function assertSafeCampaignAssetUrl/);
});

test("a non-HTTPS or private-network asset is refused rather than handed to Klaviyo", () => {
  assert.throws(() => assertSafeCampaignAssetUrl("http://example.com/a.jpg"), /HTTPS/);
  for (const url of ["https://127.0.0.1/secret.jpg", "https://localhost/a.jpg", "https://192.168.1.5/a.jpg", "https://10.0.0.2/a.jpg", "https://169.254.169.254/latest", "https://172.16.0.1/a.jpg"]) {
    assert.throws(() => assertSafeCampaignAssetUrl(url), /not allowed/, url);
  }
  assert.equal(
    assertSafeCampaignAssetUrl("https://asanausercontent.com/us1/assets/1/2/c4272d"),
    "https://asanausercontent.com/us1/assets/1/2/c4272d"
  );
});
