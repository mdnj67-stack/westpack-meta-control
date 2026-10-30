// Campaign imagery arrives as short-lived signed Asana attachment URLs. Those URLs expire within
// hours, so anything that keeps one - a saved Studio draft, an asset library record, a draft a
// human opens days later - ends up pointing at a dead link. Campaign Studio therefore copies
// each image into Klaviyo's permanent image library (`host_email_asset`) before using it.

const KLAVIYO_IMAGE_REVISION = "2026-04-15";
const KLAVIYO_IMAGE_UPLOAD_REVISION = "2026-07-15";
const KLAVIYO_UPLOAD_TIMEOUT_MS = 25_000;

function assertSafeCampaignAssetUrl(value = "") {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") throw new Error("Campaign assets must use HTTPS.");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Campaign asset host is not allowed.");
  }
  return url.toString();
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

module.exports = {
  assertSafeCampaignAssetUrl,
  parseKlaviyoMarkets,
  uploadEmailVisualFileToKlaviyo,
  uploadEmailVisualToKlaviyo
};
