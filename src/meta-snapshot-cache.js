import {
  META_SNAPSHOT_SCHEMA_VERSION,
  isUsableMetaSnapshotBundle
} from "./data.js";

const META_SNAPSHOT_STORAGE_KEY = "westpack.metaSnapshotCache";
const META_STUDIO_SNAPSHOT_STORAGE_KEY = "westpack.metaStudioSnapshot";

export function buildMetaSnapshotCacheKey(options = {}) {
  return [
    String(options?.preset || ""),
    String(options?.from || ""),
    String(options?.to || "")
  ].join("|");
}

export function isUsableMetaDashboardSnapshot(snapshot = null) {
  return isUsableMetaSnapshotBundle(snapshot);
}

export function isUsableMetaStudioSnapshot(snapshot = null) {
  return isUsableMetaSnapshotBundle(snapshot, { requireDashboardMetrics: false });
}

export function readMetaSnapshotCacheStore() {
  try {
    const raw = localStorage.getItem(META_SNAPSHOT_STORAGE_KEY);
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const entries = Object.entries(parsed).filter(([, entry]) => {
      return Number(entry?.snapshot?.schemaVersion || 0) >= META_SNAPSHOT_SCHEMA_VERSION;
    });
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function writeMetaSnapshotCache(options = {}, snapshot) {
  try {
    const store = readMetaSnapshotCacheStore();
    const cacheKey = buildMetaSnapshotCacheKey(options);
    store[cacheKey] = {
      cachedAt: new Date().toISOString(),
      snapshot
    };
    localStorage.setItem(META_SNAPSHOT_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function readMetaSnapshotCache(options = {}) {
  try {
    const store = readMetaSnapshotCacheStore();
    const entry = store[buildMetaSnapshotCacheKey(options)];
    return entry && isUsableMetaDashboardSnapshot(entry.snapshot) ? entry : null;
  } catch {
    return null;
  }
}

export function writeMetaStudioSnapshot(snapshot) {
  try {
    if (!snapshot) return;
    localStorage.setItem(META_STUDIO_SNAPSHOT_STORAGE_KEY, JSON.stringify({
      cachedAt: new Date().toISOString(),
      snapshot
    }));
  } catch {}
}

export function readMetaStudioSnapshot() {
  try {
    const raw = localStorage.getItem(META_STUDIO_SNAPSHOT_STORAGE_KEY);
    const parsed = JSON.parse(raw || "{}");
    return parsed && isUsableMetaStudioSnapshot(parsed.snapshot) ? parsed.snapshot : null;
  } catch {
    return null;
  }
}

export function buildStudioCatalogSnapshot(payload = {}) {
  return {
    generatedAt: payload.generatedAt || new Date().toISOString(),
    account: payload.account || null,
    campaigns: Array.isArray(payload.campaigns) ? payload.campaigns : [],
    adSets: Array.isArray(payload.adSets) ? payload.adSets : [],
    ads: Array.isArray(payload.ads) ? payload.ads : [],
    stats: [],
    dashboard: null
  };
}

// The cache key is preset|from|to, and `to` is today, so it changes every day. That is
// correct for reads - you should not be shown yesterday's range as though it were today's
// - but it means a Monday morning with Meta throttled finds nothing under today's key and
// the dashboard has no data at all, even though Friday's snapshot is still in the browser.
//
// This returns the most recently cached snapshot under ANY key, for the rate-limited
// fallback only. The caller must label what range it actually covers; stale data that says
// so is better than a blank dashboard, but it must never be mistaken for current.
export function readMostRecentMetaSnapshotCache() {
  try {
    const store = readMetaSnapshotCacheStore();
    const entries = Object.entries(store)
      .map(([cacheKey, entry]) => ({ cacheKey, ...entry }))
      .filter((entry) => isUsableMetaDashboardSnapshot(entry.snapshot))
      .sort((left, right) => {
        const leftAt = new Date(left.cachedAt || 0).getTime() || 0;
        const rightAt = new Date(right.cachedAt || 0).getTime() || 0;
        return rightAt - leftAt;
      });
    return entries[0] || null;
  } catch {
    return null;
  }
}
