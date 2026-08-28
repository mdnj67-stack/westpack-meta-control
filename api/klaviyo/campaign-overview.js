const { getConfig } = require("../../server/lib/config");
const { buildKlaviyoCurrencyContext, normalizeMarketRevenueRow } = require("../../server/lib/klaviyo-currency");
const { requireAuth } = require("../../server/lib/auth");
const { fetchWithTimeout, sendJson } = require("../../server/lib/http");
const { recordArtifactLearning } = require("../../server/campaign/campaign-learning-service");
const fs = require("fs");
const path = require("path");

const KLAVIYO_SMALL_LIST_EXEMPT_MARKETS = new Set(["CZ", "SK", "HU"]);
const KLAVIYO_SMALL_LIST_EXEMPT_REASON = "Lists are intentionally too small for campaign sends.";
const KLAVIYO_REQUEST_TIMEOUT_MS = 15000;

async function recordKlaviyoPerformanceLearning(campaignGroups = [], timeframeDays = 0) {
  const eligible = (Array.isArray(campaignGroups) ? campaignGroups : [])
    .filter((group) => Number(group?.sentTotal || 0) >= 500)
    .map((group) => ({
      campaignName: String(group.campaignName || "Untitled campaign"),
      lastSent: String(group.lastSent || ""),
      sent: Number(group.sentTotal || 0),
      openRate: Number(group.openRateWeighted || 0),
      clickRate: Number(group.clickRateWeighted || 0),
      unsubscribeRate: Number(group.unsubRateWeighted || 0),
      revenue: Number(group.revenueTotal || 0),
      revenuePerRecipient: Number((Number(group.revenueTotal || 0) / Math.max(1, Number(group.sentTotal || 0))).toFixed(4))
    }));
  if (!eligible.length) return null;
  const ranked = [...eligible].sort((left, right) =>
    (right.revenuePerRecipient - left.revenuePerRecipient)
    || (right.clickRate - left.clickRate)
    || (left.unsubscribeRate - right.unsubscribeRate));
  const selected = [...ranked.slice(0, 5), ...ranked.slice(-2)]
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.campaignName === item.campaignName) === index)
    .map((item) => ({ ...item, cohortPosition: ranked.indexOf(item) < 5 ? "strong" : "weak" }));
  const performanceFingerprint = selected.map((item) => [item.campaignName, item.lastSent, item.sent, item.clickRate, item.revenue].join(":" )).join("|");
  return recordArtifactLearning({
    type: "performance_snapshot",
    channel: "email",
    metadata: {
      campaignName: `Klaviyo ${timeframeDays || "current"}-day comparable cohort`,
      destination: "Klaviyo performance",
      performanceFingerprint,
      performance: { timeframeDays, minimumRecipients: 500, rankingBasis: "revenue per recipient, then click rate and unsubscribe rate", campaigns: selected }
    }
  });
}

function parseMarkets(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error("Invalid KLAVIYO_MARKETS_JSON.");
  }
}

function loadBundledSnapshot() {
  try {
    const snapshotPath = path.join(process.cwd(), "data", "klaviyo-live.json");
    if (!fs.existsSync(snapshotPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    if (!Array.isArray(parsed?.campaignGroups)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function normalizeRevenueGroups(sourceGroups, buildSummary) {
  return (Array.isArray(sourceGroups) ? sourceGroups : []).map((group) => {
    const markets = (Array.isArray(group?.markets) ? group.markets : [])
      .map((market) => ({ ...market }))
      .sort((a, b) => String(a.country || "").localeCompare(String(b.country || "")));
    const sentTotal = markets.reduce((sum, market) => sum + (market.sent || 0), 0);
    const revenueTotal = markets.reduce((sum, market) => sum + (market.revenue || 0), 0);
    const result = {
      ...group,
      markets,
      sentTotal,
      revenueTotal: Number(revenueTotal.toFixed(2)),
      openRateWeighted: Number(buildWeightedRate(markets, "openRate").toFixed(2)),
      clickRateWeighted: Number(buildWeightedRate(markets, "clickRate").toFixed(2)),
      unsubRateWeighted: Number(buildWeightedRate(markets, "unsubRate").toFixed(2)),
      activeMarkets: markets.length
    };
    result.aiSummary = buildSummary(result);
    return result;
  });
}

function normalizeSnapshotRevenue(snapshot, currencyContext, marketCodes = []) {
  if (!snapshot || (!Array.isArray(snapshot.campaignGroups) && !Array.isArray(snapshot.flowGroups))) {
    return snapshot;
  }

  const normalizedMarketCodes = (Array.isArray(marketCodes) && marketCodes.length
    ? marketCodes
    : Array.isArray(snapshot.markets) ? snapshot.markets : [])
    .map((market) => String(market || "").trim())
    .filter(Boolean);
  const expectedMarketCodes = getCoverageExpectedMarkets(normalizedMarketCodes);

  const campaignGroups = normalizeRevenueGroups(
    (snapshot.campaignGroups || []).map((group) => ({
      ...group,
      missingMarkets: expectedMarketCodes.filter((country) => !(group.markets || []).some((market) => market.country === country)),
      markets: (group.markets || []).map((market) => normalizeMarketRevenueRow(market, market.country, currencyContext))
    })),
    buildGroupSummary
  ).sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));

  const flowGroups = normalizeRevenueGroups(
    (snapshot.flowGroups || []).map((group) => ({
      ...group,
      missingMarkets: expectedMarketCodes.filter((country) => !(group.markets || []).some((market) => market.country === country)),
      markets: (group.markets || []).map((market) => normalizeMarketRevenueRow(market, market.country, currencyContext))
    })),
    buildFlowSummary
  ).sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));

  const subscribers = snapshot.subscribers || { total: 0, markets: [] };

  return {
    ...snapshot,
    markets: normalizedMarketCodes,
    currency: {
      baseCurrency: currencyContext.baseCurrency,
      fxSource: currencyContext.fxSource,
      fxReferenceDate: currencyContext.fxReferenceDate,
      fxRatesToDkk: currencyContext.fxRatesToDkk
    },
    campaignGroups,
    flowGroups,
    overview: buildOverview(campaignGroups, flowGroups, subscribers, normalizedMarketCodes),
    insightCards: buildInsightCards(campaignGroups, flowGroups, subscribers, normalizedMarketCodes)
  };
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function daysAgo(days) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function normalizeKlaviyoMarketCode(country) {
  return String(country || "").trim().toUpperCase();
}

function isKlaviyoCoverageExemptMarket(country) {
  return KLAVIYO_SMALL_LIST_EXEMPT_MARKETS.has(normalizeKlaviyoMarketCode(country));
}

function getCoverageExpectedMarkets(marketCodes = []) {
  return (Array.isArray(marketCodes) ? marketCodes : []).filter((country) => !isKlaviyoCoverageExemptMarket(country));
}

function buildHeaders(privateKey, revision, json = false) {
  const headers = {
    Authorization: `Klaviyo-API-Key ${privateKey}`,
    Accept: "application/json",
    revision
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFlowFamilyName(name, marketCodes = []) {
  let normalized = String(name || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  const variantPatterns = [
    /\s*[-|/:]?\s*\(clone\)?\s*$/i,
    /\s*[-|/:]?\s*clone\s*$/i,
    /\s*[-|/:]?\s*\(copy\)?\s*$/i,
    /\s*[-|/:]?\s*copy\s*$/i
  ];

  let variantChanged = true;
  while (variantChanged) {
    variantChanged = false;
    for (const pattern of variantPatterns) {
      const next = normalized.replace(pattern, "").trim();
      if (next !== normalized) {
        normalized = next;
        variantChanged = true;
      }
    }
  }

  const codes = marketCodes
    .map((code) => escapeRegex(String(code || "").trim()))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .join("|");

  if (!codes) return normalized;

  const suffixPatterns = [
    new RegExp(`\\s*[-|/:]\\s*(?:${codes})\\s*$`, "i"),
    new RegExp(`\\s*\\((?:${codes})\\)\\s*$`, "i"),
    new RegExp(`\\s+(?:${codes})\\s*$`, "i")
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of suffixPatterns) {
      const next = normalized.replace(pattern, "").trim();
      if (next !== normalized) {
        normalized = next;
        changed = true;
      }
    }
  }

  return normalized || String(name || "").trim();
}

function isCampaignLikeFlowName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  return /^w\d{1,2}\b/.test(normalized)
    || normalized.includes("kampagneflow")
    || normalized.includes("day of the forest")
    || normalized.includes("aprilsnar")
    || normalized.includes("alt til forsendelse")
    || normalized.includes("forårsprodukter");
}

async function klaviyoRequest(url, headers, method = "GET", body) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      },
      KLAVIYO_REQUEST_TIMEOUT_MS
    );
    const payload = await response.json().catch(() => ({}));

    if (response.ok && !payload?.errors?.length) {
      return payload;
    }

    const message = payload?.errors?.[0]?.detail || payload?.message || `Klaviyo request failed (${response.status}).`;
    if (message.toLowerCase().includes("throttled") && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Klaviyo request failed.");
}

async function getAllPages(url, headers) {
  const items = [];
  let next = url;

  while (next) {
    const payload = await klaviyoRequest(next, headers);
    if (Array.isArray(payload.data)) {
      items.push(...payload.data);
    }
    next = payload?.links?.next || "";
  }

  return items;
}

async function getRecentCampaigns(headers, from) {
  const encodedFrom = encodeURIComponent(from.toISOString().slice(0, 19));
  const url = `https://a.klaviyo.com/api/campaigns/?filter=and(equals(messages.channel,'email'),equals(status,'Sent'),greater-than(updated_at,${encodedFrom}))&fields[campaign]=name,status,send_time,created_at,updated_at&sort=-updated_at`;
  const campaigns = await getAllPages(url, headers);
  return campaigns.filter((campaign) => {
    const sendTime = campaign?.attributes?.send_time;
    if (!sendTime) return false;
    const sentAt = new Date(sendTime);
    return Number.isFinite(sentAt.getTime()) && sentAt > from;
  });
}

async function getPlacedOrderMetricId(headers) {
  const metrics = await getAllPages("https://a.klaviyo.com/api/metrics/", headers);
  const matches = metrics
    .filter((metric) => metric?.attributes?.name === "Placed Order")
    .sort((left, right) => {
      const leftIntegration = String(left?.attributes?.integration?.key || "").toLowerCase();
      const rightIntegration = String(right?.attributes?.integration?.key || "").toLowerCase();
      const leftUpdated = new Date(left?.attributes?.updated || left?.attributes?.created || 0).getTime();
      const rightUpdated = new Date(right?.attributes?.updated || right?.attributes?.created || 0).getTime();
      const leftPriority = leftIntegration.includes("magento") ? 1 : 0;
      const rightPriority = rightIntegration.includes("magento") ? 1 : 0;

      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      return rightUpdated - leftUpdated;
    });
  const match = matches[0];
  return match?.id || "";
}

async function detectSubscriberList(headers, configuredListId) {
  const lists = await getAllPages("https://a.klaviyo.com/api/lists/", headers);
  if (configuredListId) {
    const exact = lists.find((list) => list?.id === configuredListId);
    if (exact) {
      return { id: exact.id, name: exact.attributes?.name || exact.id };
    }
  }

  const scored = lists
    .map((list) => {
      const name = String(list?.attributes?.name || "");
      const lower = name.toLowerCase();
      let score = 0;
      if (lower.includes("nyhedsbrev")) score += 5;
      if (lower.includes("newsletter")) score += 4;
      if (lower.includes("westpack")) score += 2;
      if (lower.includes("test")) score -= 4;
      return { id: list?.id, name, score };
    })
    .filter((item) => item.id && item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return scored[0] || null;
}

async function countListProfiles(headers, listId) {
  if (!listId) return 0;
  let total = 0;
  let next = `https://a.klaviyo.com/api/lists/${listId}/profiles/?page%5Bsize%5D=100`;
  while (next) {
    const payload = await klaviyoRequest(next, headers);
    total += Array.isArray(payload.data) ? payload.data.length : 0;
    next = payload?.links?.next || "";
  }
  return total;
}

function getReportValue(report, key) {
  if (!report) return null;
  if (report[key] != null) return report[key];
  if (report.attributes?.[key] != null) return report.attributes[key];
  if (report.statistics?.[key] != null) return report.statistics[key];
  return null;
}

async function queryCampaignValues(headers, timeframe, conversionMetricId) {
  const buildBody = (includeRevenue) => ({
    data: {
      type: "campaign-values-report",
      attributes: {
        timeframe,
        conversion_metric_id: conversionMetricId || undefined,
        statistics: includeRevenue
          ? ["recipients", "open_rate", "click_rate", "unsubscribe_rate", "conversion_value"]
          : ["recipients", "open_rate", "click_rate", "unsubscribe_rate"]
      }
    }
  });

  try {
    const payload = await klaviyoRequest(
      "https://a.klaviyo.com/api/campaign-values-reports/",
      headers,
      "POST",
      buildBody(true)
    );
    return payload.data?.attributes?.results || [];
  } catch (error) {
    if (!String(error.message || "").includes("does not support querying for values data")) {
      throw error;
    }

    const payload = await klaviyoRequest(
      "https://a.klaviyo.com/api/campaign-values-reports/",
      headers,
      "POST",
      buildBody(false)
    );
    return (payload.data?.attributes?.results || []).map((item) => ({
      ...item,
      statistics: {
        ...(item.statistics || {}),
        conversion_value: 0
      }
    }));
  }
}

async function queryFlowValues(headers, timeframe, conversionMetricId) {
  const buildBody = (includeRevenue) => ({
    data: {
      type: "flow-values-report",
      attributes: {
        timeframe,
        conversion_metric_id: conversionMetricId || undefined,
        statistics: includeRevenue
          ? ["recipients", "open_rate", "click_rate", "unsubscribe_rate", "conversion_value"]
          : ["recipients", "open_rate", "click_rate", "unsubscribe_rate"]
      }
    }
  });

  try {
    const payload = await klaviyoRequest(
      "https://a.klaviyo.com/api/flow-values-reports/",
      headers,
      "POST",
      buildBody(true)
    );
    return payload.data?.attributes?.results || [];
  } catch (error) {
    if (!String(error.message || "").includes("does not support querying for values data")) {
      throw error;
    }

    const payload = await klaviyoRequest(
      "https://a.klaviyo.com/api/flow-values-reports/",
      headers,
      "POST",
      buildBody(false)
    );
    return (payload.data?.attributes?.results || []).map((item) => ({
      ...item,
      statistics: {
        ...(item.statistics || {}),
        conversion_value: 0
      }
    }));
  }
}

async function mapWithConcurrencySettled(items, limit, worker) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      try {
        const value = await worker(items[currentIndex], currentIndex);
        results[currentIndex] = { status: "fulfilled", value };
      } catch (error) {
        results[currentIndex] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, () => runWorker()));
  return results;
}

async function resolveSubscriberCount(headers, subscriberList, fallbackSubscriber) {
  if (!subscriberList?.id) {
    return {
      count: Number.isFinite(Number(fallbackSubscriber)) ? Number(fallbackSubscriber) : 0,
      countSource: Number.isFinite(Number(fallbackSubscriber)) ? "snapshot_fallback" : "missing_list"
    };
  }

  try {
    const count = await countListProfiles(headers, subscriberList.id);
    return {
      count,
      countSource: "live"
    };
  } catch (error) {
    if (Number.isFinite(Number(fallbackSubscriber))) {
      return {
        count: Number(fallbackSubscriber),
        countSource: "snapshot_fallback"
      };
    }
    throw error;
  }
}

async function fetchMarketOverview(market, { config, timeframe, from, marketCodes, snapshotSubscriberCounts }) {
  const country = String(market.country || "").trim();
  const privateKey = String(market.privateKey || "").trim();
  if (!country || !privateKey) return null;

  const headers = buildHeaders(privateKey, config.klaviyoRevision);
  const jsonHeaders = buildHeaders(privateKey, config.klaviyoRevision, true);
  const currencyContext = buildKlaviyoCurrencyContext(config);
  const [conversionMetricId, subscriberList, campaigns, flows] = await Promise.all([
    getPlacedOrderMetricId(headers),
    detectSubscriberList(headers, market.listId),
    getRecentCampaigns(headers, from),
    getAllPages(
      "https://a.klaviyo.com/api/flows/?fields%5Bflow%5D=name,status,trigger_type,created,updated&sort=-updated",
      headers
    )
  ]);
  const fallbackSubscriber = snapshotSubscriberCounts.get(country);
  const subscriberCountPromise = resolveSubscriberCount(headers, subscriberList, fallbackSubscriber);

  const [subscriberInfo, reports, flowReports] = await Promise.all([
    subscriberCountPromise,
    queryCampaignValues(jsonHeaders, timeframe, conversionMetricId),
    queryFlowValues(jsonHeaders, timeframe, conversionMetricId)
  ]);

  const campaignsById = new Map();
  for (const campaign of campaigns) {
    const attributes = campaign?.attributes || {};
    const campaignName = String(attributes.name || "").trim();
    const sendTime = isoDate(attributes.send_time || attributes.updated_at || attributes.created_at);
    if (!campaignName || !sendTime) continue;
    if (new Date(sendTime) < from) continue;
    campaignsById.set(String(campaign.id), {
      campaignName,
      sendTime
    });
  }

  const flowsById = new Map();
  for (const flow of flows) {
    const attributes = flow?.attributes || {};
    const flowName = String(attributes.name || "").trim();
    if (!flowName) continue;
    flowsById.set(String(flow.id), {
      flowName,
      status: String(attributes.status || ""),
      triggerType: String(attributes.trigger_type || ""),
      updatedAt: isoDate(attributes.updated || attributes.created)
    });
  }

  const campaignGroups = [];
  for (const report of reports) {
    const campaignId = String(report?.groupings?.campaign_id || "");
    const campaignInfo = campaignsById.get(campaignId);
    if (!campaignInfo) continue;

    campaignGroups.push({
      campaignName: campaignInfo.campaignName,
      lastSent: campaignInfo.sendTime,
      marketRow: normalizeMarketRevenueRow({
        country,
        campaignId,
        campaignName: campaignInfo.campaignName,
        sent: Math.round(Number(getReportValue(report, "recipients") || 0)),
        openRate: Number((Number(getReportValue(report, "open_rate") || 0) * 100).toFixed(2)),
        clickRate: Number((Number(getReportValue(report, "click_rate") || 0) * 100).toFixed(2)),
        revenue: Number(Number(getReportValue(report, "conversion_value") || 0).toFixed(2)),
        unsubRate: Number((Number(getReportValue(report, "unsubscribe_rate") || 0) * 100).toFixed(2)),
        sendTime: campaignInfo.sendTime,
        status: "sent"
      }, country, currencyContext)
    });
  }

  const flowStatsById = buildFlowStatsById(flowReports);
  const flowGroups = [];
  for (const [flowId, flowInfo] of flowsById.entries()) {
    if (!flowInfo?.flowName) continue;
    if (String(flowInfo.status || "").toLowerCase() !== "live") continue;
    if (isCampaignLikeFlowName(flowInfo.flowName)) continue;
    const familyKey = normalizeFlowFamilyName(flowInfo.flowName, marketCodes) || flowInfo.flowName;
    const stats = flowStatsById.get(flowId);

    flowGroups.push({
      familyKey,
      flowStatus: flowInfo.status,
      triggerType: flowInfo.triggerType,
      alias: flowInfo.flowName,
      marketRow: normalizeMarketRevenueRow({
        country,
        flowId,
        flowName: flowInfo.flowName,
        sent: stats?.sent || 0,
        openRate: stats?.openRate || 0,
        clickRate: stats?.clickRate || 0,
        revenue: stats?.revenueOriginal || 0,
        unsubRate: stats?.unsubRate || 0,
        sendTime: flowInfo.updatedAt || new Date().toISOString(),
        status: stats?.sent ? "sent" : "live_no_send"
      }, country, currencyContext)
    });
  }

  return {
    country,
    subscriber: {
      country,
      listId: subscriberList?.id || "",
      listName: subscriberList?.name || "",
      count: subscriberInfo.count,
      countSource: subscriberInfo.countSource
    },
    campaignGroups,
    flowGroups
  };
}

function buildGroupSummary(group) {
  const markets = Array.isArray(group.markets) ? group.markets : [];
  if (!markets.length) {
    return "No market data available for this campaign family.";
  }

  const topRevenue = [...markets].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
  const worstOpen = [...markets].sort((a, b) => (a.openRate || 0) - (b.openRate || 0))[0];

  if (group.missingMarkets?.length) {
    return `Missing markets: ${group.missingMarkets.join(", ")}. Top revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
  }

  return `All expected markets sent this campaign. ${Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS).join(", ")} are excluded because ${KLAVIYO_SMALL_LIST_EXEMPT_REASON.toLowerCase()}. Top revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
}

function buildFlowSummary(group) {
  const markets = Array.isArray(group.markets) ? group.markets : [];
  if (!markets.length) {
    return "No market data available for this flow family.";
  }

  const topRevenue = [...markets].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
  const worstOpen = [...markets].sort((a, b) => (a.openRate || 0) - (b.openRate || 0))[0];

  if (group.missingMarkets?.length) {
    return `Missing markets: ${group.missingMarkets.join(", ")}. Top flow revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
  }

  return `All expected markets are active in this flow. ${Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS).join(", ")} are excluded because ${KLAVIYO_SMALL_LIST_EXEMPT_REASON.toLowerCase()}. Top revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
}

function buildWeightedRate(markets, key) {
  const sentTotal = markets.reduce((sum, market) => sum + (market.sent || 0), 0);
  if (!sentTotal) return 0;
  return markets.reduce((sum, market) => sum + ((market[key] || 0) * (market.sent || 0)), 0) / sentTotal;
}

function mergeMarketRows(existing, incoming) {
  if (!existing) return { ...incoming };

  const sent = (existing.sent || 0) + (incoming.sent || 0);
  const weighted = (key) => {
    if (!sent) return 0;
    return Number(((((existing[key] || 0) * (existing.sent || 0)) + ((incoming[key] || 0) * (incoming.sent || 0))) / sent).toFixed(2));
  };

  return {
    ...existing,
    sent,
    revenueOriginal: Number(((existing.revenueOriginal || 0) + (incoming.revenueOriginal || 0)).toFixed(2)),
    revenue: Number(((existing.revenue || 0) + (incoming.revenue || 0)).toFixed(2)),
    sourceCurrency: incoming.sourceCurrency || existing.sourceCurrency || "",
    revenueCurrency: incoming.revenueCurrency || existing.revenueCurrency || "DKK",
    exchangeRateToDkk: Number(incoming.exchangeRateToDkk || existing.exchangeRateToDkk || 1),
    openRate: weighted("openRate"),
    clickRate: weighted("clickRate"),
    unsubRate: weighted("unsubRate"),
    sendTime: new Date(existing.sendTime) > new Date(incoming.sendTime) ? existing.sendTime : incoming.sendTime,
    status: "sent"
  };
}

function buildFlowStatsById(flowReports) {
  const statsByFlowId = new Map();

  for (const report of flowReports) {
    const flowId = String(report?.groupings?.flow_id || "");
    if (!flowId) continue;

    const incomingSent = Math.round(Number(getReportValue(report, "recipients") || 0));
    const incomingRevenueOriginal = Number(Number(getReportValue(report, "conversion_value") || 0).toFixed(2));
    const incomingOpenRate = Number((Number(getReportValue(report, "open_rate") || 0) * 100).toFixed(2));
    const incomingClickRate = Number((Number(getReportValue(report, "click_rate") || 0) * 100).toFixed(2));
    const incomingUnsubRate = Number((Number(getReportValue(report, "unsubscribe_rate") || 0) * 100).toFixed(2));

    const existing = statsByFlowId.get(flowId);
    if (!existing) {
      statsByFlowId.set(flowId, {
        sent: incomingSent,
        revenueOriginal: incomingRevenueOriginal,
        openRate: incomingOpenRate,
        clickRate: incomingClickRate,
        unsubRate: incomingUnsubRate
      });
      continue;
    }

    const sent = (existing.sent || 0) + incomingSent;
    const weighted = (currentRate, currentSent, nextRate, nextSent) => {
      if (!sent) return 0;
      return Number((((currentRate * currentSent) + (nextRate * nextSent)) / sent).toFixed(2));
    };

    statsByFlowId.set(flowId, {
      sent,
      revenueOriginal: Number(((existing.revenueOriginal || 0) + incomingRevenueOriginal).toFixed(2)),
      openRate: weighted(existing.openRate || 0, existing.sent || 0, incomingOpenRate, incomingSent),
      clickRate: weighted(existing.clickRate || 0, existing.sent || 0, incomingClickRate, incomingSent),
      unsubRate: weighted(existing.unsubRate || 0, existing.sent || 0, incomingUnsubRate, incomingSent)
    });
  }

  return statsByFlowId;
}

function buildOverview(campaignGroups, flowGroups, subscribers, marketCodes) {
  const expectedMarkets = getCoverageExpectedMarkets(marketCodes);
  const campaignSentTotal = campaignGroups.reduce((sum, group) => sum + (group.sentTotal || 0), 0);
  const campaignRevenueTotal = Number(campaignGroups.reduce((sum, group) => sum + (group.revenueTotal || 0), 0).toFixed(2));
  const campaignOpenRate = campaignSentTotal ? Number((campaignGroups.reduce((sum, group) => sum + ((group.openRateWeighted || 0) * (group.sentTotal || 0)), 0) / campaignSentTotal).toFixed(2)) : 0;
  const campaignClickRate = campaignSentTotal ? Number((campaignGroups.reduce((sum, group) => sum + ((group.clickRateWeighted || 0) * (group.sentTotal || 0)), 0) / campaignSentTotal).toFixed(2)) : 0;
  const campaignUnsubRate = campaignSentTotal ? Number((campaignGroups.reduce((sum, group) => sum + ((group.unsubRateWeighted || 0) * (group.sentTotal || 0)), 0) / campaignSentTotal).toFixed(2)) : 0;
  const fullCoverageCampaigns = campaignGroups.filter((group) => !group.missingMarkets?.length).length;
  const flowSentTotal = flowGroups.reduce((sum, group) => sum + (group.sentTotal || 0), 0);
  const flowRevenueTotal = Number(flowGroups.reduce((sum, group) => sum + (group.revenueTotal || 0), 0).toFixed(2));
  const flowOpenRate = flowSentTotal ? Number((flowGroups.reduce((sum, group) => sum + ((group.openRateWeighted || 0) * (group.sentTotal || 0)), 0) / flowSentTotal).toFixed(2)) : 0;
  const flowClickRate = flowSentTotal ? Number((flowGroups.reduce((sum, group) => sum + ((group.clickRateWeighted || 0) * (group.sentTotal || 0)), 0) / flowSentTotal).toFixed(2)) : 0;
  const flowUnsubRate = flowSentTotal ? Number((flowGroups.reduce((sum, group) => sum + ((group.unsubRateWeighted || 0) * (group.sentTotal || 0)), 0) / flowSentTotal).toFixed(2)) : 0;
  const fullCoverageFlows = flowGroups.filter((group) => !group.missingMarkets?.length).length;
  const subscriberMarkets = Array.isArray(subscribers?.markets) ? subscribers.markets : [];
  const totalSubscribers = subscriberMarkets.reduce((sum, item) => sum + (item.count || 0), 0);
  const sortedBySize = [...subscriberMarkets].sort((a, b) => (b.count || 0) - (a.count || 0));
  const sortedCounts = sortedBySize.map((item) => item.count || 0).sort((a, b) => a - b);
  const middle = Math.floor(sortedCounts.length / 2);
  const medianSubscribers = !sortedCounts.length
    ? 0
    : sortedCounts.length % 2
      ? sortedCounts[middle]
      : Math.round((sortedCounts[middle - 1] + sortedCounts[middle]) / 2);
  const averageSubscribers = subscriberMarkets.length ? Math.round(totalSubscribers / subscriberMarkets.length) : 0;
  const topMarket = sortedBySize[0];

  return {
    sentTotal: campaignSentTotal,
    revenueTotal: campaignRevenueTotal,
    weightedOpenRate: campaignOpenRate,
    weightedClickRate: campaignClickRate,
    weightedUnsubRate: campaignUnsubRate,
    campaignFamilies: campaignGroups.length,
    fullCoverageCampaigns,
    missingCoverageCampaigns: campaignGroups.length - fullCoverageCampaigns,
    flowSentTotal,
    flowRevenueTotal,
    flowOpenRate,
    flowClickRate,
    flowUnsubRate,
    flowFamilies: flowGroups.length,
    fullCoverageFlows,
    missingCoverageFlows: flowGroups.length - fullCoverageFlows,
    totalMarkets: expectedMarkets.length,
    expectedMarkets,
    exemptMarkets: Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS),
    subscribers: {
      total: totalSubscribers,
      averagePerMarket: averageSubscribers,
      medianPerMarket: medianSubscribers,
      topMarket: topMarket
        ? {
          country: topMarket.country,
          count: topMarket.count || 0,
          share: totalSubscribers ? Number((((topMarket.count || 0) / totalSubscribers) * 100).toFixed(2)) : 0
        }
        : null
    }
  };
}

function buildInsightCards(campaignGroups, flowGroups, subscribers, marketCodes) {
  if (!campaignGroups.length && !flowGroups.length) {
    return [
      {
        title: "No Klaviyo activity yet",
        body: "No Klaviyo campaigns or flows were returned for the current timeframe."
      }
    ];
  }

  let worstOpen = null;
  let highestUnsub = null;
  for (const group of campaignGroups) {
    for (const market of group.markets || []) {
      if (!worstOpen || (market.openRate || 0) < (worstOpen.openRate || 0)) {
        worstOpen = { ...market, campaignName: group.campaignName };
      }
      if (!highestUnsub || (market.unsubRate || 0) > (highestUnsub.unsubRate || 0)) {
        highestUnsub = { ...market, campaignName: group.campaignName };
      }
    }
  }

  const missingCoverage = campaignGroups.find((group) => group.missingMarkets?.length);
  const overview = buildOverview(campaignGroups, flowGroups, subscribers, marketCodes);
  const subscriberMap = new Map((subscribers?.markets || []).map((item) => [item.country, item]));
  const missingLargeMarket = campaignGroups
    .flatMap((group) => (group.missingMarkets || []).map((country) => ({
      country,
      campaignName: group.campaignName,
      count: subscriberMap.get(country)?.count || 0
    })))
    .sort((a, b) => b.count - a.count)[0];
  const weakestLargeMarket = campaignGroups
    .flatMap((group) => (group.markets || []).map((market) => ({
      ...market,
      campaignName: group.campaignName,
      subscriberCount: subscriberMap.get(market.country)?.count || 0
    })))
    .filter((market) => market.subscriberCount >= Math.max(overview.subscribers.averagePerMarket, 500))
    .sort((a, b) => a.openRate - b.openRate)[0];
  const cards = [];

  if (worstOpen) {
    cards.push({
      title: "Lowest open-rate market",
      body: `${worstOpen.country} is the weakest opener on '${worstOpen.campaignName}' with ${Number(worstOpen.openRate || 0).toFixed(1)}% open rate.`
    });
  }
  if (highestUnsub) {
    cards.push({
      title: "Highest unsubscribe pressure",
      body: `${highestUnsub.country} shows the highest unsubscribe rate on '${highestUnsub.campaignName}' at ${Number(highestUnsub.unsubRate || 0).toFixed(2)}%.`
    });
  }
  if (missingCoverage) {
    cards.push({
      title: "Missing market coverage",
      body: `'${missingCoverage.campaignName}' is missing expected markets: ${missingCoverage.missingMarkets.join(", ")}.`
    });
  }
  if (overview.subscribers.topMarket?.share >= 20) {
    cards.push({
      title: "Subscriber concentration",
      body: `${overview.subscribers.topMarket.country} holds ${overview.subscribers.topMarket.share.toFixed(1)}% of all newsletter subscribers. Keep this market protected in every key campaign family.`
    });
  }
  if (missingLargeMarket?.count) {
    cards.push({
      title: "Large market missing a send",
      body: `${missingLargeMarket.country} has ${missingLargeMarket.count} subscribers but is missing '${missingLargeMarket.campaignName}'. Check whether the market was skipped or named differently there. ${Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS).join(", ")} are intentionally excluded small-list markets.`
    });
  }
  if (weakestLargeMarket) {
    cards.push({
      title: "Big-list underperformance",
      body: `${weakestLargeMarket.country} has a large list but only opened '${weakestLargeMarket.campaignName}' at ${Number(weakestLargeMarket.openRate || 0).toFixed(1)}%. Review subject line, segmentation and send timing there first.`
    });
  }
  const topFlow = flowGroups.slice().sort((a, b) => b.revenueTotal - a.revenueTotal)[0];
  if (topFlow) {
    cards.push({
      title: "Top revenue flow",
      body: `${topFlow.campaignName} generated ${topFlow.revenueTotal.toFixed(0)} DKK across ${topFlow.activeMarkets} markets in the selected range.`
    });
  }

  return cards.slice(0, 5);
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  const currencyContext = buildKlaviyoCurrencyContext(config);
  if (!requireAuth(req, res, config)) {
    return;
  }
  const forceLive = String(req.query?.forceLive || "").trim() === "1";
  const timeframeDays = Math.max(1, Math.min(90, Number(req.query?.days || config.klaviyoTimeframeDays || 30)));
  let bundledSnapshot = loadBundledSnapshot();
  if (!forceLive && bundledSnapshot && Number(bundledSnapshot.timeframeDays || timeframeDays) === timeframeDays) {
    bundledSnapshot = normalizeSnapshotRevenue(bundledSnapshot, currencyContext, bundledSnapshot.markets);
    await recordKlaviyoPerformanceLearning(bundledSnapshot.campaignGroups, timeframeDays).catch(() => null);
    sendJson(res, 200, {
      ...bundledSnapshot,
      source: "snapshot"
    });
    return;
  }

  let markets = [];
  try {
    markets = parseMarkets(config.klaviyoMarketsJson);
  } catch (error) {
    if (bundledSnapshot) {
      bundledSnapshot = normalizeSnapshotRevenue(bundledSnapshot, currencyContext, bundledSnapshot.markets);
      await recordKlaviyoPerformanceLearning(bundledSnapshot.campaignGroups, timeframeDays).catch(() => null);
      sendJson(res, 200, {
        ...bundledSnapshot,
        source: "snapshot",
        refreshWarning: error.message || "Invalid Klaviyo market configuration."
      });
      return;
    }
    sendJson(res, 500, { error: error.message || "Invalid Klaviyo market configuration." });
    return;
  }

  if (!markets.length) {
    if (bundledSnapshot) {
      bundledSnapshot = normalizeSnapshotRevenue(bundledSnapshot, currencyContext, bundledSnapshot.markets);
      await recordKlaviyoPerformanceLearning(bundledSnapshot.campaignGroups, timeframeDays).catch(() => null);
      sendJson(res, 200, {
        ...bundledSnapshot,
        source: "snapshot",
        refreshWarning: "Missing Klaviyo market configuration."
      });
      return;
    }
    sendJson(res, 500, { error: "Missing Klaviyo market configuration." });
    return;
  }

  const to = new Date();
  const from = daysAgo(timeframeDays);
  const timeframe = {
    start: to.toISOString ? from.toISOString().slice(0, 19) : "",
    end: to.toISOString().slice(0, 19)
  };

  try {
    const groupMap = new Map();
    const flowGroupMap = new Map();
    const marketCodes = markets.map((market) => String(market.country || "").trim()).filter(Boolean);
    const expectedMarketCodes = getCoverageExpectedMarkets(marketCodes);
    const subscriberMarkets = [];
    const snapshotSubscriberCounts = new Map(
      (bundledSnapshot?.subscribers?.markets || []).map((item) => [String(item.country || "").trim(), Number(item.count || 0)])
    );
    const activeMarkets = markets.filter((market) => String(market.country || "").trim() && String(market.privateKey || "").trim());
    const marketResults = await mapWithConcurrencySettled(
      activeMarkets,
      3,
      (market) => fetchMarketOverview(market, { config, timeframe, from, marketCodes, snapshotSubscriberCounts })
    );
    const failedMarkets = [];

    for (const result of marketResults) {
      if (result?.status !== "fulfilled" || !result.value) {
        const message = String(result?.reason?.message || "").trim();
        if (message) {
          failedMarkets.push(message);
        }
        continue;
      }

      const marketResult = result.value;
      subscriberMarkets.push(marketResult.subscriber);

      for (const campaignEntry of marketResult.campaignGroups) {
        const campaignName = campaignEntry.campaignName;
        if (!groupMap.has(campaignName)) {
          groupMap.set(campaignName, {
            campaignName,
            lastSent: campaignEntry.lastSent,
            markets: []
          });
        }

        const group = groupMap.get(campaignName);
        if (new Date(group.lastSent) < new Date(campaignEntry.lastSent)) {
          group.lastSent = campaignEntry.lastSent;
        }
        const existingIndex = group.markets.findIndex((item) => item.country === campaignEntry.marketRow.country);
        if (existingIndex >= 0) {
          group.markets[existingIndex] = mergeMarketRows(group.markets[existingIndex], campaignEntry.marketRow);
        } else {
          group.markets.push(campaignEntry.marketRow);
        }
      }

      for (const flowEntry of marketResult.flowGroups) {
        if (!flowGroupMap.has(flowEntry.familyKey)) {
          flowGroupMap.set(flowEntry.familyKey, {
            campaignName: flowEntry.familyKey,
            lastSent: flowEntry.marketRow.sendTime,
            flowStatus: flowEntry.flowStatus,
            triggerType: flowEntry.triggerType,
            aliases: [flowEntry.alias],
            markets: []
          });
        }

        const group = flowGroupMap.get(flowEntry.familyKey);
        if (!group.aliases.includes(flowEntry.alias)) {
          group.aliases.push(flowEntry.alias);
        }
        if (new Date(group.lastSent) < new Date(flowEntry.marketRow.sendTime)) {
          group.lastSent = flowEntry.marketRow.sendTime;
        }
        const existingIndex = group.markets.findIndex((item) => item.country === flowEntry.marketRow.country);
        if (existingIndex >= 0) {
          group.markets[existingIndex] = mergeMarketRows(group.markets[existingIndex], flowEntry.marketRow);
        } else {
          group.markets.push(flowEntry.marketRow);
        }
      }
    }

    if (!subscriberMarkets.length && !groupMap.size && !flowGroupMap.size) {
      throw new Error(failedMarkets[0] || "Klaviyo overview failed.");
    }

    const groups = [...groupMap.values()].map((group) => {
      const marketsForGroup = [...group.markets].sort((a, b) => String(a.country).localeCompare(String(b.country)));
      const sentTotal = marketsForGroup.reduce((sum, market) => sum + (market.sent || 0), 0);
      const revenueTotal = marketsForGroup.reduce((sum, market) => sum + (market.revenue || 0), 0);
      const openRateWeighted = buildWeightedRate(marketsForGroup, "openRate");
      const clickRateWeighted = buildWeightedRate(marketsForGroup, "clickRate");
      const unsubRateWeighted = buildWeightedRate(marketsForGroup, "unsubRate");
      const present = new Set(marketsForGroup.map((market) => market.country));
      const missingMarkets = expectedMarketCodes.filter((country) => !present.has(country));

      const result = {
        campaignName: group.campaignName,
        lastSent: group.lastSent,
        sentTotal,
        revenueTotal: Number(revenueTotal.toFixed(2)),
        openRateWeighted: Number(openRateWeighted.toFixed(2)),
        clickRateWeighted: Number(clickRateWeighted.toFixed(2)),
        unsubRateWeighted: Number(unsubRateWeighted.toFixed(2)),
        activeMarkets: marketsForGroup.length,
        missingMarkets,
        aliases: Array.isArray(group.aliases) ? [...group.aliases].sort((a, b) => a.localeCompare(b)) : [],
        flowStatus: group.flowStatus,
        triggerType: group.triggerType,
        markets: marketsForGroup
      };

      result.aiSummary = buildGroupSummary(result);
      return result;
    }).sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));
    const flowGroups = [...flowGroupMap.values()].map((group) => {
      const marketsForGroup = [...group.markets].sort((a, b) => String(a.country).localeCompare(String(b.country)));
      const sentTotal = marketsForGroup.reduce((sum, market) => sum + (market.sent || 0), 0);
      const revenueTotal = marketsForGroup.reduce((sum, market) => sum + (market.revenue || 0), 0);
      const openRateWeighted = buildWeightedRate(marketsForGroup, "openRate");
      const clickRateWeighted = buildWeightedRate(marketsForGroup, "clickRate");
      const unsubRateWeighted = buildWeightedRate(marketsForGroup, "unsubRate");
      const present = new Set(marketsForGroup.map((market) => market.country));
      const missingMarkets = expectedMarketCodes.filter((country) => !present.has(country));

      const result = {
        campaignName: group.campaignName,
        lastSent: group.lastSent,
        triggerType: group.triggerType,
        flowStatus: group.flowStatus,
        sentTotal,
        revenueTotal: Number(revenueTotal.toFixed(2)),
        openRateWeighted: Number(openRateWeighted.toFixed(2)),
        clickRateWeighted: Number(clickRateWeighted.toFixed(2)),
        unsubRateWeighted: Number(unsubRateWeighted.toFixed(2)),
        activeMarkets: marketsForGroup.length,
        missingMarkets,
        markets: marketsForGroup
      };

      result.aiSummary = buildFlowSummary(result);
      return result;
    }).sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));

    const liveSubscriberCountSources = subscriberMarkets.map((item) => String(item.countSource || "unknown"));
    const hasSnapshotFallbackCounts = liveSubscriberCountSources.includes("snapshot_fallback");
    const hasMissingListCounts = liveSubscriberCountSources.includes("missing_list");
    const subscriberCountSource = hasSnapshotFallbackCounts
      ? "mixed_live_snapshot_fallback"
      : hasMissingListCounts
        ? "partial_missing_list"
        : "live";
    const subscriberHistorySource = bundledSnapshot?.subscribers?.timeline || bundledSnapshot?.subscribers?.snapshots
      ? "snapshot_history"
      : "unavailable";

    const subscribers = {
      total: subscriberMarkets.reduce((sum, item) => sum + (item.count || 0), 0),
      markets: subscriberMarkets.sort((a, b) => String(a.country).localeCompare(String(b.country))),
      timeline: bundledSnapshot?.subscribers?.timeline || null,
      snapshots: bundledSnapshot?.subscribers?.snapshots || null,
      countSource: subscriberCountSource,
      historySource: subscriberHistorySource,
      historyGeneratedAt: bundledSnapshot?.generatedAt || ""
    };

    await recordKlaviyoPerformanceLearning(groups, timeframeDays).catch(() => null);
    sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      timeframeDays,
      markets: marketCodes,
      coverageRules: {
        expectedMarkets: expectedMarketCodes,
        exemptMarkets: Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS),
        exemptReason: KLAVIYO_SMALL_LIST_EXEMPT_REASON
      },
      subscribers,
      overview: buildOverview(groups, flowGroups, subscribers, marketCodes),
      campaignGroups: groups,
      flowGroups,
      flowSnapshots: Array.isArray(bundledSnapshot?.flowSnapshots) ? bundledSnapshot.flowSnapshots : [],
      insightCards: buildInsightCards(groups, flowGroups, subscribers, marketCodes),
      currency: {
        baseCurrency: currencyContext.baseCurrency,
        fxSource: currencyContext.fxSource,
        fxReferenceDate: currencyContext.fxReferenceDate,
        fxRatesToDkk: currencyContext.fxRatesToDkk
      },
      refreshWarning: failedMarkets.length
        ? `Live refresh completed with gaps in ${failedMarkets.length} market${failedMarkets.length === 1 ? "" : "s"}. ${failedMarkets.slice(0, 3).join(" | ")}`
        : "",
      subscriberWarning: hasSnapshotFallbackCounts
        ? "Some subscriber counts used snapshot fallback because live list counts could not be fetched for every market."
        : hasMissingListCounts
          ? "Some subscriber counts may be incomplete because a newsletter list could not be identified for every market."
          : ""
    });
  } catch (error) {
    if (bundledSnapshot) {
      bundledSnapshot = normalizeSnapshotRevenue(bundledSnapshot, currencyContext, bundledSnapshot.markets);
      await recordKlaviyoPerformanceLearning(bundledSnapshot.campaignGroups, timeframeDays).catch(() => null);
      sendJson(res, 200, {
        ...bundledSnapshot,
        source: "snapshot",
        refreshWarning: error.message || "Klaviyo overview failed."
      });
      return;
    }
    sendJson(res, 500, {
      error: error.message || "Klaviyo overview failed."
    });
  }
};
