const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { readJsonBody, MAX_JSON_BODY_BYTES } = require("../server/lib/http");

function fakeRequest() {
  const emitter = new EventEmitter();
  emitter.destroyed = false;
  emitter.destroy = () => {
    emitter.destroyed = true;
  };
  return emitter;
}

test("readJsonBody resolves normally for a body under the size cap", async () => {
  const req = fakeRequest();
  const payload = { action: "host_email_asset", imageDataUri: `data:image/jpeg;base64,${"A".repeat(1000)}` };
  const chunk = Buffer.from(JSON.stringify(payload));

  const pending = readJsonBody(req);
  req.emit("data", chunk);
  req.emit("end");

  const result = await pending;
  assert.deepEqual(result, payload);
});

test("readJsonBody resolves {} for an empty body, unchanged from prior behavior", async () => {
  const req = fakeRequest();
  const pending = readJsonBody(req);
  req.emit("end");
  assert.deepEqual(await pending, {});
});

test("readJsonBody still rejects malformed JSON under the cap", async () => {
  const req = fakeRequest();
  const pending = readJsonBody(req);
  req.emit("data", Buffer.from("{not valid json"));
  req.emit("end");
  await assert.rejects(pending, /Invalid JSON body\./);
});

test("readJsonBody rejects once the accumulated body exceeds the cap, without parsing it", async () => {
  const req = fakeRequest();
  const pending = readJsonBody(req);

  // Simulate streamed chunks whose total exceeds MAX_JSON_BODY_BYTES. The trailing bytes are
  // deliberately not valid JSON on their own - if the guard failed and JSON.parse ran anyway,
  // it would throw "Invalid JSON body." instead of the expected 413 rejection.
  const chunkSize = 5 * 1024 * 1024;
  const fullChunk = Buffer.alloc(chunkSize, "a");
  const chunksNeeded = Math.ceil(MAX_JSON_BODY_BYTES / chunkSize) + 1;

  let rejected = null;
  pending.catch((error) => {
    rejected = error;
  });

  for (let i = 0; i < chunksNeeded; i += 1) {
    req.emit("data", fullChunk);
  }

  await assert.rejects(pending, (error) => {
    assert.equal(error.message, "Request body too large.");
    assert.equal(error.statusCode, 413);
    return true;
  });

  assert.ok(rejected, "expected the promise to have rejected");
  assert.equal(req.destroyed, true, "expected the oversized request to be destroyed early");
});

test("readJsonBody's cap has real headroom above the largest known legitimate payload", () => {
  // Largest known legitimate case documented in server/lib/http.js: up to 6 Meta-from-Master
  // carousel review images at ~3MB raw each (MAX_CREATE_IMAGE_UPLOAD_BYTES in app.js), base64-encoded.
  const largestLegitimateRawBytes = 6 * 3_000_000;
  const largestLegitimateEncodedBytes = Math.ceil(largestLegitimateRawBytes * (4 / 3));

  assert.ok(
    MAX_JSON_BODY_BYTES > largestLegitimateEncodedBytes,
    `cap (${MAX_JSON_BODY_BYTES}) must exceed the largest legitimate encoded payload (${largestLegitimateEncodedBytes})`
  );
});
