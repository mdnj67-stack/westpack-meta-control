const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildAsanaProject, normalizeProjectOutline } = require("../server/lib/asana");

const config = { asanaAccessToken: "token" };
const OWNER = "42";
const MARTIN = "77";
const OUTSIDER = "99";

// An in-memory Asana: the owner (42) is in team "Marketing" (500), Martin (77) is in the workspace, 99 is not.
// New projects come with an empty "Untitled section", and a new card lands at the top of its column, so the
// build has to put the cards in order itself.
function fakeAsana({ projects = [] } = {}) {
  const state = {
    projects: projects.map((project) => ({ ...project })),
    sections: [],
    tasks: [],
    memberships: [],
    writes: [],
    nextGid: 1000
  };
  const gid = () => String(state.nextGid++);
  const ok = (data, extra = {}) => new Response(JSON.stringify({ data, ...extra }), { status: 200 });
  const original = global.fetch;
  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    const route = url.pathname.replace("/api/1.0", "");
    const body = options.body ? JSON.parse(options.body).data : undefined;
    if (method !== "GET") state.writes.push({ method, route, body });

    if (method === "GET" && route === "/users/me") {
      return ok({ gid: OWNER, name: "Mads", workspaces: [{ gid: "900", name: "westpack.com" }] });
    }
    if (method === "GET" && route === `/users/${OWNER}/teams`) {
      assert.equal(url.searchParams.get("organization"), "900");
      return ok([{ gid: "500", name: "Marketing" }, { gid: "501", name: "Mads's First Team" }]);
    }
    if (method === "GET" && route === `/users/${MARTIN}`) return ok({ gid: MARTIN, name: "Martin", workspaces: [{ gid: "900" }] });
    if (method === "GET" && route === `/users/${OUTSIDER}`) return ok({ gid: OUTSIDER, name: "Someone", workspaces: [{ gid: "123" }] });
    if (method === "GET" && /^\/teams\/\d+\/projects$/.test(route)) {
      const team = route.split("/")[2];
      return ok(state.projects.filter((project) => project.team === team).map((project) => ({
        gid: project.gid, name: project.name, owner: { gid: project.owner }, permalink_url: `https://app.asana.com/0/${project.gid}`
      })));
    }
    if (method === "POST" && route === "/projects") {
      const project = { gid: gid(), name: body.name, team: body.team, owner: OWNER, view: body.default_view, notes: body.html_notes, color: body.color };
      state.projects.push(project);
      state.sections.push({ gid: gid(), name: "Untitled section", project: project.gid });
      return ok({ gid: project.gid, name: project.name, permalink_url: `https://app.asana.com/0/${project.gid}` });
    }
    if (method === "GET" && route === "/memberships") {
      return ok(state.memberships.filter((item) => item.parent === url.searchParams.get("parent")).map((item) => ({ member: { gid: item.member } })));
    }
    if (method === "POST" && route === "/memberships") {
      state.memberships.push({ parent: body.parent, member: body.member, access: body.access_level });
      return ok({ gid: gid() });
    }
    if (/^\/projects\/\d+\/sections$/.test(route)) {
      const project = route.split("/")[2];
      if (method === "GET") return ok(state.sections.filter((section) => section.project === project));
      const section = { gid: gid(), name: body.name, project };
      state.sections.push(section);
      return ok({ gid: section.gid, name: section.name });
    }
    if (method === "DELETE" && /^\/sections\/\d+$/.test(route)) {
      const at = state.sections.findIndex((section) => section.gid === route.split("/")[2]);
      assert.ok(!state.tasks.some((task) => task.section === state.sections[at].gid), "only an empty section may be deleted");
      state.sections.splice(at, 1);
      return ok({});
    }
    if (method === "GET" && /^\/projects\/\d+\/tasks$/.test(route)) {
      const project = route.split("/")[2];
      return ok(state.tasks.filter((task) => task.project === project).map((task) => ({
        gid: task.gid, name: task.name, memberships: [{ project: { gid: project }, section: { gid: task.section } }]
      })));
    }
    if (method === "POST" && route === "/tasks") {
      // Real Asana answers 400 to a task with only `memberships`.
      if (!body.workspace && !body.projects && !body.parent) {
        return new Response(JSON.stringify({ errors: [{ message: "You should specify one of workspace, parent, projects" }] }), { status: 400 });
      }
      const [membership] = body.memberships;
      state.tasks.unshift({ gid: gid(), name: body.name, notes: body.html_notes, project: membership.project, section: membership.section });
      return ok({ gid: state.tasks[0].gid });
    }
    if (method === "GET" && /^\/sections\/\d+\/tasks$/.test(route)) {
      return ok(state.tasks.filter((task) => task.section === route.split("/")[2]).map((task) => ({ gid: task.gid })));
    }
    if (method === "POST" && /^\/sections\/\d+\/addTask$/.test(route)) {
      const at = state.tasks.findIndex((task) => task.gid === body.task);
      const [task] = state.tasks.splice(at, 1);
      const anchor = body.insert_before || body.insert_after;
      const to = state.tasks.findIndex((item) => item.gid === anchor) + (body.insert_after ? 1 : 0);
      state.tasks.splice(to, 0, task);
      return ok({});
    }
    throw new Error(`Unexpected ${method} ${route}`);
  };
  return { state, restore: () => { global.fetch = original; } };
}

const OUTLINE = {
  name: "E-mail automation",
  notes: "Alle idéer samlet. **Klaviyo eller HubSpot?** Med @{77}.",
  team: "marketing",
  members: [MARTIN],
  color: "dark-green",
  sections: [
    { name: "Indbakke", tasks: [{ name: "Sådan bruger vi projektet", notes: "Hej @{77}\nSmid idéer her." }] },
    { name: "Grundbeslutninger", tasks: [{ name: "Klaviyo, HubSpot eller et mix" }, { name: "Hvad tæller som permission" }, { name: "Hvad må vi uden permission" }] },
    { name: "Parkeret", tasks: [] }
  ]
};

const cardsIn = (state, sectionName) => {
  const section = state.sections.find((item) => item.name === sectionName);
  return state.tasks.filter((task) => task.section === section.gid).map((task) => task.name);
};

test("a new project: in the owner's team, Martin as editor, columns and cards in the outline's order", async () => {
  const asana = fakeAsana();
  try {
    const result = await buildAsanaProject(config, OUTLINE);
    const { state } = asana;
    assert.equal(result.done, true);
    assert.equal(result.project.created, true);
    assert.equal(result.team.name, "Marketing");
    const created = state.writes.find((write) => write.route === "/projects").body;
    assert.deepEqual(
      { team: created.team, workspace: created.workspace, view: created.default_view, color: created.color },
      { team: "500", workspace: "900", view: "board", color: "dark-green" }
    );
    assert.equal(created.html_notes, '<body>Alle idéer samlet. <strong>Klaviyo eller HubSpot?</strong> Med <a data-asana-gid="77"/>.</body>');
    assert.deepEqual(state.memberships.map((item) => [item.member, item.access]), [[MARTIN, "editor"]]);
    assert.deepEqual(state.sections.map((section) => section.name), ["Indbakke", "Grundbeslutninger", "Parkeret"]);
    assert.deepEqual(result.sections.removed, ["Untitled section"]);
    assert.deepEqual(cardsIn(state, "Grundbeslutninger"), ["Klaviyo, HubSpot eller et mix", "Hvad tæller som permission", "Hvad må vi uden permission"]);
    assert.equal(state.tasks.find((task) => task.name === "Sådan bruger vi projektet").notes, '<body>Hej <a data-asana-gid="77"/>\nSmid idéer her.</body>');
    assert.equal(result.tasks.created, 4);
    assert.deepEqual(result.members.added, ["Martin"]);
  } finally {
    asana.restore();
  }
});

test("sending the same outline again writes nothing", async () => {
  const asana = fakeAsana();
  try {
    await buildAsanaProject(config, OUTLINE);
    const before = asana.state.writes.length;
    const again = await buildAsanaProject(config, OUTLINE);
    assert.equal(asana.state.writes.length, before);
    assert.equal(again.project.created, false);
    assert.equal(again.tasks.created, 0);
    assert.equal(again.tasks.existing, 4);
    assert.equal(asana.state.projects.length, 1);
  } finally {
    asana.restore();
  }
});

test("a build that runs out of time stops, and the same request finishes it without duplicates", async () => {
  const asana = fakeAsana();
  try {
    let clock = 0;
    const first = await buildAsanaProject(config, OUTLINE, { now: () => (clock += 1000), budgetMs: 2500 });
    assert.equal(first.done, false);
    assert.ok(first.tasks.remaining > 0);
    const second = await buildAsanaProject(config, OUTLINE);
    assert.equal(second.done, true);
    assert.equal(first.tasks.created + second.tasks.created, 4);
    assert.equal(asana.state.tasks.length, 4);
    assert.deepEqual(cardsIn(asana.state, "Grundbeslutninger"), ["Klaviyo, HubSpot eller et mix", "Hvad tæller som permission", "Hvad må vi uden permission"]);
  } finally {
    asana.restore();
  }
});

test("a project of the same name owned by someone else is refused, with nothing written", async () => {
  const asana = fakeAsana({ projects: [{ gid: "700", name: "e-mail automation", team: "500", owner: MARTIN }] });
  try {
    await assert.rejects(buildAsanaProject(config, OUTLINE), (error) => error.statusCode === 409);
    assert.equal(asana.state.writes.length, 0);
  } finally {
    asana.restore();
  }
});

test("only the owner's own teams, and only workspace members, with nothing written on a refusal", async () => {
  const asana = fakeAsana();
  try {
    await assert.rejects(buildAsanaProject(config, { ...OUTLINE, team: "Sales" }), (error) => error.statusCode === 403 && /Marketing/.test(error.message));
    await assert.rejects(buildAsanaProject(config, { ...OUTLINE, members: [MARTIN, OUTSIDER] }), (error) => error.statusCode === 403);
    await assert.rejects(
      buildAsanaProject(config, { ...OUTLINE, notes: "Spørg @{99}" }),
      (error) => error.statusCode === 400 && /cannot be mentioned/.test(error.message)
    );
    assert.equal(asana.state.writes.length, 0);
  } finally {
    asana.restore();
  }
});

test("the outline is checked before Asana is asked anything", () => {
  const bad = [
    { ...OUTLINE, name: "" },
    { ...OUTLINE, team: "" },
    { ...OUTLINE, view: "gantt" },
    { ...OUTLINE, color: "gold" },
    { ...OUTLINE, members: ["martin"] },
    { ...OUTLINE, sections: [] },
    { ...OUTLINE, sections: [{ name: "A" }, { name: "a" }] },
    { ...OUTLINE, sections: [{ name: "A", tasks: [{ name: "X" }, { name: "x" }] }] },
    { ...OUTLINE, sections: [{ name: "A", tasks: Array.from({ length: 81 }, (_, index) => ({ name: `Card ${index}` })) }] }
  ];
  for (const outline of bad) {
    assert.throws(() => normalizeProjectOutline(outline), (error) => error.statusCode === 400);
  }
  assert.equal(normalizeProjectOutline(OUTLINE).view, "board");
});

test("the route is dispatched behind the session check and before the OpenAI check", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  const auth = source.indexOf("requireAuth(req, res, config)");
  const build = source.indexOf('requestedAction === "asana_project_build"');
  const openAi = source.indexOf("Missing OpenAI API key.");
  assert.ok(auth > 0 && build > auth && build < openAi);
});
