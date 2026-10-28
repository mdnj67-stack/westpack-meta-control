const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { requestStructured, generateSubjectLines, editSubjectLines, startStructured, readStructured } = require("../server/klaviyo/subject-line-generator");

// Quality over speed (the user, 2026-10-27: "Jeg er ligeglad med hvor lang tid det tager hvis
// outputtet er derefter"). Two writers on medium draft, an editor on high chooses and sharpens -
// chosen in a blind comparison on three live campaigns - and a run that takes long waits for the
// strong model rather than handing over weaker lines without saying so.

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

// A fetch that never answers until it is aborted, recording which models were asked.
function hangingFetch(calls) {
  return (url, options) => new Promise((resolve, reject) => {
    calls.push(JSON.parse(options.body).model);
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
}

test("a writing call that times out fails on the strong model instead of quietly using the weaker one", async () => {
  const original = global.fetch;
  const calls = [];
  global.fetch = hangingFetch(calls);
  try {
    const config = { openAiApiKey: "test", openAiModel: "weak-model", contentAgentModel: "strong-model" };
    await assert.rejects(
      requestStructured(config, { input: [], schemaName: "x", schema: {}, writing: true, timeoutMs: 20, fallbackOnTimeout: false }),
      /exceeded/
    );
    assert.deepEqual(calls, ["strong-model"]);
    // Elsewhere (analysis, tagging) a timeout may still move on to the other model.
    calls.length = 0;
    await assert.rejects(requestStructured(config, { input: [], schemaName: "x", schema: {}, timeoutMs: 20 }), /exceeded/);
    assert.deepEqual(calls, ["weak-model", "strong-model"]);
  } finally {
    global.fetch = original;
  }
});

test("the writer and the editor both refuse the timeout fallback", async () => {
  const original = global.fetch;
  const calls = [];
  global.fetch = hangingFetch(calls);
  try {
    const config = { openAiApiKey: "test", openAiModel: "weak-model", contentAgentModel: "strong-model" };
    await assert.rejects(generateSubjectLines({ config, emailText: "Tekst", analysis: {}, timeoutMs: 20 }), /exceeded/);
    await assert.rejects(editSubjectLines({ config, emailText: "Tekst", analysis: {}, drafts: [{ subject: "A", preview: "B", mechanism: "tal", translationRisk: "lav" }], timeoutMs: 20 }), /exceeded/);
    assert.deepEqual(calls, ["strong-model", "strong-model"]);
  } finally {
    global.fetch = original;
  }
});

test("the editor is told to check the email, fix or drop rule breaks, and keep range", async () => {
  const original = global.fetch;
  let sent = null;
  global.fetch = async (url, options) => {
    sent = JSON.parse(options.body);
    const candidates = Array.from({ length: 6 }, (_, index) => ({ subject: `Linje ${index}`, preview: "Preheader", mechanism: "tal", secondaryMechanism: "", rationale: "", evidence: ["pb-1", "pb-made-up"], translationRisk: "lav", translationNote: "" }));
    return { ok: true, json: async () => ({ model: "strong-model", output: [{ content: [{ text: JSON.stringify({ candidates, picks: [{ number: 1, why: "" }, { number: 2, why: "" }, { number: 3, why: "" }], abTest: { a: 1, b: 2, why: "" } }) }] }] }) };
  };
  try {
    const config = { openAiApiKey: "test", openAiModel: "weak-model", contentAgentModel: "gpt-5-test" };
    const drafts = [
      { subject: "Gratis prøver i dag", preview: "x", mechanism: "tilbud", translationRisk: "lav", issues: [{ label: "No free samples", message: "Prøver er ikke gratis." }], evidence: [{ id: "pb-1" }] }
    ];
    const result = await editSubjectLines({ config, emailText: "Mailens tekst", analysis: { coreMessage: "x" }, drafts, count: 6 });
    const prompt = sent.input.map((item) => item.content[0].text).join("\n");
    assert.equal(sent.reasoning.effort, "high");
    assert.match(prompt, /Every offer, number, product and fact in a pair must be in the email/);
    assert.match(prompt, /A draft marked RULES broke a rule: fix it or drop it/);
    assert.match(prompt, /at least six mechanisms/);
    assert.match(prompt, /RULES: No free samples: Prøver er ikke gratis\./);
    assert.match(prompt, /Mailens tekst/);
    // Evidence the editor cites must have been cited by a draft.
    assert.deepEqual(result.candidates[0].evidence, ["pb-1"]);
  } finally {
    global.fetch = original;
  }
});

test("background jobs: started with the reasoning level, read back as pending, failed or finished", async () => {
  const original = global.fetch;
  const sent = [];
  const answers = {
    resp_pending01: { status: "in_progress" },
    resp_failed001: { status: "failed", error: { message: "server_error" } },
    resp_done00001: { status: "completed", model: "gpt-5-test", output: [{ content: [{ text: "{\"candidates\":[]}" }] }] }
  };
  global.fetch = async (url, options = {}) => {
    if (options.method === "POST") {
      sent.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ id: "resp_new0000001", status: "queued" }) };
    }
    return { ok: true, json: async () => answers[url.split("/").pop()] };
  };
  try {
    const config = { openAiApiKey: "test", openAiModel: "weak-model", contentAgentModel: "gpt-5-test" };
    const job = await startStructured(config, { input: [], schemaName: "x", schema: {}, reasoningEffort: "high", writing: true });
    assert.deepEqual(job, { id: "resp_new0000001", model: "gpt-5-test" });
    assert.equal(sent[0].background, true);
    assert.equal(sent[0].model, "gpt-5-test");
    assert.deepEqual(sent[0].reasoning, { effort: "high" });
    assert.equal((await readStructured(config, "resp_pending01")).pending, true);
    const failed = await readStructured(config, "resp_failed001");
    assert.equal(failed.failed, true);
    assert.match(failed.error, /server_error/);
    assert.deepEqual(await readStructured(config, "resp_done00001"), { status: "completed", parsed: { candidates: [] }, model: "gpt-5-test" });
  } finally {
    global.fetch = original;
  }
});

test("the route starts two writers on medium and an editor on high as background jobs the screen polls", () => {
  const api = read("api", "klaviyo", "subject-lines.js");
  assert.match(api, /const WRITERS = 2;/);
  assert.match(api, /const WRITER_EFFORT = "medium";/);
  assert.match(api, /const EDITOR_EFFORT = "high";/);
  assert.match(api, /startStructured\(config, buildWritingRequest\(\{[\s\S]{0,400}reasoningEffort: WRITER_EFFORT/);
  assert.match(api, /startStructured\(config, buildEditingRequest\(\{[\s\S]{0,400}reasoningEffort: EDITOR_EFFORT/);
  assert.match(api, /if \(action === "edit"\) return await handleEdit\(/);
  assert.match(api, /if \(action === "poll"\) return await handlePoll\(/);
  // A pending poll answers without reading the template or the history.
  assert.match(api, /if \(states\.some\(\(state\) => state\.pending\)\) return sendJson\(res, 200, \{ done: false/);
  // One writer failing still leaves drafts; the rules' verdict is worked out on the server again.
  assert.match(api, /Promise\.allSettled/);
  assert.match(api, /The rules' verdict on each draft is worked out here again/);
  // Only OpenAI response ids are polled.
  assert.match(api, /const JOB_ID = \/\^resp_/);
});

test("the screen drafts, then edits, names each stage with a clock, and says so if the editor fails", () => {
  const moduleJs = read("src", "klaviyo-subject-lines.js");
  assert.match(moduleJs, /callSubjectLines\("generate"[\s\S]{0,200}waitForJobs\("write"[\s\S]{0,800}callSubjectLines\("edit"[\s\S]{0,200}waitForJobs\("edit"/);
  assert.match(moduleJs, /callSubjectLines\("poll"/);
  // A dropped poll is a blip; three in a row is a failure.
  assert.match(moduleJs, /if \(misses >= 3/);
  assert.match(moduleJs, /these are the two writers' drafts, unedited/);
  assert.match(moduleJs, /edit: \["Edit", "The editor is choosing the best"/);
  assert.match(moduleJs, /data-subject-elapsed/);
  assert.doesNotMatch(moduleJs, /Usually half a minute/);
});
