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

test("cloning a mixed image/video carousel drops Meta's redundant picture field", async () => {
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
    // Reading a creative back from Meta includes a derived `picture` URL alongside
    // image_hash / video_id + its own thumbnail hash. Reposting both as-is is what
    // Meta rejects with "ObjectStorySpecRedundant" (only one of picture and image_hash
    // may be set) - this is exactly what happens when a carousel mixes an image card
    // with a video card and the source is duplicated without cleaning the read-back.
    const creativeId = await createAdCreative(
      "act_123",
      "token",
      {
        object_story_spec: {
          page_id: "page-1",
          link_data: {
            link: "https://www.westpack.com/",
            message: "Original",
            child_attachments: [
              { image_hash: "hash-1", picture: "https://scontent.example/card-1.jpg", link: "https://www.westpack.com/", name: "Card 1" },
              { video_id: "video-1", image_hash: "hash-thumb-2", picture: "https://scontent.example/card-2-thumb.jpg", link: "https://www.westpack.com/", name: "Card 2" }
            ]
          }
        },
        url_tags: ""
      },
      {
        source: "Mixed carousel",
        targetLanguage: "English",
        targetAdSet: "UK - Broad",
        destinationUrl: "https://www.westpack.com/uk/",
        primaryText: "Translated body",
        headline: "Translated headline",
        description: "Translated description"
      },
      {
        translatedAttachments: [
          { name: "Card 1 EN", description: "First" },
          { name: "Card 2 EN", description: "Second" }
        ]
      }
    );

    assert.equal(creativeId, "new-creative-id");
    const story = JSON.parse(postedBody.get("object_story_spec"));
    const [imageCard, videoCard] = story.link_data.child_attachments;

    assert.equal(imageCard.image_hash, "hash-1");
    assert.equal(imageCard.picture, undefined, "image card must not keep a redundant picture field alongside image_hash");

    assert.equal(videoCard.video_id, "video-1");
    assert.equal(videoCard.image_hash, "hash-thumb-2");
    assert.equal(videoCard.picture, undefined, "video card must not keep a redundant picture field alongside image_hash");
  } finally {
    global.fetch = originalFetch;
  }
});
