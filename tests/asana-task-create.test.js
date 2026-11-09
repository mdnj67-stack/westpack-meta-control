const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { createAsanaTask } = require("../server/lib/asana");

const config = {
  asanaAccessToken: "token",
  asanaCampaignProjectGid: "111",
  asanaContentProjectGid: "222",
  asanaCreativesProjectGid: "333"
};

function stubFetch() {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if ((options.method || "GET") === "GET") {
      return new Response(JSON.stringify({ data: { gid: "42", name: "Mads", workspaces: [{ gid: "900", name: "westpack.com" }] } }), { status: 200 });
    }
    const sent = JSON.parse(options.body).data;
    return new Response(JSON.stringify({ data: { gid: "555", name: sent.name, due_on: sent.due_on || null, permalink_url: "https://app.asana.com/0/0/555", assignee: { name: "Mads" } } }), { status: 201 });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("a to-do is created for the token's owner in their workspace, with a due date", async () => {
  const stub = stubFetch();
  try {
    const task = await createAsanaTask(config, { name: "  Fix the welcome flows  ", notes: "Nine markets", dueOn: "2026-11-11" });
    assert.equal(task.gid, "555");
    assert.equal(task.dueOn, "2026-11-11");
    assert.equal(task.permalinkUrl, "https://app.asana.com/0/0/555");
    const post = stub.calls.find((call) => call.method === "POST");
    assert.match(post.url, /\/tasks\?opt_fields=/);
    assert.deepEqual(JSON.parse(post.body), { data: { name: "Fix the welcome flows", assignee: "me", workspace: "900", notes: "Nine markets", due_on: "2026-11-11" } });
  } finally {
    stub.restore();
  }
});

test("a project kind puts the task in that configured project, still assigned to the owner", async () => {
  const stub = stubFetch();
  try {
    await createAsanaTask(config, { name: "Check creative", projectKind: "creatives" });
    const body = JSON.parse(stub.calls.find((call) => call.method === "POST").body).data;
    assert.deepEqual(body.projects, ["333"]);
    assert.equal(body.assignee, "me");
    assert.equal(body.due_on, undefined);
  } finally {
    stub.restore();
  }
});

test("bad input is refused before anything is read or written", async () => {
  const stub = stubFetch();
  try {
    await assert.rejects(createAsanaTask(config, { name: "   " }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTask(config, { name: "x".repeat(301) }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTask(config, { name: "ok", dueOn: "11/11/2026" }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTask(config, { name: "ok", dueOn: "2026-02-30" }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTask(config, { name: "ok", projectKind: "finance" }), (error) => error.statusCode === 400);
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("the caller cannot assign the task to someone else", async () => {
  const stub = stubFetch();
  try {
    await createAsanaTask(config, { name: "ok", assignee: "123456", workspace: "777", projects: ["999"] });
    const body = JSON.parse(stub.calls.find((call) => call.method === "POST").body).data;
    assert.equal(body.assignee, "me");
    assert.equal(body.workspace, "900");
    assert.equal(body.projects, undefined);
  } finally {
    stub.restore();
  }
});

test("the route dispatches asana_task_create behind the session check and before the OpenAI check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const create = source.indexOf('requestedAction === "asana_task_create"');
  const openAi = source.indexOf("Missing OpenAI API key.");
  assert.ok(auth > 0 && create > auth && openAi > create);
});
