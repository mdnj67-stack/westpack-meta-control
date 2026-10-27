const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyBaselines,
  buildAbTests,
  buildFeatureStats,
  buildHistoryInsights,
  buildMarketEntries,
  buildMessageRows,
  familyKeyForCampaign,
  resolveYearsToFetch,
  summarizeAbFamilies,
  syncSubjectLineHistory,
  twoProportionZ,
  verdictForZ,
  HISTORY_VERSION
} = require("../server/klaviyo/subject-line-history");

// Layer 1: Westpack's own sends. The shapes below are the ones Klaviyo returned from the live
// accounts on 2026-10-27 (revision 2024-10-15): subject and preheader on the campaign message,
// `$message` = campaign id and `$variation` = the A/B arm's message id in event aggregates.

function campaign(id, name, sendTime, messageIds, method = "static") {
  return {
    type: "campaign",
    id,
    attributes: { name, send_time: sendTime, send_strategy: { method } },
    relationships: { "campaign-messages": { data: messageIds.map((messageId) => ({ type: "campaign-message", id: messageId })) } }
  };
}

function message(id, label, subject, preview, sendTime, fromLabel = "Ida fra Westpack") {
  return {
    type: "campaign-message",
    id,
    attributes: {
      label,
      content: { subject, preview_text: preview, from_label: fromLabel },
      send_times: [{ datetime: sendTime, is_local: false }]
    }
  };
}

test("message rows carry subject, preheader and sender, and an A/B campaign marks each arm", () => {
  const rows = buildMessageRows(
    [
      campaign("C1", "W17 - Urskrin - DK", "2023-04-26T08:00:00+00:00", ["M1", "M2"], "ab_test_campaign"),
      campaign("C2", "W18 - Nyheder", "2023-05-03T08:00:00+00:00", ["M3"]),
      campaign("C3", "Draft without subject", "2023-05-04T08:00:00+00:00", ["M4"])
    ],
    [
      message("M1", "W17 Variation A", "NYHEDER: Smykke- og urskrin", "Perfekte mersalgsvarer", "2023-04-26T08:00:00+00:00"),
      message("M2", "W17 Variation B", "Mersalgsideer 💡", "Perfekte mersalgsvarer", "2023-04-26T08:00:00+00:00"),
      message("M3", "W18", "Fem nye æsker", "", "2023-05-03T08:00:00+00:00"),
      message("M4", "Draft", "", "", "2023-05-04T08:00:00+00:00")
    ]
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => [row.id, row.abTest]), [["M1", true], ["M2", true], ["M3", false]]);
  assert.equal(rows[0].fromLabel, "Ida fra Westpack");
});

test("engagement is read per A/B arm by variation, and a single send under either of its keys", () => {
  const market = {
    country: "DK",
    language: "da",
    messages: [
      { id: "M1", campaignId: "C1", campaignName: "A/B", label: "Variation A", subject: "A", previewText: "", fromLabel: "", sentAt: "2022-12-30T08:00:00Z", abTest: true },
      { id: "M2", campaignId: "C1", campaignName: "A/B", label: "Variation B", subject: "B", previewText: "", fromLabel: "", sentAt: "2022-12-30T08:00:00Z", abTest: true },
      { id: "M3", campaignId: "C2", campaignName: "Static", label: "", subject: "S", previewText: "", fromLabel: "", sentAt: "2022-12-01T08:00:00Z", abTest: false }
    ],
    engagementByYear: {
      2022: { "C1|M1": [200, 100, 4], "C1|M2": [600, 420, 9], "C2|": [500, 300, 10], "C2|M3": [10, 5, 0] },
      // Opens on a send from 30 December keep arriving in January.
      2023: { "C1|M1": [0, 10, 1] }
    }
  };
  const byId = Object.fromEntries(buildMarketEntries(market).map((entry) => [entry.id, entry]));
  assert.deepEqual([byId.M1.received, byId.M1.opened, byId.M1.clicked], [200, 110, 5]);
  assert.deepEqual([byId.M2.received, byId.M2.opened], [600, 420]);
  assert.deepEqual([byId.M3.received, byId.M3.opened], [510, 305]);
});

test("each send is indexed against its own market's level in the weeks around it, never as a raw rate", () => {
  const base = Date.parse("2024-03-01T08:00:00Z");
  const entries = [0.5, 0.52, 0.48, 0.5, 0.51, 0.6].map((openRate, index) => ({
    id: `M${index}`,
    campaignId: `C${index}`,
    sentAt: new Date(base + index * 7 * 86_400_000).toISOString(),
    received: 1000,
    opened: Math.round(openRate * 1000),
    clicked: 10,
    openRate,
    clickRate: 0.01
  }));
  entries.push({ id: "small", campaignId: "Csmall", sentAt: new Date(base).toISOString(), received: 40, opened: 30, clicked: 1, openRate: 0.75, clickRate: 0.025 });
  const indexed = Object.fromEntries(applyBaselines(entries).map((entry) => [entry.id, entry]));
  assert.ok(indexed.M5.openIndex > 1.15, "the 60% send stands out against its ~50% neighbours");
  assert.ok(Math.abs(indexed.M0.openIndex - 1) < 0.05);
  assert.equal(indexed.small.openIndex, null, "too few recipients to rank");
});

test("an A/B test is judged by a two-proportion test, and most small tests are honestly inconclusive", () => {
  assert.equal(verdictForZ(twoProportionZ(73, 161, 297, 483)), "klar");
  assert.equal(verdictForZ(twoProportionZ(52, 100, 50, 100)), "uafgjort");
  const arms = (subjects, rates, sizes) => subjects.map((subject, index) => ({
    id: `M${index}`,
    campaignId: "C1",
    campaignName: "W37 - Messe Mail 7 - DK",
    label: `Variation ${String.fromCharCode(65 + index)}`,
    subject,
    previewText: "Samme preheader",
    sentAt: "2022-09-14T08:00:00Z",
    abTest: true,
    country: "DK",
    language: "da",
    received: sizes[index],
    opened: Math.round(rates[index] * sizes[index]),
    clicked: 5,
    openRate: rates[index],
    clickRate: 5 / sizes[index]
  }));
  const [testResult] = buildAbTests(arms(["Spar tid & penge | Storkøb med rabat 🤑", "Køb stort ind | Spar 10% på storkøb 🤩"], [0.615, 0.733], [483, 161]));
  assert.equal(testResult.differs, "subject");
  assert.equal(testResult.arms.find((arm) => arm.id === testResult.winnerId).letter, "B");
  assert.equal(testResult.verdict, "klar");
  assert.equal(testResult.includesRemainder, true, "the larger arm was sent on to the rest of the list");
  assert.equal(testResult.familyKey, "w37 messe mail 7");

  const [contentOnly] = buildAbTests(arms(["Samme emne", "Samme emne"], [0.5, 0.52], [300, 300]));
  assert.equal(contentOnly.differs, "content");
});

test("the same test run in several markets is grouped into a replication", () => {
  assert.equal(familyKeyForCampaign("W50 - Julestads - DK"), familyKeyForCampaign("W50 - Julestads - UK"));
  const tests = ["DK", "UK", "DE"].map((country, index) => ({
    country,
    familyKey: "w50 julestads",
    campaignName: `W50 - Julestads - ${country}`,
    differs: "subject",
    winnerId: index < 2 ? "B" : "A",
    verdict: index === 0 ? "klar" : "tendens",
    arms: [{ id: "A", letter: "A" }, { id: "B", letter: "B" }]
  }));
  const [family] = summarizeAbFamilies(tests);
  assert.deepEqual([family.leader, family.leaderWins, family.tests, family.decisive], ["B", 2, 3, 1]);
});

test("a market is read in full the first time, and after that only the current year", () => {
  const rows = [{ sentAt: "2021-09-22T13:42:03+00:00" }, { sentAt: "2026-10-26T11:45:00+00:00" }];
  const now = new Date("2026-10-27T10:00:00Z");
  assert.deepEqual(resolveYearsToFetch(rows, null, now), [2021, 2022, 2023, 2024, 2025, 2026]);
  const stored = { version: HISTORY_VERSION, engagementByYear: { 2021: {}, 2022: {}, 2023: {}, 2024: {}, 2025: {}, 2026: {} } };
  assert.deepEqual(resolveYearsToFetch(rows, stored, now), [2026]);
  // In January last year's December sends are still collecting opens.
  assert.deepEqual(resolveYearsToFetch(rows, stored, new Date("2027-01-10T10:00:00Z")), [2026, 2027]);
});

test("feature statistics need enough sends on both sides before they say anything", () => {
  const entries = Array.from({ length: 40 }, (_, index) => ({ subject: index < 10 ? "Hvad med det?" : "Nye æsker", previewText: "x", openIndex: 1, clickIndex: 1 }));
  assert.equal(buildFeatureStats(entries).some((stat) => stat.key === "question"), false, "10 questions is too few");
  const more = Array.from({ length: 40 }, (_, index) => ({ subject: index < 20 ? "Hvad med det?" : "Nye æsker", previewText: "x", openIndex: index < 20 ? 1.1 : 1, clickIndex: 1 }));
  const question = buildFeatureStats(more).find((stat) => stat.key === "question");
  assert.equal(question.openDifference, 0.1);
});

test("a sync reads Klaviyo through pagination, splits A/B arms and leaves bot clicks out", async (t) => {
  const calls = [];
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    const json = (payload) => ({ ok: true, status: 200, json: async () => payload });
    if (String(url).includes("/api/campaigns/") && !String(url).includes("page2")) {
      return json({
        data: [campaign("C1", "W17 - Urskrin - DK", "2026-04-26T08:00:00+00:00", ["M1", "M2"], "ab_test_campaign")],
        included: [
          message("M1", "W17 Variation A", "NYHEDER: Smykke- og urskrin", "", "2026-04-26T08:00:00+00:00"),
          message("M2", "W17 Variation B", "Mersalgsideer 💡", "", "2026-04-26T08:00:00+00:00")
        ],
        links: { next: "https://a.klaviyo.com/api/campaigns/?page2" }
      });
    }
    if (String(url).includes("page2")) {
      return json({ data: [campaign("C2", "W18", "2026-05-03T08:00:00+00:00", ["M3"])], included: [message("M3", "W18", "Fem nye æsker", "Se dem", "2026-05-03T08:00:00+00:00")], links: {} });
    }
    if (String(url).includes("/api/metrics/")) {
      return json({ data: ["Received Email", "Opened Email", "Clicked Email"].map((name, index) => ({ id: `m${index}`, attributes: { name, integration: { key: "klaviyo" } } })) });
    }
    if (String(url).includes("/api/metric-aggregates/")) {
      const metricId = JSON.parse(options.body).data.attributes.metric_id;
      const groups = {
        m0: [[["C1", "M1"], [150]], [["C1", "M2"], [450]], [["C2", ""], [600]]],
        m1: [[["C1", "M1"], [80]], [["C1", "M2"], [300]], [["C2", ""], [330]]],
        m2: [[["C1", "M1", "0.0"], [3]], [["C1", "M1", "1.0"], [40]], [["C1", "M2", "0.0"], [6]], [["C2", "", "0.0"], [12]], [["C2", "", "1.0"], [90]]]
      }[metricId];
      return json({ data: { attributes: { data: groups.map(([dimensions, unique]) => ({ dimensions, measurements: { unique } })) } }, links: {} });
    }
    return { ok: false, status: 404, json: async () => ({ errors: [{ detail: "unexpected" }] }) };
  };

  const { snapshot, synced, failed } = await syncSubjectLineHistory({
    markets: [{ country: "DK", privateKey: "pk_test" }],
    revision: "2024-10-15",
    now: new Date("2026-10-27T10:00:00Z")
  });
  assert.deepEqual([synced, failed], [["DK"], []]);
  const entries = Object.fromEntries(buildMarketEntries(snapshot.markets.DK).map((entry) => [entry.id, entry]));
  assert.deepEqual([entries.M1.received, entries.M1.opened, entries.M1.clicked], [150, 80, 3], "the 40 bot clicks are gone");
  assert.deepEqual([entries.M3.received, entries.M3.clicked], [600, 12]);
  const aggregateCalls = calls.filter((call) => call.url.includes("metric-aggregates"));
  assert.equal(aggregateCalls.length, 3, "one year, three metrics");
  assert.deepEqual(aggregateCalls[2].body.data.attributes.by, ["$message", "$variation", "Bot Click"]);
  assert.ok(calls.every((call) => call.method === "GET" || call.url.includes("metric-aggregates")), "read-only towards Klaviyo");
});

test("a nightly sync lists only campaigns changed since the last one, and the full list weekly", async (t) => {
  const urls = [];
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async (url, options = {}) => {
    urls.push(String(url));
    const json = (payload) => ({ ok: true, status: 200, json: async () => payload });
    if (String(url).includes("/api/campaigns/")) {
      return json({ data: [campaign("C9", "W44: Ny", "2026-10-26T11:45:00+00:00", ["M9"])], included: [message("M9", "W44", "Ny emnelinje", "Ny preheader", "2026-10-26T11:45:00+00:00")], links: {} });
    }
    if (String(url).includes("/api/metrics/")) {
      return json({ data: ["Received Email", "Opened Email", "Clicked Email"].map((name, index) => ({ id: `m${index}`, attributes: { name, integration: { key: "klaviyo" } } })) });
    }
    return json({ data: { attributes: { data: [] } }, links: {} });
  };
  const storedRow = { id: "M1", campaignId: "C1", campaignName: "W17", label: "", subject: "Gammel emnelinje", previewText: "", fromLabel: "", sentAt: "2023-04-26T08:00:00+00:00", abTest: false };
  const existing = {
    markets: {
      DK: {
        version: HISTORY_VERSION,
        country: "DK",
        syncedAt: "2026-10-26T04:50:00.000Z",
        fullListAt: "2026-10-24T04:50:00.000Z",
        messages: [storedRow],
        engagementByYear: { 2023: { "C1|": [500, 300, 5] }, 2024: {}, 2025: {}, 2026: {} }
      }
    }
  };
  const now = new Date("2026-10-27T04:50:00Z");
  const { snapshot } = await syncSubjectLineHistory({ markets: [{ country: "DK", privateKey: "pk" }], existing, revision: "2024-10-15", now });
  const listUrl = urls.find((url) => url.includes("/api/campaigns/"));
  assert.match(decodeURIComponent(listUrl), /greater-than\(updated_at,2026-10-23T04:50:00\)/, "three days of overlap before the last sync");
  assert.deepEqual(snapshot.markets.DK.messages.map((row) => row.id), ["M9", "M1"], "merged over the stored rows");
  assert.equal(snapshot.markets.DK.fullListAt, "2026-10-24T04:50:00.000Z");
  assert.equal(urls.filter((url) => url.includes("metric-aggregates")).length, 3, "only the current year re-read");

  urls.length = 0;
  const weekLater = await syncSubjectLineHistory({ markets: [{ country: "DK", privateKey: "pk" }], existing: snapshot, revision: "2024-10-15", now: new Date("2026-11-01T04:50:00Z") });
  assert.doesNotMatch(decodeURIComponent(urls.find((url) => url.includes("/api/campaigns/"))), /updated_at/, "the full list is re-read once a week");
  assert.equal(weekLater.snapshot.markets.DK.fullListAt, "2026-11-01T04:50:00.000Z");
});

test("insights pick the house voice, the evidence and the sender label from the history", () => {
  const snapshot = {
    markets: {
      DK: {
        country: "DK",
        language: "da",
        messages: Array.from({ length: 12 }, (_, index) => ({
          id: `M${index}`,
          campaignId: `C${index}`,
          campaignName: index === 3 ? "W45 Gaveæske Grand Prix" : `W${index} Nyhed`,
          label: "",
          subject: index === 3 ? "Stem på årets gaveæske" : `Emne ${index}`,
          previewText: "",
          fromLabel: index % 2 ? "Jette fra Westpack" : "Ida fra Westpack",
          sentAt: new Date(Date.parse("2026-06-01T08:00:00Z") + index * 5 * 86_400_000).toISOString(),
          abTest: false
        })),
        engagementByYear: { 2026: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`C${index}|`, [800, 400 + index * 5, 8]])) }
      }
    }
  };
  const insights = buildHistoryInsights(snapshot, { country: "DK", focusText: "gaveæske grand prix afstemning", now: new Date("2026-10-27T10:00:00Z") });
  assert.equal(insights.sendCount, 12);
  assert.equal(insights.relevant[0].subject, "Stem på årets gaveæske");
  assert.ok(["Ida fra Westpack", "Jette fra Westpack"].includes(insights.senderLabel));
  assert.equal(insights.pastSubjects.length, 12);
});
