// Browser-side mirror of the objective grouping in server/meta/budget-allocation.js.
//
// The two files must stay in lockstep: tests/meta-objective-group-parity.test.js parses
// this module and compares its table against the server module, so a change here without
// the matching server change fails the suite.
//
// Budget maths deliberately does NOT live here. Budget amounts arrive from Meta in minor
// currency units and are normalised once, on the server, before they reach the client.
// The client renders `quality.budgetAllocation` or renders nothing, so there is exactly
// one place that can get the magnitude wrong.

export const OBJECTIVE_GROUP_BY_OBJECTIVE = new Map([
  ["OUTCOME_AWARENESS", "awareness"],
  ["AWARENESS", "awareness"],
  ["BRAND_AWARENESS", "awareness"],
  ["REACH", "awareness"],
  ["VIDEO_VIEWS", "awareness"],
  ["THRUPLAY", "awareness"],

  ["OUTCOME_TRAFFIC", "traffic"],
  ["TRAFFIC", "traffic"],
  ["LINK_CLICKS", "traffic"],

  ["OUTCOME_ENGAGEMENT", "engagement"],
  ["ENGAGEMENT", "engagement"],
  ["POST_ENGAGEMENT", "engagement"],
  ["PAGE_LIKES", "engagement"],
  ["EVENT_RESPONSES", "engagement"],

  ["OUTCOME_LEADS", "leads"],
  ["LEAD_GENERATION", "leads"],
  ["MESSAGES", "leads"],

  ["OUTCOME_SALES", "conversion"],
  ["CONVERSIONS", "conversion"],
  ["CATALOG_SALES", "conversion"],
  ["PRODUCT_CATALOG_SALES", "conversion"],
  ["STORE_VISITS", "conversion"],

  ["OUTCOME_APP_PROMOTION", "app_promotion"],
  ["APP_INSTALLS", "app_promotion"]
]);

// Canonical set of groups. Used for iteration and reconciliation - this is Meta's funnel
// order and is not what the dashboard renders.
export const OBJECTIVE_GROUP_ORDER = [
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "conversion",
  "app_promotion",
  "unclassified"
];

// Render order. Awareness and conversion are the pair the marketing team compares day to
// day, so they sit next to each other at the top, and "unclassified" always sorts last.
export const OBJECTIVE_GROUP_DISPLAY_ORDER = [
  "awareness",
  "conversion",
  "leads",
  "traffic",
  "engagement",
  "app_promotion",
  "unclassified"
];

export const OBJECTIVE_GROUP_LABELS = {
  awareness: "Brand Awareness",
  traffic: "Traffic",
  engagement: "Engagement",
  leads: "Leads",
  conversion: "Conversion",
  app_promotion: "App Promotion",
  unclassified: "Unclassified"
};

export const LENS_BY_OBJECTIVE_GROUP = {
  awareness: "awareness",
  leads: "leads",
  conversion: "conversion"
};

export function isObjectiveGroup(value) {
  return OBJECTIVE_GROUP_ORDER.includes(String(value || ""));
}

// Strictly Meta's objective field. An unrecognised or missing objective becomes
// "unclassified" so unmapped spend stays visible instead of inflating awareness.
export function resolveObjectiveGroup(campaign) {
  const explicit = String(campaign?.objective_group || campaign?.category || campaign?.lens || "").trim().toLowerCase();
  if (isObjectiveGroup(explicit)) {
    return explicit;
  }

  const objective = String(campaign?.objective || "").trim().toUpperCase();
  if (!objective) {
    return "unclassified";
  }

  return OBJECTIVE_GROUP_BY_OBJECTIVE.get(objective) || "unclassified";
}

export function resolveObjectiveGroupLabel(group) {
  return OBJECTIVE_GROUP_LABELS[String(group || "")] || OBJECTIVE_GROUP_LABELS.unclassified;
}

export function resolveLensForObjectiveGroup(group) {
  return LENS_BY_OBJECTIVE_GROUP[String(group || "")] || "";
}

export function classifyCampaign(campaign) {
  return resolveObjectiveGroup(campaign);
}

// One bucket per objective group. Reads of `.awareness`, `.leads` and `.conversion` work
// exactly as they did with the previous three-bucket version.
export function splitByCategory(campaigns) {
  const buckets = {};
  for (const group of OBJECTIVE_GROUP_ORDER) {
    buckets[group] = [];
  }

  for (const campaign of campaigns || []) {
    buckets[resolveObjectiveGroup(campaign)].push(campaign);
  }

  return buckets;
}
