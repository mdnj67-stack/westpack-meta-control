import { OBJECTIVE_GROUP_LABELS, resolveObjectiveGroupLabel } from "./meta-objectives.js?v=20260904-metaobjectives1";

export function renderStats(stats) {
  const grid = document.getElementById("stats-grid");
  if (!grid) return;

  const showKpiLayout = Array.isArray(stats) && stats.length >= 5 && stats.some((item) => item?.change);
  const showCompactLayout = Array.isArray(stats) && stats.length <= 4 && stats.every((item) => item?.compact);
  grid.classList.toggle("stats-grid-kpi", showKpiLayout);
  grid.classList.toggle("stats-grid-compact", showCompactLayout);

  grid.innerHTML = stats.map((item) => `
    <article class="stat-card">
      <div class="stat-head">
        <p class="section-label">${item.label}</p>
        ${renderChangeBadge(item.change, "stat-change")}
      </div>
      <div class="stat-value">${item.value}</div>
      <p class="stat-meta">${item.meta}</p>
      ${item.change?.label ? `<p class="stat-compare">${escapeHtml(item.change.label)}</p>` : ""}
    </article>
  `).join("");
}

function getChangeArrow(direction = "") {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  if (direction === "new") return "↗";
  return "→";
}

function renderChangeBadge(change, className) {
  if (!change) return "";
  return `
    <span class="${className} tone-${escapeHtml(change.tone || "neutral")}">
      <span class="${className}-arrow" aria-hidden="true">${escapeHtml(getChangeArrow(change.direction || "flat"))}</span>
      <span>${escapeHtml(change.value || "--")}</span>
    </span>
  `;
}

function formatCompactNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return options.fallback ?? "--";
  return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDecimal(value, fractionDigits = 2, fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function formatPercent(value, fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `${formatDecimal(number, 2)}%`;
}

function formatCurrency(value, currency = "DKK", fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(number);
}

export function renderCampaignTable(campaigns, lens = 'awareness', options = {}) {
  const head = document.getElementById('campaign-table-head');
  const table = document.getElementById('campaign-table');
  if (!table) return;
  if (!head) return;

  const currency = String(options.currency || "DKK").trim().toUpperCase() || "DKK";

  const columns = (() => {
    if (lens === 'general') {
      return [
        { key: 'name', label: 'Campaign' },
        { key: 'category', label: 'Lens' },
        { key: 'spend', label: 'Spend' },
        { key: 'primaryMetric', label: 'Primary KPI' },
        { key: 'efficiency', label: 'Efficiency' },
        { key: 'status', label: 'Status' }
      ];
    }
    if (lens === 'conversion_incremental' || lens === 'conversion_standard') {
      return [
        { key: 'name', label: 'Campaign' },
        { key: 'spend', label: 'Spend' },
        { key: 'newCustomers', label: 'New customers' },
        { key: 'costPerNewCustomer', label: 'Cost / new' },
        { key: 'cpa', label: 'CPA' },
        { key: 'roas', label: 'ROAS' },
        { key: 'status', label: 'Status' }
      ];
    }
    if (lens === 'leads') {
      return [
        { key: 'name', label: 'Campaign' },
        { key: 'spend', label: 'Spend' },
        { key: 'leads', label: 'Leads' },
        { key: 'cpl', label: 'CPL' },
        { key: 'ctr', label: 'CTR' },
        { key: 'status', label: 'Status' }
      ];
    }
    return [
      { key: 'name', label: 'Campaign' },
      { key: 'spend', label: 'Spend' },
      { key: 'reach', label: 'Reach' },
      { key: 'freq', label: 'Frequency' },
      { key: 'cpm', label: 'CPM' },
      { key: 'status', label: 'Status' }
    ];
  })();

  head.innerHTML = `
    <tr>
      ${columns.map((col) => `<th>${col.label}</th>`).join('')}
    </tr>
  `;

  table.innerHTML = (campaigns || []).map((campaign) => {
    const spendValue = campaign.spendValue ?? campaign.spend_value;
    const reachValue = campaign.reachValue ?? campaign.reach_value;
    const frequencyValue = campaign.frequencyValue ?? campaign.frequency_value;
    const cpmValue = campaign.cpmValue ?? campaign.cpm_value;
    const purchasesValue = campaign.purchasesValue ?? campaign.purchases_value;
    const revenueValue = campaign.revenueValue ?? campaign.revenue_value;
    const roasValue = campaign.roasValue ?? campaign.roas_value;
    const cpaValue = campaign.cpaValue ?? campaign.cpa_value;
    const leadsValue = campaign.leadsValue ?? campaign.leads_value;
    const cplValue = campaign.cplValue ?? campaign.cpl_value;
    const ctrValue = campaign.ctrValue ?? campaign.ctr_value;
    const newCustomersValue = campaign.newCustomersValue ?? campaign.new_customers_value;
    // Spend per new customer for this campaign. Left blank rather than shown as zero when
    // the campaign brought none, because a cost per customer of nothing is not a bargain.
    const newCustomerCount = Number(newCustomersValue);
    const spendNumber = Number(spendValue);
    const costPerNewCustomerValue = Number.isFinite(newCustomerCount) && newCustomerCount > 0
        && Number.isFinite(spendNumber)
      ? spendNumber / newCustomerCount
      : null;
    const categoryValue = campaign.category ?? campaign.lens ?? '';
    const primaryMetricValue = campaign.primaryMetric ?? '--';
    const efficiencyValue = campaign.efficiencyMetric ?? '--';

    const cells = columns.map((col) => {
      if (col.key === 'name') {
        return `<td>${escapeHtml(campaign.name || '')}</td>`;
      }
      if (col.key === 'spend') {
        return `<td>${formatCurrency(spendValue, currency)}</td>`;
      }
      if (col.key === 'category') {
        return `<td>${escapeHtml(formatLensLabel(categoryValue))}</td>`;
      }
      if (col.key === 'primaryMetric') {
        return `<td>${escapeHtml(primaryMetricValue)}</td>`;
      }
      if (col.key === 'efficiency') {
        return `<td>${escapeHtml(efficiencyValue)}</td>`;
      }
      if (col.key === 'reach') {
        return `<td>${formatCompactNumber(reachValue)}</td>`;
      }
      if (col.key === 'freq') {
        return `<td>${formatDecimal(frequencyValue, 2)}</td>`;
      }
      if (col.key === 'cpm') {
        return `<td>${formatCurrency(cpmValue, currency)}</td>`;
      }
      if (col.key === 'purchases') {
        return `<td>${formatCompactNumber(purchasesValue)}</td>`;
      }
      if (col.key === 'newCustomers') {
        return `<td>${formatCompactNumber(newCustomersValue)}</td>`;
      }
      if (col.key === 'costPerNewCustomer') {
        return `<td>${costPerNewCustomerValue === null ? "--" : formatCurrency(costPerNewCustomerValue, currency)}</td>`;
      }
      if (col.key === 'cpa') {
        return `<td>${formatCurrency(cpaValue, currency)}</td>`;
      }
      if (col.key === 'roas') {
        return `<td>${formatDecimal(roasValue, 2)}</td>`;
      }
      if (col.key === 'leads') {
        return `<td>${formatCompactNumber(leadsValue)}</td>`;
      }
      if (col.key === 'cpl') {
        return `<td>${formatCurrency(cplValue, currency)}</td>`;
      }
      if (col.key === 'ctr') {
        return `<td>${formatPercent(ctrValue)}</td>`;
      }
      if (col.key === 'status') {
        // Meta's own delivery state. The old code printed a fixed "Healthy" for every
        // row and styled a 'Watch' value the server never produced, so the column said
        // the same thing whether a campaign was running, paused or rejected.
        const status = campaign.status || 'Unknown';
        const raw = String(campaign.effective_status || '').toUpperCase();
        const attention = raw && raw !== 'ACTIVE';
        return `
          <td>
            <span class="campaign-status ${attention ? 'attention' : ''}">
              ${escapeHtml(status)}
            </span>
          </td>
        `;
      }
      return '<td>--</td>';
    }).join('');

    return `<tr>${cells}</tr>`;
  }).join('');
}

export function renderCardList(targetId, items, className) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }
  target.innerHTML = items.map((item) => `
    <article class="${className}">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
    </article>
  `).join("");
}

export function renderAuditLog(auditLog) {
  const target = document.getElementById("audit-list");
  if (!target) {
    return;
  }
  target.innerHTML = auditLog.map((item) => `
    <article class="audit-item">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
      <time>${item.time}</time>
    </article>
  `).join("");
}

export function renderCampaignMatches(campaignMatches) {
  const target = document.getElementById("match-list");
  if (!target) {
    return;
  }
  target.innerHTML = campaignMatches.map((item) => `
    <article class="match-item">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
      <p>${item.reason}</p>
    </article>
  `).join("");
}

export function renderSelectors({ ads, campaigns, adaptationGoals }) {
  const sourceSelect = document.getElementById("dup-source-ad");
  sourceSelect.innerHTML = ads.map((ad) => `
    <option value="${ad.id}">${ad.name} - ${ad.campaign}</option>
  `).join("");

  const duplicateTargetSelect = document.getElementById("dup-target-campaign");
  duplicateTargetSelect.innerHTML = campaigns.map((campaign) => `
    <option value="${campaign.id || campaign.name}">${campaign.name}</option>
  `).join("");

  const createTargetSelect = document.getElementById("create-target-campaign");
  createTargetSelect.innerHTML = campaigns.map((campaign) => `
    <option value="${campaign.id || campaign.name}">${campaign.name}</option>
  `).join("");

  const goalSelect = document.getElementById("dup-adaptation-goal");
  goalSelect.innerHTML = adaptationGoals.map((goal) => `
    <option value="${goal}">${goal}</option>
  `).join("");
}

export function renderAdSetSelector(adSets, mode = "duplicate") {
  const target = document.getElementById(mode === "create" ? "create-target-adset" : "dup-target-adset");
  if (!target) {
    return;
  }
  target.innerHTML = adSets.map((adSet) => `
    <option value="${adSet.id || adSet.name}">${adSet.name || adSet}</option>
  `).join("");
}

export function setDashboardHero({ kicker, title, subtitle, tableTitle }) {
  const kickerNode = document.getElementById("dashboard-hero-kicker");
  const titleNode = document.getElementById("dashboard-hero-title");
  const subtitleNode = document.getElementById("dashboard-hero-subtitle");
  const tableTitleNode = document.getElementById("dashboard-table-title");
  if (kickerNode) kickerNode.textContent = kicker || "";
  if (titleNode) titleNode.textContent = title;
  if (subtitleNode) subtitleNode.textContent = subtitle;
  if (tableTitleNode) tableTitleNode.textContent = tableTitle;
}

// A lens with no campaigns in the selected range needs to say so somewhere the operator
// can actually see it. The previous version wrote this explanation into the executive
// brief, which sat inside a container the render then hid, so the page just went quiet.
export function renderLensEmptyState(copy = null, rangeLabel = "") {
  const node = document.getElementById("dashboard-lens-empty");
  if (!node) return;

  if (!copy) {
    node.innerHTML = "";
    node.hidden = true;
    return;
  }

  node.hidden = false;
  node.innerHTML = `
    <h4>${escapeHtml(copy.headline || "No campaigns in this view")}</h4>
    <p>${escapeHtml(copy.body || "")}</p>
    <p class="lens-empty-meta">Selected range: ${escapeHtml(rangeLabel || "not set")}. ${escapeHtml(copy.nextStep || "")}</p>
  `;
}

export function renderCampaignPulse(rows = []) {
  const node = document.getElementById("campaign-pulse-list");
  if (!node) return;
  if (!itemsHaveLength(rows)) {
    node.innerHTML = "";
    return;
  }

  node.innerHTML = rows.map((row) => `
    <article class="pulse-row tone-${escapeHtml(row.tone || "neutral")}" data-action="${escapeHtml((row.action || "Review").toLowerCase())}">
      <div class="pulse-main">
        <div class="pulse-copy">
          <div class="pulse-title-row">
            <strong>${escapeHtml(row.name || "")}</strong>
            <span class="pulse-badge">${escapeHtml(row.action || "Review")}</span>
          </div>
          <p>${escapeHtml(row.note || "")}</p>
        </div>
        <div class="pulse-metrics">
          <div>
            <span>${escapeHtml(row.primaryLabel || "")}</span>
            <strong>${escapeHtml(row.primaryValue || "--")}</strong>
          </div>
          <div>
            <span>${escapeHtml(row.secondaryLabel || "")}</span>
            <strong>${escapeHtml(row.secondaryValue || "--")}</strong>
          </div>
        </div>
      </div>
      <div class="pulse-bar">
        <span style="width:${Math.max(6, Math.min(100, Number(row.scorePercent) || 0))}%"></span>
      </div>
    </article>
  `).join("");
}

export function renderMetaQualityPanel(items = []) {
  const node = document.getElementById("dashboard-quality-grid");
  const section = document.getElementById("dashboard-quality-section");
  if (!node || !section) return;
  if (!itemsHaveLength(items)) {
    node.innerHTML = "";
    section.hidden = true;
    return;
  }

  section.hidden = false;
  node.innerHTML = items.map((item) => `
    <article class="pressure-group tone-${escapeHtml(item.tone || "neutral")}">
      <div class="pressure-group-top">
        <strong>${escapeHtml(item.title || "")}</strong>
        <span>${escapeHtml(item.meta || "")}</span>
      </div>
      <p>${escapeHtml(item.body || "")}</p>
    </article>
  `).join("");
}

export function renderOverviewGrid(cards = [], visible = false) {
  const grid = document.getElementById("overview-grid");
  if (!grid) return;

  grid.hidden = !visible;
  if (!visible) {
    return;
  }

  cards.forEach((card) => {
    const key = card.key;
    const metaNode = document.getElementById(`overview-${key}-meta`);
    const metricNode = document.getElementById(`overview-${key}-metric`);
    const listNode = document.getElementById(`overview-${key}-list`);

    if (metaNode) metaNode.textContent = card.meta || "";
    if (metricNode) metricNode.textContent = card.metric || "--";
    if (listNode) {
      listNode.innerHTML = (card.items || []).map((item) => `
        <div class="overview-item">
          <strong>${escapeHtml(item.label || "")}</strong>
          <span>${escapeHtml(item.value || "--")}</span>
        </div>
      `).join("");
    }
  });
}

const OBJECTIVE_TONES = {
  awareness: "awareness",
  traffic: "traffic",
  engagement: "engagement",
  leads: "leads",
  conversion: "conversion",
  app_promotion: "app-promotion",
  unclassified: "unclassified"
};

function resolveObjectiveTone(key) {
  return OBJECTIVE_TONES[String(key || "")] || "neutral";
}

// Segment widths have to add up to 100% or the rendered bar contradicts the percentages
// printed next to it. A flat `Math.max(5, pct)` floor per segment overflowed the track
// whenever one objective was small, so the floor is applied and then the whole set is
// rescaled, with the rounding remainder absorbed by the largest segment.
function buildStackSegments(items = [], valueKey = "amount", minimumPercent = 4) {
  const values = items.map((item) => Math.max(0, Number(item?.[valueKey]) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) {
    return items.map((item) => ({ item, width: 0 }));
  }

  const visible = values.map((value) => (value > 0 ? Math.max(minimumPercent, (value / total) * 100) : 0));
  const visibleTotal = visible.reduce((sum, value) => sum + value, 0);
  const scaled = visible.map((value) => (visibleTotal > 0 ? (value / visibleTotal) * 100 : 0));

  const largestIndex = scaled.reduce((best, value, index) => (value > scaled[best] ? index : best), 0);
  const rounded = scaled.map((value) => Number(value.toFixed(2)));
  const drift = Number((100 - rounded.reduce((sum, value) => sum + value, 0)).toFixed(2));
  if (rounded[largestIndex] > 0) {
    rounded[largestIndex] = Number((rounded[largestIndex] + drift).toFixed(2));
  }

  return items.map((item, index) => ({ item, width: rounded[index] }));
}

// Nyt reach: the people the incremental campaigns reached for the first time
// each month, against the people they had already reached. The split is the
// expansion signal - when the repeat share climbs while net-new falls, the
// audience is saturating and more budget buys the same faces again.
//
// The series comes from the stored nightly snapshot, never from a live call:
// the cumulative curve behind it costs one Meta call per month, which is more
// than the whole dashboard snapshot spends.
// --- Expansion reach -----------------------------------------------------
//
// Two surfaces over one stored snapshot: a summary card on General and a tab of
// its own. Both obey the same rules.
//
//  - The series is always calendar months from the anchor. It does not follow
//    the dashboard's date picker, and it says so, because a reach figure sitting
//    under a "Last 7 days" selector otherwise reads as a figure for last 7 days.
//  - The month in progress is a part month. It is never set against a complete
//    month: the comparison is the same elapsed days of the month before,
//    measured separately by the nightly job.
//  - The snapshot is nightly. Its age is stated, and goes to the warning colour
//    once it is old enough that the figures may have moved, because a failed
//    cron otherwise leaves yesterday's numbers on screen indefinitely.

const EXPANSION_STALE_HOURS = 36;

function expansionMonthName(monthKey) {
  const [year, index] = String(monthKey).split("-");
  const date = new Date(Date.UTC(Number(year), Number(index) - 1, 1));
  if (Number.isNaN(date.getTime())) return String(monthKey);
  return date.toLocaleString(undefined, { month: "short", timeZone: "UTC" });
}

// Danish abbreviates months with a trailing point ("sep."), which reads as a
// sentence break when the label is dropped into prose.
function expansionMonthProse(monthKey) {
  return expansionMonthName(monthKey).replace(/\.$/, "");
}

// Number(null) is 0, and 0 is finite. A null from the server means "this could
// not be measured", and rendering it as a measured zero says something the
// account never reported - a month with no new customers and a month where new
// customers could not be counted are different facts.
function expansionMeasured(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function expansionRowDays(row) {
  const stored = Number(row?.days);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const from = Date.parse(`${row?.since}T00:00:00Z`);
  const to = Date.parse(`${row?.until}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.round((to - from) / 86400000) + 1;
}

function expansionDayRange(row) {
  const from = Number(String(row.since).slice(8, 10));
  const to = Number(String(row.until).slice(8, 10));
  return `${from}-${to} ${expansionMonthProse(row.month)}`;
}

function describeSnapshotAge(generatedAt) {
  if (!generatedAt) return { label: "Never synced", stale: true, iso: "" };
  const synced = new Date(generatedAt);
  if (Number.isNaN(synced.getTime())) return { label: "Never synced", stale: true, iso: "" };
  const hours = (Date.now() - synced.getTime()) / 3600000;
  const stale = hours >= EXPANSION_STALE_HOURS;
  const rounded = Math.max(0, Math.round(hours));
  const label = rounded < 1
    ? "Synced under an hour ago"
    : rounded < 48
      ? `Synced ${rounded} hour${rounded === 1 ? "" : "s"} ago`
      : `Synced ${Math.round(rounded / 24)} days ago`;
  return { label, stale, iso: synced.toLocaleString(), hours: rounded };
}

// A percentage needs a real baseline. A market with no delivery in the baseline
// window is new, not infinitely improved, and the caption has to say which.
// `invert` is for costs, where a rise is the bad direction. Colouring a rising
// cost per thousand green would read as good news for the opposite of it.
function expansionChangeBadge(change, comparable, suffix = "", invert = false, emptyLabel = "New") {
  if (!comparable) return `<span class="meta-expansion-badge is-new-market">${emptyLabel}${suffix}</span>`;
  if (!Number.isFinite(Number(change))) return "";
  const value = Number(change) * 100;
  const good = invert ? value < 0 : value > 0;
  const tone = value === 0 ? "is-flat" : good ? "is-up" : "is-down";
  const sign = value > 0 ? "+" : "";
  return `<span class="meta-expansion-badge ${tone}">${sign}${value.toFixed(1)}%${suffix}</span>`;
}

function expansionFreshnessStrip(model) {
  const age = describeSnapshotAge(model?.generatedAt);
  return `
    <p class="meta-expansion-freshness${age.stale ? " is-stale" : ""}">
      <span>${escapeHtml(age.label)}</span>
      ${age.iso ? `<span class="is-quiet">${escapeHtml(age.iso)}</span>` : ""}
      ${age.stale ? `<span class="is-warn">The nightly sync has not landed. These figures may have moved.</span>` : ""}
    </p>
  `;
}

// The stacked bar chart. The month in progress is hatched and its tick carries
// the day range rather than a bare month name, because it is a shorter bar for a
// shorter window and must not read as a complete month.
function expansionBars(months, options = {}) {
  const peak = Math.max(...months.map((month) => Number(month.monthlyReach) || 0), 1);
  return `
    <ol class="meta-expansion-bars">
      ${months.map((month) => {
        const monthly = Number(month.monthlyReach) || 0;
        const net = Math.max(0, Number(month.netNewReach) || 0);
        const repeat = Math.max(0, Number(month.repeatReach) || 0);
        const height = Math.max(2, (monthly / peak) * 100);
        const netShare = monthly > 0 ? Math.min(100, (net / monthly) * 100) : 0;
        const tick = month.partial ? expansionDayRange(month) : expansionMonthName(month.month);
        const title = `${month.month}${month.partial ? ` (${expansionDayRange(month)})` : ""}: ${formatCompactNumber(net)} first-time, ${formatCompactNumber(repeat)} repeat`;
        return `
          <li class="meta-expansion-bar${month.partial ? " is-partial" : ""}" title="${escapeHtml(title)}">
            <span class="meta-expansion-column" style="height:${height.toFixed(1)}%">
              <em class="is-repeat" style="height:${(100 - netShare).toFixed(1)}%"></em>
              <em class="is-new" style="height:${netShare.toFixed(1)}%"></em>
            </span>
            <span class="meta-expansion-tick">${escapeHtml(tick)}</span>
          </li>
        `;
      }).join("")}
    </ol>
    <p class="meta-expansion-legend">
      <span class="is-new">First-time</span>
      <span class="is-repeat">Repeat</span>
      ${options.partialNote ? `<span class="is-note">${escapeHtml(options.partialNote)}</span>` : ""}
    </p>
  `;
}

// A market's own curve, drawn small enough to sit in a table cell. Every market
// is scaled to the same peak, so the rows can be read against each other.
function expansionSparkline(months, peak, key = "netNewReach") {
  // A stored snapshot can lag the code that reads it, so a series that is not a
  // series draws nothing rather than taking the whole tab down with it.
  if (!Array.isArray(months) || !months.length) return "";
  return `
    <span class="meta-expansion-spark" aria-hidden="true">
      ${months.map((month) => {
        const value = Math.max(0, Number(month[key]) || 0);
        const height = peak > 0 ? Math.max(3, (value / peak) * 100) : 3;
        return `<em class="${month.partial ? "is-partial" : ""}" style="height:${height.toFixed(1)}%"></em>`;
      }).join("")}
    </span>
  `;
}

export function renderOverviewExpansionReach(model = null, visible = false, currency = "DKK") {
  const node = document.getElementById("overview-expansion");
  const subNode = document.getElementById("overview-expansion-sub");
  if (!node) return;

  const months = Array.isArray(model?.months) ? model.months.filter((month) => Number(month?.monthlyReach) > 0) : [];
  if (!visible || !model?.available || months.length < 2) {
    node.innerHTML = "";
    if (subNode && visible && model && !model.available) {
      subNode.textContent = model.unavailableReason || "No campaign on this account reports incrementality attribution.";
    }
    return;
  }

  const latest = months[months.length - 1];
  const anchorLabel = months[0]?.month || "";
  const likeForLike = model.likeForLike && model.likeForLike.comparison?.month === latest.month
    ? model.likeForLike
    : null;

  if (subNode) {
    subNode.textContent = `Unique people the ${Number(model.campaignCount) || 0} incrementality campaigns have reached since ${anchorLabel}, split into first-time and repeat. Always whole calendar months - this panel does not follow the date picker above.`;
  }

  // The headline comparison is like-for-like or it is absent. Setting a part
  // month against a complete one is the trap this dashboard avoids elsewhere.
  const comparisonLine = latest.partial
    ? (likeForLike
      ? `${expansionDayRange(latest)}, against ${formatCompactNumber(likeForLike.netNewReach)} over the same ${likeForLike.elapsedDays} days of ${expansionMonthProse(likeForLike.month)}`
      : `${expansionDayRange(latest)}. No like-for-like baseline was measured, so there is nothing honest to compare against yet.`)
    : `${expansionMonthProse(latest.month)}, against ${formatCompactNumber(months[months.length - 2].netNewReach)} in ${expansionMonthProse(months[months.length - 2].month)}`;

  const costLabel = expansionMeasured(latest.costPerThousandNewlyReached)
    ? formatCurrency(Math.round(Number(latest.costPerThousandNewlyReached)), currency)
    : "--";
  const repeatShare = expansionMeasured(latest.repeatShare)
    ? `${Math.round(Number(latest.repeatShare) * 100)}%`
    : "--";

  node.innerHTML = `
    <section class="meta-expansion">
      ${expansionFreshnessStrip(model)}
      <div class="meta-expansion-kpis">
        <article class="meta-expansion-kpi is-lead">
          <span>Reached for the first time</span>
          <strong>${escapeHtml(formatCompactNumber(latest.netNewReach))}</strong>
          <p>${escapeHtml(comparisonLine)}</p>
          ${likeForLike ? expansionChangeBadge(likeForLike.comparison.change, likeForLike.comparison.comparable, " like for like") : ""}
        </article>
        <article class="meta-expansion-kpi">
          <span>Unique people in total</span>
          <strong>${escapeHtml(formatCompactNumber(latest.cumulativeReach))}</strong>
          <p>Deduplicated across every incremental campaign since ${escapeHtml(anchorLabel)}.</p>
        </article>
        <article class="meta-expansion-kpi">
          <span>Cost per 1,000 new</span>
          <strong>${escapeHtml(costLabel)}</strong>
          <p>${escapeHtml(latest.partial ? `Spend over first-time reach, ${expansionDayRange(latest)}.` : "Spend over first-time reach. The price of expansion.")}</p>
        </article>
        <article class="meta-expansion-kpi">
          <span>Repeat share</span>
          <strong>${escapeHtml(repeatShare)}</strong>
          <p>Of the people reached in ${escapeHtml(latest.partial ? expansionDayRange(latest) : expansionMonthProse(latest.month))}, the share already reached before.</p>
        </article>
      </div>

      <div class="meta-expansion-chart">
        <div class="meta-budget-stack-head">
          <strong>Reach per month</strong>
          <span>First-time against repeat</span>
        </div>
        ${expansionBars(months, {
          partialNote: latest.partial ? `${latest.since} to ${latest.until}, part month` : ""
        })}
      </div>

      <p class="meta-expansion-foot">
        Reach is read at account level and never summed across campaigns. First-time reach is
        the rise in cumulative unique reach, so it counts people reached for the first time
        since ${escapeHtml(anchorLabel)}. Open the Expansion tab for the market split, the
        cost curve and the measurement record.
      </p>
    </section>
  `;
}

// The Expansion tab. Everything the summary card leaves out: the market split,
// the cost of reaching one more person, whether new reach becomes customers, and
// the record of what the measurement itself has done.
export function renderExpansionView(model = null, visible = false, currency = "DKK", errorMessage = "") {
  const node = document.getElementById("expansion-content");
  if (!node) return;

  if (!visible) {
    node.innerHTML = "";
    return;
  }

  if (!model) {
    node.innerHTML = `
      <article class="card">
        <div class="lens-empty">
          <h4>Expansion reach is not loaded</h4>
          <p>This view reads a nightly snapshot rather than the live account, so it costs no Meta quota. Nothing has been stored yet, or the read did not come back.</p>
          ${errorMessage ? `<p class="lens-empty-meta">${escapeHtml(errorMessage)}</p>` : ""}
        </div>
      </article>
    `;
    return;
  }

  if (!model.available) {
    node.innerHTML = `
      <article class="card">
        <div class="lens-empty">
          <h4>No incrementality campaigns to measure</h4>
          <p>${escapeHtml(model.unavailableReason || "No campaign on this account reports incrementality attribution.")}</p>
        </div>
      </article>
    `;
    return;
  }

  const months = (model.months || []).filter((month) => Number(month?.monthlyReach) > 0);
  if (months.length < 1) {
    node.innerHTML = `
      <article class="card"><div class="lens-empty"><h4>Nothing delivered yet</h4>
      <p>The incremental set exists but has not reached anyone inside the window.</p></div></article>
    `;
    return;
  }

  const latest = months[months.length - 1];
  const anchorLabel = months[0].month;
  const likeForLike = model.likeForLike && model.likeForLike.comparison?.month === latest.month
    ? model.likeForLike
    : null;
  const perDay = (row) => {
    const days = expansionRowDays(row);
    return days > 0 ? Number(row.netNewReach) / days : null;
  };

  node.innerHTML = `
    ${renderExpansionHeader(model, latest, likeForLike, anchorLabel, currency)}
    ${renderExpansionCustomerCurve(months, latest, currency)}
    ${renderExpansionMarkets(model, latest, likeForLike, currency)}
    ${renderExpansionCurve(months, latest)}
    ${renderExpansionMonths(months, model, currency, perDay)}
    ${renderExpansionRestatements(model)}
  `;

  bindExpansionTips(node);
}

function renderExpansionHeader(model, latest, likeForLike, anchorLabel, currency) {
  // New customers is the figure the department is measured on, so it is shown as
  // the count it is rather than as a rate per thousand reached. The rate read as
  // a conversion rate on the newly reached, which it is not: a person first
  // reached two days ago has had two days to buy, and most of a month's
  // customers were first reached in an earlier month. The count against the same
  // elapsed days of the previous month is a comparison that holds.
  const customerCaption = (() => {
    if (!model.customerConversion) {
      return "This snapshot was written before new customers were measured here. The nightly job adds the figure on its next run.";
    }
    if (!model.customerConversion.available) {
      return model.customerConversion.unavailableReason || "New customers cannot be counted on this account.";
    }
    if (likeForLike && likeForLike.newCustomers != null) {
      return `Against ${formatCompactNumber(likeForLike.newCustomers)} over the same ${likeForLike.elapsedDays} days of ${expansionMonthProse(likeForLike.month)}. Attributed to these campaigns, not only to the people newly reached.`;
    }
    return "Attributed to these campaigns in this window. Not a cohort of the people newly reached in it.";
  })();

  // The like-for-like cost per new customer is the honest read on whether a
  // market is getting harder: both sides cover the same number of days, and it
  // moves with the business rather than with the budget.
  const customerCostChange = likeForLike && Number(likeForLike.costPerNewCustomer) > 0 && expansionMeasured(latest.costPerNewCustomer)
    ? (Number(latest.costPerNewCustomer) - Number(likeForLike.costPerNewCustomer)) / Number(likeForLike.costPerNewCustomer)
    : null;

  // How many countries actually produced a customer, against how many were
  // reached at all. With broad targeting into a narrow business audience the
  // gap between those two is the whole point.
  const marketsWithCustomers = model.customerConversion?.available
    ? (model.marketSeries || []).filter((market) => Number(market.windows?.all?.newCustomers) > 0).length
    : null;

  const windowLine = latest.partial
    ? `${expansionDayRange(latest)} - the month in progress, ${expansionRowDays(latest)} of its days`
    : `${expansionMonthProse(latest.month)}, complete month`;

  return `
    <article class="card expansion-card">
      <div class="card-header">
        <div>
          <h3>Expansion</h3>
          <p class="field-hint">
            New customers by market since ${escapeHtml(anchorLabel)}, and what they cost. Whole calendar
            months - this view does not follow the date range above. It currently covers the
            ${Number(model.campaignCount) || 0} campaigns Meta reports on incrementality attribution, which is
            a grouping and not a measured uplift; reach figures here are a diagnostic, because these ad sets
            target a country and nothing else.
          </p>
        </div>
      </div>
      <section class="meta-expansion">
      ${expansionFreshnessStrip(model)}
      <p class="meta-expansion-window">${escapeHtml(windowLine)}</p>
      <div class="meta-expansion-kpis is-wide">
        <article class="meta-expansion-kpi">
          <span>New customers</span>
          <strong>${escapeHtml(latest.newCustomers == null ? "--" : formatCompactNumber(latest.newCustomers))}</strong>
          <p>${escapeHtml(customerCaption)}</p>
          ${likeForLike && likeForLike.comparison.customersComparable
            ? expansionChangeBadge(likeForLike.comparison.newCustomersChange, true)
            : ""}
        </article>
        <article class="meta-expansion-kpi">
          <span>Cost per new customer</span>
          <strong>${escapeHtml(expansionMeasured(latest.costPerNewCustomer)
            ? formatCurrency(Math.round(Number(latest.costPerNewCustomer)), currency)
            : "--")}</strong>
          <p>${escapeHtml(likeForLike && expansionMeasured(likeForLike.costPerNewCustomer)
            ? `Against ${formatCurrency(Math.round(Number(likeForLike.costPerNewCustomer)), currency)} over the same days of ${expansionMonthProse(likeForLike.month)}. All spend, not only what reached them.`
            : "The window's whole spend over its new customers. All of it, not only the spend that reached them.")}</p>
          ${customerCostChange === null ? "" : expansionChangeBadge(customerCostChange, true, "", true)}
        </article>
        <article class="meta-expansion-kpi">
          <span>Markets producing customers</span>
          <strong>${escapeHtml(marketsWithCustomers == null ? "--" : String(marketsWithCustomers))}</strong>
          <p>${escapeHtml(marketsWithCustomers == null
            ? "New customers cannot be counted on this account."
            : `Of ${model.marketCount || 0} countries with delivery since ${anchorLabel}. The rest were reached and bought nothing.`)}</p>
        </article>
        <article class="meta-expansion-kpi">
          <span>Reached for the first time</span>
          <strong>${escapeHtml(formatCompactNumber(latest.netNewReach))}</strong>
          <p>A diagnostic, not a goal: the targeting is broad, so almost none of these people were ever possible customers.</p>
        </article>
      </div>
      </section>
    </article>
  `;
}

// New customers per month, which is what the department is measured on and the
// only figure on this tab that is budget-neutral. A market getting harder shows
// up here as customers flattening while their cost rises - reach cannot say
// that, because the targeting is broad and almost everyone it counts was never
// a possible customer.
function renderExpansionCustomerCurve(months, latest, currency) {
  const rows = months.filter((month) => month.newCustomers != null);
  if (rows.length < 2) {
    return `
    <article class="card expansion-card">
      <div class="card-header"><div><h3>New customers per month</h3>
      <p class="field-hint">New customers could not be counted for enough months to draw a series.</p></div></div>
    </article>`;
  }

  const peak = Math.max(...rows.map((month) => Number(month.newCustomers) || 0), 1);
  return `
    <article class="card expansion-card">
      <div class="card-header">
        <div>
          <h3>New customers per month</h3>
          <p class="field-hint">
            Purchases matching the New_customer conversion, across the whole account. About a fifth of
            purchases match neither customer conversion, so each month is a floor rather than a total.
            The month in progress is hatched and covers fewer days than the ones beside it.
          </p>
        </div>
      </div>
      <section class="meta-expansion">
        <div class="meta-expansion-chart">
          <ol class="meta-expansion-bars">
            ${rows.map((month) => {
              const value = Number(month.newCustomers) || 0;
              const height = Math.max(2, (value / peak) * 100);
              const tick = month.partial ? expansionDayRange(month) : expansionMonthName(month.month);
              const cost = expansionMeasured(month.costPerNewCustomer)
                ? `, ${formatCurrency(Math.round(Number(month.costPerNewCustomer)), currency)} each`
                : "";
              return `
                <li class="meta-expansion-bar${month.partial ? " is-partial" : ""}"
                    title="${escapeHtml(`${month.month}: ${formatCompactNumber(value)} new customers${cost}`)}">
                  <span class="meta-expansion-column" style="height:${height.toFixed(1)}%">
                    <em class="is-new" style="height:100%"></em>
                  </span>
                  <span class="meta-expansion-tick">${escapeHtml(tick)}</span>
                  <span class="meta-expansion-value">${escapeHtml(formatCompactNumber(value))}</span>
                </li>`;
            }).join("")}
          </ol>
          <p class="meta-expansion-legend">
            <span class="is-new">New customers</span>
            ${latest.partial ? `<span class="is-note">${escapeHtml(`${latest.since} to ${latest.until}, part month`)}</span>` : ""}
          </p>
        </div>
      </section>
    </article>
  `;
}

function renderExpansionCurve(months, latest) {
  return `
    <article class="card expansion-card">
      <div class="card-header">
        <div>
          <h3>Reach per month</h3>
          <p class="field-hint">
            A diagnostic, not a goal. These ad sets target a country and nothing else, so almost everyone
            counted here was never a possible customer - a rising bar is not progress on its own. What it
            does say is whether the budget bought new impressions or repetition. First-time against repeat;
            the month in progress is hatched.
          </p>
        </div>
      </div>
      <section class="meta-expansion">
        <div class="meta-expansion-chart">
          ${expansionBars(months, {
            partialNote: latest.partial ? `${latest.since} to ${latest.until}, part month` : ""
          })}
        </div>
      </section>
    </article>
  `;
}

// Every column in these tables carries a definition that changes how the figure
// should be read - which window it covers, whether it may be added up, what it
// is a floor rather than a total of. A header alone cannot say that, and a
// paragraph above the table is the panel that was just removed for being noise.
// The explanation therefore lives on the header it belongs to, out of the way
// until asked for. tabindex makes it reachable without a mouse, which is also
// what makes it tappable on a phone.
// Which edge the bubble hangs from comes from the column's position in the row,
// not from its text alignment. Anchoring it to the right because the figures are
// right-aligned pushed a 280px bubble leftwards out of the container from narrow
// columns near the left edge - measured at 168px outside on "Days". Columns in
// the first half hang left, the rest hang right, so the bubble always opens into
// the table rather than off it.
function expansionHeadRow(columns) {
  const half = columns.length / 2;
  return columns.map(([label, tip, numeric], index) => {
    const classes = [numeric ? "is-numeric" : "", "has-tip", index >= half ? "tip-end" : "tip-start"]
      .filter(Boolean)
      .join(" ");
    return `<th class="${classes}" data-tip="${escapeHtml(tip)}" tabindex="0">${escapeHtml(label)}</th>`;
  }).join("\n              ");
}

// Position in the row is a good default, but it cannot know how far the reader
// has scrolled a table that is wider than its container, and on a phone the
// container is narrower than the bubble's own width. So the bubble is nudged
// back inside when it would fall out. An ::after cannot be measured directly,
// but its used `left` and `width` do resolve to pixels, which is enough.
function bindExpansionTips(root) {
  if (!root || root.dataset.tipsBound === "true") return;
  root.dataset.tipsBound = "true";

  const place = (th) => {
    if (!th) return;
    th.style.setProperty("--tip-shift", "0px");
    const wrap = th.closest(".table-wrap");
    if (!wrap) return;
    const style = getComputedStyle(th, "::after");
    const width = parseFloat(style.width);
    const left = th.getBoundingClientRect().left + parseFloat(style.left);
    if (!Number.isFinite(width) || !Number.isFinite(left)) return;

    const bounds = wrap.getBoundingClientRect();
    const overflowRight = left + width - (bounds.right - 8);
    const overflowLeft = (bounds.left + 8) - left;
    const shift = overflowRight > 0 ? -overflowRight : overflowLeft > 0 ? overflowLeft : 0;
    if (shift) th.style.setProperty("--tip-shift", `${Math.round(shift)}px`);
  };

  const handle = (event) => {
    const th = event.target?.closest?.("th.has-tip");
    if (th) place(th);
  };
  root.addEventListener("pointerover", handle);
  root.addEventListener("focusin", handle);
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target?.closest?.("[data-expansion-market]");
    if (!row) return;
    event.preventDefault();
    const code = row.dataset.expansionMarket;
    expansionTableState.openMarket = expansionTableState.openMarket === code ? "" : code;
    redrawExpansionMarkets();
  });

  // Sorting, the window and the show-all toggle all change how the same stored
  // figures are looked at, never what they are, so they redraw the one card
  // rather than asking the server for anything.
  root.addEventListener("click", (event) => {
    const windowButton = event.target?.closest?.("[data-expansion-window]");
    if (windowButton) {
      expansionTableState.window = windowButton.dataset.expansionWindow;
      redrawExpansionMarkets();
      return;
    }

    const showAll = event.target?.closest?.("[data-expansion-show-all]");
    if (showAll) {
      expansionTableState.showAll = showAll.dataset.expansionShowAll === "1";
      redrawExpansionMarkets();
      return;
    }

    const marketRow = event.target?.closest?.("[data-expansion-market]");
    if (marketRow) {
      const code = marketRow.dataset.expansionMarket;
      expansionTableState.openMarket = expansionTableState.openMarket === code ? "" : code;
      redrawExpansionMarkets();
      return;
    }

    const sortHeader = event.target?.closest?.("[data-expansion-sort]");
    if (sortHeader) {
      const key = sortHeader.dataset.expansionSort;
      const column = EXPANSION_MARKET_COLUMNS.find((item) => item.key === key);
      if (expansionTableState.sortKey === key) {
        expansionTableState.sortDirection = expansionTableState.sortDirection === "desc" ? "asc" : "desc";
      } else {
        expansionTableState.sortKey = key;
        // First click on a column sorts it the way that column is read: the
        // largest volume first, the cheapest cost first.
        expansionTableState.sortDirection = column?.high === "down" ? "asc" : "desc";
      }
      redrawExpansionMarkets();
    }
  });
}

function redrawExpansionMarkets() {
  const node = document.getElementById("expansion-markets");
  if (!node) return;
  node.innerHTML = renderExpansionMarketsCard();
}

// The markets table is where the budget decision is actually made, so it is the
// one surface here that carries state: which window it describes, how it is
// sorted, and whether every market is listed or only the ones that moved most.
// That state lives here rather than in appState because none of it is a figure -
// it is how the same stored figures are being looked at.
const expansionTableState = {
  model: null,
  currency: "DKK",
  likeForLike: null,
  latest: null,
  window: "quarter",
  sortKey: "newCustomers",
  sortDirection: "desc",
  showAll: false,
  // Which market is opened to its ads. One at a time: the point is to look at
  // one country closely, not to turn the table into a longer table.
  openMarket: ""
};

const EXPANSION_WINDOWS = [
  ["current", "This month"],
  ["quarter", "Last 3 months"],
  ["all", "Since the anchor"]
];

// A row here has to explain itself, so the table is wide on purpose: the reach
// columns give the customer counts their context. New customers run in single
// digits over three months, and a market with one customer at 733 kr. looks
// like the cheapest on the account until the delivery figures beside it say how
// little was spent to get there.
//
// What changed after cost per thousand reached turned out to be a misleading
// goal - the audience is narrow B2B and the ad sets run broad, so it rewards
// whichever market finds the cheapest strangers - is what the table RANKS on,
// not which columns it carries. It sorts on new customers, the headline is new
// customers, and the price of reach is a diagnostic sitting where it can
// explain why a market is cheap or expensive.
const EXPANSION_MARKET_COLUMNS = [
  {
    key: "label", label: "Market", type: "text",
    tip: "The country Meta attributed the impression to. That is where the person was, not where the campaign was aimed - these ad sets target a country and nothing else."
  },
  {
    key: "newCustomers", label: "New customers", numeric: true, high: "up",
    tip: "Purchases matching the New_customer conversion in this market over the selected window. This is the figure the department is measured on, and what the table sorts by. About a fifth of purchases on this account match neither customer conversion, so it is a floor rather than a total."
  },
  {
    key: "costPerNewCustomer", label: "Cost / new customer", numeric: true, money: true, high: "down",
    tip: "The market's whole spend in the window divided by its new customers. The clearest sign that a market is being worked through: customers flattening while this rises, whatever the budget is doing."
  },
  {
    key: "purchases", label: "Purchases", numeric: true, high: "up",
    tip: "All purchases Meta attributes to this market, new and returning customers together. Events rather than people, so these do add up across the rows."
  },
  {
    key: "spend", label: "Spend", numeric: true, money: true, high: "up",
    tip: "What this market cost over the window. Here to read the cost per customer against, not as a ranking of its own."
  },
  {
    key: "netNewReach", label: "First-time", numeric: true, high: "up",
    tip: "People in this market reached for the first time since the anchor month. The rise in that country's cumulative unique reach across the window, so nobody is counted twice."
  },
  {
    key: "perDay", label: "Per day", numeric: true, high: "up",
    tip: "First-time reach divided by the days the window covers. The column that can be read straight down when the window includes a month still in progress."
  },
  {
    key: "costPerThousandNewlyReached", label: "Cost / 1,000 new", numeric: true, money: true, high: "down",
    tip: "Spend divided by first-time reach. A delivery diagnostic, never a goal: the targeting is broad, so cheap reach means cheap strangers. Italy led this column at 57 kr. per thousand and produced no new customers at all. Read it to explain why a market is cheap or expensive, not to choose between markets."
  },
  {
    key: "latestRepeatShare", label: "Repeat share", numeric: true, percent: true, high: "down",
    tip: "Of the people reached in the window's last month, the share already reached before. It says whether the budget bought repetition or new impressions - not how much of the market is left, which reach cannot measure against an audience this narrow."
  },
  {
    key: "latestFrequency", label: "Frequency", numeric: true, decimals: 1, high: "down",
    tip: "Average impressions per person reached in the window's last month. Read it beside repeat share: both high means the budget is larger than the pool Meta found at this bid."
  },
  {
    key: "cumulativeReach", label: "Unique total", numeric: true, high: "up",
    tip: "Distinct people this market has reached since the anchor month, deduplicated by Meta. Do not add this column up: someone reached in two countries counts in both."
  },
  {
    key: "trend", label: "Trend", sortable: false,
    tip: "First-time reach in each month of the series, oldest on the left. Reach rather than customers, because a sparkline of single digits is noise. Every market is drawn to the same scale, so the rows compare with each other."
  }
];

// An ad set in the learning phase is delivering without much to optimise on,
// and every significant edit restarts it. A market in that state cannot carry a
// decision, and the row has to say so rather than looking like every other row.
function expansionLearningBadge(delivery) {
  const since = delivery.lastSignificantEdit ? new Date(delivery.lastSignificantEdit) : null;
  const sinceLabel = since && !Number.isNaN(since.getTime()) ? since.toLocaleDateString() : "";
  const conversions = delivery.conversionsSinceEdit == null
    ? ""
    : `${delivery.conversionsSinceEdit} conversion${delivery.conversionsSinceEdit === 1 ? "" : "s"} since then. `;
  const tip = `Meta has this market's ad set in its learning phase${sinceLabel ? `, restarted ${sinceLabel}` : ""}. ${conversions}It needs roughly fifty optimisation events a week to leave it, and until it does the figures move for reasons that have nothing to do with the market. Every significant edit starts the clock again.`;
  return `<span class="meta-expansion-badge is-learning has-tip tip-start" data-tip="${escapeHtml(tip)}" tabindex="0">Learning</span>`;
}

function expansionMarketRows(model, windowKey) {
  const series = Array.isArray(model?.marketSeries) ? model.marketSeries : [];
  return series
    .map((market) => {
      const windowRow = market.windows?.[windowKey] || null;
      if (!windowRow) return null;
      const days = Number(windowRow.days) || 0;
      return {
        code: market.code,
        label: market.label,
        firstMonth: market.firstMonth,
        months: market.months,
        perDay: days > 0 ? Math.round(Number(windowRow.netNewReach) / days) : null,
        // Cumulative unique reach is a property of the market, not of the
        // window: it is everyone it has ever reached since the anchor.
        cumulativeReach: market.cumulativeReach,
        ...windowRow
      };
    })
    .filter(Boolean)
    .filter((row) => Number(row.netNewReach) > 0 || Number(row.spend) > 0);
}

function expansionSortRows(rows, key, direction) {
  const column = EXPANSION_MARKET_COLUMNS.find((item) => item.key === key);
  const factor = direction === "asc" ? 1 : -1;
  return rows.slice().sort((left, right) => {
    if (column?.type === "text") {
      return String(left[key] || "").localeCompare(String(right[key] || "")) * factor;
    }
    const a = left[key];
    const b = right[key];
    // A value the account could not report is not a small value. It sorts to
    // the bottom whichever way the column is pointing, rather than reading as
    // the cheapest row in a cost column.
    const aMissing = !expansionMeasured(a);
    const bMissing = !expansionMeasured(b);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return (Number(a) - Number(b)) * factor;
  });
}

function expansionFormatCell(row, column, currency) {
  const value = row[column.key];
  if (!expansionMeasured(value)) return "--";
  if (column.money) {
    const amount = Number(value);
    return Math.abs(amount) < 1 && amount !== 0
      ? formatCurrency(amount, currency)
      : formatCurrency(Math.round(amount), currency);
  }
  if (column.percent) return `${Math.round(Number(value) * 100)}%`;
  if (column.decimals) return formatDecimal(value, column.decimals);
  return formatCompactNumber(value);
}

function renderExpansionMarkets(model, latest, likeForLike, currency) {
  expansionTableState.model = model;
  expansionTableState.currency = currency;
  expansionTableState.likeForLike = likeForLike;
  expansionTableState.latest = latest;
  return `<div id="expansion-markets">${renderExpansionMarketsCard()}</div>`;
}

function renderExpansionMarketsCard() {
  const { model, currency, likeForLike, window: windowKey, sortKey, sortDirection, showAll } = expansionTableState;
  const series = Array.isArray(model?.marketSeries) ? model.marketSeries : [];

  // A stored snapshot from before the market split carries no country data. The
  // card says so rather than disappearing, because a missing panel reads as
  // "no markets" when it really means "not measured yet".
  if (!series.length) {
    return `
    <article class="card expansion-card">
      <div class="card-header"><div><h3>Markets</h3>
      <p class="field-hint">The stored snapshot carries no country breakdown yet. The nightly job adds it on its next run.</p></div></div>
    </article>
  `;
  }

  const rows = expansionMarketRows(model, windowKey);
  if (!rows.length) {
    return `
    <article class="card expansion-card">
      <div class="card-header"><div><h3>Markets</h3>
      <p class="field-hint">No market delivered anything in this window.</p></div></div>
      ${renderExpansionWindowPicker(windowKey)}
    </article>
  `;
  }

  const sorted = expansionSortRows(rows, sortKey, sortDirection);
  const visible = showAll ? sorted : sorted.slice(0, 12);
  const sample = rows[0];
  const windowLabel = sample.from === sample.to
    ? (sample.partial ? expansionDayRange(expansionTableState.latest || {}) : expansionMonthProse(sample.to))
    : `${expansionMonthProse(sample.from)} to ${expansionMonthProse(sample.to)}`;
  const peak = Math.max(...series.flatMap((market) => market.months.map((month) => Number(month.netNewReach) || 0)), 1);
  const overlap = model.marketOverlap;

  // The like-for-like badge belongs only to the month in progress. Over three
  // months or since the anchor there is no matching elapsed window to compare
  // against, and a badge borrowed from a different period would be worse than
  // none.
  const showBadges = windowKey === "current" && Boolean(likeForLike);

  return `
    <article class="card expansion-card">
      <div class="card-header">
        <div>
          <h3>Markets</h3>
          <p class="field-hint">
            From Meta's country breakdown, for ${escapeHtml(windowLabel)}${sample.partial && sample.from !== sample.to ? " - the last of them still in progress" : ""}.
            Each country's reach is deduplicated inside that country. They must not be added together -
            someone reached in two countries counts in both.
          </p>
        </div>
      </div>
      ${renderExpansionWindowPicker(windowKey)}
      <div class="table-wrap">
        <table class="meta-expansion-table is-sortable">
          <thead>
            <tr>
              ${EXPANSION_MARKET_COLUMNS.map((column, index) => {
                const active = column.key === sortKey;
                const classes = [
                  column.numeric ? "is-numeric" : "",
                  "has-tip",
                  index >= EXPANSION_MARKET_COLUMNS.length / 2 ? "tip-end" : "tip-start",
                  column.sortable === false ? "" : "is-sortable",
                  active ? `is-sorted is-${sortDirection}` : ""
                ].filter(Boolean).join(" ");
                const sortAttributes = column.sortable === false
                  ? ""
                  : ` data-expansion-sort="${escapeHtml(column.key)}" aria-sort="${active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}"`;
                return `<th class="${classes}" data-tip="${escapeHtml(column.tip)}" tabindex="0"${sortAttributes}>${escapeHtml(column.label)}</th>`;
              }).join("\n              ")}
            </tr>
          </thead>
          <tbody>
            ${visible.map((row) => {
              const baseline = likeForLike?.markets?.[row.code];
              const comparable = baseline ? Number(baseline.netNewReach) > 0 : false;
              const change = comparable
                ? (Number(row.netNewReach) - Number(baseline.netNewReach)) / Number(baseline.netNewReach)
                : null;
              // A market that delivered earlier in the year and nothing in the
              // baseline window has not just appeared - it came back.
              const emptyLabel = likeForLike && row.firstMonth && row.firstMonth < likeForLike.month
                ? "Resumed"
                : "New";
              const open = expansionTableState.openMarket === row.code;
              return `
                <tr class="is-expandable${open ? " is-open" : ""}" data-expansion-market="${escapeHtml(row.code)}" tabindex="0" role="button" aria-expanded="${open ? "true" : "false"}">
                  ${EXPANSION_MARKET_COLUMNS.map((column) => {
                    if (column.key === "label") {
                      const delivery = model.marketDelivery?.[row.code] || null;
                      const unattributed = /^(UNKNOWN|XX)$/i.test(row.code);
                      return `<td${unattributed ? " class=\"is-unattributed\"" : ""}>
                        <strong>${escapeHtml(row.label)}</strong>
                        <span class="is-quiet">${escapeHtml(unattributed ? "Meta could not place this delivery" : `${row.code} · since ${row.firstMonth || "--"}`)}</span>
                        ${delivery?.learning ? expansionLearningBadge(delivery) : ""}
                      </td>`;
                    }
                    if (column.key === "trend") {
                      return `<td>${expansionSparkline(row.months, peak)}</td>`;
                    }
                    const cell = expansionFormatCell(row, column, currency);
                    // The badge sits on first-time reach because that is the only
                    // figure the like-for-like window carries per market. It is a
                    // diagnostic either way - the table ranks on new customers.
                    const badge = column.key === "netNewReach" && showBadges
                      ? expansionChangeBadge(change, comparable, "", false, emptyLabel)
                      : "";
                    const tone = column.key === "roas" && expansionMeasured(row.roas)
                      ? (Number(row.roas) < 1 ? " class=\"is-numeric is-below-one\"" : " class=\"is-numeric\"")
                      : (column.numeric ? " class=\"is-numeric\"" : "");
                    return `<td${tone}>${escapeHtml(cell)}${badge}</td>`;
                  }).join("")}
                </tr>
                ${open ? `<tr class="expansion-ads-row"><td colspan="${EXPANSION_MARKET_COLUMNS.length}">${renderExpansionAdPanel(model, row.code, row.label, currency)}</td></tr>` : ""}
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      <p class="expansion-note">
        ${windowKey === "current" && overlap && expansionMeasured(overlap.share)
          ? escapeHtml(`The markets add to ${formatCompactNumber(overlap.marketReachSum)} against the deduplicated account figure of ${formatCompactNumber(overlap.accountReach)} - ${(Number(overlap.share) * 100).toFixed(1)}% of people were reached in more than one country. The account figure is the one that speaks for the whole set.`)
          : "The account figure is the one that speaks for the whole set; the markets are a breakdown of it, not a sum."}
        ${sorted.length > visible.length
          ? `<button type="button" class="expansion-link" data-expansion-show-all="1">Show all ${sorted.length} markets</button>`
          : (showAll && sorted.length > 12 ? `<button type="button" class="expansion-link" data-expansion-show-all="0">Show the top 12 only</button>` : "")}
      </p>
    </article>
  `;
}

// What created the value in one country. A market total says Poland returned
// ten times what it cost; it cannot say which ad did it, which is the only form
// of the answer anyone can act on. Each row is one ad in one country, read from
// Meta at ad level with the country breakdown.
//
// Two things about these figures that the columns cannot say on their own:
// reach is each ad's own deduplicated count inside that country and is never
// added up across the rows, because the same person sees several ads; and
// purchases and revenue are Meta's standard attribution, so they are what the
// country returned while the ad was running, not what the ad caused.
const EXPANSION_AD_COLUMNS = [
  {
    key: "adName", label: "Ad", type: "text",
    tip: "The ad as it is named in Meta, with the campaign it runs in. The same creative can appear twice under one name when it runs in more than one campaign - they are separate ads and are kept apart here."
  },
  {
    key: "revenue", label: "Revenue", numeric: true, money: true, high: "up",
    tip: "Purchase value Meta attributes to this ad in this country, on standard attribution. It is what happened while the ad was running, not what the ad caused."
  },
  {
    key: "purchases", label: "Purchases", numeric: true, high: "up",
    tip: "Purchases Meta attributes to this ad in this country. Events, not people, so these do add up across the rows."
  },
  {
    key: "newCustomers", label: "New customers", numeric: true, high: "up",
    tip: "Purchases matching the New_customer conversion. About a fifth of purchases on this account match neither customer conversion, so this is a floor rather than a total."
  },
  {
    key: "spend", label: "Spend", numeric: true, money: true, high: "up",
    tip: "What this ad cost in this country over the window."
  },
  {
    key: "roas", label: "ROAS", numeric: true, decimals: 2, high: "up",
    tip: "Revenue divided by spend for this ad in this country. Reported only where there is at least one unit of currency to divide by."
  },
  {
    key: "costPerPurchase", label: "Cost / purchase", numeric: true, money: true, high: "down",
    tip: "This ad's spend in this country divided by the purchases attributed to it there."
  },
  {
    key: "deliveredReach", label: "Reach", numeric: true, high: "up",
    tip: "This ad's own deduplicated reach inside this country. Do not add the column up: one person who saw three of these ads counts in all three rows."
  },
  {
    key: "frequency", label: "Frequency", numeric: true, decimals: 1, high: "down",
    tip: "Average impressions per person this ad reached in this country."
  }
];

function expansionAdRows(model, code) {
  const breakdown = model?.adBreakdown;
  if (!breakdown || !Array.isArray(breakdown.rows)) return [];
  const thumbnails = breakdown.thumbnails || {};
  return breakdown.rows
    .filter((row) => row.country === code)
    .map((row) => ({ ...row, ...(thumbnails[row.adId] || {}) }));
}

function renderExpansionAdPanel(model, code, label, currency) {
  const breakdown = model?.adBreakdown;
  if (!breakdown) {
    return `<div class="expansion-ads"><p class="expansion-note">The stored snapshot carries no ad-level breakdown yet. The nightly job adds it on its next run.</p></div>`;
  }

  const rows = expansionAdRows(model, code);

  // A breakdown may never quietly stand in for the total it breaks down. Meta
  // reports some campaigns at campaign level and attributes almost none of that
  // spend to their individual ads, so the gap is stated in the amount it is,
  // above the table rather than under it.
  const check = breakdown.reconciliation?.[code] || null;
  const gap = check && !check.reconciles
    ? `<p class="expansion-ads-gap">${escapeHtml(`Meta attributes ${formatCurrency(Math.round(check.adSpend), currency)} of this market's ${formatCurrency(Math.round(check.marketSpend), currency)} to individual ads. The remaining ${formatCurrency(Math.round(check.unaccounted), currency)} is reported at campaign level only, so the ads below cannot explain it.`)}</p>`
    : "";

  if (!rows.length) {
    return `<div class="expansion-ads">${gap}<p class="expansion-note">No ad delivered in ${escapeHtml(label)} between ${escapeHtml(breakdown.since)} and ${escapeHtml(breakdown.until)}.</p></div>`;
  }

  const sorted = rows.slice().sort((left, right) => {
    // Sorted by what they returned, then by what they cost: the rows that
    // produced nothing still have to be visible, because an ad spending money
    // for no return is the other half of the decision.
    if (Number(right.revenue || 0) !== Number(left.revenue || 0)) {
      return Number(right.revenue || 0) - Number(left.revenue || 0);
    }
    return Number(right.spend || 0) - Number(left.spend || 0);
  });

  const totals = sorted.reduce((acc, row) => ({
    spend: acc.spend + Number(row.spend || 0),
    revenue: acc.revenue + Number(row.revenue || 0),
    purchases: acc.purchases + Number(row.purchases || 0)
  }), { spend: 0, revenue: 0, purchases: 0 });

  return `
    <div class="expansion-ads">
      ${gap}
      <p class="expansion-ads-head">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(`${sorted.length} ad${sorted.length === 1 ? "" : "s"} delivered, ${breakdown.since} to ${breakdown.until}`)}</span>
        <span>${escapeHtml(`${formatCurrency(Math.round(totals.spend), currency)} spent, ${formatCurrency(Math.round(totals.revenue), currency)} returned, ${formatCompactNumber(totals.purchases)} purchases`)}</span>
      </p>
      <div class="table-wrap">
        <table class="meta-expansion-table meta-expansion-ads-table">
          <thead>
            <tr>
              ${EXPANSION_AD_COLUMNS.map((column, index) => {
                const classes = [
                  column.numeric ? "is-numeric" : "",
                  "has-tip",
                  index >= EXPANSION_AD_COLUMNS.length / 2 ? "tip-end" : "tip-start"
                ].filter(Boolean).join(" ");
                return `<th class="${classes}" data-tip="${escapeHtml(column.tip)}" tabindex="0">${escapeHtml(column.label)}</th>`;
              }).join("\n              ")}
            </tr>
          </thead>
          <tbody>
            ${sorted.map((row) => `
              <tr>
                <td class="expansion-ad-cell">
                  ${row.thumbnailUrl
                    ? `<img src="${escapeHtml(row.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
                    : `<span class="expansion-ad-thumb-missing" aria-hidden="true"></span>`}
                  <span>
                    <strong>${escapeHtml(row.adName || row.adId)}</strong>
                    <span class="is-quiet">${escapeHtml([row.campaignName, row.adSetName].filter(Boolean).join(" · "))}</span>
                  </span>
                </td>
                ${EXPANSION_AD_COLUMNS.slice(1).map((column) => {
                  const cell = expansionFormatCell(row, column, currency);
                  const tone = column.key === "roas" && expansionMeasured(row.roas) && Number(row.roas) < 1
                    ? " is-below-one"
                    : "";
                  return `<td class="is-numeric${tone}">${escapeHtml(cell)}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="expansion-note">
        Reach is each ad's own deduplicated count inside this country and is never added across the rows -
        one person who saw three of these ads appears in all three. Purchases and revenue are Meta's
        standard attribution over ${escapeHtml(`${breakdown.since} to ${breakdown.until}`)}, so they say what
        happened while an ad was running, not what it caused.
      </p>
    </div>
  `;
}


function renderExpansionWindowPicker(active) {
  return `
    <div class="expansion-window-picker" role="group" aria-label="Window">
      ${EXPANSION_WINDOWS.map(([key, label]) => `
        <button type="button" data-expansion-window="${key}" class="${key === active ? "is-active" : ""}" aria-pressed="${key === active ? "true" : "false"}">${escapeHtml(label)}</button>
      `).join("")}
    </div>
  `;
}

function renderExpansionMonths(months, model, currency, perDay) {
  return `
    <article class="card expansion-card">
      <div class="card-header">
        <div>
          <h3>Month by month</h3>
          <p class="field-hint">
            Per day is first-time reach divided by the days the row actually covers, so the month in
            progress can be read against the complete ones.
          </p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="meta-expansion-table">
          <thead>
            <tr>
              ${expansionHeadRow([
                ["Month", "Calendar month in the ad account's own timezone, America/Los_Angeles. Meta draws this account's days about nine hours behind Copenhagen."],
                ["Days", "How many days the row actually covers. The month in progress is shorter than the others, which is the whole reason Per day is here.", true],
                ["Reached", "Distinct people reached in the month, deduplicated by Meta across the incremental campaigns. It is read at account level, never added up from the campaigns.", true],
                ["First-time", "Of those people, the ones never reached by this set before. Measured as the rise in cumulative unique reach since the anchor month.", true],
                ["Per day", "First-time reach divided by the days the row covers. The only column that compares the month in progress with a complete month honestly.", true],
                ["Repeat share", "Of the people reached this month, the share already reached before - Reached minus First-time, over Reached. It rises as the audience is used up.", true],
                ["Frequency", "Average impressions per person reached this month. High frequency with low first-time reach means the budget is buying repetition.", true],
                ["Spend", "What the incremental campaigns spent in the month, in the account currency.", true],
                ["Cost / 1,000 new", "Spend divided by first-time reach. The price of reaching a thousand more people who had never seen you.", true],
                ["New customers", "Purchases matching the New_customer conversion in the month. About a fifth of purchases on this account match neither customer conversion, so treat this as a floor rather than a total.", true],
                ["Cost / new customer", "The month's whole spend divided by its new customers - all of it, not only the spend that happened to reach them.", true]
              ])}
            </tr>
          </thead>
          <tbody>
            ${months.slice().reverse().map((row) => `
              <tr${row.partial ? ` class="is-partial"` : ""}>
                <td>
                  <strong>${escapeHtml(expansionMonthProse(row.month))}</strong>
                  ${row.partial ? `<span class="is-quiet">${escapeHtml(expansionDayRange(row))}</span>` : ""}
                  ${row.cumulativeRestated ? `<span class="is-quiet">Meta restated this window</span>` : ""}
                </td>
                <td class="is-numeric">${escapeHtml(String(expansionRowDays(row)))}</td>
                <td class="is-numeric">${escapeHtml(formatCompactNumber(row.monthlyReach))}</td>
                <td class="is-numeric">${escapeHtml(formatCompactNumber(row.netNewReach))}</td>
                <td class="is-numeric">${escapeHtml(perDay(row) === null ? "--" : formatCompactNumber(Math.round(perDay(row))))}</td>
                <td class="is-numeric">${escapeHtml(expansionMeasured(row.repeatShare) ? `${Math.round(Number(row.repeatShare) * 100)}%` : "--")}</td>
                <td class="is-numeric">${escapeHtml(formatDecimal(row.frequency, 1))}</td>
                <td class="is-numeric">${escapeHtml(formatCurrency(Math.round(Number(row.spend) || 0), currency))}</td>
                <td class="is-numeric">${escapeHtml(expansionMeasured(row.costPerThousandNewlyReached)
                  ? formatCurrency(Math.round(Number(row.costPerThousandNewlyReached)), currency)
                  : "--")}</td>
                <td class="is-numeric">${escapeHtml(row.newCustomers == null ? "--" : formatCompactNumber(row.newCustomers))}</td>
                <td class="is-numeric">${escapeHtml(expansionMeasured(row.costPerNewCustomer)
                  ? formatCurrency(Math.round(Number(row.costPerNewCustomer)), currency)
                  : "--")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

// A restatement log that permanently announces that nothing was restated is
// furniture. The campaign set behind this series comes from Meta's current
// attribution_setting over a rolling window, so it can change under the history
// and rewrite completed months - when that happens it has to be said, and when
// it has not happened there is nothing to say. Everything else about how this is
// measured - the anchor, the call budget, the timezone, the standing caveats -
// lives in the code and in CLAUDE.md, not on the operator's screen.
function renderExpansionRestatements(model) {
  const restatements = Array.isArray(model.restatements) ? model.restatements.slice(0, 8) : [];
  if (!restatements.length) return "";

  return `
    <article class="card expansion-card">
      <div class="card-header">
        <div>
          <h3>Restated figures</h3>
          <p class="field-hint">Completed months whose first-time reach moved after they closed.</p>
        </div>
      </div>
      <ul class="meta-expansion-restatements">
        ${restatements.map((entry) => `
          <li>
            <strong>${escapeHtml(expansionMonthProse(entry.month))}</strong>
            moved from ${escapeHtml(formatCompactNumber(entry.from))}
            to ${escapeHtml(formatCompactNumber(entry.to))}
            ${expansionMeasured(entry.deltaShare) ? `(${(Number(entry.deltaShare) * 100).toFixed(1)}%)` : ""}
            <span class="is-quiet">${escapeHtml(entry.reason || "")}</span>
          </li>
        `).join("")}
      </ul>
    </article>
  `;
}

export function renderOverviewSpendSplit(model = null, visible = false) {
  const node = document.getElementById("overview-spend-split");
  const titleNode = document.getElementById("overview-spend-title");
  const subNode = document.getElementById("overview-spend-sub");
  if (!node) return;

  const items = Array.isArray(model?.items) ? model.items : [];
  const totalAmount = Number(model?.totalAmount) || 0;
  const totalBudgetAmount = Number(model?.totalBudgetAmount) || 0;
  if (!visible || !items.length || (!(totalAmount > 0) && !(totalBudgetAmount > 0))) {
    node.innerHTML = "";
    return;
  }

  if (titleNode) titleNode.textContent = model?.title || "Objective spend split";
  if (subNode) subNode.textContent = model?.subtitle || "Real spend split by campaign objective in the selected range.";

  const maxAmount = Math.max(...items.map((item) => Number(item?.amount) || 0), 1);
  const maxBudgetAmount = Math.max(...items.map((item) => Number(item?.budgetAmount) || 0), 1);
  const budgetAvailable = model?.budgetAvailable !== false && totalBudgetAmount > 0;
  const spendSegments = buildStackSegments(items, "amount");
  const budgetSegments = buildStackSegments(items, "budgetAmount");

  node.innerHTML = `
    <section class="meta-budget-premium">
      <div class="meta-budget-premium-head">
        <div>
          <span class="meta-budget-eyebrow">Budget cockpit</span>
          <p class="meta-budget-context">${escapeHtml(model?.summaryMeta || model?.rangeLabel || "")}</p>
        </div>
        <div class="meta-budget-range-chip">${escapeHtml(model?.rangeLabel || "")}</div>
      </div>

      <div class="meta-budget-window-strip" aria-label="Reporting windows in this panel">
        <div class="meta-budget-window is-actual">
          <span class="meta-budget-window-tag">Actual</span>
          <strong>${escapeHtml(model?.rangeLabel || "Selected range")}</strong>
          <span class="meta-budget-window-note">Money that actually left the account</span>
        </div>
        <div class="meta-budget-window-divider" aria-hidden="true">vs</div>
        <div class="meta-budget-window is-planned">
          <span class="meta-budget-window-tag">Planned</span>
          <strong>30 days</strong>
          <span class="meta-budget-window-note">Monthly budget, the unit the team budgets in</span>
        </div>
      </div>

      <div class="meta-budget-kpi-grid">
        <article class="meta-budget-kpi-card is-spend">
          <span>${escapeHtml(model?.totalLabel || "Total spend")}</span>
          <strong>${escapeHtml(model?.formattedTotalAmount || "--")}</strong>
          <p>Actual amount spent in ${escapeHtml(model?.rangeLabel || "the selected range")}.</p>
        </article>
        <article class="meta-budget-kpi-card is-budget">
          <span>${escapeHtml(model?.kpiBudgetLabel || model?.totalBudgetLabel || "Planned budget (30 days)")}</span>
          <strong>${escapeHtml(model?.formattedKpiBudgetAmount || model?.formattedTotalBudgetAmount || "--")}</strong>
          <p>${escapeHtml(model?.kpiBudgetMeta || "Monthly budget from the active Meta campaign and ad set budgets.")}</p>
        </article>
        ${budgetAvailable ? `
        <article class="meta-budget-kpi-card is-pace">
          <span>${escapeHtml(model?.paceLabel || "30-day spend pace vs monthly budget")}</span>
          <strong>${escapeHtml(`${Number(model?.totalPacePercentage || 0).toFixed(0)}%`)}</strong>
          <p>${escapeHtml(
            Number(model?.periodDays) === 30
              ? "Spend in this range measured against the monthly budget."
              : `Spend scaled to a 30-day pace (${model?.formattedTotalMonthlySpendPace || "--"}) so it is comparable with the monthly budget.`
          )}</p>
        </article>
        ` : ""}
      </div>

      <div class="meta-budget-dual-stack">
        <article class="meta-budget-stack-card is-actual-card">
          <div class="meta-budget-stack-head">
            <strong>${escapeHtml(model?.spendMixLabel || "Actual spend mix")}</strong>
            <span>${escapeHtml(model?.formattedTotalAmount || "--")}</span>
          </div>
          <div class="meta-budget-stack" role="img" aria-label="${escapeHtml(model?.title || "Objective spend split")}">
            ${spendSegments.filter((segment) => segment.width > 0).map((segment) => `
              <div class="meta-budget-segment tone-${escapeHtml(resolveObjectiveTone(segment.item.key))}" style="width:${segment.width}%" title="${escapeHtml(`${segment.item.label || ""}: ${segment.item.formattedAmount || "--"} (${Number(segment.item?.percentage || 0).toFixed(1)}%)`)}">
                <span>${escapeHtml(segment.item.label || "")}</span>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="meta-budget-stack-card is-planned-card">
          <div class="meta-budget-stack-head">
            <strong>${escapeHtml(model?.budgetMixLabel || "Planned budget mix (30 days)")}</strong>
            <span>${escapeHtml(model?.formattedTotalBudgetAmount || "--")}</span>
          </div>
          ${budgetAvailable ? `
          <div class="meta-budget-stack is-budget-view" role="img" aria-label="${escapeHtml(model?.budgetMixLabel || "Planned budget mix by objective")}">
            ${budgetSegments.filter((segment) => segment.width > 0).map((segment) => `
              <div class="meta-budget-segment tone-${escapeHtml(resolveObjectiveTone(segment.item.key))}" style="width:${segment.width}%" title="${escapeHtml(`${segment.item.label || ""}: ${segment.item.formattedBudgetAmount || "--"} (${Number(segment.item?.budgetPercentage || 0).toFixed(1)}%)`)}">
                <span>${escapeHtml(segment.item.label || "")}</span>
              </div>
            `).join("")}
          </div>
          ` : `
          <p class="meta-budget-empty">${escapeHtml(model?.kpiBudgetMeta || "Planned budget is unavailable for this snapshot.")}</p>
          `}
        </article>
      </div>

      <div class="meta-budget-rows">
        ${items.map((item) => {
          const spendAmount = Number(item?.amount) || 0;
          const budgetAmount = Number(item?.budgetAmount) || 0;
          const spendWidth = Math.max(5, (spendAmount / maxAmount) * 100);
          const budgetWidth = budgetAmount > 0 ? Math.max(5, (budgetAmount / maxBudgetAmount) * 100) : 0;
          // Pacing compares a 30-day spend pace against the 30-day budget, so the two
          // sides cover the same length of time even when a shorter range is selected.
          const variance = Number(item?.pacePercentage) || 0;
          // A missing budget figure and a genuinely unbudgeted objective are different
          // facts, so they get different labels instead of a shared "No active budget".
          const varianceLabel = budgetAmount > 0
            ? `${variance.toFixed(0)}% of monthly budget`
            : budgetAvailable
              ? "No active budget"
              : "Budget not synced";
          const pacingTone = !(budgetAmount > 0)
            ? "is-unknown"
            : variance > 105
              ? "is-over"
              : variance < 85
                ? "is-under"
                : "is-even";
          return `
            <article class="meta-budget-row tone-${escapeHtml(resolveObjectiveTone(item.key))}">
              <div class="meta-budget-row-topline">
                <div class="meta-budget-row-head">
                  <strong>${escapeHtml(item.label || "")}</strong>
                  <span>${escapeHtml(String(Number(item?.percentage || 0).toFixed(1)))}% spend share</span>
                </div>
                <div class="meta-budget-row-value">
                  <strong title="${escapeHtml(`Actual spend, ${model?.rangeLabel || "selected range"}`)}">${escapeHtml(item.formattedAmount || "--")}</strong>
                  <span title="Planned budget per 30-day month">${escapeHtml(item.formattedBudgetAmount || "--")}</span>
                </div>
              </div>
              <div class="meta-budget-row-rail">
                <div class="meta-budget-row-track">
                  <span class="meta-budget-row-fill" style="width:${spendWidth}%"></span>
                </div>
                <div class="meta-budget-row-track is-budget-track">
                  <span class="meta-budget-row-fill is-budget-fill" style="width:${budgetWidth}%"></span>
                </div>
              </div>
              <div class="meta-budget-row-footer">
                <span class="meta-budget-row-caption">Actual · ${escapeHtml(model?.rangeLabel || "selected range")}</span>
                <span class="meta-budget-variance-pill ${escapeHtml(pacingTone)}" title="${escapeHtml(
                  budgetAmount > 0 && Number(model?.periodDays) !== 30
                    ? `30-day spend pace ${item.formattedMonthlySpendPace || "--"} against a monthly budget of ${item.formattedBudgetAmount || "--"}`
                    : `Spend against a monthly budget of ${item.formattedBudgetAmount || "--"}`
                )}">${escapeHtml(varianceLabel)}</span>
                <span class="meta-budget-row-caption">Planned · 30 days</span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

// New vs existing customers, counted from the ad account's own custom conversions.
//
// Three things this panel refuses to do, because they would misstate a number the team
// budgets against: it never treats a missing conversion as "zero new customers", it never
// folds untagged purchases into either customer type, and it never presents a single cost
// per new customer without saying what spend it was divided by.
// The panel's own period selector. It is deliberately local: changing it must not touch
// the dashboard's global date filter, and the default stays month to date so the view
// nobody asked to change stays the same.
//
// Every preset is computed server side from one daily series, so switching costs no Meta
// request and no reload - the handler below just re-renders from data already in memory.
let acquisitionPresetKey = "";

function resolveAcquisitionPreset(model) {
  const presets = model?.trend?.windows?.presets;
  if (!Array.isArray(presets) || !presets.length) return null;
  const wanted = acquisitionPresetKey || model?.trend?.windows?.defaultPreset || presets[0].key;
  return presets.find((preset) => preset.key === wanted) || presets[0];
}

// A count and a change badge do not answer the question the team actually asks, which is
// whether acquisition is improving or falling off. Two months that both end on 58 new
// customers look identical in a badge and completely different on a chart, one climbing
// and one collapsing after the first week.
//
// The previous period is drawn underneath on a shared day-of-window scale, so day four of
// this month sits above day four of last month. Both series come from the preset the
// panel is showing, so switching period moves the chart with the figures.
function renderAcquisitionDailyChart(preset) {
  if (!preset) return "";

  const current = Array.isArray(preset.current?.dailyNewCustomers) ? preset.current.dailyNewCustomers : [];
  const previous = Array.isArray(preset.previous?.dailyNewCustomers) ? preset.previous.dailyNewCustomers : [];
  if (!current.length && !previous.length) return "";

  const peak = Math.max(...[...current, ...previous].map((point) => Number(point.value) || 0), 0);
  const currentLabel = preset.current?.label || "this period";
  const previousLabel = preset.previous?.label || "the period before";

  return `
    <div class="meta-acq-chart">
      <div class="meta-budget-stack-head">
        <strong>New customers per day</strong>
        <span>${escapeHtml(`${currentLabel} against ${previousLabel}`)}</span>
      </div>
      ${buildSparkline(current, "acq-new", previous)}
      <p class="meta-acq-chart-legend">
        <span class="is-current">${escapeHtml(currentLabel)}</span>
        ${previous.length ? `<span class="is-previous">${escapeHtml(previousLabel)}</span>` : ""}
        ${peak > 0 ? `<span class="is-peak">${escapeHtml(`Busiest day: ${peak}`)}</span>` : ""}
      </p>
    </div>
  `;
}

// Cost per new customer needs its own direction, and it runs the opposite way to the
// count: cheaper is better. Without this, a period can show more new customers in green
// while quietly costing far more each - which is exactly what the last 90 days did, at
// +11% customers and +30% cost per customer.
function renderAcquisitionCostTrend(preset) {
  if (!preset) return "";
  const now = Number(preset.current?.costPerNewCustomer) || 0;
  const before = Number(preset.previous?.costPerNewCustomer) || 0;
  if (!(now > 0) || !(before > 0)) return "";

  const change = ((now - before) / before) * 100;
  if (Math.abs(change) < 1) {
    return `<div class="meta-acq-trend is-flat"><span class="meta-acq-trend-badge"><em aria-hidden="true">→</em>no change</span></div>`;
  }

  // Cheaper is the good outcome, so the tone is inverted relative to the count badge.
  const cheaper = change < 0;
  return `
    <div class="meta-acq-trend ${cheaper ? "is-up" : "is-down"}">
      <span class="meta-acq-trend-badge">
        <em aria-hidden="true">${cheaper ? "↓" : "↑"}</em>${escapeHtml(`${change > 0 ? "+" : ""}${change.toFixed(0)}%`)}
      </span>
      <span class="meta-acq-trend-detail">${escapeHtml(cheaper ? "cheaper than the period before" : "more expensive than the period before")}</span>
    </div>
  `;
}

// The trend renderer predates the presets, so give it the shape it expects. Keeping one
// renderer means a change to how direction or the badge reads applies to every period.
function adaptPresetToTrend(model, preset) {
  const windows = model?.trend?.windows;
  if (!preset || !windows) return model?.trend || null;
  return {
    available: Boolean(windows.available),
    comparable: preset.comparable,
    notComparableReason: preset.note || "Nothing to compare for this period.",
    current: preset.current,
    previous: preset.previous,
    today: windows.today,
    // Today's in-progress count is only relevant to the month-to-date view.
    showToday: preset.key === (windows.defaultPreset || "month_to_date"),
    delta: preset.delta,
    percentChange: preset.percentChange,
    direction: preset.direction,
    // A window-length mismatch is surfaced the same way a clamped month is.
    clamped: Boolean(preset.note),
    clampedNote: preset.note || ""
  };
}

function renderAcquisitionPresetPicker(model) {
  const windows = model?.trend?.windows;
  const presets = Array.isArray(windows?.presets) ? windows.presets : [];
  if (presets.length < 2) return "";

  const active = resolveAcquisitionPreset(model);
  return `
    <div class="meta-acq-periods" role="group" aria-label="Period for the new customer comparison">
      ${presets.map((preset) => `
        <button type="button"
          class="meta-acq-period${preset.key === active?.key ? " is-active" : ""}"
          data-acq-preset="${escapeHtml(preset.key)}"
          aria-pressed="${preset.key === active?.key ? "true" : "false"}"
          title="${escapeHtml(`${preset.current.since} to ${preset.current.until} against ${preset.previous.since} to ${preset.previous.until}`)}">
          ${escapeHtml(preset.label)}
        </button>
      `).join("")}
    </div>
  `;
}

// Bound once; the click handler re-renders the panel from the model already held.
let acquisitionPresetModel = null;

function bindAcquisitionPresetPicker() {
  const node = document.getElementById("overview-acquisition");
  if (!node || node.dataset.acqPresetsBound === "true") return;
  node.dataset.acqPresetsBound = "true";
  node.addEventListener("click", (event) => {
    const button = event.target.closest("[data-acq-preset]");
    if (!button) return;
    acquisitionPresetKey = String(button.dataset.acqPreset || "");
    if (acquisitionPresetModel) {
      renderOverviewCustomerAcquisition(acquisitionPresetModel, true);
    }
  });
}

export function renderOverviewCustomerAcquisition(model = null, visible = false) {
  const node = document.getElementById("overview-acquisition");
  const titleNode = document.getElementById("overview-acquisition-title");
  const subNode = document.getElementById("overview-acquisition-sub");
  if (!node) return;

  if (!visible || !model) {
    node.innerHTML = "";
    return;
  }

  if (titleNode) titleNode.textContent = "New customers from Meta";

  // A missing conversion is a setup gap, not a result. Say so instead of showing zeros.
  // Wrapped in .meta-acq so it sits on the panel's own dark surface; .meta-budget-empty
  // is styled for light-on-dark and would be unreadable straight on the light card.
  if (!model.available) {
    if (subNode) subNode.textContent = "Not available for this ad account.";
    node.innerHTML = `
      <section class="meta-acq">
        <p class="meta-budget-empty">${escapeHtml(model.unavailableReason || "New customers cannot be counted for this account.")}</p>
      </section>
    `;
    return;
  }

  // The subtitle names the period the panel is actually showing, which is the panel's own
  // selection rather than the dashboard's range once a preset is picked.
  if (subNode) {
    const shown = resolveAcquisitionPreset(model)?.label || model.rangeLabel || "Selected range";
    subNode.textContent = `${shown} · counted from the New_customer and Existing_customer conversions on the ad account.`;
  }

  // Held so the period buttons can re-render from data already in memory - switching
  // period must not cost a request, and must not touch the dashboard's global date filter.
  acquisitionPresetModel = model;

  const rows = Array.isArray(model.campaigns) ? model.campaigns : [];
  const maxNew = Math.max(...rows.map((r) => Number(r.newCustomers) || 0), 1);

  // Everything that can be computed for an arbitrary window follows the panel's own
  // period selector. Only the per-campaign table cannot, because Meta returns the
  // customer split per campaign for one date range at a time.
  //
  // The first version moved only the new-customer count onto the preset and left the
  // purchase-split bar, its caption and the order values on the dashboard range. The bar
  // then drew a 90-day new-customer count against a one-month existing count, so it grew
  // as the period widened while its caption still read "this month". Mixing periods
  // inside one figure is worse than showing the wrong period, because nothing on screen
  // reveals it.
  const active = resolveAcquisitionPreset(model);
  const usingPreset = Boolean(active) && active.key !== (model.trend?.windows?.defaultPreset || "month_to_date");

  const scope = active
    ? {
        label: active.label,
        newCount: Number(active.current.newCustomers) || 0,
        existingCount: Number(active.current.existingCustomers) || 0,
        untagged: Number(active.current.untaggedPurchases) || 0,
        purchases: Number(active.current.purchases) || 0,
        untaggedShare: Number(active.current.untaggedShare) || 0,
        averageNew: Number(active.current.averageNewCustomerOrderValue) || 0,
        averageExisting: Number(active.current.averageExistingCustomerOrderValue) || 0
      }
    : {
        label: model.rangeLabel || "selected range",
        newCount: Number(model.newCustomers) || 0,
        existingCount: Number(model.existingCustomers) || 0,
        untagged: Number(model.untaggedPurchases) || 0,
        purchases: Number(model.totalPurchases) || 0,
        untaggedShare: Number(model.untaggedShare) || 0,
        averageNew: Number(model.averageNewCustomerOrderValue) || 0,
        averageExisting: Number(model.averageExistingCustomerOrderValue) || 0
      };

  const newCount = scope.newCount;
  const existingCount = scope.existingCount;
  const untagged = scope.untagged;

  // The three-way split of purchases: new, existing, and the remainder that matched
  // neither. Widths are normalised so the bar cannot contradict the printed counts.
  const mixSegments = buildStackSegments(
    [
      { key: "new", label: "New", amount: newCount },
      { key: "existing", label: "Existing", amount: existingCount },
      { key: "untagged", label: "Unknown type", amount: untagged }
    ],
    "amount"
  );

  node.innerHTML = `
    <section class="meta-acq">
      ${renderAcquisitionPresetPicker(model)}

      <div class="meta-acq-kpis">
        <article class="meta-acq-kpi is-new">
          <span>New customers${active ? ` · ${escapeHtml(active.label)}` : ""}</span>
          <strong>${escapeHtml(String(newCount))}</strong>
          ${renderAcquisitionTrend(adaptPresetToTrend(model, active))}
          <p>${escapeHtml(
            active
              ? `${active.current.formattedNewCustomerRevenue || "--"} in revenue`
              : `${model.formattedNewCustomerRevenue || "--"} in revenue · ${Number(model.newCustomerShare || 0).toFixed(1)}% of identified buyers`
          )}</p>
        </article>
        <article class="meta-acq-kpi is-cac">
          <span>Cost per new customer${active ? ` · ${escapeHtml(active.label)}` : ""}</span>
          <strong>${escapeHtml(active ? (active.current.formattedCostPerNewCustomer || "--") : (model.formattedCostPerNewCustomer || "--"))}</strong>
          ${renderAcquisitionCostTrend(active)}
          <p>${escapeHtml(
            active
              ? `${active.current.formattedSpend || "--"} spent over ${active.current.days} days. Was ${active.previous.formattedCostPerNewCustomer || "--"} in ${active.previous.label}.`
              : `${model.costPerNewCustomerBasis || ""}${Number(model.conversionCampaignCount) > 0 ? ` Conversion campaigns only: ${model.formattedConversionCostPerNewCustomer || "--"}.` : ""}`
          )}</p>
        </article>
        <article class="meta-acq-kpi is-existing">
          <span>Existing customers${active ? ` · ${escapeHtml(active.label)}` : ""}</span>
          <strong>${escapeHtml(String(active ? (Number(active.current.existingCustomers) || 0) : existingCount))}</strong>
          <p>${escapeHtml(active ? `${active.previous.existingCustomers} in ${active.previous.label}` : (model.formattedExistingCustomerRevenue || "--") + " in revenue")}</p>
        </article>
      </div>

      ${renderAcquisitionDailyChart(active)}

      <div class="meta-acq-mix-card">
        <div class="meta-budget-stack-head">
          <strong>Purchases by customer type</strong>
          <span>${escapeHtml(`${scope.purchases} purchases · ${scope.label}`)}</span>
        </div>
        <div class="meta-budget-stack" role="img" aria-label="Purchases split by customer type">
          ${mixSegments.filter((s) => s.width > 0).map((s) => `
            <div class="meta-budget-segment tone-acq-${escapeHtml(s.item.key)}" style="width:${s.width}%" title="${escapeHtml(`${s.item.label}: ${s.item.amount} purchases`)}">
              <span>${escapeHtml(s.item.label)}</span>
            </div>
          `).join("")}
        </div>
        ${untagged > 0 ? `
        <p class="meta-acq-gap">
          ${escapeHtml(String(untagged))} purchases (${escapeHtml(scope.untaggedShare.toFixed(1))}%) matched neither conversion,
          so the new-customer count is a floor rather than a total.
        </p>
        ` : ""}
      </div>

      <div class="meta-acq-aov">
        <span>Average order value · ${escapeHtml(scope.label)}</span>
        <div>
          <strong>New</strong> ${escapeHtml(formatAcqNumber(scope.averageNew, model.currency))}
          <strong>Existing</strong> ${escapeHtml(formatAcqNumber(scope.averageExisting, model.currency))}
        </div>
      </div>

      ${rows.length ? `
      <div class="meta-acq-rows">
        ${usingPreset ? `
        <p class="meta-acq-scope-note">
          The per-campaign breakdown below still covers ${escapeHtml(model.rangeLabel || "the dashboard's range")},
          not ${escapeHtml(active.label)} - Meta only returns the customer split per campaign for the dashboard's own date range.
        </p>
        ` : ""}
        <div class="meta-acq-row is-head">
          <span>Campaign</span><span>New</span><span>Existing</span><span>Cost / new</span>
        </div>
        ${rows.slice(0, 12).map((row) => `
          <div class="meta-acq-row">
            <span class="meta-acq-name" title="${escapeHtml(row.name || "")}">${escapeHtml(row.name || "")}</span>
            <span class="meta-acq-new">
              <em style="width:${Math.max(3, ((Number(row.newCustomers) || 0) / maxNew) * 100)}%"></em>
              ${escapeHtml(String(Number(row.newCustomers) || 0))}
            </span>
            <span>${escapeHtml(String(Number(row.existingCustomers) || 0))}</span>
            <span>${escapeHtml(row.formattedCostPerNewCustomer || "--")}</span>
          </div>
        `).join("")}
      </div>
      ` : ""}
    </section>
  `;

  // Delegated on the container, which survives innerHTML replacement, so this is safe to
  // call after every render and only ever attaches once.
  bindAcquisitionPresetPicker();
}

// Month-to-date new customers against the same elapsed point in the previous month.
// This is the pace comparison the marketing team is measured on, so the two windows are
// always named: a partial month against a whole one would read as a collapse every time.
function renderAcquisitionTrend(trend = null) {
  if (!trend || !trend.available) return "";

  // Before any day of the month has completed there is nothing to compare, and a badge
  // reading "no change" would imply we checked and found them equal.
  if (trend.comparable === false) {
    return `
      <div class="meta-acq-trend is-flat">
        <span class="meta-acq-trend-detail">${escapeHtml(trend.notComparableReason || "No completed days this month yet.")}</span>
      </div>
      <div class="meta-acq-trend-windows">
        <span>+${escapeHtml(String(Number(trend.today?.newCustomers) || 0))} so far today</span>
      </div>
    `;
  }

  const current = Number(trend.current?.newCustomers) || 0;
  const previous = Number(trend.previous?.newCustomers) || 0;
  const delta = Number(trend.delta) || 0;
  const percent = trend.percentChange;

  // Direction is about acquisition, so more is better and the tone follows that.
  const tone = trend.direction === "up" || trend.direction === "new"
    ? "is-up"
    : trend.direction === "down"
      ? "is-down"
      : "is-flat";
  const arrow = trend.direction === "up" || trend.direction === "new"
    ? "↑"
    : trend.direction === "down"
      ? "↓"
      : "→";

  // Both period names come from the preset. Hardcoding "last month" here described only
  // the month-to-date case, so picking Last 7 days read as "38 in the same days last
  // month" - which was neither the window compared nor a month.
  const previousName = trend.previous?.label || "the period before";
  const currentDays = Number(trend.current?.days) || 0;
  const previousDays = Number(trend.previous?.days) || 0;

  const headline = percent === null || percent === undefined
    ? (previous === 0 && current > 0 ? "no prior data" : "no change")
    : `${percent > 0 ? "+" : ""}${Number(percent).toFixed(0)}%`;

  const deltaLabel = previous === 0 && current > 0
    ? `${current} against none in ${previousName}`
    : `${delta > 0 ? "+" : ""}${delta} vs ${previous} in ${previousName}`;

  const windowLabel = currentDays === previousDays
    ? `${currentDays} days each side`
    : `${currentDays} days vs ${previousDays}`;

  return `
    <div class="meta-acq-trend ${tone}">
      <span class="meta-acq-trend-badge">
        <em aria-hidden="true">${arrow}</em>${escapeHtml(headline)}
      </span>
      <span class="meta-acq-trend-detail">${escapeHtml(deltaLabel)}</span>
    </div>
    <div class="meta-acq-trend-windows">
      <span title="${escapeHtml(`${trend.current?.since || ""} to ${trend.current?.until || ""}, against ${trend.previous?.since || ""} to ${trend.previous?.until || ""}`)}">${escapeHtml(windowLabel)}</span>
      ${
        // Today's partial figure only belongs on the month-to-date view. On a completed
        // calendar month or a rolling window it is unrelated to what is being compared.
        trend.showToday
          ? `<span title="${escapeHtml(`Today so far, ${trend.today?.date || ""} in the ad account timezone. Excluded from the comparison because it is still running.`)}">+${escapeHtml(String(Number(trend.today?.newCustomers) || 0))} so far today</span>`
          : ""
      }
    </div>
    ${trend.clamped ? `<p class="meta-acq-trend-note">${escapeHtml(trend.clampedNote || "")}</p>` : ""}
  `;
}

function formatAcqNumber(value, currency = "DKK") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "--";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: String(currency || "DKK").toUpperCase(),
    maximumFractionDigits: 0
  }).format(number);
}

export function renderTrendDeck(cards = []) {
  const node = document.getElementById("trend-deck");
  if (!node) return;

  if (!itemsHaveLength(cards)) {
    node.innerHTML = "";
    return;
  }

  node.innerHTML = cards.map((card) => `
    <article class="card trend-card tone-${escapeHtml(card.tone || "default")}${card.hero ? " is-hero" : ""}${card.kind ? ` trend-card-${escapeHtml(card.kind)}` : ""}">
      ${renderTrendCardBody(card)}
    </article>
  `).join("");
}

function renderTrendCardBody(card = {}) {
  if (card.kind === "dual-trend") {
    return `
      <div class="trend-head">
        <div>
          <div class="trend-title">${escapeHtml(card.title || "")}</div>
          <div class="trend-meta">${escapeHtml(card.meta || "")}</div>
        </div>
      </div>
      <div class="trend-dual-stack">
        ${(card.panels || []).map((panel) => `
          <section class="trend-dual-panel">
            <div class="trend-dual-head">
              <span>${escapeHtml(panel.label || "")}</span>
              <strong>${escapeHtml(panel.value || "--")}</strong>
            </div>
            ${buildSparkline(panel.series, panel.tone || card.tone || "default")}
          </section>
        `).join("")}
      </div>
    `;
  }

  if (card.kind === "funnel") {
    return `
      <div class="trend-head">
        <div>
          <div class="trend-title">${escapeHtml(card.title || "")}</div>
          <div class="trend-meta">${escapeHtml(card.meta || "")}</div>
        </div>
      </div>
      <div class="trend-funnel">
        ${(card.steps || []).map((step) => `
          <article class="trend-funnel-step">
            <div class="trend-funnel-head">
              <span>${escapeHtml(step.label || "")}</span>
              <strong>${escapeHtml(step.value || "--")}</strong>
            </div>
            <div class="trend-funnel-track">
              <span class="trend-funnel-fill" style="width:${Number(step.width) || 0}%"></span>
            </div>
          </article>
        `).join("")}
      </div>
      ${card.note ? `<p class="trend-note">${escapeHtml(card.note)}</p>` : ""}
    `;
  }

  if (card.kind === "objective-bars") {
    return `
      <div class="trend-head">
        <div>
          <div class="trend-title">${escapeHtml(card.title || "")}</div>
          <div class="trend-meta">${escapeHtml(card.meta || "")}</div>
        </div>
      </div>
      <div class="objective-bars">
        ${(card.rows || []).map((row) => `
          <article class="objective-bar-row tone-${escapeHtml(row.tone || "default")}">
            <div class="objective-bar-head">
              <strong>${escapeHtml(row.label || "")}</strong>
              <span>${escapeHtml(row.share || "")}</span>
            </div>
            <div class="objective-bar-metrics">
              <span>${escapeHtml(row.spend || "--")}</span>
              <span>${escapeHtml(row.metricLabel || "")} ${escapeHtml(row.metricValue || "--")}</span>
            </div>
            <div class="objective-bar-track">
              <span class="objective-bar-fill" style="width:${Number(row.width) || 0}%"></span>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  return `
    <div class="trend-head">
      <div>
        <div class="trend-title">${escapeHtml(card.title || "")}</div>
        <div class="trend-meta">${escapeHtml(card.meta || "")}</div>
      </div>
      <div class="trend-value">${escapeHtml(card.value || "--")}</div>
    </div>
    ${buildSparkline(card.series, card.tone || "default", card.comparisonSeries)}
    ${Array.isArray(card.comparisonSeries) && card.comparisonSeries.length ? `<div class="trend-compare-note">Previous period overlay</div>` : ""}
  `;
}

export function renderHeroPanel(items = []) {
  const node = document.getElementById("hero-panel");
  if (!node) return;
  if (!itemsHaveLength(items)) {
    node.classList.remove("hero-panel-kpi");
    node.removeAttribute("data-count");
    node.innerHTML = "";
    return;
  }

  node.classList.toggle("hero-panel-kpi", items.length >= 5 || items.some((item) => item?.change));
  node.dataset.count = String(items.length);

  node.innerHTML = items.map((item) => `
    <article class="hero-glance tone-${escapeHtml(item.tone || "neutral")}">
      <div class="hero-glance-head">
        <span>${escapeHtml(item.label || "")}</span>
        ${renderChangeBadge(item.change, "hero-change")}
      </div>
      <strong>${escapeHtml(item.value || "--")}</strong>
      <p>${escapeHtml(item.meta || "")}${item.change?.label ? ` · ${escapeHtml(item.change.label)}` : ""}</p>
    </article>
  `).join("");
}

function itemsHaveLength(items) {
  return Array.isArray(items) && items.length > 0;
}

function formatLensLabel(value = "") {
  // The two attribution splits are lenses, not Meta objective families, so they keep
  // their own labels. Everything else reads from the shared objective table, which means
  // a campaign on a newly supported objective shows a real name instead of a raw key.
  if (value === "conversion_standard") return "Conversion (standard)";
  if (value === "conversion_incremental") return "Conversion (incremental)";
  if (value === "awareness") return "Awareness";
  if (OBJECTIVE_GROUP_LABELS[value]) return resolveObjectiveGroupLabel(value);
  return value || "General";
}

function buildSparkline(series = [], tone = "default", comparisonSeries = []) {
  const hasPrimary = Array.isArray(series) && series.length;
  const hasComparison = Array.isArray(comparisonSeries) && comparisonSeries.length;
  if (!hasPrimary && !hasComparison) {
    return `
      <svg class="trend-spark" viewBox="0 0 220 60" role="img" aria-label="No trend data">
        <line class="axis" x1="0" y1="54" x2="220" y2="54"></line>
      </svg>
    `;
  }

  const width = 220;
  const height = 60;
  const baseline = 54;
  const values = [...(series || []), ...(comparisonSeries || [])].map((point) => Number(point.value) || 0);
  const max = Math.max(...values, 1);

  // Both lines are placed by how many days into their own window each point falls, not by
  // its position in the array. Meta omits days with no delivery, so a previous window with
  // five rows and a current window with twenty-nine used to be stretched across the same
  // width, putting day 3 of one above day 17 of the other while the card invited the
  // reader to compare them directly.
  const dayOffset = (inputSeries = [], index = 0) => {
    const first = Date.parse(`${inputSeries[0]?.date}T00:00:00Z`);
    const at = Date.parse(`${inputSeries[index]?.date}T00:00:00Z`);
    if (Number.isNaN(first) || Number.isNaN(at)) return index;
    return Math.round((at - first) / 86400000);
  };
  const lastOffset = (inputSeries = []) => (
    inputSeries.length ? dayOffset(inputSeries, inputSeries.length - 1) : 0
  );
  const span = Math.max(lastOffset(series || []), lastOffset(comparisonSeries || []), 1);

  const buildPoints = (inputSeries = []) => inputSeries.map((point, index) => {
    const x = inputSeries.length > 1 ? (dayOffset(inputSeries, index) / span) * width : width / 2;
    const y = baseline - ((Math.max(0, Number(point.value) || 0) / max) * 42);
    return { x, y };
  });
  const buildPath = (inputPoints = []) => inputPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const points = buildPoints(series || []);
  const comparisonPoints = buildPoints(comparisonSeries || []);
  const path = buildPath(points);
  const comparisonPath = buildPath(comparisonPoints);
  const area = points.length
    ? `${path} L ${points[points.length - 1].x.toFixed(2)},${baseline} L ${points[0].x.toFixed(2)},${baseline} Z`
    : "";
  const lastPoint = points[points.length - 1];

  return `
    <svg class="trend-spark tone-${escapeHtml(tone)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend over selected date range">
      <line class="axis" x1="0" y1="${baseline}" x2="${width}" y2="${baseline}"></line>
      ${comparisonPath ? `<path class="comparison-line" d="${comparisonPath}"></path>` : ""}
      ${area ? `<path class="area" d="${area}"></path>` : ""}
      ${path ? `<path class="line" d="${path}"></path>` : ""}
      ${lastPoint ? `<circle class="dot" cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="3"></circle>` : ""}
    </svg>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const createPreviewAssetUrlCache = new Map();

function getFileObjectUrlKey(file) {
  return file
    ? [file.name, file.size, file.lastModified, file.type].join(":")
    : "";
}

function getCachedCreatePreviewAssetUrl(file) {
  const key = getFileObjectUrlKey(file);
  if (!key) return "";
  if (!createPreviewAssetUrlCache.has(key)) {
    createPreviewAssetUrlCache.set(key, URL.createObjectURL(file));
  }
  return createPreviewAssetUrlCache.get(key) || "";
}

function syncCreatePreviewAssetUrls(files = []) {
  const activeKeys = new Set(files.map((file) => getFileObjectUrlKey(file)).filter(Boolean));
  createPreviewAssetUrlCache.forEach((url, key) => {
    if (activeKeys.has(key)) return;
    URL.revokeObjectURL(url);
    createPreviewAssetUrlCache.delete(key);
  });
}

function getCreativePreviewAssets() {
  const files = Array.from(document.getElementById("creative-upload")?.files || []);
  syncCreatePreviewAssetUrls(files);
  return files.map((file) => ({
    name: file.name,
    type: file.type,
    url: getCachedCreatePreviewAssetUrl(file)
  }));
}

function getCreateImagePreviewAssets() {
  const imageFields = [
    { id: "create-image-square-upload", key: "square", label: "Feed image", aspectRatio: "1:1" },
    { id: "create-image-portrait-upload", key: "portrait", label: "Instagram feed image", aspectRatio: "4:5" },
    { id: "create-image-vertical-upload", key: "vertical", label: "Stories / Reels image", aspectRatio: "9:16" }
  ];

  const files = imageFields
    .map((field) => document.getElementById(field.id)?.files?.[0] || null)
    .filter(Boolean);
  syncCreatePreviewAssetUrls(files);

  return imageFields
    .map((field) => {
      const file = document.getElementById(field.id)?.files?.[0] || null;
      if (!file) return null;
      return {
        key: field.key,
        label: field.label,
        aspectRatio: field.aspectRatio,
        name: file.name,
        type: file.type,
        url: getCachedCreatePreviewAssetUrl(file)
      };
    })
    .filter(Boolean);
}

function getCreateCarouselPreviewAssetGroups() {
  const orderState = typeof window !== "undefined" && window.__westpackCarouselOrders && typeof window.__westpackCarouselOrders === "object"
    ? window.__westpackCarouselOrders
    : {};
  const groups = [
    { id: "create-carousel-square-upload", key: "square", label: "Carousel cards", aspectRatio: "1:1" }
  ];
  const activeFiles = groups.flatMap((group) => {
    const files = Array.from(document.getElementById(group.id)?.files || []);
    const order = Array.isArray(orderState[group.key]) ? orderState[group.key] : [];
    return order.length
      ? order.map((index) => files[index] || null).filter(Boolean)
      : files;
  });
  syncCreatePreviewAssetUrls(activeFiles);

  return groups
    .map((group) => {
      const files = Array.from(document.getElementById(group.id)?.files || []);
      const order = Array.isArray(orderState[group.key]) ? orderState[group.key] : [];
      const orderedFiles = order.length
        ? order.map((index) => files[index] || null).filter(Boolean)
        : files;
      return {
        ...group,
        items: orderedFiles.map((file) => ({
          name: file.name,
          type: file.type,
          url: getCachedCreatePreviewAssetUrl(file)
        }))
      };
    })
    .filter((group) => group.items.length);
}

function getCreateCarouselSlotSummaries() {
  const groups = getCreateCarouselPreviewAssetGroups();
  const slotCount = groups.length ? Math.max(...groups.map((group) => group.items.length)) : 0;
  return Array.from({ length: slotCount }, (_, index) => ({
    index,
    variants: groups.map((group) => ({
      key: group.key,
      label: group.aspectRatio,
      asset: group.items[index] || null
    }))
  }));
}

function renderMediaAsset(asset, label) {
  if (!asset) {
    return `
      <div class="meta-media meta-media-placeholder">
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  if (asset.type.startsWith("video/")) {
    return `
      <div class="meta-media">
        <video src="${asset.url}" muted playsinline controls></video>
      </div>
    `;
  }

  return `
    <div class="meta-media">
      <img src="${asset.url}" alt="${escapeHtml(asset.name || label)}">
    </div>
  `;
}

function renderRemoteVideoAsset(variant, label, isActive = false) {
  const source = variant?.localObjectUrl || variant?.url || "";
  if (!source) {
    return "";
  }

  return `
    <div class="meta-media meta-media-remote-video${isActive ? " is-active" : ""}" data-video-placement-panel="${escapeHtml(variant.key || "")}">
      <video src="${source}" muted playsinline controls></video>
      <span class="meta-video-ratio-badge">${escapeHtml(variant.aspectRatio || label)}</span>
    </div>
  `;
}

function renderRemoteImageAsset(variant, label, isActive = false) {
  const source = variant?.localObjectUrl || variant?.url || "";
  if (!source) {
    return "";
  }

  return `
    <div class="meta-media meta-media-remote-video${isActive ? " is-active" : ""}" data-image-placement-panel="${escapeHtml(variant.key || "")}">
      <img src="${source}" alt="${escapeHtml(variant.fileName || variant.name || label)}">
      <span class="meta-video-ratio-badge">${escapeHtml(variant.aspectRatio || label)}</span>
    </div>
  `;
}

function normalizePreviewCopy(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function clampPreviewCopy(value, maxLength) {
  const normalized = normalizePreviewCopy(value);
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength + 1);
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf(", "),
    clipped.lastIndexOf(" ")
  );
  const safeCut = boundary >= Math.floor(maxLength * 0.6) ? boundary : maxLength;
  return `${clipped.slice(0, safeCut).trim().replace(/[,.!?;:]+$/g, "")}...`;
}

function getPreviewPlacements(preview) {
  if (preview.adFormat === "Carousel" && Array.isArray(preview.carouselVariants) && preview.carouselVariants.length) {
    return [
      { key: "feed", label: "FB Feed", active: true, variantKey: "square" },
      { key: "instagram-feed", label: "IG Feed", active: false, variantKey: "square" },
      { key: "stories", label: "Stories", active: false, variantKey: "square" },
      { key: "reels", label: "Reels", active: false, variantKey: "square" }
    ];
  }

  if (preview.adFormat === "Single image" && Array.isArray(preview.imageVariants) && preview.imageVariants.length) {
    return [
      { key: "feed", label: "FB Feed", active: true, variantKey: "square" },
      { key: "instagram-feed", label: "IG Feed", active: false, variantKey: "portrait" },
      { key: "stories", label: "Stories", active: false, variantKey: "vertical" },
      { key: "reels", label: "Reels", active: false, variantKey: "vertical" }
    ];
  }

  if (preview.adFormat !== "Video") {
    return [
      { key: "feed", label: "Feed", active: true },
      { key: "stories", label: "Stories", active: false },
      { key: "reels", label: "Reels", active: false }
    ];
  }

  return [
    { key: "feed", label: "Feed", active: true, variantKey: "square" },
    { key: "stories", label: "Stories", active: false, variantKey: "vertical" },
    { key: "reels", label: "Reels", active: false, variantKey: "vertical" }
  ];
}

function renderVideoPlacementMedia(preview) {
  const variants = Array.isArray(preview.videoVariants) ? preview.videoVariants : [];
  const squareVariant = variants.find((variant) => variant.key === "square") || variants[0] || null;
  const verticalVariant = variants.find((variant) => variant.key === "vertical") || variants[1] || squareVariant;

  if (!squareVariant && !verticalVariant) {
    return renderMediaAsset(null, "Video creative");
  }

  return `
    <div class="meta-video-placement-shell">
      ${renderRemoteVideoAsset(squareVariant, "Feed video", true)}
      ${verticalVariant && verticalVariant !== squareVariant ? renderRemoteVideoAsset(verticalVariant, "Stories / Reels video", false) : ""}
      <div class="meta-video-placement-note">
        <span>Feed uses 1:1</span>
        <span>Stories & Reels use 9:16</span>
      </div>
    </div>
  `;
}

function renderImagePlacementMedia(preview) {
  const variants = Array.isArray(preview.imageVariants) ? preview.imageVariants : [];
  const squareVariant = variants.find((variant) => variant.key === "square") || variants[0] || null;
  const portraitVariant = variants.find((variant) => variant.key === "portrait") || squareVariant;
  const verticalVariant = variants.find((variant) => variant.key === "vertical") || portraitVariant || squareVariant;

  if (!squareVariant && !portraitVariant && !verticalVariant) {
    return renderMediaAsset(null, "Image creative");
  }

  return `
    <div class="meta-video-placement-shell">
      ${renderRemoteImageAsset(squareVariant, "Feed image", true)}
      ${portraitVariant && portraitVariant !== squareVariant ? renderRemoteImageAsset(portraitVariant, "Instagram feed image", false) : ""}
      ${verticalVariant && verticalVariant !== portraitVariant && verticalVariant !== squareVariant ? renderRemoteImageAsset(verticalVariant, "Stories / Reels image", false) : ""}
      <div class="meta-video-placement-note">
        <span>FB feed and square placements use 1:1</span>
        <span>Instagram feed uses 4:5</span>
        <span>Stories & Reels use 9:16</span>
      </div>
    </div>
  `;
}

function renderCarouselMedia(assets, attachments) {
  const sourceItems = attachments?.length
    ? attachments.map((attachment, index) => ({
        title: clampPreviewCopy(attachment.name || `Card ${index + 1}`, 34),
        subtitle: clampPreviewCopy(attachment.description || "Translated carousel card", 82),
        asset: assets[index] || null
      }))
    : (assets.length ? assets.map((asset, index) => ({
        title: clampPreviewCopy(asset.name, 34),
        subtitle: `Card ${index + 1}`,
        asset
      })) : [
        { title: "Card 1", subtitle: "Carousel creative", asset: null },
        { title: "Card 2", subtitle: "Carousel creative", asset: null },
        { title: "Card 3", subtitle: "Carousel creative", asset: null }
      ]);

  return `
    <div class="meta-carousel-shell">
      <div class="meta-carousel-track">
      ${sourceItems.map((item, index) => `
        <article class="meta-carousel-card">
          ${renderMediaAsset(item.asset, item.title)}
          <div class="meta-carousel-copy">
            <strong data-live-card-title="${index}">${escapeHtml(item.title)}</strong>
            <span data-live-card-subtitle="${index}">${escapeHtml(item.subtitle)}</span>
          </div>
          <button type="button">Shop now</button>
        </article>
      `).join("")}
      </div>
      <div class="meta-carousel-footer">
        <div class="meta-carousel-scrollbar" aria-hidden="true"><span></span></div>
        <span class="meta-carousel-hint">Swipe to view more</span>
      </div>
    </div>
  `;
}

function renderCarouselPlacementMedia(preview, translatedAttachments) {
  const groups = getCreateCarouselPreviewAssetGroups();
  const squareGroup = groups.find((group) => group.key === "square") || groups[0] || null;
  if (!squareGroup) {
    return renderCarouselMedia([], translatedAttachments);
  }

  return `
    <div class="meta-video-placement-shell">
      <div class="meta-media meta-media-remote-video is-active" data-carousel-placement-panel="square">
        ${renderCarouselMedia(squareGroup?.items || [], translatedAttachments)}
      </div>
      <div class="meta-video-placement-note">
        <span>Carousel publish uses the uploaded 1:1 card set</span>
        <span>All placements reuse the same card order, copy and URL</span>
      </div>
    </div>
  `;
}

export function renderPreview(preview) {
  const stack = document.getElementById("preview-stack");
  const editorStack = document.getElementById("preview-editor-stack");
  const editorHint = document.getElementById("preview-editor-hint");
  if (!stack || !editorStack) {
    return;
  }
  const isCreateMode = !preview.sourceId;
  const carouselSlotSummaries = preview.adFormat === "Carousel" && isCreateMode
    ? getCreateCarouselSlotSummaries()
    : [];
  const creativeAssets = preview.adFormat === "Single image" && isCreateMode
    ? getCreateImagePreviewAssets()
    : preview.adFormat === "Carousel" && isCreateMode
      ? (getCreateCarouselPreviewAssetGroups().find((group) => group.key === "square")?.items || [])
      : getCreativePreviewAssets();
  const translatedAttachments = Array.isArray(preview.translatedAttachments) ? preview.translatedAttachments : [];
  const attachmentCards = translatedAttachments.length
    ? `
      <article class="preview-card preview-card-wide">
        <h4>Carousel Cards</h4>
        ${translatedAttachments.map((attachment, index) => `
          <div class="attachment-preview">
            <div class="attachment-preview-header">
              <strong>Card ${index + 1}</strong>
              <span class="attachment-preview-tag">${escapeHtml(carouselSlotSummaries[index]?.variants.filter((variant) => variant.asset).map((variant) => variant.label).join(" + ") || creativeAssets[index]?.name || "Shared card slot")}</span>
            </div>
            ${carouselSlotSummaries[index]?.variants?.length ? `
              <div class="attachment-slot-preview">
                ${carouselSlotSummaries[index].variants.map((variant) => variant.asset ? `
                  <div class="attachment-slot-chip">
                    <img src="${variant.asset.url}" alt="${escapeHtml(variant.asset.name || variant.label)}">
                    <span>${escapeHtml(variant.label)}</span>
                  </div>
                ` : "").join("")}
              </div>
            ` : ""}
            <label class="attachment-field">
              <span>Headline</span>
              <textarea class="preview-textarea" rows="1" data-attachment-index="${index}" data-attachment-field="name">${escapeHtml(attachment.name || "")}</textarea>
            </label>
            <label class="attachment-field">
              <span>Description</span>
              <textarea class="preview-textarea" rows="2" data-attachment-index="${index}" data-attachment-field="description">${escapeHtml(attachment.description || "")}</textarea>
            </label>
          </div>
        `).join("")}
      </article>
    `
    : "";
  const domain = (() => {
    try {
      return new URL(preview.destinationUrl || "https://www.westpack.com/").hostname.replace("www.", "");
    } catch {
      return "westpack.com";
    }
  })();
  const isCarousel = preview.adFormat === "Carousel";
  const isVideo = preview.adFormat === "Video";
  const previewPrimaryText = clampPreviewCopy(preview.primaryText, isCarousel ? 150 : 180);
  const previewHeadline = clampPreviewCopy(preview.headline, 44);
  const placements = getPreviewPlacements(preview);
  const visualMarkup = isCarousel
    ? isCreateMode && Array.isArray(preview.carouselVariants) && preview.carouselVariants.length
      ? renderCarouselPlacementMedia(preview, translatedAttachments)
      : renderCarouselMedia(creativeAssets, translatedAttachments)
    : isVideo
      ? renderVideoPlacementMedia(preview)
      : preview.adFormat === "Single image" && Array.isArray(preview.imageVariants) && preview.imageVariants.length
        ? renderImagePlacementMedia(preview)
        : renderMediaAsset(creativeAssets[0], preview.adFormat);
  const copyCards = isCreateMode
    ? `
       <article class="preview-card">
         <h4>Primary Text</h4>
         <textarea class="preview-textarea" rows="5" data-edit-field="primaryText">${escapeHtml(preview.primaryText)}</textarea>
       </article>
       <article class="preview-card">
         <h4>Headline</h4>
         <textarea class="preview-textarea" rows="2" data-edit-field="headline">${escapeHtml(preview.headline)}</textarea>
       </article>
       <article class="preview-card">
         <h4>Description</h4>
         <textarea class="preview-textarea" rows="3" data-edit-field="description">${escapeHtml(preview.description || "")}</textarea>
       </article>
       ${attachmentCards}
     `
    : `
       <article class="preview-card">
         <h4>Primary Text</h4>
         <textarea class="preview-textarea" rows="5" data-edit-field="primaryText">${escapeHtml(preview.primaryText)}</textarea>
       </article>
       <article class="preview-card">
         <h4>Headline</h4>
         <textarea class="preview-textarea" rows="2" data-edit-field="headline">${escapeHtml(preview.headline)}</textarea>
       </article>
       <article class="preview-card">
         <h4>Description</h4>
         <textarea class="preview-textarea" rows="3" data-edit-field="description">${escapeHtml(preview.description)}</textarea>
       </article>
       ${attachmentCards}
     `;

  stack.innerHTML = `
    <article class="preview-card preview-card-visual">
      <div class="meta-preview-shell">
        <div class="meta-preview-header">
          <div class="meta-preview-toggle">
            <span class="is-active">Ad</span>
            <span>Destination</span>
          </div>
          <div class="meta-preview-placements">
            ${placements.map((placement) => `
              <button
                type="button"
                class="${placement.active ? "is-active" : ""}"
                data-preview-placement="${escapeHtml(placement.key)}"
                data-preview-variant="${escapeHtml(placement.variantKey || "")}"
              >${escapeHtml(placement.label)}</button>
            `).join("")}
          </div>
        </div>
        <div class="meta-preview-stage ${isCarousel ? "is-carousel" : ""}">
          <article class="meta-ad-card">
            <div class="meta-ad-top">
              <div class="meta-brand-badge">WP</div>
              <div>
                <strong>Westpack - Europe's Preferred Jewellery Packaging</strong>
                <p>Ad</p>
              </div>
              <span class="meta-menu">...</span>
            </div>
            <p class="meta-primary-copy" data-live-field="primaryText" data-focus-field="primaryText">${escapeHtml(previewPrimaryText)}</p>
            ${visualMarkup}
            <div class="meta-destination-bar">
              <div>
                <span>${escapeHtml(domain)}</span>
                <strong data-live-field="headline" data-focus-field="headline">${escapeHtml(previewHeadline)}</strong>
              </div>
              <button type="button">Shop now</button>
            </div>
            <div class="meta-engagement">
              <span>Like</span>
              <span>Comment</span>
              <span>Share</span>
            </div>
          </article>
        </div>
      </div>
    </article>
  `;
  editorStack.innerHTML = copyCards;
  if (editorHint) {
    editorHint.textContent = isCreateMode
      ? "Review the AI output here and make manual copy changes before pushing to Meta."
      : "Translate, tighten or rewrite the generated copy here before pushing to Meta.";
  }

  if (isVideo) {
    const placementButtons = Array.from(stack.querySelectorAll("[data-preview-placement]"));
    const videoPanels = Array.from(stack.querySelectorAll("[data-video-placement-panel]"));
    placementButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextVariant = button.getAttribute("data-preview-variant") || "square";
        placementButtons.forEach((candidate) => {
          candidate.classList.toggle("is-active", candidate === button);
        });
        videoPanels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.getAttribute("data-video-placement-panel") === nextVariant);
        });
      });
    });
  }

  if (preview.adFormat === "Single image" && Array.isArray(preview.imageVariants) && preview.imageVariants.length) {
    const placementButtons = Array.from(stack.querySelectorAll("[data-preview-placement]"));
    const imagePanels = Array.from(stack.querySelectorAll("[data-image-placement-panel]"));
    placementButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextVariant = button.getAttribute("data-preview-variant") || "square";
        placementButtons.forEach((candidate) => {
          candidate.classList.toggle("is-active", candidate === button);
        });
        imagePanels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.getAttribute("data-image-placement-panel") === nextVariant);
        });
      });
    });
  }

  if (preview.adFormat === "Carousel" && isCreateMode && Array.isArray(preview.carouselVariants) && preview.carouselVariants.length) {
    const placementButtons = Array.from(stack.querySelectorAll("[data-preview-placement]"));
    const carouselPanels = Array.from(stack.querySelectorAll("[data-carousel-placement-panel]"));
    placementButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextVariant = button.getAttribute("data-preview-variant") || "square";
        placementButtons.forEach((candidate) => {
          candidate.classList.toggle("is-active", candidate === button);
        });
        carouselPanels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.getAttribute("data-carousel-placement-panel") === nextVariant);
        });
      });
    });
  }
}

export function setPreviewLoading(isLoading, message = "Generating preview...") {
  const loader = document.getElementById("preview-loader");
  const loaderText = document.getElementById("preview-loader-text");
  const stack = document.getElementById("preview-stack");
  const editorStack = document.getElementById("preview-editor-stack");

  if (!loader || !stack) {
    return;
  }

  loader.hidden = !isLoading;
  stack.classList.toggle("is-loading", isLoading);
  if (editorStack) {
    editorStack.classList.toggle("is-loading", isLoading);
  }

  if (loaderText) {
    loaderText.textContent = message;
  }
}

export function renderVariants(variants) {
  const target = document.getElementById("variant-list");
  const summaryMeta = document.querySelector("#variants-card .accordion-meta");
  if (summaryMeta) {
    summaryMeta.textContent = `${Array.isArray(variants) ? variants.length : 0} options`;
  }
  target.innerHTML = variants.map((variant) => `
    <article class="variant-item">
      <strong>${variant.title}</strong>
      <p>${variant.body}</p>
      <p><strong>Headline:</strong> ${variant.headline}</p>
      <p>${variant.angle}</p>
    </article>
  `).join("");
}

export function renderPayload(payload) {
  document.getElementById("payload-preview").textContent = JSON.stringify(payload, null, 2);
}

export function setStudioStatus(message, tone = "neutral") {
  const target = document.getElementById("studio-status");
  if (!target) {
    return;
  }

  target.textContent = message;
  target.dataset.tone = tone;

  document.querySelectorAll("[data-studio-status-mirror]").forEach((node) => {
    node.textContent = message;
    node.dataset.tone = tone;
  });
}

export function renderIntegrations(items) {
  const grid = document.getElementById("integration-grid");
  grid.innerHTML = items.map((item) => `
    <article class="integration-item">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
    </article>
  `).join("");
}

export function renderSettings({ meta, openAi, promptCards }) {
  document.getElementById("meta-connection-status").textContent = meta.status;
  document.getElementById("meta-write-actions").innerHTML = meta.writeActions.map((action) => `
    <li>${action}</li>
  `).join("");
  document.getElementById("openai-status").textContent = `Status: ${openAi.status}`;
  document.getElementById("openai-model").textContent = `Model target: ${openAi.model}`;
  document.getElementById("openai-purpose").textContent = `Purpose: ${openAi.purpose}`;
  document.getElementById("prompt-stack").innerHTML = promptCards.map((item) => `
    <article class="prompt-item">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
    </article>
  `).join("");
}

export function switchTab(nextTab) {
  const isDashboard = nextTab === "dashboard";
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === nextTab);
  });
  document.getElementById("dashboard-panel").classList.toggle("active", isDashboard);
  document.getElementById("studio-panel").classList.toggle("active", !isDashboard);
  document.getElementById("meta-product-panel")?.classList.toggle("is-studio-active", !isDashboard);
  document.getElementById("view-title").textContent = isDashboard ? "Dashboard" : "Ads";
}

export function toggleSettings(forceOpen) {
  const drawer = document.getElementById("settings-drawer");
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !drawer.classList.contains("open");
  drawer.classList.toggle("open", shouldOpen);
  drawer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
}

export function setStudioMode(mode) {
  const duplicateButton = document.getElementById("duplicate-mode-button");
  const createButton = document.getElementById("create-mode-button");

  duplicateButton.classList.toggle("active", mode === "duplicate");
  createButton.classList.toggle("active", mode === "create");
  duplicateButton.setAttribute("aria-selected", mode === "duplicate" ? "true" : "false");
  createButton.setAttribute("aria-selected", mode === "create" ? "true" : "false");
  document.getElementById("duplicate-workspace").classList.toggle("active", mode === "duplicate");
  document.getElementById("create-workspace").classList.toggle("active", mode === "create");
}

