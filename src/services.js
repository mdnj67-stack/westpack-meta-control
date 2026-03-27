function getValue(id) {
  return document.getElementById(id).value;
}

export function buildPreviewPayload({ ads, integrationConfig }) {
  const sourceId = getValue("source-ad");
  const targetCampaign = getValue("target-campaign");
  const targetLanguage = getValue("target-language");
  const adaptationGoal = getValue("adaptation-goal");
  const note = document.getElementById("brief").value.trim();
  const resolvedAds = ads && ads.length ? ads : [];
  const sourceAd = resolvedAds.find((ad) => ad.id === sourceId) || {
    name: "Selected ad",
    primary: "Live ad copy will be loaded in the next integration step.",
    headline: "Localized headline preview",
    description: "Localized description preview"
  };

  return {
    source: sourceAd.name,
    targetCampaign,
    targetLanguage,
    primaryText: `${sourceAd.primary} (${targetLanguage} preview)`,
    headline: `${sourceAd.headline} (${targetLanguage})`,
    description: `${sourceAd.description}${note ? ` Operator note: ${note}` : ""}`,
    rationale: `This preview simulates ${adaptationGoal.toLowerCase()} while preserving Westpack's premium B2B framing. In the live app, ${integrationConfig.openAi.model} will replace this placeholder with localized copy before the Meta publish step.`
  };
}

export function buildVariantSet(preview) {
  return [
    {
      title: "Variant 1 · Direct localization",
      body: preview.primaryText,
      headline: preview.headline,
      angle: "Keeps the original structure and simply localizes the value proposition."
    },
    {
      title: "Variant 2 · Shorter and sharper",
      body: `${preview.primaryText} Built to stay compact and mobile-first.`,
      headline: `${preview.headline} · Short`,
      angle: "Cuts extra words and leans into a tighter retail-performance style."
    },
    {
      title: "Variant 3 · Premium B2B angle",
      body: `${preview.primaryText} Focus on presentation, perceived value, and retail quality.`,
      headline: `Premium ${preview.headline}`,
      angle: "Pushes the B2B premium positioning harder for specialist buyers."
    }
  ];
}

export function buildMetaPublishPayload(preview) {
  return {
    action: "create_cloned_ad",
    source_ad_name: preview.source,
    target_campaign_name: preview.targetCampaign,
    target_language: preview.targetLanguage,
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

export function getIntegrationCards(config) {
  return [
    {
      title: "OpenAI Layer",
      body: `${config.openAi.status}. Model target: ${config.openAi.model}. Use: ${config.openAi.purpose}.`
    },
    {
      title: "Meta Marketing API",
      body: `${config.metaApi.status}. Scope: ${config.metaApi.mode}. Planned write actions: ${config.metaApi.writeActions.join(", ")}.`
    },
    {
      title: "Safeguard Layer",
      body: `${config.safeguard.status}. Rule: ${config.safeguard.purpose}.`
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
