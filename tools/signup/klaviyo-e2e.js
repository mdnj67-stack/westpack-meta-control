/**
 * End-to-end test of the Signup Lab against Klaviyo itself: the real runtime in a real browser subscribes one test
 * address per experience to the TEST list (never a newsletter list), and the result is read back from Klaviyo with
 * the account's private key: list membership, consent, custom source, profile properties and the timeline event.
 * Also checks that a double click sends one request, and that an invalid address sends none.
 *
 * The test profiles are deleted afterwards (Klaviyo data-privacy deletion), because a SUBSCRIBED test profile could
 * otherwise fall into a consent-based segment and be sent a real campaign.
 *
 * Usage: node tools/signup/klaviyo-e2e.js [--keep]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const ROOT = path.resolve(__dirname, "..", "..");
process.chdir(ROOT);
const { chromium, devices } = require(path.join(ROOT, "tmp", "playwright-runner", "node_modules", "playwright"));
const { getConfig } = require(path.join(ROOT, "server", "lib", "config.js"));
const { TEST_TARGET } = require(path.join(ROOT, "signup", "core", "markets.js"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2" };
const serve = () => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0, () => resolve(s));
});

let cfg = getConfig().klaviyoMarketsJson; if (typeof cfg === "string") cfg = JSON.parse(cfg);
const KEY = cfg.find((m) => m.country === "DK").privateKey;
const H = { Authorization: `Klaviyo-API-Key ${KEY}`, revision: "2026-10-15", accept: "application/vnd.api+json", "content-type": "application/vnd.api+json" };
const kv = async (url, opts = {}) => { const r = await fetch(`https://a.klaviyo.com${url}`, { headers: H, ...opts }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; } return { status: r.status, j }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findProfile(email) {
  for (let i = 0; i < 20; i++) {
    const r = await kv(`/api/lists/${TEST_TARGET.listId}/profiles?filter=${encodeURIComponent(`equals(email,"${email}")`)}&additional-fields[profile]=subscriptions&fields[profile]=email,organization,locale,properties,subscriptions`);
    if (r.j.data && r.j.data[0]) return r.j.data[0];
    await sleep(3000);
  }
  return null;
}

(async () => {
  const keep = process.argv.includes("--keep");
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/signup/preview/frame.html`;
  const browser = await chromium.launch();
  const stamp = Date.now();
  const results = [];
  for (const concept of (process.env.E2E_ONLY ? process.env.E2E_ONLY.split(",") : ["logo-studio", "swipe-match", "pack-and-ship"])) {
    const email = `signup-lab+${concept}-${stamp}@westpack.com`;
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    const posts = [];
    page.on("request", (r) => { if (r.url().includes("a.klaviyo.com/client/")) posts.push(r.url().split("?")[0]); });
    const subscribed = page.waitForEvent("console", { predicate: (m) => m.text() === "wps-subscribed", timeout: 30000 }).catch(() => null);
    await page.addInitScript(() => { addEventListener("message", (e) => { if (e.data && e.data.wps === "subscribed") console.log("wps-subscribed"); }); });
    await page.goto(`${base}?market=dkk_dk_den&concept=${concept}&open=1&reset=1&track=`);
    await page.waitForTimeout(1500);
    const host = page.locator("#westpack-signup");
    if (concept === "logo-studio") { await host.locator(".ls-name-input").fill("Signup Lab Test"); await host.locator(".ls-next").click(); }
    if (concept === "swipe-match") for (let i = 0; i < 6; i++) { await host.locator(i % 2 ? ".sm-nope" : ".sm-like").click(); await page.waitForTimeout(450); }
    await page.waitForTimeout(600);
    // an invalid address must not reach Klaviyo
    await host.locator(".wps-input").fill("not an email");
    await host.locator(".wps-form .wps-btn-primary").click();
    await page.waitForTimeout(400);
    const invalidShown = await host.locator(".wps-error").innerText();
    const postsAfterInvalid = posts.length;
    // a double click must send one subscription, not two
    await host.locator(".wps-input").fill(email);
    await host.locator(".wps-form .wps-btn-primary").dblclick();
    await page.waitForTimeout(2500);
    const subs = posts.filter((u) => u.endsWith("/client/subscriptions")).length;
    const profile = await findProfile(email);
    const events = profile ? (await kv(`/api/events?filter=${encodeURIComponent(`equals(profile_id,"${profile.id}")`)}&fields[event]=event_properties,datetime&include=metric&fields[metric]=name`)).j : null;
    const metricNames = events ? (events.included || []).map((m) => m.attributes.name) : [];
    const p = profile && profile.attributes;
    results.push({
      concept, email,
      invalidRejectedInBrowser: Boolean(invalidShown) && postsAfterInvalid === 0,
      subscriptionRequests: subs,
      onTestList: Boolean(profile),
      consent: p && p.subscriptions && p.subscriptions.email && p.subscriptions.email.marketing && p.subscriptions.email.marketing.consent,
      method: p && p.subscriptions && p.subscriptions.email && p.subscriptions.email.marketing && [p.subscriptions.email.marketing.method, p.subscriptions.email.marketing.method_detail].filter(Boolean).join(" / "),
      organization: p && p.organization,
      locale: p && p.locale,
      properties: p && Object.fromEntries(Object.entries(p.properties || {}).filter(([k]) => k.startsWith("wp_")).map(([k, v]) => [k, k === "wp_consent_text" ? `${String(v).slice(0, 48)}…` : v])),
      timelineEvent: metricNames.includes("Signup Lab Subscribed"),
      profileId: profile && profile.id,
    });
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(JSON.stringify(results, null, 2));

  if (!keep) {
    for (const r of results) {
      if (!r.profileId) continue;
      const del = await kv("/api/data-privacy-deletion-jobs", { method: "POST", body: JSON.stringify({ data: { type: "data-privacy-deletion-job", attributes: { profile: { data: { type: "profile", id: r.profileId } } } } }) });
      console.log(`delete ${r.email}: ${del.status}${del.status >= 300 ? " " + JSON.stringify(del.j.errors || del.j).slice(0, 200) : ""}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
