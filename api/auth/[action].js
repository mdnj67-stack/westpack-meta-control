const { getConfig } = require("../../server/lib/config");
const { readJsonBody, sendJson } = require("../../server/lib/http");
const {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionToken,
  isAuthEnabled,
  isAuthenticated,
  validatePassword
} = require("../../server/lib/auth");

async function handleLogin(req, res, config) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  if (!isAuthEnabled(config)) {
    sendJson(res, 200, {
      authenticated: true,
      passwordEnabled: false
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const password = String(body?.password || "");

    if (!validatePassword(password, config)) {
      sendJson(res, 401, {
        authenticated: false,
        passwordEnabled: true,
        error: "Forkert kodeord."
      });
      return;
    }

    const token = createSessionToken(config);
    res.setHeader("Set-Cookie", buildSessionCookie(token, req));
    sendJson(res, 200, {
      authenticated: true,
      passwordEnabled: true
    });
  } catch (error) {
    sendJson(res, 400, {
      error: error.message || "Kunne ikke behandle login."
    });
  }
}

function handleLogout(req, res, config) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  if (isAuthEnabled(config)) {
    res.setHeader("Set-Cookie", buildLogoutCookie(req));
  }

  sendJson(res, 200, {
    authenticated: false,
    passwordEnabled: isAuthEnabled(config)
  });
}

function handleSession(req, res, config) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const passwordEnabled = isAuthEnabled(config);
  res.setHeader("Cache-Control", "no-store");
  sendJson(res, 200, {
    authenticated: isAuthenticated(req, config),
    passwordEnabled
  });
}

module.exports = async (req, res) => {
  const config = getConfig();
  const action = String(req.params?.action || req.query?.action || "").trim().toLowerCase();

  if (action === "login") {
    await handleLogin(req, res, config);
    return;
  }

  if (action === "logout") {
    handleLogout(req, res, config);
    return;
  }

  if (action === "session") {
    handleSession(req, res, config);
    return;
  }

  sendJson(res, 404, { error: "Not found." });
};
