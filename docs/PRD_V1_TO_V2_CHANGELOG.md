# PRD V1 → V2 Change Log

**Compared:** `Billing System PRD v1.docx` (24 pages) → `Billing System PRD v2.docx` (25 pages).
**Prepared:** 2026-09-16. **Method:** both documents were extracted paragraph by paragraph, including every table cell, and compared line by line. Page numbers are as Microsoft Word paginates each file. Every page reference below was checked against the source text.

**Primary source of truth from now on:** PRD V2. V1 is kept only for this comparison.

Change IDs (`CH-xx`) are stable and are used in `PROJECT_MEMORY.md`, `PRD_CLARIFICATION_QUESTIONS.md` and `PROTOTYPE_COVERAGE.md`.

---

## Executive Summary

V2 is a **targeted revision**, not a rewrite. Chapters 1–5, 7, 8, 9 and 11, the coding rules in §6.1, and the permission matrix in §10.6 are word-for-word identical to V1. Every change sits in two places: **one row of the scrubbing matrix (§6.2)** and **the data model (chapter 10)**.

The changes are small in word count but significant for how the business works:

1. **Manual release is redesigned.** V1 had a vague per-insurance "user preference" that sent claims to one "Manual Submission" hold. V2 replaces it with an **insurance hold** check mark and named **release buckets**. A Practice Admin creates buckets, assigns held insurances to them, and claims for those payers stop in their bucket after scrubbing until a user releases them. (CH-01, CH-03)
2. **Billing rules move up to insurance classes.** V1 stored every billing rule on each insurance, with the class as a text label. V2 makes the class a real record that holds the default for every rule; each insurance inherits those defaults and may override any one of them. (CH-02)
3. **The case gets lighter, the visit gets heavier.** V2 removes location, billing provider and discipline from the case. Location and providers are now set **on each visit**, from the EMR payload or manual entry. Diagnoses stay on the case but become an ordered list on the case itself. (CH-04, CH-05)
4. **The system no longer stores what the payer is expected to allow.** The fee schedule keeps only the billed price; the per-unit allowed amount is gone. Line balances are no longer stored either; they are calculated from payments. (CH-08, CH-09)
5. **Claim detail becomes more precise.** Place of service moves to each charge line. Each claim keeps a snapshot of the referring physician. Referring physicians are typed as Referring (DN) or Supervising (DQ). Procedure codes gain a category and an active flag. (CH-10 to CH-13)
6. **Two patient fields change.** The emergency contact is removed and SSN becomes optional. (CH-14)

**Net effect on open questions:** V2 answers two V1 questions outright (where a supervising physician is recorded; where place of service is recorded) and parts of three more (manual release, the meaning of a referring physician's "type", the emergency contact). It also introduces **10 new questions and 2 new contradictions**, mostly about release buckets, class inheritance, the missing allowed amount and visit-level providers.

| | Count |
|---|---|
| Requirements added | 7 |
| Requirements removed | 5 |
| Requirements modified | 9 |
| Renamed (see table) | 4 |
| Clarified (within the modified list) | 4 — CH-06, CH-12, CH-14b, CH-15 |
| Chapters unchanged | 1, 2, 3, 4, 5, 7, 8, 9, 11 and §6.1, §10.2, §10.6 |

---

## Added Features

### CH-02 · Insurance classes as a real record — ADDED
- **V1:** §10.3 Setup · p15 · `insurance` — "class | text | | AUTO INSURANCE, Worker's Comp, BLUE SHIELD" (a text label only).
- **V2:** §10.3 Setup · p15 · `insurance_class` — "A group of insurances that share billing rules (Medicare, Blue Shield, Workers' Comp, Auto…). A class has many insurances; an insurance belongs to exactly one class. The class carries the default value of every billing rule; an insurance inherits them and may override individual rules."
- **What changed:** a new practice-owned table with a code, a name, the five billing rules (authorization required, injury date required, apply specialty modifiers, accept assignment, ICD version) and an active flag. Every insurance must now belong to exactly one class.
- **What it means:** billing staff set a rule once for, say, all Workers' Comp payers instead of on each payer. A single payer can still be an exception.
- **Affected artifacts:** memory (entities, rules, glossary), guide (dictionary, entity map, setup workflow), prototype (new Insurance classes screen, insurance form), coverage.

### CH-03 · Release buckets — ADDED
- **V1:** none.
- **V2:** §10.3 Setup · p16 · `release_bucket` — "A named manual-release queue created by a Practice Admin. Insurances with the insurance hold checked are assigned to one bucket, so payers can be grouped for review (insurances 1, 2 and 3 in one bucket, others in another). Claims for those insurances stop in the bucket after scrubbing and go out only when a user releases them. Buckets belong to a practice." · p17 — "Inactive buckets cannot be assigned to new insurances."
- **What changed:** a new practice-owned queue with a unique name, a description and an active flag.
- **What it means:** instead of one undifferentiated manual pile, the practice decides how held payers are grouped for review.
- **Affected artifacts:** memory, questions (Q-076, Q-077, C-013), guide (claim workflow, hold statuses, dictionary), prototype (Release buckets admin screen, bucket queues on Claims), coverage.

### CH-10 · Place of service on each charge line — ADDED
- **V1:** place of service existed only on the location (§10.2 · p13 · "place_of_service | char(2) | | Default 11 Office."); a V1 question asked where a per-visit value would live.
- **V2:** §10.5 Billing · p21 · `charge_line` — "place_of_service | char(2) | | CMS-1500 Box 24B. Defaults from location.place_of_service."
- **What changed:** each billed line carries its own place of service, pre-filled from the location.
- **What it means:** a home or telehealth service can be billed from a clinic location without inventing a separate location. It also raises a new question: what if lines on one visit disagree (Box 32 depends on it)?
- **Affected artifacts:** memory, questions (Q-039 retired, Q-079 added), guide (dictionary, claim hub diagram), prototype (per-line POS in visit detail and manual entry; CMS-1500 preview), coverage.

### CH-10b · Internal note on each charge line — ADDED
- **V2:** §10.5 Billing · p21 · `charge_line` — "notes | text, nullable | | Optional internal comment."
- **Affected artifacts:** memory, questions (Q-070 extended), prototype (line note field), coverage.

### CH-11 · Referring physician snapshot on each claim — ADDED
- **V1:** Chapter 8 · p9 · Box 17 was sourced from "Case + referring physician profile" only.
- **V2:** §10.5 Billing · p21 · `claim` — "referring_physician_id | bigint | FK → referring_physician | Snapshot from the case at claim creation; goes to Box 17 / 17b." · §10.7 · p24 — "One claim per payer billed; carries the referring physician."
- **What it means:** changing a case's referring physician later does not change claims already created.
- **Affected artifacts:** memory, questions (Q-084), guide (rules), prototype (claim stores and prints its own referrer), coverage.

### CH-12 · Referring physician type — ADDED
- **V1:** §3.2 · p4 said "Name, type and NPI are required for billing", but no type field existed; V1 asked what "type" meant.
- **V2:** §10.3 Setup · p18 · `referring_physician` — "type | text | | Referring (DN) or Supervising (DQ); sets the Box 17 qualifier."
- **What it means:** a supervising physician is recorded in the same directory as a referring physician, distinguished by type. The Box 17 qualifier follows the type.
- **Affected artifacts:** memory, questions (Q-023 retired, Q-078 added, C-006 narrowed), guide (dictionary), prototype (already had the type; now traced to V2), coverage.

### CH-13 · Procedure category and active flag — ADDED
- **V2:** §10.3 Setup · p17 · `procedure_code` — "procedure_type | text | | Category of the code: Evaluation, Therapeutic, Modality, Supply / DME…" and "is_active | boolean | | Inactive codes cannot be added to new charge lines."
- **What it means:** codes can be grouped by type, and retired codes stop being offered for new charges without deleting their history.
- **Affected artifacts:** memory, questions (Q-066 updated, Q-082, Q-083), prototype (procedure-code screen and charge-entry pickers), coverage.

---

## Removed Features

### CH-08 · Expected allowed amount on the fee schedule — REMOVED
- **V1:** §10.3 Setup · p16 · `fee_schedule` — "The contracted price of one procedure code for one insurance." and "allowed_amount | numeric(12,2) | | Per unit, expected from the payer."
- **V2:** §10.3 Setup · p17 · `fee_schedule` — "The billed price of one procedure code for one insurance." (no allowed-amount column).
- **What changed:** the system no longer records what each payer is expected to allow.
- **What it means:** the only allowed amount left is the one the payer reports on its remittance. The reconciliation equation in §9.1 (unchanged) still uses "Allowed Amount", and nothing now exists to compare a payment against to spot an underpayment.
- **Affected artifacts:** memory (calculations), questions (Q-020 updated, Q-075 new), guide (dictionary, worked example), prototype (fee-schedule screen loses the Allowed column; the payer's allowed amount now exists only inside the simulated payer), coverage.

### CH-09 · Stored line balances — REMOVED
- **V1:** §10.5 Billing · p20 · `charge_line` — "carries the running insurance and patient balances used for A/R aging" and "balance_insurance, balance_patient | numeric(12,2) | | amount − payments − adjustments, split by responsibility."
- **V2:** §10.5 Billing · p21 — "Line balances are computed from payments (amount − payments − adjustments) rather than stored." · §10.7 · p24 — "line balances computed, not stored".
- **What changed:** the balance is a calculation, not a saved value, and V2 no longer mentions the split between what the insurer owes and what the patient owes.
- **What it means:** A/R aging and patient balances still need that split, but V2 does not say how it is derived.
- **Affected artifacts:** memory, questions (Q-017 updated), guide (dictionary "Balance"), prototype (balances derived from posted rows), coverage.

### CH-14a · Patient emergency contact — REMOVED
- **V1:** §10.4 Patient · p17 · `patient` — "emergency_contact | jsonb | | Name and phones."
- **V2:** removed from the `patient` table (§10.4 · p18).
- **Affected artifacts:** memory, questions (Q-069 narrowed to the guarantor), prototype (field removed from the patient form), coverage.

### CH-04a · Discipline on the case — REMOVED
- **V1:** §10.4 Patient · p18 · `patient_case` — "discipline | text | | PHYSICAL THERAPY".
- **V2:** removed; the word *discipline* no longer appears anywhere in V2.
- **What it means:** nothing now records whether an episode is physical, occupational or speech therapy. The specialty-modifier rule (GP/GO/GN) still exists, so what drives it is now less clear.
- **Affected artifacts:** memory, questions (Q-054 updated), guide (dictionary term removed; modifier term updated), prototype (field removed from the case), coverage.

### CH-05a · `case_diagnosis` table — REMOVED (content kept, see CH-05)
- **V1:** §10.4 Patient · p18 · `case_diagnosis` — "The ordered list of ICD-10 codes for a case. The position (1–12) is the diagnosis pointer that charge lines refer to on the claim."
- **V2:** table dropped (§10.7 · p24 — "case and visit diagnoses and pointers stored as arrays (case_diagnosis dropped)").

---

## Modified Features

### CH-01 · Manual release (scrubbing matrix, sixth check) — MODIFIED
- **V1:** §6.2 Scrubbing validation matrix · p7 — "Manual release required | User preference | Manual submission (user-triggered only). | Hold queue: Manual Submission | Insurance settings"
- **V2:** §6.2 Scrubbing validation matrix · p7 — "Manual release required | Insurance hold | Insurance has insurance_hold unchecked. If checked, the claim stops in the insurance's release bucket until a user releases it. | Hold queue: the assigned release bucket | Insurance settings (§10.3)"
- **V2 supporting detail:** §10.3 · p16 · `insurance` — "insurance_hold | boolean | | Check mark. True = claims for this payer require manual release." and "release_bucket_id | bigint | FK → release_bucket | Shown only when insurance_hold is checked; required then. Must belong to the same practice."
- **What changed:**

| | V1 | V2 |
|---|---|---|
| What triggers it | A "user preference" | A check mark on the insurance |
| Where the claim waits | One "Manual Submission" hold | The release bucket assigned to that insurance |
| Configuration | Not modelled | `insurance_hold` + `release_bucket_id` (required when held) |
| How it leaves | "user-triggered only" | "until a user releases it" |

- **What it means:** manual release is now a per-payer business setting, organised into named queues, rather than a personal preference.
- **Affected artifacts:** memory (rules, workflows, statuses), questions (Q-011 and Q-012 updated; Q-076, Q-077, C-013 new), guide (big picture, claim workflow, hold-queue status card, dictionary), prototype (insurance form, scrub engine, Claims hold tabs, demo guide), coverage.

### CH-02b · Billing rules on the insurance — MODIFIED
- **V1:** §10.3 · p16 · `insurance` — "authorization_required, injury_date_required, apply_specialty_modifiers, accept_assignment | boolean | | Billing rules." and "icd_version | text | | Default ICD10."
- **V2:** §10.3 · p16 · `insurance` — "authorization_required, injury_date_required, apply_specialty_modifiers, accept_assignment | boolean, nullable | | Null = inherit from insurance_class. Effective value = COALESCE(insurance, class)." and "icd_version | text, nullable | | Null = inherit from insurance_class." plus "insurance_class_id | bigint | FK → insurance_class | Required. One class per insurance."
- **What it means:** each rule on an insurance has three states — inherit, yes, no — and the value that applies is the insurance's own value if set, otherwise the class's.
- **Affected artifacts:** memory (BR on rule resolution), questions (Q-011, Q-064, C-009 updated; Q-081 new), guide, prototype (three-state rule controls with "effective value" shown), coverage.

### CH-04 · Location and providers move from the case to the visit — MODIFIED
- **V1:** §10.4 · p18 · `patient_case` — "The case fixes what every visit inherits: the location, billing provider, referring physician, discipline, injury type and onset date." with "location_id … Required for billing." and "billing_provider_id … Required for billing." · §10.5 · p19 · `visit` — "Location and providers default from the case but can be changed per visit."
- **V2:** §10.4 · p19 · `patient_case` — "The case fixes what every visit inherits: the referring physician, diagnoses, injury type and onset date. … Location and providers are set per visit." · §10.5 · p20 · `visit` — "Location and providers are set on the visit (from the EMR payload or manual entry)." · §10.7 · p23 — "visit | location, provider | * : 1 | Where and by whom."
- **What changed:** the case no longer supplies a default location or billing provider. Each visit must receive them.
- **What it means:** manual charge entry must ask for location and providers every time, and an EMR payload must carry them. Unchanged V2 text elsewhere still describes providers as assigned to cases (see C-014).
- **Affected artifacts:** memory, questions (Q-004, Q-031 updated; Q-080, C-014 new), guide (entity map, case workflow), prototype (case form, manual charge entry, EMR simulator payloads, location-scoped visibility), coverage.

### CH-05 · Diagnoses stored on the case as an ordered list — MODIFIED
- **V1:** §10.4 · p18 · separate `case_diagnosis` rows (seq 1–12, code, description).
- **V2:** §10.4 · p19 · `patient_case` — "icd10_codes | text[] | | Ordered ICD-10 list, up to 12; position = diagnosis pointer. {M54.2, S92.352D}"
- **What it means for the business:** nothing — still up to 12 codes, in order, with the position used as the pointer. The per-code description column is gone.
- **Affected artifacts:** memory (entities), questions (Q-038 reference), guide (entity map), coverage.

### CH-06 · Authorization on the visit becomes optional — MODIFIED (clarified)
- **V1:** §10.5 · p20 · `visit` — "authorization_id | bigint | FK → authorization | Consumed by this visit."
- **V2:** §10.5 · p20 · `visit` — "authorization_id | bigint, nullable | FK → authorization | Optional. Consumed by this visit when the payer requires authorization."
- **What it means:** visits for payers that do not require authorization carry none.
- **Affected artifacts:** memory, questions (Q-009, Q-058 references), prototype (already behaved this way), coverage.

### CH-15 · Provider ID and optional credential — MODIFIED (clarified)
- **V1:** §10.3 · p15 · `provider` — "code | text | UQ per practice | 297" / "credential | text | | PT"
- **V2:** §10.3 · p15 · `provider` — "code | text | UQ per practice | Provider ID, 297." / "credential | text | | PT. Optional."
- **Affected artifacts:** memory, prototype (credential not required), coverage.

### CH-14b · SSN optional — MODIFIED (clarified)
- **V1:** §10.4 · p17 · `patient` — "ssn_enc | bytea | | Encrypted."
- **V2:** §10.4 · p18 · `patient` — "ssn_enc | bytea, nullable | | Encrypted. Optional."
- **Affected artifacts:** memory, prototype (SSN not required), coverage.

### CH-16 · Table count and grouping — MODIFIED
- **V1:** ch. 10 intro · p12 — "Twenty-two tables: seventeen core tables that hold the business records and five relation tables that connect them."
- **V2:** ch. 10 intro · p12 — "Twenty-three tables: nineteen core tables that hold the business records and four relation tables that connect them." · §10.1 · p12 — "Setup | provider, insurance_class, insurance, release_bucket, procedure_code, referring_physician | fee_schedule" and "Patient | patient, patient_case, authorization | case_insurance".
- **Affected artifacts:** memory, guide (technical appendix), coverage.

### CH-17 · Relations at a glance — MODIFIED
- **V2:** §10.7 · p23 — "practice | location, provider, insurance_class, insurance, release_bucket, referring_physician, patient | 1 : * | Everything is scoped to a practice." · "insurance_class | insurance | 1 : * | Class holds the billing-rule defaults; insurance may override." · "release_bucket | insurance | 1 : 0..* | Held insurances grouped for manual release." · "patient_case | referring_physician | * : 1 | Referred by whom." · "visit | location, provider | * : 1 | Where and by whom."
- **V1:** §10.7 · p22 — "patient_case | location, provider, referring_physician | * : 1 | Where, by whom, referred by whom." · "patient_case | case_diagnosis | 1 : 1..12 | Ordered ICD-10 list."
- **Affected artifacts:** memory (relationships), guide (entity map).

---

## Renamed Concepts

| ID | V1 name | V2 name | Reference | Meaning changed? |
|---|---|---|---|---|
| CH-01 | "Manual Submission" hold · "User preference" | "the assigned release bucket" · "Insurance hold" | §6.2 · p7 (both) | **Yes** — see CH-01 |
| CH-07 | Visit diagnosis snapshot "of case_diagnosis" | Snapshot "of patient_case.icd10_codes" | §10.5 · p20 (V1 p20) | No |
| CH-08 | Fee schedule = "contracted price" | Fee schedule = "billed price" | §10.3 · V1 p16 / V2 p17 | **Yes** — see CH-08 |
| CH-15 | Provider "code" | Provider "code" described as "Provider ID" | §10.3 · p15 | No |

---

## Changed Workflows

| Workflow | V1 | V2 | Reference |
|---|---|---|---|
| **Practice setup** | Providers · insurances (with their rules) · codes · fee schedules (billed + allowed) · referring physicians | **Insurance classes first** (rule defaults) → insurances (class, optional overrides, insurance hold + bucket) → **release buckets** · codes (with type, active flag) · fee schedules (billed only) · referring physicians (with type) | §10.3 · p15–18 |
| **Patient & case preparation** | Case records location, billing provider, discipline, referrer, diagnoses, coverage, authorizations | Case records **referrer, diagnoses, injury details**, coverage, authorizations. **No location or providers on the case.** | §10.4 · p19 |
| **Charge arrival and manual entry** | Visit takes location and providers from the case by default | Visit **must receive** location and providers from the EMR payload or the person entering it; each line takes its place of service from the location | §10.5 · p20–21 |
| **Scrubbing → submission** | Sixth check sent flagged claims to a single "Manual Submission" hold | Sixth check sends claims for held insurances to **that insurance's release bucket**; a user releases them from there | §6.2 · p7; §10.3 · p16 |
| **Claim creation** | Box 17 read from the case | Claim **stores a snapshot** of the case's referring physician when it is created | §10.5 · p21 |
| **Posting and balances** | Posting updated stored insurance and patient balances; an expected allowed amount existed | Balances are **calculated** from posted rows; the only allowed amount is the one on the remittance | §10.3 · p17; §10.5 · p21 |

Unchanged workflows: EMR integration (ch. 2), record reconciliation, incomplete profiles and billing exceptions (ch. 4), updated-charges queue (§5.2), coding rules (§6.1), claim lifecycle and daily batch (ch. 7), SLA escalation and A/R categories (§9.2).

---

## Changed Business Rules

| # | Rule | V1 | V2 | Reference | Status |
|---|---|---|---|---|---|
| 1 | Which setting applies to a claim | The insurance's own flag | **Insurance value if set, otherwise the class value** | V2 §10.3 · p16 | MODIFIED |
| 2 | Manual release | Per "user preference"; one hold | Per **insurance hold**; claims wait in the assigned **bucket** until a user releases them | §6.2 · p7; V2 §10.3 · p16 | MODIFIED |
| 3 | A held insurance must name a bucket | — | **Required** when the hold is checked; bucket must be in the **same practice** | V2 §10.3 · p16 | ADDED |
| 4 | Inactive buckets | — | **Cannot be assigned to new insurances** | V2 §10.3 · p17 | ADDED |
| 5 | Inactive procedure codes | — | **Cannot be added to new charge lines** | V2 §10.3 · p17 | ADDED |
| 6 | Case billing requirements | Location and billing provider **required for billing** on the case | Not on the case; set per visit | V1 §10.4 · p18; V2 §10.4 · p19 | REMOVED (moved) |
| 7 | Visit authorization | Every visit consumes one | **Only when the payer requires authorization** | §10.5 · p20 | CLARIFIED |
| 8 | Place of service | From the location | **Per charge line**, defaulting from the location | V2 §10.5 · p21 | MODIFIED |
| 9 | Box 17 source | Case + referring physician profile | Unchanged in ch. 8, but the **claim keeps its own snapshot** taken at creation | §8 · p9; V2 §10.5 · p21 | ADDED |
| 10 | Box 17 qualifier | DN or DQ, no stated source | **Set by the referring physician's type** | V2 §10.3 · p18 | CLARIFIED |
| 11 | Line balance | Stored, split insurance/patient | **Calculated** (amount − payments − adjustments); split not mentioned | V2 §10.5 · p21 | MODIFIED |
| 12 | Price lookup | Billed and allowed per unit | **Billed per unit only**; default fee when no row | V2 §10.3 · p17 | MODIFIED |
| 13 | Every insurance belongs to exactly one class | — | **Required** | V2 §10.3 · p16 | ADDED |

---

## Changed Roles & Permissions

The permission matrix (§10.6 · V1 p22 / V2 p22–23), the role definitions and the access formula are **unchanged**.

One statement is **added**: release buckets are "created by a Practice Admin" (V2 §10.3 · p16). This is consistent with the unchanged Practice Admin limit "Manages setup and users of granted practices" (V2 §10.6 · p23).

**Not specified in V2:** who may **release** claims from a bucket ("a user"), and which permission module that action belongs to. → Q-076.

---

## Changed Entities / Data

| Entity | Change | V1 ref | V2 ref |
|---|---|---|---|
| `insurance_class` | **New** core table: code, name, 5 rule defaults, is_active | — | §10.3 · p15 |
| `release_bucket` | **New** core table: name (unique per practice), description, is_active | — | §10.3 · p16–17 |
| `case_diagnosis` | **Dropped** (folded into the case) | §10.4 · p18 | §10.7 · p24 |
| `insurance` | `class` text → `insurance_class_id` (required); rules now nullable (inherit); **+ insurance_hold, + release_bucket_id** | §10.3 · p15–16 | §10.3 · p16 |
| `procedure_code` | **+ procedure_type, + is_active** | §10.3 · p16 | §10.3 · p17 |
| `fee_schedule` | **− allowed_amount**; described as billed price | §10.3 · p16 | §10.3 · p17 |
| `referring_physician` | **+ type** (Referring DN / Supervising DQ) | §10.3 · p17 | §10.3 · p18 |
| `provider` | code = Provider ID; credential optional | §10.3 · p15 | §10.3 · p15 |
| `patient` | **− emergency_contact**; ssn_enc optional | §10.4 · p17 | §10.4 · p18 |
| `patient_case` | **− location_id, − billing_provider_id, − discipline; + icd10_codes** | §10.4 · p18 | §10.4 · p19 |
| `visit` | location/providers "set on the visit"; authorization optional; snapshot source renamed | §10.5 · p19–20 | §10.5 · p20 |
| `charge_line` | **+ place_of_service, + notes; − balance_insurance, − balance_patient** | §10.5 · p20 | §10.5 · p21 |
| `claim` | **+ referring_physician_id** (snapshot) | §10.5 · p20 | §10.5 · p21 |
| Totals | 22 tables (17 core + 5 relation) → **23 tables (19 core + 4 relation)** | ch. 10 · p12 | ch. 10 · p12 |

Unchanged: `company`, `practice`, `location`, `app_user`, `role`, `user_practice`, `user_role`, `case_insurance`, `authorization`, `payment`, `denial`.

---

## Changed Statuses

**No status value was added, removed or renamed.** Visit statuses (Review, Pended, Delayed, Released — p19 / p20), claim lifecycle states (§7.1 · p8), claim record statuses (Scrubbed, Failed, Rejected, Sent, Paid, Denied — p20 / p21), denial statuses (Open, Appealed, Resolved, Written off — p21 / p22) and A/R categories (§9.2 · p11) are identical.

**What did change is one hold queue:**

| | V1 | V2 |
|---|---|---|
| Sixth hold queue | "Manual Submission" (one queue) | "the assigned release bucket" (one queue **per bucket**, named by the practice) |
| How a claim leaves | "user-triggered only" | "until a user releases it" |

V2 still says, unchanged, that held claims are "Auto-resubmitted when the hold reason is resolved" (§7.1 · p8), which does not fit a queue that only a person can empty. → C-013.

---

## Changed Calculations

| Calculation | V1 | V2 | Reference |
|---|---|---|---|
| Effective billing rule | Insurance flag | **COALESCE(insurance value, class value)** | V2 §10.3 · p16 |
| Charge line amount | Payer billed rate × units, else default fee | Unchanged (example "97110 × 2 units = $60.00") | V1 p16 / V2 p17 |
| Expected allowed amount | Payer allowed rate × units | **No longer calculable** — not stored | V1 p16 / V2 p17 |
| Line balance | Stored: amount − payments − adjustments, split by responsibility | **Computed**: amount − payments − adjustments; split not stated | V1 p20 / V2 p21 |
| Reconciliation equation | "Original Charge − Allowed Amount − Contractual Adjustment − Patient Responsibility = Paid Amount" | **Unchanged**, and still does not balance; its "Allowed Amount" now has no stored source | §9.1 · p11 |
| Box 28 / Box 29 | Sum of charges / sum paid when billing secondary | Unchanged | §8 · p10 |

---

## Changed Terminology

| Term | V1 meaning | V2 meaning |
|---|---|---|
| **Insurance class** | A text label on the insurance | A record that holds rule defaults for a group of insurances |
| **Insurance hold** | — | A check mark on an insurance that routes its claims to manual release |
| **Release bucket** | — | A named manual-release queue owned by a practice |
| **Manual release** | A user preference / "Manual Submission" hold | Waiting in a release bucket until a user releases the claim |
| **Fee schedule** | Contracted price (billed and allowed) | Billed price only |
| **Referring physician** | The doctor who referred the patient | The same, **or** a supervising physician, distinguished by type (DN / DQ) |
| **Procedure type** | — | Category of a code: Evaluation, Therapeutic, Modality, Supply / DME… |
| **Case** | Episode of care that fixes location, billing provider, referrer, discipline, injury | Episode of care that fixes **referrer, diagnoses, injury type and onset date** |
| **Discipline** | PT / OT / speech on the case | **No longer used** |
| **Emergency contact** | A patient field | **No longer used** |
| **Line balance** | A stored value | A calculated value |

---

## Contradictions Between V1 and V2

Direct reversals. In each case **V2 supersedes V1**; they are listed so nobody builds from an old note.

| # | V1 said | V2 says | Refs |
|---|---|---|---|
| 1 | Case location and billing provider are "Required for billing" | Location and providers are set per visit | V1 §10.4 · p18 · V2 §10.4 · p19 |
| 2 | Visit location and providers "default from the case" | Set "from the EMR payload or manual entry" | V1 §10.5 · p19 · V2 §10.5 · p20 |
| 3 | Fee schedule is the "contracted price", with an expected allowed amount | Fee schedule is the "billed price" | V1 §10.3 · p16 · V2 §10.3 · p17 |
| 4 | Manual release is a "User preference", "user-triggered only" | Manual release is an "Insurance hold", released from a bucket | §6.2 · p7 (both) |
| 5 | Line balances are stored and split by responsibility | Line balances are computed, not stored | V1 §10.5 · p20 · V2 §10.5 · p21 |
| 6 | Payer, insurance class and clearinghouse "merged into insurance" | Insurance class "kept as its own table" | V1 §10.7 · p23 · V2 §10.7 · p24 |

**Contradictions inside V2** that the revision introduced or sharpened (full text in `PRD_CLARIFICATION_QUESTIONS.md`):
- **C-013** — Held claims "auto-resubmit when the hold reason is resolved" (§7.1 · p8), but bucketed claims "go out only when a user releases them" (§10.3 · p16).
- **C-014** — The hierarchy places Location and Provider above the Case (§3.1 · p4) and providers are "Assigned to cases and visits" (§10.3 · p15), but "Location and providers are set per visit" (§10.4 · p19).

---

## Requirements No Longer Specified

| Requirement in V1 | V1 ref | Status in V2 |
|---|---|---|
| Discipline of an episode (PT / OT / speech) | §10.4 · p18 | Not recorded anywhere |
| Case-level default location and billing provider | §10.4 · p18 | Removed; no default source stated for visits |
| Expected allowed amount per unit per payer | §10.3 · p16 | Removed |
| Split of each line balance into insurance and patient portions | §10.5 · p20 | Not stated |
| Per-diagnosis description on the case | §10.4 · p18 | Removed with `case_diagnosis` |
| Patient emergency contact | §10.4 · p17 | Removed |

---

## New Ambiguities Introduced by V2

Each is written up in full in `PRD_CLARIFICATION_QUESTIONS.md`.

| ID | Priority | Ambiguity | Caused by |
|---|---|---|---|
| Q-075 | Critical | Where the allowed amount comes from, and whether underpayments are detected | CH-08 |
| Q-076 | Critical | Who may release claims from a bucket, and what releasing involves | CH-01, CH-03 |
| Q-080 | Critical | Where a visit's location and providers come from when the EMR payload lacks them | CH-04 |
| Q-077 | Important | Claims already in a bucket when a hold is removed, a bucket is changed or deactivated | CH-03 |
| Q-078 | Important | Whether a case or claim can carry both a referring and a supervising physician | CH-12 |
| Q-079 | Important | Different places of service on one visit, and which one decides Box 32 | CH-10 |
| Q-081 | Important | When a class rule change takes effect, and how class relates to insurance type | CH-02 |
| Q-082 | Important | EMR charges that arrive with an inactive procedure code | CH-13 |
| Q-084 | Important | Which referring physician a corrected claim carries | CH-11 |
| Q-083 | Nice to Clarify | What procedure types are used for | CH-13 |
| C-013 | Important | Release buckets versus "auto-resubmitted" holds | CH-01 |
| C-014 | Important | Location and providers on the case versus on the visit | CH-04 |

**V1 questions answered by V2:** Q-023 (where a supervising physician is recorded) and Q-039 (where place of service is recorded) are retired. Q-011, Q-012, Q-069 and C-006 are narrowed.

---

## Prototype Impact

| Area | Required change | Driven by | Status |
|---|---|---|---|
| Admin → Insurance classes | New screen: list, create, edit, deactivate; five rule defaults | CH-02 | Done |
| Admin → Insurances | Class picker (required); each rule Inherit / Yes / No with the effective value shown; insurance hold check mark; bucket picker shown only when held, required, active buckets of the same practice | CH-01, CH-02 | Done |
| Admin → Release buckets | New screen: list with held insurances and waiting claims, create, edit, deactivate | CH-03 | Done |
| Scrub engine | Sixth check reads the effective insurance hold and routes to the bucket; all rule checks read effective (inherited) values | CH-01, CH-02 | Done |
| Claims → Hold queues | "Manual Submission" replaced by one queue per release bucket; release one claim or a whole bucket | CH-01, CH-03 | Done |
| Patients → Case | Location, billing provider and discipline removed | CH-04 | Done |
| Charges → Manual entry and visit detail | Location, billing provider and rendering provider chosen per visit; place of service per line; line note; inactive codes not offered | CH-04, CH-10, CH-13 | Done |
| EMR simulator | Payloads carry location and providers | CH-04 | Done |
| Location-scoped access | Patients visible through their visits' locations, not a case location | CH-04 | Done (assumption, Q-031) |
| Fee schedules | Allowed column removed; allowed amounts appear only in simulated payer responses | CH-08 | Done |
| Payments / balances | Displayed balances verified to equal amount − payments − adjustments on every line (automated QA) | CH-09 | Done (insurer/patient split kept by the prototype — Q-017) |
| Claims → CMS-1500 preview | Box 17 from the claim's snapshot; Box 24B per line | CH-10, CH-11 | Done |
| Admin → Procedure codes | Procedure type and active flag | CH-13 | Done |
| Patients → Patient form | Emergency contact removed; SSN optional | CH-14 | Done |
| Demo flow through the prototype | Manual-release step rewritten around buckets | CH-01 | Done |

Details and per-requirement status: `PROTOTYPE_COVERAGE.md`.

## Documentation Impact

| Artifact | Impact |
|---|---|
| `PROJECT_MEMORY.md` | Rewritten against V2: entities, rules, workflows, glossary, calculations, open questions and assumptions migrated; obsolete V1 content removed; V1→V2 section added |
| `PRD_CLARIFICATION_QUESTIONS.md` | Re-audited against V2: 2 questions retired, 18 entries updated (16 questions, 2 contradictions), 10 questions and 2 contradictions added, 4 assumptions added; every reference re-paginated to V2 and verified |
| `BILLING_SYSTEM_GUIDE.html` | Big picture, setup/case/charge/claim/payment workflows, new "Releasing held claims" workflow, entity map, status lifecycles, rules, dictionary (6 terms added, 1 removed, 16 rewritten) and worked example updated to V2; all 154 citations re-verified |
| `PROTOTYPE_COVERAGE.md` | Rebuilt as a V2 requirement-by-requirement traceability matrix |
| `prototype/README.md` | Updated to name V2 as the source |
