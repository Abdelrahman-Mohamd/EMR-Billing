# 0005 — One http client, per-feature API modules, normalized errors

**Status:** Accepted · 2026-09-25

## Context

Two failure modes to avoid. One is `fetch` scattered through components, where every call site invents its
own error handling, its own timeout (none), and its own loading flag. The other is a single `api.ts` that
grows to two thousand lines and belongs to nobody — which is where the sibling dashboard's `lib/*-api.ts`
files ended up.

A third problem is specific to error handling: UI code that branches on status numbers and message strings
breaks the moment the backend rewords a message.

## Decision

Four layers, each with one job:

```
component → feature query hook → feature api function → lib/api http client → backend
```

- `fetch` exists in exactly one file, `lib/api/http-client.ts`, and lint blocks it everywhere else.
- Each feature owns its endpoints in its own `api/` folder. There is no global API module.
- The client carries the session, times out at 20 s, passes the query's `AbortSignal`, validates the response
  against a Zod schema, and normalizes every failure into `ApiError`.
- `ApiError` has a `kind` — `network`, `timeout`, `unauthenticated`, `forbidden`, `not_found`, `conflict`,
  `validation`, `rate_limited`, `server`, `contract`, `unknown` — plus a user-safe `message`, a
  developer-only `detail`, optional `fieldErrors` and a `requestId`. UI branches on `kind`, never on a status
  code or a message string.

## Consequences

- Retry policy, session expiry and correlation ids are decided once for the whole app.
- A backend contract change is a change inside `lib/api` plus the feature's schemas, not a sweep of components.
- Raw server text cannot reach a user by accident: components render `userMessage(error)`.
- The request/response conventions currently coded (cookie session, FastAPI-style `{ detail }`,
  `x-request-id`) are assumptions borrowed from the sibling EMR backend and are marked provisional in the
  architecture doc.

## Revisit when

The real backend contract exists — expected changes are the error body shape and the auth mechanism, both
confined to this folder.
