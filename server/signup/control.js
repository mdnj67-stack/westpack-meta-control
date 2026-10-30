/**
 * Signup Lab control: what the script on the stores runs, set from the app's Signup Lab page rather than in code.
 *
 * One document in Blob (signup/control.json):
 *   live    { on, current, markets: { DK: true, ... }, reach: ["DK", ...] }  the real stores (www.westpack.com)
 *   staging { on, current }                              a host in STAGING_HOSTS; always the test list
 *   insert  { unpublished: [{ market, id, name, at }] }  The Insert popups this page took down, to put back
 *   storeCheck                                           the last look at the stores' own pages
 *   history [{ at, text }]                               newest first, bounded
 *
 * `markets` is what the person wants; `reach` is where the stores actually run it. They differ because live can only
 * run on a store that carries the tag, and because every market in `reach` has had its Insert popup taken down. The
 * stores are told `reach` and nothing else (publicConfig), so a store that gains the tag while live is on stays
 * silent until someone brings it in from the page - otherwise it would run beside its Insert popup, and its
 * visitors would get two popups. A change sets `reach` to targetReach(); the page offers to do the same when a store
 * check finds that the tags have moved under it (pendingReach).
 *
 * The browser only ever sees publicConfig(): on/off, the experience and the markets. signup/core/markets.js keeps
 * LIVE and CURRENT as the fallback the script uses when it cannot read this, so a failure turns the live stores off,
 * never on.
 */
const rules = require("../../signup/core/rules");
const { LIVE, CURRENT, MARKETS, STAGING_HOSTS } = require("../../signup/core/markets");

const HISTORY_KEPT = 100;
const MARKET_LETTERS = Object.values(MARKETS).map((m) => m.market);
const STORE_CODE = Object.fromEntries(Object.entries(MARKETS).map(([code, m]) => [m.market, code]));
// A change that reaches live visitors re-reads the live stores when the last look is older than this, because the
// tags decide where the Signup Lab runs and which Insert popups come down.
const STORE_CHECK_FRESH_MS = 10 * 60 * 1000;

// What the page says about each experience. The order is the order they take their turn.
const CONCEPTS = [
  { id: "logo-studio", name: "Logo studio", line: "Your brand name in foil on six real Westpack lids, live.", image: "/signup/cards/logo-studio.jpg" },
  { id: "swipe-match", name: "Swipe match", line: "Swipe six real boxes, get a packaging profile.", image: "/signup/assets/swipe/monaco-600.webp" },
  { id: "pack-and-ship", name: "Pack & ship", line: "The email address is printed on a shipping label.", image: "/signup/assets/ship/mailer-720.webp" }
];

// The one line that goes on every store (signup/IMPLEMENTERING.md), and where it goes.
const SNIPPET = '<script src="https://project-4fcxa.vercel.app/signup/westpack-signup.js" async></script>';
const SNIPPET_PLACE = "Magento: Content → Design → Configuration → Global → HTML Head → Scripts and Style Sheets, then flush the cache.";

const isConcept = (id) => rules.CONCEPT_IDS.includes(id);
const onlyMarkets = (list) => (Array.isArray(list) ? [...new Set(list.filter((m) => MARKET_LETTERS.includes(m)))] : null);

function defaultControl() {
  return {
    v: 1,
    live: { on: LIVE, current: CURRENT, markets: Object.fromEntries(MARKET_LETTERS.map((m) => [m, true])), reach: [] },
    staging: { on: true, current: CURRENT },
    insert: { unpublished: [] },
    storeCheck: null,
    history: [],
    updatedAt: null
  };
}

// Markets whose live store page carries the tag, by the last store check. Live can only reach these.
function installedMarkets(control) {
  const live = control.storeCheck?.live || {};
  return MARKET_LETTERS.filter((m) => live[m]?.tag === "yes");
}

// Where live should run: switched on, the market switched on, and its store carrying the tag.
function targetReach(control) {
  return control.live.on ? installedMarkets(control).filter((m) => control.live.markets[m]) : [];
}

function normalizeControl(raw) {
  const base = defaultControl();
  const c = raw && typeof raw === "object" && raw.v === 1 ? raw : {};
  const live = c.live || {};
  const staging = c.staging || {};
  const out = {
    v: 1,
    live: {
      on: typeof live.on === "boolean" ? live.on : base.live.on,
      current: isConcept(live.current) ? live.current : base.live.current,
      markets: Object.fromEntries(MARKET_LETTERS.map((m) => [m, live.markets && typeof live.markets[m] === "boolean" ? live.markets[m] : true])),
      reach: []
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
  // Off reaches nobody. A document written before `reach` existed reads as what that version ran: every switched-on
  // market whose store carried the tag.
  const stored = onlyMarkets(live.reach);
  out.live.reach = !out.live.on ? [] : stored ? stored.filter((m) => out.live.markets[m]) : targetReach(out);
  return out;
}

// The only part a browser on a store reads: no history, no form ids, nothing about the accounts. A market is on only
// where this page has brought live (`reach`).
function publicConfig(control) {
  const c = normalizeControl(control);
  const markets = Object.fromEntries(MARKET_LETTERS.map((m) => [m, c.live.on && c.live.reach.includes(m)]));
  return { v: 1, live: { on: c.live.on, current: c.live.current, markets }, staging: { on: c.staging.on, current: c.staging.current }, at: c.updatedAt };
}

// The tags moved under a running live: stores that now carry it wait to be brought in, stores that lost it run nothing
// and their Insert popup should come back. Null when live runs exactly where it should.
function pendingReach(control) {
  const c = normalizeControl(control);
  if (!c.live.on) return null;
  const target = targetReach(c);
  const add = target.filter((m) => !c.live.reach.includes(m));
  const remove = c.live.reach.filter((m) => !target.includes(m));
  return add.length || remove.length ? { add, remove } : null;
}

const conceptName = (id) => (CONCEPTS.find((c) => c.id === id) || { name: id }).name;
const list = (markets) => (markets.length ? markets.join(", ") : "no store");

// Changes that can change what live visitors see, or which Insert popups are up.
function touchesLive(change) {
  const type = change?.type;
  return type === "live" || type === "market" || type === "reach" || (type === "current" && change.env === "live");
}

/**
 * One change from the page. Returns { control, text } or throws with a message for the person who asked.
 *   { type: "current", env: "live"|"staging", concept }
 *   { type: "market", market: "DE", on }
 *   { type: "staging", on }
 *   { type: "live", on }
 *   { type: "reach" }       bring live in line with the stores' tags after a store check
 * Every change leaves live.reach at targetReach(): the API then takes down or puts back the Insert popups to match.
 */
function applyChange(control, change, now = new Date().toISOString()) {
  const next = normalizeControl(JSON.parse(JSON.stringify(control || {})));
  const reachBefore = next.live.reach.slice();
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
    next.live.on = ch.on;
    if (ch.on && !targetReach(next).length) throw new Error("No live store carries the tag yet (check the stores first), so switching live on would reach nobody.");
    text = `Live switched ${ch.on ? "on" : "off"}.`;
  } else if (ch.type === "reach") {
    if (!next.live.on) throw new Error("Live is off, so it runs nowhere.");
    if (!pendingReach(next)) throw new Error("Live already runs on every store that carries the tag.");
    text = "Live brought in line with the stores' tags.";
  } else {
    throw new Error("Unknown change.");
  }
  // Only a change to live moves where live runs; a staging change leaves it, and the Insert popups, alone.
  if (touchesLive(ch)) next.live.reach = targetReach(next);
  if (next.live.on && (ch.type !== "live" || !ch.on) && reachBefore.join() !== next.live.reach.join()) {
    text += ` Live now runs on ${list(next.live.reach)} (was ${list(reachBefore)}).`;
  } else if (ch.type === "live" && ch.on) {
    text += ` It runs on ${list(next.live.reach)}.`;
  }
  next.updatedAt = now;
  next.history = [{ at: now, text }, ...next.history].slice(0, HISTORY_KEPT);
  return { control: next, text };
}

/**
 * Which Insert popups have to change for this control to hold. insertForms: { DK: [{ id, name, status }], ... }
 * for the markets whose forms were read. Where live runs (live.reach) its live Insert popups come down; everywhere
 * else the popups this page took down go back up. Popups someone else unpublished are never published by this page.
 */
function insertPlan(control, insertForms) {
  const c = normalizeControl(control);
  const reach = new Set(c.live.reach);
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

// A change that touches live must see today's tags, not last week's.
function storeCheckIsFresh(control, now = Date.now()) {
  const at = Date.parse(control?.storeCheck?.at || "");
  return Number.isFinite(at) && now - at < STORE_CHECK_FRESH_MS;
}

/**
 * How the script behaves on a store, in words, read from signup/core/rules.js so the page cannot drift from the code.
 */
function behaviour() {
  const desktopFirst = rules.triggerPlan("desktop", 1);
  const desktopLater = rules.triggerPlan("desktop", 2);
  const phoneFirst = rules.triggerPlan("mobile", 1);
  const phoneLater = rules.triggerPlan("mobile", 2);
  const s = (ms) => `${Math.round(ms / 1000)} s`;
  const days = rules.SUPPRESSION.closedDays;
  return [
    { label: "On a computer", text: `Opens after ${s(desktopFirst.delayMs)} on the first page and ${s(desktopLater.delayMs)} on later pages${desktopFirst.exitIntent ? ", or when the pointer leaves the window" : ""}.` },
    { label: "On a phone or tablet", text: `Never opens by itself: a small card slides in after ${s(phoneFirst.delayMs)} (${s(phoneLater.delayMs)} on later pages) or ${Math.round(phoneFirst.scrollRatio * 100)}% down the page, and the experience opens when it is tapped. A dismissed card stays away ${rules.SUPPRESSION.peekDismissedDays} days.` },
    { label: "Never on", text: "Cart, checkout, the customer account, the wishlist, search, the newsletter page and sale or outlet pages." },
    { label: "Never for", text: `Someone who signed up, someone who came from one of our emails (and for ${rules.SUPPRESSION.emailVisitorDays} days after), someone Klaviyo already knows, and anyone who has seen it this session. It waits for the cookie banner to be answered.` },
    { label: "After a close", text: `Away ${days[0]} days, after a second close ${days[1]} days, after a third ${days[2]} days.` }
  ];
}

module.exports = {
  CONCEPTS,
  MARKET_LETTERS,
  STORE_CODE,
  HISTORY_KEPT,
  STORE_CHECK_FRESH_MS,
  SNIPPET,
  SNIPPET_PLACE,
  STAGING_HOSTS,
  defaultControl,
  normalizeControl,
  publicConfig,
  installedMarkets,
  targetReach,
  pendingReach,
  touchesLive,
  applyChange,
  insertPlan,
  recordInsertResults,
  storeCheckIsFresh,
  behaviour
};
