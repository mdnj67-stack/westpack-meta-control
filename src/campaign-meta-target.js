const BLOCKED_STATUSES = new Set(["ARCHIVED", "DELETED"]);

function normalizeStatus(value = "") {
  return String(value || "").trim().toUpperCase();
}

function compareByDeliveryThenName(left, right) {
  const leftActive = normalizeStatus(left?.status) === "ACTIVE" ? 0 : 1;
  const rightActive = normalizeStatus(right?.status) === "ACTIVE" ? 0 : 1;
  return leftActive - rightActive || String(left?.name || "").localeCompare(String(right?.name || ""), "da");
}

function isUsableTarget(item = {}) {
  return Boolean(String(item?.id || "").trim() && String(item?.name || "").trim())
    && !BLOCKED_STATUSES.has(normalizeStatus(item?.status));
}

export function buildCampaignMetaTargetModel({ campaigns = [], adSets = [], config = {}, loading = false } = {}) {
  const campaignOptions = campaigns
    .filter(isUsableTarget)
    .map((campaign) => ({
      id: String(campaign.id),
      name: String(campaign.name),
      status: normalizeStatus(campaign.status) || "UNKNOWN"
    }))
    .sort(compareByDeliveryThenName);

  const requestedCampaignId = String(config?.targetCampaignId || "");
  const selectedCampaign = campaignOptions.find((campaign) => campaign.id === requestedCampaignId) || null;
  const adSetOptions = selectedCampaign
    ? adSets
        .filter((adSet) => isUsableTarget(adSet) && String(adSet?.campaignId || "") === selectedCampaign.id)
        .map((adSet) => ({
          id: String(adSet.id),
          name: String(adSet.name),
          status: normalizeStatus(adSet.status) || "UNKNOWN",
          campaignId: String(adSet.campaignId)
        }))
        .sort(compareByDeliveryThenName)
    : [];
  const requestedAdSetId = String(config?.targetAdSetId || "");
  const selectedAdSet = adSetOptions.find((adSet) => adSet.id === requestedAdSetId) || null;
  const hasManualTarget = Boolean(requestedCampaignId && requestedAdSetId);

  let state = "empty";
  let message = "Connect Meta to load publication destinations.";
  if (loading) {
    state = "loading";
    message = "Loading live Meta destinations...";
  } else if (hasManualTarget && (!selectedCampaign || !selectedAdSet)) {
    state = "manual_ready";
    message = "Manual campaign and ad set IDs are ready for validation.";
  } else if (campaignOptions.length && !selectedCampaign) {
    state = "campaign_required";
    message = "Choose the campaign this creative belongs in.";
  } else if (selectedCampaign && !adSetOptions.length) {
    state = "no_adsets";
    message = "This campaign has no available ad sets.";
  } else if (selectedCampaign && !selectedAdSet) {
    state = "adset_required";
    message = "Choose the audience and delivery setup.";
  } else if (selectedCampaign && selectedAdSet) {
    state = "ready";
    message = `Ready for ${selectedCampaign.name} / ${selectedAdSet.name}.`;
  }

  return {
    campaignOptions,
    adSetOptions,
    selectedCampaign,
    selectedAdSet,
    state,
    message,
    ready: state === "ready" || state === "manual_ready"
  };
}

export function selectCampaignMetaTarget({ campaigns = [], adSets = [], campaignId = "", adSetId = "" } = {}) {
  const campaign = campaigns.find((item) => String(item?.id || "") === String(campaignId || "")) || null;
  const availableAdSets = campaign
    ? adSets.filter((item) => String(item?.campaignId || "") === String(campaign.id || "") && isUsableTarget(item))
    : [];
  const adSet = availableAdSets.find((item) => String(item?.id || "") === String(adSetId || "")) || null;

  return {
    targetCampaignId: String(campaign?.id || ""),
    targetCampaignName: String(campaign?.name || ""),
    targetAdSetId: String(adSet?.id || ""),
    targetAdSetName: String(adSet?.name || "")
  };
}
