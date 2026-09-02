const test = require("node:test");
const assert = require("node:assert/strict");
const { buildVideoAssetCustomizationRules } = require("../server/lib/meta");

test("no source rules falls back to null so the caller can use its own default", () => {
  assert.equal(buildVideoAssetCustomizationRules(null, "video_square", "video_vertical"), null);
  assert.equal(buildVideoAssetCustomizationRules({}, "video_square", "video_vertical"), null);
  assert.equal(buildVideoAssetCustomizationRules({ asset_customization_rules: [] }, "video_square", "video_vertical"), null);
});

test("relabels a simple two-rule source (feed + story) onto the new square/vertical labels", () => {
  const rules = buildVideoAssetCustomizationRules(
    {
      asset_customization_rules: [
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["feed", "marketplace", "video_feeds"],
            instagram_positions: ["stream", "explore", "profile_feed"]
          },
          video_label: { name: "original_feed_label" }
        },
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["story", "facebook_reels"],
            instagram_positions: ["story", "reels"]
          },
          video_label: { name: "original_story_label" }
        }
      ]
    },
    "video_square",
    "video_vertical"
  );

  assert.equal(rules.length, 2);
  const squareRule = rules.find((rule) => rule.video_label.name === "video_square");
  const verticalRule = rules.find((rule) => rule.video_label.name === "video_vertical");
  assert.ok(squareRule, "square rule must exist");
  assert.ok(verticalRule, "vertical rule must exist");
  assert.deepEqual(squareRule.customization_spec.facebook_positions.sort(), ["feed", "marketplace", "video_feeds"]);
  assert.deepEqual(verticalRule.customization_spec.instagram_positions.sort(), ["reels", "story"]);
});

test("preserves placements the generic default doesn't include, like Facebook search results", () => {
  const rules = buildVideoAssetCustomizationRules(
    {
      asset_customization_rules: [
        {
          customization_spec: {
            publisher_platforms: ["facebook"],
            facebook_positions: ["feed", "search"]
          },
          video_label: { name: "feed_label" }
        },
        {
          // A separate rule the source ad had just for search results - must not be lost,
          // and must not create a third, unusable label since there are only two videos.
          customization_spec: {
            publisher_platforms: ["facebook"],
            facebook_positions: ["search"],
            instagram_positions: []
          },
          video_label: { name: "search_only_label" }
        },
        {
          customization_spec: {
            publisher_platforms: ["instagram"],
            instagram_positions: ["story", "explore"]
          },
          video_label: { name: "story_label" }
        }
      ]
    },
    "video_square",
    "video_vertical"
  );

  assert.equal(rules.length, 2, "three source rules must merge onto exactly two labels");
  const squareRule = rules.find((rule) => rule.video_label.name === "video_square");
  const verticalRule = rules.find((rule) => rule.video_label.name === "video_vertical");
  // "search" must survive the merge even though it came from a separate rule than "feed".
  assert.ok(squareRule.customization_spec.facebook_positions.includes("search"));
  assert.ok(squareRule.customization_spec.facebook_positions.includes("feed"));
  assert.deepEqual(verticalRule.customization_spec.instagram_positions.sort(), ["explore", "story"]);
});

test("a source with only feed-like placements falls back to null instead of an invalid single rule", () => {
  // Meta rejects placement-customized asset feeds with fewer than 2 target rules (error code
  // 100 / subcode 2446428, "Insufficient number of target rules"). A source ad that never ran
  // on story/reels placements would otherwise produce just one rule here; returning null lets
  // the caller fall back to its generic two-rule default instead of forwarding an invalid spec.
  const rules = buildVideoAssetCustomizationRules(
    {
      asset_customization_rules: [
        {
          customization_spec: { publisher_platforms: ["facebook"], facebook_positions: ["feed"] },
          video_label: { name: "only_label" }
        }
      ]
    },
    "video_square",
    "video_vertical"
  );

  assert.equal(rules, null);
});
