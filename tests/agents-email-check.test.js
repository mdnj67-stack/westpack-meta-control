const test = require("node:test");
const assert = require("node:assert/strict");

const { analyseEmailHtml, buildReviewInput, finalizeReview } = require("../server/agents/email-check");

// A minimal email that passes every instant check, so each test can break exactly one thing.
function email(body = "", { head = "" } = {}) {
  return `<!DOCTYPE html><html><head><meta name="color-scheme" content="light dark"><style>@media (max-width: 600px) { .x { width: 100% } }</style>${head}</head>
<body><table><tr><td>${body}</td></tr>
<tr><td><a href="{% unsubscribe_url %}">Afmeld</a></td></tr></table></body></html>`;
}

function checks(html, country = "DK") {
  return analyseEmailHtml({ html, country }).findings;
}

function ids(findings) {
  return findings.map((item) => `${item.check}:${item.severity}`);
}

test("a clean email has no findings", () => {
  assert.deepEqual(checks(email('<p>Find æsken til jeres næste kampagne.</p><a href="{{ organization.url }}smykkeaesker.html">Se æskerne</a><img src="https://d3k81ch9hvuctc.cloudfront.net/a.jpg" alt="Smykkeæske">')), []);
});

test("an absolute store link must be fixed: every market would land in the Danish store", () => {
  const findings = checks(email('<a href="https://www.westpack.com/dkk_dk_den/smykkeaesker.html">Se</a>'));
  assert.deepEqual(ids(findings), ["store_links:must_fix"]);
  assert.match(findings[0].fix, /\{\{ organization\.url \}\}/);
});

test("images: an Asana link expires, a data URI is blocked, a missing alt shows an empty box", () => {
  const findings = checks(email([
    '<img src="https://asanausercontent.com/us1/assets/1/2/c4272d" alt="x">',
    '<img src="data:image/png;base64,AAAA" alt="y">',
    '<img src="https://d3k81ch9hvuctc.cloudfront.net/b.jpg">',
    '<img src="https://track.example.com/p.gif" width="1" height="1">'
  ].join("")));
  assert.deepEqual(ids(findings).sort(), ["expiring_images:must_fix", "image_alt:should_fix", "inline_images:must_fix"]);
});

test("rendering: a <link> stylesheet, Gmail's 102 KB limit and a missing unsubscribe are must-fix", () => {
  const link = checks(email("<p>Hej</p>", { head: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton">' }));
  assert.ok(ids(link).includes("link_tags:must_fix"));
  assert.match(link.find((item) => item.check === "link_tags").fix, /@import/);

  const big = checks(email(`<p>${"x".repeat(105 * 1024)}</p>`));
  assert.ok(ids(big).includes("gmail_size:must_fix"));
  const nearly = checks(email(`<p>${"x".repeat(92 * 1024)}</p>`));
  assert.ok(ids(nearly).includes("gmail_size:should_fix"));

  const noUnsubscribe = analyseEmailHtml({ html: "<html><head><style>@media (max-width:600px){}</style><meta name=color-scheme></head><body><p>Hej</p></body></html>" }).findings;
  assert.deepEqual(ids(noUnsubscribe), ["unsubscribe:must_fix"]);
});

test("in the Danish master, copy that shares a fragment with a Klaviyo tag is flagged - it ships in Danish everywhere", () => {
  const findings = checks(email("<p>Hej {{ first_name|default:'' }},</p><p>{% if person.is_vip %}</p>"));
  assert.deepEqual(ids(findings), ["tag_fragment:should_fix"]);
  assert.match(findings[0].detail, /"Hej ,"/);
  assert.deepEqual(checks(email("<p>Hallo {{ first_name }},</p>"), "DE").filter((item) => item.check === "tag_fragment"), []);
});

test("a series name standing alone needs translate=\"no\", or Vienna becomes Wien", () => {
  assert.deepEqual(ids(checks(email("<td>Vienna</td>"))), ["series_name:should_fix"]);
  assert.deepEqual(checks(email('<td translate="no">Vienna</td>')), []);
  assert.deepEqual(checks(email("<p>Vienna-æsken findes i fire størrelser.</p>")), []);
});

test("a translated version: Danish left behind, and the market's form of address", () => {
  const german = checks(email('<p>Entdecken Sie die Schachteln.</p><p>Se æskerne her</p><img src="https://d3k81ch9hvuctc.cloudfront.net/a.jpg" alt="Smykkeæske">'), "DE");
  assert.deepEqual(ids(german), ["danish_left:must_fix"]);
  const informal = checks(email("<p>Entdecken Sie die Schachteln. Hast du schon dein Logo?</p>"), "DE");
  assert.deepEqual(ids(informal), ["form_of_address:must_fix"]);
  assert.match(informal[0].detail, /Sie/);
  assert.deepEqual(checks(email("<p>Se esken her, og bestill før fristen.</p><p>Vær rask.</p>"), "NO"), [], "Norwegian has æ and ø of its own");
});

test("house rules run over the body: free samples and a delivery promise are must-fix", () => {
  const findings = checks(email("<p>Bestil gratis prøver i dag.</p><p>Få æskerne leveret på 3 dage.</p>"));
  assert.deepEqual(ids(findings).sort(), ["rule_delivery_promise:must_fix", "rule_free_samples:must_fix"]);
});

test("the house's own approved wording is not flagged (found in real sends on 2026-10-30)", () => {
  const approved = [
    "<p>FSC® er miljømærket for ansvarligt skovbrug. www.fsc.org.</p>",
    "<p>Vores FSC licens nummer er FSC®C112509.</p>",
    "<p>De første anbefalede frister for ordrer med tryk falder allerede 10. december – og de er forskellige fra land til land.</p>",
    "<p>4–5 hverdage er produktion. Levering inden jul kan ikke garanteres.</p>"
  ].join("");
  assert.deepEqual(checks(email(approved)), []);
});

test("a single deadline date for every market is still caught", () => {
  assert.deepEqual(ids(checks(email("<p>Bestil senest 16. december.</p>"))), ["rule_single_date:must_fix"]);
});

test("a watch box is a question, not an error: the rule is about the plastic series", () => {
  const findings = checks(email("<p>Gælder den store halskædeæske og uræsken.</p>"));
  assert.deepEqual(ids(findings), ["rule_watch_box:consider"]);
});

test("the review is told the market's language, its form of address and the site's facts", () => {
  const input = buildReviewInput({ text: "Entdecken Sie", html: email("<p>Entdecken Sie</p>"), country: "DE", name: "W46 | DE", siteFacts: "Samples: freight is charged." });
  const all = input.map((message) => message.content).join("\n");
  assert.match(all, /written in German/);
  assert.match(all, /Sie \/ Ihr \/ Ihnen/);
  assert.match(all, /Samples: freight is charged\./);
  assert.match(all, /quote the email exactly/);
});

test("what the first live review got wrong is written into its instructions (2026-10-30)", () => {
  const all = buildReviewInput({ text: "x", html: email("<p>x</p>"), country: "DK", name: "W46", siteFacts: "" }).map((message) => message.content).join("\n");
  assert.match(all, /De første anbefalede frister for ordrer med tryk falder allerede 10\. december – og de er forskellige fra land til land\./, "the approved deadline wording");
  assert.match(all, /locked Westpack footer is legal boilerplate/);
  assert.match(all, /Kevin ROIberg emails are deliberately absurd/);
  assert.match(all, /a claim the site facts do not mention is should_fix at most/);
});

test("inline tags join words: quote marks in translate=\"no\" spans read as one quotation", () => {
  const { text } = analyseEmailHtml({ html: email('<p>De svarede bare <span translate="no">‘</span>ja, Kevin<span translate="no">’</span>. Se <a href="{{ organization.url }}x">æskerne</a> her.</p>') });
  assert.match(text, /De svarede bare ‘ja, Kevin’\. Se æskerne her\./);
});

test("the locked footer never reaches the screen, whatever the review says about it", () => {
  const text = "FSC® er miljømærket for ansvarligt skovbrug. www.fsc.org.\nVores FSC licens nummer er FSC®C112509.";
  const review = finalizeReview({
    verdict: "fix_first",
    summary: "",
    findings: [{ severity: "must_fix", area: "rules", quote: "FSC® er miljømærket for ansvarligt skovbrug. www.fsc.org.", problem: "Environmental claim.", fix: "Remove." }],
    claims: [{ claim: "FSC is an environmental label", verdict: "not_found", evidence: "not in the site facts" }, { claim: "Licence FSC®C112509", verdict: "supported", evidence: "FSC licence FSC®C112509" }]
  }, text);
  assert.equal(review.findings.length, 0);
  assert.equal(review.claims.length, 0);
});

test("a finding whose quote is not in the email is dropped, and a must-fix means the email is not ready", () => {
  const text = "Få jeres logo på æsken.\nBestil inden fristen – fristerne er forskellige fra land til land.\nGratis prøver hele november.";
  const review = finalizeReview({
    verdict: "ready",
    summary: "Mostly fine.",
    findings: [
      { severity: "must_fix", area: "claims", quote: "Gratis prøver hele november", problem: "Samples are not free.", fix: "Remove the claim." },
      { severity: "should_fix", area: "tone", quote: "This sentence does not exist in the email", problem: "Invented.", fix: "-" },
      { severity: "consider", area: "clarity", quote: "“Få jeres logo på æsken.”", problem: "Could be sharper.", fix: "Lead with the box." }
    ],
    claims: [{ claim: "Free samples all November", verdict: "contradicted", evidence: "Samples: freight is charged." }]
  }, text);
  assert.equal(review.findings.length, 2);
  assert.equal(review.droppedUnverified, 1);
  assert.equal(review.verdict, "fix_first");
  assert.equal(review.findings[0].severity, "must_fix");
  assert.equal(review.claims[0].verdict, "contradicted");
});
