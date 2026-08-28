const fs = require("fs");
const path = require("path");
const bundledKlaviyoConfig = require("./klaviyo-config");

function parseDotEnv(content = "") {
  return String(content || "")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      acc[key] = value.replace(/\\r\\n/g, "\n");
      return acc;
    }, {});
}

function readDotEnvFiles() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env.production"),
    path.join(process.cwd(), ".vercel.live.env")
  ];

  return candidates.reduce((acc, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return acc;
      }

      return {
        ...acc,
        ...parseDotEnv(fs.readFileSync(filePath, "utf8"))
      };
    } catch (error) {
      return acc;
    }
  }, {});
}

function readLocalSecrets() {
  const candidates = [
    path.join(process.cwd(), "secrets", "secrets..txt"),
    path.join(process.cwd(), "secrets", "secrets.json")
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
    } catch (error) {
      // Ignore local secret parsing problems and continue to env vars.
    }
  }

  return {};
}

function readKlaviyoConfig() {
  const configPath = path.join(process.cwd(), "klaviyo-config.json");
  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    return {};
  }
}

function normalizeExternalCredential(value = "") {
  return String(value || "").trim();
}

function getConfig() {
  const fileEnv = readDotEnvFiles();
  const localSecrets = readLocalSecrets();
  const localKlaviyoConfig = readKlaviyoConfig();
  const resolvedKlaviyoConfig = Array.isArray(localKlaviyoConfig?.markets) && localKlaviyoConfig.markets.length
    ? localKlaviyoConfig
    : bundledKlaviyoConfig;

  let klaviyoMarketsJson = process.env.KLAVIYO_MARKETS_JSON || fileEnv.KLAVIYO_MARKETS_JSON || localSecrets.klaviyoMarketsJson || "";
  if (!klaviyoMarketsJson && Array.isArray(localSecrets.klaviyoMarkets)) {
    try {
      klaviyoMarketsJson = JSON.stringify(localSecrets.klaviyoMarkets);
    } catch (error) {
      klaviyoMarketsJson = "";
    }
  }
  if (!klaviyoMarketsJson && Array.isArray(resolvedKlaviyoConfig.markets)) {
    try {
      klaviyoMarketsJson = JSON.stringify(resolvedKlaviyoConfig.markets);
    } catch (error) {
      klaviyoMarketsJson = "";
    }
  }

  return {
    openAiApiKey: process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY || localSecrets.openaiApiKey || "",
    openAiModel: process.env.OPENAI_MODEL || fileEnv.OPENAI_MODEL || "gpt-4.1",
    contentAgentModel: process.env.CONTENT_AGENT_MODEL || fileEnv.CONTENT_AGENT_MODEL || "gpt-5.6",
    contentQualityModel: process.env.CONTENT_QUALITY_MODEL || fileEnv.CONTENT_QUALITY_MODEL || "gpt-5.6",
    metaAccessToken: normalizeExternalCredential(process.env.META_ACCESS_TOKEN || fileEnv.META_ACCESS_TOKEN || localSecrets.metaAccessToken),
    metaAdAccountId: normalizeExternalCredential(process.env.META_AD_ACCOUNT_ID || fileEnv.META_AD_ACCOUNT_ID || localSecrets.metaAdAccountId),
    metaAppId: normalizeExternalCredential(process.env.META_APP_ID || fileEnv.META_APP_ID || localSecrets.metaAppId),
    asanaAccessToken: process.env.ASANA_ACCESS_TOKEN || fileEnv.ASANA_ACCESS_TOKEN || localSecrets.asanaAccessToken || "",
    asanaCampaignProjectGid: process.env.ASANA_CAMPAIGN_PROJECT_GID || fileEnv.ASANA_CAMPAIGN_PROJECT_GID || localSecrets.asanaCampaignProjectGid || "",
    asanaContentProjectGid: process.env.ASANA_CONTENT_PROJECT_GID || fileEnv.ASANA_CONTENT_PROJECT_GID || localSecrets.asanaContentProjectGid || "",
    cronSecret: process.env.CRON_SECRET || fileEnv.CRON_SECRET || localSecrets.cronSecret || "",
    authPassword: process.env.AUTH_PASSWORD || fileEnv.AUTH_PASSWORD || localSecrets.authPassword || "",
    authSessionSecret: process.env.AUTH_SESSION_SECRET || fileEnv.AUTH_SESSION_SECRET || localSecrets.authSessionSecret || "",
    klaviyoMarketsJson,
    klaviyoCountryCurrenciesJson: process.env.KLAVIYO_COUNTRY_CURRENCIES_JSON || fileEnv.KLAVIYO_COUNTRY_CURRENCIES_JSON || localSecrets.klaviyoCountryCurrenciesJson || (resolvedKlaviyoConfig.countryCurrencies ? JSON.stringify(resolvedKlaviyoConfig.countryCurrencies) : ""),
    klaviyoFxRatesToDkkJson: process.env.KLAVIYO_FX_RATES_TO_DKK_JSON || fileEnv.KLAVIYO_FX_RATES_TO_DKK_JSON || localSecrets.klaviyoFxRatesToDkkJson || (resolvedKlaviyoConfig.fxRatesToDkk ? JSON.stringify(resolvedKlaviyoConfig.fxRatesToDkk) : ""),
    klaviyoFxSource: process.env.KLAVIYO_FX_SOURCE || fileEnv.KLAVIYO_FX_SOURCE || localSecrets.klaviyoFxSource || resolvedKlaviyoConfig.fxSource || "",
    klaviyoFxReferenceDate: process.env.KLAVIYO_FX_REFERENCE_DATE || fileEnv.KLAVIYO_FX_REFERENCE_DATE || localSecrets.klaviyoFxReferenceDate || resolvedKlaviyoConfig.fxReferenceDate || "",
    klaviyoRevision: process.env.KLAVIYO_REVISION || fileEnv.KLAVIYO_REVISION || localSecrets.klaviyoRevision || resolvedKlaviyoConfig.revision || "2024-10-15",
    klaviyoTimeframeDays: Number(process.env.KLAVIYO_TIMEFRAME_DAYS || fileEnv.KLAVIYO_TIMEFRAME_DAYS || localSecrets.klaviyoTimeframeDays || resolvedKlaviyoConfig.timeframeDays || 30)
  };
}

module.exports = {
  getConfig,
  normalizeExternalCredential
};
