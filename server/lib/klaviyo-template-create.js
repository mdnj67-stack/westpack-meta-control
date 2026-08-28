"use strict";

const { removeStandalonePriceBlocks } = require("./klaviyo-product-feed");
const {
  collectWestpackProductFeedUrlMismatches,
  collectWestpackSnippetUrlMismatches,
  rewriteWestpackProductFeedUrls,
  rewriteWestpackSnippetUrls
} = require("./westpack-url-locales");

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFullHtmlDocument(value = "") {
  return /<!doctype html/i.test(value) || /<html[\s>]/i.test(value);
}

function containsRenderableHtml(value = "") {
  return /<[a-z][\s\S]*>/i.test(String(value || ""));
}

function buildTemplateHtml({ templateName, sourceTemplateName, subject, previewText, body }) {
  const safeBody = String(body || "").trim();
  if (isFullHtmlDocument(safeBody)) {
    return safeBody;
  }

  const renderedBody = /^</.test(safeBody)
    ? safeBody
    : `<p>${escapeHtml(safeBody).replace(/\n/g, "<br>")}</p>`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${escapeHtml(templateName)}</title>`,
    "</head>",
    '<body style="margin:0;padding:0;background:#f6f3ee;font-family:Arial,sans-serif;color:#1f1a17;">',
    `  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText || "")}</div>`,
    '  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">',
    '    <div style="background:#ffffff;border:1px solid #e5dbcd;border-radius:20px;padding:32px;">',
    `      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;">${escapeHtml(subject || templateName)}</h1>`,
    `      <p style="margin:0 0 24px;color:#6d6258;font-size:15px;line-height:1.5;">${escapeHtml(previewText || "")}</p>`,
    `      <div style="font-size:16px;line-height:1.65;color:#1f1a17;">${renderedBody}</div>`,
    '      <hr style="border:0;border-top:1px solid #eee4d8;margin:28px 0;">',
    `      <p style="margin:0;color:#8b7d71;font-size:12px;">Source template: ${escapeHtml(sourceTemplateName || "")}</p>`,
    '    </div>',
    '  </div>',
    "</body>",
    "</html>"
  ].join("\n");
}

function localizeWestpackUrls(content = "", targetCountry = "") {
  return rewriteWestpackSnippetUrls(
    rewriteWestpackProductFeedUrls(content, targetCountry),
    targetCountry
  );
}

function definitionContainsUniversalSections(value) {
  if (Array.isArray(value)) {
    return value.some((item) => definitionContainsUniversalSections(item));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(value, "universal_id")) {
    return true;
  }

  return Object.values(value).some((entry) => definitionContainsUniversalSections(entry));
}

function sanitizeDefinitionForUpdate(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDefinitionForUpdate(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (
      key === "id" ||
      key === "data_id" ||
      key === "template_id" ||
      key === "universal_id" ||
      key === "cropping_properties"
    ) {
      return acc;
    }
    acc[key] = sanitizeDefinitionForUpdate(entry);
    return acc;
  }, {});
}

async function createCodeTemplateVariant({
  country,
  sourceTemplateId,
  sourceTemplateName,
  templateName,
  subject,
  previewText,
  rawHtmlBody,
  normalizedEditorType,
  klaviyoRequest,
  headers,
  fallbackReason = ""
}) {
  const resolvedBody = removeStandalonePriceBlocks(
    localizeWestpackUrls(rawHtmlBody, country)
  );
  if (!containsRenderableHtml(resolvedBody)) {
    throw new Error("Generated HTML is missing or not renderable.");
  }

  const urlMismatches = collectWestpackProductFeedUrlMismatches(resolvedBody, country);
  const snippetMismatches = collectWestpackSnippetUrlMismatches(resolvedBody, country);
  if (urlMismatches.length || snippetMismatches.length) {
    const mismatch = urlMismatches[0] || snippetMismatches[0];
    throw new Error(`Westpack URL validation failed for ${country}. Expected snippet ${mismatch.expectedSnippet}, found ${mismatch.foundSnippet}.`);
  }

  const html = buildTemplateHtml({
    templateName,
    sourceTemplateName,
    subject,
    previewText,
    body: resolvedBody
  });
  const text = [subject, previewText, stripHtml(resolvedBody)].filter(Boolean).join("\n\n");
  const createPayload = await klaviyoRequest(
    "https://a.klaviyo.com/api/templates",
    headers,
    "POST",
    {
      data: {
        type: "template",
        attributes: {
          name: templateName,
          editor_type: "CODE",
          html,
          text
        }
      }
    }
  );

  const templateId = String(createPayload?.data?.id || "");
  if (!templateId) {
    throw new Error("Klaviyo code template creation succeeded without returning a template ID.");
  }

  return {
    ok: true,
    country,
    templateId,
    templateName,
    templateUrl: `https://www.klaviyo.com/email-editor/${templateId}/edit`,
    editorType: "CODE",
    sourceEditorType: normalizedEditorType,
    sourceTemplateId,
    fallbackReason,
    createdAt: new Date().toISOString()
  };
}

async function createTemplateVariant({
  country,
  sourceTemplateId,
  sourceTemplateName,
  sourceEditorType,
  templateName,
  subject,
  previewText,
  rawHtmlBody,
  structuredDefinition,
  klaviyoRequest,
  headers
}) {
  const normalizedEditorType = String(sourceEditorType || "").trim().toUpperCase();
  if (normalizedEditorType === "SYSTEM_DRAGGABLE") {
    if (!structuredDefinition || typeof structuredDefinition !== "object" || definitionContainsUniversalSections(structuredDefinition)) {
      return createCodeTemplateVariant({
        country,
        sourceTemplateId,
        sourceTemplateName,
        templateName,
        subject,
        previewText,
        rawHtmlBody,
        normalizedEditorType,
        klaviyoRequest,
        headers,
        fallbackReason: !structuredDefinition || typeof structuredDefinition !== "object"
          ? "Missing rewritten drag-and-drop template definition, so the variant was created as a CODE template."
          : "Source template uses universal sections, so the variant was created as a CODE template."
      });
    }

    const clonePayload = await klaviyoRequest("https://a.klaviyo.com/api/template-clone", headers, "POST", {
      data: {
        type: "template",
        id: sourceTemplateId,
        attributes: {
          name: templateName
        }
      }
    });

    const templateId = String(clonePayload?.data?.id || "");
    if (!templateId) {
      throw new Error("Klaviyo clone succeeded without returning a template ID.");
    }

    await klaviyoRequest(
      `https://a.klaviyo.com/api/templates/${encodeURIComponent(templateId)}?additional-fields[template]=definition`,
      headers,
      "PATCH",
      {
        data: {
          type: "template",
          id: templateId,
          attributes: {
            name: templateName,
            definition: sanitizeDefinitionForUpdate(structuredDefinition)
          }
        }
      }
    );

    return {
      ok: true,
      country,
      templateId,
      templateName,
      templateUrl: `https://www.klaviyo.com/email-editor/${templateId}/edit`,
      editorType: normalizedEditorType,
      createdAt: new Date().toISOString()
    };
  }

  return createCodeTemplateVariant({
    country,
    sourceTemplateId,
    sourceTemplateName,
    templateName,
    subject,
    previewText,
    rawHtmlBody,
    normalizedEditorType,
    klaviyoRequest,
    headers
  });
}

module.exports = {
  createTemplateVariant
};
