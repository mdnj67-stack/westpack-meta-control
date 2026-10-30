// Store pages whose Danish path does not resolve in one market's store.
//
// A Klaviyo rollout writes each Danish store link over to the target market's store code and relies
// on that store to redirect the Danish path (jewellery-boxes/bas/...) to its own category names. Where
// a store lacks the redirect, the link 404s in every email to that market, so the path is swapped for
// the store's own one here. The webshop is not changed for email links: store gaps are absorbed here.
// Applies to absolute store links and to {{ organization.url }} links alike (the header's are the latter).
//
// The browser preview has a copy of this table in app.js (klaviyoUrlPathFixes);
// tests/westpack-url-path-fixes.test.js keeps the two identical.
module.exports = {
  // Checked 2026-10-26 against all 15 stores: only the UK store has no redirect from
  // jewellery-boxes/bas/ for Amsterdam (it has one for Rome, London and Tokyo).
  UK: {
    "jewellery-boxes/bas/amsterdam-eco-jewellery-box.html": "jewellery-boxes/cardboard-jewellery-boxes/amsterdam-eco-jewellery-box.html"
  },
  // The locked header's "Inspiration" link; the Norwegian store has no buy-the-whole-look page.
  NO: {
    "buy-the-whole-look.html": "inspiration",
    // The Norwegian store has no christmas.html; its Christmas category ("Jul", same subcategories as the
    // other stores) answers only on Magento's catalog path. Checked against all 18 stores 2026-10-30.
    "christmas.html": "catalog/category/view/s/jul/id/809/"
  }
};
