// Who may read the office TV's feed (/api/tv?action=kpis).
//
// The TV itself is a project of its own (westpack-tv, C:\Projects\westpack-tv) with its own sign-in.
// Its server asks this route for the figures server to server, with `Authorization: Bearer
// <TV_FEED_TOKEN>`; the same secret is set on both Vercel projects. Someone logged in to this app may
// read the feed too. Nothing else gets in: a short or missing TV_FEED_TOKEN accepts no token at all.

const { isAuthenticated, safeCompare } = require("../lib/auth");

const MIN_FEED_TOKEN_LENGTH = 32;

function readBearer(req) {
  const header = String(req?.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

// "feed" (the TV project), "session" (signed in here, or no password configured), or null.
function resolveFeedAccess(req, config = {}, env = process.env) {
  const expected = String(env.TV_FEED_TOKEN || "");
  const presented = readBearer(req);
  if (presented && expected.length >= MIN_FEED_TOKEN_LENGTH && safeCompare(presented, expected)) return "feed";
  try {
    if (isAuthenticated(req, config)) return "session";
  } catch {
    // a malformed cookie header is no session
  }
  return null;
}

module.exports = { MIN_FEED_TOKEN_LENGTH, readBearer, resolveFeedAccess };
