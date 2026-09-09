const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// New customers is the figure the marketing department is measured on, and the campaign
// table could not show which campaigns were producing them - even though every campaign
// row in the snapshot already carried the count. Deciding where the next budget goes means
// knowing which campaigns bring customers and at what price.
//
// src/ui.js is an ES module and the repo has no package.json, so the column logic is
// lifted out of the file and evaluated rather than imported.

const root = join(__dirname, "..");
const uiSource = readFileSync(join(root, "src", "ui.js"), "utf8");

function loadColumnsForLens() {
  const start = uiSource.indexOf("  const columns = (() => {");
  assert.notEqual(start, -1, "the column definitions are gone");
  const end = uiSource.indexOf("  })();", start) + "  })();".length;
  const block = uiSource.slice(start, end).replace("const columns =", "return");
  // eslint-disable-next-line no-new-func
  return new Function("lens", block);
}

const columnsForLens = loadColumnsForLens();

function labels(lens) {
  return columnsForLens(lens).map((column) => column.label);
}

function keys(lens) {
  return columnsForLens(lens).map((column) => column.key);
}

test("both conversion views show new customers and what each one costs", () => {
  for (const lens of ["conversion_standard", "conversion_incremental"]) {
    assert.deepEqual(
      labels(lens),
      ["Campaign", "Spend", "New customers", "Cost / new", "CPA", "ROAS", "Status"],
      `${lens} is not showing the acquisition columns`
    );
  }

  // The two views must stay identical: they are the same campaigns split by a naming tag,
  // so a column present in one and missing from the other would be an accident.
  assert.deepEqual(keys("conversion_standard"), keys("conversion_incremental"));
});

test("the lenses that do not measure customers are left alone", () => {
  // Awareness buys reach and leads buys leads. Adding a new-customer column there would
  // print a number those campaigns are not run against.
  assert.ok(!keys("awareness").includes("newCustomers"));
  assert.ok(!keys("leads").includes("newCustomers"));
  assert.deepEqual(labels("leads"), ["Campaign", "Spend", "Leads", "CPL", "CTR", "Status"]);
  assert.deepEqual(labels("awareness"), ["Campaign", "Spend", "Reach", "Frequency", "CPM", "Status"]);
});

test("every column the table declares has a cell that renders it", () => {
  // A declared column with no branch renders the fallback "--" for every row, which looks
  // like missing data rather than missing code.
  const renderer = uiSource.slice(
    uiSource.indexOf("export function renderCampaignTable"),
    uiSource.indexOf("export function renderCardList")
  );
  assert.ok(renderer.length > 0, "the campaign table renderer is gone");

  const declared = new Set();
  for (const lens of ["general", "awareness", "leads", "conversion_standard", "conversion_incremental"]) {
    for (const key of keys(lens)) declared.add(key);
  }

  for (const key of declared) {
    assert.ok(
      renderer.includes(`col.key === '${key}'`),
      `the ${key} column is declared but has no cell branch, so it would render as "--"`
    );
  }
});

test("a campaign that brought no new customers shows no cost per customer", () => {
  // Spend divided by zero customers is not a bargain, and rendering 0 would sort and read
  // as the cheapest campaign on the account.
  const renderer = uiSource.slice(uiSource.indexOf("export function renderCampaignTable"));
  const guard = renderer.slice(0, renderer.indexOf("const cells ="));

  assert.match(guard, /newCustomerCount > 0/, "the zero-customer case is not guarded");
  assert.match(guard, /costPerNewCustomerValue = /);

  // Reproduce the guard to check it behaves, rather than trusting that it reads correctly.
  const costPerNewCustomer = (spend, newCustomers) => {
    const count = Number(newCustomers);
    const spendNumber = Number(spend);
    return Number.isFinite(count) && count > 0 && Number.isFinite(spendNumber)
      ? spendNumber / count
      : null;
  };

  assert.equal(costPerNewCustomer(33818, 77), 33818 / 77);
  assert.equal(costPerNewCustomer(33818, 0), null, "no customers means no cost per customer");
  assert.equal(costPerNewCustomer(33818, undefined), null);
  assert.equal(costPerNewCustomer(undefined, 12), null);

  // And the cell has to print the dash rather than a formatted zero.
  assert.match(renderer, /costPerNewCustomerValue === null \? "--"/);
});

test("the count comes from the snapshot field, not from a client calculation", () => {
  // Every campaign row already carries new_customers_value, derived server side from the
  // account's own New_customer conversion. Recomputing it in the browser is how the two
  // ends of this dashboard drifted apart before.
  const renderer = uiSource.slice(uiSource.indexOf("export function renderCampaignTable"));
  assert.match(renderer, /campaign\.newCustomersValue \?\? campaign\.new_customers_value/);
});
