// Shared helpers for the Navision cohort analysis.
const fs = require("fs");
const path = require("path");

// All data (workbook copy, report exports, Meta files, results) lives here - gitignored, it holds customer names.
const SCRATCH = process.env.NAV_COHORT_DIR || path.resolve(__dirname, "..", "..", "tmp", "navision-cohorts");
const RUNS = path.join(SCRATCH, "data", "nav-runs");
// The run that ends at the latest cut-off (FY to date). Tags are "c" + the end date, as run-nav-batch.ps1 names them.
const FULL_TAG = process.env.NAV_FULL_TAG || "c20261103";

function parseCsvLine(l) {
  const o = [];
  let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) {
      if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { o.push(cur); cur = ""; }
    else cur += ch;
  }
  o.push(cur);
  return o;
}

const xlDate = (v) => (v === "" || v == null ? null : new Date(Date.UTC(1899, 11, 30) + Number(v) * 864e5));
const ymd = (d) => (d ? d.toISOString().slice(0, 10) : null);
const ym = (d) => (d ? d.toISOString().slice(0, 7) : null);
// Westpack's fiscal year runs May-April; FY2019 = May 2019 - April 2020.
const fiscalYear = (d) => (d.getUTCMonth() >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);

// Load one report run. Returns { status, customers: [{...}] } with typed fields.
function loadRun(tag) {
  const text = fs.readFileSync(path.join(RUNS, `${tag}-kunder.csv`), "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const head = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const r = parseCsvLine(l);
    return Object.fromEntries(head.map((k, i) => [k, r[i]]));
  });
  const status = rows.find((r) => r.Raekketype === "Status");
  const customers = rows
    .filter((r) => r.Raekketype === "Kunde")
    .map((r) => ({
      no: r.Kundenummer,
      name: r.Kundenavn,
      country: r.Kundeland,
      dept: r.Afdeling,
      deptName: r.Afdelingsnavn,
      first: xlDate(r.FoersteOrdreDato),
      firstInvoice: Number(r.FoersteFakturaOms || 0),
      firstMonthSales: Number(r.OmsFoersteOrdreMaaned || 0),
      salesToCutoff: Number(r.OmsTilSkaering || 0),
      cutoff: xlDate(r.Skaeringsdato),
      period: r.Periode, // "Nu" or "Foer"
      created: xlDate(r.OprettetDato),
      openOrders: Number(r.AabneOrdrerNu || 0),
      source: r.Ordrekilde,
      firstOrderNo: r.FoersteOrdre,
    }));
  return { status, customers };
}

// Department -> market label used throughout the analysis.
const DEPT = {
  "3400": "Other", "3401": "CZ", "3402": "SK", "3403": "HU", "3404": "RO", "3405": "US", "3406": "PT",
  "3407": "ES", "3408": "IT", "3409": "BG", "3410": "DK", "3411": "HR", "3412": "GR", "3413": "EE",
  "3414": "LV", "3415": "LT", "3420": "SE", "3430": "FI", "3440": "NL/BE", "3450": "PL", "3460": "DE/AT/CH",
  "3470": "NO", "3480": "FR", "3490": "IE", "3500": "GB",
};

module.exports = { SCRATCH, RUNS, FULL_TAG, parseCsvLine, xlDate, ymd, ym, fiscalYear, loadRun, DEPT };
