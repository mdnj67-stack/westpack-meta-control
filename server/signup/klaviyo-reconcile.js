/**
 * What actually reached Klaviyo, per market and experience, read back with each account's private key.
 *
 * The browser sees Klaviyo's 202 the moment a signup is accepted, but acceptance is not a subscription: on
 * 2026-10-29 Klaviyo's bot protection suppressed automated test signups seconds after accepting them ("Manually
 * Suppressed from Email Marketing", method BOT_PROTECTION), and the browser could not have known. So the funnel's
 * "subscribed" is what was sent, and this is what stuck:
 * - submitted:  "Signup Lab Subscribed" events (written by the runtime right after an accepted signup)
 * - confirmed:  profiles that joined the market's newsletter list with a consent whose custom source is the lab
 * - botBlocked: submitted profiles that Klaviyo suppressed with method BOT_PROTECTION
 */
const SOURCE = "Westpack Signup Lab";

async function kv(key, url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`https://a.klaviyo.com${url}`, { headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: "2026-10-15", accept: "application/vnd.api+json" } });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, (Number(r.headers.get("retry-after") || 2) + 1) * 1000)); continue; }
    if (!r.ok) throw new Error(`Klaviyo ${r.status} on ${url.split("?")[0]}`);
    return r.json();
  }
  throw new Error("Klaviyo rate limit");
}
async function all(key, url, cap = 2000) {
  const out = []; let next = url;
  while (next && out.length < cap) { const j = await kv(key, next.replace("https://a.klaviyo.com", "")); out.push(...(j.data || [])); next = j.links && j.links.next; }
  return out;
}
async function metricId(key, name) {
  const j = await all(key, `/api/metrics?fields[metric]=name`);
  const m = j.find((x) => x.attributes.name === name);
  return m ? m.id : null;
}

async function reconcileMarket(market, key, sinceIso) {
  const out = { market: market.market, submitted: 0, confirmed: 0, botBlocked: 0, byConcept: {} };
  const bump = (concept, field) => { const c = (out.byConcept[concept] = out.byConcept[concept] || { submitted: 0, confirmed: 0, botBlocked: 0 }); c[field]++; out[field]++; };
  const submittedId = await metricId(key, "Signup Lab Subscribed");
  const submittedBy = {};
  if (submittedId) {
    const ev = await all(key, `/api/events?filter=${encodeURIComponent(`equals(metric_id,"${submittedId}"),greater-or-equal(datetime,${sinceIso})`)}&fields[event]=event_properties&include=profile&fields[profile]=id`);
    for (const e of ev) { const pid = e.relationships.profile.data.id; const concept = e.attributes.event_properties.wp_signup_concept || "unknown"; submittedBy[pid] = concept; bump(concept, "submitted"); }
  }
  const joined = await all(key, `/api/lists/${market.listId}/profiles?filter=${encodeURIComponent(`greater-than(joined_group_at,${sinceIso})`)}&additional-fields[profile]=subscriptions&fields[profile]=subscriptions,properties&page[size]=100`);
  for (const p of joined) {
    const s = p.attributes.subscriptions?.email?.marketing || {};
    if (String(s.custom_method_detail || "").startsWith(SOURCE) && s.consent === "SUBSCRIBED") bump(p.attributes.properties?.wp_signup_concept || String(s.custom_method_detail).split(" · ")[1] || "unknown", "confirmed");
  }
  if (Object.keys(submittedBy).length) {
    const suppressedId = await metricId(key, "Manually Suppressed from Email Marketing");
    if (suppressedId) {
      const ev = await all(key, `/api/events?filter=${encodeURIComponent(`equals(metric_id,"${suppressedId}"),greater-or-equal(datetime,${sinceIso})`)}&fields[event]=event_properties&include=profile&fields[profile]=id`);
      for (const e of ev) { const pid = e.relationships.profile.data.id; if (e.attributes.event_properties.method === "BOT_PROTECTION" && submittedBy[pid]) bump(submittedBy[pid], "botBlocked"); }
    }
  }
  return out;
}

/**
 * markets: the Signup Lab market entries to check; keys: { DK: privateKey, ... } from the app's Klaviyo config.
 */
async function reconcile(markets, keys, sinceIso) {
  const results = await Promise.all(markets.map(async (m) => {
    const key = keys[m.market];
    if (!key) return { market: m.market, error: "no Klaviyo key configured" };
    try { return await reconcileMarket(m, key, sinceIso); } catch (e) { return { market: m.market, error: e.message }; }
  }));
  const total = { submitted: 0, confirmed: 0, botBlocked: 0 };
  for (const r of results) for (const k of Object.keys(total)) total[k] += r[k] || 0;
  return { since: sinceIso, total, markets: results };
}

module.exports = { reconcile, reconcileMarket, SOURCE };
