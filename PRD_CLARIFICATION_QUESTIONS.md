# Billing System — PRD Clarification Questions

**Source:** `Billing System PRD v2.docx` (title block reads *Version 2.0 · Draft*), 25 pages. **PRD V2 is the source of truth**; V1 is used only to explain what changed.
**Prepared:** 2026-09-15 against V1 · **Re-audited against V2:** 2026-09-16. **Status:** draft for internal review before sending to the client.

Page numbers are as PRD V2 paginates in Microsoft Word. Section names are the PRD's own headings. Every excerpt is verbatim, shortened where marked with an ellipsis, and was checked against the V2 text on the cited page. Changes between the two PRD versions are documented in `PRD_V1_TO_V2_CHANGELOG.md` (IDs `CH-xx`).

This document asks questions only. It does not decide anything, and it does not propose requirements.

---

## 1. Executive Summary

| | Count |
|---|---|
| Open questions | **89** |
| Critical | **31** |
| Important | **44** |
| Nice to clarify | **14** |
| Contradictions (separate section) | **14** |
| Assumptions we would otherwise make | **21** |

**V2 re-audit**

| Outcome | Count | Entries |
|---|---|---|
| Retired — answered by V2 | 2 | Q-023, Q-039 |
| Updated — meaning or references changed | 18 | C-006, C-009, Q-004, Q-009, Q-011, Q-012, Q-016, Q-017, Q-020, Q-031, Q-037, Q-038, Q-054, Q-058, Q-064, Q-066, Q-069, Q-070 |
| New — raised by V2 | 12 | C-013, C-014, Q-075, Q-076, Q-077, Q-078, Q-079, Q-080, Q-081, Q-082, Q-083, Q-084 |
| New — raised while modelling a fresh installation (2026-09-17) | 2 | Q-085, Q-086 |
| New — raised by meeting notes (2026-09-23) | 11 | Q-087 – Q-097 |
| Answered — by the client (2026-09-23), kept in place for the record | 6 | Q-087, Q-089, Q-090, Q-091, Q-092, Q-096 |
| Kept — still valid, references re-paginated to V2 | 66 | all others |

IDs are never reused. Retired entries are listed in section 10 so earlier references still resolve.

**By category**

| Category | Questions |
|---|---|
| Data | 21 |
| Business Rule | 22 |
| Workflow | 12 |
| Functional | 10 |
| Calculation | 4 |
| Validation | 3 |
| Other | 4 |
| Permissions | 4 |
| Reporting | 3 |
| Edge Case | 3 |
| Integration | 2 |
| Notification | 1 |

**Where the requirements gaps cluster**

1. **Scope of the first release.** Chapter 11 lists five modules as in scope but unspecified, including two — Posting and Denial & A/R — that chapters 9 and 10 already describe in part. Eligibility and Referral appear in the core-principle flow but nowhere else.
2. **Status and queue model.** Chapter 7 and the `claim` table use different state vocabularies, and V2's release buckets are called hold queues while never resubmitting automatically.
3. **Access control.** Chapter 1 describes per-user, three-tier permissions down to field level; chapter 10 stores per-role CRUD flags per module. Role names differ across chapters 1, 2 and 10, and V2 does not say who may release claims from a bucket.
4. **Money rules.** The reconciliation equation does not balance, V2 removed the only stored allowed amount, and V2 no longer says how a balance splits between payer and patient.
5. **Where billing data comes from after V2's restructuring.** Location and providers are now set per visit with no default; place of service is per line while Box 32 is per claim; one case holds one referring or supervising physician.
6. **Scrubbing inputs.** Unit caps, conditional boxes, credentialing status and SLA still have no home in the data model; V2 gave a home only to the five class rules and the insurance hold.
7. **External systems.** The EMR payload contract is undefined and the Waystar specifics are explicitly deferred; both gate ingestion and submission.
8. **Non-functional requirements.** The PRD states none: no security, retention, performance, availability, migration or localisation requirements.

**Field guide.** Every question has a Question ID, Category, Priority, the Question, why clarification is needed, and one or more PRD V2 references giving the section, page and a relevant excerpt. The **V2 audit** field says whether the entry was kept, updated or added during the V2 re-audit.

---

## 2. Critical Questions

*Required to implement the feature correctly. Without an answer the team would have to guess at behaviour the business will notice.*

### Q-001 — Which modules are in the first release?

**Question ID:** Q-001 · **Category:** Functional · **Priority:** Critical · **V2 audit:** Kept

**Question:** Chapter 11 lists Posting, Denial & A/R management, Analytics & reports, Dashboards, and Eligibility and claim-status integration as in scope but not yet specified. Which of these must be delivered in the first release, and which can follow later? For those in the first release, when can we expect their specifications?

**Why clarification is needed:** These five modules represent a large share of the total build. Chapters 9 and 10 already describe parts of Posting and Denial & A/R, so the team cannot tell whether those chapters are the specification or a placeholder.

**PRD V2 reference:**
- **Section:** Chapter 11 — Next steps · **Page:** 24 · **Excerpt:** "The following modules are in scope for the platform but not yet specified in this document:"
- **Section:** 9.1 Adjudication & payment ingestion · **Page:** 11 · **Excerpt:** "Supports manual payment posting and automated ERA (835) ingestion…"

---

### Q-002 — Are Eligibility and Referral part of the system?

**Question ID:** Q-002 · **Category:** Functional · **Priority:** Critical · **V2 audit:** Kept

**Question:** The core principle describes a flow that begins with Eligibility and Referral, but no chapter defines either, and the data model has no table for them. Should the first release capture eligibility checks and referral orders? If so, what information is recorded for each, and who records it?

**Why clarification is needed:** Two of the eight stages of the product's headline flow have no requirements at all. If they are in scope they add screens, data and probably an external integration.

**PRD V2 reference:**
- **Section:** Core product principle · **Page:** 1 · **Excerpt:** "…across the entire flow: Eligibility → Referral → Authorization → Encounter → Claim → Denial / A/R → Payment → Appeals."
- **Section:** Chapter 11 — Next steps · **Page:** 24 · **Excerpt:** "Eligibility and claim-status integration"

---

### Q-003 — Which records carry the ownership fields, and who sets them?

**Question ID:** Q-003 · **Category:** Business Rule · **Priority:** Critical · **V2 audit:** Kept

**Question:** The core principle requires Owner, Status, Priority, Due Date, Next Action and History on every actionable item. Which records count as "actionable" (for example held claims, billing exceptions, denials, A/R items, pended visits)? Who assigns the owner — is it automatic by rule, or manual? How are Priority values defined, and how is a Due Date calculated?

**Why clarification is needed:** This is stated as the product's core principle, but no table in chapter 10 has these columns and no chapter describes assignment. It affects every work queue in the system.

**PRD V2 reference:**
- **Section:** Core product principle · **Page:** 1 · **Excerpt:** "Every actionable item within the platform maintains strict ownership: Owner + Status + Priority + Due Date + Next Action + History…"
- **Section:** 10.1 Overview · **Page:** 12 · **Excerpt:** "Common to every table and not repeated below: an identity primary key <table>_id, plus created_at, created_by, updated_at, updated_by."

---

### Q-004 — What exactly does the EMR send, and how?

**Question ID:** Q-004 · **Category:** Integration · **Priority:** Critical · **V2 audit:** Updated — V2 moved location and providers to the visit (CH-04).

**Question:** For each payload type (session, charge, patient chart, case, provider), what fields does the EMR send, how is the payload delivered (for example an API call from the EMR, a feed the billing system polls, or a file), how often, and what should happen when a payload is rejected or fails — is it retried, and who is told? In particular, does every session payload carry the location, the billing provider and the rendering provider for that visit?

**Why clarification is needed:** Ingestion is the entry point for the whole billing cycle. In V2 the visit, not the case, holds the location and providers, and they come "from the EMR payload or manual entry" — so the payload contract now decides whether a visit can be billed at all.

**PRD V2 reference:**
- **Section:** 4.1 Trigger event · **Page:** 5 · **Excerpt:** "The billing cycle starts automatically when a new session, claim or charge payload is pushed from the EMR or created manually."
- **Section:** 2.3 Selective location billing election · **Page:** 3 · **Excerpt:** "Only integrated locations automatically transmit sessions, charges, patient charts, cases and provider entities into the billing ingestion pipeline."
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "Location and providers are set on the visit (from the EMR payload or manual entry)."

---

### Q-005 — Who completes an incomplete profile, and what happens to the quarantined sessions?

**Question ID:** Q-005 · **Category:** Workflow · **Priority:** Critical · **V2 audit:** Kept

**Question:** When an EMR session references an unknown provider or insurance, who is responsible for completing the draft profile? Once it is completed, do the quarantined sessions move on automatically, or does someone release them? What is the expected turnaround, and what happens if a draft profile is never completed?

**Why clarification is needed:** The PRD defines the quarantine but not the exit from it. The difference between automatic release and manual release changes the workflow, the notifications and the queue design.

**PRD V2 reference:**
- **Section:** 4.3 Incomplete profiles bucket · **Page:** 5 · **Excerpt:** "…the system creates a draft entity profile. The associated session or claim is quarantined in the 'Incomplete Entries / Profiles Bucket' until the missing details are resolved."

---

### Q-006 — Is a clinician profile created from the EMR complete or a draft?

**Question ID:** Q-006 · **Category:** Functional · **Priority:** Critical · **V2 audit:** Kept

**Question:** Section 1.3 says clinician profiles are created automatically when their first clinical note is finalized. Section 4.3 says a session referencing an unknown provider produces a draft profile and is quarantined. Are these the same event? In other words, does the first note from a new clinician always quarantine that session until someone adds the NPI and credentials, or does the EMR supply enough detail to create a usable provider?

**Why clarification is needed:** It decides whether a new clinician's first visits stop the billing cycle, and what the EMR must send about providers.

**PRD V2 reference:**
- **Section:** 1.3 User provisioning & clinician profile rules · **Page:** 2 · **Excerpt:** "Clinician entity profiles are created either manually in the billing platform or automatically via EMR integration when their first clinical note is finalized."
- **Section:** 4.3 Incomplete profiles bucket · **Page:** 5 · **Excerpt:** "If an incoming EMR session references a medical provider or insurance that does not exist, the system creates a draft entity profile."

---

### Q-007 — For over-long fields, should the system truncate or flag, and what are the limits?

**Question ID:** Q-007 · **Category:** Validation · **Priority:** Critical · **V2 audit:** Kept

**Question:** The Patient-level exception says the system "truncates or flags" name and address fields over the character cap. Which of the two should happen, and under what conditions? What are the exact character limits for each field (patient name, address line, city, and any session-level fields)?

**Why clarification is needed:** Truncating changes what is printed on the claim; flagging stops the claim. The two produce different outcomes for the payer, and no limits are given anywhere in the PRD.

**PRD V2 reference:**
- **Section:** 4.4 Billing exceptions · **Page:** 5 · **Excerpt:** "Truncates or flags patient name and address fields exceeding character caps."
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Evaluates session-level fields for character overflow."

---

### Q-008 — Where is "employment status" recorded, and when is it required?

**Question ID:** Q-008 · **Category:** Data · **Priority:** Critical · **V2 audit:** Kept

**Question:** The Case-level exception holds a claim when employment status is missing. Where should employment status be captured, what values are allowed, and for which cases is it required — all cases, or only Workers' Compensation?

**Why clarification is needed:** The rule blocks claims, but no field for employment status exists in the `patient_case` table, so the team would have to invent both the field and the rule that makes it mandatory.

**PRD V2 reference:**
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Holds the claim if injury date, employment status or primary insurance subscriber details are missing."
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `patient_case` columns list (no employment-status column)

---

### Q-009 — How is an authorization consumed?

**Question ID:** Q-009 · **Category:** Business Rule · **Priority:** Critical · **V2 audit:** Updated — V2 made the visit authorization optional (CH-06).

**Question:** At which point does a visit use up an authorization — when the visit arrives, when it is released, or when the claim is submitted? When an authorization is counted in Units rather than Visits, how many units does one visit consume? If several authorizations could apply to a date of service, which is used? If a claim is voided, replaced or a visit is inactivated, is the count given back?

**Why clarification is needed:** The scrubbing rule depends on "remaining visits > 0", so miscounting either blocks valid claims or lets unauthorised visits go out. V2 confirms that a visit only consumes an authorization "when the payer requires authorization", but still does not say when or how much.

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 20 · **Excerpt:** `authorization` — "A payer's pre-approval for a number of visits or units within a date range. Visits consume it…"; "used_qty | integer | | Maintained from visits."
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "authorization_id | bigint, nullable | FK → authorization | Optional. Consumed by this visit when the payer requires authorization."
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Valid auth number, active date range, remaining visits > 0."

---

### Q-010 — Where does credentialing status come from?

**Question ID:** Q-010 · **Category:** Data · **Priority:** Critical · **V2 audit:** Kept

**Question:** The Credentialing check verifies "active credentialing status… for payer and DOS". Where is that status held today, and who maintains it? Is enrolment tracked per provider per payer with effective dates, and does the billing system need to store it, or will it come from another system?

**Why clarification is needed:** The `provider` table has only a claim-hold date and reason; there is nothing that records enrolment per payer. Without this the Credentialing hold cannot be evaluated at all.

**PRD V2 reference:**
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Active credentialing status verified for payer and DOS." / Source: "Provider profile"
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `provider` columns: "claim_hold_until… claim_hold_reason"

---

### Q-011 — Which payer-level settings drive scrubbing and SLA, and at which level are they set?

**Question ID:** Q-011 · **Category:** Data · **Priority:** Critical · **V2 audit:** Updated — V2 answered the manual-release part (insurance hold + release bucket, CH-01) and moved rule defaults to insurance classes (CH-02).

**Question:** The scrubbing matrix refers to a payer's maximum units and to conditional boxes a payer requires, and chapter 9 adds per-insurance SLAs. V2 now defines where the five existing billing rules and the insurance hold live (class defaults with per-insurance overrides), but unit caps, conditional-box requirements, SLA days and the claim format still have no home. Should these be configurable, at the insurance-class level, the insurance level, or both? What is the full list of settings and their allowed values, and who maintains them?

**Why clarification is needed:** Two of the six scrubbing outcomes and the whole A/R escalation depend on settings that neither the `insurance_class` nor the `insurance` table contains.

**PRD V2 reference:**
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Units ≤ payer max limit. Boxes 10b / 14 / 17 filled if required."
- **Section:** 9.2 Payer SLA & denial automation · **Page:** 11 · **Excerpt:** "Tracks payment turnaround time against SLAs defined per insurance, configured manually or via predictive AI agents."
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `insurance_class` — "The class carries the default value of every billing rule; an insurance inherits them and may override individual rules."

---

### Q-012 — What counts as a hold being "resolved"?

**Question ID:** Q-012 · **Category:** Workflow · **Priority:** Critical · **V2 audit:** Updated — V2 answered the manual-release part: those claims stay in their release bucket until a user releases them (CH-01).

**Question:** Held claims are "auto-resubmitted when the hold reason is resolved". What event should trigger the re-check — any edit to the related record, a specific user action, or a scheduled sweep? If a claim fails several checks at once, is it filed under one hold reason or several, and must all be fixed before it goes out?

**Why clarification is needed:** This is the mechanism that moves claims out of the hold queues. Its trigger determines both the user experience and how often the system re-validates work. (The manual-release queue is handled separately in V2 — see Q-076 and C-013.)

**PRD V2 reference:**
- **Section:** 7.1 Claim lifecycle states · **Page:** 8 · **Excerpt:** "Claims failing scrubbing validations, categorized strictly by hold reason. Auto-resubmitted when the hold reason is resolved."

---

### Q-013 — How are coding rules defined, and what do they change?

**Question ID:** Q-013 · **Category:** Business Rule · **Priority:** Critical · **V2 audit:** Kept

**Question:** Do Replace and Drop rules act on a CPT/HCPCS code alone, or can they depend on other conditions such as modifier, units, place of service, diagnosis or date of service? The PRD says rules "mutate internal billing records and payment-posting grids directly" — which records does that include, and what is the "payment-posting grid"? Is the original coding kept for audit, and can a rule's effect be reversed on a single claim?

**Why clarification is needed:** These rules change what is billed. Without knowing the conditions and the scope of the change, the engine cannot be built, and there is no way to explain a claim's final codes to an auditor.

**PRD V2 reference:**
- **Section:** 6.1 Automated coding rules engine · **Page:** 7 · **Excerpt:** "Rules mutate internal billing records and payment-posting grids directly. Payer-specific rules override default rules."
- **Section:** 6.1 Automated coding rules engine · **Page:** 7 · **Excerpt:** "Converts specified CPT / HCPCS codes to alternative codes…" / "Removes designated CPT / HCPCS codes from the claim payload…"

---

### Q-014 — Is the AI coding check part of the first release?

**Question ID:** Q-014 · **Category:** Functional · **Priority:** Critical · **V2 audit:** Kept

**Question:** The AI coding-quality check is marked as an "AI add-on". Is it included in the first release or sold separately? Which engine or vendor performs it, what does it receive, and what does it return? When it flags a claim, can a user override the flag and submit anyway, and is the decision recorded?

**Why clarification is needed:** It is one of the six scrubbing checks and it puts claims on hold. It also implies sending clinical data to an external service, which has privacy consequences.

**PRD V2 reference:**
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Diagnosis-to-CPT logical consistency verified by AI engine." / Source: "AI add-on"

---

### Q-015 — How are claims actually transmitted, and what comes back?

**Question ID:** Q-015 · **Category:** Integration · **Priority:** Critical · **V2 audit:** Kept

**Question:** For electronic claims, does the billing system produce the 837P file itself and send it to Waystar, or does Waystar build it from data we send? For paper claims, who prints and mails them — the practice, or Waystar's print service? What acknowledgements will we receive (for example 277CA), how are rejections returned, and what testing or certification is required before go-live?

**Why clarification is needed:** Submission and the whole rejection workflow depend on this. The PRD defers the detail until portal access is available, so it is an open dependency on the client.

**PRD V2 reference:**
- **Section:** 7.1 Claim lifecycle states · **Page:** 8 · **Excerpt:** "Claims successfully validated, compiled into EDI 837 files or PDF print queues, and dispatched to Waystar."
- **Section:** 9.2 Payer SLA & denial automation · **Page:** 11 · **Excerpt:** "Detailed documentation of 835 handling and posting begins once access to the Waystar developer portal is obtained."

---

### Q-016 — Please confirm the reconciliation equation.

**Question ID:** Q-016 · **Category:** Calculation · **Priority:** Critical · **V2 audit:** Updated — Formula unchanged in V2; context changed by CH-08.

**Question:** The PRD states: Original Charge − Allowed Amount − Contractual Adjustment − Patient Responsibility = Paid Amount. Taking a worked example — charge $100, allowed $70, contractual adjustment $30, patient responsibility $14 — this gives −$14 rather than the $56 the payer would pay. Should the calculation be read as two steps (charge minus contractual adjustment gives the allowed amount; allowed amount minus patient responsibility gives the paid amount), or is a different meaning intended for these terms?

**Why clarification is needed:** This formula governs posting, balances and A/R. If it is implemented as written, every posted payment and every balance will be wrong. V2 leaves the formula unchanged but removes the only stored "allowed amount" (see Q-075).

**PRD V2 reference:**
- **Section:** 9.1 Adjudication & payment ingestion · **Page:** 11 · **Excerpt:** "Original Charge − Allowed Amount − Contractual Adjustment − Patient Responsibility = Paid Amount"

---

### Q-017 — When does a balance become the patient's, and what triggers the secondary claim?

**Question ID:** Q-017 · **Category:** Business Rule · **Priority:** Critical · **V2 audit:** Updated — V2 replaced stored insurance/patient balances with a computed balance (CH-09).

**Question:** After the primary payer's remittance posts, what decides whether the remaining amount is billed to a secondary payer or becomes the patient's responsibility? Is a secondary claim created automatically? Is it also created when the primary denies the claim, or only when it pays? What happens when a tertiary payer exists? And since V2 calculates line balances from payments instead of storing them, how should the system tell how much of a line's balance is owed by the insurance and how much by the patient?

**Why clarification is needed:** This decides how money moves after posting. It changes the claim count, the patient balance and the A/R figures. V1 stored separate insurance and patient balances; V2 removes them and does not say how the split is derived.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `claim` — "A visit gets one claim per coverage rank; the secondary claim is created after the primary remit posts."
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `charge_line` — "Line balances are computed from payments (amount − payments − adjustments) rather than stored."
- **Section:** 10.5 Billing · **Page:** 22 · **Excerpt:** `payment` — "kind | text | | Insurance payment, Patient payment, Adjustment."

---

### Q-018 — How should an ERA be matched and posted, and what if it does not match?

**Question ID:** Q-018 · **Category:** Workflow · **Priority:** Critical · **V2 audit:** Kept

**Question:** The PRD describes claim-level reconciliation, while payments are stored per charge line. How should a remittance be broken down to the line level? What should happen when the remittance does not match the claim — for example a partial payment, an amount for a line that was not billed, a payment for a claim we cannot find, or an adjustment code we do not recognise? Should posting stop for the whole remittance, or only for the affected claim?

**Why clarification is needed:** Automated posting only helps if the exception path is defined. Two of the five billing-exception types are about exactly this.

**PRD V2 reference:**
- **Section:** 9.1 Adjudication & payment ingestion · **Page:** 11 · **Excerpt:** "…automated ERA (835) ingestion with direct claim-level reconciliation."
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Flags automated payment-posting payloads with invalid or missing claim control numbers, or unmapped payment adjustment reason codes."

---

### Q-019 — Where does the Original Reference Number for a corrected claim come from?

**Question ID:** Q-019 · **Category:** Data · **Priority:** Critical · **V2 audit:** Kept

**Question:** Box 22 on a corrected claim needs the payer's Original Reference Number (the payer's claim control number). Where does that number come from — the remittance, the clearinghouse acknowledgement, or a payer portal — and where should it be stored? What should happen if a corrected claim is needed before that number is known?

**Why clarification is needed:** Payers reject replacement claims that carry the wrong reference. The data model stores only a "clearinghouse_ref", described as a batch or control number, which may not be the payer's number.

**PRD V2 reference:**
- **Section:** 5.2 Updated charges queue · **Page:** 6 · **Excerpt:** "Pre-populates CMS-1500 Box 22 with the Original Reference Number and Resubmission Frequency Code (7 – Replacement, 8 – Void)."
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `claim` — "clearinghouse_ref… Batch or control number."

---

### Q-020 — How is a charge priced?

**Question ID:** Q-020 · **Category:** Calculation · **Priority:** Critical · **V2 audit:** Updated — V2 reduced the fee schedule to the billed price (CH-08).

**Question:** Pricing is described as "per unit or per code" — what does per-code pricing mean in practice (a flat amount regardless of units), and how does the system know which to use? Can a payer have more than one billed price for the same code over time, and if prices change, are previously created charges repriced? When a case has secondary coverage, which payer's price is billed?

**Why clarification is needed:** Every charge line amount and every claim total depends on this. The fee schedule holds one billed price per payer and code with an effective date range, which may not support several dated prices for the same code.

**PRD V2 reference:**
- **Section:** 3.4 CPT / HCPCS fee schedule engine · **Page:** 4 · **Excerpt:** "Pricing models. Pricing configured per unit or per code." / "The System Default Fee Schedule is overridden by a Payer-Specific Fee Schedule when one is assigned to an active insurance case."
- **Section:** 10.3 Setup · **Page:** 17 · **Excerpt:** `fee_schedule` — "The billed price of one procedure code for one insurance." / "billed_amount | numeric(12,2) | | Per unit, put on the claim."

---

### Q-021 — Who calculates units for timed codes?

**Question ID:** Q-021 · **Category:** Calculation · **Priority:** Critical · **V2 audit:** Kept

**Question:** Timed codes are marked as following the 8-minute rule. Does the EMR send the finished unit count, or should the billing system calculate units from treatment minutes? If the billing system calculates them, what does the EMR send (minutes per code, or total treatment time), and should the calculation follow Medicare's rule for all payers or vary by payer?

**Why clarification is needed:** Units drive the claim amount and the payer's unit caps. Calculating them is a materially larger build than receiving them.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 17 · **Excerpt:** `procedure_code` — "is_timed… Units follow the 8-minute rule."
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "24G | Y | Session / claim | Number of units / days."

---

### Q-022 — Practice setup: taxonomy, DBA and the Tax ID type.

**Question ID:** Q-022 · **Category:** Data · **Priority:** Critical · **V2 audit:** Kept

**Question:** Onboarding collects a taxonomy code, a DBA name and a Tax ID that may be an EIN or an SSN, and Box 33b prints a group taxonomy. Should all three be stored against the practice? For the Tax ID, how should the system know whether it is an EIN or an SSN, given that Box 25 requires that distinction? Who is allowed to create a practice?

**Why clarification is needed:** Three onboarding fields have no column in the `practice` table but appear on every claim, and the permissions table says Practice Admins cannot create practices without saying who can.

**PRD V2 reference:**
- **Section:** 1.1 Practice onboarding requirements · **Page:** 2 · **Excerpt:** "Tax ID — Federal Employer Identification Number (EIN) or SSN." / "Taxonomy code — primary healthcare provider taxonomy code for claim formatting."
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "25 | Y | Organization | Tax ID or SSN (Tax ID for organizations, EIN checked)." / "33b… Qualifier + group taxonomy."
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "…cannot create practices or grant System Admin."

---

### Q-024 — How is the CMS-1500 filled when billing a secondary payer?

**Question ID:** Q-024 · **Category:** Functional · **Priority:** Critical · **V2 audit:** Kept

**Question:** The mapping describes the primary claim: the billed payer's details go in boxes 1a, 4 and 11, and the secondary payer's details in boxes 9, 9a and 9d. When the secondary claim is produced, do those positions swap so the secondary payer becomes the billed payer and the primary appears in box 9? What else changes on a secondary claim besides box 29?

**Why clarification is needed:** Chapter 8 defines only one layout, but the system creates a claim per coverage rank. Getting this wrong means every secondary claim is rejected.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 8–9 · **Excerpt:** "9 | N | Case / insurance | If a secondary insurance is on the case, fill the secondary insured party."
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "29 | Y | Calculation | Sum of paid amount when billing secondary; 0 by default for primary."

---

### Q-025 — How do users sign in?

**Question ID:** Q-025 · **Category:** Other · **Priority:** Critical · **V2 audit:** Kept

**Question:** How should users authenticate — a username and password held by this system, or single sign-on through the EMR or another provider? Is multi-factor authentication required? What are the password and session rules (expiry, lockout, idle timeout), and who can reset a password?

**Why clarification is needed:** The data model describes accounts that log in but the PRD contains no authentication requirements at all. This is a security decision the client must make.

**PRD V2 reference:**
- **Section:** 10.2 Organization and users · **Page:** 13 · **Excerpt:** `app_user` — "A person or system account that logs in."

---

### Q-026 — What are the privacy and security obligations?

**Question ID:** Q-026 · **Category:** Other · **Priority:** Critical · **V2 audit:** Kept

**Question:** Beyond masking SSNs and payer portal passwords, what protection is required for patient data — for example encryption at rest and in transit, audit-trail retention, access reviews, data retention and deletion periods, and where data may be hosted? Is HIPAA compliance a contractual requirement for this platform, and are there client-specific security standards to meet?

**Why clarification is needed:** The system stores full patient demographics, diagnoses and financial data. The PRD's only security statement concerns two encrypted fields, and these obligations shape hosting, logging and the audit design.

**PRD V2 reference:**
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Encrypted fields (ssn_enc, portal_password_enc) are decrypted only for System Admin; everyone else receives a masked value."
- **Section:** Document introduction · **Page:** 1 · **Excerpt:** "Chapters 1–9 state what the platform must do; chapter 10 states the data it stores; chapter 11 lists the work not yet specified."

---

### Q-027 — How does the payer SLA clock work?

**Question ID:** Q-027 · **Category:** Business Rule · **Priority:** Critical · **V2 audit:** Kept

**Question:** What starts the SLA clock — the submission date, the clearinghouse acceptance, or something else? Is it counted in calendar or business days? What counts as a "payment acknowledgement" that stops it: any remittance, a payment greater than zero, or a claim-status response? If a claim is corrected and resubmitted, does the clock restart?

**Why clarification is needed:** The SLA decides when claims escalate into A/R, which drives the follow-up workload. Each of these choices changes which claims appear and when.

**PRD V2 reference:**
- **Section:** 9.2 Payer SLA & denial automation · **Page:** 11 · **Excerpt:** "If a claim crosses its payer SLA without payment acknowledgement… it is automatically cloned into the Denial & A/R Management module."

---

### Q-028 — What does "cloned into the Denial & A/R Management module" mean?

**Question ID:** Q-028 · **Category:** Workflow · **Priority:** Critical · **V2 audit:** Kept

**Question:** When a claim breaches its SLA or is denied, what is created in the Denial & A/R module — a copy of the claim, a task attached to the claim, or something else? Can one claim produce several A/R items over time (for example delayed first, then denied)? What closes an item, and does closing it change the claim?

**Why clarification is needed:** "Cloned" could mean several things, and the data model has a denial record per charge line but nothing for a delayed claim. The answer defines the A/R work queue.

**PRD V2 reference:**
- **Section:** 9.2 Payer SLA & denial automation · **Page:** 11 · **Excerpt:** "…it is automatically cloned into the Denial & A/R Management module." / "Auto-classified as Delayed (SLA exceeded, no response) or Denied (electronic 835 denial)."
- **Section:** 10.5 Billing · **Page:** 22 · **Excerpt:** `denial` — "A payer's refusal to pay a charge line on a claim…"

---

### Q-075 — Where does the allowed amount come from now?

**Question ID:** Q-075 · **Category:** Calculation · **Priority:** Critical · **V2 audit:** New in V2 — caused by CH-08.

**Question:** V2 removed the expected "allowed amount" from the fee schedule, which now holds only the billed price. The reconciliation equation still uses an Allowed Amount. Should the allowed amount be taken only from each payer's remittance? Does the business want the system to detect underpayments — a payer allowing less than its contract — and if so, what should the payment be compared against?

**Why clarification is needed:** Without an expected amount the system cannot tell a correct payment from an underpayment, and the contractual adjustment can only be whatever the payer reports.

**PRD V2 reference:**
- **Section:** 9.1 Adjudication & payment ingestion · **Page:** 11 · **Excerpt:** "Original Charge − Allowed Amount − Contractual Adjustment − Patient Responsibility = Paid Amount"
- **Section:** 10.3 Setup · **Page:** 17 · **Excerpt:** `fee_schedule` — "The billed price of one procedure code for one insurance." / "billed_amount | numeric(12,2) | | Per unit, put on the claim."

---

### Q-076 — Who may release claims from a release bucket, and what does releasing involve?

**Question ID:** Q-076 · **Category:** Workflow · **Priority:** Critical · **V2 audit:** New in V2 — caused by CH-01 and CH-03.

**Question:** Claims for insurances with the insurance hold checked stop in a release bucket "until a user releases it". Which roles may release claims, and under which permission module? Can a user release one claim, a selection, or a whole bucket at once? If the claim's data changed while it waited, is it checked again before it goes out? Can a claim be returned for correction or held back from a bucket rather than released, and should the release (who and when) be recorded on the claim?

**Why clarification is needed:** Release buckets are the only V2 queue that needs a person to act before money is claimed. The permission matrix gives no release right, and the answers decide the screen, the audit trail and how long claims can wait.

**PRD V2 reference:**
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "If checked, the claim stops in the insurance's release bucket until a user releases it."
- **Section:** 10.3 Setup · **Page:** 16 · **Excerpt:** `release_bucket` — "Claims for those insurances stop in the bucket after scrubbing and go out only when a user releases them."
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Billing | C R U D | C R U | Cannot delete a sent claim."

---

### Q-080 — Where do a visit's location and providers come from when the EMR does not send them?

**Question ID:** Q-080 · **Category:** Data · **Priority:** Critical · **V2 audit:** New in V2 — caused by CH-04.

**Question:** V2 sets the location, billing provider and rendering provider on each visit "from the EMR payload or manual entry", and the case no longer supplies defaults. If an EMR session arrives without a location or a billing provider, what should happen — a billing exception, a pended visit, or a default from somewhere? When staff enter a charge manually, must they choose all three every time?

**Why clarification is needed:** The billing provider and location print on every claim (boxes 24J, 31, 32, 33). The billing-exceptions list checks only the rendering NPI at session level, so a missing billing provider or location has no defined outcome.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "Location and providers are set on the visit (from the EMR payload or manual entry)."
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `patient_case` — "Location and providers are set per visit."
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Flags missing or dummy rendering provider NPIs before claim assembly."

---


## 3. Important Questions

*The feature can be built without an answer, but the answer significantly changes behaviour or the user experience.*

### Q-029 — Who approves an EMR integration request?

**Question ID:** Q-029 · **Category:** Workflow · **Priority:** Important · **V2 audit:** Kept

**Question:** A Domain Admin raises the integration request in "the administrative portal". Which portal is that — the billing system, the EMR, or a separate admin tool? Who reviews and approves the request, what states does it pass through, and is the requester told the outcome?

**Why clarification is needed:** The request is the start of every clinic's billing. Without an owner and states it cannot be tracked or approved.

**PRD V2 reference:**
- **Section:** 2.2 Domain Admin request & location linking workflow · **Page:** 3 · **Excerpt:** "Integration begins with a formal request raised by a Domain Admin in the administrative portal."

---

### Q-030 — What happens when a location's billing election changes?

**Question ID:** Q-030 · **Category:** Workflow · **Priority:** Important · **V2 audit:** Kept

**Question:** If a location changes from EMR-only to integrated, should past sessions be brought into billing, or only new ones? If an integrated location is switched back to EMR-only, what happens to charges and claims already in the system, and to any work in progress?

**Why clarification is needed:** Switching a clinic on or off can create or strand charges; the business must decide what happens to history and work in progress.

**PRD V2 reference:**
- **Section:** 2.3 Selective location billing election · **Page:** 3 · **Excerpt:** "Domain administrators elect which locations integrate with the billing platform; the rest remain 'EMR only'." / "Payloads, encounters and charges generated at non-integrated facilities are blocked from the billing system."

---

### Q-031 — What does location-level access actually restrict?

**Question ID:** Q-031 · **Category:** Permissions · **Priority:** Important · **V2 audit:** Updated — V2 removed the case location (CH-04).

**Question:** When a user's access is narrowed to certain locations, which records should they see? In V2 visits carry the location, but patients, cases, insurances, providers and payments do not. Should a user limited to one location see a patient who was only treated at another location, a patient who has not yet had a visit, or a payment covering visits at both?

**Why clarification is needed:** Location-restricted access is stated but only visits and claims can be tied to a location. V2 removed the location from the case, so there is no longer any way to place a patient without visits in a location.

**PRD V2 reference:**
- **Section:** 1.3 User provisioning & clinician profile rules · **Page:** 2 · **Excerpt:** "Scope of access. Granted at the Practice and/or Location level based on the organizational hierarchy."
- **Section:** 10.2 Organization and users · **Page:** 14 · **Excerpt:** `user_practice` — "location_ids | bigint[] | | Empty = all locations of the practice."
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `patient_case` — "Location and providers are set per visit."

---

### Q-032 — How is the Organization (company) level used?

**Partly answered (meeting, 2026-09-23):** a System Admin creates organizations and assigns practices to them, in Admin → Organizations. What the grouping changes beyond cross-practice reporting — in particular whether it drives an Organization Admin's access — is still open.

**Question ID:** Q-032 · **Category:** Functional · **Priority:** Important · **V2 audit:** Kept

**Question:** The company record exists only for cross-practice reporting and is optional. Will the client use it in practice? Should a user be granted access to an entire company, so that new practices are included automatically, or must access always be granted practice by practice?

**Why clarification is needed:** It decides whether access to new practices is granted automatically, which is both a convenience and a security question.

**PRD V2 reference:**
- **Section:** 10.2 Organization and users · **Page:** 12 · **Excerpt:** `company` — "Exists only so reports can be run across all practices of one owner; it holds no billing data itself."
- **Section:** 1.3 User provisioning & clinician profile rules · **Page:** 2 · **Excerpt:** "System users are designated as Organization Admins (top-level, cross-practice visibility) or Practice Admins."

---

### Q-033 — Can the same person exist in more than one practice?

**Question ID:** Q-033 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** Patients belong to exactly one practice. If a person is treated at two practices of the same organization, should they exist twice? How should the system handle a duplicate patient — is merging required, and is duplicate detection expected on intake?

**Why clarification is needed:** Duplicate patients split balances and history across records and cause duplicate billing.

**PRD V2 reference:**
- **Section:** 10.2 Organization and users · **Page:** 13 · **Excerpt:** `practice` — "All patients, providers, insurances and charges belong to exactly one practice…"
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "emr_id… EMR sync key."

---

### Q-034 — What happens when a patient or case is deleted?

**Question ID:** Q-034 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** Practice Admins have delete rights on the Patient module. What should happen if someone deletes a patient or case that has claims, payments or open balances? Should deletion be blocked, should the record only be deactivated, and should deleted records remain visible anywhere?

**Why clarification is needed:** Deleting a record that money depends on would break claims, payments and reports.

**PRD V2 reference:**
- **Section:** 10.6 User permissions · **Page:** 22–23 · **Excerpt:** "Patient | C R U D | C R U D | Patients, cases, coverage, authorizations."
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "is_active | boolean"

---

### Q-035 — What does discharging or closing a case do?

**Question ID:** Q-035 · **Category:** Workflow · **Priority:** Important · **V2 audit:** Kept

**Question:** A case carries a discharge date and an active flag. Once a case is discharged or inactive, can new visits still arrive for it from the EMR, can charges still be billed, and can its authorizations still be used?

**Why clarification is needed:** Billing after discharge may be valid (late notes) or an error; the rule decides which visits are blocked.

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 18–19 · **Excerpt:** `patient_case` — "start_of_care, discharge_date | date" / "is_active | boolean"

---

### Q-036 — How is the subscriber recorded when it is not the patient?

**Question ID:** Q-036 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** Subscriber details are stored only when the subscriber is not the patient, and an empty value means "the patient". Given that, how should the system detect the exception "primary insurance subscriber details are missing" — what makes subscriber details incomplete rather than simply absent because the patient is the subscriber?

**Why clarification is needed:** An empty subscriber is normal when the patient is the insured, so the exception rule cannot tell "missing" from "not needed" without a definition.

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `case_insurance` — "subscriber | jsonb | Name, dob, address, relationship. Null = the patient."
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Holds the claim if injury date, employment status or primary insurance subscriber details are missing."

---

### Q-037 — Who may change charge lines that came from the EMR, and until when?

**Question ID:** Q-037 · **Category:** Permissions · **Priority:** Important · **V2 audit:** Updated — V2 added place of service to the charge line (CH-10).

**Question:** Can billing staff change the codes, units, modifiers, place of service or diagnosis pointers that arrived from a finalized clinical note? If so, until what point — before release, before submission, or after? Should the clinician or the EMR be told when billing changes a code?

**Why clarification is needed:** Changing clinician-coded charges has compliance consequences, and the EMR record and the claim could diverge.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `charge_line` — "One procedure performed at a visit: code, units, modifiers, place of service, billed amount and which of the visit's diagnoses it points to."
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Charges | C R U D | C R U D | Review, pend, release visits."

---

### Q-038 — Can the diagnosis snapshot on a visit be refreshed?

**Question ID:** Q-038 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Updated — Reference renamed in V2 (CH-07); question unchanged.

**Question:** Each visit keeps a copy of the case diagnoses as they were on arrival, so later case edits do not change billed claims. If a coding problem is found before submission and the case diagnoses are corrected, should the visit's copy be updated — automatically, or by a user action? After a claim has been sent, is a corrected claim the only way to change the diagnoses?

**Why clarification is needed:** The snapshot protects billed claims, but it can also preserve a coding error that was fixed on the case.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "diagnosis_codes | text[] | | Snapshot of patient_case.icd10_codes at arrival, so later case edits do not change billed claims."

---

### Q-040 — What decides whether a claim goes electronically or on paper?

**Question ID:** Q-040 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** A claim is either 837P or a printed CMS-1500. What decides which — a setting per payer, a user choice per claim, or a fallback when electronic submission fails? Who prints and mails paper claims, and how is a paper claim tracked afterwards?

**Why clarification is needed:** Format decides the transmission path, the cost and the rejection workflow for each claim.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `claim` — "format | text | 837P or CMS1500."
- **Section:** 7.1 Claim lifecycle states · **Page:** 8 · **Excerpt:** "…compiled into EDI 837 files or PDF print queues, and dispatched to Waystar."

---

### Q-041 — How should scheduled submission be configured?

**Question ID:** Q-041 · **Category:** Functional · **Priority:** Important · **V2 audit:** Kept

**Question:** Automated submission runs "at admin-configured intervals". Is the interval set per practice, per location or system-wide? What options should be offered (for example hourly, or a fixed time each day), which time zone applies, and should anything be excluded from an automatic run — for example claims released the same day, or claims over a certain amount?

**Why clarification is needed:** An unattended job sends claims to payers; its timing and scope decide what goes out without a person looking.

**PRD V2 reference:**
- **Section:** 5.1 Ingestion queue (Charges / Claims / Billing) · **Page:** 6 · **Excerpt:** "Supports single submission, bulk submission, or automated scheduled submission at admin-configured intervals."

---

### Q-042 — What defines the "calendar day" for batch metrics?

**Question ID:** Q-042 · **Category:** Reporting · **Priority:** Important · **V2 audit:** Kept

**Question:** Daily batch figures are consolidated per calendar day. Which time zone defines that day, especially for practices in different zones? Are the figures per practice, per location or across the whole organization, and for how long should past days remain viewable?

**Why clarification is needed:** Daily figures are meaningless across time zones unless the day boundary is defined.

**PRD V2 reference:**
- **Section:** 7.2 Daily submission batch metrics · **Page:** 8 · **Excerpt:** "Submissions executed within a calendar day are consolidated into a daily batch dashboard…" / "Attempted submissions — total claims initiated across all users and jobs."

---

### Q-043 — How are clearinghouse rejections worked?

**Question ID:** Q-043 · **Category:** Workflow · **Priority:** Important · **V2 audit:** Kept

**Question:** Rejections are counted and mapped to a "Rejections & Reasons" section. What should that section contain, who works it, and what actions are available — correct and resubmit, or write off? Is there a limit on resubmission attempts, and should rejected claims keep their original claim number?

**Why clarification is needed:** Rejections are the fastest money to recover; without a defined workspace they are counted but not worked.

**PRD V2 reference:**
- **Section:** 7.2 Daily submission batch metrics · **Page:** 8 · **Excerpt:** "Clearinghouse rejections — live count of rejection responses, mapped to a dedicated Rejections & Reasons section."

---

### Q-044 — What does a void (frequency 8) claim do to money already posted?

**Question ID:** Q-044 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** When a claim is voided, what should happen to payments and adjustments already posted against it, and to the patient balance? Should the original charges be re-billable afterwards, and does the visit return to the queue?

**Why clarification is needed:** A void without a money rule leaves payments posted against a claim the payer considers cancelled.

**PRD V2 reference:**
- **Section:** 5.2 Updated charges queue · **Page:** 6 · **Excerpt:** "Pre-populates CMS-1500 Box 22 with the Original Reference Number and Resubmission Frequency Code (7 – Replacement, 8 – Void)."

---

### Q-045 — What happens when a check batch does not balance?

**Question ID:** Q-045 · **Category:** Validation · **Priority:** Important · **V2 audit:** Kept

**Question:** Rows sharing a check number must balance to the check amount. Can a batch be saved and finished later while it is out of balance? Must it balance before any of it is posted? What should happen when the check pays claims for more than one practice, or includes an amount that cannot be applied to any claim?

**Why clarification is needed:** The balancing rule is the main control against posting errors; whether it blocks saving shapes the whole posting screen.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 22 · **Excerpt:** `payment` — "Rows sharing a check number form a batch that must balance to the check amount."

---

### Q-046 — How are patient money movements handled?

**Question ID:** Q-046 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** For patient payments: should copays taken at the front desk be recorded here, how should an overpayment or a refund be handled, and what happens to a credit that cannot be applied to a charge? Is the patient sent anything, given that patient statements are not part of the data model?

**Why clarification is needed:** Patient money that cannot be applied or must be refunded has legal and accounting consequences.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 22 · **Excerpt:** `payment` — "patient payments are copays and statement payments…"
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "no_statements | boolean | Do not send batch statements."
- **Section:** 10.7 Relations at a glance · **Page:** 24 · **Excerpt:** "Dropped: verification_form, medicare_cap, patient_statement, era_file, account_note…"

---

### Q-047 — Are patient statements in scope?

**Question ID:** Q-047 · **Category:** Functional · **Priority:** Important · **V2 audit:** Kept

**Question:** The patient record has a "do not send batch statements" flag, but the statement table was dropped from the data model and no chapter describes statements. Should the first release produce patient statements or send balances to a statement vendor? If not, how does a patient learn what they owe?

**Why clarification is needed:** Every paid claim can leave a patient balance, and the PRD gives no way to collect it.

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "no_statements | boolean | Do not send batch statements."
- **Section:** 10.7 Relations at a glance · **Page:** 24 · **Excerpt:** "Dropped:… patient_statement…— to be added back when those modules are built."

---

### Q-048 — How is denial work tracked in detail?

**Question ID:** Q-048 · **Category:** Workflow · **Priority:** Important · **V2 audit:** Kept

**Question:** A denial can be appealed, corrected and resent, or written off. For appeals: are multiple appeal levels tracked, with deadlines, and what is recorded about each? For write-offs: is approval required above a certain amount, and who may approve? Should timely-filing deadlines be tracked and warned about?

**Why clarification is needed:** Denials are lost permanently once appeal or filing deadlines pass; tracking them is what the module is for.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 22 · **Excerpt:** `denial` — "…with its reason and remark codes and the work done to resolve it (appeal, correct and resend, write off)." / "status | text | Open, Appealed, Resolved, Written off."

---

### Q-049 — What does month-end close actually do?

**Question ID:** Q-049 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** What does closing a period mean for the business — for example, are charges, payments or adjustments dated in that period blocked from change afterwards? What is checked before a period can be closed, and what reports come out of the close?

**Why clarification is needed:** Closing a period freezes financial figures; what it locks decides what staff can still correct.

**PRD V2 reference:**
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Month End | C R U D | C R | Cannot reopen a closed period."

---

### Q-050 — Which reports are needed, and in what form?

**Question ID:** Q-050 · **Category:** Reporting · **Priority:** Important · **V2 audit:** Kept

**Question:** Which reports must the first release provide? For each, who uses it, what does it cover, what date ranges and filters are needed, and is export required (and in which formats)? Should any report run across all practices of a company, and who may see cross-practice figures?

**Why clarification is needed:** Reports are in the permission matrix but undefined; they are usually the owner's main reason to buy the system.

**PRD V2 reference:**
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Reports | C R U D | R | Granted practices only."
- **Section:** Chapter 11 — Next steps · **Page:** 24 · **Excerpt:** "Analytics & reports"

---

### Q-051 — What belongs on the dashboards?

**Question ID:** Q-051 · **Category:** Reporting · **Priority:** Important · **V2 audit:** Kept

**Question:** Dashboards are listed as in scope but unspecified. Who is each dashboard for (billing staff, practice manager, organization owner), what figures matter most to them, and should the figures be live or refreshed periodically?

**Why clarification is needed:** Dashboards are the first screen each user sees; their content depends on who they are for.

**PRD V2 reference:**
- **Section:** Chapter 11 — Next steps · **Page:** 24 · **Excerpt:** "Dashboards"
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Dashboard | C R U D | R"

---

### Q-052 — Are notifications or reminders required?

**Question ID:** Q-052 · **Category:** Notification · **Priority:** Important · **V2 audit:** Kept

**Question:** Work items carry a due date and a next action. Should the system notify anyone — for example a reminder when an item is due or overdue, an alert when a claim is rejected, or a daily summary of the submission batch? If so, who is notified, by what means (in-app, email), and can people control what they receive?

**Why clarification is needed:** Due dates without reminders rely on people checking queues; notifications also need delivery channels and preferences.

**PRD V2 reference:**
- **Section:** Core product principle · **Page:** 1 · **Excerpt:** "Owner + Status + Priority + Due Date + Next Action + History"
- **Section:** 7.2 Daily submission batch metrics · **Page:** 8 · **Excerpt:** "Clearinghouse rejections — live count of rejection responses…"

---

### Q-053 — What must the audit history record, and who can see it?

**Question ID:** Q-053 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** A View-level user can "view audit history". What should the history contain — every field change with before and after values, or a record of key actions only? Which records need it, who may see it, and how long must it be kept?

**Why clarification is needed:** Audit history is a compliance record; its scope and retention must be decided before the data exists.

**PRD V2 reference:**
- **Section:** 1.4 Access control & granular permissions matrix · **Page:** 3 · **Excerpt:** "User can inspect data, run reports and view audit history, but cannot create or modify records."
- **Section:** 10.1 Overview · **Page:** 12 · **Excerpt:** "…plus created_at, created_by, updated_at, updated_by."

---

### Q-054 — What decides the specialty modifier now that no discipline is recorded?

**Question ID:** Q-054 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Updated — V2 removed case discipline (CH-04a) and moved the rule to insurance classes (CH-02).

**Question:** Insurance classes and insurances can be set to "apply specialty modifiers" (for example GP, GO or GN for physical, occupational or speech therapy). V2 removed the discipline from the case, so what should decide which modifier is applied — the provider's specialty, the procedure code's default modifier, or something else? Are there payers or codes where it must not be applied, and how should a practice that offers more than one therapy be handled?

**Why clarification is needed:** Payers reject therapy claims with a missing or wrong specialty modifier. In V1 the case discipline was the obvious source; in V2 nothing records the discipline of an episode.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `insurance_class` — "authorization_required, injury_date_required, apply_specialty_modifiers, accept_assignment | boolean | | Class-level billing rules; the default for every insurance in the class."
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `provider` — "specialty | text | | PHYSICAL THERAPIST"
- **Section:** 10.3 Setup · **Page:** 17 · **Excerpt:** `procedure_code` — "default_modifier | varchar(2) | | GP"

---

### Q-055 — Are Medicare therapy limits in scope?

**Question ID:** Q-055 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** The data model notes that a Medicare cap table was dropped and will return "when those modules are built". Should the first release track annual therapy limits and the related modifier, and warn when a patient approaches the threshold? Are there other payer-specific limits to track?

**Why clarification is needed:** Missing a Medicare therapy threshold leads to denied claims for the rest of the year.

**PRD V2 reference:**
- **Section:** 10.7 Relations at a glance · **Page:** 24 · **Excerpt:** "Dropped: verification_form, medicare_cap, patient_statement, era_file, account_note — to be added back when those modules are built."

---

### Q-056 — Is data migration from the current system in scope?

**Question ID:** Q-056 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** The data model mentions a "data conversion" service account. Should existing data be migrated into the new platform — patients, cases, open claims, balances, history — and from which system? What volume, and how far back?

**Why clarification is needed:** Migration of open claims and balances is often as large as the build itself.

**PRD V2 reference:**
- **Section:** 10.2 Organization and users · **Page:** 13 · **Excerpt:** `app_user` — "Service accounts (EMR import, data conversion) are rows here too, so every record has an author."

---

### Q-057 — Which date qualifiers are used in boxes 14 and 15?

**Question ID:** Q-057 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** Box 14 carries the onset or injury date "with qualifier", and box 15 carries an "available date with corresponding qualifier (mostly accident date)". Which qualifier codes should be used in each case, and what decides which date goes into box 15?

**Why clarification is needed:** Payers reject dates that carry the wrong qualifier.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 9 · **Excerpt:** "14 | N | Case | Onset / injury date, with qualifier." / "15 | N | Case | Available date with corresponding qualifier (mostly accident date)."

---

### Q-058 — Which authorization number appears in box 23?

**Question ID:** Q-058 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Updated — Reference updated for CH-06; question unchanged.

**Question:** Box 23 carries an authorization reference number. When a case has more than one authorization covering the date of service, which number should be printed — the one the visit consumed, or another? Should box 23 stay empty when the payer does not require authorization?

**Why clarification is needed:** Printing an authorization the visit did not use, or none when one is required, leads to denials.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "23 | N | Case / insurance (auth) | Authorization reference number."
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "Optional. Consumed by this visit when the payer requires authorization."

---

### Q-059 — Whose NPI goes in box 24J, and what is the "other ID"?

**Question ID:** Q-059 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** Box 24J is described as "Provider NPI and other ID" from the provider profile. Should this be the rendering (treating) provider for each service line? What is the "other ID" and its qualifier in box 24I, and which payers require it?

**Why clarification is needed:** Box 24J identifies who performed each service; the wrong NPI is a common rejection reason.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "24I | N | Provider profile | Other ID qualifier." / "24J | Y (Other ID: N) | Provider profile | Provider NPI and other ID."

---

### Q-060 — Which NPI belongs in box 32a?

**Question ID:** Q-060 · **Category:** Data · **Priority:** Important · **V2 audit:** Kept

**Question:** Box 32 prints the clinic name and address, while box 32a is mapped to the organization's group NPI. Should box 32a carry the location's own NPI where the location has one, or always the practice's group NPI?

**Why clarification is needed:** Payers validate the service-facility NPI against their enrolment records.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "32a | Y | Organization | Group NPI."
- **Section:** 10.2 Organization and users · **Page:** 13 · **Excerpt:** `location` — "npi | char(10)"

---

### Q-061 — Is box 11a mandatory when the patient is the insured?

**Question ID:** Q-061 · **Category:** Validation · **Priority:** Important · **V2 audit:** Kept

**Question:** Box 11a (the insured's date of birth and gender) is marked mandatory, while box 4 (the insured's name) is also mandatory. When the patient is the insured, should these boxes repeat the patient's details, or be left blank as many payers expect?

**Why clarification is needed:** Repeating or omitting the insured's details is payer-specific and a frequent rejection cause.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 8–9 · **Excerpt:** "4 | Y | Insurance | Insured name." / "11a | Y | Insurance | Insured DOB and gender."

---

### Q-062 — What does a provider claim hold do, exactly?

**Question ID:** Q-062 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** Kept

**Question:** A provider can be put on claim hold with a date. Does the date mean "hold visits with a date of service before this date" or "hold all of this provider's visits until this date"? When the hold ends or is cleared, are the delayed visits released automatically? Can a hold apply to one payer only, for example while credentialing with that payer is pending?

**Why clarification is needed:** The date semantics decide which visits are delayed and when they are billed.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `provider` — "claim_hold_until | date | Null = no hold. Visits before this date are delayed." / "A provider can be put on claim hold (for example while credentialing is pending)…"

---

### Q-077 — What happens to claims already waiting in a bucket when its setup changes?

**Question ID:** Q-077 · **Category:** Edge Case · **Priority:** Important · **V2 audit:** New in V2 — caused by CH-03.

**Question:** What should happen to claims already waiting in a release bucket when (a) the insurance hold is unchecked, (b) the insurance is moved to a different bucket, or (c) the bucket is deactivated? Should waiting claims go out automatically, move with the insurance, or stay until released? Can a bucket be deactivated while insurances are still assigned to it?

**Why clarification is needed:** V2 states only that inactive buckets "cannot be assigned to new insurances". Without a rule, changing setup could silently strand or release claims.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15–16 · **Excerpt:** `insurance` — "insurance_hold | boolean | | Check mark. True = claims for this payer require manual release."
- **Section:** 10.3 Setup · **Page:** 15–17 · **Excerpt:** `release_bucket` — "is_active | boolean | | Inactive buckets cannot be assigned to new insurances."

---

### Q-078 — Can a case or claim carry both a referring and a supervising physician?

**Question ID:** Q-078 · **Category:** Data · **Priority:** Important · **V2 audit:** New in V2 — Replaces the residual part of retired Q-023 (CH-12).

**Question:** V2 records supervising physicians in the referring-physician directory with type "Supervising (DQ)", but a case links to only one referring physician and a claim snapshots only one. When a visit needs both a referring physician and a supervising provider, how should both be recorded, and which appears in Box 17?

**Why clarification is needed:** Box 17 holds one name with one qualifier. Payers that require supervision may also require the referring physician elsewhere, and the data model allows only one.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 18 · **Excerpt:** `referring_physician` — "type | text | | Referring (DN) or Supervising (DQ); sets the Box 17 qualifier."
- **Section:** 10.4 Patient · **Page:** 18–19 · **Excerpt:** `patient_case` — "referring_physician_id | bigint | FK → referring_physician | Required for billing."
- **Section:** 3.3 Provider taxonomy & roles · **Page:** 4 · **Excerpt:** "Supervising provider | Required by payer rules, state regulations or mid-level billing (uncommon). | NPI, Box 17 qualifier"

---

### Q-079 — Can place of service differ between the lines of one visit, and which one decides Box 32?

**Question ID:** Q-079 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New in V2 — Replaces the residual part of retired Q-039 (CH-10).

**Question:** V2 stores place of service on each charge line, defaulting from the location. May lines on the same visit have different places of service (for example one line by telehealth)? Box 32 prints the clinic address for every place of service except home and telehealth — which line's value decides that when they differ? Who may change a line's place of service?

**Why clarification is needed:** Box 32 is a single value for the whole claim, while V2 allows a value per line; the claim could otherwise print contradictory information.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `charge_line` — "place_of_service | char(2) | | CMS-1500 Box 24B. Defaults from location.place_of_service."
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "32 | Conditional | Clinic profile | Clinic name and address for all POS except patient home or telehealth (02, 10, 12)."

---

### Q-081 — How do insurance-class settings take effect?

**Question ID:** Q-081 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New in V2 — caused by CH-02.

**Question:** Each insurance inherits its billing rules from its class unless it overrides them. When a class setting changes, should it affect claims already released, held or waiting in a bucket, or only claims scrubbed afterwards? Can an insurance be moved to a different class, and what happens to its overrides? How does the class relate to the separate "insurance type" (claim filing indicator) — should they always agree?

**Why clarification is needed:** A class change can alter authorization and injury-date requirements for many payers at once. The insurance also keeps an "insurance type" that overlaps in values with the class (Medicare, Workers' Comp), so the two could conflict.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `insurance_class` — "A group of insurances that share billing rules (Medicare, Blue Shield, Workers' Comp, Auto…)."
- **Section:** 10.3 Setup · **Page:** 16 · **Excerpt:** `insurance` — "Null = inherit from insurance_class. Effective value = COALESCE(insurance, class)." / "insurance_type | text | | Claim filing indicator: Medicare, Commercial, WC…"

---

### Q-082 — What happens when the EMR sends a charge with an inactive procedure code?

**Question ID:** Q-082 · **Category:** Edge Case · **Priority:** Important · **V2 audit:** New in V2 — caused by CH-13.

**Question:** V2 says inactive procedure codes "cannot be added to new charge lines". When a finalized EMR note arrives with a code that has been deactivated, should the charge be refused, raised as a billing exception, or accepted because it came from the clinical record?

**Why clarification is needed:** The billing-exceptions list covers codes that are missing a price, but not codes that exist and are inactive. EMR charges are created automatically, so the rule for manual entry does not obviously apply.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15–17 · **Excerpt:** `procedure_code` — "is_active | boolean | | Inactive codes cannot be added to new charge lines."
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Identifies newly ingested CPT / HCPCS codes missing from both Payer-Specific and Default Fee Schedules."

---

### Q-084 — Which referring physician does a corrected claim carry?

**Question ID:** Q-084 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New in V2 — caused by CH-11.

**Question:** Each claim keeps a snapshot of the case's referring physician taken when the claim is created. If the case's referring physician is corrected afterwards, should a corrected (replacement) claim use the original snapshot or the case's current referring physician? Should staff be able to change the snapshot on a claim that has not yet been sent?

**Why clarification is needed:** A wrong referring physician is a common rejection reason, and a correction is usually the reason for resending. The snapshot rule protects history but could also repeat the error.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `claim` — "referring_physician_id | bigint | FK → referring_physician | Snapshot from the case at claim creation; goes to Box 17 / 17b."
- **Section:** 5.2 Updated charges queue · **Page:** 6 · **Excerpt:** "2. Create corrected claim | Pre-populates CMS-1500 Box 22 with the Original Reference Number and Resubmission Frequency Code (7 – Replacement, 8 – Void)."

---

### Q-085 — What data exists in a brand-new installation and in a newly created practice?

**Question ID:** Q-085 · **Category:** Data · **Priority:** Important · **V2 audit:** New — raised while modelling a fresh installation (2026-09-17).

**Question:** When the Billing System is installed, and when a new practice is created in it, which records already exist and which must staff enter? In particular: (a) is the CPT / HCPCS procedure-code list delivered pre-loaded, and with default fees; (b) does a "System Default Fee Schedule" exist before anyone enters prices, and who maintains it; (c) are the standard ICD-10, CARC / RARC and place-of-service code sets loaded as lookups; (d) are any insurance classes (for example Commercial, Medicare, Workers' Comp) created automatically; (e) is an accounting period opened automatically for a new practice, and which one?

**Why clarification is needed:** V2 names only two seeded records — the System Admin and Practice Admin roles. Everything else a practice needs before its first claim is either shared reference data with no stated source, or practice data with no stated default. The answer decides the go-live checklist, data-conversion scope and how long onboarding a new practice takes.

**PRD V2 reference:**
- **Section:** 10.2 Organization and users · **Page:** 14 · **Excerpt:** "Two roles are seeded: System Admin (all modules, all flags, every practice) and Practice Admin (see §10.6)."
- **Section:** 10.3 Setup · **Page:** 17 · **Excerpt:** `procedure_code` — "Shared reference data, not owned by a practice."
- **Section:** 3.4 CPT / HCPCS fee schedule engine · **Page:** 4 · **Excerpt:** "The System Default Fee Schedule is overridden by a Payer-Specific Fee Schedule when one is assigned to an active insurance case."
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `case` — "Ordered ICD-10 list, up to 12; position = diagnosis pointer."
- **Section:** 10.5 Billing · **Page:** 22 · **Excerpt:** `payment` — "CARC for adjustments (CO-45)."
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Cannot reopen a closed period."

---

### Q-086 — Who creates the first account and the first practice on a new installation?

**Question ID:** Q-086 · **Category:** Permissions · **Priority:** Important · **V2 audit:** New — raised while modelling a fresh installation (2026-09-17).

**Question:** On a new installation, how does the first System Admin account come to exist (created by the vendor, by an installer, by an invitation to the client)? Who then creates the first practice and its primary location — the vendor, or the client's own System Admin? Is the "requester" who supplies practice metadata during account initialization a Billing System user, or someone outside the system?

**Why clarification is needed:** Only a System Admin may create practices, and a Practice Admin can only work inside practices already granted to them. V2 says a primary location is mandatory "during initial account creation" but not who performs that step or how the first user is created, so the very first hour of a client's use of the system is undefined.

**PRD V2 reference:**
- **Section:** 1.1 Practice onboarding requirements · **Page:** 2 · **Excerpt:** "Whenever an account is initialized for either the EMR or the Billing platform, the requester must supply the following practice-level metadata:"
- **Section:** 1.2 Facility (location) setup · **Page:** 2 · **Excerpt:** "At least one primary facility location is mandatory during initial account creation."
- **Section:** 10.2 Organization and users · **Page:** 13 · **Excerpt:** `user` — "A person or system account that logs in."
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Manages setup and users of granted practices; cannot create practices or grant System Admin."

---

### Q-087 — How far should a provider hold reach?

**Question ID:** Q-087 · **Category:** Workflow · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked for a provider hold with a start date, an end date, a reason, the locations it affects and the insurances it affects. V2 has one date and holds everything before it. For the scoped version: does a hold stop charge entry, claim submission, or both? If only some locations or insurances are held, what happens to that provider's other visits — are they billed normally? What happens to visits already held when the end date passes: do they release themselves, or does someone review them? Can a hold be entered in advance, and does it apply to dates of service inside the window or to work done inside it?

**Why clarification is needed:** A hold decides whether money is billed or stopped. Today one date delays every visit of that provider; scoping it by location and payer changes which claims go out and when, and the prototype would be inventing that rule.

**Answered (client, 2026-09-23):** a hold runs between a start date and an end date, and it stops **both** billing and submission — visits inside the window wait in Delayed, and claims already created stop in the new Provider hold. When the end date passes, the provider's work flows normally again with no review step. The locations and insurances named on the hold narrow it; naming none covers all of them (A-P56). Open date questions — whether a hold may be entered for a future window and what it means for work done outside the window — are answered by the same rule: the window is read against the date of service.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `provider` — "Null = no hold. Visits before this date are delayed."
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Credentialing"

**Related:** Q-062 asks what a provider claim hold does at all; this asks how a scoped hold should behave.

---

### Q-088 — What replaces payer enrollment, and what feeds the credentialing check?

**Question ID:** Q-088 · **Category:** Business Rule · **Priority:** Critical · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked to replace the provider's "Payer enrollment" section with an "Add rule" option. Enrollment is what the credentialing check reads today: per payer, a status and an effective date. If it is removed, where does the credentialing check get its answer — from the new rules, from the clearinghouse, or is the check dropped? And what is a provider "rule": which conditions can it test, and what does it do when it matches?

**Why clarification is needed:** Credentialing is one of the six scrubbing checks V2 requires. Removing its only data source would silently disable a required check, and "rule" has no definition yet.

**PRD V2 reference:**
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Credentialing"
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `provider` — "A clinician who bills or treats: name, credentials, NPI, specialty."

**Related:** Q-010 — where credentialing status comes from.

---

### Q-089 — What does "Audit required" mean on an insurance?

**Question ID:** Q-089 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked for an "Audit required" checkbox on an insurance. What should it do? For example: hold the payer's claims for someone to review before submission, require documentation to be attached, mark the payer as being audited, or flag its remittances for checking? Who acts on it, and does it change any queue?

**Why clarification is needed:** As a flag alone it changes nothing; as a hold it changes when claims go out. The two readings produce very different systems, so the field was not added yet.

**Answered (client, 2026-09-23):** both — hold the claim for review *and* require documents. A payer marked Audit required stops its claims in the Audit hold after scrubbing; a reviewer records which documents were attached (plan of care, progress note, daily notes, referral, authorisation letter, itemised statement) and may add a note, and only then is the claim submitted. The record stays on the claim with the reviewer's name (A-P57).

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 16 · **Excerpt:** `insurance` — "Null = inherit from insurance_class. Effective value = COALESCE(insurance, class)."

---

### Q-090 — Which scheduling options does submission need?

**Question ID:** Q-090 · **Category:** Workflow · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting said the scheduled-submission options need "more customization" than off / hourly / every four hours / daily at 18:00. What is missing — a specific time of day, several runs a day, particular weekdays, a cut-off after which charges wait for the next run, or a different schedule per practice or per payer?

**Why clarification is needed:** "More customization" cannot be built without knowing which dimension matters. Each option changes when claims leave and how the daily batch figures are counted.

**Answered (client, 2026-09-23):** the missing part was simply a way to fill the dropdown. Admin → Submission & automation now keeps the list of options the practice may choose from — every few hours, every day at a time, or weekdays at a time — and a System Admin adds or removes them. The schedule in use cannot be removed. The job itself is still one practice-wide schedule; per-payer or per-location runs were not asked for (A-P58).

**PRD V2 reference:**
- **Section:** 5.1 Charge ingestion queue · **Page:** 6 · **Excerpt:** "Supports single submission, bulk submission, or automated scheduled submission."

**Related:** Q-041 — how scheduled submission should be configured (scope, time zone, owner).

---

### Q-091 — Should patient statement preferences be dropped?

**Question ID:** Q-091 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked to remove the "Billing preferences" section from the patient record. Its only field is the V2 column that says a patient should not receive batch statements. Should that column go too — meaning statements are out of scope for the first release — or should the setting live somewhere else, such as the guarantor?

**Why clarification is needed:** The field is in the V2 data model. Removing the only place it can be set would leave a column nothing can fill, and would quietly decide that patient statements are not part of the release.

**Answered (client, 2026-09-23):** remove it. The Billing preferences section is gone from the patient form and the chart, and no patient record carries a statement preference. The V2 `no_statements` column is therefore not implemented. Q-047 — whether patient statements are in scope at all — stays open.

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "Do not send batch statements."

**Related:** Q-047 — are patient statements in scope.

---

### Q-092 — With "Other" removed, what do Boxes 10a–10c say?

**Question ID:** Q-092 · **Category:** Validation · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked to remove "Other" from Related cause and to leave the field empty until someone chooses. Every case today is "Other", which is how the claim answers "no" to employment, auto and other accident. If the field can be empty, what do Boxes 10a, 10b and 10c print, and can a claim be submitted at all with no cause chosen? Should existing cases be migrated to a different value?

**Why clarification is needed:** Boxes 10a–10c are mandatory on the CMS-1500 and must carry a yes or no. An empty cause leaves the claim without an answer.

**Answered (client, 2026-09-23):** remove it; the logic around an empty cause is handled here. Related cause now offers employment and auto only and may be left empty. An empty cause prints NO in Boxes 10a, 10b and 10c, keeps the injury date optional unless the payer's class requires it (Box 14), and closes the accident state. Every seeded case that was "Other" is now empty (A-P54).

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 field mapping · **Page:** 9 · **Excerpt:** "Related cause."
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `patient_case` — "Employment Related, Auto, Other."

---

### Q-093 — Is "Ready to submit" really manual submission only?

**Question ID:** Q-093 · **Category:** Other · **Priority:** Nice to clarify · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked to rename the "Ready to submit" tab to "Manual submission". The same queue is also what the scheduled job takes claims from, and "Manual Submission" was the name of a V1 hold that V2 replaced with release buckets. Should the tab be renamed anyway, should the scheduled job be moved elsewhere, or is a different name meant — for example "Ready to bill"?

**Why clarification is needed:** The name would describe only part of what the queue does, and would reuse a term the PRD retired, which is likely to confuse staff trained on V1.

**PRD V2 reference:**
- **Section:** 5.1 Charge ingestion queue · **Page:** 6 · **Excerpt:** "Supports single submission, bulk submission, or automated scheduled submission."

---

### Q-094 — Which claim does the "original claim number" at release belong to?

**Question ID:** Q-094 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked for an "Original claim number" input in the release dialog. Releasing a charge creates the first claim for that visit, which has no earlier claim. Is this meant for corrected and void claims, which already carry the original reference in Box 22? Or is it a payer's own claim number being recorded when a claim is re-sent? Is it required or optional, who types it, and should it be validated against claims already in the system?

**Why clarification is needed:** The Box 22 reference is generated when a corrected claim is created. Adding a free-text original number at release could produce two competing sources for the same field.

**PRD V2 reference:**
- **Section:** 5.2 Updated charges queue · **Page:** 6 · **Excerpt:** "2. Create corrected claim | Pre-populates CMS-1500 Box 22 with the Original Reference Number and Resubmission Frequency Code (7 – Replacement, 8 – Void)."

**Related:** Q-019 — where the Original Reference Number comes from.

---

### Q-095 — What do mail, fax and portal mean when a bucket is released?

**Question ID:** Q-095 · **Category:** Workflow · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked for Mail, Fax and Portal options on bucket release. V2 sends claims to the clearinghouse electronically or prints a CMS-1500. Are these delivery methods for the printed claim, or separate submission channels? If a claim is faxed or entered on a payer portal, what status does it take, what is recorded as proof, how is the payer's answer expected back, and does the payer SLA clock still run?

**Why clarification is needed:** A claim that leaves by fax or portal never passes the clearinghouse, so acknowledgement, rejection and remittance handling do not apply to it. That is a different lifecycle, not an option on a button.

**PRD V2 reference:**
- **Section:** 7.1 Claim lifecycle · **Page:** 8 · **Excerpt:** "Claims successfully validated, compiled into EDI 837 files or PDF print queues, and dispatched to Waystar."
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Manual release required"

**Related:** Q-040 — what decides whether a claim goes electronically or on paper.

---

### Q-096 — Should the referring-physician code be removed?

**Question ID:** Q-096 · **Category:** Data · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** The meeting asked to remove both the Code and the Taxonomy from a referring physician. Taxonomy was removed: the V2 table does not have it, although chapter 3 mentions it. Code is a column in the V2 table and is unique per practice, so it was kept. Should the code be removed as well, and if so what identifies a referring physician in imports and searches — the NPI alone?

**Why clarification is needed:** Removing a unique key changes how the directory is matched and de-duplicated, especially for records arriving from the EMR.

**Answered (client, 2026-09-23):** remove it. Neither the code nor the taxonomy is captured any more, and no seeded physician carries either. A referring physician is identified by name and NPI; the V2 `code` column is not implemented, and how imported records are matched is left to the build (A-P55).

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 18 · **Excerpt:** `referring_physician` — "UQ per practice"
- **Section:** 3.2 Case profile object · **Page:** 4 · **Excerpt:** "Referring physician — linked directory profile containing name, NPI, taxonomy, practice name, address, phone / fax and referral orders."

---

### Q-097 — Which coding rule wins: payer, class or default?

**Question ID:** Q-097 · **Category:** Business Rule · **Priority:** Important · **V2 audit:** New — raised by meeting notes (2026-09-23).

**Question:** Coding rules can now be written for one insurance or for a whole insurance class. When a code is matched by a class rule and by a payer rule, which one applies? The prototype assumes the payer's own rule wins, then the class rule, then the default rule — the order V2 uses for billing rules. Please confirm, and say whether rules from several levels should ever combine rather than override.

**Why clarification is needed:** Precedence decides which codes actually leave on a claim. V2 names default and payer-specific rules only, so the class level and its order are an assumption.

**PRD V2 reference:**
- **Section:** 6.1 Coding rules engine · **Page:** 7 · **Excerpt:** "Replace rule. Converts specified CPT / HCPCS codes to alternative codes based on Default System Rules or Payer-Specific Rules."
- **Section:** 10.3 Setup · **Page:** 16 · **Excerpt:** "Null = inherit from insurance_class. Effective value = COALESCE(insurance, class)."

**Related:** Q-013 — how coding rules are defined and what they change.

---


## 4. Nice-to-Clarify Questions

*The system could be built without these answers, but confirming them would reduce rework.*

### Q-063 — Who writes the box 19 comment, and when?

**Question ID:** Q-063 · **Category:** Functional · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** Box 19 holds a free-text comment per claim. Who writes it, at what point in the workflow, and are there standard comments that should be offered? Is there a length limit?

**Why clarification is needed:** Box 19 is used for payer-required notes; free text without rules can cause rejections.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 9 · **Excerpt:** "19 | N | Custom comment | Free-text comment per claim."

---

### Q-064 — Where is "accept assignment" set?

**Question ID:** Q-064 · **Category:** Data · **Priority:** Nice to Clarify · **V2 audit:** Updated — V2 moved the rule to class level with per-insurance override (CH-02).

**Question:** Box 27 defaults to Yes "unless set to NO in billing / EMR". In V2 accept assignment is a class-level default that each insurance may override. Should Box 27 always follow that effective payer setting, or can it also be changed for a single claim, and does "set to NO in … EMR" mean the EMR can override it per visit?

**Why clarification is needed:** An assignment flag that is wrong changes who the payer pays — the practice or the patient.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "27 | Y | System default | Yes by default unless set to NO in billing / EMR."
- **Section:** 10.3 Setup · **Page:** 16 · **Excerpt:** `insurance` — "Null = inherit from insurance_class. Effective value = COALESCE(insurance, class)."

---

### Q-065 — How closely should the exceptions module follow the WebPT guide?

**Question ID:** Q-065 · **Category:** Functional · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** The billing-exceptions section names the WebPT Billing Exceptions Guide as its reference standard. Is that guide the required behaviour to match, or an example for inspiration? Are there exception types in that guide which are deliberately excluded here?

**Why clarification is needed:** "Reference standard" could mean matching every WebPT behaviour or borrowing ideas; the build effort differs greatly.

**PRD V2 reference:**
- **Section:** 4.4 Billing exceptions · **Page:** 5 · **Excerpt:** "Reference standard: WebPT Billing Exceptions Guide."

---

### Q-066 — Who maintains the procedure-code list?

**Question ID:** Q-066 · **Category:** Data · **Priority:** Nice to Clarify · **V2 audit:** Updated — V2 added procedure type and active flag (CH-13). The inactive-code edge case is Q-082.

**Question:** Procedure codes are shared reference data with a single default fee and, in V2, an active flag — not owned by a practice. Who maintains this list and the annual code updates? Since the code list and its active flag are shared, who may deactivate a code, and should practices be able to set their own default fee?

**Why clarification is needed:** Deactivating a shared code affects every practice at once, and the default fee is used whenever a payer has no price.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 15–17 · **Excerpt:** `procedure_code` — "Shared reference data, not owned by a practice." / "is_active | boolean | | Inactive codes cannot be added to new charge lines."
- **Section:** 4.4 Billing exceptions · **Page:** 6 · **Excerpt:** "Identifies newly ingested CPT / HCPCS codes missing from both Payer-Specific and Default Fee Schedules."

---

### Q-067 — What should happen when two people edit the same record?

**Question ID:** Q-067 · **Category:** Edge Case · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** If two users open the same claim, visit or check batch and both save, should the second save be blocked, merged, or allowed to overwrite? Are there records where simultaneous work is likely enough to need a lock, for example a check batch being posted?

**Why clarification is needed:** Two people posting the same check or editing the same claim can double-count money.

**PRD V2 reference:**
- **Section:** 10.1 Overview · **Page:** 12 · **Excerpt:** "…plus created_at, created_by, updated_at, updated_by."

---

### Q-068 — Can a practice or location be deactivated, and what then?

**Question ID:** Q-068 · **Category:** Business Rule · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** Practices and locations both carry an active flag. What should happen to open claims, balances and user access when either is deactivated? Can a practice's last active location be deactivated?

**Why clarification is needed:** Deactivating a site with open claims could hide money still owed.

**PRD V2 reference:**
- **Section:** 10.2 Organization and users · **Page:** 12 · **Excerpt:** `practice` and `location` — "is_active | boolean"
- **Section:** 1.2 Facility (location) setup · **Page:** 2 · **Excerpt:** "At least one primary facility location is mandatory during initial account creation."

---

### Q-069 — How is the guarantor used?

**Question ID:** Q-069 · **Category:** Data · **Priority:** Nice to Clarify · **V2 audit:** Updated — V2 removed the emergency contact (CH-14a).

**Question:** The patient record holds a guarantor (responsible party) "who receives statements". Where else is the guarantor used in billing — for example, does the guarantor's address ever replace the patient's on a claim, and what is required when the guarantor is not the patient?

**Why clarification is needed:** The guarantor affects who is billed for the patient's share. (V2 removed the emergency contact, so that part of the V1 question no longer applies.)

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "the guarantor (responsible party) who receives statements" / "guarantor | jsonb | | Responsible party: name, address, dob, relationship. Null = the patient."

---

### Q-070 — Who can see internal notes?

**Question ID:** Q-070 · **Category:** Permissions · **Priority:** Nice to Clarify · **V2 audit:** Updated — V2 added charge-line notes (CH-10b).

**Question:** V2 has internal comment fields on the patient and on each charge line. Are these visible to every user with access to the record, or should they be restricted? Can they be edited or deleted after they are written, and should a charge-line note ever travel onto the claim?

**Why clarification is needed:** Internal notes often hold sensitive remarks; visibility and permanence need to be decided before the fields are built.

**PRD V2 reference:**
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "notes | text | | Internal comment."
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `charge_line` — "notes | text, nullable | | Optional internal comment."

---

### Q-071 — How long are inactive records kept, and who sees them?

**Question ID:** Q-071 · **Category:** Data · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** Superseded records remain viewable in an Inactive Records section. Should they be kept indefinitely, and who may view them? Should the previous version stay comparable side by side with the record that replaced it?

**Why clarification is needed:** Retention rules affect storage, privacy obligations and what auditors can see.

**PRD V2 reference:**
- **Section:** 4.2 Automated record reconciliation · **Page:** 5 · **Excerpt:** "The superseded record becomes inactive and is viewable in the Inactive Records section."

---

### Q-072 — How should claims be numbered?

**Question ID:** Q-072 · **Category:** Data · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** Is there a required format for the claim number or patient account number that appears on the claim (box 26), for example to match the EMR or the current system? Must numbers be unique per practice or across the whole platform?

**Why clarification is needed:** Claim and account numbers are how payers and patients refer back to a bill.

**PRD V2 reference:**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 9–10 · **Excerpt:** "26 | Y | Patient chart | Internal patient ID."
- **Section:** 10.4 Patient · **Page:** 18 · **Excerpt:** `patient` — "emr_id… 56361649 — EMR sync key. patient_id is the Billing ID."

---

### Q-073 — What are the expected volumes and performance targets?

**Question ID:** Q-073 · **Category:** Other · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** How many practices, locations, users, visits per day and claims per month should the first release support? Are there busy periods, and are there expectations about how quickly screens and batch submissions should complete?

**Why clarification is needed:** Volumes decide architecture and batch design; performance targets decide acceptance.

**PRD V2 reference:**
- **Section:** Document introduction · **Page:** 1 · **Excerpt:** "Chapters 1–9 state what the platform must do; chapter 10 states the data it stores; chapter 11 lists the work not yet specified."

---

### Q-074 — Is there an approval step anywhere in the flow?

**Question ID:** Q-074 · **Category:** Workflow · **Priority:** Nice to Clarify · **V2 audit:** Kept

**Question:** The workflows described move from review to release to submission without a separate approval. Are there cases where a second person must approve before money-related actions — for example a large write-off, a refund, or reopening a closed period?

**Why clarification is needed:** Approval steps change workflows and permissions around money movements.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "…then moves through review: Review → Pended (something missing) or Delayed (provider hold) → Released for claiming."
- **Section:** 10.6 User permissions · **Page:** 22–23 · **Excerpt:** Practice Admin limits column

---

### Q-083 — What are procedure types used for?

**Question ID:** Q-083 · **Category:** Data · **Priority:** Nice to Clarify · **V2 audit:** New in V2 — caused by CH-13.

**Question:** V2 adds a category to each procedure code (Evaluation, Therapeutic, Modality, Supply / DME…). Is the list fixed, and who defines it? Does the category change any behaviour — reports, scrubbing, unit caps, or how supplies are billed — or is it for grouping only?

**Why clarification is needed:** If categories drive behaviour they need an agreed list and rules; if they are labels only, they can be kept simple.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 17 · **Excerpt:** `procedure_code` — "procedure_type | text | | Category of the code: Evaluation, Therapeutic, Modality, Supply / DME…"

---


## 5. Contradictions

*Two or more parts of PRD V2 appear inconsistent. Each is stated neutrally; we are not proposing which one is correct.*

### C-001 — Two different permission models

**Question ID:** C-001 · **Category:** Contradiction · **Priority:** Critical · **V2 audit:** Kept

**Conflict:** Chapter 1 describes permissions set **per user and per section**, in three tiers, capable of hiding an individual data field. Chapter 10 stores permissions **per role and per module** as create/read/update/delete flags, and states that access is decided by the user's role plus their list of practices. The two produce different screens, different administration and different levels of granularity.

**Reference A (PRD V2):**
- **Section:** 1.4 Access control & granular permissions matrix · **Page:** 3 · **Excerpt:** "Permissions are enforced per user and per section across the organization or practice using a three-tier model" / "The module section, tab or data field is completely masked and inaccessible in the UI."

**Reference B (PRD V2):**
- **Section:** 10.2 Organization and users · **Page:** 14 · **Excerpt:** `role` — "Permissions are stored as one JSON object per role, keyed by module, with create / read / update / delete flags…"
- **Section:** 10.6 User permissions · **Page:** 22 · **Excerpt:** "A request is allowed when two things hold: the user's role permits the action on that module (role.permissions), and the record belongs to a practice in the user's user_practice list…"

**Question for Client:** Should permissions be granted per role or per individual user, and is hiding an individual field (rather than a whole module) required? If both are needed, how should they work together?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-002 — Three different sets of role names

**Question ID:** C-002 · **Category:** Contradiction · **Priority:** Critical · **V2 audit:** Kept

**Conflict:** Chapter 1 names Organization Admins and Practice Admins. Chapter 2 introduces a Domain Admin who raises integration requests and elects locations. Chapter 10 seeds System Admin and Practice Admin and defines permissions for those two only.

**Reference A (PRD V2):**
- **Section:** 1.3 User provisioning & clinician profile rules · **Page:** 2 · **Excerpt:** "System users are designated as Organization Admins (top-level, cross-practice visibility) or Practice Admins."

**Reference B (PRD V2):**
- **Section:** 2.2 Domain Admin request & location linking workflow · **Page:** 3 · **Excerpt:** "Integration begins with a formal request raised by a Domain Admin in the administrative portal."
- **Section:** 10.2 Organization and users · **Page:** 14 · **Excerpt:** `role` — "Two roles are seeded: System Admin (all modules, all flags, every practice) and Practice Admin (see §10.6)."

**Question for Client:** What is the full list of roles for the first release, and what can each one do? In particular, are "Organization Admin", "Domain Admin" and "System Admin" three distinct roles or different names for the same people?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-003 — Two different claim state vocabularies

**Question ID:** C-003 · **Category:** Contradiction · **Priority:** Critical · **V2 audit:** Kept

**Conflict:** Chapter 7 defines four lifecycle states (Fresh/Updated, Scrubbing, Hold, Submitted). The `claim` table stores six different values (Scrubbed, Failed, Rejected, Sent, Paid, Denied). Neither list contains the other: chapter 7 has no Paid, Denied or Rejected state; the table has no Hold state, although hold queues are central to chapters 6 and 7.

**Reference A (PRD V2):**
- **Section:** 7.1 Claim lifecycle states · **Page:** 8 · **Excerpt:** "1. Fresh / Updated… 2. Scrubbing… 3. Hold… 4. Submitted"

**Reference B (PRD V2):**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `claim` — "status | text | Scrubbed, Failed, Rejected, Sent, Paid, Denied."

**Question for Client:** What is the single list of claim statuses the business wants to see, and how do the hold queues fit into it?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-004 — One claim per payer per visit, yet corrected, void and duplicate claims are allowed

**Question ID:** C-004 · **Category:** Contradiction · **Priority:** Critical · **V2 audit:** Kept

**Conflict:** The data model allows only one claim per visit and payer. The Updated Charges queue allows a corrected claim (frequency 7), a void (frequency 8) and "submit anyway" as a fresh claim — each of which would be an additional claim to the same payer for the same visit.

**Reference A (PRD V2):**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `claim` — "visit_id | bigint | FK → visit | UQ (visit_id, case_insurance_id)."

**Reference B (PRD V2):**
- **Section:** 5.2 Updated charges queue · **Page:** 6 · **Excerpt:** "2. Create corrected claim… (7 – Replacement, 8 – Void)." / "3. Submit anyway | Overrides the update logic and force-submits as a fresh claim."

**Question for Client:** Should the system keep the history of every claim sent for a visit (original, corrected, void), or only the current one? And with "submit anyway", how should the risk of the payer treating it as a duplicate be handled?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-005 — Reconciliation by record ID, yet the record ID is not stored and only one visit per day is allowed

**Question ID:** C-005 · **Category:** Contradiction · **Priority:** Critical · **V2 audit:** Kept

**Conflict:** Reconciliation depends on an Internal Record ID with a 1:1 relationship to a medical note, and the arrival of an existing ID replaces the record in the pipeline. The `visit` table has no column for that ID, and allows only one visit per case per date of service — so a second note for the same case on the same day, or a replacement note, has nowhere to go.

**Reference A (PRD V2):**
- **Section:** 4.2 Automated record reconciliation · **Page:** 5 · **Excerpt:** "…the system looks up the Internal Record ID, which maintains a 1:1 relationship with a specific medical note" / "Replaces the existing record in the pipeline."

**Reference B (PRD V2):**
- **Section:** 10.5 Billing · **Page:** 20 · **Excerpt:** `visit` — "case_id | bigint | FK → patient_case | UQ (case_id, date_of_service)."

**Question for Client:** Can a patient have two billable sessions for the same case on the same day (for example two disciplines, or a morning and afternoon visit)? And should the EMR's note identifier be stored against the visit so a re-sent note can be matched?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-006 — The referring physician is required for billing but optional on the claim

**Question ID:** C-006 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** Updated — V2 answered what "type" means (Referring DN / Supervising DQ, CH-12); the required-versus-optional conflict remains.

**Conflict:** The case profile and the data model both state that a referring physician is required for billing, and V2 now snapshots it onto every claim. The CMS-1500 mapping still marks box 17 and box 17b as optional ("N").

**Reference A (PRD V2):**
- **Section:** 3.2 Case profile object · **Page:** 4 · **Excerpt:** "Name, type and NPI are required for billing."
- **Section:** 10.4 Patient · **Page:** 18–19 · **Excerpt:** `patient_case` — "referring_physician_id | bigint | FK → referring_physician | Required for billing."

**Reference B (PRD V2):**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 9 · **Excerpt:** "17 | N | Case + referring physician profile…" / "17b | N | Referring physician | NPI."

**Question for Client:** Must every case have a referring physician before a claim can go out, or only for payers that require one?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-007 — Insurance effective and termination dates are required but not stored

**Question ID:** C-007 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** Kept

**Conflict:** The case profile says the insurance policies on a case include effective and termination dates. The `case_insurance` table does not have those columns, so the system cannot tell whether a policy was active on a date of service.

**Reference A (PRD V2):**
- **Section:** 3.2 Case profile object · **Page:** 4 · **Excerpt:** "Insurances — primary, secondary and tertiary policies, including subscriber info, member ID, group number, effective and termination dates."

**Reference B (PRD V2):**
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `case_insurance` columns: "member_id, group_number… claim_number… subscriber… employer"

**Question for Client:** Should coverage carry effective and termination dates, and should the system refuse to bill a payer for a date of service outside those dates?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-008 — Stated limits do not match the permission flags

**Question ID:** C-008 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** Kept

**Conflict:** Practice Admin has no delete flag on Billing, yet the limits column says the restriction is that they "cannot delete a sent claim", which implies unsent claims may be deleted. The same pattern appears on Month End (create and read only, yet the stated limit is about reopening, which is an update) and Payments (create, read and update, with a note that reversals are posted rather than deleted).

**Reference A (PRD V2):**
- **Section:** 10.6 User permissions · **Page:** 23 · **Excerpt:** "Billing | C R U D | C R U | Cannot delete a sent claim."

**Reference B (PRD V2):**
- **Section:** 10.6 User permissions · **Page:** 22–23 · **Excerpt:** "Payments | C R U D | C R U | Reversals are posted, not deleted." / "Month End | C R U D | C R | Cannot reopen a closed period."

**Question for Client:** For each of these three modules, what exactly should a Practice Admin be able to do — may they delete an unsent claim, and may they reopen a period they closed by mistake?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-009 — ICD indicator fixed at "0" while the payer record allows another ICD version

**Question ID:** C-009 · **Category:** Contradiction · **Priority:** Nice to Clarify · **V2 audit:** Updated — V2 moved the ICD version to class level with per-insurance override (CH-02).

**Conflict:** The CMS-1500 mapping sets the ICD indicator to "0" (ICD-10) in every case. In V2 the ICD version is a class-level default that each insurance may override, implying values other than ICD-10 are possible at two levels.

**Reference A (PRD V2):**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "21 | Y | Case | ICD indicator '0'."

**Reference B (PRD V2):**
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `insurance_class` — "icd_version | text | | Default ICD10."
- **Section:** 10.3 Setup · **Page:** 15–16 · **Excerpt:** `insurance` — "icd_version | text, nullable | | Null = inherit from insurance_class."

**Question for Client:** Will any payer be billed with something other than ICD-10? If not, can the ICD version setting be removed?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-010 — "Organization" on the claim versus the company in the data model

**Question ID:** C-010 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** Kept

**Conflict:** The CMS-1500 mapping sources boxes 25, 32a, 33, 33a and 33b from "Organization". In the data model, the company holds no billing data at all, while the practice holds the NPI, Tax ID and pay-to address — and the practice is labelled "Company" in the application.

**Reference A (PRD V2):**
- **Section:** Chapter 8 — CMS-1500 mapping specification · **Page:** 10 · **Excerpt:** "25 | Y | Organization | Tax ID or SSN…" / "33 | Y | Organization | Organization name + billing address."

**Reference B (PRD V2):**
- **Section:** 10.2 Organization and users · **Page:** 12 · **Excerpt:** `company` — "Exists only so reports can be run across all practices of one owner; it holds no billing data itself."
- **Section:** 10.2 Organization and users · **Page:** 13 · **Excerpt:** `practice` — "One billing entity (shown as 'Company' in the application, top-right of every screen)… Holds the billing constants (NPI, Tax ID, pay-to address) that go on every claim."

**Question for Client:** Which entity's details should print on the claim, and what should each level be called on screen so staff are not confused between "Company", "Organization" and "Practice"?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-011 — Payment amounts are positive only, yet reversals must be posted

**Question ID:** C-011 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** Kept

**Conflict:** Payment amounts are described as positive values that reduce a balance. The permissions table requires reversals to be posted rather than deleted, and a reversal has to increase a balance.

**Reference A (PRD V2):**
- **Section:** 10.5 Billing · **Page:** 21–22 · **Excerpt:** `payment` — "amount | numeric(12,2) | Positive; reduces the line balance."

**Reference B (PRD V2):**
- **Section:** 10.6 User permissions · **Page:** 22–23 · **Excerpt:** "Payments | C R U D | C R U | Reversals are posted, not deleted."

**Question for Client:** How should a reversal appear to the business — as a separate reversing entry that leaves the original visible, or another way? And should any role be able to delete a posted payment?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-012 — Claims "under scrubbing" in one chapter, "already submitted" in the next

**Question ID:** C-012 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** Kept

**Conflict:** Chapter 4 sends a re-sent note to the Updated Charges queue when the record ID matches a claim that is either submitted **or under scrubbing**. Chapter 5 describes the same queue as holding sessions whose record ID matches a claim **already submitted**, with no mention of scrubbing.

**Reference A (PRD V2):**
- **Section:** 4.2 Automated record reconciliation · **Page:** 5 · **Excerpt:** "Existing ID in Submitted or under scrubbing | Stores the newly arrived payload in a dedicated 'Updated Charges / Sessions / Claims' section…"

**Reference B (PRD V2):**
- **Section:** 5.2 Updated charges queue · **Page:** 6 · **Excerpt:** "Holds inbound EMR sessions whose Internal Record ID matches a claim already submitted."

**Question for Client:** If a note is re-sent while its claim is still being validated (not yet sent to the clearinghouse), should the update replace the claim, or wait in the Updated queue for a decision?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-013 — Release buckets versus holds that resubmit automatically

**Question ID:** C-013 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** New in V2 — caused by CH-01.

**Conflict:** Chapter 7 says held claims are categorised by hold reason and "auto-resubmitted when the hold reason is resolved", and the daily batch counts claims "retained in hold queues". V2 routes claims for held insurances to a release bucket named as their hold queue, where they "go out only when a user releases them" — so they are never resubmitted automatically.

**Reference A (PRD V2):**
- **Section:** 7.1 Claim lifecycle states · **Page:** 8 · **Excerpt:** "Claims failing scrubbing validations, categorized strictly by hold reason. Auto-resubmitted when the hold reason is resolved."
- **Section:** 7.2 Daily submission batch metrics · **Page:** 8 · **Excerpt:** "Held / failed count — claims retained in hold queues, grouped by failure code."

**Reference B (PRD V2):**
- **Section:** 6.2 Scrubbing validation matrix · **Page:** 7 · **Excerpt:** "Hold queue: the assigned release bucket"
- **Section:** 10.3 Setup · **Page:** 16 · **Excerpt:** `release_bucket` — "Claims for those insurances stop in the bucket after scrubbing and go out only when a user releases them."

**Question for Client:** Is a claim waiting in a release bucket a held claim — counted as held or failed in the daily batch and subject to the same lifecycle — or a separate state such as "ready, awaiting release"?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---

### C-014 — Location and providers on the case versus on the visit

**Question ID:** C-014 · **Category:** Contradiction · **Priority:** Important · **V2 audit:** New in V2 — Sharpened by V2 — caused by CH-04.

**Conflict:** The hierarchy places Location and Provider above Patient and Case, and providers are described as "assigned to cases and visits". V2 removed location and providers from the case and states they are set per visit only.

**Reference A (PRD V2):**
- **Section:** 3.1 Hierarchy standard · **Page:** 4 · **Excerpt:** "Organization (optional)→ Practice→ Location→ Provider→ Patient→ Case→ Session / Claim→ Charge line / CPT code"
- **Section:** 10.3 Setup · **Page:** 15 · **Excerpt:** `provider` — "Assigned to cases and visits so claims carry the right billing and rendering provider."

**Reference B (PRD V2):**
- **Section:** 10.4 Patient · **Page:** 19 · **Excerpt:** `patient_case` — "Location and providers are set per visit."
- **Section:** 10.7 Relations at a glance · **Page:** 23 · **Excerpt:** "visit | location, provider | * : 1 | Where and by whom."

**Question for Client:** Should a case have a treating location or provider at all (for example as a default for new visits), or are location and providers strictly a property of each visit?

**Why clarification is needed:** Both statements are in the current requirements and cannot both be built as written; the choice belongs to the business.

---


## 6. Missing Business Rules

Rules that appear to be needed for implementation but are not defined anywhere in PRD V2. Each is covered by the entry in brackets.

1. **Rounding and money handling.** No rule for rounding, or for allocating a payment across charge lines when the payer's amounts do not divide evenly. [Q-016, Q-018]
2. **Patient responsibility movement.** No rule for when an amount becomes the patient's, and — now that balances are calculated — no rule for splitting a balance between payer and patient. [Q-017]
3. **Expected allowed amount and underpayments.** V2 stores no expected allowed amount, so no rule exists for detecting underpayment. [Q-075]
4. **Refunds, overpayments and credit balances.** Not mentioned. [Q-046]
5. **Write-off authority.** No thresholds or approval rules for writing off a balance. [Q-048]
6. **Timely filing.** No deadline tracking or warning, although timely filing is a common denial reason. [Q-048]
7. **Authorization consumption and restoration.** No rule for when an authorization is used, or what happens when a visit is voided. [Q-009]
8. **Unit calculation for timed codes.** The 8-minute rule is referenced but no calculation is defined. [Q-021]
9. **Payer unit caps and conditional-box requirements.** Referenced by the scrubbing matrix but never defined or given a home. [Q-011]
10. **Release-bucket release rules.** No rule for who releases, whether a claim is re-checked, or what happens when bucket setup changes. [Q-076, Q-077, C-013]
11. **Insurance-class change propagation.** No rule for when a changed class default applies to claims in progress. [Q-081]
12. **SLA definition.** No start event, no calendar/business-day rule, no definition of "acknowledgement". [Q-027]
13. **Resubmission limits.** No rule for how many times a rejected claim may be corrected and resent. [Q-043]
14. **Character limits and the truncate-or-flag decision.** [Q-007]
15. **Duplicate-claim prevention.** No rule for the "submit anyway" path. [C-004]
16. **Period close effects.** No rule for what a closed period prevents. [Q-049]
17. **Deletion rules.** No rule for what happens to dependent records when a patient, case or coverage is deleted. [Q-034]
18. **Specialty modifier rules.** No rule for choosing GP/GO/GN now that no discipline is recorded. [Q-054]
19. **Inactive procedure codes arriving from the EMR.** The rule covers manual addition only. [Q-082]
20. **Missing visit location or billing provider.** No outcome defined when an EMR session lacks them. [Q-080]

---

## 7. Missing Data Requirements

Fields, entities and relationships that the described behaviour needs but the V2 data model (chapter 10) does not include. Page numbers refer to PRD V2.

| Missing item | Needed by | Entry |
|---|---|---|
| Internal Record ID on the visit | Record reconciliation (§4.2, p5) | C-005 |
| A place for exception, incomplete and inactive records (visit statuses cover only Review, Pended, Delayed, Released) | §4.2–4.4 (p5–6), §10.5 (p20) | C-003, Q-071 |
| Stored payloads for the Updated Charges queue | §5.2 (p6) | C-004 |
| Coding rules (Replace/Drop, default vs payer) | §6.1 (p7) | Q-013 |
| Hold records and their reasons, including which bucket a claim waits in and who released it | §6.2, §7.1 (p7–8); release_bucket (p16) | C-003, C-013, Q-076 |
| Submission batches and scheduled jobs | §5.1, §7.2 (p6, p8) | Q-041, Q-042 |
| Clearinghouse rejections and their reasons | §7.2 (p8) | Q-043 |
| Provider credentialing/enrolment per payer | §6.2 (p7) | Q-010 |
| Payer settings: unit caps, conditional boxes, SLA days, claim format | §6.2, §9.2 (p7, p11) | Q-011, Q-040 |
| Practice taxonomy, DBA, legal name, Tax ID type | §1.1 (p2), Boxes 25/33b (p10) | Q-022 |
| Location EMR link ID and integration status | §2.2–2.3 (p3) | Q-029 |
| Employment status on the case | §4.4 (p6) | Q-008 |
| Coverage effective and termination dates | §3.2 (p4) | C-007 |
| A second physician on a case or claim when both referring and supervising apply | §3.3 (p4), Box 17 (p9), referring_physician (p18) | Q-078 |
| Referring physician taxonomy, contact details, referral orders | §3.2 (p4), §10.3 (p18) | C-006 |
| Expected allowed amount per payer and code | §9.1 (p11), fee_schedule (p17) | Q-075 |
| Insurance versus patient share of a calculated line balance | charge_line (p21), payment (p22) | Q-017 |
| Box 19 claim comment | Box 19 (p9) | Q-063 |
| Payer claim control number and claim frequency code | §5.2 (p6), Box 22 (p10) | Q-019 |
| Check batch header (check total) to balance against | §10.5 (p22) | Q-045 |
| Reversal representation | §10.6 (p23) | C-011 |
| Adjustment reason code list (CARC/RARC) | §4.4 (p6), §10.5 (p22) | Q-018 |
| Delayed A/R items (only denials are modelled) | §9.2 (p11) | Q-028 |
| Appeals | §10.5 (p22) | Q-048 |
| Work-item fields: owner, priority, due date, next action | Core principle (p1) | Q-003 |
| Change history beyond created/updated stamps | §1.4 (p3) | Q-053 |
| Month-end periods | §10.6 (p23) | Q-049 |

**Resolved by V2 and removed from this list:** manual-release preference (now `insurance.insurance_hold` + `release_bucket`, CH-01); referring physician type (CH-12); where a supervising provider is recorded (CH-12); place of service per service line (CH-10).

---

## 8. Missing Workflow Details

1. **EMR integration request → approval → linking → election.** Who approves, what the states are, and how the requester is informed. (§2.2–2.3, p3) [Q-029]
2. **Incomplete profile → completion → release of quarantined sessions.** Who acts, and whether release is automatic. (§4.3, p5) [Q-005]
3. **Billing exception → correction → re-validation.** Who resolves each level, whether an exception can be overridden or dismissed, and what happens if it is never fixed. (§4.4, p5–6) [Q-007]
4. **EMR session → visit without location or providers.** What happens when the payload lacks what V2 now requires on the visit. (§10.5, p20) [Q-080]
5. **Hold → fix → auto-resubmission.** The trigger and the treatment of multiple failures. (§7.1, p8) [Q-012]
6. **Insurance hold → release bucket → user release → submission.** Who releases, whether the claim is re-checked, and what setup changes do to waiting claims. (§6.2, p7; §10.3, p16–17) [Q-076, Q-077, C-013]
7. **Submitted → clearinghouse response.** What arrives back, what states it creates, and how rejections are worked. (§7.1–7.2, p8) [Q-015, Q-043]
8. **Remittance → posting → patient balance → secondary claim.** The matching rules, the exception path and the trigger for the next payer. (§9.1, p11) [Q-017, Q-018]
9. **SLA breach or denial → A/R item → resolution.** What is created, who works it and what closes it. (§9.2, p11) [Q-027, Q-028]
10. **Denial → appeal → outcome.** Appeal levels, deadlines, and what happens when an appeal succeeds or fails. (§10.5, p22) [Q-048]
11. **Corrected or void claim → effect on the original.** What happens to the original claim, its payments, balances and referring-physician snapshot. (§5.2, p6) [Q-044, Q-084]
12. **Month-end close → locked period → reopen.** What the close checks and what it prevents. (§10.6, p23) [Q-049]
13. **Patient collections.** What happens to a patient balance once it exists. (§10.4, p18) [Q-047]

---

## 9. Assumptions We Would Otherwise Have to Make

These are decisions a developer would be forced to take if the questions above go unanswered. They are listed so the client can see the consequence of leaving each one open. **None of these is a recommendation.** Page numbers refer to PRD V2.

### A-001
**Area:** Access control (§1.4, p3; §10.6, p22–23)
**Current PRD V2 information:** Chapter 1 defines Edit / View / Hidden per user and per section; chapter 10 defines create/read/update/delete flags per role and module.
**Missing decision:** Which model governs, and whether individual fields can be hidden.
**Potential assumption:** Build role-based module permissions only, treating Edit as create+read+update, View as read, Hidden as no access, and ignore field-level masking.
**Client question:** C-001

### A-002
**Area:** Roles (§1.3, p2; §2.2, p3; §10.2, p14)
**Current PRD V2 information:** Five role names appear across three chapters; permissions are defined for two.
**Missing decision:** The real list of roles and what each may do.
**Potential assumption:** Treat Organization Admin as a System Admin limited to one company, and Domain Admin as a Practice Admin with integration rights.
**Client question:** C-002

### A-003
**Area:** Claim and visit statuses (§7.1, p8; §10.5, p20–21)
**Current PRD V2 information:** Two status vocabularies, neither covering exceptions, incomplete profiles or inactive records.
**Missing decision:** One agreed status model.
**Potential assumption:** Merge both lists and add the missing states, so screens show statuses that were never agreed with the business.
**Client question:** C-003

### A-004
**Area:** Payment posting (§9.1, p11)
**Current PRD V2 information:** An equation that does not balance as written.
**Missing decision:** The intended formula.
**Potential assumption:** Use the standard industry calculation (charge − contractual adjustment = allowed; allowed − patient responsibility = paid).
**Client question:** Q-016

### A-005
**Area:** Secondary billing (§10.5, p21)
**Current PRD V2 information:** "The secondary claim is created after the primary remit posts."
**Missing decision:** Whether it is automatic, what triggers it after a denial, and how the patient balance interacts.
**Potential assumption:** Create the secondary claim automatically whenever the primary pays and leaves a balance, and never after a denial.
**Client question:** Q-017

### A-006
**Area:** Authorizations (§10.4, p20; §10.5, p20; §6.2, p7)
**Current PRD V2 information:** "Visits consume it"; the visit consumes an authorization only "when the payer requires authorization"; the scrub checks remaining visits.
**Missing decision:** When consumption happens and how units are counted.
**Potential assumption:** Consume one unit per visit at submission, and never restore it.
**Client question:** Q-009

### A-007
**Area:** Credentialing (§6.2, p7)
**Current PRD V2 information:** A check against "active credentialing status… for payer and DOS" sourced from the provider profile.
**Missing decision:** Where enrolment data lives.
**Potential assumption:** Add a provider-by-payer enrolment list to the billing system and ask staff to maintain it by hand.
**Client question:** Q-010

### A-008
**Area:** Billing exceptions (§4.4, p5–6)
**Current PRD V2 information:** "Truncates or flags… exceeding character caps."
**Missing decision:** Which behaviour, and the limits.
**Potential assumption:** Flag rather than truncate, using CMS-1500 field lengths as the caps.
**Client question:** Q-007

### A-009
**Area:** Corrected claims (§5.2, p6; Box 22, p10)
**Current PRD V2 information:** Box 22 needs the Original Reference Number.
**Missing decision:** Where that number comes from.
**Potential assumption:** Store whatever identifier the clearinghouse returns and print that, which may not be the number the payer expects.
**Client question:** Q-019

### A-010
**Area:** Pricing (§3.4, p4; §10.3, p17)
**Current PRD V2 information:** "Pricing configured per unit or per code"; one billed price per payer and code with an effective date range.
**Missing decision:** Flat pricing, dated price changes, and which payer prices a line.
**Potential assumption:** Price every line per unit from the primary payer's schedule, with no price history.
**Client question:** Q-020

### A-011
**Area:** Ingestion (§4.1–4.2, p5)
**Current PRD V2 information:** Payloads arrive from the EMR and are matched on the Internal Record ID.
**Missing decision:** The payload contract, retries and duplicate handling.
**Potential assumption:** Design our own payload format and assume the EMR can produce it, with no retry or failure reporting.
**Client question:** Q-004

### A-012
**Area:** Scheduling and time (§5.1, p6; §7.2, p8)
**Current PRD V2 information:** Scheduled submission at admin-configured intervals; daily batch metrics per calendar day.
**Missing decision:** Time zone, interval options and job scope.
**Potential assumption:** Run one job per practice at a fixed daily time in the practice's local time zone.
**Client question:** Q-041, Q-042

### A-013
**Area:** Security (§10.6, p23)
**Current PRD V2 information:** Only the masking rule for two encrypted fields.
**Missing decision:** Authentication, retention, hosting and audit obligations.
**Potential assumption:** Implement standard username/password sign-in with no multi-factor authentication and no defined retention period.
**Client question:** Q-025, Q-026

### A-014
**Area:** Scope of the first release (Chapter 11, p24)
**Current PRD V2 information:** Five modules are in scope but unspecified.
**Missing decision:** What ships first.
**Potential assumption:** Build only chapters 1–10 and treat dashboards, reports, eligibility and month end as later phases — despite Month End and Reports appearing in the permissions table.
**Client question:** Q-001

### A-015
**Area:** Release buckets (§6.2, p7; §10.3, p16)
**Current PRD V2 information:** Claims for held insurances wait in a bucket "until a user releases it".
**Missing decision:** Who may release, in what quantity, and whether the claim is checked again.
**Potential assumption:** Let any user with update rights on Billing release any claim in any bucket of their practice, singly or all at once, and re-run the checks before sending.
**Client question:** Q-076

### A-016
**Area:** Allowed amount (§9.1, p11; §10.3, p17)
**Current PRD V2 information:** The fee schedule stores only the billed price; the equation uses an allowed amount.
**Missing decision:** The source of the allowed amount and whether underpayments are detected.
**Potential assumption:** Take the allowed amount only from each remittance and do not detect underpayments.
**Client question:** Q-075

### A-017
**Area:** Visit location and providers (§10.5, p20)
**Current PRD V2 information:** Set "from the EMR payload or manual entry"; the case supplies no default.
**Missing decision:** What happens when the payload lacks them.
**Potential assumption:** Treat a session without a location or billing provider as a session-level billing exception.
**Client question:** Q-080

### A-018
**Area:** Insurance classes (§10.3, p15–16)
**Current PRD V2 information:** Insurances inherit class rules unless overridden.
**Missing decision:** When a changed class rule takes effect.
**Potential assumption:** Apply the effective value at the moment each claim is scrubbed, so claims not yet scrubbed pick up the change and others do not.
**Client question:** Q-081

### A-019
**Area:** Initial data (§3.4, p4; §10.2, p14; §10.3, p17)
**Current PRD V2 information:** Two roles are seeded; procedure codes are shared reference data; a System Default Fee Schedule is mentioned.
**Missing decision:** What else exists before staff enter anything, and what a new practice starts with.
**Potential assumption:** Seed only the two roles; load the standard ICD-10 and CARC / RARC code sets as lookups; leave procedure codes, fees, insurance classes and all practice data to be entered; open the current month as the first accounting period of a new practice.
**Client question:** Q-085

### A-021
**Area:** Coding rules (§6.1, p7; §10.3, p16)
**Current PRD V2 information:** Rules are Default System Rules or Payer-Specific Rules; insurances inherit billing rules from their class.
**Missing decision:** Whether a coding rule may target an insurance class, and which level wins.
**Potential assumption:** Allow class-level rules and resolve payer rule → class rule → default rule, mirroring the billing-rule inheritance.
**Client question:** Q-097

### A-020
**Area:** First account (§1.1–1.2, p2; §10.6, p23)
**Current PRD V2 information:** Only a System Admin may create practices; a primary location is mandatory at account creation.
**Missing decision:** How the first System Admin account is created and who creates the first practice.
**Potential assumption:** Each installation is delivered with one System Admin account, and that person creates the first practice and its primary location.
**Client question:** Q-086

---

## 10. Retired Questions (answered by PRD V2)

Kept so that earlier references still resolve. Do not send these to the client.

### Q-023 — Where is the supervising provider recorded? · RETIRED

**Answer in V2:** Answered by V2: a supervising physician is recorded in the referring-physician directory with type "Supervising (DQ)", which sets the Box 17 qualifier.

**PRD V2 reference:**
- **Section:** 10.3 Setup · **Page:** 18 · **Excerpt:** `referring_physician` — "type | text | | Referring (DN) or Supervising (DQ); sets the Box 17 qualifier."

**Remaining question:** The remaining part — whether one case or claim can carry both a referring and a supervising physician — continues as Q-078.

---

### Q-039 — Where is place of service set for a visit? · RETIRED

**Answer in V2:** Answered by V2: place of service is recorded on each charge line and defaults from the location.

**PRD V2 reference:**
- **Section:** 10.5 Billing · **Page:** 21 · **Excerpt:** `charge_line` — "place_of_service | char(2) | | CMS-1500 Box 24B. Defaults from location.place_of_service."

**Remaining question:** The remaining part — lines with different places of service on one visit, and Box 32 — continues as Q-079.

---

## 11. How to use this document

1. Review and remove anything the client has already answered verbally.
2. The 30 Critical questions block a correct build; consider sending them first, with C-001 to C-005.
3. The 14 contradictions need a decision from the client, not from us. Each names both conflicting statements so they can judge.
4. Entries marked **New in V2** or **Updated** are the ones the client has not seen before if a V1 version of this list was shared.
5. As answers come in, record them in `PROJECT_MEMORY.md` (Open Questions, Business Rules, Assumptions) and update any prototype assumption in `PROTOTYPE_COVERAGE.md` that points at the answered entry.
