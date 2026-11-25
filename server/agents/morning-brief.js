// The morning brief: every weekday morning, what needs the user today - read from Asana, Klaviyo, Meta, the
// watchdog, the customer survey, and (from the user's own computer) the calendar and the mail - written as a short
// to-do list by the strong model, and put into the user's Asana My Tasks.
//
// Asked for on 2026-11-24 ("en agent der ... scanner min kalender, min asana, min mail alt hvad der nu findes, måske
// også ting som er lidt urgent i systemet ... kører om natten og som så er klar når jeg møder kl 8") and built on
// 2026-11-25 ("Du skal bygge den agent som scanner det hele og opsnapper"), after the same thing had been done by hand
// once and the user liked the result.
//
// It is the one agent that writes, and it writes in one place only: a to-do in the token owner's own My Tasks
// (createAsanaTask can assign to no one else). It never changes Meta, Klaviyo, the stores or a colleague's task.
//
// How a day runs (all times Copenhagen, weekdays):
//   - From 06:00 the cron tick collects the cloud sources once ("collected").
//   - The brief is written when the computer has sent the calendar and mail, or at 07:40 without them, whichever
//     comes first ("writing", an OpenAI background job; ticks poll it).
//   - When the job finishes, the to-dos are checked against the sources and created in Asana ("done").
//   - If the calendar and mail arrive after a brief written without them, the brief is written again with them; the
//     ledger keeps the to-dos it already made from being made twice.
//
// Every to-do must rest on signals the sources produced (`sourceIds`); one that cites nothing real is dropped, so the
// model can arrange and word, but not invent. Links come from the signals, never from the model.

const crypto = require("crypto");

const BRIEF_VERSION = 1;
const TIME_ZONE = "Europe/Copenhagen";
const ACCOUNT_TIME_ZONE = "America/Los_Angeles";
const COLLECT_FROM_MINUTES = 6 * 60; // 06:00
const WRITE_WITHOUT_LOCAL_FROM_MINUTES = 7 * 60 + 40; // 07:40
const MAX_TODOS = 8;
const LEDGER_DAYS = 30;
const LOG_LIMIT = 40;
const STUCK_WRITING_MS = 25 * 60 * 1000;
const CLAIM_MS = 4 * 60 * 1000;
const MAX_WRITE_ATTEMPTS = 2;

// ---------------------------------------------------------------------------------------------
// Time

function zonedParts(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday] || 0;
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour, minute, minutes: hour * 60 + minute, weekday };
}

function copenhagen(now = new Date()) {
  return zonedParts(now, TIME_ZONE);
}

function addDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(day) {
  const index = new Date(`${day}T12:00:00Z`).getUTCDay();
  return index === 0 ? 7 : index;
}

// The working day `count` working days after `day` (0 = `day` itself, moved off a weekend).
function workdayAfter(day, count = 0) {
  let current = day;
  while (weekdayOf(current) > 5) current = addDays(current, 1);
  for (let step = 0; step < count; step += 1) {
    current = addDays(current, 1);
    while (weekdayOf(current) > 5) current = addDays(current, 1);
  }
  return current;
}

function accountDay(now = new Date(), offset = 0) {
  return addDays(zonedParts(now, ACCOUNT_TIME_ZONE).day, offset);
}

const DANISH_WEEKDAYS = ["", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];

function danishDate(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return String(day || "");
  return `${Number(day.slice(8, 10))}/${Number(day.slice(5, 7))}`;
}

function relativeDay(day, today) {
  if (!day) return "";
  if (day === today) return "i dag";
  if (day === addDays(today, 1)) return "i morgen";
  if (day === addDays(today, -1)) return "i går";
  const weekday = DANISH_WEEKDAYS[weekdayOf(day)];
  return `${weekday} ${danishDate(day)}`;
}

function hash(...parts) {
  return crypto.createHash("sha1").update(parts.map((part) => String(part ?? "")).join("\n")).digest("hex").slice(0, 12);
}

function clip(text, max) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function kr(value) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString("da-DK")} kr.` : "–";
}

function decimal(value, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString("da-DK", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "–";
}

function signal(fields) {
  return {
    id: String(fields.id),
    source: fields.source,
    level: fields.level || "info",
    title: clip(fields.title, 200),
    detail: clip(fields.detail || "", 900),
    link: String(fields.link || ""),
    due: String(fields.due || ""),
    fingerprint: String(fields.fingerprint ?? ""),
    inAsana: Boolean(fields.inAsana)
  };
}

// ---------------------------------------------------------------------------------------------
// Asana

const CARD_WINDOW_BEFORE = 7;
const CARD_WINDOW_AFTER = 2;
const MAX_CARDS = 8;
const MAX_COMMENT_TASKS = 40;
const UNASSIGNED_HORIZON = 5;

function dueOf(task) {
  return String(task?.due_on || String(task?.due_at || "").slice(0, 10) || "");
}

function sectionOf(task) {
  return (task?.memberships || []).map((membership) => membership?.section?.name).filter(Boolean)[0] || "";
}

async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// asana: { get(path, query) -> data, pages(path, query, maxPages) -> rows }
// projects: { campaign, production, creatives, content } project gids
async function collectAsana({ asana, projects = {}, today, since }) {
  const signals = [];
  const notes = [];
  const me = await asana.get("/users/me", { opt_fields: "gid,name,workspaces.gid,workspaces.name" });
  const meGid = String(me?.gid || "");
  const workspace = String(me?.workspaces?.[0]?.gid || "");
  if (!meGid || !workspace) throw new Error("The Asana token has no user or workspace.");

  // 1. The user's own open tasks that are due today or overdue. They are already in Asana; the brief lists them and
  //    never makes them again.
  const mine = await asana.pages("/tasks", {
    assignee: "me",
    workspace,
    completed_since: "now",
    opt_fields: "gid,name,due_on,due_at,permalink_url,completed,projects.name"
  }, 4);
  const openMine = mine.filter((task) => task?.gid && !task.completed);
  for (const task of openMine) {
    const due = dueOf(task);
    if (!due || due > today) continue;
    signals.push(signal({
      id: `asana-mine:${task.gid}`,
      source: "asana",
      level: due < today ? "warn" : "info",
      title: task.name,
      detail: due < today ? `I din Asana, frist ${relativeDay(due, today)} (overskredet).` : "I din Asana med frist i dag.",
      link: task.permalink_url,
      due,
      fingerprint: due,
      inAsana: true
    }));
  }

  // 2. Campaign cards with a deadline from a week ago to two days ahead, with their open subtasks.
  const cards = [];
  if (projects.campaign) {
    const rows = await asana.pages(`/projects/${projects.campaign}/tasks`, {
      completed_since: "now",
      opt_fields: "gid,name,due_on,due_at,completed,permalink_url,memberships.section.name,assignee.name"
    }, 5);
    const near = rows
      .filter((task) => task?.gid && !task.completed && dueOf(task) && dueOf(task) >= addDays(today, -CARD_WINDOW_BEFORE) && dueOf(task) <= addDays(today, CARD_WINDOW_AFTER))
      .sort((left, right) => dueOf(left).localeCompare(dueOf(right)))
      .slice(0, MAX_CARDS);
    const subtasks = await pool(near, 4, (task) => asana.pages(`/tasks/${task.gid}/subtasks`, { opt_fields: "gid,name,completed,assignee.name,due_on" }, 1).catch(() => null));
    near.forEach((task, index) => {
      const subs = subtasks[index];
      const open = Array.isArray(subs) ? subs.filter((sub) => sub?.gid && !sub.completed) : null;
      cards.push({
        gid: String(task.gid),
        name: String(task.name || ""),
        due: dueOf(task),
        section: sectionOf(task),
        link: String(task.permalink_url || ""),
        openSubtasks: open ? open.map((sub) => `${sub.name}${sub.assignee?.name ? ` (${String(sub.assignee.name).split(" ")[0]})` : ""}`) : null
      });
    });
  }

  // 3. Comments since the last brief that mention the user, or that someone else left on the user's own task.
  const commentProjects = [projects.campaign, projects.production, projects.creatives, projects.content].filter(Boolean);
  const touched = new Map();
  for (const projectGid of commentProjects) {
    const rows = await asana.pages("/tasks", {
      project: projectGid,
      modified_since: since,
      opt_fields: "gid,name,permalink_url,completed,assignee.gid"
    }, 2).catch(() => []);
    for (const task of rows) if (task?.gid && !touched.has(String(task.gid))) touched.set(String(task.gid), task);
  }
  const commentTasks = [...touched.values()].slice(0, MAX_COMMENT_TASKS);
  if (touched.size > MAX_COMMENT_TASKS) notes.push(`Kommentarer læst på ${MAX_COMMENT_TASKS} af ${touched.size} ændrede opgaver.`);
  const stories = await pool(commentTasks, 5, (task) => asana.pages(`/tasks/${task.gid}/stories`, { opt_fields: "gid,type,text,html_text,created_at,created_by.gid,created_by.name" }, 2).catch(() => []));
  commentTasks.forEach((task, index) => {
    const mineTask = String(task.assignee?.gid || "") === meGid;
    for (const story of stories[index] || []) {
      if (story?.type !== "comment" || String(story.created_at || "") < since) continue;
      if (String(story.created_by?.gid || "") === meGid) continue;
      const mentioned = String(story.html_text || "").includes(`data-asana-gid="${meGid}"`);
      if (!mentioned && !mineTask) continue;
      const author = String(story.created_by?.name || "En kollega");
      signals.push(signal({
        id: `asana-comment:${story.gid}`,
        source: "asana",
        level: "warn",
        title: `${author} ${mentioned ? "nævnte dig" : "skrev på din opgave"} på "${task.name}"`,
        detail: clip(story.text, 500),
        link: task.permalink_url,
        fingerprint: story.gid
      }));
    }
  });

  // 4. Content requests due within five days that nobody is assigned to, and the content team's overdue ones.
  if (projects.production) {
    const rows = await asana.pages(`/projects/${projects.production}/tasks`, {
      completed_since: "now",
      opt_fields: "gid,name,due_on,due_at,completed,permalink_url,memberships.section.name,assignee.name"
    }, 4).catch(() => []);
    for (const task of rows) {
      const due = dueOf(task);
      if (!task?.gid || task.completed || !due) continue;
      if (!task.assignee && due <= addDays(today, UNASSIGNED_HORIZON)) {
        signals.push(signal({
          id: `asana-unassigned:${task.gid}`,
          source: "asana",
          level: due <= addDays(today, 1) ? "warn" : "info",
          title: `Content-bestilling uden ansvarlig: ${task.name}`,
          detail: `Frist ${relativeDay(due, today)}. Kolonne: ${sectionOf(task) || "ukendt"}.`,
          link: task.permalink_url,
          due,
          fingerprint: `${due}|unassigned`
        }));
      } else if (task.assignee && due < today && due >= addDays(today, -10)) {
        signals.push(signal({
          id: `asana-late:${task.gid}`,
          source: "asana",
          level: "info",
          title: `Content-opgave over frist: ${task.name}`,
          detail: `${String(task.assignee.name || "")}, frist ${relativeDay(due, today)}. Kolonne: ${sectionOf(task) || "ukendt"}.`,
          link: task.permalink_url,
          due,
          fingerprint: `${due}|late`
        }));
      }
    }
  }

  // 5. Creatives that reached Review or Done since the last brief: those may be used in ads.
  if (projects.creatives) {
    const rows = await asana.pages("/tasks", {
      project: projects.creatives,
      modified_since: since,
      opt_fields: "gid,name,completed,permalink_url,memberships.section.name"
    }, 2).catch(() => []);
    const ready = rows.filter((task) => /^(review|done)$/i.test(String(sectionOf(task)).trim()));
    if (ready.length) {
      const names = ready.map((task) => `${task.name} (${sectionOf(task)})`);
      signals.push(signal({
        id: `asana-creatives:${hash(...ready.map((task) => task.gid).sort())}`,
        source: "asana",
        level: "info",
        title: `${ready.length} creative${ready.length === 1 ? "" : "s"} i Review eller Done i Meta Creatives siden sidst`,
        detail: names.slice(0, 8).join("; ") + (names.length > 8 ? "; ..." : ""),
        link: ready[0].permalink_url,
        fingerprint: ready.map((task) => task.gid).sort().join(",")
      }));
    }
  }

  return {
    me: { gid: meGid, name: String(me?.name || ""), workspace },
    cards,
    signals,
    openMine: openMine.map((task) => ({ gid: String(task.gid), name: String(task.name || ""), due: dueOf(task), link: String(task.permalink_url || "") })),
    summary: `${openMine.length} åbne opgaver til dig, ${cards.length} kampagnekort med deadline omkring nu, ${signals.filter((item) => item.id.startsWith("asana-comment:")).length} kommentarer til dig.`,
    notes
  };
}

// ---------------------------------------------------------------------------------------------
// Klaviyo

const WEEK_TOKEN = /\bW\s?(\d{1,2})\b/i;
const STOP_WORDS = new Set(["kampagne", "campaign", "email", "mail", "copy", "test", "draft", "fra", "til", "med", "the", "and", "for"]);

function significantWords(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/\bw\s?\d{1,2}\b/gi, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

// Which DK campaign in Klaviyo belongs to an Asana campaign card: the same week number and at least half of the card's
// words, or, without a week number on the card, two shared words and half. Half, because one shared word is not enough:
// on 25/11 "W48: World Record Friday" matched "W48: Pre Black Friday" on "friday" alone, and the brief then read the
// World Record Friday mail as already sent.
function matchCardToCampaigns(card, campaigns = []) {
  const week = String(card?.name || "").match(WEEK_TOKEN)?.[1] || "";
  const words = new Set(significantWords(card?.name));
  let best = null;
  for (const campaign of campaigns) {
    if (campaign.archived) continue;
    const campaignWeek = String(campaign.name || "").match(WEEK_TOKEN)?.[1] || "";
    const shared = new Set(significantWords(campaign.name).filter((word) => words.has(word))).size;
    const enough = words.size > 0 && shared / words.size >= 0.5;
    const qualifies = week ? campaignWeek === week && shared >= 1 && enough : shared >= 2 && enough;
    if (!qualifies) continue;
    if (!best || shared > best.shared) best = { campaign, shared };
  }
  return best?.campaign || null;
}

const STATUS_DA = {
  Draft: "kladde",
  Scheduled: "planlagt",
  Sending: "sendes nu",
  Sent: "sendt",
  Cancelled: "annulleret",
  Canceled: "annulleret"
};

function describeCampaign(campaign, now) {
  const status = STATUS_DA[campaign.status] || String(campaign.status || "").toLowerCase();
  const when = campaign.sendTime || campaign.scheduledAt;
  if (!when) return `"${campaign.name}" (${status})`;
  const time = new Intl.DateTimeFormat("da-DK", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(when));
  return `"${campaign.name}" (${status}, ${time})`;
}

function cardSignals({ cards = [], campaigns = null, today, now }) {
  return cards.map((card) => {
    const match = Array.isArray(campaigns) ? matchCardToCampaigns(card, campaigns) : null;
    const klaviyo = !Array.isArray(campaigns)
      ? "Klaviyo DK kunne ikke læses."
      : match
        ? `Klaviyo DK: ${describeCampaign(match, now)}.`
        : "Klaviyo DK: ingen kampagne fundet med samme ugenummer og navn.";
    const subs = card.openSubtasks === null
      ? "Underopgaverne kunne ikke læses."
      : card.openSubtasks.length
        ? `Åbne underopgaver: ${card.openSubtasks.join(", ")}.`
        : "Alle underopgaver er lukket.";
    const late = card.due < today;
    return signal({
      id: `asana-card:${card.gid}`,
      source: "asana",
      level: late || (card.due <= addDays(today, 1) && (!match || match.status === "Draft")) ? "warn" : "info",
      title: `Kampagnekort: ${card.name}`,
      detail: `Deadline ${relativeDay(card.due, today)}${late ? " (overskredet)" : ""}. Kolonne: ${card.section || "ukendt"}. ${subs} ${klaviyo}`,
      link: card.link,
      due: card.due,
      fingerprint: [card.due, card.section, (card.openSubtasks || []).join(","), match ? `${match.id}:${match.status}` : "none"].join("|")
    });
  });
}

// klaviyo: { campaigns() -> [{ id, name, status, archived, scheduledAt, sendTime }] }
async function collectKlaviyoCampaigns({ klaviyo }) {
  const campaigns = await klaviyo.campaigns();
  return campaigns;
}

function scheduledTodaySignals({ campaigns = [], today, now }) {
  return campaigns
    .filter((campaign) => !campaign.archived && campaign.status === "Scheduled" && (campaign.scheduledAt || campaign.sendTime))
    .filter((campaign) => copenhagen(new Date(campaign.sendTime || campaign.scheduledAt)).day === today)
    .map((campaign) => signal({
      id: `klaviyo-scheduled:${campaign.id}`,
      source: "klaviyo",
      level: "info",
      title: `Planlagt i Klaviyo DK i dag: ${campaign.name}`,
      detail: describeCampaign(campaign, now),
      fingerprint: `${campaign.status}|${campaign.sendTime || campaign.scheduledAt}`
    }));
}

// Sends since the last brief, read from the subject line history (synced nightly at 04:50 UTC). Indexes are against
// the market's own typical send in the weeks around it (1.00 = typical), never raw rates: Apple Mail inflates opens.
// An A/B test is one row per arm; a campaign is one signal, described by its largest arm, with every arm's recipients.
// Figures read less than a day after the send are early (the history syncs at 04:50 UTC), and the signal says so.
function sendSignals({ entries = [], otherMarkets = {}, since, today, syncedAt = "" }) {
  const campaigns = new Map();
  for (const entry of entries) {
    if (!entry.sentAt || entry.sentAt < since || !entry.campaignId) continue;
    const current = campaigns.get(entry.campaignId);
    const received = Number(entry.received || 0);
    if (!current) {
      campaigns.set(entry.campaignId, { ...entry, received, largest: received });
      continue;
    }
    current.received += received;
    if (received > current.largest) Object.assign(current, { ...entry, received: current.received, largest: received });
  }
  return [...campaigns.values()]
    .map((entry) => {
      const parts = [`Sendt ${relativeDay(copenhagen(new Date(entry.sentAt)).day, today)} til ${Number(entry.received || 0).toLocaleString("da-DK")} i DK.`];
      if (Number.isFinite(entry.openIndex)) parts.push(`Åbningsindeks ${decimal(entry.openIndex)}, klikindeks ${decimal(entry.clickIndex)} (1,00 = typisk for DK).`);
      else parts.push("For få modtagere eller for tidligt til et indeks.");
      const others = otherMarkets[entry.campaignId] || 0;
      if (others) parts.push(`Samme kampagne sendt i ${others} andre markeder.`);
      const measuredAfter = (Date.parse(syncedAt) - Date.parse(entry.sentAt)) / 3600000;
      if (Number.isFinite(measuredAfter) && measuredAfter < 24) parts.push(`Tidlige tal: målt ${Math.max(0, Math.round(measuredAfter))} timer efter afsendelse, så modtagere og indeks kan flytte sig.`);
      const weak = Number.isFinite(entry.clickIndex) && entry.clickIndex < 0.7;
      return signal({
        id: `klaviyo-sent:${entry.campaignId}`,
        source: "klaviyo",
        level: weak ? "warn" : "info",
        title: `Udsendt: ${entry.campaignName || entry.subject}`,
        detail: `Emnelinje: "${clip(entry.subject, 120)}". ${parts.join(" ")}`,
        fingerprint: `${entry.campaignId}|${entry.received}`
      });
    });
}

// ---------------------------------------------------------------------------------------------
// Meta

const LIVE_AD = new Set(["ACTIVE", "PENDING_REVIEW", "IN_PROCESS", "WITH_ISSUES", "PREAPPROVED"]);

// The same rules as the Monday status report (scripts/meta-ad-status.js), so the brief and the report never judge
// one ad two ways: at least two of CTR -20 %, CPM +15 %, frequency >= 4 a week (or +30 % to >= 3), and Meta moving
// budget away two weeks running - and for a conversion ad at most one new customer in two weeks. Awareness: under 5 %
// of its ad set's spend after under 10 % the week before means Meta has given up on it. Signals, not verdicts.
function judgeAdFatigue(weeks = [], { awareness = false } = {}) {
  const [w1, w2, w3] = weeks;
  if (!w3) return { verdict: "no_delivery", signals: [] };
  const signals = [];
  if (w1 && w2 && w3.ctr < w1.ctr * 0.8 && w3.ctr <= w2.ctr) signals.push("CTR falder");
  if (w1 && w3.cpm > w1.cpm * 1.15) signals.push("CPM stiger");
  if (w3.freq >= 4 || (w1 && w3.freq > w1.freq * 1.3 && w3.freq >= 3)) signals.push("høj/stigende frekvens");
  if (w1 && w2 && w3.share < w2.share && w2.share < w1.share && w3.share < w1.share * 0.8) signals.push("Meta flytter budgettet væk");
  if (awareness) {
    if (w3.share < 5 && (!w2 || w2.share < 10)) return { verdict: "abandoned", signals };
    if (signals.length >= 2) return { verdict: "tired", signals };
    return { verdict: signals.length ? "watch" : "ok", signals };
  }
  const recent = (w2 ? w2.nc : 0) + w3.nc;
  if (signals.length >= 2 && recent <= 1) return { verdict: "swap_now", signals };
  if (signals.length >= 2) return { verdict: "tired_delivering", signals };
  return { verdict: signals.length ? "watch" : "ok", signals };
}

const FATIGUE_WORDS = {
  swap_now: "Skift nu",
  tired_delivering: "Træt, men leverer - skift snart",
  tired: "Træt - skift snart",
  abandoned: "Opgivet af Meta - kan slukkes"
};

function sumAction(list, types) {
  return (list || []).filter((action) => types.includes(action.action_type)).reduce((sum, action) => sum + Number(action.incrementality ?? action.value ?? 0), 0);
}

// graph(path, params) -> payload; pages(path, params) -> rows. Four calls, never retried.
async function collectMeta({ graph, pages, accountId, now, resolveObjectiveGroup }) {
  const signals = [];
  const yesterday = accountDay(now, -1);
  const blocks = [2, 1, 0].map((back) => ({ since: addDays(yesterday, -7 * back - 6), until: addDays(yesterday, -7 * back) }));

  const conversions = await graph(`/${accountId}/customconversions`, { fields: "id,name,is_archived", limit: 100 });
  const ncTypes = (conversions?.data || [])
    .filter((conversion) => !conversion.is_archived && String(conversion.name).toLowerCase().replace(/[^a-z]/g, "") === "newcustomer")
    .map((conversion) => `offsite_conversion.custom.${conversion.id}`);

  // Spend on the last finished account day against the seven before it.
  const daily = await graph(`/${accountId}/insights`, {
    fields: "spend",
    time_increment: 1,
    time_range: JSON.stringify({ since: addDays(yesterday, -7), until: yesterday })
  });
  const byDay = new Map((daily?.data || []).map((row) => [row.date_start, Number(row.spend || 0)]));
  const lastSpend = byDay.get(yesterday) ?? 0;
  const before = Array.from({ length: 7 }, (_, index) => byDay.get(addDays(yesterday, -1 - index)) ?? 0);
  const average = before.reduce((sum, value) => sum + value, 0) / 7;
  const ratio = average > 0 ? lastSpend / average : NaN;
  signals.push(signal({
    id: `meta-spend:${yesterday}`,
    source: "meta",
    level: Number.isFinite(ratio) && ratio < 0.6 ? "alert" : "info",
    title: `Meta-forbrug ${danishDate(yesterday)} (kontoens dag): ${kr(lastSpend)}`,
    detail: `Snit de syv dage før: ${kr(average)}${Number.isFinite(ratio) ? ` (${Math.round(ratio * 100)} %)` : ""}.${Number.isFinite(ratio) && ratio < 0.6 ? " Langt under det normale - kontoen kan have stået stille." : ""}`,
    fingerprint: Number.isFinite(ratio) ? (ratio < 0.6 ? "low" : "normal") : "none"
  }));

  const ads = await pages(`/${accountId}/ads`, {
    fields: "name,status,effective_status,campaign{id,name,objective},adset{id,name,effective_status}",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "WITH_ISSUES", "PENDING_REVIEW", "IN_PROCESS"] }]),
    limit: 200
  });
  const adById = new Map(ads.map((ad) => [String(ad.id), ad]));
  const weekly = await pages(`/${accountId}/insights`, {
    level: "ad",
    time_increment: 7,
    time_range: JSON.stringify({ since: blocks[0].since, until: yesterday }),
    filtering: JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: ["ACTIVE", "WITH_ISSUES", "PENDING_REVIEW", "IN_PROCESS"] }]),
    fields: "campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,frequency,cpm,inline_link_click_ctr,actions",
    action_attribution_windows: JSON.stringify(["incrementality"]),
    limit: 500
  });

  const byAd = new Map();
  const setSpend = new Map();
  for (const row of weekly) {
    const week = blocks.findIndex((block) => block.since === row.date_start);
    if (week < 0) continue;
    const entry = byAd.get(row.ad_id) || { name: row.ad_name, adset: row.adset_name, adsetId: row.adset_id, campaign: row.campaign_name, rows: [null, null, null] };
    entry.rows[week] = row;
    byAd.set(row.ad_id, entry);
    setSpend.set(`${row.adset_id}|${week}`, (setSpend.get(`${row.adset_id}|${week}`) || 0) + Number(row.spend || 0));
  }

  let watch = 0;
  for (const [adId, entry] of byAd) {
    const ad = adById.get(String(adId));
    if (!ad || ad.status !== "ACTIVE" || !LIVE_AD.has(ad.effective_status) || ad.adset?.effective_status !== "ACTIVE") continue;
    const weeks = entry.rows.map((row, week) => (row ? {
      share: (setSpend.get(`${entry.adsetId}|${week}`) || 0) > 0 ? (Number(row.spend || 0) / setSpend.get(`${entry.adsetId}|${week}`)) * 100 : 0,
      ctr: Number(row.inline_link_click_ctr || 0),
      cpm: Number(row.cpm || 0),
      freq: Number(row.frequency || 0),
      nc: sumAction(row.actions, ncTypes),
      spend: Number(row.spend || 0)
    } : null));
    const awareness = resolveObjectiveGroup ? resolveObjectiveGroup(ad.campaign || {}) === "awareness" : false;
    const judged = judgeAdFatigue(weeks, { awareness });
    if (judged.verdict === "watch") watch += 1;
    if (!FATIGUE_WORDS[judged.verdict]) continue;
    const last = weeks[2];
    signals.push(signal({
      id: `meta-fatigue:${adId}`,
      source: "meta",
      level: judged.verdict === "swap_now" || judged.verdict === "abandoned" ? "warn" : "info",
      title: `${FATIGUE_WORDS[judged.verdict]}: ${entry.name}`,
      detail: `${entry.campaign} > ${entry.adset}. Tegn: ${judged.signals.join(", ") || "ingen"}. Sidste uge: ${Math.round(last.share)} % af ad settets forbrug, CTR ${decimal(last.ctr)} %, frekvens ${decimal(last.freq, 1)}${awareness ? "" : `, nye kunder (inkrementelt) to uger: ${decimal((weeks[1]?.nc || 0) + last.nc, 1)}`}. Signal, ikke dom.`,
      fingerprint: judged.verdict
    }));
  }
  if (watch) {
    signals.push(signal({
      id: `meta-watch:${yesterday}`,
      source: "meta",
      level: "info",
      title: `${watch} annoncer med ét træthedstegn (hold øje)`,
      detail: "Ét tegn alene er ikke nok til at skifte efter reglerne.",
      fingerprint: String(watch)
    }));
  }
  return { signals, summary: `Forbrug ${danishDate(yesterday)} ${kr(lastSpend)}; ${byAd.size} aktive annoncer vurderet for træthed.` };
}

// ---------------------------------------------------------------------------------------------
// The watchdog and the survey

function watchdogSignals(snapshot) {
  const signals = [];
  for (const check of Object.values(snapshot?.checks || {})) {
    if (!check.items?.length) {
      if (["alert", "warn"].includes(check.status)) {
        signals.push(signal({ id: `watchdog:${check.id}`, source: "watchdog", level: check.status, title: `${check.title}: ${check.summary}`, detail: check.detail, fingerprint: `${check.status}|${check.summary}` }));
      }
      continue;
    }
    for (const item of check.items) {
      if (item.muted || !["alert", "warn"].includes(item.status)) continue;
      signals.push(signal({
        id: `watchdog:${check.id}:${item.key}`,
        source: "watchdog",
        level: item.status,
        title: `${check.title}: ${item.title}`,
        detail: item.detail,
        fingerprint: item.fingerprint
      }));
    }
  }
  return signals;
}

function surveySignals({ answers = [], since, today }) {
  const fresh = answers.filter((answer) => !answer.test && String(answer.at || "") >= since);
  if (!fresh.length) return [];
  const snippets = fresh.slice(0, 5).map((answer) => `"${clip(answer.followup || answer.reason || "", 220)}"${answer.recipient?.marked ? ` (${answer.recipient.marked})` : ""}`);
  return [signal({
    id: `survey:${today}`,
    source: "survey",
    level: "info",
    title: `${fresh.length} nye svar på spørgeskemaet til stoppede kunder`,
    detail: snippets.join(" · "),
    fingerprint: String(fresh.length)
  })];
}

// ---------------------------------------------------------------------------------------------
// Calendar and mail, from the user's computer (scripts/morning-brief-local.ps1)

const MAX_EVENTS = 30;
const MAX_MAILS = 40;

function sanitizeLocal(input = {}, now = new Date()) {
  const events = (Array.isArray(input.calendar) ? input.calendar : []).slice(0, MAX_EVENTS).map((event) => ({
    id: `cal:${hash(event.id || "", event.start || "", event.subject || "")}`,
    start: String(event.start || "").slice(0, 25),
    end: String(event.end || "").slice(0, 25),
    allDay: Boolean(event.allDay),
    subject: clip(event.subject || "(uden emne)", 160),
    location: clip(event.location || "", 120),
    organizer: clip(event.organizer || "", 80),
    organizedByMe: Boolean(event.organizedByMe),
    response: clip(event.response || "", 30)
  })).filter((event) => event.start);
  const mails = (Array.isArray(input.mail) ? input.mail : []).slice(0, MAX_MAILS).map((mail) => ({
    id: `mail:${hash(mail.id || "", mail.received || "", mail.subject || "")}`,
    received: String(mail.received || "").slice(0, 25),
    from: clip(mail.from || "", 100),
    subject: clip(mail.subject || "(uden emne)", 200),
    snippet: clip(mail.snippet || "", 700),
    unread: Boolean(mail.unread),
    flagged: Boolean(mail.flagged),
    important: Boolean(mail.important),
    toMe: mail.toMe !== false,
    attachments: Number(mail.attachments) || 0
  }));
  const heldBack = {
    hr: Math.max(0, Number(input.heldBack?.hr) || 0),
    bulk: Math.max(0, Number(input.heldBack?.bulk) || 0)
  };
  return { receivedAt: now.toISOString(), readAt: String(input.readAt || "").slice(0, 30), calendar: events, mail: mails, heldBack };
}

function localSignals(local, today) {
  if (!local) return [];
  const mails = local.mail.map((mail) => signal({
    id: mail.id,
    source: "mail",
    level: mail.flagged || mail.important ? "warn" : "info",
    title: `Mail fra ${mail.from}: ${mail.subject}`,
    detail: `${[mail.unread ? "ulæst" : "", mail.flagged ? "markeret til opfølgning" : "", mail.important ? "høj prioritet" : "", mail.toMe ? "" : "du er cc"].filter(Boolean).join(", ") || "læst"}; modtaget ${mail.received.replace("T", " ").slice(0, 16)}. ${mail.snippet}`,
    fingerprint: mail.id
  }));
  const events = local.calendar.map((event) => signal({
    id: event.id,
    source: "calendar",
    level: "info",
    title: `${event.allDay ? "Hele dagen" : `${event.start.slice(11, 16)}-${event.end.slice(11, 16)}`} ${relativeDay(event.start.slice(0, 10), today)}: ${event.subject}`,
    detail: [event.location ? `Sted: ${event.location}` : "", event.organizer && !event.organizedByMe ? `Arrangør: ${event.organizer}` : event.organizedByMe ? "Du er arrangør" : "", event.response ? `Svar: ${event.response}` : ""].filter(Boolean).join(". "),
    fingerprint: `${event.start}|${event.subject}`
  }));
  return [...events, ...mails];
}

// ---------------------------------------------------------------------------------------------
// Writing the brief

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "day", "todos", "fyi"],
  properties: {
    headline: { type: "string" },
    day: { type: "string" },
    todos: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "steps", "urgency", "sourceIds"],
        properties: {
          title: { type: "string" },
          why: { type: "string" },
          steps: { type: "array", maxItems: 5, items: { type: "string" } },
          urgency: { type: "string", enum: ["today", "this_week"] },
          sourceIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } }
        }
      }
    },
    fyi: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "sourceIds"],
        properties: {
          text: { type: "string" },
          sourceIds: { type: "array", maxItems: 6, items: { type: "string" } }
        }
      }
    }
  }
};

const SOURCE_TITLES = {
  asana: "Asana",
  klaviyo: "Klaviyo",
  meta: "Meta",
  watchdog: "Watchdog (biblens egne tjek)",
  survey: "Spørgeskemaet til stoppede kunder",
  calendar: "Kalender",
  mail: "Mail"
};

// Standing decisions the user has made. A to-do must never ask the user to act against them.
const HOUSE_RULES = [
  "Never suggest switching an ad on, or building anything live: ads are built paused and the user switches them on.",
  "A budget goes down only when the results say so, never because of a date. DE, FR and IT conversion campaigns are a deliberate market-entry investment: never suggest cutting or merging them on cost per customer.",
  "Fatigue figures are signals, not verdicts. At most five ads per ad set, every ad set keeps a mix of static, carousel and video, partnership ads are not swap candidates, and markets keep their own ad sets.",
  "No discounts except the New Year clearance of discontinued items. Never double opt-in.",
  "The content team makes and cuts content; the user does not re-cut videos. Do not create work for colleagues; a to-do is the user's own action (a message to a colleague is fine).",
  "Emails: avoid Friday sends; say production time, not delivery time; never a single Christmas deadline date."
];

function signalLine(item) {
  const bits = [`[${item.id}]`, item.level === "info" ? "" : `(${item.level})`, item.title];
  if (item.detail) bits.push(`- ${item.detail}`);
  if (item.inAsana) bits.push("- ALREADY IN THE USER'S ASANA");
  return bits.filter(Boolean).join(" ");
}

function buildBriefInput({ signals = [], today, now, local = null, sources = {}, previous = null }) {
  const ck = copenhagen(now);
  const bySource = {};
  for (const item of signals) (bySource[item.source] = bySource[item.source] || []).push(item);
  const sections = Object.keys(SOURCE_TITLES).map((source) => {
    const status = sources[source];
    const items = bySource[source] || [];
    const header = `## ${SOURCE_TITLES[source]}`;
    if (status && status.status === "error") return `${header}\nCould not be read: ${status.error || status.summary || "unknown error"}. Say so if it matters.`;
    if ((source === "calendar" || source === "mail") && !local) return `${header}\nNot sent from the user's computer yet today. Do not guess what is in it.`;
    if (!items.length) return `${header}\nNothing to report.`;
    return `${header}\n${items.map(signalLine).join("\n")}`;
  });
  const lines = [
    `Today is ${DANISH_WEEKDAYS[ck.weekday]} ${danishDate(today)} ${today.slice(0, 4)}, ${String(ck.hour).padStart(2, "0")}:${String(ck.minute).padStart(2, "0")} in Copenhagen.`,
    "",
    "You are the morning assistant of a marketing specialist at Westpack, a Danish B2B packaging company (jewellery boxes, carrier bags, shipping boxes) selling through 18 webshops. They run Meta ads and Klaviyo email in 13 languages and work from Asana with a small content team. Below is everything the agents read this morning. Each line starts with a signal id in brackets.",
    "",
    "Write the user's to-do list for today, in Danish.",
    "- A to-do is something the user must do or decide today or this week. Combine signals about the same thing into one to-do. At most eight; fewer is better. An empty list is a good answer when nothing needs the user.",
    "- title: imperative, concrete, at most 90 characters, starting with what it is about (example: \"W47 Forsendelse: beslut om den sendes i dag, ellers flyt den\").",
    "- why: one to three sentences with the facts and numbers from the signals that make it matter now. Only facts that are in the signals.",
    "- steps: zero to four short steps when the action has parts; otherwise empty.",
    "- urgency: today, or this_week.",
    "- sourceIds: the ids of every signal the to-do rests on, exactly as written in the brackets.",
    "- Signals marked ALREADY IN THE USER'S ASANA are the user's own tasks: never make a to-do that repeats one. Mention them in fyi only if something new makes one more urgent.",
    "- A mail becomes a to-do only when it asks the user for something, waits for an answer, or carries a deadline. Newsletters and notices do not.",
    "- A meeting becomes a to-do only when a signal shows something must be prepared for it.",
    "- fyi: up to six one-line things worth knowing that need no action (a send that went well, creatives ready, nothing wrong in Meta), each with its signal ids.",
    "- headline: one sentence that says how the day looks (for example \"Tre ting kræver dig i dag; resten kører.\" or \"Intet kræver dig i dag.\").",
    "- day: one or two sentences about today's calendar and the next meeting; empty string if the calendar was not sent.",
    "- Never invent a fact, number, name, date, deadline or link. If a signal is unclear, leave it out rather than guess.",
    "- Plain Danish, no exclamation marks, no emojis, no marketing tone.",
    "",
    "The user's standing decisions (a to-do must never ask for the opposite):",
    ...HOUSE_RULES.map((rule) => `- ${rule}`),
    ""
  ];
  if (previous?.todos?.length) {
    lines.push("Earlier today the brief already listed these to-dos (keep the same wording when they still apply, so the user recognises them):");
    for (const todo of previous.todos) lines.push(`- ${todo.title} [${todo.sourceIds.join(", ")}]`);
    lines.push("");
  }
  lines.push("# Signals", "", ...sections);
  return lines.join("\n");
}

function finalizeBrief(parsed = {}, signalsById = new Map()) {
  let dropped = 0;
  const seen = new Set();
  const todos = [];
  for (const raw of Array.isArray(parsed.todos) ? parsed.todos : []) {
    const sourceIds = [...new Set((raw.sourceIds || []).map((id) => String(id).trim()).filter((id) => signalsById.has(id)))];
    const title = clip(raw.title, 120);
    if (!sourceIds.length || !title) {
      dropped += 1;
      continue;
    }
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const links = [...new Set(sourceIds.map((id) => signalsById.get(id)?.link).filter(Boolean))].slice(0, 3);
    todos.push({
      title,
      why: clip(raw.why, 700),
      steps: (raw.steps || []).map((step) => clip(step, 220)).filter(Boolean).slice(0, 5),
      urgency: raw.urgency === "this_week" ? "this_week" : "today",
      sourceIds,
      links
    });
  }
  const fyi = (Array.isArray(parsed.fyi) ? parsed.fyi : [])
    .map((raw) => ({ text: clip(raw.text, 300), sourceIds: (raw.sourceIds || []).map(String).filter((id) => signalsById.has(id)) }))
    .filter((item) => item.text && item.sourceIds.length)
    .slice(0, 8);
  return {
    headline: clip(parsed.headline, 200) || (todos.length ? `${todos.length} ting kræver dig i dag.` : "Intet kræver dig i dag."),
    day: clip(parsed.day, 400),
    todos: todos.sort((left, right) => (left.urgency === right.urgency ? 0 : left.urgency === "today" ? -1 : 1)).slice(0, MAX_TODOS),
    fyi,
    dropped
  };
}

// ---------------------------------------------------------------------------------------------
// Asana to-dos: which to make, and which already exist

// ledger: { [signalId]: { gid, url, day, fingerprint, title } } - the tasks earlier briefs made from each signal.
// taskOpen: { [gid]: "open" | "completed" | "unknown" } for the ledger tasks that matter here.
function planTask(todo, { ledger = {}, signalsById = new Map(), today, taskOpen = {} }) {
  const sources = todo.sourceIds.map((id) => signalsById.get(id)).filter(Boolean);
  const relevant = sources.filter((item) => !item.inAsana);
  if (!relevant.length) return { action: "skip", reason: "in_asana" };
  const entries = relevant.map((item) => ({ item, entry: ledger[item.id] || null }));
  const today_ = entries.find(({ entry }) => entry && entry.day === today);
  if (today_) return { action: "reuse", reason: "today", gid: today_.entry.gid, url: today_.entry.url };
  const stillOpen = entries.find(({ entry, item }) => entry && entry.fingerprint === item.fingerprint && taskOpen[entry.gid] !== "completed");
  if (stillOpen) return { action: "reuse", reason: "still_open", gid: stillOpen.entry.gid, url: stillOpen.entry.url, since: stillOpen.entry.day };
  const changedOrNew = entries.some(({ entry, item }) => !entry || entry.fingerprint !== item.fingerprint);
  if (!changedOrNew) return { action: "skip", reason: "closed_unchanged" };
  return { action: "create" };
}

function taskDue(todo, signalsById, today) {
  if (todo.urgency === "today") return today;
  const dues = todo.sourceIds.map((id) => signalsById.get(id)?.due).filter((due) => due && due >= today).sort();
  return dues[0] || workdayAfter(today, 2);
}

function taskNotes(todo, signalsById, today) {
  const lines = [todo.why];
  if (todo.steps.length) lines.push("", "Trin:", ...todo.steps.map((step) => `- ${step}`));
  if (todo.links.length) lines.push("", "Links:", ...todo.links.map((link) => `- ${link}`));
  const basis = todo.sourceIds.map((id) => signalsById.get(id)).filter(Boolean).map((item) => `${SOURCE_TITLES[item.source] || item.source}: ${clip(item.title, 90)}`);
  lines.push("", `Fra Morgenbriefen i biblen, ${DANISH_WEEKDAYS[weekdayOf(today)]} ${danishDate(today)}. Bygger på: ${basis.join("; ")}.`);
  return lines.join("\n");
}

function pruneLedger(ledger = {}, today) {
  const cutoff = addDays(today, -LEDGER_DAYS);
  return Object.fromEntries(Object.entries(ledger).filter(([, entry]) => entry?.day && entry.day >= cutoff));
}

// ---------------------------------------------------------------------------------------------
// The day's document and the tick

function emptyDoc(previous = null) {
  return {
    version: BRIEF_VERSION,
    day: "",
    phase: "idle",
    sources: {},
    signals: [],
    openMine: [],
    collectedAt: "",
    previousCollectedAt: previous?.collectedAt || previous?.previousCollectedAt || "",
    local: null,
    writing: null,
    brief: null,
    error: "",
    settings: { createTasks: true, ...(previous?.settings || {}) },
    ledger: previous?.ledger || {},
    log: previous?.log || []
  };
}

function rollOver(doc, today) {
  if (doc && doc.day === today) return doc;
  const next = emptyDoc(doc);
  next.day = today;
  next.ledger = pruneLedger(next.ledger, today);
  return next;
}

function addLog(doc, now, event) {
  doc.log = [...(doc.log || []), { at: now.toISOString(), event: clip(event, 300) }].slice(-LOG_LIMIT);
}

function sinceFor(doc, now) {
  const floor = new Date(now.getTime() - 72 * 3600000).toISOString();
  const ceiling = new Date(now.getTime() - 20 * 3600000).toISOString();
  const previous = doc.previousCollectedAt || "";
  if (!previous) return new Date(now.getTime() - 24 * 3600000).toISOString();
  return previous < floor ? floor : previous > ceiling ? ceiling : previous;
}

async function runSource(name, fn) {
  try {
    const result = await fn();
    return { name, ok: true, result };
  } catch (error) {
    return { name, ok: false, error: String(error?.message || error) };
  }
}

// deps: { asana, projects, klaviyo, history, graph, pages, accountId, resolveObjectiveGroup, readWatchdog, readSurvey }
async function collectCloud({ deps, doc, now }) {
  const today = doc.day;
  const since = sinceFor(doc, now);
  const sources = {};
  const signals = [];

  const [asana, klaviyo, history, meta, watchdog, survey] = await Promise.all([
    deps.asana ? runSource("asana", () => collectAsana({ asana: deps.asana, projects: deps.projects || {}, today, since })) : { name: "asana", skipped: true },
    deps.klaviyo ? runSource("klaviyo", () => collectKlaviyoCampaigns({ klaviyo: deps.klaviyo })) : { name: "klaviyo", skipped: true },
    deps.history ? runSource("history", () => deps.history()) : { name: "history", skipped: true },
    deps.graph ? runSource("meta", () => collectMeta({ graph: deps.graph, pages: deps.pages, accountId: deps.accountId, now, resolveObjectiveGroup: deps.resolveObjectiveGroup })) : { name: "meta", skipped: true },
    deps.readWatchdog ? runSource("watchdog", () => deps.readWatchdog()) : { name: "watchdog", skipped: true },
    deps.readSurvey ? runSource("survey", () => deps.readSurvey()) : { name: "survey", skipped: true }
  ]);

  const status = (result, summary) => (result.skipped
    ? { status: "skipped", summary: "Ikke sat op her." }
    : result.ok
      ? { status: "ok", summary }
      : { status: "error", summary: "Kunne ikke læses.", error: result.error });

  let openMine = [];
  if (asana.ok) {
    signals.push(...asana.result.signals);
    openMine = asana.result.openMine;
  }
  const campaigns = klaviyo.ok ? klaviyo.result : null;
  if (asana.ok) signals.push(...cardSignals({ cards: asana.result.cards, campaigns, today, now }));
  sources.asana = status(asana, asana.ok ? asana.result.summary : "");

  let klaviyoSummary = "";
  if (campaigns) {
    const scheduled = scheduledTodaySignals({ campaigns, today, now });
    signals.push(...scheduled);
    klaviyoSummary = `${campaigns.length} DK-kampagner ændret de sidste tre uger; ${scheduled.length} planlagt i dag.`;
  }
  if (history.ok && history.result) {
    const sends = sendSignals({ entries: history.result.entries || [], otherMarkets: history.result.otherMarkets || {}, since, today, syncedAt: history.result.syncedAt || "" });
    signals.push(...sends);
    klaviyoSummary += ` ${sends.length} udsendelser siden sidst.`;
  }
  sources.klaviyo = klaviyo.skipped ? status(klaviyo) : klaviyo.ok
    ? { status: history.ok ? "ok" : "partial", summary: klaviyoSummary.trim(), ...(history.ok ? {} : { error: `Udsendelser: ${history.error || "ikke sat op"}` }) }
    : status(klaviyo);

  if (meta.ok) signals.push(...meta.result.signals);
  sources.meta = status(meta, meta.ok ? meta.result.summary : "");

  if (watchdog.ok) {
    const found = watchdogSignals(watchdog.result);
    signals.push(...found);
    sources.watchdog = { status: "ok", summary: watchdog.result?.ranAt ? `${found.length} åbne fund; sidst kørt ${watchdog.result.ranAt.slice(11, 16)} UTC.` : "Har ikke kørt endnu." };
  } else {
    sources.watchdog = status(watchdog);
  }

  if (survey.ok) {
    const found = surveySignals({ answers: survey.result?.answers || [], since, today });
    signals.push(...found);
    sources.survey = { status: "ok", summary: found.length ? found[0].title : "Ingen nye svar siden sidst." };
  } else {
    sources.survey = status(survey);
  }

  return { sources, signals, openMine, since };
}

function allSignals(doc) {
  return [...(doc.signals || []), ...localSignals(doc.local, doc.day)];
}

function localStatus(doc) {
  if (!doc.local) return { status: "waiting", summary: "Ikke sendt fra din computer endnu i dag. Den sender, når den vågner." };
  return {
    status: "ok",
    summary: `${doc.local.calendar.length} aftaler og ${doc.local.mail.length} mails læst ${doc.local.receivedAt.slice(11, 16)} UTC${doc.local.heldBack.hr ? `; ${doc.local.heldBack.hr} HR/kandidat-mails holdt tilbage` : ""}.`
  };
}

async function startWriting({ deps, doc, now }) {
  const signals = allSignals(doc);
  const sources = { ...doc.sources, calendar: doc.local ? { status: "ok" } : { status: "waiting" }, mail: doc.local ? { status: "ok" } : { status: "waiting" } };
  const input = buildBriefInput({ signals, today: doc.day, now, local: doc.local, sources, previous: doc.brief });
  const job = await deps.startJob({ input, schemaName: "morning_brief", schema: BRIEF_SCHEMA });
  const attempts = (doc.writing?.attempts || 0) + 1;
  doc.writing = { jobId: job.id, model: job.model, startedAt: now.toISOString(), withLocal: Boolean(doc.local), attempts, signalCount: signals.length };
  doc.phase = "writing";
  doc.error = "";
  addLog(doc, now, `Skriver briefen (${signals.length} signaler${doc.local ? ", med kalender og mail" : ", uden kalender og mail"}).`);
}

async function createTasks({ deps, doc, brief, signalsById, now }) {
  if (!doc.settings?.createTasks) {
    for (const todo of brief.todos) todo.asana = { status: "off" };
    return;
  }
  if (!deps.createTask) {
    for (const todo of brief.todos) todo.asana = { status: "failed", note: "Asana er ikke sat op her." };
    return;
  }
  const today = doc.day;
  const ledger = { ...(doc.ledger || {}) };
  const taskOpen = {};
  const recentOpen = deps.recentOpenTasks ? await deps.recentOpenTasks().catch(() => []) : [];
  const byName = new Map(recentOpen.map((task) => [String(task.name).trim().toLowerCase(), task]));
  for (const todo of brief.todos) {
    // Only the ledger tasks this to-do could reuse are looked up, one call each.
    for (const id of todo.sourceIds) {
      const entry = ledger[id];
      if (entry && entry.day !== today && !(entry.gid in taskOpen) && deps.taskState) {
        taskOpen[entry.gid] = await deps.taskState(entry.gid).catch(() => "unknown");
      }
    }
    const plan = planTask(todo, { ledger, signalsById, today, taskOpen });
    if (plan.action === "skip") {
      todo.asana = { status: "skipped", reason: plan.reason };
      continue;
    }
    if (plan.action === "reuse") {
      todo.asana = { status: "reused", reason: plan.reason, gid: plan.gid, url: plan.url, since: plan.since || "" };
      continue;
    }
    const sameName = byName.get(todo.title.trim().toLowerCase());
    let created;
    try {
      created = sameName
        ? { gid: String(sameName.gid), permalinkUrl: String(sameName.url || ""), existing: true }
        : await deps.createTask({ name: todo.title, notes: taskNotes(todo, signalsById, today), dueOn: taskDue(todo, signalsById, today) });
    } catch (error) {
      todo.asana = { status: "failed", note: String(error?.message || error) };
      continue;
    }
    todo.asana = { status: created.existing ? "reused" : "created", reason: created.existing ? "same_name" : "", gid: created.gid, url: created.permalinkUrl || "" };
    byName.set(todo.title.trim().toLowerCase(), { gid: created.gid, name: todo.title, url: created.permalinkUrl });
    for (const id of todo.sourceIds) {
      const item = signalsById.get(id);
      if (item && !item.inAsana) ledger[id] = { gid: created.gid, url: created.permalinkUrl || "", day: today, fingerprint: item.fingerprint, title: todo.title };
    }
  }
  doc.ledger = pruneLedger(ledger, today);
}

// Returns "pending", "failed", "busy" (another request is finishing it), "lost" (that request won the claim), or
// "done". Only "busy" and "lost" leave the stored document alone.
async function finishWriting({ deps, doc, now }) {
  const claim = doc.writing?.claim;
  if (claim && now.getTime() - (Date.parse(claim.at) || 0) < CLAIM_MS) return "busy";
  const result = await deps.readJob(doc.writing.jobId);
  if (result.pending) {
    const started = Date.parse(doc.writing.startedAt || "") || now.getTime();
    if (now.getTime() - started > STUCK_WRITING_MS) {
      doc.phase = "failed";
      doc.error = "Modellen blev ikke færdig inden for 25 minutter.";
      addLog(doc, now, doc.error);
      return "failed";
    }
    return "pending";
  }
  if (result.failed) {
    doc.phase = "failed";
    doc.error = result.error || "Modellen fejlede.";
    addLog(doc, now, `Skrivningen fejlede: ${doc.error}`);
    return "failed";
  }
  // Two requests can find the same finished job (the cron tick and the page, or the computer's script). Asana tasks
  // are made once: the request that wins the claim makes them, the other leaves the document alone.
  if (deps.claim) {
    doc.writing = { ...doc.writing, claim: { id: crypto.randomBytes(6).toString("hex"), at: now.toISOString() } };
    if (!(await deps.claim(doc))) return "lost";
  }
  const signals = allSignals(doc);
  const signalsById = new Map(signals.map((item) => [item.id, item]));
  const brief = finalizeBrief(result.parsed, signalsById);
  await createTasks({ deps, doc, brief, signalsById, now });
  doc.brief = { ...brief, writtenAt: now.toISOString(), model: result.model || doc.writing.model, withLocal: doc.writing.withLocal };
  doc.phase = "done";
  doc.error = "";
  const created = brief.todos.filter((todo) => todo.asana?.status === "created").length;
  addLog(doc, now, `Briefen er skrevet: ${brief.todos.length} to-dos, ${created} oprettet i Asana${brief.dropped ? `, ${brief.dropped} uden kilde droppet` : ""}.`);
  return "done";
}

async function safeStart({ deps, doc, now }) {
  try {
    await startWriting({ deps, doc, now });
  } catch (error) {
    doc.phase = "failed";
    doc.writing = { ...(doc.writing || {}), attempts: (doc.writing?.attempts || 0) + 1, jobId: "" };
    doc.error = `Skrivningen kunne ikke starte: ${error?.message || error}`;
    addLog(doc, now, doc.error);
  }
}

// A brief written before the calendar and mail arrived (or before newer ones did) is written again with them.
function needsRewrite(doc) {
  return doc.phase === "done" && Boolean(doc.local) && Boolean(doc.brief) && (!doc.brief.withLocal || doc.local.receivedAt > doc.brief.writtenAt);
}

// One step of the day. `scope`:
//   cron   - the scheduled tick: weekdays only, collects from 06:00, writes at 07:40 without the computer's part
//   local  - the computer has just sent the calendar and mail: collect if needed and write at once
//   manual - "Run again now" on the page: collect afresh and write at once, any day
//   page   - the page (or the computer's script) following a brief being written: finishes it, starts nothing new
// Returns { doc, changed }; when `changed` is false the caller must not write the document back.
async function runBriefTick({ deps, doc: stored = null, now = new Date(), scope = "cron" }) {
  const ck = copenhagen(now);
  if (scope === "cron" && ck.weekday > 5) return { doc: stored, changed: false };
  const doc = rollOver(stored ? JSON.parse(JSON.stringify(stored)) : null, ck.day);
  let changed = !stored || stored.day !== doc.day;

  if (scope === "manual") {
    doc.phase = "idle";
    doc.writing = null;
  }

  if (doc.phase === "idle" && scope !== "page") {
    const due = scope === "manual" || scope === "local" || ck.minutes >= COLLECT_FROM_MINUTES;
    if (due) {
      const collected = await collectCloud({ deps, doc, now });
      doc.sources = collected.sources;
      doc.signals = collected.signals;
      doc.openMine = collected.openMine;
      doc.since = collected.since;
      doc.collectedAt = now.toISOString();
      doc.phase = "collected";
      addLog(doc, now, `Kilderne er læst: ${collected.signals.length} signaler.`);
      changed = true;
    }
  }

  if (doc.phase === "collected" && scope !== "page") {
    const writeNow = scope === "manual" || scope === "local" || Boolean(doc.local) || ck.minutes >= WRITE_WITHOUT_LOCAL_FROM_MINUTES;
    if (writeNow) {
      await safeStart({ deps, doc, now });
      changed = true;
    }
    return { doc, changed };
  }

  if (doc.phase === "writing" && doc.writing?.jobId) {
    const outcome = await finishWriting({ deps, doc, now });
    if (outcome === "busy" || outcome === "lost") return { doc: stored, changed: false };
    if (outcome === "pending") return { doc, changed };
    changed = true;
  }

  if (doc.phase === "failed" && scope !== "page" && (doc.writing?.attempts || 0) < MAX_WRITE_ATTEMPTS && doc.collectedAt) {
    await safeStart({ deps, doc, now });
    return { doc, changed: true };
  }

  if (needsRewrite(doc)) {
    doc.writing = { attempts: 0 };
    await safeStart({ deps, doc, now });
    return { doc, changed: true };
  }

  return { doc, changed };
}

// What the page and the overview are shown. The ledger stays on the server.
function describeBrief(doc, now = new Date()) {
  if (!doc) return { empty: true, phase: "idle", today: copenhagen(now).day };
  const signalsById = new Map(allSignals(doc).map((item) => [item.id, item]));
  const ck = copenhagen(now);
  const brief = doc.brief ? {
    ...doc.brief,
    todos: doc.brief.todos.map((todo) => ({
      ...todo,
      sources: todo.sourceIds.map((id) => signalsById.get(id)).filter(Boolean).map((item) => ({ id: item.id, source: item.source, title: item.title, link: item.link }))
    })),
    fyi: doc.brief.fyi.map((item) => ({ ...item, links: item.sourceIds.map((id) => signalsById.get(id)?.link).filter(Boolean).slice(0, 2) }))
  } : null;
  return {
    empty: false,
    today: ck.day,
    stale: doc.day !== ck.day,
    day: doc.day,
    phase: doc.phase,
    error: doc.error || "",
    collectedAt: doc.collectedAt || "",
    writing: doc.writing ? { startedAt: doc.writing.startedAt, withLocal: doc.writing.withLocal, model: doc.writing.model } : null,
    sources: { ...doc.sources, local: localStatus(doc) },
    calendar: doc.local?.calendar || [],
    openMine: doc.openMine || [],
    brief,
    settings: doc.settings || { createTasks: true },
    log: (doc.log || []).slice(-12),
    signalCount: (doc.signals || []).length + (doc.local ? doc.local.calendar.length + doc.local.mail.length : 0)
  };
}

module.exports = {
  BRIEF_SCHEMA,
  COLLECT_FROM_MINUTES,
  WRITE_WITHOUT_LOCAL_FROM_MINUTES,
  CLAIM_MS,
  addDays,
  accountDay,
  buildBriefInput,
  cardSignals,
  collectAsana,
  collectMeta,
  copenhagen,
  describeBrief,
  finalizeBrief,
  judgeAdFatigue,
  localSignals,
  matchCardToCampaigns,
  planTask,
  rollOver,
  runBriefTick,
  sanitizeLocal,
  sendSignals,
  surveySignals,
  taskDue,
  taskNotes,
  watchdogSignals,
  workdayAfter
};
