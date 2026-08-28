const { getConfig } = require("../server/lib/config");
const { syncHistoricalIntelligence } = require("../server/meta/historical-intelligence");
const { getHistoricalStoreProfile, writeHistoricalIntelligence } = require("../server/meta/historical-store");

async function run() {
  const config = getConfig();
  if (!config.metaAdAccountId || !config.metaAccessToken) throw new Error("Meta connection is not configured.");
  const days = process.argv[2] || 365;
  const snapshot = await syncHistoricalIntelligence({
    accountId: config.metaAdAccountId,
    accessToken: config.metaAccessToken,
    days
  });
  await writeHistoricalIntelligence(snapshot);
  console.log(JSON.stringify({
    ok: true,
    store: getHistoricalStoreProfile(),
    generatedAt: snapshot.generatedAt,
    coverage: snapshot.coverage,
    dna: {
      eligibleAds: snapshot.dna.eligibleAds,
      cohorts: snapshot.dna.cohorts,
      topPatterns: snapshot.dna.topPatterns
    }
  }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message || "Historical sync failed." }));
  process.exitCode = 1;
});
