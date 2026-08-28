export async function generateKlaviyoCampaignVariantPreviewAction({
  appState,
  ensureKlaviyoTemplateSourceReady,
  renderKlaviyoWorkspace,
  requestKlaviyoTemplateVariant
}) {
  let sourceTemplate = null;
  try {
    sourceTemplate = await ensureKlaviyoTemplateSourceReady();
  } catch (error) {
    appState.klaviyoCampaignVariantError = error.message || "Source template HTML is not loaded yet.";
    renderKlaviyoWorkspace();
    return;
  }

  const sourceBody = String(sourceTemplate?.html || sourceTemplate?.body || sourceTemplate?.text || "").trim();

  appState.klaviyoCampaignVariantLoading = true;
  appState.klaviyoCampaignVariantError = "";
  appState.klaviyoCampaignCreateError = "";
  appState.klaviyoCampaignCreateResult = null;
  renderKlaviyoWorkspace();

  try {
    const variant = await requestKlaviyoTemplateVariant({
      country: appState.klaviyoTemplateSourceAccount,
      sourceTemplateName: sourceTemplate?.name || "",
      sourceSubject: sourceTemplate?.subject || sourceTemplate?.name || "",
      sourcePreviewText: sourceTemplate?.previewText || "",
      sourceEditorType: sourceTemplate?.editorType || "",
      sourceDefinition: sourceTemplate?.definition || null,
      sourceBody,
      operatorBrief: String(appState.klaviyoCampaignBrief || "").trim()
    });

    appState.klaviyoCampaignVariant = variant || null;
    appState.klaviyoCampaignVariantGeneratedAt = new Date().toISOString();
  } catch (error) {
    appState.klaviyoCampaignVariantError = error.message || "AI campaign variant failed.";
    appState.klaviyoCampaignVariant = null;
    appState.klaviyoCampaignVariantGeneratedAt = "";
  } finally {
    appState.klaviyoCampaignVariantLoading = false;
    renderKlaviyoWorkspace();
  }
}

export async function duplicateKlaviyoCampaignWithAiVariantAction({
  appState,
  getSelectedKlaviyoTemplate,
  renderKlaviyoWorkspace,
  requestKlaviyoCreateTemplateVariant
}) {
  const sourceTemplate = getSelectedKlaviyoTemplate();
  const variant = appState.klaviyoCampaignVariant;
  if (!sourceTemplate?.name || !variant?.body || !variant?.subject) {
    appState.klaviyoCampaignCreateError = "Generate the AI template version before creating the new template.";
    renderKlaviyoWorkspace();
    return;
  }

  const newTemplateName = String(variant.templateName || `${sourceTemplate.name} | AI variant`).trim();
  if (!newTemplateName) {
    appState.klaviyoCampaignCreateError = "The AI variant did not return a usable template name.";
    renderKlaviyoWorkspace();
    return;
  }

  appState.klaviyoCampaignCreating = true;
  appState.klaviyoCampaignCreateError = "";
  renderKlaviyoWorkspace();

  try {
    const payload = await requestKlaviyoCreateTemplateVariant({
      country: appState.klaviyoTemplateSourceAccount,
      sourceTemplateId: sourceTemplate.id || "",
      sourceTemplateName: sourceTemplate.name || "",
      sourceEditorType: sourceTemplate.editorType || "",
      templateName: newTemplateName,
      subject: variant.subject || "",
      previewText: variant.previewText || "",
      body: variant.body || "",
      structuredDefinition: variant.structuredDefinition || null
    });

    appState.klaviyoCampaignCreateResult = payload;
  } catch (error) {
    appState.klaviyoCampaignCreateError = error.message || "Klaviyo draft creation failed.";
    appState.klaviyoCampaignCreateResult = null;
  } finally {
    appState.klaviyoCampaignCreating = false;
    renderKlaviyoWorkspace();
  }
}

export function renderKlaviyoCampaignAiPanel({
  appState,
  ensureKlaviyoTemplateSelections,
  getSelectedKlaviyoTemplate,
  getKlaviyoSourceTemplates,
  getKlaviyoTemplateAccounts,
  hasRenderableKlaviyoBody,
  buildKlaviyoPreviewHtml,
  buildKlaviyoChangePreviewMarkup,
  truncateKlaviyoPreviewText,
  formatKlaviyoNumber,
  formatKlaviyoDate,
  escapeHtml,
  klaviyoTranslationGuardrails
}) {
  ensureKlaviyoTemplateSelections();
  const detail = getSelectedKlaviyoTemplate();
  const sourceCampaignSelect = document.getElementById("klaviyo-campaign-source-select");
  const sourceAccountSelect = document.getElementById("klaviyo-campaign-source-account");
  const previewList = document.getElementById("klaviyo-campaign-preview-list");
  const summary = document.getElementById("klaviyo-campaign-summary");
  const guardrails = document.getElementById("klaviyo-campaign-guardrails");
  const status = document.getElementById("klaviyo-campaign-status");
  const refreshButton = document.getElementById("klaviyo-refresh-campaigns-button");
  const generateButton = document.getElementById("klaviyo-generate-campaign-variant-button");
  const duplicateButton = document.getElementById("klaviyo-duplicate-campaign-button");
  const briefField = document.getElementById("klaviyo-campaign-brief");
  const templates = getKlaviyoSourceTemplates(appState.klaviyoTemplateSourceAccount);
  const sourceBody = detail?.html || detail?.body || detail?.text || "";
  const sourceReady = Boolean(detail?.name && hasRenderableKlaviyoBody(sourceBody));
  const variantReady = Boolean(appState.klaviyoCampaignVariant?.body && hasRenderableKlaviyoBody(appState.klaviyoCampaignVariant.body));

  if (sourceAccountSelect) {
    sourceAccountSelect.innerHTML = getKlaviyoTemplateAccounts().map((account) => `
      <option value="${escapeHtml(account)}"${account === appState.klaviyoTemplateSourceAccount ? " selected" : ""}>${escapeHtml(account)}</option>
    `).join("");
    sourceAccountSelect.disabled = appState.klaviyoTemplateLoading;
  }

  if (sourceCampaignSelect) {
    sourceCampaignSelect.innerHTML = templates.length
      ? templates.map((template) => `
        <option value="${escapeHtml(template.id)}"${template.id === appState.klaviyoTemplateSourceTemplate ? " selected" : ""}>${escapeHtml(template.name)}</option>
      `).join("")
      : `<option value="">No live templates found</option>`;
    sourceCampaignSelect.disabled = appState.klaviyoTemplateLoading;
  }

  if (briefField && briefField.value !== appState.klaviyoCampaignBrief) {
    briefField.value = appState.klaviyoCampaignBrief || "";
  }

  if (previewList) {
    const variant = appState.klaviyoCampaignVariant;
    const changeSummary = variant?.changeSummary || null;
    const changedSamples = Array.isArray(changeSummary?.samples) ? changeSummary.samples : [];
    const showChangePreview = variantReady && changedSamples.length > 0;
    previewList.innerHTML = `
      <article class="klaviyo-variant-card">
        <div class="klaviyo-variant-head">
          <div>
            <p class="section-label">Source template</p>
            <h4>${escapeHtml(detail?.name || "Choose a template")}</h4>
          </div>
          <span class="decision-chip">${escapeHtml(detail?.account || appState.klaviyoTemplateSourceAccount || "Source")}</span>
        </div>
        <div class="klaviyo-variant-preview-shell">
          ${sourceReady ? `
            <iframe
              class="klaviyo-variant-preview"
              loading="lazy"
              sandbox=""
              referrerpolicy="no-referrer"
              srcdoc="${escapeHtml(buildKlaviyoPreviewHtml({
                templateName: detail?.name || "",
                sourceTemplateName: detail?.name || "",
                languageCode: appState.klaviyoTemplateSourceAccount,
                translationPath: "Source template",
                subject: detail?.subject || detail?.name || "",
                previewText: detail?.previewText || "",
                body: sourceBody
              }))}"
              title="Source template preview"></iframe>
          ` : `
            <div class="klaviyo-variant-preview-empty">
              <strong>Load source template</strong>
              <span>Choose a template with live HTML to preview it here.</span>
            </div>
          `}
        </div>
        <div class="klaviyo-variant-copy">
          <div>
            <span>Subject</span>
            <strong>${escapeHtml(detail?.subject || detail?.name || "--")}</strong>
          </div>
          <div>
            <span>Preview text</span>
            <strong>${escapeHtml(detail?.previewText || "--")}</strong>
          </div>
        </div>
      </article>
      <article class="klaviyo-variant-card">
        <div class="klaviyo-variant-head">
          <div>
            <p class="section-label">AI template</p>
            <h4>${escapeHtml(variant?.templateName || "Generate AI version")}</h4>
          </div>
          <span class="decision-chip">${escapeHtml(variantReady ? "Ready" : appState.klaviyoCampaignVariantLoading ? "Generating" : "Pending")}</span>
        </div>
        ${showChangePreview ? `
          <div class="klaviyo-inline-change-summary">
            <strong>Changed sections preview</strong>
            <span>These are real text blocks AI rewrote in the builder structure.</span>
          </div>
          ${buildKlaviyoChangePreviewMarkup(changedSamples)}
        ` : ""}
        <div class="klaviyo-variant-preview-shell">
          ${variantReady ? `
            <iframe
              class="klaviyo-variant-preview"
              loading="lazy"
              sandbox=""
              referrerpolicy="no-referrer"
              srcdoc="${escapeHtml(buildKlaviyoPreviewHtml({
                templateName: variant?.templateName || "",
                sourceTemplateName: detail?.name || "",
                languageCode: appState.klaviyoTemplateSourceAccount,
                translationPath: "AI template variant",
                subject: variant?.subject || "",
                previewText: variant?.previewText || "",
                body: variant?.body || ""
              }))}"
              title="AI template preview"></iframe>
          ` : `
            <div class="klaviyo-variant-preview-empty">
              <strong>Generate AI version</strong>
              <span>The alternative full-email template will render here after AI runs.</span>
            </div>
          `}
        </div>
        <div class="klaviyo-variant-copy">
          <div>
            <span>Subject</span>
            <strong>${escapeHtml(variant?.subject || "--")}</strong>
          </div>
          <div>
            <span>Preview text</span>
            <strong>${escapeHtml(variant?.previewText || "--")}</strong>
          </div>
          ${changeSummary?.changedCount ? `
            <div>
              <span>Changed copy</span>
              <p>AI changed ${escapeHtml(String(changeSummary.changedCount))} of ${escapeHtml(String(changeSummary.totalCount || changeSummary.changedCount))} detected text blocks.</p>
            </div>
          ` : ""}
          ${changedSamples.length ? `
            <div>
              <span>Example changes</span>
              <div class="klaviyo-change-list">
                ${changedSamples.map((sample) => `
                  <article class="klaviyo-change-item">
                    <strong>Before</strong>
                    <p>${escapeHtml(truncateKlaviyoPreviewText(sample.before || ""))}</p>
                    <strong>After</strong>
                    <p>${escapeHtml(truncateKlaviyoPreviewText(sample.after || ""))}</p>
                  </article>
                `).join("")}
              </div>
            </div>
          ` : ""}
          <div>
            <span>AI note</span>
            <p>${escapeHtml(variant?.rationale || "No AI note yet.")}</p>
          </div>
          ${variant?.sendStrategyNote ? `
            <div>
              <span>Send idea</span>
              <p>${escapeHtml(variant.sendStrategyNote)}</p>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }

  if (summary) {
    summary.innerHTML = `
      <article class="klaviyo-summary-note">
        <span>Account</span>
        <strong>${escapeHtml(appState.klaviyoTemplateSourceAccount)}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Templates loaded</span>
        <strong>${escapeHtml(formatKlaviyoNumber(appState.klaviyoTemplateCatalogCount || templates.length, 0))}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Source</span>
        <strong>${escapeHtml(detail?.name || "Choose a template")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>AI template name</span>
        <strong>${escapeHtml(appState.klaviyoCampaignVariant?.templateName || "Generate AI version first")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Preview</span>
        <strong>${escapeHtml(appState.klaviyoCampaignVariantGeneratedAt ? `Generated ${formatKlaviyoDate(appState.klaviyoCampaignVariantGeneratedAt)}` : "Not generated yet")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Create result</span>
        <strong>${escapeHtml(appState.klaviyoCampaignCreateResult?.templateId ? "Created in Klaviyo" : "No template created yet")}</strong>
      </article>
      ${appState.klaviyoCampaignCreateResult?.templateUrl ? `
        <article class="klaviyo-summary-note">
          <span>Template URL</span>
          <strong><a href="${escapeHtml(appState.klaviyoCampaignCreateResult.templateUrl)}" target="_blank" rel="noreferrer">Open template</a></strong>
        </article>
      ` : ""}
    `;
  }

  if (guardrails) {
    const items = [
      ...klaviyoTranslationGuardrails,
      {
        title: "Keep it truthful",
        body: "AI can increase urgency or shift angle, but it must not invent offers, deadlines or product facts that are not already true."
      }
    ];
    guardrails.innerHTML = items.map((item) => `
      <article class="prompt-item">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </article>
    `).join("");
  }

  if (status) {
    if (appState.klaviyoTemplateLoading) {
      status.textContent = `Fetching templates from ${appState.klaviyoTemplateSourceAccount}...`;
    } else if (appState.klaviyoCampaignCreating) {
      status.textContent = "Creating the new AI template in Klaviyo...";
    } else if (appState.klaviyoCampaignVariantLoading) {
      status.textContent = "Generating the full AI email version from the selected source template...";
    } else if (appState.klaviyoCampaignCreateError) {
      status.textContent = `Template creation failed. ${appState.klaviyoCampaignCreateError}`;
    } else if (appState.klaviyoCampaignCreateResult?.templateId) {
      status.textContent = `Template created · ${appState.klaviyoCampaignCreateResult.templateName || appState.klaviyoCampaignVariant?.templateName || "AI variant"}`;
    } else if (appState.klaviyoCampaignVariantError) {
      status.textContent = `AI generation failed. ${appState.klaviyoCampaignVariantError}`;
    } else if (appState.klaviyoCampaignVariantGeneratedAt) {
      status.textContent = "AI version ready. Review it and create the new Klaviyo template when it looks right.";
    } else if (sourceReady) {
      status.textContent = "Source template ready. Add a brief and generate the full AI version.";
    } else if (appState.klaviyoTemplateError) {
      status.textContent = `Template loading failed. ${appState.klaviyoTemplateError}`;
    } else if (templates.length) {
      status.textContent = `${formatKlaviyoNumber(templates.length, 0)} templates loaded for ${appState.klaviyoTemplateSourceAccount}`;
    } else {
      status.textContent = "Ready to choose a source template";
    }
  }

  if (refreshButton) {
    refreshButton.disabled = appState.klaviyoTemplateLoading;
    refreshButton.classList.toggle("is-loading", appState.klaviyoTemplateLoading);
    refreshButton.textContent = appState.klaviyoTemplateLoading ? "Fetching templates..." : "Refresh templates";
  }

  if (generateButton) {
    generateButton.disabled = appState.klaviyoTemplateLoading || !sourceReady || appState.klaviyoCampaignCreating || appState.klaviyoCampaignVariantLoading;
  }

  if (duplicateButton) {
    duplicateButton.disabled = !variantReady || appState.klaviyoCampaignCreating || appState.klaviyoCampaignVariantLoading;
  }
}
