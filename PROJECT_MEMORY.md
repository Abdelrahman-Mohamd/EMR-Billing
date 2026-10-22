# PROJECT_MEMORY — Billing System (EMR Billing / RCM)

> Long-term development memory. Read this before any significant architectural or implementation decision.
> **Primary source: `docs/Billing System PRD v2.docx`** (25 pages; title block *Version 2.0 · Draft*). `docs/Billing System PRD v1.docx` is kept only for comparison — see `docs/PRD_V1_TO_V2_CHANGELOG.md`.
> PRD sections are cited `§x.y`, pages `pN` (PRD V2 as Word paginates it). Change IDs `CH-xx` point into the change log.

**Source-of-truth hierarchy** (highest wins):
1. Explicit current requirements / confirmed product decisions
2. Actual implemented code and architecture
3. PRD V2
4. This file
5. AI assumptions

**Maintenance rules:** update on every important decision, feature-status change, requirement change or resolved question. If code contradicts this file, inspect the code and fix the file. Remove obsolete content; do not paste PRD text or source code here. Never resolve an ambiguity silently — log it as a question in `docs/PRD_CLARIFICATION_QUESTIONS.md` and reference it here, or record an assumption in §21.

**Legend**
- ✅ **Confirmed** — explicitly stated in PRD V2
- 🔎 **Inferred** — reasonably inferred from PRD V2, not stated outright
- ⚠ **Assumption** — not specified; temporarily assumed (see §21)
- ❓ **Needs Clarification** — requires client confirmation; IDs `Q-###` / `C-###` are entries in `docs/PRD_CLARIFICATION_QUESTIONS.md`

**ID conventions:** M = module, F = feature, BR = business rule, W = workflow, KI = known issue, A = assumption. IDs are stable: change content in place, retire rather than renumber. Since 2026-09-16 open questions use the client register's IDs only (the old internal `Q01…Q57` list is retired).

---

## 0. Where to look

This file is the product memory: requirements, decisions, business rules, history. It is long on purpose —
**read the section you need, not the file.** For anything else, start in the table below.

| I need to know…                                   | Go to                                                        |
|---------------------------------------------------|--------------------------------------------------------------|
| What the product must do                          | §1–§9 of this file, then `docs/Billing System PRD v2.docx`        |
| What a screen should do, concretely               | `prototype/` (reviewed with the client) and `docs/PROTOTYPE_COVERAGE.md` |
| Whether something is confirmed, assumed or open   | `docs/PRD_CLARIFICATION_QUESTIONS.md` (Q-/C-/A- ids)              |
| What changed between PRD versions                 | `docs/PRD_V1_TO_V2_CHANGELOG.md`                                  |
| A plain-language explanation of a billing concept | `docs/BILLING_SYSTEM_GUIDE.html`                                  |
| **How the real frontend is built**                | `frontend/CLAUDE.md`, then `frontend/docs/`                            |
| Why a frontend decision was taken                 | `frontend/docs/decisions/`                                        |
| What was decided when                             | §22 Change log (bottom of this file)                         |

**Two codebases, two roles.** `prototype/` is a vanilla-JS prototype used to validate the product with the
client — it is the authority on *behaviour* and wording, and is not the implementation architecture.
`frontend/` is the real frontend. Never copy prototype code into `frontend/`; copy what the screen does.

---

## 0.1 Frontend codebase (`frontend/`)

Started 2026-09-25. Built so far: the UI kit, the sign-in page, Admin → Organizations and Admin → Practices & locations (see §24).

| | |
|---|---|
| **Responsibility** | Every user-facing screen of the Billing System. Presentation, workflow, client-side validation, UX-level permission gating. It is **not** a security or business-rule boundary — the backend is (`frontend/docs/SECURITY.md`). |
| **Stack** | React 19 · TypeScript (strict+) · Vite · TanStack Router · TanStack Query · Zustand · Zod · Tailwind v4 · Vitest + React Testing Library |
| **Why this stack** | Identical to the sibling EMR frontend, same team and shared design tokens — `frontend/docs/decisions/0001-frontend-stack.md` |
| **Architecture** | Feature-oriented: `routes → features → shared`, enforced by ESLint. Server state in TanStack Query only; client state in Zustand; URL holds filters/paging/selection |
| **Data layer** | **No backend exists.** Features call their own `api/` functions, which resolve to mocks behind the same signatures until endpoints exist (ADR 0006). `fetch` lives in one file |
| **Verified** | `npm run verify` (typecheck + lint + test + build) passes; 152 tests |
| **Deliberately not built** | Session, route guard, permissions — each waits for the backend (`frontend/docs/FRONTEND_ARCHITECTURE.md` § Open decisions) |

Frontend decisions are recorded in `frontend/docs/`, not here. Add to this file only when a **project** decision
changes — scope, a business rule, a client answer, or a technology choice.

---

## 1. Project Overview

| | |
|---|---|
| **Name** | Billing System |
| **What it is** | Centralized Revenue Cycle Management (RCM) platform; "action-oriented operating system" ✅ (title page) |
| **Specialty** | Physical Therapy first; multi-specialty in scope ✅ |
| **Owner** | Business Development ✅ |
| **PRD version** | V2 (2.0 Draft). V2 changed §6.2 (manual release) and chapter 10 (data model) only; everything else is identical to V1 ✅ |
| **Repo state** | Requirements, the client-facing prototype (`prototype/`, published to GitHub Pages) and the real frontend foundation (`frontend/`, started 2026-09-25 — architecture and tooling only, no features). Git repo `Abdelrahman-Mohamd/EMR-Billing`. |

**Scope ✅**
- **Specified (PRD ch. 1–10):** setup, access control, EMR integration, reference data (incl. insurance classes and release buckets), patients and cases, ingestion and exceptions, queues, coding rules and scrubbing, claim lifecycle, CMS-1500 mapping, basic payments and A/R, data model.
- **Named but unspecified (ch. 11 and elsewhere):** Posting module detail, Denial & A/R, Analytics & Reports, Dashboards, Eligibility and claim-status integration ✅ (ch. 11, p24); Month End, Appeals, Referrals, Patient Statements 🔎 (named in permissions, data or core principle only).
- **Not mentioned at all:** notifications, authentication, non-functional requirements.

---

## 2. Product Purpose

✅ Turn finalized EMR clinical notes (or manually entered charges) into clean insurance claims, get them paid, and chase whatever is not paid:
1. Receive and reconcile the charge (per integrated location).
2. Catch data problems (incomplete profiles, billing exceptions) and review the charge.
3. Apply coding rules and scrub against six checks; park failures in reason-specific holds; park claims for **held insurances** in their **release bucket**.
4. Generate a CMS-1500 or 837P claim and submit it to **Waystar**.
5. Post payments (manual and ERA 835).
6. Escalate unpaid (SLA breach) or denied claims to Denial & A/R.

**Core principle ✅ (title page, p1):** every actionable item carries **Owner + Status + Priority + Due Date + Next Action + History**, across Eligibility → Referral → Authorization → Encounter → Claim → Denial/A/R → Payment → Appeals. ❓ No table holds these fields (Q-003).

**Business goal 🔎:** reduce revenue lost to incorrect claims and unworked follow-up by making every stuck item visible and owned.

---

## 3. Users & Actors

| Actor | Kind | Interacts how | Source |
|---|---|---|---|
| Billing staff (Practice Admin) | Person, user | Daily: review charges, work holds, release buckets, submit, post, work denials/A/R | ✅ §1.3, §10.6 |
| System Admin | Person, user | Platform setup, practices, users, roles | ✅ §10.2, §10.6 |
| Organization Admin | Person, user | Cross-practice visibility | ✅ named §1.3 · ❓ C-002 |
| Domain Admin | Person, user | Raises EMR integration request; elects integrated locations | ✅ named §2.2–2.3 · ❓ C-002 |
| Service accounts (EMR import, data conversion) | System, user row | Create records automatically; cannot log in | ✅ §10.2 |
| Clinician | Person, **not a user** | Finalizes notes in the EMR; exists here only as a provider record | ✅ §1.3 |
| Patient / guarantor | Person, not a user | Treated; owes patient share; guarantor "receives statements" | ✅ §10.4 |
| Referring / supervising physician | Person, not a user | Directory record, printed in Box 17 | ✅ §10.3 |
| EMR | External system | Pushes sessions, charges, charts, cases, providers | ✅ ch. 2, §4.1 · ❓ Q-004 |
| Waystar (clearinghouse) | External system | Receives claims; returns rejections and 835s | ✅ §7.1, §9 · ❓ Q-015 |
| Payers | External | Adjudicate; pay or deny | ✅ ch. 9 |
| AI engine | External/add-on | Coding-quality check; optional SLA prediction | ✅ §6.2, §9.2 · ❓ Q-014 |

---

## 4. Roles & Permissions

**Access formula ✅ (§10.6, p22):** allowed only if (a) the user's role(s) permit the CRUD action on the module (several roles = union, §10.2) **and** (b) the record's practice is in the user's `user_practice` list, or the role is global. A grant may be narrowed to locations; empty list = all locations (§10.2).

❓ **C-001:** §1.4 instead describes Edit / View / Hidden per user, per section, down to individual fields.

| Role | Status | Modules (C R U D) | Limits |
|---|---|---|---|
| **System Admin** (`SYSTEM_ADMIN`, global) | ✅ seeded | All modules CRUD, every practice | Only role that sees decrypted `ssn_enc` ✅ (portal credentials no longer captured *(client 2026-09-30)*) |
| **Practice Admin** (`PRACTICE_ADMIN`) | ✅ seeded | Dashboard R · Patient CRUD · Charges CRUD · Billing CRU · Payments CRU · Denial Mgmt CRU · AR Follow-up CRU · Reports R · Month End CR · Admin CRU | Can't delete a sent claim; reversals posted, not deleted; reports for granted practices only; can't reopen a closed period; manages setup and users of granted practices; can't create practices or grant System Admin; sees masked encrypted fields ✅ · **Creates release buckets** ✅ (§10.3 p16) · ❓ C-008 (limits vs flags) |
| **Organization Admin** | ✅ named only | Not defined | ❓ C-002, Q-032 |
| **Domain Admin** | ✅ named only | Not defined | ❓ C-002, Q-029 |
| **Service account** | ✅ | Per assigned role | Cannot log in interactively ✅ |

**Human vs automatic actions**
- **Human ✅:** setup; completing incomplete profiles (who ❓ Q-005); charge review (pend / release); updated-queue decision (Inactivate / Corrected / Submit anyway); **releasing claims from a release bucket** ("a user" — which role ❓ Q-076); manual payment posting; denial work.
- **Automatic ✅:** trigger on EMR push; record reconciliation; draft profiles and quarantine; exception detection; provider-hold delay; coding rules; scrubbing; routing to holds and buckets; auto-resubmit on hold resolution (mechanism ❓ Q-012); 837P/PDF compilation and dispatch; daily batch metrics; ERA ingestion; SLA escalation and A/R categorisation.

---

## 5. Modules

Permission module names (§10.6): Dashboard, Patient, Charges, Billing, Payments, Denial Management, AR Follow-up, Reports, Month End, Admin. Mapping of functional modules to permission modules marked 🔎 where not stated.

| # | Module | Purpose | Key features | Depends on | Rules |
|---|---|---|---|---|---|
| M1 | **Account Setup** [Admin] | Billing entity and sites | Practice onboarding, ≥1 location, optional company | — | BR01–02 |
| M2 | **Identity & Access** [Admin] | Who may do what, where | Users, service accounts, roles (JSON CRUD), practice/location grants, encryption & masking | M1 | BR03–06 |
| M3 | **EMR Integration** [Admin] | Receive clinical data per location | Domain Admin request, 1:1 Unique Location ID, integrated vs EMR-only | M1 | BR07–08 |
| M4 | **Setup / Reference Data** [Setup — its own module beside Admin *(client 2026-09-30)*] | Master data used to build claims | Providers (+ claim hold, **provider type Rendering / Billing**), **insurance classes (rule defaults)**, insurances (overrides, **insurance hold + bucket**, payer portal link), **release buckets**, procedure codes (**type, active**), fee schedules (billed price), referring physicians (**type DN/DQ**) | M1 | BR09–12, BR40–45 |
| M5 | **Patient & Case** [Patient] | Clinical-financial container | Patient chart, cases (Default case), ordered ICD-10 list on the case (≤12), **coverage on the patient; each case picks a Primary and optional Secondary** *(client 2026-09-30)*, authorizations per case | M1, M4 | BR13–17 |
| M6 | **Ingestion & Pre-Scrub** [Charges] | Accept and clean incoming charges | Trigger, reconciliation, Inactive Records, Incomplete bucket, Billing Exceptions, Charge Review, **visit-level location and providers**, line pricing and **line place of service** | M3, M4, M5 | BR18–24, BR46–47 |
| M7 | **Queues & Submission** [Charges/Billing 🔎] | Move clean charges toward claims | Ingestion queue; single/bulk/scheduled submission; Updated-charges queue (3 actions) | M6 | BR25 |
| M8 | **Coding & Scrubbing** [Billing 🔎] | Validate and transform | Replace/Drop rules; 6-check matrix; reason holds; auto-resubmit; AI check; **routing to release buckets** | M4, M5, M7 | BR26–28, BR41–42 |
| M9 | **Claims & Clearinghouse** [Billing] | Produce, release and submit claims | Lifecycle, **release-bucket queues and release**, CMS-1500 mapping, **referrer snapshot**, 837P/PDF, Waystar, secondary (no tertiary *(client 2026-09-30)*), daily batch, Rejections & Reasons | M8 | BR29–33, BR48 |
| M10 | **Payment Posting** [Payments] | Apply money and adjustments | Manual posting, ERA 835, check-batch balancing, **computed line balances** | M9 | BR34–36 |
| M11 | **Denial & A/R** [Denial Mgmt, AR Follow-up] | Chase unpaid and denied claims | Payer SLA engine, auto-escalation, Delayed/Denied, denial work queue | M9, M10 | BR37–38 |
| M12 | **Cross-cutting** | Accountability | Work-item ownership, audit history, soft deactivation (`is_active`) | all | BR39 |
| M13 | **Unspecified** | — | Dashboard, Reports & Analytics, Month End, Eligibility/Claim status, Appeals, Referrals, Statements | — | ❓ Q-001, Q-002, Q-047, Q-049–051 |

---

## 6. Feature Inventory

**Statuses:** `Planned` · `Needs Clarification` · `Blocked` · `Retired`. Nothing in the production system is implemented. (Prototype coverage: `docs/PROTOTYPE_COVERAGE.md`.)

| ID | Module | Feature | Description (V2) | Role | Status |
|---|---|---|---|---|---|
| F01 | M1 | Practice onboarding | Legal name, DBA (opt.), billing address, Tax ID (EIN/SSN), taxonomy, Group NPI | System Admin | Needs Clarification (Q-022) |
| F02 | M1 | Location setup | ≥1 primary location; name, service address, NPI, POS (default 11) | Admins | Planned |
| F03 | M1 | Company (optional) | Parent grouping for cross-practice reports | System Admin | Needs Clarification (Q-032) |
| F04 | M2 | User accounts | Username, email, default practice, active, service-account flag | Admins | Planned |
| F05 | M2 | Authentication | Not specified in PRD | All | Needs Clarification (Q-025) |
| F06 | M2 | Roles & permissions | Per-role JSON CRUD by module; union of roles; seeded roles | Admins | Needs Clarification (C-001, C-002, C-008) |
| F07 | M2 | Practice/location scoping & switcher | Row scoping by granted practices and optional locations | All | Needs Clarification (Q-031) |
| F08 | M2 | Encrypted-field masking | SSN decrypted only for System Admin (portal password no longer captured *(client 2026-09-30)*) | System | Planned |
| F09 | M3 | Location linking request | Domain Admin request; 1:1 Unique Location ID | Domain Admin | Needs Clarification (Q-029) |
| F10 | M3 | Billing election | Integrated vs EMR-only; block EMR-only payloads | Domain Admin | Needs Clarification (Q-030) |
| F11 | M3 | Inbound entity sync | Sessions (with location and providers), charges, charts, cases, providers; patient match by `emr_id` | Service account | Blocked (Q-004, Q-080) |
| F12 | M4 | Provider directory | Provider ID, name, credential (optional), specialty, NPI, taxonomy, license, **provider type Rendering / Billing** (replaces payer enrollment *(client 2026-09-30)*) | Admins | Needs Clarification (Q-098) |
| F13 | M4 | Provider claim hold | `claim_hold_until` + reason → visits Delayed | Admins | Needs Clarification (Q-062) |
| F14 | M4 | Insurance master | Class (required), insurance type, payer ID, address, **rule overrides (nullable)**, **insurance hold + release bucket**, payer portal URL (link only, no credentials *(client 2026-09-30)*) | Admins | Needs Clarification (Q-011, Q-081) |
| F15 | M4 | Procedure code catalog | Global CPT/HCPCS; timed flag; default fee; **procedure type; active flag**; **Modifier Override (off by default) with up to 4 modifiers** instead of default modifiers *(client 2026-09-30)* | Admins | Needs Clarification (Q-066, Q-083, Q-099) |
| F16 | M4 | Fee schedule engine | **Billed price** per unit per payer, effective dates; else default fee | Admins | Needs Clarification (Q-020) |
| F17 | M4 | Referring physician directory | Code, name, **type (Referring DN / Supervising DQ)**, NPI | Admins | Needs Clarification (C-006, Q-078) |
| F18 | M5 | Patient chart | Demographics, guarantor, **SSN optional**, no-statements flag, notes (**emergency contact removed**) | Patient | Planned |
| F19 | M5 | Case management | Default case; **referring physician, diagnoses, injury type/date, accident state**, start of care, discharge (**no location, providers or discipline**) | Patient | Needs Clarification (C-014) |
| F20 | M5 | Case diagnoses | Ordered ICD-10 list on the case, ≤12, position = pointer | Patient | Planned |
| F21 | M5 | Coverage | On the patient, no rank; the case picks Primary (required in the form) and optional Secondary *(client 2026-09-30)*; member/group/claim no.; subscriber; employer | Patient | Needs Clarification (C-007, Q-036, Q-100) |
| F22 | M5 | Authorizations | Number, dates, qty, unit, used; consumed by visits **when the payer requires it** | Patient | Needs Clarification (Q-009) |
| F23 | M6 | Billing-cycle trigger & manual charge entry | EMR push or manual creation; **manual entry sets location and providers per visit** | Charges | Needs Clarification (Q-080) |
| F24 | M6 | Record reconciliation | New / replace→Inactive / →Updated queue, by Internal Record ID | System | Needs Clarification (C-005, C-012) |
| F25 | M6 | Inactive Records view | Read-only superseded records | Charges | Needs Clarification (Q-071) |
| F26 | M6 | Incomplete profiles bucket | Draft provider/insurance; quarantine until complete | Charges | Needs Clarification (Q-005, Q-006) |
| F27 | M6 | Billing Exceptions | Patient, Case, Session, Charge, Payment levels | Charges | Needs Clarification (Q-007, Q-008, Q-082) |
| F28 | M6 | Charge Review | Review → Pended/Delayed → Released | Charges | Planned |
| F29 | M6 | Charge-line pricing | Units, modifiers, ≤4 pointers, fee lookup, **place of service (defaults from location), notes** | System | Needs Clarification (Q-021, Q-079) |
| F30 | M7 | Ingestion queue | Released, ready-for-validation charges | Billing | Planned |
| F31 | M7 | Submission modes | Single, bulk, scheduled | Billing | Needs Clarification (Q-041) |
| F32 | M7 | Updated-charges queue | Inactivate / Corrected (Box 22, freq. 7/8) / Submit anyway | Billing | Needs Clarification (Q-019, Q-044, C-004) |
| F33 | M8 | Coding rules engine | Replace and Drop; payer overrides default | Admins | Needs Clarification (Q-013) |
| F34 | M8 | Scrubbing validation matrix | Data, Auth, **Provider type** (replaces Credentialing *(client 2026-09-30)*), Payer rules, **Insurance hold** | System | Needs Clarification (Q-011, Q-098) |
| F35 | M8 | Hold queues & auto-resubmit | Holds grouped by reason; auto-resubmit when resolved | Billing | Needs Clarification (Q-012) |
| F36 | M8 | AI coding quality (add-on) | ICD↔CPT consistency | System | **Removed** *(client 2026-09-30)* (Q-014 answered) |
| F37 | M9 | Claim lifecycle | Fresh/Updated → Scrubbing → Hold → Submitted (+ record statuses) | System | Needs Clarification (C-003, C-013) |
| F38 | M9 | CMS-1500 generation | Box-by-box mapping (ch. 8) | System | Needs Clarification (Q-024, Q-057–Q-061, C-009, C-010) |
| F39 | M9 | 837P / PDF print queue | Electronic and paper output | System | Needs Clarification (Q-015, Q-040) |
| F40 | M9 | Waystar dispatch | Transmit; receive responses | System | Blocked (Q-015) |
| F41 | M9 | Secondary claims | After primary remit posts; Box 29; no tertiary *(client 2026-09-30)* | System | Needs Clarification (Q-017, Q-024) |
| F42 | M9 | Daily batch dashboard | Attempted, actual, held by code, live rejections | Billing | Needs Clarification (Q-042, C-013) |
| F43 | M9 | Rejections & Reasons | Rejection workspace | Billing | Needs Clarification (Q-043) |
| F44 | M10 | Manual payment posting | Insurance/patient/adjustment rows; check batch must balance | Payments | Needs Clarification (Q-045, C-011) |
| F45 | M10 | ERA 835 ingestion | Auto-post; claim-level reconciliation | System | Blocked (Q-015, Q-018) |
| F46 | M10 | Line balances | **Computed** from payments (amount − payments − adjustments) | System | Needs Clarification (Q-017) |
| F47 | M11 | Payer SLA engine | SLA per insurance, manual or AI | Admins | Needs Clarification (Q-011, Q-027) |
| F48 | M11 | Auto-escalation & A/R categories | SLA breach → Delayed; 835 denial → Denied | System | Needs Clarification (Q-028) |
| F49 | M11 | Denial work queue | CARC/RARC; Open, Appealed, Resolved, Written off | Denial Mgmt | Needs Clarification (Q-048) |
| F50 | M11 | AR Follow-up | Permission module only | AR Follow-up | Needs Clarification (Q-001) |
| F51 | M12 | Work-item ownership | Owner, status, priority, due date, next action, history | All | Needs Clarification (Q-003) |
| F52 | M12 | Audit history | "View audit history" (§1.4) | All with View | Needs Clarification (Q-053) |
| F53 | M13 | Dashboard | Not specified | — | Needs Clarification (Q-051) |
| F54 | M13 | Reports & Analytics | Not specified | — | Needs Clarification (Q-050) |
| F55 | M13 | Month End | Closed periods; not specified | — | Needs Clarification (Q-049) |
| F56 | M13 | Eligibility & claim-status integration | Not specified | — | Needs Clarification (Q-002) |
| F57 | M4 | **Insurance classes** | Practice-owned; code, name, 5 rule defaults, active | Admins | Needs Clarification (Q-081) — *new in V2, CH-02* |
| F58 | M4 | **Release buckets** | Practice-owned named manual-release queues; name, description, active; created by Practice Admin | Practice Admin | Needs Clarification (Q-077) — *new in V2, CH-03* |
| F59 | M9 | **Release from bucket** | Claims of held insurances wait after scrubbing until a user releases them | "a user" | Needs Clarification (Q-076, C-013) — *new in V2, CH-01* |
| F60 | M9 | **Referring-physician snapshot on claim** | Taken from the case at claim creation; Box 17/17b | System | Needs Clarification (Q-084) — *new in V2, CH-11* |

---

## 7. Core Workflows

Where the PRD does not fix the order of stages, it is marked ⚠A01.

**W1 · Onboarding & setup ✅**
```
(Company, optional) → Practice → ≥1 Location → Users + Roles + Practice/Location grants
  → Providers · Insurance classes (rule defaults) · Release buckets
  → Insurances (class, optional rule overrides, insurance hold → bucket)
  → Procedure codes (type, active) · Fee schedules (billed price) · Referring physicians (DN/DQ)
```

**W2 · EMR integration ✅**
```
Domain Admin request → map Location ↔ EMR location (1:1 Unique Location ID)
  → elect Integrated | EMR-only → integrated locations stream data
```

**W3 · Patient & case ✅**
```
Patient (demographics, guarantor) → Case (referring physician, ordered ICD-10 ≤12, injury type/date, accident state)
  → Patient coverage, no rank (member/group/claim no., subscriber, employer) → case Primary + optional Secondary *(client 2026-09-30)* → Authorizations (per case)
```
Location and providers are **not** on the case (CH-04) ✅ · ❓ C-014.

**W4 · Charge → claim** (main pipeline; stage order ⚠A01)
```
EMR note finalized | manual charge (visit gets location, billing + rendering provider) ✅
  ↓ location integrated?  no → blocked ✅
  ↓ Internal Record ID lookup → new | replace (old → Inactive) | → Updated queue (W5) ✅
  ↓ unknown provider/insurance → draft profile → Incomplete bucket ✅
  ↓ Billing Exceptions (patient / case / session / charge) ✅
  ↓ lines priced (billed rate × units, else default fee); line POS defaults from location ✅
  ↓ Charge Review: Review → Pended (missing / no auth when required) | Delayed (provider hold) → Released ✅
  ↓ Ingestion queue → submit (single | bulk | scheduled) ✅
  ↓ Coding rules (Replace/Drop) → scrubbing (6 checks, effective class/insurance rules) ✅
  ↓ checks 1–5 fail → Hold queue by reason → auto-resubmit when resolved (❓ Q-012) ✅
  ↓ insurance hold checked → release bucket → user releases (❓ Q-076, C-013) ✅
  ↓ pass / released → claim (referrer snapshot) → CMS-1500 PDF | 837P → Submitted → Waystar ✅
  ↓ daily batch metrics · rejections → Rejections & Reasons ✅
```

**W5 · Updated note after submission ✅:** Updated queue → user picks **Inactivate** / **Corrected claim** (Box 22: original ref + 7 or 8) / **Submit anyway**.

**W6 · Hold resolution ✅:** fix the data (auth, provider type, case fields) → auto-resubmit. **Release buckets are the exception:** only a user action moves those claims.

**W7 · Payment posting ✅**
- Manual: check batch → per-line insurance/patient payments and CARC adjustments → batch must balance.
- ERA: 835 → claim-level reconciliation → payment exceptions.
- Then: line balances recalculate → secondary claim created after the primary remit posts.

**W8 · Escalation ✅:** SLA breached with no payment, or 835 denial → cloned into Denial & A/R as **Delayed** or **Denied** → denial worked to Appealed / Resolved / Written off (❓ Q-028, Q-048).

---

## 8. Business Rules

✅ unless marked. Retired IDs are kept for traceability.

| ID | Rule | Where | Conditions | Expected behavior |
|---|---|---|---|---|
| BR01 | ≥1 location per practice | §1.2 | Account creation | Practice requires a primary location |
| BR02 | Everything is practice-scoped | §10.7 | Locations, providers, insurance classes, insurances, release buckets, referrers, patients | Each belongs to exactly one practice. `procedure_code` is global. |
| BR03 | Access = role permission ∧ practice grant | §10.6 | Every request | Deny unless both hold (global role skips grant) |
| BR04 | Roles combine as a union | §10.2 | Several roles | OR of flags |
| BR05 | Location narrowing | §10.2 | `location_ids` non-empty | Limit to those locations; empty = all · ❓ Q-031 (what non-visit records are visible) |
| BR06 | Encrypted fields masked | §10.6 | `ssn_enc` (portal credentials no longer captured *(client 2026-09-30)*) | Decrypt only for System Admin |
| BR07 | Integration per location | §2.1 | Always | Never global |
| BR08 | EMR-only locations blocked | §2.3 | Payload from non-integrated location | Reject from billing ingestion |
| BR09 | Fee resolution | §3.4, §10.3 | Charge-line creation | Payer `fee_schedule` **billed** rate × units, else `procedure_code.default_fee` · ❓ Q-020 |
| BR10 | Provider claim hold | §10.3 | `claim_hold_until` set | "Visits before this date are delayed" → Delayed queue · ❓ Q-062 |
| BR11 | Clinicians aren't users | §1.3 | Always | Provider record only |
| BR12 | Billing-required fields | §3.2, §10 | Before claim creation | Provider NPI; patient DOB, gender, address; **case referring physician**; member ID + group number; referring name, type, NPI. *(V1's case location and billing provider requirement removed — CH-04.)* ❓ C-006 |
| BR13 | Default case | §10.4 | Every patient | ≥1 case, "Default" |
| BR14 | Diagnoses ordered, ≤12 | §3.2, §10.4 | Case | `icd10_codes` array; position = pointer; line has ≤4 pointers |
| BR15 | Case Primary / Secondary | §10.4, changed *(client 2026-09-30)* | Case | Coverage belongs to the patient without a rank; the case names a Primary and an optional Secondary (different); no tertiary; claims target the coverage with the case's rank ❓ Q-100 |
| BR16 | Authorization gating | §10.4, §10.5, §6.2 | **Effective** `authorization_required` | No usable auth → visit Pended; at scrub: valid number, active dates, remaining > 0. Visit authorization optional when not required. ❓ Q-009 |
| BR17 | Injury date conditional | §10.4 | **Effective** `injury_date_required` | Injury date required on the case |
| BR18 | Record reconciliation | §4.2 | Existing Internal Record ID | In pipeline/held → replace (old inactive). Submitted/scrubbing → Updated queue. ❓ C-005, C-012 |
| BR19 | Unknown entities quarantined | §4.3 | Provider/insurance not found | Draft profile; session held in Incomplete bucket |
| BR20 | Dummy data flags | §4.4 | Phone 000-000-0000; NPIs 9999999999/1234567890; missing rendering NPI | Billing Exception |
| BR21 | ZIP ↔ state; length caps | §4.4 | Patient/session fields | Flag mismatch; truncate **or** flag ❓ Q-007 |
| BR22 | Unpriced charges quarantined | §4.4 | Code missing from both schedules or $0.00 | Quarantine the charge |
| BR23 | Diagnosis snapshot | §10.5 | Visit arrival | Copy `patient_case.icd10_codes` to visit ❓ Q-038 |
| BR24 | One visit per case per DOS | §10.5 | Visit creation | UQ (case, DOS) ❓ C-005 |
| BR25 | Updated-queue actions | §5.2 | Update to submitted claim | Inactivate / Corrected (Box 22 ref + 7 or 8) / Submit anyway |
| BR26 | Coding-rule precedence | §6.1 | Fresh, resubmitted, corrected | Payer-specific overrides default |
| BR27 | Scrub failure → hold by reason | §6.2 | A check fails | Missing Data · Provider hold · Authorization · **Provider type** (Rendering → hold *(client 2026-09-30)*) · Payer Rule (units > cap; 10b/14/17) · Audit · release bucket |
| BR28 | Auto-resubmit | §7.1 | Hold reason resolved | Resubmit automatically — not release buckets (BR42) ❓ Q-012, C-013 |
| BR29 | One claim per visit per rank | §10.5 | Claim creation | Secondary only after primary remit posts ❓ C-004 |
| BR30 | Claim totals | ch. 8 | Always | Box 28 = sum of charges; Box 29 = paid when billing secondary, else 0 |
| BR31 | CMS-1500 constants | ch. 8 | Always | 12 = SOF + DOS · 13 = SOF · 20 = No · 21 = "0" · 27 = Yes unless No ❓ C-009, Q-064 |
| BR32 | CMS-1500 conditionals | ch. 8 | Case/insurance data | 9/9a/9d/11d from secondary · 10b auto → state · 11b PIP → claim no. + qualifier · 17 DN/DQ · 22 corrected/void · 23 auth · 32 omitted for POS 02, 10, 12 ❓ Q-079 |
| BR33 | Daily batch | §7.2 | Calendar day | Attempted, actual, held/failed by code, live rejections |
| BR34 | Payment amounts | §10.5 | Posting | Positive; reduce line balance; adjustments carry CARC ❓ C-011 |
| BR35 | Check batch balances | §10.5 | Same check number | Must equal check amount ❓ Q-045 |
| BR36 | Reconciliation equation (as written) | §9.1 | Posting | Charge − Allowed − Contractual − Patient Resp = Paid ❓ Q-016 (does not balance), Q-075 (allowed amount source) |
| BR37 | Auto-escalation | §9.2 | SLA exceeded w/o payment, or 835 denial | Clone into Denial & A/R |
| BR38 | A/R categories | §9.2 | Escalated item | Delayed or Denied |
| BR39 | Ownership on actionable items | core principle | Every actionable item | Owner, status, priority, due date, next action, history ❓ Q-003 |
| BR40 | **Effective billing rule** | §10.3 p16 | Any use of auth-required, injury-date-required, specialty modifiers, accept assignment, ICD version | Insurance value if not null, else class value (COALESCE) — *CH-02* ❓ Q-081 |
| BR41 | **Every insurance has exactly one class** | §10.3 p15–16 | Insurance create/edit | Class required |
| BR42 | **Insurance hold → release bucket** | §6.2 p7, §10.3 p16 | Effective `insurance_hold` checked | After scrubbing, claim stops in the insurance's bucket; goes out only when a user releases it — *CH-01* ❓ Q-076 |
| BR43 | **Bucket required when held; same practice** | §10.3 p16 | `insurance_hold` checked | `release_bucket_id` shown and required; bucket must belong to the insurance's practice |
| BR44 | **Inactive buckets not assignable** | §10.3 p17 | Assigning a bucket to an insurance | Only active buckets for new assignments ❓ Q-077 |
| BR45 | **Inactive procedure codes** | §10.3 p17 | Adding a charge line | Inactive codes cannot be added to new lines ❓ Q-082 (EMR arrivals) |
| BR46 | **Location and providers per visit** | §10.4 p19, §10.5 p20 | Visit creation | Set from EMR payload or manual entry; no case default — *CH-04* ❓ Q-080, C-014 |
| BR47 | **Line place of service** | §10.5 p21 | Charge-line creation | Defaults from `location.place_of_service`; Box 24B — *CH-10* ❓ Q-079 |
| BR48 | **Referrer snapshot on claim** | §10.5 p21 | Claim creation | Copy case's referring physician to claim; Box 17/17b; type sets DN/DQ qualifier — *CH-11, CH-12* ❓ Q-078, Q-084 |

---

## 9. Entities & Data

**Source ✅:** PRD ch. 10, Core Database Schema v2 (PostgreSQL). **23 tables (19 core + 4 relation)** — CH-16.
**Every table also has** `<table>_id` (identity PK), `created_at`, `created_by`, `updated_at`, `updated_by`.

| Group | Entity | Purpose | Key fields |
|---|---|---|---|
| Org & users | `company` | Optional owner; reports only | name (UQ), is_active |
| | `practice` | Billing entity ("Company" in UI) | code, name, npi, tax_id, address (pay-to), is_active |
| | `location` | Clinic site | code (UQ/practice), name, npi, address, place_of_service (default 11), is_active |
| | `app_user` | Login or service account | username, display_name, email, is_service_account, default_practice_id, is_active |
| | `role` | Permission set | code, name, is_global, permissions jsonb `{MODULE:{c,r,u,d}}` |
| | `user_practice` *(rel)* | Practice grant | PK(user, practice), location_ids[] |
| | `user_role` *(rel)* | Role assignment | PK(user, role) |
| Setup | `provider` | Clinician | code (Provider ID), first/last name, credential (optional), specialty, npi, taxonomy_code, state_license, claim_hold_until, claim_hold_reason, **provider_type Rendering / Billing** *(client 2026-09-30)*, is_active |
| | **`insurance_class`** *(new)* | Rule defaults for a group of payers | code (UQ/practice), name, authorization_required, injury_date_required, apply_specialty_modifiers, accept_assignment, icd_version (default ICD10), is_active |
| | `insurance` | Payer as billed | insurance_class_id (required), code (int, UQ/practice), name, insurance_type (claim filing indicator), payer_id, address/phone/fax, **rules nullable = inherit**, icd_version nullable, **insurance_hold**, **release_bucket_id** (required when held), portal_url (no user/password *(client 2026-09-30)*), is_active |
| | **`release_bucket`** *(new)* | Manual-release queue | name (UQ/practice), description, is_active |
| | `procedure_code` | CPT/HCPCS (**global**) | code, description, is_timed, default_modifier, default_fee, **procedure_type**, **is_active** |
| | `fee_schedule` *(rel)* | Billed price | PK(insurance, procedure_code), billed_amount (per unit), effective_from/to *(allowed_amount removed — CH-08)* |
| | `referring_physician` | Referring or supervising doctor | code, name, **type (DN/DQ)**, npi |
| Patient | `patient` | Person in care | emr_id (UQ), names, date_of_birth, gender, ssn_enc (**optional**), address, phones, email, guarantor (null = self), no_statements, notes, is_active *(emergency_contact removed — CH-14a)* |
| | `patient_case` | Episode of care | patient_id, name, referring_physician_id (required for billing), **icd10_codes[] (≤12)**, injury_type, injury_date, start_of_care, discharge_date, accident_state, is_active *(location_id, billing_provider_id, discipline removed — CH-04)* |
| | `case_insurance` *(rel)* | Coverage | V2: case, insurance, rank (UQ/case). **Client 2026-09-30:** belongs to the patient, no rank; the case holds primary and secondary coverage references (Q-100). member_id, group_number, claim_number, subscriber (null = self), employer (WC) |
| | `authorization` | Payer pre-approval | case_insurance_id, number, start/end_date, authorized_qty, unit (Visits/Units), used_qty |
| Billing | `visit` | Date of service ("Charge") | case_id, date_of_service (UQ with case), **location_id, billing_provider_id, treating_provider_id (set on visit)**, authorization_id (**optional**), diagnosis_codes[] (snapshot), status, pend_reason, source (EMR/Manual) |
| | `charge_line` | Procedure billed | visit_id, procedure_code_id, units, amount, modifiers[], **place_of_service**, diagnosis_pointers[] (≤4), **notes** *(balances computed — CH-09)* |
| | `claim` | Bill to one payer | visit + case_insurance (UQ), format (837P/CMS1500), status, sent_date, total_amount, clearinghouse_ref, **referring_physician_id (snapshot)** |
| | `payment` | Money or write-off per line | charge_line_id, insurance_id (null = patient), kind (Insurance payment / Patient payment / Adjustment), amount (>0), reason_code (CARC), check_number, check_date, posted_date |
| | `denial` | Denial work item | charge_line_id, claim_id, carc, rarc, received_date, status, notes |

**Dropped, to be re-added with their modules ✅:** verification_form, medicare_cap, patient_statement, era_file, account_note. **Dropped in V2:** `case_diagnosis` (folded into the case).

**Required by PRD chapters 1–9 but NOT in the V2 data model ❓** (don't invent columns — see register §7):
- **Ingestion:** Internal Record ID on visit; inactive records; Updated-queue payloads; Incomplete-bucket entries; Billing Exception records (C-005, C-003, Q-071).
- **Scrubbing/claims:** coding rules; hold records incl. who released a bucketed claim; scheduled jobs; daily batches; rejections; payer ICN and frequency code; Box 19 comment (Q-013, Q-076, Q-041, Q-043, Q-019, Q-063).
- **Setup:** practice DBA/taxonomy/tax-ID type; location EMR link and integrated flag; payer unit caps, conditional boxes, SLA days, claim format; referring taxonomy/contact/referral orders (Q-022, Q-029, Q-010, Q-011, C-006).
- **Coverage:** effective/termination dates; employment status (C-007, Q-008).
- **Money:** expected allowed amount; insurance-vs-patient split of computed balances; check-batch total; reversal representation; CARC list; Delayed A/R items; appeals (Q-075, Q-017, Q-045, C-011, Q-018, Q-028, Q-048).
- **Cross-cutting:** work-item fields; audit history; month-end periods; field-level Hidden permissions (Q-003, Q-053, Q-049, C-001).

---

## 10. Relationships ✅ (§10.7, p23–24)

| Parent | Child | Cardinality | Meaning |
|---|---|---|---|
| company | practice | 1 : 0..* | Optional owner |
| practice | location, provider, insurance_class, insurance, release_bucket, referring_physician, patient | 1 : * | Everything scoped to a practice |
| app_user ↔ practice | user_practice | * : * | Where the user may work |
| app_user ↔ role | user_role | * : * | What the user may do |
| insurance_class | insurance | 1 : * | Class holds rule defaults; insurance may override |
| release_bucket | insurance | 1 : 0..* | Held insurances grouped for manual release |
| insurance ↔ procedure_code | fee_schedule | * : * | Billed price per code |
| patient | patient_case | 1 : 1..* | Episodes of care |
| patient_case | referring_physician | * : 1 | Referred by whom |
| patient_case ↔ insurance | case_insurance | 1 : 0..3 | Coverage in payment order |
| case_insurance | authorization | 1 : 0..* | Payer approvals |
| patient_case | visit | 1 : 0..* | One per date of service |
| visit | location, provider | * : 1 | Where and by whom |
| visit | charge_line | 1 : 1..* | Procedures performed |
| visit + case_insurance | claim | 1 : 0..3 | One claim per payer billed; carries the referring physician |
| charge_line | payment, denial | 1 : 0..* | Money in, write-offs, refusals |

🔎 A claim waits in a bucket only indirectly: claim → case_insurance → insurance → release_bucket. No table links a claim to a bucket (❓ Q-076).

---

## 11. Statuses & State Transitions

| Entity | Statuses ✅ | Transitions | Open |
|---|---|---|---|
| Visit (§10.5 p20) | Review, Pended, Delayed, Released | Review → Pended (something missing, e.g. no auth when required) · Review → Delayed (provider hold) → Released | Return paths and who reverses 🔎 · Q-062 |
| Claim lifecycle (§7.1 p8) | Fresh/Updated, Scrubbing, Hold, Submitted | Fresh → Scrubbing → Hold (checks fail) → auto-resubmit · Scrubbing → Submitted · **held insurance → release bucket → user release → Submitted** | C-003, C-013, Q-012 |
| Hold queues (§6.2 p7) | Missing Data, Provider Hold, Authorization Hold, **Provider Type Hold** (replaces Credentialing *(client 2026-09-30)*), Payer Rule Hold, Audit Hold, **one queue per release bucket** (Coding Issue Hold removed) | Resolve → auto-resubmit; bucket → user release | Q-076, Q-077 |
| Claim record (§10.5 p21) | Scrubbed, Failed, Rejected, Sent, Paid, Denied | Not defined | C-003 |
| Denial (§10.5 p22) | Open, Appealed, Resolved, Written off | Not defined | Q-048 |
| A/R category (§9.2 p11) | Delayed, Denied | SLA breach → Delayed; 835 denial → Denied | Q-028 |
| Soft-deactivation | `is_active` on practice, location, provider, insurance class, insurance, release bucket, procedure code, patient, case | Inactive bucket not assignable; inactive code not addable | Q-068, Q-077, Q-082 |

KI-02: these vocabularies are not mapped to each other.

---

## 12. Calculations

| Calculation | Rule | Status |
|---|---|---|
| Charge line amount | fee_schedule billed_amount × units, else default_fee × units (§10.3 p17: "97110 × 2 units = $60.00") | ✅ · ❓ Q-020 (per-code pricing) |
| Effective billing rule | COALESCE(insurance value, class value) (§10.3 p16) | ✅ |
| Remaining authorization | authorized_qty − used_qty | ⚠ A07 · ❓ Q-009 |
| Line balance | amount − payments − adjustments, computed not stored (§10.5 p21) | ✅ · ❓ Q-017 (payer/patient split) |
| Claim total / Box 28 | Sum of charge amounts | ✅ |
| Box 29 | Sum paid when billing secondary; 0 for primary | ✅ |
| Check batch | Sum of rows with same check number = check amount | ✅ · ❓ Q-045 |
| Reconciliation | "Original Charge − Allowed Amount − Contractual Adjustment − Patient Responsibility = Paid Amount" (§9.1 p11) | ✅ as written · ❓ Q-016 (does not balance), Q-075 (no stored allowed amount) |
| Timed units | 8-minute rule | ✅ named · ❓ Q-021 |

---

## 13. Integrations

| System | Direction | What | Status |
|---|---|---|---|
| EMR | In | Sessions (with location and providers — CH-04), charges, patient charts, cases, providers; per integrated location; matched by Internal Record ID and `emr_id` | ✅ · Blocked on payload contract ❓ Q-004, Q-080 |
| Waystar | Out/In | 837P files or PDF print queue; rejections; 835 remittances | ✅ · deferred by PRD ❓ Q-015, Q-018 |
| AI engine | Out/In | Diagnosis-to-CPT consistency; predictive SLA | ✅ named · ❓ Q-014, Q-027 |
| WebPT Billing Exceptions Guide | Reference | Standard for exceptions | ✅ · ❓ Q-065 |

---

## 14. Notifications

❓ Not mentioned in V1 or V2 (Q-052). Nothing is assumed. Due dates in the core principle imply reminders 🔎 but no requirement exists.

## 15. Reporting

- ✅ Daily submission batch metrics (§7.2): attempted, actual, held/failed by code, live rejections → Rejections & Reasons.
- ✅ Reports permission: read-only for Practice Admin, granted practices only (§10.6); company exists for cross-practice reports (§10.2).
- ❓ Dashboards and analytics unspecified (ch. 11) — Q-050, Q-051. Month End — Q-049. Whether claims waiting in release buckets count as "held" — C-013.

## 16. Edge Cases

| Edge case | Defined? | Reference |
|---|---|---|
| Payload from EMR-only location | ✅ blocked | §2.3 |
| Note re-sent before / after submission | ✅ replace / Updated queue · ❓ during scrubbing | §4.2, C-012 |
| Unknown provider or insurance | ✅ draft + quarantine | §4.3 |
| Dummy phone / NPIs, ZIP mismatch, over-length | ✅ flagged · ❓ truncate vs flag | §4.4, Q-007 |
| New code priced $0 / missing from schedules | ✅ quarantined | §4.4 |
| Provider on claim hold | ✅ Delayed | §10.3 |
| No auth when required | ✅ Pended; scrub Authorization Hold | §10.4, §6.2 |
| Insurance hold checked | ✅ claim waits in bucket | §6.2, §10.3 |
| Hold unchecked / bucket changed or deactivated with claims waiting | ❓ | Q-077 |
| EMR session without location or billing provider | ❓ | Q-080 |
| EMR charge with inactive procedure code | ❓ | Q-082 |
| Lines on one visit with different POS (Box 32) | ❓ | Q-079 |
| Both referring and supervising physician needed | ❓ | Q-078 |
| Case referrer changed after claim created | 🔎 claim keeps snapshot · ❓ corrected claims | Q-084 |
| Two sessions same case same day | ❓ blocked by UQ | C-005 |
| Corrected / void / submit-anyway vs one claim per payer | ❓ | C-004, Q-044 |
| Check batch out of balance | ❓ | Q-045 |
| Reversal vs positive-only amounts | ❓ | C-011 |
| Concurrent edits | ❓ | Q-067 |
| Deactivated practice/location with open claims | ❓ | Q-068 |

---

## 17. Architecture / Technical Context

**Production application: no architecture decisions yet.** Stack, frontend, backend, API, auth and module boundaries are undecided. Only PRD-stated constraint ✅: **PostgreSQL** (ch. 10) with `jsonb`, arrays, `citext`, `bytea` for encrypted fields.

**Clickable prototype (`prototype/`) — not the product.** 🛠
- Client validation artifact: plain HTML/CSS/JS, in-memory data, no backend. Migrated to PRD V2 on 2026-09-16.
- **Two environments in one prototype (2026-09-17):** *Demo Data* (the seeded practices) and *Fresh System* (day one: only the two V2-seeded roles, one System Admin account, standard code lists). Chosen at `#/welcome`; switching or resetting rebuilds that environment from scratch, so data never crosses between them. Details: `docs/PROTOTYPE_COVERAGE.md` §8–9.
- **Product plus review notes (2026-09-17):** the **Billing System** screens contain only product content. A thin **Review Notes** layer (`js/prototype/review-notes.js`) attaches assumptions, client questions and short notes to the screen they belong to: one small control, numbered markers, a small popover, three note types. It also holds the simulators and environment actions (Alt + Shift + S). Off with Alt + Shift + N. Details: `docs/PROTOTYPE_COVERAGE.md` §10.
- **Rule for future prototype work:** never put PRD citations, question/assumption IDs, "prototype"/"simulate"/"not specified" wording or environment controls into application screens — add a review note in `js/prototype/review-notes.js` instead.
- Coverage, prototype-only assumptions (A-P##) and QA record: `docs/PROTOTYPE_COVERAGE.md`. Launch notes: `prototype/README.md`.
- `js/engine.js` is a readable executable sketch of the rules (intake, scrubbing with effective class rules, holds and buckets, ERA posting, secondary claims) — input for design, not code to port.
- Visual source: EMR-V.2 live `src/index.css` tokens ("instrument" direction) and component anatomy.

**Visual learning guide (`docs/BILLING_SYSTEM_GUIDE.html`)** — standalone page teaching the business process from zero; migrated to V2.

### Technical decisions (prototype only; no production ADRs yet)

**Decision: Plain HTML/CSS/vanilla JS with in-memory data** — explicit user instruction; double-click launch; refresh resets. Alternatives: React/Vite (build step; could be mistaken for product), static mock-ups (can't show the cycle). 2026-09-15.

**Decision: Classic scripts in dependency order, not ES modules** — ES modules are blocked over `file://`. 2026-09-15.

**Decision: Visual system follows EMR-V.2's live code** — its `index.css` is newer than its CLAUDE.md (code > docs). 2026-09-15.

**Decision: External systems appear as explicit simulators** — the client must tell product behaviour from stand-ins (EMR push, Waystar response, ERA, SLA timer, scheduled job). 2026-09-15; *superseded in placement 2026-09-17:* the simulators moved out of the application into the Prototype Guide (Simulate tab, Guide-off control, Alt+Shift+S) and open in prototype-styled dialogs.

**Decision: Payer allowed amounts live only inside the simulated payer** — V2 removed the stored allowed amount (CH-08); the ERA simulator needs one to produce a remittance, so it lives in the simulator's payer data, never on a product screen. 2026-09-16.

**Decision: Demo and Fresh environments share one codebase and swap the whole data set** — `js/prototype/environment.js` builds either the demo seed or an empty V2 installation and resets every id counter and sequence; screens are identical. Alternatives: a second copy of the prototype (drift, double maintenance), persisting both side by side (no persistence by design). Switching resets the session, as requested. 2026-09-17.

**Decision: The prototype is the product plus a review-note layer** — the application must be demonstrable as the real product, so it knows nothing about being a prototype; review information is attached to it as annotations, the way design-review comments are. The application exposes only two neutral router hooks (`R.hooks.gate`, `R.hooks.afterRender`); the layer renders outside `#app` and reads the route only. Alternatives tried and rejected by the user: inline notices in the screens (contaminates the product), and a full companion "Prototype Guide" with panel, walkthroughs and library (a second application; the user asked for something far simpler). 2026-09-17.

**Decision: One open-question numbering scheme** — this file references `docs/PRD_CLARIFICATION_QUESTIONS.md` IDs directly; internal `Q01…Q57` retired. Reason: traceability across memory, guide, prototype and coverage. 2026-09-16.

---

## 18. Implementation Progress

```text
M1  Account Setup            [Planned]
M2  Identity & Access        [Needs Clarification]
M3  EMR Integration          [Blocked – EMR contract]
M4  Setup / Reference Data   [Needs Clarification – classes, buckets]
M5  Patient & Case           [Planned]
M6  Ingestion & Pre-Scrub    [Needs Clarification]
M7  Queues & Submission      [Needs Clarification]
M8  Coding & Scrubbing       [Needs Clarification]
M9  Claims & Clearinghouse   [Blocked – Waystar access]
M10 Payment Posting          [Blocked – Waystar/835; module unspecified]
M11 Denial & A/R             [Needs Clarification – module unspecified]
M12 Cross-cutting            [Needs Clarification]
M13 Dashboard/Reports/Month End/Eligibility [Not specified]
```

**Proposed build order (not a confirmed decision):** M1/M2 → M4/M5 → M6 → M7/M8 → M9 → M10 → M11.

**Artifacts (all aligned to PRD V2 on 2026-09-16):** change log, clarification register, visual guide, prototype, coverage. Production system: nothing built.

---

## 19. Known Issues

### KI-01 Data-model constraints contradict functional flows
- `claim` UQ(visit, case_insurance) blocks corrected claims and "Submit anyway"; `visit` UQ(case, DOS) conflicts with note-level reconciliation (no record-ID column); `fee_schedule` PK blocks several dated prices.
- Status: open (C-004, C-005, Q-020). Possible solution: schema revision with claim versioning, note ID, date-versioned prices — needs sign-off.

### KI-02 Fragmented state vocabularies
- No mapping between Incomplete bucket, Billing Exceptions, visit statuses, §7.1 lifecycle, claim statuses, hold queues, **release buckets** and A/R categories; "Delayed" means two things; V2 calls buckets hold queues though they never auto-resubmit.
- Status: open (C-003, C-013, Q-028).

### KI-03 Conflicting permission models
- §1.4 Edit/View/Hidden per user/section/field vs §10 CRUD per role/module; no release permission defined. Status: open (C-001, C-002, Q-076).

### KI-04 External dependencies unavailable
- No Waystar developer access; no EMR payload contract. Blocks F11, F39–F41, F45. Status: waiting on business (Q-004, Q-015).

### KI-05 Payment math
- Reconciliation equation does not balance; V2 removed the stored allowed amount and the stored payer/patient balance split; positive-only amounts conflict with reversals. Status: open (Q-016, Q-017, Q-075, C-011).

### KI-06 Core-principle fields absent from the model
- No owner, priority, due date, next action or history anywhere. Status: open (Q-003).

### KI-07 Case/visit restructuring left gaps *(new, V2)*
- Hierarchy (§3.1) and provider text (§10.3) still place location/providers at case level; visits have no stated default when the payload lacks them; discipline no longer recorded but specialty modifiers still apply. Status: open (C-014, Q-080, Q-054).

---

## 20. Open Questions

**Register:** `docs/PRD_CLARIFICATION_QUESTIONS.md` — re-audited against V2 on 2026-09-16.

| | Count |
|---|---|
| Open questions | 89 (31 Critical · 44 Important · 14 Nice to clarify) |
| Contradictions | 14 |
| Assumptions we would otherwise make | 21 |
| Retired (answered by V2) | 2 — Q-023, Q-039 |
| New from V2 | Q-075 – Q-084, C-013, C-014 |
| New from modelling a fresh installation (2026-09-17) | Q-085 (initial / reference data at installation and per new practice), Q-086 (first account and first practice) |
| New from meeting notes (2026-09-23) | Q-087 – Q-097 (provider hold scope, payer enrollment replacement, audit-required flag, scheduling options, statement preferences, related cause, submission-queue naming, original claim number, bucket release channels, referring-physician code, coding-rule precedence) |
| Answered by the client (2026-09-23), kept for the record | Q-087 (provider hold: window, scope, both sides), Q-089 (audit hold + documents), Q-090 (the practice fills the schedule list), Q-091 (Billing preferences removed), Q-092 ("Other" removed from Related cause), Q-096 (referring-physician code removed) |

**Status:** pending client clarification. Nothing has been answered by the client.

**Most important unresolved areas**
1. Scope of the first release — Q-001, Q-002.
2. One status model, including release buckets — C-003, C-013, Q-012.
3. Access control and who releases bucketed claims — C-001, C-002, Q-076.
4. Money: equation, allowed amount, balance split, reversals — Q-016, Q-075, Q-017, C-011.
5. Where visit data comes from after V2 — Q-004, Q-080, C-014.
6. Scrubbing inputs without a home — Q-010, Q-011.
7. External contracts — Q-004, Q-015.
8. Non-functional requirements — Q-025, Q-026, Q-073.

When an answer arrives: update the register, the affected BR in §8, the assumption in §21, and any prototype assumption in `docs/PROTOTYPE_COVERAGE.md`.

---

## 21. Assumptions ⚠

None confirmed. Don't build on an assumption without flagging it.

| ID | Assumption | Reason | Area | Question | Confirmed |
|---|---|---|---|---|---|
| A01 | Pipeline order: reconciliation → Incomplete → Exceptions → Charge Review → queue → coding rules → scrubbing | PRD chapter order; no explicit sequence | M6–M8 | C-003 | No |
| A02 | Claims in a release bucket are never resubmitted automatically | V2 says they go out "only when a user releases them" — contradicts §7.1 wording | M8–M9 | C-013 | No |
| A03 | *Retired 2026-09-16* (was: V1 file content is the baseline) — V2 is now the primary source | — | — | — | — |
| A04 | "Organization" as a CMS-1500 source means `practice` | Practice holds NPI, Tax ID, pay-to address | M9 | C-010 | No |
| A05 | Queues and scrubbing fall under Charges/Billing permission modules; releasing from a bucket needs Billing update | §10.6 lists no dedicated modules | M2, M7–M9 | Q-076 | No |
| A06 | 837P content uses the same sources as the CMS-1500 mapping | Only CMS-1500 mapping given | M9 | Q-015 | No |
| A07 | Remaining authorization = authorized_qty − used_qty | "remaining visits" named, not stored | M5, M8 | Q-009 | No |
| A08 | The ch. 10 schema needs a revision before implementation | KI-01, §9 missing-concept list | All | — | No |
| A09 | Effective rule values are evaluated when a claim is scrubbed | V2 gives COALESCE but no timing | M4, M8 | Q-081 | No |
| A10 | The allowed amount is known only from remittances; no underpayment detection | V2 removed stored allowed amount | M10 | Q-075 | No |

Register-level assumptions `A-001…A-020` (in `docs/PRD_CLARIFICATION_QUESTIONS.md` §9) show the client what a developer would otherwise decide. Prototype-only assumptions `A-P##` are in `docs/PROTOTYPE_COVERAGE.md`; they make the demo work and are **not** product decisions.

---

## 22. Important Terminology

PRD terms are used loosely (❓ Q-003 context, C-010).

| Term | Meaning in this project (V2) |
|---|---|
| Session / Encounter / Visit / "Charge" | One date of service for one case; table `visit`; "Charge" in Charge Review. Holds its own location and providers. |
| Charge line | One CPT/HCPCS procedure on a visit, with its own place of service. Unit billed, paid, denied. |
| Claim | A bill to one payer (the case's primary or secondary) for one visit; keeps a snapshot of the referring physician. |
| Practice | The billing entity. **Shown as "Company" in the UI.** |
| Company / Organization | Optional parent of practices; cross-practice reporting only. |
| Location / Facility | Physical clinic; unit of EMR integration; supplies default POS. |
| Case | Episode of care: referring physician, ordered diagnoses, injury type/date, coverage, authorizations. **No location/providers/discipline.** |
| Insurance class | Group of insurances sharing billing-rule defaults (Medicare, Blue Shield, Workers' Comp, Auto…). |
| Effective rule | The insurance's own rule value if set, otherwise its class's. |
| Insurance hold | Check mark on an insurance: its claims need manual release. |
| Release bucket | Named, practice-owned queue where claims of held insurances wait after scrubbing until a user releases them. |
| Hold queue | Where a claim waits after failing a scrub check, grouped by reason. |
| Referring physician type | Referring (DN) or Supervising (DQ); sets the Box 17 qualifier. |
| Fee schedule | Billed price per unit for one code and one insurance. **Not** an allowed/contract amount in V2. |
| Procedure type | Category of a code: Evaluation, Therapeutic, Modality, Supply / DME… |
| Line balance | amount − payments − adjustments, calculated on demand. |
| Internal Record ID | 1:1 with an EMR medical note; the reconciliation key. |
| Delayed | Two meanings: visit waiting on a provider hold; A/R item with SLA exceeded. |

---

## 23. V1 → V2 Changes

Full detail with page references: **`docs/PRD_V1_TO_V2_CHANGELOG.md`**.

| ID | Change | Impact on this file |
|---|---|---|
| CH-01 | Manual release: user preference → insurance hold + release bucket | BR27–28, BR42–43; W4, W6; F34, F59; §11 |
| CH-02 | Insurance class becomes a record with rule defaults; insurance rules nullable (inherit) | BR16–17, BR40–41; F14, F57 |
| CH-03 | New release buckets (Practice Admin creates) | BR44; F58; §4 |
| CH-04 | Location, billing provider, discipline removed from case; set per visit | BR12, BR46; W3–W4; F19, F23; KI-07 |
| CH-05 | `case_diagnosis` dropped; ordered ICD-10 array on the case | BR14, BR23; F20 |
| CH-06 | Visit authorization optional (only when payer requires) | BR16; F22 |
| CH-08 | Fee schedule loses allowed amount; "billed price" | BR09, BR36; §12; KI-05 |
| CH-09 | Line balances computed, not stored | F46; §12 |
| CH-10 | Place of service and notes on each charge line | BR47; F29 |
| CH-11 | Claim snapshot of referring physician | BR48; F60 |
| CH-12 | Referring physician type DN/DQ | BR48; F17 |
| CH-13 | Procedure type and active flag | BR45; F15 |
| CH-14 | Emergency contact removed; SSN optional | F18 |
| CH-15–17 | Provider ID/credential optional; 23 tables; relations | §9, §10 |

**Removed from this file as obsolete V1 content:** case location/billing provider requirement, case discipline, `case_diagnosis`, fee-schedule allowed amount, stored line balances, emergency contact, "Manual Submission" hold, internal question IDs Q01–Q57, assumption A03 (V1 file baseline).

---

## 24. Change Log

### 2026-09-15
- Full analysis of PRD V1 (2.0 Draft content). Created this file (13 modules, 56 features, 39 rules, 22 entities).
- Built the client-facing clickable prototype and `docs/PROTOTYPE_COVERAGE.md` (123 automated checks). Recorded four prototype-only ADRs.

### 2026-09-16 (morning)
- Requirements gap audit → `docs/PRD_CLARIFICATION_QUESTIONS.md` (74 questions, 12 contradictions, 14 assumptions; all quotes verified).
- Built `docs/BILLING_SYSTEM_GUIDE.html` (visual learning guide; 126 terms, 10 workflows).

### 2026-09-16 (PRD V2 migration)
- `docs/Billing System PRD v2.docx` received and adopted as primary source. Compared line by line with V1 → `docs/PRD_V1_TO_V2_CHANGELOG.md` (CH-01…CH-17; all page references verified).
- Rewrote this file against V2: 24-section structure; 23 entities; BR40–BR48 added; F57–F60 added; F14–F23, F29, F34, F46 modified; KI-07 added; obsolete V1 content removed; open-question IDs unified with the client register; A02 redefined, A03 retired, A09–A10 added.
- Re-audited the clarification register: 82 open questions, 14 contradictions, 18 assumptions; Q-023 and Q-039 retired; 336 excerpt fragments verified against V2 pages.
- Migrated the visual guide, the prototype and `docs/PROTOTYPE_COVERAGE.md` to V2 (see those files).
- No client answers received; no production decisions made.

### 2026-09-17 (Fresh System environment)
- Prototype now opens on an environment chooser: **Demo Data** (unchanged) or **Fresh System** (empty V2 installation). Added Getting started checklist (13 required / 5 optional steps, labelled a suggested exploration order), dependency explanations at 12 entry points, what/why/next empty states, dashboard Day 1 card, environment indicator, switch and reset with confirmation, full data isolation.
- V2 check of what exists on day one: only the two seeded roles (§10.2 p14); primary location created with the practice (§1.2); Default case with each patient (§10.4). Not stated → register Q-085, Q-086 and assumptions A-019, A-020; prototype assumptions A-P47 (standard code lists), A-P48 (installation System Admin), A-P49 (current month opened for a new practice).
- QA: Fresh walkthrough 57 checks (empty system → paid claim, month close, EMR link and push, switch, isolation, reset), 51-route crawl, existing Demo suites 51 + 73 + 48 — all passing, zero console errors. Register re-verified (346 excerpt fragments, 0 problems).
- `docs/PROTOTYPE_COVERAGE.md` §8 Prototype environments and §9 Fresh System workflows; guide Chapter 12 "Starting from zero" (dependency diagram, Demo vs Fresh); later chapters renumbered 13–15.

### 2026-09-17 (Prototype Guide — product and explanation separated) · *superseded the same day, see below*
- Audited the whole prototype for analysis content in the product UI: 138 PRD citations, open-question / contradiction / assumption IDs and wording, "not yet specified" notices, sand "Simulate …" buttons, eligibility / claim-status placeholder buttons, dashboard Eligibility / Referral placeholders, the Fresh "Day 1" card, the Getting started screen, the demo-guide button, the environment indicator and menu items, prototype wording on sign-in, toasts and audit entries. All removed from the application and moved into the Prototype Guide; legitimate product help kept.
- Built the Prototype Guide: launcher and docked panel with its own visual identity; context per screen (54 contexts) with explanation, why, next step, relationships, terms, assumptions, client questions, prototype notes, PRD references; Follow along (Demo 14 steps, Fresh 13 + 5); Simulate (5 external systems); Library; settings for Guide mode and environment; Guide off control; Presentation mode with keyboard shortcuts; CMS-1500 source overlay.
- Code split: application (`js/*.js`, `js/screens/`) vs prototype layer (`js/prototype/`: environment, simulators, generated guide reference, guide content, walkthroughs, guide, boot). `simulator.js`, `demo.js` and `environment.js` retired from the application folder.
- QA: new Guide suite 54 checks (Presentation mode scan of 57 routes and 162 dialogs/menus finds no analysis or prototype text; Guide off Fresh scan; Guide on context, navigation, overlay, library; Follow along Demo and Fresh; environment switch; phone). Application suites 51 + 73 + 48 and Fresh 55 pass in Presentation mode; context sweep of all routes in both environments without errors.
- `docs/PROTOTYPE_COVERAGE.md` §10 added and matrix wording updated; `prototype/README.md` rewritten; guide Chapter 12 wording updated.

### 2026-09-17 (Review Notes — the Guide replaced by a minimal annotation layer)
- The Prototype Guide built earlier the same day was removed at the user's request: no guide panel, walkthroughs, library, categories, modes or onboarding. Deleted `guide.js`, `guide-content.js`, `guide-reference.js`, `walkthroughs.js` and the reference generator.
- Replaced by **Review Notes** (`js/prototype/review-notes.js`, ~56 notes): one `Review notes · n` control, numbered markers positioned over the annotated element in their own overlay, a small popover with a list and a one-note detail (type, two sentences, register ID linking to `docs/PRD_CLARIFICATION_QUESTIONS.md`, PRD section and page). Three types only: Assumption, Client question, Note. No emoji, no cards, no second navigation.
- The popover footer (and Alt + Shift + S) holds the simulators and the environment actions; Alt + Shift + N or "Hide notes" switches the layer off, and the start screen has the same checkbox.
- The application layer was unchanged by this refactor: it already contained product content only.
- QA: new Review Notes suite, 33 checks (notes-off scan of 57 routes and 162 dialogs/menus, contextual counts, markers, detail, dialog-level marker, prototype controls, toggles, content sanity, phone). Application suites 51 + 73 + 48 and Fresh 55 pass with notes off; Fresh route crawl clean.
- `docs/PROTOTYPE_COVERAGE.md` §10 rewritten; `prototype/README.md` rewritten; guide chapter 12 wording updated.

### 2026-09-23 (meeting notes reviewed and partly built)
- 16 comments from a client meeting were validated against PRD V2 and the prototype before any code changed. **Built 8**, **held 8** (plus 2 sub-items) pending answers; nothing was implemented merely because a note existed.
- Built: **Admin → Organizations** (create/rename/deactivate, practices ticked in; `company` becomes a collection, `S.companyOf`); **Admin → Payer portals** (same insurance columns, one place to edit them); **two default modifiers** per procedure code; **taxonomy removed** from referring physicians (not a V2 column); **coding rules can target an insurance class** (precedence payer → class → default); **guarantor address** (a V2 field the prototype was missing); **chart tab Coverage → Insurance**; **injury date and accident state wait for Related cause**.
- Held, with the prototype unchanged and a review note on the screen: provider hold scoping (Q-087), payer enrollment → "Add rule" (Q-088, would disable the credentialing check), "Audit required" (Q-089), scheduling options (Q-090), removing Billing preferences (Q-091, a V2 column), removing "Other" from Related cause (Q-092, Boxes 10a–10c), renaming Ready to submit (Q-093), original claim number at release (Q-094), bucket release by mail/fax/portal (Q-095), removing the referring-physician code (Q-096).
- The meeting **partly answered Q-032**: a System Admin creates organizations and assigns practices; what the grouping changes is still open.
- New prototype assumptions A-P50…A-P53; new register assumption A-021. Register: 95 open questions (Q-087 – Q-097 new), 366 excerpt fragments verified.
- Provenance is explicit in the docs: *Confirmed by V2*, *Confirmed by meeting*, *Assumption*, *Needs clarification*.

### 2026-09-23 (client answers — three held items built)
- The client answered three of the held meeting items. All three were built, and each goes against PRD V2, so the divergence is recorded in `docs/PROTOTYPE_COVERAGE.md` rather than as a review note in the product (the client asked for no trace in the UI).
- **Q-091 — Billing preferences removed.** The section is gone from the patient form and the chart; no patient record carries a statement preference. Internal notes stay. V2's `no_statements` (§10.4 p18) is not implemented; Q-047 (are statements in scope at all) stays open.
- **Q-092 — "Other" removed from Related cause.** The field offers employment and auto only and may be left empty. An empty cause prints NO in Boxes 10a, 10b and 10c, keeps the injury date optional unless the payer's class requires it (Box 14), and closes the accident state. Seeded cases that were "Other" are now empty. (A-P54.)
- **Q-096 — Referring-physician code removed.** Neither code nor taxonomy is captured; the Code column is gone from the directory. A physician is identified by name and NPI; V2 keys the table by `code` (UQ per practice), so matching imported records is left to the build. (A-P55.)
- Meeting-note tally is now **11 built, 7 waiting**: provider hold scoping (Q-087), payer enrollment → "Add rule" (Q-088), "Audit required" (Q-089), scheduling options (Q-090), renaming Ready to submit (Q-093), original claim number at release (Q-094), bucket release by mail/fax/portal (Q-095).
- Register: **92 open questions** (Q-091, Q-092 and Q-096 answered by the client and kept in place for the record); coverage status counts Implemented 34 / Partially 16 / Needs Clarification 38.
- QA: 51 + 73 + 48 + 55 + 33 + 46 = **306 checks, 0 failures, 0 console errors**. The meeting suite now asserts the three changes are built (options, gating, Boxes 10a–10c, no statement preference, no code on any record) and that the remaining seven are still untouched.

### 2026-09-23 (client answers — provider hold, payer audit, schedule list)
- **Q-087 — the provider hold is a window.** `claimHoldFrom` / `claimHoldUntil`, a reason, and tick-lists of the locations and insurances it covers (none ticked = all). It stops **both sides**: a visit whose date of service falls in the window waits in Delayed, and an unsent claim stops in the new **Provider hold** scrubbing check (`HOLDS.hold`, second in `HOLD_ORDER`). Past the end date both resume by themselves; clearing the end date lifts the hold. (A-P56.)
- `cascade()` now also re-reads visits sitting in **Charge Review**, so a hold entered today stops work that was already waiting to be billed — previously only Delayed/Pended/Exception visits were re-evaluated. `cascadeSummary` reports "n visits stopped before billing".
- **Q-089 — Audit required.** A checkbox on the insurance. The payer's claims fail the new `audit` check after scrubbing and sit in the **Audit hold**; "Record audit" asks which documents were attached (plan of care, progress note, daily notes, referral, authorisation letter, itemised statement) plus an optional note, then re-scrubs and submits. `claim.audit = { by, at, docs, note }` stays on the claim and is shown on it. (A-P57.)
- **Q-090 — the schedule dropdown is fed by the practice.** `DB.settings.scheduleOptions` holds the list; Admin → Submission & automation → "Manage the list" adds (every N hours / every day at a time / weekdays at a time) and removes options. The option in use cannot be removed; duplicates are refused. `Ch.scheduleLabel()` reads the list. (A-P58.)
- Meeting-note tally is now **14 built, 4 waiting**: payer enrollment → "Add rule" (Q-088), renaming Ready to submit (Q-093), original claim number at release (Q-094), bucket release by mail/fax/portal (Q-095).
- Register: **89 open questions** (Q-087, Q-089 – Q-092 and Q-096 answered); coverage status counts Implemented 35 / Partially 16 / Needs Clarification 37; 366 excerpt fragments re-verified.
- QA: 51 + 73 + 48 + 55 + 33 + 43 + **42 (new round-2 suite)** = **345 checks, 0 failures, 0 console errors**.

### 2026-09-24 (a searchable multi-select)
- New UI primitive `UI.multipick({ attr, options, chosen, placeholder, search, empty, disabled })` in `ui.js`: chosen rows show as removable chips in the box, the panel holds a search field and tick rows. Each checkbox still carries the caller's data attribute, so a screen reads the chosen ids exactly as it read a plain checkbox list — `ACT['org.save']` was not touched.
- The panel is `position: fixed` and placed on open (`placePick`), so the dialog's scroll area cannot clip it; it follows the box on scroll and resize, flips above when there is no room below, and closes on Escape, on an outside click and whenever a layer closes (`UI.closePick`).
- Used by Admin → Organizations for "Practices in this organization" (client request, 2026-09-24). The provider-hold scope lists still use plain tick lists.
- QA: the round-2 suite gained 11 checks for the picker (chips, filtering, no-match, untick, chip removal, Escape, what is saved, nothing left behind); phone width checked.

### 2026-09-25 (real frontend codebase started — foundation only)
- **`frontend/` is the production frontend**; `prototype/` stays as the client-validated behaviour reference. Nothing was implemented as a feature: this was architecture, standards and tooling.
- Stack matches the sibling EMR frontend (`d:\emr`) — React 19, TypeScript strict (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vite, TanStack Router (file-based, auto code splitting), TanStack Query, Zustand, Zod, Tailwind v4 with the EMR's design tokens — plus the two things that app lacks: **Vitest + React Testing Library from day one** and **ESLint carrying the architecture rules**.
- Architecture: feature-oriented, `routes → features → shared`, enforced by lint (shared may not import features; a feature reaches another only through its `index.ts`; relative imports inside a feature). Server state belongs to TanStack Query and never to Zustand or `useState`; URL holds filters, paging and selection.
- Boundaries built: one `fetch` (`lib/api/http-client.ts`) with timeout, abort signal, Zod response validation and a normalized `ApiError` taxonomy; Zod-validated environment; query-client defaults (30 s stale, no mutation retry, no refetch-on-focus).
- Security position recorded in `frontend/docs/SECURITY.md`: the frontend is **not** a security boundary; lint blocks `fetch` outside the API layer, browser storage of PHI, and `dangerouslySetInnerHTML`; the list of controls the backend and infrastructure must own is written down.
- No backend exists, so auth, permissions, forms, tables and every feature are **deliberately not built**; the mock-first data layer sits behind the feature API boundary (ADR 0006) and open decisions are listed in `frontend/docs/FRONTEND_ARCHITECTURE.md`.
- Docs: `frontend/CLAUDE.md` (how to work here, what to read for which task), `frontend/docs/{FRONTEND_ARCHITECTURE, FRONTEND_ENGINEERING_STANDARDS, SECURITY, TESTING_STRATEGY, PERFORMANCE}.md`, eight ADRs in `frontend/docs/decisions/`, and a CI workflow running typecheck + lint + test + build on `frontend/**`.
- Verified: `npm run verify` passes (11 tests). Baseline bundle 103 kB gzip entry + 21 kB route chunk — the number the performance budgets are measured against.

### 2026-09-25 (core UI system built — still no business feature)
- **Design tokens now come from the reviewed prototype**, not from the EMR app: Archivo (self-hosted, 4 weights), the white-canvas/hairline "instrument" direction, the ink ladder n50–n800, one brand blue for anything pressable, the status family (critical/warning/sand-attention/success/info), 13–24px type scale, 4/6/8px radii, 38px control height, 72/216px rail. They live in `frontend/src/styles/index.css` as Tailwind v4 `@theme` tokens — a look change is a token change.
- **UI kit built** (`frontend/src/components/ui`, inventory in `frontend/docs/UI_KIT.md`): Button, Field/FormGrid/FormSection, Input/SearchInput/Textarea, Select, SearchSelect + MultiSelect, Checkbox/RadioGroup, DateInput/DateRangeInput, Form/FormField/applyServerErrors, DataTable, Pagination, Badge/StatusDot/Tag, EmptyState/ErrorState/Skeleton, Notice, Toaster, Dialog/ConfirmDialog, Drawer, Menu, TabNav, Card/Section, KeyValue, Spinner.
- **Shell**: `AppShell` (collapsible brand rail + content + one toast region) and `navigation.tsx`, which lists only routes that exist. Page patterns (`PageContainer`, `PageHeader`, `FilterBar`) are building blocks — there is deliberately no `ListPage`/`DetailPage` component, since the four screen shapes are compositions, documented in the kit.
- **Deliberate technology choices:** Radix only for floating surfaces (dialog, dropdown, popover); select/checkbox/radio/date stay native for keyboard, mobile and screen-reader behaviour. Tabs are links (each tab is a URL), not ARIA tabs. React Hook Form + Zod for forms, with server field errors mapped back onto fields.
- **No business logic in the kit:** a Badge takes a tone, never a claim status; `DataTable` reports sort/selection and never sorts data itself (the server does that, docs/PERFORMANCE.md §5).
- **Development showcase** at `/dev/ui` (`frontend/src/dev/ShowcasePage.tsx`) shows every primitive with its states. Its import sits behind `import.meta.env.DEV`, so a production build drops the branch and never emits the chunk.
- QA: `npm run verify` green — 58 tests across 13 files (buttons, field wiring/a11y, choice controls, combobox keyboard + multi-select, table states/sort/selection, dialog focus trap and restore, form validation and server errors, toasts, pagination, shell and routes). Bundle: **116 kB gzip entry**, 7 kB CSS, 58 kB fonts.
- Not built, deliberately: any feature module, authentication, permissions, mock data layer, in-page tab panels, virtualization.

### 2026-09-25 (accessibility findings in the approved design — fixed)
- **Contrast.** `n400 #8891a0` measures 3.18:1 on white, under WCAG AA's 4.5:1 for 13–15px text, and the prototype used it for every field label, table header and sub-line. Text roles moved to `n500 #6b7484` (4.71:1, verified in a real browser); `n400` is now icons and dividers only. The palette itself is unchanged.
- **Clickable rows.** The prototype's rows respond only to a mouse. `DataTable` lost `onRowClick` and gained `rowLink` / `rowAction`, which turn the primary cell into one real link or button covering the row — mouse-clickable anywhere, tabbable for everyone else. A cell with its own controls sets `interactive: true`.
- **Empty values.** `KeyValue` renders the dash as decoration and says "None" to a screen reader.
- **Combobox.** The trigger became a `div role="combobox"` (with its own Enter/Space/ArrowDown handling), so the clear control and each chip's remove control are real buttons: keyboard-reachable, and no button nested inside a button.
- **Collapsed rail labels** use the prototype's own CSS approach (`.nav-tip`), after a Radix tooltip proved to cost ~18 kB gzip in the entry chunk for a hint. The nav list stops being a scroll container when collapsed, because a scroll container clips those labels.
- Decisions recorded in `frontend/docs/UI_KIT.md` § Deliberately absent: no `Switch`, no general `Tooltip`, no ARIA `Tabs`, no virtualization — each with the condition that would trigger it.
- QA: 62 tests (new: keyboard-reachable clear control, row opened by a named control, "None" for empty values). Entry bundle unchanged at 116 kB gzip.

### 2026-09-25 (UI refinements requested after review)
- **Custom dropdowns.** `Select` is no longer a native `<select>`: it is a styled listbox sharing one engine (`Combobox.tsx`) with `SearchSelect` and `MultiSelect`, so all three behave identically. The keyboard behaviour a native control gives free is written there and tested — Enter/Space/ArrowDown open, arrows and Home/End move, type-ahead jumps, Enter picks, Escape closes, and the panel opens on the current selection. Checkbox and radio stay native elements.
- **Custom date picker.** `DateInput` is a typed MM/DD/YYYY box plus our own calendar (Popover + a `role="grid"` month): arrow keys by day, PageUp/PageDown by month (Shift for a year), Home/End across a week, Enter to pick, plus Today and Clear. The value stays ISO `YYYY-MM-DD`; ISO parsing is local-time by hand, because `new Date('2026-09-30')` is UTC midnight — the day before, west of Greenwich. No new dependency.
- A control that is not a native form element cannot be named by `<label for>`, so `Field` now publishes a `labelId` and those controls use `aria-labelledby`.
- **Rail**: the prototype's logo is the sidebar mark and the favicon, and the collapse control is the prototype's circular handle on the rail's edge, vertically centred.
- **Pointer restored** on everything pressable (Tailwind's reset gives buttons `cursor: default`).
- QA: 77 tests. New suites cover the calendar (typed entry, ISO/local parsing, keyboard navigation, min/max, Today/Clear) and the styled select (naming, keyboard, type-ahead, opening on the selection, disabled options). Entry bundle 116 kB gzip — unchanged, since the calendar added no dependency.
- **`cn` had to be taught the type scale.** tailwind-merge resolves `text-*` by shape: a known t-shirt size is a font size, anything else is a colour. Our scale is named, so `cn('text-meta', 'text-ink')` was dropping the *size*, and the rail's `text-white/85` was dropped by `text-lede` — which is why the product word rendered black. `lib/utils/cn.ts` now extends tailwind-merge with the seven size names, with a test. Any component that merges a caller's className was exposed to this.
- Follow-ups the same day: the rail lockup reads **EMR Billing** (mark plus the product word, start-aligned in both rail states, so logo, icons and labels share one left edge), and the calendar caption is a **button that jumps to a month, then to a year** — twelve months in a grid, twelve years a page, so a date years away is three clicks instead of dozens of month steps. Escape inside a chooser returns to the calendar instead of closing the picker; months and years that no allowed day could satisfy are disabled. 82 tests.

### 2026-09-28 (first feature: the sign-in page)
- **Built at `/login`** (`frontend/src/features/auth`): the prototype's composition — photograph with the product line on the left (≥ 1024px), logo, "Sign in to Billing", form, 50px primary button — with a **username + password** form in place of the prototype's demo account picker.
- **Why username:** PRD V2 §10.2 gives `app_user` a `username` column for "a person or system account that logs in", and the register's forced assumption for the still-open **Q-025** is standard username/password sign-in. If the client chooses SSO, this form is replaced, not extended.
- **No backend, no invented contract.** `features/auth/api/sign-in.ts` is the single integration point; until a contract exists it rejects as `unavailable` (a new `ApiError` kind, also used for 503 and for "no server configured"), which the form shows as "This service is not available right now" on submit. No banner warns about it in advance (removed at the client's request). There is deliberately no mock that succeeds. No route guard and no session store yet — the guard's place is `routes/_app.tsx`.
- **Security choices:** one message for a wrong username *or* password (no account enumeration); the server's own wording never reaches the page; the password is cleared after a failed attempt; sign-in does **not** go through `useMutation`, because TanStack Query would keep the password in its cache and devtools; the whole query cache is cleared on success; `?redirect=` is limited to paths inside the app (`safeRedirect`, open-redirect guard).
- **Production fixes over the prototype:** form vertically centred with a scroll fallback (the prototype's box was top-aligned for a long account list); form before art in the document so a screen reader meets the heading and fields first; the art's line is a paragraph, not an `h2` above the `h1`; `min-h-dvh`; phones never download the 200 kB photograph; page title set; show/hide password added (a toggle with `aria-pressed`).
- **Routing:** the root became bare; signed-in screens moved under a pathless `_app` layout that renders the rail; `/login` sits outside it. Configuration is now validated at boot (`main.tsx`).
- **Two more `cn` traps fixed:** tailwind-merge did not know our spacing tokens either, so `cn('h-control', 'h-[50px]')` kept both and the button stayed 38px. `cn` now knows the spacing and type-scale names; tests pin both.
- **Bundle:** entry 136 kB gzip (was 116). Zod (~20 kB) joined the entry because route search validation and boot-time config validation both need it — the expected steady state. The sign-in page itself is a 17 kB lazy chunk.
- QA: 113 tests. Verified in a browser at 1920, 1440, 1280, 1024, 820, 375, 320 and 200% zoom: no horizontal overflow, 50px button, photograph fetched only at ≥ 1024px.

### 2026-09-28 (Admin → Organizations — first mock-backed feature)
- **Built at `/admin/organizations`** (`frontend/src/features/admin-organizations`); `/admin` opens it. The rail gains **Admin**; the Admin area has the prototype's section list (a 248px column, pills below 1024px) holding only the sections that exist. List sorted by name with status and a count; create/edit dialog with name + Active, as in the prototype.
- **Scope held:** the prototype's **Practices** and **Count** columns and the dialog's practice picker are **not built** — they need Practices & Locations (the next task) and an API for the link. V2 §10.2 gives `company` only a unique name and `is_active`; nothing else was added (no delete, no details page, no search — none are in the prototype).
- **No backend, no invented contract.** `api/organizations-api.ts` is the integration point; in the dev server and tests it answers from an in-memory mock (the prototype's fictional "Harborline Rehab Group"; duplicate names rejected as a field error), in any other build it rejects as `unavailable`. Not gated to System Admin yet: there is no permission model; the server must enforce it anyway.
- **Mock switch changed to a build-time constant** (`__MOCK_DATA__`, `vite.config.ts`): the earlier "chosen by `env.dataSource`" idea could not keep mocks out of the bundle — a shared helper variable left the mock file in `dist/` (unreachable, but shipped). Tested inside each api file, the production build now emits no mock at all. ADR 0006 and the architecture doc updated.
- **Shared kit fixes found here:** a loading table now says "Loading…" to screen readers (the skeleton was silent); a server field error focuses its field; `PageHeader` wraps its button below the title on narrow screens instead of squeezing the description to one word per line.
- **Open:** what an inactive organization does — added to Q-032 (no question covered it). The flag is stored and shown; it has no other effect.
- QA: 127 tests. Verified in a browser at 1920–320 and 200% zoom with a 100-character name: no overflow, real Enter-to-submit, dialog as a bottom sheet on phones, focus back on the row after closing.

### 2026-09-28 (Admin → Practices & locations — first backend payloads)
- **Backend payloads received** for organization (`name`, `is_active`), practice (`organization_id`, `code`, `name`, `dba_name`, `npi`, `tax_id`, `taxonomy_code`, `address{line1,line2,city,state,zip}`, `is_active`, `locations[]`) and location (`practice_id`, `code`, `name`, `npi`, `address`, `place_of_service`, `is_active`). They define the **fields**, not business rules; endpoints and response bodies are still unknown. Ids are numbers.
- **Built at `/admin/practices`** (`frontend/src/features/admin-practices`), the prototype's layout: practices table → selected practice (organization card, billing constants, locations table). Selection lives in the URL (`?practice=<id>`). New practice = practice + **first location** in one request (`locations[]`), because PRD V2 §1.2 / BR01 requires one; more are added from the practice. Organization is an optional select of active organizations. Location's practice is the selected one — no move between practices (not defined anywhere).
- **Left out because the payloads lack them:** the prototype's legal name, Tax ID type, primary-location flag and EMR-integration column. Noted under Q-022. Place of service uses the prototype's five-code list, defaulting to 11 (PRD §10.2); the allowed set is Q-079. Validation is only the prototype's formats (NPI 10 digits, ZIP 5, state 2 letters, taxonomy, EIN/SSN); no uniqueness in the browser — the mock enforces the one V2 rule (location code unique within a practice).
- **Data layer pattern set:** snake_case wire ↔ camelCase screens, mapped in each feature's api layer; `api/payloads.ts` is tested against the example payloads verbatim; the dev mock plays the server (receives the real payload, answers in wire format). Organizations moved to the same pattern (numeric ids, `is_active`); its screen did not change.
- **Shared kit fixes found in the browser:** select lists, date pickers and menus opened *behind* dialogs (z-index 50 vs 60) — now 70, order recorded in UI_KIT.md; an `sr-only` table header escaped the table's scroll box and widened the page at 640–700px — the scroll box is now positioned.
- QA: 152 tests. Browser-checked 1920–320 and 200% zoom with long names: no page overflow (the practices table scrolls inside itself between 640 and ~760px), keyboard and mouse selection in dialogs, Enter submits, server field error focuses its field.

### 2026-09-28 (UI convention: `is_active` is a Switch)
- **Decided by the user, applies to every current and future entity:** a boolean active flag is edited with a **Switch** labelled "Active" (on = `true` = Active), never a checkbox. It sets the boolean only — it implies no business behaviour (no cascade, no billing stop, no access change). Lists show the state as the Active/Inactive status dot; a list changes status in place only where the prototype does. No extra statuses unless the requirements define them. Recorded in `frontend/docs/UI_KIT.md` § Conventions.
- **Built:** one shared `Switch` in the UI kit (`button role=switch`, Space/Enter, clickable label, on shown by colour + position + check mark), replacing the Active checkbox in the Organization, Practice and Location dialogs. The prototype's **Deactivate / Reactivate** row action on locations is now built too, behind a confirmation, changing `is_active` only — without the prototype's "primary / last active location" guard (no primary flag in the payload) or its claim about what an inactive location can no longer do (Q-068). 159 tests.

### 2026-09-28 (UI conventions: field notes are tooltips; page descriptions say what the user can do)
- **Decided by the user, app-wide:** optional context about a field goes behind a small info icon beside its label (hover, focus or tap), never as loose text under the input; errors, required marks and essential instructions stay visible. Page descriptions are one short, action-first sentence ("Create and manage…") describing only what the page really offers — no data-model or PRD wording. Both recorded in `frontend/docs/UI_KIT.md` § Conventions.
- **Built:** one shared `InfoTip` (UI kit), exposed as `info` on `Field` / `FormField`; on the existing Radix popover, no new dependency; portalled, flips to stay on screen, sits above dialogs (stacking 80). Converted: Tax ID's format note and the Organization field's note. Added info only where the meaning is confirmed (location code unique per practice — V2 §10.2; default place of service feeds charge lines — BR47; taxonomy format; group NPI on claims; DBA meaning). The Tax ID format now also appears in its error message.
- **Copy rewritten:** Organizations, Practices & locations and Home page descriptions; their dialogs' descriptions and empty states; the organization card. No behaviour, validation rule, payload or API changed. 166 tests.
- Follow-up the same day: the info tooltip now wears the approved design's only tooltip style (the collapsed rail's label — brand-hover fill, white 14px medium, square pointer, fade).

### 2026-09-28 (authentication flows — payloads received)
- **Backend payloads received** for sign in `{ email, password }`, change password `{ current_password, new_password, new_password_confirmation }`, and forgot password in three calls — send code `{ email }`, verify `{ email, otp }`, reset `{ email, otp, password, password_confirmation }`. Q-025 partly answered: email + password held by this system, code-by-email reset. **Sign-in now uses the email** (it used the username).
- **Built** (`frontend/src/features/auth`): sign-in on email, with a "Forgot your password?" link; `/forgot-password` — one screen, three steps plus a done step, on the sign-in page's frame (extracted as `AuthLayout`), focus moved to each step's heading, "Send a new code", "Use a different email", "Start over"; `/account/password` inside the app, reached from a key icon pinned to the bottom of the rail. Not in the prototype — designed in the product's direction by request.
- **Not known, so not built or used:** endpoint paths, response bodies, how the session is carried, whether verifying returns a token or resetting signs in, code length/expiry/resend limits, password rules, the error body shape. Every auth call resolves with nothing; the live build answers `unavailable`; a dev-only mock accepts the payloads (it refuses password `incorrect`, current password `incorrect`, code `000000` so failures can be demonstrated). No route guard or session store yet.
- **Choices:** payloads pinned by tests against the given field names; backend field errors renamed to the form's fields so they land on the right input; passwords and codes never pass through `useMutation`, a URL, a log or storage; wording never confirms that an account exists; the code is one text field (`autocomplete=one-time-code`), since its format is not specified. The `_confirmation` naming suggests a Laravel backend, whose error body (`{ message, errors }`) the http client does not parse yet — to confirm before going live; meanwhile an unparsed validation error now reads "Some fields need attention." instead of "Request failed (422)."
- QA: 190 tests. Browser-checked at 1440 and 375.
- Follow-ups the same day: the forgot-password steps' secondary actions were regrouped (the email as a row with **Change**, "Didn't get a code? Send a new code" under the button, one centred "Back to sign in"), all small actions share one text style, and hover no longer underlines (the user's preference).

### 2026-09-28 (Admin → Referring physicians)
- **Payload received:** `{ practice_id, code, name, type, npi }`. **Code is kept** although the client's Q-096 answer removed it — the newer backend payload has it; the conflict is recorded under Q-096. Taxonomy, phone, fax and the prototype's free-text practice name are **not** built (not in the payload).
- **Built at `/admin/referring-physicians`** (`frontend/src/features/admin-referring-physicians`), under a new "Setup" group in the Admin list: the prototype's list (physician, type tag "DN · Referring" / "DQ · Supervising", NPI with an **Invalid NPI** mark for bad or dummy numbers) plus code and practice columns, sorted by name; a practice filter in the URL (`?practice=`) stands in for the prototype's practice switcher. Add / edit dialog: Practice, Name, Code, Type (DN/DQ — defined by PRD V2, default DN as in the prototype), NPI; info tips on Code (unique per practice), Type (Box 17 qualifier) and NPI (Box 17b). No delete (the prototype has none).
- **Practice relationship:** a shared `PracticeSelect` now lives in the Practices feature (fed by the practices list, never hard-coded ids) for every practice-scoped screen. The practice is chosen when a physician is added and shown fixed when editing — moving a physician between practices is not defined.
- **Validation:** all five fields required; NPI ten digits and not a dummy (PRD BR20, as the prototype's form refuses them); code uniqueness is the server's (the dev mock enforces it per practice). No endpoints yet — dev mock only, `unavailable` otherwise. 207 tests; browser-checked 1440–320.

### 2026-09-28 (Admin → Users)
- **Payload received:** `{ name, email, password, is_active }`. Built at `/admin/users` (`frontend/src/features/admin-users`), in the Admin list's "Organization" group as in the prototype: name (sorted), email, Active/Inactive, the row to edit, **Deactivate / Reactivate** on the row behind a confirmation (the prototype's action; it changes `is_active` only). The prototype's roles, practice/location grants, username, default practice and service-account flag are **not** built — the payload has none of them. No delete, no search (the prototype has neither).
- **Passwords:** asked for only when creating (shared `PasswordInput`, masked, `autocomplete=new-password`); the edit form has **no password field** — a stored password is never fetched, shown or pre-filled, and an admin reset is not defined. Creating a user bypasses `useMutation` so the password never sits in the query cache; the response schema has no password field, so one sent back would be dropped on parsing.
- **Assumed, to confirm with the backend:** update body = the payload without `password`; responses = payload (no password) + numeric `id`; no separate status endpoint. Unknown: roles/permissions, email uniqueness, what an inactive user can do, whether deactivation ends sessions, paging.
- **Shared along the way:** `PasswordInput` moved to the UI kit (second user); one email rule in `lib/validation/email.ts` for sign-in and Users. 221 tests; browser-checked 1440–320.

### 2026-09-28 (account menu; Change password becomes a dialog)
- **Built:** the prototype's account button at the bottom of the rail — the signed-in user's avatar (initials; the name and email beside it when the rail is open) opening a menu: who is signed in, **Change password**, **Sign out**. Change password is now a **dialog** from that menu; the `/account/password` page and its rail link were removed (their only entry point). Sign out asks first ("Sign out? You will return to the sign-in screen."), as the prototype does — the prototype's wording "Sign out" is kept, matching "Sign in".
- **Current user:** one query, `useCurrentUser`, is the only source; **assumed** to return `{ name, email }` (the user payload's own fields) — no "who am I" endpoint or response is known, so the dev mock answers with a fictional person and the live build shows a plain person icon and still offers both actions.
- **Sign out:** no endpoint or payload is known. It calls the integration point, then always clears the query cache and goes to `/login`; if the server did not confirm, the toast says only this browser was signed out. Changing a password does **not** sign out (not required anywhere).
- **Kit:** new `Avatar`; `Menu` gained a header and a side placement; `Dialog` / `ConfirmDialog` gained `returnFocusTo` so focus returns to the account button after a dialog opened from a menu item. 231 tests; browser-checked 1440 and 375.
- Follow-up the same day: **confirmation dialogs redesigned** (user feedback — they showed an empty body between two rules). `ConfirmDialog` is now its own compact alert dialog: a tone-coloured icon (Sign out, Deactivate, Reactivate each pass theirs), the question, one line of context, an outlined Cancel that takes focus first, and the action; no close button; buttons stack full width on phones. 233 tests.

### 2026-09-28 (Practices & locations — reorganized)
- User feedback, in three rounds: the screen felt unorganized. **Rejected:** a narrow practice list beside the details (hid identifiers, squeezed the details), then a full-width practices table with a highlighted row (repeated the identifiers the details show, an awkward way to pick a practice), and a grey header band.
- **Final:** a row of **practice tiles** to choose from (name, code, active-location count, Inactive when it applies — no identifiers; the chosen tile outlined in brand with a check, `aria-current`; each tile a link, so `?practice=` keeps the choice), then the chosen practice **full width**: a plain white header (name; code · DBA · status · organization link · its practice count; Edit), and **two separate cards** — Billing details (address, Tax ID, taxonomy, group NPI) and Locations (count in the title, Add location, the table) — each with its own title bar and info tip. Below 1280px the locations table drops default POS and moves the code under the name.
- Kit: `Card` can be a named region (`labelledBy`); `CardHeader` gained `id` and `info`; `DataTable` gained `hideBelow`; `Section` gained `info` and `headingLevel`. Same data and actions; no behaviour changed. 233 tests.

### 2026-09-28 (responsive pass — phone and tablet designed, not shrunk)
- **Audit** of every screen and dialog at 375, 390, 768, 1024, 1280, 1440 and in between (480, 600, 700, 900, 1150). Found: the desktop rail stayed on a phone (72 of 375px, its collapse handle over the content); the Admin pill row was cut off; header actions sat awkwardly; tables squeezed names and broke codes mid-word; row icon buttons, sort headers, text links and a select's clear button were under 32px to tap; dialog footers kept small side-by-side buttons.
- **Now:** below 768px (the prototype's breakpoint) a brand **top bar** (menu, logo, account avatar) and the rail as a **left drawer** — same navigation config, Admin sections nested under Admin, closes on navigation / close button / Escape / scrim, focus trapped and returned. Tablet keeps the collapsed rail with the Admin pills; desktop unchanged. Page headers stack with full-width actions on a phone; dialogs are bottom sheets with stacked full-width buttons; tables use **priority columns** (secondary values on the main cell's sub-line; the row opens the record) with codes and NPIs never breaking; practices use tiles. Invisible hit boxes lift small controls to a comfortable size. Phone page padding 16px.
- **Result:** no horizontal page overflow, no scrolling tables, no undersized targets, every dialog and menu inside the viewport, at all tested widths; desktop unchanged. Conventions in `frontend/docs/UI_KIT.md` § Conventions. 239 tests (6 for the phone navigation).

### 2026-09-30 (client meeting — prototype updated as the backend's behavioural reference)
- **Client decisions, built in `prototype/`** (the production frontend is unchanged): Provider Type **Rendering / Billing** replaces payer enrollment and the Credentialing check (Rendering → Provider type hold); procedure codes lose default modifiers and gain a **Modifier Override** switch (off by default, up to four optional modifiers, hint "These modifiers will override any modifiers provided from other sources."); **Setup** is a top-level module beside Admin (old `#/admin/<setup>` links redirect); the payer portal is a **link only, in the insurance form** (Payer portals view and credentials removed); the **AI section, AI coding check and AI SLA option are removed**; **coverage belongs to the patient without a rank**, and a case picks **Primary** (required in the form) and optional **Secondary** from it — no tertiary; the case is **one view** with headed sections instead of tabs.
- **Against V2:** the Credentialing check (§6.2) and per-case `case_insurance` with rank (§10.4). Q-010, Q-014, Q-088 answered; new **Q-098** (which provider the type check reads), **Q-099** (where the override applies), **Q-100** (case insurance rules), **Q-101** (authorization per case). Assumptions A-P59 – A-P63; A-P08, A-P33, A-P52 retired. Details in `docs/PROTOTYPE_COVERAGE.md` §12.
- **Follow-up for the production frontend (not done, not asked):** its Admin list still has a "Setup" group (Referring physicians) — per this decision Setup becomes its own navigation entry when the frontend reaches it.
- Verified in Chromium: 91 routes × 7 demo accounts and the Fresh System render without errors; the engine cycle (EMR scenarios → submit → primary remit → secondary claim; corrected claim; provider-type hold released by switching to Billing; override on new EMR lines); no horizontal overflow at 375 / 768.

### 2026-09-30 (Setup → Insurances and Insurance classes; Setup becomes its own module)
- **No backend payload exists** for insurances, insurance classes or release buckets. On the user's instruction the frontend follows the **updated prototype's fields**, written under the **PRD V2 §10.3 column names** — a **provisional contract**, isolated in each feature's `schemas/` and `api/`, served by dev mocks only (the live build answers `unavailable`). Four insurance fields have no V2 column and were named here: `audit_required`, `claim_format`, `max_units`, `sla_days`. Replace the lot when the real payloads arrive.
- **Built** (`frontend/src/features/admin-insurances`): Setup → Insurance classes — list (code, class, rule-default tags, insurance count, count with overrides, status), practice filter in the URL, add/edit dialog (practice, code ≤ 8 in capitals, name, four rule defaults as Switches, ICD version, Active switch, the class's insurances named). Setup → Insurances — list (payer with class · type, payer ID with the portal link, effective rules, insurance hold + bucket, audit, SLA, status), practice filter, add/edit dialog in the prototype's sections (payer, billing rules Inherit / Yes / No with a live **effective values** panel = COALESCE(insurance, class), manual release, payer audit, submission & SLA, **payer portal link only**, Active). No delete (the prototype has none); status changes in the dialog only.
- **Relationships, as the prototype has them:** an insurance belongs to exactly one class of its practice (required; only active classes offered plus the current one); while its insurance hold is on it names one release bucket of its practice (required then; inactive buckets not offered to a new assignment). Nothing is assigned automatically. A read-only release-bucket list (`features/admin-release-buckets`) feeds the picker; the Release buckets screen is not built.
- **Setup moved out of Admin** (client decision 2026-09-30): a top-level **Setup** nav entry (`/setup/*`) with Insurance classes, Insurances, Referring physicians; `/admin/referring-physicians` redirects. `AdminLayout` became the shared `SectionLayout`.
- **Shared additions:** `Switch` takes `info` (field-note icon beside its label); `renameFieldErrors` in `lib/api/api-error.ts` puts a server's snake_case field errors on the form's fields (auth now uses it too).
- **To confirm with the backend:** every endpoint, response shape and field name above; whether empty optional text is `null` or `""`; the address shape; whether uniqueness of class and insurance codes per practice is enforced (the mocks assume V2's rule); what a class deactivation does to its insurances.
- 275 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440 — no page overflow, no sideways-scrolling table, dialogs fit, targets ≥ 32px.

### 2026-09-30 (Setup → Release buckets)
- **Payload received** (create and update): `{ practice_id, name, description }`. Built at `/setup/release-buckets` (`frontend/src/features/admin-release-buckets`), in Setup beside Insurances as in the prototype's order (the request said Admin → Release Buckets; Setup is where the client moved these screens).
- **Built:** list — bucket name with its description under it, practice, sorted by name, practice filter in the URL; **New release bucket** / edit dialog — Practice (chosen by the user, never pre-selected, fixed once saved), Name (required; placeholder "Enter release bucket name"), Description (optional textarea; "Describe when this release bucket is used"). Loading, empty, error states; a server field error lands on its field. **Not built** (not in the payload / not defined): the prototype's Active flag and status column, "held insurances", "claims waiting", delete.
- **Changed with it:** the provisional `is_active` on buckets was removed, so the Insurance form now offers every bucket of the insurance's practice (no longer only active ones).
- **Assumed, to confirm with the backend:** endpoints and methods; response = payload + numeric `id`; an empty description is sent as `""` (a null one is read as empty); names unique within a practice (V2 — the dev mock enforces it, the form does not); whether a bucket may change practice; whether buckets get a status or delete later.
- Shared: the toast's Dismiss button got the kit's invisible 40px hit area. 291 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440 with a real create through the dialog (long name and description wrap, no overflow).

### 2026-09-30 (Admin → Audit log)
- **No backend contract exists** (and Q-053 — what the trail records, who sees it, retention — is still open). Built from the prototype's Admin → Audit log at `/admin/audit` (`frontend/src/features/admin-audit-log`), in a new **Audit** group of the Admin list, as in the prototype.
- **As the prototype:** title "Audit log"; search "Search action, detail or user…" (debounced 220 ms, as the prototype); module pills in the prototype's order and labels (any number on, none = all); read-only table **When** ("Today 14:32" / "Yesterday …" / "Sep 12 …" over MM/DD/YYYY) · **User** · **Action** (detail under it) · **Module** tag; newest first; 20 a page with "Showing 1–20 of N entries" and a pager. No detail view and no actions — the prototype has none.
- **Not built:** the prototype's "Open" link to the affected record — the claim, visit, denial and exception screens do not exist yet.
- **Provisional data layer:** the screen sends `{ search, modules, page, pageSize }` to one integration point and expects `{ entries, total }`, entries `{ id, at, user_name, action, detail, module }` — placeholders, parsed in `schemas/audit-entry.ts`; the dev mock filters and pages server-side (the browser never loads the whole history); live builds answer `unavailable`. Search text stays out of the URL (it can hold a patient's name).
- **Time:** read as ISO 8601 and shown in the viewer's time zone; a value without an offset is taken as local; an unreadable one is shown as sent. To confirm with the backend: endpoint, parameters, paging model, response shape, timestamp format and zone, how the user is identified, who may read the log.
- New kit component `FilterPills` (the prototype's pill filter; six uses there). 305 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440 including search, pills and paging.

### 2026-10-01 (Setup → Providers)
- **No backend payload exists** for providers. Built from the updated prototype at `/setup/providers` (`frontend/src/features/admin-providers`) — Setup's first section, as in the prototype; `/setup` now opens it. There was no Admin → Providers screen in the frontend to migrate.
- **As the prototype:** list — Provider ID · Provider (name, credential, specialty) · NPI (marked when missing/invalid) · taxonomy · license · Claim hold (window, reason, the locations and payers it covers; highlighted while it runs) · Provider type (Rendering "Claims put on hold" / Billing "Eligible for submission") · Status; sorted by Provider ID, also by name and type; practice filter in the URL. Dialog — first/last name, credential, Provider ID, specialty (the prototype's three), **Provider type** (Rendering / Billing only), NPI (ten digits, not a placeholder), taxonomy, state license; **Claim hold** — from, until, reason, locations covered, payers covered (none = all; only the practice's own, from the real practices and insurances lists); **Active** switch. **No payer enrollment / credentialing** (removed by the client 2026-09-30) and no draft-from-EMR profiles (only an EMR import creates those).
- **Provisional contract** (`schemas/provider.ts`): `{ practice_id, code, first_name, last_name, credential, specialty, provider_type, npi, taxonomy_code, state_license, claim_hold_from, claim_hold_until, claim_hold_reason, claim_hold_location_ids, claim_hold_insurance_ids, is_active }` — PRD V2 names where V2 has the column; the hold travels with the provider, as the prototype saves it. Dev mock only; live builds answer `unavailable`. Nothing applies the type or the hold to claims — the backend's.
- **Prototype checks only:** required names, Provider ID, specialty, type, NPI, taxonomy; a hold with an end date needs a start and a reason and cannot end before it starts; without an end date the hold's other fields are cleared on save (as the prototype). No uniqueness or format rules beyond NPI.
- **Responsive:** below 1280px the hold and type ride under the provider's name; the prototype's "Taxonomy · license" column is shown under the NPI at every width (no room for both beside the hold). Shared fixes: the NPI check moved to `lib/validation/npi.ts` (second user); DateInput's calendar controls and the multi-select chips' remove buttons got the kit's invisible touch area.
- **To confirm with the backend:** every name and the shape above; whether the hold is part of the provider or its own resource; whether a provider can change practice; uniqueness of Provider ID / NPI; which provider a claim's type check reads (Q-098). 327 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Setup → Procedure codes — frontend only)
- **No backend exists and none was simulated:** no api module, endpoint, payload or TanStack Query layer. Built at `/setup/procedure-codes` (`frontend/src/features/admin-procedure-codes`), after Release buckets as in the prototype's order. The list lives in an in-tab store (`data/procedure-code-store.ts`, plain `useSyncExternalStore`); the screens use only `useProcedureCodes()`, which a backend's server-state hooks replace later. Changes are lost on reload; the screen shows no message about it (user, 2026-10-01: implementation status never appears in the UI). The prototype's sample codes load only when `__MOCK_DATA__` is true, so a production build starts empty and contains none of them.
- **As the prototype:** list — Code ("New from EMR" mark), Description, Type, Timed (8-minute rule), Modifier override (On + modifiers / Off), Default fee ($0.00 marked), Status (Inactive — not offered on new charge lines); sorted by code (also description, type, fee); 20 a page; the row opens the code. Dialog — CPT / HCPCS (five letters or digits, not already listed, fixed once saved), description, default fee per unit, procedure type (Evaluation / Therapeutic / Modality / Supply / DME), Timed and Active switches, and **Modifier override** — off by default; switched on, the warning "These modifiers will override any modifiers provided from other sources." and four optional modifier inputs; switched off, no modifiers are kept. Saving clears "New from EMR". No search, filters or delete — the prototype has none; no modifier logic of any kind.
- **Not built:** the prototype's System-Admin-only editing (no permission model yet). Responsive: below 1280px type and override ride under the code; the prototype's Timed column is shown under Type at every width (no room beside the override below 1440px).
- **The backend will need to provide:** the list of codes and how it is shared across practices; saving a new code and changes to one; how codes arriving from the EMR are marked; who may edit; what the override modifiers do on charge lines (Q-099). 341 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Setup → Fee schedules — frontend only)
- **No backend exists and none was simulated** (no api module, endpoint, payload or query layer). Built at `/setup/fee-schedules` (`frontend/src/features/admin-fee-schedules`), after Procedure codes as in the prototype's order. Rows live in an in-tab store (`data/fee-schedule-store.ts`, same pattern as procedure codes); the screens use only `useFeeSchedules()`; no implementation-status message on screen. The prototype's rows load only when `__MOCK_DATA__` is true (they point at the development insurances mock's ids), so a production build starts empty and contains none of them.
- **As the prototype:** an Insurance picker (`?insurance=<id>` in the URL; the first insurance when none is chosen) and that insurance's fee rows — Code (with description), Billed / unit, Default fee, Effective (from – to), Edit and Delete — sorted by code (also billed), 15 a page; "Add fee row" / "Edit fee row" dialog (description = the insurance): Code (only codes the insurance has no row for; fixed once saved), Billed per unit ("Put on the claim."), Effective from / to (required, end not before start; a new row runs for the current year — the prototype used its own year); Delete behind "Delete the {code} row? — The code falls back to its default fee for this payer."; and the **Price lookup** card (insurance, code, units → charge and source: the payer's row in effect today, otherwise the code's default fee — the prototype's own rule, PRD §3.4). Before there is an insurance and a procedure code: "Nothing to price yet" and what is needed, with links.
- **Relationships:** insurances from the insurances feature (its provisional contract / dev mock), codes from the procedure codes feature (in-tab). Nothing reprices visits — the prototype's "unbilled visits were repriced" is backend behaviour.
- **Shared:** `formatMoney` → `lib/utils/money.ts`, `todayIso` / `formatIsoDate` → `lib/utils/dates.ts` (second users), procedure codes and providers re-pointed.
- **The backend will need to provide:** fee rows per insurance and code with their effective dates (V2 `fee_schedule`: billed amount, effective from / to); create, update, delete; whether a code may have several rows over time (the prototype allows one per insurance); who may edit; repricing of unbilled charges when a row changes. 357 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (no implementation-status messages in the UI)
- **User rule:** messages about the backend / mock / local state ("Not saved yet", "not connected to a server", "lost when the page reloads", "mock data") never appear in the product UI — that state lives only in the code and in reports to the user. Removed: the notices on Setup → Procedure codes and Setup → Fee schedules, and the Home page's "Data source: mock — no backend is configured yet" row. Tests now assert those notices are absent. Kept: real empty, validation, error and result messages (e.g. a failed load's "Try again", the sign-out toast when the server did not confirm).

### 2026-10-01 (Admin → Roles & permissions — frontend only)
- **No backend exists and none was simulated** (no api module, endpoint, payload, permission or role id contract). Built at `/admin/roles` (`frontend/src/features/admin-roles`), in Admin's Organization group after Users, as in the prototype. Roles live in an in-tab store (`data/role-store.ts`, same pattern as procedure codes); the screens use only `useRoles()`; no implementation-status message on screen. The prototype's six roles load only when `__MOCK_DATA__` is true, so a production build starts empty (checked: none in `dist`).
- **As the prototype:** the role list (name; System role / Custom / Standard · N users), the chosen role in the URL (`?role=<id>`, Practice Admin when none or unknown); its name, description (+ "Global: sees every practice"), the "Access levels." notice and the permission table — Module, Access (Edit / View / Hidden), Delete (only under Edit), Flags (C R U D). Edit = C R U and keeps the Delete tick; View = R; Hidden = none (open contradiction C-001: PRD's CRUD flags vs chapter 1's levels). A level change applies at once with the toast "{role}: {module} set to {level} — Applies immediately to every user holding this role."; the Delete tick has none. System roles are locked with the lock note; Practice Admin shows "Limits beyond the flags". New role: name (required, unique ignoring case) and Start from ("Copy of …", non-global roles, first chosen) → a custom role, code from the name, "Custom role based on {source}.", 0 users, then opened. Delete role (not on system roles): refused with "This role is assigned to users — Remove it from every user first." while users hold it; otherwise "Delete {name}? — The role and its permissions are removed." then back to Practice Admin. No search, filter or bulk selection — the prototype has none.
- **New shared component:** `SegmentedControl` (radio inputs in a named radiogroup). Responsive: the role list sits beside the table from 1280px; below, a 2-column (phone) / 3-column (tablet) grid above it; below 768px each module row stacks into two lines with a visible "Delete" label.
- **Not built:** the prototype's gating of changes and Delete role on the signed-in user's own ADMIN permission (no permission model in the frontend yet); user counts come from the role itself, since nothing assigns roles to users here. The screen enforces nothing — the server decides on every request.
- **The backend will need to provide:** roles (id, code, name, description, global, system/seeded, user count) and their per-module C R U D flags; the module list; create (copying another role), update of a module's flags, delete (refused while assigned); who may manage roles; whether "Standard" is a real kind; Practice Admin's limits beyond the flags. 378 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Admin → EMR integration — frontend only)
- **No backend exists and none was simulated** (no api module, endpoint, payload, status value or EMR call). Built at `/admin/integration` (`frontend/src/features/admin-emr-integration`), in Admin's Organization group after Roles & permissions, as in the prototype. The locations come from the practices list (real contract); each location's integration (Unique Location ID, link, election) and the payload log live in an in-tab store (`data/integration-store.ts`); the screens use only `useEmrIntegration()`; no implementation-status message on screen. The prototype's states and log load only when `__MOCK_DATA__` is true (they point at the practices mock's location ids 1–4), so a production build starts with every location Not linked / EMR only and an empty log, and contains none of the sample (checked).
- **As the prototype:** title and description; the three steps (1 · Request, 2 · Link, 3 · Elect); Locations — Location (code), Unique Location ID, Link (Linked "Since …" / Requested "By … · date" / Not linked), Billing election (Integrated / EMR only), Last payload (when + result), and the one action the state allows: **Request integration** (dialog "Request integration — {location}": Unique Location ID required and held by no other location — "This ID is already linked to another location."; Note for the approver optional → Requested, toast "Integration requested — It waits for approval before the location is linked."), **Approve & link** (confirm "Link {location} to the EMR?" → Linked today, stays EMR-only, toast "{location} linked — Switch it to Integrated …"), **Switch to integrated / Switch to EMR-only** (confirms "Bill {location} through the platform?" / "Make {location} EMR-only?" (destructive) → toast "{location} is now {election}"); the line "A System Admin or Organization Admin approves integration requests."; Payload log — result pills with counts (Accepted, Replaced, Updated queue, Blocked; none on = all), Received, Location, Internal Record ID, Patient, Result, Detail, newest first, 10 a page, empty "No payloads — Payloads appear here when a linked location sends a finalized note."
- **Differences:** a Practice picker (`?practice=<id>`, the first practice by default) stands in for the prototype's current-practice switcher, so the practice name is not repeated beside "Locations"; the prototype pre-filled a generated Unique Location ID (its own invention) — here the field starts empty ("Enter Unique Location ID"); "No practice yet" when there is none, as the prototype's shell says.
- **Not built:** per-role action gating and "Awaiting approval" (no permission model in the frontend yet); the payload log's "Open" link to the visit (no visit screen yet). Nothing here links to, tests or receives from an EMR — the link state is a record only.
- **Shared:** `formatWhen` → `lib/utils/format-when.ts` (second user); `FilterPills` options take an optional `count`; `useCurrentUser` exported from auth (the requester's name).
- **The backend will need to provide:** each location's Unique Location ID, link status (with requester / dates / note) and billing election; request, approve, and change election, with who may do each (Q-029); uniqueness of the Unique Location ID; what happens to data already in billing when a location goes EMR-only (Q-030); the payload log (time, location, EMR record id, patient, result, detail, visit) with result filtering and paging, scoped to the user's practices. 390 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (EMR integration — lighter organization)
- **User feedback:** the Practices & locations treatment (practice tiles, a practice header, cards, a boxed steps band) was rejected as more lines and clutter, and the user had said not to copy that direction. **Lesson:** when asked for "the same goal, not necessarily the same concepts", find what suits the screen; do not reuse another screen's devices.
- **Now:** the Practice picker sits in the page header beside the title (it scopes the whole page; `?practice=<id>`); the prototype's three steps are plain text ("1 · Request" …), no box, fill or rule; then two plain sections (heading + one rule, as before) set apart by whitespace — **Locations**, with one quiet line "N of M locations linked · N integrated · N awaiting approval" under the heading and the approver line under the table, and **Payload log**, with its subtitle, pills, table and paging. Kept from the previous pass: the Internal Record ID rides under the patient (and the location below 1280px) so the detail has room. 392 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Admin → Coding rules — frontend only)
- **No backend exists and none was simulated** (no api module, endpoint, payload, rule/condition/action type list or id). Built at `/admin/coding-rules` (`frontend/src/features/admin-coding-rules`), in a new Admin group **Billing rules**, as in the prototype's side menu. Rules live in an in-tab store (`data/coding-rule-store.ts`); the screens use only `useCodingRules()`; no implementation-status message on screen. The prototype's four rules load only when `__MOCK_DATA__` is true (they point at the insurances mock's ids 1, 4, 9), so a production build starts empty and contains none of them (checked).
- **As the prototype:** title and description; a list per practice — Rule (Replace / Drop tag), Code ("97014 → G0283" / "97010 → dropped"), Applies to ("Default (all payers)" / "{class} class" / "{payer} only"), Why, Active, Edit and Delete — not paged, searched or filtered; the line "Rules run on fresh submissions, resubmissions and corrected claims, and change the billing record itself."; "New rule" / "Edit coding rule" dialog: Rule type (radio, Replace "Convert a code to an alternative code." / Drop "Remove the code from the claim."), Code (required), Replace with (required for Replace, not the same code — "Please choose a different code."), Applies to (required: "Default — all payers", "Class — {name}" for the practice's active classes, "{payer} only (overrides default)", with the precedence note), Why (optional) → toast "Rule saved — It runs on the next scrub."; a new rule is active; Delete behind "Delete this rule? — {type} {code} will no longer run during scrubbing."; with no procedure codes, "Cannot add a coding rule yet" with the link to add one; empty "No coding rules yet …"; and **Test the rules** (payer + codes → Unchanged / Replaced by … / Dropped, and which rule decided, by the prototype's precedence payer → class → default, Q-097 — a preview only).
- **Differences:** Active is the kit's Switch (the prototype used a checkbox; user rule for is_active); "Replace with" is switched off for a Drop rule (the prototype left it enabled and ignored it); the practice is chosen in the page header (`?practice=<id>`) instead of the sidebar's current practice; class-scoped rules are listed (the prototype's list filter dropped them — a prototype bug); the tester says "class rule (overrides default)" for a class rule (the prototype called it payer-specific); the tester's codes start empty (the prototype pre-filled demo codes); the tester sits beside the list only from 1600px, under it otherwise.
- **Shared:** `FormField` now passes `asFieldset` through (a radio group gets its legend); `useInsuranceClasses` and `InsuranceClass` exported from admin-insurances.
- **Not built:** per-role gating of New / Edit / Active / Delete (no permission model yet). Nothing scrubs a claim here.
- **The backend will need to provide:** rules (type, code, replacement, scope — default / class / insurance, note, active) with list / create / update / delete / activate; precedence and whether levels combine (Q-097); what rules change beyond the billing record — "payment-posting grids" (Q-013); whether conditions beyond the code exist (Q-013); who may manage rules. 412 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Coding rules: Rule type dropdown; dropdown lists scroll inside dialogs)
- **User request:** Rule type is a dropdown (Select), not radio buttons; each option keeps its description ("Convert a code to an alternative code." / "Remove the code from the claim.").
- **Bug fixed (shared, every dialog):** a dropdown list inside a Dialog could not be scrolled with a mouse wheel or touchpad. Cause: the Combobox panel is portalled out of the Dialog, and the Dialog's scroll lock blocks wheel / touch moves outside itself. Fix in `Combobox.tsx`: the panel stops its own `wheel` / `touchmove` from reaching the lock, and the list has `overscroll-contain`. Checked in Chromium (list scrollTop 0 → 200 inside a dialog; unchanged on a page); regression test in `Select.test.tsx` (fails without the fix). 413 tests; verify green.

### 2026-10-01 (Coding rules: Test the rules redesigned)
- **User request:** better UI/UX for "Test the rules". Now: a one-line purpose ("See what the active rules do to the codes on a claim for one payer."); Payer and **Codes on the claim** side by side when the card is wide (container query), codes **picked from the procedure codes list** (MultiSelect chips, searchable by code or description) instead of free text, so a typo can't read as "no rule"; a hint until codes are chosen; per code "97014 → G0283", what happened and which rule decided ("Replaced · Medicare Part B only", "· overrides the default rule" when a payer/class rule beat an active default) and the rule's Why; then **Claim after the rules** (the resulting codes, or "No codes left on the claim") and "N of M codes changed." Results follow the chips' (list) order. No added boxes or rules. Still a preview by the prototype's precedence (Q-097). 414 tests; verify green.

### 2026-10-01 (Coding rules: Test the rules in a dialog)
- **User request:** with a long list the tester was out of reach below it. Now a **"Test the rules"** button in the page header (beside Practice and "New rule"; full width on a phone) opens it as a dialog — the same content (purpose line as the dialog description, Payer + Codes on the claim, results, claim after the rules). No footer: × or Escape closes it; it starts afresh each time. The list takes the full width (the 1600px side-by-side layout is gone). 414 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Consistent row actions and fast Active / Inactive)
- **User request:** one row-action and Active pattern everywhere, taken from Coding rules. Shared as `components/ui/RowActions.tsx` (`activeColumn`, `actionsColumn`, `RowActionButton`, `statusChangeFailed`); documented in docs/UI_KIT.md "Row actions and Active".
- **Pattern:** an **Active** column with a compact switch per row (only where the model has `is_active`), and a right-aligned actions column of small icon buttons — Edit, and Delete where the feature has it. Rows are no longer one big edit button (one control per action, as in Coding rules); the decorative pencils are gone.
- **Fast Active switch added** (no confirmation, as Coding rules; silent on success, toast on failure; the feature's existing update with only `is_active` changed): Organizations (confirmed payload), Insurances, Insurance classes, Providers (provisional contracts — their update is the existing provisional one), Procedure codes (in-tab store; the "New from EMR" mark is kept; the Active column is the switch alone — the "Not offered on new charge lines" line was removed at the user's request, and `activeColumn` has no note option). **Switch replaces the Deactivate / Reactivate button, keeping the prototype's confirmation:** Locations, Users. Already: Coding rules.
- **Edit only (no `is_active`):** Referring physicians, Release buckets. **Edit + Delete restyled:** Fee schedules. **Unchanged:** Audit log and EMR payload log (read-only), EMR integration's locations (named workflow buttons — Request / Approve & link / Switch — not edit actions), Practices (tiles and a header, not a table; Active stays in its dialog), Roles (not a table; no `is_active`). Create/edit dialogs keep their Active switch.
- Providers: the name cell's minimum went 12rem → 11rem so the new columns fit at 1280px. `InsuranceClass` form values now come from `toInsuranceClassFormValues` (dialog and switch share it). 419 tests; verify green; all 11 tables browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Roles & permissions — clearer layout)
- **User request:** better UI/UX for Roles & permissions (kept light: no new boxes or rules). The role list is narrower (15rem) and **grouped by kind** under quiet eyebrow headings — System roles (lock icon), Standard roles, Custom roles — each item name + users; it **stays in view** (sticky) beside the table from 1280px. The role header is larger (name; a kind tag, users, "Global: sees every practice"; then the description), with Delete role on the right. A system role's "cannot be changed" note now sits **above** its controls. The blue "Access levels." notice became a one-line summary — "Across 11 modules: Edit n · View n · Hidden n" — with the same explanation behind an info icon. Table, toasts, dialogs and Practice Admin's limits unchanged. 419 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Bug: a second, page-level scrollbar)
- **Seen on** Admin → Roles & permissions. **Cause:** `sr-only` elements are `position: absolute`; with no positioned ancestor they were placed against the document at their spot deep in the app's scrolled `<main>` (the permission table's per-row "Flags:" labels), stretching the document — 36px at 1440, 880px on a phone — so the page scrolled as well as `<main>`. **Fix (app-wide):** both `<main>` scroll areas in `AppShell.tsx` are `relative`, the containing block for anything absolutely positioned in a page. Every page with a table now measures 0 document overflow at 1440, 1280 and 375; the sticky role list still works. The browser audits now also check vertical document overflow. 419 tests; verify green.

### 2026-10-01 (EMR steps as a stepper; Roles without "Limits beyond the flags")
- **EMR integration:** the user disliked the plain-text steps. Now a stepper — a numbered marker per step (Request, Link, Elect; the prototype's text), joined by a thin connector so they read as one path: left to right from 768px, top to bottom on a phone (the line runs down beside the text). No box or fill. Screen readers hear "Step 1: Request …".
- **Roles & permissions:** the "Limits beyond the flags" section (Practice Admin) removed at the user's request — a deliberate difference from the prototype.
- 419 tests; verify green; both screens browser-checked at 375, 390, 768, 1024, 1280, 1440 (no horizontal or vertical document overflow).

### 2026-10-01 (Practice picker placed as on the other practice-scoped screens)
- **User request:** on Coding rules and EMR integration the practice picker sits where Providers, Insurance classes, Insurances, Release buckets and Referring physicians keep it — the `FilterBar` under the page header, no visible label (named "Practice"), `w-full sm:w-64` — instead of a labelled field in the header. Unlike those lists, these two pages are one practice's: the picker is not clearable and has no "All practices"; it is hidden when there is no practice (the empty state says so) or the list failed. Coding rules' header keeps Test the rules and New rule; EMR's steps follow the filter bar. 419 tests; verify green; both browser-checked at 375, 390, 768, 1024, 1280, 1440.
- **Follow-up (user):** on EMR integration the steps come first, then the practice filter bar, then Locations and the Payload log (tighter gap so the picker sits with what it scopes).

### 2026-10-01 (Admin → Submission & automation — frontend only)
- **No backend exists and none was simulated** (no api module, endpoint, payload, schedule format or status). Built at `/admin/automation` (`frontend/src/features/admin-automation`), in Admin's Billing rules group after Coding rules, as in the prototype. Settings live in an in-tab store (`data/automation-store.ts`); the screen uses only `useAutomation()`; no implementation-status message. The prototype's settings (options Every hour / Every 4 hours / Every day at 18:00, the last in use, last run yesterday 18:00) load only when `__MOCK_DATA__` is true; a production build starts Off with no options and no run (checked).
- **As the prototype:** title "Submission & automation", "When released charges are submitted automatically."; a 720px settings page: **Scheduled submission** — "Submit released charges automatically" (Off — submit manually, then the options), "Last run {when | never}."; "The list is yours to fill: add the times this practice submits on, or remove the ones it never uses." + **Manage the list**; **Payer SLA** — "Each insurance carries its own payment SLA, set in Setup → Insurances." (link); **Save settings** → "Settings saved" ("Released charges are submitted manually." / "The next scheduled run uses this interval."). Dialog **Scheduled submission options** ("What the dropdown on this screen offers. The option in use cannot be removed."): Option, Used now ("In use"), Remove (not on the option in use; confirm "Remove this option? — “{label}” will no longer be offered."); empty "No options yet — Without one, released charges are only submitted by hand."; **Add an option**: How often (Every few hours / Every day at a time / Weekdays at a time) → Every (hours, 1–12) **or** At (time), defaults every day at 18:00 (4 hours); "Option added — “{label}” is now in the dropdown."; same name again → "Already on the list". Labels as the prototype: "Every hour", "Every 6 hours", "Every day at 18:00", "Weekdays at 07:30". Footer Close + Add option.
- **Differences:** missing hours / time are field errors (the prototype toasted "Nothing to add" with the same sentences); hours must be a whole number 1–12 ("Please enter a valid number."); the time is a native time input (no time control in the kit); production starts empty (the prototype's fresh system starts with its three options — whether the product ships defaults is the backend's call); the setting is one for the whole system as in the prototype, although its note says "this practice".
- **Not built:** read-only view for users without permission (no permission model yet). Nothing schedules or submits here; "Last run" is only shown.
- **Shared:** `RowActionButton` takes an optional `title` (tooltip) — "Remove" here.
- **The backend will need to provide:** the setting and its options (kinds, hours, time), saving them, the last run; when and in which time zone a run happens and under whose account (Q-041); whether the setting is per practice; who may change it. 429 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-01 (Submission & automation — clearer at a glance)
- **User request:** better UI/UX, in the light style (no new boxes). The setting **in effect** shows beside "Scheduled submission" (a green dot + the option, or "Off — submit manually") — the saved one, not the one being edited; **Manage the list** sits beside the dropdown it fills (under it on a phone); **Save settings** sits in the section with the setting it saves and is **disabled until something changed**; both parts are plain `Section`s (heading + one rule). Wording unchanged. Note: inside a plain grid, `Field` spans 12 form-grid columns by default — use a flex stack there. 429 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440.
- **Follow-up (user):** the "Payer SLA" section (a pointer to Setup → Insurances) removed from Submission & automation — a deliberate difference from the prototype; each insurance's SLA is still set on the insurance. The page is now the Scheduled submission section alone.
- **Follow-up (user):** the note "The list is yours to fill: add the times this practice submits on, or remove the ones it never uses." removed from Submission & automation (prototype text, deliberately left out). "Manage the list" stays beside the dropdown.

### 2026-10-01 (Patients — frontend only; scope chosen by the user)
- **Scope (user, 2026-10-01): "Patients + cases".** Built: roster, search, filters, New / Edit patient (with **guarantor address**), chart **Profile**, **Insurance** (coverage), **Case overview** (details, case insurance, ICD-10 diagnoses, authorizations, other cases), deactivate / reactivate, delete. **Left for Charges / Claims / Payments:** Ledger, Visits & claims, "New charge", "Post patient payment", the roster's Open balance column and filter, its location filter and billing-exception flag (visits), the case's visit locations. **Billing preferences not built** (removed by the client, Q-091 — absent from the prototype too).
- **No backend exists and none was simulated** (no api module, endpoint, payload or id). Routes `/patients` (`?practice=`), `/patients/$patientId` (`?case=`, one page since 2026-10-02 — see below); rail entry Patients after Home. One in-tab store, `features/patients/data/patient-records-store.ts` (`usePatientRecords()`): patients, coverage, cases (with diagnoses) and authorizations together, as deleting a patient removes the rest. The prototype's patients (a selection, a dev-only guarantor on Eleanor Fitzgerald and one inactive patient), authorizations and ICD-10 list load only when `__MOCK_DATA__` is true; production starts empty — and with **no ICD-10 list** (only a backend can supply one) (checked: no sample in `dist`). Insurances, classes, referring physicians and practices come from their features (`useReferringPhysicians` now exported).
- **As the prototype:** roster — Patient ("Last, First", Billing ID), Born, EMR ID, Cases, Primary insurance (the first open case's), Active switch (Deactivate / Reactivate asks first); search by name either order, Billing ID or EMR ID; "Filter patients" drawer (Primary insurance, Status Active/Inactive/All — Active by default; Reset; Search); 12 a page; empty "No patients match" / "No patients yet". New patient (Patient · Contact · Address · Guarantor (responsible party) · Notes · First case note) → Default case, toast, opens Insurance. Chart header (name, Active chip, Billing ID · EMR · DOB · age · phone · insurance; More: Deactivate/Reactivate, Delete). Profile (Demographics with masked SSN, Contact & address, Guarantor with address, internal notes). Insurance (coverage cards: insurance, cases using it, class · type · payer ID · Authorization required · Insurance hold, member/group (missing marked)/claim/subscriber/employer; Edit; Remove refused while a case uses it; "Cannot add coverage yet" with what is needed). Case overview (Case details with "Required for billing" marks; Insurance primary/secondary; Diagnoses 12 max, reorder, remove; Authorizations with status; Other cases + New case; Edit/New case dialog with related cause → injury date / accident state, payer-required injury date, WC employment status, discharge ≥ start). Prototype wording throughout; messages in production style ("Enter the first name.") with the prototype's format messages.
- **Differences:** (chart menu and case switcher: see 2026-10-02 — now as the prototype); a new patient names its practice (no current practice here); the guarantor's fields, the subscriber's and the employer's appear only when they apply (the prototype showed them always and required them only then); the SSN is never revealed (no permission model to know a System Admin) and never refilled into the form; new patients have no Billing ID until a backend assigns one; History and the billing-exception notice are not shown.
- **Fixed on the way:** the roster's Filters button now has an explicit accessible name ("Filters, 1 on") — hidden-text spacing had made it "Filters,1on".
- **The backend will need to provide:** patients (with guarantor + address, SSN encrypted and masked server-side, Billing ID, EMR ID), coverage, cases with ordered diagnoses, authorizations with usage, the ICD-10 code list, search / filter / paging, deletion rules (refuse with visits), and who may see or change each — none of it is enforced here. 461 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440 (14 flows).

### 2026-10-02 (Development items removed from the navigation)
- **User request:** no Home and no Components in the production navigation. The rail and the phone drawer now list only the modules: Patients · Setup · Admin (with their sections in the drawer).
- **Home:** its page was the development placeholder ("Frontend foundation"); it is gone. `/` is still the app's start — where signing in lands (`safeRedirect` falls back to it), where the logo ("EMR Billing — home") and the 404 page's "Back to the start" lead — so the route stays and now **redirects to `/patients`**, as `/admin` opens its first section. No dashboard was added.
- **Components (`/dev/ui`):** removed from the navigation only. The route and `src/dev/ShowcasePage.tsx` stay: development-only already (the route throws not-found in production; the page is never in the production bundle), documented in docs/UI_KIT.md ("open /dev/ui") and docs/PERFORMANCE.md, and used by two tests. Reach it by its address in development.
- Tests updated (drawer list, rail, start address → Patients, sign-in lands on Patients). 461 tests; verify green; rail and drawer checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-02 (Patient Profile — organized) — REVERTED, see "back to the prototype's UI" below
- **User request:** the chart's Profile felt unorganized. Now, in the light style (plain sections, no boxes): **the person** in the main column — Demographics (Name, Date of birth, Gender, SSN; "Edit patient") and Contact & address — and **at the side from 1024px** Guarantor ("Receives statements", "Guarantor address"), **Internal notes** (its own section, "No notes." when empty; it used to sit under Guarantor) and **Identifiers** (Billing ID, EMR ID — moved out of Demographics). Fixed grids so rows line up (4 / 3 across, 2 on a phone and in the narrower main column at 1024). Same content and wording; stacked in that order on a phone. 461 tests; verify green; 14 Patients flows browser-checked at six widths.

### 2026-10-02 (Patient chart — back to the prototype's UI)
- **User correction:** the request was only to gather the case's tabs into one view, never to change the prototype's chart UI. The 2026-10-02 Profile reorganization and the tab strip are **reverted**; the chart now follows the prototype:
  - **Side menu** (248px, sticky from 1024px; a scrolling row of pills below): Patient — Profile, Insurance (coverage count) — rule — **case card** (Case, name, "N cases · Since date · Closed"; opens a menu of the cases with insurance · Open/Closed, a check on the current one, and **New case**) — Case overview. The chosen case is `?case=` on the chart's layout route and is kept across Profile / Insurance / Case overview; picking a case keeps the current part. Ledger is not listed (not built).
  - **Header** as the prototype: brand "← Patients", name, chip, meta line, More; a full-width rule under it.
  - **Profile**: Demographics (Name, Date of birth, Gender, SSN, Billing ID, EMR ID) · Contact & address (address on two lines) · Guarantor (Guarantor with address, Internal notes); auto-fill grid.
  - **Insurance**: bordered coverage cards with "Edit" and a remove icon. **Case overview**: no separate case dropdown; primary/secondary as cards (dashed when empty); "Visits keep a snapshot." as an info notice. Section subtitles sit beside the title (`Section`'s new `description`; under it on a phone).
- Shared: `Section` `description`; `CaseEditor` (patients) wraps the case dialog for the menu and the Case overview. The authorizations table keeps the issuer and dates under the number until 1280px (the menu takes the room).
- 463 tests; verify green; Patients flows (incl. the case menu) browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-02 (Patient chart — one page)
- **User request:** combine the chart into one view, easy to scroll and uncluttered, with a clear place to choose the case and add a new one. Supersedes the side-menu/case-card layout above (the prototype splits the chart into parts; this is a deliberate, requested difference).
- **One route** `/patients/$patientId` (`?case=<id>`; `#profile|insurance|case|diagnoses|authorizations` opens at that part — New patient opens `#insurance`). The `/profile`, `/insurance`, `/case` child routes are gone.
- **Order:** header → Demographics → Contact & address | Guarantor (side by side from 1280px) → Insurance coverage → **Cases** (a part heading after a rule: one card per case — name, since, primary insurance, Open/Closed; the chosen one marked — and a dashed **New case** card) → the chosen case's Case details, Insurance, Diagnoses, Authorizations (h3 under "Cases").
- **Menu = in-page navigation** (sticky column from 1024px with groups Patient / Case — the case link shows the case name; a sticky pill row below that scrolls to keep the current pill in view): jumps to a part (smooth unless reduced motion, focus moves to its heading) and marks the part being read (`aria-current="location"`, scroll-spy in `chart-scroll.ts`). Counts: coverages, diagnoses, authorizations.
- **Removed as duplicates:** the "Other cases" section (the case cards replace it), Case details' Case name and Status (on the chosen card). The case dialog's "Open the patient's insurance" link is now "Go to the patient's insurance" (closes and scrolls). `Menu` is back to its committed version.
- Tests: jsdom stubs `Element.scrollIntoView` / `scrollTo` (`src/test/setup.ts`). 463 tests; verify green; Patients flows (incl. jumping and scroll-spy) browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-02 (Patient chart — one page, case card back in the menu)
- **User feedback:** with the case cards inside the page it was not clear that choosing or creating a case drives the case part below; the earlier case card in the menu was better UX. **User chose (AskUserQuestion): "One page + case card".**
- **Now:** still one page and one route. The chart's menu has, under Patient (Profile, Insurance), the prototype's **case card** (Case · name · "N cases · Since date · Closed"; below 1024px a compact "Case  name ▾" pill in the sticky row). It opens a menu of the cases (insurance · Open/Closed, a check on the current one) and **New case**. The case's own links sit under it: Case details, Diagnoses, Authorizations. Picking a case keeps the reader's position.
- **In the page:** the grid of case cards is gone. The case part opens on a **case header** after the rule: "CASE" eyebrow, h2 with the case name (+ Open/Closed), and "Since date · primary insurance · n of N cases". No case: "No case yet" and New case.
- `Menu` items take `description` and `selected` again (for the case menu). 463 tests; verify green; Patients flows (incl. the case menu) browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-02 (Patient chart — content grouped on cards)
- **User feedback:** the page's content felt messy and not visually separated. Offered panels on a grey page or space-and-headings only; **the user refused both** — no page colour change, and spacing alone is not enough.
- **Now:** the page stays white; each group is a hairline card (`ChartCard`, in the chart folder), with no rule under the headings:
  - **Profile** card ("Edit patient" at its top, as it edits all of it) with three groups (`CardGroup`, h3): Demographics; then, after one hairline, Contact & address | Guarantor (side by side from 1280px).
  - **Insurance coverage** card: the coverages are rows inside it (hairlines between), not cards inside a card.
  - **Case**: the case header (unboxed, more space above it), then cards for Case details, Insurance (primary | secondary, a hairline between, no inner boxes), Diagnoses (with the snapshot notice) and Authorizations.
- Field grids are two across on a phone (Profile, coverage, Case details). The authorizations' date range wraps between the dates (the table fit at 1280 inside the card).
- 463 tests; verify green; Patients flows browser-checked at 375, 390, 768, 1024, 1280, 1440.

### 2026-10-02 (Field help — explanations behind the info icon)
- **User request:** no explanatory text under inputs; explanations go in the existing info tooltip beside the label (`Field` / `FormField` / `Switch` `info` → `InfoTip`: hover, focus, tap; portalled). Text the user needs to complete the field stays visible (`description`).
- **Moved to `info` (wording unchanged):** Case dialog — Referring physician, Primary insurance, Secondary insurance, Related cause, Injury / onset date (incl. "<payer> requires it (Box 14)."), Accident state; Coverage dialog — Claim number; Coding rule dialog — Applies to; Procedure code dialog — Active and Modifier override switches.
- **Kept visible, on purpose:** "From 1 to 12." (schedule hours — allowed range); "Last run …" (Submission & automation — live status, not explanation); form-level notes that block or announce something (no referring physicians / no insurance yet with their action buttons; Practice "First location"; Provider "Claim hold"; Insurance "Billing rules" inheritance; Insurance class members; New patient "First case") — section notes, not text under an input; Rule tester's result-area messages.
- 463 tests; verify green; the changed dialogs and their tooltips checked at 375, 390, 768, 1024, 1280, 1440 (keyboard focus everywhere, hover/leave from 1024; tooltips and dialogs stay on screen).
- **Follow-up (user):** the Patient dialog's help came through its `text()` / `select()` helpers and was missed. And "Required for billing." is never shown, not even in a tooltip — the red asterisk says it; likewise "Optional." (no asterisk says it). Removed: Patient DOB, Gender, Street address and Coverage group number "Required for billing."; "Required for billing." / "Optional." trimmed from the Case (referrer, secondary), Provider (NPI) and Practice (organization) tooltips. Moved to tooltips: SSN "Stored encrypted; masked for everyone but System Admin.", Street address "Box 5.".

### 2026-10-02 (Exceptions — frontend only; scope chosen by the user)
- **Scope (user, AskUserQuestion): "Billing exceptions".** Built from the prototype's Exceptions at `/exceptions` (open), `/exceptions/incomplete`, `/exceptions/resolved` (`?practice=`, `?level=` deep link); rail entry Exceptions after Patients (prototype order).
- **No backend exists and none was simulated** (no api module, endpoint, payload or id). One in-tab store, `features/exceptions/data/exceptions-store.ts` (`useBillingExceptions()`: list + `resolve(settles, by, at)`); the prototype's 7 open exceptions load only when `__MOCK_DATA__` (checked: absent from `dist`). **Detection is the server's** — nothing in the frontend raises an exception; "Save and re-check" saves the fix to the source record, then resolves the exceptions that fix settles (same fix target; a corrected referrer NPI settles every case using that physician, another physician only that case) — the stand-in for the server's re-check.
- **As the prototype:** header; practice filter (as the other practice-scoped screens); tabs with counts (open count red when > 0); level pills with counts + "Show all levels"; columns Level (row marker red for Charge/Payment, amber otherwise; Payment tag sand), Exception trigger (+ particulars), Record (patient "Last, First" + DOS · record, or ERA control + payer), Detected ("Sep 14 17:30"), Owner (or Unassigned), Due (overdue red, said to screen readers), Resolve; Resolved tab: Resolved (when + by whom, the signed-in user). 12 a page, sortable. Empty states in the prototype's words. Resolve dialogs (critical notice of the exception, form, Cancel / "Save and re-check") for: patient phone (placeholders refused, cell unless home), address (ZIP cross-checked against the state, prototype ZIP-prefix table), field length (+ "Fill in a truncated version", name 30 / address 35), case fields (the missing one required), subscriber, referring physician (correct NPI on the directory, or another physician on the case — radio), rendering NPI (provider update), $0.00 code (default fee and/or the payer's rate; "Used when no payer row matches." as an info tooltip). Toasts: "<fix> — exception resolved", or "… — but the visit still has N exceptions" with their triggers.
- **Not built (scope):** Payment-level Resolve (map remittance to claim, map adjustment code — need Claims/Payments/ERAs; listed, no Resolve); Incomplete profiles cards and "Complete profile" (no draft providers/insurances or waiting sessions exist; the prototype's empty state shows); links to the visit (no Charges); assigning owner/due (no work-item model); permissions (no permission model — Resolve shown for every non-Payment row).
- **Touched elsewhere (small, safe):** public exports added to patients, providers, referring physicians and fee schedules (hooks/types the fixes use); four prototype patients (p10, p12, p14, p21) added to the patients dev sample, last, so other Billing IDs stay; `TabNav` count gets a space for screen readers ("Resolved 3"); `RadioGroup` option rows are ≥ 32px tap targets (no other consumer). The Exceptions screen prefetches providers, referring physicians and insurances so a Resolve form opens on its record without a loading step.
- 14 Exceptions tests; 477 tests total; verify green; flows browser-checked at 375, 390, 768, 1024, 1280, 1440 (no overflow, dialogs fit, tooltips on screen).

### 2026-10-02 (Visits, charge lines and claims — from the backend's payload examples)
- **No backend exists** (user, 2026-10-02: "no real backend, just the payload example sent"). The three payload examples are the contract: create visit `{ case_id, date_of_service, location_id, billing_provider_id, treating_provider_id, authorization_id|null, charge_lines: [{ procedure_code_id, units, modifiers?, diagnosis_pointers? }] }`; create charge line `{ visit_id, procedure_code_id, units, modifiers?, diagnosis_pointers? }`; create claim `{ visit_id, procedure_code_id, units, modifiers, diagnosis_pointers }`. Built like the other payload-based features: `features/visits` and `features/claims`, each with `api/` (dev mock in development/tests, `unavailable` in any other build), Zod response schemas, TanStack Query hooks. No endpoint paths are written.
- **Workflow chosen (prototype not followed where it has no backing):** Case → Visit → Charge lines → Claim. Rail: Patients, **Visits** (the prototype's "Charges" — the backend's entity is the visit), Exceptions, **Claims**. `/visits` list (search, `?practice=`, newest first, 12 a page); `/visits/new?case=` (the case decides the offered active locations/providers, authorizations and diagnoses; one or more charge-line groups); `/visits/$visitId` (details, charge lines + "Add charge line" — the separate charge-line payload — then the visit's Claims + "Create claim"); `/claims` (each claim with its visit; row opens the visit). The patient chart's case gets a **Visits** card (handed over by the route, so Patients does not import Visits) with "New visit" on the case.
- **Interpretations, to confirm with the backend:** a claim is created from one charge line (the claim payload is one line's fields; values copied as they are); a line's `modifiers` / `diagnosis_pointers` are optional and left out when empty (the first example line has neither); pointers are 1-based positions in the case's diagnosis list (as the chart already labels them, Box 21 / 24E), in the order chosen; modifiers entered as "GP, 59", in capitals, up to four (as procedure codes' slots); a visit is created with at least one line; a code with modifier override fills in its modifiers; inactive codes are not offered (V2 §10.3); date of service not in the future (prototype). Responses assumed = payload + numeric `id` (lines with `id`, `visit_id`). **Ids:** location/provider ids are numbers; cases, authorizations and procedure codes are frontend-only here, so `case_id` / `authorization_id` / `procedure_code_id` carry the frontend identifier (case id, CPT code) until those backends assign ids.
- **Not built — no payload:** prices / amounts / fee lookup, place of service, line notes, visit or claim statuses and lifecycle (Charge review, Pended, Released, Submitted…), editing or removing a visit, a line or a claim, submitting / correcting / voiding a claim, claim numbers, payers, scrubbing, EMR source / record ids, a link between a claim and its line, limits on claims per line.
- 16 new tests (payload builders against the examples; list, new visit with two lines and ordered pointers, validation, failed save, visit detail, add line, create claim, claims list, chart card); 493 tests; verify green; browser-checked at 375, 390, 768, 1024, 1280, 1440 (no overflow; touch targets ≥ 32px).

### 2026-10-02 (Insurances — Submission & SLA)
- **User request:** remove **Max units per line**; make **Payment SLA (days)** and **Claim format** optional. `max_units` is gone from the provisional insurance contract, form, list and dev mock; `claim_format` and `sla_days` are nullable (sent as `null` when not set; SLA still 1–365 when given). New insurances start with neither set (they used to default to EDI 837P and 30 days). The list's SLA column shows "—" for none and sorts those last. 494 tests; verify green.

### 2026-10-02 (Visits — New visit in a dialog)
- **User request:** visit creation is a modal, not a page. `NewVisitDialog` (size lg, the same form: case, date of service, location, providers, authorization, charge-line groups; Cancel / Create visit in the footer) opens from the Visits list's "New visit" (header and empty state) and from the patient chart case's Visits card (on that case). The `/visits/new` route is gone; creating still opens the new visit. Checked at 375–1440: the dialog fits, the form scrolls inside it.

### 2026-10-07 (Sign-in integrated with the staging backend)
- **Confirmed contract:** base `the staging API (address in the local, uncommitted `.env`)`; `POST /auth/login` `{ email, password }` → `{ success, message, data: { user: { id, name, email, is_active, created_at, updated_at }, access_token, token_type: "Bearer" } }`. Observed on staging: wrong credentials → `401 { success: false, message: "Invalid credentials", errors: [] }`; validation → `422 { message, errors: { field: [..] } }` (Laravel); CORS `Access-Control-Allow-Origin: *`, no credentials.
- **Built:** `lib/auth/session.ts` (token in memory only); http client sends `Authorization: Bearer <token>`, `credentials: 'omit'` (was `include`, which `*` CORS rejects), parses Laravel errors, clears the session on a 401 that carried the token; `features/auth` signs in live when a backend is configured (`env.isLive`), keeps the returned user as "who is signed in" (seeded into the current-user query), sign-out forgets token + user; `routes/_app.tsx` guard → `/login?redirect=…` when live and no session. `.env.staging` (committed, public values) + `npm run dev:staging` / `build:staging`. Other features unchanged (still mocks in dev, `unavailable` in live builds).
- **Gaps for the backend:** no logout/revocation endpoint (sign-out is local only), no "who am I" / refresh (reload = sign in again), token lifetime unknown, other auth endpoints (change password, forgot password) still unknown.
- Verified live against staging in the browser (guard → sign in → Patients as "Super Admin"; no storage used; reload → sign in; wrong password message). 505 tests; verify green; staging build has the URL and no mock data or credentials.
- **Sign-out (2026-10-07):** `POST /auth/logout` (Bearer token, no body) → `200 { success: true, message: "Successfully logged out.", data: null }`; the token is revoked (the same token then gets `401`). Sign-out calls it, then forgets token + user whatever the answer; a `401` counts as signed out; a network failure shows "Signed out of this browser". Verified live in the browser (logout carried the Bearer token, 200, old token → 401, protected page → sign in). 507 tests; verify green.

### 2026-10-07 (No mock data — real backend by default)
- **User request:** no mock data from now on; `npm run dev` runs against the real backend with no extra setup. **Scope chosen (AskUserQuestion): every screen keeps its normal states** — API-backed screens show their load-failed state ("This could not be loaded" / Try again) until their endpoints are wired; in-memory screens (Patients, Exceptions, Procedure codes, Fee schedules, Coding rules, Roles, EMR integration, Submission & automation) start empty.
- **Removed:** every `*.mock.ts` (12), every `sample-*.ts` dev sample (8), `__MOCK_DATA__` (vite define + `mock-data.d.ts`), `VITE_DATA_SOURCE`, `.env.staging` and the `dev:staging` / `build:staging` scripts. ADR 0006 superseded. The patients store no longer has an ICD-10 list (only a backend can supply one).
- **Config:** committed `.env` (public: `VITE_API_BASE_URL` = staging, `VITE_ENVIRONMENT=staging`) used by `npm run dev` and `npm run build`; `.env.test` (no backend: nothing is sent in tests); `.env.local` for personal overrides (ignored). `env.isLive` = a base URL is set.
- **Behaviour:** api modules call `request()` only for confirmed endpoints (auth login/logout); everything else rejects `unavailable` at once — no longer retried (only a server 503 is). Tests seed other features' in-memory stores through their reset, faked by path; the EMR test fakes the signed-in user; vitest default timeout 15 s.
- Verified with plain `npm run dev`: sign in against staging → Patients (empty, practices "could not be loaded"), Admin → Organizations shows the load-failed state; only `/auth/login` hits the network. 491 tests; verify green; no sample data in the bundle.

### 2026-10-07 (Forgot password integrated)
- **Confirmed:** `POST /auth/forgot-password/send-otp` `{ email }` → `200 { success, message: "If this email is registered, a reset code has been sent to it.", data: null }`; `POST /auth/forgot-password/verify-otp` `{ email, otp }`; `POST /auth/forgot-password/reset` `{ email, otp, password, password_confirmation }`. Observed on staging (no email sent, nothing changed): a wrong code → `400 { success: false, message: "Invalid OTP.", errors: [] }` (verify and reset); missing/invalid fields → `422 { message, errors: { field: [..] } }`; the new password must be at least 8 characters (server rule, its 422 lands on the field — no client rule added).
- **Built:** the three live calls in `features/auth/api/auth-api.ts` (status only; bodies not read); a refused code shows "This code is invalid or has expired." on the code field (verify) or above the form with "Request a new one." and Start over (reset) — never the server's "Invalid OTP.". Change password still has no endpoint (`unavailable`).
- Verified live (unregistered email: send-otp 200 → "Check your email"; wrong code → 400 → message on the code field). 5 new tests; 496 tests; verify green.

### 2026-10-07 (Change password integrated — every auth call is now live)
- **Confirmed:** `POST /auth/change-password` `{ current_password, new_password, new_password_confirmation }`, with the Bearer token. Observed on staging (the password was never changed; the probe token was revoked): wrong current password → `400 { success: false, message: "Current password is incorrect", errors: [] }`; validation → `422` keyed on `new_password` (mismatched confirmation, at least 8 characters), mapped onto New password; without a token → `401`.
- **Built:** the live call; a refused current password shows "The current password is incorrect." on that field (never the server's wording). The auth module has no unconnected call left. Verified live in the browser (Bearer sent, exact keys, message on the field). 498 tests; verify green.

### 2026-10-07 (Admin → Audit log integrated — `GET /activity-logs`)
- **Confirmed:** `GET /activity-logs?page=N`, with the Bearer token → Laravel pagination `{ data: { data: [entry…], links, meta: { current_page, last_page, per_page: 15, from, to, total } } }`, newest first. Entry: `{ id, log_name, event, description, subject_type, subject_id, causer: { id, name, email } | null, changes: { old, attributes }, properties: { ip_address, email? }, batch_uuid, created_at }`. Only `auth` entries exist so far (`login`, `logout`, `login_failed`; a failed sign-in has no causer and carries the email tried).
- **Built:** When = `created_at`; User = `causer.name`, "No user" when there is none; Action = `description`, with a detail line of the email tried, the **names** of changed fields (never their values — they may hold PHI) and the IP address; Module = `log_name` ("auth" shown as "Authentication"; any other name as sent). 15 a page, as the server pages; summary and pager from `meta`. Empty `[]` for `properties`/`changes` is read as empty.
- **Removed from the screen, pending a contract:** the prototype's search and module pills. The endpoint's contract has no search or filter; staging was observed to ignore `search` and to filter on `log_name`, `event` and `causer_id` and honour `per_page`, but none of that is confirmed, so none is sent. Filtering the loaded page alone would say "nothing matches" while other pages match. **Open:** search, filter parameters and their `log_name` values (they do not match the prototype's modules).
- Verified live in the browser (requests `?page=1`, `?page=2`; failed sign-in row; 0 horizontal overflow at 375–1440). 501 tests; verify green.

### 2026-10-07 (Who is signed in — `GET /auth/me`)
- **Confirmed:** `GET /auth/me`, with the Bearer token → `{ success, message, data: { id, name, email, is_active, created_at, updated_at } }` (the login's user shape). Observed on staging: without a token, or with a revoked one → `401 { message: "Unauthenticated." }`.
- **Built:** "who is signed in" (`useCurrentUser` → account menu, EMR integration's requester, exception resolver) now asks the server instead of a copy kept in memory. The login's user still seeds the cache, so no extra request follows sign-in; `/auth/me` answers whenever the cache has no user. Without a session nothing is sent; a `401` ends the session (http client). The token is still memory-only, so a page reload still means signing in again. 504 tests; verify green; checked live.

### 2026-10-07 (Session kept in `localStorage` — user's decision)
- **Decision (user):** the access token is kept in `localStorage`, so a reload or a new tab stays signed in. This overrides frontend/docs/SECURITY.md §2's memory-only rule; the accepted XSS risk and what limits it are written there. Still wanted from the backend: token lifetime / idle expiry, and a strict CSP on the hosting.
- **Built:** `lib/auth/session.ts` stores `{ accessToken, tokenType }` under `billing.session` — nothing else — with an in-memory copy (works for the tab when storage is blocked); sign-out and a `401` remove it; other tabs follow via the `storage` event. The only file lint allows `localStorage` in. The route guard checks a restored token once with `GET /auth/me` (cached after; right after sign-in it is already known) and sends a refused one to sign in; other failures let the app load.
- Verified live: stored keys only the token and its type; reload and a new tab stay signed in (one `/auth/me`); sign-out empties storage and the other tab goes to sign in on its next navigation; a revoked token left in storage → `/auth/me` 401 → sign in, storage emptied. 511 tests; verify green.

### 2026-10-07 (Audit entry details — `GET /activity-logs/{id}`)
- **Confirmed:** `GET /activity-logs/{id}`, with the Bearer token → `{ success, message, data: entry }` (the list's entry shape). Observed on staging: an unknown id → `404 { message: "No query results for model …" }`. Staging now also logs `organizations` `created` / `updated` with `changes.old` / `changes.attributes` holding the field values.
- **Built:** a row of the audit log opens the entry in a side panel (the kit's `Drawer`; the list keeps its page): the action and exact time (to the second) as its title; User (name, email) or "No user", Module, Event, Record ("Organization #1", from `subject_type` / `subject_id`), every property (IP address, the email a failed sign-in tried), Batch when there is one; and a **Changes** table — Field · Before · After — when the entry has any. Read-only. Not found → "This entry could not be found"; other failures → retry. An entry is fetched once, then cached.
- **Display:** an unknown `log_name` is shown capitalised ("Organizations"), descriptions with a capital ("Updated"); only `auth` has its own label ("Authentication"). The prototype has no detail view — this one is new.
- 517 tests; verify green; checked live (login and updated entries, 0 horizontal overflow at 375–1440).

### 2026-10-07 (Admin → Organizations integrated)
- **Confirmed:** `GET /organizations?page=N` (Laravel pagination, 15 a page; item `{ id, name, is_active, practices_count, created_at }`), `GET /organizations/{id}` (`{ id, name, is_active, practices: [], created_at }`; unknown id → `404`), `POST /organizations` and `PUT /organizations/{id}` with `{ name, is_active }` → `{ success, message, data: null }`, `DELETE /organizations/{id}` (response not given; only its status is relied on).
- **Built:** the list is the server's — 15 a page with summary and pager, in the server's order (the Organization column no longer sorts: sorting one page would misstate the list); a **Practices** count column (from `practices_count`; hidden on phones so the actions fit); Active switch (a `PUT` with the row's name); **Delete** row action with a confirmation ("Delete {name}?", stating "It groups N practices." when it has any) and an error toast with the server's reason when refused; the edit dialog loads the organization from `GET /organizations/{id}` first (Save waits for it; "This organization no longer exists" on a 404). Create/update read nothing back — the toast uses what was typed, and every organizations query is refreshed after a change.
- **Practices → organization picker / name lookup** now reads every page (`listAllOrganizations`: page 1, then the rest at once).
- **Not built (no data for it):** the prototype's practice names column and practice picker in the dialog — the list sends only a count, and a practice in the detail's `practices` has not been seen, so its shape is unknown. Staging was also seen to accept `search`, `is_active` and `per_page` on the list — not in the contract, not used.
- **Not exercised on staging:** create, save and delete (the checks were read-only, to leave shared data alone); the requests are covered by fetch-level tests. 525 tests; verify green; 0 horizontal overflow at 375–1440.

### 2026-10-07 (Active switch — optimistic, and a message on success)
- **Decision (user):** every table's Active switch says so on success — "{row} activated / deactivated" (`statusChanged` in `components/ui/RowActions.tsx`), beside the existing failure toast. Replaces the "silent on success, as Coding rules" rule (docs/UI_KIT.md updated). Locations, Users and Patients ask first and already said it from their confirmation; unchanged.
- **Decision (user):** against a server the switch is **optimistic**. Organizations (`useSetOrganizationActive`): the new status is written into the cached pages, the all-organizations list and the record at once (in-flight reads cancelled first), the `PUT` follows; a failure flips that one organization back (not a cache snapshot, which could undo another row's change) and toasts; the lists are re-read afterwards without holding the switch. Feedback comes from `mutateAsync` per call, since `mutate`'s callbacks fire for the latest call only. Insurances, Insurance classes and Providers (not connected yet) got the message the same way; each becomes optimistic when it goes live, following Organizations.
- **Why:** the switch waited for the `PUT` and then a list re-read — 2–6 s on staging (1–4.5 s a request). Now on staging: the switch moves in ~0.1 s; the message follows in ~1–1.5 s. 526 tests; verify green.

### 2026-10-07 (Practices — create integrated)
- **Confirmed:** `POST /practices` with `{ organization_id, code, name, dba_name?, npi, tax_id, taxonomy_code, address: { line1, line2?, city, state, zip }, is_active, locations: [{ code, name, npi, address, place_of_service? }] }` — the shape the frontend already built (pinned by `api/payloads.test.ts`). The example carries two locations; the New practice dialog sends its one first location, as the prototype does. **Response not given:** nothing is read from it.
- **Built:** the live call, with the token. Server field errors land on the form: payload names → form names (`tax_id` → `taxId`), and a first-location error `locations.0.x` → `location.x` (`practiceFormFieldFor`; `renameFieldErrors` now also takes a function). After creating, the dialog says "{name} created" and the list is read again — it no longer opens the new practice, which needed an `id` from the response.
- **Still not connected (no endpoint given):** the list (`GET /practices` exists on staging — Laravel-paged, empty, so its item shape is unknown), saving a practice, adding / saving a location. The screen shows its load-failed state until the list is connected. Not exercised on staging (it would create shared data). 529 tests; verify green.
- **Corrected payload (same day):** in `POST /practices`, each of `locations[]` is **flat** — `{ code, name, npi, address: "<street>", city, state, zipcode, place_of_service }`, no suite line; the practice's own `address` stays an object. Response confirmed: `{ success, message: "Practice created successfully", data: null }`. The builder sends the flat shape; a first-location error maps back (`locations.0.address` → the location's street, `…zipcode` → its ZIP). The standalone add/save-location payload (an earlier example, nested address, no endpoint) is unchanged until its contract arrives. 529 tests; verify green.

### 2026-10-07 (Practices — list integrated; detail read from staging)
- **Confirmed:** `GET /practices?page=N` → Laravel-paged **summaries** `{ id, organization_id, code, name, npi, tax_id, taxonomy_code, is_active, organization: { id, name, is_active, created_at } | null, locations_count, created_at }` — no DBA, address or locations. **Observed on staging, not yet confirmed:** `GET /practices/{id}` → the whole practice: plus `dba_name`, `address { line1, line2, city, state, zip }`, `locations[]` flat `{ id, practice_id, code, name, npi, address, city, state, zipcode, place_of_service, is_active, created_at, updated_at }`.
- **Built:** `usePractices()` = every page of summaries (practice selects, names, the tiles — "N locations" is now the list's count, inactive included); `usePractice(id)` = one practice in full (the selected practice's details and locations; EMR integration's locations; the provider dialog's location picker); `usePracticesWithLocations()` = every practice in full, one detail read each, shared cache (Providers' hold names, Visits' location names and picker). A location's flat address is read into the forms' `{ line1, city, state, zip }`. The organization's name comes from the practice record (the screen no longer loads all organizations). Update / location calls resolve with nothing (responses unknown).
- **Still not connected:** saving a practice, adding / saving a location (no endpoint given — though the staging record was edited since it was created, so a save endpoint seems to exist). Verified live read-only (tiles, details, both locations, EMR integration's locations; 0 overflow 375–1440). 532 tests; verify green.

### 2026-10-07 (Practices — detail confirmed; save and delete integrated)
- **Confirmed:** `GET /practices/{id}` (the shape read from staging earlier — now the contract); save answers `{ success, message: "Practice updated successfully", data: null }`; `DELETE /practices/{id}` (response not given).
- **Assumed (to confirm):** save is `PUT /practices/{id}` (given as "UPDATE"; staging routes PUT, PATCH and DELETE on a practice — checked with an unknown id, nothing changed) and its body is the practice payload **without** `locations` (locations are added and saved on their own). Not tried against the real record: if a save without `locations` were read as "no locations", it could remove them.
- **Built:** Edit practice saves live (server field errors on the fields). **Delete practice** beside Edit in the practice header (danger button) → confirm "Delete {name}?" ("It has N locations." when it has any; nothing claimed about what happens to them) → toast "{name} deleted", the first practice shown (`?practice` cleared); a refusal → error toast with the server's reason. Still not connected: adding / saving a location. Checked live with nothing saved; 537 tests; verify green.

### 2026-10-07 (Locations integrated; practice save confirmed and corrected)
- **Confirmed by the user:** practice save is `PUT`. **Tried on staging (throwaway records, all removed):**
  - `POST /locations` takes the **flat** location (`{ practice_id, code, name, npi, address: "<street>", city, state, zipcode, place_of_service, is_active }`) — the nested example is refused (422 on `address`, `city`, `state`, `zipcode`); answers `201 { data: null }`. Left out, `place_of_service` becomes 11 and `is_active` true. A taken code → 422 on `code`.
  - `PUT /locations/{id}` — same fields **without `practice_id`** ("prohibited": a location never moves). `GET /locations?page=N` — summaries `{ id, practice_id, code, name, npi, place_of_service, is_active, practice: { name } }`, no address (also filters by `practice_id`). `GET /locations/{id}` — the location with its practice. `DELETE /locations/{id}`.
  - **A `PUT` changes only the fields it carries** (practice and location): left out = kept. A practice save without `locations` keeps them. `dba_name: null` (or `""`) clears the DBA; `organization_id: null` removes the organization; `address` is replaced whole (no `line2` clears it). A location's `place_of_service` cannot be cleared (`null` → 422 "must be 2 digits").
  - **Deleting a practice deletes its locations.**
- **Built:** location add (`POST`), save (`PUT`, no `practice_id`), Active switch → a `PUT` carrying `is_active` alone (after the existing confirmation), **Delete** on a location row (confirm "Delete {name}?"; toast; server refusal → error toast); location field errors land on the form (`zipcode` → ZIP, `address` → street…). Practice save sends an emptied DBA as `null`. The location form now requires a place of service (no clear button; new ones start at 11). Delete practice says "Its N locations are deleted with it." `useLocations()` (`GET /locations`, every page) replaces the per-practice detail reads for Visits (location names and picker) and Providers (hold names, the dialog's location picker); EMR integration keeps the practice record. Every practice and location call is live.
- Verified live end to end in the app with throwaway records (create practice + first location, clear DBA, add / edit / deactivate / delete a location, delete the practice); 0 overflow 375–1440 with the two row buttons. Note: location 2 ("asdasdad Ridge") of practice 1 was saved twice and deleted at 18:41–18:42 UTC by the same account — not by these tests. 544 tests; verify green.

### 2026-10-07 (Server messages shown — success and error)
- **Decision (user):** show the server's own messages instead of ours — they say what the problem is ("A practice must have at least one location; this is its last one."). Our wording stays only as the fallback when the server sends none.
- **Built:** `ApiError.serverMessage` (the server's text, kept from a 4xx even when it comes with field `errors` — the client used to replace it with "Some fields need attention.") and `userMessage` returns it first. Not shown (our sentence by kind instead): any 5xx text, and Laravel's technical "No query results for model …" / "The route … could not be found". A rejection naming no form field reaches the form's banner (`applyServerErrors`). Writes resolve with the server's success `message` (`lib/api/server-message.ts`) and the toasts show it: organizations (create, save, delete, Active switch), practices (create, save, delete), locations (add, save, status, delete), sign out ("Successfully logged out."), change password, resend code. Auth errors: sign in ("Invalid credentials"), wrong current password, invalid code — the server's words.
- Verified live: deleting a practice's only location → "… was not deleted · A practice must have at least one location; this is its last one."; practice delete → "Practice deleted successfully"; sign out → "Successfully logged out.". docs/SECURITY.md §8 updated. 551 tests; verify green.

### 2026-10-07 (Every Active switch asks first; optimistic update dropped)
- **Decision (user):** every table's Active switch confirms before changing, for consistency (before: only Locations, Users and Patients did). **Recommendation taken:** not optimistic — after a confirmation, the dialog stays open with its button busy until the server has saved the change; then the switch shows the new status at once (written into the cached lists on success, re-read in the background) and the toast gives the server's message or reason. Nothing is shown before the server says yes, and a refusal never "undoes" a change the user saw happen.
- **Built:** `StatusChangeDialog` in `components/ui/RowActions.tsx` ("Deactivate {row}? Its status becomes Inactive." / "Reactivate {row}? Its status becomes Active again."; Deactivate in red), used by Organizations, Insurances, Insurance classes, Providers, Coding rules and Procedure codes; `activeColumn` lost `pending`. Organizations' `useSetOrganizationActive` writes the status into its caches on success instead of on the click. Locations, Users and Patients keep their own confirmations. docs/UI_KIT.md updated.
- Verified live: the confirmation shows; the dialog closes when the save returns (~0.9–1.1 s on staging) with the switch already flipped; organization switched off and back on (no net change). 551 tests; verify green.

### 2026-10-07 (Admin → Users integrated)
- **Confirmed:** `GET /users?page=N` (Laravel pagination, 15 a page; `{ id, name, email, is_active, created_at, updated_at }`), `GET /users/{id}`, `POST /users` `{ name, email, password, is_active }`, `PUT /users/{id}` (same fields; the example carries a `password`), `DELETE /users/{id}` — writes answer `{ success, message, data: null }`. **Tried on staging (throwaway users, removed):** a save without `password` keeps the current one (the user still signed in with it); `password: ""` → 422 "The password field is required."; a `PUT` is partial (`is_active` alone works); duplicate email → 422 "The email has already been taken."; password < 8 → 422 "…must be at least 8 characters."; a deactivated user signing in gets "Your account has been deactivated, Please contact Admin." (shown as is). Sign-in is rate-limited (a few tries a minute → "Too Many Attempts.").
- **Built:** server-paged list (server order, no sort), edit dialog reading `GET /users/{id}` first (Save waits), **New password** in the edit form (info: "Leave it empty to keep the current password."; left out of the save when empty), status switch → its own confirmation (as before) and a save of name + email + new status, no password; the switch shows the change as the dialog closes. **Delete** row action ("Delete {name}? They can no longer sign in."), not offered on the signed-in user's own row (`GET /auth/me`; the server decides regardless). Create and save stay outside `useMutation` (a password must not sit in the mutation cache). Server messages shown throughout.
- **Note:** the `PUT /users/1` example changed the staging Super Admin's name, email and password (user 1 is now "ahmed essam"). Verified live end to end in the app with a throwaway user; 0 overflow at 375 and 1280. 562 tests; verify green.

### 2026-10-07 (Setup → Insurance classes integrated)
- **Confirmed:** `GET /insurance-classes?page=N` (Laravel pagination; item `{ id, practice_id, code, name, authorization_required, injury_date_required, apply_specialty_modifiers, accept_assignment, icd_version, is_active, insurances_count, created_at }`), `GET /insurance-classes/{id}` (+ its `practice`), `POST` `{ practice_id, code, name, the four rule booleans, icd_version }`, `PUT /insurance-classes/{id}` (same, **no `practice_id`**), `DELETE`; writes answer `{ success, message, data: null }`. **Tried on staging (throwaway class, removed):** `is_active` is accepted on create and save (not in the examples; the form's Active is sent); `practice_id` on a save → 422 "prohibited"; a `PUT` is partial; code taken in the practice → 422 "The code has already been taken."; `icd_version: "ICD11"` → 422 invalid; the server does not capitalise codes (the form does); `?practice_id=` filters (not in the contract, not used).
- **Built:** the provisional contract replaced. Every page of classes is read (this screen's practice filter and sort, and Insurances / Coding rules pick and name classes); the **Insurances** column is the server's `insurances_count`; **With overrides** shows "—" until the insurance list is connected (it needs each insurance's rules); the edit dialog loads `GET /insurance-classes/{id}` first (Save waits; practice locked — the server refuses moving a class), and its member note falls back to the count ("2 insurances are in this class."); Active switch → `StatusChangeDialog` and a `PUT` of `is_active` alone, written into the cache on success; **Delete** row action ("Delete {name}?", stating "N insurances are in this class." when it has any). Server messages throughout.
- Verified live end to end with a throwaway class; 0 overflow at 375 and 1280. 570 tests; verify green.
- **Follow-up (user, same day):** integrated screens show only what the contract carries. Removed: the **With overrides** column (prototype-only; not in `GET /insurance-classes`) and the edit dialog's list of member insurances with "(overrides)" — the dialog now says only the class's count ("2 insurances are in this class."). Other integrated screens checked: nothing else outside their contracts.

### 2026-10-07 (Setup → Release buckets integrated)
- **Confirmed:** `GET /release-buckets?page=N` (item `{ id, practice_id, name, description, is_active, insurances_count, created_at }`), `GET /release-buckets/{id}` (+ `insurances: []`, `practice` — not read), `POST` `{ practice_id, name, description }`, `PUT /release-buckets/{id}`, `DELETE`; writes answer `{ success, message, data: null }`. **Tried on staging (throwaway buckets, removed):** `is_active` accepted on create and save; `practice_id` on a save → 422 "prohibited"; a `PUT` is partial; an empty description is stored as `null` and `""` on a save clears it; a taken name in the practice → 422 "The name has already been taken.".
- **Built:** columns per the contract — Bucket (name, description), Practice, **Insurances** (`insurances_count`), **Active** switch (`StatusChangeDialog`, `PUT` of `is_active` alone, written into the cache on success), Edit and **Delete** ("Delete {name}?", stating "N insurances are assigned to it." when any). The dialog loads `GET /release-buckets/{id}` first (Save waits; practice locked), gains the prototype's **Active** switch, and notes "N insurances are assigned to this bucket." (count only). Every page is read (practice filter here; the insurance form picks a bucket). Left out, not in the contract: the prototype's held-insurance names and "Claims waiting". Server messages throughout.
- Verified live end to end with a throwaway bucket; 0 overflow at 375 and 1280. 577 tests; verify green.
- **Fix (same day):** Insurance classes' rows shrank when the practice filter was set (the practice was a second line under the class name, shown only unfiltered: 66 → 51 px at 1440). Now a **Practice** column, always shown (as Release buckets has it; on phones the name rides under the class), and Insurances right-aligned — rows and columns identical filtered or not at 1440, 1280 and 375.

### 2026-10-08 (Setup → Insurances integrated)
- **Confirmed:** `POST /insurances` `{ practice_id, insurance_class_id, code, name, insurance_type, payer_id, address, address_line2, city, state, zip_code, phone, fax, authorization_required, accept_assignment, insurance_hold, release_bucket_id, portal_url, portal_user, portal_password }`; `GET /insurances?page=N` (summaries: `display_name`, `insurance_type` + `insurance_type_label`, the four rule overrides, `audit_required`, `is_active`, `insurance_class { id, name }`, `release_bucket { id, name } | null` — **no** address, phone, ICD override, claim format, SLA or portal link); `GET /insurances/{id}` (everything, plus `effective_rules` and the class / bucket / practice records); `PUT`, `DELETE`. Writes answer `{ success, message, data: null }`.
- **Tried on staging (throwaway insurances, all removed):** required — practice, class, code (integer), name, type (`payer_id` is optional server-side; the form still requires it, as the prototype does); `insurance_type` is a code — CI Commercial, MB Medicare Part B, MC Medicaid, BL Blue Cross / Blue Shield, HM HMO, WC Workers' Comp, AM Auto / PIP, CH Tricare, VA Veterans Affairs, OF Other Federal, ZZ Other (labels read from the server; no lookup endpoint); also accepted though not in the example: `injury_date_required`, `apply_specialty_modifiers`, `icd_version`, `audit_required`, `claim_format` (837P | CMS1500), `payment_sla_days` (1–365), `is_active`; the class must be an **active class of the same practice**; hold needs a bucket ("A release bucket is required when insurance hold is checked."), hold off clears it; phone / fax 10 digits, stored as digits; `practice_id` on a save → prohibited; `PUT` partial, `null` clears an optional field **except `claim_format`** (refused; a new insurance gets 837P); `portal_user` / `portal_password` are **write-only** — never returned.
- **Built:** list per the contract — Payer (code – name; class · type label; practice, always shown so filtering does not shift rows), Payer ID, Effective billing rules (yes/no rules COALESCE'd with the class defaults; "· overrides class"), Insurance hold (bucket name) and audit, Active switch (`StatusChangeDialog`, `is_active` alone), Edit, **Delete**; removed from the list (not in the list endpoint): portal link, SLA column (and its sort), "Paper CMS-1500" tag. Dialog reads `GET /insurances/{id}` first; flat address with a new **Suite** (`address_line2`); type select of the server's codes and labels; phone shown 800-555-0199; class options active-only (+ current), bucket options active-only (+ current); claim format not clearable (info: none chosen = 837P); **Portal user / Portal password** added (write-only: empty on edit, info "Never shown once saved. Leave it empty to keep the current one."; left out of the save when empty); create / save outside `useMutation` (the portal password must not sit in the mutation cache). Patients use the type codes (`WC`, `AM`) and the type label.
- **Conflict to note:** the client decided on 2026-09-30 that the payer portal is a link only (no sign-in details); the backend contract carries `portal_user` / `portal_password`, so — following the contract — the form sends them. Verified live end to end with a throwaway insurance; 0 overflow at 1440–375. 582 tests; verify green.
- **Follow-up (user, same day):** the form follows the server's rules, not the prototype's — **Payer ID is optional** (the server does not require it; it is still sent when filled). **Claim format** always holds one of its two values (the server defaults a new insurance to 837P and refuses "none" on a save), so a new insurance starts at **EDI 837P**, the field is marked required and has no empty state. 583 tests; verify green.

### 2026-10-08 (Setup → Referring physicians integrated)
- **Confirmed:** `POST /referring-physicians` `{ practice_id, code, name, type, npi }`; `GET /referring-physicians?page=N` and `GET /referring-physicians/{id}` → `{ id, practice_id, code, name, type, type_label, npi, phone, fax, is_active, practice, created_at }`; `PUT`, `DELETE`; writes answer `{ success, message, data: null }`.
- **Tried on staging (throwaway physicians, removed):** `type` DN "Referring" / DQ "Supervising" (DN when left out; `null` refused); `phone`, `fax`, `is_active` accepted on both writes — phone / fax **exactly 10 digits, no punctuation**; code and **NPI** each unique in the practice; placeholder NPIs refused ("The NPI looks like placeholder data; …"); code ≤ 20; `practice_id` on a save → prohibited; `PUT` partial, `null` / `""` clears phone or fax.
- **Built:** list per the contract in the prototype's layout — Physician, Code, Type (Box 17: code · server label), NPI (invalid marked), Practice, **Phone · fax** (back: in the contract; shown 800-555-0199), **Active** switch (`StatusChangeDialog`, `is_active` alone), Edit, **Delete**; left out (not in the contract): Cases count, free-text "Practice name". Dialog reads `GET /referring-physicians/{id}` first; adds **Phone**, **Fax** (typed with or without punctuation, sent as the 10 digits) and **Active**; practice locked on edit. Exceptions' placeholder-NPI fix now sends **the NPI alone** (`correctReferringPhysicianNpi`) — a full save would have cleared the phone, fax or status it did not carry. Verified live end to end; 0 overflow 1440–375. 594 tests; verify green.

### 2026-10-08 (Setup → Providers integrated)
- **Confirmed:** `POST /providers` `{ practice_id, code, first_name, last_name, credential, specialty, npi, taxonomy_code, state_license }`; `GET /providers?page=N` and `GET /providers/{id}` (bodies read from staging, none were sent) → `{ id, practice_id, code, first_name, last_name, type, type_label, credential, specialty, npi, taxonomy_code, state_license, is_active, practice, created_at }`; `PUT`, `DELETE`; writes answer `{ success, message, data: null }`.
- **Tried on staging (throwaway providers, removed):** required = practice, code, first / last name, NPI; credential, specialty, taxonomy, state license optional (`null` / `""` clears); `type` `rendering` / `billing` (rendering when left out, `null` refused); `is_active` accepted on both writes; NPI 10 digits, placeholders refused; taxonomy "10-character … e.g. 225100000X"; code and NPI each unique; specialty free text; `practice_id` on a save → prohibited; `PUT` partial.
- **Built:** list in the prototype's layout — Provider ID, Provider (name, specialty, practice from the row's own `practice.name`), NPI (+ taxonomy · license), Provider type (server label + the client's meaning), **Active** switch (`StatusChangeDialog`, `is_active` alone), Edit, **Delete**. Dialog reads `GET /providers/{id}` first; type defaults to Rendering; specialty and taxonomy now optional (server's rules); practice locked on edit. Exceptions' "Add rendering NPI" sends **the NPI alone** (`correctProviderNpi`).
- **Dropped (not in the contract):** the whole **claim hold** (from, until, reason, locations, payers — column, form section, `model/claim-hold.ts`). The client asked for it on 2026-09-23; the backend has no fields for it yet — a question for the backend developer.
- Verified live end to end (duplicate NPI on the field, create, edit, deactivate, delete); 0 overflow 1440–375. 598 tests; verify green.

### 2026-10-08 (Tables scroll instead of hiding columns)
- **User decision:** on smaller screens tables scroll horizontally instead of hiding columns.
- **Built:** `DataTable` drops `hideBelow` / `hideOnMobile` (removed from every screen); below 1280px the table keeps a minimum width (8rem × columns) and scrolls inside its own box — from 1280px nothing changed (every column already showed there). The values that rode under the main cell while their column was hidden (codes, practice, dates, type, invalid-NPI marks, etc.) are removed — they would now repeat. Table cells wrap with `break-words` instead of `[overflow-wrap:anywhere]` so words are not split. Page overflow 0 at 375–1440 on every list; docs/UI_KIT.md updated. 598 tests; verify green.

### 2026-10-08 (Setup → Procedure codes integrated)
- **Confirmed:** `POST /procedure-codes` `{ code, description, modifier_override, modifiers, default_fee, procedure_type }`; `GET /procedure-codes?page=N` and `GET /procedure-codes/{id}` (bodies read from staging) → `{ id, code, description, is_timed, modifier_override, modifiers, default_fee ("25.00", a string), procedure_type, procedure_type_label, is_active, created_at, updated_at }`; `PUT`, `DELETE`; writes answer `{ success, message, data: null }`. Codes belong to no practice.
- **Tried on staging (throwaway V999x codes, removed):** required = code, description, procedure_type; code must be a CPT (97110, 0001F) or HCPCS (E0114) shape — "1234A" and "ZZ001" refused — unique, stored in capitals; types `evaluation` / `therapeutic` / `modality` / `supply_dme` / `other` (labels Evaluation … Supply / DME, Other); `default_fee` optional (0.00 when left out), ≥ 0, ≤ 2 decimals, `null` refused; modifiers ≤ 4, each 2 letters/digits, ≥ 1 while the override is on, kept by the server when the override is off (the form sends `[]` then); `is_timed`, `is_active` accepted; the code **can** be changed by `PUT` — and the form lets it (user decision 2026-10-08, replacing the prototype's lock; links elsewhere must go by `id`, see below); `PUT` partial.
- **Built:** in-tab store deleted; `useProcedureCodes()` is now a server query (all pages) used by fee schedules, coding rules, visits and Exceptions. List as the prototype (code, description, type = server label + Timed, override, fee with $0.00 marked, Active switch asking first, Edit, **Delete**), client-side sort and 20 a page. Dialog reads `GET /procedure-codes/{id}` first; default fee now optional; procedure type offers **Other** (server's); modifier inputs need two letters/digits and ≥ 1 when the override is on; uniqueness left to the server (its message on the field); modifier placeholders "Enter modifier" (were "Optional"). Exceptions' "Price this code" sends `default_fee` alone (`setProcedureCodeDefaultFee`).
- **Dropped (not in the contract):** the "New from EMR" mark.
- Verified live end to end (duplicate and CPT-shape refusals on the field, create, edit, deactivate, delete); 0 overflow 1440–375. 605 tests; verify green.
- **Follow-up (user decision 2026-10-08):** the code is editable. Anything that links to a code must link by its `id`, not its text: the visit charge line's provisional payload already names `procedure_code_id` but still fills it with the code text — fix when visits are wired; fee schedules (in-tab, `procedureCode` text) the same when they get a backend. Already-sent claims should keep the code they were billed with (the backend's to snapshot).

### 2026-10-08 (Setup → Fee schedules integrated)
- **Confirmed:** `POST /fee-schedules` `{ insurance_id, procedure_code_id, billed_amount, effective_from, effective_to }`; `GET /fee-schedules?page=N` and `GET /fee-schedules/{id}` (bodies read from staging) → `{ id, insurance_id, procedure_code_id, billed_amount ("30.00"), effective_from, effective_to (null = no end), insurance: { id, code, name }, procedure_code: { id, code, description, default_fee }, created_at, updated_at }`; `PUT`, `DELETE`; writes answer `{ success, message, data: null }`. No `is_active`.
- **Tried on staging (throwaway code V9971/V9961 and its rows, removed):** required = insurance, code, billed amount, effective_from; insurance and code must "exist and be active"; amount ≥ 0, ≤ 2 decimals; effective_to optional, ≥ from; **several prices per insurance + code allowed, but not overlapping** — refused 422 `{ success:false, message:"This insurance already has a price for this code in an overlapping date range. End the current price first.", errors: [] }`; `PUT` refuses `insurance_id` and `procedure_code_id` ("prohibited"), partial otherwise; **deleting a procedure code deletes its fee rows**.
- **Built:** in-tab store deleted; rows read from the server (all pages), shown per insurance (`?insurance=`) as the prototype, client sort/15 a page; code text, description and default fee from the row's own `procedure_code`; Effective shows "no end date"; Edit (reads `GET /fee-schedules/{id}` first; code locked — server rule) and Delete with the server's messages; the overlap message shows above the form. New-row code picker offers every **active** code (was: only codes without a row — the server allows repeat prices for other dates); end date now optional (prefilled Dec 31 as the prototype; empty = no end). Price lookup matches by code id and treats no end date as open. The list re-reads on every open (`staleTime: 0`) since Procedure codes can rename a code, change its default fee or delete it with its rows. Exceptions' "Price this code" creates the payer row on the server (`useCreateFeeRow`); its error stays in the dialog.
- Verified live end to end (overlap refused, create with no end date, edit, delete; lookup); 0 overflow 1440–375. 614 tests; verify green.

### 2026-10-08 (Patients integrated; cases, coverage, authorizations still in-tab)
- **Confirmed:** `POST /patients` (the user's payload, with a nested `guarantor { first_name, last_name, relationship, date_of_birth, address { line1, city, state, zip } }`), `GET /patients?page=N` (a **summary**: id, practice_id, emr_id, names, date_of_birth, gender, gender_label, ssn masked, is_active), `GET /patients/{id}` (+ address, address_line2, city, state, zip_code, phone_home, phone_cell, email, guarantor, no_statements, notes, practice, `cases: [{ id, name, is_active }]`), `PUT`, `DELETE`; writes `{ success, message, data: null }` — **no new id returned**.
- **Tried on staging (made-up patients, all deleted):** required = practice, first/last name (first ≤ 35, middle ≤ 25), DOB ≤ today, gender **M/F/U** (Male/Female/Unknown), address, city, state (2 capitals), zip; SSN must be a **real** SSN (dashes optional), returned only masked, and a `PUT` with `ssn: ""` or `null` **erases it**; phones 10 digits (punctuation ok, stored as digits); emr_id integer, unique, changeable; guarantor needs first/last name + relationship (**Spouse, Parent, Legal Guardian, Other**), DOB ≤ today and address optional but an address needs all four parts; `guarantor: null` removes it; optional fields take `null`; `practice_id` prohibited on `PUT`; `PUT` partial; every new patient gets a **"Default" case** on the server.
- **Built:** patients from the server (all pages; searched/filtered/sorted on screen — the list takes no search). Roster: Patient (Billing ID = server id), Born + gender, EMR ID, Active (asks, server message). Dialog to the server's rules: gender M/F/U, EMR ID field, guarantor first/last name + relationship (server's list) + optional DOB + optional all-or-nothing address, SSN write-only (sent only when typed), phones sent as digits, server field errors on the fields (guarantor ones included), "(optional)" placeholders removed. After **create the roster stays** (no id to open the chart) with the server's message. Chart reads `GET /patients/{id}` (staleTime 0); its Profile shows the server record (SSN as the server masks it); status / delete go to the server (badge updates at once); **the cases the server names are picked up** into the in-tab store (`syncCases`), where coverage, case details, diagnoses and authorizations still live (lost on reload) until their endpoints come. Create/save are plain functions (not `useMutation`): an SSN must not sit in the mutation cache. Exceptions' phone/address/length fixes send **only the changed fields** (`updatePatientFields`); its placeholder-phone check compares digits.
- **Dropped (not in the patient list contract):** roster's Cases and Primary insurance columns and the insurance filter. **`no_statements` added** (user, 2026-10-08 — the contract carries it, although the client removed billing preferences, Q-091): a "Don’t send statements" switch in the dialog's Guarantor section (off by default), "Statements: Sent / Not sent" in the chart's Guarantor group, always sent on create and save.
- **For the backend developer:** consider list search/filter params (the roster reads every page); cases/coverage/authorizations endpoints. (Not needed — user, 2026-10-08: the new patient's id on create; staying on the roster after create is fine.)
- Verified live end to end (invalid SSN refused on the field, create, chart with the server's Default case, edit keeping the SSN, deactivate, delete); 0 overflow 1440–375. 626 tests; verify green.

### 2026-10-08 (Patient cases integrated — contract not final)
- **Given:** `POST /patient-cases` `{ patient_id, name, referring_physician_id, injury_type, injury_date, accident_state, start_of_care, discharge_date }`, `GET /patient-cases`, `GET /patient-cases/{id}`, `PUT`, `DELETE`. **The user says this is not the final cases endpoint** — a new version comes later; wired now at the user's request (2026-10-08).
- **Read/tried on staging (made-up patients, deleted with their cases):** list item `{ id, patient_id, name, referring_physician_id, icd10_codes[], injury_type, injury_type_label, injury_date, start_of_care, discharge_date, accident_state, is_active, referring_physician, insurances[], … }` (+ `patient` on detail); required = patient, name (≤ 100, unique per patient); physician must be an active one of the patient's practice; `injury_type` = `auto` (Auto Accident) / `employment` (Employment Related) / `other`; auto needs `accident_state` (Box 10b); injury date ≤ today; discharge ≥ start of care; `icd10_codes` ≤ 12, valid ICD-10-CM, no duplicates, order kept (= pointers); `is_active` taken; `patient_id` prohibited on PUT; PUT partial; **`employment_status` and `insurances` silently ignored** (insurances always `[]`); POST returns no id; Default deletable; deleting a patient deletes their cases.
- **Built:** cases from the server (all pages) merged into `usePatientRecords().cases`; the case dialog to the server's rules (name required ≤ 100; physician, primary insurance and injury date optional; accident state required for Auto Accident; injury types Employment Related / Auto Accident / Other — "Other" is the server's although the client removed it, Q-092), saves wait for the server with its messages and field errors; a new case is found by its name (unique per patient) and chosen on the chart; diagnoses add/move/remove save the whole `icd10_codes` list; **Delete case** added beside Edit case (asks first). The case's **primary/secondary insurance stays in the tab** (`caseCoverage`, beside the coverage list) until the new contract carries it. `?case=` carries a server id as a number. The chart shows a retry if the case list fails. Exceptions' case fixes (injury date, swap physician) send only those fields.
- **Dropped:** employment status (not in the contract) — from the case dialog, the case details and Exceptions' case fix.
- **Gap (pre-existing):** the ICD-10 list a diagnosis is picked from is empty in the app (no source/endpoint), so diagnoses can't be added yet outside tests; codes show without descriptions.
- Verified live (server Default case, edit with auto→state rule, duplicate name refused on the field, new case chosen, delete); 0 overflow 1440–375. 632 tests; verify green.

### 2026-10-08 (Case insurances integrated — coverage belongs to a case)
- **Given:** `POST /case-insurances` `{ case_id, insurance_id, rank, member_id, group_number, claim_number, subscriber { first_name, last_name, relationship, date_of_birth, gender }, employer { name, address { line1, city, state, zip } }, effective_date, termination_date }`, `GET` list/detail, `PUT`, `DELETE`.
- **Read/tried on staging (made-up patients, deleted):** item `{ id, case_id, insurance_id, rank, rank_label, member_id, group_number, claim_number, subscriber, patient_is_subscriber, employer, effective_date, termination_date, insurance { id, code, name, display_name, insurance_type }, authorizations[], … }`; required = case, insurance (active, of the patient's practice), rank (1 Primary / 2 Secondary / 3 Tertiary), member ID; an insurance is on a case once ("already on the case"); **Workers' Comp needs a claim number** (422 with a message, no field errors); subscriber optional (null = patient is the insured), when given first/last name required, relationship Spouse/Child/Other, DOB ≤ today, gender validated; employer optional, name required when given, address all-or-nothing; termination ≥ effective; `case_id`/`insurance_id` prohibited on PUT; PUT partial; `null` clears subscriber/employer.
- **Decision (user, 2026-10-08):** insurance lives **on the case** — the patient-level "Insurance coverage" section is gone; the case's Insurance card (`InsuranceSection`, id `insurance`, in the chart menu under the case) lists its insurances in rank order with Edit/Remove and "Add insurance". The case form lost its Primary/Secondary pickers (and the "No insurance on file" empty state); `PatientCase` no longer carries coverage ids — `primaryOf` / `coveragesOf` derive them.
- **Built:** coverage dialog to the server's rules — insurance (fixed once saved; offers the practice's active ones not on the case), rank (starts at the next free one), member ID required, group number optional (no "missing" mark: the server does not require one), claim number required for WC, effective/termination dates, subscriber first/last name + DOB + gender when not Self, employer (WC, or already set) with all-or-nothing address; saves wait for the server with its messages and field errors; removing a coverage drops the authorizations it issued (in-tab). Exceptions' subscriber fix saves the subscriber alone (first/last name, DOB; keeps relationship and gender). Authorizations stay in the tab, issued by a case insurance id (each server coverage has an `authorizations[]` — likely the next endpoint).
- Verified live (empty card, add with WC claim-number rule + spouse subscriber + employer, header names the primary, edit, remove); 0 overflow 1440–375. 639 tests; verify green.

### 2026-10-08 (Chart cards reorganized, round 2 — user feedback)
- **User request:** the card notes ("Every visit inherits …") as tooltips; Edit/Delete buttons named consistently; the chart's content still unclear at first look — group it, in tables or with distinct headings.
- **Built:** `ChartCard` lost `description`: `info` (an `InfoTip` beside the title) and `meta` (a short status: "3 of 12", the "Required by the primary insurance" tag). Groups inside a card (`CardGroup`) have a small brand-coloured capitalised heading; their fields use `KeyValue layout="rows"` (label left, value beside it, details on a quieter line under the value). Profile: Demographics | Contact & address, then Guarantor | Internal notes (2 × 2 from 768px). Case details: Referral & care | Injury. The case's Insurance is a **table** (Priority, Insurance + class/type/payer ID + flag tags, Member ID + group, Claim number, In effect, Subscriber, Employer — only when a coverage has one — and icon Edit/Delete); the Diagnoses snapshot notice moved into its tooltip.
- **Naming rule (now in `frontend/CLAUDE.md`):** card/page buttons = verb + object ("Edit patient", "Edit case", "Delete case", "Add insurance"); row actions = icon buttons with the plain verb as tooltip; every "Remove" became "Delete" (insurance, diagnosis: confirm titles/buttons, toasts).
- Checked with a made-up patient at 1440 and 375 (deleted after); 639 tests; verify green.

### 2026-10-09 (Chart cards, round 3 — groups as tables)
- **User feedback:** the cards' spacing and sizing made their content look ungrouped and cluttered (what belongs to what took effort); the insurance table was fine.
- **Cause found:** labels and a value's detail lines were the same size and grey, so "42 years", "Shown masked" read as extra rows and the rhythm was uneven; the group headings were smaller than the text under them.
- **Built:** each group is a two-column table like the insurance table — `CardGroup` heading on a rule (as a table header), `KeyValue layout="rows"` rows with a hairline under each (`py-[11px]`, as `DataTable` rows), label and value on one baseline; groups spaced apart (`gap-y-7`), no dividers between them. Dropped the explanatory details "Shown masked" and "The sync key"; the age sits on the birth-date line; an address is one value on two lines (ink, not grey). Internal notes on the same rules. Here row lines are the user's own suggestion (tables), not added boxes.
- Checked at 1440 and 375 with a made-up patient (deleted); 639 tests; verify green.

### 2026-10-09 (Chart page compressed — user chose "Keep one page, compress it")
- **User feedback:** the page still felt cluttered and unorganized. Full-page look: six equal cards stacked (~2,480px at 1440), three primary "Add" buttons, illustrated empty states. Offered: one section at a time / tabs / keep one page compressed — **user chose keep one page, compressed** (2026-10-09).
- **Built:** "Add insurance / diagnosis / authorization" are secondary buttons (no blue button competes on the chart); empty cards say so in one line (`CardEmpty`: "No … . What to do."); Profile in three columns where the card is wide enough (Demographics | Contact & address + Internal notes | Guarantor), else two, else one — by the card's width (`@container`), not the screen's; field rows tighter (`py-2`, label 8rem); Diagnoses beside Authorizations (2 : 3) where the case column has room; the case block (heading, its cards and Visits) hangs off a left rule from 768px so it reads as the case's; card actions drop to their own line when the title and its status need the room.
- 1440 page ~1,950px (was ~2,480). Checked 1440/1280/768/375 with a made-up patient (deleted). The Visits card shows its load-failed state because no visits endpoint exists yet (by design, no mock data). 639 tests; verify green.

### 2026-10-09 (Chart cards: header band; Profile balanced)
- **User feedback (with a screenshot):** the Profile's three columns looked unbalanced (a short Guarantor column, the notes under Contact); the cards blended together — you could not tell where a section starts and ends.
- **Built:** `ChartCard`'s title now sits on a header band (`bg-paper`, a structural rule under it, title semibold), so each card starts at its band and ends at its edge — this replaces the 2026-10-02 "no rule under the headings" look. Profile back to **two by two with the rows lined up** (Demographics | Contact & address, then Guarantor | Internal notes) where the card is wide enough, one column on a phone. The Diagnoses card is titled "Diagnoses" (as the menu; "ICD-10" moved into its tooltip) so its band matches Authorizations beside it. A card's actions wrap below its title only when the title and its status need the room.
- Checked at 1440 and 375 with a made-up patient (deleted); 639 tests; verify green.
- **Fix (user, 2026-10-09):** the menu lit Visits after jumping to Diagnoses or Authorizations — side by side near the page's end, the page cannot scroll them to the top, and the scroll spy marks the last part at the end. Now a jump from the menu marks the part asked for (`scrollToSection` says so to `useScrollSpy`) until the reader scrolls, types or clicks; checked live at 1440 and 375 (temporary patient deleted).
- **Fix, round 2 (user, 2026-10-09):** a first try left room after the last part so every part could reach the top — the user rejected the blank space it left and asked for **Diagnoses and Authorizations stacked, each its own row** (no side by side). Now: stacked; no end room; the spy's reading line sits at `offset` and, over the last stretch of scrolling (a screen, or the whole page when shorter), slides down to the bottom of the screen, so the parts sharing the last screen are each marked in turn and Visits only at the very end (the "at the end → last part" rule is gone). A jump from the menu stays marked through its own smooth scroll and the reader's small scrolls, until they scroll 160px (`KEEP_JUMP`) on their own. Checked live at 1440 and 375: every menu jump + a small scroll keeps the part asked for; scrolling down reads Profile > Case details > Insurance > Diagnoses > Authorizations > Visits.

### 2026-10-09 (Authorizations integrated)
- **Given:** `POST /authorizations` `{ case_insurance_id, number, start_date, end_date, authorized_qty, unit }`, `GET /authorizations`, `GET /authorizations/{id}`, `PUT`, `DELETE`.
- **Read/tried on staging (made-up patient, deleted with everything it had):** item `{ id, case_insurance_id, number, start_date, end_date, authorized_qty, used_qty, remaining_qty, unit, is_usable_today, insurance { id, display_name, rank }, created_at, updated_at }` — **no case id** (the case is the case insurance's). Required = case insurance (existing), number (≤ 50; unique per case insurance — "This authorization number is already on this insurance."; case-sensitive, trimmed), start and end date (end ≥ start), authorized_qty (integer 1–9999). `unit` = `visits` | `units` (lowercase only), `visits` when omitted. `used_qty` refused ("maintained from visits"). `case_insurance_id` prohibited on PUT; PUT partial; a PUT that breaks the date order → `{ success: false, message, errors: [] }` (no field). DELETE → message; 404 after. **Deleting a case insurance deletes its authorizations** (cascade).
- **Built:** in-tab authorizations removed — `usePatientRecords().authorizations` now reads the server (all pages) and gives each its case through its coverage (no coverage listed → not shown). Authorizations card: Authorization #, Issued by (server's insurance name + the coverage's priority), Active dates, Approved (qty + unit), Used / Remaining (the server's counts), Status (prototype's labels from dates + remaining; "Last unit" for units), and **Edit** + Delete icon actions (Edit is new: PUT exists). Dialog to the server's rules (number ≤ 50, qty 1–9999, end ≥ start, unit Visits/Units), insurance fixed once saved, saves wait for the server with its field errors on the fields and other refusals above the form. Delete asks, then shows the server's message or refusal. **Dropped:** the prototype's client-side "used authorizations cannot be deleted" guard — that is the server's to say. Coverage, case and patient deletes now refresh the authorizations (server cascade); the in-tab `forgetCoverage` / `forgetCase` / `forgetPatient` are gone. Visits' new-visit picker and labels read the server's authorizations through the same source.
- **Verified with visits wired (2026-10-09):** the server refuses deleting an authorization visits have used — "This authorization has already been used by visits and cannot be deleted." — and the app shows that message. No client guard needed.
- **Not used:** `is_usable_today`, `insurance.rank`, the detail `GET /authorizations/{id}` (edit uses the list's record, as coverages do).
- Verified live at 1440 and 375 (add with the server's message, duplicate number refused on the field, edit to 10 units with the insurance locked, delete with the server's message). 646 tests; verify green.

### 2026-10-09 (Visits integrated)
- **Given:** `POST /visits` `{ case_id, date_of_service, location_id, billing_provider_id, treating_provider_id, authorization_id, charge_lines: [{ procedure_code_id, units, modifiers?, diagnosis_pointers? }] }`, `GET /visits`, `GET /visits/{id}`, `PUT /visits/{id}`, `DELETE /visits/{id}`, `POST /visits/{id}/release`.
- **Read/tried on staging (made-up patients, deleted with all they had):** list item `{ id, case_id, date_of_service, status, pend_reason, source, emr_record_id, diagnosis_codes, location_id, billing_provider_id, treating_provider_id, authorization_id, total_amount, released_at, patient { id, first_name, last_name, date_of_birth }, case { id, name, insurances }, location { id, name, place_of_service }, treating_provider { id, name, npi }, charge_lines [{ id, visit_id, procedure_code_id, units, amount, modifiers, diagnosis_pointers, place_of_service, notes }] }`; detail adds `billing_provider`, `authorization`, each line's `procedure_code { id, code, description }`, `claims`. Writes `{ success, message, data: null }` (no new id); release answers `{ message, data: visit }`.
- **Rules seen:** status `review` on create → `POST /release` → `released` (released_at set; the authorization is used then — an in-force one with enough left is picked by the server even when the visit names none) or `pended` with `pend_reason` (e.g. "Corvel Enterprise requires authorization: no authorization in force on 2026-06-20 has enough remaining.", also the release's message, success true). A save of a pended visit puts it back in review. **Released = frozen:** PUT, release, DELETE refused ("This visit has already been released and can no longer change."). Required: case, date (≤ today; **one visit per case per date**), location (active, of the patient's practice), both providers (active, of the practice), ≥ 1 line: active procedure code, units 1–99, ≤ 4 modifiers of 2 letters/digits (server capitalises; a code with modifier override gets its own modifiers), ≤ 4 distinct pointers within the visit's diagnoses (out of range → message, no field); no pointers → `[1]`. Authorization must belong to one of the case's insurances. PUT: `case_id` and `charge_lines` prohibited; partial. Amount = fee schedule × units; place of service = location's. `diagnosis_codes` = the case's codes copied at creation. A line's `notes` / `place_of_service` are accepted on create (not in the contract's example) — **used, at the user's request (2026-10-09)**: place of service exactly 2 digits (`00`–`99`; empty or null refused → left out when empty, then the location's), notes ≤ 1000 (trimmed, empty = none); create only (PUT refuses lines). New visit's lines have Place of service (info: Box 24B) and Notes; the visit page shows a line's note under its procedure. Deleting a patient deletes their visits (released too).
- **Built:** live api (all pages; detail; create/update/delete/release with the server's messages; line field errors mapped `charge_lines.N.x` → `lines.N.x`). Visits list: + Total and Status (In review / Pended / Released); names from the visit itself. Visit page reads `GET /visits/{id}`: status badge, the pend reason as a notice, details (+ place of service, providers' NPI, total, released date, source), lines (+ place of service, amount; pointers name the visit's own `diagnosis_codes`), and — until released — **Release visit**, **Edit visit** (date, location, providers, authorization) and **Delete visit**. New visit: ids are the server's (procedure codes by id), units 1–99, modifier/pointer limits; after create the dialog closes with the server's message (no id to open). Chart's Visits card: status and total per visit; one-line empty state. Visit writes refresh the authorizations (used counts). **Removed:** "Add charge line" on a visit and its dialog — no endpoint, PUT refuses lines. Claims (still unconnected) adapted to procedure-code ids and the visit's diagnosis copy.
- Verified live at 1440 (and 375 for the list and visit): create from the chart with two lines, duplicate date refused on the field, release pended with the reason, edit into the authorization's range, release → Released (actions gone), list totals/status, delete with the server's message. 655 tests; verify green.

### 2026-10-09 (Charge lines integrated)
- **Given:** `POST /charge-lines` `{ visit_id, procedure_code_id, units, modifiers, diagnosis_pointers }`, `GET /charge-lines`, `GET /charge-lines/{id}`, `PUT /charge-lines/{id}`, `DELETE /charge-lines/{id}`.
- **Read/tried on staging (made-up patients, deleted):** item `{ id, visit_id, procedure_code_id, procedure_code { id, code, description }, units, amount, modifiers, diagnosis_pointers, place_of_service, notes, created_at, updated_at }` (the same as a visit read on its own carries). Required = visit, procedure code (active); the line rules are a visit's line's: units 1–99, ≤ 4 modifiers of 2 letters/digits, ≤ 4 distinct pointers within the visit's `diagnosis_codes` (out of range → message, no field), `diagnosis_pointers` may not be null, `place_of_service` 2 digits (left out → location's), `notes` ≤ 1000. PUT partial, `visit_id` prohibited, the code may change. The server reprices the line and the visit's total follows. A visit may lose its last line (its release then pends: "Add at least one charge line."). Lines of a pended visit can change (it stays pended); **a released visit's lines are frozen** ("This visit has been released; its charge lines can no longer change.").
- **Built:** `api/charge-lines-api.ts` (create / update / delete, the server's messages, field errors `modifiers.0` → `modifiers`, `diagnosis_pointers.N` → `diagnosisPointers`); the visit page's Charge lines get **Add charge line** and per-row **Edit** / **Delete** icons (named "Edit charge line 2 (98110)" — two lines may share a code) until the visit is released; one `ChargeLineDialog` for add and edit (pointers name the visit's own diagnoses; a saved line keeps its own code even if no longer active); a save sends every field — the lists even when empty, a cleared note as `null` — and leaves out an empty place of service (the line keeps its own). Visit queries are read again after a line changes (totals). **Not used:** `GET /charge-lines` and `GET /charge-lines/{id}` — the visit page reads the same lines with its visit.
- Verified live at 1440 (add 3 units with a note → total $150; edit to 1 unit, POS 12, note cleared → $90; delete a line → $30). 661 tests; verify green.

### 2026-10-09 (Claims integrated — a claim bills a whole visit)
- **Given:** `POST /claims` `{ visit_id, procedure_code_id, units, modifiers, diagnosis_pointers }`, `GET /claims`, `GET /claims/{id}`, `PUT /claims/{id}`, `DELETE /claims/{id}`.
- **Read/tried on staging (made-up patient):** item `{ id, visit_id, case_insurance_id, referring_physician_id, format, status, scrub_errors, allowed_status_changes, total_amount, sent_date, clearinghouse_ref, insurance { id, display_name, rank, rank_label, member_id }, patient { id, first_name, last_name }, date_of_service, charge_lines (null in the list) }`; detail adds the visit's `charge_lines` and `referring_physician`. POST answers `{ success, message: "Claim created and scrubbed", data: claim }`.
- **The server's model differs from the payload example:** a claim bills **the whole visit (all its lines) to one case insurance** — only `visit_id` is required; `procedure_code_id`, `units`, `modifiers`, `diagnosis_pointers` are ignored (total = the visit's); `case_insurance_id` (accepted, not in the example) picks the insurance, the primary when left out. **Decision:** send `{ visit_id, case_insurance_id }` only; reported to the user.
- **Rules seen:** only a released visit can be billed ("Only a released visit can be billed. Release it from Charge Review first."); one claim per visit per insurance ("This visit already has a claim for that insurance."); the secondary only once the primary's claim is paid or denied ("Bill the primary insurance first; …"). New claim is scrubbed at once: `held` (Corvel — on insurance hold) or `scrubbed`. Status held → scrubbed → sent (server stamps `sent_date`) → paid | denied | rejected; never back ("A scrubbed claim cannot be moved to held."); `allowed_status_changes` lists the next ones. PUT: `status`, `format` (837P | CMS1500; "The format of a claim that was already sent cannot change."), `clearinghouse_ref` (null clears); `visit_id`, `case_insurance_id` prohibited; `referring_physician_id`, `sent_date`, `units` accepted but ignored. DELETE: held/scrubbed yes; "A claim that was sent cannot be deleted."
- **Built:** live api (all pages; create/update/delete with the server's messages). Claims list: Patient, Date of service, Insurance (+ priority), Format, Total, Status (+ scrub-error count), Sent (+ reference); row opens the visit; search by patient, insurance or reference. Visit page's Claims: one row per claim (insurance, format, total, status with scrub errors, sent + ref), **Create claim** when the visit is released and a case insurance is unbilled ("Bill to" picker, by priority), **Edit** (status to the allowed next, format until sent, clearinghouse ref; only changed fields sent), **Delete** while held/scrubbed; before release: "Release the visit first". Visits' public surface trimmed (Claims no longer uses the line helpers).
- **Backend issue to report:** `DELETE /patients/{id}` for a patient with sent claims → **500 Server Error** (should refuse with a message). So the made-up patient **Nadia Uishot (id 31) stays on staging** with released visits 27–30 and claims 1 (rejected), 4 (paid), 6 (sent) — sent claims and released visits cannot be deleted.
- **Not used:** `GET /claims/{id}` (its lines are the visit's, shown on the visit page), `referring_physician`.
- Verified live at 1440 (unreleased → "release first"; create → Held with the server's message; held → scrubbed → sent with a reference; delete gone once sent; list). 667 tests; verify green.

### 2026-10-09 (Visit page on the chart's cards)
- **User request:** the visit page (`/visits/{id}`) should use the patient chart's card/table look.
- **Built:** the chart's card moved to the UI kit as `DetailCard` (+ `CardGroup`, `CardEmpty`) in `src/components/ui/DetailCard.tsx`, documented in `frontend/docs/UI_KIT.md`; the chart keeps `ChartCard`, a thin wrapper adding its jump-scroll margin. Visit page: **Visit details** card with three groups (Visit: patient, case, date of service, source | Location & providers: location + place of service, billing and treating provider + NPI | Billing: total, authorization + its dates, released) — three columns where the card is wide enough, else two, else one; **Charge lines** card (meta "N lines", Add charge line, the table); **Claims** card (info: one claim per insurance, each for the whole visit; Create claim). Empty cards say so in one line. Checked at 1440 and 375 on visit 30 (no overflow); 667 tests; verify green.

### 2026-10-12 (Contract re-check of every integrated endpoint — no changes found)
- **User request:** re-test every integrated endpoint for changes in methods, payloads or responses; list what is still not integrated.
- **How:** a temporary Vitest file (deleted after) signed in with the app's own `signIn`, read every list and detail through the app's own api functions and zod schemas (a changed or missing field would fail as `contract`), and created / updated / deleted throwaway records with the app's own payload types for every resource, patient → case → case insurance → authorization → visit → charge line → release → claim included; then deleted all of it (staging back as before). Separately, every list item's and detail's raw keys were compared with what the app's code knows: no new, missing or renamed field on any of the 19 resources.
- **Result:** 92 calls — all as expected. Auth: login, me, logout fine; change-password with a wrong current password → 400 "Current password is incorrect"; send-otp to an unknown email → success with "If this email is registered, a reset code has been sent to it." (deliberately vague); verify-otp / reset with a wrong code → 400 "The reset code is invalid or has expired.". The one failure was the check's own: `POST /practices` without `locations` → 422 "The locations field is required." — the app always sends the first location, and with it create / read / save / delete work.
- **Not integrated (no endpoint on staging — every route 404):** Billing exceptions (contract given 2026-10-12, routes not deployed: `/billing-exceptions`, `/grouped`, `/scan`, `/{id}/reprocess`, `/{id}`), Coding rules, Roles & permissions, Submission & automation settings, EMR integration (requests, location election, incomplete profiles), the ICD-10 code list (diagnoses cannot be added in the app). Also not built against a server: user ↔ role / practice grants (Users carries name, email, password, active only).

### 2026-10-19 (Sessions that end by themselves; one's own account in Users)
- **User report:** saving a new password on their own row in Admin → Users showed the success toast, then a screen whose "Try again" could not work; a refresh logged them out.
- **Seen on staging (throwaway users, deleted):** the account menu's Change password keeps the current session and signs out the user's **other** sessions; setting a password in `PUT /users/{id}` (one's own included) **ends every session of that user**; a name change does nothing; an email change keeps sessions (sign in with the new email after); deactivating (one's own included — the server allows it) ends their sessions and they cannot sign in; deleting ends them; deleting oneself is refused ("You cannot delete your own account."). Sign-in is rate limited: 429 "Too Many Attempts.".
- **Built (user's choice: no pointer away from the password field; server messages untouched):** `lib/auth/session.ts` tells `onSessionEnd` listeners why a session ended by itself — `rejected` (a refused request: http client on 401), `elsewhere` (another tab signed out), `password-changed` (announced with `expectSessionEnd` before saving one's own password, so the refusals that follow read as that); this tab's own sign-out stays silent. `useSessionEndRedirect` (auth, used by the `_app` layout) clears the query cache and goes to `/login?redirect=<here>&ended=<reason>`; the guard sends a refused restored session there with `ended=rejected`. The sign-in page says why: "Your session has ended. Please sign in again." / "You were signed out in another tab. Please sign in again." / "Your password was changed. Sign in with your new password.". Users: one's own Active switch is disabled (list, via `activeColumn`'s new `disabled`, and the form, with an info note); typing a new password for oneself shows a warning ("…signs you out everywhere, this browser included…"), and the save then goes to sign-in; saving one's own row re-reads who is signed in (account menu); a new email of one's own adds "Sign in with your new email next time." beside the server's message.
- Verified live with a throwaway user: own switch disabled; warning; save → sign-in with the password notice; signed in with the new password → back on Users; deactivated by an admin → the next step lands on sign-in with "Your session has ended". 676 tests; verify green.

### 2026-10-19 (Frontend dockerized for DevOps)
- **User request:** dockerize the frontend to hand over for deployment.
- **Built:** `frontend/Dockerfile` (multi-stage: `node:24-alpine` → `npm ci` + build, source maps deleted; served by `nginxinc/nginx-unprivileged:1.29-alpine`, non-root, port 8080, `HEALTHCHECK` on `/healthz`), `frontend/.dockerignore` (no `node_modules`, `dist`, `.env*`, docs). **One image for every environment:** the container's `docker/40-app-config.sh` (run by the nginx entrypoint) reads `API_BASE_URL` (required; http/https) and `APP_ENVIRONMENT` (development | staging | production, default production), writes `/config.js` (`window.__APP_CONFIG__`) and the nginx config, and stops with a clear message (exit 2) when a value is missing or malformed. `lib/config/env.ts` reads `window.__APP_CONFIG__` first, else the build's `VITE_*` (dev, tests); `index.html` loads `/config.js` (a same-origin script, so a strict CSP holds; `public/config.js` is an empty stand-in for `npm run dev`). nginx (`docker/default.conf.template`): SPA fallback to `index.html` (`no-cache`), `/assets/*` `max-age=31536000, immutable` and 404 when missing, `*.map` 404, `/config.js` `no-store`, gzip; security headers on every answer (`docker/security-headers.conf.template`): CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (style attributes), `connect-src 'self' <API origin>`, `frame-ancestors 'none'`…, nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy`. TLS + HSTS left to the ingress. `.gitattributes`: LF for `*.sh`, `frontend/docker/**`, `frontend/Dockerfile`. Handover doc: `frontend/docs/DEPLOYMENT.md`.
- Verified: image builds (84 MB); headers, caching, deep link, 404s, non-root checked with curl; a real sign-in → Patients → Users → sign-out through the container against staging with no console errors or CSP reports. 676 tests; verify green.

### 2026-10-19 (Pushing to a second repo: Billing-FE)
- **User request:** push in parallel to https://github.com/Adam-mohamed-dev/Billing-FE, always, with no sign of Claude there either.
- **Decisions (user, 2026-10-19):** Billing-FE gets **only `frontend/`** at its root (its history filtered to frontend changes — `git subtree`); `frontend/CLAUDE.md` and its mentions stay (only commits and contributors must be clean — they are: every commit by Adam-mohamed-dev, no co-author or tool lines).
- **Set up (local git config, this checkout):** remote `billing-fe` = `https://Adam-mohamed-dev@github.com/Adam-mohamed-dev/Billing-FE.git`; `origin` now names its account too (`https://Abdelrahman-Mohamd@github.com/…/EMR-Billing.git`) — two GitHub accounts are stored and Adam-mohamed-dev cannot push to EMR-Billing (403). Alias `git push-both` = `git push origin main && git subtree push --prefix=frontend billing-fe main`. `frontend/.gitattributes` added so the container files keep LF in the frontend-only repo.
- First push: Billing-FE `main` = 9 commits, all by Adam-mohamed-dev.

### 2026-10-19 (Environment settings out of the repos — history rewritten)
- **User ruling:** `.env` must not be pushed and the real values (the staging API address) must not be exposed in the repos: "the devops will fill them, this is supposed to be normal".
- **Done:** `frontend/.env` untracked and ignored (`.env` and `.env.*`, `.env.example` kept); `.env.example` holds empty placeholders (`VITE_API_BASE_URL=`, `VITE_ENVIRONMENT=development`); every tracked mention of the staging host replaced — tests and docs use `https://api.example.test/api/v1`; README: copy `.env.example` to `.env` and fill it in. The local `.env` stays on this machine for `npm run dev`.
- **History rewritten (user chose it):** `git filter-branch` on `main` removed `frontend/.env` from every commit and replaced the staging host in every text file of every commit (authors, committers and dates kept; the tip's files unchanged). Force-pushed (with lease) to EMR-Billing (`main` 8233fc5) and, re-split, to Billing-FE (`main` 6d6f89d). Checked: no commit on either has the address or `.env`. A bundle of the old history is kept locally in the session scratchpad. Any other clone must be re-cloned; GitHub may still serve the old commits by id until its caches expire (GitHub Support can purge).

### 2026-10-20 (Staging update integrated: case diagnoses, visit diagnoses, coding rules, billing exceptions, list parameters)
- **User request:** integrate `POST /case-diagnoses` `{ case_id, icd10_code, description }`; deduce the coding-rules contract ("i dont have it"); check that every list uses the parameters it has; fix the endpoints to the update and integrate the new ones.
- **Case diagnoses (`/case-diagnoses`, live):** the case now lists `diagnoses: [{ id, case_id, icd10_code, description }]` (`icd10_codes` is gone, and a case save no longer carries diagnoses). POST `{ case_id, icd10_code, description? }`, PUT (`case_id` refused; partial), DELETE; messages "Case diagnosis created/updated/deleted successfully". The server validates the code ("The diagnosis must be a valid ICD-10-CM code, e.g. M54.2.") and capitals it, refuses a duplicate on `icd10_code` ("This diagnosis is already on the case.") and a 13th with no field ("A case can have at most 12 diagnosis codes."); description ≤ 255. **No position field:** the order is the order added, so the chart's move up/down was dropped (edit and delete per row instead). The Add/Edit diagnosis dialog takes a typed code + description (the in-tab ICD-10 pick list, always empty, is gone — `patient-records-store` keeps nothing in the tab now).
- **Visits:** `diagnosis_codes` sent on POST and PUT (≤ 12, distinct, valid ICD-10-CM; `diagnosis_codes.N` errors land on the field). A new visit starts with its case's codes; New/Edit visit have a Diagnoses multi-select (order chosen = pointer); a new visit's line pointers follow it. The visit page shows "Diagnoses 1 · M54.2, …". **Charge lines** carry `coding_rule_id` and `original_procedure_code_id` (ids only): the line shows "Replaced 97014 by a coding rule".
- **Coding rules (`/coding-rules`, deduced on staging with throwaway rules):** fields `practice_id` (required, prohibited on PUT), `action` replace|drop (required), `procedure_code_id` (required), `replacement_code_id` (required for replace, not itself; cleared for drop), `insurance_id` (none = default rule `scope: default`, else `scope: payer`; must be the practice's), `notes` ≤ 1000, `is_active`; the response adds `insurance{name}`, `procedure_code`, `replacement_code`, `summary`. One default rule and one per payer per code ("There is already a default rule for this code." / "This payer already has a rule for this code."). **No class rules** (`insurance_class_id` ignored) → the screen's class scope was dropped. Rules apply **at release** (even when it pends): payer rule over default; replace changes the line's code and re-prices it, drop deletes the line. The screen is wired (list by practice, create, save, switch, delete, server errors on fields); Test the rules keeps the server's precedence.
- **Billing exceptions (`/billing-exceptions`, live):** the Exceptions screen is the server's queue — type pills (Patient/Case/Charge) then reason pills with the grouped counts, the list filtered by the server (`practice_id`, `type`, `reason`; in the URL), Resolve (the prototype's fix forms, mapped by reason; after the save the server re-checks the record via reprocess — answers "Fixed: the exception is cleared" / "The problem is still there; …" / 404 = already cleared by the save), Open case / Open visit for reasons with no form (no primary insurance, employer, no diagnosis), Re-check, Delete (asks; it comes back while the problem remains) and Scan practice (counts in the toast). **Dropped (no server data):** the Resolved list, owner/due, Payment level, Incomplete profiles; routes `/exceptions/resolved` and `/exceptions/incomplete` removed; `?level=` became `?type=&reason=`.
- **List parameters (probed on every list):** `per_page` is capped at 100 → every list read whole now asks for `per_page=100` (`lib/api/pagination.ts`); the paged screens (Organizations, Users, Audit log) keep 15. Server filters now used: the chart's case visits (`case_id`), a visit's claims (`visit_id`), coding rules (`practice_id`), billing exceptions (`practice_id`, `type`, `reason`), and the audit log's new **module filter** (`log_name`, one at a time — the prototype's module pills became a select). Available but not used, with the reason: `search` on patients (PHI never goes in a URL), on organizations/users (the prototype has no search there); practice/status/active filters on lists also read whole for lookups elsewhere (filtering them server-side would add requests, not remove any). Audit also takes `causer_id`, `subject_type`, `subject_id`, `event`, `date_from`, `date_to`; visits `practice_id`, `patient_id`, `status`, `location_id`, `date_from`, `date_to`; claims `insurance_id`, `case_insurance_id`, `status` (not practice/patient).
- **Backend issues to raise:** a coding-rule save moved a payer rule to the default while the code already had a (switched-off) default rule — accepted (create refuses the same); case diagnoses have no order field; `search` is ignored on visits, claims, coding rules and billing exceptions; claims ignore line fields; deleting a patient with sent claims answers 500; reprocess ignores `practice_id`.
- Verified live on staging (throwaway diagnosis, rule, procedure code 97014 and visit — all deleted; one deleted exception restored by a scan). 695 tests; verify green.

### 2026-10-20 (Exceptions filters, View hints, server search, claim format)
- **User requests:** a better UI/UX for the Exceptions filter pills; a "View" hint on every table whose rows open, as on Patients; use the server's `search` where it was left unused; match the claims payload to the backend — no stale options.
- **Exceptions filters:** the two levels now use different devices — the type as a tab strip (All · Patient · Case · Charge, each a URL with the server's count; "Show all types" gone), and under it, once a type is chosen, its reasons as one-choice chips headed "Reason", "All reasons" first (`ChoicePills` in `components/ui/FilterPills.tsx`: a radio group, arrow keys move the choice).
- **View hints (`openHint`):** Visits and Claims ("View visit"), Audit log ("View details") — every table with clickable rows now says so at the row's end, like Patients' "View chart".
- **Server search:** Patients (`search`, debounced 300 ms — `lib/hooks/use-debounced-value.ts`; the client-side roster search is gone), Organizations and Users (new search boxes on these server-paged screens; page 1 on each search; "No … match" with Clear search). Staging matches: patients — part of a first or last name, a whole Billing ID or EMR ID, **not a full name** ("Nadia Uishot") or part of an ID; organizations — part of the name; users — part of the name or email. The patient search term goes to the API only (docs/SECURITY.md §8: the backend must keep query strings out of its logs). Visits and claims keep searching in the browser: the server ignores `search` there.
- **Claims:** re-probed — `POST /claims` takes `{ visit_id (required), case_insurance_id, format }` (`format` 837P | CMS1500, stored; 837P when left out); nothing of the contract's line fields. Create claim now offers Format (837P by default) and sends it; the edit's clearinghouse reference is capped at the server's 50.
- Verified live on staging (search requests, tabs/chips, hints; one claim created with CMS1500 and deleted). 700 tests; verify green.

### 2026-10-20 (No ordering or search in the browser; Coding rules empty state)
- **User ruling:** "i do not want us doing ordering or search from the client side".
- **Probed on staging:** no list takes a sort parameter (sort, sort_by/sort_direction, order_by/direction, sort=-field, … — the order never changes); visits, claims, billing exceptions, coding rules, fee schedules and the audit log take no search (search, q, query, keyword, term, …). Server orders: newest first for visits, claims, exceptions, audit; by id elsewhere.
- **Done:** every table shows the server's order — sortable headers and `.sort` removed on Patients, Visits, Claims, Exceptions, Procedure codes, Providers, Referring physicians, Insurances, Insurance classes, Release buckets, Fee schedules; also the chart's case visits, authorizations and coverages, Create claim's insurances (the default is the lowest rank, picked, not sorted), New visit's case options, the coding-rule code options and the rule tester's chips (read off the list). Visits and Claims lost their search boxes (the server cannot search them). The Visits practice filter now goes to the server (`practice_id`). Kept: type-to-filter inside a dropdown picker (Combobox, over options already loaded) and the EMR integration screen's in-tab log order (no backend exists for it).
- **Coding rules empty state:** the header says when rules run ("…when it is released. A payer's rule overrides the default rule."); the empty state names the practice, says what a rule is in one line and offers New rule (or "Add a procedure code" when there are none); the stray note under the list became the table footer when there are rules ("3 rules · active rules change a visit's charge lines when it is released"); Test the rules is disabled until there is a rule; GitBranch icon (as in the menu).
- **For the backend:** sorting (e.g. `sort`/`direction`) on the lists, and `search` on visits and claims, if the screens should offer them. 701 tests; verify green.

### 2026-10-22 (Backend update rechecked: coding rules per insurance + preview; claim references and re-scrub)
- **User request:** recheck the endpoints after a backend deploy; coding rules "working fine now" with `GET /coding-rules/preview`, POST/GET/PUT/DELETE — use them; cover any other endpoint change.
- **Coding rules:** every rule now **must belong to an insurance** ("A coding rule must belong to an insurance." on `insurance_id`, create and save) — no default rules. `GET /coding-rules/preview?practice_id&insurance_id&procedure_code_id` (all required) → `{ message, data }`: the acting rule (message = its summary, "Drop 97014 for Corvel Enterprise") or `null` ("No rule applies: the code is billed as entered"); a switched-off rule does not act. Built: Applies to = the practice's insurances only (required, "Select the insurance it applies to."); "Test the rules" now asks the preview per code (no client-side precedence — `ruleFor` removed) and shows the server's words; header copy updated. A legacy `scope: default` rule is still read ("Default (all payers)") and must be given an insurance when saved.
- **Claims:** new server-set fields `patient_control_number` ("C6"), `payer_claim_number`, `clearinghouse_batch_id`, `clearinghouse_status` (a save ignores them) → a "Claim #" column (control #, payer # under it) on Claims and the visit's Claims card; clearinghouse status/batch under Sent. New status `failed` ("Failed scrub", with `scrub_errors`). New `POST /claims/{id}/scrub` → `{ message: "Claim scrubbed", data: claim }` (a sent claim: 422 "A sent claim cannot be scrubbed again.") → a "Scrub again" row action (held/scrubbed/failed); a failed claim can be deleted. No other endpoint changed fields or required fields; no new routes found.
- **Incident:** a route sweep sent `POST /visits/26/release` to Ahmed's real visit 26 — it pended (status `pended`, unchanged lines); the API cannot set it back to review. Lesson: never sweep action names on real records.
- Verified live (throwaway codes 97014/97012 and rules, a claim on visit 29 — all deleted). 701 tests; verify green.

### 2026-10-22 (One card style; Submission & automation redesigned; our own time field)
- **Cards:** Practices & locations (Billing details in groups, Locations with its count and Add location), Fee schedules (Price lookup, "A fee schedule needs"), EMR integration (Locations, Payload log) and Submission & automation now use the record-page card (`DetailCard`, as Visit details and the patient chart). The legend of a `Field asFieldset` got the field's 8px gap (it sat higher than its neighbours).
- **Submission & automation (user: too empty, the options modal awkward):** two cards — Scheduled submission (Off and each schedule as radios, In use marked, Delete on the others after asking; "Add a schedule" in one row; Save settings at the foot, enabled once changed, "The choice is not saved yet.") and In effect (what is saved, how released charges go, last run; first on a phone). The "Scheduled submission options" dialog was removed; "Remove" became "Delete". Still frontend-only.
- **Time field (`components/ui/TimeInput.tsx`), after three rejected tries** (a three-column popup, inline hour/minute/AM-PM dropdowns, one dropdown of 15-minute times — the last could not take an unlisted time): **the time typed in a box ("6:07"; also "607", "6", or 24-hour "18:07", which sets PM itself) and AM / PM picked from a small dropdown beside it**. Value stays 24-hour "HH:MM"; schedule names read on the 12-hour clock ("Every day at 6:07 PM"). `Field` gained `FieldPart` (a second control in a field names itself). Our dropdowns now open scrolled to the selected option and keep the highlighted one in view.
- 708 tests; verify green.
