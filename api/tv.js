// The office TV. `?action=` dispatch:
//
//   GET  session  - { authenticated, passwordEnabled, via } - via is "tv", "session", "open" or null
//   POST login    - { password } -> the TV's own sign-in cookie (400 days, sent to /api/tv only)
//   POST logout   - clears it
//   GET  kpis     - the scenes, ready to render (TV sign-in or a normal session). `&fresh=1` skips the
//                   ten-minute cache; Klaviyo is still asked at most every three hours.
//
// Read-only towards Meta and Klaviyo. It makes no Graph call at all: the Meta figures are the ones the
// dashboard stored when it last built a snapshot. The only writes are the TV's own documents in Blob
// (tv/kpis.json, tv/subscriber-daily.json). See server/tv/kpi-sources.js.

const { getConfig } = require("../server/lib/config");
const { isAuthEnabled, validatePassword } = require("../server/lib/auth");
const { readJsonBody, sendJson } = require("../server/lib/http");
const { buildTvCookie, buildTvLogoutCookie, createTvToken, resolveTvAuth } = require("../server/tv/tv-auth");
const { getTvKpis } = require("../server/tv/kpi-sources");

function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed);
  return sendJson(res, 405, { error: "Method not allowed." });
}

async function handleLogin(req, res, config) {
  if (!isAuthEnabled(config)) return sendJson(res, 200, { authenticated: true, passwordEnabled: false, via: "open" });
  const body = (await readJsonBody(req)) || {};
  if (!validatePassword(String(body.password || ""), config)) {
    return sendJson(res, 401, { authenticated: false, passwordEnabled: true, error: "Forkert kodeord." });
  }
  res.setHeader("Set-Cookie", buildTvCookie(createTvToken(config), req));
  return sendJson(res, 200, { authenticated: true, passwordEnabled: true, via: "tv" });
}

module.exports = async (req, res) => {
  const config = getConfig();
  const action = String(req.query?.action || "").trim().toLowerCase();
  res.setHeader("Cache-Control", "no-store");

  try {
    if (action === "session") {
      if (req.method !== "GET") return methodNotAllowed(res, "GET");
      const via = resolveTvAuth(req, config);
      return sendJson(res, 200, { authenticated: via !== null, passwordEnabled: isAuthEnabled(config), via });
    }
    if (action === "login") {
      if (req.method !== "POST") return methodNotAllowed(res, "POST");
      return await handleLogin(req, res, config);
    }
    if (action === "logout") {
      if (req.method !== "POST") return methodNotAllowed(res, "POST");
      if (isAuthEnabled(config)) res.setHeader("Set-Cookie", buildTvLogoutCookie(req));
      return sendJson(res, 200, { authenticated: false, passwordEnabled: isAuthEnabled(config) });
    }
    if (action === "kpis") {
      if (req.method !== "GET") return methodNotAllowed(res, "GET");
      if (resolveTvAuth(req, config) === null) return sendJson(res, 401, { error: "Authentication required." });
      const { payload } = await getTvKpis({ config, fresh: String(req.query?.fresh || "") === "1" });
      return sendJson(res, 200, payload);
    }
    return sendJson(res, 400, { error: "Unsupported TV action." });
  } catch (error) {
    return sendJson(res, Number(error?.statusCode) || 500, { error: error?.message || "The TV request failed." });
  }
};
