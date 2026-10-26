// Store pages whose Danish path does not resolve in one market's store.
//
// A Klaviyo rollout writes each Danish store link over to the target market's store code and relies
// on that store to redirect the Danish path (jewellery-boxes/bas/...) to its own category names. Where
// a store lacks the redirect, the link 404s in every email to that market, so the path is swapped for
// the store's own one here. Remove an entry once the webshop has added the redirect.
//
// The browser preview has a copy of this table in app.js (klaviyoUrlPathFixes);
// tests/westpack-url-path-fixes.test.js keeps the two identical.
module.exports = {
  // Checked 2026-10-26 against all 15 stores: only the UK store has no redirect from
  // jewellery-boxes/bas/ for Amsterdam (it has one for Rome, London and Tokyo).
  UK: {
    "jewellery-boxes/bas/amsterdam-eco-jewellery-box.html": "jewellery-boxes/cardboard-jewellery-boxes/amsterdam-eco-jewellery-box.html"
  }
};
