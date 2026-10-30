/**
 * What actually reached Klaviyo, read back with each account's private key.
 *
 * The browser sees Klaviyo's 202 the moment a signup is accepted, but acceptance is not a subscription: on
 * 2026-10-29 Klaviyo's bot protection suppressed automated test signups seconds after accepting them ("Manually
 * Suppressed from Email Marketing", method BOT_PROTECTION), and the browser could not have known. So the funnel's
 * "signed up" is what was sent, and this is what stuck:
 * - submitted:  people with a "Signup Lab Subscribed" event (the runtime writes one right after an accepted signup).
 *               Counted per person, not per event: one signup has been seen to write two.
 * - confirmed:  people who joined the list with a consent whose custom source is the lab and are still subscribed
 * - botBlocked: submitted people that Klaviyo suppressed with method BOT_PROTECTION
 *
 * Two environments, never mixed:
 * - live: each market's own account and newsletter list (signup/core/markets.js).
 * - test: the TEST list in the DK account (TEST_TARGET), where staging, previews on the stores and tests go.
 * The event names its list (wp_signup_list, core/rules.js buildCompletionEvent). Events from before that property
 * existed (2026-10-30) are all test signups: until then live had never been switched on, and a preview on a live store
 * is always test mode.
 */
const { localDay } = require("./funnel-store");

const SOURCE = "Westpack Signup Lab";
const REVISION = "2026-10-15";
const metricIds = new Map();

function client(key, fetchImpl) {
  async function kv(url) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = await fetchImpl(`https://a.klaviyo.com${url}`, { headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: REVISION, accept: "application/vnd.api+json" } });
      if (r.status === 429) { await new Promise((res) => setTimeout(res, (Math.min(Number(r.headers.get("retry-after") || 2), 10) + 1) * 1000)); continue; }
      if (!r.ok) throw new Error(`Klaviyo ${r.status} on ${url.split("?")[0]}`);
      return r.json();
    }
    throw new Error("Klaviyo rate limit");
  }
  async function all(url, cap = 2000) {
    const out = []; let next = url;
    while (next && out.length < cap) { const j = await kv(next.replace("https://a.klaviyo.com", "")); out.push(...(j.data || [])); next = j.links && j.links.next; }
    return out;
  }
  async function metricId(name) {
    const cacheKey = `${key}:${name}`;
    if (metricIds.has(cacheKey)) return metricIds.get(cacheKey);
    const found = (await all("/api/metrics?fields[metric]=name")).find((x) => x.attributes.name === name);
    const id = found ? found.id : null;
    if (id) metricIds.set(cacheKey, id);
    return id;
  }
  const events = async (metric, sinceIso) => all(`/api/events?filter=${encodeURIComponent(`equals(metric_id,"${metric}"),greater-or-equal(datetime,${sinceIso})`)}&fields[event]=event_properties,datetime&include=profile&fields[profile]=id`);
  return { all, metricId, events };
}

const blank = () => ({ submitted: 0, confirmed: 0, botBlocked: 0 });

/**
 * One account and one list. `accept(eventProperties)` says whether an event belongs to this list; `market` is the
 * market a signup counts under when it does not say.
 */
async function readAccount({ key, listId, market, sinceIso, accept, fetchImpl }) {
  const k = client(key, fetchImpl);
  const people = new Map(); // profile id -> { concept, market }
  const submittedId = await k.metricId("Signup Lab Subscribed");
  if (submittedId) {
    for (const e of await k.events(submittedId, sinceIso)) {
      const props = e.attributes.event_properties || {};
      const pid = e.relationships?.profile?.data?.id;
      if (!pid || !accept(props)) continue;
      if (!people.has(pid)) people.set(pid, { concept: props.wp_signup_concept || "unknown", market: props.wp_signup_market || market });
    }
  }
  const confirmed = [];
  const joined = await k.all(`/api/lists/${listId}/profiles?filter=${encodeURIComponent(`greater-than(joined_group_at,${sinceIso})`)}&additional-fields[profile]=subscriptions&fields[profile]=subscriptions,properties,joined_group_at&page[size]=100`);
  for (const p of joined) {
    const s = p.attributes.subscriptions?.email?.marketing || {};
    if (!String(s.custom_method_detail || "").startsWith(SOURCE) || s.consent !== "SUBSCRIBED") continue;
    const props = p.attributes.properties || {};
    confirmed.push({ concept: props.wp_signup_concept || String(s.custom_method_detail).split(" · ")[1] || "unknown", market: props.wp_signup_market || market, at: p.attributes.joined_group_at || null });
  }
  const blocked = [];
  if (people.size) {
    const suppressedId = await k.metricId("Manually Suppressed from Email Marketing");
    if (suppressedId) {
      const seen = new Set();
      for (const e of await k.events(suppressedId, sinceIso)) {
        const pid = e.relationships?.profile?.data?.id;
        if (e.attributes.event_properties?.method === "BOT_PROTECTION" && people.has(pid) && !seen.has(pid)) { seen.add(pid); blocked.push(people.get(pid)); }
      }
    }
  }
  return { submitted: [...people.values()], confirmed, blocked };
}

/**
 * env: "live" | "test". markets: the Signup Lab market entries (signup/core/markets.js MARKETS values); keys:
 * { DK: privateKey, ... } from the app's Klaviyo config; testTarget: TEST_TARGET; since: ISO time.
 * Returns totals, a row per market, per experience, and confirmed signups per Danish day.
 */
async function reconcile({ env = "live", markets, keys, testTarget, since, fetchImpl = fetch }) {
  const sinceIso = new Date(Date.parse(since)).toISOString().replace(/\.\d+Z$/, "Z");
  const accounts = env === "test"
    ? (() => {
      const owner = markets.find((m) => m.companyId === testTarget.companyId) || markets[0];
      // the test list takes every test signup, whatever market it was made on; old events carry no list
      return [{ market: owner.market, listId: testTarget.listId, accept: (p) => !p.wp_signup_list || p.wp_signup_list === testTarget.listId }];
    })()
    : markets.map((m) => ({ market: m.market, listId: m.listId, accept: (p) => p.wp_signup_list === m.listId }));

  const results = await Promise.all(accounts.map(async (a) => {
    const key = keys[a.market];
    if (!key) return { market: a.market, error: "no Klaviyo key configured" };
    try { return { market: a.market, ...(await readAccount({ key, listId: a.listId, market: a.market, sinceIso, accept: a.accept, fetchImpl })) }; } catch (e) { return { market: a.market, error: e.message }; }
  }));

  const total = blank(), byMarket = {}, byConcept = {}, days = {};
  const bump = (row, field) => {
    for (const bucket of [total, byMarket[row.market] || (byMarket[row.market] = blank()), byConcept[row.concept] || (byConcept[row.concept] = blank())]) bucket[field]++;
  };
  const errors = {};
  for (const r of results) {
    if (r.error) { errors[r.market] = r.error; continue; }
    r.submitted.forEach((x) => bump(x, "submitted"));
    r.confirmed.forEach((x) => { bump(x, "confirmed"); const d = Date.parse(x.at || ""); if (Number.isFinite(d)) days[localDay(d)] = (days[localDay(d)] || 0) + 1; });
    r.blocked.forEach((x) => bump(x, "botBlocked"));
  }
  return { env, since: sinceIso, total, markets: byMarket, concepts: byConcept, days, errors, list: env === "test" ? testTarget.name : "each market's newsletter list" };
}

module.exports = { reconcile, readAccount, SOURCE };
