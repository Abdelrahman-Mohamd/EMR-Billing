# 0006 — Mock-first data layer behind the feature API boundary

**Status:** Accepted · 2026-09-25

## Context

There is no backend for the Billing System and no API contract. The frontend is being started early on
purpose, to buy time. Two bad options are available: wait, or build screens against data invented inline in
components — which then has to be torn out of fifty files when endpoints appear.

## Decision

Build against a mock data layer that sits **behind the feature API boundary**, not in front of it.

- A feature's `api/` folder exports the functions the rest of the feature calls (`fetchClaims`,
  `releaseClaim`). Those signatures are the contract the UI depends on.
- While the build-time constant `__MOCK_DATA__` is true — the dev server, tests, and a build made with
  `VITE_DATA_SOURCE=mock` — those functions resolve to a mock implementation next to the real one
  (`claims-api.mock.ts`) that returns data satisfying the same Zod schemas, with realistic latency. Otherwise
  they reject as `unavailable` until the endpoint exists.
- Mock data is invented. No real patient, payer or claim data, ever, in any fixture.
- Mocks are excluded from production builds, not merely unused: each api file tests `__MOCK_DATA__` itself
  and loads its mock with a dynamic `import()` in that branch (`src/lib/api/mock-data.d.ts` says why a
  shared helper variable would not work).
- Query hooks, components, tests and cache behaviour are identical in both modes.

## Consequences

- Screens, workflows, loading and error states can be built and reviewed now, and demonstrated to the client
  without a server.
- Swapping in real endpoints is a change inside `api/`, plus schema corrections — the UI does not move.
- The mock is a guess about the contract. It must not become a de-facto specification: anything invented in a
  mock that the product actually depends on is recorded as an assumption in
  the repository's `docs/PRD_CLARIFICATION_QUESTIONS.md`, the same way prototype assumptions are.
- Two implementations per endpoint to keep in step until the backend exists.

## Revisit when

The backend contract lands. The mock layer then becomes test-only (MSW) rather than a runtime mode, and
`VITE_DATA_SOURCE` loses its `mock` value.
