// Tags the subject lines collect-rge.js gathered, so they enter the pattern bank on the same terms
// as the authored ones: mechanism, campaign type, tone, translation risk and a one-line why.
//
//   node knowledge/subject-lines/tools/tag-collected.js
//   node knowledge/subject-lines/tools/build-bank.js
//
// Uses the app's own tagger (server/klaviyo/subject-line-generator.js, default model). The text of
// a line is never rewritten. Tags are cached per card in tmp/rge-crawl/tags.json, so a rerun only
// tags what is new.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..", "..");
process.chdir(ROOT);
const { getConfig } = require(path.join(ROOT, "server", "lib", "config"));
const { tagImportedLines } = require(path.join(ROOT, "server", "klaviyo", "subject-line-generator"));

const CACHE = path.join(ROOT, "tmp", "rge-crawl");
const OUTPUT = path.join(__dirname, "..", "collected", "really-good-emails.json");
const BATCH = 50;
const CONCURRENCY = 4;

async function tagAll() {
  const config = getConfig();
  const cards = JSON.parse(fs.readFileSync(path.join(CACHE, "cards.json"), "utf8"));
  const tagsFile = path.join(CACHE, "tags.json");
  const tags = fs.existsSync(tagsFile) ? JSON.parse(fs.readFileSync(tagsFile, "utf8")) : {};
  const todo = cards.filter((card) => !tags[card.slug]);
  const batches = [];
  for (let start = 0; start < todo.length; start += BATCH) batches.push(todo.slice(start, start + BATCH));
  console.log(`${cards.length} cards, ${todo.length} to tag in ${batches.length} batches`);

  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor];
      cursor += 1;
      try {
        const tagged = await tagImportedLines({ config, rows: batch.map((card) => ({ subject: card.subject, preview: "", slug: card.slug })) });
        for (const row of tagged) {
          tags[row.slug] = { language: row.language, mechanisms: row.mechanisms, campaignType: row.campaignType, tone: row.tone, translationRisk: row.translationRisk, why: row.why };
        }
      } catch (error) {
        console.log(`batch failed: ${error.message}`);
      }
      done += 1;
      if (done % 10 === 0 || done === batches.length) {
        fs.writeFileSync(tagsFile, JSON.stringify(tags));
        console.log(`tagged ${done}/${batches.length} batches`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(tagsFile, JSON.stringify(tags));

  const entries = cards
    .filter((card) => tags[card.slug])
    .map((card) => ({
      id: `rg-${crypto.createHash("sha1").update(card.slug).digest("hex").slice(0, 10)}`,
      subject: card.subject,
      preview: "",
      ...tags[card.slug],
      context: "generisk",
      source: "collected",
      sender: card.company,
      collectedFrom: "Really Good Emails",
      url: `https://reallygoodemails.com/emails/${card.slug}`,
      publishedAt: card.publishedAt,
      rgeCategories: card.categories
    }));
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify({
    note: "Real subject lines sent by other brands, collected from Really Good Emails' public category listings by tools/collect-rge.js and tagged by tools/tag-collected.js. Their results are unknown.",
    collectedAt: new Date().toISOString(),
    count: entries.length,
    entries
  }, null, 1)}\n`);
  console.log(`wrote ${entries.length} entries to ${path.relative(ROOT, OUTPUT)}`);
}

tagAll().catch((error) => {
  console.error(error);
  process.exit(1);
});
