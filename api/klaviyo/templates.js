const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { fetchWithTimeout, sendJson } = require("../../server/lib/http");
const TEMPLATE_API_REVISION = "2026-04-15";
const KLAVIYO_REQUEST_TIMEOUT_MS = 12000;
const TEMPLATE_LIST_CACHE_TTL_MS = 2 * 60 * 1000;
const TEMPLATE_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const TEMPLATE_CACHE = new Map();

function parseMarkets(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error("Invalid KLAVIYO_MARKETS_JSON.");
  }
}

function buildHeaders(privateKey, revision) {
  return {
    Authorization: `Klaviyo-API-Key ${privateKey}`,
    Accept: "application/vnd.api+json",
    revision
  };
}

function getCacheEntry(cacheKey, ttlMs) {
  const entry = TEMPLATE_CACHE.get(cacheKey);
  if (!entry) {
    return null;
  }

  const ageMs = Date.now() - entry.cachedAt;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > ttlMs) {
    TEMPLATE_CACHE.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function setCacheEntry(cacheKey, value) {
  TEMPLATE_CACHE.set(cacheKey, {
    cachedAt: Date.now(),
    value
  });
}

async function klaviyoRequest(url, headers) {
  const response = await fetchWithTimeout(url, { headers }, KLAVIYO_REQUEST_TIMEOUT_MS);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.errors?.[0]?.detail || payload?.message || `Klaviyo request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

async function getAllPages(url, headers) {
  const items = [];
  let next = url;

  while (next) {
    const payload = await klaviyoRequest(next, headers);
    if (Array.isArray(payload?.data)) {
      items.push(...payload.data);
    }
    next = payload?.links?.next || null;
  }

  return items;
}

async function getAllTemplates(headers) {
  const items = [];
  let next = "https://a.klaviyo.com/api/templates?sort=-updated&fields[template]=name,created,updated,editor_type";

  while (next && items.length < 20) {
    const payload = await klaviyoRequest(next, headers);
    if (Array.isArray(payload?.data)) {
      items.push(...payload.data);
    }
    next = payload?.links?.next || null;
  }

  return items.slice(0, 20);
}

async function getLegacyTemplates(privateKey) {
  const url = new URL("https://a.klaviyo.com/api/v1/email-templates");
  url.searchParams.set("api_key", privateKey);
  url.searchParams.set("count", "20");
  url.searchParams.set("page", "0");

  const response = await fetchWithTimeout(
    url.toString(),
    {
      headers: {
        Accept: "application/json"
      }
    },
    KLAVIYO_REQUEST_TIMEOUT_MS
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Klaviyo legacy template request failed (${response.status}).`;
    throw new Error(message);
  }

  return Array.isArray(payload) ? payload : [];
}

function mapLegacyTemplate(item = {}) {
  return {
    id: String(item.id || item.template_id || item.templateId || ""),
    account: "",
    name: String(item.name || item.title || "Untitled template"),
    editorType: String(item.editor_type || item.editorType || "LEGACY"),
    created: String(item.created || item.created_at || item.createdAt || ""),
    updated: String(item.updated || item.updated_at || item.updatedAt || "")
  };
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = async function handler(req, res) {
  const config = getConfig();
  if (!requireAuth(req, res, config)) {
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const country = String(req.query?.country || "").trim().toUpperCase();
    const templateId = String(req.query?.templateId || "").trim();
    if (!country) {
      sendJson(res, 400, { error: "Missing country query parameter." });
      return;
    }

    const markets = parseMarkets(config.klaviyoMarketsJson);
    const market = markets.find((item) => String(item?.country || "").trim().toUpperCase() === country);
    if (!market?.privateKey) {
      sendJson(res, 404, { error: `No Klaviyo market configuration found for ${country}.` });
      return;
    }

    const headers = buildHeaders(String(market.privateKey).trim(), TEMPLATE_API_REVISION);
    const listCacheKey = `templates:${country}`;
    const detailCacheKey = templateId ? `template-detail:${country}:${templateId}` : "";
    let templates = [];
    let source = "modern";
    const cachedList = getCacheEntry(listCacheKey, TEMPLATE_LIST_CACHE_TTL_MS);

    if (cachedList) {
      templates = cachedList.templates;
      source = cachedList.source;
    } else {
      templates = await getAllTemplates(headers);
      source = "modern";

      if (!templates.length) {
        try {
          const legacyTemplates = await getLegacyTemplates(String(market.privateKey).trim());
          templates = legacyTemplates;
          source = "legacy";
        } catch (error) {
          source = "modern";
        }
      }

      setCacheEntry(listCacheKey, { templates, source });
    }

    let selectedTemplate = null;
    if (templateId) {
      selectedTemplate = getCacheEntry(detailCacheKey, TEMPLATE_DETAIL_CACHE_TTL_MS);

      if (!selectedTemplate) {
        try {
          const detailPayload = await klaviyoRequest(
            `https://a.klaviyo.com/api/templates/${encodeURIComponent(templateId)}?additional-fields[template]=definition`,
            headers
          );
          const data = detailPayload?.data || null;
          if (data) {
            const attributes = data.attributes || {};
            const html = String(attributes.html || "");
            selectedTemplate = {
              id: String(data.id || ""),
              account: country,
              name: String(attributes.name || ""),
              editorType: String(attributes.editor_type || ""),
              created: String(attributes.created || ""),
              updated: String(attributes.updated || ""),
              subject: "",
              html,
              text: String(attributes.text || ""),
              previewText: stripHtml(attributes.text || html).slice(0, 240),
              definition: attributes.definition && typeof attributes.definition === "object"
                ? attributes.definition
                : null
            };
            setCacheEntry(detailCacheKey, selectedTemplate);
          }
        } catch (error) {
          selectedTemplate = null;
        }
      }
    }

    sendJson(res, 200, {
      country,
      source,
      templateCount: templates.length,
      templates: source === "legacy"
        ? templates.map((item) => mapLegacyTemplate(item))
        : templates.map((item) => {
          const attributes = item?.attributes || {};
          return {
            id: String(item?.id || ""),
            account: country,
            name: String(attributes.name || ""),
            editorType: String(attributes.editor_type || ""),
            created: String(attributes.created || ""),
            updated: String(attributes.updated || ""),
            subject: "",
            previewText: "",
            body: "",
            html: ""
          };
        }),
      selectedTemplate
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Klaviyo templates request failed." });
  }
};
