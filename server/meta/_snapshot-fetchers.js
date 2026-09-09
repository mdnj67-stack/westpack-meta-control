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
    timings,
    bypassCache = false
  }) {
    const [campaignResponse, adsResponse, adSetsResponse, customConversionsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("campaigns", [accountId, "dashboard"]),
        maxAgeMs: metadataCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
        timingLabel: "campaigns_metadata",
        fetcher: () => metaGetAll(`/${accountId}/campaigns`, accessToken, {
          fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
          limit: "100"
        })
      }),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("ads", [accountId, "dashboard"]),
        maxAgeMs: adsCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
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
        bypassCache,
        timingLabel: "adsets_metadata",
        fetcher: () => metaGetAll(`/${accountId}/adsets`, accessToken, {
          fields: "id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,attribution_spec,attribution_setting,campaign{id,name,status}",
          limit: "500"
        })
      }),
      // Custom conversions carry the New_customer / Existing_customer definitions. They
      // are resolved by name at runtime rather than by hardcoded id, so this list has to
      // come along with the metadata.
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("customconversions", [accountId, "dashboard"]),
        maxAgeMs: metadataCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
        timingLabel: "custom_conversions_metadata",
        fetcher: () => metaGetAll(`/${accountId}/customconversions`, accessToken, {
          fields: "id,name,custom_event_type,is_archived",
          limit: "100"
        })
      })
    ]);

    return {
      campaignResponse,
      adsResponse,
      adSetsResponse,
      customConversionsResponse
    };
  }

  async function fetchCampaignInsightsCollections({
    accountId,
    accessToken,
    dateScope,
    comparisonDateScope,
    insightsCacheMaxAgeMs,
    incrementalInsightsCacheMaxAgeMs = insightsCacheMaxAgeMs,
    timings,
    bypassCache = false
  }) {
    const [aggregatedInsightsResponse, dailyInsightsResponse, aggregatedIncrementalInsightsResponse, dailyIncrementalInsightsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_campaign_agg", [accountId, dateScope.since, dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
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
        bypassCache,
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
            "reach",
            "inline_link_clicks",
            "actions",
            "action_values"
          ].join(",")
        })
        // Optional: this is the day-by-day series behind the sparklines and the
        // previous-period overlays. Losing it costs those, not the dashboard's numbers.
        // It is also one of the most CPU-expensive queries Meta bills us for, so on a
        // throttled account it is the first thing to fail - and it used to take every
        // panel down with it.
      }).catch(() => ({ data: [], pageCount: 0, unavailable: true })),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_incremental_agg", [accountId, dateScope.since, dateScope.until]),
        maxAgeMs: incrementalInsightsCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
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
        maxAgeMs: incrementalInsightsCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
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
    timings,
    bypassCache = false
  }) {
    const [aggregatedAdSetInsightsResponse, dailyAdSetInsightsResponse] = await Promise.all([
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_adset_agg", [accountId, dateScope.since, dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
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
        // Optional: awareness campaigns prefer ad-set level insights where available.
        // Without it they fall back to campaign-level figures, which the pipeline already
        // handles and reports through awarenessUsingAdSetInsights.
      }).catch(() => ({ data: [], pageCount: 0, unavailable: true })),
      getCachedMetaCollection({
        cacheKey: buildMetaResourceCacheKey("insights_adset_daily_cmp", [accountId, comparisonDateScope?.since || dateScope.since, comparisonDateScope?.until || dateScope.until]),
        maxAgeMs: insightsCacheMaxAgeMs,
        timingStore: timings,
        bypassCache,
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
            "reach",
            "inline_link_clicks",
            "actions",
            "action_values"
          ].join(",")
        })
        // Optional for the same reason as the aggregated ad-set query above.
      }).catch(() => ({ data: [], pageCount: 0, unavailable: true }))
    ]);

    return {
      aggregatedAdSetInsightsResponse,
      dailyAdSetInsightsResponse
    };
  }

  // Account-level daily rows spanning the first of the previous month to today, so the
  // month-to-date new-customer comparison can be computed without a second round trip per
  // window. One request, ~62 rows, and it also yields a daily series for a sparkline.
  async function fetchCustomerAcquisitionTrend({
    accountId,
    accessToken,
    trendWindow,
    insightsCacheMaxAgeMs,
    timings,
    bypassCache = false
  }) {
    if (!trendWindow?.since || !trendWindow?.until) {
      return { data: [], pageCount: 0 };
    }

    return getCachedMetaCollection({
      cacheKey: buildMetaResourceCacheKey("insights_acquisition_trend", [accountId, trendWindow.since, trendWindow.until]),
      maxAgeMs: insightsCacheMaxAgeMs,
      timingStore: timings,
      bypassCache,
      timingLabel: "acquisition_trend_insights",
      fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, {
        level: "account",
        time_range: JSON.stringify({ since: trendWindow.since, until: trendWindow.until }),
        time_increment: "1",
        limit: "200",
        fields: "date_start,spend,actions,action_values"
      })
    });
  }

  // Reach is a count of distinct people, so it cannot be added up. Summing the reach of
  // several campaigns counts everyone who saw more than one of them once per campaign,
  // which on this account inflated the headline figure by millions. Meta deduplicates
  // reach only within the entity you ask for, so the honest number has to come from a
  // query at account level - optionally narrowed to a set of campaigns, which is exactly
  // what Ads Manager shows when you tick those campaigns.
  async function fetchDeduplicatedReach({
    accountId,
    accessToken,
    dateScope,
    campaignIds = null,
    scopeKey = "account",
    insightsCacheMaxAgeMs,
    timings,
    bypassCache = false
  }) {
    if (!dateScope?.since || !dateScope?.until) {
      return null;
    }
    if (Array.isArray(campaignIds) && !campaignIds.length) {
      return null;
    }

    const params = {
      level: "account",
      time_range: JSON.stringify({ since: dateScope.since, until: dateScope.until }),
      limit: "1",
      fields: "reach,impressions,frequency,spend"
    };
    if (Array.isArray(campaignIds) && campaignIds.length) {
      params.filtering = JSON.stringify([
        { field: "campaign.id", operator: "IN", value: campaignIds }
      ]);
    }

    const response = await getCachedMetaCollection({
      cacheKey: buildMetaResourceCacheKey("insights_reach_" + scopeKey, [
        accountId,
        dateScope.since,
        dateScope.until,
        Array.isArray(campaignIds) ? campaignIds.slice().sort().join("_") : "all"
      ]),
      maxAgeMs: insightsCacheMaxAgeMs,
      timingStore: timings,
      bypassCache,
      timingLabel: "reach_" + scopeKey,
      fetcher: () => metaGetAll(`/${accountId}/insights`, accessToken, params)
      // Optional: without it the dashboard reports that deduplicated reach is
      // unavailable rather than falling back to a sum it knows is wrong.
    }).catch(() => null);

    const row = response?.data?.[0];
    if (!row) {
      return null;
    }

    return {
      reach: Number(row.reach || 0),
      impressions: Number(row.impressions || 0),
      frequency: Number(row.frequency || 0),
      spend: Number(row.spend || 0),
      since: dateScope.since,
      until: dateScope.until
    };
  }

  return {
    fetchAwarenessAdSetInsightsCollections,
    fetchCampaignInsightsCollections,
    fetchCustomerAcquisitionTrend,
    fetchDeduplicatedReach,
    fetchCatalogCollections,
    fetchDashboardMetadataCollections
  };
}

module.exports = {
  createMetaSnapshotFetchers
};
