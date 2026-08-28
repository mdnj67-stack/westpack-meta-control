import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("email editor exposes a dedicated image workflow with direct upload", () => {
  assert.match(appSource, /\["content", "image", "design", "ai"\]/);
  assert.match(appSource, /data-email-builder-file-upload=/);
  assert.match(appSource, /Upload replacement/);
  assert.match(appSource, /Crop & position/);
  assert.match(appSource, /uploadCampaignEmailModuleImage/);
  assert.match(appSource, /uploadCampaignEmailHeroImage/);
  assert.match(appSource, /data-email-builder-image-target="hero"/);
  assert.match(appSource, /CAMPAIGN_EMAIL_UPLOAD_MAX_BYTES = 3_000_000/);
  assert.match(styleSource, /\.campaign-email-builder-image-workflow/);
});

test("text editing no longer duplicates the legacy image controls", () => {
  assert.match(styleSource, /\.campaign-email-builder-inspector\[data-active-tab="content"\] > \.campaign-email-builder-media/);
  assert.match(appSource, /data-email-builder-convert-image=/);
  assert.match(appSource, /appState\.campaignEmailBuilder\.inspectorTab = "image"/);
});

test("canvas selection excludes the hero wrapper from editable module indexes", () => {
  assert.match(appSource, /node\.getAttribute\("data-email-region"\) !== "hero"/);
  assert.match(appSource, /state\.cropEditorOpen/);
  assert.match(appSource, /campaign-email-crop-error/);
});

test("long campaign titles cannot cover the Studio entry action", () => {
  assert.match(appSource, /campaignName\.length >= 54/);
  assert.match(appSource, /is-very-long-title/);
  assert.match(styleSource, /\.content-agent-focus-copy\.is-long-title h3/);
  assert.match(styleSource, /\.content-agent-focus-copy\.is-very-long-title h3/);
});

test("module drag exposes the drop surface before the iframe can intercept it", () => {
  const pressIndex = appSource.indexOf("appState.campaignEmailBuilder.draggingModuleId = libraryModuleId;");
  const moveIndex = appSource.indexOf("const move = (moveEvent) =>", pressIndex);
  assert.ok(pressIndex >= 0);
  assert.ok(appSource.indexOf('setCampaignEmailBuilderDragSurface(true, "module");', pressIndex) < moveIndex);
  assert.doesNotMatch(appSource, /<article draggable="true" data-email-builder-library-module=/);
});

test("image drag uses one pointer workflow and exposes compatible targets on press", () => {
  const sourceIndex = appSource.indexOf('const builderImageSource = event.target.closest("[data-email-builder-image-url]");');
  const surfaceIndex = appSource.indexOf('setCampaignEmailBuilderDragSurface(true, "image");', sourceIndex);
  const moveIndex = appSource.indexOf("const move = (moveEvent) =>", sourceIndex);
  assert.ok(sourceIndex >= 0);
  assert.ok(surfaceIndex > sourceIndex);
  assert.ok(surfaceIndex < moveIndex);
  assert.doesNotMatch(appSource, /draggable="true" data-email-builder-image-url=/);
  const galleryImages = appSource.match(/<img draggable="false" src="\$\{escapeHtml\(asset\.proxyUrl \|\| asset\.imageUrl \|\| asset\.sourceUrl \|\| ""\)\}"/g) || [];
  assert.equal(galleryImages.length, 2);
});

test("remote campaign assets keep their source URL for direct Klaviyo import", () => {
  assert.match(appSource, /requestCampaignEmailAssetHosting\(\{\s*sourceUrl,\s*name: alt,/);
  assert.doesNotMatch(appSource, /optimizeCampaignEmailImageForHosting/);
});

test("crop reads hosted images through the authenticated same-origin proxy", () => {
  assert.match(appSource, /const cropSourceUrl = \/\^\\\/api\\\/campaign\\\/brain/);
  assert.match(appSource, /asset_proxy&url=\$\{encodeURIComponent\(sourceUrl\)\}/);
  assert.match(appSource, /node\.src = cropSourceUrl/);
  assert.match(appSource, /section\.imageSourceUrl = String\(sourceUrl \|\| url\)\.trim\(\)/);
});

test("an async email compile preserves the module selected while it was running", () => {
  const responseGuard = appSource.indexOf("if (sequence !== campaignEmailCompileSequence || !payload?.email) return;");
  const selectionRead = appSource.indexOf("const activeSelectedIndex = Number(appState.campaignEmailBuilder?.selectedIndex || 0);", responseGuard);
  const emailReplace = appSource.indexOf("appState.campaignArtifactDraft.artifacts.email = payload.email;", responseGuard);
  assert.ok(responseGuard >= 0);
  assert.ok(selectionRead > responseGuard);
  assert.ok(selectionRead < emailReplace);
  assert.match(appSource, /Math\.min\(activeSelectedIndex, \(payload\.email\.sections\?\.length \|\| 1\) - 1\)/);
});

test("crop writes the hosted result back to the current module after async work", () => {
  const cropStart = appSource.indexOf("async function applyCampaignEmailImageCrop()");
  const cropEnd = appSource.indexOf("function moveCampaignEmailModule", cropStart);
  const cropSource = appSource.slice(cropStart, cropEnd);
  const uploadIndex = cropSource.indexOf("await requestCampaignEmailAssetHosting");
  const activeSectionIndex = cropSource.indexOf("const activeSection = appState.campaignArtifactDraft");

  assert.ok(uploadIndex >= 0);
  assert.ok(activeSectionIndex > uploadIndex);
  assert.match(cropSource, /activeSection\.imageUrl = result\.imageUrl/);
  assert.match(cropSource, /role: "cropped campaign asset"/);
  assert.match(cropSource, /activeEmail\.visualAssets = visualAssets\.slice\(-12\)/);
  assert.doesNotMatch(cropSource, /section\.imageUrl = result\.imageUrl/);
});

test("assigning a hero image makes it visible from a typographic-only layout", () => {
  const selectStart = appSource.indexOf("function selectCampaignEmailHeroImage");
  const selectEnd = appSource.indexOf("async function uploadCampaignEmailHeroImage", selectStart);
  const selectSource = appSource.slice(selectStart, selectEnd);

  assert.match(selectSource, /if \(email\.heroLayout === "typographic"\) email\.heroLayout = "image_first"/);
});
