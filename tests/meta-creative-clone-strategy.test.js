const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdCreative, hasReusableStoryPayload } = require("../server/lib/meta");

test("complete carousel story wins over a metadata-only asset feed", () => {
  const sourceCreative = {
    object_story_spec: {
      page_id: "page-1",
      instagram_user_id: "ig-1",
      link_data: {
        link: "https://www.westpack.com/",
        message: "Seasonal packaging",
        child_attachments: [
          { image_hash: "hash-1", link: "https://www.westpack.com/" },
          { image_hash: "hash-2", link: "https://www.westpack.com/" }
        ]
      }
    },
    asset_feed_spec: {
      message_extensions: []
    }
  };

  assert.equal(hasReusableStoryPayload(sourceCreative.object_story_spec), true);
});

test("identity-only story still allows a real dynamic asset feed", () => {
  assert.equal(hasReusableStoryPayload({
    page_id: "page-1",
    instagram_user_id: "ig-1"
  }), false);
});

test("creative creation posts AD11-style carousel story instead of metadata-only asset feed", async () => {
  const originalFetch = global.fetch;
  let postedBody = null;
  global.fetch = async (_url, options = {}) => {
    postedBody = new URLSearchParams(String(options.body || ""));
    return {
      ok: true,
      async json() {
        return { id: "new-creative-id" };
      }
    };
  };

  try {
    const creativeId = await createAdCreative(
      "act_123",
      "token",
      {
        object_story_spec: {
          page_id: "page-1",
          instagram_user_id: "ig-1",
          link_data: {
            link: "https://www.westpack.com/",
            message: "Original",
            child_attachments: [
              { image_hash: "hash-1", link: "https://www.westpack.com/", name: "One" },
              { image_hash: "hash-2", link: "https://www.westpack.com/", name: "Two" }
            ]
          }
        },
        asset_feed_spec: {
          message_extensions: []
        },
        url_tags: "utm_source=facebook"
      },
      {
        source: "AD11",
        targetLanguage: "Italian",
        targetAdSet: "IT - Standard - Broad",
        destinationUrl: "https://www.westpack.com/it/",
        primaryText: "Tradotto",
        headline: "Titolo",
        description: "Descrizione"
      },
      {
        translatedAttachments: [
          { name: "Carta uno", description: "Uno" },
          { name: "Carta due", description: "Due" }
        ]
      }
    );

    assert.equal(creativeId, "new-creative-id");
    assert.equal(postedBody.has("asset_feed_spec"), false);
    const story = JSON.parse(postedBody.get("object_story_spec"));
    assert.equal(story.link_data.message, "Tradotto");
    assert.equal(story.link_data.child_attachments[0].name, "Carta uno");
    assert.equal(story.link_data.child_attachments.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
