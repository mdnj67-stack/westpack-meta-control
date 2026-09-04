function createMetaSnapshotTransformers({
  readNumber,
  getPreferredActionValue,
  getRoasFromInsight,
  sortSeries,
  splitSeriesByDateRange,
  classifyCampaign,
  resolveConversionAttribution,
  normalizeBudgetValue,
  formatCurrency,
  resolveBudgetNormalization,
  extractCustomerAcquisition,
  isActiveDeliveryStatus,
  purchaseActionTypes,
  addToCartActionTypes,
  leadActionTypes
}) {
  function buildMetricSeriesPoint(row = {}) {
    const spend = readNumber(row.spend || "0", 0);
    const impressions = readNumber(row.impressions || "0", 0);
    const clicks = readNumber(row.inline_link_clicks || "0", 0);
    const addToCart = getPreferredActionValue(row.actions || [], addToCartActionTypes);
    const purchases = getPreferredActionValue(row.actions || [], purchaseActionTypes);
    const revenue = getPreferredActionValue(row.action_values || [], purchaseActionTypes);
    const leads = getPreferredActionValue(row.actions || [], leadActionTypes);

    return {
      date: row.date_start,
      spend,
      impressions,
      clicks,
      add_to_cart: addToCart,
      purchases,
      revenue,
      leads
    };
  }

  function buildInsightMap(rows = [], keyField = "") {
    const map = {};
    for (const row of rows || []) {
      const key = row?.[keyField];
      if (key) {
        map[key] = row;
      }
    }
    return map;
  }

  function buildSeriesMap(rows = [], keyField = "") {
    const map = {};
    for (const row of rows || []) {
      const key = row?.[keyField];
      if (!key) {
        continue;
      }
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(buildMetricSeriesPoint(row));
    }
    return map;
  }

  function buildIncludedCampaignContext({
    campaignRows = [],
    activeCampaigns = [],
    budgetCampaignsRaw = [],
    adSetRows = [],
    insightMap = {},
    dateScope,
    accountCurrency
  }) {
    const activeCampaignIds = new Set(activeCampaigns.map((campaign) => campaign.id));
    const campaignIdsWithPeriodData = new Set(Object.keys(insightMap));
    const includedCampaignIds = new Set([
      ...activeCampaignIds,
      ...campaignIdsWithPeriodData
    ]);
    const includedCampaigns = (campaignRows || []).filter((campaign) => includedCampaignIds.has(String(campaign.id)));
    const totalSpend = includedCampaigns.reduce((sum, campaign) => {
      return sum + readNumber(insightMap[campaign.id]?.spend || "0", 0);
    }, 0);

    // Meta always returns budgets in the account currency's minor unit, so the divisor
    // is a lookup, not an inference from the observed budget magnitudes.
    const budgetNormalization = resolveBudgetNormalization(accountCurrency);

    return {
      activeCampaignIds,
      campaignIdsWithPeriodData,
      includedCampaignIds,
      includedCampaigns,
      totalSpend,
      budgetNormalization
    };
  }

  function buildAdSetCollections({
    adSetRows = [],
    includedCampaignIds,
    budgetNormalization,
    adSetInsightMap = {},
    adSetSeriesMap = {}
  }) {
    const adSets = (adSetRows || [])
      .filter((adSet) => adSet.campaign && includedCampaignIds.has(adSet.campaign.id))
      .map((adSet) => ({
        id: adSet.id,
        name: adSet.name,
        status: adSet.status || adSet.effective_status || "",
        daily_budget: normalizeBudgetValue(adSet.daily_budget, budgetNormalization.divisor),
        lifetime_budget: normalizeBudgetValue(adSet.lifetime_budget, budgetNormalization.divisor),
        daily_budget_raw: adSet.daily_budget || null,
        lifetime_budget_raw: adSet.lifetime_budget || null,
        attribution_spec: Array.isArray(adSet.attribution_spec) ? adSet.attribution_spec : [],
        attribution_setting: adSet.attribution_setting || "",
        campaignId: adSet?.campaign?.id || "",
        campaignName: adSet?.campaign?.name || "",
        spend_value: readNumber(adSetInsightMap[adSet.id]?.spend || "0", 0),
        impressions_value: readNumber(adSetInsightMap[adSet.id]?.impressions || "0", 0),
        reach_value: readNumber(adSetInsightMap[adSet.id]?.reach || "0", 0),
        frequency_value: readNumber(adSetInsightMap[adSet.id]?.frequency || "0", 0),
        cpm_value: readNumber(adSetInsightMap[adSet.id]?.cpm || "0", 0),
        clicks_value: readNumber(adSetInsightMap[adSet.id]?.inline_link_clicks || "0", 0),
        ctr_value: readNumber(adSetInsightMap[adSet.id]?.inline_link_click_ctr || "0", 0),
        add_to_cart_value: getPreferredActionValue(adSetInsightMap[adSet.id]?.actions || [], addToCartActionTypes),
        purchases_value: getPreferredActionValue(adSetInsightMap[adSet.id]?.actions || [], purchaseActionTypes),
        revenue_value: getPreferredActionValue(adSetInsightMap[adSet.id]?.action_values || [], purchaseActionTypes),
        leads_value: getPreferredActionValue(adSetInsightMap[adSet.id]?.actions || [], leadActionTypes),
        roas_value: getRoasFromInsight(adSetInsightMap[adSet.id] || {}),
        series: sortSeries(adSetSeriesMap[adSet.id] || [])
      }));

    const budgetAdSets = (adSetRows || [])
      .filter((adSet) => adSet.campaign && isActiveDeliveryStatus(adSet?.effective_status || adSet?.status))
      .map((adSet) => ({
        id: adSet.id,
        name: adSet.name,
        status: adSet.status || adSet.effective_status || "",
        daily_budget: normalizeBudgetValue(adSet.daily_budget, budgetNormalization.divisor),
        lifetime_budget: normalizeBudgetValue(adSet.lifetime_budget, budgetNormalization.divisor),
        // Carried so a lifetime budget can be spread across its real flight rather than
        // across the reporting window.
        start_time: adSet.start_time || "",
        end_time: adSet.end_time || "",
        attribution_spec: Array.isArray(adSet.attribution_spec) ? adSet.attribution_spec : [],
        attribution_setting: adSet.attribution_setting || "",
        campaignId: adSet?.campaign?.id || "",
        campaignName: adSet?.campaign?.name || ""
      }));

    const adSetsByCampaignId = new Map();
    for (const adSet of adSets) {
      const campaignId = String(adSet?.campaignId || "");
      if (!campaignId) continue;
      if (!adSetsByCampaignId.has(campaignId)) {
        adSetsByCampaignId.set(campaignId, []);
      }
      adSetsByCampaignId.get(campaignId).push(adSet);
    }

    return {
      adSets,
      budgetAdSets,
      adSetsByCampaignId
    };
  }

  function buildActiveAds(adsRows = [], includedCampaignIds) {
    return (adsRows || []).filter((ad) => {
      return ad.status === "ACTIVE" && ad.campaign && includedCampaignIds.has(ad.campaign.id);
    });
  }

  function buildSnapshotStats({
    includedCampaigns = [],
    activeAds = [],
    insightMap = {},
    dateScope,
    accountCurrency
  }) {
    const totalSpend = includedCampaigns.reduce((sum, campaign) => {
      return sum + readNumber(insightMap[campaign.id]?.spend || "0", 0);
    }, 0);
    const ctrValues = includedCampaigns
      .map((campaign) => readNumber(insightMap[campaign.id]?.inline_link_click_ctr || "0", 0))
      .filter((value) => value > 0);
    const averageCtr = ctrValues.length
      ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length
      : 0;

    return [
      {
        label: "Included campaigns",
        value: String(includedCampaigns.length),
        meta: "Spend in scope or active now"
      },
      {
        label: "Active ads",
        value: String(activeAds.length),
        meta: "Live Meta sync"
      },
      {
        label: `Spend (${dateScope.shortLabel})`,
        value: formatCurrency(totalSpend, accountCurrency),
        meta: "Live insights"
      },
      {
        label: "Average CTR",
        value: `${averageCtr.toFixed(2)}%`,
        meta: "Included campaigns"
      }
    ];
  }

  function buildCampaignMetricCollections({
    includedCampaigns = [],
    adSetsByCampaignId,
    insightMap = {},
    seriesMap = {},
    incrementalInsightMap = {},
    incrementalSeriesMap = {},
    incrementalInsightsAvailable = false,
    dateScope,
    accountCurrency,
    budgetNormalization,
    customerConversionActionTypes = {}
  }) {
    let awarenessUsingAdSetInsights = 0;

    const campaigns = includedCampaigns.map((campaign) => {
      const insight = insightMap[campaign.id] || {};
      const linkedAdSets = adSetsByCampaignId.get(String(campaign.id || "")) || [];
      const baseCategory = classifyCampaign(campaign);

      let spend = readNumber(insight.spend || "0", 0);
      let clicks = readNumber(insight.inline_link_clicks || "0", 0);
      let impressions = readNumber(insight.impressions || "0", 0);
      let reach = readNumber(insight.reach || "0", 0);
      let frequency = readNumber(insight.frequency || "0", 0);
      let cpm = readNumber(insight.cpm || "0", 0);
      let ctr = readNumber(insight.inline_link_click_ctr || "0", 0);
      let addToCart = getPreferredActionValue(insight.actions || [], addToCartActionTypes);
      let purchases = getPreferredActionValue(insight.actions || [], purchaseActionTypes);
      let revenue = getPreferredActionValue(insight.action_values || [], purchaseActionTypes);
      let leads = getPreferredActionValue(insight.actions || [], leadActionTypes);
      let series = sortSeries(seriesMap[campaign.id] || []);
      const incrementalInsight = incrementalInsightMap[campaign.id] || {};
      const incrementalPurchases = getPreferredActionValue(incrementalInsight.actions || [], purchaseActionTypes);
      const incrementalRevenue = getPreferredActionValue(incrementalInsight.action_values || [], purchaseActionTypes);
      const incrementalRoas = getRoasFromInsight(incrementalInsight || {});
      const incrementalCpa = incrementalPurchases > 0 ? spend / incrementalPurchases : 0;
      const incrementalSeries = sortSeries(incrementalSeriesMap[campaign.id] || []);
      const incrementalMetricsAvailable = incrementalInsightsAvailable && (
        Boolean(incrementalInsightMap[campaign.id])
        || incrementalSeries.length > 0
      );

      if (baseCategory === "awareness") {
        const adSetsWithInsights = linkedAdSets.filter((adSet) => {
          return adSet.spend_value > 0 || (Array.isArray(adSet.series) && adSet.series.length > 0);
        });

        if (adSetsWithInsights.length) {
          awarenessUsingAdSetInsights += 1;
          spend = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.spend_value, 0), 0);
          clicks = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.clicks_value, 0), 0);
          impressions = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.impressions_value, 0), 0);
          reach = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.reach_value, 0), 0);
          addToCart = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.add_to_cart_value, 0), 0);
          purchases = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.purchases_value, 0), 0);
          revenue = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.revenue_value, 0), 0);
          leads = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.leads_value, 0), 0);
          frequency = reach > 0 ? impressions / reach : 0;
          cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

          const seriesTotals = new Map();
          for (const adSet of adSetsWithInsights) {
            for (const point of adSet.series || []) {
              const key = String(point.date || "");
              const current = seriesTotals.get(key) || {
                spend: 0,
                impressions: 0,
                clicks: 0,
                add_to_cart: 0,
                purchases: 0,
                revenue: 0,
                leads: 0
              };

              seriesTotals.set(key, {
                spend: current.spend + readNumber(point.spend, 0),
                impressions: current.impressions + readNumber(point.impressions, 0),
                clicks: current.clicks + readNumber(point.clicks, 0),
                add_to_cart: current.add_to_cart + readNumber(point.add_to_cart, 0),
                purchases: current.purchases + readNumber(point.purchases, 0),
                revenue: current.revenue + readNumber(point.revenue, 0),
                leads: current.leads + readNumber(point.leads, 0)
              });
            }
          }

          series = sortSeries(Array.from(seriesTotals.entries()).map(([date, value]) => ({
            date,
            ...value
          })));
        }
      }

      const roas = spend > 0 ? revenue / spend : 0;
      const cpa = purchases > 0 ? spend / purchases : 0;
      const cpl = leads > 0 ? spend / leads : 0;
      const comparisonWindow = splitSeriesByDateRange(series, dateScope.since, dateScope.until);
      const incrementalComparisonWindow = splitSeriesByDateRange(incrementalSeries, dateScope.since, dateScope.until);

      return {
        id: campaign.id,
        name: campaign.name,
        market: "",
        spend: formatCurrency(spend, accountCurrency),
        roas: roas ? roas.toFixed(2) : "",
        ctr: `${ctr.toFixed(2)}%`,
        status: "Healthy",
        objective: campaign.objective || "",
        daily_budget: normalizeBudgetValue(campaign.daily_budget, budgetNormalization.divisor),
        lifetime_budget: normalizeBudgetValue(campaign.lifetime_budget, budgetNormalization.divisor),
        daily_budget_raw: campaign.daily_budget || null,
        lifetime_budget_raw: campaign.lifetime_budget || null,
        currency: accountCurrency,
        spend_value: spend,
        impressions_value: impressions,
        reach_value: reach,
        frequency_value: frequency,
        cpm_value: cpm,
        clicks_value: clicks,
        ctr_value: ctr,
        add_to_cart_value: addToCart,
        purchases_value: purchases,
        revenue_value: revenue,
        roas_value: roas,
        cpa_value: cpa,
        leads_value: leads,
        cpl_value: cpl,
        // New vs existing customer counts, read from the account's own custom
        // conversions. Zero here means the event did not fire, not that the shop has no
        // new customers - the untagged remainder is reported separately.
        ...extractCustomerAcquisition(insight, customerConversionActionTypes),
        series: comparisonWindow.current,
        comparison_window: comparisonWindow,
        incremental_purchases_value: incrementalPurchases,
        incremental_revenue_value: incrementalRevenue,
        incremental_roas_value: incrementalRoas,
        incremental_cpa_value: incrementalCpa,
        incremental_series: incrementalComparisonWindow.current,
        incremental_comparison_window: incrementalComparisonWindow,
        incremental_metrics_available: incrementalMetricsAvailable
      };
    });

    return {
      awarenessUsingAdSetInsights,
      campaigns
    };
  }

  function enrichCampaignsWithAttribution({
    campaigns = [],
    adSetsByCampaignId
  }) {
    return campaigns.map((campaign) => {
      const linkedAdSets = adSetsByCampaignId.get(String(campaign.id || "")) || [];
      const adSetNames = linkedAdSets.map((adSet) => String(adSet?.name || ""));
      const adSetAttributionSpecs = linkedAdSets.map((adSet) => Array.isArray(adSet?.attribution_spec) ? adSet.attribution_spec : []);
      const attribution = resolveConversionAttribution(campaign, adSetNames, adSetAttributionSpecs);

      return {
        ...campaign,
        adset_names: adSetNames,
        adset_attribution_specs: adSetAttributionSpecs,
        category: classifyCampaign(campaign),
        attribution_mode: attribution.mode,
        attribution_source: attribution.source,
        attribution_explicit: attribution.explicit
      };
    });
  }

  return {
    buildActiveAds,
    buildAdSetCollections,
    buildCampaignMetricCollections,
    buildIncludedCampaignContext,
    buildInsightMap,
    buildSeriesMap,
    buildSnapshotStats,
    enrichCampaignsWithAttribution
  };
}

module.exports = {
  createMetaSnapshotTransformers
};
