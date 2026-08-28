export async function generateKlaviyoRolloutPreviewAction({
  appState,
  ensureKlaviyoTemplateSourceReady,
  getKlaviyoMappedLanguageCode,
  getKlaviyoLanguageByCode,
  getKlaviyoTemplateAccounts,
  hasRenderableKlaviyoBody,
  requestKlaviyoTemplateTranslation,
  renderKlaviyoWorkspace
}) {
  appState.klaviyoTemplateGenerating = true;
  appState.klaviyoTemplateTranslationError = "";
  renderKlaviyoWorkspace();

  try {
    const sourceTemplate = await ensureKlaviyoTemplateSourceReady();
    const operatorBrief = String(appState.klaviyoTemplateBrief || "").trim();
    const targets = getKlaviyoTemplateAccounts()
      .filter((account) => (appState.klaviyoTemplateTargets || []).includes(account));
    const sourceLanguageCode = getKlaviyoMappedLanguageCode(sourceTemplate.account);
    const sourceLanguage = getKlaviyoLanguageByCode(sourceLanguageCode);
    const languages = [...new Set(targets
      .map((account) => getKlaviyoMappedLanguageCode(account))
      .filter(Boolean))]
      .map((code) => getKlaviyoLanguageByCode(code))
      .filter(Boolean);

    if (!sourceTemplate?.name) {
      throw new Error("Choose a source template first.");
    }
    if (!targets.length) {
      throw new Error("Choose at least one target country before generating drafts.");
    }
    if (!sourceLanguageCode || !sourceLanguage) {
      throw new Error(`Source account ${sourceTemplate.account} is missing a Klaviyo language mapping.`);
    }

    const sourceSubject = sourceTemplate.subject || sourceTemplate.name;
    const sourcePreviewText = sourceTemplate.previewText || "";
    const sourceBody = sourceTemplate.html || sourceTemplate.body || sourceTemplate.text || "";
    const generatedVariants = [];

    for (const language of languages) {
      if (language.code === sourceLanguageCode) {
        generatedVariants.push({
          code: language.code,
          label: language.label,
          subject: sourceSubject,
          previewText: sourcePreviewText,
          body: sourceBody,
          rationale: "Source language reused directly for matching target account.",
          translationPath: "Source -> same language",
          targetCount: targets.filter((account) => getKlaviyoMappedLanguageCode(account) === language.code).length
        });
        continue;
      }

      const translated = await requestKlaviyoTemplateTranslation({
        sourceTemplateName: sourceTemplate.name,
        sourceSubject,
        sourcePreviewText,
        sourceBody,
        sourceLanguage: sourceLanguage?.label || sourceTemplate.account,
        sourceCountry: sourceTemplate.account,
        targetLanguage: language.label,
        translationPath: `${sourceLanguage?.label || sourceTemplate.account} -> ${language.label}`,
        operatorNote: operatorBrief
      });

      generatedVariants.push({
        code: language.code,
        label: language.label,
        subject: translated.subject,
        previewText: translated.previewText,
        body: translated.body,
        rationale: translated.rationale,
        translationPath: `${sourceLanguage?.label || sourceTemplate.account} -> ${language.label}`,
        targetCount: targets.filter((account) => getKlaviyoMappedLanguageCode(account) === language.code).length
      });
    }

    const brokenVariant = generatedVariants.find((variant) => !hasRenderableKlaviyoBody(variant.body));
    if (brokenVariant) {
      throw new Error(`Generated ${brokenVariant.label} without renderable HTML. Draft push was blocked to avoid creating a broken Klaviyo email.`);
    }

    appState.klaviyoTemplateGeneratedVariants = generatedVariants;
    appState.klaviyoTemplateGeneratedFrom = sourceTemplate.id || sourceTemplate.name;
    appState.klaviyoTemplatePlanGeneratedAt = new Date().toISOString();
  } catch (error) {
    appState.klaviyoTemplateTranslationError = error.message || "Translation preview failed.";
  } finally {
    appState.klaviyoTemplateGenerating = false;
    renderKlaviyoWorkspace();
  }
}

export async function pushKlaviyoRolloutDraftsAction({
  appState,
  ensureKlaviyoTemplateSourceReady,
  buildKlaviyoTemplatePlan,
  hasRenderableKlaviyoBody,
  generateKlaviyoRolloutPreview,
  requestKlaviyoPushTemplateRollout,
  renderKlaviyoWorkspace
}) {
  const sourceTemplate = await ensureKlaviyoTemplateSourceReady().catch((error) => {
    appState.klaviyoTemplatePushError = error.message || "Source template is not ready.";
    renderKlaviyoWorkspace();
    return null;
  });
  if (!sourceTemplate) {
    return;
  }

  let plan = buildKlaviyoTemplatePlan();
  if (!plan.targets.length) {
    appState.klaviyoTemplatePushError = "Choose at least one target country before pushing drafts to Klaviyo.";
    renderKlaviyoWorkspace();
    return;
  }

  const needsGeneration = !plan.generatedAt
    || !plan.assignments.length
    || (plan.assignments || []).some((assignment) => !hasRenderableKlaviyoBody(assignment.body));

  if (needsGeneration) {
    await generateKlaviyoRolloutPreview();
    plan = buildKlaviyoTemplatePlan();
  }

  if (!plan.generatedAt || !plan.assignments.length) {
    appState.klaviyoTemplatePushError = appState.klaviyoTemplateTranslationError || "Generate the rollout preview before pushing drafts to Klaviyo.";
    renderKlaviyoWorkspace();
    return;
  }

  const invalidAssignment = (plan.assignments || []).find((assignment) => !hasRenderableKlaviyoBody(assignment.body));
  if (invalidAssignment) {
    appState.klaviyoTemplatePushError = appState.klaviyoTemplateTranslationError || `Blocked push for ${invalidAssignment.country}. The generated draft body is not valid HTML yet. Generate again after the source template detail loads properly.`;
    renderKlaviyoWorkspace();
    return;
  }

  appState.klaviyoTemplatePushing = true;
  appState.klaviyoTemplatePushError = "";
  renderKlaviyoWorkspace();

  try {
    const payload = await requestKlaviyoPushTemplateRollout({
      sourceTemplateName: plan.sourceTemplate.name,
      assignments: plan.assignments
    });

    appState.klaviyoTemplatePushResult = payload;
    appState.klaviyoTemplatePlanSavedAt = new Date().toISOString();
  } catch (error) {
    appState.klaviyoTemplatePushError = error.message || "Klaviyo draft push failed.";
    appState.klaviyoTemplatePushResult = null;
  } finally {
    appState.klaviyoTemplatePushing = false;
    renderKlaviyoWorkspace();
  }
}

export async function loadKlaviyoTemplateCatalogAction({
  appState,
  ensureKlaviyoTemplateSelections,
  requestKlaviyoTemplates,
  loadKlaviyoTemplateDetail,
  renderKlaviyoWorkspace,
  options = {}
}) {
  ensureKlaviyoTemplateSelections();
  const force = options.force === true;
  const key = `${appState.klaviyoTemplateSourceAccount}:list`;
  if (appState.klaviyoTemplateLoading) return;
  if (!force && appState.klaviyoTemplateLiveAttempted === key) return;

  appState.klaviyoTemplateLoading = true;
  appState.klaviyoTemplateError = "";
  appState.klaviyoTemplateLiveAttempted = key;
  appState.klaviyoTemplateLiveAccount = appState.klaviyoTemplateSourceAccount;
  appState.klaviyoTemplateSourceDetail = null;
  renderKlaviyoWorkspace();

  try {
    const payload = await requestKlaviyoTemplates({
      country: appState.klaviyoTemplateSourceAccount
    });
    appState.klaviyoTemplateCatalogLive = Array.isArray(payload?.templates) ? payload.templates : [];
    appState.klaviyoTemplateCatalogSource = String(payload?.source || "");
    appState.klaviyoTemplateCatalogCount = Number(payload?.templateCount || appState.klaviyoTemplateCatalogLive.length || 0);

    if (!appState.klaviyoTemplateCatalogLive.some((template) => template.id === appState.klaviyoTemplateSourceTemplate)) {
      appState.klaviyoTemplateSourceTemplate = appState.klaviyoTemplateCatalogLive[0]?.id || appState.klaviyoTemplateSourceTemplate;
    }
    if (!appState.klaviyoTemplateCatalogLive.length) {
      appState.klaviyoTemplateSourceTemplate = "";
    }
  } catch (error) {
    appState.klaviyoTemplateError = error.message || "Template catalog failed.";
    appState.klaviyoTemplateCatalogLive = [];
    appState.klaviyoTemplateSourceDetail = null;
    appState.klaviyoTemplateCatalogSource = "";
    appState.klaviyoTemplateCatalogCount = 0;
  } finally {
    appState.klaviyoTemplateLoading = false;
    renderKlaviyoWorkspace();
  }

  if (appState.klaviyoTemplateSourceTemplate) {
    await loadKlaviyoTemplateDetail(appState.klaviyoTemplateSourceTemplate);
  }
}

export async function loadKlaviyoTemplateDetailAction({
  appState,
  ensureKlaviyoTemplateSelections,
  requestKlaviyoTemplates,
  renderKlaviyoWorkspace,
  templateId
}) {
  ensureKlaviyoTemplateSelections();
  const nextTemplateId = String(templateId || appState.klaviyoTemplateSourceTemplate || "").trim();
  if (!nextTemplateId) {
    appState.klaviyoTemplateSourceDetail = null;
    renderKlaviyoWorkspace();
    return;
  }

  appState.klaviyoTemplateLoading = true;
  appState.klaviyoTemplateError = "";
  renderKlaviyoWorkspace();

  try {
    const payload = await requestKlaviyoTemplates({
      country: appState.klaviyoTemplateSourceAccount,
      templateId: nextTemplateId
    });
    appState.klaviyoTemplateSourceDetail = payload?.selectedTemplate || null;
  } catch (error) {
    appState.klaviyoTemplateError = error.message || "Template detail failed.";
    appState.klaviyoTemplateSourceDetail = null;
  } finally {
    appState.klaviyoTemplateLoading = false;
    renderKlaviyoWorkspace();
  }
}

export async function ensureKlaviyoTemplateSourceReadyAction({
  appState,
  ensureKlaviyoTemplateSelections,
  hasSelectedKlaviyoTemplateDetail,
  loadKlaviyoTemplateDetail,
  getSelectedKlaviyoTemplate,
  hasRenderableKlaviyoBody
}) {
  ensureKlaviyoTemplateSelections();
  if (!appState.klaviyoTemplateSourceTemplate) {
    throw new Error("Choose a source template first.");
  }

  if (!hasSelectedKlaviyoTemplateDetail()) {
    await loadKlaviyoTemplateDetail(appState.klaviyoTemplateSourceTemplate);
  }

  const sourceTemplate = getSelectedKlaviyoTemplate();
  if (!sourceTemplate?.account) {
    throw new Error("Source template account mapping is missing. Refresh templates and try again.");
  }

  if (!String(sourceTemplate.html || sourceTemplate.body || sourceTemplate.text || "").trim()) {
    throw new Error("Source template HTML is missing. Refresh template detail before generating drafts.");
  }

  if (!hasRenderableKlaviyoBody(sourceTemplate.html || sourceTemplate.body || sourceTemplate.text || "")) {
    throw new Error("Source template did not return renderable HTML. Duplicate can only run from a real Klaviyo email template.");
  }

  return sourceTemplate;
}

export function renderKlaviyoDuplicateTranslatePanel({
  appState,
  ensureKlaviyoTemplateSelections,
  buildKlaviyoTemplatePlan,
  hasSelectedKlaviyoTemplateDetail,
  hasRenderableKlaviyoBody,
  getKlaviyoTemplateAccounts,
  getKlaviyoSourceTemplates,
  getKlaviyoLanguageByCode,
  getKlaviyoMappedLanguageCode,
  buildKlaviyoPreviewHtml,
  buildKlaviyoHeroInspectorHtml,
  formatKlaviyoNumber,
  formatKlaviyoDate,
  escapeHtml,
  klaviyoTranslationGuardrails
}) {
  ensureKlaviyoTemplateSelections();
  const plan = buildKlaviyoTemplatePlan();
  const sourceTemplateReady = hasSelectedKlaviyoTemplateDetail() && hasRenderableKlaviyoBody(plan.sourceTemplate.html || plan.sourceTemplate.body || plan.sourceTemplate.text || "");
  const invalidVariant = plan.variants.find((variant) => !hasRenderableKlaviyoBody(variant.body));
  const blockingIssue = !sourceTemplateReady
    ? "Source template HTML is not loaded yet."
    : invalidVariant
      ? `${invalidVariant.label} is missing renderable HTML.`
      : "";
  const sourceAccountSelect = document.getElementById("klaviyo-template-source-account");
  const sourceTemplateSelect = document.getElementById("klaviyo-template-source-template");
  const targetGrid = document.getElementById("klaviyo-target-grid");
  const variantList = document.getElementById("klaviyo-template-variant-list");
  const rolloutSummary = document.getElementById("klaviyo-rollout-summary");
  const guardrails = document.getElementById("klaviyo-translation-guardrails");
  const status = document.getElementById("klaviyo-template-status");
  const pushButton = document.getElementById("klaviyo-push-rollout-button");
  const generateButton = document.getElementById("klaviyo-generate-rollout-button");
  const refreshTemplatesButton = document.getElementById("klaviyo-refresh-templates-button");
  const actionFeedback = document.getElementById("klaviyo-rollout-action-feedback");

  if (sourceAccountSelect) {
    sourceAccountSelect.innerHTML = getKlaviyoTemplateAccounts().map((account) => `
      <option value="${escapeHtml(account)}"${account === appState.klaviyoTemplateSourceAccount ? " selected" : ""}>${escapeHtml(account)}</option>
    `).join("");
    sourceAccountSelect.disabled = appState.klaviyoTemplateLoading;
  }

  if (sourceTemplateSelect) {
    const templateOptions = getKlaviyoSourceTemplates(appState.klaviyoTemplateSourceAccount);
    sourceTemplateSelect.innerHTML = templateOptions.length
      ? templateOptions.map((template) => `
        <option value="${escapeHtml(template.id)}"${template.id === appState.klaviyoTemplateSourceTemplate ? " selected" : ""}>${escapeHtml(template.name)}</option>
      `).join("")
      : `<option value="">No live templates found</option>`;
    sourceTemplateSelect.disabled = appState.klaviyoTemplateLoading;
  }

  if (targetGrid) {
    targetGrid.innerHTML = getKlaviyoTemplateAccounts().map((account) => {
      const isActive = (appState.klaviyoTemplateTargets || []).includes(account);
      const mappedLanguage = getKlaviyoLanguageByCode(getKlaviyoMappedLanguageCode(account));
      return `
        <article class="klaviyo-target-card${isActive ? " is-active" : ""}">
          <label class="klaviyo-target-card-toggle">
            <input class="klaviyo-target-toggle" type="checkbox" value="${escapeHtml(account)}" ${isActive ? "checked" : ""}>
            <strong>${escapeHtml(account)}</strong>
            <span>${escapeHtml(mappedLanguage?.label || "No mapped language")}</span>
          </label>
        </article>
      `;
    }).join("");
  }

  if (variantList) {
    const assignmentCards = plan.assignments.map((assignment) => `
      <article class="klaviyo-variant-card">
        <div class="klaviyo-variant-head">
          <div>
            <p class="section-label">${escapeHtml(`Draft · ${assignment.country}`)}</p>
            <h4>${escapeHtml(`${assignment.country} · ${assignment.label}`)} · ${escapeHtml(assignment.code)}</h4>
          </div>
          <span class="decision-chip">1 account</span>
        </div>
        <div class="klaviyo-variant-preview-shell">
          <iframe
            class="klaviyo-variant-preview"
            loading="lazy"
            sandbox=""
            referrerpolicy="no-referrer"
            srcdoc="${escapeHtml(buildKlaviyoPreviewHtml({
              templateName: `${plan.sourceTemplate.name} | ${assignment.country}`,
              sourceTemplateName: plan.sourceTemplate.name,
              languageCode: assignment.code,
              translationPath: assignment.translationPath,
              subject: assignment.subject,
              previewText: assignment.previewText,
              body: assignment.previewBody || assignment.body
            }))}"
            title="${escapeHtml(`${assignment.country} email preview`)}"></iframe>
        </div>
        <div class="klaviyo-variant-copy">
          <div>
            <span>Translation path</span>
            <strong>${escapeHtml(assignment.translationPath)}</strong>
          </div>
          <div>
            <span>Target account</span>
            <strong>${escapeHtml(assignment.country)}</strong>
          </div>
          <div>
            <span>Subject</span>
            <strong>${escapeHtml(assignment.subject)}</strong>
          </div>
          <div>
            <span>Preview text</span>
            <strong>${escapeHtml(assignment.previewText)}</strong>
          </div>
          <div>
            <span>Body validation</span>
            <p>${escapeHtml(
              hasRenderableKlaviyoBody(assignment.body)
                ? "Renderable HTML loaded."
                : "Missing renderable HTML. This draft cannot be pushed yet."
            )}</p>
          </div>
          ${assignment.urlWarnings?.length ? `
            <div>
              <span>URL validation</span>
              <p>${escapeHtml(assignment.urlWarnings
                .map((warning) => `expected ${warning.expectedSnippet}, found ${warning.foundSnippet}`)
                .join(" · "))}</p>
            </div>
          ` : ""}
          ${assignment.rationale ? `
            <div>
              <span>Translator note</span>
              <p>${escapeHtml(assignment.rationale)}</p>
            </div>
          ` : ""}
        </div>
      </article>
    `).join("");

    const pendingCards = plan.variants
      .filter((variant) => variant.pendingGeneration)
      .map((variant) => `
        <article class="klaviyo-variant-card">
          <div class="klaviyo-variant-head">
            <div>
              <p class="section-label">${escapeHtml(variant.rolloutLabel)}</p>
              <h4>${escapeHtml(variant.label)} · ${escapeHtml(variant.code)}</h4>
            </div>
            <span class="decision-chip">${escapeHtml(`${variant.targetCount} accounts`)}</span>
          </div>
          <div class="klaviyo-variant-preview-shell">
            <div class="klaviyo-variant-preview-empty">
              <strong>Generate preview</strong>
              <span>This language row will render here after translation runs.</span>
            </div>
          </div>
          <div class="klaviyo-variant-copy">
            <div>
              <span>Translation path</span>
              <strong>${escapeHtml(variant.translationPath)}</strong>
            </div>
            <div>
              <span>Body validation</span>
              <p>Waiting for translation preview.</p>
            </div>
          </div>
        </article>
      `).join("");

    variantList.innerHTML = assignmentCards || pendingCards
      ? `${assignmentCards}${pendingCards}`
      : `
        <article class="klaviyo-variant-card">
          <div class="klaviyo-variant-preview-empty">
            <strong>No previews yet</strong>
            <span>Choose targets and generate drafts to render country-specific previews here.</span>
          </div>
        </article>
      `;
  }

  if (rolloutSummary) {
    rolloutSummary.innerHTML = `
      <article class="klaviyo-summary-note">
        <span>Source</span>
        <strong>${escapeHtml(plan.sourceTemplate.account)} · ${escapeHtml(plan.sourceTemplate.name)}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Targets</span>
        <strong>${escapeHtml(plan.targets.length ? plan.targets.join(", ") : "No targets selected")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Drafts</span>
        <strong>${escapeHtml(formatKlaviyoNumber(plan.draftCount, 0))}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Preview</span>
        <strong>${escapeHtml(plan.generatedAt ? `Preview generated ${formatKlaviyoDate(plan.generatedAt)}` : "Configure source and generate preview")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Source HTML</span>
        <strong>${escapeHtml(sourceTemplateReady ? "Loaded" : "Missing")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Source hero</span>
        <strong>${escapeHtml(plan.sourceHeroImageUrl ? "Detected and previewed below" : "Not found in source HTML")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>Hero overrides</span>
        <strong>${escapeHtml(plan.heroOverrideCount ? `${plan.heroOverrideCount} target drafts will swap the hero image` : "No localized hero images configured")}</strong>
      </article>
      <article class="klaviyo-summary-note">
        <span>URL check</span>
        <strong>${escapeHtml(plan.urlValidationWarnings.length ? `${plan.urlValidationWarnings.length} issues found` : "All strict Westpack URL checks passed")}</strong>
      </article>
      ${blockingIssue ? `
        <article class="klaviyo-summary-note">
          <span>Blocked</span>
          <strong>${escapeHtml(blockingIssue)}</strong>
        </article>
      ` : ""}
      ${plan.missingAssignments.length ? `
        <article class="klaviyo-summary-note">
          <span>Skipped</span>
          <strong>${escapeHtml(plan.missingAssignments.map((item) => item.account).join(", "))}</strong>
        </article>
      ` : ""}
    `;

    rolloutSummary.insertAdjacentHTML("beforeend", buildKlaviyoHeroInspectorHtml(plan));
  }

  if (guardrails) {
    guardrails.innerHTML = klaviyoTranslationGuardrails.map((item) => `
      <article class="prompt-item">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </article>
    `).join("");
  }

  if (status) {
    status.classList.remove("online", "warning");
    if (appState.klaviyoTemplateLoading) {
      status.textContent = `Fetching live templates from ${appState.klaviyoTemplateSourceAccount}...`;
      status.classList.add("warning");
    } else if (blockingIssue) {
      status.textContent = `Draft generation blocked. ${blockingIssue}`;
      status.classList.add("warning");
    } else if (appState.klaviyoTemplatePushing) {
      status.textContent = "Pushing translated draft templates to Klaviyo accounts...";
      status.classList.add("warning");
    } else if (appState.klaviyoTemplateGenerating) {
      status.textContent = "Generating target versions directly from the selected source template...";
      status.classList.add("warning");
    } else if (appState.klaviyoTemplatePushError) {
      status.textContent = `Draft push failed. ${appState.klaviyoTemplatePushError}`;
      status.classList.add("warning");
    } else if (appState.klaviyoTemplatePushResult?.results?.length) {
      const okCount = appState.klaviyoTemplatePushResult.results.filter((item) => item.ok).length;
      const failCount = appState.klaviyoTemplatePushResult.results.length - okCount;
      status.textContent = failCount
        ? `Draft push finished · ${okCount} created, ${failCount} failed`
        : `Draft push finished · ${okCount} templates created`;
      status.classList.add(failCount ? "warning" : "online");
    } else if (appState.klaviyoTemplateTranslationError) {
      status.textContent = `Translation preview failed. ${appState.klaviyoTemplateTranslationError}`;
      status.classList.add("warning");
    } else if (appState.klaviyoTemplateError) {
      status.textContent = `Using fallback template catalog. ${appState.klaviyoTemplateError}`;
      status.classList.add("warning");
    } else if (appState.klaviyoTemplateLiveAttempted && !appState.klaviyoTemplateCatalogLive.length) {
      const sourceLabel = appState.klaviyoTemplateCatalogSource || "none";
      status.textContent = `No live templates found for ${appState.klaviyoTemplateSourceAccount} via ${sourceLabel}.`;
      status.classList.add("warning");
    } else if (plan.generatedAt) {
      status.textContent = plan.urlValidationWarnings.length
        ? `Preview blocked by ${plan.urlValidationWarnings.length} Westpack URL issues`
        : plan.missingAssignments.length
        ? `Rollout preview ready · ${plan.assignments.length} mapped drafts, ${plan.missingAssignments.length} targets skipped`
        : `Rollout preview ready · ${plan.assignments.length} mapped drafts across ${plan.targets.length} accounts`;
      status.classList.add(plan.urlValidationWarnings.length ? "warning" : "online");
    } else if (appState.klaviyoTemplateCatalogLive.length) {
      const sourceLabel = appState.klaviyoTemplateCatalogSource || "live";
      status.textContent = `${appState.klaviyoTemplateCatalogCount || appState.klaviyoTemplateCatalogLive.length} templates loaded for ${appState.klaviyoTemplateSourceAccount} via ${sourceLabel}`;
      status.classList.add("online");
    } else {
      status.textContent = "Ready to choose source and targets";
    }
  }

  if (actionFeedback) {
    actionFeedback.className = "inline-feedback";
    if (appState.klaviyoTemplatePushing) {
      actionFeedback.textContent = "Pushing drafts to Klaviyo. This can take a few seconds.";
      actionFeedback.classList.add("loading");
    } else if (appState.klaviyoTemplateGenerating) {
      actionFeedback.textContent = "Generating drafts from the source template now.";
      actionFeedback.classList.add("loading");
    } else if (appState.klaviyoTemplatePushError) {
      actionFeedback.textContent = appState.klaviyoTemplatePushError;
      actionFeedback.classList.add("error");
    } else if (appState.klaviyoTemplateTranslationError) {
      actionFeedback.textContent = appState.klaviyoTemplateTranslationError;
      actionFeedback.classList.add("error");
    } else if (appState.klaviyoTemplatePushResult?.results?.length) {
      const okCount = appState.klaviyoTemplatePushResult.results.filter((item) => item.ok).length;
      const failCount = appState.klaviyoTemplatePushResult.results.length - okCount;
      actionFeedback.textContent = failCount
        ? `${okCount} draft(s) created, ${failCount} failed.`
        : `${okCount} draft(s) created in Klaviyo.`;
      actionFeedback.classList.add(failCount ? "error" : "success");
    } else {
      actionFeedback.textContent = "";
    }
  }

  if (pushButton) {
    const canAttemptPush = plan.targets.length > 0 && sourceTemplateReady;
    pushButton.disabled = !canAttemptPush || plan.urlValidationWarnings.length > 0 || appState.klaviyoTemplateGenerating || appState.klaviyoTemplatePushing || Boolean(blockingIssue);
    pushButton.textContent = plan.generatedAt ? "Push drafts to Klaviyo" : "Generate + push to Klaviyo";
    pushButton.classList.toggle("is-loading", appState.klaviyoTemplatePushing);
    pushButton.setAttribute("aria-busy", appState.klaviyoTemplatePushing ? "true" : "false");
  }

  if (generateButton) {
    generateButton.disabled = appState.klaviyoTemplateLoading || !plan.sourceTemplate?.name || !sourceTemplateReady;
    generateButton.classList.toggle("is-loading", appState.klaviyoTemplateGenerating);
    generateButton.setAttribute("aria-busy", appState.klaviyoTemplateGenerating ? "true" : "false");
    generateButton.textContent = appState.klaviyoTemplateGenerating ? "Generating drafts..." : "Generate drafts";
  }

  if (refreshTemplatesButton) {
    refreshTemplatesButton.disabled = appState.klaviyoTemplateLoading;
    refreshTemplatesButton.classList.toggle("is-loading", appState.klaviyoTemplateLoading);
    refreshTemplatesButton.setAttribute("aria-busy", appState.klaviyoTemplateLoading ? "true" : "false");
    refreshTemplatesButton.textContent = appState.klaviyoTemplateLoading ? "Fetching templates..." : "Refresh templates";
  }
}

export function attachKlaviyoTemplateEventsModule({
  appState,
  getKlaviyoSourceTemplates,
  resetKlaviyoGeneratedPlan,
  resetKlaviyoHeroImageOverrides,
  resetKlaviyoCampaignVariantState,
  renderKlaviyoWorkspace,
  loadKlaviyoTemplateCatalog,
  loadKlaviyoTemplateDetail,
  generateKlaviyoRolloutPreview,
  generateKlaviyoCampaignVariantPreview,
  pushKlaviyoRolloutDrafts,
  duplicateKlaviyoCampaignWithAiVariant,
  formatKlaviyoDate,
  markAttached,
  isAttached
}) {
  if (isAttached()) return;
  markAttached();

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "klaviyo-template-source-account" && target instanceof HTMLSelectElement) {
      appState.klaviyoTemplateSourceAccount = target.value || "DK";
      resetKlaviyoGeneratedPlan();
      resetKlaviyoHeroImageOverrides();
      appState.klaviyoTemplateLiveAttempted = "";
      appState.klaviyoTemplateLiveAccount = "";
      appState.klaviyoTemplateCatalogLive = [];
      appState.klaviyoTemplateSourceDetail = null;
      appState.klaviyoTemplateCatalogSource = "";
      appState.klaviyoTemplateCatalogCount = 0;
      const nextTemplate = getKlaviyoSourceTemplates(appState.klaviyoTemplateSourceAccount)[0];
      appState.klaviyoTemplateSourceTemplate = nextTemplate?.id || "";
      renderKlaviyoWorkspace();
      loadKlaviyoTemplateCatalog({ force: true });
      return;
    }

    if (target.id === "klaviyo-template-source-template" && target instanceof HTMLSelectElement) {
      appState.klaviyoTemplateSourceTemplate = target.value || "";
      resetKlaviyoGeneratedPlan();
      resetKlaviyoHeroImageOverrides();
      renderKlaviyoWorkspace();
      loadKlaviyoTemplateDetail(appState.klaviyoTemplateSourceTemplate);
      return;
    }

    if (target instanceof HTMLInputElement && target.type === "checkbox" && target.closest("#klaviyo-target-grid")) {
      const value = target.value;
      const selected = new Set(appState.klaviyoTemplateTargets || []);
      if (target.checked) {
        selected.add(value);
      } else {
        selected.delete(value);
      }
      appState.klaviyoTemplateTargets = [...selected];
      resetKlaviyoGeneratedPlan();
      renderKlaviyoWorkspace();
      return;
    }

    if (target.id === "klaviyo-campaign-source-account" && target instanceof HTMLSelectElement) {
      appState.klaviyoTemplateSourceAccount = target.value || "DK";
      appState.klaviyoTemplateLiveAttempted = "";
      appState.klaviyoTemplateLiveAccount = "";
      appState.klaviyoTemplateCatalogLive = [];
      appState.klaviyoTemplateSourceDetail = null;
      appState.klaviyoTemplateCatalogSource = "";
      appState.klaviyoTemplateCatalogCount = 0;
      const nextTemplate = getKlaviyoSourceTemplates(appState.klaviyoTemplateSourceAccount)[0];
      appState.klaviyoTemplateSourceTemplate = nextTemplate?.id || "";
      resetKlaviyoCampaignVariantState();
      renderKlaviyoWorkspace();
      loadKlaviyoTemplateCatalog({ force: true });
      return;
    }

    if (target.id === "klaviyo-campaign-source-select" && target instanceof HTMLSelectElement) {
      appState.klaviyoTemplateSourceTemplate = target.value || "";
      appState.klaviyoTemplateSourceDetail = null;
      resetKlaviyoCampaignVariantState();
      renderKlaviyoWorkspace();
      loadKlaviyoTemplateDetail(appState.klaviyoTemplateSourceTemplate);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "klaviyo-template-brief" && target instanceof HTMLTextAreaElement) {
      appState.klaviyoTemplateBrief = target.value || "";
      resetKlaviyoGeneratedPlan();
      renderKlaviyoWorkspace();
    }
    if (target.id === "klaviyo-campaign-brief" && target instanceof HTMLTextAreaElement) {
      appState.klaviyoCampaignBrief = target.value || "";
      resetKlaviyoCampaignVariantState();
      renderKlaviyoWorkspace();
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;

    if (button.id === "klaviyo-refresh-templates-button") {
      event.preventDefault();
      await loadKlaviyoTemplateCatalog({ force: true });
      renderKlaviyoWorkspace();
      return;
    }

    if (button.id === "klaviyo-generate-rollout-button") {
      event.preventDefault();
      await generateKlaviyoRolloutPreview();
      return;
    }

    if (button.id === "klaviyo-refresh-campaigns-button") {
      event.preventDefault();
      await loadKlaviyoTemplateCatalog({ force: true });
      renderKlaviyoWorkspace();
      return;
    }

    if (button.id === "klaviyo-generate-campaign-variant-button") {
      event.preventDefault();
      await generateKlaviyoCampaignVariantPreview();
      return;
    }

    if (button.id === "klaviyo-save-rollout-button") {
      event.preventDefault();
      appState.klaviyoTemplatePlanSavedAt = new Date().toISOString();
      appState.klaviyoTemplatePlanGeneratedAt = appState.klaviyoTemplatePlanGeneratedAt || appState.klaviyoTemplatePlanSavedAt;
      const status = document.getElementById("klaviyo-template-status");
      if (status) {
        status.textContent = `Rollout plan saved ${formatKlaviyoDate(appState.klaviyoTemplatePlanSavedAt)}`;
      }
      return;
    }

    if (button.id === "klaviyo-push-rollout-button") {
      event.preventDefault();
      await pushKlaviyoRolloutDrafts();
      return;
    }

    if (button.id === "klaviyo-duplicate-campaign-button") {
      event.preventDefault();
      await duplicateKlaviyoCampaignWithAiVariant();
    }
  });
}
