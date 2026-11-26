const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { updateAsanaTask } = require("../server/lib/asana");

const config = { asanaAccessToken: "token" };

// GET /users/me answers the owner (gid 42); GET /tasks/<gid> answers the given assignee; PUT echoes the change.
function stubFetch({ assignee = { gid: "42" } } = {}) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url: String(url), method, body: options.body });
    if (method === "GET" && String(url).includes("/users/me")) {
      return new Response(JSON.stringify({ data: { gid: "42", name: "Mads", workspaces: [{ gid: "900", name: "westpack.com" }] } }), { status: 200 });
    }
    if (method === "GET") {
      return new Response(JSON.stringify({ data: { gid: "555", assignee } }), { status: 200 });
    }
    const sent = JSON.parse(options.body).data;
    return new Response(JSON.stringify({ data: { gid: "555", name: sent.name || "Old name", due_on: sent.due_on || (sent.due_at ? sent.due_at.slice(0, 10) : null), due_at: sent.due_at || null, start_at: sent.start_at || null, permalink_url: "https://app.asana.com/0/0/555" } }), { status: 200 });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("the owner's own to-do gets a time block, sent to Asana as UTC instants", async () => {
  const stub = stubFetch();
  try {
    const task = await updateAsanaTask(config, {
      taskGid: "555",
      name: "  Hele dagen: nytårsudsalget  ",
      notes: "Listen kom 11/12",
      startAt: "2026-12-14T08:00:00+01:00",
      dueAt: "2026-12-14T16:00:00+01:00"
    });
    const put = stub.calls.find((call) => call.method === "PUT");
    assert.match(put.url, /\/tasks\/555\?opt_fields=/);
    assert.deepEqual(JSON.parse(put.body), { data: {
      name: "Hele dagen: nytårsudsalget",
      notes: "Listen kom 11/12",
      due_at: "2026-12-14T15:00:00.000Z",
      start_at: "2026-12-14T07:00:00.000Z"
    } });
    assert.equal(task.startAt, "2026-12-14T07:00:00.000Z");
    assert.equal(task.dueAt, "2026-12-14T15:00:00.000Z");
  } finally {
    stub.restore();
  }
});

test("a due date alone clears any time block", async () => {
  const stub = stubFetch();
  try {
    await updateAsanaTask(config, { taskGid: "555", dueOn: "2027-01-04" });
    const body = JSON.parse(stub.calls.find((call) => call.method === "PUT").body).data;
    assert.deepEqual(body, { due_on: "2027-01-04", start_at: null });
  } finally {
    stub.restore();
  }
});

test("a colleague's task, or a card with no assignee, is refused and nothing is written", async () => {
  for (const assignee of [{ gid: "77" }, null]) {
    const stub = stubFetch({ assignee });
    try {
      await assert.rejects(updateAsanaTask(config, { taskGid: "555", name: "Mine now" }), (error) => error.statusCode === 403);
      assert.equal(stub.calls.some((call) => call.method === "PUT"), false);
    } finally {
      stub.restore();
    }
  }
});

test("bad input is refused before anything is read or written", async () => {
  const stub = stubFetch();
  try {
    const bad = [
      { taskGid: "abc", name: "ok" },
      { taskGid: "555" },
      { taskGid: "555", name: "   " },
      { taskGid: "555", dueOn: "14/12/2026" },
      { taskGid: "555", dueAt: "2026-12-14T16:00" },
      { taskGid: "555", startAt: "2026-12-14T08:00:00+01:00" },
      { taskGid: "555", startAt: "2026-12-14T16:00:00+01:00", dueAt: "2026-12-14T08:00:00+01:00" },
      { taskGid: "555", dueOn: "2026-12-14", dueAt: "2026-12-14T16:00:00+01:00" }
    ];
    for (const input of bad) {
      await assert.rejects(updateAsanaTask(config, input), (error) => error.statusCode === 400, JSON.stringify(input));
    }
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("the route dispatches asana_task_update behind the session check and before the OpenAI check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const update = source.indexOf('requestedAction === "asana_task_update"');
  const openAi = source.indexOf("Missing OpenAI API key.");
  assert.ok(auth > 0 && update > auth && openAi > update);
});
