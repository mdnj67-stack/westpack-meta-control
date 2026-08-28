const EMAIL_MODULE_SYSTEM_VERSION = "westpack-email-modules-v2";

const WESTPACK_EMAIL_MASTER = Object.freeze({
  id: "westpack-campaign-master-v2",
  label: "Westpack Campaign Master",
  width: 640,
  contentWidth: 596,
  headerUniversalId: "dfdb43a7c0604849ac74c09f7919ae09",
  footerUniversalId: "3cf1619390714ca7a5d735fad6ad82d5",
  editableRegion: "campaign_body",
  lockedRegions: ["preheader", "header", "footer", "legal"]
});

const EMAIL_MODULES = Object.freeze([
  { id: "editorial_text", label: "Editorial text", role: "Explain one decisive point", image: "optional", density: "medium" },
  { id: "image_full", label: "Full-width image", role: "Create visual pause and product focus", image: "required", density: "light" },
  { id: "image_left", label: "Image left", role: "Pair product evidence with compact copy", image: "required", density: "medium" },
  { id: "image_right", label: "Image right", role: "Vary rhythm with compact copy and product evidence", image: "required", density: "medium" },
  { id: "statement", label: "Editorial statement", role: "Land a strong campaign point of view", image: "none", density: "light" },
  { id: "steps", label: "Process / guide", role: "Explain a genuine ordered progression", image: "none", density: "medium" },
  { id: "benefit_grid", label: "Benefit grid", role: "Make distinct commercial benefits scannable", image: "none", density: "high" },
  { id: "testimonial", label: "Testimonial", role: "Add approved customer or expert proof", image: "optional", density: "light" },
  { id: "product_spotlight", label: "Product spotlight", role: "Focus on one product family and its use", image: "required", density: "medium" },
  { id: "offer_panel", label: "Offer panel", role: "Present one factual offer or urgent action", image: "optional", density: "light" }
]);

const MODULE_BY_ID = new Map(EMAIL_MODULES.map((module) => [module.id, module]));
const EMAIL_IMAGE_ASPECTS = Object.freeze(["natural", "landscape", "square", "portrait"]);
const EMAIL_IMAGE_FOCAL_POINTS = Object.freeze([
  "top_left", "top", "top_right",
  "left", "center", "right",
  "bottom_left", "bottom", "bottom_right"
]);

function getEmailModuleDefinition(id = "") {
  return MODULE_BY_ID.get(String(id || "")) || MODULE_BY_ID.get("editorial_text");
}

function normalizeEmailSections(sections = []) {
  return (Array.isArray(sections) ? sections : [])
    .filter((section) => section && typeof section === "object" && String(section.headline || "").trim())
    .slice(0, 4)
    .map((section, index) => {
      const module = getEmailModuleDefinition(section.moduleId || section.layout);
      return {
        ...section,
        moduleId: module.id,
        layout: module.id,
        imageMode: ["auto", "assigned", "none"].includes(section.imageMode)
          ? section.imageMode
          : (String(section.imageUrl || "").trim() ? "assigned" : "auto"),
        imageAspect: EMAIL_IMAGE_ASPECTS.includes(section.imageAspect) ? section.imageAspect : "natural",
        imageFocalPoint: EMAIL_IMAGE_FOCAL_POINTS.includes(section.imageFocalPoint) ? section.imageFocalPoint : "center",
        imageZoom: Math.max(100, Math.min(180, Number(section.imageZoom || 100))),
        spacing: ["compact", "balanced", "airy"].includes(section.spacing) ? section.spacing : "balanced",
        textAlign: ["left", "center"].includes(section.textAlign) ? section.textAlign : "left",
        contentWidth: ["standard", "narrow"].includes(section.contentWidth) ? section.contentWidth : "standard",
        surfaceStyle: ["plain", "soft", "outlined"].includes(section.surfaceStyle) ? section.surfaceStyle : "plain",
        position: index + 1
      };
    });
}

function buildEmailModulePromptBlock() {
  return [
    `Locked email module system: ${EMAIL_MODULE_SYSTEM_VERSION}.`,
    `Master contract: ${JSON.stringify(WESTPACK_EMAIL_MASTER)}.`,
    `Approved campaign-body modules: ${JSON.stringify(EMAIL_MODULES)}.`,
    "Choose exactly one moduleId for every section and set layout to the same value.",
    "Use image-required modules only when an exact approved static image URL is available.",
    "Use 3-4 modules with distinct persuasion jobs. Do not repeat a module unless the campaign genuinely needs the repetition.",
    "Header, preheader, footer and legal content are locked master regions and may never be generated as campaign sections."
  ].join(" ");
}

module.exports = {
  EMAIL_MODULES,
  EMAIL_IMAGE_ASPECTS,
  EMAIL_IMAGE_FOCAL_POINTS,
  EMAIL_MODULE_SYSTEM_VERSION,
  WESTPACK_EMAIL_MASTER,
  buildEmailModulePromptBlock,
  getEmailModuleDefinition,
  normalizeEmailSections
};
