// Canva Connect OAuth, both halves on one URL.
//
// `GET /api/canva/oauth` with no query starts the flow; the same URL with `?code=&state=` is the
// redirect Canva sends the operator back to. One route because Canva matches the registered
// redirect URL exactly, so having a single, stable, obvious URL to paste into the developer
// portal is worth more than two tidier handlers.
//
// Auth note: the start leg requires the dashboard session, so only someone already inside the
// app can bind a Canva account. The callback leg deliberately does not, because the session
// cookie is SameSite=Strict and is therefore not sent on the cross-site navigation back from
// canva.com. What protects the callback is the `state` value: it is generated here, stored
// server-side next to its PKCE verifier, single-use, and expires in ten minutes.

const crypto = require("crypto");
const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  getUserCapabilities,
  getUserProfile
} = require("../../server/canva/connect-client");
const {
  consumePendingAuthorization,
  writeCanvaTokens,
  writePendingAuthorization
} = require("../../server/canva/token-store");

function base64Url(buffer) {
  return buffer.toString("base64url");
}

function createCodeVerifier() {
  // Canva requires 43-128 characters of high entropy. 64 random bytes base64url-encoded is 86.
  return base64Url(crypto.randomBytes(64));
}

function createCodeChallenge(verifier) {
  return base64Url(crypto.createHash("sha256").update(verifier, "utf8").digest());
}

function resolveRedirectUri(req, config) {
  if (config.canvaRedirectUri) return config.canvaRedirectUri;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim()
    || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}/api/canva/oauth`;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

// Every exit from the callback lands the operator back on the Localizer with a readable reason,
// rather than on a bare JSON error page they then have to navigate away from.
function returnToApp(res, params) {
  redirect(res, `/?${new URLSearchParams(params).toString()}#canva-localizer`);
}

module.exports = async (req, res) => {
  const config = getConfig();
  const url = new URL(req.url, "http://localhost");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const oauthError = url.searchParams.get("error") || "";

  if (!config.canvaClientId || !config.canvaClientSecret) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Canva is not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET.");
    return;
  }

  const redirectUri = resolveRedirectUri(req, config);

  if (oauthError) {
    returnToApp(res, { canva: "error", reason: oauthError.slice(0, 120) });
    return;
  }

  if (!code) {
    if (!requireAuth(req, res, config)) return;
    const verifier = createCodeVerifier();
    const nextState = base64Url(crypto.randomBytes(24));
    await writePendingAuthorization(nextState, { verifier, redirectUri });
    redirect(res, buildAuthorizeUrl({
      clientId: config.canvaClientId,
      redirectUri,
      codeChallenge: createCodeChallenge(verifier),
      state: nextState
    }));
    return;
  }

  const pending = await consumePendingAuthorization(state);
  if (!pending?.verifier) {
    returnToApp(res, { canva: "error", reason: "expired_state" });
    return;
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      clientId: config.canvaClientId,
      clientSecret: config.canvaClientSecret,
      code,
      codeVerifier: pending.verifier,
      // Canva validates the redirect_uri on the exchange against the one used on the authorize
      // call, so the stored value is used rather than re-deriving it from this request.
      redirectUri: pending.redirectUri || redirectUri
    });

    // Capabilities are read once, at connect time, and stored with the tokens. Whether this
    // account can call the autofill API at all is a plan fact the operator has to see before
    // they set up a job, not an error they discover after tagging a design.
    const [profile, capabilities] = await Promise.all([
      getUserProfile(tokens.accessToken).catch(() => ({ displayName: "" })),
      getUserCapabilities(tokens.accessToken).catch(() => [])
    ]);

    await writeCanvaTokens({
      ...tokens,
      displayName: profile.displayName,
      capabilities,
      connectedAt: new Date().toISOString()
    });

    returnToApp(res, { canva: "connected" });
  } catch (error) {
    returnToApp(res, { canva: "error", reason: String(error?.message || "exchange_failed").slice(0, 160) });
  }
};
