# Billing System — frontend

React + TypeScript single-page application for the Billing System. **Foundation stage:** the architecture,
standards and tooling are in place; no business feature has been built yet.

The reviewed product prototype (vanilla JS, no build step) lives in [`../prototype`](../prototype) and remains
the reference for what each screen must do.

## Getting started

```bash
npm install
cp .env.example .env.local   # no backend exists yet; the defaults are correct
npm run dev
```

Node 20.19+ (or 22+). The app runs without a backend: `VITE_DATA_SOURCE=mock`.

## Scripts

| Script               | Does                                                      |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Dev server with HMR                                       |
| `npm run build`      | Type-check, then production build into `dist/`            |
| `npm run preview`    | Serve the production build locally                        |
| `npm run typecheck`  | `tsc -b`, no emit                                         |
| `npm run lint`       | ESLint, including the architecture and security rules     |
| `npm test`           | Vitest once (what CI runs)                                |
| `npm run test:watch` | Vitest in watch mode                                      |
| `npm run format`     | Prettier                                                  |
| **`npm run verify`** | typecheck + lint + test + build — run before every commit |

## Documentation

| Document                                                                           | Read it for                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| [CLAUDE.md](./CLAUDE.md)                                                           | How to work here (humans and AI both)      |
| [docs/FRONTEND_ARCHITECTURE.md](./docs/FRONTEND_ARCHITECTURE.md)                   | Structure, boundaries, routing, state, API |
| [docs/FRONTEND_ENGINEERING_STANDARDS.md](./docs/FRONTEND_ENGINEERING_STANDARDS.md) | Rules for writing a file                   |
| [docs/SECURITY.md](./docs/SECURITY.md)                                             | What we can and cannot protect             |
| [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md)                             | What to test and what not to               |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md)                                       | Budgets and the levers that matter         |
| [docs/decisions/](./docs/decisions/)                                               | Why things are the way they are            |

Product requirements are one level up: [`../PROJECT_MEMORY.md`](../PROJECT_MEMORY.md) is the index.

## Structure

```
src/
├── app/         providers and layouts (composition root)
├── routes/      TanStack Router file routes — thin
├── features/    the product, one folder per module (empty until the first feature)
├── components/  ui primitives and shared billing widgets
├── lib/         api client, query client, config, utils
├── stores/      cross-feature client state (rare)
├── test/        test setup and render helpers
└── styles/      Tailwind theme and design tokens
```

Dependency direction is `routes → features → shared`, enforced by ESLint. See the architecture doc.

## State of the foundation

Working and verified: TypeScript strict build, ESLint with architecture/security rules, Vitest + React
Testing Library (11 tests), Tailwind v4 with the shared design tokens, TanStack Router with automatic
route-level code splitting, TanStack Query defaults, Zod-validated environment, normalized API errors.

Not built, deliberately: any feature, authentication, permissions, forms, tables, and the mock data layer —
each waits for its first real use case or for the backend. See the architecture doc § Open decisions.
