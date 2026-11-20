// readJsonBody must decode the request body once, after the last chunk. Decoding chunk by chunk turned a multi-byte
// character that straddled two chunks into two U+FFFD; on 2026-11-20 that corrupted the Romanian template of a
// Klaviyo rollout ("urgență" lost its "ț"). Both copies of the reader are held to it.
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const readers = {
  "server/lib/http.js": require("../server/lib/http.js").readJsonBody,
  "api/_lib/http.js": require("../api/_lib/http.js").readJsonBody
};

function requestFrom(chunks) {
  const req = new EventEmitter();
  req.destroy = () => {};
  setImmediate(() => {
    for (const chunk of chunks) req.emit("data", chunk);
    req.emit("end");
  });
  return req;
}

for (const [name, readJsonBody] of Object.entries(readers)) {
  test(`${name}: a multi-byte character split across two chunks survives`, async () => {
    const text = "Vehicul de urgență · Smykkeæsker · Zählen · 🎁";
    const bytes = Buffer.from(JSON.stringify({ text }), "utf8");
    // Cut inside the two bytes of "ț" (U+021B), and again inside the four bytes of the emoji.
    const cut1 = bytes.indexOf(Buffer.from("ț", "utf8")) + 1;
    const cut2 = bytes.indexOf(Buffer.from("🎁", "utf8")) + 2;
    const chunks = [bytes.subarray(0, cut1), bytes.subarray(cut1, cut2), bytes.subarray(cut2)];
    const parsed = await readJsonBody(requestFrom(chunks));
    assert.equal(parsed.text, text);
    assert.ok(!parsed.text.includes("�"));
  });

  test(`${name}: every possible single split point keeps the text intact`, async () => {
    const text = "æøå ț ă ü ß é ł ő “Kevin” – 1 af 3";
    const bytes = Buffer.from(JSON.stringify({ text }), "utf8");
    for (let cut = 1; cut < bytes.length; cut += 1) {
      const parsed = await readJsonBody(requestFrom([bytes.subarray(0, cut), bytes.subarray(cut)]));
      assert.equal(parsed.text, text, `split at byte ${cut}`);
    }
  });

  test(`${name}: an empty body is an empty object`, async () => {
    assert.deepEqual(await readJsonBody(requestFrom([])), {});
  });
}
