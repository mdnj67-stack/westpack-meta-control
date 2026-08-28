function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const forbiddenEnvironmentalTerms = [
  "fsc",
  "green",
  "gron",
  "baredygtig",
  "bæredygtig",
  "sustainable",
  "sustainability",
  "eco friendly",
  "environmentally friendly",
  "miljovenlig",
  "miljøvenlig",
  "recycled",
  "recyclable",
  "carbon neutral",
  "co2 neutral"
];

const jewelleryBoxSignals = [
  "smykkeaeske",
  "smykkeaesker",
  "jewellery box",
  "jewelry box",
  "ring box",
  "pendant box",
  "necklace box",
  "bracelet box",
  "armband box",
  "armring",
  "orering",
  "oreringe",
  "earring box",
  "collier box",
  "gift box for ring",
  "gift box for necklace",
  "gift box for bracelet",
  "paris smykkeaeske",
  "boston eco",
  "frankfurt eco",
  "barcelona eco",
  "amsterdam eco",
  "london eco",
  "milano eco",
  "miami eco",
  "new york eco",
  "riga eco",
  "rome eco",
  "stockholm eco",
  "santiago eco",
  "santorini eco",
  "tokyo eco",
  "copenhagen eco",
  "rio eco",
  "seville eco",
  "torino eco"
];

const familyUsps = [
  {
    name: "Boston Eco",
    signals: ["boston eco"],
    usps: [
      "Bestseller positioning",
      "Broad and varied size and color range",
      "Strong value for money",
      "High quality feel with clean presentation"
    ]
  },
  {
    name: "Frankfurt Eco",
    signals: ["frankfurt eco"],
    usps: [
      "Optimized for e-commerce and low freight height",
      "Fits letterbox shipping in relevant formats",
      "Minimalist look with practical protection",
      "Foam sizing tailored to the box"
    ]
  },
  {
    name: "London Eco",
    signals: ["london eco"],
    usps: [
      "Classic expression",
      "Soft-touch paper and premium cover cloth feel",
      "Protective construction",
      "Strong premium look without overcomplication"
    ]
  },
  {
    name: "Milano Eco",
    signals: ["milano eco"],
    usps: [
      "Strong unboxing experience",
      "Hidden magnet closure",
      "Traditional mid-range premium feel",
      "Protective cover cloth construction"
    ]
  },
  {
    name: "New York Eco",
    signals: ["new york eco"],
    usps: [
      "Luxurious presentation",
      "Very high quality pillow insert",
      "Sharp edges and premium build",
      "Made for a more exclusive reveal"
    ]
  },
  {
    name: "Tokyo Eco",
    signals: ["tokyo eco"],
    usps: [
      "Distinctive surface structure",
      "Exclusive colorways",
      "Three-component construction",
      "Built for a more design-led unboxing moment"
    ]
  },
  {
    name: "Copenhagen Eco",
    signals: ["copenhagen eco", "copenhagen open"],
    usps: [
      "Made in Denmark",
      "Distinctive color combinations",
      "Lift-off design with premium reveal",
      "Acrylic/open variants create a more exclusive display feel"
    ]
  }
];

const categoryHints = [
  {
    name: "Jewellery boxes",
    signals: [
      "jewellery box", "jewelry box", "ring box", "earring box", "pendant box", "bracelet box",
      "necklace box", "collier", "ringaeske", "smykkeaeske", "smykkeaeske", "gift box for ring"
    ],
    angles: [
      "premium presentation",
      "free logo print when relevant to jewellery boxes",
      "lift perceived value",
      "strong unboxing experience"
    ]
  },
  {
    name: "Gift bags",
    signals: ["gift bag", "gavepose", "paper bag", "shopping bag", "carrier bag", "luxury bag"],
    angles: [
      "brand visibility in-store",
      "easy upsell at checkout",
      "premium gifting presentation",
      "logo branding with low MOQ"
    ]
  },
  {
    name: "Displays and trays",
    signals: ["display", "tray", "bakke", "presenter", "showcase", "display tray", "jewellery display"],
    angles: [
      "better in-store presentation",
      "clearer product hierarchy",
      "premium visual merchandising",
      "helps products stand out"
    ]
  },
  {
    name: "Ribbon and wrapping",
    signals: ["ribbon", "gift wrapping", "tissue", "wrapping", "silk paper", "bows"],
    angles: [
      "finishing touch for premium gifting",
      "stronger branded packaging experience",
      "elevates the final presentation",
      "easy add-on sale"
    ]
  },
  {
    name: "Shipping and ecommerce packaging",
    signals: ["shipping", "forsendelse", "e-commerce", "ecommerce", "letterbox", "mailer", "postal"],
    angles: [
      "practical for ecommerce",
      "protective packaging without losing presentation",
      "optimized for shipping",
      "lower-friction delivery presentation"
    ]
  },
  {
    name: "Eyewear and watch packaging",
    signals: ["eyewear", "glasses", "brille", "watch box", "uræske", "ur aeske", "optica"],
    angles: [
      "protective premium storage",
      "brandable presentation case",
      "durable and stylish packaging",
      "logo branding when relevant"
    ]
  }
];

function collectRelevantFamilyUsps(sourceTexts = [], limit = 8) {
  const haystack = normalize(sourceTexts.filter(Boolean).join(" \n "));
  if (!haystack) return [];

  const hits = [];
  for (const family of familyUsps) {
    if (family.signals.some((signal) => haystack.includes(normalize(signal)))) {
      for (const usp of family.usps) {
        hits.push(`${family.name}: ${usp}`);
      }
    }
  }

  return hits.slice(0, limit);
}

function isJewelleryBoxContext(sourceTexts = []) {
  const haystack = normalize(sourceTexts.filter(Boolean).join(" \n "));
  if (!haystack) return false;
  return jewelleryBoxSignals.some((signal) => haystack.includes(normalize(signal)));
}

function collectCategoryHints(sourceTexts = [], limit = 6) {
  const haystack = normalize(sourceTexts.filter(Boolean).join(" \n "));
  if (!haystack) return [];

  const hits = [];
  for (const category of categoryHints) {
    if (category.signals.some((signal) => haystack.includes(normalize(signal)))) {
      for (const angle of category.angles) {
        hits.push(`${category.name}: ${angle}`);
      }
    }
  }

  return hits.slice(0, limit);
}

function detectPrimaryCategory(sourceTexts = []) {
  const haystack = normalize(sourceTexts.filter(Boolean).join(" \n "));
  if (!haystack) return "";

  let bestMatch = "";
  let bestScore = 0;
  for (const category of categoryHints) {
    const score = category.signals.reduce((count, signal) => (
      haystack.includes(normalize(signal)) ? count + 1 : count
    ), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category.name;
    }
  }

  return bestMatch;
}

function buildWestpackKnowledgeContext({
  sourceTexts = [],
  channel = "general",
  mode = "general",
  adFormat = ""
} = {}) {
  const relevantUsps = collectRelevantFamilyUsps(sourceTexts);
  const categoryAngles = collectCategoryHints(sourceTexts);
  const jewelleryBoxContext = isJewelleryBoxContext(sourceTexts);
  const primaryCategory = detectPrimaryCategory(sourceTexts);

  const blockedClaims = [
    jewelleryBoxContext
      ? "Do not invent free logo print details beyond the approved jewellery-box claim."
      : "Do not claim free logo print outside jewellery-box context.",
    "Do not merge separate offer ideas into one invented promise, for example free logo print plus low MOQ, unless both are explicitly supported.",
    "Do not use FSC, sustainable, recycled, recyclable, eco, green, carbon-neutral or environmental language unless explicitly requested.",
    "Do not infer environmental claims from ECO product names.",
    "Do not invent lead times, MOQ numbers, guarantees, certifications, or stock promises."
  ];

  const preferredAngles = [
    "premium presentation",
    "perceived value",
    "branding with low MOQ when relevant",
    "broad assortment",
    "retail-ready packaging",
    "strong unboxing experience",
    "practical packaging for shipping or display"
  ];

  if (channel === "meta") {
    preferredAngles.push("mobile-first clarity");
    preferredAngles.push("clear first-line commercial hook");
  }

  if (String(adFormat || "").toLowerCase() === "carousel") {
    preferredAngles.push("one micro-angle per card");
  }

  if (mode === "create") {
    preferredAngles.push("one dominant sales angle, not a list of every benefit");
  }

  return {
    primaryCategory,
    jewelleryBoxContext,
    relevantUsps,
    categoryAngles,
    preferredAngles,
    blockedClaims
  };
}

function buildWestpackKnowledgePromptBlock({
  sourceTexts = [],
  channel = "general",
  mode = "general",
  adFormat = ""
} = {}) {
  const context = buildWestpackKnowledgeContext({
    sourceTexts,
    channel,
    mode,
    adFormat
  });
  const relevantUsps = context.relevantUsps;
  const categoryUsps = context.categoryAngles;
  const jewelleryBoxContext = context.jewelleryBoxContext;
  const lines = [
    "Westpack claim guardrails:",
    jewelleryBoxContext
      ? "Free logo print may be mentioned because this looks like jewellery-box context."
      : "Do not claim free logo print. For non-jewellery-box products, only say logo branding is available with low minimum order quantity when relevant.",
    "Do not use FSC, green, sustainable, recycled, recyclable, environmental or other eco claims unless the operator explicitly asks for them.",
    "Do not infer eco claims from product names such as ECO. Treat those names as series names only unless the operator explicitly wants environmental messaging.",
    "Preferred Westpack sales angles when relevant: premium presentation, stronger perceived value, branding with low MOQ, reliable product quality, broad assortment, retail-ready packaging, strong unboxing experience, and practical packaging for shipping or display."
  ];

  if (channel === "meta") {
    lines.push("For Meta, prefer 1-3 sharp USPs that fit the exact product instead of listing too many.");
    lines.push("Prefer commercial clarity over brand poetry. The copy should sound sellable, not generic.");
  }

  if (mode === "create") {
    lines.push("Create mode guidance: build one strong ad around the most saleable Westpack angle instead of trying to cover everything.");
    lines.push("Use the uploaded product/category context to choose the best-fitting Westpack value proposition.");
    lines.push("Do not write broad generic copy if the product family is identifiable.");
  }

  if (mode === "duplicate") {
    lines.push("Duplicate mode guidance: preserve the original ad logic and only tighten where it improves clarity without changing intent.");
  }

  if (String(adFormat || "").toLowerCase() === "carousel") {
    lines.push("Carousel guidance: give each card a distinct micro-angle, keep card headlines tight, and avoid repeating the same USP across every card.");
  }

  if (channel === "klaviyo") {
    lines.push("For Klaviyo translation, preserve the source structure and only use these rules to keep claims accurate.");
  }

  if (relevantUsps.length) {
    lines.push("Relevant product-family USP hints:");
    relevantUsps.forEach((item) => lines.push(`- ${item}`));
  }

  if (categoryUsps.length) {
    lines.push("Relevant product-category angle hints:");
    categoryUsps.forEach((item) => lines.push(`- ${item}`));
  }

  return lines.join("\n");
}

module.exports = {
  buildWestpackKnowledgeContext,
  buildWestpackKnowledgePromptBlock,
  collectCategoryHints,
  forbiddenEnvironmentalTerms,
  isJewelleryBoxContext
};
