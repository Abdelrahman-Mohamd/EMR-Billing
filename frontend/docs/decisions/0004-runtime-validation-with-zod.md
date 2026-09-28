# 0004 — Zod validates every boundary; types are inferred

**Status:** Accepted · 2026-09-25

## Context

TypeScript checks the code we write; it does not check what arrives at runtime. A response annotated as
`Claim` is a hope, not a fact — and in a billing system a silently missing field becomes a wrong amount on a
screen rather than a crash. There is no backend yet, so there is no generated client to trust either.

## Decision

Zod is the single source of truth for external shapes, at four boundaries: environment variables, API
responses, route params and search params, and form input. TypeScript types are **inferred** from those
schemas (`z.infer`), never hand-written beside them.

A 2xx response that fails its schema is a failed request (`ApiError` kind `contract`), not a value the UI has
to defend against. Inside the boundary, code trusts its types and does not re-validate.

## Consequences

- A backend change that drops or renames a field fails loudly at the boundary, naming the field path, instead
  of rendering `undefined` three screens later.
- Schema and type cannot drift, because there is only one of them.
- A small runtime cost per response and schemas to maintain — acceptable for clinical and financial data.
- Frontend validation remains a UX feature. The server validates independently and wins; see
  [SECURITY.md](../SECURITY.md).

## Revisit when

A real API contract exists. Then decide whether schemas are generated from an OpenAPI spec or stay
hand-written — the decision to validate at the boundary stands either way.
