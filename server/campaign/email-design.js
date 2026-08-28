const { renderUniversalFooter, renderUniversalHeader } = require("./email-universal-content");
const { normalizeEmailSections } = require("./email-module-library");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeUrl(value) {
  const candidate = String(value || "").trim();
  return /^https?:\/\//i.test(candidate) ? candidate : "";
}

function extractAssetUrls(assets = []) {
  const urls = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    for (const match of String(asset || "").matchAll(/https?:\/\/[^\s|]+/gi)) {
      const url = match[0].replace(/[),.;]+$/g, "");
      if (!urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

function getUrlExtension(value = "") {
  try {
    return new URL(String(value || "")).pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  } catch (error) {
    return "";
  }
}

function isStaticImageUrl(value = "", contentType = "") {
  const extension = getUrlExtension(value);
  if (["mp4", "mov", "m4v", "webm", "avi", "mkv"].includes(extension)) return false;
  const normalizedType = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
  if (normalizedType) return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(normalizedType);
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(extension);
}

function getDirectionTheme(direction = "soft_luxury") {
  const themes = {
    bold_commercial: {
      page: "#f1ede7",
      surface: "#ffffff",
      soft: "#e8ded2",
      ink: "#201916",
      muted: "#72665e",
      accent: "#ae0039",
      accentText: "#ffffff"
    },
    product_modular: {
      page: "#f2f4f0",
      surface: "#ffffff",
      soft: "#dce5dd",
      ink: "#1d241f",
      muted: "#667069",
      accent: "#254f3e",
      accentText: "#ffffff"
    },
    warm_editorial: {
      page: "#f4efe8",
      surface: "#fffdf9",
      soft: "#e5d5c7",
      ink: "#261c17",
      muted: "#79695f",
      accent: "#8e3f2e",
      accentText: "#ffffff"
    },
    soft_luxury: {
      page: "#f4f0ea",
      surface: "#fffdfa",
      soft: "#e9e0d6",
      ink: "#211a17",
      muted: "#756a62",
      accent: "#a90037",
      accentText: "#ffffff"
    }
  };
  return themes[direction] || themes.soft_luxury;
}

function renderBulletList(bullets, theme) {
  const items = (Array.isArray(bullets) ? bullets : []).filter(Boolean).slice(0, 5);
  if (!items.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${items.map((item) => `
    <tr>
      <td width="22" valign="top" style="padding:5px 0;color:${theme.accent};font:700 16px Arial,sans-serif;">&#8212;</td>
      <td style="padding:5px 0;color:${theme.ink};font:15px/1.55 Arial,sans-serif;">${escapeHtml(item)}</td>
    </tr>`).join("")}
  </table>`;
}

function renderSection(section, index, theme) {
  const bullets = renderBulletList(section?.bullets, theme);
  return `
    <tr>
      <td style="padding:${index === 0 ? "4px" : "30px"} 44px 0;">
        <p style="margin:0 0 10px;color:${theme.accent};font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(section?.label || `0${index + 1}`)}</p>
        <h2 style="margin:0 0 13px;color:${theme.ink};font:700 25px/1.15 Arial,sans-serif;letter-spacing:-0.5px;">${escapeHtml(section?.headline || "")}</h2>
        <p style="margin:0 0 ${bullets ? "14px" : "0"};color:${theme.muted};font:15px/1.65 Arial,sans-serif;">${escapeHtml(section?.body || "")}</p>
        ${bullets}
      </td>
    </tr>`;
}

function selectEmailImages(urls = []) {
  const uniqueUrls = urls.filter((url, index, values) => url && isStaticImageUrl(url) && values.indexOf(url) === index);
  if (uniqueUrls.length <= 4) return uniqueUrls;
  const indices = [0, 0.34, 0.67, 0.92].map((position) => Math.min(uniqueUrls.length - 1, Math.floor((uniqueUrls.length - 1) * position)));
  return indices.map((index) => uniqueUrls[index]).filter((url, index, values) => values.indexOf(url) === index);
}

async function probeImageUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (response.body) await response.body.cancel().catch(() => {});
    return response.ok && isStaticImageUrl(url, contentType);
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function selectReachableCampaignEmailImages(assets = [], limit = 4) {
  const urls = extractAssetUrls(assets);
  const prioritized = [
    ...selectEmailImages(urls),
    ...urls
  ].filter((url, index, values) => values.indexOf(url) === index).slice(0, 16);
  const selected = [];
  const batchSize = 4;
  for (let index = 0; index < prioritized.length && selected.length < limit; index += batchSize) {
    const batch = prioritized.slice(index, index + batchSize);
    const probes = await Promise.all(batch.map(async (url) => ({ url, reachable: await probeImageUrl(url) })));
    selected.push(...probes.filter((item) => item.reachable).map((item) => item.url));
  }
  return selected.slice(0, limit);
}

function renderCampaignImage(imageUrl, alt, theme) {
  if (!imageUrl) return "";
  return `
    <tr>
      <td style="padding:30px 22px 4px;">
        <img src="${escapeHtml(imageUrl)}" width="596" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:596px;height:auto;border:0;border-radius:2px;background:${theme.soft};">
      </td>
    </tr>`;
}

function getCampaignSectionDesign(section = {}, theme) {
  const textAlign = section?.textAlign === "center" ? "center" : "left";
  const contentWidth = section?.contentWidth === "narrow" ? "82%" : "100%";
  const surfaceStyle = ["soft", "outlined"].includes(section?.surfaceStyle) ? section.surfaceStyle : "plain";
  const tableStyle = surfaceStyle === "soft"
    ? `background:${theme.soft};`
    : surfaceStyle === "outlined"
      ? `border:1px solid ${theme.soft};`
      : "";
  return {
    textAlign,
    contentWidth,
    tableStyle,
    cellStyle: surfaceStyle === "plain" ? "" : "padding:22px;"
  };
}

function renderSectionCopy(section, theme, { compact = false } = {}) {
  const bullets = renderBulletList(section?.bullets, theme);
  const design = getCampaignSectionDesign(section, theme);
  return `
    <table class="module-copy" role="presentation" width="${design.contentWidth}" align="${design.textAlign === "center" ? "center" : "left"}" cellspacing="0" cellpadding="0" border="0" style="width:${design.contentWidth};${design.tableStyle}"><tr><td align="${design.textAlign}" style="${design.cellStyle}text-align:${design.textAlign};">
      <p style="margin:0 0 10px;color:${theme.accent};font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(section?.label || "")}</p>
      <h2 style="margin:0 0 13px;color:${theme.ink};font:700 ${compact ? "23px" : "27px"}/1.12 Arial,sans-serif;letter-spacing:-0.6px;">${escapeHtml(section?.headline || "")}</h2>
      <p style="margin:0 0 ${bullets ? "14px" : "0"};color:${theme.muted};font:15px/1.65 Arial,sans-serif;">${escapeHtml(section?.body || "")}</p>
      ${bullets}
    </td></tr></table>`;
}

function resolveSectionImage(section, availableImages, fallbackIndex) {
  if (section?.imageMode === "none") return "";
  const requested = normalizeUrl(section?.imageUrl);
  if (requested && availableImages.includes(requested)) return requested;
  if (section?.imageMode === "assigned") return "";
  return availableImages[fallbackIndex] || "";
}

function getCampaignImagePresentation(image = {}, width = 596) {
  const aspect = ["landscape", "square", "portrait"].includes(image?.imageAspect) ? image.imageAspect : "natural";
  const focalPoints = {
    top_left: "left top", top: "center top", top_right: "right top",
    left: "left center", center: "center center", right: "right center",
    bottom_left: "left bottom", bottom: "center bottom", bottom_right: "right bottom"
  };
  const focalPoint = focalPoints[image?.imageFocalPoint] || focalPoints.center;
  const heightByAspect = {
    landscape: Math.round(width * 2 / 3),
    square: width,
    portrait: Math.round(width * 5 / 4)
  };
  const height = heightByAspect[aspect] || 0;
  return {
    heightAttribute: height ? ` height="${height}"` : "",
    style: height ? `height:${height}px;object-fit:cover;object-position:${focalPoint};` : "height:auto;"
  };
}

function getProgressiveFrameStage(value = {}) {
  const text = [value?.label, value?.headline, value?.imageAlt, value?.stage, value?.role]
    .filter(Boolean)
    .join(" ");
  if (/\b(?:detail|detalje)\b/i.test(text)) return 1;
  if (/\bformat\b/i.test(text)) return 2;
  if (/\b(?:family|familie)\b/i.test(text)) return 3;
  return 0;
}

function renderProgressiveFrame(imageHtml, stage, theme) {
  if (!imageHtml || !stage) return imageHtml;
  const padding = { 1: 6, 2: 18, 3: 32 }[stage] || 6;
  return `<table data-progressive-frame-stage="${stage}" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid ${theme.accent};background:${theme.surface};"><tr><td style="padding:${padding}px;">
    <p style="margin:0 0 8px;color:${theme.accent};font:800 11px/1 Arial,sans-serif;letter-spacing:1.5px;">0${stage}</p>
    ${imageHtml}
  </td></tr></table>`;
}

function renderCompartmentContour(contentHtml, theme, region) {
  if (!contentHtml) return "";
  const border = `1px solid ${theme.muted}`;
  return `<table data-compartment-contour="${escapeHtml(region)}" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:${theme.surface};">
    <tr aria-hidden="true">
      <td width="24%" height="14" style="width:24%;height:14px;border:${border};border-bottom:0;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
      <td width="8%" style="width:8%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="42%" style="width:42%;border:${border};border-bottom:0;border-radius:18px 18px 0 0;font-size:0;line-height:0;">&nbsp;</td>
      <td width="8%" style="width:8%;font-size:0;line-height:0;">&nbsp;</td>
      <td width="18%" style="width:18%;border:${border};border-bottom:0;border-radius:9px 9px 0 0;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr><td colspan="5" style="padding:14px;border:${border};border-radius:0 0 22px 22px;">${contentHtml}</td></tr>
  </table>`;
}

function getCampaignSectionSpacing(section = {}) {
  if (section?.spacing === "compact") return { top: 24, side: 34, panel: 24 };
  if (section?.spacing === "airy") return { top: 52, side: 52, panel: 42 };
  return { top: 40, side: 44, panel: 34 };
}

function renderCampaignCta(email, ctaUrl, theme) {
  const style = ["outline", "text"].includes(email?.ctaStyle) ? email.ctaStyle : "solid";
  const align = email?.ctaAlign === "center" ? "center" : "left";
  const cellStyle = style === "outline"
    ? `border:2px solid ${theme.accent};background:transparent;`
    : style === "text"
      ? "background:transparent;"
      : `background:${theme.accent};`;
  const textColor = style === "solid" ? theme.accentText : theme.accent;
  const padding = style === "text" ? "8px 0 5px" : "15px 23px";
  const decoration = style === "text"
    ? `text-decoration:none;border-bottom:2px solid ${theme.accent};`
    : "text-decoration:none;";
  const tag = ctaUrl ? "a" : "span";
  const href = ctaUrl ? ` href="${escapeHtml(ctaUrl)}"` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="${align}"><table data-primary-cta-container="true" role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="${cellStyle}"><${tag} data-primary-cta="true"${href} style="display:inline-block;padding:${padding};color:${textColor};font:700 14px/1 Arial,sans-serif;${decoration}">${escapeHtml(email.primaryCta || "Kontakt os")}</${tag}></td></tr></table></td></tr></table>`;
}

function renderDesignedSection(section, index, theme, availableImages, email, ctaUrl, campaignUsesCompartmentContour = false) {
  const layout = section?.moduleId || section?.layout || "editorial_text";
  const marker = `<!-- Email module: ${escapeHtml(layout)} -->`;
  const imageUrl = resolveSectionImage(section, availableImages, index);
  const splitPresentation = getCampaignImagePresentation(section, 286);
  const fullPresentation = getCampaignImagePresentation(section, 596);
  const spacing = getCampaignSectionSpacing(section);
  const design = getCampaignSectionDesign(section, theme);
  const frameStage = getProgressiveFrameStage(section);
  const rawImage = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" width="286"${splitPresentation.heightAttribute} alt="${escapeHtml(section?.imageAlt || section?.headline || "Campaign image")}" style="display:block;width:100%;${splitPresentation.style}border:0;background:${theme.soft};">`
    : "";
  const image = renderProgressiveFrame(rawImage, frameStage, theme);

  if (layout === "image_full" && imageUrl) {
    const fullImage = `<img src="${escapeHtml(imageUrl)}" width="596"${fullPresentation.heightAttribute} alt="${escapeHtml(section?.imageAlt || section?.headline || "Campaign image")}" style="display:block;width:100%;${fullPresentation.style}border:0;background:${theme.soft};">`;
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td style="padding:${spacing.top}px 22px 0;">${renderProgressiveFrame(fullImage, frameStage, theme)}</td></tr>
      <tr><td class="mobile-pad" style="padding:${spacing.panel}px ${spacing.side}px 10px;">${renderSectionCopy(section, theme)}</td></tr>`;
  }

  if ((layout === "image_left" || layout === "image_right") && imageUrl) {
    const copyCell = `<td class="stack-column" width="52%" valign="middle" style="width:52%;padding:${spacing.panel}px;">${renderSectionCopy(section, theme, { compact: true })}</td>`;
    const imageCell = `<td class="stack-column" width="48%" valign="middle" style="width:48%;background:${theme.soft};">${image}</td>`;
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td style="padding:${spacing.top}px 22px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${index % 2 ? theme.soft : theme.surface};">
          <tr>${layout === "image_left" ? `${imageCell}${copyCell}` : `${copyCell}${imageCell}`}</tr>
        </table>
      </td></tr>`;
  }

  if (layout === "statement") {
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td class="mobile-pad" style="padding:${spacing.top}px ${spacing.side}px 18px;">
        <table class="module-copy" role="presentation" width="${design.contentWidth}" align="${design.textAlign === "center" ? "center" : "left"}" cellspacing="0" cellpadding="0" border="0" style="width:${design.contentWidth};${design.tableStyle}"><tr>
          <td width="4" style="width:4px;background:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>
          <td align="${design.textAlign}" style="padding:${section?.surfaceStyle === "plain" || !section?.surfaceStyle ? "4px 0 4px 28px" : "22px 22px 22px 28px"};text-align:${design.textAlign};">
            <p style="margin:0 0 12px;color:${theme.accent};font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(section?.label || "")}</p>
            <h2 style="margin:0 0 16px;color:${theme.ink};font:800 32px/1.08 Arial,sans-serif;letter-spacing:-1px;">${escapeHtml(section?.headline || "")}</h2>
            <p style="margin:0;color:${theme.muted};font:16px/1.65 Arial,sans-serif;">${escapeHtml(section?.body || "")}</p>
          </td>
        </tr></table>
      </td></tr>`;
  }

  if (layout === "steps") {
    const steps = (Array.isArray(section?.bullets) ? section.bullets : []).filter(Boolean).slice(0, 5);
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td class="mobile-pad" style="padding:${spacing.top}px ${spacing.side}px 8px;">
        ${renderSectionCopy({ ...section, bullets: [] }, theme)}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">${steps.map((step, stepIndex) => `
          <tr>
            <td width="42" valign="top" style="padding:8px 12px 8px 0;color:${theme.accent};font:800 20px/1 Arial,sans-serif;">0${stepIndex + 1}</td>
            <td style="padding:8px 0;border-top:1px solid ${theme.soft};color:${theme.ink};font:15px/1.5 Arial,sans-serif;">${escapeHtml(step)}</td>
          </tr>`).join("")}</table>
      </td></tr>`;
  }

  if (layout === "benefit_grid") {
    const benefits = (Array.isArray(section?.bullets) ? section.bullets : []).filter(Boolean).slice(0, 4);
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td class="mobile-pad" style="padding:${spacing.top}px ${spacing.side}px 8px;">
        ${renderSectionCopy({ ...section, bullets: [] }, theme)}
        <table role="presentation" width="100%" cellspacing="8" cellpadding="0" border="0" style="margin-top:18px;">${Array.from({ length: Math.ceil(benefits.length / 2) }, (_, rowIndex) => `
          <tr>${benefits.slice(rowIndex * 2, rowIndex * 2 + 2).map((benefit) => `<td width="50%" valign="top" style="padding:18px;background:${theme.soft};color:${theme.ink};font:700 14px/1.45 Arial,sans-serif;">${escapeHtml(benefit)}</td>`).join("")}</tr>`).join("")}</table>
      </td></tr>`;
  }

  if (layout === "testimonial") {
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td class="mobile-pad" style="padding:${spacing.top}px ${spacing.side}px 8px;">
        <table class="module-copy" role="presentation" width="${design.contentWidth}" align="${design.textAlign === "center" ? "center" : "left"}" cellspacing="0" cellpadding="0" border="0" style="width:${design.contentWidth};background:${theme.soft};${design.tableStyle}"><tr><td align="${design.textAlign}" style="padding:${spacing.panel}px;text-align:${design.textAlign};">
          <div style="color:${theme.accent};font:800 34px/1 Georgia,serif;">&ldquo;</div>
          <h2 style="margin:2px 0 16px;color:${theme.ink};font:700 25px/1.25 Georgia,serif;">${escapeHtml(section?.headline || "")}</h2>
          <p style="margin:0 0 14px;color:${theme.muted};font:15px/1.65 Arial,sans-serif;">${escapeHtml(section?.body || "")}</p>
          <p style="margin:0;color:${theme.accent};font:700 11px/1.3 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(section?.label || "")}</p>
        </td></tr></table>
      </td></tr>`;
  }

  if (layout === "product_spotlight" && imageUrl) {
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td style="padding:${spacing.top}px 22px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${theme.soft};"><tr>
          <td class="stack-column" width="54%" valign="middle" style="padding:${spacing.panel}px;">${renderSectionCopy(section, theme, { compact: true })}</td>
          <td class="stack-column" width="46%" valign="middle">${image}</td>
        </tr></table>
      </td></tr>`;
  }

  if (layout === "offer_panel") {
    const useCompartmentContour = campaignUsesCompartmentContour || /\bWTP\b|compartment|contour|smykkets n(?:æ|Ã¦)ste plads/i.test([
      email?.heroHeadline,
      email?.visualRationale,
      section?.label,
      section?.headline
    ].filter(Boolean).join(" "));
    const panelTheme = useCompartmentContour
      ? { background: theme.soft, label: theme.accent, headline: theme.ink, body: theme.muted }
      : { background: theme.accent, label: theme.accentText, headline: theme.accentText, body: theme.accentText };
    const offerCta = email?.primaryCta
      ? `<div style="margin-top:22px;">${renderCampaignCta({ ...email, ctaStyle: "text" }, ctaUrl, useCompartmentContour ? theme : { ...theme, accent: theme.accentText })}</div>`
      : "";
    const closingImage = useCompartmentContour && imageUrl
      ? `<img data-closing-wtp-image="true" src="${escapeHtml(imageUrl)}" width="180" alt="${escapeHtml(section?.imageAlt || "WTP product family")}" style="display:block;width:100%;height:auto;border:0;background:${theme.soft};">`
      : "";
    const offerCopy = `<table class="module-copy" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${panelTheme.background};"><tr><td align="${design.textAlign}" style="padding:${spacing.panel}px;text-align:${design.textAlign};">
      <p style="margin:0 0 10px;color:${panelTheme.label};font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(section?.label || "")}</p>
      <h2 style="margin:0 0 13px;color:${panelTheme.headline};font:800 29px/1.1 Arial,sans-serif;">${escapeHtml(section?.headline || "")}</h2>
      <p style="margin:0;color:${panelTheme.body};font:15px/1.6 Arial,sans-serif;">${escapeHtml(section?.body || "")}</p>
      ${offerCta}
    </td></tr></table>`;
    const offerContent = closingImage
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${panelTheme.background};"><tr>
          <td class="stack-column" width="64%" valign="middle">${offerCopy}</td>
          <td class="stack-column" width="36%" valign="middle" style="padding:14px 14px 14px 0;">${closingImage}</td>
        </tr></table>`
      : offerCopy;
    return `${marker}
      <tr data-email-module="${escapeHtml(layout)}"><td class="mobile-pad" style="padding:${spacing.top}px ${spacing.side}px 8px;">
        ${useCompartmentContour ? renderCompartmentContour(offerContent, theme, "closing") : offerContent}
      </td></tr>`;
  }

  return `${marker}<tr data-email-module="${escapeHtml(layout)}"><td class="mobile-pad" style="padding:${index === 0 && section?.spacing !== "airy" ? Math.min(spacing.top, 34) : spacing.top}px ${spacing.side}px 4px;">${renderSectionCopy(section, theme)}</td></tr>`;
}

function renderPremiumCampaignEmail(email = {}, input = {}) {
  const direction = email.visualDirection || "soft_luxury";
  const theme = getDirectionTheme(direction);
  const sourceAssetUrls = [
    ...extractAssetUrls(input.assets),
    ...extractAssetUrls([email.bodyHtml]),
    ...extractAssetUrls([email.heroImageUrl]),
    ...extractAssetUrls((Array.isArray(email.sections) ? email.sections : []).map((section) => section?.imageUrl || "")),
    ...extractAssetUrls((Array.isArray(email.visualAssets) ? email.visualAssets : []).map((asset) => asset?.imageUrl || ""))
  ].filter((url, index, values) => values.indexOf(url) === index);
  const resolvedImages = Array.isArray(input.resolvedEmailImageUrls)
    ? input.resolvedEmailImageUrls.filter((url, index, values) => url && values.indexOf(url) === index)
    : [];
  // resolvedEmailImageUrls is the server-probed allowlist. Keep the complete
  // allowlist available to exact hero/module assignments; truncating it made
  // valid fifth and sixth assets disappear during compilation.
  const selectedImages = resolvedImages.length ? resolvedImages : selectEmailImages(sourceAssetUrls);
  const requestedHero = normalizeUrl(email.heroImageUrl);
  const heroImageMode = ["auto", "assigned", "none"].includes(email.heroImageMode)
    ? email.heroImageMode
    : (requestedHero ? "assigned" : "auto");
  const heroImageUrl = heroImageMode === "none"
    ? ""
    : (selectedImages.includes(requestedHero) ? requestedHero : (heroImageMode === "assigned" ? "" : (selectedImages[0] || "")));
  const sections = normalizeEmailSections(email.sections);
  const ctaUrl = normalizeUrl(email.primaryCtaUrl);
  const campaignLabel = input.title || email.templateName || "Westpack campaign";
  const isDanish = (input.markets || []).some((market) => /^(dk|da|denmark|danmark)$/i.test(String(market || "")));
  const heroPresentation = getCampaignImagePresentation({
    imageAspect: email.heroImageAspect,
    imageFocalPoint: email.heroImageFocalPoint
  }, 596);
  const heroStage = getProgressiveFrameStage({
    label: email.eyebrow,
    headline: email.heroHeadline,
    imageAlt: email.heroImageAlt,
    role: email.visualRationale
  }) || (/\bWTP\b/i.test([campaignLabel, email.heroHeadline, email.visualRationale].filter(Boolean).join(" ")) ? 1 : 0);
  const useCompartmentContour = /\bWTP\b|compartment|contour|smykkets n(?:æ|Ã¦)ste plads/i.test([
    campaignLabel,
    email.heroHeadline,
    email.visualRationale
  ].filter(Boolean).join(" "));
  const heroImageMarkup = heroImageUrl
    ? `<img src="${escapeHtml(heroImageUrl)}" width="596"${heroPresentation.heightAttribute} alt="${escapeHtml(email.heroImageAlt || campaignLabel)}" style="display:block;width:100%;max-width:596px;${heroPresentation.style}border:0;border-radius:2px;">`
    : "";
  const heroImage = heroImageUrl ? `
    <tr>
      <td style="padding:0 22px 28px;">
        ${useCompartmentContour ? renderCompartmentContour(heroImageMarkup, theme, "hero") : renderProgressiveFrame(heroImageMarkup, heroStage, theme)}
      </td>
    </tr>` : "";
  const heroCopy = `
    <tr data-email-module="image_full" data-email-region="hero">
      <td class="mobile-pad" style="padding:48px 44px 30px;">
        <p style="margin:0 0 15px;color:${theme.accent};font:700 11px/1.2 Arial,sans-serif;letter-spacing:1.7px;text-transform:uppercase;">${escapeHtml(email.eyebrow || "Westpack journal")}</p>
        <h1 class="hero-title" style="margin:0 0 20px;color:${theme.ink};font:800 43px/1.02 Arial,sans-serif;letter-spacing:-1.8px;">${escapeHtml(email.heroHeadline || email.subject || campaignLabel)}</h1>
        <p style="margin:0;color:${theme.muted};font:18px/1.55 Arial,sans-serif;">${escapeHtml(email.intro || email.previewText || "")}</p>
      </td>
    </tr>`;
  const heroLayout = email.heroLayout || "copy_first";
  const hasOfferPanel = sections.some((section) => (section?.moduleId || section?.layout) === "offer_panel");

  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(email.subject || campaignLabel)}</title>
  <style>
    @media only screen and (max-width:640px){.email-shell{width:100%!important}.mobile-pad{padding-left:24px!important;padding-right:24px!important}.hero-title{font-size:34px!important}.email-frame{padding:0!important}.mobile-hide{display:none!important}.stack-column{display:block!important;width:100%!important}.module-copy{width:100%!important}.uc-logo,.uc-nav{display:block!important;width:100%!important;text-align:center!important}.uc-logo img{margin:0 auto 18px!important}.uc-nav a{display:inline-block!important;margin:0 8px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background:${theme.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(email.previewText || "")}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${theme.page};">
    <tr>
      <td class="email-frame" align="center" style="padding:34px 14px;">
        <table class="email-shell" role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px;background:${theme.surface};">
          ${renderUniversalHeader({ isDanish })}
          ${heroLayout === "image_first" ? `${heroImage}${heroCopy}` : `${heroCopy}${heroLayout === "typographic" ? "" : heroImage}`}
          ${sections.map((section, index) => renderDesignedSection(section, index, theme, selectedImages, email, ctaUrl, useCompartmentContour)).join("")}
          ${hasOfferPanel ? "" : `<tr data-email-region="closing">
            <td class="mobile-pad" style="padding:38px 44px 44px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${theme.soft};">
                <tr>
                  <td style="padding:32px;">
                    <h2 style="margin:0 0 12px;color:${theme.ink};font:700 27px/1.12 Arial,sans-serif;letter-spacing:-0.6px;">${escapeHtml(email.closingHeadline || "Klar til næste skridt?")}</h2>
                    <p style="margin:0 0 22px;color:${theme.muted};font:15px/1.6 Arial,sans-serif;">${escapeHtml(email.closingBody || "Kontakt os, og lad os finde den rigtige løsning til din forretning.")}</p>
                    ${renderCampaignCta(email, ctaUrl, theme)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`}
          ${renderUniversalFooter({ isDanish })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  isStaticImageUrl,
  renderPremiumCampaignEmail,
  selectReachableCampaignEmailImages
};
