const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { resolveAsanaProjectGid } = require("../server/lib/asana");
const { getConfig } = require("../server/lib/config");

const config = {
  asanaCampaignProjectGid: "111",
  asanaContentProjectGid: "222",
  asanaCreativesProjectGid: "333"
};

test("each project kind resolves to its own project", () => {
  assert.deepEqual(resolveAsanaProjectGid(config, "campaign"), { kind: "campaign", projectGid: "111" });
  assert.deepEqual(resolveAsanaProjectGid(config, "content"), { kind: "content", projectGid: "222" });
  assert.deepEqual(resolveAsanaProjectGid(config, "creatives"), { kind: "creatives", projectGid: "333" });
});

test("a missing kind still means the campaign project, as the browser expects", () => {
  assert.equal(resolveAsanaProjectGid(config, undefined).projectGid, "111");
  assert.equal(resolveAsanaProjectGid(config, " Content ").projectGid, "222");
});

test("an unknown kind is refused with 400 instead of falling back to the campaign board", () => {
  assert.throws(() => resolveAsanaProjectGid(config, "creative"), (error) => error.statusCode === 400);
});

test("the Meta Creatives project is configured by default", () => {
  assert.match(getConfig().asanaCreativesProjectGid, /^\d+$/);
});

test("the asana_tasks route resolves its project through resolveAsanaProjectGid", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");
  assert.match(source, /resolveAsanaProjectGid\(config, req\.query\?\.kind\)/);
  assert.doesNotMatch(source, /projectKind === "content"/);
});
