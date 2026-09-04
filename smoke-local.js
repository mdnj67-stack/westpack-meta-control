const cliArgs = process.argv.slice(2);
const baseUrl = cliArgs.find((arg) => !arg.startsWith("--")) || "http://127.0.0.1:4173";
const defaultTimeoutMs = 8000;
const cookieJar = [];
const withOpenAi = cliArgs.includes("--with-openai");

function parseDotEnv(content = "") {
  return String(content || "")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      acc[key] = value.replace(/\\r\\n/g, "\n");
      return acc;
    }, {});
}

async function loadLocalEnv() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const files = [".env.local", ".env.production", ".vercel.live.env"];
  const entries = {};

  for (const fileName of files) {
    try {
      const filePath = path.join(process.cwd(), fileName);
      const content = await fs.readFile(filePath, "utf8");
      Object.assign(entries, parseDotEnv(content));
    } catch (error) {
      // Ignore missing local env files.
    }
  }

  return entries;
}

function buildCookieHeader() {
  return cookieJar.join("; ");
}

function storeCookies(response) {
  const setCookie = response.headers.getSetCookie?.() || [];
  for (const cookie of setCookie) {
    const pair = String(cookie || "").split(";")[0].trim();
    if (!pair) {
      continue;
    }

    const key = pair.split("=")[0];
    const existingIndex = cookieJar.findIndex((item) => item.startsWith(`${key}=`));
    if (existingIndex >= 0) {
      cookieJar.splice(existingIndex, 1, pair);
    } else {
      cookieJar.push(pair);
    }
  }
}

async function request(path, options = {}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || defaultTimeoutMs;
  const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(cookieJar.length ? { Cookie: buildCookieHeader() } : {}),
        ...(options.headers || {})
      },
      body: options.body,
      signal: controller.signal
    });
    storeCookies(response);

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch (error) {
      json = null;
    }

    return {
      durationMs: Date.now() - startedAt,
      ok: response.ok,
      status: response.status,
      text,
      json
    };
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildMetaCreateDryRunPayload({ targetAdSet, adFormat, extras = {} }) {
  return {
    action: "validate_publish_draft",
    publish_action: "create_new_ad",
    source_ad_name: `Smoke ${adFormat} draft`,
    source_ad_id: "",
    target_campaign_name: targetAdSet.campaignName || "",
    target_campaign_id: targetAdSet.campaignId || "",
    target_adset_name: targetAdSet.name || "",
    target_adset_id: targetAdSet.id,
    target_language: "EN",
    destination_url: "https://www.westpack.com/",
    ad_format: adFormat,
    creative_strategy: {
      primary_text: `Dry-run validation for ${adFormat}.`,
      headline: `Dry-run ${adFormat}`,
      description: "Smoke validation only."
    },
    translated_attachments: [],
    publish_status: "draft",
    ...extras
  };
}

async function run() {
  const results = [];
  const localEnv = await loadLocalEnv();

  const home = await request("/");
  assert(home.status === 200, `GET / returned ${home.status}`);
  assert(home.text.includes("Mads' bibel"), "GET / did not render the expected app shell");
  results.push(`PASS  GET / -> ${home.status} (${home.durationMs}ms)`);

  const authSession = await request("/api/auth/session");
  assert(authSession.status === 200, `GET /api/auth/session returned ${authSession.status}`);
  assert(typeof authSession.json?.authenticated === "boolean", "Auth session response is missing 'authenticated'");
  assert(typeof authSession.json?.passwordEnabled === "boolean", "Auth session response is missing 'passwordEnabled'");
  results.push(`PASS  GET /api/auth/session -> ${authSession.status} (${authSession.durationMs}ms)`);

  if (authSession.json?.passwordEnabled) {
    const password = process.env.AUTH_PASSWORD || localEnv.AUTH_PASSWORD || "";
    assert(password, "Auth is enabled locally, but AUTH_PASSWORD is not available for smoke-login.");

    const login = await request("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    assert(login.status === 200, `POST /api/auth/login returned ${login.status}`);
    assert(login.json?.authenticated === true, "Smoke-login did not authenticate successfully");
    results.push(`PASS  POST /api/auth/login -> ${login.status} (${login.durationMs}ms)`);
  }

  const systemHealth = await request("/api/system/health");
  assert(systemHealth.status === 200, `GET /api/system/health returned ${systemHealth.status}`);
  assert(systemHealth.json?.integrations && typeof systemHealth.json.integrations === "object", "System health response is missing integrations");
  const configuredIntegrations = [
    systemHealth.json?.integrations?.openai?.configured ? "openai" : null,
    systemHealth.json?.integrations?.meta?.configured ? "meta" : null,
    systemHealth.json?.integrations?.klaviyo?.configured ? "klaviyo" : null
  ].filter(Boolean).join(", ") || "none";
  results.push(`PASS  GET /api/system/health -> ${systemHealth.status} (${systemHealth.durationMs}ms) :: configured=${configuredIntegrations}`);

  const metaHealth = await request("/api/meta/account-snapshot?health=1", {
    timeoutMs: 12000
  });
  assert(metaHealth.status !== 404, "GET /api/meta/account-snapshot?health=1 returned 404");
  assert(metaHealth.text.trim().length > 0, "Meta health endpoint returned an empty body");
  const metaMessage = metaHealth.json?.error || metaHealth.json?.status || "ok";
  results.push(`PASS  GET /api/meta/account-snapshot?health=1 -> ${metaHealth.status} (${metaHealth.durationMs}ms) :: ${metaMessage}`);

  if (systemHealth.json?.integrations?.meta?.configured) {
    // The full dashboard snapshot, with no query flags. Neither ?health=1 nor ?catalog=1
    // reaches the dashboard assembly - they return earlier - so this is the only request
    // that exercises the objective split, the budget allocation and the customer
    // acquisition payload. That gap let two "X is not a function" failures reach
    // production with every unit test green, because module load only proves the files
    // parse, not that the hand-wired dependency graph is complete.
    const metaSnapshot = await request("/api/meta/account-snapshot", {
      timeoutMs: 90000
    });
    assert(
      metaSnapshot.status === 200,
      `GET /api/meta/account-snapshot returned ${metaSnapshot.status} :: ${String(metaSnapshot.json?.error || metaSnapshot.text || "").slice(0, 300)}`
    );

    const quality = metaSnapshot.json?.dashboard?.quality;
    assert(quality, "Full snapshot returned no dashboard.quality block");
    assert(quality.generalSpendDistribution, "Snapshot is missing quality.generalSpendDistribution");
    assert(quality.budgetAllocation, "Snapshot is missing quality.budgetAllocation");

    const acquisition = quality.customerAcquisition;
    assert(acquisition, "Snapshot is missing quality.customerAcquisition");
    assert(acquisition.trend, "Snapshot is missing quality.customerAcquisition.trend");
    assert(
      typeof acquisition.trend.summary === "string" && acquisition.trend.summary.length > 0,
      "The customer acquisition trend has no summary line"
    );
    // Reconciliation the panel depends on: the three buckets must account for every
    // purchase, or the split is misstating the number the team is measured on.
    const bucketSum = Number(acquisition.newCustomers || 0)
      + Number(acquisition.existingCustomers || 0)
      + Number(acquisition.untaggedPurchases || 0);
    assert(
      bucketSum === Number(acquisition.totalPurchases || 0),
      `Customer buckets sum to ${bucketSum} but total purchases is ${acquisition.totalPurchases}`
    );

    const trend = acquisition.trend;
    assert(
      trend.comparable === false || trend.current.days === trend.previous.days,
      `Trend windows cover different day counts: ${trend.current.days} vs ${trend.previous.days}`
    );

    results.push(`PASS  GET /api/meta/account-snapshot -> ${metaSnapshot.status} (${metaSnapshot.durationMs}ms) :: newCustomers=${acquisition.newCustomers}, trend=${trend.direction} ${trend.delta >= 0 ? "+" : ""}${trend.delta}, untagged=${acquisition.untaggedShare}%, warnings=${(quality.warnings || []).length}`);

    const metaCatalog = await request("/api/meta/account-snapshot?catalog=1", {
      timeoutMs: 30000
    });
    assert(metaCatalog.status === 200, `GET /api/meta/account-snapshot?catalog=1 returned ${metaCatalog.status}`);
    const sourceAd = Array.isArray(metaCatalog.json?.ads) ? metaCatalog.json.ads[0] : null;
    const targetAdSet = Array.isArray(metaCatalog.json?.adSets) ? metaCatalog.json.adSets[0] : null;
    const catalogCacheState = String(metaCatalog.json?.cache?.status || "live");
    results.push(`PASS  GET /api/meta/account-snapshot?catalog=1 -> ${metaCatalog.status} (${metaCatalog.durationMs}ms) :: ads=${(metaCatalog.json?.ads || []).length}, adSets=${(metaCatalog.json?.adSets || []).length}, cache=${catalogCacheState}`);

    if (!sourceAd?.id || !targetAdSet?.id) {
      results.push(`WARN  Meta publish dry-runs skipped because the catalog fallback is missing ${!sourceAd?.id ? "source ads" : "target ad sets"}.`);
    } else {
      const metaDryRun = await request("/api/meta/publish-ad", {
        method: "POST",
        timeoutMs: 30000,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "validate_publish_draft",
          publish_action: "create_cloned_ad",
          source_ad_name: sourceAd.name || "Meta dry-run source",
          source_ad_id: sourceAd.id,
          target_campaign_name: targetAdSet.campaignName || "",
          target_campaign_id: targetAdSet.campaignId || "",
          target_adset_name: targetAdSet.name || "",
          target_adset_id: targetAdSet.id,
          target_language: "EN",
          destination_url: "https://www.westpack.com/",
          ad_format: "Single image",
          creative_strategy: {
            primary_text: "Dry-run validation only.",
            headline: "Dry-run headline",
            description: "Dry-run description"
          },
          translated_attachments: [],
          publish_status: "draft"
        })
      });
      assert(metaDryRun.status === 200, `POST /api/meta/publish-ad dry-run returned ${metaDryRun.status}`);
      assert(metaDryRun.json?.dryRun === true, "Meta dry-run response did not mark itself as dryRun");
      results.push(`PASS  POST /api/meta/publish-ad dry-run -> ${metaDryRun.status} (${metaDryRun.durationMs}ms) :: sourceAd=${sourceAd.id}`);

      const metaCreateImageDryRun = await request("/api/meta/publish-ad", {
        method: "POST",
        timeoutMs: 30000,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildMetaCreateDryRunPayload({
          targetAdSet,
          adFormat: "Single image",
          extras: {
            uploaded_image_variants: [
              { key: "square", meta_image_hash: "smoke_square_hash", name: "square.jpg" },
              { key: "portrait", meta_image_hash: "smoke_portrait_hash", name: "portrait.jpg" },
              { key: "vertical", meta_image_hash: "smoke_vertical_hash", name: "vertical.jpg" }
            ]
          }
        }))
      });
      assert(metaCreateImageDryRun.status === 200, `POST /api/meta/publish-ad single image dry-run returned ${metaCreateImageDryRun.status}`);
      assert(metaCreateImageDryRun.json?.dryRun === true, "Meta single image dry-run response did not mark itself as dryRun");
      results.push(`PASS  POST /api/meta/publish-ad create single-image dry-run -> ${metaCreateImageDryRun.status} (${metaCreateImageDryRun.durationMs}ms)`);

      const metaCreateCarouselDryRun = await request("/api/meta/publish-ad", {
        method: "POST",
        timeoutMs: 30000,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildMetaCreateDryRunPayload({
          targetAdSet,
          adFormat: "Carousel",
          extras: {
            uploaded_carousel_variants: [
              {
                key: "square",
                items: [
                  { meta_image_hash: "smoke_card_1_hash", name: "card-1.jpg" },
                  { meta_image_hash: "smoke_card_2_hash", name: "card-2.jpg" }
                ]
              }
            ],
            translated_attachments: [
              { name: "Card one", description: "First card" },
              { name: "Card two", description: "Second card" }
            ]
          }
        }))
      });
      assert(metaCreateCarouselDryRun.status === 200, `POST /api/meta/publish-ad carousel dry-run returned ${metaCreateCarouselDryRun.status}`);
      assert(metaCreateCarouselDryRun.json?.dryRun === true, "Meta carousel dry-run response did not mark itself as dryRun");
      results.push(`PASS  POST /api/meta/publish-ad create carousel dry-run -> ${metaCreateCarouselDryRun.status} (${metaCreateCarouselDryRun.durationMs}ms)`);

      const metaCreateVideoDryRun = await request("/api/meta/publish-ad", {
        method: "POST",
        timeoutMs: 30000,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildMetaCreateDryRunPayload({
          targetAdSet,
          adFormat: "Video",
          extras: {
            uploaded_video_variants: [
              { key: "square", meta_video_id: "smoke_square_video_id", name: "square.mp4" },
              { key: "vertical", meta_video_id: "smoke_vertical_video_id", name: "vertical.mp4" }
            ]
          }
        }))
      });
      assert(metaCreateVideoDryRun.status === 200, `POST /api/meta/publish-ad video dry-run returned ${metaCreateVideoDryRun.status}`);
      assert(metaCreateVideoDryRun.json?.dryRun === true, "Meta video dry-run response did not mark itself as dryRun");
      results.push(`PASS  POST /api/meta/publish-ad create video dry-run -> ${metaCreateVideoDryRun.status} (${metaCreateVideoDryRun.durationMs}ms)`);
    }
  }

  const klaviyoTemplatesValidation = await request("/api/klaviyo/templates", {
    timeoutMs: 5000
  });
  assert(klaviyoTemplatesValidation.status === 400, `GET /api/klaviyo/templates returned ${klaviyoTemplatesValidation.status}`);
  results.push(`PASS  GET /api/klaviyo/templates -> ${klaviyoTemplatesValidation.status} (${klaviyoTemplatesValidation.durationMs}ms)`);

  const klaviyoLive = await request("/api/klaviyo/templates?country=DK", {
    timeoutMs: 35000
  });
  assert(klaviyoLive.status !== 404, "GET /api/klaviyo/templates?country=DK returned 404");
  assert(klaviyoLive.text.trim().length > 0, "Klaviyo live template endpoint returned an empty body");
  const klaviyoSummary = klaviyoLive.json?.error
    || `templates=${Number(klaviyoLive.json?.templateCount || 0)}`;
  results.push(`PASS  GET /api/klaviyo/templates?country=DK -> ${klaviyoLive.status} (${klaviyoLive.durationMs}ms) :: ${klaviyoSummary}`);

  if (systemHealth.json?.integrations?.klaviyo?.configured && Array.isArray(klaviyoLive.json?.templates) && klaviyoLive.json.templates.length) {
    const sourceTemplate = klaviyoLive.json.templates[0];

    const klaviyoSingleVariantDryRun = await request("/api/klaviyo/push-template-rollout", {
      method: "POST",
      timeoutMs: 35000,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "single_template_variant",
        dryRun: true,
        country: "DK",
        sourceTemplateId: sourceTemplate.id,
        sourceTemplateName: sourceTemplate.name || "Smoke source template",
        sourceEditorType: sourceTemplate.editorType || "CODE",
        templateName: "Smoke Variant DK",
        subject: "Smoke subject",
        previewText: "Smoke preview",
        body: "<div><p>Smoke body for DK</p></div>"
      })
    });
    assert(klaviyoSingleVariantDryRun.status === 200, `POST /api/klaviyo/push-template-rollout single variant dry-run returned ${klaviyoSingleVariantDryRun.status}`);
    assert(klaviyoSingleVariantDryRun.json?.dryRun === true, "Klaviyo single variant dry-run response did not mark itself as dryRun");
    results.push(`PASS  POST /api/klaviyo/push-template-rollout single-variant dry-run -> ${klaviyoSingleVariantDryRun.status} (${klaviyoSingleVariantDryRun.durationMs}ms) :: sourceTemplate=${sourceTemplate.id}`);

    const klaviyoRolloutDryRun = await request("/api/klaviyo/push-template-rollout", {
      method: "POST",
      timeoutMs: 35000,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dryRun: true,
        sourceTemplateName: sourceTemplate.name || "Smoke rollout source",
        assignments: [
          {
            country: "DK",
            code: "DA",
            label: "Danish",
            translationPath: "smoke-rollout",
            subject: "Smoke rollout subject",
            previewText: "Smoke rollout preview",
            body: "<div><p>Smoke rollout body</p></div>"
          }
        ]
      })
    });
    assert(klaviyoRolloutDryRun.status === 200, `POST /api/klaviyo/push-template-rollout rollout dry-run returned ${klaviyoRolloutDryRun.status}`);
    assert(klaviyoRolloutDryRun.json?.dryRun === true, "Klaviyo rollout dry-run response did not mark itself as dryRun");
    results.push(`PASS  POST /api/klaviyo/push-template-rollout rollout dry-run -> ${klaviyoRolloutDryRun.status} (${klaviyoRolloutDryRun.durationMs}ms) :: entries=${(klaviyoRolloutDryRun.json?.results || []).length}`);
  }

  if (withOpenAi) {
    const openAiDashboard = await request("/api/openai/dashboard-agent", {
      method: "POST",
      timeoutMs: 30000,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        lens: "awareness",
        kpiGuidelines: {},
        executiveBrief: {},
        decisionBoard: [],
        pressureGroups: [],
        signals: [],
        campaigns: [],
        stats: {}
      })
    });
    assert(openAiDashboard.status === 200, `POST /api/openai/dashboard-agent returned ${openAiDashboard.status}`);
    assert(Array.isArray(openAiDashboard.json?.insights), "OpenAI dashboard response is missing insights");
    results.push(`PASS  POST /api/openai/dashboard-agent -> ${openAiDashboard.status} (${openAiDashboard.durationMs}ms) :: insights=${openAiDashboard.json.insights.length}`);
  }

  const authLogout = await request("/api/auth/logout", {
    method: "POST"
  });
  assert(authLogout.status === 200, `POST /api/auth/logout returned ${authLogout.status}`);
  assert(typeof authLogout.json?.authenticated === "boolean", "Logout response is missing 'authenticated'");
  results.push(`PASS  POST /api/auth/logout -> ${authLogout.status} (${authLogout.durationMs}ms)`);

  console.log(`Smoke base URL: ${baseUrl}`);
  for (const line of results) {
    console.log(line);
  }
}

run().catch((error) => {
  console.error(`FAIL  ${error.message}`);
  process.exitCode = 1;
});
