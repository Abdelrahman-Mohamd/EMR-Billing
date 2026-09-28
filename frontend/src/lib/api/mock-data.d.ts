/**
 * Whether a feature may answer from its in-memory mock (ADR 0006).
 *
 * Set at **build time** in `vite.config.ts`: true in the dev server and in
 * tests, and in a build made explicitly with `VITE_DATA_SOURCE=mock` (a demo
 * build); false in every other build.
 *
 * It is a compile-time constant, replaced inside each module, so a feature must
 * test it **directly** in its own api file:
 *
 *     if (__MOCK_DATA__) return (await import('./claims-api.mock')).mockClaimsApi
 *
 * In a production build that branch is dead before bundling, so the mock module
 * and its fixture data are never emitted — absent from the bundle, not merely
 * unused (docs/SECURITY.md "Configuration and build"). Copying the value into
 * an exported variable and testing that elsewhere defeats this: the bundler
 * decides which files to emit before it inlines constants across modules. A
 * static import of a mock keeps it in the bundle too.
 */
declare const __MOCK_DATA__: boolean
