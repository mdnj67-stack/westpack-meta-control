// The office TV's own sign-in.
//
// The app's session lasts 12 hours, so a TV left on a wall would be logged out every morning. The TV
// gets a token of its own instead: valid for 400 days (the longest a browser keeps a cookie), sent
// only to /api/tv, and signed with a key derived from - never equal to - the session signing secret.
// That separation is the point: a TV token can never be accepted as a session cookie by the rest of
// the app, and a session token can never be passed off as a TV token. The password is folded into
// the derived key on its own, so changing the shared password ends every TV's sign-in even where a
// separate AUTH_SESSION_SECRET stays the same.
//
// A normal session is also accepted on /api/tv, so someone already logged in can open the TV page
// on their own screen. With no password configured the app is open, and so is this.

const crypto = require("crypto");
const {
  getSigningSecret,
  isAuthEnabled,
  isAuthenticated,
  isSecureRequest,
  parseCookies,
  safeCompare
} = require("../lib/auth");

const TV_COOKIE_NAME = "westpack_tv";
const TV_COOKIE_PATH = "/api/tv";
const TV_SCOPE = "tv";
const TV_KEY_CONTEXT = "westpack-tv-display:v1";
const TV_TOKEN_TTL_MS = 400 * 24 * 60 * 60 * 1000;
// A token stamped a little in the future is clock skew between instances; a long way in the future is
// not a token this code wrote.
const TV_CLOCK_SKEW_MS = 5 * 60 * 1000;

function deriveTvKey(config = {}) {
  const secret = getSigningSecret(config);
  if (!secret || !config.authPassword) return null;
  const passwordDigest = crypto.createHash("sha256").update(String(config.authPassword), "utf8").digest("hex");
  return crypto.createHmac("sha256", secret).update(`${TV_KEY_CONTEXT}\n${passwordDigest}`, "utf8").digest();
}

function sign(payload, key) {
  return crypto.createHmac("sha256", key).update(payload, "utf8").digest("base64url");
}

function createTvToken(config = {}, now = Date.now()) {
  const key = deriveTvKey(config);
  if (!key) throw new Error("Missing auth signing secret.");
  const payload = Buffer.from(JSON.stringify({ iat: now, scope: TV_SCOPE }), "utf8").toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

function verifyTvToken(token, config = {}, now = Date.now()) {
  if (!token || !isAuthEnabled(config)) return false;
  const key = deriveTvKey(config);
  if (!key) return false;
  const parts = String(token).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  if (!safeCompare(parts[1], sign(parts[0], key))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (parsed?.scope !== TV_SCOPE) return false;
    const issuedAt = Number(parsed?.iat);
    if (!Number.isFinite(issuedAt)) return false;
    if (issuedAt - now > TV_CLOCK_SKEW_MS) return false;
    return now - issuedAt <= TV_TOKEN_TTL_MS;
  } catch {
    return false;
  }
}

// parseCookies decodes each value and throws on a malformed one; a bad cookie is no cookie.
function readCookies(req) {
  try {
    return parseCookies(req);
  } catch {
    return {};
  }
}

// How the request is signed in: "open" (no password configured), "tv", "session", or null.
function resolveTvAuth(req, config = {}, now = Date.now()) {
  if (!isAuthEnabled(config)) return "open";
  if (verifyTvToken(readCookies(req)[TV_COOKIE_NAME], config, now)) return "tv";
  try {
    if (isAuthenticated(req, config)) return "session";
  } catch {
    // A malformed cookie header: not signed in.
  }
  return null;
}

function isTvAuthenticated(req, config = {}, now = Date.now()) {
  return resolveTvAuth(req, config, now) !== null;
}

function cookieParts(value, maxAgeSeconds, req) {
  const parts = [
    `${TV_COOKIE_NAME}=${value}`,
    `Path=${TV_COOKIE_PATH}`,
    "HttpOnly",
    // Lax, not the session's Strict: the TV page may be opened from a bookmark or a link, and a
    // read-only scoreboard has nothing a cross-site request could misuse.
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function buildTvCookie(token, req) {
  return cookieParts(encodeURIComponent(token), Math.floor(TV_TOKEN_TTL_MS / 1000), req);
}

function buildTvLogoutCookie(req) {
  return cookieParts("", 0, req);
}

module.exports = {
  TV_COOKIE_NAME,
  TV_COOKIE_PATH,
  TV_TOKEN_TTL_MS,
  buildTvCookie,
  buildTvLogoutCookie,
  createTvToken,
  isTvAuthenticated,
  resolveTvAuth,
  verifyTvToken
};
