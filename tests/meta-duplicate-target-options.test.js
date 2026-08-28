const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isStudioSelectableStatus } = require("../server/meta/_catalog-selection");

async function loadTargetOptionsModule() {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "meta-target-options.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

test("duplicate target matching accepts live string IDs, numeric IDs and legacy catalog keys", async () => {
  const { getAdSetOptions } = await loadTargetOptionsModule();
  const adSets = [
    { id: 10, name: "Paused lead target", campaignId: 123 },
    { id: "11", name: "Legacy lead target", campaign_id: "456" },
    { id: "12", name: "Different campaign", campaignId: "999" }
  ];

  assert.deepEqual(getAdSetOptions("LEAD", "123", adSets), [{ id: "10", name: "Paused lead target" }]);
  assert.deepEqual(getAdSetOptions("LEAD", 456, adSets), [{ id: "11", name: "Legacy lead target" }]);
});

test("duplicate target matching falls back to campaign name only when catalog IDs are absent", async () => {
  const { getAdSetOptions } = await loadTargetOptionsModule();
  const adSets = [
    { id: "20", name: "Name-only target", campaignName: "LEAD - Spring sets" },
    { id: "21", name: "Other target", campaignName: "CONV - Jewellery" }
  ];

  assert.deepEqual(getAdSetOptions("lead - spring sets", "123", adSets), [{ id: "20", name: "Name-only target" }]);
  assert.deepEqual(getAdSetOptions("Missing", "123", adSets), [{ id: "", name: "No ad set found" }]);
});

test("studio catalog only admits active Meta destinations", () => {
  assert.equal(isStudioSelectableStatus("ACTIVE"), true);
  ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED", "DELETED", "PENDING_REVIEW", "DISAPPROVED", ""].forEach((status) => {
    assert.equal(isStudioSelectableStatus(status), false, status);
  });
});
