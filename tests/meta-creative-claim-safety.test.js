const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { sanitizeDegreesOfFreedomSpec } = require("../server/lib/meta.js");

// A copied creative used to inherit every Advantage+ feature its source had switched on. On
// 2026-10-13 that left automatic translation on the translated DE and IT copies of the best
// carrier-bag ad, and AI voice-over translation on the awareness videos - features that can put
// claims in an ad the website never made.

test("features that write, translate or generate are switched off on a copy", () => {
  const source = {
    creative_features_spec: {
      text_translation: { enroll_status: "OPT_IN" },
      translate_voiceover: { enroll_status: "OPT_IN" },
      enhance_cta: { enroll_status: "OPT_IN" },
      description_automation: { enroll_status: "OPT_IN" },
      image_background_gen: { enroll_status: "OPT_IN" }
    }
  };
  const features = sanitizeDegreesOfFreedomSpec(source).creative_features_spec;
  for (const name of Object.keys(source.creative_features_spec)) {
    assert.equal(features[name].enroll_status, "OPT_OUT", name);
  }
});

test("cosmetic features keep the source's setting", () => {
  const features = sanitizeDegreesOfFreedomSpec({
    creative_features_spec: {
      image_brightness_and_contrast: { enroll_status: "OPT_IN" },
      video_auto_crop: { enroll_status: "OPT_IN" },
      adapt_to_placement: { enroll_status: "OPT_OUT" }
    }
  }).creative_features_spec;
  assert.equal(features.image_brightness_and_contrast.enroll_status, "OPT_IN");
  assert.equal(features.video_auto_crop.enroll_status, "OPT_IN");
  assert.equal(features.adapt_to_placement.enroll_status, "OPT_OUT");
});

test("the deprecated standard_enhancements bundle is dropped, not echoed back", () => {
  const features = sanitizeDegreesOfFreedomSpec({
    creative_features_spec: { standard_enhancements: { enroll_status: "OPT_IN" } }
  }).creative_features_spec;
  assert.equal("standard_enhancements" in features, false);
});

test("no feature is added that the source did not carry", () => {
  const features = sanitizeDegreesOfFreedomSpec({
    creative_features_spec: { image_touchups: { enroll_status: "OPT_OUT" } }
  }).creative_features_spec;
  assert.deepEqual(Object.keys(features), ["image_touchups"]);
});

test("empty, missing and string specs are handled", () => {
  assert.equal(sanitizeDegreesOfFreedomSpec(""), "");
  assert.equal(sanitizeDegreesOfFreedomSpec(undefined), "");
  assert.equal(sanitizeDegreesOfFreedomSpec("not json"), "");
  const parsed = sanitizeDegreesOfFreedomSpec(JSON.stringify({
    creative_features_spec: { text_translation: { enroll_status: "OPT_IN" } }
  }));
  assert.equal(parsed.creative_features_spec.text_translation.enroll_status, "OPT_OUT");
});

test("every creative path that sends a degrees_of_freedom_spec goes through the sanitiser", () => {
  const source = readFileSync(join(__dirname, "..", "server", "lib", "meta.js"), "utf8");
  const sends = source.match(/degrees_of_freedom_spec:\s*[^,\n]+/g) || [];
  assert.ok(sends.length >= 2);
  for (const line of sends) {
    assert.match(line, /sanitizeDegreesOfFreedomSpec\(/, line);
  }
});
