# Emnelinjebanken — lag 2, mønsterbanken

The subject line generator (Klaviyo email → Emnelinjer) writes from three layers:

1. **Westpack's own sends** — every subject line and preheader sent from the 18 Klaviyo accounts
   since 2021, with measured results and ~515 A/B tests. Synced from Klaviyo into Blob
   (`server/klaviyo/subject-line-history.js`). This is the only layer with evidence.
2. **This directory** — a pattern bank of subject lines (and preheaders where there is one), tagged
   by mechanism, campaign type, tone and translation risk. It exists to give the generator range
   beyond Westpack's own habits.
3. **The rules** — `server/klaviyo/subject-line-rules.js`. Every candidate is checked against them.

## Where these lines come from, and what they are not

Three kinds of line, and **none of them has a measured result**. They are patterns, not proof.

- **Collected** (`source: "collected"`) - real subject lines other brands sent, from Really Good
  Emails, with the sender's name and a link. `tools/collect-rge.js` reads only what RGE's
  robots.txt allows (everything except `/api/`, `/library`, `/companies/` and the app paths):
  the server-rendered category listings (newest fifty per category; further pages load through
  the disallowed `/api/`) and the email pages listed in the public sitemaps, one request at a time
  with a pause, under an honest user agent. Mostly English, so the generator is told to borrow
  the construction into Danish, never translate word for word. Their results are unknown.
- **Authored** (`source: "authored"`) - pairs written for this bank, in `source/`, Danish-first,
  many in Westpack's own context. Never sent.
- **Imported** (`source: "imported"`) - lines the team pastes from its own inbox on the screen;
  tagged by the server and stored with the team's data, with the sender's name.

**Milled is not collected and must not be.** Its robots.txt disallows ClaudeBot and other AI agents
outright ("Milled's archive is not licensed for model training"), it answers bots with 403 on
every brand page, and its archive is what it sells (Milled Pro). Getting past that would be getting
past an access control, with the legal risk on Westpack. The user asked for it on 2026-10-27 and
was told no; a paid Milled export, if Westpack buys one, can go in through the import.

Retrieval gives about half of each mechanism's slots to real lines, so the generator always sees
what senders actually wrote alongside the Danish patterns.

Westpack-context entries also **assume content they cannot know**: a `nyhed` pattern says something
is new ("en ny farve"), a `kundecase` pattern presupposes a customer story, a `bag_kulisserne`
pattern a scene from the factory. That is what a pattern is. The generator is told to take every
fact from the email it is writing for, and the rules check numbers and claim words against the
email's own text - the bank's premises never become a promise on their own.

## Files

- `source/<mechanism>.json` — the authored entries, one file per mechanism, as written.
- `collected/really-good-emails.json` — the collected lines, tagged.
- `pattern-bank.json` — the built bank: both of the above validated, de-duplicated, with blocking
  rule breaks removed and stable ids. Do not edit by hand.
- `pattern-bank.vectors.bin` / `.vectors.json` — one embedding per bank line, row for row with the
  bank, so the generator is shown the lines closest in meaning to the email it writes for.
- `playbook.json` — every line of each mechanism distilled into the constructions that recur, with
  real lines that use them. It goes into every writing prompt, so the writer knows the whole bank
  and not only the two dozen lines it is shown.

Refreshing the collected lines (about an hour for 3,000 email pages; resumes from `tmp/rge-crawl/`):

```
node knowledge/subject-lines/tools/collect-rge.js 3000
node knowledge/subject-lines/tools/tag-collected.js
node knowledge/subject-lines/tools/build-bank.js
node knowledge/subject-lines/tools/build-embeddings.js
node knowledge/subject-lines/tools/build-playbook.js
```

The last two follow any change to the bank: embeddings in under a minute, the playbook in about
five (one mechanism at a time if you name them). A vectors file that no longer lines up with the
bank is ignored at runtime and fails a test.

## Entry schema (source files)

```json
{
  "subject": "Æsker, der sælger smykket for dig",
  "preview": "Fire serier, hvor præsentationen gør halvdelen af arbejdet.",
  "language": "da",
  "mechanisms": ["konkret_vaerdi"],
  "campaignType": "produktfokus",
  "tone": "direkte",
  "context": "westpack",
  "translationRisk": "lav",
  "why": "Lover en effekt for modtagerens forretning, ikke en egenskab ved æsken."
}
```

- `mechanisms`: one or two keys from `server/klaviyo/subject-line-taxonomy.js`; the first is the
  primary.
- `campaignType`, `tone`, `translationRisk`: keys from the same file.
- `context`: `westpack` (written for Westpack's own campaigns) or `generisk` (another kind of
  retailer or B2B supplier — the pattern is the point).
- `language`: `da` or `en`.
- `why`: one sentence in Danish on why the pair gets opened.

## Writing rules for Westpack-context entries

The audience is businesses that package what they sell — jewellery shops and brands at the core,
but any retailer — buying from a Danish B2B supplier. Facts come from
`knowledge/westpack-site/README.md` and nowhere else. In particular:

- No environmental claims (FSC, ECO, bæredygtig, genbrug, miljø, CO2) — even for ECO series.
- Samples are not free. Logo print is included on jewellery boxes only.
- Production time, never delivery time; never promise when goods arrive.
- No single Christmas date: one Danish master goes to ~15 markets with different deadlines.
- Never talk down to the customer or make their shop/packaging the punchline.
- No watch boxes (uræsker) in any copy.
- The subject must not promise what the email does not deliver.
