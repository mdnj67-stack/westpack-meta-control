const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildBriefInput,
  cardSignals,
  copenhagen,
  describeBrief,
  finalizeBrief,
  judgeAdFatigue,
  matchCardToCampaigns,
  planTask,
  runBriefTick,
  sanitizeLocal,
  sendSignals,
  taskDue,
  watchdogSignals,
  workdayAfter
} = require("../server/agents/morning-brief");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

// 2026-11-25 is a Wednesday; Copenhagen is UTC+1 in November.
const at = (hhmm, day = "2026-11-25") => new Date(`${day}T${hhmm}:00+01:00`);

test("time: Copenhagen's day and minutes, and working days skip the weekend", () => {
  const now = copenhagen(at("06:05"));
  assert.equal(now.day, "2026-11-25");
  assert.equal(now.minutes, 6 * 60 + 5);
  assert.equal(now.weekday, 3);
  assert.equal(workdayAfter("2026-11-27", 1), "2026-11-30"); // Friday + 1 = Monday
  assert.equal(workdayAfter("2026-11-28", 0), "2026-11-30"); // Saturday -> Monday
  assert.equal(workdayAfter("2026-11-25", 2), "2026-11-27");
});

test("fatigue: the same rules as the Monday status report", () => {
  const week = (ctr, cpm, freq, share, nc = 0) => ({ ctr, cpm, freq, share, nc, spend: 1000 });
  // CTR -20 % and CPM +15 % with no new customers: swap now.
  assert.equal(judgeAdFatigue([week(1.0, 40, 2, 40), week(0.9, 44, 2, 35), week(0.7, 50, 2, 30)]).verdict, "swap_now");
  // The same signs, but it still brings customers: tired, delivering.
  assert.equal(judgeAdFatigue([week(1.0, 40, 2, 40, 3), week(0.9, 44, 2, 35, 2), week(0.7, 50, 2, 30, 2)]).verdict, "tired_delivering");
  // One sign is only "watch".
  assert.equal(judgeAdFatigue([week(1.0, 40, 2, 40), week(1.0, 40, 2, 40), week(1.0, 40, 4.2, 40)]).verdict, "watch");
  // Awareness under 5 % after under 10 %: Meta has given up on it.
  assert.equal(judgeAdFatigue([week(1, 10, 2, 20), week(1, 10, 2, 8), week(1, 10, 2, 3)], { awareness: true }).verdict, "abandoned");
  assert.equal(judgeAdFatigue([null, null, null]).verdict, "no_delivery");
  // The rules are written out once, in the module the report's rules came from.
  assert.match(read("server", "agents", "morning-brief.js"), /same rules as the Monday status report \(scripts\/meta-ad-status\.js\)/);
});

test("an Asana campaign card finds its DK campaign by week number and a shared word", () => {
  const campaigns = [
    { id: "a", name: "W48 Pre Black Friday", status: "Sent" },
    { id: "b", name: "W48: Logotryk fra produktionen", status: "Draft" },
    { id: "c", name: "W47 Den store forsendelse", status: "Scheduled", sendTime: "2026-11-25T09:00:00Z" }
  ];
  assert.equal(matchCardToCampaigns({ name: "W48: Logotryk fra produktionen" }, campaigns)?.id, "b");
  assert.equal(matchCardToCampaigns({ name: "W47 Forsendelse (den helt store)" }, campaigns)?.id, "c");
  assert.equal(matchCardToCampaigns({ name: "W49 Navn i guld" }, campaigns), null);

  const [card] = cardSignals({ cards: [{ gid: "1", name: "W49 Navn i guld", due: "2026-11-26", section: "Klar", link: "https://app.asana.com/x", openSubtasks: ["Emnelinjer (Kirsten)"] }], campaigns, today: "2026-11-25", now: at("06:05") });
  assert.equal(card.level, "warn");
  assert.match(card.detail, /Deadline i morgen/);
  assert.match(card.detail, /Åbne underopgaver: Emnelinjer/);
  assert.match(card.detail, /ingen kampagne fundet/);
  // Klaviyo that could not be read is said, not read as "missing".
  const [unknown] = cardSignals({ cards: [{ gid: "1", name: "W49", due: "2026-11-26", section: "", link: "", openSubtasks: [] }], campaigns: null, today: "2026-11-25", now: at("06:05") });
  assert.match(unknown.detail, /Klaviyo DK kunne ikke læses/);
});

test("an A/B test is one send, not one per arm", () => {
  const entries = [
    { campaignId: "c1", campaignName: "W48 Pre BF", subject: "A", sentAt: "2026-11-24T09:00:00Z", received: 1000, openIndex: 1.1, clickIndex: 1.2 },
    { campaignId: "c1", campaignName: "W48 Pre BF", subject: "B", sentAt: "2026-11-24T09:00:00Z", received: 9000, openIndex: 0.9, clickIndex: 0.95 }
  ];
  const signals = sendSignals({ entries, otherMarkets: { c1: 12 }, since: "2026-11-23T00:00:00Z", today: "2026-11-25" });
  assert.equal(signals.length, 1);
  assert.match(signals[0].detail, /10\.000/);
  assert.match(signals[0].detail, /"B"/);
  assert.match(signals[0].detail, /12 andre markeder/);
});

test("the watchdog's open, unmuted findings become signals", () => {
  const signals = watchdogSignals({ checks: {
    meta_account: { id: "meta_account", title: "Meta ad account", status: "alert", items: [{ key: "account_status", fingerprint: "3:0", status: "alert", title: "Unsettled", detail: "Pay" }] },
    stores: { id: "stores", title: "Webshops", status: "ok", items: [{ key: "CZ", fingerprint: "x", status: "warn", title: "CZ", muted: { at: "x" } }] }
  } });
  assert.deepEqual(signals.map((item) => item.id), ["watchdog:meta_account:account_status"]);
});

const SIGNALS = new Map([
  ["asana-card:1", { id: "asana-card:1", source: "asana", title: "Kampagnekort: W47", link: "https://app.asana.com/card1", fingerprint: "f1", due: "2026-11-26" }],
  ["mail:abc", { id: "mail:abc", source: "mail", title: "Mail fra Mikkel", link: "", fingerprint: "mail:abc" }],
  ["asana-mine:9", { id: "asana-mine:9", source: "asana", title: "Min opgave", link: "https://app.asana.com/mine", fingerprint: "2026-11-25", inAsana: true }]
]);

test("a to-do the model cannot tie to a real signal is dropped, and links come from the signals", () => {
  const brief = finalizeBrief({
    headline: "To ting kræver dig.",
    day: "",
    todos: [
      { title: "W47: beslut om den sendes", why: "Deadline.", steps: [], urgency: "today", sourceIds: ["asana-card:1", "made-up:1"] },
      { title: "Ring til en kunde", why: "Opfundet.", steps: [], urgency: "today", sourceIds: ["made-up:2"] },
      { title: "Svar Mikkel", why: "Han venter.", steps: ["Skriv"], urgency: "this_week", sourceIds: ["mail:abc"] }
    ],
    fyi: [{ text: "Ingen kilde", sourceIds: ["nope"] }]
  }, SIGNALS);
  assert.equal(brief.todos.length, 2);
  assert.equal(brief.dropped, 1);
  assert.deepEqual(brief.todos[0].sourceIds, ["asana-card:1"]);
  assert.deepEqual(brief.todos[0].links, ["https://app.asana.com/card1"]);
  assert.equal(brief.fyi.length, 0);
  assert.equal(taskDue(brief.todos[1], SIGNALS, "2026-11-25"), "2026-11-27");
});

test("Asana: a to-do is made once, an open one is reused, and a closed one stays closed until its source changes", () => {
  const todo = { title: "W47", sourceIds: ["asana-card:1"] };
  assert.deepEqual(planTask(todo, { ledger: {}, signalsById: SIGNALS, today: "2026-11-25" }), { action: "create" });
  const madeToday = { "asana-card:1": { gid: "77", url: "u", day: "2026-11-25", fingerprint: "f1" } };
  assert.equal(planTask(todo, { ledger: madeToday, signalsById: SIGNALS, today: "2026-11-25" }).action, "reuse");
  const madeYesterday = { "asana-card:1": { gid: "77", url: "u", day: "2026-11-24", fingerprint: "f1" } };
  assert.equal(planTask(todo, { ledger: madeYesterday, signalsById: SIGNALS, today: "2026-11-25", taskOpen: { 77: "open" } }).reason, "still_open");
  assert.deepEqual(planTask(todo, { ledger: madeYesterday, signalsById: SIGNALS, today: "2026-11-25", taskOpen: { 77: "completed" } }), { action: "skip", reason: "closed_unchanged" });
  const changed = { "asana-card:1": { gid: "77", url: "u", day: "2026-11-24", fingerprint: "old" } };
  assert.deepEqual(planTask(todo, { ledger: changed, signalsById: SIGNALS, today: "2026-11-25", taskOpen: { 77: "completed" } }), { action: "create" });
  // The user's own Asana tasks are never made again.
  assert.deepEqual(planTask({ title: "x", sourceIds: ["asana-mine:9"] }, { ledger: {}, signalsById: SIGNALS, today: "2026-11-25" }), { action: "skip", reason: "in_asana" });
});

test("the prompt carries the house rules and says when calendar and mail have not arrived", () => {
  const input = buildBriefInput({ signals: [...SIGNALS.values()], today: "2026-11-25", now: at("07:40"), local: null, sources: {} });
  assert.match(input, /onsdag 25\/11 2026/);
  assert.match(input, /Never suggest switching an ad on/);
  assert.match(input, /DE, FR and IT conversion campaigns are a deliberate market-entry investment/);
  assert.match(input, /Never invent a fact/);
  assert.match(input, /## Mail\nNot sent from the user's computer yet today/);
  assert.match(input, /\[asana-mine:9\].*ALREADY IN THE USER'S ASANA/);
});

test("calendar and mail from the computer are trimmed and given stable ids", () => {
  const local = sanitizeLocal({
    calendar: [{ id: "E1", start: "2026-11-25T11:00", end: "2026-11-25T12:00", subject: "Video til awareness", location: "Torino" }],
    mail: [{ id: "M1", received: "2026-11-24T16:00", from: "Mikkel", subject: "Credit line", snippet: "x".repeat(5000), flagged: true }],
    heldBack: { hr: 2, bulk: 14 }
  }, at("07:20"));
  assert.equal(local.calendar.length, 1);
  assert.match(local.calendar[0].id, /^cal:[0-9a-f]{12}$/);
  assert.ok(local.mail[0].snippet.length <= 700);
  assert.equal(local.heldBack.hr, 2);
  assert.equal(sanitizeLocal({ calendar: [{ id: "E1", start: "2026-11-25T11:00", subject: "Video til awareness" }], mail: [] }).calendar[0].id, local.calendar[0].id);
});

// A fake world for the tick: one card, a job that finishes when told to, and an Asana that records what is made.
function fakeDeps({ jobDone, created, claimWins = true }) {
  return {
    asana: {
      get: async (resourcePath) => (resourcePath === "/users/me" ? { gid: "me", name: "Me", workspaces: [{ gid: "ws" }] } : []),
      pages: async (resourcePath) => {
        if (resourcePath === "/projects/camp/tasks") return [{ gid: "1", name: "W47 Forsendelse", due_on: "2026-11-25", permalink_url: "https://app.asana.com/card1", memberships: [{ section: { name: "Klar til afsendelse" } }] }];
        if (resourcePath === "/tasks/1/subtasks") return [{ gid: "s1", name: "Emnelinjer", completed: false }];
        return [];
      }
    },
    projects: { campaign: "camp" },
    klaviyo: { campaigns: async () => [] },
    startJob: async () => ({ id: "job1", model: "gpt-test" }),
    readJob: async () => (jobDone() ? {
      parsed: { headline: "Én ting.", day: "", todos: [{ title: "W47 Forsendelse: beslut om den sendes i dag", why: "Deadline i dag.", steps: [], urgency: "today", sourceIds: ["asana-card:1"] }], fyi: [] },
      model: "gpt-test"
    } : { pending: true }),
    createTask: async (task) => {
      created.push(task);
      return { gid: `t${created.length}`, permalinkUrl: `https://app.asana.com/t${created.length}` };
    },
    taskState: async () => "completed",
    recentOpenTasks: async () => [],
    claim: async () => claimWins
  };
}

test("a morning: nothing before six, collect at six, write when the computer reports, make the to-do once", async () => {
  let done = false;
  const created = [];
  const deps = fakeDeps({ jobDone: () => done, created });

  let result = await runBriefTick({ deps, doc: null, now: at("05:53"), scope: "cron" });
  assert.equal(result.doc.phase, "idle");

  result = await runBriefTick({ deps, doc: result.doc, now: at("06:03"), scope: "cron" });
  assert.equal(result.doc.phase, "collected");
  assert.ok(result.doc.signals.some((item) => item.id === "asana-card:1"));

  // Not 07:40 yet and no calendar: it waits.
  result = await runBriefTick({ deps, doc: result.doc, now: at("06:13"), scope: "cron" });
  assert.equal(result.doc.phase, "collected");

  // The computer wakes and sends the calendar and mail: the brief is written at once.
  const withLocal = { ...result.doc, local: sanitizeLocal({ calendar: [], mail: [] }, at("07:16")) };
  result = await runBriefTick({ deps, doc: withLocal, now: at("07:16"), scope: "local" });
  assert.equal(result.doc.phase, "writing");
  assert.equal(result.doc.writing.withLocal, true);

  result = await runBriefTick({ deps, doc: result.doc, now: at("07:17"), scope: "page" });
  assert.equal(result.doc.phase, "writing");

  done = true;
  result = await runBriefTick({ deps, doc: result.doc, now: at("07:19"), scope: "page" });
  assert.equal(result.doc.phase, "done");
  assert.equal(created.length, 1);
  assert.equal(created[0].dueOn, "2026-11-25");
  assert.match(created[0].notes, /Fra Morgenbriefen i biblen, onsdag 25\/11/);
  assert.equal(result.doc.brief.todos[0].asana.status, "created");

  // "Run again now" the same day writes again but does not make the to-do twice.
  result = await runBriefTick({ deps, doc: result.doc, now: at("09:00"), scope: "manual" });
  result = await runBriefTick({ deps, doc: result.doc, now: at("09:02"), scope: "page" });
  assert.equal(result.doc.phase, "done");
  assert.equal(created.length, 1);
  assert.equal(result.doc.brief.todos[0].asana.status, "reused");

  // The next morning the card is unchanged and the user closed yesterday's to-do: it is not made again.
  const nextDay = "2026-11-26";
  const deps2 = fakeDeps({ jobDone: () => true, created });
  deps2.asana.pages = async (resourcePath) => {
    if (resourcePath === "/projects/camp/tasks") return [{ gid: "1", name: "W47 Forsendelse", due_on: "2026-11-25", permalink_url: "https://app.asana.com/card1", memberships: [{ section: { name: "Klar til afsendelse" } }] }];
    if (resourcePath === "/tasks/1/subtasks") return [{ gid: "s1", name: "Emnelinjer", completed: false }];
    return [];
  };
  result = await runBriefTick({ deps: deps2, doc: result.doc, now: at("06:03", nextDay), scope: "cron" });
  assert.equal(result.doc.day, nextDay);
  assert.equal(result.doc.local, null);
  result = await runBriefTick({ deps: deps2, doc: result.doc, now: at("07:43", nextDay), scope: "cron" });
  assert.equal(result.doc.phase, "writing");
  assert.equal(result.doc.writing.withLocal, false);
  result = await runBriefTick({ deps: deps2, doc: result.doc, now: at("07:53", nextDay), scope: "cron" });
  assert.equal(result.doc.brief.todos[0].asana.status, "skipped");
  assert.equal(result.doc.brief.todos[0].asana.reason, "closed_unchanged");
  assert.equal(created.length, 1);

  // The calendar and mail arrive after a brief written without them: it is written again with them.
  const late = { ...result.doc, local: sanitizeLocal({ calendar: [], mail: [] }, at("08:10", nextDay)) };
  result = await runBriefTick({ deps: deps2, doc: late, now: at("08:10", nextDay), scope: "local" });
  assert.equal(result.doc.phase, "writing");
  assert.equal(result.doc.writing.withLocal, true);
});

test("the weekend is quiet, and a request that loses the claim leaves the document alone", async () => {
  const created = [];
  const saturday = await runBriefTick({ deps: fakeDeps({ jobDone: () => true, created }), doc: null, now: at("07:43", "2026-11-28"), scope: "cron" });
  assert.equal(saturday.changed, false);

  const writing = { version: 1, day: "2026-11-25", phase: "writing", signals: [], sources: {}, local: null, settings: { createTasks: true }, ledger: {}, log: [], collectedAt: "x", writing: { jobId: "job1", startedAt: at("07:40").toISOString(), attempts: 1 } };
  const lost = await runBriefTick({ deps: fakeDeps({ jobDone: () => true, created, claimWins: false }), doc: writing, now: at("07:45"), scope: "page" });
  assert.equal(lost.changed, false);
  assert.equal(created.length, 0);

  // A fresh claim by another request: this one does not even read the job.
  const claimed = { ...writing, writing: { ...writing.writing, claim: { id: "other", at: at("07:44").toISOString() } } };
  const busy = await runBriefTick({ deps: fakeDeps({ jobDone: () => true, created }), doc: claimed, now: at("07:45"), scope: "page" });
  assert.equal(busy.changed, false);
});

test("with Asana switched off on the page, the brief is written and nothing is created", async () => {
  const created = [];
  const deps = fakeDeps({ jobDone: () => true, created });
  let result = await runBriefTick({ deps, doc: { version: 1, day: "2026-11-25", phase: "idle", settings: { createTasks: false }, ledger: {}, log: [] }, now: at("09:00"), scope: "manual" });
  result = await runBriefTick({ deps, doc: result.doc, now: at("09:02"), scope: "page" });
  assert.equal(result.doc.phase, "done");
  assert.equal(created.length, 0);
  assert.equal(result.doc.brief.todos[0].asana.status, "off");
  const view = describeBrief(result.doc, at("09:03"));
  assert.equal(view.brief.todos[0].sources[0].link, "https://app.asana.com/card1");
  assert.equal(view.ledger, undefined);
});

test("the route: the cron needs the secret, and the only Asana write is a to-do for the token's owner", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/agents?action=brief_tick" && /\* \* 1-5$/.test(cron.schedule)));
  const route = read("api", "agents.js");
  assert.match(route, /if \(action === "brief_tick" && req\.method === "GET"\) \{\s*if \(!isAuthorizedCronRequest\(req, config\)\)/);
  assert.match(route, /createTask: asanaReady \? \(task\) => createAsanaTask\(config, task\)/);
  assert.doesNotMatch(route, /createAsanaContentRequest|addAsanaTaskComment|createAsanaTaskFromTemplate/);
  // createAsanaTask can assign to no one but the token's owner.
  assert.match(read("server", "lib", "asana.js"), /const data = \{ name: taskName, assignee: "me", workspace: workspaceGid \};/);
  // The model writing the brief is the strong one, as a background job.
  assert.match(route, /startStructured\(config, \{ input, schemaName, schema, reasoningEffort: "high", writing: true \}\)/);
});

test("the computer's script never sends HR or candidate mail, and reads no attachments", () => {
  const script = read("scripts", "morning-brief-local.ps1");
  assert.match(script, /ansøg/i);
  assert.match(script, /kandidat/i);
  assert.match(script, /\$heldBackHr/);
  assert.doesNotMatch(script, /SaveAsFile|Attachments\.Item\([^)]*\)\.SaveAs/i);
  assert.match(script, /GetDefaultFolder\(9\)/);
  assert.match(script, /GetDefaultFolder\(6\)/);
});
