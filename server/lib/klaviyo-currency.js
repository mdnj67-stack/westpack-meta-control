const DEFAULT_COUNTRY_CURRENCY = Object.freeze({
  UK: "GBP",
  DK: "DKK",
  NO: "NOK",
  SE: "SEK",
  PL: "PLN",
  US: "USD"
});

const DEFAULT_FX_RATES_TO_DKK = Object.freeze({
  DKK: 1,
  EUR: 7.4728,
  GBP: 8.5845,
  NOK: 0.689,
  SEK: 0.6888,
  PLN: 1.7599,
  USD: 6.4264
});

const DEFAULT_FX_REFERENCE = Object.freeze({
  source: "ECB euro reference rates",
  date: "2026-05-15"
});

function normalizeCountryCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCurrencyCode(value, fallback = "EUR") {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || fallback;
}

function readObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildKlaviyoCurrencyContext(options = {}) {
  const configuredCountryCurrencies = readObject(options.countryCurrencies || options.klaviyoCountryCurrenciesJson);
  const configuredFxRates = readObject(options.fxRatesToDkk || options.klaviyoFxRatesToDkkJson);

  const countryCurrencies = {
    ...DEFAULT_COUNTRY_CURRENCY
  };
  Object.entries(configuredCountryCurrencies).forEach(([country, currency]) => {
    const normalizedCountry = normalizeCountryCode(country);
    const normalizedCurrency = normalizeCurrencyCode(currency, "");
    if (normalizedCountry && normalizedCurrency) {
      countryCurrencies[normalizedCountry] = normalizedCurrency;
    }
  });

  const fxRatesToDkk = {
    ...DEFAULT_FX_RATES_TO_DKK
  };
  Object.entries(configuredFxRates).forEach(([currency, rate]) => {
    const normalizedCurrency = normalizeCurrencyCode(currency, "");
    const normalizedRate = toFiniteNumber(rate, NaN);
    if (normalizedCurrency && Number.isFinite(normalizedRate) && normalizedRate > 0) {
      fxRatesToDkk[normalizedCurrency] = normalizedRate;
    }
  });

  return {
    baseCurrency: "DKK",
    countryCurrencies,
    fxRatesToDkk,
    fxSource: String(options.klaviyoFxSource || DEFAULT_FX_REFERENCE.source).trim() || DEFAULT_FX_REFERENCE.source,
    fxReferenceDate: String(options.klaviyoFxReferenceDate || DEFAULT_FX_REFERENCE.date).trim() || DEFAULT_FX_REFERENCE.date
  };
}

function getCurrencyForCountry(country, context = buildKlaviyoCurrencyContext()) {
  const normalizedCountry = normalizeCountryCode(country);
  return context.countryCurrencies[normalizedCountry] || "EUR";
}

function getRateToDkk(currency, context = buildKlaviyoCurrencyContext()) {
  const normalizedCurrency = normalizeCurrencyCode(currency, "EUR");
  const configured = toFiniteNumber(context.fxRatesToDkk[normalizedCurrency], NaN);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return toFiniteNumber(context.fxRatesToDkk.EUR, DEFAULT_FX_RATES_TO_DKK.EUR);
}

function convertRevenueToDkk(value, country, context = buildKlaviyoCurrencyContext(), explicitCurrency = "") {
  const originalValue = toFiniteNumber(value, 0);
  const sourceCurrency = normalizeCurrencyCode(explicitCurrency, getCurrencyForCountry(country, context));
  const exchangeRateToDkk = getRateToDkk(sourceCurrency, context);
  const converted = originalValue * exchangeRateToDkk;

  return {
    revenueOriginal: Number(originalValue.toFixed(2)),
    sourceCurrency,
    exchangeRateToDkk: Number(exchangeRateToDkk.toFixed(6)),
    revenue: Number(converted.toFixed(2)),
    revenueCurrency: context.baseCurrency
  };
}

function normalizeMarketRevenueRow(marketRow = {}, country, context = buildKlaviyoCurrencyContext()) {
  const baseCountry = country || marketRow.country;
  const existingOriginal = marketRow.revenueOriginal;
  const originalRevenue = Number.isFinite(Number(existingOriginal))
    ? Number(existingOriginal)
    : toFiniteNumber(marketRow.revenue, 0);
  const explicitCurrency = marketRow.sourceCurrency || marketRow.currency || getCurrencyForCountry(baseCountry, context);
  const converted = convertRevenueToDkk(originalRevenue, baseCountry, context, explicitCurrency);

  return {
    ...marketRow,
    ...converted
  };
}

module.exports = {
  DEFAULT_COUNTRY_CURRENCY,
  DEFAULT_FX_RATES_TO_DKK,
  DEFAULT_FX_REFERENCE,
  buildKlaviyoCurrencyContext,
  convertRevenueToDkk,
  getCurrencyForCountry,
  getRateToDkk,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeMarketRevenueRow
};
