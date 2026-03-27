# Westpack Meta Control

Prototype for an internal Westpack website focused on:

- active campaigns only
- AI-assisted ad cloning and translation
- direct Meta account actions with approval before publish

## Current structure

- `index.html` contains the app layout
- `styles.css` contains the visual system
- `app.js` bootstraps the app
- `src/data.js` holds mocked account and product state
- `src/services.js` contains integration-ready transformation logic
- `src/ui.js` contains rendering and UI behavior

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

## Next build step

1. Add a real frontend app framework.
2. Connect Meta Marketing API authentication.
3. Fetch active campaigns, ad sets, ads, and insights live.
4. Connect OpenAI for real translation and copy adaptation.
5. Add audit logging and draft persistence.
