// Canva OAuth token persistence.
//
// Runs on the same three backends as the rest of the app (Redis / atomic local file / volatile),
// reusing `agent-store.js`'s plumbing rather than growing a second copy of it - the same
// precedent `studio-draft-store.js` set. It does NOT share the agent's state blob: that is read
// and written whole on every worker operation, and a token refresh has no business contending
// with it.
//
// The one genuinely delicate thing here is refresh-token rotation. Canva invalidates a refresh
// token the moment it is exchanged and hands back a new one. Two concurrent requests that both
// decide the access token is stale will both try to refresh; the second exchange fails, and if
// the first one's result was not yet persisted the account is disconnected and a human has to
// click Connect again. So the refresh runs under a real lock, and the first thing the lock holder
// does is re-read the store - by then another invocation may already have refreshed, in which
// case there is nothing to do.

const fs = require("fs");
const path = require("path");
const { canUseLocalFile, acquireLocalLock, redisCommand, releaseLocalLock } = require("../campaign/agent-store");
const { refreshAccessToken } = require("./connect-client");

const STORE_KEY = "westpack:canva:oauth:v1";
const LOCK_KEY = `${STORE_KEY}:lock`;
const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "canva-tokens.json");
const LOCAL_LOCK_PATH = path.join(process.cwd(), "data", "canva-tokens.lock.json");
const LOCK_TTL_SECONDS = 30;
// Refresh a little before Canva's four-hour expiry rather than on it, so a long batch that starts
// with 40 seconds left on the clock does not fail halfway through.
const REFRESH_MARGIN_MS = 120000;

let volatileTokens = null;

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

function getTokenStoreProfile() {
  const redis = getRedisConfig();
  if (redis.url && redis.token) return { mode: "redis", persistent: true };
  if (canUseLocalFile()) return { mode: "local_file", persistent: true };
  return { mode: "volatile", persistent: false };
}

function normalizeTokens(value = null) {
  if (!value || typeof value !== "object") return null;
  const accessToken = String(value.accessToken || "");
  const refreshToken = String(value.refreshToken || "");
  if (!accessToken && !refreshToken) return null;
  return {
    accessToken,
    refreshToken,
    scope: String(value.scope || ""),
    expiresAt: String(value.expiresAt || ""),
    connectedAt: String(value.connectedAt || ""),
    displayName: String(value.displayName || ""),
    capabilities: Array.isArray(value.capabilities) ? value.capabilities.map((item) => String(item)) : []
  };
}

function readLocalTokens() {
  try {
    return normalizeTokens(JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, "utf8")));
  } catch (error) {
    return null;
  }
}

function writeLocalTokens(tokens) {
  fs.mkdirSync(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  const tempPath = `${LOCAL_STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(tokens, null, 2), "utf8");
  fs.renameSync(tempPath, LOCAL_STORE_PATH);
}

async function readCanvaTokens() {
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", STORE_KEY]);
    if (!raw) return null;
    try {
      return normalizeTokens(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (error) {
      return null;
    }
  }
  if (profile.mode === "local_file") return readLocalTokens();
  return normalizeTokens(volatileTokens);
}

async function writeCanvaTokens(value) {
  const tokens = normalizeTokens(value);
  if (!tokens) return null;
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", STORE_KEY, JSON.stringify(tokens)]);
  } else if (profile.mode === "local_file") {
    writeLocalTokens(tokens);
  } else {
    volatileTokens = tokens;
  }
  return tokens;
}

async function clearCanvaTokens() {
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["DEL", STORE_KEY]);
  } else if (profile.mode === "local_file") {
    try {
      fs.unlinkSync(LOCAL_STORE_PATH);
    } catch (error) {
      // Already disconnected is the outcome the caller wanted.
    }
  } else {
    volatileTokens = null;
  }
}

async function acquireRefreshLock(lockId) {
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    const result = await redisCommand(["SET", LOCK_KEY, String(lockId), "NX", "EX", String(LOCK_TTL_SECONDS)]);
    return result === "OK";
  }
  if (profile.mode === "local_file") return acquireLocalLock(lockId, LOCK_TTL_SECONDS, LOCAL_LOCK_PATH);
  // Volatile mode has no cross-invocation persistence, so there is nothing for a lock to protect.
  return true;
}

async function releaseRefreshLock(lockId) {
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    const current = await redisCommand(["GET", LOCK_KEY]);
    if (String(current || "") === String(lockId)) await redisCommand(["DEL", LOCK_KEY]);
    return;
  }
  if (profile.mode === "local_file") releaseLocalLock(lockId, LOCAL_LOCK_PATH);
}

function isExpiring(tokens) {
  if (!tokens?.expiresAt) return true;
  const expiresAt = Date.parse(tokens.expiresAt);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - Date.now() <= REFRESH_MARGIN_MS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns a usable access token, refreshing first if the stored one is about to expire. Throws a
// plain Error with a message the UI can show, because "not connected" and "the refresh token was
// revoked" are both things an operator can act on and neither is an internal fault.
async function getAccessToken({ clientId = "", clientSecret = "" } = {}) {
  const stored = await readCanvaTokens();
  if (!stored?.accessToken && !stored?.refreshToken) {
    throw new Error("Canva is not connected. Open Canva Localizer and connect the account.");
  }
  if (!isExpiring(stored)) return stored.accessToken;
  if (!stored.refreshToken) {
    throw new Error("The Canva session expired and no refresh token is stored. Reconnect the Canva account.");
  }
  if (!clientId || !clientSecret) {
    throw new Error("Canva client credentials are not configured, so the session cannot be refreshed.");
  }

  const lockId = `canva_refresh_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const deadline = Date.now() + 15000;
  while (!(await acquireRefreshLock(lockId))) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the Canva token refresh lock.");
    await sleep(150);
    // Another invocation may have finished the refresh while we waited, which is the common case
    // when a batch of 18 fans out. Re-reading first avoids burning the new refresh token.
    const refreshed = await readCanvaTokens();
    if (refreshed?.accessToken && !isExpiring(refreshed)) return refreshed.accessToken;
  }

  try {
    const current = await readCanvaTokens();
    if (current?.accessToken && !isExpiring(current)) return current.accessToken;

    const next = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: current?.refreshToken || stored.refreshToken
    });
    const saved = await writeCanvaTokens({
      ...current,
      ...next,
      connectedAt: current?.connectedAt || new Date().toISOString()
    });
    return saved.accessToken;
  } catch (error) {
    // A refresh that Canva rejects means the grant is gone for good - a revoked app, a changed
    // password, or a refresh token already spent. Leaving the dead pair in the store would make
    // every later call fail the same way with no route out, so the connection is cleared and the
    // operator is told to reconnect.
    if (error?.status === 400 || error?.status === 401) {
      await clearCanvaTokens();
      throw new Error("The Canva connection was rejected and has been cleared. Reconnect the Canva account.");
    }
    throw error;
  } finally {
    await releaseRefreshLock(lockId);
  }
}

// PKCE verifiers, held server-side between the authorize redirect and the callback.
//
// Canva requires that "the code_verifier value must not be accessible by the user or their
// browser", so it cannot ride along in a cookie or a query string. It is keyed by the `state`
// value, which doubles as the CSRF check: the callback is only honoured if it presents a state
// this server issued. That matters because the session cookie is SameSite=Strict and therefore
// is NOT sent on the cross-site navigation back from canva.com - the state is the only thing
// tying the callback to the operator who started it.
const PENDING_PREFIX = "westpack:canva:oauth:pending:v1";
const PENDING_TTL_SECONDS = 600;
const LOCAL_PENDING_DIR = path.join(process.cwd(), "data", "canva-oauth-pending");
const volatilePending = new Map();

function pendingLocalPath(state) {
  const safe = String(state || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  return path.join(LOCAL_PENDING_DIR, `${safe}.json`);
}

async function writePendingAuthorization(state, record) {
  const payload = { ...record, createdAt: new Date().toISOString() };
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    await redisCommand(["SET", `${PENDING_PREFIX}:${state}`, JSON.stringify(payload), "EX", String(PENDING_TTL_SECONDS)]);
    return payload;
  }
  if (profile.mode === "local_file") {
    fs.mkdirSync(LOCAL_PENDING_DIR, { recursive: true });
    fs.writeFileSync(pendingLocalPath(state), JSON.stringify(payload, null, 2), "utf8");
    return payload;
  }
  volatilePending.set(state, payload);
  return payload;
}

async function consumePendingAuthorization(state) {
  if (!state) return null;
  const profile = getTokenStoreProfile();
  if (profile.mode === "redis") {
    const raw = await redisCommand(["GET", `${PENDING_PREFIX}:${state}`]);
    await redisCommand(["DEL", `${PENDING_PREFIX}:${state}`]);
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (error) {
      return null;
    }
  }
  if (profile.mode === "local_file") {
    const filePath = pendingLocalPath(state);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      fs.unlinkSync(filePath);
      // A verifier older than its TTL is treated as absent. The local-file backend has no
      // expiry of its own, so the check has to be explicit or a stale authorization could be
      // replayed days later.
      if (Date.now() - Date.parse(parsed?.createdAt || 0) > PENDING_TTL_SECONDS * 1000) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }
  const stored = volatilePending.get(state) || null;
  volatilePending.delete(state);
  return stored;
}

module.exports = {
  clearCanvaTokens,
  consumePendingAuthorization,
  getAccessToken,
  writePendingAuthorization,
  getTokenStoreProfile,
  isExpiring,
  normalizeTokens,
  readCanvaTokens,
  writeCanvaTokens
};
