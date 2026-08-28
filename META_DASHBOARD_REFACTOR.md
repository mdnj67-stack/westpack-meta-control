# Meta Dashboard Refactor Plan

## Goal

Make the Meta dashboard easier to change, safer to deploy, and more resilient to schema drift.

## Completed

1. Snapshot schema versioning
   API responses now include `schemaVersion`.
2. Frontend snapshot validation
   Bundled snapshots and browser-cached snapshots must match the current schema version.
3. Shared snapshot validation helper
   Snapshot validity checks now live in `src/data.js`.

## Next Batch

1. Extract Meta snapshot validation and cache helpers
   Move cache-key building, cache reads, and validation checks into a dedicated helper module.
2. Extract Meta dashboard metric helpers
   Move ROAS, CPA, CPL, CTR, change windows, and comparison logic into one reusable module.
3. Reduce `app.js` dashboard responsibility
   Split dashboard state, dashboard event wiring, and dashboard fallback calculations into separate modules.

## Must Fix

1. Metric logic should only live in one place.
2. Snapshot validity should fail loudly and predictably when the schema changes.
3. Dashboard fallback rendering should use the same metric rules as the live API response.

## Should Improve

1. Add tests for:
   - date range comparison windows
   - incremental vs standard attribution
   - `New` and zero-baseline change states
   - snapshot schema compatibility
2. Add a visible release or schema label in the UI.
3. Add a small diagnostics view for cache source, freshness, and live/snapshot mode.

## Nice To Have

1. Separate operator-facing labels from metric computation code.
2. Add a trend legend for previous-period overlays.
3. Add drilldowns from KPI cards into current vs previous period values.
