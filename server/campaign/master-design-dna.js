const DEFAULT_DESIGN_DNA = Object.freeze({
  palette: {
    background: "#f7f2eb",
    panel: "#ffffff",
    foreground: "#191512",
    accent: "#b80031",
    muted: "#746a61"
  },
  typography: {
    headlineStyle: "serif",
    headlineFamily: "Georgia",
    bodyFamily: "Arial",
    headlineWeight: "bold",
    labelCase: "uppercase",
    alignment: "left"
  },
  composition: {
    heroStrategy: "image_first",
    density: "editorial",
    frameStyle: "hairline",
    imageTreatment: "framed"
  }
});

function normalizeHex(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) return `#${raw.slice(1).split("").map((char) => char + char).join("")}`;
  const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (!rgb) return "";
  return `#${rgb.slice(1, 4).map((item) => Math.max(0, Math.min(255, Number(item))).toString(16).padStart(2, "0")).join("")}`;
}

function colorStats(hex = "") {
  const value = normalizeHex(hex);
  if (!value) return { luminance: 0.5, saturation: 0 };
  const rgb = [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return {
    luminance: (Math.max(...rgb) + Math.min(...rgb)) / 2,
    saturation: max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1))
  };
}

function countValues(values = []) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

function extractDeclarationValues(html = "", property = "") {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(?:^|[;{\\s\"])(?:${escaped})\\s*:\\s*([^;\"}!]+)`, "gi");
  return [...String(html || "").matchAll(matcher)].map((match) => match[1].trim());
}

function extractColours(html = "") {
  const values = [];
  for (const match of String(html || "").matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)) {
    const colour = normalizeHex(match[0]);
    if (colour) values.push(colour);
  }
  return countValues(values);
}

function firstPosition(html, patterns) {
  const source = String(html || "").toLowerCase();
  const positions = patterns.map((pattern) => source.search(pattern)).filter((position) => position >= 0);
  return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
}

function choosePalette(html = "", colourCounts = []) {
  const backgroundColours = [
    ...extractDeclarationValues(html, "background"),
    ...extractDeclarationValues(html, "background-color")
  ]
    .map((value) => normalizeHex(value.split(/\s+/)[0]))
    .filter(Boolean);
  const textColours = extractDeclarationValues(html, "color")
    .map(normalizeHex)
    .filter(Boolean);
  const all = colourCounts.map((item) => item.value);
  const bodyBackgroundMatch = String(html).match(/(?:body|\.wrapper|\.email)[^{]*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i);
  const bodyBackground = normalizeHex(bodyBackgroundMatch?.[1]);
  const light = bodyBackground
    || countValues(backgroundColours).map((item) => item.value)
    .find((colour) => colorStats(colour).luminance >= 0.72)
    || all.find((colour) => colorStats(colour).luminance >= 0.82)
    || DEFAULT_DESIGN_DNA.palette.background;
  const panel = all.find((colour) => colour !== light && colorStats(colour).luminance >= 0.88)
    || "#ffffff";
  const foreground = countValues(textColours).map((item) => item.value)
    .find((colour) => colorStats(colour).luminance <= 0.3)
    || all.find((colour) => colorStats(colour).luminance <= 0.25)
    || DEFAULT_DESIGN_DNA.palette.foreground;
  const accent = all
    .filter((colour) => colour !== foreground)
    .sort((left, right) => colorStats(right).saturation - colorStats(left).saturation)
    .find((colour) => colorStats(colour).saturation >= 0.35 && colorStats(colour).luminance > 0.15 && colorStats(colour).luminance < 0.78)
    || DEFAULT_DESIGN_DNA.palette.accent;
  const muted = all.find((colour) => {
    const stats = colorStats(colour);
    return colour !== foreground && colour !== accent && stats.luminance >= 0.3 && stats.luminance <= 0.68;
  }) || DEFAULT_DESIGN_DNA.palette.muted;
  return { background: light, panel, foreground, accent, muted };
}

function extractMasterDesignDna(source = {}) {
  const html = String(source?.html || "");
  if (!html.trim()) return {
    palette: { ...DEFAULT_DESIGN_DNA.palette },
    typography: { ...DEFAULT_DESIGN_DNA.typography },
    composition: { ...DEFAULT_DESIGN_DNA.composition },
    evidence: { source: "fallback", colours: [], fonts: [], imageCount: 0 }
  };
  const colours = extractColours(html);
  const fontValues = extractDeclarationValues(html, "font-family")
    .map((value) => value.split(",")[0].replace(/["']/g, "").trim())
    .filter(Boolean);
  const fonts = countValues(fontValues);
  const headlineFontMatch = html.match(/(?:h1|h2|\.headline|\.title)[^{]*\{[^}]*font-family\s*:\s*([^;,}"']+|["'][^"']+["'])/i);
  const headlineFamily = String(headlineFontMatch?.[1] || fonts[0]?.value || DEFAULT_DESIGN_DNA.typography.headlineFamily).replace(/["']/g, "").trim();
  const headlineStyle = /georgia|times|serif|garamond|baskerville|didot/i.test(headlineFamily) ? "serif" : "sans";
  const imageCount = (html.match(/<img\b/gi) || []).length;
  const textLength = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  const structuralHtml = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const imagePosition = firstPosition(structuralHtml, [/<img\b/]);
  const headlinePosition = firstPosition(structuralHtml, [/<h1\b/, /font-size\s*:\s*(?:3[2-9]|[4-9]\d)px/]);
  const centreCount = extractDeclarationValues(html, "text-align").filter((value) => /center/i.test(value)).length;
  const leftCount = extractDeclarationValues(html, "text-align").filter((value) => /left/i.test(value)).length;
  const radiusValues = extractDeclarationValues(html, "border-radius").map((value) => Number.parseFloat(value)).filter(Number.isFinite);
  const borderCount = extractDeclarationValues(html, "border(?:-top|-bottom|-left|-right)?").length;
  const uppercaseCount = extractDeclarationValues(html, "text-transform").filter((value) => /uppercase/i.test(value)).length;
  const maxWidth = Math.max(0, ...[...html.matchAll(/(?:max-)?width\s*[:=]\s*["']?(\d{3,4})px/gi)].map((match) => Number(match[1])));

  return {
    palette: choosePalette(html, colours),
    typography: {
      headlineStyle,
      headlineFamily,
      bodyFamily: fonts[1]?.value || headlineFamily || "Arial",
      headlineWeight: /font-weight\s*:\s*(?:700|800|900|bold)/i.test(html) ? "bold" : "medium",
      labelCase: uppercaseCount > 0 ? "uppercase" : "title",
      alignment: centreCount > leftCount ? "center" : "left"
    },
    composition: {
      heroStrategy: imagePosition < headlinePosition ? "image_first" : imageCount ? "copy_first" : "typographic",
      density: textLength > 2400 ? "commercial" : imageCount >= 4 ? "editorial" : "minimal",
      frameStyle: radiusValues.some((value) => value >= 10) ? "rounded" : borderCount ? "hairline" : "none",
      imageTreatment: imageCount >= 3 ? "split" : imageCount ? "framed" : "full_bleed"
    },
    evidence: {
      source: "klaviyo_html",
      colours: colours.slice(0, 10),
      fonts: fonts.slice(0, 6),
      imageCount,
      textLength,
      maxWidth,
      centreCount,
      leftCount,
      roundedCorners: radiusValues.filter((value) => value > 0).length,
      borderCount
    }
  };
}

function normalizeDesignTranslation(value = {}, audit = DEFAULT_DESIGN_DNA) {
  const palette = value.palette || {};
  const safeColour = (candidate, fallback) => normalizeHex(candidate) || fallback;
  const allowed = (candidate, values, fallback) => values.includes(candidate) ? candidate : fallback;
  return {
    sourceDesignSummary: String(value.sourceDesignSummary || "Campaign-specific visual continuity from the approved master.").trim(),
    palette: {
      background: safeColour(palette.background, audit.palette.background),
      panel: safeColour(palette.panel, audit.palette.panel),
      foreground: safeColour(palette.foreground, audit.palette.foreground),
      accent: safeColour(palette.accent, audit.palette.accent),
      muted: safeColour(palette.muted, audit.palette.muted)
    },
    typography: {
      headlineStyle: allowed(value.typography?.headlineStyle, ["serif", "sans"], audit.typography.headlineStyle),
      headlineWeight: allowed(value.typography?.headlineWeight, ["regular", "medium", "bold"], audit.typography.headlineWeight),
      labelCase: allowed(value.typography?.labelCase, ["uppercase", "title"], audit.typography.labelCase),
      alignment: allowed(value.typography?.alignment, ["left", "center"], audit.typography.alignment)
    },
    composition: {
      heroStrategy: allowed(value.composition?.heroStrategy, ["image_first", "copy_first", "typographic"], audit.composition.heroStrategy),
      density: allowed(value.composition?.density, ["minimal", "editorial", "commercial"], audit.composition.density),
      frameStyle: allowed(value.composition?.frameStyle, ["none", "hairline", "rounded"], audit.composition.frameStyle),
      imageTreatment: allowed(value.composition?.imageTreatment, ["full_bleed", "framed", "split"], audit.composition.imageTreatment)
    },
    preserve: (Array.isArray(value.preserve) ? value.preserve : []).map(String).filter(Boolean).slice(0, 6),
    adapt: (Array.isArray(value.adapt) ? value.adapt : []).map(String).filter(Boolean).slice(0, 6),
    brandTreatment: allowed(value.brandTreatment, ["wordmark", "signature_line"], "signature_line")
  };
}

module.exports = { DEFAULT_DESIGN_DNA, extractMasterDesignDna, normalizeDesignTranslation, normalizeHex };
