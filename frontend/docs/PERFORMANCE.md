# Performance

Two things decide whether this application feels fast: how much JavaScript loads before the first screen, and
how it behaves with a table of ten thousand claims. Everything here serves one of those.

**Measure before optimizing.** Every optimization in this codebase should be traceable to a number — a bundle
report, a profiler flame chart, a network waterfall. "This might re-render a lot" is not a reason.

---

## 1. Baseline (measured 2026-09-28, sign-in built, nothing else)

| Chunk                                                     | Raw    | Gzip       |
| --------------------------------------------------------- | ------ | ---------- |
| Entry (React, Router, Query, **Zod**, Zustand, shell, UI) | 436 kB | **136 kB** |
| Sign-in page (form library, schema, page)                 | 47 kB  | 17 kB      |
| CSS (whole design system)                                 | 41 kB  | 8 kB       |
| Fonts (Archivo, 4 weights, latin subset)                  | 58 kB  | —          |
| Sign-in photograph (loaded at ≥ 1024px only)              | 199 kB | —          |

That 136 kB is the floor the stack costs. Watch it: a dependency that adds 40 kB to the entry chunk taxes
every user on every visit.

**Why it rose from 116 kB.** Zod (~20 kB gzip) joined the entry. Before sign-in existed, nothing loaded at
startup used it, so it happened to sit in a lazy chunk. Validating a route's search params (`/login?redirect=`)
and validating configuration at boot — both required by the architecture — put it where it will stay. That is
the expected steady state, not a leak: the sign-in page's own code, the form library and the schema resolver
are all in the lazy `login` chunk.

**Update, 2026-09-28 (Organizations, Practices & locations built).** With more lazy routes sharing code,
Rolldown splits what used to be one entry file into the entry plus shared chunks (`Button`, `cn`, the icon
runtime …). Measure **everything `index.html` loads at startup**, not the file named `index-*.js`: it is now
**≈ 145 kB gzip** across eight files (entry alone 98 kB), up ~4 kB from 141 kB. The two Admin screens are lazy
chunks of 21 kB (Organizations) and 19 kB (Practices & locations).

The development component showcase is **not** in these numbers: its import sits behind `import.meta.env.DEV`,
so a production build drops the branch and never emits the chunk.

## 2. Budgets

Provisional until the app is deployed on real infrastructure and measured on the client's actual network and
hardware. Treat them as review triggers, not as pass/fail gates.

| Budget                                | Target   | Action when exceeded                             |
| ------------------------------------- | -------- | ------------------------------------------------ |
| Initial JS (all startup chunks, gzip) | ≤ 200 kB | Move it out of the entry or drop the dep         |
| Any single route chunk (gzip)         | ≤ 100 kB | Split the screen, lazy-load the heavy part       |
| Total CSS (gzip)                      | ≤ 30 kB  | Look for duplicated component styles             |
| Requests to render a screen           | ≤ 3      | Parallelize, or prefetch in the loader           |
| Sequential request depth (waterfall)  | ≤ 2      | The second request must genuinely need the first |
| Time to interactive, office network   | ≤ 3 s    | Investigate before release                       |
| Interaction → visible response        | ≤ 100 ms | Optimistic UI, or a busy state                   |
| Rows rendered at once                 | ≤ 100    | Paginate; virtualize only if paging can't work   |

## 3. Bundle and code splitting

- **Route-level splitting is automatic** (`autoCodeSplitting` in the router plugin). Every route component is
  its own chunk; nobody writes a `lazy()` for a page.
- **Component-level splitting is manual and rare.** Reserve it for genuinely heavy, genuinely optional things:
  a chart library, a PDF viewer, an export builder, a rich editor. `React.lazy` + `Suspense` with a skeleton
  that matches the final layout.
- Import what you use: `import { format } from 'date-fns'`, never a default namespace import of a large
  library. Prefer a 10-line tested util over a dependency for one function.
- Check before adding: a package's gzip cost on bundlephobia, and whether it is tree-shakeable (ESM, no side
  effects).
- Run `npx vite build` and read the chunk table when touching dependencies. It is already printed on every
  build — read it rather than scrolling past it.

## 4. Data fetching

The fastest request is the one you don't make.

- **Deduplication is free.** Two components using the same query key share one request — so components fetch
  what they need instead of prop-drilling data "to avoid a second call".
- **`staleTime` is the main lever.** 30 s by default. Reference data that changes daily (procedure codes,
  payers, locations) may use minutes; raise it deliberately, per query, with a comment.
- **Prefetch on intent.** `defaultPreload: 'intent'` means hovering a link starts the load. For known
  next steps, `queryClient.prefetchQuery` in the route loader.
- **Kill waterfalls.** Independent queries run in parallel (`useQueries`, or two hooks side by side). A
  dependent query (`enabled: !!id`) is only acceptable when the second request truly cannot be formed without
  the first — fetching a list and then fetching each row's detail is the anti-pattern this codebase must never
  ship.
- **Never fetch per row.** If a table needs a related name, the list endpoint includes it, or one request
  fetches the batch.
- **Cancellation:** every request gets the query's `AbortSignal`, so an abandoned screen stops costing
  bandwidth and a stale response never lands.
- **Pagination over "load everything".** The server filters, sorts and pages. A screen that downloads a whole
  ledger to filter it in JavaScript is a bug, not a slow screen.

## 5. Tables and large datasets

Billing screens are tables. In order:

1. **Server-side** paging, sorting, filtering and search. The URL holds those parameters, so the state is
   shareable and the cache key is exact.
2. **Keep pages small** (25–100 rows) and keep the row component cheap: no per-row query, no per-row date
   parsing where a formatter can be shared, no inline object literals as props.
3. **Virtualize only when paging genuinely cannot work** — a reconciliation grid that must scroll continuously
   — and then with `@tanstack/react-virtual`. Virtualization costs keyboard access, find-in-page and printing,
   so it is a last resort, not a default.
4. **Bulk actions** send one request with a list of ids; never one request per selected row.
5. Row selection state is ids, not row objects, so the cache can update under it.

## 6. React rendering

- **No blanket memoization.** `memo`, `useMemo` and `useCallback` are added when the profiler shows a cost,
  with a comment saying what was measured. They are not free: they add allocation, dependency arrays that go
  stale, and noise.
- Two exceptions, applied without measuring: values placed in a context provider, and values used as effect
  dependencies.
- Cheaper than memoization, and preferred:
  - **Narrow the subscription.** `useQuery(..., { select })` and Zustand selectors mean a component only
    re-renders when its slice changes.
  - **Move state down.** A filter input that re-renders a table on every keystroke should own its own state
    and lift only on submit or debounce.
  - **Split the component.** Rendering less beats rendering the same amount faster.
- Keys are stable ids. An index key makes React rebuild rows on every sort.
- Debounce search inputs (~300 ms) and put the debounced value in the query key — not the raw keystroke.
- Long lists of derived values: compute once per render pass, not inside every row.

## 7. Client state

- Zustand stores are read through selectors. `const store = useStore()` subscribes a component to every field
  and is a review block.
- Derived values are computed in the selector or during render, never stored and synchronized.
- No server data in stores — a duplicated cache is both a correctness bug and an extra render source.

## 8. Assets and CSS

- SVG for icons (via the icon library, tree-shaken per icon). No icon fonts, no sprite sheets.
- Raster images: sized to their display size, `loading="lazy"` below the fold, modern formats. This app has
  almost none by nature — a logo and maybe a document preview.
- Fonts: subset, `font-display: swap`, self-hosted (as the EMR does). A font blocking first paint costs more
  than any component optimization saves.
- Tailwind emits only used classes; keep it that way by avoiding dynamically constructed class strings
  (`text-${color}-500` can't be seen by the scanner and silently ships nothing).

## 9. Build

- `npm run build` prints the chunk table — read it.
- Hidden source maps: uploadable, not served.
- No dev-only code in production: mocks, fixtures and devtools are excluded by the build, not merely unused.

## 10. Monitoring

Nothing is instrumented yet — there is no backend and no deployment target. When there is:

- Web Vitals (LCP, INP, CLS) from real sessions, not just a lab run.
- API timing by endpoint, so "the app is slow" can be answered with "this query is slow".
- Bundle size tracked per build in CI, with the diff shown on the PR.
- An error tracker consuming the hidden source maps — with PHI scrubbing configured before it is switched on
  ([SECURITY.md](./SECURITY.md) § Logging).

Until then, the measurements available are the build's chunk table, the browser profiler, and the network
panel. Use them before claiming something is fast or slow.
