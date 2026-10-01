function createMetaSnapshotDashboardBuilder({
  splitByCategory,
  classifyCampaign,
  buildQualityWarnings,
  normalizeBudgetValue,
  calculateBudgetAllocation,
  buildCustomerAcquisition,
  buildCustomerAcquisitionTrend,
  buildCustomerAcquisitionWarnings,
  compareAcquisitionWindow,
  resolveAcquisitionWindowPresets,
  resolveCompletedDayComparison,
  formatCurrency,
  buildGeneralSpendDistribution,
  buildLensStats,
  buildHeroPanelItems,
  buildTrendCards,
  buildOverviewCards,
  buildDashboardValidation,
  readNumber
}) {
  function buildBudgetCampaigns({
    budgetCampaignsRaw = [],
    enrichedCampaignById,
    budgetNormalization
  }) {
    return budgetCampaignsRaw.map((campaign) => {
      const enrichedCampaign = enrichedCampaignById.get(String(campaign.id || "")) || null;
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
        category: enrichedCampaign?.category || classifyCampaign(campaign)
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
    previousOnlyCampaigns = [],
    includedCampaigns = [],
    adSets = [],
    activeAds = [],
    budgetCampaignsRaw = [],
    budgetAdSets = [],
    budgetNormalization,
    customerConversionActionTypes = {},
    acquisitionTrendRows = [],
    acquisitionTrendUnavailable = false,
    accountTimezone = "",
    deduplicatedReach = null,
    awarenessUsingAdSetInsights = 0,
    awarenessAdSetBreakdownRejected = 0,
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
    timings,
    buildScheduleDiagnostics
  }) {
    const buckets = splitByCategory(enrichedCampaigns);
    // Only ever read by the "vs previous" comparisons. See buildPreviousOnlyCampaigns.
    const previousOnly = splitByCategory(previousOnlyCampaigns);
    const enrichedCampaignById = new Map(enrichedCampaigns.map((campaign) => [String(campaign.id || ""), campaign]));
    const campaignCategoryById = new Map(enrichedCampaigns.map((campaign) => [String(campaign.id || ""), classifyCampaign(campaign)]));
    // Counted on the campaigns that carry insight figures. `includedCampaigns` is the raw
    // metadata list, which has no spend field, so counting it returned 0 on every snapshot
    // and the "no spend data" warning fired every time.
    const campaignsWithPeriodData = enrichedCampaigns.filter((campaign) => readNumber(campaign?.spend_value, 0) > 0);
    const activeCampaignIds = new Set((activeCampaigns || []).map((campaign) => String(campaign?.id || "")));
    const activeCampaignsWithoutSpend = enrichedCampaigns.filter((campaign) => {
      return activeCampaignIds.has(String(campaign?.id || "")) && !(readNumber(campaign?.spend_value, 0) > 0);
    });
    // spend_value may already be the ad-set sum, so comparing it against the ad-set total
    // was the same number on both sides and the warning could never fire. The campaign
    // level figure is what Meta reported before any override.
    const awarenessCampaignSpendTotal = buckets.awareness.reduce(
      (sum, campaign) => sum + readNumber(campaign?.campaign_level_spend_value ?? campaign?.spend_value, 0),
      0
    );
    const awarenessAdSetSpendTotal = adSets.reduce((sum, adSet) => {
      const campaignId = String(adSet?.campaignId || "");
      if (campaignCategoryById.get(campaignId) !== "awareness") {
        return sum;
      }
      return sum + readNumber(adSet?.spend_value, 0);
    }, 0);
    const budgetCampaigns = buildBudgetCampaigns({
      budgetCampaignsRaw,
      enrichedCampaignById,
      budgetNormalization
    });
    const budgetAllocation = calculateBudgetAllocation(budgetCampaigns, budgetAdSets, dateScope.days);
    const generalSpendDistribution = buildGeneralSpendDistribution(enrichedCampaigns, dateScope, accountCurrency, budgetAllocation);

    // New vs existing customers, from the account's own custom conversions. Purchases
    // matching neither keep their own visible bucket rather than being folded in.
    const customerAcquisition = buildCustomerAcquisition({
      campaigns: enrichedCampaigns,
      actionTypes: customerConversionActionTypes,
      currency: accountCurrency,
      formatCurrency,
      dateScope
    });

    // Month to date against the same elapsed point last month, from the wider daily
    // window fetched for exactly this purpose. A read that failed is not a month with no
    // customers: empty rows would sum to zero and the panel would print "No new customers
    // in either period" over an outage.
    customerAcquisition.trend = acquisitionTrendUnavailable
      ? {
          available: false,
          comparable: false,
          unavailableReason: "The day-by-day new-customer figures could not be read from Meta. Press Refresh data to try again."
        }
      : buildCustomerAcquisitionTrend({
          dailyRows: acquisitionTrendRows,
          actionTypes: customerConversionActionTypes,
          now: new Date(),
          timeZone: accountTimezone,
          currency: accountCurrency,
          formatCurrency
        });

    // The strip's new-customer badges compare the same completed days as its Spend and
    // ROAS badges, read from the account-level daily rows. Only where those rows reach back
    // far enough: a custom range from last spring would otherwise compare against days
    // that were never fetched and read as a collapse.
    const rangeWindows = resolveCompletedDayComparison(dateScope);
    const fetchedSince = resolveAcquisitionWindowPresets(new Date(), accountTimezone)?.fetch?.since || "";
    // The strip's new-customer count for the whole selected range, from the same
    // account-level rows as the panel below it, so "Last 7 days" reads the same number in
    // both places. Summed campaign rows can differ from the account by a customer or two,
    // and two numbers for one fact on one screen is the defect this dashboard keeps
    // removing. The campaign figure is the fallback for a range older than the rows.
    customerAcquisition.rangeTotals = !acquisitionTrendUnavailable
      && customerAcquisition.available
      && fetchedSince
      && dateScope?.since >= fetchedSince
      ? compareAcquisitionWindow({
          dailyRows: acquisitionTrendRows,
          preset: {
            key: "selected_range_total",
            label: dateScope?.label || "Selected range",
            comparable: false,
            current: { since: dateScope.since, until: dateScope.until, days: dateScope.days, label: "the selected range" },
            previous: { since: dateScope.since, until: dateScope.until, days: dateScope.days, label: "the selected range" }
          },
          actionTypes: customerConversionActionTypes,
          available: true,
          currency: accountCurrency,
          formatCurrency
        }).current
      : null;
    customerAcquisition.rangeComparison = !acquisitionTrendUnavailable
      && customerAcquisition.available
      && rangeWindows?.comparable
      && fetchedSince
      && rangeWindows.previous.since >= fetchedSince
      ? compareAcquisitionWindow({
          dailyRows: acquisitionTrendRows,
          preset: {
            key: "selected_range",
            label: dateScope?.label || "Selected range",
            comparable: true,
            current: { ...rangeWindows.current, days: rangeWindows.days, label: "the selected range" },
            previous: { ...rangeWindows.previous, days: rangeWindows.days, label: "the period before" }
          },
          actionTypes: customerConversionActionTypes,
          available: true,
          currency: accountCurrency,
          formatCurrency
        })
      : null;

    const accountSpend = readNumber(deduplicatedReach?.account?.spend, NaN);

    // Built after the allocation so the warnings can report on budget coverage: unmapped
    // objectives, lifetime budgets without a flight, and active campaigns with no budget.
    const qualityWarnings = buildQualityWarnings({
      budgetNormalization,
      activeCampaignsWithoutSpend,
      dateScope,
      awarenessCampaignCount: buckets.awareness.length,
      awarenessUsingAdSetInsights,
      awarenessAdSetBreakdownRejected,
      acquisitionTrendUnavailable,
      campaignSpendTotal: totalSpend,
      accountSpend,
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
        awareness: buildLensStats(buckets.awareness, "awareness", dateScope, {
          currency: accountCurrency,
          deduplicatedReach: deduplicatedReach?.awareness || null,
          previousOnlyCampaigns: previousOnly.awareness
        }),
        leads: buildLensStats(buckets.leads, "leads", dateScope, { currency: accountCurrency, previousOnlyCampaigns: previousOnly.leads }),
        conversion: buildLensStats(buckets.conversion, "conversion", dateScope, { currency: accountCurrency, previousOnlyCampaigns: previousOnly.conversion })
      },
      visuals: {
        // Only General has a strip; every other lens has a stat row instead.
        heroPanelByLens: {
          general: buildHeroPanelItems(enrichedCampaigns, "general", accountCurrency, dateScope, {
            customerAcquisition,
            previousOnlyCampaigns
          })
        },
        trendCardsByLens: {
          general: buildTrendCards(enrichedCampaigns, "general", dateScope, accountCurrency, { previousOnlyCampaigns }),
          awareness: buildTrendCards(buckets.awareness, "awareness", dateScope, accountCurrency, {
            deduplicatedReach: deduplicatedReach?.awareness || null,
            previousOnlyCampaigns: previousOnly.awareness
          }),
          leads: buildTrendCards(buckets.leads, "leads", dateScope, accountCurrency, { previousOnlyCampaigns: previousOnly.leads }),
          conversion: buildTrendCards(buckets.conversion, "conversion", dateScope, accountCurrency, { previousOnlyCampaigns: previousOnly.conversion })
        },
        overviewCards: buildOverviewCards(enrichedCampaigns, accountCurrency, {
          deduplicatedReach: deduplicatedReach?.awareness || null
        })
      },
      currency: accountCurrency,
      quality: {
        source: "meta-live-api",
        // Every purchase, revenue and customer figure is Meta's incremental attribution
        // estimate, for every campaign. See server/meta/measurement-basis.js.
        measurementBasis: "incrementality",
        budgetNormalization,
        budgetAllocation,
        schedule: buildScheduleDiagnostics(),
        generalSpendDistribution,
        customerAcquisition,
        includedCampaignCount: includedCampaigns.length,
        campaignsWithPeriodDataCount: campaignsWithPeriodData.length,
        activeCampaignCount: activeCampaigns.length,
        budgetCampaignCount: budgetCampaigns.length,
        activeAdCount: activeAds.length,
        activeAdSetCount: adSets.length,
        awarenessUsingAdSetInsights,
        awarenessAdSetBreakdownRejected,
        // Meta deduplicates reach only inside the entity you query, so these come from
        // account-level queries rather than from adding campaign reach together.
        deduplicatedReach,
        reconciliation: {
          campaignSpendTotal: totalSpend,
          accountSpend: Number.isFinite(accountSpend) ? accountSpend : null,
          awarenessCampaignSpendTotal,
          awarenessAdSetSpendTotal
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
        warnings: [...qualityWarnings, ...buildCustomerAcquisitionWarnings(customerAcquisition)]
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
