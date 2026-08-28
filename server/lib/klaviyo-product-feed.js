function removeStandalonePriceBlocks(html = "") {
  let output = String(html || "");

  const priceOnlyPattern = /^\s*(?:from\s+)?(?:[A-Z]{3}\s*)?(?:[\d]{1,3}(?:[.\s][\d]{3})*|[\d]+)(?:[.,][\d]{1,2})?\s*(?:kr|dkk|sek|nok|pln|eur|usd|gbp|€|\$|£)\s*$/i;

  // Remove common block-level elements that only contain a price line.
  const blockTags = ["p", "div", "td", "th", "span", "strong", "em"];
  for (const tag of blockTags) {
    const pattern = new RegExp(
      `<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,
      "gi"
    );

    output = output.replace(pattern, (match, attrs = "", inner = "") => {
      const text = String(inner || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return match;
      if (!priceOnlyPattern.test(text)) return match;
      return "";
    });
  }

  // Remove price-only list items if a template happens to use lists.
  output = output.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (match, attrs = "", inner = "") => {
    const text = String(inner || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return priceOnlyPattern.test(text) ? "" : match;
  });

  return output;
}

module.exports = {
  removeStandalonePriceBlocks
};
