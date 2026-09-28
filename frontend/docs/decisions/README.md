# Architectural Decision Records

Short records of decisions that are expensive to reverse or easy to re-litigate. One file per decision,
numbered, never edited once accepted — a decision that changes gets a new record that supersedes the old one.

**Write an ADR when** a choice constrains future work: a library everything depends on, a boundary, a data
ownership rule, an auth approach. **Do not write one** for naming, file placement, or anything the standards
docs already cover.

Format: Context → Decision → Consequences → Revisit when. Keep it under a page.

| #                                                | Decision                                                    | Status   |
| ------------------------------------------------ | ----------------------------------------------------------- | -------- |
| [0001](./0001-frontend-stack.md)                 | React + TypeScript + Vite + TanStack, matching the EMR app  | Accepted |
| [0002](./0002-feature-oriented-structure.md)     | Feature folders with a lint-enforced dependency direction   | Accepted |
| [0003](./0003-server-state-in-tanstack-query.md) | TanStack Query owns server state; Zustand never does        | Accepted |
| [0004](./0004-runtime-validation-with-zod.md)    | Zod validates every boundary; types are inferred            | Accepted |
| [0005](./0005-api-layer-and-error-taxonomy.md)   | One http client, per-feature API modules, normalized errors | Accepted |
| [0006](./0006-mock-first-data-layer.md)          | Mock-first data layer behind the feature API boundary       | Accepted |
| [0007](./0007-permissions-are-ux.md)             | Frontend permissions are UX; the server is the boundary     | Accepted |
| [0008](./0008-testing-tools.md)                  | Vitest + React Testing Library now; Playwright deferred     | Accepted |
