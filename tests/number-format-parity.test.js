const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Money used to be formatted five different ways in this product: the Meta dashboard
// pinned en-GB with two decimals, the expansion tables and the whole Klaviyo side
// followed the reader's browser locale, and two of those used no decimals. On a Danish
// machine that put "DKK 248,388.13" and "93.175,00 kr." on the same screen, for the same
// currency. src/format.js is the single decision now.
//
// A few figures are formatted on the server, because that is where they are computed.
// There is no bundler here, so api/meta/account-snapshot.js carries its own copy of the
// locale and the decimal count - the same reason src/meta-objectives.js duplicates the
// objective table. This fails the moment the two copies disagree.

const root = join(__dirname, "..");
const client = readFileSync(join(root, "src", "format.js"), "utf8");
const server = readFileSync(join(root, "api", "meta", "account-snapshot.js"), "utf8");

function readConstant(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

test("client and server agree on the number locale", () => {
  const clientLocale = readConstant(client, "NUMBER_LOCALE");
  const serverLocale = readConstant(server, "NUMBER_LOCALE");
  assert.ok(clientLocale, "src/format.js no longer exports NUMBER_LOCALE");
  assert.ok(serverLocale, "the snapshot handler no longer declares NUMBER_LOCALE");
  assert.equal(serverLocale, clientLocale, "the two copies of the number locale have drifted");
});

test("client and server agree on how many decimals money gets", () => {
  const clientDigits = readConstant(client, "MONEY_FRACTION_DIGITS");
  const serverDigits = readConstant(server, "MONEY_FRACTION_DIGITS");
  assert.ok(clientDigits, "src/format.js no longer exports MONEY_FRACTION_DIGITS");
  assert.ok(serverDigits, "the snapshot handler no longer declares MONEY_FRACTION_DIGITS");
  assert.equal(serverDigits, clientDigits, "the two copies of the money precision have drifted");
});

test("nothing formats a number against a second locale any more", () => {
  // A hard-coded locale anywhere else is the drift this file exists to stop. undefined is
  // just as bad: it silently follows whichever machine the page happens to be open on.
  const files = [
    ["src/ui.js", readFileSync(join(root, "src", "ui.js"), "utf8")],
    ["src/klaviyo-dashboard-domain.js", readFileSync(join(root, "src", "klaviyo-dashboard-domain.js"), "utf8")],
    ["app.js", readFileSync(join(root, "app.js"), "utf8")]
  ];

  for (const [name, source] of files) {
    assert.equal(
      /new Intl\.NumberFormat\(\s*(undefined|"en-[A-Z]{2}"|'en-[A-Z]{2}')/.test(source),
      false,
      `${name} formats a number outside src/format.js`
    );
    assert.equal(
      /toLocaleString\(\s*(undefined|"en-[A-Z]{2}"|'en-[A-Z]{2}')\s*,/.test(source),
      false,
      `${name} formats a number outside src/format.js`
    );
  }
});

test("the shared formatter is the one the browser actually loads", () => {
  for (const [name, source] of [
    ["src/ui.js", readFileSync(join(root, "src", "ui.js"), "utf8")],
    ["app.js", readFileSync(join(root, "app.js"), "utf8")]
  ]) {
    assert.match(source, /from "\.{1,2}\/(src\/)?format\.js/, `${name} does not import the shared formatter`);
  }
});
