const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const survey = require("../server/survey/customer-survey");

const ok = (extra = {}) => Object.assign({ reason: "competitor", k: "ab12cd34", store: "eur_eu_ger", lang: "en", followup: "Cheaper", contact: "yes", ms: 9000 }, extra);

test("a valid answer keeps only known fields, and a personal link drops any e-mail", () => {
  const { record } = survey.sanitizeSubmission(ok({ email: "a@b.dk", evil: "<script>" }), { now: Date.parse("2026-11-13T10:00:00Z") });
  assert.equal(record.reason, "competitor");
  assert.equal(record.token, "ab12cd34");
  assert.equal(record.store, "eur_eu_ger");
  assert.equal(record.contact, "yes");
  assert.equal(record.email, undefined);
  assert.equal(record.evil, undefined);
  assert.equal(record.at, "2026-11-13T10:00:00.000Z");
});

test("an answer without a link keeps the e-mail only when the person asked to be contacted", () => {
  assert.equal(survey.sanitizeSubmission(ok({ k: "", email: "kunde@firma.dk" })).record.email, "kunde@firma.dk");
  assert.equal(survey.sanitizeSubmission(ok({ k: "", contact: "no", email: "kunde@firma.dk" })).record.email, undefined);
  assert.equal(survey.sanitizeSubmission(ok({ k: "", email: "not an address" })).record.email, undefined);
});

test("unknown reasons are refused; bots are swallowed, not refused", () => {
  assert.ok(survey.sanitizeSubmission(ok({ reason: "x" })).error);
  assert.equal(survey.sanitizeSubmission(ok({ hp: "http://spam" })).drop, "honeypot");
  assert.equal(survey.sanitizeSubmission(ok({ ms: 300 })).drop, "too_fast");
});

test("texts are capped and stripped of control characters and 4-byte characters", () => {
  const { record } = survey.sanitizeSubmission(ok({ followup: "a\u0000b" + "x".repeat(3000) + "\u{1F600}" }));
  assert.equal(record.followup.includes("\u0000"), false);
  assert.equal(record.followup.length, 1500);
  const r2 = survey.sanitizeSubmission(ok({ followup: "god \u{1F600} service" })).record;
  assert.equal(/[\uD800-\uDFFF]/.test(r2.followup), false);
  assert.equal(survey.sanitizeSubmission(ok({ reason: "competitor", other: "ignored" })).record.other, "");
  assert.equal(survey.sanitizeSubmission(ok({ reason: "other", other: "Lukket" })).record.other, "Lukket");
});

test("the test token marks a test answer, and a malformed token is dropped, not trusted", () => {
  const t = survey.sanitizeSubmission(ok({ k: "test" })).record;
  assert.equal(t.test, true);
  assert.equal(t.token, null);
  assert.equal(survey.sanitizeSubmission(ok({ k: "../../x" })).record.token, null);
});

test("a customer answering twice counts once, on the latest answer; tests are left out", () => {
  const recipients = [{ token: "ab12cd34", firma: "Firma A" }, { token: "zz99yy88", firma: "Firma B" }];
  const responses = [
    { token: "ab12cd34", at: "2026-11-13T09:00:00Z", reason: "price" },
    { token: "ab12cd34", at: "2026-11-13T10:00:00Z", reason: "stock", contact: "yes" },
    { token: null, at: "2026-11-13T11:00:00Z", reason: "stock" },
    { token: null, test: true, at: "2026-11-13T12:00:00Z", reason: "price" },
  ];
  const s = survey.summarize({ responses, recipients });
  assert.equal(s.totals.answers, 2);
  assert.equal(s.totals.fromRecipients, 1);
  assert.equal(s.totals.anonymous, 1);
  assert.equal(s.totals.wantsContact, 1);
  assert.equal(s.reasons.find((r) => r.id === "stock").count, 2);
  assert.equal(s.reasons.find((r) => r.id === "price").count, 0);
  assert.deepEqual(s.answered, ["ab12cd34"]);
  assert.equal(survey.summarize({ responses, recipients, includeTest: true }).totals.answers, 3);
});

test("the recipient list keeps no e-mail or phone, and refuses bad tokens and links", () => {
  const { recipients } = survey.sanitizeRecipients([
    { token: "ab12cd34", firma: "A", email: "x@y.dk", telefon: "+45 1234", link: "https://www.westpack.com/dkk_dk_den/blog/customer-feedback-2026#k=ab12cd34" },
    { token: "AB12CD34", firma: "dup" },
    { token: "bad token" },
    { token: "cd34ef56", link: "https://evil.example/x" },
  ]);
  assert.equal(recipients.length, 2);
  assert.equal(recipients[0].email, undefined);
  assert.equal(recipients[0].telefon, undefined);
  assert.equal(recipients[1].link, "");
});

function call(handler, { method = "GET", url, body, origin = "https://www.westpack.com", cookie = "" }) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
      getHeader: (k) => headers[k.toLowerCase()],
      end: (text) => resolve({ status: res.statusCode, headers, json: text ? JSON.parse(text) : null }),
    };
    handler({ method, url, headers: { origin, cookie }, body }, res);
  });
}

test("the route: a store answer is public, results are not", async () => {
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "survey-"));
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const store = require("../server/survey/survey-store");
  const handler = require("../api/survey");
  const realWrite = store.writeResponse;
  const written = [];
  store.writeResponse = async (s, r) => { written.push(r); return { mode: "test" }; };
  try {
    const r = await call(handler, { method: "POST", url: "/api/survey?action=submit", body: JSON.stringify(ok()) });
    assert.equal(r.status, 200);
    assert.equal(r.headers["access-control-allow-origin"], "https://www.westpack.com");
    assert.equal(written.length, 1);
    assert.equal(written[0].origin, "store");
    const bad = await call(handler, { method: "POST", url: "/api/survey?action=submit", body: JSON.stringify(ok({ reason: "nope" })) });
    assert.equal(bad.status, 400);
    const results = await call(handler, { url: "/api/survey?action=results" });
    if (require("../server/lib/auth").isAuthEnabled(require("../server/lib/config").getConfig())) assert.equal(results.status, 401);
  } finally {
    store.writeResponse = realWrite;
    if (saved) process.env.BLOB_READ_WRITE_TOKEN = saved;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the blog block can be pasted into Magento and posts to the survey route", () => {
  const html = fs.readFileSync(path.join(ROOT, "templates", "customer-feedback-survey", "survey.html"), "utf8");
  assert.equal(/[\u{10000}-\u{10FFFF}]/u.test(html), false, "no 4-byte characters: the store database is utf8mb3");
  assert.ok(Buffer.byteLength(html) < 62 * 1024, "under ~62 KB");
  assert.match(html, /data-api="https:\/\/project-4fcxa\.vercel\.app\/api\/survey"/);
  assert.match(html, /\?action=submit/);
  assert.match(html, /text\/plain/, "a simple request, so the browser sends no preflight");
  assert.match(html, /k=\(\[a-z0-9\]\{6,16\}\)/, "the token is read from the hash: the blog drops query strings");
  // every rule is anchored on the block's id, since the theme's post typography beats class selectors
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1]
    .replace(/@import url\([^)]*\);/g, "")
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  assert.equal(/@import/.test(html.replace(/@import url\('https:\/\/fonts\.googleapis\.com\/[^']*'\);/, "")), false, "the only import is the blog's own fonts");
  for (const rule of css.replace(/@(container|media)[^{]*\{/g, "").split("}").map((s) => s.split("{")[0].trim()).filter(Boolean)) {
    for (const sel of rule.split(",")) assert.match(sel.trim(), /^#wpfb\b/, `unanchored selector: ${sel}`);
  }
  // every language has every string
  const strBlock = html.match(/var STR = (\{[\s\S]*?\n  \});/)[1];
  const STR = Function(`return ${strBlock}`)();
  const keys = Object.keys(STR.da).sort();
  for (const [lang, table] of Object.entries(STR)) assert.deepEqual(Object.keys(table).sort(), keys, `${lang} has every string`);
});

test("the app view is reachable from the Klaviyo rail", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const domain = fs.readFileSync(path.join(ROOT, "src", "klaviyo-dashboard-domain.js"), "utf8");
  assert.match(index, /data-klaviyo-view="customer_survey"/);
  assert.match(index, /id="klaviyo-customer-survey-panel"/);
  assert.match(app, /"customer_survey"\]\.includes\(nextView\)/);
  assert.match(app, /loadCustomerSurvey\(\)/);
  assert.match(domain, /"customer_survey"\]\.includes\(appState\.klaviyoView\)/);
});

test("question 2's one-tap answers: only those for the reason, once each; stock takes one", () => {
  const r = survey.sanitizeSubmission(ok({ reason: "competitor", details: ["price", "speed", "price", "bogus", "closed"] })).record;
  assert.deepEqual(r.details, ["price", "speed"]);
  assert.deepEqual(survey.sanitizeSubmission(ok({ reason: "stock", details: ["within_3m", "later"] })).record.details, ["within_3m"]);
  assert.deepEqual(survey.sanitizeSubmission(ok({ reason: "other", details: ["price"] })).record.details, []);
  assert.equal(survey.sanitizeSubmission(ok({ step: 1 })).record.step, 1);
  assert.equal(survey.sanitizeSubmission(ok({ step: 9 })).record.step, 3);
});

test("a visit saved after every question is one answer, on its latest save", () => {
  const responses = [
    { sid: "visit0001aa", token: null, at: "2026-11-13T09:00:00Z", reason: "competitor", details: [], step: 1 },
    { sid: "visit0001aa", token: null, at: "2026-11-13T09:00:20Z", reason: "competitor", details: ["price", "moq"], step: 2 },
    { sid: "visit0001aa", token: null, at: "2026-11-13T09:00:30Z", reason: "competitor", details: ["price", "moq"], contact: "no", step: 3 },
    { sid: "visit0002bb", token: null, at: "2026-11-13T10:00:00Z", reason: "stock", details: ["later"], step: 2 },
  ];
  const s = survey.summarize({ responses });
  assert.equal(s.totals.answers, 2);
  assert.equal(s.totals.finished, 1);
  const competitor = s.reasons.find((r) => r.id === "competitor");
  assert.equal(competitor.count, 1);
  assert.equal(competitor.details.find((d) => d.id === "price").count, 1);
  assert.deepEqual(s.answers.find((a) => a.sid === "visit0001aa").detailLabels, ["Lower price", "Lower minimum order"]);
});

test("the post asks for a written answer: no options to pick, and words are required", () => {
  const html = fs.readFileSync(path.join(ROOT, "templates", "customer-feedback-survey", "survey.html"), "utf8");
  // the user, 2026-11-13: "skrevne og specifikke svar ... har mere værdi" - nothing to choose from instead of writing
  assert.equal(/name="reason"|name="detail"|wpfb-tile|wpfb-chip/.test(html), false, "no options to pick");
  assert.match(html, /<textarea name="answer"/);
  assert.match(html, /followup: S\.text/, "the words are sent as the answer");
  assert.match(html, /MIN_CHARS = \d+/, "a sentence is asked for before it can be sent");
  assert.match(html, /keepalive: true/, "a save survives the visitor leaving the page");
  // no example answers: examples get copied instead of the customer's own reason
  const STR = Function(`return ${html.match(/var STR = (\{[\s\S]*?\n  \});/)[1]}`)();
  assert.equal(/fx |e\.g\.|for example/i.test(STR.da.placeholder + STR.en.placeholder), false);
  // the server takes an answer without a reason, but never one without words
  const written = survey.sanitizeSubmission({ followup: "Vi fandt en leverandør med lavere minimum", sid: "visit0003cc", step: 1, ms: 30000 });
  assert.equal(written.record.reason, "");
  assert.equal(written.record.followup, "Vi fandt en leverandør med lavere minimum");
  assert.ok(survey.sanitizeSubmission({ followup: "  ", ms: 30000 }).error);
  const s = survey.summarize({ responses: [written.record] });
  assert.equal(s.totals.written, 1);
  assert.equal(s.reasons.every((r) => r.count === 0), true, "a written answer is not counted under any reason");
});
