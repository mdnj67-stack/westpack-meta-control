const test = require("node:test");
const assert = require("node:assert/strict");
const { isStaticImageUrl, renderPremiumCampaignEmail } = require("../server/campaign/email-design");
const { getUniversalContentStatus } = require("../server/campaign/email-universal-content");

const email = {
  subject: "WTP",
  primaryCta: "Læs mere",
  primaryCtaUrl: "",
  sections: [],
  closingHeadline: "Næste skridt",
  closingBody: "CTA afventer godkendelse."
};

test("draft email CTA stays visibly designed but non-clickable without an approved URL", () => {
  const html = renderPremiumCampaignEmail(email, { title: "WTP", markets: ["DK"] });
  assert.match(html, /data-primary-cta="true"[^>]*>Læs mere<\/span>/);
  assert.doesNotMatch(html, /<a[^>]*data-primary-cta="true"/i);
  assert.doesNotMatch(html, /https:\/\/www\.westpack\.com/i);
});

test("approved CTA URL is preserved exactly", () => {
  const html = renderPremiumCampaignEmail({ ...email, primaryCtaUrl: "https://example.com/wtp" }, { title: "WTP" });
  assert.match(html, /href="https:\/\/example\.com\/wtp"/);
});

test("video assets can never be compiled as email images", () => {
  assert.equal(isStaticImageUrl("https://cdn.example.com/campaign.mp4", "video/mp4"), false);
  assert.equal(isStaticImageUrl("https://cdn.example.com/campaign.mp4", "image/jpeg"), false);
  assert.equal(isStaticImageUrl("https://cdn.example.com/campaign.jpg", "image/jpeg"), true);
  const html = renderPremiumCampaignEmail({
    ...email,
    heroImageUrl: "https://cdn.example.com/campaign.mp4",
    bodyHtml: '<img src="https://cdn.example.com/campaign.mp4">'
  }, { title: "WTP", assets: ["https://cdn.example.com/campaign.mp4"] });
  assert.doesNotMatch(html, /campaign\.mp4/);
});

test("art-directed section modules render distinct email-safe compositions", () => {
  const imageUrl = "https://cdn.example.com/product.jpg";
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "image_first",
    heroImageUrl: imageUrl,
    heroHeadline: "A designed campaign",
    sections: [
      { label: "Process", headline: "Three clear steps", body: "A real progression.", bullets: ["Brief", "Proof", "Ready"], layout: "steps", imageUrl: "", imageAlt: "" },
      { label: "Product", headline: "See the detail", body: "Image and copy work together.", bullets: [], layout: "image_left", imageUrl, imageAlt: "Product detail" },
      { label: "Point of view", headline: "One decisive statement", body: "Editorial contrast closes the story.", bullets: [], layout: "statement", imageUrl: "", imageAlt: "" }
    ]
  }, { title: "WTP", resolvedEmailImageUrls: [imageUrl] });
  assert.match(html, /class="stack-column"/);
  assert.match(html, />01<\/td>/);
  assert.match(html, /width:4px;background:/);
  assert.match(html, /\.stack-column\{display:block!important;width:100%!important\}/);
});

test("a Klaviyo-hosted image selected in the builder renders without being in the original brief", () => {
  const imageUrl = "https://d3k81ch9hvuctc.cloudfront.net/company/test/images/builder-image.jpg";
  const html = renderPremiumCampaignEmail({
    ...email,
    sections: [{
      label: "Visual",
      headline: "Visible product focus",
      body: "The builder image must survive server compilation.",
      bullets: [],
      moduleId: "image_full",
      layout: "image_full",
      imageUrl,
      imageAlt: "Westpack product"
    }],
    visualAssets: [{ imageUrl, hosted: true }]
  }, { title: "WTP", assets: [] });
  assert.match(html, /data-email-module="image_full"/);
  assert.match(html, /src="https:\/\/d3k81ch9hvuctc\.cloudfront\.net\/company\/test\/images\/builder-image\.jpg"/);
});

test("an image explicitly removed in the builder is never replaced by a positional fallback", () => {
  const fallbackUrl = "https://cdn.example.com/fallback.jpg";
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "typographic",
    sections: [{
      label: "Visual",
      headline: "Intentionally image free",
      body: "The operator removed this module image.",
      bullets: [],
      moduleId: "image_full",
      layout: "image_full",
      imageUrl: "",
      imageAlt: "",
      imageMode: "none"
    }]
  }, { title: "WTP", resolvedEmailImageUrls: [fallbackUrl] });
  assert.doesNotMatch(html, /fallback\.jpg/);
  assert.match(html, /data-email-module="image_full"/);
});

test("assigned module images remain attached to their section after reordering", () => {
  const firstUrl = "https://cdn.example.com/first.jpg";
  const secondUrl = "https://cdn.example.com/second.jpg";
  const movedSection = {
    label: "Moved",
    headline: "The selected image moves with this module",
    body: "Image ownership must not depend on array position.",
    bullets: [],
    moduleId: "image_left",
    layout: "image_left",
    imageUrl: secondUrl,
    imageAlt: "Second product",
    imageMode: "assigned"
  };
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "typographic",
    sections: [movedSection, {
      ...movedSection,
      label: "No image",
      headline: "Explicitly empty",
      imageUrl: "",
      imageAlt: "",
      imageMode: "none"
    }]
  }, { title: "WTP", resolvedEmailImageUrls: [firstUrl, secondUrl] });
  assert.match(html, /src="https:\/\/cdn\.example\.com\/second\.jpg"/);
  assert.doesNotMatch(html, /first\.jpg/);
});

test("assigned fifth and sixth validated images survive agent compilation", () => {
  const resolvedImages = Array.from({ length: 6 }, (_, index) => `https://cdn.example.com/product-${index + 1}.jpg`);
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "typographic",
    sections: [
      {
        label: "Fifth",
        headline: "The fifth validated asset stays assigned",
        body: "Exact ownership must outrank positional selection.",
        bullets: [],
        moduleId: "image_left",
        layout: "image_left",
        imageUrl: resolvedImages[4],
        imageAlt: "Fifth product",
        imageMode: "assigned"
      },
      {
        label: "Sixth",
        headline: "The sixth validated asset stays assigned",
        body: "The compiler receives the full probed allowlist.",
        bullets: [],
        moduleId: "image_full",
        layout: "image_full",
        imageUrl: resolvedImages[5],
        imageAlt: "Sixth product",
        imageMode: "assigned"
      }
    ]
  }, { title: "WTP", resolvedEmailImageUrls: resolvedImages });
  assert.match(html, /product-5\.jpg/);
  assert.match(html, /product-6\.jpg/);
});

test("an explicitly removed hero image is not restored from campaign assets", () => {
  const fallbackUrl = "https://cdn.example.com/hero-fallback.jpg";
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "image_first",
    heroImageUrl: "",
    heroImageAlt: "",
    heroImageMode: "none"
  }, { title: "WTP", resolvedEmailImageUrls: [fallbackUrl] });
  assert.doesNotMatch(html, /hero-fallback\.jpg/);
});

test("module crop and focal point compile into deterministic email image presentation", () => {
  const imageUrl = "https://cdn.example.com/crop-product.jpg";
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "typographic",
    sections: [{
      label: "Product",
      headline: "Framed deliberately",
      body: "The crop belongs to this module.",
      bullets: [],
      moduleId: "image_full",
      layout: "image_full",
      imageUrl,
      imageAlt: "Product detail",
      imageMode: "assigned",
      imageAspect: "landscape",
      imageFocalPoint: "bottom_right"
    }]
  }, { title: "WTP", resolvedEmailImageUrls: [imageUrl] });
  assert.match(html, /width="596" height="397"/);
  assert.match(html, /object-fit:cover;object-position:right bottom/);
});

test("hero crop uses its own framing independent from module images", () => {
  const imageUrl = "https://cdn.example.com/crop-hero.jpg";
  const html = renderPremiumCampaignEmail({
    ...email,
    heroLayout: "image_first",
    heroImageUrl: imageUrl,
    heroImageMode: "assigned",
    heroImageAspect: "square",
    heroImageFocalPoint: "top"
  }, { title: "WTP", resolvedEmailImageUrls: [imageUrl] });
  assert.match(html, /width="596" height="596"/);
  assert.match(html, /object-position:center top/);
});

test("module spacing compiles into distinct compact and airy email rhythm", () => {
  const compactHtml = renderPremiumCampaignEmail({
    ...email,
    sections: [{ label: "Compact", headline: "Tighter rhythm", body: "Compact module.", bullets: [], moduleId: "statement", layout: "statement", spacing: "compact" }]
  }, { title: "WTP" });
  const airyHtml = renderPremiumCampaignEmail({
    ...email,
    sections: [{ label: "Airy", headline: "More breathing room", body: "Airy module.", bullets: [], moduleId: "statement", layout: "statement", spacing: "airy" }]
  }, { title: "WTP" });
  assert.match(compactHtml, /padding:24px 34px 18px/);
  assert.match(airyHtml, /padding:52px 52px 18px/);
});

test("module alignment, editorial width and treatment compile into email-safe tables", () => {
  const html = renderPremiumCampaignEmail({
    ...email,
    sections: [{ label: "Focus", headline: "A focused composition", body: "Narrow and centered.", bullets: [], moduleId: "editorial_text", textAlign: "center", contentWidth: "narrow", surfaceStyle: "outlined" }]
  }, { title: "WTP" });
  assert.match(html, /class="module-copy"[^>]*width="82%" align="center"/);
  assert.match(html, /border:1px solid #[a-f0-9]+;/i);
  assert.match(html, /<td align="center" style="padding:22px;text-align:center;">/);
  assert.match(html, /\.module-copy\{width:100%!important\}/);
});

test("CTA variants preserve safe table markup and alignment", () => {
  const outline = renderPremiumCampaignEmail({ ...email, primaryCtaUrl: "https://example.com", ctaStyle: "outline", ctaAlign: "center" }, { title: "WTP" });
  assert.match(outline, /<td align="center"><table data-primary-cta-container="true"/);
  assert.match(outline, /border:2px solid #[a-f0-9]+;background:transparent;/i);
  assert.match(outline, /data-primary-cta="true" href="https:\/\/example\.com"/);

  const text = renderPremiumCampaignEmail({ ...email, ctaStyle: "text" }, { title: "WTP" });
  assert.match(text, /padding:8px 0 5px/);
  assert.match(text, /border-bottom:2px solid #[a-f0-9]+;/i);
});

test("WTP zoom-out compilation preserves four modules, progressive frames and one close", () => {
  const images = [
    "https://cdn.example.com/detail.jpg",
    "https://cdn.example.com/format.jpg",
    "https://cdn.example.com/family.jpg"
  ];
  const html = renderPremiumCampaignEmail({
    ...email,
    heroHeadline: "See the WTP detail",
    heroImageUrl: images[0],
    heroImageMode: "assigned",
    sections: [
      { label: "02 Format", headline: "See the format", body: "One format.", moduleId: "image_right", imageUrl: images[1], imageMode: "assigned" },
      { label: "03 Family", headline: "See the family", body: "The family.", moduleId: "image_full", imageUrl: images[2], imageMode: "assigned" },
      { label: "Retailer", headline: "Become a retailer", body: "One invitation.", moduleId: "offer_panel" }
    ]
  }, { title: "WTP retailer", resolvedEmailImageUrls: images });
  assert.equal((html.match(/data-email-module=/g) || []).length, 4);
  assert.equal((html.match(/data-primary-cta="true"/g) || []).length, 1);
  assert.equal((html.match(/data-progressive-frame-stage="[123]"/g) || []).length, 2);
  assert.equal((html.match(/data-compartment-contour="(?:hero|closing)"/g) || []).length, 2);
  assert.equal((html.match(/data-closing-wtp-image="true"/g) || []).length, 1);
  assert.doesNotMatch(html, /data-email-module="closing"/);
});

test("every compiled campaign uses the locked Westpack 2023 universal content", () => {
  const html = renderPremiumCampaignEmail(email, { title: "WTP", markets: ["DK"] });
  assert.deepEqual(getUniversalContentStatus(html), { header: true, footer: true, webView: true, unsubscribe: true });
  assert.match(html, /Header - 2023/);
  assert.match(html, /Footer - 2023/);
  assert.match(html, /When packaging matters/);
  assert.match(html, />Inspiration<\/a>/);
  assert.match(html, />Blog<\/a>/);
  assert.match(html, />Tilbud<\/a>/);
  assert.match(html, /Westpack A\/S/);
  assert.match(html, /FSC®C112509/);
  assert.match(html, /Afmeld nyhedsbreve fra Westpack/);
});
