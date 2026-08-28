const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeCampaignImageDataUri } = require("../api/campaign/brain");

test("cropped email images accept bounded production-safe data URIs", () => {
  const decoded = decodeCampaignImageDataUri(`data:image/jpeg;base64,${Buffer.from("westpack-crop").toString("base64")}`);
  assert.equal(decoded.contentType, "image/jpeg");
  assert.equal(decoded.bytes.toString(), "westpack-crop");
});

test("cropped email images reject unsupported or malformed payloads", () => {
  assert.throws(() => decodeCampaignImageDataUri("data:text/html;base64,PGgxPm5vPC9oMT4="), /supported image payload/i);
  assert.throws(() => decodeCampaignImageDataUri("not-a-data-uri"), /supported image payload/i);
});
