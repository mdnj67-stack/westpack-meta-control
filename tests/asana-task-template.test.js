const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { createAsanaTaskFromTemplate, getAsanaTaskTemplates } = require("../server/lib/asana");

const config = {
  asanaAccessToken: "token",
  asanaCampaignProjectGid: "111",
  asanaContentProjectGid: "222",
  asanaCreativesProjectGid: "333"
};

function stubFetch({ templateProject = "111", newTaskInJob = true } = {}) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url: String(url), method, body: options.body });
    const u = new URL(String(url));
    if (method === "GET" && u.pathname.endsWith("/task_templates")) {
      return new Response(JSON.stringify({ data: [{ gid: "7001", name: "W??" }], next_page: null }), { status: 200 });
    }
    if (method === "GET" && /\/task_templates\/\d+$/.test(u.pathname)) {
      return new Response(JSON.stringify({ data: { gid: "7001", name: "W??", project: { gid: templateProject } } }), { status: 200 });
    }
    if (method === "POST" && /\/instantiateTask$/.test(u.pathname)) {
      return new Response(JSON.stringify({ data: { gid: "9001", status: "in_progress", new_task: newTaskInJob ? { gid: "8001", name: "W01: ??" } : null } }), { status: 201 });
    }
    if (method === "GET" && /\/jobs\/9001$/.test(u.pathname)) {
      return new Response(JSON.stringify({ data: { status: "succeeded", new_task: { gid: "8001" } } }), { status: 200 });
    }
    if (method === "PUT" && /\/tasks\/8001$/.test(u.pathname)) {
      const sent = JSON.parse(options.body).data;
      return new Response(JSON.stringify({ data: { gid: "8001", name: sent.name, due_on: sent.due_on || null, permalink_url: "https://app.asana.com/0/0/8001" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ errors: [{ message: "unexpected " + method + " " + u.pathname }] }), { status: 500 });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("templates are listed for the configured project only", async () => {
  const stub = stubFetch();
  try {
    const templates = await getAsanaTaskTemplates(config, "campaign");
    assert.deepEqual(templates, [{ gid: "7001", name: "W??" }]);
    assert.equal(new URL(stub.calls[0].url).searchParams.get("project"), "111");
  } finally {
    stub.restore();
  }
});

test("a card is made from the template, then named and dated", async () => {
  const stub = stubFetch();
  try {
    const task = await createAsanaTaskFromTemplate(config, { templateGid: "7001", name: "  W01: ??  ", dueOn: "2027-01-04" });
    assert.equal(task.gid, "8001");
    assert.equal(task.name, "W01: ??");
    assert.equal(task.dueOn, "2027-01-04");
    assert.equal(task.templateName, "W??");
    const post = stub.calls.find((call) => call.method === "POST");
    assert.deepEqual(JSON.parse(post.body), { data: { name: "W01: ??" } });
    const put = stub.calls.find((call) => call.method === "PUT");
    assert.deepEqual(JSON.parse(put.body), { data: { name: "W01: ??", due_on: "2027-01-04" } });
  } finally {
    stub.restore();
  }
});

test("the job is polled when Asana has not named the new task yet", async () => {
  const stub = stubFetch({ newTaskInJob: false });
  try {
    const task = await createAsanaTaskFromTemplate(config, { templateGid: "7001", name: "W02: ??" });
    assert.equal(task.gid, "8001");
    assert.ok(stub.calls.some((call) => /\/jobs\/9001/.test(call.url)));
  } finally {
    stub.restore();
  }
});

test("a template from another project is refused before anything is written", async () => {
  const stub = stubFetch({ templateProject: "999" });
  try {
    await assert.rejects(createAsanaTaskFromTemplate(config, { templateGid: "7001", name: "W01: ??" }), (error) => error.statusCode === 403);
    assert.ok(stub.calls.every((call) => call.method === "GET"));
  } finally {
    stub.restore();
  }
});

test("bad input is refused before anything is read", async () => {
  const stub = stubFetch();
  try {
    await assert.rejects(createAsanaTaskFromTemplate(config, { templateGid: "abc", name: "ok" }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTaskFromTemplate(config, { templateGid: "7001", name: "  " }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTaskFromTemplate(config, { templateGid: "7001", name: "ok", dueOn: "2027-02-30" }), (error) => error.statusCode === 400);
    await assert.rejects(createAsanaTaskFromTemplate(config, { templateGid: "7001", name: "ok", projectKind: "finance" }), (error) => error.statusCode === 400);
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("the route serves both actions behind the session check, the write before the OpenAI check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const list = source.indexOf('action === "asana_task_templates"');
  const create = source.indexOf('requestedAction === "asana_task_from_template"');
  const openAi = source.indexOf("Missing OpenAI API key.");
  assert.ok(auth > 0 && list > auth && create > auth && openAi > create);
  assert.match(source, /"asana_task_templates"/);
});
