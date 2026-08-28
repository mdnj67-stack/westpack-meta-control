function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function normalizeLookupToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/mÃƒÂ¥l|mÃ¥l|mål/g, "mal")
    .replace(/formÃƒÂ¥l|formÃ¥l|formål/g, "formal")
    .replace(/fÃƒÂ¥r|fÃ¥r|får/g, "faar")
    .replace(/Ã¦|æ/g, "ae")
    .replace(/Ã¸|ø|ö/g, "oe")
    .replace(/Ã¥|å|ä/g, "aa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueList(values = [], limit = 24) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function parseLooseJson(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function extractUrls(value = "") {
  const matches = String(value || "").match(/https?:\/\/[^\s"'<>]+/gi);
  return uniqueList(matches || [], 24);
}

function extractTaskSections(value = "") {
  const normalized = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const labelMap = new Map([
    ["forslag til emne", "subject_suggestion"],
    ["subject suggestion", "subject_suggestion"],
    ["timing", "timing"],
    ["briefing til teamet", "briefing"],
    ["briefing", "briefing"],
    ["malgruppe", "audience"],
    ["target audience", "audience"],
    ["audience", "audience"],
    ["formal", "objective"],
    ["objective", "objective"],
    ["goal", "objective"],
    ["offer", "offer"],
    ["cta", "cta"],
    ["note", "note"],
    ["noter", "note"],
    ["assets", "assets"],
    ["content", "content"],
    ["kanaler", "channels"],
    ["channels", "channels"],
    ["markeder", "markets"],
    ["markets", "markets"],
    ["constraints", "constraints"],
    ["restrictions", "restrictions"]
  ]);
  const sections = {};
  let currentKey = "";

  for (const line of normalized.split("\n")) {
    const trimmed = normalizeWhitespace(line);
    if (!trimmed) {
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    const labelCandidate = colonIndex > -1 ? trimmed.slice(0, colonIndex) : trimmed;
    const labelLookup = normalizeLookupToken(labelCandidate);
    const directKey = labelMap.get(labelLookup) || "";

    if (directKey && colonIndex === -1) {
      currentKey = directKey;
      if (!sections[currentKey]) {
        sections[currentKey] = [];
      }
      continue;
    }

    if (directKey && colonIndex > -1) {
      currentKey = directKey;
      if (!sections[currentKey]) {
        sections[currentKey] = [];
      }
      const remainder = normalizeWhitespace(trimmed.slice(colonIndex + 1));
      if (remainder) {
        sections[currentKey].push(remainder);
      }
      continue;
    }

    if (currentKey) {
      sections[currentKey].push(trimmed);
    }
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, normalizeWhitespace(lines.join(" "))])
  );
}

function extractNumberSignals(value = "") {
  const raw = String(value || "");
  const ranges = raw.match(/\b\d+(?:[.,]\d+)?\s?-\s?\d+(?:[.,]\d+)?\s?%/gi) || [];
  const rangeEndpoints = new Set(
    ranges.flatMap((range) => String(range)
      .split("-")
      .map((part) => normalizeWhitespace(part).replace(/\s+/g, "")))
  );
  const singles = (raw.match(/\b\d+(?:[.,]\d+)?\s?%/gi) || [])
    .filter((match) => !rangeEndpoints.has(normalizeWhitespace(match).replace(/\s+/g, "")));
  const matches = [
    ...ranges,
    ...singles,
    ...(raw.match(/\b\d+(?:[.,]\d+)?\s?(?:kr|dkk|eur|usd|stk|x)\b/gi) || []),
    ...(raw.match(/\bQ[1-4]\b/gi) || [])
  ];

  return uniqueList(matches, 24);
}

function getFieldValueByName(task, pattern) {
  const field = (task.customFields || []).find((item) => pattern.test(normalizeLookupToken(item.name || "")) && item.value);
  return field?.value || "";
}

function extractFormatFromLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  const explicit = normalized.match(/\b(1x1|4x5|9x16|16x9|2x3|3x4)\b/);
  if (explicit?.[1]) {
    return explicit[1];
  }
  if (/story|stories|reel/.test(normalized)) {
    return "9x16";
  }
  if (/square|kvadrat/.test(normalized)) {
    return "1x1";
  }
  if (/portrait|stående/.test(normalized)) {
    return "4x5";
  }
  if (/landscape|bred/.test(normalized)) {
    return "16x9";
  }
  return "";
}

function extractAttachmentFamily(value = "") {
  return normalizeWhitespace(value)
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_ ]?\d{1,3}$/i, "")
    .trim();
}

function normalizeTask(rawTask, role = "task") {
  const parsed = typeof rawTask === "string" ? (parseLooseJson(rawTask) || { text: rawTask }) : (rawTask || {});
  const customFields = Array.isArray(parsed?.customFields)
    ? parsed.customFields
    : Array.isArray(parsed?.custom_fields)
      ? parsed.custom_fields
      : [];
  const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  const subtasks = Array.isArray(parsed?.subtasks) ? parsed.subtasks : [];

  const title = normalizeWhitespace(
    parsed?.name ||
    parsed?.title ||
    parsed?.taskName ||
    parsed?.headline ||
    ""
  );
  const notes = normalizeWhitespace(
    parsed?.notes ||
    parsed?.description ||
    parsed?.body ||
    parsed?.text ||
    ""
  );
  const rawText = String(parsed?.notes || parsed?.description || parsed?.body || parsed?.text || "").trim();
  const sectionMap = extractTaskSections(rawText);
  const urls = uniqueList([
    ...extractUrls(parsed?.notes || ""),
    ...extractUrls(parsed?.description || ""),
    ...extractUrls(parsed?.body || ""),
    ...extractUrls(parsed?.text || ""),
    ...extractUrls(parsed?.html || "")
  ], 24);
  const numberSignals = extractNumberSignals(rawText);

  return {
    role,
    id: normalizeWhitespace(parsed?.gid || parsed?.id || ""),
    title,
    notes,
    html: String(parsed?.html || parsed?.htmlBody || "").trim(),
    project: normalizeWhitespace(parsed?.project || parsed?.projectName || parsed?.workspace || ""),
    section: normalizeWhitespace(parsed?.section || parsed?.sectionName || ""),
    dueDate: normalizeWhitespace(parsed?.due_on || parsed?.dueDate || parsed?.due || ""),
    url: normalizeWhitespace(parsed?.permalink_url || parsed?.url || ""),
    rawText,
    sectionMap,
    urls,
    numberSignals,
    customFields: customFields.map((field) => ({
      name: normalizeWhitespace(field?.name || field?.label || ""),
      value: normalizeWhitespace(
        field?.display_value ||
        field?.text_value ||
        field?.number_value ||
        field?.enum_value?.name ||
        field?.value ||
        ""
      )
    })).filter((field) => field.name || field.value),
    attachments: attachments.map((attachment) => ({
      name: normalizeWhitespace(attachment?.name || attachment?.title || ""),
      type: normalizeWhitespace(attachment?.resource_type || attachment?.type || "asset"),
      url: normalizeWhitespace(attachment?.download_url || attachment?.permalink_url || attachment?.url || ""),
      description: normalizeWhitespace(attachment?.description || "")
    })).filter((attachment) => attachment.name || attachment.url),
    subtasks: subtasks.map((subtask) => ({
      title: normalizeWhitespace(subtask?.name || subtask?.title || ""),
      notes: normalizeWhitespace(subtask?.notes || subtask?.description || ""),
      completed: Boolean(subtask?.completed)
    })).filter((subtask) => subtask.title || subtask.notes)
  };
}

function buildCampaignKey(campaignTask, contentTask) {
  const explicit = [
    ...campaignTask.customFields,
    ...contentTask.customFields
  ].find((field) => /campaign key|campaign id|uge|week/i.test(field.name) && field.value);

  if (explicit?.value) {
    return explicit.value;
  }

  const candidates = [campaignTask.title, contentTask.title].filter(Boolean);
  for (const candidate of candidates) {
    const weekMatch = candidate.match(/\bW\d{1,2}\b/i);
    if (weekMatch) {
      const suffix = normalizeWhitespace(candidate.replace(weekMatch[0], "")).slice(0, 48);
      return normalizeWhitespace(`${weekMatch[0].toUpperCase()} ${suffix}`.trim());
    }
  }

  return campaignTask.title || contentTask.title || "Untitled campaign";
}

function normalizeCampaignStem(value = "") {
  return normalizeLookupToken(value)
    .replace(/\bw\d{1,2}\b/g, " ")
    .replace(/\b(?:mix|match|brand|performance|case|kundecase)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildContentPackageProfile(contentTask) {
  const formats = uniqueList([
    ...contentTask.subtasks.map((subtask) => extractFormatFromLabel(subtask.title || subtask.notes)),
    ...contentTask.attachments.map((attachment) => extractFormatFromLabel(attachment.name || attachment.description || attachment.url))
  ].filter(Boolean), 8);

  const assetFamilies = uniqueList(
    contentTask.attachments
      .map((attachment) => extractAttachmentFamily(attachment.name || attachment.url))
      .filter(Boolean),
    12
  );

  const mediaTypeCounts = contentTask.attachments.reduce((acc, attachment) => {
    const type = classifyAsset([attachment.type, attachment.name, attachment.url].filter(Boolean).join(" | "));
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const mode = mediaTypeCounts.video
    ? "video"
    : mediaTypeCounts.image
      ? "image"
      : contentTask.attachments.length
        ? "mixed"
        : "empty";

  return {
    rootTitle: normalizeCampaignStem(contentTask.title),
    formats,
    formatCount: formats.length,
    attachmentCount: contentTask.attachments.length,
    subtaskCount: contentTask.subtasks.length,
    assetFamilies,
    mediaTypeCounts,
    mode,
    hasVariantPack: formats.length >= 2,
    hasAttachments: contentTask.attachments.length > 0
  };
}

function collectAssetCandidates(contentTask, manualAssets = []) {
  const attachmentAssets = contentTask.attachments.map((attachment) => (
    [attachment.type, attachment.name, attachment.url].filter(Boolean).join(" | ")
  ));

  const subtaskAssets = contentTask.subtasks
    .filter((subtask) => /billede|image|video|asset|content|creative|1x1|4x5|9x16|16x9/i.test(subtask.title || subtask.notes))
    .map((subtask) => {
      const format = extractFormatFromLabel(subtask.title || subtask.notes);
      return `${subtask.completed ? "Ready" : "Pending"} | ${subtask.title}${format ? ` | format ${format}` : ""}`;
    });

  const linkedAssets = [
    ...contentTask.urls.map((url) => `linked asset | ${url}`),
    ...String(contentTask.sectionMap.assets || contentTask.sectionMap.content || "")
      .split(/\n|,|;/)
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean)
  ];

  return uniqueList([
    ...attachmentAssets,
    ...subtaskAssets,
    ...linkedAssets,
    ...(Array.isArray(manualAssets) ? manualAssets : [])
  ], 32);
}

function collectMarkets(campaignTask, manualMarkets = []) {
  const fieldMarkets = campaignTask.customFields
    .filter((field) => /market|country|lande|land/i.test(field.name))
    .flatMap((field) => String(field.value || "").split(/,|\//));

  return uniqueList([
    ...(Array.isArray(manualMarkets) ? manualMarkets : []),
    ...fieldMarkets
  ], 12);
}

function collectChannels(campaignTask, manualChannels = []) {
  const fieldChannels = campaignTask.customFields
    .filter((field) => /channel|kanal/i.test(field.name))
    .flatMap((field) => String(field.value || "").split(/,|\//));

  const notes = `${campaignTask.title}\n${campaignTask.notes}`;
  const inferred = [
    /klaviyo|email/i.test(notes) ? "klaviyo" : "",
    /meta|facebook|instagram|ads/i.test(notes) ? "meta" : "",
    /blog|html|article|seo/i.test(notes) ? "blog" : ""
  ];

  return uniqueList([
    ...(Array.isArray(manualChannels) ? manualChannels : []),
    ...fieldChannels,
    ...inferred
  ], 8).map((item) => item.toLowerCase());
}

function buildSourceMaterial({ campaignTask, contentTask, blogHtml, sourceHtml, extraPrompt }) {
  const html = String(blogHtml || sourceHtml || campaignTask.html || "").trim();
  const htmlText = stripHtml(html);
  const subjectSuggestion = campaignTask.sectionMap.subject_suggestion
    || normalizeWhitespace((String(campaignTask.rawText || "").match(/(?:forslag til emne|subject suggestion):\s*([^\n]+)/i) || [])[1] || "");
  const briefing = campaignTask.sectionMap.briefing
    || normalizeWhitespace((String(campaignTask.rawText || "").match(/(?:briefing til teamet|briefing):\s*([\s\S]*?)(?:\n(?:forventet|cta|timing|note)\b|$)/i) || [])[1] || "");
  const bodyBlocks = uniqueList([
    subjectSuggestion ? `Subject direction: ${subjectSuggestion}` : "",
    briefing ? `Briefing: ${briefing}` : "",
    campaignTask.notes,
    contentTask.notes,
    htmlText,
    normalizeWhitespace(extraPrompt)
  ], 8);

  return {
    type: html ? "blog" : "brief",
    title: campaignTask.title || contentTask.title || "Campaign source",
    subject: subjectSuggestion || campaignTask.title || "",
    previewText: "",
    body: bodyBlocks.join("\n\n"),
    html,
    notes: normalizeWhitespace(extraPrompt)
  };
}

function buildConstraints(campaignTask, manualConstraints = []) {
  const subtaskHints = campaignTask.subtasks
    .filter((subtask) => /korrektur|approval|deadline|send|afsend|constraint|regel/i.test(subtask.title || subtask.notes))
    .map((subtask) => subtask.title || subtask.notes);

  const textConstraints = [
    campaignTask.sectionMap.constraints,
    campaignTask.sectionMap.restrictions,
    ...(String(campaignTask.rawText || "").match(/ingen [^.]+/gi) || [])
  ];

  return uniqueList([
    ...(Array.isArray(manualConstraints) ? manualConstraints : []),
    ...subtaskHints,
    ...textConstraints
  ], 16);
}

function buildObjective(campaignTask, extraPrompt = "") {
  const objectiveField = getFieldValueByName(campaignTask, /objective|mal|goal|purpose|formal/);
  if (objectiveField) {
    return objectiveField;
  }

  return normalizeWhitespace(`${campaignTask.title}. ${campaignTask.notes}. ${extraPrompt || ""}`);
}

function classifyAsset(asset = "") {
  const value = String(asset || "").toLowerCase();
  if (/\b(video|mp4|mov|reel|clip)\b/.test(value)) {
    return "video";
  }
  if (/\b(image|jpg|jpeg|png|gif|hero|banner|photo|billede)\b/.test(value)) {
    return "image";
  }
  if (/\b(html|blog|article|email)\b/.test(value)) {
    return "html";
  }
  return "other";
}

function buildParsedObjective(campaignTask, extraPrompt = "") {
  const objectiveField = getFieldValueByName(campaignTask, /objective|mal|goal|purpose|formal/);
  if (objectiveField) {
    return objectiveField;
  }

  const declaredObjective = campaignTask.sectionMap.objective || "";
  if (declaredObjective) {
    return declaredObjective;
  }

  const imperativeBlockMatch = String(campaignTask.rawText || "").match(/(?:mailen|kampagnen|annoncen|emailen)\s+skal\s+([\s\S]*?)(?:\n[A-ZÃ†Ã˜Ã… ]{3,}|\n\d+\)|\nCTA\b|Ingen\b|FORSLAG TIL EMNE\b|TIMING\b|BRIEFING\b|$)/i);
  if (imperativeBlockMatch?.[1]) {
    return normalizeWhitespace(imperativeBlockMatch[1]).replace(/\s+(FORSLAG TIL EMNE|TIMING|BRIEFING TIL TEAMET).*$/i, "").trim();
  }

  return buildObjective(campaignTask, extraPrompt);
}

function buildAudience(campaignTask, extraPrompt = "") {
  const audienceField = getFieldValueByName(campaignTask, /audience|malgruppe|kunde/);
  if (audienceField) {
    return audienceField;
  }

  const declaredAudience = campaignTask.sectionMap.audience || "";
  if (declaredAudience) {
    return declaredAudience;
  }

  const noteMatch = String(campaignTask.rawText || "").match(/(?:mÃ¥lgruppen|målgruppen|maalgruppen)\s+er\s+([^.]+)/i);
  if (noteMatch?.[1]) {
    return normalizeWhitespace(noteMatch[1]);
  }

  return normalizeWhitespace(extraPrompt);
}

function buildOffer(campaignTask, extraPrompt = "") {
  const offerField = getFieldValueByName(campaignTask, /offer|tilbud|usp|angle/);
  if (offerField) {
    return offerField;
  }

  const declaredOffer = campaignTask.sectionMap.offer || "";
  if (declaredOffer) {
    return declaredOffer;
  }

  const commercialSentence = String(campaignTask.rawText || "").match(/(hvad\s+koster\s+det\s+at\s+blive\s+forhandler[\s\S]*?potentialet\s+i\s+q[1-4])/i);
  if (commercialSentence?.[1]) {
    return normalizeWhitespace(commercialSentence[1]);
  }

  const earningsSentence = String(campaignTask.rawText || "").match(/(hvad\s+tjener\s+du\s+pr\.\s+ordre[\s\S]*?potentialet\s+i\s+q[1-4])/i);
  if (earningsSentence?.[1]) {
    return normalizeWhitespace(earningsSentence[1]);
  }

  if (campaignTask.sectionMap.subject_suggestion) {
    return campaignTask.sectionMap.subject_suggestion;
  }

  const accessMatch = String(campaignTask.rawText || "").match(/hvad\s+(?:fÃ¥r|får)\s+du\s+adgang\s+til\??\s*([^.]+)/i);
  if (accessMatch?.[1]) {
    return normalizeWhitespace(accessMatch[1]);
  }

  return normalizeWhitespace(extraPrompt);
}

function buildLinkingInsights({ campaignTask, contentTask, source, assets, extraPrompt, inputMode, contentProfile }) {
  const signals = [];
  const campaignStem = normalizeCampaignStem(campaignTask.title);
  const contentStem = contentProfile.rootTitle;
  const titlesMatch = campaignStem && contentStem && (campaignStem.includes(contentStem) || contentStem.includes(campaignStem));

  if (campaignTask.title && contentTask.title) {
    const hasWeekCampaign = /\bW\d{1,2}\b/i.test(campaignTask.title);
    const hasWeekContent = /\bW\d{1,2}\b/i.test(contentTask.title);
    if (hasWeekCampaign && hasWeekContent) {
      signals.push("Shared weekly campaign naming detected across campaign and content tasks.");
    }
  }

  if (titlesMatch) {
    signals.push("Campaign brief and content task share the same campaign stem after cleanup.");
  }

  if (contentTask.attachments.length) {
    signals.push(`Content task includes ${contentTask.attachments.length} direct attachment(s).`);
  }

  if (contentProfile.formats.length) {
    signals.push(`Content package covers format variants: ${contentProfile.formats.join(", ")}.`);
  }

  if (contentTask.urls.length) {
    signals.push(`Content task includes ${contentTask.urls.length} linked URL reference(s).`);
  }

  if (campaignTask.numberSignals.length) {
    signals.push(`Campaign brief includes measurable commercial signal(s): ${campaignTask.numberSignals.slice(0, 3).join(", ")}.`);
  }

  if (source.html) {
    signals.push("Structured HTML source is available and can act as a primary narrative asset.");
  }

  if (extraPrompt) {
    signals.push("Operator prompt adds extra strategic context on top of source material.");
  }

  const score =
    (campaignTask.title || campaignTask.notes ? 30 : 0) +
    (contentTask.title || contentTask.notes || contentTask.attachments.length ? 30 : 0) +
    (titlesMatch ? 10 : 0) +
    (contentProfile.hasVariantPack ? 10 : 0) +
    (assets.length ? 20 : 0) +
    (source.html || source.body ? 10 : 0) +
    (extraPrompt ? 10 : 0);

  const confidence = score >= 80 ? "high" : score >= 55 ? "medium" : "low";

  return {
    inputMode,
    confidence,
    score,
    signals: uniqueList(signals, 8),
    recommendedNextStep: score >= 80
      ? "Generate the campaign plan from the assembled object."
      : score >= 55
        ? "Tighten the brief or add more content assets before generating artifacts."
        : "Add missing campaign brief data or stronger content inputs before relying on AI output."
  };
}

function buildSourceProfile({ source, assets, contentProfile }) {
  const assetTypes = assets.reduce((acc, asset) => {
    const type = classifyAsset(asset);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    sourceType: source.type,
    hasHtml: Boolean(source.html),
    hasBody: Boolean(source.body),
    assetTypes,
    contentMode: contentProfile.mode,
    contentFormats: contentProfile.formats,
    narrativeStrength: source.html || source.body
      ? (assets.length ? "rich" : "copy-led")
      : (assets.length ? "asset-led" : "thin")
  };
}

function buildIntakeProfile({ campaignTask, contentTask, source, assets, objective, audience, offer, constraints, linking, contentProfile }) {
  const ctaMatch = String(campaignTask.rawText || "").match(/CTA:\s*([^.]+)/i);
  const commercialSignals = uniqueList([
    ...campaignTask.numberSignals,
    ...contentTask.numberSignals
  ], 12);
  const readyAssets = contentTask.subtasks
    .filter((subtask) => subtask.completed)
    .map((subtask) => subtask.title || subtask.notes);
  const pendingAssets = contentTask.subtasks
    .filter((subtask) => !subtask.completed)
    .map((subtask) => subtask.title || subtask.notes);
  const sourceSections = campaignTask.sectionMap || {};

  return {
    subjectSuggestion: source.subject || campaignTask.title || "",
    timing: sourceSections.timing || campaignTask.dueDate || "",
    briefing: sourceSections.briefing || "",
    objective: objective || "",
    audience: audience || "",
    offer: offer || "",
    cta: normalizeWhitespace(ctaMatch?.[1] || sourceSections.cta || ""),
    constraints: Array.isArray(constraints) ? constraints : [],
    commercialSignals,
    contentFormats: contentProfile.formats,
    contentMode: contentProfile.mode,
    contentAttachmentCount: contentProfile.attachmentCount,
    contentFamilies: contentProfile.assetFamilies,
    matchConfidence: linking.confidence,
    linkedUrls: uniqueList([
      ...campaignTask.urls,
      ...contentTask.urls
    ], 16),
    readyAssets,
    pendingAssets,
    sourceDepth: {
      hasHtml: Boolean(source.html),
      hasBody: Boolean(source.body),
      assetCount: assets.length
    }
  };
}

function assembleCampaignObject(input = {}) {
  const campaignTask = normalizeTask(input.campaignTask || input.campaignTaskRaw || input.asanaCampaignTask, "campaign_task");
  const contentTask = normalizeTask(input.contentTask || input.contentTaskRaw || input.asanaContentTask, "content_task");
  const extraPrompt = normalizeWhitespace(input.extraPrompt || input.operatorNote || "");
  const manualAssets = Array.isArray(input.assets) ? input.assets : [];
  const manualChannels = Array.isArray(input.channels) ? input.channels : [];
  const manualMarkets = Array.isArray(input.markets) ? input.markets : [];
  const manualConstraints = Array.isArray(input.constraints) ? input.constraints : [];
  const inputMode = normalizeWhitespace(input.inputMode || "asana_combo").toLowerCase() || "asana_combo";

  const campaignKey = buildCampaignKey(campaignTask, contentTask);
  const channels = collectChannels(campaignTask, manualChannels);
  const markets = collectMarkets(campaignTask, manualMarkets);
  const assets = collectAssetCandidates(contentTask, manualAssets);
  const contentProfile = buildContentPackageProfile(contentTask);
  const source = buildSourceMaterial({
    campaignTask,
    contentTask,
    blogHtml: input.blogHtml,
    sourceHtml: input.sourceHtml,
    extraPrompt
  });
  const constraints = buildConstraints(campaignTask, manualConstraints);
  const objective = buildParsedObjective(campaignTask, extraPrompt);
  const audience = buildAudience(campaignTask, extraPrompt);
  const offer = buildOffer(campaignTask, extraPrompt);

  const campaignObject = {
    inputMode,
    campaignKey,
    title: normalizeWhitespace(input.title || campaignTask.title || contentTask.title || "Untitled campaign"),
    objective,
    audience: normalizeWhitespace(input.audience || audience || ""),
    offer: normalizeWhitespace(input.offer || offer || ""),
    tone: normalizeWhitespace(input.tone || "Commercial, direct and premium"),
    desiredOutcome: normalizeWhitespace(input.desiredOutcome || ""),
    channels: channels.length ? channels : ["klaviyo", "meta", "blog"],
    markets,
    assets,
    constraints,
    extraPrompt,
    linkedTasks: {
      campaignTask,
      contentTask
    },
    sourceMaterials: {
      source,
      blogHtml: String(input.blogHtml || "").trim(),
      sourceHtml: String(input.sourceHtml || "").trim()
    },
    intake: {
      mode: "assembled_campaign",
      assembledAt: new Date().toISOString()
    }
  };

  const linking = buildLinkingInsights({
    campaignTask,
    contentTask,
    source,
    assets,
    extraPrompt,
    inputMode,
    contentProfile
  });
  const sourceProfile = buildSourceProfile({
    source,
    assets,
    contentProfile
  });
  const intakeProfile = buildIntakeProfile({
    campaignTask,
    contentTask,
    source,
    assets,
    objective: campaignObject.objective,
    audience: campaignObject.audience,
    offer: campaignObject.offer,
    constraints: campaignObject.constraints,
    linking,
    contentProfile
  });

  const brainInput = {
    title: campaignObject.title,
    objective: campaignObject.objective,
    audience: campaignObject.audience,
    offer: campaignObject.offer,
    tone: campaignObject.tone,
    desiredOutcome: campaignObject.desiredOutcome,
    channels: campaignObject.channels,
    markets: campaignObject.markets,
    assets: campaignObject.assets,
    constraints: campaignObject.constraints,
    operatorNote: campaignObject.extraPrompt,
    source: campaignObject.sourceMaterials.source
  };

  return {
    campaignObject,
    brainInput,
    linking,
    sourceProfile,
    contentProfile,
    intakeProfile,
    summary: {
      campaignKey,
      hasCampaignTask: Boolean(campaignTask.title || campaignTask.notes),
      hasContentTask: Boolean(contentTask.title || contentTask.notes || contentTask.attachments.length),
      assetCount: assets.length,
      channelCount: campaignObject.channels.length,
      marketCount: campaignObject.markets.length
    }
  };
}

module.exports = {
  assembleCampaignObject
};
