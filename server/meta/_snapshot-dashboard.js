function createMetaSnapshotDashboardBuilder({
  splitByCategory,
  splitConversionByAttribution,
  buildIncrementalLensCampaigns,
  findCampaignIdOverlap,
  classifyCampaign,
  hasIncrementalNameTag,
  buildQualityWarnings,
  resolveConversionAttribution,
  classifyConversionAttribution,
  normalizeBudgetValue,
  calculateBudgetAllocation,
  buildGeneralSpendDistribution,
  buildLensStats,
  buildLensSummary,
  buildHeroPanelItems,
  buildTrendCards,
  buildOverviewCards,
  buildDashboardValidation,
  readNumber
}) {
  function buildBudgetCampaigns({
    budgetCampaignsRaw = [],
    enrichedCampaignById,
    adSetsByCampaignId,
    budgetNormalization
  }) {
    return budgetCampaignsRaw.map((campaign) => {
      const enrichedCampaign = enrichedCampaignById.get(String(campaign.id || "")) || null;
      const linkedAdSets = adSetsByCampaignId.get(String(campaign.id || "")) || [];
      const adSetNames = linkedAdSets.map((adSet) => String(adSet?.name || ""));
      const adSetAttributionSpecs = linkedAdSets.map((adSet) => Array.isArray(adSet?.attribution_spec) ? adSet.attribution_spec : []);
      const attribution = enrichedCampaign
        ? {
            mode: String(enrichedCampaign.attribution_mode || "standard"),
            source: String(enrichedCampaign.attribution_source || "snapshot"),
            explicit: Boolean(enrichedCampaign.attribution_explicit)
          }
        : resolveConversionAttribution(campaign, adSetNames, adSetAttributionSpecs);

      return {
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective || "",
        status: campaign.status || campaign.effective_status || "",
        daily_budget: normalizeBudgetValue(campaign.daily_budget, budgetNormalization.divisor),
        lifetime_budget: normalizeBudgetValue(campaign.lifetime_budget, budgetNormalization.divisor),
        // Carried so a lifetime budget can be spread across its real flight rather than
        // across the reporting window.
        start_time: campaign.start_time || "",
        stop_time: campaign.stop_time || "",
        category: enrichedCampaign?.category || classifyCampaign(campaign),
        attribution_mode: attribution.mode,
        attribution_source: attribution.source,
        attribution_explicit: attribution.explicit
      };
    });
  }

  function buildAdsPayload(activeAds = []) {
    return activeAds.map((ad) => ({
      id: ad.id,
      name: ad.name,
      campaign: ad?.campaign?.name || "",
      primary: "Live ad synced from Meta",
      headline: ad?.creative?.name || "Creative headline not loaded yet",
      description: "Creative details can be expanded in the next integration step.",
      adset: ad?.adset?.name || ""
    }));
  }

  function buildSnapshotDashboardAssembly({
    enrichedCampaigns = [],
    includedCampaigns = [],
    adSets = [],
    activeAds = [],
    budgetCampaignsRaw = [],
    budgetAdSets = [],
    adSetsByCampaignId,
    budgetNormalization,
    awarenessUsingAdSetInsights = 0,
    totalSpend = 0,
    dateScope,
    accountCurrency,
    activeCampaigns = [],
    campaignResponse,
    aggregatedInsightsResponse,
    dailyInsightsResponse,
    adSetsResponse,
    aggregatedAdSetInsightsResponse,
    dailyAdSetInsightsResponse,
    adsResponse,
    incrementalInsightsAvailable = false,
    timings,
    buildScheduleDiagnostics
  }) {
    const buckets = splitByCategory(enrichedCampaigns);
    const conversionBuckets = splitConversionByAttribution(buckets.conversion);
    const incrementalLensCampaigns = buildIncrementalLensCampaigns(enrichedCampaigns);
    const attributionOverlapIds = findCampaignIdOverlap(conversionBuckets.standard, incrementalLensCampaigns);
    const enrichedCampaignById = new Map(enrichedCampaigns.map((campaign) => [String(campaign.id || ""), campaign]));
    const campaignCategoryById = new Map(enrichedCampaigns.map((campaign) => [String(campaign.id || ""), classifyCampaign(campaign)]));
    const campaignsWithPeriodDataCount = includedCampaigns.filter((campaign) => {
      return readNumber(campaign?.spend_value, 0) > 0;
    }).length;
    const awarenessCampaignSpendTotal = buckets.awareness.reduce((sum, campaign) => sum + readNumber(campaign?.spend_value, 0), 0);
    const awarenessAdSetSpendTotal = adSets.reduce((sum, adSet) => {
      const campaignId = String(adSet?.campaignId || "");
      if (campaignCategoryById.get(campaignId) !== "awareness") {
        return sum;
      }
      return sum + readNumber(adSet?.spend_value, 0);
    }, 0);
    const explicitIncrementalCount = conversionBuckets.incremental.filter((campaign) => campaign.attribution_explicit).length;
    const incrementalNamedCount = conversionBuckets.incremental.filter((campaign) => hasIncrementalNameTag(campaign?.name)).length;
    const nonNamedIncrementalMetricsCount = conversionBuckets.standard.filter((campaign) => {
      return campaign?.incremental_metrics_available;
    }).length;
    const budgetCampaigns = buildBudgetCampaigns({
      budgetCampaignsRaw,
      enrichedCampaignById,
      adSetsByCampaignId,
      budgetNormalization
    });
    const budgetAllocation = calculateBudgetAllocation(budgetCampaigns, budgetAdSets, dateScope.days, {
      // budgetCampaigns already carry the resolved attribution mode; fall back to a fresh
      // resolve only if a row somehow arrives without one.
      classifyConversionAttribution: (campaign) => String(campaign?.attribution_mode || "")
        || classifyConversionAttribution(campaign)
    });
    const generalSpendDistribution = buildGeneralSpendDistribution(enrichedCampaigns, dateScope, accountCurrency, budgetAllocation);

    // Built after the allocation so the warnings can report on budget coverage: unmapped
    // objectives, lifetime budgets without a flight, and active campaigns with no budget.
    const qualityWarnings = buildQualityWarnings({
      budgetNormalization,
      includedCampaignCount: includedCampaigns.length,
      campaignsWithPeriodDataCount,
      awarenessCampaignCount: buckets.awareness.length,
      awarenessUsingAdSetInsights,
      conversionCampaignCount: buckets.conversion.length,
      explicitIncrementalCount,
      incrementalNamedCount,
      attributionOverlapCount: attributionOverlapIds.length,
      nonNamedIncrementalMetricsCount,
      campaignSpendTotal: totalSpend,
      awarenessCampaignSpendTotal,
      awarenessAdSetSpendTotal,
      budgetAllocation,
      unclassifiedCampaignCount: buckets.unclassified.length,
      unclassifiedSpendTotal: readNumber(generalSpendDistribution?.unclassifiedAmount, 0),
      unclassifiedCampaigns: buckets.unclassified,
      accountCurrency,
      periodDays: dateScope.days
    });

    const dashboard = {
      statsByLens: {
        general: buildLensStats(enrichedCampaigns, "general", dateScope, {
          currency: accountCurrency,
          generalSpendDistribution
        }),
        awareness: buildLensStats(buckets.awareness, "awareness", dateScope, { currency: accountCurrency }),
        leads: buildLensStats(buckets.leads, "leads", dateScope, { currency: accountCurrency }),
        conversion_standard: buildLensStats(conversionBuckets.standard, "conversion_standard", dateScope, { currency: accountCurrency }),
        conversion_incremental: buildLensStats(incrementalLensCampaigns, "conversion_incremental", dateScope, { currency: accountCurrency })
      },
      summaryByLens: {
        general: buildLensSummary(enrichedCampaigns, "general", dateScope),
        awareness: buildLensSummary(buckets.awareness, "awareness", dateScope),
        leads: buildLensSummary(buckets.leads, "leads", dateScope),
        conversion_standard: buildLensSummary(conversionBuckets.standard, "conversion_standard", dateScope),
        conversion_incremental: buildLensSummary(incrementalLensCampaigns, "conversion_incremental", dateScope)
      },
      visuals: {
        heroPanelByLens: {
          general: buildHeroPanelItems(enrichedCampaigns, "general", accountCurrency, dateScope),
          awareness: buildHeroPanelItems(buckets.awareness, "awareness", accountCurrency, dateScope),
          leads: buildHeroPanelItems(buckets.leads, "leads", accountCurrency, dateScope),
          conversion_standard: buildHeroPanelItems(conversionBuckets.standard, "conversion_standard", accountCurrency, dateScope),
          conversion_incremental: buildHeroPanelItems(incrementalLensCampaigns, "conversion_incremental", accountCurrency, dateScope)
        },
        trendCardsByLens: {
          general: buildTrendCards(enrichedCampaigns, "general", dateScope, accountCurrency),
          awareness: buildTrendCards(buckets.awareness, "awareness", dateScope, accountCurrency),
          leads: buildTrendCards(buckets.leads, "leads", dateScope, accountCurrency),
          conversion_standard: buildTrendCards(conversionBuckets.standard, "conversion_standard", dateScope, accountCurrency),
          conversion_incremental: buildTrendCards(incrementalLensCampaigns, "conversion_incremental", dateScope, accountCurrency)
        },
        overviewCards: buildOverviewCards(enrichedCampaigns, accountCurrency)
      },
      currency: accountCurrency,
      quality: {
        source: "meta-live-api",
        budgetNormalization,
        budgetAllocation,
        schedule: buildScheduleDiagnostics(),
        generalSpendDistribution,
        explicitIncrementalCount,
        incrementalNamedCount,
        incrementalInsightsAvailable,
        includedCampaignCount: includedCampaigns.length,
        campaignsWithPeriodDataCount,
        activeCampaignCount: activeCampaigns.length,
        budgetCampaignCount: budgetCampaigns.length,
        activeAdCount: activeAds.length,
        activeAdSetCount: adSets.length,
        awarenessUsingAdSetInsights,
        reconciliation: {
          campaignSpendTotal: totalSpend,
          awarenessCampaignSpendTotal,
          awarenessAdSetSpendTotal
        },
        attributionValidation: {
          standardCount: conversionBuckets.standard.length,
          incrementalCount: incrementalLensCampaigns.length,
          overlapCount: attributionOverlapIds.length,
          overlapCampaignIds: attributionOverlapIds,
          nonNamedIncrementalMetricsCount
        },
        pagination: {
          campaignsPages: campaignResponse.pageCount,
          campaignInsightsPages: aggregatedInsightsResponse.pageCount,
          campaignDailyInsightsPages: dailyInsightsResponse.pageCount,
          adSetsPages: adSetsResponse.pageCount,
          adSetInsightsPages: aggregatedAdSetInsightsResponse.pageCount,
          adSetDailyInsightsPages: dailyAdSetInsightsResponse.pageCount,
          adsPages: adsResponse.pageCount
        },
        timings,
        warnings: qualityWarnings
      }
    };

    dashboard.quality.validation = buildDashboardValidation({
      campaigns: enrichedCampaigns,
      dashboard,
      budgetAllocation
    });

    return {
      dashboard,
      ads: buildAdsPayload(activeAds),
      budgetAllocation,
      budgetCampaigns,
      conversionBuckets,
      incrementalLensCampaigns,
      qualityWarnings
    };
  }

  return {
    buildSnapshotDashboardAssembly
  };
}

module.exports = {
  createMetaSnapshotDashboardBuilder
};
