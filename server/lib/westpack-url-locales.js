const fs = require("fs");
const path = require("path");

function loadMarketSnippets() {
  try {
    const filePath = path.join(process.cwd(), "data", "westpack-url-snippets.json");
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

const WESTPACK_MARKET_SNIPPETS = loadMarketSnippets();
const KNOWN_SNIPPETS = new Set(Object.values(WESTPACK_MARKET_SNIPPETS).filter(Boolean));

function normalizeCountry(value = "") {
  return String(value || "").trim().toUpperCase();
}

function getWestpackMarketSnippet(country = "") {
  return WESTPACK_MARKET_SNIPPETS[normalizeCountry(country)] || "";
}

function collectWestpackSnippetUrlMismatches(content = "", targetCountry = "") {
  const expectedSnippet = getWestpackMarketSnippet(targetCountry);
  if (!expectedSnippet) {
    return [];
  }

  const mismatches = [];
  const pattern = /https:\/\/www\.westpack\.com\/([a-z0-9_]+)(\/[^\s"'<>]*)?/gi;
  let match = pattern.exec(String(content || ""));

  while (match) {
    const foundSnippet = String(match[1] || "");
    const rest = String(match[2] || "");
    const isProductCatalogUrl = /^\/catalog\/product\/view\/id\/\d+(?:[^\s"'<>]*)?$/i.test(rest);
    if (KNOWN_SNIPPETS.has(foundSnippet) && !isProductCatalogUrl) {
      mismatches.push({
        url: match[0],
        foundSnippet,
        expectedSnippet
      });
    }
    match = pattern.exec(String(content || ""));
  }

  return mismatches;
}

function collectWestpackProductFeedUrlMismatches(content = "", targetCountry = "") {
  const expectedSnippet = getWestpackMarketSnippet(targetCountry);
  if (!expectedSnippet) {
    return [];
  }

  const mismatches = [];
  const pattern = /https:\/\/www\.westpack\.com(?:\/([a-z0-9_]+))?\/catalog\/product\/view\/id\/(\d+)([^\s"'<>]*)/gi;
  let match = pattern.exec(String(content || ""));

  while (match) {
    const foundSnippet = String(match[1] || "");
    if (foundSnippet !== expectedSnippet) {
      mismatches.push({
        url: match[0],
        foundSnippet,
        expectedSnippet,
        productId: String(match[2] || "")
      });
    }
    match = pattern.exec(String(content || ""));
  }

  return mismatches;
}

function rewriteWestpackProductFeedUrls(content = "", targetCountry = "") {
  const snippet = getWestpackMarketSnippet(targetCountry);
  if (!snippet) {
    return String(content || "");
  }

  return String(content || "")
    .replace(
      /https:\/\/www\.westpack\.com\/[a-z0-9_]+\/catalog\/product\/view\/id\/(\d+)([^\s"'<>]*)/gi,
      (match, productId, suffix = "") => {
        const normalized = match.replace(
          /https:\/\/www\.westpack\.com\/([a-z0-9_]+)\//i,
          "https://www.westpack.com/"
        );
        return normalized.replace(
          /https:\/\/www\.westpack\.com\/catalog\/product\/view\/id\/(\d+)([^\s"'<>]*)/i,
          `https://www.westpack.com/${snippet}/catalog/product/view/id/${productId}${suffix}`
        );
      }
    )
    .replace(
      /https:\/\/www\.westpack\.com\/catalog\/product\/view\/id\/(\d+)([^\s"'<>]*)/gi,
      (match, productId, suffix = "") => `https://www.westpack.com/${snippet}/catalog/product/view/id/${productId}${suffix}`
    );
}

function rewriteWestpackSnippetUrls(content = "", targetCountry = "") {
  const snippet = getWestpackMarketSnippet(targetCountry);
  if (!snippet) {
    return String(content || "");
  }

  return String(content || "").replace(
    /https:\/\/www\.westpack\.com\/([a-z0-9_]+)(\/[^\s"'<>]*)?/gi,
    (match, foundSnippet = "", rest = "") => {
      const normalizedSnippet = String(foundSnippet || "");
      const normalizedRest = String(rest || "");
      const isProductCatalogUrl = /^\/catalog\/product\/view\/id\/\d+(?:[^\s"'<>]*)?$/i.test(normalizedRest);
      if (!KNOWN_SNIPPETS.has(normalizedSnippet) || isProductCatalogUrl) {
        return match;
      }
      return `https://www.westpack.com/${snippet}${normalizedRest}`;
    }
  );
}

module.exports = {
  collectWestpackProductFeedUrlMismatches,
  collectWestpackSnippetUrlMismatches,
  getWestpackMarketSnippet,
  rewriteWestpackSnippetUrls,
  rewriteWestpackProductFeedUrls
};
