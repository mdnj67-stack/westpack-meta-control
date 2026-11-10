const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { planSectionMoves, sortAsanaSectionByDueDate, sortTasksByDueDate } = require("../server/lib/asana");

const config = {
  asanaAccessToken: "token",
  asanaCampaignProjectGid: "111",
  asanaContentProjectGid: "222",
  asanaCreativesProjectGid: "333"
};

// Apply moves the way Asana's addTask does, to check that a plan really produces the target order.
function applyMoves(order, moves) {
  const result = [...order];
  for (const move of moves) {
    result.splice(result.indexOf(move.task), 1);
    const anchor = move.insert_before ?? move.insert_after;
    const at = result.indexOf(anchor);
    assert.ok(at >= 0, `anchor ${anchor} must be in the section`);
    result.splice(move.insert_before ? at : at + 1, 0, move.task);
  }
  return result;
}

test("cards sort by due date, ties keep their order, undated cards go last as they were", () => {
  const sorted = sortTasksByDueDate([
    { gid: "a", due_on: "2027-01-21" },
    { gid: "b" },
    { gid: "c", due_on: "2026-11-17" },
    { gid: "d", due_on: "2027-01-21" },
    { gid: "e", due_at: "2026-12-29T09:00:00.000Z" },
    { gid: "f" }
  ]);
  assert.deepEqual(sorted.map((task) => task.gid), ["c", "e", "a", "d", "b", "f"]);
});

test("a move plan reaches the target order, and a sorted column needs no moves", () => {
  const cases = [
    [["a", "b", "c", "d"], ["d", "c", "b", "a"]],
    [["b", "a", "c", "d"], ["a", "b", "c", "d"]],
    [["a", "b", "c", "d", "e"], ["a", "c", "b", "e", "d"]],
    [["x"], ["x"]]
  ];
  for (const [current, target] of cases) {
    assert.deepEqual(applyMoves(current, planSectionMoves(current, target)), target);
  }
  assert.equal(planSectionMoves(["a", "b", "c"], ["a", "b", "c"]).length, 0);
  assert.equal(planSectionMoves(["b", "a", "c"], ["a", "b", "c"]).length, 1);
});

function stubFetch({ tasks }) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url: String(url), method, body: options.body });
    const u = new URL(String(url));
    if (method === "GET" && u.pathname.endsWith("/projects/111/sections")) {
      return new Response(JSON.stringify({ data: [{ gid: "501", name: "Kampagner" }, { gid: "502", name: "Igangværende" }], next_page: null }), { status: 200 });
    }
    if (method === "GET" && u.pathname.endsWith("/sections/501/tasks")) {
      return new Response(JSON.stringify({ data: tasks, next_page: null }), { status: 200 });
    }
    if (method === "POST" && u.pathname.endsWith("/sections/501/addTask")) {
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    }
    return new Response(JSON.stringify({ errors: [{ message: "unexpected " + method + " " + u.pathname }] }), { status: 500 });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test("a column is found by name, read open-only, and only its cards' places are written", async () => {
  const stub = stubFetch({
    tasks: [
      { gid: "1", name: "W03: Rikke", due_on: "2027-01-21", completed: false },
      { gid: "2", name: "Keramik og lys", due_on: "2026-11-17", completed: false },
      { gid: "3", name: "W07: Step-by-step", due_on: "2027-02-18", completed: false }
    ]
  });
  try {
    const result = await sortAsanaSectionByDueDate(config, { projectKind: "campaign", section: "kampagner" });
    assert.equal(result.section.gid, "501");
    assert.deepEqual(result.order.map((task) => task.gid), ["2", "1", "3"]);
    const read = stub.calls.find((call) => /\/sections\/501\/tasks/.test(call.url));
    assert.equal(new URL(read.url).searchParams.get("completed_since"), "now");
    const writes = stub.calls.filter((call) => call.method !== "GET");
    assert.equal(result.moved, writes.length);
    assert.ok(writes.every((call) => /\/sections\/501\/addTask$/.test(new URL(call.url).pathname)));
    assert.ok(writes.every((call) => Object.keys(JSON.parse(call.body).data).every((key) => ["task", "insert_before", "insert_after"].includes(key))));
  } finally {
    stub.restore();
  }
});

test("an unknown column or project kind is refused before anything is written", async () => {
  const stub = stubFetch({ tasks: [] });
  try {
    await assert.rejects(sortAsanaSectionByDueDate(config, { section: "Nope" }), (error) => error.statusCode === 404);
    await assert.rejects(sortAsanaSectionByDueDate(config, { section: "Kampagner", projectKind: "finance" }), (error) => error.statusCode === 400);
    await assert.rejects(sortAsanaSectionByDueDate(config, { section: " " }), (error) => error.statusCode === 400);
    assert.ok(stub.calls.every((call) => call.method === "GET"));
  } finally {
    stub.restore();
  }
});

test("the route sorts behind the session check and before the OpenAI check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const sort = source.indexOf('requestedAction === "asana_section_sort"');
  const openAi = source.indexOf("Missing OpenAI API key.");
  assert.ok(auth > 0 && sort > auth && openAi > sort);
});
