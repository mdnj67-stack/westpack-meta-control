const fs = require("fs");
const path = require("path");

// The shared persistence plumbing for the app's small server-side stores: Studio drafts, the
// asset library, the audit log, campaign learning, Canva tokens and jobs, Klaviyo subscriber
// history. Three backends - Redis when configured, an atomic local file in development, and
// volatile memory otherwise.
//
// The file keeps its name from the Content Agent, which this used to persist and which was
// decommissioned on 2026-10-30. Only the plumbing the other stores import is left.

function getRedisConfig() {
  return {
    url: String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, ""),
    token: String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

async function redisCommand(command = []) {
  const redis = getRedisConfig();
  if (!redis.url || !redis.token) throw new Error("Redis persistence is not configured.");
  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `Redis request failed (${response.status}).`);
  return payload?.result;
}

function canUseLocalFile() {
  return !process.env.VERCEL;
}

function readLocalLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    return null;
  }
}

function acquireLocalLock(lockId, ttlSeconds, lockPath) {
  const now = Date.now();
  const expiresAt = now + Math.max(1, Number(ttlSeconds) || 0) * 1000;
  const payload = JSON.stringify({ lockId: String(lockId), expiresAt });
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    // Exclusive create is atomic at the OS level, so a fresh lock can't race another acquirer.
    fs.writeFileSync(lockPath, payload, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const current = readLocalLock(lockPath);
  if (current && String(current.lockId) !== String(lockId) && Number(current.expiresAt) > now) {
    return false;
  }
  // The held lock looks stale (or unreadable): steal it. A plain overwrite here would let two
  // callers racing the same expiry both believe they won, so possession is taken atomically
  // first (fs.renameSync on the existing lock path — if two callers race this, only one rename
  // of the lock path can succeed; the loser's rename source is already gone and throws ENOENT),
  // and only *after* holding it exclusively do we decide whether the steal was actually valid.
  // That second check matters because the file we renamed away might not be the stale lock we
  // just read: another caller could have raced in and written a fresh, non-expired lock into the
  // gap between our read above and our rename below. If so, we put back exactly what we took and
  // report failure, instead of destroying someone else's valid lock.
  const stolenPath = `${lockPath}.${process.pid}.${now}.stolen`;
  try {
    fs.renameSync(lockPath, stolenPath);
  } catch (error) {
    if (error.code === "ENOENT") return false; // another caller already took it
    throw error;
  }
  let heldLock = null;
  try {
    heldLock = JSON.parse(fs.readFileSync(stolenPath, "utf8"));
  } catch (error) {
    heldLock = null; // unreadable/corrupt — treat the same as "no valid lock", safe to steal
  }
  const stillStale = !heldLock || String(heldLock.lockId) === String(lockId) || Number(heldLock.expiresAt) <= now;
  if (!stillStale) {
    try {
      fs.renameSync(stolenPath, lockPath);
    } catch (error) {
      // Could not restore it (e.g. its owner already renewed/released independently) — either
      // way we did not win the steal.
    }
    return false;
  }
  try {
    // Exclusive create: guards against a fresh (non-expired) lock being written by a different
    // caller in the brief window between validating heldLock above and this write.
    fs.writeFileSync(lockPath, payload, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return false;
  }
  try {
    fs.unlinkSync(stolenPath);
  } catch (error) {
    // Best-effort cleanup of the stolen-lock marker; leaving it behind is harmless.
  }
  return true;
}

function releaseLocalLock(lockId, lockPath) {
  const current = readLocalLock(lockPath);
  if (!current || String(current.lockId) !== String(lockId)) return;
  try {
    fs.unlinkSync(lockPath);
  } catch (error) {
    // Already released.
  }
}

function getAgentStoreProfile() {
  const redis = getRedisConfig();
  if (redis.url && redis.token) return { mode: "redis", persistent: true };
  if (canUseLocalFile()) return { mode: "local_file", persistent: true };
  return { mode: "volatile", persistent: false };
}

module.exports = {
  // Exported so other stores can reuse the same three backends (Redis / atomic local file /
  // volatile) instead of growing a second, subtly different copy of the plumbing. Every caller
  // of the local lock passes its own lock file, so unrelated stores never contend.
  canUseLocalFile,
  redisCommand,
  acquireLocalLock,
  getAgentStoreProfile,
  releaseLocalLock
};
