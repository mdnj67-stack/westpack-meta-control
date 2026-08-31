// Real per-market Klaviyo list IDs and private keys must never live in source code -
// they are supplied at runtime via the KLAVIYO_MARKETS_JSON environment variable (see
// server/lib/config.js) or a local, gitignored klaviyo-config.json for development.
// This bundled fallback intentionally carries no credentials.
module.exports = {
  revision: "2024-10-15",
  timeframeDays: 30,
  markets: []
};
