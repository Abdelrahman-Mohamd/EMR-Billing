# Engineering Standards

Rules that apply while writing a file. Structure and layering are in
[FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md); security rules are in [SECURITY.md](./SECURITY.md).

Every rule here is either enforced by lint/TypeScript (marked **[enforced]**) or checked in review. A rule you
cannot point at in a diff is not a rule — those are deliberately absent.

---

## TypeScript

- `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noUnusedLocals`, `noUnusedParameters`. **[enforced]**
- **No `any`.** **[enforced]** Use `unknown` plus narrowing, a generic, or a named type. An untyped payload is
  narrowed by a Zod schema at the boundary, never cast inward.
- No `as` to silence the compiler, and no `!` non-null assertion in `src/` outside tests. If a value can be
  absent, handle absence. The legitimate casts are `as const` and narrowing after a type guard.
- Types are **inferred from Zod schemas** (`type Claim = z.infer<typeof claimSchema>`), never hand-written in
  parallel with one.
- Model states as **discriminated unions**, not booleans that can contradict each other:
  `{ status: 'held'; reason: HoldReason } | { status: 'submitted'; sentAt: string }` beats
  `{ isHeld: boolean; isSubmitted: boolean }`.
- Identifiers are branded where mixing them would be a real bug: `type ClaimId = string & { __brand: 'ClaimId' }`.
  Use this for ids that travel far (claim, patient, visit) — not for every string.
- `switch` over a union has no `default` and must be exhaustive. **[enforced]**
- Types live with the code that owns them (`features/x/types.ts`). `src/types/` is only for types genuinely
  shared across features. There is no global `types.ts` dumping ground.
- An escape hatch (`eslint-disable`, `@ts-expect-error`) needs a comment on the line above saying why, and
  `@ts-expect-error` is preferred to `@ts-ignore` because it fails when it stops being needed.

## React

- Function components only. No class components except an error boundary if React requires one.
- One exported component per file, named the same as the file (`ClaimDetailScreen.tsx`). Small internal
  sub-components in the same file are fine until the file passes ~200 lines.
- **Derive, don't store.** Anything computable from props/state/server data is computed during render. A
  `useState` that mirrors a prop is a bug waiting for a stale render.
- **`useEffect` is for synchronizing with something outside React** — a subscription, an event listener, a
  timer, focus, `document.title`, an imperative browser API. That is the whole list.
  Do **not** use an effect to: fetch (use a query), transform data (derive it), reset state on prop change
  (use `key`), or react to a user action (do it in the event handler).
- Event handlers do the work: mutate, navigate, toast. Effects do not.
- Refs for imperative DOM access and mutable values that must not trigger a render. Never to smuggle state
  past the render cycle.
- Controlled inputs by default; uncontrolled (via React Hook Form) for large forms where per-keystroke
  re-renders cost something measurable.
- Keys are stable ids from the data. Never the array index for anything reorderable or editable.
- Conditional rendering with ternaries or early returns, not `&&` on a number (`{count && <X/>}` renders `0`).
- A component that both fetches and renders 300 lines of markup is two components.

## Hooks

- Rules of hooks are enforced by lint; the exhaustive-deps warning is fixed, not suppressed. If a dep is
  genuinely irrelevant, restructure (move the function inside, use a ref) instead of lying to the linter.
- A custom hook exists to reuse **logic**, not to wrap a one-liner. `useClaimFilters()` yes; `useIsOpen()` no.
- Custom hooks return a named object for three or more values, a tuple for exactly two.
- Hooks that fetch live in `features/x/queries/` and are named `useX` / `useXMutation`.

## Naming and files

| Thing          | Convention                    | Example                          |
| -------------- | ----------------------------- | -------------------------------- |
| Component file | `PascalCase.tsx`              | `ClaimDetailScreen.tsx`          |
| Hook file      | `kebab-case.ts`               | `use-claim-filters.ts`           |
| Other modules  | `kebab-case.ts`               | `claims-api.ts`, `hold-rules.ts` |
| Route file     | TanStack convention           | `claims.$claimId.tsx`            |
| Test           | next to the subject           | `hold-rules.test.ts`             |
| Zod schema     | `xSchema`                     | `claimSchema`, `holdFormSchema`  |
| Query keys     | `xKeys`                       | `claimKeys`                      |
| Boolean        | `is` / `has` / `can`          | `isHeld`, `canRelease`           |
| Handler prop   | `onX`; handler impl `handleX` | `onRelease` / `handleRelease`    |

Use the domain's own words — `claim`, `charge`, `bucket`, `hold`, `guarantor`, `payer` — exactly as the PRD
and the prototype use them. Never invent a synonym (`invoice` for `claim`) and never abbreviate one (`clm`).

## Imports

- Inside a feature: relative (`./api/claims-api`). Across the app: `@/` alias. **[enforced]**
- Import another feature only through its root (`@/features/claims`). **[enforced]**
- `import type` for types. **[enforced]**
- No barrel files except a feature's own `index.ts`. A `components/index.ts` that re-exports forty things
  breaks tree-shaking and makes every import a cache miss.
- Import order: node/external → `@/` → relative → styles. Prettier does not sort these; keep them grouped.

## State

- Follow the state ladder in the architecture doc: URL → server cache → derived → local → Zustand.
- Server data never enters `useState` or a Zustand store. **Copying a query result into state is a review
  block**, because it will silently go stale.
- Zustand stores are read through selectors; never `const store = useStore()`.
- No state that can contradict other state. One `status` union beats three booleans.

## Queries

- One hook per query, owned by the feature, built on a key from that feature's key factory.
- `enabled` guards dependent queries; never call a hook conditionally.
- `select` narrows large payloads so a component re-renders only when its slice changes.
- Don't set `staleTime: 0` to "get fresh data" — invalidate after the mutation that changed it.
- Loading and error states come from the query. A feature does not track its own `isLoading` boolean.

## Mutations

- Named `useXMutation` in the owning feature; it invalidates the affected keys in `onSuccess`.
- Mutations are never retried automatically. **[enforced by default]**
- Money-moving or irreversible actions (release, submit, post, void, write-off) require an explicit
  confirmation step in the UI and are never triggered by a hover, a render, or an effect.
- Server field errors (`ApiError.fieldErrors`) are mapped back onto form fields, not dumped in a toast.
- Optimistic updates only for cheap reversible toggles, always with an `onError` rollback.

## Validation

- Zod is the single source of truth for a shape. Infer the type; never write both.
- Validate at four boundaries: environment (`lib/config`), API responses (`lib/api` + feature schemas), route
  search/params, and form input.
- Do not validate in the middle. Once a value is parsed at the boundary, downstream code trusts the type.
- Frontend validation is a UX feature: it catches mistakes early and is **never** the enforcement point for a
  business rule. The server validates again, and the server wins.
- Validation messages are the client's wording (the prototype's exact strings where they exist), not Zod
  defaults like "Invalid input".

## Error handling

- Catch where you can act. A `try/catch` that logs and rethrows adds nothing.
- Never render a raw error message, a stack, a URL or a payload. Use `userMessage(error)`.
- Branch on `ApiError.kind`, never on a status code or a message string.
- A failed query shows an inline error with Retry; a failed mutation toasts and leaves the form filled in so
  nothing is retyped.
- `console.log` is banned in `src/`. **[enforced]** `console.warn`/`console.error` are allowed and must not
  contain patient, claim or payment data — see [SECURITY.md](./SECURITY.md) § Logging.

## Accessibility

- Semantic HTML first: `<button>` for actions, `<a>`/`<Link>` for navigation, `<table>` for tabular data,
  `<form>` with a real submit.
- Every input has a `<label>`; every error is tied to its field with `aria-describedby` and announced.
- Keyboard: every interactive element reachable and operable, visible focus (never `outline: none` without a
  replacement), focus moved into a dialog and restored on close, `Escape` closes.
- Icon-only controls carry an accessible name.
- Colour never carries meaning alone — status has text or an icon beside it. Contrast ≥ 4.5:1 for text.
- Loading and disabled states are announced (`aria-busy`, `aria-disabled` with an explanation), not just
  greyed out.
- Tables: real `<th scope>`, a caption or labelled region, sortable columns expose `aria-sort`.

## Testing

Full strategy in [TESTING_STRATEGY.md](./TESTING_STRATEGY.md). The rules that bite in review:

- Business rules (`model/`) are pure and unit-tested. If a rule is hard to test, it is in the wrong place.
- Component tests query by role/label/text — the way a user finds things — never by test id as a first resort
  and never by class name.
- No test asserts "it rendered". Assert behaviour: what the user sees, what was sent, what changed.
- Every test builds its own data and its own QueryClient. No shared mutable fixtures between tests.
- A bug fix comes with the test that fails without it.

## Performance

Full document in [PERFORMANCE.md](./PERFORMANCE.md). In-file rules:

- No `memo` / `useMemo` / `useCallback` by default. Add one when a profile shows a real cost, and say so in a
  comment. Wrapping everything makes code slower to read and no faster to run.
- Do memoize without measuring in two cases: a value in a context provider, and a dependency of an effect that
  would otherwise re-run every render.
- Lists render pages, not everything. Filter and sort on the server once the dataset can grow past a page.
- Never fetch in a loop or in a child that renders per row. Fetch once at the screen level.

## Security

Full document in [SECURITY.md](./SECURITY.md). In-file rules:

- `fetch` only in `lib/api`. **[enforced]**
- `localStorage` / `sessionStorage` only in `lib/storage`, and never for patient, claim, coverage or payment
  data. **[enforced]**
- `dangerouslySetInnerHTML` is banned. **[enforced]**
- No PHI in URLs beyond opaque ids, in logs, in analytics, or in error messages.
- `VITE_*` values are public. Nothing secret goes in them. **[reviewed]**

## Dependencies

Adding one requires answering, in the PR description:

1. What problem does it solve?
2. Why can't the current stack solve it reasonably?
3. Mandatory for everyone, or optional for one feature?
4. Maintenance, bundle and security cost — size, release cadence, transitive deps, last publish.

Pre-approved additions and their trigger conditions are listed in the architecture doc § Dependencies.
A library whose job is trivial (`classnames`-alikes, one-function date helpers, `lodash.get`) is written as a
tested 10-line util instead.

## Code review

A reviewer blocks on any of these:

- `any`, a silencing cast, or a suppressed lint rule with no reason.
- Server data copied into `useState` or Zustand.
- A `useEffect` that fetches, derives, or reacts to a user action.
- A new cross-feature deep import, or shared code importing a feature.
- `fetch` outside `lib/api`; a response used without a schema.
- PHI in a URL, a log, a storage key, or an error message.
- A money-moving action with no confirmation, or a mutation with automatic retry.
- A new "reusable" abstraction with one caller.
- A business rule added that no requirement asked for (see [CLAUDE.md](../CLAUDE.md) § Requirements).
- A test that asserts implementation details, or a fix with no test.

And asks (without blocking) about: file length over ~250 lines, a component doing both fetching and layout,
duplicated formatting logic, and missing empty/error states.
