// Which mechanisms win for Westpack - read from Westpack's own A/B tests, not assumed.
//
// Layer 1 holds ~500 A/B tests of a subject or preheader, but as single examples they only ever
// told the generator "this line beat that line". Tagged with the same mechanisms as the pattern
// bank, the same tests answer the question the generator actually faces: when two lines built
// on different mechanisms met on one list, which kind won? Arms that share a primary mechanism
// are a wording test and say nothing about mechanisms, so they are left out.
//
// The tests ran in five languages (DK, UK, DE, NL, EU) and many are one test translated, so a
// mechanism's record is reported both across all markets and for DK alone, with counts - never as
// a rate without its n. A/B tests on lists of a few hundred are mostly inconclusive one by one;
// what this adds is the tally across many of them. Sends outside A/B tests add only a weaker,
// correlational view: the median open index of DK sends by mechanism.

const { tagImportedLines } = require("./subject-line-generator");
const { MIN_RECIPIENTS_FOR_INDEX } = require("./subject-line-history");

const TAG_BATCH = 50;
const TAG_CONCURRENCY = 4;
const MIN_HEAD_TO_HEADS = 3;

function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// What still needs a tag, most useful first: every arm of a subject or preheader A/B test in any
// market, then DK's own sends newest first.
function selectUntagged({ abTests = [], dkEntries = [], tags = {}, limit = 600 }) {
  const rows = [];
  const seen = new Set();
  const add = (id, subject, preview) => {
    if (!id || seen.has(id) || tags[id] || !String(subject || "").trim()) return;
    seen.add(id);
    rows.push({ id, subject, preview: preview || "" });
  };
  for (const test of abTests) {
    if (test.differs === "content") continue;
    for (const arm of test.arms) add(arm.id, arm.subject, arm.previewText);
  }
  for (const entry of dkEntries) add(entry.id, entry.subject, entry.previewText);
  return rows.slice(0, limit);
}

async function tagHistoryRows({ config, rows = [] }) {
  const batches = [];
  for (let start = 0; start < rows.length; start += TAG_BATCH) batches.push(rows.slice(start, start + TAG_BATCH));
  const tagged = {};
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor];
      cursor += 1;
      const result = await tagImportedLines({ config, rows: batch });
      for (const row of result) {
        tagged[row.id] = { m: row.mechanisms, t: row.campaignType, l: row.language };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(TAG_CONCURRENCY, batches.length) }, worker));
  return tagged;
}

function primary(tags, id) {
  return tags[id]?.m?.[0] || "";
}

function buildMechanismEvidence({ abTests = [], dkEntries = [], tags = {} } = {}) {
  const records = new Map();
  const families = new Map();
  const record = (mechanism) => {
    if (!records.has(mechanism)) records.set(mechanism, { mechanism, headToHeads: 0, wins: 0, clearWins: 0, losses: 0, clearLosses: 0, dkHeadToHeads: 0, dkWins: 0, liftPoints: 0, clickWins: 0 });
    return records.get(mechanism);
  };
  // One test translated into five markets is one experiment, not five. Each mechanism's record is
  // also kept per test family, and only that count carries a significance test.
  const familyVote = (mechanism, familyKey, won) => {
    if (!families.has(mechanism)) families.set(mechanism, new Map());
    const perFamily = families.get(mechanism);
    const vote = perFamily.get(familyKey) || { wins: 0, total: 0 };
    vote.total += 1;
    if (won) vote.wins += 1;
    perFamily.set(familyKey, vote);
  };
  const pairs = new Map();
  let headToHeads = 0;
  let taggedArms = 0;
  let totalArms = 0;

  for (const test of abTests) {
    if (test.differs === "content") continue;
    totalArms += test.arms.length;
    taggedArms += test.arms.filter((arm) => tags[arm.id]).length;
    const ranked = [...test.arms].sort((left, right) => (right.openRate || 0) - (left.openRate || 0));
    const [winner, runnerUp] = ranked;
    const winnerMechanism = primary(tags, winner?.id);
    const loserMechanism = primary(tags, runnerUp?.id);
    if (!winnerMechanism || !loserMechanism || winnerMechanism === loserMechanism) continue;
    headToHeads += 1;
    const clear = test.verdict === "klar";
    const lift = Number(test.openLiftPoints) || 0;
    const won = record(winnerMechanism);
    const lost = record(loserMechanism);
    won.headToHeads += 1;
    lost.headToHeads += 1;
    won.wins += 1;
    lost.losses += 1;
    won.liftPoints += lift;
    lost.liftPoints -= lift;
    if (clear) {
      won.clearWins += 1;
      lost.clearLosses += 1;
    }
    // The same two arms judged on clicks (bots removed), which can disagree with opens.
    const clickWinner = (winner.clickRate || 0) >= (runnerUp.clickRate || 0) ? winnerMechanism : loserMechanism;
    record(clickWinner).clickWins += 1;
    const familyKey = test.familyKey || test.campaignId;
    familyVote(winnerMechanism, familyKey, true);
    familyVote(loserMechanism, familyKey, false);
    if (test.country === "DK") {
      won.dkHeadToHeads += 1;
      lost.dkHeadToHeads += 1;
      won.dkWins += 1;
    }
    const key = [winnerMechanism, loserMechanism].sort().join("|");
    const pair = pairs.get(key) || { a: key.split("|")[0], b: key.split("|")[1], aWins: 0, bWins: 0 };
    if (winnerMechanism === pair.a) pair.aWins += 1;
    else pair.bWins += 1;
    pairs.set(key, pair);
  }

  const dkByMechanism = new Map();
  let taggedDk = 0;
  for (const entry of dkEntries) {
    const mechanism = primary(tags, entry.id);
    if (!mechanism) continue;
    taggedDk += 1;
    if (!(entry.received >= MIN_RECIPIENTS_FOR_INDEX) || !Number.isFinite(entry.openIndex)) continue;
    const list = dkByMechanism.get(mechanism) || [];
    list.push(entry);
    dkByMechanism.set(mechanism, list);
  }

  const byMechanism = [...records.values()]
    .filter((item) => item.headToHeads >= MIN_HEAD_TO_HEADS)
    .map((item) => {
      // A family counts as won when the mechanism won most of that test's markets; a tie is half.
      const votes = [...(families.get(item.mechanism) || new Map()).values()];
      const familyWins = votes.reduce((sum, vote) => sum + (vote.wins * 2 > vote.total ? 1 : vote.wins * 2 === vote.total ? 0.5 : 0), 0);
      const familyTests = votes.length;
      // Sign test against a coin flip, on distinct tests only.
      const z = familyTests ? (familyWins - familyTests / 2) / Math.sqrt(familyTests / 4) : 0;
      return {
        ...item,
        winShare: Number((item.wins / item.headToHeads).toFixed(3)),
        clickWinShare: Number((item.clickWins / item.headToHeads).toFixed(3)),
        averageLiftPoints: Number((item.liftPoints / item.headToHeads).toFixed(1)),
        familyTests,
        familyWins,
        z: Number(z.toFixed(2)),
        signal: z >= 1.96 ? "wins" : z <= -1.96 ? "loses" : z >= 1.28 ? "leans_win" : z <= -1.28 ? "leans_loss" : "unclear"
      };
    })
    .sort((left, right) => right.winShare - left.winShare || right.headToHeads - left.headToHeads);

  const dkIndex = [...dkByMechanism.entries()]
    .filter(([, list]) => list.length >= 10)
    .map(([mechanism, list]) => ({
      mechanism,
      sends: list.length,
      openIndex: Number(median(list.map((entry) => entry.openIndex)).toFixed(3)),
      clickIndex: Number.isFinite(median(list.map((entry) => entry.clickIndex))) ? Number(median(list.map((entry) => entry.clickIndex)).toFixed(3)) : null
    }))
    .sort((left, right) => right.openIndex - left.openIndex);

  return {
    headToHeads,
    byMechanism,
    pairs: [...pairs.values()].filter((pair) => pair.aWins + pair.bWins >= 2).sort((left, right) => (right.aWins + right.bWins) - (left.aWins + left.bWins)).slice(0, 12),
    dkIndex,
    coverage: { taggedArms, totalArms, taggedDk, totalDk: dkEntries.length }
  };
}

module.exports = {
  MIN_HEAD_TO_HEADS,
  buildMechanismEvidence,
  selectUntagged,
  tagHistoryRows
};
