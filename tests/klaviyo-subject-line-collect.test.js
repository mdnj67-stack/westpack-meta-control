const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { allowedPath, isCampaign, readEmailPage, readPreheader } = require("../knowledge/subject-lines/tools/collect-rge");

// The collector for real subject lines (Really Good Emails). Synthetic pages in the shape the site
// served on 2026-10-27: Next.js flight chunks carrying the email record, and the subject line in
// the page metadata.

function flightPage(slug, record, emailHtml) {
  const flight = `0:{"email":{"slug":"${slug}","title":"x",${record}}}\n16:T1,${emailHtml}`;
  return [
    `<html><head><meta name="description" content="Take a look at this email from Zillow with the subject line: Front door colors that raise home values"/></head><body>`,
    `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`,
    "</body></html>"
  ].join("");
}

test("an email page yields subject, hidden preheader, sender, categories and date", () => {
  const html = flightPage(
    "zillow-paint-colors-pay-off",
    '"categories":[{"name":"Curated","slug":"curated"},{"name":"Newsletter","slug":"newsletter"}],"company":{"slug":"zillow","name":"Zillow"},"publishedAt":"2026-10-23T22:47:47.823Z"',
    '<html><body><div style="display:none;max-height:0;overflow:hidden;">And one that subtracts $3k.&nbsp;&zwnj;&nbsp;&zwnj;</div><table><tr><td>Hello</td></tr></table></body></html>'
  );
  assert.deepEqual(readEmailPage("zillow-paint-colors-pay-off", html), {
    slug: "zillow-paint-colors-pay-off",
    subject: "Front door colors that raise home values",
    preview: "And one that subtracts $3k.",
    company: "Zillow",
    categories: ["curated", "newsletter"],
    publishedAt: "2026-10-23T22:47:47.823Z"
  });
});

test("a hidden element with no real words is not taken for a preheader", () => {
  assert.equal(readPreheader('<body><span style="display:none">&nbsp;&zwnj;&nbsp;</span><div class="preheader">Ten new boxes for autumn</div></body>'), "Ten new boxes for autumn");
  assert.equal(readPreheader("<body><p>Visible text only</p></body>"), "");
});

test("system mail and pure software mail stay out; retail software mail stays in", () => {
  assert.equal(isCampaign({ subject: "Reset your password", categories: ["password-reset"] }), false);
  assert.equal(isCampaign({ subject: "Your trial has ended", categories: ["saas", "b2b"] }), true);
  assert.equal(isCampaign({ subject: "New in the dashboard", categories: ["saas", "product-update-new-feature"] }), false);
  assert.equal(isCampaign({ subject: "Autumn edit", categories: ["fashion", "newsletter"] }), true);
  assert.equal(isCampaign({ subject: "", categories: ["retail"] }), false);
});

test("the collector never requests a path robots.txt disallows", () => {
  const disallowed = ["/api/", "/admin", "/library", "/upload", "/app/login", "/companies/"];
  assert.equal(allowedPath("/categories/retail", disallowed), true);
  assert.equal(allowedPath("/emails/zillow-paint-colors-pay-off", disallowed), true);
  assert.equal(allowedPath("/api/emails?page=2", disallowed), false);
  assert.equal(allowedPath("/companies/zillow", disallowed), false);
  const source = fs.readFileSync(path.join(__dirname, "..", "knowledge", "subject-lines", "tools", "collect-rge.js"), "utf8");
  assert.doesNotMatch(source, /milled\.com/i, "Milled refuses AI agents in robots.txt and is not collected");
  assert.match(source, /User-Agent": USER_AGENT/);
});
