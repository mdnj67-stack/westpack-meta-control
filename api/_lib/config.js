const fs = require("fs");
const path = require("path");

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

function getConfig() {
  const localSecrets = readLocalSecrets();

  return {
    openAiApiKey: process.env.OPENAI_API_KEY || localSecrets.openaiApiKey || "",
    openAiModel: process.env.OPENAI_MODEL || "gpt-4.1",
    metaAccessToken: process.env.META_ACCESS_TOKEN || localSecrets.metaAccessToken || "",
    metaAdAccountId: process.env.META_AD_ACCOUNT_ID || localSecrets.metaAdAccountId || "",
    metaAppId: process.env.META_APP_ID || localSecrets.metaAppId || ""
  };
}

module.exports = {
  getConfig
};
