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

function formatCurrency(value, currency = "EUR", fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(number);
}

export function renderCampaignTable(campaigns, lens = 'awareness', options = {}) {
  const head = document.getElementById('campaign-table-head');
  const table = document.getElementById('campaign-table');
  if (!table) return;
  if (!head) return;

  const incrementalityFactor = Number.isFinite(options.incrementalityFactor)
    ? options.incrementalityFactor
    : 0.6;
  const currency = String(options.currency || "EUR").trim().toUpperCase() || "EUR";

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
    if (lens === 'conversion_incremental') {
      return [
        { key: 'name', label: 'Campaign' },
        { key: 'spend', label: 'Spend' },
        { key: 'purchases', label: 'Purchases' },
        { key: 'cpa', label: 'CPA' },
        { key: 'roas', label: 'ROAS' },
        { key: 'status', label: 'Status' }
      ];
    }
    if (lens === 'conversion_standard') {
      return [
        { key: 'name', label: 'Campaign' },
        { key: 'spend', label: 'Spend' },
        { key: 'purchases', label: 'Purchases' },
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
        const status = campaign.status || 'Healthy';
        return `
          <td>
            <span class="campaign-status ${status === 'Watch' ? 'attention' : ''}">
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

export function setDashboardAgentStatus(message, tone = "neutral") {
  const node = document.getElementById("dashboard-agent-status");
  if (!node) return;
  node.textContent = message || "";
  node.dataset.tone = tone;
}

export function renderDashboardAgentList(items = []) {
  const node = document.getElementById("dashboard-agent-list");
  if (!node) return;
  if (!items.length) {
    node.innerHTML = "";
    return;
  }
  node.innerHTML = items.map((item) => `
    <article class="agent-item">
      <strong>${escapeHtml(item.title || "")}</strong>
      <p>${escapeHtml(item.body || "")}</p>
    </article>
  `).join("");
}

export function renderDecisionBoard(cards = []) {
  const node = document.getElementById("decision-board");
  if (!node) return;
  if (!itemsHaveLength(cards)) {
    node.innerHTML = "";
    return;
  }

  node.innerHTML = cards.map((card) => `
    <article class="decision-card tone-${escapeHtml(card.tone || "neutral")}" data-action="${escapeHtml((card.action || "Review").toLowerCase())}">
      <div class="decision-card-top">
        <span class="section-label">${escapeHtml(card.kicker || "")}</span>
        <span class="decision-chip">${escapeHtml(card.action || "Review")}</span>
      </div>
      <h4>${escapeHtml(card.title || "")}</h4>
      <div class="decision-value">${escapeHtml(card.metric || "--")}</div>
      <p>${escapeHtml(card.body || "")}</p>
      <div class="decision-footer">
        <strong>${escapeHtml(card.campaign || "")}</strong>
      </div>
    </article>
  `).join("");
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

export function renderExecutiveBrief(brief) {
  const node = document.getElementById("dashboard-executive-brief");
  const kickerNode = document.getElementById("dashboard-brief-kicker");
  if (!node) return;

  if (!brief) {
    node.innerHTML = "";
    if (kickerNode) kickerNode.textContent = "";
    return;
  }

  if (kickerNode) {
    kickerNode.textContent = brief.kicker || "";
  }

  node.innerHTML = `
    <div class="executive-headline">
      <h4>${escapeHtml(brief.headline || "")}</h4>
      <p>${escapeHtml(brief.body || "")}</p>
    </div>
    <div class="brief-points">
      ${(brief.points || []).map((point) => `
        <article class="brief-point">
          <span>${escapeHtml(point.label || "")}</span>
          <strong>${escapeHtml(point.value || "--")}</strong>
          <p>${escapeHtml(point.meta || "")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

export function renderPressureGrid(groups = []) {
  const node = document.getElementById("dashboard-pressure-grid");
  if (!node) return;
  if (!itemsHaveLength(groups)) {
    node.innerHTML = "";
    return;
  }

  node.innerHTML = groups.map((group) => `
    <article class="pressure-group tone-${escapeHtml(group.tone || "neutral")}">
      <div class="pressure-group-top">
        <strong>${escapeHtml(group.title || "")}</strong>
        <span>${escapeHtml(group.meta || "")}</span>
      </div>
      <p>${escapeHtml(group.body || "")}</p>
      <div class="pressure-group-list">
        ${(group.items || []).map((item) => `
          <div class="pressure-item">
            <strong>${escapeHtml(item.name || "")}</strong>
            <span>${escapeHtml(item.metric || "--")}</span>
          </div>
        `).join("")}
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
  const buildPoints = (inputSeries = []) => {
    const step = inputSeries.length > 1 ? width / (inputSeries.length - 1) : width;
    return inputSeries.map((point, index) => {
      const x = inputSeries.length > 1 ? index * step : width / 2;
      const y = baseline - ((Math.max(0, Number(point.value) || 0) / max) * 42);
      return { x, y };
    });
  };
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

