/**
 * Creates a rendered Trustpilot carousel in Meta as a PAUSED ad. Nothing here can switch an ad on: the user
 * reviews it in Ads Manager and turns it on there.
 *
 *   node templates/meta-trustpilot-carousel/publish.js templates/meta-trustpilot-carousel/specs/<file>.json
 *        --adset=<ad set id> --name="AD27 - Avis Trustpilot - Karrusel - fr_FR" [--dry-run | --creative-only]
 *
 * --creative-only uploads the cards and builds the creative but creates no ad: a test that Meta accepts it.
 *
 * Run render.js with --reviews first. It refuses when the spec has changed since the render, when the quotes
 * were not checked against the Trustpilot export, or when the ad set already has an ad with that name.
 *
 * The creative is locked the way PH - AD26 was: card order fixed (no "best card first"), no end card, Learn
 * more on every card, and every Advantage+ creative feature off - several of them rewrite text or add
 * generated claims, and a review ad must show the reviews exactly as written.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = __dirname;
const ROOT = path.resolve(DIR, "..", "..");
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { graphRequest, ensureAccountId } = require(path.join(ROOT, "server", "lib", "meta.js"));

// Westpack's Facebook page and Instagram account, the identity every ad on the account runs under.
const PAGE_ID = "1663756593873825";
const IG_USER_ID = "17841402372210954";

// Every creative feature the API accepted as OPT_OUT on PH - AD26 (read back 2026-10-27) that writes, swaps
// or decorates content. Meta adds features over time; the read-back below reports any that came on anyway.
const FEATURES_OFF = [
  "advantage_plus_creative", "standard_enhancements_catalog", "text_optimizations", "text_generation", "text_translation",
  "enhance_cta", "generate_cta", "dynamic_cta_text", "description_automation", "add_text_overlay", "replace_media_text",
  "image_text_translation", "text_overlay_translation", "text_extraction_for_headline", "text_extraction_for_tap_target",
  "inline_comment", "reveal_details_over_time", "show_destination_blurbs", "show_summary", "adapt_to_placement",
  "product_extensions", "site_extensions", "profile_card", "profile_extension", "ads_with_benefits",
  "image_touchups", "image_uncrop", "image_auto_crop", "image_animation", "image_templates", "image_brightness_and_contrast",
  "image_background_gen", "image_enhancement", "image_end_card", "pac_recomposition", "pac_genai_recomposition",
  "media_type_automation", "multi_photo_to_video", "carousel_to_video", "media_order", "music_generation", "audio"
];

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
}
const flag = (name) => process.argv.includes(`--${name}`);

// Rate limits are not retried (see CLAUDE.md), and a retried POST could create the ad twice.
const call = (p, token, method, params) => graphRequest(`/${String(p).replace(/^\//, "")}`, token, { method, params, maxRetries: 0 });

(async () => {
  const specFile = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const adsetId = arg("adset");
  const adName = arg("name");
  if (!specFile || !adsetId || !adName) {
    throw new Error('Usage: node publish.js <spec.json> --adset=<ad set id> --name="<ad name>" [--dry-run]');
  }
  const specText = fs.readFileSync(specFile, "utf8");
  const spec = JSON.parse(specText);
  const id = spec.id || path.basename(specFile, ".json");
  const outDir = path.join(DIR, "out", id);
  const metaFile = path.join(outDir, "meta.json");
  if (!fs.existsSync(metaFile)) throw new Error(`Not rendered yet: run render.js on ${specFile} first.`);
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  if (meta.specSha256 !== crypto.createHash("sha256").update(specText).digest("hex")) {
    throw new Error("The spec has changed since the cards were rendered - run render.js again.");
  }
  if (!meta.quotesVerified && !flag("quotes-checked-by-hand")) {
    throw new Error("The quotes were not checked against the Trustpilot export. Render with --reviews=<export>, or pass --quotes-checked-by-hand if you compared every quote yourself.");
  }
  (meta.warnings || []).forEach((w) => console.warn(`note: ${w}`));

  const config = getConfig();
  const token = config.metaAccessToken;
  const account = ensureAccountId(config.metaAdAccountId);

  const adset = await call(adsetId, token, "GET", { fields: "name,effective_status,campaign{name,effective_status}" });
  console.log(`Ad set: ${adset.name} (${adset.effective_status}) in ${adset.campaign.name} (${adset.campaign.effective_status})`);
  const existing = await call(`${adsetId}/ads`, token, "GET", { fields: "name", limit: 200 });
  if ((existing.data || []).some((a) => a.name === adName)) throw new Error(`The ad set already has an ad named "${adName}".`);

  console.log(`\nPrimary text:\n${meta.primaryText}\n`);
  meta.cards.forEach((c, i) => console.log(`  card ${i + 1}: ${c.file} | ${c.name} | ${c.description}`));
  console.log(`  link: ${meta.link} (${meta.cta})`);
  if (flag("dry-run")) {
    console.log("\nDry run - nothing created.");
    return;
  }

  const hashes = [];
  for (const c of meta.cards) {
    const res = await call(`${account}/adimages`, token, "POST", {
      bytes: fs.readFileSync(path.join(outDir, c.file)).toString("base64"),
      name: `Trustpilot ${id} ${c.file}`
    });
    hashes.push(Object.values(res.images)[0].hash);
  }
  const cta = { type: meta.cta, value: { link: meta.link } };
  const creative = await call(`${account}/adcreatives`, token, "POST", {
    name: adName,
    object_story_spec: {
      page_id: arg("page") || PAGE_ID,
      instagram_user_id: arg("ig") || IG_USER_ID,
      link_data: {
        link: meta.link,
        message: meta.primaryText,
        call_to_action: cta,
        child_attachments: meta.cards.map((c, i) => ({ link: meta.link, image_hash: hashes[i], name: c.name, description: c.description, call_to_action: cta })),
        multi_share_optimized: false,
        multi_share_end_card: false
      }
    },
    url_tags: meta.urlTags,
    degrees_of_freedom_spec: { creative_features_spec: Object.fromEntries(FEATURES_OFF.map((k) => [k, { enroll_status: "OPT_OUT" }])) }
  });
  if (flag("creative-only")) {
    const c = await call(creative.id, token, "GET", { fields: "name,degrees_of_freedom_spec" });
    const f = (c.degrees_of_freedom_spec || {}).creative_features_spec || {};
    const onNow = Object.entries(f).filter(([, v]) => v && v.enroll_status === "OPT_IN").map(([k]) => k);
    console.log(`\nCreative ${creative.id} built, no ad created. Features on: ${onNow.length ? onNow.join(", ") : "none"}`);
    return;
  }
  const ad = await call(`${account}/ads`, token, "POST", { name: adName, adset_id: adsetId, creative: { creative_id: creative.id }, status: "PAUSED" });

  const check = await call(ad.id, token, "GET", { fields: "name,status,effective_status,preview_shareable_link,creative{degrees_of_freedom_spec}" });
  const features = ((check.creative || {}).degrees_of_freedom_spec || {}).creative_features_spec || {};
  const on = Object.entries(features).filter(([, v]) => v && v.enroll_status === "OPT_IN").map(([k]) => k);
  const record = { at: new Date().toISOString(), adId: ad.id, creativeId: creative.id, adset: adset.name, name: adName, status: check.status, preview: check.preview_shareable_link || "", featuresOn: on };
  const logFile = path.join(outDir, "published.json");
  const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf8")) : [];
  fs.writeFileSync(logFile, JSON.stringify(log.concat(record), null, 1));

  console.log(`\nCreated ${check.name} | ad ${ad.id} | ${check.status} (${check.effective_status})`);
  console.log(`Preview: ${record.preview || "(none returned)"}`);
  if (on.length) console.warn(`WARNING: Meta switched these creative features on: ${on.join(", ")} - turn them off in Ads Manager before the ad runs.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
