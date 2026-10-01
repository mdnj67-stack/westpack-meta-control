// Meta's effective_status is the delivery state Ads Manager shows. It is reported here
// verbatim in readable form rather than being replaced by a fixed label, so a campaign
// that is paused, in review or rejected cannot read as healthy.
const { reportedEntries } = require("./measurement-basis.js");

const DELIVERY_STATUS_LABELS = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CAMPAIGN_PAUSED: "Campaign paused",
  ADSET_PAUSED: "Ad set paused",
  PENDING_REVIEW: "In review",
  IN_PROCESS: "In process",
  PENDING_BILLING_INFO: "Billing needed",
  PREAPPROVED: "Pre-approved",
  DISAPPROVED: "Rejected",
  WITH_ISSUES: "With issues",
  ARCHIVED: "Archived",
  DELETED: "Deleted"
};

function describeDeliveryStatus(campaign = {}) {
  const raw = String(campaign.effective_status || campaign.status || "").trim().toUpperCase();
  if (!raw) return "Unknown";
  return DELIVERY_STATUS_LABELS[raw] || raw.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function createMetaSnapshotTransformers({
  readNumber,
  getPreferredActionValue,
  getRoasFromInsight,
  sortSeries,
  splitSeriesByDateRange,
  classifyCampaign,
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
    const reach = readNumber(row.reach || "0", 0);
    const clicks = readNumber(row.inline_link_clicks || "0", 0);
    const addToCart = getPreferredActionValue(row.actions || [], addToCartActionTypes);
    const purchases = getPreferredActionValue(row.actions || [], purchaseActionTypes);
    const revenue = getPreferredActionValue(row.action_values || [], purchaseActionTypes);
    const leads = getPreferredActionValue(row.actions || [], leadActionTypes);

    return {
      date: row.date_start,
      spend,
      impressions,
      reach,
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
    const totalClicks = includedCampaigns.reduce((sum, campaign) => {
      return sum + readNumber(insightMap[campaign.id]?.inline_link_clicks || "0", 0);
    }, 0);
    const totalImpressions = includedCampaigns.reduce((sum, campaign) => {
      return sum + readNumber(insightMap[campaign.id]?.impressions || "0", 0);
    }, 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

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
        label: "CTR",
        value: `${averageCtr.toFixed(2)}%`,
        meta: "Clicks / impressions across included campaigns"
      }
    ];
  }

  function buildCampaignMetricCollections({
    includedCampaigns = [],
    adSetsByCampaignId,
    insightMap = {},
    seriesMap = {},
    dateScope,
    accountCurrency,
    budgetNormalization,
    customerConversionActionTypes = {}
  }) {
    let awarenessUsingAdSetInsights = 0;
    let awarenessAdSetBreakdownRejected = 0;

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
      // Kept before any override so the reconciliation has a real other side to compare
      // against, and so the payload can report what Meta actually said this campaign spent.
      const campaignLevelSpend = spend;
      // What Meta reports under the campaign's own attribution setting, before the
      // dashboard's single basis is applied. Shown beside each campaign so a figure in Ads
      // Manager can be found here, and never added into a total.
      const reportedPurchases = getPreferredActionValue(reportedEntries(insight.actions), purchaseActionTypes);
      const reportedRevenue = getPreferredActionValue(reportedEntries(insight.action_values), purchaseActionTypes);
      const reportedCustomers = extractCustomerAcquisition(
        { actions: reportedEntries(insight.actions), action_values: reportedEntries(insight.action_values) },
        customerConversionActionTypes
      );

      if (baseCategory === "awareness") {
        const adSetsWithInsights = linkedAdSets.filter((adSet) => {
          return adSet.spend_value > 0 || (Array.isArray(adSet.series) && adSet.series.length > 0);
        });

        const adSetSpendTotal = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.spend_value, 0), 0);
        // Meta rounds per entity, so a small gap is expected; a real one means ad sets are
        // missing from the breakdown.
        const spendGap = Math.abs(campaignLevelSpend - adSetSpendTotal);
        const adSetBreakdownReconciles = campaignLevelSpend > 0
          ? (spendGap / campaignLevelSpend) <= 0.01
          : adSetSpendTotal === 0;

        if (adSetsWithInsights.length && !adSetBreakdownReconciles) {
          awarenessAdSetBreakdownRejected += 1;
        }

        if (adSetsWithInsights.length && adSetBreakdownReconciles) {
          awarenessUsingAdSetInsights += 1;
          spend = adSetSpendTotal;
          clicks = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.clicks_value, 0), 0);
          impressions = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.impressions_value, 0), 0);
          // Reach and frequency stay at campaign level. A campaign's insight already
          // deduplicates people across its own ad sets; adding the ad sets' reach counted
          // anyone in two of them twice and pulled frequency down with it.
          addToCart = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.add_to_cart_value, 0), 0);
          purchases = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.purchases_value, 0), 0);
          revenue = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.revenue_value, 0), 0);
          leads = adSetsWithInsights.reduce((sum, adSet) => sum + readNumber(adSet.leads_value, 0), 0);
          cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

          const seriesTotals = new Map();
          for (const adSet of adSetsWithInsights) {
            for (const point of adSet.series || []) {
              const key = String(point.date || "");
              const current = seriesTotals.get(key) || {
                spend: 0,
                impressions: 0,
                reach: 0,
                clicks: 0,
                add_to_cart: 0,
                purchases: 0,
                revenue: 0,
                leads: 0
              };

              seriesTotals.set(key, {
                spend: current.spend + readNumber(point.spend, 0),
                impressions: current.impressions + readNumber(point.impressions, 0),
                // Summed across the ad sets of one campaign, so it double counts anyone in
                // two of them. It is only ever read as a day-over-day change here, where
                // both windows carry the same bias; the reach figure the panel prints comes
                // from an account-level query instead.
                reach: current.reach + readNumber(point.reach, 0),
                clicks: current.clicks + readNumber(point.clicks, 0),
                add_to_cart: current.add_to_cart + readNumber(point.add_to_cart, 0),
                purchases: current.purchases + readNumber(point.purchases, 0),
                revenue: current.revenue + readNumber(point.revenue, 0),
                leads: current.leads + readNumber(point.leads, 0)
              });
            }
          }

          const rebuiltSeries = sortSeries(Array.from(seriesTotals.entries()).map(([date, value]) => ({
            date,
            ...value
          })));
          if (rebuiltSeries.length) {
            series = rebuiltSeries;
          }
        }
      }

      // A rate with nothing underneath it is undefined, and is sent as null so the table
      // prints "--". As a 0 it printed "0 kr." CPA for a campaign that bought nothing.
      const roas = spend > 0 ? revenue / spend : null;
      const cpa = purchases > 0 ? spend / purchases : null;
      const cpl = leads > 0 ? spend / leads : null;
      const comparisonWindow = splitSeriesByDateRange(series, dateScope.since, dateScope.until);

      return {
        id: campaign.id,
        name: campaign.name,
        market: "",
        spend: formatCurrency(spend, accountCurrency),
        roas: roas ? roas.toFixed(2) : "",
        ctr: `${ctr.toFixed(2)}%`,
        status: describeDeliveryStatus(campaign),
        effective_status: campaign.effective_status || campaign.status || "",
        objective: campaign.objective || "",
        daily_budget: normalizeBudgetValue(campaign.daily_budget, budgetNormalization.divisor),
        lifetime_budget: normalizeBudgetValue(campaign.lifetime_budget, budgetNormalization.divisor),
        daily_budget_raw: campaign.daily_budget || null,
        lifetime_budget_raw: campaign.lifetime_budget || null,
        currency: accountCurrency,
        spend_value: spend,
        campaign_level_spend_value: campaignLevelSpend,
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
        reported_purchases_value: reportedPurchases,
        reported_revenue_value: reportedRevenue,
        reported_roas_value: spend > 0 ? reportedRevenue / spend : null,
        reported_new_customers_value: reportedCustomers.new_customers_value,
        // What Ads Manager prints in its "Attribution setting" column. It no longer decides
        // anything - every result is measured on incremental attribution - but it says what
        // the "Reported by Meta" figures beside it were counted under. "multiple" means the
        // campaign's ad sets ran on different settings in the range.
        attribution_setting: String(insight.attribution_setting || "")
      };
    });

    return {
      awarenessUsingAdSetInsights,
      awarenessAdSetBreakdownRejected,
      campaigns
    };
  }

  // Campaigns that spent in the comparison window but not in the selected range: paused
  // before it started, or replaced. They carry only their previous-window series.
  //
  // Without them every "vs previous" badge compared the campaigns that exist now against
  // only those of them that also existed before - a set that can only shrink going
  // backwards. After a restructure, as on 2026-09-09, that read as growth that was really
  // money moving from old campaigns to new ones. They never appear in a table or a total:
  // their current spend is zero and they have no current series.
  function buildPreviousOnlyCampaigns({
    campaignRows = [],
    includedCampaignIds,
    seriesMap = {},
    dateScope
  }) {
    return (campaignRows || [])
      .filter((campaign) => !includedCampaignIds.has(String(campaign.id)) && (seriesMap[campaign.id] || []).length > 0)
      .map((campaign) => {
        const window = splitSeriesByDateRange(sortSeries(seriesMap[campaign.id] || []), dateScope.since, dateScope.until);
        return {
          id: campaign.id,
          name: campaign.name,
          objective: campaign.objective || "",
          category: classifyCampaign(campaign),
          spend_value: 0,
          series: [],
          comparison_window: { previous: window.previous, current: [] },
          previous_only: true
        };
      })
      .filter((campaign) => campaign.comparison_window.previous.length > 0);
  }

  function enrichCampaignsWithAttribution({
    campaigns = [],
    adSetsByCampaignId
  }) {
    return campaigns.map((campaign) => {
      const linkedAdSets = adSetsByCampaignId.get(String(campaign.id || "")) || [];
      return {
        ...campaign,
        adset_names: linkedAdSets.map((adSet) => String(adSet?.name || "")),
        category: classifyCampaign(campaign)
      };
    });
  }

  return {
    buildActiveAds,
    buildAdSetCollections,
    buildCampaignMetricCollections,
    buildIncludedCampaignContext,
    buildInsightMap,
    buildPreviousOnlyCampaigns,
    buildSeriesMap,
    buildSnapshotStats,
    enrichCampaignsWithAttribution
  };
}

module.exports = {
  createMetaSnapshotTransformers
};
