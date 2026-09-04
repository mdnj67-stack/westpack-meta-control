const fs = require("fs");
const path = require("path");

function createMetaSnapshotRuntime({
  fetchWithTimeout,
  graphBase,
  requestTimeoutMs
}) {
  const snapshotCache = new Map();
  const resourceCache = new Map();

  function nowMs() {
    return Date.now();
  }

  function buildMetaResourceCacheKey(kind = "", parts = []) {
    return [kind, ...parts.map((part) => String(part || ""))].join("|");
  }

  function getCachedMapEntry(store, cacheKey = "", maxAgeMs = 0) {
    if (!cacheKey || !store?.has(cacheKey)) {
      return null;
    }

    const entry = store.get(cacheKey);
    const ageMs = nowMs() - new Date(entry?.cachedAt || 0).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 0 || (maxAgeMs > 0 && ageMs > maxAgeMs)) {
      store.delete(cacheKey);
      return null;
    }

    return entry;
  }

  function setCachedMapEntry(store, cacheKey = "", payload) {
    if (!cacheKey || payload == null) {
      return;
    }

    store.set(cacheKey, {
      payload,
      cachedAt: new Date().toISOString()
    });
  }

  async function withTiming(timingStore, label, work) {
    const startedAt = nowMs();
    try {
      const result = await work();
      timingStore[label] = nowMs() - startedAt;
      return result;
    } catch (error) {
      timingStore[label] = nowMs() - startedAt;
      throw error;
    }
  }

  // bypassCache lets an explicit "Update snapshot" reach Meta even when a resource is
  // still inside its TTL. Without it, raising the insights TTL would leave no way to get
  // fresh numbers on demand: force=1 only skips the whole-response cache, not these
  // per-resource ones, so the user would press refresh and be handed the same figures.
  // The result is still written to the cache, so the next routine view is cheap again.
  async function getCachedMetaCollection({
    cacheKey,
    maxAgeMs,
    timingStore,
    timingLabel,
    fetcher,
    bypassCache = false
  }) {
    const cached = bypassCache ? null : getCachedMapEntry(resourceCache, cacheKey, maxAgeMs);
    if (cached) {
      if (timingStore && timingLabel) {
        timingStore[`${timingLabel}_cache`] = "hit";
        timingStore[`${timingLabel}_ms`] = 0;
      }
      return cached.payload;
    }

    const payload = await withTiming(timingStore || {}, timingLabel || cacheKey, fetcher);
    setCachedMapEntry(resourceCache, cacheKey, payload);
    if (timingStore && timingLabel && timingStore[`${timingLabel}_cache`] == null) {
      timingStore[`${timingLabel}_cache`] = "miss";
    }
    return payload;
  }

  function getMetaErrorMessage(payload = {}, fallback = "Meta request failed.") {
    return payload?.error?.message || fallback;
  }

  function isRateLimitError(message = "") {
    const text = String(message || "").toLowerCase();
    return text.includes("request limit reached")
      || text.includes("too many calls")
      || text.includes("rate limit")
      || text.includes("application request limit reached")
      || text.includes("user request limit reached");
  }

  function isTransientMetaError(message = "") {
    const text = String(message || "").toLowerCase();
    return isRateLimitError(text)
      || text.includes("temporarily unavailable")
      || text.includes("please reduce the amount of data")
      || text.includes("service unavailable")
      || text.includes("internal error")
      || text.includes("timeout")
      || text.includes("econnreset")
      || text.includes("fetch failed");
  }

  function buildSnapshotCacheKey(scope = {}) {
    return [
      String(scope?.preset || ""),
      String(scope?.since || ""),
      String(scope?.until || "")
    ].join("|");
  }

  function getCachedSnapshot(cacheKey = "") {
    if (!cacheKey || !snapshotCache.has(cacheKey)) {
      return null;
    }
    return snapshotCache.get(cacheKey) || null;
  }

  function isCacheFresh(entry, maxAgeMs) {
    if (!entry?.cachedAt) {
      return false;
    }
    const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeMs;
  }

  function setCachedSnapshot(cacheKey = "", payload) {
    if (!cacheKey || !payload) {
      return;
    }
    snapshotCache.set(cacheKey, {
      payload,
      cachedAt: new Date().toISOString()
    });
  }

  function readBundledCatalogFallback() {
    const candidates = [
      path.join(process.cwd(), "data", "meta-live.json")
    ];

    for (const filePath of candidates) {
      try {
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          continue;
        }

        return {
          generatedAt: parsed.generatedAt || new Date().toISOString(),
          account: parsed.account || null,
          campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
          adSets: Array.isArray(parsed.adSets) ? parsed.adSets : [],
          ads: Array.isArray(parsed.ads) ? parsed.ads : []
        };
      } catch (error) {
        // Ignore bundled fallback issues and continue.
      }
    }

    return null;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function metaFetchJson(url, requestPath, attempt = 0, maxRetries = 4) {
    try {
      const response = await fetchWithTimeout(url, {}, requestTimeoutMs);
      const payload = await response.json();

      if (response.ok && !payload.error) {
        return payload;
      }

      const message = getMetaErrorMessage(payload, `Meta request failed for ${requestPath}.`);
      const shouldRetry = isTransientMetaError(message) && attempt < maxRetries;
      if (shouldRetry) {
        const retryAfterHeader = Number(response.headers.get("retry-after"));
        const retryDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : 1200 * (attempt + 1);
        await delay(retryDelay);
        return metaFetchJson(url, requestPath, attempt + 1, maxRetries);
      }

      throw new Error(message);
    } catch (error) {
      const message = error?.message || `Meta request failed for ${requestPath}.`;
      const shouldRetry = isTransientMetaError(message) && attempt < maxRetries;
      if (shouldRetry) {
        await delay(1200 * (attempt + 1));
        return metaFetchJson(url, requestPath, attempt + 1, maxRetries);
      }
      throw error;
    }
  }

  async function metaGet(requestPath, accessToken, params = {}, options = {}) {
    const url = new URL(`${graphBase}${requestPath}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    url.searchParams.set("access_token", accessToken);

    return metaFetchJson(
      url.toString(),
      requestPath,
      0,
      Number.isFinite(options.maxRetries) ? options.maxRetries : 4
    );
  }

  async function metaGetAll(requestPath, accessToken, params = {}) {
    const allRows = [];
    let nextUrl = null;
    let pageCount = 0;

    while (true) {
      const payload = nextUrl
        ? await metaFetchJson(nextUrl, requestPath)
        : await metaGet(requestPath, accessToken, params);

      pageCount += 1;
      allRows.push(...(payload.data || []));

      if (!payload?.paging?.next) {
        return {
          data: allRows,
          pageCount
        };
      }

      nextUrl = payload.paging.next;
    }
  }

  return {
    buildMetaResourceCacheKey,
    buildSnapshotCacheKey,
    getCachedMetaCollection,
    getCachedSnapshot,
    isCacheFresh,
    isRateLimitError,
    isTransientMetaError,
    metaGet,
    metaGetAll,
    readBundledCatalogFallback,
    setCachedSnapshot
  };
}

module.exports = {
  createMetaSnapshotRuntime
};
