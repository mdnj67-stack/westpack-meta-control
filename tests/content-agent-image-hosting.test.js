const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const {
  hostCampaignImageUrls,
  isPermanentlyHostedImageUrl
} = require("../server/campaign/email-asset-hosting");

const workerSource = readFileSync(path.join(__dirname, "..", "server", "campaign", "content-agent-worker.js"), "utf8");
const apiSource = readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

const config = { klaviyoMarketsJson: JSON.stringify([{ country: "DK", privateKey: "pk_test" }]) };
const ASANA = "https://asanausercontent.com/us1/assets/1207122310807246/1215919442964552/c4272d";
const ASANA_REFRESHED = "https://asanausercontent.com/us1/assets/1207122310807246/1215919442964552/99ffee";
const HOSTED = "https://d3k81ch9hvuctc.cloudfront.net/company/VRPp5S/images/09b9808b.jpg";

function recordingUpload(imageUrl = HOSTED) {
  const calls = [];
  const upload = async (_config, account, sourceUrl, name) => {
    calls.push({ account, sourceUrl, name });
    return { id: `img_${calls.length}`, imageUrl };
  };
  return { calls, upload };
}

test("an expiring Asana URL is copied into the Klaviyo library and replaced by the hosted one", async () => {
  const { calls, upload } = recordingUpload();
  const result = await hostCampaignImageUrls(config, [ASANA], { upload });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceUrl, ASANA);
  assert.equal(result.hostedByUrl.get(ASANA), HOSTED);
  assert.equal(result.replacements.get(ASANA), HOSTED);
  assert.equal(result.hostedCount, 1);
  assert.deepEqual(result.failures, []);
});

test("a URL already on the Klaviyo CDN is never re-imported", async () => {
  const { calls, upload } = recordingUpload();
  const result = await hostCampaignImageUrls(config, [HOSTED], { upload });

  assert.equal(calls.length, 0, "an already permanent image must not be uploaded again");
  assert.equal(result.hostedByUrl.get(HOSTED), HOSTED);
  assert.equal(result.replacements.size, 0, "an unchanged URL is not a replacement");
  assert.ok(isPermanentlyHostedImageUrl(HOSTED));
  assert.ok(!isPermanentlyHostedImageUrl(ASANA));
});

test("the cache is keyed by asset identity, so a refreshed Asana URL reuses the hosted copy", async () => {
  // Every pipeline stage runs in a fresh invocation and re-reads Asana, which hands back a new
  // signed URL for the same photograph. Keying the cache on the URL would re-import the image at
  // every stage and fill the Klaviyo library with duplicates.
  const { calls, upload } = recordingUpload();
  const keyForUrl = (url) => (url.includes("1215919442964552") ? "detail-photograph" : url);

  const first = await hostCampaignImageUrls(config, [ASANA], { upload, keyForUrl });
  const second = await hostCampaignImageUrls(config, [ASANA_REFRESHED], { upload, keyForUrl, cache: first.cache });

  assert.equal(calls.length, 1, "the same photograph must only be imported once across stages");
  assert.equal(second.hostedByUrl.get(ASANA_REFRESHED), HOSTED);
});

test("a failed upload keeps the source URL and is reported instead of losing the campaign", async () => {
  const upload = async () => { throw new Error("Klaviyo rejected the import."); };
  const result = await hostCampaignImageUrls(config, [ASANA], { upload });

  assert.equal(result.hostedByUrl.get(ASANA), ASANA);
  assert.equal(result.replacements.size, 0);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].sourceUrl, ASANA);
  assert.match(result.failures[0].error, /Klaviyo rejected the import/);
});

test("a non-HTTPS or private-network asset is refused rather than handed to Klaviyo", async () => {
  const { calls, upload } = recordingUpload();
  const result = await hostCampaignImageUrls(config, ["http://127.0.0.1/secret.jpg", "https://192.168.1.5/a.jpg"], { upload });

  assert.equal(calls.length, 0);
  assert.equal(result.failures.length, 2);
});

test("the worker hosts campaign imagery itself, not only the browser", () => {
  // The 24/7 worker used to leave expiring Asana URLs in every artifact it produced, because
  // permanent hosting only ever ran from Campaign Studio in the operator's browser.
  assert.match(workerSource, /require\("\.\/email-asset-hosting"\)/);
  assert.match(workerSource, /hostCampaignImagery/);

  const freshStart = workerSource.indexOf("hostedAssetUrls = {};");
  assert.ok(freshStart > 0, "the fresh production path must start a clean hosted-asset map");
  const readinessIndex = workerSource.indexOf("const sourceReadiness = evaluateSourceReadiness", freshStart);
  const hostingIndex = workerSource.indexOf("const sourceHosting = await hostCampaignImagery", freshStart);
  assert.ok(hostingIndex > 0 && hostingIndex < readinessIndex, "hosting must run before source readiness and any AI generation");
});

test("the hosted URL map survives a resume, because every stage is a fresh invocation", () => {
  const checkpointStart = workerSource.indexOf("const createCheckpoint = () => ({");
  const checkpointEnd = workerSource.indexOf("});", checkpointStart);
  assert.match(workerSource.slice(checkpointStart, checkpointEnd), /hostedAssetUrls/);
  assert.match(workerSource, /hostedAssetUrls = checkpoint\.hostedAssetUrls/);
});

test("a resumed job rewrites artifacts it checkpointed with expiring URLs", () => {
  assert.match(workerSource, /artifactPack = remapAssetUrls\(artifactPack, resumeHosting\.replacements\)/);
  assert.match(workerSource, /bestArtifactPack = remapAssetUrls\(bestArtifactPack, resumeHosting\.replacements\)/);
  assert.match(workerSource, /channelDrafts = remapAssetUrls\(channelDrafts, resumeHosting\.replacements\)/);
});

test("there is one Klaviyo image uploader, shared by the API route and the worker", () => {
  assert.match(apiSource, /require\("\.\.\/\.\.\/server\/campaign\/email-asset-hosting"\)/);
  assert.doesNotMatch(apiSource, /async function uploadEmailVisualToKlaviyo/);
  assert.doesNotMatch(apiSource, /async function uploadEmailVisualFileToKlaviyo/);
  assert.doesNotMatch(apiSource, /function assertSafeCampaignAssetUrl/);
});
