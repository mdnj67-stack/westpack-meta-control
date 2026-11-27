const { fetchWithTimeout } = require("./http");

const ASANA_API_BASE_URL = "https://app.asana.com/api/1.0";

function normalizeAsanaError(payload = {}, status = 500) {
  const messages = Array.isArray(payload?.errors)
    ? payload.errors.map((item) => String(item?.message || "").trim()).filter(Boolean)
    : [];
  const message = messages[0]
    || (status === 401 ? "Asana rejected the access token." : "Asana request failed.");
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

async function asanaGetPage(config, resourcePath, query = {}) {
  if (!config?.asanaAccessToken) {
    const error = new Error("ASANA_ACCESS_TOKEN is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const normalizedPath = String(resourcePath || "").trim();
  if (!normalizedPath.startsWith("/") || normalizedPath.includes("..")) {
    const error = new Error("Invalid Asana resource path.");
    error.statusCode = 400;
    throw error;
  }

  const url = new URL(`${ASANA_API_BASE_URL}${normalizedPath}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.asanaAccessToken}`
    }
  }, 20000);

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return {
    data: payload?.data,
    nextPage: payload?.next_page || null
  };
}

async function asanaGet(config, resourcePath, query = {}) {
  const page = await asanaGetPage(config, resourcePath, query);
  return page.data;
}

async function getAsanaConnectionProfile(config) {
  const user = await asanaGet(config, "/users/me", {
    opt_fields: "gid,name,workspaces.gid,workspaces.name"
  });
  return {
    gid: String(user?.gid || ""),
    name: String(user?.name || ""),
    workspaces: Array.isArray(user?.workspaces)
      ? user.workspaces.map((workspace) => ({
          gid: String(workspace?.gid || ""),
          name: String(workspace?.name || "")
        })).filter((workspace) => workspace.gid)
      : []
  };
}

async function getAsanaWorkspaceProjects(config, workspaceGid) {
  const normalizedWorkspaceGid = String(workspaceGid || "").trim();
  if (!/^\d+$/.test(normalizedWorkspaceGid)) {
    const error = new Error("A valid Asana workspace GID is required.");
    error.statusCode = 400;
    throw error;
  }

  const projects = [];
  let offset = "";
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const page = await asanaGetPage(config, `/workspaces/${normalizedWorkspaceGid}/projects`, {
      archived: "false",
      limit: 100,
      offset,
      opt_fields: "gid,name,archived,team.name,permalink_url"
    });
    const records = Array.isArray(page.data) ? page.data : [];
    projects.push(...records.map((project) => ({
      gid: String(project?.gid || ""),
      name: String(project?.name || ""),
      archived: Boolean(project?.archived),
      teamName: String(project?.team?.name || ""),
      permalinkUrl: String(project?.permalink_url || "")
    })).filter((project) => project.gid && project.name));
    offset = String(page.nextPage?.offset || "");
    if (!offset) {
      break;
    }
  }

  return projects.sort((left, right) => left.name.localeCompare(right.name));
}

async function collectAsanaPages(config, resourcePath, query = {}, maxPages = 5) {
  const records = [];
  let offset = "";
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await asanaGetPage(config, resourcePath, {
      ...query,
      limit: 100,
      offset
    });
    records.push(...(Array.isArray(page.data) ? page.data : []));
    offset = String(page.nextPage?.offset || "");
    if (!offset) {
      break;
    }
  }
  return records;
}

function normalizeAsanaCustomField(field = {}) {
  const value = field?.display_value
    ?? field?.text_value
    ?? field?.number_value
    ?? field?.enum_value?.name
    ?? (Array.isArray(field?.multi_enum_values) ? field.multi_enum_values.map((item) => item?.name).filter(Boolean).join(", ") : "")
    ?? "";
  return {
    gid: String(field?.gid || ""),
    name: String(field?.name || ""),
    type: String(field?.type || field?.resource_subtype || ""),
    value: String(value ?? "")
  };
}

function normalizeAsanaTask(task = {}) {
  const memberships = Array.isArray(task?.memberships) ? task.memberships : [];
  return {
    gid: String(task?.gid || ""),
    name: String(task?.name || ""),
    completed: Boolean(task?.completed),
    completedAt: String(task?.completed_at || ""),
    dueOn: String(task?.due_on || ""),
    dueAt: String(task?.due_at || ""),
    modifiedAt: String(task?.modified_at || ""),
    assignee: task?.assignee ? {
      gid: String(task.assignee.gid || ""),
      name: String(task.assignee.name || "")
    } : null,
    sections: memberships.map((membership) => String(membership?.section?.name || "")).filter(Boolean),
    customFields: Array.isArray(task?.custom_fields)
      ? task.custom_fields.map(normalizeAsanaCustomField).filter((field) => field.gid || field.name)
      : [],
    notes: String(task?.notes || ""),
    htmlNotes: String(task?.html_notes || ""),
    permalinkUrl: String(task?.permalink_url || ""),
    parent: task?.parent ? {
      gid: String(task.parent.gid || ""),
      name: String(task.parent.name || "")
    } : null
  };
}

const ASANA_TASK_FIELDS = [
  "gid",
  "name",
  "completed",
  "completed_at",
  "due_on",
  "due_at",
  "modified_at",
  "assignee.gid",
  "assignee.name",
  "memberships.section.name",
  "custom_fields.gid",
  "custom_fields.name",
  "custom_fields.type",
  "custom_fields.display_value",
  "custom_fields.text_value",
  "custom_fields.number_value",
  "custom_fields.enum_value.name",
  "custom_fields.multi_enum_values.name",
  "notes",
  "html_notes",
  "permalink_url",
  "parent.gid",
  "parent.name"
].join(",");

const ASANA_ATTACHMENT_FIELDS = "gid,name,resource_subtype,download_url,permanent_url,view_url,host,created_at";

function normalizeAsanaAttachment(attachment = {}, parentTask = null) {
  return {
    gid: String(attachment?.gid || ""),
    name: String(attachment?.name || ""),
    resourceSubtype: String(attachment?.resource_subtype || ""),
    downloadUrl: String(attachment?.download_url || ""),
    permanentUrl: String(attachment?.permanent_url || ""),
    viewUrl: String(attachment?.view_url || ""),
    host: String(attachment?.host || ""),
    createdAt: String(attachment?.created_at || ""),
    parentTaskGid: String(parentTask?.gid || ""),
    parentTaskName: String(parentTask?.name || "")
  };
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function getAsanaSubtaskAttachments(config, subtask) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const records = await collectAsanaPages(config, `/tasks/${subtask.gid}/attachments`, {
        opt_fields: ASANA_ATTACHMENT_FIELDS
      }, 3);
      return {
        attachments: records.map((attachment) => normalizeAsanaAttachment(attachment, subtask)),
        failed: false
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(350 * (attempt + 1));
    }
  }
  return {
    attachments: [],
    failed: true,
    error: String(lastError?.message || "Attachment request failed")
  };
}

async function getAsanaProjectTasks(config, projectGid, { includeCompleted = false } = {}) {
  const normalizedProjectGid = String(projectGid || "").trim();
  if (!/^\d+$/.test(normalizedProjectGid)) {
    const error = new Error("A valid Asana project GID is required.");
    error.statusCode = 400;
    throw error;
  }
  const tasks = await collectAsanaPages(config, `/projects/${normalizedProjectGid}/tasks`, {
    opt_fields: ASANA_TASK_FIELDS
  });
  return tasks
    .map(normalizeAsanaTask)
    .filter((task) => task.gid && task.name && (includeCompleted || !task.completed))
    .sort((left, right) => {
      const leftDue = Date.parse(left.dueOn || left.dueAt || "") || Number.MAX_SAFE_INTEGER;
      const rightDue = Date.parse(right.dueOn || right.dueAt || "") || Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue || left.name.localeCompare(right.name);
    });
}

// The projects the dashboard may list, by the `kind` the API is asked for. An unknown kind is
// refused rather than falling back to the campaign project, so a typo cannot quietly return the
// wrong board.
const ASANA_PROJECT_KINDS = {
  campaign: "asanaCampaignProjectGid",
  content: "asanaContentProjectGid",
  creatives: "asanaCreativesProjectGid",
  production: "asanaProductionProjectGid"
};

function resolveAsanaProjectGid(config = {}, kind = "campaign") {
  const normalizedKind = String(kind || "campaign").trim().toLowerCase();
  const configKey = ASANA_PROJECT_KINDS[normalizedKind];
  if (!configKey) {
    const error = new Error(`Unknown Asana project kind "${normalizedKind}". Use one of: ${Object.keys(ASANA_PROJECT_KINDS).join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }
  return { kind: normalizedKind, projectGid: String(config[configKey] || "").trim() };
}

// Comments only, not the system stories (moves, assignments), because the comments are where a
// reviewer leaves feedback on a creative.
async function getAsanaTaskComments(config, taskGid) {
  const normalizedTaskGid = String(taskGid || "").trim();
  if (!/^\d+$/.test(normalizedTaskGid)) {
    const error = new Error("A valid Asana task GID is required.");
    error.statusCode = 400;
    throw error;
  }
  const stories = await collectAsanaPages(config, `/tasks/${normalizedTaskGid}/stories`, {
    opt_fields: "gid,type,text,created_at,created_by.name"
  }, 3);
  return stories
    .filter((story) => story?.type === "comment")
    .map((story) => ({
      gid: String(story.gid || ""),
      text: String(story.text || ""),
      createdAt: String(story.created_at || ""),
      author: String(story.created_by?.name || "")
    }));
}

// The one write this module makes: a comment on a task in one of the projects the app is configured for
// (campaign, content, Meta Creatives). A task anywhere else in the workspace is refused, so the route
// cannot be used to post into boards the dashboard has no business in.
const MAX_COMMENT_CHARS = 4000;

async function addAsanaTaskComment(config, taskGid, text) {
  const normalizedTaskGid = String(taskGid || "").trim();
  const body = String(text || "").trim();
  if (!/^\d+$/.test(normalizedTaskGid)) {
    const error = new Error("A valid Asana task GID is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!body || body.length > MAX_COMMENT_CHARS) {
    const error = new Error(`A comment needs between 1 and ${MAX_COMMENT_CHARS} characters.`);
    error.statusCode = 400;
    throw error;
  }
  const allowed = new Set(Object.keys(ASANA_PROJECT_KINDS).map((kind) => resolveAsanaProjectGid(config, kind).projectGid).filter(Boolean));
  const task = await asanaGet(config, `/tasks/${normalizedTaskGid}`, { opt_fields: "gid,name,projects.gid" });
  if (!(task?.projects || []).some((project) => allowed.has(String(project?.gid || "")))) {
    const error = new Error("The task is not in a project this app works with.");
    error.statusCode = 403;
    throw error;
  }
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/tasks/${normalizedTaskGid}/stories`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.asanaAccessToken}`
    },
    body: JSON.stringify({ data: { text: body } })
  }, 20000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return {
    gid: String(payload?.data?.gid || ""),
    taskGid: normalizedTaskGid,
    taskName: String(task?.name || ""),
    createdAt: String(payload?.data?.created_at || "")
  };
}

// The second write: a to-do for the token's owner. The task is always assigned to "me" - the person whose
// token this is - in that person's own workspace, optionally inside one of the app's projects. It can never
// be assigned to someone else, so the route cannot fill colleagues' task lists.
const MAX_TASK_NAME_CHARS = 300;
const MAX_TASK_NOTES_CHARS = 20000;

function validDueOn(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : text;
}

async function createAsanaTask(config, { name, notes, dueOn, projectKind } = {}) {
  const taskName = String(name || "").trim();
  const taskNotes = String(notes || "").trim();
  const due = validDueOn(dueOn);
  if (!taskName || taskName.length > MAX_TASK_NAME_CHARS) {
    const error = new Error(`A task name needs between 1 and ${MAX_TASK_NAME_CHARS} characters.`);
    error.statusCode = 400;
    throw error;
  }
  if (taskNotes.length > MAX_TASK_NOTES_CHARS) {
    const error = new Error(`Task notes can be at most ${MAX_TASK_NOTES_CHARS} characters.`);
    error.statusCode = 400;
    throw error;
  }
  if (due === null) {
    const error = new Error("dueOn must be a real date written YYYY-MM-DD.");
    error.statusCode = 400;
    throw error;
  }
  let projectGid = "";
  if (projectKind) {
    if (!ASANA_PROJECT_KINDS[String(projectKind).trim().toLowerCase()]) {
      const error = new Error(`Unknown Asana project kind "${projectKind}". Use ${Object.keys(ASANA_PROJECT_KINDS).join(", ")} or leave it out for My Tasks.`);
      error.statusCode = 400;
      throw error;
    }
    projectGid = resolveAsanaProjectGid(config, projectKind).projectGid;
    if (!projectGid) {
      const error = new Error(`The Asana ${projectKind} project is not configured.`);
      error.statusCode = 503;
      throw error;
    }
  }
  const profile = await getAsanaConnectionProfile(config);
  const workspaceGid = profile.workspaces?.[0]?.gid || "";
  if (!workspaceGid) {
    const error = new Error("The Asana token has no workspace.");
    error.statusCode = 503;
    throw error;
  }
  const data = { name: taskName, assignee: "me", workspace: workspaceGid };
  if (taskNotes) data.notes = taskNotes;
  if (due) data.due_on = due;
  if (projectGid) data.projects = [projectGid];
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/tasks?opt_fields=gid,name,due_on,permalink_url,assignee.name`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.asanaAccessToken}`
    },
    body: JSON.stringify({ data })
  }, 20000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return {
    gid: String(payload?.data?.gid || ""),
    name: String(payload?.data?.name || taskName),
    dueOn: String(payload?.data?.due_on || due || ""),
    assignee: String(payload?.data?.assignee?.name || profile.name || ""),
    permalinkUrl: String(payload?.data?.permalink_url || ""),
    projectGid
  };
}

// An instant with its offset (2026-12-14T08:00:00+01:00), returned as UTC ISO. A bare local time is refused:
// "08:00" means a different instant on Vercel (UTC) than in Copenhagen.
function validDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// The seventh write: a change to one of the token owner's own to-dos - its name, its notes, a due date, or a
// time block (startAt + dueAt) that reserves part of a day in Asana's calendar. A task assigned to anyone else,
// or to no one (a project card), is refused with 403, so this can never edit a colleague's task.
async function updateAsanaTask(config, { taskGid, name, notes, dueOn, startAt, dueAt } = {}) {
  const gid = String(taskGid || "").trim();
  const refuse = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  };
  if (!/^\d+$/.test(gid)) throw refuse("A valid Asana task GID is required.");
  const data = {};
  if (name !== undefined) {
    const taskName = String(name || "").trim();
    if (!taskName || taskName.length > MAX_TASK_NAME_CHARS) throw refuse(`A task name needs between 1 and ${MAX_TASK_NAME_CHARS} characters.`);
    data.name = taskName;
  }
  if (notes !== undefined) {
    const taskNotes = String(notes || "").trim();
    if (taskNotes.length > MAX_TASK_NOTES_CHARS) throw refuse(`Task notes can be at most ${MAX_TASK_NOTES_CHARS} characters.`);
    data.notes = taskNotes;
  }
  const day = dueOn === undefined ? undefined : validDueOn(dueOn);
  const start = startAt === undefined ? undefined : validDateTime(startAt);
  const end = dueAt === undefined ? undefined : validDateTime(dueAt);
  if (day === null) throw refuse("dueOn must be a real date written YYYY-MM-DD.");
  if (start === null || end === null) throw refuse("startAt and dueAt must be date-times with an offset, e.g. 2026-12-14T08:00:00+01:00.");
  if (start && !end) throw refuse("A start time needs a due time.");
  if (start && end && start >= end) throw refuse("The start time must be before the due time.");
  if (end && day) throw refuse("Give a due date or a due time, not both.");
  if (end) {
    data.due_at = end;
    data.start_at = start || null;
  } else if (day !== undefined) {
    // A date clears any time block: Asana refuses a start time without a due time.
    data.due_on = day || null;
    data.start_at = null;
  }
  if (!Object.keys(data).length) throw refuse("Nothing to change.");

  const [task, profile] = await Promise.all([
    asanaGet(config, `/tasks/${gid}`, { opt_fields: "gid,assignee.gid" }),
    getAsanaConnectionProfile(config)
  ]);
  const assigneeGid = String(task?.assignee?.gid || "");
  if (!assigneeGid || !profile.gid || assigneeGid !== profile.gid) {
    throw refuse("Only your own Asana to-dos can be changed here.", 403);
  }
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/tasks/${gid}?opt_fields=gid,name,due_on,due_at,start_at,permalink_url`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.asanaAccessToken}`
    },
    body: JSON.stringify({ data })
  }, 20000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return {
    gid,
    name: String(payload?.data?.name || ""),
    dueOn: String(payload?.data?.due_on || ""),
    dueAt: String(payload?.data?.due_at || ""),
    startAt: String(payload?.data?.start_at || ""),
    permalinkUrl: String(payload?.data?.permalink_url || "")
  };
}

// Workspace members whose name starts with or contains the query, so a content request can name who it is for.
// Read-only (Asana's typeahead).
async function findAsanaUsers(config, query) {
  const text = String(query || "").trim();
  if (text.length < 2 || text.length > 60) {
    const error = new Error("Search for a person with 2 to 60 characters.");
    error.statusCode = 400;
    throw error;
  }
  const profile = await getAsanaConnectionProfile(config);
  const workspaceGid = profile.workspaces?.[0]?.gid || "";
  if (!workspaceGid) {
    const error = new Error("The Asana token has no workspace.");
    error.statusCode = 503;
    throw error;
  }
  const users = await asanaGet(config, `/workspaces/${workspaceGid}/typeahead`, { resource_type: "user", query: text, count: 10, opt_fields: "gid,name,email" });
  return (Array.isArray(users) ? users : []).map((user) => ({
    gid: String(user?.gid || ""),
    name: String(user?.name || ""),
    email: String(user?.email || "")
  })).filter((user) => user.gid);
}

// Plain text with **bold** to Asana's rich text. Everything else is escaped, and newlines stay newlines.
function toAsanaHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

// The third write: a content request on the content team's board (Content Production), in one of its columns,
// for a named colleague, with colleagues to keep informed. Unlike createAsanaTask this one is meant for someone
// else's list, which is why it is confined to that one project, every person must be a member of the token's
// workspace, and the followers are @-mentioned in the description so they are notified.
const MAX_REQUEST_FOLLOWERS = 5;

async function createAsanaContentRequest(config, { name, notes, dueOn, section = "Content requests", assignee, followers = [] } = {}) {
  const taskName = String(name || "").trim();
  const taskNotes = String(notes || "").trim();
  const due = validDueOn(dueOn);
  const assigneeGid = String(assignee || "").trim();
  const followerGids = [...new Set((Array.isArray(followers) ? followers : []).map((gid) => String(gid || "").trim()).filter(Boolean))];
  const sectionName = String(section || "").trim().toLowerCase();
  const refuse = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
  if (!taskName || taskName.length > MAX_TASK_NAME_CHARS) refuse(`A task name needs between 1 and ${MAX_TASK_NAME_CHARS} characters.`);
  if (taskNotes.length > MAX_TASK_NOTES_CHARS) refuse(`Task notes can be at most ${MAX_TASK_NOTES_CHARS} characters.`);
  if (due === null) refuse("dueOn must be a real date written YYYY-MM-DD.");
  if (!/^\d+$/.test(assigneeGid)) refuse("A content request needs an assignee (an Asana user GID).");
  if (followerGids.length > MAX_REQUEST_FOLLOWERS || followerGids.some((gid) => !/^\d+$/.test(gid))) refuse(`Followers must be up to ${MAX_REQUEST_FOLLOWERS} Asana user GIDs.`);
  if (!sectionName) refuse("Name the column the request goes in.");
  const projectGid = resolveAsanaProjectGid(config, "production").projectGid;
  if (!projectGid) refuse("The Asana production project is not configured.", 503);

  const profile = await getAsanaConnectionProfile(config);
  const workspaceGid = profile.workspaces?.[0]?.gid || "";
  if (!workspaceGid) refuse("The Asana token has no workspace.", 503);
  const people = {};
  for (const gid of [assigneeGid, ...followerGids]) {
    const user = await asanaGet(config, `/users/${gid}`, { opt_fields: "gid,name,workspaces.gid" });
    if (!(user?.workspaces || []).some((workspace) => String(workspace?.gid || "") === workspaceGid)) {
      refuse(`User ${gid} is not a member of the ${profile.workspaces[0].name || "Asana"} workspace.`, 403);
    }
    people[gid] = String(user?.name || "");
  }
  const sections = await asanaGet(config, `/projects/${projectGid}/sections`, { opt_fields: "gid,name" });
  const target = (Array.isArray(sections) ? sections : []).find((item) => String(item?.name || "").trim().toLowerCase() === sectionName);
  if (!target) refuse(`No column named "${section}" in Content Production. Columns: ${(sections || []).map((item) => item.name).join(", ")}.`);

  const mentions = followerGids.length ? `\n\nCc: ${followerGids.map((gid) => `<a data-asana-gid="${gid}"/>`).join(" ")}` : "";
  const data = {
    name: taskName,
    workspace: workspaceGid,
    assignee: assigneeGid,
    memberships: [{ project: projectGid, section: String(target.gid) }],
    html_notes: `<body>${toAsanaHtml(taskNotes)}${mentions}</body>`
  };
  if (followerGids.length) data.followers = followerGids;
  if (due) data.due_on = due;
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/tasks?opt_fields=gid,name,due_on,permalink_url,assignee.name,followers.name`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.asanaAccessToken}`
    },
    body: JSON.stringify({ data })
  }, 20000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return {
    gid: String(payload?.data?.gid || ""),
    name: String(payload?.data?.name || taskName),
    dueOn: String(payload?.data?.due_on || due || ""),
    assignee: String(payload?.data?.assignee?.name || people[assigneeGid] || ""),
    followers: (payload?.data?.followers || []).map((follower) => String(follower?.name || "")).filter(Boolean),
    section: String(target.name || ""),
    permalinkUrl: String(payload?.data?.permalink_url || ""),
    projectGid
  };
}

// The fourth write: a file attached to a task in one of the app's projects (a preview video on a content request,
// for example). The request body is the file itself, so it is held to what a Vercel function accepts.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ATTACHMENT_TYPES = new Set(["video/mp4", "video/quicktime", "image/jpeg", "image/png", "application/pdf"]);

async function attachFileToAsanaTask(config, { taskGid, fileName, contentType, buffer } = {}) {
  const normalizedTaskGid = String(taskGid || "").trim();
  const name = String(fileName || "").trim();
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  const refuse = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
  if (!/^\d+$/.test(normalizedTaskGid)) refuse("A valid Asana task GID is required.");
  if (!name || name.length > 120 || /[\\/]/.test(name)) refuse("A file name needs 1 to 120 characters and no slashes.");
  if (!ATTACHMENT_TYPES.has(type)) refuse(`Only ${[...ATTACHMENT_TYPES].join(", ")} can be attached.`, 415);
  if (!Buffer.isBuffer(buffer) || !buffer.length) refuse("The file is empty.");
  if (buffer.length > MAX_ATTACHMENT_BYTES) refuse(`The file can be at most ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`, 413);
  const allowed = new Set(Object.keys(ASANA_PROJECT_KINDS).map((kind) => resolveAsanaProjectGid(config, kind).projectGid).filter(Boolean));
  const task = await asanaGet(config, `/tasks/${normalizedTaskGid}`, { opt_fields: "gid,name,projects.gid" });
  if (!(task?.projects || []).some((project) => allowed.has(String(project?.gid || "")))) refuse("The task is not in a project this app works with.", 403);
  const form = new FormData();
  form.append("parent", normalizedTaskGid);
  form.append("file", new Blob([buffer], { type }), name);
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/attachments?opt_fields=gid,name,size,view_url`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${config.asanaAccessToken}` },
    body: form
  }, 60000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return {
    gid: String(payload?.data?.gid || ""),
    name: String(payload?.data?.name || name),
    size: Number(payload?.data?.size || buffer.length),
    taskGid: normalizedTaskGid,
    taskName: String(task?.name || "")
  };
}

async function getAsanaTaskSubtasks(config, taskGid) {
  const normalizedTaskGid = String(taskGid || "").trim();
  if (!/^\d+$/.test(normalizedTaskGid)) {
    const error = new Error("A valid Asana task GID is required.");
    error.statusCode = 400;
    throw error;
  }
  const subtasks = await collectAsanaPages(config, `/tasks/${normalizedTaskGid}/subtasks`, {
    opt_fields: ASANA_TASK_FIELDS
  }, 3);
  return subtasks.map(normalizeAsanaTask).filter((task) => task.gid);
}

async function getAsanaTaskBundle(config, taskGid) {
  const normalizedTaskGid = String(taskGid || "").trim();
  if (!/^\d+$/.test(normalizedTaskGid)) {
    const error = new Error("A valid Asana task GID is required.");
    error.statusCode = 400;
    throw error;
  }
  const [task, subtasks, attachments] = await Promise.all([
    asanaGet(config, `/tasks/${normalizedTaskGid}`, { opt_fields: ASANA_TASK_FIELDS }),
    collectAsanaPages(config, `/tasks/${normalizedTaskGid}/subtasks`, { opt_fields: ASANA_TASK_FIELDS }, 3),
    collectAsanaPages(config, `/tasks/${normalizedTaskGid}/attachments`, {
      opt_fields: ASANA_ATTACHMENT_FIELDS
    }, 3)
  ]);
  const normalizedSubtasks = subtasks.map(normalizeAsanaTask).filter((item) => item.gid);
  const attachmentSubtasks = normalizedSubtasks
    .filter((subtask) => /(?:^|\b)(?:1x1|4x5|9x16|16x9|image|images|billede|billeder|video|asset|assets|content|foto|photo|creative)(?:\b|$)/i.test(subtask.name))
    .slice(0, 12);
  const nestedAttachmentResults = await Promise.all(
    attachmentSubtasks.map((subtask) => getAsanaSubtaskAttachments(config, subtask))
  );
  const allAttachments = [
    ...attachments.map((attachment) => normalizeAsanaAttachment(attachment)),
    ...nestedAttachmentResults.flatMap((result) => result.attachments)
  ].filter((attachment, index, values) => (
    attachment.gid && values.findIndex((candidate) => candidate.gid === attachment.gid) === index
  ));
  return {
    task: normalizeAsanaTask(task),
    subtasks: normalizedSubtasks,
    attachments: allAttachments,
    attachmentSummary: {
      directCount: attachments.length,
      nestedCount: allAttachments.length - attachments.length,
      scannedSubtasks: attachmentSubtasks.length,
      failedSubtasks: nestedAttachmentResults.filter((result) => result.failed).length
    }
  };
}

// Task templates of one of the app's projects, e.g. the campaign project's "W??" template that every email
// campaign card starts from.
async function getAsanaTaskTemplates(config, projectKind = "campaign") {
  const { kind, projectGid } = resolveAsanaProjectGid(config, projectKind);
  if (!projectGid) {
    const error = new Error(`The Asana ${kind} project is not configured.`);
    error.statusCode = 503;
    throw error;
  }
  const templates = await collectAsanaPages(config, "/task_templates", { project: projectGid, opt_fields: "gid,name" }, 3);
  return templates
    .map((template) => ({ gid: String(template?.gid || ""), name: String(template?.name || "") }))
    .filter((template) => template.gid);
}

// The third write: a card made from one of a project's own task templates, so it gets the template's description
// and subtasks exactly as when someone picks the template in Asana. Only a template that belongs to the named
// project of this app can be used, and the card lands in that project. Who the template's subtasks go to is the
// template's own design, not the caller's choice.
async function createAsanaTaskFromTemplate(config, { templateGid, name, dueOn, projectKind = "campaign" } = {}) {
  const normalizedTemplateGid = String(templateGid || "").trim();
  const taskName = String(name || "").trim();
  const due = validDueOn(dueOn);
  if (!/^\d+$/.test(normalizedTemplateGid)) {
    const error = new Error("A valid Asana task template GID is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!taskName || taskName.length > MAX_TASK_NAME_CHARS) {
    const error = new Error(`A task name needs between 1 and ${MAX_TASK_NAME_CHARS} characters.`);
    error.statusCode = 400;
    throw error;
  }
  if (due === null) {
    const error = new Error("dueOn must be a real date written YYYY-MM-DD.");
    error.statusCode = 400;
    throw error;
  }
  const { kind, projectGid } = resolveAsanaProjectGid(config, projectKind);
  if (!projectGid) {
    const error = new Error(`The Asana ${kind} project is not configured.`);
    error.statusCode = 503;
    throw error;
  }
  const template = await asanaGet(config, `/task_templates/${normalizedTemplateGid}`, { opt_fields: "gid,name,project.gid" });
  if (String(template?.project?.gid || "") !== projectGid) {
    const error = new Error(`The task template is not in the ${kind} project.`);
    error.statusCode = 403;
    throw error;
  }
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.asanaAccessToken}`
  };
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/task_templates/${normalizedTemplateGid}/instantiateTask?opt_fields=gid,status,new_task.gid,new_task.name`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: { name: taskName } })
  }, 20000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  let newTaskGid = String(payload?.data?.new_task?.gid || "");
  const jobGid = String(payload?.data?.gid || "");
  for (let attempt = 0; !newTaskGid && jobGid && attempt < 10; attempt += 1) {
    await wait(700);
    const job = await asanaGet(config, `/jobs/${jobGid}`, { opt_fields: "status,new_task.gid" });
    newTaskGid = String(job?.new_task?.gid || "");
    if (job?.status === "failed") break;
  }
  if (!newTaskGid) {
    const error = new Error("Asana did not report the new task from the template.");
    error.statusCode = 502;
    throw error;
  }
  const update = { name: taskName };
  if (due) update.due_on = due;
  const updated = await fetchWithTimeout(`${ASANA_API_BASE_URL}/tasks/${newTaskGid}?opt_fields=gid,name,due_on,permalink_url`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: update })
  }, 20000);
  const updatedPayload = await updated.json().catch(() => ({}));
  if (!updated.ok) {
    throw normalizeAsanaError(updatedPayload, updated.status);
  }
  return {
    gid: newTaskGid,
    name: String(updatedPayload?.data?.name || taskName),
    dueOn: String(updatedPayload?.data?.due_on || due || ""),
    permalinkUrl: String(updatedPayload?.data?.permalink_url || ""),
    templateGid: normalizedTemplateGid,
    templateName: String(template?.name || ""),
    projectGid
  };
}

// The order of the cards in one column (section) of one of the app's projects, earliest due date first and
// undated cards last in the order they had. Only open cards are read and moved; nothing about a card changes but
// its place. A card is moved only when it is not already right after the one before it, so a sorted column
// costs no writes. A board column is a section, so this is what "sort the board by date" means in Asana, whose
// own view sort is a per-view display setting that the API does not reach.
function sortTasksByDueDate(tasks = []) {
  const dueKey = (task) => String(task?.due_on || String(task?.due_at || "").slice(0, 10) || "");
  const dated = tasks.filter((task) => dueKey(task));
  const undated = tasks.filter((task) => !dueKey(task));
  const sorted = dated
    .map((task, index) => ({ task, index }))
    .sort((left, right) => dueKey(left.task).localeCompare(dueKey(right.task)) || left.index - right.index)
    .map((entry) => entry.task);
  return [...sorted, ...undated];
}

function planSectionMoves(currentGids = [], targetGids = []) {
  const order = [...currentGids];
  const moves = [];
  targetGids.forEach((gid, index) => {
    const at = order.indexOf(gid);
    if (index === 0) {
      if (at !== 0) {
        moves.push({ task: gid, insert_before: order[0] });
        order.splice(at, 1);
        order.unshift(gid);
      }
      return;
    }
    const previous = targetGids[index - 1];
    if (order.indexOf(previous) + 1 !== at) {
      moves.push({ task: gid, insert_after: previous });
      order.splice(at, 1);
      order.splice(order.indexOf(previous) + 1, 0, gid);
    }
  });
  return moves;
}

async function sortAsanaSectionByDueDate(config, { projectKind = "campaign", section } = {}) {
  const wanted = String(section || "").trim();
  if (!wanted) {
    const error = new Error("Name the section (board column) to sort, or give its GID.");
    error.statusCode = 400;
    throw error;
  }
  const { kind, projectGid } = resolveAsanaProjectGid(config, projectKind);
  if (!projectGid) {
    const error = new Error(`The Asana ${kind} project is not configured.`);
    error.statusCode = 503;
    throw error;
  }
  const sections = await collectAsanaPages(config, `/projects/${projectGid}/sections`, { opt_fields: "gid,name" }, 2);
  const match = sections.find((item) => String(item?.gid || "") === wanted)
    || sections.find((item) => String(item?.name || "").trim().toLowerCase() === wanted.toLowerCase());
  if (!match) {
    const error = new Error(`There is no section "${wanted}" in the ${kind} project.`);
    error.statusCode = 404;
    throw error;
  }
  const sectionGid = String(match.gid);
  const records = await collectAsanaPages(config, `/sections/${sectionGid}/tasks`, {
    completed_since: "now",
    opt_fields: "gid,name,due_on,due_at,completed"
  });
  const open = records.filter((task) => task?.gid && !task.completed);
  const target = sortTasksByDueDate(open);
  const moves = planSectionMoves(open.map((task) => String(task.gid)), target.map((task) => String(task.gid)));
  for (const move of moves) {
    const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}/sections/${sectionGid}/addTask`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.asanaAccessToken}`
      },
      body: JSON.stringify({ data: move })
    }, 20000);
    if (!response.ok) {
      throw normalizeAsanaError(await response.json().catch(() => ({})), response.status);
    }
  }
  return {
    section: { gid: sectionGid, name: String(match.name || "") },
    moved: moves.length,
    order: target.map((task) => ({
      gid: String(task.gid),
      name: String(task.name || ""),
      dueOn: String(task.due_on || String(task.due_at || "").slice(0, 10) || "")
    }))
  };
}

// The eighth write: a new project in one of the token owner's own teams, with board columns, cards and colleagues as
// members (asked for 2026-11-27: "opret en asana project hvor vi kan få alle ideer ind ... martin skal være en del af
// projektet"). It only ever writes inside a project the token owner owns. A project of the same name in that team
// owned by someone else is refused (409); one the owner already has is filled in, never duplicated, so a call that
// stopped part-way (Asana error, time budget) is simply sent again and continues - starting and continuing are the
// same request. Columns and cards are matched by name; nothing that exists is renamed, edited or deleted, except the
// empty "Untitled section" Asana may put in a new project. Members must be in the token's workspace.
const PROJECT_VIEWS = new Set(["board", "list", "calendar", "timeline"]);
const PROJECT_COLORS = new Set([
  "dark-pink", "dark-green", "dark-blue", "dark-red", "dark-teal", "dark-brown", "dark-orange", "dark-purple", "dark-warm-gray",
  "light-pink", "light-green", "light-blue", "light-red", "light-teal", "light-brown", "light-orange", "light-purple", "light-warm-gray"
]);
const MAX_PROJECT_NAME_CHARS = 200;
const MAX_SECTION_NAME_CHARS = 100;
const MAX_PROJECT_SECTIONS = 12;
const MAX_PROJECT_TASKS = 80;
const MAX_PROJECT_MEMBERS = 10;
const PROJECT_BUILD_BUDGET_MS = 200000;

async function asanaSend(config, method, resourcePath, data, query = "") {
  const response = await fetchWithTimeout(`${ASANA_API_BASE_URL}${resourcePath}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.asanaAccessToken}`
    },
    ...(data === undefined ? {} : { body: JSON.stringify({ data }) })
  }, 20000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeAsanaError(payload, response.status);
  }
  return payload?.data;
}

// Plain text with **bold** and @{userGid} mentions to Asana rich text. Only the given people may be mentioned.
function toAsanaHtmlWithMentions(text, allowedGids) {
  return toAsanaHtml(text).replace(/@\{(\d+)\}/g, (match, gid) => {
    if (!allowedGids.has(gid)) {
      const error = new Error(`@{${gid}} is not the owner or a member of this project, so it cannot be mentioned.`);
      error.statusCode = 400;
      throw error;
    }
    return `<a data-asana-gid="${gid}"/>`;
  });
}

function normalizeProjectOutline({ name, notes, team, members = [], view = "board", color = "", sections = [] } = {}) {
  const refuse = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
  const projectName = String(name || "").trim();
  const projectNotes = String(notes || "").trim();
  const teamRef = String(team || "").trim();
  const projectView = String(view || "board").trim().toLowerCase();
  const projectColor = String(color || "").trim().toLowerCase();
  if (!projectName || projectName.length > MAX_PROJECT_NAME_CHARS) refuse(`A project name needs between 1 and ${MAX_PROJECT_NAME_CHARS} characters.`);
  if (projectNotes.length > MAX_TASK_NOTES_CHARS) refuse(`Project notes can be at most ${MAX_TASK_NOTES_CHARS} characters.`);
  if (!teamRef) refuse("Name the team the project belongs to (its name or GID).");
  if (!PROJECT_VIEWS.has(projectView)) refuse(`view must be one of ${[...PROJECT_VIEWS].join(", ")}.`);
  if (projectColor && !PROJECT_COLORS.has(projectColor)) refuse(`color must be one of ${[...PROJECT_COLORS].join(", ")}.`);
  const memberGids = [...new Set((Array.isArray(members) ? members : []).map((gid) => String(gid || "").trim()).filter(Boolean))];
  if (memberGids.length > MAX_PROJECT_MEMBERS || memberGids.some((gid) => !/^\d+$/.test(gid))) refuse(`members must be up to ${MAX_PROJECT_MEMBERS} Asana user GIDs.`);
  if (!Array.isArray(sections) || !sections.length || sections.length > MAX_PROJECT_SECTIONS) refuse(`A project needs between 1 and ${MAX_PROJECT_SECTIONS} sections.`);
  const seenSections = new Set();
  let taskCount = 0;
  const outline = sections.map((section) => {
    const sectionName = String(section?.name || "").trim();
    if (!sectionName || sectionName.length > MAX_SECTION_NAME_CHARS) refuse(`A section name needs between 1 and ${MAX_SECTION_NAME_CHARS} characters.`);
    if (seenSections.has(sectionName.toLowerCase())) refuse(`The section "${sectionName}" is named twice.`);
    seenSections.add(sectionName.toLowerCase());
    const seenTasks = new Set();
    const tasks = (Array.isArray(section?.tasks) ? section.tasks : []).map((task) => {
      const taskName = String(task?.name || "").trim();
      const taskNotes = String(task?.notes || "").trim();
      if (!taskName || taskName.length > MAX_TASK_NAME_CHARS) refuse(`A task name needs between 1 and ${MAX_TASK_NAME_CHARS} characters.`);
      if (taskNotes.length > MAX_TASK_NOTES_CHARS) refuse(`Task notes can be at most ${MAX_TASK_NOTES_CHARS} characters.`);
      if (seenTasks.has(taskName.toLowerCase())) refuse(`The card "${taskName}" is named twice in "${sectionName}".`);
      seenTasks.add(taskName.toLowerCase());
      return { name: taskName, notes: taskNotes };
    });
    taskCount += tasks.length;
    return { name: sectionName, tasks };
  });
  if (taskCount > MAX_PROJECT_TASKS) refuse(`A project can be built with at most ${MAX_PROJECT_TASKS} cards at a time.`);
  return { name: projectName, notes: projectNotes, team: teamRef, members: memberGids, view: projectView, color: projectColor, sections: outline };
}

async function buildAsanaProject(config, input = {}, { now = Date.now, budgetMs = PROJECT_BUILD_BUDGET_MS } = {}) {
  const outline = normalizeProjectOutline(input);
  const started = now();
  const refuse = (message, statusCode) => { const error = new Error(message); error.statusCode = statusCode; throw error; };

  const profile = await getAsanaConnectionProfile(config);
  const workspaceGid = profile.workspaces?.[0]?.gid || "";
  if (!workspaceGid || !profile.gid) refuse("The Asana token has no workspace.", 503);
  const teams = await collectAsanaPages(config, `/users/${profile.gid}/teams`, { organization: workspaceGid, opt_fields: "gid,name" }, 2);
  const team = teams.find((item) => String(item?.gid || "") === outline.team)
    || teams.find((item) => String(item?.name || "").trim().toLowerCase() === outline.team.toLowerCase());
  if (!team) refuse(`"${outline.team}" is not one of ${profile.name || "the token owner"}'s teams. Teams: ${teams.map((item) => item.name).join(", ")}.`, 403);

  const people = {};
  for (const gid of outline.members.filter((gid) => gid !== profile.gid)) {
    const user = await asanaGet(config, `/users/${gid}`, { opt_fields: "gid,name,workspaces.gid" });
    if (!(user?.workspaces || []).some((workspace) => String(workspace?.gid || "") === workspaceGid)) {
      refuse(`User ${gid} is not a member of the ${profile.workspaces[0].name || "Asana"} workspace.`, 403);
    }
    people[gid] = String(user?.name || "");
  }
  const mentionable = new Set([profile.gid, ...Object.keys(people)]);
  const projectHtml = `<body>${toAsanaHtmlWithMentions(outline.notes, mentionable)}</body>`;
  const taskHtml = outline.sections.map((section) => section.tasks.map((task) => `<body>${toAsanaHtmlWithMentions(task.notes, mentionable)}</body>`));

  const sameName = (await collectAsanaPages(config, `/teams/${team.gid}/projects`, { archived: "false", opt_fields: "gid,name,owner.gid,permalink_url" }))
    .filter((item) => String(item?.name || "").trim().toLowerCase() === outline.name.toLowerCase());
  if (sameName.length > 1) refuse(`The team already has ${sameName.length} projects named "${outline.name}". Choose another name.`, 409);
  if (sameName.length && String(sameName[0]?.owner?.gid || "") !== profile.gid) {
    refuse(`The team already has a project named "${outline.name}" owned by someone else. Choose another name.`, 409);
  }
  let project = sameName[0] || null;
  const createdProject = !project;
  if (!project) {
    const data = { name: outline.name, workspace: workspaceGid, team: String(team.gid), default_view: outline.view, html_notes: projectHtml };
    if (outline.color) data.color = outline.color;
    project = await asanaSend(config, "POST", "/projects", data, "opt_fields=gid,name,permalink_url");
  }
  const projectGid = String(project?.gid || "");
  if (!projectGid) refuse("Asana did not return the new project.", 502);

  const memberships = await collectAsanaPages(config, "/memberships", { parent: projectGid, opt_fields: "member.gid" }, 2);
  const already = new Set(memberships.map((item) => String(item?.member?.gid || "")));
  const addedMembers = [];
  for (const gid of Object.keys(people)) {
    if (already.has(gid)) continue;
    await asanaSend(config, "POST", "/memberships", { parent: projectGid, member: gid, access_level: "editor" });
    addedMembers.push(people[gid]);
  }

  const existingSections = await collectAsanaPages(config, `/projects/${projectGid}/sections`, { opt_fields: "gid,name" }, 2);
  const sectionGids = [];
  const createdSections = [];
  for (const section of outline.sections) {
    let match = existingSections.find((item) => String(item?.name || "").trim().toLowerCase() === section.name.toLowerCase());
    if (!match) {
      match = await asanaSend(config, "POST", `/projects/${projectGid}/sections`, { name: section.name }, "opt_fields=gid,name");
      createdSections.push(section.name);
    }
    sectionGids.push(String(match.gid));
  }

  const existingTasks = await collectAsanaPages(config, `/projects/${projectGid}/tasks`, { opt_fields: "gid,name,memberships.project.gid,memberships.section.gid" });
  const sectionOf = (task) => String((task?.memberships || []).find((item) => String(item?.project?.gid || "") === projectGid)?.section?.gid || "");
  const found = new Map(existingTasks.map((task) => [`${sectionOf(task)}\n${String(task?.name || "").trim().toLowerCase()}`, String(task.gid)]));
  let createdTasks = 0;
  let remaining = 0;
  for (const [sectionIndex, section] of outline.sections.entries()) {
    for (const [taskIndex, task] of section.tasks.entries()) {
      const key = `${sectionGids[sectionIndex]}\n${task.name.toLowerCase()}`;
      if (found.has(key)) continue;
      if (now() - started > budgetMs) {
        remaining += 1;
        continue;
      }
      const created = await asanaSend(config, "POST", "/tasks", {
        name: task.name,
        html_notes: taskHtml[sectionIndex][taskIndex],
        memberships: [{ project: projectGid, section: sectionGids[sectionIndex] }]
      }, "opt_fields=gid");
      found.set(key, String(created?.gid || ""));
      createdTasks += 1;
    }
  }

  // Cards in the outline's order, the column's other cards after them in their own order. Only when this call
  // finished adding cards (a build that stopped part-way may have filled a column in an earlier call), and never
  // when it added none, so a board someone has since rearranged by hand is left alone by a repeat call.
  let moved = 0;
  if (!remaining && createdTasks) {
    for (const sectionIndex of outline.sections.keys()) {
      if (!outline.sections[sectionIndex].tasks.length) continue;
      const sectionGid = sectionGids[sectionIndex];
      const current = (await collectAsanaPages(config, `/sections/${sectionGid}/tasks`, { opt_fields: "gid" })).map((task) => String(task.gid));
      const wanted = outline.sections[sectionIndex].tasks.map((task) => found.get(`${sectionGid}\n${task.name.toLowerCase()}`)).filter((gid) => current.includes(gid));
      const target = [...wanted, ...current.filter((gid) => !wanted.includes(gid))];
      for (const move of planSectionMoves(current, target)) {
        await asanaSend(config, "POST", `/sections/${sectionGid}/addTask`, move);
        moved += 1;
      }
    }
  }

  // A new project may come with an empty "Untitled section"; it goes once the outline's columns exist.
  const removedSections = [];
  if (createdProject) {
    for (const section of existingSections) {
      const sectionName = String(section?.name || "").trim();
      if (sectionName.toLowerCase() !== "untitled section" || outline.sections.some((item) => item.name.toLowerCase() === "untitled section")) continue;
      if (existingTasks.some((task) => sectionOf(task) === String(section.gid))) continue;
      try {
        await asanaSend(config, "DELETE", `/sections/${section.gid}`);
        removedSections.push(sectionName);
      } catch {
        // Not worth failing the build over: the column is empty and can be deleted by hand.
      }
    }
  }

  return {
    project: {
      gid: projectGid,
      name: String(project?.name || outline.name),
      permalinkUrl: String(project?.permalink_url || ""),
      created: createdProject
    },
    team: { gid: String(team.gid), name: String(team.name || "") },
    members: { added: addedMembers, all: Object.values(people) },
    sections: { created: createdSections, removed: removedSections, order: outline.sections.map((section) => section.name) },
    tasks: { created: createdTasks, existing: outline.sections.reduce((sum, section) => sum + section.tasks.length, 0) - createdTasks - remaining, remaining, moved },
    done: remaining === 0
  };
}

module.exports = {
  addAsanaTaskComment,
  buildAsanaProject,
  normalizeProjectOutline,
  asanaGet,
  collectAsanaPages,
  attachFileToAsanaTask,
  createAsanaContentRequest,
  createAsanaTask,
  updateAsanaTask,
  findAsanaUsers,
  toAsanaHtml,
  createAsanaTaskFromTemplate,
  planSectionMoves,
  sortAsanaSectionByDueDate,
  sortTasksByDueDate,
  getAsanaTaskTemplates,
  getAsanaConnectionProfile,
  getAsanaProjectTasks,
  getAsanaTaskComments,
  getAsanaTaskSubtasks,
  getAsanaTaskBundle,
  getAsanaWorkspaceProjects,
  resolveAsanaProjectGid
};
