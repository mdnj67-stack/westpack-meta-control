export function getAdSetOptions(campaignName, campaignId, adSets = []) {
  const requestedCampaignId = String(campaignId || "").trim();
  const requestedCampaignName = String(campaignName || "").trim().toLocaleLowerCase();
  const filtered = (Array.isArray(adSets) ? adSets : []).filter((adSet) => {
    const adSetCampaignId = String(adSet?.campaignId || adSet?.campaign_id || "").trim();
    const adSetCampaignName = String(adSet?.campaignName || adSet?.campaign_name || "").trim().toLocaleLowerCase();
    if (requestedCampaignId && adSetCampaignId) {
      return adSetCampaignId === requestedCampaignId;
    }
    return Boolean(requestedCampaignName) && adSetCampaignName === requestedCampaignName;
  });

  if (!filtered.length) {
    return [{ id: "", name: "No ad set found" }];
  }

  return filtered.map((adSet) => ({
    id: String(adSet?.id || ""),
    name: String(adSet?.name || "")
  }));
}
