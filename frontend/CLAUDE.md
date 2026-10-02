# Working in this codebase

The Billing System frontend. React 19 + TypeScript + Vite + TanStack Router/Query + Zustand + Zod + Tailwind.
**Features so far: authentication — sign in, forgot password, change password (`src/features/auth`), Admin → Organizations (`src/features/admin-organizations`) and
Admin → Practices & locations (`src/features/admin-practices` — the reference for mapping a backend payload and
for a master–detail screen; it also owns `PracticeSelect`), Admin → Users (`src/features/admin-users`), Admin → Roles & permissions (`src/features/admin-roles` — **frontend only**, an in-tab store like procedure codes), Admin → EMR integration (`src/features/admin-emr-integration` — **frontend only**, same in-tab pattern; locations from the practices list), Admin → Coding rules (`src/features/admin-coding-rules` — **frontend only**, same in-tab pattern; insurances, classes and procedure codes from their features), Admin → Submission & automation (`src/features/admin-automation` — **frontend only**, same in-tab pattern), **Patients** (`src/features/patients` — roster, and the chart as one page — Profile, Insurance, then the cases and the chosen case; **frontend only**, one in-tab store for patients, coverage, cases and authorizations), **Exceptions** (`src/features/exceptions` — Billing exceptions / Incomplete profiles / Resolved, with the Resolve forms that fix the source record; **frontend only**, an in-tab store, no detection), Admin → Audit log (`src/features/admin-audit-log` — read-only, **no backend contract**: a provisional page query behind one integration point), and — in the Setup
module beside Admin — Setup → Providers (`src/features/admin-providers`, provisional contract), Setup → Procedure codes (`src/features/admin-procedure-codes` — **frontend only, no backend and no api layer**: an in-tab store in `data/`), Setup → Fee schedules (`src/features/admin-fee-schedules` — **frontend only**, same in-tab pattern), Setup → Referring physicians (`src/features/admin-referring-physicians`), Setup → Insurances and
Setup → Insurance classes (`src/features/admin-insurances`) and Setup → Release buckets
(`src/features/admin-release-buckets`). No backend exists yet; request payloads are known for organizations, practices,
locations, users, referring physicians, release buckets and authentication only. Providers, insurances and insurance classes use a
**provisional** contract built from the prototype's fields under PRD V2 column names — replace it when the real payload arrives.**

## Read the smallest thing that lets you finish the task

Do not load every document. Pick the row that matches what you are doing.

| Task                                         | Read this, in this order                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Anything at all                              | This file                                                                                    |
| Where does code go / new feature             | `docs/FRONTEND_ARCHITECTURE.md` §2–3, then an existing feature next door                     |
| Writing a component, hook, form              | `docs/UI_KIT.md` first (it may already exist), then `docs/FRONTEND_ENGINEERING_STANDARDS.md` |
| Styling anything                             | `docs/UI_KIT.md` § Tokens — never a raw hex or an arbitrary value                            |
| Data fetching, caching, mutations            | `docs/FRONTEND_ARCHITECTURE.md` §5, §7                                                       |
| Anything touching patient/claim/payment data | `docs/SECURITY.md` §1, §4                                                                    |
| Writing tests                                | `docs/TESTING_STRATEGY.md` §2–4, and `src/test/render.tsx`                                   |
| A screen feels slow / adding a table         | `docs/PERFORMANCE.md` §4–6                                                                   |
| "Why is it like this?"                       | `docs/decisions/` (index in its README)                                                      |
| What the product must do                     | `../PROJECT_MEMORY.md` (index), then the one relevant section of the requirement docs        |

Product requirements live one level up, outside this app: `../PROJECT_MEMORY.md`,
`../docs/PRD_CLARIFICATION_QUESTIONS.md`, `../docs/PROTOTYPE_COVERAGE.md`, and the reviewed prototype in
`../prototype/`. **The prototype is the validated product behaviour, not the implementation architecture** —
copy what a screen does, never how it is coded.

## Before you change anything

1. Look at how the nearest existing code does it. Match it rather than introducing a second way.
2. Search for an existing util/hook/component before writing one. Duplicates are the main way this codebase
   would rot.
3. Check who else imports what you are about to change (`grep` the symbol). Shared code has many callers.
4. Keep the change to the task. No opportunistic refactors, no reformatting untouched files.

## Requirements discipline

Never invent a business rule. When you write something the requirements do not state, label it, in the PR
text and in the code where it matters:

- **Confirmed requirement** — the PRD or a recorded client answer says so (cite it).
- **Existing implementation** — this is how the prototype or the current code already behaves.
- **Assumption** — you had to decide; say what you assumed and what breaks if it is wrong.
- **Recommendation** — your opinion, not a decision.
- **Open question** — it needs the client; add it to `../docs/PRD_CLARIFICATION_QUESTIONS.md` rather than guessing.

Never claim a security property the frontend cannot provide (`docs/SECURITY.md` §1). "The UI prevents X" is
wrong unless the server prevents X.

## Before you finish

```bash
npm run verify     # typecheck + lint + test + build — all four must pass
```

Then say plainly what you did, what you assumed, and what you did not do.

## Hard rules (lint enforces most of them)

- No `any`, no silencing casts, no `!` outside tests.
- `fetch` only in `src/lib/api`. Components call query hooks, hooks call feature api functions.
- Server data never goes into `useState` or Zustand. TanStack Query owns it.
- No `useEffect` for fetching, deriving, or reacting to a user action.
- Never `localStorage`/`sessionStorage` for patient, claim, coverage or payment data. Never PHI in a URL, a
  log, or an error message.
- No `dangerouslySetInnerHTML`.
- Inside a feature: relative imports. Across features: only `@/features/<name>`, never deeper.
- New dependency: answer the four questions in the standards doc first. Check the pre-approved list in
  `docs/FRONTEND_ARCHITECTURE.md` §12.
- No new abstraction with one caller. Build the second or third case first.
- Use the UI kit (`src/components/ui`). A new primitive needs a real repeated use case and a place in
  `docs/UI_KIT.md`; a business rule never goes inside one.
- Mutations that move money need a confirmation step and are never auto-retried.

## Token discipline

- Read the section you need, not the whole document; these files are written with headings for that.
- Grep for a symbol instead of reading a file to find it.
- Do not summarize files back to the user unless asked.
- Update `../PROJECT_MEMORY.md` only when a real project decision changes — not for routine work. Add an ADR
  only for decisions that constrain future work.
- Plan a large feature in a few lines before writing it, then build it.
