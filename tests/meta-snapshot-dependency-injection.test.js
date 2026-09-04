const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

// The snapshot pipeline is wired by hand: each server/meta/_snapshot-*.js exports a
// factory that destructures the helpers it needs, and api/meta/account-snapshot.js passes
// them in. Nothing checks that the two lists agree, so a helper added to a factory but not
// to the call site becomes `undefined` and the dashboard dies at request time with
// "X is not a function" - after every unit test has passed and `require()` has succeeded,
// because module load only proves the file parses, not that the graph is complete.
//
// That shipped twice: once for buildCustomerAcquisitionTrend, which was added to the
// factory's parameter list while the identical-looking block in the caller was left alone.

const root = join(__dirname, "..");
const handlerSource = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");

// Names of parameters a factory destructures, ignoring defaults.
function factoryDependencies(source, factoryName) {
  const match = source.match(new RegExp(`function ${factoryName}\\(\\{([\\s\\S]*?)\\}\\)\\s*\\{`));
  if (!match) return null;
  return match[1]
    .split(",")
    .map((entry) => entry.split("=")[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

// Keys an object literal provides, whether shorthand or `key: value`.
function providedKeys(source, factoryName) {
  const start = source.indexOf(`${factoryName}({`);
  if (start === -1) return null;
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return source
    .slice(open + 1, end)
    .split(",")
    .map((entry) => entry.split(":")[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

const FACTORIES = readdirSync(join(root, "server", "meta"))
  .filter((file) => file.startsWith("_snapshot-") && file.endsWith(".js"))
  .flatMap((file) => {
    const source = readFileSync(join(root, "server", "meta", file), "utf8");
    return [...source.matchAll(/function (createMetaSnapshot\w+)\(\{/g)].map((m) => ({
      file: `server/meta/${file}`,
      name: m[1],
      source
    }));
  });

test("the snapshot factories were found at all", () => {
  // Guards the guard: if the discovery regex broke, every test below would pass vacuously.
  assert.ok(FACTORIES.length >= 3, `expected several snapshot factories, found ${FACTORIES.length}`);
  const names = FACTORIES.map((f) => f.name);
  assert.ok(names.includes("createMetaSnapshotDashboardBuilder"), names.join(", "));
  assert.ok(names.includes("createMetaSnapshotTransformers"), names.join(", "));
});

for (const factory of FACTORIES) {
  test(`${factory.name} receives every dependency it destructures`, () => {
    const required = factoryDependencies(factory.source, factory.name);
    assert.ok(required && required.length, `could not read the parameter list of ${factory.name}`);

    const provided = providedKeys(handlerSource, factory.name);
    assert.ok(
      provided && provided.length,
      `${factory.name} is never called with an object literal in api/meta/account-snapshot.js`
    );

    const missing = required.filter((name) => !provided.includes(name));
    assert.deepEqual(
      missing,
      [],
      `${factory.file} destructures ${missing.join(", ")} but api/meta/account-snapshot.js does not pass ${missing.length === 1 ? "it" : "them"} in, so ${missing.length === 1 ? "it" : "each"} would be undefined at request time`
    );
  });

  test(`${factory.name} is not passed dependencies it ignores`, () => {
    // The reverse direction is not a crash, but a name passed and never destructured is
    // usually a rename that only got applied on one side.
    const required = factoryDependencies(factory.source, factory.name);
    const provided = providedKeys(handlerSource, factory.name);
    const unused = provided.filter((name) => !required.includes(name));
    assert.deepEqual(
      unused,
      [],
      `api/meta/account-snapshot.js passes ${unused.join(", ")} to ${factory.name}, which does not destructure ${unused.length === 1 ? "it" : "them"}`
    );
  });
}

test("every name the handler destructures from customer-acquisition is exported there", () => {
  // Same failure mode one level up: a require of a name the module does not export gives
  // undefined, not an error.
  const moduleSource = readFileSync(join(root, "server", "meta", "customer-acquisition.js"), "utf8");
  const exportBlock = moduleSource.match(/module\.exports = \{([\s\S]*?)\};/);
  assert.ok(exportBlock, "customer-acquisition.js has no module.exports block");
  const exported = exportBlock[1]
    .split(",")
    .map((entry) => entry.split(":")[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));

  // [^}] rather than [\s\S]*? so the match cannot start at an earlier `const {` and run
  // through every require in between.
  const required = handlerSource.match(
    /const \{([^}]*)\} = require\("\.\.\/\.\.\/server\/meta\/customer-acquisition"\);/
  );
  assert.ok(required, "the handler no longer requires customer-acquisition");
  const names = required[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const missing = names.filter((name) => !exported.includes(name));
  assert.deepEqual(missing, [], `the handler imports ${missing.join(", ")} which customer-acquisition.js does not export`);
});

test("the dependency readers discriminate rather than returning empty", () => {
  const sample = "function createMetaSnapshotThing({\n  alpha,\n  beta = 3,\n  gamma\n}) {\n  return 1;\n}";
  assert.deepEqual(factoryDependencies(sample, "createMetaSnapshotThing"), ["alpha", "beta", "gamma"]);
  assert.equal(factoryDependencies(sample, "createSomethingElse"), null);

  const callSite = "const x = createMetaSnapshotThing({\n  alpha,\n  gamma: other,\n  nested: { a: 1 }\n});";
  const keys = providedKeys(callSite, "createMetaSnapshotThing");
  assert.ok(keys.includes("alpha"));
  assert.ok(keys.includes("gamma"));
  assert.equal(keys.includes("beta"), false, "a missing dependency must not be reported as provided");
});
