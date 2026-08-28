export function createMetaMasterCarouselAssets(cards = []) {
  return (Array.isArray(cards) ? cards : [])
    .filter((card) => typeof card?.imageUrl === "string" && /^https:\/\//i.test(card.imageUrl))
    .slice(0, 5)
    .map((card, index) => ({
      name: `meta-master-card-${index + 1}.jpg`,
      type: "image/jpeg",
      size: 0,
      lastModified: 0,
      remoteUrl: card.imageUrl,
      sourceUrl: card.imageUrl,
      metaMasterCard: {
        role: card.role || "",
        cropDirective: card.cropDirective || "",
        visualTreatment: card.visualTreatment || ""
      }
    }));
}

export function createMetaMasterArtifactDraft(result = {}) {
  return {
    input: result.input || {},
    plan: null,
    artifacts: {
      email: null,
      meta: result?.artifacts?.meta || null,
      blog: null
    },
    productionNotes: Array.isArray(result.productionNotes) ? result.productionNotes : [],
    memoryReferences: Array.isArray(result.memoryReferences) ? result.memoryReferences : [],
    model: result.model || "",
    generatedAt: result.generatedAt || new Date().toISOString()
  };
}

export function createMetaMasterCardDrafts(cards = []) {
  return (Array.isArray(cards) ? cards : []).slice(0, 5).map((card) => ({
    title: card.title || "Westpack",
    description: card.description || ""
  }));
}
