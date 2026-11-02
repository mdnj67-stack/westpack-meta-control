const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { addAsanaTaskComment } = require("../server/lib/asana");

const config = {
  asanaAccessToken: "token",
  asanaCampaignProjectGid: "111",
  asanaContentProjectGid: "222",
  asanaCreativesProjectGid: "333"
};

function stubFetch(taskProjects) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if ((options.method || "GET") === "GET") {
      return new Response(JSON.stringify({ data: { gid: "9", name: "Gift bags", projects: taskProjects.map((gid) => ({ gid })) } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { gid: "77", created_at: "2026-11-02T12:00:00.000Z" } }), { status: 201 });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("a comment on a Meta Creatives task is posted as a story on that task", async () => {
  const stub = stubFetch(["333"]);
  try {
    const result = await addAsanaTaskComment(config, "9", "  FR typo: VOYES -> VOYEZ  ");
    assert.equal(result.gid, "77");
    assert.equal(result.taskName, "Gift bags");
    const post = stub.calls.find((call) => call.method === "POST");
    assert.match(post.url, /\/tasks\/9\/stories$/);
    assert.deepEqual(JSON.parse(post.body), { data: { text: "FR typo: VOYES -> VOYEZ" } });
  } finally {
    stub.restore();
  }
});

test("a task outside the app's projects is refused before anything is written", async () => {
  const stub = stubFetch(["999"]);
  try {
    await assert.rejects(addAsanaTaskComment(config, "9", "hello"), (error) => error.statusCode === 403);
    assert.equal(stub.calls.filter((call) => call.method === "POST").length, 0);
  } finally {
    stub.restore();
  }
});

test("an empty or oversized comment and a malformed task id are refused", async () => {
  const stub = stubFetch(["333"]);
  try {
    await assert.rejects(addAsanaTaskComment(config, "9", "   "), (error) => error.statusCode === 400);
    await assert.rejects(addAsanaTaskComment(config, "9", "x".repeat(4001)), (error) => error.statusCode === 400);
    await assert.rejects(addAsanaTaskComment(config, "9/../1", "hello"), (error) => error.statusCode === 400);
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("the route dispatches asana_comment before the OpenAI check, behind the session check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const comment = source.indexOf('requestedAction === "asana_comment"');
  const openAi = source.indexOf("Missing OpenAI API key.");
  assert.ok(auth > 0 && comment > auth && openAi > comment);
});
