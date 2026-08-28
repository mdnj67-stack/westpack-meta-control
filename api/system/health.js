const { getConfig } = require("../../server/lib/config");
const { isAuthenticated, isAuthEnabled, requireAuth } = require("../../server/lib/auth");
const { sendJson } = require("../../server/lib/http");

function parseMarkets(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const config = getConfig();
  if (!requireAuth(req, res, config)) {
    return;
  }

  const markets = parseMarkets(config.klaviyoMarketsJson);
  const configuredMarketCodes = markets
    .map((market) => String(market?.country || "").trim().toUpperCase())
    .filter(Boolean);

  sendJson(res, 200, {
    ok: true,
    timestamp: new Date().toISOString(),
    auth: {
      enabled: isAuthEnabled(config),
      authenticated: isAuthenticated(req, config),
      hasDedicatedSessionSecret: Boolean(config.authSessionSecret)
    },
    integrations: {
      openai: {
        configured: Boolean(config.openAiApiKey),
        model: config.openAiModel || ""
      },
      meta: {
        configured: Boolean(config.metaAccessToken && config.metaAdAccountId),
        hasAccessToken: Boolean(config.metaAccessToken),
        hasAdAccountId: Boolean(config.metaAdAccountId),
        hasAppId: Boolean(config.metaAppId)
      },
      asana: {
        configured: Boolean(config.asanaAccessToken),
        hasCampaignProject: Boolean(config.asanaCampaignProjectGid),
        hasContentProject: Boolean(config.asanaContentProjectGid)
      },
      klaviyo: {
        configured: configuredMarketCodes.length > 0,
        marketCount: configuredMarketCodes.length,
        markets: configuredMarketCodes
      }
    }
  });
};
