const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EMAIL_MODULES,
  EMAIL_MODULE_SYSTEM_VERSION,
  WESTPACK_EMAIL_MASTER,
  buildEmailModulePromptBlock,
  normalizeEmailSections
} = require("../server/campaign/email-module-library");
const { compileCampaignEmailDraft } = require("../server/campaign/brain");
const { renderPremiumCampaignEmail } = require("../server/campaign/email-design");

function section(moduleId, index) {
  return {
    moduleId,
    layout: moduleId,
    label: `Module ${index + 1}`,
    headline: `A decisive module ${index + 1}`,
    body: "Complete, campaign-specific supporting copy.",
    bullets: ["Proof one", "Proof two", "Proof three", "Proof four"],
    imageUrl: "https://cdn.example.com/product.jpg",
    imageAlt: "Westpack product"
  };
}

test("Westpack master exposes ten unique approved modules and locked regions", () => {
  assert.equal(EMAIL_MODULES.length, 10);
  assert.equal(new Set(EMAIL_MODULES.map((module) => module.id)).size, 10);
  assert.equal(WESTPACK_EMAIL_MASTER.headerUniversalId, "dfdb43a7c0604849ac74c09f7919ae09");
  assert.equal(WESTPACK_EMAIL_MASTER.footerUniversalId, "3cf1619390714ca7a5d735fad6ad82d5");
  assert.deepEqual(WESTPACK_EMAIL_MASTER.lockedRegions, ["preheader", "header", "footer", "legal"]);
  assert.match(buildEmailModulePromptBlock(), /may never be generated as campaign sections/i);
});

test("email sections are normalized to the approved four-module contract", () => {
  const normalized = normalizeEmailSections([
    section("statement", 0), section("benefit_grid", 1), section("testimonial", 2),
    section("offer_panel", 3), section("steps", 4)
  ]);
  assert.equal(normalized.length, 4);
  assert.deepEqual(normalized.map((item) => item.position), [1, 2, 3, 4]);
  assert.deepEqual(normalized.map((item) => item.layout), normalized.map((item) => item.moduleId));
});

test("image ownership state survives module normalization", () => {
  const normalized = normalizeEmailSections([
    { ...section("image_full", 0), imageMode: "assigned" },
    { ...section("image_left", 1), imageUrl: "", imageAlt: "", imageMode: "none" }
  ]);
  assert.equal(normalized[0].imageMode, "assigned");
  assert.equal(normalized[1].imageMode, "none");
});

test("image crop and focal settings are normalised to safe editor values", () => {
  const normalized = normalizeEmailSections([
    { ...section("image_full", 0), imageAspect: "portrait", imageFocalPoint: "bottom_right" },
    { ...section("image_left", 1), imageAspect: "unsupported", imageFocalPoint: "somewhere" }
  ]);
  assert.equal(normalized[0].imageAspect, "portrait");
  assert.equal(normalized[0].imageFocalPoint, "bottom_right");
  assert.equal(normalized[1].imageAspect, "natural");
  assert.equal(normalized[1].imageFocalPoint, "center");
});

test("module spacing is normalised to the supported density contract", () => {
  const normalized = normalizeEmailSections([
    { ...section("statement", 0), spacing: "compact" },
    { ...section("benefit_grid", 1), spacing: "airy" },
    { ...section("editorial_text", 2), spacing: "extreme" }
  ]);
  assert.deepEqual(normalized.map((item) => item.spacing), ["compact", "airy", "balanced"]);
});

test("module design controls are normalised to email-safe choices", () => {
  const normalized = normalizeEmailSections([
    { ...section("editorial_text", 0), textAlign: "center", contentWidth: "narrow", surfaceStyle: "soft" },
    { ...section("editorial_text", 1), textAlign: "right", contentWidth: "wide", surfaceStyle: "glass" }
  ]);
  assert.deepEqual(
    normalized.map(({ textAlign, contentWidth, surfaceStyle }) => ({ textAlign, contentWidth, surfaceStyle })),
    [
      { textAlign: "center", contentWidth: "narrow", surfaceStyle: "soft" },
      { textAlign: "left", contentWidth: "standard", surfaceStyle: "plain" }
    ]
  );
});

test("all v2 module compositions render with deterministic email markers", () => {
  for (const module of EMAIL_MODULES) {
    const html = renderPremiumCampaignEmail({
      subject: module.label,
      primaryCta: "Read more",
      sections: [section(module.id, 0)]
    }, { title: module.label, resolvedEmailImageUrls: ["https://cdn.example.com/product.jpg"] });
    assert.match(html, new RegExp(`data-email-module="${module.id}"`));
  }
});

test("server compiler locks master and module metadata onto every draft", () => {
  const email = compileCampaignEmailDraft({ title: "Campaign", markets: ["DK"] }, {
    subject: "Campaign",
    primaryCta: "Read more",
    sections: [section("statement", 0), section("benefit_grid", 1), section("testimonial", 2)]
  });
  assert.equal(email.moduleSystem.version, EMAIL_MODULE_SYSTEM_VERSION);
  assert.equal(email.moduleSystem.master.id, WESTPACK_EMAIL_MASTER.id);
  assert.equal(email.moduleSystem.locked, true);
  assert.equal(email.moduleSystem.modules.length, 3);
  assert.equal(email.universalContent.locked, true);
});
