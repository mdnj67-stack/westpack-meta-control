// Campaign imagery arrives as short-lived signed Asana attachment URLs. Those URLs expire within
// hours, so anything that keeps one - a compiled email stored in Redis, a quality review that
// fetches the image, a draft a human opens days later - ends up pointing at a dead link. Every
// campaign image therefore has to be copied into Klaviyo's permanent image library before it is
// written into an artifact, and the hosted URL is what the rest of the pipeline uses.

const KLAVIYO_IMAGE_REVISION = "2026-04-15";
const KLAVIYO_IMAGE_UPLOAD_REVISION = "2026-07-15";
const KLAVIYO_UPLOAD_TIMEOUT_MS = 25_000;
const HOSTING_CONCURRENCY = 3;

// Klaviyo serves its image library from CloudFront. A URL already on one of these hosts is
// permanent and must pass through untouched - re-importing it would duplicate the library entry
// on every run.
const PERMANENT_IMAGE_HOST_PATTERN = /(?:^|\.)(?:cloudfront\.net|klaviyo\.com)$/i;

function assertSafeCampaignAssetUrl(value = "") {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") throw new Error("Campaign assets must use HTTPS.");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Campaign asset host is not allowed.");
  }
  return url.toString();
}

function isPermanentlyHostedImageUrl(value = "") {
  try {
    return PERMANENT_IMAGE_HOST_PATTERN.test(new URL(String(value || "")).hostname);
  } catch (error) {
    return false;
  }
}

function parseKlaviyoMarkets(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function resolveKlaviyoImageKey(config, account) {
  const wanted = String(account || "DK").trim().toUpperCase();
  const market = parseKlaviyoMarkets(config?.klaviyoMarketsJson)
    .find((item) => String(item?.country || "").trim().toUpperCase() === wanted);
  if (!market?.privateKey) throw new Error(`No Klaviyo image library is configured for ${wanted}.`);
  return String(market.privateKey).trim();
}

function readHostedImageUrl(payload) {
  const imageUrl = String(payload?.data?.attributes?.image_url || "");
  if (!imageUrl) throw new Error("Klaviyo image upload returned no hosted URL.");
  return { id: String(payload?.data?.id || ""), imageUrl };
}

// Klaviyo fetches the image itself from the supplied URL, so a still-valid Asana link can be
// handed straight over without downloading the bytes into this process first.
async function uploadEmailVisualToKlaviyo(config, account, sourceUrl, name) {
  const response = await fetch("https://a.klaviyo.com/api/images", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${resolveKlaviyoImageKey(config, account)}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: KLAVIYO_IMAGE_REVISION
    },
    signal: AbortSignal.timeout(KLAVIYO_UPLOAD_TIMEOUT_MS),
    body: JSON.stringify({
      data: {
        type: "image",
        attributes: { import_from_url: sourceUrl, name, hidden: false }
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.errors?.[0]?.detail || `Klaviyo image upload failed (${response.status}).`);
  return readHostedImageUrl(payload);
}

async function uploadEmailVisualFileToKlaviyo(config, account, file, name) {
  const extension = file.contentType === "image/png" ? ".png" : file.contentType === "image/gif" ? ".gif" : ".jpg";
  const filename = /\.(?:jpe?g|png|gif)$/i.test(name) ? name : `${name}${extension}`;
  const form = new FormData();
  form.append("file", new Blob([file.bytes], { type: file.contentType }), filename);
  form.append("name", filename);
  form.append("hidden", "false");
  const response = await fetch("https://a.klaviyo.com/api/image-upload", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${resolveKlaviyoImageKey(config, account)}`,
      Accept: "application/vnd.api+json",
      revision: KLAVIYO_IMAGE_UPLOAD_REVISION
    },
    signal: AbortSignal.timeout(KLAVIYO_UPLOAD_TIMEOUT_MS),
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.errors?.[0]?.detail || `Klaviyo image upload failed (${response.status}).`);
  return readHostedImageUrl(payload);
}

function buildHostedImageName(namePrefix, index) {
  const base = String(namePrefix || "campaign-image")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "campaign-image";
  return `${base}-${String(index + 1).padStart(2, "0")}.jpg`;
}

/**
 * Copies every source image into Klaviyo's permanent library and returns the mapping from the
 * original URL to the hosted one.
 *
 * The pipeline resumes in a fresh serverless invocation at every stage, and each resume refreshes
 * the Asana URLs, so the cache is keyed by a caller-supplied stable identity rather than by the
 * URL itself. Callers persist the returned cache in the job checkpoint; without it each of the
 * ten-odd stages would re-import the same photographs and fill the image library with duplicates.
 *
 * Hosting failures are deliberately not fatal. Losing a campaign because one attachment could not
 * be copied would be worse than compiling with the original URL, so a failed image keeps its
 * source URL and is reported in `failures` for the caller to record as a production note.
 */
async function hostCampaignImageUrls(config, urls = [], options = {}) {
  const {
    account = "DK",
    cache = {},
    keyForUrl = (url) => url,
    namePrefix = "campaign-image",
    upload = uploadEmailVisualToKlaviyo
  } = options;

  const nextCache = { ...cache };
  const hostedByUrl = new Map();
  const failures = [];
  const pending = [];

  const sourceUrls = [...new Set((Array.isArray(urls) ? urls : []).filter((url) => /^https?:\/\//i.test(String(url || ""))))];

  for (const sourceUrl of sourceUrls) {
    if (isPermanentlyHostedImageUrl(sourceUrl)) {
      hostedByUrl.set(sourceUrl, sourceUrl);
      continue;
    }
    const cacheKey = String(keyForUrl(sourceUrl) || sourceUrl);
    const cached = nextCache[cacheKey];
    if (cached) {
      hostedByUrl.set(sourceUrl, cached);
      continue;
    }
    pending.push({ sourceUrl, cacheKey });
  }

  for (let index = 0; index < pending.length; index += HOSTING_CONCURRENCY) {
    const batch = pending.slice(index, index + HOSTING_CONCURRENCY);
    const results = await Promise.all(batch.map(async (item, offset) => {
      try {
        const safeUrl = assertSafeCampaignAssetUrl(item.sourceUrl);
        const hosted = await upload(config, account, safeUrl, buildHostedImageName(namePrefix, index + offset));
        return { ...item, hostedUrl: hosted.imageUrl };
      } catch (error) {
        return { ...item, error: error?.message || "Klaviyo image hosting failed." };
      }
    }));
    for (const result of results) {
      if (result.hostedUrl) {
        nextCache[result.cacheKey] = result.hostedUrl;
        hostedByUrl.set(result.sourceUrl, result.hostedUrl);
      } else {
        hostedByUrl.set(result.sourceUrl, result.sourceUrl);
        failures.push({ sourceUrl: result.sourceUrl, error: result.error });
      }
    }
  }

  return {
    cache: nextCache,
    hostedByUrl,
    // Only the URLs that actually moved, so callers can remap artifacts without rewriting
    // everything back onto itself.
    replacements: new Map([...hostedByUrl].filter(([sourceUrl, hostedUrl]) => hostedUrl !== sourceUrl)),
    hostedCount: [...hostedByUrl].filter(([sourceUrl, hostedUrl]) => hostedUrl !== sourceUrl).length,
    failures
  };
}

module.exports = {
  assertSafeCampaignAssetUrl,
  buildHostedImageName,
  hostCampaignImageUrls,
  isPermanentlyHostedImageUrl,
  parseKlaviyoMarkets,
  uploadEmailVisualFileToKlaviyo,
  uploadEmailVisualToKlaviyo
};
