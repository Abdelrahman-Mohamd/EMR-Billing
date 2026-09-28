# Frontend Architecture

The technical reference for this codebase. Rules you apply while writing a file live in
[FRONTEND_ENGINEERING_STANDARDS.md](./FRONTEND_ENGINEERING_STANDARDS.md); this document is about where code
goes and how the pieces fit.

**Status: foundation only.** No business feature exists yet. Anything below marked _provisional_ depends on a
backend that does not exist and will be revisited when it does.

---

## 1. Shape of the application

A single-page React application. One user-facing product, many modules (Admin, Patients, Charges, Claims,
Buckets, …), heavy tables, heavy forms, long-lived sessions, sensitive data throughout.

Three layers, and the dependency arrow only ever points down:

```
routes/        URL, params, guards, and which feature to render
   ↓
features/      the product: screens, business logic, data access for one module
   ↓
components/, lib/, stores/, types/      shared infrastructure that knows nothing about billing
```

`app/` sits beside routes as the composition root (providers, layouts). It may import anything; nothing
imports it except `main.tsx` and routes.

Lint enforces this. A shared file that imports a feature, or a feature that reaches into another feature's
files, fails `npm run lint` with the reason.

---

## 2. Folder structure

```
src/
├── app/                    composition root — React wiring only, no business logic
│   ├── providers/          AppProviders: every context the app needs, in one tree
│   └── layouts/            shell layouts (app chrome, auth shell) — when they exist
│
├── routes/                 TanStack Router file routes. Thin by rule (§4)
│
├── features/               the product. One folder per business module (§3)
│
├── components/
│   ├── ui/                 product-agnostic primitives: Button, Dialog, Table, Field
│   └── shared/             product-aware, cross-feature: MoneyCell, ClaimStatusPill
│
├── lib/
│   ├── api/                http client + ApiError. The only place fetch() is allowed
│   ├── query/              QueryClient and shared query helpers
│   ├── config/             env parsing (Zod)
│   ├── utils/              cn, formatters — small, named, tested
│   ├── auth/               session handling — when auth exists
│   └── permissions/        can() — when the permission matrix exists
│
├── stores/                 Zustand stores used by more than one feature (rare — §6)
├── types/                  types shared across features (rare — most types live in a feature)
├── test/                   test setup and render helpers
└── styles/                 Tailwind theme and design tokens
```

**Nothing is created until it is needed.** `features/`, `components/`, `stores/` and `types/` are empty
today on purpose; an empty folder full of placeholder files is worse than no folder.

### What goes where, in one line each

| Folder               | Put this here                                                            | Do not put this here                     |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `app/`               | Providers, layouts, router creation                                      | Anything a feature could own             |
| `routes/`            | Path, param/search schemas, guards, loaders, one feature component       | Data shaping, forms, tables              |
| `features/`          | Screens, feature hooks, feature API calls, business rules, feature state | Anything two unrelated features need     |
| `components/ui/`     | Primitives with no idea what a claim is                                  | Anything that imports from `features/`   |
| `components/shared/` | Billing-aware widgets used by ≥ 2 features                               | A widget only one feature uses           |
| `lib/`               | Infrastructure: http, query client, config, formatting                   | Business rules, feature-specific helpers |
| `stores/`            | Client state ≥ 2 features read                                           | Server data (§6)                         |

**Default answer: it belongs in the feature.** Promote to `shared/` or `lib/` on the second real consumer,
not on the first guess that there might be one.

---

## 3. Feature boundaries

A feature is a business module: `patients`, `charges`, `claims`, `coding-rules`, `admin-providers`. It owns
its screens, its data access, its business logic and its types.

```
features/claims/
├── index.ts          the ONLY file other features may import
├── api/              request functions + response schemas for this domain
├── queries/          useClaims, useReleaseClaim — TanStack Query hooks + query keys
├── components/       screens and the parts they are built from
├── schemas/          Zod form schemas
├── model/            pure functions: business rules, derivations, no React
├── store.ts          feature-local Zustand (rare)
└── types.ts
```

Create subfolders when there is something to put in them. A feature with four files is four files.

**Cross-feature rules**

- Inside a feature, always import relatively (`./model/hold`, `../api/claims-api`).
- Across features, import the other feature's root only: `import { ClaimStatusBadge } from '@/features/claims'`.
  Deep imports are a lint error, which keeps a feature free to move its own files.
- Cycles are banned. If A needs B and B needs A, the shared part belongs one level down (`components/shared`,
  `lib`, or a new smaller feature) — not in either of them.
- A feature never imports a route.

**Cross-feature communication** happens through: the URL (a route param or search param), the server cache (a
query key another feature also reads), or an explicit exported function/component. Not through a global event
bus, and not through a shared mutable store invented for one hand-off.

---

## 4. Routing

TanStack Router, file-based, generated into `src/routeTree.gen.ts` by the Vite plugin
(`autoCodeSplitting: true`, so every route component is its own chunk).

A route file is allowed to do exactly five things:

1. Declare the path.
2. Validate and type its params and search params (Zod — `validateSearch`).
3. Declare data requirements (`loader`, usually `queryClient.ensureQueryData`).
4. Guard access (`beforeLoad`: authentication, then permission — §8).
5. Render **one** feature component and pass it typed params.

Anything else — layout composition beyond the shell, data shaping, forms, tables — lives in the feature. A
route file that grows past ~50 lines is doing a feature's job.

```tsx
// routes/claims.$claimId.tsx  — the shape to copy
export const Route = createFileRoute('/claims/$claimId')({
  params: { parse: claimParamsSchema.parse },
  beforeLoad: ({ context }) => requirePermission(context, 'claims:read'),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(claimQuery(params.claimId)),
  component: ClaimDetailRoute,
})

function ClaimDetailRoute() {
  const { claimId } = Route.useParams()
  return <ClaimDetailScreen claimId={claimId} />
}
```

**Search params are state.** Table filters, pagination, sort, the selected tab and the selected case belong in
the URL, typed by a Zod schema, so a screen can be linked, reloaded and shared. They do not belong in Zustand.

Errors and empty routes are handled once in `routes/__root.tsx` (`errorComponent`, `notFoundComponent`) and
overridden per route only when a screen can say something more useful.

**Layouts.** The root is bare (an `<Outlet />` and the toast region). Every signed-in screen lives under the
pathless `routes/_app.tsx`, which renders the rail; `routes/login.tsx` sits outside it. The route guard, once
there is a session to check, goes in `_app.tsx`'s `beforeLoad` and covers every screen below it at once.

---

## 5. Server state — TanStack Query

TanStack Query owns everything that comes from a server: fetching, caching, retries, invalidation, request
lifecycle. No server data is copied into Zustand or into `useState`. _(ADR 0003.)_

**Query keys** are built by the feature that owns the data, in one file, never hand-typed at a call site:

```ts
// features/claims/queries/claim-keys.ts
export const claimKeys = {
  all: ['claims'] as const,
  lists: () => [...claimKeys.all, 'list'] as const,
  list: (filters: ClaimFilters) => [...claimKeys.lists(), filters] as const,
  details: () => [...claimKeys.all, 'detail'] as const,
  detail: (id: ClaimId) => [...claimKeys.details(), id] as const,
}
```

That hierarchy is what makes invalidation precise: after releasing a claim, invalidate `claimKeys.lists()` and
the one detail, not the whole cache.

**Defaults** live in `lib/query/query-client.ts` and are deliberate:

| Setting                | Value                         | Why                                                                           |
| ---------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `staleTime`            | 30 s                          | Several people edit the same billing data; but a tab switch shouldn't refetch |
| `gcTime`               | 5 min                         | Cached PHI should not linger in memory longer than a workflow needs           |
| `retry` (queries)      | ≤ 2, only network/timeout/5xx | Retrying a 403 or 404 only delays the message the user needs                  |
| `retry` (mutations)    | never                         | A retried "post payment" can post twice                                       |
| `refetchOnWindowFocus` | off                           | A table must not reshuffle under a user who alt-tabbed back                   |

Per-query overrides are fine — with a comment saying why.

**Mutations** invalidate; they do not patch the cache by hand unless the optimistic update is worth it.
Optimistic updates are reserved for cheap, reversible, non-financial toggles, never for money movement, and
always with a rollback in `onError`.

**The one exception: sign-in does not use `useMutation`.** TanStack Query keeps a mutation's variables — for
sign-in, the password — in its cache and shows them in devtools until the entry is collected. Sign-in has
nothing to cache and ends in a navigation, so it calls its API function directly and React Hook Form tracks the
submitting state. On success the whole query cache is cleared, so a new session never sees the previous one's
data. Any future credential-bearing request (a password change) follows the same rule.

---

## 6. Client state — Zustand and the state ladder

Ask, in this order, and stop at the first yes:

1. **Does it belong in the URL?** Filters, sort, page, tab, selected entity → search/route params.
2. **Does it come from the server?** → TanStack Query.
3. **Can it be derived during render?** → derive it. Do not store it, do not `useEffect` it into state.
4. **Is it used by one component and its children?** → `useState` / `useReducer`, or props.
5. **Is it genuinely cross-component client state?** → Zustand.

Zustand is for: transient workflow state that spans screens, UI preferences (rail collapsed, table density),
session-only dismissals, and toast/dialog queues. Stores stay small and are read through selectors
(`useX((s) => s.field)`), never as whole objects, so one field's change does not re-render every subscriber.

**Persistence is opt-in and audited.** No patient, claim, payment or coverage data is persisted to browser
storage, ever — see [SECURITY.md](./SECURITY.md). Preferences (booleans, enum-ish UI settings) are the only
candidates, and they go through `lib/storage`, not a raw `localStorage` call.

---

## 7. API layer

```
component
   ↓ calls
feature query hook        useClaims()            features/claims/queries/
   ↓ calls
feature api function      fetchClaims()          features/claims/api/
   ↓ calls
http client               request()              lib/api/http-client.ts
   ↓
backend
```

Rules:

- `fetch` exists in exactly one file (lint-enforced). Everything else goes through `request()`.
- **No global `api.ts`.** Each feature owns its endpoints, in its own `api/` folder.
- Every response is parsed with a Zod schema at the boundary. A 2xx body that does not match its schema is a
  failed request (`ApiError` kind `contract`), not a value the UI has to survive. Feature types are inferred
  from those schemas (`z.infer`), never hand-written alongside them.
- Errors are normalized to `ApiError` with a `kind` (`network`, `timeout`, `unauthenticated`, `forbidden`,
  `not_found`, `conflict`, `validation`, `rate_limited`, `server`, `unavailable`, `contract`, `unknown`). UI branches on
  `kind`; it never parses a message or a status code.
- Every request carries an `AbortSignal` from TanStack Query and a 20 s timeout.

**Provisional (no backend exists):** cookie-based session (`credentials: 'include'`), FastAPI-style
`{ detail }` error bodies, and `x-request-id` for correlation are assumptions taken from the sibling EMR
backend. They are confined to `lib/api/` so that a different contract changes that folder and nothing else.

**Until there is a backend**, a feature's `api/` module resolves to a mock implementation behind the same
function signatures. The mock lives next to the real one (`claims-api.mock.ts`), returns data that satisfies
the same Zod schemas, and is loaded only through `if (__MOCK_DATA__) … await import('./claims-api.mock')`,
tested in the api file itself. `__MOCK_DATA__` is a build-time constant (`vite.config.ts`, declared in
`src/lib/api/mock-data.d.ts`): true in the dev server, in tests, and in a build made with
`VITE_DATA_SOURCE=mock`; false otherwise, and then the mock is never emitted. Outside a mock build the
functions reject as `unavailable` rather than guess at an endpoint. Consumers cannot tell the difference,
which is the point: swapping in the real endpoint is a change inside `api/`. _(ADR 0006;
`features/admin-organizations/api/` is the first example.)_

**Wire shape vs. screen shape.** The backend speaks snake_case (`is_active`, `organization_id`); the app is
camelCase. The two meet in one place per feature and nowhere else:

- `schemas/*-payload.ts` — the request bodies, exactly as the backend's payloads show them.
- `api/payloads.ts` — form values → request body. Its tests pin the output against the example payloads.
- `schemas/<entity>.ts` — the response schema, which parses the wire shape and `.transform`s it into the
  camelCase type the screens use (`z.output<…>`).

The development mock plays the **server**: it receives the real payload and answers in wire format, so the
mapping and the parsing both run in development exactly as they will in production. Optional fields are left
out of a payload when empty, as the examples do. _(`features/admin-practices` is the reference.)_

---

## 8. Permissions and authentication boundaries

**The frontend's permission model is a UX feature, not a security control.** Hiding a button prevents mistakes,
not attackers. Every rule below is also enforced server-side or it is not enforced at all — see
[SECURITY.md](./SECURITY.md).

Design when the backend model exists (§ Open decisions):

- One source of truth: a permission matrix fetched once per session and exposed as `can(key, level)` in
  `lib/permissions`.
- Three enforcement points: route (`beforeLoad` redirects), section (render nothing rather than a broken
  screen), action (a disabled control with a reason, or no control at all).
- `if (user.role === 'admin')` scattered through components is banned. Roles map to permissions in one place;
  components ask about capability (`can('claims:release')`), never about role.
- Unknown state is explicit: while the matrix is loading, guards wait rather than flashing a forbidden screen.
- A 403 from the server is treated as authoritative and surfaced calmly — the UI was out of date, not the user.

---

## 9. Errors, loading and empty states

**Errors.** Three levels: route `errorComponent` (render/loader failure), screen-level inline error with a
Retry (query failure), and a toast (mutation failure). Users see `userMessage(error)`; raw server text, stack
traces and request payloads never reach the DOM.

**Loading.** Route transitions use the router's pending state; lists and tables use skeletons that match the
final layout; buttons that fire a mutation go into a disabled busy state so nothing is submitted twice. No
full-page spinner after the first paint.

**Empty.** Every list has a designed empty state that says what the thing is and what to do next — the
prototype's empty states are the reference for the wording, since they were reviewed with the client.

---

## 10. Components and the design system

Three tiers: `components/ui` (primitives, no billing knowledge) → `components/shared` (billing-aware, reused)
→ feature components (everything else). **The built inventory is listed in [UI_KIT.md](./UI_KIT.md)** — read
it before writing a component.

The design tokens in `styles/index.css` come from the reviewed prototype, which is the approved visual
direction. Changing the look of the product means changing a token, not a component.

- The design system **emerges**: build the third usage, not the first. Two similar buttons are cheaper than one
  wrong abstraction.
- Primitives wrap accessible behaviour (focus, keyboard, ARIA) once. Radix supplies the floating surfaces
  (dialog, dropdown menu, popover) because hand-rolled focus traps are where accessibility quietly breaks.
  Everything a native element already does well — select, checkbox, radio, date — stays native.
- Styling is Tailwind with the tokens in `styles/index.css` (shared with the EMR product). Use tokens, not raw
  hex or arbitrary values. Variants come from a small `cn()`-based map, not string concatenation.
- Presentational components take data and callbacks; they do not call hooks that fetch. Feature components
  fetch and compose.

---

## 11. Testing and performance

Full documents: [TESTING_STRATEGY.md](./TESTING_STRATEGY.md), [PERFORMANCE.md](./PERFORMANCE.md).

Architecture-relevant summary: tests use the real router and a per-test QueryClient through
`src/test/render.tsx`; business rules live in `model/` as pure functions precisely so they can be tested
without React; route-level code splitting is automatic, and any further splitting is justified by a measured
number, not a feeling.

---

## 12. Dependencies

Current runtime dependencies: React, React DOM, TanStack Router, TanStack Query, Zod, Zustand, clsx,
tailwind-merge, React Hook Form (+ `@hookform/resolvers`), `lucide-react`, and three Radix primitives —
`react-dialog`, `react-dropdown-menu`, `react-popover`. Everything else in `package.json` is build or test
tooling.

Radix is used for floating surfaces only — dialog, dropdown menu, popover — where focus trapping, portalling
and positioning are genuinely hard. Everything inside those surfaces is ours.

**Checkbox and radio stay native elements**, styled on the element: keyboard behaviour, the indeterminate
state and screen-reader announcement come free. **Select and date are custom** (client decision, 2026-09-25):
the design needs two-line options, chips and a styled calendar, and a half-native, half-custom set of
dropdowns reads as two different products. The keyboard behaviour a native control would have given us is
written once in `Combobox` and `DateInput`, and tested.

**Approved, to be installed on first real use** (decided now so nobody re-litigates it mid-feature, not
installed now because unused dependencies are supply-chain surface with no benefit):

| Library                          | For                            | Installed when                   |
| -------------------------------- | ------------------------------ | -------------------------------- |
| `msw`                            | Network-level mocking in tests | The first API-backed feature     |
| `@tanstack/react-query-devtools` | Cache inspection in dev        | The first non-trivial query set  |
| `@tanstack/react-virtual`        | Virtualized rows               | A list proven too slow paginated |
| `@radix-ui/react-tabs`           | In-page tab panels             | A tab set that is not a URL      |

Anything not on this list needs the four-question justification in
[FRONTEND_ENGINEERING_STANDARDS.md](./FRONTEND_ENGINEERING_STANDARDS.md) § Dependencies.

---

## 13. Open decisions

These cannot be answered responsibly yet. They are called out here so nobody invents an answer quietly.

| Open                                | Blocked on               | What we did instead                                                                                                                                                                             |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth mechanism (cookie vs token)    | Backend + infrastructure | Cookie assumed, isolated in `lib/api`; no token storage                                                                                                                                         |
| Auth endpoints, session, "who am I" | Backend; client (Q-025)  | Payloads known (sign in, change password, forgot-password send/verify/reset); sign-out and "who am I" have none. All built against `features/auth/api/auth-api.ts`, dev mock only; no guard yet |
| Permission matrix shape             | Backend RBAC model       | `can()` designed, not implemented                                                                                                                                                               |
| Error body contract                 | Backend                  | FastAPI-style assumed, normalized in one file                                                                                                                                                   |
| Pagination style (page vs cursor)   | Backend                  | Table contract designed around either                                                                                                                                                           |
| File upload / export endpoints      | Backend                  | Nothing built                                                                                                                                                                                   |
| Deployment target & CSP headers     | Infrastructure           | Requirements listed in SECURITY.md for whoever owns it                                                                                                                                          |
| Error/monitoring service            | Infrastructure decision  | `sourcemap: 'hidden'` ready; no SDK installed                                                                                                                                                   |
| i18n                                | Product decision         | Not built; strings inline in English                                                                                                                                                            |
