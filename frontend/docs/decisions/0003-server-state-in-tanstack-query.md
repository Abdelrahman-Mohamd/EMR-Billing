# 0003 — TanStack Query owns server state; Zustand never does

**Status:** Accepted · 2026-09-25

## Context

The classic failure in a data-heavy app is a global store that mirrors the server: a `claims` array plus
manual loading flags, manual invalidation, and two components disagreeing about what is current. Billing data
is edited by several people at once, so "a stale copy in a store" is not a theoretical problem — it is a
wrong number on someone's screen.

## Decision

Everything that comes from a server lives in the TanStack Query cache and nowhere else. Zustand holds only
state with no server origin: UI preferences, transient workflow state, session-only dismissals, dialog and
toast queues.

Copying a query result into `useState` or into a store is a review block. Query keys are built by the owning
feature in one key-factory file, hierarchically, so invalidation can be precise.

## Consequences

- Loading, error, retry, deduplication, cancellation and invalidation come from one place and behave the same
  on every screen.
- Two components that need the same data both call the hook and share one request — no prop-drilling "to
  avoid a second fetch".
- Cached PHI has a lifetime we control (`gcTime`) and one place to clear on sign-out.
- Values derived across queries are computed during render, not cached a second time.
- Mutations are never retried automatically, because a retried payment can post twice.

## Revisit when

The copy rule: never. `staleTime` and `gcTime` values are tuned per query as real usage appears.
