const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { fetchWithTimeout, sendJson } = require("../../server/lib/http");
const TEMPLATE_API_REVISION = "2026-04-15";
// Campaign messages carry `content` (subject, preview_text, from_label) on this revision, as the
// subject-line history reads them; later revisions moved it under `definition`.
const CAMPAIGN_API_REVISION = "2024-10-15";
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

async function getAllPages(url, headers, { withIncluded = false } = {}) {
  const items = [];
  const included = [];
  let next = url;

  while (next) {
    const payload = await klaviyoRequest(next, headers);
    if (Array.isArray(payload?.data)) {
      items.push(...payload.data);
    }
    if (Array.isArray(payload?.included)) {
      included.push(...payload.included);
    }
    next = payload?.links?.next || null;
  }

  return withIncluded ? { items, included } : items;
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

    // {{ organization.url }} in a template is the account's website URL. Every header link and many
    // campaign links are built on it, so which store a market's email points at is decided here.
    if (String(req.query?.organization || "") === "1") {
      const response = await fetchWithTimeout("https://a.klaviyo.com/api/accounts/", { method: "GET", headers }, KLAVIYO_REQUEST_TIMEOUT_MS);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        sendJson(res, response.status, { error: payload?.errors?.[0]?.detail || `Klaviyo request failed (${response.status}).` });
        return;
      }
      const contact = payload?.data?.[0]?.attributes?.contact_information || {};
      sendJson(res, 200, {
        country,
        organizationName: String(contact.organization_name || ""),
        organizationUrl: String(contact.website_url || "")
      });
      return;
    }

    // What is about to go out: the account's email campaigns updated in the last `days` (default 21),
    // drafts and scheduled ones included, with each message's subject, preheader and sender and the
    // audiences by name. Read-only. Added 2026-11-17 to check a send the day before; the template a
    // message will send is then read with `messageId`.
    if (String(req.query?.campaigns || "") === "1") {
      const days = Math.max(1, Math.min(90, Number(req.query?.days) || 21));
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19);
      const campaignHeaders = buildHeaders(String(market.privateKey).trim(), CAMPAIGN_API_REVISION);
      const campaigns = await getAllPages(
        `https://a.klaviyo.com/api/campaigns/?filter=and(equals(messages.channel,'email'),greater-than(updated_at,${since}))`
          + "&sort=-updated_at&include=campaign-messages"
          + "&fields[campaign]=name,status,archived,audiences,send_options,tracking_options,send_strategy,created_at,scheduled_at,updated_at,send_time"
          + "&fields[campaign-message]=label,content,send_times",
        campaignHeaders,
        { withIncluded: true }
      );
      const messagesById = new Map(campaigns.included.map((item) => [item.id, item]));
      const audienceNames = new Map();
      const audienceIds = new Set();
      for (const item of campaigns.items) {
        const audiences = item?.attributes?.audiences || {};
        for (const id of [...(audiences.included || []), ...(audiences.excluded || [])]) audienceIds.add(id);
      }
      for (const id of audienceIds) {
        for (const kind of ["lists", "segments"]) {
          try {
            const payload = await klaviyoRequest(`https://a.klaviyo.com/api/${kind}/${encodeURIComponent(id)}/?fields[${kind.slice(0, -1)}]=name`, campaignHeaders);
            audienceNames.set(id, `${kind === "lists" ? "List" : "Segment"}: ${payload?.data?.attributes?.name || id}`);
            break;
          } catch (error) {
            // Not a list; try segments, else keep the id.
          }
        }
      }
      const named = (ids = []) => ids.map((id) => ({ id, name: audienceNames.get(id) || id }));
      sendJson(res, 200, {
        country,
        since,
        campaigns: campaigns.items.map((item) => {
          const attributes = item?.attributes || {};
          const messageIds = (item?.relationships?.["campaign-messages"]?.data || []).map((ref) => ref.id);
          return {
            id: String(item.id || ""),
            name: String(attributes.name || ""),
            status: String(attributes.status || ""),
            archived: Boolean(attributes.archived),
            createdAt: String(attributes.created_at || ""),
            updatedAt: String(attributes.updated_at || ""),
            scheduledAt: String(attributes.scheduled_at || ""),
            sendTime: String(attributes.send_time || ""),
            sendStrategy: attributes.send_strategy || null,
            sendOptions: attributes.send_options || null,
            trackingOptions: attributes.tracking_options || null,
            audiences: {
              included: named(attributes.audiences?.included),
              excluded: named(attributes.audiences?.excluded)
            },
            messages: messageIds.map((id) => {
              const message = messagesById.get(id)?.attributes || {};
              const content = message.content || message.definition?.content || {};
              return {
                id,
                label: String(message.label || message.definition?.label || ""),
                subject: String(content.subject || ""),
                previewText: String(content.preview_text || ""),
                fromEmail: String(content.from_email || ""),
                fromLabel: String(content.from_label || ""),
                replyToEmail: String(content.reply_to_email || ""),
                sendTimes: message.send_times || []
              };
            })
          };
        })
      });
      return;
    }

    // A sent campaign's email is a template that never appears in the template list, so it can only
    // be reached through its campaign message (the message id is `id` on a subject-line history row).
    const messageId = String(req.query?.messageId || "").trim();
    if (messageId) {
      const payload = await klaviyoRequest(
        `https://a.klaviyo.com/api/campaign-messages/${encodeURIComponent(messageId)}/template/`,
        headers
      );
      const attributes = payload?.data?.attributes || {};
      sendJson(res, 200, {
        country,
        messageId,
        template: {
          id: String(payload?.data?.id || ""),
          name: String(attributes.name || ""),
          editorType: String(attributes.editor_type || ""),
          created: String(attributes.created || ""),
          updated: String(attributes.updated || ""),
          html: String(attributes.html || ""),
          text: String(attributes.text || "")
        }
      });
      return;
    }

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
