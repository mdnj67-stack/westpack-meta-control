export function createKlaviyoTemplateDomain({
  appState,
  klaviyoMarkets = [],
  klaviyoLanguageCatalog = [],
  klaviyoTemplateCatalog = [],
  klaviyoAccountLanguageMap = {},
  klaviyoUrlSnippetCatalog = {},
  escapeHtml = (value = "") => String(value || "")
} = {}) {
  function getKlaviyoTemplateAccounts() {
    const fromMarkets = (appState.klaviyoMarkets || [])
      .map((market) => String(market || "").trim())
      .filter(Boolean);
    return [...new Set(fromMarkets.length ? fromMarkets : klaviyoMarkets)];
  }

  function getKlaviyoLanguageByCode(languageCode = "") {
    return klaviyoLanguageCatalog.find((language) => language.code === languageCode) || null;
  }

  function getKlaviyoMappedLanguageCode(account = "") {
    return klaviyoAccountLanguageMap[String(account || "").trim().toUpperCase()] || "";
  }

  function getKlaviyoTargetSnippet(account = "") {
    return klaviyoUrlSnippetCatalog[String(account || "").trim().toUpperCase()] || "";
  }

  function collectKlaviyoSnippetUrlWarnings(content = "", targetCountry = "") {
    const expectedSnippet = getKlaviyoTargetSnippet(targetCountry);
    if (!expectedSnippet) {
      return [];
    }

    const knownSnippets = new Set(Object.values(klaviyoUrlSnippetCatalog).filter(Boolean));
    const warnings = [];
    const pattern = /https:\/\/www\.westpack\.com\/([a-z0-9_]+)(\/[^\s"'<>]*)/gi;
    let match = pattern.exec(String(content || ""));

    while (match) {
      const foundSnippet = String(match[1] || "");
      const rest = String(match[2] || "");
      const isProductCatalogUrl = /^\/catalog\/product\/view\/id\/\d+(?:[^\s"'<>]*)?$/i.test(rest);
      if (knownSnippets.has(foundSnippet) && !isProductCatalogUrl) {
        warnings.push({
          url: match[0],
          foundSnippet,
          expectedSnippet
        });
      }
      match = pattern.exec(String(content || ""));
    }

    return warnings;
  }

  function collectKlaviyoProductFeedUrlWarnings(content = "", targetCountry = "") {
    const expectedSnippet = getKlaviyoTargetSnippet(targetCountry);
    if (!expectedSnippet) {
      return [];
    }

    const warnings = [];
    const pattern = /https:\/\/www\.westpack\.com\/([a-z0-9_]+)\/catalog\/product\/view\/id\/(\d+)([^\s"'<>]*)/gi;
    let match = pattern.exec(String(content || ""));

    while (match) {
      const foundSnippet = String(match[1] || "");
      if (foundSnippet !== expectedSnippet) {
        warnings.push({
          url: match[0],
          foundSnippet,
          expectedSnippet,
          productId: String(match[2] || "")
        });
      }
      match = pattern.exec(String(content || ""));
    }

    return warnings;
  }

  function rewriteKlaviyoSnippetUrls(content = "", targetCountry = "") {
    const expectedSnippet = getKlaviyoTargetSnippet(targetCountry);
    if (!expectedSnippet) {
      return String(content || "");
    }

    const knownSnippets = new Set(Object.values(klaviyoUrlSnippetCatalog).filter(Boolean));
    return String(content || "").replace(
      /https:\/\/www\.westpack\.com\/([a-z0-9_]+)(\/[^\s"'<>]*)?/gi,
      (match, foundSnippet = "", rest = "") => {
        const normalizedSnippet = String(foundSnippet || "");
        const normalizedRest = String(rest || "");
        const isProductCatalogUrl = /^\/catalog\/product\/view\/id\/\d+(?:[^\s"'<>]*)?$/i.test(normalizedRest);
        if (!knownSnippets.has(normalizedSnippet) || isProductCatalogUrl) {
          return match;
        }
        return `https://www.westpack.com/${expectedSnippet}${normalizedRest}`;
      }
    );
  }

  function localizeKlaviyoWestpackUrls(content = "", targetCountry = "") {
    return rewriteKlaviyoSnippetUrls(
      String(content || "").replace(
        /https:\/\/www\.westpack\.com\/([a-z0-9_]+)\/catalog\/product\/view\/id\/(\d+)([^\s"'<>]*)/gi,
        (match, foundSnippet = "", productId = "", suffix = "") => {
          const expectedSnippet = getKlaviyoTargetSnippet(targetCountry);
          return expectedSnippet
            ? `https://www.westpack.com/${expectedSnippet}/catalog/product/view/id/${productId}${suffix}`
            : match;
        }
      ),
      targetCountry
    );
  }

  function getKlaviyoSourceTemplates(account = appState.klaviyoTemplateSourceAccount) {
    const liveTemplates = Array.isArray(appState.klaviyoTemplateCatalogLive) ? appState.klaviyoTemplateCatalogLive : [];
    const usingLiveAccount = appState.klaviyoTemplateLiveAccount === account;
    if (usingLiveAccount) {
      return liveTemplates;
    }
    const scoped = klaviyoTemplateCatalog.filter((template) => template.account === account);
    return scoped.length ? scoped : klaviyoTemplateCatalog;
  }

  function ensureKlaviyoTemplateSelections() {
    const accounts = getKlaviyoTemplateAccounts();
    if (!accounts.includes(appState.klaviyoTemplateSourceAccount)) {
      appState.klaviyoTemplateSourceAccount = accounts.includes("DK") ? "DK" : (accounts[0] || "DK");
    }

    const templates = getKlaviyoSourceTemplates(appState.klaviyoTemplateSourceAccount);
    if (!templates.some((template) => template.id === appState.klaviyoTemplateSourceTemplate)) {
      appState.klaviyoTemplateSourceTemplate = templates[0]?.id || "";
    }

    if (!Array.isArray(appState.klaviyoTemplateTargets) || !appState.klaviyoTemplateTargets.length) {
      appState.klaviyoTemplateTargets = accounts.slice(0, Math.min(accounts.length, 5));
    }
  }

  function getSelectedKlaviyoTemplate() {
    ensureKlaviyoTemplateSelections();
    const scoped = getKlaviyoSourceTemplates(appState.klaviyoTemplateSourceAccount);
    if (!scoped.length && appState.klaviyoTemplateLiveAccount === appState.klaviyoTemplateSourceAccount) {
      return {
        id: "",
        account: appState.klaviyoTemplateSourceAccount,
        name: "",
        subject: "",
        previewText: "",
        body: "",
        html: ""
      };
    }

    const fallback = scoped.find((template) => template.id === appState.klaviyoTemplateSourceTemplate) || scoped[0] || klaviyoTemplateCatalog[0];
    if (appState.klaviyoTemplateSourceDetail?.id === appState.klaviyoTemplateSourceTemplate) {
      const detail = appState.klaviyoTemplateSourceDetail;
      return {
        ...fallback,
        ...detail,
        account: detail.account || fallback.account || appState.klaviyoTemplateSourceAccount,
        subject: detail.subject || fallback.subject || detail.name || fallback.name,
        previewText: detail.previewText || fallback.previewText || "",
        body: detail.text || detail.html || fallback.body || "",
        html: detail.html || fallback.html || ""
      };
    }
    return {
      ...fallback,
      account: fallback.account || appState.klaviyoTemplateSourceAccount
    };
  }

  function summarizeKlaviyoBody(value = "") {
    return String(value || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isFullHtmlDocument(value = "") {
    return /<!doctype html/i.test(String(value || "")) || /<html[\s>]/i.test(String(value || ""));
  }

  function containsKlaviyoMarkup(value = "") {
    return /<[a-z][\s\S]*>/i.test(String(value || ""));
  }

  function buildKlaviyoPreviewHtml({
    templateName = "",
    sourceTemplateName = "",
    languageCode = "",
    translationPath = "",
    subject = "",
    previewText = "",
    body = ""
  } = {}) {
    const safeBody = String(body || "").trim();
    if (isFullHtmlDocument(safeBody)) {
      return safeBody;
    }

    const renderedBody = containsKlaviyoMarkup(safeBody)
      ? safeBody
      : `<p>${escapeHtml(safeBody).replace(/\n/g, "<br>")}</p>`;

    return [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `  <title>${escapeHtml(templateName || subject || sourceTemplateName)}</title>`,
      "</head>",
      '<body style="margin:0;padding:0;background:#f6f3ee;font-family:Arial,sans-serif;color:#1f1a17;">',
      `  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText || "")}</div>`,
      '  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">',
      '    <div style="background:#ffffff;border:1px solid #e5dbcd;border-radius:20px;padding:32px;">',
      `      <p style="margin:0 0 8px;color:#8b7d71;font-size:12px;text-transform:uppercase;letter-spacing:.12em;">${escapeHtml(languageCode)} · ${escapeHtml(translationPath)}</p>`,
      `      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;">${escapeHtml(subject || templateName || sourceTemplateName)}</h1>`,
      `      <p style="margin:0 0 24px;color:#6d6258;font-size:15px;line-height:1.5;">${escapeHtml(previewText || "")}</p>`,
      `      <div style="font-size:16px;line-height:1.65;color:#1f1a17;">${renderedBody}</div>`,
      '      <hr style="border:0;border-top:1px solid #eee4d8;margin:28px 0;">',
      `      <p style="margin:0;color:#8b7d71;font-size:12px;">Source template: ${escapeHtml(sourceTemplateName)}</p>`,
      "    </div>",
      "  </div>",
      "</body>",
      "</html>"
    ].join("\n");
  }

  function normalizeKlaviyoHeroImageUrl(value = "") {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return "";
    }
    return /^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed) ? trimmed : "";
  }

  function normalizeKlaviyoHeroImageOverride(value = null) {
    if (typeof value === "string") {
      const imageUrl = normalizeKlaviyoHeroImageUrl(value);
      return {
        imageUrl,
        fileName: ""
      };
    }

    const imageUrl = normalizeKlaviyoHeroImageUrl(value?.imageUrl || "");
    return {
      imageUrl,
      fileName: String(value?.fileName || "").trim()
    };
  }

  function getKlaviyoHeroImageOverrideState(account = "") {
    return normalizeKlaviyoHeroImageOverride(appState.klaviyoTemplateHeroImageOverrides?.[account]);
  }

  function decodeHtmlAttribute(value = "") {
    return String(value || "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  function estimateKlaviyoHeroImageScore(tag = "", src = "") {
    const source = String(tag || "");
    const normalizedSrc = String(src || "").toLowerCase();
    const widthMatch = source.match(/\bwidth\s*=\s*(["']?)(\d{2,4})\1/i);
    const styleWidthMatch = source.match(/width\s*:\s*(\d{2,4})px/i);
    const explicitWidth = Number(widthMatch?.[2] || styleWidthMatch?.[1] || 0);
    const altMatch = source.match(/\balt\s*=\s*(["'])(.*?)\1/i);
    const altText = String(altMatch?.[2] || "").toLowerCase();

    let score = explicitWidth;
    if (/hero|banner|headline|main-image|main_image/i.test(source)) score += 800;
    if (/logo|brandmark|wordmark/i.test(source) || /logo|brandmark|wordmark/i.test(normalizedSrc) || /logo|brandmark|wordmark/i.test(altText)) score -= 1500;
    if (/navigation|nav|icon/i.test(normalizedSrc) || /navigation|nav|icon/i.test(altText)) score -= 900;
    if (explicitWidth >= 500) score += 500;
    if (explicitWidth > 0 && explicitWidth < 220) score -= 700;
    if (/display\s*:\s*none/i.test(source)) score -= 1200;
    return score;
  }

  function findKlaviyoHeroImageMatch(body = "") {
    const html = String(body || "");
    const matches = [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)];
    if (matches.length) {
      const ranked = matches
        .map((match, index) => {
          const tag = String(match[0] || "");
          const rawSrc = String(match[2] || "");
          const src = decodeHtmlAttribute(rawSrc);
          return {
            index,
            tag,
            rawSrc,
            src,
            score: estimateKlaviyoHeroImageScore(tag, src)
          };
        })
        .filter((entry) => entry.src);

      ranked.sort((left, right) => right.score - left.score || left.index - right.index);
      if (ranked[0]?.src) {
        return {
          type: "img",
          rawSrc: ranked[0].rawSrc,
          src: ranked[0].src,
          tag: ranked[0].tag
        };
      }
    }

    const backgroundMatch = html.match(/background-image\s*:\s*url\((["']?)(.*?)\1\)/i);
    if (backgroundMatch?.[2]) {
      return {
        type: "background",
        rawSrc: String(backgroundMatch[2] || ""),
        src: decodeHtmlAttribute(backgroundMatch[2]),
        tag: backgroundMatch[0]
      };
    }

    return null;
  }

  function extractKlaviyoHeroImageUrl(body = "") {
    return String(findKlaviyoHeroImageMatch(body)?.src || "").trim();
  }

  function applyKlaviyoHeroImageOverride(body = "", heroImageUrl = "") {
    const source = String(body || "");
    const normalizedUrl = normalizeKlaviyoHeroImageUrl(heroImageUrl);
    if (!source || !normalizedUrl) {
      return source;
    }

    const heroMatch = findKlaviyoHeroImageMatch(source);
    if (!heroMatch?.src) {
      return source;
    }

    if (heroMatch.type === "img") {
      const escapedSrc = String(heroMatch.rawSrc || heroMatch.src || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return source.replace(new RegExp(`(<img\\b[^>]*\\bsrc\\s*=\\s*["'])${escapedSrc}(["'][^>]*>)`, "i"), `$1${normalizedUrl}$2`);
    }

    if (heroMatch.type === "background") {
      const escapedSrc = String(heroMatch.rawSrc || heroMatch.src || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return source.replace(new RegExp(`background-image\\s*:\\s*url\\((["']?)${escapedSrc}\\1\\)`, "i"), `background-image:url("${normalizedUrl}")`);
    }

    return source;
  }

  function getKlaviyoHeroImageOverride(account = "") {
    return getKlaviyoHeroImageOverrideState(account).imageUrl;
  }

  function buildKlaviyoHeroPreviewCard({
    title = "",
    subtitle = "",
    imageUrl = "",
    fileName = "",
    tone = "neutral",
    compact = false
  } = {}) {
    const normalizedUrl = normalizeKlaviyoHeroImageUrl(imageUrl);
    const showUrl = normalizedUrl && !/^data:image\//i.test(normalizedUrl);
    return `
    <article class="klaviyo-hero-card" data-tone="${escapeHtml(tone)}">
      <div class="klaviyo-hero-card-copy">
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(subtitle || (normalizedUrl ? "Image detected" : "Not available"))}</strong>
      </div>
      <div class="klaviyo-hero-card-media${compact ? " is-compact" : ""}">
        ${normalizedUrl ? `
          <img src="${escapeHtml(normalizedUrl)}" alt="${escapeHtml(title || "Hero image preview")}" loading="lazy" referrerpolicy="no-referrer">
        ` : `
          <div class="klaviyo-hero-card-empty">No image</div>
        `}
      </div>
      ${showUrl ? `<p class="klaviyo-hero-card-url">${escapeHtml(normalizedUrl)}</p>` : ""}
      ${fileName ? `<p class="klaviyo-hero-card-file">${escapeHtml(fileName)}</p>` : ""}
    </article>
  `;
  }

  function buildKlaviyoHeroInspectorHtml(plan) {
    const sourceHeroImageUrl = normalizeKlaviyoHeroImageUrl(plan?.sourceHeroImageUrl || "");
    const selectedTargets = Array.isArray(plan?.targets) ? plan.targets : [];
    const overrideTargets = selectedTargets
      .map((account) => ({
        account,
        ...getKlaviyoHeroImageOverrideState(account)
      }))
      .filter((item) => item.imageUrl);

    const overrideCards = overrideTargets.length
      ? overrideTargets.map((item) => buildKlaviyoHeroPreviewCard({
          title: item.account,
          subtitle: "Localized hero override",
          imageUrl: item.imageUrl,
          fileName: item.fileName,
          tone: "accent",
          compact: true
        })).join("")
      : '<div class="klaviyo-hero-card-empty is-wide">No localized hero images configured yet.</div>';

    return `
    <div class="klaviyo-hero-inspector">
      <div class="klaviyo-hero-inspector-grid">
        ${buildKlaviyoHeroPreviewCard({
          title: "Detected source hero",
          subtitle: sourceHeroImageUrl ? "This is the image the rollout will replace." : "No hero image could be detected in the source HTML.",
          imageUrl: sourceHeroImageUrl,
          tone: sourceHeroImageUrl ? "success" : "warning"
        })}
        <section class="klaviyo-hero-card klaviyo-hero-card-stack" data-tone="${escapeHtml(overrideTargets.length ? "accent" : "neutral")}">
          <div class="klaviyo-hero-card-copy">
            <span>Localized hero images</span>
            <strong>${escapeHtml(overrideTargets.length ? `${overrideTargets.length} target override${overrideTargets.length === 1 ? "" : "s"} configured` : "Using source hero for all targets")}</strong>
          </div>
          <div class="klaviyo-hero-stack">${overrideCards}</div>
        </section>
      </div>
      <p class="field-hint">Hero override only targets the large main email image, not the logo/navigation images in the header.</p>
      <p class="field-hint">Upload a localized hero image directly from your computer for each target country that needs its own splash.</p>
    </div>
  `;
  }

  function truncateKlaviyoPreviewText(value = "", maxLength = 220) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function buildKlaviyoChangePreviewMarkup(samples = []) {
    const items = Array.isArray(samples) ? samples.filter((sample) => sample && (sample.before || sample.after)).slice(0, 4) : [];
    if (!items.length) {
      return "";
    }

    return `
    <div class="klaviyo-change-preview">
      ${items.map((sample) => `
        <article class="klaviyo-change-preview-item">
          <div class="klaviyo-change-preview-column">
            <span>Before</span>
            <div>${sample.before || ""}</div>
          </div>
          <div class="klaviyo-change-preview-column is-after">
            <span>After</span>
            <div>${sample.after || ""}</div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
  }

  function hasRenderableKlaviyoBody(value = "") {
    const body = String(value || "").trim();
    return Boolean(body) && containsKlaviyoMarkup(body);
  }

  function hasSelectedKlaviyoTemplateDetail() {
    const detail = appState.klaviyoTemplateSourceDetail;
    return Boolean(
      detail
      && detail.id === appState.klaviyoTemplateSourceTemplate
      && (String(detail.html || "").trim() || String(detail.text || "").trim())
    );
  }

  function resetKlaviyoGeneratedPlan() {
    appState.klaviyoTemplatePlanGeneratedAt = "";
    appState.klaviyoTemplateGeneratedVariants = [];
    appState.klaviyoTemplateGeneratedFrom = "";
    appState.klaviyoTemplateTranslationError = "";
    appState.klaviyoTemplatePushError = "";
    appState.klaviyoTemplatePushResult = null;
  }

  function resetKlaviyoHeroImageOverrides() {
    appState.klaviyoTemplateHeroImageOverrides = {};
    appState.klaviyoTemplateHeroImageErrors = {};
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("Missing file."));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Could not read '${file.name || "image"}'.`));
      reader.readAsDataURL(file);
    });
  }

  function resetKlaviyoCampaignVariantState() {
    appState.klaviyoCampaignVariantError = "";
    appState.klaviyoCampaignVariant = null;
    appState.klaviyoCampaignVariantGeneratedAt = "";
    appState.klaviyoCampaignCreateError = "";
    appState.klaviyoCampaignCreateResult = null;
  }

  function localizeKlaviyoText(sourceText = "", languageCode = "en-GB") {
    const languageLabel = klaviyoLanguageCatalog.find((language) => language.code === languageCode)?.label || languageCode;
    const shortCode = languageCode.split("-")[0].toUpperCase();
    return `${sourceText} [${languageLabel} rollout / ${shortCode}]`;
  }

  function buildKlaviyoTemplatePlan() {
    const sourceTemplate = getSelectedKlaviyoTemplate();
    const sourceBody = sourceTemplate.html || sourceTemplate.body || sourceTemplate.text || "";
    const sourceHeroImageUrl = extractKlaviyoHeroImageUrl(sourceBody);
    const targets = getKlaviyoTemplateAccounts()
      .filter((account) => (appState.klaviyoTemplateTargets || []).includes(account));
    const operatorBrief = String(appState.klaviyoTemplateBrief || "").trim();
    const sourceLanguageCode = getKlaviyoMappedLanguageCode(sourceTemplate.account);
    const sourceLanguage = getKlaviyoLanguageByCode(sourceLanguageCode);
    const targetLanguages = [...new Set(targets
      .map((account) => getKlaviyoMappedLanguageCode(account))
      .filter(Boolean))]
      .map((code) => getKlaviyoLanguageByCode(code))
      .filter(Boolean);

    const generatedMap = new Map((appState.klaviyoTemplateGeneratedVariants || []).map((variant) => [variant.code, variant]));

    const variants = targetLanguages.map((language) => {
      const generated = generatedMap.get(language.code);
      const isDirectCopy = language.code === sourceLanguageCode;
      const hasGeneratedVariant = Boolean(generated);
      const accountsForLanguage = targets.filter((account) => getKlaviyoMappedLanguageCode(account) === language.code);
      const heroOverridesForLanguage = [...new Set(accountsForLanguage.map((account) => getKlaviyoHeroImageOverride(account)).filter(Boolean))];
      const previewHeroImageUrl = heroOverridesForLanguage.length === 1 ? heroOverridesForLanguage[0] : "";
      const resolvedBody = hasGeneratedVariant
        ? generated.body
        : isDirectCopy
          ? sourceBody
          : "";
      return {
        code: language.code,
        label: language.label,
        sourceAccount: sourceTemplate.account,
        sourceTemplateName: sourceTemplate.name,
        subject: hasGeneratedVariant
          ? generated.subject
          : isDirectCopy
            ? (sourceTemplate.subject || sourceTemplate.name)
            : "",
        previewText: hasGeneratedVariant
          ? generated.previewText
          : isDirectCopy
            ? (sourceTemplate.previewText || "")
            : "",
        body: resolvedBody,
        previewBody: applyKlaviyoHeroImageOverride(resolvedBody, previewHeroImageUrl),
        previewHeroImageUrl,
        targetCount: 0,
        rolloutLabel: isDirectCopy ? `Source copy · ${language.label}` : `Version · ${language.label}`,
        translationPath: isDirectCopy ? "Source -> same language" : `${sourceLanguage?.label || sourceTemplate.account} -> ${language.label}`,
        rationale: hasGeneratedVariant ? generated.rationale || "" : (isDirectCopy ? "Source language reused directly for matching target account." : ""),
        pendingGeneration: !isDirectCopy && !hasGeneratedVariant
      };
    });

    const variantMap = new Map(variants.map((variant) => [variant.code, variant]));
    const assignments = [];
    const missingAssignments = [];
    const urlValidationWarnings = [];

    for (const target of targets) {
      const languageCode = getKlaviyoMappedLanguageCode(target);
      const variant = variantMap.get(languageCode);
      const language = getKlaviyoLanguageByCode(languageCode);
      if (!languageCode || !variant || !language) {
        missingAssignments.push({
          account: target,
          code: languageCode,
          reason: languageCode ? "Mapped language not generated in this rollout." : "No language mapping configured for this account."
        });
        continue;
      }

      variant.targetCount += 1;
      const heroOverride = getKlaviyoHeroImageOverrideState(target);
      const heroImageUrl = heroOverride.imageUrl;
      const localizedBody = localizeKlaviyoWestpackUrls(variant.body, target);
      const previewBody = applyKlaviyoHeroImageOverride(localizedBody, heroImageUrl);
      assignments.push({
        country: target,
        code: variant.code,
        label: variant.label,
        translationPath: variant.translationPath,
        subject: variant.subject,
        previewText: variant.previewText,
        body: localizedBody,
        previewBody,
        heroImageUrl,
        heroFileName: heroOverride.fileName || "",
        rationale: variant.rationale,
        urlWarnings: [
          ...collectKlaviyoProductFeedUrlWarnings(localizedBody, target),
          ...collectKlaviyoSnippetUrlWarnings(localizedBody, target)
        ]
      });
    }

    for (const assignment of assignments) {
      if (assignment.urlWarnings?.length) {
        urlValidationWarnings.push({
          country: assignment.country,
          expectedSnippet: assignment.urlWarnings[0].expectedSnippet,
          foundSnippet: assignment.urlWarnings[0].foundSnippet,
          count: assignment.urlWarnings.length
        });
      }
    }

    return {
      sourceTemplate,
      operatorBrief,
      targets,
      languages: targetLanguages,
      variants,
      assignments,
      missingAssignments,
      sourceHeroImageUrl,
      heroOverrideCount: assignments.filter((assignment) => assignment.heroImageUrl).length,
      urlValidationWarnings,
      draftCount: assignments.length,
      generatedAt: appState.klaviyoTemplatePlanGeneratedAt || "",
      savedAt: appState.klaviyoTemplatePlanSavedAt || ""
    };
  }

  return {
    applyKlaviyoHeroImageOverride,
    buildKlaviyoChangePreviewMarkup,
    buildKlaviyoHeroInspectorHtml,
    buildKlaviyoPreviewHtml,
    buildKlaviyoTemplatePlan,
    collectKlaviyoProductFeedUrlWarnings,
    collectKlaviyoSnippetUrlWarnings,
    containsKlaviyoMarkup,
    ensureKlaviyoTemplateSelections,
    extractKlaviyoHeroImageUrl,
    getKlaviyoHeroImageOverride,
    getKlaviyoHeroImageOverrideState,
    getKlaviyoLanguageByCode,
    getKlaviyoMappedLanguageCode,
    getKlaviyoSourceTemplates,
    getKlaviyoTargetSnippet,
    getKlaviyoTemplateAccounts,
    getSelectedKlaviyoTemplate,
    hasRenderableKlaviyoBody,
    hasSelectedKlaviyoTemplateDetail,
    isFullHtmlDocument,
    localizeKlaviyoText,
    localizeKlaviyoWestpackUrls,
    normalizeKlaviyoHeroImageOverride,
    normalizeKlaviyoHeroImageUrl,
    readFileAsDataUrl,
    resetKlaviyoCampaignVariantState,
    resetKlaviyoGeneratedPlan,
    resetKlaviyoHeroImageOverrides,
    rewriteKlaviyoSnippetUrls,
    summarizeKlaviyoBody,
    truncateKlaviyoPreviewText
  };
}
