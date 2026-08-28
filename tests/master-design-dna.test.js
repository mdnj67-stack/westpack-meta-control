const test = require("node:test");
const assert = require("node:assert/strict");
const { extractMasterDesignDna, normalizeDesignTranslation } = require("../server/campaign/master-design-dna");
const { buildMetaFromMasterPrompt, buildMetaFromMasterSchema, normalizeMetaFromMasterResult, extractMasterVisualUrls } = require("../server/campaign/meta-from-master");

const MASTER_HTML = `
  <style>
    body { background-color:#f5f5f3; color:#201916; font-family:Arial, sans-serif; }
    .brand-rule { border-top:3px solid #17845f; }
    .eyebrow { color:#c0003a; text-transform:uppercase; }
    h1 { color:#201916; font-family:Georgia, serif; font-size:48px; font-weight:700; }
    .card { background:#ffffff; border:1px solid #ded8d2; border-radius:16px; text-align:left; }
  </style>
  <table width="760"><tr><td><img src="hero.jpg"><h1>Premium presentation</h1><p>Commercial story</p></td></tr></table>
  <img src="detail-1.jpg"><img src="detail-2.jpg"><img src="detail-3.jpg">
`;

test("extracts campaign palette, typography, hero hierarchy and rhythm from a Klaviyo master", () => {
  const dna = extractMasterDesignDna({ html: MASTER_HTML });
  assert.equal(dna.palette.background, "#f5f5f3");
  assert.equal(dna.palette.foreground, "#201916");
  assert.equal(dna.typography.headlineStyle, "serif");
  assert.equal(dna.typography.labelCase, "uppercase");
  assert.equal(dna.composition.heroStrategy, "image_first");
  assert.equal(dna.composition.frameStyle, "rounded");
  assert.equal(dna.evidence.imageCount, 4);
});

test("normalised translation rejects arbitrary renderer values and malformed colours", () => {
  const audit = extractMasterDesignDna({ html: MASTER_HTML });
  const translation = normalizeDesignTranslation({
    palette: { accent: "not-a-colour", background: "#abc" },
    typography: { headlineStyle: "comic", alignment: "diagonal" },
    composition: { frameStyle: "exploding" }
  }, audit);
  assert.equal(translation.palette.background, "#aabbcc");
  assert.equal(translation.palette.accent, audit.palette.accent);
  assert.equal(translation.typography.headlineStyle, "serif");
  assert.equal(translation.typography.alignment, "left");
  assert.equal(translation.composition.frameStyle, "rounded");
});

test("Meta from Master makes design continuity a required production contract", () => {
  const schema = buildMetaFromMasterSchema();
  assert.ok(schema.required.includes("designTranslation"));
  assert.ok(schema.required.includes("creativeRoutes"));
  assert.equal(schema.properties.creativeRoutes.properties.routes.minItems, 3);
  assert.deepEqual(schema.properties.designTranslation.properties.preserve.minItems, 3);
  assert.equal(schema.properties.carousel.properties.cards.minItems, 3);
  assert.equal(schema.properties.carousel.properties.cards.maxItems, 6);
  const request = buildMetaFromMasterPrompt({
    title: "Retail campaign",
    source: { html: MASTER_HTML },
    constraints: []
  }, ["https://assets.test/one.jpg", "https://assets.test/two.jpg"]);
  assert.equal(request.sourceDesignAudit.palette.background, "#f5f5f3");
  const promptText = request.prompt.flatMap((message) => message.content).map((part) => part.text || "").join(" ");
  assert.match(promptText, /universal email header/i);
  assert.match(promptText, /Deterministic design audit/i);
});

test("master visual extraction keeps campaign imagery and excludes universal channel chrome", () => {
  const urls = extractMasterVisualUrls(`
    <img src="https://assets.test/westpack-logo.png">
    <img src="https://assets.test/campaign-hero.jpg?width=900&amp;height=700">
    <img src="https://assets.test/product-detail.jpg">
    <img src="https://assets.test/instagram-icon.png">
  `);
  assert.deepEqual(urls, [
    "https://assets.test/campaign-hero.jpg?width=900&height=700",
    "https://assets.test/product-detail.jpg"
  ]);
});

test("normalised Meta output carries audited Design DNA into the renderer payload", () => {
  const audit = extractMasterDesignDna({ html: MASTER_HTML });
  const result = normalizeMetaFromMasterResult(
    { source: { html: MASTER_HTML } },
    { designTranslation: { palette: { accent: "#147a58" } }, carousel: { cards: [] } },
    "test-model",
    [],
    [],
    audit
  );
  assert.equal(result.sourceDesignAudit.evidence.source, "klaviyo_html");
  assert.equal(result.designTranslation.palette.accent, "#147a58");
  assert.equal(result.designTranslation.composition.frameStyle, "rounded");
  assert.deepEqual(result.creativeRoutes.routes.map((route) => route.id), ["faithful", "editorial", "performance"]);
});
