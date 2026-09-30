# Westpack — what the website says about us

Crawled from the UK English store (`https://www.westpack.com/gbp_uk_eng/`) on **2026-09-30**:
2,814 URLs from the store's sitemap, of which 2,491 product pages, 258 category pages and 64
content pages were kept (one 404, test pages skipped).

This file is the distilled version. The raw material sits beside it:

- `pages/` — one Markdown file per content (`cms-*`) and category (`category-*`) page, with the
  site chrome (menus, footer, newsletter box) stripped. `pages-index.json` lists them.
- `products.jsonl` — one line per product: `name`, `heading` (name + size), `variant`
  (material/colour), `sku`, `url`, `category` path, `eco_badge`, the page's `description` text
  and `specs` (the "More Information" table: dimensions, pack size, logo sizes, processing
  times, GSM, weight).
- `tools/` — the crawler and the builder. Run from the repo root:
  `node knowledge/westpack-site/tools/scrape.js` then `node knowledge/westpack-site/tools/build-kb.js`.
  The crawl writes to `tmp/westpack-site-crawl/` (gitignored) and resumes if interrupted; four
  requests at a time, about 35 minutes for the whole store.

What the crawl **cannot** see: prices, tier discounts and the minimum order quantity for logo
print are rendered in the browser by JavaScript, so they are not in `products.jsonl`. Category
pages do carry a "from" price per product in GBP. For an MOQ, open the product page, or use the
content-author MCP (`list_products`) for prices.

The UK store's facts apply to the other English stores too, but check: the `eur_eu_eng` store
(which the EU Meta campaigns link to, and which is **not** in the content-author store list)
carries the same "No start-up costs" and "2,000+ five-star reviews" wording as of the crawl date.
Currency, freight and VAT differ per store.

---

## Who Westpack is

- Danish, founded **18 June 1953** by Christen Peter Mogensen as *Westpap* in Holstebro; renamed
  Westpack when it became an A/S in the early 1980s. HQ: Sletten 21, DK-7500 Holstebro.
- Packaging and display for the **jewellery, watch and eyewear** trade, sold B2B, with open prices
  in the web shop ("Although we are a B2B company, we operate with open prices").
- Own factory in Denmark (14,000 m² warehouse & production), own offices in China and Indonesia,
  sourcing partners across Europe, India, Indonesia and China. ~200 people.
- Owned by Adelis Equity Partners since 2022. In 2026 acquired the British company **Wrapology**
  and formed **WP Packaging Group**; both brands continue independently.
- Credentials the site lists: ISO 9001, ISO 14001, UN Global Compact, AAA credit rating (Bisnode),
  CSR reporting since 2014, Deloitte Best Managed Companies (2019), Danish Chamber of Commerce
  e-commerce award for best B2B online store (2021).
- Core values: Responsibility, Reliability, Community, Business Acumen.
- Long-standing UK relationship ("since the 1980s … one of our most important markets"); VAT
  registered in the UK, so UK buyers pay no customs charges.

### Customer counts disagree across the site

Use the figure from the page you are quoting, and never mix them:

| Claim | Where |
|---|---|
| "Trusted by 30,000+ brands" | home page |
| "shipped to more than 30,000 retail customers and jewellery manufacturers" | Westpack's DNA |
| "more than 23,000 customers worldwide" (2022) | timeline |
| "Partner to 400+ brands worldwide", "400+ key accounts" | B2B page (bespoke / key accounts) |
| "200,000 boxes and bags daily" | Westpack's DNA |

## The offer, as the site states it

| Topic | What the site says | Source |
|---|---|---|
| Start-up costs | "No start-up costs – free cliché on your first order." Standard aluminium clichés are £35 each; all standard-size clichés for the first order are free. **Plastic-bag clichés are excluded.** | `cms-logo-printing`, `cms-new-customer` |
| Logo preparation | Graphic designers check every logo and redraw it free of charge if it would not print well. Digital proof before production. | `cms-logo-printing`, home |
| Low MOQ | "Order as few as 48 pieces with your logo" (home); jewellery boxes 24–96 pcs depending on series. Bags vary per product (e.g. 100 pcs on the small luxury carrier bag). | home, `cms-faq` |
| Logo print cost | Included in the price of **jewellery boxes**. Flat-pack boxes, pouches and **carrier bags may carry a surcharge**. | `cms-logo-printing` |
| Print method | Hot-foil printing; ~25 colours (metallic gold, silver, rose gold/copper, etc.). One-colour only: no gradients, shadows or photos. | `cms-logo-printing` |
| Speed | "Ready to ship within one week" for logo orders (home). Product pages: new logo 7–8 working days, existing logo 4–5, no logo 1. Standard stock ships in 1–3 business days. | home, product pages |
| Samples | Can be ordered with or without your logo (up to five online). **Not free**: freight is added, and logo samples cost "a small amount each". | `cms-faq`, `cms-delivery` |
| Reviews | "More than 2,000 five-star reviews", linking to Trustpilot. Trustpilot itself refuses automated requests, so a newer figure has to be checked by hand. | `cms-about`, home |
| Bulk buy | Popular jewellery boxes from 9,600 pcs, up to 40% off, 7–8 weeks, logo included. Pouches from 2,500 pcs per model. | `cms-bulk-buy` |
| Stock management | Westpack can store your order and you pay as you draw it down; consignment stock in EU/Asia for key accounts. | `cms-about`, `cms-b2b` |
| Bespoke | Fully custom packaging via the in-house Westpack Design Studio, one named contact end to end. Larger MOQs. | `cms-b2b`, `cms-stock-products-or-bespoke-products` |
| Tarnish testing | Products are tarnish-tested in-house and contain no tarnish-accelerating chemicals. | product pages, `cms-b2b` |
| Returns | Standard products within 14 days; custom-printed products cannot be returned. | product pages |
| Payment | Visa, Mastercard, PayPal, bank transfer, invoice (B2B). | product pages |
| Freight (UK store) | UK £10, free above £199.99, 3–5 days; sample orders £5. Full table per country in `cms-delivery`. | `cms-delivery` |
| Partner programme | Westpack funds Meta **Partnership Ads** run from a customer's own profile, and features customers as cases. | `cms-become-a-partner` |

## Range

Products per top-level category in the UK store (a product can appear once per variant):
Jewellery Boxes 732 · Gift Packaging 582 · Displays & Trays 349 · Bags 314 · Various 145 ·
Cases 96 · Postal Packaging 70 · Eyewear & Watch Boxes 29, plus ~170 uncategorised or
service lines (cliché costs, cutting surcharges, lid pads).

Box series with their own positioning (Boston, Frankfurt, London, Milano, New York, Tokyo,
Copenhagen, …) are already summarised for prompts in `server/lib/westpack-knowledge.js`.

### Carrier bags (104 products)

| Line | Sizes (W × H × D) | Standard / max logo | Pack |
|---|---|---|---|
| Luxury paper carrier bag, woven handle (54) | small 200×150×70 · large 244×190×90 · XL 330×250×120 · XXL 450×350×150 mm | 60×50 / 100×80 mm (small, large); 90×80 / 120×120 (XL); 90×90 / 150×150 (XXL) | 50–100 (XL/XXL 25–50) |
| Standard paper carrier bag, woven paper handle (30) | 114×146×63 · 170×250×100 · 180×200×80 · 250×330×120 mm | 38×40 up to 90×90 mm | 50–200 |
| Budget / low-cost kraft paper bag (14) | small 155×235×70 · medium 210×310×105 · large 280×410×135 mm and others | 60×60 up to 150×150 mm | 100–250 |
| Plastic carrier bags (4) | incl. "with Diamond" mini/small | special cliché, not in the free-cliché offer | — |
| Cotton tote bags (2) | 235×295, 370×415 mm | 60×60 up to 300×300 mm | 25–50 |

The luxury bags come in nine colours (black, brown, dark brown, dark blue, dark green, grey,
pink, terracotta, cream/white). UK "from" prices on the category page: luxury small £1.22,
large £1.54, XL £1.63, XXL £2.60; standard small £0.99. Stock product photography shows
Westpack's own "From Westpack With Love" print on the front.

## Rules for using this in marketing

- **No environmental claims in ads.** No FSC, ECO, recyclable, recycled or sustainability
  wording, even though the site carries plenty of it (the ECO badge, FSC licence FSC®C112509,
  the eco pages). The prompt layer already enforces this through
  `forbiddenEnvironmentalTerms` in `server/lib/westpack-knowledge.js`.
- **"Free samples" is not true.** Say "order a sample with your logo", never "free".
- **"No set-up costs" is true for a first order**, and only for standard clichés. Say "on your
  first order"; it does not apply to plastic bags.
- **"Logo print included" is true for jewellery boxes only.** Bags and pouches may carry a
  surcharge.
- **Reviews: "2,000+ five-star reviews"** is what the site says. Do not round it up without
  checking Trustpilot by hand.
- `cms-inspiration-bags-pouches.md` (and some other `inspiration-*` pages) are unfinished
  templates full of lorem ipsum. Ignore them.
- Customer cases with quotable lines: Camille Brinch ("Westpack creates wow-experiences"),
  Pernille Corydon, STINE A, Kapten & Son, Briju, Kalevala. The B2B page names PDPAOLA,
  Sif Jakobs, KALEVALA and Bellinger House as selected work.
