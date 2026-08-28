const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCampaignMemoryPromptBlock,
  selectCampaignMemoryReferences
} = require("../server/campaign/memory");

test("campaign memory prioritizes a small, role-driven owned Westpack set", () => {
  const references = selectCampaignMemoryReferences({
    title: "Ny produktkampagne for premium smykkeemballage",
    campaignType: "product",
    objective: "Skab interesse og salg"
  });
  const owned = references.filter((reference) => reference.sourceType === "owned_campaign");
  const external = references.filter((reference) => reference.sourceType === "external_inspiration");

  assert.equal(owned.length, 5);
  assert.ok(external.length <= 1);
  assert.equal(owned[0].designRole, "Closest campaign analogue");
  assert.ok(owned.every((reference) => reference.designRole));
  assert.ok(new Set(owned.map((reference) => reference.family)).size >= 3);

  const prompt = buildCampaignMemoryPromptBlock(references);
  assert.match(prompt, /primary evidence of the house style/i);
  assert.match(prompt, /one decisive creative direction/i);
});
