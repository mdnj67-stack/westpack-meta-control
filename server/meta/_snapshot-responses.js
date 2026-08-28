function sendMetaHealthOk({
  res,
  sendJson,
  schedule,
  account,
  currency
}) {
  sendJson(res, 200, {
    ok: true,
    status: "online",
    schedule,
    account: {
      id: account.id,
      name: account.name || "",
      accountStatus: account.account_status ?? null,
      currency
    }
  });
}

function sendMetaCatalogCacheHit({
  res,
  sendJson,
  cachedCatalog
}) {
  sendJson(res, 200, {
    ...cachedCatalog.payload,
    cache: {
      status: "hit",
      cachedAt: cachedCatalog.cachedAt
    }
  });
}

function sendMetaSnapshotCacheHit({
  res,
  sendJson,
  cachedSnapshot
}) {
  sendJson(res, 200, {
    ...cachedSnapshot.payload,
    cache: {
      status: "hit",
      cachedAt: cachedSnapshot.cachedAt
    }
  });
}

function sendMetaTransientCatalogFallback({
  res,
  sendJson,
  cachedCatalog,
  reason
}) {
  sendJson(res, 200, {
    ...cachedCatalog.payload,
    cache: {
      status: "fallback",
      cachedAt: cachedCatalog.cachedAt,
      reason: reason || "Meta transient error"
    }
  });
}

function sendMetaRateLimitedHealth({
  res,
  sendJson,
  schedule,
  accountId,
  error
}) {
  sendJson(res, 200, {
    ok: false,
    status: "rate_limited",
    error: error || "Meta rate limit",
    schedule,
    account: {
      id: accountId,
      name: "",
      accountStatus: null,
      currency: ""
    }
  });
}

function sendMetaCatalogFallback({
  res,
  sendJson,
  fallbackCatalog,
  cachedAt,
  reason
}) {
  sendJson(res, 200, {
    ...fallbackCatalog,
    cache: {
      status: "fallback",
      cachedAt: cachedAt || "",
      reason: reason || "Meta rate limit"
    }
  });
}

function sendMetaSnapshotFallback({
  res,
  sendJson,
  cachedSnapshot,
  reason
}) {
  sendJson(res, 200, {
    ...cachedSnapshot.payload,
    cache: {
      status: "fallback",
      cachedAt: cachedSnapshot.cachedAt,
      reason: reason || "Meta rate limit"
    }
  });
}

module.exports = {
  sendMetaCatalogCacheHit,
  sendMetaCatalogFallback,
  sendMetaHealthOk,
  sendMetaRateLimitedHealth,
  sendMetaSnapshotCacheHit,
  sendMetaSnapshotFallback,
  sendMetaTransientCatalogFallback
};
