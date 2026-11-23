const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const survey = require("../server/survey/customer-survey");

const ok = (extra = {}) => Object.assign({ reason: "competitor", k: "ab12cd34", store: "eur_eu_ger", lang: "en", followup: "Cheaper", contact: "yes", ms: 9000 }, extra);

test("a valid answer keeps only known fields", () => {
  const { record } = survey.sanitizeSubmission(ok({ email: "a@b.dk", evil: "<script>" }), { now: Date.parse("2026-11-13T10:00:00Z") });
  assert.equal(record.reason, "competitor");
  assert.equal(record.token, "ab12cd34");
  assert.equal(record.store, "eur_eu_ger");
  assert.equal(record.contact, "yes");
  assert.equal(record.evil, undefined);
  assert.equal(record.at, "2026-11-13T10:00:00.000Z");
});

test("an e-mail is kept only when the person asked to be contacted - with a personal link too", () => {
  // the page asks everyone who says yes where to reply, so it never shows that a link told us who they are (23/11)
  assert.equal(survey.sanitizeSubmission(ok({ email: "a@b.dk" })).record.email, "a@b.dk");
  assert.equal(survey.sanitizeSubmission(ok({ k: "", email: "kunde@firma.dk" })).record.email, "kunde@firma.dk");
  assert.equal(survey.sanitizeSubmission(ok({ contact: "no", email: "kunde@firma.dk" })).record.email, undefined);
  assert.equal(survey.sanitizeSubmission(ok({ k: "", email: "not an address" })).record.email, undefined);
});

test("the store's newsletter popup never shows over the survey, and never locks the page", () => {
  // 23/11: Klaviyo's full-screen popup ("The Insert") opened ~5 s in, took the keyboard (38-62 typed letters lost in DK,
  // DE and PL) and locked scrolling. Hiding it any weaker way fails: Klaviyo's CSS sets every element inside it visible,
  // its focus guards then take the keyboard, an inert close button ignores a click, and clicking close brings a teaser
  // that takes the focus in turn. Checked on the live page: tmp/playwright-runner/survey-focus-probe.js --local.
  const html = fs.readFileSync(path.join(ROOT, "templates", "customer-feedback-survey", "survey.html"), "utf8");
  assert.ok(html.includes('quiet.textContent = "div[data-kl-scroll-locking-modal]{display:none!important}";'), "Klaviyo's full-screen popup is kept out of the layout");
  assert.ok(html.includes('document.body.classList.remove("klaviyo-prevent-body-scrolling")'), "Klaviyo's scroll lock is taken off");
  assert.ok(html.includes('new MutationObserver(unlock).observe(document.body, { attributes: true, attributeFilter: ["class"] })'), "whenever Klaviyo puts it back");
  assert.equal(/klaviyo-close-form|\.inert\b/.test(html), false, "the popup is kept out, not fought");
});

test("the page never tells the visitor we know who they are", () => {
  // the user, 2026-11-23: "Vi skal ikke fortælle kunden at vi ved hvem de er"
  const html = fs.readFileSync(path.join(ROOT, "templates", "customer-feedback-survey", "survey.html"), "utf8");
  assert.equal(/action=who/.test(html), false, "the page does not look up whose link it is");
  assert.equal(/\{firma\}|data-hi/.test(html), false, "no greeting or thanks by company name");
  const STR = Function(`return ${html.match(/var STR = (\{[\s\S]*?\n  \});/)[1]}`)();
  for (const [lang, t] of Object.entries(STR)) {
    assert.equal(/hvilken kunde|which customer|via et link|through a link/i.test(Object.values(t).join(" ")), false, `${lang}: nothing about seeing who answered`);
  }
  assert.match(html, /if \(c === "yes"\) \{ q\("\[data-emailbox\]"\)\.hidden = false;/, "a yes always asks where to reply");
});

test("unknown reasons are refused; bots are swallowed, not refused", () => {
  assert.ok(survey.sanitizeSubmission(ok({ reason: "x" })).error);
  assert.equal(survey.sanitizeSubmission(ok({ hp: "http://spam" })).drop, "honeypot");
  assert.equal(survey.sanitizeSubmission(ok({ ms: 300 })).drop, "too_fast");
});

test("texts are capped and stripped of control characters; emoji stay, half of one does not", () => {
  const { record } = survey.sanitizeSubmission(ok({ followup: "a\u0000b" + "x".repeat(3000) + "\u{1F600}" }));
  assert.equal(record.followup.includes("\u0000"), false);
  assert.equal(record.followup.length, 1500);
  // found by the live end-to-end test on 23/11: a customer's emoji was removed from the answer
  const r2 = survey.sanitizeSubmission(ok({ followup: "god \u{1F600} service, æøå ł ő" })).record;
  assert.equal(r2.followup, "god \u{1F600} service, æøå ł ő");
  // the cap falls in the middle of an emoji: the half left over goes, the text stays valid
  const cut = survey.sanitizeSubmission(ok({ followup: "x".repeat(1499) + "\u{1F600}" })).record.followup;
  assert.equal(cut, "x".repeat(1499));
  assert.equal(survey.sanitizeSubmission(ok({ followup: "lone \uD83D half and \uDE00 tail" })).record.followup, "lone  half and  tail");
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
    { token: "ab12cd34", firma: "A", email: "x@y.dk", telefon: "+45 1234", link: "https://www.westpack.com/dkk_dk_den/customer-survey-2026#k=ab12cd34" },
    { token: "AB12CD34", firma: "dup" },
    { token: "bad token" },
    { token: "cd34ef56", link: "https://evil.example/x" },
    // the survey was a blog post until 23/11: a link made then still reads
    { token: "ef56ab12", link: "https://www.westpack.com/gbp_uk_eng/blog/customer-feedback-2026#k=ef56ab12" },
  ]);
  assert.equal(recipients.length, 3);
  assert.equal(recipients[0].email, undefined);
  assert.equal(recipients[0].telefon, undefined);
  assert.equal(recipients[0].link, "https://www.westpack.com/dkk_dk_den/customer-survey-2026#k=ab12cd34");
  assert.equal(recipients[1].link, "");
  assert.equal(recipients[2].link, "https://www.westpack.com/gbp_uk_eng/blog/customer-feedback-2026#k=ef56ab12");
});

test("the page greets a company as a person would write it", () => {
  assert.equal(survey.greetingName("Guldsmed Hugo Mortensen Aps"), "Guldsmed Hugo Mortensen");
  assert.equal(survey.greetingName("Irbis Sp. z o.o."), "Irbis");
  assert.equal(survey.greetingName("ROUGEMONT"), "ROUGEMONT", "a registered name keeps its own capitals");
  // name-print turns these away from a public image; on the page they are our customers' own names
  assert.equal(survey.greetingName("Fatima.dk"), "Fatima.dk");
  assert.equal(survey.greetingName("durch dick und dünn - Bridal Store"), "durch dick und dünn - Bridal Store");
  assert.equal(survey.greetingName("Smykkehuset ved Torvet i Holstebro og Omegn ApS"), "Smykkehuset ved Torvet i Holstebro og Omegn", "no lid to fit on");
  for (const none of ["-", "", "sashastrends@gmail.com", "  "]) assert.equal(survey.greetingName(none), "", none);
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

test("the block can be pasted into a Magento page and posts to the survey route", () => {
  const html = fs.readFileSync(path.join(ROOT, "templates", "customer-feedback-survey", "survey.html"), "utf8");
  assert.equal(/[\u{10000}-\u{10FFFF}]/u.test(html), false, "no 4-byte characters: the store database is utf8mb3");
  assert.ok(Buffer.byteLength(html) < 62 * 1024, "under ~62 KB");
  assert.match(html, /data-api="https:\/\/project-4fcxa\.vercel\.app\/api\/survey"/);
  assert.match(html, /\?action=submit/);
  assert.match(html, /text\/plain/, "a simple request, so the browser sends no preflight");
  // the token is read from the hash (the blog drops query strings); run the block's own pattern, not a copy of it
  const tokenRe = new Function(`return ${html.match(/var m = (\/\(\?:\^\|\[#&\]\)k=[^\n]*?\/i)\.exec\(location\.hash/)[1]};`)();
  const read = (hash) => { const m = tokenRe.exec(hash); return m ? m[1].toLowerCase() : ""; };
  assert.equal(read("#k=test"), "test", "#k=test must reach the server as a test answer, not as an anonymous real one");
  assert.equal(read("#k=AB12cd34"), "ab12cd34");
  assert.equal(read("#x=1&k=f4c0b83ea7"), "f4c0b83ea7");
  assert.equal(read("#k=tester"), "tester", "a code that merely starts with test is a code");
  assert.equal(read("#k=abc"), "", "too short for a code");
  assert.equal(read("#k=" + "a".repeat(17)), "", "too long for a code");
  // every rule is anchored on the block's id, since the theme's post typography beats class selectors
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1]
    .replace(/@import url\([^)]*\);/g, "")
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  assert.equal(/@import/.test(html.replace(/@import url\('https:\/\/fonts\.googleapis\.com\/[^']*'\);/, "")), false, "the only import is the blog's own fonts");
  for (const rule of css.replace(/@(container|media)[^{]*\{/g, "").split("}").map((s) => s.split("{")[0].trim()).filter(Boolean)) {
    for (const sel of rule.split(",")) assert.match(sel.trim(), /^#wpfb\b/, `unanchored selector: ${sel}`);
  }
  // The survey is a CMS page since 23/11 (the user: the blog's categories and tags around it "ligner lort"). The
  // theme paints every h1/h2 as a red gradient clipped to the text: the page title (a small overline) must undo that,
  // or its fill is the theme's gradient, and the question sets the store's red itself rather than inheriting it.
  assert.match(css, /#wpfb \.wpfb-title\{[^}]*-webkit-text-fill-color:var\(--red\);background:none/);
  assert.match(css, /#wpfb \.wpfb-h\{[^}]*background-clip:text[^}]*-webkit-text-fill-color:transparent/);
  assert.match(html, /<h1 class="wpfb-title" data-t="title">/, "the page's one h1: CMS pages on this theme show no title of their own");
  // the photograph is Westpack's own and permanently hosted (Klaviyo's image library or the store's CDN), never an
  // Asana link, which dies within the hour
  const photos = html.match(/https:\/\/[^\s",]+\.jpe?g[^\s",]*/g) || [];
  assert.ok(photos.length >= 1);
  for (const src of photos) assert.match(src, /^https:\/\/(cdn\.klaviyomail\.com\/company\/|westpack\.b-cdn\.net\/media\/)/);
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

test("a slow first save arriving after the last does not undo a finished answer", () => {
  const responses = [
    // the customer finished at 09:00:05; the first save (cold start) reached the server at 09:00:07
    { sid: "visit0003cc", token: "ab12cd34", at: "2026-11-24T09:00:05Z", followup: "For dyrt fragt", contact: "yes", step: 3 },
    { sid: "visit0003cc", token: "ab12cd34", at: "2026-11-24T09:00:07Z", followup: "For dyrt fragt", contact: "", step: 1 },
    // went back, rewrote, left before the contact question: the newest words of that visit count
    { sid: "visit0004dd", token: null, at: "2026-11-24T10:00:00Z", followup: "Første udkast", step: 1 },
    { sid: "visit0004dd", token: null, at: "2026-11-24T10:01:00Z", followup: "Andet udkast", step: 1 },
  ];
  const s = survey.summarize({ responses, recipients: [{ token: "ab12cd34", firma: "A" }] });
  const a = s.answers.find((x) => x.sid === "visit0003cc");
  assert.equal(a.step, 3);
  assert.equal(a.contact, "yes");
  assert.equal(s.totals.finished, 1);
  assert.equal(s.totals.wantsContact, 1);
  assert.equal(s.answers.find((x) => x.sid === "visit0004dd").followup, "Andet udkast");
  // a customer's later visit still wins over an earlier finished one, timed by its last save
  const later = survey.summarize({ responses: [...responses, { sid: "visit0005ee", token: "ab12cd34", at: "2026-11-25T08:00:00Z", followup: "Ny grund", step: 1 }] });
  assert.equal(later.answers.find((x) => x.token === "ab12cd34").followup, "Ny grund");
});

test("Blob: a failed write or read gets a second try; a file that still fails is counted, not dropped", async () => {
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  const realFetch = global.fetch;
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_unitstore_secret";
  const store = require("../server/survey/survey-store");
  const tries = {};
  const reply = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if ((opts.method || "GET") === "PUT") { tries.put = (tries.put || 0) + 1; return reply(tries.put === 1 ? 503 : 200, {}); }
    if (u.startsWith("https://vercel.com/api/blob?")) return reply(200, { blobs: ["a", "b", "c", "d", "e"].map((n) => ({ pathname: `surveys/x/responses/${n}.json` })), hasMore: false });
    const name = u.match(/responses\/(\w)\.json/)[1];
    tries[name] = (tries[name] || 0) + 1;
    if (name === "b" && tries.b === 1) return reply(500, "");
    if (name === "c") return reply(500, "");
    if (name === "d") return reply(200, "{not json");
    if (name === "e") return reply(404, "");
    return reply(200, { followup: `answer ${name}` });
  };
  try {
    await store.writeResponse("x", { followup: "hej" });
    assert.equal(tries.put, 2, "the write was tried again after a 503");
    const { records, unreadable } = await store.readResponseFiles("x");
    assert.deepEqual(records.map((r) => r.followup).sort(), ["answer a", "answer b"], "b came on the second try");
    assert.equal(unreadable, 2, "c (500 twice) and d (not JSON) are counted; e (deleted since the list) is not");
    assert.equal(tries.c, 2);
  } finally {
    global.fetch = realFetch;
    if (saved) process.env.BLOB_READ_WRITE_TOKEN = saved; else delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});

test("biblen is told when saved answers could not be read, and the post retries its first save", () => {
  const api = fs.readFileSync(path.join(ROOT, "api", "survey.js"), "utf8");
  const view = fs.readFileSync(path.join(ROOT, "src", "customer-survey.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "templates", "customer-feedback-survey", "survey.html"), "utf8");
  assert.match(api, /readResponseFiles\(/);
  assert.match(api, /unreadable: files\.unreadable/);
  assert.match(view, /state\.data\.unreadable \?/);
  assert.match(html, /save\(1\)\.catch\(function \(\) \{ setTimeout\(function \(\) \{ if \(S\.step < 3\) save\(1\)/);
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(vercel.functions["api/survey.js"].maxDuration >= 60, "reading every answer file needs more than the default time");
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

test("mark as test: a visit by its id, an older answer by its time; nothing else, and never twice", async () => {
  assert.ok(survey.sanitizeMarkTest({}).error);
  assert.ok(survey.sanitizeMarkTest({ answers: [{ sid: "x" }] }).error, "neither a visit id nor a time");
  assert.ok(survey.sanitizeMarkTest({ answers: Array.from({ length: 101 }, () => ({ sid: "abcdefgh12" })) }).error);
  const sel = survey.sanitizeMarkTest({ answers: [{ sid: "RM1TVCI1YNYDWQ6Q" }, { at: "2026-11-13T08:51:25.326Z" }] });
  assert.equal(sel.error, undefined);
  assert.equal(survey.isMarkedBy({ sid: "rm1tvci1ynydwq6q", at: "2026-11-23T07:26:52.476Z" }, sel), true);
  assert.equal(survey.isMarkedBy({ sid: null, at: "2026-11-13T08:51:25.326Z" }, sel), true);
  assert.equal(survey.isMarkedBy({ sid: "othervisit1", at: "2026-11-13T08:51:25.326Z" }, sel), false, "a visit with an id is never marked by its time");
  assert.equal(survey.isMarkedBy({ sid: "rm1tvci1ynydwq6q", test: true }, sel), false, "already a test");

  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const store = require("../server/survey/survey-store");
  const id = `unit-mark-${process.pid}-${Date.now()}`;
  try {
    await store.writeResponse(id, { sid: "rm1tvci1ynydwq6q", at: "2026-11-23T07:26:50.000Z", followup: "save 1", test: false }, 1);
    await store.writeResponse(id, { sid: "rm1tvci1ynydwq6q", at: "2026-11-23T07:26:52.476Z", followup: "save 2", test: false }, 2);
    await store.writeResponse(id, { sid: "customervisit1", at: "2026-11-23T09:00:00.000Z", followup: "a customer", test: false }, 3);
    const out = await store.markResponsesTest(id, (r) => survey.isMarkedBy(r, sel));
    assert.deepEqual(out, { marked: 2, files: 3 });
    const after = await store.readResponses(id);
    assert.equal(after.length, 3, "nothing deleted");
    assert.deepEqual(after.filter((r) => r.test).map((r) => r.followup).sort(), ["save 1", "save 2"]);
    assert.equal(survey.summarize({ responses: after }).totals.answers, 1, "only the customer still counts");
    assert.equal(survey.summarize({ responses: after, includeTest: true }).totals.answers, 2);
  } finally {
    if (saved) process.env.BLOB_READ_WRITE_TOKEN = saved;
    fs.rmSync(path.join(ROOT, "tmp", "surveys", id), { recursive: true, force: true });
  }
});

test("the app view can mark an answer as a test, and says nothing is deleted", () => {
  const view = fs.readFileSync(path.join(ROOT, "src", "customer-survey.js"), "utf8");
  assert.match(view, /data-survey-mark-test/);
  assert.match(view, /action=mark_test/);
  assert.match(view, /Nothing is deleted/);
  const route = fs.readFileSync(path.join(ROOT, "api", "survey.js"), "utf8");
  assert.ok(route.indexOf('action === "mark_test"') > route.indexOf("requireAuth(req, res, config)"), "marking needs a login");
});
