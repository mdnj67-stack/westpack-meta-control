const { ensureAccountId, graphRequest } = require("../lib/meta");

const MAX_ADS = 2500;
const DEFAULT_DAYS = 365;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(items, names) {
  const list = Array.isArray(items) ? items : [];
  for (const name of names) {
    const match = list.find((item) => item?.action_type === name);
    if (match) return number(match.value);
  }
  return 0;
}

function extractCreative(creative = {}) {
  const story = creative.object_story_spec || {};
  const link = story.link_data || {};
  const video = story.video_data || {};
  const photo = story.photo_data || {};
  const feed = creative.asset_feed_spec || {};
  const cards = Array.isArray(link.child_attachments) ? link.child_attachments : [];
  const feedImages = Array.isArray(feed.images) ? feed.images : [];
  const primaryText = link.message || video.message || photo.message || feed.bodies?.[0]?.text || "";
  const headline = link.name || video.title || feed.titles?.[0]?.text || "";
  const description = link.description || video.link_description || feed.descriptions?.[0]?.text || "";
  const format = cards.length >= 2 || feedImages.length >= 2 ? "carousel" : (video.video_id || feed.videos?.length ? "video" : "single_image");
  return {
    id: String(creative.id || ""),
    name: String(creative.name || ""),
    format,
    primaryText: String(primaryText || "").trim(),
    headline: String(headline || "").trim(),
    description: String(description || "").trim(),
    destinationUrl: String(link.link || video.call_to_action?.value?.link || feed.link_urls?.[0]?.website_url || ""),
    thumbnailUrl: String(creative.thumbnail_url || creative.image_url || ""),
    imageHash: String(creative.image_hash || link.image_hash || ""),
    cards: cards.slice(0, 10).map((card, index) => ({
      index: index + 1,
      title: String(card?.name || ""),
      description: String(card?.description || ""),
      imageHash: String(card?.image_hash || ""),
      picture: String(card?.picture || "")
    }))
  };
}

function inferFeatures(ad) {
  const copy = `${ad.creative.primaryText} ${ad.creative.headline}`.toLowerCase();
  const features = [];
  if (/\b(?:discover|explore|introducing|new)\b/.test(copy)) features.push("discovery_hook");
  if (/\b(?:retailer|retail|shop|business|customers|sales)\b/.test(copy)) features.push("commercial_b2b");
  if (/\b(?:premium|quality|crafted|presentation|elegant)\b/.test(copy)) features.push("premium_value");
  if (/\b(?:limited|today|now|last chance)\b/.test(copy)) features.push("urgency");
  if (/\b(?:how|guide|tips|ways)\b/.test(copy)) features.push("education");
  if (ad.creative.primaryText.length <= 140) features.push("compact_primary_text");
  if (ad.creative.headline.length > 0 && ad.creative.headline.length <= 45) features.push("compact_headline");
  features.push(`format_${ad.creative.format}`);
  return features;
}

function metricRow(insight = {}) {
  const spend = number(insight.spend);
  const impressions = number(insight.impressions);
  const clicks = number(insight.inline_link_clicks || insight.clicks);
  const purchases = actionValue(insight.actions, ["purchase", "omni_purchase"]);
  const leads = actionValue(insight.actions, ["lead", "onsite_conversion.lead_grouped"]);
  const purchaseValue = actionValue(insight.action_values, ["purchase", "omni_purchase"]);
  return {
    spend,
    impressions,
    reach: number(insight.reach),
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : number(insight.inline_link_click_ctr),
    cpc: clicks > 0 ? spend / clicks : number(insight.cpc),
    cpm: impressions > 0 ? (spend / impressions) * 1000 : number(insight.cpm),
    purchases,
    leads,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : number(insight.purchase_roas?.[0]?.value || insight.website_purchase_roas?.[0]?.value)
  };
}

function performanceValue(ad) {
  const objective = String(ad.objective || "").toUpperCase();
  const metrics = ad.metrics;
  if (objective.includes("SALES") || objective.includes("CONVERSION")) return metrics.roas * 10 + metrics.ctr;
  if (objective.includes("LEAD")) return metrics.leads > 0 ? (metrics.leads * 10) / Math.max(metrics.spend, 1) + metrics.ctr : metrics.ctr;
  if (objective.includes("AWARENESS") || objective.includes("REACH")) return metrics.ctr + (metrics.cpm > 0 ? 10 / metrics.cpm : 0);
  return metrics.ctr + (metrics.cpc > 0 ? 1 / metrics.cpc : 0);
}

function percentileRank(value, values) {
  if (!values.length) return 0;
  const below = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return Math.round(((below + equal * 0.5) / values.length) * 100);
}

function buildCreativeDna(ads) {
  const eligible = ads.filter((ad) => ad.metrics.impressions >= 1000 && ad.metrics.spend > 0);
  const cohorts = new Map();
  for (const ad of eligible) {
    const key = `${ad.objective || "UNKNOWN"}|${ad.creative.format}`;
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(ad);
  }
  for (const rows of cohorts.values()) {
    const values = rows.map(performanceValue);
    rows.forEach((ad) => { ad.performancePercentile = percentileRank(performanceValue(ad), values); });
  }
  const featureMap = new Map();
  for (const ad of eligible) {
    for (const feature of ad.features) {
      const row = featureMap.get(feature) || { feature, uses: 0, winners: 0, percentileTotal: 0 };
      row.uses += 1;
      row.winners += ad.performancePercentile >= 75 ? 1 : 0;
      row.percentileTotal += ad.performancePercentile;
      featureMap.set(feature, row);
    }
  }
  const patterns = [...featureMap.values()].map((row) => ({
    ...row,
    winnerRate: row.uses ? Math.round((row.winners / row.uses) * 100) : 0,
    averagePercentile: row.uses ? Math.round(row.percentileTotal / row.uses) : 0,
    confidence: row.uses >= 12 ? "high" : row.uses >= 5 ? "medium" : "low"
  })).sort((a, b) => b.averagePercentile - a.averagePercentile || b.uses - a.uses);
  return {
    eligibleAds: eligible.length,
    cohorts: cohorts.size,
    topPatterns: patterns.filter((item) => item.uses >= 3).slice(0, 8),
    weakPatterns: patterns.filter((item) => item.uses >= 3).sort((a, b) => a.averagePercentile - b.averagePercentile).slice(0, 5),
    methodology: "Associative cohort ranking by objective and format; never treated as causal proof. Minimum 1,000 impressions and positive spend."
  };
}

function buildPerformanceExemplars(ads) {
  return ads
    .filter((ad) => ad.performancePercentile >= 75 && (ad.creative.primaryText || ad.creative.headline))
    .sort((a, b) => b.performancePercentile - a.performancePercentile || b.metrics.impressions - a.metrics.impressions)
    .slice(0, 8)
    .map((ad) => ({
      adId: ad.id,
      objective: ad.objective,
      format: ad.creative.format,
      performancePercentile: ad.performancePercentile,
      impressions: ad.metrics.impressions,
      primaryText: ad.creative.primaryText.slice(0, 500),
      headline: ad.creative.headline.slice(0, 120),
      cardTitles: (Array.isArray(ad.creative.cards) ? ad.creative.cards : []).map((card) => card.title).filter(Boolean).slice(0, 10),
      features: ad.features
    }));
}

async function getAll(path, accessToken, params, maxRows = MAX_ADS) {
  const rows = [];
  let after = "";
  let pages = 0;
  do {
    const payload = await graphRequest(path, accessToken, { params: { ...params, ...(after ? { after } : {}) } });
    rows.push(...(Array.isArray(payload.data) ? payload.data : []));
    pages += 1;
    after = payload?.paging?.next ? String(payload?.paging?.cursors?.after || "") : "";
  } while (after && rows.length < maxRows);
  return { rows: rows.slice(0, maxRows), pages, truncated: rows.length >= maxRows };
}

async function getCreativesByIds(ids, accessToken) {
  const uniqueIds = [...new Set(ids.map(String).filter(Boolean))].slice(0, MAX_ADS);
  const rows = [];
  const batchSize = 40;
  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const batch = uniqueIds.slice(index, index + batchSize);
    const payload = await graphRequest("/", accessToken, {
      params: {
        ids: batch.join(","),
        fields: "id,name,thumbnail_url,image_url,image_hash,object_story_spec,asset_feed_spec"
      },
      maxRetries: 2
    });
    rows.push(...Object.values(payload || {}).filter((item) => item && !item.error));
  }
  return { rows, ids: uniqueIds.length, batches: Math.ceil(uniqueIds.length / batchSize) };
}

function dateRange(days = DEFAULT_DAYS) {
  const safeDays = Math.max(30, Math.min(730, Number(days) || DEFAULT_DAYS));
  const until = new Date();
  const since = new Date(until.getTime() - safeDays * 86400000);
  return { days: safeDays, since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

async function syncHistoricalIntelligence({ accountId, accessToken, days = DEFAULT_DAYS }) {
  const normalizedId = ensureAccountId(accountId);
  const range = dateRange(days);
  const [adResponse, insightResponse] = await Promise.all([
    getAll(`/${normalizedId}/ads`, accessToken, {
      limit: "200",
      fields: "id,name,status,effective_status,created_time,updated_time,campaign{id,name,objective},adset{id,name},creative{id,name}"
    }),
    getAll(`/${normalizedId}/insights`, accessToken, {
      level: "ad",
      time_range: JSON.stringify({ since: range.since, until: range.until }),
      limit: "500",
      fields: "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend,impressions,reach,inline_link_clicks,inline_link_click_ctr,cpc,cpm,actions,action_values,purchase_roas,website_purchase_roas"
    })
  ]);
  const insights = new Map(insightResponse.rows.map((row) => [String(row.ad_id || ""), row]));
  const creativeResponse = await getCreativesByIds(
    adResponse.rows
      .filter((row) => insights.has(String(row.id || "")))
      .map((row) => row.creative?.id),
    accessToken
  );
  const creatives = new Map(creativeResponse.rows.map((row) => [String(row.id || ""), row]));
  const ads = adResponse.rows.map((row) => {
    const ad = {
      id: String(row.id || ""),
      name: String(row.name || ""),
      status: String(row.effective_status || row.status || ""),
      createdAt: String(row.created_time || ""),
      updatedAt: String(row.updated_time || ""),
      campaignId: String(row.campaign?.id || ""),
      campaignName: String(row.campaign?.name || ""),
      objective: String(row.campaign?.objective || "UNKNOWN"),
      adSetId: String(row.adset?.id || ""),
      adSetName: String(row.adset?.name || ""),
      creative: extractCreative(creatives.get(String(row.creative?.id || "")) || row.creative || {}),
      metrics: metricRow(insights.get(String(row.id || "")) || {})
    };
    ad.features = inferFeatures(ad);
    return ad;
  });
  const dna = buildCreativeDna(ads);
  dna.exemplars = buildPerformanceExemplars(ads);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "meta-marketing-api-read-only",
    range,
    coverage: {
      ads: ads.length,
      adsWithInsights: ads.filter((ad) => ad.metrics.impressions > 0).length,
      adsWithReadableCopy: ads.filter((ad) => ad.creative.primaryText || ad.creative.headline).length,
      adPages: adResponse.pages,
      creativeIds: creativeResponse.ids,
      creativeBatches: creativeResponse.batches,
      insightPages: insightResponse.pages,
      truncated: adResponse.truncated || insightResponse.truncated
    },
    dna,
    ads
  };
}

function buildMetaIntelligencePromptBlock(snapshot) {
  if (!snapshot?.dna) return "Meta Historical Intelligence: no historical learning snapshot is available yet.";
  const compact = {
    range: snapshot.range,
    coverage: snapshot.coverage,
    topPatterns: snapshot.dna.topPatterns,
    weakPatterns: snapshot.dna.weakPatterns,
    exemplars: snapshot.dna.exemplars,
    methodology: snapshot.dna.methodology
  };
  return `Meta Historical Intelligence (performance associations, not causal facts): ${JSON.stringify(compact)}`;
}

module.exports = {
  buildCreativeDna,
  buildPerformanceExemplars,
  buildMetaIntelligencePromptBlock,
  dateRange,
  extractCreative,
  inferFeatures,
  metricRow,
  syncHistoricalIntelligence
};
