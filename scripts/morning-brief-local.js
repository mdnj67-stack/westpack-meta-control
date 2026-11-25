// Sends the calendar and mail that scripts/morning-brief-local.ps1 read from Outlook to biblen's morning brief
// (POST /api/agents?action=brief_local), then follows the brief until it is written and prints it.
//
// Logs in the way smoke-local.js does, with the AUTH_PASSWORD this machine's config holds. Exit 0 once biblen has
// the calendar and mail (even if the brief is still being written), 1 otherwise.
//
// node scripts/morning-brief-local.js <outlook.json> [--base=https://project-4fcxa.vercel.app]

const fs = require("fs");
const path = require("path");

process.chdir(path.join(__dirname, ".."));
const { getConfig } = require("../server/lib/config");

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const base = (args.find((arg) => arg.startsWith("--base=")) || "--base=https://project-4fcxa.vercel.app").slice(7).replace(/\/+$/, "");
const POLL_MS = 15000;
const MAX_POLLS = 24;

let cookie = "";

async function request(pathname, options = {}) {
  const response = await fetch(base + pathname, {
    ...options,
    headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) }
  });
  const set = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (set.length) cookie = set.map((value) => value.split(";")[0]).join("; ");
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

function printBrief(brief) {
  if (!brief?.brief) {
    console.log(`Briefen: ${brief?.phase || "ukendt"}${brief?.error ? ` - ${brief.error}` : ""}`);
    return;
  }
  console.log(`Briefen: ${brief.brief.headline}`);
  for (const todo of brief.brief.todos || []) {
    const asana = todo.asana?.status === "created" ? "oprettet i Asana" : todo.asana?.status === "reused" ? "findes i Asana" : todo.asana?.status === "skipped" ? "ikke oprettet" : todo.asana?.status || "";
    console.log(`  - ${todo.title}${asana ? ` (${asana})` : ""}`);
  }
}

(async () => {
  if (!file || !fs.existsSync(file)) throw new Error("Give the Outlook JSON file the PowerShell script wrote.");
  const payload = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const password = process.env.AUTH_PASSWORD || getConfig().authPassword || "";
  if (!password) throw new Error("No AUTH_PASSWORD on this machine, so biblen cannot be logged into.");
  const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  if (login.status !== 200) throw new Error(`Login failed (${login.status}).`);

  const sent = await request("/api/agents?action=brief_local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      readAt: payload.readAt,
      calendar: Array.isArray(payload.calendar) ? payload.calendar : [],
      mail: Array.isArray(payload.mail) ? payload.mail : [],
      heldBack: payload.heldBack || {}
    })
  });
  if (sent.status !== 200) throw new Error(`biblen did not take the calendar and mail (${sent.status}): ${sent.json?.error || ""}`);
  console.log(`Sendt: ${(payload.calendar || []).length} aftaler og ${(payload.mail || []).length} mails.`);

  let brief = sent.json.brief;
  for (let poll = 0; poll < MAX_POLLS && brief?.phase === "writing"; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const next = await request("/api/agents?action=brief_tick", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (next.status === 200) brief = next.json.brief;
  }
  printBrief(brief);
})().catch((error) => {
  console.error(`FEJL: ${error.message}`);
  process.exit(1);
});
