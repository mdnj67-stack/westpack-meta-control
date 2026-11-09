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
  creatives: "asanaCreativesProjectGid"
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

module.exports = {
  addAsanaTaskComment,
  asanaGet,
  createAsanaTask,
  getAsanaConnectionProfile,
  getAsanaProjectTasks,
  getAsanaTaskComments,
  getAsanaTaskSubtasks,
  getAsanaTaskBundle,
  getAsanaWorkspaceProjects,
  resolveAsanaProjectGid
};
