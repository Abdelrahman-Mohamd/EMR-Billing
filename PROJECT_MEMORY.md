# PROJECT_MEMORY — Billing System (EMR Billing / RCM)

> Long-term development memory. Read this before any significant architectural or implementation decision.
> **Primary source: `Billing System PRD v2.docx`** (25 pages; title block *Version 2.0 · Draft*). `Billing System PRD v1.docx` is kept only for comparison — see `PRD_V1_TO_V2_CHANGELOG.md`.
> PRD sections are cited `§x.y`, pages `pN` (PRD V2 as Word paginates it). Change IDs `CH-xx` point into the change log.

**Source-of-truth hierarchy** (highest wins):
1. Explicit current requirements / confirmed product decisions
2. Actual implemented code and architecture
3. PRD V2
4. This file
5. AI assumptions

**Maintenance rules:** update on every important decision, feature-status change, requirement change or resolved question. If code contradicts this file, inspect the code and fix the file. Remove obsolete content; do not paste PRD text or source code here. Never resolve an ambiguity silently — log it as a question in `PRD_CLARIFICATION_QUESTIONS.md` and reference it here, or record an assumption in §21.

**Legend**
- ✅ **Confirmed** — explicitly stated in PRD V2
- 🔎 **Inferred** — reasonably inferred from PRD V2, not stated outright
- ⚠ **Assumption** — not specified; temporarily assumed (see §21)
- ❓ **Needs Clarification** — requires client confirmation; IDs `Q-###` / `C-###` are entries in `PRD_CLARIFICATION_QUESTIONS.md`

**ID conventions:** M = module, F = feature, BR = business rule, W = workflow, KI = known issue, A = assumption. IDs are stable: change content in place, retire rather than renumber. Since 2026-09-16 open questions use the client register's IDs only (the old internal `Q01…Q57` list is retired).

---

## 1. Project Overview

| | |
|---|---|
| **Name** | Billing System |
| **What it is** | Centralized Revenue Cycle Management (RCM) platform; "action-oriented operating system" ✅ (title page) |
| **Specialty** | Physical Therapy first; multi-specialty in scope ✅ |
| **Owner** | Business Development ✅ |
| **PRD version** | V2 (2.0 Draft). V2 changed §6.2 (manual release) and chapter 10 (data model) only; everything else is identical to V1 ✅ |
| **Repo state** | Pre-implementation. The repo holds both PRDs, `logo.png`, this file, `PRD_V1_TO_V2_CHANGELOG.md`, `PRD_CLARIFICATION_QUESTIONS.md`, `BILLING_SYSTEM_GUIDE.html`, `PROTOTYPE_COVERAGE.md` and `prototype/` (a clickable HTML/JS prototype for client validation — not the product). No git. |

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
| **System Admin** (`SYSTEM_ADMIN`, global) | ✅ seeded | All modules CRUD, every practice | Only role that sees decrypted `ssn_enc` / `portal_password_enc` ✅ |
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
| M4 | **Setup / Reference Data** [Admin] | Master data used to build claims | Providers (+ claim hold), **insurance classes (rule defaults)**, insurances (overrides, **insurance hold + bucket**, portal credentials), **release buckets**, procedure codes (**type, active**), fee schedules (billed price), referring physicians (**type DN/DQ**) | M1 | BR09–12, BR40–45 |
| M5 | **Patient & Case** [Patient] | Clinical-financial container | Patient chart, cases (Default case), ordered ICD-10 list on the case (≤12), coverage ranks 1–3, authorizations | M1, M4 | BR13–17 |
| M6 | **Ingestion & Pre-Scrub** [Charges] | Accept and clean incoming charges | Trigger, reconciliation, Inactive Records, Incomplete bucket, Billing Exceptions, Charge Review, **visit-level location and providers**, line pricing and **line place of service** | M3, M4, M5 | BR18–24, BR46–47 |
| M7 | **Queues & Submission** [Charges/Billing 🔎] | Move clean charges toward claims | Ingestion queue; single/bulk/scheduled submission; Updated-charges queue (3 actions) | M6 | BR25 |
| M8 | **Coding & Scrubbing** [Billing 🔎] | Validate and transform | Replace/Drop rules; 6-check matrix; reason holds; auto-resubmit; AI check; **routing to release buckets** | M4, M5, M7 | BR26–28, BR41–42 |
| M9 | **Claims & Clearinghouse** [Billing] | Produce, release and submit claims | Lifecycle, **release-bucket queues and release**, CMS-1500 mapping, **referrer snapshot**, 837P/PDF, Waystar, secondary/tertiary, daily batch, Rejections & Reasons | M8 | BR29–33, BR48 |
| M10 | **Payment Posting** [Payments] | Apply money and adjustments | Manual posting, ERA 835, check-batch balancing, **computed line balances** | M9 | BR34–36 |
| M11 | **Denial & A/R** [Denial Mgmt, AR Follow-up] | Chase unpaid and denied claims | Payer SLA engine, auto-escalation, Delayed/Denied, denial work queue | M9, M10 | BR37–38 |
| M12 | **Cross-cutting** | Accountability | Work-item ownership, audit history, soft deactivation (`is_active`) | all | BR39 |
| M13 | **Unspecified** | — | Dashboard, Reports & Analytics, Month End, Eligibility/Claim status, Appeals, Referrals, Statements | — | ❓ Q-001, Q-002, Q-047, Q-049–051 |

---

## 6. Feature Inventory

**Statuses:** `Planned` · `Needs Clarification` · `Blocked` · `Retired`. Nothing in the production system is implemented. (Prototype coverage: `PROTOTYPE_COVERAGE.md`.)

| ID | Module | Feature | Description (V2) | Role | Status |
|---|---|---|---|---|---|
| F01 | M1 | Practice onboarding | Legal name, DBA (opt.), billing address, Tax ID (EIN/SSN), taxonomy, Group NPI | System Admin | Needs Clarification (Q-022) |
| F02 | M1 | Location setup | ≥1 primary location; name, service address, NPI, POS (default 11) | Admins | Planned |
| F03 | M1 | Company (optional) | Parent grouping for cross-practice reports | System Admin | Needs Clarification (Q-032) |
| F04 | M2 | User accounts | Username, email, default practice, active, service-account flag | Admins | Planned |
| F05 | M2 | Authentication | Not specified in PRD | All | Needs Clarification (Q-025) |
| F06 | M2 | Roles & permissions | Per-role JSON CRUD by module; union of roles; seeded roles | Admins | Needs Clarification (C-001, C-002, C-008) |
| F07 | M2 | Practice/location scoping & switcher | Row scoping by granted practices and optional locations | All | Needs Clarification (Q-031) |
| F08 | M2 | Encrypted-field masking | SSN and portal password decrypted only for System Admin | System | Planned |
| F09 | M3 | Location linking request | Domain Admin request; 1:1 Unique Location ID | Domain Admin | Needs Clarification (Q-029) |
| F10 | M3 | Billing election | Integrated vs EMR-only; block EMR-only payloads | Domain Admin | Needs Clarification (Q-030) |
| F11 | M3 | Inbound entity sync | Sessions (with location and providers), charges, charts, cases, providers; patient match by `emr_id` | Service account | Blocked (Q-004, Q-080) |
| F12 | M4 | Provider directory | Provider ID, name, credential (optional), specialty, NPI, taxonomy, license | Admins | Planned |
| F13 | M4 | Provider claim hold | `claim_hold_until` + reason → visits Delayed | Admins | Needs Clarification (Q-062) |
| F14 | M4 | Insurance master | Class (required), insurance type, payer ID, address, **rule overrides (nullable)**, **insurance hold + release bucket**, encrypted portal credentials | Admins | Needs Clarification (Q-011, Q-081) |
| F15 | M4 | Procedure code catalog | Global CPT/HCPCS; timed flag; default modifier and fee; **procedure type; active flag** | Admins | Needs Clarification (Q-066, Q-083) |
| F16 | M4 | Fee schedule engine | **Billed price** per unit per payer, effective dates; else default fee | Admins | Needs Clarification (Q-020) |
| F17 | M4 | Referring physician directory | Code, name, **type (Referring DN / Supervising DQ)**, NPI | Admins | Needs Clarification (C-006, Q-078) |
| F18 | M5 | Patient chart | Demographics, guarantor, **SSN optional**, no-statements flag, notes (**emergency contact removed**) | Patient | Planned |
| F19 | M5 | Case management | Default case; **referring physician, diagnoses, injury type/date, accident state**, start of care, discharge (**no location, providers or discipline**) | Patient | Needs Clarification (C-014) |
| F20 | M5 | Case diagnoses | Ordered ICD-10 list on the case, ≤12, position = pointer | Patient | Planned |
| F21 | M5 | Case coverage | Primary/secondary/tertiary; member/group/claim no.; subscriber; employer | Patient | Needs Clarification (C-007, Q-036) |
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
| F34 | M8 | Scrubbing validation matrix | Data, Auth, Credentialing, Payer rules, AI, **Insurance hold** | System | Needs Clarification (Q-010, Q-011) |
| F35 | M8 | Hold queues & auto-resubmit | Holds grouped by reason; auto-resubmit when resolved | Billing | Needs Clarification (Q-012) |
| F36 | M8 | AI coding quality (add-on) | ICD↔CPT consistency | System | Needs Clarification (Q-014) |
| F37 | M9 | Claim lifecycle | Fresh/Updated → Scrubbing → Hold → Submitted (+ record statuses) | System | Needs Clarification (C-003, C-013) |
| F38 | M9 | CMS-1500 generation | Box-by-box mapping (ch. 8) | System | Needs Clarification (Q-024, Q-057–Q-061, C-009, C-010) |
| F39 | M9 | 837P / PDF print queue | Electronic and paper output | System | Needs Clarification (Q-015, Q-040) |
| F40 | M9 | Waystar dispatch | Transmit; receive responses | System | Blocked (Q-015) |
| F41 | M9 | Secondary/tertiary claims | After primary remit posts; Box 29 | System | Needs Clarification (Q-017, Q-024) |
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
  → Coverage rank 1–3 (member/group/claim no., subscriber, employer) → Authorizations (per coverage)
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

**W6 · Hold resolution ✅:** fix the data (auth, credentialing, case fields, coding) → auto-resubmit. **Release buckets are the exception:** only a user action moves those claims.

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
| BR06 | Encrypted fields masked | §10.6 | `ssn_enc`, `portal_password_enc` | Decrypt only for System Admin |
| BR07 | Integration per location | §2.1 | Always | Never global |
| BR08 | EMR-only locations blocked | §2.3 | Payload from non-integrated location | Reject from billing ingestion |
| BR09 | Fee resolution | §3.4, §10.3 | Charge-line creation | Payer `fee_schedule` **billed** rate × units, else `procedure_code.default_fee` · ❓ Q-020 |
| BR10 | Provider claim hold | §10.3 | `claim_hold_until` set | "Visits before this date are delayed" → Delayed queue · ❓ Q-062 |
| BR11 | Clinicians aren't users | §1.3 | Always | Provider record only |
| BR12 | Billing-required fields | §3.2, §10 | Before claim creation | Provider NPI; patient DOB, gender, address; **case referring physician**; member ID + group number; referring name, type, NPI. *(V1's case location and billing provider requirement removed — CH-04.)* ❓ C-006 |
| BR13 | Default case | §10.4 | Every patient | ≥1 case, "Default" |
| BR14 | Diagnoses ordered, ≤12 | §3.2, §10.4 | Case | `icd10_codes` array; position = pointer; line has ≤4 pointers |
| BR15 | Coverage ranks 1–3 | §10.4 | Case | Unique rank per case; claims target `case_insurance` |
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
| BR27 | Scrub failure → hold by reason | §6.2 | Checks 1–5 fail | Missing Data · Authorization · Credentialing · Payer Rule (units > cap; 10b/14/17) · Coding Issue |
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
| Setup | `provider` | Clinician | code (Provider ID), first/last name, credential (optional), specialty, npi, taxonomy_code, state_license, claim_hold_until, claim_hold_reason, is_active |
| | **`insurance_class`** *(new)* | Rule defaults for a group of payers | code (UQ/practice), name, authorization_required, injury_date_required, apply_specialty_modifiers, accept_assignment, icd_version (default ICD10), is_active |
| | `insurance` | Payer as billed | insurance_class_id (required), code (int, UQ/practice), name, insurance_type (claim filing indicator), payer_id, address/phone/fax, **rules nullable = inherit**, icd_version nullable, **insurance_hold**, **release_bucket_id** (required when held), portal_url/user/password_enc, is_active |
| | **`release_bucket`** *(new)* | Manual-release queue | name (UQ/practice), description, is_active |
| | `procedure_code` | CPT/HCPCS (**global**) | code, description, is_timed, default_modifier, default_fee, **procedure_type**, **is_active** |
| | `fee_schedule` *(rel)* | Billed price | PK(insurance, procedure_code), billed_amount (per unit), effective_from/to *(allowed_amount removed — CH-08)* |
| | `referring_physician` | Referring or supervising doctor | code, name, **type (DN/DQ)**, npi |
| Patient | `patient` | Person in care | emr_id (UQ), names, date_of_birth, gender, ssn_enc (**optional**), address, phones, email, guarantor (null = self), no_statements, notes, is_active *(emergency_contact removed — CH-14a)* |
| | `patient_case` | Episode of care | patient_id, name, referring_physician_id (required for billing), **icd10_codes[] (≤12)**, injury_type, injury_date, start_of_care, discharge_date, accident_state, is_active *(location_id, billing_provider_id, discipline removed — CH-04)* |
| | `case_insurance` *(rel)* | Coverage | case, insurance, rank (UQ/case), member_id, group_number, claim_number, subscriber (null = self), employer (WC) |
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
- **Setup:** practice DBA/taxonomy/tax-ID type; location EMR link and integrated flag; provider × payer credentialing; payer unit caps, conditional boxes, SLA days, claim format; referring taxonomy/contact/referral orders (Q-022, Q-029, Q-010, Q-011, C-006).
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
| Hold queues (§6.2 p7) | Missing Data, Authorization Hold, Credentialing Hold, Payer Rule Hold, Coding Issue Hold, **one queue per release bucket** | Resolve → auto-resubmit; bucket → user release | Q-076, Q-077 |
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
- **Two environments in one prototype (2026-09-17):** *Demo Data* (the seeded practices) and *Fresh System* (day one: only the two V2-seeded roles, one System Admin account, standard code lists). Chosen at `#/welcome`; switching or resetting rebuilds that environment from scratch, so data never crosses between them. Details: `PROTOTYPE_COVERAGE.md` §8–9.
- **Product plus review notes (2026-09-17):** the **Billing System** screens contain only product content. A thin **Review Notes** layer (`js/prototype/review-notes.js`) attaches assumptions, client questions and short notes to the screen they belong to: one small control, numbered markers, a small popover, three note types. It also holds the simulators and environment actions (Alt + Shift + S). Off with Alt + Shift + N. Details: `PROTOTYPE_COVERAGE.md` §10.
- **Rule for future prototype work:** never put PRD citations, question/assumption IDs, "prototype"/"simulate"/"not specified" wording or environment controls into application screens — add a review note in `js/prototype/review-notes.js` instead.
- Coverage, prototype-only assumptions (A-P##) and QA record: `PROTOTYPE_COVERAGE.md`. Launch notes: `prototype/README.md`.
- `js/engine.js` is a readable executable sketch of the rules (intake, scrubbing with effective class rules, holds and buckets, ERA posting, secondary claims) — input for design, not code to port.
- Visual source: EMR-V.2 live `src/index.css` tokens ("instrument" direction) and component anatomy.

**Visual learning guide (`BILLING_SYSTEM_GUIDE.html`)** — standalone page teaching the business process from zero; migrated to V2.

### Technical decisions (prototype only; no production ADRs yet)

**Decision: Plain HTML/CSS/vanilla JS with in-memory data** — explicit user instruction; double-click launch; refresh resets. Alternatives: React/Vite (build step; could be mistaken for product), static mock-ups (can't show the cycle). 2026-09-15.

**Decision: Classic scripts in dependency order, not ES modules** — ES modules are blocked over `file://`. 2026-09-15.

**Decision: Visual system follows EMR-V.2's live code** — its `index.css` is newer than its CLAUDE.md (code > docs). 2026-09-15.

**Decision: External systems appear as explicit simulators** — the client must tell product behaviour from stand-ins (EMR push, Waystar response, ERA, SLA timer, scheduled job). 2026-09-15; *superseded in placement 2026-09-17:* the simulators moved out of the application into the Prototype Guide (Simulate tab, Guide-off control, Alt+Shift+S) and open in prototype-styled dialogs.

**Decision: Payer allowed amounts live only inside the simulated payer** — V2 removed the stored allowed amount (CH-08); the ERA simulator needs one to produce a remittance, so it lives in the simulator's payer data, never on a product screen. 2026-09-16.

**Decision: Demo and Fresh environments share one codebase and swap the whole data set** — `js/prototype/environment.js` builds either the demo seed or an empty V2 installation and resets every id counter and sequence; screens are identical. Alternatives: a second copy of the prototype (drift, double maintenance), persisting both side by side (no persistence by design). Switching resets the session, as requested. 2026-09-17.

**Decision: The prototype is the product plus a review-note layer** — the application must be demonstrable as the real product, so it knows nothing about being a prototype; review information is attached to it as annotations, the way design-review comments are. The application exposes only two neutral router hooks (`R.hooks.gate`, `R.hooks.afterRender`); the layer renders outside `#app` and reads the route only. Alternatives tried and rejected by the user: inline notices in the screens (contaminates the product), and a full companion "Prototype Guide" with panel, walkthroughs and library (a second application; the user asked for something far simpler). 2026-09-17.

**Decision: One open-question numbering scheme** — this file references `PRD_CLARIFICATION_QUESTIONS.md` IDs directly; internal `Q01…Q57` retired. Reason: traceability across memory, guide, prototype and coverage. 2026-09-16.

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

**Register:** `PRD_CLARIFICATION_QUESTIONS.md` — re-audited against V2 on 2026-09-16.

| | Count |
|---|---|
| Open questions | 84 (30 Critical · 41 Important · 13 Nice to clarify) |
| Contradictions | 14 |
| Assumptions we would otherwise make | 20 |
| Retired (answered by V2) | 2 — Q-023, Q-039 |
| New from V2 | Q-075 – Q-084, C-013, C-014 |
| New from modelling a fresh installation (2026-09-17) | Q-085 (initial / reference data at installation and per new practice), Q-086 (first account and first practice) |

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

When an answer arrives: update the register, the affected BR in §8, the assumption in §21, and any prototype assumption in `PROTOTYPE_COVERAGE.md`.

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

Register-level assumptions `A-001…A-020` (in `PRD_CLARIFICATION_QUESTIONS.md` §9) show the client what a developer would otherwise decide. Prototype-only assumptions `A-P##` are in `PROTOTYPE_COVERAGE.md`; they make the demo work and are **not** product decisions.

---

## 22. Important Terminology

PRD terms are used loosely (❓ Q-003 context, C-010).

| Term | Meaning in this project (V2) |
|---|---|
| Session / Encounter / Visit / "Charge" | One date of service for one case; table `visit`; "Charge" in Charge Review. Holds its own location and providers. |
| Charge line | One CPT/HCPCS procedure on a visit, with its own place of service. Unit billed, paid, denied. |
| Claim | A bill to one payer (coverage rank) for one visit; keeps a snapshot of the referring physician. |
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

Full detail with page references: **`PRD_V1_TO_V2_CHANGELOG.md`**.

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
- Built the client-facing clickable prototype and `PROTOTYPE_COVERAGE.md` (123 automated checks). Recorded four prototype-only ADRs.

### 2026-09-16 (morning)
- Requirements gap audit → `PRD_CLARIFICATION_QUESTIONS.md` (74 questions, 12 contradictions, 14 assumptions; all quotes verified).
- Built `BILLING_SYSTEM_GUIDE.html` (visual learning guide; 126 terms, 10 workflows).

### 2026-09-16 (PRD V2 migration)
- `Billing System PRD v2.docx` received and adopted as primary source. Compared line by line with V1 → `PRD_V1_TO_V2_CHANGELOG.md` (CH-01…CH-17; all page references verified).
- Rewrote this file against V2: 24-section structure; 23 entities; BR40–BR48 added; F57–F60 added; F14–F23, F29, F34, F46 modified; KI-07 added; obsolete V1 content removed; open-question IDs unified with the client register; A02 redefined, A03 retired, A09–A10 added.
- Re-audited the clarification register: 82 open questions, 14 contradictions, 18 assumptions; Q-023 and Q-039 retired; 336 excerpt fragments verified against V2 pages.
- Migrated the visual guide, the prototype and `PROTOTYPE_COVERAGE.md` to V2 (see those files).
- No client answers received; no production decisions made.

### 2026-09-17 (Fresh System environment)
- Prototype now opens on an environment chooser: **Demo Data** (unchanged) or **Fresh System** (empty V2 installation). Added Getting started checklist (13 required / 5 optional steps, labelled a suggested exploration order), dependency explanations at 12 entry points, what/why/next empty states, dashboard Day 1 card, environment indicator, switch and reset with confirmation, full data isolation.
- V2 check of what exists on day one: only the two seeded roles (§10.2 p14); primary location created with the practice (§1.2); Default case with each patient (§10.4). Not stated → register Q-085, Q-086 and assumptions A-019, A-020; prototype assumptions A-P47 (standard code lists), A-P48 (installation System Admin), A-P49 (current month opened for a new practice).
- QA: Fresh walkthrough 57 checks (empty system → paid claim, month close, EMR link and push, switch, isolation, reset), 51-route crawl, existing Demo suites 51 + 73 + 48 — all passing, zero console errors. Register re-verified (346 excerpt fragments, 0 problems).
- `PROTOTYPE_COVERAGE.md` §8 Prototype environments and §9 Fresh System workflows; guide Chapter 12 "Starting from zero" (dependency diagram, Demo vs Fresh); later chapters renumbered 13–15.

### 2026-09-17 (Prototype Guide — product and explanation separated) · *superseded the same day, see below*
- Audited the whole prototype for analysis content in the product UI: 138 PRD citations, open-question / contradiction / assumption IDs and wording, "not yet specified" notices, sand "Simulate …" buttons, eligibility / claim-status placeholder buttons, dashboard Eligibility / Referral placeholders, the Fresh "Day 1" card, the Getting started screen, the demo-guide button, the environment indicator and menu items, prototype wording on sign-in, toasts and audit entries. All removed from the application and moved into the Prototype Guide; legitimate product help kept.
- Built the Prototype Guide: launcher and docked panel with its own visual identity; context per screen (54 contexts) with explanation, why, next step, relationships, terms, assumptions, client questions, prototype notes, PRD references; Follow along (Demo 14 steps, Fresh 13 + 5); Simulate (5 external systems); Library; settings for Guide mode and environment; Guide off control; Presentation mode with keyboard shortcuts; CMS-1500 source overlay.
- Code split: application (`js/*.js`, `js/screens/`) vs prototype layer (`js/prototype/`: environment, simulators, generated guide reference, guide content, walkthroughs, guide, boot). `simulator.js`, `demo.js` and `environment.js` retired from the application folder.
- QA: new Guide suite 54 checks (Presentation mode scan of 57 routes and 162 dialogs/menus finds no analysis or prototype text; Guide off Fresh scan; Guide on context, navigation, overlay, library; Follow along Demo and Fresh; environment switch; phone). Application suites 51 + 73 + 48 and Fresh 55 pass in Presentation mode; context sweep of all routes in both environments without errors.
- `PROTOTYPE_COVERAGE.md` §10 added and matrix wording updated; `prototype/README.md` rewritten; guide Chapter 12 wording updated.

### 2026-09-17 (Review Notes — the Guide replaced by a minimal annotation layer)
- The Prototype Guide built earlier the same day was removed at the user's request: no guide panel, walkthroughs, library, categories, modes or onboarding. Deleted `guide.js`, `guide-content.js`, `guide-reference.js`, `walkthroughs.js` and the reference generator.
- Replaced by **Review Notes** (`js/prototype/review-notes.js`, ~56 notes): one `Review notes · n` control, numbered markers positioned over the annotated element in their own overlay, a small popover with a list and a one-note detail (type, two sentences, register ID linking to `PRD_CLARIFICATION_QUESTIONS.md`, PRD section and page). Three types only: Assumption, Client question, Note. No emoji, no cards, no second navigation.
- The popover footer (and Alt + Shift + S) holds the simulators and the environment actions; Alt + Shift + N or "Hide notes" switches the layer off, and the start screen has the same checkbox.
- The application layer was unchanged by this refactor: it already contained product content only.
- QA: new Review Notes suite, 33 checks (notes-off scan of 57 routes and 162 dialogs/menus, contextual counts, markers, detail, dialog-level marker, prototype controls, toggles, content sanity, phone). Application suites 51 + 73 + 48 and Fresh 55 pass with notes off; Fresh route crawl clean.
- `PROTOTYPE_COVERAGE.md` §10 rewritten; `prototype/README.md` rewritten; guide chapter 12 wording updated.
