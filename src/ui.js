export function renderStats(stats) {
  const grid = document.getElementById("stats-grid");
  grid.innerHTML = stats.map((item) => `
    <article class="stat-card">
      <p class="section-label">${item.label}</p>
      <div class="stat-value">${item.value}</div>
      <p class="stat-meta">${item.meta}</p>
    </article>
  `).join("");
}

export function renderCampaignTable(campaigns) {
  const table = document.getElementById("campaign-table");
  table.innerHTML = campaigns.map((campaign) => `
    <tr>
      <td>${campaign.name}</td>
      <td>${campaign.market}</td>
      <td>${campaign.spend}</td>
      <td>${campaign.roas}</td>
      <td>${campaign.ctr}</td>
      <td>
        <span class="campaign-status ${campaign.status === "Watch" ? "attention" : ""}">
          ${campaign.status}
        </span>
      </td>
    </tr>
  `).join("");
}

export function renderCardList(targetId, items, className) {
  const target = document.getElementById(targetId);
  target.innerHTML = items.map((item) => `
    <article class="${className}">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
    </article>
  `).join("");
}

export function renderAuditLog(auditLog) {
  const target = document.getElementById("audit-list");
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
  target.innerHTML = campaignMatches.map((item) => `
    <article class="match-item">
      <strong>${item.title}</strong>
      <p>${item.body}</p>
      <p>${item.reason}</p>
    </article>
  `).join("");
}

export function renderSelectors({ ads, campaigns, adaptationGoals }) {
  const sourceSelect = document.getElementById("source-ad");
  sourceSelect.innerHTML = ads.map((ad) => `
    <option value="${ad.id}">${ad.name} - ${ad.campaign}</option>
  `).join("");

  const targetSelect = document.getElementById("target-campaign");
  targetSelect.innerHTML = campaigns.map((campaign) => `
    <option value="${campaign.name}">${campaign.name}</option>
  `).join("");

  const goalSelect = document.getElementById("adaptation-goal");
  goalSelect.innerHTML = adaptationGoals.map((goal) => `
    <option value="${goal}">${goal}</option>
  `).join("");
}

export function renderPreview(preview) {
  const stack = document.getElementById("preview-stack");
  stack.innerHTML = `
    <article class="preview-card">
      <h4>Source Ad</h4>
      <p>${preview.source}</p>
    </article>
    <article class="preview-card">
      <h4>Destination</h4>
      <p>${preview.targetCampaign}</p>
      <p>${preview.targetLanguage}</p>
    </article>
    <article class="preview-card">
      <h4>Primary Text</h4>
      <p>${preview.primaryText}</p>
    </article>
    <article class="preview-card">
      <h4>Headline</h4>
      <p>${preview.headline}</p>
    </article>
    <article class="preview-card">
      <h4>Description</h4>
      <p>${preview.description}</p>
    </article>
    <article class="preview-card">
      <h4>AI Rationale</h4>
      <p>${preview.rationale}</p>
    </article>
  `;
}

export function renderVariants(variants) {
  const target = document.getElementById("variant-list");
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
  document.getElementById("view-title").textContent = isDashboard ? "Dashboard" : "Create / Manage Ads";
}

export function toggleSettings(forceOpen) {
  const drawer = document.getElementById("settings-drawer");
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !drawer.classList.contains("open");
  drawer.classList.toggle("open", shouldOpen);
  drawer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
}
