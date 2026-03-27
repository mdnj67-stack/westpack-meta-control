function getValue(id) {
  return document.getElementById(id).value;
}

function getUploadedCreativeNames() {
  const input = document.getElementById("creative-upload");
  const files = Array.from(input?.files || []);
  return files.map((file) => file.name);
}

function getSourceAd(ads, sourceId) {
  const resolvedAds = ads && ads.length ? ads : [];
  return resolvedAds.find((ad) => ad.id === sourceId) || {
    id: sourceId || "",
    name: "Selected ad",
    primary: "Live ad copy will be loaded in the next integration step.",
    headline: "Localized headline preview",
    description: "Localized description preview",
    adset: ""
  };
}

export function buildPreviewPayload({ ads, integrationConfig, mode }) {
  const sourceId = getValue("source-ad");
  const targetCampaign = getValue("target-campaign");
  const targetAdSet = getValue("target-adset");
  const targetLanguage = getValue("target-language");
  const adaptationGoal = getValue("adaptation-goal");
  const adFormat = getValue("ad-format");
  const note = document.getElementById("brief").value.trim();
  const newAdName = document.getElementById("new-ad-name")?.value.trim();
  const newAdAngle = document.getElementById("new-ad-angle")?.value;
  const destinationUrl = getValue("destination-url");
  const creativeAssets = getUploadedCreativeNames();
  const sourceAd = getSourceAd(ads, sourceId);

  if (mode === "create") {
    return {
      source: newAdName || "New ad concept",
      sourceId: "",
      targetCampaign,
      targetAdSet,
      targetLanguage,
      adFormat,
      destinationUrl,
      creativeAssets,
      primaryText: `New Westpack ${adFormat.toLowerCase()} ad draft for ${targetLanguage}. Angle: ${newAdAngle || "Premium B2B packaging"}. ${note || "Fresh concept pending operator direction."}`,
      headline: `${newAdName || "New Westpack Ad"} (${targetLanguage})`,
      description: `Built as a fresh ${adFormat.toLowerCase()} ad concept for ${targetCampaign} / ${targetAdSet}.${note ? ` Operator note: ${note}` : ""}`,
      rationale: `This preview simulates creating a brand-new ad from scratch. In the live app, ${integrationConfig.openAi.model} will generate original Westpack copy based on your chosen angle, selected format, and notes, while uploaded creative files are used exactly as provided without visual editing.`
    };
  }

  return {
    source: sourceAd.name,
    sourceId: sourceAd.id,
    targetCampaign,
    targetAdSet,
    targetLanguage,
    adFormat,
    destinationUrl,
    creativeAssets,
    primaryText: `${sourceAd.primary} (${targetLanguage} ${adFormat.toLowerCase()} preview)`,
    headline: `${sourceAd.headline} (${targetLanguage})`,
    description: `${sourceAd.description}${note ? ` Operator note: ${note}` : ""} Placement: ${targetCampaign} / ${targetAdSet}.`,
    rationale: `This preview simulates ${adaptationGoal.toLowerCase()} while preserving Westpack's premium B2B framing. Format selected: ${adFormat}. In the live app, ${integrationConfig.openAi.model} will replace this placeholder with localized copy before the Meta publish step, but uploaded creative files stay untouched.`
  };
}

export function buildGenerationRequest({ ads, mode }) {
  const sourceId = getValue("source-ad");
  const targetCampaign = getValue("target-campaign");
  const targetAdSet = getValue("target-adset");
  const targetLanguage = getValue("target-language");
  const adaptationGoal = getValue("adaptation-goal");
  const adFormat = getValue("ad-format");
  const destinationUrl = getValue("destination-url");
  const operatorNote = document.getElementById("brief").value.trim();
  const newAdName = document.getElementById("new-ad-name")?.value.trim();
  const newAdAngle = document.getElementById("new-ad-angle")?.value;
  const creativeAssets = getUploadedCreativeNames();
  const sourceAd = getSourceAd(ads, sourceId);

  return {
    mode,
    sourceAd: mode === "duplicate" ? sourceAd : null,
    targetCampaign,
    targetAdSet,
    targetLanguage,
    adaptationGoal,
    adFormat,
    destinationUrl,
    operatorNote,
    newAdName,
    newAdAngle,
    creativeAssets
  };
}

export function buildVariantSet(preview) {
  return [
    {
      title: "Variant 1 - Direct localization",
      body: preview.primaryText,
      headline: preview.headline,
      angle: `Keeps the original structure and simply localizes the value proposition for a ${preview.adFormat.toLowerCase()} ad.`
    },
    {
      title: "Variant 2 - Shorter and sharper",
      body: `${preview.primaryText} Built to stay compact and mobile-first.`,
      headline: `${preview.headline} - Short`,
      angle: `Cuts extra words and leans into a tighter retail-performance style for ${preview.targetAdSet}.`
    },
    {
      title: "Variant 3 - Premium B2B angle",
      body: `${preview.primaryText} Focus on presentation, perceived value, and retail quality.`,
      headline: `Premium ${preview.headline}`,
      angle: "Pushes the B2B premium positioning harder for specialist buyers."
    }
  ];
}

export function buildMetaPublishPayload(preview) {
  return {
    action: preview.source === "New ad concept" || preview.source.includes("New Westpack Ad") ? "create_new_ad" : "create_cloned_ad",
    source_ad_name: preview.source,
    source_ad_id: preview.sourceId || "",
    target_campaign_name: preview.targetCampaign,
    target_adset_name: preview.targetAdSet,
    target_language: preview.targetLanguage,
    destination_url: preview.destinationUrl || "",
    ad_format: preview.adFormat,
    creative_handling: "use_uploaded_files_as_is",
    creative_assets: preview.creativeAssets || [],
    creative_strategy: {
      primary_text: preview.primaryText,
      headline: preview.headline,
      description: preview.description
    },
    approval_required: true,
    publish_status: "draft"
  };
}

export function createDraftEntry(preview) {
  return {
    ...preview,
    rationale: `${preview.rationale} Draft mode saved in the UI concept; database persistence comes in the next build.`
  };
}

export async function requestAiPreview(requestBody) {
  const response = await fetch("/api/openai/generate-ad-copy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "AI preview request failed.");
  }

  return payload;
}

export function getIntegrationCards(config) {
  return [
    {
      title: "OpenAI",
      body: `${config.openAi.status}. Model: ${config.openAi.model}.`
    },
    {
      title: "Meta",
      body: `${config.metaApi.status}. Scope: ${config.metaApi.mode}.`
    },
    {
      title: "Safeguard",
      body: `${config.safeguard.status}. ${config.safeguard.purpose}.`
    }
  ];
}

export function getMetaSettingsSummary(config) {
  return {
    status: `Status: ${config.metaApi.status}. Scope: ${config.metaApi.mode}.`,
    writeActions: config.metaApi.writeActions
  };
}

export function getPromptCards(promptRecipe) {
  return promptRecipe.map((item) => ({
    title: item.title,
    body: item.body
  }));
}

export function getAdSetOptions(campaignName, campaigns, ads) {
  const adSets = ads
    .filter((ad) => ad.campaign === campaignName && ad.adset)
    .map((ad) => ad.adset)
    .filter(Boolean);

  const uniqueAdSets = Array.from(new Set(adSets));
  return uniqueAdSets.length ? uniqueAdSets : ["No ad set found"];
}
