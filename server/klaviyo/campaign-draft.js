// Creates a Klaviyo email campaign as a DRAFT and renders a template the way Klaviyo will send it.
//
// Added 2026-11-17 for the W46 Boxulator rollout, at the user's request: "opret som kampagner men hverken med send
// eller scheduling, det gør jeg selv. Bruger samme segment som dagens kampagne". So a draft copies its audiences,
// sender, smart sending and tracking (UTM) settings from a campaign the team already set up in the same account,
// takes the subject line given, and gets a template assigned. Nothing here sends or schedules: there is no request
// to campaign-send-jobs in this module, and tests/klaviyo-campaign-draft.test.js fails if one appears.
//
// Campaign messages carry `content` (subject, preview_text, from_label) on this revision; later revisions moved it
// under `definition`, so every request here is pinned to it.
const CAMPAIGN_REVISION = "2024-10-15";
const API = "https://a.klaviyo.com/api";

// Klaviyo answers with nulls it does not accept back on a create.
function withoutNulls(value) {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, withoutNulls(v)]));
  }
  return value;
}

async function readSourceCampaign(klaviyoRequest, headers, campaignId) {
  const payload = await klaviyoRequest(`${API}/campaigns/${encodeURIComponent(campaignId)}/?include=campaign-messages`, headers);
  const attributes = payload?.data?.attributes || {};
  const message = (payload?.included || []).find((item) => item?.type === "campaign-message");
  const content = message?.attributes?.content || message?.attributes?.definition?.content || {};
  if (!payload?.data?.id || !message) throw new Error(`Source campaign ${campaignId} has no email message to copy.`);
  return {
    id: payload.data.id,
    name: String(attributes.name || ""),
    audiences: { included: attributes.audiences?.included || [], excluded: attributes.audiences?.excluded || [] },
    // Only smart sending is copied: ignore_unsubscribes and friends are not something a draft should inherit.
    sendOptions: { use_smart_sending: attributes.send_options?.use_smart_sending !== false },
    trackingOptions: withoutNulls(attributes.tracking_options || {}),
    // An empty reply-to on a campaign set up in Klaviyo means "the sender"; the API refuses a create without one
    // ("Missing reply_to_email", 2026-11-17), so the sender is written in.
    sender: {
      from_email: String(content.from_email || ""),
      from_label: String(content.from_label || ""),
      reply_to_email: String(content.reply_to_email || content.from_email || ""),
      cc_email: content.cc_email || null,
      bcc_email: content.bcc_email || null
    }
  };
}

function buildCampaignPayload({ name, subject, previewText = "", label = "", source }) {
  return {
    data: {
      type: "campaign",
      attributes: {
        name,
        audiences: source.audiences,
        send_options: source.sendOptions,
        tracking_options: source.trackingOptions,
        "campaign-messages": {
          data: [{
            type: "campaign-message",
            attributes: {
              channel: "email",
              label: label || name,
              content: withoutNulls({ subject, preview_text: previewText, ...source.sender })
            }
          }]
        }
      }
    }
  };
}

// A retry must not leave two drafts: a draft with the same name made in the last 30 days is reused.
async function findDraftByName(klaviyoRequest, headers, name) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19);
  let next = `${API}/campaigns/?filter=and(equals(messages.channel,'email'),greater-than(updated_at,${since}))&include=campaign-messages&fields[campaign]=name,status`;
  while (next) {
    const payload = await klaviyoRequest(next, headers);
    const hit = (payload?.data || []).find((item) => item?.attributes?.name === name && item?.attributes?.status === "Draft");
    if (hit) return { id: hit.id, messageId: hit.relationships?.["campaign-messages"]?.data?.[0]?.id || "" };
    next = payload?.links?.next || "";
  }
  return null;
}

async function assignTemplate(klaviyoRequest, headers, messageId, templateId) {
  return klaviyoRequest(`${API}/campaign-message-assign-template/`, headers, "POST", {
    data: { type: "campaign-message", id: messageId, relationships: { template: { data: { type: "template", id: templateId } } } }
  });
}

async function createCampaignDraft({ klaviyoRequest, headers, name, subject, previewText = "", templateId, sourceCampaignId, dryRun = false }) {
  if (!name || !subject || !templateId || !sourceCampaignId) throw new Error("Missing name, subject, templateId or sourceCampaignId.");
  const source = await readSourceCampaign(klaviyoRequest, headers, sourceCampaignId);
  const payload = buildCampaignPayload({ name, subject, previewText, source });
  const summary = {
    name,
    subject,
    previewText,
    templateId,
    copiedFrom: { id: source.id, name: source.name },
    audiences: source.audiences,
    sender: source.sender,
    sendOptions: source.sendOptions,
    trackingOptions: source.trackingOptions
  };
  if (dryRun) return { ...summary, dryRun: true, payload };

  const existing = await findDraftByName(klaviyoRequest, headers, name);
  let campaignId;
  let messageId;
  if (existing?.messageId) {
    campaignId = existing.id;
    messageId = existing.messageId;
    await klaviyoRequest(`${API}/campaign-messages/${encodeURIComponent(messageId)}/`, headers, "PATCH", {
      data: { type: "campaign-message", id: messageId, attributes: { content: payload.data.attributes["campaign-messages"].data[0].attributes.content } }
    });
  } else {
    const created = await klaviyoRequest(`${API}/campaigns/`, headers, "POST", payload);
    campaignId = String(created?.data?.id || "");
    messageId = String(created?.data?.relationships?.["campaign-messages"]?.data?.[0]?.id || "");
    if (!campaignId || !messageId) throw new Error("Klaviyo created the campaign but returned no message id.");
  }
  const assigned = await assignTemplate(klaviyoRequest, headers, messageId, templateId);
  return {
    ...summary,
    campaignId,
    messageId,
    reused: Boolean(existing?.messageId),
    messageTemplateId: String(assigned?.data?.relationships?.template?.data?.id || "")
  };
}

// The HTML Klaviyo will send, with the account's own {{ organization.* }} filled in. Read-only.
async function renderTemplate({ klaviyoRequest, headers, templateId = "", messageId = "" }) {
  let id = templateId;
  if (!id && messageId) {
    const template = await klaviyoRequest(`${API}/campaign-messages/${encodeURIComponent(messageId)}/template/`, headers);
    id = String(template?.data?.id || "");
  }
  if (!id) throw new Error("Missing templateId or messageId.");
  const rendered = await klaviyoRequest(`${API}/template-render/`, headers, "POST", {
    data: { type: "template", attributes: { id, context: {} } }
  });
  return { templateId: id, html: String(rendered?.data?.attributes?.html || ""), text: String(rendered?.data?.attributes?.text || "") };
}

module.exports = { CAMPAIGN_REVISION, buildCampaignPayload, createCampaignDraft, readSourceCampaign, renderTemplate };
