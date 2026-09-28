# 0002 — Feature folders with an enforced dependency direction

**Status:** Accepted · 2026-09-25

## Context

The product has roughly fifteen modules: Admin, Providers, Organizations, Insurance, Payer Portals, Procedure
Codes, Referring Physicians, Coding Rules, Submission, Patients, Cases, Coverage, Charges, Claims, Buckets.
Organized by technical type (`components/`, `hooks/`, `services/`), each module's code scatters across four
folders and every change becomes a repository-wide search.

The sibling `home-care-dashboard` shows both halves of this: its features are well separated, but its API
layer is a flat `lib/*-api.ts` pile that no longer belongs to any feature.

## Decision

Organize by feature. `src/features/<module>/` owns its screens, data access, business rules and types. Shared
code lives below it in `components/`, `lib/`, `stores/`, `types/` and knows nothing about billing.

The direction `routes → features → shared` is enforced by ESLint, not by convention:

- shared code may not import a feature, a route, or app wiring;
- a feature may not import a route, and reaches another feature only through its `index.ts`;
- inside a feature, imports are relative — so an `@/features/...` import always means "crossing a boundary"
  and the rule can see it.

## Consequences

- "Where does Coding Rules code live?" has a one-word answer.
- Deleting or restructuring a feature is safe, because nothing reaches inside it.
- Some duplication is accepted early: code is promoted to `shared/` on the second real consumer, not on the
  first guess that there might be one.
- Cross-feature needs surface as lint errors, which is the point — they get designed rather than sneaking in.

## Revisit when

Two features need to share a large amount of domain logic (claims and charges are the likely pair). The answer
then is a third, smaller feature module — not a relaxed rule.
