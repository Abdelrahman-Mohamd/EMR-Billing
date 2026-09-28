# 0001 — Frontend stack

**Status:** Accepted · 2026-09-25

## Context

The Billing System frontend starts from nothing, but not in isolation. The same team runs the EMR frontend
(`d:\emr`) — React 19, TypeScript, Vite, TanStack Router, TanStack Query, Zustand, Zod, Tailwind v4 — and a
second product (`home-care-dashboard`) on the same stack. The Billing System is the EMR's companion product,
shares its visual language, and will be maintained by the same people.

## Decision

Use the same stack: React 19, TypeScript (strict, plus `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`), Vite, TanStack Router (file-based), TanStack Query, Zustand, Zod, Tailwind v4
with the EMR's design tokens.

Two deliberate differences from the EMR app: **Vitest + React Testing Library from day one** (the EMR app has
no tests, which is the one thing not to copy), and **ESLint carrying architecture rules** rather than a
style-only linter.

## Consequences

- A developer moving between products recognizes everything; review standards transfer.
- Shared design tokens make the two products look like one system.
- We inherit the stack's cost: ~103 kB gzip before any feature exists, and a generated route tree as a build
  step.
- Where the EMR app took a shortcut — no tests, no boundary enforcement, no runtime validation of responses —
  this codebase does not copy it. See 0002, 0004, 0008.

## Revisit when

React or TanStack ship majors, or the two products diverge enough that shared conventions stop paying for
themselves.
