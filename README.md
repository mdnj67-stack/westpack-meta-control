# Westpack Meta Control

Internal Westpack marketing operations and campaign production studio focused on:

- active campaigns only
- AI-assisted ad cloning and translation
- direct Meta account actions with approval before publish
- Klaviyo campaign overview across multiple market accounts
- Asana-driven campaign and content assembly
- AI-assisted email, Meta carousel and HTML/blog production
- persistent, versioned campaign assets in the local studio library

## Campaign Studio

Campaign Brain is a separate production surface. It does not replace or alter the established Meta duplicate, Klaviyo duplicate/translate or dashboard workflows.

Campaign Production System v2 compiles every generated email through `westpack-campaign-master-v2`. The live Westpack Header 2023, Footer 2023, preheader and legal regions are locked; campaign content is limited to 3–4 structured modules selected from the approved ten-module library. Campaign Studio edits those modules and recompiles the responsive email server-side, while deterministic QA blocks drafts that violate the master or module contract.

The Klaviyo Builder presents that same structured draft as a three-pane editing workspace: approved module library, exact desktop/mobile email canvas and focused Content/Design/AI inspector. Operators can select modules directly in the rendered email, drag to reorder, choose campaign assets, zoom the canvas, revise design and hero settings, request approval-based AI before/after suggestions, undo/redo changes, see live preflight issues and autosave the server-compiled draft without touching HTML. The reliability layer preserves the active field, cursor, inspector position and email-canvas scroll across asynchronous compilation, rejects stale compiler responses, restores Studio drafts after reload and quarantines expiring Asana image URLs until fresh proxied assets are available.

Current production flows:

- `Asana Combo`: campaign task + matched content task -> email, Meta, blog and reusable imagery
- `Meta from Master`: live Klaviyo template or pasted HTML + Asana content task -> five-card Meta carousel
- `Email Visual Composer`: raw approved Asana photography -> art-directed email imagery hosted in Klaviyo
- `Environment Studio`: approved source photography -> reusable, channel-tagged environment variants

Meta from Master uses the selected email/article as the factual authority, maps approved Asana images to a hook/problem/proof/benefit/CTA sequence, opens the result in the existing carousel editor, and reuses the existing Meta validation and paused-draft publish path. Campaign Studio Meta ads are locked to UK English (`en_GB`), exactly five designed carousel cards and draft-only delivery.

The carousel renderer converts AI art direction into deterministic `1080x1080` JPEG cards. Before generation, a deterministic Design DNA audit extracts the approved Klaviyo/HTML master's campaign palette, typographic character, image hierarchy, density, alignment and framing. AI translates that evidence into one coherent paid-social system; the universal email header, navigation, footer and legal regions are explicitly excluded. Studio exposes the translated palette, headline character, copy alignment and image framing as editable design tokens, and every re-render applies those tokens while code protects contrast, cropping, text wrapping and export. Original source photography is retained separately from rendered output, so repeated copy edits and re-renders never create nested designs or degrade the source. The end-to-end action writes the complete UK-English copy system, renders five cards, runs a live Meta preflight, uploads the finished files and creates the ad as `PAUSED`; publication still requires human approval.

Meta from Master now develops exactly three intentional routes—Faithful, Editorial and Performance—and executes one dominant route at a time. In addition to parsing HTML/CSS, it visually inspects reachable campaign imagery extracted from the approved master for crop language, product scale, lighting and negative space. After rendering, a separate Meta Creative Director sees all five finished JPEG cards and scores scroll-stop, hierarchy, mobile legibility, premium brand quality, narrative progression and source continuity. A pass requires 90/100 overall, every dimension at least 80 and no critical failure. Studio exposes the evidence, per-dimension scores and revision brief; selecting another route or applying the brief regenerates and re-reviews the complete campaign. A reviewed failure blocks the paused Meta draft handoff.

Campaign Studio reads the live Meta catalog for publication targeting. Operators select a campaign and its filtered ad set; names and IDs stay synchronized internally, while manual IDs remain available only as a fallback.

### Meta Historical Intelligence

The read-only historical intelligence layer syncs up to 730 days of Meta ads, creative copy, carousel structure and ad-level insights into persistent Redis (or an atomic local file outside Vercel). A nightly cron refreshes the 365-day learning window. Performance is compared only inside objective-and-format cohorts; ads need positive spend and at least 1,000 impressions before they can influence Creative DNA. Patterns and top-quartile exemplars are injected into Campaign Brain, Meta from Master and carousel copy generation as directional evidence. The prompt contract explicitly forbids verbatim copying and causal claims. The intelligence layer never changes campaigns, budgets or delivery state.

### Content Agent (decommissioned 2026-10-30)

An autonomous worker used to pick campaigns up from Asana every hour, produce them and put them
through an AI quality gate before a person saw them. Over 60 jobs it admitted one to review, so it
was removed: the hourly QStash schedule, the worker and its quality gate, the agent actions on
`/api/campaign/brain` and the console that sat on top of Campaign Studio. Campaign Studio itself
stays, and opens straight on its own workspace. `CONTENT_AGENT_MODEL` stays too, because the
subject line writers run on it.

## Current structure

- `index.html` contains the app layout
- `styles.css` contains the visual system
- `app.js` bootstraps the app
- `api/auth/*` contains the password wall session endpoints
- `src/data.js` holds mocked account and product state
- `src/services.js` contains integration-ready transformation logic
- `server/campaign/*` contains Campaign Brain domain contracts and compilers
- `src/campaign-meta-master.js` maps Meta from Master output into the existing Studio
- `src/ui.js` contains rendering and UI behavior
- `sync-klaviyo.ps1` builds a live Klaviyo snapshot from multiple market accounts

## Snapshot contract

- Meta dashboard snapshots are schema-versioned.
- Frontend cache and bundled snapshot loading only accept snapshots that match the current schema version.
- This prevents older local or browser-cached snapshots from silently rendering partial dashboard data after KPI/schema changes.

## Password wall

To lock the site behind a shared password:

1. Set `AUTH_PASSWORD` in Vercel or your local environment.
2. Set `AUTH_SESSION_SECRET` too if you want the login cookie signature to use a separate secret.
3. Redeploy or restart the local server.

When `AUTH_PASSWORD` is set, the frontend shows a login wall and the protected `/api/*` routes return `401` until the user is authenticated.

## Local smoke test

After starting `serve-local.ps1`, run:

`node smoke-local.js`

This verifies the local app shell, auth endpoints, and basic API routing without needing `vercel dev`. If `AUTH_PASSWORD` is set in your local env files, the smoke test logs in automatically before protected checks.
Use `node smoke-local.js --with-openai` when you also want a paid OpenAI route smoke-check.
The standard smoke run now also exercises non-destructive Meta publish dry-runs against live catalog data for duplicate flow plus create-mode single-image, carousel, and video payloads, and Klaviyo template rollout dry-runs for both single-template variants and market rollout assignments.
Restart `serve-local.ps1` after backend/api code changes so the local runtime reloads fresh modules and caches cleanly.
Use `GET /api/system/health` for a quick snapshot of local auth/config/integration readiness.

## Current product shape

### Dashboard

- active campaign overview
- AI recommendations
- winning patterns
- approval queue

### Create / Manage Ads

- choose source ad
- choose target campaign
- choose target language
- add operator notes
- generate an AI preview
- generate localized variants
- inspect a draft Meta publish payload
- prepare a publish action

### Klaviyo

- workspace split between `Meta` and `Klaviyo`
- grouped campaign overview across markets
- expandable market-level campaign metrics
- AI-style insight cards based on the synced campaign snapshot

## Local Meta sync

If you want the app to show live Meta data without a full backend yet:

1. Create `meta-config.json` from `meta-config.template.json`
2. Fill in your `appId`, `adAccountId`, and `accessToken`
3. Run `sync-meta.ps1`
4. Open `index.html`

The app will automatically prefer `data/meta-live.js` over the built-in mock data when that snapshot exists.

## Local OpenAI preview generation

After the Meta sync is available, you can generate an AI-based clone draft:

1. Run `generate-ai-preview.ps1`
2. Open `index.html`

The app will automatically prefer `data/ai-preview.js` when it exists.

## Local Klaviyo campaign sync

If you want the Klaviyo workspace to show live campaign data across your markets:

1. Create `klaviyo-config.json` from `klaviyo-config.template.json`
2. Add your Klaviyo market entries with `country`, `listId`, and `privateKey`
3. Run `sync-klaviyo.ps1`
4. Refresh the app

The app will automatically prefer `data/klaviyo-live.js` when that snapshot exists.

## Next build step

1. Add a real frontend app framework.
2. Connect Meta Marketing API authentication.
3. Fetch active campaigns, ad sets, ads, and insights live.
4. Connect OpenAI for real translation and copy adaptation.
5. Add audit logging and draft persistence.
