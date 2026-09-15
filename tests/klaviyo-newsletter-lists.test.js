const test = require("node:test");
const assert = require("node:assert/strict");

const { chooseNewsletterList } = require("../server/klaviyo/newsletter-lists");

function list(id, name) {
  return { id, attributes: { name } };
}

// The real accounts, as verified against Klaviyo on 2026-09-15.
const EU_ACCOUNT = [
  list("TJzTwZ", "skal slettes 07/04"),
  list("U2sv92", "Preview List"),
  list("Ue5ZZe", "News from Westpack (EU)"),
  list("WqDaHS", "Exclude churn List"),
  list("XxP2iB", "Oprydning"),
  list("Ypw6Nr", "Westpack KAS Newsletter")
];

const US_ACCOUNT = [
  list("RHNPaL", "Exclude churn list"),
  list("TeqbR4", "Preview List"),
  list("W29TuN", "Westpack News (US)"),
  list("WHJXzg", "US manuelle kunder")
];

test("an explicitly configured list id wins over every other rule", () => {
  const chosen = chooseNewsletterList(EU_ACCOUNT, { listId: "Ue5ZZe" });
  assert.equal(chosen.id, "Ue5ZZe");
  assert.equal(chosen.resolvedBy, "configured_id");
});

test("a configured id that does not exist in the account falls through instead of returning nothing", () => {
  // Seventeen of the eighteen configured ids were stale when this was written, so this is the
  // ordinary path rather than an edge case.
  const chosen = chooseNewsletterList(US_ACCOUNT, { listId: "SLWARZ" });
  assert.equal(chosen.id, "W29TuN");
  assert.equal(chosen.resolvedBy, "branded_name");
});

test("the branded market list beats a decoy that scores higher on keywords", () => {
  // "Westpack KAS Newsletter" scores 6 on the old keyword rule against the real list's 2, and holds
  // nobody. Picking it would have silently dropped 4,797 members from the total.
  const chosen = chooseNewsletterList(EU_ACCOUNT, {});
  assert.equal(chosen.name, "News from Westpack (EU)");
  assert.equal(chosen.resolvedBy, "branded_name");
});

test("language-versioned titles all resolve, none of which contain 'newsletter' or 'nyhedsbrev'", () => {
  const cases = [
    ["Nouveauté de Westpack (FR)", "FR"],
    ["Neuheiten von Westpack (DE)", "DE"],
    ["Notizie da Westpack (IT)", "IT"],
    ["Westpackin uutiskirje (FI)", "FI"],
    ["Nyheter från Westpack (SE)", "SE"],
    ["Notícias da Westpack (PT)", "PT"]
  ];
  for (const [name, code] of cases) {
    const chosen = chooseNewsletterList([list("x1", "Preview List"), list("x2", name), list("x3", "Exclude churn list")], {});
    assert.equal(chosen.name, name, `${code} should resolve to its own newsletter list`);
    assert.equal(chosen.resolvedBy, "branded_name");
  }
});

test("a configured name resolves an account whose list does not carry a market suffix", () => {
  const lists = [list("a1", "Preview List"), list("a2", "Westpack Newsletter")];
  const chosen = chooseNewsletterList(lists, { listName: "Westpack Newsletter" });
  assert.equal(chosen.id, "a2");
  assert.equal(chosen.resolvedBy, "configured_name");
});

test("two branded lists are reported as ambiguous rather than silently picking one", () => {
  const lists = [list("b1", "News from Westpack (EU)"), list("b2", "Westpack News (EU)")];
  const chosen = chooseNewsletterList(lists, {});
  assert.equal(chosen.resolvedBy, "branded_name_ambiguous");
  assert.deepEqual(chosen.ambiguousWith, ["Westpack News (EU)"]);
});

test("the keyword guess is the last resort, and says so", () => {
  const chosen = chooseNewsletterList([list("c1", "Westpack Nyhedsbrev"), list("c2", "Preview List")], {});
  assert.equal(chosen.id, "c1");
  assert.equal(chosen.resolvedBy, "keyword_guess");
});

test("an account with nothing that looks like a newsletter resolves to nothing", () => {
  assert.equal(chooseNewsletterList([list("d1", "Preview List"), list("d2", "Har købt")], {}), null);
});

test("a list named 'test' is never chosen by the keyword guess", () => {
  const chosen = chooseNewsletterList([list("e1", "Test List - DK Newsletter")], {});
  assert.equal(chosen, null);
});
