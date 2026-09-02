const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCreativeForAi } = require("../server/lib/meta");

test("asset-feed video creative is detected as Video, not Single image", () => {
  const summary = summarizeCreativeForAi({
    object_story_spec: { page_id: "page-1" },
    asset_feed_spec: {
      videos: [{ video_id: "video-1", thumbnail_url: "https://example.com/thumb.jpg" }]
    }
  });

  assert.equal(summary.format, "Video");
});

test("asset-feed multi-image creative is detected as Carousel", () => {
  const summary = summarizeCreativeForAi({
    object_story_spec: { page_id: "page-1" },
    asset_feed_spec: {
      images: [{ hash: "hash-1" }, { hash: "hash-2" }, { hash: "hash-3" }]
    }
  });

  assert.equal(summary.format, "Carousel");
});

test("asset-feed single image creative is detected as Single image", () => {
  const summary = summarizeCreativeForAi({
    object_story_spec: { page_id: "page-1" },
    asset_feed_spec: {
      images: [{ hash: "hash-1" }]
    }
  });

  assert.equal(summary.format, "Single image");
});

test("an asset feed mixing images and a video still resolves to Carousel", () => {
  const summary = summarizeCreativeForAi({
    object_story_spec: { page_id: "page-1" },
    asset_feed_spec: {
      images: [{ hash: "hash-1" }, { hash: "hash-2" }],
      videos: [{ video_id: "video-1" }]
    }
  });

  assert.equal(summary.format, "Carousel");
});

test("classic object_story_spec-based creatives are still detected correctly (no asset_feed_spec)", () => {
  assert.equal(summarizeCreativeForAi({
    object_story_spec: { link_data: { video_id: undefined } }
  }).format, "Single image");

  assert.equal(summarizeCreativeForAi({
    object_story_spec: { video_data: { video_id: "video-1" } }
  }).format, "Video");

  assert.equal(summarizeCreativeForAi({
    object_story_spec: {
      link_data: {
        child_attachments: [{ name: "Card 1" }, { name: "Card 2" }]
      }
    }
  }).format, "Carousel");
});
