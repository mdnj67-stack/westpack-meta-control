const crypto = require("crypto");
const { sendJson } = require("./http");

const COOKIE_NAME = "westpack_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest();
}

function safeCompare(left, right) {
  const leftHash = sha256(left);
  const rightHash = sha256(right);
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function base64UrlEncode(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function getSigningSecret(config = {}) {
  return config.authSessionSecret || config.authPassword || "";
}

function signValue(value, secret) {
  return crypto.createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

function parseCookies(req) {
  const header = req?.headers?.cookie || "";
  return header.split(";").reduce((acc, chunk) => {
    const part = chunk.trim();
    if (!part) return acc;

    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) return acc;

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

function isSecureRequest(req) {
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").toLowerCase();
  const isLocalHost = forwardedHost.startsWith("127.0.0.1")
    || forwardedHost.startsWith("localhost")
    || forwardedHost.startsWith("[::1]");
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase();
  if (isLocalHost) {
    return forwardedProto === "https";
  }
  return forwardedProto === "https" || process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function buildSessionCookie(token, req) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];

  if (isSecureRequest(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildLogoutCookie(req) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];

  if (isSecureRequest(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function isAuthEnabled(config = {}) {
  return Boolean(config.authPassword);
}

function createSessionToken(config = {}) {
  const secret = getSigningSecret(config);
  if (!secret) {
    throw new Error("Missing auth signing secret.");
  }

  const payload = base64UrlEncode(JSON.stringify({ iat: Date.now() }));
  const signature = signValue(payload, secret);
  return `${payload}.${signature}`;
}

function verifySessionToken(token, config = {}) {
  if (!token || !isAuthEnabled(config)) {
    return false;
  }

  const secret = getSigningSecret(config);
  if (!secret) {
    return false;
  }

  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signValue(payload, secret);
  if (!safeCompare(signature, expectedSignature)) {
    return false;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload));
    const issuedAt = Number(parsed?.iat);
    if (!Number.isFinite(issuedAt)) {
      return false;
    }
    return (Date.now() - issuedAt) <= SESSION_TTL_MS;
  } catch (error) {
    return false;
  }
}

function isAuthenticated(req, config = {}) {
  if (!isAuthEnabled(config)) {
    return true;
  }

  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE_NAME], config);
}

function validatePassword(password, config = {}) {
  if (!isAuthEnabled(config)) {
    return true;
  }

  if (!password) {
    return false;
  }

  return safeCompare(String(password), String(config.authPassword));
}

function requireAuth(req, res, config = {}) {
  if (isAuthenticated(req, config)) {
    return true;
  }

  res.setHeader("Cache-Control", "no-store");
  sendJson(res, 401, { error: "Authentication required." });
  return false;
}

module.exports = {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionToken,
  isAuthEnabled,
  isAuthenticated,
  requireAuth,
  validatePassword
};
