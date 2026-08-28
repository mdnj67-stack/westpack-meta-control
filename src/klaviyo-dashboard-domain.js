export function createKlaviyoDashboardDomain({
  appState,
  klaviyoMarkets = [],
  classifyFlowGroup,
  buildFlowHealth,
  isCampaignLikeFlowName,
  buildFlowUnderstanding,
  documentRef = document
} = {}) {
  const KLAVIYO_SMALL_LIST_EXEMPT_MARKETS = new Set(["CZ", "SK", "HU"]);
  const KLAVIYO_SMALL_LIST_EXEMPT_REASON = "Lists are intentionally too small for campaign sends.";
  const KLAVIYO_DEFAULT_COUNTRY_CURRENCY = Object.freeze({
    UK: "GBP",
    DK: "DKK",
    NO: "NOK",
    SE: "SEK",
    PL: "PLN",
    US: "USD"
  });
  const KLAVIYO_DEFAULT_FX_RATES_TO_DKK = Object.freeze({
    DKK: 1,
    EUR: 7.4728,
    GBP: 8.5845,
    NOK: 0.689,
    SEK: 0.6888,
    PLN: 1.7599,
    USD: 6.4264
  });

  function formatKlaviyoNumber(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return number.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function formatKlaviyoPercent(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return `${formatKlaviyoNumber(number, digits)}%`;
  }

  function formatKlaviyoCurrency(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0
    }).format(number);
  }

  function formatKlaviyoDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function normalizeKlaviyoMarketCode(country) {
    return String(country || "").trim().toUpperCase();
  }

  function isKlaviyoCoverageExemptMarket(country) {
    return KLAVIYO_SMALL_LIST_EXEMPT_MARKETS.has(normalizeKlaviyoMarketCode(country));
  }

  function getKlaviyoCoverageExpectedMarkets(markets = appState.klaviyoMarkets || []) {
    return (Array.isArray(markets) ? markets : []).filter((country) => !isKlaviyoCoverageExemptMarket(country));
  }

  function getKlaviyoEffectiveMissingMarkets(group) {
    return (Array.isArray(group?.missingMarkets) ? group.missingMarkets : []).filter((country) => !isKlaviyoCoverageExemptMarket(country));
  }

  function getKlaviyoCoverageExpectedCount() {
    return getKlaviyoCoverageExpectedMarkets().length;
  }

  function getKlaviyoCoverageExemptNote() {
    return `${Array.from(KLAVIYO_SMALL_LIST_EXEMPT_MARKETS).join(", ")} excluded from campaign coverage because ${KLAVIYO_SMALL_LIST_EXEMPT_REASON.toLowerCase()}`;
  }

  function getKlaviyoRevenueLabel() {
    return "Revenue (DKK)";
  }

  function normalizeKlaviyoCurrencyCode(value, fallback = "EUR") {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized || fallback;
  }

  function getKlaviyoCountryCurrency(country) {
    const normalizedCountry = normalizeKlaviyoMarketCode(country);
    return KLAVIYO_DEFAULT_COUNTRY_CURRENCY[normalizedCountry] || "EUR";
  }

  function getKlaviyoRateToDkk(currency) {
    const normalizedCurrency = normalizeKlaviyoCurrencyCode(currency, "EUR");
    const rate = Number(KLAVIYO_DEFAULT_FX_RATES_TO_DKK[normalizedCurrency]);
    return Number.isFinite(rate) && rate > 0 ? rate : KLAVIYO_DEFAULT_FX_RATES_TO_DKK.EUR;
  }

  function normalizeKlaviyoRevenueMarket(market = {}) {
    const originalRevenue = Number.isFinite(Number(market.revenueOriginal))
      ? Number(market.revenueOriginal)
      : Number(market.revenue || 0);
    const sourceCurrency = normalizeKlaviyoCurrencyCode(market.sourceCurrency, getKlaviyoCountryCurrency(market.country));
    const exchangeRateToDkk = getKlaviyoRateToDkk(sourceCurrency);

    return {
      ...market,
      revenueOriginal: Number(originalRevenue.toFixed(2)),
      sourceCurrency,
      exchangeRateToDkk: Number(exchangeRateToDkk.toFixed(6)),
      revenueCurrency: "DKK",
      revenue: Number((originalRevenue * exchangeRateToDkk).toFixed(2))
    };
  }

  function normalizeKlaviyoRevenueGroups(groups = []) {
    return (Array.isArray(groups) ? groups : []).map((group) => {
      const markets = (group.markets || [])
        .map((market) => normalizeKlaviyoRevenueMarket(market))
        .sort((a, b) => String(a.country || "").localeCompare(String(b.country || "")));
      const sentTotal = markets.reduce((sum, market) => sum + Number(market.sent || 0), 0);
      const revenueTotal = markets.reduce((sum, market) => sum + Number(market.revenue || 0), 0);
      const weightedRate = (key) => {
        if (!sentTotal) return 0;
        return markets.reduce((sum, market) => sum + ((Number(market[key] || 0) * Number(market.sent || 0))), 0) / sentTotal;
      };

      return {
        ...group,
        markets,
        sentTotal,
        revenueTotal: Number(revenueTotal.toFixed(2)),
        openRateWeighted: Number(weightedRate("openRate").toFixed(2)),
        clickRateWeighted: Number(weightedRate("clickRate").toFixed(2)),
        unsubRateWeighted: Number(weightedRate("unsubRate").toFixed(2)),
        activeMarkets: markets.length
      };
    });
  }

  function buildKlaviyoGroups(sourceGroups = []) {
    return (sourceGroups || []).map((group) => {
      const mergedMarkets = [];
      (group.markets || []).forEach((market) => {
        const existingIndex = mergedMarkets.findIndex((item) => item.country === market.country);
        if (existingIndex < 0) {
          mergedMarkets.push({ ...market });
          return;
        }

        const existing = mergedMarkets[existingIndex];
        const sent = (existing.sent || 0) + (market.sent || 0);
        const weighted = (key) => sent
          ? ((((existing[key] || 0) * (existing.sent || 0)) + ((market[key] || 0) * (market.sent || 0))) / sent)
          : 0;

        mergedMarkets[existingIndex] = {
          ...existing,
          sent,
          revenue: Number(((existing.revenue || 0) + (market.revenue || 0)).toFixed(2)),
          openRate: Number(weighted("openRate").toFixed(2)),
          clickRate: Number(weighted("clickRate").toFixed(2)),
          unsubRate: Number(weighted("unsubRate").toFixed(2)),
          sendTime: new Date(existing.sendTime) > new Date(market.sendTime) ? existing.sendTime : market.sendTime
        };
      });

      const sentTotal = mergedMarkets.reduce((sum, item) => sum + (item.sent || 0), 0);
      const revenueTotal = mergedMarkets.reduce((sum, item) => sum + (item.revenue || 0), 0);
      const openRateWeighted = sentTotal
        ? mergedMarkets.reduce((sum, item) => sum + ((item.openRate || 0) * (item.sent || 0)), 0) / sentTotal
        : 0;
      const clickRateWeighted = sentTotal
        ? mergedMarkets.reduce((sum, item) => sum + ((item.clickRate || 0) * (item.sent || 0)), 0) / sentTotal
        : 0;
      const unsubRateWeighted = sentTotal
        ? mergedMarkets.reduce((sum, item) => sum + ((item.unsubRate || 0) * (item.sent || 0)), 0) / sentTotal
        : 0;
      const marketCodes = new Set(mergedMarkets.map((item) => item.country));
      const missingMarkets = getKlaviyoCoverageExpectedMarkets().filter((country) => !marketCodes.has(country));

      return {
        ...group,
        sentTotal,
        revenueTotal,
        openRateWeighted,
        clickRateWeighted,
        unsubRateWeighted,
        activeMarkets: mergedMarkets.length,
        missingMarkets,
        markets: mergedMarkets.slice().sort((a, b) => String(a.country).localeCompare(String(b.country)))
      };
    });
  }

  function buildKlaviyoCampaignGroups() {
    return buildKlaviyoGroups(appState.klaviyoCampaignGroups || []);
  }

  function buildKlaviyoFlowGroups() {
    return buildKlaviyoGroups(appState.klaviyoFlowGroups || [])
      .filter((group) => !isCampaignLikeFlowName(group.campaignName))
      .map((group) => ({
        ...group,
        flowCategory: classifyFlowGroup(group),
        flowHealth: buildFlowHealth(group)
      }));
  }

  function getFilteredKlaviyoGroups() {
    const now = new Date();
    const rangeDays = Number(appState.klaviyoRangeDays) || 30;
    const search = String(appState.klaviyoSearch || "").trim().toLowerCase();
    const threshold = new Date(now);
    threshold.setUTCDate(threshold.getUTCDate() - rangeDays);

    const groups = buildKlaviyoCampaignGroups()
      .filter((group) => new Date(group.lastSent) >= threshold)
      .filter((group) => !search || group.campaignName.toLowerCase().includes(search))
      .filter((group) => !appState.klaviyoOnlyFullMarkets || getKlaviyoEffectiveMissingMarkets(group).length === 0);

    groups.sort((a, b) => {
      if (appState.klaviyoSort === "revenue") return b.revenueTotal - a.revenueTotal;
      if (appState.klaviyoSort === "open_rate") return b.openRateWeighted - a.openRateWeighted;
      if (appState.klaviyoSort === "click_rate") return b.clickRateWeighted - a.clickRateWeighted;
      return new Date(b.lastSent).getTime() - new Date(a.lastSent).getTime();
    });

    return groups;
  }

  function getFilteredKlaviyoFlowGroups() {
    const search = String(appState.klaviyoFlowSearch || "").trim().toLowerCase();

    const groups = buildKlaviyoFlowGroups()
      .filter((group) => !search || group.campaignName.toLowerCase().includes(search))
      .filter((group) => {
        if (appState.klaviyoFlowCategory === "all") return true;
        if (appState.klaviyoFlowCategory === "operator") return group.flowCategory !== "utility";
        return group.flowCategory === appState.klaviyoFlowCategory;
      })
      .filter((group) => appState.klaviyoFlowStage === "all" || buildFlowUnderstanding(group).stage === appState.klaviyoFlowStage)
      .filter((group) => !appState.klaviyoFlowOnlyFullMarkets || getKlaviyoEffectiveMissingMarkets(group).length === 0);

    groups.sort((a, b) => {
      if (appState.klaviyoFlowSort === "health") return a.flowHealth.score - b.flowHealth.score;
      if (appState.klaviyoFlowSort === "revenue") return b.revenueTotal - a.revenueTotal;
      if (appState.klaviyoFlowSort === "open_rate") return b.openRateWeighted - a.openRateWeighted;
      if (appState.klaviyoFlowSort === "click_rate") return b.clickRateWeighted - a.clickRateWeighted;
      return new Date(b.lastSent).getTime() - new Date(a.lastSent).getTime();
    });

    return groups;
  }

  function hasKlaviyoSnapshotData() {
    return (appState.klaviyoDataSource === "live" || appState.klaviyoDataSource === "snapshot")
      && Array.isArray(appState.klaviyoFlowGroups)
      && appState.klaviyoFlowGroups.length > 0;
  }

  function hasLiveKlaviyoFlowData() {
    return hasKlaviyoSnapshotData();
  }

  function getKlaviyoDashboardTabConfig(tab = appState.klaviyoDashboardTab || "general") {
    const configs = {
      general: {
        title: "Klaviyo Overview",
        subtitle: "A clean operator read across campaigns, flows and subscriber momentum.",
        visibleSections: [
          "klaviyo-command-center-section",
          "klaviyo-performance-section"
        ],
        showTabSummary: false,
        showDiagnostics: false
      },
      campaigns: {
        title: "Klaviyo Campaigns",
        subtitle: "Campaign families, rollout gaps and the next send decisions without extra noise.",
        visibleSections: [
          "klaviyo-signals-section",
          "klaviyo-campaigns-section"
        ],
        showTabSummary: false,
        showDiagnostics: false
      },
      flows: {
        title: "Klaviyo Flows",
        subtitle: "Lifecycle automation health with one focused read on what needs attention first.",
        visibleSections: [
          "klaviyo-flows-section"
        ],
        showTabSummary: false,
        showDiagnostics: false
      },
      subscribers: {
        title: "Klaviyo Subscribers",
        subtitle: "Subscriber growth, churn and market concentration in one cleaner audience view.",
        visibleSections: [
          "klaviyo-audience-section",
          "klaviyo-markets-section"
        ],
        showTabSummary: false,
        showDiagnostics: false
      }
    };

    return configs[tab] || configs.general;
  }

  function syncKlaviyoDashboardSectionCopy(tab = appState.klaviyoDashboardTab || "general") {
    const signalsHeading = documentRef.querySelector("#klaviyo-signals-section h3");
    const signalsLabel = documentRef.querySelector("#klaviyo-signals-section .section-label");
    const marketsHeading = documentRef.querySelector("#klaviyo-markets-section h3");
    const marketsLabel = documentRef.querySelector("#klaviyo-markets-section .section-label");

    if (signalsHeading) {
      signalsHeading.textContent = tab === "campaigns" ? "Campaign signals" : "Signals";
    }
    if (signalsLabel) {
      signalsLabel.textContent = tab === "campaigns" ? "Campaigns" : "Signals";
    }
    if (marketsHeading) {
      marketsHeading.textContent = tab === "subscribers" ? "Market audience mix" : "Markets";
    }
    if (marketsLabel) {
      marketsLabel.textContent = tab === "subscribers" ? "Audience mix" : "Markets";
    }
  }

  function syncKlaviyoDashboardSubtabs() {
    const supportedTabs = ["general", "campaigns", "flows", "subscribers"];
    if (!supportedTabs.includes(appState.klaviyoDashboardTab)) {
      appState.klaviyoDashboardTab = "general";
    }

    documentRef.querySelectorAll(".klaviyo-dashboard-subtab").forEach((node) => {
      const tab = node.dataset.klaviyoDashboardTab;
      const isActive = tab === appState.klaviyoDashboardTab;
      node.classList.toggle("active", isActive);
      node.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const tab = appState.klaviyoDashboardTab;
    const config = getKlaviyoDashboardTabConfig(tab);
    const visibleSections = new Set(config.visibleSections || []);
    const allSections = [
      "klaviyo-command-center-section",
      "klaviyo-performance-section",
      "klaviyo-signals-section",
      "klaviyo-campaigns-section",
      "klaviyo-flows-section",
      "klaviyo-audience-section",
      "klaviyo-markets-section"
    ];

    allSections.forEach((id) => {
      const node = documentRef.getElementById(id);
      if (node) {
        node.hidden = !visibleSections.has(id);
      }
    });

    const panel = documentRef.getElementById("klaviyo-dashboard-panel");
    if (panel) {
      panel.dataset.klaviyoDashboardTab = tab;
    }

    const diagnosticsNode = documentRef.getElementById("klaviyo-diagnostics-panel");
    if (diagnosticsNode) {
      const shouldShowDiagnostics = Boolean(config.showDiagnostics) || Boolean(String(appState.klaviyoError || "").trim());
      diagnosticsNode.hidden = !shouldShowDiagnostics;
    }

    const titleNode = documentRef.getElementById("klaviyo-dashboard-title");
    if (titleNode) {
      titleNode.textContent = config.title || "Klaviyo Overview";
    }

    const topbarSubNode = documentRef.getElementById("klaviyo-topbar-sub");
    if (topbarSubNode) {
      topbarSubNode.textContent = config.subtitle || "";
    }

    syncKlaviyoDashboardSectionCopy(tab);
  }

  function syncKlaviyoNavigation() {
    const isSupported = ["dashboard", "duplicate_translate", "campaign_ai"].includes(appState.klaviyoView);
    if (!isSupported) {
      appState.klaviyoView = "dashboard";
    }
    syncKlaviyoDashboardSubtabs();
  }

  function syncKlaviyoFlowControls() {
    const searchInput = documentRef.getElementById("klaviyo-flow-search");
    const categorySelect = documentRef.getElementById("klaviyo-flow-category");
    const sortSelect = documentRef.getElementById("klaviyo-flow-sort");
    const fullMarketsToggle = documentRef.getElementById("klaviyo-flow-full-markets");

    if (searchInput && searchInput.value !== appState.klaviyoFlowSearch) {
      searchInput.value = appState.klaviyoFlowSearch;
    }
    if (categorySelect) {
      categorySelect.value = appState.klaviyoFlowCategory;
    }
    if (sortSelect) {
      sortSelect.value = appState.klaviyoFlowSort;
    }
    if (fullMarketsToggle) {
      fullMarketsToggle.checked = Boolean(appState.klaviyoFlowOnlyFullMarkets);
    }
  }

  return {
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
  };
}
