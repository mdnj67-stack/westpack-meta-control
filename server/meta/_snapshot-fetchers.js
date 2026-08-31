function createMetaSnapshotFetchers({
  buildMetaResourceCacheKey,
  getCachedMetaCollection,
  metaGetAll
}) {
  async function fetchCatalogCollections({
    accountId,
    accessToken,
    metadataCacheMaxAgeMs,
    adsCacheMaxAgeMs
  }) {
    const [campaignResponse, adsResponse, adSetsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("campaigns", [accountId, "catalog"]),
        maxAgeMs: metadataCacheMaxAgeMs,
        fetcher: () => metaGetAll(`/${accountId}/campaigns`, accessToken, {
          fields: "id,name,status,effective_status,objective",
          limit: "100"
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("ads", [accountId, "catalog"]),
        maxAgeMs: adsCacheMaxAgeMs,
        fetcher: () => metaGetAll(`/${accountId}/ads`, accessToken, {
          fields: "id,name,status,effective_status,campaign{id,name,status,effective_status},adset{id,name},creative{id,name}",
          limit: "200"
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("adsets", [accountId, "catalog"]),
        maxAgeMs: metadataCacheMaxAgeMs,
        fetcher: () => metaGetAll(`/${accountId}/adsets`, accessToken, {
          fields: "id,name,status,effective_status,attribution_spec,attribution_setting,campaign{id,name,status,effective_status}",
          limit: "500"
        })
      })
    ]);

    return {
      campaignResponse,
      adsResponse,
      adSetsResponse
    };
  }

  async function fetchDashboardMetadataCollections({
    accountId,
    accessToken,
    metadataCacheMaxAgeMs,
    adsCacheMaxAgeMs,
    timings
  }) {
    const [campaignResponse, adsResponse, adSetsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("campaigns", [accountId, "dashboard"]),
        maxAgeMs: metadataCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "campaigns_metadata",
        fetcher: () => metaGetAll(`/${accountId}/campaigns`, accessToken, {
          fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
          limit: "100"
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("ads", [accountId, "dashboard"]),
        maxAgeMs: adsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "ads_metadata",
        fetcher: () => metaGetAll(`/${accountId}/ads`, accessToken, {
          fields: "id,name,status,campaign{id,name},adset{id,name},creative{id,name}",
          limit: "200"
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("adsets", [accountId, "dashboard"]),
        maxAgeMs: metadataCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "adsets_metadata",
        fetcher: () => metaGetAll(`/${accountId}/adsets`, accessToken, {
          fields: "id,name,status,effective_status,daily_budget,lifetime_budget,attribution_spec,attribution_setting,campaign{id,name,status}",
          limit: "500"
        })
      })
    ]);

    return {
      campaignResponse,
      adsResponse,
      adSetsResponse
    };
  }

  async function fetchCampaignInsightsCollections({
    accountId,
    accessToken,
    dateScope,
    comparisonDateScope,
    insightsCacheMaxAgeMs,
    timings
  }) {
    const [aggregatedInsightsResponse, dailyInsightsResponse, aggregatedIncrementalInsightsResponse, dailyIncrementalInsightsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_campaign_agg", [accountId, dateScope.since, dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "campaign_insights_aggregated",
        fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
          level: "campaign",
          time_range: JSON.stringify({ since: dateScope.since, until: dateScope.until }),
          limit: "500",
          fields: [
            "campaign_id",
            "campaign_name",
            "spend",
            "impressions",
            "reach",
            "frequency",
            "cpm",
            "inline_link_clicks",
            "inline_link_click_ctr",
            "cpc",
            "actions",
            "action_values",
            "purchase_roas",
            "website_purchase_roas"
          ].join(",")
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_campaign_daily_cmp", [accountId, comparisonDateScope?.since || dateScope.since, comparisonDateScope?.until || dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "campaign_insights_daily",
        fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
          level: "campaign",
          time_range: JSON.stringify({ since: comparisonDateScope?.since || dateScope.since, until: comparisonDateScope?.until || dateScope.until }),
          time_increment: "1",
          limit: "5000",
          fields: [
            "campaign_id",
            "date_start",
            "spend",
            "impressions",
            "inline_link_clicks",
            "actions",
            "action_values"
          ].join(",")
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_incremental_agg", [accountId, dateScope.since, dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "incremental_insights_aggregated",
        fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
          level: "campaign",
          time_range: JSON.stringify({ since: dateScope.since, until: dateScope.until }),
          action_attribution_windows: JSON.stringify(["incrementality"]),
          limit: "500",
          fields: [
            "campaign_id",
            "campaign_name",
            "spend",
            "impressions",
            "reach",
            "frequency",
            "cpm",
            "inline_link_clicks",
            "inline_link_click_ctr",
            "cpc",
            "actions",
            "action_values",
            "purchase_roas",
            "website_purchase_roas"
          ].join(",")
        })
      }).catch(() => ({ data: [], pageCount: 0, unavailable: true })),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_incremental_daily_cmp", [accountId, comparisonDateScope?.since || dateScope.since, comparisonDateScope?.until || dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "incremental_insights_daily",
        fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
          level: "campaign",
          time_range: JSON.stringify({ since: comparisonDateScope?.since || dateScope.since, until: comparisonDateScope?.until || dateScope.until }),
          time_increment: "1",
          action_attribution_windows: JSON.stringify(["incrementality"]),
          limit: "5000",
          fields: [
            "campaign_id",
            "date_start",
            "spend",
            "impressions",
            "inline_link_clicks",
            "actions",
            "action_values"
          ].join(",")
        })
      }).catch(() => ({ data: [], pageCount: 0, unavailable: true }))
    ]);

    return {
      aggregatedInsightsResponse,
      dailyInsightsResponse,
      aggregatedIncrementalInsightsResponse,
      dailyIncrementalInsightsResponse
    };
  }

  async function fetchAwarenessAdSetInsightsCollections({
    accountId,
    accessToken,
    dateScope,
    comparisonDateScope,
    insightsCacheMaxAgeMs,
    timings
  }) {
    const [aggregatedAdSetInsightsResponse, dailyAdSetInsightsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_adset_agg", [accountId, dateScope.since, dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "adset_insights_aggregated",
        fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
          level: "adset",
          time_range: JSON.stringify({ since: dateScope.since, until: dateScope.until }),
          limit: "500",
          fields: [
            "campaign_id",
            "adset_id",
            "adset_name",
            "spend",
            "impressions",
            "reach",
            "frequency",
            "cpm",
            "inline_link_clicks",
            "inline_link_click_ctr",
            "actions",
            "action_values",
            "purchase_roas",
            "website_purchase_roas"
          ].join(",")
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_adset_daily_cmp", [accountId, comparisonDateScope?.since || dateScope.since, comparisonDateScope?.until || dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        timingLabel: "adset_insights_daily",
        fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
          level: "adset",
          time_range: JSON.stringify({ since: comparisonDateScope?.since || dateScope.since, until: comparisonDateScope?.until || dateScope.until }),
          time_increment: "1",
          limit: "5000",
          fields: [
            "campaign_id",
            "adset_id",
            "date_start",
            "spend",
            "impressions",
            "inline_link_clicks",
            "actions",
            "action_values"
          ].join(",")
        })
      })
    ]);

    return {
      aggregatedAdSetInsightsResponse,
      dailyAdSetInsightsResponse
    };
  }

  return {
    fetchAwarenessAdSetInsightsCollections,
    fetchCampaignInsightsCollections,
    fetchCatalogCollections,
    fetchDashboardMetadataCollections
  };
}

module.exports = {
  createMetaSnapshotFetchers
};
