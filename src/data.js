import metaLiveSnapshot from "../data/meta-live.js";
import aiPreviewSnapshot from "../data/ai-preview.js";

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
    body: "Act as a Westpack-specific Meta ad operator that prioritizes B2B retail buyers, premium packaging language, and active account learnings."
  },
  {
    title: "Inputs",
    body: "Use the source ad, chosen target campaign, target language, uploaded creatives, and operator note before writing anything."
  },
  {
    title: "Output",
    body: "Return primary text, headline, description, CTA guidance, variant suggestions, and a short rationale for each decision."
  },
  {
    title: "Guardrail",
    body: "Do not publish automatically. Always prepare previewable output for operator approval."
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
  { name: "Jewelry Boxes | DE | Prospecting", market: "Germany", spend: "EUR 2,320", roas: "4.4", ctr: "2.8%", status: "Healthy" },
  { name: "Gift Packaging | DK | Retail", market: "Denmark", spend: "EUR 1,120", roas: "3.9", ctr: "2.3%", status: "Healthy" },
  { name: "Luxury Bags | SE | Prospecting", market: "Sweden", spend: "EUR 1,480", roas: "3.4", ctr: "1.9%", status: "Watch" },
  { name: "Easter Bags | NL | Seasonal", market: "Netherlands", spend: "EUR 960", roas: "2.7", ctr: "1.6%", status: "Watch" },
  { name: "Ribbon Upsell | UK | Remarketing", market: "United Kingdom", spend: "EUR 1,610", roas: "4.9", ctr: "3.2%", status: "Healthy" }
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

export const ads = [
  {
    id: "ad-001",
    name: "Premium Jewelry Boxes | DE Winner",
    campaign: "Jewelry Boxes | DE | Prospecting",
    primary: "Premium jewelry packaging that makes every unboxing feel worth remembering.",
    headline: "Packaging That Elevates Perceived Value",
    description: "Built for retailers that want premium presentation."
  },
  {
    id: "ad-002",
    name: "Gift Bag Spring Push | DK",
    campaign: "Gift Packaging | DK | Retail",
    primary: "Upgrade your in-store gifting experience with packaging customers actually notice.",
    headline: "Elegant Gift Packaging for Retail",
    description: "Designed for stores that sell presentation."
  },
  {
    id: "ad-003",
    name: "Ribbon Upsell Remarketing | UK",
    campaign: "Ribbon Upsell | UK | Remarketing",
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

export function loadLiveMetaSnapshot() {
  if (!metaLiveSnapshot) {
    return null;
  }

  if (!Array.isArray(metaLiveSnapshot.campaigns) || !Array.isArray(metaLiveSnapshot.ads)) {
    return null;
  }

  return metaLiveSnapshot;
}

export function loadAiPreviewSnapshot() {
  if (!aiPreviewSnapshot) {
    return null;
  }

  return aiPreviewSnapshot;
}
