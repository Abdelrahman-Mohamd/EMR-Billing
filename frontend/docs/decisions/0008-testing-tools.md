# 0008 — Vitest + React Testing Library now; Playwright deferred

**Status:** Accepted · 2026-09-25

## Context

The sibling EMR frontend has no test suite. That is the single largest maintenance risk in it, and the one
thing this codebase must not inherit — billing logic (hold windows, rule precedence, balance splits) is
exactly the kind of code that is wrong in ways nobody notices for a month.

The question is not whether to test, but which levels to set up before any feature exists.

## Decision

- **Vitest** as the runner: it uses the same Vite config, so tests see the same aliases, plugins and
  transforms as the app — no second build pipeline to keep in sync.
- **React Testing Library** for component and integration tests, queried by role and label, so tests describe
  user-visible behaviour and accessibility failures show up as test failures.
- **No `globals: true`.** `describe`/`it`/`expect` are imported, so a test file type-checks like any other
  module.
- Shared helpers exist from day one: `src/test/setup.ts` and `src/test/render.tsx` (per-test QueryClient,
  retries off), plus a worked route-test example in `src/routes/index.test.tsx`.
- **Playwright is deferred.** With no backend and no auth, an E2E suite would re-test what jsdom already
  covers, more slowly and more flakily. It gets introduced when a backend exists **and** a workflow crosses
  something jsdom cannot model — file download, print/PDF, real redirects, multi-tab session behaviour.
- **No global coverage threshold.** A percentage moves effort towards easy-to-cover code; the standard is
  instead "business rules and critical workflows are covered", checked in review.

## Consequences

- Tests run in seconds with no network and no backend, so they can gate every commit.
- The mock data layer (0006) doubles as the test data layer; MSW joins it when the first API-backed feature
  lands.
- E2E gaps — real browser behaviour, real auth — are knowingly uncovered until that decision is revisited.

## Revisit when

A backend and a staging environment exist. Then add Playwright for a handful of revenue-critical journeys
against seeded data, never against production data.
