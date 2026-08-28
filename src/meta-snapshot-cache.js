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
