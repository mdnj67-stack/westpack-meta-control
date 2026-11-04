// Computes chart geometry for the deck: one SVG (marks only) + pinned <p> labels per chart,
// printed as HTML snippets to paste into slide files. Canvas px are ~2x screen px, so marks are
// doubled from the dataviz spec: bars 48px, lines 4px, markers r 8, gaps 4px, labels 24px+.
const fs = require("fs");
const path = require("path");
const { SCRATCH } = require("./lib");
const D = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "deck-numbers.json"), "utf8"));
const ITES = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "it-es.json"), "utf8"));
const OUT = path.join(SCRATCH, "data", "charts");
fs.mkdirSync(OUT, { recursive: true });

const C = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", yellow: "#eda100", magenta: "#e87ba4", green: "#008300",
  grid: "#E1DED6", axis: "#C3C0B6", ink: "#1F2A26", ink2: "#4E5A55", muted: "#6F7974", surface: "#F7F5F0",
  ramp: ["#104281", "#256abf", "#3987e5", "#6da7ec"] };
const kr = (v) => Math.round(v).toLocaleString("da-DK");
const r1 = (v) => Math.round(v * 10) / 10;
const p = (x, y, w, text, opts = {}) => `<p style="position:absolute;left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;font-size:${opts.size || 24}px;line-height:1.2;color:${opts.color || C.muted};text-align:${opts.align || "left"}${opts.bold ? ";font-weight:600" : ""}${opts.nowrap ? ";white-space:nowrap" : ""}">${text}</p>`;
// Column with a 4px (x2 = 8px) rounded top and a square base.
const col = (x, y0, w, h, fill, round = true) => {
  if (h <= 0) return "";
  const r = round ? Math.min(8, h) : 0;
  return `<path d="M${r1(x)} ${r1(y0)} V${r1(y0 - h + r)} Q${r1(x)} ${r1(y0 - h)} ${r1(x + r)} ${r1(y0 - h)} H${r1(x + w - r)} Q${r1(x + w)} ${r1(y0 - h)} ${r1(x + w)} ${r1(y0 - h + r)} V${r1(y0)} Z" fill="${fill}"/>`;
};
const hbar = (x0, y, len, t, fill) => {
  if (len <= 0) return "";
  const r = Math.min(8, len);
  return `<path d="M${r1(x0)} ${r1(y)} H${r1(x0 + len - r)} Q${r1(x0 + len)} ${r1(y)} ${r1(x0 + len)} ${r1(y + r)} V${r1(y + t - r)} Q${r1(x0 + len)} ${r1(y + t)} ${r1(x0 + len - r)} ${r1(y + t)} H${r1(x0)} Z" fill="${fill}"/>`;
};
const svg = (w, h, label, body) => `<svg aria-label="${label}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const write = (name, w, h, svgStr, labels) => {
  const html = `<div style="position:relative;width:${w}px;height:${h}px">\n${svgStr}\n${labels.join("\n")}\n</div>`;
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
  console.log(`${name}: ${labels.length} labels, svg ${svgStr.length} bytes`);
};

// ---------- C1: cumulative sales per new customer, acquisition year vs later years ----------
{
  // Measured years only: +3 years is the 2022/23 cohort's own figure; nothing extrapolated.
  const cum = D.recentCum.slice(0, 4), first = D.recent[0];
  const W = 1040, H = 560, L = 120, R = 20, T = 48, B = 72, max = 6500;
  const pw = W - L - R, ph = H - T - B, y = (v) => T + ph - (v / max) * ph;
  let body = "";
  for (const v of [0, 2000, 4000, 6000]) body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? C.grid : C.axis}" stroke-width="2"/>`;
  const labels = [];
  for (const v of [0, 2000, 4000, 6000]) labels.push(p(0, y(v) - 15, L - 16, kr(v), { align: "right" }));
  const band = pw / 4, bw = 96;
  const names = ["Købsåret", "+1 år", "+2 år", "+3 år"];
  cum.forEach((v, i) => {
    const x = L + band * i + (band - bw) / 2;
    const hFirst = (first / max) * ph, hAll = (v / max) * ph;
    body += col(x, y(0), bw, hFirst, C.orange, i === 0);
    if (i > 0) body += col(x, y(0) - hFirst - 4, bw, hAll - hFirst - 4, C.blue);
    labels.push(p(x - 40, y(v) - 40, bw + 80, kr(v), { align: "center", color: C.ink, bold: true }));
    labels.push(p(L + band * i, H - B + 14, band, names[i], { align: "center" }));
  });
  write("c1-cumulative", W, H, svg(W, H, "Samlet omsætning pr. ny kunde: 1.913 kr. i købsåret, 3.471 efter +1 år, 4.734 efter +2 år og 5.851 efter +3 år", body), labels);
}

// ---------- C3: layer cake, sales per fiscal year by acquisition cohort (m DKK) ----------
{
  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const cohorts = [2020, 2021, 2022, 2023, 2024, 2025];
  const fills = [C.blue, C.orange, C.aqua, C.yellow, C.magenta, C.green];
  const W = 1100, H = 560, L = 90, R = 20, T = 40, B = 64, max = 140e6;
  const pw = W - L - R, ph = H - T - B, y = (v) => T + ph - (v / max) * ph;
  let body = "";
  const labels = [];
  for (const v of [0, 40e6, 80e6, 120e6]) { body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? C.grid : C.axis}" stroke-width="2"/>`; labels.push(p(0, y(v) - 15, L - 16, `${v / 1e6}`, { align: "right" })); }
  const band = pw / years.length, bw = 84;
  years.forEach((fy, i) => {
    const x = L + band * i + (band - bw) / 2;
    let base = y(0), total = 0;
    cohorts.forEach((c, k) => {
      const v = (D.cake[fy] || {})[c] || 0;
      if (!v) return;
      const h = (v / max) * ph;
      const isTop = !cohorts.slice(k + 1).some((cc) => (D.cake[fy] || {})[cc]);
      body += col(x, base, bw, h - (isTop ? 0 : 4), fills[k], isTop);
      base -= h; total += v;
    });
    labels.push(p(x - 40, y(total) - 40, bw + 80, `${r1(total / 1e6).toString().replace(".", ",")}`, { align: "center", color: C.ink, bold: true }));
    labels.push(p(L + band * i, H - B + 14, band, `${String(fy).slice(2)}/${String(fy + 1).slice(2)}`, { align: "center" }));
  });
  // Direct label for the 2020 cohort's band on the last column (identity also in the legend).
  write("c3-layercake", W, H, svg(W, H, "Omsætning pr. regnskabsår fra kunder vundet siden 2020, fordelt på årgang. Årgang 2020 gav 27,6 mio. kr. i sit første år og 22,4 mio. kr. i 2025/26.", body), labels);
}

// ---------- C4: three-year value by size of first invoice (horizontal bars) ----------
{
  const rows = [["Under 200 kr.", 5874, 24], ["200–500 kr.", 3957, 21], ["500–1.000 kr.", 5374, 24], ["1.000–2.000 kr.", 9845, 20], ["2.000–5.000 kr.", 15423, 9], ["Over 5.000 kr.", 51180, 2]];
  const W = 1180, H = 540, L = 300, R = 200, T = 6, B = 6, max = 54000;
  const pw = W - L - R, rowH = (H - T - B) / rows.length, t = 48;
  let body = `<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="${C.axis}" stroke-width="2"/>`;
  const labels = [];
  rows.forEach(([name, v, share], i) => {
    const yy = T + rowH * i + (rowH - t) / 2;
    body += hbar(L, yy, (v / max) * pw, t, i >= 4 ? C.blue : "#6da7ec");
    labels.push(p(0, yy + 8, L - 24, name, { align: "right", color: C.ink2 }));
    labels.push(p(L + (v / max) * pw + 16, yy + 8, 160, `${kr(v)} kr.`, { color: C.ink, bold: true, nowrap: true }));
  });
  write("c4-firstinvoice", W, H, svg(W, H, "Omsætning pr. kunde over ca. 3½ år efter størrelsen på første faktura: under 200 kr. 5.874; 200-500 kr. 3.957; 500-1.000 kr. 5.374; 1.000-2.000 kr. 9.845; 2.000-5.000 kr. 15.423; over 5.000 kr. 51.180", body), labels);
}

// ---------- C5: cost per incremental new customer by campaign, last 90 days, with break-even lines ----------
{
  const rows = [["Conv - 04 - EU", 854], ["Conv - 03 - IT", 2664], ["Conv - 01 - DE", 3275], ["Conv - 02 - FR", 5784]];
  const W = 1180, H = 520, L = 290, R = 120, T = 70, B = 20, max = 6200;
  const pw = W - L - R, rowH = (H - T - B) / rows.length, t = 56, x = (v) => L + (v / max) * pw;
  let body = `<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="${C.axis}" stroke-width="2"/>`;
  const labels = [];
  [[2130, "Hjem på ~2½ år", "right"], [3485, "Hjem på ~5½ år", "left"]].forEach(([v, txt, side]) => {
    body += `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - B}" stroke="${C.ink2}" stroke-width="2"/>`;
    labels.push(side === "right" ? p(x(v) - 268, 0, 260, `${txt}<br>${kr(v)} kr.`, { align: "right", color: C.ink2 }) : p(x(v) + 8, 0, 260, `${txt}<br>${kr(v)} kr.`, { color: C.ink2 }));
  });
  rows.forEach(([name, v], i) => {
    const yy = T + rowH * i + (rowH - t) / 2;
    body += hbar(L, yy, (v / max) * pw, t, i === 0 ? C.blue : C.orange);
    labels.push(p(0, yy + 12, L - 24, name, { align: "right", color: C.ink2 }));
    labels.push(p(x(v) + 16, yy + 12, 140, `${kr(v)}`, { color: C.ink, bold: true, nowrap: true }));
  });
  write("c5-campaign-cpa", W, H, svg(W, H, "Kroner pr. inkrementel ny kunde, seneste 90 dage: EU 854, IT 2.664, DE 3.275, FR 5.784. Grænser: 2.130 kr. tjenes hjem på ca. 2½ år, 3.485 kr. på ca. 5½ år ved 45 % dækningsgrad.", body), labels);
}

// ---------- C6: kroner back per krone by campaign, measured years only, 45% margin ----------
// Each campaign is valued with its own markets' customers (cohorts 2022-24, years they have completed):
// EU = the markets Conv - 04 - EU serves (all but DK, DE, FR, IT). Cost = Meta's incremental cost per
// new customer, last 90 days (meta-campaigns.js).
{
  const paid = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "cohorts", "customers.json"), "utf8")).filter((c) => c.total > 0);
  const curve = (ccs) => {
    const set = new Set(ccs);
    let cum = 0;
    return [0, 1, 2, 3].map((t) => {
      const el = paid.filter((c) => set.has(c.country) && c.fy0 >= 2022 && c.fy0 <= 2024 && c.fy0 + t <= 2025);
      return (cum += el.reduce((s, c) => s + (c.sales[c.fy0 + t] || 0), 0) / el.length);
    });
  };
  const EU = ["GB", "NL", "BE", "PL", "ES", "PT", "SE", "FI", "AT", "CH", "IE", "NO", "CZ", "SK", "HU", "RO", "GR", "HR", "BG", "LU", "EE", "LV", "LT", "SI"];
  // Cost per new customer = the last 30 days of the current setup (meta-precision.js).
  const P = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "meta", "precision.json"), "utf8")).last30;
  const cpa = (name) => { const r = P.find((x) => x.name === name); return r.spend / r.ia; };
  const series = [["EU", cpa("Conv - 04 - EU - Standard"), EU, C.blue], ["IT", cpa("Conv - 03 - IT"), ["IT"], C.orange], ["DE", cpa("Conv - 01 - DE"), ["DE"], C.aqua], ["FR", cpa("Conv - 02 - FR"), ["FR"], C.yellow]];
  const W = 1180, H = 560, L = 90, R = 170, T = 24, B = 72, max = 3.25;
  const pw = W - L - R, ph = H - T - B, y = (v) => T + ph - (v / max) * ph, xs = (i) => L + 40 + ((pw - 80) / 3) * i;
  let body = "";
  const labels = [];
  for (const v of [0, 1, 2, 3]) { body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? C.axis : v === 1 ? C.ink2 : C.grid}" stroke-width="${v === 1 ? 3 : 2}"/>`; labels.push(p(0, y(v) - 15, L - 16, `${v}`, { align: "right", color: v === 1 ? C.ink : C.muted, bold: v === 1 })); }
  ["Købsåret", "+1 år", "+2 år", "+3 år"].forEach((n, i) => labels.push(p(xs(i) - 80, H - B + 16, 160, n, { align: "center" })));
  const desc = [];
  series.forEach(([name, cac, ccs, color]) => {
    const vals = curve(ccs).map((v) => (v * 0.45) / cac);
    desc.push(`${name} ${vals.map((v) => v.toFixed(2)).join("/")}`);
    body += `<polyline points="${vals.map((v, i) => `${r1(xs(i))},${r1(y(v))}`).join(" ")}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
    body += `<circle cx="${r1(xs(3))}" cy="${r1(y(vals[3]))}" r="9" fill="${color}" stroke="${C.surface}" stroke-width="4"/>`;
    labels.push(p(xs(3) + 22, y(vals[3]) - 16, 150, `${name}: ${vals[3].toFixed(1).replace(".", ",")}`, { color: C.ink, bold: true, nowrap: true }));
  });
  console.log("C6 per campaign:", desc.join("  "));
  write("c6-payback", W, H, svg(W, H, `Kroner dækningsbidrag tilbage pr. krone brugt på Meta, ved 45 % dækningsgrad, købsåret til +3 år: ${desc.join("; ")}.`, body), labels);
}

// ---------- C7: rolling 12 months, Meta spend vs new paying customers, indexed Oct 2024 = 100 ----------
{
  const m = D.monthly.filter((r) => r.m >= "2023-11");
  const roll = [];
  for (let i = 11; i < m.length; i++) {
    const w = m.slice(i - 11, i + 1);
    roll.push({ m: m[i].m, spend: w.reduce((s, r) => s + r.spend, 0), nav: w.reduce((s, r) => s + r.nav, 0) });
  }
  const b = roll[0];
  const pts = roll.map((r) => ({ m: r.m, s: (r.spend / b.spend) * 100, n: (r.nav / b.nav) * 100, spend: r.spend, nav: r.nav }));
  console.log("C7 base", b, "last", roll[roll.length - 1], "index last", pts[pts.length - 1]);
  const W = 1180, H = 560, L = 90, R = 260, T = 24, B = 64, max = 600;
  const pw = W - L - R, ph = H - T - B, y = (v) => T + ph - (v / max) * ph, xs = (i) => L + (pw / (pts.length - 1)) * i;
  let body = "";
  const labels = [];
  for (const v of [0, 100, 200, 300, 400, 500, 600]) { body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? C.axis : C.grid}" stroke-width="2"/>`; labels.push(p(0, y(v) - 15, L - 16, `${v}`, { align: "right" })); }
  for (const [key, col2] of [["s", C.orange], ["n", C.blue]]) {
    body += `<polyline points="${pts.map((r, i) => `${r1(xs(i))},${r1(y(r[key]))}`).join(" ")}" fill="none" stroke="${col2}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts[pts.length - 1];
    body += `<circle cx="${r1(xs(pts.length - 1))}" cy="${r1(y(last[key]))}" r="9" fill="${col2}" stroke="${C.surface}" stroke-width="4"/>`;
  }
  const last = pts[pts.length - 1];
  labels.push(p(xs(pts.length - 1) + 22, y(last.s) - 30, 240, `Meta-forbrug<br><b>${Math.round(last.s)}</b>`, { color: C.ink }));
  labels.push(p(xs(pts.length - 1) + 22, y(last.n) - 30, 240, `Nye kunder<br><b>${Math.round(last.n)}</b>`, { color: C.ink }));
  for (const [i, name] of [[0, "okt. 24"], [12, "okt. 25"], [24, "okt. 26"]]) labels.push(p(xs(i) - 80, H - B + 16, 160, name, { align: "center" }));
  write("c7-index", W, H, svg(W, H, `Rullende 12 måneder, indeks okt. 2024 = 100. Meta-forbrug steg til ${Math.round(last.s)}; nye betalende kunder til ${Math.round(last.n)}.`, body), labels);
  D.rolling = pts;
}

// ---------- C9: IT/ES ratio, Sep-Nov each year ----------
{
  const rows = ITES.ratioRows.filter((r) => r.window === "Sep-Nov");
  const W = 1100, H = 560, L = 90, R = 40, T = 60, B = 70, max = 3;
  const pw = W - L - R, ph = H - T - B, y = (v) => T + ph - (v / max) * ph, xs = (i) => L + 40 + ((pw - 80) / (rows.length - 1)) * i;
  let body = "";
  const labels = [];
  for (const v of [0, 1, 2, 3]) { body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? C.axis : C.grid}" stroke-width="2"/>`; labels.push(p(0, y(v) - 15, L - 16, `${v}`, { align: "right" })); }
  // Shade the years with Meta conversion spend in Italy.
  const first = rows.findIndex((r) => r.year === 2024);
  body = `<rect x="${(xs(first) + xs(first - 1)) / 2}" y="${T - 10}" width="${W - R - (xs(first) + xs(first - 1)) / 2}" height="${ph + 10}" fill="#EAE6DC"/>` + body;
  labels.push(p((xs(first) + xs(first - 1)) / 2 + 12, T - 52, 240, "IT med Meta", { color: C.ink2 }));
  body += `<polyline points="${rows.map((r, i) => `${r1(xs(i))},${r1(y(r.ratio))}`).join(" ")}" fill="none" stroke="${C.blue}" stroke-width="4" stroke-linejoin="round"/>`;
  rows.forEach((r, i) => {
    body += `<circle cx="${r1(xs(i))}" cy="${r1(y(r.ratio))}" r="9" fill="${C.blue}" stroke="${C.surface}" stroke-width="4"/>`;
    labels.push(p(xs(i) - 60, y(r.ratio) - 46, 120, (Math.round(r.ratio * 10) / 10).toFixed(1).replace(".", ","), { align: "center", color: C.ink, bold: true }));
    labels.push(p(xs(i) - 60, H - B + 16, 120, String(r.year), { align: "center" }));
  });
  write("c9-it-es", W, H, svg(W, H, `Forholdet mellem nye kunder i IT og ES i september-november: ${rows.map((r) => `${r.year} ${r.ratio.toFixed(2)}`).join(", ")}.`, body), labels);
}

fs.writeFileSync(path.join(SCRATCH, "data", "deck-numbers.json"), JSON.stringify(D, null, 1));
// Numbers used in slide text.
const cr = D.cohortRows;
console.log("per active customer, cohort 2020:", cr[2020].perActive.map(kr).join(" / "), " cohort 2021:", cr[2021].perActive.map(kr).join(" / "));
console.log("cohort tables for appendix:", JSON.stringify(Object.fromEntries(Object.entries(cr).map(([k, v]) => [k, { n: v.n, act: v.act.map((a) => Math.round(a * 100)), rev: v.rev.map((r) => Math.round(r)) }]))));

// ---------- Market entry (market-entry.js must have run) ----------
{
  const ME = JSON.parse(fs.readFileSync(path.join(SCRATCH, "data", "market-entry.json"), "utf8"));
  const NAME = { DK: "Danmark", FI: "Finland", NL: "Holland", SE: "Sverige", IE: "Irland", FR: "Frankrig", BE: "Belgien", DE: "Tyskland", PL: "Polen", AT: "Østrig", PT: "Portugal", IT: "Italien", ES: "Spanien" };
  const ENTRY = new Set(["DE", "FR", "IT"]);

  // C10: new customers per year per 100 jewellery shops, by country.
  {
    const rows = ME.pen.filter((r) => NAME[r.cc] && r.per100Jewellers != null).sort((a, b) => b.per100Jewellers - a.per100Jewellers);
    const W = 1100, H = 572, L = 170, R = 110, T = 4, B = 4, max = 135;
    const pw = W - L - R, rowH = (H - T - B) / rows.length, t = 28;
    let body = `<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="${C.axis}" stroke-width="2"/>`;
    const labels = [];
    rows.forEach((r, i) => {
      const yy = T + rowH * i + (rowH - t) / 2, len = (r.per100Jewellers / max) * pw;
      body += hbar(L, yy, len, t, ENTRY.has(r.cc) ? C.orange : "#6da7ec");
      labels.push(p(0, yy - 1, L - 16, NAME[r.cc], { align: "right", color: ENTRY.has(r.cc) ? C.ink : C.ink2, bold: ENTRY.has(r.cc) }));
      labels.push(p(L + len + 12, yy - 1, 100, r.per100Jewellers.toFixed(0), { color: C.ink, bold: true, nowrap: true }));
    });
    write("c10-penetration", W, H, svg(W, H, `Nye kunder om året pr. 100 smykkebutikker: ${rows.map((r) => `${NAME[r.cc]} ${r.per100Jewellers.toFixed(0)}`).join(", ")}`, body), labels);
  }

  // C11: sales per customer 4½ years after acquisition (cohorts 2020-21, fully measured), by market.
  {
    const v = (k) => ME.value[k].older[4].cum;
    const rows = [["Italien", v("IT"), true], ["Frankrig", v("FR"), true], ["Gennemsnit", v("ALL"), false], ["Øvrige EU", v("EU"), false], ["Tyskland", v("DE"), true]].sort((a, b) => b[1] - a[1]);
    const W = 1100, H = 440, L = 220, R = 170, T = 10, B = 10, max = 16000;
    const pw = W - L - R, rowH = (H - T - B) / rows.length, t = 48;
    let body = `<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="${C.axis}" stroke-width="2"/>`;
    const labels = [];
    rows.forEach(([name, val, entry], i) => {
      const yy = T + rowH * i + (rowH - t) / 2, len = (val / max) * pw;
      body += hbar(L, yy, len, t, entry ? C.orange : "#B9B5AA");
      labels.push(p(0, yy + 8, L - 20, name, { align: "right", color: entry ? C.ink : C.ink2, bold: entry }));
      labels.push(p(L + len + 14, yy + 8, 160, `${kr(val)} kr.`, { color: C.ink, bold: true, nowrap: true }));
    });
    write("c11-market-value", W, H, svg(W, H, `Omsætning pr. ny kunde efter 4½ år, kunder fra 2020-21: ${rows.map((r) => `${r[0]} ${kr(r[1])}`).join(", ")} kr.`, body), labels);
  }

  // C12: J-curve, net result per 100,000 DKK spent (thousand DKK) by year after acquisition, so EU and
  // DE+FR+IT (different budgets) are comparable.
  {
    const J = ME.jcurve;
    const per100k = (vals, spend) => vals.map((v) => (v / spend) * 1e5);
    const entrySpend = J.IT.spend30 + J.DE.spend30 + J.FR.spend30;
    const sum = (key) => J.IT[key].map((_, i) => (J.IT[key][i] ?? 0) + (J.DE[key][i] ?? 0) + (J.FR[key][i] ?? 0));
    const series = [["EU-kampagnen", per100k(J.EU.recent, J.EU.spend30), C.blue], ["DE+FR+IT, nye kunder", per100k(sum("recent"), entrySpend), C.orange], ["DE+FR+IT, købsmønster som 2020–21", per100k(sum("older"), entrySpend), C.aqua]];
    const W = 1180, H = 560, L = 110, R = 300, T = 24, B = 72, min = -75000, max = 215000;
    const pw = W - L - R, ph = H - T - B, y = (v) => T + ph - ((v - min) / (max - min)) * ph, xs = (i) => L + 40 + ((pw - 80) / 5) * i;
    let body = "";
    const labels = [];
    for (const v of [-50000, 0, 50000, 100000, 150000, 200000]) {
      body += `<line x1="${L}" x2="${W - R}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="${v === 0 ? C.ink2 : C.grid}" stroke-width="${v === 0 ? 3 : 2}"/>`;
      labels.push(p(0, y(v) - 15, L - 16, `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v / 1000)}`, { align: "right", color: v === 0 ? C.ink : C.muted, bold: v === 0 }));
    }
    ["Købsåret", "+1 år", "+2 år", "+3 år", "+4 år", "+5 år"].forEach((n, i) => labels.push(p(xs(i) - 80, H - B + 16, 160, n, { align: "center" })));
    const desc = [];
    series.forEach(([name, vals, color]) => {
      desc.push(`${name}: ${vals.map((v) => Math.round(v / 1000)).join(" / ")}`);
      body += `<polyline points="${vals.map((v, i) => `${r1(xs(i))},${r1(y(v))}`).join(" ")}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = vals.length - 1;
      body += `<circle cx="${r1(xs(last))}" cy="${r1(y(vals[last]))}" r="9" fill="${color}" stroke="${C.surface}" stroke-width="4"/>`;
      labels.push(p(xs(last) + 22, y(vals[last]) - 16, 280, `${vals[last] > 0 ? "+" : "−"}${kr(Math.abs(vals[last]) / 1000)} t.kr.`, { color: C.ink, bold: true, nowrap: true }));
    });
    console.log("C12", desc.join(" | "));
    console.log("C12 spend per 30 days: EU", Math.round(J.EU.spend30), "DE+FR+IT", Math.round(entrySpend));
    write("c12-jcurve", W, H, svg(W, H, `Nettoresultat pr. 100.000 kr. brugt på Meta, tusind kr., ved 45 % dækningsgrad. ${desc.join(". ")}.`, body), labels);
  }
}
