import {
  adaptationGoals,
  ads,
  adSets,
  auditLog,
  campaignMatches,
  campaigns,
  integrationConfig,
  klaviyoCampaignGroups,
  klaviyoMarkets,
  loadAiPreviewSnapshot,
  loadLiveKlaviyoSnapshot,
  loadLiveMetaSnapshot,
  previewTemplate,
  promptRecipe,
  stats
} from "./src/data.js?v=20260421-metavideofix1";
import {
  buildStudioCatalogSnapshot,
  readMetaSnapshotCache,
  readMetaStudioSnapshot,
  writeMetaSnapshotCache,
  writeMetaStudioSnapshot
} from "./src/meta-snapshot-cache.js?v=20260507-meta-snapshotcache1";
import {
  buildWindowChange as buildMetricWindowChange,
  computeAggregateMetric,
  getWindowChangeSummary,
  splitAggregateSeries
} from "./src/meta-dashboard-metrics.js?v=20260507-meta-dashboardmetrics1";
import {
  duplicateKlaviyoCampaignWithAiVariantAction,
  generateKlaviyoCampaignVariantPreviewAction,
  renderKlaviyoCampaignAiPanel
} from "./src/klaviyo-campaign-ai.js?v=20260715-klaviyocampaignai1";
import {
  createKlaviyoTemplateDomain
} from "./src/klaviyo-template-domain.js?v=20260715-klaviyotemplatedomain1";
import {
  createKlaviyoDashboardDomain
} from "./src/klaviyo-dashboard-domain.js?v=20260715-klaviyodashboarddomain1";
import {
  createMetaMasterArtifactDraft,
  createMetaMasterCardDrafts,
  createMetaMasterCarouselAssets
} from "./src/campaign-meta-master.js?v=20260720-metamaster1";
import {
  renderMetaCarouselCards
} from "./src/meta-carousel-renderer.js?v=20260722-designcontinuity1";
import {
  buildCampaignMetaTargetModel,
  selectCampaignMetaTarget
} from "./src/campaign-meta-target.js?v=20260720-metatarget1";
import {
  attachKlaviyoTemplateEventsModule,
  ensureKlaviyoTemplateSourceReadyAction,
  generateKlaviyoRolloutPreviewAction,
  loadKlaviyoTemplateCatalogAction,
  loadKlaviyoTemplateDetailAction,
  pushKlaviyoRolloutDraftsAction,
  renderKlaviyoDuplicateTranslatePanel
} from "./src/klaviyo-template-rollout.js?v=20260715-klaviyotemplaterollout1";
import {
  analyzeCreateVideoAction,
  attachCreateStudioEventsModule,
  canAdvanceCreateStepAction,
  captureVideoThumbnailAction,
  collectCreateImageUploadSizeIssuesAction,
  getCreateCarouselOrderStateAction,
  getCreateImageUploadSizeMessageAction,
  getCreateUploadPreviewUrlAction,
  readBlobAsBase64Action,
  readFileAsBase64Action,
  renderCreateUploadPreviewAction,
  resetVideoAnalysisStateAction,
  setCreateStepAction,
  syncCreateFormatClassesAction,
  syncCreateImageUploadValidationAction
} from "./src/meta-create-studio.js?v=20260715-metacreatestudio1";
import {
  attachDuplicateStudioEventsModule
} from "./src/meta-duplicate-studio.js?v=20260715-metaduplicatestudio1";
import {
  buildDuplicateWorkflowSummaryModelAction,
  clearDuplicateBatchPreviewsAction,
  clearDuplicateCreativeOverrideCarouselFilesAction,
  cloneDuplicateTargetAction,
  ensureDuplicateTargetPersistedAction,
  focusDuplicateTargetEditorAction,
  getActiveDuplicateCreativeEditorTargetAction,
  getDuplicateBatchEntryAction,
  getDuplicateCreativeOverrideAction,
  getDuplicateGeneratedPreviewCountAction,
  getDuplicateOverrideStatusAction,
  getDuplicatePublishTargetsAction,
  getDuplicateTargetByKeyAction,
  getDuplicateTargetKeyAction,
  normalizeDuplicateCreativeOverrideAction,
  removeDuplicateCreativeOverrideFileAction,
  renderDuplicateWorkflowSummaryAction,
  setDuplicateReviewOpenAction,
  syncDuplicateCreativeEditorKeyAction,
  upsertDuplicateBatchEntryAction,
  upsertDuplicateCreativeOverrideAction,
  hasPersistedDuplicateTargetAction
} from "./src/meta-duplicate-domain.js?v=20260715-metaduplicatedomain1";
import {
  getOrderedDuplicateCarouselFilesAction,
  renderDuplicateBulkTargetsAction,
  renderDuplicateCreativeOverridePanelAction
} from "./src/meta-duplicate-render.js?v=20260715-metaduplicaterender1";
import {
  addCurrentDuplicateTargetAction,
  getDuplicatePrimaryTargetAction,
  removeDuplicateBulkTargetAction,
  sanitizeDuplicateBulkTargetsAction,
  setDuplicateActivePreviewAction,
  syncDuplicateSourceSelectorsAction,
  syncDuplicateTargetBuilderStateAction,
  syncDuplicateTargetLanguageFieldsAction
} from "./src/meta-duplicate-management.js?v=20260715-metaduplicatemanagement1";
import {
  generateAiPreviewAction,
  pushToMetaAction
} from "./src/meta-preview-publish.js?v=20260715-metapreviewpublish1";
import {
  applyMetaStudioCatalogAction,
  renderCoreDataAction
} from "./src/meta-catalog-sync.js?v=20260715-metacatalogsync1";
import {
  clearValidationAction,
  getInputValueAction,
  getModeIdsAction,
  getSelectedLabelAction,
  isModePreviewReadyAction,
  markInvalidAction,
  setButtonBusyAction,
  syncActionAvailabilityAction,
  validateBeforePushAction
} from "./src/meta-studio-controls.js?v=20260715-metastudiocontrols1";
import {
  buildGenerationRequest,
  buildMetaPublishPayload,
  buildPreviewPayload,
  buildVariantSet,
  createDraftEntry,
  getAdSetOptions,
  getIntegrationCards,
  getMetaSettingsSummary,
  getPromptCards,
  requestAiPreview,
  requestAuthLogin,
  requestAuthLogout,
  requestCampaignAssembly,
  requestAuthSession,
  requestCampaignAsanaTask,
  requestCampaignAsanaTasks,
  requestContentAgentStart,
  requestContentAgentControl,
  requestContentAgentStatus,
  requestContentAgentRetry,
  requestContentAgentRejectRestart,
  requestCampaignLearningFeedback,
  requestCampaignLearningModeration,
  requestCampaignArtifacts,
  requestCampaignCarouselSuggestions,
  requestCampaignBrain,
  requestCampaignEnvironmentSeries,
  requestCampaignEmailCompile,
  requestCampaignEmailAssetHosting,
  requestCampaignEmailModuleRevision,
  requestCampaignEmailVisuals,
  requestMetaFromMaster,
  requestMetaCreativeReview,
  requestDashboardAgent,
  requestKlaviyoAgent,
  requestKlaviyoCampaignOverview,
  requestKlaviyoCreateTemplateVariant,
  requestKlaviyoPushTemplateRollout,
  requestKlaviyoTemplateVariant,
  requestKlaviyoTemplateTranslation,
  requestKlaviyoTemplates,
  requestMetaConnectionStatus,
  requestMetaHistoricalIntelligence,
  requestMetaStudioCatalog,
  requestVideoAnalysis,
  requestMetaPublish,
  requestMetaSnapshot
} from "./src/services.js?v=20260722-learningstudio1";

const CAMPAIGN_EMAIL_MODULES = [
  ["editorial_text", "Editorial text"], ["image_full", "Full-width image"],
  ["image_left", "Image left"], ["image_right", "Image right"],
  ["statement", "Editorial statement"], ["steps", "Process / guide"],
  ["benefit_grid", "Benefit grid"], ["testimonial", "Testimonial"],
  ["product_spotlight", "Product spotlight"], ["offer_panel", "Offer panel"]
];
const CAMPAIGN_EMAIL_UPLOAD_MAX_BYTES = 3_000_000;
import {
  renderAdSetSelector,
  renderAuditLog,
  renderCampaignMatches,
  renderCampaignTable,
  renderCardList,
  renderIntegrations,
  renderPayload,
  renderPreview,
  setPreviewLoading,
  renderSelectors,
  renderSettings,
  renderStats,
  renderVariants,
  renderDecisionBoard,
  renderCampaignPulse,
  renderExecutiveBrief,
  renderPressureGrid,
  renderMetaBudgetVisualization,
  renderMetaQualityPanel,
  renderOverviewGrid,
  renderOverviewSpendSplit,
  renderTrendDeck,
  renderHeroPanel,
  renderDashboardAgentList,
  setDashboardAgentStatus,
  setDashboardHero,
  setStudioMode,
  setStudioStatus,
  switchTab,
  toggleSettings
} from "./src/ui.js?v=20260427-meta-studiocleanup1";

const klaviyoTemplateCatalog = [
  {
    id: "spring-drop-2026",
    account: "DK",
    name: "Spring Drop 2026",
    familyKey: "spring-drop-2026",
    subject: "Explore premium packaging for the new season",
    previewText: "Launch a cleaner spring story with premium packaging and stronger presentation.",
    body: "Highlight premium materials, elevate perceived value, and keep the CTA structure simple for specialist buyers."
  },
  {
    id: "jewellery-care-guide",
    account: "DE",
    name: "Jewellery Care Guide",
    familyKey: "jewellery-care-guide",
    subject: "Help customers protect jewellery presentation",
    previewText: "Education-led template for retail buyers who need both packaging and care guidance.",
    body: "Lead with expertise, keep the hero educational, and let the CTA point toward the care and packaging range."
  },
  {
    id: "gift-bags-cross-sell",
    account: "SE",
    name: "Gift Bags Cross-sell",
    familyKey: "gift-bags-cross-sell",
    subject: "Add premium gift bags to every jewellery sale",
    previewText: "Cross-sell structure built to lift basket size without losing premium tone.",
    body: "Keep the hierarchy compact, push presentation value first, and use a clear secondary CTA for related bag sizes."
  }
];

const klaviyoLanguageCatalog = [
  { code: "da-DK", label: "Dansk (DK)", note: "Master version written first. Source of truth." },
  { code: "en-GB", label: "English (UK)", note: "First translation layer created from Danish. Reference for all other languages." },
  { code: "en-EU", label: "English (EU)", note: "English rollout for EU accounts that keep English copy." },
  { code: "en-US", label: "English (US)", note: "English rollout adapted for US account language handling." },
  { code: "fr-FR", label: "Fransk (FR)", note: "Translated from UK without local content variation." },
  { code: "de-DE", label: "Tysk (DE)", note: "Translated from UK while keeping exactly the same campaign structure." },
  { code: "pl-PL", label: "Polsk (PL)", note: "Translated from UK with the same structure and CTA logic." },
  { code: "sv-SE", label: "Svensk (SE)", note: "Translated from UK with the same content and hierarchy." },
  { code: "nb-NO", label: "Norsk (NO)", note: "Translated from UK with the same content and hierarchy." },
  { code: "nl-NL", label: "Hollandsk (NL)", note: "Translated from UK with the same structure and premium tone." },
  { code: "it-IT", label: "Italiensk (IT)", note: "Translated from UK without changing hierarchy or CTA logic." },
  { code: "es-ES", label: "Spansk (ES)", note: "Translated from UK while preserving structure and product logic." },
  { code: "fi-FI", label: "Finsk (FI)", note: "Translated from UK without local content variation." },
  { code: "pt-PT", label: "Portugisisk (PT)", note: "Translated from UK with the same structure and commercial intent." },
  { code: "ro-RO", label: "Rumænsk (RO)", note: "Translated from UK without changing content hierarchy." },
  { code: "hu-HU", label: "Ungarsk (HU)", note: "Translated from UK while protecting Klaviyo syntax and CTA logic." },
  { code: "cs-CZ", label: "Tjekkisk (CZ)", note: "Translated from UK with the same structure and message order." },
  { code: "sk-SK", label: "Slovakisk (SK)", note: "Translated from UK with the same commercial structure." }
];

const klaviyoAccountLanguageMap = {
  DK: "da-DK",
  UK: "en-GB",
  EU: "en-EU",
  US: "en-US",
  FR: "fr-FR",
  DE: "de-DE",
  PL: "pl-PL",
  SE: "sv-SE",
  NO: "nb-NO",
  NL: "nl-NL",
  IT: "it-IT",
  ES: "es-ES",
  FI: "fi-FI",
  PT: "pt-PT",
  RO: "ro-RO",
  HU: "hu-HU",
  CZ: "cs-CZ",
  SK: "sk-SK"
};

const klaviyoUrlSnippetCatalog = {
  CZ: "eur_eu_cze",
  DE: "eur_eu_ger",
  DK: "dkk_dk_den",
  ES: "eur_eu_spa",
  EU: "eur_eu_eng",
  FI: "eur_eu_fin",
  FR: "eur_eu_fra",
  HU: "eur_eu_hun",
  IT: "eur_eu_ita",
  NL: "eur_eu_ned",
  NO: "nor_no_den",
  PL: "pln_pl_pol",
  PT: "eur_eu_por",
  RO: "eur_eu_rou",
  SE: "sek_se_swe",
  SK: "eur_eu_svk",
  UK: "gbp_uk_eng",
  US: "usd_us_eng"
};

const klaviyoTranslationGuardrails = [
  {
    title: "Protect Klaviyo syntax",
    body: "Keep merge tags, unsubscribe links, tracked URLs and dynamic blocks untouched during translation."
  },
  {
    title: "Translate the sales layer",
    body: "Translate subject, preview text, CTA labels and human-readable HTML copy, but never rewrite structure, data bindings or campaign logic."
  },
  {
    title: "No market variation",
    body: "Every market receives the same campaign structure. Only the language changes, with glossary terms enforced automatically."
  }
];

const appState = {
  ads,
  adSets,
  campaigns,
  workspace: "meta",
  stats,
  mode: "duplicate",
  dashboardLens: "general",
  createStep: 1,
  duplicateStep: 1,
  duplicateBulkTargets: [],
  duplicateBatchPreviews: [],
  duplicateActivePreviewKey: "",
  duplicateCreativeOverrides: {},
  duplicateCreativeEditorKey: "",
  duplicateReviewOpen: false,
  currentPreview: null,
  currentVariants: [],
  currentVariantIndex: 0,
  currentVideoAnalysis: null,
  lastGeneratedSignature: "",
  dashboardAgentItems: [],
  dashboardAgentLastLens: "",
  dashboardIncrementalityFactor: 0.6,
  dashboardDatePreset: "last_7d",
  dashboardDateFrom: "",
  dashboardDateTo: "",
  dashboardDateLabel: "Last 7 days",
  dashboardDateShortLabel: "Last 7 days",
  dashboardDateDays: 7,
  dashboardAutoRefresh: "off",
  metaDataMode: "live",
  klaviyoDataSource: "mock",
  klaviyoGeneratedAt: "",
  klaviyoRangeDays: 30,
  klaviyoSearch: "",
  klaviyoOnlyFullMarkets: false,
  klaviyoSort: "last_sent",
  klaviyoCampaignGroups: klaviyoCampaignGroups,
  klaviyoFlowSearch: "",
  klaviyoFlowOnlyFullMarkets: false,
  klaviyoFlowSort: "last_sent",
  klaviyoFlowCategory: "operator",
  klaviyoFlowStage: "all",
  klaviyoFlowGroups: [],
  klaviyoCampaignFocus: "",
  klaviyoFlowFocus: "",
  klaviyoFlowSnapshots: [],
  ignoredFlowSuggestionKeys: [],
  klaviyoMarkets: klaviyoMarkets,
  klaviyoSubscribers: {
    total: 0,
    markets: [],
    timeline: null,
    snapshots: null,
    countSource: "",
    historySource: "",
    historyGeneratedAt: ""
  },
  klaviyoSubscriberMarket: "total",
  klaviyoSubscriberMode: "net",
  klaviyoSubscriberRange: 30,
  klaviyoView: "dashboard",
  klaviyoDashboardTab: "general",
  klaviyoLoading: false,
  klaviyoLiveAttempted: false,
  klaviyoError: "",
  klaviyoAiLoading: false,
  klaviyoAiSummary: null,
  klaviyoAiDecisionBoard: [],
  klaviyoAiCampaignDiagnoses: [],
  klaviyoAiFlowDiagnoses: [],
  klaviyoAiMarketDiagnoses: [],
  klaviyoAiGeneratedAt: "",
  klaviyoAiError: "",
  klaviyoAiSignature: "",
  klaviyoTemplateSourceAccount: "DK",
  klaviyoTemplateSourceTemplate: "spring-drop-2026",
  klaviyoTemplateBrief: "Keep CTA structure compact, preserve dynamic Klaviyo tags, and localize for premium B2B buyers.",
  klaviyoTemplateTargets: ["DK", "SE", "DE", "FR", "UK"],
  klaviyoTemplatePlanGeneratedAt: "",
  klaviyoTemplatePlanSavedAt: "",
  klaviyoTemplateCatalogLive: [],
  klaviyoTemplateSourceDetail: null,
  klaviyoTemplateLoading: false,
  klaviyoTemplateError: "",
  klaviyoTemplateLiveAttempted: "",
  klaviyoTemplateLiveAccount: "",
  klaviyoTemplateCatalogSource: "",
  klaviyoTemplateCatalogCount: 0,
  klaviyoTemplateGenerating: false,
  klaviyoTemplateGeneratedVariants: [],
  klaviyoTemplateGeneratedFrom: "",
  klaviyoTemplateTranslationError: "",
  klaviyoTemplateHeroImageOverrides: {},
  klaviyoTemplateHeroImageErrors: {},
  klaviyoTemplatePushing: false,
  klaviyoTemplatePushError: "",
  klaviyoTemplatePushResult: null,
  klaviyoCampaignBrief: "Lav en alternativ version, der tydeligt hænger sammen med originalen, men føles som en naturlig opfølgning med ny vinkel og skarpere grund til at handle nu.",
  klaviyoCampaignVariantLoading: false,
  klaviyoCampaignVariantError: "",
  klaviyoCampaignVariant: null,
  klaviyoCampaignVariantGeneratedAt: "",
  klaviyoCampaignCreating: false,
  klaviyoCampaignCreateError: "",
  klaviyoCampaignCreateResult: null,
  campaignBrainLoading: false,
  campaignBrainError: "",
  campaignAssemblyLoading: false,
  campaignAssemblyError: "",
  campaignAssemblyObject: null,
  campaignAssemblyGeneratedAt: "",
  campaignStudioMode: "asana_combo",
  campaignManualWorkspaceOpen: false,
  campaignMetaMaster: {
    sourceType: "klaviyo",
    account: "DK",
    templateId: "",
    templates: [],
    templateDetail: null,
    html: "",
    direction: "",
    loading: false,
    generating: false,
    rendering: false,
    renderError: "",
    renderedAt: "",
    selectedRouteId: "",
    qualityReview: null,
    qualityHistory: [],
    qualityReviewing: false,
    qualityError: "",
    error: "",
    result: null
  },
  campaignStudioActiveView: "meta",
  campaignStudioReviewJob: null,
  campaignStudioReviewOpen: false,
  campaignStudioSourceAssets: {
    loading: false,
    error: "",
    items: []
  },
  campaignAsanaLoading: false,
  campaignAsanaError: "",
  campaignAsanaCampaignTasks: [],
  campaignAsanaContentTasks: [],
  campaignAsanaSelectedCampaignGid: "",
  campaignAsanaSelectedContentGid: "",
  campaignAsanaLoaded: false,
  campaignAsanaImporting: false,
  contentAgent: {
    loading: false,
    running: false,
    loaded: false,
    error: "",
    notice: "",
    direction: "",
    directorOpen: false,
    directorInteractionActive: false,
    directorRenderPending: false,
    rejectConfirmJobId: "",
    rejectingJobId: "",
    controllingJobId: "",
    learningOpen: false,
    learningBusyId: "",
    learningDeleteConfirmId: "",
    state: null,
    store: null,
    policy: null,
    learning: null
  },
  campaignBrainResult: null,
  campaignBrainGeneratedAt: "",
  campaignArtifactsLoading: false,
  campaignArtifactsError: "",
  campaignArtifactsResult: null,
  campaignArtifactsGeneratedAt: "",
  campaignArtifactDraft: null,
  campaignEmailBuilder: {
    selectedIndex: 0,
    previewMode: "desktop",
    inspectorTab: "content",
    zoom: 100,
    draggingIndex: -1,
    draggingModuleId: "",
    draggingAssetUrl: "",
    draggingAssetAlt: "",
    draggingAssetSourceUrl: "",
    draggingAssetHosted: false,
    selectionKind: "module",
    assetHosting: false,
    saveState: "saved",
    saveMessage: "Saved locally",
    restoringView: false,
    aiLoading: false,
    aiError: "",
    aiSuggestion: null,
    history: [],
    future: [],
    lastHistoryKey: "",
    lastHistoryAt: 0
  },
  campaignBrainKlaviyoAccount: "DK",
  campaignBrainKlaviyoPushing: false,
  campaignBrainKlaviyoPushError: "",
  campaignBrainKlaviyoPushResult: null,
  campaignBrainMetaConfig: {
    targetCampaignName: "",
    targetCampaignId: "",
    targetAdSetName: "",
    targetAdSetId: "",
    targetLanguage: "",
    destinationUrl: "https://www.westpack.com/",
    adFormat: ""
  },
  campaignBrainMetaAssets: {
    carouselSquareFiles: [],
    carouselCardDrafts: [],
    carouselWarnings: [],
    draggingCardIndex: -1
  },
  campaignBrainMetaValidating: false,
  campaignBrainMetaValidationError: "",
  campaignBrainMetaValidationResult: null,
  campaignBrainMetaPushing: false,
  campaignBrainMetaPushError: "",
  campaignBrainMetaPushResult: null,
  campaignBrainMetaSuggesting: false,
  campaignBrainMetaSuggestError: "",
  campaignBrainMetaSuggestResult: null,
  campaignBrainMetaBuilding: false,
  campaignBrainMetaBuildPhase: "",
  campaignBrainMetaCatalogLoading: false,
  campaignBrainMetaCatalogError: "",
  metaHistoricalIntelligence: {
    loading: false,
    loaded: false,
    error: "",
    snapshot: null
  },
  campaignBrainEnvironmentConfig: {
    preset: "scandi_luxe",
    selectedFormats: ["square", "portrait"],
    quality: "medium",
    customDirection: ""
  },
  campaignBrainEnvironmentAssets: {
    sourceFiles: [],
    sourceInsights: [],
    selectedSourceIndexes: [],
    approvedReference: null
  },
  campaignBrainAssetLibrary: {
    items: [],
    allItems: [],
    hydrated: false,
    error: "",
    scope: "campaign",
    search: "",
    assetType: "all",
    channelTag: "all",
    pickerTarget: ""
  },
  campaignBrainEnvironmentLoading: false,
  campaignBrainEnvironmentError: "",
  campaignBrainEnvironmentResult: null,
  campaignBrainEmailVisualsLoading: false,
  campaignBrainEmailVisualsError: "",
  campaignBrainEmailVisualsResult: null,
  metaConnection: {
    status: "unknown",
    detail: "Meta status not checked yet."
  },
  metaSnapshotMeta: null,
  metaStudioCatalogGeneratedAt: "",
  metaDashboard: null,
  metaCurrency: "EUR",
  metaQuality: null,
  metaUploadedImageHashes: {},
  metaUploadedVideoVariants: {},
  metaVideoThumbnailCache: {}
};

function getDuplicateTargetKey(target = {}) {
  return getDuplicateTargetKeyAction(target);
}

function cloneDuplicateTarget(target = {}) {
  return cloneDuplicateTargetAction(target);
}

function normalizeDuplicateCreativeOverride(override = {}) {
  return normalizeDuplicateCreativeOverrideAction(override);
}

function getDuplicateCreativeOverride(key = "") {
  return getDuplicateCreativeOverrideAction({ appState, key });
}

function getDuplicateTargetLanguageFieldIds() {
  return ["dup-bulk-target-language"];
}

function syncDuplicateTargetLanguageFields(nextValue = "", sourceId = "") {
  syncDuplicateTargetLanguageFieldsAction(nextValue, sourceId);
}

function upsertDuplicateCreativeOverride(key = "", nextOverride = {}) {
  upsertDuplicateCreativeOverrideAction({
    appState,
    getDuplicateCreativeOverride,
    key,
    nextOverride
  });
}

function removeDuplicateCreativeOverrideFile(key = "", variantKey = "") {
  removeDuplicateCreativeOverrideFileAction({
    getDuplicateCreativeOverride,
    key,
    upsertDuplicateCreativeOverride,
    variantKey
  });
}

function clearDuplicateCreativeOverrideCarouselFiles(key = "") {
  clearDuplicateCreativeOverrideCarouselFilesAction({
    key,
    upsertDuplicateCreativeOverride
  });
}

function getDuplicateTargetByKey(key = "") {
  return getDuplicateTargetByKeyAction({ getDuplicatePublishTargets, getDuplicateTargetKey, key });
}

function syncDuplicateCreativeEditorKey() {
  return syncDuplicateCreativeEditorKeyAction({
    appState,
    getDuplicatePrimaryTarget,
    getDuplicatePublishTargets,
    getDuplicateTargetKey
  });
}

function getActiveDuplicateCreativeEditorTarget() {
  return getActiveDuplicateCreativeEditorTargetAction({
    getDuplicateTargetByKey,
    syncDuplicateCreativeEditorKey
  });
}

function focusDuplicateTargetEditor(target = null) {
  return focusDuplicateTargetEditorAction({
    appState,
    cloneDuplicateTarget,
    getDuplicatePrimaryTarget,
    getDuplicateTargetKey,
    renderCurrentPreviewPayload,
    renderDuplicateBulkTargets,
    renderDuplicateCreativeOverridePanel,
    setDuplicateActivePreview,
    syncActionAvailability,
    syncDuplicateTargetBuilderState,
    syncDuplicateTargetLanguageFields,
    target
  });
}

function setDuplicateReviewOpen(isOpen) {
  setDuplicateReviewOpenAction({ appState, isOpen, syncStudioChrome });
}

function getDuplicateBatchEntry(key = "") {
  return getDuplicateBatchEntryAction({ appState, key });
}

function upsertDuplicateBatchEntry(nextEntry) {
  upsertDuplicateBatchEntryAction({ appState, nextEntry });
}

function clearDuplicateBatchPreviews() {
  clearDuplicateBatchPreviewsAction({ appState });
}

function getDuplicateGeneratedPreviewCount() {
  return getDuplicateGeneratedPreviewCountAction({ appState });
}

function hasPersistedDuplicateTarget(key = "") {
  return hasPersistedDuplicateTargetAction({ appState, getDuplicateTargetKey, key });
}

function syncDuplicateTargetBuilderState() {
  syncDuplicateTargetBuilderStateAction({
    appState,
    getDuplicatePrimaryTarget,
    getDuplicatePublishTargets,
    getDuplicateTargetKey,
    hasPersistedDuplicateTarget
  });
}

function ensureDuplicateTargetPersisted(target = null) {
  return ensureDuplicateTargetPersistedAction({
    appState,
    cloneDuplicateTarget,
    getDuplicatePrimaryTarget,
    getDuplicateTargetKey,
    hasPersistedDuplicateTarget,
    target
  });
}

const authState = {
  bootstrapped: false,
  enabled: false,
  authenticated: false
};

let dashboardAutoRefreshTimer = null;
let dashboardAutoRefreshDailyTimer = null;
let contentAgentPollTimer = null;
let dashboardRefreshPromise = null;
let authEventsAttached = false;
let klaviyoTemplateEventsAttached = false;
const META_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const META_STUDIO_CATALOG_COOLDOWN_MS = 10 * 60 * 1000;
const META_BROWSER_DAILY_REFRESH_TIMEZONE = "Europe/Copenhagen";
const META_BROWSER_DAILY_REFRESH_SLOTS = [
  { hour: 7, minute: 45 },
  { hour: 13, minute: 0 }
];
let metaLastSuccessfulRefreshAt = 0;
let metaStudioCatalogPromise = null;

function isMetaRateLimitMessage(message = "") {
  const text = String(message || "").toLowerCase();
  return text.includes("request limit reached")
    || text.includes("too many calls")
    || text.includes("rate limit")
    || text.includes("application request limit reached");
}

function setMetaSnapshotMeta(meta = null) {
  appState.metaSnapshotMeta = meta
    ? {
      mode: meta.mode || "",
      modeLabel: meta.modeLabel || "",
      source: meta.source || "",
      sourceLabel: meta.sourceLabel || "",
      generatedAt: meta.generatedAt || "",
      cachedAt: meta.cachedAt || ""
    }
    : null;
}

function getAuthElements() {
  return {
    form: document.getElementById("auth-form"),
    wall: document.getElementById("auth-wall"),
    password: document.getElementById("auth-password"),
    status: document.getElementById("auth-status"),
    submit: document.getElementById("auth-submit"),
    logout: document.getElementById("auth-logout-button")
  };
}

function setAuthStatus(message = "", tone = "neutral") {
  const { status } = getAuthElements();
  if (!status) return;

  status.textContent = message;
  status.className = "auth-wall-status";
  if (tone && tone !== "neutral") {
    status.classList.add(tone);
  }
}

function setAuthLocked(locked) {
  document.body.classList.toggle("auth-locked", locked);
  const { wall } = getAuthElements();
  if (wall) {
    wall.setAttribute("aria-hidden", locked ? "false" : "true");
  }
}

function setAuthBusy(isBusy) {
  const { submit, password } = getAuthElements();
  if (submit) {
    submit.disabled = isBusy;
    submit.textContent = isBusy ? "Logger ind..." : "Log ind";
  }
  if (password) {
    password.disabled = isBusy;
  }
}

function syncAuthUi() {
  const { logout, password } = getAuthElements();
  const shouldLock = authState.enabled && !authState.authenticated;

  setAuthLocked(shouldLock);

  if (logout) {
    logout.hidden = !authState.enabled || !authState.authenticated;
  }

  if (shouldLock && password) {
    queueMicrotask(() => password.focus());
  }
}

function startApp() {
  if (authState.bootstrapped) return;
  attachEvents();
  try {
    initializeApp();
  } catch (error) {
    console.error("[app-start]", error);
    setSyncStatus("Dashboard failed to initialize fully. Safe mode enabled.", "warning");
  }
  authState.bootstrapped = true;
}

function handleAuthRequired(message = "Din session er udløbet. Log ind igen.") {
  authState.authenticated = false;
  setAuthStatus(message, "warning");
  syncAuthUi();
}

async function bootstrapAuth() {
  try {
    const session = await requestAuthSession();
    authState.enabled = Boolean(session.passwordEnabled);
    authState.authenticated = !authState.enabled || Boolean(session.authenticated);
  } catch (error) {
    authState.enabled = true;
    authState.authenticated = false;
    setAuthStatus("Kunne ikke tjekke login-status.", "warning");
  }

  syncAuthUi();

  if (authState.authenticated) {
    startApp();
  }
}

async function submitAuthForm(event) {
  event.preventDefault();

  const { password } = getAuthElements();
  const nextPassword = password?.value || "";

  if (!nextPassword.trim()) {
    setAuthStatus("Skriv kodeordet for at fortsætte.", "warning");
    password?.focus();
    return;
  }

  setAuthBusy(true);
  setAuthStatus("Tjekker adgang...", "loading");

  try {
    const session = await requestAuthLogin(nextPassword);
    authState.enabled = Boolean(session.passwordEnabled);
    authState.authenticated = true;
    if (password) {
      password.value = "";
    }
    setAuthStatus("");
    syncAuthUi();
    startApp();
  } catch (error) {
    authState.enabled = true;
    authState.authenticated = false;
    setAuthStatus(error.message || "Login mislykkedes.", "warning");
    syncAuthUi();
  } finally {
    setAuthBusy(false);
  }
}

async function logoutAuth() {
  const { password } = getAuthElements();

  try {
    await requestAuthLogout();
  } catch (error) {
    setAuthStatus(error.message || "Kunne ikke logge ud.", "warning");
  }

  authState.authenticated = false;
  if (password) {
    password.value = "";
  }
  setAuthStatus("Du er logget ud.", "success");
  syncAuthUi();
}

function attachAuthEvents() {
  if (authEventsAttached) return;
  authEventsAttached = true;

  const { form, logout } = getAuthElements();
  form?.addEventListener("submit", submitAuthForm);
  logout?.addEventListener("click", logoutAuth);
  window.addEventListener("westpack-auth-required", () => {
    handleAuthRequired();
  });
}

const createQuickActions = [
  {
    title: "Use uploaded files as-is",
    body: "The images or videos you upload stay unchanged. AI only helps with copy."
  },
  {
    title: "Build one clear angle",
    body: "Keep the concept tight: one market, one format, one message direction."
  },
  {
    title: "Preview before publish",
    body: "Generate the ad preview first, then push only when the creative and copy match."
  }
];

const duplicateQuickActions = [
  {
    title: "Use the source ad as anchor",
    body: "Pick the exact source first, then keep campaign, ad set and format locked before generating."
  },
  {
    title: "Regenerate after every structural change",
    body: "If you change campaign, ad set, language or format, generate a new preview before publishing."
  },
  {
    title: "Publish into paused review",
    body: "New duplicated ads are pushed as paused so you can review them safely in Meta first."
  }
];

async function generateKlaviyoCampaignVariantPreview() {
  return generateKlaviyoCampaignVariantPreviewAction({
    appState,
    ensureKlaviyoTemplateSourceReady,
    renderKlaviyoWorkspace,
    requestKlaviyoTemplateVariant
  });
}

async function duplicateKlaviyoCampaignWithAiVariant() {
  return duplicateKlaviyoCampaignWithAiVariantAction({
    appState,
    getSelectedKlaviyoTemplate,
    renderKlaviyoWorkspace,
    requestKlaviyoCreateTemplateVariant
  });
}

async function generateKlaviyoRolloutPreview() {
  return generateKlaviyoRolloutPreviewAction({
    appState,
    ensureKlaviyoTemplateSourceReady,
    getKlaviyoMappedLanguageCode,
    getKlaviyoLanguageByCode,
    getKlaviyoTemplateAccounts,
    hasRenderableKlaviyoBody,
    requestKlaviyoTemplateTranslation,
    renderKlaviyoWorkspace
  });
}

async function pushKlaviyoRolloutDrafts() {
  return pushKlaviyoRolloutDraftsAction({
    appState,
    ensureKlaviyoTemplateSourceReady,
    buildKlaviyoTemplatePlan,
    hasRenderableKlaviyoBody,
    generateKlaviyoRolloutPreview,
    requestKlaviyoPushTemplateRollout,
    renderKlaviyoWorkspace
  });
}

async function loadKlaviyoTemplateCatalog(options = {}) {
  return loadKlaviyoTemplateCatalogAction({
    appState,
    ensureKlaviyoTemplateSelections,
    requestKlaviyoTemplates,
    loadKlaviyoTemplateDetail,
    renderKlaviyoWorkspace,
    options
  });
}

async function loadKlaviyoTemplateDetail(templateId = appState.klaviyoTemplateSourceTemplate) {
  return loadKlaviyoTemplateDetailAction({
    appState,
    ensureKlaviyoTemplateSelections,
    requestKlaviyoTemplates,
    renderKlaviyoWorkspace,
    templateId
  });
}

async function ensureKlaviyoTemplateSourceReady() {
  return ensureKlaviyoTemplateSourceReadyAction({
    appState,
    ensureKlaviyoTemplateSelections,
    hasSelectedKlaviyoTemplateDetail,
    loadKlaviyoTemplateDetail,
    getSelectedKlaviyoTemplate,
    hasRenderableKlaviyoBody
  });
}

function renderKlaviyoDuplicateTranslate() {
  renderKlaviyoDuplicateTranslatePanel({
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
  });
}

function renderKlaviyoCampaignAi() {
  renderKlaviyoCampaignAiPanel({
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
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const {
  applyKlaviyoHeroImageOverride,
  buildKlaviyoChangePreviewMarkup,
  buildKlaviyoHeroInspectorHtml,
  buildKlaviyoPreviewHtml,
  buildKlaviyoTemplatePlan,
  ensureKlaviyoTemplateSelections,
  extractKlaviyoHeroImageUrl,
  getKlaviyoHeroImageOverride,
  getKlaviyoHeroImageOverrideState,
  getKlaviyoLanguageByCode,
  getKlaviyoMappedLanguageCode,
  getKlaviyoSourceTemplates,
  getKlaviyoTargetSnippet,
  getKlaviyoTemplateAccounts,
  getSelectedKlaviyoTemplate,
  hasRenderableKlaviyoBody,
  hasSelectedKlaviyoTemplateDetail,
  localizeKlaviyoText,
  normalizeKlaviyoHeroImageOverride,
  normalizeKlaviyoHeroImageUrl,
  readFileAsDataUrl,
  resetKlaviyoCampaignVariantState,
  resetKlaviyoGeneratedPlan,
  resetKlaviyoHeroImageOverrides,
  summarizeKlaviyoBody,
  truncateKlaviyoPreviewText
} = createKlaviyoTemplateDomain({
  appState,
  klaviyoMarkets,
  klaviyoLanguageCatalog,
  klaviyoTemplateCatalog,
  klaviyoAccountLanguageMap,
  klaviyoUrlSnippetCatalog,
  escapeHtml
});
const {
  buildKlaviyoCampaignGroups,
  buildKlaviyoFlowGroups,
  buildKlaviyoGroups,
  formatKlaviyoCurrency,
  formatKlaviyoDate,
  formatKlaviyoNumber,
  formatKlaviyoPercent,
  getFilteredKlaviyoFlowGroups,
  getFilteredKlaviyoGroups,
  getKlaviyoCountryCurrency,
  getKlaviyoCoverageExemptNote,
  getKlaviyoCoverageExpectedCount,
  getKlaviyoCoverageExpectedMarkets,
  getKlaviyoDashboardTabConfig,
  getKlaviyoEffectiveMissingMarkets,
  getKlaviyoRateToDkk,
  getKlaviyoRevenueLabel,
  hasKlaviyoSnapshotData,
  hasLiveKlaviyoFlowData,
  isKlaviyoCoverageExemptMarket,
  normalizeKlaviyoCurrencyCode,
  normalizeKlaviyoMarketCode,
  normalizeKlaviyoRevenueGroups,
  normalizeKlaviyoRevenueMarket,
  syncKlaviyoDashboardSectionCopy,
  syncKlaviyoDashboardSubtabs,
  syncKlaviyoFlowControls,
  syncKlaviyoNavigation
} = createKlaviyoDashboardDomain({
  appState,
  klaviyoMarkets,
  classifyFlowGroup,
  buildFlowHealth,
  isCampaignLikeFlowName,
  buildFlowUnderstanding
});


function renderKlaviyoDiagnosticsPanel(groups, flowGroups) {
  const node = document.getElementById("klaviyo-diagnostics-panel");
  if (!node) return;

  const sourceLabel = getKlaviyoSourceLabel();
  const warning = String(appState.klaviyoError || "").trim();
  const subscribers = appState.klaviyoSubscribers || {};
  const subscriberCountState = subscribers.countSource === "live"
    ? "Live counts"
    : subscribers.countSource === "mixed_live_snapshot_fallback"
      ? "Mixed count fallback"
      : subscribers.countSource === "partial_missing_list"
        ? "Missing list mapping"
        : appState.klaviyoDataSource === "snapshot"
          ? "Snapshot counts"
          : "Unknown";
  const subscriberHistoryState = subscribers.historySource === "snapshot_history"
    ? `Snapshot history${subscribers.historyGeneratedAt ? ` · ${formatKlaviyoDate(subscribers.historyGeneratedAt)}` : ""}`
    : subscribers.historySource === "unavailable"
      ? "No history source"
      : appState.klaviyoDataSource === "snapshot"
        ? "Snapshot history"
        : "Unknown";
  const aiState = appState.klaviyoAiLoading
    ? "Refreshing AI"
    : appState.klaviyoAiError
      ? "AI fallback"
      : appState.klaviyoAiGeneratedAt
        ? `Ready · ${formatKlaviyoDate(appState.klaviyoAiGeneratedAt)}`
        : "Not generated";

  const cards = [
    {
      label: "Data source",
      value: sourceLabel,
      meta: warning ? "Refresh warnings are active." : "Source and freshness of the current view."
    },
    {
      label: "Scope",
      value: `${appState.klaviyoRangeDays || 30} days`,
      meta: `${formatKlaviyoNumber(groups.length, 0)} campaigns · ${formatKlaviyoNumber(flowGroups.length, 0)} flows`
    },
    {
      label: "Subscriber counts",
      value: subscriberCountState,
      meta: "Live list sizes are preferred. Fallback only appears when live counting fails."
    },
    {
      label: "Subscriber history",
      value: subscriberHistoryState,
      meta: "Trend charts can still come from stored history even when counts are live."
    }
  ];

  cards.push({
    label: "AI layer",
    value: aiState,
    meta: appState.klaviyoAiError ? compactText(appState.klaviyoAiError, 80) : "AI brief and diagnosis state."
  });

  node.innerHTML = `
    <div class="klaviyo-diagnostics-grid">
      ${cards.map((card) => `
        <article class="klaviyo-diagnostic-card">
          <span class="section-label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <p>${escapeHtml(card.meta)}</p>
        </article>
      `).join("")}
    </div>
    ${warning ? `<div class="publish-status" data-tone="warning">${escapeHtml(warning)}</div>` : ""}
  `;
}

function compactText(value, max = 88) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function getKlaviyoHealthTone({ warnings = 0, issues = 0, quiet = 0 } = {}) {
  if (issues > 0) return "danger";
  if (warnings > 0 || quiet > 0) return "warning";
  return "success";
}

function buildKlaviyoCommandCenter(groups, flowGroups) {
  const metrics = buildKlaviyoOverviewMetrics(groups);
  const permission = buildPermissionMetrics("total", appState.klaviyoSubscriberRange || 30);
  const flowMetrics = buildKlaviyoOverviewMetrics(flowGroups);
  const operatorRead = buildKlaviyoOperatorRead(groups);
  const flowAttention = buildFlowAttentionItems(flowGroups);
  const topCampaign = metrics.topCampaign || null;
  const topFlow = flowGroups.slice().sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))[0] || null;
  const weakCampaign = groups.slice().sort((a, b) => (a.openRateWeighted || 0) - (b.openRateWeighted || 0))[0] || null;
  const widestCampaign = groups.slice().sort((a, b) => (b.activeMarkets || 0) - (a.activeMarkets || 0))[0] || null;
  const totalMarkets = Math.max(1, getTotalKlaviyoMarkets());
  const fullCoverageCount = groups.filter((group) => getKlaviyoEffectiveMissingMarkets(group).length === 0).length;
  const coverageRate = groups.length ? (fullCoverageCount / groups.length) * 100 : 0;
  const atRiskFlows = flowGroups.filter((group) => (group.flowHealth?.label || "") === "At risk");
  const watchFlows = flowGroups.filter((group) => (group.flowHealth?.label || "") === "Watch");
  const silentFlows = flowGroups.filter((group) => (group.sentTotal || 0) === 0);
  const tone = getKlaviyoHealthTone({
    warnings: watchFlows.length + (appState.klaviyoError ? 1 : 0),
    issues: atRiskFlows.length,
    quiet: silentFlows.length
  });
  const sourceLabel = getKlaviyoSourceLabel();
  const sourceDescriptor = appState.klaviyoDataSource === "live"
    ? "Live data"
    : appState.klaviyoDataSource === "snapshot"
      ? "Snapshot fallback"
      : "Mock data";
  const statusLabel = tone === "danger"
    ? "Action needed"
    : tone === "warning"
      ? "Watch closely"
      : "Healthy";
  const keyMove = flowAttention[0]?.body || operatorRead[0]?.body || "No urgent operator move is standing out in the current range.";
  const heroTitle = tone === "danger"
    ? "Protect the weak spots before the next send."
    : tone === "warning"
      ? "Performance is usable, but a few signals need a sharp operator pass."
      : "Campaigns, permission and flows are moving in the right direction.";
  const heroMeta = [
    `${sourceDescriptor} · ${sourceLabel}`,
    groups.length ? `${formatKlaviyoNumber(groups.length, 0)} campaign families` : "No campaign families in range",
    hasLiveKlaviyoFlowData() ? `${formatKlaviyoNumber(flowGroups.length, 0)} live flow families` : "Flow live view warming up"
  ].join(" · ");
  const sideCards = [
    {
      eyebrow: "Best revenue",
      value: topCampaign?.campaignName || "--",
      meta: topCampaign
        ? `${formatKlaviyoCurrency(topCampaign.revenueTotal)} · ${formatKlaviyoNumber(topCampaign.activeMarkets || 0, 0)}/${formatKlaviyoNumber(totalMarkets, 0)} markets`
        : "No campaign revenue signal yet.",
      tone: "success"
    },
    {
      eyebrow: "Coverage pressure",
      value: `${formatKlaviyoPercent(coverageRate, 0)}`,
      meta: widestCampaign
        ? `${formatKlaviyoNumber(fullCoverageCount, 0)} full-market sends. Widest rollout: ${widestCampaign.campaignName}. ${getKlaviyoCoverageExemptNote()}.`
        : "Coverage signal appears when campaigns are present.",
      tone: coverageRate >= 70 ? "success" : coverageRate >= 40 ? "warning" : "danger"
    },
    {
      eyebrow: "Permission pulse",
      value: permission.netGrowth >= 0 ? `+${formatKlaviyoNumber(permission.netGrowth, 0)}` : formatKlaviyoNumber(permission.netGrowth, 0),
      meta: `${formatKlaviyoNumber(permission.subsAdded, 0)} joined · ${formatKlaviyoNumber(permission.unsubsTotal, 0)} unsubscribed in the last ${appState.klaviyoSubscriberRange || 30} days.`,
      tone: permission.netGrowth >= 0 ? "success" : "danger"
    },
    {
      eyebrow: "Flow engine",
      value: topFlow?.campaignName || "--",
      meta: topFlow
        ? `${formatKlaviyoCurrency(flowMetrics.revenueTotal)} total flow revenue. ${atRiskFlows.length + watchFlows.length} flow${atRiskFlows.length + watchFlows.length === 1 ? "" : "s"} need watching.`
        : "Flow detail becomes stronger once live flow data is available.",
      tone: atRiskFlows.length ? "danger" : watchFlows.length || silentFlows.length ? "warning" : "success"
    }
  ];

  return {
    tone,
    statusLabel,
    heroTitle,
    heroMeta,
    keyMove,
    sourceLabel,
    sourceDescriptor,
    weakCampaign,
    topFlow,
    flowAttention,
    sideCards
  };
}

function buildKlaviyoPriorityFeed(groups, flowGroups) {
  const operatorItems = buildKlaviyoOperatorRead(groups).map((item) => ({
    tone: item.title === "High" ? "danger" : item.title === "Medium" ? "warning" : "neutral",
    label: item.title === "High" ? "Immediate" : item.title === "Medium" ? "Watch" : "Note",
    body: item.body
  }));
  const flowItems = buildFlowAttentionItems(flowGroups).map((item) => ({
    tone: /protect|live but silent|coverage gap|historical/i.test(item.title) ? "warning" : "neutral",
    label: "Automation",
    body: item.body
  }));

  return [...operatorItems, ...flowItems].slice(0, 4);
}

function buildCampaignOperatorSignal(group) {
  const markets = Array.isArray(group?.markets) ? group.markets : [];
  const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
  const topRevenueMarket = markets.slice().sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0] || null;
  const weakestOpenMarket = markets.slice().sort((a, b) => (a.openRate || 0) - (b.openRate || 0))[0] || null;
  const riskTone = missingMarkets.length >= 4 || (group.unsubRateWeighted || 0) >= 0.45
    ? "danger"
    : missingMarkets.length > 0 || (group.openRateWeighted || 0) < 52
      ? "warning"
      : "success";
  const riskLabel = riskTone === "danger" ? "High risk" : riskTone === "warning" ? "Watch" : "Stable";
  const primaryAction = missingMarkets.length >= 4
    ? `Resolve coverage in ${missingMarkets.slice(0, 4).join(", ")}`
    : weakestOpenMarket
      ? `Review subject line and send timing in ${weakestOpenMarket.country}`
      : "Reuse the strongest winning setup";

  return {
    riskTone,
    riskLabel,
    topRevenueMarket,
    weakestOpenMarket,
    primaryAction
  };
}

function buildFlowOperatorSignal(group) {
  const actionRail = buildFlowActionRail(group);
  const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
  const riskTone = (group.flowHealth?.label || "") === "At risk"
    ? "danger"
    : (group.flowHealth?.label || "") === "Watch" || missingMarkets.length > 0
      ? "warning"
      : "success";
  const riskLabel = riskTone === "danger" ? "High risk" : riskTone === "warning" ? "Watch" : "Stable";

  return {
    riskTone,
    riskLabel,
    actionRail
  };
}

function buildKlaviyoExecutiveBullets(groups, flowGroups) {
  const metrics = buildKlaviyoOverviewMetrics(groups);
  const permission = buildPermissionMetrics("total", appState.klaviyoSubscriberRange || 30);
  const topCampaign = metrics.topCampaign;
  const weakestCampaign = groups.slice().sort((a, b) => (a.openRateWeighted || 0) - (b.openRateWeighted || 0))[0];
  const topFlow = flowGroups.slice().sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))[0];
  const bullets = [];

  if (topCampaign) bullets.push(`Top revenue family is ${topCampaign.campaignName} at ${formatKlaviyoCurrency(topCampaign.revenueTotal)}.`);
  if (weakestCampaign) bullets.push(`Weakest campaign engagement is ${weakestCampaign.campaignName} at ${formatKlaviyoPercent(weakestCampaign.openRateWeighted)} open.`);
  if (topFlow) bullets.push(`Leading automation flow is ${topFlow.campaignName} with ${formatKlaviyoCurrency(topFlow.revenueTotal)} in attributed revenue.`);
  bullets.push(`Net list growth is ${permission.netGrowth >= 0 ? `+${formatKlaviyoNumber(permission.netGrowth, 0)}` : formatKlaviyoNumber(permission.netGrowth, 0)} over the last ${appState.klaviyoSubscriberRange || 30} days.`);

  return bullets.slice(0, 3);
}

function buildKlaviyoAiCampaignBenchmarks(groups, subscribers) {
  const revenuePerRecipientSeries = groups
    .map((group) => ((group.sentTotal || 0) > 0 ? (group.revenueTotal || 0) / group.sentTotal : 0))
    .filter((value) => value > 0);
  const openRates = groups.map((group) => Number(group.openRateWeighted || 0)).filter((value) => value > 0);
  const clickRates = groups.map((group) => Number(group.clickRateWeighted || 0)).filter((value) => value > 0);
  const unsubRates = groups.map((group) => Number(group.unsubRateWeighted || 0)).filter((value) => value >= 0);
  const topRevenue = groups.slice().sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))[0] || null;
  const weakestOpen = groups.slice().sort((a, b) => (a.openRateWeighted || 0) - (b.openRateWeighted || 0))[0] || null;
  const highestUnsub = groups.slice().sort((a, b) => (b.unsubRateWeighted || 0) - (a.unsubRateWeighted || 0))[0] || null;
  const biggestCoverageGap = groups.slice().sort((a, b) => getKlaviyoEffectiveMissingMarkets(b).length - getKlaviyoEffectiveMissingMarkets(a).length)[0] || null;
  const subscriberMap = new Map((subscribers || []).map((item) => [item.country, Number(item.count || 0)]));
  const largeListMissingSend = groups
    .flatMap((group) => getKlaviyoEffectiveMissingMarkets(group).map((country) => ({
      country,
      campaignName: group.campaignName,
      subscribers: subscriberMap.get(country) || 0
    })))
    .sort((a, b) => b.subscribers - a.subscribers)[0] || null;

  return {
    averageOpenRate: Number((openRates.reduce((sum, value) => sum + value, 0) / Math.max(openRates.length, 1)).toFixed(2)),
    medianOpenRate: Number(getMedianNumber(openRates).toFixed(2)),
    averageClickRate: Number((clickRates.reduce((sum, value) => sum + value, 0) / Math.max(clickRates.length, 1)).toFixed(2)),
    averageUnsubRate: Number((unsubRates.reduce((sum, value) => sum + value, 0) / Math.max(unsubRates.length, 1)).toFixed(2)),
    medianRevenuePerRecipient: Number(getMedianNumber(revenuePerRecipientSeries).toFixed(2)),
    topRevenueCampaign: topRevenue ? {
      campaignName: topRevenue.campaignName,
      revenue: Number(topRevenue.revenueTotal || 0),
      openRate: Number(topRevenue.openRateWeighted || 0)
    } : null,
    weakestOpenCampaign: weakestOpen ? {
      campaignName: weakestOpen.campaignName,
      openRate: Number(weakestOpen.openRateWeighted || 0),
      revenue: Number(weakestOpen.revenueTotal || 0)
    } : null,
    highestUnsubCampaign: highestUnsub ? {
      campaignName: highestUnsub.campaignName,
      unsubRate: Number(highestUnsub.unsubRateWeighted || 0)
    } : null,
    biggestCoverageGap: biggestCoverageGap ? {
      campaignName: biggestCoverageGap.campaignName,
      missingMarkets: getKlaviyoEffectiveMissingMarkets(biggestCoverageGap)
    } : null,
    largeListMissingSend
  };
}

function buildKlaviyoAiFlowBenchmarks(flowGroups) {
  const healthScores = flowGroups.map((group) => Number(group.flowHealth?.score || 0)).filter((value) => value > 0);
  const openRates = flowGroups.map((group) => Number(group.openRateWeighted || 0)).filter((value) => value > 0);
  const topRevenueFlow = flowGroups.slice().sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))[0] || null;
  const weakestHealthFlow = flowGroups.slice().sort((a, b) => (a.flowHealth?.score || 0) - (b.flowHealth?.score || 0))[0] || null;
  const silentFlow = flowGroups.slice().filter((group) => (group.sentTotal || 0) === 0).sort((a, b) => (b.activeMarkets || 0) - (a.activeMarkets || 0))[0] || null;

  return {
    averageHealthScore: Number((healthScores.reduce((sum, value) => sum + value, 0) / Math.max(healthScores.length, 1)).toFixed(2)),
    medianHealthScore: Number(getMedianNumber(healthScores).toFixed(2)),
    averageOpenRate: Number((openRates.reduce((sum, value) => sum + value, 0) / Math.max(openRates.length, 1)).toFixed(2)),
    topRevenueFlow: topRevenueFlow ? {
      flowName: topRevenueFlow.campaignName,
      revenue: Number(topRevenueFlow.revenueTotal || 0),
      healthScore: Number(topRevenueFlow.flowHealth?.score || 0)
    } : null,
    weakestHealthFlow: weakestHealthFlow ? {
      flowName: weakestHealthFlow.campaignName,
      healthScore: Number(weakestHealthFlow.flowHealth?.score || 0),
      healthLabel: weakestHealthFlow.flowHealth?.label || ""
    } : null,
    mostExposedSilentFlow: silentFlow ? {
      flowName: silentFlow.campaignName,
      activeMarkets: Number(silentFlow.activeMarkets || 0)
    } : null
  };
}

function buildKlaviyoAiPriorityEvidence(groups, flowGroups) {
  const priorities = buildKlaviyoPriorityFeed(groups, flowGroups).slice(0, 5);
  return priorities.map((item, index) => ({
    rank: index + 1,
    label: item.label || "",
    tone: item.tone || "neutral",
    body: item.body || ""
  }));
}

function buildKlaviyoAiPayload(groups, flowGroups) {
  const metrics = buildKlaviyoOverviewMetrics(groups);
  const permission = buildPermissionMetrics("total", appState.klaviyoSubscriberRange || 30);
  const subscribers = getKlaviyoSubscriberMarkets();
  const campaignBenchmarks = buildKlaviyoAiCampaignBenchmarks(groups, subscribers);
  const flowBenchmarks = buildKlaviyoAiFlowBenchmarks(flowGroups);
  const campaignSignals = groups.slice(0, 8).map((group) => {
    const signal = buildCampaignOperatorSignal(group);
    const revenuePerRecipient = (group.sentTotal || 0) > 0 ? (group.revenueTotal || 0) / group.sentTotal : 0;
    return {
      campaignName: group.campaignName,
      revenue: Number(group.revenueTotal || 0),
      sent: Number(group.sentTotal || 0),
      openRate: Number(group.openRateWeighted || 0),
      clickRate: Number(group.clickRateWeighted || 0),
      unsubRate: Number(group.unsubRateWeighted || 0),
      revenuePerRecipient: Number(revenuePerRecipient.toFixed(2)),
      activeMarkets: Number(group.activeMarkets || 0),
      missingMarkets: getKlaviyoEffectiveMissingMarkets(group),
      recommendedAction: signal.primaryAction,
      benchmarkDelta: {
        openRateVsAverage: Number(((group.openRateWeighted || 0) - (campaignBenchmarks.averageOpenRate || 0)).toFixed(2)),
        unsubRateVsAverage: Number(((group.unsubRateWeighted || 0) - (campaignBenchmarks.averageUnsubRate || 0)).toFixed(2)),
        revenuePerRecipientVsMedian: Number((revenuePerRecipient - (campaignBenchmarks.medianRevenuePerRecipient || 0)).toFixed(2))
      }
    };
  });
  const flowSignals = flowGroups.slice(0, 8).map((group) => ({
    flowName: group.campaignName,
    revenue: Number(group.revenueTotal || 0),
    sent: Number(group.sentTotal || 0),
    healthLabel: group.flowHealth?.label || "",
    healthScore: Number(group.flowHealth?.score || 0),
    openRate: Number(group.openRateWeighted || 0),
    clickRate: Number(group.clickRateWeighted || 0),
    unsubRate: Number(group.unsubRateWeighted || 0),
    activeMarkets: Number(group.activeMarkets || 0),
    missingMarkets: getKlaviyoEffectiveMissingMarkets(group),
    benchmarkDelta: {
      healthVsAverage: Number(((group.flowHealth?.score || 0) - (flowBenchmarks.averageHealthScore || 0)).toFixed(2)),
      openRateVsAverage: Number(((group.openRateWeighted || 0) - (flowBenchmarks.averageOpenRate || 0)).toFixed(2))
    }
  }));

  return {
    generatedAt: appState.klaviyoGeneratedAt,
    source: appState.klaviyoDataSource,
    rangeDays: appState.klaviyoRangeDays,
    overview: {
      revenueTotal: Number(metrics.revenueTotal || 0),
      revenuePerRecipient: Number(metrics.revenuePerRecipient || 0),
      openRate: Number(metrics.averageOpen || 0),
      clickRate: Number(metrics.averageClick || 0),
      clickToOpenRate: Number(metrics.clickToOpenRate || 0),
      unsubRate: Number(metrics.averageUnsub || 0),
      sentTotal: Number(metrics.sentTotal || 0),
      netGrowth: Number(permission.netGrowth || 0),
      subsAdded: Number(permission.subsAdded || 0),
      unsubsTotal: Number(permission.unsubsTotal || 0)
    },
    topCampaigns: campaignSignals,
    topFlows: flowSignals,
    campaignBenchmarks,
    flowBenchmarks,
    priorities: buildKlaviyoPriorityFeed(groups, flowGroups),
    priorityEvidence: buildKlaviyoAiPriorityEvidence(groups, flowGroups),
    coverageRules: {
      expectedMarkets: getKlaviyoCoverageExpectedMarkets(),
      exemptMarkets: Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS),
      exemptReason: KLAVIYO_SMALL_LIST_EXEMPT_REASON
    },
    topSubscribers: subscribers.slice(0, 8).map((item) => ({
      country: item.country,
      count: Number(item.count || 0),
      listName: item.listName || ""
    })),
    marketPerformance: (appState.klaviyoMarkets || []).map((country) => {
      const subscriber = subscribers.find((item) => item.country === country);
      const latest = groups
        .flatMap((group) => (group.markets || []).map((market) => ({ ...market, campaignName: group.campaignName })))
        .filter((market) => market.country === country)
        .sort((a, b) => new Date(b.sendTime || 0) - new Date(a.sendTime || 0))[0];
      const localPermission = buildPermissionMetrics(country, appState.klaviyoSubscriberRange || 30);
      return {
        country,
        subscribers: Number(subscriber?.count || 0),
        latestCampaign: latest?.campaignName || "",
        openRate: Number(latest?.openRate || 0),
        clickRate: Number(latest?.clickRate || 0),
        unsubRate: Number(latest?.unsubRate || 0),
        revenue: Number(latest?.revenue || 0),
        netGrowth: Number(localPermission.netGrowth || 0)
      };
    })
  };
}

function getKlaviyoAiSignature(groups, flowGroups) {
  return JSON.stringify({
    generatedAt: appState.klaviyoGeneratedAt,
    source: appState.klaviyoDataSource,
    rangeDays: appState.klaviyoRangeDays,
    campaigns: groups.slice(0, 8).map((group) => [group.campaignName, group.revenueTotal, group.openRateWeighted, group.activeMarkets]),
    flows: flowGroups.slice(0, 8).map((group) => [group.campaignName, group.revenueTotal, group.flowHealth?.score, group.activeMarkets])
  });
}

function getKlaviyoAiCampaignDiagnosis(name = "") {
  return (appState.klaviyoAiCampaignDiagnoses || []).find((item) => item.campaignName === name) || null;
}

function getKlaviyoAiFlowDiagnosis(name = "") {
  return (appState.klaviyoAiFlowDiagnoses || []).find((item) => item.flowName === name) || null;
}

function getKlaviyoAiMarketDiagnosis(country = "") {
  return (appState.klaviyoAiMarketDiagnoses || []).find((item) => item.country === country) || null;
}

function clearKlaviyoAiState() {
  appState.klaviyoAiSummary = null;
  appState.klaviyoAiDecisionBoard = [];
  appState.klaviyoAiCampaignDiagnoses = [];
  appState.klaviyoAiFlowDiagnoses = [];
  appState.klaviyoAiMarketDiagnoses = [];
  appState.klaviyoAiGeneratedAt = "";
  appState.klaviyoAiSignature = "";
}

async function loadKlaviyoAiInsights(options = {}) {
  const groups = getFilteredKlaviyoGroups();
  const flowGroups = getFilteredKlaviyoFlowGroups();
  if (!groups.length) {
    clearKlaviyoAiState();
    appState.klaviyoAiError = "";
    renderKlaviyoWorkspace();
    return false;
  }

  const signature = getKlaviyoAiSignature(groups, flowGroups);
  if (appState.klaviyoAiLoading) return false;
  if (!options.force && signature === appState.klaviyoAiSignature) return true;

  appState.klaviyoAiLoading = true;
  appState.klaviyoAiError = "";
  renderKlaviyoWorkspace();

  try {
    const payload = buildKlaviyoAiPayload(groups, flowGroups);
    const result = await requestKlaviyoAgent(payload);
    appState.klaviyoAiSummary = result?.brief || null;
    appState.klaviyoAiDecisionBoard = Array.isArray(result?.decisionBoard) ? result.decisionBoard : [];
    appState.klaviyoAiCampaignDiagnoses = Array.isArray(result?.campaignDiagnoses) ? result.campaignDiagnoses : [];
    appState.klaviyoAiFlowDiagnoses = Array.isArray(result?.flowDiagnoses) ? result.flowDiagnoses : [];
    appState.klaviyoAiMarketDiagnoses = Array.isArray(result?.marketDiagnoses) ? result.marketDiagnoses : [];
    appState.klaviyoAiGeneratedAt = String(result?.generatedAt || new Date().toISOString());
    appState.klaviyoAiSignature = signature;
    return true;
  } catch (error) {
    appState.klaviyoAiError = error.message || "Klaviyo AI briefing failed.";
    return false;
  } finally {
    appState.klaviyoAiLoading = false;
    renderKlaviyoWorkspace();
  }
}

function renderKlaviyoCommandCenter(groups, flowGroups) {
  const heroNode = document.getElementById("klaviyo-command-hero");
  if (!heroNode) return;

  const command = buildKlaviyoCommandCenter(groups, flowGroups);
  const metrics = buildKlaviyoOverviewMetrics(groups);
  const permissionMetrics = buildPermissionMetrics("total", appState.klaviyoSubscriberRange || 30);
  const atRiskFlowCount = flowGroups.filter((group) => (group.flowHealth?.label || "") === "At risk").length;
  const watchFlowCount = flowGroups.filter((group) => (group.flowHealth?.label || "") === "Watch").length;
  const priorities = buildKlaviyoPriorityFeed(groups, flowGroups).slice(0, 2);
  const topRevenue = command.sideCards.find((card) => card.eyebrow === "Best revenue");
  const coverage = command.sideCards.find((card) => card.eyebrow === "Coverage pressure");
  const permission = command.sideCards.find((card) => card.eyebrow === "Permission pulse");
  const aiBrief = appState.klaviyoAiSummary;
  const aiDecisionBoard = Array.isArray(appState.klaviyoAiDecisionBoard) ? appState.klaviyoAiDecisionBoard : [];
  const bullets = (Array.isArray(aiBrief?.bullets) && aiBrief.bullets.length
    ? aiBrief.bullets
    : buildKlaviyoExecutiveBullets(groups, flowGroups)).slice(0, 2);
  const headline = aiBrief?.headline || (command.tone === "danger"
    ? "Action needed"
    : command.tone === "warning"
      ? "Needs a close read"
      : "Healthy period");
  const summary = aiBrief?.summary || (command.tone === "danger"
    ? "Fix weak spots."
    : command.tone === "warning"
      ? "Tighten weak spots."
      : "Signals are healthy.");
  const shortHeadline = compactText(headline, 88);
  const shortSummary = compactText(summary, 180);
  const heroMetaItems = String(command.heroMeta || "")
    .split(" · ")
    .map((item) => item.trim())
    .filter(Boolean);
  const scoreCards = [
    {
      label: getKlaviyoRevenueLabel(),
      value: formatKlaviyoCurrency(metrics.revenueTotal),
      meta: `${formatKlaviyoNumber(metrics.sentTotal, 0)} sends`
    },
    {
      label: "Open rate",
      value: formatKlaviyoPercent(metrics.averageOpen, 1),
      meta: `${formatKlaviyoPercent(metrics.clickToOpenRate, 1)} CTO`
    },
    {
      label: "List growth",
      value: permissionMetrics.netGrowth >= 0 ? `+${formatKlaviyoNumber(permissionMetrics.netGrowth, 0)}` : formatKlaviyoNumber(permissionMetrics.netGrowth, 0),
      meta: `${formatKlaviyoNumber(permissionMetrics.subsAdded, 0)} joined`
    },
    {
      label: "Flow issues",
      value: formatKlaviyoNumber(atRiskFlowCount + watchFlowCount, 0),
      meta: `${formatKlaviyoNumber(atRiskFlowCount, 0)} at risk`
    }
  ];
  const briefLines = bullets.length
    ? bullets.map((item) => compactText(item, 94)).slice(0, 2)
    : [];

  const decisionCards = aiDecisionBoard.length
    ? aiDecisionBoard.slice(0, 3).map((item) => ({
      eyebrow: item.label || "Act now",
      value: compactText(item.headline || "--", 52),
      meta: item.evidence || "",
      tone: item.tone || "neutral",
      action: item.action || ""
    }))
    : [
      {
        eyebrow: "Top campaign",
        value: compactText(topRevenue?.value || "--", 52),
        meta: topRevenue?.meta || "",
        tone: "success",
        action: ""
      },
      {
        eyebrow: "Coverage",
        value: compactText(coverage?.value || "--", 52),
        meta: coverage?.meta || "",
        tone: coverage?.tone || "neutral",
        action: ""
      },
      {
        eyebrow: "Audience growth",
        value: compactText(permission?.value || "--", 52),
        meta: permission?.meta || "",
        tone: permission?.tone || "neutral",
        action: ""
      }
    ];

  const priorityMarkup = priorities.length
    ? `
      <div class="klaviyo-command-priority-list">
        ${priorities.map((item) => `
          <article class="klaviyo-command-priority tone-${escapeHtml(item.tone || "neutral")}">
            <span class="section-label">${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(compactText(item.body, 88))}</strong>
          </article>
        `).join("")}
      </div>
    `
    : "";

  heroNode.innerHTML = `
    <div class="klaviyo-command-hero-main">
      <div class="klaviyo-command-hero-copy">
        <div class="klaviyo-command-status-row">
          <span class="section-label">AI morning briefing</span>
          <span class="klaviyo-command-badge tone-${escapeHtml(command.tone)}">${escapeHtml(command.statusLabel)}</span>
        </div>
        <div class="klaviyo-command-meta-row">
          ${heroMetaItems.map((item) => `<span class="klaviyo-command-meta-pill">${escapeHtml(item)}</span>`).join("")}
        </div>
        <h3>${escapeHtml(shortHeadline)}</h3>
        <p>${escapeHtml(shortSummary)}</p>
        <div class="klaviyo-command-scorecard">
          ${scoreCards.map((item) => `
            <article class="klaviyo-command-score">
              <span class="section-label">${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
              <p>${escapeHtml(item.meta)}</p>
            </article>
          `).join("")}
        </div>
        ${briefLines.length ? `
          <div class="klaviyo-command-bullets">
            ${briefLines.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        ` : ""}
      </div>
    </div>
    <div class="klaviyo-command-hero-side">
      <div class="klaviyo-command-spotlight tone-${escapeHtml(command.tone)}">
        <span class="section-label">Best next move</span>
        <strong>${escapeHtml(compactText(command.keyMove, 116))}</strong>
      </div>
      ${priorityMarkup}
      <div class="klaviyo-command-hero-grid">
        ${decisionCards.map((item) => `
          <article class="klaviyo-command-panel tone-${escapeHtml(item.tone || "neutral")}">
            <span class="section-label">${escapeHtml(item.eyebrow)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            ${item.meta ? `<p>${escapeHtml(compactText(item.meta, 62))}</p>` : ""}
          </article>
        `).join("")}
      </div>
    </div>
  `;

}

function buildKlaviyoOverviewMetrics(groups) {
  const sentTotal = groups.reduce((sum, group) => sum + group.sentTotal, 0);
  const revenueTotal = groups.reduce((sum, group) => sum + group.revenueTotal, 0);
  const averageOpen = sentTotal
    ? groups.reduce((sum, group) => sum + (group.openRateWeighted * group.sentTotal), 0) / sentTotal
    : 0;
  const averageClick = sentTotal
    ? groups.reduce((sum, group) => sum + (group.clickRateWeighted * group.sentTotal), 0) / sentTotal
    : 0;
  const averageUnsub = sentTotal
    ? groups.reduce((sum, group) => sum + (group.unsubRateWeighted * group.sentTotal), 0) / sentTotal
    : 0;
  const revenuePerRecipient = sentTotal ? revenueTotal / sentTotal : 0;
  const clickToOpenRate = averageOpen > 0 ? (averageClick / averageOpen) * 100 : 0;
  const topCampaign = [...groups].sort((a, b) => b.revenueTotal - a.revenueTotal)[0];

  return { sentTotal, revenueTotal, averageOpen, averageClick, averageUnsub, revenuePerRecipient, clickToOpenRate, topCampaign };
}

function getMedianNumber(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classifyFlowGroup(group) {
  const source = getFlowSourceText(group);

  if (/gdpr|suppress|auto-delete|auto-suppress|list cleaning|automation|permission =|profile property|xquality flow|customer tags|source_/.test(source)) {
    return "utility";
  }
  if (/transactional|order|receipt|informationer|opbevaring|tilfredshedsundersøgelse/.test(source)) {
    return "transactional";
  }
  if (/quiz|lead|meta quiz|signup|subscribe|newsletter|smykke.*quiz/.test(source)) {
    return "leadgen";
  }
  if (/welcome|winback|sunset|post purchase|review|upsell|cross|abandon|cart|browse|viewed product|opfyldning|sample follow-up|kampagneflow|^w\d{1,2}\b/.test(source)) {
    return "revenue";
  }
  if (/added to list|welcome/.test(source)) {
    return "lifecycle";
  }
  return "lifecycle";
}

function getFlowCategoryLabel(category) {
  return {
    operator: "Operator flows",
    all: "All flows",
    revenue: "Revenue",
    lifecycle: "Lifecycle",
    transactional: "Transactional",
    leadgen: "Lead gen",
    utility: "Utility"
  }[category] || "Flow";
}

function getFlowSourceText(group) {
  return [group?.campaignName, ...(group?.aliases || []), group?.triggerType]
    .join(" ")
    .toLowerCase();
}

function isCampaignLikeFlowName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return false;
  return /^w\d{1,2}\b/.test(normalized)
    || normalized.includes("kampagneflow")
    || normalized.includes("day of the forest")
    || normalized.includes("aprilsnar")
    || normalized.includes("alt til forsendelse")
    || normalized.includes("forårsprodukter");
}

function getTotalKlaviyoMarkets() {
  return getKlaviyoCoverageExpectedCount() || 0;
}

function getFlowReasonConfidence(source, matched = false) {
  if (matched && /welcome|browse|cart|checkout|abandon|review|winback|sunset|replen|opfyldning|transactional|upsell|cross/.test(source)) {
    return "High confidence";
  }
  if (matched || /quiz|lead|newsletter|subscribe|added to list|post purchase/.test(source)) {
    return "Good confidence";
  }
  return "Pattern guess";
}

function inferFlowRolloutModel(group, archetype) {
  const totalMarkets = Math.max(1, getTotalKlaviyoMarkets());
  const activeMarkets = Number(group?.activeMarkets || 0);
  const ratio = activeMarkets / totalMarkets;
  const source = getFlowSourceText(group);
  const isLeadStyle = archetype.label === "Lead capture flow";
  const isUtility = archetype.stage === "Hygiene";
  const isTransactional = archetype.label === "Transactional flow";
  const isPromoCalendar = archetype.label === "Promo calendar flow";
  const looksLikeTest = /aw\d{2}|test|quiz|lead ad|meta quiz|campaign/.test(source);

  if (isUtility) {
    return {
      label: "System logic",
      summary: "Coverage matters only where the automation rule is meant to exist.",
      operatorNote: "Judge this on reliability and intended rollout, not on revenue.",
      coverageSensitive: false
    };
  }

  if (isTransactional) {
    return {
      label: ratio >= 0.8 ? "Critical broad rollout" : "Critical partial rollout",
      summary: ratio >= 0.8
        ? "This should usually be dependable wherever the customer event exists."
        : "Missing markets can matter here because service communication should rarely be patchy.",
      operatorNote: "Treat silence or missing rollout primarily as an integration problem.",
      coverageSensitive: true
    };
  }

  if (isLeadStyle && (looksLikeTest || activeMarkets <= 3)) {
    return {
      label: "Selective rollout",
      summary: "This looks like a targeted lead or test flow, so narrow coverage can be intentional.",
      operatorNote: "Judge this on whether the chosen markets are converting and feeding the next nurture step.",
      coverageSensitive: false
    };
  }

  if (isPromoCalendar && ratio < 0.75) {
    return {
      label: "Campaign-specific rollout",
      summary: "This looks like a timed promo flow, so partial rollout can be intentional market planning rather than a gap.",
      operatorNote: "Judge it first on whether the chosen markets and timing made sense, then on performance.",
      coverageSensitive: false
    };
  }

  if (ratio >= 0.85) {
    return {
      label: "Full-market engine",
      summary: "This flow is expected to run broadly across the Klaviyo estate.",
      operatorNote: "Coverage gaps are meaningful here, so protect rollout before optimizing copy.",
      coverageSensitive: true
    };
  }

  if (ratio >= 0.4) {
    return {
      label: "Scaling rollout",
      summary: "This flow is spreading across markets but is not yet universal.",
      operatorNote: "Decide whether the missing markets are intentional gaps or unfinished rollout work.",
      coverageSensitive: true
    };
  }

  return {
    label: "Selective market flow",
    summary: "This looks more local or intentionally limited than estate-wide.",
    operatorNote: "Do not force full-market expectations unless the business case says it should scale.",
    coverageSensitive: false
  };
}

function getFlowArchetype(group) {
  const source = getFlowSourceText(group);
  const triggerType = String(group?.triggerType || "");

  if (/welcome/.test(source)) {
    return {
      label: "Welcome flow",
      stage: "Acquisition",
      purpose: "turn new signups into first buyers",
      whyItMatters: "This is usually the first owned-message experience after signup, so weak performance hurts first-purchase conversion early.",
      successSignal: "broad rollout, solid opens and healthy click-through into the site",
      riskSignal: "silent markets, weak opens or high unsub right after signup usually means the first impression is off",
      operatorQuestion: "Are new subscribers getting a strong first nudge toward first purchase in every active market?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/quiz|lead|meta quiz/.test(source)) {
    return {
      label: "Lead capture flow",
      stage: "Acquisition",
      purpose: "capture leads and route them into nurture",
      whyItMatters: "Lead flows sit very top-of-funnel, so the job is less direct revenue and more turning interest into a nurtured audience.",
      successSignal: "consistent market rollout and a clear path from lead to nurture or first product interaction",
      riskSignal: "tiny rollout is often intentional, but silence or weak follow-up means new leads are not being worked properly",
      operatorQuestion: "Is this lead source intentionally limited, or should more markets be nurturing these leads already?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/smykke.*quiz/.test(source)) {
    return {
      label: "Quiz lead flow",
      stage: "Acquisition",
      purpose: "convert quiz intent into qualified lead capture",
      whyItMatters: "Quiz flows usually sit higher-intent than a generic signup because the subscriber has already shown category curiosity.",
      successSignal: "steady lead capture in the intended markets with a clear handoff into nurture or product education",
      riskSignal: "weak follow-up matters more than narrow rollout here, because many quiz flows are intentionally local or test-based",
      operatorQuestion: "Is the quiz creating useful leads and handing them into the next nurture step cleanly?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/browse|viewed product/.test(source)) {
    return {
      label: "Browse recovery flow",
      stage: "Consideration",
      purpose: "pull browsing intent back toward purchase",
      whyItMatters: "These contacts are warm but undecided, so this flow should recover attention before interest fades.",
      successSignal: "healthy opens with enough clicks to bring product viewers back to site",
      riskSignal: "soft opens and low clicks usually mean the reminder is not compelling enough",
      operatorQuestion: "Is this flow still converting warm browsing intent, or is traffic slipping away?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/campaign - viewed product/.test(source)) {
    return {
      label: "Viewed-product reminder",
      stage: "Consideration",
      purpose: "re-surface a specific product after recent interest",
      whyItMatters: "This sits close to browse recovery but should feel more product-specific and timely, so relevance matters a lot.",
      successSignal: "healthy opens, meaningful clicks back to the viewed product and visible assisted revenue",
      riskSignal: "if opens hold but revenue stays weak, the reminder is likely too generic or the viewed-product trigger is stale",
      operatorQuestion: "Is this reminder still reconnecting recent product interest to purchase?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/cart|checkout|abandon/.test(source)) {
    return {
      label: "Abandonment flow",
      stage: "Consideration",
      purpose: "recover abandoned buying intent",
      whyItMatters: "This is some of the closest-to-purchase traffic you can own in email, so leaks here are very expensive.",
      successSignal: "strong opens, meaningful clicks and clear revenue recovery across markets",
      riskSignal: "drop-offs in sends or weak revenue usually point to trigger issues or bad reminder timing",
      operatorQuestion: "Are we recovering near-purchase intent fast enough, or is the abandonment journey leaking money?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/transactional|receipt|informationer|korrekte|order/.test(source)) {
    return {
      label: "Transactional flow",
      stage: "Purchase",
      purpose: "deliver critical customer communication after a system event",
      whyItMatters: "These flows protect trust around orders and service moments, so reliability matters more than cleverness.",
      successSignal: "stable sends, solid opens and low unsub because customers need the message",
      riskSignal: "send gaps or sudden performance drops often mean a trigger or integration issue, not a copy issue",
      operatorQuestion: "Is this flow reliably reaching customers whenever the underlying event happens?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/review/.test(source)) {
    return {
      label: "Review flow",
      stage: "Retention",
      purpose: "collect proof and strengthen post-purchase trust",
      whyItMatters: "Review flows help compound trust after purchase and create proof that improves future conversion.",
      successSignal: "broad coverage and decent opens after the post-purchase window",
      riskSignal: "missing markets or silence often means review collection is inconsistent, not necessarily bad copy",
      operatorQuestion: "Are we systematically collecting proof after purchase, or only in some markets?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/sample follow-up/.test(source)) {
    return {
      label: "Post-sample follow-up",
      stage: "Retention",
      purpose: "turn sampling interest into a clearer buying step",
      whyItMatters: "Sample follow-up flows are there to convert trial behaviour into confidence and the next commercial action.",
      successSignal: "healthy engagement after the sample moment and enough clicks or revenue to prove the follow-up is moving the contact onward",
      riskSignal: "silence usually means the trigger is too narrow, while opens without revenue often means the next-step offer is weak",
      operatorQuestion: "Does the sample journey actually move people closer to purchase, or just create polite engagement?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/upsell|cross/.test(source)) {
    return {
      label: "Upsell / cross-sell flow",
      stage: "Retention",
      purpose: "increase order value after initial interest",
      whyItMatters: "These flows matter because they turn existing demand into more value instead of relying only on new acquisition.",
      successSignal: "revenue concentration in strong markets with healthy opens and enough clicks",
      riskSignal: "weak revenue despite opens means the offer or product fit is not landing",
      operatorQuestion: "Is this flow actually creating extra value, or just generating opens without money?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/kampagneflow|^w\d{1,2}\b/.test(source) || triggerType === "Date Based") {
    return {
      label: "Promo calendar flow",
      stage: "Activation",
      purpose: "push a timed commercial message around a campaign or calendar moment",
      whyItMatters: "These flows behave more like scheduled commercial pushes than evergreen automations, so timing and intended rollout matter a lot.",
      successSignal: "clear send activity in the right markets during the active window with enough opens and revenue to justify the automation",
      riskSignal: "coverage gaps are only a problem if the promo was meant to be estate-wide; otherwise the key risk is poor timing or weak commercial lift",
      operatorQuestion: "Was this promo flow meant for all markets, or only the chosen ones, and did it create enough commercial response?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/post purchase|second purchase|thank you|thank-you/.test(source)) {
    return {
      label: "Post-purchase flow",
      stage: "Retention",
      purpose: "drive repeat purchase after checkout",
      whyItMatters: "This is where you begin shaping second-purchase behavior and longer customer lifetime value.",
      successSignal: "good follow-through after the first order with revenue showing up beyond the initial purchase",
      riskSignal: "silence or weak engagement suggests the customer journey stops too abruptly after checkout",
      operatorQuestion: "Does the customer receive a useful next step after buying, or do we leave them alone too soon?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/opfyldning|replen/.test(source)) {
    return {
      label: "Replenishment flow",
      stage: "Retention",
      purpose: "bring customers back when replenishment timing makes sense",
      whyItMatters: "These flows should drive repeat behavior from customers who are already familiar with the product.",
      successSignal: "steady sends, healthy opens and repeated revenue from the same need cycle",
      riskSignal: "no sends or weak revenue can mean the timing logic is off or the replenishment hypothesis is wrong",
      operatorQuestion: "Is the timing right for the refill/reminder moment, or are we nudging too early or too late?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/winback|sunset/.test(source)) {
    return {
      label: "Reactivation flow",
      stage: "Reactivation",
      purpose: "reactivate contacts before they go cold",
      whyItMatters: "This is one of the last owned chances to recover dormant contacts before they churn or get suppressed.",
      successSignal: "enough sends, some clicks and acceptable unsub despite colder audiences",
      riskSignal: "very high unsub or no engagement means you may be pushing too hard on already-cold segments",
      operatorQuestion: "Is this flow recovering dormant contacts, or just creating fatigue in an already-cold audience?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/gdpr|suppress|auto-delete|auto-suppress|list cleaning|automation|permission =/.test(source)) {
    return {
      label: "Hygiene flow",
      stage: "Hygiene",
      purpose: "protect list quality and deliverability",
      whyItMatters: "These flows are not mainly revenue-driving, but they protect the health of the full email program.",
      successSignal: "stable execution, broad coverage and no unexplained silence where the hygiene rule should run",
      riskSignal: "unexpected inactivity or uneven rollout usually points to automation or data-quality issues",
      operatorQuestion: "Is this hygiene logic protecting the list everywhere it should, without creating accidental gaps?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }
  if (/customer tags|^edno$/.test(source)) {
    return {
      label: "Data logic flow",
      stage: "Hygiene",
      purpose: "update tagging or internal profile logic behind the email program",
      whyItMatters: "These flows usually do not exist to drive direct revenue, but they can quietly power segmentation and downstream automation quality.",
      successSignal: "stable execution where the data rule is supposed to run, without unexplained silence or bad side effects",
      riskSignal: "treat odd behaviour here as a data or setup problem before judging it like a commercial flow",
      operatorQuestion: "Is this logic quietly supporting the right downstream journeys, or is it creating noise in the data layer?",
      confidence: getFlowReasonConfidence(source, true)
    };
  }

  return {
    label: "Lifecycle flow",
    stage: "Lifecycle",
    purpose: "move contacts through the next logical step in the journey",
    whyItMatters: "If this flow is weak, the customer journey loses momentum somewhere between signup, consideration and repeat purchase.",
    successSignal: "clear sends in the right markets with balanced engagement and revenue where relevant",
    riskSignal: "coverage gaps and silence usually matter more than creative fine-tuning at this stage",
    operatorQuestion: "Is this flow showing up at the right moment in the journey, and is the rollout intentional?",
    confidence: getFlowReasonConfidence(source, false)
  };
}

function buildFlowUnderstanding(group) {
  const archetype = getFlowArchetype(group);
  const rollout = inferFlowRolloutModel(group, archetype);
  const stage = archetype.stage;
  const purpose = archetype.purpose;
  const health = group?.flowHealth?.label || "Healthy";
  const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
  const hasCoverageGap = missingMarkets.length > 0;
  const isSilent = (group?.sentTotal || 0) === 0;

  let read = `${archetype.label} in the ${stage.toLowerCase()} part of the journey, built to ${purpose}.`;
  if (isSilent) {
    read += " It is live, but currently silent in the selected window.";
  } else if (hasCoverageGap && rollout.coverageSensitive) {
    read += ` It is active, but coverage is uneven across ${missingMarkets.length} expected markets.`;
  } else if (hasCoverageGap) {
    read += ` It is active in ${group.activeMarkets} markets, and that may be intentional for this rollout style.`;
  } else {
    read += " It has broad live coverage across the configured markets.";
  }

  return {
    label: archetype.label,
    stage,
    purpose,
    read,
    whyItMatters: archetype.whyItMatters,
    successSignal: archetype.successSignal,
    riskSignal: archetype.riskSignal,
    operatorQuestion: archetype.operatorQuestion,
    confidence: archetype.confidence || "Pattern guess",
    rolloutLabel: rollout.label,
    rolloutSummary: rollout.summary,
    rolloutNote: rollout.operatorNote,
    coverageSensitive: rollout.coverageSensitive,
    operatorLens: `${health} read. ${isSilent ? "Check trigger conditions and market rollout first." : hasCoverageGap && rollout.coverageSensitive ? "Check where rollout is missing before optimizing copy." : hasCoverageGap ? "Treat rollout as a business-choice question before calling it a problem." : "Use the best market as your benchmark and protect the weak ones."}`
  };
}

function isCoreAutomationFlow(group) {
  const understanding = buildFlowUnderstanding(group);
  const source = getFlowSourceText(group);
  const flowCategory = classifyFlowGroup(group);

  if (isCampaignLikeFlowName(group?.campaignName)) return false;
  if (flowCategory === "utility") return false;
  if (understanding.stage === "Hygiene") return false;
  if (understanding.label === "Promo calendar flow") return false;
  if (/aw\d{2}|quiz|lead ad|meta quiz|signup form|newsletter|source_/.test(source)) return false;
  if (understanding.label === "Lead capture flow" || understanding.label === "Quiz lead flow" || understanding.label === "Data logic flow") return false;
  if (understanding.rolloutLabel === "Selective rollout" && (group.activeMarkets || 0) <= 3) return false;
  if ((group.sentTotal || 0) === 0 && (group.activeMarkets || 0) <= 3) return false;
  return true;
}

function getCoreAutomationFlowGroups(groups) {
  return (Array.isArray(groups) ? groups : []).filter((group) => isCoreAutomationFlow(group));
}

function getAllowedDashboardFlowLabels() {
  return new Set([
    "Welcome flow",
    "Browse recovery flow",
    "Viewed-product reminder",
    "Abandonment flow",
    "Transactional flow",
    "Review flow",
    "Post-sample follow-up",
    "Upsell / cross-sell flow",
    "Post-purchase flow",
    "Replenishment flow",
    "Reactivation flow"
  ]);
}

function isExcludedDashboardFlow(group) {
  const source = getFlowSourceText(group);
  const understanding = buildFlowUnderstanding(group);
  const allowedLabels = getAllowedDashboardFlowLabels();

  if (!allowedLabels.has(understanding.label)) return true;
  if (isCampaignLikeFlowName(group?.campaignName)) return true;
  if (String(group?.triggerType || "") === "Date Based") return true;
  if (/aw\d{2}|quiz|lead ad|meta quiz|signup form|newsletter|source_|permission =|gdpr|auto-delete|auto-suppress|list cleaning|xquality flow|customer tags|^edno$/i.test(source)) return true;
  return false;
}

function getFlowDashboardGroups(groups, options = {}) {
  const allGroups = Array.isArray(groups) ? groups : [];
  const requireBroadRollout = options.requireBroadRollout !== false;
  const minimumMarkets = requireBroadRollout
    ? Math.max(4, Math.floor(getTotalKlaviyoMarkets() * 0.45))
    : 1;

  return allGroups.filter((group) => {
    if (isExcludedDashboardFlow(group)) return false;
    return (group.activeMarkets || 0) >= minimumMarkets;
  });
}

function getMorningCheckFlowGroups(groups) {
  const broad = getFlowDashboardGroups(groups, { requireBroadRollout: true });
  if (broad.length) return broad;
  return getFlowDashboardGroups(groups, { requireBroadRollout: false });
}

function buildFlowHealth(group) {
  let score = 100;
  const reasons = [];

  if ((group.sentTotal || 0) === 0) {
    score -= 28;
    reasons.push("live but silent in range");
  }
  const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
  if (missingMarkets.length > 0) {
    const penalty = Math.min(missingMarkets.length * 3, 30);
    score -= penalty;
    reasons.push(`${missingMarkets.length} expected markets missing`);
  }
  if ((group.openRateWeighted || 0) > 0 && group.openRateWeighted < 38) {
    score -= 18;
    reasons.push("weak opens");
  } else if ((group.openRateWeighted || 0) > 0 && group.openRateWeighted < 48) {
    score -= 8;
    reasons.push("soft opens");
  }
  if ((group.clickRateWeighted || 0) > 0 && group.clickRateWeighted < 1) {
    score -= 10;
    reasons.push("thin clicks");
  }
  if ((group.unsubRateWeighted || 0) >= 0.4) {
    score -= 14;
    reasons.push("high unsub");
  } else if ((group.unsubRateWeighted || 0) >= 0.25) {
    score -= 6;
    reasons.push("rising unsub");
  }
  if ((group.activeMarkets || 0) <= 2) {
    score -= 10;
    reasons.push("tiny rollout");
  }

  const normalized = Math.max(8, Math.min(100, Math.round(score)));
  const tone = normalized >= 82 ? "success" : normalized >= 62 ? "neutral" : normalized >= 42 ? "warning" : "danger";
  const label = normalized >= 82 ? "Strong" : normalized >= 62 ? "Healthy" : normalized >= 42 ? "Watch" : "At risk";

  return {
    score: normalized,
    tone,
    label,
    summary: reasons.length ? reasons.join(" · ") : "stable"
  };
}

function buildFlowActionRail(group) {
  const markets = Array.isArray(group?.markets) ? group.markets : [];
  const withSend = markets.filter((market) => (market.sent || 0) > 0);
  const copyMarket = withSend.slice().sort((a, b) => {
    const left = (a.revenue || 0) + ((a.openRate || 0) * 10);
    const right = (b.revenue || 0) + ((b.openRate || 0) * 10);
    return right - left;
  })[0];
  const fixMarket = withSend.slice().sort((a, b) => {
    const left = (a.openRate || 0) - ((a.unsubRate || 0) * 25);
    const right = (b.openRate || 0) - ((b.unsubRate || 0) * 25);
    return left - right;
  })[0];
  const silentMarkets = markets.filter((market) => (market.sent || 0) === 0);

  return {
    copyMarket: copyMarket ? `${copyMarket.country} · ${formatKlaviyoCurrency(copyMarket.revenue)} · ${formatKlaviyoPercent(copyMarket.openRate)}` : "No sending market yet",
    fixMarket: fixMarket ? `${fixMarket.country} · ${formatKlaviyoPercent(fixMarket.openRate)} open · ${formatKlaviyoPercent(fixMarket.unsubRate, 2)} unsub` : "No weak market in range",
    protectFlow: `${group.flowHealth.label} · ${formatKlaviyoNumber(group.flowHealth.score, 0)} health`,
    silentMarkets: silentMarkets.length ? `${silentMarkets.length} silent markets` : "No silent markets"
  };
}

function getFocusedFlowGroup(groups) {
  const items = Array.isArray(groups) ? groups : [];
  if (!items.length) return null;
  const preferred = items.find((group) => group.campaignName === appState.klaviyoFlowFocus);
  if (preferred) return preferred;
  const attentionTarget = buildFlowAttentionItems(items).find((item) => item.flowFamily)?.flowFamily || "";
  if (attentionTarget) {
    const urgent = items.find((group) => group.campaignName === attentionTarget);
    if (urgent) return urgent;
  }
  return items
    .slice()
    .sort((left, right) => {
      const leftUnderstanding = buildFlowUnderstanding(left);
      const rightUnderstanding = buildFlowUnderstanding(right);
      const leftStageMatch = appState.klaviyoFlowStage !== "all" && leftUnderstanding.stage === appState.klaviyoFlowStage ? 12 : 0;
      const rightStageMatch = appState.klaviyoFlowStage !== "all" && rightUnderstanding.stage === appState.klaviyoFlowStage ? 12 : 0;
      const leftWatchBias = (left.flowHealth?.label === "At risk" ? 30 : left.flowHealth?.label === "Watch" ? 14 : 0);
      const rightWatchBias = (right.flowHealth?.label === "At risk" ? 30 : right.flowHealth?.label === "Watch" ? 14 : 0);
      const leftRiskBias = leftStageMatch + leftWatchBias + (100 - (left.flowHealth?.score || 0)) + ((left.sentTotal || 0) === 0 ? 16 : 0) + ((leftUnderstanding.coverageSensitive ? getKlaviyoEffectiveMissingMarkets(left).length : 0) * 2);
      const rightRiskBias = rightStageMatch + rightWatchBias + (100 - (right.flowHealth?.score || 0)) + ((right.sentTotal || 0) === 0 ? 16 : 0) + ((rightUnderstanding.coverageSensitive ? getKlaviyoEffectiveMissingMarkets(right).length : 0) * 2);

      if (rightRiskBias !== leftRiskBias) return rightRiskBias - leftRiskBias;
      const leftRecent = new Date(left.lastSent || 0).getTime();
      const rightRecent = new Date(right.lastSent || 0).getTime();
      if (rightRecent !== leftRecent) return rightRecent - leftRecent;
      if ((right.revenueTotal || 0) !== (left.revenueTotal || 0)) return (right.revenueTotal || 0) - (left.revenueTotal || 0);
      if ((right.sentTotal || 0) !== (left.sentTotal || 0)) return (right.sentTotal || 0) - (left.sentTotal || 0);
      return String(right.lastSent || "").localeCompare(String(left.lastSent || ""));
    })[0];
}

function getFocusedCampaignGroup(groups) {
  const items = Array.isArray(groups) ? groups : [];
  if (!items.length) return null;

  const preferred = items.find((group) => group.campaignName === appState.klaviyoCampaignFocus);
  if (preferred) return preferred;

  return items
    .slice()
    .sort((left, right) => {
      const leftMissing = getKlaviyoEffectiveMissingMarkets(left).length;
      const rightMissing = getKlaviyoEffectiveMissingMarkets(right).length;
      const leftPriority = (leftMissing * 20) + ((left.unsubRateWeighted || 0) * 12) - (left.openRateWeighted || 0) - ((left.clickRateWeighted || 0) * 2);
      const rightPriority = (rightMissing * 20) + ((right.unsubRateWeighted || 0) * 12) - (right.openRateWeighted || 0) - ((right.clickRateWeighted || 0) * 2);

      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      if ((right.revenueTotal || 0) !== (left.revenueTotal || 0)) return (right.revenueTotal || 0) - (left.revenueTotal || 0);
      return new Date(right.lastSent || 0).getTime() - new Date(left.lastSent || 0).getTime();
    })[0];
}

function getFocusedFlowReason(group, groups = []) {
  if (!group) return "";
  const understanding = buildFlowUnderstanding(group);
  const attentionTarget = buildFlowAttentionItems(Array.isArray(groups) ? groups : []).find((item) => item.flowFamily)?.flowFamily || "";

  if (attentionTarget && attentionTarget === group.campaignName) {
    return "Focused because this flow has the strongest current attention signal in the active view.";
  }
  if (appState.klaviyoFlowStage !== "all" && understanding.stage === appState.klaviyoFlowStage) {
    if (group.flowHealth?.label === "At risk" || group.flowHealth?.label === "Watch") {
      return `Focused because it is one of the most at-risk flows inside ${understanding.stage.toLowerCase()}.`;
    }
    return `Focused because it is currently the strongest operator candidate inside ${understanding.stage.toLowerCase()}.`;
  }
  if ((group.sentTotal || 0) === 0) {
    return "Focused because the flow is live but currently silent and worth checking first.";
  }
  if ((group.flowHealth?.label || "") === "At risk") {
    return "Focused because its health score is weak and it needs attention before cleaner flows do.";
  }
  if ((group.flowHealth?.label || "") === "Watch") {
    return "Focused because it is sending, but showing enough softness to deserve an operator check.";
  }
  return "Focused because it is currently one of the most relevant live flows across health, recency and commercial impact.";
}

function getFlowSnapshotHistory() {
  return Array.isArray(appState.klaviyoFlowSnapshots) ? appState.klaviyoFlowSnapshots : [];
}

function getPreviousFlowSnapshotMap() {
  const history = getFlowSnapshotHistory().slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (history.length < 2) return new Map();
  const previous = history[history.length - 2];
  if (Array.isArray(previous?.flows)) {
    return new Map(previous.flows.map((flow) => [flow.campaignName, flow]));
  }
  return new Map(Object.entries(previous?.flows || {}));
}

function getFlowSuggestionKey(title, body) {
  return `${String(title || "").trim()}::${String(body || "").trim()}`;
}

function loadFlowSuggestionPreferences() {
  try {
    const raw = localStorage.getItem("westpack.ignoredFlowSuggestionKeys");
    const parsed = JSON.parse(raw || "[]");
    appState.ignoredFlowSuggestionKeys = Array.isArray(parsed) ? parsed : [];
  } catch {
    appState.ignoredFlowSuggestionKeys = [];
  }
}

function persistFlowSuggestionPreferences() {
  try {
    localStorage.setItem("westpack.ignoredFlowSuggestionKeys", JSON.stringify(appState.ignoredFlowSuggestionKeys || []));
  } catch {}
}

function buildKlaviyoOverviewBuckets(groups) {
  const buckets = new Map();

  groups.forEach((group) => {
    const dateKey = String(group.lastSent || "").slice(0, 10);
    if (!dateKey) return;
    const current = buckets.get(dateKey) || {
      date: dateKey,
      sent: 0,
      revenue: 0,
      openWeighted: 0,
      clickWeighted: 0,
      unsubWeighted: 0,
      families: 0,
      coverageGaps: 0
    };
    current.sent += group.sentTotal || 0;
    current.revenue += group.revenueTotal || 0;
    current.openWeighted += (group.openRateWeighted || 0) * (group.sentTotal || 0);
    current.clickWeighted += (group.clickRateWeighted || 0) * (group.sentTotal || 0);
    current.unsubWeighted += (group.unsubRateWeighted || 0) * (group.sentTotal || 0);
    current.families += 1;
    current.coverageGaps += getKlaviyoEffectiveMissingMarkets(group).length;
    buckets.set(dateKey, current);
  });

  return Array.from(buckets.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((bucket) => ({
      ...bucket,
      openRate: bucket.sent ? bucket.openWeighted / bucket.sent : 0,
      clickRate: bucket.sent ? bucket.clickWeighted / bucket.sent : 0,
      unsubRate: bucket.sent ? bucket.unsubWeighted / bucket.sent : 0
    }));
}

function buildSparklinePath(values = [], width = 160, height = 42, padding = 4) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = padding + ((width - padding * 2) * index) / Math.max(values.length - 1, 1);
    const y = height - padding - (((value - min) / range) * (height - padding * 2));
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function getKlaviyoSubscriberMarkets() {
  const subscribers = appState.klaviyoSubscribers || { total: 0, markets: [] };
  const markets = Array.isArray(subscribers.markets) ? subscribers.markets : [];
  return markets.slice().sort((a, b) => (b.count || 0) - (a.count || 0));
}

function buildKlaviyoOperatorRead(groups) {
  const subscribers = getKlaviyoSubscriberMarkets();
  const totalSubscribers = subscribers.reduce((sum, item) => sum + (item.count || 0), 0);
  const averageSubscribers = subscribers.length ? totalSubscribers / subscribers.length : 0;
  const subscriberMap = new Map(subscribers.map((item) => [item.country, item]));
  const items = [];

  const missingLargeMarket = groups
    .flatMap((group) => getKlaviyoEffectiveMissingMarkets(group).map((country) => ({
      country,
      campaignName: group.campaignName,
      subscriberCount: subscriberMap.get(country)?.count || 0
    })))
    .sort((a, b) => b.subscriberCount - a.subscriberCount)[0];

  if (missingLargeMarket?.subscriberCount) {
    items.push({
      title: "High",
      body: `${missingLargeMarket.country} has ${formatKlaviyoNumber(missingLargeMarket.subscriberCount, 0)} subscribers but is missing '${missingLargeMarket.campaignName}'. Check whether that market skipped the send or used a different campaign name.`
    });
  }

  const weakLargeMarket = groups
    .flatMap((group) => (group.markets || []).map((market) => ({
      ...market,
      campaignName: group.campaignName,
      subscriberCount: subscriberMap.get(market.country)?.count || 0
    })))
    .filter((market) => market.subscriberCount >= Math.max(averageSubscribers, 500))
    .sort((a, b) => a.openRate - b.openRate)[0];

  if (weakLargeMarket) {
    items.push({
      title: "High",
      body: `${weakLargeMarket.country} is a large list but only opened '${weakLargeMarket.campaignName}' at ${formatKlaviyoPercent(weakLargeMarket.openRate)}. Start with subject line, send timing and segment freshness there.`
    });
  }

  const topRevenueCampaign = groups.slice().sort((a, b) => b.revenueTotal - a.revenueTotal)[0];
  if (topRevenueCampaign) {
    const topRevenueMarket = (topRevenueCampaign.markets || []).slice().sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
    if (topRevenueMarket) {
      items.push({
        title: "Medium",
        body: `'${topRevenueCampaign.campaignName}' is the top revenue family. ${topRevenueMarket.country} is leading it, so reuse that market's subject line and send setup when the next campaign is built.`
      });
    }
  }

  const highUnsub = groups
    .flatMap((group) => (group.markets || []).map((market) => ({ ...market, campaignName: group.campaignName })))
    .sort((a, b) => b.unsubRate - a.unsubRate)[0];

  if (highUnsub) {
    items.push({
      title: "Medium",
      body: `${highUnsub.country} has the highest unsubscribe pressure on '${highUnsub.campaignName}' at ${formatKlaviyoPercent(highUnsub.unsubRate, 2)}. Review whether the offer, cadence or segment match was off there.`
    });
  }

  const topSubscriberMarket = subscribers[0];
  if (topSubscriberMarket && totalSubscribers) {
    const share = ((topSubscriberMarket.count || 0) / totalSubscribers) * 100;
    items.push({
      title: "Low",
      body: `${topSubscriberMarket.country} holds ${formatKlaviyoPercent(share)} of the full subscriber base. Treat that market as your deliverability anchor and keep its winning patterns documented.`
    });
  }

  return items.slice(0, 5);
}

function renderKlaviyoOverviewMiniGrid(groups) {
  const node = document.getElementById("klaviyo-mini-grid");
  if (!node) return;
  const metaNode = document.getElementById("klaviyo-results-meta");

  if (appState.klaviyoDashboardTab !== "general") {
    node.innerHTML = "";
    if (metaNode) metaNode.textContent = "";
    return;
  }

  const metrics = buildKlaviyoOverviewMetrics(groups);
  const flowGroups = getFilteredKlaviyoFlowGroups();
  const permission = buildPermissionMetrics("total", appState.klaviyoSubscriberRange || 30);
  const buckets = buildKlaviyoOverviewBuckets(groups);
  const campaignRevenueSeries = buckets.map((bucket) => bucket.revenue);
  const openRateSeries = buckets.map((bucket) => bucket.openRate);
  const netGrowthSeries = sliceSeriesByRange(
    buildSubscriberSeriesForKey("total", "net").series || [],
    buildSubscriberSeriesForKey("total", "net").dates || [],
    appState.klaviyoSubscriberRange || 30
  ).series || [];

  const cards = [
    {
      label: "Open rate trend",
      value: formatKlaviyoPercent(metrics.averageOpen, 1),
      meta: "Weighted across sends",
      series: openRateSeries
    },
    {
      label: "Revenue trend",
      value: formatKlaviyoCurrency(metrics.revenueTotal),
      meta: `${formatKlaviyoNumber(groups.length, 0)} campaign families`,
      series: campaignRevenueSeries
    },
    {
      label: "Audience growth trend",
      value: permission.netGrowth >= 0 ? `+${formatKlaviyoNumber(permission.netGrowth, 0)}` : formatKlaviyoNumber(permission.netGrowth, 0),
      meta: `${formatKlaviyoNumber(permission.subsAdded, 0)} joined · ${formatKlaviyoNumber(permission.unsubsTotal, 0)} left`,
      series: netGrowthSeries
    }
  ];

  if (metaNode) {
    metaNode.textContent = groups.length
      ? `${formatKlaviyoNumber(groups.length, 0)} families`
      : "No families";
  }

  node.innerHTML = cards.map((card, index) => {
    const path = buildSparklinePath(card.series);
    return `
      <article class="klaviyo-mini-card tone-${escapeHtml(index === 0 ? "revenue" : index === 1 ? "engagement" : index === 2 ? "conversion" : index === 3 ? "audience" : "flow")}">
        <div class="klaviyo-mini-copy">
          <span class="section-label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <p>${escapeHtml(card.meta)}</p>
        </div>
        <div class="klaviyo-mini-chart" aria-hidden="true">
          ${path
            ? `<svg viewBox="0 0 160 42"><path d="${path}" fill="none" stroke="rgba(207, 31, 37, 0.88)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
            : `<span class="field-hint">No trend yet</span>`}
        </div>
      </article>
    `;
  }).join("");
}

function buildLinePath(values = [], width = 640, height = 220, padding = 18, bounds = {}) {
  if (!values.length) return "";
  const max = Number.isFinite(bounds.max) ? bounds.max : Math.max(...values, 0);
  const min = Number.isFinite(bounds.min) ? bounds.min : Math.min(...values, max);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = padding + ((width - padding * 2) * index) / Math.max(values.length - 1, 1);
    const normalized = (value - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function buildTrendBounds(values = [], mode = "cumulative") {
  if (!values.length) {
    return { min: 0, max: 1 };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = Math.max(rawMax - rawMin, 1);

  if (mode === "cumulative" || mode === "snapshot") {
    const padding = Math.max(rawRange * 0.18, Math.abs(rawMax) * 0.01, 1);
    return {
      min: rawMin - padding,
      max: rawMax + padding
    };
  }

  const min = Math.min(rawMin, 0);
  const max = Math.max(rawMax, 0);
  const padding = Math.max((max - min) * 0.12, 1);
  return {
    min: min - padding,
    max: max + padding
  };
}

function sliceSeriesByRange(series = [], dates = [], days = 30) {
  const take = Math.max(1, Math.min(days, series.length || days));
  return {
    series: series.slice(-take),
    dates: dates.slice(-take)
  };
}

function buildUnsubTimeline(key = "total") {
  const subscribers = appState.klaviyoSubscribers || {};
  const timelineDates = Array.isArray(subscribers.timeline?.dates) ? subscribers.timeline.dates : [];
  const dateMap = new Map(timelineDates.map((date) => [date, 0]));
  const groups = Array.isArray(appState.klaviyoCampaignGroups) ? appState.klaviyoCampaignGroups : [];

  groups.forEach((group) => {
    (group.markets || []).forEach((market) => {
      if (key !== "total" && market.country !== key) return;
      const dateKey = String(market.sendTime || "").slice(0, 10);
      if (!dateMap.has(dateKey)) return;
      const unsubCount = (market.sent || 0) * ((market.unsubRate || 0) / 100);
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + unsubCount);
    });
  });

  return {
    dates: timelineDates,
    series: timelineDates.map((date) => Number((dateMap.get(date) || 0).toFixed(2)))
  };
}

function buildPermissionMetrics(key = "total", rangeDays = 30) {
  const baseSeries = buildSubscriberSeriesForKey(key, "daily");
  const unsubSeries = buildUnsubTimeline(key);
  const slicedSubs = sliceSeriesByRange(baseSeries.series || [], baseSeries.dates || [], rangeDays);
  const slicedUnsubs = sliceSeriesByRange(unsubSeries.series || [], unsubSeries.dates || [], rangeDays);
  const subsAdded = (slicedSubs.series || []).reduce((sum, value) => sum + (value || 0), 0);
  const unsubsTotal = (slicedUnsubs.series || []).reduce((sum, value) => sum + (value || 0), 0);
  const netGrowth = subsAdded - unsubsTotal;

  const groups = Array.isArray(appState.klaviyoCampaignGroups) ? appState.klaviyoCampaignGroups : [];
  const threshold = new Date();
  threshold.setUTCDate(threshold.getUTCDate() - Math.max(1, rangeDays));
  let sentTotal = 0;
  let unsubWeightedTotal = 0;
  groups.forEach((group) => {
    (group.markets || []).forEach((market) => {
      if (key !== "total" && market.country !== key) return;
      const sendDate = new Date(market.sendTime);
      if (Number.isNaN(sendDate.getTime()) || sendDate < threshold) return;
      sentTotal += market.sent || 0;
      unsubWeightedTotal += (market.sent || 0) * (market.unsubRate || 0);
    });
  });

  return {
    subsAdded: Number(subsAdded.toFixed(0)),
    unsubsTotal: Number(unsubsTotal.toFixed(0)),
    netGrowth: Number(netGrowth.toFixed(0)),
    unsubRateWeighted: sentTotal ? unsubWeightedTotal / sentTotal : 0,
    unsubVsSubRatio: subsAdded ? (unsubsTotal / subsAdded) * 100 : 0
  };
}

function buildSubscriberSeriesForKey(key, mode = "cumulative") {
  const subscribers = appState.klaviyoSubscribers || {};
  const timeline = subscribers.timeline || {};
  const snapshots = subscribers.snapshots || {};
  const markets = Array.isArray(timeline.markets) ? timeline.markets : [];

  if (key === "total") {
    if (mode === "net") {
      const unsubs = buildUnsubTimeline("total");
      const subs = Array.isArray(timeline.totalJoinedDaily) ? timeline.totalJoinedDaily : [];
      return {
        label: "Total net growth",
        listName: "All newsletter lists",
        series: subs.map((value, index) => Number(((value || 0) - (unsubs.series[index] || 0)).toFixed(2))),
        dates: Array.isArray(timeline.dates) ? timeline.dates : []
      };
    }
    if (mode === "daily") {
      return {
        label: "Total new subscribers",
        listName: "All newsletter lists",
        series: Array.isArray(timeline.totalJoinedDaily) ? timeline.totalJoinedDaily : [],
        dates: Array.isArray(timeline.dates) ? timeline.dates : []
      };
    }
    if (mode === "snapshot") {
      return {
        label: "Total snapshot subscribers",
        listName: "All newsletter lists",
        series: Array.isArray(snapshots.totalSeries) ? snapshots.totalSeries : [],
        dates: Array.isArray(snapshots.dates) ? snapshots.dates : []
      };
    }
    return {
      label: "Total subscribers",
      listName: "All newsletter lists",
      series: Array.isArray(timeline.totalCumulative) ? timeline.totalCumulative : [],
      dates: Array.isArray(timeline.dates) ? timeline.dates : []
    };
  }

  const market = markets.find((item) => item.country === key);
  const snapshotMarket = (snapshots.markets || []).find((item) => item.country === key);
  if (!market && !snapshotMarket) {
    return {
      label: `${key} subscribers`,
      listName: "Newsletter list",
      series: [],
      dates: []
    };
  }

  if (mode === "daily") {
    return {
      label: `${key} new subscribers`,
      listName: market?.listName || snapshotMarket?.listName || "Newsletter list",
      series: Array.isArray(market?.joinedDaily) ? market.joinedDaily : [],
      dates: Array.isArray(timeline.dates) ? timeline.dates : []
    };
  }
  if (mode === "net") {
    const unsubs = buildUnsubTimeline(key);
    return {
      label: `${key} net growth`,
      listName: market?.listName || snapshotMarket?.listName || "Newsletter list",
      series: (Array.isArray(market?.joinedDaily) ? market.joinedDaily : []).map((value, index) => Number(((value || 0) - (unsubs.series[index] || 0)).toFixed(2))),
      dates: Array.isArray(timeline.dates) ? timeline.dates : []
    };
  }
  if (mode === "snapshot") {
    return {
      label: `${key} snapshot subscribers`,
      listName: market?.listName || snapshotMarket?.listName || "Newsletter list",
      series: Array.isArray(snapshotMarket?.series) ? snapshotMarket.series : [],
      dates: Array.isArray(snapshots.dates) ? snapshots.dates : []
    };
  }

  return {
    label: `${key} subscribers`,
    listName: market?.listName || snapshotMarket?.listName || "Newsletter list",
    series: Array.isArray(market?.cumulative) ? market.cumulative : [],
    dates: Array.isArray(timeline.dates) ? timeline.dates : []
  };
}

function buildKlaviyoSubscriberMetricCards(mode, series, permissionMetrics) {
  const values = Array.isArray(series) ? series : [];
  const currentValue = Number(values[values.length - 1] || 0);
  const firstValue = Number(values[0] || 0);
  const rangeDelta = currentValue - firstValue;
  const rangeTotal = values.reduce((sum, value) => sum + Number(value || 0), 0);
  const averageValue = values.length ? rangeTotal / values.length : 0;
  const averageNet = values.length ? permissionMetrics.netGrowth / values.length : 0;

  if (mode === "daily") {
    return [
      { label: "Latest day", value: formatKlaviyoNumber(currentValue, 0) },
      { label: "Range added", value: formatKlaviyoNumber(permissionMetrics.subsAdded, 0) },
      { label: "Average / day", value: formatKlaviyoNumber(averageValue, 0) },
      { label: "Est. unsubs", value: formatKlaviyoNumber(permissionMetrics.unsubsTotal, 0) },
      { label: "Range net", value: permissionMetrics.netGrowth >= 0 ? `+${formatKlaviyoNumber(permissionMetrics.netGrowth, 0)}` : formatKlaviyoNumber(permissionMetrics.netGrowth, 0) }
    ];
  }

  if (mode === "snapshot") {
    return [
      { label: "Latest snapshot", value: formatKlaviyoNumber(currentValue, 0) },
      { label: "Snapshot delta", value: rangeDelta >= 0 ? `+${formatKlaviyoNumber(rangeDelta, 0)}` : formatKlaviyoNumber(rangeDelta, 0) },
      { label: "Range added", value: formatKlaviyoNumber(permissionMetrics.subsAdded, 0) },
      { label: "Est. unsubs", value: formatKlaviyoNumber(permissionMetrics.unsubsTotal, 0) },
      { label: "Range net", value: permissionMetrics.netGrowth >= 0 ? `+${formatKlaviyoNumber(permissionMetrics.netGrowth, 0)}` : formatKlaviyoNumber(permissionMetrics.netGrowth, 0) }
    ];
  }

  if (mode === "net") {
    return [
      { label: "Latest net day", value: currentValue >= 0 ? `+${formatKlaviyoNumber(currentValue, 0)}` : formatKlaviyoNumber(currentValue, 0) },
      { label: "Range net", value: permissionMetrics.netGrowth >= 0 ? `+${formatKlaviyoNumber(permissionMetrics.netGrowth, 0)}` : formatKlaviyoNumber(permissionMetrics.netGrowth, 0) },
      { label: "Average net / day", value: averageNet >= 0 ? `+${formatKlaviyoNumber(averageNet, 0)}` : formatKlaviyoNumber(averageNet, 0) },
      { label: "Added", value: formatKlaviyoNumber(permissionMetrics.subsAdded, 0) },
      { label: "Est. unsubs", value: formatKlaviyoNumber(permissionMetrics.unsubsTotal, 0) }
    ];
  }

  return [
    { label: "Current total", value: formatKlaviyoNumber(currentValue, 0) },
    { label: "Join-based growth", value: rangeDelta >= 0 ? `+${formatKlaviyoNumber(rangeDelta, 0)}` : formatKlaviyoNumber(rangeDelta, 0) },
    { label: "Average added / day", value: formatKlaviyoNumber(averageValue, 0) },
    { label: "Est. unsubs", value: formatKlaviyoNumber(permissionMetrics.unsubsTotal, 0) },
    { label: "Range net", value: permissionMetrics.netGrowth >= 0 ? `+${formatKlaviyoNumber(permissionMetrics.netGrowth, 0)}` : formatKlaviyoNumber(permissionMetrics.netGrowth, 0) }
  ];
}

function buildKlaviyoSubscriberModeNote(mode, snapshotDates) {
  const hasSnapshotHistory = Array.isArray(snapshotDates) && snapshotDates.length > 1;

  if (mode === "snapshot") {
    return hasSnapshotHistory
      ? `Snapshot history is live from ${snapshotDates[0]} to ${snapshotDates[snapshotDates.length - 1]}. This view shows real list size changes between saved snapshots.`
      : "Snapshot tracking has started, but there is not enough history yet to show a meaningful before/after change.";
  }

  if (mode === "daily") {
    return "This view shows new subscribers added per day. Use it to spot acquisition spikes, soft days, and uneven market pacing.";
  }

  if (mode === "net") {
    return "This view estimates net subscriber movement per day by subtracting estimated unsubscribes from daily joins.";
  }

  return hasSnapshotHistory
    ? `Cumulative growth shows join-based build-up over time. Snapshot history from ${snapshotDates[0]} to ${snapshotDates[snapshotDates.length - 1]} helps compare modeled growth with real list movement.`
    : "Cumulative growth is join-based for now. As snapshot history builds up, it becomes easier to compare modeled growth with actual list size movement.";
}

function renderKlaviyoSubscriberSection() {
  const totalNode = document.getElementById("klaviyo-subscriber-total");
  const chartNode = document.getElementById("klaviyo-subscriber-chart");
  const metaNode = document.getElementById("klaviyo-subscriber-meta");
  const marketNode = document.getElementById("klaviyo-subscriber-market");
  const modeNode = document.getElementById("klaviyo-subscriber-mode");
  const rangeNode = document.getElementById("klaviyo-subscriber-range");
  const subscribers = appState.klaviyoSubscribers || { total: 0, markets: [] };
  const markets = getKlaviyoSubscriberMarkets();
  const average = markets.length ? Math.round((subscribers.total || 0) / markets.length) : 0;
  const counts = markets.map((item) => item.count || 0).sort((a, b) => a - b);
  const middle = Math.floor(counts.length / 2);
  const median = !counts.length
    ? 0
    : counts.length % 2
      ? counts[middle]
      : Math.round((counts[middle - 1] + counts[middle]) / 2);
  const topMarket = markets[0];
  const topShare = topMarket && subscribers.total ? ((topMarket.count || 0) / subscribers.total) * 100 : 0;

  if (totalNode) {
    totalNode.innerHTML = [
      `
      <article class="klaviyo-subscriber-total-card tone-primary">
        <span class="section-label">Total</span>
        <strong>${escapeHtml(formatKlaviyoNumber(subscribers.total || 0, 0))}</strong>
        <p>${markets.length} lists</p>
      </article>
      `,
      `
      <article class="klaviyo-subscriber-total-card">
        <span class="section-label">Avg market</span>
        <strong>${escapeHtml(formatKlaviyoNumber(average, 0))}</strong>
        <p>Median ${escapeHtml(formatKlaviyoNumber(median, 0))}</p>
      </article>
      `,
      `
      <article class="klaviyo-subscriber-total-card tone-accent">
        <span class="section-label">Largest</span>
        <strong>${escapeHtml(topMarket?.country || "--")}</strong>
        <p>${topMarket ? `${formatKlaviyoNumber(topMarket.count || 0, 0)} · ${formatKlaviyoPercent(topShare)}` : "No list"}</p>
      </article>
      `
    ].join("");
  }

  if (metaNode) {
    const liveLists = markets.filter((item) => item.listName).length;
    metaNode.textContent = liveLists
      ? `${liveLists} lists`
      : "No lists";
  }

  if (marketNode) {
    const options = [`<option value="total">Total</option>`].concat(
      markets.map((item) => `<option value="${escapeHtml(item.country)}"${appState.klaviyoSubscriberMarket === item.country ? " selected" : ""}>${escapeHtml(item.country)}</option>`)
    );
    marketNode.innerHTML = options.join("");
    if (![ "total", ...markets.map((item) => item.country) ].includes(appState.klaviyoSubscriberMarket)) {
      appState.klaviyoSubscriberMarket = "total";
      marketNode.value = "total";
    } else {
      marketNode.value = appState.klaviyoSubscriberMarket;
    }
  }

  if (modeNode) {
    modeNode.value = appState.klaviyoSubscriberMode || "net";
  }

  if (rangeNode) {
    rangeNode.value = String(appState.klaviyoSubscriberRange || 30);
  }

  if (!chartNode) return;
  if (!markets.length) {
    chartNode.innerHTML = `<div class="empty-state">No subscriber lists were found in the current snapshot.</div>`;
    return;
  }

  const trend = buildSubscriberSeriesForKey(appState.klaviyoSubscriberMarket || "total", appState.klaviyoSubscriberMode || "cumulative");
  const slicedPrimary = sliceSeriesByRange(trend.series || [], trend.dates || [], appState.klaviyoSubscriberRange || 30);
  const series = slicedPrimary.series || [];
  const dates = slicedPrimary.dates || [];
  const permissionMetrics = buildPermissionMetrics(appState.klaviyoSubscriberMarket || "total", appState.klaviyoSubscriberRange || 30);
  const chartWidth = 720;
  const chartHeight = 188;
  const yBounds = buildTrendBounds(series, appState.klaviyoSubscriberMode || "cumulative");
  const path = buildLinePath(series, chartWidth, chartHeight, 24, yBounds);
  const currentValue = series[series.length - 1] || 0;
  const snapshotDates = subscribers.snapshots?.dates || [];
  const maxCount = Math.max(...markets.map((item) => item.count || 0), 1);
  const mode = appState.klaviyoSubscriberMode || "net";
  const metricCards = buildKlaviyoSubscriberMetricCards(mode, series, permissionMetrics);
  const modeNote = buildKlaviyoSubscriberModeNote(mode, snapshotDates);
  chartNode.innerHTML = markets
    ? `
      <section class="klaviyo-trend-card">
        <div class="klaviyo-trend-head">
          <div>
            <span class="section-label">Detailed trend</span>
            <strong>${escapeHtml(trend.label)}</strong>
          </div>
          <div class="klaviyo-trend-metrics">
            ${metricCards.map((metric) => `
              <div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>
            `).join("")}
          </div>
        </div>
        <div class="klaviyo-line-chart">
          <svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${escapeHtml(trend.label)} trend">
            <defs>
              <linearGradient id="klaviyoTrendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="rgba(207, 31, 37, 0.18)"></stop>
                <stop offset="100%" stop-color="rgba(207, 31, 37, 0.01)"></stop>
              </linearGradient>
            </defs>
            <path d="${path} L ${chartWidth - 24} ${chartHeight - 24} L 24 ${chartHeight - 24} Z" fill="url(#klaviyoTrendFill)"></path>
            <path d="${path}" fill="none" stroke="rgba(207, 31, 37, 0.92)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <div class="klaviyo-line-chart-scale">
            <span>Scale</span>
            <strong>${escapeHtml(formatKlaviyoNumber(yBounds.min, 0))}</strong>
            <strong>${escapeHtml(formatKlaviyoNumber(yBounds.max, 0))}</strong>
          </div>
          <div class="klaviyo-line-chart-axis">
            <span>${escapeHtml(dates[0] || "--")}</span>
            <span>${escapeHtml(dates[dates.length - 1] || "--")}</span>
          </div>
          <div class="klaviyo-line-chart-legend">
            <span><i class="is-primary"></i>${escapeHtml(appState.klaviyoSubscriberMarket === "total" ? "Total" : appState.klaviyoSubscriberMarket)}</span>
          </div>
        </div>
        <div class="klaviyo-snapshot-meta">
          ${escapeHtml(modeNote)}
        </div>
      </section>
      <section class="klaviyo-subscriber-bars">
        ${markets
    .map((item) => `
      <article class="klaviyo-subscriber-bar-row ${topMarket?.country === item.country ? "is-leading" : ""}">
        <div class="klaviyo-subscriber-bar-label">
          <strong>${escapeHtml(item.country)}</strong>
          <span>${escapeHtml(item.listName || "No newsletter list found")}</span>
        </div>
        <div class="klaviyo-subscriber-bar-track">
          <div class="klaviyo-subscriber-bar-fill" style="width: ${Math.max(6, ((item.count || 0) / maxCount) * 100)}%"></div>
        </div>
        <strong class="klaviyo-subscriber-bar-value">${escapeHtml(formatKlaviyoNumber(item.count || 0, 0))}<span>${escapeHtml(formatKlaviyoPercent(subscribers.total ? ((item.count || 0) / subscribers.total) * 100 : 0))}</span></strong>
      </article>
    `).join("")}
      </section>
    `
    : "";
}

function renderKlaviyoOverviewHighlights(groups) {
  const node = document.getElementById("klaviyo-overview-highlights");
  if (!node) return;
  if (appState.klaviyoDashboardTab !== "campaigns") {
    node.innerHTML = "";
    return;
  }
  const metrics = buildKlaviyoOverviewMetrics(groups);
  const topOpen = [...groups].sort((a, b) => b.openRateWeighted - a.openRateWeighted)[0];
  const topCampaign = metrics.topCampaign;
  const highestUnsubMarket = groups
    .flatMap((group) => (group.markets || []).map((market) => ({ ...market, campaignName: group.campaignName })))
    .sort((a, b) => b.unsubRate - a.unsubRate)[0];
  const biggestGap = groups
    .filter((group) => getKlaviyoEffectiveMissingMarkets(group).length)
    .sort((a, b) => getKlaviyoEffectiveMissingMarkets(b).length - getKlaviyoEffectiveMissingMarkets(a).length)[0];
  const cards = [
    {
      title: "Top revenue family",
      value: topCampaign?.campaignName || "--",
      body: topCampaign ? `${formatKlaviyoCurrency(topCampaign.revenueTotal)} revenue` : "--",
      tone: "success"
    },
    {
      title: "Best opener",
      value: topOpen?.campaignName || "--",
      body: topOpen ? `${formatKlaviyoPercent(topOpen.openRateWeighted)} weighted open` : "--",
      tone: "success"
    },
    {
      title: "Needs attention",
      value: highestUnsubMarket?.campaignName || biggestGap?.campaignName || "--",
      body: highestUnsubMarket
        ? `${highestUnsubMarket.country} at ${formatKlaviyoPercent(highestUnsubMarket.unsubRate, 2)} unsub`
        : biggestGap
          ? `${getKlaviyoEffectiveMissingMarkets(biggestGap).length} missing markets`
          : "--",
      tone: highestUnsubMarket || biggestGap ? "danger" : "success"
    }
  ];

  node.innerHTML = cards.map((card, index) => `
    <article class="klaviyo-highlight-card tone-${escapeHtml(card.tone)}">
      <span class="section-label">${escapeHtml(card.title)}</span>
      <strong class="klaviyo-highlight-value">${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `).join("");
}

function renderKlaviyoCampaignList(groups) {
  const node = document.getElementById("klaviyo-campaign-list");
  const metaNode = document.getElementById("klaviyo-campaigns-meta");
  if (!node) return;
  if (metaNode) {
    const sourceLabel = getKlaviyoSourceLabel();
    metaNode.textContent = groups.length
      ? `${groups.length} families · ${sourceLabel}`
      : "No families";
  }

  if (!groups.length) {
    node.innerHTML = `<div class="empty-state">No campaigns matched the current Klaviyo filters.</div>`;
    return;
  }

  node.innerHTML = groups.map((group, index) => {
    const signal = buildCampaignOperatorSignal(group);
    const aiDiagnosis = getKlaviyoAiCampaignDiagnosis(group.campaignName);
    const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
    return `
    <details class="klaviyo-campaign-card tone-${escapeHtml(signal.riskTone)}" data-campaign-family="${escapeHtml(group.campaignName)}" ${group.campaignName === getFocusedCampaignGroup(groups)?.campaignName ? "open" : ""}>
      <summary>
        <div class="klaviyo-campaign-main">
          <div class="klaviyo-campaign-headline">
            <span class="klaviyo-campaign-rank">Family ${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
            <strong>${escapeHtml(group.campaignName)}</strong>
            <div class="klaviyo-flow-pills">
              <span class="klaviyo-flow-pill tone-${escapeHtml(signal.riskTone)}">${escapeHtml(signal.riskLabel)}</span>
              <span class="klaviyo-flow-pill tone-${escapeHtml(missingMarkets.length ? "warning" : "success")}">${escapeHtml(missingMarkets.length ? `${missingMarkets.length} missing` : "Full coverage")}</span>
              <span class="klaviyo-flow-pill">${escapeHtml(`Top market ${signal.topRevenueMarket?.country || "--"}`)}</span>
              <span class="klaviyo-flow-pill">${escapeHtml(formatKlaviyoDate(group.lastSent))}</span>
            </div>
          </div>
          <span class="campaign-status ${missingMarkets.length === 0 ? "" : "attention"}">
            ${Math.max(0, getTotalKlaviyoMarkets() - missingMarkets.length)}/${getTotalKlaviyoMarkets()} expected markets
          </span>
        </div>
        <div class="klaviyo-campaign-metrics">
          <div><span>Sent</span><strong>${escapeHtml(formatKlaviyoNumber(group.sentTotal, 0))}</strong></div>
          <div><span>Open</span><strong>${escapeHtml(formatKlaviyoPercent(group.openRateWeighted))}</strong></div>
          <div><span>Click</span><strong>${escapeHtml(formatKlaviyoPercent(group.clickRateWeighted))}</strong></div>
          <div><span>Revenue</span><strong>${escapeHtml(formatKlaviyoCurrency(group.revenueTotal))}</strong></div>
          <div><span>Unsub</span><strong>${escapeHtml(formatKlaviyoPercent(group.unsubRateWeighted, 2))}</strong></div>
          <div><span>Last sent</span><strong>${escapeHtml(formatKlaviyoDate(group.lastSent))}</strong></div>
        </div>
      </summary>
        <div class="klaviyo-campaign-expanded">
        <div class="klaviyo-operator-strip tone-${escapeHtml(signal.riskTone)}">
          <div>
            <span class="section-label">Action</span>
            <strong>${escapeHtml(aiDiagnosis?.recommendedAction || signal.primaryAction)}</strong>
          </div>
          <div>
            <span class="section-label">Top</span>
            <strong>${escapeHtml(signal.topRevenueMarket ? `${signal.topRevenueMarket.country} · ${formatKlaviyoCurrency(signal.topRevenueMarket.revenue)}` : "--")}</strong>
          </div>
        </div>
        ${missingMarkets.length ? `
          <div class="klaviyo-missing-markets">
            <span class="section-label">Missing</span>
            <strong>${escapeHtml(missingMarkets.join(", "))}</strong>
          </div>
        ` : `
          <div class="klaviyo-missing-markets">
            <span class="section-label">Coverage</span>
            <strong>All ${getTotalKlaviyoMarkets()} live</strong>
          </div>
        `}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Sent</th>
                <th>Open rate</th>
                <th>Click rate</th>
                <th>Revenue</th>
                <th>Unsub rate</th>
                <th>Send date</th>
              </tr>
            </thead>
            <tbody>
              ${group.markets.map((market) => `
                <tr>
                  <td>${escapeHtml(market.country)}</td>
                  <td>${escapeHtml(formatKlaviyoNumber(market.sent, 0))}</td>
                  <td>${escapeHtml(formatKlaviyoPercent(market.openRate))}</td>
                  <td>${escapeHtml(formatKlaviyoPercent(market.clickRate))}</td>
                  <td>${escapeHtml(formatKlaviyoCurrency(market.revenue))}</td>
                  <td>${escapeHtml(formatKlaviyoPercent(market.unsubRate, 2))}</td>
                  <td>${escapeHtml(formatKlaviyoDate(market.sendTime))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  `;
  }).join("");

  node.querySelectorAll(".klaviyo-campaign-card").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      const family = detail.getAttribute("data-campaign-family") || "";
      if (!family) return;

      if (detail.open) {
        if (family !== appState.klaviyoCampaignFocus) {
          appState.klaviyoCampaignFocus = family;
        }
        return;
      }

      if (family === appState.klaviyoCampaignFocus) {
        appState.klaviyoCampaignFocus = "";
      }
    });
  });
}

function renderKlaviyoFlowList(groups) {
  const node = document.getElementById("klaviyo-flow-list");
  const metaNode = document.getElementById("klaviyo-flows-meta");
  if (!node) return;
  if (!hasLiveKlaviyoFlowData()) {
    if (metaNode) {
      metaNode.textContent = "Flow tab is hidden until live flow data is available.";
    }
    node.innerHTML = `<div class="empty-state">Live flow data is not available yet.</div>`;
    return;
  }
  if (metaNode) {
    const allLiveGroups = buildKlaviyoFlowGroups();
    const utilityCount = allLiveGroups.filter((group) => group.flowCategory === "utility").length;
    const sourceLabel = getKlaviyoSourceLabel();
    metaNode.textContent = groups.length
      ? `${groups.length} ${getFlowCategoryLabel(appState.klaviyoFlowCategory).toLowerCase()} · ${sourceLabel}`
      : "No flows";
  }

  if (!groups.length) {
    node.innerHTML = `<div class="empty-state">No flows matched the current Klaviyo filters.</div>`;
    return;
  }

  node.innerHTML = groups.map((group) => {
    const flowSignal = buildFlowOperatorSignal(group);
    const actionRail = flowSignal.actionRail;
    const aiDiagnosis = getKlaviyoAiFlowDiagnosis(group.campaignName);
    const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
    const coverageLabel = missingMarkets.length
      ? `${missingMarkets.length} missing`
      : "Full coverage";
    const latestLiveMarket = (group.markets || [])
      .slice()
      .sort((a, b) => new Date(b.sendTime || 0) - new Date(a.sendTime || 0))[0];
    return `
      <details class="klaviyo-campaign-card">
        <summary>
          <div class="klaviyo-campaign-main">
            <div class="klaviyo-flow-title">
              <strong>${escapeHtml(group.campaignName)}</strong>
              <div class="klaviyo-flow-pills">
                <span class="klaviyo-flow-pill tone-${escapeHtml(flowSignal.riskTone)}">${escapeHtml(flowSignal.riskLabel)}</span>
                <span class="klaviyo-flow-pill tone-${escapeHtml(group.flowHealth.tone)}">${escapeHtml(group.flowHealth.label)}</span>
                <span class="klaviyo-flow-pill tone-${escapeHtml(missingMarkets.length ? "warning" : "success")}">${escapeHtml(coverageLabel)}</span>
                <span class="klaviyo-flow-pill">${escapeHtml(formatKlaviyoDate(group.lastSent))}</span>
              </div>
            </div>
            <span class="campaign-status ${missingMarkets.length === 0 ? "" : "attention"}">
              ${Math.max(0, getTotalKlaviyoMarkets() - missingMarkets.length)}/${getTotalKlaviyoMarkets()} expected markets
            </span>
        </div>
        <div class="klaviyo-campaign-metrics">
          <div><span>Sent</span><strong>${escapeHtml(formatKlaviyoNumber(group.sentTotal, 0))}</strong></div>
          <div><span>Open</span><strong>${escapeHtml(formatKlaviyoPercent(group.openRateWeighted))}</strong></div>
          <div><span>Revenue</span><strong>${escapeHtml(formatKlaviyoCurrency(group.revenueTotal))}</strong></div>
          <div><span>Health</span><strong>${escapeHtml(formatKlaviyoNumber(group.flowHealth.score, 0))}</strong></div>
          <div><span>Last live</span><strong>${escapeHtml(latestLiveMarket?.country || "--")}</strong></div>
        </div>
        </summary>
        <div class="klaviyo-campaign-expanded">
        <div class="klaviyo-operator-strip tone-${escapeHtml(flowSignal.riskTone)}">
          <div>
            <span class="section-label">Action</span>
            <strong>${escapeHtml(aiDiagnosis?.recommendedAction || actionRail.fixMarket)}</strong>
          </div>
          <div>
            <span class="section-label">Watch</span>
            <strong>${escapeHtml(aiDiagnosis?.likelyCause || `${formatKlaviyoPercent(group.openRateWeighted)} open · ${formatKlaviyoPercent(group.unsubRateWeighted, 2)} unsub`)}</strong>
          </div>
        </div>
        ${missingMarkets.length ? `
          <div class="klaviyo-missing-markets">
            <span class="section-label">Missing</span>
            <strong>${escapeHtml(missingMarkets.join(", "))}</strong>
          </div>
        ` : `
          <div class="klaviyo-missing-markets">
            <span class="section-label">Coverage</span>
            <strong>All ${getTotalKlaviyoMarkets()} live</strong>
          </div>
        `}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Sent</th>
                <th>Open</th>
                <th>Revenue</th>
                <th>State</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              ${group.markets.map((market) => `
                <tr>
                  <td>${escapeHtml(market.country)}</td>
                  <td>${escapeHtml(formatKlaviyoNumber(market.sent, 0))}</td>
                  <td>${escapeHtml(formatKlaviyoPercent(market.openRate))}</td>
                  <td>${escapeHtml(formatKlaviyoCurrency(market.revenue))}</td>
                  <td>${escapeHtml(market.status === "live_no_send" ? "Live / no send" : "Sending")}</td>
                  <td>${escapeHtml(formatKlaviyoDate(market.sendTime))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  `;
  }).join("");
}

function buildFlowAnomalyCards(groups) {
  const totalMarkets = (appState.klaviyoMarkets || []).length || 1;
  const previousSnapshot = getPreviousFlowSnapshotMap();
  const anomalies = [];

  groups.forEach((group) => {
    const understanding = buildFlowUnderstanding(group);
    const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
    const expectedActiveMarkets = Math.max(0, totalMarkets - missingMarkets.length);
    const markets = Array.isArray(group.markets) ? group.markets : [];
    const sentValues = markets.map((market) => market.sent || 0).filter((value) => value > 0);
    const medianSent = getMedianNumber(sentValues);
    const worstOpen = markets.slice().sort((a, b) => (a.openRate || 0) - (b.openRate || 0))[0];
    const highestUnsub = markets.slice().sort((a, b) => (b.unsubRate || 0) - (a.unsubRate || 0))[0];
    const sendSpike = markets
      .filter((market) => medianSent > 0)
      .sort((a, b) => ((b.sent || 0) / medianSent) - ((a.sent || 0) / medianSent))[0];
    const sendDrop = markets
      .filter((market) => medianSent > 0 && (market.sent || 0) > 0)
      .sort((a, b) => ((a.sent || 0) / medianSent) - ((b.sent || 0) / medianSent))[0];

    if (understanding.coverageSensitive && missingMarkets.length > 0) {
      anomalies.push({
        score: 100 - (expectedActiveMarkets / totalMarkets) * 100,
        title: "Flow not sending everywhere",
        flowFamily: group.campaignName,
        body: `${group.campaignName} is only active in ${expectedActiveMarkets}/${totalMarkets} expected markets. Missing: ${missingMarkets.join(", ")}.`
      });
    }

    if (worstOpen && group.openRateWeighted - worstOpen.openRate >= 12) {
      anomalies.push({
        score: group.openRateWeighted - worstOpen.openRate,
        title: "Performance drop",
        flowFamily: group.campaignName,
        body: `${worstOpen.country} is ${formatKlaviyoPercent(group.openRateWeighted - worstOpen.openRate, 1)} below the flow's average open rate on ${group.campaignName}.`
      });
    }

    if (highestUnsub && highestUnsub.unsubRate >= Math.max(group.unsubRateWeighted * 1.8, 0.4)) {
      anomalies.push({
        score: highestUnsub.unsubRate,
        title: "Unsub anomaly",
        flowFamily: group.campaignName,
        body: `${highestUnsub.country} is spiking to ${formatKlaviyoPercent(highestUnsub.unsubRate, 2)} unsub rate on ${group.campaignName}.`
      });
    }

    if (sendSpike && medianSent > 0 && (sendSpike.sent || 0) >= medianSent * 1.9) {
      anomalies.push({
        score: (sendSpike.sent || 0) / medianSent,
        title: "Sending spike",
        flowFamily: group.campaignName,
        body: `${sendSpike.country} is sending ${(sendSpike.sent || 0).toLocaleString()} on ${group.campaignName}, far above the typical flow volume across markets.`
      });
    }

    if (sendDrop && medianSent > 0 && (sendDrop.sent || 0) <= medianSent * 0.35) {
      anomalies.push({
        score: medianSent / Math.max(sendDrop.sent || 1, 1),
        title: "Sending drop",
        flowFamily: group.campaignName,
        body: `${sendDrop.country} is only sending ${(sendDrop.sent || 0).toLocaleString()} on ${group.campaignName}, well below the normal market level for this flow.`
      });
    }

    const previous = previousSnapshot.get(group.campaignName);
    if (previous) {
      const sentDelta = (group.sentTotal || 0) - (previous.sentTotal || 0);
      const openDelta = (group.openRateWeighted || 0) - (previous.openRateWeighted || 0);
      const revenueDelta = (group.revenueTotal || 0) - (previous.revenueTotal || 0);

      if ((previous.sentTotal || 0) > 0 && sentDelta <= -(previous.sentTotal * 0.45)) {
        anomalies.push({
          score: Math.abs(sentDelta),
          title: "Historical send drop",
          flowFamily: group.campaignName,
          body: `${group.campaignName} is down ${formatKlaviyoNumber(Math.abs(sentDelta), 0)} sends versus the previous flow snapshot.`
        });
      }

      if ((previous.openRateWeighted || 0) > 0 && openDelta <= -8) {
        anomalies.push({
          score: Math.abs(openDelta),
          title: "Historical open-rate drop",
          flowFamily: group.campaignName,
          body: `${group.campaignName} fell ${formatKlaviyoPercent(Math.abs(openDelta), 1)} in weighted open rate versus the previous snapshot.`
        });
      }

      if ((previous.revenueTotal || 0) > 0 && revenueDelta <= -(previous.revenueTotal * 0.4)) {
        anomalies.push({
          score: Math.abs(revenueDelta),
          title: "Historical revenue drop",
          flowFamily: group.campaignName,
          body: `${group.campaignName} is down ${formatKlaviyoCurrency(Math.abs(revenueDelta))} in revenue versus the previous snapshot.`
        });
      }
    }
  });

  return anomalies
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function renderKlaviyoFlowCommandGrid(groups) {
  return groups;
}

function renderKlaviyoFlowFocus(groups) {
  const node = document.getElementById("klaviyo-flow-focus");
  if (!node) return;

  const items = getMorningCheckFlowGroups(groups);
  if (!items.length) {
    node.innerHTML = `<article class="klaviyo-flow-focus-card empty"><strong>No core automation flows</strong><p>The current flow filter does not contain any broad, always-on automations to show in the morning check.</p></article>`;
    return;
  }

  const group = getFocusedFlowGroup(items);
  appState.klaviyoFlowFocus = group.campaignName;
  const activeFlows = items.filter((flow) => (flow.sentTotal || 0) > 0);
  const silentFlows = items.filter((flow) => (flow.sentTotal || 0) === 0);
  const atRiskFlows = items.filter((flow) => (flow.flowHealth?.label || "") === "At risk");
  const watchFlows = items.filter((flow) => (flow.flowHealth?.label || "") === "Watch");
  const totalRevenue = items.reduce((sum, flow) => sum + (flow.revenueTotal || 0), 0);
  const topRevenueFlow = items.slice().sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))[0];
  const widestCoverageFlow = items.slice().sort((a, b) => (b.activeMarkets || 0) - (a.activeMarkets || 0))[0];
  const topRiskFlow = atRiskFlows[0] || watchFlows.slice().sort((a, b) => (a.flowHealth?.score || 0) - (b.flowHealth?.score || 0))[0] || null;
  const statusTone = atRiskFlows.length ? "danger" : silentFlows.length ? "warning" : watchFlows.length ? "warning" : "success";
  const statusLabel = atRiskFlows.length ? "ISSUE" : silentFlows.length ? "SILENT" : watchFlows.length ? "WATCH" : "OK";

  const overviewLine = atRiskFlows.length
    ? `${atRiskFlows.length} flow${atRiskFlows.length === 1 ? "" : "s"} need action.`
    : silentFlows.length
      ? `${silentFlows.length} live flow${silentFlows.length === 1 ? "" : "s"} are silent.`
      : watchFlows.length
        ? `${watchFlows.length} flow${watchFlows.length === 1 ? "" : "s"} should be watched.`
        : "Stable.";

  const compactSignals = [
    {
      label: "Issue",
      value: topRiskFlow ? topRiskFlow.campaignName : "None",
      meta: topRiskFlow
        ? `${formatKlaviyoPercent(topRiskFlow.openRateWeighted)} open · ${formatKlaviyoPercent(topRiskFlow.unsubRateWeighted, 2)} unsub`
        : "Clear"
    },
    {
      label: "Revenue",
      value: topRevenueFlow ? topRevenueFlow.campaignName : "--",
      meta: topRevenueFlow ? formatKlaviyoCurrency(topRevenueFlow.revenueTotal) : "--"
    },
    {
      label: "Coverage",
      value: widestCoverageFlow ? widestCoverageFlow.campaignName : "--",
      meta: widestCoverageFlow ? `${formatKlaviyoNumber(widestCoverageFlow.activeMarkets, 0)}/${formatKlaviyoNumber((appState.klaviyoMarkets || []).length, 0)} markets` : "--"
    }
  ];

  node.innerHTML = `
    <article class="klaviyo-flow-focus-card tone-${escapeHtml(statusTone)}">
      <div class="klaviyo-flow-focus-head">
        <div class="klaviyo-flow-focus-title">
          <p class="section-label">Flow overview</p>
          <h4>Morning check</h4>
          <div class="klaviyo-flow-pills">
            <span class="klaviyo-flow-pill tone-${escapeHtml(statusTone)}">${escapeHtml(statusLabel)}</span>
          </div>
          <p>${escapeHtml(overviewLine)}</p>
        </div>
        <div class="klaviyo-flow-focus-kpis">
          <div><span>Live</span><strong>${escapeHtml(formatKlaviyoNumber(items.length, 0))}</strong></div>
          <div><span>Sending</span><strong>${escapeHtml(formatKlaviyoNumber(activeFlows.length, 0))}</strong></div>
          <div><span>Watch</span><strong>${escapeHtml(formatKlaviyoNumber(atRiskFlows.length + watchFlows.length + silentFlows.length, 0))}</strong></div>
        </div>
      </div>
      <div class="klaviyo-flow-focus-grid">
        ${compactSignals.map((card) => `
          <article class="tone-${escapeHtml(card.label === "Issue" ? statusTone : card.label === "Revenue" ? "success" : "warning")}">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <p>${escapeHtml(card.meta)}</p>
          </article>
        `).join("")}
      </div>
      <div class="klaviyo-flow-focus-footer">
        <div><span>Revenue</span><strong>${escapeHtml(formatKlaviyoCurrency(totalRevenue))}</strong></div>
        <div><span>Focus</span><strong>${escapeHtml(group.campaignName)}</strong></div>
      </div>
    </article>
  `;
}

function buildFlowAttentionItems(groups) {
  const coreGroups = getMorningCheckFlowGroups(groups);
  const items = [];
  const totalMarkets = (appState.klaviyoMarkets || []).length || 1;
  const anomalyItems = buildFlowAnomalyCards(coreGroups).map((item) => ({
    score: item.score,
    title: item.title,
    body: item.body,
    flowFamily: item.flowFamily || ""
  }));

  coreGroups.forEach((group) => {
    const understanding = buildFlowUnderstanding(group);
    const missingMarkets = getKlaviyoEffectiveMissingMarkets(group);
    if ((group.sentTotal || 0) === 0 && (group.activeMarkets || 0) >= Math.max(3, Math.floor(totalMarkets * 0.5))) {
      items.push({
        score: 100 - (group.flowHealth?.score || 0),
        title: "Live but silent",
        flowFamily: group.campaignName,
        body: `${group.campaignName} is live in ${group.activeMarkets}/${totalMarkets} markets but sent 0 emails in the current range.`
      });
    }
    if (understanding.coverageSensitive && missingMarkets.length >= 4) {
      items.push({
        score: missingMarkets.length * 2,
        title: "Coverage gap",
        flowFamily: group.campaignName,
        body: `${group.campaignName} is missing ${missingMarkets.length} expected markets: ${missingMarkets.slice(0, 6).join(", ")}${missingMarkets.length > 6 ? "..." : ""}.`
      });
    }
    if ((group.sentTotal || 0) > 0 && (group.flowHealth?.score || 0) < 42) {
      items.push({
        score: 100 - (group.flowHealth?.score || 0),
        title: "Protect this flow",
        flowFamily: group.campaignName,
        body: `${group.campaignName} is at risk with ${formatKlaviyoPercent(group.openRateWeighted)} open, ${formatKlaviyoPercent(group.clickRateWeighted)} click and ${formatKlaviyoPercent(group.unsubRateWeighted, 2)} unsub.`
      });
    }
  });

  const ignored = new Set(appState.ignoredFlowSuggestionKeys || []);
  return [...items, ...anomalyItems]
    .map((item) => ({
      ...item,
      key: item.flowFamily
        ? `flow::${String(item.flowFamily).trim().toLowerCase()}`
        : getFlowSuggestionKey(item.title, item.body)
    }))
      .filter((item) => !ignored.has(item.key))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
}

function buildFlowJourneyMap(groups) {
  const stageOrder = ["Acquisition", "Consideration", "Activation", "Retention", "Reactivation", "Purchase", "Hygiene", "Lifecycle"];
  const totalMarkets = Math.max(1, getTotalKlaviyoMarkets());
  const buckets = new Map();

  groups.forEach((group) => {
    const understanding = buildFlowUnderstanding(group);
    const stageKey = understanding.stage || "Lifecycle";
    const current = buckets.get(stageKey) || {
      stage: stageKey,
      flows: [],
      activeMarkets: 0,
      sentTotal: 0,
      revenueTotal: 0,
      atRisk: 0,
      silent: 0,
      coverageSensitive: 0
    };
    current.flows.push(group);
    current.activeMarkets += Number(group.activeMarkets || 0);
    current.sentTotal += Number(group.sentTotal || 0);
    current.revenueTotal += Number(group.revenueTotal || 0);
    current.atRisk += (group.flowHealth?.score || 0) < 42 ? 1 : 0;
    current.silent += (group.sentTotal || 0) === 0 ? 1 : 0;
    current.coverageSensitive += understanding.coverageSensitive ? 1 : 0;
    buckets.set(stageKey, current);
  });

  return stageOrder
    .filter((stage) => buckets.has(stage))
    .map((stage) => {
      const bucket = buckets.get(stage);
      const flowCount = bucket.flows.length;
      const avgCoverage = flowCount ? bucket.activeMarkets / (flowCount * totalMarkets) : 0;
      const topFlow = bucket.flows.slice().sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))[0];
      const status = bucket.atRisk > 0
        ? "Watch"
        : bucket.silent === flowCount
          ? "Quiet"
          : avgCoverage >= 0.8
            ? "Covered"
            : "Partial";
      const note = bucket.atRisk > 0
        ? `${bucket.atRisk} flow${bucket.atRisk === 1 ? "" : "s"} at risk`
        : bucket.silent === flowCount
          ? "No active sends in range"
          : avgCoverage >= 0.8
            ? "Broad coverage"
            : `${Math.round(avgCoverage * 100)}% coverage`;

      return {
        stage,
        flowCount,
        avgCoverage,
        revenueTotal: bucket.revenueTotal,
        topFlow: topFlow?.campaignName || "",
        topFlowRevenue: topFlow?.revenueTotal || 0,
        status,
        note,
        coverageSensitive: bucket.coverageSensitive
      };
    });
}

function renderKlaviyoFlowJourneyMap(groups) {
  const node = document.getElementById("klaviyo-flow-journey-map");
  if (!node) return;
  if (!groups.length) {
    node.innerHTML = "";
    return;
  }

  const stages = buildFlowJourneyMap(groups);
  if (!stages.length) {
    node.innerHTML = "";
    return;
  }

  node.innerHTML = `
    <div class="agent-list-head">
      <strong>Flow stages</strong>
      ${appState.klaviyoFlowStage !== "all" ? `<button class="ghost-button small" type="button" data-clear-flow-stage="true">Show all stages</button>` : ""}
    </div>
    <div class="klaviyo-journey-grid">
      ${stages.map((item) => `
        <button type="button" class="overview-card klaviyo-journey-card ${item.status === "Watch" ? "tone-awareness" : item.stage === "Retention" || item.stage === "Activation" ? "tone-conversion" : "tone-leads"} ${appState.klaviyoFlowStage === item.stage ? "is-active" : ""}" data-flow-stage="${escapeHtml(item.stage)}" data-stage-status="${escapeHtml(item.status.toLowerCase())}" aria-pressed="${appState.klaviyoFlowStage === item.stage ? "true" : "false"}">
          <p class="section-label">${escapeHtml(item.stage)}</p>
          <span class="klaviyo-journey-status">${escapeHtml(item.status)}</span>
          <div class="overview-metric">${escapeHtml(formatKlaviyoNumber(item.flowCount, 0))}</div>
          <p class="field-hint">${escapeHtml(item.note)}</p>
          <div class="overview-list">
            <div class="overview-item">
              <span>Coverage</span>
              <strong>${escapeHtml(formatKlaviyoPercent(item.avgCoverage * 100, 0))}</strong>
            </div>
            <div class="overview-item">
              <span>Leader</span>
              <strong>${escapeHtml(item.topFlow ? item.topFlow : "--")}</strong>
            </div>
          </div>
        </button>
      `).join("")}
    </div>
  `;

  node.querySelector("[data-clear-flow-stage]")?.addEventListener("click", () => {
    appState.klaviyoFlowStage = "all";
    appState.klaviyoFlowFocus = "";
    renderKlaviyoWorkspace();
  });

  node.querySelectorAll("[data-flow-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextStage = button.getAttribute("data-flow-stage") || "all";
      appState.klaviyoFlowStage = appState.klaviyoFlowStage === nextStage ? "all" : nextStage;
      appState.klaviyoFlowFocus = "";
      renderKlaviyoWorkspace();
    });
  });
}

function renderKlaviyoFlowAttention(groups) {
  const node = document.getElementById("klaviyo-flow-attention");
  if (!node) return;

  const items = buildFlowAttentionItems(groups).slice(0, 2);
  const ignoredCount = (appState.ignoredFlowSuggestionKeys || []).length;
  if (!items.length) {
    node.innerHTML = `
      <article class="agent-item">
        <div class="agent-item-head">
          <strong>Attention</strong>
          ${ignoredCount ? `<button class="ghost-button small agent-reset-button" type="button" data-reset-flow-suggestions="true">Reset ignored</button>` : ""}
        </div>
      </article>
    `;
    node.querySelector("[data-reset-flow-suggestions]")?.addEventListener("click", () => {
      appState.ignoredFlowSuggestionKeys = [];
      persistFlowSuggestionPreferences();
      renderKlaviyoFlowAttention(groups);
    });
    return;
  }

  node.innerHTML = `
    <div class="agent-list-head">
      <strong>Attention</strong>
      ${ignoredCount ? `<button class="ghost-button small agent-reset-button" type="button" data-reset-flow-suggestions="true">Reset ignored</button>` : ""}
    </div>
    ${items.map((item, index) => `
    <article class="agent-item tone-${escapeHtml(/protect|live but silent/i.test(item.title) ? "danger" : /coverage gap|historical/i.test(item.title) ? "warning" : "neutral")} ${index === 0 ? "is-featured" : ""}">
      <div class="agent-item-head">
        <strong>${escapeHtml(item.title)}</strong>
        <button class="ghost-button small agent-ignore-button" type="button" data-ignore-flow-suggestion="${escapeHtml(item.key)}">Ignore</button>
      </div>
      <p>${escapeHtml(compactText(item.body, 110))}</p>
    </article>
  `).join("")}
  `;

  node.querySelectorAll("[data-ignore-flow-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-ignore-flow-suggestion") || "";
      if (!key) return;
      if (!appState.ignoredFlowSuggestionKeys.includes(key)) {
        appState.ignoredFlowSuggestionKeys = [...appState.ignoredFlowSuggestionKeys, key];
        persistFlowSuggestionPreferences();
      }
      renderKlaviyoFlowAttention(groups);
    });
  });
  node.querySelector("[data-reset-flow-suggestions]")?.addEventListener("click", () => {
    appState.ignoredFlowSuggestionKeys = [];
    persistFlowSuggestionPreferences();
    renderKlaviyoFlowAttention(groups);
  });
}

function renderKlaviyoFlowAnomalies(groups) {
  const node = document.getElementById("klaviyo-flow-anomalies");
  if (!node) return;
  if (!hasLiveKlaviyoFlowData()) {
    node.innerHTML = `<article class="agent-item"><strong>Flow anomaly radar</strong><p>Live data required.</p></article>`;
    return;
  }
  const historyReady = getFlowSnapshotHistory().length >= 2;
  const items = buildFlowAnomalyCards(groups);
  const intro = !historyReady
    ? [{
      title: "Baseline warming up",
      body: "Need more syncs."
    }]
    : [];
  if (!items.length) {
    const fallbackItems = intro.length
      ? intro
      : [{ title: "AI anomaly radar", body: "No anomalies." }];
    node.innerHTML = fallbackItems.map((item) => `
      <article class="agent-item">
        <strong>${escapeHtml(item.title)}</strong>
      </article>
    `).join("");
    return;
  }

  node.innerHTML = [...intro, ...items].slice(0, 4).map((item) => `
    <article class="agent-item">
      <strong>${escapeHtml(item.title)}</strong>
    </article>
  `).join("");
}

function renderKlaviyoMarketsPanel(groups) {
  const node = document.getElementById("klaviyo-market-detail-grid");
  if (!node) return;
  const tab = appState.klaviyoDashboardTab || "general";
  const subscriberMap = new Map((appState.klaviyoSubscribers?.markets || []).map((item) => [item.country, item]));
  const latestByMarket = new Map();
  const highestSubscriberCount = Math.max(...(appState.klaviyoSubscribers?.markets || []).map((item) => Number(item.count || 0)), 0);
  const totalSubscribers = Math.max(1, Number(appState.klaviyoSubscribers?.total || 0));

  groups.forEach((group) => {
    (group.markets || []).forEach((market) => {
      const current = latestByMarket.get(market.country);
      if (!current || new Date(current.sendTime) < new Date(market.sendTime)) {
        latestByMarket.set(market.country, {
          ...market,
          campaignName: group.campaignName
        });
      }
    });
  });

  if (tab === "subscribers") {
    const audienceMarkets = getKlaviyoSubscriberMarkets();
    if (!audienceMarkets.length) {
      node.innerHTML = `<div class="empty-state">No subscriber markets were found in the current snapshot.</div>`;
      return;
    }

    node.innerHTML = audienceMarkets.map((item, index) => {
      const permission = buildPermissionMetrics(item.country, appState.klaviyoSubscriberRange || 30);
      const share = ((Number(item.count || 0) / totalSubscribers) * 100) || 0;
      return `
        <article class="klaviyo-market-detail-card ${index === 0 ? "is-featured is-dominant" : ""}">
          <div class="klaviyo-market-detail-head">
            <strong>${escapeHtml(item.country)}</strong>
            <span class="campaign-status">${escapeHtml(item.listName || "Newsletter list")}</span>
          </div>
          <div class="klaviyo-market-detail-metric">
            <span>Subscribers</span>
            <strong>${escapeHtml(formatKlaviyoNumber(item.count || 0, 0))}</strong>
          </div>
          <div class="klaviyo-market-share">
            <div class="klaviyo-market-share-track"><span style="width:${Math.max(4, Math.min(100, share)).toFixed(2)}%"></span></div>
            <strong>${escapeHtml(formatKlaviyoPercent(share, 1))} of total base</strong>
          </div>
          <div class="klaviyo-market-detail-stats">
            <div class="klaviyo-market-stat">
              <span>Net</span>
              <strong>${escapeHtml(permission.netGrowth >= 0 ? `+${formatKlaviyoNumber(permission.netGrowth, 0)}` : formatKlaviyoNumber(permission.netGrowth, 0))}</strong>
            </div>
            <div class="klaviyo-market-stat klaviyo-market-stat-wide">
              <span>Weighted unsub</span>
              <strong>${escapeHtml(formatKlaviyoPercent(permission.unsubRateWeighted, 2))}</strong>
            </div>
            <div class="klaviyo-market-stat klaviyo-market-stat-wide">
              <span>Added / unsubs</span>
              <strong>${escapeHtml(`${formatKlaviyoNumber(permission.subsAdded, 0)} / ${formatKlaviyoNumber(permission.unsubsTotal, 0)}`)}</strong>
            </div>
          </div>
        </article>
      `;
    }).join("");
    return;
  }

  node.innerHTML = (appState.klaviyoMarkets || []).map((country, index) => {
    const subscriber = subscriberMap.get(country);
    const latest = latestByMarket.get(country);
    const permission = buildPermissionMetrics(country, appState.klaviyoSubscriberRange || 30);
    const aiDiagnosis = getKlaviyoAiMarketDiagnosis(country);
    const share = ((Number(subscriber?.count || 0) / totalSubscribers) * 100) || 0;
    return `
      <article class="klaviyo-market-detail-card ${latest ? "is-live" : "is-missing"} ${subscriber && Number(subscriber.count || 0) === highestSubscriberCount && highestSubscriberCount > 0 ? "is-dominant" : ""} ${index === 0 ? "is-featured" : ""}">
        <div class="klaviyo-market-detail-head">
          <strong>${escapeHtml(country)}</strong>
          <span class="campaign-status ${latest ? "" : "attention"}">${latest ? "Live" : "Missing"}</span>
        </div>
        <div class="klaviyo-market-detail-metric">
          <span>Subscribers</span>
          <strong>${escapeHtml(formatKlaviyoNumber(subscriber?.count || 0, 0))}</strong>
        </div>
        <div class="klaviyo-market-share">
          <div class="klaviyo-market-share-track"><span style="width:${Math.max(4, Math.min(100, share)).toFixed(2)}%"></span></div>
          <strong>${escapeHtml(formatKlaviyoPercent(share, 1))} of total list base</strong>
        </div>
        <div class="klaviyo-market-detail-stats">
          <div class="klaviyo-market-stat">
            <span>Net</span>
            <strong>${escapeHtml(permission.netGrowth >= 0 ? `+${formatKlaviyoNumber(permission.netGrowth, 0)}` : formatKlaviyoNumber(permission.netGrowth, 0))}</strong>
          </div>
          <div class="klaviyo-market-stat">
            <span>Unsubs</span>
            <strong>${escapeHtml(`${formatKlaviyoNumber(permission.unsubsTotal, 0)} / ${formatKlaviyoPercent(permission.unsubRateWeighted, 2)}`)}</strong>
          </div>
          <div class="klaviyo-market-stat klaviyo-market-stat-wide">
            <span>Latest</span>
            <strong>${escapeHtml(latest?.campaignName || "No campaign")}</strong>
          </div>
          <div class="klaviyo-market-stat klaviyo-market-stat-wide">
            <span>O / C / U</span>
            <strong>${latest ? `${formatKlaviyoPercent(latest.openRate)} / ${formatKlaviyoPercent(latest.clickRate)} / ${formatKlaviyoPercent(latest.unsubRate, 2)}` : "--"}</strong>
          </div>
        </div>
        ${aiDiagnosis?.explanation ? `
          <div class="klaviyo-ai-inline-note compact">
            <span class="section-label">AI</span>
            <p>${escapeHtml(compactText(aiDiagnosis.explanation, 64))}</p>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

function renderKlaviyoWorkspace() {
  const groups = getFilteredKlaviyoGroups();
  const flowGroups = getFilteredKlaviyoFlowGroups();
  syncKlaviyoRefreshControls();
  syncKlaviyoNavigation();
  syncKlaviyoFlowControls();
  renderKlaviyoDiagnosticsPanel(groups, flowGroups);
  renderKlaviyoCommandCenter(groups, flowGroups);
  renderKlaviyoOverviewMiniGrid(groups);
  renderKlaviyoOverviewHighlights(groups);
  renderKlaviyoCampaignList(groups);
  renderKlaviyoFlowFocus(flowGroups);
  renderKlaviyoFlowJourneyMap(flowGroups);
  renderKlaviyoFlowAttention(flowGroups);
  renderKlaviyoFlowList(flowGroups);
  renderKlaviyoSubscriberSection();
  renderKlaviyoMarketsPanel(groups);
  renderKlaviyoDuplicateTranslate();
  renderKlaviyoCampaignAi();
  renderCampaignBrainPanel();
  syncKlaviyoDashboardSubtabs();
}

function syncKlaviyoRefreshControls() {
  const button = document.getElementById("klaviyo-refresh-button");
  if (!button) return;
  button.disabled = appState.klaviyoLoading;
  button.textContent = appState.klaviyoLoading ? "Refreshing..." : "Refresh data";
}

function applyKlaviyoSnapshot(snapshot, source = "live") {
  const hasCampaigns = Array.isArray(snapshot?.campaignGroups) && snapshot.campaignGroups.length > 0;
  const hasFlows = Array.isArray(snapshot?.flowGroups) && snapshot.flowGroups.length > 0;
  const hasSubscribers = Array.isArray(snapshot?.subscribers?.markets) && snapshot.subscribers.markets.length > 0;
  const hasFlowSnapshots = Array.isArray(snapshot?.flowSnapshots) && snapshot.flowSnapshots.length > 0;

  if (!snapshot || (!hasCampaigns && !hasFlows && !hasSubscribers)) {
    return false;
  }

  const normalizedCampaignGroups = hasCampaigns ? normalizeKlaviyoRevenueGroups(snapshot.campaignGroups) : appState.klaviyoCampaignGroups;
  const normalizedFlowGroups = hasFlows ? normalizeKlaviyoRevenueGroups(snapshot.flowGroups) : appState.klaviyoFlowGroups;

  appState.klaviyoCampaignGroups = normalizedCampaignGroups;
  appState.klaviyoFlowGroups = normalizedFlowGroups;
  appState.klaviyoFlowSnapshots = hasFlowSnapshots ? snapshot.flowSnapshots : appState.klaviyoFlowSnapshots;
  appState.klaviyoMarkets = Array.isArray(snapshot.markets) && snapshot.markets.length ? snapshot.markets : appState.klaviyoMarkets;
  if (hasSubscribers) {
    const incomingSubscribers = snapshot.subscribers || {};
    const nextCountSource = String(incomingSubscribers.countSource || "").trim()
      || (source === "snapshot" ? "snapshot" : "");
    const nextHistorySource = String(incomingSubscribers.historySource || "").trim()
      || ((incomingSubscribers.timeline || incomingSubscribers.snapshots || source === "snapshot") ? "snapshot_history" : "unavailable");
    const nextHistoryGeneratedAt = String(incomingSubscribers.historyGeneratedAt || "").trim()
      || (nextHistorySource === "snapshot_history" ? String(snapshot.generatedAt || "") : "");

    appState.klaviyoSubscribers = {
      total: Number(incomingSubscribers.total || 0),
      markets: Array.isArray(incomingSubscribers.markets) ? incomingSubscribers.markets : [],
      timeline: incomingSubscribers.timeline || null,
      snapshots: incomingSubscribers.snapshots || null,
      countSource: nextCountSource,
      historySource: nextHistorySource,
      historyGeneratedAt: nextHistoryGeneratedAt
    };
  }
  appState.klaviyoDataSource = source;
  appState.klaviyoGeneratedAt = snapshot.generatedAt || "";
  return true;
}

function updateKlaviyoRefreshStatus(message, tone = "") {
  const node = document.getElementById("klaviyo-refresh-status");
  if (!node) return;
  node.textContent = message;
  node.classList.remove("online", "warning");
  if (tone) {
    node.classList.add(tone);
  }
}

function getKlaviyoSourceLabel() {
  if (appState.klaviyoLoading) {
    return "Loading...";
  }
  if (appState.klaviyoDataSource === "live") {
    return `Live${appState.klaviyoGeneratedAt ? ` · ${formatKlaviyoDate(appState.klaviyoGeneratedAt)}` : ""}`;
  }
  if (appState.klaviyoDataSource === "snapshot") {
    return `Snapshot${appState.klaviyoGeneratedAt ? ` · ${formatKlaviyoDate(appState.klaviyoGeneratedAt)}` : ""}`;
  }
  if (appState.klaviyoError) {
    return `Mock · ${appState.klaviyoError}`;
  }
  return "Mock";
}

function setKlaviyoView(nextView = "overview") {
  const requestedView = ["dashboard", "duplicate_translate", "campaign_ai", "campaign_brain"].includes(nextView) ? nextView : "dashboard";
  appState.klaviyoView = requestedView;
  document.querySelectorAll("[data-klaviyo-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.klaviyoView === appState.klaviyoView);
  });
  document.getElementById("klaviyo-dashboard-panel")?.classList.toggle("active", appState.klaviyoView === "dashboard");
  document.getElementById("klaviyo-duplicate-translate-panel")?.classList.toggle("active", appState.klaviyoView === "duplicate_translate");
  document.getElementById("klaviyo-campaign-ai-panel")?.classList.toggle("active", appState.klaviyoView === "campaign_ai");
  document.getElementById("klaviyo-campaign-brain-panel")?.classList.toggle("active", appState.klaviyoView === "campaign_brain");
  if (appState.klaviyoView === "duplicate_translate") {
    loadKlaviyoTemplateCatalog();
  }
  if (appState.klaviyoView === "campaign_ai") {
    loadKlaviyoTemplateCatalog();
  }
  if (appState.klaviyoView === "campaign_brain") {
    loadCampaignAsanaWorkspace();
    loadContentAgentStatus();
    if (appState.campaignStudioMode === "meta_master") loadCampaignMetaMasterTemplates();
  }
}

function formatContentAgentTime(value = "") {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return "Not run yet";
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(parsed));
}

const CAMPAIGN_STUDIO_MIN_SCORE = 70;

function getContentAgentJobQualityScore(job = null) {
  const iterations = Array.isArray(job?.qualityIterations) ? job.qualityIterations : [];
  const latestIteration = iterations.at(-1) || {};
  return Number(
    job?.output?.qualityAudit?.score
    ?? latestIteration?.gate?.score
    ?? latestIteration?.review?.overallScore
    ?? 0
  );
}

function isContentAgentJobStudioEligible(job = null) {
  return Boolean(
    job?.output?.artifactPack?.artifacts
    && ["ready_for_review", "quality_blocked"].includes(job?.state)
    && getContentAgentJobQualityScore(job) >= CAMPAIGN_STUDIO_MIN_SCORE
  );
}

function getContentAgentStateLabel(state = "", job = null) {
  if (state === "quality_blocked" && isContentAgentJobStudioEligible(job)) return "Studio draft · quality blocked";
  if (state === "queued" && job?.checkpoint) return "Revision queued";
  if (state === "failed") {
    const jobPipelineVersion = Number(String(job?.asanaVersion || "").match(/\|pipeline:(\d+)$/)?.[1] || 0);
    return jobPipelineVersion === Number(appState.contentAgent?.health?.pipelineVersion || 0) ? "Recovery available" : "Archived failure";
  }
  return ({
    queued: "Queued",
    analysing: "Analysing",
    producing: "Producing",
    quality_review: "Quality review",
    ready_for_review: "Ready for review",
    paused: "Paused",
    quality_blocked: "Quality blocked",
    dead_letter: "Dead letter",
    rejected: "Rejected"
  })[state] || "Waiting";
}

function getContentAgentFocus(job = null, agent = {}) {
  if (agent.loading && !job) {
    return { phase: "SCOUTING", sentence: "Checking Asana for the next brief.", step: 0 };
  }
  if (!job) {
    return { phase: "ON WATCH", sentence: "Waiting for the next campaign.", step: 0 };
  }
  if (isContentAgentJobStudioEligible(job)) {
    if (job.state === "quality_blocked") {
      return { phase: "STUDIO DRAFT", sentence: `Editable at ${getContentAgentJobQualityScore(job)}/100. Quality blockers remain visible.`, step: 4 };
    }
    return { phase: "READY FOR YOU", sentence: "The campaign is ready for your eye.", step: 4 };
  }
  if (job.state === "paused") {
    return { phase: "PAUSED", sentence: "Safely paused by the operator.", step: Math.max(1, Number(job.progress || 0) >= 70 ? 3 : 2) };
  }
  const resumeStage = String(job.resumeStage || job.checkpoint?.resumeStage || "").toLowerCase();
  if (job.state === "quality_review" || resumeStage.includes("quality")) {
    return { phase: "QUALITY", sentence: "Challenging every creative decision.", step: 3 };
  }
  if (resumeStage.includes("revision")) {
    return { phase: "REFINING", sentence: "Reworking the weakest details.", step: 3 };
  }
  if (job.state === "producing" && resumeStage.includes("artifact")) {
    return { phase: "DESIGNING", sentence: "Building the campaign system.", step: 2 };
  }
  if (job.state === "producing") {
    return { phase: "DIRECTION", sentence: "Shaping the creative direction.", step: 1 };
  }
  if (job.state === "analysing") {
    return { phase: "READING", sentence: "Connecting brief, images and intent.", step: 1 };
  }
  if (job.state === "queued") {
    return { phase: "UP NEXT", sentence: "Preparing the campaign workspace.", step: 0 };
  }
  return { phase: "ON WATCH", sentence: "Waiting for the next campaign.", step: 0 };
}

function renderContentAgentJob(job) {
  const qualityAudit = job.output?.qualityAudit || null;
  const iterationCount = Array.isArray(job.qualityIterations) ? job.qualityIterations.length : 0;
  const gate = qualityAudit?.gate || null;
  const dimensionFloor = Number(gate?.dimensionFloor || 0);
  const jobPipelineVersion = Number(String(job.asanaVersion || "").match(/\|pipeline:(\d+)$/)?.[1] || 0);
  const recoverable = job.state === "failed" && jobPipelineVersion === Number(appState.contentAgent?.health?.pipelineVersion || 0);
  const rejectConfirm = appState.contentAgent?.rejectConfirmJobId === job.id;
  const rejecting = appState.contentAgent?.rejectingJobId === job.id;
  const controlling = appState.contentAgent?.controllingJobId === job.id;
  const studioEligible = isContentAgentJobStudioEligible(job);
  const studioScore = getContentAgentJobQualityScore(job);
  const qualityMeta = qualityAudit
    ? `${qualityAudit.score || 0}/100 · floor ${dimensionFloor} · ${iterationCount} review${iterationCount === 1 ? "" : "s"}`
    : "";
  const stages = [
    { key: "brief", label: "Brief", done: !["queued"].includes(job.state) || Boolean(job.checkpoint) },
    { key: "create", label: "Create", done: ["quality_review", "ready_for_review", "quality_blocked"].includes(job.state) || Boolean(job.checkpoint) },
    { key: "quality", label: "Quality", done: ["ready_for_review", "quality_blocked"].includes(job.state), active: ["quality_review", "queued"].includes(job.state) && Boolean(job.output) },
    { key: "review", label: "Review", done: job.state === "ready_for_review", active: studioEligible }
  ];
  return `
    <article class="content-agent-job" data-state="${escapeHtml(job.state)}">
      <div class="content-agent-job-main">
        <div class="content-agent-job-heading">
          <span class="content-agent-job-state">${escapeHtml(getContentAgentStateLabel(job.state, job))}</span>
          <span class="content-agent-job-time">${escapeHtml(formatContentAgentTime(job.updatedAt || job.createdAt))}</span>
        </div>
        <strong>${escapeHtml(job.campaignTaskName || "Untitled campaign")}</strong>
        <p>${escapeHtml(job.error || job.statusMessage || "Waiting for the agent.")}</p>
        ${qualityMeta ? `<small class="content-agent-quality-meta">Quality Director · ${escapeHtml(qualityMeta)}</small>` : ""}
        <div class="content-agent-job-flow" aria-label="Production progress">
          ${stages.map((stage) => `<span class="${stage.done ? "is-done" : ""}${stage.active ? " is-active" : ""}"><i></i>${escapeHtml(stage.label)}</span>`).join("")}
        </div>
      </div>
      <div class="content-agent-job-side">
        <span>${escapeHtml(job.source === "manual" ? "Priority run" : "Auto-discovered")}</span>
        <div class="content-agent-progress"><i style="width:${Math.max(0, Math.min(100, Number(job.progress || 0)))}%"></i></div>
        ${studioEligible ? `${job.state === "ready_for_review" && rejectConfirm ? `<input class="content-agent-reject-reason" data-content-agent-reject-reason="${escapeHtml(job.id)}" type="text" maxlength="600" placeholder="What should the AI learn from this rejection?">` : ""}<div class="content-agent-job-review-actions"><button class="content-agent-job-open" type="button" data-content-agent-open="${escapeHtml(job.id)}">${job.state === "quality_blocked" ? `Open Studio draft · ${studioScore}` : "Review in Studio"} <span>→</span></button>${job.state === "ready_for_review" ? `<button class="content-agent-job-reject${rejectConfirm ? " is-confirming" : ""}" type="button" data-content-agent-reject="${escapeHtml(job.id)}"${rejecting ? " disabled" : ""}>${rejecting ? "Restarting…" : rejectConfirm ? "Confirm restart" : "Reject & restart"}<span>${rejectConfirm ? "↻" : "×"}</span></button>` : ""}</div>` : ""}
        ${["queued", "analysing", "producing", "quality_review"].includes(job.state) ? `<button class="content-agent-job-control" type="button" data-content-agent-control="pause" data-content-agent-job="${escapeHtml(job.id)}"${controlling ? " disabled" : ""}>${controlling ? "Pausing…" : "Pause"}<span>Ⅱ</span></button>` : ""}
        ${job.state === "paused" ? `<button class="content-agent-job-control is-resume" type="button" data-content-agent-control="resume" data-content-agent-job="${escapeHtml(job.id)}"${controlling ? " disabled" : ""}>${controlling ? "Resuming…" : "Resume at front"}<span>→</span></button>` : ""}
        ${recoverable ? `<button class="content-agent-job-retry" type="button" data-content-agent-retry="${escapeHtml(job.id)}">Recover run <span>↻</span></button>` : ""}
      </div>
    </article>
  `;
}

function isContentAgentDirectorInteractionActive() {
  const agent = appState.contentAgent || {};
  if (!agent.directorOpen) return false;
  const activeElement = document.activeElement;
  const director = document.querySelector(".content-agent-director.is-open");
  return Boolean(agent.directorInteractionActive || (director && activeElement && director.contains(activeElement)));
}

function getCampaignLearningEventLabel(type = "") {
  return ({
    editor_saved: "Editor decision",
    klaviyo_draft_created: "Klaviyo handoff",
    meta_draft_created: "Meta handoff",
    rejected: "Human rejection",
    performance_snapshot: "Performance evidence"
  })[type] || "Learning signal";
}

function renderCampaignLearningStudio(agent = {}) {
  const learning = agent.learning || {};
  const effectiveness = learning.effectiveness || {};
  const patterns = Array.isArray(learning.patterns) ? learning.patterns : [];
  const events = Array.isArray(learning.events) ? learning.events : [];
  const attributedPerformance = Array.isArray(learning.attributedPerformance) ? learning.attributedPerformance : [];
  const open = Boolean(agent.learningOpen);
  const changeDelta = effectiveness.manualChangeDeltaPercent;
  const trendLabel = !effectiveness.trendReady
    ? `${Math.max(0, Number(effectiveness.minimumForTrend || 6) - Number(effectiveness.measuredCampaignDecisions || 0))} more decisions needed`
    : changeDelta < 0 ? `${Math.abs(changeDelta)}% fewer manual changes` : changeDelta > 0 ? `${changeDelta}% more manual changes` : "No change yet";
  return `
    <section class="campaign-learning-studio${open ? " is-open" : ""}">
      <button class="campaign-learning-studio-toggle" type="button" data-learning-toggle aria-expanded="${open ? "true" : "false"}">
        <span><small>Human learning</small><strong>Learning Studio</strong></span>
        <span class="campaign-learning-studio-summary"><b>${escapeHtml(String(learning.eventCount || 0))}</b> signals · <b>${escapeHtml(String(learning.patternSummary?.established || 0))}</b> established patterns <i>${open ? "−" : "+"}</i></span>
      </button>
      ${open ? `
        <div class="campaign-learning-studio-body">
          <div class="campaign-learning-impact-grid">
            <article><span>Measured decisions</span><strong>${escapeHtml(String(effectiveness.measuredCampaignDecisions || 0))}</strong><small>${escapeHtml(trendLabel)}</small></article>
            <article><span>Draft handoffs</span><strong>${escapeHtml(String(effectiveness.draftHandoffs || 0))}</strong><small>strong approval evidence</small></article>
            <article><span>Human rejections</span><strong>${escapeHtml(String(effectiveness.rejections || 0))}</strong><small>negative evidence</small></article>
            <article><span>Established</span><strong>${escapeHtml(String(learning.patternSummary?.established || 0))}</strong><small>confirmed across 3+ campaigns</small></article>
          </div>
          <div class="campaign-learning-columns">
            <div class="campaign-learning-patterns">
              <header><span>Repeated preferences</span><small>Only 3+ campaigns become guidance rules</small></header>
              ${patterns.length ? patterns.slice(0, 12).map((pattern) => `
                <article data-maturity="${escapeHtml(pattern.maturity || "observed")}">
                  <div><span>${escapeHtml(pattern.channel || "cross-channel")} · ${escapeHtml(pattern.maturity || "observed")}</span><strong>${escapeHtml(String(pattern.path || "").replace(/^finalSelections\./, ""))}</strong><p>${escapeHtml(pattern.value || "")}</p></div>
                  <aside><b>${Math.round(Number(pattern.confidence || 0) * 100)}%</b><small>${escapeHtml(String(pattern.campaignCount || 0))} campaigns</small></aside>
                </article>
              `).join("") : `<div class="campaign-learning-empty"><strong>No repeated pattern yet</strong><p>The first three consistent campaign decisions will establish one.</p></div>`}
            </div>
            <div class="campaign-learning-events">
              <header><span>Evidence ledger</span><small>Approve, pause or remove individual signals</small></header>
              ${events.length ? events.map((event) => {
                const busy = agent.learningBusyId === event.id;
                const deleteConfirm = agent.learningDeleteConfirmId === event.id;
                const status = event.moderationStatus || "active";
                const decisionCount = Number(event.totals?.changed || 0) + Number(event.totals?.added || 0) + Number(event.totals?.removed || 0);
                return `
                  <article data-status="${escapeHtml(status)}">
                    <div class="campaign-learning-event-head"><span>${escapeHtml(getCampaignLearningEventLabel(event.type))}</span><small>${escapeHtml(formatContentAgentTime(event.createdAt))}</small></div>
                    <strong>${escapeHtml(event.campaignName || "Untitled campaign")}</strong>
                    <p>${escapeHtml(event.reason || (decisionCount ? `${decisionCount} deliberate studio decisions recorded.` : event.type === "performance_snapshot" ? "Comparable channel results recorded." : "No structural edits recorded."))}</p>
                    <div class="campaign-learning-event-foot">
                      <span data-status="${escapeHtml(status)}">${escapeHtml(status)}</span>
                      <div>
                        ${status !== "approved" && status !== "disabled" ? `<button type="button" data-learning-operation="approve" data-learning-event="${escapeHtml(event.id)}"${busy ? " disabled" : ""}>Approve</button>` : ""}
                        ${status === "disabled" ? `<button type="button" data-learning-operation="enable" data-learning-event="${escapeHtml(event.id)}"${busy ? " disabled" : ""}>Enable</button>` : `<button type="button" data-learning-operation="disable" data-learning-event="${escapeHtml(event.id)}"${busy ? " disabled" : ""}>Pause</button>`}
                        <button class="is-delete" type="button" data-learning-operation="delete" data-learning-event="${escapeHtml(event.id)}"${busy ? " disabled" : ""}>${deleteConfirm ? "Confirm delete" : "Delete"}</button>
                      </div>
                    </div>
                  </article>`;
              }).join("") : `<div class="campaign-learning-empty"><strong>No evidence yet</strong><p>Save or hand off a reviewed campaign to begin.</p></div>`}
            </div>
          </div>
          ${attributedPerformance.length ? `<div class="campaign-learning-attribution"><header><span>Decision → outcome links</span><small>Directional attribution, not causal proof</small></header><div>${attributedPerformance.slice(0, 6).map((row) => `<article><span>${escapeHtml(row.channel || "channel")}</span><strong>${escapeHtml(row.campaignName || "Campaign")}</strong><p>${escapeHtml(row.cohortPosition || "observed")} cohort · ${row.metrics?.clickRate != null ? `${escapeHtml(String(row.metrics.clickRate))}% click rate` : "performance observed"} · ${escapeHtml(String(row.linkedDecisions?.length || 0))} linked decision${row.linkedDecisions?.length === 1 ? "" : "s"}</p></article>`).join("")}</div></div>` : ""}
          <p class="campaign-learning-method"><strong>Method:</strong> edits are weak evidence, draft handoffs are strong evidence, rejections are negative evidence, and performance remains associative. Disabled signals never enter a future AI prompt.</p>
        </div>` : ""}
    </section>`;
}

async function moderateCampaignLearning(eventId, operation) {
  const agent = appState.contentAgent;
  if (!eventId || agent.learningBusyId) return;
  if (operation === "delete" && agent.learningDeleteConfirmId !== eventId) {
    agent.learningDeleteConfirmId = eventId;
    renderContentAgentConsole({ force: true });
    window.setTimeout(() => {
      if (agent.learningDeleteConfirmId === eventId && !agent.learningBusyId) {
        agent.learningDeleteConfirmId = "";
        renderContentAgentConsole({ force: true });
      }
    }, 7000);
    return;
  }
  agent.learningBusyId = eventId;
  agent.error = "";
  renderContentAgentConsole({ force: true });
  try {
    const result = await requestCampaignLearningModeration(eventId, operation);
    agent.learning = result.learning || agent.learning;
    agent.learningDeleteConfirmId = "";
  } catch (error) {
    agent.error = error.message || "Learning signal could not be updated.";
  } finally {
    agent.learningBusyId = "";
    renderContentAgentConsole({ force: true });
  }
}

function renderContentAgentConsole({ force = false } = {}) {
  const node = document.getElementById("content-agent-console");
  if (!node) return;
  const agent = appState.contentAgent || {};
  if (!force && isContentAgentDirectorInteractionActive()) {
    agent.directorRenderPending = true;
    return;
  }
  agent.directorRenderPending = false;
  const state = agent.state || {};
  const health = agent.health || {};
  const learning = agent.learning || {};
  const jobs = Array.isArray(state.jobs) ? state.jobs : [];
  const campaignTasks = appState.campaignAsanaCampaignTasks || [];
  const selectedCampaign = getSelectedCampaignAsanaTask("campaign") || campaignTasks[0] || null;
  const matchedContent = findCampaignAsanaContentMatch(selectedCampaign);
  const activeStates = new Set(["queued", "analysing", "producing", "quality_review"]);
  const activeJob = jobs
    .filter((job) => activeStates.has(job.state))
    .sort((left, right) => {
      const stateOrder = { quality_review: 0, producing: 1, analysing: 2, queued: 3 };
      return Number(stateOrder[left.state] ?? 4) - Number(stateOrder[right.state] ?? 4)
        || Number(right.priority || 0) - Number(left.priority || 0)
        || Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0);
    })[0] || null;
  const runningJob = jobs.find((job) => ["analysing", "producing", "quality_review"].includes(job.state)) || null;
  const readyJob = jobs
    .filter((job) => isContentAgentJobStudioEligible(job))
    .sort((left, right) => Date.parse(right.completedAt || right.updatedAt || 0) - Date.parse(left.completedAt || left.updatedAt || 0))[0] || null;
  const focusJob = activeJob || readyJob;
  const focus = getContentAgentFocus(focusJob, agent);
  const progress = Math.max(4, Math.min(100, Number(focusJob?.progress || (focus.step * 25) || 4)));
  const campaignName = focusJob?.campaignTaskName || selectedCampaign?.name || "Campaign Studio";
  const isWorking = Boolean(activeJob);
  const directorOpen = Boolean(agent.directorOpen);
  const workingCount = jobs.filter((job) => ["analysing", "producing", "quality_review"].includes(job.state)).length;
  const queuedCount = jobs.filter((job) => job.state === "queued").length;
  const readyCount = jobs.filter((job) => isContentAgentJobStudioEligible(job)).length;
  const attentionCount = jobs.filter((job) => ["quality_blocked", "failed", "dead_letter"].includes(job.state)).length;
  const pausedCount = jobs.filter((job) => job.state === "paused").length;
  const visibleJobs = [...jobs]
    .sort((left, right) => {
      const stateOrder = { quality_review: 0, producing: 0, analysing: 0, queued: 1, paused: 2, ready_for_review: 3, quality_blocked: 4, failed: 4, dead_letter: 4, superseded: 5 };
      return Number(stateOrder[left.state] ?? 5) - Number(stateOrder[right.state] ?? 5)
        || Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0);
    })
    .slice(0, 8);
  const progressLabel = focusJob
    ? `${Math.round(progress)}% complete`
    : "Standing by";
  const sourceLabel = focusJob?.source === "manual" ? "Priority run" : focusJob ? "Auto-discovered" : "Always on";
  const healthStatus = ["healthy", "degraded", "critical"].includes(health.status) ? health.status : "checking";
  const healthLabel = healthStatus === "healthy" ? "24/7 healthy" : healthStatus === "degraded" ? "24/7 degraded" : healthStatus === "critical" ? "Action required" : "Checking health";
  const healthAlerts = Array.isArray(health.alerts) ? health.alerts : [];
  const campaignTitleClass = campaignName.length >= 54
    ? " is-very-long-title"
    : campaignName.length >= 34
      ? " is-long-title"
      : "";

  node.innerHTML = `
    <section class="content-agent-focus-stage${isWorking ? " is-working" : ""}" data-content-agent-stage style="--agent-progress:${progress * 3.6}deg">
      <div class="content-agent-stage-top">
        <div class="content-agent-wordmark"><i aria-hidden="true"></i><span>CONTENT AGENT</span></div>
        <div class="content-agent-stage-actions">
          <button class="content-agent-icon-button" id="content-agent-refresh" type="button" aria-label="Refresh agent" title="Refresh"${agent.loading ? " disabled" : ""}><span aria-hidden="true">↻</span></button>
          <button class="content-agent-icon-button" id="campaign-manual-workspace-toggle" type="button" aria-label="Open manual studio" title="Open manual studio"><span aria-hidden="true">＋</span></button>
          <button class="content-agent-direct-button" id="content-agent-direct" type="button"><span>Direct the studio</span><i aria-hidden="true">↗</i></button>
        </div>
      </div>

      <div class="content-agent-composition" aria-hidden="true">
        <span class="content-agent-sheet sheet-brief">
          <i>01</i><b>BRIEF</b><em></em><em></em><em></em>
        </span>
        <span class="content-agent-sheet sheet-assets">
          <i>02</i><b>ASSETS</b><span class="asset-grid"><em></em><em></em><em></em><em></em></span>
        </span>
        <span class="content-agent-sheet sheet-canvas">
          <span class="content-agent-sheet-head"><i>03</i><b>${escapeHtml(focus.phase)}</b></span>
          <span class="content-agent-layout-block layout-image"></span>
          <span class="content-agent-layout-block layout-copy"><em></em><em></em><em></em></span>
          <span class="content-agent-layout-block layout-cta"></span>
          <span class="content-agent-composition-scan"></span>
        </span>
        <span class="content-agent-proof-mark">90+</span>
      </div>

      <div class="content-agent-focus-copy${campaignTitleClass}">
        <span class="content-agent-focus-phase"><i></i>${escapeHtml(focus.phase)}</span>
        <h3>${escapeHtml(campaignName)}</h3>
        <p>${escapeHtml(focus.sentence)}</p>
        <div class="content-agent-focus-meta" aria-label="Current run details">
          <span>${escapeHtml(sourceLabel)}</span>
          <span>${escapeHtml(progressLabel)}</span>
          ${queuedCount ? `<span>${queuedCount} waiting</span>` : ""}
        </div>
        ${isContentAgentJobStudioEligible(focusJob) ? `<button class="content-agent-review-button" type="button" data-content-agent-open="${escapeHtml(focusJob.id)}">${focusJob.state === "quality_blocked" ? `Open Studio draft · ${getContentAgentJobQualityScore(focusJob)}` : "Enter Studio"} <span>→</span></button>` : ""}
      </div>

      <div class="content-agent-stage-foot">
        <div class="content-agent-phase-track" aria-label="Campaign production progress">
          ${["Brief", "Design", "Quality", "Review"].map((label, index) => `<span class="${index + 1 < focus.step ? "is-done" : ""}${index + 1 === focus.step ? " is-current" : ""}"><i></i>${label}</span>`).join("")}
        </div>
        <p><span></span>Human approval only</p>
      </div>

      <aside class="content-agent-director${directorOpen ? " is-open" : ""}" aria-hidden="${directorOpen ? "false" : "true"}">
        <div class="content-agent-director-head">
          <div><span>Creative direction</span><strong>Move this campaign to the front.</strong></div>
          <button class="content-agent-director-close" id="content-agent-direct-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="content-agent-fields">
          <label><span>Asana campaign</span><select class="dashboard-control-select" id="content-agent-campaign"${agent.running || appState.campaignAsanaLoading ? " disabled" : ""}>
            ${campaignTasks.length ? campaignTasks.map((task) => `<option value="${escapeHtml(task.gid)}"${task.gid === selectedCampaign?.gid ? " selected" : ""}>${escapeHtml(task.name)}</option>`).join("") : `<option value="">${appState.campaignAsanaLoading ? "Reading Asana..." : "No campaigns available"}</option>`}
          </select></label>
          <label><span>Matched content</span><select class="dashboard-control-select" id="content-agent-content"${agent.running || appState.campaignAsanaLoading ? " disabled" : ""}>
            ${(appState.campaignAsanaContentTasks || []).map((task) => `<option value="${escapeHtml(task.gid)}"${task.gid === (appState.campaignAsanaSelectedContentGid || matchedContent?.task?.gid) ? " selected" : ""}>${escapeHtml(task.name)}</option>`).join("") || `<option value="">No content task available</option>`}
          </select></label>
          <label class="content-agent-direction"><span>Extra direction <small>optional</small></span><input class="campaign-studio-input" id="content-agent-direction" value="${escapeHtml(agent.direction || "")}" placeholder="Example: Lead with carousel and Scandinavian luxury"></label>
          ${runningJob ? `<div class="content-agent-takeover-note"><span>Studio is working</span><strong>${escapeHtml(runningJob.campaignTaskName || "Current campaign")}</strong><small>Pause happens after the current safe production step.</small></div>` : ""}
          <div class="content-agent-start-actions${runningJob ? " has-takeover" : ""}">
            <button class="content-agent-start${runningJob ? " is-queue" : ""}" id="content-agent-start" data-content-agent-start-mode="queue" type="button"${!selectedCampaign || agent.running ? " disabled" : ""}>${agent.running ? "Working…" : runningJob ? "Queue next" : "Start now"}<span>→</span></button>
            ${runningJob ? `<button class="content-agent-takeover" data-content-agent-start-mode="takeover" type="button"${!selectedCampaign || agent.running ? " disabled" : ""}>Pause current & start<span>↗</span></button>` : ""}
          </div>
        </div>
        ${agent.notice ? `<p class="content-agent-notice">${escapeHtml(agent.notice)}</p>` : ""}
        ${agent.error ? `<p class="content-agent-error">${escapeHtml(agent.error)}</p>` : ""}
      </aside>
      <span class="content-agent-ripple-layer" aria-hidden="true"></span>
    </section>

    <section class="content-agent-mission" aria-label="Content Agent operations">
      <header class="content-agent-mission-head">
        <div>
          <span class="content-agent-mission-kicker">Studio pulse</span>
          <h3>Campaign operations</h3>
          <p>Everything the agent has in motion, ready for review or waiting for attention.</p>
        </div>
        <div class="content-agent-heartbeat" data-health="${escapeHtml(healthStatus)}">
          <i aria-hidden="true"></i>
          <span><small>${escapeHtml(healthLabel)}</small>${escapeHtml(formatContentAgentTime(health.lastHeartbeatAt || state.lastScanAt))}</span>
        </div>
      </header>

      <div class="content-agent-health-grid" aria-label="24/7 agent health">
        <article><span>Pipeline</span><strong>v${escapeHtml(String(health.pipelineVersion || "—"))}</strong><small>production contract</small></article>
        <article><span>Persistent state</span><strong>${health.persistentStore ? "Redis" : "Offline"}</strong><small>${escapeHtml(health.storeMode || agent.store?.mode || "unknown")}</small></article>
        <article><span>Heartbeat age</span><strong>${Number.isFinite(Number(health.scanAgeMinutes)) ? `${escapeHtml(String(health.scanAgeMinutes))}m` : "—"}</strong><small>hourly discovery</small></article>
        <article><span>Dead letter</span><strong>${escapeHtml(String(health.deadLetterCount || 0))}</strong><small>${health.failedCount ? `${escapeHtml(String(health.failedCount))} recoverable` : health.historicalFailureCount ? `${escapeHtml(String(health.historicalFailureCount))} archived legacy failures` : "no exhausted jobs"}</small></article>
      </div>
      ${healthAlerts.length ? `<div class="content-agent-alert-stack">${healthAlerts.map((alert) => `<p data-severity="${escapeHtml(alert.severity || "warning")}"><i></i><span>${escapeHtml(alert.message || "Agent health warning")}</span></p>`).join("")}</div>` : `<div class="content-agent-all-clear"><i></i><span>Scheduler, Redis and recovery checks are clear.${Number(learning.eventCount || 0) ? ` Human learning is active with ${escapeHtml(String(learning.eventCount))} recorded signal${Number(learning.eventCount) === 1 ? "" : "s"}.` : " Human learning is ready for its first reviewed campaign."}</span></div>`}

      <div class="content-agent-metrics" aria-label="Agent summary">
        <article data-tone="working"><span>In motion</span><strong>${workingCount}</strong><small>${workingCount ? escapeHtml(getContentAgentStateLabel(activeJob.state, activeJob)) : "Agent is standing by"}</small></article>
        <article data-tone="queue"><span>Up next</span><strong>${queuedCount}</strong><small>${pausedCount ? `${pausedCount} paused · ${queuedCount} queued` : queuedCount === 1 ? "campaign in queue" : "campaigns in queue"}</small></article>
        <article data-tone="ready"><span>Ready for you</span><strong>${readyCount}</strong><small>${readyCount === 1 ? "campaign to review" : "campaigns to review"}</small></article>
        <article data-tone="attention"><span>Needs attention</span><strong>${attentionCount}</strong><small>${attentionCount ? (attentionCount === 1 ? "campaign needs intervention" : "campaigns need intervention") : "No blocked runs"}</small></article>
      </div>

      ${renderCampaignLearningStudio(agent)}

      <div class="content-agent-runs">
        <div class="content-agent-runs-head">
          <div><span>Run log</span><strong>Latest campaigns</strong></div>
          <small>${jobs.length} total run${jobs.length === 1 ? "" : "s"}</small>
        </div>
        <div class="content-agent-job-list">
          ${visibleJobs.length ? visibleJobs.map(renderContentAgentJob).join("") : `
            <div class="content-agent-empty">
              <span aria-hidden="true">01</span>
              <div><strong>No campaigns yet</strong><p>Direct the studio to start a priority run, or let the hourly scan discover the next brief.</p></div>
            </div>
          `}
        </div>
      </div>
    </section>
  `;
}

function flushContentAgentDirectorRender() {
  const agent = appState.contentAgent || {};
  if (!agent.directorRenderPending || isContentAgentDirectorInteractionActive()) return;
  renderContentAgentConsole({ force: true });
}

function scheduleContentAgentPolling() {
  if (contentAgentPollTimer) window.clearTimeout(contentAgentPollTimer);
  contentAgentPollTimer = null;
  const activeStates = new Set(["queued", "analysing", "producing", "quality_review"]);
  const hasActiveJob = (appState.contentAgent?.state?.jobs || []).some((job) => activeStates.has(job.state));
  if (appState.klaviyoView !== "campaign_brain") return;
  contentAgentPollTimer = window.setTimeout(() => loadContentAgentStatus({ silent: true }), hasActiveJob ? 5000 : 60000);
}

async function loadContentAgentStatus({ silent = false } = {}) {
  const agent = appState.contentAgent;
  if (!agent || agent.loading) return;
  agent.loading = true;
  if (!silent) agent.error = "";
  renderContentAgentConsole();
  try {
    const result = await requestContentAgentStatus();
    agent.state = result.state || null;
    agent.store = result.store || null;
    agent.health = result.health || null;
    agent.policy = result.policy || null;
    agent.learning = result.learning || null;
    agent.loaded = true;
  } catch (error) {
    agent.error = error.message || "Could not load Content Agent.";
  } finally {
    agent.loading = false;
    renderContentAgentConsole();
    scheduleContentAgentPolling();
  }
}

async function recoverContentAgentJob(jobId) {
  const agent = appState.contentAgent;
  if (!agent || agent.running || !jobId) return;
  agent.running = true;
  agent.error = "";
  renderContentAgentConsole();
  try {
    const result = await requestContentAgentRetry(jobId);
    agent.state = result.state || agent.state;
    agent.health = result.health || agent.health;
  } catch (error) {
    agent.error = error.message || "Content Agent recovery could not start.";
  } finally {
    agent.running = false;
    renderContentAgentConsole();
    scheduleContentAgentPolling();
  }
}

async function rejectAndRestartContentAgentJob(jobId, reason = "") {
  const agent = appState.contentAgent;
  if (!agent || agent.running || agent.rejectingJobId || !jobId) return;
  agent.rejectingJobId = jobId;
  agent.rejectConfirmJobId = "";
  agent.error = "";
  renderContentAgentConsole({ force: true });
  try {
    const resetsOpenReview = appState.campaignStudioReviewJob?.id === jobId;
    const storedDraftKey = resetsOpenReview ? getCampaignStudioDraftStorageKey() : "";
    const result = await requestContentAgentRejectRestart(jobId, reason);
    agent.state = result.state || agent.state;
    agent.health = result.health || agent.health;
    if (resetsOpenReview) {
      if (storedDraftKey && typeof window !== "undefined") window.localStorage?.removeItem(storedDraftKey);
      appState.campaignStudioReviewOpen = false;
      appState.campaignStudioReviewJob = null;
      appState.campaignArtifactDraft = null;
      appState.campaignArtifactsResult = null;
      appState.campaignBrainResult = null;
      appState.campaignAssemblyObject = null;
      appState.campaignEmailBuilder.history = [];
      appState.campaignEmailBuilder.future = [];
      appState.campaignEmailBuilder.inlineEditing = false;
      appState.campaignEmailBuilder.selectedIndex = 0;
      renderCampaignBrainPanel();
    }
    hydrateCampaignStudioDraftStatus("Campaign rejected. A clean priority restart has been queued from the original brief.");
  } catch (error) {
    agent.error = error.message || "The campaign could not be rejected and restarted.";
  } finally {
    agent.rejectingJobId = "";
    renderContentAgentConsole({ force: true });
    scheduleContentAgentPolling();
  }
}

async function controlContentAgentJobFromStudio(jobId, command) {
  const agent = appState.contentAgent;
  if (!agent || agent.running || agent.controllingJobId || !jobId) return;
  agent.controllingJobId = jobId;
  agent.error = "";
  agent.notice = command === "pause" ? "Pause requested. The agent will stop at the next safe checkpoint." : "Resume requested. The campaign is moving to the front.";
  renderContentAgentConsole({ force: true });
  try {
    const result = await requestContentAgentControl(jobId, command);
    agent.state = result.state || agent.state;
    agent.health = result.health || agent.health;
    agent.notice = result.pendingControl
      ? (command === "pause" ? "Pause accepted — finishing the current safe step first." : "Resume accepted — it will take the next production slot.")
      : (command === "pause" ? "Campaign paused safely." : "Campaign resumed at the front of the queue.");
  } catch (error) {
    agent.notice = "";
    agent.error = error.message || "The job control could not be applied.";
  } finally {
    agent.controllingJobId = "";
    renderContentAgentConsole({ force: true });
    scheduleContentAgentPolling();
  }
}

async function startContentAgent(startMode = "queue") {
  const agent = appState.contentAgent;
  if (!agent || agent.running) return;
  const campaignTaskGid = document.getElementById("content-agent-campaign")?.value || appState.campaignAsanaSelectedCampaignGid;
  const contentTaskGid = document.getElementById("content-agent-content")?.value || appState.campaignAsanaSelectedContentGid;
  if (!campaignTaskGid || !contentTaskGid) {
    agent.error = "Choose both an Asana campaign and its content task.";
    renderContentAgentConsole();
    return;
  }
  agent.running = true;
  agent.error = "";
  agent.notice = startMode === "takeover" ? "Requesting a safe takeover…" : "Adding the campaign to the priority queue…";
  agent.directorOpen = false;
  renderContentAgentConsole();
  try {
    const result = await requestContentAgentStart({ campaignTaskGid, contentTaskGid, direction: agent.direction || "", startMode });
    agent.state = result.state || agent.state;
    agent.store = result.store || agent.store;
    agent.notice = result.statusMessage || (startMode === "takeover"
      ? "Takeover accepted. The previous campaign will remain safely paused."
      : "Campaign accepted and placed in the priority queue.");
    if (result.job?.state === "failed") agent.error = result.job.error || "The agent run needs attention.";
  } catch (error) {
    agent.notice = "";
    agent.error = error.message || "Content Agent could not complete the task.";
  } finally {
    agent.running = false;
    renderContentAgentConsole();
    scheduleContentAgentPolling();
  }
}

function normalizeCampaignAttachmentName(value = "") {
  return String(value || "")
    .split("/")
    .pop()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isCampaignImageAttachment(attachment = {}) {
  const name = String(attachment?.name || "").toLowerCase();
  const type = String(attachment?.resourceSubtype || attachment?.resource_subtype || attachment?.type || "").toLowerCase();
  if (/\.(?:mp4|mov|m4v|webm|avi)(?:$|\?)/i.test(name) || /video/.test(type)) return false;
  return /\.(?:jpe?g|png|webp|gif|avif)(?:$|\?)/i.test(name) || /image|photo/.test(type);
}

function buildCampaignAssetProxyUrl(sourceUrl = "") {
  const params = new URLSearchParams({ action: "asset_proxy", url: String(sourceUrl || "") });
  return `/api/campaign/brain?${params.toString()}`;
}

function rewriteCampaignHtmlImageSources(html = "", replacements = new Map(), fallbackUrls = []) {
  if (!html || (!replacements.size && !fallbackUrls.length)) return html;
  const documentNode = new DOMParser().parseFromString(String(html), "text/html");
  let fallbackIndex = 0;
  documentNode.querySelectorAll("img[src]").forEach((image) => {
    const current = image.getAttribute("data-campaign-original-src") || image.getAttribute("src") || "";
    const replacement = replacements.get(current)
      || (/asanausercontent\.com/i.test(current) && fallbackUrls.length
        ? fallbackUrls[fallbackIndex++ % fallbackUrls.length]
        : "");
    if (replacement) {
      image.setAttribute("src", replacement);
      image.removeAttribute("data-campaign-original-src");
    }
  });
  return `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
}

function quarantineCampaignArtifactAsanaImages(artifactDraft = null) {
  const artifacts = artifactDraft?.artifacts;
  if (!artifacts) return artifactDraft;
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'%3E%3Crect width='100%25' height='100%25' fill='%23eee8df'/%3E%3C/svg%3E";
  const quarantineHtml = (html = "") => {
    if (!/asanausercontent\.com/i.test(String(html || ""))) return html;
    const documentNode = new DOMParser().parseFromString(String(html), "text/html");
    documentNode.querySelectorAll("img[src]").forEach((image) => {
      const source = image.getAttribute("src") || "";
      if (!/asanausercontent\.com/i.test(source)) return;
      image.setAttribute("data-campaign-original-src", source);
      image.setAttribute("src", placeholder);
    });
    return `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
  };
  const email = artifacts.email;
  if (email) {
    email.bodyHtml = quarantineHtml(email.bodyHtml || "");
    if (/asanausercontent\.com/i.test(String(email.heroImageUrl || ""))) email.heroImageUrl = "";
    if (Array.isArray(email.sections)) {
      email.sections.forEach((section) => {
        if (/asanausercontent\.com/i.test(String(section?.imageUrl || ""))) section.imageUrl = "";
      });
    }
    if (Array.isArray(email.visualAssets)) {
      email.visualAssets = email.visualAssets.filter((asset) => !/asanausercontent\.com/i.test(String(asset?.imageUrl || "")));
    }
  }
  if (artifacts.blog?.bodyHtml) artifacts.blog.bodyHtml = quarantineHtml(artifacts.blog.bodyHtml);
  return artifactDraft;
}

async function hydrateContentAgentCampaignAssets(job) {
  const sourceState = appState.campaignStudioSourceAssets;
  if (!job?.contentTaskGid || sourceState.loading) return;
  sourceState.loading = true;
  sourceState.error = "";
  renderCampaignBrainPanel();
  try {
    const bundle = await requestCampaignAsanaTask(job.contentTaskGid);
    const freshAttachments = (Array.isArray(bundle?.attachments) ? bundle.attachments : [])
      .filter((attachment) => isCampaignImageAttachment(attachment) && (attachment.downloadUrl || attachment.download_url));
    if (!freshAttachments.length) throw new Error("No displayable campaign images were found in the linked Asana content task.");

    const originalAttachments = appState.campaignAssemblyObject?.campaignObject?.linkedTasks?.contentTask?.attachments || [];
    const originalsByName = new Map(originalAttachments.map((attachment) => [normalizeCampaignAttachmentName(attachment.name), attachment]));
    const replacements = new Map();
    const items = freshAttachments.slice(0, 24).map((attachment, index) => {
      const original = originalsByName.get(normalizeCampaignAttachmentName(attachment.name)) || originalAttachments[index] || null;
      const sourceUrl = attachment.downloadUrl || attachment.download_url || "";
      const proxyUrl = buildCampaignAssetProxyUrl(sourceUrl);
      if (original?.url) replacements.set(String(original.url), proxyUrl);
      return {
        gid: String(attachment.gid || ""),
        name: String(attachment.name || `campaign-image-${index + 1}.jpg`),
        originalUrl: String(original?.url || ""),
        proxyUrl,
        sourceUrl,
        remoteUrl: proxyUrl,
        type: "image/jpeg"
      };
    });

    const email = appState.campaignArtifactDraft?.artifacts?.email;
    if (email?.bodyHtml) {
      email.bodyHtml = rewriteCampaignHtmlImageSources(email.bodyHtml, replacements, items.map((item) => item.proxyUrl));
      if (email.heroImageMode !== "none" && (!email.heroImageUrl || /asanausercontent\.com/i.test(String(email.heroImageUrl)))) {
        email.heroImageUrl = items[0]?.proxyUrl || "";
        email.heroImageAlt = email.heroImageAlt || items[0]?.name || "Campaign image";
        email.heroImageMode = email.heroImageUrl ? "assigned" : "auto";
      }
      if (Array.isArray(email.sections)) {
        email.sections.forEach((section, index) => {
          if (section.imageMode !== "none" && (!section.imageUrl || /asanausercontent\.com/i.test(String(section.imageUrl)))) {
            const item = items[index % items.length];
            if (item) {
              section.imageUrl = item.proxyUrl;
              section.imageAlt = section.imageAlt || item.name;
              section.imageMode = "assigned";
            }
          }
        });
      }
      email.visualAssets = items.slice(0, 4).map((item, index) => ({
        role: index === 0 ? "hero" : `campaign image ${index + 1}`,
        name: item.name,
        imageUrl: item.proxyUrl,
        hosted: false
      }));
    }
    const blog = appState.campaignArtifactDraft?.artifacts?.blog;
    if (blog?.bodyHtml) blog.bodyHtml = rewriteCampaignHtmlImageSources(blog.bodyHtml, replacements, items.map((item) => item.proxyUrl));

    const concepts = appState.campaignArtifactDraft?.artifacts?.meta?.carouselConcepts || [];
    const selectedConcept = concepts.find((concept) => Array.isArray(concept?.cards) && concept.cards.length) || null;
    const conceptCards = selectedConcept?.cards || [];
    const itemByOriginalUrl = new Map(items.filter((item) => item.originalUrl).map((item) => [item.originalUrl, item]));
    const selectedItems = conceptCards.length
      ? conceptCards.map((card, index) => itemByOriginalUrl.get(String(card.assetUrl || "")) || items[index % items.length]).filter(Boolean)
      : items.slice(0, Math.min(7, items.length));
    setCampaignBrainCarouselFiles(selectedItems);
    if (conceptCards.length) {
      appState.campaignBrainMetaAssets.carouselCardDrafts = selectedItems.map((_, index) => ({
        title: conceptCards[index]?.headline || buildDefaultCampaignBrainCarouselCardDraft(index).title,
        description: conceptCards[index]?.body || buildDefaultCampaignBrainCarouselCardDraft(index).description,
        role: conceptCards[index]?.role || getCampaignBrainCarouselCardRole(index, selectedItems.length),
        cropIntent: conceptCards[index]?.cropIntent || "",
        overlayGuidance: conceptCards[index]?.overlayGuidance || ""
      }));
    }
    setCampaignBrainCarouselWarnings(selectedItems.map((_, index) => ({ index, items: [] })));
    appState.campaignBrainEnvironmentAssets = {
      ...(appState.campaignBrainEnvironmentAssets || {}),
      sourceFiles: items.slice(0, 12),
      selectedSourceIndexes: items.slice(0, 6).map((_, index) => index)
    };
    sourceState.items = items;
    hydrateCampaignStudioDraftStatus(`${items.length} campaign images restored from Asana for review.`);
  } catch (error) {
    sourceState.error = error.message || "Campaign images could not be restored from Asana.";
  } finally {
    sourceState.loading = false;
    renderCampaignBrainPanel();
  }
}

function openContentAgentJob(jobId = "") {
  const job = (appState.contentAgent?.state?.jobs || []).find((item) => item.id === jobId);
  const output = job?.output;
  if (!isContentAgentJobStudioEligible(job) || !output?.artifactPack?.artifacts) return false;
  appState.campaignAssemblyObject = output.assembled || null;
  appState.campaignBrainResult = output.plan || null;
  appState.campaignArtifactsResult = output.artifactPack;
  const storedDraft = loadCampaignStudioDraftFromStorage();
  appState.campaignArtifactDraft = storedDraft?.draft?.artifacts
    ? storedDraft.draft
    : JSON.parse(JSON.stringify(output.artifactPack));
  quarantineCampaignArtifactAsanaImages(appState.campaignArtifactDraft);
  appState.campaignBrainGeneratedAt = output.plan?.generatedAt || job.completedAt || "";
  appState.campaignArtifactsGeneratedAt = output.artifactPack?.generatedAt || job.completedAt || "";
  appState.campaignStudioMode = "asana_combo";
  appState.campaignStudioActiveView = "meta";
  appState.campaignStudioReviewJob = job;
  appState.campaignStudioReviewOpen = true;
  appState.campaignStudioSourceAssets = { loading: false, error: "", items: [] };
  setCampaignBrainCarouselFiles([]);
  appState.campaignEmailBuilder.saveState = "saved";
  appState.campaignEmailBuilder.saveMessage = storedDraft?.draft?.artifacts ? "Recovered local draft" : "Saved locally";
  hydrateCampaignStudioDraftStatus(storedDraft?.draft?.artifacts
    ? `Recovered studio draft saved ${formatKlaviyoDate(storedDraft.savedAt || new Date().toISOString())}`
    : job.state === "quality_blocked"
      ? `Opened at ${getContentAgentJobQualityScore(job)}/100 for human editing. Quality blockers remain active; this is not an approved campaign.`
      : "Opened the Content Agent output. Human review is required before any draft handoff.");
  renderCampaignBrainPanel();
  hydrateContentAgentCampaignAssets(job);
  window.requestAnimationFrame(() => document.getElementById("campaign-brain-artifact-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  return true;
}

function parseCampaignBrainList(value = "") {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function setCampaignStudioMode(nextMode = "asana_combo") {
  const allowed = new Set(["meta_master", "asana_combo", "html_master", "manual_brief", "mixed"]);
  appState.campaignStudioMode = allowed.has(nextMode) ? nextMode : "asana_combo";
  if (appState.campaignStudioMode === "meta_master") {
    loadCampaignAsanaWorkspace();
    loadCampaignMetaMasterTemplates();
  }
  renderCampaignBrainPanel();
}

function normalizeCampaignAsanaMatchValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bw\d{1,2}\b/g, " ")
    .replace(/\b(?:billeder|images?|content|kampagne|campaign)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCampaignAsanaContentMatch(campaignTask = {}, contentTask = {}) {
  const campaignName = normalizeCampaignAsanaMatchValue(campaignTask?.name || "");
  const contentName = normalizeCampaignAsanaMatchValue(contentTask?.name || "");
  if (!campaignName || !contentName) {
    return 0;
  }
  if (campaignName === contentName) {
    return 1;
  }
  if (campaignName.includes(contentName) || contentName.includes(campaignName)) {
    return 0.88;
  }
  const campaignTokens = new Set(campaignName.split(" ").filter((token) => token.length > 1));
  const contentTokens = new Set(contentName.split(" ").filter((token) => token.length > 1));
  const overlap = [...campaignTokens].filter((token) => contentTokens.has(token)).length;
  const tokenScore = overlap / Math.max(campaignTokens.size, contentTokens.size, 1);
  const campaignWeek = String(campaignTask?.name || "").match(/\bW(\d{1,2})\b/i)?.[1] || "";
  const contentWeek = String(contentTask?.name || "").match(/\bW(\d{1,2})\b/i)?.[1] || "";
  const weekBonus = campaignWeek && contentWeek && campaignWeek === contentWeek ? 0.16 : 0;
  return Math.min(1, tokenScore + weekBonus);
}

function findCampaignAsanaContentMatch(campaignTask = null) {
  if (!campaignTask) {
    return null;
  }
  return (appState.campaignAsanaContentTasks || [])
    .map((task) => ({ task, score: scoreCampaignAsanaContentMatch(campaignTask, task) }))
    .sort((left, right) => right.score - left.score)[0] || null;
}

function getSelectedCampaignAsanaTask(kind = "campaign") {
  const isContent = kind === "content";
  const tasks = isContent ? appState.campaignAsanaContentTasks : appState.campaignAsanaCampaignTasks;
  const selectedGid = isContent ? appState.campaignAsanaSelectedContentGid : appState.campaignAsanaSelectedCampaignGid;
  return (tasks || []).find((task) => task?.gid === selectedGid) || null;
}

function getCampaignCreationProgress() {
  if (!appState.campaignAsanaImporting) return null;
  if (appState.campaignArtifactsLoading) {
    return { step: "3 of 3", title: "Creating the Design Studio", detail: "Writing email, carousel and blog materials." };
  }
  if (appState.campaignBrainLoading) {
    return { step: "2 of 3", title: "Building campaign strategy", detail: "Turning the connected brief into one channel plan." };
  }
  return { step: "1 of 3", title: "Reading campaign sources", detail: "Loading the campaign, content and approved assets from Asana." };
}

function renderCampaignAsanaSource() {
  const node = document.getElementById("campaign-asana-source-content");
  if (!node) {
    return;
  }
  if (appState.campaignAsanaLoading) {
    node.innerHTML = `<div class="campaign-asana-loading">Reading campaign and content projects...</div>`;
    return;
  }
  if (appState.campaignAsanaError) {
    node.innerHTML = `
      <div class="campaign-asana-message is-error">
        <strong>Asana is not available</strong>
        <span>${escapeHtml(appState.campaignAsanaError)}</span>
      </div>
    `;
    return;
  }
  if (!appState.campaignAsanaLoaded) {
    node.innerHTML = `<div class="campaign-asana-loading">Connect to load campaign work.</div>`;
    return;
  }

  const campaignTasks = appState.campaignAsanaCampaignTasks || [];
  const contentTasks = appState.campaignAsanaContentTasks || [];
  const selectedCampaign = getSelectedCampaignAsanaTask("campaign");
  const selectedContent = getSelectedCampaignAsanaTask("content");
  const match = findCampaignAsanaContentMatch(selectedCampaign);
  const score = selectedContent && match?.task?.gid === selectedContent.gid
    ? match.score
    : scoreCampaignAsanaContentMatch(selectedCampaign, selectedContent);
  const creationProgress = getCampaignCreationProgress();
  const creationError = appState.campaignAssemblyError || appState.campaignBrainError || appState.campaignArtifactsError || "";

  node.innerHTML = `
    <div class="campaign-asana-connection-line">
      <span class="campaign-asana-live-dot"></span>
      <span>Live · ${escapeHtml(`${campaignTasks.length} campaigns`)}</span>
      <span>${escapeHtml(`${contentTasks.length} content tasks`)}</span>
      <strong>Read only</strong>
    </div>
    <div class="campaign-asana-picker-grid">
      <label>
        <span>Campaign</span>
        <select class="dashboard-control-select" id="campaign-asana-campaign-select">
          ${campaignTasks.map((task) => `
            <option value="${escapeHtml(task.gid || "")}"${task.gid === appState.campaignAsanaSelectedCampaignGid ? " selected" : ""}>${escapeHtml(task.name || "Untitled campaign")}</option>
          `).join("")}
        </select>
      </label>
      <div class="campaign-asana-link-mark" aria-hidden="true"><span></span></div>
      <label>
        <span>Matched content</span>
        <select class="dashboard-control-select" id="campaign-asana-content-select">
          ${contentTasks.map((task) => `
            <option value="${escapeHtml(task.gid || "")}"${task.gid === appState.campaignAsanaSelectedContentGid ? " selected" : ""}>${escapeHtml(task.name || "Untitled content")}</option>
          `).join("")}
        </select>
      </label>
    </div>
    <div class="campaign-asana-match-line">
      <div>
        <span>Match confidence</span>
        <strong>${escapeHtml(score >= 0.8 ? "Strong match" : score >= 0.45 ? "Review match" : "Manual selection")}</strong>
      </div>
      <div class="campaign-asana-match-meter"><i style="width:${Math.round(Math.max(0.08, score) * 100)}%"></i></div>
      <button class="primary-button" id="campaign-asana-load-button" type="button"${appState.campaignAsanaImporting || !selectedCampaign || !selectedContent ? " disabled" : ""}>${appState.campaignAsanaImporting ? "Creating campaign..." : "Create campaign"}</button>
    </div>
    ${creationProgress ? `
      <div class="campaign-creation-progress" aria-live="polite">
        <span>${escapeHtml(creationProgress.step)}</span>
        <div><strong>${escapeHtml(creationProgress.title)}</strong><p>${escapeHtml(creationProgress.detail)}</p></div>
        <i></i>
      </div>
    ` : creationError ? `
      <div class="campaign-asana-message is-error">
        <strong>Campaign creation stopped</strong>
        <span>${escapeHtml(creationError)}</span>
      </div>
    ` : ""}
  `;
}

async function loadCampaignAsanaWorkspace({ force = false } = {}) {
  if (appState.campaignAsanaLoading || (appState.campaignAsanaLoaded && !force)) {
    renderCampaignAsanaSource();
    return;
  }
  appState.campaignAsanaLoading = true;
  appState.campaignAsanaError = "";
  renderCampaignAsanaSource();
  try {
    const [campaignResult, contentResult] = await Promise.all([
      requestCampaignAsanaTasks("campaign"),
      requestCampaignAsanaTasks("content")
    ]);
    appState.campaignAsanaCampaignTasks = Array.isArray(campaignResult?.tasks) ? campaignResult.tasks : [];
    appState.campaignAsanaContentTasks = Array.isArray(contentResult?.tasks) ? contentResult.tasks : [];
    const selectedCampaignStillExists = appState.campaignAsanaCampaignTasks.some((task) => task.gid === appState.campaignAsanaSelectedCampaignGid);
    if (!selectedCampaignStillExists) {
      appState.campaignAsanaSelectedCampaignGid = appState.campaignAsanaCampaignTasks[0]?.gid || "";
    }
    const selectedCampaign = getSelectedCampaignAsanaTask("campaign");
    const match = findCampaignAsanaContentMatch(selectedCampaign);
    appState.campaignAsanaSelectedContentGid = match?.task?.gid || appState.campaignAsanaContentTasks[0]?.gid || "";
    appState.campaignAsanaLoaded = true;
  } catch (error) {
    appState.campaignAsanaError = error.message || "Could not connect Campaign Brain to Asana.";
  } finally {
    appState.campaignAsanaLoading = false;
    renderCampaignAsanaSource();
  }
}

function serializeCampaignAsanaBundle(bundle = {}) {
  const task = bundle?.task || {};
  return {
    gid: task.gid || "",
    name: task.name || "",
    notes: task.notes || "",
    html_notes: task.htmlNotes || "",
    due_on: task.dueOn || "",
    permalink_url: task.permalinkUrl || "",
    customFields: Array.isArray(task.customFields) ? task.customFields : [],
    subtasks: Array.isArray(bundle?.subtasks) ? bundle.subtasks.map((subtask) => ({
      gid: subtask.gid || "",
      name: subtask.name || "",
      notes: subtask.notes || "",
      completed: Boolean(subtask.completed)
    })) : [],
    attachments: Array.isArray(bundle?.attachments) ? bundle.attachments.map((attachment) => ({
      gid: attachment.gid || "",
      name: [attachment.parentTaskName, attachment.name].filter(Boolean).join(" / "),
      type: attachment.resourceSubtype || "asset",
      url: attachment.downloadUrl || attachment.permanentUrl || attachment.viewUrl || "",
      parentTaskGid: attachment.parentTaskGid || "",
      parentTaskName: attachment.parentTaskName || ""
    })) : []
  };
}

function renderCampaignMetaMasterSource() {
  const node = document.getElementById("campaign-meta-master-source");
  if (!node) return;
  const state = appState.campaignMetaMaster || {};
  const accounts = getKlaviyoTemplateAccounts();
  const contentTasks = appState.campaignAsanaContentTasks || [];
  const selectedContent = getSelectedCampaignAsanaTask("content");
  const sourceReady = state.sourceType === "html"
    ? Boolean(String(state.html || "").trim())
    : Boolean(state.templateDetail?.id && (state.templateDetail?.html || state.templateDetail?.definition || state.templateDetail?.text));
  const contentReady = Boolean(selectedContent);
  const assetCount = Number(state.result?.sourceImages?.length || 0);

  node.innerHTML = `
    <div class="campaign-meta-master-hero">
      <div>
        <p class="section-label">Meta from Master</p>
        <h3>Turn finished content into a campaign.</h3>
        <p>Choose the message source and the matching Asana photography. Campaign Brain builds the carousel, copy and production handoff.</p>
      </div>
      <span class="campaign-meta-master-badge">Carousel first</span>
    </div>
    <div class="campaign-meta-master-steps">
      <section class="campaign-meta-master-step${sourceReady ? " is-ready" : ""}">
        <div class="campaign-meta-master-step-number">01</div>
        <div class="campaign-meta-master-step-copy">
          <span>Master source</span>
          <strong>${escapeHtml(state.sourceType === "html" ? "HTML article" : "Klaviyo template")}</strong>
        </div>
        <div class="campaign-meta-master-source-toggle" role="group" aria-label="Master source type">
          <button type="button" data-meta-master-source="klaviyo" class="${state.sourceType !== "html" ? "active" : ""}">Klaviyo</button>
          <button type="button" data-meta-master-source="html" class="${state.sourceType === "html" ? "active" : ""}">HTML</button>
        </div>
        ${state.sourceType === "html" ? `
          <textarea id="campaign-meta-master-html" rows="8" placeholder="Paste the complete HTML blog article here">${escapeHtml(state.html || "")}</textarea>
        ` : `
          <div class="campaign-meta-master-field-grid">
            <label><span>Account</span><select id="campaign-meta-master-account" class="dashboard-control-select">
              ${accounts.map((account) => `<option value="${escapeHtml(account)}"${account === state.account ? " selected" : ""}>${escapeHtml(account)}</option>`).join("")}
            </select></label>
            <label><span>Template</span><select id="campaign-meta-master-template" class="dashboard-control-select"${state.loading ? " disabled" : ""}>
              ${state.templates?.length ? state.templates.map((template) => `<option value="${escapeHtml(template.id)}"${template.id === state.templateId ? " selected" : ""}>${escapeHtml(template.name || "Untitled template")}</option>`).join("") : `<option value="">${state.loading ? "Loading templates..." : "No templates loaded"}</option>`}
            </select></label>
          </div>
          <div class="campaign-meta-master-source-status">
            <span>${state.loading ? "Reading Klaviyo..." : sourceReady ? "Template HTML ready" : "Choose a usable template"}</span>
            <button type="button" class="ghost-button small" id="campaign-meta-master-refresh">Refresh</button>
          </div>
        `}
      </section>
      <section class="campaign-meta-master-step${contentReady ? " is-ready" : ""}">
        <div class="campaign-meta-master-step-number">02</div>
        <div class="campaign-meta-master-step-copy">
          <span>Visual source</span>
          <strong>Asana content</strong>
        </div>
        <label class="campaign-meta-master-wide-field"><span>Content task</span><select id="campaign-meta-master-content" class="dashboard-control-select"${appState.campaignAsanaLoading ? " disabled" : ""}>
          ${contentTasks.length ? contentTasks.map((task) => `<option value="${escapeHtml(task.gid)}"${task.gid === appState.campaignAsanaSelectedContentGid ? " selected" : ""}>${escapeHtml(task.name || "Untitled content")}</option>`).join("") : `<option value="">${appState.campaignAsanaLoading ? "Reading Asana..." : "No content tasks found"}</option>`}
        </select></label>
        <p class="campaign-meta-master-note">Images from 1x1, 4x5 and 9x16 subtasks are inspected automatically. The strongest five are mapped to the carousel.</p>
      </section>
      <section class="campaign-meta-master-step campaign-meta-master-direction">
        <div class="campaign-meta-master-step-number">03</div>
        <div class="campaign-meta-master-step-copy">
          <span>Direction</span>
          <strong>Optional</strong>
        </div>
        <textarea id="campaign-meta-master-direction" rows="4" placeholder="Add market, audience, offer or a mandatory creative direction">${escapeHtml(state.direction || "")}</textarea>
      </section>
    </div>
    <div class="campaign-meta-master-launch">
      <div>
        <span>${sourceReady && contentReady ? "Sources connected" : "Connect both sources"}</span>
        <strong>${state.result ? `${assetCount} images mapped · Meta pack ready` : "One click to a right-sized carousel pack"}</strong>
      </div>
      <button type="button" class="primary-button" id="campaign-meta-master-generate"${state.generating || !sourceReady || !contentReady ? " disabled" : ""}>${state.generating ? "Designing campaign..." : state.result ? "Regenerate Meta campaign" : "Create Meta campaign"}</button>
    </div>
    ${state.error ? `<div class="campaign-asana-message is-error"><strong>Generation stopped</strong><span>${escapeHtml(state.error)}</span></div>` : ""}
  `;
}

async function loadCampaignMetaMasterTemplateDetail(templateId = appState.campaignMetaMaster?.templateId) {
  const state = appState.campaignMetaMaster;
  if (!state || !templateId) return null;
  state.loading = true;
  state.error = "";
  renderCampaignMetaMasterSource();
  try {
    const payload = await requestKlaviyoTemplates({ country: state.account || "DK", templateId });
    state.templateDetail = payload?.selectedTemplate || null;
    if (!state.templateDetail) throw new Error("Klaviyo returned no readable template body.");
    return state.templateDetail;
  } catch (error) {
    state.templateDetail = null;
    state.error = error.message || "Could not read the Klaviyo template.";
    return null;
  } finally {
    state.loading = false;
    renderCampaignMetaMasterSource();
  }
}

async function loadCampaignMetaMasterTemplates({ force = false } = {}) {
  const state = appState.campaignMetaMaster;
  if (!state || state.loading || (state.templates.length && !force)) {
    renderCampaignMetaMasterSource();
    return;
  }
  state.loading = true;
  state.error = "";
  renderCampaignMetaMasterSource();
  try {
    const payload = await requestKlaviyoTemplates({ country: state.account || "DK" });
    state.templates = Array.isArray(payload?.templates) ? payload.templates : [];
    if (!state.templates.some((template) => template.id === state.templateId)) {
      state.templateId = state.templates[0]?.id || "";
    }
  } catch (error) {
    state.templates = [];
    state.templateId = "";
    state.templateDetail = null;
    state.error = error.message || "Could not load Klaviyo templates.";
  } finally {
    state.loading = false;
    renderCampaignMetaMasterSource();
  }
  if (state.templateId) await loadCampaignMetaMasterTemplateDetail(state.templateId);
}

async function generateMetaFromMaster({ selectedRouteId = "", qualityReview = null } = {}) {
  const state = appState.campaignMetaMaster;
  const contentTask = getSelectedCampaignAsanaTask("content");
  if (!state || !contentTask || state.generating) return;
  state.generating = true;
  state.error = "";
  state.qualityError = "";
  if (!qualityReview) {
    state.qualityReview = null;
    state.qualityHistory = [];
  }
  renderCampaignMetaMasterSource();
  try {
    const contentBundle = await requestCampaignAsanaTask(contentTask.gid);
    const serializedContent = serializeCampaignAsanaBundle(contentBundle);
    const detail = state.sourceType === "html" ? null : state.templateDetail;
    const sourceHtml = state.sourceType === "html"
      ? String(state.html || "")
      : String(detail?.html || (detail?.definition ? JSON.stringify(detail.definition) : ""));
    const sourceBody = state.sourceType === "html"
      ? ""
      : String(detail?.text || detail?.previewText || "");
    if (!sourceHtml && !sourceBody) throw new Error("The selected master source has no readable content.");
    const assets = (serializedContent.attachments || []).filter((asset) => /^https?:\/\//i.test(asset.url || ""));
    const result = await requestMetaFromMaster({
      title: detail?.name || contentTask.name || "Meta from Master",
      objective: state.direction || "Transform the approved master content into a high-performing Meta carousel.",
      channels: ["meta"],
      markets: [state.account || "DK"],
      operatorNote: state.direction || "",
      source: {
        type: state.sourceType === "html" ? "blog" : "email",
        title: detail?.name || contentTask.name || "Master content",
        subject: detail?.subject || "",
        previewText: detail?.previewText || "",
        body: sourceBody,
        html: sourceHtml
      },
      assets,
      selectedRouteId: selectedRouteId || state.selectedRouteId || "",
      qualityReview: qualityReview || null,
      constraints: ["Use only claims supported by the master source", "Keep product identity faithful to supplied Asana photography"]
    });
    state.result = result;
    state.selectedRouteId = selectedRouteId || result.creativeRoutes?.recommendedRouteId || "faithful";
    const artifactDraft = createMetaMasterArtifactDraft(result);
    appState.campaignArtifactsResult = artifactDraft;
    appState.campaignArtifactDraft = JSON.parse(JSON.stringify(artifactDraft));
    appState.campaignArtifactsGeneratedAt = result.generatedAt || new Date().toISOString();
    appState.campaignBrainResult = {
      input: result.input,
      campaign: {
        summary: result.masterAudit?.coreMessage || result?.artifacts?.meta?.campaignAngle || "Meta campaign from approved master content",
        coreAngle: result?.artifacts?.meta?.campaignAngle || "",
        corePromise: result.masterAudit?.offer || "",
        primaryCta: result.masterAudit?.primaryCta || result?.artifacts?.meta?.cta || "",
        tone: "Premium, direct and commercial",
        successSignal: "Production-ready Meta carousel"
      },
      memoryReferences: result.memoryReferences || [],
      generatedAt: result.generatedAt
    };
    const remoteAssets = createMetaMasterCarouselAssets(result.carousel?.cards || []);
    setCampaignBrainCarouselFiles(remoteAssets);
    appState.campaignBrainMetaAssets.carouselCardDrafts = createMetaMasterCardDrafts(result.carousel?.cards || []);
    setCampaignBrainCarouselWarnings(remoteAssets.map((_, index) => ({ index, items: [] })));
    syncCampaignBrainMetaConfig({
      adFormat: "Carousel",
      targetLanguage: "en_GB",
      destinationUrl: result?.artifacts?.meta?.destinationUrl || "https://www.westpack.com/"
    });
    appState.campaignStudioActiveView = "meta";
    clearCampaignBrainMetaFeedback();
    await renderCampaignMetaMasterCarousel();
    await reviewCampaignMetaCarousel();
    hydrateCampaignStudioDraftStatus(state.qualityReview?.passed
      ? `Meta campaign passed Creative Director at ${state.qualityReview.overallScore}/100.`
      : "Meta campaign created and reviewed by the Creative Director.");
    persistCampaignStudioDraft();
  } catch (error) {
    state.error = error.message || "Meta from Master generation failed.";
  } finally {
    state.generating = false;
    renderCampaignBrainPanel();
    if (state.result) {
      refreshCampaignBrainMetaTargets();
      window.requestAnimationFrame(() => document.getElementById("campaign-brain-artifact-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
}

async function reviewCampaignMetaCarousel() {
  const state = appState.campaignMetaMaster;
  const files = getCampaignBrainCarouselFiles().slice(0, 6);
  if (!state?.result || files.length < 3 || files.length > 6 || state.qualityReviewing) return null;
  state.qualityReviewing = true;
  state.qualityError = "";
  renderCampaignBrainPanel();
  try {
    const renderedImages = await Promise.all(files.map(async (file) => (
      `data:${file.type || "image/jpeg"};base64,${await readFileAsBase64(file)}`
    )));
    const review = await requestMetaCreativeReview({
      iteration: (state.qualityHistory || []).length + 1,
      renderedImages,
      campaign: {
        masterAudit: state.result.masterAudit,
        sourceDesignAudit: state.result.sourceDesignAudit,
        designTranslation: state.result.designTranslation,
        selectedRouteId: state.selectedRouteId,
        creativeRoutes: state.result.creativeRoutes,
        meta: state.result.artifacts?.meta,
        carousel: state.result.carousel
      }
    });
    state.qualityReview = review;
    state.qualityHistory = [...(state.qualityHistory || []), review].slice(-3);
    persistCampaignStudioDraft();
    return review;
  } catch (error) {
    state.qualityError = error.message || "Creative Director review failed.";
    return null;
  } finally {
    state.qualityReviewing = false;
    renderCampaignBrainPanel();
  }
}

async function renderCampaignMetaMasterCarousel() {
  const state = appState.campaignMetaMaster;
  const masterCards = Array.isArray(state?.result?.carousel?.cards) ? state.result.carousel.cards.slice(0, 6) : [];
  const sourceFiles = (Array.isArray(appState.campaignBrainMetaAssets?.carouselSourceFiles)
    ? appState.campaignBrainMetaAssets.carouselSourceFiles
    : getCampaignBrainCarouselFiles()).slice(0, 6);
  if (!state || state.rendering || masterCards.length < 3 || masterCards.length > 6 || !sourceFiles.length) {
    if (state) state.renderError = "A 3-6 card plan and at least one source image are required before the carousel can be designed.";
    return false;
  }
  const drafts = getCampaignBrainCarouselCardDrafts();
  const layoutByRole = {
    hook: "image_led",
    problem: "editorial_split",
    proof: "detail_frame",
    offer: "quiet_statement",
    benefit: "quiet_statement",
    support: "detail_frame",
    cta: "cta_panel"
  };
  const tones = ["ivory", "sand", "rose", "sage", "charcoal"];
  const cards = masterCards.map((master, index) => {
    const requestedImageIndex = Math.max(1, Math.min(sourceFiles.length, Number(master?.imageIndex) || index + 1));
    const file = sourceFiles[requestedImageIndex - 1] || sourceFiles[index % sourceFiles.length];
    const draft = drafts[index] || {};
    const role = String(master.role || draft.role || getCampaignBrainCarouselCardRole(index, masterCards.length)).toLowerCase();
    const cropDirection = `${master.cropDirective || draft.cropIntent || ""} ${draft.overlayGuidance || ""}`.toLowerCase();
    const focalPoint = master.focalPoint
      || (["left", "right", "top", "bottom"].find((value) => cropDirection.includes(value)))
      || "center";
    return {
      ...master,
      role,
      title: draft.title || master.title || "Westpack",
      description: draft.description || master.description || "",
      imageUrl: String(file?.sourceUrl || file?.originalUrl || ""),
      sourceFile: file instanceof Blob ? file : null,
      layout: master.layout || layoutByRole[role] || (index === 0 ? "image_led" : index === masterCards.length - 1 ? "cta_panel" : "editorial_split"),
      focalPoint,
      tone: master.tone || tones[index] || "ivory"
    };
  });
  state.rendering = true;
  state.renderError = "";
  state.qualityReview = null;
  renderCampaignBrainPanel();
  try {
    const files = await renderMetaCarouselCards(cards, {
      designSystem: state.result?.designTranslation || state.result?.sourceDesignAudit || null
    });
    setCampaignBrainCarouselFiles(files, { rendered: true });
    appState.campaignBrainMetaAssets.carouselCardDrafts = cards.map((card) => ({
      title: card.title,
      description: card.description,
      role: card.role
    }));
    const warnings = await inspectCampaignBrainCarouselFiles(files);
    setCampaignBrainCarouselWarnings(warnings);
    state.renderedAt = new Date().toISOString();
    appState.campaignBrainMetaAssets.carouselDesignReady = true;
    persistCampaignStudioDraft();
    return true;
  } catch (error) {
    state.renderError = error.message || "Could not render carousel designs.";
    return false;
  } finally {
    state.rendering = false;
  }
}

async function loadSelectedCampaignAsanaPair({ createStudio = false } = {}) {
  const campaignTask = getSelectedCampaignAsanaTask("campaign");
  const contentTask = getSelectedCampaignAsanaTask("content");
  if (!campaignTask || !contentTask || appState.campaignAsanaImporting) {
    return;
  }
  appState.campaignAsanaImporting = true;
  appState.campaignAsanaError = "";
  renderCampaignAsanaSource();
  try {
    const [campaignBundle, contentBundle] = await Promise.all([
      requestCampaignAsanaTask(campaignTask.gid),
      requestCampaignAsanaTask(contentTask.gid)
    ]);
    const campaignInput = document.getElementById("campaign-brain-campaign-task");
    const contentInput = document.getElementById("campaign-brain-content-task");
    const titleInput = document.getElementById("campaign-brain-title");
    if (campaignInput) campaignInput.value = JSON.stringify(serializeCampaignAsanaBundle(campaignBundle), null, 2);
    if (contentInput) contentInput.value = JSON.stringify(serializeCampaignAsanaBundle(contentBundle), null, 2);
    if (titleInput) titleInput.value = campaignTask.name || titleInput.value;
    [
      "campaign-brain-objective",
      "campaign-brain-audience",
      "campaign-brain-offer",
      "campaign-brain-source-subject",
      "campaign-brain-source-body",
      "campaign-brain-assets",
      "campaign-brain-constraints"
    ].forEach((id) => {
      const field = document.getElementById(id);
      if (field && "value" in field) field.value = "";
    });
    await assembleCampaignObject();
    if (!appState.campaignAssemblyObject || appState.campaignAssemblyError) return;
    if (createStudio) {
      await generateCampaignBrainPlan();
      if (!appState.campaignBrainResult || appState.campaignBrainError) return;
      await generateCampaignArtifacts();
      if (!appState.campaignArtifactDraft?.artifacts || appState.campaignArtifactsError) return;
      hydrateCampaignStudioDraftStatus("Campaign created from the connected Asana work.");
      window.requestAnimationFrame(() => {
        document.getElementById("campaign-brain-artifact-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      hydrateCampaignStudioDraftStatus("Asana campaign and content loaded into Campaign Brain.");
    }
  } catch (error) {
    appState.campaignAsanaError = error.message || "Could not load the selected Asana campaign.";
  } finally {
    appState.campaignAsanaImporting = false;
    renderCampaignAsanaSource();
  }
}

function getCampaignStudioDraftStorageKey() {
  const campaignKey = appState.campaignAssemblyObject?.campaignObject?.campaignKey
    || appState.campaignBrainResult?.input?.campaignObject?.campaignKey
    || appState.campaignBrainResult?.input?.title
    || appState.campaignAssemblyObject?.campaignObject?.title
    || "untitled-campaign";

  const safeKey = String(campaignKey || "untitled-campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled-campaign";

  return `westpack.campaignStudioDraft.${safeKey}`;
}

function persistCampaignStudioDraft() {
  if (typeof window === "undefined" || !window.localStorage || !appState.campaignArtifactDraft) {
    return false;
  }

  try {
    window.localStorage.setItem(getCampaignStudioDraftStorageKey(), JSON.stringify({
      draft: appState.campaignArtifactDraft,
      metaConfig: appState.campaignBrainMetaConfig,
      environmentConfig: appState.campaignBrainEnvironmentConfig,
      metaAssets: {
        carouselCardDrafts: getCampaignBrainCarouselCardDrafts(),
        designTranslation: appState.campaignMetaMaster?.result?.designTranslation || null,
        creativeRoutes: appState.campaignMetaMaster?.result?.creativeRoutes || null,
        selectedRouteId: appState.campaignMetaMaster?.selectedRouteId || "",
        qualityReview: appState.campaignMetaMaster?.qualityReview || null,
        qualityHistory: appState.campaignMetaMaster?.qualityHistory || []
      },
      environmentAssets: {
        approvedReference: appState.campaignBrainEnvironmentAssets?.approvedReference || null
      },
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch (error) {
    return false;
  }
}

function loadCampaignStudioDraftFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getCampaignStudioDraftStorageKey());
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.draft?.artifacts) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

function clearCampaignStudioDraftFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.removeItem(getCampaignStudioDraftStorageKey());
    return true;
  } catch (error) {
    return false;
  }
}

const CAMPAIGN_ASSET_LIBRARY_DB_NAME = "westpack-campaign-asset-library";
const CAMPAIGN_ASSET_LIBRARY_STORE_NAME = "campaign-assets";
const CAMPAIGN_ASSET_CHANNEL_TAGS = ["meta", "klaviyo", "blog", "environment", "studio"];
let campaignAssetLibraryDbPromise = null;

function slugifyCampaignAssetValue(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCampaignAssetLibraryCampaignKey() {
  return appState.campaignAssemblyObject?.campaignObject?.campaignKey
    || slugifyCampaignAssetValue(appState.campaignArtifactDraft?.artifacts?.email?.subject || "")
    || slugifyCampaignAssetValue(appState.campaignBrainResult?.campaign?.title || "")
    || "global-studio";
}

function getCampaignAssetLibraryItems() {
  return Array.isArray(appState.campaignBrainAssetLibrary?.items)
    ? appState.campaignBrainAssetLibrary.items
    : [];
}

function getCampaignAssetLibraryAllItems() {
  return Array.isArray(appState.campaignBrainAssetLibrary?.allItems)
    ? appState.campaignBrainAssetLibrary.allItems
    : [];
}

function setCampaignAssetLibraryState(overrides = {}) {
  appState.campaignBrainAssetLibrary = {
    ...(appState.campaignBrainAssetLibrary || {}),
    ...(overrides || {})
  };
}

function normalizeCampaignAssetChannelTags(tags = []) {
  const normalized = Array.isArray(tags)
    ? tags
      .map((item) => slugifyCampaignAssetValue(item))
      .filter((item) => CAMPAIGN_ASSET_CHANNEL_TAGS.includes(item))
    : [];
  return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right));
}

function guessCampaignAssetChannelTags() {
  const sourceChannels = Array.isArray(appState.campaignAssemblyObject?.campaignObject?.channels)
    ? appState.campaignAssemblyObject.campaignObject.channels
    : [];
  const tags = new Set(["studio"]);
  for (const channel of sourceChannels) {
    const value = String(channel || "").toLowerCase();
    if (/\bmeta|facebook|instagram|paid social\b/.test(value)) {
      tags.add("meta");
    }
    if (/\bemail|klaviyo|newsletter\b/.test(value)) {
      tags.add("klaviyo");
    }
    if (/\bblog|html|article|seo\b/.test(value)) {
      tags.add("blog");
    }
  }
  tags.add("environment");
  return Array.from(tags);
}

function buildCampaignAssetLibraryFamilyKey(input = {}) {
  const campaignKey = slugifyCampaignAssetValue(input.campaignKey || getCampaignAssetLibraryCampaignKey());
  const assetType = slugifyCampaignAssetValue(input.assetType || "asset");
  const name = slugifyCampaignAssetValue((input.logicalName || input.name || "asset").replace(/\.[a-z0-9]+$/i, ""));
  const format = slugifyCampaignAssetValue(input.format || "original");
  const preset = slugifyCampaignAssetValue(input.preset || "");
  return [campaignKey, assetType, name, format, preset].filter(Boolean).join("::");
}

function sortCampaignAssetLibraryItems(items = []) {
  return items.slice().sort((left, right) => {
    const leftTime = Date.parse(left?.updatedAt || left?.createdAt || 0) || 0;
    const rightTime = Date.parse(right?.updatedAt || right?.createdAt || 0) || 0;
    return rightTime - leftTime;
  });
}

function getCampaignAssetDisplayType(assetType = "") {
  const value = String(assetType || "");
  if (value === "approved_source_image") {
    return "Approved source";
  }
  if (value === "approved_environment_output") {
    return "Approved environment";
  }
  return "Campaign asset";
}

function buildCampaignAssetVersionLabel(item = {}) {
  return `v${Math.max(1, Number(item?.version) || 1)}`;
}

function openCampaignAssetLibraryDb() {
  if (campaignAssetLibraryDbPromise) {
    return campaignAssetLibraryDbPromise;
  }
  campaignAssetLibraryDbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = window.indexedDB.open(CAMPAIGN_ASSET_LIBRARY_DB_NAME, 1);
    request.onerror = () => reject(request.error || new Error("Could not open campaign asset library."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CAMPAIGN_ASSET_LIBRARY_STORE_NAME)) {
        const store = db.createObjectStore(CAMPAIGN_ASSET_LIBRARY_STORE_NAME, { keyPath: "id" });
        store.createIndex("campaignKey", "campaignKey", { unique: false });
        store.createIndex("familyKey", "familyKey", { unique: false });
        store.createIndex("assetType", "assetType", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return campaignAssetLibraryDbPromise;
}

async function listCampaignAssetLibraryRecords() {
  const db = await openCampaignAssetLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CAMPAIGN_ASSET_LIBRARY_STORE_NAME, "readonly");
    const store = transaction.objectStore(CAMPAIGN_ASSET_LIBRARY_STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error || new Error("Could not read campaign asset library."));
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
  });
}

async function putCampaignAssetLibraryRecord(record) {
  const db = await openCampaignAssetLibraryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CAMPAIGN_ASSET_LIBRARY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CAMPAIGN_ASSET_LIBRARY_STORE_NAME);
    const request = store.put(record);
    request.onerror = () => reject(request.error || new Error("Could not save campaign asset."));
    request.onsuccess = () => resolve(record);
  });
}

async function hydrateCampaignAssetLibrary(campaignKey = getCampaignAssetLibraryCampaignKey()) {
  try {
    const records = await listCampaignAssetLibraryRecords();
    const activeKey = String(campaignKey || getCampaignAssetLibraryCampaignKey() || "");
    const filtered = records.filter((item) => String(item?.campaignKey || "") === activeKey);
    setCampaignAssetLibraryState({
      items: sortCampaignAssetLibraryItems(filtered),
      allItems: sortCampaignAssetLibraryItems(records),
      hydrated: true,
      error: ""
    });
  } catch (error) {
    setCampaignAssetLibraryState({
      items: [],
      allItems: [],
      hydrated: true,
      error: error.message || "Could not load campaign asset library."
    });
  }
}

function buildCampaignAssetLibraryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Expected a file or blob."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function imageUrlToDataUrl(imageUrl = "") {
  const response = await fetch(String(imageUrl || ""));
  if (!response.ok) {
    throw new Error(`Could not fetch image asset (${response.status}).`);
  }
  const blob = await response.blob();
  return fileToDataUrl(blob);
}

async function saveCampaignAssetLibraryRecord(input = {}) {
  const campaignKey = String(input.campaignKey || getCampaignAssetLibraryCampaignKey() || "global-studio");
  const familyKey = buildCampaignAssetLibraryFamilyKey({
    ...input,
    campaignKey
  });
  const existing = await listCampaignAssetLibraryRecords();
  const familyRecords = existing.filter((item) => item?.familyKey === familyKey);
  const version = Math.max(0, ...familyRecords.map((item) => Number(item?.version) || 0)) + 1;
  const now = new Date().toISOString();
  const record = {
    id: buildCampaignAssetLibraryId(),
    campaignKey,
    assetType: input.assetType || "asset",
    logicalName: String(input.logicalName || input.name || "asset"),
    name: String(input.name || "asset"),
    familyKey,
    version,
    format: String(input.format || ""),
    preset: String(input.preset || ""),
    role: String(input.role || ""),
    prompt: String(input.prompt || ""),
    channelTags: normalizeCampaignAssetChannelTags(input.channelTags || guessCampaignAssetChannelTags()),
    approved: input.approved !== false,
    imageUrl: String(input.imageUrl || ""),
    sourceAssetId: String(input.sourceAssetId || ""),
    createdAt: now,
    updatedAt: now
  };
  await putCampaignAssetLibraryRecord(record);
  await hydrateCampaignAssetLibrary(campaignKey);
  return record;
}

async function updateCampaignAssetLibraryRecord(id, updates = {}) {
  const current = getCampaignAssetLibraryItems().find((item) => item?.id === id);
  if (!current) {
    throw new Error("Campaign asset not found.");
  }
  const next = {
    ...current,
    ...(updates || {}),
    channelTags: updates.channelTags ? normalizeCampaignAssetChannelTags(updates.channelTags) : current.channelTags,
    updatedAt: new Date().toISOString()
  };
  await putCampaignAssetLibraryRecord(next);
  await hydrateCampaignAssetLibrary(next.campaignKey || getCampaignAssetLibraryCampaignKey());
  return next;
}

async function saveCampaignBrainEnvironmentSourceToLibrary(index) {
  const numericIndex = Number(index);
  const sourceFile = getCampaignBrainEnvironmentFiles()[numericIndex];
  if (!sourceFile) {
    throw new Error("Source image not found.");
  }
  const imageUrl = await fileToDataUrl(sourceFile);
  return saveCampaignAssetLibraryRecord({
    assetType: "approved_source_image",
    logicalName: sourceFile.name || `source-${numericIndex + 1}`,
    name: sourceFile.name || `source-${numericIndex + 1}.png`,
    format: "source",
    imageUrl,
    approved: true,
    channelTags: guessCampaignAssetChannelTags()
  });
}

async function saveCampaignBrainEnvironmentOutputToLibrary(index) {
  const numericIndex = Number(index);
  const images = Array.isArray(appState.campaignBrainEnvironmentResult?.images)
    ? appState.campaignBrainEnvironmentResult.images
    : [];
  const output = images[numericIndex];
  if (!output?.imageUrl) {
    throw new Error("Environment output not found.");
  }
  const imageUrl = String(output.imageUrl || "").startsWith("data:")
    ? String(output.imageUrl || "")
    : await imageUrlToDataUrl(output.imageUrl);
  return saveCampaignAssetLibraryRecord({
    assetType: "approved_environment_output",
    logicalName: `${(output.name || `environment-${numericIndex + 1}`).replace(/\.[a-z0-9]+$/i, "")}-${output.format || "environment"}`,
    name: `${(output.name || `environment-${numericIndex + 1}`).replace(/\.[a-z0-9]+$/i, "")}-${output.format || "environment"}.png`,
    format: output.format || "",
    preset: appState.campaignBrainEnvironmentConfig?.preset || "",
    role: output.role || "",
    prompt: output.prompt || "",
    imageUrl,
    approved: true,
    channelTags: guessCampaignAssetChannelTags()
  });
}

async function useCampaignAssetLibraryItemAsEnvironmentSource(id) {
  const item = getCampaignAssetLibraryItems().find((entry) => entry?.id === id)
    || getCampaignAssetLibraryAllItems().find((entry) => entry?.id === id);
  if (!item?.imageUrl) {
    throw new Error("Campaign asset image is missing.");
  }
  const nextFile = dataUrlToFile(item.imageUrl, item.name || `${item.logicalName || "asset"}.png`);
  const currentFiles = getCampaignBrainEnvironmentFiles();
  const deduped = [nextFile, ...currentFiles].filter((file, index, files) => {
    const fingerprint = `${file.name}|${file.size}|${file.type}`;
    return files.findIndex((candidate) => `${candidate.name}|${candidate.size}|${candidate.type}` === fingerprint) === index;
  }).slice(0, 6);
  setCampaignBrainEnvironmentFiles(deduped);
  const insights = await inspectCampaignBrainEnvironmentFiles(deduped, getCampaignBrainEnvironmentSelectedFormats());
  setCampaignBrainEnvironmentSourceInsights(insights);
  clearCampaignBrainEnvironmentResults();
  persistCampaignStudioDraft();
}

function useCampaignAssetLibraryItemAsEnvironmentReference(id) {
  const item = getCampaignAssetLibraryItems().find((entry) => entry?.id === id);
  const fallback = getCampaignAssetLibraryAllItems().find((entry) => entry?.id === id);
  const source = item || fallback;
  if (!source?.imageUrl) {
    return false;
  }
  appState.campaignBrainEnvironmentAssets = {
    ...(appState.campaignBrainEnvironmentAssets || {}),
    approvedReference: {
      name: source.name || source.logicalName || "approved-reference.png",
      format: source.format || "",
      role: source.role || "",
      imageUrl: source.imageUrl
    }
  };
  persistCampaignStudioDraft();
  return true;
}

async function useCampaignAssetLibraryItemInCarousel(id) {
  const item = getCampaignAssetLibraryItems().find((entry) => entry?.id === id)
    || getCampaignAssetLibraryAllItems().find((entry) => entry?.id === id);
  if (!item?.imageUrl) {
    throw new Error("Campaign asset image is missing.");
  }
  const file = dataUrlToFile(item.imageUrl, item.name || `${item.logicalName || "carousel"}.png`);
  const nextFiles = [...getCampaignBrainCarouselFiles(), file].slice(0, 10);
  setCampaignBrainCarouselFiles(nextFiles);
  const warnings = await inspectCampaignBrainCarouselFiles(nextFiles);
  setCampaignBrainCarouselWarnings(warnings);
  clearCampaignBrainMetaResults();
  persistCampaignStudioDraft();
}

function setCampaignAssetLibraryPickerTarget(value = "") {
  setCampaignAssetLibraryState({
    pickerTarget: String(value || "")
  });
}

function syncCampaignAssetLibraryControls(overrides = {}) {
  setCampaignAssetLibraryState({
    scope: overrides.scope ?? appState.campaignBrainAssetLibrary?.scope ?? "campaign",
    search: overrides.search ?? appState.campaignBrainAssetLibrary?.search ?? "",
    assetType: overrides.assetType ?? appState.campaignBrainAssetLibrary?.assetType ?? "all",
    channelTag: overrides.channelTag ?? appState.campaignBrainAssetLibrary?.channelTag ?? "all",
    pickerTarget: overrides.pickerTarget ?? appState.campaignBrainAssetLibrary?.pickerTarget ?? ""
  });
}

async function useCampaignAssetLibraryPickerSelection(id) {
  const pickerTarget = String(appState.campaignBrainAssetLibrary?.pickerTarget || "");
  if (pickerTarget === "environment_source") {
    await useCampaignAssetLibraryItemAsEnvironmentSource(id);
    setCampaignAssetLibraryPickerTarget("");
    return "Library asset inserted as environment source.";
  }
  if (pickerTarget === "environment_reference") {
    const ok = useCampaignAssetLibraryItemAsEnvironmentReference(id);
    if (!ok) {
      throw new Error("Could not use library asset as environment reference.");
    }
    setCampaignAssetLibraryPickerTarget("");
    return "Library asset inserted as environment reference.";
  }
  if (pickerTarget === "meta_carousel") {
    await useCampaignAssetLibraryItemInCarousel(id);
    setCampaignAssetLibraryPickerTarget("");
    return "Library asset inserted into Meta carousel.";
  }
  throw new Error("No asset picker target is active.");
}

function buildCampaignAssetLibraryMarkup() {
  const state = appState.campaignBrainAssetLibrary || {};
  const scope = state.scope === "all" ? "all" : "campaign";
  const sourceItems = scope === "all" ? getCampaignAssetLibraryAllItems() : getCampaignAssetLibraryItems();
  const searchQuery = String(state.search || "").trim().toLowerCase();
  const assetTypeFilter = state.assetType || "all";
  const channelTagFilter = state.channelTag || "all";
  const pickerTarget = String(state.pickerTarget || "");
  const pickerLabels = {
    environment_source: "Add source image",
    environment_reference: "Set as visual reference",
    meta_carousel: "Add to Meta carousel"
  };
  const pickerLabel = pickerLabels[pickerTarget] || "";
  const items = sourceItems.filter((item) => {
    if (assetTypeFilter !== "all" && item?.assetType !== assetTypeFilter) {
      return false;
    }
    if (channelTagFilter !== "all" && !(Array.isArray(item?.channelTags) && item.channelTags.includes(channelTagFilter))) {
      return false;
    }
    if (!searchQuery) {
      return true;
    }
    const haystack = [
      item?.logicalName,
      item?.name,
      item?.campaignKey,
      item?.format,
      item?.preset,
      item?.role,
      ...(Array.isArray(item?.channelTags) ? item.channelTags : [])
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(searchQuery);
  });

  const toolbarMarkup = `
    <div class="campaign-studio-asset-library-toolbar">
      <div class="campaign-studio-library-scope" aria-label="Asset library scope">
        <button class="ghost-button small${scope === "campaign" ? " is-selected" : ""}" type="button" data-campaign-asset-scope="campaign">Campaign</button>
        <button class="ghost-button small${scope === "all" ? " is-selected" : ""}" type="button" data-campaign-asset-scope="all">All studio</button>
      </div>
      <label class="campaign-studio-asset-library-search">
        <span>Find an asset</span>
        <input class="campaign-studio-input" type="search" value="${escapeHtml(state.search || "")}" placeholder="Search material bank" data-campaign-asset-search="1">
      </label>
      <label class="campaign-studio-library-filter">
        <span>Material</span>
        <select class="dashboard-control-select" data-campaign-asset-filter="assetType">
          <option value="all"${assetTypeFilter === "all" ? " selected" : ""}>All materials</option>
          <option value="approved_source_image"${assetTypeFilter === "approved_source_image" ? " selected" : ""}>Source images</option>
          <option value="approved_environment_output"${assetTypeFilter === "approved_environment_output" ? " selected" : ""}>Environment outputs</option>
        </select>
      </label>
      <label class="campaign-studio-library-filter">
        <span>Channel</span>
        <select class="dashboard-control-select" data-campaign-asset-filter="channelTag">
          <option value="all"${channelTagFilter === "all" ? " selected" : ""}>Every channel</option>
          ${CAMPAIGN_ASSET_CHANNEL_TAGS.map((tag) => `<option value="${escapeHtml(tag)}"${channelTagFilter === tag ? " selected" : ""}>${escapeHtml(tag)}</option>`).join("")}
        </select>
      </label>
    </div>
  `;
  const pickerBannerMarkup = pickerTarget ? `
    <div class="campaign-studio-library-picker-banner">
      <div><span>Picker active</span><strong>${escapeHtml(pickerLabel)}</strong></div>
      <button class="ghost-button small" type="button" data-campaign-asset-picker-close="1">Cancel</button>
    </div>
  ` : "";

  if (!state.hydrated) {
    return `<div class="campaign-studio-library-empty"><strong>Opening material bank</strong><span>Loading approved campaign assets...</span></div>`;
  }
  if (state.error) {
    return `<div class="campaign-studio-library-empty is-error"><strong>Material bank unavailable</strong><span>${escapeHtml(state.error)}</span></div>`;
  }
  if (!items.length) {
    return `
      ${pickerBannerMarkup}
      ${toolbarMarkup}
      <div class="campaign-studio-library-empty">
        <strong>${sourceItems.length ? "No matching assets" : "Your material bank is ready"}</strong>
        <span>${sourceItems.length
          ? "Adjust the search or filters to reveal approved material."
          : "Approve source photography or generated environments and they will appear here with versions and channel tags."}</span>
      </div>
    `;
  }

  const groups = [
    ["approved_source_image", "Source photography"],
    ["approved_environment_output", "Environment collection"]
  ];
  const groupsMarkup = groups.map(([assetType, label]) => {
    const records = items.filter((item) => item?.assetType === assetType);
    if (!records.length) {
      return "";
    }
    return `
      <section class="campaign-studio-asset-library-group">
        <div class="campaign-studio-library-group-head">
          <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(`${records.length} approved`)}</span></div>
        </div>
        <div class="campaign-studio-asset-library-grid">
          ${records.map((item) => {
            const canPick = pickerTarget === "environment_source"
              || ((pickerTarget === "environment_reference" || pickerTarget === "meta_carousel") && item.assetType === "approved_environment_output");
            return `
              <article class="campaign-studio-asset-library-card${canPick ? " is-pickable" : ""}">
                <div class="campaign-studio-library-image-wrap">
                  <img class="campaign-studio-environment-result-image" src="${escapeHtml(item.imageUrl || "")}" alt="">
                  <div class="campaign-studio-library-image-meta">
                    <span>${escapeHtml(buildCampaignAssetVersionLabel(item))}</span>
                    ${item.format ? `<span>${escapeHtml(item.format)}</span>` : ""}
                  </div>
                  ${canPick ? `<button class="campaign-studio-library-pick" type="button" data-campaign-asset-pick="${escapeHtml(item.id)}">${escapeHtml(pickerLabel)}</button>` : ""}
                </div>
                <div class="campaign-studio-library-card-copy">
                  <strong>${escapeHtml(item.logicalName || item.name || "Campaign asset")}</strong>
                  <span>${escapeHtml(getCampaignAssetDisplayType(item.assetType))}</span>
                  <p>${escapeHtml(item.role || item.preset || "Reusable studio material")}</p>
                  <div class="campaign-studio-library-active-tags">
                    ${normalizeCampaignAssetChannelTags(item.channelTags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>untagged</span>"}
                  </div>
                  <details class="campaign-studio-library-card-menu">
                    <summary>Use and tag asset</summary>
                    <div class="campaign-studio-action-row">
                      <button class="ghost-button small" type="button" data-campaign-asset-use-source="${escapeHtml(item.id)}">Environment source</button>
                      ${item.assetType === "approved_environment_output" ? `<button class="ghost-button small" type="button" data-campaign-asset-use-reference="${escapeHtml(item.id)}">Visual reference</button>` : ""}
                      ${item.assetType === "approved_environment_output" ? `<button class="ghost-button small" type="button" data-campaign-asset-use-carousel="${escapeHtml(item.id)}">Meta carousel</button>` : ""}
                    </div>
                    <div class="campaign-studio-asset-tag-row">
                      ${CAMPAIGN_ASSET_CHANNEL_TAGS.map((tag) => `
                        <button class="ghost-button tiny${Array.isArray(item.channelTags) && item.channelTags.includes(tag) ? " is-selected" : ""}" type="button" data-campaign-asset-tag-toggle="${escapeHtml(item.id)}" data-campaign-asset-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
                      `).join("")}
                    </div>
                  </details>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("");

  return `
    ${pickerBannerMarkup}
    ${toolbarMarkup}
    ${groupsMarkup}
  `;
}

function hydrateCampaignStudioDraftStatus(message = "") {
  const node = document.getElementById("campaign-studio-draft-status");
  if (!node) {
    return;
  }
  node.textContent = message;
}

function setCampaignStudioActiveView(nextView = "meta") {
  const allowed = new Set(["meta", "email", "blog", "environment", "assets"]);
  appState.campaignStudioActiveView = allowed.has(nextView) ? nextView : "meta";
  const panel = document.getElementById("klaviyo-campaign-brain-panel");
  if (panel) panel.dataset.studioView = appState.campaignStudioActiveView;
  panel?.querySelectorAll("[data-campaign-studio-view]").forEach((button) => {
    const active = button.getAttribute("data-campaign-studio-view") === appState.campaignStudioActiveView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  panel?.querySelectorAll("[data-campaign-studio-panel]").forEach((section) => {
    section.hidden = section.getAttribute("data-campaign-studio-panel") !== appState.campaignStudioActiveView;
  });
  if (appState.campaignStudioActiveView === "meta"
    && !appState.metaHistoricalIntelligence?.loaded
    && !appState.metaHistoricalIntelligence?.loading) {
    window.setTimeout(() => loadMetaHistoricalIntelligence(), 0);
  }
}

function findFirstUrl(value = "") {
  const match = String(value || "").match(/https?:\/\/[^\s"'<>]+/i);
  return match?.[0] || "";
}

function deriveCampaignBrainMetaConfig(overrides = {}) {
  const campaignObject = appState.campaignAssemblyObject?.campaignObject || appState.campaignBrainResult?.input?.campaignObject || null;
  const source = appState.campaignAssemblyObject?.brainInput?.source || appState.campaignBrainResult?.input?.source || {};
  const markets = Array.isArray(campaignObject?.markets) ? campaignObject.markets : [];
  const sourceUrls = [
    findFirstUrl(source?.html),
    findFirstUrl(source?.body),
    findFirstUrl(appState.campaignAssemblyObject?.campaignObject?.extraPrompt),
    findFirstUrl(document.getElementById("campaign-brain-source-html")?.value || "")
  ].filter(Boolean);
  const assetTypes = appState.campaignAssemblyObject?.sourceProfile?.assetTypes || {};

  const adFormat = "Carousel";

  const firstPopulated = (...values) => values.find((value) => String(value ?? "").trim()) ?? "";

  return {
    targetCampaignName: firstPopulated(
      overrides.targetCampaignName,
      appState.campaignBrainMetaConfig?.targetCampaignName,
      campaignObject?.title,
      campaignObject?.campaignName,
      appState.campaignBrainResult?.input?.title
    ),
    targetCampaignId: overrides.targetCampaignId ?? appState.campaignBrainMetaConfig?.targetCampaignId ?? "",
    targetAdSetName: overrides.targetAdSetName ?? appState.campaignBrainMetaConfig?.targetAdSetName ?? "",
    targetAdSetId: overrides.targetAdSetId ?? appState.campaignBrainMetaConfig?.targetAdSetId ?? "",
    targetLanguage: "en_GB",
    destinationUrl: firstPopulated(overrides.destinationUrl, appState.campaignBrainMetaConfig?.destinationUrl, sourceUrls[0], "https://www.westpack.com/"),
    adFormat
  };
}

function syncCampaignBrainMetaConfig(overrides = {}) {
  appState.campaignBrainMetaConfig = deriveCampaignBrainMetaConfig(overrides);
}

function getCampaignBrainMetaTargetModel() {
  return buildCampaignMetaTargetModel({
    campaigns: appState.campaigns || [],
    adSets: appState.adSets || [],
    config: deriveCampaignBrainMetaConfig(),
    loading: appState.campaignBrainMetaCatalogLoading
  });
}

function syncCampaignBrainMetaTarget(campaignId = "", adSetId = "") {
  syncCampaignBrainMetaConfig(selectCampaignMetaTarget({
    campaigns: appState.campaigns || [],
    adSets: appState.adSets || [],
    campaignId,
    adSetId
  }));
  clearCampaignBrainMetaFeedback();
}

async function refreshCampaignBrainMetaTargets({ force = false } = {}) {
  if (appState.campaignBrainMetaCatalogLoading) {
    return;
  }
  appState.campaignBrainMetaCatalogLoading = true;
  appState.campaignBrainMetaCatalogError = "";
  renderCampaignBrainPanel();
  const catalog = await loadMetaStudioCatalog({ force: true, forceLive: true, silent: true });
  appState.campaignBrainMetaCatalogLoading = false;
  if (!catalog) {
    appState.campaignBrainMetaCatalogError = "Meta destinations could not be loaded.";
  }
  renderCampaignBrainPanel();
}

async function loadMetaHistoricalIntelligence({ sync = false } = {}) {
  const state = appState.metaHistoricalIntelligence;
  if (!state || state.loading) return null;
  state.loading = true;
  state.error = "";
  renderCampaignBrainPanel();
  try {
    const snapshot = await requestMetaHistoricalIntelligence({ sync, days: 365 });
    state.snapshot = snapshot;
    state.loaded = true;
    return snapshot;
  } catch (error) {
    state.error = error.message || "Historical Meta learning could not be loaded.";
    return null;
  } finally {
    state.loading = false;
    renderCampaignBrainPanel();
  }
}

function syncCampaignBrainMetaAssetsFromStorage(storedMetaAssets = null) {
  const carouselCardDrafts = Array.isArray(storedMetaAssets?.carouselCardDrafts)
    ? storedMetaAssets.carouselCardDrafts.map((draft, index) => ({
        title: draft?.title || buildDefaultCampaignBrainCarouselCardDraft(index).title,
        description: draft?.description || buildDefaultCampaignBrainCarouselCardDraft(index).description
      }))
    : [];

  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselCardDrafts
  };
  if (storedMetaAssets?.designTranslation) {
    appState.campaignMetaMaster.result = {
      ...(appState.campaignMetaMaster.result || {}),
      designTranslation: storedMetaAssets.designTranslation,
      creativeRoutes: storedMetaAssets.creativeRoutes || appState.campaignMetaMaster.result?.creativeRoutes || null
    };
    appState.campaignMetaMaster.selectedRouteId = storedMetaAssets.selectedRouteId || "";
    appState.campaignMetaMaster.qualityReview = storedMetaAssets.qualityReview || null;
    appState.campaignMetaMaster.qualityHistory = Array.isArray(storedMetaAssets.qualityHistory) ? storedMetaAssets.qualityHistory : [];
  }
}

function syncCampaignBrainEnvironmentConfig(nextConfig = {}) {
  const nextSelectedFormats = Array.isArray(nextConfig?.selectedFormats)
    ? nextConfig.selectedFormats
        .map((item) => String(item || "").trim().toLowerCase())
        .filter((item) => ["square", "portrait", "landscape"].includes(item))
    : null;
  appState.campaignBrainEnvironmentConfig = {
    ...(appState.campaignBrainEnvironmentConfig || {}),
    ...(nextConfig || {}),
    ...(nextSelectedFormats ? { selectedFormats: nextSelectedFormats.length ? nextSelectedFormats : ["portrait"] } : {})
  };
}

function syncCampaignBrainEnvironmentConfigFromStorage(storedEnvironmentConfig = null) {
  if (!storedEnvironmentConfig || typeof storedEnvironmentConfig !== "object") {
    return;
  }

  syncCampaignBrainEnvironmentConfig({
    preset: storedEnvironmentConfig.preset || appState.campaignBrainEnvironmentConfig?.preset || "scandi_luxe",
    selectedFormats: Array.isArray(storedEnvironmentConfig.selectedFormats) && storedEnvironmentConfig.selectedFormats.length
      ? storedEnvironmentConfig.selectedFormats
      : Array.isArray(appState.campaignBrainEnvironmentConfig?.selectedFormats) && appState.campaignBrainEnvironmentConfig.selectedFormats.length
        ? appState.campaignBrainEnvironmentConfig.selectedFormats
        : [storedEnvironmentConfig.aspectRatio || "portrait"],
    quality: storedEnvironmentConfig.quality || appState.campaignBrainEnvironmentConfig?.quality || "medium",
    customDirection: storedEnvironmentConfig.customDirection || ""
  });
}

function syncCampaignBrainEnvironmentAssetsFromStorage(storedEnvironmentAssets = null) {
  if (!storedEnvironmentAssets || typeof storedEnvironmentAssets !== "object") {
    return;
  }

  appState.campaignBrainEnvironmentAssets = {
    ...(appState.campaignBrainEnvironmentAssets || {}),
    approvedReference: storedEnvironmentAssets.approvedReference || null
  };
}

function getCampaignBrainEnvironmentFiles() {
  return Array.isArray(appState.campaignBrainEnvironmentAssets?.sourceFiles)
    ? appState.campaignBrainEnvironmentAssets.sourceFiles
    : [];
}

function getCampaignBrainEnvironmentSourceInsights() {
  return Array.isArray(appState.campaignBrainEnvironmentAssets?.sourceInsights)
    ? appState.campaignBrainEnvironmentAssets.sourceInsights
    : [];
}

function getCampaignBrainEnvironmentSelectedSourceIndexes() {
  return Array.isArray(appState.campaignBrainEnvironmentAssets?.selectedSourceIndexes)
    ? appState.campaignBrainEnvironmentAssets.selectedSourceIndexes
    : [];
}

function getCampaignBrainEnvironmentApprovedReference() {
  return appState.campaignBrainEnvironmentAssets?.approvedReference || null;
}

function setCampaignBrainEnvironmentSourceInsights(insights = []) {
  const nextInsights = Array.isArray(insights) ? insights : [];
  const recommendedIndexes = nextInsights
    .filter((item) => item?.recommended)
    .map((item) => Number(item.index))
    .filter((item) => Number.isInteger(item));

  appState.campaignBrainEnvironmentAssets = {
    ...(appState.campaignBrainEnvironmentAssets || {}),
    sourceInsights: nextInsights,
    selectedSourceIndexes: recommendedIndexes.length ? recommendedIndexes : nextInsights.slice(0, 3).map((item) => Number(item.index)).filter((item) => Number.isInteger(item))
  };
}

function toggleCampaignBrainEnvironmentSourceSelection(index) {
  const numericIndex = Number(index);
  if (!Number.isInteger(numericIndex) || numericIndex < 0) {
    return;
  }

  const current = new Set(getCampaignBrainEnvironmentSelectedSourceIndexes());
  if (current.has(numericIndex)) {
    if (current.size > 1) {
      current.delete(numericIndex);
    }
  } else {
    current.add(numericIndex);
  }

  appState.campaignBrainEnvironmentAssets = {
    ...(appState.campaignBrainEnvironmentAssets || {}),
    selectedSourceIndexes: Array.from(current).sort((left, right) => left - right)
  };
}

function approveCampaignBrainEnvironmentReference(index) {
  const numericIndex = Number(index);
  const resultImages = Array.isArray(appState.campaignBrainEnvironmentResult?.images)
    ? appState.campaignBrainEnvironmentResult.images
    : [];
  const approved = resultImages[numericIndex];
  if (!approved?.imageUrl) {
    return false;
  }

  appState.campaignBrainEnvironmentAssets = {
    ...(appState.campaignBrainEnvironmentAssets || {}),
    approvedReference: {
      name: approved.name || `environment-${approved.index || numericIndex + 1}.png`,
      format: approved.format || "",
      role: approved.role || "",
      imageUrl: approved.imageUrl
    }
  };
  return true;
}

function buildCampaignBrainEnvironmentResultGroups(images = []) {
  const groups = new Map();

  for (const image of Array.isArray(images) ? images : []) {
    const key = String(image?.name || "Environment image");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(image);
  }

  return Array.from(groups.entries()).map(([name, items]) => ({
    name,
    items: items.sort((left, right) => String(left?.format || "").localeCompare(String(right?.format || "")))
  }));
}

function setCampaignBrainEnvironmentFiles(files = []) {
  appState.campaignBrainEnvironmentAssets = {
    ...(appState.campaignBrainEnvironmentAssets || {}),
    sourceFiles: Array.isArray(files) ? files.slice(0, 6) : [],
    sourceInsights: [],
    selectedSourceIndexes: [],
    approvedReference: appState.campaignBrainEnvironmentAssets?.approvedReference || null
  };
}

function clearCampaignBrainEnvironmentResults() {
  appState.campaignBrainEnvironmentError = "";
  appState.campaignBrainEnvironmentResult = null;
}

async function inspectCampaignBrainEnvironmentFiles(files = [], selectedFormats = []) {
  const formats = Array.isArray(selectedFormats) && selectedFormats.length ? selectedFormats : ["portrait"];
  const targetRatio = formats.includes("portrait")
    ? 4 / 5
    : formats.includes("square")
      ? 1
      : 3 / 2;
  const insights = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let width = 0;
    let height = 0;
    let score = 50;
    const notes = [];

    try {
      const dimensions = await loadImageDimensions(file);
      width = Number(dimensions.width || 0);
      height = Number(dimensions.height || 0);
      const ratio = height > 0 ? width / height : 0;
      const ratioDistance = Math.abs(ratio - targetRatio);
      score += Math.max(0, 18 - Math.round(ratioDistance * 40));

      if (width >= 1400 && height >= 1400) {
        score += 20;
        notes.push("Strong resolution headroom.");
      } else if (width >= 1080 && height >= 1080) {
        score += 12;
        notes.push("Usable resolution for premium edits.");
      } else {
        score -= 14;
        notes.push("Lower resolution may reduce luxury finish.");
      }

      if (ratioDistance <= 0.08) {
        score += 14;
        notes.push("Natural fit for selected output pack.");
      } else if (ratioDistance <= 0.2) {
        score += 6;
        notes.push("Will need moderate crop adaptation.");
      } else {
        score -= 10;
        notes.push("Likely to need aggressive crop adaptation.");
      }
    } catch (error) {
      score -= 12;
      notes.push(error.message || "Could not inspect image dimensions.");
    }

    if (Number(file?.size || 0) > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
      score -= 6;
      notes.push("Large file may slow environment generation.");
    }

    const name = String(file?.name || "").toLowerCase();
    if (/\b(hero|main|front|overview|1|01)\b/.test(name)) {
      score += 6;
      notes.push("Filename suggests hero-friendly source.");
    }

    insights.push({
      index,
      score: Math.max(0, Math.min(100, score)),
      width,
      height,
      recommended: false,
      notes
    });
  }

  const sorted = insights
    .slice()
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .map((item, rank) => ({
      ...item,
      recommended: rank < Math.min(3, insights.length)
    }));

  return sorted.sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
}

function getCampaignBrainEnvironmentSelectedFormats() {
  const values = Array.isArray(appState.campaignBrainEnvironmentConfig?.selectedFormats)
    ? appState.campaignBrainEnvironmentConfig.selectedFormats
    : [];
  return values.length ? values : ["portrait"];
}

function dataUrlToFile(dataUrl = "", filename = "generated-image.png") {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL.");
  }

  const mime = match[1] || "image/png";
  const base64 = match[2] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mime });
}

function getCampaignBrainCarouselFiles() {
  return Array.isArray(appState.campaignBrainMetaAssets?.carouselSquareFiles)
    ? appState.campaignBrainMetaAssets.carouselSquareFiles
    : [];
}

function getCampaignBrainCarouselCardDrafts() {
  return Array.isArray(appState.campaignBrainMetaAssets?.carouselCardDrafts)
    ? appState.campaignBrainMetaAssets.carouselCardDrafts
    : [];
}

function getCampaignBrainCarouselWarnings() {
  return Array.isArray(appState.campaignBrainMetaAssets?.carouselWarnings)
    ? appState.campaignBrainMetaAssets.carouselWarnings
    : [];
}

function getCampaignBrainAssetPreviewUrl(file) {
  return String(file?.remoteUrl || file?.sourceUrl || "").trim() || getCachedCreateUploadPreviewUrl(file);
}

function buildDefaultCampaignBrainCarouselCardDraft(index = 0) {
  const variants = Array.isArray(appState.campaignArtifactDraft?.artifacts?.meta?.variants)
    ? appState.campaignArtifactDraft.artifacts.meta.variants
    : [];
  const meta = appState.campaignArtifactDraft?.artifacts?.meta || {};
  const variant = variants[index] || variants[0] || {};
  return {
    title: variant.headline || meta.headline || "Westpack",
    description: variant.body || meta.description || ""
  };
}

function getCampaignBrainCarouselCardRole(index = 0, total = 0) {
  const count = Math.max(2, Number(total) || 0);
  if (index <= 0) {
    return "Hook";
  }
  if (index === count - 1) {
    return "CTA";
  }
  if (index === 1) {
    return "Proof";
  }
  if (index === 2) {
    return "Offer";
  }
  return "Support";
}

function buildCampaignBrainCarouselCardPlan(total = 0) {
  return Array.from({ length: Math.max(2, Number(total) || 0) }, (_, index) => ({
    index: index + 1,
    role: getCampaignBrainCarouselCardRole(index, total)
  }));
}

function setCampaignBrainCarouselFiles(files = [], options = {}) {
  const nextFiles = Array.isArray(files) ? files.slice(0, 10) : [];
  const rendered = options.rendered === true;
  const previousFiles = getCampaignBrainCarouselFiles();
  const previousDrafts = getCampaignBrainCarouselCardDrafts();
  const previousDraftsByFingerprint = new Map(
    previousFiles.map((file, index) => [getMetaUploadFileFingerprint(file), previousDrafts[index] || null])
  );
  const nextDrafts = nextFiles.map((file, index) => {
    const fingerprint = getMetaUploadFileFingerprint(file);
    const preservedDraft = previousDraftsByFingerprint.get(fingerprint);
    return preservedDraft
      ? {
          title: preservedDraft.title || "",
          description: preservedDraft.description || ""
        }
      : buildDefaultCampaignBrainCarouselCardDraft(index);
  });

  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselSquareFiles: nextFiles,
    carouselSourceFiles: rendered
      ? (appState.campaignBrainMetaAssets?.carouselSourceFiles || previousFiles)
      : nextFiles,
    carouselCardDrafts: nextDrafts,
    carouselWarnings: [],
    carouselDesignReady: false
  };
}

function setCampaignBrainCarouselWarnings(warnings = []) {
  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselWarnings: Array.isArray(warnings) ? warnings : []
  };
}

function setCampaignBrainDraggingCardIndex(index = -1) {
  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    draggingCardIndex: Number.isInteger(Number(index)) ? Number(index) : -1
  };
}

function getCampaignBrainDraggingCardIndex() {
  const value = Number(appState.campaignBrainMetaAssets?.draggingCardIndex);
  return Number.isInteger(value) ? value : -1;
}

function removeCampaignBrainCarouselCard(index) {
  const numericIndex = Number(index);
  const files = getCampaignBrainCarouselFiles().slice();
  const sourceFiles = Array.isArray(appState.campaignBrainMetaAssets?.carouselSourceFiles)
    ? appState.campaignBrainMetaAssets.carouselSourceFiles.slice()
    : files.slice();
  const drafts = getCampaignBrainCarouselCardDrafts().slice();
  const warnings = getCampaignBrainCarouselWarnings().slice();
  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= files.length) {
    return;
  }

  files.splice(numericIndex, 1);
  sourceFiles.splice(numericIndex, 1);
  drafts.splice(numericIndex, 1);
  warnings.splice(numericIndex, 1);

  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselSquareFiles: files,
    carouselSourceFiles: sourceFiles,
    carouselCardDrafts: drafts,
    carouselWarnings: warnings,
    carouselDesignReady: false
  };
}

function loadImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const isRemote = Boolean(file?.remoteUrl || file?.sourceUrl);
    const objectUrl = isRemote ? getCampaignBrainAssetPreviewUrl(file) : URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const dimensions = {
        width: Number(image.naturalWidth || 0),
        height: Number(image.naturalHeight || 0)
      };
      if (!isRemote) URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };
    image.onerror = () => {
      if (!isRemote) URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read image dimensions for ${file.name || "carousel card"}.`));
    };
    image.src = objectUrl;
  });
}

async function inspectCampaignBrainCarouselFiles(files = []) {
  const warnings = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const fileWarnings = [];
    if (!file?.sourceUrl && Number(file?.size || 0) > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
      fileWarnings.push("Large file. Keep card images under roughly 3MB.");
    }

    try {
      const { width, height } = await loadImageDimensions(file);
      const ratio = height > 0 ? width / height : 0;
      if (!width || !height) {
        fileWarnings.push("Could not verify image dimensions.");
      } else {
        if (Math.abs(1 - ratio) > 0.08) {
          fileWarnings.push(`Not close to square (${width}x${height}). Carousel cards should be 1:1.`);
        }
        if (width < 1080 || height < 1080) {
          fileWarnings.push(`Low resolution (${width}x${height}). Aim for at least 1080x1080.`);
        }
      }
    } catch (error) {
      fileWarnings.push(error.message || "Could not inspect image.");
    }

    warnings.push({
      index,
      items: fileWarnings
    });
  }

  return warnings;
}

function updateCampaignBrainCarouselCardDraft(index, field = "", value = "") {
  const drafts = getCampaignBrainCarouselCardDrafts().slice();
  const numericIndex = Number(index);
  if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= drafts.length || !field) {
    return;
  }

  const current = drafts[numericIndex] || buildDefaultCampaignBrainCarouselCardDraft(numericIndex);
  drafts[numericIndex] = {
    ...current,
    [field]: value
  };
  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselCardDrafts: drafts,
    carouselDesignReady: false
  };
}

function moveCampaignBrainCarouselCard(index, direction) {
  const numericIndex = Number(index);
  const numericDirection = Number(direction);
  const nextIndex = numericIndex + numericDirection;
  const files = getCampaignBrainCarouselFiles().slice();
  const sourceFiles = Array.isArray(appState.campaignBrainMetaAssets?.carouselSourceFiles)
    ? appState.campaignBrainMetaAssets.carouselSourceFiles.slice()
    : files.slice();
  const drafts = getCampaignBrainCarouselCardDrafts().slice();
  if (!Number.isInteger(numericIndex) || !Number.isInteger(numericDirection) || numericIndex < 0 || nextIndex < 0 || numericIndex >= files.length || nextIndex >= files.length) {
    return;
  }

  [files[numericIndex], files[nextIndex]] = [files[nextIndex], files[numericIndex]];
  [sourceFiles[numericIndex], sourceFiles[nextIndex]] = [sourceFiles[nextIndex], sourceFiles[numericIndex]];
  [drafts[numericIndex], drafts[nextIndex]] = [drafts[nextIndex], drafts[numericIndex]];

  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselSquareFiles: files,
    carouselSourceFiles: sourceFiles,
    carouselCardDrafts: drafts,
    carouselDesignReady: false
  };
}

function reorderCampaignBrainCarouselCard(fromIndex, toIndex) {
  const sourceIndex = Number(fromIndex);
  const targetIndex = Number(toIndex);
  const files = getCampaignBrainCarouselFiles().slice();
  const sourceFiles = Array.isArray(appState.campaignBrainMetaAssets?.carouselSourceFiles)
    ? appState.campaignBrainMetaAssets.carouselSourceFiles.slice()
    : files.slice();
  const drafts = getCampaignBrainCarouselCardDrafts().slice();
  const warnings = getCampaignBrainCarouselWarnings().slice();
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= files.length || targetIndex >= files.length || sourceIndex === targetIndex) {
    return false;
  }

  const [file] = files.splice(sourceIndex, 1);
  const [sourceFile] = sourceFiles.splice(sourceIndex, 1);
  const [draft] = drafts.splice(sourceIndex, 1);
  const [warning] = warnings.splice(sourceIndex, 1);

  files.splice(targetIndex, 0, file);
  sourceFiles.splice(targetIndex, 0, sourceFile);
  drafts.splice(targetIndex, 0, draft);
  warnings.splice(targetIndex, 0, warning);

  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselSquareFiles: files,
    carouselSourceFiles: sourceFiles,
    carouselCardDrafts: drafts,
    carouselWarnings: warnings,
    draggingCardIndex: -1,
    carouselDesignReady: false
  };
  return true;
}

function clearCampaignBrainMetaResults() {
  appState.campaignBrainMetaValidationError = "";
  appState.campaignBrainMetaValidationResult = null;
  appState.campaignBrainMetaPushError = "";
  appState.campaignBrainMetaPushResult = null;
  appState.campaignBrainMetaSuggestError = "";
  appState.campaignBrainMetaSuggestResult = null;
}

function buildCampaignBrainCarouselTranslatedAttachments(cardCount = 0) {
  const drafts = getCampaignBrainCarouselCardDrafts();

  return Array.from({ length: cardCount }, (_, index) => {
    const draft = drafts[index] || buildDefaultCampaignBrainCarouselCardDraft(index);
    return {
      name: draft.title || "Westpack",
      description: draft.description || ""
    };
  });
}

function buildCampaignBrainUploadedCarouselVariants(options = {}) {
  const includeDataBase64 = options.includeDataBase64 === true;
  const files = getCampaignBrainCarouselFiles();

  return Promise.all(files.map(async (file) => {
    const item = {
      name: file.name,
      mime: file.type || "image/jpeg"
    };
    if (file?.sourceUrl) {
      item.source_url = file.sourceUrl;
    } else if (includeDataBase64) {
      if (file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
        throw new Error(getCreateImageUploadSizeMessage(file.name, "Carousel image"));
      }
      item.data_base64 = await readFileAsBase64(file);
    }
    return item;
  })).then((items) => items.length
    ? [{
        key: "square",
        label: "1:1 Carousel cards",
        aspectRatio: "1:1",
        items
      }]
    : []);
}

function buildCampaignBrainMetaPreview() {
  const meta = appState.campaignArtifactDraft?.artifacts?.meta || {};
  const config = deriveCampaignBrainMetaConfig();
  const assetNames = Array.isArray(appState.campaignAssemblyObject?.campaignObject?.assets)
    ? appState.campaignAssemblyObject.campaignObject.assets
    : [];

  return {
    source: meta.campaignAngle || appState.campaignBrainResult?.input?.title || "Campaign Brain Meta Draft",
    sourceId: "",
    targetCampaign: config.targetCampaignName || "Unassigned campaign",
    targetCampaignId: config.targetCampaignId || "",
    targetAdSet: config.targetAdSetName || "Unassigned ad set",
    targetAdSetId: config.targetAdSetId || "",
    targetLanguage: "en_GB",
    destinationUrl: config.destinationUrl || "https://www.westpack.com/",
    adFormat: config.adFormat || "Single image",
    creativeAssets: assetNames.map((name) => ({ name })),
    imageVariants: [],
    carouselVariants: [],
    videoVariants: [],
    translatedAttachments: [],
    primaryText: meta.primaryText || "",
    headline: meta.headline || "",
    description: meta.description || "",
    rationale: meta.rationale || ""
  };
}

function buildCampaignBrainMetaPayload(action = "validate_publish_draft") {
  const preview = buildCampaignBrainMetaPreview();
  const config = deriveCampaignBrainMetaConfig();
  const carouselFiles = getCampaignBrainCarouselFiles();
  return {
    ...buildMetaPublishPayload(preview),
    action,
    ad_format: "Carousel",
    target_language: "en_GB",
    campaign_studio_carousel: true,
    draft_only: true,
    translated_attachments: config.adFormat === "Carousel"
      ? buildCampaignBrainCarouselTranslatedAttachments(carouselFiles.length)
      : [],
    uploaded_carousel_variants: config.adFormat === "Carousel"
      ? carouselFiles.length
        ? [{
            key: "square",
            label: "1:1 Carousel cards",
            aspectRatio: "1:1",
            items: carouselFiles.map((file) => ({
              name: file.name,
              mime: file.type || "image/jpeg"
            }))
          }]
        : []
      : []
  };
}

function buildCampaignBrainCarouselPreviewMarkup() {
  const files = getCampaignBrainCarouselFiles();
  const drafts = getCampaignBrainCarouselCardDrafts();
  const meta = appState.campaignArtifactDraft?.artifacts?.meta || {};
  const destinationUrl = deriveCampaignBrainMetaConfig().destinationUrl || "https://www.westpack.com/";
  const domain = (() => {
    try {
      return new URL(destinationUrl).hostname.replace(/^www\./i, "");
    } catch {
      return "westpack.com";
    }
  })();

  if (!files.length) {
    return `
      <div class="campaign-studio-meta-preview-empty">
        <strong>No carousel preview yet</strong>
        <span>Attach at least 2 square cards to preview the Meta carousel flow.</span>
      </div>
    `;
  }

  return `
    <div class="campaign-studio-meta-preview-shell">
      <article class="campaign-studio-meta-preview-ad">
        <div class="campaign-studio-meta-preview-top">
          <div class="campaign-studio-meta-preview-brand">WP</div>
          <div>
            <strong>Westpack</strong>
            <p>Sponsored</p>
          </div>
        </div>
        <p class="campaign-studio-meta-preview-copy">${escapeHtml(meta.primaryText || "Meta primary text preview")}</p>
        <div class="campaign-studio-meta-preview-track">
          ${files.map((file, index) => {
            const draft = drafts[index] || buildDefaultCampaignBrainCarouselCardDraft(index);
            return `
              <article class="campaign-studio-meta-preview-card" data-campaign-meta-drop-index="${index}">
                <div class="campaign-studio-meta-preview-image-wrap">
                  <img class="campaign-studio-meta-preview-image" src="${escapeHtml(getCampaignBrainAssetPreviewUrl(file))}" alt="">
                  <span class="campaign-studio-meta-preview-index">${index + 1}/${files.length}</span>
                </div>
                <div class="campaign-studio-meta-preview-card-copy">
                  <strong>${escapeHtml(draft.title || meta.headline || "Westpack")}</strong>
                  <p>${escapeHtml(draft.description || meta.description || "")}</p>
                </div>
              </article>
            `;
          }).join("")}
        </div>
        <div class="campaign-studio-meta-preview-footer">
          <div>
            <span>${escapeHtml(domain)}</span>
            <strong>${escapeHtml(meta.headline || "Westpack carousel headline")}</strong>
          </div>
          <button type="button">Learn more</button>
        </div>
      </article>
    </div>
  `;
}

function renderCampaignBrainMetaPayloadPreview() {
  const node = document.getElementById("campaign-brain-meta-payload");
  if (!node) {
    return;
  }
  node.textContent = JSON.stringify(buildCampaignBrainMetaPayload(), null, 2);
}

function clearCampaignBrainMetaFeedback() {
  clearCampaignBrainMetaResults();
}

async function validateCampaignBrainMetaDraft() {
  if (!appState.campaignArtifactDraft?.artifacts?.meta) {
    appState.campaignBrainMetaValidationError = "Generate the artifact pack before validating a Meta draft.";
    renderCampaignBrainPanel();
    return null;
  }

  appState.campaignBrainMetaValidating = true;
  clearCampaignBrainMetaResults();
  renderCampaignBrainPanel();

  try {
    const metaReady = await refreshMetaConnectionStatus({ silent: true });
    if (!metaReady) {
      throw new Error(appState.metaConnection?.detail || "Meta connection failed.");
    }

    const result = await requestMetaPublish(buildCampaignBrainMetaPayload("validate_publish_draft"));
    appState.campaignBrainMetaValidationResult = result;
    return result;
  } catch (error) {
    appState.campaignBrainMetaValidationError = error.message || "Meta validation failed.";
    return null;
  } finally {
    appState.campaignBrainMetaValidating = false;
    renderCampaignBrainPanel();
  }
}

async function pushCampaignBrainMetaDraft() {
  if (!appState.campaignArtifactDraft?.artifacts?.meta) {
    appState.campaignBrainMetaPushError = "Generate the artifact pack before creating a Meta draft.";
    renderCampaignBrainPanel();
    return null;
  }
  if (appState.campaignStudioMode === "meta_master" && !appState.campaignMetaMaster?.qualityReview?.passed) {
    appState.campaignBrainMetaPushError = "A passed 90+ Creative Director review is required before Meta draft creation.";
    renderCampaignBrainPanel();
    return null;
  }

  appState.campaignBrainMetaPushing = true;
  clearCampaignBrainMetaResults();
  renderCampaignBrainPanel();

  try {
    const metaReady = await refreshMetaConnectionStatus({ silent: true });
    if (!metaReady) {
      throw new Error(appState.metaConnection?.detail || "Meta connection failed.");
    }

    const config = deriveCampaignBrainMetaConfig();
    const payload = buildCampaignBrainMetaPayload("create_new_ad");

    if (config.adFormat === "Carousel") {
      const uploadedCarouselVariants = await buildCampaignBrainUploadedCarouselVariants({ includeDataBase64: true });
      const finishedCardCount = uploadedCarouselVariants[0]?.items?.length || 0;
      if (!uploadedCarouselVariants.length || finishedCardCount < 3 || finishedCardCount > 6) {
        throw new Error("The finished Meta carousel requires between 3 and 6 designed square cards.");
      }
      payload.uploaded_carousel_variants = uploadedCarouselVariants;
      payload.translated_attachments = buildCampaignBrainCarouselTranslatedAttachments(uploadedCarouselVariants[0].items.length);
    }

    const result = await requestMetaPublish(payload);
    appState.campaignBrainMetaPushResult = result;
    await recordCurrentCampaignLearning("meta_draft_created", "meta", {
      externalDraftId: result?.adId || result?.ad?.id || result?.id || "",
      destination: "Meta Ads draft"
    });
    return result;
  } catch (error) {
    appState.campaignBrainMetaPushError = error.message || "Campaign Brain Meta draft push failed.";
    return null;
  } finally {
    appState.campaignBrainMetaPushing = false;
    renderCampaignBrainPanel();
  }
}

async function suggestCampaignBrainCarouselCards() {
  const cardCount = getCampaignBrainCarouselFiles().length;
  if (!appState.campaignArtifactDraft?.artifacts?.meta || cardCount < 5) {
    appState.campaignBrainMetaSuggestError = "Attach at least 5 carousel images before asking AI for the UK English copy system.";
    renderCampaignBrainPanel();
    return null;
  }

  appState.campaignBrainMetaSuggesting = true;
  clearCampaignBrainMetaResults();
  renderCampaignBrainPanel();

  try {
    const payload = readCampaignBrainPayload();
    const resolvedCardCount = 5;
    const cardPlan = buildCampaignBrainCarouselCardPlan(resolvedCardCount);
    const suggestionSourceFiles = Array.isArray(appState.campaignBrainMetaAssets?.carouselSourceFiles)
      ? appState.campaignBrainMetaAssets.carouselSourceFiles
      : getCampaignBrainCarouselFiles();
    const carouselImages = await Promise.all(
      suggestionSourceFiles.slice(0, resolvedCardCount).map(async (file, index) => {
        const remoteSource = String(file?.sourceUrl || file?.originalUrl || "").trim();
        return {
          index: index + 1,
          name: file.name || `card-${index + 1}`,
          image_url: /^https:\/\//i.test(remoteSource)
            ? remoteSource
            : `data:${file.type || "image/jpeg"};base64,${await readFileAsBase64(file)}`
        };
      })
    );
    const result = await requestCampaignCarouselSuggestions({
      ...payload,
      plan: appState.campaignBrainResult,
      metaArtifact: appState.campaignArtifactDraft?.artifacts?.meta || null,
      cardCount: resolvedCardCount,
      cardPlan,
      carouselImages
    });

    const nextDrafts = Array.from({ length: resolvedCardCount }, (_, index) => {
      const suggested = (result.cards || []).find((card) => Number(card?.index) === index + 1)
        || (result.cards || [])[index]
        || {};
      const current = getCampaignBrainCarouselCardDrafts()[index] || buildDefaultCampaignBrainCarouselCardDraft(index);
      return {
        title: suggested.title || current.title || "",
        description: suggested.description || current.description || ""
      };
    });

    appState.campaignBrainMetaAssets = {
      ...(appState.campaignBrainMetaAssets || {}),
      carouselCardDrafts: nextDrafts
    };
    const meta = appState.campaignArtifactDraft.artifacts.meta;
    meta.primaryText = result.primaryText || meta.primaryText || "";
    meta.headline = result.headline || meta.headline || "";
    meta.description = result.description || meta.description || "";
    meta.cta = result.cta || "LEARN_MORE";
    appState.campaignBrainMetaSuggestResult = result;
    persistCampaignStudioDraft();
    hydrateCampaignStudioDraftStatus("AI updated carousel card copy.");
    return result;
  } catch (error) {
    appState.campaignBrainMetaSuggestError = error.message || "Carousel card suggestions failed.";
    return null;
  } finally {
    appState.campaignBrainMetaSuggesting = false;
    renderCampaignBrainPanel();
  }
}

async function buildAndCreateCampaignBrainMetaCarouselDraft() {
  if (appState.campaignBrainMetaBuilding) return null;
  if (appState.campaignStudioMode === "meta_master" && appState.campaignMetaMaster?.qualityReview && !appState.campaignMetaMaster.qualityReview.passed) {
    appState.campaignBrainMetaPushError = "Creative Director has not passed this carousel yet. Apply the revision brief and re-review before creating the Meta draft.";
    renderCampaignBrainPanel();
    return null;
  }
  if (!getCampaignBrainMetaTargetModel().ready) {
    appState.campaignBrainMetaPushError = "Select the exact Meta campaign and ad set before creating the draft.";
    renderCampaignBrainPanel();
    return null;
  }
  if (getCampaignBrainCarouselFiles().length < 1) {
    appState.campaignBrainMetaPushError = "At least one approved campaign image is required for the finished carousel.";
    renderCampaignBrainPanel();
    return null;
  }

  appState.campaignBrainMetaBuilding = true;
  appState.campaignBrainMetaBuildPhase = "Writing the complete UK English copy system";
  clearCampaignBrainMetaResults();
  renderCampaignBrainPanel();
  try {
    const suggestion = await suggestCampaignBrainCarouselCards();
    if (!suggestion) throw new Error(appState.campaignBrainMetaSuggestError || "UK English copy generation failed.");

    appState.campaignBrainMetaBuildPhase = `Rendering ${appState.campaignMetaMaster.result?.carousel?.cards?.length || 3} designed 1080×1080 cards`;
    renderCampaignBrainPanel();
    const rendered = await renderCampaignMetaMasterCarousel();
    if (!rendered) throw new Error(appState.campaignMetaMaster.renderError || "Carousel design rendering failed.");

    if (appState.campaignStudioMode === "meta_master") {
      appState.campaignBrainMetaBuildPhase = "Independent Creative Director reviewing finished cards";
      renderCampaignBrainPanel();
      const creativeReview = await reviewCampaignMetaCarousel();
      if (!creativeReview?.passed) {
        throw new Error(appState.campaignMetaMaster.qualityError || `Creative Director requires revision${creativeReview?.overallScore ? ` (${creativeReview.overallScore}/100)` : ""}.`);
      }
    }

    appState.campaignBrainMetaBuildPhase = "Running live Meta preflight";
    renderCampaignBrainPanel();
    const validation = await validateCampaignBrainMetaDraft();
    if (!validation?.ok) throw new Error(appState.campaignBrainMetaValidationError || "Meta preflight failed.");

    appState.campaignBrainMetaBuildPhase = "Uploading and creating a paused Meta draft";
    renderCampaignBrainPanel();
    const result = await pushCampaignBrainMetaDraft();
    if (!result?.ok || result.status !== "PAUSED") {
      throw new Error(appState.campaignBrainMetaPushError || "Meta did not confirm a paused draft.");
    }
    hydrateCampaignStudioDraftStatus(`Meta draft ${result.adId || ""} created safely as PAUSED.`);
    return result;
  } catch (error) {
    appState.campaignBrainMetaPushError = error.message || "The complete Meta carousel workflow failed.";
    return null;
  } finally {
    appState.campaignBrainMetaBuilding = false;
    appState.campaignBrainMetaBuildPhase = "";
    renderCampaignBrainPanel();
  }
}

async function generateCampaignBrainEnvironmentSeries() {
  const sourceFiles = getCampaignBrainEnvironmentFiles();
  const selectedIndexes = getCampaignBrainEnvironmentSelectedSourceIndexes();
  const selectedFiles = selectedIndexes.length
    ? sourceFiles.filter((_, index) => selectedIndexes.includes(index))
    : sourceFiles;
  if (!selectedFiles.length) {
    appState.campaignBrainEnvironmentError = "Attach at least one raw product image before generating environment variants.";
    renderCampaignBrainPanel();
    return;
  }

  appState.campaignBrainEnvironmentLoading = true;
  clearCampaignBrainEnvironmentResults();
  renderCampaignBrainPanel();

  try {
    const payload = readCampaignBrainPayload();
    const environmentImages = await Promise.all(
      selectedFiles.map(async (file) => ({
        name: file.name || "environment-source.jpg",
        image_url: `data:${file.type || "image/jpeg"};base64,${await readFileAsBase64(file)}`
      }))
    );
    const approvedReference = getCampaignBrainEnvironmentApprovedReference();

    const result = await requestCampaignEnvironmentSeries({
      ...payload,
      plan: appState.campaignBrainResult || null,
      metaArtifact: appState.campaignArtifactDraft?.artifacts?.meta || null,
      environmentConfig: appState.campaignBrainEnvironmentConfig,
      environmentImages,
      styleReferenceImage: approvedReference?.imageUrl
        ? {
            name: approvedReference.name || "approved-reference.png",
            image_url: approvedReference.imageUrl
          }
        : null
    });

    appState.campaignBrainEnvironmentResult = result;
    persistCampaignStudioDraft();
    hydrateCampaignStudioDraftStatus("Environment series generated.");
  } catch (error) {
    appState.campaignBrainEnvironmentError = error.message || "Environment generation failed.";
  } finally {
    appState.campaignBrainEnvironmentLoading = false;
    renderCampaignBrainPanel();
  }
}

function applyCampaignEmailVisuals(images = []) {
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  const usableImages = (Array.isArray(images) ? images : []).filter((image) => image?.imageUrl).slice(0, 3);
  if (!email?.bodyHtml || !usableImages.length) return;
  const documentNode = new DOMParser().parseFromString(email.bodyHtml, "text/html");
  const imageNodes = [...documentNode.querySelectorAll("table.email-shell img")];
  usableImages.forEach((image, index) => {
    const target = imageNodes[index];
    if (!target) return;
    target.setAttribute("src", image.imageUrl);
    target.setAttribute("alt", `${appState.campaignBrainResult?.input?.title || "Campaign"} - ${image.role || `visual ${index + 1}`}`);
  });
  email.bodyHtml = `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
  email.visualAssets = usableImages.map((image) => ({
    role: image.role || "visual",
    name: image.name || "email-visual.jpg",
    imageId: image.imageId || "",
    imageUrl: image.imageUrl,
    hosted: Boolean(image.hosted)
  }));
}

async function generateCampaignEmailVisuals() {
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  if (!email?.bodyHtml || appState.campaignBrainEmailVisualsLoading) return;
  appState.campaignBrainEmailVisualsLoading = true;
  appState.campaignBrainEmailVisualsError = "";
  renderCampaignBrainPanel();
  try {
    const result = await requestCampaignEmailVisuals({
      ...readCampaignBrainPayload(),
      plan: appState.campaignBrainResult || null,
      emailArtifact: email,
      klaviyoAccount: appState.campaignBrainKlaviyoAccount || "DK"
    });
    if (!result.images?.length) throw new Error(result.errors?.[0]?.error || "Visual Composer returned no images.");
    appState.campaignBrainEmailVisualsResult = result;
    applyCampaignEmailVisuals(result.images);
    persistCampaignStudioDraft();
    hydrateCampaignStudioDraftStatus(`Visual Composer applied ${result.images.length} email visual${result.images.length === 1 ? "" : "s"}.`);
  } catch (error) {
    appState.campaignBrainEmailVisualsError = error.message || "Email visual generation failed.";
  } finally {
    appState.campaignBrainEmailVisualsLoading = false;
    renderCampaignBrainPanel();
  }
}

async function pushEnvironmentResultToCarousel(index = -1) {
  const images = Array.isArray(appState.campaignBrainEnvironmentResult?.images)
    ? appState.campaignBrainEnvironmentResult.images
    : [];
  if (!images.length) {
    appState.campaignBrainEnvironmentError = "Generate environment outputs before sending them to Meta carousel.";
    renderCampaignBrainPanel();
    return;
  }

  const selectedImages = Number(index) >= 0
    ? [images[Number(index)]].filter(Boolean)
    : images.filter((item) => String(item?.format || "").toLowerCase() === "square");

  try {
    if (!selectedImages.length) {
      throw new Error("No square environment outputs are available yet for Meta carousel.");
    }
    const files = selectedImages.map((item, itemIndex) => dataUrlToFile(
      item.imageUrl || "",
      `${(item.name || `environment-${itemIndex + 1}`).replace(/\.[a-z0-9]+$/i, "")}-${item.format || "environment"}-carousel.png`
    ));

    setCampaignBrainCarouselFiles(files);
    const warnings = await inspectCampaignBrainCarouselFiles(files);
    setCampaignBrainCarouselWarnings(warnings);
    clearCampaignBrainMetaResults();
    persistCampaignStudioDraft();
    hydrateCampaignStudioDraftStatus(selectedImages.length === 1
      ? "Environment variant pushed into Meta carousel lane."
      : `${selectedImages.length} environment variants pushed into Meta carousel lane.`);
    renderCampaignBrainPanel();
  } catch (error) {
    appState.campaignBrainEnvironmentError = error.message || "Could not move environment outputs into Meta carousel.";
    renderCampaignBrainPanel();
  }
}

function buildCampaignStudioAssetMapMarkup() {
  const assets = Array.isArray(appState.campaignAssemblyObject?.campaignObject?.assets)
    ? appState.campaignAssemblyObject.campaignObject.assets
    : [];
  const environmentImages = Array.isArray(appState.campaignBrainEnvironmentResult?.images)
    ? appState.campaignBrainEnvironmentResult.images
    : [];
  const approvedReference = getCampaignBrainEnvironmentApprovedReference();
  const libraryItems = getCampaignAssetLibraryItems();

  if (!assets.length && !environmentImages.length && !approvedReference?.imageUrl && !libraryItems.length) {
    return `
      <article class="campaign-studio-asset-card">
        <strong>No mapped assets yet</strong>
        <p>Assemble a campaign with a linked content task or manual assets to map images, video and source material.</p>
      </article>
    `;
  }

  const buckets = {
    image: [],
    video: [],
    html: [],
    other: [],
    environment: []
  };

  for (const asset of assets) {
    const text = String(asset || "");
    const lower = text.toLowerCase();
    const bucket = /\b(video|mp4|mov|reel|clip)\b/.test(lower)
      ? "video"
      : /\b(image|jpg|jpeg|png|gif|hero|banner|photo|billede)\b/.test(lower)
        ? "image"
        : /\b(html|blog|article|email)\b/.test(lower)
          ? "html"
          : "other";
    buckets[bucket].push(text);
  }

  if (approvedReference?.imageUrl) {
    buckets.environment.push(`approved reference | ${approvedReference.name || "Environment reference"}${approvedReference.format ? ` | ${approvedReference.format}` : ""}`);
  }

  for (const item of environmentImages) {
    buckets.environment.push([
      "generated environment",
      item?.name,
      item?.format,
      item?.role
    ].filter(Boolean).join(" | "));
  }

  for (const item of libraryItems) {
    buckets.environment.push([
      "library asset",
      getCampaignAssetDisplayType(item?.assetType || ""),
      item?.logicalName || item?.name,
      buildCampaignAssetVersionLabel(item),
      item?.format
    ].filter(Boolean).join(" | "));
  }

  const channelHints = {
    image: "Strongest for Meta static, email hero and blog support.",
    video: "Best used for Meta hooks, cutdowns and campaign teasers.",
    html: "Best used as campaign source narrative and blog/email structure.",
    other: "Useful as supporting context, proof or production notes.",
    environment: "Reusable luxury environment assets for Meta, lifecycle visuals and future campaign variants."
  };

  return Object.entries(buckets)
    .filter(([, values]) => values.length)
    .map(([bucket, values]) => `
      <article class="campaign-studio-asset-card">
        <span>${escapeHtml(bucket.toUpperCase())}</span>
        <strong>${escapeHtml(`${values.length} mapped asset${values.length === 1 ? "" : "s"}`)}</strong>
        <p>${escapeHtml(channelHints[bucket] || "")}</p>
        <div class="campaign-studio-asset-list">
          ${values.slice(0, 6).map((value) => `<span>${escapeHtml(value)}</span>`).join("")}
        </div>
      </article>
    `).join("");
}

function readCampaignBrainPayload() {
  const assembled = appState.campaignAssemblyObject?.brainInput || null;

  return {
    title: document.getElementById("campaign-brain-title")?.value || assembled?.title || "",
    objective: document.getElementById("campaign-brain-objective")?.value || assembled?.objective || "",
    audience: document.getElementById("campaign-brain-audience")?.value || assembled?.audience || "",
    offer: document.getElementById("campaign-brain-offer")?.value || assembled?.offer || "",
    channels: parseCampaignBrainList(document.getElementById("campaign-brain-channels")?.value || "").length
      ? parseCampaignBrainList(document.getElementById("campaign-brain-channels")?.value || "")
      : (assembled?.channels || []),
    markets: parseCampaignBrainList(document.getElementById("campaign-brain-markets")?.value || "").length
      ? parseCampaignBrainList(document.getElementById("campaign-brain-markets")?.value || "")
      : (assembled?.markets || []),
    assets: parseCampaignBrainList(document.getElementById("campaign-brain-assets")?.value || "").length
      ? parseCampaignBrainList(document.getElementById("campaign-brain-assets")?.value || "")
      : (assembled?.assets || []),
    constraints: parseCampaignBrainList(document.getElementById("campaign-brain-constraints")?.value || "").length
      ? parseCampaignBrainList(document.getElementById("campaign-brain-constraints")?.value || "")
      : (assembled?.constraints || []),
    source: {
      type: document.getElementById("campaign-brain-source-type")?.value || assembled?.source?.type || "brief",
      title: assembled?.source?.title || "",
      subject: document.getElementById("campaign-brain-source-subject")?.value || assembled?.source?.subject || "",
      body: document.getElementById("campaign-brain-source-body")?.value || assembled?.source?.body || "",
      html: assembled?.source?.html || ""
    },
    operatorNote: assembled?.operatorNote || "",
    campaignObject: appState.campaignAssemblyObject?.campaignObject || null
  };
}

function getCampaignEmailBuilderState(sectionCount = 0) {
  const state = appState.campaignEmailBuilder || (appState.campaignEmailBuilder = {});
  state.previewMode = ["desktop", "tablet", "mobile"].includes(state.previewMode) ? state.previewMode : "desktop";
  state.inspectorTab = ["content", "image", "design", "ai"].includes(state.inspectorTab) ? state.inspectorTab : "content";
  state.zoom = Math.min(120, Math.max(70, Number(state.zoom || 100)));
  state.history = Array.isArray(state.history) ? state.history : [];
  state.future = Array.isArray(state.future) ? state.future : [];
  state.inlineEditing = state.inlineEditing === true;
  state.selectionKind = state.selectionKind === "image" ? "image" : "module";
  state.imageTarget = state.imageTarget === "hero" ? "hero" : "module";
  state.libraryOpen = state.libraryOpen === true;
  const maximumIndex = Math.max(0, Number(sectionCount || 0) - 1);
  state.selectedIndex = Math.min(maximumIndex, Math.max(0, Number(state.selectedIndex || 0)));
  return state;
}

function getCampaignEmailBuilderQa(email = {}, sections = []) {
  const imageRequired = new Set(["image_full", "image_left", "image_right", "product_spotlight"]);
  const issues = [];
  if (!String(email.subject || "").trim()) issues.push("Subject is missing");
  if (!String(email.previewText || "").trim()) issues.push("Preview text is missing");
  if (!String(email.primaryCta || "").trim()) issues.push("CTA text is missing");
  if (!String(email.primaryCtaUrl || "").trim()) issues.push("CTA destination is missing");
  if (email.heroImageUrl && email.heroImageMode !== "none" && !String(email.heroImageAlt || "").trim()) issues.push("Hero image needs alt text");
  if (sections.length < 3) issues.push("At least three modules are required");
  sections.forEach((section, index) => {
    if (!String(section.headline || "").trim()) issues.push(`Module ${index + 1} needs a headline`);
    if (imageRequired.has(section.moduleId || section.layout) && !String(section.imageUrl || "").trim()) {
      issues.push(`Module ${index + 1} needs an approved image`);
    }
    if (String(section.imageUrl || "").trim() && section.imageMode !== "none" && !String(section.imageAlt || "").trim()) {
      issues.push(`Module ${index + 1} image needs alt text`);
    }
  });
  return { issues, ready: issues.length === 0 };
}

function buildCampaignEmailBuilderMarkup(email = {}, sections = [], context = {}) {
  const state = getCampaignEmailBuilderState(sections.length);
  const selected = sections[state.selectedIndex] || null;
  const imageLayouts = new Set(["image_full", "image_left", "image_right", "product_spotlight"]);
  const selectedHasImageSlot = selected ? imageLayouts.has(selected.moduleId || selected.layout) : false;
  const selectedImageActive = state.selectionKind === "image" && Boolean(selected?.imageUrl) && selected?.imageMode !== "none";
  const qa = getCampaignEmailBuilderQa(email, sections);
  const moduleLabel = (moduleId) => CAMPAIGN_EMAIL_MODULES.find(([id]) => id === moduleId)?.[1] || "Editorial module";
  const builderAssets = (Array.isArray(context.assets) ? context.assets : [])
    .filter((asset) => asset?.imageUrl || asset?.proxyUrl || asset?.sourceUrl)
    .filter((asset) => asset?.hosted === true
      ? /^https:\/\//i.test(String(asset.imageUrl || ""))
      : /^https:\/\//i.test(String(asset.sourceUrl || "")))
    .filter((asset, index, values) => values.findIndex((candidate) => (candidate.imageUrl || candidate.proxyUrl || candidate.sourceUrl) === (asset.imageUrl || asset.proxyUrl || asset.sourceUrl)) === index)
    .slice(0, 12);
  const moduleImageMarkup = selected ? `
    <header>
      <span>Image · Module ${state.selectedIndex + 1}</span>
      <strong>${selectedHasImageSlot ? "Choose, replace or crop" : "This module has no image area"}</strong>
      <p>${selectedHasImageSlot ? "Upload a file or choose a campaign asset. It is assigned directly to this module." : "Convert the selected module to an image layout first. Your text is preserved."}</p>
    </header>
    ${selectedHasImageSlot ? `
      <label class="campaign-email-builder-upload">
        <input type="file" accept="image/jpeg,image/png,image/webp" data-email-builder-file-upload="${state.selectedIndex}"${appState.campaignEmailBuilder.assetHosting ? " disabled" : ""}>
        <b>${appState.campaignEmailBuilder.assetHosting ? "Uploading…" : selected?.imageUrl && selected.imageMode !== "none" ? "Upload replacement" : "Upload image"}</b>
        <span>JPG, PNG or WebP · max 3 MB · uploaded to Klaviyo</span>
      </label>
      <section class="campaign-email-builder-media${selected?.imageUrl && selected.imageMode !== "none" ? "" : " is-empty"}">
        <div class="campaign-email-builder-media-head"><span>Current image</span><small>Module ${state.selectedIndex + 1}</small></div>
        ${selected?.imageUrl && selected.imageMode !== "none" ? `
          <div class="campaign-email-builder-media-preview">
            <img src="${escapeHtml(selected.imageUrl)}" alt="${escapeHtml(selected.imageAlt || "")}">
            <div class="campaign-email-builder-media-preview-actions">
              <button type="button" data-email-builder-crop-open="${state.selectedIndex}">Crop & position</button>
              <button type="button" data-email-builder-image-remove="${state.selectedIndex}" class="is-danger">Remove</button>
            </div>
          </div>
          <label class="campaign-email-builder-image-alt">Alt text<input value="${escapeHtml(selected.imageAlt || "")}" data-email-module-field="imageAlt" data-email-module-index="${state.selectedIndex}"></label>
        ` : `<div class="campaign-email-builder-media-empty"><b>No image selected</b><span>Use Upload image above or pick one from the gallery below.</span></div>`}
      </section>
      ${builderAssets.length ? `<div class="campaign-email-builder-assets campaign-email-builder-assets-large"><span>Campaign gallery <small>Click an image to use it</small></span><div>${builderAssets.map((asset) => `
        <button type="button" data-email-builder-image-url="${escapeHtml(asset.imageUrl || asset.proxyUrl || asset.sourceUrl || "")}" data-email-builder-image-source-url="${escapeHtml(asset.sourceUrl || asset.imageUrl || "")}" data-email-builder-image-hosted="${asset.hosted ? "true" : "false"}" data-email-builder-image-alt="${escapeHtml(asset.name || "Campaign image")}" class="${(asset.imageUrl || asset.proxyUrl || asset.sourceUrl) === selected.imageUrl && selected.imageMode !== "none" ? "is-active" : ""}" title="Use ${escapeHtml(asset.name || "image")}">
          <img draggable="false" src="${escapeHtml(asset.proxyUrl || asset.imageUrl || asset.sourceUrl || "")}" alt=""><small>${escapeHtml(asset.name || "Image")}</small>
        </button>`).join("")}</div></div>` : `<p class="campaign-email-builder-no-assets">No campaign images are available yet. Upload a file above.</p>`}
      <details class="campaign-email-builder-advanced-source">
        <summary>Use image URL instead</summary>
        <label>Approved image URL<input type="url" value="${escapeHtml(selected.imageUrl || "")}" data-email-module-field="imageUrl" data-email-module-index="${state.selectedIndex}"></label>
      </details>
    ` : `
      <div class="campaign-email-builder-layout-choice">
        <span>Choose an image layout</span>
        ${[["image_full", "Full-width image"], ["image_left", "Image left"], ["image_right", "Image right"], ["product_spotlight", "Product spotlight"]].map(([id, label]) => `<button type="button" data-email-builder-convert-image="${id}" data-email-module-index="${state.selectedIndex}">${label}<i>→</i></button>`).join("")}
      </div>
    `}` : `<p class="campaign-email-builder-empty">Add a campaign module to start editing.</p>`;
  const heroImageMarkup = `
    <header>
      <span>Email hero</span>
      <strong>${email.heroImageUrl && email.heroImageMode !== "none" ? "Replace or position hero image" : "Add an optional hero image"}</strong>
      <p>The hero is independent from module images and appears at the top of the email.</p>
    </header>
    <label class="campaign-email-builder-upload">
      <input type="file" accept="image/jpeg,image/png,image/webp" data-email-builder-hero-file-upload${appState.campaignEmailBuilder.assetHosting ? " disabled" : ""}>
      <b>${appState.campaignEmailBuilder.assetHosting ? "Uploading…" : email.heroImageUrl && email.heroImageMode !== "none" ? "Upload replacement" : "Upload hero image"}</b>
      <span>JPG, PNG or WebP · max 3 MB · uploaded to Klaviyo</span>
    </label>
    <section class="campaign-email-builder-media${email.heroImageUrl && email.heroImageMode !== "none" ? "" : " is-empty"}">
      <div class="campaign-email-builder-media-head"><span>Current hero</span><small>Top of email</small></div>
      ${email.heroImageUrl && email.heroImageMode !== "none" ? `
        <div class="campaign-email-builder-media-preview">
          <img src="${escapeHtml(email.heroImageUrl)}" alt="${escapeHtml(email.heroImageAlt || "")}">
          <div class="campaign-email-builder-media-preview-actions">
            <button type="button" data-email-builder-hero-image-reset>Reset framing</button>
            <button type="button" data-email-builder-hero-image-remove class="is-danger">Remove</button>
          </div>
        </div>
        <label class="campaign-email-builder-image-alt">Alt text<input value="${escapeHtml(email.heroImageAlt || "")}" data-campaign-artifact-field="email.heroImageAlt"></label>
        <div class="campaign-email-builder-composition">
          <label>Crop<select data-campaign-artifact-field="email.heroImageAspect">${[["natural", "Original ratio"], ["landscape", "Landscape · 3:2"], ["square", "Square · 1:1"], ["portrait", "Portrait · 4:5"]].map(([id, label]) => `<option value="${id}"${(email.heroImageAspect || "natural") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
          <div><span>Focal point</span><div class="campaign-email-builder-focal-grid" role="group" aria-label="Hero focal point">${["top_left", "top", "top_right", "left", "center", "right", "bottom_left", "bottom", "bottom_right"].map((point) => `<button type="button" data-email-builder-hero-focal-point="${point}" class="${(email.heroImageFocalPoint || "center") === point ? "is-active" : ""}" aria-label="${point.replaceAll("_", " ")}"><i></i></button>`).join("")}</div></div>
        </div>
      ` : `<div class="campaign-email-builder-media-empty"><b>No hero image selected</b><span>Upload a file or choose one from the campaign gallery.</span></div>`}
    </section>
    ${builderAssets.length ? `<div class="campaign-email-builder-assets campaign-email-builder-assets-large"><span>Campaign gallery <small>Click an image to use it as hero</small></span><div>${builderAssets.map((asset) => `
      <button type="button" data-email-builder-hero-asset-url="${escapeHtml(asset.imageUrl || asset.proxyUrl || asset.sourceUrl || "")}" data-email-builder-image-source-url="${escapeHtml(asset.sourceUrl || asset.imageUrl || "")}" data-email-builder-image-hosted="${asset.hosted ? "true" : "false"}" data-email-builder-image-alt="${escapeHtml(asset.name || "Campaign hero image")}" class="${(asset.imageUrl || asset.proxyUrl || asset.sourceUrl) === email.heroImageUrl && email.heroImageMode !== "none" ? "is-active" : ""}" title="Use ${escapeHtml(asset.name || "image")} as hero">
        <img src="${escapeHtml(asset.proxyUrl || asset.imageUrl || asset.sourceUrl || "")}" alt=""><small>${escapeHtml(asset.name || "Image")}</small>
      </button>`).join("")}</div></div>` : `<p class="campaign-email-builder-no-assets">No campaign images are available yet. Upload a file above.</p>`}
    <details class="campaign-email-builder-advanced-source">
      <summary>Use image URL instead</summary>
      <label>Approved hero URL<input type="url" value="${escapeHtml(email.heroImageUrl || "")}" data-campaign-artifact-field="email.heroImageUrl"></label>
    </details>`;
  const imageInspectorMarkup = `
    <div class="campaign-email-builder-image-workflow">
      <nav class="campaign-email-builder-image-targets" aria-label="Image placement">
        <button type="button" data-email-builder-image-target="module" aria-pressed="${state.imageTarget === "module" ? "true" : "false"}" class="${state.imageTarget === "module" ? "is-active" : ""}">Selected module</button>
        <button type="button" data-email-builder-image-target="hero" aria-pressed="${state.imageTarget === "hero" ? "true" : "false"}" class="${state.imageTarget === "hero" ? "is-active" : ""}">Email hero</button>
      </nav>
      ${state.imageTarget === "hero" ? heroImageMarkup : moduleImageMarkup}
    </div>`;
  const previewHtml = buildKlaviyoPreviewHtml({
    templateName: email.templateName || "",
    sourceTemplateName: context.sourceTemplateName || "",
    languageCode: context.marketLabel || "Master",
    translationPath: "Campaign Builder",
    subject: email.subject || "",
    previewText: email.previewText || "",
    body: email.bodyHtml || ""
  });

  return `
    <section class="campaign-email-builder" data-preview-mode="${escapeHtml(state.previewMode)}" data-library-open="${state.libraryOpen ? "true" : "false"}">
      <header class="campaign-email-builder-toolbar">
        <div>
          <span>Westpack Campaign Builder</span>
          <strong>Edit the AI draft without touching HTML</strong>
        </div>
        <div class="campaign-email-builder-toolbar-actions">
          <button type="button" data-email-builder-library-toggle aria-expanded="${state.libraryOpen ? "true" : "false"}" class="${state.libraryOpen ? "is-active" : ""}">Modules</button>
          <div class="campaign-email-builder-segmented" aria-label="Preview size">
            ${[["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"]].map(([id, label]) => `<button type="button" data-email-builder-preview="${id}" aria-pressed="${state.previewMode === id ? "true" : "false"}" class="${state.previewMode === id ? "is-active" : ""}">${label}</button>`).join("")}
          </div>
          <div class="campaign-email-builder-zoom" aria-label="Canvas zoom">
            <button type="button" data-email-builder-zoom="out"${state.zoom <= 70 ? " disabled" : ""}>−</button>
            <span>${escapeHtml(`${state.zoom}%`)}</span>
            <button type="button" data-email-builder-zoom="in"${state.zoom >= 120 ? " disabled" : ""}>+</button>
          </div>
          <button type="button" data-email-builder-undo${state.history.length ? "" : " disabled"}>Undo</button>
          <button type="button" data-email-builder-redo${state.future.length ? "" : " disabled"}>Redo</button>
          <span class="campaign-email-builder-save-state is-${escapeHtml(state.saveState || "saved")}" data-email-builder-save-state>${escapeHtml(state.saveMessage || "Saved locally")}</span>
        </div>
      </header>
      <div class="campaign-email-builder-grid">
        <aside class="campaign-email-builder-library">
          <div class="campaign-email-builder-pane-head"><span>Library</span><strong>Modules</strong></div>
          <div class="campaign-email-builder-library-list">
            ${CAMPAIGN_EMAIL_MODULES.map(([id, label], index) => `
              <article data-email-builder-library-module="${escapeHtml(id)}" title="Drag onto the canvas or click to add">
                <i class="campaign-email-builder-grip" aria-hidden="true">⠿</i>
                <button type="button" data-email-builder-add="${escapeHtml(id)}">
                  <i>${String(index + 1).padStart(2, "0")}</i><span><strong>${escapeHtml(label)}</strong><small>${sections.length >= 4 ? "Apply to selected or drag onto a module" : "Drag or click to add"}</small></span><b>${sections.length >= 4 ? "↻" : "+"}</b>
                </button>
              </article>
            `).join("")}
          </div>
          <div class="campaign-email-builder-locked">
            <span>Locked master</span>
            <strong>Header + footer</strong>
            <p>Logo, navigation, legal and unsubscribe remain protected.</p>
          </div>
        </aside>
        <main class="campaign-email-builder-canvas">
          <div class="campaign-email-builder-message-head">
            <label><span>Subject</span><input value="${escapeHtml(email.subject || "")}" data-campaign-artifact-field="email.subject"></label>
            <label><span>Preview</span><input value="${escapeHtml(email.previewText || "")}" data-campaign-artifact-field="email.previewText"></label>
          </div>
          <div class="campaign-email-builder-device" style="zoom:${state.zoom / 100}">
            <div class="campaign-email-builder-device-bar"><i></i><i></i><i></i><span>${escapeHtml(context.marketLabel || "Master")} · ${state.previewMode === "mobile" ? "390" : state.previewMode === "tablet" ? "560" : "640"} px</span></div>
            ${selected ? `<div class="campaign-email-builder-canvas-actions${state.inlineEditing ? " is-editing" : ""}" aria-label="Selected module actions"><span>${selectedImageActive ? "Image · " : ""}Module ${state.selectedIndex + 1}</span>${state.inlineEditing ? `<button type="button" data-email-builder-canvas-action="cancel-copy" data-email-module-index="${state.selectedIndex}">Cancel</button><button type="button" data-email-builder-canvas-action="save-copy" data-email-module-index="${state.selectedIndex}">Done</button>` : `<button type="button" data-email-builder-canvas-action="up" data-email-module-index="${state.selectedIndex}" aria-label="Move module up"${state.selectedIndex <= 0 ? " disabled" : ""}>↑</button><button type="button" data-email-builder-canvas-action="down" data-email-module-index="${state.selectedIndex}" aria-label="Move module down"${state.selectedIndex >= sections.length - 1 ? " disabled" : ""}>↓</button><button type="button" data-email-builder-canvas-action="edit-copy" data-email-module-index="${state.selectedIndex}">Edit text</button><button type="button" data-email-builder-canvas-action="media" data-email-module-index="${state.selectedIndex}">Image</button><button type="button" data-email-builder-canvas-action="duplicate" data-email-module-index="${state.selectedIndex}"${sections.length >= 4 ? " disabled" : ""}>Duplicate</button><button type="button" data-email-builder-canvas-action="delete" data-email-module-index="${state.selectedIndex}" class="is-danger"${selectedImageActive || sections.length > 3 ? "" : " disabled"}>${selectedImageActive ? "Remove image" : "Delete module"}</button>`}</div>` : ""}
            <iframe loading="lazy" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeHtml(previewHtml)}" title="Editable campaign email preview"></iframe>
            <div class="campaign-email-builder-canvas-drop" data-email-builder-canvas-drop>
              <header><strong>Choose an exact position</strong><span>Drop on the module that should own the image or layout.</span></header>
              <div class="campaign-email-builder-canvas-drop-slots">
                ${sections.map((section, index) => `<div data-email-builder-drop-index="${index}" data-email-builder-accepts-image="${imageLayouts.has(section.moduleId || section.layout) ? "true" : "false"}" class="${index === state.selectedIndex ? "is-selected" : ""}"><i>${String(index + 1).padStart(2, "0")}</i><strong>${escapeHtml(moduleLabel(section.moduleId || section.layout))}</strong><small>${escapeHtml(section.headline || "Untitled module")}</small></div>`).join("")}
                ${sections.length < 4 ? `<div data-email-builder-drop-index="${sections.length}" data-email-builder-accepts-image="false" class="is-add"><i>+</i><strong>Add at end</strong><small>New campaign module</small></div>` : ""}
              </div>
            </div>
          </div>
          <div class="campaign-email-builder-outline" aria-label="Email module order" data-email-builder-outline>
            ${sections.map((section, index) => `
              <article draggable="true" data-email-builder-drag-index="${index}" data-email-builder-drop-index="${index}" data-email-builder-accepts-image="${imageLayouts.has(section.moduleId || section.layout) ? "true" : "false"}" class="${index === state.selectedIndex ? "is-active" : ""}">
                <i class="campaign-email-builder-grip" aria-hidden="true">⠿</i>
                <button type="button" data-email-builder-select="${index}">
                  <i>${String(index + 1).padStart(2, "0")}</i><span><strong>${escapeHtml(moduleLabel(section.moduleId || section.layout))}</strong><small>${escapeHtml(section.headline || "Untitled module")}</small></span>
                </button>
              </article>
            `).join("")}
            <div class="campaign-email-builder-end-drop" data-email-builder-drop-index="${sections.length}"${sections.length >= 4 ? " hidden" : ""}>Drop to add at end</div>
          </div>
        </main>
        <aside class="campaign-email-builder-inspector" data-active-tab="${escapeHtml(state.inspectorTab)}">
          <div class="campaign-email-builder-pane-head"><span>Inspector</span><strong>${selected ? escapeHtml(`Module ${state.selectedIndex + 1}`) : "Email"}</strong></div>
          <nav class="campaign-email-builder-inspector-tabs" role="tablist" aria-label="Module editor">
            ${[["content", "Text"], ["image", "Image"], ["design", "Design"], ["ai", "AI"]].map(([id, label]) => `<button type="button" role="tab" aria-selected="${state.inspectorTab === id ? "true" : "false"}" data-email-builder-inspector-tab="${id}" class="${state.inspectorTab === id ? "is-active" : ""}">${label}</button>`).join("")}
          </nav>
          ${state.inspectorTab === "content" ? (selected ? `
              <div class="campaign-email-builder-inspector-actions">
                <button type="button" data-email-module-move="up" data-email-module-index="${state.selectedIndex}"${state.selectedIndex === 0 ? " disabled" : ""}>↑ Move</button>
                <button type="button" data-email-module-move="down" data-email-module-index="${state.selectedIndex}"${state.selectedIndex === sections.length - 1 ? " disabled" : ""}>↓ Move</button>
                <button type="button" data-email-builder-duplicate="${state.selectedIndex}"${sections.length >= 4 ? " disabled" : ""}>Duplicate</button>
                <button type="button" data-email-module-remove data-email-module-index="${state.selectedIndex}"${sections.length <= 3 ? " disabled" : ""}>Remove</button>
              </div>
              <div class="campaign-email-builder-module-settings">
                <label>Module type<select data-email-module-field="moduleId" data-email-module-index="${state.selectedIndex}">${CAMPAIGN_EMAIL_MODULES.map(([id, label]) => `<option value="${id}"${id === (selected.moduleId || selected.layout) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label>
                <label>Spacing<select data-email-module-field="spacing" data-email-module-index="${state.selectedIndex}">${[["compact", "Compact"], ["balanced", "Balanced"], ["airy", "Airy"]].map(([id, label]) => `<option value="${id}"${(selected.spacing || "balanced") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
              </div>
              <section class="campaign-email-builder-media${selectedHasImageSlot ? "" : " is-disabled"}" data-email-builder-drop-index="${state.selectedIndex}" data-email-builder-accepts-image="${selectedHasImageSlot ? "true" : "false"}">
                <div class="campaign-email-builder-media-head"><span>Module image</span><small>${selectedHasImageSlot ? `Owned by module ${state.selectedIndex + 1}` : "No image slot in this module"}</small></div>
                ${selectedHasImageSlot ? (selected.imageUrl && selected.imageMode !== "none" ? `
                  <div class="campaign-email-builder-media-current">
                    <img src="${escapeHtml(selected.imageUrl)}" alt="">
                    <div><strong>${escapeHtml(selected.imageAlt || "Campaign image")}</strong><small>Assigned only to this module</small></div>
                    <div class="campaign-email-builder-media-buttons"><button type="button" data-email-builder-crop-open="${state.selectedIndex}">Edit image</button><button type="button" data-email-builder-image-remove="${state.selectedIndex}">Remove</button></div>
                  </div>
                  <div class="campaign-email-builder-composition">
                    <label>Crop<select data-email-module-field="imageAspect" data-email-module-index="${state.selectedIndex}">${[["natural", "Original ratio"], ["landscape", "Landscape · 3:2"], ["square", "Square · 1:1"], ["portrait", "Portrait · 4:5"]].map(([id, label]) => `<option value="${id}"${(selected.imageAspect || "natural") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                    <div><span>Focal point</span><div class="campaign-email-builder-focal-grid" role="group" aria-label="Image focal point">${["top_left", "top", "top_right", "left", "center", "right", "bottom_left", "bottom", "bottom_right"].map((point) => `<button type="button" data-email-builder-focal-point="${point}" data-email-module-index="${state.selectedIndex}" class="${(selected.imageFocalPoint || "center") === point ? "is-active" : ""}" aria-label="${point.replaceAll("_", " ")}"><i></i></button>`).join("")}</div></div>
                    <button type="button" class="campaign-email-builder-image-reset" data-email-builder-image-reset="${state.selectedIndex}">Reset framing</button>
                  </div>` : `
                  <div class="campaign-email-builder-media-empty"><b>Drop an image here</b><span>No image is assigned. The compiler will keep this module empty until you choose one.</span></div>`)
                : `<div class="campaign-email-builder-media-empty"><b>Choose an image module first</b><span>Use Full-width image, Image left, Image right or Product spotlight. The editor never changes layouts automatically.</span></div>`}
              </section>
              ${builderAssets.length ? `<div class="campaign-email-builder-assets"><span>Campaign assets <small>Click to assign · drag to an exact image module</small></span><div>${builderAssets.map((asset) => `
                <button type="button" data-email-builder-image-url="${escapeHtml(asset.imageUrl || asset.proxyUrl || asset.sourceUrl || "")}" data-email-builder-image-source-url="${escapeHtml(asset.sourceUrl || asset.imageUrl || "")}" data-email-builder-image-hosted="${asset.hosted ? "true" : "false"}" data-email-builder-image-alt="${escapeHtml(asset.name || "Campaign image")}" class="${(asset.imageUrl || asset.proxyUrl || asset.sourceUrl) === selected.imageUrl && selected.imageMode !== "none" ? "is-active" : ""}" title="Click to use in the selected image module, or drag to an exact image module">
                  <img draggable="false" src="${escapeHtml(asset.proxyUrl || asset.imageUrl || asset.sourceUrl || "")}" alt=""><small>${escapeHtml(asset.name || "Image")}</small>
                </button>`).join("")}</div></div>` : ""}
              <details class="campaign-email-builder-advanced-source">
                <summary>Advanced image source</summary>
                <label>Approved image URL<input type="url" value="${escapeHtml(selected.imageUrl || "")}" data-email-module-field="imageUrl" data-email-module-index="${state.selectedIndex}"></label>
              </details>
              <label class="campaign-email-builder-legacy-image-alt">Image alt text<input value="${escapeHtml(selected.imageAlt || "")}" data-email-module-field="imageAlt" data-email-module-index="${state.selectedIndex}"></label>
              <label>Editorial label<input value="${escapeHtml(selected.label || "")}" data-email-module-field="label" data-email-module-index="${state.selectedIndex}"></label>
              <label>Headline<textarea rows="3" data-email-module-field="headline" data-email-module-index="${state.selectedIndex}">${escapeHtml(selected.headline || "")}</textarea></label>
              <label>Body<textarea rows="6" data-email-module-field="body" data-email-module-index="${state.selectedIndex}">${escapeHtml(selected.body || "")}</textarea></label>
              <label>Bullets, one per line<textarea rows="4" data-email-module-field="bullets" data-email-module-index="${state.selectedIndex}">${escapeHtml((selected.bullets || []).join("\n"))}</textarea></label>
              <div class="campaign-email-builder-cta">
                <label>Primary CTA<input value="${escapeHtml(email.primaryCta || "")}" data-campaign-artifact-field="email.primaryCta"></label>
                <label>Approved destination<input type="url" value="${escapeHtml(email.primaryCtaUrl || "")}" data-campaign-artifact-field="email.primaryCtaUrl"></label>
              </div>
            ` : `<p class="campaign-email-builder-empty">Add a campaign module to start editing.</p>`)
            : state.inspectorTab === "image" ? imageInspectorMarkup
            : state.inspectorTab === "design" ? `
              <div class="campaign-email-builder-design-panel">
                ${selected ? `<section class="campaign-email-builder-treatment">
                  <header><span>Selected module</span><strong>Composition</strong></header>
                  <div>
                    <label>Text alignment<select data-email-module-field="textAlign" data-email-module-index="${state.selectedIndex}">${[["left", "Left"], ["center", "Centered"]].map(([id, label]) => `<option value="${id}"${(selected.textAlign || "left") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                    <label>Copy width<select data-email-module-field="contentWidth" data-email-module-index="${state.selectedIndex}">${[["standard", "Standard"], ["narrow", "Narrow editorial"]].map(([id, label]) => `<option value="${id}"${(selected.contentWidth || "standard") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                    <label>Treatment<select data-email-module-field="surfaceStyle" data-email-module-index="${state.selectedIndex}">${[["plain", "Plain"], ["soft", "Soft panel"], ["outlined", "Fine outline"]].map(([id, label]) => `<option value="${id}"${(selected.surfaceStyle || "plain") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                    <label>Spacing<select data-email-module-field="spacing" data-email-module-index="${state.selectedIndex}">${[["compact", "Compact"], ["balanced", "Balanced"], ["airy", "Airy"]].map(([id, label]) => `<option value="${id}"${(selected.spacing || "balanced") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                  </div>
                </section>` : ""}
                <label>Visual direction<select data-campaign-artifact-field="email.visualDirection">${[["soft_luxury", "Soft luxury"], ["warm_editorial", "Warm editorial"], ["product_modular", "Product modular"], ["bold_commercial", "Bold commercial"]].map(([id, label]) => `<option value="${id}"${email.visualDirection === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                <label>Hero layout<select data-campaign-artifact-field="email.heroLayout">${[["copy_first", "Copy first"], ["image_first", "Image first"], ["typographic", "Typographic"]].map(([id, label]) => `<option value="${id}"${email.heroLayout === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                <label>Eyebrow<input value="${escapeHtml(email.eyebrow || "")}" data-campaign-artifact-field="email.eyebrow"></label>
                <label>Hero headline<textarea rows="4" data-campaign-artifact-field="email.heroHeadline">${escapeHtml(email.heroHeadline || "")}</textarea></label>
                <label>Hero introduction<textarea rows="5" data-campaign-artifact-field="email.intro">${escapeHtml(email.intro || "")}</textarea></label>
                <button type="button" class="campaign-email-builder-manage-hero" data-email-builder-go-hero-image><span>Hero image</span><strong>${email.heroImageUrl && email.heroImageMode !== "none" ? "Image assigned" : "No image assigned"}</strong><i>Manage in Image →</i></button>
                <label>Closing headline<input value="${escapeHtml(email.closingHeadline || "")}" data-campaign-artifact-field="email.closingHeadline"></label>
                <label>Closing copy<textarea rows="4" data-campaign-artifact-field="email.closingBody">${escapeHtml(email.closingBody || "")}</textarea></label>
                <section class="campaign-email-builder-treatment">
                  <header><span>Primary action</span><strong>CTA design</strong></header>
                  <div>
                    <label>Button style<select data-campaign-artifact-field="email.ctaStyle">${[["solid", "Solid"], ["outline", "Outline"], ["text", "Text link"]].map(([id, label]) => `<option value="${id}"${(email.ctaStyle || "solid") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                    <label>Alignment<select data-campaign-artifact-field="email.ctaAlign">${[["left", "Left"], ["center", "Centered"]].map(([id, label]) => `<option value="${id}"${(email.ctaAlign || "left") === id ? " selected" : ""}>${label}</option>`).join("")}</select></label>
                  </div>
                </section>
              </div>
            ` : `
              <div class="campaign-email-builder-ai-panel">
                <div class="campaign-email-builder-ai-intro"><span>AI copilot</span><strong>Improve only the selected module</strong><p>The campaign facts, module type and approved imagery stay locked.</p></div>
                <div class="campaign-email-builder-ai-actions">
                  ${[["sharpen", "Sharpen the message", "Remove filler and make the commercial point more specific."], ["shorten", "Make it shorter", "Reduce the copy while preserving the core persuasion and facts."], ["commercial", "More commercial", "Strengthen the customer value and decisive next step without inventing claims."], ["westpack", "More Westpack", "Align hierarchy, tone and specificity more closely with the selected Westpack Campaign Memory patterns."], ["alternatives", "Fresh creative route", "Rewrite the module with a materially fresher editorial angle while preserving its factual job."]].map(([id, label, instruction]) => `<button type="button" data-email-builder-ai="${id}" data-email-builder-ai-instruction="${escapeHtml(instruction)}"${state.aiLoading || !selected ? " disabled" : ""}><strong>${label}</strong><small>${instruction}</small></button>`).join("")}
                </div>
                ${state.aiLoading ? `<div class="campaign-email-builder-ai-loading"><i></i><span>Crafting a focused revision…</span></div>` : ""}
                ${state.aiError ? `<p class="campaign-email-builder-ai-error">${escapeHtml(state.aiError)}</p>` : ""}
                ${state.aiSuggestion ? `<article class="campaign-email-builder-ai-suggestion">
                  <header><span>Suggested revision</span><strong>${escapeHtml(state.aiSuggestion.headline || "")}</strong></header>
                  <div><small>Before</small><p>${escapeHtml(selected?.body || "")}</p></div>
                  <div class="is-after"><small>After</small><p>${escapeHtml(state.aiSuggestion.body || "")}</p></div>
                  <p class="campaign-email-builder-ai-rationale">${escapeHtml(state.aiSuggestion.rationale || "")}</p>
                  <footer><button type="button" data-email-builder-ai-dismiss>Keep original</button><button type="button" data-email-builder-ai-apply>Apply revision</button></footer>
                </article>` : ""}
              </div>
            `}
          <div class="campaign-email-builder-qa ${qa.ready ? "is-ready" : "is-warning"}">
            <span>Live preflight</span><strong>${qa.ready ? "Ready" : `${qa.issues.length} issue${qa.issues.length === 1 ? "" : "s"}`}</strong>
            <p>${escapeHtml(qa.ready ? "Master, modules and required production fields are complete." : qa.issues.slice(0, 3).join(" · "))}</p>
          </div>
        </aside>
      </div>
      ${state.cropEditorOpen && selected?.imageUrl && selected.imageMode !== "none" ? `<div class="campaign-email-crop-studio" role="dialog" aria-modal="true" aria-label="Image crop studio">
        <section>
          <header><div><span>Image studio · Module ${state.selectedIndex + 1}</span><strong>Compose the campaign image</strong><p>The final crop is baked into a new Klaviyo asset, so it remains stable across email clients.</p></div><button type="button" data-email-builder-crop-close aria-label="Close image studio">×</button></header>
          <div class="campaign-email-crop-grid">
            <div class="campaign-email-crop-stage" data-aspect="${escapeHtml(selected.imageAspect || "natural")}"><img src="${escapeHtml(selected.imageSourceUrl || selected.imageUrl)}" alt="${escapeHtml(selected.imageAlt || "Campaign image")}" style="object-position:${({ top_left:"left top",top:"center top",top_right:"right top",left:"left center",center:"center center",right:"right center",bottom_left:"left bottom",bottom:"center bottom",bottom_right:"right bottom" })[selected.imageFocalPoint || "center"]};transform:scale(${Math.max(100, Math.min(180, Number(selected.imageZoom || 100))) / 100})"></div>
            <aside><label>Zoom <output>${Math.max(100, Math.min(180, Number(selected.imageZoom || 100)))}%</output><input type="range" min="100" max="180" step="5" value="${Math.max(100, Math.min(180, Number(selected.imageZoom || 100)))}" data-email-module-field="imageZoom" data-email-module-index="${state.selectedIndex}"></label><label>Format<select data-email-module-field="imageAspect" data-email-module-index="${state.selectedIndex}">${[["natural","Original"],["landscape","Landscape · 3:2"],["square","Square · 1:1"],["portrait","Portrait · 4:5"]].map(([id,label])=>`<option value="${id}"${(selected.imageAspect||"natural")===id?" selected":""}>${label}</option>`).join("")}</select></label><div><span>Focus</span><div class="campaign-email-builder-focal-grid">${["top_left","top","top_right","left","center","right","bottom_left","bottom","bottom_right"].map(point=>`<button type="button" data-email-builder-focal-point="${point}" data-email-module-index="${state.selectedIndex}" class="${(selected.imageFocalPoint||"center")===point?"is-active":""}"><i></i></button>`).join("")}</div></div>${state.cropError ? `<p class="campaign-email-crop-error" role="alert">${escapeHtml(state.cropError)}</p>` : ""}<footer><button type="button" data-email-builder-crop-reset>Reset</button><button type="button" data-email-builder-crop-apply${state.cropApplying?" disabled":""}>${state.cropApplying?"Preparing…":"Apply crop"}</button></footer></aside>
          </div>
        </section>
      </div>` : ""}
    </section>`;
}

function renderCampaignBrainPanel() {
  renderCampaignAsanaSource();
  renderCampaignMetaMasterSource();
  renderContentAgentConsole();
  const statusNode = document.getElementById("campaign-brain-status");
  const assemblyGeneratedNode = document.getElementById("campaign-brain-assembly-generated-at");
  const assemblyGlanceNode = document.getElementById("campaign-brain-assembly-glance");
  const assemblySummaryNode = document.getElementById("campaign-brain-assembly-summary");
  const generatedNode = document.getElementById("campaign-brain-generated-at");
  const artifactsGeneratedNode = document.getElementById("campaign-brain-artifacts-generated-at");
  const artifactTitleNode = document.getElementById("campaign-brain-artifact-title");
  const summaryNode = document.getElementById("campaign-brain-summary");
  const channelNode = document.getElementById("campaign-brain-channel-plans");
  const assetNode = document.getElementById("campaign-brain-asset-plan");
  const workflowNode = document.getElementById("campaign-brain-workflow");
  const artifactsNode = document.getElementById("campaign-brain-artifacts");
  const assetMapNode = document.getElementById("campaign-studio-asset-map");
  const intakeProfileNode = document.getElementById("campaign-brain-intake-profile");
  const assembleButton = document.getElementById("campaign-brain-assemble-button");
  const artifactsButton = document.getElementById("campaign-brain-artifacts-button");
  const pushButton = document.getElementById("campaign-brain-push-klaviyo-button");
  const saveDraftButton = document.getElementById("campaign-brain-save-draft-button");
  const resetDraftButton = document.getElementById("campaign-brain-reset-draft-button");
  let environmentButton = document.getElementById("campaign-brain-generate-environment-button");
  let environmentFeedbackNode = document.getElementById("campaign-brain-environment-feedback");
  let accountSelect = document.getElementById("campaign-brain-klaviyo-account");
  let feedbackNode = document.getElementById("campaign-brain-klaviyo-feedback");
  let metaSuggestButton = document.getElementById("campaign-brain-suggest-meta-button");
  let metaBuildButton = document.getElementById("campaign-brain-build-meta-button");
  let metaValidateButton = document.getElementById("campaign-brain-validate-meta-button");
  let metaPushButton = document.getElementById("campaign-brain-push-meta-button");
  let metaFeedbackNode = document.getElementById("campaign-brain-meta-feedback");
  const brainPanel = document.getElementById("klaviyo-campaign-brain-panel");
  const result = appState.campaignBrainResult;
  const artifactResult = appState.campaignArtifactsResult;
  const artifactDraft = appState.campaignArtifactDraft;
  const assembled = appState.campaignAssemblyObject;
  const campaignObject = assembled?.campaignObject || null;
  const linkedTasks = campaignObject?.linkedTasks || {};
  const linking = assembled?.linking || {};
  const studioReady = Boolean(artifactResult?.artifacts && artifactDraft?.artifacts);

  if (brainPanel) {
    brainPanel.dataset.campaignMode = appState.campaignStudioMode;
    brainPanel.classList.toggle("is-studio-focus", studioReady);
    brainPanel.classList.toggle("is-guided-intake", ["asana_combo", "meta_master"].includes(appState.campaignStudioMode) && !studioReady);
    brainPanel.classList.toggle("is-manual-workspace-open", appState.campaignManualWorkspaceOpen);
    brainPanel.classList.toggle("is-agent-review-open", Boolean(appState.campaignStudioReviewJob && appState.campaignStudioReviewOpen));
    brainPanel.classList.toggle("is-agent-review-idle", Boolean(appState.campaignStudioReviewJob && !appState.campaignStudioReviewOpen));
    document.body.classList.toggle("campaign-studio-review-mode", Boolean(appState.campaignStudioReviewJob && appState.campaignStudioReviewOpen));
  }

  document.querySelectorAll("[data-campaign-mode]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-campaign-mode") === appState.campaignStudioMode);
  });
  document.querySelectorAll("[data-campaign-mode-group]").forEach((node) => {
    const allowedModes = String(node.getAttribute("data-campaign-mode-group") || "")
      .split(/\s+/)
      .filter(Boolean);
    node.hidden = !allowedModes.includes(appState.campaignStudioMode);
  });

  if (statusNode) {
    statusNode.textContent = appState.campaignAssemblyLoading
      ? "Assembling campaign object..."
      : appState.campaignBrainLoading
      ? "Generating..."
      : appState.campaignArtifactsLoading
        ? "Generating artifacts..."
      : appState.campaignBrainKlaviyoPushing
        ? "Creating Klaviyo draft..."
      : appState.campaignBrainMetaValidating
        ? "Validating Meta draft..."
      : appState.campaignBrainMetaSuggesting
        ? "Generating carousel card suggestions..."
      : appState.campaignBrainMetaPushing
        ? "Creating Meta draft..."
      : appState.campaignBrainEnvironmentLoading
        ? "Generating environment image series..."
      : appState.campaignBrainError
        ? appState.campaignBrainError
        : appState.campaignArtifactsError
          ? appState.campaignArtifactsError
          : appState.campaignAssemblyError
            ? appState.campaignAssemblyError
          : appState.campaignBrainKlaviyoPushError
            ? appState.campaignBrainKlaviyoPushError
          : appState.campaignBrainMetaValidationError
            ? appState.campaignBrainMetaValidationError
          : appState.campaignBrainMetaSuggestError
            ? appState.campaignBrainMetaSuggestError
          : appState.campaignBrainMetaPushError
            ? appState.campaignBrainMetaPushError
          : appState.campaignBrainEnvironmentError
            ? appState.campaignBrainEnvironmentError
        : result
          ? "Plan ready"
          : "Ready to analyze a brief";
    statusNode.classList.remove("online", "warning");
    if (appState.campaignAssemblyLoading || appState.campaignBrainLoading || appState.campaignArtifactsLoading || appState.campaignBrainKlaviyoPushing || appState.campaignBrainMetaValidating || appState.campaignBrainMetaSuggesting || appState.campaignBrainMetaPushing || appState.campaignBrainEnvironmentLoading) {
      statusNode.classList.add("warning");
    } else if ((appState.campaignAssemblyObject || result || artifactResult) && !appState.campaignBrainError && !appState.campaignArtifactsError && !appState.campaignAssemblyError && !appState.campaignBrainKlaviyoPushError && !appState.campaignBrainMetaValidationError && !appState.campaignBrainMetaSuggestError && !appState.campaignBrainMetaPushError && !appState.campaignBrainEnvironmentError) {
      statusNode.classList.add("online");
    } else if (appState.campaignBrainError || appState.campaignArtifactsError || appState.campaignAssemblyError || appState.campaignBrainKlaviyoPushError || appState.campaignBrainMetaValidationError || appState.campaignBrainMetaSuggestError || appState.campaignBrainMetaPushError || appState.campaignBrainEnvironmentError) {
      statusNode.classList.add("warning");
    }
  }

  if (accountSelect) {
    const accounts = getKlaviyoTemplateAccounts();
    if (!accounts.includes(appState.campaignBrainKlaviyoAccount)) {
      appState.campaignBrainKlaviyoAccount = accounts[0] || "DK";
    }
    accountSelect.innerHTML = accounts.map((account) => `
      <option value="${escapeHtml(account)}"${account === appState.campaignBrainKlaviyoAccount ? " selected" : ""}>${escapeHtml(account)}</option>
    `).join("");
    accountSelect.disabled = appState.campaignBrainKlaviyoPushing;
  }

  if (generatedNode) {
    generatedNode.textContent = appState.campaignBrainGeneratedAt
      ? `Generated ${formatKlaviyoDate(appState.campaignBrainGeneratedAt)}`
      : "No plan generated yet.";
  }

  if (assemblyGeneratedNode) {
    assemblyGeneratedNode.textContent = appState.campaignAssemblyGeneratedAt
      ? `Assembled ${formatKlaviyoDate(appState.campaignAssemblyGeneratedAt)}`
      : "No campaign object assembled yet.";
  }

  if (assemblyGlanceNode) {
    const linkingState = assembled?.linking || null;
    const sourceProfile = assembled?.sourceProfile || null;
    if (!assembled?.campaignObject) {
      assemblyGlanceNode.innerHTML = `
        <article class="campaign-brain-glance-card">
          <span>Mode</span>
          <strong>${escapeHtml(appState.campaignStudioMode.replace(/_/g, " "))}</strong>
          <p>Choose the cleanest campaign intake mode before assembling.</p>
        </article>
      `;
    } else {
      const assetTypes = sourceProfile?.assetTypes || {};
      const assetSummary = Object.entries(assetTypes)
        .filter(([, count]) => Number(count) > 0)
        .map(([key, count]) => `${count} ${key}`)
        .join(" | ") || "No classified assets";

      assemblyGlanceNode.innerHTML = `
        <article class="campaign-brain-glance-card tone-${escapeHtml(linkingState?.confidence || "neutral")}">
          <span>Link confidence</span>
          <strong>${escapeHtml((linkingState?.confidence || "unknown").toUpperCase())}</strong>
          <p>${escapeHtml(linkingState?.recommendedNextStep || "--")}</p>
        </article>
        <article class="campaign-brain-glance-card">
          <span>Source profile</span>
          <strong>${escapeHtml(sourceProfile?.narrativeStrength || "--")}</strong>
          <p>${escapeHtml(sourceProfile?.hasHtml ? "HTML-led source available." : "No structured HTML source yet.")}</p>
        </article>
        <article class="campaign-brain-glance-card">
          <span>Asset mix</span>
          <strong>${escapeHtml(assetSummary)}</strong>
          <p>${escapeHtml(`Input mode: ${appState.campaignStudioMode.replace(/_/g, " ")}`)}</p>
        </article>
      `;
    }
  }

  if (assetMapNode) {
    assetMapNode.innerHTML = buildCampaignStudioAssetMapMarkup();
  }

  if (intakeProfileNode) {
    const intakeProfile = appState.campaignAssemblyObject?.intakeProfile || null;
    if (!intakeProfile) {
      intakeProfileNode.innerHTML = `
        <article class="campaign-studio-intake-card">
          <strong>No intake profile yet</strong>
          <p>Assemble the campaign and content tasks first to expose the parsed brief, CTA, timing and commercial signals.</p>
        </article>
      `;
    } else {
      intakeProfileNode.innerHTML = `
        <article class="campaign-studio-intake-card">
          <span>Subject</span>
          <strong>${escapeHtml(intakeProfile.subjectSuggestion || "--")}</strong>
          <p>${escapeHtml(intakeProfile.briefing || "No briefing block parsed yet.")}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Objective</span>
          <strong>${escapeHtml(intakeProfile.objective || "--")}</strong>
          <p>${escapeHtml(`Audience: ${intakeProfile.audience || "--"}`)}</p>
          <p>${escapeHtml(`Offer: ${intakeProfile.offer || "--"}`)}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Timing / CTA</span>
          <strong>${escapeHtml(intakeProfile.timing || "--")}</strong>
          <p>${escapeHtml(`CTA: ${intakeProfile.cta || "--"}`)}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Commercial signals</span>
          <strong>${escapeHtml((intakeProfile.commercialSignals || []).join(" | ") || "--")}</strong>
          <p>${escapeHtml(`Linked URLs: ${(intakeProfile.linkedUrls || []).length || 0}`)}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Content package</span>
          <strong>${escapeHtml((intakeProfile.contentFormats || []).join(" | ") || intakeProfile.contentMode || "--")}</strong>
          <p>${escapeHtml(`Mode: ${intakeProfile.contentMode || "--"} / Attachments: ${intakeProfile.contentAttachmentCount || 0}`)}</p>
          <p>${escapeHtml(`Families: ${(intakeProfile.contentFamilies || []).join(" | ") || "--"}`)}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Asset readiness</span>
          <strong>${escapeHtml((intakeProfile.readyAssets || []).join(" | ") || "No ready asset subtasks")}</strong>
          <p>${escapeHtml(`Pending: ${(intakeProfile.pendingAssets || []).join(" | ") || "None"}`)}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Constraints</span>
          <strong>${escapeHtml((intakeProfile.constraints || []).join(" | ") || "--")}</strong>
          <p>${escapeHtml(`Source depth: ${intakeProfile.sourceDepth?.hasHtml ? "HTML" : "No HTML"} / ${intakeProfile.sourceDepth?.assetCount || 0} assets`)}</p>
        </article>
        <article class="campaign-studio-intake-card">
          <span>Task match</span>
          <strong>${escapeHtml(intakeProfile.matchConfidence || "--")}</strong>
          <p>${escapeHtml(`Campaign/content link confidence from assembled intake.`)}</p>
        </article>
      `;
    }
  }

  if (artifactsGeneratedNode) {
    artifactsGeneratedNode.textContent = appState.campaignArtifactsGeneratedAt
      ? `Generated ${formatKlaviyoDate(appState.campaignArtifactsGeneratedAt)}`
      : "No artifact pack generated yet.";
  }

  if (artifactTitleNode) {
    artifactTitleNode.textContent = studioReady ? "Campaign Studio" : "Email + Meta + Blog";
  }

  if (assemblySummaryNode) {
    if (!assembled?.campaignObject) {
      assemblySummaryNode.innerHTML = `
        <div class="klaviyo-rollout-empty">
          <span>Assemble the campaign task and content task into one normalized campaign object first.</span>
        </div>
      `;
    } else {
      const summary = assembled.summary || {};
      const taskPair = [linkedTasks.campaignTask?.title, linkedTasks.contentTask?.title].filter(Boolean);
      const signals = (linking.signals || []).filter(Boolean);
      assemblySummaryNode.innerHTML = studioReady
        ? `
          <section class="campaign-brain-brief-rail">
            <article class="campaign-brain-brief-card is-wide">
              <span>Task pairing</span>
              <strong>${escapeHtml(taskPair.join(" + ") || "Campaign task and content task still missing")}</strong>
              <p>${escapeHtml(linking.recommendedNextStep || "Studio is working from the assembled campaign object.")}</p>
            </article>
            <article class="campaign-brain-brief-card">
              <span>Channels</span>
              <strong>${escapeHtml((campaignObject.channels || []).join(", ") || "--")}</strong>
              <p>${escapeHtml((campaignObject.markets || []).join(", ") || "No markets")}</p>
            </article>
            <article class="campaign-brain-brief-card">
              <span>Asset depth</span>
              <strong>${escapeHtml(String(summary.assetCount || 0))}</strong>
              <p>${escapeHtml(campaignObject.campaignKey || "--")}</p>
            </article>
            <article class="campaign-brain-brief-card">
              <span>Signals</span>
              <strong>${escapeHtml((linking.confidence || "unknown").toUpperCase())}</strong>
              <p>${escapeHtml(signals.join(" | ") || "No linking signals yet")}</p>
            </article>
          </section>
        `
        : `
          <article class="klaviyo-summary-note">
            <span>Campaign key</span>
            <strong>${escapeHtml(campaignObject.campaignKey || "--")}</strong>
          </article>
          <article class="klaviyo-summary-note">
            <span>Campaign task</span>
            <strong>${escapeHtml(linkedTasks.campaignTask?.title || "Missing")}</strong>
          </article>
          <article class="klaviyo-summary-note">
            <span>Content task</span>
            <strong>${escapeHtml(linkedTasks.contentTask?.title || "Missing")}</strong>
          </article>
          <article class="klaviyo-summary-note">
            <span>Channels</span>
            <strong>${escapeHtml((campaignObject.channels || []).join(", ") || "--")}</strong>
          </article>
          <article class="klaviyo-summary-note">
            <span>Markets</span>
            <strong>${escapeHtml((campaignObject.markets || []).join(", ") || "--")}</strong>
          </article>
          <article class="klaviyo-summary-note">
            <span>Assets</span>
            <strong>${escapeHtml(String(summary.assetCount || 0))}</strong>
          </article>
          <article class="klaviyo-summary-note">
            <span>Signals</span>
            <strong>${escapeHtml(signals.join(" | ") || "No linking signals yet")}</strong>
          </article>
        `;
    }
  }

  if (summaryNode) {
    if (!result) {
      summaryNode.innerHTML = `
        <div class="klaviyo-rollout-empty">
          <span>Feed the machine a real brief and it will return a cross-channel execution plan.</span>
        </div>
      `;
    } else {
      const campaign = result.campaign || {};
      const audit = result.sourceAudit || {};
      summaryNode.innerHTML = studioReady
        ? `
          <section class="campaign-brain-plan-hero">
            <article class="campaign-brain-plan-card is-primary">
              <span>Campaign direction</span>
              <strong>${escapeHtml(campaign.summary || "No summary returned")}</strong>
              <p>${escapeHtml(campaign.coreAngle || "--")}</p>
              <div class="campaign-brain-pill-row">
                <span class="campaign-brain-pill">${escapeHtml(campaign.corePromise || "--")}</span>
                <span class="campaign-brain-pill">${escapeHtml(campaign.primaryCta || "--")}</span>
              </div>
            </article>
            <article class="campaign-brain-plan-card">
              <span>Source audit</span>
              <strong>${escapeHtml(audit.verdict || "--")}</strong>
              <p>${escapeHtml(audit.summary || "--")}</p>
              <div class="campaign-brain-pill-row">
                ${(audit.strengths || []).slice(0, 2).map((item) => `<span class="campaign-brain-pill is-soft">${escapeHtml(item)}</span>`).join("")}
                ${(audit.gaps || []).slice(0, 2).map((item) => `<span class="campaign-brain-pill is-warning">${escapeHtml(item)}</span>`).join("")}
              </div>
            </article>
          </section>
        `
        : `
          <div class="klaviyo-rollout-card">
            <strong>${escapeHtml(campaign.summary || "No summary returned")}</strong>
            <span>${escapeHtml(campaign.coreAngle || "--")}</span>
            <span>${escapeHtml(campaign.corePromise || "--")}</span>
            <span>${escapeHtml(campaign.primaryCta || "--")}</span>
          </div>
          <div class="klaviyo-rollout-card">
            <strong>Source audit: ${escapeHtml(audit.verdict || "--")}</strong>
            <span>${escapeHtml(audit.summary || "--")}</span>
            <span>Strengths: ${escapeHtml((audit.strengths || []).join(" | ") || "--")}</span>
            <span>Gaps: ${escapeHtml((audit.gaps || []).join(" | ") || "--")}</span>
          </div>
        `;
    }
  }

  if (channelNode) {
    channelNode.innerHTML = result
      ? (result.channelPlans || []).map((plan) => `
          <article class="agent-item">
            <strong>${escapeHtml((plan.channel || "").toUpperCase())}</strong>
            <p>${escapeHtml(plan.goal || "--")}</p>
            <p><strong>Angle:</strong> ${escapeHtml(plan.angle || "--")}</p>
            <p><strong>Deliverables:</strong> ${escapeHtml((plan.deliverables || []).map((item) => `${item.type}: ${item.title} [${item.status}]`).join(" | ") || "--")}</p>
            <p><strong>Dependencies:</strong> ${escapeHtml((plan.dependencies || []).join(" | ") || "--")}</p>
          </article>
        `).join("")
      : `<div class="klaviyo-rollout-empty"><span>No channel plan yet.</span></div>`;
  }

  if (assetNode) {
    const assetPlan = result?.assetPlan || null;
    assetNode.innerHTML = assetPlan
      ? `
          <article class="agent-item">
            <strong>Ready assets</strong>
            <p>${escapeHtml((assetPlan.readyAssets || []).join(" | ") || "--")}</p>
          </article>
          <article class="agent-item">
            <strong>Missing assets</strong>
            <p>${escapeHtml((assetPlan.missingAssets || []).join(" | ") || "--")}</p>
          </article>
          <article class="agent-item">
            <strong>Recommendations</strong>
            <p>${escapeHtml((assetPlan.recommendations || []).join(" | ") || "--")}</p>
          </article>
        `
      : `<div class="klaviyo-rollout-empty"><span>No asset analysis yet.</span></div>`;
  }

  if (workflowNode) {
    workflowNode.innerHTML = result
      ? (result.workflow || []).map((step, index) => `
          <article class="agent-item">
            <strong>${escapeHtml(`${index + 1}. ${step.step || "Step"}`)}</strong>
            <p>${escapeHtml(step.objective || "--")}</p>
            <p><strong>Output:</strong> ${escapeHtml(step.output || "--")}</p>
            <p><strong>Owner / status:</strong> ${escapeHtml(`${step.owner || "--"} / ${step.status || "--"}`)}</p>
          </article>
        `).join("")
      : `<div class="klaviyo-rollout-empty"><span>No workflow yet.</span></div>`;
  }

  if (assembleButton) {
    assembleButton.disabled = appState.campaignAssemblyLoading || appState.campaignBrainLoading || appState.campaignArtifactsLoading;
    assembleButton.classList.toggle("is-loading", appState.campaignAssemblyLoading);
  }

  if (artifactsButton) {
    artifactsButton.disabled = !result || appState.campaignBrainLoading || appState.campaignArtifactsLoading;
  }

  if (saveDraftButton) {
    saveDraftButton.disabled = !artifactDraft?.artifacts || appState.campaignArtifactsLoading;
  }

  if (resetDraftButton) {
    resetDraftButton.disabled = !artifactDraft?.artifacts || appState.campaignArtifactsLoading;
  }

  if (pushButton) {
    const hasEmailArtifact = Boolean(artifactDraft?.artifacts?.email?.bodyHtml);
    pushButton.disabled = !hasEmailArtifact || appState.campaignBrainLoading || appState.campaignArtifactsLoading || appState.campaignBrainKlaviyoPushing;
    pushButton.textContent = appState.campaignBrainKlaviyoPushing ? "Creating draft..." : "Create Klaviyo draft";
    pushButton.classList.toggle("is-loading", appState.campaignBrainKlaviyoPushing);
    pushButton.setAttribute("aria-busy", appState.campaignBrainKlaviyoPushing ? "true" : "false");
  }

  if (artifactsNode) {
    if (!artifactResult?.artifacts || !artifactDraft?.artifacts) {
      artifactsNode.innerHTML = `
        <div class="klaviyo-variant-preview-empty">
          <strong>No artifact pack yet</strong>
          <span>Generate the campaign plan first, then create the first production pack.</span>
        </div>
      `;
    } else {
      const email = artifactDraft.artifacts.email || {};
      const emailSections = (Array.isArray(email.sections) ? email.sections : []).slice(0, 4);
      const universalContentLocked = Boolean(email.universalContent?.locked)
        || /data-universal-content=["']Header - 2023["']/i.test(String(email.bodyHtml || ""));
      const emailVisualAssets = Array.isArray(email.visualAssets) ? email.visualAssets : [];
      const meta = artifactDraft.artifacts.meta || {};
      const blog = artifactDraft.artifacts.blog || {};
      const metaConfig = deriveCampaignBrainMetaConfig();
      const metaTargetModel = getCampaignBrainMetaTargetModel();
      const intelligenceState = appState.metaHistoricalIntelligence || {};
      const intelligenceSnapshot = intelligenceState.snapshot || null;
      const intelligencePatterns = Array.isArray(intelligenceSnapshot?.dna?.topPatterns)
        ? intelligenceSnapshot.dna.topPatterns.slice(0, 5)
        : [];
      const designTranslation = appState.campaignMetaMaster?.result?.designTranslation || null;
      const designPalette = designTranslation?.palette || null;
      const creativeRoutes = Array.isArray(appState.campaignMetaMaster?.result?.creativeRoutes?.routes)
        ? appState.campaignMetaMaster.result.creativeRoutes.routes
        : [];
      const metaQualityReview = appState.campaignMetaMaster?.qualityReview || null;
      const environmentConfig = appState.campaignBrainEnvironmentConfig || {};
      const selectedEnvironmentFormats = getCampaignBrainEnvironmentSelectedFormats();
      const environmentFiles = getCampaignBrainEnvironmentFiles();
      const environmentResult = appState.campaignBrainEnvironmentResult || null;
      const approvedReference = getCampaignBrainEnvironmentApprovedReference();
      const libraryItems = getCampaignAssetLibraryItems();
      const sourceAssetState = appState.campaignStudioSourceAssets || { loading: false, error: "", items: [] };
      const sourceVisuals = Array.isArray(sourceAssetState.items) ? sourceAssetState.items : [];
      const reviewJob = appState.campaignStudioReviewJob || null;
      const reviewScore = Number(appState.campaignStudioMode === "meta_master"
        ? metaQualityReview?.overallScore || 0
        : reviewJob?.output?.qualityAudit?.score || reviewJob?.qualityIterations?.at(-1)?.review?.overallScore || 0);
      const reviewFloor = Number(appState.campaignStudioMode === "meta_master"
        ? metaQualityReview?.dimensionFloor || 0
        : reviewJob?.output?.qualityAudit?.gate?.dimensionFloor || 0);
      const visibleLibraryItems = appState.campaignBrainAssetLibrary?.scope === "all"
        ? getCampaignAssetLibraryAllItems()
        : libraryItems;
      const carouselFiles = getCampaignBrainCarouselFiles();
      const taskPair = [linkedTasks.campaignTask?.title, linkedTasks.contentTask?.title].filter(Boolean);
      const memoryReferences = (artifactResult?.memoryReferences?.length
        ? artifactResult.memoryReferences
        : result?.memoryReferences) || [];
      const ownedMemoryCount = memoryReferences.filter((reference) => reference?.sourceType === "owned_campaign").length;
      const externalMemoryCount = memoryReferences.filter((reference) => reference?.sourceType === "external_inspiration").length;
      const packTitle = linkedTasks.campaignTask?.title
        || artifactDraft.title
        || artifactResult.title
        || result?.input?.title
        || "Campaign design studio";
      const directionLine = result?.campaign?.summary
        || [result?.campaign?.coreAngle, result?.campaign?.corePromise].filter(Boolean).join(" | ")
        || "Shape the campaign across email, Meta and reusable environment assets from one persistent studio layer.";
      const metaPrimarySnippet = String(meta.primaryText || "").replace(/\s+/g, " ").trim();
      const metaPreviewSnippet = metaPrimarySnippet.length > 220 ? `${metaPrimarySnippet.slice(0, 217)}...` : metaPrimarySnippet;
      const blogExcerptSnippet = String(blog.excerpt || "").replace(/\s+/g, " ").trim();
      const blogPreviewSnippet = blogExcerptSnippet.length > 200 ? `${blogExcerptSnippet.slice(0, 197)}...` : blogExcerptSnippet;
      const blogBodyText = String(blog.bodyHtml || "")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
      const blogReadingMinutes = Math.max(1, Math.ceil(blogBodyText.split(/\s+/).filter(Boolean).length / 220));
      const adFormatRequirements = metaConfig.adFormat === "Video"
        ? [
            "Requires square and vertical video variants before publish.",
            "Validation can succeed once both video variants are attached or linked."
          ]
        : metaConfig.adFormat === "Carousel"
          ? [
              "Requires at least 2 square carousel cards before publish.",
              carouselFiles.length
                ? `${carouselFiles.length} carousel cards are connected and ready for review.`
                : "Attach or generate at least 2 square cards before validation."
            ]
          : [
              "Requires 1:1, 4:5 and 9:16 image variants before publish.",
              "Current studio still needs a direct attachment lane for static image variants."
            ];
      artifactsNode.innerHTML = `
        <section class="campaign-design-studio-shell">
        <article class="klaviyo-variant-card campaign-studio-master-card">
          <div class="campaign-studio-master-copy">
            <div class="campaign-studio-review-breadcrumb">
              <div class="campaign-studio-review-breadcrumb-actions">
                <button type="button" id="campaign-studio-back-to-agent"><span>←</span> Content Agent</button>
                ${reviewJob?.state === "ready_for_review" ? `${appState.contentAgent.rejectConfirmJobId === reviewJob.id ? `<input class="campaign-studio-reset-reason" data-content-agent-reject-reason="${escapeHtml(reviewJob.id)}" type="text" maxlength="600" placeholder="Tell the AI what was not good enough">` : ""}<button type="button" class="campaign-studio-reset-run${appState.contentAgent.rejectConfirmJobId === reviewJob.id ? " is-confirming" : ""}" data-campaign-studio-reset="${escapeHtml(reviewJob.id)}"${appState.contentAgent.rejectingJobId === reviewJob.id ? " disabled" : ""}>${appState.contentAgent.rejectingJobId === reviewJob.id ? "Restarting…" : appState.contentAgent.rejectConfirmJobId === reviewJob.id ? "Confirm full reset" : "Reset & regenerate"}<span>↻</span></button>` : ""}
              </div>
              <p class="section-label">Live campaign review</p>
            </div>
            <h4>${escapeHtml(packTitle)}</h4>
            <p>${escapeHtml(directionLine)}</p>
          </div>
          <aside class="campaign-studio-review-score" aria-label="Quality review summary">
            <span>Quality Director</span>
            <strong>${reviewScore || "—"}<small>${reviewScore ? "/100" : ""}</small></strong>
            <p>${reviewJob?.state === "quality_blocked" ? `Editable Studio draft · not quality approved` : reviewScore >= 90 ? "Passed for human review" : reviewJob ? "Human decision required" : "Studio draft"}${reviewFloor ? ` · floor ${reviewFloor}` : ""}</p>
          </aside>
          <div class="campaign-studio-master-meta">
            <span class="campaign-brain-pill">${escapeHtml(taskPair.join(" + ") || "Standalone studio run")}</span>
            <span class="campaign-brain-pill">${escapeHtml((campaignObject?.channels || []).join(", ") || (appState.campaignStudioMode === "meta_master" ? "Master → Meta" : "klaviyo, meta, blog"))}</span>
            <span class="campaign-brain-pill is-soft">${escapeHtml((campaignObject?.markets || []).join(", ") || (result?.input?.markets || []).join(", ") || "No markets")}</span>
            <span class="campaign-brain-pill is-soft">${escapeHtml(`${sourceVisuals.length || 0} campaign image${sourceVisuals.length === 1 ? "" : "s"}`)}</span>
          </div>
          <details class="campaign-studio-memory">
            <summary>
              <span>Campaign memory</span>
              <strong>${escapeHtml(`${ownedMemoryCount} Westpack + ${externalMemoryCount} design references`)}</strong>
            </summary>
            <div class="campaign-studio-memory-list">
              ${memoryReferences.map((reference) => `
                <article>
                  <span>${escapeHtml(reference.sourceType === "owned_campaign" ? "Westpack campaign" : reference.source || "Design reference")}</span>
                  <strong>${escapeHtml(reference.title || "Untitled reference")}</strong>
                  <p>${escapeHtml(reference.use || "Campaign pattern")}</p>
                </article>
              `).join("")}
            </div>
          </details>
        </article>
        <section class="campaign-studio-source-deck" aria-label="Campaign source images">
          <header>
            <div>
              <span>Visual source deck</span>
              <strong>${sourceAssetState.loading ? "Restoring campaign photography…" : sourceAssetState.error ? "Images need attention" : `${sourceVisuals.length} images connected`}</strong>
            </div>
            <p>${escapeHtml(sourceAssetState.error || (sourceVisuals.length ? "Fresh from the linked Asana content task · protected preview" : "The linked campaign photography will appear here."))}</p>
          </header>
          <div class="campaign-studio-source-film${sourceAssetState.loading ? " is-loading" : ""}">
            ${sourceVisuals.length ? sourceVisuals.slice(0, 12).map((asset, index) => `
              <figure>
                <img src="${escapeHtml(asset.proxyUrl || asset.sourceUrl || "")}" alt="${escapeHtml(asset.name || `Campaign image ${index + 1}`)}" loading="lazy">
                <figcaption><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(asset.name || `Campaign image ${index + 1}`)}</strong></figcaption>
              </figure>
            `).join("") : Array.from({ length: 3 }, (_, index) => `<span class="campaign-studio-source-placeholder"><i>${String(index + 1).padStart(2, "0")}</i></span>`).join("")}
          </div>
        </section>
        <nav class="campaign-studio-view-nav" aria-label="Campaign studio workspace">
          <button type="button" data-campaign-studio-view="meta"><span>${escapeHtml(String(carouselFiles.length || 0))} cards</span><strong>Meta carousel</strong></button>
          ${appState.campaignStudioMode === "meta_master" ? "" : `
            <button type="button" data-campaign-studio-view="email"><span>${escapeHtml(String(emailVisualAssets.length || 0))} visuals</span><strong>Klaviyo email</strong></button>
            <button type="button" data-campaign-studio-view="blog"><span>Editorial HTML</span><strong>Campaign story</strong></button>
          `}
          <button type="button" data-campaign-studio-view="environment"><span>${escapeHtml(String(environmentFiles.length || 0))} sources</span><strong>Image lab</strong></button>
          <button type="button" data-campaign-studio-view="assets"><span>${escapeHtml(String(libraryItems.length || 0))} approved</span><strong>Asset library</strong></button>
        </nav>
        <article class="klaviyo-variant-card campaign-studio-priority-card">
          <div class="klaviyo-variant-head">
            <div>
              <p class="section-label">Studio controls</p>
              <h4>Environment and asset control</h4>
            </div>
            <span class="decision-chip">${escapeHtml(String(libraryItems.length || 0))} saved assets</span>
          </div>
          <div class="campaign-studio-priority-copy">
            <p>Keep the visual system tight: curate raw packshots, lock one approved reference, and recycle approved outputs straight into Meta and future campaign work.</p>
          </div>
          <div class="campaign-studio-priority-strip">
            <article class="campaign-studio-priority-chip">
              <span>Sources</span>
              <strong>${escapeHtml(String(environmentFiles.length || 0))}</strong>
            </article>
            <article class="campaign-studio-priority-chip is-wide">
              <span>Reference</span>
              <strong>${escapeHtml(approvedReference?.name || "None yet")}</strong>
            </article>
            <article class="campaign-studio-priority-chip">
              <span>Outputs</span>
              <strong>${escapeHtml(String((environmentResult?.images || []).length || 0))}</strong>
            </article>
          </div>
          <div class="campaign-studio-action-row">
            <a class="ghost-button small" href="#campaign-brain-environment-studio">Jump to environment studio</a>
            <a class="ghost-button small" href="#campaign-brain-asset-library">Jump to asset library</a>
          </div>
        </article>
        <article class="klaviyo-variant-card campaign-studio-module-card campaign-studio-email-card">
          <div class="klaviyo-variant-head campaign-studio-channel-head">
            <div>
              <p class="section-label">01 / Klaviyo email</p>
              <h4>${escapeHtml(email.templateName || "Email draft")}</h4>
            </div>
            <span class="campaign-studio-channel-status">
              ${universalContentLocked ? `<span class="decision-chip campaign-studio-universal-chip">Universal content locked</span>` : ""}
              <span class="decision-chip">HTML ready</span>
            </span>
          </div>
          <div class="campaign-email-visual-composer">
            <div class="campaign-email-visual-copy">
              <span>AI visual composer</span>
              <strong>${escapeHtml(emailVisualAssets.length ? `${emailVisualAssets.length} Klaviyo-hosted compositions applied` : "Art-direct the raw Asana packshots")}</strong>
              <p>${escapeHtml(appState.campaignBrainEmailVisualsError || "Creates a campaign hero, diptych and detail banner while preserving the real products.")}</p>
            </div>
            ${emailVisualAssets.length ? `
              <div class="campaign-email-visual-strip">
                ${emailVisualAssets.map((asset) => `<img src="${escapeHtml(asset.imageUrl || "")}" alt="${escapeHtml(asset.role || "Email visual")}">`).join("")}
              </div>
            ` : ""}
            <button class="ghost-button small${appState.campaignBrainEmailVisualsLoading ? " is-loading" : ""}" id="campaign-brain-email-visuals-button" type="button"${appState.campaignBrainEmailVisualsLoading ? " disabled" : ""}>${appState.campaignBrainEmailVisualsLoading ? "Composing visuals..." : "Compose email visuals"}</button>
          </div>
          ${buildCampaignEmailBuilderMarkup(email, emailSections, {
            sourceTemplateName: appState.campaignBrainResult?.input?.title || "",
            marketLabel: (appState.campaignBrainResult?.input?.markets || []).join(", ") || "Master",
            assets: [
              ...emailVisualAssets.map((asset) => ({ imageUrl: asset.imageUrl, sourceUrl: asset.imageUrl, name: asset.role || asset.name || "Email visual", hosted: asset.hosted !== false })),
              ...sourceVisuals.map((asset) => ({ ...asset, hosted: false }))
            ]
          })}
          <div class="campaign-studio-email-artboard campaign-email-legacy-controls">
            <div class="campaign-studio-artboard-bar">
              <div class="campaign-studio-window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
              <span>Email canvas</span>
              <span>${escapeHtml((appState.campaignBrainResult?.input?.markets || []).join(", ") || "Master")}</span>
            </div>
            <div class="campaign-studio-email-inbox-line">
              <span>Subject</span>
              <strong>${escapeHtml(email.subject || "Subject line pending")}</strong>
            </div>
            <div class="klaviyo-variant-preview-shell">
              <iframe
                class="klaviyo-variant-preview"
                loading="lazy"
                sandbox="allow-same-origin"
                referrerpolicy="no-referrer"
                srcdoc="${escapeHtml(buildKlaviyoPreviewHtml({
                  templateName: email.templateName || "",
                  sourceTemplateName: appState.campaignBrainResult?.input?.title || "",
                  languageCode: (appState.campaignBrainResult?.input?.markets || []).join(", "),
                  translationPath: "Campaign Brain",
                  subject: email.subject || "",
                  previewText: email.previewText || "",
                  body: email.bodyHtml || ""
                }))}"
                title="Campaign Brain email preview"></iframe>
            </div>
          </div>
          <details class="campaign-studio-module-fold campaign-email-legacy-controls">
            <summary>Open email production controls</summary>
            <div class="klaviyo-variant-copy">
              <div>
                <span>Subject</span>
                <textarea class="preview-textarea campaign-studio-textarea compact" rows="2" data-campaign-artifact-field="email.subject">${escapeHtml(email.subject || "")}</textarea>
              </div>
              <div>
                <span>Preview text</span>
                <textarea class="preview-textarea campaign-studio-textarea compact" rows="2" data-campaign-artifact-field="email.previewText">${escapeHtml(email.previewText || "")}</textarea>
              </div>
              <div>
                <span>Primary CTA</span>
                <input class="campaign-studio-input" type="text" value="${escapeHtml(email.primaryCta || "")}" data-campaign-artifact-field="email.primaryCta">
              </div>
              <div>
                <span>Campaign modules</span>
                <div class="campaign-email-module-editor">
                  ${emailSections.map((section, index) => `
                    <article class="campaign-email-module-edit" data-email-module-card="${index}">
                      <header>
                        <strong><i>${String(index + 1).padStart(2, "0")}</i> ${escapeHtml(CAMPAIGN_EMAIL_MODULES.find(([id]) => id === (section.moduleId || section.layout))?.[1] || "Editorial module")}</strong>
                        <div>
                          <button type="button" aria-label="Move module up" data-email-module-move="up" data-email-module-index="${index}"${index === 0 ? " disabled" : ""}>↑</button>
                          <button type="button" aria-label="Move module down" data-email-module-move="down" data-email-module-index="${index}"${index === emailSections.length - 1 ? " disabled" : ""}>↓</button>
                          <button type="button" aria-label="Remove module" data-email-module-remove data-email-module-index="${index}"${emailSections.length <= 3 ? " disabled" : ""}>×</button>
                        </div>
                      </header>
                      <label>Module
                        <select data-email-module-field="moduleId" data-email-module-index="${index}">
                          ${CAMPAIGN_EMAIL_MODULES.map(([id, label]) => `<option value="${id}"${id === (section.moduleId || section.layout) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
                        </select>
                      </label>
                      <label>Editorial label<input type="text" value="${escapeHtml(section.label || "")}" data-email-module-field="label" data-email-module-index="${index}"></label>
                      <label>Headline<textarea rows="2" data-email-module-field="headline" data-email-module-index="${index}">${escapeHtml(section.headline || "")}</textarea></label>
                      <label>Body<textarea rows="3" data-email-module-field="body" data-email-module-index="${index}">${escapeHtml(section.body || "")}</textarea></label>
                      <label>Bullets, one per line<textarea rows="3" data-email-module-field="bullets" data-email-module-index="${index}">${escapeHtml((section.bullets || []).join("\n"))}</textarea></label>
                      <label>Approved image URL<input type="url" value="${escapeHtml(section.imageUrl || "")}" data-email-module-field="imageUrl" data-email-module-index="${index}"></label>
                    </article>
                  `).join("")}
                  ${emailSections.length < 4 ? `<button type="button" class="ghost-button small" id="campaign-email-add-module">Add module</button>` : ""}
                </div>
              </div>
              <div>
                <span>Compiled email</span>
                <details class="campaign-studio-fold">
                  <summary>Inspect compiled HTML</summary>
                  <textarea class="preview-textarea campaign-studio-textarea" rows="6" data-campaign-artifact-field="email.bodyHtml">${escapeHtml(email.bodyHtml || "")}</textarea>
                </details>
              </div>
            </div>
          </details>
        </article>
        <article class="klaviyo-variant-card campaign-studio-module-card campaign-studio-meta-card">
          <div class="klaviyo-variant-head campaign-studio-channel-head">
            <div>
              <p class="section-label">02 / Meta carousel</p>
              <h4>${escapeHtml(meta.campaignAngle || "Meta draft")}</h4>
            </div>
            <span class="decision-chip">${escapeHtml(String((meta.variants || []).length || 0))} variants</span>
          </div>
          <section class="campaign-studio-intelligence" data-ready="${intelligenceSnapshot?.ready || intelligenceSnapshot?.generatedAt ? "true" : "false"}">
            <div class="campaign-studio-intelligence-head">
              <div>
                <span>META HISTORICAL INTELLIGENCE</span>
                <strong>${escapeHtml(intelligenceSnapshot?.generatedAt ? `${intelligenceSnapshot.coverage?.adsWithInsights || 0} performance ads learned` : "Build Westpack Creative DNA")}</strong>
              </div>
              <button class="ghost-button small" id="campaign-meta-intelligence-sync" type="button"${intelligenceState.loading ? " disabled" : ""}>${intelligenceState.loading ? "Learning from Meta..." : intelligenceSnapshot?.generatedAt ? "Sync new history" : "Learn from Meta history"}</button>
            </div>
            ${intelligenceState.error ? `<p class="campaign-studio-intelligence-error">${escapeHtml(intelligenceState.error)}</p>` : ""}
            ${intelligenceSnapshot?.generatedAt ? `
              <div class="campaign-studio-intelligence-stats">
                <article><span>History</span><strong>${escapeHtml(`${intelligenceSnapshot.coverage?.ads || 0} ads`)}</strong></article>
                <article><span>Qualified sample</span><strong>${escapeHtml(`${intelligenceSnapshot.dna?.eligibleAds || 0} ads`)}</strong></article>
                <article><span>Cohorts</span><strong>${escapeHtml(String(intelligenceSnapshot.dna?.cohorts || 0))}</strong></article>
                <article><span>Window</span><strong>${escapeHtml(`${intelligenceSnapshot.range?.days || 365} days`)}</strong></article>
              </div>
              <div class="campaign-studio-intelligence-patterns">
                ${intelligencePatterns.length ? intelligencePatterns.map((pattern) => `
                  <span title="${escapeHtml(`${pattern.uses} uses · ${pattern.confidence} confidence`)}">${escapeHtml(String(pattern.feature || "").replace(/_/g, " "))}<b>${escapeHtml(`${pattern.averagePercentile}p`)}</b></span>
                `).join("") : `<p>More eligible delivery data is needed before a pattern can be promoted.</p>`}
              </div>
              <small>${escapeHtml(intelligenceSnapshot.dna?.methodology || "Cohort-normalised performance associations, never causal claims.")}</small>
            ` : `<p>Connect historical copy, creative structure and performance to the AI. Read-only; nothing is changed in Meta.</p>`}
          </section>
          ${designTranslation ? `
            <section class="campaign-studio-design-dna" data-testid="meta-design-continuity">
              <div class="campaign-studio-design-dna-head">
                <div>
                  <span>KLAVIYO → META DESIGN CONTINUITY</span>
                  <strong>${escapeHtml(designTranslation.sourceDesignSummary || "Campaign DNA translated for paid social")}</strong>
                </div>
                <span class="campaign-studio-design-dna-status">Source-led · ${escapeHtml(String(appState.campaignMetaMaster.result?.masterVisualImages?.length || 0))} visuals inspected</span>
              </div>
              <div class="campaign-studio-design-dna-body">
                <div class="campaign-studio-design-palette" aria-label="Campaign palette">
                  ${Object.entries(designPalette || {}).map(([name, colour]) => `
                    <label title="${escapeHtml(`${name}: ${colour}`)}">
                      <input type="color" value="${escapeHtml(colour)}" data-campaign-design-palette="${escapeHtml(name)}">
                      <span style="--design-swatch:${escapeHtml(colour)}"></span>
                      <small>${escapeHtml(name)}</small>
                    </label>
                  `).join("")}
                </div>
                <div class="campaign-studio-design-controls">
                  <label><span>Headline character</span><select data-campaign-design-type="headlineStyle"><option value="serif"${designTranslation.typography?.headlineStyle === "serif" ? " selected" : ""}>Editorial serif</option><option value="sans"${designTranslation.typography?.headlineStyle === "sans" ? " selected" : ""}>Modern sans</option></select></label>
                  <label><span>Image treatment</span><select data-campaign-design-composition="frameStyle"><option value="none"${designTranslation.composition?.frameStyle === "none" ? " selected" : ""}>Full bleed</option><option value="hairline"${designTranslation.composition?.frameStyle === "hairline" ? " selected" : ""}>Fine frame</option><option value="rounded"${designTranslation.composition?.frameStyle === "rounded" ? " selected" : ""}>Soft frame</option></select></label>
                  <label><span>Copy alignment</span><select data-campaign-design-type="alignment"><option value="left"${designTranslation.typography?.alignment === "left" ? " selected" : ""}>Editorial left</option><option value="center"${designTranslation.typography?.alignment === "center" ? " selected" : ""}>Centred</option></select></label>
                </div>
              </div>
              <div class="campaign-studio-design-decisions">
                <p><span>Preserve</span>${escapeHtml((designTranslation.preserve || []).join(" · ") || "Palette · type hierarchy · image rhythm")}</p>
                <p><span>Adapt</span>${escapeHtml((designTranslation.adapt || []).join(" · ") || "Email structure into the shortest complete mobile-first story")}</p>
              </div>
              <small>Universal header, navigation and footer are intentionally excluded. Change a token, then render the carousel again.</small>
            </section>
          ` : ""}
          ${creativeRoutes.length ? `
            <section class="campaign-studio-creative-routes" data-testid="meta-creative-routes">
              <header>
                <div><span>CREATIVE ROUTES</span><strong>Choose the campaign's dominant expression</strong></div>
                <small>One route is executed at a time</small>
              </header>
              <div class="campaign-studio-route-grid">
                ${creativeRoutes.map((route) => {
                  const active = route.id === appState.campaignMetaMaster.selectedRouteId;
                  const recommended = route.id === appState.campaignMetaMaster.result?.creativeRoutes?.recommendedRouteId;
                  return `<article class="campaign-studio-route${active ? " is-active" : ""}">
                    <div class="campaign-studio-route-kicker"><span>${escapeHtml(route.id)}</span>${recommended ? "<b>Recommended</b>" : ""}</div>
                    <strong>${escapeHtml(route.title || route.id)}</strong>
                    <p>${escapeHtml(route.idea || "")}</p>
                    <small>${escapeHtml(route.strategicStrength || "")}</small>
                    <button type="button" data-campaign-meta-route="${escapeHtml(route.id)}"${active || appState.campaignMetaMaster.generating ? " disabled" : ""}>${active ? "Current route" : "Build this route"}</button>
                  </article>`;
                }).join("")}
              </div>
            </section>
          ` : ""}
          <section class="campaign-studio-meta-director" data-state="${metaQualityReview?.passed ? "passed" : metaQualityReview ? "revise" : "pending"}" data-testid="meta-creative-director">
            <div class="campaign-studio-meta-director-score">
              <span>INDEPENDENT CREATIVE DIRECTOR</span>
              <strong>${appState.campaignMetaMaster.qualityReviewing ? "…" : metaQualityReview?.overallScore ?? "—"}<small>${metaQualityReview ? "/100" : ""}</small></strong>
              <p>${escapeHtml(appState.campaignMetaMaster.qualityReviewing ? `Inspecting ${carouselFiles.length} finished cards` : metaQualityReview?.passed ? "Passed for human review" : metaQualityReview?.summary || "Review runs after the finished cards are rendered.")}</p>
            </div>
            ${metaQualityReview ? `
              <div class="campaign-studio-meta-director-dimensions">
                ${(metaQualityReview.dimensions || []).map((dimension) => `<article><span>${escapeHtml(String(dimension.key || "").replace(/_/g, " "))}</span><strong>${escapeHtml(String(dimension.score || 0))}</strong><i style="--director-score:${Math.max(0, Math.min(100, Number(dimension.score || 0)))}%"></i></article>`).join("")}
              </div>
              <div class="campaign-studio-meta-director-brief">
                <p><span>Must fix</span>${escapeHtml((metaQualityReview.revisionBrief?.mustFix || []).join(" · ") || "No mandatory corrections")}</p>
                <p><span>Preserve</span>${escapeHtml((metaQualityReview.revisionBrief?.preserve || []).join(" · ") || "Approved strengths")}</p>
              </div>
            ` : ""}
            <div class="campaign-studio-meta-director-actions">
              ${metaQualityReview && !metaQualityReview.passed && metaQualityReview.verdict !== "BLOCKED" ? `<button class="primary-button" type="button" id="campaign-meta-apply-review"${appState.campaignMetaMaster.generating ? " disabled" : ""}>Apply director revision</button>` : ""}
              <button class="ghost-button small" type="button" id="campaign-meta-run-review"${appState.campaignMetaMaster.qualityReviewing || carouselFiles.length < 3 || carouselFiles.length > 6 ? " disabled" : ""}>${appState.campaignMetaMaster.qualityReviewing ? "Reviewing..." : "Review finished cards"}</button>
            </div>
            ${appState.campaignMetaMaster.qualityError ? `<p class="campaign-studio-meta-director-error">${escapeHtml(appState.campaignMetaMaster.qualityError)}</p>` : ""}
          </section>
          <div class="campaign-studio-meta-gallery">
            <div class="campaign-studio-meta-gallery-copy">
              <span>Campaign concept</span>
              <strong>${escapeHtml(meta.headline || "Meta headline pending")}</strong>
              <p>${escapeHtml(metaPreviewSnippet || "Primary text will appear here once the draft is generated.")}</p>
            </div>
            <div class="campaign-studio-meta-gallery-stage">
              ${buildCampaignBrainCarouselPreviewMarkup()}
            </div>
            <div class="campaign-studio-module-pill-row campaign-studio-channel-foot">
              <span class="campaign-studio-module-pill">${escapeHtml(metaConfig.adFormat || "Single image")}</span>
              <span class="campaign-studio-module-pill">${escapeHtml(metaConfig.targetLanguage || "No language")}</span>
              <span class="campaign-studio-module-pill is-soft">${escapeHtml(`${carouselFiles.length} asset${carouselFiles.length === 1 ? "" : "s"}`)}</span>
            </div>
          </div>
          <details class="campaign-studio-module-fold"${appState.campaignStudioMode === "meta_master" ? " open" : ""}>
            <summary>Open Meta production controls</summary>
            <div class="klaviyo-variant-copy">
            <div>
              <span>Primary text</span>
              <textarea class="preview-textarea campaign-studio-textarea" rows="5" data-campaign-artifact-field="meta.primaryText">${escapeHtml(meta.primaryText || "")}</textarea>
            </div>
            <div>
              <span>Headline</span>
              <textarea class="preview-textarea campaign-studio-textarea compact" rows="2" data-campaign-artifact-field="meta.headline">${escapeHtml(meta.headline || "")}</textarea>
            </div>
            <div>
              <span>Description</span>
              <textarea class="preview-textarea campaign-studio-textarea compact" rows="3" data-campaign-artifact-field="meta.description">${escapeHtml(meta.description || "")}</textarea>
            </div>
            <div>
              <span>Variants</span>
              <details class="campaign-studio-fold">
                <summary>Open Meta variants</summary>
                <div class="klaviyo-change-list">
                  ${(meta.variants || []).map((variant, index) => `
                    <article class="klaviyo-change-item">
                      <input class="campaign-studio-input" type="text" value="${escapeHtml(variant.title || "")}" data-campaign-artifact-variant="${index}" data-campaign-artifact-variant-field="title">
                      <textarea class="preview-textarea campaign-studio-textarea compact" rows="3" data-campaign-artifact-variant="${index}" data-campaign-artifact-variant-field="body">${escapeHtml(variant.body || "")}</textarea>
                      <textarea class="preview-textarea campaign-studio-textarea compact" rows="2" data-campaign-artifact-variant="${index}" data-campaign-artifact-variant-field="headline">${escapeHtml(variant.headline || "")}</textarea>
                    </article>
                  `).join("")}
                </div>
              </details>
            </div>
            <div class="campaign-studio-meta-block">
              <div class="campaign-studio-target-head">
                <div>
                  <span>Publication destination</span>
                  <strong>Choose where the carousel should live</strong>
                </div>
                <button class="ghost-button small" id="campaign-brain-meta-target-refresh" type="button"${appState.campaignBrainMetaCatalogLoading ? " disabled" : ""}>${appState.campaignBrainMetaCatalogLoading ? "Loading..." : "Refresh Meta"}</button>
              </div>
              <div class="campaign-studio-target-card" data-state="${escapeHtml(metaTargetModel.state)}">
                <div class="campaign-studio-meta-grid">
                  <label>
                    <span>Campaign</span>
                    <select class="dashboard-control-select" id="campaign-brain-meta-target-campaign"${appState.campaignBrainMetaCatalogLoading ? " disabled" : ""}>
                      <option value="">Select campaign</option>
                      ${metaTargetModel.campaignOptions.map((campaign) => `
                        <option value="${escapeHtml(campaign.id)}"${campaign.id === metaConfig.targetCampaignId ? " selected" : ""}>${escapeHtml(campaign.name)}${campaign.status === "ACTIVE" ? "" : ` · ${escapeHtml(campaign.status.toLowerCase())}`}</option>
                      `).join("")}
                    </select>
                  </label>
                  <label>
                    <span>Ad set</span>
                    <select class="dashboard-control-select" id="campaign-brain-meta-target-adset"${!metaTargetModel.selectedCampaign || appState.campaignBrainMetaCatalogLoading ? " disabled" : ""}>
                      <option value="">${metaTargetModel.selectedCampaign ? "Select ad set" : "Select campaign first"}</option>
                      ${metaTargetModel.adSetOptions.map((adSet) => `
                        <option value="${escapeHtml(adSet.id)}"${adSet.id === metaConfig.targetAdSetId ? " selected" : ""}>${escapeHtml(adSet.name)}${adSet.status === "ACTIVE" ? "" : ` · ${escapeHtml(adSet.status.toLowerCase())}`}</option>
                      `).join("")}
                    </select>
                  </label>
                </div>
                <div class="campaign-studio-target-status">
                  <span class="campaign-studio-target-dot" aria-hidden="true"></span>
                  <p>${escapeHtml(appState.campaignBrainMetaCatalogError || metaTargetModel.message)}</p>
                  ${metaTargetModel.ready ? `<span class="campaign-studio-target-ready">Ready</span>` : ""}
                </div>
              </div>
              <div class="campaign-studio-meta-grid campaign-studio-meta-settings">
                <label>
                  <span>Ad language · locked</span>
                  <input class="campaign-studio-input" type="text" value="UK English (en_GB)" readonly>
                </label>
                <label>
                  <span>Ad format · locked</span>
                  <input class="campaign-studio-input" type="text" value="Carousel · 5 cards" readonly>
                </label>
                <label class="campaign-studio-meta-wide">
                  <span>Destination URL</span>
                  <input class="campaign-studio-input" type="text" value="${escapeHtml(metaConfig.destinationUrl || "")}" data-campaign-meta-config="destinationUrl">
                </label>
              </div>
              <details class="campaign-studio-manual-target">
                <summary>Manual destination fallback</summary>
                <div class="campaign-studio-meta-grid">
                  <label>
                    <span>Campaign ID</span>
                    <input class="campaign-studio-input" type="text" value="${escapeHtml(metaConfig.targetCampaignId || "")}" data-campaign-meta-config="targetCampaignId">
                  </label>
                  <label>
                    <span>Ad set ID</span>
                    <input class="campaign-studio-input" type="text" value="${escapeHtml(metaConfig.targetAdSetId || "")}" data-campaign-meta-config="targetAdSetId">
                  </label>
                  <label>
                    <span>Campaign name</span>
                    <input class="campaign-studio-input" type="text" value="${escapeHtml(metaConfig.targetCampaignName || "")}" data-campaign-meta-config="targetCampaignName">
                  </label>
                  <label>
                    <span>Ad set name</span>
                    <input class="campaign-studio-input" type="text" value="${escapeHtml(metaConfig.targetAdSetName || "")}" data-campaign-meta-config="targetAdSetName">
                  </label>
                </div>
              </details>
              ${metaConfig.adFormat === "Carousel" ? `
                <div class="campaign-studio-meta-asset-lane">
                  <div class="campaign-studio-meta-preview-panel">
                    <div class="campaign-studio-meta-preview-header">
                      <span>Live carousel preview</span>
                      <strong>${escapeHtml(`${carouselFiles.length} card${carouselFiles.length === 1 ? "" : "s"}`)}</strong>
                    </div>
                    ${carouselFiles.length ? `
                      <div class="campaign-studio-meta-role-strip">
                        ${buildCampaignBrainCarouselCardPlan(carouselFiles.length).map((item) => `
                          <span>${escapeHtml(`${item.index}. ${item.role}`)}</span>
                        `).join("")}
                      </div>
                    ` : ""}
                    ${appState.campaignBrainMetaSuggestResult?.guidance?.length ? `
                      <div class="campaign-studio-meta-guidance">
                        ${appState.campaignBrainMetaSuggestResult.guidance.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                      </div>
                    ` : ""}
                  </div>
                  <label class="campaign-studio-upload-card campaign-studio-meta-upload">
                    <input id="campaign-brain-meta-carousel-upload" type="file" accept="image/*" multiple>
                    <span class="campaign-studio-upload-eyebrow">Carousel cards</span>
                    <strong>Attach square carousel images</strong>
                    <p>Keep the visual system consistent across card 1 to card N before the Meta handoff.</p>
                    <div class="campaign-studio-upload-meta">
                      <span>1:1 only</span>
                      <span>${escapeHtml(`${carouselFiles.length} selected`)}</span>
                    </div>
                  </label>
                  <div class="campaign-studio-meta-asset-summary">
                    ${carouselFiles.length
                      ? carouselFiles.map((file, index) => {
                          const draft = getCampaignBrainCarouselCardDrafts()[index] || buildDefaultCampaignBrainCarouselCardDraft(index);
                          const warningGroup = getCampaignBrainCarouselWarnings()[index];
                          const warningItems = Array.isArray(warningGroup?.items) ? warningGroup.items : [];
                          const isDragging = getCampaignBrainDraggingCardIndex() === index;
                          const role = getCampaignBrainCarouselCardRole(index, carouselFiles.length);
                          return `
                          <article class="campaign-studio-meta-asset-item${isDragging ? " is-dragging" : ""}" draggable="true" data-campaign-meta-card-draggable="1" data-campaign-meta-card-index="${index}" data-campaign-meta-drop-index="${index}">
                            <div class="campaign-studio-meta-asset-head">
                              <div>
                                <strong>Card ${index + 1}</strong>
                                <span>${escapeHtml(file.name || `card-${index + 1}`)}</span>
                                <span class="campaign-studio-meta-role-badge">${escapeHtml(role)}</span>
                              </div>
                              <img class="campaign-studio-meta-thumb" src="${escapeHtml(getCampaignBrainAssetPreviewUrl(file))}" alt="">
                              <div class="campaign-studio-meta-order-actions">
                                <button class="ghost-button small" type="button" data-campaign-meta-card-move="-1" data-campaign-meta-card-index="${index}" ${index === 0 ? "disabled" : ""}>Up</button>
                                <button class="ghost-button small" type="button" data-campaign-meta-card-move="1" data-campaign-meta-card-index="${index}" ${index === carouselFiles.length - 1 ? "disabled" : ""}>Down</button>
                                <button class="ghost-button small" type="button" data-campaign-meta-card-remove="1" data-campaign-meta-card-index="${index}">Remove</button>
                              </div>
                            </div>
                            <label>
                              <span>Card title</span>
                              <input class="campaign-studio-input" type="text" value="${escapeHtml(draft.title || "")}" data-campaign-meta-card-index="${index}" data-campaign-meta-card-field="title">
                            </label>
                            <label>
                              <span>Card description</span>
                              <textarea class="preview-textarea campaign-studio-textarea compact" rows="3" data-campaign-meta-card-index="${index}" data-campaign-meta-card-field="description">${escapeHtml(draft.description || "")}</textarea>
                            </label>
                            ${warningItems.length ? `
                              <div class="campaign-studio-meta-warnings">
                                ${warningItems.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
                              </div>
                            ` : ""}
                          </article>
                        `;
                        }).join("")
                      : `<p>No carousel cards attached yet. Select at least 2 square images.</p>`}
                  </div>
                </div>
              ` : ""}
              <div class="campaign-studio-action-row">
                <button class="primary-button" id="campaign-brain-build-meta-button" type="button">Build carousel → paused Meta draft</button>
                <button class="ghost-button small" id="campaign-meta-master-render" type="button"${appState.campaignMetaMaster.rendering || !appState.campaignMetaMaster.result?.carousel?.cards?.length ? " disabled" : ""}>${appState.campaignMetaMaster.rendering ? "Rendering 1080×1080..." : `Render ${appState.campaignMetaMaster.result?.carousel?.cards?.length || 3} carousel designs`}</button>
                <button class="ghost-button small" id="campaign-brain-suggest-meta-button" type="button">Write UK English copy</button>
                <button class="ghost-button small" id="campaign-brain-validate-meta-button" type="button">Validate Meta draft</button>
                <button class="ghost-button small" id="campaign-brain-push-meta-button" type="button">Create Meta draft</button>
              </div>
              <div class="campaign-studio-requirements">
                ${adFormatRequirements.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                <p>Safety contract: UK English only · 3-6 purposeful cards · created as PAUSED · approval required.</p>
                ${appState.campaignMetaMaster.renderedAt ? `<p>Designed files rendered at 1080×1080 · ${escapeHtml(formatKlaviyoDate(appState.campaignMetaMaster.renderedAt))}</p>` : ""}
                ${appState.campaignMetaMaster.renderError ? `<p>${escapeHtml(appState.campaignMetaMaster.renderError)}</p>` : ""}
              </div>
              <pre class="campaign-studio-code" id="campaign-brain-meta-payload"></pre>
              <div class="inline-feedback" id="campaign-brain-meta-feedback" aria-live="polite"></div>
            </div>
            </div>
          </details>
        </article>
        <article class="klaviyo-variant-card campaign-studio-module-card campaign-studio-blog-card">
          <div class="klaviyo-variant-head campaign-studio-channel-head">
            <div>
              <p class="section-label">03 / Editorial HTML</p>
              <h4>${escapeHtml(blog.title || "Blog draft")}</h4>
            </div>
            <span class="decision-chip">Source asset</span>
          </div>
          <div class="campaign-studio-blog-artboard">
            <div class="campaign-studio-blog-artboard-nav">
              <span>Westpack journal</span>
              <span>${escapeHtml(blog.slug ? `/${blog.slug}` : "/draft")}</span>
            </div>
            <div class="campaign-studio-blog-artboard-copy">
              <span>Campaign story</span>
              <h5>${escapeHtml(blog.title || "Blog title pending")}</h5>
              <p>${escapeHtml(blogPreviewSnippet || "A reusable HTML and blog layer will appear here once the artifact pack is ready.")}</p>
              <div class="campaign-studio-blog-rule"></div>
              <small>${escapeHtml(`${blogReadingMinutes} min read`)} · Reusable campaign source</small>
            </div>
          </div>
          <details class="campaign-studio-module-fold">
            <summary>Open blog production controls</summary>
            <div class="klaviyo-variant-copy">
            <div>
              <span>Slug</span>
              <input class="campaign-studio-input" type="text" value="${escapeHtml(blog.slug || "")}" data-campaign-artifact-field="blog.slug">
            </div>
            <div>
              <span>Excerpt</span>
              <textarea class="preview-textarea campaign-studio-textarea compact" rows="3" data-campaign-artifact-field="blog.excerpt">${escapeHtml(blog.excerpt || "")}</textarea>
            </div>
            <div>
              <span>Title</span>
              <textarea class="preview-textarea campaign-studio-textarea compact" rows="2" data-campaign-artifact-field="blog.title">${escapeHtml(blog.title || "")}</textarea>
            </div>
            <div>
              <span>HTML body</span>
              <details class="campaign-studio-fold">
                <summary>Open raw blog HTML</summary>
                <textarea class="preview-textarea campaign-studio-textarea" rows="5" data-campaign-artifact-field="blog.bodyHtml">${escapeHtml(blog.bodyHtml || "")}</textarea>
              </details>
            </div>
            <div>
              <span>Production notes</span>
              <p>${escapeHtml((artifactResult.productionNotes || []).join(" | ") || "--")}</p>
            </div>
            </div>
          </details>
        </article>
        <article class="klaviyo-variant-card campaign-studio-hero-card" id="campaign-brain-environment-studio">
          <div class="klaviyo-variant-head campaign-studio-environment-head">
            <div>
              <p class="section-label">Environment studio</p>
              <h4>Luxury environment variants</h4>
            </div>
            <div class="campaign-studio-environment-status" aria-label="Environment studio status">
              <span><small>Sources</small><strong>${escapeHtml(String(environmentFiles.length || 0))}</strong></span>
              <span><small>Reference</small><strong>${approvedReference ? "Locked" : "Open"}</strong></span>
              <span><small>Outputs</small><strong>${escapeHtml(String((environmentResult?.images || []).length || 0))}</strong></span>
            </div>
          </div>
          <div class="campaign-studio-environment-block">
            <section class="campaign-studio-environment-stage">
              <div class="campaign-studio-environment-stage-copy">
                <span>Scene direction</span>
                <strong>${escapeHtml(({
                  scandi_luxe: "Scandi luxe set",
                  editorial_minimal: "Editorial minimal set",
                  soft_residential: "Soft residential set",
                  warm_holiday: "Warm holiday luxe set"
                })[environmentConfig.preset] || "Environment set")}</strong>
                <p>${escapeHtml(approvedReference?.name
                  ? `Locked to ${approvedReference.name}${approvedReference.format ? ` in ${approvedReference.format}` : ""}. Keep new generations visually aligned to this reference.`
                  : "Build one calm, reusable visual world for premium packshots before pushing assets into Meta.")}</p>
              </div>
              <div class="campaign-studio-environment-stage-canvas">
                ${approvedReference?.imageUrl
                  ? `
                    <div class="campaign-studio-environment-stage-preview">
                      <img class="campaign-studio-environment-stage-image" src="${escapeHtml(approvedReference.imageUrl || "")}" alt="">
                      <div class="campaign-studio-environment-stage-badge">Approved reference</div>
                    </div>
                  `
                  : environmentFiles.length
                    ? `
                      <div class="campaign-studio-environment-stage-preview is-source-grid">
                        ${environmentFiles.slice(0, 3).map((file) => `
                          <img class="campaign-studio-environment-stage-image" src="${escapeHtml(getCampaignBrainAssetPreviewUrl(file))}" alt="">
                        `).join("")}
                        <div class="campaign-studio-environment-stage-badge">${escapeHtml(`${environmentFiles.length} source image${environmentFiles.length === 1 ? "" : "s"}`)}</div>
                      </div>
                    `
                    : `
                      <div class="campaign-studio-environment-stage-empty">
                        <strong>No scene locked yet</strong>
                        <p>Upload clean product packshots or pick approved library sources to start shaping a reusable luxury environment.</p>
                      </div>
                    `}
              </div>
            </section>
            <div class="campaign-studio-environment-grid">
              <label>
                <span>Environment preset</span>
                <select class="dashboard-control-select" data-campaign-environment-config="preset">
                  ${[
                    ["scandi_luxe", "Scandi luxe"],
                    ["editorial_minimal", "Editorial minimal"],
                    ["soft_residential", "Soft residential"],
                    ["warm_holiday", "Warm holiday luxe"]
                  ].map(([value, label]) => `
                    <option value="${escapeHtml(value)}"${value === environmentConfig.preset ? " selected" : ""}>${escapeHtml(label)}</option>
                  `).join("")}
                </select>
              </label>
              <label>
                <span>Output pack</span>
                <div class="campaign-studio-environment-format-pills">
                  ${[
                    ["square", "Square"],
                    ["portrait", "Portrait"],
                    ["landscape", "Landscape"]
                  ].map(([value, label]) => `
                    <button
                      class="ghost-button small${selectedEnvironmentFormats.includes(value) ? " is-selected" : ""}"
                      type="button"
                      data-campaign-environment-format="${escapeHtml(value)}"
                      aria-pressed="${selectedEnvironmentFormats.includes(value) ? "true" : "false"}">${escapeHtml(label)}</button>
                  `).join("")}
                </div>
              </label>
              <label>
                <span>Quality</span>
                <select class="dashboard-control-select" data-campaign-environment-config="quality">
                  ${[
                    ["low", "Low draft"],
                    ["medium", "Medium"],
                    ["high", "High"]
                  ].map(([value, label]) => `
                    <option value="${escapeHtml(value)}"${value === environmentConfig.quality ? " selected" : ""}>${escapeHtml(label)}</option>
                  `).join("")}
                </select>
              </label>
              <div class="campaign-studio-meta-wide campaign-studio-advanced-block">
                <details class="campaign-studio-fold">
                  <summary>Advanced direction</summary>
                  <textarea class="preview-textarea campaign-studio-textarea compact" rows="3" data-campaign-environment-config="customDirection">${escapeHtml(environmentConfig.customDirection || "")}</textarea>
                </details>
              </div>
            </div>
            <section class="campaign-studio-source-dock">
              <label class="campaign-studio-upload-card campaign-studio-meta-upload">
                <input id="campaign-brain-environment-upload" type="file" accept="image/*" multiple>
                <span class="campaign-studio-upload-eyebrow">Raw product images</span>
                <strong>Upload source packshots</strong>
                <p>Feed the studio with clean source photography ready for luxury environment transformation.</p>
                <div class="campaign-studio-upload-meta">
                  <span>Images only</span>
                  <span>${escapeHtml(`${environmentFiles.length} attached`)}</span>
                </div>
              </label>
              <div class="campaign-studio-source-dock-foot">
                <p class="campaign-studio-empty-note">${environmentFiles.length
                  ? escapeHtml(`${environmentFiles.length} source image${environmentFiles.length === 1 ? "" : "s"} currently loaded for scene building.`)
                  : "No raw source images attached yet. Upload packshots you want transformed into a shared luxury environment."}</p>
                <div class="campaign-studio-action-row campaign-studio-source-dock-actions">
                  <button class="ghost-button small" type="button" data-campaign-asset-picker-open="environment_source">Browse library sources</button>
                  <button class="ghost-button small" id="campaign-brain-generate-environment-button" type="button">Generate environment series</button>
                </div>
              </div>
            </section>
            <div class="campaign-studio-environment-source-list">
              ${getCampaignBrainEnvironmentApprovedReference()?.imageUrl ? `
                <article class="campaign-studio-environment-reference-card">
                  <img class="campaign-studio-environment-result-image" src="${escapeHtml(getCampaignBrainEnvironmentApprovedReference().imageUrl || "")}" alt="">
                  <div class="campaign-studio-environment-result-copy">
                    <strong>Approved series reference</strong>
                    <span>${escapeHtml(`${getCampaignBrainEnvironmentApprovedReference().name || "Reference image"}${getCampaignBrainEnvironmentApprovedReference().format ? ` · ${getCampaignBrainEnvironmentApprovedReference().format}` : ""}`)}</span>
                    <p>This image now acts as the visual lock for later environment generations.</p>
                  </div>
                </article>
              ` : ""}
              ${environmentFiles.length
                ? environmentFiles.map((file, index) => {
                    const insight = getCampaignBrainEnvironmentSourceInsights()[index] || null;
                    const isSelected = getCampaignBrainEnvironmentSelectedSourceIndexes().includes(index);
                    return `
                    <article class="campaign-studio-environment-source-item">
                      <img class="campaign-studio-meta-thumb" src="${escapeHtml(getCampaignBrainAssetPreviewUrl(file))}" alt="">
                      <div>
                        <strong>${escapeHtml(file.name || `source-${index + 1}`)}</strong>
                        <p>${escapeHtml(`${Math.round((Number(file.size || 0) / 1024) || 0)} KB${insight?.width && insight?.height ? ` · ${insight.width}x${insight.height}` : ""}`)}</p>
                        ${insight ? `<p>${escapeHtml(`Score ${insight.score}/100${insight.recommended ? " · Recommended" : ""}`)}</p>` : ""}
                        ${insight?.notes?.length ? `<p>${escapeHtml(insight.notes[0])}</p>` : ""}
                        <div class="campaign-studio-action-row">
                          <button class="ghost-button small${isSelected ? " is-selected" : ""}" type="button" data-campaign-environment-source-toggle="${index}">${isSelected ? "Selected" : "Use source"}</button>
                          <button class="ghost-button small" type="button" data-campaign-environment-save-source="${index}">Approve source</button>
                        </div>
                      </div>
                    </article>
                  `;
                  }).join("")
                : ``}
            </div>
            ${environmentResult?.environmentPlan ? `
              <div class="campaign-studio-environment-brief">
                <strong>${escapeHtml(environmentResult.environmentPlan.summary || "Environment plan ready")}</strong>
                <div class="campaign-studio-environment-rules">
                  ${(environmentResult.environmentPlan.consistencyRules || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                </div>
              </div>
            ` : ""}
            <div class="campaign-studio-environment-results">
              ${(environmentResult?.images || []).length
                ? `
                  <div class="campaign-studio-action-row">
                    <button class="ghost-button small" id="campaign-brain-environment-to-carousel-all" type="button">Use all square outputs in Meta carousel</button>
                  </div>
                  ${buildCampaignBrainEnvironmentResultGroups(environmentResult.images).map((group) => `
                    <article class="campaign-studio-environment-group-card">
                      <div class="campaign-studio-environment-group-head">
                        <div>
                          <strong>${escapeHtml(group.name || "Environment set")}</strong>
                          <span>${escapeHtml(`${group.items.length} format${group.items.length === 1 ? "" : "s"}`)}</span>
                        </div>
                      </div>
                      <div class="campaign-studio-environment-results is-grouped">
                        ${group.items.map((item) => {
                          const absoluteIndex = environmentResult.images.indexOf(item);
                          return `
                            <article class="campaign-studio-environment-result-card">
                              <img class="campaign-studio-environment-result-image" src="${escapeHtml(item.imageUrl || "")}" alt="">
                              <div class="campaign-studio-environment-result-copy">
                                <strong>${escapeHtml(item.format || "environment")}</strong>
                                <span>${escapeHtml(item.role || "Environment variant")}</span>
                                <p>${escapeHtml(compactText(item.prompt || "", 180))}</p>
                                <div class="campaign-studio-action-row">
                                  <button class="ghost-button small" type="button" data-campaign-environment-approve-reference="${absoluteIndex}">Approve as reference</button>
                                  <button class="ghost-button small" type="button" data-campaign-environment-save-output="${absoluteIndex}">Save output</button>
                                  <button class="ghost-button small" type="button" data-campaign-environment-to-carousel="${absoluteIndex}">Use in carousel</button>
                                  <a class="ghost-button small" href="${escapeHtml(item.imageUrl || "")}" download="${escapeHtml((item.name || `environment-${item.index}`).replace(/\.[a-z0-9]+$/i, ""))}-${escapeHtml(item.format || "environment")}.png">Download</a>
                                </div>
                              </div>
                            </article>
                          `;
                        }).join("")}
                      </div>
                    </article>
                  `).join("")}
                `
                : `<div class="klaviyo-rollout-empty campaign-studio-empty-note-wrap"><span>No environment outputs yet.</span></div>`}
            </div>
            <div class="campaign-studio-environment-brief campaign-studio-library-card" id="campaign-brain-asset-library">
              <details class="campaign-studio-fold campaign-studio-library-drawer"${appState.campaignBrainAssetLibrary?.pickerTarget ? " open" : ""}>
                <summary>
                  <span>
                    <small>Material bank</small>
                    <strong>Campaign assets</strong>
                  </span>
                  <span>${escapeHtml(`${visibleLibraryItems.length} approved`)}</span>
                </summary>
                <div class="campaign-studio-library-intro">
                  <p>Approved sources and environments stay versioned, channel-tagged and ready for reuse across campaigns.</p>
                  <div class="campaign-studio-action-row">
                    <button class="ghost-button small" type="button" data-campaign-asset-picker-open="environment_reference">Set visual reference</button>
                    <button class="ghost-button small" type="button" data-campaign-asset-picker-open="meta_carousel">Build Meta carousel</button>
                  </div>
                </div>
                ${buildCampaignAssetLibraryMarkup()}
              </details>
            </div>
            <div class="inline-feedback" id="campaign-brain-environment-feedback" aria-live="polite"></div>
          </div>
        </article>
        </section>
      `;

      const studioShell = artifactsNode.querySelector(".campaign-design-studio-shell");
      const studioMaster = studioShell?.querySelector(".campaign-studio-master-card");
      if (studioShell && studioMaster) {
        studioShell.querySelector(".campaign-studio-priority-card")?.remove();
        const emailPanel = studioShell.querySelector(".campaign-studio-email-card");
        const metaPanel = studioShell.querySelector(".campaign-studio-meta-card");
        const blogPanel = studioShell.querySelector(".campaign-studio-blog-card");
        const environmentPanel = studioShell.querySelector(".campaign-studio-hero-card");
        const assetLibrary = environmentPanel?.querySelector("#campaign-brain-asset-library");
        let assetPanel = null;
        if (assetLibrary) {
          assetPanel = document.createElement("article");
          assetPanel.className = "campaign-studio-asset-workspace";
          assetPanel.appendChild(assetLibrary);
        }
        [
          [metaPanel, "meta"],
          [emailPanel, "email"],
          [blogPanel, "blog"],
          [environmentPanel, "environment"],
          [assetPanel, "assets"]
        ].forEach(([node, view]) => {
          if (!node) return;
          node.setAttribute("data-campaign-studio-panel", view);
          studioShell.appendChild(node);
        });
        setCampaignStudioActiveView(appState.campaignStudioActiveView);
        bindCampaignEmailBuilderCanvas();
      }
    }
  }

  // Artifact rendering replaces these controls, so always bind state to the live nodes.
  environmentButton = document.getElementById("campaign-brain-generate-environment-button");
  environmentFeedbackNode = document.getElementById("campaign-brain-environment-feedback");
  accountSelect = document.getElementById("campaign-brain-klaviyo-account");
  feedbackNode = document.getElementById("campaign-brain-klaviyo-feedback");
  metaSuggestButton = document.getElementById("campaign-brain-suggest-meta-button");
  metaBuildButton = document.getElementById("campaign-brain-build-meta-button");
  metaValidateButton = document.getElementById("campaign-brain-validate-meta-button");
  metaPushButton = document.getElementById("campaign-brain-push-meta-button");
  metaFeedbackNode = document.getElementById("campaign-brain-meta-feedback");

  if (feedbackNode) {
    feedbackNode.className = "inline-feedback";
    if (appState.campaignBrainKlaviyoPushing) {
      feedbackNode.textContent = `Creating a draft in ${appState.campaignBrainKlaviyoAccount}...`;
      feedbackNode.classList.add("loading");
    } else if (appState.campaignBrainKlaviyoPushError) {
      feedbackNode.textContent = appState.campaignBrainKlaviyoPushError;
      feedbackNode.classList.add("error");
    } else if (appState.campaignBrainKlaviyoPushResult?.results?.length) {
      const first = appState.campaignBrainKlaviyoPushResult.results[0];
      feedbackNode.textContent = first?.ok
        ? `Klaviyo draft created in ${first.country}: ${first.templateName || first.templateId || "draft ready"}.`
        : "Klaviyo draft push finished with issues.";
      feedbackNode.classList.add(first?.ok ? "success" : "error");
    } else {
      feedbackNode.textContent = "";
    }
  }

  if (metaValidateButton) {
    const targetReady = getCampaignBrainMetaTargetModel().ready;
    metaValidateButton.disabled = !artifactDraft?.artifacts?.meta || appState.campaignBrainMetaValidating || !targetReady;
    metaValidateButton.textContent = appState.campaignBrainMetaValidating ? "Validating..." : "Validate Meta draft";
    metaValidateButton.classList.toggle("is-loading", appState.campaignBrainMetaValidating);
    metaValidateButton.setAttribute("aria-busy", appState.campaignBrainMetaValidating ? "true" : "false");
  }

  if (metaSuggestButton) {
    const canSuggest = getCampaignBrainCarouselFiles().length >= 5;
    metaSuggestButton.disabled = !artifactDraft?.artifacts?.meta || appState.campaignBrainMetaSuggesting || !canSuggest;
    metaSuggestButton.textContent = appState.campaignBrainMetaSuggesting ? "Writing UK English..." : "Write UK English copy";
    metaSuggestButton.classList.toggle("is-loading", appState.campaignBrainMetaSuggesting);
    metaSuggestButton.setAttribute("aria-busy", appState.campaignBrainMetaSuggesting ? "true" : "false");
  }

  if (metaBuildButton) {
    const targetReady = getCampaignBrainMetaTargetModel().ready;
    const sourceReady = getCampaignBrainCarouselFiles().length >= 5;
    metaBuildButton.disabled = !artifactDraft?.artifacts?.meta || appState.campaignBrainMetaBuilding || !targetReady || !sourceReady;
    metaBuildButton.textContent = appState.campaignBrainMetaBuilding
      ? (appState.campaignBrainMetaBuildPhase || "Building carousel...")
      : "Build carousel → paused Meta draft";
    metaBuildButton.classList.toggle("is-loading", appState.campaignBrainMetaBuilding);
    metaBuildButton.setAttribute("aria-busy", appState.campaignBrainMetaBuilding ? "true" : "false");
  }

  if (metaPushButton) {
    const isCarouselExecution = deriveCampaignBrainMetaConfig().adFormat === "Carousel";
    const canPushCarousel = isCarouselExecution
      && getCampaignBrainCarouselFiles().length === 5
      && appState.campaignBrainMetaAssets?.carouselDesignReady === true;
    const targetReady = getCampaignBrainMetaTargetModel().ready;
    metaPushButton.disabled = !artifactDraft?.artifacts?.meta || appState.campaignBrainMetaPushing || !canPushCarousel || !targetReady;
    metaPushButton.textContent = appState.campaignBrainMetaPushing ? "Creating..." : "Create Meta draft";
    metaPushButton.classList.toggle("is-loading", appState.campaignBrainMetaPushing);
    metaPushButton.setAttribute("aria-busy", appState.campaignBrainMetaPushing ? "true" : "false");
  }

  if (environmentButton) {
    environmentButton.disabled = appState.campaignBrainEnvironmentLoading || !getCampaignBrainEnvironmentFiles().length;
    environmentButton.textContent = appState.campaignBrainEnvironmentLoading ? "Generating..." : "Generate environment series";
    environmentButton.classList.toggle("is-loading", appState.campaignBrainEnvironmentLoading);
    environmentButton.setAttribute("aria-busy", appState.campaignBrainEnvironmentLoading ? "true" : "false");
  }

  if (metaFeedbackNode) {
    metaFeedbackNode.className = "inline-feedback";
    if (appState.campaignBrainMetaBuilding) {
      metaFeedbackNode.textContent = appState.campaignBrainMetaBuildPhase || "Building the complete Meta carousel...";
      metaFeedbackNode.classList.add("loading");
    } else if (appState.campaignBrainMetaPushing) {
      metaFeedbackNode.textContent = "Creating the Meta draft against the live ad account...";
      metaFeedbackNode.classList.add("loading");
    } else if (appState.campaignBrainMetaSuggesting) {
      metaFeedbackNode.textContent = "AI is drafting sharper carousel card copy...";
      metaFeedbackNode.classList.add("loading");
    } else if (appState.campaignBrainMetaValidating) {
      metaFeedbackNode.textContent = "Running Meta draft validation against the live connection...";
      metaFeedbackNode.classList.add("loading");
    } else if (appState.campaignBrainMetaSuggestError) {
      metaFeedbackNode.textContent = appState.campaignBrainMetaSuggestError;
      metaFeedbackNode.classList.add("error");
    } else if (appState.campaignBrainMetaSuggestResult?.cards?.length) {
      metaFeedbackNode.textContent = `AI updated ${appState.campaignBrainMetaSuggestResult.cards.length} carousel card suggestion${appState.campaignBrainMetaSuggestResult.cards.length === 1 ? "" : "s"}.`;
      metaFeedbackNode.classList.add("success");
    } else if (appState.campaignBrainMetaPushError) {
      metaFeedbackNode.textContent = appState.campaignBrainMetaPushError;
      metaFeedbackNode.classList.add("error");
    } else if (appState.campaignBrainMetaPushResult?.ok) {
      metaFeedbackNode.textContent = `Meta draft created. Ad ID: ${appState.campaignBrainMetaPushResult.adId || "--"}. Status: ${appState.campaignBrainMetaPushResult.status || "PAUSED"}.`;
      metaFeedbackNode.classList.add("success");
    } else if (appState.campaignBrainMetaValidationError) {
      metaFeedbackNode.textContent = appState.campaignBrainMetaValidationError;
      metaFeedbackNode.classList.add("error");
    } else if (appState.campaignBrainMetaValidationResult?.ok) {
      const targetName = appState.campaignBrainMetaValidationResult?.validation?.targetAdSet?.name || "target ad set";
      const warnings = Array.isArray(appState.campaignBrainMetaValidationResult?.validation?.warnings)
        ? appState.campaignBrainMetaValidationResult.validation.warnings
        : [];
      metaFeedbackNode.textContent = warnings.length
        ? `Meta validation passed for ${targetName} with warnings: ${warnings.join(" | ")}`
        : `Meta validation passed for ${targetName}.`;
      metaFeedbackNode.classList.add("success");
    } else {
      metaFeedbackNode.textContent = "";
    }
  }

  if (environmentFeedbackNode) {
    environmentFeedbackNode.className = "inline-feedback";
    if (appState.campaignBrainEnvironmentLoading) {
      environmentFeedbackNode.textContent = "Creating a consistent luxury environment series from the uploaded product shots...";
      environmentFeedbackNode.classList.add("loading");
    } else if (appState.campaignBrainEnvironmentError) {
      environmentFeedbackNode.textContent = appState.campaignBrainEnvironmentError;
      environmentFeedbackNode.classList.add("error");
    } else if (appState.campaignBrainEnvironmentResult?.images?.length) {
      const errors = Array.isArray(appState.campaignBrainEnvironmentResult?.errors)
        ? appState.campaignBrainEnvironmentResult.errors
        : [];
      environmentFeedbackNode.textContent = errors.length
        ? `Generated ${appState.campaignBrainEnvironmentResult.images.length} environment image${appState.campaignBrainEnvironmentResult.images.length === 1 ? "" : "s"} with ${errors.length} issue${errors.length === 1 ? "" : "s"} to review.`
        : `Generated ${appState.campaignBrainEnvironmentResult.images.length} consistent environment image${appState.campaignBrainEnvironmentResult.images.length === 1 ? "" : "s"}.`;
      environmentFeedbackNode.classList.add(errors.length ? "warning" : "success");
    } else {
      environmentFeedbackNode.textContent = "";
    }
  }

  renderCampaignBrainMetaPayloadPreview();
}

function readCampaignAssemblyPayload() {
  return {
    inputMode: appState.campaignStudioMode,
    title: document.getElementById("campaign-brain-title")?.value || "",
    audience: document.getElementById("campaign-brain-audience")?.value || "",
    offer: document.getElementById("campaign-brain-offer")?.value || "",
    tone: "Commercial, direct and premium",
    channels: parseCampaignBrainList(document.getElementById("campaign-brain-channels")?.value || ""),
    markets: parseCampaignBrainList(document.getElementById("campaign-brain-markets")?.value || ""),
    assets: parseCampaignBrainList(document.getElementById("campaign-brain-assets")?.value || ""),
    constraints: parseCampaignBrainList(document.getElementById("campaign-brain-constraints")?.value || ""),
    campaignTaskRaw: document.getElementById("campaign-brain-campaign-task")?.value || "",
    contentTaskRaw: document.getElementById("campaign-brain-content-task")?.value || "",
    sourceHtml: document.getElementById("campaign-brain-source-html")?.value || "",
    extraPrompt: document.getElementById("campaign-brain-extra-prompt")?.value || ""
  };
}

async function assembleCampaignObject() {
  if (appState.campaignAssemblyLoading) {
    return;
  }

  appState.campaignAssemblyLoading = true;
  appState.campaignAssemblyError = "";
  renderCampaignBrainPanel();

  try {
    const result = await requestCampaignAssembly(readCampaignAssemblyPayload());
    appState.campaignAssemblyObject = result;
    appState.campaignAssemblyGeneratedAt = new Date().toISOString();
    clearCampaignBrainMetaFeedback();
    await hydrateCampaignAssetLibrary(result?.campaignObject?.campaignKey || "");
    const storedDraft = loadCampaignStudioDraftFromStorage();
    syncCampaignBrainMetaConfig(storedDraft?.metaConfig || {});
    syncCampaignBrainEnvironmentConfigFromStorage(storedDraft?.environmentConfig || null);
    syncCampaignBrainMetaAssetsFromStorage(storedDraft?.metaAssets || null);
    if (storedDraft?.draft?.artifacts) {
      appState.campaignArtifactDraft = storedDraft.draft;
      hydrateCampaignStudioDraftStatus(`Loaded studio draft saved ${formatKlaviyoDate(storedDraft.savedAt || new Date().toISOString())}`);
    } else {
      hydrateCampaignStudioDraftStatus("");
    }

    if (result?.brainInput) {
      const titleField = document.getElementById("campaign-brain-title");
      const objectiveField = document.getElementById("campaign-brain-objective");
      const audienceField = document.getElementById("campaign-brain-audience");
      const offerField = document.getElementById("campaign-brain-offer");
      const sourceTypeField = document.getElementById("campaign-brain-source-type");
      const sourceSubjectField = document.getElementById("campaign-brain-source-subject");
      const sourceBodyField = document.getElementById("campaign-brain-source-body");
      const channelsField = document.getElementById("campaign-brain-channels");
      const marketsField = document.getElementById("campaign-brain-markets");
      const assetsField = document.getElementById("campaign-brain-assets");
      const constraintsField = document.getElementById("campaign-brain-constraints");

      if (titleField && !titleField.value) titleField.value = result.brainInput.title || "";
      if (objectiveField && !objectiveField.value) objectiveField.value = result.brainInput.objective || "";
      if (audienceField && !audienceField.value) audienceField.value = result.brainInput.audience || "";
      if (offerField && !offerField.value) offerField.value = result.brainInput.offer || "";
      if (sourceTypeField) sourceTypeField.value = result.brainInput.source?.type || "brief";
      if (sourceSubjectField && !sourceSubjectField.value) sourceSubjectField.value = result.brainInput.source?.subject || "";
      if (sourceBodyField && !sourceBodyField.value) sourceBodyField.value = result.brainInput.source?.body || "";
      if (channelsField && !channelsField.value) channelsField.value = (result.brainInput.channels || []).join(", ");
      if (marketsField && !marketsField.value) marketsField.value = (result.brainInput.markets || []).join(", ");
      if (assetsField && !assetsField.value) assetsField.value = (result.brainInput.assets || []).join("\n");
      if (constraintsField && !constraintsField.value) constraintsField.value = (result.brainInput.constraints || []).join("\n");
    }
  } catch (error) {
    appState.campaignAssemblyError = error.message || "Campaign assembly failed.";
  } finally {
    appState.campaignAssemblyLoading = false;
    renderCampaignBrainPanel();
  }
}

async function generateCampaignBrainPlan() {
  if (appState.campaignBrainLoading) {
    return;
  }

  appState.campaignBrainLoading = true;
  appState.campaignBrainError = "";
  renderCampaignBrainPanel();

  try {
    const payload = readCampaignBrainPayload();
    const result = await requestCampaignBrain(payload);
    appState.campaignBrainResult = result;
    appState.campaignBrainGeneratedAt = result.generatedAt || new Date().toISOString();
  } catch (error) {
    appState.campaignBrainError = error.message || "Campaign brain generation failed.";
  } finally {
    appState.campaignBrainLoading = false;
    renderCampaignBrainPanel();
  }
}

async function generateCampaignArtifacts() {
  if (appState.campaignArtifactsLoading || !appState.campaignBrainResult) {
    return;
  }

  appState.campaignArtifactsLoading = true;
  appState.campaignArtifactsError = "";
  renderCampaignBrainPanel();

  try {
    const payload = readCampaignBrainPayload();
    const result = await requestCampaignArtifacts({
      ...payload,
      plan: appState.campaignBrainResult
    });
    appState.campaignArtifactsResult = result;
    appState.campaignBrainEmailVisualsResult = null;
    appState.campaignBrainEmailVisualsError = "";
    clearCampaignBrainMetaFeedback();
    const storedDraft = loadCampaignStudioDraftFromStorage();
    syncCampaignBrainMetaConfig(storedDraft?.metaConfig || {});
    syncCampaignBrainEnvironmentConfigFromStorage(storedDraft?.environmentConfig || null);
    syncCampaignBrainMetaAssetsFromStorage(storedDraft?.metaAssets || null);
    appState.campaignArtifactDraft = JSON.parse(JSON.stringify(result));
    appState.campaignArtifactsGeneratedAt = result.generatedAt || new Date().toISOString();
    hydrateCampaignStudioDraftStatus(storedDraft?.savedAt
      ? "Generated a fresh production pack. Your previous saved draft remains available in local storage."
      : "");
  } catch (error) {
    appState.campaignArtifactsError = error.message || "Campaign artifact generation failed.";
  } finally {
    appState.campaignArtifactsLoading = false;
    renderCampaignBrainPanel();
  }
}

async function pushCampaignBrainEmailToKlaviyo() {
  const email = appState.campaignArtifactDraft?.artifacts?.email || null;
  if (!email?.bodyHtml) {
    appState.campaignBrainKlaviyoPushError = "Generate the artifact pack before creating a Klaviyo draft.";
    renderCampaignBrainPanel();
    return;
  }
  if (/src=["']data:image\//i.test(email.bodyHtml)) {
    appState.campaignBrainKlaviyoPushError = "Email contains an unhosted AI visual. Klaviyo hosting must succeed before this draft can be created.";
    renderCampaignBrainPanel();
    return;
  }

  appState.campaignBrainKlaviyoPushing = true;
  appState.campaignBrainKlaviyoPushError = "";
  appState.campaignBrainKlaviyoPushResult = null;
  renderCampaignBrainPanel();

  try {
    const sourceName = appState.campaignBrainResult?.input?.title || "Campaign Brain Draft";
    const account = appState.campaignBrainKlaviyoAccount || "DK";
    const languageCode = getKlaviyoMappedLanguageCode(account) || "da-DK";
    const language = getKlaviyoLanguageByCode(languageCode);
    const payload = await requestKlaviyoPushTemplateRollout({
      sourceTemplateName: sourceName,
      assignments: [
        {
          country: account,
          code: languageCode,
          label: language?.label || languageCode,
          translationPath: "Campaign Brain -> Klaviyo draft",
          subject: email.subject || sourceName,
          previewText: email.previewText || "",
          body: email.bodyHtml || ""
        }
      ]
    });

    appState.campaignBrainKlaviyoPushResult = payload;
    await recordCurrentCampaignLearning("klaviyo_draft_created", "email", {
      externalDraftId: payload?.results?.[0]?.templateId || payload?.results?.[0]?.id || payload?.templateId || "",
      destination: `Klaviyo ${account}`
    });
  } catch (error) {
    appState.campaignBrainKlaviyoPushError = error.message || "Campaign Brain Klaviyo draft push failed.";
  } finally {
    appState.campaignBrainKlaviyoPushing = false;
    renderCampaignBrainPanel();
  }
}

let campaignEmailCompileTimer = null;
let campaignEmailCompileSequence = 0;

function updateCampaignEmailBuilderSaveState(saveState = "saved", message = "Saved locally") {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  state.saveState = saveState;
  state.saveMessage = message;
  const node = document.querySelector("[data-email-builder-save-state]");
  if (node instanceof HTMLElement) {
    node.className = `campaign-email-builder-save-state is-${saveState}`;
    node.textContent = message;
  }
}

function captureCampaignEmailBuilderViewState() {
  const builder = document.querySelector(".campaign-email-builder");
  if (!builder) return null;
  const active = document.activeElement;
  const field = active instanceof HTMLElement && builder.contains(active) ? active : null;
  return {
    inspectorScrollTop: builder.querySelector(".campaign-email-builder-inspector")?.scrollTop || 0,
    canvasScrollTop: builder.querySelector(".campaign-email-builder-device iframe")?.contentWindow?.scrollY || 0,
    field: field ? {
      moduleField: field.getAttribute("data-email-module-field") || "",
      moduleIndex: field.getAttribute("data-email-module-index"),
      artifactField: field.getAttribute("data-campaign-artifact-field") || "",
      selectionStart: Number(field.selectionStart ?? 0),
      selectionEnd: Number(field.selectionEnd ?? field.selectionStart ?? 0)
    } : null
  };
}

function restoreCampaignEmailBuilderViewState(viewState = null) {
  if (!viewState) return;
  const restore = () => {
    const builder = document.querySelector(".campaign-email-builder");
    if (!builder) return;
    const inspector = builder.querySelector(".campaign-email-builder-inspector");
    if (inspector instanceof HTMLElement) inspector.scrollTop = Number(viewState.inspectorScrollTop || 0);
    const iframe = builder.querySelector(".campaign-email-builder-device iframe");
    if (iframe instanceof HTMLIFrameElement) {
      const restoreCanvasScroll = () => {
        try { iframe.contentWindow?.scrollTo(0, Number(viewState.canvasScrollTop || 0)); } catch (error) { /* Keep editor usable if the preview is unavailable. */ }
      };
      restoreCanvasScroll();
      iframe.addEventListener("load", restoreCanvasScroll, { once: true });
    }
    if (viewState.field) {
      const candidates = [...builder.querySelectorAll("input, textarea, select")];
      const nextField = candidates.find((candidate) => {
        if (viewState.field.moduleField) {
          return candidate.getAttribute("data-email-module-field") === viewState.field.moduleField
            && candidate.getAttribute("data-email-module-index") === viewState.field.moduleIndex;
        }
        return viewState.field.artifactField
          && candidate.getAttribute("data-campaign-artifact-field") === viewState.field.artifactField;
      });
      if (nextField instanceof HTMLElement) {
        appState.campaignEmailBuilder.restoringView = true;
        nextField.focus({ preventScroll: true });
        appState.campaignEmailBuilder.restoringView = false;
        if (typeof nextField.setSelectionRange === "function") {
          const maximum = String(nextField.value || "").length;
          nextField.setSelectionRange(
            Math.min(maximum, Number(viewState.field.selectionStart || 0)),
            Math.min(maximum, Number(viewState.field.selectionEnd || 0))
          );
        }
      }
    }
  };
  window.requestAnimationFrame(restore);
  window.setTimeout(restore, 120);
}

async function compileCampaignStudioEmail({ render = true, sequence: reservedSequence = null } = {}) {
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  if (!email) return;
  const sequence = Number.isInteger(reservedSequence) ? reservedSequence : ++campaignEmailCompileSequence;
  updateCampaignEmailBuilderSaveState("saving", "Saving & compiling…");
  hydrateCampaignStudioDraftStatus("Compiling Westpack modules...");
  try {
    const payload = await requestCampaignEmailCompile({
      input: appState.campaignBrainResult?.input || appState.campaignArtifactDraft?.input || {},
      email
    });
    if (sequence !== campaignEmailCompileSequence || !payload?.email) return;
    const viewState = captureCampaignEmailBuilderViewState();
    const activeSelectedIndex = Number(appState.campaignEmailBuilder?.selectedIndex || 0);
    appState.campaignArtifactDraft.artifacts.email = payload.email;
    appState.campaignEmailBuilder.selectedIndex = Math.max(0, Math.min(activeSelectedIndex, (payload.email.sections?.length || 1) - 1));
    const saved = persistCampaignStudioDraft();
    updateCampaignEmailBuilderSaveState(saved ? "saved" : "error", saved ? "Saved locally" : "Save failed");
    hydrateCampaignStudioDraftStatus("Westpack master compiled");
    if (render) {
      renderCampaignBrainPanel();
      restoreCampaignEmailBuilderViewState(viewState);
    }
  } catch (error) {
    const saved = persistCampaignStudioDraft();
    updateCampaignEmailBuilderSaveState(saved ? "warning" : "error", saved ? "Saved locally · compile failed" : "Save and compile failed");
    hydrateCampaignStudioDraftStatus(error.message || "Email compilation failed.");
  }
}

function scheduleCampaignStudioEmailCompile() {
  window.clearTimeout(campaignEmailCompileTimer);
  const sequence = ++campaignEmailCompileSequence;
  const saved = persistCampaignStudioDraft();
  updateCampaignEmailBuilderSaveState(saved ? "saving" : "error", saved ? "Saving & compiling…" : "Save failed");
  campaignEmailCompileTimer = window.setTimeout(() => compileCampaignStudioEmail({ sequence }), 650);
}

function snapshotCampaignEmail() {
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  return email ? JSON.stringify({
    email,
    selectedIndex: Number(appState.campaignEmailBuilder?.selectedIndex || 0)
  }) : "";
}

function recordCampaignEmailHistory(key = "change", { force = false } = {}) {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  const now = Date.now();
  if (!force && state.lastHistoryKey === key && now - Number(state.lastHistoryAt || 0) < 1200) return;
  const snapshot = snapshotCampaignEmail();
  if (!snapshot || state.history.at(-1) === snapshot) return;
  state.history.push(snapshot);
  state.history = state.history.slice(-24);
  state.future = [];
  state.lastHistoryKey = key;
  state.lastHistoryAt = now;
}

function restoreCampaignEmailSnapshot(snapshot = "") {
  if (!snapshot || !appState.campaignArtifactDraft?.artifacts) return false;
  try {
    const parsed = JSON.parse(snapshot);
    const email = parsed?.email && typeof parsed.email === "object" ? parsed.email : parsed;
    if (!email || typeof email !== "object") return false;
    appState.campaignArtifactDraft.artifacts.email = email;
    if (Number.isInteger(Number(parsed?.selectedIndex))) {
      appState.campaignEmailBuilder.selectedIndex = Number(parsed.selectedIndex);
    }
    return true;
  } catch (error) {
    return false;
  }
}

function undoCampaignEmailBuilder() {
  const state = getCampaignEmailBuilderState();
  const visibleSelection = document.querySelector(".campaign-email-builder-outline article.is-active [data-email-builder-select]")?.getAttribute("data-email-builder-select");
  if (visibleSelection !== null && visibleSelection !== undefined) state.selectedIndex = Number(visibleSelection);
  const previous = state.history.pop();
  if (!previous) return;
  state.future.push(snapshotCampaignEmail());
  state.lastHistoryKey = "";
  if (restoreCampaignEmailSnapshot(previous)) compileCampaignStudioEmail();
}

function redoCampaignEmailBuilder() {
  const state = getCampaignEmailBuilderState();
  const visibleSelection = document.querySelector(".campaign-email-builder-outline article.is-active [data-email-builder-select]")?.getAttribute("data-email-builder-select");
  if (visibleSelection !== null && visibleSelection !== undefined) state.selectedIndex = Number(visibleSelection);
  const next = state.future.pop();
  if (!next) return;
  state.history.push(snapshotCampaignEmail());
  state.lastHistoryKey = "";
  if (restoreCampaignEmailSnapshot(next)) compileCampaignStudioEmail();
}

function createCampaignEmailModule(moduleId = "editorial_text") {
  const label = CAMPAIGN_EMAIL_MODULES.find(([id]) => id === moduleId)?.[1] || "Editorial section";
  const imageLayouts = new Set(["image_full", "image_left", "image_right", "product_spotlight"]);
  return {
    moduleId,
    layout: moduleId,
    label,
    headline: "Add a decisive campaign headline",
    body: "Shape this module around one clear customer benefit and the evidence that supports it.",
    bullets: [],
    imageUrl: "",
    imageAlt: "",
    imageMode: imageLayouts.has(moduleId) ? "auto" : "none",
    imageAspect: "natural",
    imageFocalPoint: "center",
    imageZoom: 100,
    spacing: "balanced",
    textAlign: "left",
    contentWidth: "standard",
    surfaceStyle: "plain"
  };
}

function addCampaignEmailModuleByType(moduleId = "editorial_text", targetIndex = null) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  if (!Array.isArray(sections) || sections.length >= 4 || !CAMPAIGN_EMAIL_MODULES.some(([id]) => id === moduleId)) return;
  recordCampaignEmailHistory(`add:${moduleId}`, { force: true });
  const numericTarget = Number(targetIndex);
  const insertionIndex = targetIndex === null || !Number.isInteger(numericTarget)
    ? sections.length
    : Math.max(0, Math.min(numericTarget, sections.length));
  sections.splice(insertionIndex, 0, createCampaignEmailModule(moduleId));
  appState.campaignEmailBuilder.selectedIndex = insertionIndex;
  compileCampaignStudioEmail();
}

function replaceCampaignEmailModuleLayout(index, moduleId = "editorial_text") {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const numericIndex = Number(index);
  const label = CAMPAIGN_EMAIL_MODULES.find(([id]) => id === moduleId)?.[1];
  if (!Array.isArray(sections) || !sections[numericIndex] || !label) return false;
  if ((sections[numericIndex].moduleId || sections[numericIndex].layout) === moduleId) return false;
  recordCampaignEmailHistory(`layout:${numericIndex}:${moduleId}`, { force: true });
  sections[numericIndex].moduleId = moduleId;
  sections[numericIndex].layout = moduleId;
  sections[numericIndex].label = label;
  const imageLayouts = new Set(["image_full", "image_left", "image_right", "product_spotlight"]);
  if (!imageLayouts.has(moduleId)) {
    sections[numericIndex].imageMode = "none";
  } else if (sections[numericIndex].imageMode === "none") {
    sections[numericIndex].imageMode = sections[numericIndex].imageUrl ? "assigned" : "auto";
  }
  appState.campaignEmailBuilder.selectedIndex = numericIndex;
  compileCampaignStudioEmail();
  return true;
}

function duplicateCampaignEmailModule(index) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const numericIndex = Number(index);
  if (!Array.isArray(sections) || sections.length >= 4 || !sections[numericIndex]) return;
  recordCampaignEmailHistory(`duplicate:${numericIndex}`, { force: true });
  sections.splice(numericIndex + 1, 0, JSON.parse(JSON.stringify(sections[numericIndex])));
  appState.campaignEmailBuilder.selectedIndex = numericIndex + 1;
  compileCampaignStudioEmail();
}

function reorderCampaignEmailModules(sourceIndex, targetIndex) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const from = Number(sourceIndex);
  const to = Number(targetIndex);
  if (!Array.isArray(sections) || !Number.isInteger(from) || !Number.isInteger(to) || from === to || !sections[from] || to < 0 || to > sections.length) return false;
  recordCampaignEmailHistory(`drag:${from}:${to}`, { force: true });
  const [moved] = sections.splice(from, 1);
  const insertionIndex = Math.min(to, sections.length);
  sections.splice(insertionIndex, 0, moved);
  appState.campaignEmailBuilder.selectedIndex = insertionIndex;
  appState.campaignEmailBuilder.draggingIndex = -1;
  appState.campaignEmailBuilder.draggingModuleId = "";
  compileCampaignStudioEmail();
  return true;
}

async function reviseCampaignEmailModule(instruction = "Strengthen this module") {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  const module = email?.sections?.[state.selectedIndex];
  if (!email || !module || state.aiLoading) return;
  const requestedIndex = state.selectedIndex;
  state.aiLoading = true;
  state.aiError = "";
  state.aiSuggestion = null;
  renderCampaignBrainPanel();
  try {
    const result = await requestCampaignEmailModuleRevision({
      input: appState.campaignBrainResult?.input || appState.campaignArtifactDraft?.input || {},
      module,
      emailContext: {
        subject: email.subject || "",
        heroHeadline: email.heroHeadline || "",
        primaryCta: email.primaryCta || "",
        visualDirection: email.visualDirection || "",
        modulePosition: requestedIndex + 1,
        moduleCount: email.sections.length
      },
      instruction
    });
    if (state.selectedIndex !== requestedIndex) return;
    state.aiSuggestion = result?.suggestion || null;
  } catch (error) {
    state.aiError = error.message || "AI copilot could not revise this module.";
  } finally {
    state.aiLoading = false;
    renderCampaignBrainPanel();
  }
}

function applyCampaignEmailAiSuggestion() {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  const section = appState.campaignArtifactDraft?.artifacts?.email?.sections?.[state.selectedIndex];
  const suggestion = state.aiSuggestion;
  if (!section || !suggestion) return;
  recordCampaignEmailHistory(`ai:${state.selectedIndex}`, { force: true });
  ["label", "headline", "body"].forEach((field) => {
    if (typeof suggestion[field] === "string") section[field] = suggestion[field];
  });
  if (Array.isArray(suggestion.bullets)) section.bullets = suggestion.bullets.slice(0, 5);
  state.aiSuggestion = null;
  state.inspectorTab = "content";
  compileCampaignStudioEmail();
}

function bindCampaignEmailBuilderCanvas() {
  const iframe = document.querySelector(".campaign-email-builder-device iframe");
  if (!(iframe instanceof HTMLIFrameElement)) return;
  const decorate = () => {
    try {
      const documentNode = iframe.contentDocument;
      if (!documentNode) return;
      if (documentNode.documentElement?.dataset?.westpackBuilderBound === "true") return;
      const style = documentNode.createElement("style");
      style.textContent = `[data-email-module]{cursor:grab;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .15s ease,opacity .15s ease,transform .15s ease}[data-email-module]:hover{outline-color:rgba(169,0,55,.45)!important}[data-builder-selected=true]{outline-color:#a90037!important}[data-builder-dragging=true]{opacity:.38;cursor:grabbing}[data-builder-drop-position=before]{box-shadow:inset 0 5px 0 #a90037!important}[data-builder-drop-position=after]{box-shadow:inset 0 -5px 0 #a90037!important}[data-builder-image-selected=true]{outline:4px solid #0b7b57!important;outline-offset:-4px!important;cursor:grab!important}[data-builder-edit-field]{cursor:text!important;outline:1px dashed rgba(169,0,55,.5)!important;outline-offset:5px;border-radius:2px;transition:background .15s ease,outline-color .15s ease}[data-builder-edit-field]:focus{outline:2px solid #a90037!important;background:rgba(255,244,247,.8)!important}`;
      documentNode.head?.appendChild(style);
      let modules = [...documentNode.querySelectorAll("[data-email-module]")]
        .filter((node) => !node.querySelector("[data-email-module]"))
        .filter((node) => node.getAttribute("data-email-region") !== "hero");
      if (!modules.length) {
        const expectedCount = Math.min(4, appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
        modules = [...documentNode.querySelectorAll("h2")]
          .map((heading) => heading.closest("tr") || heading.parentElement)
          .filter((node, index, values) => node && values.indexOf(node) === index)
          .slice(0, expectedCount);
        modules.forEach((node, index) => node.setAttribute("data-email-module", `legacy-module-${index + 1}`));
      }
      if (!modules.length) return;
      const selectedIndex = Number(appState.campaignEmailBuilder?.selectedIndex || 0);
      modules.forEach((node, index) => {
        node.setAttribute("data-builder-selected", index === selectedIndex ? "true" : "false");
        node.setAttribute("data-builder-module-index", String(index));
        node.setAttribute("draggable", "false");
        node.querySelectorAll("img").forEach((image) => {
          image.setAttribute("draggable", "false");
          image.setAttribute("data-builder-image-selected", index === selectedIndex && appState.campaignEmailBuilder?.selectionKind === "image" ? "true" : "false");
          image.setAttribute("tabindex", index === selectedIndex && appState.campaignEmailBuilder?.selectionKind === "image" ? "0" : "-1");
        });
      });
      if (appState.campaignEmailBuilder?.restoreCanvasFocus) {
        appState.campaignEmailBuilder.restoreCanvasFocus = false;
        const focusTarget = appState.campaignEmailBuilder?.selectionKind === "image"
          ? modules[selectedIndex]?.querySelector("img")
          : modules[selectedIndex];
        focusTarget?.setAttribute?.("tabindex", "0");
        window.setTimeout(() => focusTarget?.focus?.({ preventScroll: true }), 0);
      }
      if (appState.campaignEmailBuilder?.inlineEditing) {
        const selectedModule = modules[selectedIndex];
        const heading = selectedModule?.querySelector?.("h2") || [...documentNode.querySelectorAll("h2")][selectedIndex] || null;
        const body = heading?.nextElementSibling?.matches?.("p") ? heading.nextElementSibling : null;
        [[heading, "headline"], [body, "body"]].forEach(([field, name]) => {
          if (!field) return;
          field.setAttribute("contenteditable", "plaintext-only");
          field.setAttribute("spellcheck", "true");
          field.setAttribute("data-builder-edit-field", name);
          field.setAttribute("role", "textbox");
          field.setAttribute("aria-label", name === "headline" ? "Edit module headline" : "Edit module body copy");
          field.addEventListener("paste", (event) => {
            event.preventDefault();
            documentNode.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
          });
          field.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelCampaignEmailInlineCopy();
            } else if ((name === "headline" && event.key === "Enter") || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
              event.preventDefault();
              saveCampaignEmailInlineCopy();
            }
          });
        });
        window.setTimeout(() => {
          if (heading?.isConnected) {
            heading.focus();
            const selection = documentNode.getSelection();
            selection?.selectAllChildren(heading);
            selection?.collapseToEnd();
          }
        }, 0);
      }
      if (documentNode.documentElement) documentNode.documentElement.dataset.westpackBuilderBound = "true";
      documentNode.addEventListener("click", (event) => {
        if (Date.now() < Number(appState.campaignEmailBuilder?.suppressCanvasClickUntil || 0)) return;
        if (event.target?.closest?.("[data-builder-edit-field]")) return;
        const moduleNode = event.target?.closest?.("[data-email-module]") || null;
        if (!moduleNode) return;
        const index = modules.indexOf(moduleNode);
        if (index < 0) return;
        event.preventDefault();
        appState.campaignEmailBuilder.selectedIndex = index;
        appState.campaignEmailBuilder.selectionKind = event.target?.closest?.("img") ? "image" : "module";
        appState.campaignEmailBuilder.restoreCanvasFocus = true;
        appState.campaignEmailBuilder.inlineEditing = false;
        appState.campaignEmailBuilder.inspectorTab = appState.campaignEmailBuilder.selectionKind === "image" ? "image" : "content";
        if (appState.campaignEmailBuilder.selectionKind === "image") appState.campaignEmailBuilder.imageTarget = "module";
        appState.campaignEmailBuilder.aiSuggestion = null;
        appState.campaignEmailBuilder.aiError = "";
        renderCampaignBrainPanel();
      });
      documentNode.addEventListener("dblclick", (event) => {
        const moduleNode = event.target?.closest?.("[data-email-module]") || null;
        if (!moduleNode || event.target?.closest?.("img")) return;
        const index = modules.indexOf(moduleNode);
        if (index < 0) return;
        event.preventDefault();
        appState.campaignEmailBuilder.selectedIndex = index;
        appState.campaignEmailBuilder.selectionKind = "module";
        appState.campaignEmailBuilder.restoreCanvasFocus = true;
        appState.campaignEmailBuilder.inlineEditing = true;
        renderCampaignBrainPanel();
      });
      documentNode.addEventListener("keydown", handleCampaignEmailBuilderKeyboard, true);
      documentNode.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || appState.campaignEmailBuilder?.inlineEditing || event.target?.closest?.("img,[data-builder-edit-field]")) return;
        const sourceNode = event.target?.closest?.("[data-email-module]") || null;
        const sourceIndex = modules.indexOf(sourceNode);
        if (!sourceNode || sourceIndex < 0) return;
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        let targetNode = sourceNode;
        let position = "before";
        const move = (moveEvent) => {
          if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 7) return;
          if (!moved) {
            moved = true;
            appState.campaignEmailBuilder.draggingIndex = sourceIndex;
            sourceNode.setAttribute("data-builder-dragging", "true");
          }
          moveEvent.preventDefault();
          const candidate = moveEvent.target?.closest?.("[data-email-module]")
            || documentNode.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest?.("[data-email-module]")
            || null;
          if (candidate && modules.includes(candidate)) {
            targetNode = candidate;
            const bounds = candidate.getBoundingClientRect();
            position = moveEvent.clientY < bounds.top + (bounds.height / 2) ? "before" : "after";
            modules.forEach((node) => {
              if (node !== candidate) node.removeAttribute("data-builder-drop-position");
            });
            candidate.setAttribute("data-builder-drop-position", position);
          }
          const viewportHeight = documentNode.documentElement?.clientHeight || 0;
          if (moveEvent.clientY < 56) documentNode.defaultView?.scrollBy({ top: -18, behavior: "auto" });
          if (viewportHeight && moveEvent.clientY > viewportHeight - 56) documentNode.defaultView?.scrollBy({ top: 18, behavior: "auto" });
        };
        const release = () => {
          documentNode.removeEventListener("pointermove", move);
          documentNode.removeEventListener("pointerup", release);
          documentNode.removeEventListener("pointercancel", release);
          if (!moved) return;
          const targetIndex = modules.indexOf(targetNode);
          let insertionIndex = targetIndex + (position === "after" ? 1 : 0);
          if (sourceIndex < insertionIndex) insertionIndex -= 1;
          clearCanvasDropState();
          appState.campaignEmailBuilder.draggingIndex = -1;
          appState.campaignEmailBuilder.suppressCanvasClickUntil = Date.now() + 350;
          reorderCampaignEmailModules(sourceIndex, insertionIndex);
        };
        documentNode.addEventListener("pointermove", move, { passive: false });
        documentNode.addEventListener("pointerup", release);
        documentNode.addEventListener("pointercancel", release);
      });
      const clearCanvasDropState = () => {
        modules.forEach((node) => {
          node.removeAttribute("data-builder-dragging");
          node.removeAttribute("data-builder-drop-position");
        });
      };
      documentNode.addEventListener("dragstart", (event) => {
        const moduleNode = event.target?.closest?.("[data-email-module]") || null;
        const index = modules.indexOf(moduleNode);
        if (!moduleNode || index < 0 || appState.campaignEmailBuilder?.inlineEditing) {
          event.preventDefault();
          return;
        }
        appState.campaignEmailBuilder.draggingIndex = index;
        appState.campaignEmailBuilder.selectionKind = "module";
        moduleNode.setAttribute("data-builder-dragging", "true");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-westpack-email-module", String(index));
          event.dataTransfer.setData("text/plain", `email-module:${index}`);
        }
      });
      documentNode.addEventListener("dragover", (event) => {
        if (Number(appState.campaignEmailBuilder?.draggingIndex ?? -1) < 0) return;
        const moduleNode = event.target?.closest?.("[data-email-module]") || null;
        if (!moduleNode) return;
        event.preventDefault();
        modules.forEach((node) => {
          if (node !== moduleNode) node.removeAttribute("data-builder-drop-position");
        });
        const bounds = moduleNode.getBoundingClientRect();
        moduleNode.setAttribute("data-builder-drop-position", event.clientY < bounds.top + (bounds.height / 2) ? "before" : "after");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      documentNode.addEventListener("drop", (event) => {
        const moduleNode = event.target?.closest?.("[data-email-module]") || null;
        const sourceIndex = Number(event.dataTransfer?.getData("application/x-westpack-email-module") || appState.campaignEmailBuilder?.draggingIndex);
        const targetIndex = modules.indexOf(moduleNode);
        if (!moduleNode || sourceIndex < 0 || targetIndex < 0) return;
        event.preventDefault();
        const after = moduleNode.getAttribute("data-builder-drop-position") === "after";
        let insertionIndex = targetIndex + (after ? 1 : 0);
        if (sourceIndex < insertionIndex) insertionIndex -= 1;
        clearCanvasDropState();
        appState.campaignEmailBuilder.draggingIndex = -1;
        reorderCampaignEmailModules(sourceIndex, insertionIndex);
      });
      documentNode.addEventListener("dragend", () => {
        clearCanvasDropState();
        appState.campaignEmailBuilder.draggingIndex = -1;
      });
    } catch (error) {
      // The srcdoc canvas is expected to be same-origin; keep the preview usable if a browser restricts it.
    }
  };
  iframe.addEventListener("load", decorate, { once: true });
  if (iframe.contentDocument?.readyState === "complete") decorate();
  [0, 250, 800].forEach((delay) => window.setTimeout(() => {
    if (iframe.isConnected) decorate();
  }, delay));
}

function setCampaignEmailBuilderDragSurface(active = false, kind = "module") {
  const builder = document.querySelector(".campaign-email-builder");
  if (!builder) return;
  builder.classList.toggle("is-builder-dragging", active);
  builder.classList.toggle("is-builder-image-dragging", active && kind === "image");
  const iframe = builder.querySelector(".campaign-email-builder-device iframe");
  const canvasDrop = builder.querySelector("[data-email-builder-canvas-drop]");
  if (iframe instanceof HTMLIFrameElement) iframe.style.pointerEvents = active ? "none" : "";
  if (canvasDrop instanceof HTMLElement) {
    canvasDrop.style.pointerEvents = active ? "auto" : "";
    canvasDrop.style.opacity = active ? "1" : "";
    const title = canvasDrop.querySelector("strong");
    const description = canvasDrop.querySelector("span");
    if (active && kind === "image") {
      if (title) title.textContent = "Choose the exact image module";
      if (description) description.textContent = "Only compatible image positions are shown. The image will belong to the module you choose.";
    } else if (active) {
      const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections || [];
      if (title) title.textContent = sections.length >= 4 ? "Choose the module to replace" : "Choose an exact position";
      if (description) description.textContent = sections.length >= 4
        ? "The selected position changes layout while its campaign copy remains attached."
        : "Drop on a module to insert before it, or use Add at end.";
    }
  }
}

function updateCampaignEmailModule(index, field, value) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const numericIndex = Number(index);
  if (!Array.isArray(sections) || !Number.isInteger(numericIndex) || !sections[numericIndex]) return;
  appState.campaignEmailBuilder.selectedIndex = numericIndex;
  recordCampaignEmailHistory(`module:${numericIndex}:${field}`);
  if (field === "bullets") {
    sections[numericIndex].bullets = String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
  } else if (field === "moduleId") {
    sections[numericIndex].moduleId = value;
    sections[numericIndex].layout = value;
    const imageLayouts = new Set(["image_full", "image_left", "image_right", "product_spotlight"]);
    if (!imageLayouts.has(value)) {
      sections[numericIndex].imageMode = "none";
    } else if (sections[numericIndex].imageMode === "none") {
      sections[numericIndex].imageMode = sections[numericIndex].imageUrl ? "assigned" : "auto";
    }
  } else if (field === "imageUrl") {
    sections[numericIndex].imageUrl = value;
    sections[numericIndex].imageMode = String(value || "").trim() ? "assigned" : "none";
  } else {
    sections[numericIndex][field] = value;
  }
  scheduleCampaignStudioEmailCompile();
}

function saveCampaignEmailInlineCopy() {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const section = Array.isArray(sections) ? sections[state.selectedIndex] : null;
  const iframe = document.querySelector('.campaign-email-builder-device iframe[title="Editable campaign email preview"]');
  const documentNode = iframe instanceof HTMLIFrameElement ? iframe.contentDocument : null;
  if (!section || !documentNode) {
    state.inlineEditing = false;
    renderCampaignBrainPanel();
    return;
  }
  const headline = String(documentNode.querySelector('[data-builder-edit-field="headline"]')?.textContent || "").replace(/\s+/g, " ").trim();
  const body = String(documentNode.querySelector('[data-builder-edit-field="body"]')?.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
  state.inlineEditing = false;
  if ((headline && headline !== section.headline) || (body && body !== section.body)) {
    recordCampaignEmailHistory(`inline-copy:${state.selectedIndex}`, { force: true });
    if (headline) section.headline = headline;
    if (body) section.body = body;
    updateCampaignEmailBuilderSaveState("saving", "Saving inline copy…");
    compileCampaignStudioEmail();
  } else {
    renderCampaignBrainPanel();
  }
}

function cancelCampaignEmailInlineCopy() {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  state.inlineEditing = false;
  renderCampaignBrainPanel();
}

function selectCampaignEmailModuleImage(index, url, alt, sourceUrl = "") {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const numericIndex = Number(index);
  if (!Array.isArray(sections) || !sections[numericIndex] || !url) return;
  const section = sections[numericIndex];
  const imageLayouts = new Set(["image_full", "image_left", "image_right", "product_spotlight"]);
  const currentLayout = section.moduleId || section.layout || "editorial_text";
  if (!imageLayouts.has(currentLayout)) {
    appState.campaignEmailBuilder.selectedIndex = numericIndex;
    appState.campaignEmailBuilder.inspectorTab = "content";
    updateCampaignEmailBuilderSaveState("warning", "Choose an image module first");
    return;
  }
  if (section.imageUrl === url && section.imageMode === "assigned" && (!alt || section.imageAlt === alt)) return;
  recordCampaignEmailHistory(`image:${numericIndex}`, { force: true });
  section.imageUrl = url;
  section.imageSourceUrl = String(sourceUrl || url).trim();
  section.imageAlt = alt || section.imageAlt || "Campaign image";
  section.imageMode = "assigned";
  appState.campaignEmailBuilder.selectedIndex = numericIndex;
  appState.campaignEmailBuilder.selectionKind = "image";
  updateCampaignEmailBuilderSaveState("saving", "Applying image…");
  scheduleCampaignStudioEmailCompile();
}

function removeCampaignEmailModuleImage(index) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const numericIndex = Number(index);
  if (!Array.isArray(sections) || !sections[numericIndex]) return;
  const section = sections[numericIndex];
  if (!section.imageUrl && section.imageMode === "none") return;
  recordCampaignEmailHistory(`image-remove:${numericIndex}`, { force: true });
  section.imageUrl = "";
  section.imageSourceUrl = "";
  section.imageAlt = "";
  section.imageMode = "none";
  appState.campaignEmailBuilder.selectedIndex = numericIndex;
  appState.campaignEmailBuilder.selectionKind = "module";
  updateCampaignEmailBuilderSaveState("saving", "Removing image…");
  scheduleCampaignStudioEmailCompile();
}

function removeCampaignEmailHeroImage() {
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  if (!email || (!email.heroImageUrl && email.heroImageMode === "none")) return;
  recordCampaignEmailHistory("hero-image-remove", { force: true });
  email.heroImageUrl = "";
  email.heroImageAlt = "";
  email.heroImageMode = "none";
  updateCampaignEmailBuilderSaveState("saving", "Removing hero image…");
  scheduleCampaignStudioEmailCompile();
}

function selectCampaignEmailHeroImage(url, alt = "Campaign hero image") {
  const email = appState.campaignArtifactDraft?.artifacts?.email;
  if (!email || !url) return;
  if (email.heroImageUrl === url && email.heroImageMode === "assigned" && email.heroImageAlt === alt) return;
  recordCampaignEmailHistory("hero-image", { force: true });
  email.heroImageUrl = url;
  email.heroImageAlt = alt || email.heroImageAlt || "Campaign hero image";
  email.heroImageMode = "assigned";
  if (email.heroLayout === "typographic") email.heroLayout = "image_first";
  appState.campaignEmailBuilder.inspectorTab = "image";
  appState.campaignEmailBuilder.imageTarget = "hero";
  updateCampaignEmailBuilderSaveState("saving", "Applying hero image…");
  scheduleCampaignStudioEmailCompile();
}

async function uploadCampaignEmailHeroImage(file) {
  if (!(file instanceof File) || appState.campaignEmailBuilder.assetHosting) return;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
    updateCampaignEmailBuilderSaveState("error", "Use a JPG, PNG or WebP image");
    return;
  }
  if (file.size > CAMPAIGN_EMAIL_UPLOAD_MAX_BYTES) {
    updateCampaignEmailBuilderSaveState("error", "Image must be smaller than 3 MB");
    return;
  }
  appState.campaignEmailBuilder.assetHosting = true;
  appState.campaignEmailBuilder.inspectorTab = "image";
  appState.campaignEmailBuilder.imageTarget = "hero";
  updateCampaignEmailBuilderSaveState("saving", "Uploading hero image to Klaviyo…");
  renderCampaignBrainPanel();
  try {
    const imageDataUri = await fileToDataUrl(file);
    const result = await requestCampaignEmailAssetHosting({
      imageDataUri,
      name: file.name || "campaign-email-hero.jpg",
      klaviyoAccount: appState.campaignBrainKlaviyoAccount || "DK"
    });
    if (!result?.imageUrl) throw new Error("Klaviyo returned no hosted image URL.");
    selectCampaignEmailHeroImage(result.imageUrl, file.name.replace(/\.[^.]+$/, "") || "Campaign hero image");
    hydrateCampaignStudioDraftStatus("Hero image added to the email");
  } catch (error) {
    updateCampaignEmailBuilderSaveState("error", error.message || "Hero image upload failed");
    hydrateCampaignStudioDraftStatus(error.message || "The hero image could not be uploaded to Klaviyo.");
  } finally {
    appState.campaignEmailBuilder.assetHosting = false;
    renderCampaignBrainPanel();
  }
}

async function applyCampaignEmailHeroAsset(asset = {}) {
  const previewUrl = String(asset.previewUrl || asset.url || "").trim();
  const sourceUrl = String(asset.sourceUrl || previewUrl).trim();
  const alt = String(asset.alt || "Campaign hero image").trim() || "Campaign hero image";
  if (!previewUrl || appState.campaignEmailBuilder.assetHosting) return;
  if (asset.hosted === true) {
    selectCampaignEmailHeroImage(previewUrl, alt);
    return;
  }
  appState.campaignEmailBuilder.assetHosting = true;
  appState.campaignEmailBuilder.imageTarget = "hero";
  updateCampaignEmailBuilderSaveState("saving", "Hosting hero image in Klaviyo…");
  renderCampaignBrainPanel();
  try {
    const result = await requestCampaignEmailAssetHosting({
      sourceUrl,
      name: alt,
      klaviyoAccount: appState.campaignBrainKlaviyoAccount || "DK"
    });
    if (!result?.imageUrl) throw new Error("Klaviyo returned no hosted image URL.");
    selectCampaignEmailHeroImage(result.imageUrl, alt);
  } catch (error) {
    updateCampaignEmailBuilderSaveState("error", "Hero image hosting failed");
    hydrateCampaignStudioDraftStatus(error.message || "The hero image could not be hosted in Klaviyo.");
  } finally {
    appState.campaignEmailBuilder.assetHosting = false;
    renderCampaignBrainPanel();
  }
}

async function uploadCampaignEmailModuleImage(index, file) {
  const numericIndex = Number(index);
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  if (!Array.isArray(sections) || !sections[numericIndex] || !(file instanceof File) || appState.campaignEmailBuilder.assetHosting) return;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
    updateCampaignEmailBuilderSaveState("error", "Use a JPG, PNG or WebP image");
    return;
  }
  if (file.size > CAMPAIGN_EMAIL_UPLOAD_MAX_BYTES) {
    updateCampaignEmailBuilderSaveState("error", "Image must be smaller than 3 MB");
    return;
  }
  appState.campaignEmailBuilder.assetHosting = true;
  appState.campaignEmailBuilder.selectedIndex = numericIndex;
  appState.campaignEmailBuilder.inspectorTab = "image";
  updateCampaignEmailBuilderSaveState("saving", "Uploading image to Klaviyo…");
  renderCampaignBrainPanel();
  try {
    const imageDataUri = await fileToDataUrl(file);
    const result = await requestCampaignEmailAssetHosting({
      imageDataUri,
      name: file.name || `campaign-email-module-${numericIndex + 1}.jpg`,
      klaviyoAccount: appState.campaignBrainKlaviyoAccount || "DK"
    });
    if (!result?.imageUrl) throw new Error("Klaviyo returned no hosted image URL.");
    selectCampaignEmailModuleImage(numericIndex, result.imageUrl, file.name.replace(/\.[^.]+$/, "") || "Campaign image", result.imageUrl);
    appState.campaignEmailBuilder.selectionKind = "image";
    hydrateCampaignStudioDraftStatus(`Image added to email module ${numericIndex + 1}`);
  } catch (error) {
    updateCampaignEmailBuilderSaveState("error", error.message || "Image upload failed");
    hydrateCampaignStudioDraftStatus(error.message || "The image could not be uploaded to Klaviyo.");
  } finally {
    appState.campaignEmailBuilder.assetHosting = false;
    renderCampaignBrainPanel();
  }
}

async function applyCampaignEmailBuilderAsset(index, asset = {}) {
  const previewUrl = String(asset.previewUrl || asset.url || "").trim();
  const sourceUrl = String(asset.sourceUrl || previewUrl).trim();
  const alt = String(asset.alt || "Campaign image").trim() || "Campaign image";
  if (!previewUrl || appState.campaignEmailBuilder.assetHosting) return;
  if (asset.hosted === true) {
    selectCampaignEmailModuleImage(index, previewUrl, alt);
    return;
  }
  appState.campaignEmailBuilder.assetHosting = true;
  updateCampaignEmailBuilderSaveState("saving", "Hosting image in Klaviyo…");
  hydrateCampaignStudioDraftStatus("Hosting campaign image in the Klaviyo image library...");
  try {
    const result = await requestCampaignEmailAssetHosting({
      sourceUrl,
      name: alt,
      klaviyoAccount: appState.campaignBrainKlaviyoAccount || "DK"
    });
    if (!result?.imageUrl) throw new Error("Klaviyo returned no hosted image URL.");
    const email = appState.campaignArtifactDraft?.artifacts?.email;
    if (email) {
      const visualAssets = Array.isArray(email.visualAssets) ? email.visualAssets : [];
      if (!visualAssets.some((item) => item?.imageUrl === result.imageUrl)) {
        visualAssets.push({
          role: "campaign asset",
          name: alt,
          imageId: result.imageId || "",
          imageUrl: result.imageUrl,
          hosted: true
        });
      }
      email.visualAssets = visualAssets.slice(-12);
    }
    // Keep the stable Klaviyo copy as the crop source. Direct Asana assets can be
    // large and their CDN does not consistently allow browser canvas access.
    selectCampaignEmailModuleImage(index, result.imageUrl, alt, result.imageUrl);
  } catch (error) {
    updateCampaignEmailBuilderSaveState("error", "Image hosting failed");
    hydrateCampaignStudioDraftStatus(error.message || "Campaign image could not be hosted in Klaviyo.");
  } finally {
    appState.campaignEmailBuilder.assetHosting = false;
  }
}

async function applyCampaignEmailImageCrop() {
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  const selectedIndex = state.selectedIndex;
  const section = appState.campaignArtifactDraft?.artifacts?.email?.sections?.[selectedIndex];
  if (!section?.imageUrl || state.cropApplying) return;
  const sourceUrl = section.imageSourceUrl || section.imageUrl;
  const imageAspect = section.imageAspect || "natural";
  const imageZoom = Number(section.imageZoom || 100);
  const imageFocalPoint = section.imageFocalPoint || "center";
  const imageAlt = section.imageAlt || "campaign-image";
  state.cropApplying = true;
  renderCampaignBrainPanel();
  try {
    const cropSourceUrl = /^\/api\/campaign\/brain\?action=asset_proxy/i.test(sourceUrl)
      ? sourceUrl
      : `/api/campaign/brain?action=asset_proxy&url=${encodeURIComponent(sourceUrl)}`;
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.crossOrigin = "anonymous";
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("The source image could not be opened for cropping."));
      node.src = cropSourceUrl;
    });
    const ratios = { landscape: 3 / 2, square: 1, portrait: 4 / 5 };
    const ratio = ratios[imageAspect] || (image.naturalWidth / image.naturalHeight);
    const zoom = Math.max(1, Math.min(1.8, imageZoom / 100));
    let cropWidth = image.naturalWidth;
    let cropHeight = cropWidth / ratio;
    if (cropHeight > image.naturalHeight) { cropHeight = image.naturalHeight; cropWidth = cropHeight * ratio; }
    cropWidth /= zoom;
    cropHeight /= zoom;
    const focal = { top_left:[0,0],top:[.5,0],top_right:[1,0],left:[0,.5],center:[.5,.5],right:[1,.5],bottom_left:[0,1],bottom:[.5,1],bottom_right:[1,1] }[imageFocalPoint] || [.5,.5];
    const sourceX = (image.naturalWidth - cropWidth) * focal[0];
    const sourceY = (image.naturalHeight - cropHeight) * focal[1];
    const outputWidth = Math.min(1200, Math.max(600, Math.round(cropWidth)));
    const outputHeight = Math.round(outputWidth / ratio);
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    canvas.getContext("2d").drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
    const imageDataUri = canvas.toDataURL("image/jpeg", .9);
    const result = await requestCampaignEmailAssetHosting({ imageDataUri, name: `${imageAlt}-crop.jpg`, klaviyoAccount: appState.campaignBrainKlaviyoAccount || "DK" });
    if (!result?.imageUrl) throw new Error("Klaviyo returned no cropped image URL.");
    const activeSection = appState.campaignArtifactDraft?.artifacts?.email?.sections?.[selectedIndex];
    if (!activeSection) throw new Error("The selected email module no longer exists.");
    recordCampaignEmailHistory(`crop:${selectedIndex}`, { force: true });
    activeSection.imageSourceUrl = sourceUrl;
    activeSection.imageUrl = result.imageUrl;
    activeSection.imageMode = "assigned";
    activeSection.imageAspect = "natural";
    activeSection.imageZoom = 100;
    activeSection.imageFocalPoint = "center";
    const activeEmail = appState.campaignArtifactDraft?.artifacts?.email;
    const visualAssets = Array.isArray(activeEmail?.visualAssets) ? activeEmail.visualAssets : [];
    if (activeEmail && !visualAssets.some((item) => item?.imageUrl === result.imageUrl)) {
      visualAssets.push({
        role: "cropped campaign asset",
        name: `${imageAlt}-crop`,
        imageId: result.imageId || "",
        imageUrl: result.imageUrl,
        hosted: true
      });
      activeEmail.visualAssets = visualAssets.slice(-12);
    }
    state.cropEditorOpen = false;
    state.selectionKind = "image";
    compileCampaignStudioEmail();
  } catch (error) {
    state.cropError = error.message || "The crop could not be applied.";
    updateCampaignEmailBuilderSaveState("error", state.cropError);
    renderCampaignBrainPanel();
  } finally {
    state.cropApplying = false;
  }
}

function moveCampaignEmailModule(index, direction) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  const from = Number(index);
  const to = direction === "up" ? from - 1 : from + 1;
  if (!Array.isArray(sections) || from < 0 || to < 0 || from >= sections.length || to >= sections.length) return;
  recordCampaignEmailHistory(`move:${from}:${direction}`, { force: true });
  [sections[from], sections[to]] = [sections[to], sections[from]];
  appState.campaignEmailBuilder.selectedIndex = to;
  appState.campaignEmailBuilder.selectionKind = "module";
  compileCampaignStudioEmail();
}

function removeCampaignEmailModule(index) {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  if (!Array.isArray(sections) || sections.length <= 3) return;
  const numericIndex = Number(index);
  recordCampaignEmailHistory(`remove:${numericIndex}`, { force: true });
  sections.splice(numericIndex, 1);
  appState.campaignEmailBuilder.selectedIndex = Math.max(0, Math.min(numericIndex - 1, sections.length - 1));
  appState.campaignEmailBuilder.selectionKind = "module";
  compileCampaignStudioEmail();
}

function handleCampaignEmailBuilderKeyboard(event) {
  if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  const builder = document.querySelector(".campaign-email-builder");
  if (!(builder instanceof HTMLElement)) return;
  if (builder.offsetParent === null) return;
  const state = getCampaignEmailBuilderState(appState.campaignArtifactDraft?.artifacts?.email?.sections?.length || 0);
  if (event.key === "Escape" && state.cropEditorOpen) {
    event.preventDefault();
    state.cropEditorOpen = false;
    state.cropError = "";
    renderCampaignBrainPanel();
    window.requestAnimationFrame(() => document.querySelector(`[data-email-builder-crop-open="${state.selectedIndex}"]`)?.focus());
    return;
  }
  if (event.key === "Tab" && state.cropEditorOpen) {
    const modal = builder.querySelector(".campaign-email-crop-studio");
    const focusable = modal ? [...modal.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")] : [];
    if (focusable.length) {
      const currentIndex = focusable.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex].focus();
      return;
    }
  }
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest?.("input,textarea,select,[contenteditable=true],[role=textbox]")) return;
  if (state.inlineEditing) return;
  if (event.key === "Escape" && state.selectionKind === "image") {
    event.preventDefault();
    state.selectionKind = "module";
    renderCampaignBrainPanel();
    return;
  }
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  event.preventDefault();
  if (state.selectionKind === "image") {
    removeCampaignEmailModuleImage(state.selectedIndex);
    state.selectionKind = "module";
    return;
  }
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections || [];
  if (sections.length <= 3) {
    updateCampaignEmailBuilderSaveState("warning", "Keep at least three modules");
    return;
  }
  removeCampaignEmailModule(state.selectedIndex);
}

function addCampaignEmailModule() {
  const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
  if (!Array.isArray(sections) || sections.length >= 4) return;
  addCampaignEmailModuleByType("editorial_text");
}

function updateCampaignArtifactDraftField(path = "", value = "") {
  if (!appState.campaignArtifactDraft?.artifacts || !path) {
    return;
  }

  const segments = String(path).split(".");
  let cursor = appState.campaignArtifactDraft.artifacts;

  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor = cursor?.[segments[index]];
    if (!cursor || typeof cursor !== "object") {
      return;
    }
  }

  const finalKey = segments[segments.length - 1];
  if (finalKey && typeof cursor === "object") {
    cursor[finalKey] = value;
    if (path === "email.heroImageUrl") {
      cursor.heroImageMode = String(value || "").trim() ? "assigned" : "none";
    }
  }
}

function updateCampaignArtifactVariant(index, field = "", value = "") {
  const variants = appState.campaignArtifactDraft?.artifacts?.meta?.variants;
  const numericIndex = Number(index);

  if (!Array.isArray(variants) || !Number.isInteger(numericIndex) || !variants[numericIndex] || !field) {
    return;
  }

  variants[numericIndex][field] = value;
}

function buildCampaignLearningArtifactSnapshot(pack) {
  if (!pack?.artifacts) return null;
  const snapshot = JSON.parse(JSON.stringify(pack));
  const email = snapshot.artifacts?.email;
  if (email) {
    delete email.bodyHtml;
    delete email.sourceBodyHtml;
    delete email.compiledHtml;
  }
  const blog = snapshot.artifacts?.blog;
  if (blog?.bodyHtml) blog.bodyHtml = String(blog.bodyHtml).slice(0, 6000);
  return snapshot;
}

async function recordCurrentCampaignLearning(eventType, channel = "cross_channel", metadata = {}) {
  const editedArtifact = buildCampaignLearningArtifactSnapshot(appState.campaignArtifactDraft);
  const originalSource = appState.campaignStudioReviewJob?.output?.artifactPack || appState.campaignArtifactsResult;
  const originalArtifact = buildCampaignLearningArtifactSnapshot(originalSource);
  if (!editedArtifact?.artifacts || !originalArtifact?.artifacts) return null;
  try {
    return await requestCampaignLearningFeedback({
      eventType,
      jobId: appState.campaignStudioReviewJob?.id || "",
      editedArtifact,
      originalArtifact,
      channel,
      metadata
    });
  } catch (error) {
    console.warn("Campaign learning could not be recorded.", error);
    return null;
  }
}

async function saveCampaignStudioDraft() {
  if (!appState.campaignArtifactDraft?.artifacts) {
    hydrateCampaignStudioDraftStatus("Nothing to save yet.");
    return;
  }

  const ok = persistCampaignStudioDraft();
  const learning = ok ? await recordCurrentCampaignLearning("editor_saved") : null;
  const learnedChanges = Number(learning?.event?.diff?.totals?.changed || 0)
    + Number(learning?.event?.diff?.totals?.added || 0)
    + Number(learning?.event?.diff?.totals?.removed || 0);
  hydrateCampaignStudioDraftStatus(ok
    ? `Studio draft saved ${formatKlaviyoDate(new Date().toISOString())}${learning?.recorded && learnedChanges ? ` · AI learned from ${learnedChanges} deliberate change${learnedChanges === 1 ? "" : "s"}` : ""}`
    : "Could not save studio draft locally.");
}

function resetCampaignStudioDraft() {
  if (!appState.campaignArtifactsResult?.artifacts) {
    hydrateCampaignStudioDraftStatus("No generated artifact pack to reset to.");
    return;
  }

  appState.campaignArtifactDraft = JSON.parse(JSON.stringify(appState.campaignArtifactsResult));
  clearCampaignBrainMetaFeedback();
  appState.campaignBrainMetaAssets = {
    ...(appState.campaignBrainMetaAssets || {}),
    carouselCardDrafts: []
  };
  clearCampaignStudioDraftFromStorage();
  hydrateCampaignStudioDraftStatus("Studio draft reset to the latest generated artifact pack.");
  renderCampaignBrainPanel();
}

async function loadKlaviyoLiveData(options = {}) {
  if (appState.klaviyoLoading) {
    return "busy";
  }

  const force = options.force === true;
  if (appState.klaviyoLiveAttempted && !force) {
    return;
  }

  appState.klaviyoLoading = true;
  appState.klaviyoLiveAttempted = true;
  appState.klaviyoError = "";
  renderKlaviyoWorkspace();

  try {
    try {
      const snapshot = await requestKlaviyoCampaignOverview({ days: appState.klaviyoRangeDays, forceLive: force });
      const source = snapshot?.source === "snapshot" ? "snapshot" : "live";
      const warnings = [snapshot?.refreshWarning, snapshot?.subscriberWarning].filter(Boolean);
      if (warnings.length) {
        appState.klaviyoError = warnings.join(" ");
      }
      if (applyKlaviyoSnapshot(snapshot, source)) {
        loadKlaviyoAiInsights({ force: true });
        return source === "snapshot" ? "snapshot" : true;
      }
      appState.klaviyoError = "Klaviyo live route returned no campaign groups.";
    } catch (error) {
      appState.klaviyoError = error.message || "Klaviyo live route failed.";
    }

    const bundledSnapshot = loadLiveKlaviyoSnapshot();
    if (applyKlaviyoSnapshot(bundledSnapshot, "snapshot")) {
      loadKlaviyoAiInsights({ force: true });
      return "snapshot";
    }

    return false;
  } finally {
    appState.klaviyoLoading = false;
    renderKlaviyoWorkspace();
  }
}

function setWorkspace(nextWorkspace = "meta") {
  appState.workspace = nextWorkspace === "klaviyo" ? "klaviyo" : "meta";
  document.body.dataset.workspace = appState.workspace;

  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspace === appState.workspace);
  });

  const isMeta = appState.workspace === "meta";
  document.getElementById("meta-product-panel")?.classList.toggle("active", isMeta);
  document.getElementById("klaviyo-product-panel")?.classList.toggle("active", !isMeta);

  const metaNav = document.getElementById("meta-nav-list");
  const klaviyoNav = document.getElementById("klaviyo-nav-list");
  if (metaNav) metaNav.hidden = !isMeta;
  if (klaviyoNav) klaviyoNav.hidden = isMeta;

  if (!isMeta) {
    renderKlaviyoWorkspace();
    setKlaviyoView(appState.klaviyoView);
    loadKlaviyoLiveData();
    if (appState.klaviyoView === "duplicate_translate") {
      loadKlaviyoTemplateCatalog();
    }
    if (appState.klaviyoView === "campaign_ai") {
      loadKlaviyoTemplateCatalog();
    }
  }
}

function getModeIds(mode = appState.mode) {
  return getModeIdsAction(mode);
}

function getInputValue(id) {
  return getInputValueAction(id);
}

function getSelectedLabel(id) {
  return getSelectedLabelAction(id);
}

function setButtonBusy(id, isBusy, idleLabel, busyLabel) {
  setButtonBusyAction(id, isBusy, idleLabel, busyLabel);
}

function setDuplicateSummaryButtonsBusy(action, isBusy) {
  if (action === "generate") {
    setButtonBusy("duplicate-generate-missing-button", isBusy, "Generate missing only", "Generating...");
    return;
  }
}

function clearValidation() {
  clearValidationAction();
}

function markInvalid(id) {
  markInvalidAction(id);
}

function isValidHttpUrl(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function setCreateStep(step) {
  setCreateStepAction({ appState, step });
}

function scrollDuplicateStepIntoView(step) {
  const section = document.querySelector(`.duplicate-step[data-duplicate-step="${String(step)}"]`);
  if (section instanceof HTMLElement) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setDuplicateStep(step, options = {}) {
  const next = Math.max(1, Math.min(3, Number(step) || 1));
  appState.duplicateStep = next;

  document.querySelectorAll(".duplicate-step").forEach((el) => {
    const isCurrent = el.dataset.duplicateStep === String(next);
    el.classList.toggle("active", isCurrent);
    el.classList.toggle("is-current", isCurrent);
  });
  document.querySelectorAll("[data-duplicate-step-nav]").forEach((el) => {
    const isCurrent = el.dataset.duplicateStepNav === String(next);
    el.classList.toggle("active", isCurrent);
    el.setAttribute("aria-selected", isCurrent ? "true" : "false");
  });
  renderDuplicateWorkflowSummary();
  if (options.scroll === true) {
    scrollDuplicateStepIntoView(next);
  }
}

function canAdvanceDuplicateStep(step) {
  const ids = getModeIds("duplicate");
  const sourceId = getInputValue(ids.sourceAd);
  const campaignId = getInputValue(ids.targetCampaign);
  const adSetId = getInputValue(ids.targetAdSet);
  if (step === 1) return !!sourceId;
  if (step === 2) return !!campaignId && !!adSetId;
  if (step === 3) return !!sourceId && !!campaignId && !!adSetId;
  return true;
}

function getDuplicateOverrideStatus(target) {
  return getDuplicateOverrideStatusAction({ getDuplicateCreativeOverride, getDuplicateTargetKey, target });
}

function buildDuplicateWorkflowSummaryModel() {
  return buildDuplicateWorkflowSummaryModelAction({
    appState,
    getActiveDuplicateCreativeEditorTarget,
    getDuplicateBatchEntry,
    getDuplicateGeneratedPreviewCount,
    getDuplicateOverrideStatus,
    getDuplicatePublishTargets,
    getDuplicateTargetByKey,
    getDuplicateTargetKey,
    getInputValue,
    isModePreviewReady
  });
}

function renderDuplicateWorkflowSummary() {
  renderDuplicateWorkflowSummaryAction({
    buildDuplicateWorkflowSummaryModel,
    escapeHtml
  });
}

function getCachedCreateUploadPreviewUrl(file) {
  return getCreateUploadPreviewUrlAction(file);
}

function readDuplicateCarouselSortNumber(name = "") {
  const match = String(name || "").trim().match(/^(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function getOrderedDuplicateCarouselFiles(files = []) {
  return getOrderedDuplicateCarouselFilesAction(files);
}

function renderCreateUploadPreview() {
  renderCreateUploadPreviewAction({ getInputValue });
}

function syncCreateFormatClasses() {
  syncCreateFormatClassesAction({ getInputValue });
}

function canAdvanceCreateStep(step) {
  return canAdvanceCreateStepAction({ getInputValue, step });
}

function readFileAsBase64(file) {
  return readFileAsBase64Action(file);
}

function readBlobAsBase64(blob) {
  return readBlobAsBase64Action(blob);
}

const MAX_CREATE_IMAGE_UPLOAD_BYTES = 3_000_000;

function getCreateImageUploadSizeMessage(fileName, label = "Image") {
  return getCreateImageUploadSizeMessageAction(fileName, label);
}

function collectCreateImageUploadSizeIssues() {
  return collectCreateImageUploadSizeIssuesAction({ getInputValue });
}

function syncCreateImageUploadValidation(options = {}) {
  return syncCreateImageUploadValidationAction({
    getInputValue,
    markInvalid,
    options,
    setStudioStatus
  });
}

function captureVideoThumbnail(file, variant, ratio = 0.15) {
  return captureVideoThumbnailAction({
    cacheVideoThumbnail,
    file,
    getCachedVideoThumbnail,
    ratio,
    variant
  });
}

function resetVideoAnalysisState(message = "Analyze both videos to give AI better hook, pacing and product-context input.") {
  resetVideoAnalysisStateAction({ appState, escapeHtml, message });
}

async function analyzeCreateVideo() {
  return analyzeCreateVideoAction({
    appState,
    escapeHtml,
    getInputValue,
    markPreviewDirty,
    requestVideoAnalysis,
    setButtonBusy,
    setStudioStatus
  });
}

async function getCreateUploadedFilesPayload() {
  if (getInputValue("create-ad-format") === "Video") {
    return [];
  }
  if (getInputValue("create-ad-format") === "Single image") {
    return [];
  }
  if (getInputValue("create-ad-format") === "Carousel") {
    return [];
  }
  const input = document.getElementById("creative-upload");
  const files = Array.from(input?.files || []);
  const imageFiles = files.filter((file) => String(file.type || "").startsWith("image/"));

  if (!imageFiles.length) {
    return [];
  }

  const uploaded = [];
  for (const file of imageFiles.slice(0, 10)) {
    // Keep payload safe-ish for serverless.
    if (file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
      throw new Error(getCreateImageUploadSizeMessage(file.name, "File"));
    }

    const dataBase64 = await readFileAsBase64(file);
    uploaded.push({
      name: file.name,
      mime: file.type,
      data_base64: dataBase64
    });
  }

  return uploaded;
}

async function getCreateUploadedImageVariantsPayload() {
  if (getInputValue("create-ad-format") !== "Single image") {
    return [];
  }

  const variants = [
    {
      key: "square",
      label: "1:1 Feed image",
      aspectRatio: "1:1",
      file: document.getElementById("create-image-square-upload")?.files?.[0] || null
    },
    {
      key: "portrait",
      label: "4:5 Instagram feed image",
      aspectRatio: "4:5",
      file: document.getElementById("create-image-portrait-upload")?.files?.[0] || null
    },
    {
      key: "vertical",
      label: "9:16 Stories/Reels image",
      aspectRatio: "9:16",
      file: document.getElementById("create-image-vertical-upload")?.files?.[0] || null
    }
  ];

  const uploaded = [];
  for (const variant of variants) {
    if (!variant.file) {
      continue;
    }
    if (variant.file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
      throw new Error(getCreateImageUploadSizeMessage(variant.file.name, "Image"));
    }
    uploaded.push({
      key: variant.key,
      label: variant.label,
      aspectRatio: variant.aspectRatio,
      name: variant.file.name,
      mime: variant.file.type,
      data_base64: await readFileAsBase64(variant.file)
    });
  }

  return uploaded;
}

async function getCreateUploadedCarouselVariantsPayload() {
  if (getInputValue("create-ad-format") !== "Carousel") {
    return [];
  }

  const variants = [
    {
      key: "square",
      label: "1:1 Carousel cards",
      aspectRatio: "1:1",
      files: Array.from(document.getElementById("create-carousel-square-upload")?.files || [])
    }
  ];

  const uploaded = [];
  for (const variant of variants) {
    const orderedFiles = getOrderedCarouselFiles(variant.files, variant.key);
    const items = [];
    for (const file of orderedFiles.slice(0, 10)) {
      if (file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
        throw new Error(getCreateImageUploadSizeMessage(file.name, "Image"));
      }
      items.push({
        name: file.name,
        mime: file.type,
        data_base64: await readFileAsBase64(file)
      });
    }
    uploaded.push({
      key: variant.key,
      label: variant.label,
      aspectRatio: variant.aspectRatio,
      items
    });
  }

  return uploaded;
}

async function getCreateUploadedVideoVariantsPayload() {
  if (getInputValue("create-ad-format") !== "Video") {
    return [];
  }

  const variants = [
    {
      key: "square",
      label: "1:1 Feed video",
      aspectRatio: "1:1",
      file: document.getElementById("create-video-square-upload")?.files?.[0] || null
    },
    {
      key: "vertical",
      label: "9:16 Stories/Reels video",
      aspectRatio: "9:16",
      file: document.getElementById("create-video-vertical-upload")?.files?.[0] || null
    }
  ].filter((variant) => variant.file);

  const uploaded = [];
  for (const variant of variants) {
    if (variant.file.size > 20_000_000) {
      throw new Error(`Video '${variant.file.name}' is too large. Keep each upload around 20MB or below for now.`);
    }
    uploaded.push({
      key: variant.key,
      label: variant.label,
      aspectRatio: variant.aspectRatio,
      name: variant.file.name,
      mime: variant.file.type,
      data_base64: await readFileAsBase64(variant.file)
    });
  }

  return uploaded;
}

async function uploadImageAssetToMeta(file, fallbackName = "westpack-image") {
  if (!file) {
    throw new Error("Missing image file for Meta upload.");
  }
  if (file.size > MAX_CREATE_IMAGE_UPLOAD_BYTES) {
    throw new Error(getCreateImageUploadSizeMessage(file.name, "Image"));
  }

  const cachedHash = getCachedMetaImageHash(file);
  if (cachedHash) {
    return cachedHash;
  }

  const result = await requestMetaPublish({
    action: "upload_image_asset",
    file_name: file.name || fallbackName,
    mime: file.type,
    data_base64: await readFileAsBase64(file)
  });

  const imageHash = String(result?.imageHash || "").trim();
  cacheMetaImageHash(file, imageHash);
  return imageHash;
}

async function uploadCreateImageVariantsToMeta() {
  if (getInputValue("create-ad-format") !== "Single image") {
    return [];
  }

  const variants = [
    {
      key: "square",
      label: "1:1 Feed image",
      aspectRatio: "1:1",
      file: document.getElementById("create-image-square-upload")?.files?.[0] || null
    },
    {
      key: "portrait",
      label: "4:5 Instagram feed image",
      aspectRatio: "4:5",
      file: document.getElementById("create-image-portrait-upload")?.files?.[0] || null
    },
    {
      key: "vertical",
      label: "9:16 Stories/Reels image",
      aspectRatio: "9:16",
      file: document.getElementById("create-image-vertical-upload")?.files?.[0] || null
    }
  ];

  const uploaded = [];
  for (const variant of variants) {
    if (!variant.file) continue;
    setStudioStatus(`Uploading ${variant.label} to Meta...`, "loading");
    uploaded.push({
      key: variant.key,
      label: variant.label,
      aspectRatio: variant.aspectRatio,
      name: variant.file.name,
      mime: variant.file.type,
      meta_image_hash: await uploadImageAssetToMeta(variant.file, `${variant.key}-image`)
    });
  }

  return uploaded;
}

async function uploadCreateCarouselVariantsToMeta() {
  if (getInputValue("create-ad-format") !== "Carousel") {
    return [];
  }

  const variants = [
    {
      key: "square",
      label: "1:1 Carousel cards",
      aspectRatio: "1:1",
      files: Array.from(document.getElementById("create-carousel-square-upload")?.files || [])
    }
  ];

  const uploaded = [];
  for (const variant of variants) {
    const orderedFiles = getOrderedCarouselFiles(variant.files, variant.key);
    const items = [];
    for (let index = 0; index < orderedFiles.length; index += 1) {
      const file = orderedFiles[index];
      setStudioStatus(`Uploading ${variant.label} card ${index + 1} of ${orderedFiles.length} to Meta...`, "loading");
      items.push({
        name: file.name,
        mime: file.type,
        meta_image_hash: await uploadImageAssetToMeta(file, `${variant.key}-card-${index + 1}`)
      });
    }
    uploaded.push({
      key: variant.key,
      label: variant.label,
      aspectRatio: variant.aspectRatio,
      items
    });
  }

  return uploaded;
}

async function uploadVideoVariantToMeta(variant) {
  const file = variant?.file;
  if (!file) {
    throw new Error(`Missing ${variant?.label || "video"} file.`);
  }

  const cachedVariant = getCachedMetaVideoVariant(file);
  if (cachedVariant?.meta_video_id) {
    return {
      ...cachedVariant,
      key: variant.key || cachedVariant.key,
      label: variant.label || cachedVariant.label,
      aspectRatio: variant.aspectRatio || cachedVariant.aspectRatio
    };
  }

  const startSession = await requestMetaPublish({
    action: "start_video_upload_session",
    file_name: file.name,
    file_size: file.size
  });

  let startOffset = Number(startSession.startOffset || 0);
  let endOffset = Number(startSession.endOffset || 0);
  const fallbackChunkBytes = 1_000_000;

  while (startOffset < endOffset) {
    const requestedChunkBytes = endOffset > startOffset
      ? (endOffset - startOffset)
      : fallbackChunkBytes;
    const chunkEnd = Math.min(file.size, startOffset + requestedChunkBytes);
    const chunk = file.slice(startOffset, chunkEnd, file.type || "video/mp4");
    const chunkBase64 = await readBlobAsBase64(chunk);
    const transfer = await requestMetaPublish({
      action: "transfer_video_upload_chunk",
      upload_session_id: startSession.uploadSessionId,
      start_offset: String(startOffset),
      mime: file.type || "video/mp4",
      chunk_base64: chunkBase64
    });

    startOffset = Number(transfer.startOffset || 0);
    endOffset = Number(transfer.endOffset || endOffset || 0);
    const progress = file.size > 0 ? Math.min(99, Math.round((startOffset / file.size) * 100)) : 99;
    setStudioStatus(`Uploading ${variant.label} to Meta... ${progress}%`, "loading");
    await wait(250);
  }

  const finished = await requestMetaPublish({
    action: "finish_video_upload_session",
    upload_session_id: startSession.uploadSessionId,
    file_name: file.name
  });

  const thumbnail = await captureVideoThumbnail(file, variant);

  const uploadedVariant = {
    key: variant.key,
    label: variant.label,
    aspectRatio: variant.aspectRatio,
    name: file.name,
    mime: file.type || "video/mp4",
    meta_video_id: finished.videoId || startSession.videoId,
    thumbnail_mime: thumbnail.mime,
    thumbnail_data_base64: thumbnail.data_base64
  };
  cacheMetaVideoVariant(file, uploadedVariant);
  return uploadedVariant;
}

async function uploadVideoVariantsToMeta(variants = []) {
  const uploaded = [];
  for (const variant of variants) {
    if (!variant?.file) {
      continue;
    }
    uploaded.push(await uploadVideoVariantToMeta(variant));
    await wait(1500);
  }
  return uploaded;
}

async function uploadCreateVideoVariantsToMeta() {
  if (getInputValue("create-ad-format") !== "Video") {
    return [];
  }

  const variants = [
    {
      key: "square",
      label: "1:1 feed video",
      aspectRatio: "1:1",
      file: document.getElementById("create-video-square-upload")?.files?.[0] || null
    },
    {
      key: "vertical",
      label: "9:16 stories/reels video",
      aspectRatio: "9:16",
      file: document.getElementById("create-video-vertical-upload")?.files?.[0] || null
    }
  ];

  return uploadVideoVariantsToMeta(variants);
}

async function uploadDuplicateVideoVariantsToMeta(key = "", target = null) {
  const override = getDuplicateCreativeOverride(key);
  if (override.mode !== "video") {
    return [];
  }

  if (override.uploadedVideoVariants.length >= 2) {
    return override.uploadedVideoVariants;
  }

  const squareFile = override.videoFiles.square || null;
  const verticalFile = override.videoFiles.vertical || null;
  if (!squareFile || !verticalFile) {
    throw new Error(`Localized video override is incomplete for ${target?.campaignName || "this target"} / ${target?.adSetName || ""}.`);
  }

  const uploadedVariants = await uploadVideoVariantsToMeta([
    {
      key: "square",
      label: `${target?.languageLabel || "Localized"} feed video`,
      aspectRatio: "1:1",
      file: squareFile
    },
    {
      key: "vertical",
      label: `${target?.languageLabel || "Localized"} stories/reels video`,
      aspectRatio: "9:16",
      file: verticalFile
    }
  ]);
  upsertDuplicateCreativeOverride(key, {
    uploadedVideoVariants: uploadedVariants
  });
  return uploadedVariants;
}

async function uploadDuplicateCarouselVariantsToMeta(key = "", target = null) {
  const override = getDuplicateCreativeOverride(key);
  if (override.mode !== "carousel") {
    return [];
  }

  if (override.uploadedCarouselVariants.length) {
    return override.uploadedCarouselVariants;
  }

  const orderedFiles = getOrderedDuplicateCarouselFiles(override.carouselFiles || []);
  if (orderedFiles.length < 2) {
    throw new Error(`Upload at least 2 localized carousel cards for ${target?.campaignName || "this target"} / ${target?.adSetName || ""}.`);
  }

  const items = [];
  for (let index = 0; index < orderedFiles.length; index += 1) {
    const file = orderedFiles[index];
    setStudioStatus(`Uploading ${target?.languageLabel || "Localized"} carousel card ${index + 1} of ${orderedFiles.length} to Meta...`, "loading");
    items.push({
      name: file.name,
      mime: file.type,
      meta_image_hash: await uploadImageAssetToMeta(file, `duplicate-carousel-${index + 1}`)
    });
  }

  const uploadedVariants = [
    {
      key: "square",
      label: "1:1 Carousel cards",
      aspectRatio: "1:1",
      items
    }
  ];

  upsertDuplicateCreativeOverride(key, {
    uploadedCarouselVariants: uploadedVariants
  });
  return uploadedVariants;
}

function syncModeFieldsFromPreview(preview) {
  const ids = getModeIds(appState.mode);
  const adFormatSelect = document.getElementById(ids.adFormat);
  const languageSelect = document.getElementById(ids.targetLanguage);
  const campaignSelect = document.getElementById(ids.targetCampaign);
  const adSetSelect = document.getElementById(ids.targetAdSet);

  if (adFormatSelect && preview?.adFormat && Array.from(adFormatSelect.options).some((option) => option.value === preview.adFormat)) {
    adFormatSelect.value = preview.adFormat;
  }

  if (languageSelect && preview?.targetLanguage && Array.from(languageSelect.options).some((option) => option.value === preview.targetLanguage)) {
    languageSelect.value = preview.targetLanguage;
    if (appState.mode === "duplicate") {
      syncDuplicateTargetLanguageFields(preview.targetLanguage, ids.targetLanguage);
    }
  }

  if (campaignSelect && preview?.targetCampaignId && Array.from(campaignSelect.options).some((option) => option.value === preview.targetCampaignId)) {
    campaignSelect.value = preview.targetCampaignId;
  }

  if (adSetSelect && preview?.targetAdSetId && Array.from(adSetSelect.options).some((option) => option.value === preview.targetAdSetId)) {
    adSetSelect.value = preview.targetAdSetId;
  }
}

function getCurrentFormSignature() {
  const ids = getModeIds();
  const creativeFileNames = Array.from(document.getElementById("creative-upload")?.files || []).map((file) => `${file.name}:${file.size}`);
  const createAssetFileNames = [
    "create-image-square-upload",
    "create-image-portrait-upload",
    "create-image-vertical-upload",
    "create-carousel-square-upload",
    "create-video-square-upload",
    "create-video-vertical-upload"
  ].map((id) => {
    const files = Array.from(document.getElementById(id)?.files || []);
    return files.length
      ? `${id}:${files.map((file) => `${file.name}:${file.size}`).join("|")}`
      : `${id}:`;
  });
  const carouselOrderState = getCreateCarouselOrderStateAction();
  return JSON.stringify({
    mode: appState.mode,
    sourceCampaignId: ids.sourceCampaign ? getInputValue(ids.sourceCampaign) : "",
    sourceAdSet: ids.sourceAdSet ? getInputValue(ids.sourceAdSet) : "",
    sourceAdId: ids.sourceAd ? getInputValue(ids.sourceAd) : "",
    targetCampaignId: getInputValue(ids.targetCampaign),
    targetAdSetId: getInputValue(ids.targetAdSet),
    duplicateBulkTargets: (appState.duplicateBulkTargets || []).map((target) => getDuplicateTargetKey(target)),
    targetLanguage: getInputValue(ids.targetLanguage),
    adFormat: getInputValue(ids.adFormat),
    destinationUrl: getInputValue(ids.destinationUrl),
    adaptationGoal: getInputValue(ids.adaptationGoal),
    campaignIntent: getInputValue("create-ad-intent"),
    newAdName: getInputValue("new-ad-name"),
    newAdAngle: getInputValue("new-ad-angle"),
    creativeFileNames,
    createAssetFileNames,
    carouselOrderState
  });
}

function markPreviewDirty(message = "Settings changed. Generate preview again.") {
  if (!appState.lastGeneratedSignature) {
    return;
  }

  if (getCurrentFormSignature() !== appState.lastGeneratedSignature) {
    if (appState.mode === "duplicate") {
      clearDuplicateBatchPreviews();
    }
    setStudioStatus(message, "warning");
  }

  syncActionAvailability();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getMetaUploadFileFingerprint(file) {
  if (!file) {
    return "";
  }

  return [
    String(file.name || "").trim(),
    Number(file.size || 0),
    Number(file.lastModified || 0),
    String(file.type || "").trim()
  ].join("::");
}

function cloneUploadedVideoVariant(variant = {}) {
  return {
    key: variant.key || "",
    label: variant.label || "",
    aspectRatio: variant.aspectRatio || "",
    name: variant.name || "",
    mime: variant.mime || "video/mp4",
    meta_video_id: variant.meta_video_id || "",
    thumbnail_mime: variant.thumbnail_mime || "",
    thumbnail_data_base64: variant.thumbnail_data_base64 || ""
  };
}

function getCachedMetaImageHash(file) {
  const fingerprint = getMetaUploadFileFingerprint(file);
  if (!fingerprint) {
    return "";
  }
  return String(appState.metaUploadedImageHashes?.[fingerprint] || "").trim();
}

function cacheMetaImageHash(file, imageHash = "") {
  const fingerprint = getMetaUploadFileFingerprint(file);
  const normalizedHash = String(imageHash || "").trim();
  if (!fingerprint || !normalizedHash) {
    return;
  }
  appState.metaUploadedImageHashes = {
    ...(appState.metaUploadedImageHashes || {}),
    [fingerprint]: normalizedHash
  };
}

function getCachedMetaVideoVariant(file) {
  const fingerprint = getMetaUploadFileFingerprint(file);
  const cached = fingerprint ? appState.metaUploadedVideoVariants?.[fingerprint] : null;
  return cached ? cloneUploadedVideoVariant(cached) : null;
}

function cacheMetaVideoVariant(file, uploadedVariant = null) {
  const fingerprint = getMetaUploadFileFingerprint(file);
  if (!fingerprint || !uploadedVariant?.meta_video_id) {
    return;
  }
  appState.metaUploadedVideoVariants = {
    ...(appState.metaUploadedVideoVariants || {}),
    [fingerprint]: cloneUploadedVideoVariant(uploadedVariant)
  };
}

function getCachedVideoThumbnail(file) {
  const fingerprint = getMetaUploadFileFingerprint(file);
  const cached = fingerprint ? appState.metaVideoThumbnailCache?.[fingerprint] : null;
  if (!cached?.data_base64) {
    return null;
  }
  return {
    mime: cached.mime || "image/jpeg",
    data_base64: cached.data_base64
  };
}

function cacheVideoThumbnail(file, thumbnail = null) {
  const fingerprint = getMetaUploadFileFingerprint(file);
  if (!fingerprint || !thumbnail?.data_base64) {
    return;
  }
  appState.metaVideoThumbnailCache = {
    ...(appState.metaVideoThumbnailCache || {}),
    [fingerprint]: {
      mime: thumbnail.mime || "image/jpeg",
      data_base64: thumbnail.data_base64
    }
  };
}

function setSyncStatus(message = "", tone = "neutral") {
  const target = document.getElementById("sync-status");
  if (!target) {
    return;
  }

  target.textContent = message;
  target.dataset.tone = tone;
}

function formatRelativeAgeFromNow(value = "") {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedMinutes = Math.round(elapsedMs / 60000);
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function toTitleCaseWord(value = "") {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function buildMetaTrustState() {
  const meta = appState.metaSnapshotMeta || null;
  if (!meta) {
    return {
      sourceKind: "unknown",
      freshness: "unknown",
      completeness: "unknown",
      label: "Unknown",
      detail: "No Meta snapshot metadata is loaded yet.",
      tone: "neutral"
    };
  }

  const warnings = Array.isArray(appState.metaQuality?.warnings) ? appState.metaQuality.warnings : [];
  const validation = appState.metaQuality?.validation || null;
  const validationFailed = Number(validation?.failCount || 0) > 0;
  const validationWarned = Number(validation?.warnCount || 0) > 0;
  const sourceKind = (() => {
    if (meta.source === "meta-live-api") return "live";
    if (meta.source === "fallback" || meta.source === "fallback-cache") return "fallback";
    if (meta.source === "cache" || meta.source === "recent-cache" || meta.source === "bundled") return "cached";
    return "cached";
  })();

  const referenceTimestamp = meta.generatedAt || meta.cachedAt || "";
  const ageMs = referenceTimestamp ? Math.max(0, Date.now() - new Date(referenceTimestamp).getTime()) : Number.NaN;
  const freshness = !Number.isFinite(ageMs)
    ? "unknown"
    : ageMs <= (2 * 60 * 60 * 1000)
      ? "fresh"
      : ageMs <= (24 * 60 * 60 * 1000)
        ? "aging"
        : "stale";

  const partialSignals = [];
  if (sourceKind === "fallback") partialSignals.push("fallback source");
  if (meta.source === "bundled") partialSignals.push("bundled snapshot");
  if (warnings.length) partialSignals.push(`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
  if (validationFailed) partialSignals.push(`${validation.failCount} validation fail${validation.failCount === 1 ? "" : "s"}`);
  if (!validationFailed && validationWarned) partialSignals.push(`${validation.warnCount} validation warning${validation.warnCount === 1 ? "" : "s"}`);

  const completeness = partialSignals.length ? "partial" : "full";
  const label = [
    toTitleCaseWord(sourceKind),
    toTitleCaseWord(freshness),
    completeness === "partial" ? "Partial" : "Full"
  ].filter(Boolean).join(" · ");

  const detailParts = [];
  if (meta.sourceLabel) detailParts.push(meta.sourceLabel);
  if (referenceTimestamp) detailParts.push(formatRelativeAgeFromNow(referenceTimestamp));
  if (partialSignals.length) detailParts.push(partialSignals.join(" · "));

  let tone = "neutral";
  if (sourceKind === "live" && freshness === "fresh" && completeness === "full") {
    tone = "success";
  } else if (freshness === "stale" || sourceKind === "fallback" || completeness === "partial") {
    tone = "warning";
  }

  return {
    sourceKind,
    freshness,
    completeness,
    label,
    detail: detailParts.join(" · ") || "Unknown trust state",
    tone
  };
}

function getMetaTrustStatusTone() {
  const trustTone = buildMetaTrustState().tone;
  return trustTone === "warning" ? "warning" : trustTone === "success" ? "success" : "neutral";
}

function buildMetaQualityLabel() {
  const currency = appState.metaCurrency || "EUR";
  const normalization = appState.metaQuality?.budgetNormalization;
  const pagination = appState.metaQuality?.pagination || null;
  const awarenessUsingAdSetInsights = Number(appState.metaQuality?.awarenessUsingAdSetInsights || 0);
  const trust = buildMetaTrustState();
  const parts = [trust.label, `Currency: ${currency}`];

  if (normalization && Number.isFinite(Number(normalization.divisor))) {
    const divisor = Number(normalization.divisor);
    const confidence = String(normalization.confidence || "").trim();
    const normalizationLabel = divisor > 1 ? `budgets normalized /${divisor}` : "budgets kept raw";
    parts.push(confidence ? `${normalizationLabel} (${confidence})` : normalizationLabel);
  }

  if (pagination) {
    const pages = [
      pagination.campaignsPages,
      pagination.campaignInsightsPages,
      pagination.adSetsPages,
      pagination.adSetInsightsPages,
      pagination.adsPages
    ].filter((value) => Number.isFinite(Number(value)) && Number(value) > 1);

    if (pages.length) {
      parts.push("pagination expanded");
    }
  }

  if (awarenessUsingAdSetInsights > 0) {
    parts.push(`awareness via ad sets (${awarenessUsingAdSetInsights})`);
  }

  const warningCount = Array.isArray(appState.metaQuality?.warnings)
    ? appState.metaQuality.warnings.length
    : 0;
  if (warningCount > 0) {
    parts.push(`${warningCount} quality warning${warningCount === 1 ? "" : "s"}`);
  }

  const schedule = appState.metaQuality?.schedule || null;
  if (schedule?.serverCronSchedulesUtc?.length) {
    parts.push(`${schedule.serverCronSchedulesUtc.length} server cron`);
  }

  return parts.join(" · ");
}

function formatMetaSnapshotMetaLine(meta = null) {
  if (!meta) {
    return "Unknown source";
  }

  const parts = [];
  if (meta.sourceLabel) parts.push(meta.sourceLabel);
  if (meta.generatedAt) parts.push(`Generated ${formatKlaviyoDate(meta.generatedAt)}`);
  if (meta.cachedAt) parts.push(`Cached ${formatKlaviyoDate(meta.cachedAt)}`);
  return parts.join(" · ") || "Unknown source";
}

function buildMetaQualityCards() {
  const quality = appState.metaQuality || null;
  if (!quality) {
    return [];
  }

  const pagination = quality.pagination || {};
  const pagesUsed = [
    pagination.campaignsPages,
    pagination.campaignInsightsPages,
    pagination.campaignDailyInsightsPages,
    pagination.adSetsPages,
    pagination.adSetInsightsPages,
    pagination.adSetDailyInsightsPages,
    pagination.adsPages
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const warnings = Array.isArray(quality.warnings) ? quality.warnings : [];
  const validation = quality.validation || null;
  const reconciliation = quality.reconciliation || {};
  const attributionValidation = quality.attributionValidation || {};
  const timings = quality.timings || {};
  const snapshotMeta = appState.metaSnapshotMeta || null;
  const trust = buildMetaTrustState();
  const schedule = quality.schedule || null;
  const awarenessDelta = (() => {
    const campaignValue = Number(reconciliation.awarenessCampaignSpendTotal || 0);
    const adSetValue = Number(reconciliation.awarenessAdSetSpendTotal || 0);
    if (!(campaignValue > 0) && !(adSetValue > 0)) {
      return "--";
    }
    return formatDashboardCurrency(Math.abs(campaignValue - adSetValue));
  })();

  return [
    {
      title: "Trust state",
      meta: trust.label,
      body: trust.detail,
      tone: trust.tone
    },
    {
      title: "Data source",
      meta: snapshotMeta?.modeLabel || "Unknown",
      body: formatMetaSnapshotMetaLine(snapshotMeta),
      tone: "neutral"
    },
    {
      title: "Snapshot coverage",
      meta: `${quality.includedCampaignCount || 0} campaigns`,
      body: `${quality.campaignsWithPeriodDataCount || 0} campaigns had spend in scope. ${quality.activeCampaignCount || 0} are active now.`,
      tone: "neutral"
    },
    {
      title: "Pagination",
      meta: pagesUsed.length ? `${Math.max(...pagesUsed)} pages` : "Single page",
      body: pagesUsed.some((value) => value > 1)
        ? "Meta pagination expanded beyond the first page during this snapshot."
        : "Snapshot was resolved from first-page Meta responses only.",
      tone: "neutral"
    },
    {
      title: "Budget model",
      meta: quality.budgetNormalization?.confidence || "unknown",
      body: quality.budgetNormalization?.reason || "No budget normalization metadata returned.",
      tone: "neutral"
    },
    {
      title: "Schedule",
      meta: schedule?.timezone || "Not configured",
      body: schedule
        ? `${schedule.serverCronSummary} UTC cron: ${(schedule.serverCronSchedulesUtc || []).join(", ") || "none"}. Target slots: ${(schedule.targetSlots || []).map((slot) => slot.label).join(" + ")}. ${schedule.browserDailySummary}`
        : "No schedule diagnostics returned.",
      tone: "neutral"
    },
    {
      title: "Awareness reconciliation",
      meta: `${quality.awarenessUsingAdSetInsights || 0} campaigns`,
      body: `Awareness used ad set data where available. Campaign vs ad set spend delta: ${awarenessDelta}.`,
      tone: "neutral"
    },
    {
      title: "Attribution split",
      meta: attributionValidation.overlapCount > 0 ? `${attributionValidation.overlapCount} overlaps` : "No overlap",
      body: `${attributionValidation.standardCount || 0} standard and ${attributionValidation.incrementalCount || 0} incremental conversion campaigns are segmented into separate lenses.`,
      tone: attributionValidation.overlapCount > 0 ? "warning" : "neutral"
    },
    {
      title: "Validation",
      meta: validation
        ? `${validation.passCount || 0} pass · ${validation.warnCount || 0} warn · ${validation.failCount || 0} fail`
        : "Not run",
      body: validation?.checks?.length
        ? validation.checks.map((check) => `${check.label}: ${check.status}. ${check.detail}`).join(" ")
        : "No dashboard validation checks were returned.",
      tone: Number(validation?.failCount || 0) > 0
        ? "warning"
        : Number(validation?.warnCount || 0) > 0
          ? "warning"
          : "neutral"
    },
    {
      title: "Sync timings",
      meta: Number.isFinite(Number(timings.total_snapshot_ms)) ? `${formatDashboardNumber(Number(timings.total_snapshot_ms), 0)} ms` : "Not captured",
      body: (() => {
        const slowSteps = Object.entries(timings)
          .filter(([key, value]) => key.endsWith("_ms") && Number(value) > 0 && key !== "total_snapshot_ms")
          .sort((left, right) => Number(right[1]) - Number(left[1]))
          .slice(0, 3)
          .map(([key, value]) => `${key.replace(/_ms$/, "").replaceAll("_", " ")} ${formatDashboardNumber(Number(value), 0)} ms`);
        return slowSteps.length ? `Slowest steps: ${slowSteps.join(" · ")}.` : "No timing breakdown returned.";
      })(),
      tone: "neutral"
    },
    {
      title: warnings.length ? "Warnings" : "Warnings",
      meta: warnings.length ? `${warnings.length} open` : "None",
      body: warnings.length ? warnings.join(" ") : "No active data-quality warnings on the current snapshot.",
      tone: warnings.length ? "warning" : "neutral"
    }
  ];
}

function hasIncrementalCampaigns(campaigns = []) {
  return buildIncrementalLensCampaigns(campaigns).length > 0;
}

function syncDashboardSubtabs() {
  document.querySelectorAll(".dashboard-subtab").forEach((node) => {
    const lens = node.dataset.dashboardLens;
    const isActive = lens === appState.dashboardLens;
    node.classList.toggle("active", isActive);
    node.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function formatMetaConnectionMessage(message = "") {
  const text = String(message || "").trim();
  if (!text) {
    return "Meta connection failed.";
  }
  if (/Session has expired/i.test(text)) {
    return "Meta token expired. Refresh the access token before pushing.";
  }
  if (/Missing Meta credentials/i.test(text)) {
    return "Meta credentials missing.";
  }
  return text;
}

function updateMetaStatusPill(status = "unknown", detail = "") {
  const pill = document.getElementById("meta-status-pill");
  if (!pill) return;

  pill.classList.remove("online", "warning");
  if (status === "online") {
    pill.classList.add("online");
    pill.textContent = detail || "Meta online";
  } else {
    pill.classList.add("warning");
    pill.textContent = detail || "Meta offline";
  }
}

async function refreshMetaConnectionStatus({ silent = false } = {}) {
  const retryDelayMs = 1200;
  const maxAttempts = silent ? 3 : 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await requestMetaConnectionStatus();
      if (result?.ok) {
        const name = result?.account?.name ? `Meta online - ${result.account.name}` : "Meta online";
        appState.metaConnection = { status: "online", detail: name };
        updateMetaStatusPill("online", name);
        return true;
      }

      const message = formatMetaConnectionMessage(result?.error);
      if (attempt < maxAttempts - 1) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }

      appState.metaConnection = { status: "offline", detail: message };
      updateMetaStatusPill("offline", "Meta offline");
      if (!silent) {
        setSyncStatus(message, "warning");
        setStudioStatus(message, "warning");
      }
      return false;
    } catch (error) {
      const message = formatMetaConnectionMessage(error.message);
      if (attempt < maxAttempts - 1) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }

      appState.metaConnection = { status: "offline", detail: message };
      updateMetaStatusPill("offline", "Meta offline");
      if (!silent) {
        setSyncStatus(message, "warning");
        setStudioStatus(message, "warning");
      }
      return false;
    }
  }

  return false;
}

function loadDashboardPreferences() {
  try {
    const preset = localStorage.getItem("westpack.dashboardDatePreset");
    const from = localStorage.getItem("westpack.dashboardDateFrom");
    const to = localStorage.getItem("westpack.dashboardDateTo");
    const autoRefresh = localStorage.getItem("westpack.dashboardAutoRefresh");
    const metaDataMode = localStorage.getItem("westpack.metaDataMode.v2");
    if (preset) appState.dashboardDatePreset = preset;
    if (from) appState.dashboardDateFrom = from;
    if (to) appState.dashboardDateTo = to;
    if (autoRefresh) appState.dashboardAutoRefresh = autoRefresh;
    if (metaDataMode === "snapshot" || metaDataMode === "live") {
      appState.metaDataMode = metaDataMode;
    }
  } catch {}
}

function persistDashboardPreferences() {
  try {
    localStorage.setItem("westpack.dashboardDatePreset", appState.dashboardDatePreset);
    localStorage.setItem("westpack.dashboardDateFrom", appState.dashboardDateFrom);
    localStorage.setItem("westpack.dashboardDateTo", appState.dashboardDateTo);
    localStorage.setItem("westpack.dashboardAutoRefresh", appState.dashboardAutoRefresh);
    // Renamed key: the default flipped from "snapshot" to "live", and a browser that
    // already persisted the old "snapshot" default under the old key would otherwise
    // keep overriding the new default forever.
    localStorage.setItem("westpack.metaDataMode.v2", appState.metaDataMode);
  } catch {}
}

function isStudioVisible() {
  return document.getElementById("studio-panel")?.classList.contains("active");
}

function syncDashboardControls() {
  const presetSelect = document.getElementById("dashboard-date-preset");
  const customWrap = document.getElementById("dashboard-date-custom");
  const fromInput = document.getElementById("dashboard-date-from");
  const toInput = document.getElementById("dashboard-date-to");
  const autoRefreshSelect = document.getElementById("dashboard-auto-refresh");
  const dataModeSelect = document.getElementById("meta-data-mode");
  const refreshButton = document.getElementById("refresh-data-button");
  const updateSnapshotButton = document.getElementById("update-snapshot-button");
  const studioVisible = isStudioVisible();

  if (presetSelect) presetSelect.value = appState.dashboardDatePreset;
  if (fromInput) fromInput.value = appState.dashboardDateFrom;
  if (toInput) toInput.value = appState.dashboardDateTo;
  if (customWrap) customWrap.hidden = appState.dashboardDatePreset !== "custom";
  if (autoRefreshSelect) autoRefreshSelect.value = appState.dashboardAutoRefresh;
  if (dataModeSelect) dataModeSelect.value = appState.metaDataMode;
  if (refreshButton) {
    refreshButton.textContent = studioVisible
      ? (appState.metaDataMode === "snapshot" ? "Use studio snapshot" : "Refresh ad catalog")
      : (appState.metaDataMode === "snapshot" ? "Use snapshot" : "Refresh data");
  }
  if (updateSnapshotButton) {
    updateSnapshotButton.textContent = studioVisible ? "Refresh live catalog" : "Update snapshot";
  }
}

function getDefaultCustomRange() {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}

function getDashboardSnapshotOptions() {
  if (appState.dashboardDatePreset === "custom") {
    return {
      preset: "custom",
      from: appState.dashboardDateFrom,
      to: appState.dashboardDateTo
    };
  }
  return { preset: appState.dashboardDatePreset };
}

function applySnapshotScope(scope = {}) {
  appState.dashboardDateLabel = scope.label || "Last 7 days";
  appState.dashboardDateShortLabel = scope.shortLabel || scope.label || "Last 7 days";
  appState.dashboardDateDays = Number.isFinite(Number(scope?.days)) && Number(scope.days) > 0 ? Number(scope.days) : 7;
}

function clearDashboardRefreshTimers() {
  if (dashboardAutoRefreshTimer) {
    clearInterval(dashboardAutoRefreshTimer);
    dashboardAutoRefreshTimer = null;
  }
  if (dashboardAutoRefreshDailyTimer) {
    clearTimeout(dashboardAutoRefreshDailyTimer);
    dashboardAutoRefreshDailyTimer = null;
  }
}

function getZonedDateParts(date = new Date(), timeZone = META_BROWSER_DAILY_REFRESH_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second")
  };
}

function getTimeZoneOffsetMinutes(date = new Date(), timeZone = META_BROWSER_DAILY_REFRESH_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit"
  });
  const zoneName = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "GMT+0";
  const match = zoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * ((hours * 60) + minutes);
}

function buildUtcDateForZonedTime({ year, month, day, hour, minute }, timeZone = META_BROWSER_DAILY_REFRESH_TIMEZONE) {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - (offsetMinutes * 60000);
  }
  return new Date(utcMs);
}

function scheduleNextDailyRefresh() {
  clearDashboardRefreshTimers();
  const now = new Date();
  const zonedNow = getZonedDateParts(now, META_BROWSER_DAILY_REFRESH_TIMEZONE);
  let next = null;

  for (const slot of META_BROWSER_DAILY_REFRESH_SLOTS) {
    const candidate = buildUtcDateForZonedTime({
      year: zonedNow.year,
      month: zonedNow.month,
      day: zonedNow.day,
      hour: slot.hour,
      minute: slot.minute
    }, META_BROWSER_DAILY_REFRESH_TIMEZONE);
    if (candidate > now) {
      next = candidate;
      break;
    }
  }

  if (!next) {
    const tomorrow = new Date(Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day, 12, 0, 0, 0));
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const nextDay = getZonedDateParts(tomorrow, META_BROWSER_DAILY_REFRESH_TIMEZONE);
    next = buildUtcDateForZonedTime({
      year: nextDay.year,
      month: nextDay.month,
      day: nextDay.day,
      hour: META_BROWSER_DAILY_REFRESH_SLOTS[0].hour,
      minute: META_BROWSER_DAILY_REFRESH_SLOTS[0].minute
    }, META_BROWSER_DAILY_REFRESH_TIMEZONE);
  }

  dashboardAutoRefreshDailyTimer = window.setTimeout(async () => {
    await refreshMetaData({ silent: true, reason: "Scheduled refresh" });
    scheduleNextDailyRefresh();
  }, next.getTime() - now.getTime());
}

function configureDashboardAutoRefresh() {
  clearDashboardRefreshTimers();
  const mode = appState.dashboardAutoRefresh;
  if (mode === "15m") {
    dashboardAutoRefreshTimer = window.setInterval(() => {
      refreshMetaData({ silent: true, reason: "Auto refresh" });
    }, 15 * 60 * 1000);
    return;
  }
  if (mode === "1h") {
    dashboardAutoRefreshTimer = window.setInterval(() => {
      refreshMetaData({ silent: true, reason: "Auto refresh" });
    }, 60 * 60 * 1000);
    return;
  }
  if (mode === "daily") {
    scheduleNextDailyRefresh();
  }
}

function syncStudioChrome() {
  const isDuplicate = appState.mode === "duplicate";
  document.getElementById("studio-panel")?.classList.toggle("is-duplicate-focused", isDuplicate);
  document.getElementById("studio-panel")?.classList.toggle("is-duplicate-review-open", isDuplicate && Boolean(appState.duplicateReviewOpen));
  document.querySelectorAll(".mode-duplicate-only").forEach((element) => {
    element.classList.toggle("hidden-by-mode", !isDuplicate);
  });
  document.querySelectorAll(".mode-create-only").forEach((element) => {
    element.classList.toggle("hidden-by-mode", isDuplicate);
  });

  const previewTitle = document.getElementById("preview-title");
  const previewMeta = document.getElementById("preview-meta");
  const quickControlsTitle = document.getElementById("quick-controls-title");
  const variantButton = document.getElementById("duplicate-variant-button");
  const editorMeta = document.getElementById("preview-editor-meta");

  const activeTarget = isDuplicate
    ? getDuplicateTargetByKey(appState.duplicateActivePreviewKey) || getActiveDuplicateCreativeEditorTarget()
    : null;
  const activeTargetSummary = activeTarget
    ? `${activeTarget.campaignName} · ${activeTarget.adSetName} · ${activeTarget.languageLabel}`
    : "No active target";

  if (previewTitle) {
    previewTitle.textContent = isDuplicate ? "Preview" : "Ad Builder Preview";
  }

  if (previewMeta) {
    previewMeta.textContent = isDuplicate
      ? activeTargetSummary
      : "Generate a preview to inspect the active ad output.";
  }

  if (quickControlsTitle) {
    quickControlsTitle.textContent = isDuplicate ? "Notes" : "Builder notes";
  }

  if (editorMeta) {
    editorMeta.textContent = isDuplicate
      ? activeTargetSummary
      : "Create mode edits apply to the current ad draft only.";
  }

  if (variantButton) {
    variantButton.classList.toggle("hidden-by-mode", true);
  }

  renderCardList(
    "action-list",
    isDuplicate ? duplicateQuickActions : createQuickActions,
    "action-item"
  );
  renderCardList("create-checklist", createQuickActions, "action-item");
  if (isDuplicate) {
    renderDuplicateWorkflowSummary();
  }
}

function setCurrentOutput(preview, variants, options = {}) {
  appState.currentPreview = preview;
  appState.currentVariants = variants;
  appState.currentVariantIndex = 0;
  if (options.syncFields !== false) {
    syncModeFieldsFromPreview(preview);
  }
  if (options.signature !== false) {
    appState.lastGeneratedSignature = getCurrentFormSignature();
  }

  renderPreview(preview);
  renderVariants(variants);
  renderCurrentPreviewPayload();
  syncStudioChrome();
  syncActionAvailability();
}

function setDuplicateActivePreview(key = "", options = {}) {
  return setDuplicateActivePreviewAction({
    appState,
    buildVariantSet,
    getDuplicateBatchEntry,
    key,
    options,
    renderDuplicateBulkTargets,
    renderDuplicateCreativeOverridePanel,
    setCurrentOutput
  });
}

function syncLivePreviewField(field, value) {
  const stack = document.getElementById("preview-stack");
  if (!stack) return;
  stack.querySelectorAll(`[data-live-field="${field}"]`).forEach((node) => {
    node.textContent = value;
  });
}

function syncLiveCarouselCards(attachments = []) {
  const stack = document.getElementById("preview-stack");
  if (!stack) return;

  attachments.forEach((attachment, index) => {
    const title = attachment?.name || "";
    const subtitle = attachment?.description || "";
    const titleNode = stack.querySelector(`[data-live-card-title="${index}"]`);
    const subtitleNode = stack.querySelector(`[data-live-card-subtitle="${index}"]`);
    if (titleNode) titleNode.textContent = title;
    if (subtitleNode) subtitleNode.textContent = subtitle;
  });
}

function buildCurrentPreviewPayload() {
  if (!appState.currentPreview) {
    return {};
  }
  const payload = buildMetaPublishPayload(appState.currentPreview);
  if (appState.mode === "duplicate" && appState.duplicateActivePreviewKey) {
    const creativeOverride = getDuplicateCreativeOverride(appState.duplicateActivePreviewKey);
    payload.creative_override_mode = creativeOverride.mode;
    if (creativeOverride.mode === "video") {
      payload.override_summary = {
        type: "localized_video",
        square_file: creativeOverride.videoFiles.square?.name || "",
        vertical_file: creativeOverride.videoFiles.vertical?.name || ""
      };
    } else if (creativeOverride.mode === "carousel") {
      payload.override_summary = {
        type: "localized_carousel",
        files: getOrderedDuplicateCarouselFiles(creativeOverride.carouselFiles || []).map((file) => file.name)
      };
    }
  }
  return payload;
}

function renderCurrentPreviewPayload() {
  renderPayload(buildCurrentPreviewPayload());
}

function applyPreviewEditsFromEventTarget(target) {
  if (!appState.currentPreview || !target) return;

  const editField = target.dataset?.editField;
  if (editField) {
    appState.currentPreview[editField] = target.value;
    if (appState.mode === "duplicate" && appState.duplicateActivePreviewKey) {
      upsertDuplicateBatchEntry({
        key: appState.duplicateActivePreviewKey,
        preview: appState.currentPreview,
        variants: appState.currentVariants
      });
    }
    syncLivePreviewField(editField, target.value);
    renderCurrentPreviewPayload();
    return;
  }

  const attachmentIndexRaw = target.dataset?.attachmentIndex;
  const attachmentField = target.dataset?.attachmentField;
  if (attachmentIndexRaw != null && attachmentField) {
    const index = Number(attachmentIndexRaw);
    if (!Number.isFinite(index) || index < 0) return;
    const attachments = Array.isArray(appState.currentPreview.translatedAttachments)
      ? appState.currentPreview.translatedAttachments
      : [];

    if (!attachments[index]) {
      attachments[index] = {};
    }

    attachments[index][attachmentField] = target.value;
    appState.currentPreview.translatedAttachments = attachments;
    if (appState.mode === "duplicate" && appState.duplicateActivePreviewKey) {
      upsertDuplicateBatchEntry({
        key: appState.duplicateActivePreviewKey,
        preview: appState.currentPreview,
        variants: appState.currentVariants
      });
    }
    syncLiveCarouselCards(attachments);
    renderCurrentPreviewPayload();
  }
}

function wirePreviewEditing() {
  const previewStack = document.getElementById("preview-stack");
  const previewEditorStack = document.getElementById("preview-editor-stack");
  if (!previewStack || !previewEditorStack) return;

  previewStack.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const focusField = target.closest("[data-focus-field]")?.dataset?.focusField;
    if (!focusField) return;
    const textarea = previewEditorStack.querySelector(`textarea[data-edit-field="${focusField}"]`);
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus();
    }
  });

  previewEditorStack.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    if (!target.dataset?.editField && target.dataset?.attachmentIndex == null) return;
    applyPreviewEditsFromEventTarget(target);
  });
}

function isModePreviewReady(mode) {
  return isModePreviewReadyAction({
    appState,
    canAdvanceCreateStep,
    canAdvanceDuplicateStep,
    getCurrentFormSignature,
    getDuplicateCreativeOverride,
    getDuplicateGeneratedPreviewCount,
    getDuplicatePublishTargets,
    getDuplicateTargetKey,
    getInputValue,
    getOrderedDuplicateCarouselFiles,
    isValidHttpUrl,
    mode
  });
}

function syncActionAvailability() {
  syncActionAvailabilityAction({
    appState,
    getDuplicateBatchEntry,
    getDuplicateGeneratedPreviewCount,
    getDuplicatePublishTargets,
    isModePreviewReady,
    syncDuplicateCreativeEditorKey,
    syncDuplicateTargetBuilderState
  });
}

function validateBeforePush(mode) {
  return validateBeforePushAction({
    appState,
    collectCreateImageUploadSizeIssues,
    getCurrentFormSignature,
    getDuplicateCreativeOverride,
    getDuplicateGeneratedPreviewCount,
    getDuplicatePublishTargets,
    getDuplicateTargetKey,
    getInputValue,
    getModeIds,
    getOrderedDuplicateCarouselFiles,
    isValidHttpUrl,
    markInvalid,
    mode
  });
}

function resolveMetaCurrency({ accountData = null, dashboardData = null, campaigns = [] } = {}) {
  const fromAccount = String(accountData?.currency || "").trim().toUpperCase();
  if (fromAccount) return fromAccount;
  const fromDashboard = String(dashboardData?.currency || "").trim().toUpperCase();
  if (fromDashboard) return fromDashboard;
  const fromCampaign = String(campaigns?.[0]?.currency || "").trim().toUpperCase();
  if (fromCampaign) return fromCampaign;
  return "EUR";
}

function syncDuplicateSourceSelectors(preferred = {}) {
  syncDuplicateSourceSelectorsAction({
    appState,
    getInputValue,
    getModeIds,
    getSelectedLabel,
    preferred
  });
}

function getDuplicatePrimaryTarget() {
  return getDuplicatePrimaryTargetAction({
    getInputValue,
    getModeIds,
    getSelectedLabel
  });
}

function sanitizeDuplicateBulkTargets() {
  sanitizeDuplicateBulkTargetsAction({
    appState,
    getDuplicatePrimaryTarget,
    getDuplicateTargetKey,
    syncDuplicateCreativeEditorKey
  });
}

function getDuplicatePublishTargets() {
  return getDuplicatePublishTargetsAction({
    appState,
    cloneDuplicateTarget,
    getDuplicatePrimaryTarget,
    getDuplicateTargetKey
  });
}

function renderDuplicateBulkTargets() {
  renderDuplicateBulkTargetsAction({
    appState,
    escapeHtml,
    getDuplicateBatchEntry,
    getDuplicateGeneratedPreviewCount,
    getDuplicateOverrideStatus,
    getDuplicatePrimaryTarget,
    getDuplicatePublishTargets,
    getDuplicateTargetKey,
    renderDuplicateWorkflowSummary,
    sanitizeDuplicateBulkTargets,
    syncDuplicateCreativeEditorKey,
    syncDuplicateTargetBuilderState
  });
}

function renderDuplicateCreativeOverridePanel() {
  renderDuplicateCreativeOverridePanelAction({
    getActiveDuplicateCreativeEditorTarget,
    getCachedCreateUploadPreviewUrl,
    getDuplicateCreativeOverride,
    getDuplicateTargetKey,
    getInputValue,
    getOrderedDuplicateCarouselFiles,
    renderDuplicateWorkflowSummary,
    sanitizeDuplicateBulkTargets
  });
}

function addCurrentDuplicateTarget() {
  addCurrentDuplicateTargetAction({
    appState,
    cloneDuplicateTarget,
    focusDuplicateTargetEditor,
    getDuplicatePrimaryTarget,
    getDuplicateTargetKey,
    markPreviewDirty,
    setDuplicateReviewOpen,
    setStudioStatus,
    syncDuplicateTargetBuilderState,
    syncDuplicateTargetLanguageFields
  });
}

function removeDuplicateBulkTarget(key = "") {
  removeDuplicateBulkTargetAction({
    appState,
    buildVariantSet,
    getDuplicateTargetKey,
    key,
    markPreviewDirty,
    renderDuplicateBulkTargets,
    renderDuplicateCreativeOverridePanel,
    setCurrentOutput
  });
}

function renderCoreData(campaignData, adData, statData, adSetData, dashboardData = null, accountData = null) {
  renderCoreDataAction({
    accountData,
    adaptationGoals,
    adData,
    adSetData,
    appState,
    applyCampaignAttribution,
    auditLog,
    campaignData,
    campaignMatches,
    createQuickActions,
    dashboardData,
    duplicateQuickActions,
    getAdSetOptions,
    getInputValue,
    getSelectedLabel,
    renderAdSetSelector,
    renderAuditLog,
    renderCampaignMatches,
    renderCardList,
    renderDashboard,
    renderDuplicateBulkTargets,
    renderDuplicateCreativeOverridePanel,
    renderSelectors,
    resolveMetaCurrency,
    refreshModeAdSets,
    statData,
    syncDashboardSubtabs,
    syncDuplicateSourceSelectors,
    syncDuplicateTargetLanguageFields
  });
}

function applyMetaStudioCatalog(catalog = {}) {
  return applyMetaStudioCatalogAction({
    adaptationGoals,
    appState,
    applyCampaignAttribution,
    catalog,
    getAdSetOptions,
    getInputValue,
    getSelectedLabel,
    refreshModeAdSets,
    renderAdSetSelector,
    renderDuplicateBulkTargets,
    renderDuplicateCreativeOverridePanel,
    renderSelectors,
    syncActionAvailability,
    syncDuplicateSourceSelectors,
    syncDuplicateTargetLanguageFields
  });
}

function sumMetric(list, key) {
  return (list || []).reduce((sum, item) => {
    const value = Number(item?.[key]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

const META_ATTRIBUTION_OVERRIDES = {
  campaignIds: {},
  campaignNames: {}
};

function hasIncrementalNameTag(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) {
    return false;
  }

  return /\binkrementel\b/.test(name)
    || /\bincremental\b/.test(name)
    || /\[inc\]|\(inc\)/.test(name);
}

function hasStandardNameTag(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name) {
    return false;
  }

  return /\bstandard\b/.test(name)
    || /\[std\]|\(std\)/.test(name);
}

function resolveAttributionNameTag(campaign) {
  const rawName = String(campaign?.name || "").trim();
  if (!rawName) {
    return null;
  }

  if (hasIncrementalNameTag(rawName)) {
    return { mode: "incremental", source: "campaign naming tag", explicit: true };
  }
  if (hasStandardNameTag(rawName)) {
    return { mode: "standard", source: "campaign naming tag", explicit: true };
  }

  return null;
}

function resolveAttributionOverride(campaign) {
  const campaignId = String(campaign?.id || "").trim();
  const campaignName = String(campaign?.name || "").trim().toLowerCase();

  const byId = META_ATTRIBUTION_OVERRIDES.campaignIds?.[campaignId];
  if (byId === "standard" || byId === "incremental") {
    return { mode: byId, source: "manual override", explicit: true };
  }

  const byName = META_ATTRIBUTION_OVERRIDES.campaignNames?.[campaignName];
  if (byName === "standard" || byName === "incremental") {
    return { mode: byName, source: "manual override", explicit: true };
  }

  return null;
}

function applyCampaignAttribution(campaigns, adSets) {
  const adSetsByCampaignId = new Map();

  (adSets || []).forEach((adSet) => {
    const campaignId = String(adSet?.campaignId || "");
    if (!campaignId) return;
    if (!adSetsByCampaignId.has(campaignId)) {
      adSetsByCampaignId.set(campaignId, []);
    }
    adSetsByCampaignId.get(campaignId).push(adSet);
  });

  return (campaigns || []).map((campaign) => {
    const campaignId = String(campaign?.id || "");
    const linkedAdSets = adSetsByCampaignId.get(campaignId) || [];
    const adSetNames = linkedAdSets.map((adSet) => String(adSet?.name || ""));
    const adSetAttributionSpecs = linkedAdSets.map((adSet) => Array.isArray(adSet?.attribution_spec) ? adSet.attribution_spec : []);
    const attribution = resolveConversionAttribution(campaign, adSetNames, adSetAttributionSpecs);

    return {
      ...campaign,
      attribution_mode: attribution.mode,
      attribution_source: attribution.source,
      attribution_explicit: attribution.explicit,
      adset_names: adSetNames,
      adset_attribution_specs: adSetAttributionSpecs
    };
  });
}

function normalizeObjective(value) {
  return String(value || "").trim().toUpperCase();
}

function classifyCampaign(campaign) {
  const explicitCategory = String(campaign?.category || campaign?.lens || "").trim().toLowerCase();
  if (explicitCategory === "awareness" || explicitCategory === "leads" || explicitCategory === "conversion") {
    return explicitCategory;
  }

  const objective = normalizeObjective(campaign?.objective);
  const name = String(campaign?.name || "").toLowerCase();

  const purchases = toFiniteNumber(campaign?.purchases_value);
  const leads = toFiniteNumber(campaign?.leads_value);

  const awarenessObjectives = new Set([
    "AWARENESS",
    "BRAND_AWARENESS",
    "REACH",
    "VIDEO_VIEWS",
    "THRUPLAY",
    "ENGAGEMENT",
    "POST_ENGAGEMENT",
    "PAGE_LIKES",
    "EVENT_RESPONSES",
    "OUTCOME_AWARENESS",
    "OUTCOME_ENGAGEMENT",
    "TRAFFIC",
    "OUTCOME_TRAFFIC"
  ]);

  const leadObjectives = new Set([
    "LEAD_GENERATION",
    "OUTCOME_LEADS",
    "MESSAGES"
  ]);

  const conversionObjectives = new Set([
    "CONVERSIONS",
    "OUTCOME_SALES",
    "CATALOG_SALES",
    "PRODUCT_CATALOG_SALES",
    "APP_INSTALLS",
    "OUTCOME_APP_PROMOTION"
  ]);

  if (leadObjectives.has(objective)) return "leads";
  if (awarenessObjectives.has(objective)) return "awareness";
  if (conversionObjectives.has(objective)) return "conversion";

  if (/^ba[\s-_]?\d/i.test(name) || /\bawareness\b|\breach\b/.test(name)) return "awareness";

  if (purchases > 0) return "conversion";
  if (leads > 0) return "leads";

  if (/\blead\b|\bform\b|\binquir|\bkontakt\b/.test(name)) return "leads";
  if (/\bremarket|\bprospecting|\bconv\b|\bconversion\b|\bsales\b/.test(name)) return "conversion";
  return "awareness";
}

function splitByCategory(campaigns) {
  const buckets = { awareness: [], leads: [], conversion: [] };
  (campaigns || []).forEach((campaign) => {
    const category = classifyCampaign(campaign);
    (buckets[category] || buckets.awareness).push(campaign);
  });
  return buckets;
}

function resolveConversionAttribution(campaign, adSetNames = [], adSetAttributionSpecs = []) {
  if (!campaign) {
    return { mode: "standard", source: "baseline default", explicit: false };
  }

  const override = resolveAttributionOverride(campaign);
  if (override) {
    return override;
  }

  const nameTag = resolveAttributionNameTag(campaign);
  if (nameTag) {
    return nameTag;
  }

  const explicitMode = String(campaign.attribution_mode || campaign.attributionMode || campaign.measurement_mode || "")
    .trim()
    .toLowerCase();
  if (explicitMode === "standard") {
    return { mode: "standard", source: "campaign field", explicit: true };
  }

  return { mode: "standard", source: "non-inkrementel default", explicit: false };
}

function classifyConversionAttribution(campaign) {
  return resolveConversionAttribution(campaign, campaign?.adset_names || [], campaign?.adset_attribution_specs || []).mode;
}

function splitConversionByAttribution(campaigns) {
  const buckets = { standard: [], incremental: [] };
  (campaigns || []).forEach((campaign) => {
    const mode = classifyConversionAttribution(campaign);
    buckets[mode].push(campaign);
  });
  return buckets;
}

function buildIncrementalLensCampaigns(campaigns = []) {
  const conversionCampaigns = splitByCategory(campaigns).conversion;
  return splitConversionByAttribution(conversionCampaigns).incremental
    .map((campaign) => ({
      ...campaign,
      attribution_mode: "incremental",
      attribution_source: campaign?.attribution_source || "campaign naming tag",
      purchases_value: campaign?.incremental_metrics_available
        ? toFiniteNumber(campaign?.incremental_purchases_value)
        : toFiniteNumber(campaign?.purchases_value),
      revenue_value: campaign?.incremental_metrics_available
        ? toFiniteNumber(campaign?.incremental_revenue_value)
        : toFiniteNumber(campaign?.revenue_value),
      roas_value: campaign?.incremental_metrics_available
        ? toFiniteNumber(campaign?.incremental_roas_value)
        : toFiniteNumber(campaign?.roas_value),
      cpa_value: campaign?.incremental_metrics_available
        ? toFiniteNumber(campaign?.incremental_cpa_value)
        : toFiniteNumber(campaign?.cpa_value),
      series: Array.isArray(campaign?.incremental_series) && campaign.incremental_series.length
        ? campaign.incremental_series
        : campaign.series
    }));
}

function buildDashboardStats(campaigns, lens, incrementalityFactor = 0.6) {
  const spend = sumMetric(campaigns, "spend_value");
  const reach = sumMetric(campaigns, "reach_value");
  const impressions = sumMetric(campaigns, "impressions_value");
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const frequency = reach > 0 ? impressions / reach : 0;
  const purchases = sumMetric(campaigns, "purchases_value");
  const revenue = sumMetric(campaigns, "revenue_value");
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;

  if (lens === "conversion_standard") {
    return [
      { label: "Spend (7d)", value: formatDashboardCurrency(spend), meta: "Active campaigns" },
      { label: "Purchases", value: String(Math.round(purchases)), meta: "From actions" },
      { label: "CPA", value: purchases > 0 ? formatDashboardCurrency(cpa) : "--", meta: "Spend / purchases" },
      { label: "ROAS", value: roas ? roas.toFixed(2) : "â€”", meta: "Revenue / spend" }
    ];
  }

  if (lens === "conversion_incremental") {
    const incRevenue = revenue * incrementalityFactor;
    const iroas = spend > 0 ? incRevenue / spend : 0;
    return [
      { label: "Spend (7d)", value: formatDashboardCurrency(spend), meta: "Incremental campaigns" },
      { label: "Revenue", value: formatDashboardCurrency(revenue), meta: "Separated campaign set" },
      { label: "ROAS", value: roas ? roas.toFixed(2) : "--", meta: "Revenue / spend" },
      { label: "Purchases", value: String(Math.round(purchases)), meta: "Separated campaign set" }
    ];
  }

  return [
    { label: "Spend (7d)", value: formatDashboardCurrency(spend), meta: "Active campaigns" },
    { label: "Reach", value: reach ? String(Math.round(reach)) : "â€”", meta: "Last 7 days" },
    { label: "Frequency", value: frequency ? frequency.toFixed(2) : "â€”", meta: "Impressions / reach" },
    { label: "CPM", value: cpm ? formatDashboardCurrency(cpm) : "--", meta: "Spend / 1,000 impressions" }
  ];
}

function buildDashboardStatsV2(campaigns, lens, incrementalityFactor = 0.6) {
  const spend = sumMetric(campaigns, "spend_value");
  const reach = sumMetric(campaigns, "reach_value");
  const impressions = sumMetric(campaigns, "impressions_value");
  const clicks = sumMetric(campaigns, "clicks_value");
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const frequency = reach > 0 ? impressions / reach : 0;

  const purchases = sumMetric(campaigns, "purchases_value");
  const revenue = sumMetric(campaigns, "revenue_value");
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;

  const leads = sumMetric(campaigns, "leads_value");
  const cpl = leads > 0 ? spend / leads : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  if (lens === "conversion_standard") {
    return [
      { label: getDashboardSpendLabel(), value: formatDashboardCurrency(spend), meta: "Conversion campaigns" },
      { label: "Purchases", value: String(Math.round(purchases)), meta: "From actions" },
      { label: "CPA", value: purchases > 0 ? formatDashboardCurrency(cpa) : "--", meta: "Spend / purchases" },
      { label: "ROAS", value: roas ? roas.toFixed(2) : "--", meta: "Revenue / spend" }
    ];
  }

  if (lens === "conversion_incremental") {
    return [
      { label: getDashboardSpendLabel(), value: formatDashboardCurrency(spend), meta: "Incremental campaigns" },
      { label: "Revenue", value: formatDashboardCurrency(revenue), meta: "Separated from standard view" },
      { label: "CPA", value: purchases > 0 ? formatDashboardCurrency(cpa) : "--", meta: "Spend / purchases" },
      { label: "ROAS", value: roas ? roas.toFixed(2) : "--", meta: "Revenue / spend" }
    ];
  }

  if (lens === "leads") {
    return [
      { label: getDashboardSpendLabel(), value: formatDashboardCurrency(spend), meta: "Lead campaigns" },
      { label: "Leads", value: String(Math.round(leads)), meta: "From actions" },
      { label: "CPL", value: leads > 0 ? formatDashboardCurrency(cpl) : "--", meta: "Spend / leads" },
      { label: "CTR", value: ctr ? `${ctr.toFixed(2)}%` : "--", meta: "Clicks / impressions" }
    ];
  }

  return [
    { label: getDashboardSpendLabel(), value: formatDashboardCurrency(spend), meta: "Awareness campaigns" },
    { label: "Reach", value: reach ? String(Math.round(reach)) : "--", meta: getDashboardDateLabel() },
    { label: "Frequency", value: frequency ? frequency.toFixed(2) : "--", meta: "Impressions / reach" },
    { label: "CPM", value: cpm ? formatDashboardCurrency(cpm) : "--", meta: "Spend / 1,000 impressions" }
  ];
}

function getLensCampaigns(campaigns, lens) {
  const buckets = splitByCategory(campaigns);
  if (lens === "awareness") return buckets.awareness;
  if (lens === "leads") return buckets.leads;
  if (lens === "conversion_standard") return splitConversionByAttribution(buckets.conversion).standard;
  if (lens === "conversion_incremental") return buildIncrementalLensCampaigns(campaigns);
  return campaigns || [];
}

function getDashboardPeriodDays() {
  const explicitDays = Number(appState.metaDashboard?.quality?.budgetAllocation?.periodDays);
  if (Number.isFinite(explicitDays) && explicitDays > 0) return Math.round(explicitDays);

  const shortLabel = String(appState.dashboardDateShortLabel || "").trim();
  const matchedDays = shortLabel.match(/(\d+)\s*days?/i);
  if (matchedDays) {
    const parsed = Number(matchedDays[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }

  return 30;
}

function estimateMonthlyBudgetFrontend(campaigns = [], adSets = [], periodDays = 30) {
  const campaignMap = new Map();

  (campaigns || []).forEach((campaign) => {
    const id = String(campaign?.id || "").trim();
    if (!id) return;
    campaignMap.set(id, {
      category: classifyCampaign(campaign),
      attributionMode: classifyConversionAttribution(campaign),
      campaignDailyBudget: toFiniteNumber(campaign?.daily_budget),
      adSetDailyBudget: 0
    });
  });

  (adSets || []).forEach((adSet) => {
    const campaignId = String(adSet?.campaignId || "").trim();
    if (!campaignId || !campaignMap.has(campaignId)) return;
    campaignMap.get(campaignId).adSetDailyBudget += toFiniteNumber(adSet?.daily_budget);
  });

  const normalizedPeriodDays = Math.max(1, Number(periodDays) || 30);
  let totalDailyBudget = 0;
  let awarenessDailyBudget = 0;
  let leadsDailyBudget = 0;
  let conversionDailyBudget = 0;
  let conversionStandardDailyBudget = 0;
  let conversionIncrementalDailyBudget = 0;

  campaignMap.forEach((entry) => {
    const dailyBudget = entry.adSetDailyBudget > 0 ? entry.adSetDailyBudget : entry.campaignDailyBudget;
    if (!(dailyBudget > 0)) return;
    totalDailyBudget += dailyBudget;

    if (entry.category === "awareness") {
      awarenessDailyBudget += dailyBudget;
      return;
    }
    if (entry.category === "leads") {
      leadsDailyBudget += dailyBudget;
      return;
    }
    conversionDailyBudget += dailyBudget;
    if (entry.attributionMode === "incremental") {
      conversionIncrementalDailyBudget += dailyBudget;
      return;
    }
    conversionStandardDailyBudget += dailyBudget;
  });

  return {
    totalMonthlyBudget: totalDailyBudget * 30,
    totalPeriodBudget: totalDailyBudget * normalizedPeriodDays,
    totalDailyBudget,
    periodDays: normalizedPeriodDays,
    awarenessDailyBudget,
    leadsDailyBudget,
    conversionDailyBudget,
    conversionStandardDailyBudget,
    conversionIncrementalDailyBudget,
    awarenessMonthlyBudget: awarenessDailyBudget * 30,
    awarenessPeriodBudget: awarenessDailyBudget * normalizedPeriodDays,
    leadsMonthlyBudget: leadsDailyBudget * 30,
    leadsPeriodBudget: leadsDailyBudget * normalizedPeriodDays,
    conversionMonthlyBudget: conversionDailyBudget * 30,
    conversionPeriodBudget: conversionDailyBudget * normalizedPeriodDays,
    conversionStandardMonthlyBudget: conversionStandardDailyBudget * 30,
    conversionStandardPeriodBudget: conversionStandardDailyBudget * normalizedPeriodDays,
    conversionIncrementalMonthlyBudget: conversionIncrementalDailyBudget * 30,
    conversionIncrementalPeriodBudget: conversionIncrementalDailyBudget * normalizedPeriodDays
  };
}

function buildGeneralSpendDistribution(campaigns = [], currency = appState.metaCurrency || "DKK") {
  const normalizedCurrency = String(currency || "DKK").trim().toUpperCase() || "DKK";
  const buckets = splitByCategory(campaigns);
  const totalAmount = sumMetric(campaigns, "spend_value");
  const backendBudgetAllocation = appState.metaDashboard?.quality?.budgetAllocation || null;
  const periodDays = getDashboardPeriodDays();
  const periodShortLabel = appState.dashboardDateShortLabel || `${periodDays}d`;
  const fallbackBudgetAllocation = estimateMonthlyBudgetFrontend(campaigns, appState.adSets || [], periodDays);
  const budgetAllocation = backendBudgetAllocation || fallbackBudgetAllocation;
  const totalBudgetAmount = toFiniteNumber(budgetAllocation?.totalPeriodBudget);
  const totalMonthlyBudgetAmount = toFiniteNumber(budgetAllocation?.totalMonthlyBudget);
  const budgetByKey = {
    awareness: toFiniteNumber(budgetAllocation?.awarenessPeriodBudget ?? (toFiniteNumber(budgetAllocation?.awarenessDailyBudget) * periodDays)),
    conversion: toFiniteNumber(budgetAllocation?.conversionPeriodBudget ?? (toFiniteNumber(budgetAllocation?.conversionDailyBudget) * periodDays)),
    leads: toFiniteNumber(budgetAllocation?.leadsPeriodBudget ?? (toFiniteNumber(budgetAllocation?.leadsDailyBudget) * periodDays))
  };

  const formatValue = (value) => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 2
  }).format(value);

  return {
    currency: normalizedCurrency,
    totalAmount,
    formattedTotalAmount: formatValue(totalAmount),
    totalLabel: getDashboardSpendLabel(),
    totalBudgetAmount,
    formattedTotalBudgetAmount: totalBudgetAmount > 0 ? formatValue(totalBudgetAmount) : "--",
    kpiBudgetAmount: totalMonthlyBudgetAmount,
    formattedKpiBudgetAmount: totalMonthlyBudgetAmount > 0 ? formatValue(totalMonthlyBudgetAmount) : "--",
    kpiBudgetLabel: "Planned 30-day budget",
    kpiBudgetMeta: "Projected 30-day pace based on active Meta campaign and ad set budgets.",
    totalBudgetLabel: `Planned budget (${periodShortLabel})`,
    budgetMixLabel: `Planned budget mix (${periodShortLabel})`,
    rangeLabel: getDashboardDateLabel(),
    summaryMeta: "Real spend in the selected range, plus planned budget by objective for the same period. Topline planned budget stays fixed at 30 days.",
    title: "Spend and planned budget",
    subtitle: `Real spend for ${getDashboardDateLabel()} plus planned budget for the same period based on the active campaign/ad set budgets in Meta. Conversion combines standard and incremental campaigns here.`,
    items: [
      { key: "awareness", label: "Brand Awareness", amount: sumMetric(buckets.awareness, "spend_value") },
      { key: "conversion", label: "Conversion", amount: sumMetric(buckets.conversion, "spend_value") },
      { key: "leads", label: "Leads", amount: sumMetric(buckets.leads, "spend_value") }
    ].map((item) => ({
      ...item,
      percentage: totalAmount > 0 ? Number(((item.amount / totalAmount) * 100).toFixed(1)) : 0,
      formattedAmount: formatValue(item.amount),
      budgetAmount: budgetByKey[item.key] || 0,
      formattedBudgetAmount: (budgetByKey[item.key] || 0) > 0 ? formatValue(budgetByKey[item.key] || 0) : "--",
      budgetPercentage: totalBudgetAmount > 0 ? Number((((budgetByKey[item.key] || 0) / totalBudgetAmount) * 100).toFixed(1)) : 0
    }))
  };
}

function getGeneralSpendDistributionModel(campaigns = []) {
  const backendSplit = appState.metaDashboard?.quality?.generalSpendDistribution;
  const backendBudgetAllocation = appState.metaDashboard?.quality?.budgetAllocation || null;
  const periodDays = getDashboardPeriodDays();
  const periodShortLabel = appState.dashboardDateShortLabel || `${periodDays}d`;
  const fallbackBudgetAllocation = estimateMonthlyBudgetFrontend(campaigns, appState.adSets || [], periodDays);
  const budgetAllocation = backendBudgetAllocation || fallbackBudgetAllocation;
  if (backendSplit && Array.isArray(backendSplit.items) && backendSplit.items.length) {
    const normalizedCurrency = String(backendSplit.currency || appState.metaCurrency || "DKK").trim().toUpperCase() || "DKK";
    const totalAmount = Number(backendSplit.totalAmount) || 0;
    const totalBudgetAmount = toFiniteNumber(backendSplit.totalBudgetAmount) || toFiniteNumber(budgetAllocation?.totalPeriodBudget);
    const totalMonthlyBudgetAmount = toFiniteNumber(backendSplit.kpiBudgetAmount) || toFiniteNumber(budgetAllocation?.totalMonthlyBudget);
    const budgetByKey = {
      awareness: toFiniteNumber(budgetAllocation?.awarenessPeriodBudget ?? (toFiniteNumber(budgetAllocation?.awarenessDailyBudget) * periodDays)),
      conversion: toFiniteNumber(budgetAllocation?.conversionPeriodBudget ?? (toFiniteNumber(budgetAllocation?.conversionDailyBudget) * periodDays)),
      leads: toFiniteNumber(budgetAllocation?.leadsPeriodBudget ?? (toFiniteNumber(budgetAllocation?.leadsDailyBudget) * periodDays))
    };
    return {
      ...backendSplit,
      items: backendSplit.items.map((item) => ({
        ...item,
        budgetAmount: toFiniteNumber(item?.budgetAmount) || budgetByKey[item.key] || 0,
        formattedBudgetAmount: item?.formattedBudgetAmount || ((budgetByKey[item.key] || 0) > 0 ? new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: normalizedCurrency,
          maximumFractionDigits: 2
        }).format(budgetByKey[item.key] || 0) : "--"),
        budgetPercentage: Number.isFinite(Number(item?.budgetPercentage))
          ? Number(item.budgetPercentage)
          : totalBudgetAmount > 0
            ? Number((((budgetByKey[item.key] || 0) / totalBudgetAmount) * 100).toFixed(1))
            : 0
      })),
      formattedTotalAmount: backendSplit.formattedTotalAmount || new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 2
      }).format(totalAmount),
      totalBudgetAmount,
      formattedTotalBudgetAmount: backendSplit.formattedTotalBudgetAmount || (totalBudgetAmount > 0 ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 2
      }).format(totalBudgetAmount) : "--"),
      kpiBudgetAmount: totalMonthlyBudgetAmount,
      formattedKpiBudgetAmount: backendSplit.formattedKpiBudgetAmount || (totalMonthlyBudgetAmount > 0 ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 2
      }).format(totalMonthlyBudgetAmount) : "--"),
      kpiBudgetLabel: backendSplit.kpiBudgetLabel || "Planned 30-day budget",
      kpiBudgetMeta: backendSplit.kpiBudgetMeta || "Projected 30-day pace based on active Meta campaign and ad set budgets.",
      totalBudgetLabel: backendSplit.totalBudgetLabel || `Planned budget (${periodShortLabel})`,
      budgetMixLabel: backendSplit.budgetMixLabel || `Planned budget mix (${periodShortLabel})`,
      rangeLabel: backendSplit.rangeLabel || getDashboardDateLabel(),
      summaryMeta: backendSplit.summaryMeta || "Real spend in the selected range, plus planned budget by objective for the same period. Topline planned budget stays fixed at 30 days.",
      title: backendSplit.title || "Spend and planned budget",
      subtitle: backendSplit.subtitle || `Real spend for ${getDashboardDateLabel()} plus planned budget for the same period based on the active campaign/ad set budgets in Meta. Conversion combines standard and incremental campaigns here.`
    };
  }

  return {
    ...buildGeneralSpendDistribution(campaigns, appState.metaCurrency || "DKK"),
    title: "Spend and planned budget",
    subtitle: `Real spend for ${getDashboardDateLabel()} plus planned budget for the same period based on the active campaign/ad set budgets in Meta. Conversion combines standard and incremental campaigns here.`
  };
}

function buildGeneralStats(campaigns) {
  const series = buildAggregateSeries(campaigns);
  const totalSpend = computeAggregateMetric(series, "spend");
  const totalCpa = computeAggregateMetric(series, "cpa");
  const totalConversionRate = computeAggregateMetric(series, "conversion_rate");
  const totalCostPerAddToCart = computeAggregateMetric(series, "cost_per_add_to_cart");
  const addToCart = computeAggregateMetric(series, "add_to_cart");
  const clicks = computeAggregateMetric(series, "clicks");

  return [
    {
      label: "Current spend",
      value: formatDashboardCurrency(totalSpend),
      meta: getDashboardDateLabel(),
      change: buildWindowChange(series, "spend", { positiveDirection: "up" }),
      compact: true
    },
    {
      label: "CPA",
      value: Number.isFinite(totalCpa) && totalCpa > 0 ? formatDashboardCurrency(totalCpa) : "--",
      meta: "Cost per purchase",
      change: buildWindowChange(series, "cpa", { positiveDirection: "down" }),
      compact: true
    },
    {
      label: "Conversion rate",
      value: clicks > 0 ? formatDashboardPercent(totalConversionRate, 2) : "--",
      meta: "Purchases / clicks",
      change: buildWindowChange(series, "conversion_rate", { positiveDirection: "up" }),
      compact: true
    },
    {
      label: "Cost per add to cart",
      value: addToCart > 0 ? formatDashboardCurrency(totalCostPerAddToCart) : "--",
      meta: addToCart > 0 ? "Spend / add-to-cart" : "No add-to-cart events tracked",
      change: buildWindowChange(series, "cost_per_add_to_cart", { positiveDirection: "down" }),
      compact: true
    }
  ];
}

function buildSeriesTotals(campaigns, metricAccessor) {
  const totals = new Map();

  (campaigns || []).forEach((campaign) => {
    (campaign.series || []).forEach((point) => {
      const key = String(point.date || "");
      const current = totals.get(key) || 0;
      totals.set(key, current + metricAccessor(point, campaign));
    });
  });

  return Array.from(totals.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({ date, value }));
}

function buildDerivedSeriesTotals(campaigns, numeratorAccessor, denominatorAccessor) {
  const totals = new Map();

  (campaigns || []).forEach((campaign) => {
    (campaign.series || []).forEach((point) => {
      const key = String(point.date || "");
      const current = totals.get(key) || { numerator: 0, denominator: 0 };

      totals.set(key, {
        numerator: current.numerator + toFiniteNumber(numeratorAccessor(point, campaign)),
        denominator: current.denominator + toFiniteNumber(denominatorAccessor(point, campaign))
      });
    });
  });

  return Array.from(totals.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({
      date,
      value: value.denominator > 0 ? value.numerator / value.denominator : 0
    }));
}

function buildAggregateSeries(campaigns = []) {
  const totals = new Map();

  (campaigns || []).forEach((campaign) => {
    (campaign.series || []).forEach((point) => {
      const key = String(point.date || "");
      const current = totals.get(key) || {
        spend: 0,
        impressions: 0,
        clicks: 0,
        add_to_cart: 0,
        purchases: 0,
        revenue: 0,
        leads: 0
      };

      totals.set(key, {
        spend: current.spend + toFiniteNumber(point.spend),
        impressions: current.impressions + toFiniteNumber(point.impressions),
        clicks: current.clicks + toFiniteNumber(point.clicks),
        add_to_cart: current.add_to_cart + toFiniteNumber(point.add_to_cart),
        purchases: current.purchases + toFiniteNumber(point.purchases),
        revenue: current.revenue + toFiniteNumber(point.revenue),
        leads: current.leads + toFiniteNumber(point.leads)
      });
    });
  });

  return Array.from(totals.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({ date, ...value }));
}

function buildWindowChange(series = [], metric, options = {}) {
  return buildMetricWindowChange(series, metric, {
    ...options,
    windowDays: appState.dashboardDateDays
  });
}

function buildGeneralKpiStrip(campaigns = []) {
  const series = buildAggregateSeries(campaigns);
  const spend = computeAggregateMetric(series, "spend");
  const revenue = computeAggregateMetric(series, "revenue");
  const purchases = computeAggregateMetric(series, "purchases");
  const roas = computeAggregateMetric(series, "roas");
  const cpa = computeAggregateMetric(series, "cpa");

  return [
    {
      label: "Revenue",
      value: formatDashboardCurrency(revenue),
      meta: "Attributed revenue",
      change: buildWindowChange(series, "revenue", { positiveDirection: "up" }),
      tone: "success"
    },
    {
      label: "ROAS",
      value: spend > 0 ? formatDashboardNumber(roas, 2) : "--",
      meta: "Revenue / spend",
      change: buildWindowChange(series, "roas", { positiveDirection: "up" }),
      tone: "success"
    },
    {
      label: "Purchases",
      value: formatDashboardNumber(purchases, 0),
      meta: "Attributed conversions",
      change: buildWindowChange(series, "purchases", { positiveDirection: "up" }),
      tone: "neutral"
    },
    {
      label: "CPA",
      value: purchases > 0 ? formatDashboardCurrency(cpa) : "--",
      meta: "Spend / purchases",
      change: buildWindowChange(series, "cpa", { positiveDirection: "down" }),
      tone: "warning"
    }
  ];
}

function buildGeneralObjectivePerformanceRows(campaigns = []) {
  const buckets = splitByCategory(campaigns);
  const objectiveGroups = [
    {
      key: "awareness",
      label: "Brand Awareness",
      campaigns: buckets.awareness,
      tone: "awareness",
      metricLabel: "CPM",
      metricValue: (() => {
        const series = buildAggregateSeries(buckets.awareness);
        const cpm = computeAggregateMetric(series, "cpm");
        return cpm > 0 ? formatDashboardCurrency(cpm) : "--";
      })()
    },
    {
      key: "conversion",
      label: "Conversion",
      campaigns: buckets.conversion,
      tone: "conversion",
      metricLabel: "ROAS",
      metricValue: (() => {
        const series = buildAggregateSeries(buckets.conversion);
        const roas = computeAggregateMetric(series, "roas");
        return roas > 0 ? formatDashboardNumber(roas, 2) : "--";
      })()
    },
    {
      key: "leads",
      label: "Leads",
      campaigns: buckets.leads,
      tone: "leads",
      metricLabel: "CPL",
      metricValue: (() => {
        const series = buildAggregateSeries(buckets.leads);
        const cpl = computeAggregateMetric(series, "cpl");
        return cpl > 0 ? formatDashboardCurrency(cpl) : "--";
      })()
    }
  ];

  const maxSpend = Math.max(
    ...objectiveGroups.map((group) => sumMetric(group.campaigns, "spend_value")),
    1
  );
  const totalSpend = objectiveGroups.reduce((sum, group) => sum + sumMetric(group.campaigns, "spend_value"), 0);

  return objectiveGroups.map((group) => {
    const spend = sumMetric(group.campaigns, "spend_value");
    return {
      key: group.key,
      label: group.label,
      tone: group.tone,
      spend: formatDashboardCurrency(spend),
      share: totalSpend > 0 ? formatDashboardPercent((spend / totalSpend) * 100, 1) : "0.0%",
      width: Math.max(spend > 0 ? 12 : 0, (spend / maxSpend) * 100),
      metricLabel: group.metricLabel,
      metricValue: group.metricValue
    };
  });
}

function buildGeneralPerformerGroups(campaigns = []) {
  const conversionCampaigns = splitByCategory(campaigns).conversion
    .filter((campaign) => toFiniteNumber(campaign.spend_value) > 0);
  const topRoas = [...conversionCampaigns]
    .filter((campaign) => toFiniteNumber(campaign.roas_value) > 0)
    .sort((left, right) => toFiniteNumber(right.roas_value) - toFiniteNumber(left.roas_value))
    .slice(0, 3);
  const worstEfficiency = [...conversionCampaigns]
    .sort((left, right) => {
      const leftCpa = toFiniteNumber(left.cpa_value);
      const rightCpa = toFiniteNumber(right.cpa_value);
      const leftHasPurchases = toFiniteNumber(left.purchases_value) > 0;
      const rightHasPurchases = toFiniteNumber(right.purchases_value) > 0;
      if (leftHasPurchases && rightHasPurchases) return rightCpa - leftCpa;
      if (leftHasPurchases !== rightHasPurchases) return leftHasPurchases ? -1 : 1;
      return toFiniteNumber(left.roas_value) - toFiniteNumber(right.roas_value);
    })
    .slice(0, 3);

  return [
    {
      title: "Top performers",
      meta: "Top 3 by ROAS",
      body: "Best conversion campaigns right now across standard and incremental combined in General.",
      tone: "success",
      items: topRoas.map((campaign) => ({
        name: campaign.name,
        metric: `ROAS ${formatDashboardNumber(toFiniteNumber(campaign.roas_value), 2)}`
      }))
    },
    {
      title: "Watchlist",
      meta: "Bottom efficiency",
      body: "Campaigns most likely to need budget pressure review first.",
      tone: "danger",
      items: worstEfficiency.map((campaign) => ({
        name: campaign.name,
        metric: toFiniteNumber(campaign.purchases_value) > 0
          ? `CPA ${formatDashboardCurrency(toFiniteNumber(campaign.cpa_value))}`
          : `ROAS ${formatDashboardNumber(toFiniteNumber(campaign.roas_value), 2)}`
      }))
    }
  ].filter((group) => group.items.length > 0);
}

function buildGeneralQuickInsight(campaigns = []) {
  const series = buildAggregateSeries(campaigns);
  const objectiveBuckets = splitByCategory(campaigns);
  const objectiveLabels = {
    awareness: "Brand Awareness",
    conversion: "Conversion",
    leads: "Leads"
  };
  const changeCandidates = [
    { label: "Spend", metric: "spend", positiveDirection: "up" },
    { label: "Revenue", metric: "revenue", positiveDirection: "up" },
    { label: "ROAS", metric: "roas", positiveDirection: "up" },
    { label: "Purchases", metric: "purchases", positiveDirection: "up" },
    { label: "CPA", metric: "cpa", positiveDirection: "down" }
  ].map((item) => ({
    ...item,
    summary: getWindowChangeSummary(series, item.metric, { positiveDirection: item.positiveDirection })
  })).filter((item) => item.summary && Number.isFinite(item.summary.percentChange));

  const biggestChange = [...changeCandidates].sort((left, right) => {
    return Math.abs(right.summary.percentChange) - Math.abs(left.summary.percentChange);
  })[0];

  const objectiveDriver = Object.entries(objectiveBuckets)
    .map(([key, bucketCampaigns]) => ({
      key,
      summary: getWindowChangeSummary(buildAggregateSeries(bucketCampaigns), "spend", { positiveDirection: "up" })
    }))
    .filter((item) => item.summary && Number.isFinite(item.summary.percentChange))
    .sort((left, right) => Math.abs(right.summary.percentChange) - Math.abs(left.summary.percentChange))[0];

  const directionWord = biggestChange?.summary?.direction === "down"
    ? "down"
    : biggestChange?.summary?.direction === "flat"
      ? "flat"
      : "up";
  const body = biggestChange
    ? `${biggestChange.label} ${directionWord} ${Math.abs(biggestChange.summary.percentChange).toFixed(1)}% vs previous period${objectiveDriver ? `, driven most by ${objectiveLabels[objectiveDriver.key] || objectiveDriver.key}.` : "."}`
    : `${getDashboardDateLabel()}: not enough prior-period data to highlight a meaningful change yet.`;

  const bestObjective = [...buildGeneralObjectivePerformanceRows(campaigns)]
    .sort((left, right) => {
      const leftMetric = left.key === "conversion"
        ? parseFloat(left.metricValue)
        : left.key === "awareness"
          ? -parseCurrencyValue(left.metricValue)
          : -parseCurrencyValue(left.metricValue);
      const rightMetric = right.key === "conversion"
        ? parseFloat(right.metricValue)
        : right.key === "awareness"
          ? -parseCurrencyValue(right.metricValue)
          : -parseCurrencyValue(right.metricValue);
      return rightMetric - leftMetric;
    })[0];

  return {
    kicker: "Quick insight",
    headline: "Biggest shift right now",
    body,
    points: [
      {
        label: "Current spend",
        value: formatDashboardCurrency(computeAggregateMetric(series, "spend")),
        meta: getDashboardDateLabel()
      },
      {
        label: "Largest objective move",
        value: objectiveDriver ? objectiveLabels[objectiveDriver.key] || objectiveDriver.key : "--",
        meta: objectiveDriver?.summary?.value || "No comparable period"
      },
      {
        label: "Best objective snapshot",
        value: bestObjective ? bestObjective.label : "--",
        meta: bestObjective ? `${bestObjective.metricLabel} ${bestObjective.metricValue}` : "No objective data"
      }
    ]
  };
}

function describeMetricDirection(previousValue, currentValue, threshold = 0.05) {
  const previous = toFiniteNumber(previousValue);
  const current = toFiniteNumber(currentValue);

  if (previous <= 0 && current <= 0) {
    return "flat";
  }
  if (previous <= 0 && current > 0) {
    return "up";
  }

  const delta = (current - previous) / Math.max(Math.abs(previous), 1);
  if (Math.abs(delta) < threshold) {
    return "flat";
  }

  return delta > 0 ? "up" : "down";
}

function buildMetricClause(label, previousValue, currentValue) {
  return `${label} ${describeMetricDirection(previousValue, currentValue)}`;
}

function buildLensSummarySentence(lens, campaigns = []) {
  const rangeLabel = getDashboardDateLabel();
  const series = buildAggregateSeries(campaigns);
  const { previous, current } = splitAggregateSeries(series);

  if (!current.length) {
    return `${rangeLabel}: no meaningful data in the selected scope.`;
  }

  if (lens === "awareness") {
    return `${rangeLabel}: ${buildMetricClause("spend", computeAggregateMetric(previous, "spend"), computeAggregateMetric(current, "spend"))}, ${buildMetricClause("CPM", computeAggregateMetric(previous, "cpm"), computeAggregateMetric(current, "cpm"))}, and ${buildMetricClause("CTR", computeAggregateMetric(previous, "ctr"), computeAggregateMetric(current, "ctr"))}.`;
  }

  if (lens === "leads") {
    return `${rangeLabel}: ${buildMetricClause("lead volume", computeAggregateMetric(previous, "leads"), computeAggregateMetric(current, "leads"))}, ${buildMetricClause("CPL", computeAggregateMetric(previous, "cpl"), computeAggregateMetric(current, "cpl"))}, and ${buildMetricClause("CTR", computeAggregateMetric(previous, "ctr"), computeAggregateMetric(current, "ctr"))}.`;
  }

  if (lens === "conversion_standard" || lens === "conversion_incremental") {
    return `${rangeLabel}: ${buildMetricClause("purchases", computeAggregateMetric(previous, "purchases"), computeAggregateMetric(current, "purchases"))}, ${buildMetricClause("CPA", computeAggregateMetric(previous, "cpa"), computeAggregateMetric(current, "cpa"))}, ${buildMetricClause("ROAS", computeAggregateMetric(previous, "roas"), computeAggregateMetric(current, "roas"))}, and ${buildMetricClause("CTR", computeAggregateMetric(previous, "ctr"), computeAggregateMetric(current, "ctr"))}.`;
  }

  const buckets = splitByCategory(campaigns);
  const conversionBuckets = splitConversionByAttribution(buckets.conversion);
  const incrementalCampaigns = buildIncrementalLensCampaigns(campaigns);
  const awareness = splitAggregateSeries(buildAggregateSeries(buckets.awareness));
  const leads = splitAggregateSeries(buildAggregateSeries(buckets.leads));
  const standard = splitAggregateSeries(buildAggregateSeries(conversionBuckets.standard));
  const incremental = splitAggregateSeries(buildAggregateSeries(incrementalCampaigns));

  return `${rangeLabel}: awareness ${buildMetricClause("CPM", computeAggregateMetric(awareness.previous, "cpm"), computeAggregateMetric(awareness.current, "cpm"))}, leads ${buildMetricClause("CPL", computeAggregateMetric(leads.previous, "cpl"), computeAggregateMetric(leads.current, "cpl"))}, standard conversion ${buildMetricClause("ROAS", computeAggregateMetric(standard.previous, "roas"), computeAggregateMetric(standard.current, "roas"))}, and incremental ${buildMetricClause("ROAS", computeAggregateMetric(incremental.previous, "roas"), computeAggregateMetric(incremental.current, "roas"))}.`;
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getDashboardDateLabel() {
  return appState.dashboardDateLabel || "Last 7 days";
}

function getDashboardSpendLabel() {
  const shortLabel = appState.dashboardDateShortLabel || "Last 7 days";
  return `Spend (${shortLabel})`;
}

function buildTrendCards(campaigns, lens, incrementalityFactor = 0.6) {
  const trendDates = (campaigns || [])
    .flatMap((campaign) => campaign.series || [])
    .map((point) => point.date)
    .filter(Boolean)
    .sort();
  const lastDate = trendDates[trendDates.length - 1];

  const meta = lastDate ? `${getDashboardDateLabel()} ending ${formatShortDate(lastDate)}` : getDashboardDateLabel();

  if (lens === "general") {
    return [
      {
        title: "Spend over time",
        meta,
        value: formatDashboardCurrency(sumMetric(campaigns, "spend_value")),
        series: buildSeriesTotals(campaigns, (point) => point.spend || 0),
        tone: "conversion"
      },
      {
        title: "Revenue over time",
        meta,
        value: formatDashboardCurrency(sumMetric(campaigns, "revenue_value")),
        tone: "conversion",
        series: buildSeriesTotals(campaigns, (point) => point.revenue || 0)
      },
      {
        title: "ROAS over time",
        meta,
        value: (() => {
          const totalSpend = sumMetric(campaigns, "spend_value");
          const totalRevenue = sumMetric(campaigns, "revenue_value");
          return totalSpend > 0 ? formatDashboardNumber(totalRevenue / totalSpend, 2) : "--";
        })(),
        tone: "conversion",
        series: buildSeriesTotals(campaigns, (point) => {
          const spend = toFiniteNumber(point.spend);
          const revenue = toFiniteNumber(point.revenue);
          return spend > 0 ? revenue / spend : 0;
        })
      },
      {
        title: "Objective performance",
        meta: "Spend plus efficiency by objective",
        kind: "objective-bars",
        tone: "conversion",
        rows: buildGeneralObjectivePerformanceRows(campaigns)
      }
    ];
  }

  if (lens === "awareness") {
    return [
      {
        title: "Spend trend",
        meta,
        value: formatDashboardCurrency(sumMetric(campaigns, "spend_value")),
        series: buildSeriesTotals(campaigns, (point) => point.spend || 0),
        tone: "awareness"
      },
      {
        title: "Reach delivery",
        meta,
        value: formatDashboardNumber(sumMetric(campaigns, "reach_value"), 0),
        series: buildSeriesTotals(campaigns, (point) => point.impressions || 0),
        tone: "awareness",
        hero: true
      },
      {
        title: "CPM trend",
        meta,
        value: (() => {
          const impressions = sumMetric(campaigns, "impressions_value");
          const spend = sumMetric(campaigns, "spend_value");
          return impressions > 0 ? formatDashboardCurrency((spend / impressions) * 1000) : "--";
        })(),
        series: buildSeriesTotals(campaigns, (point) => {
          const impressions = toFiniteNumber(point.impressions);
          const spend = toFiniteNumber(point.spend);
          return impressions > 0 ? (spend / impressions) * 1000 : 0;
        }),
        tone: "awareness"
      },
      {
        title: "Frequency trend",
        meta,
        value: formatDashboardNumber(sumMetric(campaigns, "frequency_value") / Math.max(1, campaigns.length), 2),
        series: buildSeriesTotals(campaigns, (point, campaign) => {
          const reach = toFiniteNumber(point.reach || campaign.reach_value);
          return reach > 0 ? (point.impressions || 0) / reach : 0;
        }),
        tone: "awareness"
      }
    ];
  }

  if (lens === "leads") {
    return [
      {
        title: "Spend trend",
        meta,
        value: formatDashboardCurrency(sumMetric(campaigns, "spend_value")),
        series: buildSeriesTotals(campaigns, (point) => point.spend || 0),
        tone: "leads"
      },
      {
        title: "Leads trend",
        meta,
        value: formatDashboardNumber(sumMetric(campaigns, "leads_value"), 0),
        series: buildSeriesTotals(campaigns, (point) => point.leads || 0),
        tone: "leads",
        hero: true
      },
      {
        title: "CPL trend",
        meta,
        value: (() => {
          const leads = sumMetric(campaigns, "leads_value");
          const spend = sumMetric(campaigns, "spend_value");
          return leads > 0 ? formatDashboardCurrency(spend / leads) : "--";
        })(),
        series: buildSeriesTotals(campaigns, (point) => {
          const leads = toFiniteNumber(point.leads);
          const spend = toFiniteNumber(point.spend);
          return leads > 0 ? spend / leads : 0;
        }),
        tone: "leads"
      },
      {
        title: "CTR trend",
        meta,
        value: (() => {
          const impressions = sumMetric(campaigns, "impressions_value");
          const clicks = sumMetric(campaigns, "clicks_value");
          return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : "--";
        })(),
        series: buildSeriesTotals(campaigns, (point) => {
          const impressions = toFiniteNumber(point.impressions);
          const clicks = toFiniteNumber(point.clicks);
          return impressions > 0 ? (clicks / impressions) * 100 : 0;
        }),
        tone: "leads"
      }
    ];
  }

  if (lens === "conversion_incremental") {
    return [
      {
        title: "Spend trend",
        meta,
        value: formatDashboardCurrency(sumMetric(campaigns, "spend_value")),
        series: buildSeriesTotals(campaigns, (point) => point.spend || 0),
        tone: "incremental"
      },
      {
        title: "Revenue trend",
        meta,
        value: formatDashboardCurrency(sumMetric(campaigns, "revenue_value")),
        series: buildSeriesTotals(campaigns, (point) => point.revenue || 0),
        tone: "incremental",
        hero: true
      },
      {
        title: "ROAS trend",
        meta,
        value: (() => {
          const spend = sumMetric(campaigns, "spend_value");
          const revenue = sumMetric(campaigns, "revenue_value");
          return spend > 0 ? (revenue / spend).toFixed(2) : "--";
        })(),
        series: buildDerivedSeriesTotals(
          campaigns,
          (point) => point.revenue || 0,
          (point) => point.spend || 0
        ),
        tone: "incremental"
      },
      {
        title: "CPA trend",
        meta,
        value: (() => {
          const purchases = sumMetric(campaigns, "purchases_value");
          const spend = sumMetric(campaigns, "spend_value");
          return purchases > 0 ? formatDashboardCurrency(spend / purchases) : "--";
        })(),
        series: buildDerivedSeriesTotals(
          campaigns,
          (point) => point.spend || 0,
          (point) => point.purchases || 0
        ),
        tone: "incremental"
      },
      {
        title: "Purchase trend",
        meta,
        value: formatDashboardNumber(sumMetric(campaigns, "purchases_value"), 0),
        series: buildSeriesTotals(campaigns, (point) => point.purchases || 0),
        tone: "incremental"
      }
    ];
  }

  return [
    {
      title: "Spend trend",
      meta,
      value: formatDashboardCurrency(sumMetric(campaigns, "spend_value")),
      series: buildSeriesTotals(campaigns, (point) => point.spend || 0),
      tone: "conversion"
    },
    {
      title: "Revenue trend",
      meta,
      value: formatDashboardCurrency(sumMetric(campaigns, "revenue_value")),
      series: buildSeriesTotals(campaigns, (point) => point.revenue || 0),
      tone: "conversion",
      hero: true
    },
    {
      title: "ROAS trend",
      meta,
      value: (() => {
        const spend = sumMetric(campaigns, "spend_value");
        const revenue = sumMetric(campaigns, "revenue_value");
        return spend > 0 ? (revenue / spend).toFixed(2) : "--";
      })(),
      series: buildDerivedSeriesTotals(
        campaigns,
        (point) => point.revenue || 0,
        (point) => point.spend || 0
      ),
      tone: "conversion"
    },
    {
      title: "CPA trend",
      meta,
      value: (() => {
        const purchases = sumMetric(campaigns, "purchases_value");
        const spend = sumMetric(campaigns, "spend_value");
        return purchases > 0 ? formatDashboardCurrency(spend / purchases) : "--";
      })(),
      series: buildDerivedSeriesTotals(
        campaigns,
        (point) => point.spend || 0,
        (point) => point.purchases || 0
      ),
      tone: "conversion"
    },
    {
      title: "Purchase trend",
      meta,
      value: formatDashboardNumber(sumMetric(campaigns, "purchases_value"), 0),
      series: buildSeriesTotals(campaigns, (point) => point.purchases || 0),
      tone: "conversion"
    }
  ];
}

function buildOverviewCards(campaigns, incrementalityFactor = 0.6) {
  const buckets = splitByCategory(campaigns);
  const conversionBuckets = splitConversionByAttribution(buckets.conversion);
  const incrementalCampaigns = buildIncrementalLensCampaigns(campaigns);
  const totalSpend = sumMetric(campaigns, "spend_value");
  const spendShare = (value) => totalSpend > 0
    ? `${((Number(value || 0) / totalSpend) * 100).toFixed(1)}% of spend`
    : null;

  const buildTopItems = (list, metricKey, formatter) => {
    return [...list]
      .sort((left, right) => toFiniteNumber(right?.[metricKey]) - toFiniteNumber(left?.[metricKey]))
      .slice(0, 3)
      .map((campaign) => ({
        label: campaign.name,
        value: formatter(toFiniteNumber(campaign?.[metricKey]))
      }));
  };

  return [
    {
      key: "awareness",
      meta: [ `${buckets.awareness.length} campaigns in lens`, spendShare(sumMetric(buckets.awareness, "spend_value")) ].filter(Boolean).join(" · "),
      metric: formatDashboardNumber(sumMetric(buckets.awareness, "reach_value"), 0),
      items: buildTopItems(buckets.awareness, "reach_value", (value) => `${formatDashboardNumber(value, 0)} reach`)
    },
    {
      key: "leads",
      meta: [ `${buckets.leads.length} campaigns in lens`, spendShare(sumMetric(buckets.leads, "spend_value")) ].filter(Boolean).join(" · "),
      metric: formatDashboardNumber(sumMetric(buckets.leads, "leads_value"), 0),
      items: buildTopItems(buckets.leads, "leads_value", (value) => `${formatDashboardNumber(value, 0)} leads`)
    },
    {
      key: "convstd",
      meta: [ `${conversionBuckets.standard.length} campaigns in lens`, spendShare(sumMetric(conversionBuckets.standard, "spend_value")) ].filter(Boolean).join(" · "),
      metric: formatDashboardCurrency(sumMetric(conversionBuckets.standard, "revenue_value")),
      items: buildTopItems(conversionBuckets.standard, "revenue_value", (value) => formatDashboardCurrency(value))
    },
    {
      key: "convinc",
      meta: [ `${incrementalCampaigns.length} campaigns in lens`, spendShare(sumMetric(incrementalCampaigns, "spend_value")) ].filter(Boolean).join(" · "),
      metric: formatDashboardCurrency(sumMetric(incrementalCampaigns, "revenue_value")),
      items: buildTopItems(incrementalCampaigns, "revenue_value", (value) => formatDashboardCurrency(value))
    }
  ];
}

function buildGeneralTableCampaigns(campaigns, incrementalityFactor = 0.6) {
  return (campaigns || [])
    .map((campaign) => {
      const category = classifyCampaign(campaign);
      const conversionAttribution = category === "conversion" ? classifyConversionAttribution(campaign) : null;
      const spend = toFiniteNumber(campaign.spend_value);
      const reach = toFiniteNumber(campaign.reach_value);
      const leads = toFiniteNumber(campaign.leads_value);
      const purchases = toFiniteNumber(campaign.purchases_value);
      const cpm = toFiniteNumber(campaign.cpm_value);
      const cpl = toFiniteNumber(campaign.cpl_value);
      const roas = toFiniteNumber(campaign.roas_value);

      let primaryMetric = `${formatDashboardNumber(reach, 0)} reach`;
      let efficiencyMetric = `CPM ${formatDashboardCurrency(cpm)}`;
      let displayCategory = category;

      if (category === "leads") {
        primaryMetric = `${formatDashboardNumber(leads, 0)} leads`;
        efficiencyMetric = leads > 0 ? `CPL ${formatDashboardCurrency(cpl)}` : "CPL --";
      } else if (category === "conversion") {
        primaryMetric = `${formatDashboardNumber(purchases, 0)} purchases`;
        efficiencyMetric = `ROAS ${formatDashboardNumber(roas, 2)}`;
        displayCategory = conversionAttribution === "incremental" ? "conversion_incremental" : "conversion_standard";
      }

      return {
        ...campaign,
        category: displayCategory,
        primaryMetric,
        efficiencyMetric,
        spendSort: spend
      };
    })
    .sort((left, right) => right.spendSort - left.spendSort);
}

function buildGeneralDashboardAnalysis(campaigns, incrementalityFactor = 0.6) {
  const buckets = splitByCategory(campaigns);
  const quickInsight = buildGeneralQuickInsight(campaigns);

  return {
    executiveBrief: quickInsight,
    pressureGroups: buildGeneralPerformerGroups(campaigns),
    cards: [],
    pulseRows: [],
    signals: [
      {
        title: "Brand awareness spend",
        body: `${buckets.awareness.length} campaigns contribute to the awareness objective bucket in General.`
      },
      {
        title: "Conversion stays combined here",
        body: `${buckets.conversion.length} conversion campaigns are combined only in General for objective-level spend and performance reads.`
      }
    ],
    tableCampaigns: buildGeneralTableCampaigns(campaigns, incrementalityFactor)
  };
}

function getBackendHeroPanelItems(lens) {
  const items = appState.metaDashboard?.visuals?.heroPanelByLens?.[lens];
  return Array.isArray(items) && items.length ? items : null;
}

function getBackendTrendCards(lens) {
  const cards = appState.metaDashboard?.visuals?.trendCardsByLens?.[lens];
  return Array.isArray(cards) && cards.length ? cards : null;
}

function getBackendOverviewCards() {
  const cards = appState.metaDashboard?.visuals?.overviewCards;
  return Array.isArray(cards) && cards.length ? cards : null;
}

function buildHeroPanelItems(lens, analysis, campaigns) {
  const backendItems = getBackendHeroPanelItems(lens);
  if (backendItems) {
    return backendItems;
  }

  const topCampaign = analysis?.tableCampaigns?.[0];
  const activeCount = Array.isArray(campaigns) ? campaigns.length : 0;

  if (lens === "general") {
    return buildGeneralKpiStrip(campaigns);
  }

  const topAction = analysis?.cards?.[0];
  const secondAction = analysis?.cards?.[1];

  return [
    {
      label: "Primary move",
      value: topAction?.action || "Review",
      meta: topAction?.campaign || topCampaign?.name || "No campaign",
      tone: topAction?.tone || "neutral"
    },
    {
      label: "Anchor",
      value: secondAction?.action || "Hold",
      meta: secondAction?.campaign || "--",
      tone: secondAction?.tone || "neutral"
    },
    {
      label: "Scope",
      value: formatDashboardNumber(activeCount, 0),
      meta: lens === "awareness"
        ? "Awareness campaigns"
        : lens === "leads"
          ? "Lead campaigns"
          : lens === "conversion_incremental"
            ? "Incremental campaigns"
            : "Standard campaigns",
      tone: "neutral"
    }
  ];
}

function getGeneralHeroCopy(analysis, campaigns = []) {
  return {
    kicker: "Daily operator view",
    title: "General",
    subtitle: "",
    tableTitle: "Cross-lens campaign snapshot"
  };
}

function getLensEmptyStateCopy(lens) {
  if (lens === "conversion_incremental") {
    return {
      headline: "No incremental campaigns in scope.",
      body: "This date range does not include any campaigns assigned to the incremental track, so metrics, trends and rankings are hidden for now.",
      nextStep: "Check General or Conversion (standard), or widen the date range."
    };
  }
  if (lens === "conversion_standard") {
    return {
      headline: "No standard conversion campaigns in scope.",
      body: "This date range does not include any standard conversion campaigns, so performance cards and rankings are hidden for now.",
      nextStep: "Check General or widen the date range."
    };
  }
  if (lens === "leads") {
    return {
      headline: "No lead campaigns in scope.",
      body: "This date range does not include any lead campaigns, so volume, CPL and ranking views are hidden for now.",
      nextStep: "Check General or widen the date range."
    };
  }
  return {
    headline: "No awareness campaigns in scope.",
    body: "This date range does not include any awareness campaigns, so reach, CPM and ranking views are hidden for now.",
    nextStep: "Check General or widen the date range."
  };
}

function getDashboardStatsForLens(lens, campaigns, factor = 0.6) {
  const backendStats = appState.metaDashboard?.statsByLens?.[lens];
  if (Array.isArray(backendStats) && backendStats.length) {
    return backendStats;
  }
  return lens === "general"
    ? buildGeneralStats(campaigns)
    : buildDashboardStatsV2(campaigns, lens, factor);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePercentValue(rawValue) {
  return toFiniteNumber(String(rawValue || "").replace("%", "").replace(",", "."), 0);
}

function clampNumber(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function ratio(value, maxValue) {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }
  return clampNumber(value / maxValue, 0, 1);
}

function inverseRatio(value, maxValue) {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }
  return clampNumber(1 - value / maxValue, 0, 1);
}

function formatDashboardCurrency(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: appState.metaCurrency || "EUR",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDashboardNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDashboardPercent(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return `${formatDashboardNumber(value, digits)}%`;
}

function parseCurrencyValue(value) {
  const parsed = Number.parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDashboardAnalysis(campaigns, lens, incrementalityFactor = 0.6) {
  const prepared = (campaigns || []).map((campaign) => {
    const spend = toFiniteNumber(campaign.spend_value);
    const reach = toFiniteNumber(campaign.reach_value);
    const frequency = toFiniteNumber(campaign.frequency_value);
    const cpm = toFiniteNumber(campaign.cpm_value);
    const purchases = toFiniteNumber(campaign.purchases_value);
    const revenue = toFiniteNumber(campaign.revenue_value);
    const roas = toFiniteNumber(campaign.roas_value);
    const cpa = toFiniteNumber(campaign.cpa_value);
    const leads = toFiniteNumber(campaign.leads_value);
    const cpl = leads > 0 ? spend / leads : 0;
    const ctr = Number.isFinite(Number(campaign.ctr_value))
      ? toFiniteNumber(campaign.ctr_value)
      : parsePercentValue(campaign.ctr);
    const incRevenue = revenue * incrementalityFactor;
    const iroas = roas * incrementalityFactor;
    const incPurchases = purchases * incrementalityFactor;

    return {
      campaign,
      spend,
      reach,
      frequency,
      cpm,
      purchases,
      revenue,
      roas,
      cpa,
      leads,
      cpl,
      ctr,
      incRevenue,
      iroas,
      incPurchases
    };
  });

  if (!prepared.length) {
    return {
      cards: [],
      pulseRows: [],
      signals: [],
      tableCampaigns: []
    };
  }

  const maxSpend = Math.max(...prepared.map((item) => item.spend), 1);
  const maxReach = Math.max(...prepared.map((item) => item.reach), 1);
  const maxCpm = Math.max(...prepared.map((item) => item.cpm), 1);
  const maxFreq = Math.max(...prepared.map((item) => item.frequency), 1);
  const maxCtr = Math.max(...prepared.map((item) => item.ctr), 1);
  const maxPurchases = Math.max(...prepared.map((item) => item.purchases), 1);
  const maxRoas = Math.max(...prepared.map((item) => item.roas), 1);
  const maxCpa = Math.max(...prepared.map((item) => item.cpa), 1);
  const maxLeads = Math.max(...prepared.map((item) => item.leads), 1);
  const maxCpl = Math.max(...prepared.map((item) => item.cpl), 1);
  const maxIncRevenue = Math.max(...prepared.map((item) => item.incRevenue), 1);
  const maxIroas = Math.max(...prepared.map((item) => item.iroas), 1);
  const maxIncPurchases = Math.max(...prepared.map((item) => item.incPurchases), 1);

  const avgSpend = sumMetric(prepared, "spend") / prepared.length;
  const avgFreq = sumMetric(prepared, "frequency") / prepared.length;
  const avgRoas = sumMetric(prepared, "roas") / prepared.length;
  const avgCpa = sumMetric(prepared, "cpa") / prepared.length;
  const avgCpl = sumMetric(prepared, "cpl") / prepared.length;

  const scored = prepared.map((item) => {
    let score = 0;
    let tone = "neutral";
    let action = "Review";
    let primaryLabel = "Spend";
    let primaryValue = formatDashboardCurrency(item.spend);
    let secondaryLabel = "Status";
    let secondaryValue = item.campaign.status || "Healthy";
    let note = "Review this campaign in the current lens.";

    if (lens === "conversion_standard") {
      score = (
        ratio(item.roas, maxRoas) * 0.42 +
        ratio(item.purchases, maxPurchases) * 0.28 +
        inverseRatio(item.cpa, maxCpa) * 0.20 +
        inverseRatio(item.spend, maxSpend) * 0.10
      ) * 100;

      primaryLabel = "ROAS";
      primaryValue = formatDashboardNumber(item.roas, 2);
      secondaryLabel = "CPA";
      secondaryValue = formatDashboardCurrency(item.cpa);
      note = `${formatDashboardNumber(item.purchases, 0)} purchases from ${formatDashboardCurrency(item.spend)} spend.`;

      if (item.spend > avgSpend && item.roas < avgRoas) {
        tone = "danger";
        action = "Cut waste";
      } else if (item.purchases >= maxPurchases * 0.65) {
        tone = "success";
        action = "Protect";
      } else if (score >= 70) {
        tone = "success";
        action = "Scale";
      } else if (item.cpa > avgCpa && item.roas < avgRoas) {
        tone = "warning";
        action = "Fix";
      } else {
        tone = "warning";
        action = "Test";
      }
    } else if (lens === "conversion_incremental") {
      score = (
        ratio(item.roas, maxRoas) * 0.42 +
        ratio(item.purchases, maxPurchases) * 0.28 +
        inverseRatio(item.cpa, maxCpa) * 0.20 +
        inverseRatio(item.spend, maxSpend) * 0.12
      ) * 100;

      primaryLabel = "ROAS";
      primaryValue = formatDashboardNumber(item.roas, 2);
      secondaryLabel = "CPA";
      secondaryValue = formatDashboardCurrency(item.cpa);
      note = `${formatDashboardNumber(item.purchases, 0)} purchases from ${formatDashboardCurrency(item.spend)} spend in the incremental campaign set.`;

      if (item.spend > avgSpend && item.roas < avgRoas) {
        tone = "danger";
        action = "Question";
      } else if (score >= 72) {
        tone = "success";
        action = "Scale";
      } else if (item.purchases >= maxPurchases * 0.65) {
        tone = "success";
        action = "Protect";
      } else {
        tone = "warning";
        action = "Prove";
      }
    } else if (lens === "leads") {
      score = (
        ratio(item.leads, maxLeads) * 0.46 +
        inverseRatio(item.cpl, maxCpl) * 0.34 +
        ratio(item.ctr, maxCtr) * 0.12 +
        inverseRatio(item.spend, maxSpend) * 0.08
      ) * 100;

      primaryLabel = "Leads";
      primaryValue = formatDashboardNumber(item.leads, 0);
      secondaryLabel = "CPL";
      secondaryValue = item.leads > 0 ? formatDashboardCurrency(item.cpl) : "--";
      note = item.leads > 0
        ? `${formatDashboardNumber(item.leads, 0)} leads at ${formatDashboardCurrency(item.cpl)} CPL from ${formatDashboardCurrency(item.spend)} spend.`
        : `No leads recorded from ${formatDashboardCurrency(item.spend)} spend yet.`;

      if (item.spend > avgSpend && item.leads === 0) {
        tone = "danger";
        action = "Stop bleed";
      } else if (item.leads >= maxLeads * 0.65 && item.cpl > 0 && item.cpl <= avgCpl) {
        tone = "success";
        action = "Scale";
      } else if (item.leads >= maxLeads * 0.6) {
        tone = "success";
        action = "Protect";
      } else if (item.cpl > avgCpl && item.leads > 0) {
        tone = "warning";
        action = "Fix";
      } else {
        tone = "warning";
        action = "Test";
      }
    } else {
      const freqHealth = item.frequency <= 2.3
        ? 1
        : clampNumber(1 - ((item.frequency - 2.3) / Math.max(1.2, maxFreq - 2.3)), 0, 1);

      score = (
        ratio(item.reach, maxReach) * 0.40 +
        inverseRatio(item.cpm, maxCpm) * 0.26 +
        freqHealth * 0.20 +
        ratio(item.ctr, maxCtr) * 0.14
      ) * 100;

      primaryLabel = "Reach";
      primaryValue = formatDashboardNumber(item.reach, 0);
      secondaryLabel = "CPM";
      secondaryValue = formatDashboardCurrency(item.cpm);
      note = `${formatDashboardPercent(item.ctr)} CTR with ${formatDashboardNumber(item.frequency, 2)} frequency.`;

      if (item.frequency > Math.max(3.2, avgFreq * 1.15)) {
        tone = "warning";
        action = "Refresh";
      } else if (item.spend > avgSpend && item.cpm > maxCpm * 0.82) {
        tone = "danger";
        action = "Trim";
      } else if (score >= 70) {
        tone = "success";
        action = "Scale";
      } else {
        tone = "warning";
        action = "Watch";
      }
    }

    return {
      ...item,
      score,
      scorePercent: clampNumber(score / 100, 0, 1) * 100,
      tone,
      action,
      primaryLabel,
      primaryValue,
      secondaryLabel,
      secondaryValue,
      note
    };
  });

  const sorted = [...scored].sort((left, right) => right.score - left.score);
  const best = sorted[0];
  const protector = [...sorted].sort((left, right) => {
    if (lens === "awareness") return right.reach - left.reach;
    if (lens === "leads") return right.leads - left.leads;
    if (lens === "conversion_incremental") return right.purchases - left.purchases;
    return right.purchases - left.purchases;
  })[0] || best;
  const waste = [...scored].sort((left, right) => {
    const leftRisk = (left.spend / maxSpend) + (lens === "awareness"
      ? ratio(left.cpm, maxCpm)
      : lens === "leads"
      ? ratio(left.cpl, maxCpl)
      : lens === "conversion_incremental"
        ? inverseRatio(left.roas, maxRoas)
        : inverseRatio(left.roas, maxRoas));
    const rightRisk = (right.spend / maxSpend) + (lens === "awareness"
      ? ratio(right.cpm, maxCpm)
      : lens === "leads"
      ? ratio(right.cpl, maxCpl)
      : lens === "conversion_incremental"
        ? inverseRatio(right.roas, maxRoas)
        : inverseRatio(right.roas, maxRoas));
    return rightRisk - leftRisk;
  })[0] || best;
  const tension = [...scored].sort((left, right) => {
    if (lens === "awareness") return right.frequency - left.frequency;
    if (lens === "leads") return right.cpl - left.cpl;
    if (lens === "conversion_incremental") return right.spend - left.spend;
    return right.cpa - left.cpa;
  })[0] || best;
  const nextTest = [...sorted].find((item) => item.spend < avgSpend && item.score >= 58) || sorted[Math.min(1, sorted.length - 1)] || best;
  const summarySentence = buildLensSummarySentence(lens, campaigns);

  const cards = lens === "conversion_standard"
    ? [
        {
          kicker: "Scale now",
          title: "Top efficiency signal",
          metric: `ROAS ${formatDashboardNumber(best.roas, 2)}`,
          body: "Best balance of return, cost efficiency and order volume in the standard view.",
          campaign: best.campaign.name,
          tone: "success",
          action: "Scale"
        },
        {
          kicker: "Protect",
          title: "Volume anchor",
          metric: `${formatDashboardNumber(protector.purchases, 0)} purchases`,
          body: "This campaign is carrying real conversion volume and should stay stable while you test around it.",
          campaign: protector.campaign.name,
          tone: "success",
          action: "Protect"
        },
        {
          kicker: "Fix waste",
          title: "Margin leak",
          metric: formatDashboardCurrency(waste.cpa),
          body: "High spend is not converting well enough here. Tighten creative or reduce budget before scaling elsewhere.",
          campaign: waste.campaign.name,
          tone: "danger",
          action: "Fix"
        },
        {
          kicker: "Test next",
          title: "Low-risk upside",
          metric: `ROAS ${formatDashboardNumber(nextTest.roas, 2)}`,
          body: "Cleaner efficiency at a lower spend level. Good candidate for a controlled budget step-up.",
          campaign: nextTest.campaign.name,
          tone: "warning",
          action: "Test"
        }
      ]
    : lens === "conversion_incremental"
      ? [
          {
            kicker: "Scale now",
            title: "Best incremental set efficiency",
            metric: `ROAS ${formatDashboardNumber(best.roas, 2)}`,
            body: "Strongest efficiency inside the campaigns explicitly separated into the incremental lens.",
            campaign: best.campaign.name,
            tone: "success",
            action: "Scale"
          },
          {
            kicker: "Protect",
            title: "Volume anchor",
            metric: `${formatDashboardNumber(protector.purchases, 0)} purchases`,
            body: "This campaign is carrying the most conversion volume inside the incremental lens.",
            campaign: protector.campaign.name,
            tone: "success",
            action: "Protect"
          },
          {
            kicker: "Challenge",
            title: "Budget under pressure",
            metric: `CPA ${formatDashboardCurrency(waste.cpa)}`,
            body: "Spend is outpacing return in this separated campaign set. Audit here first.",
            campaign: waste.campaign.name,
            tone: "danger",
            action: "Question"
          },
          {
            kicker: "Prove next",
            title: "Next budget test",
            metric: `ROAS ${formatDashboardNumber(nextTest.roas, 2)}`,
            body: "Cleaner efficiency at lower spend. Good candidate for the next measured expansion in the incremental set.",
            campaign: nextTest.campaign.name,
            tone: "warning",
            action: "Prove"
          }
        ]
      : lens === "leads"
        ? [
            {
              kicker: "Scale leads",
              title: "Best lead efficiency",
              metric: `${formatDashboardNumber(best.leads, 0)} leads`,
              body: "Highest lead volume with a sane CPL. This is where budget increases belong first.",
              campaign: best.campaign.name,
              tone: "success",
              action: "Scale"
            },
            {
              kicker: "Protect",
              title: "Lead volume anchor",
              metric: `CPL ${formatDashboardCurrency(protector.cpl)}`,
              body: "This campaign is carrying lead volume. Keep it stable while you iterate creatives elsewhere.",
              campaign: protector.campaign.name,
              tone: "success",
              action: "Protect"
            },
            {
              kicker: "Fix waste",
              title: "CPL too high",
              metric: `CPL ${formatDashboardCurrency(waste.cpl)}`,
              body: "Spend is not producing enough qualified leads here. Tighten messaging or reduce budget.",
              campaign: waste.campaign.name,
              tone: "danger",
              action: "Fix"
            },
            {
              kicker: "Test next",
              title: "Next efficiency test",
              metric: `CPL ${formatDashboardCurrency(nextTest.cpl)}`,
              body: "Smaller budget with enough efficiency to justify a controlled step-up test.",
              campaign: nextTest.campaign.name,
              tone: "warning",
              action: "Test"
            }
          ]
      : [
          {
            kicker: "Scale reach",
            title: "Best awareness balance",
            metric: formatDashboardNumber(best.reach, 0),
            body: "This campaign combines strong reach with controlled cost and acceptable repetition.",
            campaign: best.campaign.name,
            tone: "success",
            action: "Scale"
          },
          {
            kicker: "Protect",
            title: "Reach anchor",
            metric: formatDashboardCurrency(protector.cpm),
            body: "This campaign is carrying large awareness delivery. Keep it stable while you test around it.",
            campaign: protector.campaign.name,
            tone: "success",
            action: "Protect"
          },
          {
            kicker: "Cut waste",
            title: "Expensive awareness",
            metric: formatDashboardCurrency(waste.cpm),
            body: "Cost per thousand is too heavy for the amount of awareness being bought here.",
            campaign: waste.campaign.name,
            tone: "danger",
            action: "Trim"
          },
          {
            kicker: "Refresh",
            title: "Fatigue signal",
            metric: `${formatDashboardNumber(tension.frequency, 2)} freq`,
            body: "This is the clearest repetition warning in the current awareness view.",
            campaign: tension.campaign.name,
            tone: "warning",
            action: "Refresh"
          }
        ];

  const signals = lens === "conversion_standard"
    ? [
        { title: "Scale signal", body: `${best.campaign.name} is the cleanest efficiency leader with ROAS ${formatDashboardNumber(best.roas, 2)} and ${formatDashboardNumber(best.purchases, 0)} purchases.` },
        { title: "Waste signal", body: `${waste.campaign.name} is burning the most margin right now with CPA ${formatDashboardCurrency(waste.cpa)} on meaningful spend.` },
        { title: "Volume anchor", body: `${protector.campaign.name} should be protected because it is carrying the strongest purchase volume in this lens.` },
        { title: "Next test", body: `${nextTest.campaign.name} has enough efficiency to justify a controlled budget increase before broader rollout.` }
      ]
    : lens === "conversion_incremental"
      ? [
          { title: "Incremental set leader", body: `${best.campaign.name} is the strongest efficiency signal inside the incremental campaign set with ROAS ${formatDashboardNumber(best.roas, 2)}.` },
          { title: "Volume anchor", body: `${protector.campaign.name} is carrying the biggest purchase volume inside the incremental lens.` },
          { title: "Budget pressure", body: `${waste.campaign.name} has the clearest spend-to-return pressure inside the incremental set.` },
          { title: "Proof candidate", body: `${nextTest.campaign.name} looks ready for the next proof-of-scale test at relatively low risk.` }
        ]
      : [
          { title: "Reach leader", body: `${best.campaign.name} is currently your strongest awareness balance with high reach and better cost discipline.` },
          { title: "CPM pressure", body: `${waste.campaign.name} is where awareness is becoming too expensive relative to the rest of the account.` },
          { title: "Fatigue watch", body: `${tension.campaign.name} is showing the highest repetition pressure. Refresh before attention softens further.` },
          { title: "Next scale test", body: `${nextTest.campaign.name} has enough attention quality to justify a cautious reach expansion.` }
        ];

  const pulseRows = sorted.slice(0, 6).map((item) => ({
    name: item.campaign.name,
    action: item.action,
    tone: item.tone,
    note: item.note,
    primaryLabel: item.primaryLabel,
    primaryValue: item.primaryValue,
    secondaryLabel: item.secondaryLabel,
    secondaryValue: item.secondaryValue,
    scorePercent: item.scorePercent
  }));

  const executiveBrief = lens === "conversion_standard"
    ? {
        kicker: "Fast operating read",
        headline: "Standard conversion summary",
        body: summarySentence,
        points: [
          {
            label: "Scale",
            value: best.campaign.name,
            meta: `ROAS ${formatDashboardNumber(best.roas, 2)}`
          },
          {
            label: "Protect",
            value: protector.campaign.name,
            meta: `${formatDashboardNumber(protector.purchases, 0)} purchases`
          },
          {
            label: "Fix",
            value: waste.campaign.name,
            meta: `CPA ${formatDashboardCurrency(waste.cpa)}`
          }
        ]
      }
    : lens === "conversion_incremental"
      ? {
          kicker: "Incremental set read",
          headline: "Incremental conversion summary",
          body: summarySentence,
          points: [
            {
              label: "Scale",
              value: best.campaign.name,
              meta: `ROAS ${formatDashboardNumber(best.roas, 2)}`
            },
            {
              label: "Protect",
              value: protector.campaign.name,
              meta: `${formatDashboardNumber(protector.purchases, 0)} purchases`
            },
            {
              label: "Question",
              value: waste.campaign.name,
              meta: `CPA ${formatDashboardCurrency(waste.cpa)}`
            }
          ]
        }
      : lens === "leads"
        ? {
            kicker: "Lead gen read",
            headline: "Lead generation summary",
            body: summarySentence,
            points: [
              {
                label: "Scale",
                value: best.campaign.name,
                meta: `${formatDashboardNumber(best.leads, 0)} leads`
              },
              {
                label: "Protect",
                value: protector.campaign.name,
                meta: `CPL ${formatDashboardCurrency(protector.cpl)}`
              },
              {
                label: "Fix",
                value: waste.campaign.name,
                meta: `CPL ${formatDashboardCurrency(waste.cpl)}`
              }
            ]
          }
        : {
            kicker: "Awareness read",
            headline: "Awareness summary",
            body: summarySentence,
            points: [
              {
                label: "Scale",
                value: best.campaign.name,
                meta: `${formatDashboardNumber(best.reach, 0)} reach`
              },
              {
                label: "Refresh",
                value: tension.campaign.name,
                meta: `${formatDashboardNumber(tension.frequency, 2)} frequency`
              },
              {
                label: "Trim",
                value: waste.campaign.name,
                meta: `CPM ${formatDashboardCurrency(waste.cpm)}`
              }
            ]
          };

  const pressureGroups = lens === "conversion_standard"
    ? [
        {
          title: "Scale now",
          meta: "Best efficiency",
          body: "These are the cleanest campaigns to expand first.",
          tone: "success",
          items: sorted.filter((item) => item.action === "Scale").slice(0, 2).map((item) => ({
            name: item.campaign.name,
            metric: `ROAS ${formatDashboardNumber(item.roas, 2)}`
          }))
        },
        {
          title: "Protect",
          meta: "Volume anchor",
          body: "Keep these stable while testing around them.",
          tone: "success",
          items: [protector, best].slice(0, 2).map((item) => ({
            name: item.campaign.name,
            metric: `${formatDashboardNumber(item.purchases, 0)} purchases`
          }))
        },
        {
          title: "Fix",
          meta: "Margin pressure",
          body: "Too much spend for the return coming back.",
          tone: "danger",
          items: [waste, tension].slice(0, 2).map((item) => ({
            name: item.campaign.name,
            metric: `CPA ${formatDashboardCurrency(item.cpa)}`
          }))
        },
        {
          title: "Test",
          meta: "Next move",
          body: "Good lower-risk candidates for the next experiment.",
          tone: "warning",
          items: [nextTest].map((item) => ({
            name: item.campaign.name,
            metric: `ROAS ${formatDashboardNumber(item.roas, 2)}`
          }))
        }
      ]
    : lens === "conversion_incremental"
      ? [
          {
            title: "Scale now",
            meta: "Best efficiency",
            body: "Highest efficiency inside the separated incremental campaign set.",
            tone: "success",
            items: sorted.filter((item) => item.action === "Scale").slice(0, 2).map((item) => ({
              name: item.campaign.name,
              metric: `ROAS ${formatDashboardNumber(item.roas, 2)}`
            }))
          },
          {
            title: "Protect",
            meta: "Volume anchor",
            body: "Largest purchase contributors in the incremental lens.",
            tone: "success",
            items: [protector, best].slice(0, 2).map((item) => ({
              name: item.campaign.name,
              metric: `${formatDashboardNumber(item.purchases, 0)} purchases`
            }))
          },
          {
            title: "Question",
            meta: "Budget pressure",
            body: "Spend that still needs to prove clean return inside this separated set.",
            tone: "danger",
            items: [waste].map((item) => ({
              name: item.campaign.name,
              metric: `CPA ${formatDashboardCurrency(item.cpa)}`
            }))
          },
          {
            title: "Prove next",
            meta: "Upside test",
            body: "Candidates for the next controlled budget step-up.",
            tone: "warning",
            items: [nextTest].map((item) => ({
              name: item.campaign.name,
              metric: `ROAS ${formatDashboardNumber(item.roas, 2)}`
            }))
          }
        ]
      : [
          {
            title: "Scale now",
            meta: "Clean reach",
            body: "Best campaigns to buy more awareness through.",
            tone: "success",
            items: sorted.filter((item) => item.action === "Scale").slice(0, 2).map((item) => ({
              name: item.campaign.name,
              metric: `${formatDashboardNumber(item.reach, 0)} reach`
            }))
          },
          {
            title: "Protect",
            meta: "Stable CPM",
            body: "Awareness anchors worth keeping steady.",
            tone: "success",
            items: [protector].map((item) => ({
              name: item.campaign.name,
              metric: `CPM ${formatDashboardCurrency(item.cpm)}`
            }))
          },
          {
            title: "Trim",
            meta: "Cost pressure",
            body: "Awareness that is getting too expensive.",
            tone: "danger",
            items: [waste].map((item) => ({
              name: item.campaign.name,
              metric: `CPM ${formatDashboardCurrency(item.cpm)}`
            }))
          },
          {
            title: "Refresh",
            meta: "Fatigue risk",
            body: "Campaigns where repetition is becoming a problem.",
            tone: "warning",
            items: [tension].map((item) => ({
              name: item.campaign.name,
              metric: `${formatDashboardNumber(item.frequency, 2)} frequency`
            }))
          }
        ];

  return {
    executiveBrief,
    pressureGroups,
    cards,
    signals,
    pulseRows,
    tableCampaigns: sorted.map((item) => item.campaign)
  };
}

function renderDashboard() {
  const lens = appState.dashboardLens;
  const allCampaigns = appState.campaigns || [];
  const factor = appState.dashboardIncrementalityFactor;
  const lensCampaigns = getLensCampaigns(allCampaigns, lens);
  const lensHasCampaigns = Array.isArray(lensCampaigns) && lensCampaigns.length > 0;
  const backendTrendCards = getBackendTrendCards(lens);
  const backendOverviewCards = getBackendOverviewCards();
  const analysis = lens === "general"
    ? buildGeneralDashboardAnalysis(allCampaigns, factor)
    : buildDashboardAnalysis(lensCampaigns, lens, factor);
  appState.dashboardAnalysis = analysis;

  const lensCopy = (() => {
    if (lens === "general") {
      return getGeneralHeroCopy(analysis, allCampaigns);
    }
    if (lens === "conversion_incremental") {
      return {
        kicker: "Incremental operator view",
        title: "Incremental conversion. Separate.",
        subtitle: "Only campaigns assigned to the incremental track.",
        tableTitle: "Incremental conversion snapshot"
      };
    }
    if (lens === "conversion_standard") {
      return {
        kicker: "Standard operator view",
        title: "Standard conversion. Clean view.",
        subtitle: "Decide from the numbers Meta reports right now.",
        tableTitle: "Conversion snapshot (standard)"
      };
    }
    if (lens === "leads") {
      return {
        kicker: "Lead generation cockpit",
        title: "Leads. Volume with discipline.",
        subtitle: "Strict on lead yield and CPL.",
        tableTitle: "Lead generation snapshot"
      };
    }
    return {
      kicker: "Awareness command view",
      title: "Brand awareness. Reach without waste.",
      subtitle: "Stay ruthless on reach, repetition and cost.",
      tableTitle: "Awareness snapshot"
    };
  })();

  const overviewVisible = lens === "general";
  const isEmptyLensState = !overviewVisible && !lensHasCampaigns;
  const decisionBoardNode = document.getElementById("decision-board");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const executiveNode = document.getElementById("dashboard-executive-section");
  const pressureCardNode = document.querySelector(".pressure-card");
  const pulseNode = document.getElementById("campaign-pulse-list")?.closest("section.card");
  const signalsNode = document.getElementById("dashboard-signals");
  const statsGridNode = document.getElementById("stats-grid");
  const trendDeckNode = document.getElementById("trend-deck");
  const overviewGridNode = document.getElementById("overview-grid");
  const actionBoardHeadNode = document.getElementById("action-board-head");
  const operatorFeedHeadNode = document.getElementById("operator-feed-head");
  const decisionRailNode = document.getElementById("decision-rail");
  const dashboardGridNode = document.getElementById("dashboard-grid");
  const playbookNode = document.getElementById("playbook");
  const playbookStatusNode = document.getElementById("playbook-status");
  const playbookRiskNode = document.getElementById("playbook-risk");
  const playbookNextNode = document.getElementById("playbook-next");
  const playbookStatusStack = document.getElementById("playbook-status-stack");
  const playbookRiskStack = document.getElementById("playbook-risk-stack");
  const playbookNextStack = document.getElementById("playbook-next-stack");
  const playbookStatusTitle = document.getElementById("playbook-status-title");
  const playbookStatusSub = document.getElementById("playbook-status-sub");
  const playbookRiskTitle = document.getElementById("playbook-risk-title");
  const playbookRiskSub = document.getElementById("playbook-risk-sub");
  const playbookNextTitle = document.getElementById("playbook-next-title");
  const playbookNextSub = document.getElementById("playbook-next-sub");

  if (dashboardPanel) {
    dashboardPanel.dataset.dashboardLens = lens;
  }

  setDashboardHero(lensCopy);
  renderHeroPanel(buildHeroPanelItems(lens, analysis, overviewVisible ? allCampaigns : lensCampaigns));
  renderStats(isEmptyLensState ? [] : getDashboardStatsForLens(lens, overviewVisible ? allCampaigns : lensCampaigns, factor));
  renderMetaBudgetVisualization(getGeneralSpendDistributionModel(allCampaigns), false);
  renderOverviewGrid(backendOverviewCards || buildOverviewCards(allCampaigns, factor), overviewVisible);
  renderOverviewSpendSplit(getGeneralSpendDistributionModel(allCampaigns), overviewVisible);
  renderTrendDeck(isEmptyLensState ? [] : (backendTrendCards || buildTrendCards(overviewVisible ? allCampaigns : lensCampaigns, lens, factor)));
  if (isEmptyLensState) {
    const emptyState = getLensEmptyStateCopy(lens);
    renderExecutiveBrief({
      kicker: getDashboardDateLabel(),
      headline: emptyState.headline,
      body: emptyState.body,
      points: [
        {
          label: "Current scope",
          value: "0 campaigns",
          meta: "Nothing is available to rank in this lens."
        },
        {
          label: "Date range",
          value: getDashboardDateLabel(),
          meta: "The current filter returned no campaigns in this track."
        },
        {
          label: "Next step",
          value: "Review scope",
          meta: emptyState.nextStep
        }
      ]
    });
    renderPressureGrid([]);
  } else {
    renderExecutiveBrief(analysis.executiveBrief);
    renderPressureGrid(analysis.pressureGroups);
  }
  renderMetaQualityPanel(buildMetaQualityCards());
  const actionCardLimit = lens === "awareness" || lens === "leads" ? 3 : 4;
  renderDecisionBoard(isEmptyLensState ? [] : (analysis.cards || []).slice(0, actionCardLimit));
  const pulseLimit = lens === "awareness" || lens === "leads" ? 2 : 3;
  renderCampaignPulse(isEmptyLensState ? [] : (analysis.pulseRows || []).slice(0, pulseLimit));
  renderCardList("pattern-list", isEmptyLensState ? [] : analysis.signals, "pattern-item");
  renderCampaignTable(isEmptyLensState ? [] : analysis.tableCampaigns, lens, {
    incrementalityFactor: factor,
    currency: appState.metaCurrency || "EUR"
  });

  if (playbookNode) {
    playbookNode.hidden = false;
    playbookNode.dataset.layout = lens;
  }
  if (playbookStatusNode) {
    playbookStatusNode.hidden = false;
  }
  if (playbookRiskNode) {
    playbookRiskNode.hidden = true;
  }
  if (playbookNextNode) {
    playbookNextNode.hidden = overviewVisible || isEmptyLensState;
  }
  const hasActionCards = Array.isArray(analysis.cards) && analysis.cards.length > 0;
  const hasPressureGroups = Array.isArray(analysis.pressureGroups) && analysis.pressureGroups.length > 0;
  if (statsGridNode) {
    statsGridNode.hidden = isEmptyLensState;
  }
  if (decisionBoardNode) {
    decisionBoardNode.hidden = isEmptyLensState || !hasActionCards;
  }
  if (actionBoardHeadNode) {
    actionBoardHeadNode.hidden = isEmptyLensState || !hasActionCards;
  }
  if (executiveNode) {
    executiveNode.hidden = lens === "general" || overviewVisible || isEmptyLensState;
  }
  if (pressureCardNode) {
    pressureCardNode.hidden = isEmptyLensState || !hasPressureGroups;
  }
  if (pulseNode) {
    pulseNode.hidden = overviewVisible || isEmptyLensState;
  }
  if (operatorFeedHeadNode) {
    operatorFeedHeadNode.hidden = overviewVisible || isEmptyLensState;
  }
  if (decisionRailNode) {
    decisionRailNode.hidden = overviewVisible || isEmptyLensState;
  }
  if (dashboardGridNode) {
    dashboardGridNode.hidden = overviewVisible || isEmptyLensState;
  }
  if (signalsNode) {
    signalsNode.hidden = true;
  }

  const setPlaybookCopy = (copy = {}) => {
    if (playbookStatusTitle) playbookStatusTitle.textContent = copy.statusTitle || "Current position";
    if (playbookStatusSub) playbookStatusSub.textContent = copy.statusSub || "Where the lens stands right now.";
    if (playbookRiskTitle) playbookRiskTitle.textContent = copy.riskTitle || "What needs attention";
    if (playbookRiskSub) playbookRiskSub.textContent = copy.riskSub || "Scale, protect, fix or trim without noise.";
    if (playbookNextTitle) playbookNextTitle.textContent = copy.nextTitle || "Priority queue";
    if (playbookNextSub) playbookNextSub.textContent = copy.nextSub || "Fast reads for the next budget, creative and hygiene moves.";
  };

  const copyMap = {
    general: {
      statusTitle: "General performance overview",
      statusSub: "Key KPIs first, then diagnostics, trends, spend mix and lens detail.",
      riskTitle: "Quick insight & performers",
      riskSub: "What changed most and which campaigns stand out right now.",
      nextTitle: "Next actions",
      nextSub: "Highest leverage moves across the account."
    },
    awareness: {
      statusTitle: "Reach status",
      statusSub: "Reach, CPM and repetition health.",
      riskTitle: "Fatigue & cost pressure",
      riskSub: "Where reach is getting expensive or repetitive.",
      nextTitle: "Next awareness moves",
      nextSub: "Scale, protect or trim awareness delivery."
    },
    leads: {
      statusTitle: "Lead flow",
      statusSub: "Lead volume and CPL health.",
      riskTitle: "Lead leakage",
      riskSub: "Where CPL or volume is breaking.",
      nextTitle: "Next lead moves",
      nextSub: "Scale, fix or test lead acquisition."
    },
    conversion_standard: {
      statusTitle: "Revenue health",
      statusSub: "ROAS and CPA clarity for standard attribution.",
      riskTitle: "Efficiency pressure",
      riskSub: "Where spend is leaking margin.",
      nextTitle: "Next conversion moves",
      nextSub: "Scale, protect or fix standard conversion."
    },
    conversion_incremental: {
      statusTitle: "Incremental health",
      statusSub: "Separated incremental performance only.",
      riskTitle: "Incremental pressure",
      riskSub: "Where uplift is weakest or unstable.",
      nextTitle: "Next incremental moves",
      nextSub: "Priority actions inside incremental campaigns."
    }
  };
  setPlaybookCopy(copyMap[lens] || copyMap.general);

  const moveToStack = (stack, nodes) => {
    if (!stack) return;
    nodes.filter(Boolean).forEach((node) => {
      if (node.parentElement !== stack) {
        stack.appendChild(node);
      }
    });
  };

  if (overviewVisible) {
    if (overviewGridNode) overviewGridNode.hidden = false;
    if (statsGridNode) statsGridNode.hidden = isEmptyLensState;
    if (trendDeckNode) trendDeckNode.hidden = isEmptyLensState;
    moveToStack(playbookStatusStack, [statsGridNode, trendDeckNode, overviewGridNode]);
  } else {
    if (overviewGridNode) overviewGridNode.hidden = true;
    if (statsGridNode) statsGridNode.hidden = isEmptyLensState;
    if (trendDeckNode) trendDeckNode.hidden = isEmptyLensState;
    moveToStack(playbookStatusStack, isEmptyLensState ? [executiveNode] : [statsGridNode, trendDeckNode]);
  }

  moveToStack(
    playbookRiskStack,
    overviewVisible
      ? []
      : isEmptyLensState
        ? []
        : [executiveNode, actionBoardHeadNode, decisionBoardNode]
  );
  moveToStack(
    playbookNextStack,
    isEmptyLensState ? [] : [operatorFeedHeadNode, decisionRailNode, dashboardGridNode]
  );

  const pulseTitle = document.getElementById("dashboard-pulse-title");
  if (pulseTitle) {
    pulseTitle.textContent = lens === "general"
      ? "Campaign pulse"
      : lens === "awareness"
      ? "Campaign pulse"
      : lens === "leads"
        ? "Lead ranking"
      : lens === "conversion_incremental"
        ? "Incremental ranking"
        : "Conversion ranking";
  }

  const incrementalControls = document.getElementById("incremental-controls");
  if (incrementalControls) {
    incrementalControls.hidden = true;
  }

  const agentHint = document.getElementById("dashboard-agent-hint");
  if (agentHint) {
    agentHint.textContent = lens === "general"
      ? "Ask AI to compare the four lenses without mixing their metrics."
      : lens === "awareness"
      ? "Ask AI to prioritise awareness scaling, fatigue risk and CPM pressure."
      : lens === "leads"
        ? "Ask AI to sharpen lead volume, CPL pressure and the next budget move."
      : lens === "conversion_incremental"
        ? "Ask AI to prioritise the clearest next action inside the incremental campaign set."
        : "Ask AI to sharpen the next budget, creative and efficiency decisions."
  }

  // Reset agent UI if lens changed.
  const agentLensKey = lens;
  if (appState.dashboardAgentLastLens !== agentLensKey) {
    appState.dashboardAgentItems = [];
    appState.dashboardAgentLastLens = agentLensKey;
    renderDashboardAgentList([]);
    setDashboardAgentStatus("");
  }
}

function buildAgentPayload(lens, analysis) {
  const kpiGuidelines = buildKpiGuidelines(appState.campaigns || []);
  return {
    lens,
    executiveBrief: analysis.executiveBrief,
    decisionBoard: analysis.cards,
    pressureGroups: analysis.pressureGroups,
    signals: analysis.signals,
    campaigns: analysis.tableCampaigns,
    stats: appState.stats,
    kpiGuidelines
  };
}

function median(values = []) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildKpiGuidelines(campaigns = []) {
  const buckets = splitByCategory(campaigns);
  const conversions = splitConversionByAttribution(buckets.conversion);

  const awarenessCpms = buckets.awareness.map((item) => toFiniteNumber(item.cpm_value));
  const awarenessFreq = buckets.awareness.map((item) => toFiniteNumber(item.frequency_value));
  const leadsCpl = buckets.leads.map((item) => toFiniteNumber(item.cpl_value));
  const stdRoas = conversions.standard.map((item) => toFiniteNumber(item.roas_value));
  const stdCpa = conversions.standard.map((item) => toFiniteNumber(item.cpa_value));
  const incRoas = conversions.incremental.map((item) => toFiniteNumber(item.roas_value));
  const incCpa = conversions.incremental.map((item) => toFiniteNumber(item.cpa_value));

  const awarenessCpmMedian = median(awarenessCpms);
  const awarenessFreqMedian = median(awarenessFreq);
  const leadsCplMedian = median(leadsCpl);
  const stdRoasMedian = median(stdRoas);
  const stdCpaMedian = median(stdCpa);
  const incRoasMedian = median(incRoas);
  const incCpaMedian = median(incCpa);

  return {
    awareness: {
      cpm_max: awarenessCpmMedian ? awarenessCpmMedian * 1.25 : null,
      frequency_max: awarenessFreqMedian ? awarenessFreqMedian * 1.15 : null
    },
    leads: {
      cpl_max: leadsCplMedian ? leadsCplMedian * 1.25 : null
    },
    conversion_standard: {
      roas_min: stdRoasMedian ? stdRoasMedian * 0.8 : null,
      cpa_max: stdCpaMedian ? stdCpaMedian * 1.2 : null
    },
    conversion_incremental: {
      roas_min: incRoasMedian ? incRoasMedian * 0.8 : null,
      cpa_max: incCpaMedian ? incCpaMedian * 1.2 : null
    }
  };
}

function getInitialPreview(campaignData, adData, liveSnapshot, aiSnapshot) {
  const duplicateFormat = getInputValue("dup-ad-format") || "Single image";
  const destinationUrl = getInputValue("dup-destination-url") || "https://www.westpack.com/";

  if (aiSnapshot) {
    return {
      source: aiSnapshot.source,
      sourceId: adData[0]?.id || "",
      targetCampaign: aiSnapshot.targetCampaign,
      targetCampaignId: campaignData.find((campaign) => campaign.name === aiSnapshot.targetCampaign)?.id || "",
      targetAdSet: getAdSetOptions(aiSnapshot.targetCampaign, "", appState.adSets)[0]?.name,
      targetAdSetId: getAdSetOptions(aiSnapshot.targetCampaign, "", appState.adSets)[0]?.id || "",
      targetLanguage: aiSnapshot.targetLanguage,
      adFormat: aiSnapshot.adFormat || duplicateFormat,
      destinationUrl,
      creativeAssets: [],
      primaryText: aiSnapshot.primaryText,
      headline: aiSnapshot.headline,
      description: aiSnapshot.description,
      rationale: `${aiSnapshot.rationale} AI preview generated: ${aiSnapshot.generatedAt}.`,
      translatedAttachments: aiSnapshot.translatedAttachments || []
    };
  }

  if (liveSnapshot) {
    return {
      ...previewTemplate,
      source: adData[0]?.name || previewTemplate.source,
      sourceId: adData[0]?.id || "",
      targetCampaign: campaignData[0]?.name || previewTemplate.targetCampaign,
      targetCampaignId: campaignData[0]?.id || "",
      targetAdSet: getAdSetOptions(campaignData[0]?.name, campaignData[0]?.id, appState.adSets)[0]?.name,
      targetAdSetId: getAdSetOptions(campaignData[0]?.name, campaignData[0]?.id, appState.adSets)[0]?.id || "",
      adFormat: appState.currentPreview?.adFormat || duplicateFormat,
      destinationUrl,
      creativeAssets: [],
      rationale: `${previewTemplate.rationale} Live Meta snapshot loaded: ${liveSnapshot.generatedAt}.`
    };
  }

  return {
    ...previewTemplate,
    sourceId: adData[0]?.id || "",
    targetCampaignId: campaignData[0]?.id || "",
    targetAdSet: getAdSetOptions(campaignData[0]?.name, campaignData[0]?.id, appState.adSets)[0]?.name,
    targetAdSetId: getAdSetOptions(campaignData[0]?.name, campaignData[0]?.id, appState.adSets)[0]?.id || "",
    adFormat: appState.currentPreview?.adFormat || duplicateFormat,
    destinationUrl,
    creativeAssets: []
  };
}

function initializeApp() {
  loadDashboardPreferences();
  loadFlowSuggestionPreferences();
  hydrateCampaignAssetLibrary();
  const liveSnapshot = loadLiveMetaSnapshot();
  const aiSnapshot = loadAiPreviewSnapshot();
  const klaviyoSnapshot = loadLiveKlaviyoSnapshot();
  const campaignData = liveSnapshot?.campaigns?.length ? liveSnapshot.campaigns : campaigns;
  const adSetData = liveSnapshot?.adSets?.length ? liveSnapshot.adSets : adSets;
  const adData = liveSnapshot?.ads?.length ? liveSnapshot.ads : ads;
  const statData = liveSnapshot?.stats?.length ? liveSnapshot.stats : stats;
  applySnapshotScope(liveSnapshot?.scope || { label: "Last 7 days", shortLabel: "Last 7 days" });

  if (klaviyoSnapshot) {
    applyKlaviyoSnapshot(klaviyoSnapshot, "snapshot");
    appState.klaviyoLiveAttempted = true;
    updateKlaviyoRefreshStatus(
      appState.klaviyoGeneratedAt ? `Snapshot ${formatKlaviyoDate(appState.klaviyoGeneratedAt)}` : "Snapshot loaded",
      "online"
    );
    loadKlaviyoAiInsights({ force: true });
  }

  renderCoreData(campaignData, adData, statData, adSetData, liveSnapshot?.dashboard || null, liveSnapshot?.account || null);
  appState.metaStudioCatalogGeneratedAt = String(liveSnapshot?.generatedAt || "");
  if (liveSnapshot) {
    writeMetaStudioSnapshot(buildStudioCatalogSnapshot(liveSnapshot));
  }
  syncDashboardControls();
  configureDashboardAutoRefresh();
  setSyncStatus(`Range: ${appState.dashboardDateLabel} · ${buildMetaQualityLabel()}`, getMetaTrustStatusTone());

  const initialPreview = getInitialPreview(campaignData, adData, liveSnapshot, aiSnapshot);
  const initialVariants = aiSnapshot?.variants?.length ? aiSnapshot.variants : buildVariantSet(initialPreview);
  setCurrentOutput(initialPreview, initialVariants);

  renderIntegrations(getIntegrationCards(integrationConfig));
  renderSettings({
    meta: getMetaSettingsSummary(integrationConfig),
    openAi: integrationConfig.openAi,
    promptCards: getPromptCards(promptRecipe)
  });
  refreshMetaConnectionStatus({ silent: true });
  renderKlaviyoWorkspace();
  loadKlaviyoLiveData();
  setKlaviyoView(appState.klaviyoView);
  setWorkspace(appState.workspace);
  setStudioMode(appState.mode);
  syncStudioChrome();
  setStudioStatus("Ready.");

  if (appState.metaDataMode === "live") {
    refreshMetaData({ silent: true, reason: "Syncing Meta data" });
  }

  loadMetaStudioCatalog({ silent: true });
}

function refreshModeAdSets(mode) {
  const ids = getModeIds(mode);
  const campaignName = getSelectedLabel(ids.targetCampaign);
  const campaignId = getInputValue(ids.targetCampaign);
  const nextAdSets = getAdSetOptions(campaignName, campaignId, appState.adSets);
  renderAdSetSelector(nextAdSets, mode);
  const adSetSelect = document.getElementById(ids.targetAdSet);
  if (adSetSelect && nextAdSets[0]?.id) {
    adSetSelect.value = nextAdSets[0].id;
  }
  syncActionAvailability();
}

async function refreshMetaData(options = {}) {
  if (dashboardRefreshPromise) {
    return dashboardRefreshPromise;
  }

  const silent = options.silent === true;
  const forceLive = options.forceLive === true;
  const forceRefresh = options.force === true || forceLive;
  const reasonLabel = options.reason || "Refreshing";
  const snapshotOptions = getDashboardSnapshotOptions();
  const cachedEntry = readMetaSnapshotCache(snapshotOptions);
  const bundledSnapshot = loadLiveMetaSnapshot();
  const cooldownActive = metaLastSuccessfulRefreshAt > 0 && (Date.now() - metaLastSuccessfulRefreshAt) < META_REFRESH_COOLDOWN_MS;

  if (appState.metaDataMode === "snapshot" && !forceLive) {
    const snapshot = cachedEntry?.snapshot || bundledSnapshot;
    if (snapshot) {
      setMetaSnapshotMeta({
        mode: "snapshot",
        modeLabel: "Snapshot mode",
        source: cachedEntry?.snapshot ? "cache" : "bundled",
        sourceLabel: cachedEntry?.snapshot ? "Snapshot cache" : "Bundled snapshot",
        generatedAt: snapshot.generatedAt || "",
        cachedAt: cachedEntry?.cachedAt || ""
      });
      applySnapshotScope(snapshot.scope || {});
      renderCoreData(
        snapshot.campaigns || [],
        snapshot.ads || [],
        snapshot.stats || [],
        snapshot.adSets || [],
        snapshot.dashboard || null,
        snapshot.account || null
      );
      setSyncStatus(`${buildMetaQualityLabel()} · ${appState.dashboardDateLabel}`, getMetaTrustStatusTone());
      if (!silent) {
        setStudioStatus("Using saved Meta snapshot.", "success");
      }
      return snapshot;
    }
  }

  if (!forceRefresh && cooldownActive && cachedEntry?.snapshot) {
    const snapshot = cachedEntry.snapshot;
    setMetaSnapshotMeta({
      mode: "live",
      modeLabel: "Live mode",
      source: "recent-cache",
      sourceLabel: "Recent cache",
      generatedAt: snapshot.generatedAt || "",
      cachedAt: cachedEntry.cachedAt || ""
    });
    applySnapshotScope(snapshot.scope || {});
    renderCoreData(
      snapshot.campaigns || [],
      snapshot.ads || [],
      snapshot.stats || [],
      snapshot.adSets || [],
      snapshot.dashboard || null,
      snapshot.account || null
    );
    setSyncStatus(`${buildMetaQualityLabel()} · ${appState.dashboardDateLabel}`, getMetaTrustStatusTone());
    return snapshot;
  }

  if (!silent) {
    setStudioStatus("Refreshing Meta data...", "loading");
  }
  setSyncStatus(`${reasonLabel}...`, "loading");

  const refreshButton = document.getElementById("refresh-data-button");
  if (refreshButton && !silent) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
  }

  dashboardRefreshPromise = (async () => {
    try {
      const snapshot = await requestMetaSnapshot({
        ...snapshotOptions,
        force: forceRefresh
      });
      setMetaSnapshotMeta({
        mode: appState.metaDataMode === "snapshot" && !forceLive ? "snapshot" : "live",
        modeLabel: appState.metaDataMode === "snapshot" && !forceLive ? "Snapshot mode" : "Live mode",
        source: snapshot?.cache?.status === "fallback" ? "fallback" : "meta-live-api",
        sourceLabel: snapshot?.cache?.status === "fallback" ? "Fallback snapshot" : "Meta live API",
        generatedAt: snapshot.generatedAt || "",
        cachedAt: snapshot?.cache?.cachedAt || ""
      });
      applySnapshotScope(snapshot.scope || {});
      renderCoreData(
        snapshot.campaigns || [],
        snapshot.ads || [],
        snapshot.stats || [],
        snapshot.adSets || [],
        snapshot.dashboard || null,
        snapshot.account || null
      );
      writeMetaSnapshotCache(snapshotOptions, snapshot);
      writeMetaStudioSnapshot(buildStudioCatalogSnapshot(snapshot));
      metaLastSuccessfulRefreshAt = Date.now();
      const ids = getModeIds();
      const refreshedPreview = {
        ...(appState.currentPreview || previewTemplate),
        source: appState.mode === "duplicate"
          ? (getSelectedLabel("dup-source-ad") || snapshot.ads?.[0]?.name || previewTemplate.source)
          : (getInputValue("new-ad-name") || "New ad concept"),
        sourceId: appState.mode === "duplicate" ? (getInputValue("dup-source-ad") || snapshot.ads?.[0]?.id || "") : "",
        targetCampaign: getSelectedLabel(ids.targetCampaign) || snapshot.campaigns?.[0]?.name || previewTemplate.targetCampaign,
        targetCampaignId: getInputValue(ids.targetCampaign) || snapshot.campaigns?.[0]?.id || "",
        targetAdSet: getSelectedLabel(ids.targetAdSet),
        targetAdSetId: getInputValue(ids.targetAdSet),
        adFormat: getInputValue(ids.adFormat) || appState.currentPreview?.adFormat || "Single image",
        destinationUrl: getInputValue(ids.destinationUrl) || appState.currentPreview?.destinationUrl || "https://www.westpack.com/"
      };

      const refreshedVariants = appState.currentVariants?.length ? appState.currentVariants : buildVariantSet(refreshedPreview);
      setCurrentOutput(refreshedPreview, refreshedVariants);
      appState.metaStudioCatalogGeneratedAt = snapshot.generatedAt || new Date().toISOString();
      if (!silent) {
        setStudioStatus(`Meta data refreshed. ${snapshot.campaigns?.length || 0} campaigns loaded.`, "success");
      }
      setSyncStatus(
        snapshot?.cache?.status === "fallback"
          ? `Using last verified snapshot - ${appState.dashboardDateLabel} · ${buildMetaQualityLabel()}`
          : `Data refreshed - ${appState.dashboardDateLabel} · ${buildMetaQualityLabel()}`,
        getMetaTrustStatusTone()
      );
      refreshMetaConnectionStatus({ silent: true });
      return snapshot;
    } catch (error) {
      refreshMetaConnectionStatus({ silent: true });
      if (cachedEntry?.snapshot && isMetaRateLimitMessage(error.message)) {
        const snapshot = cachedEntry.snapshot;
        setMetaSnapshotMeta({
          mode: appState.metaDataMode === "snapshot" && !forceLive ? "snapshot" : "live",
          modeLabel: appState.metaDataMode === "snapshot" && !forceLive ? "Snapshot mode" : "Live mode",
          source: "fallback-cache",
          sourceLabel: "Fallback cache",
          generatedAt: snapshot.generatedAt || "",
          cachedAt: cachedEntry.cachedAt || ""
        });
        applySnapshotScope(snapshot.scope || {});
        renderCoreData(
          snapshot.campaigns || [],
          snapshot.ads || [],
          snapshot.stats || [],
          snapshot.adSets || [],
          snapshot.dashboard || null,
          snapshot.account || null
        );
        if (!silent) {
          setStudioStatus("Meta rate limited. Using last verified snapshot.", "warning");
        }
        setSyncStatus(`${buildMetaQualityLabel()} · ${appState.dashboardDateLabel}`, getMetaTrustStatusTone());
        return snapshot;
      }
      if (!silent) {
        setStudioStatus(error.message, "warning");
      }
      setSyncStatus(error.message, "warning");
      return null;
    } finally {
      if (refreshButton && !silent) {
        refreshButton.disabled = false;
      }
      syncDashboardControls();
      dashboardRefreshPromise = null;
    }
  })();

  return dashboardRefreshPromise;
}

async function loadMetaStudioCatalog(options = {}) {
  if (metaStudioCatalogPromise) {
    return metaStudioCatalogPromise;
  }

  const force = options.force === true;
  const forceLive = options.forceLive === true;
  const silent = options.silent === true;
  const recentCatalog = appState.metaStudioCatalogGeneratedAt
    ? (Date.now() - new Date(appState.metaStudioCatalogGeneratedAt).getTime()) < META_STUDIO_CATALOG_COOLDOWN_MS
    : false;
  const storedStudioSnapshot = readMetaStudioSnapshot();
  const bundledSnapshot = loadLiveMetaSnapshot();

  if (appState.metaDataMode === "snapshot" && !forceLive) {
    const snapshotCatalog = storedStudioSnapshot
      || (bundledSnapshot ? buildStudioCatalogSnapshot(bundledSnapshot) : null);
    if (snapshotCatalog) {
      applyMetaStudioCatalog(snapshotCatalog);
      if (!silent) {
        setStudioStatus("Using saved studio snapshot.", "success");
      }
      return snapshotCatalog;
    }

    const inMemorySnapshotCatalog = buildStudioCatalogSnapshot({
      generatedAt: appState.metaStudioCatalogGeneratedAt || new Date().toISOString(),
      account: appState.account || null,
      campaigns: appState.campaigns || [],
      adSets: appState.adSets || [],
      ads: appState.ads || []
    });
    applyMetaStudioCatalog(inMemorySnapshotCatalog);
    if (!silent) {
      setStudioStatus("Using current in-memory studio snapshot.", "success");
    }
    return inMemorySnapshotCatalog;
  }

  if (!force && recentCatalog && appState.ads?.length && appState.adSets?.length && appState.campaigns?.length) {
    return {
      generatedAt: appState.metaStudioCatalogGeneratedAt,
      campaigns: appState.campaigns,
      adSets: appState.adSets,
      ads: appState.ads
    };
  }

  if (!silent) {
    setStudioStatus("Loading live ad catalog...", "loading");
  }

  metaStudioCatalogPromise = (async () => {
    try {
      const catalog = await requestMetaStudioCatalog({ force });
      applyMetaStudioCatalog(catalog);
      writeMetaStudioSnapshot(buildStudioCatalogSnapshot(catalog));
      if (!silent) {
        setStudioStatus(`Ad catalog ready. ${catalog.ads?.length || 0} ads loaded.`, "success");
      }
      return catalog;
    } catch (error) {
      if (isMetaRateLimitMessage(error.message) && storedStudioSnapshot) {
        applyMetaStudioCatalog(storedStudioSnapshot);
        if (!silent) {
          setStudioStatus("Meta rate limited. Using last saved catalog.", "warning");
        }
        return storedStudioSnapshot;
      }
      if (!silent) {
        setStudioStatus(error.message || "Meta studio catalog refresh failed.", "warning");
      }
      return null;
    } finally {
      metaStudioCatalogPromise = null;
    }
  })();

  return metaStudioCatalogPromise;
}

async function refreshMetaWorkspaceData(options = {}) {
  const force = options.force === true;
  const forceLive = options.forceLive === true;
  const silent = options.silent === true;
  return loadMetaStudioCatalog({
    force,
    forceLive,
    silent
  });
}

async function generateAiPreview(mode = appState.mode, options = {}) {
  return generateAiPreviewAction({
    appState,
    buildGenerationRequest,
    buildPreviewPayload,
    buildVariantSet,
    clearDuplicateBatchPreviews,
    cloneDuplicateTarget,
    ensureDuplicateTargetPersisted,
    getCurrentFormSignature,
    getDuplicateBatchEntry,
    getDuplicateGeneratedPreviewCount,
    getDuplicatePublishTargets,
    getDuplicateTargetKey,
    getModeIds,
    integrationConfig,
    mode,
    options,
    requestAiPreview,
    setButtonBusy,
    setCurrentOutput,
    setCreateStep,
    setDuplicateActivePreview,
    setDuplicateStep,
    setDuplicateSummaryButtonsBusy,
    setPreviewLoading,
    setStudioMode,
    setStudioStatus,
    upsertDuplicateBatchEntry
  });
}

function saveDraftPreview(mode = appState.mode) {
  appState.mode = mode;
  setStudioMode(mode);
  const preview = createDraftEntry(buildPreviewPayload({ ads: appState.ads, integrationConfig, mode }));
  const variants = buildVariantSet(preview);
  setCurrentOutput(preview, variants);
  setStudioStatus("Draft saved locally.", "success");
}

function useNextVariant() {
  if (!appState.currentPreview || !appState.currentVariants.length) {
    setStudioStatus("Generate a preview first.", "warning");
    return;
  }

  appState.currentVariantIndex = (appState.currentVariantIndex + 1) % appState.currentVariants.length;
  const nextVariant = appState.currentVariants[appState.currentVariantIndex];
  const nextPreview = {
    ...appState.currentPreview,
    primaryText: nextVariant.body,
    headline: nextVariant.headline,
    rationale: nextVariant.angle
  };

  appState.currentPreview = nextPreview;
  if (appState.mode === "duplicate" && appState.duplicateActivePreviewKey) {
    upsertDuplicateBatchEntry({
      key: appState.duplicateActivePreviewKey,
      preview: nextPreview,
      variants: appState.currentVariants
    });
  }
  renderPreview(nextPreview);
  renderCurrentPreviewPayload();
  setStudioStatus(`Using ${nextVariant.title.toLowerCase()}.`, "success");
}

async function pushToMeta(mode = appState.mode) {
  return pushToMetaAction({
    appState,
    buildMetaPublishPayload,
    clearValidation,
    formatMetaConnectionMessage,
    getCreateUploadedFilesPayload,
    getDuplicateBatchEntry,
    getDuplicateCreativeOverride,
    getDuplicatePublishTargets,
    getDuplicateTargetKey,
    getInputValue,
    getModeIds,
    isMetaRateLimitMessage,
    mode,
    refreshMetaConnectionStatus,
    requestMetaPublish,
    setButtonBusy,
    setDuplicateSummaryButtonsBusy,
    setStudioMode,
    setStudioStatus,
    setSyncStatus,
    syncActionAvailability,
    updateMetaStatusPill,
    uploadCreateCarouselVariantsToMeta,
    uploadCreateImageVariantsToMeta,
    uploadCreateVideoVariantsToMeta,
    uploadDuplicateCarouselVariantsToMeta,
    uploadDuplicateVideoVariantsToMeta,
    validateBeforePush,
    wait
  });
}

function attachSharedFieldEvents(mode) {
  const ids = getModeIds(mode);
  const handleDuplicateTargetSelectionChange = () => {
    if (mode !== "duplicate") return;
    focusDuplicateTargetEditor();
  };

  document.getElementById(ids.targetCampaign)?.addEventListener("change", () => {
    refreshModeAdSets(mode);
    handleDuplicateTargetSelectionChange();
    markPreviewDirty("Target campaign changed. Generate preview again.");
  });

  document.getElementById(ids.targetAdSet)?.addEventListener("change", () => {
    handleDuplicateTargetSelectionChange();
    markPreviewDirty("Target ad set changed. Generate preview again.");
  });

  document.getElementById(ids.adFormat)?.addEventListener("change", () => {
    if (mode === "duplicate") {
      renderDuplicateCreativeOverridePanel();
    }
    markPreviewDirty("Ad format changed. Generate preview again.");
  });

  document.getElementById(ids.targetLanguage)?.addEventListener("change", () => {
    if (mode === "duplicate") {
      syncDuplicateTargetLanguageFields(getInputValue(ids.targetLanguage), ids.targetLanguage);
    }
    handleDuplicateTargetSelectionChange();
    markPreviewDirty("Target language changed. Generate preview again.");
  });

  if (mode === "duplicate") {
    document.getElementById("dup-bulk-target-language")?.addEventListener("change", () => {
      syncDuplicateTargetLanguageFields(getInputValue("dup-bulk-target-language"), "dup-bulk-target-language");
      handleDuplicateTargetSelectionChange();
      markPreviewDirty("Target language changed. Generate preview again.");
    });
  }

  document.getElementById(ids.destinationUrl)?.addEventListener("input", () => {
    if (mode === "duplicate") {
      syncDuplicateTargetBuilderState();
    }
    markPreviewDirty("Destination URL changed. Generate preview again.");
  });

  document.getElementById(ids.brief)?.addEventListener("input", () => {
    markPreviewDirty("Operator notes changed. Generate preview again.");
  });
}

function attachKlaviyoTemplateEvents() {
  attachKlaviyoTemplateEventsModule({
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
    isAttached: () => klaviyoTemplateEventsAttached,
    markAttached: () => {
      klaviyoTemplateEventsAttached = true;
    }
  });
}

function attachEvents() {
  wirePreviewEditing();
  attachKlaviyoTemplateEvents();

  if (typeof window !== "undefined") {
    window.__westpackForcePushCreate = async () => {
      setStudioStatus("Push button clicked. Checking Meta payload...", "loading");
      await pushToMeta("create");
    };
    window.__westpackForcePushDuplicate = async () => {
      setStudioStatus("Push button clicked. Checking Meta payload...", "loading");
      await pushToMeta("duplicate");
    };
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;

    if (button.id === "push-create-button") {
      event.preventDefault();
      event.stopPropagation();
      setStudioStatus("Push button clicked. Checking Meta payload...", "loading");
      await pushToMeta("create");
      return;
    }

    if (button.id === "push-duplicate-button") {
      event.preventDefault();
      event.stopPropagation();
      setStudioStatus("Push button clicked. Checking Meta payload...", "loading");
      await pushToMeta("duplicate");
    }
  }, true);

  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.addEventListener("click", () => {
      setWorkspace(button.dataset.workspace);
    });
  });

  document.querySelectorAll("[data-klaviyo-view]").forEach((button) => {
    button.addEventListener("click", () => {
      setKlaviyoView(button.dataset.klaviyoView);
    });
  });

  document.querySelectorAll(".klaviyo-dashboard-subtab").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.klaviyoDashboardTab;
      if (!nextTab || button.hidden || button.disabled) return;
      appState.klaviyoDashboardTab = nextTab;
      syncKlaviyoDashboardSubtabs();
    });
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
      syncDashboardControls();
      if (button.dataset.tab === "studio") {
        refreshMetaWorkspaceData();
      }
    });
  });

  document.getElementById("klaviyo-range")?.addEventListener("change", (event) => {
    appState.klaviyoRangeDays = Number(event.target.value) || 30;
    renderKlaviyoWorkspace();
    loadKlaviyoLiveData({ force: true });
  });

  document.getElementById("klaviyo-search")?.addEventListener("input", (event) => {
    appState.klaviyoSearch = event.target.value || "";
    appState.klaviyoCampaignFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-sort")?.addEventListener("change", (event) => {
    appState.klaviyoSort = event.target.value || "last_sent";
    appState.klaviyoCampaignFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-flow-search")?.addEventListener("input", (event) => {
    appState.klaviyoFlowSearch = event.target.value || "";
    appState.klaviyoFlowFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-flow-sort")?.addEventListener("change", (event) => {
    appState.klaviyoFlowSort = event.target.value || "last_sent";
    appState.klaviyoFlowFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-flow-category")?.addEventListener("change", (event) => {
    appState.klaviyoFlowCategory = event.target.value || "all";
    appState.klaviyoFlowFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-subscriber-market")?.addEventListener("change", (event) => {
    appState.klaviyoSubscriberMarket = event.target.value || "total";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-subscriber-mode")?.addEventListener("change", (event) => {
    appState.klaviyoSubscriberMode = event.target.value || "cumulative";
    if (appState.klaviyoSubscriberMode === "snapshot") {
      appState.klaviyoSubscriberRange = 180;
    }
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-subscriber-range")?.addEventListener("change", (event) => {
    appState.klaviyoSubscriberRange = Number(event.target.value) || 30;
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-full-markets")?.addEventListener("change", (event) => {
    appState.klaviyoOnlyFullMarkets = Boolean(event.target.checked);
    appState.klaviyoCampaignFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-flow-full-markets")?.addEventListener("change", (event) => {
    appState.klaviyoFlowOnlyFullMarkets = Boolean(event.target.checked);
    appState.klaviyoFlowFocus = "";
    renderKlaviyoWorkspace();
  });

  document.getElementById("klaviyo-refresh-button")?.addEventListener("click", async () => {
    if (appState.klaviyoLoading) {
      updateKlaviyoRefreshStatus("Refresh already in progress", "");
      return;
    }
    updateKlaviyoRefreshStatus(`Refreshing ${appState.klaviyoMarkets.length || 0} accounts...`, "");
    try {
      const ok = await loadKlaviyoLiveData({ force: true });
      if (ok === true) {
        const label = appState.klaviyoGeneratedAt
          ? `Updated ${formatKlaviyoDate(appState.klaviyoGeneratedAt)}`
          : "Live data refreshed";
        updateKlaviyoRefreshStatus(label, "online");
      } else if (ok === "snapshot") {
        const label = appState.klaviyoGeneratedAt
          ? `Snapshot fallback ${formatKlaviyoDate(appState.klaviyoGeneratedAt)}`
          : "Snapshot fallback";
        updateKlaviyoRefreshStatus(label, "warning");
      } else if (ok === "busy") {
        updateKlaviyoRefreshStatus("Refresh already in progress", "");
      } else {
        updateKlaviyoRefreshStatus("Refresh failed", "warning");
      }
    } catch (error) {
      updateKlaviyoRefreshStatus(error.message || "Refresh failed", "warning");
    }
  });

  document.getElementById("campaign-brain-generate-button")?.addEventListener("click", async () => {
    await generateCampaignBrainPlan();
  });

  document.getElementById("campaign-brain-assemble-button")?.addEventListener("click", async () => {
    await assembleCampaignObject();
  });

  document.querySelectorAll("[data-campaign-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setCampaignStudioMode(button.getAttribute("data-campaign-mode") || "asana_combo");
    });
  });

  document.getElementById("campaign-brain-artifacts-button")?.addEventListener("click", async () => {
    await generateCampaignArtifacts();
  });

  document.getElementById("campaign-brain-push-klaviyo-button")?.addEventListener("click", async () => {
    await pushCampaignBrainEmailToKlaviyo();
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest("[data-email-builder-library-toggle]")) {
      appState.campaignEmailBuilder.libraryOpen = appState.campaignEmailBuilder.libraryOpen !== true;
      renderCampaignBrainPanel();
      return;
    }
    const builderPreview = target.closest("[data-email-builder-preview]");
    if (builderPreview) {
      const previewMode = builderPreview.getAttribute("data-email-builder-preview") || "desktop";
      appState.campaignEmailBuilder.previewMode = ["desktop", "tablet", "mobile"].includes(previewMode) ? previewMode : "desktop";
      renderCampaignBrainPanel();
      return;
    }
    const builderZoom = target.closest("[data-email-builder-zoom]");
    if (builderZoom) {
      const direction = builderZoom.getAttribute("data-email-builder-zoom");
      const current = Number(appState.campaignEmailBuilder.zoom || 100);
      appState.campaignEmailBuilder.zoom = Math.min(120, Math.max(70, current + (direction === "in" ? 10 : -10)));
      renderCampaignBrainPanel();
      return;
    }
    const builderInspectorTab = target.closest("[data-email-builder-inspector-tab]");
    if (builderInspectorTab) {
      appState.campaignEmailBuilder.inspectorTab = builderInspectorTab.getAttribute("data-email-builder-inspector-tab") || "content";
      renderCampaignBrainPanel();
      return;
    }
    const builderImageTarget = target.closest("[data-email-builder-image-target]");
    if (builderImageTarget) {
      appState.campaignEmailBuilder.imageTarget = builderImageTarget.getAttribute("data-email-builder-image-target") === "hero" ? "hero" : "module";
      renderCampaignBrainPanel();
      return;
    }
    if (target.closest("[data-email-builder-go-hero-image]")) {
      appState.campaignEmailBuilder.inspectorTab = "image";
      appState.campaignEmailBuilder.imageTarget = "hero";
      renderCampaignBrainPanel();
      return;
    }
    const builderCanvasAction = target.closest("[data-email-builder-canvas-action]");
    if (builderCanvasAction) {
      const action = builderCanvasAction.getAttribute("data-email-builder-canvas-action") || "";
      const index = Number(builderCanvasAction.getAttribute("data-email-module-index"));
      if (action === "edit-copy") {
        appState.campaignEmailBuilder.selectedIndex = index;
        appState.campaignEmailBuilder.selectionKind = "module";
        appState.campaignEmailBuilder.inlineEditing = true;
        renderCampaignBrainPanel();
      } else if (action === "save-copy") {
        saveCampaignEmailInlineCopy();
      } else if (action === "cancel-copy") {
        cancelCampaignEmailInlineCopy();
      } else if (action === "up" || action === "down") {
        moveCampaignEmailModule(index, action);
      } else if (action === "remove-image") {
        removeCampaignEmailModuleImage(index);
      } else if (action === "duplicate") {
        appState.campaignEmailBuilder.selectionKind = "module";
        duplicateCampaignEmailModule(index);
      } else if (action === "delete") {
        if (appState.campaignEmailBuilder.selectionKind === "image") {
          removeCampaignEmailModuleImage(index);
          appState.campaignEmailBuilder.selectionKind = "module";
        } else {
          removeCampaignEmailModule(index);
        }
      } else if (action === "media") {
        appState.campaignEmailBuilder.selectedIndex = index;
        appState.campaignEmailBuilder.inspectorTab = "image";
        appState.campaignEmailBuilder.imageTarget = "module";
        renderCampaignBrainPanel();
        window.requestAnimationFrame(() => document.querySelector(".campaign-email-builder-image-workflow")?.scrollIntoView({ block: "start", behavior: "smooth" }));
      }
      return;
    }
    const builderConvertImage = target.closest("[data-email-builder-convert-image]");
    if (builderConvertImage) {
      const index = Number(builderConvertImage.getAttribute("data-email-module-index"));
      replaceCampaignEmailModuleLayout(index, builderConvertImage.getAttribute("data-email-builder-convert-image") || "image_full");
      appState.campaignEmailBuilder.inspectorTab = "image";
      return;
    }
    const builderHeroAsset = target.closest("[data-email-builder-hero-asset-url]");
    if (builderHeroAsset) {
      const url = builderHeroAsset.getAttribute("data-email-builder-hero-asset-url") || "";
      await applyCampaignEmailHeroAsset({
        previewUrl: url,
        sourceUrl: builderHeroAsset.getAttribute("data-email-builder-image-source-url") || url,
        hosted: builderHeroAsset.getAttribute("data-email-builder-image-hosted") === "true",
        alt: builderHeroAsset.getAttribute("data-email-builder-image-alt") || "Campaign hero image"
      });
      return;
    }
    const builderImage = target.closest("[data-email-builder-image-url]");
    if (builderImage) {
      if (Date.now() < Number(appState.campaignEmailBuilder.suppressImageClickUntil || 0)) return;
      const index = Number(appState.campaignEmailBuilder.selectedIndex || 0);
      const url = builderImage.getAttribute("data-email-builder-image-url") || "";
      const sourceUrl = builderImage.getAttribute("data-email-builder-image-source-url") || url;
      const hosted = builderImage.getAttribute("data-email-builder-image-hosted") === "true";
      const alt = builderImage.getAttribute("data-email-builder-image-alt") || "Campaign image";
      await applyCampaignEmailBuilderAsset(index, { previewUrl: url, sourceUrl, hosted, alt });
      return;
    }
    const builderImageRemove = target.closest("[data-email-builder-image-remove]");
    if (builderImageRemove) {
      removeCampaignEmailModuleImage(builderImageRemove.getAttribute("data-email-builder-image-remove"));
      return;
    }
    const cropOpen = target.closest("[data-email-builder-crop-open]");
    if (cropOpen) {
      appState.campaignEmailBuilder.selectedIndex = Number(cropOpen.getAttribute("data-email-builder-crop-open"));
      appState.campaignEmailBuilder.cropEditorOpen = true;
      appState.campaignEmailBuilder.cropError = "";
      renderCampaignBrainPanel();
      window.requestAnimationFrame(() => document.querySelector("[data-email-builder-crop-close]")?.focus());
      return;
    }
    if (target.closest("[data-email-builder-crop-close]")) {
      appState.campaignEmailBuilder.cropEditorOpen = false;
      appState.campaignEmailBuilder.cropError = "";
      renderCampaignBrainPanel();
      window.requestAnimationFrame(() => document.querySelector(`[data-email-builder-crop-open="${appState.campaignEmailBuilder.selectedIndex}"]`)?.focus());
      return;
    }
    if (target.closest("[data-email-builder-crop-reset]")) {
      const section = appState.campaignArtifactDraft?.artifacts?.email?.sections?.[appState.campaignEmailBuilder.selectedIndex];
      if (section) { section.imageAspect = "natural"; section.imageFocalPoint = "center"; section.imageZoom = 100; }
      renderCampaignBrainPanel();
      return;
    }
    if (target.closest("[data-email-builder-crop-apply]")) {
      await applyCampaignEmailImageCrop();
      return;
    }
    const builderFocalPoint = target.closest("[data-email-builder-focal-point]");
    if (builderFocalPoint) {
      updateCampaignEmailModule(
        builderFocalPoint.getAttribute("data-email-module-index"),
        "imageFocalPoint",
        builderFocalPoint.getAttribute("data-email-builder-focal-point") || "center"
      );
      renderCampaignBrainPanel();
      return;
    }
    const builderImageReset = target.closest("[data-email-builder-image-reset]");
    if (builderImageReset) {
      const numericIndex = Number(builderImageReset.getAttribute("data-email-builder-image-reset"));
      const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections;
      if (Array.isArray(sections) && sections[numericIndex]) {
        recordCampaignEmailHistory(`image-reset:${numericIndex}`, { force: true });
        sections[numericIndex].imageAspect = "natural";
        sections[numericIndex].imageFocalPoint = "center";
        appState.campaignEmailBuilder.selectedIndex = numericIndex;
        scheduleCampaignStudioEmailCompile();
        renderCampaignBrainPanel();
      }
      return;
    }
    if (target.closest("[data-email-builder-hero-image-remove]")) {
      removeCampaignEmailHeroImage();
      return;
    }
    const builderHeroFocalPoint = target.closest("[data-email-builder-hero-focal-point]");
    if (builderHeroFocalPoint) {
      recordCampaignEmailHistory("hero-image-focal");
      updateCampaignArtifactDraftField("email.heroImageFocalPoint", builderHeroFocalPoint.getAttribute("data-email-builder-hero-focal-point") || "center");
      scheduleCampaignStudioEmailCompile();
      renderCampaignBrainPanel();
      return;
    }
    if (target.closest("[data-email-builder-hero-image-reset]")) {
      recordCampaignEmailHistory("hero-image-reset", { force: true });
      updateCampaignArtifactDraftField("email.heroImageAspect", "natural");
      updateCampaignArtifactDraftField("email.heroImageFocalPoint", "center");
      scheduleCampaignStudioEmailCompile();
      renderCampaignBrainPanel();
      return;
    }
    const builderAi = target.closest("[data-email-builder-ai]");
    if (builderAi) {
      await reviseCampaignEmailModule(builderAi.getAttribute("data-email-builder-ai-instruction") || "Strengthen this module");
      return;
    }
    if (target.closest("[data-email-builder-ai-apply]")) {
      applyCampaignEmailAiSuggestion();
      return;
    }
    if (target.closest("[data-email-builder-ai-dismiss]")) {
      appState.campaignEmailBuilder.aiSuggestion = null;
      appState.campaignEmailBuilder.aiError = "";
      renderCampaignBrainPanel();
      return;
    }
    if (target.closest("[data-email-builder-undo]")) {
      undoCampaignEmailBuilder();
      return;
    }
    if (target.closest("[data-email-builder-redo]")) {
      redoCampaignEmailBuilder();
      return;
    }
    const builderSelect = target.closest("[data-email-builder-select]");
    if (builderSelect) {
      appState.campaignEmailBuilder.selectedIndex = Number(builderSelect.getAttribute("data-email-builder-select") || 0);
      appState.campaignEmailBuilder.selectionKind = "module";
      appState.campaignEmailBuilder.inlineEditing = false;
      appState.campaignEmailBuilder.aiSuggestion = null;
      appState.campaignEmailBuilder.aiError = "";
      renderCampaignBrainPanel();
      return;
    }
    const builderAdd = target.closest("[data-email-builder-add]");
    if (builderAdd) {
      const moduleId = builderAdd.getAttribute("data-email-builder-add") || "editorial_text";
      const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections || [];
      if (sections.length >= 4) replaceCampaignEmailModuleLayout(appState.campaignEmailBuilder.selectedIndex, moduleId);
      else addCampaignEmailModuleByType(moduleId);
      return;
    }
    const builderDuplicate = target.closest("[data-email-builder-duplicate]");
    if (builderDuplicate) {
      duplicateCampaignEmailModule(builderDuplicate.getAttribute("data-email-builder-duplicate"));
      return;
    }

    if (target.closest("#campaign-email-add-module")) {
      addCampaignEmailModule();
      return;
    }
    const emailModuleMove = target.closest("[data-email-module-move]");
    if (emailModuleMove) {
      moveCampaignEmailModule(emailModuleMove.getAttribute("data-email-module-index"), emailModuleMove.getAttribute("data-email-module-move"));
      return;
    }
    const emailModuleRemove = target.closest("[data-email-module-remove]");
    if (emailModuleRemove) {
      removeCampaignEmailModule(emailModuleRemove.getAttribute("data-email-module-index"));
      return;
    }

    const agentStartButton = target.closest("[data-content-agent-start-mode]");
    if (agentStartButton) {
      await startContentAgent(agentStartButton.getAttribute("data-content-agent-start-mode") || "queue");
      return;
    }
    if (target.closest("#content-agent-direct")) {
      appState.contentAgent.directorOpen = true;
      appState.contentAgent.directorInteractionActive = false;
      renderContentAgentConsole({ force: true });
      return;
    }
    if (target.closest("#content-agent-direct-close")) {
      appState.contentAgent.directorOpen = false;
      appState.contentAgent.directorInteractionActive = false;
      renderContentAgentConsole({ force: true });
      return;
    }
    if (target.closest("#content-agent-refresh")) {
      await loadContentAgentStatus();
      return;
    }
    if (target.closest("[data-learning-toggle]")) {
      appState.contentAgent.learningOpen = !appState.contentAgent.learningOpen;
      renderContentAgentConsole({ force: true });
      return;
    }
    const learningOperation = target.closest("[data-learning-operation]");
    if (learningOperation) {
      await moderateCampaignLearning(
        learningOperation.getAttribute("data-learning-event") || "",
        learningOperation.getAttribute("data-learning-operation") || ""
      );
      return;
    }
    const agentRetryButton = target.closest("[data-content-agent-retry]");
    if (agentRetryButton) {
      await recoverContentAgentJob(agentRetryButton.getAttribute("data-content-agent-retry") || "");
      return;
    }
    const agentControlButton = target.closest("[data-content-agent-control]");
    if (agentControlButton) {
      await controlContentAgentJobFromStudio(
        agentControlButton.getAttribute("data-content-agent-job") || "",
        agentControlButton.getAttribute("data-content-agent-control") || ""
      );
      return;
    }
    const agentRejectButton = target.closest("[data-content-agent-reject]");
    if (agentRejectButton) {
      const jobId = agentRejectButton.getAttribute("data-content-agent-reject") || "";
      if (appState.contentAgent.rejectConfirmJobId !== jobId) {
        appState.contentAgent.rejectConfirmJobId = jobId;
        renderContentAgentConsole({ force: true });
        window.setTimeout(() => {
          if (appState.contentAgent.rejectConfirmJobId === jobId && !appState.contentAgent.rejectingJobId) {
            appState.contentAgent.rejectConfirmJobId = "";
            renderContentAgentConsole({ force: true });
          }
        }, 7000);
        return;
      }
      const reason = document.querySelector(`[data-content-agent-reject-reason="${CSS.escape(jobId)}"]`)?.value || "";
      await rejectAndRestartContentAgentJob(jobId, reason);
      return;
    }
    if (target.closest("#campaign-manual-workspace-toggle")) {
      appState.campaignManualWorkspaceOpen = !appState.campaignManualWorkspaceOpen;
      renderCampaignBrainPanel();
      if (appState.campaignManualWorkspaceOpen) {
        window.requestAnimationFrame(() => document.getElementById("campaign-brain-linking-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      return;
    }
    if (target.closest("#campaign-studio-back-to-agent")) {
      appState.campaignStudioReviewOpen = false;
      renderCampaignBrainPanel();
      window.requestAnimationFrame(() => document.getElementById("content-agent-console")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    const studioResetButton = target.closest("[data-campaign-studio-reset]");
    if (studioResetButton) {
      const jobId = studioResetButton.getAttribute("data-campaign-studio-reset") || "";
      if (!jobId) return;
      if (appState.contentAgent.rejectConfirmJobId !== jobId) {
        appState.contentAgent.rejectConfirmJobId = jobId;
        renderCampaignBrainPanel();
        window.setTimeout(() => {
          if (appState.contentAgent.rejectConfirmJobId === jobId && !appState.contentAgent.rejectingJobId) {
            appState.contentAgent.rejectConfirmJobId = "";
            renderCampaignBrainPanel();
          }
        }, 8000);
        return;
      }
      const reason = document.querySelector(`[data-content-agent-reject-reason="${CSS.escape(jobId)}"]`)?.value || "";
      await rejectAndRestartContentAgentJob(jobId, reason);
      return;
    }
    const agentOpenButton = target.closest("[data-content-agent-open]");
    if (agentOpenButton) {
      openContentAgentJob(agentOpenButton.getAttribute("data-content-agent-open") || "");
      return;
    }
    const agentStage = target.closest("[data-content-agent-stage]");
    if (agentStage && !target.closest("button, select, input, label, aside")) {
      const bounds = agentStage.getBoundingClientRect();
      const ripple = document.createElement("i");
      ripple.className = "content-agent-stage-ripple";
      ripple.style.left = `${event.clientX - bounds.left}px`;
      ripple.style.top = `${event.clientY - bounds.top}px`;
      agentStage.querySelector(".content-agent-ripple-layer")?.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 1000);
    }

    if (target.closest("#campaign-asana-refresh-button")) {
      await loadCampaignAsanaWorkspace({ force: true });
      return;
    }

    const masterSourceButton = target.closest("[data-meta-master-source]");
    if (masterSourceButton) {
      appState.campaignMetaMaster.sourceType = masterSourceButton.getAttribute("data-meta-master-source") === "html" ? "html" : "klaviyo";
      appState.campaignMetaMaster.error = "";
      if (appState.campaignMetaMaster.sourceType === "klaviyo") loadCampaignMetaMasterTemplates();
      renderCampaignMetaMasterSource();
      return;
    }
    if (target.closest("#campaign-meta-master-refresh")) {
      appState.campaignMetaMaster.templates = [];
      appState.campaignMetaMaster.templateDetail = null;
      await loadCampaignMetaMasterTemplates({ force: true });
      return;
    }
    if (target.closest("#campaign-meta-master-generate")) {
      await generateMetaFromMaster();
      return;
    }
    if (target.closest("#campaign-meta-master-render")) {
      await renderCampaignMetaMasterCarousel();
      await reviewCampaignMetaCarousel();
      hydrateCampaignStudioDraftStatus(appState.campaignMetaMaster.renderError || "Carousel designs rendered at 1080×1080.");
      renderCampaignBrainPanel();
      return;
    }
    const metaRouteButton = target.closest("[data-campaign-meta-route]");
    if (metaRouteButton) {
      await generateMetaFromMaster({ selectedRouteId: metaRouteButton.getAttribute("data-campaign-meta-route") || "faithful" });
      return;
    }
    if (target.closest("#campaign-meta-apply-review")) {
      await generateMetaFromMaster({
        selectedRouteId: appState.campaignMetaMaster.selectedRouteId,
        qualityReview: appState.campaignMetaMaster.qualityReview
      });
      return;
    }
    if (target.closest("#campaign-meta-run-review")) {
      await reviewCampaignMetaCarousel();
      return;
    }
    if (target.closest("#campaign-brain-build-meta-button")) {
      await buildAndCreateCampaignBrainMetaCarouselDraft();
      return;
    }
    if (target.closest("#campaign-brain-meta-target-refresh")) {
      await refreshCampaignBrainMetaTargets({ force: true });
      return;
    }
    if (target.closest("#campaign-meta-intelligence-sync")) {
      await loadMetaHistoricalIntelligence({ sync: true });
      return;
    }

    const studioViewButton = target.closest("[data-campaign-studio-view]");
    if (studioViewButton) {
      const nextView = studioViewButton.getAttribute("data-campaign-studio-view") || "meta";
      setCampaignStudioActiveView(nextView);
      if (nextView === "meta" && !appState.metaStudioCatalogGeneratedAt) {
        refreshCampaignBrainMetaTargets();
      }
      return;
    }
    if (target.closest("#campaign-asana-load-button")) {
      await loadSelectedCampaignAsanaPair({ createStudio: true });
      return;
    }

    const validateButton = target.closest("#campaign-brain-validate-meta-button");
    if (!validateButton) {
      const environmentButton = target.closest("#campaign-brain-generate-environment-button");
      if (environmentButton) {
        await generateCampaignBrainEnvironmentSeries();
        return;
      }

      const emailVisualButton = target.closest("#campaign-brain-email-visuals-button");
      if (emailVisualButton) {
        await generateCampaignEmailVisuals();
        return;
      }

      const environmentSourceToggle = target.closest("[data-campaign-environment-source-toggle]");
      if (environmentSourceToggle) {
        toggleCampaignBrainEnvironmentSourceSelection(environmentSourceToggle.getAttribute("data-campaign-environment-source-toggle"));
        clearCampaignBrainEnvironmentResults();
        persistCampaignStudioDraft();
        hydrateCampaignStudioDraftStatus("Environment source selection updated.");
        renderCampaignBrainPanel();
        return;
      }

      const environmentSourceSave = target.closest("[data-campaign-environment-save-source]");
      if (environmentSourceSave) {
        try {
          const record = await saveCampaignBrainEnvironmentSourceToLibrary(environmentSourceSave.getAttribute("data-campaign-environment-save-source"));
          hydrateCampaignStudioDraftStatus(`Approved source saved to asset library as ${buildCampaignAssetVersionLabel(record)}.`);
        } catch (error) {
          appState.campaignBrainEnvironmentError = error.message || "Could not approve source image.";
        }
        renderCampaignBrainPanel();
        return;
      }

      const assetPickerOpen = target.closest("[data-campaign-asset-picker-open]");
      if (assetPickerOpen) {
        appState.campaignStudioActiveView = "assets";
        setCampaignAssetLibraryPickerTarget(String(assetPickerOpen.getAttribute("data-campaign-asset-picker-open") || ""));
        hydrateCampaignStudioDraftStatus("Asset picker armed for the next library selection.");
        renderCampaignBrainPanel();
        window.requestAnimationFrame(() => {
          document.getElementById("campaign-brain-asset-library")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }

      const assetPickerClose = target.closest("[data-campaign-asset-picker-close]");
      if (assetPickerClose) {
        setCampaignAssetLibraryPickerTarget("");
        hydrateCampaignStudioDraftStatus("Asset picker cleared.");
        renderCampaignBrainPanel();
        return;
      }

      const assetScopeTrigger = target.closest("[data-campaign-asset-scope]");
      if (assetScopeTrigger) {
        syncCampaignAssetLibraryControls({
          scope: String(assetScopeTrigger.getAttribute("data-campaign-asset-scope") || "campaign")
        });
        renderCampaignBrainPanel();
        return;
      }

      const environmentFormatTrigger = target.closest("[data-campaign-environment-format]");
      if (environmentFormatTrigger) {
        const format = String(environmentFormatTrigger.getAttribute("data-campaign-environment-format") || "").trim().toLowerCase();
        const current = new Set(getCampaignBrainEnvironmentSelectedFormats());
        if (current.has(format)) {
          if (current.size > 1) {
            current.delete(format);
          }
        } else if (["square", "portrait", "landscape"].includes(format)) {
          current.add(format);
        }

        syncCampaignBrainEnvironmentConfig({
          selectedFormats: Array.from(current)
        });
        const environmentFiles = getCampaignBrainEnvironmentFiles();
        if (environmentFiles.length) {
          const insights = await inspectCampaignBrainEnvironmentFiles(environmentFiles, Array.from(current));
          setCampaignBrainEnvironmentSourceInsights(insights);
        }
        clearCampaignBrainEnvironmentResults();
        persistCampaignStudioDraft();
        hydrateCampaignStudioDraftStatus("Environment output pack updated.");
        renderCampaignBrainPanel();
        return;
      }

      const suggestButton = target.closest("#campaign-brain-suggest-meta-button");
      if (suggestButton) {
        await suggestCampaignBrainCarouselCards();
        return;
      }

      const metaPushTrigger = target.closest("#campaign-brain-push-meta-button");
      if (!metaPushTrigger) {
        const environmentApproveReference = target.closest("[data-campaign-environment-approve-reference]");
        if (environmentApproveReference) {
          const ok = approveCampaignBrainEnvironmentReference(environmentApproveReference.getAttribute("data-campaign-environment-approve-reference"));
          if (ok) {
            try {
              const record = await saveCampaignBrainEnvironmentOutputToLibrary(environmentApproveReference.getAttribute("data-campaign-environment-approve-reference"));
              hydrateCampaignStudioDraftStatus(`Approved environment reference locked and saved as ${buildCampaignAssetVersionLabel(record)}.`);
            } catch (error) {
              hydrateCampaignStudioDraftStatus("Approved environment reference locked for later generations.");
            }
            persistCampaignStudioDraft();
            renderCampaignBrainPanel();
          }
          return;
        }

        const environmentOutputSave = target.closest("[data-campaign-environment-save-output]");
        if (environmentOutputSave) {
          try {
            const record = await saveCampaignBrainEnvironmentOutputToLibrary(environmentOutputSave.getAttribute("data-campaign-environment-save-output"));
            hydrateCampaignStudioDraftStatus(`Approved environment output saved to asset library as ${buildCampaignAssetVersionLabel(record)}.`);
          } catch (error) {
            appState.campaignBrainEnvironmentError = error.message || "Could not save environment output.";
          }
          renderCampaignBrainPanel();
          return;
        }

        const environmentCarouselTrigger = target.closest("[data-campaign-environment-to-carousel]");
        if (environmentCarouselTrigger) {
          await pushEnvironmentResultToCarousel(environmentCarouselTrigger.getAttribute("data-campaign-environment-to-carousel"));
          return;
        }

        const environmentCarouselAllTrigger = target.closest("#campaign-brain-environment-to-carousel-all");
        if (environmentCarouselAllTrigger) {
          await pushEnvironmentResultToCarousel(-1);
          return;
        }

        const assetTagToggle = target.closest("[data-campaign-asset-tag-toggle]");
        if (assetTagToggle) {
          try {
            const assetId = String(assetTagToggle.getAttribute("data-campaign-asset-tag-toggle") || "");
            const channelTag = String(assetTagToggle.getAttribute("data-campaign-asset-tag") || "");
            const current = getCampaignAssetLibraryItems().find((item) => item?.id === assetId)
              || getCampaignAssetLibraryAllItems().find((item) => item?.id === assetId);
            if (current) {
              const nextTags = new Set(normalizeCampaignAssetChannelTags(current.channelTags || []));
              if (nextTags.has(channelTag)) {
                nextTags.delete(channelTag);
              } else {
                nextTags.add(channelTag);
              }
              await updateCampaignAssetLibraryRecord(assetId, {
                channelTags: Array.from(nextTags)
              });
              hydrateCampaignStudioDraftStatus("Asset channel tags updated.");
            }
          } catch (error) {
            appState.campaignBrainEnvironmentError = error.message || "Could not update asset channel tags.";
          }
          renderCampaignBrainPanel();
          return;
        }

        const assetUseSource = target.closest("[data-campaign-asset-use-source]");
        if (assetUseSource) {
          try {
            await useCampaignAssetLibraryItemAsEnvironmentSource(String(assetUseSource.getAttribute("data-campaign-asset-use-source") || ""));
            hydrateCampaignStudioDraftStatus("Library asset moved into environment sources.");
          } catch (error) {
            appState.campaignBrainEnvironmentError = error.message || "Could not reuse library asset as source.";
          }
          renderCampaignBrainPanel();
          return;
        }

        const assetPick = target.closest("[data-campaign-asset-pick]");
        if (assetPick) {
          try {
            const message = await useCampaignAssetLibraryPickerSelection(String(assetPick.getAttribute("data-campaign-asset-pick") || ""));
            hydrateCampaignStudioDraftStatus(message);
          } catch (error) {
            appState.campaignBrainEnvironmentError = error.message || "Could not apply library picker selection.";
          }
          renderCampaignBrainPanel();
          return;
        }

        const assetUseReference = target.closest("[data-campaign-asset-use-reference]");
        if (assetUseReference) {
          const ok = useCampaignAssetLibraryItemAsEnvironmentReference(String(assetUseReference.getAttribute("data-campaign-asset-use-reference") || ""));
          if (ok) {
            hydrateCampaignStudioDraftStatus("Library asset set as environment reference.");
          } else {
            appState.campaignBrainEnvironmentError = "Could not set library asset as reference.";
          }
          renderCampaignBrainPanel();
          return;
        }

        const assetUseCarousel = target.closest("[data-campaign-asset-use-carousel]");
        if (assetUseCarousel) {
          try {
            await useCampaignAssetLibraryItemInCarousel(String(assetUseCarousel.getAttribute("data-campaign-asset-use-carousel") || ""));
            hydrateCampaignStudioDraftStatus("Library asset moved into Meta carousel.");
          } catch (error) {
            appState.campaignBrainEnvironmentError = error.message || "Could not move library asset into Meta carousel.";
          }
          renderCampaignBrainPanel();
          return;
        }

        const carouselRemoveTrigger = target.closest("[data-campaign-meta-card-remove]");
        if (carouselRemoveTrigger) {
          removeCampaignBrainCarouselCard(carouselRemoveTrigger.getAttribute("data-campaign-meta-card-index"));
          clearCampaignBrainMetaResults();
          persistCampaignStudioDraft();
          hydrateCampaignStudioDraftStatus("Carousel card removed.");
          renderCampaignBrainPanel();
          return;
        }

        const carouselMoveTrigger = target.closest("[data-campaign-meta-card-move]");
        if (!carouselMoveTrigger) {
          return;
        }

        moveCampaignBrainCarouselCard(
          carouselMoveTrigger.getAttribute("data-campaign-meta-card-index"),
          carouselMoveTrigger.getAttribute("data-campaign-meta-card-move")
        );
        clearCampaignBrainMetaResults();
        hydrateCampaignStudioDraftStatus("Carousel order updated.");
        persistCampaignStudioDraft();
        renderCampaignBrainPanel();
        return;
      }

      await pushCampaignBrainMetaDraft();
      return;
    }

    await validateCampaignBrainMetaDraft();
  });

  document.getElementById("campaign-brain-save-draft-button")?.addEventListener("click", async () => {
    await saveCampaignStudioDraft();
  });

  document.getElementById("campaign-brain-reset-draft-button")?.addEventListener("click", () => {
    resetCampaignStudioDraft();
  });

  document.getElementById("campaign-brain-klaviyo-account")?.addEventListener("change", (event) => {
    appState.campaignBrainKlaviyoAccount = event.target.value || "DK";
    appState.campaignBrainKlaviyoPushError = "";
    appState.campaignBrainKlaviyoPushResult = null;
    renderCampaignBrainPanel();
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const insideDirectorField = target.closest(".content-agent-director select, .content-agent-director input");
    if (insideDirectorField) {
      appState.contentAgent.directorInteractionActive = true;
      return;
    }
    if (appState.contentAgent.directorInteractionActive) {
      appState.contentAgent.directorInteractionActive = false;
      window.setTimeout(flushContentAgentDirectorRender, 0);
    }
  }, true);

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".content-agent-director select, .content-agent-director input")) {
      appState.contentAgent.directorInteractionActive = true;
    }
    if (appState.campaignEmailBuilder?.restoringView) return;
    const moduleField = target.getAttribute("data-email-module-field");
    const moduleIndex = target.getAttribute("data-email-module-index");
    if (moduleField && moduleIndex !== null) {
      appState.campaignEmailBuilder.selectedIndex = Number(moduleIndex);
      recordCampaignEmailHistory(`focus:module:${moduleIndex}:${moduleField}`, { force: true });
      return;
    }
    const fieldPath = target.getAttribute("data-campaign-artifact-field");
    if (/^email\./.test(fieldPath || "") && fieldPath !== "email.bodyHtml") {
      recordCampaignEmailHistory(`focus:${fieldPath}`, { force: true });
    }
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest(".content-agent-director")) return;
    window.setTimeout(() => {
      const director = document.querySelector(".content-agent-director.is-open");
      if (!director?.contains(document.activeElement)) {
        appState.contentAgent.directorInteractionActive = false;
        flushContentAgentDirectorRender();
      }
    }, 0);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const emailModuleField = target.getAttribute("data-email-module-field");
    const emailModuleIndex = target.getAttribute("data-email-module-index");
    if (emailModuleField && emailModuleIndex !== null && "value" in target) {
      updateCampaignEmailModule(emailModuleIndex, emailModuleField, target.value || "");
      hydrateCampaignStudioDraftStatus("Editing campaign modules...");
      return;
    }

    if (target.id === "content-agent-direction" && "value" in target) {
      appState.contentAgent.direction = target.value || "";
      return;
    }

    if (target.id === "campaign-meta-master-html" && "value" in target) {
      appState.campaignMetaMaster.html = target.value || "";
      appState.campaignMetaMaster.error = "";
      return;
    }
    if (target.id === "campaign-meta-master-direction" && "value" in target) {
      appState.campaignMetaMaster.direction = target.value || "";
      return;
    }

    const fieldPath = target.getAttribute("data-campaign-artifact-field");
    if (fieldPath && "value" in target) {
      if (/^email\./.test(fieldPath) && fieldPath !== "email.bodyHtml") {
        recordCampaignEmailHistory(`field:${fieldPath}`);
      }
      updateCampaignArtifactDraftField(fieldPath, target.value || "");
      hydrateCampaignStudioDraftStatus("Editing studio draft...");
      if (/^email\./.test(fieldPath) && fieldPath !== "email.bodyHtml") {
        scheduleCampaignStudioEmailCompile();
      }
      return;
    }

    const variantIndex = target.getAttribute("data-campaign-artifact-variant");
    const variantField = target.getAttribute("data-campaign-artifact-variant-field");
    if (variantIndex && variantField && "value" in target) {
      updateCampaignArtifactVariant(variantIndex, variantField, target.value || "");
      hydrateCampaignStudioDraftStatus("Editing studio draft...");
      return;
    }

    const metaConfigKey = target.getAttribute("data-campaign-meta-config");
    if (metaConfigKey && "value" in target) {
      syncCampaignBrainMetaConfig({
        [metaConfigKey]: target.value || ""
      });
      clearCampaignBrainMetaFeedback();
      renderCampaignBrainMetaPayloadPreview();
      return;
    }

    const designPaletteKey = target.getAttribute("data-campaign-design-palette");
    const designTypeKey = target.getAttribute("data-campaign-design-type");
    const designCompositionKey = target.getAttribute("data-campaign-design-composition");
    const designTranslation = appState.campaignMetaMaster?.result?.designTranslation;
    if (designTranslation && "value" in target && (designPaletteKey || designTypeKey || designCompositionKey)) {
      if (designPaletteKey) designTranslation.palette[designPaletteKey] = target.value;
      if (designTypeKey) designTranslation.typography[designTypeKey] = target.value;
      if (designCompositionKey) designTranslation.composition[designCompositionKey] = target.value;
      appState.campaignBrainMetaAssets.carouselDesignReady = false;
      appState.campaignMetaMaster.renderedAt = "";
      hydrateCampaignStudioDraftStatus("Design DNA updated — render the carousel to apply it.");
      persistCampaignStudioDraft();
      return;
    }

    const environmentConfigKey = target.getAttribute("data-campaign-environment-config");
    if (environmentConfigKey && "value" in target) {
      syncCampaignBrainEnvironmentConfig({
        [environmentConfigKey]: target.value || ""
      });
      clearCampaignBrainEnvironmentResults();
      hydrateCampaignStudioDraftStatus("Editing environment series direction...");
      return;
    }

    const assetSearch = target.getAttribute("data-campaign-asset-search");
    if (assetSearch && "value" in target) {
      const cursorPosition = Number(target.selectionStart ?? target.value.length);
      syncCampaignAssetLibraryControls({
        search: target.value || ""
      });
      renderCampaignBrainPanel();
      window.requestAnimationFrame(() => {
        const nextSearch = document.querySelector("[data-campaign-asset-search]");
        if (nextSearch instanceof HTMLInputElement) {
          nextSearch.focus();
          nextSearch.setSelectionRange(cursorPosition, cursorPosition);
        }
      });
      return;
    }

    const metaCardIndex = target.getAttribute("data-campaign-meta-card-index");
    const metaCardField = target.getAttribute("data-campaign-meta-card-field");
    if (metaCardIndex && metaCardField && "value" in target) {
      updateCampaignBrainCarouselCardDraft(metaCardIndex, metaCardField, target.value || "");
      clearCampaignBrainMetaResults();
      hydrateCampaignStudioDraftStatus("Editing carousel cards...");
      renderCampaignBrainMetaPayloadPreview();
    }
  });

  document.addEventListener("keydown", handleCampaignEmailBuilderKeyboard, true);

  document.addEventListener("pointermove", (event) => {
    const stage = event.target instanceof Element ? event.target.closest("[data-content-agent-stage]") : null;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    stage.style.setProperty("--studio-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    stage.style.setProperty("--studio-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  });

  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const builderImageSource = event.target.closest("[data-email-builder-image-url]");
    if (builderImageSource) {
      const assetUrl = builderImageSource.getAttribute("data-email-builder-image-url") || "";
      const assetAlt = builderImageSource.getAttribute("data-email-builder-image-alt") || "Campaign image";
      const assetSourceUrl = builderImageSource.getAttribute("data-email-builder-image-source-url") || assetUrl;
      const assetHosted = builderImageSource.getAttribute("data-email-builder-image-hosted") === "true";
      appState.campaignEmailBuilder.draggingIndex = -1;
      appState.campaignEmailBuilder.draggingModuleId = "";
      appState.campaignEmailBuilder.draggingAssetUrl = assetUrl;
      appState.campaignEmailBuilder.draggingAssetAlt = assetAlt;
      appState.campaignEmailBuilder.draggingAssetSourceUrl = assetSourceUrl;
      appState.campaignEmailBuilder.draggingAssetHosted = assetHosted;
      setCampaignEmailBuilderDragSurface(true, "image");
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let activeDropTarget = null;
      const move = (moveEvent) => {
        if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 7) return;
        if (!moved) {
          moved = true;
          builderImageSource.classList.add("is-dragging");
        }
        const candidate = moveEvent.target?.closest?.("[data-email-builder-drop-index]")
          || document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest?.("[data-email-builder-drop-index]");
        activeDropTarget = candidate?.getAttribute("data-email-builder-accepts-image") === "true" ? candidate : null;
        document.querySelectorAll("[data-email-builder-drop-index].is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
        if (activeDropTarget) activeDropTarget.classList.add("is-drop-target");
      };
      const release = (releaseEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", cancel);
        if (moved) {
          const dropTarget = releaseEvent.target?.closest?.("[data-email-builder-drop-index]")
            || activeDropTarget
            || document.elementFromPoint(releaseEvent.clientX, releaseEvent.clientY)?.closest?.("[data-email-builder-drop-index]");
          if (dropTarget?.getAttribute("data-email-builder-accepts-image") === "true") {
            const targetIndex = Number(dropTarget.getAttribute("data-email-builder-drop-index"));
            applyCampaignEmailBuilderAsset(targetIndex, { previewUrl: assetUrl, sourceUrl: assetSourceUrl, hosted: assetHosted, alt: assetAlt });
          }
          appState.campaignEmailBuilder.suppressImageClickUntil = Date.now() + 450;
        }
        appState.campaignEmailBuilder.draggingAssetUrl = "";
        appState.campaignEmailBuilder.draggingAssetAlt = "";
        appState.campaignEmailBuilder.draggingAssetSourceUrl = "";
        appState.campaignEmailBuilder.draggingAssetHosted = false;
        builderImageSource.classList.remove("is-dragging");
        document.querySelectorAll("[data-email-builder-drop-index].is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
        setCampaignEmailBuilderDragSurface(false);
      };
      const cancel = (cancelEvent) => release(cancelEvent);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", cancel);
      return;
    }
    const builderDragSource = event.target.closest("[data-email-builder-drag-index], [data-email-builder-library-module]");
    if (!builderDragSource) return;
    const libraryModuleId = builderDragSource.getAttribute("data-email-builder-library-module") || "";
    if (!libraryModuleId) return;
    // Expose the drop surface on press, before native drag-and-drop performs its
    // target actionability check. Waiting for the first pointermove leaves the
    // iframe above the drop zones in some browsers and makes the drag impossible.
    appState.campaignEmailBuilder.draggingIndex = -1;
    appState.campaignEmailBuilder.draggingModuleId = libraryModuleId;
    setCampaignEmailBuilderDragSurface(true, "module");
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const move = (moveEvent) => {
      if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 7) return;
      if (!moved) {
        moved = true;
        builderDragSource.classList.add("is-dragging");
      }
      const candidate = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest?.("[data-email-builder-drop-index]");
      document.querySelectorAll("[data-email-builder-drop-index].is-drop-target").forEach((node) => node.classList.toggle("is-drop-target", node === candidate));
    };
    const release = (releaseEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      const dropTarget = moved && releaseEvent && Number.isFinite(releaseEvent.clientX) && Number.isFinite(releaseEvent.clientY)
        ? document.elementFromPoint(releaseEvent.clientX, releaseEvent.clientY)?.closest?.("[data-email-builder-drop-index]")
        : null;
      const targetIndex = dropTarget ? Number(dropTarget.getAttribute("data-email-builder-drop-index")) : -1;
      window.setTimeout(() => {
        if (libraryModuleId && targetIndex >= 0) {
          const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections || [];
          if (sections.length < 4) addCampaignEmailModuleByType(libraryModuleId, targetIndex);
          else if (targetIndex < sections.length) replaceCampaignEmailModuleLayout(targetIndex, libraryModuleId);
        }
        appState.campaignEmailBuilder.draggingModuleId = "";
        builderDragSource.classList.remove("is-dragging");
        document.querySelectorAll("[data-email-builder-drop-index].is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
        setCampaignEmailBuilderDragSurface(false);
      }, 0);
    };
    const cancel = (cancelEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      release(cancelEvent);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancel);
  });

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const builderAsset = target.closest("[data-email-builder-image-url]");
    if (builderAsset) {
      const url = builderAsset.getAttribute("data-email-builder-image-url") || "";
      const alt = builderAsset.getAttribute("data-email-builder-image-alt") || "Campaign image";
      const sourceUrl = builderAsset.getAttribute("data-email-builder-image-source-url") || url;
      const hosted = builderAsset.getAttribute("data-email-builder-image-hosted") === "true";
      appState.campaignEmailBuilder.draggingIndex = -1;
      appState.campaignEmailBuilder.draggingModuleId = "";
      appState.campaignEmailBuilder.draggingAssetUrl = url;
      appState.campaignEmailBuilder.draggingAssetAlt = alt;
      appState.campaignEmailBuilder.draggingAssetSourceUrl = sourceUrl;
      appState.campaignEmailBuilder.draggingAssetHosted = hosted;
      builderAsset.classList.add("is-dragging");
      setCampaignEmailBuilderDragSurface(true, "image");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-westpack-email-asset", url);
        event.dataTransfer.setData("application/x-westpack-email-asset-alt", alt);
        event.dataTransfer.setData("application/x-westpack-email-asset-source", sourceUrl);
        event.dataTransfer.setData("application/x-westpack-email-asset-hosted", hosted ? "true" : "false");
        event.dataTransfer.setData("text/plain", `email-asset:${url}`);
      }
      return;
    }

    const builderModule = target.closest("[data-email-builder-drag-index]");
    if (builderModule) {
      const index = Number(builderModule.getAttribute("data-email-builder-drag-index") || 0);
      appState.campaignEmailBuilder.draggingIndex = index;
      appState.campaignEmailBuilder.draggingModuleId = "";
      builderModule.classList.add("is-dragging");
      setCampaignEmailBuilderDragSurface(true);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-westpack-email-module", String(index));
        event.dataTransfer.setData("text/plain", `email-module:${index}`);
      }
      return;
    }

    const builderLibraryModule = target.closest("[data-email-builder-library-module]");
    if (builderLibraryModule) {
      const moduleId = builderLibraryModule.getAttribute("data-email-builder-library-module") || "";
      appState.campaignEmailBuilder.draggingIndex = -1;
      appState.campaignEmailBuilder.draggingModuleId = moduleId;
      builderLibraryModule.classList.add("is-dragging");
      setCampaignEmailBuilderDragSurface(true);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-westpack-email-library", moduleId);
        event.dataTransfer.setData("text/plain", `email-library:${moduleId}`);
      }
      return;
    }

    const draggableCard = target.closest("[data-campaign-meta-card-draggable]");
    if (!draggableCard) {
      return;
    }

    const index = draggableCard.getAttribute("data-campaign-meta-card-index");
    setCampaignBrainDraggingCardIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index || ""));
    }
    renderCampaignBrainPanel();
  });

  document.addEventListener("dragover", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const builderDropTarget = target.closest("[data-email-builder-drop-index]");
    const builderDragActive = Number(appState.campaignEmailBuilder?.draggingIndex ?? -1) >= 0
      || Boolean(appState.campaignEmailBuilder?.draggingModuleId)
      || Boolean(appState.campaignEmailBuilder?.draggingAssetUrl);
    const imageDragActive = Boolean(appState.campaignEmailBuilder?.draggingAssetUrl);
    const imageDropAllowed = builderDropTarget?.getAttribute("data-email-builder-accepts-image") === "true";
    if (builderDropTarget && builderDragActive && (!imageDragActive || imageDropAllowed)) {
      event.preventDefault();
      document.querySelectorAll("[data-email-builder-drop-index].is-drop-target").forEach((node) => {
        if (node !== builderDropTarget) node.classList.remove("is-drop-target");
      });
      builderDropTarget.classList.add("is-drop-target");
      if (event.dataTransfer) event.dataTransfer.dropEffect = appState.campaignEmailBuilder.draggingModuleId || appState.campaignEmailBuilder.draggingAssetUrl ? "copy" : "move";
      return;
    }

    const dropTarget = target.closest("[data-campaign-meta-drop-index]");
    if (!dropTarget) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });

  document.addEventListener("drop", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const builderDropTarget = target.closest("[data-email-builder-drop-index]");
    const builderDragActive = Number(appState.campaignEmailBuilder?.draggingIndex ?? -1) >= 0
      || Boolean(appState.campaignEmailBuilder?.draggingModuleId)
      || Boolean(appState.campaignEmailBuilder?.draggingAssetUrl);
    const imageDragActive = Boolean(appState.campaignEmailBuilder?.draggingAssetUrl);
    const imageDropAllowed = builderDropTarget?.getAttribute("data-email-builder-accepts-image") === "true";
    if (builderDropTarget && builderDragActive && (!imageDragActive || imageDropAllowed)) {
      event.preventDefault();
      const targetIndex = Number(builderDropTarget.getAttribute("data-email-builder-drop-index"));
      const assetUrl = event.dataTransfer?.getData("application/x-westpack-email-asset")
        || appState.campaignEmailBuilder.draggingAssetUrl;
      const assetAlt = event.dataTransfer?.getData("application/x-westpack-email-asset-alt")
        || appState.campaignEmailBuilder.draggingAssetAlt;
      const assetSourceUrl = event.dataTransfer?.getData("application/x-westpack-email-asset-source")
        || appState.campaignEmailBuilder.draggingAssetSourceUrl
        || assetUrl;
      const assetHosted = (event.dataTransfer?.getData("application/x-westpack-email-asset-hosted")
        || String(appState.campaignEmailBuilder.draggingAssetHosted)) === "true";
      if (assetUrl) {
        applyCampaignEmailBuilderAsset(targetIndex, { previewUrl: assetUrl, sourceUrl: assetSourceUrl, hosted: assetHosted, alt: assetAlt });
        return;
      }
      const libraryModuleId = event.dataTransfer?.getData("application/x-westpack-email-library")
        || appState.campaignEmailBuilder.draggingModuleId;
      if (libraryModuleId) {
        const sections = appState.campaignArtifactDraft?.artifacts?.email?.sections || [];
        if (sections.length < 4) addCampaignEmailModuleByType(libraryModuleId, targetIndex);
        else if (targetIndex < sections.length) replaceCampaignEmailModuleLayout(targetIndex, libraryModuleId);
      } else {
        const sourceIndex = event.dataTransfer?.getData("application/x-westpack-email-module") || appState.campaignEmailBuilder.draggingIndex;
        reorderCampaignEmailModules(sourceIndex, targetIndex);
      }
      return;
    }

    const dropTarget = target.closest("[data-campaign-meta-drop-index]");
    if (!dropTarget) {
      return;
    }

    event.preventDefault();
    const targetIndex = dropTarget.getAttribute("data-campaign-meta-drop-index");
    const sourceIndex = event.dataTransfer?.getData("text/plain") || String(getCampaignBrainDraggingCardIndex());
    const moved = reorderCampaignBrainCarouselCard(sourceIndex, targetIndex);
    if (!moved) {
      setCampaignBrainDraggingCardIndex(-1);
      renderCampaignBrainPanel();
      return;
    }

    clearCampaignBrainMetaResults();
    persistCampaignStudioDraft();
    hydrateCampaignStudioDraftStatus("Carousel order updated by drag and drop.");
    renderCampaignBrainPanel();
  });

  document.addEventListener("dragend", () => {
    appState.campaignEmailBuilder.draggingIndex = -1;
    appState.campaignEmailBuilder.draggingModuleId = "";
    appState.campaignEmailBuilder.draggingAssetUrl = "";
    appState.campaignEmailBuilder.draggingAssetAlt = "";
    appState.campaignEmailBuilder.draggingAssetSourceUrl = "";
    appState.campaignEmailBuilder.draggingAssetHosted = false;
    document.querySelectorAll(".campaign-email-builder .is-dragging, .campaign-email-builder .is-drop-target").forEach((node) => node.classList.remove("is-dragging", "is-drop-target"));
    setCampaignEmailBuilderDragSurface(false);
    if (getCampaignBrainDraggingCardIndex() < 0) {
      return;
    }
    setCampaignBrainDraggingCardIndex(-1);
    renderCampaignBrainPanel();
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const emailImageUploadIndex = target.getAttribute("data-email-builder-file-upload");
    if (emailImageUploadIndex !== null && target instanceof HTMLInputElement) {
      const file = target.files?.[0] || null;
      if (file) await uploadCampaignEmailModuleImage(emailImageUploadIndex, file);
      return;
    }
    if (target.hasAttribute("data-email-builder-hero-file-upload") && target instanceof HTMLInputElement) {
      const file = target.files?.[0] || null;
      if (file) await uploadCampaignEmailHeroImage(file);
      return;
    }

    if (target.id === "content-agent-campaign" && "value" in target) {
      appState.contentAgent.directorInteractionActive = false;
      appState.campaignAsanaSelectedCampaignGid = target.value || "";
      const match = findCampaignAsanaContentMatch(getSelectedCampaignAsanaTask("campaign"));
      appState.campaignAsanaSelectedContentGid = match?.task?.gid || "";
      renderContentAgentConsole({ force: true });
      return;
    }
    if (target.id === "content-agent-content" && "value" in target) {
      appState.contentAgent.directorInteractionActive = false;
      appState.campaignAsanaSelectedContentGid = target.value || "";
      flushContentAgentDirectorRender();
      return;
    }

    if (target.id === "campaign-meta-master-account" && "value" in target) {
      appState.campaignMetaMaster.account = target.value || "DK";
      appState.campaignMetaMaster.templates = [];
      appState.campaignMetaMaster.templateId = "";
      appState.campaignMetaMaster.templateDetail = null;
      await loadCampaignMetaMasterTemplates({ force: true });
      return;
    }
    if (target.id === "campaign-meta-master-template" && "value" in target) {
      appState.campaignMetaMaster.templateId = target.value || "";
      appState.campaignMetaMaster.templateDetail = null;
      await loadCampaignMetaMasterTemplateDetail(appState.campaignMetaMaster.templateId);
      return;
    }
    if (target.id === "campaign-meta-master-content" && "value" in target) {
      appState.campaignAsanaSelectedContentGid = target.value || "";
      appState.campaignMetaMaster.error = "";
      renderCampaignMetaMasterSource();
      return;
    }
    if (target.id === "campaign-brain-meta-target-campaign" && "value" in target) {
      const campaignId = target.value || "";
      const provisional = buildCampaignMetaTargetModel({
        campaigns: appState.campaigns || [],
        adSets: appState.adSets || [],
        config: { targetCampaignId: campaignId }
      });
      syncCampaignBrainMetaTarget(campaignId, provisional.adSetOptions[0]?.id || "");
      clearCampaignBrainMetaResults();
      persistCampaignStudioDraft();
      renderCampaignBrainPanel();
      return;
    }
    if (target.id === "campaign-brain-meta-target-adset" && "value" in target) {
      syncCampaignBrainMetaTarget(deriveCampaignBrainMetaConfig().targetCampaignId, target.value || "");
      clearCampaignBrainMetaResults();
      persistCampaignStudioDraft();
      renderCampaignBrainPanel();
      return;
    }

    if (target.id === "campaign-asana-campaign-select" && "value" in target) {
      appState.campaignAsanaSelectedCampaignGid = target.value || "";
      appState.campaignAssemblyObject = null;
      appState.campaignBrainResult = null;
      appState.campaignArtifactsResult = null;
      appState.campaignArtifactDraft = null;
      appState.campaignAssemblyError = "";
      appState.campaignBrainError = "";
      appState.campaignArtifactsError = "";
      const match = findCampaignAsanaContentMatch(getSelectedCampaignAsanaTask("campaign"));
      appState.campaignAsanaSelectedContentGid = match?.task?.gid || "";
      renderCampaignAsanaSource();
      return;
    }
    if (target.id === "campaign-asana-content-select" && "value" in target) {
      appState.campaignAsanaSelectedContentGid = target.value || "";
      renderCampaignAsanaSource();
      return;
    }

    const hasArtifactField = Boolean(target.getAttribute("data-campaign-artifact-field"));
    const hasVariantField = Boolean(target.getAttribute("data-campaign-artifact-variant-field"));
    const metaConfigKey = target.getAttribute("data-campaign-meta-config");
    const environmentConfigKey = target.getAttribute("data-campaign-environment-config");
    const assetFilterKey = target.getAttribute("data-campaign-asset-filter");
    if (!hasArtifactField && !hasVariantField && !metaConfigKey && !environmentConfigKey && !assetFilterKey) {
      if (target.id !== "campaign-brain-meta-carousel-upload" && target.id !== "campaign-brain-environment-upload") {
        return;
      }
    }

    if (target.id === "campaign-brain-meta-carousel-upload") {
      const files = Array.from(target.files || []);
      setCampaignBrainCarouselFiles(files);
      const warnings = await inspectCampaignBrainCarouselFiles(files);
      setCampaignBrainCarouselWarnings(warnings);
      clearCampaignBrainMetaResults();
      persistCampaignStudioDraft();
      hydrateCampaignStudioDraftStatus(files.length
        ? `${files.length} carousel card${files.length === 1 ? "" : "s"} attached to studio draft.`
        : "Carousel cards cleared.");
      renderCampaignBrainPanel();
      return;
    }

    if (target.id === "campaign-brain-environment-upload") {
      const files = Array.from(target.files || []);
      setCampaignBrainEnvironmentFiles(files);
      const insights = await inspectCampaignBrainEnvironmentFiles(files, getCampaignBrainEnvironmentSelectedFormats());
      setCampaignBrainEnvironmentSourceInsights(insights);
      clearCampaignBrainEnvironmentResults();
      persistCampaignStudioDraft();
      hydrateCampaignStudioDraftStatus(files.length
        ? `${files.length} raw image${files.length === 1 ? "" : "s"} attached for environment generation.`
        : "Environment source images cleared.");
      renderCampaignBrainPanel();
      return;
    }

    if (metaConfigKey && "value" in target) {
      syncCampaignBrainMetaConfig({
        [metaConfigKey]: target.value || ""
      });
      clearCampaignBrainMetaResults();
      renderCampaignBrainMetaPayloadPreview();
    }

    if (environmentConfigKey && "value" in target) {
      syncCampaignBrainEnvironmentConfig({
        [environmentConfigKey]: target.value || ""
      });
      clearCampaignBrainEnvironmentResults();
    }

    if (assetFilterKey && "value" in target) {
      syncCampaignAssetLibraryControls({
        [assetFilterKey]: target.value || "all"
      });
      renderCampaignBrainPanel();
      return;
    }

    const metaCardIndex = target.getAttribute("data-campaign-meta-card-index");
    const metaCardField = target.getAttribute("data-campaign-meta-card-field");
    if (metaCardIndex && metaCardField && "value" in target) {
      updateCampaignBrainCarouselCardDraft(metaCardIndex, metaCardField, target.value || "");
      clearCampaignBrainMetaResults();
      renderCampaignBrainMetaPayloadPreview();
    }

    const ok = persistCampaignStudioDraft();
    hydrateCampaignStudioDraftStatus(ok
      ? `Studio draft autosaved ${formatKlaviyoDate(new Date().toISOString())}`
      : "Could not autosave studio draft.");
  });

  document.querySelectorAll(".dashboard-subtab").forEach((button) => {
    button.addEventListener("click", () => {
      const nextLens = button.dataset.dashboardLens;
      if (!nextLens || button.hidden || button.disabled) return;
      appState.dashboardLens = nextLens;
      syncDashboardSubtabs();
      renderDashboard();
    });
  });

  const factorInput = document.getElementById("incrementality-factor");
  const factorLabel = document.getElementById("incrementality-factor-label");
  if (factorInput) {
    factorInput.addEventListener("input", () => {
      const nextPercent = Number(factorInput.value);
      const clamped = Number.isFinite(nextPercent) ? Math.max(0, Math.min(100, nextPercent)) : 60;
      appState.dashboardIncrementalityFactor = clamped / 100;
      if (factorLabel) {
        factorLabel.textContent = `${clamped}%`;
      }
      renderDashboard();
    });
  }

  document.getElementById("dashboard-agent-button")?.addEventListener("click", async () => {
    setDashboardAgentStatus("Thinking...", "loading");
    renderDashboardAgentList([]);

    try {
      const analysis = appState.dashboardAnalysis || buildDashboardAnalysis(
        appState.campaigns || [],
        appState.dashboardLens,
        appState.dashboardIncrementalityFactor
      );
      const payload = buildAgentPayload(appState.dashboardLens, analysis);
      payload.campaigns = (payload.campaigns || appState.campaigns || []).slice(0, 25);
      payload.stats = {
        generatedAt: new Date().toISOString(),
        activeCampaigns: (appState.campaigns || []).length
      };
      const result = await requestDashboardAgent(payload);

      const insights = Array.isArray(result.insights) ? result.insights : [];
      appState.dashboardAgentItems = insights.map((item) => ({
        title: `[${(item.priority || "medium").toUpperCase()}] ${item.title}`,
        body: item.body
      }));
      setDashboardAgentStatus(`AI suggestions ready (${insights.length}).`, "success");
      renderDashboardAgentList(appState.dashboardAgentItems);
    } catch (error) {
      setDashboardAgentStatus(error.message, "warning");
    }
  });

  document.querySelectorAll("[data-jump='studio']").forEach((button) => {
    button.addEventListener("click", () => {
      switchTab("studio");
      syncDashboardControls();
      refreshMetaWorkspaceData();
    });
  });

  document.querySelectorAll("[data-jump='settings']").forEach((button) => {
    button.addEventListener("click", () => toggleSettings(true));
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.mode = button.dataset.mode;
      setStudioMode(appState.mode);
      if (appState.mode === "create") {
        setCreateStep(1);
        renderCreateUploadPreview();
      }
      if (appState.mode === "duplicate") {
        setDuplicateStep(1);
      }
      syncStudioChrome();
      setStudioStatus("Ready.");
      markPreviewDirty("Workflow changed. Generate preview again.");
    });
  });

  attachCreateStudioEventsModule({
    appState,
    analyzeCreateVideo,
    canAdvanceCreateStep,
    getInputValue,
    markPreviewDirty,
    renderCreateUploadPreview,
    resetVideoAnalysisState,
    setCreateStep,
    setStudioStatus,
    syncActionAvailability,
    syncCreateImageUploadValidation
  });
  attachDuplicateStudioEventsModule({
    addCurrentDuplicateTarget,
    appState,
    canAdvanceDuplicateStep,
    clearDuplicateCreativeOverrideCarouselFiles,
    ensureDuplicateTargetPersisted,
    focusDuplicateTargetEditor,
    generateAiPreview,
    getActiveDuplicateCreativeEditorTarget,
    getDuplicateTargetByKey,
    getDuplicateTargetKey,
    getInputValue,
    markPreviewDirty,
    removeDuplicateBulkTarget,
    removeDuplicateCreativeOverrideFile,
    renderCurrentPreviewPayload,
    renderDuplicateBulkTargets,
    renderDuplicateCreativeOverridePanel,
    setDuplicateActivePreview,
    setDuplicateReviewOpen,
    setDuplicateStep,
    setStudioStatus,
    syncActionAvailability,
    syncDuplicateCreativeEditorKey,
    syncDuplicateSourceSelectors,
    upsertDuplicateCreativeOverride
  });

  document.getElementById("new-ad-name")?.addEventListener("input", () => {
    markPreviewDirty("Ad name changed. Generate preview again.");
    syncActionAvailability();
  });

  document.getElementById("new-ad-angle")?.addEventListener("change", () => {
    markPreviewDirty("Creative angle changed. Generate preview again.");
  });

  document.getElementById("create-ad-intent")?.addEventListener("change", () => {
    markPreviewDirty("Ad intent changed. Generate preview again.");
  });

  attachSharedFieldEvents("duplicate");
  attachSharedFieldEvents("create");

  document.getElementById("meta-data-mode")?.addEventListener("change", async (event) => {
    const nextMode = event.target.value === "live" ? "live" : "snapshot";
    appState.metaDataMode = nextMode;
    persistDashboardPreferences();
    syncDashboardControls();

    if (isStudioVisible()) {
      await refreshMetaWorkspaceData({ silent: false });
    } else {
      await refreshMetaData({ silent: false });
    }
  });

  document.getElementById("refresh-data-button")?.addEventListener("click", async () => {
    const studioVisible = isStudioVisible();
    if (appState.metaDataMode === "snapshot") {
      if (studioVisible) {
        await refreshMetaWorkspaceData({ silent: false });
      } else {
        await refreshMetaData({ silent: false });
      }
      return;
    }
    if (studioVisible) {
      await refreshMetaWorkspaceData({ force: true, silent: false });
      return;
    }
    await refreshMetaData();
  });

  document.getElementById("update-snapshot-button")?.addEventListener("click", async () => {
    const studioVisible = isStudioVisible();
    if (studioVisible) {
      await refreshMetaWorkspaceData({ force: true, forceLive: true, silent: false });
      return;
    }
    await refreshMetaData({ forceLive: true, reason: "Updating snapshot" });
  });

  document.getElementById("dashboard-date-preset")?.addEventListener("change", async (event) => {
    const nextPreset = event.target.value;
    appState.dashboardDatePreset = nextPreset;
    if (nextPreset === "custom" && (!appState.dashboardDateFrom || !appState.dashboardDateTo)) {
      const defaults = getDefaultCustomRange();
      appState.dashboardDateFrom = defaults.from;
      appState.dashboardDateTo = defaults.to;
    }
    syncDashboardControls();
    persistDashboardPreferences();
    if (nextPreset !== "custom") {
      await refreshMetaData();
    }
  });

  document.getElementById("dashboard-date-from")?.addEventListener("change", (event) => {
    appState.dashboardDateFrom = event.target.value;
    persistDashboardPreferences();
  });

  document.getElementById("dashboard-date-to")?.addEventListener("change", (event) => {
    appState.dashboardDateTo = event.target.value;
    persistDashboardPreferences();
  });

  document.getElementById("dashboard-date-apply")?.addEventListener("click", async () => {
    if (!appState.dashboardDateFrom || !appState.dashboardDateTo) {
      setSyncStatus("Choose both custom dates first.", "warning");
      return;
    }
    await refreshMetaData();
  });

  document.getElementById("dashboard-auto-refresh")?.addEventListener("change", (event) => {
    appState.dashboardAutoRefresh = event.target.value;
    persistDashboardPreferences();
    configureDashboardAutoRefresh();
    setSyncStatus(
      appState.dashboardAutoRefresh === "off"
        ? "Auto refresh off"
        : appState.dashboardAutoRefresh === "daily"
          ? "Browser daily refresh scheduled for 07:45 and 13:00 Copenhagen time"
          : `Auto refresh ${appState.dashboardAutoRefresh}`,
      "success"
    );
  });

  document.getElementById("generate-create-button")?.addEventListener("click", async () => {
    await generateAiPreview("create");
  });

  document.getElementById("save-create-button")?.addEventListener("click", () => {
    saveDraftPreview("create");
  });

  document.getElementById("duplicate-variant-button")?.addEventListener("click", () => {
    useNextVariant();
  });

  document.getElementById("close-settings")?.addEventListener("click", () => {
    toggleSettings(false);
  });

  document.getElementById("settings-drawer")?.addEventListener("click", (event) => {
    if (event.target.id === "settings-drawer") {
      toggleSettings(false);
    }
  });

  syncCreateFormatClasses();
  renderCreateUploadPreview();
  syncActionAvailability();
}

attachAuthEvents();
bootstrapAuth();

