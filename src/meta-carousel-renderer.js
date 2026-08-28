const SIZE = 1080;

const TONES = {
  ivory: { background: "#f7f2eb", foreground: "#191512", accent: "#b80031", muted: "#746a61" },
  sand: { background: "#e9ddd0", foreground: "#1b1714", accent: "#b80031", muted: "#6f6258" },
  rose: { background: "#efd8d9", foreground: "#1b1515", accent: "#b80031", muted: "#755f60" },
  charcoal: { background: "#211b18", foreground: "#fffaf4", accent: "#e1003b", muted: "#c6bbb2" },
  sage: { background: "#dce3da", foreground: "#172019", accent: "#b80031", muted: "#5f6c61" }
};

const DEFAULT_DESIGN_SYSTEM = {
  palette: { background: "#f7f2eb", panel: "#ffffff", foreground: "#191512", accent: "#b80031", muted: "#746a61" },
  typography: { headlineStyle: "serif", headlineWeight: "bold", labelCase: "uppercase", alignment: "left" },
  composition: { heroStrategy: "image_first", density: "editorial", frameStyle: "hairline", imageTreatment: "framed" },
  brandTreatment: "signature_line"
};

function safeHex(value, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) return `#${raw.slice(1).split("").map((part) => part + part).join("")}`;
  return fallback;
}

function mixHex(left, right, weight = 0.5) {
  const a = safeHex(left, "#ffffff");
  const b = safeHex(right, "#ffffff");
  const amount = Math.max(0, Math.min(1, weight));
  const channels = [1, 3, 5].map((offset) => Math.round(
    parseInt(a.slice(offset, offset + 2), 16) * (1 - amount)
    + parseInt(b.slice(offset, offset + 2), 16) * amount
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex) {
  const value = safeHex(hex, "#ffffff");
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function readableForeground(background, preferred) {
  const bg = luminance(background);
  const fg = luminance(preferred);
  const contrast = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
  return contrast >= 4.5 ? preferred : bg > 0.45 ? "#171310" : "#fffaf4";
}

function resolveDesignSystem(value = {}) {
  return {
    palette: {
      background: safeHex(value?.palette?.background, DEFAULT_DESIGN_SYSTEM.palette.background),
      panel: safeHex(value?.palette?.panel, DEFAULT_DESIGN_SYSTEM.palette.panel),
      foreground: safeHex(value?.palette?.foreground, DEFAULT_DESIGN_SYSTEM.palette.foreground),
      accent: safeHex(value?.palette?.accent, DEFAULT_DESIGN_SYSTEM.palette.accent),
      muted: safeHex(value?.palette?.muted, DEFAULT_DESIGN_SYSTEM.palette.muted)
    },
    typography: { ...DEFAULT_DESIGN_SYSTEM.typography, ...(value.typography || {}) },
    composition: { ...DEFAULT_DESIGN_SYSTEM.composition, ...(value.composition || {}) },
    brandTreatment: value.brandTreatment === "wordmark" ? "wordmark" : "signature_line"
  };
}

function resolveTone(value = "ivory", designSystem = DEFAULT_DESIGN_SYSTEM) {
  const palette = designSystem.palette;
  const backgrounds = {
    ivory: palette.background,
    sand: mixHex(palette.background, palette.muted, 0.18),
    rose: mixHex(palette.background, palette.accent, 0.13),
    sage: mixHex(palette.panel, palette.muted, 0.2),
    charcoal: palette.foreground
  };
  const background = backgrounds[value] || backgrounds.ivory;
  return {
    background,
    foreground: readableForeground(background, value === "charcoal" ? palette.panel : palette.foreground),
    accent: value === "charcoal" ? mixHex(palette.accent, "#ffffff", 0.18) : palette.accent,
    muted: value === "charcoal" ? mixHex(palette.panel, palette.muted, 0.5) : palette.muted
  };
}

function focalCoordinates(value = "center") {
  if (value === "left") return { x: 0.22, y: 0.5 };
  if (value === "right") return { x: 0.78, y: 0.5 };
  if (value === "top") return { x: 0.5, y: 0.2 };
  if (value === "bottom") return { x: 0.5, y: 0.8 };
  return { x: 0.5, y: 0.5 };
}

function drawCoverImage(ctx, image, x, y, width, height, focalPoint = "center") {
  const sourceWidth = Number(image.width || image.naturalWidth || 1);
  const sourceHeight = Number(image.height || image.naturalHeight || 1);
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const focal = focalCoordinates(focalPoint);
  const sourceX = Math.max(0, Math.min(sourceWidth - cropWidth, sourceWidth * focal.x - cropWidth / 2));
  const sourceY = Math.max(0, Math.min(sourceHeight - cropHeight, sourceHeight * focal.y - cropHeight / 2));
  ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
}

function splitTextIntoLines(ctx, text = "", maxWidth = 600, maxLines = 3) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}...`).width > maxWidth) {
      last = last.split(" ").slice(0, -1).join(" ");
    }
    lines[maxLines - 1] = `${last || ""}...`;
  }
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawBrandLine(ctx, { color = "#191512", inverse = false, index = 0, total = 5, designSystem = DEFAULT_DESIGN_SYSTEM } = {}) {
  ctx.fillStyle = color;
  ctx.font = "700 27px 'Arial', sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText(designSystem.brandTreatment === "wordmark" ? "WESTPACK" : "W — P", 58, 64);
  ctx.fillStyle = designSystem.palette.accent;
  ctx.fillRect(58, 78, designSystem.brandTreatment === "wordmark" ? 94 : 48, 4);
  ctx.textAlign = "right";
  ctx.font = "600 18px 'Arial', sans-serif";
  ctx.fillStyle = inverse ? "rgba(255,255,255,.78)" : "rgba(25,21,18,.58)";
  ctx.fillText(`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 1022, 62);
  ctx.textAlign = "left";
}

function drawCopy(ctx, card, options = {}) {
  const designSystem = options.designSystem || DEFAULT_DESIGN_SYSTEM;
  const tone = options.tone || resolveTone(card.tone, designSystem);
  const x = options.x ?? 62;
  const y = options.y ?? 740;
  const maxWidth = options.maxWidth ?? 956;
  const inverse = options.inverse === true;
  const foreground = inverse ? "#fffaf4" : tone.foreground;
  const muted = inverse ? "rgba(255,250,244,.78)" : tone.muted;

  ctx.fillStyle = options.accent || tone.accent;
  ctx.font = "700 19px 'Arial', sans-serif";
  const roleText = String(card.role || "campaign");
  ctx.fillText(designSystem.typography.labelCase === "uppercase" ? roleText.toUpperCase() : roleText.replace(/^./, (letter) => letter.toUpperCase()), x, y);

  let headlineSize = options.headlineSize || 62;
  let headlineLines = [];
  const headlineFamily = designSystem.typography.headlineStyle === "sans" ? "'Arial', sans-serif" : "'Georgia', serif";
  const headlineWeight = { regular: 400, medium: 600, bold: 700 }[designSystem.typography.headlineWeight] || 700;
  do {
    ctx.font = `${headlineWeight} ${headlineSize}px ${headlineFamily}`;
    headlineLines = splitTextIntoLines(ctx, card.title || "Westpack", maxWidth, 3);
    headlineSize -= 2;
  } while (headlineLines.length >= 3 && headlineSize > 48 && ctx.measureText(headlineLines[headlineLines.length - 1]).width > maxWidth);
  ctx.fillStyle = foreground;
  ctx.textAlign = options.alignment || designSystem.typography.alignment;
  const textX = ctx.textAlign === "center" ? x + maxWidth / 2 : x;
  const headlineBottom = drawLines(ctx, headlineLines, textX, y + 48, headlineSize + 7);

  ctx.fillStyle = muted;
  ctx.font = "400 27px 'Arial', sans-serif";
  const bodyLines = splitTextIntoLines(ctx, card.description || "", maxWidth, options.bodyLines || 2);
  drawLines(ctx, bodyLines, textX, headlineBottom + 8, 37);
  ctx.textAlign = "left";
}

function roundedRectPath(ctx, x, y, width, height, radius = 28) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawFramedImage(ctx, image, x, y, width, height, focalPoint, designSystem) {
  const rounded = designSystem.composition.frameStyle === "rounded";
  ctx.save();
  if (rounded) {
    roundedRectPath(ctx, x, y, width, height, 30);
    ctx.clip();
  }
  drawCoverImage(ctx, image, x, y, width, height, focalPoint);
  ctx.restore();
  if (designSystem.composition.frameStyle !== "none") {
    ctx.strokeStyle = mixHex(designSystem.palette.foreground, designSystem.palette.background, 0.78);
    ctx.lineWidth = 2;
    roundedRectPath(ctx, x + 1, y + 1, width - 2, height - 2, rounded ? 29 : 0);
    ctx.stroke();
  }
}

async function decodeSourceBlob(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode source image."));
    };
    image.src = objectUrl;
  });
}

async function loadSourceImage(card = {}) {
  if (card.sourceFile instanceof Blob) {
    return decodeSourceBlob(card.sourceFile);
  }
  const sourceUrl = String(card.imageUrl || "");
  const proxyUrl = `/api/campaign/brain?action=asset_proxy&url=${encodeURIComponent(sourceUrl)}`;
  const response = await fetch(proxyUrl, { credentials: "same-origin" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Could not load source image (${response.status}).`);
  }
  return decodeSourceBlob(await response.blob());
}

function renderCardCanvas(card, image, index, total, designSystem) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { alpha: false });
  const tone = resolveTone(card.tone, designSystem);
  const layout = card.layout || (card.role === "cta" ? "cta_panel" : index === 0 ? "image_led" : "editorial_split");
  ctx.fillStyle = tone.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (layout === "image_led") {
    drawCoverImage(ctx, image, 0, 0, SIZE, SIZE, card.focalPoint);
    const gradient = ctx.createLinearGradient(0, 350, 0, SIZE);
    gradient.addColorStop(0, "rgba(18,14,12,0)");
    gradient.addColorStop(0.68, "rgba(18,14,12,.7)");
    gradient.addColorStop(1, "rgba(18,14,12,.94)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
    drawBrandLine(ctx, { color: "#fffaf4", inverse: true, index, total, designSystem });
    drawCopy(ctx, card, { x: 62, y: 690, maxWidth: 880, inverse: true, headlineSize: designSystem.composition.density === "minimal" ? 74 : 68, bodyLines: 2, designSystem });
    return canvas;
  }

  if (layout === "quiet_statement") {
    drawCoverImage(ctx, image, 480, 0, 600, SIZE, card.focalPoint);
    const gradient = ctx.createLinearGradient(410, 0, 620, 0);
    gradient.addColorStop(0, tone.background);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(380, 0, 280, SIZE);
    drawBrandLine(ctx, { color: tone.foreground, index, total, designSystem });
    drawCopy(ctx, card, { x: 58, y: 310, maxWidth: 400, tone, headlineSize: 58, bodyLines: 4, designSystem });
    return canvas;
  }

  const imageHeight = layout === "detail_frame" ? 575 : 650;
  const imageX = layout === "detail_frame" ? 48 : 0;
  const imageY = layout === "detail_frame" ? 92 : 0;
  const imageWidth = layout === "detail_frame" ? 984 : SIZE;
  drawFramedImage(ctx, image, imageX, imageY, imageWidth, imageHeight, card.focalPoint, designSystem);

  if (layout === "detail_frame") {
    drawBrandLine(ctx, { color: tone.foreground, index, total, designSystem });
    drawCopy(ctx, card, { x: 58, y: 715, maxWidth: 940, tone, headlineSize: 55, bodyLines: 2, designSystem });
    return canvas;
  }

  const panelY = imageHeight;
  const ctaTone = resolveTone("charcoal", designSystem);
  ctx.fillStyle = layout === "cta_panel" ? ctaTone.background : tone.background;
  ctx.fillRect(0, panelY, SIZE, SIZE - panelY);
  drawBrandLine(ctx, {
    color: imageY === 0 ? "#fffaf4" : tone.foreground,
    inverse: imageY === 0,
    index,
    total,
    designSystem
  });
  drawCopy(ctx, card, {
    x: 62,
    y: panelY + 54,
    maxWidth: 930,
    tone: layout === "cta_panel" ? ctaTone : tone,
    inverse: layout === "cta_panel",
    headlineSize: 56,
    bodyLines: 2,
    designSystem
  });
  return canvas;
}

function canvasToJpegFile(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Carousel renderer returned an empty image."));
        return;
      }
      resolve(new File([blob], filename, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.9);
  });
}

export async function renderMetaCarouselCards(cards = [], options = {}) {
  const sourceCards = (Array.isArray(cards) ? cards : [])
    .filter((card) => card?.sourceFile instanceof Blob || /^https:\/\//i.test(card?.imageUrl || ""))
    .slice(0, 10);
  if (sourceCards.length < 2) throw new Error("At least two source images are required for carousel rendering.");
  const designSystem = resolveDesignSystem(options.designSystem || {});
  const images = await Promise.all(sourceCards.map((card) => loadSourceImage(card)));
  try {
    return await Promise.all(sourceCards.map((card, index) => {
      const canvas = renderCardCanvas(card, images[index], index, sourceCards.length, designSystem);
      return canvasToJpegFile(canvas, `meta-master-${String(index + 1).padStart(2, "0")}-${card.role || "card"}.jpg`);
    }));
  } finally {
    images.forEach((image) => image?.close?.());
  }
}
