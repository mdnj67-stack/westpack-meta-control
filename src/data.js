import metaLiveSnapshot from "../data/meta-live.js";
import aiPreviewSnapshot from "../data/ai-preview.js";
import klaviyoLiveSnapshot from "../data/klaviyo-live.js";

export const META_SNAPSHOT_SCHEMA_VERSION = 1;

export function isUsableMetaSnapshotBundle(snapshot = null, options = {}) {
  const requireDashboardMetrics = options.requireDashboardMetrics !== false;
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  if (Number(snapshot.schemaVersion || 0) < META_SNAPSHOT_SCHEMA_VERSION) {
    return false;
  }

  if (!Array.isArray(snapshot.campaigns) || !Array.isArray(snapshot.ads) || !Array.isArray(snapshot.adSets)) {
    return false;
  }

  if (!snapshot.scope || !snapshot.scope.label) {
    return false;
  }

  const firstCampaign = snapshot.campaigns[0] || {};
  const hasModernMetrics = [
    "spend_value",
    "impressions_value",
    "reach_value",
    "clicks_value",
    "ctr_value"
  ].every((key) => Object.prototype.hasOwnProperty.call(firstCampaign, key));

  if (!hasModernMetrics) {
    return false;
  }

  if (!requireDashboardMetrics) {
    return true;
  }

  const hasModernStats = Array.isArray(snapshot.stats)
    && snapshot.stats.some((item) => String(item?.label || "").includes("Spend ("));
  const incrementalStats = snapshot.dashboard?.statsByLens?.conversion_incremental || [];
  const hasChangeMetrics = Array.isArray(incrementalStats)
    && incrementalStats.some((item) => item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, "change"));
  const hasCurrency = Boolean(
    snapshot.account?.currency
    || snapshot.dashboard?.currency
    || firstCampaign.currency
  );

  return hasModernStats && hasChangeMetrics && hasCurrency;
}

export const integrationConfig = {
  openAi: {
    status: "Live preview route ready",
    model: "gpt-4.1",
    purpose: "Translate, adapt, tighten, and variant-generate ad copy"
  },
  metaApi: {
    status: "Auth needed",
    mode: "Active campaigns only",
    writeActions: [
      "Create ad",
      "Duplicate ad",
      "Pause or enable ad",
      "Update campaign budget"
    ]
  },
  safeguard: {
    status: "Preview-first",
    purpose: "No change should go live before approval in the UI"
  }
};

export const promptRecipe = [
  {
    title: "Role",
    body: "Act as a Westpack-specific Meta ad operator that prioritizes B2B retail buyers, strong hooks, concrete product value, and real Meta best practice."
  },
  {
    title: "Inputs",
    body: "Use the product context, uploaded creatives, operator note, destination setup, and Westpack claim rules before writing anything."
  },
  {
    title: "Output",
    body: "Return sharp primary text, a compact headline, a supporting description, card copy when needed, and a rationale tied to the right Westpack USP."
  },
  {
    title: "Guardrail",
    body: "Do not publish automatically. No free logo print outside jewellery-box context, and no FSC or environmental claims unless explicitly requested."
  }
];

export const adaptationGoals = [
  "Translate and keep structure",
  "Translate and tighten copy",
  "Translate and generate 3 variants"
];

export const stats = [
  { label: "Active campaigns", value: "6", meta: "Live scope only" },
  { label: "Spend last 7 days", value: "EUR 8.4k", meta: "Across active campaigns" },
  { label: "Average ROAS", value: "3.7", meta: "Current live account view" },
  { label: "Ads ready to clone", value: "14", meta: "Strong candidates for reuse" }
];

export const campaigns = [
  { id: "campaign-001", name: "Jewelry Boxes | DE | Prospecting", market: "Germany", spend: "EUR 2,320", roas: "4.4", ctr: "2.8%", status: "Healthy" },
  { id: "campaign-002", name: "Gift Packaging | DK | Retail", market: "Denmark", spend: "EUR 1,120", roas: "3.9", ctr: "2.3%", status: "Healthy" },
  { id: "campaign-003", name: "Luxury Bags | SE | Prospecting", market: "Sweden", spend: "EUR 1,480", roas: "3.4", ctr: "1.9%", status: "Watch" },
  { id: "campaign-004", name: "Easter Bags | NL | Seasonal", market: "Netherlands", spend: "EUR 960", roas: "2.7", ctr: "1.6%", status: "Watch" },
  { id: "campaign-005", name: "Ribbon Upsell | UK | Remarketing", market: "United Kingdom", spend: "EUR 1,610", roas: "4.9", ctr: "3.2%", status: "Healthy" }
];

export const recommendations = [
  {
    title: "Move the German winner into Sweden",
    body: "The best click-through pattern comes from the DE jewelry box ad. Clone it into the Swedish prospecting campaign and tighten the headline around premium retail presentation."
  },
  {
    title: "Refresh the seasonal creative before fatigue deepens",
    body: "The Easter campaign is showing lower CTR and weaker engagement. Replace the first frame and relaunch with shorter copy before spend ramps again."
  },
  {
    title: "Protect the UK remarketing winner",
    body: "Current ROAS is strongest here. Duplicate the ad with one controlled headline test instead of rebuilding the full message."
  }
];

export const patterns = [
  {
    title: "Premium detail shots win attention",
    body: "Close-up visuals of materials, finishes, and presentation details are consistently stronger than generic product-only layouts."
  },
  {
    title: "Retail-focused B2B language performs better",
    body: "Copy is stronger when it speaks to store experience, display value, and premium perception rather than end-customer emotion."
  },
  {
    title: "Shorter headlines hold up across markets",
    body: "Compact benefit-led headlines are more resilient when localizing into German and Scandinavian markets."
  }
];

export const queue = [
  {
    title: "Swedish relaunch draft prepared",
    body: "German winner adapted into Luxury Bags | SE | Prospecting with a shorter headline and premium retail framing."
  },
  {
    title: "Budget increase waiting for approval",
    body: "UK remarketing campaign flagged for a +15% increase because ROAS is stable and conversion intent remains strong."
  },
  {
    title: "Seasonal fatigue refresh staged",
    body: "New Easter creative package is ready to replace the current ad once you approve the refresh."
  }
];

export const auditLog = [
  {
    title: "Drafted Swedish relaunch from German winner",
    body: "Prepared a localized version for Luxury Bags | SE | Prospecting and kept the premium value angle.",
    time: "10 minutes ago"
  },
  {
    title: "Flagged seasonal campaign for refresh",
    body: "CTR dropped below the stronger account baseline, so a copy and creative refresh was suggested.",
    time: "32 minutes ago"
  },
  {
    title: "Queued budget increase for UK remarketing",
    body: "Recommendation staged but not published pending operator approval.",
    time: "1 hour ago"
  }
];

export const adSets = [
  {
    id: "adset-001",
    name: "DE Prospecting",
    campaignId: "campaign-001",
    campaignName: "Jewelry Boxes | DE | Prospecting",
    status: "ACTIVE"
  },
  {
    id: "adset-002",
    name: "DK Retail",
    campaignId: "campaign-002",
    campaignName: "Gift Packaging | DK | Retail",
    status: "ACTIVE"
  },
  {
    id: "adset-003",
    name: "UK Remarketing",
    campaignId: "campaign-005",
    campaignName: "Ribbon Upsell | UK | Remarketing",
    status: "ACTIVE"
  }
];

export const ads = [
  {
    id: "ad-001",
    name: "Premium Jewelry Boxes | DE Winner",
    campaign: "Jewelry Boxes | DE | Prospecting",
    adset: "DE Prospecting",
    primary: "Premium jewelry packaging that makes every unboxing feel worth remembering.",
    headline: "Packaging That Elevates Perceived Value",
    description: "Built for retailers that want premium presentation."
  },
  {
    id: "ad-002",
    name: "Gift Bag Spring Push | DK",
    campaign: "Gift Packaging | DK | Retail",
    adset: "DK Retail",
    primary: "Upgrade your in-store gifting experience with packaging customers actually notice.",
    headline: "Elegant Gift Packaging for Retail",
    description: "Designed for stores that sell presentation."
  },
  {
    id: "ad-003",
    name: "Ribbon Upsell Remarketing | UK",
    campaign: "Ribbon Upsell | UK | Remarketing",
    adset: "UK Remarketing",
    primary: "Add the finishing touch with premium ribbons and accessories matched to your packaging line.",
    headline: "The Detail That Completes the Sale",
    description: "Upsell-ready finishing details."
  }
];

export const quickActions = [
  {
    title: "Pause ad",
    body: "Pause a live ad directly after the Meta write connection is added."
  },
  {
    title: "Duplicate into active ad set",
    body: "Reuse a proven ad setup without rebuilding every field manually."
  },
  {
    title: "Adjust budget",
    body: "Apply recommended campaign or ad set budget changes after review."
  },
  {
    title: "Refresh copy only",
    body: "Keep the same creative and CTA while launching a localized or shorter copy version."
  }
];

export const campaignMatches = [
  {
    title: "Best fit: Luxury Bags | SE | Prospecting",
    body: "Closest match for premium positioning, visual style, and current CTR opportunity.",
    reason: "High overlap in creative language and active-market need."
  },
  {
    title: "Secondary fit: Gift Packaging | DK | Retail",
    body: "Could reuse the structure with lighter copy and stronger retail-display language.",
    reason: "Good fit if you want a faster same-region relaunch."
  },
  {
    title: "Do not move into Easter Bags | NL | Seasonal",
    body: "Campaign intent and seasonal framing are too different from the selected source ad.",
    reason: "Would need a dedicated seasonal rewrite instead of a clone."
  }
];

export const previewTemplate = {
  source: "Premium Jewelry Boxes | DE Winner",
  targetCampaign: "Luxury Bags | SE | Prospecting",
  targetLanguage: "Swedish",
  primaryText: "Premium packaging that lifts the buying experience before the product is even opened.",
  headline: "Packaging That Raises Perceived Value",
  description: "Built for retailers that want a premium finish.",
  rationale: "This keeps the B2B tone, preserves the premium value angle, and shortens the message to fit the stronger patterns seen in active campaigns."
};

export const klaviyoMarkets = [
  "CZ", "DE", "DK", "ES", "EU", "FI", "FR", "HU", "IT",
  "NL", "NO", "PL", "PT", "RO", "SE", "SK", "UK", "US"
];

export const klaviyoCampaignGroups = [
  {
    campaignName: "W15: Forarsprodukter | 2026",
    lastSent: "2026-04-14T08:30:00Z",
    aiSummary: "Strong total reach and revenue, but DE and FR pulled open rate below the Nordic average.",
    markets: [
      { country: "DK", sent: 16840, openRate: 56.2, clickRate: 5.4, revenue: 41220, unsubRate: 0.12, sendTime: "2026-04-14T07:55:00Z", status: "sent" },
      { country: "SE", sent: 14960, openRate: 54.7, clickRate: 5.1, revenue: 35210, unsubRate: 0.14, sendTime: "2026-04-14T08:05:00Z", status: "sent" },
      { country: "NO", sent: 11890, openRate: 55.4, clickRate: 5.6, revenue: 29110, unsubRate: 0.13, sendTime: "2026-04-14T08:12:00Z", status: "sent" },
      { country: "DE", sent: 21480, openRate: 47.8, clickRate: 4.0, revenue: 33240, unsubRate: 0.21, sendTime: "2026-04-14T08:18:00Z", status: "sent" },
      { country: "FR", sent: 12600, openRate: 45.9, clickRate: 3.8, revenue: 17350, unsubRate: 0.26, sendTime: "2026-04-14T08:22:00Z", status: "sent" },
      { country: "NL", sent: 10220, openRate: 49.3, clickRate: 4.3, revenue: 16780, unsubRate: 0.16, sendTime: "2026-04-14T08:25:00Z", status: "sent" },
      { country: "UK", sent: 13910, openRate: 51.6, clickRate: 4.9, revenue: 27850, unsubRate: 0.18, sendTime: "2026-04-14T08:29:00Z", status: "sent" },
      { country: "US", sent: 19100, openRate: 50.2, clickRate: 4.4, revenue: 38460, unsubRate: 0.19, sendTime: "2026-04-14T08:30:00Z", status: "sent" },
      { country: "CZ", sent: 5220, openRate: 48.5, clickRate: 3.7, revenue: 6230, unsubRate: 0.17, sendTime: "2026-04-14T08:10:00Z", status: "sent" },
      { country: "ES", sent: 9020, openRate: 50.1, clickRate: 4.1, revenue: 12440, unsubRate: 0.17, sendTime: "2026-04-14T08:11:00Z", status: "sent" },
      { country: "EU", sent: 6800, openRate: 51.4, clickRate: 4.8, revenue: 9360, unsubRate: 0.16, sendTime: "2026-04-14T08:09:00Z", status: "sent" },
      { country: "FI", sent: 5940, openRate: 52.9, clickRate: 4.9, revenue: 10180, unsubRate: 0.12, sendTime: "2026-04-14T08:06:00Z", status: "sent" },
      { country: "HU", sent: 4380, openRate: 46.2, clickRate: 3.6, revenue: 4710, unsubRate: 0.18, sendTime: "2026-04-14T08:07:00Z", status: "sent" },
      { country: "IT", sent: 8740, openRate: 48.8, clickRate: 4.0, revenue: 12760, unsubRate: 0.17, sendTime: "2026-04-14T08:13:00Z", status: "sent" },
      { country: "PL", sent: 8220, openRate: 47.2, clickRate: 3.9, revenue: 9880, unsubRate: 0.18, sendTime: "2026-04-14T08:15:00Z", status: "sent" },
      { country: "PT", sent: 4190, openRate: 49.8, clickRate: 4.1, revenue: 5210, unsubRate: 0.15, sendTime: "2026-04-14T08:17:00Z", status: "sent" },
      { country: "RO", sent: 3980, openRate: 45.1, clickRate: 3.5, revenue: 3890, unsubRate: 0.2, sendTime: "2026-04-14T08:20:00Z", status: "sent" },
      { country: "SK", sent: 3110, openRate: 47.5, clickRate: 3.4, revenue: 3440, unsubRate: 0.16, sendTime: "2026-04-14T08:24:00Z", status: "sent" }
    ]
  },
  {
    campaignName: "W14: Paaskevarer | 2026",
    lastSent: "2026-04-07T09:10:00Z",
    aiSummary: "Open rate held up, but unsubscribers spiked in UK and DE compared with the last four campaign families.",
    markets: [
      { country: "DK", sent: 17010, openRate: 57.4, clickRate: 4.8, revenue: 36620, unsubRate: 0.11, sendTime: "2026-04-07T08:42:00Z", status: "sent" },
      { country: "SE", sent: 15120, openRate: 55.8, clickRate: 4.5, revenue: 31040, unsubRate: 0.13, sendTime: "2026-04-07T08:45:00Z", status: "sent" },
      { country: "NO", sent: 11950, openRate: 56.0, clickRate: 4.9, revenue: 25440, unsubRate: 0.11, sendTime: "2026-04-07T08:47:00Z", status: "sent" },
      { country: "DE", sent: 21800, openRate: 49.1, clickRate: 3.9, revenue: 28110, unsubRate: 0.29, sendTime: "2026-04-07T08:52:00Z", status: "sent" },
      { country: "FR", sent: 12180, openRate: 48.6, clickRate: 3.7, revenue: 15240, unsubRate: 0.23, sendTime: "2026-04-07T08:56:00Z", status: "sent" },
      { country: "NL", sent: 10020, openRate: 50.8, clickRate: 4.2, revenue: 14220, unsubRate: 0.15, sendTime: "2026-04-07T08:58:00Z", status: "sent" },
      { country: "UK", sent: 14110, openRate: 50.2, clickRate: 4.0, revenue: 21980, unsubRate: 0.31, sendTime: "2026-04-07T09:01:00Z", status: "sent" },
      { country: "US", sent: 19320, openRate: 51.8, clickRate: 4.2, revenue: 29680, unsubRate: 0.19, sendTime: "2026-04-07T09:10:00Z", status: "sent" },
      { country: "CZ", sent: 4880, openRate: 49.7, clickRate: 3.5, revenue: 5440, unsubRate: 0.16, sendTime: "2026-04-07T08:48:00Z", status: "sent" },
      { country: "ES", sent: 8720, openRate: 50.6, clickRate: 4.0, revenue: 11140, unsubRate: 0.17, sendTime: "2026-04-07T08:49:00Z", status: "sent" },
      { country: "EU", sent: 6610, openRate: 50.4, clickRate: 4.3, revenue: 8640, unsubRate: 0.15, sendTime: "2026-04-07T08:50:00Z", status: "sent" },
      { country: "FI", sent: 5790, openRate: 53.6, clickRate: 4.6, revenue: 9050, unsubRate: 0.12, sendTime: "2026-04-07T08:51:00Z", status: "sent" },
      { country: "HU", sent: 4210, openRate: 47.1, clickRate: 3.3, revenue: 4320, unsubRate: 0.19, sendTime: "2026-04-07T08:53:00Z", status: "sent" },
      { country: "IT", sent: 8610, openRate: 49.5, clickRate: 3.9, revenue: 11780, unsubRate: 0.18, sendTime: "2026-04-07T08:54:00Z", status: "sent" },
      { country: "PL", sent: 8060, openRate: 47.9, clickRate: 3.7, revenue: 8820, unsubRate: 0.2, sendTime: "2026-04-07T08:55:00Z", status: "sent" },
      { country: "PT", sent: 4020, openRate: 49.1, clickRate: 3.8, revenue: 4670, unsubRate: 0.16, sendTime: "2026-04-07T08:59:00Z", status: "sent" },
      { country: "RO", sent: 3890, openRate: 44.7, clickRate: 3.2, revenue: 3410, unsubRate: 0.21, sendTime: "2026-04-07T09:03:00Z", status: "sent" }
    ]
  },
  {
    campaignName: "W13: Food packaging picks | 2026",
    lastSent: "2026-03-30T10:05:00Z",
    aiSummary: "Revenue stayed strong in DK and US, but NO and SK are missing entirely and need an operational follow-up.",
    markets: [
      { country: "DK", sent: 16320, openRate: 55.1, clickRate: 5.7, revenue: 43820, unsubRate: 0.1, sendTime: "2026-03-30T09:31:00Z", status: "sent" },
      { country: "SE", sent: 14580, openRate: 53.4, clickRate: 5.0, revenue: 32120, unsubRate: 0.12, sendTime: "2026-03-30T09:34:00Z", status: "sent" },
      { country: "DE", sent: 21040, openRate: 48.0, clickRate: 4.3, revenue: 35890, unsubRate: 0.22, sendTime: "2026-03-30T09:37:00Z", status: "sent" },
      { country: "FR", sent: 11920, openRate: 46.8, clickRate: 4.0, revenue: 18020, unsubRate: 0.19, sendTime: "2026-03-30T09:40:00Z", status: "sent" },
      { country: "NL", sent: 9810, openRate: 50.7, clickRate: 4.5, revenue: 15870, unsubRate: 0.14, sendTime: "2026-03-30T09:44:00Z", status: "sent" },
      { country: "UK", sent: 13720, openRate: 50.9, clickRate: 4.8, revenue: 24980, unsubRate: 0.18, sendTime: "2026-03-30T09:48:00Z", status: "sent" },
      { country: "US", sent: 18840, openRate: 51.5, clickRate: 5.1, revenue: 41980, unsubRate: 0.17, sendTime: "2026-03-30T10:05:00Z", status: "sent" },
      { country: "CZ", sent: 4630, openRate: 48.6, clickRate: 3.8, revenue: 5710, unsubRate: 0.15, sendTime: "2026-03-30T09:35:00Z", status: "sent" },
      { country: "ES", sent: 8490, openRate: 49.8, clickRate: 4.1, revenue: 10920, unsubRate: 0.16, sendTime: "2026-03-30T09:36:00Z", status: "sent" },
      { country: "EU", sent: 6450, openRate: 50.2, clickRate: 4.6, revenue: 8410, unsubRate: 0.14, sendTime: "2026-03-30T09:39:00Z", status: "sent" },
      { country: "FI", sent: 5580, openRate: 52.7, clickRate: 4.7, revenue: 8920, unsubRate: 0.11, sendTime: "2026-03-30T09:41:00Z", status: "sent" },
      { country: "HU", sent: 4030, openRate: 46.4, clickRate: 3.5, revenue: 4210, unsubRate: 0.18, sendTime: "2026-03-30T09:43:00Z", status: "sent" },
      { country: "IT", sent: 8420, openRate: 48.9, clickRate: 4.2, revenue: 12140, unsubRate: 0.17, sendTime: "2026-03-30T09:46:00Z", status: "sent" },
      { country: "PL", sent: 7890, openRate: 47.0, clickRate: 3.8, revenue: 8640, unsubRate: 0.19, sendTime: "2026-03-30T09:49:00Z", status: "sent" },
      { country: "PT", sent: 3910, openRate: 48.8, clickRate: 3.9, revenue: 4510, unsubRate: 0.16, sendTime: "2026-03-30T09:52:00Z", status: "sent" },
      { country: "RO", sent: 3730, openRate: 44.2, clickRate: 3.4, revenue: 3280, unsubRate: 0.2, sendTime: "2026-03-30T09:55:00Z", status: "sent" }
    ]
  }
];

export const klaviyoInsightCards = [
  {
    title: "Protect the Nordic pattern",
    body: "DK, SE and NO consistently lead on opens and clicks. Reuse their subject-line structure as the default for the next campaign family."
  },
  {
    title: "DE and FR need copy review",
    body: "Both markets are dragging open rate across the last two sends. Start with a subject-line and preheader review before touching design."
  },
  {
    title: "Unsub risk is concentrated",
    body: "UK and DE are responsible for most unsubscribe pressure in W14. Check segment fatigue and offer repetition before the next push."
  }
];

export function loadLiveMetaSnapshot() {
  return isUsableMetaSnapshotBundle(metaLiveSnapshot) ? metaLiveSnapshot : null;
}

export function loadAiPreviewSnapshot() {
  if (!aiPreviewSnapshot) {
    return null;
  }

  return aiPreviewSnapshot;
}

export function loadLiveKlaviyoSnapshot() {
  if (!klaviyoLiveSnapshot) {
    return null;
  }

  if (!Array.isArray(klaviyoLiveSnapshot.campaignGroups)) {
    return null;
  }

  return klaviyoLiveSnapshot;
}
