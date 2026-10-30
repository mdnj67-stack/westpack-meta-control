/**
 * Signup Lab control: what the script on the stores runs, set from the app's Signup page rather than in code.
 *
 * One document in Blob (signup/control.json):
 *   live    { on, current, markets: { DK: true, ... } }  the real stores (www.westpack.com)
 *   staging { on, current }                              a host in STAGING_HOSTS; always the test list
 *   insert  { unpublished: [{ market, id, name, at }] }  The Insert popups this page took down, to put back
 *   storeCheck                                           the last look at the stores' own pages
 *   history [{ at, text }]                               newest first, bounded
 *
 * The browser only ever sees publicConfig(): on/off, the experience and the markets. signup/core/markets.js keeps
 * LIVE and CURRENT as the fallback the script uses when it cannot read this, so a failure turns the live stores off,
 * never on.
 *
 * Live and The Insert popups go together: wherever the Signup Lab runs on a live store, that market's Insert popup
 * is unpublished, or a visitor gets two popups; wherever it stops, the popups this page took down are published
 * again. insertPlan() works that out; it touches nothing itself.
 */
const rules = require("../../signup/core/rules");
const { LIVE, CURRENT, MARKETS } = require("../../signup/core/markets");

const HISTORY_KEPT = 100;
const MARKET_LETTERS = Object.values(MARKETS).map((m) => m.market);
const STORE_CODE = Object.fromEntries(Object.entries(MARKETS).map(([code, m]) => [m.market, code]));

// What the page says about each experience. The order is the order they take their turn.
const CONCEPTS = [
  { id: "logo-studio", name: "Logo studio", line: "Your brand name in foil on six real Westpack lids, live.", image: "/signup/cards/logo-studio.jpg" },
  { id: "swipe-match", name: "Swipe match", line: "Swipe six real boxes, get a packaging profile.", image: "/signup/assets/swipe/monaco-600.webp" },
  { id: "pack-and-ship", name: "Pack & ship", line: "The email address is printed on a shipping label.", image: "/signup/assets/ship/mailer-720.webp" }
];

const isConcept = (id) => rules.CONCEPT_IDS.includes(id);

function defaultControl() {
  return {
    v: 1,
    live: { on: LIVE, current: CURRENT, markets: Object.fromEntries(MARKET_LETTERS.map((m) => [m, true])) },
    staging: { on: true, current: CURRENT },
    insert: { unpublished: [] },
    storeCheck: null,
    history: [],
    updatedAt: null
  };
}

function normalizeControl(raw) {
  const base = defaultControl();
  const c = raw && typeof raw === "object" && raw.v === 1 ? raw : {};
  const live = c.live || {};
  const staging = c.staging || {};
  return {
    v: 1,
    live: {
      on: typeof live.on === "boolean" ? live.on : base.live.on,
      current: isConcept(live.current) ? live.current : base.live.current,
      markets: Object.fromEntries(MARKET_LETTERS.map((m) => [m, live.markets && typeof live.markets[m] === "boolean" ? live.markets[m] : true]))
    },
    staging: {
      on: typeof staging.on === "boolean" ? staging.on : base.staging.on,
      current: isConcept(staging.current) ? staging.current : base.staging.current
    },
    insert: { unpublished: Array.isArray(c.insert?.unpublished) ? c.insert.unpublished.filter((f) => f && MARKET_LETTERS.includes(f.market) && /^[A-Za-z0-9]{6}$/.test(f.id)) : [] },
    storeCheck: c.storeCheck && typeof c.storeCheck === "object" ? c.storeCheck : null,
    history: Array.isArray(c.history) ? c.history.slice(0, HISTORY_KEPT) : [],
    updatedAt: c.updatedAt || null
  };
}

// The only part a browser on a store reads: no history, no form ids, nothing about the accounts.
function publicConfig(control) {
  const c = normalizeControl(control);
  return { v: 1, live: { on: c.live.on, current: c.live.current, markets: c.live.markets }, staging: { on: c.staging.on, current: c.staging.current }, at: c.updatedAt };
}

const conceptName = (id) => (CONCEPTS.find((c) => c.id === id) || { name: id }).name;

// Markets whose live store page carries the tag, by the last store check. Live can only reach these.
function installedMarkets(control) {
  const live = control.storeCheck?.live || {};
  return MARKET_LETTERS.filter((m) => live[m]?.tag === "yes");
}

/**
 * One change from the page. Returns { control, text } or throws with a message for the person who asked.
 *   { type: "current", env: "live"|"staging", concept }
 *   { type: "market", market: "DE", on }
 *   { type: "staging", on }
 *   { type: "live", on }
 */
function applyChange(control, change, now = new Date().toISOString()) {
  const next = normalizeControl(JSON.parse(JSON.stringify(control || {})));
  let text;
  const ch = change || {};
  if (ch.type === "current") {
    if (!isConcept(ch.concept)) throw new Error("Unknown experience.");
    if (!["live", "staging"].includes(ch.env)) throw new Error("Choose live or staging.");
    if (next[ch.env].current === ch.concept) throw new Error(`${conceptName(ch.concept)} already runs on ${ch.env}.`);
    text = `${ch.env === "live" ? "Live" : "Staging"} now runs ${conceptName(ch.concept)} (was ${conceptName(next[ch.env].current)}).`;
    next[ch.env].current = ch.concept;
  } else if (ch.type === "market") {
    if (!MARKET_LETTERS.includes(ch.market)) throw new Error("Unknown market.");
    if (typeof ch.on !== "boolean") throw new Error("Say on or off.");
    if (next.live.markets[ch.market] === ch.on) throw new Error(`${ch.market} is already ${ch.on ? "on" : "off"}.`);
    next.live.markets[ch.market] = ch.on;
    text = `${ch.market} switched ${ch.on ? "on" : "off"} for live.`;
  } else if (ch.type === "staging") {
    if (typeof ch.on !== "boolean") throw new Error("Say on or off.");
    if (next.staging.on === ch.on) throw new Error(`Staging is already ${ch.on ? "on" : "off"}.`);
    next.staging.on = ch.on;
    text = `Staging switched ${ch.on ? "on" : "off"}.`;
  } else if (ch.type === "live") {
    if (typeof ch.on !== "boolean") throw new Error("Say on or off.");
    if (next.live.on === ch.on) throw new Error(`Live is already ${ch.on ? "on" : "off"}.`);
    if (ch.on) {
      const reach = installedMarkets(next).filter((m) => next.live.markets[m]);
      if (!reach.length) throw new Error("No live store carries the tag yet (check the stores first), so switching live on would reach nobody.");
    }
    next.live.on = ch.on;
    text = `Live switched ${ch.on ? "on" : "off"}.`;
  } else {
    throw new Error("Unknown change.");
  }
  next.updatedAt = now;
  next.history = [{ at: now, text }, ...next.history].slice(0, HISTORY_KEPT);
  return { control: next, text };
}

/**
 * Which Insert popups have to change for this control to hold. insertForms: { DK: [{ id, name, status }], ... }
 * for the markets whose forms were read. A market runs the Signup Lab on its live store when live is on, the market
 * is on, and its store carries the tag; there its live Insert popups come down. Everywhere else, the popups this
 * page took down go back up. Popups someone else unpublished are never published by this page.
 */
function insertPlan(control, insertForms) {
  const c = normalizeControl(control);
  const reach = new Set(c.live.on ? installedMarkets(c).filter((m) => c.live.markets[m]) : []);
  const unpublish = [], republish = [];
  for (const [market, forms] of Object.entries(insertForms || {})) {
    if (!reach.has(market)) continue;
    for (const f of forms || []) if (f.status === "live") unpublish.push({ market, id: f.id, name: f.name });
  }
  for (const f of c.insert.unpublished) if (!reach.has(f.market)) republish.push({ market: f.market, id: f.id, name: f.name });
  return { reach: [...reach], unpublish, republish };
}

// After the plan ran: what this page has taken down, so it can put exactly that back later.
function recordInsertResults(control, done, now = new Date().toISOString()) {
  const next = normalizeControl(control);
  const back = new Set(done.filter((d) => d.action === "republish" && d.ok).map((d) => d.id));
  const down = done.filter((d) => d.action === "unpublish" && d.ok).map((d) => ({ market: d.market, id: d.id, name: d.name, at: now }));
  next.insert.unpublished = next.insert.unpublished.filter((f) => !back.has(f.id)).concat(down.filter((d) => !next.insert.unpublished.some((f) => f.id === d.id)));
  const lines = done.map((d) => `${d.ok ? "" : "FAILED: "}${d.action === "unpublish" ? "unpublished" : "published again"} The Insert in ${d.market} (${d.id})`);
  if (lines.length) next.history = [{ at: now, text: `${lines.join("; ")}.` }, ...next.history].slice(0, HISTORY_KEPT);
  return next;
}

module.exports = {
  CONCEPTS,
  MARKET_LETTERS,
  STORE_CODE,
  HISTORY_KEPT,
  defaultControl,
  normalizeControl,
  publicConfig,
  installedMarkets,
  applyChange,
  insertPlan,
  recordInsertResults
};
