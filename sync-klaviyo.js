const fs = require("fs");
const path = require("path");
const { buildKlaviyoCurrencyContext, normalizeMarketRevenueRow } = require("./api/_lib/klaviyo-currency");

function readConfig() {
  const configPath = path.join(process.cwd(), "klaviyo-config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("Missing klaviyo-config.json. Create it from klaviyo-config.template.json first.");
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    revision: config.revision || "2024-10-15",
    timeframeDays: Number(config.timeframeDays || 30),
    markets: Array.isArray(config.markets) ? config.markets : [],
    countryCurrencies: config.countryCurrencies || {},
    fxRatesToDkk: config.fxRatesToDkk || {},
    klaviyoFxSource: config.fxSource || "",
    klaviyoFxReferenceDate: config.fxReferenceDate || ""
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

function formatDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildDateWindow(days) {
  const totalDays = Math.max(7, days);
  const start = daysAgo(totalDays - 1);
  start.setUTCHours(0, 0, 0, 0);
  const dates = [];
  const cursor = new Date(start);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  while (cursor <= today) {
    dates.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
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
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
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
    if (Array.isArray(payload.data)) items.push(...payload.data);
    next = payload?.links?.next || "";
  }
  return items;
}

async function getPlacedOrderMetricId(headers) {
  const metrics = await getAllPages("https://a.klaviyo.com/api/metrics/", headers);
  const match = metrics.find((metric) => metric?.attributes?.name === "Placed Order");
  return match?.id || "";
}

async function detectSubscriberList(headers, configuredListId) {
  const lists = await getAllPages("https://a.klaviyo.com/api/lists/", headers);
  if (configuredListId) {
    const exact = lists.find((list) => list?.id === configuredListId);
    if (exact) {
      return {
        id: exact.id,
        name: exact.attributes?.name || exact.id
      };
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
      return {
        id: list?.id,
        name,
        score
      };
    })
    .filter((item) => item.id && item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return scored[0] || null;
}

async function collectListProfileStats(headers, listId, historyDays = 180) {
  if (!listId) {
    return {
      count: 0,
      dates: buildDateWindow(historyDays),
      joinedDaily: buildDateWindow(historyDays).map(() => 0),
      cumulative: buildDateWindow(historyDays).map(() => 0)
    };
  }

  const dates = buildDateWindow(historyDays);
  const dateSet = new Set(dates);
  const startKey = dates[0];
  const joinedCounts = new Map(dates.map((date) => [date, 0]));
  let total = 0;
  let baseCountBeforeWindow = 0;
  let next = `https://a.klaviyo.com/api/lists/${listId}/profiles/?page%5Bsize%5D=100`;
  while (next) {
    const payload = await klaviyoRequest(next, headers);
    const profiles = Array.isArray(payload.data) ? payload.data : [];
    total += profiles.length;
    for (const profile of profiles) {
      const joinedAt = profile?.attributes?.joined_group_at || profile?.attributes?.created;
      const joinedKey = formatDateKey(joinedAt);
      if (!joinedKey) continue;
      if (joinedKey < startKey) {
        baseCountBeforeWindow += 1;
        continue;
      }
      if (dateSet.has(joinedKey)) {
        joinedCounts.set(joinedKey, (joinedCounts.get(joinedKey) || 0) + 1);
      }
    }
    next = payload?.links?.next || "";
  }

  let running = baseCountBeforeWindow;
  const joinedDaily = [];
  const cumulative = [];
  for (const date of dates) {
    const joined = joinedCounts.get(date) || 0;
    joinedDaily.push(joined);
    running += joined;
    cumulative.push(running);
  }

  return {
    count: total,
    dates,
    joinedDaily,
    cumulative
  };
}

function loadSnapshotArchive(archivePath) {
  if (!fs.existsSync(archivePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(archivePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function loadExistingLiveSnapshot(snapshotPath) {
  if (!fs.existsSync(snapshotPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  } catch (error) {
    return null;
  }
}

function isFreshSnapshot(snapshot, maxAgeHours = 18) {
  const generatedAt = snapshot?.generatedAt ? new Date(snapshot.generatedAt) : null;
  if (!generatedAt || Number.isNaN(generatedAt.getTime())) return false;
  const ageMs = Date.now() - generatedAt.getTime();
  return ageMs >= 0 && ageMs <= maxAgeHours * 60 * 60 * 1000;
}

function getCachedSubscriberStats(snapshot, country, listId) {
  const cachedMarket = snapshot?.subscribers?.markets?.find((item) => item.country === country);
  const cachedTimeline = snapshot?.subscribers?.timeline?.markets?.find((item) => item.country === country);
  if (!cachedMarket || !cachedTimeline) return null;
  if (listId && cachedMarket.listId && cachedMarket.listId !== listId) return null;
  return {
    count: cachedMarket.count || 0,
    dates: Array.isArray(snapshot?.subscribers?.timeline?.dates) ? snapshot.subscribers.timeline.dates : buildDateWindow(180),
    joinedDaily: Array.isArray(cachedTimeline.joinedDaily) ? cachedTimeline.joinedDaily : [],
    cumulative: Array.isArray(cachedTimeline.cumulative) ? cachedTimeline.cumulative : [],
    listId: cachedMarket.listId || listId || "",
    listName: cachedMarket.listName || cachedTimeline.listName || ""
  };
}

function updateSubscriberSnapshotArchive(archivePath, subscribers) {
  const dateKey = formatDateKey(new Date());
  const archive = loadSnapshotArchive(archivePath);
  const countsByMarket = Object.fromEntries((subscribers.markets || []).map((item) => [item.country, item.count || 0]));
  const entry = {
    date: dateKey,
    total: subscribers.total || 0,
    markets: countsByMarket
  };
  const existingIndex = archive.findIndex((item) => item.date === dateKey);
  if (existingIndex >= 0) {
    archive[existingIndex] = entry;
  } else {
    archive.push(entry);
  }
  archive.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const trimmed = archive.slice(-365);
  fs.writeFileSync(archivePath, JSON.stringify(trimmed, null, 2), "utf8");
  return trimmed;
}

function updateFlowSnapshotArchive(archivePath, flowGroups) {
  const dateKey = formatDateKey(new Date());
  const archive = loadSnapshotArchive(archivePath);
  const flows = (flowGroups || []).map((group) => ({
    campaignName: group.campaignName,
    sentTotal: group.sentTotal || 0,
    revenueTotal: group.revenueTotal || 0,
    openRateWeighted: Number(Number(group.openRateWeighted || 0).toFixed(2)),
    clickRateWeighted: Number(Number(group.clickRateWeighted || 0).toFixed(2)),
    unsubRateWeighted: Number(Number(group.unsubRateWeighted || 0).toFixed(2)),
    activeMarkets: group.activeMarkets || 0,
    missingMarkets: Array.isArray(group.missingMarkets) ? group.missingMarkets.length : 0
  })).sort((a, b) => String(a.campaignName).localeCompare(String(b.campaignName)));
  const entry = {
    date: dateKey,
    totalFamilies: (flowGroups || []).length,
    flows
  };
  const existingIndex = archive.findIndex((item) => item.date === dateKey);
  if (existingIndex >= 0) {
    archive[existingIndex] = entry;
  } else {
    archive.push(entry);
  }
  archive.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const trimmed = archive.slice(-365);
  fs.writeFileSync(archivePath, JSON.stringify(trimmed, null, 2), "utf8");
  return trimmed;
}

function buildSubscriberSnapshots(archive, marketCodes) {
  const dates = archive.map((item) => item.date);
  return {
    dates,
    totalSeries: archive.map((item) => item.total || 0),
    markets: marketCodes.map((country) => ({
      country,
      series: archive.map((item) => item.markets?.[country] || 0)
    }))
  };
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

function buildGroupSummary(group) {
  const markets = Array.isArray(group.markets) ? group.markets : [];
  if (!markets.length) return "No market data available for this campaign family.";
  const topRevenue = [...markets].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
  const worstOpen = [...markets].sort((a, b) => (a.openRate || 0) - (b.openRate || 0))[0];
  if (group.missingMarkets?.length) {
    return `Missing markets: ${group.missingMarkets.join(", ")}. Top revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
  }
  return `All configured markets sent this campaign. Top revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
}

function buildFlowSummary(group) {
  const markets = Array.isArray(group.markets) ? group.markets : [];
  if (!markets.length) return "No market data available for this flow family.";
  const topRevenue = [...markets].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
  const worstOpen = [...markets].sort((a, b) => (a.openRate || 0) - (b.openRate || 0))[0];
  if (group.missingMarkets?.length) {
    return `Missing markets: ${group.missingMarkets.join(", ")}. Top flow revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
  }
  return `All configured markets are active in this flow. Top revenue market: ${topRevenue.country}. Lowest open rate: ${worstOpen.country}.`;
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
  const sentTotal = campaignGroups.reduce((sum, group) => sum + (group.sentTotal || 0), 0);
  const revenueTotal = Number(campaignGroups.reduce((sum, group) => sum + (group.revenueTotal || 0), 0).toFixed(2));
  const weightedOpenRate = sentTotal ? Number((campaignGroups.reduce((sum, group) => sum + ((group.openRateWeighted || 0) * (group.sentTotal || 0)), 0) / sentTotal).toFixed(2)) : 0;
  const weightedClickRate = sentTotal ? Number((campaignGroups.reduce((sum, group) => sum + ((group.clickRateWeighted || 0) * (group.sentTotal || 0)), 0) / sentTotal).toFixed(2)) : 0;
  const weightedUnsubRate = sentTotal ? Number((campaignGroups.reduce((sum, group) => sum + ((group.unsubRateWeighted || 0) * (group.sentTotal || 0)), 0) / sentTotal).toFixed(2)) : 0;
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
    sentTotal,
    revenueTotal,
    weightedOpenRate,
    weightedClickRate,
    weightedUnsubRate,
    campaignFamilies: campaignGroups.length,
    flowSentTotal,
    flowRevenueTotal,
    flowOpenRate,
    flowClickRate,
    flowUnsubRate,
    flowFamilies: flowGroups.length,
    fullCoverageFlows,
    missingCoverageFlows: flowGroups.length - fullCoverageFlows,
    fullCoverageCampaigns,
    missingCoverageCampaigns: campaignGroups.length - fullCoverageCampaigns,
    totalMarkets: marketCodes.length,
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
    return [{ title: "No Klaviyo activity yet", body: "No Klaviyo campaigns or flows were returned for the current timeframe." }];
  }

  let worstOpen = null;
  let highestUnsub = null;
  for (const group of campaignGroups) {
    for (const market of group.markets || []) {
      if (!worstOpen || (market.openRate || 0) < (worstOpen.openRate || 0)) worstOpen = { ...market, campaignName: group.campaignName };
      if (!highestUnsub || (market.unsubRate || 0) > (highestUnsub.unsubRate || 0)) highestUnsub = { ...market, campaignName: group.campaignName };
    }
  }

  const cards = [];
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

  if (worstOpen) cards.push({ title: "Lowest open-rate market", body: `${worstOpen.country} is the weakest opener on '${worstOpen.campaignName}' with ${Number(worstOpen.openRate || 0).toFixed(1)}% open rate.` });
  if (highestUnsub) cards.push({ title: "Highest unsubscribe pressure", body: `${highestUnsub.country} shows the highest unsubscribe rate on '${highestUnsub.campaignName}' at ${Number(highestUnsub.unsubRate || 0).toFixed(2)}%.` });
  const missingCoverage = campaignGroups.find((group) => group.missingMarkets?.length);
  if (missingCoverage) cards.push({ title: "Missing market coverage", body: `'${missingCoverage.campaignName}' is missing: ${missingCoverage.missingMarkets.join(", ")}.` });
  if (overview.subscribers.topMarket?.share >= 20) {
    cards.push({
      title: "Subscriber concentration",
      body: `${overview.subscribers.topMarket.country} holds ${overview.subscribers.topMarket.share.toFixed(1)}% of all newsletter subscribers. Keep this market protected in every key campaign family.`
    });
  }
  if (missingLargeMarket?.count) {
    cards.push({
      title: "Large market missing a send",
      body: `${missingLargeMarket.country} has ${missingLargeMarket.count} subscribers but is missing '${missingLargeMarket.campaignName}'. Check whether the market was skipped or named differently there.`
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

async function main() {
  const config = readConfig();
  const currencyContext = buildKlaviyoCurrencyContext(config);
  if (!config.markets.length) throw new Error("klaviyo-config.json must contain at least one market.");

  const to = new Date();
  const from = daysAgo(Math.max(1, Math.min(90, config.timeframeDays)));
  const timeframe = {
    start: from.toISOString().slice(0, 19),
    end: to.toISOString().slice(0, 19)
  };

  const groupMap = new Map();
  const flowGroupMap = new Map();
  const marketCodes = config.markets.map((market) => String(market.country || "").trim()).filter(Boolean);
  const subscriberMarkets = [];
  let subscriberTimelineDates = buildDateWindow(180);
  const outputDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outputDir, { recursive: true });
  const existingSnapshot = loadExistingLiveSnapshot(path.join(outputDir, "klaviyo-live.json"));
  const canReuseSubscribers = isFreshSnapshot(existingSnapshot, 18);

  for (const market of config.markets) {
    const country = String(market.country || "").trim();
    const privateKey = String(market.privateKey || "").trim();
    if (!country || !privateKey) continue;

    const headers = buildHeaders(privateKey, config.revision);
    const jsonHeaders = buildHeaders(privateKey, config.revision, true);
    const conversionMetricId = await getPlacedOrderMetricId(headers);
    const subscriberList = await detectSubscriberList(headers, market.listId);
    const cachedSubscriberStats = canReuseSubscribers
      ? getCachedSubscriberStats(existingSnapshot, country, subscriberList?.id || market.listId || "")
      : null;
    const subscriberStats = cachedSubscriberStats || (subscriberList ? await collectListProfileStats(headers, subscriberList.id, 180) : {
      count: 0,
      dates: buildDateWindow(180),
      joinedDaily: buildDateWindow(180).map(() => 0),
      cumulative: buildDateWindow(180).map(() => 0)
    });
    subscriberTimelineDates = subscriberStats.dates;
    subscriberMarkets.push({
      country,
      listId: subscriberList?.id || cachedSubscriberStats?.listId || "",
      listName: subscriberList?.name || cachedSubscriberStats?.listName || "",
      count: subscriberStats.count,
      joinedDaily: subscriberStats.joinedDaily,
      cumulative: subscriberStats.cumulative
    });
    const campaigns = await getAllPages(
      "https://a.klaviyo.com/api/campaigns/?filter=and(equals(messages.channel,'email'),equals(status,'Sent'))&fields%5Bcampaign%5D=name,status,send_time,created_at,updated_at&sort=-updated_at",
      headers
    );
    const flows = await getAllPages(
      "https://a.klaviyo.com/api/flows/?fields%5Bflow%5D=name,status,trigger_type,created,updated&sort=-updated",
      headers
    );

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

    const reports = await queryCampaignValues(jsonHeaders, timeframe, conversionMetricId);
    for (const report of reports) {
      const campaignId = String(report?.groupings?.campaign_id || "");
      const campaignInfo = campaignsById.get(campaignId);
      if (!campaignInfo) continue;

      const marketRow = normalizeMarketRevenueRow({
        country,
        sent: Math.round(Number(getReportValue(report, "recipients") || 0)),
        openRate: Number((Number(getReportValue(report, "open_rate") || 0) * 100).toFixed(2)),
        clickRate: Number((Number(getReportValue(report, "click_rate") || 0) * 100).toFixed(2)),
        revenue: Number(Number(getReportValue(report, "conversion_value") || 0).toFixed(2)),
        unsubRate: Number((Number(getReportValue(report, "unsubscribe_rate") || 0) * 100).toFixed(2)),
        sendTime: campaignInfo.sendTime,
        status: "sent"
      }, country, currencyContext);

      const campaignName = campaignInfo.campaignName;
      if (!groupMap.has(campaignName)) {
        groupMap.set(campaignName, { campaignName, lastSent: campaignInfo.sendTime, markets: [] });
      }

      const group = groupMap.get(campaignName);
      if (new Date(group.lastSent) < new Date(campaignInfo.sendTime)) group.lastSent = campaignInfo.sendTime;
      const existingIndex = group.markets.findIndex((item) => item.country === country);
      if (existingIndex >= 0) {
        group.markets[existingIndex] = mergeMarketRows(group.markets[existingIndex], marketRow);
      } else {
        group.markets.push(marketRow);
      }
    }
    const flowReports = await queryFlowValues(jsonHeaders, timeframe, conversionMetricId);
    const flowStatsById = buildFlowStatsById(flowReports);
    for (const [flowId, flowInfo] of flowsById.entries()) {
      if (!flowInfo?.flowName) continue;
      if (String(flowInfo.status || "").toLowerCase() !== "live") continue;
      if (isCampaignLikeFlowName(flowInfo.flowName)) continue;
      const familyKey = normalizeFlowFamilyName(flowInfo.flowName, marketCodes) || flowInfo.flowName;
      const stats = flowStatsById.get(flowId);

      const marketRow = normalizeMarketRevenueRow({
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
      }, country, currencyContext);

      if (!flowGroupMap.has(familyKey)) {
        flowGroupMap.set(familyKey, {
          campaignName: familyKey,
          lastSent: marketRow.sendTime,
          flowStatus: flowInfo.status,
          triggerType: flowInfo.triggerType,
          aliases: [flowInfo.flowName],
          markets: []
        });
      }

      const group = flowGroupMap.get(familyKey);
      if (!group.aliases.includes(flowInfo.flowName)) {
        group.aliases.push(flowInfo.flowName);
      }
      if (new Date(group.lastSent) < new Date(marketRow.sendTime)) group.lastSent = marketRow.sendTime;
      const existingIndex = group.markets.findIndex((item) => item.country === country);
      if (existingIndex >= 0) {
        group.markets[existingIndex] = mergeMarketRows(group.markets[existingIndex], marketRow);
      } else {
        group.markets.push(marketRow);
      }
    }
  }

  const campaignGroups = [...groupMap.values()].map((group) => {
    const markets = [...group.markets].sort((a, b) => String(a.country).localeCompare(String(b.country)));
    const sentTotal = markets.reduce((sum, market) => sum + (market.sent || 0), 0);
    const revenueTotal = markets.reduce((sum, market) => sum + (market.revenue || 0), 0);
    const openRateWeighted = buildWeightedRate(markets, "openRate");
    const clickRateWeighted = buildWeightedRate(markets, "clickRate");
    const unsubRateWeighted = buildWeightedRate(markets, "unsubRate");
    const present = new Set(markets.map((market) => market.country));
    const missingMarkets = marketCodes.filter((country) => !present.has(country));
    const result = {
      campaignName: group.campaignName,
      lastSent: group.lastSent,
      sentTotal,
      revenueTotal: Number(revenueTotal.toFixed(2)),
      openRateWeighted: Number(openRateWeighted.toFixed(2)),
      clickRateWeighted: Number(clickRateWeighted.toFixed(2)),
      unsubRateWeighted: Number(unsubRateWeighted.toFixed(2)),
      activeMarkets: markets.length,
      missingMarkets,
      aliases: Array.isArray(group.aliases) ? [...group.aliases].sort((a, b) => a.localeCompare(b)) : [],
      flowStatus: group.flowStatus,
      triggerType: group.triggerType,
      markets
    };
    result.aiSummary = buildGroupSummary(result);
    return result;
  }).sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));
  const flowGroups = [...flowGroupMap.values()].map((group) => {
    const markets = [...group.markets].sort((a, b) => String(a.country).localeCompare(String(b.country)));
    const sentTotal = markets.reduce((sum, market) => sum + (market.sent || 0), 0);
    const revenueTotal = markets.reduce((sum, market) => sum + (market.revenue || 0), 0);
    const openRateWeighted = buildWeightedRate(markets, "openRate");
    const clickRateWeighted = buildWeightedRate(markets, "clickRate");
    const unsubRateWeighted = buildWeightedRate(markets, "unsubRate");
    const present = new Set(markets.map((market) => market.country));
    const missingMarkets = marketCodes.filter((country) => !present.has(country));
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
      activeMarkets: markets.length,
      missingMarkets,
      markets
    };
    result.aiSummary = buildFlowSummary(result);
    return result;
  }).sort((a, b) => new Date(b.lastSent) - new Date(a.lastSent));

  const subscribers = {
    total: subscriberMarkets.reduce((sum, item) => sum + (item.count || 0), 0),
    markets: subscriberMarkets.sort((a, b) => String(a.country).localeCompare(String(b.country)))
  };
  subscribers.timeline = {
    dates: subscriberTimelineDates,
    totalJoinedDaily: subscriberTimelineDates.map((_, index) => subscribers.markets.reduce((sum, item) => sum + (item.joinedDaily?.[index] || 0), 0)),
    totalCumulative: subscriberTimelineDates.map((_, index) => subscribers.markets.reduce((sum, item) => sum + (item.cumulative?.[index] || 0), 0)),
    markets: subscribers.markets.map((item) => ({
      country: item.country,
      listName: item.listName,
      count: item.count,
      joinedDaily: item.joinedDaily || [],
      cumulative: item.cumulative || []
    }))
  };

  const snapshotArchivePath = path.join(outputDir, "klaviyo-subscriber-snapshots.json");
  const snapshotArchive = updateSubscriberSnapshotArchive(snapshotArchivePath, subscribers);
  subscribers.snapshots = buildSubscriberSnapshots(snapshotArchive, marketCodes);
  const flowSnapshotArchivePath = path.join(outputDir, "klaviyo-flow-snapshots.json");
  const flowSnapshotArchive = updateFlowSnapshotArchive(flowSnapshotArchivePath, flowGroups);

  const payload = {
    generatedAt: new Date().toISOString(),
    timeframeDays: config.timeframeDays,
    markets: marketCodes,
    currency: {
      baseCurrency: currencyContext.baseCurrency,
      fxSource: currencyContext.fxSource,
      fxReferenceDate: currencyContext.fxReferenceDate,
      fxRatesToDkk: currencyContext.fxRatesToDkk
    },
    subscribers,
    campaignGroups,
    flowGroups,
    flowSnapshots: flowSnapshotArchive,
    overview: buildOverview(campaignGroups, flowGroups, subscribers, marketCodes),
    insightCards: buildInsightCards(campaignGroups, flowGroups, subscribers, marketCodes)
  };

  fs.writeFileSync(path.join(outputDir, "klaviyo-live.json"), JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(path.join(outputDir, "klaviyo-live.js"), `const klaviyoLiveSnapshot = ${JSON.stringify(payload, null, 2)};\n\nexport default klaviyoLiveSnapshot;\n`, "utf8");

  console.log(`Klaviyo sync completed. Saved ${campaignGroups.length} campaign groups and ${flowGroups.length} flow groups.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
