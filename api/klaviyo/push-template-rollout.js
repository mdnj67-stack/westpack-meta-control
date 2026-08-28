const { getConfig } = require("../../server/lib/config");
const { requireAuth } = require("../../server/lib/auth");
const { fetchWithTimeout, readJsonBody, sendJson } = require("../../server/lib/http");
const { removeStandalonePriceBlocks } = require("../../server/lib/klaviyo-product-feed");
const { collectWestpackProductFeedUrlMismatches, collectWestpackSnippetUrlMismatches, rewriteWestpackProductFeedUrls, rewriteWestpackSnippetUrls } = require("../../server/lib/westpack-url-locales");
const { createTemplateVariant } = require("../../server/lib/klaviyo-template-create");
const TEMPLATE_API_REVISION = "2026-04-15";
const KLAVIYO_REQUEST_TIMEOUT_MS = 15000;

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
    "Content-Type": "application/vnd.api+json",
    revision
  };
}

async function klaviyoRequest(url, headers, method = "GET", body) {
  const response = await fetchWithTimeout(
    url,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    },
    KLAVIYO_REQUEST_TIMEOUT_MS
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.errors?.[0]?.detail || payload?.message || `Klaviyo request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

async function getTemplateDetail(templateId, headers) {
  return klaviyoRequest(
    `https://a.klaviyo.com/api/templates/${encodeURIComponent(templateId)}?additional-fields[template]=definition`,
    headers
  );
}

function buildDryRunResult(base = {}, extra = {}) {
  return {
    ok: true,
    dryRun: true,
    ...base,
    ...extra
  };
}

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

function buildTemplateHtml({ templateName, sourceTemplateName, languageCode, translationPath, subject, previewText, body }) {
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
    `      <p style="margin:0 0 8px;color:#8b7d71;font-size:12px;text-transform:uppercase;letter-spacing:.12em;">${escapeHtml(languageCode)} · ${escapeHtml(translationPath)}</p>`,
    `      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;">${escapeHtml(subject || templateName)}</h1>`,
    `      <p style="margin:0 0 24px;color:#6d6258;font-size:15px;line-height:1.5;">${escapeHtml(previewText || "")}</p>`,
    `      <div style="font-size:16px;line-height:1.65;color:#1f1a17;">${renderedBody}</div>`,
    '      <hr style="border:0;border-top:1px solid #eee4d8;margin:28px 0;">',
    `      <p style="margin:0;color:#8b7d71;font-size:12px;">Source template: ${escapeHtml(sourceTemplateName)}</p>`,
    '    </div>',
    '  </div>',
    "</body>",
    "</html>"
  ].join("\n");
}

module.exports = async function handler(req, res) {
  const config = getConfig();
  if (!requireAuth(req, res, config)) {
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const dryRun = Boolean(body?.dryRun);
    if (String(body?.mode || "").trim() === "single_template_variant") {
      const country = String(body?.country || "").trim().toUpperCase();
      const sourceTemplateId = String(body?.sourceTemplateId || "").trim();
      const sourceTemplateName = String(body?.sourceTemplateName || "").trim();
      const sourceEditorType = String(body?.sourceEditorType || "").trim();
      const templateName = String(body?.templateName || "").trim();
      const subject = String(body?.subject || "").trim();
      const previewText = String(body?.previewText || "").trim();
      const rawHtmlBody = String(body?.body || "").trim();
      const structuredDefinition = body?.structuredDefinition && typeof body.structuredDefinition === "object"
        ? body.structuredDefinition
        : null;

      if (!country || !sourceTemplateId || !templateName) {
        sendJson(res, 400, { error: "Missing country, sourceTemplateId or templateName." });
        return;
      }

      const markets = parseMarkets(config.klaviyoMarketsJson);
      const market = markets.find((item) => String(item?.country || "").trim().toUpperCase() === country);
      if (!market?.privateKey) {
        sendJson(res, 404, { error: `No Klaviyo private key configured for ${country}.` });
        return;
      }

      const headers = buildHeaders(String(market.privateKey).trim(), TEMPLATE_API_REVISION);
      if (dryRun) {
        const templateDetail = await getTemplateDetail(sourceTemplateId, headers);
        const resolvedBody = removeStandalonePriceBlocks(localizeWestpackUrls(rawHtmlBody || "", country));
        const urlMismatches = collectWestpackProductFeedUrlMismatches(resolvedBody, country);
        const snippetMismatches = collectWestpackSnippetUrlMismatches(resolvedBody, country);
        const html = buildTemplateHtml({
          templateName,
          sourceTemplateName,
          languageCode: country,
          translationPath: "single_template_variant",
          subject: subject || templateName,
          previewText: previewText || "",
          body: resolvedBody
        });

        sendJson(res, 200, buildDryRunResult(
          {
            mode: "single_template_variant",
            country,
            sourceTemplateId,
            sourceTemplateName,
            sourceTemplateResolvedName: String(templateDetail?.data?.attributes?.name || sourceTemplateName || ""),
            templateName
          },
          {
            checks: {
              sourceTemplateFound: Boolean(templateDetail?.data?.id),
              renderableHtml: containsRenderableHtml(resolvedBody),
              urlMismatchCount: urlMismatches.length,
              snippetMismatchCount: snippetMismatches.length,
              htmlLength: html.length,
              previewTextLength: previewText.length
            }
          }
        ));
        return;
      }

      const payload = await createTemplateVariant({
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
      });

      sendJson(res, 200, payload);
      return;
    }
    const sourceTemplateName = String(body?.sourceTemplateName || "").trim();
    const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
    const variants = Array.isArray(body?.variants) ? body.variants : [];
    const targetAccounts = Array.isArray(body?.targetAccounts) ? body.targetAccounts : [];
    if (!sourceTemplateName || (!assignments.length && (!variants.length || !targetAccounts.length))) {
      sendJson(res, 400, { error: "Missing sourceTemplateName and rollout payload." });
      return;
    }

    const markets = parseMarkets(config.klaviyoMarketsJson);
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const results = [];

    const rolloutEntries = assignments.length
      ? assignments.map((assignment) => ({
        country: String(assignment?.country || "").trim().toUpperCase(),
        code: String(assignment?.code || "").trim(),
        label: String(assignment?.label || assignment?.code || "").trim(),
        translationPath: String(assignment?.translationPath || "").trim(),
        subject: String(assignment?.subject || "").trim(),
        previewText: String(assignment?.previewText || "").trim(),
        body: String(assignment?.body || "").trim()
      }))
      : targetAccounts.flatMap((account) => variants.map((variant) => ({
        country: String(account || "").trim().toUpperCase(),
        code: String(variant?.code || "").trim(),
        label: String(variant?.label || variant?.code || "").trim(),
        translationPath: String(variant?.translationPath || "").trim(),
        subject: String(variant?.subject || "").trim(),
        previewText: String(variant?.previewText || "").trim(),
        body: String(variant?.body || "").trim()
      })));

    for (const entry of rolloutEntries) {
      const country = entry.country;
      const market = markets.find((item) => String(item?.country || "").trim().toUpperCase() === country);
      if (!market?.privateKey) {
        results.push({ country, ok: false, error: `No Klaviyo private key configured for ${country}.` });
        continue;
      }

      const headers = buildHeaders(String(market.privateKey).trim(), TEMPLATE_API_REVISION);
      const languageCode = entry.code;
      const label = entry.label || languageCode;
      const templateName = `${sourceTemplateName} | ${label} | ${country} | Draft | ${timestamp}`;
      let resolvedBody = removeStandalonePriceBlocks(
        localizeWestpackUrls(entry.body || "", country)
      );

      if (!containsRenderableHtml(resolvedBody)) {
        results.push({
          country,
          languageCode,
          ok: false,
          error: `Generated HTML is missing for ${country}. Regenerate the Klaviyo rollout preview before pushing.`
        });
        continue;
      }
      const urlMismatches = collectWestpackProductFeedUrlMismatches(resolvedBody, country);
      const snippetMismatches = collectWestpackSnippetUrlMismatches(resolvedBody, country);
      if (urlMismatches.length || snippetMismatches.length) {
        const mismatch = urlMismatches[0] || snippetMismatches[0];
        results.push({
          country,
          languageCode,
          ok: false,
          error: `Westpack URL validation failed for ${country}. Expected snippet ${mismatch.expectedSnippet}, found ${mismatch.foundSnippet}.`
        });
        continue;
      }
      const html = buildTemplateHtml({
        templateName,
        sourceTemplateName,
        languageCode,
        translationPath: entry.translationPath || "",
        subject: entry.subject || templateName,
        previewText: entry.previewText || "",
        body: resolvedBody
      });
      const text = [entry.subject || "", entry.previewText || "", stripHtml(resolvedBody)].filter(Boolean).join("\n\n");

      if (dryRun) {
        results.push({
          country,
          languageCode,
          ok: true,
          dryRun: true,
          templateName,
          htmlLength: html.length,
          textLength: text.length,
          urlMismatchCount: urlMismatches.length,
          snippetMismatchCount: snippetMismatches.length
        });
        continue;
      }

      try {
        const payload = await klaviyoRequest("https://a.klaviyo.com/api/templates", headers, "POST", {
          data: {
            type: "template",
            attributes: {
              name: templateName,
              editor_type: "CODE",
              html,
              text
            }
          }
        });

        results.push({
          country,
          languageCode,
          ok: true,
          templateId: String(payload?.data?.id || ""),
          templateName
        });
      } catch (error) {
        results.push({
          country,
          languageCode,
          ok: false,
          error: error.message || "Template creation failed."
        });
      }
    }

    const ok = results.some((item) => item.ok);
    const firstError = results.find((item) => !item.ok)?.error || "";

    if (!ok) {
      sendJson(res, 400, {
        error: firstError || "Klaviyo template creation failed for all selected accounts.",
        results,
        createdAt: new Date().toISOString()
      });
      return;
    }

    sendJson(res, 200, {
      ok,
      dryRun,
      results,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Klaviyo rollout push failed." });
  }
};
function localizeWestpackUrls(content = "", targetCountry = "") {
  return rewriteWestpackSnippetUrls(
    rewriteWestpackProductFeedUrls(content, targetCountry),
    targetCountry
  );
}
