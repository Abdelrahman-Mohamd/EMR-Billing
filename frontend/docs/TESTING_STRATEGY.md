# Testing Strategy

Tools: **Vitest** (runner, jsdom) and **React Testing Library**. Helpers live in `src/test/`.

A test earns its place by failing when the product is wrong. Tests that pass no matter what the code does are
worse than no tests: they cost time and buy confidence that isn't there.

---

## 1. The shape of the suite

```
        few   ┌─────────────────────┐
              │  E2E (not yet)      │  real browser, real backend — see §8
              ├─────────────────────┤
              │  Integration        │  a screen + router + query + mocked network
              ├─────────────────────┤
              │  Component          │  one component, real DOM, user events
       many   │  Unit               │  pure business rules, schemas, utils
              └─────────────────────┘
```

The base is wide **because the base is where billing correctness lives**: hold windows, rule precedence,
balance splits, modifier rules. Those are pure functions in `features/*/model/` and can be tested exhaustively
in milliseconds. Push logic down there so it can be.

---

## 2. What each level covers

### Unit — `features/*/model/`, `lib/*`

Business rules, derivations, formatters, Zod schemas. No React, no mocks, no async.

Test the boundaries, not one happy example: a hold window tests the day before, the first day, the last day,
the day after, and an open-ended window. This is where table-driven tests belong (`it.each`).

### Component — `components/`, feature components

One component in isolation with its props. Assert what a user perceives: text, roles, enabled/disabled,
what a click calls.

```tsx
it('will not release a claim without a confirmation', async () => {
  const onRelease = vi.fn()
  renderWithProviders(<ReleaseButton claimId={claimId} onRelease={onRelease} />)
  await userEvent.click(screen.getByRole('button', { name: /release/i }))
  expect(onRelease).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /yes, release/i }))
  expect(onRelease).toHaveBeenCalledOnce()
})
```

### Integration — a screen

A feature screen with the real router, a fresh QueryClient and a mocked network. This is the level that
catches the mistakes that actually reach users: a filter that doesn't reach the request, a mutation that
doesn't invalidate, an error state nobody rendered.

Use `renderWithProviders` from `src/test/render.tsx` (per-test client, retries off) and the route-test pattern
in `src/routes/index.test.tsx` (memory history, real route tree).

### Route

Guards and URL contracts: an unauthorized user is redirected; an invalid search param is rejected or
defaulted; a deep link loads what the URL says; an unknown path shows Not Found.

---

## 3. What we always test

- **Business rules.** Every rule that decides money, a hold, a status or an eligibility. Exhaustively.
- **Critical workflows**, end to end within the frontend: charge → release → claim → submission; payment
  posting; bucket release; a rejection returning to a work queue. One integration test per workflow, asserting
  the state transition and the request that was sent.
- **Form validation.** Required fields, cross-field rules (end date before start date), server field errors
  mapping onto inputs, and that a failed submit does not clear what was typed.
- **Permission behaviour.** A user without a permission does not see the action; a 403 renders a calm state,
  not a crash.
- **Query and mutation wiring.** The request carries the filters; success invalidates the right keys; error
  shows the retryable state.
- **Empty, loading and error states.** They are product behaviour, not decoration.
- **Every bug fix.** The test that fails before the fix goes in with it.

## 4. What we deliberately do not test

- That a component renders (`expect(container).toBeTruthy()`).
- Snapshots of markup. They fail on every design tweak and pass through real regressions.
- Implementation details: state variable names, hook call counts, internal function calls, class names.
- Third-party libraries: TanStack Query's cache, Zod's parser, the router's matching.
- Static styling, spacing and colour — a human or a visual tool judges those.
- Trivial getters, one-line pass-through props, and generated code (`routeTree.gen.ts`).

## 5. Mocking

**Mock at the network boundary, not at the module boundary.** Stubbing a feature's own api module tests the
mock; intercepting HTTP tests the code. MSW is the approved tool and is installed with the first API-backed
feature ([architecture doc § 12](./FRONTEND_ARCHITECTURE.md)).

**Until then**, with no HTTP to intercept, a screen test replaces the feature's `api/` functions — the
network boundary of today — with fakes that say what the server would have answered
(`vi.mock('../api/organizations-api')`, with a comment). Everything above them runs for real: route, query
hooks, form, dialog. Never stub a query hook or a component. A separate test covers the api module's own
behaviour when no mock data is built in (`vi.stubGlobal('__MOCK_DATA__', false)`). When MSW arrives these
fakes become request handlers and the tests above them stay as they are.

Rules:

- Never mock what you are testing.
- Never mock React, the router or the query client.
- `vi.mock` is for genuinely external, unavoidable things (time, `crypto.randomUUID`, a browser API jsdom
  lacks). Each one needs a comment.
- Freeze time (`vi.setSystemTime`) for anything that reads "today" — billing is full of date boundaries, and a
  test that passes only in September is not a test.
- Assert what was requested (URL, method, body) when the request is the behaviour under test.

## 6. Test data

- Build data with small factories per domain (`makeClaim({ status: 'held' })`) that fill in valid defaults and
  take an override for the part the test is about. A test that sets fifteen fields hides which one matters.
- Factory output must satisfy the same Zod schema as the real response, so a contract change breaks the tests
  rather than passing with a shape the server no longer sends.
- **Use invented data only.** No real names, no real member ids, no exported production rows — a fixture is
  forever, and a fixture with real PHI is a breach. Reuse the prototype's fictional patients and payers.
- Each test creates what it needs. No shared mutable fixture objects across tests.

## 7. Conventions

- File next to its subject: `hold-rules.ts` → `hold-rules.test.ts`.
- `describe` names the unit ("hold window"), `it` names the behaviour in product language:
  `it('delays a visit whose date of service falls inside the window')`. Not `it('should work')`, and not
  `it('calls setState')`.
- Explicit imports (`import { describe, it, expect } from 'vitest'`) — no globals, so tests type-check like
  any other file.
- Query by role and accessible name first, then label, then text. `getByTestId` is a last resort and a hint
  that the markup needs a role or a label — which also helps real users.
- `await userEvent…` for interaction, never `fireEvent`, so focus and keyboard behave like a browser.
- `findBy*` for anything async; never `waitFor` around a bare `expect` that could be a `findBy`.
- A test that needs more than ~20 lines of setup is telling you the unit is too big.

## 8. Coverage philosophy

No global coverage gate. A percentage target moves work towards easy-to-cover code and away from the hard
parts, and it can be satisfied by tests that assert nothing.

What we hold instead:

- `features/*/model/` and money/date/rule utilities: effectively complete, including edge cases.
- Every critical workflow (§3): at least one integration test.
- Every form: validation and submission paths.
- New code: PRs that add behaviour add tests. Reviewers block on a missing test for a rule, not on a number.

Coverage is a tool for finding untested branches (`npx vitest run --coverage` once `@vitest/coverage-v8` is
added), not a target to hit.

## 9. End-to-end tests

**Not yet, and deliberately.** E2E needs a running backend and real auth; neither exists. Adding Playwright
now would only re-test what jsdom already covers, more slowly.

Introduce it when **two** things are true: a backend exists, and a workflow crosses something jsdom cannot
model (file download/upload, print/PDF, real redirects, multi-tab session behaviour). At that point add
Playwright, keep the suite to a handful of revenue-critical journeys, and run it against a seeded staging
environment — never against production data.

## 10. Running

```bash
npm test          # once, what CI runs
npm run test:watch
npm run verify    # typecheck + lint + test + build
```

Tests must pass with no network access and no backend. A test that needs either is broken.
