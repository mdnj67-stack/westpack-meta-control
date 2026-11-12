const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { createAsanaContentRequest, attachFileToAsanaTask, findAsanaUsers, toAsanaHtml, resolveAsanaProjectGid } = require("../server/lib/asana");
const { getConfig } = require("../server/lib/config");

const config = {
  asanaAccessToken: "token",
  asanaCampaignProjectGid: "111",
  asanaContentProjectGid: "222",
  asanaCreativesProjectGid: "333",
  asanaProductionProjectGid: "444"
};

// Answers GETs for /users/me, /users/<gid>, /projects/444/sections, /tasks/<gid>, typeahead; records POSTs.
function stubFetch({ outsider = "", taskProject = "444" } = {}) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    const method = options.method || "GET";
    calls.push({ url: href, method, body: options.body });
    const ok = (data, status = 200) => new Response(JSON.stringify({ data }), { status });
    if (method === "GET") {
      if (href.includes("/users/me")) return ok({ gid: "42", name: "Mads", workspaces: [{ gid: "900", name: "westpack.com" }] });
      const user = href.match(/\/users\/(\d+)/);
      if (user) return ok({ gid: user[1], name: `User ${user[1]}`, workspaces: [{ gid: user[1] === outsider ? "1" : "900" }] });
      if (href.includes("/projects/444/sections")) return ok([{ gid: "71", name: "Content requests" }, { gid: "72", name: "In progress" }]);
      if (href.includes("/typeahead")) return ok([{ gid: "501", name: "Niklas", email: "n@example.com" }]);
      if (href.includes("/tasks/")) return ok({ gid: "777", name: "A task", projects: [{ gid: taskProject }] });
      return ok({});
    }
    if (href.includes("/attachments")) return ok({ gid: "880", name: "preview.mp4", size: 3 });
    const sent = JSON.parse(options.body).data;
    return ok({ gid: "555", name: sent.name, due_on: sent.due_on || null, permalink_url: "https://app.asana.com/0/0/555", assignee: { name: "Rikke" }, followers: [{ name: "Niklas" }] }, 201);
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("the Content Production project is a project kind, configured by default", () => {
  assert.deepEqual(resolveAsanaProjectGid(config, "production"), { kind: "production", projectGid: "444" });
  assert.match(getConfig().asanaProductionProjectGid, /^\d+$/);
});

test("a content request lands in the named column of Content Production, for the colleague, with followers mentioned", async () => {
  const stub = stubFetch();
  try {
    const task = await createAsanaContentRequest(config, { name: "Intro: Top 5", notes: "**Line**\nSay <this>", dueOn: "2026-11-18", section: "content requests", assignee: "500", followers: ["501"] });
    assert.equal(task.section, "Content requests");
    assert.equal(task.permalinkUrl, "https://app.asana.com/0/0/555");
    const body = JSON.parse(stub.calls.find((call) => call.method === "POST").body).data;
    assert.equal(body.assignee, "500");
    assert.deepEqual(body.followers, ["501"]);
    assert.equal(body.workspace, "900");
    assert.deepEqual(body.memberships, [{ project: "444", section: "71" }]);
    assert.equal(body.due_on, "2026-11-18");
    assert.equal(body.html_notes, '<body><strong>Line</strong>\nSay &lt;this&gt;\n\nCc: <a data-asana-gid="501"/></body>');
    assert.equal(body.projects, undefined);
  } finally {
    stub.restore();
  }
});

test("a person outside the workspace, an unknown column or a missing assignee is refused without writing", async () => {
  const stub = stubFetch({ outsider: "666" });
  try {
    await assert.rejects(createAsanaContentRequest(config, { name: "x", assignee: "666" }), (error) => error.statusCode === 403);
    await assert.rejects(createAsanaContentRequest(config, { name: "x", assignee: "500", section: "Backlog" }), (error) => error.statusCode === 400 && /Content requests/.test(error.message));
    await assert.rejects(createAsanaContentRequest(config, { name: "x" }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaContentRequest(config, { name: "x", assignee: "500", followers: ["1", "2", "3", "4", "5", "6"] }), (error) => error.statusCode === 400);
    assert.equal(stub.calls.filter((call) => call.method === "POST").length, 0);
  } finally {
    stub.restore();
  }
});

test("a file is attached only to a task in one of the app's projects, and only small, known types", async () => {
  const stub = stubFetch();
  try {
    const attached = await attachFileToAsanaTask(config, { taskGid: "777", fileName: "preview.mp4", contentType: "video/mp4", buffer: Buffer.from("abc") });
    assert.equal(attached.gid, "880");
    const post = stub.calls.find((call) => call.method === "POST");
    assert.match(post.url, /\/attachments\?/);
    assert.ok(post.body instanceof FormData);
    assert.equal(post.body.get("parent"), "777");
    await assert.rejects(attachFileToAsanaTask(config, { taskGid: "777", fileName: "x.exe", contentType: "application/octet-stream", buffer: Buffer.from("a") }), (error) => error.statusCode === 415);
    await assert.rejects(attachFileToAsanaTask(config, { taskGid: "777", fileName: "big.mp4", contentType: "video/mp4", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) }), (error) => error.statusCode === 413);
    await assert.rejects(attachFileToAsanaTask(config, { taskGid: "777", fileName: "../x.mp4", contentType: "video/mp4", buffer: Buffer.from("a") }), (error) => error.statusCode === 400);
  } finally {
    stub.restore();
  }
  const outside = stubFetch({ taskProject: "999" });
  try {
    await assert.rejects(attachFileToAsanaTask(config, { taskGid: "777", fileName: "p.mp4", contentType: "video/mp4", buffer: Buffer.from("a") }), (error) => error.statusCode === 403);
    assert.equal(outside.calls.filter((call) => call.method === "POST").length, 0);
  } finally {
    outside.restore();
  }
});

test("people are found by name in the token's workspace", async () => {
  const stub = stubFetch();
  try {
    const users = await findAsanaUsers(config, "Nik");
    assert.deepEqual(users, [{ gid: "501", name: "Niklas", email: "n@example.com" }]);
    assert.match(stub.calls.at(-1).url, /\/workspaces\/900\/typeahead\?.*resource_type=user/);
    await assert.rejects(findAsanaUsers(config, "N"), (error) => error.statusCode === 400);
  } finally {
    stub.restore();
  }
});

test("rich text escapes everything except **bold**", () => {
  assert.equal(toAsanaHtml("a & b <c> **d**"), "a &amp; b &lt;c&gt; <strong>d</strong>");
});

test("the routes are dispatched behind the session check and before the OpenAI check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const openAi = source.indexOf("Missing OpenAI API key.");
  for (const action of ["asana_content_request", "asana_task_attach"]) {
    const at = source.indexOf(`requestedAction === "${action}"`);
    assert.ok(auth > 0 && at > auth && openAi > at, action);
  }
  assert.match(source, /"asana_users"/);
});
