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
  asanaGet,
  getAsanaConnectionProfile,
  getAsanaProjectTasks,
  getAsanaTaskSubtasks,
  getAsanaTaskBundle,
  getAsanaWorkspaceProjects
};
